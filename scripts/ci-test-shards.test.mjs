// RR-57: a sibling's test script, split into parallel shards, runs exactly the commands of the whole script.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { DEFAULT_WEIGHT, SHARD_ONE_OVERHEAD, SHARDED_PACKAGES, listArguments, listedTestArguments, parseChain, parseShard, partitionTests, planPackageShard, shardCommands } from './ci-test-shards.mjs';

const SCRIPT = 'npm run build && npm run check:fonts && node scripts/run-tests.mjs && npm run build:browser-check && npm run check:runners && npm run check:changes';
const CONTRACT = 'npm run build && node scripts/run-tests.mjs --suite contract && npm run build:browser-check';
const lines = ['accepted-text.mjs', 'annotations.mjs', 'determinism.mjs', 'zeta.mjs', 'alpha.mjs', 'beta.mjs', 'gamma.mjs'].map((file, index) => (index === 3 ? `node --test test/${file}` : `node test/${file}`));
const weights = { 'determinism.mjs': 200, 'accepted-text.mjs': 60, 'annotations.mjs': 50, 'zeta.mjs': 40, 'alpha.mjs': 30, 'beta.mjs': 20 }; // gamma.mjs has no weight

test('parseShard reads index/count and refuses anything else', () => {
  assert.deepEqual(parseShard('2/3'), { index: 2, count: 3 });
  assert.deepEqual(parseShard('1/1'), { index: 1, count: 1 });
  for (const bad of [undefined, '', '2', '0/3', '4/3', '2/0', '1/17', 'a/b', '1/2/3', '-1/3']) assert.throws(() => parseShard(bad), /shard|range/i, String(bad));
});

test('parseChain splits an && chain and finds the one run-tests command', () => {
  assert.deepEqual(parseChain(SCRIPT).map((entry) => entry.command), ['npm run build', 'npm run check:fonts', 'node scripts/run-tests.mjs', 'npm run build:browser-check', 'npm run check:runners', 'npm run check:changes']);
  assert.deepEqual(parseChain(SCRIPT).filter((entry) => entry.isTests).map((entry) => entry.command), ['node scripts/run-tests.mjs']);
  assert.equal(parseChain(CONTRACT).filter((entry) => entry.isTests).length, 1);
  assert.deepEqual(listArguments(CONTRACT), ['--suite', 'contract']);
  assert.deepEqual(listArguments(SCRIPT), []);
  assert.deepEqual(listedTestArguments('node --test test/a.mjs'), ['--test', 'test/a.mjs']);
  assert.throws(() => listedTestArguments('echo hi'), /Unreadable/);
});

test('partitionTests gives every test to exactly one slice, keeps list order, and balances by weight', () => {
  for (const count of [1, 2, 3, 5]) {
    const slices = partitionTests(lines, weights, count);
    assert.equal(slices.length, count);
    assert.deepEqual([...slices.flat()].sort(), [...lines].sort());
    for (const slice of slices) assert.deepEqual(slice, lines.filter((line) => slice.includes(line)), 'a slice keeps the list order');
    assert.deepEqual(partitionTests(lines, weights, count), slices, 'the same input gives the same slices in every job');
  }
  const [one, two] = partitionTests(lines, weights, 2);
  assert.ok(one.includes('node test/determinism.mjs') || two.includes('node test/determinism.mjs'));
  const load = (slice, extra) => slice.reduce((sum, line) => sum + (weights[line.split('/').pop()] ?? DEFAULT_WEIGHT), extra);
  assert.ok(Math.abs(load(one, SHARD_ONE_OVERHEAD) - load(two, 0)) <= 60, 'the two slices are close');
});

