import {createHash} from 'node:crypto';
import {readFile, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {unzipSync} from 'fflate';
import {XMLParser, XMLValidator} from 'fast-xml-parser';
import {auditHarnessSourcePolicy, scanPowerShellSource, stripPowerShellLiteralsForScan} from './powershell-scan.mjs';

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

export {scanPowerShellSource, stripPowerShellLiteralsForScan};

// Any member reference named Quit in code (not in a comment or string literal): $app.Quit(), $app.Quit.Invoke(), ${app}.Quit(),
// $x.Application.Quit(), $apps[0].Quit(). The pure regression's AST policy remains the authoritative PowerShell check.
export function hasOfficeQuitInvocation(sourceText) {
  return /\.\s*Quit\b/i.test(stripPowerShellLiteralsForScan(sourceText));
}

// Reviewed allowlist policy for native-font-embed.ps1. The controls assert that every list below equals the matching
// $script:FontEmbedPolicy* list in that file, which its PowerShell AST check enforces.
export const EMBED_SOURCE_POLICY = Object.freeze({
  commands: Object.freeze(['Add-Content', 'ConvertFrom-Json', 'ConvertTo-Json', 'Copy-Item', 'ForEach-Object', 'Get-Content', 'Get-Date', 'Get-FileHash', 'Get-ItemProperty', 'Invoke-OpfNativeWorker', 'Invoke-OpfWithTemporaryFonts', 'Join-Path', 'New-Item', 'New-Object', 'Remove-Item', 'Resolve-Path', 'Set-Content', 'Test-Path', 'Where-Object', 'Write-Host', 'Write-Output']),
  scoped: Object.freeze(['Invoke-Expression|Invoke-FontEmbedPureRegression', 'Add-Member|New-FontEmbedFakeShape', 'Add-Member|Invoke-FontEmbedPureRegression']),
  forms: Object.freeze(['New-Object|^New-Object -ComObject PowerPoint\\.Application$']),
  instance: Object.freeze(['Characters', 'Close', 'Contains', 'ContainsKey', 'FindAll', 'GetCommandName', 'Item', 'Open', 'SaveAs', 'StartsWith', 'ToLowerInvariant', 'ToString', 'ToUniversalTime', 'TrimEnd', 'Substring']),
  statics: Object.freeze(['Guid::NewGuid', 'IO.File::WriteAllText', 'IO.Path::GetExtension', 'IO.Path::GetFullPath', 'IO.Path::GetTempPath', 'string::IsNullOrEmpty', 'string::IsNullOrWhiteSpace', 'System.Management.Automation.Language.Parser::ParseFile']),
  properties: Object.freeze(['IO.Path::AltDirectorySeparatorChar', 'IO.Path::DirectorySeparatorChar', 'StringComparison::OrdinalIgnoreCase', 'System.Management.Automation.Language.TokenKind::Dot', 'System.Management.Automation.Language.TokenKind::Minus', 'System.Management.Automation.Language.TokenKind::Unknown', 'System.Management.Automation.Language.StringConstantType::BareWord', 'System.Management.Automation.Language.TokenKind::Equals']),
  types: Object.freeze(['bool', 'double', 'Guid', 'int', 'IO.File', 'IO.Path', 'long', 'ordered', 'pscustomobject', 'ref', 'scriptblock', 'string', 'StringComparison', 'switch', 'void', 'ValidateRange', 'System.Collections.IDictionary', 'System.Management.Automation.Language.AssignmentStatementAst', 'System.Management.Automation.Language.AttributeBaseAst', 'System.Management.Automation.Language.CommandAst', 'System.Management.Automation.Language.ConstantExpressionAst', 'System.Management.Automation.Language.ConvertExpressionAst', 'System.Management.Automation.Language.FunctionDefinitionAst', 'System.Management.Automation.Language.IndexExpressionAst', 'System.Management.Automation.Language.InvokeMemberExpressionAst', 'System.Management.Automation.Language.MemberExpressionAst', 'System.Management.Automation.Language.ParenExpressionAst', 'System.Management.Automation.Language.Parser', 'System.Management.Automation.Language.ScriptBlockExpressionAst', 'System.Management.Automation.Language.StringConstantExpressionAst', 'System.Management.Automation.Language.StringConstantType', 'System.Management.Automation.Language.TokenKind', 'System.Management.Automation.Language.TypeExpressionAst', 'System.Management.Automation.Language.UnaryExpressionAst', 'System.Management.Automation.Language.VariableExpressionAst', 'System.Management.Automation.Language.ArrayLiteralAst', 'System.Management.Automation.Language.CommandExpressionAst', 'System.Management.Automation.Language.CommandParameterAst', 'System.Management.Automation.Language.ForEachStatementAst', 'System.Management.Automation.Language.HashtableAst', 'System.Management.Automation.Language.ParameterAst', 'System.Management.Automation.Language.RedirectionAst']),
  sites: Object.freeze(['Invoke-FontEmbedCom|&|Operation', '|.|processSnapshot', '|.|fontHelperSnapshot']),
  pipelines: Object.freeze([]),
  roots: Object.freeze(['report', 'seen', 'inventory', 'wrongGeneration']),
  setters: Object.freeze(['Range.Text', 'wholeFont.Name', 'wholeFont.Size', 'wholeFont.Bold', 'wholeFont.Italic', 'runFont.Name', 'runFont.Size', 'runFont.Bold', 'runFont.Italic', 'presentation.Saved']),
  rootSources: Object.freeze([]),
  bareArguments: Object.freeze(['Characters', 'Directory', 'Item', 'Leaf', 'PowerPoint.Application', 'SHA256', 'ScriptMethod', 'SilentlyContinue', 'UTF8']),
  exactForms: Object.freeze(['New-Item|New-Item -ItemType Directory -Path $pureRoot', 'Remove-Item|Remove-Item -LiteralPath $deleteRoot -Recurse -Force -ErrorAction SilentlyContinue', 'New-Item|New-Item -ItemType Directory -Path $outputRoot', 'New-Item|New-Item -ItemType Directory -Path $snapshotRoot', 'New-Item|New-Item -ItemType Directory -Path (Join-Path $snapshotRoot \'fonts\')', 'Copy-Item|Copy-Item -LiteralPath $PSCommandPath -Destination $verifierSnapshot', 'Copy-Item|Copy-Item -LiteralPath $processOriginal -Destination $processSnapshot', 'Copy-Item|Copy-Item -LiteralPath $fontHelperOriginal -Destination $fontHelperSnapshot', 'Copy-Item|Copy-Item -LiteralPath $inputPath -Destination $sourceSnapshot', 'Copy-Item|Copy-Item -LiteralPath $fixture.generationPath -Destination $generationSnapshot', 'Copy-Item|Copy-Item -LiteralPath $fixture.licensePath -Destination $licenseSnapshot', 'Copy-Item|Copy-Item -LiteralPath $external -Destination $snapshot', 'Set-Content|Set-Content -LiteralPath (Join-Path $outputRoot \'request.json\') -Encoding UTF8', 'Invoke-OpfWithTemporaryFonts|Invoke-OpfWithTemporaryFonts -Generation $generation -EvidenceRoot $snapshotRoot -RunRoot $outputRoot -Action { $script:fontEmbedWorkerResult=Invoke-OpfNativeWorker -ScriptPath $verifierSnapshot -WorkerArguments @(\'-OutputDirectory\',$outputRoot,\'-InputPresentation\',$sourceSnapshot,\'-FontFixtureDirectory\',$snapshotRoot,\'-Worker\') -OutputDirectory $outputRoot -TimeoutSeconds $TimeoutSeconds }', 'Invoke-OpfNativeWorker|Invoke-OpfNativeWorker -ScriptPath $verifierSnapshot -WorkerArguments @(\'-OutputDirectory\',$outputRoot,\'-InputPresentation\',$sourceSnapshot,\'-FontFixtureDirectory\',$snapshotRoot,\'-Worker\') -OutputDirectory $outputRoot -TimeoutSeconds $TimeoutSeconds', 'Set-Content|Set-Content -LiteralPath (Join-Path $outputRoot \'supervisor.json\') -Encoding UTF8', 'Set-Content|Set-Content -LiteralPath $reportFile -Encoding UTF8', 'Add-Content|Add-Content -LiteralPath $script:stageFile -Encoding UTF8', 'Set-Content|Set-Content -LiteralPath $script:progressFile -Encoding UTF8']),
  exactApis: Object.freeze(['IO.File::WriteAllText|[IO.File]::WriteAllText($wrongLicense,\'not the OFL fixture license\')']),
  exactMembers: Object.freeze(['SaveAs|.SaveAs($savedPath,24,(-1))']),
  pinned: Object.freeze(['operation', 'processsnapshot', 'fonthelpersnapshot', 'pureroot', 'deleteroot', 'outputroot', 'snapshotroot', 'verifiersnapshot', 'sourcesnapshot', 'generationsnapshot', 'licensesnapshot', 'snapshot', 'reportfile', 'stagefile', 'progressfile', 'wronglicense', 'temproot', 'root', 'savedpath']),
  pinnedBindings: Object.freeze(['temproot|=|[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar,[IO.Path]::AltDirectorySeparatorChar)', 'pureroot|=|Join-Path $tempRoot (\'opf-font-embed-pure-\' + [Guid]::NewGuid().ToString(\'n\'))', 'pureroot|=|(Resolve-Path -LiteralPath $pureRoot).Path', 'stagefile|=|Join-Path $pureRoot \'stages.jsonl\'', 'progressfile|=|Join-Path $pureRoot \'progress.json\'', 'wronglicense|=|Join-Path $pureRoot \'wrong-license.txt\'', 'stagefile|=|Join-Path $pureRoot \'observation-stages.jsonl\'', 'deleteroot|=|(Resolve-Path -LiteralPath $pureRoot).Path', 'outputroot|=|[IO.Path]::GetFullPath($OutputDirectory)', 'snapshotroot|=|Join-Path $outputRoot \'inputs\'', 'verifiersnapshot|=|Join-Path $snapshotRoot \'native-font-embed.ps1\'', 'processsnapshot|=|Join-Path $snapshotRoot \'native-process.ps1\'', 'fonthelpersnapshot|=|Join-Path $snapshotRoot \'native-text-fonts.ps1\'', 'sourcesnapshot|=|Join-Path $snapshotRoot \'source.pptx\'', 'generationsnapshot|=|Join-Path $snapshotRoot \'generation.json\'', 'licensesnapshot|=|Join-Path $snapshotRoot \'LICENSE_FONT\'', 'snapshot|=|Join-Path $snapshotRoot $font.file', 'root|=|(Resolve-Path -LiteralPath $OutputDirectory).Path', 'sourcesnapshot|=|(Resolve-Path -LiteralPath $request.source.snapshotPath).Path', 'savedpath|=|Join-Path $root \'native-font-embed.pptx\'', 'stagefile|=|Join-Path $root \'stages.jsonl\'', 'progressfile|=|Join-Path $root \'progress.json\'', 'reportfile|=|Join-Path $root \'report.json\'', 'operation|param|Invoke-FontEmbedCom|ScriptBlock']),
  dynamicMemberSites: Object.freeze([]),
  exemptFunction: 'Invoke-FontEmbedPureRegression',
  exemptInvocations: Object.freeze(['Invoke-Expression $stageDefinition[0].Extent.Text', 'Invoke-Expression $comDefinition[0].Extent.Text']),
});
// Member assignments the embed worker may make: local report/evidence roots, plus the documented COM setters
// (the edit's Text and whole-range/run Font2 Name, Size, Bold, Italic, and Saved on the discard-without-save path).
export const EMBED_LOCAL_ASSIGNMENT_ROOTS = EMBED_SOURCE_POLICY.roots;
export const EMBED_COM_SETTERS = EMBED_SOURCE_POLICY.setters;

const OWNED_EMBED_SAVE_OFF =/\.SaveAs\(\$savedPath,\s*24\s*,\s*0\s*\)/;
const OWNED_EMBED_SAVE_ON = /\.SaveAs\(\$savedPath,\s*24\s*,\s*(?:\(-1\)|-1)\s*\)/;

export function auditEmbedVerifierSource(sourceText, {label = 'native-font-embed.ps1'} = {}) {
  const scan = scanPowerShellSource(sourceText);
  const failures = auditHarnessSourcePolicy(sourceText, {label, ...EMBED_SOURCE_POLICY});
  if (OWNED_EMBED_SAVE_OFF.test(sourceText)) failures.push({code: 'embed-forced-off', message: `${label} must not call SaveAs with EmbedFonts 0`});
  if (!OWNED_EMBED_SAVE_ON.test(sourceText)) failures.push({code: 'embed-not-requested', message: `${label} must call SaveAs with EmbedFonts -1 on the owned presentation`});
  if (hasOfficeQuitInvocation(sourceText)) failures.push({code: 'application-quit', message: `${label} must not call Application.Quit or .Quit()`});
  for (const required of ['nativeFontsGate', 'blockedByNativeFontsGate', 'edited.presentation.native-fonts-gate']) {
    if (!sourceText.includes(required)) failures.push({code: 'missing-native-font-gate', message: `${label} lacks ${required}`});
  }
  const gateInputs = [...scan.code.matchAll(/Get-FontEmbedNativeFontsGate\s+(\$[\w:.]+)/g)].map(match => match[1]);
  if (JSON.stringify(gateInputs) !== JSON.stringify(['$report.nativeFontsObservation'])) failures.push({code: 'native-font-gate-input', message: `${label} must gate SaveAs on exactly one post-edit $report.nativeFontsObservation; found ${gateInputs.join(', ') || 'none'}`});
  for (const required of ['preEditFontsObservation', 'postTextFontsObservations', 'postFormatFontsObservations', 'fontSlotObservations', 'Get-FontEmbedFontsInventory', 'Get-FontEmbedRangeSnapshot', 'Get-FontEmbedFontSlotObservations']) {
    if (!sourceText.includes(required)) failures.push({code: 'missing-diagnostic-observation', message: `${label} lacks ${required}`});
  }
  return failures;
}

export const FONT_SLOT_KEYS = Object.freeze(['name', 'nameAscii', 'nameOther', 'nameFarEast', 'nameComplexScript']);
export const FONT_SLOT_PROPERTIES = Object.freeze(['Name', 'NameAscii', 'NameOther', 'NameFarEast', 'NameComplexScript']);
export const DIAGNOSTIC_PHASES = Object.freeze({preEdit: 'pre-edit', postText: 'post-text', postFormat: 'post-format', postEdit: 'post-edit'});
export const POST_TEXT_RANGES = Object.freeze(['title', 'body']);
export const POST_FORMAT_RANGES = Object.freeze(['title']);
const FONT_SLOT_STAGE_SUFFIXES = Object.freeze(['font.get', ...FONT_SLOT_KEYS.map(key => `font.${key}.get`)]);
const WHOLE_RANGES = new Set(['title', 'body']);

// Stage names emitted by Get-FontEmbedFontsInventory for one phase; entries are enumerated only for a 1..64 count.
export function expectedFontsInventoryStageNames(phase, count) {
  const names = [`${phase}.presentation.fonts.get`, `${phase}.presentation.fonts.count.get`];
  if (isPlainInteger(count) && count >= 1 && count <= 64) for (let index = 1; index <= count; index++) for (const suffix of ['get', 'name.get', 'embedded.get', 'embeddable.get']) names.push(`${phase}.presentation.fonts.item-${index}.${suffix}`);
  return names;
}

// Stage names emitted by Get-FontEmbedFontSlotObservations for one phase; unobserved spans are never read.
export function expectedFontSlotStageNames(phase, records) {
  const names = [];
  for (const record of Array.isArray(records) ? records : []) {
    const range = record?.range;
    if (typeof range !== 'string') continue;
    if (WHOLE_RANGES.has(range)) names.push(`${phase}.${range}.textRange2.get`, `${phase}.${range}.length.get`);
    else if (record?.observed === true) names.push(`${phase}.${range}.get`);
    else continue;
    names.push(...FONT_SLOT_STAGE_SUFFIXES.map(suffix => `${phase}.${range}.${suffix}`));
  }
  return names;
}

// Stage names emitted by Get-FontEmbedRangeSnapshot for one mid-edit snapshot: Fonts inventory, then that whole range's slots.
// post-text: right after a range's .Text set. post-format: after the title's Font2 sets, before the body .Text set.
export function expectedRangeSnapshotStageNames(phase, range, count) {
  return [...expectedFontsInventoryStageNames(`${phase}.${range}`, count), ...expectedFontSlotStageNames(phase, [{range, observed: true}])];
}

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonNegativeInteger = value => isPlainInteger(value) && value >= 0;
const validInventory = observation => {
  const expectedEntries = isPlainInteger(observation?.count) && observation.count >= 1 && observation.count <= 64 ? observation.count : 0;
  return isRecord(observation) && nonNegativeInteger(observation.count) && Array.isArray(observation.entries) && observation.entries.length === expectedEntries && observation.entries.every((entry, index) => isRecord(entry) && entry.index === index + 1 && typeof entry.name === 'string' && isPlainInteger(entry.embedded) && isPlainInteger(entry.embeddable));
};

function validSlotRecord(record, expected, records, phaseKey) {
  if (!isRecord(record) || record.range !== expected.range || typeof record.observed !== 'boolean') return false;
  if (![record.start, record.length, record.textLength].every(nonNegativeInteger)) return false;
  if (expected.whole) {
    if (record.start !== 1 || record.length !== record.textLength || record.observed !== true) return false;
  } else {
    if (record.start !== expected.start || record.length !== expected.length || record.textLength !== records[1]?.textLength) return false;
    const inside = record.start >= 1 && record.length >= 1 && record.start + record.length - 1 <= record.textLength;
    if (record.observed !== inside || (phaseKey === 'postEdit' && !inside)) return false;
  }
  if (!record.observed) return record.slots === null;
  return isRecord(record.slots) && FONT_SLOT_KEYS.every(key => Object.hasOwn(record.slots, key) && (record.slots[key] === null || typeof record.slots[key] === 'string'));
}

// Diagnostic observations are bound for presence and type only. Their font names are never allowlisted: only nativeFontsObservation is a gate.
export function auditDiagnosticObservations(report) {
  const failures = [];
  const need = (condition, code, message) => { if (!condition) failures.push({code, message}); };
  need(validInventory(report?.preEditFontsObservation), 'report-pre-edit-fonts', 'preEditFontsObservation must record a non-negative integer count and, for 1..64, exactly that many indexed string/integer entries');
  const postText = report?.postTextFontsObservations;
  need(isRecord(postText) && POST_TEXT_RANGES.every(range => validInventory(postText[range])), 'report-post-text-fonts', 'postTextFontsObservations.title and .body must each record a bounded, typed Fonts inventory');
  const postFormat = report?.postFormatFontsObservations;
  need(isRecord(postFormat) && POST_FORMAT_RANGES.every(range => validInventory(postFormat[range])), 'report-post-format-fonts', 'postFormatFontsObservations.title must record a bounded, typed Fonts inventory');
  const observations = report?.fontSlotObservations;
  const wholeSnapshot = (key, ranges, message) => {
    const records = observations?.[key];
    need(Array.isArray(records) && records.length === ranges.length && records.every((record, index) => validSlotRecord(record, {range: ranges[index], whole: true}, records, key)), 'report-font-slots', message);
  };
  wholeSnapshot('postText', POST_TEXT_RANGES, 'fontSlotObservations.postText must record the title then body whole-range slots read right after each .Text set');
  wholeSnapshot('postFormat', POST_FORMAT_RANGES, 'fontSlotObservations.postFormat must record the title whole-range slots read after its Font2 sets');
  const runs = report?.requested?.body?.runs;
  const runsValid = Array.isArray(runs) && runs.every(run => isPlainInteger(run?.start) && isPlainInteger(run?.length) && run.start >= 1 && run.length >= 1);
  need(runsValid, 'report-font-slots', 'report.requested.body.runs must be positive integer spans to bind font-slot observations');
  need(isRecord(observations) && JSON.stringify(observations.properties) === JSON.stringify(FONT_SLOT_PROPERTIES), 'report-font-slots', 'fontSlotObservations.properties must list the five TextRange2.Font slot properties');
  const expected = [{range: 'title', whole: true}, {range: 'body', whole: true}, ...(runsValid ? runs.map(run => ({range: `body.run-${run.start}-${run.length}`, start: run.start, length: run.length, whole: false})) : [])];
  for (const phaseKey of ['preEdit', 'postEdit']) {
    const records = observations?.[phaseKey];
    need(runsValid && Array.isArray(records) && records.length === expected.length && records.every((record, index) => validSlotRecord(record, expected[index], records, phaseKey)), 'report-font-slots', `fontSlotObservations.${phaseKey} must record title, body and each requested span with integer bounds and string/null slot names`);
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

// Mirrors Get-FontEmbedNativeFontsGate in native-font-embed.ps1, so a recorded gate can be checked against its own observation.
export function computeNativeFontsGate(observation) {
  const entries = Array.isArray(observation?.entries) ? observation.entries : [];
  const countIsInteger = isPlainInteger(observation?.count);
  const count = countIsInteger ? observation.count : -1;
  const entryTypesValid = entries.every(entry => typeof entry?.name === 'string' && entry.name.length > 0 && isPlainInteger(entry?.embedded) && isPlainInteger(entry?.embeddable));
  const countValid = countIsInteger && entryTypesValid && count >= 1 && count <= 64 && count === entries.length;
  const unexpectedNames = entries.filter(entry => typeof entry?.name !== 'string' || !PERMITTED_NATIVE_FONT_NAMES.includes(entry.name)).map(entry => String(entry?.name ?? ''));
  const unembeddableNames = entries.filter(entry => !isPlainInteger(entry?.embeddable) || entry.embeddable !== -1).map(entry => String(entry?.name ?? ''));
  const baseFamilyPresent = entries.some(entry => entry?.name === 'Carlito');
  return {passed: countValid && baseFamilyPresent && unexpectedNames.length === 0 && unembeddableNames.length === 0, reportedCount: count, entryCount: entries.length, countValid, baseFamilyPresent, allowedReportedNames: [...PERMITTED_NATIVE_FONT_NAMES], unexpectedNames, unembeddableNames, entries};
}

export const LIFECYCLE_MODES = Object.freeze({completed: 'completed', blocked: 'blocked'});
const GATE_STAGE = 'edited.presentation.native-fonts-gate';
const SAVE_STAGE = 'edited.presentation.saveAs-owned-copy-embed-fonts';

// mode "completed": the gate passed and one embed SaveAs completed (the only mode that can pass the embed audit).
// mode "blocked": the gate blocked SaveAs; this validates lifecycle and diagnostic evidence only and never passes the embed audit.
function auditLifecycle({report, supervisor, worker, progress, stages, registrations}, mode = LIFECYCLE_MODES.completed) {
  const failures = [];
  const need = (condition, code, message) => { if (!condition) failures.push({code, message}); };
  const blocked = mode === LIFECYCLE_MODES.blocked;
  const terminalStage = blocked ? 'worker.failure' : 'worker.complete', terminalStatus = blocked ? 'error' : 'success';
  const reportError = report?.error;
  need(report?.kind === 'native-font-embed', 'report-kind', 'report.json must be native-font-embed');
  const sourceBound = nativeHash(report?.source?.sha256) && report?.source?.snapshotSha256 === report?.source?.sha256 && typeof report?.source?.path === 'string' && report.source.path.length > 0 && typeof report?.source?.snapshotPath === 'string' && report.source.snapshotPath.length > 0 && typeof report?.saved?.path === 'string' && report.saved.path.length > 0;
  need(sourceBound && (blocked ? report?.saved?.sha256 === null : nativeHash(report?.saved?.sha256)), 'report-file-binding', blocked ? 'Blocked worker must identify the source and record no saved presentation hash' : 'Worker must identify the source and owned saved presentation paths and hashes');
  need((blocked ? typeof reportError === 'string' && reportError.length > 0 : reportError === null) && report?.cleanupConfirmed === true && report?.officeOperationsStopped === false && report?.ownedCloseCount === 1 && report?.lastStage === terminalStage && report?.lastStatus === terminalStatus, 'report-lifecycle', blocked ? 'Blocked worker report must end at worker.failure with its error, confirmed cleanup, and exactly one owned close' : 'Worker report must end successfully with no error, confirmed cleanup, and exactly one owned close');
  const embed = report?.embedFonts;
  need(embed?.saveFormat === 24 && embed?.saveArgument === -1 && embed?.stage === SAVE_STAGE && (blocked ? embed?.attempted === false && embed?.completed === false && embed?.blockedByNativeFontsGate === true : embed?.attempted === true && embed?.completed === true && embed?.blockedByNativeFontsGate === false), 'report-embed', blocked ? 'Blocked worker report must record no attempted or completed save and blockedByNativeFontsGate true' : 'Worker report must record one allowed completed format 24, EmbedFonts -1 save');
  const observation = report?.nativeFontsObservation, gate = report?.nativeFontsGate;
  const entries = observation?.entries;
  if (blocked) {
    const expectedEntries = isPlainInteger(observation?.count) && observation.count >= 1 && observation.count <= 64 ? observation.count : 0;
    need(isRecord(observation) && isPlainInteger(observation.count) && observation.count >= 0 && Array.isArray(entries) && entries.length === expectedEntries && entries.every((entry, index) => isRecord(entry) && entry.index === index + 1 && typeof entry.name === 'string' && isPlainInteger(entry.embedded) && isPlainInteger(entry.embeddable)), 'native-font-inventory', 'Blocked post-edit native Fonts inventory must be bounded and well-typed');
    const recomputed = computeNativeFontsGate(observation);
    const fields = ['reportedCount', 'entryCount', 'countValid', 'baseFamilyPresent', 'allowedReportedNames', 'unexpectedNames', 'unembeddableNames', 'entries'];
    need(recomputed.passed === false && gate?.passed === false && fields.every(field => JSON.stringify(gate?.[field]) === JSON.stringify(recomputed[field])), 'report-native-font-gate', 'Blocked native Fonts gate must be a failed gate that agrees field by field with a recomputation from the post-edit inventory');
  } else {
    const inventoryValid = isPlainInteger(observation?.count) && observation.count >= 1 && observation.count <= 64 && Array.isArray(entries) && entries.length === observation.count && entries.every((entry, index) => entry?.index === index + 1 && PERMITTED_NATIVE_FONT_NAMES.includes(entry?.name) && [0, -1].includes(entry?.embedded) && entry?.embeddable === -1) && entries.some(entry => entry.name === 'Carlito');
    need(inventoryValid, 'native-font-inventory', 'Complete bounded native Fonts inventory must contain only permitted Carlito names with native embeddability confirmed');
    need(gate?.passed === true && gate?.reportedCount === observation?.count && gate?.entryCount === observation?.count && gate?.countValid === true && gate?.baseFamilyPresent === true && Array.isArray(gate?.unexpectedNames) && gate.unexpectedNames.length === 0 && Array.isArray(gate?.unembeddableNames) && gate.unembeddableNames.length === 0 && JSON.stringify(gate?.allowedReportedNames) === JSON.stringify(PERMITTED_NATIVE_FONT_NAMES) && JSON.stringify(gate?.entries) === JSON.stringify(entries), 'report-native-font-gate', 'Native Fonts gate must agree with its independently validated observation');
  }
  const workerExitValid = blocked ? isPlainInteger(worker?.exitCode) && worker.exitCode !== 0 : worker?.exitCode === 0;
  need(worker?.timedOut === false && workerExitValid && isPlainInteger(worker?.timeoutSeconds) && worker.timeoutSeconds >= 5 && worker.timeoutSeconds <= 60 && isPlainInteger(worker?.processId) && worker.processId > 0 && nativeDate(worker?.startedAt) && nativeDate(worker?.finishedAt) && Date.parse(worker.finishedAt) >= Date.parse(worker.startedAt), 'worker-outcome', blocked ? 'Blocked worker must exit nonzero without timeout within the configured 5-60 second helper bound' : 'Owned worker must exit 0 without timeout within the configured 5-60 second helper bound');
  const supervisorOutcome = blocked
    ? supervisor?.exitCode === worker?.exitCode && supervisor?.officeLifecycleComplete === false && supervisor?.nativeFontsGatePassed === false && supervisor?.embedSaveRecorded === false
    : supervisor?.exitCode === 0 && supervisor?.officeLifecycleComplete === true && supervisor?.nativeFontsGatePassed === true && supervisor?.embedSaveRecorded === true;
  need(supervisor?.timedOut === false && supervisorOutcome && supervisor?.fontCleanupConfirmed === true && supervisor?.inputsUnchanged === true && supervisor?.ownedCloseCount === 1 && supervisor?.parentError === null && supervisor?.lastDurableStage === terminalStage && supervisor?.lastDurableStatus === terminalStatus, 'supervisor-outcome', blocked ? 'Supervisor must record the blocked gate, no save, unchanged inputs, font removals, and one close' : 'Supervisor must confirm lifecycle, gate, save, inputs, removals, and one close');
  need(progress?.stage === terminalStage && progress?.status === terminalStatus && (blocked ? progress?.error === reportError : true) && progress?.cleanupConfirmed === true && progress?.officeOperationsStopped === false && progress?.ownedPresentationPath === null, 'progress-outcome', `Durable progress must end at ${terminalStage}/${terminalStatus} with owned cleanup confirmed`);
  const fontNames = Array.isArray(registrations) ? registrations.map(row => row?.file).sort() : [];
  need(Array.isArray(registrations) && registrations.length === 4 && JSON.stringify(fontNames) === JSON.stringify([...PERMITTED_CARLITO_FIXTURE_FILES].sort()) && registrations.every(row => Object.hasOwn(PERMITTED_CARLITO_FIXTURE, row?.file) && row.sha256 === PERMITTED_CARLITO_FIXTURE[row.file] && isPlainInteger(row?.added) && row.added >= 1 && row?.removed === true), 'font-cleanup', 'Exactly the four unique canonical font registrations must record successful additions and removals');
  need(Array.isArray(stages) && stages.length > 0, 'stage-sequence', 'A complete durable stage sequence is required');
  if (!Array.isArray(stages) || stages.length === 0) return failures;
  const sourcePath = report?.source?.snapshotPath, savedPath = report?.saved?.path;
  const gateError = `${Array.isArray(gate?.unexpectedNames) ? gate.unexpectedNames.join(',') : ''}|${Array.isArray(gate?.unembeddableNames) ? gate.unembeddableNames.join(',') : ''}`;
  // Singleton stages and the one status each may carry. In blocked mode the gate and terminal rows are the only non-null errors.
  const singletons = new Map(blocked
    ? [['worker.initialize', 'success'], [GATE_STAGE, 'blocked'], ['blocked.presentation.cleanup', 'success'], ['worker.failure', 'error']]
    : [['worker.initialize', 'success'], [GATE_STAGE, 'success'], ['edited.presentation.cleanup', 'success'], ['worker.complete', 'success']]);
  const expectedError = stage => blocked && stage === GATE_STAGE ? gateError : blocked && stage === 'worker.failure' ? reportError : null;
  const grouped = new Map();
  for (let index = 0; index < stages.length; index++) {
    const row = stages[index];
    const singletonStatus = singletons.get(row?.stage);
    const statusValid = singletonStatus ? row?.status === singletonStatus : ['begin', 'success'].includes(row?.status);
    need(row?.sequence === index + 1 && typeof row?.stage === 'string' && statusValid && row?.error === expectedError(row?.stage) && row?.officeOperationsStopped === false && typeof row?.cleanupConfirmed === 'boolean' && nativeDate(row?.timestamp), 'stage-sequence', `Stage ${index + 1} is incomplete, noncontiguous, or records an unexpected status or error`);
    need(row?.ownedPresentationPath === null || nativeSamePath(row?.ownedPresentationPath, sourcePath) || (!blocked && nativeSamePath(row?.ownedPresentationPath, savedPath)), 'stage-ownership', `Stage ${index + 1} records an unrelated owned presentation`);
    if (!grouped.has(row?.stage)) grouped.set(row?.stage, []);
    grouped.get(row?.stage).push(row);
    if (!singletonStatus) {
      const partner = row?.status === 'begin' ? stages[index + 1] : stages[index - 1];
      need(partner?.stage === row?.stage && partner?.status === (row?.status === 'begin' ? 'success' : 'begin'), 'stage-pair', `Unpaired COM stage at sequence ${index + 1}`);
    }
  }
  for (const [stage, rows] of grouped) need(singletons.has(stage) ? rows.length === 1 && rows[0]?.status === singletons.get(stage) : rows.length === 2 && rows[0]?.status === 'begin' && rows[1]?.status === 'success', 'stage-duplicate', `Unexpected repeated or incomplete stage ${stage}`);
  const paired = (name, ownedPath) => {
    const rows = grouped.get(name) ?? [];
    need(rows.length === 2 && rows[0]?.status === 'begin' && rows[1]?.status === 'success', 'stage-required', `Missing paired ${name}`);
    if (ownedPath !== undefined) need(rows.every(row => nativeSamePath(row?.ownedPresentationPath, ownedPath)), 'stage-ownership', `${name} does not identify the expected owned presentation`);
    return rows[1]?.sequence;
  };
  const singleton = (name, ownedPath) => {
    const rows = grouped.get(name) ?? [];
    need(rows.length === 1 && rows[0]?.status === singletons.get(name), 'stage-required', `Missing ${singletons.get(name)} ${name}`);
    if (ownedPath === null) need(rows[0]?.ownedPresentationPath === null, 'stage-ownership', `${name} must confirm no owned presentation remains`);
    else if (ownedPath !== undefined) need(nativeSamePath(rows[0]?.ownedPresentationPath, ownedPath), 'stage-ownership', `${name} has the wrong owned presentation`);
    return rows[0]?.sequence;
  };
  const initialized = singleton('worker.initialize', null);
  const opened = paired('input.presentation.open', sourcePath);
  // Diagnostic observation stages: pre-edit Fonts inventory and font slots before any edit set, post-text/post-format snapshots between edits,
  // post-edit slots after the gated inventory. Only the post-edit edited.presentation.fonts.* inventory feeds the gate.
  const preEditRecords = report?.fontSlotObservations?.preEdit, postEditRecords = report?.fontSlotObservations?.postEdit;
  const diagnosticNames = [
    ...expectedFontsInventoryStageNames(DIAGNOSTIC_PHASES.preEdit, report?.preEditFontsObservation?.count),
    ...expectedFontSlotStageNames(DIAGNOSTIC_PHASES.preEdit, preEditRecords),
  ];
  const postEditNames = expectedFontSlotStageNames(DIAGNOSTIC_PHASES.postEdit, postEditRecords);
  const postTextNames = Object.fromEntries(POST_TEXT_RANGES.map(range => [range, expectedRangeSnapshotStageNames(DIAGNOSTIC_PHASES.postText, range, report?.postTextFontsObservations?.[range]?.count)]));
  const postFormatTitleNames = expectedRangeSnapshotStageNames(DIAGNOSTIC_PHASES.postFormat, 'title', report?.postFormatFontsObservations?.title?.count);
  const expectedDiagnostic = new Set([...diagnosticNames, ...Object.values(postTextNames).flat(), ...postFormatTitleNames, ...postEditNames]);
  const unexpectedDiagnostic = stages.filter(row => typeof row?.stage === 'string' && /^(?:pre-edit|post-text|post-format|post-edit)\./.test(row.stage) && !expectedDiagnostic.has(row.stage)).map(row => row.stage);
  need(unexpectedDiagnostic.length === 0, 'stage-diagnostic-bound', `Diagnostic stages outside the bounded observation set: ${[...new Set(unexpectedDiagnostic)].join(', ')}`);
  const preEditObserved = diagnosticNames.map(name => paired(name, sourcePath));
  const editSets = stages.filter(row => typeof row?.stage === 'string' && /^edit\..+\.set$/.test(row.stage));
  // Each range: .Text set, then its post-text snapshot, then every other set on that range (its Font2 property sets).
  const editRange = range => {
    const textSet = paired(`edit.${range}.text.set`, sourcePath);
    const snapshot = postTextNames[range].map(name => paired(name, sourcePath));
    const laterSets = editSets.filter(row => row.stage.startsWith(`edit.${range}.`) && row.stage !== `edit.${range}.text.set`);
    need(laterSets.length > 0 && isPlainInteger(snapshot.at(-1)) && laterSets.every(row => row.sequence > snapshot.at(-1)), 'stage-diagnostic-order', `Every edit.${range} Font2 set must follow its post-text snapshot`);
    return [textSet, ...snapshot, paired(`edit.${range}.font.name.set`, sourcePath)];
  };
  const [editTitleText, ...titleAfterText] = editRange('title');
  // post-format.title: after every title set, before the body .Text set (the milestone order below enforces the latter).
  const postFormatObserved = postFormatTitleNames.map(name => paired(name, sourcePath));
  const titleSets = editSets.filter(row => row.stage.startsWith('edit.title.'));
  need(isPlainInteger(postFormatObserved[0]) && titleSets.every(row => row.sequence < postFormatObserved[0] - 1), 'stage-diagnostic-order', 'Every edit.title set must precede the post-format.title snapshot');
  const [editBodyText, ...bodyAfterText] = editRange('body');
  const fontsRead = [paired('edited.presentation.fonts.get', sourcePath), paired('edited.presentation.fonts.count.get', sourcePath)];
  if (Array.isArray(entries)) for (let index = 1; index <= entries.length; index++) for (const suffix of ['get', 'name.get', 'embedded.get', 'embeddable.get']) fontsRead.push(paired(`edited.presentation.fonts.item-${index}.${suffix}`, sourcePath));
  const lastPreEdit = preEditObserved.length ? preEditObserved.at(-1) : undefined;
  need(editSets.length > 0 && isPlainInteger(lastPreEdit) && isPlainInteger(fontsRead[0]) && editSets.every(row => row.sequence > lastPreEdit && row.sequence < fontsRead[0] - 1), 'stage-diagnostic-order', 'Every edit set must follow all pre-edit observations and precede the post-edit Fonts inventory');
  const postEditObserved = postEditNames.map(name => paired(name, sourcePath));
  const gateSequence = singleton(GATE_STAGE, sourcePath);
  const tail = blocked
    ? [paired('blocked.presentation.fullName.get', sourcePath), paired('blocked.presentation.saved.set', sourcePath), paired('blocked.presentation.close', sourcePath), singleton('blocked.presentation.cleanup', null), singleton('worker.failure', null)]
    : [paired(SAVE_STAGE, sourcePath), paired('edited.presentation.fullName.get', savedPath), paired('edited.presentation.close', savedPath), singleton('edited.presentation.cleanup', null), singleton('worker.complete', null)];
  const milestones = [initialized, opened, ...preEditObserved, editTitleText, ...titleAfterText, ...postFormatObserved, editBodyText, ...bodyAfterText, ...fontsRead, ...postEditObserved, gateSequence, ...tail];
  need(initialized === 1 && milestones.every(isPlainInteger) && milestones.every((value, index) => index === 0 || value > milestones[index - 1]), 'stage-order', `Required initialization, open, pre-edit observations, per-range .Text set and post-text snapshot, post-format title snapshot, edits, font inventory, post-edit observations, gate, ${blocked ? 'discarding close and failure' : 'save, close, cleanup, and completion'} are missing or out of order`);
  if (blocked) need(!stages.some(row => typeof row?.stage === 'string' && /saveas/i.test(row.stage)), 'stage-no-save', 'A blocked attempt must record no SaveAs stage');
  need(stages.filter(row => typeof row?.stage === 'string' && row.stage.endsWith('.close') && row?.status === 'success').length === 1, 'stage-close', 'Exactly one owned close is permitted');
  const final = stages.at(-1);
  need(tail.at(-1) === stages.length && final?.cleanupConfirmed === true && final?.ownedPresentationPath === null && JSON.stringify(progress) === JSON.stringify(final), 'stage-terminal', `${terminalStage} must be the final durable stage and match progress.json exactly`);
  need(nativeDate(supervisor?.timestamp) && nativeDate(final?.timestamp) && Date.parse(supervisor.timestamp) >= Date.parse(final.timestamp), 'supervisor-time', 'Supervisor completion must follow the final durable worker stage');
  return failures;
}

export function auditSavedEmbedPresentation(evidence) {
  const failures = [...auditCanonicalFixtureManifest(evidence.generation), ...auditLifecycle(evidence), ...auditDiagnosticObservations(evidence.report), ...(evidence.inputBindingFailures ?? [])];
  const opc = inspectFontEmbeddingPackage(evidence.pptxBytes);
  failures.push(...opc.failures);
  if (evidence.report?.saved?.sha256 !== opc.packageSha256) failures.push({code: 'saved-hash', message: 'report.saved.sha256 does not match native-font-embed.pptx'});
  return {failures, opc, passed: failures.length === 0, scope: 'Lifecycle-bound OPC font relationship/content-type audit. Raw obfuscated part hashes are structural evidence only; physical face and per-glyph identity remain unproven.'};
}

const BLOCKED_SCOPE = 'Blocked-evidence diagnostic audit. It checks that an attempt whose native Fonts gate blocked SaveAs kept a clean lifecycle (one discarding owned close, no SaveAs, fonts removed, inputs unchanged) and well-typed, correctly staged diagnostic observations. It never passes the embed audit: embedGatePassed is always false and no embedded font or saved package is claimed.';

// Blocked-evidence mode: validates the lifecycle and diagnostic observations of a gate-blocked attempt. It has no "passed" field on purpose.
export function auditBlockedEmbedEvidence(evidence) {
  const failures = [...auditCanonicalFixtureManifest(evidence.generation), ...auditLifecycle(evidence, LIFECYCLE_MODES.blocked), ...auditDiagnosticObservations(evidence.report), ...(evidence.inputBindingFailures ?? [])];
  if (evidence.pptxBytes) failures.push({code: 'blocked-saved-package-present', message: 'A blocked attempt must not leave native-font-embed.pptx'});
  return {failures, embedGatePassed: false, diagnosticEvidenceValid: failures.length === 0, scope: BLOCKED_SCOPE};
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

// Shared evidence loading and input binding for both audit modes.
async function loadAndBindEvidence(root, {requirePptx}) {
  const failures = [], rawHashes = {};
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
  let pptxBytes = null;
  if (requirePptx) pptxBytes = await readRequired(root, 'native-font-embed.pptx', failures, rawHashes, bytes => bytes);
  else {
    try { pptxBytes = await readFile(path.join(root, 'native-font-embed.pptx')); rawHashes['native-font-embed.pptx'] = sha(pptxBytes); }
    catch (error) { if (error?.code !== 'ENOENT') failures.push({code: 'evidence-read', message: `native-font-embed.pptx cannot be checked: ${error.message}`}); }
  }
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
  const evidenceComplete = Boolean(report && supervisor && worker && progress && stages && registrations && generation);
  return {failures, rawHashes, evidence: {report, supervisor, worker, progress, stages, registrations, generation, pptxBytes}, evidenceComplete};
}

export async function auditEvidenceDirectory(evidenceDirectory) {
  const root = path.resolve(evidenceDirectory);
  const {failures, rawHashes, evidence, evidenceComplete} = await loadAndBindEvidence(root, {requirePptx: true});
  let opc = null;
  if (evidenceComplete && evidence.pptxBytes) {
    const result = auditSavedEmbedPresentation(evidence);
    failures.push(...result.failures); opc = result.opc;
  }
  return {schemaVersion:2, kind:'native-font-embed-opc-audit', evidenceDirectory:root, passed:failures.length === 0, failures, rawHashes, opc, scope:'Offline lifecycle/input binding and font-related OPC structural audit. No Office or font API is started. Obfuscated font-part bytes are not physical face or per-glyph identity proof.'};
}

// Names reported by each Fonts snapshot, in the order they were taken; a reading aid only, not a gate.
function fontsTimeline(report) {
  const names = observation => Array.isArray(observation?.entries) ? observation.entries.map(entry => entry?.name) : null;
  return [
    {snapshot: 'pre-edit', names: names(report?.preEditFontsObservation)},
    {snapshot: 'post-text.title', names: names(report?.postTextFontsObservations?.title)},
    {snapshot: 'post-format.title', names: names(report?.postFormatFontsObservations?.title)},
    {snapshot: 'post-text.body', names: names(report?.postTextFontsObservations?.body)},
    {snapshot: 'edited (gated)', names: names(report?.nativeFontsObservation)},
  ];
}

export async function auditBlockedEvidenceDirectory(evidenceDirectory) {
  const root = path.resolve(evidenceDirectory);
  const {failures, rawHashes, evidence, evidenceComplete} = await loadAndBindEvidence(root, {requirePptx: false});
  if (evidenceComplete) failures.push(...auditBlockedEmbedEvidence(evidence).failures);
  else if (evidence.pptxBytes) failures.push({code: 'blocked-saved-package-present', message: 'A blocked attempt must not leave native-font-embed.pptx'});
  return {schemaVersion: 1, kind: 'native-font-embed-blocked-diagnostic-audit', evidenceDirectory: root, embedGatePassed: false, diagnosticEvidenceValid: failures.length === 0, failures, fontsTimeline: fontsTimeline(evidence.report), rawHashes, scope: BLOCKED_SCOPE};
}

const CLI_MODES = Object.freeze({
  completed: {file: 'embed-opc-audit.json', run: auditEvidenceDirectory, ok: out => out.passed === true, summary: out => ({passed: out.passed, failures: out.failures.length}), error: (root, message) => ({schemaVersion: 2, kind: 'native-font-embed-opc-audit', evidenceDirectory: root, passed: false, failures: [{code: 'audit-error', message}], scope: 'Offline audit failed before completion.'})},
  blocked: {file: 'blocked-diagnostic-audit.json', run: auditBlockedEvidenceDirectory, ok: out => out.diagnosticEvidenceValid === true, summary: out => ({embedGatePassed: false, diagnosticEvidenceValid: out.diagnosticEvidenceValid, failures: out.failures.length}), error: (root, message) => ({schemaVersion: 1, kind: 'native-font-embed-blocked-diagnostic-audit', evidenceDirectory: root, embedGatePassed: false, diagnosticEvidenceValid: false, failures: [{code: 'audit-error', message}], scope: BLOCKED_SCOPE})},
});

async function runCli() {
  const args = process.argv.slice(2);
  const flags = args.filter(arg => arg.startsWith('--')), positional = args.filter(arg => !arg.startsWith('--'));
  const usage = 'Usage: node test/native-font-embed-audit.mjs EVIDENCE_DIRECTORY [--blocked]';
  if (positional.length !== 1 || flags.some(flag => flag !== '--blocked')) { console.error(JSON.stringify({passed: false, error: usage})); process.exitCode = 1; return; }
  const mode = CLI_MODES[flags.includes('--blocked') ? 'blocked' : 'completed'];
  const root = path.resolve(positional[0]);
  try { if (!(await stat(root)).isDirectory()) throw new Error('not a directory'); }
  catch { console.error(JSON.stringify({passed: false, error: `Evidence directory does not exist: ${root}`})); process.exitCode = 1; return; }
  const outPath = path.join(root, mode.file);
  try { await stat(outPath); console.error(JSON.stringify({passed: false, error: `Refusing to overwrite existing audit: ${outPath}`})); process.exitCode = 1; return; }
  catch (error) { if (error?.code !== 'ENOENT') { console.error(JSON.stringify({passed: false, error: error.message})); process.exitCode = 1; return; } }
  let out;
  try { out = await mode.run(root); }
  catch (error) { out = mode.error(root, error.message); }
  await writeFile(outPath, JSON.stringify(out, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify({...mode.summary(out), outPath}));
  process.exitCode = mode.ok(out) ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) await runCli();
