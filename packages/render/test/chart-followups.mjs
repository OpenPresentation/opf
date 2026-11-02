// LH-92 and LH-93 in the preview: the series name on each ring of a nested-ring doughnut, and one plot height across sibling charts
// that share a value axis, drawn where core put it (and, for the chart with the shortest plot, exactly where the preview lays it out on
// its own). LH-95's emphasis is chart-layer.mjs's.
import assert from 'node:assert/strict';
import { colorContrast } from '@openpresentation/opf/composition';
import { resolvePresentation, toSvg } from './catalog-harness.mjs';

const attributesOf = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const texts = (svg) => [...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map(([, a, body]) => ({ ...attributesOf(a), body: body.replace(/<[^>]*>/g, '') }));
let checks = 0;

// 1. LH-92: each ring names its series on its largest slice, alone or before the slice's own label.
{
  const data = { columns: ['Region', 'FY24', 'FY25'], rows: [['North', 40, 35], ['South', 25, 45], ['East', 20, 22], ['West', 15, 13]] };
  const deck = (chart) => ({ design: { fontScheme: 'roboto' }, slides: [{ title: 'Mix', chart }] });
  const plain = texts(toSvg(deck({ type: 'pie', data }), 1, { trace: true }));
  for (const name of ['FY24', 'FY25']) assert.equal(plain.filter((entry) => entry.body === name).length, 1, `${name} names its ring`);
  const labeled = texts(toSvg(deck({ type: 'doughnut', data, dataLabels: { content: ['percent'] } }), 1, { trace: true })).map((entry) => entry.body);
  assert.ok(labeled.includes('FY24, 40%'), 'the inner ring: its name before its largest slice\'s label');
  assert.ok(labeled.includes('FY25, 39%'), 'the outer ring');
  assert.ok(labeled.includes('25%') && !labeled.includes('FY24, 25%'), 'the other slices keep their own label');
  // The name contrasts with its slice.
  const svg = toSvg(deck({ type: 'pie', data }), 1, { trace: true });
  const name = [...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map(([, a, body]) => ({ ...attributesOf(a), body: body.replace(/<[^>]*>/g, '') })).find((entry) => entry.body === 'FY24');
  const slice = [...svg.matchAll(/<path\b([^>]*)\/>/g)].map(([, a]) => attributesOf(a)).find((a) => a['data-opf-path'] === 'slides.0.chart.data.rows.0.1');
  assert.ok(colorContrast(name.fill, slice.fill) >= 4.5, `${name.fill} on ${slice.fill}`);
  // It runs along its ring: North's middle is 72 degrees past 12 o'clock (core's rotation; the PPTX label's custom angle).
  assert.match(svg, /<g transform="rotate\(72 [\d.]+ [\d.]+\)"><g\b[^>]*><text\b[^>]*>FY24<\/text>/);
  checks += 7;
}

// 2. LH-93: sibling charts that share one value axis draw one plot height. The value axis line spans the plot.
{
  const lines = (svg) => [...svg.matchAll(/<line\b([^>]*)\/>/g)].map(([, a]) => attributesOf(a));
  const rows = [['Q1', 28, 25], ['Q2', 32, 27], ['Q3', 35, 29], ['Q4', 39, 31]];
  const long = [['First quarter of the fiscal year', 28, 25], ['Second quarter of the fiscal year', 32, 27], ['Third quarter of the fiscal year', 35, 29], ['Fourth quarter of the fiscal year', 39, 31]];
  const deck = (a, names, language = 'en') => ({ language, design: { fontScheme: 'roboto' }, slides: [{ title: 'Two', blocks: [
    { chart: { type: 'column', data: { columns: ['Quarter', 'Current', 'Baseline'], rows: a.rows ?? rows }, dataLabels: false, ...a.extra } },
    { chart: { type: 'column', data: { columns: ['Quarter', ...names], rows: rows.map((row) => [row[0], row[1] - 10, row[2] - 9]) }, dataLabels: false } }] }] });
  for (const [label, a] of [['category title', { extra: { axisTitles: { category: 'Fiscal quarter' } } }], ['value title', { extra: { axisTitles: { value: 'Revenue ($M)' } } }], ['long categories', { rows: long }], ['plain', { extra: {} }]]) {
    for (const language of ['en', 'ar']) {
      const design = resolvePresentation(deck(a, ['Current', 'Baseline'], language)).slides[0].design;
      const axisColor = design.roles.neutrals.axisLine.hex;
      const valueAxes = (svg) => lines(svg).filter((line) => line.stroke === axisColor && line.x1 === line.x2).map((line) => [Number(line.y1), Number(line.y2)]);
      const shared = valueAxes(toSvg(deck(a, ['Current', 'Baseline'], language), 1, { trace: true }));
      assert.equal(shared.length, 2, `${label} ${language}: two value axes`);
      assert.deepEqual(shared[0], shared[1], `${label} ${language}: one plot height`);
      // The first chart has the shorter plot of the two: drawn in core's box, it is where the preview lays it out on its own (the second
      // chart, another unit, shares nothing).
      const alone = valueAxes(toSvg(deck(a, ['Now', 'Before'], language), 1, { trace: true }));
      if (label !== 'plain') assert.ok(Math.abs(shared[0][1] - alone[0][1]) < 0.02, `${label} ${language}: the baseline of the shorter plot is its own (${shared[0][1]} and ${alone[0][1]})`);
      checks += 3;
    }
  }
}

console.log(`Chart follow-ups passed: ${checks} checks (ring names, one plot height across siblings).`);
