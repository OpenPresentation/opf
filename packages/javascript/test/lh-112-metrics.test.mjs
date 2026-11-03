// LH-112, LH-101, LH-53, LH-61, LH-15, LH-57: metrics at display size beside other kinds, the trend arrow on the delta's line, a KPI column
// beside a chart, a band in a wide short cell, and the value color on dark surfaces.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { layouts } from './support/catalog.mjs';
import {
  METRIC_DISPLAY_SIZES, METRIC_TREND_ARROW_GAP, METRIC_TREND_ARROW_SIZE, METRIC_UNIT_SHARE, composeSlide, layoutMetric, metricTrendMark, metricValueColor,
} from '../dist/composition.js';

const box = { x: 40, y: 60, width: 600, height: 500 };
const kpi = { value: '118%', label: 'Net revenue retention', description: 'Trailing twelve months', delta: '+7 pts', trend: 'up' };
const part = (layout, role) => layout.parts.find(entry => entry.role === role);
const metricOf = composed => composed.items.find(item => item.metricLayout);
const dashboard = layouts.find(record => record.id === 'dashboard');
const chart = { type: 'line', data: { columns: ['Week', 'Rate'], rows: [['W1', 3.1], ['W2', 3.2], ['W3', 3.5], ['W4', 3.7], ['W5', 3.8], ['W6', 3.8]] } };

test('LH-53: the trend is an arrow before the delta on its line; the trend word is not drawn but is the text alternative', () => {
  for (const align of ['left', 'center', 'right']) {
    const layout = layoutMetric(kpi, box, { align, path: 'm' }), trend = part(layout, 'trend'), delta = part(layout, 'delta');
    assert.equal(trend.visible, false, align);
    assert.equal(trend.fit.sourceLines.length, 0);
    assert.equal(trend.text, 'up', 'the source text is kept');
    const arrow = layout.trendBox, origin = delta.linePositions[0], size = delta.fit.fontSize * METRIC_TREND_ARROW_SIZE;
    assert.ok(arrow, align);
    assert.ok(Math.abs(arrow.width - size) < 1e-6 && arrow.width === arrow.height);
    assert.ok(Math.abs(arrow.y + arrow.height - origin.baseline) < 1e-6, 'on the delta baseline');
    assert.ok(Math.abs(arrow.x + arrow.width + delta.fit.fontSize * METRIC_TREND_ARROW_GAP - origin.x) < 1e-6, 'before the delta');
    assert.ok(arrow.x >= box.x - .01 && arrow.x + arrow.width <= box.x + box.width + .01);
    const mark = metricTrendMark(layout, { background: '#FFFFFF' });
    assert.deepEqual(mark.box, arrow);
    assert.equal(mark.ariaLabel, 'Trend: up');
    assert.equal(mark.path, 'm.trend');
  }
  // The delta and the arrow share one line: no line is left for the trend.
  const withTrend = layoutMetric(kpi, box, { align: 'left' }), without = layoutMetric({ ...kpi, trend: undefined }, box, { align: 'left' });
  assert.ok(Math.abs(withTrend.bounds.height - without.bounds.height) < 1e-6);
});

test('LH-53: right to left, the arrow sits before the delta at its right', () => {
  const layout = layoutMetric({ value: '87%', label: 'رضا المستخدمين', delta: '+8 نقاط', trend: 'up' }, box, { align: 'left', direction: 'rtl' });
  const delta = part(layout, 'delta'), origin = delta.linePositions[0], line = delta.fit.sourceLines[0];
  assert.ok(layout.trendBox.x >= origin.x + line.width - .01, 'after the line, at its right');
  assert.ok(layout.trendBox.x + layout.trendBox.width <= box.x + box.width + .01);
});

test('LH-53: without a delta the arrow precedes the label; with nothing else it takes a line of its own', () => {
  const labeled = layoutMetric({ value: 42, label: 'Latency', trend: 'down' }, box, { align: 'left' });
  const label = part(labeled, 'label');
  assert.ok(Math.abs(labeled.trendBox.y + labeled.trendBox.height - label.linePositions[0].baseline) < 1e-6);
  assert.ok(labeled.trendBox.x + labeled.trendBox.width < label.linePositions[0].x);
  const bare = layoutMetric({ value: 42, trend: 'flat' }, box, { align: 'center' });
  assert.ok(bare.trendBox && bare.trendBox.y > part(bare, 'value').box.y + part(bare, 'value').fit.lineHeight - 1);
  assert.ok(bare.bounds.y + bare.bounds.height >= bare.trendBox.y + bare.trendBox.height, 'the bounds hold the arrow');
});

test('LH-53: a unit on its value line is drawn at METRIC_UNIT_SHARE of the value', () => {
  const layout = layoutMetric({ value: '18', unit: '%', label: 'Growth' }, box, { align: 'center' });
  assert.equal(layout.arrangement, 'inline-unit');
  assert.ok(part(layout, 'unit').fit.fontSize >= METRIC_UNIT_SHARE * part(layout, 'value').fit.fontSize - 1);
});

