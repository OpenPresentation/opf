// LH-59: the preview draws charts the way readers and PowerPoint read them. Horizontal bars list their categories top to bottom in data
// order; a waterfall's last value that equals the running sum before it is a total bar standing on zero; the value axis ends within
// 1.25 x the data maximum (it ran to 500 for a waterfall peaking at 232, and to 30 for bars peaking at 23).
import assert from 'node:assert/strict';
import { resolvePresentation, toSvg } from '../dist/svg.js';

const attributes = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const texts = (svg) => [...svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)].map(([, a, content]) => ({ ...attributes(a), content }));
const rects = (svg) => [...svg.matchAll(/<rect\b([^>]*)\/?>/g)].map(([, a]) => attributes(a));
const render = (chart, slide = {}) => toSvg({ slides: [{ title: 'Chart', chart, ...slide }] }, 1, { trace: true });
const quarters = { columns: ['Quarter', 'Current', 'Baseline'], rows: [['Q1', 12, 9], ['Q2', 16, 11], ['Q3', 19, 13], ['Q4', 23, 15]] };
// The value-axis end, read from the drawing: the value axis line spans the plot, and the 0 tick and one other tick label give the
// scale (an end need not be a labelled tick).
const AXIS = resolvePresentation({ slides: [{ chart: { type: 'column', data: quarters } }] }).slides[0].design.roles.neutrals.axisLine.hex;
function axisEnd(svg, path, horizontal) {
  const lines = [...svg.matchAll(/<line\b([^>]*)\/>/g)].map(([, a]) => attributes(a)).filter((line) => line.stroke === AXIS).map((line) => Object.fromEntries(['x1', 'y1', 'x2', 'y2'].map((key) => [key, Number(line[key])])));
  const labels = texts(svg).filter((t) => t['data-opf-path'] === path && /^-?[\d.]+$/.test(t.content)).map((t) => ({ value: Number(t.content), at: Number(horizontal ? t.x : t.y) }));
  const zero = labels.find((label) => label.value === 0), other = labels.find((label) => label.value !== 0);
  const perUnit = (other.at - zero.at) / other.value;
  if (horizontal) {
    const base = lines.filter((line) => line.y1 === line.y2).sort((a, b) => b.y1 - a.y1)[0];
    return { ticks: labels.map((label) => label.value), end: (base.x2 - base.x1) / perUnit };
  }
  const side = lines.filter((line) => line.x1 === line.x2).sort((a, b) => a.x1 - b.x1)[0];
  return { ticks: labels.map((label) => label.value), end: (side.y1 - side.y2) / perUnit };
}
let checks = 0;

// 1. Horizontal bars: the category labels and the bars run top to bottom in data order, the first series at the top of its cluster.
for (const type of ['bar', 'stacked-bar', '100pct-stacked-bar']) {
  const svg = render({ type, data: quarters });
  const labels = texts(svg).filter((t) => /chart\.data\.rows\.\d\.0$/.test(t['data-opf-path'] ?? ''));
  assert.deepEqual(labels.sort((a, b) => Number(a.y) - Number(b.y)).map((t) => t.content), ['Q1', 'Q2', 'Q3', 'Q4'], `${type}: categories top to bottom`);
  const bar = (row, column) => rects(svg).find((r) => r['data-opf-path'] === `slides.0.chart.data.rows.${row}.${column}`);
  for (let row = 1; row < 4; row++) assert.ok(Number(bar(row, 1).y) > Number(bar(row - 1, 1).y), `${type}: row ${row} below row ${row - 1}`);
  if (type === 'bar') assert.ok(Number(bar(0, 1).y) < Number(bar(0, 2).y), 'bar: the first series at the top of its cluster');
  // The bar sits beside its label.
  const label = labels.find((t) => t.content === 'Q1'), first = bar(0, 1);
  assert.ok(Number(label.y) > Number(first.y) - 40 && Number(label.y) < Number(first.y) + 60, `${type}: Q1's bar beside its label`);
  checks++;
}

