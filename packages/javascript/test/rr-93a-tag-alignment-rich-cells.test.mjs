import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide, layoutTable} from '../dist/composition.js';
import {validate} from '../dist/validator.js';

const field = (composed, name) => composed.items.find(item => item.field === name);
const metrics = {id: 'metrics', areas: [['title'], ['metrics']], rows: ['auto', 1], design: {contentAlignment: 'center'}, regions: {metrics: {accepts: ['metric', 'group'], flow: 'grid'}}};
const slide = {tag: 'Q3', title: 'Revenue', blocks: [{metric: {value: '42', label: 'Accounts'}}]};

test('the tag follows the title alignment, not content alignment', () => {
  // The metrics layout centres its content and sets no titleAlignment: title and tag stay left together.
  const composed = composeSlide(slide, {layout: metrics});
  assert.equal(field(composed, 'title').alignment, 'left');
  assert.equal(field(composed, 'tag').alignment, 'left');
  // A resolved titleAlignment moves both, from the slide, the deck option or the layout.
  for (const options of [{layout: metrics, titleAlignment: 'right'}, {layout: {...metrics, design: {...metrics.design, titleAlignment: 'right'}}}]) {
    assert.equal(field(composeSlide(slide, options), 'tag').alignment, 'right');
  }
  const own = composeSlide({...slide, design: {titleAlignment: 'left'}}, {layout: {...metrics, design: {...metrics.design, titleAlignment: 'center'}}});
  assert.equal(field(own, 'tag').alignment, 'left');
  assert.equal(field(own, 'title').alignment, 'left');
});

test('the tag keeps the slide\'s own contentAlignment and the subtitle is unchanged', () => {
  const withContent = composeSlide({...slide, subtitle: 'Sub', design: {contentAlignment: 'center'}}, {layout: metrics});
  assert.equal(field(withContent, 'tag').alignment, 'center');
  const body = composeSlide({...slide, subtitle: 'Sub', text: 'Body'}, {titleAlignment: 'left', contentAlignment: 'center'});
  assert.equal(field(body, 'tag').alignment, 'left');
  assert.equal(field(body, 'subtitle').alignment, 'center');
});

const box = {x: 0, y: 0, width: 800, height: 400};
const cellsOf = layout => layout.rows.map(row => row.cells.map(cell => cell.alignment));

test('a rich cell in a numeric column keeps the column alignment', () => {
  const table = {columns: ['Region', 'Revenue'], rows: [['North', 513], ['South', [{text: '720', bold: true}]], ['East', {value: [{text: '88'}]}]]};
  const layout = layoutTable(table, box);
  assert.deepEqual(cellsOf(layout), [['left', 'right'], ['left', 'right'], ['left', 'right'], ['left', 'right']]);
  // A column with no number stays textual, and a text cell keeps the column textual (only the number itself right-aligns).
  const text = layoutTable({columns: ['A', 'B'], rows: [['x', [{text: 'rich'}]]]}, box);
  assert.deepEqual(cellsOf(text), [['left', 'left'], ['left', 'left']]);
  const mixed = layoutTable({columns: ['A', 'B'], rows: [['x', 5], ['y', 'n/a'], ['z', [{text: '7'}]]]}, box);
  assert.deepEqual(cellsOf(mixed).map(row => row[1]), ['left', 'right', 'left', 'left']);
  // RTL mirrors the numeric default; an explicit style.align still wins.
  assert.equal(layoutTable(table, box, {direction: 'rtl'}).rows[2].cells[1].alignment, 'left');
  const aligned = layoutTable({columns: ['A', 'B'], rows: [['x', 5], ['y', {value: [{text: '7'}], style: {align: 'center'}}]]}, box);
  assert.deepEqual(cellsOf(aligned).map(row => row[1]), ['right', 'right', 'center']);
});

test('style.bold bolds a number cell and keeps its number format', () => {
  const table = {columns: [{name: 'Region'}, {name: 'Revenue', format: '$#,##0'}], rows: [['North', {value: 513, style: {bold: true}}], ['South', 720]]};
  const [, north, south] = layoutTable(table, box).rows.map(row => row.cells[1]);
  assert.equal(north.textStyle.fontWeight, 700);
  assert.equal(south.textStyle.fontWeight, 400);
  assert.equal(north.value, '$513');
  assert.equal(north.alignment, 'right');
  assert.equal(north.style.bold, true);
  const doc = {$schema: 'https://openpresentation.org/schema/opf/v1', slides: [{title: 'T', blocks: [{table}]}]};
  const bad = {...doc, slides: [{title: 'T', blocks: [{table: {rows: [[{value: 1, style: {bold: 'yes'}}]]}}]}]};
  assert.equal(validate(doc).valid, true, JSON.stringify(validate(doc).findings));
  assert.equal(validate(bad).valid, false);
});
