// LH-03 and LH-81: the chart layer in the preview. Composition decides a chart's small-chart treatment and header row (core
// chart-layer.ts, ComposedChart.layer); this asserts what the preview draws from it.
import assert from 'node:assert/strict';
import { colorContrast } from '@openpresentation/opf/composition';
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
  // Two series: the legend names them, so the caption is generated from the value axis title only (LH-81 review).
  const plain = toSvg(deck({ type: 'line', data: two, dataLabels: false }), 1, { trace: true });
  assert.ok(!texts(plain).some((entry) => / by /.test(entry.body)), 'no caption that repeats the legend');
  const svg = toSvg(deck({ type: 'line', data: two, dataLabels: false, axisTitles: { value: 'Signal' } }), 1, { trace: true });
  const caption = texts(svg).find((entry) => entry.body === 'Signal by quarter');
  assert.ok(caption, 'the caption, its category in sentence case');
  const legend = texts(svg).filter((entry) => /^slides\.0\.chart\.data\.columns\.\d$/.test(entry['data-opf-path'] ?? ''));
  assert.deepEqual(legend.map((entry) => entry.body), ['Current', 'Baseline']);
  const top = Math.min(...gridlines(svg).map((line) => Number(line.y1)));
  assert.ok(legend.every((entry) => Number(entry.y) < top), 'the legend sits above the plot');
  const side = toSvg(deck({ type: 'line', data: two, dataLabels: false, legend: 'right' }), 1, { trace: true });
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

// 5. The emphasis on every theme x colour scheme x light and dark variant: the quieter bars reach 3:1 against the backdrop and stay
// 15 L* from the emphasised bar, or every bar keeps the series colour.
{
  const lightness = (hex) => {
    const linear = (channel) => { const n = channel / 255; return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4; };
    const [r, g, b] = [1, 3, 5].map((offset) => linear(Number.parseInt(hex.slice(offset, offset + 2), 16)));
    const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
    return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : 24389 / 27 * y;
  };
  const one = { columns: ['Stage', 'Count'], rows: [['Lead', 120], ['Qualified', 64], ['Proposal', 31], ['Won', 12]] };
  let emphasised = 0, plainCharts = 0;
  for (const theme of Object.keys(defaultCatalog.themes)) for (const scheme of Object.keys(defaultCatalog.colorSchemes)) for (const variant of ['light1', 'dark1']) {
    const input = deck({ type: 'column', data: one }, { theme, colorScheme: scheme, variant });
    const design = resolvePresentation(input).slides[0].design;
    const backdrop = design.backgroundColor ?? design.colors.background;
    const fills = [...toSvg(input, 1, { trace: true }).matchAll(/<rect\b([^>]*)\/>/g)].map(([, a]) => attributesOf(a)).filter((a) => /^slides\.0\.chart\.data\.rows\.\d\.1$/.test(a['data-opf-path'] ?? '')).map((a) => a.fill.toUpperCase());
    const label = `${theme} ${scheme} ${variant}`;
    assert.equal(fills.length, 4, label);
    if (new Set(fills).size === 1) { plainCharts++; continue; }
    emphasised++;
    const [muted, accent] = [fills[0], fills[3]];
    assert.ok(fills.slice(0, 3).every((fill) => fill === muted), `${label}: one tint`);
    assert.ok(colorContrast(muted, backdrop) >= 3 - 1e-9, `${label}: tint ${muted} on ${backdrop} at 3:1`);
    assert.ok(Math.abs(lightness(accent) - lightness(muted)) >= 15 - 1e-9, `${label}: 15 L* between ${accent} and ${muted}`);
  }
  assert.ok(emphasised > 0, `${emphasised} emphasised, ${plainCharts} without emphasis`);
  console.log(`Chart layer emphasis: ${emphasised} of ${emphasised + plainCharts} theme x scheme x variant charts emphasise the last bar.`);
  checks += 1;
}

console.log(`Chart layer passed: ${checks} checks (small charts, explicit options, header row, right to left).`);
