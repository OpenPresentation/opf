#!/usr/bin/env node
// RR-95: every `opf ...` command quoted in the agent skills (skills/**/*.md), the guides (docs/*.md) and the first-deck README must parse against
// the workspace CLI. The opf-author skill once told users to run `opf create deck.opf.json --from authored.json`, an option
// removed in 0.18, and nothing stopped it shipping.
//
// For each quoted command this checks the subcommand and every option it uses, with the CLI's own argument parser and
// without running the command: the options go to `opf <command> ... --help`, which parses them all and then prints the help
// instead of doing the work. A removed or unknown option or command exits 2 with the CLI's own message (and its "removed in
// 0.18" or "did you mean" hint). Positional arguments (file names, patterns) are not checked.
//
// Commands are taken from fenced shell blocks (sh, bash, shell, zsh, console, or no language) and from inline code spans that
// start with `opf `. A command that is meant to fail (for example a sentence naming a removed command) goes in
// scripts/skill-commands-allowlist.json with the reason (an entry names the command text and, optionally, one file); an entry
// that no longer matches a failing command fails too.
//
//   node scripts/check-skill-commands.mjs            check skills/, docs/*.md and docs/first-deck/README.md against packages/cli/dist
//   node scripts/check-skill-commands.mjs --list     print every command found and its result
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = path.join(root, 'packages', 'cli', 'dist', 'index.js');
const allowlistPath = path.join(root, 'scripts', 'skill-commands-allowlist.json');

const SHELL_LANGUAGES = new Set(['', 'sh', 'bash', 'shell', 'zsh', 'console', 'terminal', 'shell-session']);
const LAUNCHERS = [/^npx\s+(?:--yes\s+|-y\s+)?(?:@openpresentation\/cli(?:@\S+)?|opf)\s+/, /^pnpm\s+(?:dlx|exec)\s+(?:@openpresentation\/cli(?:@\S+)?|opf)\s+/, /^pnpm\s+opf\s+/, /^opf\s+/];

/** The shell words of one command, honouring single and double quotes. */
export function words(text) {
  const result = [];
  let current = '';
  let quote = null;
  let started = false;
  for (const char of text) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      started = true;
    } else if (/\s/.test(char)) {
      if (started || current) result.push(current);
      current = '';
      started = false;
    } else {
      current += char;
    }
  }
  if (started || current) result.push(current);
  return result;
}

/** `opf ...` with a launcher stripped, cut at the first shell operator; undefined when the text is not an opf command. */
export function commandOf(text) {
  let line = text.trim().replace(/^\$\s+/, '');
  const launcher = LAUNCHERS.find((pattern) => pattern.test(line));
  if (!launcher) return line === 'opf' ? 'opf' : undefined;
  line = line.replace(launcher, 'opf ');
  // Cut at a pipe, a list operator or a redirect that is outside quotes.
  let quote = null;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === '|' || char === ';' || char === '&' || char === '>' || char === '<' || char === '#') return line.slice(0, index).trim();
  }
  return line.trim();
}

/** The opf commands quoted in a Markdown file: [{ line, command }]. */
export function extractCommands(markdown) {
  const found = [];
  const lines = markdown.split('\n');
  let fence = null; // { marker, language }
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const opening = /^\s*(`{3,}|~{3,})\s*([\w-]*)/.exec(line);
    if (opening && !fence) {
      fence = { marker: opening[1][0].repeat(opening[1].length), language: opening[2].toLowerCase() };
      continue;
    }
    if (fence) {
      if (new RegExp(`^\\s*${fence.marker[0]}{${fence.marker.length},}\\s*$`).test(line)) {
        fence = null;
        continue;
      }
      if (!SHELL_LANGUAGES.has(fence.language)) continue;
      let text = line;
      let last = index;
      while (/\\\s*$/.test(text) && last + 1 < lines.length) text = `${text.replace(/\\\s*$/, '').trimEnd()} ${lines[++last].trim()}`;
      const command = commandOf(text);
      if (command) found.push({ line: index + 1, command });
      index = last;
      continue;
    }
    for (const span of line.matchAll(/(?<!`)`([^`\n]+)`(?!`)/g)) {
      const command = commandOf(span[1]);
      if (command) found.push({ line: index + 1, command });
    }
  }
  return found;
}

/** Which options of `usage` (the text of `opf <command> --help`) take a value: `--name <value>`. */
export function valueOptions(usageText) {
  return new Set([...usageText.matchAll(/--([a-z][a-z0-9-]*)\s+<[^>]+>/g)].map((match) => match[1]));
}

