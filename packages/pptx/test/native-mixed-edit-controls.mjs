import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {appendFile, copyFile, mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  CHARACTER_PROBES, EDITED_RUNS, EDITED_TEXT, GEOMETRY_TOLERANCE_PT,
  ORIGINAL_RUNS, ORIGINAL_TEXT, OUTER_GEOMETRY_PT, PINNED_FONT_SHA256,
  PINNED_LICENSE_SHA256, PINNED_SOURCE_SHA256, auditMixedEditDirectory, auditMixedEditVerifierSource, MIXED_EDIT_COM_SETTERS,
  evaluateMixedEditReport, lineIntervals, previewLineBreakLimit,
} from './native-mixed-edit-audit.mjs';
import {MIXED_EDIT_SOURCE_POLICY} from './native-mixed-edit-audit.mjs';
import {assertSourcePolicyProbes} from './powershell-scan-probes.mjs';
import {readPowerShellPolicyLists} from './powershell-scan.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const testRoot = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(testRoot, '..');
const verifierPath = path.join(testRoot, 'native-mixed-edit.ps1');
const auditPath = path.join(testRoot, 'native-mixed-edit-audit.mjs');
const processHelperPath = path.join(testRoot, 'native-process.ps1');
const fontHelperPath = path.join(testRoot, 'native-text-fonts.ps1');
const sourceFixturePath = path.join(testRoot, 'fixtures', 'native-mixed-edit', 'source.pptx');
const carlitoRoot = path.join(packageRoot, 'node_modules', '@expo-google-fonts', 'carlito');
const carlitoSources = {
  'fonts/Carlito-400-normal.ttf': path.join(carlitoRoot, '400Regular', 'Carlito_400Regular.ttf'),
  'fonts/Carlito-400-italic.ttf': path.join(carlitoRoot, '400Regular_Italic', 'Carlito_400Regular_Italic.ttf'),
  'fonts/Carlito-700-normal.ttf': path.join(carlitoRoot, '700Bold', 'Carlito_700Bold.ttf'),
  'fonts/Carlito-700-italic.ttf': path.join(carlitoRoot, '700Bold_Italic', 'Carlito_700Bold_Italic.ttf'),
};
const KNOWN_NATIVE = [[0, 92], [92, 194], [194, 245]];
const PREVIEW = [[0, 78], [78, 172], [172, 245]];
const bounds = (left = 10, top = 20, width = 30, height = 12) => ({left, top, width, height});

assert.equal(process.versions.node.split('.')[0], '24', 'Native mixed-size edit controls require Node 24.');
assert.equal(GEOMETRY_TOLERANCE_PT, 0.02);
assert.equal(ORIGINAL_TEXT.length, 245);
assert.equal(EDITED_TEXT.length, 245);

function expectations() {
  return {
    tolerancePoints: 0.02,
    outerGeometryPt: structuredClone(OUTER_GEOMETRY_PT),
    previewLineBreakLimit: {failsHarness: false, knownReadOnlyNativeIntervals: KNOWN_NATIVE, estimatedPreviewIntervals: PREVIEW},
    original: {text: ORIGINAL_TEXT, length: 245, runs: structuredClone(ORIGINAL_RUNS), characterProbes: structuredClone(CHARACTER_PROBES)},
    edited: {text: EDITED_TEXT, length: 245, runs: structuredClone(EDITED_RUNS), characterProbes: structuredClone(CHARACTER_PROBES)},
  };
}

function linesFromIntervals(text, intervals) {
  return {
    count: intervals.length,
    capturedCount: intervals.length,
    records: intervals.map(([start, end], index) => ({index: index + 1, text: text.slice(start, end), start: start + 1, length: end - start, bounds: bounds(11, 20 + index * 30, 500, 28)})),
  };
}

