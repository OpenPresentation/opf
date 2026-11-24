// A12, C11 (0.35.2): a pie or doughnut bound by its box's height stands with its value list (LH-108) as one group centered in the box,
// the list `between` from the pie, instead of the list pinned to the box's far end.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';

const data = { columns: ['Region', 'Revenue'], rows: [['North', 42], ['South', 31]] };
for (const type of ['pie', 'doughnut']) test(`a lone ${type}'s list stands beside it and the group is centered`, () => {
  const result = composeSlide({ title: `Single ${type}`, chart: { type, data } }, { width: 1280, height: 720 });
  const chart = result.items.find((item) => item.field === 'chart'), list = chart.chart.layer.valueList;
  assert.ok(list, 'a value list');
  const pieRight = list.pie.x + list.pie.width, listLeft = Math.min(...list.rows.map((row) => row.box.x)), listRight = Math.max(...list.rows.map((row) => row.box.x + row.box.width));
  assert.ok(listLeft - pieRight < 60, `list ${listLeft - pieRight} px from the pie`);
  const left = list.pie.x - chart.box.x, right = chart.box.x + chart.box.width - listRight;
  assert.ok(Math.abs(left - right) < 2, `group centered: ${left} vs ${right}`);
});
