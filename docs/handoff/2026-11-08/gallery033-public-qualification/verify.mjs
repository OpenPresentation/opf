// Read-only transport integrity check; recorded rollout evidence is not a fresh network probe.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
const directory = path.dirname(fileURLToPath(import.meta.url));
const records = JSON.parse(readFileSync(path.join(directory, 'files.json'), 'utf8'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
for (const record of records) {
  assert.match(record.path, /^[a-z0-9.-]+$/);
  assert.ok(!record.path.includes('..'));
  const stored = readFileSync(path.join(directory, record.path));
  assert.equal(stored.length, record.stored.bytes);
  assert.equal(digest(stored), record.stored.sha256);
  if (record.raw) {
    const raw = gunzipSync(stored);
    assert.equal(raw.length, record.raw.bytes);
    assert.equal(digest(raw), record.raw.sha256);
  }
}
const qualification = JSON.parse(readFileSync(path.join(directory, 'qualification.json'), 'utf8'));
const receipt = JSON.parse(gunzipSync(readFileSync(path.join(directory, 'production-receipt.json.gz'))));
assert.equal(receipt.sourceHead, qualification.sourceHead);
assert.equal(receipt.sourceTree, qualification.sourceTree);
assert.equal(receipt.cfDeploymentId, qualification.productionDeployment);
assert.equal(receipt.cfVersionId, qualification.productionVersion);
assert.equal(receipt.productionUrl, qualification.site);
assert.equal(qualification.sourceHead, '5fbd9a7988b4c2c06fa6dc15874709d2d62c2dd5');
assert.equal(qualification.version, '0.33.0');
assert.equal(qualification.requiredGate.exitCode, 0);
assert.equal(qualification.rootPublicBrowser.passed, 3);
assert.equal(qualification.rootPublicEditor.exactFileHashes, 45);
console.log(JSON.stringify({ verified: true, records: records.length, sourceHead: receipt.sourceHead, networkProbe: false }));
