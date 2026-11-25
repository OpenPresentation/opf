import assert from 'node:assert/strict';
import {test} from 'node:test';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {gallery} from '@openpresentation/gallery';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {toPptx, fromPptx} from '../dist/index.js';

// FR-07 (CR 5): a table color scale exports as native cell fills and text colors (editable in PowerPoint), and the scale itself comes back on
// import while every cell it shaded still has its exported fill.

const deck = () => ({
  name: 'Scale',
  slides: [
    {title: 'Win rate', table: {columns: ['Region', 'Q1', 'Q2'], rows: [{id: 'r-1', cells: ['EMEA', 0.2, 0.3]}, ['APAC', 0.1, 0.4], ['AMER', 'n/a', {value: 0.25, style: {fill: '#FF00FF'}}]], colorScale: {columns: ['Q1', 'Q2'], min: 0, max: 0.4}}},
    {title: 'Change', table: {columns: ['Product', 'YoY'], rows: [['Core', 0.12], ['Add-ons', -0.08], ['Services', 0]], colorScale: {columns: ['YoY'], colors: ['accent2', 'surface', 'accent1'], center: 0}}},
    {title: 'Dataset', table: {dataset: 'sales', colorScale: {columns: ['Q1']}}},
  ],
  datasets: {sales: {columns: ['Region', 'Q1'], rows: [['EMEA', 1], ['APAC', 9]]}},
});
const exportDeck = async source => toPptx(source, {catalogs: [gallery], fonts: await loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'auto', presentation: source})});
const importDeck = async (bytes, diagnostics = []) => fromPptx(bytes, {catalogs: [gallery], onDiagnostic: d => diagnostics.push(d)});
const dataRecords = bytes => Object.entries(unzipSync(bytes)).filter(([name]) => /^ppt\/tags\/opfData\d+\.xml$/.test(name)).map(([, data]) => JSON.parse(Buffer.from(/val="([0-9A-Fa-f]+)"/.exec(strFromU8(data))[1], 'hex').toString('utf8')));
const editPart = (bytes, part, change) => {
  const parts = unzipSync(bytes), before = strFromU8(parts[part]), after = change(before);
  assert.notEqual(after, before, `${part} changed`);
  parts[part] = strToU8(after);
  return zipSync(parts);
};
const cellFills = xml => [...xml.matchAll(/<a:srgbClr val="([0-9A-F]{6})"[/]><[/]a:solidFill> *<[/]a:tcPr>/g)].map(match => match[1]);

test('each scaled cell is a native cell with the computed sRGB fill and a text color that reads on it', async () => {
  const bytes = await exportDeck(deck());
  const [first] = dataRecords(bytes).filter(entry => entry.kind === 'table');
  assert.ok(first.colorScale.evidence.length === 4, 'four cells are shaded: the text, the filled and the header cells are not');
  const fills = cellFills(strFromU8(unzipSync(bytes)['ppt/slides/slide1.xml']));
  // A computed color that is exactly a theme color (the scale's own end) is written as that theme color; every other one as sRGB.
  const literal = first.colorScale.evidence.filter(([, , fill]) => fills.includes(fill));
  assert.equal(literal.length, 3, JSON.stringify([fills, first.colorScale.evidence]));
  assert.ok(literal.every(entry => entry[3] === 'FFFFFF'), 'the text on the dark fills is white');
  assert.ok(fills.includes('FF00FF'), 'a cell with a fill of its own keeps it');
});

test('the scale returns on import and the shaded cells carry no fill of their own', async () => {
  const diagnostics = [];
  const back = await importDeck(await exportDeck(deck()), diagnostics);
  assert.deepEqual(back.slides[0].table.colorScale, {columns: ['Q1', 'Q2'], min: 0, max: 0.4});
  assert.deepEqual(back.slides[0].table.rows.map(row => (Array.isArray(row) ? row : row.cells)), [['EMEA', 0.2, 0.3], ['APAC', 0.1, 0.4], ['AMER', 'n/a', {value: 0.25, style: {fill: '#FF00FF'}}]]);
  assert.equal(back.slides[0].table.rows[0].id, 'r-1');
  assert.deepEqual(back.slides[1].table.colorScale, deck().slides[1].table.colorScale);
  assert.deepEqual(back.slides[2].table, {dataset: 'sales', colorScale: {columns: ['Q1']}});
  assert.deepEqual(diagnostics.filter(d => /color-scale|data-provenance/.test(d.code)), []);
});

// 0.36.0 validates the stored table and drops the record for a key it does not know; it ignores a top-level key of the record it does not know.
test('the stored table has no colorScale and the scale is a top-level key of the record (the 0.36.0 importer still restores the table)', async () => {
  const records = dataRecords(await exportDeck(deck())).filter(entry => entry.kind === 'table');
  assert.equal(records[0].authored.colorScale, undefined);
  assert.deepEqual(records[0].authored.rows, [['EMEA', 0.2, 0.3], ['APAC', 0.1, 0.4], ['AMER', 'n/a', {value: 0.25, style: {fill: '#FF00FF'}}]]);
  assert.deepEqual(records[0].colorScale.scale, {columns: ['Q1', 'Q2'], min: 0, max: 0.4});
  assert.deepEqual(records[0].colorScale.evidence.map(entry => entry.length), [4, 4, 4, 4]);
  assert.equal(records[2].table.colorScale, undefined, 'a dataset table is stored without the scale as well');
  assert.deepEqual(records[2].colorScale.scale, {columns: ['Q1']});
  const plain = dataRecords(await exportDeck({name: 'P', slides: [{title: 'T', table: {columns: ['A', 'B'], rows: [['x', 1]]}}]})).filter(entry => entry.kind === 'table');
  assert.equal(plain[0].colorScale, undefined, 'a table without a scale records what it always did');
});

test('a cell refilled in PowerPoint makes the scale come back as plain fills, with a diagnostic', async () => {
  const bytes = await exportDeck(deck());
  const [record] = dataRecords(bytes).filter(entry => entry.kind === 'table');
  const [, , fill] = record.colorScale.evidence[0];
  const edited = editPart(bytes, 'ppt/slides/slide1.xml', xml => xml.replace(`<a:srgbClr val="${fill}"/>`, '<a:srgbClr val="123456"/>'));
  const diagnostics = [];
  const back = await importDeck(edited, diagnostics);
  assert.equal(back.slides[0].table.colorScale, undefined);
  assert.ok(diagnostics.some(d => d.code === 'table-color-scale-not-restored'), JSON.stringify(diagnostics.map(d => d.code)));
  const flat = JSON.stringify(back.slides[0].table.rows);
  assert.ok(flat.includes('#123456') || flat.includes('123456'), 'the edited fill is the native truth');
});

test('a deck without a color scale exports the same bytes as before the scale existed', async () => {
  const plain = {name: 'P', slides: [{title: 'T', table: {columns: ['A', 'B'], rows: [['x', 1], ['y', 2]]}}]};
  const a = unzipSync(await exportDeck(plain)), b = unzipSync(await exportDeck(JSON.parse(JSON.stringify(plain))));
  assert.deepEqual(Object.keys(a), Object.keys(b));
});
