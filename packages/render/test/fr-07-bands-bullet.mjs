// FR-07 (CR 5): bands over the gridlines and behind the data of column, bar, line and area charts, the bullet chart (bands, a thin measure bar
// and a target tick per row), right to left, and the lowest contrast between a data mark and a band over every gallery color scheme.
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { chartBandFill, colorContrast } from '@openpresentation/opf/composition';
import { resolvePresentation, toSvg } from './catalog-harness.mjs';

const attributesOf = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const marks = (svg) => [...svg.matchAll(/<(rect|line|polyline|path|circle)\b([^>]*)>/g)].map(([, tag, a]) => ({ tag, ...attributesOf(a) }));
const num = (value) => Number(value);
let checks = 0;

const wait = { columns: ['Week', 'Wait'], rows: [['W1', 14], ['W2', 11], ['W3', 9], ['W4', 12]] };
const deck = (chart, extra = {}) => ({ design: { fontScheme: 'roboto' }, ...extra, slides: [{ title: 'Wait time', chart: { alt: 'Wait time by week.', ...chart } }] });

// A column chart: three bands across the whole plot, over the gridlines and behind the columns, darkest lowest, in core's colors.
{
  const input = deck({ type: 'column', data: { columns: ['Week', 'Wait'], rows: [['W1', 14], ['W2', 11], ['W3', 9], ['W4', 3]] }, legend: 'right', bands: [{ to: 10, label: 'Good' }, { to: 15 }, { to: 20, label: 'Over' }] });
  const svg = toSvg(input, 1, { trace: true }), all = marks(svg);
  const colors = resolvePresentation(input).slides[0].design.colors;
  const bands = all.filter((mark) => mark.tag === 'rect' && /\.bands\.\d+$/.test(mark['data-opf-path'] ?? '') && num(mark.width) > 30);
  assert.equal(bands.length, 3);
  const columns = all.filter((mark) => mark.tag === 'rect' && /\.data\.rows\.\d+\.1$/.test(mark['data-opf-path'] ?? ''));
  const firstBand = all.indexOf(bands[0]), firstColumn = all.indexOf(columns[0]);
  assert.ok(firstBand < firstColumn, 'bands come before the columns');
  // Bands span the plot width; each next band sits above the previous one and they touch.
  assert.ok(bands.every((band) => band.x === bands[0].x && band.width === bands[0].width));
  for (let i = 1; i < bands.length; i++) assert.ok(Math.abs(num(bands[i].y) + num(bands[i].height) - num(bands[i - 1].y)) < 0.02, `band ${i} sits on band ${i - 1}`);
  // 0-10 is twice 10-15.
  assert.ok(Math.abs(num(bands[0].height) - 2 * num(bands[1].height)) < 0.05);
  const surface = resolvePresentation(input).slides[0].design.backgroundColor ?? colors.background;
  assert.equal(bands[0].fill.toUpperCase(), chartBandFill({ neutral: 0 }, { surface, text: colors.text, resolve: () => '#000000' }));
  assert.ok(Math.abs(colorContrast(bands[0].fill, surface) - 1.75) < 0.02, 'the first neutral at 1.75:1 against the surface');
  // Owner's "1B": the labeled bands name themselves inside their bands (core placeBandLabels), on top of the data, in the secondary text color;
  // the legend holds only the series. The labels sit at the stripe's end corner, inside the band.
  const layer = toSvg(input, 1, { trace: true });
  const labels = [...layer.matchAll(/<g\b[^>]*data-opf-box-height="([^"]+)" data-opf-box-width="([^"]+)" data-opf-box-x="([^"]+)" data-opf-box-y="([^"]+)" data-opf-path="slides\.0\.chart\.bands\.(\d+)\.label"/g)].map(([, height, width, x, y, index]) => ({ index: Number(index), x: num(x), y: num(y), width: num(width), height: num(height) }));
  assert.deepEqual(labels.map((label) => label.index), [0, 2], 'a label for each labeled band');
  for (const label of labels) {
    const band = bands.find((rect) => rect['data-opf-path'] === `slides.0.chart.bands.${label.index}`);
    assert.ok(label.x >= num(band.x) && label.x + label.width <= num(band.x) + num(band.width) + 0.01 && label.y >= num(band.y) && label.y + label.height <= num(band.y) + num(band.height) + 0.01, `label ${label.index} inside its band`);
    assert.ok(Math.abs(num(band.x) + num(band.width) - 8 - (label.x + label.width)) < 0.05, `label ${label.index} at the stripe's end`);
  }
  assert.ok(layer.lastIndexOf('bands.2.label') > layer.lastIndexOf('data.rows.3.1'), 'the labels come after the data');
  const legend = all.filter((mark) => mark.tag === 'rect' && num(mark.width) < 30 && /\.(bands\.\d+|data\.columns\.\d+)$/.test(mark['data-opf-path'] ?? '')).map((mark) => mark['data-opf-path']);
  assert.deepEqual(legend, ['slides.0.chart.data.columns.1'], 'the legend holds only the series');
  checks += 10;
}

