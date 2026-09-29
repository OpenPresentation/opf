import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PERMITTED_CARLITO_FIXTURE, PERMITTED_CARLITO_FIXTURE_FILES, PERMITTED_CARLITO_LICENSE_SHA256, stripPowerShellLiteralsForScan} from './native-font-embed-audit.mjs';
import {ALLOWED_COM_MEMBERS, ALLOWED_INSTANCE_MEMBERS, ALLOWED_STATIC_MEMBERS, analyzeFailureCleanup, AUDIT_SCHEMA_VERSION, auditEvidenceDirectory, auditInventoryVerifierSource, computeFontLedger, computeFontsComparison, emptyNameFontFindings, expectedInventoryStages, INVENTORY_ASSIGNMENT_ROOTS, INVENTORY_BOUNDS, invokedMembers, PRIOR_REVIEWED_INVENTORY_VERIFIER_SHA256, INVENTORY_SOURCE_POLICY} from './native-font-inventory-audit.mjs';
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
assert(auditInventoryVerifierSource(verifierSource.replace('[string]::Equals($key,$afterKeys[$i],[StringComparison]::Ordinal)', '[string]::Equals($key,$afterKeys[$i])')).some(item=>item.code==='unreviewed-form'),'Reject culture-default string Equals overload');
assert(auditInventoryVerifierSource(verifierSource.replace('[string]::Equals($_.name,\'\',[StringComparison]::Ordinal)', '[string]::Equals($_.name,\'\',[StringComparison]::OrdinalIgnoreCase)')).some(item=>item.code==='unreviewed-form'),'Reject non-exact empty-name comparison');
assert(auditInventoryVerifierSource(verifierSource+'\n$null=$font.Equals($other)\n').some(item=>item.code==='forbidden-member'),'Instance Equals remains denied');
record('comparison-ordinal-equals-invocations-pinned');

