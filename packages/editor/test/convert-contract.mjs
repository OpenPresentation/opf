// RR-73: the editor's `convert(deck, { format })` has the name and the result of core's in-memory `convert`. The result's keys and each
// file's keys are read from core's own declarations (`ConvertResult`, `ConvertedFile` in the installed @openpresentation/opf), and every
// finding is checked against core's finding.schema.json. Then the options: one-based slide selections (core's `parseSlideSelection`),
// `zip`, `raster`, `name`, and the findings the renderer and the PDF converter report.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import JSZip from 'jszip';
import { convert, slidesToConvert } from '../src/export.js';

// ---- Core's contract, from core's files -------------------------------------------------------------------------------------------------
const require = createRequire(import.meta.url);
const coreRoot = path.dirname(require.resolve('@openpresentation/opf/package.json'));
const declarations = readdirSync(path.join(coreRoot, 'dist')).filter((file) => file.endsWith('.d.ts')).map((file) => readFileSync(path.join(coreRoot, 'dist', file), 'utf8')).join('\n');
const membersOf = (name) => {
  const match = new RegExp(`interface ${name} \\{([\\s\\S]*?)\\n\\}`).exec(declarations);
  assert.ok(match, `core declares ${name}`);
  return new Map([...match[1].matchAll(/^\s{4}(\w+)(\??):/gm)].map(([, key, optional]) => [key, optional === '?']));
};
const resultMembers = membersOf('ConvertResult');
const fileMembers = membersOf('ConvertedFile');
assert.ok(fileMembers.has('slide') && fileMembers.has('entries') && resultMembers.has('files') && resultMembers.has('findings'), 'the declarations were read');
const schema = JSON.parse(readFileSync(path.join(coreRoot, 'dist/spec/schemas/finding.schema.json'), 'utf8'));
const findingSchema = schema.$defs?.Finding ?? schema.definitions?.Finding;
const ruleIdPattern = new RegExp(findingSchema.properties.ruleId.pattern);

function assertResult(result, label) {
  for (const [key, optional] of resultMembers) if (!optional) assert.ok(key in result, `${label}: the result has ${key}`);
  for (const key of Object.keys(result)) assert.ok(resultMembers.has(key), `${label}: ${key} is a ConvertResult member`);
  assert.equal('download' in result || 'diagnostics' in result, false, `${label}: no 0.17 members`);
  for (const file of result.files) {
    for (const [key, optional] of fileMembers) if (!optional) assert.ok(key in file, `${label}: ${file.name} has ${key}`);
    for (const key of Object.keys(file)) assert.ok(fileMembers.has(key), `${label}: ${key} is a ConvertedFile member`);
    assert.equal(typeof file.name, 'string');
    assert.equal(typeof file.type, 'string');
    assert.ok(file.bytes instanceof Uint8Array && file.bytes.length > 0, `${label}: ${file.name} has bytes`);
    if ('slide' in file) assert.ok(Number.isInteger(file.slide) && file.slide >= 1, `${label}: ${file.name} slide is counted from 1`);
  }
  for (const finding of result.findings) assertFinding(finding, label);
}
function assertFinding(finding, label) {
  const where = `${label}: ${JSON.stringify(finding)}`;
  for (const key of findingSchema.required) assert.ok(key in finding, `${where} has ${key}`);
  for (const key of Object.keys(finding)) assert.ok(key in findingSchema.properties, `${where}: ${key} is a Finding property (additionalProperties: false)`);
  assert.match(finding.ruleId, ruleIdPattern, where);
  assert.ok(['error', 'warning', 'info'].includes(finding.severity), where);
  assert.equal(typeof finding.category, 'string');
  assert.ok(finding.path === '' || finding.path.startsWith('/'), `${where}: path is a JSON Pointer`);
  if ('slide' in finding) assert.ok(Number.isInteger(finding.slide) && finding.slide >= 0, `${where}: a finding's slide is zero-based (Finding schema)`);
  if ('measured' in finding) for (const value of Object.values(finding.measured)) assert.ok(value === null || ['string', 'number', 'boolean'].includes(typeof value), `${where}: measured values are scalars`);
}

// ---- A deck with a hidden slide, a missing picture and a theme that resolves nowhere ------------------------------------------------------
const deck = {
  name: 'Board update', filename: 'board.pptx',
  slides: [
    { id: 'intro', title: 'Board update' },
    { id: 'backup', title: 'Backup', hidden: true },
    { id: 'chart', title: 'Results', image: { src: 'nowhere/missing.png', alt: 'Results chart' } },
    { id: 'close', title: 'Next', design: { theme: 'no-such-theme' } },
  ],
};
const seen = {};
const converters = {
  async toPdf(svgs, options) {
    seen.pdf = { svgs, options };
    options.onDiagnostic({ code: 'pdf-font-embedded', family: 'Roboto', weight: 400, italic: false, embedding: 'subset', glyphs: 9 });
    options.onDiagnostic({ code: 'pdf-glyph-missing', message: 'No face has U+2603.', path: 'slides.0.title', characters: ['☃'] });
    return Uint8Array.from([37, 80, 68, 70, 45]);
  },
  // A 1 x 1 PNG header, scaled: width and height come from the IHDR.
  async toPng(_svg, options) {
    const bytes = new Uint8Array(33);
    bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
    const view = new DataView(bytes.buffer);
    view.setUint32(16, 1280 * options.scale);
    view.setUint32(20, 720 * options.scale);
    return bytes;
  },
};