function observation({phase, text, runs, readOnly, intervals = KNOWN_NATIVE}) {
  const geometry = {left: OUTER_GEOMETRY_PT.left, top: OUTER_GEOMETRY_PT.top, width: OUTER_GEOMETRY_PT.width, height: OUTER_GEOMETRY_PT.height};
  return {
    phase, readOnly, slideCount: 1, shapeCount: 1,
    slideWidth: OUTER_GEOMETRY_PT.slideWidth, slideHeight: OUTER_GEOMETRY_PT.slideHeight,
    shape: {name: 'OPF table 1', type: 19, hasTable: -1, geometry: {...geometry}},
    table: {rowCount: 1, columnCount: 1, rowHeight: OUTER_GEOMETRY_PT.rowHeight, columnWidth: OUTER_GEOMETRY_PT.columnWidth},
    cell: {
      geometry: {...geometry},
      whole: {text, start: 1, length: text.length, bounds: bounds(50, 50, 850, 90), font: {name: 'Carlito', size: 18, bold: -2, italic: 0}},
      runs: runs.map((run, index) => ({text: run.text, start: run.start, length: run.length, bounds: bounds(50 + index * 20, 50, 100, 30), font: {name: 'Carlito', size: run.size, bold: run.bold ? -1 : 0, italic: 0}})),
      characters: CHARACTER_PROBES.map(probe => {
        const run = runs.find(candidate => probe.position >= candidate.start && probe.position < candidate.start + candidate.length);
        return {text: probe.text, start: probe.position, length: 1, position: probe.position, purpose: probe.purpose, bounds: bounds(50 + probe.position, 50, 8, 20), font: {name: 'Carlito', size: run.size, bold: run.bold ? -1 : 0, italic: 0}};
      }),
      paragraph: {count: 1, explicitTabStopCount: 0},
      lines: linesFromIntervals(text, intervals),
    },
  };
}

function reportSkeleton(overrides = {}) {
  const saved = 'a'.repeat(64);
  return {
    schemaVersion: 1, kind: 'native-mixed-edit', cleanupConfirmed: true,
    officeOperationsStopped: false, lastStage: 'worker.complete', lastStatus: 'success', error: null,
    source: {sha256: PINNED_SOURCE_SHA256, snapshotSha256: PINNED_SOURCE_SHA256, unchanged: true, snapshotUnchanged: true},
    saved: {sha256: saved},
    original: {observation: observation({phase: 'original', text: ORIGINAL_TEXT, runs: ORIGINAL_RUNS, readOnly: 0})},
    edited: {observation: observation({phase: 'edited', text: EDITED_TEXT, runs: EDITED_RUNS, readOnly: 0})},
    reopened: {sha256: saved, observation: observation({phase: 'reopened', text: EDITED_TEXT, runs: EDITED_RUNS, readOnly: -1})},
    requested: expectations(),
    metrics: {evaluatedBy: 'test/native-mixed-edit-audit.mjs', gatePassed: null, tolerancePoints: 0.02, previewLineBreakLimitFailsHarness: false},
    ...overrides,
  };
}

const outcomes = [];
function check(name, fn) { fn(); outcomes.push({name, passed: true}); }
async function checkAsync(name, fn) { await fn(); outcomes.push({name, passed: true}); }
function expectFailure(report, code) {
  const result = evaluateMixedEditReport(report);
  assert.equal(result.passed, false, `${code} mutation unexpectedly passed`);
  assert.ok(result.failures.some(failure => failure.code === code), JSON.stringify(result.failures));
}

