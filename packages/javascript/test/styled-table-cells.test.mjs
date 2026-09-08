import assert from 'node:assert/strict';
import test from 'node:test';
import {validatePresentation} from '../dist/index.js';
import {layoutTable, tableGrid, tableRowBoundaries, composeSlide} from '../dist/composition.js';
import {paginateSlide, OPFPaginationError} from '../dist/pagination.js';

const measurement = {measure: (text, size) => [...text].length * size * .5};
const box = {x: 10, y: 20, width: 600, height: 600};
const style = {
  fill: '#11223380', color: '#fff', align: 'right', verticalAlign: 'bottom',
  padding: {top: 12, right: 20, bottom: 6, left: 30},
  borders: {top: {color: '#abc', width: 2, dash: 'dash'}, bottom: {color: '#00000000', width: 0}},
};
const valid = table => {
  const result = validatePresentation({slides: [{table}]});
  assert.equal(result.valid, true, JSON.stringify(result.errors));
};

test('styled values coexist with scalar, rich, empty and merged header cells', () => {
  const table = {
    columns: [{value: 'Heading', colSpan: 2, style}, null, 'Count'],
    rows: [[{value: ['A ', {text: 'bold', bold: true}], style}, 2, false],
      [{value: null}, [], null]],
  };
  const before = structuredClone(table);
  valid(table);
  const grid = tableGrid(table, 'slides.2.table');
  assert.deepEqual(grid.issues, []);
  assert.equal(grid.rows[0].length, 2);
  assert.equal(grid.owners[0][1], grid.rows[0][0]);
  assert.equal(grid.rows[1][0].valuePath, 'slides.2.table.rows.0.0.value');
  assert.equal(grid.rows[1][1].valuePath, 'slides.2.table.rows.0.1');
  assert.deepEqual(grid.rows[1][0].value, table.rows[0][0].value);
  assert.deepEqual(table, before);
});

test('schema rejects ambiguous values and unsupported style properties', () => {
  for (const cell of [
    {style}, {value: {text: 'not a scalar or rich array'}}, {value: 'x', colSpan: 0},
    {value: 'x', rowSpan: 1.5}, {value: 'x', style: {fill: 'red'}},
    {value: 'x', style: {padding: {left: -1}}},
    {value: 'x', style: {borders: {top: {color: '#fff', width: 2, dash: 'unknown'}}}},
    {value: 'x', style: {unknown: true}},
  ]) assert.equal(validatePresentation({slides: [{table: {rows: [[cell]]}}]}).valid, false, JSON.stringify(cell));
});

test('spans reject hidden content, missing covered positions, overlap and header crossing', () => {
  for (const table of [
    {rows: [[{value: 'A', colSpan: 2}, 'hidden']]},
    {rows: [[{value: 'A', rowSpan: 2}, 'B'], []]},
    {rows: [[{value: 'A', rowSpan: 3}], [null]]},
    {rows: [[{value: 'A', colSpan: 2}]]},
    {columns: [{value: 'A', rowSpan: 2}], rows: [[null]]},
    {rows: [['A', {value: 'B', rowSpan: 2}], [{value: 'C', colSpan: 2}, null]]},
  ]) {
    assert.ok(tableGrid(table).issues.length, JSON.stringify(table));
    assert.equal(validatePresentation({slides: [{table}]}).valid, false);
    assert.throws(() => layoutTable(table, box), RangeError);
  }
  const table = {rows: [[{value: 'A', colSpan: 2}, 'hidden']]};
  const result = validatePresentation({slides: [{'left': {blocks: [{table}]}}]});
  assert.ok(result.errors.some(error => error.path === '/slides/0/left/blocks/0/table/rows/0/1'), JSON.stringify(result.errors));
});

