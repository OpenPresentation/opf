import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  CHARACTER_PROBES,
  EDITED_RUNS,
  EDITED_TEXT,
  GEOMETRY_TOLERANCE_PT,
  ORIGINAL_RUNS,
  ORIGINAL_TEXT,
  OUTER_GEOMETRY_PT,
  PINNED_SOURCE_SHA256,
  evaluateMixedEditReport,
  lineIntervals,
  previewLineBreakLimit,
} from './native-mixed-edit-audit.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const root = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(root, '..');
const verifierPath = path.join(root, 'native-mixed-edit.ps1');
const auditPath = path.join(root, 'native-mixed-edit-audit.mjs');

assert.equal(process.versions.node.split('.')[0], '24', 'Native mixed-size edit controls require Node 24.');
assert.equal(GEOMETRY_TOLERANCE_PT, 0.02);
assert.equal(ORIGINAL_TEXT.length, 245);
assert.equal(EDITED_TEXT.length, 245);

const KNOWN_NATIVE = [[0, 92], [92, 194], [194, 245]];
const PREVIEW = [[0, 78], [78, 172], [172, 245]];

function linesFromIntervals(intervals) {
  return {
    count: intervals.length,
    records: intervals.map(([start, end]) => ({start: start + 1, length: end - start, text: ''})),
  };
}

function observation({phase, text, runs, readOnly, intervals, widthDelta = 0}) {
  const width = OUTER_GEOMETRY_PT.width + widthDelta;
  const geometry = {
    left: OUTER_GEOMETRY_PT.left,
    top: OUTER_GEOMETRY_PT.top,
    width,
    height: OUTER_GEOMETRY_PT.height,
  };
  return {
    phase,
    readOnly,
    slideCount: 1,
    shapeCount: 1,
    slideWidth: OUTER_GEOMETRY_PT.slideWidth,
    slideHeight: OUTER_GEOMETRY_PT.slideHeight,
    shape: {name: 'OPF table 1', type: 19, hasTable: -1, geometry: {...geometry}},
    table: {
      rowCount: 1,
      columnCount: 1,
      rowHeight: OUTER_GEOMETRY_PT.rowHeight,
      columnWidth: width,
    },
    cell: {
      geometry: {...geometry},
      whole: {text, start: 1, length: text.length},
      runs: runs.map(run => ({
        text: run.text,
        start: run.start,
        length: run.length,
        font: {name: 'Carlito', size: run.size, bold: run.bold ? -1 : 0, italic: 0},
      })),
      characters: CHARACTER_PROBES.map(probe => ({
        text: probe.text,
        start: probe.position,
        length: 1,
        position: probe.position,
        purpose: probe.purpose,
      })),
      paragraph: {count: 1, explicitTabStopCount: 0},
      lines: linesFromIntervals(intervals),
    },
  };
}

function report(overrides = {}) {
  const saved = 'a'.repeat(64);
  return {
    schemaVersion: 1,
    kind: 'native-mixed-edit',
    cleanupConfirmed: true,
    officeOperationsStopped: false,
    lastStage: 'worker.complete',
    lastStatus: 'success',
    source: {sha256: PINNED_SOURCE_SHA256, unchanged: true, snapshotUnchanged: true},
    saved: {sha256: saved},
    reopened: {sha256: saved, observation: observation({
      phase: 'reopened',
      text: EDITED_TEXT,
      runs: EDITED_RUNS,
      readOnly: -1,
      intervals: KNOWN_NATIVE,
    })},
    requested: {tolerancePoints: 0.02},
    original: {observation: observation({
      phase: 'original',
      text: ORIGINAL_TEXT,
      runs: ORIGINAL_RUNS,
      readOnly: 0,
      intervals: KNOWN_NATIVE,
    })},
    edited: {observation: observation({
      phase: 'edited',
      text: EDITED_TEXT,
      runs: EDITED_RUNS,
      readOnly: 0,
      intervals: KNOWN_NATIVE,
    })},
    metrics: {gatePassed: true},
    ...overrides,
  };
}

const outcomes = [];
function check(name, fn) {
  fn();
  outcomes.push({name, passed: true});
}

check('preview-mismatch-is-not-a-failure', () => {
  const evaluation = evaluateMixedEditReport(report());
  assert.equal(evaluation.passed, true, JSON.stringify(evaluation.failures));
  assert.equal(evaluation.tolerancePoints, 0.02);
  assert.equal(evaluation.previewLineBreakLimit.failsHarness, false);
  assert.equal(evaluation.previewLineBreakLimit.observedMatchesPreviewEstimate, false);
  assert.deepEqual(evaluation.previewLineBreakLimit.knownReadOnlyNativeIntervals, KNOWN_NATIVE);
  assert.deepEqual(evaluation.previewLineBreakLimit.estimatedPreviewIntervals, PREVIEW);
  assert.equal(evaluation.failures.some(failure => failure.code.includes('preview')), false);
  assert.deepEqual(lineIntervals(report().original.observation), KNOWN_NATIVE);
});

check('preview-match-also-passes', () => {
  const matching = report();
  for (const phase of ['original', 'edited']) {
    matching[phase].observation.cell.lines = linesFromIntervals(PREVIEW);
  }
  matching.reopened.observation.cell.lines = linesFromIntervals(PREVIEW);
  const evaluation = evaluateMixedEditReport(matching);
  assert.equal(evaluation.passed, true, JSON.stringify(evaluation.failures));
  assert.equal(evaluation.previewLineBreakLimit.observedMatchesPreviewEstimate, true);
  assert.equal(evaluation.previewLineBreakLimit.failsHarness, false);
});

