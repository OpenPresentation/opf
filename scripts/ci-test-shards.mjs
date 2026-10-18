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
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_WEIGHT = 4;
/** Seconds of fixed work that shard 1 also carries (its checks), so the tests spread a little thinner there. */
export const SHARD_ONE_OVERHEAD = 30;
const RUN_TESTS = /^node scripts\/run-tests\.mjs(?: --suite (?:contract|full))?$/;

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
export function partitionTests(lines, weights, count) {
  const loads = Array.from({ length: count }, (_, index) => (index === 0 ? SHARD_ONE_OVERHEAD : 0));
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
export function shardCommands({ script, scriptName, listLines, weights, shard }) {
  const chain = parseChain(script);
  const testsAt = chain.filter((entry) => entry.isTests);
  if (testsAt.length !== 1) {
    return shard.index === 1 ? [{ tool: 'npm', argv: ['run', scriptName], text: `npm run ${scriptName}`, whole: true }] : [];
  }
  const commands = [];
  const slice = partitionTests(listLines, weights, shard.count)[shard.index - 1];
  for (const entry of chain) {
    if (entry.isTests) {
      for (const line of slice) commands.push({ tool: 'node', argv: listedTestArguments(line), text: line.trim() });
    } else if (entry.command === 'npm run build' || shard.index === 1) {
      commands.push(toCommand(entry.command));
    }
  }
  return commands;
}

function toCommand(command) {
  const words = command.split(/\s+/);
  if (words[0] === 'npm') return { tool: 'npm', argv: words.slice(1), text: command };
  if (words[0] === 'node') return { tool: 'node', argv: words.slice(1), text: command };
  throw new Error(`Cannot shard a script step that is not an npm or node command: ${command}`);
}

/** `--suite X` of the run-tests command in a script, as the arguments to pass to it with `--list`. */
export function listArguments(script) {
  const tests = parseChain(script).find((entry) => entry.isTests);
  return tests ? tests.command.split(/\s+/).slice(2) : [];
}

export function loadWeights(sibling, file = path.join(root, 'scripts', 'ci-test-weights.json')) {
  return JSON.parse(readFileSync(file, 'utf8'))[sibling] ?? {};
}

/** Read the sibling's package script and test list, and return its shard's commands (used by test-package-ecosystem.mjs). */
export function planSiblingShard({ siblingRoot, sibling, scriptName, shard, weights = loadWeights(sibling) }) {
  const scripts = JSON.parse(readFileSync(path.join(siblingRoot, 'package.json'), 'utf8')).scripts;
  const script = scripts[scriptName];
  if (typeof script !== 'string') throw new Error(`${sibling} has no ${scriptName} script`);
  let listLines = [];
  if (parseChain(script).some((entry) => entry.isTests)) {
    const run = spawnSync(process.execPath, ['scripts/run-tests.mjs', ...listArguments(script), '--list'], { cwd: siblingRoot, encoding: 'utf8' });
    if (run.status !== 0) throw new Error(`${sibling}: run-tests --list failed (${run.status}): ${run.stderr}`);
    listLines = run.stdout.split('\n').filter((line) => line.trim());
    if (!listLines.length) throw new Error(`${sibling}: run-tests --list printed no tests`);
  }
  return shardCommands({ script, scriptName, listLines, weights, shard });
}

function main(argv) {
  const value = (name) => argv[argv.indexOf(name) + 1];
  const sibling = value('--sibling');
  const scriptName = value('--script') ?? 'test';
  const shard = parseShard(value('--shard'));
  const siblingRoot = path.resolve(root, '..', sibling);
  const commands = planSiblingShard({ siblingRoot, sibling, scriptName, shard });
  if (argv.includes('--dry-run')) {
    console.log(commands.map((entry) => entry.text).join('\n'));
    return 0;
  }
  throw new Error('Run shards through scripts/test-package-ecosystem.mjs --test-shard; use --dry-run here to print the commands.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
