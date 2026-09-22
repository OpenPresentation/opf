import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

export const GEOMETRY_TOLERANCE_PT = 0.02;

export const PINNED_SOURCE_SHA256 = 'f92c5d5565afa1d03fc6df0cdc8d482771d5ebd5a5403f7a888f75e2ad020a51';

export const KNOWN_READONLY_NATIVE_INTERVALS = [[0, 92], [92, 194], [194, 245]];
export const ESTIMATED_PREVIEW_INTERVALS = [[0, 78], [78, 172], [172, 245]];

export const OUTER_GEOMETRY_PT = {
  slideWidth: 960,
  slideHeight: 540,
  left: 43.2,
  top: 43.2,
  width: 873.6,
  height: 118.8,
  rowHeight: 118.8,
  columnWidth: 873.6,
};

const CONTINUATION = 'continues in smaller text across the same editable table cell so natural layout must wrap this sentence without authored line breaks or inserted offsets. ';

export const ORIGINAL_RUNS = [
  {start: 1, length: 5, text: 'Lead\t', size: 18, bold: false, italic: false},
  {start: 6, length: 22, text: 'Large evidence phrase ', size: 30, bold: true, italic: false},
  {start: 28, length: 154, text: CONTINUATION, size: 18, bold: false, italic: false},
  {start: 182, length: 20, text: 'Second large phrase ', size: 30, bold: false, italic: false},
  {start: 202, length: 44, text: 'finishes the control with exact source runs.', size: 18, bold: false, italic: false},
];

export const EDITED_RUNS = ORIGINAL_RUNS.map((run, index) => index === 4
  ? {...run, text: 'finishes the control with saved source runs.'}
  : {...run});

export const CHARACTER_PROBES = [
  {position: 4, text: 'd', purpose: 'before-tab'},
  {position: 5, text: '\t', purpose: 'tab'},
  {position: 6, text: 'L', purpose: 'after-tab'},
  {position: 78, text: ' ', purpose: 'estimated-line-1-end-probe-only'},
  {position: 79, text: 't', purpose: 'estimated-line-2-start-probe-only'},
  {position: 172, text: ' ', purpose: 'estimated-line-2-end-probe-only'},
  {position: 173, text: 'o', purpose: 'estimated-line-3-start-probe-only'},
];

export const ORIGINAL_TEXT = ORIGINAL_RUNS.map(run => run.text).join('');
export const EDITED_TEXT = EDITED_RUNS.map(run => run.text).join('');

function assertContract() {
  if (ORIGINAL_TEXT.length !== 245) throw new Error(`Original mixed-size text length is ${ORIGINAL_TEXT.length}, expected 245.`);
  if (EDITED_TEXT.length !== 245) throw new Error(`Edited mixed-size text length is ${EDITED_TEXT.length}, expected 245.`);
  if (ORIGINAL_TEXT === EDITED_TEXT) throw new Error('The edit must change the mixed-size paragraph.');
  if ((ORIGINAL_TEXT.match(/\t/g) ?? []).length !== 1 || (EDITED_TEXT.match(/\t/g) ?? []).length !== 1) {
    throw new Error('The mixed-size paragraph must keep one literal tab.');
  }
  if (/[\r\n\v]/.test(ORIGINAL_TEXT) || /[\r\n\v]/.test(EDITED_TEXT)) {
    throw new Error('The mixed-size paragraph must not contain a hard break.');
  }
  let cursor = 1;
  for (const run of ORIGINAL_RUNS) {
    if (run.start !== cursor || run.text.length !== run.length) {
      throw new Error(`Original run at ${run.start} does not match its text.`);
    }
    cursor += run.length;
  }
  for (const probe of CHARACTER_PROBES) {
    if (ORIGINAL_TEXT[probe.position - 1] !== probe.text || EDITED_TEXT[probe.position - 1] !== probe.text) {
      throw new Error(`Character probe ${probe.position} does not match the authored paragraph.`);
    }
  }
}

assertContract();

export function exceedsTolerance(actual, expected, tolerance = GEOMETRY_TOLERANCE_PT) {
  return Math.abs(Number(actual) - Number(expected)) > tolerance;
}

export function lineIntervals(observation) {
  return (observation?.cell?.lines?.records ?? []).map(record => {
    const start = Number(record.start);
    const length = Number(record.length);
    return [start - 1, start - 1 + length];
  });
}

