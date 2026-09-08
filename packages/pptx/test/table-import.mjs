import assert from 'node:assert/strict';
import { unzipSync, zipSync } from 'fflate';
import { validatePresentation } from '@openpresentation/opf';
import { fromPptx, toPptx } from '../dist/index.js';

const plainCell = cell => Array.isArray(cell) ? cell.map(run => typeof run === 'string' ? run : run.text).join('') : cell;
const plainTable = table => ({...(table.columns ? {columns:table.columns.map(plainCell)} : {}), rows:table.rows.map(row => row.map(plainCell))});

const fixtures = [
  { rows: [['first', 'data'], ['', ''], ['last', 'row'], ['', '']] },
  { columns: ['Name', 'Value'], rows: [['first', 'data'], ['', ''], ['last', 'row']] },
  { columns: ['', ''], rows: [['data', 'after empty headers']] },
  { rows: [['', ''], ['', '']] },
  { columns: ['Only', 'headers'], rows: [] },
  { rows: [['One cell']] },
];
const deck = { slides: fixtures.map(table => ({ table })) };
const bytes = await toPptx(deck);
const imported = await fromPptx(bytes);
const tables = imported.slides.map(slide => slide.blocks.find(block => block.table).table);
assert.deepEqual(tables.map(plainTable), fixtures, 'Headers, headerless first rows and blank rows must survive native round-trip');
assert.equal(validatePresentation(imported).valid, true);
const again = await fromPptx(await toPptx(imported));
assert.deepEqual(again.slides.map(slide => plainTable(slide.blocks.find(block => block.table).table)), fixtures);

const grouped = await fromPptx(await toPptx({ slides: [{
  composition: { mode: 'column' }, blocks: fixtures.slice(0, 3).map(table => ({ table })),
}] }));
assert.deepEqual(grouped.slides[0].blocks.filter(block => block.table).map(block => plainTable(block.table)), fixtures.slice(0, 3), 'Each table on the same slide keeps its own header setting');

// Change actual native XML, not hidden source metadata: the import must reflect
// edits made by another presentation application and recognize XML booleans.
for (const [flag, hasHeaders] of [['1', true], ['true', true], ['0', false], ['false', false], [undefined, false]]) {
  const entries = unzipSync(await toPptx({ slides: [{ table: fixtures[1] }] }));
  let xml = new TextDecoder().decode(entries['ppt/slides/slide1.xml']);
  xml = xml.replace(/<a:tblPr[^>]*\/>/, flag === undefined ? '<a:tblPr/>' : `<a:tblPr firstRow="${flag}"/>`);
  xml = xml.replace('<a:t>first</a:t>', '<a:t>Edited in PowerPoint</a:t>');
  entries['ppt/slides/slide1.xml'] = new TextEncoder().encode(xml);
  const result = await fromPptx(zipSync(entries));
  const table = result.slides[0].blocks.find(block => block.table).table;
  const data = [['Edited in PowerPoint', 'data'], ['', ''], ['last', 'row']];
  assert.deepEqual(plainTable(table), hasHeaders ? { columns: ['Name', 'Value'], rows: data } : { rows: [['Name', 'Value'], ...data] });
}
console.log('Table import passed: headers, headerless data, blank rows/headers, repeated round-trips, native edits and XML boolean forms.');
