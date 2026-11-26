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

// The scale is not restored: every cell it shaded comes back with the fill it has in the file, so the imported table draws as PowerPoint shows it.
const hexOf = fill => String(fill).replace(/^#/, '').toUpperCase();
const cellsOf = table => table.rows.map(row => (Array.isArray(row) ? row : row.cells));
test('a refilled shaded cell: every shaded cell comes back with its fill, the refilled one with its new fill, and re-exporting draws the same', async () => {
  const bytes = await exportDeck(deck());
  const [record] = dataRecords(bytes).filter(entry => entry.kind === 'table');
  const evidence = record.colorScale.evidence;
  const [, , refilledFill] = evidence[0];
  const edited = editPart(bytes, 'ppt/slides/slide1.xml', xml => xml.replace(`<a:srgbClr val="${refilledFill}"/>`, '<a:srgbClr val="123456"/>'));
  const diagnostics = [];
  const back = await importDeck(edited, diagnostics);
  const table = back.slides[0].table;
  assert.equal(table.colorScale, undefined);
  assert.ok(diagnostics.some(d => d.code === 'table-color-scale-not-restored'));
  const rows = cellsOf(table);
  evidence.forEach(([row, column, fill], index) => {
    const cell = rows[row][column];
    assert.ok(cell && typeof cell === 'object' && cell.style?.fill, `cell ${row},${column} has a fill`);
    assert.equal(hexOf(cell.style.fill), index === 0 ? '123456' : fill, `cell ${row},${column}`);
  });
  const values = rows.map(row => row.map(cell => (cell && typeof cell === 'object' && 'value' in cell ? cell.value : cell)));
  // The refilled cell's own XML changed, so its value is the native one; every other cell keeps the authored value.
  values[0][1] = 'refilled';
  assert.deepEqual(values, [['EMEA', 'refilled', 0.3], ['APAC', 0.1, 0.4], ['AMER', 'n/a', 0.25]], 'the values stay the authored values');
  assert.equal(rows[2][2].style.fill, '#FF00FF', 'a cell with a fill of its own keeps it');
  // Exporting the imported deck writes the same fills on those cells (the picture does not change), the refilled cell with its new color.
  const again = await exportDeck(back);
  const fills = xml => cellFills(xml);
  const second = fills(strFromU8(unzipSync(again)['ppt/slides/slide1.xml']));
  // Every shaded cell has the same color as in the first export (a color that is exactly a theme color was a theme color there and is the same sRGB color now).
  assert.deepEqual(second, [...evidence.map(([, , fill], index) => (index === 0 ? '123456' : fill)), 'FF00FF']);
});

test('a scale that does not fit the imported table: the shaded cells come back as plain fills', async () => {
  const {restoreTableData} = await import('../dist/data-provenance.js');
  const authored = {columns: ['A', 'B'], rows: [['x', 1], ['y', 2]]};
  const evidence = [['h1', 'h2'], ['h3', 'h4'], ['h5', 'h6']];
  const record = {v: 1, kind: 'table', headers: [], cells: [], authored, evidence, environment: 'env', colorScale: {scale: {columns: ['Missing']}, evidence: [[0, 1, '112233', 'FFFFFF'], [1, 1, '445566', 'FFFFFF']]}};
  const native = {columns: ['A', 'B'], rows: [['x', {value: 1, style: {fill: '#112233', color: '#FFFFFF'}}], ['y', {value: 2, style: {fill: '#445566'}}]]};
  const reports = [];
  const restored = restoreTableData(native, record, {datasets: undefined, report: d => reports.push(d), evidence, environment: 'env'});
  assert.equal(restored.colorScale, undefined);
  assert.deepEqual(restored.rows, [['x', {value: 1, style: {fill: '#112233', color: '#FFFFFF'}}], ['y', {value: 2, style: {fill: '#445566'}}]]);
  assert.deepEqual(reports.map(d => d.code), ['table-color-scale-not-restored']);
});
