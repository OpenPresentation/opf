import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { selectChecks } from './run-checks.mjs';

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
