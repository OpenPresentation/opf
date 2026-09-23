import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {copyFile, mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PERMITTED_CARLITO_FIXTURE, PERMITTED_CARLITO_FIXTURE_FILES, PERMITTED_CARLITO_LICENSE_SHA256, stripPowerShellLiteralsForScan} from './native-font-embed-audit.mjs';
import {ALLOWED_COM_MEMBERS, ALLOWED_INSTANCE_MEMBERS, ALLOWED_STATIC_MEMBERS, analyzeFailureCleanup, AUDIT_SCHEMA_VERSION, auditEvidenceDirectory, auditInventoryVerifierSource, computeFontLedger, emptyNameFontFindings, expectedInventoryStages, INVENTORY_ASSIGNMENT_ROOTS, INVENTORY_BOUNDS, invokedMembers, PRIOR_REVIEWED_INVENTORY_VERIFIER_SHA256, INVENTORY_SOURCE_POLICY} from './native-font-inventory-audit.mjs';
import {assertSourcePolicyProbes} from './powershell-scan-probes.mjs';
import {readPowerShellPolicyLists} from './powershell-scan.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const root = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(root, '..');
const verifier = path.join(root, 'native-font-inventory.ps1');
const auditCli = path.join(root, 'native-font-inventory-audit.mjs');
const mockPath = path.join(root, 'native-font-inventory-mock.ps1');
const node = process.execPath;
const spawnOptions = {cwd: packageRoot, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, timeout: 120_000, windowsHide: true};
assert.equal(process.versions.node.split('.')[0], '24', 'Native font inventory controls require Node 24.');
const outcomes = [];
const record = (name, extra = {}) => outcomes.push({name, passed: true, ...extra});
const codes = result => new Set(result.failures.map(item => item.code));
const tempBase = path.resolve(os.tmpdir());
const scratch = await mkdtemp(path.join(tempBase, 'opf-font-inventory-controls-'));
assert.ok(scratch.startsWith(tempBase + path.sep));

const verifierSource = await readFile(verifier, 'utf8');
assert.deepEqual(auditInventoryVerifierSource(verifierSource), []);
const policyNegatives = [
  ['saveAs', verifierSource.replace('$script:presentation.Close()', '$script:presentation.SaveAs($x,24,0); $script:presentation.Close()'), 'forbidden-member'],
  ['saveCopyAs', verifierSource + '\n$script:presentation.SaveCopyAs($x)\n', 'forbidden-member'],
  ['quit', verifierSource + '\n$app.Quit()\n', 'application-quit'],
  ['export', verifierSource + '\n$script:presentation.ExportAsFixedFormat($x,2)\n', 'forbidden-member'],
  ['setter', verifierSource + '\n$script:presentation.set_Saved(-1)\n', 'forbidden-member'],
  ['secondOpen', verifierSource + '\n$other=$presentations.Open($x,(-1),0,0)\n', 'open-count'],
  ['writableOpen', verifierSource.replace('$presentations.Open($sourceSnapshot,(-1),0,0)', '$presentations.Open($sourceSnapshot,0,0,0)'), 'open-readonly'],
  ['secondClose', verifierSource + '\n$script:presentation.Close()\n', 'close-count'],
  ['stopProcess', verifierSource + '\nStop-Process -Name POWERPNT\n', 'process-kill'],
  ['secondComObject', verifierSource + '\n$word=New-Object -ComObject Word.Application\n', 'com-construction'],
  ['addSlide', verifierSource + '\n$null=$script:presentation.Slides.Add(1,1)\n', 'forbidden-member'],
  ['applyTemplate', verifierSource + '\n$script:presentation.ApplyTemplate($x)\n', 'forbidden-member'],
  ['applyTheme', verifierSource + '\n$script:presentation.ApplyTheme($x)\n', 'forbidden-member'],
  ['replaceFont', verifierSource + '\n$script:presentation.Fonts.Replace($a,$b)\n', 'forbidden-member'],
  ['staticDelete', verifierSource + '\n[IO.File]::Delete($x)\n', 'forbidden-member'],
  ['dynamicInvoke', verifierSource + '\n$script:presentation.$member()\n', 'forbidden-member'],
];
for (const [name, text, code] of policyNegatives) assert.ok(auditInventoryVerifierSource(text).some(item => item.code === code), name);
assert.deepEqual(auditInventoryVerifierSource(verifierSource + "\n# $app.Quit() and .SaveAs( in a comment\n$note='SaveAs( and .Quit() in a string'\n"), []);
record('verifier-read-only-source-policy');

