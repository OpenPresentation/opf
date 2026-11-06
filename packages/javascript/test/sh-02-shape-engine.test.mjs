// SH-02: the preset geometry loads with core in Node and on demand in a browser bundle (#shape-engine), so a deck without shapes does not
// carry it there.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ensureShapes, shapesPending } from '../dist/composition.js';

test('in Node the preset geometry is loaded with core: nothing is ever pending', async () => {
  const deck = { slides: [{ blocks: [{ shape: 'chevron' }] }] };
  assert.deepEqual(shapesPending(deck), []);
  assert.deepEqual(await ensureShapes(deck), []);
});

test('in a browser bundle the preset geometry loads the first time a deck has a shape, and a deck without shapes never loads it', () => {
  const run = spawnSync(process.execPath, ['--conditions=browser', fileURLToPath(new URL('./shape-browser-engine.mjs', import.meta.url))], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /lazy shape engine: ok/);
});
