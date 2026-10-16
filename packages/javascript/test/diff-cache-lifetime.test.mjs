import assert from 'node:assert/strict';
import {before, after, test} from 'node:test';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {build} = createRequire(require.resolve('tsup'))('esbuild');
let directory, matching;
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'opf-diff-cache-'));
  const file = path.join(directory, 'matching.mjs');
  await build({entryPoints: [fileURLToPath(new URL('../src/diff-match.ts', import.meta.url))], outfile: file, bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'silent'});
  matching = await import(pathToFileURL(file).href);
});
after(async () => { if (directory) await rm(directory, {recursive: true, force: true}); });

test('canonical and similarity read current nested values on reused objects', () => {
  const a = {nested: {text: 'First'}}, b = {nested: {text: 'Different'}};
  assert.equal(matching.similarity(a, b), 0);
  const old = matching.canonical(a);
  a.nested.text = 'Different';
  assert.notEqual(matching.canonical(a), old);
  assert.equal(matching.canonical(a), matching.canonical(structuredClone(a)));
  assert.equal(matching.similarity(a, b), 1);
  a.nested.text = 'Different again';
  assert.equal(matching.similarity(a, b), matching.similarity(structuredClone(a), structuredClone(b)));
});
test('array matching after mutation agrees with fresh equivalent data', () => {
  const a = {text: 'First'}, b = {text: 'Different'};
  assert.deepEqual(matching.matchArrays([a], [b]).pairs, []);
  a.text = 'Different';
  const current = matching.matchArrays([a], [b]);
  assert.deepEqual(current, matching.matchArrays([structuredClone(a)], [structuredClone(b)]));
  assert.deepEqual(current.pairs, [{a: 0, b: 0, by: 'equal'}]);
  assert.deepEqual(a, {text: 'Different'}, 'matching never mutates inputs');
});
test('public diff and merge results depend on current documents rather than earlier matching', async () => {
  const {diff, merge, matchArrays, similarity} = await import('../dist/diff.js');
  const a = {slides: [{title: 'One', text: 'Alpha'}, {title: 'Two', text: 'Beta'}]};
  const b = {slides: [{title: 'Two', text: 'Beta'}, {title: 'One', text: 'Alpha'}]};
  diff(a, b); matchArrays(a.slides, b.slides); similarity(a.slides[0], b.slides[0]);
  a.slides[0].title = 'Two'; a.slides[0].text = 'Beta';
  b.slides[1].title = 'Revised';
  const before = structuredClone({a, b});
  assert.deepEqual(diff(a, b), diff(structuredClone(a), structuredClone(b)));
  const ours = structuredClone(a), theirs = structuredClone(b);
  merge(a, ours, theirs);
  ours.slides[0].text = 'Ours'; theirs.slides[1].text = 'Theirs';
  assert.deepEqual(merge(a, ours, theirs), merge(structuredClone(a), structuredClone(ours), structuredClone(theirs)));
  assert.deepEqual({a, b}, before);
});