// The inventory worker has no COM setter: every member assignment must target a local report root, and dynamic code is
// forbidden outright (it has no pure-regression re-evaluation).
{
  assert.deepEqual(INVENTORY_ASSIGNMENT_ROOTS, ['report', 'slideRecord', 'shapeRecord', 'seen', 'wrongGeneration', 'sample', 'sampleRows', 'policyRejected', 'errorCloseOutcomes']);
  const policyCodes = text => new Set(auditInventoryVerifierSource(text).map(item => item.code));
  for (const [name, line] of [
    ['shape-name', "$shape.Name='edited'"], ['font-name', "$font.Name='Aptos'"], ['saved-flag', '$script:presentation.Saved=-1'],
    ['application-visible', '$app.Visible=0'], ['chained', "$script:presentation.Slides.Item(1).Shapes.Item(1).Name='x'"],
    ['prefix-increment', '++$shape.Top'], ['compound', '$shape.Top -= 1'], ['pipeline-variable', "$shapes | ForEach-Object { $_.Name='x' }"],
    ['comment-then-assignment', "# it's the presentation's font\n$font.Name='Aptos'"],
  ]) assert.ok(policyCodes(`${verifierSource}\n${line}\n`).has('com-property-assignment'), name);
  for (const [name, line] of [
    ['invoke-expression', 'Invoke-Expression $x'], ['iex', 'iex $x'], ['qualified', 'Microsoft.PowerShell.Utility\\Invoke-Expression $x'],
    ['string-named', "& 'iex' $x"], ['add-type', 'Add-Type -TypeDefinition $x'], ['string-named-member', "$null=$app.'Quit'()"],
    ['scriptblock-create', '$null=[scriptblock]::Create($x)'], ['invoke-script', '$null=$Host.Runspace.InvokeScript($x)'], ['execution-context', '$null=$ExecutionContext.SessionState'],
    ['invoke-command', 'Invoke-Command -ScriptBlock $x'], ['call-variable', '& $x'], ['dot-source-variable', '. $x'], ['call-expression', '& (Get-Command $x)'],
    ['operation-outside-com-wrapper', 'function Test-InventoryDynamic { & $Operation }'], ['decide-outside-pure', '& $decide 1'], ['helper-in-function', 'function Test-InventoryDynamic { . $processSnapshot }'], ['dynamic-member', '$null=$x.$name()'],
  ]) assert.ok(policyCodes(`${verifierSource}\n${line}\n`).has('dynamic-code'), name);
  for (const [name, line] of [['comment', "# $shape.Name='x'; iex $x"], ['string', "$note='Invoke-Expression and $font.Name=1'"], ['local-root', '$report.extra=1']]) {
    assert.deepEqual(auditInventoryVerifierSource(`${verifierSource}\n${line}\n`), [], name);
  }
}
record('verifier-node-com-assignment-and-dynamic-code-policy');

// The Node allowlist policy and the harness's $script:InventoryPolicy* lists (enforced by its PowerShell AST check) are
// one reviewed allowlist; every independent-review probe is rejected by both layers.
{
  const lists = readPowerShellPolicyLists(verifierSource, 'Inventory');
  for (const [key, value] of Object.entries(lists)) assert.deepEqual(value, [...INVENTORY_SOURCE_POLICY[key]], `InventoryPolicy ${key} parity`);
  const probes = await assertSourcePolicyProbes({source: verifierSource, audit: auditInventoryVerifierSource, harnessPath: verifier, assertFunction: 'Assert-InventoryWorkerAst', positives: [], names: {com: 'Invoke-InventoryCom', pure: 'Invoke-InventoryPureRegression'}});
  record('source-policy-allowlist-parity-and-review-probes', {probes});
}

const ps = path.join(process.env.WINDIR ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
if (process.platform === 'win32') {
  const child = spawnSync(ps, ['-NoProfile', '-NonInteractive', '-File', verifier, '-PureRegression'], spawnOptions);
  assert.equal(child.status, 0, child.stderr || child.stdout);
  const pure = JSON.parse(child.stdout.replace(/^\uFEFF/, ''));
  assert.equal(pure.passed, true); assert.equal(pure.officeOrComCalls, 0); assert.equal(pure.fontApiCalls, 0);
  assert.equal(pure.registrationArrayDecodedRows, 4); assert.equal(pure.stopLatchPassed, true); assert.equal(pure.nonErrorStageErrorIsNull, true);
  assert.ok(Object.values(pure.policyNegativesRejected).every(Boolean));
  record('pure-regression');
} else record('pure-regression', {skipped: 'non-Windows runner'});

const font = (name, extra = {}) => ({name, nameAscii: name, nameOther: name, nameFarEast: '', nameComplexScript: '', size: 18, bold: 0, italic: 0, ...extra});
const sub = (index, start, text, fontRecord) => ({index, start, length: text.length, text, textTruncated: false, font: fontRecord});
function textShape(index, name, segments, family = 'Carlito', farEast = '') {
  let start = 1; const runs = [];
  for (const [offset, [text, size, bold, italic]] of segments.entries()) { runs.push(sub(offset + 1, start, text, font(family, {nameFarEast: farEast, size, bold, italic}))); start += text.length; }
  const text = segments.map(segment => segment[0]).join('');
  const whole = font(family, {nameFarEast: farEast});
  return {index, name, type: 14, hasTextFrame: -1, hasText: -1, text, textLength: text.length, textTruncated: false, rangeFont: whole, paragraphCount: 1, paragraphs: [sub(1, 1, text, whole)], runCount: runs.length, runs};
}
const emptyShape = (index, name, complexScript = '') => ({index, name, type: 14, hasTextFrame: -1, hasText: 0, text: '', textLength: 0, textTruncated: false, rangeFont: font('Carlito', {nameComplexScript: complexScript}), paragraphCount: null, paragraphs: [], runCount: null, runs: []});
const pictureShape = index => ({index, name: 'Picture', type: 13, hasTextFrame: 0, hasText: null, text: null, textLength: null, textTruncated: false, rangeFont: null, paragraphCount: null, paragraphs: [], runCount: null, runs: []});

function observation({fonts = ['Carlito'], masterComplexScript = '', themeEastAsian = ''} = {}) {
  const slideShapes = [textShape(1, 'OPF heading slides.0.title line 0', [['Gate E fixture', 30, -1, 0]]), textShape(2, 'OPF text slides.0.text line 0', [['Regular ', 18, 0, 0], ['Bold ', 20, -1, 0], ['Italic ', 22, 0, -1], ['BoldItalic', 24, -1, -1]]), pictureShape(3)];
  return {
    presentationFonts: {count: fonts.length, entries: fonts.map((name, offset) => ({index: offset + 1, name, embedded: 0, embeddable: -1}))},
    theme: {major: {latin: 'Carlito', complexScript: '', eastAsian: themeEastAsian}, minor: {latin: 'Carlito', complexScript: '', eastAsian: ''}},
    slides: {count: 1, entries: [{index: 1, shapeCount: slideShapes.length, shapes: slideShapes}]},
    slideMaster: {shapeCount: 2, shapes: [emptyShape(1, 'Title Placeholder 1'), emptyShape(2, 'Text Placeholder 2', masterComplexScript)]},
  };
}

// Ledger controls.
{
  const carlito = computeFontLedger(observation());
  assert.equal(carlito.aptosReported, false); assert.equal(carlito.carlitoOnlyPresentationFonts, true);
  assert.deepEqual(carlito.slideTextSlotNames, ['Carlito']);
  const fontsAptos = computeFontLedger(observation({fonts: ['Carlito', 'Aptos']}));
  assert.deepEqual(fontsAptos.aptosPresentationFontNames, ['Aptos']); assert.deepEqual(fontsAptos.nonCarlitoPresentationFontNames, ['Aptos']); assert.equal(fontsAptos.carlitoOnlyPresentationFonts, false);
  const masterAptos = computeFontLedger(observation({masterComplexScript: 'Aptos'}));
  assert.deepEqual(masterAptos.aptosMasterTextSlotNames, ['Aptos']); assert.equal(masterAptos.aptosReported, true); assert.equal(masterAptos.carlitoOnlyPresentationFonts, true);
  const themeAptos = computeFontLedger(observation({themeEastAsian: 'Aptos Display'}));
  assert.deepEqual(themeAptos.aptosThemeFontNames, ['Aptos Display']);
  record('font-ledger-controls');
}

// The Node audit and the worker's own AST policy must use the same allowlist.
{
  const listed = name => JSON.parse(`[${verifierSource.match(new RegExp(`\\$script:${name}=@\\(([^)]*)\\)`))[1].replaceAll("'", '"')}]`);
  assert.deepEqual(listed('inventoryAllowedComMembers'), [...ALLOWED_COM_MEMBERS]);
  assert.deepEqual(listed('inventoryAllowedInstanceMembers'), [...ALLOWED_INSTANCE_MEMBERS]);
  assert.deepEqual(listed('inventoryAllowedStaticMembers'), [...ALLOWED_STATIC_MEMBERS]);
  const used = invokedMembers(verifierSource);
  assert.ok(ALLOWED_COM_MEMBERS.every(name => used.instance.includes(name)), 'Every allowlisted COM member should be used');
  record('member-allowlist-parity');
}

