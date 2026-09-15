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
for (const file of ['json-source.json', 'json-installed.json']) {
  const result = await json(file);
  assert.equal(result.status, 'passed');
  assert.equal(result.checks.length, 7);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.externalRequests, []);
}
assert.equal((await json('json-installed.json')).runtime, 'installed');
const browser = await json('packed-browser.json');
assert.equal(browser.mode, 'packed');
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
assert.equal(furniture.results.length, 16);
assert.deepEqual(furniture.errors, []);
assert.deepEqual(furniture.requests, []);
const masks = furniture.results.flatMap(result => result.paint);
assert.equal(masks.length, 40);
for (const mask of masks) {
  assert.equal(mask.outsideCount, 0, mask.file);
  assert.equal(hash(await read(`masks/${mask.file}`)), mask.sha256);
}
assert.ok(furniture.paintControl.outsideCount > 0);
assert.equal(hash(await read(`masks/${furniture.paintControl.file}`)), furniture.paintControl.sha256);
assert.equal(hash(await read('consumer-lock.json.gz').then(gunzipSync)), furniture.lockSha256);
assert.equal((await json('candidate-packages.json')).published, false);
const fixture = await json('installed-layout-fixture.json');
assert.equal(hash(await read('installed-layout-regression.mjs')), fixture.adaptedSha256);
assert.match(gunzipSync(await read('installed-layout.log.gz')).toString(), /Layout resizing passed/);
const summary = await json('summary.json');
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
assert.equal(summary.views.length, 4);
for (const view of summary.views) {
  assert.equal(view.unchanged, true);
  assert.equal(hash(await read(view.file)), view.sha256);
  assert.equal(hash(await read(`../../../${view.prior}`)), view.sha256);
}
console.log(`Verified ${Object.keys(manifest.files).length} evidence files, 6 passing CI runs, 8 installed suites, 7 JSON workflows, 16 furniture workflows, 40 field masks and 4 unchanged views.`);