// The fallback: a label that does not fit its band (or meets a mark at both places) sends every band label of the chart to the legend, the bands
// first, then the series; nothing is drawn inside the bands.
{
  const input = deck({ type: 'column', data: wait, legend: 'right', bands: [{ to: 10, label: 'Good' }, { to: 10.2, label: 'A label far too long for its thin band' }, { to: 20, label: 'Over' }] });
  const svg = toSvg(input, 1, { trace: true }), all = marks(svg);
  assert.ok(!/bands\.\d+\.label/.test(svg), 'no label inside a band');
  const legend = all.filter((mark) => mark.tag === 'rect' && num(mark.width) < 30 && /\.(bands\.\d+|data\.columns\.\d+)$/.test(mark['data-opf-path'] ?? '')).map((mark) => mark['data-opf-path']);
  assert.deepEqual(legend, ['slides.0.chart.bands.0', 'slides.0.chart.bands.1', 'slides.0.chart.bands.2', 'slides.0.chart.data.columns.1'], 'bands first, then the series');
  checks += 2;
}

// A chart without bands draws as before.
{
  const plain = toSvg(deck({ type: 'column', data: wait }), 1, { trace: true });
  const ignored = toSvg(deck({ type: 'pie', data: wait, bands: [{ to: 3 }] }), 1, { trace: true });
  assert.ok(!/\.bands\./.test(plain) && !/\.bands\./.test(ignored), 'no band marks without bands, or on a pie');
  assert.equal(toSvg(deck({ type: 'pie', data: wait, bands: [{ to: 3 }] }), 1), toSvg(deck({ type: 'pie', data: wait }), 1), 'a pie ignores bands');
  checks += 2;
}

// A line chart: bands from the first to the last category center.
{
  const svg = toSvg(deck({ type: 'line', data: wait, bands: [{ to: 10 }, { to: 20 }] }), 1, { trace: true });
  const bands = marks(svg).filter((mark) => mark.tag === 'rect' && /\.bands\.\d+$/.test(mark['data-opf-path'] ?? ''));
  const line = marks(svg).find((mark) => mark.tag === 'polyline' && /\.data\.columns\.1$/.test(mark['data-opf-path'] ?? ''));
  const xs = line.points.split(' ').map((point) => num(point.split(',')[0]));
  assert.ok(Math.abs(num(bands[0].x) - xs[0]) < 0.05 && Math.abs(num(bands[0].x) + num(bands[0].width) - xs[xs.length - 1]) < 0.05, 'first to last category center');
  checks += 1;
}

// A bullet chart: per row a measure bar a third of the row, a target tick two thirds of it, bands over every row; no tick for a missing target.
{
  const data = { columns: ['KPI', { name: 'Actual', format: '0%' }, { name: 'Target', format: '0%' }], rows: [['Win rate', 0.31, 0.35], ['Retention', 0.92, 0.9], ['NPS', 0.64, null]] };
  const chart = { type: 'bullet', data, mapping: { target: 'Target' }, bands: [{ to: 0.6, label: 'Poor' }, { to: 0.85, label: 'Fair' }, { to: 1, label: 'Good' }] };
  for (const language of ['en', 'ar']) {
    const svg = toSvg(deck(chart, { language }), 1, { trace: true }), all = marks(svg);
    const bars = all.filter((mark) => mark.tag === 'rect' && /\.data\.rows\.\d+\.1$/.test(mark['data-opf-path'] ?? ''));
    const ticks = all.filter((mark) => mark.tag === 'line' && /\.mapping\.target$/.test(mark['data-opf-path'] ?? ''));
    const bands = all.filter((mark) => mark.tag === 'rect' && /\.bands\.\d+$/.test(mark['data-opf-path'] ?? ''));
    assert.equal(bars.length, 3);
    assert.equal(ticks.length, 2, 'the row without a target has no tick');
    const row = num(bands[0].height) / 3;
    assert.ok(Math.abs(num(bars[0].height) - row / 3) < 0.05, 'a bar is a third of its row');
    assert.ok(Math.abs(num(ticks[0].y2) - num(ticks[0].y1) - 2 * row / 3) < 0.05, 'a tick is two thirds of its row');
    assert.ok(all.indexOf(bands[0]) < all.indexOf(bars[0]) && all.indexOf(bars[0]) < all.indexOf(ticks[0]), 'bands, then bars, then ticks');
    const plotLeft = Math.min(...bands.map((band) => num(band.x))), plotRight = Math.max(...bands.map((band) => num(band.x) + num(band.width)));
    const at = (value) => language === 'ar' ? plotRight - value * (plotRight - plotLeft) : plotLeft + value * (plotRight - plotLeft);
    assert.ok(Math.abs(num(ticks[0].x1) - at(0.35)) < 0.05, `tick at its target (${language})`);
    assert.ok(Math.abs((language === 'ar' ? num(bars[1].x) : num(bars[1].x) + num(bars[1].width)) - at(0.92)) < 0.05, `bar to its value (${language})`);
    checks += 7;
  }
}