check('valid-evaluator-and-recorded-preview-limit', () => {
  const result = evaluateMixedEditReport(reportSkeleton());
  assert.equal(result.passed, true, JSON.stringify(result.failures));
  assert.equal(result.previewLineBreakLimit.failsHarness, false);
  assert.equal(result.previewLineBreakLimit.observedMatchesPreviewEstimate, false);
  assert.deepEqual(lineIntervals(reportSkeleton().original.observation), KNOWN_NATIVE);
});
check('preview-matching-intervals-also-pass', () => {
  const value = reportSkeleton();
  value.original.observation.cell.lines = linesFromIntervals(ORIGINAL_TEXT, PREVIEW);
  value.edited.observation.cell.lines = linesFromIntervals(EDITED_TEXT, PREVIEW);
  value.reopened.observation.cell.lines = linesFromIntervals(EDITED_TEXT, PREVIEW);
  const result = evaluateMixedEditReport(value);
  assert.equal(result.passed, true, JSON.stringify(result.failures));
  assert.equal(result.previewLineBreakLimit.observedMatchesPreviewEstimate, true);
});
check('edited-wrap-may-differ-from-prior-readonly-but-must-persist', () => {
  const value = reportSkeleton(), changed = [[0, 100], [100, 200], [200, 245]];
  value.edited.observation.cell.lines = linesFromIntervals(EDITED_TEXT, changed);
  value.reopened.observation.cell.lines = linesFromIntervals(EDITED_TEXT, changed);
  assert.equal(evaluateMixedEditReport(value).passed, true);
});
check('content-style-and-probe-style-mutations-fail', () => {
  const content = reportSkeleton(); content.edited.observation.cell.whole.text = 'changed'; expectFailure(content, 'content');
  const style = reportSkeleton(); style.edited.observation.cell.runs[1].font.size = 18; expectFailure(style, 'style');
  const probe = reportSkeleton(); probe.edited.observation.cell.characters[2].font.bold = 0; expectFailure(probe, 'style');
  const probeSize = reportSkeleton(); probeSize.edited.observation.cell.characters[2].font.size = 18; expectFailure(probeSize, 'style');
  const whole = reportSkeleton(); whole.edited.observation.cell.whole.font.bold = 0; expectFailure(whole, 'style');
});
check('finite-geometry-and-0.02-boundary', () => {
  const edge = reportSkeleton(); edge.edited.observation.shape.geometry.width += 0.02; assert.equal(evaluateMixedEditReport(edge).passed, true);
  const beyond = reportSkeleton(); beyond.edited.observation.shape.geometry.width += 0.021; expectFailure(beyond, 'geometry');
  const missing = reportSkeleton(); delete missing.edited.observation.shape.geometry.left; expectFailure(missing, 'geometry');
  const string = reportSkeleton(); string.edited.observation.shape.geometry.left = '43.2'; expectFailure(string, 'geometry');
});
check('line-capture-and-complete-coverage-fail-closed', () => {
  const missing = reportSkeleton(); delete missing.edited.observation.cell.lines.records; expectFailure(missing, 'line-capture');
  const gap = reportSkeleton(); gap.edited.observation.cell.lines.records[1].start += 1; expectFailure(gap, 'line-coverage');
  const text = reportSkeleton(); text.edited.observation.cell.lines.records[0].text = 'wrong'; expectFailure(text, 'line-coverage');
  const capture = reportSkeleton(); capture.edited.observation.cell.lines.capturedCount = 2; expectFailure(capture, 'line-capture');
  const persisted = reportSkeleton(); persisted.reopened.observation.cell.lines = linesFromIntervals(EDITED_TEXT, PREVIEW); expectFailure(persisted, 'line-persistence');
});
check('lifecycle-and-tolerance-fail-closed', () => {
  const stopped = reportSkeleton(); delete stopped.officeOperationsStopped; expectFailure(stopped, 'office-stopped');
  const cleanup = reportSkeleton({cleanupConfirmed: false}); expectFailure(cleanup, 'cleanup');
  const tolerance = reportSkeleton(); tolerance.requested.tolerancePoints = 0.1; expectFailure(tolerance, 'tolerance-relaxed');
});
check('recorded-limit-helper-does-not-claim-preview-parity', () => {
  const limit = previewLineBreakLimit(KNOWN_NATIVE);
  assert.equal(limit.failsHarness, false); assert.equal(limit.observedMatchesPreviewEstimate, false);
});

const verifierSource = await readFile(verifierPath, 'utf8');
const auditSource = await readFile(auditPath, 'utf8');
check('verifier-ast-requires-explicit-no-embed-save', () => {
  assert.match(verifierSource, /function Assert-MixedEditVerifierAst/);
  assert.match(verifierSource, /SaveAs\(\$savedPath,24,0\)/);
  assert.match(verifierSource, /argumentCount -ne 3/);
  assert.match(verifierSource, /embed -ne 0/);
  assert.match(auditSource, /GEOMETRY_TOLERANCE_PT = 0\.02/);
});

