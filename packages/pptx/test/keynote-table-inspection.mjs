import assert from 'node:assert/strict';
import {sourceDeck} from '../scripts/keynote-qualification/fixtures.mjs';
import {currentSlideText, importedFindings, nativeFindings} from '../scripts/keynote-qualification/pack.mjs';

const tableFailures = failures => failures.filter(value => /^table-(cell|style):/.test(value));
const table = (node, index) => node.slides[index].table ?? node.slides[index].blocks?.find(block => block.type === 'table')?.table;
const imported = sourceDeck('data:image/png;base64,AA==');
table(imported, 11).rows[0][0] = {value: [{text: 'KN_EDIT_', bold: true}, 'CELL\n'], style: {fill: '#112233'}};
table(imported, 12).rows[0][1] = {value: [{text: 'Bold edited cell', bold: true}, ' and plain'], style: {fill: '#112233'}};
assert.deepEqual(tableFailures(importedFindings(imported, 'content-edits')), [], 'Current styled rich cell values count at the actual edited coordinates');
const blocks = structuredClone(imported);
for (const index of [11, 12]) {blocks.slides[index].blocks = [{type: 'table', table: blocks.slides[index].table}]; delete blocks.slides[index].table;}
assert.deepEqual(tableFailures(importedFindings(blocks, 'content-edits', true)), [], 'Current imported table blocks are read without searching cached document data');
for (const value of ['KN_EDIT_CELL', ['KN_EDIT_', {text: 'CELL', italic: true}], {value: 'KN_EDIT_CELL'}, {value: ['KN_EDIT_', {text: 'CELL'}]}]) {
  const current = structuredClone(blocks); table(current, 11).rows[0][0] = value;
  assert.ok(!tableFailures(importedFindings(current, 'content-edits')).some(failure => failure.startsWith('table-cell:')), 'Scalar, rich and styled cell payloads work');
}
assert.equal(currentSlideText({table: {columns: [{value: 'Heading'}], rows: [[{value: 0}, {value: 12}, {value: true}, false, null, {value: [{text: 'Rich'}, ' words']}]]}}), 'Heading 0 12 true false Rich words');
assert.equal(currentSlideText({table: {rows: [[{style: {text: 'HIDDEN'}, source: {value: 'HIDDEN'}, extensions: {value: 'HIDDEN'}}]]}, extensions: {text: 'HIDDEN'}, notes: 'HIDDEN'}), '', 'Non-cell fields never satisfy current word checks');
const negative = [
  ['old', deck => {table(deck, 11).rows[0][0] = {value: 'KN_ORIGINAL_CELL'};}],
  ['edited different words', deck => {table(deck, 11).rows[0][0] = {value: 'CURRENT_OTHER'};}],
  ['cleared', deck => {table(deck, 11).rows[0][0] = {value: ''};}],
  ['deleted cell', deck => {delete table(deck, 11).rows[0][0];}],
  ['missing row', deck => {table(deck, 11).rows.shift();}],
  ['missing table', deck => {deck.slides[11].blocks = [];}],
  ['wrong cell', deck => {table(deck, 11).rows[0][0] = 'Other'; table(deck, 11).rows[1][0] = {value: 'KN_EDIT_CELL'};}],
  ['header only', deck => {table(deck, 11).rows[0][0] = ''; table(deck, 11).columns[0] = {value: 'KN_EDIT_CELL'};}],
  ['title only', deck => {table(deck, 11).rows[0][0] = ''; deck.slides[11].title += ' KN_EDIT_CELL';}],
  ['wrong slide', deck => {table(deck, 11).rows[0][0] = ''; table(deck, 12).rows[0][0] = {value: 'KN_EDIT_CELL'};}],
  ['cached only', deck => {table(deck, 11).rows[0][0] = {value: '', style: {text: 'KN_EDIT_CELL'}, extensions: {value: 'KN_EDIT_CELL'}}; deck.extensions = {source: imported};}],
  ['ambiguous tables', deck => {deck.slides[11].blocks.push(structuredClone(deck.slides[11].blocks[0]));}]
];
for (const [label, change] of negative) {
  const current = structuredClone(blocks); change(current);
  assert.ok(tableFailures(importedFindings(current, 'content-edits')).some(failure => failure.startsWith('table-cell:') && failure.includes('expected current imported table body cell')), label);
}
const wrongRichCell = structuredClone(blocks);
table(wrongRichCell, 12).rows[0][1] = ' and plain'; table(wrongRichCell, 12).rows[1][1] = {value: [{text: 'Bold edited cell', bold: true}]};
assert.ok(tableFailures(importedFindings(wrongRichCell, 'content-edits')).some(failure => failure.startsWith('table-style:') && failure.includes('(0,1)')));

const native = {nativeChartCount: 2, nativeTableCount: 2, slides: imported.slides.map(slide => ({marker: slide.title.slice(0, 3), text: [slide.title], notes: [], charts: [], tables: []}))};
for (const [index, marker, column] of [[11, 'KN_EDIT_CELL', 0], [12, 'Bold edited cell', 1]]) {
  native.slides[index].text.push(marker);
  native.slides[index].tables = [{rows: [[['Header'], ['Header']], [['Other'], ['Other']]]}];
  native.slides[index].tables[0].rows[1][column] = [marker];
}
assert.deepEqual(tableFailures(nativeFindings(native, 'content-edits')), [], 'Native current XML targets match the imported body-cell coordinates');
for (const [index, column, id, marker] of [[11, 0, 'table-cell', 'KN_EDIT_CELL'], [12, 1, 'table-style', 'Bold edited cell']]) {
  for (const location of ['wrong cell', 'header', 'other slide', 'cleared', 'deleted table', 'ambiguous tables']) {
    const current = structuredClone(native), slide = current.slides[index];
    slide.tables[0].rows[1][column] = [''];
    if (location === 'wrong cell') slide.tables[0].rows.push([[marker], [marker]]);
    if (location === 'header') slide.tables[0].rows[0][column] = [marker];
    if (location === 'other slide') current.slides[0].tables = [{rows: [[['Header']], [[marker]]]}];
    if (location === 'deleted table') slide.tables = [];
    if (location === 'ambiguous tables') slide.tables.push(structuredClone(native.slides[index].tables[0]));
    assert.ok(tableFailures(nativeFindings(current, 'content-edits')).some(failure => failure.startsWith(id + ':') && failure.includes('expected current native table body cell')), location);
  }
}
assert.deepEqual(tableFailures(importedFindings(blocks, 'no-op', true)), [], 'No-op list/footer/field gates are unchanged');
console.log('Keynote table inspection passed: current scalar/rich styled values; exact K12/K13 body cells; edits/clear/delete/missing/wrong-cell/wrong-slide/cached/ambiguous controls. No runtime or native fidelity claim.');
