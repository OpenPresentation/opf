import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {unzipSync, zipSync} from 'fflate';
import {toPptx, fromPptx, resolvePresentation} from './helpers/default-catalog.mjs';
import {validate} from '@openpresentation/opf';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';

const enc = new TextEncoder(), dec = new TextDecoder();
const source = {name: 'Wrapped generated date boundary', design: {fontScheme: 'roboto',
  dimensions: {widthInches: 7.5, heightInches: 13.3333333333},
  footer: {center: {date: true, dateFormat: 'MMMM d, yyyy'}, right: {slideNumber: true, slideNumberFormat: '{current} / {total}'}}},
slides: [{title: 'Title', design: {footer: false}},
  {title: 'Content', text: 'Keep body content.', composition: {minFontSize: 32, overflow: 'error'}},
  {title: 'Third', text: 'Still current.', composition: {minFontSize: 32, overflow: 'error'}}]};
const fonts = {fonts: await loadFonts()};
const options = {...fonts, date: '2026-09-22', seed: 1, timestamp: '2026-01-01T00:00:00Z', zipDate: '2026-01-01T00:00:00Z'};
const emit = async (value = source, extra = {}) => {
  const before = structuredClone(value), issues = [];
  const bytes = await toPptx(value, {...options, ...extra, onDiagnostic: issue => issues.push(issue)});
  assert.deepEqual(value, before);
  return {bytes, entries: unzipSync(bytes), issues};
};
const read = async bytes => {
  const issues = [], document = await fromPptx(bytes, {onDiagnostic: issue => issues.push(issue)});
  assert.equal(validate(document, {only: ['format']}).valid, true);
  return {document, issues};
};
const footer = (document, index = 1) => document.slides[index].design?.footer ?? document.design?.footer;
const decode = value => JSON.parse(Buffer.from(value, 'hex').toString());
const encode = value => Buffer.from(JSON.stringify(value)).toString('hex').toUpperCase();
const changeTags = (entries, mutate) => Object.fromEntries(Object.entries(entries).map(([path, data]) => [path,
  path.startsWith('ppt/tags/') ? enc.encode(dec.decode(data).replace(/(<p:tag name="OPF_FURNITURE_V1" val=")([A-F0-9]+)("\/?>)/g,
    (all, start, value, end) => {const record = decode(value); mutate(record, path); return start + encode(record) + end;})) : data]));
const editText = (entries, mutate) => Object.fromEntries(Object.entries(entries).map(([path, data]) => [path,
  /^ppt\/slides\/slide[23]\.xml$/.test(path) ? enc.encode(mutate(dec.decode(data))) : data]));
const exported = await emit();
const markerCount = entries => Object.entries(entries).filter(([path]) => path.startsWith('ppt/tags/'))
  .flatMap(([, data]) => [...dec.decode(data).matchAll(/name="OPF_FURNITURE_V1" val="([A-F0-9]+)"/g)])
  .map(match => decode(match[1])).flatMap(record => record.parts ?? []).filter(part => part.staticDate !== undefined).length;

