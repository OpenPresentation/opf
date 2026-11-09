import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(readFileSync(new URL('./manifest.json', import.meta.url)));
const receipt = JSON.parse(readFileSync(new URL('./receipt.json', import.meta.url)));
const packed = readFileSync(new URL(manifest.archive, import.meta.url));
assert.equal(packed.length, manifest.bytes);
assert.equal(hash(packed), manifest.sha256);
const files = JSON.parse(gunzipSync(packed, { maxOutputLength: 2 * 1024 * 1024 })).files;
assert.equal(files.length, manifest.files.length);
const lookup = new Map();
let total = 0;
for (const [index, file] of files.entries()) {
  assert.ok(file.file.startsWith('artifacts/reference-final/') && !file.file.split('/').includes('..'));
  const bytes = Buffer.from(file.data, 'base64');
  assert.deepEqual({ file: file.file, bytes: bytes.length, sha256: hash(bytes) }, manifest.files[index]);
  assert.ok(!lookup.has(file.file));
  lookup.set(file.file, bytes);
  total += bytes.length;
}
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
assert.equal(git('rev-parse', receipt.source + '^{tree}'), receipt.sourceTree);
for (const binding of receipt.bindings) assert.equal(git('rev-parse', receipt.source + ':' + binding.file), binding.gitBlob);
assert.equal(receipt.protectedInputsUnchanged, true);
assert.equal(receipt.vendorUnchanged, true);
assert.deepEqual(receipt.runtimeChangedPaths, ['packages/pptx/src/chart-references.js', 'packages/pptx/src/index.js']);
const finalLog = lookup.get(receipt.focused.log);
assert.equal(hash(finalLog), receipt.focused.logSha256);
assert.match(finalLog.toString('utf8'), /pass 53/);
assert.match(finalLog.toString('utf8'), /fail 0/);
for (const path of [receipt.baseline.metadataFinalGenuineFailure, receipt.baseline.seriesCountGenuineFailure]) {
  const log = lookup.get(path).toString('utf8');
  assert.match(log, /PREALLOCATION_READ/);
  assert.doesNotMatch(log, /ERR_MODULE_NOT_FOUND/);
}
const fixture = JSON.parse(lookup.get('artifacts/reference-final/metadata-fixture-final.json'));
assert.equal(fixture.limit, 4194304);
assert.deepEqual(fixture.counts.map((entry) => entry.overLimit), [false, false, true]);
assert.equal(fixture.counts[2].encodedHexBytes, 4219666);
const original = execFileSync('git', ['show', '01a36fb0bdc59753d9d0b9f938dca078f1c933df:packages/pptx/src/chart-references.js'], { encoding: 'utf8' });
const adapted = lookup.get('artifacts/reference-final/baseline-original-module.mjs').toString('utf8');
const withoutImports = (source) => source.replace(/^import .*;\r?\n/gm, '');
assert.equal(withoutImports(adapted), withoutImports(original));
assert.equal(receipt.nativeAcceptance, false);
console.log(JSON.stringify({ status: 'PASS', records: files.length, bytes: total, source: receipt.source, focusedPass: 53, genuineOriginalMetadataRefusalMissing: true, originalSetupErrorsPreserved: true, protectedInputsUnchanged: true, nativeAcceptance: false }));