export function intervalsEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function previewLineBreakLimit(observedIntervals) {
  return {
    kind: 'recorded-limit',
    failsHarness: false,
    knownReadOnlyNativeIntervals: KNOWN_READONLY_NATIVE_INTERVALS,
    estimatedPreviewIntervals: ESTIMATED_PREVIEW_INTERVALS,
    observedIntervals,
    observedMatchesPreviewEstimate: intervalsEqual(observedIntervals, ESTIMATED_PREVIEW_INTERVALS),
    note: 'The 2026-09-21 read-only run recorded native intervals [0,92), [92,194), [194,245) against estimated preview [0,78), [78,172), [172,245). That mismatch is a recorded limit and is not a content or 0.02pt geometry failure.',
  };
}

function push(failures, code, message) {
  failures.push({code, message});
}

function expectRuns(failures, phase, observation, runs, text) {
  const whole = observation?.cell?.whole;
  if (whole?.text !== text || Number(whole?.start) !== 1 || Number(whole?.length) !== text.length) {
    push(failures, 'content', `${phase} whole-cell text, start, or length mismatch`);
  }
  const tabCount = [...(whole?.text ?? '')].filter(character => character === '\t').length;
  const hardBreakCount = [...(whole?.text ?? '')].filter(character => character === '\n' || character === '\r' || character === '\v').length;
  if (tabCount !== 1) push(failures, 'content', `${phase} cell text must contain one literal tab`);
  if (hardBreakCount !== 0) push(failures, 'content', `${phase} cell text must not contain a hard break`);
  const actualRuns = observation?.cell?.runs ?? [];
  if (actualRuns.length !== runs.length) push(failures, 'content', `${phase} run count mismatch`);
  for (let index = 0; index < Math.min(actualRuns.length, runs.length); index += 1) {
    const actual = actualRuns[index];
    const wanted = runs[index];
    const bold = wanted.bold ? -1 : 0;
    if (actual?.text !== wanted.text || Number(actual?.start) !== wanted.start || Number(actual?.length) !== wanted.length) {
      push(failures, 'content', `${phase} run ${index} text or span mismatch`);
    }
    if (actual?.font?.name !== 'Carlito' || exceedsTolerance(actual?.font?.size, wanted.size) || Number(actual?.font?.bold) !== bold || Number(actual?.font?.italic) !== 0) {
      push(failures, 'style', `${phase} run ${index} font, size, bold, or italic mismatch`);
    }
  }
  const probes = observation?.cell?.characters ?? [];
  if (probes.length !== CHARACTER_PROBES.length) push(failures, 'content', `${phase} character probe count mismatch`);
  for (let index = 0; index < Math.min(probes.length, CHARACTER_PROBES.length); index += 1) {
    const actual = probes[index];
    const wanted = CHARACTER_PROBES[index];
    if (actual?.text !== wanted.text || Number(actual?.start) !== wanted.position || Number(actual?.length) !== 1) {
      push(failures, 'content', `${phase} character probe ${wanted.position} mismatch`);
    }
  }
  if (Number(observation?.cell?.paragraph?.count) !== 1) push(failures, 'content', `${phase} paragraph count is not one`);
  if (Number(observation?.cell?.paragraph?.explicitTabStopCount) !== 0) push(failures, 'content', `${phase} explicit tab stop count is not zero`);
  if (Number(observation?.slideCount) !== 1 || Number(observation?.shapeCount) !== 1) {
    push(failures, 'content', `${phase} must stay one slide and one shape`);
  }
  if (Number(observation?.shape?.hasTable) !== -1 || Number(observation?.table?.rowCount) !== 1 || Number(observation?.table?.columnCount) !== 1) {
    push(failures, 'content', `${phase} shape is not the one-cell table`);
  }
  if (observation?.shape?.name !== 'OPF table 1') push(failures, 'content', `${phase} table shape name mismatch`);
}

function expectOuterGeometry(failures, phase, observation) {
  const shape = observation?.shape?.geometry ?? {};
  const cell = observation?.cell?.geometry ?? {};
  const checks = [
    ['slide width', observation?.slideWidth, OUTER_GEOMETRY_PT.slideWidth],
    ['slide height', observation?.slideHeight, OUTER_GEOMETRY_PT.slideHeight],
    ['table left', shape.left, OUTER_GEOMETRY_PT.left],
    ['table top', shape.top, OUTER_GEOMETRY_PT.top],
    ['table width', shape.width, OUTER_GEOMETRY_PT.width],
    ['table height', shape.height, OUTER_GEOMETRY_PT.height],
    ['cell left', cell.left, OUTER_GEOMETRY_PT.left],
    ['cell top', cell.top, OUTER_GEOMETRY_PT.top],
    ['cell width', cell.width, OUTER_GEOMETRY_PT.width],
    ['cell height', cell.height, OUTER_GEOMETRY_PT.height],
    ['row height', observation?.table?.rowHeight, OUTER_GEOMETRY_PT.rowHeight],
    ['column width', observation?.table?.columnWidth, OUTER_GEOMETRY_PT.columnWidth],
  ];
  for (const [label, actual, expected] of checks) {
    if (exceedsTolerance(actual, expected)) {
      push(failures, 'geometry', `${phase} ${label} ${actual} vs ${expected} pt exceeds ${GEOMETRY_TOLERANCE_PT}pt`);
    }
  }
}