/** The arguments that make the CLI parse every option of a quoted command and then print help. */
export function probeArguments(command, valueOptionsOf) {
  const tokens = words(command).slice(1);
  if (!tokens.length) return [];
  const [name, ...rest] = tokens;
  if (name.startsWith('-') || name === 'help') return tokens; // `opf --version`, `opf help convert`
  const takesValue = valueOptionsOf(name);
  const args = [name];
  for (const token of rest) {
    if (token === '--') break;
    if (token.startsWith('--')) {
      const equals = token.indexOf('=');
      const option = equals > 2 ? token.slice(2, equals) : token.slice(2);
      args.push(equals > 2 ? token : `--${option}`);
      if (equals < 0 && takesValue.has(option)) args.push('x');
    } else if (/^-[a-z]$/i.test(token)) args.push(token);
  }
  args.push('--help');
  return args;
}

/** Run the CLI; { status, message }. */
function runCli(args) {
  const run = spawnSync(process.execPath, [cliPath, ...args], { encoding: 'utf8', timeout: 30_000 });
  const output = `${run.stdout ?? ''}${run.stderr ?? ''}`;
  let message = output.trim();
  try {
    message = JSON.parse(output).error ?? message;
  } catch {}
  return { status: run.status, output, message };
}

/** Check one command against the CLI: undefined when it parses, else the problem. */
export function checkCommand(command, runUncached = runCli, memo = new Map()) {
  // Many quoted commands probe the same subcommand and options: run each distinct probe once.
  const run = (args) => {
    const key = args.join('\0');
    if (!memo.has(key)) memo.set(key, runUncached(args));
    return memo.get(key);
  };
  const usages = new Map();
  const valueOptionsOf = (name) => {
    if (!usages.has(name)) usages.set(name, run([name, '--help']));
    const help = usages.get(name);
    return help.status === 0 ? valueOptions(help.output) : new Set();
  };
  const args = probeArguments(command, valueOptionsOf);
  const result = run(args);
  if (result.status === 0) return undefined;
  return result.message || `opf ${args.join(' ')} exited ${result.status}`;
}

function markdownFiles(directory) {
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...markdownFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.md')) result.push(full);
  }
  return result.sort();
}

/** The Markdown files whose commands are checked: skills/**, docs/*.md and the first-deck README. */
export function sources() {
  const docs = readdirSync(path.join(root, 'docs'), { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith('.md'));
  const files = [...markdownFiles(path.join(root, 'skills')), ...docs.map((entry) => path.join(root, 'docs', entry.name)), path.join(root, 'docs', 'first-deck', 'README.md')];
  return files.map((file) => ({
    file: path.relative(root, file).split(path.sep).join('/'),
    text: readFileSync(file, 'utf8'),
  }));
}

/** Check every command of the given sources; returns { checked, failures, staleAllowlist }. */
export function checkSources(files, allowlist, run = runCli) {
  const entries = allowlist.map((entry) => ({ ...entry, used: false }));
  const allowedFor = (file, command) => entries.find((entry) => entry.command === command && (entry.file === undefined || entry.file === file));
  const cache = new Map();
  const memo = new Map();
  const failures = [];
  const results = [];
  for (const { file, text } of files) {
    for (const { line, command } of extractCommands(text)) {
      if (!cache.has(command)) cache.set(command, checkCommand(command, run, memo));
      const problem = cache.get(command);
      const entry = problem ? allowedFor(file, command) : undefined;
      if (entry) entry.used = true;
      results.push({ file, line, command, problem, allowed: Boolean(entry) });
      if (problem && !entry) failures.push({ file, line, command, problem });
    }
  }
  const staleAllowlist = entries.filter((entry) => !entry.used);
  return { checked: results.length, results, failures, staleAllowlist };
}

function main() {
  if (!existsSync(cliPath)) {
    console.error(`check:skill-commands needs the built CLI (${path.relative(root, cliPath)}). Run pnpm build first.`);
    process.exit(2);
  }
  const allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8')).allow ?? [];
  const { checked, results, failures, staleAllowlist } = checkSources(sources(), allowlist);
  if (process.argv.includes('--list')) {
    for (const { file, line, command, problem, allowed } of results) console.log(`${problem ? (allowed ? 'ALLOWED' : 'FAIL   ') : 'ok     '} ${file}:${line}  ${command}`);
  }
  for (const failure of failures) {
    console.error(`${failure.file}:${failure.line}: \`${failure.command}\`\n  ${failure.problem.split('\n')[0]}`);
  }
  for (const entry of staleAllowlist) console.error(`scripts/skill-commands-allowlist.json: no failing command \`${entry.command}\`${entry.file ? ` in ${entry.file}` : ''} (remove the entry)`);
  if (failures.length || staleAllowlist.length) {
    console.error(`\n${failures.length} quoted command(s) do not parse against the workspace CLI; ${staleAllowlist.length} stale allowlist entr${staleAllowlist.length === 1 ? 'y' : 'ies'}. Fix the text, or allowlist a command that is meant to fail (with a reason).`);
    process.exit(1);
  }
  console.log(`check:skill-commands: ${checked} quoted opf commands in skills/, docs/*.md and the first-deck README parse against the workspace CLI.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
