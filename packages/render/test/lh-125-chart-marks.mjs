// LH-125 in the preview: horizontal stacked bars (values inside, the series named in a row above the plot, the plot where core pinned it), a
// stacked area that runs edge to edge with its end values, a doughnut's hole value, and the waterfall connectors in the dash PowerPoint draws.
// Composition decides them (core chart-marks.ts); this asserts what the preview draws from them.
import assert from 'node:assert/strict';
import { toSvg } from './catalog-harness.mjs';

const attributesOf = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const tags = (svg, name) => [...svg.matchAll(new RegExp(`<${name}\\b([^>]*)>`, 'g'))].map(([, a]) => attributesOf(a));
const texts = (svg) => [...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map(([, a, body]) => ({ ...attributesOf(a), body: body.replace(/<[^>]*>/g, '') }));
const deck = (slide) => ({ design: { fontScheme: 'roboto', colorScheme: 'cool-horizon', variant: 'light1' }, slides: [slide] });
let checks = 0;

// 1. A horizontal stacked bar chart: the plot is core's (the first bar's segments start where the names say), the values are inside the
//    segments, the names stand above and no legend swatch row is drawn.
{
  const input = deck({ title: 'Self-service carries most requests in every region', chart: { type: 'stacked-bar', data: { columns: ['Region', 'Self-service', 'Chat', 'Phone'],
    rows: [['North America', 5400, 2100, 900], ['Europe', 4600, 2300, 1300], ['Asia Pacific', 3900, 2800, 1100]] } } });
  const svg = toSvg(input, 1, { trace: true });
  const segment = (series) => tags(svg, 'rect').find((rect) => rect['data-opf-path'] === `slides.0.chart.data.rows.0.${series}`);
  const swatch = (series) => tags(svg, 'rect').find((rect) => rect['data-opf-path'] === `slides.0.chart.data.columns.${series}` && Number(rect.width) < 20);
  for (const series of [1, 2, 3]) assert.ok(Math.abs(Number(segment(series).x) - Number(swatch(series).x)) < 0.6, `the series ${series} name starts where its segment of the first bar starts`);
  assert.ok(Number(swatch(1).y) < Number(segment(1).y), 'the names stand above the first bar');
  assert.ok(texts(svg).some((entry) => entry.body === 'Chat'));
  const values = texts(svg).filter((entry) => /^slides\.0\.chart\.data\.rows\.\d\.\d$/.test(entry['data-opf-path'] ?? '')).map((entry) => entry.body);
  for (const expected of ['5400', '2100', '4600']) assert.ok(values.includes(expected), `value ${expected}`);
  checks += 6;
}

// 2. A stacked area runs edge to edge: the first point at the plot's start, the last at its end, the end values inside the band.
{
  const input = deck({ title: 'Mobile now carries most of the traffic', chart: { type: 'stacked-area', data: { columns: ['Month', 'Mobile', 'Desktop'],
    rows: [['Jan', 310, 290], ['Feb', 342, 284], ['Mar', 381, 279], ['Apr', 420, 271], ['May', 462, 266], ['Jun', 503, 258]] } } });
  const svg = toSvg(input, 1, { trace: true });
  const path = tags(svg, 'path').find((entry) => entry['data-opf-path'] === 'slides.0.chart.data.columns.1');
  const xs = [...path.d.matchAll(/[ML] ([\d.]+) [\d.]+/g)].map((match) => Number(match[1]));
  const left = Math.min(...xs), right = Math.max(...xs);
  const labels = texts(svg).filter((entry) => ['310', '503', '290', '258'].includes(entry.body));
  assert.equal(labels.length, 4, 'the four end values are drawn');
  const start = labels.find((entry) => entry.body === '310'), end = labels.find((entry) => entry.body === '503');
  assert.ok(Number(start.x) >= left - 1 && Number(start.x) < left + 60, `the first value stands at the plot's start (${start.x} vs ${left})`);
  assert.ok(Number(end.x) <= right + 60 && Number(end.x) > right - 80, `the last value ends at the plot's end (${end.x} vs ${right})`);
  const jan = texts(svg).find((entry) => entry.body === 'Jan');
  assert.ok(jan && Math.abs(Number(jan.x) + 0 - left) < 40, 'the first category is labeled at the start of the plot');
  checks += 4;
}

// 3. A doughnut prints the focused slice's value large in its hole.
{
  const svg = toSvg(deck({ title: 'Two in three tickets are resolved on first contact', chart: { type: 'doughnut', data: { columns: ['Outcome', 'Tickets'],
    rows: [['Resolved on first contact', 6240], ['Resolved after follow-up', 2180], ['Escalated', 890], ['Unresolved', 310]] } } }), 1, { trace: true });
  const values = texts(svg).filter((entry) => entry.body === '6240');
  assert.equal(values.length, 2, 'the value is in the list and in the hole');
  const sizes = values.map((entry) => Number(entry['font-size']));
  assert.ok(Math.max(...sizes) >= Math.min(...sizes) * 1.8, `the hole value is larger (${sizes.join(', ')})`);
  checks += 2;
}

// 4. Waterfall connectors: dashed 4 on and 3 off in line widths, as PowerPoint's dash draws them.
{
  const svg = toSvg(deck({ title: 'Price and volume more than offset cost increases', chart: { type: 'waterfall', data: { columns: ['Step', 'Operating profit ($M)'],
    rows: [['2024 profit', 42], ['Volume', 9.3], ['Price', 6.1], ['Materials', -7.4], ['2025 profit', 50]] } } }), 1, { trace: true });
  const dashed = tags(svg, 'line').filter((line) => line['stroke-dasharray'] && line.y1 === line.y2);
  assert.equal(dashed.length, 4, 'a connector between each pair of bars');
  const [on, off] = dashed[0]['stroke-dasharray'].split(' ').map(Number), width = Number(dashed[0]['stroke-width']);
  assert.ok(Math.abs(on / width - 4) < 0.05 && Math.abs(off / width - 3) < 0.05, `4:3 dash (${dashed[0]['stroke-dasharray']} at ${width})`);
  checks += 2;
}

// 5. LH-115: a stacked bar chart beside a table of the same keys keeps its bars on the table's rows: no names row and no pinned plot, the header
//    legend stays, and the segment values that fit are printed.
{
  const svg = toSvg(deck({ title: 'Energy use by building type', blocks: [
    { chart: { type: 'stacked-bar', data: { columns: ['Building type', 'Electricity', 'Gas'], rows: [['Office', 12, 6], ['Lab', 30, 12], ['Warehouse', 7, 4], ['Retail', 16, 9]] } } },
    { table: { columns: ['Building', 'Floor area (sq ft)', 'Annual use (GWh)'], rows: [['Office', '320,000', '5.8'], ['Lab', '90,000', '3.8'], ['Warehouse', '410,000', '4.5'], ['Retail', '180,000', '4.5']] } }] }), 1, { trace: true });
  const entries = texts(svg);
  const middle = (entry) => Number(entry.y);
  const chartLabel = (name) => entries.find((entry) => entry.body === name && /^slides\.0\.(?:blocks\.0\.)?chart/.test(entry['data-opf-path'] ?? ''));
  const tableCell = (name) => entries.find((entry) => entry.body === name && /table/.test(entry['data-opf-path'] ?? ''));
  for (const name of ['Office', 'Lab', 'Warehouse', 'Retail']) assert.ok(Math.abs(middle(chartLabel(name)) - middle(tableCell(name))) < 4, `${name}: the bar stands on its table row`);
  const swatches = tags(svg, 'rect').filter((rect) => /chart\.data\.columns\.(?:\d)$/.test(rect['data-opf-path'] ?? '') && Number(rect.width) < 20);
  const plotTop = Math.min(...tags(svg, 'rect').filter((rect) => /chart\.data\.rows\.0\.1$/.test(rect['data-opf-path'] ?? '')).map((rect) => Number(rect.y)));
  assert.ok(swatches.length === 2 && swatches.every((rect) => Number(rect.y) < plotTop - 20), `the legend swatches are the header legend, not names over the first bar (${JSON.stringify(swatches.map((rect) => [rect.x, rect.y, rect.width]))}, bars from ${plotTop})`);
  assert.ok(entries.some((entry) => entry.body === '12') && entries.some((entry) => entry.body === '30'), 'the values that fit are printed');
  checks += 4;
}

console.log(`LH-125 preview passed: ${checks} checks (stacked bars, edge-to-edge area, doughnut hole, waterfall connectors).`);
