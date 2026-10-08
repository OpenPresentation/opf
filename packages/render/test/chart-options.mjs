import assert from 'node:assert/strict';
import {renderSlideSvg} from './catalog-harness.mjs'; // FA-23: registers the gallery snapshot (the documents name gallery records)
import { CHART_TYPES } from '../src/charts.js';

// RR-35: chart options (axis titles, legend position, data labels) in the preview. Core owns the support table
// (resolveChartOptions); these tests assert what the preview draws from it, and that a chart without the fields is untouched.

const attributesOf = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const data = { columns: ['Quarter', 'North', 'South'], rows: [['Q1', 10, 5], ['Q2', 20, 8], ['Q3', 15, 12], ['Q4', 22, 9]] };
const deck = (chart, extra = {}) => ({ design: { fontScheme: 'roboto' }, slides: [{ title: 'Chart', chart: { type: 'column', data, ...chart }, ...extra }] });
const render = (chart, options = {}) => renderSlideSvg(deck(chart), 0, { trace: true, ...options });

// The text groups of the chart: path, text and the first <text> element's position.
function texts(svg, prefix = 'slides.0.chart') {
  return [...svg.matchAll(/<g\b([^>]*data-opf-source-text="true"[^>]*)>([\s\S]*?)<\/g>/g)]
    .map(([whole, attrs, body]) => ({ whole, path: attributesOf(attrs)['data-opf-path'], body }))
    .filter((group) => group.path === prefix || group.path.startsWith(`${prefix}.`))
    .map((group) => {
      const element = /<text\b([^>]*)>/.exec(group.body);
      const position = element ? attributesOf(element[1]) : {};
      return { path: group.path, text: [...group.body.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map(([, text]) => text).join(''), x: Number(position.x), y: Number(position.y), whole: group.whole };
    });
}
const byPath = (svg, path) => texts(svg).filter((entry) => entry.path === path);
const plotExtent = (svg) => {
  const lines = [...svg.matchAll(/<line\b([^>]*)\/>/g)].map(([, a]) => attributesOf(a)).filter((l) => l['stroke-opacity'] === '0.7');
  const xs = lines.flatMap((l) => [Number(l.x1), Number(l.x2)]), ys = lines.flatMap((l) => [Number(l.y1), Number(l.y2)]);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
};

// 1. Decks without the fields are byte-identical to the same chart with inert option values.
for (const id of Object.keys(CHART_TYPES)) {
  const plain = renderSlideSvg(deck({ type: id }), 0, { trace: true });
  assert.equal(renderSlideSvg(deck({ type: id, axisTitles: {} }), 0, { trace: true }), plain, `${id}: empty axisTitles change nothing`);
  // dataLabels false is inert except where a construct labels its marks by default (funnel, treemap), asserted below.
  if (id !== 'funnel' && id !== 'treemap') assert.equal(renderSlideSvg(deck({ type: id, dataLabels: false }), 0, { trace: true }), plain, `${id}: dataLabels false changes nothing`);
  assert.doesNotMatch(plain, /axisTitles|dataLabels/, `${id}: no option paths in a plain chart`);
}
// ... and a funnel or treemap keeps its default labels unless dataLabels says otherwise.
for (const type of ['funnel', 'treemap']) {
  const plain = render({ type });
  const none = render({ type, dataLabels: false });
  const withValues = render({ type, dataLabels: { content: ['value'] } });
  assert.notEqual(none, plain, `${type}: dataLabels false removes the default labels`);
  assert.ok(texts(plain).length > texts(none).length, `${type}: default labels are drawn without the option`);
  assert.ok(texts(withValues).some((entry) => /^\d+$/.test(entry.text)), `${type}: value labels`);
}

// 2. Legend positions. A two-series column chart draws a right legend by default.
{
  const names = (svg) => texts(svg).filter((entry) => /^slides\.0\.chart\.data\.columns\.\d$/.test(entry.path));
  const base = render({});
  const baseExtent = plotExtent(base);
  assert.equal(names(base).length, 2, 'default: two legend entries');
  assert.ok(names(base).every((entry) => entry.x > baseExtent.right - 20), 'default legend sits right of the plot');

  const right = render({ legend: 'right' });
  assert.equal(right, base, 'legend right is the default position, byte for byte');
  const left = render({ legend: 'left' }), leftExtent = plotExtent(left);
  assert.ok(names(left).every((entry) => entry.x < leftExtent.left), 'legend left sits left of the plot');
  const top = render({ legend: 'top' }), topExtent = plotExtent(top);
  assert.ok(names(top).every((entry) => entry.y < topExtent.top), 'legend top sits above the plot');
  const bottom = render({ legend: 'bottom' }), bottomExtent = plotExtent(bottom);
  assert.ok(names(bottom).every((entry) => entry.y > bottomExtent.bottom), 'legend bottom sits below the plot');
  assert.equal(new Set(names(top).map((entry) => entry.y)).size, 1, 'top legend entries share a row');
  assert.ok(names(top)[0].x < names(top)[1].x, 'top legend entries run left to right');
  const none = render({ legend: 'none' });
  assert.equal(names(none).length, 0, 'legend none draws no legend');
  assert.ok(plotExtent(none).right > baseExtent.right, 'legend none gives the plot the legend space back');
  for (const [position, extent] of [['top', topExtent], ['bottom', bottomExtent]]) {
    assert.ok(extent.bottom - extent.top < baseExtent.bottom - baseExtent.top + 1, `${position}: the plot shrinks vertically`);
    assert.ok(extent.right > baseExtent.right, `${position}: the plot gains the right legend width`);
  }
  // A single-series chart has no legend by default; a named position shows it.
  const single = { type: 'column', data: { columns: ['Quarter', 'Revenue'], rows: [['Q1', 1], ['Q2', 2]] } };
  assert.equal(names(render(single)).length, 0);
  assert.equal(names(render({ ...single, legend: 'bottom' })).length, 1, 'a named position shows a single-series legend');
  // Pie legends list the categories wherever they sit.
  const pie = render({ type: 'pie', legend: 'bottom' });
  assert.equal(texts(pie).filter((entry) => /\.data\.rows\.\d\.0$/.test(entry.path)).length, 4, 'pie legend entries are the categories');
}

// 3. Axis titles.
{
  const svg = render({ axisTitles: { category: 'Quarter', value: 'Revenue ($M)' } });
  const category = byPath(svg, 'slides.0.chart.axisTitles.category')[0], value = byPath(svg, 'slides.0.chart.axisTitles.value')[0];
  assert.equal(category.text, 'Quarter');
  assert.equal(value.text, 'Revenue ($M)');
  assert.match(value.whole, /./);
  assert.match(svg, /<g transform="rotate\(-90 [\d.]+ [\d.]+\)"><g\b[^>]*data-opf-path="slides\.0\.chart\.axisTitles\.value"/, 'the value title is turned 270 degrees');
  assert.doesNotMatch(svg, /<g transform="rotate\(-90[^>]*><g\b[^>]*axisTitles\.category/, 'the category title stays horizontal');
  const extent = plotExtent(svg), base = plotExtent(render({}));
  assert.ok(category.y > extent.bottom, 'the category title sits under the plot');
  assert.ok(extent.left > base.left && extent.bottom < base.bottom, 'the plot shrinks for the titles');
  // A bar chart's category axis is the vertical one.
  const bar = render({ type: 'bar', axisTitles: { category: 'Quarter', value: 'Revenue' } });
  assert.match(bar, /rotate\(-90 [\d.]+ [\d.]+\)"><g\b[^>]*axisTitles\.category/, 'bar: the category title is the rotated, left one');
  const barValue = byPath(bar, 'slides.0.chart.axisTitles.value')[0];
  assert.ok(barValue.y > plotExtent(bar).bottom, 'bar: the value title sits under the plot');
  // Scatter: category is X, value is Y.
  const scatter = render({ type: 'scatter', axisTitles: { category: 'X axis', value: 'Y axis' } });
  assert.equal(byPath(scatter, 'slides.0.chart.axisTitles.category')[0].text, 'X axis');
  assert.match(scatter, /rotate\(-90 [\d.]+ [\d.]+\)"><g\b[^>]*axisTitles\.value/, 'scatter: Y title is rotated');
  // Chartex constructs with axes.
  for (const type of ['histogram', 'pareto', 'waterfall', 'box-and-whisker']) {
    const svgx = render({ type, axisTitles: { category: 'Cat', value: 'Val' } });
    assert.equal(byPath(svgx, 'slides.0.chart.axisTitles.category')[0]?.text, 'Cat', `${type}: category title`);
    assert.equal(byPath(svgx, 'slides.0.chart.axisTitles.value')[0]?.text, 'Val', `${type}: value title`);
  }
  const funnel = render({ type: 'funnel', axisTitles: { category: 'Stage', value: 'Count' } });
  assert.equal(byPath(funnel, 'slides.0.chart.axisTitles.category')[0]?.text, 'Stage');
  assert.equal(byPath(funnel, 'slides.0.chart.axisTitles.value').length, 0, 'funnel has no drawn value axis to title');
}

// 4. Unsupported options are adapted with a diagnostic, never silently.
{
  const diagnostics = [];
  const svg = renderSlideSvg(deck({ type: 'pie', axisTitles: { value: 'Revenue' }, dataLabels: { position: 'above' } }), 0, { trace: true, onDiagnostic: (d) => diagnostics.push(d) });
  assert.equal(byPath(svg, 'slides.0.chart.axisTitles.value').length, 0, 'a pie draws no axis title');
  assert.deepEqual(diagnostics.filter((d) => d.code === 'chart-option-adapted').map((d) => d.option).sort(), ['axisTitles.value', 'dataLabels.position']);
  assert.ok(diagnostics.every((d) => typeof d.path === 'string' && d.path.startsWith('slides.0.chart')), 'diagnostics carry the chart path');
}

// 5. Data labels.
{
  const labelPaths = (svg) => texts(svg).filter((entry) => /^slides\.0\.chart\.data\.rows\.\d\.[1-9]$/.test(entry.path));
  const values = labelPaths(render({ dataLabels: true }));
  assert.equal(values.length, 8, 'one label per column');
  assert.deepEqual(values.map((entry) => entry.text).sort(), ['10', '12', '15', '20', '22', '5', '8', '9'].sort());
  // Default clustered column position: outside the end, above the bar.
  const bars = [...render({ dataLabels: true }).matchAll(/<rect\b([^>]*)\/>/g)].map(([, a]) => attributesOf(a)).filter((r) => r['data-opf-path'] === 'slides.0.chart.data.rows.1.1');
  assert.equal(bars.length, 1);
  const label = labelPaths(render({ dataLabels: true })).find((entry) => entry.path === 'slides.0.chart.data.rows.1.1');
  assert.equal(label.text, '20');
  assert.ok(label.y < Number(bars[0].y), 'outside-end: the label is above the column');
  const inside = labelPaths(render({ dataLabels: { position: 'inside-end' } })).find((entry) => entry.path === 'slides.0.chart.data.rows.1.1');
  assert.ok(inside.y > Number(bars[0].y) - 1, 'inside-end: the label is within the column');
  const center = labelPaths(render({ dataLabels: { position: 'center' } })).find((entry) => entry.path === 'slides.0.chart.data.rows.1.1');
  assert.ok(center.y > inside.y, 'center sits below inside-end');
  const base = labelPaths(render({ dataLabels: { position: 'inside-base' } })).find((entry) => entry.path === 'slides.0.chart.data.rows.1.1');
  assert.ok(base.y > center.y, 'inside-base sits lowest');
  // Content, order and separator.
  const mixed = labelPaths(render({ dataLabels: { content: ['value', 'category'], separator: ' | ' } }));
  assert.ok(mixed.some((entry) => entry.text === 'Q2 | 20'), 'category then value, joined by the separator');
  // Stacked column: an unsupported position falls back to center and reports.
  const diagnostics = [];
  renderSlideSvg(deck({ type: 'stacked-column', dataLabels: { position: 'outside-end' } }), 0, { trace: true, onDiagnostic: (d) => diagnostics.push(d) });
  assert.deepEqual(diagnostics.filter((d) => d.code === 'chart-option-adapted').map((d) => d.option), ['dataLabels.position']);
  // Pie: percent and category.
  const pie = texts(render({ type: 'pie', dataLabels: { content: ['category', 'percent'] } })).filter((entry) => /\.data\.rows\.\d\.1$/.test(entry.path));
  assert.deepEqual(pie.map((entry) => entry.text), ['Q1, 15%', 'Q2, 30%', 'Q3, 22%', 'Q4, 33%']);
  // Line, scatter, area, radar, doughnut: one label per point, number format General.
  for (const type of ['line', 'line-with-markers', 'stacked-area', 'radar', 'doughnut', 'scatter', 'waterfall', 'histogram']) {
    const count = labelPaths(render({ type, dataLabels: true })).length + texts(render({ type, dataLabels: true })).filter((entry) => /\.data\.rows\.\d\.1$/.test(entry.path) && type === 'doughnut').length;
    assert.ok(count > 0, `${type}: draws data labels`);
  }
  assert.equal(labelPaths(render({ type: 'line', dataLabels: true })).length, 8, 'line: one label per point');
  assert.equal(labelPaths(render({ type: 'radar', dataLabels: true })).length, 8, 'radar: one label per point');
  assert.equal(labelPaths(render({ type: 'scatter', dataLabels: true })).length, 4, 'scatter: one label per point (X from the first value column, one Y series)');
  // Negative values: outside-end goes below the bar.
  const negative = { type: 'column', data: { columns: ['Quarter', 'Delta'], rows: [['Q1', -4], ['Q2', 6]] }, dataLabels: true };
  const negSvg = render(negative);
  const negBar = [...negSvg.matchAll(/<rect\b([^>]*)\/>/g)].map(([, a]) => attributesOf(a)).find((r) => r['data-opf-path'] === 'slides.0.chart.data.rows.0.1');
  const negLabel = texts(negSvg).find((entry) => entry.path === 'slides.0.chart.data.rows.0.1');
  assert.equal(negLabel.text, '-4');
  assert.ok(negLabel.y > Number(negBar.y) + Number(negBar.height) - 1, 'a negative column labels below its end');
}

// 6. Determinism and no mutation.
{
  const input = deck({ axisTitles: { category: 'Quarter', value: 'Revenue' }, legend: 'top', dataLabels: { content: ['category', 'value'] } });
  const before = JSON.stringify(input);
  const first = renderSlideSvg(input, 0, { trace: true });
  assert.equal(renderSlideSvg(input, 0, { trace: true }), first, 'deterministic bytes');
  assert.equal(JSON.stringify(input), before, 'the authored source is not mutated');
  assert.doesNotMatch(first, /NaN|Infinity|undefined/, 'finite output');
}

console.log('Chart options: inert options leave every chart type byte-identical; legend positions, axis titles and data labels draw where the support table says.');