// Close-on-failure consistency, on stage sequences derived from a real observation.
{
  const snapshot = path.join(os.tmpdir(), 'inputs', 'source.pptx');
  const base = {...observation(), preflightPresentationCount: 0, source: {readOnly: -1}};
  const rows = []; for (const [name, kind] of expectedInventoryStages(base)) { if (kind === 'pair') rows.push([name, 'begin'], [name, 'success']); else rows.push([name, 'success']); }
  const openBegin = rows.findIndex(([name, status]) => name === 'input.presentation.open-readonly' && status === 'begin');
  const cut = rows.findIndex(([name, status]) => name === 'owned.presentation.fonts.count.get' && status === 'success') + 1;
  const row = (stage, status, owned, extra = {}) => ({stage, status, error: status === 'error' ? 'failure' : null, cleanupConfirmed: !owned, officeOperationsStopped: false, ownedPresentationPath: owned ? snapshot : null, ...extra});
  const prefix = rows.slice(0, cut).map(([stage, status], index) => row(stage, status, index >= openBegin));
  const errorClose = [row('owned.presentation.error.fullName-before-close.get', 'begin', true), row('owned.presentation.error.fullName-before-close.get', 'success', true), row('owned.presentation.error.close', 'begin', true), row('owned.presentation.error.close', 'success', true), row('owned.presentation.error.cleanup', 'success', false)];
  const failure = owned => row('worker.failure', 'error', owned);
  const closedReport = {failureCleanup: 'closed-owned-after-failure', cleanupConfirmed: true, ownedCloseCount: 1, officeOperationsStopped: false};
  assert.equal(analyzeFailureCleanup(closedReport, [...prefix, ...errorClose, failure(false)]).consistent, true);
  assert.equal(analyzeFailureCleanup(closedReport, [...prefix, failure(false)]).consistent, false, 'claimed error close without close stages');
  assert.equal(analyzeFailureCleanup(closedReport, [...prefix, ...errorClose, ...errorClose.slice(2, 4), failure(false)]).consistent, false, 'second close invocation');
  const comError = row('owned.presentation.fonts.item-1.get', 'error', true, {officeOperationsStopped: true, cleanupConfirmed: false});
  const latchedReport = {failureCleanup: 'left-open-com-latched', cleanupConfirmed: false, ownedCloseCount: 0, officeOperationsStopped: true};
  assert.equal(analyzeFailureCleanup(latchedReport, [...prefix, comError, failure(true)]).consistent, true);
  assert.equal(analyzeFailureCleanup(latchedReport, [...prefix, comError, ...errorClose, failure(false)]).consistent, false, 'close after a COM failure');
  assert.equal(analyzeFailureCleanup({...closedReport}, [...prefix, comError, ...errorClose, failure(false)]).consistent, false, 'error close after a COM failure');
  const notOwnedReport = {failureCleanup: 'left-open-not-closed: Refusing to close', cleanupConfirmed: false, ownedCloseCount: 0, officeOperationsStopped: false};
  assert.equal(analyzeFailureCleanup(notOwnedReport, [...prefix, ...errorClose.slice(0, 2), failure(true)]).consistent, true);
  assert.equal(analyzeFailureCleanup(notOwnedReport, [...prefix, ...errorClose, failure(false)]).consistent, false, 'closed a presentation not proven owned');
  assert.equal(analyzeFailureCleanup({failureCleanup: 'no-owned-presentation-open', cleanupConfirmed: true}, [...prefix, failure(true)]).consistent, false, 'opened presentation silently left open');
  assert.equal(analyzeFailureCleanup({failureCleanup: 'closed-owned-after-failure'}, [...prefix, row('worker.complete', 'success', false)]).consistent, false, 'failureCleanup on a completed run');
  record('close-on-failure-consistency');
}

