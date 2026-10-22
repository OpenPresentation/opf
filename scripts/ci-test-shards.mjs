// RR-57: run one slice of a sibling's `npm test` in CI, so its long file-by-file suite (opf-pptx 15 min, opf-render 15 min
// in a serial `node scripts/run-tests.mjs`) runs as parallel shards without dropping a check.
//
// A sibling's `test` (and `test:contract`) script is a chain: `npm run build && ... && node scripts/run-tests.mjs [--suite X]
// && ... checks`. Shard i of n runs
//   - every `npm run build` of the chain (each shard needs its own dist),
//   - the tests of its slice of `node scripts/run-tests.mjs [--suite X] --list`, one `node [--test] test/<file>` each, in the
//     runner's order (the runner's own contract is to run them in name order and stop at the first failure),
//   - and, in shard 1 only, every other command of the chain (the checks before and after the tests), in chain order.
// So the shards together run exactly the chain's commands and every listed test once. The slices are fixed by the sibling's own
// list and by scripts/ci-test-weights.json (seconds per file, from CI logs), so each job computes the same partition. A stale
// weight only unbalances the shards. A chain this module cannot read (no run-tests command, or more than one) is never split:
// shard 1 runs the whole script and the other shards run nothing.
//
//   node scripts/ci-test-shards.mjs --sibling opf-pptx --script test --shard 2/3 [--dry-run]   (from the core checkout)
//
// MR-30: in the monorepo the packages are workspace directories, so ci.yml runs a shard directly:
//   node scripts/ci-test-shards.mjs --package pptx --script test --shard 2/3 [--dry-run]
// `--package` is render, pptx or editor (packages/<id>; the weights stay keyed by the old repository names). It prints and runs
// the shard's commands in the package directory; `--dry-run` only prints them. `npm run` and `pnpm run` steps both work.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSpec } from './package-manager.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_WEIGHT = 4;
/** Seconds of fixed work that shard 1 also carries (its checks), so the tests spread a little thinner there. */
export const SHARD_ONE_OVERHEAD = 30;
/** A build step every shard repeats (each shard needs its own dist, and its dependencies' dist: `build:deps`, MR-23). */
const BUILD_STEP = /^(?:npm|pnpm) run build(?::deps)?$/;
/** The run-tests command of a package script: the package's own `scripts/run-tests.mjs`, or the root one (`../../scripts/`, MR-23). */
const RUN_TESTS = /^node (?:\.\.\/\.\.\/)?scripts\/run-tests\.mjs(?: --suite (?:contract|full))?$/;

/** Parse "2/3" into {index: 2, count: 3}; throws on anything else. */
export function parseShard(text) {
  const match = /^(\d+)\/(\d+)$/.exec(text ?? '');
  if (!match) throw new Error(`A test shard is written index/count, for example 2/3, not ${text}`);
  const index = Number(match[1]);
  const count = Number(match[2]);
  if (count < 1 || count > 16 || index < 1 || index > count) throw new Error(`Test shard ${text} is out of range (1 <= index <= count <= 16)`);
  return { index, count };
}

/** The commands of an npm script that is a plain `a && b && c` chain: [{ command, isTests }]. */
export function parseChain(script) {
  return script.split('&&').map((part) => part.trim()).filter(Boolean).map((command) => ({ command, isTests: RUN_TESTS.test(command) }));
}

/** The argv words of `node [--test] test/x.mjs` as a test runner list prints them, without the leading `node`. */
export function listedTestArguments(line) {
  const words = line.trim().split(/\s+/);
  if (words[0] !== 'node' || words.length < 2) throw new Error(`Unreadable test list line: ${line}`);
  return words.slice(1);
}

const fileOf = (line) => path.posix.basename(line.trim().split(/\s+/).at(-1));

/**
 * Split the listed tests (lines of `--list`) into `count` slices by longest-processing-time-first on `weights` (file name -> seconds).
 * Returns an array of `count` arrays of lines, each in the original list order.
 */
export function partitionTests(lines, weights, count, overhead = SHARD_ONE_OVERHEAD) {
  const loads = Array.from({ length: count }, (_, index) => (index === 0 ? overhead : 0));
  const slices = Array.from({ length: count }, () => new Set());
  const order = lines.map((line, position) => ({ line, position, weight: weights[fileOf(line)] ?? DEFAULT_WEIGHT }));
  order.sort((a, b) => b.weight - a.weight || a.position - b.position);
  for (const item of order) {
    let target = 0;
    for (let index = 1; index < count; index++) if (loads[index] < loads[target]) target = index;
    loads[target] += item.weight;
    slices[target].add(item.line);
  }
  return slices.map((slice) => lines.filter((line) => slice.has(line)));
}

/**
 * The commands shard `shard` of a sibling script runs: [{ argv: string[] (after `node` or `npm`), tool: 'node' | 'npm' | 'shell', text }].
 * `script` is the package.json script text; `listLines` the sibling's `node scripts/run-tests.mjs [--suite X] --list` lines (the
 * list of the run-tests command inside the script); `weights` this sibling's file weights.
 */
export function shardCommands({ script, scriptName, listLines, weights, shard, overhead }) {
  const chain = parseChain(script);
  const testsAt = chain.filter((entry) => entry.isTests);
  if (testsAt.length !== 1) {
    return shard.index === 1 ? [{ tool: 'npm', argv: ['run', scriptName], text: `npm run ${scriptName}`, whole: true }] : [];
  }
  const commands = [];
  const slice = partitionTests(listLines, weights, shard.count, overhead)[shard.index - 1];
  for (const entry of chain) {
    if (entry.isTests) {
      for (const line of slice) commands.push({ tool: 'node', argv: listedTestArguments(line), text: line.trim() });
    } else if (BUILD_STEP.test(entry.command) || shard.index === 1) {
      commands.push(toCommand(entry.command));
    }
  }
  return commands;
}