// 2. Waterfall: Start 100, +24, -8, End 116. The end equals the running sum, so it is a total bar from zero, and its top meets the
//    connector from the step before it. LH-107: the start it runs from is a total too, both in the strong colour, the increase in the
//    accent and the decrease in the context gray. (Without labels the value axis stays, so its end can be read.)
{
  const svg = render({ type: 'waterfall', dataLabels: false, data: { columns: ['Step', 'Value'], rows: [['Start', 100], ['Expansion', 24], ['Churn', -8], ['End', 116]] } });
  const bar = (row) => rects(svg).find((r) => r['data-opf-path'] === `slides.0.chart.data.rows.${row}.1`);
  const [start, expansion, churn, end] = [0, 1, 2, 3].map(bar);
  const bottom = (r) => Number(r.y) + Number(r.height);
  assert.ok(Math.abs(bottom(start) - bottom(end)) < 0.01, 'the total stands on zero, like the first step');
  assert.ok(Math.abs(Number(end.height) - Number(start.height) * 1.16) < 0.05, 'the total is 116 tall, not stacked on the running total');
  assert.ok(Math.abs(Number(churn.y) + Number(churn.height) - Number(end.y)) < 0.05, 'the total reaches the running total after the last step');
  assert.equal(end.fill, start.fill, 'the opening and closing totals share the strong colour');
  assert.notEqual(end.fill, expansion.fill, 'the total has its own colour');
  assert.notEqual(end.fill, churn.fill, 'the total is not coloured as a decrease');
  assert.notEqual(expansion.fill, churn.fill, 'an increase and a decrease differ');
  const { end: axisMax } = axisEnd(svg, 'slides.0.chart', false);
  assert.ok(axisMax >= 124 - 0.5 && axisMax <= 124 * 1.25 + 0.5, `the axis ends near the peak of 124, not at 250 or 500 (${axisMax})`);
  checks++;
}
// A waterfall whose last value is not the running sum keeps it as a step.
{
  const svg = render({ type: 'waterfall', data: { columns: ['Quarter', 'Value'], rows: [['Q1', 23], ['Q2', 27], ['Q3', 30], ['Q4', 34]] } });
  const bar = (row) => rects(svg).find((r) => r['data-opf-path'] === `slides.0.chart.data.rows.${row}.1`);
  assert.ok(Math.abs(Number(bar(3).y) + Number(bar(3).height) - Number(bar(2).y)) < 0.05, 'Q4 floats from the running total');
  assert.equal(bar(3).fill, bar(0).fill, 'a step keeps the increase colour');
  checks++;
}

// 3. The value axis ends within 1.25 x the data maximum in large and small chart boxes, for every axis-bearing type.
const peaks = { column: 23, bar: 23, 'stacked-column': 38, line: 23, area: 23, waterfall: 70, histogram: 23 };
const shapes = {
  full: (chart) => ({ title: 'Chart', chart }),
  beside: (chart) => ({ title: 'Chart', bullets: ['One', 'Two', 'Three', 'Four', 'Five'], chart, composition: { mode: 'column' } }),
  dashboard: (chart) => ({ title: 'Chart', layout: 'dashboard', blocks: [{ chart }, { metric: { value: '42', label: 'Signal' } }, { chart: { type: 'pie', data: quarters } }, { metric: { value: '91%', label: 'Signal' } }, { chart: { type: 'pie', data: quarters } }] }),
};
for (const [type, peak] of Object.entries(peaks)) {
  for (const [shape, slide] of Object.entries(shapes)) {
    // LH-03: `dataLabels: false` keeps the value axis of the small column, bar and line charts, whose end this measures.
    const svg = toSvg({ slides: [slide({ type, data: quarters, dataLabels: false })] }, 1, { trace: true });
    const { ticks: drawn, end } = axisEnd(svg, shape === 'dashboard' ? 'slides.0.blocks.0.chart' : 'slides.0.chart', type === 'bar');
    assert.ok(end >= peak - 0.5 && end <= peak * 1.25 + 0.5, `${type} (${shape}): the axis ends at ${end.toFixed(2)} for data peaking at ${peak} (ticks ${drawn.join(', ')})`);
    checks++;
  }
}

console.log(`Chart correctness passed: ${checks} checks; bars read top to bottom, a waterfall total stands on zero, axes end within 1.25 x the data.`);
