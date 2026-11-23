import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide, visualReadingOrder} from '../dist/composition.js';

// RR-29: the cells of a slide's grid (blocks that name a cell with `region`, OPF 0.35) are composed in visual reading order (rows top
// to bottom, then along the row) whatever order the blocks are written in, so the composed item order matches what a reader sees.
// Geometry does not depend on the source order: only the order of the items (and so the SVG draw order and the PPTX shape order) is
// the reading order. Each item keeps the path of its own block.
const compose = slide => composeSlide(slide, {width: 1280, height: 720});
const body = slide => compose(slide).items.filter(item => item.field !== 'title');
const order = slide => body(slide).map(item => item.value);
const paths = slide => body(slide).map(item => item.path.replace(/^slides\.0\./, ''));
const cells = (...entries) => ({title: 'T', blocks: entries.map(([region, text]) => ({region, text}))});

test('columns are composed start, center, end (not in source order)', () => {
  assert.deepEqual(order(cells(['center', 'C'], ['start', 'L'], ['end', 'R'])), ['L', 'C', 'R']);
  assert.deepEqual(paths(cells(['center', 'C'], ['start', 'L'], ['end', 'R'])), ['blocks.1.text', 'blocks.0.text', 'blocks.2.text']);
});

test('rows are composed top, middle, bottom', () => {
  assert.deepEqual(order(cells(['bottom', 'B'], ['top', 'T'], ['middle', 'M'])), ['T', 'M', 'B']);
});

test('a grid with spans reads row by row', () => {
  assert.deepEqual(order(cells(['middle+bottom:center+end', 'D'], ['middle+bottom:start', 'C'], ['top:center+end', 'B'], ['top:start', 'A'])), ['A', 'B', 'C', 'D']);
});

test('a full-height cell shares the row with the stacked cells beside it and reads along x', () => {
  assert.deepEqual(order(cells(['bottom:center+end', 'C'], ['top:center+end', 'B'], ['start', 'A'])), ['A', 'B', 'C']);
  assert.deepEqual(order(cells(['end', 'C'], ['middle+bottom:start', 'B'], ['top:start', 'A'])), ['A', 'B', 'C']);
});

test('a group in a cell keeps its block order inside the cell; blocks that name one cell stack in source order', () => {
  const group = compose({title: 'T', blocks: [{region: 'end', text: 'R'}, {region: 'start', blocks: [{text: 'L1'}, {text: 'L2'}]}]});
  assert.deepEqual(group.items.filter(item => item.field !== 'title').map(item => item.path.replace(/^slides\.0\./, '')), ['blocks.1.blocks.0.text', 'blocks.1.blocks.1.text', 'blocks.0.text']);
  const shared = cells(['start', 'L1'], ['end', 'R'], ['start', 'L2']);
  assert.deepEqual(order(shared), ['L1', 'L2', 'R']);
  assert.deepEqual(paths(shared), ['blocks.0.text', 'blocks.2.text', 'blocks.1.text']);
  // They stack as a group of their own would.
  const asGroup = compose({title: 'T', blocks: [{region: 'start', blocks: [{text: 'L1'}, {text: 'L2'}]}, {region: 'end', text: 'R'}]});
  assert.deepEqual(body(shared).map(item => item.box), asGroup.items.filter(item => item.field !== 'title').map(item => item.box));
});

test('geometry does not depend on the source order: each cell keeps its box', () => {
  const boxes = slide => Object.fromEntries(body(slide).map(item => [item.value, item.box]));
  const thirds = boxes(cells(['start', 'L'], ['center', 'C'], ['end', 'R']));
  assert.ok(thirds.L.x < thirds.C.x && thirds.C.x < thirds.R.x);
  assert.equal(thirds.L.y, thirds.R.y);
  for (const written of [[['end', 'R'], ['center', 'C'], ['start', 'L']], [['center', 'C'], ['start', 'L'], ['end', 'R']]]) assert.deepEqual(boxes(cells(...written)), thirds);
});

test('visualReadingOrder: rows top to bottom, along the row, ties keep input order, rtl reverses each row', () => {
  const at = (id, x, y, width = 10, height = 10) => ({id, box: {x, y, width, height}});
  const ids = (list, direction) => visualReadingOrder(list, direction).map(item => item.id).join('');
  const grid = [at('d', 20, 20), at('b', 20, 0), at('a', 0, 0), at('c', 0, 20)];
  assert.equal(ids(grid), 'abcd');
  assert.equal(ids(grid, 'rtl'), 'badc');
  assert.equal(ids([at('x', 0, 0), at('y', 0, 0)]), 'xy');
  // a tall item joins the rows beside it, and the row reads along x
  assert.equal(ids([at('r', 20, 0, 10, 30), at('l2', 0, 20), at('l1', 0, 0)]), 'l1l2r');
  assert.deepEqual(visualReadingOrder([]), []);
});

test('OPF 0.35: a removed slide key that named a cell draws nothing, and cells place blocks only on a slide without a layout', () => {
  assert.deepEqual(order({title: 'T', start: {text: 'Old'}, blocks: [{region: 'end', text: 'New'}]}), ['New']);
  assert.deepEqual(compose({title: 'T', 'top:start': {text: 'Old'}}).items.filter(item => item.field !== 'title'), []);
  // With a layout record (here passed directly) a cell word names no region of it: the blocks are bound by kind, not placed in cells.
  const layout = {name: 'Two', direction: 'row', regions: [{name: 'first', accepts: ['text']}, {name: 'second', accepts: ['text']}]};
  const bound = composeSlide({title: 'T', blocks: [{region: 'end', text: 'A'}, {region: 'start', text: 'B'}]}, {width: 1280, height: 720, layout});
  assert.deepEqual(bound.diagnostics.filter(entry => entry.code === 'region-unknown').map(entry => entry.region), ['end', 'start']);
});
