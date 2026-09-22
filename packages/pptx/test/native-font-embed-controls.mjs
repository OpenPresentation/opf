import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {copyFile, mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {strToU8, zipSync} from 'fflate';
import {
  auditCanonicalFixtureManifest,
  auditEmbedVerifierSource,
  auditEvidenceDirectory,
  auditSavedEmbedPresentation,
  hasOfficeQuitInvocation,
  inspectFontEmbeddingPackage,
  PERMITTED_CARLITO_FIXTURE,
  PERMITTED_CARLITO_FIXTURE_FILES,
  PERMITTED_CARLITO_LICENSE_SHA256,
  PERMITTED_NATIVE_FONT_NAMES,
} from './native-font-embed-audit.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const root = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(root, '..');
const embedVerifier = path.join(root, 'native-font-embed.ps1');
const auditCli = path.join(root, 'native-font-embed-audit.mjs');
const editVerifier = path.join(root, 'native-font-edit.ps1');
const node = process.execPath;
const spawnOptions = {cwd: packageRoot, encoding: 'utf8', maxBuffer: 1024 * 1024, timeout: 15_000, windowsHide: true};
assert.equal(process.versions.node.split('.')[0], '24', 'Native font embed controls require Node 24.');
const outcomes = [];
const record = name => outcomes.push({name, passed: true});

const embedSource = await readFile(embedVerifier, 'utf8');
assert.deepEqual(auditEmbedVerifierSource(embedSource), []);
record('embed-verifier-requests-gated-embed');

const editSource = await readFile(editVerifier, 'utf8');
assert.match(editSource, /SaveAs\(\$savedPath,\s*24\s*,\s*0\s*\)/, 'Gate E native-font-edit must keep EmbedFonts 0.');
assert.doesNotMatch(editSource, /SaveAs\(\$savedPath,\s*24\s*,\s*-1\s*\)/, 'Gate E must not request font embedding.');
assert.match(editSource, /tolerancePoints=0\.02/, 'Gate E native-font-edit must keep the 0.02pt geometry gate.');
record('gate-e-remains-no-embed');

const ps = path.join(process.env.WINDIR ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
if (process.platform === 'win32') {
  const child = spawnSync(ps, ['-NoProfile', '-NonInteractive', '-File', embedVerifier, '-PureRegression'], spawnOptions);
  assert.equal(child.status, 0, child.stderr || child.stdout);
  const pure = JSON.parse(child.stdout.replace(/^\uFEFF/, ''));
  assert.equal(pure.officeOrComCalls, 0);
  assert.equal(pure.canonicalHashRejected, true); assert.equal(pure.wrongLicenseRejected, true);
  assert.equal(pure.carlitoAptosGateRejected, true); assert.equal(pure.stopLatchPassed, true);
  record('embed-pure-regression');
} else outcomes.push({name: 'embed-pure-regression', passed: true, skipped: 'non-Windows runner'});

assert.ok(auditEmbedVerifierSource('$script:presentation.SaveAs($savedPath,24,0)', {label: 'negative'}).some(item => item.code === 'embed-forced-off'));
assert.equal(auditEmbedVerifierSource("throw 'Embed harness must not call Application.Quit'").filter(item => item.code === 'application-quit').length, 0);
assert.ok(hasOfficeQuitInvocation('$app.Quit()'));
record('source-policy-negatives');

const generation = {
  kind: 'native-font-edit-fixture', source: {file: 'source.pptx', sha256: '0'.repeat(64)}, registration: {flags: 0},
  license: {file: 'LICENSE_FONT', spdx: 'OFL-1.1', sha256: PERMITTED_CARLITO_LICENSE_SHA256},
  fonts: PERMITTED_CARLITO_FIXTURE_FILES.map(file => ({file, sha256: PERMITTED_CARLITO_FIXTURE[file]})),
};
assert.deepEqual(auditCanonicalFixtureManifest(generation), []);
const wrongGeneration = structuredClone(generation); wrongGeneration.fonts[0].sha256 = 'f'.repeat(64);
assert.ok(auditCanonicalFixtureManifest(wrongGeneration).some(item => item.code === 'generation-font-hash'));
const stringFlags = structuredClone(generation); stringFlags.registration.flags = '0';
assert.ok(auditCanonicalFixtureManifest(stringFlags).some(item => item.code === 'generation-registration-flags'));
record('canonical-manifest-negatives');

const relXml = ({extra = '', target = null, duplicateId = false, external = false} = {}) => `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${[1, 2, 3, 4].map(index => `<Relationship Id="rId${duplicateId && index === 2 ? 1 : index}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="${target && index === 1 ? target : `fonts/font${index}.fntdata`}"${external && index === 1 ? ' TargetMode="External"' : ''}/>`).join('')}${extra}
</Relationships>`;
const presentationXml = ({family = 'Carlito', missingStyle = null} = {}) => `<?xml version="1.0" encoding="UTF-8"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:embeddedFontLst><p:embeddedFont><p:font typeface="${family}"/>${[
  ['p:regular', 1], ['p:bold', 2], ['p:italic', 3], ['p:boldItalic', 4],
].filter(([style]) => style !== missingStyle).map(([style, id]) => `<${style} r:id="rId${id}"/>`).join('')}</p:embeddedFont></p:embeddedFontLst></p:presentation>`;
const contentTypesXml = ({duplicate = false} = {}) => `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="fntdata" ContentType="application/x-fontdata"/>${duplicate ? '<Override PartName="/ppt/fonts/font1.fntdata" ContentType="application/x-fontdata"/><Override PartName="/ppt/fonts/font1.fntdata" ContentType="application/x-fontdata"/>' : ''}</Types>`;

function makeOpc({rels = relXml(), presentation = presentationXml(), contentTypes = contentTypesXml(), extraParts = {}} = {}) {
  const entries = {
    '[Content_Types].xml': strToU8(contentTypes),
    'ppt/presentation.xml': strToU8(presentation),
    'ppt/_rels/presentation.xml.rels': strToU8(rels),
    ...Object.fromEntries([1, 2, 3, 4].map(index => [`ppt/fonts/font${index}.fntdata`, new Uint8Array([index, 42, 99])])),
    ...extraParts,
  };
  return Buffer.from(zipSync(entries, {level: 0}));
}

const positivePptx = makeOpc();
assert.deepEqual(inspectFontEmbeddingPackage(positivePptx).failures, []);
record('font-opc-positive-structure');

function makeLifecycle(pptxBytes, sourcePath, savedPath, sourceHash = '0'.repeat(64)) {
  const stages = []; const base = Date.parse('2026-09-22T12:00:00.000Z');
  const add = (stage, status, ownedPresentationPath, cleanupConfirmed) => stages.push({sequence: stages.length + 1, timestamp: new Date(base + stages.length * 1000).toISOString(), stage, status, error: null, cleanupConfirmed, officeOperationsStopped: false, ownedPresentationPath});
  const pair = (stage, ownedPresentationPath, cleanupConfirmed = false) => { add(stage, 'begin', ownedPresentationPath, cleanupConfirmed); add(stage, 'success', ownedPresentationPath, cleanupConfirmed); };
  add('worker.initialize', 'success', null, true);
  pair('input.presentation.open', sourcePath);
  pair('edited.presentation.fonts.get', sourcePath); pair('edited.presentation.fonts.count.get', sourcePath);
  for (const suffix of ['get', 'name.get', 'embedded.get', 'embeddable.get']) pair(`edited.presentation.fonts.item-1.${suffix}`, sourcePath);
  add('edited.presentation.native-fonts-gate', 'success', sourcePath, false);
  pair('edited.presentation.saveAs-owned-copy-embed-fonts', sourcePath);
  pair('edited.presentation.fullName.get', savedPath);
  pair('edited.presentation.close', savedPath);
  add('edited.presentation.cleanup', 'success', null, true);
  add('worker.complete', 'success', null, true);
  const entries = [{index: 1, name: 'Carlito', embedded: 0, embeddable: -1}];
  const gate = {passed: true, reportedCount: 1, entryCount: 1, countValid: true, baseFamilyPresent: true, allowedReportedNames: [...PERMITTED_NATIVE_FONT_NAMES], unexpectedNames: [], unembeddableNames: [], entries};
  const report = {
    kind: 'native-font-embed', error: null, cleanupConfirmed: true, officeOperationsStopped: false, ownedCloseCount: 1, lastStage: 'worker.complete', lastStatus: 'success',
    source: {path: sourcePath, sha256: sourceHash, snapshotPath: sourcePath, snapshotSha256: sourceHash}, saved: {path: savedPath, sha256: sha(pptxBytes)},
    embedFonts: {saveFormat: 24, saveArgument: -1, stage: 'edited.presentation.saveAs-owned-copy-embed-fonts', attempted: true, completed: true, blockedByNativeFontsGate: false},
    nativeFontsObservation: {count: 1, entries}, nativeFontsGate: gate,
  };
  const final = stages.at(-1);
  const supervisor = {timestamp: new Date(Date.parse(final.timestamp) + 1000).toISOString(), timedOut: false, exitCode: 0, officeLifecycleComplete: true, nativeFontsGatePassed: true, embedSaveRecorded: true, fontCleanupConfirmed: true, inputsUnchanged: true, ownedCloseCount: 1, lastDurableStage: 'worker.complete', lastDurableStatus: 'success', parentError: null};
  const worker = {timedOut: false, exitCode: 0, timeoutSeconds: 45, processId: 4242, startedAt: '2026-09-22T11:59:59.000Z', finishedAt: supervisor.timestamp};
  const registrations = PERMITTED_CARLITO_FIXTURE_FILES.map(file => ({file, sha256: PERMITTED_CARLITO_FIXTURE[file], added: 1, removed: true}));
  return {report, supervisor, worker, progress: structuredClone(final), stages, registrations, generation, pptxBytes};
}
const syntheticSourcePath = path.resolve(packageRoot, 'artifacts/synthetic-font-embed/source.pptx');
const syntheticSavedPath = path.resolve(packageRoot, 'artifacts/synthetic-font-embed/native-font-embed.pptx');
const positiveEvidence = makeLifecycle(positivePptx, syntheticSourcePath, syntheticSavedPath);
assert.equal(auditSavedEmbedPresentation(positiveEvidence).passed, true);
record('lifecycle-bound-positive');

function failureCodes(evidence) { return new Set(auditSavedEmbedPresentation(evidence).failures.map(item => item.code)); }
const failedCleanup = structuredClone(positiveEvidence); failedCleanup.report.cleanupConfirmed = false;
assert.ok(failureCodes(failedCleanup).has('report-lifecycle'));
const badSavedHash = structuredClone(positiveEvidence); badSavedHash.report.saved.sha256 = '0'.repeat(64);
assert.ok(failureCodes(badSavedHash).has('saved-hash'));
const forgedAptosGate = structuredClone(positiveEvidence); forgedAptosGate.report.nativeFontsObservation = {count: 2, entries: [{index: 1, name: 'Carlito', embedded: 0, embeddable: -1}, {index: 2, name: 'Aptos', embedded: 0, embeddable: -1}]};
assert.ok(failureCodes(forgedAptosGate).has('native-font-inventory'));
const missingInventory = structuredClone(positiveEvidence); delete missingInventory.report.nativeFontsObservation;
assert.ok(failureCodes(missingInventory).has('native-font-inventory'));
const duplicateLedger = structuredClone(positiveEvidence); duplicateLedger.registrations[3] = structuredClone(duplicateLedger.registrations[0]);
assert.ok(failureCodes(duplicateLedger).has('font-cleanup'));
const stageAfterComplete = structuredClone(positiveEvidence); stageAfterComplete.stages.push({...stageAfterComplete.stages.at(-1), sequence: stageAfterComplete.stages.length + 1, timestamp: '2026-09-22T12:01:00.000Z', stage: 'unexpected.after-complete'});
assert.ok([...failureCodes(stageAfterComplete)].some(code => ['stage-pair', 'stage-duplicate', 'stage-terminal'].includes(code)));
const orphanSuccess = structuredClone(positiveEvidence); orphanSuccess.stages.splice(orphanSuccess.stages.findIndex(row => row.stage === 'edited.presentation.fonts.get' && row.status === 'begin'), 1); orphanSuccess.stages.forEach((row, index) => { row.sequence = index + 1; }); orphanSuccess.progress = structuredClone(orphanSuccess.stages.at(-1));
assert.ok(failureCodes(orphanSuccess).has('stage-pair'));
const extraClose = structuredClone(positiveEvidence); const cleanupIndex = extraClose.stages.findIndex(row => row.stage === 'edited.presentation.cleanup'); const duplicateClose = extraClose.stages.filter(row => row.stage === 'edited.presentation.close').map(row => ({...row})); extraClose.stages.splice(cleanupIndex, 0, ...duplicateClose); extraClose.stages.forEach((row, index) => { row.sequence = index + 1; row.timestamp = new Date(Date.parse('2026-09-22T12:00:00.000Z') + index * 1000).toISOString(); }); extraClose.progress = structuredClone(extraClose.stages.at(-1));
assert.ok([...failureCodes(extraClose)].some(code => ['stage-duplicate', 'stage-close'].includes(code)));
record('lifecycle-inventory-ledger-stage-hash-negatives');

const opcNegatives = [
  ['extra-font-part', makeOpc({extraParts: {'ppt/fonts/extra.fntdata': new Uint8Array([9])}}), ['opc-font-part-count', 'opc-font-part-extra']],
  ['dangling-font-relationship', makeOpc({rels: relXml({extra: '<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/extra.fntdata"/>'})}), ['opc-font-relationship-dangling']],
  ['unused-font-relationship-same-target', makeOpc({rels: relXml({extra: '<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/font1.fntdata"/>'})}), ['opc-font-relationship-unused']],
  ['missing-font-reference', makeOpc({presentation: presentationXml({missingStyle: 'p:boldItalic'})}), ['opc-embedded-reference', 'opc-font-part-extra']],
  ['unknown-family', makeOpc({presentation: presentationXml({family: 'Aptos'})}), ['opc-embedded-family', 'opc-unknown-family']],
  ['duplicate-relationship-id', makeOpc({rels: relXml({duplicateId: true})}), ['opc-relationship-id']],
  ['duplicate-content-type', makeOpc({contentTypes: contentTypesXml({duplicate: true})}), ['opc-content-type-duplicate']],
  ['traversing-target', makeOpc({rels: relXml({target: '../fonts/font1.fntdata'})}), ['opc-font-relationship-target', 'opc-embedded-target']],
  ['external-target', makeOpc({rels: relXml({target: 'https://example.invalid/font', external: true})}), ['opc-font-relationship-external', 'opc-embedded-relationship']],
  ['presentation-namespace-rebinding', makeOpc({presentation: presentationXml().replace('<p:embeddedFontLst>', '<p:embeddedFontLst xmlns:p="urn:unexpected">')}), ['opc-namespace-rebinding']],
  ['relationship-namespace-rebinding', makeOpc({rels: relXml().replace('<Relationship Id="rId1"', '<Relationship xmlns="urn:unexpected" Id="rId1"')}), ['opc-namespace-rebinding']],
  ['content-type-namespace-rebinding', makeOpc({contentTypes: contentTypesXml().replace('<Default ', '<Default xmlns="urn:unexpected" ')}), ['opc-namespace-rebinding']],
];
for (const [name, pptx, expectedCodes] of opcNegatives) {
  const codes = new Set(inspectFontEmbeddingPackage(pptx).failures.map(item => item.code));
  assert.ok(expectedCodes.some(code => codes.has(code)), `${name}: ${[...codes].join(',')}`);
}
record('font-opc-negative-fixtures');

function duplicateCentralNameZip() {
  const zip = makeOpc({extraParts: {'ppt/fonts/fond1.fntdata': new Uint8Array([7])}});
  const from = Buffer.from('ppt/fonts/fond1.fntdata'); const to = Buffer.from('ppt/fonts/font1.fntdata');
  let changed = false;
  for (let index = 0; index <= zip.length - from.length; index++) if (zip.subarray(index, index + from.length).equals(from) && index >= 4 && zip.readUInt32LE(index - 46) === 0x02014b50) { to.copy(zip, index); changed = true; }
  assert.equal(changed, true);
  return zip;
}
assert.ok(inspectFontEmbeddingPackage(duplicateCentralNameZip()).failures.some(item => item.code === 'opc-zip-structure'));
record('duplicate-central-directory-name-rejected');

const missingArg = spawnSync(node, [auditCli], spawnOptions);
assert.notEqual(missingArg.status, 0); assert.match(missingArg.stderr, /Usage/);
const missingDir = spawnSync(node, [auditCli, path.join(os.tmpdir(), `opf-font-embed-missing-${process.pid}`)], spawnOptions);
assert.notEqual(missingDir.status, 0); assert.match(missingDir.stderr, /does not exist/);
record('cli-missing-inputs-fail-without-output');

const require = createRequire(path.join(packageRoot, 'package.json'));
const carlitoRoot = path.dirname(require.resolve('@expo-google-fonts/carlito/package.json'));
const installedFaces = {
  'fonts/Carlito-400-normal.ttf': '400Regular/Carlito_400Regular.ttf',
  'fonts/Carlito-400-italic.ttf': '400Regular_Italic/Carlito_400Regular_Italic.ttf',
  'fonts/Carlito-700-normal.ttf': '700Bold/Carlito_700Bold.ttf',
  'fonts/Carlito-700-italic.ttf': '700Bold_Italic/Carlito_700Bold_Italic.ttf',
};
const tempBase = path.resolve(os.tmpdir());
const evidenceRoot = await mkdtemp(path.join(tempBase, 'opf-font-embed-control-'));
assert.ok(path.resolve(evidenceRoot).startsWith(tempBase + path.sep));
try {
  const inputs = path.join(evidenceRoot, 'inputs'); const originals = path.join(evidenceRoot, 'synthetic-originals');
  await mkdir(path.join(inputs, 'fonts'), {recursive: true}); await mkdir(path.join(originals, 'fonts'), {recursive: true});
  const sourceBytes = Buffer.from('synthetic source binding; not a native PPTX'); const sourceHash = sha(sourceBytes);
  await writeFile(path.join(originals, 'source.pptx'), sourceBytes); await copyFile(path.join(originals, 'source.pptx'), path.join(inputs, 'source.pptx'));
  const directoryGeneration = {...structuredClone(generation), source: {file: 'source.pptx', sha256: sourceHash}, license: {file: 'LICENSE_FONT', spdx: 'OFL-1.1', sha256: PERMITTED_CARLITO_LICENSE_SHA256}};
  await writeFile(path.join(originals, 'generation.json'), JSON.stringify(directoryGeneration, null, 2) + '\n'); await copyFile(path.join(originals, 'generation.json'), path.join(inputs, 'generation.json'));
  await copyFile(path.join(carlitoRoot, 'LICENSE_FONT'), path.join(originals, 'LICENSE_FONT')); await copyFile(path.join(originals, 'LICENSE_FONT'), path.join(inputs, 'LICENSE_FONT'));
  await copyFile(embedVerifier, path.join(inputs, 'native-font-embed.ps1'));
  await copyFile(path.join(root, 'native-process.ps1'), path.join(inputs, 'native-process.ps1'));
  await copyFile(path.join(root, 'native-text-fonts.ps1'), path.join(inputs, 'native-text-fonts.ps1'));
  for (const [file, installed] of Object.entries(installedFaces)) { await copyFile(path.join(carlitoRoot, installed), path.join(originals, file)); await copyFile(path.join(originals, file), path.join(inputs, file)); }
  const generationBytes = await readFile(path.join(inputs, 'generation.json'));
  const expectations = {
    title: {text: 'Gate E - Carlito', family: 'Carlito', size: 30, bold: true, italic: false},
    body: {text: 'Regular 18 | Bold 20 | Italic 22 | BoldItalic 24', family: 'Carlito', defaultSize: 18, runs: []},
    embedFonts: {saveFormat: 24, saveArgument: -1, meaning: 'synthetic structural control'},
    nativeFonts: {allowedNames: [...PERMITTED_NATIVE_FONT_NAMES], maxEntries: 64, unexpectedNamesBlockSave: true, requireEmbeddable: true},
  };
  const item = (original, snapshot, hash) => ({path: original, sha256: hash, snapshotPath: snapshot, snapshotSha256: hash});
  const request = {
    source: item(path.join(originals, 'source.pptx'), path.join(inputs, 'source.pptx'), sourceHash),
    fixture: {
      generation: item(path.join(originals, 'generation.json'), path.join(inputs, 'generation.json'), sha(generationBytes)),
      license: {...item(path.join(originals, 'LICENSE_FONT'), path.join(inputs, 'LICENSE_FONT'), PERMITTED_CARLITO_LICENSE_SHA256), spdx: 'OFL-1.1'},
      fonts: PERMITTED_CARLITO_FIXTURE_FILES.map(file => ({file, ...item(path.join(originals, file), path.join(inputs, file), PERMITTED_CARLITO_FIXTURE[file])})),
    },
    verifier: item(embedVerifier, path.join(inputs, 'native-font-embed.ps1'), sha(Buffer.from(embedSource))),
    processHelper: item(path.join(root, 'native-process.ps1'), path.join(inputs, 'native-process.ps1'), sha(await readFile(path.join(inputs, 'native-process.ps1')))),
    fontHelper: {...item(path.join(root, 'native-text-fonts.ps1'), path.join(inputs, 'native-text-fonts.ps1'), sha(await readFile(path.join(inputs, 'native-text-fonts.ps1')))), registrationFlags: 0},
    expectations,
  };
  const savedPath = path.join(evidenceRoot, 'native-font-embed.pptx');
  const directoryEvidence = makeLifecycle(positivePptx, path.join(inputs, 'source.pptx'), savedPath, sourceHash);
  directoryEvidence.generation = directoryGeneration;
  directoryEvidence.report.source = {path: request.source.path, sha256: sourceHash, snapshotPath: request.source.snapshotPath, snapshotSha256: sourceHash};
  directoryEvidence.report.requested = expectations;
  const bindings = [
    ['source', request.source], ['generation', request.fixture.generation], ['license', request.fixture.license], ['verifier', request.verifier], ['process-helper', request.processHelper], ['font-helper', request.fontHelper],
    ...request.fixture.fonts.map(font => [`font:${font.file}`, font]),
  ];
  directoryEvidence.supervisor.inputChecks = bindings.flatMap(([role, binding]) => [
    {role, copy: 'snapshot', path: binding.snapshotPath, expected: binding.sha256, actual: binding.sha256, matched: true},
    {role, copy: 'original', path: binding.path, expected: binding.sha256, actual: binding.sha256, matched: true},
  ]);
  await Promise.all([
    writeFile(path.join(evidenceRoot, 'request.json'), JSON.stringify(request)),
    writeFile(path.join(evidenceRoot, 'report.json'), JSON.stringify(directoryEvidence.report)),
    writeFile(path.join(evidenceRoot, 'supervisor.json'), JSON.stringify(directoryEvidence.supervisor)),
    writeFile(path.join(evidenceRoot, 'worker.json'), JSON.stringify(directoryEvidence.worker)),
    writeFile(path.join(evidenceRoot, 'progress.json'), JSON.stringify(directoryEvidence.progress)),
    writeFile(path.join(evidenceRoot, 'font-registration.json'), JSON.stringify(directoryEvidence.registrations)),
    writeFile(path.join(evidenceRoot, 'stages.jsonl'), directoryEvidence.stages.map(row => JSON.stringify(row)).join('\n') + '\n'),
    writeFile(savedPath, positivePptx),
  ]);
  assert.equal((await auditEvidenceDirectory(evidenceRoot)).passed, true);
  const firstCli = spawnSync(node, [auditCli, evidenceRoot], spawnOptions);
  assert.equal(firstCli.status, 0, firstCli.stderr || firstCli.stdout);
  const auditBytes = await readFile(path.join(evidenceRoot, 'embed-opc-audit.json'));
  const secondCli = spawnSync(node, [auditCli, evidenceRoot], spawnOptions);
  assert.notEqual(secondCli.status, 0); assert.match(secondCli.stderr, /Refusing to overwrite/);
  assert.equal(sha(await readFile(path.join(evidenceRoot, 'embed-opc-audit.json'))), sha(auditBytes));
  const mutatedFontPath = path.join(inputs, PERMITTED_CARLITO_FIXTURE_FILES[0]); const canonicalFontBytes = await readFile(mutatedFontPath);
  await writeFile(mutatedFontPath, Buffer.concat([canonicalFontBytes, Buffer.from([0])]));
  assert.ok((await auditEvidenceDirectory(evidenceRoot)).failures.some(item => item.code === 'input-hash'));
  await writeFile(mutatedFontPath, canonicalFontBytes);
  const supervisorPath = path.join(evidenceRoot, 'supervisor.json'); const supervisorBytes = await readFile(supervisorPath); const corruptedSupervisor = JSON.parse(supervisorBytes);
  corruptedSupervisor.inputChecks[0].actual = '0'.repeat(64); corruptedSupervisor.inputChecks[0].matched = false;
  await writeFile(supervisorPath, JSON.stringify(corruptedSupervisor));
  assert.ok((await auditEvidenceDirectory(evidenceRoot)).failures.some(item => item.code === 'supervisor-input-binding'));
  await writeFile(supervisorPath, supervisorBytes);
  const workerPath = path.join(evidenceRoot, 'worker.json'); const workerBytes = await readFile(workerPath);
  await writeFile(workerPath, 'false\n');
  assert.ok((await auditEvidenceDirectory(evidenceRoot)).failures.some(item => item.code === 'evidence-object'));
  await writeFile(workerPath, workerBytes);
  const generationPath = path.join(inputs, 'generation.json'); const savedGenerationBytes = await readFile(generationPath);
  await writeFile(generationPath, 'null\n');
  assert.ok((await auditEvidenceDirectory(evidenceRoot)).failures.some(item => item.code === 'evidence-object'));
  await writeFile(generationPath, savedGenerationBytes);
  record('full-directory-audit-canonical-installed-fixture');
  record('cli-preserves-existing-audit');
  record('directory-rejects-snapshot-and-supervisor-mutation');
  record('directory-rejects-false-null-json');
} finally {
  const resolved = path.resolve(evidenceRoot);
  if (resolved.startsWith(tempBase + path.sep)) await rm(resolved, {recursive: true, force: true});
}

const suite = {
  passed: outcomes.every(item => item.passed),
  scope: 'Offline controls for canonical pre-registration provenance, fail-closed native Fonts gating, lifecycle-bound font OPC structure, and immutable CLI output. No Office or font API was called.',
  node: process.version,
  embedVerifier,
  embedVerifierSha256: sha(Buffer.from(embedSource)),
  checks: outcomes,
};
const reportPath = path.join(packageRoot, 'artifacts/native-font-embed-controls.json');
await mkdir(path.dirname(reportPath), {recursive: true});
await writeFile(reportPath, JSON.stringify(suite, null, 2) + '\n');
console.log(JSON.stringify({passed: suite.passed, checks: outcomes.length, reportPath}));
process.exitCode = suite.passed ? 0 : 1;