// Reading Presentation.HandoutMaster, NotesMaster or TitleMaster can create that master in memory, so no harness code path
// may access one; the three Has*Master getters are the only permitted reads. Literals and comments are stripped first.
{
  const masterObject = /\.\s*(?:HandoutMaster|NotesMaster|TitleMaster)\b/i;
  const scanned = [];
  for (const name of (await readdir(root)).filter(entry => entry.endsWith('.ps1')).sort()) {
    const code = stripPowerShellLiteralsForScan(await readFile(path.join(root, name), 'utf8'));
    assert.doesNotMatch(code, masterObject, `${name} must not access a master object`); scanned.push(name);
  }
  assert.ok(scanned.includes('native-font-inventory.ps1') && scanned.includes('native-font-inventory-mock.ps1') && scanned.includes('native-text-fonts.ps1'));
  const workerCode = stripPowerShellLiteralsForScan(verifierSource);
  assert.deepEqual([...workerCode.matchAll(/\$script:presentation\.(\w+Master)\b/g)].map(match => match[1]).filter(name => name !== 'SlideMaster'), ['HasHandoutMaster', 'HasNotesMaster', 'HasTitleMaster']);
  // The only raw (unstripped) occurrences are quoted pure-regression negative samples, never live code.
  const rawLines = verifierSource.split(/\r?\n/).filter(line => masterObject.test(line));
  assert.ok(rawLines.length > 0 && rawLines.every(line => /^\s+\w+='\$p=\$a\.Open\(\$x,-1,0,0\);/.test(line)), 'Raw master-object text must be confined to quoted negative samples');
  const withGetter = verifierSource + '\n$null=$script:presentation.HasNotesMaster\n';
  assert.deepEqual(auditInventoryVerifierSource(withGetter), [], 'Has*Master getter reads are permitted');
  for (const [name, line] of [['handout', '$null=$script:presentation.HandoutMaster'], ['notes', '$null=$script:presentation.NotesMaster'], ['title', '$null=$script:presentation.TitleMaster'], ['lowercase', '$null=$script:presentation.notesmaster'], ['spaced', '$null=$script:presentation. NotesMaster'], ['chained', '$null=$script:presentation.NotesMaster.Shapes.Count'], ['app-level', '$null=$app.ActivePresentation.HandoutMaster'], ['second-variable', '$p=$script:presentation; $null=$p.TitleMaster']]) {
    assert.ok(auditInventoryVerifierSource(`${verifierSource}\n${line}\n`).some(item => item.code === 'master-object-access'), name);
  }
  for (const [name, line] of [['string-named', "$null=$script:presentation.'NotesMaster'"], ['dynamic', '$null=$script:presentation.$name']]) assert.ok(auditInventoryVerifierSource(`${verifierSource}\n${line}\n`).length > 0, name);
  assert.deepEqual(auditInventoryVerifierSource(verifierSource + "\n# $p.NotesMaster in a comment\n$note='.HandoutMaster in a string'\n"), [], 'Comments and strings are not accesses');
  record('no-master-object-access-static', {scanned});
}

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
  for (const key of ['handoutMasterObject', 'notesMasterObject', 'titleMasterObject', 'stringNamedMasterObject', 'chainedMasterObject']) assert.equal(pure.policyNegativesRejected[key], true, key);
  assert.equal(pure.masterPresenceDecisionPassed, true);
  for (const key of ['masterPresenceMissing', 'masterPresenceTypesMissing', 'masterPresenceUnread', 'masterPresenceOutOfDomain', 'masterPresenceString', 'masterPresenceBoolean', 'masterPresenceNull', 'masterPresenceEmptyString', 'masterPresenceFraction', 'masterPresenceDoubleZero']) assert.ok(pure.parentDecisionNegativesRejected.includes(key), key);
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
async function buildEvidence({inputMode = 'carlito-fixture', mode = 'none', fonts = ['Carlito'], compareAfterContentFonts = false, afterEntries = null, recordMasterPresence = false, masterPresence = null, masterPresenceTypes = null, mutate = () => {}} = {}) {
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
    schemaVersion: 1, kind: 'native-font-inventory', inputMode, compareAfterContentFonts, recordMasterPresence, source: item(path.join(originals, 'source.pptx'), snapshot, sourceHash), fixture,
    verifier: helpers['native-font-inventory.ps1'], processHelper: helpers['native-process.ps1'], fontHelper: helpers['native-text-fonts.ps1'],
    fontRegistration, bounds: {...INVENTORY_BOUNDS}, scope: 'synthetic control',
  };
  const observed = observation({fonts});
  const report = {
    schemaVersion: 1, kind: 'native-font-inventory', inputMode, compareAfterContentFonts, recordMasterPresence,
    source: {path: request.source.path, sha256: sourceHash, snapshotPath: snapshot, snapshotSha256: sourceHash, fullName: snapshot, openedPathMatches: true, readOnly: -1, snapshotUnchangedAfterClose: true},
    fontRegistration, bounds: {...INVENTORY_BOUNDS}, ...observed, boundsExceeded: [], semanticFailures: [], fontLedger: null,
    preflightPresentationCount: 0, ownedOpenCount: 1, ownedCloseCount: 1, failureCleanup: null, environment: {powerPointVersion: 'synthetic'},
    cleanupConfirmed: true, officeOperationsStopped: false, lastStage: 'worker.complete', lastStatus: 'success', error: null,
  };
  report.fontLedger = {...computeFontLedger(report), scope: 'synthetic'};
  report.presentationFontsAfterContent = compareAfterContentFonts ? {count: (afterEntries ?? observed.presentationFonts.entries).length, entries: structuredClone(afterEntries ?? observed.presentationFonts.entries)} : null;
  report.fontQueryComparison = compareAfterContentFonts ? computeFontsComparison(report.presentationFonts, report.presentationFontsAfterContent) : null;
  report.masterPresence = recordMasterPresence ? structuredClone(masterPresence ?? {hasHandoutMaster: 0, hasNotesMaster: -1, hasTitleMaster: 0}) : null;
  report.masterPresenceTypes = recordMasterPresence ? structuredClone(masterPresenceTypes ?? {hasHandoutMaster: 'System.Int32', hasNotesMaster: 'System.Int32', hasTitleMaster: 'System.Int32'}) : null;
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
    timestamp: new Date(Date.parse(final.timestamp) + 1000).toISOString(), passed: true, timedOut: false, exitCode: 0, inputMode, compareAfterContentFonts, recordMasterPresence, fontRegistrationMode: mode,
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

  {
    const entry = (index, name, embedded = 0, embeddable = -1) => ({index, name, embedded, embeddable});
    const fonts = ['', 'Carlito', 'Carlito', 'Aptos'];
    const cases = [
      ['unchanged', null, 'unchanged', true],
      ['reordered-with-duplicates-and-empty', [entry(1, 'Aptos'), entry(2, 'Carlito'), entry(3, ''), entry(4, 'Carlito')], 'reordered', false],
      ['flags-only', fonts.map((name, i) => entry(i + 1, name, i === 1 ? -1 : 0)), 'changed', true],
      ['removed-duplicate', [entry(1, ''), entry(2, 'Carlito'), entry(3, 'Aptos')], 'changed', false],
      ['case-changed', [entry(1, ''), entry(2, 'carlito'), entry(3, 'Carlito'), entry(4, 'Aptos')], 'changed', false],
      ['cleared', [], 'changed', false],
    ];
    for (const [name, afterEntries, outcome, namesEqualInOrder] of cases) {
      const result = await auditEvidenceDirectory(await buildEvidence({inputMode: 'control-deck', fonts, compareAfterContentFonts: true, afterEntries}));
      assert.equal(result.passed, true, `${name}: ${JSON.stringify(result.failures)}`);
      assert.equal(result.findings.fontQueryComparison.outcome, outcome, name);
      assert.equal(result.findings.fontQueryComparison.namesEqualInOrder, namesEqualInOrder, name);
      assert.deepEqual(result.findings.fontQueryComparison.beforeEmptyNameIndexes, [1], name);
      assert.equal(result.findings.ledger.aptosReported, true, name);
    }
    const added = await auditEvidenceDirectory(await buildEvidence({inputMode: 'control-deck', compareAfterContentFonts: true, afterEntries: [entry(1, ''), entry(2, 'Aptos', 0, -1)]}));
    assert.equal(added.passed, true, JSON.stringify(added.failures));
    assert.equal(added.findings.ledger.aptosReported, false, 'First-snapshot ledger must remain unchanged');
    assert.equal(added.findings.fontQueryComparison.afterAptosReported, true);
    const empty = await auditEvidenceDirectory(await buildEvidence({fonts: [], compareAfterContentFonts: true, afterEntries: []}));
    assert.equal(empty.passed, true, JSON.stringify(empty.failures)); assert.equal(empty.findings.fontQueryComparison.outcome, 'unchanged');
    record('dual-snapshot-raw-comparison-findings', {cases: cases.map(item => item[0])});

    const negatives = [
      ['string-mode', s => { s.request.compareAfterContentFonts = 'true'; }, 'comparison-mode'],
      ['report-mode', s => { s.report.compareAfterContentFonts = false; }, 'comparison-mode'],
      ['supervisor-mode', s => { s.supervisor.compareAfterContentFonts = false; }, 'comparison-mode'],
      ['missing-mode', s => { delete s.request.compareAfterContentFonts; }, 'comparison-mode'],
      ['missing-second', s => { s.report.presentationFontsAfterContent = null; }, 'observation-fonts'],
      ['forged-comparison', s => { s.report.fontQueryComparison.outcome = 'changed'; }, 'font-query-comparison'],
      ['forged-before-ledger', s => { s.report.fontLedger.aptosReported = true; }, 'font-ledger'],
      ['forged-after-flags', s => { s.report.presentationFontsAfterContent.entries[0].embedded = -1; }, 'font-query-comparison'],
      ['second-overflow', s => { s.report.presentationFontsAfterContent.count = 65; s.report.presentationFontsAfterContent.entries = Array.from({length:65}, (_, i) => entry(i+1, 'Carlito')); }, 'observation-fonts'],
      ['second-incomplete', s => { s.report.presentationFontsAfterContent.entries = []; }, 'observation-fonts'],
      ['missing-second-stage', s => { s.stages = s.stages.filter(row => row.stage !== 'owned.presentation.fonts-after-content.item-1.embedded.get'); renumber(s); }, 'stage-sequence'],
      ['second-before-content', s => { const rows = s.stages.filter(row => row.stage.startsWith('owned.presentation.fonts-after-content')); s.stages = s.stages.filter(row => !row.stage.startsWith('owned.presentation.fonts-after-content')); const i = s.stages.findIndex(row => row.stage === 'owned.presentation.slideMaster.get'); s.stages.splice(i, 0, ...rows); renumber(s); }, 'stage-sequence'],
    ];
    for (const [name, mutate, code] of negatives) {
      const result = await auditEvidenceDirectory(await buildEvidence({inputMode:'control-deck', compareAfterContentFonts:true, mutate}));
      assert.equal(result.passed, false, name); assert(codes(result).has(code), `${name}: ${JSON.stringify(result.failures)}`);
    }
    const unavailable = [
      ['missing-second', s => { s.report.presentationFontsAfterContent = null; }, 'observation-fonts'],
      ['unknown-second-count', s => { s.report.presentationFontsAfterContent.count = null; }, 'observation-fonts'],
      ['partial-second', s => { s.report.presentationFontsAfterContent = {count: 2, entries: [entry(1, 'Carlito')]}; }, 'observation-fonts'],
      ['malformed-second-index', s => { s.report.presentationFontsAfterContent = {count: 1, entries: [entry(2, 'Carlito')]}; }, 'observation-font-entry'],
      ['malformed-second-name', s => { s.report.presentationFontsAfterContent = {count: 1, entries: [entry(1, null)]}; }, 'observation-font-entry'],
      ['malformed-second-flags', s => { s.report.presentationFontsAfterContent = {count: 1, entries: [entry(1, 'Carlito', '0')]}; }, 'observation-font-entry'],
      ['over-bound-second', s => { s.report.presentationFontsAfterContent = {count: 65, entries: Array.from({length: 65}, (_, i) => entry(i + 1, 'Carlito'))}; }, 'observation-fonts'],
      ['missing-first', s => { s.report.presentationFonts = null; }, 'observation-fonts'],
    ];
    for (const [name, mutate, code] of unavailable) {
      const result = await auditEvidenceDirectory(await buildEvidence({inputMode: 'control-deck', fonts: [], compareAfterContentFonts: true, mutate}));
      assert.equal(result.passed, false, name); assert(codes(result).has(code), `${name}: ${JSON.stringify(result.failures)}`);
      assert.equal(result.findings.fontQueryComparison, null, `${name}: incomplete observations must never imply unchanged`);
    }
    const completeFailed = await auditEvidenceDirectory(await buildEvidence({fonts: [], compareAfterContentFonts: true, mutate: s => { s.report.cleanupConfirmed = false; }}));
    assert.equal(completeFailed.passed, false); assert(codes(completeFailed).has('report-lifecycle'));
    assert.equal(completeFailed.findings.fontQueryComparison.outcome, 'unchanged', 'Complete raw collections retain a comparison when a separate lifecycle gate fails');
    record('comparison-findings-require-two-complete-valid-collections', {unavailable: unavailable.map(item => item[0]),completeFailedLifecycleRetainsComparison: true});
    const defaultExtra = await auditEvidenceDirectory(await buildEvidence({mutate:s => { s.report.presentationFontsAfterContent = structuredClone(s.report.presentationFonts); s.report.fontQueryComparison = computeFontsComparison(s.report.presentationFonts, s.report.presentationFontsAfterContent); }}));
    assert(codes(defaultExtra).has('comparison-absent'));
    const defaultMissing = await auditEvidenceDirectory(await buildEvidence({mutate:s => { delete s.request.compareAfterContentFonts; delete s.report.compareAfterContentFonts; delete s.supervisor.compareAfterContentFonts; delete s.report.presentationFontsAfterContent; delete s.report.fontQueryComparison; }}));
    assert(codes(defaultMissing).has('comparison-mode'), 'Current worker cannot use absent legacy mode');
    record('dual-snapshot-mode-observation-ledger-stage-negatives', {cases:negatives.map(item=>item[0])});
  }

  {
    // Opt-in master presence: raw Presentation.HasHandoutMaster/HasNotesMaster/HasTitleMaster msoTriState reads.
    const masterStage = /^owned\.presentation\.has(?:Handout|Notes|Title)Master\.get$/;
    const positives = [
      ['default-values', {}], ['all-true', {masterPresence: {hasHandoutMaster: -1, hasNotesMaster: -1, hasTitleMaster: -1}}],
      ['all-false', {masterPresence: {hasHandoutMaster: 0, hasNotesMaster: 0, hasTitleMaster: 0}}],
      ['int16-types', {masterPresenceTypes: {hasHandoutMaster: 'System.Int16', hasNotesMaster: 'System.Int16', hasTitleMaster: 'System.Int16'}}],
      ['with-comparison', {compareAfterContentFonts: true}], ['fixture-temporary-session', {inputMode: 'carlito-fixture', mode: 'temporary-session'}],
      ['empty-fonts-with-comparison', {fonts: [], compareAfterContentFonts: true, afterEntries: []}],
    ];
    for (const [name, options] of positives) {
      const result = await auditEvidenceDirectory(await buildEvidence({inputMode: 'control-deck', ...options, recordMasterPresence: true}));
      assert.equal(result.passed, true, `${name}: ${JSON.stringify(result.failures)}`);
      assert.deepEqual(result.findings.masterPresence, options.masterPresence ?? {hasHandoutMaster: 0, hasNotesMaster: -1, hasTitleMaster: 0}, name);
    }
    // Stage order implied by the observation: after every content and second-Fonts stage, immediately before the owned close.
    for (const compareAfterContentFonts of [false, true]) {
      const names = expectedInventoryStages({...observation(), preflightPresentationCount: 0, source: {readOnly: -1}, compareAfterContentFonts, presentationFontsAfterContent: compareAfterContentFonts ? observation().presentationFonts : null, recordMasterPresence: true, masterPresence: {hasHandoutMaster: 0, hasNotesMaster: -1, hasTitleMaster: 0}, masterPresenceTypes: {hasHandoutMaster: 'System.Int32', hasNotesMaster: 'System.Int32', hasTitleMaster: 'System.Int32'}}).map(([name, kind]) => [name, kind]);
      const list = names.map(item => item[0]), first = list.indexOf('owned.presentation.hasHandoutMaster.get');
      assert.deepEqual(list.slice(first, first + 4), ['owned.presentation.hasHandoutMaster.get', 'owned.presentation.hasNotesMaster.get', 'owned.presentation.hasTitleMaster.get', 'owned.presentation.fullName-before-close.get']);
      assert.ok(names.slice(first, first + 3).every(item => item[1] === 'pair'), 'each getter is its own begin/success pair');
      const lastContent = list.findLastIndex(name => /^owned\.(?:slide|slideMaster|presentation\.fonts-after-content)/.test(name) && !masterStage.test(name));
      assert.ok(lastContent === first - 1, `getters directly follow the last content or second-Fonts stage (${compareAfterContentFonts})`);
      if (compareAfterContentFonts) assert.ok(list.indexOf('owned.presentation.fonts-after-content.get') < first);
    }
    const moveMasterRows = (state, place) => { const rows = state.stages.filter(row => masterStage.test(row.stage)); state.stages = state.stages.filter(row => !masterStage.test(row.stage)); place(state, rows); renumber(state); };
    const insertBefore = (state, rows, stage) => state.stages.splice(state.stages.findIndex(row => row.stage === stage), 0, ...rows);
    const dropRows = (state, predicate) => { state.stages = state.stages.filter(row => !predicate(row)); renumber(state); };
    const negatives = [
      ['string-mode', s => { s.request.recordMasterPresence = 'true'; }, 'master-presence-mode'],
      ['report-mode', s => { s.report.recordMasterPresence = false; }, 'master-presence-mode'],
      ['supervisor-mode', s => { s.supervisor.recordMasterPresence = false; }, 'master-presence-mode'],
      ['missing-request-mode', s => { delete s.request.recordMasterPresence; }, 'master-presence-mode'],
      ['missing-supervisor-mode', s => { delete s.supervisor.recordMasterPresence; }, 'master-presence-mode'],
      ['value-one', s => { s.report.masterPresence.hasNotesMaster = 1; }, 'observation-master-presence'],
      ['value-two-handout', s => { s.report.masterPresence.hasHandoutMaster = 2; }, 'observation-master-presence'],
      ['value-minus-two', s => { s.report.masterPresence.hasTitleMaster = -2; }, 'observation-master-presence'],
      ['value-boolean', s => { s.report.masterPresence.hasNotesMaster = true; }, 'observation-master-presence'],
      ['value-string', s => { s.report.masterPresence.hasNotesMaster = '0'; }, 'observation-master-presence'],
      ['value-fraction', s => { s.report.masterPresence.hasNotesMaster = 0.5; }, 'observation-master-presence'],
      ['value-null', s => { s.report.masterPresence.hasTitleMaster = null; }, 'observation-master-presence'],
      ['missing-value', s => { delete s.report.masterPresence.hasTitleMaster; }, 'observation-master-presence'],
      ['extra-master-object-key', s => { s.report.masterPresence.notesMaster = {shapes: 0}; }, 'observation-master-presence'],
      ['missing-section', s => { s.report.masterPresence = null; }, 'observation-master-presence'],
      ['types-missing', s => { s.report.masterPresenceTypes = null; }, 'observation-master-presence'],
      ['types-key-missing', s => { delete s.report.masterPresenceTypes.hasTitleMaster; }, 'observation-master-presence'],
      ['types-extra-key', s => { s.report.masterPresenceTypes.notesMaster = 'System.Int32'; }, 'observation-master-presence'],
      ['type-double-with-integral-value', s => { s.report.masterPresenceTypes.hasNotesMaster = 'System.Double'; }, 'observation-master-presence'],
      ['type-string-with-integral-value', s => { s.report.masterPresenceTypes.hasHandoutMaster = 'System.String'; }, 'observation-master-presence'],
      ['type-boolean-with-integral-value', s => { s.report.masterPresenceTypes.hasTitleMaster = 'System.Boolean'; }, 'observation-master-presence'],
      ['type-null-with-integral-value', s => { s.report.masterPresenceTypes.hasNotesMaster = null; }, 'observation-master-presence'],
      ['type-int64', s => { s.report.masterPresenceTypes.hasNotesMaster = 'System.Int64'; }, 'observation-master-presence'],
      ['empty-string-value', s => { s.report.masterPresence.hasNotesMaster = ''; s.report.masterPresenceTypes.hasNotesMaster = 'System.String'; }, 'observation-master-presence'],
      ['null-value-null-type', s => { s.report.masterPresence.hasNotesMaster = null; s.report.masterPresenceTypes.hasNotesMaster = null; }, 'observation-master-presence'],
      ['missing-stage-pair', s => dropRows(s, row => row.stage === 'owned.presentation.hasNotesMaster.get'), 'stage-sequence'],
      ['missing-success-row', s => dropRows(s, row => row.stage === 'owned.presentation.hasTitleMaster.get' && row.status === 'success'), 'stage-sequence'],
      ['missing-all-stages', s => dropRows(s, row => masterStage.test(row.stage)), 'stage-sequence'],
      ['misordered-notes-title', s => moveMasterRows(s, (state, rows) => insertBefore(state, [...rows.slice(0, 2), ...rows.slice(4, 6), ...rows.slice(2, 4)], 'owned.presentation.fullName-before-close.get')), 'stage-sequence'],
      ['misordered-handout-last', s => moveMasterRows(s, (state, rows) => insertBefore(state, [...rows.slice(2, 6), ...rows.slice(0, 2)], 'owned.presentation.fullName-before-close.get')), 'stage-sequence'],
      ['duplicate-getter', s => { const at = s.stages.findIndex(row => row.stage === 'owned.presentation.hasNotesMaster.get'); s.stages.splice(at, 0, ...s.stages.slice(at, at + 2).map(row => ({...row}))); renumber(s); }, 'stage-count'],
      ['before-content', s => moveMasterRows(s, (state, rows) => insertBefore(state, rows, 'owned.presentation.slideMaster.get')), 'stage-sequence'],
      ['after-close', s => moveMasterRows(s, (state, rows) => insertBefore(state, rows, 'owned.presentation.cleanup')), 'stage-sequence'],
      ['between-fullname-and-close', s => moveMasterRows(s, (state, rows) => insertBefore(state, rows, 'owned.presentation.close')), 'stage-sequence'],
      ['master-object-stage', s => { const at = s.stages.findIndex(row => row.stage === 'owned.presentation.hasNotesMaster.get'); s.stages.splice(at, 0, {...s.stages[at], stage: 'owned.presentation.notesMaster.get', status: 'begin'}, {...s.stages[at], stage: 'owned.presentation.notesMaster.get', status: 'success'}); renumber(s); }, 'stage-count'],
    ];
    for (const [name, mutate, code] of negatives) {
      const result = await auditEvidenceDirectory(await buildEvidence({inputMode: 'control-deck', recordMasterPresence: true, mutate}));
      assert.equal(result.passed, false, name); assert.ok(codes(result).has(code), `${name}: ${JSON.stringify(result.failures)}`);
    }
    // With the comparison on, the getters follow the second Fonts snapshot, never precede it.
    const beforeSecond = await auditEvidenceDirectory(await buildEvidence({inputMode: 'control-deck', compareAfterContentFonts: true, recordMasterPresence: true, mutate: s => moveMasterRows(s, (state, rows) => insertBefore(state, rows, 'owned.presentation.fonts-after-content.get'))}));
    assert.equal(beforeSecond.passed, false); assert.ok(codes(beforeSecond).has('stage-sequence'));
    const offNegatives = [
      ['section-present-when-off', s => { s.report.masterPresence = {hasHandoutMaster: 0, hasNotesMaster: -1, hasTitleMaster: 0}; }, 'master-presence-absent'],
      ['empty-section-when-off', s => { s.report.masterPresence = {}; }, 'master-presence-absent'],
      ['types-present-when-off', s => { s.report.masterPresenceTypes = {hasHandoutMaster: 'System.Int32', hasNotesMaster: 'System.Int32', hasTitleMaster: 'System.Int32'}; }, 'master-presence-absent'],
      ['stages-present-when-off', s => { const at = s.stages.findIndex(row => row.stage === 'owned.presentation.fullName-before-close.get'); const rows = ['Handout', 'Notes', 'Title'].flatMap(kind => ['begin', 'success'].map(status => ({...s.stages[at], stage: `owned.presentation.has${kind}Master.get`, status}))); s.stages.splice(at, 0, ...rows); renumber(s); }, 'stage-count'],
      ['report-on-request-off', s => { s.report.recordMasterPresence = true; s.report.masterPresence = {hasHandoutMaster: 0, hasNotesMaster: -1, hasTitleMaster: 0}; }, 'master-presence-mode'],
      ['supervisor-on-request-off', s => { s.supervisor.recordMasterPresence = true; }, 'master-presence-mode'],
      ['string-off-mode', s => { s.request.recordMasterPresence = 'false'; }, 'master-presence-mode'],
      ['missing-report-mode-off', s => { delete s.report.recordMasterPresence; }, 'master-presence-mode'],
      ['missing-section-key-off', s => { delete s.report.masterPresence; }, 'master-presence-absent'],
    ];
    for (const [name, mutate, code] of offNegatives) {
      const result = await auditEvidenceDirectory(await buildEvidence({inputMode: 'control-deck', mutate}));
      assert.equal(result.passed, false, name); assert.ok(codes(result).has(code), `${name}: ${JSON.stringify(result.failures)}`);
    }
    const offClean = await auditEvidenceDirectory(await buildEvidence({inputMode: 'control-deck'}));
    assert.equal(offClean.passed, true); assert.equal(offClean.findings.masterPresence, null);
    assert.ok(!(await readFile(path.join(offClean.evidenceDirectory, 'stages.jsonl'), 'utf8')).trim().split(/\r?\n/).map(JSON.parse).some(row => masterStage.test(row.stage)), 'no getter stage when off');
    // A pinned prior verifier revision (before this switch) may omit the field everywhere; the current one may not.
    const legacyShape = s => { delete s.request.recordMasterPresence; delete s.report.recordMasterPresence; delete s.supervisor.recordMasterPresence; delete s.report.masterPresence; delete s.report.masterPresenceTypes; };
    const legacyRoot = path.join(scratch, 'legacy-reviewed'); await mkdir(legacyRoot);
    await writeFile(path.join(legacyRoot, 'native-font-inventory.ps1'), `${verifierSource}
# a newer reviewed revision
`);
    for (const name of ['native-process.ps1', 'native-text-fonts.ps1']) await copyFile(path.join(root, name), path.join(legacyRoot, name));
    const legacyEvidence = await buildEvidence({inputMode: 'control-deck', compareAfterContentFonts: true, mutate: legacyShape});
    assert.ok(codes(await auditEvidenceDirectory(legacyEvidence)).has('master-presence-mode'), 'current verifier requires the strict boolean');
    assert.ok(codes(await auditEvidenceDirectory(legacyEvidence, {reviewedRoot: legacyRoot, priorReviewedVerifiers: true})).has('master-presence-mode'), 'an unpinned verifier hash is never legacy');
    const legacy = await auditEvidenceDirectory(legacyEvidence, {reviewedRoot: legacyRoot, priorReviewedVerifiers: {[sha(await readFile(verifier))]: 'control-prior'}});
    assert.equal(legacy.passed, true, JSON.stringify(legacy.failures)); assert.equal(legacy.reviewedVerifierRevision, 'control-prior'); assert.equal(legacy.findings.masterPresence, null);
    const legacyWithSection = await buildEvidence({inputMode: 'control-deck', mutate: s => { legacyShape(s); s.report.masterPresence = {hasHandoutMaster: 0, hasNotesMaster: -1, hasTitleMaster: 0}; }});
    assert.ok(codes(await auditEvidenceDirectory(legacyWithSection, {reviewedRoot: legacyRoot, priorReviewedVerifiers: {[sha(await readFile(verifier))]: 'control-prior'}})).has('master-presence-absent'), 'legacy default cannot carry a section');
    record('master-presence-audit-modes-values-stage-order-negatives', {positives: positives.map(item => item[0]), negatives: negatives.map(item => item[0]), offNegatives: offNegatives.map(item => item[0]), legacyDefaultPinnedOnly: true});
  }

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
    assert.deepEqual(Object.values(PRIOR_REVIEWED_INVENTORY_VERIFIER_SHA256).sort(), ['ff-03-ef8a158-crlf', 'ff-03-ef8a158-lf', 'ff-05-357171a-crlf', 'ff-05-357171a-lf', 'ff-05-9a7f3c1-crlf', 'ff-05-9a7f3c1-lf']);
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
    const wrapper = 'try { $value=& $Operation;';
    assert.equal(verifierSource.split(wrapper).length,2,'Exactly one COM wrapper to instrument for terminating mock faults');
    const mocked = verifierSource.replace(needle, `$(. '${mockPath.replaceAll("'", "''")}'; New-OpfInventoryMockApplication)`)
      .replace(wrapper,"try { if($StageName -like 'owned.presentation.fonts-after-content*' -or $StageName -like 'owned.presentation.has*Master.get') { Invoke-OpfInventoryMockFault $StageName }; $value=& $Operation;");
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
    // Tripwire: the mock's HandoutMaster/NotesMaster/TitleMaster objects log any access; no run may touch them.
    const masterAccessLog = path.join(harness, 'master-object-access.log');
    const stagesOf = async out => (await readFile(path.join(out, 'stages.jsonl'), 'utf8')).replace(/^\uFEFF/, '').trim().split(/\r?\n/).map(JSON.parse);
    const isMasterStage = stage => /^owned\.presentation\.has(?:Handout|Notes|Title)Master\.get$/.test(stage);
    const runs = [
      ['fixture-without-fonts', ['-OutputDirectory', path.join(harness, 'run-fixture'), '-InputPresentation', path.join(fixtureDir, 'source.pptx'), '-FontFixtureDirectory', fixtureDir, '-WithoutTemporaryFonts'], 'carlito', false],
      ['control-deck', ['-ControlDeck', '-OutputDirectory', path.join(harness, 'run-control'), '-InputPresentation', path.join(harness, 'control.pptx')], 'carlito', false],
      ['fixture-aptos-variant', ['-OutputDirectory', path.join(harness, 'run-aptos'), '-InputPresentation', path.join(fixtureDir, 'source.pptx'), '-FontFixtureDirectory', fixtureDir, '-WithoutTemporaryFonts'], 'aptos', true],
      ['cloud-url-already-open', ['-ControlDeck', '-OutputDirectory', path.join(harness, 'run-cloud'), '-InputPresentation', path.join(harness, 'control.pptx')], 'cloud', false],
    ];
    const mockRun = (args, variant) => spawnSync(ps, ['-NoProfile', '-NonInteractive', '-File', path.join(harness, 'native-font-inventory.ps1'), ...args, '-TimeoutSeconds', '45'], {...spawnOptions, env: {...process.env, OPF_INVENTORY_MOCK_VARIANT: variant, OPF_INVENTORY_MOCK_MASTER_LOG: masterAccessLog}});
    for (const [name, args, variant, expectAptos] of runs) {
      const child = mockRun(args, variant);
      assert.equal(child.status, 0, `${name}: ${child.stderr || child.stdout}`);
      const result = await auditEvidenceDirectory(args[args.indexOf('-OutputDirectory') + 1], {reviewedRoot: harness});
      assert.deepEqual([...codes(result)].sort(), mockCodes, `${name}: ${JSON.stringify(result.failures)}`);
      assert.equal(result.findings.ledger.aptosReported, expectAptos, name);
      assert.equal(result.findings.failureCleanup.applicable, false, name);
      {
        const out = args[args.indexOf('-OutputDirectory') + 1];
        const defaultRequest = JSON.parse((await readFile(path.join(out, 'request.json'), 'utf8')).replace(/^\uFEFF/, '')), defaultReport = JSON.parse((await readFile(path.join(out, 'report.json'), 'utf8')).replace(/^\uFEFF/, '')), defaultSupervisor = JSON.parse((await readFile(path.join(out, 'supervisor.json'), 'utf8')).replace(/^\uFEFF/, ''));
        assert.equal(defaultRequest.recordMasterPresence, false, name); assert.equal(defaultReport.recordMasterPresence, false, name); assert.equal(defaultSupervisor.recordMasterPresence, false, name);
        assert.equal(defaultReport.masterPresence, null, name); assert.equal(result.findings.masterPresence, null, name);
        assert.ok(!(await stagesOf(out)).some(row => isMasterStage(row.stage) || /^owned\.presentation\.(?:handout|notes|title)master\./i.test(row.stage)), `${name}: default adds no master stage`);
      }
      if (variant === 'cloud') assert.equal(JSON.parse((await readFile(path.join(args[args.indexOf('-OutputDirectory') + 1], 'report.json'), 'utf8')).replace(/^\uFEFF/, '')).preflightPresentationCount, 1);
    }
    const parseFile = async (out, name) => JSON.parse((await readFile(path.join(out, name), 'utf8')).replace(/^\uFEFF/, ''));
    const dualCases = [
      ['dual-unchanged','unchanged'],['dual-changed','changed'],['dual-reordered','reordered'],['dual-flags','changed'],
      ['dual-soft-hyphen','changed'],['dual-composed','changed'],['dual-empty-ignorable','changed'],['dual-cleared','changed'],['dual-empty-both','unchanged'],
    ];
    for (const [variant, outcome] of dualCases) {
      const out = path.join(harness, `run-${variant}`);
      const args = ['-ControlDeck','-CompareAfterContentFonts','-OutputDirectory',out,'-InputPresentation',path.join(harness,'control.pptx')];
      const child = mockRun(args, variant); assert.equal(child.status,0, `${variant}: ${child.stderr || child.stdout}`);
      const result = await auditEvidenceDirectory(out,{reviewedRoot:harness});
      assert.deepEqual([...codes(result)].sort(),mockCodes,`${variant}: ${JSON.stringify(result.failures)}`);
      const report = await parseFile(out,'report.json');
      assert.equal(report.compareAfterContentFonts,true); assert.equal(report.fontQueryComparison.outcome,outcome,variant);
      assert.deepEqual(report.fontQueryComparison,computeFontsComparison(report.presentationFonts,report.presentationFontsAfterContent),variant);
      const {scope,...firstLedger}=report.fontLedger; assert.deepEqual(firstLedger,computeFontLedger(report),variant);
      assert.equal(report.ownedOpenCount,1); assert.equal(report.ownedCloseCount,1);
      if(variant==='dual-changed'){assert.equal(report.fontLedger.aptosReported,false);assert.equal(report.fontQueryComparison.afterAptosReported,true);}
      if(variant==='dual-flags')assert.equal(report.fontQueryComparison.namesEqualInOrder,true);
      if(variant==='dual-empty-ignorable'){assert.deepEqual(report.fontQueryComparison.beforeEmptyNameIndexes,[1]);assert.deepEqual(report.fontQueryComparison.afterEmptyNameIndexes,[]);}
      const conflict=spawnSync(ps,['-NoProfile','-NonInteractive','-File',path.join(out,'inputs/native-font-inventory.ps1'),'-Worker','-OutputDirectory',out,'-InputPresentation',path.join(out,'inputs/source.pptx')],spawnOptions);
      assert.notEqual(conflict.status,0); assert.match(conflict.stderr+conflict.stdout,/strict boolean request mode before Office startup/);
    }
    const defaultOut=path.join(harness,'run-dual-default');
    const defaultChild=mockRun(['-ControlDeck','-OutputDirectory',defaultOut,'-InputPresentation',path.join(harness,'control.pptx')],'dual-changed');
    assert.equal(defaultChild.status,0,defaultChild.stderr||defaultChild.stdout);
    const defaultReport=await parseFile(defaultOut,'report.json');assert.equal(defaultReport.compareAfterContentFonts,false);assert.equal(defaultReport.presentationFontsAfterContent,null);assert.equal(defaultReport.fontQueryComparison,null);
    const defaultStages=(await readFile(path.join(defaultOut,'stages.jsonl'),'utf8')).replace(/^\uFEFF/,'').trim().split(/\r?\n/).map(JSON.parse);
    assert(!defaultStages.some(row=>row.stage.includes('fonts-after-content')));
    record('mock-dual-snapshot-findings-and-unicode-ordinal-comparison',{cases:dualCases.map(row=>row[0]),defaultAddsNoStages:true,workerSwitchConflictRejected:true});

    // Inject at the existing wrapper try boundary: these test the error latch
    // and persisted observations, not native COM getter exception propagation.
    for(const suffix of ['get','count','item','name','embedded','embeddable']){
      const variant=`dual-${suffix}-error`,out=path.join(harness,`run-${variant}`);
      const child=mockRun(['-ControlDeck','-CompareAfterContentFonts','-OutputDirectory',out,'-InputPresentation',path.join(harness,'control.pptx')],variant);
      assert.notEqual(child.status,0,variant);
      const report=await parseFile(out,'report.json'),supervisor=await parseFile(out,'supervisor.json');
      assert.equal(report.officeOperationsStopped,true,variant);assert.equal(report.ownedCloseCount,0,variant);assert.equal(report.cleanupConfirmed,false,variant);assert.equal(supervisor.passed,false,variant);
      assert.equal(report.presentationFonts.count,1);assert.equal(report.presentationFonts.entries[0].name,'Carlito');assert(report.fontLedger,'Persist first ledger before second COM access');assert.equal(report.fontQueryComparison,null);
      const stages=(await readFile(path.join(out,'stages.jsonl'),'utf8')).replace(/^\uFEFF/,'').trim().split(/\r?\n/).map(JSON.parse);
      const failure=stages.findIndex(row=>row.status==='error'&&row.stage.includes('fonts-after-content'));
      assert(failure>=0,variant);assert.deepEqual(stages.slice(failure+1).map(row=>row.stage),['worker.failure'],variant);
      assert.equal(report.presentationFontsAfterContent.entries.length,['item','name','embedded','embeddable'].includes(suffix)?1:0,variant);
      assert.equal(analyzeFailureCleanup(report,stages).consistent,true,variant);
    }
    for(const variant of ['dual-overflow','dual-wrongfullname','dual-writable']){
      const out=path.join(harness,`run-${variant}`),child=mockRun(['-ControlDeck','-CompareAfterContentFonts','-OutputDirectory',out,'-InputPresentation',path.join(harness,'control.pptx')],variant);
      assert.notEqual(child.status,0,variant);const report=await parseFile(out,'report.json');
      if(variant==='dual-overflow'){assert.deepEqual(report.boundsExceeded,['presentationFontsAfterContent']);assert.equal(report.presentationFontsAfterContent.count,65);assert.equal(report.presentationFontsAfterContent.entries.length,0);assert.equal(report.ownedCloseCount,1);assert.equal(report.fontQueryComparison,null);assert(report.fontLedger);}
      if(variant==='dual-wrongfullname'){assert.equal(report.ownedCloseCount,0);assert.equal(report.cleanupConfirmed,false);}
      if(variant==='dual-writable'){assert(report.semanticFailures.includes('presentation-not-read-only'));assert.equal(report.presentationFontsAfterContent,null);}
    }
    record('mock-dual-snapshot-wrapper-error-latch-bounds-ownership',{wrapperInjectedStages:['get','count','item','name','embedded','embeddable'],other:['overflow','wrongfullname','writable'],firstSnapshotRetained:true});
    // Opt-in master presence against the offline mock: raw getters after the font snapshots, before the owned close.
    const presenceOf = (a, b, c) => ({hasHandoutMaster: a, hasNotesMaster: b, hasTitleMaster: c});
    const masterCases = [
      ['masters-default', 'carlito', false, presenceOf(0, -1, 0)],
      ['masters-all-true', 'masters-all-true', false, presenceOf(-1, -1, -1)],
      ['masters-with-comparison', 'dual-changed', true, presenceOf(0, -1, 0)],
      ['masters-with-empty-comparison', 'dual-empty-both', true, presenceOf(0, -1, 0)],
    ];
    for (const [name, variant, compare, values] of masterCases) {
      const out = path.join(harness, `run-${name}`);
      const args = ['-ControlDeck', ...(compare ? ['-CompareAfterContentFonts'] : []), '-RecordMasterPresence', '-OutputDirectory', out, '-InputPresentation', path.join(harness, 'control.pptx')];
      const child = mockRun(args, variant); assert.equal(child.status, 0, `${name}: ${child.stderr || child.stdout}`);
      const result = await auditEvidenceDirectory(out, {reviewedRoot: harness});
      assert.deepEqual([...codes(result)].sort(), mockCodes, `${name}: ${JSON.stringify(result.failures)}`);
      assert.deepEqual(result.findings.masterPresence, values, name);
      const request = await parseFile(out, 'request.json'), report = await parseFile(out, 'report.json'), supervisor = await parseFile(out, 'supervisor.json');
      assert.equal(request.recordMasterPresence, true, name); assert.equal(report.recordMasterPresence, true, name); assert.equal(supervisor.recordMasterPresence, true, name);
      assert.equal(request.compareAfterContentFonts, compare, name); assert.deepEqual(report.masterPresence, values, name);
      assert.ok(Object.values(report.masterPresence).every(value => Number.isInteger(value) && (value === 0 || value === -1)), name); assert.deepEqual(report.masterPresenceTypes, {hasHandoutMaster: 'System.Int32', hasNotesMaster: 'System.Int32', hasTitleMaster: 'System.Int32'}, name);
      assert.equal(report.ownedOpenCount, 1); assert.equal(report.ownedCloseCount, 1); assert.equal(supervisor.passed, true, name); assert.equal(supervisor.inventoryComplete, true, name);
      const stages = await stagesOf(out), names = stages.map(row => row.stage);
      const first = names.findIndex(isMasterStage);
      assert.deepEqual(stages.slice(first, first + 6).map(row => `${row.stage}/${row.status}`), ['Handout', 'Notes', 'Title'].flatMap(kind => ['begin', 'success'].map(status => `owned.presentation.has${kind}Master.get/${status}`)), name);
      assert.equal(names[first + 6], 'owned.presentation.fullName-before-close.get', name);
      assert.equal(names.filter(isMasterStage).length, 6, name);
      if (compare) { assert.ok(names.findLastIndex(stage => stage.startsWith('owned.presentation.fonts-after-content')) === first - 1, `${name}: getters follow the second Fonts snapshot`); }
      else assert.ok(names[first - 1].startsWith('owned.slideMaster.'), `${name}: getters follow the content queries`);
      const {scope, ...firstLedger} = report.fontLedger; assert.deepEqual(firstLedger, computeFontLedger(report), name);
    }
    // Strict boolean: the worker's direct switch must agree with the hashed request before Office startup, both ways.
    for (const [out, extra, label] of [[path.join(harness, 'run-masters-default'), [], 'request-on-switch-off'], [path.join(harness, 'run-dual-default'), ['-RecordMasterPresence'], 'request-off-switch-on']]) {
      const conflict = spawnSync(ps, ['-NoProfile', '-NonInteractive', '-File', path.join(out, 'inputs/native-font-inventory.ps1'), '-Worker', ...extra, '-OutputDirectory', out, '-InputPresentation', path.join(out, 'inputs/source.pptx')], {...spawnOptions, env: {...process.env, OPF_INVENTORY_MOCK_MASTER_LOG: masterAccessLog}});
      assert.notEqual(conflict.status, 0, label); assert.match(conflict.stderr + conflict.stdout, /master-presence switch must match the strict boolean request mode before Office startup/, label);
    }
    // A getter failing inside the owned presentation latches: no retry, no later getter, no close through the latch.
    const masterKinds = [['handout', 'hasHandoutMaster'], ['notes', 'hasNotesMaster'], ['title', 'hasTitleMaster']];
    for (const prefix of ['masters-', 'dual-masters-']) {
      for (const [offset, [kind, key]] of masterKinds.entries()) {
        const variant = `${prefix}${kind}-error`, out = path.join(harness, `run-${variant}`), compare = prefix.startsWith('dual-');
        const child = mockRun(['-ControlDeck', ...(compare ? ['-CompareAfterContentFonts'] : []), '-RecordMasterPresence', '-OutputDirectory', out, '-InputPresentation', path.join(harness, 'control.pptx')], variant);
        assert.notEqual(child.status, 0, variant);
        const report = await parseFile(out, 'report.json'), supervisor = await parseFile(out, 'supervisor.json'), stages = await stagesOf(out);
        assert.equal(report.officeOperationsStopped, true, variant); assert.equal(report.ownedCloseCount, 0, variant); assert.equal(report.cleanupConfirmed, false, variant); assert.equal(supervisor.passed, false, variant);
        assert.ok(report.fontLedger, `${variant}: first ledger is persisted before the getters`); assert.equal(report.presentationFonts.count, 1);
        if (compare) { assert.equal(report.presentationFontsAfterContent.count, 1); assert.ok(report.fontQueryComparison, `${variant}: comparison completed before the getters`); } else assert.equal(report.fontQueryComparison, null);
        const failure = stages.findIndex(row => row.status === 'error');
        assert.equal(stages[failure].stage, `owned.presentation.${key}.get`, variant);
        assert.deepEqual(stages.slice(failure + 1).map(row => row.stage), ['worker.failure'], `${variant}: nothing after the latched failure`);
        assert.equal(stages.filter(row => row.stage === stages[failure].stage).length, 2, `${variant}: begin and error only, no retry`);
        assert.deepEqual(stages.filter(row => isMasterStage(row.stage)).map(row => `${row.stage}/${row.status}`), masterKinds.slice(0, offset + 1).flatMap(([, name], index) => index < offset ? [`owned.presentation.${name}.get/begin`, `owned.presentation.${name}.get/success`] : [`owned.presentation.${name}.get/begin`, `owned.presentation.${name}.get/error`]), variant);
        assert.ok(!stages.some(row => /close|cleanup/.test(row.stage)), `${variant}: no close after the latch`);
        masterKinds.forEach(([, name], index) => assert.equal(report.masterPresence[name], index < offset ? (name === 'hasNotesMaster' ? -1 : 0) : null, `${variant} ${name}`));
        assert.equal(analyzeFailureCleanup(report, stages).consistent, true, variant);
        assert.equal((await auditEvidenceDirectory(out, {reviewedRoot: harness})).passed, false, variant);
      }
    }
    // A value outside msoTriState -1/0, or of a non-integral type, is recorded raw with its type (never coerced to 0), then
    // fails the run after the owned close with the distinct master-presence-out-of-domain failure.
    const rawCases = [
      ['masters-domain', 1, 'System.Int32'], ['masters-null', null, null], ['masters-empty-string', '', 'System.String'], ['masters-fraction', 0.5, 'System.Double'],
      ['masters-bool', true, 'System.Boolean'], ['masters-string', '0', 'System.String'], ['masters-double-zero', 0, 'System.Double'],
    ];
    for (const [variant, rawValue, rawType] of rawCases) {
      const out = path.join(harness, `run-${variant}`);
      const child = mockRun(['-ControlDeck', '-RecordMasterPresence', '-OutputDirectory', out, '-InputPresentation', path.join(harness, 'control.pptx')], variant);
      assert.notEqual(child.status, 0, `${variant}: out-of-domain value must fail`);
      const report = await parseFile(out, 'report.json'), supervisor = await parseFile(out, 'supervisor.json');
      assert.deepEqual(report.masterPresence, {hasHandoutMaster: 0, hasNotesMaster: rawValue, hasTitleMaster: 0}, variant);
      assert.deepEqual(report.masterPresenceTypes, {hasHandoutMaster: 'System.Int32', hasNotesMaster: rawType, hasTitleMaster: 'System.Int32'}, variant);
      assert.ok(report.semanticFailures.includes('master-presence-out-of-domain'), variant); assert.equal(report.ownedCloseCount, 1, variant);
      assert.equal(supervisor.passed, false, variant); assert.equal(supervisor.inventoryComplete, false, variant);
      const result = await auditEvidenceDirectory(out, {reviewedRoot: harness});
      assert.equal(result.passed, false, variant); assert.ok(codes(result).has('observation-master-presence') && codes(result).has('report-complete'), `${variant}: ${JSON.stringify(result.failures)}`);
      assert.equal(result.findings.masterPresence, null, `${variant}: out-of-domain values are never reported as findings`);
    }
    // An integral Int16 msoTriState is accepted and its type recorded.
    {
      const out = path.join(harness, 'run-masters-int16');
      const child = mockRun(['-ControlDeck', '-RecordMasterPresence', '-OutputDirectory', out, '-InputPresentation', path.join(harness, 'control.pptx')], 'masters-int16');
      assert.equal(child.status, 0, child.stderr || child.stdout);
      const report = await parseFile(out, 'report.json');
      assert.deepEqual(report.masterPresence, {hasHandoutMaster: 0, hasNotesMaster: -1, hasTitleMaster: 0}); assert.deepEqual(report.masterPresenceTypes, {hasHandoutMaster: 'System.Int32', hasNotesMaster: 'System.Int16', hasTitleMaster: 'System.Int32'});
      const result = await auditEvidenceDirectory(out, {reviewedRoot: harness});
      assert.deepEqual([...codes(result)].sort(), mockCodes, JSON.stringify(result.failures)); assert.equal(result.findings.masterPresenceTypes.hasNotesMaster, 'System.Int16');
    }
    // The tripwire is live: touching a master object in the mock does leave a record.
    {
      const probeLog = path.join(harness, 'tripwire-probe.log');
      const quote = value => value.replaceAll("'", "''");
      const probe = spawnSync(ps, ['-NoProfile', '-NonInteractive', '-Command', `$env:OPF_INVENTORY_MOCK_MASTER_LOG='${quote(probeLog)}'; . '${quote(mockPath)}'; $a=New-OpfInventoryMockApplication; $p=$a.Presentations.Open('x.pptx',-1,0,0); $null=$p.HasNotesMaster; $null=$p.NotesMaster; $null=$p.HandoutMaster; $null=$p.TitleMaster`], spawnOptions);
      assert.equal(probe.status, 0, probe.stderr || probe.stdout);
      assert.deepEqual((await readFile(probeLog, 'utf8')).split(/\r?\n/).filter(Boolean), ['NotesMaster', 'HandoutMaster', 'TitleMaster']);
    }
    record('mock-master-presence-order-values-latch-and-strict-boolean', {cases: masterCases.map(item => item[0]), errorInjection: ['handout', 'notes', 'title'].flatMap(kind => [`masters-${kind}-error`, `dual-masters-${kind}-error`]), outOfDomain: rawCases.map(item => item[0]), int16Accepted: true, strictBooleanBothWays: true, tripwireLive: true});

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
    assert.equal(existsSync(masterAccessLog), false, 'No mock run may access a HandoutMaster, NotesMaster or TitleMaster object');
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
