// NEVERMERGE: prepare inputs/identity only. Never invoke PowerShell or Office.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
const [out] = process.argv.slice(2);
if (!out || process.argv.length !== 3) throw Error('Exactly one fresh output directory is required');
const lane = path.dirname(fileURLToPath(import.meta.url));
const own = path.resolve(lane, '../..');
const workerRoot = path.join(lane, 'worker-package');
const suiteRoot = 'C:/opf-work/rr105-readonly-survey';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const git = (repo, ...args) => execFileSync('git', ['--no-optional-locks', '-C', repo, ...args], {encoding: 'utf8'}).trim();
const target = path.resolve(out);
for (const protectedRoot of [own, workerRoot, suiteRoot]) {
  const local = path.resolve(protectedRoot);
  assert(!target.toLowerCase().startsWith(local.toLowerCase() + path.sep) && target.toLowerCase() !== local.toLowerCase(), 'Suite output must be separate from code roots');
}
assert.equal(git(own, 'status', '--porcelain', '--untracked-files=normal'), '', 'Freeze a clean source head before preparing the manifest');
assert.equal(git(suiteRoot, 'rev-parse', 'HEAD'), 'ce92ccc65d8cb40cc6532b2d9082e12202d6c283');
assert.equal(git(suiteRoot, 'status', '--porcelain', '--untracked-files=normal'), '', 'Frozen ce92 source changed');
const {unzipSync, strFromU8} = createRequire(new URL('../../packages/pptx/package.json', import.meta.url))('fflate');
const transport = await fs.readFile(path.join(lane, 'offline-inputs.zip.gz'));
assert.equal(sha(transport), 'a4ee35c59e817f45268b0a35879d26abfbe09992f34862ded82f7a9c36cbf91e');
const packet = unzipSync(gunzipSync(transport));
for (const file of JSON.parse(strFromU8(packet['input-seals.json']))) {
  assert.equal(packet[file.path].length, file.bytes);
  assert.equal(sha(packet[file.path]), file.sha256);
}
const records = async (root, names) => Promise.all(names.map(async name => {
  const bytes = await fs.readFile(path.join(root, name));
  return {path: name, bytes: bytes.length, sha256: sha(bytes)};
}));
const workerNames = ['test/native-furniture-control.ps1', 'test/native-process.ps1', 'test/native-process-check.ps1', 'test/native-furniture-harness-check.ps1'];
const workerRecords = await records(workerRoot, workerNames);
assert.equal(workerRecords[1].sha256, 'b9444de1367fe3a3aab654f4787b5aa9a1304dc38360159a45d1f9f420adf69c');
assert.equal(workerRecords[2].sha256, '50ae41cf771dab0e0c9245f3627abc4586451df8414bdc986df882d3ceda5027');
assert.equal(workerRecords[3].sha256, '06ac3e49dc2b6973d58357b381f9319d9b2d5f2c9176d6fb6d1bf3fd8a3c650d');
const suiteRecords = await records(suiteRoot, ['scripts/native-acceptance/run-windows.ps1']);
await fs.mkdir(target);
const files = [];
async function retain(name, bytes) {
  await fs.mkdir(path.dirname(path.join(target, name)), {recursive: true});
  await fs.writeFile(path.join(target, name), bytes, {flag: 'wx'});
  files.push({path: name, bytes: bytes.length, sha256: sha(bytes)});
}
await retain('sources/source.opf.json', Buffer.from(packet['source.opf.json']));
await retain('previews/sealed-cli-preview.png', Buffer.from(packet['sealed-cli-preview.png']));
await retain('actions/empty.json', Buffer.from('[]\n'));
const cases = [];
for (const id of ['A', 'B', 'C']) {
  const bytes = Buffer.from(packet[id + '.pptx']);
  await retain('inputs/' + id + '.pptx', bytes);
  cases.push({id: 'proofing-inheritance-' + id, worker: 'furniture', automaticControlEligible: true, input: 'inputs/' + id + '.pptx', actionPlan: 'actions/empty.json', archiveSha256: sha(bytes), slideCount: 1, declaredTopLevelShapes: 3, source: 'sources/source.opf.json', preview: 'previews/sealed-cli-preview.png', expectedPrimaryLanguageId: 1025, requiredPhaseNamePairs: 9, knownPriorVisualFailure: id === 'A', nativeAcceptance: false});
}
const manifest = {schemaVersion: 1, cases, files, provenance: {workerRepository: {revision: git(own, 'rev-parse', 'HEAD'), dirty: false, files: workerRecords}, suiteRepository: {revision: git(suiteRoot, 'rev-parse', 'HEAD'), dirty: false, files: suiteRecords}, diagnostic: {neverMerge: true, offlineTransportSha256: sha(transport), nativeAuthorized: false, nativeRun: false, guard: 'Actual LanguageID 1025 on all nine phase/name pairs; matching proofing is not glyph acceptance.'}}};
await fs.writeFile(path.join(target, 'suite.json'), JSON.stringify(manifest, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({suite: target, sourceHead: manifest.provenance.workerRepository.revision, manifestSha256: sha(await fs.readFile(path.join(target, 'suite.json'))), workerRoot, workerSha256: workerRecords[0].sha256, runner: path.join(suiteRoot, 'scripts/native-acceptance/run-windows.ps1'), supportedSelection: 'PptxRepository selects the separate worker-package root; no VerifierPath parameter exists.', nativeAuthorized: false, nativeRun: false}, null, 2));
