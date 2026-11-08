// Read-only transport/source verification. No PowerShell, worker entrypoint or Office.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
const directory = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(directory, '../../..');
const sourceHead = 'b8461d48b193e32dee4e6e1bb60896823f2303ff';
const packetHash = 'fcf022d2cd7047b19cb016a338765fc9af252d297723a4ec83c47fdb9e4d5ba2';
const workerHash = '26ea8b008cdacebc937decbfe52356ace0a146af0d5ade54e20de6397596415c';
const {unzipSync} = createRequire(path.join(repository, 'packages/pptx/package.json'))('fflate');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const json = bytes => JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes).replace(/^\uFEFF/, ''));
const seals = json(await fs.readFile(path.join(directory, 'transport-seals.json')));
assert.equal(seals.sourceHead, sourceHead); assert.equal(seals.packetSha256, packetHash);
assert.equal(seals.nativeRun, false); assert.equal(seals.actualNewNativeObservations, 0);
assert.equal(seals.files.length, 7); assert.equal(new Set(seals.files.map(row => row.path)).size, 7);
const originals = {};
for (const row of seals.files) {
  assert.match(row.path, /^[a-z0-9.-]+$/); assert(!row.path.includes('..'));
  const bytes = await fs.readFile(path.join(directory, row.path));
  assert.equal(bytes.length, row.bytes); assert.equal(sha(bytes), row.sha256);
  assert(['identity', 'gzip'].includes(row.encoding));
  const original = row.encoding === 'gzip' ? gunzipSync(bytes) : bytes;
  assert.equal(original.length, row.originalBytes); assert.equal(sha(original), row.originalSha256);
  assert(!Object.hasOwn(originals, row.originalName)); originals[row.originalName] = original;
}
assert.equal(sha(originals['packet.zip.gz']), packetHash);
assert.equal(sha(gunzipSync(originals['verifier.mjs.gz'])), 'eb69cfe332ea050813f3b73c8f8882cfb56a840a8703d6c68c7d4c69a8955f38');
const receipt = json(originals['receipt.json']), earlier = json(originals['verification.json']);
assert.equal(receipt.sourceHead, sourceHead); assert.equal(receipt.packetSha256, packetHash);
assert.equal(earlier.passed, true); assert.equal(earlier.nativeRun, false);
const entries = unzipSync(gunzipSync(originals['packet.zip.gz']));
const innerSeals = json(entries['entry-seals.json']);
assert.equal(innerSeals.length, 839); assert.equal(Object.keys(entries).length, 840);
assert.equal(new Set(innerSeals.map(row => row.path)).size, 839);
for (const row of innerSeals) { assert.equal(entries[row.path].length, row.bytes); assert.equal(sha(entries[row.path]), row.sha256); }
const review = json(entries['review.json']);
assert.equal(review.sourceHead, sourceHead); assert.equal(review.workerSha256, workerHash);
assert.equal(review.nativeRun, false); assert.equal(review.nativeAuthorized, false); assert.equal(review.actualNativeLanguageObservations, 0);
assert.equal(review.sourceFiles.length, 16);
for (const file of review.sourceFiles) {
  const bytes = execFileSync('git', ['--no-optional-locks', '-C', repository, 'show', sourceHead + ':' + file], {windowsHide: true, maxBuffer: 16 * 1024 * 1024});
  assert.deepEqual(Buffer.from(entries['source/' + file]), bytes, 'Exact frozen Git source blob ' + file);
}
const prefix = 'source/tools/rr105-proofing-readonly/';
assert.equal(sha(entries[prefix + 'worker-package/test/native-furniture-control.ps1']), workerHash);
assert.equal(sha(entries[prefix + 'offline-inputs.zip.gz']), 'a4ee35c59e817f45268b0a35879d26abfbe09992f34862ded82f7a9c36cbf91e');
assert.equal(sha(entries[prefix + 'worker-package/test/fixtures/sh25-native-circle-observations.json']), 'e8e452a52977f6a76925cfb31c92f8d1340448dd59566193468e616a98322af0');
assert.equal(sha(entries['suite/suite.json']), '50dc947be9220127c2a18f6b3e47d47479a275bf3563144b00b27c38fa18e097');
const suite = json(entries['suite/suite.json']); assert.equal(suite.provenance.workerRepository.revision, sourceHead);
for (const id of ['A', 'B', 'C']) {
  const actual = json(entries['runner-validate-only/' + id + '/runner.json']);
  assert.equal(actual.status, 'pure-checks-completed; native-not-run'); assert.equal(actual.nativeAcceptance, false); assert.equal(actual.captureTextFonts, true);
  const selected = suite.cases.find(row => row.id === 'proofing-inheritance-' + id);
  assert.equal(selected.expectedPrimaryLanguageId, 1025); assert.equal(selected.requiredPhaseNamePairs, 9); assert.equal(selected.knownPriorVisualFailure, id === 'A');
  assert.equal(sha(entries['suite/' + selected.input]), selected.archiveSha256);
}
assert.equal(json(entries['history/first-A-validate-only-failure/runner.json']).status, 'failed; no-retry');
const mocks = Object.entries(entries).filter(([name]) => name.endsWith('/source-and-mocks.json')).map(([, bytes]) => json(bytes)).filter(result => result.source.workerSha256 === workerHash);
assert.equal(mocks.length, 5);
for (const result of mocks) {
  assert.equal(result.passed, true); assert.equal(result.officeConstructed, false); assert.equal(result.actualOfficeAcceptance, false); assert.equal(result.protectedFunctions.length, 39);
  const positive = result.cases.find(row => row.name === 'all-nine-phase-name-primary-language-getters-exact');
  assert.equal(positive.evidence.getters, 9); assert.equal(positive.evidence.observations.length, 9); assert(positive.evidence.observations.every(row => row.observedLanguageId === 1025));
}
const checkDirectory = path.join(directory, 'publication-checks'), checkSeals = json(await fs.readFile(path.join(checkDirectory, 'seals.json')));
assert.equal(checkSeals.sourceHead, sourceHead); assert.equal(checkSeals.nativeRun, false); assert.equal(checkSeals.files.length, 9);
for (const row of checkSeals.files) {
  assert.match(row.path, /^[a-z0-9.-]+$/); assert(!row.path.includes('..'));
  const bytes = await fs.readFile(path.join(checkDirectory, row.path)); assert.equal(bytes.length, row.bytes); assert.equal(sha(bytes), row.sha256);
  const raw = row.encoding === 'gzip' ? gunzipSync(bytes) : bytes; assert.equal(raw.length, row.originalBytes); assert.equal(sha(raw), row.originalSha256);
}
const publishedGate = json(gunzipSync(await fs.readFile(path.join(checkDirectory, 'execution-01.json.gz'))));
assert.equal(publishedGate.exitCode, 0); assert.equal(publishedGate.node, 'v24.20.0'); assert.equal(publishedGate.nativeRun, false);
console.log(JSON.stringify({passed: true, sourceHead, packetSha256: packetHash, transportFiles: 7, sealedFiles: 839, sourceBlobs: 16, currentSourceMockRuns: 5, pureRunnerCases: 3, publicationCheckTransports: 9, actualNewNativeObservations: 0, nativeRun: false, invokesOffice: false}, null, 2));