// Dynamic code is allowed only as the pure regression's exact re-evaluation of its two extracted helpers.
const workerAnchor = 'function Get-MixedEditSha256(';
const pureAnchor = '        Invoke-Expression $comDefinition[0].Extent.Text';
const withWorker = line => verifierSource.replace(workerAnchor, `function Invoke-MixedEditForbiddenDynamic($Text) { ${line} }\r\n${workerAnchor}`);
const withPure = line => verifierSource.replace(pureAnchor, `${pureAnchor}\r\n        ${line}`);
const IEX_MESSAGE = /must not run Invoke-Expression, iex or Add-Type/, DYNAMIC_MESSAGE = /harness must not (use dynamic code|use|run|invoke|reference|pass)/;
const dynamicCodeNegatives = [
  ['worker-invoke-expression', withWorker('Invoke-Expression $Text'), IEX_MESSAGE],
  ['worker-iex', withWorker('iex $Text'), IEX_MESSAGE],
  ['worker-qualified-invoke-expression', withWorker('Microsoft.PowerShell.Utility\\Invoke-Expression $Text'), IEX_MESSAGE],
  ['worker-string-named-iex', withWorker("& 'iex' $Text"), IEX_MESSAGE],
  ['worker-add-type', withWorker('Add-Type -TypeDefinition $Text'), IEX_MESSAGE],
  ['pure-other-argument', withPure('Invoke-Expression $script:payload'), IEX_MESSAGE],
  ['pure-iex-alias', withPure('iex $stageDefinition[0].Extent.Text'), IEX_MESSAGE],
  ['pure-add-type', withPure('Add-Type -TypeDefinition $script:payload'), IEX_MESSAGE],
  // Other dynamic code, and non-literal & / . targets outside the exact COM-wrapper and helper dot-source sites.
  ['worker-scriptblock-create', withWorker('$null=[scriptblock]::Create($Text)'), DYNAMIC_MESSAGE],
  ['worker-qualified-scriptblock-create', withWorker('$null=[System.Management.Automation.ScriptBlock]::Create($Text)'), DYNAMIC_MESSAGE],
  ['worker-invoke-script', withWorker('$null=$Host.Runspace.InvokeScript($Text)'), DYNAMIC_MESSAGE],
  ['worker-execution-context', withWorker('$null=$ExecutionContext.SessionState'), DYNAMIC_MESSAGE],
  ['worker-invoke-command', withWorker('Invoke-Command -ScriptBlock $Text'), DYNAMIC_MESSAGE],
  ['worker-icm', withWorker('icm -ScriptBlock $Text'), DYNAMIC_MESSAGE],
  ['worker-call-variable', withWorker('& $Text'), DYNAMIC_MESSAGE],
  ['worker-dot-variable', withWorker('. $Text'), DYNAMIC_MESSAGE],
  ['worker-call-expression', withWorker('& (Get-Command $Text)'), DYNAMIC_MESSAGE],
  ['operation-outside-com-wrapper', withWorker('& $Operation'), DYNAMIC_MESSAGE],
  ['helper-dot-source-inside-function', withWorker('. $processSnapshot'), DYNAMIC_MESSAGE],
  ['helper-called-not-dot-sourced', withWorker('& $fontHelperSnapshot'), DYNAMIC_MESSAGE],
  ['worker-dynamic-member', withWorker('$null=$Text.$Name()'), DYNAMIC_MESSAGE],
];
check('verifier-node-source-policy', () => {
  assert.ok(verifierSource.includes(workerAnchor) && verifierSource.includes(pureAnchor));
  assert.deepEqual(auditMixedEditVerifierSource(verifierSource), []);
  assert.deepEqual(MIXED_EDIT_COM_SETTERS, ['runRange.Text']);
  const codes = text => new Set(auditMixedEditVerifierSource(text).map(item => item.code));
  for (const [name, text] of dynamicCodeNegatives) { assert.notEqual(text, verifierSource, name); assert.ok(codes(text).has('dynamic-code'), name); }
  for (const [name, line] of [
    ['font-name-set', "$runRange.Font.Name='Aptos'"],
    ['other-range-text', "$cell.Shape.TextFrame.TextRange.Text='x'"],
    ['application-visible', '$app.Visible=0'],
    ['saved-flag', '$script:presentation.Saved=-1'],
    ['setter-method', '$runRange.set_Text($x)'],
    ['increment', '$shape.Top++'],
  ]) assert.ok(codes(`${verifierSource}\r\n${line}\r\n`).has('com-property-assignment'), name);
  for (const [name, line] of [['comment', "# $runRange.Font.Name='Aptos' it's"], ['string', "$n='$app.Visible=0'"], ['local-report', '$report.extra=1'], ['documented-setter', "$runRange.Text='x'"]]) {
    assert.deepEqual(auditMixedEditVerifierSource(`${verifierSource}\r\n${line}\r\n`), [], name);
  }
  assert.ok(codes(`${verifierSource}\r\n# it's\r\n$app.Quit()\r\n`).has('application-quit'));
  assert.ok(codes(verifierSource.replace('{ $script:presentation.SaveAs($savedPath,24,0) }', '{ $script:presentation.SaveAs($savedPath,24,-1) }')).has('save-policy'));
});
if (process.platform === 'win32') {
  const ps = path.join(process.env.WINDIR ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const psOptions = {cwd: packageRoot, encoding: 'utf8', maxBuffer: 1024 * 1024, timeout: 180_000, windowsHide: true};
  const astRoot = await mkdtemp(path.join(path.resolve(os.tmpdir()), 'opf-mixed-edit-ast-'));
  try {
    const positive = spawnSync(ps, ['-NoProfile', '-NonInteractive', '-File', verifierPath, '-PureRegression'], psOptions);
    assert.equal(positive.status, 0, positive.error?.message ?? (positive.stderr || positive.stdout));
    for (const [name, text, message] of dynamicCodeNegatives) {
      const copy = path.join(astRoot, `${name}.ps1`); await writeFile(copy, text);
      const negative = spawnSync(ps, ['-NoProfile', '-NonInteractive', '-File', copy, '-PureRegression'], psOptions);
      assert.ok(!negative.error && negative.status !== null && negative.status !== 0, `${name}: ${negative.error?.message ?? negative.status}`);
      // PowerShell wraps error records at the console width, so compare with all whitespace removed.
      assert.match((negative.stderr + negative.stdout).replace(/\s+/g, ''), new RegExp(message.source.replace(/ /g, '')), name);
    }
  } finally { await rm(astRoot, {recursive: true, force: true}); }
  outcomes.push({name: 'verifier-ast-dynamic-code-negatives', passed: true});
} else outcomes.push({name: 'verifier-ast-dynamic-code-negatives', passed: true, skipped: 'non-Windows runner'});

// The Node allowlist policy and the harness's $script:MixedEditPolicy* lists (enforced by its PowerShell AST check) are
// one reviewed allowlist; every independent-review probe is rejected by both layers.
{
  const lists = readPowerShellPolicyLists(verifierSource, 'MixedEdit');
  for (const [key, value] of Object.entries(lists)) assert.deepEqual(value, [...MIXED_EDIT_SOURCE_POLICY[key]], `MixedEditPolicy ${key} parity`);
  const probes = await assertSourcePolicyProbes({source: verifierSource, audit: auditMixedEditVerifierSource, harnessPath: verifierPath, assertFunction: 'Assert-MixedEditVerifierAst', positives: [], names: {com: 'Invoke-MixedEditCom', pure: 'Invoke-MixedEditPureRegression'}});
  outcomes.push({name: 'source-policy-allowlist-parity-and-review-probes', passed: true, probes});
}

function stage(sequence, name, status, ownedPresentationPath, cleanupConfirmed, seconds) {
  return {sequence, timestamp: new Date(Date.UTC(2026, 8, 22, 12, 0, seconds)).toISOString(), stage: name, status, error: null, cleanupConfirmed, officeOperationsStopped: false, ownedPresentationPath};
}

async function makeEvidence(parent, name, mutate = null) {
  const root = path.join(parent, name), inputs = path.join(root, 'inputs'), fonts = path.join(inputs, 'fonts');
  await mkdir(fonts, {recursive: true});
  const externalSource = path.join(root, 'external-source.pptx');
  const sourceSnapshot = path.join(inputs, 'source.pptx');
  const savedPath = path.join(root, 'native-mixed-edit.pptx');
  const originalPng = path.join(root, 'original.png'), editedPng = path.join(root, 'edited.png'), reopenedPng = path.join(root, 'reopened.png');
  await copyFile(sourceFixturePath, externalSource); await copyFile(sourceFixturePath, sourceSnapshot); await copyFile(sourceFixturePath, savedPath);
  await copyFile(path.join(testRoot, 'fixtures', 'images', 'wide.png'), originalPng);
  await copyFile(path.join(testRoot, 'fixtures', 'images', 'tall.png'), editedPng);
  await copyFile(path.join(testRoot, 'fixtures', 'images', 'square.png'), reopenedPng);
  await copyFile(verifierPath, path.join(inputs, 'native-mixed-edit.ps1'));
  await copyFile(processHelperPath, path.join(inputs, 'native-process.ps1'));
  await copyFile(fontHelperPath, path.join(inputs, 'native-text-fonts.ps1'));
  await copyFile(path.join(carlitoRoot, 'LICENSE_FONT'), path.join(inputs, 'LICENSE_FONT'));
  for (const [font, source] of Object.entries(carlitoSources)) await copyFile(source, path.join(inputs, ...font.split('/')));
  const readHash = async file => sha(await readFile(file));
  assert.equal(await readHash(sourceFixturePath), PINNED_SOURCE_SHA256);
  assert.equal(await readHash(path.join(inputs, 'LICENSE_FONT')), PINNED_LICENSE_SHA256);
  for (const [font, expected] of Object.entries(PINNED_FONT_SHA256)) assert.equal(await readHash(path.join(inputs, ...font.split('/'))), expected);
  const generation = {registration: {flags: 0}, fonts: Object.entries(PINNED_FONT_SHA256).map(([file, sha256]) => ({file, sha256}))};
  const request = {
    source: {path: externalSource, sha256: PINNED_SOURCE_SHA256, snapshotPath: sourceSnapshot, snapshotSha256: PINNED_SOURCE_SHA256},
    verifier: {path: verifierPath, sha256: await readHash(verifierPath), snapshotPath: path.join(inputs, 'native-mixed-edit.ps1'), snapshotSha256: await readHash(verifierPath)},
    processHelper: {path: processHelperPath, sha256: await readHash(processHelperPath), snapshotPath: path.join(inputs, 'native-process.ps1'), snapshotSha256: await readHash(processHelperPath)},
    fontHelper: {path: fontHelperPath, sha256: await readHash(fontHelperPath), snapshotPath: path.join(inputs, 'native-text-fonts.ps1'), snapshotSha256: await readHash(fontHelperPath), registrationFlags: 0},
    expectations: expectations(),
  };
  const savedHash = await readHash(savedPath);
  const original = reportSkeleton().original, edited = reportSkeleton().edited, reopened = reportSkeleton().reopened;
  const report = reportSkeleton({
    source: {path: externalSource, sha256: PINNED_SOURCE_SHA256, snapshotPath: sourceSnapshot, snapshotSha256: PINNED_SOURCE_SHA256, unchanged: true, snapshotUnchanged: true},
    saved: {path: savedPath, sha256: savedHash},
    original: {...original, raster: {path: originalPng, sha256: await readHash(originalPng)}},
    edited: {...edited, raster: {path: editedPng, sha256: await readHash(editedPng)}},
    reopened: {...reopened, sha256: savedHash, raster: {path: reopenedPng, sha256: await readHash(reopenedPng)}},
  });
  let sequence = 0;
  const stages = [];
  const addSingleton = (stageName, owned, cleanup, seconds) => stages.push(stage(++sequence, stageName, 'success', owned, cleanup, seconds));
  const addPair = (stageName, owned, cleanup, seconds) => { stages.push(stage(++sequence, stageName, 'begin', owned, cleanup, seconds)); stages.push(stage(++sequence, stageName, 'success', owned, cleanup, seconds + 1)); };
  addSingleton('worker.initialize', null, true, 0);
  addPair('input.presentation.open', sourceSnapshot, false, 1);
  addPair('edited.presentation.saveAs-owned-copy', sourceSnapshot, false, 3);
  addPair('edited.presentation.fullName.get', savedPath, false, 5);
  addPair('edited.presentation.close', savedPath, false, 7);
  addSingleton('edited.presentation.cleanup', null, true, 9);
  addPair('reopen.presentation.open-readonly', savedPath, false, 10);
  addPair('reopened.presentation.fullName.get', savedPath, false, 12);
  addPair('reopened.presentation.close', savedPath, false, 14);
  addSingleton('reopened.presentation.cleanup', null, true, 16);
  addSingleton('worker.complete', null, true, 17);
  const worker = {processId: 1234, startedAt: '2026-09-22T12:00:00.000Z', finishedAt: '2026-09-22T12:00:18.000Z', timeoutSeconds: 45, timedOut: false, exitCode: 0};
  const supervisor = {timestamp: '2026-09-22T12:00:19.000Z', timedOut: false, exitCode: 0, officeLifecycleComplete: true, officeCleanupConfirmed: true, fontCleanupConfirmed: true, metricsGatePassed: null, metricsOwnedBy: 'test/native-mixed-edit-audit.mjs', tolerancePoints: 0.02, lastDurableStage: 'worker.complete', parentError: null};
  const registrations = Object.entries(PINNED_FONT_SHA256).map(([file, sha256]) => ({file, sha256, added: 1, removed: true}));
  const progress = structuredClone(stages.at(-1));
  const evidence = {root, inputs, externalSource, sourceSnapshot, savedPath, originalPng, editedPng, reopenedPng, generation, request, report, stages, progress, worker, supervisor, registrations};
  if (mutate) await mutate(evidence);
  await writeFile(path.join(inputs, 'generation.json'), `${JSON.stringify(generation, null, 2)}\n`);
  await writeFile(path.join(root, 'request.json'), `${JSON.stringify(request, null, 2)}\n`);
  await writeFile(path.join(root, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(root, 'worker.json'), `${JSON.stringify(worker, null, 2)}\n`);
  await writeFile(path.join(root, 'supervisor.json'), `${JSON.stringify(supervisor, null, 2)}\n`);
  await writeFile(path.join(root, 'font-registration.json'), `${JSON.stringify(registrations, null, 2)}\n`);
  await writeFile(path.join(root, 'stages.jsonl'), `${stages.map(item => JSON.stringify(item)).join('\n')}\n`);
  await writeFile(path.join(root, 'progress.json'), `${JSON.stringify(progress, null, 2)}\n`);
  return evidence;
}

function spawnAudit(directory) { return spawnSync(process.execPath, [auditPath, directory], {encoding: 'utf8', windowsHide: true}); }
function failureCodes(result) { return new Set(result.failures.map(failure => failure.code)); }

const scratch = await mkdtemp(path.join(os.tmpdir(), 'opf-mixed-edit-controls-'));
try {
  await checkAsync('complete-directory-and-cli-audit-pass', async () => {
    const evidence = await makeEvidence(scratch, 'positive');
    const direct = await auditMixedEditDirectory(evidence.root);
    assert.equal(direct.passed, true, JSON.stringify(direct.failures));
    const first = spawnAudit(evidence.root);
    assert.equal(first.status, 0, `${first.stdout}\n${first.stderr}`);
    const auditBytes = await readFile(path.join(evidence.root, 'audit.json'));
    assert.equal(JSON.parse(auditBytes).passed, true);
    const rawSupervisor = await readFile(path.join(evidence.root, 'supervisor.json'));
    const second = spawnAudit(evidence.root);
    assert.equal(second.status, 2, `${second.stdout}\n${second.stderr}`);
    assert.deepEqual(await readFile(path.join(evidence.root, 'audit.json')), auditBytes);
    assert.deepEqual(await readFile(path.join(evidence.root, 'supervisor.json')), rawSupervisor);
  });
  const directoryMutations = [
    ['raw-saved-byte-mutation-fails', 'saved-bytes', async evidence => { await appendFile(evidence.savedPath, Buffer.from('changed')); }],
    ['font-cleanup-mutation-fails', 'font-cleanup', async evidence => { evidence.registrations[0].removed = false; }],
    ['duplicate-font-ledger-row-fails', 'font-cleanup', async evidence => { evidence.registrations[3] = structuredClone(evidence.registrations[0]); }],
    ['font-flags-type-mutation-fails', 'font-fixture', async evidence => { evidence.generation.registration.flags = false; }],
    ['request-font-flags-type-mutation-fails', 'font-fixture', async evidence => { evidence.request.fontHelper.registrationFlags = '0'; }],
    ['supervisor-cleanup-mutation-fails', 'supervisor', async evidence => { evidence.supervisor.fontCleanupConfirmed = false; }],
    ['raw-report-self-certification-fails', 'report-metrics', async evidence => { evidence.report.metrics.gatePassed = true; }],
    ['reviewed-verifier-snapshot-mutation-fails', 'snapshot-hash', async evidence => { await appendFile(path.join(evidence.inputs, 'native-mixed-edit.ps1'), Buffer.from('# changed')); }],
    ['source-path-mutation-fails', 'source-hash', async evidence => { evidence.report.source.path = evidence.sourceSnapshot; }],
    ['progress-mutation-fails', 'progress', async evidence => { evidence.progress.cleanupConfirmed = false; }],
    ['orphan-stage-mutation-fails', 'stage-pair', async evidence => { const at = evidence.stages.findIndex(item => item.stage === 'edited.presentation.close' && item.status === 'begin'); evidence.stages.splice(at, 1); evidence.stages.forEach((item, index) => { item.sequence = index + 1; }); }],
    ['missing-save-stage-fails', 'stage-pair', async evidence => { for (let index = evidence.stages.length - 1; index >= 0; index -= 1) if (evidence.stages[index].stage === 'edited.presentation.saveAs-owned-copy') evidence.stages.splice(index, 1); evidence.stages.forEach((item, index) => { item.sequence = index + 1; }); }],
    ['missing-reopen-stage-fails', 'stage-pair', async evidence => { for (let index = evidence.stages.length - 1; index >= 0; index -= 1) if (evidence.stages[index].stage === 'reopen.presentation.open-readonly') evidence.stages.splice(index, 1); evidence.stages.forEach((item, index) => { item.sequence = index + 1; }); }],
    ['reordered-close-stage-fails', 'stage-order', async evidence => { const begin = evidence.stages.findIndex(item => item.stage === 'reopened.presentation.close' && item.status === 'begin'); const pair = evidence.stages.splice(begin, 2); const beforeOpen = evidence.stages.findIndex(item => item.stage === 'reopen.presentation.open-readonly' && item.status === 'begin'); evidence.stages.splice(beforeOpen, 0, ...pair); evidence.stages.forEach((item, index) => { item.sequence = index + 1; }); }],
    ['extra-close-stage-fails', 'owned-close', async evidence => { const terminal = evidence.stages.pop(); let sequence = evidence.stages.length; evidence.stages.push(stage(++sequence, 'unrelated.close', 'begin', evidence.savedPath, true, 17), stage(++sequence, 'unrelated.close', 'success', evidence.savedPath, true, 18)); terminal.sequence = ++sequence; terminal.timestamp = '2026-09-22T12:00:19.000Z'; evidence.stages.push(terminal); evidence.supervisor.timestamp = '2026-09-22T12:00:20.000Z'; }],
  ];
  for (const [name, code, mutate] of directoryMutations) {
    await checkAsync(name, async () => {
      const evidence = await makeEvidence(scratch, name, mutate);
      const result = await auditMixedEditDirectory(evidence.root);
      assert.equal(result.passed, false, `${name} unexpectedly passed`);
      assert.ok(failureCodes(result).has(code), JSON.stringify(result.failures));
    });
  }
  await checkAsync('cli-malformed-and-missing-inputs-return-nonzero', async () => {
    const missing = spawnAudit(path.join(scratch, 'does-not-exist'));
    assert.notEqual(missing.status, 0);
    const malformed = path.join(scratch, 'malformed'); await mkdir(malformed); await writeFile(path.join(malformed, 'report.json'), '{bad');
    const bad = spawnAudit(malformed);
    assert.equal(bad.status, 1, `${bad.stdout}\n${bad.stderr}`);
    assert.equal(JSON.parse(await readFile(path.join(malformed, 'audit.json'))).passed, false);
  });
} finally {
  const resolvedScratch = path.resolve(scratch), resolvedTemp = path.resolve(os.tmpdir());
  assert.ok(resolvedScratch.startsWith(`${resolvedTemp}${path.sep}`) && path.basename(resolvedScratch).startsWith('opf-mixed-edit-controls-'));
  await rm(resolvedScratch, {recursive: true, force: true});
}

const suite = {
  passed: outcomes.every(item => item.passed),
  scope: 'Offline evaluator, raw-directory, lifecycle, CLI, hash, font-ledger, and AST controls. No Office object or font registration was created.',
  node: process.version, tolerancePoints: GEOMETRY_TOLERANCE_PT,
  verifierSha256: sha(verifierSource), auditSha256: sha(auditSource), checks: outcomes,
};
const reportPath = path.join(packageRoot, 'artifacts', 'native-mixed-edit-controls.json');
await mkdir(path.dirname(reportPath), {recursive: true});
await writeFile(reportPath, `${JSON.stringify(suite, null, 2)}\n`);
console.log(JSON.stringify({passed: suite.passed, checks: outcomes.length, reportPath}));
process.exitCode = suite.passed ? 0 : 1;
