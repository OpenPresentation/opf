// opf#1412 (A7): a grid the slide asks for. Its short last row stretches to the full width when the engine chose the columns (LH-47
// widened, as in automatic composition), its blocks sit in the middle of their cells, and a chart in it keeps the grid (no LH-49 track).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';

const chart = { chart: { type: 'column', alt: 'Two regions.', data: { columns: ['Region', 'Revenue'], rows: [['North', 42], ['South', 31]] } } };
const text = { text: 'Ship the pilot in March.' }, list = { items: ['Faster reviews', 'Fewer handoffs'] }, metric = { metric: { value: '42%', label: 'Review time saved' } };
const block = (result, index) => result.items.find((item) => item.path.startsWith(`slides.0.blocks.${index}.`));

test('mode grid: no empty cell, blocks in the middle of their cells, the chart stays in the grid', () => {
  const result = composeSlide({ title: 'Grid', composition: { mode: 'grid' }, blocks: [text, list, metric, chart] });
  assert.equal(result.track, undefined, 'no chart track');
  const last = block(result, 3).box;
  assert.ok(Math.abs(last.width - result.contentBox.width) < 1, 'the last row takes the full width');
  const first = block(result, 0).box, row = last.y - result.contentBox.y;
  assert.ok(first.y > result.contentBox.y + 1 && Math.abs(first.y + first.height / 2 - (result.contentBox.y + row / 2)) < row / 4, 'the text sits in the middle of its cell');
});

test('columns 2: the blocks of the top row sit in the middle of their cells', () => {
  const result = composeSlide({ title: 'Two columns', composition: { columns: 2 }, blocks: [text, list, metric] });
  const first = block(result, 0).box, second = block(result, 1).box, lower = block(result, 2).box;
  const cell = (lower.y - result.contentBox.y);
  for (const box of [first, second]) assert.ok(box.y > result.contentBox.y + cell / 6, 'not at the top of the cell');
});
