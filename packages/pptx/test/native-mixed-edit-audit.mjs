import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const GEOMETRY_TOLERANCE_PT = 0.02;
export const PINNED_SOURCE_SHA256 = 'f92c5d5565afa1d03fc6df0cdc8d482771d5ebd5a5403f7a888f75e2ad020a51';
export const PINNED_LICENSE_SHA256 = '58402f82a7c332a700294988fe7554fbb0a63a8d27ccc1ee3bbc640311990a00';
export const PINNED_FONT_SHA256 = Object.freeze({
  'fonts/Carlito-400-normal.ttf': 'ca019755404c45627a8566915df99068949dc32ee2bce48d6aeee7542d2a0a89',
  'fonts/Carlito-400-italic.ttf': '074cd1b89d53765d90d0ed3b4bfe49523efaaf4f3f430c006bc3233778b0ebb5',
  'fonts/Carlito-700-normal.ttf': '51edbfa32d8af939913ae1f4ad0a5173e32083499218c133384638090295f0b0',
  'fonts/Carlito-700-italic.ttf': '25f5672c1985d168d6bc2973864fc5a7e374bb95fe8d0f91cff47ae17fa67691',
});

export const KNOWN_READONLY_NATIVE_INTERVALS = [[0, 92], [92, 194], [194, 245]];
export const ESTIMATED_PREVIEW_INTERVALS = [[0, 78], [78, 172], [172, 245]];
export const OUTER_GEOMETRY_PT = Object.freeze({slideWidth: 960, slideHeight: 540, left: 43.2, top: 43.2, width: 873.6, height: 118.8, rowHeight: 118.8, columnWidth: 873.6});

const CONTINUATION = 'continues in smaller text across the same editable table cell so natural layout must wrap this sentence without authored line breaks or inserted offsets. ';
export const ORIGINAL_RUNS = [
  {start: 1, length: 5, text: 'Lead\t', size: 18, bold: false, italic: false},
  {start: 6, length: 22, text: 'Large evidence phrase ', size: 30, bold: true, italic: false},
  {start: 28, length: 154, text: CONTINUATION, size: 18, bold: false, italic: false},
  {start: 182, length: 20, text: 'Second large phrase ', size: 30, bold: false, italic: false},
  {start: 202, length: 44, text: 'finishes the control with exact source runs.', size: 18, bold: false, italic: false},
];
export const EDITED_RUNS = ORIGINAL_RUNS.map((run, index) => index === 4 ? {...run, text: 'finishes the control with saved source runs.'} : {...run});
export const CHARACTER_PROBES = [
  {position: 4, text: 'd', purpose: 'before-tab'}, {position: 5, text: '\t', purpose: 'tab'}, {position: 6, text: 'L', purpose: 'after-tab'},
  {position: 78, text: ' ', purpose: 'estimated-line-1-end-probe-only'}, {position: 79, text: 't', purpose: 'estimated-line-2-start-probe-only'},
  {position: 172, text: ' ', purpose: 'estimated-line-2-end-probe-only'}, {position: 173, text: 'o', purpose: 'estimated-line-3-start-probe-only'},
];
export const ORIGINAL_TEXT = ORIGINAL_RUNS.map(run => run.text).join('');
export const EDITED_TEXT = EDITED_RUNS.map(run => run.text).join('');

function assertContract() {
  if (ORIGINAL_TEXT.length !== 245 || EDITED_TEXT.length !== 245 || ORIGINAL_TEXT === EDITED_TEXT) throw new Error('Invalid mixed-size source/edit contract.');
  if ((ORIGINAL_TEXT.match(/\t/g) ?? []).length !== 1 || (EDITED_TEXT.match(/\t/g) ?? []).length !== 1) throw new Error('The mixed-size paragraph must keep one literal tab.');
  if (/[\r\n\v]/.test(ORIGINAL_TEXT) || /[\r\n\v]/.test(EDITED_TEXT)) throw new Error('The mixed-size paragraph must not contain a hard break.');
  let cursor = 1;
  for (const run of ORIGINAL_RUNS) { if (run.start !== cursor || run.text.length !== run.length) throw new Error(`Original run at ${run.start} does not match its text.`); cursor += run.length; }
  for (const probe of CHARACTER_PROBES) if (ORIGINAL_TEXT[probe.position - 1] !== probe.text || EDITED_TEXT[probe.position - 1] !== probe.text) throw new Error(`Character probe ${probe.position} does not match.`);
}
assertContract();

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const finiteNumber = value => typeof value === 'number' && Number.isFinite(value);
const integer = value => finiteNumber(value) && Number.isInteger(value);
const hexSha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const samePath = (left, right) => {
  const a = path.resolve(String(left)), b = path.resolve(String(right));
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
};

