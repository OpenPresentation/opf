import {createHash} from 'node:crypto';
import {readFile, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {unzipSync} from 'fflate';
import {XMLParser, XMLValidator} from 'fast-xml-parser';

const __filename = fileURLToPath(import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const parse = bytes => JSON.parse(Buffer.from(bytes).toString('utf8').replace(/^\uFEFF/, ''));
const array = value => value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];
const isPlainInteger = value => Number.isInteger(value) && typeof value === 'number';

export const PERMITTED_CARLITO_FIXTURE = Object.freeze({
  'fonts/Carlito-400-normal.ttf': 'ca019755404c45627a8566915df99068949dc32ee2bce48d6aeee7542d2a0a89',
  'fonts/Carlito-400-italic.ttf': '074cd1b89d53765d90d0ed3b4bfe49523efaaf4f3f430c006bc3233778b0ebb5',
  'fonts/Carlito-700-normal.ttf': '51edbfa32d8af939913ae1f4ad0a5173e32083499218c133384638090295f0b0',
  'fonts/Carlito-700-italic.ttf': '25f5672c1985d168d6bc2973864fc5a7e374bb95fe8d0f91cff47ae17fa67691',
});
export const PERMITTED_CARLITO_FIXTURE_FILES = Object.freeze(Object.keys(PERMITTED_CARLITO_FIXTURE));
export const PERMITTED_CARLITO_FIXTURE_SHA256 = new Set(Object.values(PERMITTED_CARLITO_FIXTURE));
export const PERMITTED_CARLITO_LICENSE_SHA256 = '58402f82a7c332a700294988fe7554fbb0a63a8d27ccc1ee3bbc640311990a00';
export const PERMITTED_NATIVE_FONT_NAMES = Object.freeze(['Carlito', 'Carlito Bold', 'Carlito Italic', 'Carlito Bold Italic']);
const FONT_RELATIONSHIP = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/font';
const FONT_CONTENT_TYPES = new Set(['application/x-fontdata', 'application/vnd.openxmlformats-officedocument.obfuscatedFont']);
const FONT_STYLES = Object.freeze(['p:regular', 'p:bold', 'p:italic', 'p:boldItalic']);

export function stripPowerShellLiteralsForScan(sourceText) {
  return sourceText.replace(/'(?:''|[^'])*'/g, "''").replace(/"(?:`"|[^"])*"/g, '""').replace(/#.*$/gm, '');
}

