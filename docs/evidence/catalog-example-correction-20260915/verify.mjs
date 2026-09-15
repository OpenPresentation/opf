import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

const read = file => readFile(new URL(file, import.meta.url));
const json = async file => JSON.parse(await read(file));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = await json('manifest.json');
for (const [file, expected] of Object.entries(manifest.files)) {
  assert.ok(!file.startsWith('/') && !file.split('/').includes('..'));
  assert.equal(hash(await read(file)), expected, file);
}
const before = await json('before.json'), after = await json('after.json');
assert.deepEqual(before.summary.counts, {error: 41, warning: 4, info: 401});
assert.deepEqual(after.summary, {files: 126, valid: 126, counts: {error: 0, warning: 0, info: 401}});
const preservation = await json('source-preservation.json');
assert.equal(preservation.files.length, 126);
assert.equal(preservation.files.filter(file => file.changed).length, 42);
for (const file of preservation.files) {
  assert.equal(before.reports.find(report => report.file === file.file).sha256, file.beforeSha256);
  assert.equal(after.reports.find(report => report.file === file.file).sha256, file.afterSha256);
  if (!file.changed) assert.equal(file.beforeSha256, file.afterSha256);
}
const changes = await json('changes.json');
assert.equal(changes.files.length, 42);
assert.deepEqual(changes.count, {light1: 14, dark1: 13, light2: 13});
const generatedBefore = await json('generator-before.json'), generatedAfter = await json('generator-after.json');
assert.equal(generatedBefore.valid, false);
assert.equal(generatedBefore.failures.length, 40);
assert.deepEqual(generatedAfter, {valid: true, generated: 100, failures: []});
const sourceHashes = new Set();
for (const kind of ['main-raster', 'furniture-raster']) {
  const baseline = await json(`${kind}/baseline-before.json`);
  const candidate = await json(`${kind}/candidate.json`);
  assert.equal(Object.keys(candidate.entries).length, 805);
  assert.deepEqual(candidate.entries, baseline.entries);
  for (const field of ['version', 'scale', 'format', 'systemFonts']) assert.deepEqual(candidate[field], baseline[field]);
  const diff = await json(`${kind}/diff.json`);
  assert.equal(diff.sourceMatches, false);
  assert.deepEqual(diff.changedSlides, []);
  sourceHashes.add(candidate.source.sha256);
}
assert.equal(sourceHashes.size, 1);
assert.deepEqual(await json('main-raster/baseline-after.json'), await json('main-raster/candidate.json'));
const installed = await json('installed-choices.json');
assert.equal(installed.runtime, 'installed');
assert.equal(installed.examples, 126);
assert.equal(installed.choices.length, 44);
assert.equal(hash(await read('consumer-lock.json')), installed.lockSha256);
for (const choice of installed.choices) {
  assert.notEqual(choice.beforeSource, 'Document catalog');
  assert.equal(choice.afterSource, 'Document catalog');
}
assert.equal((await json('candidate-packages.json')).published, false);
console.log(`Verified ${Object.keys(manifest.files).length} evidence files: 126 clean examples, 100 valid generated decks, 44 installed catalog choices, and unchanged PNG entries in two 805-slide graphs.`);
