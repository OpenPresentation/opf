// Retained project-authored Keynote outputs; portable classification, not native acceptance.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {unzipSync, zipSync, strFromU8, strToU8} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {fromPptx, toPptx, resolvePresentation} from './helpers/default-catalog.mjs';
import {attachTextTags, nativeShapeParagraphs, nativeTextShapes} from '../dist/code-provenance.js';
import {classifyNativeFooters} from '../dist/native-footer-classification.js';

const directory = new URL('./fixtures/keynote-footer-classification/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', directory)));
const beforeBytes = await readFile(new URL('before-imports.json', directory));
// The isolated7f control remains immutable historical evidence.
const integratedManifest = JSON.parse(await readFile(new URL('integrated-before-manifest.json', directory)));
const integratedBytes = await readFile(new URL(integratedManifest.beforeImport.file, directory));
const before = JSON.parse(integratedBytes);
const hash = value => createHash('sha256').update(value).digest('hex');
assert.equal(hash(beforeBytes), manifest.beforeImport.sha256);
assert.equal(beforeBytes.length, manifest.beforeImport.bytes);
assert.equal(manifest.beforeImport.runtimeRevision, '7f300b42166c55ee14f8f9432e7340ded26f5ee4');
assert.equal(integratedManifest.kind, 'same-final-runtime-minus-classifier-import-control');
assert.equal(integratedManifest.source.revision, '676d2d86ea7182a2fae6ad00214b58cf5383555a');
assert.equal(integratedManifest.source.registryAcceptance, false); assert.equal(integratedManifest.source.nativeAcceptance, false);
assert.deepEqual(integratedManifest.inputs, manifest.fixtures);
assert.deepEqual(integratedManifest.historicalControl.beforeImport, manifest.beforeImport);
assert.equal(hash(integratedBytes), integratedManifest.beforeImport.sha256);
assert.equal(integratedBytes.length, integratedManifest.beforeImport.bytes);
assert.equal(integratedManifest.ablation.module, 'dist/native-footer-classification.js');
assert.equal(integratedManifest.ablation.otherRuntimeFilesExact, 68);
assert.equal(integratedManifest.sourceRuntimeFiles.length, 69);

