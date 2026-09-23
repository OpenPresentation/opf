import {createHash} from 'node:crypto';
import {realpathSync} from 'node:fs';
import {readdir, readFile, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  auditCanonicalFixtureManifest,
  hasOfficeQuitInvocation,
  PERMITTED_CARLITO_FIXTURE,
  PERMITTED_CARLITO_FIXTURE_FILES,
  PERMITTED_CARLITO_LICENSE_SHA256,
  PERMITTED_NATIVE_FONT_NAMES,
  stripPowerShellLiteralsForScan,
} from './native-font-embed-audit.mjs';

const __filename = fileURLToPath(import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const parse = bytes => JSON.parse(Buffer.from(bytes).toString('utf8').replace(/^﻿/, ''));
const isInt = value => typeof value === 'number' && Number.isInteger(value);
const isHash = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const isDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
// .NET GetFullPath expands Windows 8.3 short names (RUNNER~1) while Node keeps
// them, so existing paths are compared by their native real path.
const realPaths = new Map();
const realPath = value => {
  const resolved = path.resolve(value);
  if (!realPaths.has(resolved)) { let actual = resolved; try { actual = realpathSync.native(resolved); } catch { /* missing path: compare lexically */ } realPaths.set(resolved, actual); }
  return realPaths.get(resolved);
};
const samePath = (left, right) => {
  if (typeof left !== 'string' || typeof right !== 'string' || !left || !right) return false;
  const a = realPath(left), b = realPath(right);
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
};
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : isObject(value) ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}` : JSON.stringify(value ?? null);

export const INVENTORY_BOUNDS = Object.freeze({maxPresentationFonts: 64, maxSlides: 2, maxShapesPerSlide: 10, maxParagraphsPerShape: 12, maxParagraphsTotal: 24, maxRunsPerShape: 24, maxRunsTotal: 40, maxTextCharacters: 1024});
export const FONT2_SLOTS = Object.freeze(['name', 'nameAscii', 'nameOther', 'nameFarEast', 'nameComplexScript']);
const FONT2_PROPERTIES = Object.freeze([...FONT2_SLOTS, 'size', 'bold', 'italic']);
const THEME_SLOTS = Object.freeze(['latin', 'complexScript', 'eastAsian']);
const INPUT_MODES = Object.freeze({'carlito-fixture': ['temporary-session', 'none'], 'control-deck': ['none']});
// Every invoked member must be on this allowlist, which mirrors the worker's
// own AST policy: PowerPoint calls (Open, Close, Item, Paragraphs, Runs) plus
// named .NET helpers. Add, ApplyTemplate, ApplyTheme, SaveAs, Quit and every
// other member are rejected. COM property reads are not invocations.
export const ALLOWED_COM_MEMBERS = Object.freeze(['Open', 'Close', 'Item', 'Paragraphs', 'Runs']);
export const ALLOWED_INSTANCE_MEMBERS = Object.freeze(['Contains', 'ContainsKey', 'FindAll', 'GetCommandName', 'StartsWith', 'Substring', 'ToLowerInvariant', 'ToString', 'ToUniversalTime', 'TrimEnd']);
export const ALLOWED_STATIC_MEMBERS = Object.freeze(['GetExtension', 'GetFullPath', 'GetTempPath', 'IsNullOrEmpty', 'IsNullOrWhiteSpace', 'Max', 'Min', 'NewGuid', 'ParseFile', 'Sort', 'WriteAllText']);
const FORBIDDEN_STAGE = /saveas|\.save|export|quit|printout|kill|delete|paste|apply|\.add|\.set$|\.set\./i;

export function invokedMembers(sourceText) {
  const code = stripPowerShellLiteralsForScan(sourceText);
  const instance = [...code.matchAll(/(?<!:)\.([A-Za-z_]\w*)\(/g)].map(match => match[1]);
  // PowerShell method invocation has no space before the parenthesis; `.Path (x)` is a property read then an argument.
  const statics = [...code.matchAll(/::([A-Za-z_]\w*)\(/g)].map(match => match[1]);
  return {instance: [...new Set(instance)].sort(), statics: [...new Set(statics)].sort(), dynamic: /\.\$\w+\(/.test(code)};
}

// Static read-only policy for the verifier snapshot, applied to code with
// string literals and comments removed.
export function auditInventoryVerifierSource(sourceText, {label = 'native-font-inventory.ps1'} = {}) {
  const failures = [];
  const code = stripPowerShellLiteralsForScan(sourceText);
  const add = (code, message) => failures.push({code, message: `${label} ${message}`});
  const members = invokedMembers(sourceText);
  const instanceAllowed = [...ALLOWED_COM_MEMBERS, ...ALLOWED_INSTANCE_MEMBERS];
  const rejected = [...members.instance.filter(name => !instanceAllowed.includes(name)), ...members.statics.filter(name => !ALLOWED_STATIC_MEMBERS.includes(name)).map(name => `::${name}`)];
  if (rejected.length || members.dynamic) add('forbidden-member', `invokes members outside the read-only allowlist: ${[...rejected, ...(members.dynamic ? ['dynamic member'] : [])].join(', ')}`);
  if (hasOfficeQuitInvocation(sourceText)) add('application-quit', 'must not call Application.Quit or .Quit()');
  if (/\b(?:Stop-Process|taskkill|spps)\b/i.test(code)) add('process-kill', 'must not terminate processes');
  const opens = code.match(/\.Open\s*\(/g) ?? [], closes = code.match(/\.Close\s*\(/g) ?? [];
  if (opens.length !== 1) add('open-count', `must contain exactly one Open call; found ${opens.length}`);
  if (closes.length !== 1) add('close-count', `must contain exactly one Close call; found ${closes.length}`);
  if (!/\$presentations\.Open\(\$sourceSnapshot,\(-1\),0,0\)/.test(code)) add('open-readonly', 'must open the owned snapshot with ReadOnly -1, Untitled 0, WithWindow 0');
  if (!/\$script:presentation\.Close\(\)/.test(code)) add('owned-close', 'must close only the owned presentation object');
  if ((code.match(/-ComObject/g) ?? []).length !== 1 || !/New-Object -ComObject PowerPoint\.Application/.test(code)) add('com-construction', 'must construct exactly one PowerPoint.Application');
  return failures;
}

const aptos = name => typeof name === 'string' && /^aptos/i.test(name);
const sortedDistinct = values => [...new Set(values.filter(value => typeof value === 'string' && value.length > 0))].sort();
const shapeSlotValues = shapes => (Array.isArray(shapes) ? shapes : []).flatMap(shape => [
  ...(isObject(shape?.rangeFont) ? [shape.rangeFont] : []),
  ...(Array.isArray(shape?.paragraphs) ? shape.paragraphs.map(item => item?.font) : []),
  ...(Array.isArray(shape?.runs) ? shape.runs.map(item => item?.font) : []),
].flatMap(font => FONT2_SLOTS.map(slot => font?.[slot])));

// Independent recomputation of the worker's fontLedger from raw observations.
export function computeFontLedger(report) {
  const presentationFontNames = sortedDistinct((report?.presentationFonts?.entries ?? []).map(entry => entry?.name));
  const slideShapes = (report?.slides?.entries ?? []).flatMap(slide => Array.isArray(slide?.shapes) ? slide.shapes : []);
  const slideTextSlotNames = sortedDistinct(shapeSlotValues(slideShapes));
  const masterTextSlotNames = sortedDistinct(shapeSlotValues(report?.slideMaster?.shapes));
  const themeFontNames = sortedDistinct(['major', 'minor'].flatMap(kind => THEME_SLOTS.map(slot => report?.theme?.[kind]?.[slot])));
  const nonCarlito = presentationFontNames.filter(name => !PERMITTED_NATIVE_FONT_NAMES.includes(name));
  const ledger = {
    presentationFontNames, slideTextSlotNames, masterTextSlotNames, themeFontNames,
    aptosPresentationFontNames: presentationFontNames.filter(aptos), aptosSlideTextSlotNames: slideTextSlotNames.filter(aptos),
    aptosMasterTextSlotNames: masterTextSlotNames.filter(aptos), aptosThemeFontNames: themeFontNames.filter(aptos),
    nonCarlitoPresentationFontNames: nonCarlito, carlitoOnlyPresentationFonts: presentationFontNames.length >= 1 && nonCarlito.length === 0,
  };
  ledger.aptosReported = [ledger.aptosPresentationFontNames, ledger.aptosSlideTextSlotNames, ledger.aptosMasterTextSlotNames, ledger.aptosThemeFontNames].some(list => list.length > 0);
  return ledger;
}

function validFont2(font) {
  return isObject(font) && FONT2_SLOTS.every(slot => typeof font[slot] === 'string') && typeof font.size === 'number' && Number.isFinite(font.size) && isInt(font.bold) && isInt(font.italic);
}
function validSubrange(item, index) {
  return isObject(item) && item.index === index && isInt(item.start) && isInt(item.length) && typeof item.text === 'string' && item.text.length <= INVENTORY_BOUNDS.maxTextCharacters && typeof item.textTruncated === 'boolean' && validFont2(item.font);
}

// Validate the raw observation tree and build the exact COM stage sequence
// it implies. Each entry is [stageName, 'pair'|'single'].
export function expectedInventoryStages(report, failures = []) {
  const need = (condition, code, message) => { if (!condition) failures.push({code, message}); };
  const stages = [];
  const pair = name => stages.push([name, 'pair']);
  const font2 = prefix => { pair(`${prefix}.font.get`); for (const property of FONT2_PROPERTIES) pair(`${prefix}.font.${property}.get`); };
  const totals = {paragraphs: 0, runs: 0};
  const shapes = (prefix, record, label) => {
    pair(`${prefix}.shapes.count.get`);
    const list = record?.shapes;
    need(isInt(record?.shapeCount) && record.shapeCount >= 0 && record.shapeCount <= INVENTORY_BOUNDS.maxShapesPerSlide && Array.isArray(list) && list.length === record.shapeCount, 'observation-shapes', `${label} shapes must be complete and within bounds`);
    for (const [offset, shape] of (Array.isArray(list) ? list : []).entries()) {
      const shapePrefix = `${prefix}.shape-${offset + 1}`;
      for (const suffix of ['get', 'name.get', 'type.get', 'hasTextFrame.get']) pair(`${shapePrefix}.${suffix}`);
      need(isObject(shape) && shape.index === offset + 1 && typeof shape.name === 'string' && isInt(shape.type) && [0, -1].includes(shape.hasTextFrame), 'observation-shape', `${shapePrefix} identity is invalid`);
      if (shape?.hasTextFrame !== -1) {
        need(shape?.hasText === null && shape?.text === null && shape?.rangeFont === null && shape?.paragraphCount === null && shape?.runCount === null && Array.isArray(shape?.paragraphs) && shape.paragraphs.length === 0 && Array.isArray(shape?.runs) && shape.runs.length === 0, 'observation-shape', `${shapePrefix} without a text frame must not carry text observations`);
        continue;
      }
      for (const suffix of ['textFrame2.get', 'hasText.get', 'textRange2.get', 'text.get', 'length.get']) pair(`${shapePrefix}.${suffix}`);
      font2(shapePrefix);
      need([0, -1].includes(shape.hasText) && typeof shape.text === 'string' && shape.text.length <= INVENTORY_BOUNDS.maxTextCharacters && isInt(shape.textLength) && typeof shape.textTruncated === 'boolean' && validFont2(shape.rangeFont), 'observation-range', `${shapePrefix} whole-range observation is invalid`);
      if (shape.hasText !== -1) {
        need(shape.paragraphCount === null && shape.runCount === null && Array.isArray(shape.paragraphs) && shape.paragraphs.length === 0 && Array.isArray(shape.runs) && shape.runs.length === 0, 'observation-range', `${shapePrefix} without text must not carry paragraph or run observations`);
        continue;
      }
      pair(`${shapePrefix}.paragraphs.get`); pair(`${shapePrefix}.paragraphs.count.get`);
      need(isInt(shape.paragraphCount) && shape.paragraphCount >= 0 && shape.paragraphCount <= INVENTORY_BOUNDS.maxParagraphsPerShape && Array.isArray(shape.paragraphs) && shape.paragraphs.length === shape.paragraphCount, 'observation-paragraphs', `${shapePrefix} paragraphs must be complete and within bounds`);
      for (const [index, paragraph] of (Array.isArray(shape.paragraphs) ? shape.paragraphs : []).entries()) {
        const paragraphPrefix = `${shapePrefix}.paragraph-${index + 1}`;
        for (const suffix of ['get', 'text.get', 'start.get', 'length.get']) pair(`${paragraphPrefix}.${suffix}`);
        font2(paragraphPrefix);
        need(validSubrange(paragraph, index + 1), 'observation-paragraph', `${paragraphPrefix} is invalid`);
      }
      totals.paragraphs += Array.isArray(shape.paragraphs) ? shape.paragraphs.length : 0;
      pair(`${shapePrefix}.runs.get`); pair(`${shapePrefix}.runs.count.get`);
      need(isInt(shape.runCount) && shape.runCount >= 0 && shape.runCount <= INVENTORY_BOUNDS.maxRunsPerShape && Array.isArray(shape.runs) && shape.runs.length === shape.runCount, 'observation-runs', `${shapePrefix} runs must be complete and within bounds`);
      for (const [index, run] of (Array.isArray(shape.runs) ? shape.runs : []).entries()) {
        const runPrefix = `${shapePrefix}.run-${index + 1}`;
        for (const suffix of ['get', 'text.get', 'start.get', 'length.get']) pair(`${runPrefix}.${suffix}`);
        font2(runPrefix);
        need(validSubrange(run, index + 1), 'observation-run', `${runPrefix} is invalid`);
      }
      totals.runs += Array.isArray(shape.runs) ? shape.runs.length : 0;
    }
  };

  stages.push(['worker.initialize', 'single']);
  pair('application.create'); pair('application.version.get');
  pair('input.preflight.presentations.get'); pair('input.preflight.presentations.count.get');
  const preflight = report?.preflightPresentationCount;
  need(isInt(preflight) && preflight >= 0 && preflight <= 32, 'observation-preflight', 'preflightPresentationCount must be an integer from 0 to 32');
  for (let index = 1; isInt(preflight) && index <= Math.min(preflight, 32); index++) { pair(`input.preflight.presentation-${index}.get`); pair(`input.preflight.presentation-${index}.fullName.get`); }
  pair('input.presentations.get'); pair('input.presentation.open-readonly');
  pair('owned.presentation.fullName.get'); pair('owned.presentation.readOnly.get');
  need(report?.source?.readOnly === -1, 'observation-read-only', 'PowerPoint must report the owned presentation ReadOnly = -1');
  pair('owned.presentation.fonts.get'); pair('owned.presentation.fonts.count.get');
  const fonts = report?.presentationFonts;
  need(isInt(fonts?.count) && fonts.count >= 0 && fonts.count <= INVENTORY_BOUNDS.maxPresentationFonts && Array.isArray(fonts?.entries) && fonts.entries.length === fonts.count, 'observation-fonts', 'Presentation.Fonts must be complete and within 64 entries');
  for (const [offset, entry] of (Array.isArray(fonts?.entries) ? fonts.entries : []).entries()) {
    for (const suffix of ['get', 'name.get', 'embedded.get', 'embeddable.get']) pair(`owned.presentation.fonts.item-${offset + 1}.${suffix}`);
    need(isObject(entry) && entry.index === offset + 1 && typeof entry.name === 'string' && entry.name.length > 0 && isInt(entry.embedded) && isInt(entry.embeddable), 'observation-font-entry', `Presentation.Fonts item ${offset + 1} is invalid`);
  }
  pair('owned.presentation.slideMaster.get'); pair('owned.slideMaster.theme.get'); pair('owned.theme.themeFontScheme.get');
  for (const kind of ['major', 'minor']) {
    pair(`owned.theme.${kind}Font.get`);
    for (const slot of THEME_SLOTS) { pair(`owned.theme.${kind}Font.${slot}.get`); pair(`owned.theme.${kind}Font.${slot}.name.get`); }
    need(isObject(report?.theme?.[kind]) && THEME_SLOTS.every(slot => typeof report.theme[kind][slot] === 'string'), 'observation-theme', `Theme ${kind} font slots must be strings`);
  }
  pair('owned.presentation.slides.get'); pair('owned.presentation.slides.count.get');
  const slides = report?.slides;
  need(isInt(slides?.count) && slides.count >= 0 && slides.count <= INVENTORY_BOUNDS.maxSlides && Array.isArray(slides?.entries) && slides.entries.length === slides.count, 'observation-slides', 'Slides must be complete and within bounds');
  for (const [offset, slide] of (Array.isArray(slides?.entries) ? slides.entries : []).entries()) {
    const prefix = `owned.slide-${offset + 1}`;
    pair(`${prefix}.get`); pair(`${prefix}.shapes.get`);
    need(isObject(slide) && slide.index === offset + 1, 'observation-slide', `${prefix} index is invalid`);
    shapes(prefix, slide, prefix);
  }
  pair('owned.slideMaster.shapes.get');
  shapes('owned.slideMaster', report?.slideMaster, 'Slide master');
  need(totals.paragraphs <= INVENTORY_BOUNDS.maxParagraphsTotal && totals.runs <= INVENTORY_BOUNDS.maxRunsTotal, 'observation-totals', 'Paragraph and run totals exceed the bounded inventory');
  pair('owned.presentation.fullName-before-close.get'); pair('owned.presentation.close');
  stages.push(['owned.presentation.cleanup', 'single'], ['worker.complete', 'single']);
  return stages;
}

// Diagnostic for failed attempts: after a failure the worker closes the owned
// presentation once only when no COM call failed and FullName is still the
// owned snapshot; otherwise it leaves it open with cleanupConfirmed=false.
// A passing audit additionally requires failureCleanup to be null.
const ERROR_CLOSE = 'owned.presentation.error';
export function analyzeFailureCleanup(report, stages) {
  const rows = Array.isArray(stages) ? stages : [], problems = [];
  const need = (condition, message) => { if (!condition) problems.push(message); };
  const final = rows.at(-1), outcome = report?.failureCleanup ?? null;
  const failed = final?.stage === 'worker.failure' && final?.status === 'error';
  const closeInvocations = rows.filter(row => typeof row?.stage === 'string' && row.stage.endsWith('.close') && row.status === 'begin').length;
  const errorRows = rows.filter(row => typeof row?.stage === 'string' && row.stage.startsWith(`${ERROR_CLOSE}.`));
  const errorSequence = errorRows.map(row => `${row.stage}/${row.status}`).join(',');
  if (!failed) {
    need(outcome === null && errorRows.length === 0, 'Only a terminal worker.failure may record failureCleanup or error-close stages');
    return {applicable: false, outcome, closeInvocations, consistent: problems.length === 0, problems};
  }
  need(closeInvocations <= 1, 'Close was invoked more than once');
  const fullNameCheck = `${ERROR_CLOSE}.fullName-before-close.get/begin,${ERROR_CLOSE}.fullName-before-close.get/success`;
  const comFailure = rows.slice(0, -1).some(row => row?.status === 'error');
  const opened = rows.some(row => row?.stage === 'input.presentation.open-readonly' && row?.status === 'success');
  const closedNormally = rows.some(row => row?.stage === 'owned.presentation.close' && row?.status === 'success');
  if (outcome === 'closed-owned-after-failure') {
    need(errorSequence === `${fullNameCheck},${ERROR_CLOSE}.close/begin,${ERROR_CLOSE}.close/success,${ERROR_CLOSE}.cleanup/success`, 'Error close must be one FullName check, one close and one cleanup');
    need(errorRows.length > 0 && rows.indexOf(errorRows.at(-1)) === rows.length - 2, 'Error cleanup must directly precede worker.failure');
    need(!comFailure && report?.officeOperationsStopped === false, 'An error close must not follow a COM failure');
    need(opened && !closedNormally, 'An error close requires an owned open and no earlier close');
    need(report?.cleanupConfirmed === true && report?.ownedCloseCount === 1 && final?.cleanupConfirmed === true && final?.ownedPresentationPath === null, 'An error close must confirm cleanup with exactly one owned close');
  } else if (outcome === 'left-open-com-latched') {
    need(comFailure && report?.officeOperationsStopped === true, 'The latched outcome requires a recorded COM failure');
    need(errorRows.length === 0 && report?.cleanupConfirmed === false, 'After a COM failure nothing is closed and cleanup stays unconfirmed');
  } else if (typeof outcome === 'string' && outcome.startsWith('left-open-not-closed')) {
    need(!errorSequence.includes(`${ERROR_CLOSE}.close/`) && report?.cleanupConfirmed === false, 'A presentation that is not proven owned must stay open with cleanup unconfirmed');
  } else if (outcome === 'no-owned-presentation-open') {
    need(errorRows.length === 0 && (!opened || closedNormally), 'No owned presentation may remain open when none is reported');
  } else problems.push(`Unknown failureCleanup outcome: ${outcome}`);
  return {applicable: true, outcome, closeInvocations, consistent: problems.length === 0, problems};
}

function auditLifecycle({request, report, supervisor, worker, progress, stages, registrations, registrationFilePresent}) {
  const failures = [];
  const need = (condition, code, message) => { if (!condition) failures.push({code, message}); };
  const mode = request?.fontRegistration?.mode;
  need(report?.kind === 'native-font-inventory' && report?.schemaVersion === 1, 'report-kind', 'report.json must be native-font-inventory schema 1');
  need(report?.error === null && report?.cleanupConfirmed === true && report?.officeOperationsStopped === false && report?.ownedOpenCount === 1 && report?.ownedCloseCount === 1 && report?.lastStage === 'worker.complete' && report?.lastStatus === 'success' && report?.failureCleanup === null, 'report-lifecycle', 'Worker report must end successfully with confirmed cleanup, one owned open and one owned close');
  need(report?.source?.openedPathMatches === true && samePath(report?.source?.fullName, report?.source?.snapshotPath) && report?.source?.readOnly === -1 && report?.source?.snapshotUnchangedAfterClose === true, 'report-read-only', 'The opened FullName must be the owned snapshot, ReadOnly must be -1, and the snapshot must be unchanged after close');
  need(Array.isArray(report?.boundsExceeded) && report.boundsExceeded.length === 0 && Array.isArray(report?.semanticFailures) && report.semanticFailures.length === 0, 'report-complete', 'The inventory must be complete with no exceeded bounds or semantic failures');
  need(canonical(report?.bounds) === canonical(INVENTORY_BOUNDS) && canonical(request?.bounds) === canonical(INVENTORY_BOUNDS), 'bounds', 'Request and report bounds must equal the reviewed inventory bounds');
  need(report?.inputMode === request?.inputMode && canonical(report?.fontRegistration) === canonical(request?.fontRegistration), 'report-request-binding', 'Worker input and registration modes must match request.json');
  need(worker?.timedOut === false && worker?.exitCode === 0 && isInt(worker?.timeoutSeconds) && worker.timeoutSeconds >= 5 && worker.timeoutSeconds <= 60 && isInt(worker?.processId) && worker.processId > 0 && isDate(worker?.startedAt) && isDate(worker?.finishedAt) && Date.parse(worker.finishedAt) >= Date.parse(worker.startedAt), 'worker-outcome', 'Owned worker must exit 0 without timeout within the 5-60 second helper bound');
  const cleanupExpectation = mode === 'temporary-session' ? supervisor?.fontCleanupConfirmed === true : supervisor?.fontCleanupConfirmed === null;
  need(supervisor?.passed === true && supervisor?.timedOut === false && supervisor?.exitCode === 0 && supervisor?.officeLifecycleComplete === true && supervisor?.readOnlyConfirmed === true && supervisor?.inventoryComplete === true && cleanupExpectation && supervisor?.registrationFilePresent === (mode === 'temporary-session') && supervisor?.inputsUnchanged === true && supervisor?.ownedOpenCount === 1 && supervisor?.ownedCloseCount === 1 && supervisor?.parentError === null && supervisor?.lastDurableStage === 'worker.complete' && supervisor?.lastDurableStatus === 'success' && supervisor?.inputMode === request?.inputMode && supervisor?.fontRegistrationMode === mode, 'supervisor-outcome', 'Supervisor must confirm lifecycle, read-only open, completeness, registration mode, inputs and one owned close');
  need(progress?.stage === 'worker.complete' && progress?.status === 'success' && progress?.cleanupConfirmed === true && progress?.officeOperationsStopped === false && progress?.ownedPresentationPath === null, 'progress-outcome', 'Durable progress must end at successful worker.complete');
  if (mode === 'temporary-session') {
    const files = Array.isArray(registrations) ? registrations.map(row => row?.file).sort() : [];
    need(Array.isArray(registrations) && registrations.length === 4 && JSON.stringify(files) === JSON.stringify([...PERMITTED_CARLITO_FIXTURE_FILES].sort()) && registrations.every(row => Object.hasOwn(PERMITTED_CARLITO_FIXTURE, row?.file) && row.sha256 === PERMITTED_CARLITO_FIXTURE[row.file] && isInt(row?.added) && row.added >= 1 && row?.removed === true), 'font-cleanup', 'Exactly the four canonical temporary registrations must record additions and removals');
  } else {
    need(registrationFilePresent === false, 'font-registration-absent', 'A run without temporary fonts must not produce font-registration.json');
  }

  const ledger = computeFontLedger(report);
  const {scope: _scope, ...reported} = isObject(report?.fontLedger) ? report.fontLedger : {};
  need(canonical(reported) === canonical(ledger), 'font-ledger', 'report.fontLedger must equal the ledger recomputed from raw observations');
  need(supervisor?.aptosReported === ledger.aptosReported && canonical(supervisor?.presentationFontNames) === canonical(ledger.presentationFontNames), 'supervisor-ledger', 'Supervisor font summary must match the recomputed ledger');

  const observationFailures = [];
  const expected = expectedInventoryStages(report, observationFailures);
  failures.push(...observationFailures);
  need(Array.isArray(stages) && stages.length > 0, 'stage-sequence', 'A complete durable stage sequence is required');
  if (!Array.isArray(stages) || stages.length === 0) return {failures, ledger};
  const rows = [];
  for (const [name, kind] of expected) { if (kind === 'pair') rows.push([name, 'begin'], [name, 'success']); else rows.push([name, 'success']); }
  need(stages.length === rows.length, 'stage-count', `Expected ${rows.length} stage records from the observation; found ${stages.length}`);
  const snapshotPath = report?.source?.snapshotPath;
  const openBegin = rows.findIndex(([name, status]) => name === 'input.presentation.open-readonly' && status === 'begin');
  const closeSuccess = rows.findIndex(([name, status]) => name === 'owned.presentation.close' && status === 'success');
  let firstMismatch = null;
  for (let index = 0; index < stages.length; index++) {
    const row = stages[index], want = rows[index];
    if (!want || row?.stage !== want[0] || row?.status !== want[1]) { firstMismatch ??= index + 1; continue; }
    need(row.sequence === index + 1 && row.error === null && row.officeOperationsStopped === false && isDate(row.timestamp), 'stage-record', `Stage ${index + 1} is noncontiguous, stopped, or records an error`);
    const owned = index >= openBegin && index <= closeSuccess;
    need(owned ? samePath(row.ownedPresentationPath, snapshotPath) && row.cleanupConfirmed === false : row.ownedPresentationPath === null && row.cleanupConfirmed === true, 'stage-ownership', `Stage ${index + 1} ${row.stage} has the wrong owned path or cleanup state`);
  }
  need(firstMismatch === null, 'stage-sequence', `Stage records differ from the sequence implied by the observation at sequence ${firstMismatch}`);
  const names = Array.isArray(stages) ? stages.map(row => row?.stage) : [];
  need(names.filter(name => typeof name === 'string' && /\.open(?:-|$)/.test(name) && name !== 'input.presentation.open-readonly').length === 0 && names.filter(name => name === 'input.presentation.open-readonly').length === 2, 'stage-open', 'Exactly one owned read-only open is permitted');
  need(names.filter(name => typeof name === 'string' && name.endsWith('.close')).length === 2 && names.filter(name => name === 'owned.presentation.close').length === 2, 'stage-close', 'Exactly one owned close is permitted');
  need(!names.some(name => typeof name === 'string' && FORBIDDEN_STAGE.test(name)), 'stage-forbidden', 'No save, export, quit, kill, delete, paste or set stage is permitted');
  const final = stages.at(-1);
  need(canonical(progress) === canonical(final), 'stage-terminal', 'progress.json must equal the final durable stage');
  need(isDate(supervisor?.timestamp) && isDate(final?.timestamp) && Date.parse(supervisor.timestamp) >= Date.parse(final.timestamp), 'supervisor-time', 'Supervisor completion must follow the final durable worker stage');
  return {failures, ledger};
}

async function readBound(root, relative, expected, role, failures, rawHashes) {
  const target = path.resolve(root, relative);
  if (!target.startsWith(root + path.sep)) { failures.push({code: 'input-path', message: `${role} escaped the evidence directory`}); return null; }
  try {
    const bytes = await readFile(target), actual = sha(bytes); rawHashes[relative.replaceAll('\\', '/')] = actual;
    if (actual !== expected) failures.push({code: 'input-hash', message: `${role} hash mismatch`});
    return bytes;
  } catch { failures.push({code: 'input-missing', message: `${role} is missing`}); return null; }
}

async function auditInputBindings(root, request, reviewedRoot) {
  const failures = [], rawHashes = {}, boundRecords = [];
  const need = (condition, code, message) => { if (!condition) failures.push({code, message}); };
  const fixture = request?.inputMode === 'carlito-fixture';
  const definitions = [
    ['inputs/source.pptx', request?.source, 'source'],
    ['inputs/native-font-inventory.ps1', request?.verifier, 'verifier'],
    ['inputs/native-process.ps1', request?.processHelper, 'process-helper'],
    ['inputs/native-text-fonts.ps1', request?.fontHelper, 'font-helper'],
  ];
  if (fixture) {
    definitions.push(['inputs/generation.json', request?.fixture?.generation, 'generation'], ['inputs/LICENSE_FONT', request?.fixture?.license, 'license', PERMITTED_CARLITO_LICENSE_SHA256]);
    const fonts = request?.fixture?.fonts;
    need(Array.isArray(fonts) && fonts.length === 4, 'request-font-count', 'Request must bind exactly four font inputs');
    for (const file of PERMITTED_CARLITO_FIXTURE_FILES) {
      const rows = Array.isArray(fonts) ? fonts.filter(item => item?.file === file) : [];
      need(rows.length === 1, 'request-font-binding', `Request must bind ${file} exactly once`);
      definitions.push([`inputs/${file}`, rows[0], `font:${file}`, PERMITTED_CARLITO_FIXTURE[file]]);
    }
    need(request?.fixture?.license?.spdx === 'OFL-1.1', 'request-license-binding', 'Request must identify the reviewed OFL-1.1 license');
  } else need(request?.fixture === null, 'request-control-fixture', 'A control-deck request must not bind a fixture');
  for (const [relative, item, role, pinned] of definitions) {
    const expected = pinned ?? item?.sha256, snapshotPath = path.resolve(root, relative);
    need(isHash(expected) && item?.sha256 === expected && item?.snapshotSha256 === expected, 'input-expected-hash', `${role} requires matching original and snapshot hashes`);
    need(samePath(item?.snapshotPath, snapshotPath), 'input-snapshot-path', `${role} snapshotPath must select ${relative}`);
    if (!isHash(expected)) continue;
    await readBound(root, relative, expected, role, failures, rawHashes);
    boundRecords.push({role, copy: 'snapshot', path: snapshotPath, expected});
    if (typeof item?.path !== 'string' || !item.path) { failures.push({code: 'input-original-path', message: `${role} original path is missing`}); continue; }
    try {
      const actual = sha(await readFile(item.path)); rawHashes[`original:${role}`] = actual;
      need(actual === expected, 'input-original-hash', `${role} original bytes changed`);
    } catch { failures.push({code: 'input-original-missing', message: `${role} original file cannot be read`}); }
    boundRecords.push({role, copy: 'original', path: item.path, expected});
  }
  for (const [key, name] of [['verifier', 'native-font-inventory.ps1'], ['processHelper', 'native-process.ps1'], ['fontHelper', 'native-text-fonts.ps1']]) {
    try {
      const reviewed = sha(await readFile(path.join(reviewedRoot, name))); rawHashes[`reviewed/${name}`] = reviewed;
      need(request?.[key]?.sha256 === reviewed, 'reviewed-verifier-binding', `${name} snapshot must match the reviewed companion beside this auditor`);
    } catch { failures.push({code: 'reviewed-verifier-missing', message: `Reviewed companion ${name} cannot be read`}); }
  }
  return {failures, rawHashes, boundRecords};
}

async function listing(directory) {
  try { return (await readdir(directory, {withFileTypes: true})).map(entry => entry.isDirectory() ? `${entry.name}/` : entry.name).sort(); } catch { return null; }
}

async function readRequired(root, relative, failures, rawHashes, parser = parse) {
  try { const bytes = await readFile(path.join(root, relative)); rawHashes[relative] = sha(bytes); return parser(bytes); }
  catch { failures.push({code: 'missing-evidence', message: `${relative} is required and must parse`}); return null; }
}

export async function auditEvidenceDirectory(evidenceDirectory, {reviewedRoot = path.dirname(__filename)} = {}) {
  const root = realPath(evidenceDirectory), failures = [], rawHashes = {};
  const need = (condition, code, message) => { if (!condition) failures.push({code, message}); };
  const request = await readRequired(root, 'request.json', failures, rawHashes);
  const report = await readRequired(root, 'report.json', failures, rawHashes);
  const supervisor = await readRequired(root, 'supervisor.json', failures, rawHashes);
  const worker = await readRequired(root, 'worker.json', failures, rawHashes);
  const progress = await readRequired(root, 'progress.json', failures, rawHashes);
  const stages = await readRequired(root, 'stages.jsonl', failures, rawHashes, bytes => {
    const text = Buffer.from(bytes).toString('utf8').replace(/^﻿/, '').trim();
    return text ? text.split(/\r?\n/).map(line => JSON.parse(line)) : [];
  });
  for (const [name, value] of Object.entries({request, report, supervisor, worker, progress})) need(isObject(value), 'evidence-object', `${name}.json must contain a JSON object`);
  const mode = request?.fontRegistration?.mode, inputMode = request?.inputMode;
  need(request?.kind === 'native-font-inventory' && request?.schemaVersion === 1 && Object.hasOwn(INPUT_MODES, inputMode ?? '') && INPUT_MODES[inputMode].includes(mode) && (mode === 'none' ? request?.fontRegistration?.flags === null : request?.fontRegistration?.flags === 0), 'request-mode', 'Request must select a reviewed input mode with a permitted registration mode and flags');

  const registrationFilePresent = (await listing(root))?.includes('font-registration.json') ?? false;
  let registrations = null;
  if (mode === 'temporary-session') registrations = await readRequired(root, 'font-registration.json', failures, rawHashes);
  const allowedRoot = ['inputs/', 'progress.json', 'report.json', 'request.json', 'stages.jsonl', 'supervisor.json', 'worker.json', 'worker.stderr.log', 'worker.stdout.log', 'audit.json', ...(mode === 'temporary-session' ? ['font-registration.json'] : [])];
  const rootEntries = await listing(root) ?? [];
  const extra = rootEntries.filter(name => !allowedRoot.includes(name));
  need(extra.length === 0, 'unexpected-output', `Read-only inventory must not leave other outputs: ${extra.join(', ')}`);
  const allowedInputs = ['native-font-inventory.ps1', 'native-process.ps1', 'native-text-fonts.ps1', 'source.pptx', ...(inputMode === 'carlito-fixture' ? ['LICENSE_FONT', 'fonts/', 'generation.json'] : [])].sort();
  need(JSON.stringify(await listing(path.join(root, 'inputs'))) === JSON.stringify(allowedInputs), 'unexpected-input', 'inputs/ must contain exactly the bound snapshots');
  if (inputMode === 'carlito-fixture') need(JSON.stringify(await listing(path.join(root, 'inputs', 'fonts'))) === JSON.stringify(PERMITTED_CARLITO_FIXTURE_FILES.map(file => path.posix.basename(file)).sort()), 'unexpected-input', 'inputs/fonts must contain exactly the four canonical faces');

  const verifierBytes = await readRequired(root, 'inputs/native-font-inventory.ps1', failures, rawHashes, bytes => bytes);
  if (verifierBytes) failures.push(...auditInventoryVerifierSource(verifierBytes.toString('utf8')));
  if (request) {
    const binding = await auditInputBindings(root, request, reviewedRoot);
    failures.push(...binding.failures); Object.assign(rawHashes, binding.rawHashes);
    const checks = supervisor?.inputChecks;
    need(Array.isArray(checks) && checks.length === binding.boundRecords.length, 'supervisor-input-checks', 'Supervisor must record original and snapshot checks for every bound input');
    for (const expected of binding.boundRecords) {
      const rows = Array.isArray(checks) ? checks.filter(row => row?.role === expected.role && row?.copy === expected.copy) : [];
      need(rows.length === 1 && rows[0]?.expected === expected.expected && rows[0]?.actual === expected.expected && rows[0]?.matched === true && samePath(rows[0]?.path, expected.path), 'supervisor-input-binding', `Supervisor input check differs for ${expected.copy} ${expected.role}`);
    }
    need(report?.source?.sha256 === request?.source?.sha256 && report?.source?.snapshotSha256 === request?.source?.sha256 && samePath(report?.source?.path, request?.source?.path) && samePath(report?.source?.snapshotPath, path.join(root, 'inputs/source.pptx')), 'report-source-binding', 'Worker source paths and hashes must agree with the bound input');
    if (inputMode === 'carlito-fixture') {
      const generation = await readRequired(root, 'inputs/generation.json', failures, rawHashes);
      need(isObject(generation), 'evidence-object', 'inputs/generation.json must contain a JSON object');
      failures.push(...auditCanonicalFixtureManifest(generation));
      need(generation?.source?.file === 'source.pptx' && generation?.source?.sha256 === request?.source?.sha256, 'generation-source-binding', 'Generation source hash must identify the requested source.pptx');
    }
  }
  let ledger = null;
  if (isObject(request) && isObject(report) && isObject(supervisor) && isObject(worker) && isObject(progress) && Array.isArray(stages)) {
    const lifecycle = auditLifecycle({request, report, supervisor, worker, progress, stages, registrations, registrationFilePresent});
    failures.push(...lifecycle.failures); ledger = lifecycle.ledger;
  }
  const findings = {
    inputMode: inputMode ?? null, fontRegistrationMode: mode ?? null, powerPointVersion: report?.environment?.powerPointVersion ?? null,
    presentationFonts: report?.presentationFonts?.entries ?? null, theme: report?.theme ?? null, ledger,
    failureCleanup: analyzeFailureCleanup(report, Array.isArray(stages) ? stages : []),
    note: 'Findings are evidence only when passed is true. Reported names do not prove physical font-file or per-glyph identity.',
  };
  return {schemaVersion: 1, kind: 'native-font-inventory-audit', evidenceDirectory: root, passed: failures.length === 0, failures, rawHashes, findings, scope: 'Offline input, lifecycle, read-only, stage-sequence and font-ledger audit of one native font inventory attempt. No Office, COM or font API is started.'};
}

async function runCli() {
  const evidenceRoot = process.argv[2];
  if (!evidenceRoot || process.argv.length > 3) { console.error(JSON.stringify({passed: false, error: 'Usage: node test/native-font-inventory-audit.mjs EVIDENCE_DIRECTORY'})); process.exitCode = 1; return; }
  const root = path.resolve(evidenceRoot);
  try { if (!(await stat(root)).isDirectory()) throw new Error('not a directory'); }
  catch { console.error(JSON.stringify({passed: false, error: `Evidence directory does not exist: ${root}`})); process.exitCode = 1; return; }
  const outPath = path.join(root, 'audit.json');
  try { await stat(outPath); console.error(JSON.stringify({passed: false, error: `Refusing to overwrite existing audit: ${outPath}`})); process.exitCode = 1; return; }
  catch (error) { if (error?.code !== 'ENOENT') { console.error(JSON.stringify({passed: false, error: error.message})); process.exitCode = 1; return; } }
  let out;
  try { out = await auditEvidenceDirectory(root); }
  catch (error) { out = {schemaVersion: 1, kind: 'native-font-inventory-audit', evidenceDirectory: root, passed: false, failures: [{code: 'audit-error', message: error.message}], scope: 'Offline audit failed before completion.'}; }
  await writeFile(outPath, JSON.stringify(out, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify({passed: out.passed, failures: out.failures.length, aptosReported: out.findings?.ledger?.aptosReported ?? null, presentationFontNames: out.findings?.ledger?.presentationFontNames ?? null, outPath}));
  process.exitCode = out.passed ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) await runCli();
