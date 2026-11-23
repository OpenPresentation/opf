// 0.35.2 (the gap above a column chart's plot): a small column chart with its value axis hidden and its columns labeled (LH-03) ends its
// axis at the tallest column, so the column reaches the top of the plot under its label row instead of a round end up to a quarter above it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chartValueAxis, composeSlide, resolveChartData } from '../dist/composition.js';

const column = { type: 'column', title: 'Revenue by region', data: { columns: ['Region', 'Revenue'], rows: [['North', 42], ['South', 31]] } };
const geometry = { width: 560, height: 420, scale: 1 };

test('a labeled column chart with a hidden axis ends its axis at the tallest column', () => {
  const resolved = resolveChartData(column);
  const shown = chartValueAxis(column, resolved, geometry), hidden = chartValueAxis(column, resolved, { ...geometry, labeled: true });
  assert.ok(shown.max > 42, `a visible axis keeps its round end: ${shown.max}`);
  assert.deepEqual([hidden.min, hidden.max], [0, 42]);
  assert.equal(hidden.majorUnit, shown.majorUnit);
  // A bar chart (horizontal) and a line keep their scales.
  for (const type of ['bar', 'line']) {
    const chart = { ...column, type };
    assert.notEqual(chartValueAxis(chart, resolveChartData(chart), { ...geometry, labeled: true }).max, 42, type);
  }
});

test('a column chart that goes below zero keeps its scale', () => {
  const chart = { ...column, data: { columns: ['Region', 'Change'], rows: [['North', 42], ['South', -12]] } };
  const axis = chartValueAxis(chart, resolveChartData(chart), { ...geometry, labeled: true });
  assert.ok(axis.min < -12 || axis.max !== 42, `${axis.min}..${axis.max}`);
});

test('a lone small column chart composes with its axis ending at its tallest column', () => {
  const result = composeSlide({ title: 'Single column', chart: column }, { width: 1280, height: 720 });
  const chart = result.items.find((item) => item.field === 'chart');
  if (chart.chart.layer?.small?.valueAxis === false) assert.equal(chart.chart.valueAxis.max, 42);
  else assert.ok(chart.chart.valueAxis.max > 42, 'a chart that shows its axis keeps the round end');
});