export function exceedsTolerance(actual, expected, tolerance = GEOMETRY_TOLERANCE_PT) {
  if (![actual, expected, tolerance].every(finiteNumber) || tolerance < 0) return true;
  return Math.abs(actual - expected) > tolerance;
}
export function lineIntervals(observation) {
  const records = observation?.cell?.lines?.records;
  if (!Array.isArray(records)) return [];
  return records.map(record => [Number(record?.start) - 1, Number(record?.start) - 1 + Number(record?.length)]);
}
export const intervalsEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);
export function previewLineBreakLimit(observedIntervals) {
  return {kind: 'recorded-limit', failsHarness: false, knownReadOnlyNativeIntervals: KNOWN_READONLY_NATIVE_INTERVALS, estimatedPreviewIntervals: ESTIMATED_PREVIEW_INTERVALS, observedIntervals, observedMatchesPreviewEstimate: intervalsEqual(observedIntervals, ESTIMATED_PREVIEW_INTERVALS), note: 'The 2026-09-21 read-only run recorded native intervals [0,92), [92,194), [194,245) against estimated preview [0,78), [78,172), [172,245). That mismatch remains a recorded limit, not a content or 0.02pt geometry failure.'};
}
function push(failures, code, message) { failures.push({code, message}); }
function expectBounds(failures, phase, label, bounds) {
  for (const key of ['left', 'top', 'width', 'height']) {
    const value = bounds?.[key];
    if (!finiteNumber(value) || ((key === 'width' || key === 'height') && value < 0)) push(failures, 'range-bounds', `${phase} ${label} ${key} is missing, non-finite, or negative`);
  }
}
function expectRuns(failures, phase, observation, runs, text) {
  const whole = observation?.cell?.whole;
  if (whole?.text !== text || whole?.start !== 1 || whole?.length !== text.length) push(failures, 'content', `${phase} whole-cell text, start, or length mismatch`);
  if (whole?.font?.name !== 'Carlito' || exceedsTolerance(whole?.font?.size, 18) || whole?.font?.bold !== -2 || whole?.font?.italic !== 0) push(failures, 'style', `${phase} whole-cell font evidence differs from the reviewed mixed-style range`);
  expectBounds(failures, phase, 'whole range', whole?.bounds);
  const tabCount = [...(whole?.text ?? '')].filter(character => character === '\t').length;
  const hardBreakCount = [...(whole?.text ?? '')].filter(character => character === '\n' || character === '\r' || character === '\v').length;
  if (tabCount !== 1) push(failures, 'content', `${phase} cell text must contain one literal tab`);
  if (hardBreakCount !== 0) push(failures, 'content', `${phase} cell text must not contain a hard break`);
  const actualRuns = observation?.cell?.runs;
  if (!Array.isArray(actualRuns) || actualRuns.length !== runs.length) push(failures, 'content', `${phase} run count mismatch`);
  for (let index = 0; index < Math.min(actualRuns?.length ?? 0, runs.length); index += 1) {
    const actual = actualRuns[index], wanted = runs[index], bold = wanted.bold ? -1 : 0;
    if (actual?.text !== wanted.text || actual?.start !== wanted.start || actual?.length !== wanted.length) push(failures, 'content', `${phase} run ${index} text or span mismatch`);
    if (actual?.font?.name !== 'Carlito' || exceedsTolerance(actual?.font?.size, wanted.size) || actual?.font?.bold !== bold || actual?.font?.italic !== 0) push(failures, 'style', `${phase} run ${index} font, finite size, bold, or italic mismatch`);
    expectBounds(failures, phase, `run ${index}`, actual?.bounds);
  }
  const probes = observation?.cell?.characters;
  if (!Array.isArray(probes) || probes.length !== CHARACTER_PROBES.length) push(failures, 'content', `${phase} character probe count mismatch`);
  for (let index = 0; index < Math.min(probes?.length ?? 0, CHARACTER_PROBES.length); index += 1) {
    const actual = probes[index], wanted = CHARACTER_PROBES[index];
    const containingRun = runs.find(run => wanted.position >= run.start && wanted.position < run.start + run.length);
    if (actual?.text !== wanted.text || actual?.start !== wanted.position || actual?.length !== 1 || actual?.position !== wanted.position || actual?.purpose !== wanted.purpose) push(failures, 'content', `${phase} character probe ${wanted.position} mismatch`);
    if (!containingRun || actual?.font?.name !== 'Carlito' || exceedsTolerance(actual?.font?.size, containingRun.size) || actual?.font?.bold !== (containingRun.bold ? -1 : 0) || actual?.font?.italic !== (containingRun.italic ? -1 : 0)) push(failures, 'style', `${phase} character probe ${wanted.position} differs from its expected containing run`);
    expectBounds(failures, phase, `character ${wanted.position}`, actual?.bounds);
  }
  if (observation?.cell?.paragraph?.count !== 1) push(failures, 'content', `${phase} paragraph count is not one`);
  if (observation?.cell?.paragraph?.explicitTabStopCount !== 0) push(failures, 'content', `${phase} explicit tab stop count is not zero`);
  if (observation?.slideCount !== 1 || observation?.shapeCount !== 1) push(failures, 'content', `${phase} must stay one slide and one shape`);
  if (observation?.shape?.type !== 19 || observation?.shape?.hasTable !== -1 || observation?.table?.rowCount !== 1 || observation?.table?.columnCount !== 1) push(failures, 'content', `${phase} shape is not the one-cell table`);
  if (observation?.shape?.name !== 'OPF table 1') push(failures, 'content', `${phase} table shape name mismatch`);
}
function expectOuterGeometry(failures, phase, observation) {
  const shape = observation?.shape?.geometry ?? {}, cell = observation?.cell?.geometry ?? {};
  const checks = [
    ['slide width', observation?.slideWidth, OUTER_GEOMETRY_PT.slideWidth], ['slide height', observation?.slideHeight, OUTER_GEOMETRY_PT.slideHeight],
    ['table left', shape.left, OUTER_GEOMETRY_PT.left], ['table top', shape.top, OUTER_GEOMETRY_PT.top], ['table width', shape.width, OUTER_GEOMETRY_PT.width], ['table height', shape.height, OUTER_GEOMETRY_PT.height],
    ['cell left', cell.left, OUTER_GEOMETRY_PT.left], ['cell top', cell.top, OUTER_GEOMETRY_PT.top], ['cell width', cell.width, OUTER_GEOMETRY_PT.width], ['cell height', cell.height, OUTER_GEOMETRY_PT.height],
    ['row height', observation?.table?.rowHeight, OUTER_GEOMETRY_PT.rowHeight], ['column width', observation?.table?.columnWidth, OUTER_GEOMETRY_PT.columnWidth],
  ];
  for (const [label, actual, expected] of checks) if (exceedsTolerance(actual, expected)) push(failures, 'geometry', `${phase} ${label} ${actual} vs ${expected} pt is missing/non-finite or exceeds ${GEOMETRY_TOLERANCE_PT}pt`);
}
function expectLineEvidence(failures, phase, observation, text) {
  const lines = observation?.cell?.lines, count = lines?.count, captured = lines?.capturedCount, records = lines?.records;
  if (!integer(count) || count < 2 || count > 8) push(failures, 'soft-wrap', `${phase} native line count must be a finite integer from 2 through 8`);
  if (!integer(captured) || captured !== count) push(failures, 'line-capture', `${phase} captured line count must equal native line count`);
  if (!Array.isArray(records) || records.length !== count) push(failures, 'line-capture', `${phase} line record count must equal native line count`);
  let cursor = 1;
  for (let index = 0; index < (Array.isArray(records) ? records.length : 0); index += 1) {
    const record = records[index], start = record?.start, length = record?.length;
    if (!integer(start) || !integer(length) || start !== cursor || length <= 0 || start - 1 + length > text.length) { push(failures, 'line-coverage', `${phase} line ${index + 1} does not form a positive contiguous source interval`); continue; }
    if (record?.index !== index + 1 || record?.text !== text.slice(start - 1, start - 1 + length)) push(failures, 'line-coverage', `${phase} line ${index + 1} index or text differs from its source interval`);
    expectBounds(failures, phase, `line ${index + 1}`, record?.bounds);
    cursor += length;
  }
  if (cursor !== text.length + 1) push(failures, 'line-coverage', `${phase} line intervals do not cover all ${text.length} UTF-16 units`);
  return lineIntervals(observation);
}

