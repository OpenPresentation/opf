// LH-03 and LH-81: the chart layer in the preview. Composition decides a chart's small-chart treatment and header row (core
// chart-layer.ts, ComposedChart.layer); this asserts what the preview draws from it.
import assert from 'node:assert/strict';
import { colorContrast } from '@openpresentation/opf/composition';
import { chartSeriesPalette } from '../src/charts.js';
import { defaultCatalog, resolvePresentation, toSvg } from './catalog-harness.mjs';

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

// 2. Explicit options win: dataLabels false brings the gridlines and the ticks back (LH-105: no chart draws a panel).
{
  const svg = toSvg(deck({ type: 'column', data: two, dataLabels: false }), 1, { trace: true });
  assert.equal(panel(svg), undefined, 'no panel');
  assert.ok(gridlines(svg).length > 1, 'the gridlines');
  assert.ok(!texts(svg).some((entry) => entry.body === '28'), 'no labels');
  checks += 3;
}

// 3. The header row: the bold caption at the start, the legend entries above the plot, the plot as wide as the chart allows.
{
  // Two series: the legend names them, so the caption is generated from the value axis title only (LH-81 review).
  // LH-105: a line chart names its series at the line ends instead, so the header legend is shown on a column chart.
  const plain = toSvg(deck({ type: 'column', data: two, dataLabels: false }), 1, { trace: true });
  assert.ok(!texts(plain).some((entry) => / by /.test(entry.body)), 'no caption that repeats the legend');
  const svg = toSvg(deck({ type: 'column', data: two, dataLabels: false, axisTitles: { value: 'Signal' } }), 1, { trace: true });
  const caption = texts(svg).find((entry) => entry.body === 'Signal by quarter');
  assert.ok(caption, 'the caption, its category in sentence case');
  const legend = texts(svg).filter((entry) => /^slides\.0\.chart\.data\.columns\.\d$/.test(entry['data-opf-path'] ?? ''));
  assert.deepEqual(legend.map((entry) => entry.body), ['Current', 'Baseline']);
  const top = Math.min(...gridlines(svg).map((line) => Number(line.y1)));
  assert.ok(legend.every((entry) => Number(entry.y) < top), 'the legend sits above the plot');
  const side = toSvg(deck({ type: 'column', data: two, dataLabels: false, legend: 'right' }), 1, { trace: true });
  const right = (lines) => Math.max(...lines.map((line) => Number(line.x2)));
  assert.ok(right(gridlines(svg)) > right(gridlines(side)), 'without a side legend the plot keeps the width');
  assert.ok(!texts(side).some((entry) => entry.body === 'Signal by quarter'), 'a legend option draws no header row');
  checks += 6;
}

// 4. Right to left, the caption sits at the right edge.
{
  const svg = toSvg({ ...deck({ type: 'column', data: { columns: ['Quarter', 'Current'], rows: two.rows.map((row) => row.slice(0, 2)) } }), language: 'ar' }, 1, { trace: true });
  const caption = texts(svg).find((entry) => entry.body === 'Current');
  assert.ok(caption, 'outside English the caption is the series part');
  assert.ok(Number(caption.x) > 640, 'at the right');
  checks += 2;
}

// 5. LH-95: the emphasis on every theme x colour scheme x light and dark variant. The last bar takes a stronger shade of the series
// colour (darker on a light backdrop, lighter on a dark one) and the other bars keep the series colour; every bar reaches 3:1 against the
// backdrop and the emphasised bar stands 15 L* from the rest, in all 84 combinations.
{
  const lightness = (hex) => {
    const linear = (channel) => { const n = channel / 255; return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4; };
    const [r, g, b] = [1, 3, 5].map((offset) => linear(Number.parseInt(hex.slice(offset, offset + 2), 16)));
    const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
    return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : 24389 / 27 * y;
  };
  // LH-105: the last point is emphasised only over time, so the categories are quarters.
  const one = { columns: ['Quarter', 'Count'], rows: [['Q1', 120], ['Q2', 64], ['Q3', 31], ['Q4', 12]] };
  let emphasised = 0, shadedBack = 0;
  const plainCharts = [];
  for (const theme of Object.keys(defaultCatalog.themes)) for (const scheme of Object.keys(defaultCatalog.colorSchemes)) for (const variant of ['light1', 'dark1']) {
    const input = deck({ type: 'column', data: one }, { theme, colorScheme: scheme, variant });
    const design = resolvePresentation(input).slides[0].design;
    const backdrop = design.backgroundColor ?? design.colors.background;
    const fills = [...toSvg(input, 1, { trace: true }).matchAll(/<rect\b([^>]*)\/>/g)].map(([, a]) => attributesOf(a)).filter((a) => /^slides\.0\.chart\.data\.rows\.\d\.1$/.test(a['data-opf-path'] ?? '')).map((a) => a.fill.toUpperCase());
    const label = `${theme} ${scheme} ${variant}`;
    assert.equal(fills.length, 4, label);
    if (new Set(fills).size === 1) { plainCharts.push(label); continue; }
    emphasised++;
    const [series, shade] = [fills[0], fills[3]];
    // LH-105: the other bars keep the soft series colour; the emphasised one takes the full-strength colour or a shade of it.
    const palette = chartSeriesPalette(backdrop, design.colorScheme, undefined, { accents: design.roles.map.accents, roles: design.colors, variables: design.variables }, { soften: true });
    assert.equal(series, palette[0].slice(0, 7).toUpperCase(), `${label}: the other bars keep the series colour`);
    assert.ok(fills.slice(0, 3).every((fill) => fill === series), `${label}: one series colour`);
    for (const fill of [series, shade]) assert.ok(colorContrast(fill, backdrop) >= 3 - 1e-9, `${label}: ${fill} on ${backdrop} at 3:1`);
    assert.ok(Math.abs(lightness(shade) - lightness(series)) >= 15 - 1e-9, `${label}: 15 L* between ${shade} and ${series}`);
    const dark = lightness(backdrop) < lightness(series);
    if (dark !== lightness(shade) > lightness(series)) shadedBack++;
  }
  assert.deepEqual(plainCharts, [], 'every combination emphasises the last bar');
  assert.equal(emphasised, Object.keys(defaultCatalog.themes).length * Object.keys(defaultCatalog.colorSchemes).length * 2);
  console.log(`Chart layer emphasis: ${emphasised} of ${emphasised + plainCharts.length} theme x scheme x variant charts emphasise the last bar (${shadedBack} shaded towards the backdrop, the series colour being too close to black or white).`);
  checks += 2;
}

console.log(`Chart layer passed: ${checks} checks (small charts, explicit options, header row, right to left).`);