const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false});
const options = {seed: 86, timestamp: '2026-10-15T12:00:00Z', zipDate: '2026-10-15T12:00:00Z'};
const read = async bytes => {const issues = []; const document = await fromPptx(bytes, {onDiagnostic: issue => issues.push(issue)}); return {document, issues};};
const footer = (document, index = 7) => document.slides[index].design?.footer ?? document.design?.footer;
const composed = (document, index = 7) => resolvePresentation(document).slides[index].geometry.furniture?.parts.filter(part => part.kind === 'footer') ?? [];
const bodyWords = slide => JSON.stringify({text: slide.text, blocks: slide.blocks, title: slide.title, subtitle: slide.subtitle, tag: slide.tag});
const hasLiteral = document => document.slides.some(slide => bodyWords(slide).includes('Keynote qualification'));
const fixtures = [];
// RR-96: a table fill equal to a color of the package theme imports as that slot (the sealed control predates it, so its literals are read the same way).
const FIXTURE_THEME_SLOTS = {'#2874A6': 'accent1', '#011842': 'light1'};
const slotFills = value => {
  if (Array.isArray(value)) return value.map(slotFills);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, key === 'fill' && typeof entry === 'string' && FIXTURE_THEME_SLOTS[entry.toUpperCase()] ? FIXTURE_THEME_SLOTS[entry.toUpperCase()] : slotFills(entry)]));
};
for (const [index, fixture] of manifest.fixtures.entries()) {
  const bytes = new Uint8Array(await readFile(new URL(fixture.file, directory)));
  assert.equal(bytes.length, fixture.bytes); assert.equal(hash(bytes), fixture.sha256);
  const current = await read(bytes), expected = slotFills(structuredClone(before[index].document));
  assert.equal(before[index].name, index ? 'B' : 'A');
  for (const slide of expected.slides) {
    const matches = slide.blocks?.filter(block => block.type === 'text' && block.text?.[0]?.text === 'Keynote qualification');
    assert.equal(matches?.length, 1, 'One former literal body block per retained native slide');
    slide.blocks = slide.blocks.filter(block => block !== matches[0]);
    if (!slide.blocks.length) delete slide.blocks;
  }
  expected.design.footer.left = {text: 'Keynote qualification'};
  assert.deepEqual(current.document, expected, 'Only literal-block removal and footer addition differ from the same-final-runtime diagnostic control');
  assert.deepEqual(current.issues, before[index].issues, 'All twenty ordered diagnostics remain exact, including the K11 paint finding');
  assert.equal(current.issues.length, 20);
  assert.equal(hash(JSON.stringify(current.issues)), '35e19ae9237a0b08adea0c8c72accad2c12cd1492757f1c2657ddbc061db066f');
  assert.deepEqual(current.issues.filter(value => value.path === 'slides.10.charts.0.series.0.line.color'), [integratedManifest.expectedK11Diagnostic]);
  assert.equal(current.document.slides.length, 16);
  assert.equal(hasLiteral(current.document), false);
  assert.equal(footer(current.document).right.text, '{{slide.number}}');
  assert.equal(composed(current.document).filter(part => part.text === 'Keynote qualification').length, 1);
  fixtures.push({bytes, entries: unzipSync(bytes)});
}
const base = fixtures[1].entries, path = 'ppt/slides/slide8.xml';
const xml = entries => strFromU8(entries[path]);
const name = part => `OPF furniture 7 part ${part} line 0`;
const shapes = value => [...value.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(match => match[0]);
const find = (value, part) => shapes(value).find(shape => shape.includes(`name="${name(part)}"`));
const editShape = (entries, part, transform) => {
  const original = find(xml(entries), part); assert.ok(original, `Current part ${part}`);
  const changed = transform(original); assert.notEqual(changed, original, 'Mutation really applied');
  entries[path] = strToU8(xml(entries).replace(original, changed));
};
const textXml = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const words = (shape, value) => shape.replace(/<a:t>[\s\S]*?<\/a:t>/, `<a:t>${textXml(value)}</a:t>`);
const mutate = async callback => {const entries = {...base}; callback(entries); return read(zipSync(entries));};
const noLiteral = result => {
  assert.equal(footer(result.document)?.left, undefined, 'Current slide has no recovered literal; deck majority cannot restore it');
  assert.ok(!composed(result.document).some(part => part.text === 'Keynote qualification'));
};
let controls = 2;
for (const current of ['  current edited words  ', 'Changed footer']) {
  const result = await mutate(entries => editShape(entries, 0, shape => words(shape, current)));
  assert.equal(footer(result.document).left.text, current);
  assert.equal(composed(result.document).find(part => part.zone === 'left').text, current);
  assert.ok(!bodyWords(result.document.slides[7]).includes(current)); controls++;
}
for (const transform of [shape => words(shape, ''), () => '']) {
  const result = await mutate(entries => editShape(entries, 0, transform)); noLiteral(result);
  assert.ok(!bodyWords(result.document.slides[7]).includes('Keynote qualification')); controls++;
}
for (const remove of [false, true]) {
  const entries = {...base};
  for (let index = 1; index <= 16; index++) {
    const part = `ppt/slides/slide${index}.xml`;
    entries[part] = strToU8(strFromU8(entries[part]).replace(/<p:sp>[\s\S]*?<\/p:sp>/g, shape => /name="OPF furniture \d+ part 0 line 0"/.test(shape) ? remove ? '' : words(shape, '') : shape));
  }
  const result = await read(zipSync(entries));
  assert.equal(result.document.design.footer.left, undefined);
  assert.ok(result.document.slides.every((_, index) => !composed(result.document, index).some(part => part.text === 'Keynote qualification'))); controls++;
}
const rejected = [
  ['renamed literal', 0, shape => shape.replace(name(0), 'Current ordinary text'), false],
  ['renamed anchor', 1, shape => shape.replace(name(1), 'Current number')],
  ['different group', 1, shape => shape.replace(name(1), 'OPF furniture 99 part 1 line 0')],
  ['different line', 0, shape => shape.replace(name(0), 'OPF furniture 7 part 0 line 1'), false],
  ['noncanonical group', 0, shape => shape.replace(name(0), 'OPF furniture 07 part 0 line 0'), false],
  ['static number', 1, shape => shape.replace(/<a:fld\b[^>]*\/>/, '<a:r><a:t>8</a:t></a:r>')],
  ['different field', 1, shape => shape.replace('type="slidenum"', 'type="datetime1"')],
  ['deleted anchor', 1, () => ''],
  ['one EMU y mismatch', 0, shape => shape.replace('y="6380603"', 'y="6380604"')],
  ['one EMU height mismatch', 0, shape => shape.replace('cy="172816"', 'cy="172817"')],
  ['outside band literal', 0, shape => shape.replace('y="6380603"', 'y="6172199"')],
  ['outside band anchor', 1, shape => shape.replace('y="6380603"', 'y="6172199"')],
  ['rotated', 0, shape => shape.replace('<a:xfrm>', '<a:xfrm rot="1">')],
  ['reflected anchor', 1, shape => shape.replace('<a:xfrm>', '<a:xfrm flipH="1">')],
  ['hidden anchor', 1, shape => shape.replace('<p:cNvPr ', '<p:cNvPr hidden="1" ')],
  ['negative inset', 0, shape => shape.replace('lIns="0"', 'lIns="-1"')],
  ['wrapped', 0, shape => shape.replace('wrap="none"', 'wrap="square"')],
  ['invalid shape rotation', 0, shape => shape.replace('<a:xfrm>', '<a:xfrm rot="">')],
  ['invalid text rotation', 0, shape => shape.replace('<a:bodyPr ', '<a:bodyPr rot="invalid" ')],
  ['rotated literal text', 0, shape => shape.replace('<a:bodyPr ', '<a:bodyPr rot="5400000" ')],
  ['rotated anchor text', 1, shape => shape.replace('<a:bodyPr/>', '<a:bodyPr rot="5400000"/>')],
  ['ambiguous paragraph defaults', 0, shape => shape.replace('<a:pPr/>', '<a:pPr/><a:pPr/>')],
  ['ambiguous list defaults', 0, shape => shape.replace('</a:lstStyle>', '</a:lstStyle><a:lstStyle/>')],
  ['vertical', 0, shape => shape.replace('<a:bodyPr ', '<a:bodyPr vert="vert" ')],
  ['bulleted', 0, shape => shape.replace('<a:pPr/>', '<a:pPr><a:buChar char="•"/></a:pPr>')],
  ['second paragraph', 0, shape => shape.replace('</p:txBody>', '<a:p><a:r><a:t>Current extra</a:t></a:r></a:p></p:txBody>')],
  ['rich second run', 0, shape => shape.replace('</a:p>', '<a:r><a:t>Current extra</a:t></a:r></a:p>')],
  ['break', 0, shape => shape.replace('</a:r>', '</a:r><a:br/>')],
  ['tab', 0, shape => shape.replace('</a:r>', '</a:r><a:tab/>')],
  ['hyperlink', 0, shape => shape.replace('<a:r>', '<a:r><a:rPr><a:hlinkClick r:id="unsupported"/></a:rPr>')],
  ['effect', 0, shape => shape.replace('</p:spPr>', '<a:effectLst/></p:spPr>')],
];
for (const [label, part, change, warning = true] of rejected) {
  const result = await mutate(entries => editShape(entries, part, change));
  noLiteral(result);
  assert.ok(bodyWords(result.document.slides[7]).includes('Keynote qualification'), `${label}: current literal remains content`);
  if (warning) assert.ok(result.issues.some(issue => issue.code === 'unclassified-native-footer' && issue.path.startsWith('slides.7.shapes.')), label);
  controls++;
}
for (const duplicate of [0, 1]) {
  const result = await mutate(entries => {entries[path] = strToU8(xml(entries).replace('</p:spTree>', find(xml(entries), duplicate) + '</p:spTree>'));});
  noLiteral(result); assert.ok(bodyWords(result.document.slides[7]).includes('Keynote qualification')); controls++;
}
// A second eligible literal with another unique part cannot be selected by order.
{
  const result = await mutate(entries => {entries[path] = strToU8(xml(entries).replace('</p:spTree>', find(xml(entries), 0).replace(name(0), name(2)) + '</p:spTree>'));});
  noLiteral(result); controls++;
}
for (const [tag, data, field] of [
  ['OPF_HEADING_V1', {v: 1, field: 'tag', group: 'slides.7.tag', count: 1, line: 0}, 'tag'],
  ['OPF_TEXT_V1', {v: 1, group: 'slides.7.blocks.0.text', count: 1, line: 0, boundary: 'end', separator: ''}],
  ['OPF_CODE_V1', {v: 1, group: 'slides.7.blocks.0.code'}],
]) {
  const result = await mutate(entries => attachTextTags(entries, new Map([[name(0), data]]), tag, 'rr86Owner', tag));
  noLiteral(result);
  if (field) assert.equal(result.document.slides[7][field], 'Keynote qualification', 'Valid heading ownership remains authoritative');
  else assert.ok(bodyWords(result.document.slides[7]).includes('Keynote qualification'));
  controls++;
}
// Direct seam: only an accepted number can witness; refused/claimed anchors are absent.
const root = parser.parse(xml(base))['p:sld'];
const context = {root, shapes: nativeTextShapes(root['p:cSld']['p:spTree']), paragraphs: nativeShapeParagraphs(xml(base)), slideWidth: 12192000, slideHeight: 6858000,
  inherited: () => ({master: {root: {'p:txStyles': {'p:otherStyle': {'a:lvl1pPr': {'a:buNone': ''}}}}}})};
const anchor = context.shapes.findIndex(shape => shape['p:nvSpPr']['p:cNvPr'].name === name(1));
const literal = context.shapes.findIndex(shape => shape['p:nvSpPr']['p:cNvPr'].name === name(0));
const accepted = [{index: anchor, ph: 'sldNum', zone: 'right', field: 'text', value: '{{slide.number}}'}];
assert.deepEqual(classifyNativeFooters(context, new Set(), [], new Set(), () => {}), [], 'Refused higher-priority number is not a witness');
assert.deepEqual(classifyNativeFooters(context, new Set([literal]), accepted, new Set(), () => {}), [], 'Existing claims cannot be consumed again');
assert.deepEqual(classifyNativeFooters(context, new Set(), accepted, new Set(['left']), () => {}), [], 'Higher-priority zone wins');
assert.deepEqual(classifyNativeFooters(context, new Set(), accepted, new Set(), () => {}).map(item => item.index), [literal], 'Accepted anchor witnesses but is not consumed twice');
controls += 4;
const frameControls = [
  [{y: 6172200}, true], [{y: 6172199}, false],
  [{y: 6515100, cy: 342900}, true], [{y: 6515099, cy: 342901}, false],
  [{y: 6685184}, true], [{y: 6685185}, false],
  [{cx: 4064000}, true], [{cx: 4064001}, false],
  [{x: 0}, true], [{x: -1}, false], [{x: 10772873}, true], [{x: 10772874}, false],
];
for (const [change, valid] of frameControls) {
  const current = structuredClone({...context, inherited: undefined});
  current.inherited = context.inherited;
  for (const index of [literal, anchor]) {
    const transform = current.shapes[index]['p:spPr']['a:xfrm'];
    for (const key of ['y', 'cy']) if (change[key] !== undefined) transform[key === 'y' ? 'a:off' : 'a:ext'][key] = String(change[key]);
  }
  const transform = current.shapes[literal]['p:spPr']['a:xfrm'];
  for (const key of ['x', 'cx']) if (change[key] !== undefined) transform[key === 'x' ? 'a:off' : 'a:ext'][key] = String(change[key]);
  assert.equal(classifyNativeFooters(current, new Set(), accepted, new Set(), () => {}).length, valid ? 1 : 0, JSON.stringify(change)); controls++;
}
// Grouped text and missing own frames are current content, never guessed furniture.
for (const transform of [
  shape => '<p:grpSp><p:nvGrpSpPr><p:cNvPr id="999" name="Current group"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>' + shape + '</p:grpSp>',
  shape => shape.replace(/<a:xfrm>[\s\S]*?<\/a:xfrm>/, ''),
  shape => shape.replace('x="859987"', 'x=""'),
  shape => shape.replace('<a:r>', '<a:r><a14:m xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main"/>'),
]) {
  const result = await mutate(entries => editShape(entries, 0, transform));
  noLiteral(result); assert.ok(bodyWords(result.document.slides[7]).includes('Keynote qualification')); controls++;
}
for (const [x, zone] of [[4063998, 'left'], [4063999, 'center'], [8127999, 'center'], [8128000, 'right']]) {
  const current = structuredClone({...context, inherited: undefined}); current.inherited = context.inherited;
  current.shapes[literal]['p:spPr']['a:xfrm']['a:off'].x = String(x);
  current.shapes[literal]['p:spPr']['a:xfrm']['a:ext'].cx = '2';
  assert.equal(classifyNativeFooters(current, new Set(), accepted, new Set(), () => {})[0]?.zone, zone, 'Exact physical zone boundary'); controls++;
}
for (const dimensions of [{slideWidth: 0}, {slideHeight: NaN}, {slideWidth: 1.5}, {slideHeight: undefined}]) {
  assert.deepEqual(classifyNativeFooters({...context, ...dimensions}, new Set(), accepted, new Set(), () => {}), []); controls++;
}
assert.deepEqual(classifyNativeFooters(context, new Set([anchor]), accepted, new Set(), () => {}), [], 'A claimed/rejected anchor cannot witness'); controls++;
// A current empty cache remains a genuine live number; delete both objects and no inherited footer returns.
{
  const result = await mutate(entries => {editShape(entries, 0, () => ''); editShape(entries, 1, () => '');});
  noLiteral(result); assert.equal(footer(result.document), false);
  for (const provenance of [undefined, 'references-only', false]) {
    const imported = await read(new Uint8Array(await toPptx(result.document, {...options, provenance})));
    noLiteral(imported); assert.ok(!bodyWords(imported.document.slides[7]).includes('Keynote qualification'));
  }
  controls++;
}
// Ambiguous inherited membership cannot fall through to a later unbulleted default.
{
  const current = {...context, inherited: () => ({master: {root: {'p:txStyles': {'p:otherStyle': {'a:lvl1pPr': [{'a:buNone': ''}, {'a:buChar': {char: '•'}}]}}}}}), defaultTextStyle: {'a:lvl1pPr': {'a:buNone': ''}}};
  assert.deepEqual(classifyNativeFooters(current, new Set(), accepted, new Set(), () => {}), []); controls++;
  const explicit = structuredClone({...current, inherited: undefined}); explicit.inherited = current.inherited;
  explicit.shapes[literal]['p:txBody']['a:p']['a:pPr'] = {'a:buNone': ''};
  assert.equal(classifyNativeFooters(explicit, new Set(), accepted, new Set(), () => {}).length, 1, 'Explicit current buNone wins over unused inherited ambiguity'); controls++;
}
for (const raw of ['{{slide.number}}', '{{slide.section}}', '{{deck.slideCount}}', String.raw`\{{slide.number}}`, String.raw`\\{{deck.slideCount}}`, '{{deck.name}}', '{{customer}}']) {
  const result = await mutate(entries => editShape(entries, 0, shape => words(shape, raw)));
  const part = composed(result.document).find(item => item.zone === 'left');
  assert.equal(part.text, raw, 'Displayed token/backslash words stay literal during composition');
  assert.deepEqual(part.fields ?? [], [], 'No live field is invented');
  for (const provenance of [undefined, 'references-only', false]) {
    const entries = unzipSync(new Uint8Array(await toPptx(result.document, {...options, provenance})));
    const output = strFromU8(entries[path]);
    const texts = [...output.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(match => match[1]);
    assert.ok(texts.includes(textXml(raw)), `Current literal preserved on re-export (${provenance})`);
    assert.equal([...output.matchAll(/<a:fld\b/g)].length, 1, 'Only the existing slide number stays live');
  }
  controls++;
}
console.log(`Native footer classification: ${controls} controls; exact retained A/B payload delta, current words/deletions, ownership, exact geometry and literal-token exports pass. Native acceptance remains separate.`);