function toCommand(command) {
  const words = command.split(/\s+/);
  if (words[0] === 'npm' || words[0] === 'pnpm') return { tool: words[0], argv: words.slice(1), text: command };
  if (words[0] === 'node') return { tool: 'node', argv: words.slice(1), text: command };
  throw new Error(`Cannot shard a script step that is not an npm, pnpm or node command: ${command}`);
}

/** `--suite X` of the run-tests command in a script, as the arguments to pass to it with `--list`. */
export function listArguments(script) {
  const tests = parseChain(script).find((entry) => entry.isTests);
  return tests ? tests.command.split(/\s+/).slice(2) : [];
}

/** The path of the run-tests script in a package script, relative to the package directory (`scripts/run-tests.mjs` or the root's). */
export function runnerPath(script) {
  const tests = parseChain(script).find((entry) => entry.isTests);
  return tests ? tests.command.split(/\s+/)[1] : 'scripts/run-tests.mjs';
}

export function loadWeights(sibling, file = path.join(root, 'scripts', 'ci-test-weights.json')) {
  return JSON.parse(readFileSync(file, 'utf8'))[sibling] ?? {};
}

/** Read the sibling's package script and test list, and return its shard's commands (used by test-package-ecosystem.mjs). */
export function planSiblingShard({ siblingRoot, sibling, scriptName, shard, weights = loadWeights(sibling), overhead }) {
  const scripts = JSON.parse(readFileSync(path.join(siblingRoot, 'package.json'), 'utf8')).scripts;
  const script = scripts[scriptName];
  if (typeof script !== 'string') throw new Error(`${sibling} has no ${scriptName} script`);
  let listLines = [];
  if (parseChain(script).some((entry) => entry.isTests)) {
    const run = spawnSync(process.execPath, [runnerPath(script), ...listArguments(script), '--list'], { cwd: siblingRoot, encoding: 'utf8' });
    if (run.status !== 0) throw new Error(`${sibling}: run-tests --list failed (${run.status}): ${run.stderr}`);
    listLines = run.stdout.split('\n').filter((line) => line.trim());
    if (!listLines.length) throw new Error(`${sibling}: run-tests --list printed no tests`);
  }
  return shardCommands({ script, scriptName, listLines, weights, shard, overhead });
}

/**
 * Seconds that shard 1 of a workspace package also carries in ci.yml: the quarantine check, typecheck, validate, the code and
 * font-variant checks and (for a changed PPTX) the native control checks run there before the tests. The old per-repository
 * CI logs put them at 60 to 120 s; the sibling constant above (30 s) is for the checks inside the script chain only.
 */
export const PACKAGE_SHARD_ONE_OVERHEAD = 100;

/** The workspace packages whose test scripts are sharded, with the key of their weights. */
export const SHARDED_PACKAGES = Object.freeze({
  render: { dir: 'packages/render', weights: 'opf-render' },
  pptx: { dir: 'packages/pptx', weights: 'opf-pptx' },
  editor: { dir: 'packages/editor', weights: 'opf-editor' },
});

/** Run one command of a shard in `cwd` with the selected package manager and Node (Windows-safe); throws on a non-zero exit. */
function execute(entry, cwd) {
  const argv = entry.tool === 'node' ? [process.execPath, ...entry.argv] : [entry.tool, ...entry.argv];
  const { command, args, options } = spawnSpec(argv);
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${entry.text} failed (${result.status})`);
}

/** The commands of shard `shard` of `scriptName` in workspace package `id`. */
export function planPackageShard({ id, scriptName, shard, repositoryRoot = root }) {
  const entry = SHARDED_PACKAGES[id];
  if (!entry) throw new Error(`--package must be one of ${Object.keys(SHARDED_PACKAGES).join(', ')}, not ${id}`);
  const packageRoot = path.join(repositoryRoot, entry.dir);
  return { packageRoot, commands: planSiblingShard({ siblingRoot: packageRoot, sibling: entry.weights, scriptName, shard, overhead: PACKAGE_SHARD_ONE_OVERHEAD }) };
}

function main(argv) {
  const value = (name) => argv[argv.indexOf(name) + 1];
  const scriptName = value('--script') ?? 'test';
  const shard = parseShard(value('--shard'));
  if (argv.includes('--package')) {
    const { packageRoot, commands } = planPackageShard({ id: value('--package'), scriptName, shard });
    console.log(`::notice title=Test shard ${shard.index}/${shard.count}::${value('--package')} ${scriptName}: ${commands.length} command(s)`);
    for (const entry of commands) {
      console.log(`+ ${entry.text}`);
      if (!argv.includes('--dry-run')) execute(entry, packageRoot);
    }
    return 0;
  }
  const sibling = value('--sibling');
  const siblingRoot = path.resolve(root, '..', sibling);
  const commands = planSiblingShard({ siblingRoot, sibling, scriptName, shard });
  if (argv.includes('--dry-run')) {
    console.log(commands.map((entry) => entry.text).join('\n'));
    return 0;
  }
  throw new Error('Run shards through scripts/test-package-ecosystem.mjs --test-shard, or with --package (a workspace package); use --dry-run here to print the commands.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