export function hasOfficeQuitInvocation(sourceText) {
  const code = stripPowerShellLiteralsForScan(sourceText);
  return /(?:\$[\w]+\.Quit|\.Application\.Quit)\s*\(/i.test(code);
}

const OWNED_EMBED_SAVE_OFF = /\.SaveAs\(\$savedPath,\s*24\s*,\s*0\s*\)/;
const OWNED_EMBED_SAVE_ON = /\.SaveAs\(\$savedPath,\s*24\s*,\s*(?:\(-1\)|-1)\s*\)/;

export function auditEmbedVerifierSource(sourceText, {label = 'native-font-embed.ps1'} = {}) {
  const failures = [];
  if (OWNED_EMBED_SAVE_OFF.test(sourceText)) failures.push({code: 'embed-forced-off', message: `${label} must not call SaveAs with EmbedFonts 0`});
  if (!OWNED_EMBED_SAVE_ON.test(sourceText)) failures.push({code: 'embed-not-requested', message: `${label} must call SaveAs with EmbedFonts -1 on the owned presentation`});
  if (hasOfficeQuitInvocation(sourceText)) failures.push({code: 'application-quit', message: `${label} must not call Application.Quit or .Quit()`});
  for (const required of ['nativeFontsGate', 'blockedByNativeFontsGate', 'edited.presentation.native-fonts-gate']) {
    if (!sourceText.includes(required)) failures.push({code: 'missing-native-font-gate', message: `${label} lacks ${required}`});
  }
  return failures;
}

export function auditCanonicalFixtureManifest(generation) {
  const failures = [];
  if (generation?.kind !== 'native-font-edit-fixture') failures.push({code: 'generation-kind', message: 'generation.kind must be native-font-edit-fixture'});
  if (!isPlainInteger(generation?.registration?.flags) || generation.registration.flags !== 0) failures.push({code: 'generation-registration-flags', message: 'registration.flags must be the JSON integer 0'});
  if (generation?.license?.file !== 'LICENSE_FONT' || generation?.license?.spdx !== 'OFL-1.1' || generation?.license?.sha256 !== PERMITTED_CARLITO_LICENSE_SHA256) failures.push({code: 'generation-license', message: 'generation.license must bind the canonical OFL-1.1 license'});
  const fonts = array(generation?.fonts);
  if (fonts.length !== 4) failures.push({code: 'generation-fonts', message: 'generation.json must list exactly four Carlito fixture fonts'});
  const seen = new Set();
  for (const font of fonts) {
    if (!(font?.file in PERMITTED_CARLITO_FIXTURE) || seen.has(font?.file)) failures.push({code: 'generation-font-path', message: `Disallowed or duplicate fixture font path: ${font?.file}`});
    else if (font.sha256 !== PERMITTED_CARLITO_FIXTURE[font.file]) failures.push({code: 'generation-font-hash', message: `Noncanonical fixture font hash for ${font.file}`});
    seen.add(font?.file);
  }
  for (const file of PERMITTED_CARLITO_FIXTURE_FILES) if (!seen.has(file)) failures.push({code: 'generation-font-missing', message: `Missing canonical fixture face: ${file}`});
  return failures;
}

function centralDirectoryNames(pptxBytes) {
  const bytes = Buffer.from(pptxBytes);
  let eocd = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset--) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error('ZIP end-of-central-directory record is missing');
  const disk = bytes.readUInt16LE(eocd + 4); const centralDisk = bytes.readUInt16LE(eocd + 6);
  const diskEntries = bytes.readUInt16LE(eocd + 8); const totalEntries = bytes.readUInt16LE(eocd + 10);
  const centralSize = bytes.readUInt32LE(eocd + 12); const centralOffset = bytes.readUInt32LE(eocd + 16);
  if (disk !== 0 || centralDisk !== 0 || diskEntries !== totalEntries) throw new Error('Multi-disk ZIP is outside this audit scope');
  if (totalEntries === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) throw new Error('ZIP64 is outside this bounded audit scope');
  const names = []; let cursor = centralOffset;
  for (let index = 0; index < totalEntries; index++) {
    if (cursor + 46 > bytes.length || bytes.readUInt32LE(cursor) !== 0x02014b50) throw new Error(`Invalid central-directory entry ${index}`);
    const nameLength = bytes.readUInt16LE(cursor + 28); const extraLength = bytes.readUInt16LE(cursor + 30); const commentLength = bytes.readUInt16LE(cursor + 32);
    const end = cursor + 46 + nameLength + extraLength + commentLength;
    if (end > bytes.length) throw new Error(`Truncated central-directory entry ${index}`);
    const name = new TextDecoder('utf-8', {fatal: true}).decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    if (!name || name.includes('\\') || name.includes('\0') || name.startsWith('/') || name.split('/').includes('..')) throw new Error(`Unsafe ZIP member name: ${name}`);
    names.push(name); cursor = end;
  }
  if (cursor !== centralOffset + centralSize) throw new Error('Central-directory size does not match parsed entries');
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
  if (duplicates.length) throw new Error(`Duplicate ZIP member name: ${[...new Set(duplicates)].join(', ')}`);
  return names;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  isArray: (_name, jpath) => ['Relationships.Relationship', 'Types.Default', 'Types.Override', 'p:presentation.p:embeddedFontLst.p:embeddedFont'].includes(jpath),
});

function parseXmlPart(entries, name, failures) {
  const bytes = entries[name];
  if (!bytes) { failures.push({code: 'opc-part-missing', message: `Required OPC part is missing: ${name}`}); return null; }
  const text = Buffer.from(bytes).toString('utf8').replace(/^\uFEFF/, '');
  const validation = XMLValidator.validate(text);
  if (validation !== true) { failures.push({code: 'opc-xml-invalid', message: `Invalid XML in ${name}`}); return null; }
  try { return xmlParser.parse(text); } catch { failures.push({code: 'opc-xml-parse', message: `Cannot parse ${name}`}); return null; }
}

function countNamespaceDeclaration(bytes, prefix) {
  const text = Buffer.from(bytes ?? []).toString('utf8');
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (text.match(new RegExp(`\\b${escaped}\\s*=`, 'g')) ?? []).length;
}

function resolveRelationshipTarget(sourcePart, target) {
  if (typeof target !== 'string' || !target || target.includes('\\') || target.includes('?') || target.includes('#') || target.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(target)) throw new Error(`Unsafe relationship target: ${target}`);
  const decoded = decodeURIComponent(target);
  if (decoded.split('/').includes('..')) throw new Error(`Traversing relationship target: ${target}`);
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(sourcePart), decoded));
  if (resolved.startsWith('../') || resolved === '..') throw new Error(`Relationship target escapes package: ${target}`);
  return resolved;
}