const require = createRequire(path.join(packageRoot, 'package.json'));
const carlitoRoot = path.dirname(require.resolve('@expo-google-fonts/carlito/package.json'));
const installedFaces = {
  'fonts/Carlito-400-normal.ttf': '400Regular/Carlito_400Regular.ttf',
  'fonts/Carlito-400-italic.ttf': '400Regular_Italic/Carlito_400Regular_Italic.ttf',
  'fonts/Carlito-700-normal.ttf': '700Bold/Carlito_700Bold.ttf',
  'fonts/Carlito-700-italic.ttf': '700Bold_Italic/Carlito_700Bold_Italic.ttf',
};
let buildCounter = 0;

// Build one synthetic evidence directory whose raw files follow the worker's
// contract. `mutate` edits the in-memory evidence before it is written.
async function buildEvidence({inputMode = 'carlito-fixture', mode = 'none', fonts = ['Carlito'], mutate = () => {}} = {}) {
  const base = path.join(scratch, `synthetic-${++buildCounter}`);
  const evidence = path.join(base, 'evidence'), originals = path.join(base, 'originals'), inputs = path.join(evidence, 'inputs');
  await mkdir(inputs, {recursive: true}); await mkdir(originals, {recursive: true});
  const item = (original, snapshot, hash) => ({path: original, sha256: hash, snapshotPath: snapshot, snapshotSha256: hash});
  const place = async (name, bytes) => { await writeFile(path.join(originals, name), bytes); await writeFile(path.join(inputs, name), bytes); return sha(bytes); };
  const sourceHash = await place('source.pptx', Buffer.from(`synthetic ${inputMode} source; not a native PPTX`));
  const helpers = {};
  for (const name of ['native-font-inventory.ps1', 'native-process.ps1', 'native-text-fonts.ps1']) { const bytes = await readFile(path.join(root, name)); await writeFile(path.join(inputs, name), bytes); helpers[name] = item(path.join(root, name), path.join(inputs, name), sha(bytes)); }
  let fixture = null;
  if (inputMode === 'carlito-fixture') {
    await mkdir(path.join(inputs, 'fonts')); await mkdir(path.join(originals, 'fonts'));
    const generation = {kind: 'native-font-edit-fixture', source: {file: 'source.pptx', sha256: sourceHash}, registration: {flags: 0}, license: {file: 'LICENSE_FONT', spdx: 'OFL-1.1', sha256: PERMITTED_CARLITO_LICENSE_SHA256}, fonts: PERMITTED_CARLITO_FIXTURE_FILES.map(file => ({file, sha256: PERMITTED_CARLITO_FIXTURE[file]}))};
    const generationHash = await place('generation.json', Buffer.from(JSON.stringify(generation, null, 2) + '\n'));
    await place('LICENSE_FONT', await readFile(path.join(carlitoRoot, 'LICENSE_FONT')));
    for (const [file, installed] of Object.entries(installedFaces)) await place(file, await readFile(path.join(carlitoRoot, installed)));
    fixture = {
      path: originals, generation: item(path.join(originals, 'generation.json'), path.join(inputs, 'generation.json'), generationHash),
      license: {...item(path.join(originals, 'LICENSE_FONT'), path.join(inputs, 'LICENSE_FONT'), PERMITTED_CARLITO_LICENSE_SHA256), spdx: 'OFL-1.1'},
      fonts: PERMITTED_CARLITO_FIXTURE_FILES.map(file => ({file, ...item(path.join(originals, file), path.join(inputs, file), PERMITTED_CARLITO_FIXTURE[file])})),
    };
  }
  const snapshot = path.join(inputs, 'source.pptx');
  const fontRegistration = {mode, flags: mode === 'none' ? null : 0};
  const request = {
    schemaVersion: 1, kind: 'native-font-inventory', inputMode, source: item(path.join(originals, 'source.pptx'), snapshot, sourceHash), fixture,
    verifier: helpers['native-font-inventory.ps1'], processHelper: helpers['native-process.ps1'], fontHelper: helpers['native-text-fonts.ps1'],
    fontRegistration, bounds: {...INVENTORY_BOUNDS}, scope: 'synthetic control',
  };
  const observed = observation({fonts});
  const report = {
    schemaVersion: 1, kind: 'native-font-inventory', inputMode,
    source: {path: request.source.path, sha256: sourceHash, snapshotPath: snapshot, snapshotSha256: sourceHash, fullName: snapshot, openedPathMatches: true, readOnly: -1, snapshotUnchangedAfterClose: true},
    fontRegistration, bounds: {...INVENTORY_BOUNDS}, ...observed, boundsExceeded: [], semanticFailures: [], fontLedger: null,
    preflightPresentationCount: 0, ownedOpenCount: 1, ownedCloseCount: 1, failureCleanup: null, environment: {powerPointVersion: 'synthetic'},
    cleanupConfirmed: true, officeOperationsStopped: false, lastStage: 'worker.complete', lastStatus: 'success', error: null,
  };
  report.fontLedger = {...computeFontLedger(report), scope: 'synthetic'};
  const expected = expectedInventoryStages(report);
  const rows = []; for (const [name, kind] of expected) { if (kind === 'pair') rows.push([name, 'begin'], [name, 'success']); else rows.push([name, 'success']); }
  const openBegin = rows.findIndex(([name, status]) => name === 'input.presentation.open-readonly' && status === 'begin');
  const closeSuccess = rows.findIndex(([name, status]) => name === 'owned.presentation.close' && status === 'success');
  const start = Date.parse('2026-09-23T12:00:00.000Z');
  const stages = rows.map(([stage, status], index) => {
    const owned = index >= openBegin && index <= closeSuccess;
    return {sequence: index + 1, timestamp: new Date(start + index * 10).toISOString(), stage, status, error: null, cleanupConfirmed: !owned, officeOperationsStopped: false, ownedPresentationPath: owned ? snapshot : null};
  });
  const final = stages.at(-1);
  const bindings = [['source', request.source], ...(fixture ? [['generation', fixture.generation], ['license', fixture.license]] : []), ['verifier', request.verifier], ['process-helper', request.processHelper], ['font-helper', request.fontHelper], ...(fixture ? fixture.fonts.map(entry => [`font:${entry.file}`, entry]) : [])];
  const supervisor = {
    timestamp: new Date(Date.parse(final.timestamp) + 1000).toISOString(), passed: true, timedOut: false, exitCode: 0, inputMode, fontRegistrationMode: mode,
    officeLifecycleComplete: true, readOnlyConfirmed: true, inventoryComplete: true, fontCleanupConfirmed: mode === 'none' ? null : true, registrationFilePresent: mode !== 'none', inputsUnchanged: true,
    ownedOpenCount: 1, ownedCloseCount: 1, lastDurableStage: 'worker.complete', lastDurableStatus: 'success', parentError: null,
    aptosReported: report.fontLedger.aptosReported, presentationFontNames: report.fontLedger.presentationFontNames,
    inputChecks: bindings.flatMap(([role, binding]) => [{role, copy: 'snapshot', path: binding.snapshotPath, expected: binding.sha256, actual: binding.sha256, matched: true}, {role, copy: 'original', path: binding.path, expected: binding.sha256, actual: binding.sha256, matched: true}]),
  };
  const worker = {processId: 4242, startedAt: '2026-09-23T11:59:59.000Z', finishedAt: supervisor.timestamp, timeoutSeconds: 45, timedOut: false, exitCode: 0};
  const registrations = mode === 'none' ? null : PERMITTED_CARLITO_FIXTURE_FILES.map(file => ({file, sha256: PERMITTED_CARLITO_FIXTURE[file], added: 1, removed: true}));
  const state = {request, report, supervisor, worker, stages, registrations, progress: null, extraFiles: {}};
  mutate(state);
  state.progress ??= structuredClone(state.stages.at(-1));
  const json = value => JSON.stringify(value, null, 2) + '\n';
  await Promise.all([
    writeFile(path.join(evidence, 'request.json'), json(state.request)), writeFile(path.join(evidence, 'report.json'), json(state.report)),
    writeFile(path.join(evidence, 'supervisor.json'), json(state.supervisor)), writeFile(path.join(evidence, 'worker.json'), json(state.worker)),
    writeFile(path.join(evidence, 'progress.json'), json(state.progress)), writeFile(path.join(evidence, 'stages.jsonl'), state.stages.map(row => JSON.stringify(row)).join('\n') + '\n'),
    writeFile(path.join(evidence, 'worker.stdout.log'), ''), writeFile(path.join(evidence, 'worker.stderr.log'), ''),
    ...(state.registrations ? [writeFile(path.join(evidence, 'font-registration.json'), json(state.registrations))] : []),
    ...Object.entries(state.extraFiles).map(([name, bytes]) => writeFile(path.join(evidence, name), bytes)),
  ]);
  return evidence;
}
const renumber = state => { state.stages.forEach((row, index) => { row.sequence = index + 1; }); state.progress = structuredClone(state.stages.at(-1)); };

