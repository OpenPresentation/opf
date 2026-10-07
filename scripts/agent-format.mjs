#!/usr/bin/env node
// RR-57: Claude Code PostToolUse hook (.claude/settings.json) that runs Biome on the file an agent just edited, so a
// formatting or lint error is fixed or reported at the edit and not found later in the "Verify OPF packages" job.
// It reads the hook JSON from stdin and takes tool_input.file_path. A file that is not inside this repository, is not
// a file Biome handles, or is ignored by biome.json is skipped. Otherwise it runs
//   biome check --write <file>
// which applies Biome's SAFE fixes (the formatter when biome.json enables it, safe lint fixes such as let to const)
// and never the unsafe ones, so it cannot delete an import the agent is about to use. If the file changed, or an
// error that fails `pnpm lint` is left, it prints PostToolUse JSON (hookSpecificOutput.additionalContext) so the
// agent re-reads the file and fixes the rest. It never fails the hook: it always exits 0, with a reason on stderr.
// Cross-platform: no jq, no bash, Biome's JavaScript launcher through node.
import { spawnSync } from 'node:child_process';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TIMEOUT_MS = 10_000;
const MAX_REPORTED = 6;
const HANDLED = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.mts', '.cts', '.tsx', '.json', '.jsonc', '.css']);

/** The repository root, from the location of this script: scripts/agent-format.mjs -> its parent. */
export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The absolute path of the file to format, or {skip: reason}. `base` resolves a relative file_path. */
export function targetFile(payload, root = repoRoot, base = process.cwd()) {
  const given = payload?.tool_input?.file_path;
  if (typeof given !== 'string' || given === '') return { skip: 'no tool_input.file_path' };
  const file = path.resolve(typeof payload.cwd === 'string' ? payload.cwd : base, given);
  if (!HANDLED.has(path.extname(file).toLowerCase())) return { skip: `${path.basename(file)} is not a file type Biome checks here` };
  let real;
  try {
    if (!statSync(file).isFile()) return { skip: `${file} is not a file` };
    real = realpathSync(file);
  } catch {
    return { skip: `${file} does not exist` };
  }
  const relative = path.relative(realpathSync(root), real);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) return { skip: `${file} is outside the repository` };
  const parts = relative.split(path.sep);
  if (parts.includes('node_modules') || parts[0] === '.git') return { skip: `${relative} is not source` };
  return { file: real, relative };
}

// Biome's github reporter prints `::error title=<rule>,file=<path>,line=<n>,...::<message>` for each error.
export function parseErrors(output, root = repoRoot) {
  const errors = [];
  for (const line of output.split(/\r?\n/)) {
    const match = /^::error title=([^,]*),file=(.*?),line=(\d+),[^:]*::(.*)$/.exec(line);
    if (match) errors.push(`${path.relative(root, match[2]).split(path.sep).join('/')}:${match[3]} ${match[1]}: ${match[4]}`);
  }
  return errors;
}

/** The additionalContext text, or null when there is nothing to tell the agent. */
export function contextFor(relative, changed, errors) {
  const parts = [];
  if (changed) parts.push(`Biome reformatted or auto-fixed ${relative} after your edit; read it again before the next edit to it.`);
  if (errors.length) {
    const shown = errors.slice(0, MAX_REPORTED).join('\n');
    const more = errors.length > MAX_REPORTED ? `\n(${errors.length - MAX_REPORTED} more)` : '';
    parts.push(`Biome errors left in ${relative}; they fail \`pnpm lint\` in CI, fix them:\n${shown}${more}`);
  }
  return parts.length ? parts.join('\n') : null;
}

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve('');
    let text = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      text += chunk;
    });
    process.stdin.on('end', () => resolve(text));
    process.stdin.on('error', () => resolve(text));
  });
}

export function runBiome(root, relative, timeout = TIMEOUT_MS) {
  const biome = createRequire(path.join(root, 'package.json')).resolve('@biomejs/biome/bin/biome');
  const args = [biome, 'check', '--write', '--colors=off', '--diagnostic-level=error', '--reporter=github', '--files-ignore-unknown=true', '--no-errors-on-unmatched', relative];
  return spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout });
}

export async function main(stdin = readStdin) {
  const text = await stdin();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    console.error('agent-format: stdin is not JSON; skipped');
    return null;
  }
  const target = targetFile(payload);
  if (target.skip) {
    console.error(`agent-format: skipped: ${target.skip}`);
    return null;
  }
  const before = readFileSync(target.file);
  const result = runBiome(repoRoot, target.relative);
  if (result.error) {
    console.error(`agent-format: Biome did not run (${result.error.code ?? result.error.message}); file left as it is`);
    return null;
  }
  const changed = !before.equals(readFileSync(target.file));
  const errors = parseErrors(`${result.stdout}\n${result.stderr}`);
  const additionalContext = contextFor(target.relative, changed, errors);
  if (!additionalContext) return null;
  return { hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const finish = (output) => {
    if (output) process.stdout.write(`${JSON.stringify(output)}\n`);
    process.exitCode = 0;
  };
  main().then(finish, (error) => {
    console.error(`agent-format: ${error.message}`);
    finish(null);
  });
}
