import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';

const read = file => readFile(new URL(file, import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async file => JSON.parse(file.endsWith('.gz') ? gunzipSync(await read(file)) : await read(file));
const manifest = await json('manifest.json');
for (const [file, expected] of Object.entries(manifest.files)) {
  assert.ok(!file.startsWith('/') && !file.split('/').includes('..'));
  assert.equal(hash(await read(file)), expected, file);
}
const summary = await json('summary.json');
const baseline = await json('../catalog-example-correction-20260915/furniture-raster/baseline-before.json');
const corrected = await json('../catalog-example-correction-20260915/furniture-raster/candidate.json');
const candidate = await json('golden-candidate.json');
assert.deepEqual(candidate, corrected);
assert.deepEqual(candidate.entries, baseline.entries);
assert.equal(Object.keys(candidate.entries).length, 805);
assert.equal(summary.baseline.before, baseline.source.sha256);
assert.equal(summary.baseline.after, candidate.source.sha256);
assert.equal(summary.baseline.changedRasterEntries, 0);
assert.deepEqual(await json('golden-diff.json'), {sourceMatches: true, changedSlides: []});

const lock = gunzipSync(await read('consumer-lock.json.gz'));
const choices = await json('installed-choices.json');
assert.equal(choices.runtime, 'installed');
assert.equal(choices.examples, 126);
assert.equal(choices.externalFetch, 'disabled');
assert.match(gunzipSync(await read('installed-choices.log.gz')).toString(), /126 bundled examples lint cleanly/);
assert.equal(choices.choices.length, 44);
assert.equal(choices.lockSha256, hash(lock));
const editor = await json('json-installed.json');
assert.equal(editor.runtime, 'installed');
assert.equal(editor.status, 'passed');
assert.equal(editor.checks.length, 7);
assert.deepEqual(editor.errors, []);
assert.deepEqual(editor.externalRequests, []);
const browser = await json('packed-browser.json');
assert.equal(browser.mode, 'packed');
assert.equal(browser.manifest.lockSha256, hash(lock));
assert.equal(browser.results.length, 8);
for (const suite of browser.results) {
  assert.deepEqual(suite.pageErrors, []);
  assert.deepEqual(suite.blockedRequests, []);
  assert.ok(suite.assertions > 0);
  assert.equal(suite.checks.filter(check => check.startsWith('PASS ')).length, suite.assertions);
  assert.ok(suite.checks.every(check => !check.includes('FAIL')));
}
const furniture = await json('furniture-report.json.gz');
assert.equal(furniture.mode, 'installed');
assert.equal(furniture.lockSha256, hash(lock));
assert.equal(furniture.results.length, 16);
assert.deepEqual(furniture.errors, []);
assert.deepEqual(furniture.requests, []);
const masks = furniture.results.flatMap(result => result.paint);
assert.equal(masks.length, 40);
for (const mask of masks) {
  assert.equal(mask.outsideCount, 0, mask.file);
  assert.equal(hash(await read(`../furniture-json-integration-20260915/masks/${mask.file}`)), mask.sha256);
}
assert.equal(furniture.paintControl.outsideCount, 297);
assert.equal(hash(await read(`../furniture-json-integration-20260915/masks/${furniture.paintControl.file}`)), furniture.paintControl.sha256);
assert.equal(summary.views.length, 4);
for (const view of summary.views) {
  assert.equal(view.unchanged, true);
  assert.equal(hash(await read(`../../../${view.prior}`)), view.sha256);
}
assert.equal((await json('candidate-packages.json')).published, false);
assert.equal(summary.published, false);
assert.match(gunzipSync(await read('installed-layout.log.gz')).toString(), /Layout resizing passed/);
assert.equal(hash(await read('installed-layout-regression.mjs')), hash(await read('../furniture-json-integration-20260915/installed-layout-regression.mjs')));
const ci = await json('ci-summary.json');
assert.equal(ci.length, 6);
for (const run of ci) {
  const metadata = await json(`ci/${run.name}.json`);
  assert.equal(metadata.databaseId, run.id);
  assert.equal(metadata.headSha, summary.refs[run.repo].testedWorkflow);
  assert.equal(metadata.status, 'completed');
  assert.equal(metadata.conclusion, 'success');
  assert.ok(metadata.jobs.length > 0);
  for (const job of metadata.jobs) assert.equal(job.conclusion, 'success');
}
console.log(`Verified ${Object.keys(manifest.files).length} evidence files and 6 passing CI runs: 805 unchanged rasters, 126 clean examples, 44 installed choices, 8 browser suites, 7 JSON and 16 furniture workflows, 41 unchanged masks and 4 unchanged views.`);