try {
  for (const [inputMode, mode] of [['carlito-fixture', 'none'], ['carlito-fixture', 'temporary-session'], ['control-deck', 'none']]) {
    const result = await auditEvidenceDirectory(await buildEvidence({inputMode, mode}));
    assert.equal(result.passed, true, `${inputMode}/${mode}: ${JSON.stringify(result.failures)}`);
    assert.equal(result.findings.ledger.aptosReported, false);
  }
  record('synthetic-positive-modes', {modes: ['carlito-fixture/none', 'carlito-fixture/temporary-session', 'control-deck/none']});

  const aptosResult = await auditEvidenceDirectory(await buildEvidence({fonts: ['Carlito', 'Aptos']}));
  assert.equal(aptosResult.passed, true, JSON.stringify(aptosResult.failures));
  assert.deepEqual(aptosResult.findings.ledger.aptosPresentationFontNames, ['Aptos']);
  record('aptos-observation-is-a-finding-not-an-audit-failure');

  const negatives = [
    ['save-as-stage', state => { const at = state.stages.findIndex(row => row.stage === 'owned.presentation.fullName-before-close.get'); state.stages.splice(at, 0, {...state.stages[at], stage: 'owned.presentation.saveAs'}, {...state.stages[at + 1] ?? state.stages[at], stage: 'owned.presentation.saveAs', status: 'success'}); renumber(state); }, ['stage-forbidden', 'stage-count']],
    ['second-close', state => { const at = state.stages.findIndex(row => row.stage === 'owned.presentation.cleanup'); const pair = state.stages.filter(row => row.stage === 'owned.presentation.close').map(row => ({...row})); state.stages.splice(at, 0, ...pair); renumber(state); }, ['stage-close', 'stage-count']],
    ['second-open', state => { const at = state.stages.findIndex(row => row.stage === 'owned.presentation.fullName.get'); state.stages.splice(at, 0, {...state.stages[at], stage: 'input.presentation.open-writable', status: 'begin'}, {...state.stages[at], stage: 'input.presentation.open-writable', status: 'success'}); renumber(state); }, ['stage-open', 'stage-count']],
    ['not-read-only', state => { state.report.source.readOnly = 0; }, ['report-read-only', 'observation-read-only']],
    ['string-null-stage-error', state => { state.stages[3].error = ''; }, ['stage-record']],
    ['wrong-owned-path', state => { const row = state.stages.find(item => item.stage === 'owned.presentation.fonts.get'); row.ownedPresentationPath = path.join(os.tmpdir(), 'other.pptx'); }, ['stage-ownership']],
    ['missing-run-stage', state => { state.stages = state.stages.filter(row => row.stage !== 'owned.slide-1.shape-2.run-4.font.nameFarEast.get'); renumber(state); }, ['stage-count', 'stage-sequence']],
    ['forged-ledger', state => { state.report.presentationFonts = {count: 2, entries: [{index: 1, name: 'Carlito', embedded: 0, embeddable: -1}, {index: 2, name: 'Aptos', embedded: 0, embeddable: -1}]}; }, ['font-ledger']],
    ['bounds-exceeded', state => { state.report.boundsExceeded = ['slides']; }, ['report-complete']],
    ['two-owned-closes-reported', state => { state.report.ownedCloseCount = 2; }, ['report-lifecycle']],
    ['worker-timeout', state => { state.worker.timedOut = true; }, ['worker-outcome']],
    ['progress-mismatch', state => { state.progress = {...structuredClone(state.stages.at(-1)), stage: 'worker.failure', status: 'error'}; }, ['progress-outcome', 'stage-terminal']],
    ['saved-output-present', state => { state.extraFiles['native-font-inventory.pptx'] = Buffer.from('saved'); }, ['unexpected-output']],
    ['registration-without-temporary-mode', state => { state.registrations = PERMITTED_CARLITO_FIXTURE_FILES.map(file => ({file, sha256: PERMITTED_CARLITO_FIXTURE[file], added: 1, removed: true})); }, ['font-registration-absent', 'unexpected-output']],
    ['supervisor-summary-mismatch', state => { state.supervisor.aptosReported = true; }, ['supervisor-ledger']],
    ['bounds-changed', state => { state.request.bounds.maxRunsTotal = 4000; }, ['bounds']],
  ];
  for (const [name, mutate, expectedCodes] of negatives) {
    const result = await auditEvidenceDirectory(await buildEvidence({mutate}));
    const found = codes(result);
    assert.equal(result.passed, false, name);
    assert.ok(expectedCodes.some(code => found.has(code)), `${name}: ${[...found].join(',')}`);
  }
  const unremoved = await auditEvidenceDirectory(await buildEvidence({mode: 'temporary-session', mutate: state => { state.registrations[2].removed = false; }}));
  assert.ok(codes(unremoved).has('font-cleanup'));
  const controlWithFixture = await auditEvidenceDirectory(await buildEvidence({inputMode: 'control-deck', mode: 'temporary-session'}));
  assert.ok(codes(controlWithFixture).has('request-mode'));
  record('synthetic-lifecycle-ledger-stage-negatives', {count: negatives.length + 2});

  {
    const evidence = await buildEvidence();
    const snapshot = path.join(evidence, 'inputs', 'source.pptx'); const bytes = await readFile(snapshot);
    await writeFile(snapshot, Buffer.concat([bytes, Buffer.from([0])]));
    assert.ok(codes(await auditEvidenceDirectory(evidence)).has('input-hash'));
    await writeFile(snapshot, bytes);
    const verifierSnapshot = path.join(evidence, 'inputs', 'native-font-inventory.ps1');
    await writeFile(verifierSnapshot, verifierSource.replace('$script:presentation.Close()', '$script:presentation.SaveAs($x); $script:presentation.Close()'));
    const tampered = codes(await auditEvidenceDirectory(evidence));
    assert.ok(tampered.has('forbidden-member') && tampered.has('input-hash'));
    await writeFile(verifierSnapshot, verifierSource);
    await writeFile(path.join(evidence, 'worker.json'), 'false\n');
    assert.ok(codes(await auditEvidenceDirectory(evidence)).has('evidence-object'));
    record('directory-rejects-input-verifier-and-json-type-mutations');
  }

  {
    const evidence = await buildEvidence();
    const first = spawnSync(node, [auditCli, evidence], spawnOptions);
    assert.equal(first.status, 0, first.stderr || first.stdout);
    const auditBytes = await readFile(path.join(evidence, 'audit.json'));
    assert.equal(JSON.parse(auditBytes).passed, true);
    const second = spawnSync(node, [auditCli, evidence], spawnOptions);
    assert.notEqual(second.status, 0); assert.match(second.stderr, /Refusing to overwrite/);
    assert.equal(sha(await readFile(path.join(evidence, 'audit.json'))), sha(auditBytes));
    const missingArg = spawnSync(node, [auditCli], spawnOptions);
    assert.notEqual(missingArg.status, 0); assert.match(missingArg.stderr, /Usage/);
    const missingDir = spawnSync(node, [auditCli, path.join(scratch, 'missing')], spawnOptions);
    assert.notEqual(missingDir.status, 0); assert.match(missingDir.stderr, /does not exist/);
    record('cli-exclusive-create-audit');

    // --reaudit-v2 writes audit-v2.json beside the existing audit.json, never overwriting either.
    const reaudit = spawnSync(node, [auditCli, evidence, '--reaudit-v2'], spawnOptions);
    assert.equal(reaudit.status, 0, reaudit.stderr || reaudit.stdout);
    const v2 = JSON.parse(await readFile(path.join(evidence, 'audit-v2.json'), 'utf8'));
    assert.equal(v2.passed, true); assert.equal(v2.schemaVersion, AUDIT_SCHEMA_VERSION); assert.equal(v2.mode, 'reaudit-v2'); assert.equal(v2.reviewedVerifierRevision, 'current');
    assert.equal(v2.findings.ledger.emptyNameFontReported, false);
    assert.equal(sha(await readFile(path.join(evidence, 'audit.json'))), sha(auditBytes));
    const reauditAgain = spawnSync(node, [auditCli, evidence, '--reaudit-v2'], spawnOptions);
    assert.notEqual(reauditAgain.status, 0); assert.match(reauditAgain.stderr, /Refusing to overwrite/);
    // Only the re-audit mode tolerates an audit-v2.json in the evidence directory.
    assert.ok(codes(await auditEvidenceDirectory(evidence)).has('unexpected-output'), 'default mode must reject audit-v2.json');
    assert.equal((await auditEvidenceDirectory(evidence, {priorReviewedVerifiers: true})).passed, true);
    const unknownFlag = spawnSync(node, [auditCli, evidence, '--reaudit-v3'], spawnOptions);
    assert.notEqual(unknownFlag.status, 0); assert.match(unknownFlag.stderr, /Usage/);
    record('cli-reaudit-v2-exclusive-create');
  }

  {
    // A Presentation.Fonts entry with an empty Name (observed natively as {name:'',embedded:0,embeddable:0}) is a valid
    // observation and a finding; the name ledgers omit it exactly as the worker's ledger does.
    const empty = await auditEvidenceDirectory(await buildEvidence({fonts: ['Carlito', ''], mutate: state => { Object.assign(state.report.presentationFonts.entries[1], {embedded: 0, embeddable: 0}); }}));
    assert.equal(empty.passed, true, JSON.stringify(empty.failures));
    assert.equal(empty.findings.ledger.emptyNameFontReported, true);
    assert.deepEqual(empty.findings.ledger.emptyNamePresentationFontIndexes, [2]);
    assert.deepEqual(empty.findings.ledger.presentationFontNames, ['Carlito']);
    assert.deepEqual(emptyNameFontFindings({presentationFonts: {entries: [{index: 1, name: 'Carlito'}]}}), {emptyNamePresentationFontIndexes: [], emptyNameFontReported: false});
    const missingName = await auditEvidenceDirectory(await buildEvidence({fonts: ['Carlito', 'Aptos'], mutate: state => { state.report.presentationFonts.entries[1].name = null; }}));
    assert.ok(codes(missingName).has('observation-font-entry'));
    record('empty-name-font-entry-is-a-finding');
  }

  {
    // Prior reviewed verifier revisions bind only when explicitly enabled (the CLI's --reaudit-v2), and only by hash.
    assert.deepEqual(Object.values(PRIOR_REVIEWED_INVENTORY_VERIFIER_SHA256).sort(), ['ff-03-ef8a158-crlf', 'ff-03-ef8a158-lf']);
    const evidence = await buildEvidence();
    const newerRoot = path.join(scratch, 'newer-reviewed'); await mkdir(newerRoot);
    await writeFile(path.join(newerRoot, 'native-font-inventory.ps1'), `${verifierSource}\n# a newer reviewed revision\n`);
    for (const name of ['native-process.ps1', 'native-text-fonts.ps1']) await copyFile(path.join(root, name), path.join(newerRoot, name));
    assert.ok(codes(await auditEvidenceDirectory(evidence, {reviewedRoot: newerRoot})).has('reviewed-verifier-binding'));
    assert.ok(codes(await auditEvidenceDirectory(evidence, {reviewedRoot: newerRoot, priorReviewedVerifiers: true})).has('reviewed-verifier-binding'));
    const prior = await auditEvidenceDirectory(evidence, {reviewedRoot: newerRoot, priorReviewedVerifiers: {[sha(await readFile(verifier))]: 'control-prior'}});
    assert.equal(prior.passed, true, JSON.stringify(prior.failures)); assert.equal(prior.reviewedVerifierRevision, 'control-prior');
    record('prior-reviewed-verifier-binding-is-explicit');
  }

  // Windows: drive the real parent and worker end to end against the offline
  // object-model mock. The single ComObject construction is replaced in a
  // temporary copy; the copy is checked to contain no ComObject text before it
  // runs. Temporary font registration is never exercised here.
  if (process.platform === 'win32') {
    const harness = path.join(scratch, 'mock-harness'); await mkdir(harness);
    const needle = '(New-Object -ComObject PowerPoint.Application)';
    assert.equal(verifierSource.split(needle).length, 2, 'Expected exactly one ComObject construction to replace');
    const mocked = verifierSource.replace(needle, `$(. '${mockPath.replaceAll("'", "''")}'; New-OpfInventoryMockApplication)`);
    // The reviewed policy lists name the construction in string literals; the mock copy's code must not construct it.
    assert.doesNotMatch(stripPowerShellLiteralsForScan(mocked), /ComObject|PowerPoint\.Application/, 'Mock copy must not construct any COM object');
    // The mock line is never valid native evidence: it dot-sources a string path, calls an unreviewed command and
    // constructs no PowerPoint.Application, so exactly these three source-policy codes are expected.
    const mockCodes = ['com-construction', 'dynamic-code', 'forbidden-command'];
    assert.deepEqual([...new Set(auditInventoryVerifierSource(mocked).map(item => item.code))].sort(), mockCodes);
    await writeFile(path.join(harness, 'native-font-inventory.ps1'), mocked);
    for (const name of ['native-process.ps1', 'native-text-fonts.ps1']) await copyFile(path.join(root, name), path.join(harness, name));
    const fixtureDir = path.join(harness, 'fixture'); await mkdir(path.join(fixtureDir, 'fonts'), {recursive: true});
    const sourceBytes = Buffer.from('mock fixture source; never opened by Office');
    await writeFile(path.join(fixtureDir, 'source.pptx'), sourceBytes);
    await copyFile(path.join(carlitoRoot, 'LICENSE_FONT'), path.join(fixtureDir, 'LICENSE_FONT'));
    for (const [file, installed] of Object.entries(installedFaces)) await copyFile(path.join(carlitoRoot, installed), path.join(fixtureDir, file));
    await writeFile(path.join(fixtureDir, 'generation.json'), JSON.stringify({kind: 'native-font-edit-fixture', source: {file: 'source.pptx', sha256: sha(sourceBytes)}, registration: {flags: 0}, license: {file: 'LICENSE_FONT', spdx: 'OFL-1.1', sha256: PERMITTED_CARLITO_LICENSE_SHA256}, fonts: PERMITTED_CARLITO_FIXTURE_FILES.map(file => ({file, sha256: PERMITTED_CARLITO_FIXTURE[file]}))}, null, 2));
    await writeFile(path.join(harness, 'control.pptx'), Buffer.from('mock control deck; never opened by Office'));
    const runs = [
      ['fixture-without-fonts', ['-OutputDirectory', path.join(harness, 'run-fixture'), '-InputPresentation', path.join(fixtureDir, 'source.pptx'), '-FontFixtureDirectory', fixtureDir, '-WithoutTemporaryFonts'], 'carlito', false],
      ['control-deck', ['-ControlDeck', '-OutputDirectory', path.join(harness, 'run-control'), '-InputPresentation', path.join(harness, 'control.pptx')], 'carlito', false],
      ['fixture-aptos-variant', ['-OutputDirectory', path.join(harness, 'run-aptos'), '-InputPresentation', path.join(fixtureDir, 'source.pptx'), '-FontFixtureDirectory', fixtureDir, '-WithoutTemporaryFonts'], 'aptos', true],
      ['cloud-url-already-open', ['-ControlDeck', '-OutputDirectory', path.join(harness, 'run-cloud'), '-InputPresentation', path.join(harness, 'control.pptx')], 'cloud', false],
    ];
    const mockRun = (args, variant) => spawnSync(ps, ['-NoProfile', '-NonInteractive', '-File', path.join(harness, 'native-font-inventory.ps1'), ...args, '-TimeoutSeconds', '45'], {...spawnOptions, env: {...process.env, OPF_INVENTORY_MOCK_VARIANT: variant}});
    for (const [name, args, variant, expectAptos] of runs) {
      const child = mockRun(args, variant);
      assert.equal(child.status, 0, `${name}: ${child.stderr || child.stdout}`);
      const result = await auditEvidenceDirectory(args[args.indexOf('-OutputDirectory') + 1], {reviewedRoot: harness});
      assert.deepEqual([...codes(result)].sort(), mockCodes, `${name}: ${JSON.stringify(result.failures)}`);
      assert.equal(result.findings.ledger.aptosReported, expectAptos, name);
      assert.equal(result.findings.failureCleanup.applicable, false, name);
      if (variant === 'cloud') assert.equal(JSON.parse((await readFile(path.join(args[args.indexOf('-OutputDirectory') + 1], 'report.json'), 'utf8')).replace(/^\uFEFF/, '')).preflightPresentationCount, 1);
    }
    // Failures while the owned presentation is open: exactly one error close
    // only for a non-COM failure with the owned FullName; otherwise left open.
    const failureRuns = [
      ['non-com-failure-while-open', 'badcount', 'closed-owned-after-failure', true, 1],
      ['com-failure-while-open', 'comerror', 'left-open-com-latched', false, 0],
      ['opened-fullname-not-owned', 'wrongfullname', 'left-open-not-closed', false, 0],
    ];
    for (const [name, variant, outcome, cleanupConfirmed, closeInvocations] of failureRuns) {
      const out = path.join(harness, `run-${variant}`);
      const child = mockRun(['-ControlDeck', '-OutputDirectory', out, '-InputPresentation', path.join(harness, 'control.pptx')], variant);
      assert.notEqual(child.status, 0, `${name} must fail`);
      const result = await auditEvidenceDirectory(out, {reviewedRoot: harness});
      assert.equal(result.passed, false, name);
      const cleanup = result.findings.failureCleanup;
      assert.equal(cleanup.applicable, true, name); assert.ok(cleanup.outcome.startsWith(outcome), `${name}: ${cleanup.outcome}`);
      assert.equal(cleanup.consistent, true, `${name}: ${JSON.stringify(cleanup.problems)}`); assert.equal(cleanup.closeInvocations, closeInvocations, name);
      const report = JSON.parse((await readFile(path.join(out, 'report.json'), 'utf8')).replace(/^\uFEFF/, ''));
      assert.equal(report.cleanupConfirmed, cleanupConfirmed, name); assert.equal(report.ownedCloseCount, closeInvocations, name);
      const supervisor = JSON.parse((await readFile(path.join(out, 'supervisor.json'), 'utf8')).replace(/^\uFEFF/, ''));
      assert.equal(supervisor.passed, false, name);
    }
    const refused = spawnSync(ps, ['-NoProfile', '-NonInteractive', '-File', path.join(harness, 'native-font-inventory.ps1'), ...runs[1][1]], spawnOptions);
    assert.notEqual(refused.status, 0); assert.match(refused.stderr + refused.stdout, /fresh output directory/);
    const controlWithFonts = spawnSync(ps, ['-NoProfile', '-NonInteractive', '-File', path.join(harness, 'native-font-inventory.ps1'), '-ControlDeck', '-OutputDirectory', path.join(harness, 'run-control-2'), '-InputPresentation', path.join(harness, 'control.pptx'), '-FontFixtureDirectory', fixtureDir], spawnOptions);
    assert.notEqual(controlWithFonts.status, 0); assert.match(controlWithFonts.stderr + controlWithFonts.stdout, /control decks never register/);
    record('mock-object-model-end-to-end', {runs: [...runs.map(run => run[0]), ...failureRuns.map(run => run[0])], onlyExpectedFailures: 'com-construction, dynamic-code and forbidden-command from the mock construction line (mock copy is never valid native evidence)'});
  } else record('mock-object-model-end-to-end', {skipped: 'non-Windows runner'});
} finally {
  const resolved = path.resolve(scratch);
  if (resolved.startsWith(tempBase + path.sep)) await rm(resolved, {recursive: true, force: true});
}

const suite = {
  passed: outcomes.every(item => item.passed),
  scope: 'Offline controls for the read-only native font inventory: static read-only policy, pure regression, font ledger, synthetic evidence positives and negatives, exclusive-create CLI, and (Windows) the real parent/worker against an object-model mock. No Office, COM or font API was called.',
  node: process.version, verifier, verifierSha256: sha(Buffer.from(verifierSource)), checks: outcomes,
};
const reportPath = path.join(packageRoot, 'artifacts/native-font-inventory-controls.json');
await mkdir(path.dirname(reportPath), {recursive: true});
await writeFile(reportPath, JSON.stringify(suite, null, 2) + '\n');
console.log(JSON.stringify({passed: suite.passed, checks: outcomes.length, reportPath}));
process.exitCode = suite.passed ? 0 : 1;
