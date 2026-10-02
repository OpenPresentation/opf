import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide, visualReadingOrder} from '../dist/composition.js';

// RR-29: promoted regions are composed in visual reading order (rows top to bottom, then along the row)
// instead of alphabetical key order, so the composed item order matches what a reader sees. Geometry is
// unchanged: only the order of the items (and so the SVG draw order and the PPTX shape order) differs.
const compose = slide => composeSlide(slide, {width: 1280, height: 720});
const order = slide => compose(slide).items.filter(item => item.field !== 'title').map(item => item.path.replace(/^slides\.0\./, ''));
const sortedBoxes = result => [...result.items].sort((a, b) => a.path.localeCompare(b.path)).map(item => [item.path, item.box]);

test('columns are composed left, center, right (not center, left, right)', () => {
  assert.deepEqual(order({title: 'T', right: {text: 'R'}, center: {text: 'C'}, left: {text: 'L'}}), ['left.text', 'center.text', 'right.text']);
});

test('rows are composed top, middle, bottom', () => {
  assert.deepEqual(order({title: 'T', bottom: {text: 'B'}, top: {text: 'T'}, middle: {text: 'M'}}), ['top.text', 'middle.text', 'bottom.text']);
});

test('a grid with spans reads row by row', () => {
  assert.deepEqual(order({
    title: 'T',
    'middle+bottom:center+right': {text: 'D'}, 'middle+bottom:left': {text: 'C'}, 'top:center+right': {text: 'B'}, 'top:left': {text: 'A'},
  }), ['top:left.text', 'top:center+right.text', 'middle+bottom:left.text', 'middle+bottom:center+right.text']);
});

test('a full-height region shares the row with the stacked regions beside it and reads along x', () => {
  assert.deepEqual(order({title: 'T', 'bottom:center+right': {text: 'C'}, 'top:center+right': {text: 'B'}, left: {text: 'A'}}), ['left.text', 'top:center+right.text', 'bottom:center+right.text']);
  assert.deepEqual(order({title: 'T', right: {text: 'C'}, 'middle+bottom:left': {text: 'B'}, 'top:left': {text: 'A'}}), ['top:left.text', 'middle+bottom:left.text', 'right.text']);
});

test('a region group keeps its block order inside the region', () => {
  const result = compose({title: 'T', right: {text: 'R'}, left: {blocks: [{text: 'L1'}, {text: 'L2'}]}});
  assert.deepEqual(result.items.filter(item => item.field !== 'title').map(item => item.path.replace(/^slides\.0\./, '')), ['left.blocks.0.text', 'left.blocks.1.text', 'right.text']);
});

test('the order does not depend on the order the region keys are written in', () => {
  const expected = order({title: 'T', left: {text: 'L'}, center: {text: 'C'}, right: {text: 'R'}});
  for (const keys of [['right', 'center', 'left'], ['center', 'left', 'right'], ['left', 'right', 'center']]) {
    assert.deepEqual(order({title: 'T', ...Object.fromEntries(keys.map(key => [key, {text: key}]))}), expected);
  }
});

test('geometry is unchanged: each region keeps its box, only the item order differs', () => {
  const box = result => Object.fromEntries(sortedBoxes(result));
  const thirds = box(compose({title: 'T', left: {text: 'L'}, center: {text: 'C'}, right: {text: 'R'}}));
  assert.ok(thirds['slides.0.left.text'].x < thirds['slides.0.center.text'].x && thirds['slides.0.center.text'].x < thirds['slides.0.right.text'].x);
  assert.equal(thirds['slides.0.left.text'].y, thirds['slides.0.right.text'].y);
  // the same document composed with its keys written in the reverse order lands every item on the same box
  assert.deepEqual(
    sortedBoxes(compose({title: 'T', left: {text: 'L'}, center: {text: 'C'}, right: {text: 'R'}})),
    sortedBoxes(compose({title: 'T', right: {text: 'R'}, center: {text: 'C'}, left: {text: 'L'}})),
  );
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