test('the shards of a script run exactly its commands: builds everywhere, checks once, every test once, in chain order', () => {
  for (const [script, count] of [[SCRIPT, 3], [SCRIPT, 1], [CONTRACT, 2]]) {
    const shards = Array.from({ length: count }, (_, index) => shardCommands({ script, scriptName: 'test', listLines: lines, weights, shard: { index: index + 1, count } }));
    const texts = shards.map((commands) => commands.map((entry) => entry.text));
    // Every test exactly once across the shards.
    assert.deepEqual(texts.flat().filter((text) => /test\/[\w-]+\.mjs$/.test(text)).sort(), lines.map((line) => line).sort());
    // `npm run build` in every shard, first; every other chain command exactly once, in shard 1, in chain order around the tests.
    for (const commands of texts) assert.equal(commands[0], 'npm run build');
    const others = parseChain(script).map((entry) => entry.command).filter((command) => command !== 'npm run build' && !command.startsWith('node scripts/run-tests'));
    assert.deepEqual(texts.flat().filter((text) => others.includes(text)), others);
    const first = texts[0];
    const testsAt = first.findIndex((text) => /^node (--test )?test\//.test(text));
    const before = parseChain(script).findIndex((entry) => entry.isTests);
    assert.equal(testsAt >= 0 ? testsAt : first.length, before, 'the checks before the tests stay before them');
    for (const commands of texts.slice(1)) assert.ok(commands.every((text) => text === 'npm run build' || /^node (--test )?test\//.test(text)));
  }
});

test('--test tests keep their flag and run through node', () => {
  const [commands] = [shardCommands({ script: SCRIPT, scriptName: 'test', listLines: lines, weights, shard: { index: 1, count: 1 } })];
  const zeta = commands.find((entry) => entry.text === 'node --test test/zeta.mjs');
  assert.deepEqual([zeta.tool, zeta.argv], ['node', ['--test', 'test/zeta.mjs']]);
  const build = commands.find((entry) => entry.text === 'npm run build');
  assert.deepEqual([build.tool, build.argv], ['npm', ['run', 'build']]);
});

test('a script that cannot be split is never dropped: shard 1 runs it whole and the others nothing', () => {
  for (const script of ['npm run build && node test/a.mjs', 'node scripts/run-tests.mjs && node scripts/run-tests.mjs --suite contract']) {
    const run = (index) => shardCommands({ script, scriptName: 'test', listLines: [], weights, shard: { index, count: 3 } });
    assert.deepEqual(run(1).map((entry) => entry.text), ['npm run test']);
    assert.deepEqual(run(2), []);
    assert.deepEqual(run(3), []);
  }
  assert.throws(() => shardCommands({ script: 'npm run build && ./run.sh && node scripts/run-tests.mjs', scriptName: 'test', listLines: lines, weights, shard: { index: 1, count: 1 } }), /not an npm, pnpm or node command/);
});

test('the committed weights cover the three siblings with positive seconds, and balance three shards of each', () => {
  const all = JSON.parse(readFileSync(new URL('./ci-test-weights.json', import.meta.url), 'utf8'));
  for (const sibling of ['opf-render', 'opf-editor', 'opf-pptx']) {
    const table = all[sibling];
    assert.ok(Object.keys(table).length > 50, sibling);
    for (const [file, seconds] of Object.entries(table)) assert.ok(file.endsWith('.mjs') && seconds > 0, `${sibling}/${file}`);
  }
  for (const sibling of ['opf-render', 'opf-pptx']) {
    const names = Object.keys(all[sibling]).map((file) => `node test/${file}`);
    const loads = partitionTests(names, all[sibling], 3).map((slice, index) => slice.reduce((sum, line) => sum + all[sibling][line.split('/').pop()], index === 0 ? SHARD_ONE_OVERHEAD : 0));
    assert.ok(Math.max(...loads) - Math.min(...loads) < 20, `${sibling} shards are within 20 s: ${loads}`);
    assert.ok(Math.max(...loads) < 340, `${sibling} shards stay near five minutes: ${loads}`);
  }
});

test('pnpm run steps shard like npm run steps (the converted package scripts of MR-23)', () => {
  const script = 'pnpm run build && node scripts/run-tests.mjs && pnpm run build:browser-check && pnpm run check:changes';
  const shards = [1, 2].map((index) => shardCommands({ script, scriptName: 'test', listLines: lines, weights, shard: { index, count: 2 } }).map((entry) => entry.text));
  assert.deepEqual(shards[0].filter((text) => text.startsWith('pnpm')), ['pnpm run build', 'pnpm run build:browser-check', 'pnpm run check:changes']);
  assert.deepEqual(shards[1].filter((text) => text.startsWith('pnpm')), ['pnpm run build']);
  assert.equal(shardCommands({ script, scriptName: 'test', listLines: lines, weights, shard: { index: 1, count: 1 } }).find((entry) => entry.text === 'pnpm run build').tool, 'pnpm');
});

test('--package plans a shard of a workspace package: every listed test once across the shards, in the package directory', () => {
  assert.deepEqual(Object.keys(SHARDED_PACKAGES).sort(), ['editor', 'pptx', 'render']);
  assert.throws(() => planPackageShard({ id: 'core', scriptName: 'test', shard: { index: 1, count: 2 } }), /--package must be one of/);
  for (const id of Object.keys(SHARDED_PACKAGES)) {
    const { packageRoot, commands: first } = planPackageShard({ id, scriptName: 'test', shard: { index: 1, count: 3 } });
    assert.ok(packageRoot.endsWith(`packages/${id}`));
    const tests = [1, 2, 3].flatMap((index) => planPackageShard({ id, scriptName: 'test', shard: { index, count: 3 } }).commands.filter((entry) => /test\/[\w.-]+\.mjs$/.test(entry.text)).map((entry) => entry.text));
    assert.equal(new Set(tests).size, tests.length, `${id}: no test runs twice`);
    assert.ok(tests.length > 20, `${id}: the shards list the package's tests`);
    assert.ok(first.length > 0);
  }
});

test('the command line prints a shard with --package --dry-run and refuses an unknown package', () => {
  const script = new URL('./ci-test-shards.mjs', import.meta.url).pathname;
  const dry = spawnSync(process.execPath, [script, '--package', 'editor', '--script', 'test:contract', '--shard', '1/2', '--dry-run'], { encoding: 'utf8' });
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /^\+ .*run build/mu);
  assert.match(dry.stdout, /^\+ node (--test )?test\//mu);
  const bad = spawnSync(process.execPath, [script, '--package', 'cli', '--shard', '1/2', '--dry-run'], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /--package must be one of/);
});