await test('measured wrapped baseline reports both static paths without native date fields or source mutation', () => {
  const resolved = resolvePresentation(source, options);
  for (const index of [1, 2]) {
    const date = resolved.slides[index].geometry.furniture.parts.find(part => part.field === 'date');
    assert.deepEqual(date.fit.lines, ['September ', '22, 2026']);
    assert.deepEqual(date.fields, [{type: 'date', start: 0, end: 18, format: 'MMMM d, yyyy'}]);
    const xml = dec.decode(exported.entries[`ppt/slides/slide${index + 1}.xml`]);
    assert.doesNotMatch(xml, /type="datetime/);
    assert.equal([...xml.matchAll(/type="slidenum"/g)].length, 1);
  }
  assert.deepEqual(exported.issues.map(({code, path}) => ({code, path})), [1, 2].map(() => ({code: 'furniture-field-fixed', path: 'design.footer.center.date'})));
  assert.ok(exported.issues.every(issue => /static text.*PowerPoint will not update/.test(issue.message)));
  assert.equal(markerCount(exported.entries), 2);
});
await test('unchanged full-mode wrapped dates recover generated source/format and use a new host date on reexport', async () => {
  const {document, issues} = await read(exported.bytes);
  assert.deepEqual(document.design.footer, source.design.footer);
  assert.deepEqual(document.slides[0].design.footer, false);
  assert.equal(issues.filter(issue => issue.code === 'invalid-furniture-provenance').length, 0);
  const next = await emit(document, {date: '2027-04-23'});
  const xml = dec.decode(next.entries['ppt/slides/slide2.xml']);
  assert.ok(xml.includes('April') && xml.includes('2027'));
  assert.ok(!xml.includes('September') && !xml.includes('2026'));
  assert.deepEqual(footer((await read(next.bytes)).document).center, source.design.footer.center);
});
await test('same inputs have byte-identical output', async () => assert.deepEqual((await emit()).bytes, exported.bytes));
await test('references-only/off export no fallback marker and do not regain generated date intent', async () => {
  for (const provenance of ['references-only', false]) {
    const current = await emit(source, {provenance});
    assert.equal(markerCount(current.entries), 0);
    assert.deepEqual(footer((await read(current.bytes)).document).center, {date: 'September 22, 2026'});
  }
});
await test('old or unmarked flattened dates stay literal', async () => {
  const old = changeTags(exported.entries, record => record.parts?.forEach(part => delete part.staticDate));
  assert.deepEqual(footer((await read(zipSync(old))).document).center, {date: 'September 22, 2026'});
});
for (const [label, mutate, expected] of [
  ['edited parseable date', xml => xml.replace('September ', 'October '), 'October 22, 2026'],
  ['typed words', xml => xml.replace('September ', 'For review '), 'For review 22, 2026'],
  ['cleared date', xml => xml.replace('September ', '').replace('22, 2026', ''), ''],
]) await test(`${label} stays current literal text through reexport`, async () => {
  const {document, issues} = await read(zipSync(editText(exported.entries, mutate)));
  assert.deepEqual(footer(document).center, {date: expected});
  assert.ok(issues.some(issue => issue.code === 'invalid-furniture-provenance'));
  const repeated = await read((await emit(document, {date: '2030-01-01'})).bytes);
  assert.deepEqual(footer(repeated.document).center, {date: expected});
});
for (const [label, mutate] of [
  ['version', marker => marker.v = 2], ['reason', marker => marker.reason = 'unknown'],
  ['format', marker => marker.format = 'M/d/yyyy'], ['fingerprint', marker => marker.fingerprints[0] = '0:0000000000000000'],
  ['extra words', marker => marker.text = 'September 22, 2026'], ['missing fingerprint', marker => marker.fingerprints.pop()],
]) await test(`damaged marker ${label} cannot restore generated intent`, async () => {
  const changed = changeTags(exported.entries, record => record.parts?.forEach(part => {if (part.staticDate) mutate(part.staticDate);}));
  const {document, issues} = await read(zipSync(changed));
  assert.deepEqual(footer(document).center, {date: 'September 22, 2026'});
  assert.ok(issues.some(issue => issue.code === 'invalid-furniture-provenance'));
});
for (const [label, mutate] of [
  ['missing boundary', record => {delete record.boundary;}], ['damaged separator', record => record.separator = ' '],
  ['duplicate line', record => record.line = 0],
]) await test(`${label} conservatively retains ordinary native text`, async () => {
  const changed = changeTags(exported.entries, record => {if (record.role === 'text' && record.part === 0) mutate(record);});
  const {document, issues} = await read(zipSync(changed));
  assert.ok(issues.some(issue => issue.code === 'invalid-furniture-provenance'));
  assert.ok(JSON.stringify(document).includes('September '));
  assert.ok(!JSON.stringify(document).includes('"date":true'));
});
await test('missing date shape cannot restore old text', async () => {
  const changed = editText(exported.entries, xml => xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, shape => shape.includes('<a:t>September </a:t>') ? '' : shape));
  const {document, issues} = await read(zipSync(changed));
  assert.ok(issues.some(issue => issue.code === 'invalid-furniture-provenance'));
  assert.ok(!JSON.stringify(document).includes('September'));
});
await test('actual current native date field takes precedence over stale static evidence', async () => {
  const changed = editText(exported.entries, xml => xml.replace(/<a:r>(<a:rPr\b[^>]*>(?:(?!<\/a:rPr>)[\s\S])*<\/a:rPr>)<a:t>September <\/a:t><\/a:r>/,
    '<a:fld id="{0F0F2700-0000-4000-8000-000000000099}" type="datetime3">$1<a:t>23 April 2027</a:t></a:fld>').replace('<a:t>22, 2026</a:t>', '<a:t></a:t>'));
  const {document} = await read(zipSync(changed));
  assert.deepEqual(footer(document).center, {date: true, dateFormat: 'd MMMM yyyy'});
});
// Optional exact original-probe comparison; no machine path enters shipped tests.
if (process.env.OPF_WRAPPED_BASELINE) await test('initial native package parts are byte-identical to the accepted baseline', async () => {
  const original = unzipSync(await readFile(process.env.OPF_WRAPPED_BASELINE));
  assert.deepEqual(Object.keys(exported.entries).sort(), Object.keys(original).sort());
  for (const path of Object.keys(original)) if (!/^ppt\/tags\/opfFurnitureSlide/.test(path)) assert.deepEqual(exported.entries[path], original[path], path);
});
if (process.env.OPF_WRAPPED_OUTPUT) {
  await mkdir(process.env.OPF_WRAPPED_OUTPUT, {recursive: true});
  await writeFile(`${process.env.OPF_WRAPPED_OUTPUT}/export.pptx`, exported.bytes);
  await writeFile(`${process.env.OPF_WRAPPED_OUTPUT}/imported.json`, JSON.stringify((await read(exported.bytes)).document, null, 2) + '\n');
  await writeFile(`${process.env.OPF_WRAPPED_OUTPUT}/diagnostics.json`, JSON.stringify(exported.issues, null, 2) + '\n');
}