test('LH-112: a display value starts at its start size and grows within its height and width shares', () => {
  const grown = layoutMetric(kpi, box, { align: 'left', display: { start: 120, max: 160 } });
  assert.equal(part(grown, 'value').fit.fontSize, 160);
  // Against a 400 px reference the line keeps within 160 px: 128 px (the 4 px step under 160 / 1.22); against 300 px it stays at its start.
  assert.equal(part(layoutMetric(kpi, box, { align: 'left', display: { start: 120, max: 160, height: 400 } }), 'value').fit.fontSize, 128);
  assert.equal(part(layoutMetric(kpi, box, { align: 'left', display: { start: 120, max: 160, height: 300 } }), 'value').fit.fontSize, 120);
  // A value that would wrap at its start keeps one line at the largest size that does.
  const long = layoutMetric({ value: '5.6 hours', label: 'Saved' }, { ...box, width: 380 }, { align: 'left', display: { start: 120, max: 160 } });
  assert.equal(part(long, 'value').fit.lines.length, 1);
});

test('LH-15: a band puts the value at the start and the other fields beside it, mirrored right to left', () => {
  const wide = { x: 0, y: 0, width: 1160, height: 220 };
  const band = layoutMetric(kpi, wide, { band: true, display: { start: 120, max: 160 } });
  assert.equal(band.arrangement, 'band');
  const value = part(band, 'value'), label = part(band, 'label');
  assert.ok(label.box.x >= value.box.x + value.box.width, 'the column follows the value');
  assert.ok(label.box.y > value.box.y && label.box.y < value.box.y + value.box.height, 'beside it, not under it');
  const rtl = layoutMetric({ ...kpi, label: 'رضا المستخدمين' }, wide, { band: true, direction: 'rtl', display: { start: 120, max: 160 } });
  assert.equal(rtl.arrangement, 'band');
  assert.ok(part(rtl, 'label').box.x + part(rtl, 'label').box.width <= part(rtl, 'value').box.x + .01, 'the value at the right');
});

test('LH-112: a metric beside another block is start-aligned at display size; a lone metric and a grid of metrics stay centered', () => {
  const beside = metricOf(composeSlide({ title: 'Retention', blocks: [{ text: 'Existing customers expanded faster than churn took revenue away.' }, { metric: kpi }] }));
  assert.equal(beside.metricLayout.alignment, 'left');
  assert.ok(part(beside.metricLayout, 'value').fit.fontSize >= METRIC_DISPLAY_SIZES.one.start);
  // LH-101: a lone metric grows past the former 152 px display size toward about 230 px, centered.
  const lone = metricOf(composeSlide({ title: 'Validation', blocks: [{ metric: { value: '99.9%', label: 'Validation pass rate', delta: '+2.1 pts', trend: 'up' } }] }));
  assert.equal(lone.metricLayout.alignment, 'center');
  assert.ok(part(lone.metricLayout, 'value').fit.fontSize > 152, String(part(lone.metricLayout, 'value').fit.fontSize));
  const grid = composeSlide({ title: 'Grid', blocks: [{ metric: { value: '42%', label: 'A' } }, { metric: { value: '11', label: 'B' } }, { metric: { value: '91%', label: 'C' } }] });
  for (const item of grid.items.filter(entry => entry.metricLayout)) {
    assert.equal(item.metricLayout.alignment, 'center');
    assert.equal(part(item.metricLayout, 'value').requestedFontSize, 76);
  }
});

test('LH-112: right to left, a metric beside another block starts at the right', () => {
  const composed = composeSlide({ title: 'نتائج', blocks: [{ text: 'ارتفعت المبيعات في جميع المناطق خلال الربع الثالث.' }, { metric: { value: '87%', label: 'رضا المستخدمين', delta: '+8 نقاط', trend: 'up' } }] },
    { presentation: { language: 'ar', slides: [] } });
  const metric = metricOf(composed);
  assert.equal(metric.metricLayout.alignment, 'right');
});

test('LH-61: one KPI over a chart in the dashboard layout becomes a column of about a third beside the chart', () => {
  const composed = composeSlide({ layout: 'dashboard', title: 'Checkout conversion', blocks: [{ metric: kpi }, { chart }] }, { layout: dashboard });
  const metric = metricOf(composed), plot = composed.items.find(item => item.field === 'chart');
  assert.ok(composed.track?.kind === 'chart' && composed.recomposed?.chart, JSON.stringify(composed.track));
  assert.ok(metric.box.x + metric.box.width <= plot.box.x, 'the KPI column is at the start, the chart beside it');
  assert.ok(metric.box.width < composed.contentBox.width * .45);
  assert.ok(composed.recomposed.chart.plot > composed.recomposed.chart.layoutPlot);
  // Two KPIs stack in the column.
  const two = composeSlide({ layout: 'dashboard', title: 'Subscriptions', blocks: [{ metric: { value: '64,000', label: 'Paid subscribers' } }, { metric: { value: '$5.40', label: 'ARPU' } }, { chart }] }, { layout: dashboard });
  const [first, second] = two.items.filter(item => item.metricLayout);
  assert.ok(second.box.y >= first.box.y + first.box.height - 1, 'stacked');
  assert.equal(two.track?.kind, 'chart');
});

test('LH-57: on a dark surface a value whose accent is under 4.5:1 takes the light text color', () => {
  assert.equal(metricValueColor('#2E75B6', '#000000', '#FFFFFF'), '#FFFFFF');
  assert.equal(metricValueColor('#2E75B6', '#011842', '#FFFFFF'), '#FFFFFF');
  assert.equal(metricValueColor('#7FB8E6', '#011842', '#FFFFFF'), '#7FB8E6', 'an accent that reads keeps the accent');
  assert.equal(metricValueColor('#2E75B6', '#FFFFFF', '#000000'), '#2E75B6', 'a light surface keeps the accent');
});