export function evaluateMixedEditReport(report) {
  const failures = [];
  if (report?.kind !== 'native-mixed-edit') push(failures, 'report-kind', 'report.kind must be native-mixed-edit');
  if (report?.requested?.tolerancePoints !== GEOMETRY_TOLERANCE_PT) push(failures, 'tolerance-relaxed', `requested.tolerancePoints must stay ${GEOMETRY_TOLERANCE_PT}`);
  if (report?.cleanupConfirmed !== true) push(failures, 'cleanup', 'owned presentations were not confirmed closed');
  if (report?.officeOperationsStopped !== false) push(failures, 'office-stopped', 'Office operations did not complete normally');
  if (report?.lastStage !== 'worker.complete' || report?.lastStatus !== 'success' || report?.error !== null) push(failures, 'lifecycle', 'worker did not record a clean successful completion');
  if (report?.source?.sha256 !== PINNED_SOURCE_SHA256 || report?.source?.unchanged !== true || report?.source?.snapshotUnchanged !== true) push(failures, 'source-hash', 'owned source snapshot hash changed or is not the reviewed mixed-size fixture');
  if (!hexSha(report?.saved?.sha256) || report.saved.sha256 !== report?.reopened?.sha256) push(failures, 'saved-bytes', 'saved and reopened presentation hashes differ or are missing');
  const phases = [['original', report?.original?.observation, ORIGINAL_RUNS, ORIGINAL_TEXT, 0], ['edited', report?.edited?.observation, EDITED_RUNS, EDITED_TEXT, 0], ['reopened', report?.reopened?.observation, EDITED_RUNS, EDITED_TEXT, -1]];
  const intervals = {};
  for (const [phase, observation, runs, text, readOnly] of phases) {
    if (observation?.readOnly !== readOnly) push(failures, 'ownership', `${phase} read-only state mismatch`);
    expectRuns(failures, phase, observation, runs, text); expectOuterGeometry(failures, phase, observation); intervals[phase] = expectLineEvidence(failures, phase, observation, text);
  }
  if (!intervalsEqual(intervals.edited, intervals.reopened)) push(failures, 'line-persistence', 'edited and reopened native line intervals differ');
  return {passed: failures.length === 0, tolerancePoints: GEOMETRY_TOLERANCE_PT, failures, previewLineBreakLimit: previewLineBreakLimit(intervals.original)};
}

