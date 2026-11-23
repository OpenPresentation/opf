// A11 (0.35.2, LH-115's growth beside every chart): a short table centered beside a column, line or pie chart grows (type-scale steps up to
// its display size, within the chart box's height) and starts on the chart box's top line, where the chart's heading stands.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide, layoutTable } from '../dist/composition.js';

const data = { columns: ['Region', 'Revenue'], rows: [['North', 42], ['South', 31]] };
const table = { columns: ['Region', 'Revenue'], rows: [['North', '$4.2M'], ['South', '$3.1M']] };
const compose = (slide, options = {}) => composeSlide(slide, { width: 1280, height: 720, ...options });
const size = (item) => Math.min(...layoutTable(item.value, item.box, { scale: 1, minFontSize: item.composition.minFontSize, ...(item.tableGrowth ? { growth: item.tableGrowth } : {}) }).rows.flatMap((row) => row.cells.map((cell) => cell.fit.fontSize)));

for (const type of ['column', 'line', 'pie']) test(`a short table beside a ${type} chart grows beside it (the chart's top line, or centered beside a pie)`, () => {
  const slide = { title: `${type} + table`, blocks: [{ chart: { type, title: 'Revenue by region', data } }, { table }] };
  const result = compose(slide), kept = compose(slide, { fill: false });
  const chart = result.items.find((item) => item.field === 'chart'), placed = result.items.find((item) => item.field === 'table');
  assert.ok(placed.tableGrowth > 1, 'the table grew');
  assert.ok(size(placed) > size(kept.items.find((item) => item.field === 'table')) - 1e-6, 'never smaller');
  // A pie has no top line: the table stays centered beside it.
  if (type === 'pie') assert.ok(Math.abs(placed.box.y + placed.box.height / 2 - (chart.box.y + chart.box.height / 2)) < 1, 'centered beside the pie');
  else assert.ok(Math.abs(placed.box.y - chart.box.y) < 1, `top ${placed.box.y} vs chart ${chart.box.y}`);
  assert.ok(placed.box.height <= chart.box.height + 0.5, 'within the chart box');
});

test('a table as tall as the chart box keeps its size', () => {
  const rows = Array.from({ length: 14 }, (_, index) => [`Region ${index + 1}`, `$${index}.0M`]);
  const slide = { title: 'Long table', blocks: [{ chart: { type: 'column', title: 'Revenue by region', data } }, { table: { ...table, rows } }] };
  const placed = compose(slide).items.find((item) => item.field === 'table');
  assert.equal(placed.tableGrowth, undefined);
});