check('content-mismatch-fails', () => {
  const broken = report();
  broken.edited.observation.cell.whole.text = EDITED_TEXT.replace('saved', 'wrong');
  broken.reopened.observation.cell.whole.text = broken.edited.observation.cell.whole.text;
  const evaluation = evaluateMixedEditReport(broken);
  assert.equal(evaluation.passed, false);
  assert.ok(evaluation.failures.some(failure => failure.code === 'content'));
});

check('style-mismatch-fails', () => {
  const broken = report();
  broken.edited.observation.cell.runs[1].font.size = 18;
  broken.reopened.observation.cell.runs[1].font.size = 18;
  const evaluation = evaluateMixedEditReport(broken);
  assert.equal(evaluation.passed, false);
  assert.ok(evaluation.failures.some(failure => failure.code === 'style'));
});

check('geometry-boundary-0.02-passes', () => {
  const edged = report();
  for (const phase of [edged.original.observation, edged.edited.observation, edged.reopened.observation]) {
    phase.shape.geometry.width = OUTER_GEOMETRY_PT.width + 0.02;
    phase.cell.geometry.width = OUTER_GEOMETRY_PT.width + 0.02;
    phase.table.columnWidth = OUTER_GEOMETRY_PT.width + 0.02;
  }
  const evaluation = evaluateMixedEditReport(edged);
  assert.equal(evaluation.passed, true, JSON.stringify(evaluation.failures));
});

check('geometry-beyond-0.02-fails', () => {
  const broken = report();
  broken.edited.observation.shape.geometry.width = OUTER_GEOMETRY_PT.width + 0.021;
  broken.reopened.observation.shape.geometry.width = OUTER_GEOMETRY_PT.width + 0.021;
  broken.original.observation.shape.geometry.width = OUTER_GEOMETRY_PT.width + 0.021;
  const evaluation = evaluateMixedEditReport(broken);
  assert.equal(evaluation.passed, false);
  assert.ok(evaluation.failures.some(failure => failure.code === 'geometry' && failure.message.includes('0.02pt')));
});

check('self-certified-gate-cannot-hide-content-failure', () => {
  const broken = report();
  broken.original.observation.cell.whole.text = 'changed';
  broken.metrics.gatePassed = true;
  const evaluation = evaluateMixedEditReport(broken);
  assert.equal(evaluation.passed, false);
  assert.ok(evaluation.failures.some(failure => failure.code === 'content'));
});

check('relaxed-tolerance-field-fails', () => {
  const broken = report();
  broken.requested.tolerancePoints = 0.1;
  const evaluation = evaluateMixedEditReport(broken);
  assert.equal(evaluation.passed, false);
  assert.ok(evaluation.failures.some(failure => failure.code === 'tolerance-relaxed'));
});

check('cleanup-not-confirmed-fails', () => {
  const evaluation = evaluateMixedEditReport(report({cleanupConfirmed: false}));
  assert.equal(evaluation.passed, false);
  assert.ok(evaluation.failures.some(failure => failure.code === 'cleanup'));
});

check('edited-reopened-line-persistence-fails', () => {
  const broken = report();
  broken.reopened.observation.cell.lines = linesFromIntervals(PREVIEW);
  const evaluation = evaluateMixedEditReport(broken);
  assert.equal(evaluation.passed, false);
  assert.ok(evaluation.failures.some(failure => failure.code === 'line-persistence'));
  assert.equal(evaluation.previewLineBreakLimit.failsHarness, false);
});

check('recorded-limit-helper-does-not-fail', () => {
  const limit = previewLineBreakLimit(KNOWN_NATIVE);
  assert.equal(limit.failsHarness, false);
  assert.equal(limit.observedMatchesPreviewEstimate, false);
});

const verifierSource = await readFile(verifierPath, 'utf8');
const auditSource = await readFile(auditPath, 'utf8');

check('verifier-uses-powershell-ast', () => {
  assert.match(verifierSource, /function Assert-MixedEditVerifierAst/);
  assert.match(verifierSource, /function Get-MixedEditNumericLiteralValue/);
  assert.match(verifierSource, /ParenExpressionAst/);
  assert.match(verifierSource, /UnaryExpressionAst/);
  assert.match(verifierSource, /TokenKind\]::Minus/);
  assert.match(verifierSource, /\$script:stageFile/);
  assert.match(verifierSource, /\$script:progressFile/);
  assert.match(verifierSource, /\$script:sequence/);
  assert.match(verifierSource, /SaveAs\(\$savedPath,24\)/);
  assert.match(auditSource, /GEOMETRY_TOLERANCE_PT = 0\.02/);
});

const suite = {
  passed: outcomes.every(item => item.passed),
  scope: 'Offline mixed-size edit/save/reopen controls. No Office object was constructed.',
  node: process.version,
  tolerancePoints: GEOMETRY_TOLERANCE_PT,
  verifierSha256: sha(verifierSource),
  checks: outcomes,
};
const reportPath = path.join(packageRoot, 'artifacts/native-mixed-edit-controls.json');
await mkdir(path.dirname(reportPath), {recursive: true});
await writeFile(reportPath, JSON.stringify(suite, null, 2) + '\n');
console.log(JSON.stringify({passed: suite.passed, checks: outcomes.length, reportPath}));
process.exitCode = suite.passed ? 0 : 1;