test('span rectangles preserve dense column indexes and editable value paths', () => {
  const table = {rows: [
    [{value: ['Merged'], colSpan: 2, rowSpan: 2, style}, null, 'C'],
    [null, null, 'D'], ['E', 'F', 'G'],
  ]};
  valid(table);
  const geometry = layoutTable(table, box, {path: 'slides.0.table', textMeasurement: measurement});
  assert.equal(geometry.overflow, false);
  assert.deepEqual(geometry.rows.map(row => row.cells.length), [2, 1, 3]);
  const cell = geometry.rows[0].cells[0];
  assert.deepEqual(cell.box, {x: 10, y: 20, width: 400, height: 108});
  assert.equal(cell.sourcePath, 'slides.0.table.rows.0.0');
  assert.equal(cell.path, cell.sourcePath + '.value');
  assert.equal(cell.textBox.x, 40);
  assert.equal(cell.textBox.width, 350);
  assert.equal(cell.textBox.y + cell.fit.height, cell.box.y + cell.box.height - 6);
  assert.equal(geometry.rows[1].cells[0].box.x, 410);
  const scaled = layoutTable(table, {x: 5, y: 10, width: 300, height: 300}, {scale: .5, textMeasurement: measurement});
  for (const [i, row] of geometry.rows.entries()) for (const [j, original] of row.cells.entries()) {
    for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(scaled.rows[i].cells[j].box[key] * 2 - original.box[key]) < .001);
  }
});

test('vertical alignment and padding use the full merged rectangle', () => {
  for (const verticalAlign of ['top', 'middle', 'bottom']) {
    const table = {rows: [[{value: 'A', rowSpan: 2, style: {verticalAlign}}, 'B'], [null, 'C']]};
    const cell = layoutTable(table, box, {textMeasurement: measurement}).rows[0].cells[0];
    const height = cell.fit.lines.length * cell.fit.lineHeight;
    const spare = cell.box.height - 12 - height;
    assert.equal(cell.textBox.y, cell.box.y + 8 + spare * ({top: 0, middle: .5, bottom: 1}[verticalAlign]));
  }
  assert.equal(layoutTable({rows: [[{value: 'A', style: {padding: {left: 200, right: 200}}}]]}, {...box, width: 100}).overflow, true);
});

test('staggered vertical merges reserve enough space for every anchor', () => {
  const table = {rows: [
    [{value: 'a\n'.repeat(10), rowSpan: 2}, 'b'],
    [null, {value: 'c\n'.repeat(12), rowSpan: 2}], ['d', null],
  ]};
  const geometry = layoutTable(table, {...box, height: 900}, {textMeasurement: measurement});
  assert.equal(geometry.overflow, false);
  for (const row of geometry.rows) for (const cell of row.cells) {
    assert.ok(cell.fit.lines.length * cell.fit.lineHeight <= cell.textBox.height + .001);
    assert.ok(cell.box.y + cell.box.height <= box.y + geometry.height + .001);
  }
  assert.equal(layoutTable(table, {...box, height: 80}, {textMeasurement: measurement}).overflow, true);
});

test('pagination preserves vertical merge groups, rich styles, headers and source ranges', () => {
  const rows = Array.from({length: 36}, (_, i) => i % 3 === 0
    ? [{value: [{text: `Group ${i / 3}\nDetail\nMore`, bold: true}], rowSpan: 3, style}, `Row ${i}`]
    : [null, `Row ${i}`]);
  const table = {columns: [{value: 'Groups', style}, 'Details'], rows};
  const source = {blocks: [{table}]}, before = structuredClone(source);
  const result = paginateSlide(source, {textMeasurement: measurement, slideIndex: 2});
  assert.ok(result.slides.length > 1);
  assert.deepEqual(result.slides.flatMap(slide => slide.blocks[0].table.rows), rows);
  for (const [i, slide] of result.slides.entries()) {
    valid(slide.blocks[0].table);
    assert.deepEqual(slide.blocks[0].table.columns, table.columns);
    assert.equal(composeSlide(slide, {textMeasurement: measurement}).diagnostics.length, 0);
    const mapping = result.pages[i].mappings.find(entry => entry.sourcePath === 'slides.2.blocks.0.table');
    assert.equal(mapping.range.start % 3, 0);
    assert.equal(mapping.range.end % 3, 0);
  }
  assert.deepEqual(source, before);
});

test('overlapping merge groups are atomic, and oversized groups fail without partial output', () => {
  const table = {rows: [[{value: 'A', rowSpan: 2}, 'B'], [null, {value: 'C', rowSpan: 2}], ['D', null], ['E', 'F']]};
  assert.deepEqual(tableRowBoundaries(table), [0, 3, 4]);
  const huge = {rows: [[{value: 'word\n'.repeat(100), rowSpan: 2}], [null]]};
  assert.throws(() => paginateSlide({table: huge}, {textMeasurement: measurement}), OPFPaginationError);
});
