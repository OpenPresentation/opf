// LH-107 to LH-110 in the preview: a waterfall's role colors, signed labels and dashed connectors; the value list beside a pie; values
// inside stacked segments with the series named beside the last column; the reference line and period band the title names. Composition
// decides them (core chart-marks.ts); this asserts what the preview draws from them.
import assert from 'node:assert/strict';
import { chartBandColor, chartWaterfallColors } from '@openpresentation/opf/composition';
import { resolvePresentation, toSvg } from './catalog-harness.mjs';

const attributesOf = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const tags = (svg, name) => [...svg.matchAll(new RegExp(`<${name}\\b([^>]*)>`, 'g'))].map(([, a]) => attributesOf(a));
const texts = (svg) => [...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map(([, a, body]) => ({ ...attributesOf(a), body: body.replace(/<[^>]*>/g, '') }));
// A light deck: dark2 reads on it, so the totals take it.
const deck = (slide) => ({ design: { fontScheme: 'roboto', colorScheme: 'cool-horizon', variant: 'light1' }, slides: [slide] });
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
let checks = 0;

// 1. Waterfall: totals in the strong color, gains in the accent, losses in the light context gray; signed labels (U+2212), bold totals;
//    dashed connectors; no value axis tick labels.
{
  const input = deck({ title: 'Price and volume more than offset cost increases', chart: { type: 'waterfall', data: { columns: ['Step', 'Operating profit ($M)'], rows: [['2024 profit', 42], ['Volume', 9.3], ['Price', 6.1], ['Materials', -7.4], ['Labor', -5.2], ['Currency', -2.1], ['2025 profit', 42.7]] } } });
  const svg = toSvg(input, 1, { trace: true });
  const design = resolvePresentation(input).slides[0].design;
  const bar = (row) => tags(svg, 'rect').find((rect) => rect['data-opf-path'] === `slides.0.chart.data.rows.${row}.1`);
  const surface = design.backgroundColor ?? design.colors.background;
  const fills = [0, 1, 3, 6].map((row) => bar(row).fill.toUpperCase());
  assert.equal(fills[0], fills[3], 'the opening and closing totals share a colour');
  assert.equal(fills[0], design.colorScheme.dark2.toUpperCase(), 'totals take dark2');
  assert.notEqual(fills[1], fills[0]);
  assert.notEqual(fills[2], fills[1]);
  const colors = chartWaterfallColors(surface, fills[1], design.colors.text, design.colorScheme.dark2, { labeled: true });
  assert.equal(colors.decrease.toUpperCase(), fills[2], 'losses in the labeled context gray');
  const labels = texts(svg).filter((entry) => /^slides\.0\.chart\.data\.rows\.\d\.1$/.test(entry['data-opf-path'] ?? '')).map((entry) => entry.body);
  for (const expected of ['42', '+9.3', '+6.1', '−7.4', '−5.2', '−2.1', '42.7']) assert.ok(labels.includes(expected), `label ${expected} in ${labels.join(' ')}`);
  assert.ok(texts(svg).some((entry) => entry.body === '42.7' && entry['font-weight'] === '700'), 'a total label is bold');
  assert.ok(texts(svg).some((entry) => entry.body === 'Operating profit ($M)'), 'the caption names the values');
  assert.equal(texts(svg).filter((entry) => entry['data-opf-path'] === 'slides.0.chart' && /^\d+$/.test(entry.body)).length, 0, 'no value axis tick labels');
  assert.ok(tags(svg, 'line').some((line) => line['stroke-dasharray']), 'dashed connectors');
  checks += 6;
}

// 2. A pie in the whole body draws its value list: a swatch per row in the slice color, the name and the value, the focus bold.
{
  const svg = toSvg(deck({ title: 'Enterprise accounts bring 62% of revenue', chart: { type: 'pie', data: { columns: ['Segment', 'Revenue ($M)'], rows: [['Enterprise', 62.4], ['Mid-market', 25.1], ['Small business', 12.5]] } } }), 1, { trace: true });
  const values = texts(svg).filter((entry) => /^slides\.0\.chart\.data\.rows\.\d\.1$/.test(entry['data-opf-path'] ?? ''));
  assert.deepEqual(values.map((entry) => entry.body), ['62.4', '25.1', '12.5']);
  assert.equal(values[0]['font-weight'], '700', 'the focused row is bold');
  assert.ok(texts(svg).some((entry) => entry.body === 'Revenue ($M)'), 'the unit over the values');
  const slice = (row) => tags(svg, 'path').find((path) => path['data-opf-path'] === `slides.0.chart.data.rows.${row}.1`);
  const swatch = (row) => tags(svg, 'rect').find((rect) => rect['data-opf-path'] === `slides.0.chart.data.rows.${row}.0`);
  for (const row of [0, 1, 2]) assert.equal(swatch(row).fill, slice(row).fill, `swatch ${row} in its slice colour`);
  checks += 3;
}

// 3. Stacked columns: values inside, names beside the last column, no legend row.
{
  const svg = toSvg(deck({ title: 'Subscriptions drive the growth in revenue', chart: { type: 'stacked-column', data: { columns: ['Quarter', 'Subscriptions ($M)', 'Services ($M)', 'Hardware ($M)'], rows: [['Q1', 12.1, 8.3, 3.7], ['Q2', 14, 8.6, 4.2], ['Q3', 16.2, 8.9, 4.3], ['Q4', 19.4, 9.1, 4.7]] } } }), 1, { trace: true });
  const inside = texts(svg).filter((entry) => /^slides\.0\.chart\.data\.rows\.\d\.\d$/.test(entry['data-opf-path'] ?? '')).map((entry) => entry.body);
  for (const expected of ['12.1', '8.3', '3.7', '19.4', '9.1', '4.7']) assert.ok(inside.includes(expected), `value ${expected}`);
  const names = texts(svg).filter((entry) => /^slides\.0\.chart\.data\.columns\.\d$/.test(entry['data-opf-path'] ?? ''));
  assert.deepEqual(names.map((entry) => entry.body).sort(), ['Hardware ($M)', 'Services ($M)', 'Subscriptions ($M)']);
  const lastColumn = tags(svg, 'rect').find((rect) => rect['data-opf-path'] === 'slides.0.chart.data.rows.3.1');
  for (const name of names) assert.ok(Number(name.x) > Number(lastColumn.x) + Number(lastColumn.width), `${name.body} beside the last column`);
  checks += 3;
}

// 4. Reference line (dashed, labeled as the title writes it) and period band (under the lines).
{
  const delivery = { type: 'line', data: { columns: ['Month', { name: 'On-time delivery', format: '0.0%' }], rows: months.map((month, i) => [month, [0.934, 0.941, 0.928, 0.952, 0.961, 0.957, 0.944, 0.936, 0.949, 0.968, 0.972, 0.979][i]]) } };
  const svg = toSvg(deck({ title: 'On-time delivery stayed above 92% all year', chart: delivery }), 1, { trace: true });
  assert.ok(texts(svg).some((entry) => entry.body === '92%' && entry['font-weight'] === '700'), 'the line is labeled 92%');
  const dashed = tags(svg, 'line').filter((line) => line['stroke-dasharray'] && line.y1 === line.y2);
  assert.equal(dashed.length, 1, 'one dashed reference line');
  const input = deck({ title: 'Cloud spend overtook on-premises in 2023', chart: { type: 'line', data: { columns: ['Year', 'Cloud ($B)', 'On-premises ($B)'], rows: [['2020', 3.1, 8.4], ['2021', 4.2, 7.9], ['2022', 5.6, 7.3], ['2023', 7.3, 6.5], ['2024', 9.4, 5.6], ['2025', 11.8, 4.8]] } } });
  const banded = toSvg(input, 1, { trace: true });
  const design = resolvePresentation(input).slides[0].design;
  const band = tags(banded, 'rect').find((rect) => rect['data-opf-path'] === 'slides.0.chart.data.rows.3.0');
  assert.ok(band, 'the 2023 band');
  assert.equal(band.fill.toUpperCase(), chartBandColor(design.backgroundColor ?? design.colors.background, design.colors.text).toUpperCase());
  assert.ok(banded.indexOf('data-opf-path="slides.0.chart.data.rows.3.0"') < banded.indexOf('<polyline'), 'the band lies under the lines');
  checks += 4;
}

console.log(`LH-107 to LH-110 preview passed: ${checks} checks; waterfall roles and signed labels, value list, stacked values and names, reference line and band.`);
