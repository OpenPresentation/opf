import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkJobs, runPool, selectChecks } from './run-checks.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('selectChecks runs every check: script in name order, minus the excluded ones, plus the included scripts', () => {
  const scripts = { test: 'x', 'check:b': 'x', 'check:a': 'x', 'check:own-step': 'x', 'test:extra': 'x', 'test:other': 'x' };
  assert.deepEqual(selectChecks(scripts, { exclude: ['check:own-step'], include: ['test:extra'] }), ['check:a', 'check:b', 'test:extra']);
});

test('selectChecks fails on a stale or contradictory scripts/checks.json', () => {
  const scripts = { 'check:a': 'x', 'test:b': 'x' };
  assert.throws(() => selectChecks(scripts, { exclude: ['check:gone'] }), /not a root script/);
  assert.throws(() => selectChecks(scripts, { include: ['check:a'] }), /run without being listed/);
  assert.throws(() => selectChecks(scripts, { exclude: ['test:b'] }), /not a check: script/);
  assert.throws(() => selectChecks(scripts, { include: ['test:b', 'test:b'] }), /twice/);
});

test('the repository scripts/checks.json agrees with package.json', () => {
  const scripts = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).scripts;
  const config = JSON.parse(readFileSync(path.join(root, 'scripts', 'checks.json'), 'utf8'));
  const names = selectChecks(scripts, config);
  assert.ok(names.includes('check:changes'));
  assert.ok(names.includes('check:gallery-tracker'));
  assert.equal(names.includes('check:breaking'), false);
});

// RR-45 (opf#368, item 5): the checks run on a bounded pool, every one runs, and the results keep name order.
test('checkJobs defaults to min(4, cores) and validates OPF_CHECKS_JOBS', () => {
  assert.equal(checkJobs({}, 2), 2);
  assert.equal(checkJobs({}, 16), 4);
  assert.equal(checkJobs({ OPF_CHECKS_JOBS: '1' }, 16), 1);
  assert.equal(checkJobs({ OPF_CHECKS_JOBS: '6' }, 2), 6);
  for (const bad of ['0', '-1', '1.5', 'many']) assert.throws(() => checkJobs({ OPF_CHECKS_JOBS: bad }, 4), /positive integer/);
});

test('runPool never runs more than `jobs` at once, runs every check after a failure and keeps name order', async () => {
  let running = 0, peak = 0;
  const started = [];
  const delays = { a: 30, b: 5, c: 20, d: 1, e: 10 };
  const results = await runPool(Object.keys(delays), 2, async (name) => {
    started.push(name);
    running += 1; peak = Math.max(peak, running);
    await new Promise((resolve) => setTimeout(resolve, delays[name]));
    running -= 1;
    return { status: name === 'b' ? 3 : 0, log: `${name}.log` };
  });
  assert.equal(peak, 2);
  assert.deepEqual(started, ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(results.map((result) => [result.name, result.status]), [['a', 0], ['b', 3], ['c', 0], ['d', 0], ['e', 0]]);
  assert.deepEqual(await runPool([], 4, () => { throw new Error('never'); }), []);
});