function expectSoftWrap(failures, phase, observation) {
  if (Number(observation?.cell?.lines?.count) < 2) {
    push(failures, 'soft-wrap', `${phase} native line count is below two`);
  }
}

export function evaluateMixedEditReport(report) {
  const failures = [];
  if (report?.kind !== 'native-mixed-edit') push(failures, 'report-kind', 'report.kind must be native-mixed-edit');
  if (Number(report?.requested?.tolerancePoints) !== GEOMETRY_TOLERANCE_PT) {
    push(failures, 'tolerance-relaxed', `requested.tolerancePoints must stay ${GEOMETRY_TOLERANCE_PT}`);
  }
  if (report?.cleanupConfirmed !== true) push(failures, 'cleanup', 'owned presentations were not confirmed closed');
  if (report?.officeOperationsStopped === true) push(failures, 'office-stopped', 'Office operations stopped before a completed lifecycle');
  if (report?.lastStage !== 'worker.complete' || report?.lastStatus !== 'success') {
    push(failures, 'lifecycle', 'worker did not record a successful completion stage');
  }
  if (report?.source?.sha256 !== PINNED_SOURCE_SHA256 || report?.source?.unchanged !== true || report?.source?.snapshotUnchanged !== true) {
    push(failures, 'source-hash', 'owned source snapshot hash changed or is not the reviewed mixed-size fixture');
  }
  if (!report?.saved?.sha256 || report.saved.sha256 !== report?.reopened?.sha256) {
    push(failures, 'saved-bytes', 'saved and reopened presentation hashes differ');
  }
  const phases = [
    ['original', report?.original?.observation, ORIGINAL_RUNS, ORIGINAL_TEXT, 0],
    ['edited', report?.edited?.observation, EDITED_RUNS, EDITED_TEXT, 0],
    ['reopened', report?.reopened?.observation, EDITED_RUNS, EDITED_TEXT, -1],
  ];
  for (const [phase, observation, runs, text, readOnly] of phases) {
    if (Number(observation?.readOnly) !== readOnly) push(failures, 'ownership', `${phase} read-only state mismatch`);
    expectRuns(failures, phase, observation, runs, text);
    expectOuterGeometry(failures, phase, observation);
    expectSoftWrap(failures, phase, observation);
  }
  const editedIntervals = lineIntervals(report?.edited?.observation);
  const reopenedIntervals = lineIntervals(report?.reopened?.observation);
  if (!intervalsEqual(editedIntervals, reopenedIntervals)) {
    push(failures, 'line-persistence', 'edited and reopened native line intervals differ');
  }
  const preview = previewLineBreakLimit(lineIntervals(report?.original?.observation));
  return {
    passed: failures.length === 0,
    tolerancePoints: GEOMETRY_TOLERANCE_PT,
    failures,
    previewLineBreakLimit: preview,
  };
}

export async function auditMixedEditDirectory(evidenceDirectory) {
  const root = path.resolve(evidenceDirectory);
  const report = JSON.parse((await readFile(path.join(root, 'report.json'), 'utf8')).replace(/^\uFEFF/, ''));
  const worker = JSON.parse((await readFile(path.join(root, 'worker.json'), 'utf8')).replace(/^\uFEFF/, ''));
  const evaluation = evaluateMixedEditReport(report);
  const failures = [...evaluation.failures];
  if (Number(worker?.exitCode) !== 0 || worker?.timedOut === true) {
    failures.unshift({code: 'worker', message: 'native worker did not exit 0 without a timeout'});
  }
  return {
    schemaVersion: 1,
    kind: 'native-mixed-edit-audit',
    passed: failures.length === 0,
    tolerancePoints: GEOMETRY_TOLERANCE_PT,
    failures,
    previewLineBreakLimit: evaluation.previewLineBreakLimit,
    scope: 'Offline content, style, and 0.02pt outer-geometry audit. No Office process is started.',
    evidenceDirectory: root,
    reportSha256: createHash('sha256').update(JSON.stringify(report)).digest('hex'),
  };
}
