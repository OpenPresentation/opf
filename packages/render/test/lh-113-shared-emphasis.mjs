// LH-113, LH-115: shared emphasis and row alignment, in the preview. Composition decides them (core chart-focus.ts, chart-rows.ts,
// `ComposedItem.tableHighlight`, `ChartLayer.rows`); this asserts what the preview draws from them.
import assert from 'node:assert/strict';
import { tableHighlightColor } from '@openpresentation/opf/composition';
import { resolvePresentation, toSvg } from './catalog-harness.mjs';

const attributesOf = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const tags = (svg, name) => [...svg.matchAll(new RegExp(`<${name}\\b([^>]*)>`, 'g'))].map(([, a]) => attributesOf(a));
const deck = (slide, design = {}) => ({ design: { fontScheme: 'roboto', ...design }, slides: [slide] });
const pricing = { columns: ['Region', 'Our price', 'Change'], rows: [['Northeast', '$42', 'Hold'], ['Southeast', '$38', '+3%'], ['Southwest', '$36', '+3%']] };
let checks = 0;

// 1. Highlighted rows draw on the accent tint of the surface; the other body rows keep the surface; light and dark.
for (const design of [{}, { theme: 'classic', variant: 'dark1' }]) {
  for (const table of [{ ...pricing, highlight: { rows: ['Southeast', 'Southwest'] } }, pricing]) {
    const input = deck({ title: 'Regional pricing review', blocks: [{ text: 'Prices rise 3% in the two regions where we trail competitors.' }, { table }] }, design);
    const svg = toSvg(input, 1, { trace: true }), colors = resolvePresentation(input).slides[0].design.colors;
    const fill = (row, column = 0) => tags(svg, 'rect').find((rect) => rect['data-opf-path'] === `slides.0.blocks.1.table.rows.${row}.${column}`)?.fill.toUpperCase();
    const tint = tableHighlightColor(colors.surface, colors.primary, colors.text).toUpperCase();
    assert.equal(fill(0), colors.surface.toUpperCase(), 'a plain row keeps the surface');
    assert.deepEqual([fill(1), fill(2), fill(2, 2)], [tint, tint, tint], `the highlighted rows (${table.highlight ? 'authored' : 'from the text'})`);
    checks += 2;
  }
}

// 2. Bars beside a table of the same keys: each bar's middle is its key's row middle.
{
  const warranty = { columns: ['Product line', 'Claims per 1,000', 'Main cause'], rows: [['Controllers', 24, 'Firmware faults'], ['Pumps', 18, 'Seal wear'], ['Valves', 11, 'Corrosion'], ['Sensors', 7, 'Calibration drift']] };
  const bars = { type: 'bar', data: { columns: ['Product line', 'Cost ($K)'], rows: [['Controllers', 7.4], ['Pumps', 3.3], ['Valves', 1.3], ['Sensors', 0.7]] }, alt: 'Controllers cost the most in warranty claims.' };
  const input = deck({ title: 'Warranty claims by product line', blocks: [{ chart: bars }, { table: warranty }] });
  const svg = toSvg(input, 1, { trace: true });
  const middles = [0, 1, 2, 3].map((row) => { const rect = tags(svg, 'rect').find((entry) => entry['data-opf-path'] === `slides.0.blocks.0.chart.data.rows.${row}.1`); return Number(rect.y) + Number(rect.height) / 2; });
  const keys = [0, 1, 2, 3].map((row) => { const text = tags(svg, 'text').find((entry) => entry['data-opf-path'] === `slides.0.blocks.1.table.rows.${row}.0`); return Number(text.y); });
  // The key's text baseline sits a little under its line's middle (the bar's middle).
  for (const [index, middle] of middles.entries()) assert.ok(keys[index] - middle > 0 && keys[index] - middle < 14, `bar ${index} at ${middle}, key baseline at ${keys[index]}`);
  checks += 1;
}

// 3. A timeline under its column chart: one marker under each column.
{
  const ramp = { type: 'column', data: { columns: ['Quarter', 'Headcount'], rows: [['Q1', 12], ['Q2', 52], ['Q3', 104], ['Q4', 150]] } };
  const events = [{ when: 'Q1', what: 'Site lease signed' }, { when: 'Q2', what: 'First 40 hires start' }, { when: 'Q3', what: 'Training center opens' }, { when: 'Q4', what: 'Full staffing reached' }];
  for (const language of ['en', 'ar']) {
    const svg = toSvg({ ...deck({ title: 'Hiring ramp', blocks: [{ timeline: events }, { chart: ramp }] }), language }, 1, { trace: true });
    const columns = [0, 1, 2, 3].map((row) => { const rect = tags(svg, 'rect').find((entry) => entry['data-opf-path'] === `slides.0.blocks.1.chart.data.rows.${row}.1`); return Number(rect.x) + Number(rect.width) / 2; });
    const markers = [0, 1, 2, 3].map((index) => { const mark = [...tags(svg, 'circle'), ...tags(svg, 'ellipse')].find((entry) => entry['data-opf-path'] === `slides.0.blocks.0.timeline.${index}`); return Number(mark.cx); });
    for (const [index, x] of markers.entries()) assert.ok(Math.abs(x - columns[index]) < 1.5, `${language} event ${index}: ${x} vs ${columns[index]}`);
    checks += 1;
  }
}

console.log(`lh-113-shared-emphasis: ${checks} checks passed`);