async function readJson(file) { const bytes = await readFile(file); return {bytes, value: JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''))}; }
async function hashRequired(file, failures, code, artifactHashes, expected = null, label = path.basename(file)) {
  try { const bytes = await readFile(file), actual = sha256(bytes); artifactHashes[label] = actual; if (expected && actual !== expected) push(failures, code, `${label} SHA-256 ${actual} does not equal ${expected}`); return actual; }
  catch (error) { push(failures, code, `Cannot read ${label}: ${error.code ?? error.message}`); return null; }
}
function expectExactPath(failures, label, actual, expected) { if (typeof actual !== 'string' || !samePath(actual, expected)) push(failures, 'owned-path', `${label} is not the exact owned path ${expected}`); }
function expectStage(failures, stages, stage, status, ownedPath = undefined) {
  const matches = stages.filter(item => item?.stage === stage && item?.status === status);
  if (matches.length !== 1) return push(failures, 'stages', `Expected exactly one ${stage}/${status} stage, observed ${matches.length}`);
  if (ownedPath !== undefined) {
    if (ownedPath === null ? matches[0].ownedPresentationPath !== null : (typeof matches[0].ownedPresentationPath !== 'string' || !samePath(matches[0].ownedPresentationPath, ownedPath))) push(failures, 'owned-close', `${stage}/${status} did not record the expected owned presentation path`);
  }
}
function expectPairedStage(failures, stages, stage, ownedPath = undefined) {
  const matches = stages.filter(item => item?.stage === stage);
  if (matches.length !== 2 || matches[0]?.status !== 'begin' || matches[1]?.status !== 'success' || matches[1]?.sequence !== matches[0]?.sequence + 1) {
    push(failures, 'stage-pair', `${stage} must be exactly one adjacent begin/success pair`);
    return;
  }
  if (ownedPath !== undefined) {
    for (const item of matches) {
      if (ownedPath === null ? item?.ownedPresentationPath !== null : (typeof item?.ownedPresentationPath !== 'string' || !samePath(item.ownedPresentationPath, ownedPath))) push(failures, 'owned-close', `${stage}/${item?.status} did not record the expected owned presentation path`);
    }
  }
}
function firstStageSequence(stages, stage, status) {
  return stages.find(item => item?.stage === stage && item?.status === status)?.sequence;
}
function failedDirectoryAudit(root, error) { return {schemaVersion: 2, kind: 'native-mixed-edit-audit', passed: false, tolerancePoints: GEOMETRY_TOLERANCE_PT, failures: [{code: 'audit-error', message: error?.message ?? String(error)}], previewLineBreakLimit: null, scope: 'Offline raw-file, lifecycle, content, style, line, and 0.02pt outer-geometry audit. No Office process is started.', evidenceDirectory: root, artifactHashes: {}}; }

