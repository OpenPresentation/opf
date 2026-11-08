// LH-182 remainder: an explicit legend/label choice must not reopen the hole or move any existing slice geometry.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {chartDoughnut, resolveChartData} from '../dist/composition.js';
const data = {columns: ['Quarter', 'Current', 'Baseline'], rows: [['Q1', 13, 10], ['Q2', 17, 12], ['Q3', 20, 14], ['Q4', 24, 16]]};
const geometry = {box: {x: 0, y: 0, width: 600, height: 400}, scale: 1, minFontSize: 20, measure: (text, size) => text.length * size / 2};
const of = (options, extra = {}) => {
  const chart = {type: 'doughnut', data, ...options};
  return chartDoughnut(chart, resolveChartData(chart), {...geometry, ...extra});
};
const near = (value, expected) => assert.ok(Math.abs(value - expected) < 1e-9, `${value} != ${expected}`);
test('all explicit legend positions fill the existing optioned square, with unchanged 90% radius', () => {
  const expectations = {none: [300, 200, 85.5], left: [330, 200, 85.5], right: [270, 200, 85.5], top: [300, 220, 76.5], bottom: [300, 180, 76.5]};
  for (const [legend, [cx, cy, r]] of Object.entries(expectations)) {
    const layer = of({legend, dataLabels: {content: ['percent']}});
    assert.ok(layer, legend);
    near(layer.hole.cx, cx); near(layer.hole.cy, cy); near(layer.hole.r, r);
    near(layer.pie.width, 4 * r); near(layer.pie.height, 4 * r);
  }
});
test('label-only options retain the default side legend geometry; values and ring counts do not move the hole', () => {
  const standard = of({dataLabels: true});
  near(standard.hole.cx, 270); near(standard.hole.cy, 200); near(standard.hole.r, 85.5);
  for (const dataLabels of [false, true, {content: ['category', 'percent'], separator: ' / '}]) assert.deepEqual(of({dataLabels}), standard);
  const one = {columns: data.columns.slice(0, 2), rows: data.rows.map(row => row.slice(0, 2))};
  assert.deepEqual(of({data: one, legend: 'none', dataLabels: true}), of({legend: 'none', dataLabels: true}));
});
test('a wrapping top/bottom legend reserves every row before the hole, at the original chart text size', () => {
  const long = {columns: ['Category', 'Value'], rows: Array.from({length: 5}, (_, index) => ['Category name that occupies its own legend row ' + index, index + 1])};
  const top = of({data: long, legend: 'top'}, {box: {...geometry.box, width: 200}});
  const bottom = of({data: long, legend: 'bottom'}, {box: {...geometry.box, width: 200}});
  near(top.hole.cy, 280); near(bottom.hole.cy, 120);
  near(top.hole.r, 40.5); near(bottom.hole.r, 40.5);
});
test('a header is carved first, while the source box is not mutated', () => {
  const chart = {type: 'doughnut', data, legend: 'none'};
  const actual = chartDoughnut(chart, resolveChartData(chart), geometry, {header: {height: 40}});
  near(actual.hole.cy, 220); near(actual.hole.r, 76.5);
  assert.deepEqual(geometry.box, {x: 0, y: 0, width: 600, height: 400});
});
