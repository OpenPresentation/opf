// Read already produced/independently reviewed archive bytes. No exporter,
// product dist, build, native application or locked-fixture write is used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {makeRr54ArchiveCandidate} from '../../../../packages/pptx/scripts/rr54-archive-candidate.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const option = (name, fallback) => process.argv.find(arg => arg.startsWith(name + '='))?.slice(name.length + 1) ?? fallback;
const auditDirectory = path.resolve(option('--audit', '/tmp/opf-rr54-current-audit-03'));
const independentFile = path.resolve(option('--independent', '/tmp/opf-rr54-independent-review-01.json'));
const out = path.resolve(option('--out', path.join(root, 'docs/handoff/2026-11-10/rr54-current-archives/generated-01')));
assert.ok(!fs.existsSync(out), 'Fresh candidate directory required; no promotion or overwrite');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, {cwd: root, maxBuffer: 32 * 1024 * 1024});
const head = git('rev-parse', 'HEAD').toString().trim();
const fixturePath = 'packages/pptx/test/fixtures/rr-54-unchanged.json';
const fixtureBytes = fs.readFileSync(path.join(root, fixturePath)), fixture = JSON.parse(fixtureBytes);
const auditBytes = fs.readFileSync(path.join(auditDirectory, 'audit.json')), audit = JSON.parse(auditBytes);
const independentBytes = fs.readFileSync(independentFile), independent = JSON.parse(independentBytes);
assert.equal(audit.source, '284de14a45f05502f28941c153eb62e8769224c7');
assert.equal(sha(auditBytes), independent.auditSha256);
assert.equal(sha(fixtureBytes), audit.fixtureSha256); assert.equal(audit.fixtureSha256, independent.fixtureSha256);
assert.deepEqual(fixtureBytes, git('show', audit.source + ':' + fixturePath));
assert.equal(independent.archives, 21); assert.equal(independent.nativePartsByteEqual, 552);
assert.equal(independent.nativeSlideLocks, 3); assert.equal(independent.decodedEvents, 49);
assert.equal(independent.vocabularyOnlyAdditions, 48); assert.equal(independent.typedAuthoredAlignmentChanges, 1);
assert.equal(independent.exportCalls, 0); assert.equal(independent.builds, 0);
const sealedRef = independent.sealedStorageRevision, receiptPin = independent.sealedReceipt;
const receiptBytes = git('show', sealedRef + ':' + receiptPin.path), producer = JSON.parse(receiptBytes);
assert.equal(sha(receiptBytes), receiptPin.sha256);
assert.equal(git('rev-parse', sealedRef + ':' + receiptPin.path).toString().trim(), receiptPin.gitBlob);
assert.equal(producer.baseline, receiptPin.producerBaseline); assert.equal(producer.candidate, receiptPin.producerCandidate); assert.equal(producer.buildHead, receiptPin.producerBuildHead);
const {unzipSync} = createRequire(path.join(root, 'packages/pptx/package.json'))('fflate');
for (const row of audit.reports) {
  const before = fs.readFileSync(path.join(auditDirectory, row.name, 'historical.pptx')), after = fs.readFileSync(path.join(auditDirectory, row.name, 'current.pptx'));
  assert.equal(sha(before), row.baseline); assert.equal(before.length, row.baselineBytes); assert.equal(Object.keys(unzipSync(before)).length, row.baselineParts);
  assert.equal(sha(after), row.candidate); assert.equal(after.length, row.candidateBytes); assert.equal(Object.keys(unzipSync(after)).length, row.candidateParts);
}
const evidencePaths = ['packages/javascript', 'packages/gallery', 'packages/render', 'packages/pptx', 'spec', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'package.json'];
const report = {
  baselineHead: producer.buildHead, baselineExportRef: producer.candidate, candidateHead: audit.source,
  scope: 'SEALED_GIT_ARCHIVE_BASELINES_NOT_OLD_RUNTIME_RERUN: all21 locked hashes/bytes/parts and3 native-slide locks match sealed historical members. Current actual284 bare exports differ only by48 vocabulary2 additions and one closed styled-table alignment. No native raster, release or fixture promotion acceptance.',
  entries: audit.reports.map(({name, inputProjection, baseline, candidate, baselineBytes, candidateBytes, baselineParts, candidateParts, changedParts, candidateNativeSlideSha256}) => ({name, inputProjection, baseline, candidate, baselineBytes, candidateBytes, baselineParts, candidateParts, changedParts, ...(candidateNativeSlideSha256 ? {candidateNativeSlideSha256} : {})})),
};
const sourceEvidence = {
  directory: path.relative(root, out), baselineSourceTrees: git('ls-tree', producer.buildHead, '--', ...evidencePaths).toString().trim(), candidateSourceTrees: git('ls-tree', audit.source, '--', ...evidencePaths).toString().trim(),
  fixtureSha256: sha(fixtureBytes), reviewerSha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))), candidateHelperSha256: sha(fs.readFileSync(path.join(root, 'packages/pptx/scripts/rr54-archive-candidate.mjs'))),
  constructorSource: head, rawAudit: {bytes: auditBytes.length, sha256: sha(auditBytes)}, independentReview: {bytes: independentBytes.length, sha256: sha(independentBytes)},
  baselineOrigin: {mode: 'sealed-git-bytes', storageRevision: sealedRef, receipt: receiptPin, oldRuntimeRerun: false, matchedArchives: independent.rows.map(({name, matchingSealedMembers, baseline}) => ({name, matchingSealedMembers, sha256: baseline}))},
};
const next = makeRr54ArchiveCandidate(fixture, report, sourceEvidence);
assert.deepEqual(fs.readFileSync(path.join(root, fixturePath)), fixtureBytes, 'Locked fixture remains byte immutable');
assert.equal(git('rev-parse', 'HEAD').toString().trim(), head);
fs.mkdirSync(out, {recursive: true});
const reviewBytes = Buffer.from(JSON.stringify(report, null, 2) + '\n'), candidateBytes = Buffer.from(JSON.stringify(next, null, 2) + '\n');
fs.writeFileSync(path.join(out, 'review.json'), reviewBytes, {flag: 'wx'});
fs.writeFileSync(path.join(out, 'candidate-fixture.json'), candidateBytes, {flag: 'wx'});
const receipt = {scope: 'GENERATED_REPOSITORY_HELPER_CANDIDATE_NOT_PROMOTED', constructorSource: head, archiveProducerSource: audit.source, originalFixtureSha256: sha(fixtureBytes), reviewSha256: sha(reviewBytes), candidateSha256: sha(candidateBytes), candidateBytes: candidateBytes.length, entries: 21, projectedDecks: 1, inputProjection: report.entries.find(row => row.name === 'styled-table').inputProjection, sealedProducer: receiptPin, sourceEvidence, exports: 0, builds: 0, promoted: false};
fs.writeFileSync(path.join(out, 'generation-receipt.json'), JSON.stringify(receipt, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({scope: receipt.scope, candidateSha256: receipt.candidateSha256, out}));
