import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// The sheet tool is run in a loop after `opf convert`; when the convert failed the folder is empty, and the tool must say so and fail.
const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'layout-sampler-sheet.mjs');
const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 60000 });

test('an empty folder is a clear message and a non-zero exit, not a renderer stack trace', (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'opf-sheet-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const result = run(dir, path.join(dir, 'sheet.png'), '3');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^layout-sampler-sheet: no \.png files in /);
  assert.match(result.stderr, /opf convert/);
  assert.doesNotMatch(result.stderr, /invalid size|at .*\(.*:\d+:\d+\)/);
});

test('a missing folder, a missing argument, bad columns and an absent id each fail with a message', (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'opf-sheet-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(path.join(dir, 'slide-1.png'), 'x');
  const missing = run(path.join(dir, 'nope'), path.join(dir, 'sheet.png'));
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /cannot read the folder .*ENOENT/);
  const usage = run(dir);
  assert.equal(usage.status, 2);
  assert.match(usage.stderr, /usage: node scripts\/layout-sampler-sheet\.mjs/);
  const columns = run(dir, path.join(dir, 'sheet.png'), 'x');
  assert.equal(columns.status, 2);
  assert.match(columns.stderr, /columns must be a whole number/);
  const absent = run(dir, path.join(dir, 'sheet.png'), '2', 'slide-9');
  assert.equal(absent.status, 1);
  assert.match(absent.stderr, /slide-9\.png not found/);
});