// ---- SVG: one file per presented slide, numbered from 1 --------------------------------------------------------------------------------
{
  const streamed = [];
  const result = await convert(deck, { format: 'svg', onFinding: (finding) => streamed.push(finding) });
  assertResult(result, 'svg');
  assert.deepEqual(result.files.map((file) => [file.name, file.slide, file.id, file.width, file.height]), [
    ['board-001.svg', 1, 'intro', 1280, 720],
    ['board-003.svg', 3, 'chart', 1280, 720],
    ['board-004.svg', 4, 'close', 1280, 720],
  ], 'the hidden slide is skipped and files carry their one-based slide');
  assert.deepEqual(result.findings.map((finding) => [finding.ruleId, finding.path, finding.slide, finding.slideId]), [
    ['render/unresolved-asset', '/slides/2/image', 2, 'chart'],
    ['render/unresolved-reference', '/slides/3/design/theme', 3, 'close'],
  ], 'renderer notes are findings with render/ rule ids');
  assert.deepEqual(streamed, result.findings, 'onFinding hears each finding');
}

// ---- Slide selections count from 1 (core's parseSlideSelection) ------------------------------------------------------------------------
{
  const slidesOf = async (slides) => (await convert(deck, { format: 'svg', slides })).files.map((file) => file.slide);
  assert.deepEqual(await slidesOf(2), [2], 'a hidden slide named by number is converted');
  assert.deepEqual(await slidesOf('1-2'), [1, 2]);
  assert.deepEqual(await slidesOf('1,3-4'), [1, 3, 4]);
  assert.deepEqual(await slidesOf('3-'), [3, 4]);
  assert.deepEqual(await slidesOf([4, 1]), [1, 4]);
  assert.deepEqual((await convert(deck, { format: 'svg', includeHidden: true })).files.map((file) => file.slide), [1, 2, 3, 4]);
  assert.deepEqual(slidesToConvert(deck, { slides: '-2' }), [1, 2]);
  for (const bad of [0, 5, '2-1', 'current', [0, 1]]) await assert.rejects(convert(deck, { format: 'svg', slides: bad }), { code: 'invalid-option' }, `slides ${JSON.stringify(bad)} is refused`);
  // Only the findings of the converted slides are kept.
  const first = await convert(deck, { format: 'svg', slides: 1 });
  assert.deepEqual(first.findings, []);
}

// ---- zip and name -------------------------------------------------------------------------------------------------------------------------
{
  const zipped = await convert(deck, { format: 'svg', slides: '3-4', zip: true });
  assertResult(zipped, 'svg zip');
  assert.equal(zipped.files.length, 1);
  assert.deepEqual([zipped.files[0].name, zipped.files[0].type, zipped.files[0].entries], ['board.zip', 'application/zip', ['board-003.svg', 'board-004.svg']]);
  assert.deepEqual(Object.keys((await JSZip.loadAsync(zipped.files[0].bytes)).files).sort(), ['board-003.svg', 'board-004.svg']);
  const one = await convert(deck, { format: 'png', slides: 1, zip: true, converters });
  assert.deepEqual(one.files.map((file) => [file.name, file.entries]), [['board.zip', ['board-001.png']]], 'zip makes an archive even of one slide');
  const named = await convert(deck, { format: 'png', name: 'Quarter 3 / final', scale: 2, converters });
  assertResult(named, 'png');
  assert.deepEqual(named.files.map((file) => [file.name, file.slide, file.width, file.height]), [
    ['Quarter-3-final-001.png', 1, 2560, 1440], ['Quarter-3-final-003.png', 3, 2560, 1440], ['Quarter-3-final-004.png', 4, 2560, 1440],
  ], 'name replaces the deck\'s file name, made safe to save; a PNG reports its pixel size');
  assert.equal((await convert(deck, { format: 'pdf', name: 'minutes', converters })).files[0].name, 'minutes.pdf');
  await assert.rejects(convert(deck, { format: 'pdf', zip: true, converters }), { code: 'invalid-option' }, 'a PDF is already one file');
}

// ---- PDF: raster, pages and slides, converter findings ---------------------------------------------------------------------------------
{
  const vector = await convert(deck, { format: 'pdf', converters });
  assertResult(vector, 'pdf');
  assert.deepEqual(vector.files.map((file) => [file.name, file.type, file.pages, file.slides]), [['board.pdf', 'application/pdf', 3, [1, 3, 4]]]);
  assert.equal('raster' in seen.pdf.options, false, 'vector is the default');
  const embedded = vector.findings.find((finding) => finding.ruleId === 'pdf/pdf-font-embedded');
  assert.deepEqual([embedded.severity, embedded.path, embedded.measured.family, embedded.measured.glyphs], ['info', '', 'Roboto', 9]);
  const missing = vector.findings.find((finding) => finding.ruleId === 'pdf/pdf-glyph-missing');
  assert.deepEqual([missing.severity, missing.path, missing.slide, missing.slideId, missing.measured.characters], ['warning', '/slides/0/title', 0, 'intro', '☃']);
  const pdfLib = { PDFDocument: { create: async () => ({}) } };
  await convert(deck, { format: 'pdf', raster: true, pdfLib, scale: 3, converters });
  assert.deepEqual([seen.pdf.options.raster, seen.pdf.options.pdfLib, seen.pdf.options.scale], [true, pdfLib, 3], 'raster: true reaches the converter with pdf-lib');
  await assert.rejects(convert(deck, { format: 'png', raster: true, converters }), { code: 'invalid-option' }, 'raster applies to PDF');
}

// ---- The 0.17 names are gone ---------------------------------------------------------------------------------------------------------------
const exported = await import('../src/export.js');
for (const name of ['exportDeck', 'describeDiagnostic', 'slidesToExport']) assert.equal(name in exported, false, `${name} is removed, not aliased`);

console.log('convert contract passed: ConvertResult and ConvertedFile members from core, findings against finding.schema.json, one-based selections, zip, raster, name.');