export async function auditMixedEditDirectory(evidenceDirectory) {
  const root = path.resolve(evidenceDirectory);
  try {
    const failures = [], artifactHashes = {};
    const files = {
      report: path.join(root, 'report.json'), worker: path.join(root, 'worker.json'), supervisor: path.join(root, 'supervisor.json'), request: path.join(root, 'request.json'), stages: path.join(root, 'stages.jsonl'), progress: path.join(root, 'progress.json'), registrations: path.join(root, 'font-registration.json'),
      saved: path.join(root, 'native-mixed-edit.pptx'), originalPng: path.join(root, 'original.png'), editedPng: path.join(root, 'edited.png'), reopenedPng: path.join(root, 'reopened.png'), source: path.join(root, 'inputs', 'source.pptx'),
      verifier: path.join(root, 'inputs', 'native-mixed-edit.ps1'), processHelper: path.join(root, 'inputs', 'native-process.ps1'), fontHelper: path.join(root, 'inputs', 'native-text-fonts.ps1'), generation: path.join(root, 'inputs', 'generation.json'), license: path.join(root, 'inputs', 'LICENSE_FONT'),
    };
    const [reportRecord, workerRecord, supervisorRecord, requestRecord, generationRecord, registrationRecord, progressRecord] = await Promise.all([readJson(files.report), readJson(files.worker), readJson(files.supervisor), readJson(files.request), readJson(files.generation), readJson(files.registrations), readJson(files.progress)]);
    const report = reportRecord.value, worker = workerRecord.value, supervisor = supervisorRecord.value, request = requestRecord.value, generation = generationRecord.value;
    const registrations = Array.isArray(registrationRecord.value) ? registrationRecord.value : [registrationRecord.value];
    for (const [name, record] of Object.entries({report: reportRecord, worker: workerRecord, supervisor: supervisorRecord, request: requestRecord, generation: generationRecord, registrations: registrationRecord, progress: progressRecord})) artifactHashes[`${name}.json`] = sha256(record.bytes);
    const evaluation = evaluateMixedEditReport(report); failures.push(...evaluation.failures);
    const workerStarted = Date.parse(worker?.startedAt), workerFinished = Date.parse(worker?.finishedAt);
    if (worker?.exitCode !== 0 || worker?.timedOut !== false || !integer(worker?.timeoutSeconds) || worker.timeoutSeconds < 5 || worker.timeoutSeconds > 60 || !Number.isFinite(workerStarted) || !Number.isFinite(workerFinished) || workerFinished < workerStarted || workerFinished - workerStarted > (worker.timeoutSeconds + 5) * 1000) push(failures, 'worker', 'native worker must exit 0 without timeout under a valid 5-60 second bound and recorded duration');
    if (supervisor?.timedOut !== false || supervisor?.exitCode !== 0 || supervisor?.officeLifecycleComplete !== true || supervisor?.officeCleanupConfirmed !== true || supervisor?.fontCleanupConfirmed !== true || supervisor?.lastDurableStage !== 'worker.complete' || supervisor?.parentError !== null || supervisor?.metricsGatePassed !== null || supervisor?.metricsOwnedBy !== 'test/native-mixed-edit-audit.mjs' || supervisor?.tolerancePoints !== GEOMETRY_TOLERANCE_PT) push(failures, 'supervisor', 'raw supervisor does not confirm the bounded owned Office/font lifecycle with offline metrics still unset');
    if (report?.metrics?.evaluatedBy !== 'test/native-mixed-edit-audit.mjs' || report?.metrics?.gatePassed !== null || report?.metrics?.tolerancePoints !== GEOMETRY_TOLERANCE_PT || report?.metrics?.previewLineBreakLimitFailsHarness !== false) push(failures, 'report-metrics', 'raw worker report must leave the offline metric gate unset and preserve the 0.02pt/preview-limit contract');
    if (JSON.stringify(report?.requested) !== JSON.stringify(request?.expectations)) push(failures, 'request', 'report.requested differs from immutable request expectations');
    if (request?.source?.sha256 !== PINNED_SOURCE_SHA256 || request?.source?.snapshotSha256 !== PINNED_SOURCE_SHA256) push(failures, 'source-hash', 'request source hashes are not canonical');
    expectExactPath(failures, 'request source snapshot', request?.source?.snapshotPath, files.source); expectExactPath(failures, 'report source snapshot', report?.source?.snapshotPath, files.source);
    if (typeof report?.source?.path !== 'string' || typeof request?.source?.path !== 'string' || !samePath(report.source.path, request.source.path)) push(failures, 'source-hash', 'report source path differs from request source path');
    expectExactPath(failures, 'report saved path', report?.saved?.path, files.saved); expectExactPath(failures, 'report original raster path', report?.original?.raster?.path, files.originalPng); expectExactPath(failures, 'report edited raster path', report?.edited?.raster?.path, files.editedPng); expectExactPath(failures, 'report reopened raster path', report?.reopened?.raster?.path, files.reopenedPng);
    const sourceHash = await hashRequired(files.source, failures, 'source-hash', artifactHashes, PINNED_SOURCE_SHA256, 'inputs/source.pptx');
    if (typeof request?.source?.path !== 'string') push(failures, 'source-hash', 'external source path is missing'); else await hashRequired(request.source.path, failures, 'source-hash', artifactHashes, PINNED_SOURCE_SHA256, 'external-source.pptx');
    if (sourceHash !== report?.source?.snapshotSha256) push(failures, 'source-hash', 'report source snapshot hash differs from actual bytes');
    const savedHash = await hashRequired(files.saved, failures, 'saved-bytes', artifactHashes, null, 'native-mixed-edit.pptx');
    if (savedHash !== report?.saved?.sha256 || savedHash !== report?.reopened?.sha256) push(failures, 'saved-bytes', 'actual saved PPTX hash differs from report saved/reopened hashes');
    for (const [key, file, expected] of [['original', files.originalPng, report?.original?.raster?.sha256], ['edited', files.editedPng, report?.edited?.raster?.sha256], ['reopened', files.reopenedPng, report?.reopened?.raster?.sha256]]) {
      const actual = await hashRequired(file, failures, 'raster-hash', artifactHashes, null, `${key}.png`); if (!hexSha(expected) || actual !== expected) push(failures, 'raster-hash', `${key} PNG hash differs from actual bytes`);
    }
    for (const [key, file] of [['verifier', files.verifier], ['processHelper', files.processHelper], ['fontHelper', files.fontHelper]]) {
      const item = request?.[key]; expectExactPath(failures, `${key} snapshot`, item?.snapshotPath, file);
      const actual = await hashRequired(file, failures, 'snapshot-hash', artifactHashes, null, `inputs/${path.basename(file)}`);
      if (!hexSha(item?.sha256) || item?.snapshotSha256 !== item?.sha256 || actual !== item?.sha256) push(failures, 'snapshot-hash', `${key} snapshot is not bound to its request hash`);
    }
    if (request?.fontHelper?.registrationFlags !== 0) push(failures, 'font-fixture', 'request font helper registrationFlags must be the JSON number 0');
    const reviewedCompanions = {verifier: path.join(path.dirname(fileURLToPath(import.meta.url)), 'native-mixed-edit.ps1'), processHelper: path.join(path.dirname(fileURLToPath(import.meta.url)), 'native-process.ps1'), fontHelper: path.join(path.dirname(fileURLToPath(import.meta.url)), 'native-text-fonts.ps1')};
    for (const [key, reviewedPath] of Object.entries(reviewedCompanions)) {
      const reviewed = await hashRequired(reviewedPath, failures, 'snapshot-version', artifactHashes, null, `reviewed/${path.basename(reviewedPath)}`);
      if (!reviewed || request?.[key]?.sha256 !== reviewed) push(failures, 'snapshot-version', `${key} snapshot does not match the reviewed companion beside this audit`);
    }
    await hashRequired(files.license, failures, 'font-license', artifactHashes, PINNED_LICENSE_SHA256, 'inputs/LICENSE_FONT');
    if (generation?.registration?.flags !== 0 || !Array.isArray(generation?.fonts) || generation.fonts.length !== 4) push(failures, 'font-fixture', 'generation must use numeric flags 0 and exactly four pinned Carlito faces');
    const expectedFontNames = Object.keys(PINNED_FONT_SHA256).sort(), generationNames = (generation?.fonts ?? []).map(item => item?.file).sort();
    if (JSON.stringify(generationNames) !== JSON.stringify(expectedFontNames)) push(failures, 'font-fixture', 'generation font paths differ from the four pinned Carlito faces');
    for (const name of expectedFontNames) {
      const expected = PINNED_FONT_SHA256[name], generated = generation?.fonts?.find(item => item?.file === name);
      if (generated?.sha256 !== expected) push(failures, 'font-fixture', `${name} generation hash is not pinned`);
      await hashRequired(path.join(root, 'inputs', ...name.split('/')), failures, 'font-fixture', artifactHashes, expected, `inputs/${name}`);
    }
    if (registrations.length !== 4) push(failures, 'font-cleanup', 'font-registration.json must contain exactly four records');
    const registrationNames = registrations.map(item => item?.file).sort();
    if (new Set(registrationNames).size !== 4 || JSON.stringify(registrationNames) !== JSON.stringify(expectedFontNames)) push(failures, 'font-cleanup', 'font registration paths must be the four unique pinned faces');
    for (const item of registrations) if (PINNED_FONT_SHA256[item?.file] !== item?.sha256 || !integer(item?.added) || item.added < 1 || item?.removed !== true) push(failures, 'font-cleanup', `font registration was not pinned, added, and removed: ${item?.file}`);
    const stageBytes = await readFile(files.stages); artifactHashes['stages.jsonl'] = sha256(stageBytes);
    const stageText = stageBytes.toString('utf8').replace(/^\uFEFF/, '').trim(); const stages = stageText ? stageText.split(/\r?\n/u).map(line => JSON.parse(line)) : [];
    if (stages.length === 0) push(failures, 'stages', 'stages.jsonl is empty');
    for (let index = 0; index < stages.length; index += 1) { const item = stages[index]; if (item?.sequence !== index + 1 || !['begin', 'success'].includes(item?.status) || item?.error !== null || item?.officeOperationsStopped !== false || !Number.isFinite(Date.parse(item?.timestamp))) push(failures, 'stages', `stage record ${index + 1} is noncontiguous, has an invalid timestamp, or records an error`); }
    const singletonNames = new Set(['worker.initialize', 'edited.presentation.cleanup', 'reopened.presentation.cleanup', 'worker.complete']);
    const grouped = new Map();
    for (const item of stages) { if (!grouped.has(item?.stage)) grouped.set(item?.stage, []); grouped.get(item?.stage).push(item); }
    for (const [stage, records] of grouped) {
      if (singletonNames.has(stage)) { if (records.length !== 1 || records[0]?.status !== 'success') push(failures, 'stage-pair', `${stage} must be one success record`); }
      else expectPairedStage(failures, stages, stage);
    }
    expectPairedStage(failures, stages, 'input.presentation.open', files.source);
    expectPairedStage(failures, stages, 'edited.presentation.saveAs-owned-copy', files.source);
    expectPairedStage(failures, stages, 'reopen.presentation.open-readonly', files.saved);
    for (const phase of ['edited.presentation', 'reopened.presentation']) {
      expectPairedStage(failures, stages, `${phase}.fullName.get`, files.saved); expectPairedStage(failures, stages, `${phase}.close`, files.saved); expectStage(failures, stages, `${phase}.cleanup`, 'success', null);
    }
    expectStage(failures, stages, 'worker.complete', 'success', null);
    const closePairs = stages.filter(item => item?.stage?.endsWith('.close') && item?.status === 'success');
    if (closePairs.length !== 2 || !closePairs.some(item => item.stage === 'edited.presentation.close') || !closePairs.some(item => item.stage === 'reopened.presentation.close')) push(failures, 'owned-close', 'exactly the edited and reopened owned presentations must be closed');
    const orderedMilestones = [
      firstStageSequence(stages, 'input.presentation.open', 'success'),
      firstStageSequence(stages, 'edited.presentation.saveAs-owned-copy', 'success'),
      firstStageSequence(stages, 'edited.presentation.close', 'success'),
      firstStageSequence(stages, 'edited.presentation.cleanup', 'success'),
      firstStageSequence(stages, 'reopen.presentation.open-readonly', 'success'),
      firstStageSequence(stages, 'reopened.presentation.close', 'success'),
      firstStageSequence(stages, 'reopened.presentation.cleanup', 'success'),
      firstStageSequence(stages, 'worker.complete', 'success'),
    ];
    if (!orderedMilestones.every(integer) || orderedMilestones.some((value, index) => index > 0 && value <= orderedMilestones[index - 1])) push(failures, 'stage-order', 'required open, save, close, reopen, close, and terminal milestones are missing or out of order');
    const first = stages[0]; if (first?.stage !== 'worker.initialize' || first?.status !== 'success' || first?.cleanupConfirmed !== true || first?.ownedPresentationPath !== null) push(failures, 'stages', 'worker.initialize must be the first durable stage with no owned presentation');
    const last = stages.at(-1); if (last?.stage !== 'worker.complete' || last?.status !== 'success' || last?.cleanupConfirmed !== true) push(failures, 'stages', 'worker.complete must be the final durable stage with cleanup confirmed');
    if (JSON.stringify(progressRecord.value) !== JSON.stringify(last)) push(failures, 'progress', 'progress.json does not equal the final durable stages.jsonl record');
    if (!Number.isFinite(Date.parse(supervisor?.timestamp)) || !Number.isFinite(Date.parse(last?.timestamp)) || Date.parse(supervisor.timestamp) < Date.parse(last.timestamp) || Date.parse(supervisor.timestamp) < workerFinished) push(failures, 'supervisor', 'supervisor terminal timestamp must follow the final durable worker stage and worker completion');
    return {schemaVersion: 2, kind: 'native-mixed-edit-audit', passed: failures.length === 0, tolerancePoints: GEOMETRY_TOLERANCE_PT, failures, previewLineBreakLimit: evaluation.previewLineBreakLimit, scope: 'Offline raw-file, lifecycle, content, style, line, and 0.02pt outer-geometry audit. No Office process is started.', evidenceDirectory: root, artifactHashes, reportSha256: sha256(reportRecord.bytes)};
  } catch (error) { return failedDirectoryAudit(root, error); }
}

async function runCli() {
  if (process.argv.length !== 3) { console.error('Usage: node test/native-mixed-edit-audit.mjs <fresh-evidence-directory>'); process.exitCode = 2; return; }
  const root = path.resolve(process.argv[2]), auditPath = path.join(root, 'audit.json'), result = await auditMixedEditDirectory(root);
  try { await writeFile(auditPath, `${JSON.stringify(result, null, 2)}\n`, {flag: 'wx'}); }
  catch (error) { console.error(JSON.stringify({passed: false, code: 'audit-write', message: error.message, auditPath})); process.exitCode = 2; return; }
  console.log(JSON.stringify({passed: result.passed, failures: result.failures.length, auditPath})); process.exitCode = result.passed ? 0 : 1;
}
const entry = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entry && samePath(entry, fileURLToPath(import.meta.url))) await runCli();
