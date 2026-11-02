// LH-03 and LH-81: the chart layer in the preview. Composition decides a chart's small-chart treatment and header row (core
// chart-layer.ts, ComposedChart.layer); this asserts what the preview draws from it.
import assert from 'node:assert/strict';
import { resolvePresentation, toSvg } from './catalog-harness.mjs';

const attributesOf = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const two = { columns: ['Quarter', 'Current', 'Baseline'], rows: [['Q1', 28, 25], ['Q2', 32, 27], ['Q3', 35, 29], ['Q4', 39, 31]] };
const deck = (chart, design = {}) => ({ design: { fontScheme: 'roboto', ...design }, slides: [{ title: 'Chart', chart }] });
const NEUTRALS = resolvePresentation(deck({ type: 'column', data: two })).slides[0].design.roles.neutrals;
const texts = (svg) => [...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map(([, a, body]) => ({ ...attributesOf(a), body: body.replace(/<[^>]*>/g, '') }));
const panel = (svg) => [...svg.matchAll(/<rect\b([^>]*)\/?>/g)].map(([, a]) => attributesOf(a)).find((a) => a['data-opf-path'] === 'slides.0.chart');
const gridlines = (svg) => [...svg.matchAll(/<line\b([^>]*)\/>/g)].map(([, a]) => attributesOf(a)).filter((a) => a.stroke === NEUTRALS.gridline.hex);
let checks = 0;

// 1. A small chart: every value labelled, no panel, no gridlines, no tick labels.
{
  const svg = toSvg(deck({ type: 'column', data: two }), 1, { trace: true });
  const bodies = texts(svg).map((entry) => entry.body);
  for (const value of [28, 25, 32, 27, 35, 29, 39, 31]) assert.ok(bodies.includes(String(value)), `the value ${value} is labelled`);
  assert.equal(panel(svg), undefined, 'no chart panel');
  assert.equal(gridlines(svg).length, 0, 'no gridlines');
  assert.ok(!bodies.includes('0') && !bodies.includes('40'), 'no value tick labels');
  checks += 4;
}

// 2. Explicit options win: dataLabels false brings the panel, the gridlines and the ticks back.
{
  const svg = toSvg(deck({ type: 'column', data: two, dataLabels: false }), 1, { trace: true });
  assert.ok(panel(svg), 'the panel');
  assert.ok(gridlines(svg).length > 1, 'the gridlines');
  assert.ok(!texts(svg).some((entry) => entry.body === '28'), 'no labels');
  checks += 3;
}

// 3. The header row: the bold caption at the start, the legend entries above the plot, the plot as wide as the chart allows.
{
  const svg = toSvg(deck({ type: 'line', data: two, dataLabels: false }), 1, { trace: true });
  const caption = texts(svg).find((entry) => entry.body === 'Current, Baseline by Quarter');
  assert.ok(caption, 'the caption');
  const legend = texts(svg).filter((entry) => /^slides\.0\.chart\.data\.columns\.\d$/.test(entry['data-opf-path'] ?? ''));
  assert.deepEqual(legend.map((entry) => entry.body), ['Current', 'Baseline']);
  const top = Math.min(...gridlines(svg).map((line) => Number(line.y1)));
  assert.ok(legend.every((entry) => Number(entry.y) < top), 'the legend sits above the plot');
  const side = toSvg(deck({ type: 'line', data: two, dataLabels: false, legend: 'right' }), 1, { trace: true });
  const right = (lines) => Math.max(...lines.map((line) => Number(line.x2)));
  assert.ok(right(gridlines(svg)) > right(gridlines(side)), 'without a side legend the plot keeps the width');
  assert.ok(!texts(side).some((entry) => entry.body === 'Current, Baseline by Quarter'), 'a legend option draws no header row');
  checks += 5;
}

// 4. Right to left, the caption sits at the right edge.
{
  const svg = toSvg({ ...deck({ type: 'column', data: two }), language: 'ar' }, 1, { trace: true });
  const caption = texts(svg).find((entry) => entry.body === 'Current, Baseline');
  assert.ok(caption, 'outside English the caption is the series part');
  assert.ok(Number(caption.x) > 640, 'at the right');
  checks += 2;
}

console.log(`Chart layer passed: ${checks} checks (small charts, explicit options, header row, right to left).`);
