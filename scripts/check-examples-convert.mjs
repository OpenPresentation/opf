#!/usr/bin/env node
// RR-97: every example deck under examples/ converts to PNG and PPTX with the workspace CLI. A deck that names a resource
// that does not exist (a relative image path, an unreadable data URI) fails `opf convert` with pptx/asset-unresolved, so
// a first-use `opf convert examples/... out.pptx` must never be the way the gap is found. The check fails when a
// conversion exits non-zero or its report has an error-severity finding. Output goes to a temporary directory and the
// conversions run in parallel (OPF_EXAMPLES_CONVERT_JOBS, default the number of CPUs).
//   node scripts/check-examples-convert.mjs           convert every example
//   node scripts/check-examples-convert.mjs --list    print the example decks and exit
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { availableParallelism, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSpec } from './package-manager.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'packages', 'cli', 'dist', 'index.js');
export const FORMATS = ['png', 'pptx'];

const isDeck = (name) => /\.opf\.(json|ya?ml|md)$/.test(name) || (name.endsWith('.md') && !/^README\.md$/i.test(name));

/** Every example deck under `directory`, as sorted repository-relative paths with forward slashes. */
export function exampleDecks(directory = path.join(root, 'examples')) {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && isDeck(entry.name)) found.push(path.relative(root, full).split(path.sep).join('/'));
    }
  };
  walk(directory);
  return found.sort();
}

/** Why a finished conversion fails, or undefined when it passed: exit code, unreadable report or error-severity findings. */
export function failureOf({ code, stdout, stderr }) {
  let report;
  try {
    report = JSON.parse(stdout.trim() === '' ? stderr : stdout);
  } catch {
    return code === 0 ? 'the report is not JSON' : `exit ${code}: ${(stderr || stdout).trim().split('\n')[0] ?? ''}`;
  }
  const errors = (report.findings ?? []).filter((finding) => finding.severity === 'error');
  const lines = errors.map((finding) => `${finding.ruleId}${finding.path ? ` ${finding.path}` : ''}: ${finding.message}`);
  if (code !== 0) return [`exit ${code}${report.error ? `: ${report.error}` : ''}`, ...lines].join('\n    ');
  if (lines.length > 0) return lines.join('\n    ');
  if (report.ok === false) return `the report says ok: false${report.error ? `: ${report.error}` : ''}`;
  return undefined;
}

// The CLI's dist is what the check runs. CI builds before `pnpm test`; a checkout without it, or with sources newer than
// it, builds here (the build is a reuse hit inside a CI job).
function ensureBuilt() {
  const newest = (dir) => readdirSync(dir, { withFileTypes: true }).reduce((latest, entry) => {
    const full = path.join(dir, entry.name);
    return Math.max(latest, entry.isDirectory() ? newest(full) : statSync(full).mtimeMs);
  }, 0);
  if (existsSync(cli) && statSync(cli).mtimeMs >= newest(path.join(root, 'packages', 'cli', 'src'))) return;
  console.log('check-examples-convert: building the workspace CLI');
  const spec = spawnSpec(['pnpm', '--filter', '@openpresentation/cli', 'build']);
  const built = spawnSync(spec.command, spec.args, { cwd: root, stdio: 'inherit', ...spec.options });
  if (built.status !== 0) throw new Error('the workspace CLI did not build');
}

function convert(input, output) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, 'convert', input, output, '--force'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => resolve({ code: 1, stdout, stderr: String(error) }));
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

async function main(argv) {
  const decks = exampleDecks();
  if (argv.includes('--list')) {
    console.log(decks.join('\n'));
    return 0;
  }
  if (decks.length === 0) throw new Error('no example decks found under examples/');
  ensureBuilt();
  const jobs = Math.max(1, Number(process.env.OPF_EXAMPLES_CONVERT_JOBS) || availableParallelism());
  const work = await mkdtemp(path.join(tmpdir(), 'opf-examples-convert-'));
  const tasks = decks.flatMap((deck, index) => FORMATS.map((format) => ({ deck, format, output: path.join(work, String(index), `deck.${format}`) })));
  const failures = [];
  const started = Date.now();
  try {
    let next = 0;
    const worker = async () => {
      for (let at = next++; at < tasks.length; at = next++) {
        const { deck, format, output } = tasks[at];
        const reason = failureOf(await convert(deck, output));
        if (reason) failures.push({ deck, format, reason });
      }
    };
    await Promise.all(Array.from({ length: Math.min(jobs, tasks.length) }, worker));
  } finally {
    await rm(work, { recursive: true, force: true });
  }
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (failures.length > 0) {
    failures.sort((a, b) => a.deck.localeCompare(b.deck) || a.format.localeCompare(b.format));
    console.error(`check-examples-convert: ${failures.length} of ${tasks.length} conversions failed:`);
    for (const { deck, format, reason } of failures) console.error(`  ${deck} -> ${format}\n    ${reason}`);
    return 1;
  }
  console.log(`check-examples-convert: ${decks.length} example decks convert to ${FORMATS.join(' and ')} (${tasks.length} conversions, ${jobs} at a time, ${seconds}s)`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (error) => { console.error(error); process.exitCode = 1; });
}