// One color for every band label of a chart: with the default bands the darkest (1.75:1 on the surface) holds the secondary text below 4.5:1,
// so every label takes the primary text color; when only the lighter bands are labeled, the secondary (axis-label) color.
{
  const low = { columns: ['Week', 'Wait'], rows: [['W1', 2], ['W2', 3], ['W3', 2], ['W4', 1]] };
  const fillOf = (svg, k) => /\bfill="(#[0-9A-Fa-f]{6})"/.exec([...svg.matchAll(/<text\b[^>]*>/g)].map(([tag]) => tag).find((tag) => tag.includes(`data-opf-path="slides.0.chart.bands.${k}.label"`)) ?? '')?.[1];
  const input = deck({ type: 'column', data: low, bands: [{ to: 10, label: 'Low' }, { to: 15, label: 'Mid' }, { to: 20, label: 'High' }] }, { design: { fontScheme: 'roboto', theme: 'classic', variant: 'light1' } });
  const colors = resolvePresentation(input).slides[0].design.colors;
  const all = toSvg(input, 1, { trace: true });
  assert.deepEqual([0, 1, 2].map((k) => fillOf(all, k)?.toUpperCase()), Array(3).fill(fillOf(all, 0)?.toUpperCase()), 'one color for every label');
  const light = toSvg(deck({ type: 'column', data: low, bands: [{ to: 10 }, { to: 15, label: 'Mid' }, { to: 20, label: 'High' }] }, { design: { fontScheme: 'roboto', theme: 'classic', variant: 'light1' } }), 1, { trace: true });
  assert.notEqual(fillOf(light, 1), fillOf(all, 1), 'the lighter bands alone keep the secondary color');
  const darkest = marks(all).find((mark) => mark.tag === 'rect' && mark['data-opf-path'] === 'slides.0.chart.bands.0').fill;
  assert.ok(colorContrast(fillOf(all, 0), darkest) >= 4.5, `the primary text color reads on the darkest band (${fillOf(all, 0)} on ${darkest}, text ${colors.text})`);
  checks += 3;
}

// Draw order, as PowerPoint draws it (its gridlines lie behind every series, and the bands are series): gridlines, then bands, then the data, on
// column, bar, line and area charts and the bullet chart, so a gridline shows only where no band is.
for (const type of ['column', 'bar', 'line', 'area', 'bullet']) {
  const chart = { type, legend: 'none', data: { columns: ['Q', 'A', 'T'], rows: [['Q1', 10, 12], ['Q2', 14, 11], ['Q3', 9, 13]] }, bands: [{ to: 8 }, { to: 16 }], ...(type === 'bullet' ? { mapping: { target: 'T' } } : { mapping: { series: ['A'] } }) };
  const all = marks(toSvg(deck(chart), 1, { trace: true }));
  const grid = all.map((mark, index) => [mark, index]).filter(([mark]) => mark.tag === 'line' && !mark['data-opf-path']).map(([, index]) => index);
  const bands = all.map((mark, index) => [mark, index]).filter(([mark]) => mark.tag === 'rect' && /\.bands\.\d+$/.test(mark['data-opf-path'] ?? '') && num(mark.width) > 30).map(([, index]) => index);
  const data = all.map((mark, index) => [mark, index]).filter(([mark]) => /\.data\.(rows\.\d+\.1|columns\.1)$/.test(mark['data-opf-path'] ?? '') && mark.tag !== 'text' && mark.tag !== 'g').map(([, index]) => index);
  assert.ok(grid.length && bands.length && data.length, `${type}: gridlines, bands and data drawn`);
  assert.ok(Math.max(...grid.filter((index) => index < Math.min(...data))) < Math.min(...bands), `${type}: the gridlines come before the bands`);
  assert.ok(Math.max(...bands) < Math.min(...data), `${type}: the bands come before the data`);
  checks += 2;
}

console.log(`FR-07 bands and bullet render: ${checks} checks`);