export function inspectFontEmbeddingPackage(pptxBytes) {
  const failures = []; let names = [];
  try { names = centralDirectoryNames(pptxBytes); } catch (error) { return {failures: [{code: 'opc-zip-structure', message: error.message}], parts: [], packageSha256: sha(pptxBytes), structuralEmbeddingOnly: true, physicalFontIdentityProven: false}; }
  let entries;
  try { entries = unzipSync(pptxBytes); } catch (error) { return {failures: [{code: 'opc-unzip', message: error.message}], parts: [], packageSha256: sha(pptxBytes), structuralEmbeddingOnly: true, physicalFontIdentityProven: false}; }
  if (Object.keys(entries).length !== names.length) failures.push({code: 'opc-entry-count', message: 'Decoded ZIP entry count differs from unique central-directory count'});
  const contentTypes = parseXmlPart(entries, '[Content_Types].xml', failures);
  const relationships = parseXmlPart(entries, 'ppt/_rels/presentation.xml.rels', failures);
  const presentation = parseXmlPart(entries, 'ppt/presentation.xml', failures);
  if (contentTypes?.Types?.xmlns !== 'http://schemas.openxmlformats.org/package/2006/content-types') failures.push({code: 'opc-content-types-namespace', message: 'Content types root namespace is missing or unexpected'});
  if (relationships?.Relationships?.xmlns !== 'http://schemas.openxmlformats.org/package/2006/relationships') failures.push({code: 'opc-relationships-namespace', message: 'Relationships root namespace is missing or unexpected'});
  if (presentation?.['p:presentation']?.['xmlns:p'] !== 'http://schemas.openxmlformats.org/presentationml/2006/main' || presentation?.['p:presentation']?.['xmlns:r'] !== 'http://schemas.openxmlformats.org/officeDocument/2006/relationships') failures.push({code: 'opc-presentation-namespace', message: 'Presentation font markup namespaces are missing or unexpected'});
  if (countNamespaceDeclaration(entries['[Content_Types].xml'], 'xmlns') !== 1 || countNamespaceDeclaration(entries['ppt/_rels/presentation.xml.rels'], 'xmlns') !== 1 || countNamespaceDeclaration(entries['ppt/presentation.xml'], 'xmlns:p') !== 1 || countNamespaceDeclaration(entries['ppt/presentation.xml'], 'xmlns:r') !== 1) failures.push({code: 'opc-namespace-rebinding', message: 'Bounded audit accepts only one root declaration for each required PowerPoint namespace; descendant rebinding is forbidden'});
  const fontPartNames = names.filter(name => name.startsWith('ppt/fonts/') && !name.endsWith('/')).sort();
  const parts = fontPartNames.map(partName => ({partName, byteLength: entries[partName]?.length ?? 0, sha256: entries[partName] ? sha(entries[partName]) : null}));
  if (parts.length !== 4 || parts.some(part => part.byteLength <= 0 || !part.partName.endsWith('.fntdata'))) failures.push({code: 'opc-font-part-count', message: 'Exactly four nonempty ppt/fonts/*.fntdata parts are required'});

  const defaults = new Map(); const overrides = new Map();
  for (const item of array(contentTypes?.Types?.Default)) {
    const key = String(item?.Extension ?? '').toLowerCase();
    if (!key || defaults.has(key)) failures.push({code: 'opc-content-type-duplicate', message: `Duplicate/invalid Default content type: ${key}`});
    else defaults.set(key, item.ContentType);
  }
  for (const item of array(contentTypes?.Types?.Override)) {
    const key = String(item?.PartName ?? '').replace(/^\//, '');
    if (!key || overrides.has(key)) failures.push({code: 'opc-content-type-duplicate', message: `Duplicate/invalid Override content type: ${key}`});
    else overrides.set(key, item.ContentType);
  }
  for (const part of parts) {
    const type = overrides.get(part.partName) ?? defaults.get(path.posix.extname(part.partName).slice(1).toLowerCase());
    if (!FONT_CONTENT_TYPES.has(type)) failures.push({code: 'opc-font-content-type', message: `Missing or invalid font content type for ${part.partName}: ${type}`});
  }

  const relById = new Map(); const fontRelationshipTargets = new Set(); const fontRelationshipIds = new Set();
  for (const rel of array(relationships?.Relationships?.Relationship)) {
    if (!rel?.Id || relById.has(rel.Id)) { failures.push({code: 'opc-relationship-id', message: `Duplicate/invalid relationship Id: ${rel?.Id}`}); continue; }
    relById.set(rel.Id, rel);
    if (rel.Type === FONT_RELATIONSHIP) {
      fontRelationshipIds.add(rel.Id);
      if (rel.TargetMode) failures.push({code: 'opc-font-relationship-external', message: `Font relationship ${rel.Id} must be internal`});
      try { fontRelationshipTargets.add(resolveRelationshipTarget('ppt/presentation.xml', rel.Target)); }
      catch (error) { failures.push({code: 'opc-font-relationship-target', message: error.message}); }
    }
  }

  const embeddedFonts = array(presentation?.['p:presentation']?.['p:embeddedFontLst']?.['p:embeddedFont']);
  if (embeddedFonts.length !== 1 || embeddedFonts[0]?.['p:font']?.typeface !== 'Carlito') failures.push({code: 'opc-embedded-family', message: 'embeddedFontLst must contain exactly one unique Carlito typeface entry'});
  const referencedParts = new Set(); const referencedIds = new Set();
  for (const embedded of embeddedFonts) {
    if (embedded?.['p:font']?.typeface !== 'Carlito') failures.push({code: 'opc-unknown-family', message: `Unexpected embedded typeface: ${embedded?.['p:font']?.typeface}`});
    for (const style of FONT_STYLES) {
      const id = embedded?.[style]?.['r:id'];
      if (!id || referencedIds.has(id)) { failures.push({code: 'opc-embedded-reference', message: `Missing/duplicate ${style} relationship reference`}); continue; }
      referencedIds.add(id); const rel = relById.get(id);
      if (!rel || rel.Type !== FONT_RELATIONSHIP || rel.TargetMode) { failures.push({code: 'opc-embedded-relationship', message: `${style} does not resolve to one internal font relationship`}); continue; }
      try { referencedParts.add(resolveRelationshipTarget('ppt/presentation.xml', rel.Target)); }
      catch (error) { failures.push({code: 'opc-embedded-target', message: error.message}); }
    }
  }
  const actualSet = new Set(fontPartNames);
  for (const name of referencedParts) if (!actualSet.has(name)) failures.push({code: 'opc-font-part-missing', message: `Referenced font part is missing: ${name}`});
  for (const name of actualSet) if (!referencedParts.has(name)) failures.push({code: 'opc-font-part-extra', message: `Unreferenced font part is present: ${name}`});
  for (const name of fontRelationshipTargets) if (!referencedParts.has(name)) failures.push({code: 'opc-font-relationship-dangling', message: `Font relationship is not used by embeddedFontLst: ${name}`});
  for (const id of fontRelationshipIds) if (!referencedIds.has(id)) failures.push({code: 'opc-font-relationship-unused', message: `Font relationship Id is not used by embeddedFontLst: ${id}`});
  for (const name of referencedParts) if (!fontRelationshipTargets.has(name)) failures.push({code: 'opc-font-relationship-missing', message: `embeddedFontLst target lacks a font relationship: ${name}`});
  return {failures, parts, packageSha256: sha(pptxBytes), embeddedTypefaces: embeddedFonts.map(item => item?.['p:font']?.typeface), structuralEmbeddingOnly: true, physicalFontIdentityProven: false};
}

const nativeHash = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const nativeDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const nativeSamePath = (left, right) => {
  if (typeof left !== 'string' || typeof right !== 'string' || !left || !right) return false;
  const a = path.resolve(left), b = path.resolve(right);
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
};

function auditLifecycle({report, supervisor, worker, progress, stages, registrations}) {
  const failures = [];
  const need = (condition, code, message) => { if (!condition) failures.push({code, message}); };
  need(report?.kind === 'native-font-embed', 'report-kind', 'report.json must be native-font-embed');
  need(nativeHash(report?.source?.sha256) && report?.source?.snapshotSha256 === report?.source?.sha256 && typeof report?.source?.path === 'string' && report.source.path.length > 0 && typeof report?.source?.snapshotPath === 'string' && report.source.snapshotPath.length > 0 && nativeHash(report?.saved?.sha256) && typeof report?.saved?.path === 'string' && report.saved.path.length > 0, 'report-file-binding', 'Worker must identify the source and owned saved presentation paths and hashes');
  need(report?.error === null && report?.cleanupConfirmed === true && report?.officeOperationsStopped === false && report?.ownedCloseCount === 1 && report?.lastStage === 'worker.complete' && report?.lastStatus === 'success', 'report-lifecycle', 'Worker report must end successfully with no error, confirmed cleanup, and exactly one owned close');
  need(report?.embedFonts?.saveFormat === 24 && report?.embedFonts?.saveArgument === -1 && report?.embedFonts?.attempted === true && report?.embedFonts?.completed === true && report?.embedFonts?.blockedByNativeFontsGate === false && report?.embedFonts?.stage === 'edited.presentation.saveAs-owned-copy-embed-fonts', 'report-embed', 'Worker report must record one allowed completed format 24, EmbedFonts -1 save');
  const observation = report?.nativeFontsObservation, gate = report?.nativeFontsGate;
  const entries = observation?.entries;
  const inventoryValid = isPlainInteger(observation?.count) && observation.count >= 1 && observation.count <= 64 && Array.isArray(entries) && entries.length === observation.count && entries.every((entry, index) => entry?.index === index + 1 && PERMITTED_NATIVE_FONT_NAMES.includes(entry?.name) && [0, -1].includes(entry?.embedded) && entry?.embeddable === -1) && entries.some(entry => entry.name === 'Carlito');
  need(inventoryValid, 'native-font-inventory', 'Complete bounded native Fonts inventory must contain only permitted Carlito names with native embeddability confirmed');
  need(gate?.passed === true && gate?.reportedCount === observation?.count && gate?.entryCount === observation?.count && gate?.countValid === true && gate?.baseFamilyPresent === true && Array.isArray(gate?.unexpectedNames) && gate.unexpectedNames.length === 0 && Array.isArray(gate?.unembeddableNames) && gate.unembeddableNames.length === 0 && JSON.stringify(gate?.allowedReportedNames) === JSON.stringify(PERMITTED_NATIVE_FONT_NAMES) && JSON.stringify(gate?.entries) === JSON.stringify(entries), 'report-native-font-gate', 'Native Fonts gate must agree with its independently validated observation');
  need(worker?.timedOut === false && worker?.exitCode === 0 && isPlainInteger(worker?.timeoutSeconds) && worker.timeoutSeconds >= 5 && worker.timeoutSeconds <= 60 && isPlainInteger(worker?.processId) && worker.processId > 0 && nativeDate(worker?.startedAt) && nativeDate(worker?.finishedAt) && Date.parse(worker.finishedAt) >= Date.parse(worker.startedAt), 'worker-outcome', 'Owned worker must exit 0 without timeout within the configured 5-60 second helper bound');
  need(supervisor?.timedOut === false && supervisor?.exitCode === 0 && supervisor?.officeLifecycleComplete === true && supervisor?.nativeFontsGatePassed === true && supervisor?.embedSaveRecorded === true && supervisor?.fontCleanupConfirmed === true && supervisor?.inputsUnchanged === true && supervisor?.ownedCloseCount === 1 && supervisor?.parentError === null && supervisor?.lastDurableStage === 'worker.complete' && supervisor?.lastDurableStatus === 'success', 'supervisor-outcome', 'Supervisor must confirm lifecycle, gate, save, inputs, removals, and one close');
  need(progress?.stage === 'worker.complete' && progress?.status === 'success' && progress?.cleanupConfirmed === true && progress?.officeOperationsStopped === false && progress?.ownedPresentationPath === null, 'progress-outcome', 'Durable progress must end at successful worker.complete with owned cleanup confirmed');
  const fontNames = Array.isArray(registrations) ? registrations.map(row => row?.file).sort() : [];
  need(Array.isArray(registrations) && registrations.length === 4 && JSON.stringify(fontNames) === JSON.stringify([...PERMITTED_CARLITO_FIXTURE_FILES].sort()) && registrations.every(row => Object.hasOwn(PERMITTED_CARLITO_FIXTURE, row?.file) && row.sha256 === PERMITTED_CARLITO_FIXTURE[row.file] && isPlainInteger(row?.added) && row.added >= 1 && row?.removed === true), 'font-cleanup', 'Exactly the four unique canonical font registrations must record successful additions and removals');
  need(Array.isArray(stages) && stages.length > 0, 'stage-sequence', 'A complete durable stage sequence is required');
  if (!Array.isArray(stages) || stages.length === 0) return failures;
  const sourcePath = report?.source?.snapshotPath, savedPath = report?.saved?.path;
  const singletons = new Set(['worker.initialize', 'edited.presentation.native-fonts-gate', 'edited.presentation.cleanup', 'worker.complete']);
  const grouped = new Map();
  for (let index = 0; index < stages.length; index++) {
    const row = stages[index];
    need(row?.sequence === index + 1 && typeof row?.stage === 'string' && ['begin', 'success'].includes(row?.status) && row?.error === null && row?.officeOperationsStopped === false && typeof row?.cleanupConfirmed === 'boolean' && nativeDate(row?.timestamp), 'stage-sequence', `Stage ${index + 1} is incomplete, noncontiguous, or records an error`);
    need(row?.ownedPresentationPath === null || nativeSamePath(row?.ownedPresentationPath, sourcePath) || nativeSamePath(row?.ownedPresentationPath, savedPath), 'stage-ownership', `Stage ${index + 1} records an unrelated owned presentation`);
    if (!grouped.has(row?.stage)) grouped.set(row?.stage, []);
    grouped.get(row?.stage).push(row);
    if (!singletons.has(row?.stage)) {
      const partner = row?.status === 'begin' ? stages[index + 1] : stages[index - 1];
      need(partner?.stage === row?.stage && partner?.status === (row?.status === 'begin' ? 'success' : 'begin'), 'stage-pair', `Unpaired COM stage at sequence ${index + 1}`);
    }
  }
  for (const [stage, rows] of grouped) need(singletons.has(stage) ? rows.length === 1 && rows[0]?.status === 'success' : rows.length === 2 && rows[0]?.status === 'begin' && rows[1]?.status === 'success', 'stage-duplicate', `Unexpected repeated or incomplete stage ${stage}`);
  const paired = (name, ownedPath) => {
    const rows = grouped.get(name) ?? [];
    need(rows.length === 2 && rows[0]?.status === 'begin' && rows[1]?.status === 'success', 'stage-required', `Missing paired ${name}`);
    if (ownedPath !== undefined) need(rows.every(row => nativeSamePath(row?.ownedPresentationPath, ownedPath)), 'stage-ownership', `${name} does not identify the expected owned presentation`);
    return rows[1]?.sequence;
  };
  const singleton = (name, ownedPath) => {
    const rows = grouped.get(name) ?? [];
    need(rows.length === 1 && rows[0]?.status === 'success', 'stage-required', `Missing successful ${name}`);
    if (ownedPath === null) need(rows[0]?.ownedPresentationPath === null, 'stage-ownership', `${name} must confirm no owned presentation remains`);
    else if (ownedPath !== undefined) need(nativeSamePath(rows[0]?.ownedPresentationPath, ownedPath), 'stage-ownership', `${name} has the wrong owned presentation`);
    return rows[0]?.sequence;
  };
  const initialized = singleton('worker.initialize', null);
  const opened = paired('input.presentation.open', sourcePath);
  const fontsRead = [paired('edited.presentation.fonts.get', sourcePath), paired('edited.presentation.fonts.count.get', sourcePath)];
  if (Array.isArray(entries)) for (let index = 1; index <= entries.length; index++) for (const suffix of ['get', 'name.get', 'embedded.get', 'embeddable.get']) fontsRead.push(paired(`edited.presentation.fonts.item-${index}.${suffix}`, sourcePath));
  const gateSequence = singleton('edited.presentation.native-fonts-gate', sourcePath);
  const saved = paired('edited.presentation.saveAs-owned-copy-embed-fonts', sourcePath);
  const confirmed = paired('edited.presentation.fullName.get', savedPath);
  const closed = paired('edited.presentation.close', savedPath);
  const cleaned = singleton('edited.presentation.cleanup', null);
  const complete = singleton('worker.complete', null);
  const milestones = [initialized, opened, ...fontsRead, gateSequence, saved, confirmed, closed, cleaned, complete];
  need(initialized === 1 && milestones.every(isPlainInteger) && milestones.every((value, index) => index === 0 || value > milestones[index - 1]), 'stage-order', 'Required initialization, open, font inventory, gate, save, close, cleanup, and completion are missing or out of order');
  need(stages.filter(row => typeof row?.stage === 'string' && row.stage.endsWith('.close') && row?.status === 'success').length === 1, 'stage-close', 'Exactly one owned close is permitted');
  const final = stages.at(-1);
  need(complete === stages.length && final?.cleanupConfirmed === true && final?.ownedPresentationPath === null && JSON.stringify(progress) === JSON.stringify(final), 'stage-terminal', 'worker.complete must be the final durable stage and match progress.json exactly');
  need(nativeDate(supervisor?.timestamp) && nativeDate(final?.timestamp) && Date.parse(supervisor.timestamp) >= Date.parse(final.timestamp), 'supervisor-time', 'Supervisor completion must follow the final durable worker stage');
  return failures;
}

export function auditSavedEmbedPresentation(evidence) {
  const failures = [...auditCanonicalFixtureManifest(evidence.generation), ...auditLifecycle(evidence), ...(evidence.inputBindingFailures ?? [])];
  const opc = inspectFontEmbeddingPackage(evidence.pptxBytes);
  failures.push(...opc.failures);
  if (evidence.report?.saved?.sha256 !== opc.packageSha256) failures.push({code: 'saved-hash', message: 'report.saved.sha256 does not match native-font-embed.pptx'});
  return {failures, opc, passed: failures.length === 0, scope: 'Lifecycle-bound OPC font relationship/content-type audit. Raw obfuscated part hashes are structural evidence only; physical face and per-glyph identity remain unproven.'};
}

async function readBoundFile(root, relative, expected, role, failures, rawHashes) {
  const target = path.resolve(root, relative);
  if (!target.startsWith(root + path.sep)) { failures.push({code: 'input-path', message: `${role} escaped the evidence directory`}); return null; }
  try {
    const bytes = await readFile(target); const actual = sha(bytes); rawHashes[relative.replaceAll('\\', '/')] = actual;
    if (actual !== expected) failures.push({code: 'input-hash', message: `${role} hash mismatch`});
    return bytes;
  } catch { failures.push({code: 'input-missing', message: `${role} is missing`}); return null; }
}

async function auditInputBindings(root, request, verifierBytes) {
  const failures = [], rawHashes = {}, boundRecords = [];
  const need = (condition, code, message) => { if (!condition) failures.push({code, message}); };
  const definitions = [
    ['inputs/source.pptx', request?.source, 'source'],
    ['inputs/generation.json', request?.fixture?.generation, 'generation'],
    ['inputs/LICENSE_FONT', request?.fixture?.license, 'license', PERMITTED_CARLITO_LICENSE_SHA256],
    ['inputs/native-font-embed.ps1', request?.verifier, 'verifier'],
    ['inputs/native-process.ps1', request?.processHelper, 'process-helper'],
    ['inputs/native-text-fonts.ps1', request?.fontHelper, 'font-helper'],
  ];
  const requestFonts = request?.fixture?.fonts;
  need(Array.isArray(requestFonts) && requestFonts.length === 4, 'request-font-count', 'Request must bind exactly four font inputs');
  for (const file of PERMITTED_CARLITO_FIXTURE_FILES) {
    const rows = Array.isArray(requestFonts) ? requestFonts.filter(item => item?.file === file) : [];
    need(rows.length === 1, 'request-font-binding', `Request must bind ${file} exactly once`);
    definitions.push([`inputs/${file}`, rows[0], `font:${file}`, PERMITTED_CARLITO_FIXTURE[file]]);
  }
  need(request?.fixture?.license?.spdx === 'OFL-1.1', 'request-license-binding', 'Request must identify the reviewed OFL-1.1 license');
  need(request?.fontHelper?.registrationFlags === 0, 'request-registration-flags', 'Request registrationFlags must be numeric 0');
  for (const [relative, item, role, pinnedHash] of definitions) {
    const expected = pinnedHash ?? item?.sha256, snapshotPath = path.resolve(root, relative);
    need(nativeHash(expected) && item?.sha256 === expected && item?.snapshotSha256 === expected, 'input-expected-hash', `${role} requires matching original and snapshot hashes`);
    need(nativeSamePath(item?.snapshotPath, snapshotPath), 'input-snapshot-path', `${role} snapshotPath must select ${relative}`);
    if (!nativeHash(expected)) continue;
    await readBoundFile(root, relative, expected, role, failures, rawHashes);
    boundRecords.push({role, copy:'snapshot', path:snapshotPath, expected});
    if (typeof item?.path !== 'string' || !item.path) failures.push({code:'input-original-path',message:`${role} original path is missing`});
    else {
      try {
        const actual = sha(await readFile(item.path)); rawHashes[`original:${role}`] = actual;
        need(actual === expected, 'input-original-hash', `${role} original bytes changed`);
      } catch { failures.push({code:'input-original-missing',message:`${role} original file cannot be read`}); }
      boundRecords.push({role, copy:'original', path:item.path, expected});
    }
  }
  const companions = [['verifier','native-font-embed.ps1'],['processHelper','native-process.ps1'],['fontHelper','native-text-fonts.ps1']];
  for (const [key, name] of companions) {
    try {
      const reviewed = sha(await readFile(path.join(path.dirname(__filename), name))); rawHashes[`reviewed/${name}`] = reviewed;
      need(request?.[key]?.sha256 === reviewed, 'reviewed-verifier-binding', `${name} snapshot must match the reviewed companion beside this auditor`);
    } catch { failures.push({code:'reviewed-verifier-missing',message:`Reviewed companion ${name} cannot be read`}); }
  }
  if (verifierBytes) need(request?.verifier?.sha256 === sha(verifierBytes), 'verifier-binding', 'Audited verifier differs from request.json');
  return {failures, rawHashes, boundRecords};
}

async function readRequired(root, relative, failures, rawHashes, parser = parse) {
  try { const bytes = await readFile(path.join(root, relative)); rawHashes[relative] = sha(bytes); return parser(bytes); }
  catch { failures.push({code: 'missing-evidence', message: `${relative} is required`}); return null; }
}

export async function auditEvidenceDirectory(evidenceDirectory) {
  const root = path.resolve(evidenceDirectory), failures = [], rawHashes = {};
  const need = (condition, code, message) => { if (!condition) failures.push({code, message}); };
  const request = await readRequired(root, 'request.json', failures, rawHashes);
  const report = await readRequired(root, 'report.json', failures, rawHashes);
  const supervisor = await readRequired(root, 'supervisor.json', failures, rawHashes);
  const worker = await readRequired(root, 'worker.json', failures, rawHashes);
  const progress = await readRequired(root, 'progress.json', failures, rawHashes);
  const registrations = await readRequired(root, 'font-registration.json', failures, rawHashes);
  const generation = await readRequired(root, 'inputs/generation.json', failures, rawHashes);
  const stages = await readRequired(root, 'stages.jsonl', failures, rawHashes, bytes => {
    const text = Buffer.from(bytes).toString('utf8').replace(/^\uFEFF/, '').trim();
    return text ? text.split(/\r?\n/).map(line => JSON.parse(line)) : [];
  });
  for (const [name, value] of Object.entries({request, report, supervisor, worker, progress, generation})) need(value !== null && typeof value === 'object' && !Array.isArray(value), 'evidence-object', `${name}.json must contain a JSON object`);
  need(Array.isArray(registrations) && registrations.length === 4, 'evidence-array', 'font-registration.json must contain four records');
  need(Array.isArray(stages) && stages.length > 0, 'evidence-array', 'stages.jsonl must contain a nonempty sequence');
  const verifierBytes = await readRequired(root, 'inputs/native-font-embed.ps1', failures, rawHashes, bytes => bytes);
  const pptxBytes = await readRequired(root, 'native-font-embed.pptx', failures, rawHashes, bytes => bytes);
  if (verifierBytes) failures.push(...auditEmbedVerifierSource(verifierBytes.toString('utf8')));
  if (request) {
    const binding = await auditInputBindings(root, request, verifierBytes);
    failures.push(...binding.failures); Object.assign(rawHashes, binding.rawHashes);
    const inputChecks = supervisor?.inputChecks;
    need(Array.isArray(inputChecks) && inputChecks.length === binding.boundRecords.length && inputChecks.length === 20, 'supervisor-input-checks', 'Supervisor must record both original and snapshot checks for all ten bound inputs');
    for (const expected of binding.boundRecords) {
      const rows = Array.isArray(inputChecks) ? inputChecks.filter(row => row?.role === expected.role && row?.copy === expected.copy) : [];
      need(rows.length === 1 && rows[0]?.expected === expected.expected && rows[0]?.actual === expected.expected && rows[0]?.matched === true && nativeSamePath(rows[0]?.path, expected.path), 'supervisor-input-binding', `Supervisor input check differs for ${expected.copy} ${expected.role}`);
    }
    need(generation?.source?.file === 'source.pptx' && nativeHash(generation?.source?.sha256) && generation.source.sha256 === request?.source?.sha256, 'generation-source-binding', 'Generation source hash must identify the actual requested source.pptx');
    need(generation?.license?.file === 'LICENSE_FONT' && generation?.license?.spdx === 'OFL-1.1' && generation?.license?.sha256 === PERMITTED_CARLITO_LICENSE_SHA256, 'generation-license-binding', 'Generation must identify the exact reviewed license');
    need(report?.source?.sha256 === request?.source?.sha256 && report?.source?.snapshotSha256 === request?.source?.snapshotSha256 && nativeSamePath(report?.source?.path, request?.source?.path) && nativeSamePath(report?.source?.snapshotPath, path.join(root, 'inputs/source.pptx')), 'report-source-binding', 'Worker source paths and hashes must agree with bound input files');
    need(nativeSamePath(report?.saved?.path, path.join(root, 'native-font-embed.pptx')), 'report-saved-path', 'Worker saved path must be the owned output presentation');
    need(JSON.stringify(report?.requested) === JSON.stringify(request?.expectations), 'report-request-binding', 'Worker requested values must match request expectations');
    const native = request?.expectations?.nativeFonts;
    need(JSON.stringify(native?.allowedNames) === JSON.stringify(PERMITTED_NATIVE_FONT_NAMES) && native?.maxEntries === 64 && native?.unexpectedNamesBlockSave === true && native?.requireEmbeddable === true, 'request-native-gate', 'Request must preserve the bounded native font allowlist and embeddability gate');
    need(request?.expectations?.embedFonts?.saveFormat === 24 && request?.expectations?.embedFonts?.saveArgument === -1, 'request-embed-save', 'Request must preserve SaveAs format 24 and EmbedFonts -1');
  }
  let opc = null;
  if (report && supervisor && worker && progress && stages && registrations && generation && pptxBytes) {
    const result = auditSavedEmbedPresentation({report, supervisor, worker, progress, stages, registrations, generation, pptxBytes});
    failures.push(...result.failures); opc = result.opc;
  }
  return {schemaVersion:2, kind:'native-font-embed-opc-audit', evidenceDirectory:root, passed:failures.length === 0, failures, rawHashes, opc, scope:'Offline lifecycle/input binding and font-related OPC structural audit. No Office or font API is started. Obfuscated font-part bytes are not physical face or per-glyph identity proof.'};
}

async function runCli() {
  const evidenceRoot = process.argv[2];
  if (!evidenceRoot) { console.error(JSON.stringify({passed: false, error: 'Usage: node test/native-font-embed-audit.mjs EVIDENCE_DIRECTORY'})); process.exitCode = 1; return; }
  const root = path.resolve(evidenceRoot);
  try { if (!(await stat(root)).isDirectory()) throw new Error('not a directory'); }
  catch { console.error(JSON.stringify({passed: false, error: `Evidence directory does not exist: ${root}`})); process.exitCode = 1; return; }
  const outPath = path.join(root, 'embed-opc-audit.json');
  try { await stat(outPath); console.error(JSON.stringify({passed: false, error: `Refusing to overwrite existing audit: ${outPath}`})); process.exitCode = 1; return; }
  catch (error) { if (error?.code !== 'ENOENT') { console.error(JSON.stringify({passed: false, error: error.message})); process.exitCode = 1; return; } }
  let out;
  try { out = await auditEvidenceDirectory(root); }
  catch (error) { out = {schemaVersion: 2, kind: 'native-font-embed-opc-audit', evidenceDirectory: root, passed: false, failures: [{code: 'audit-error', message: error.message}], scope: 'Offline audit failed before completion.'}; }
  await writeFile(outPath, JSON.stringify(out, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify({passed: out.passed, failures: out.failures.length, outPath}));
  process.exitCode = out.passed ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) await runCli();
