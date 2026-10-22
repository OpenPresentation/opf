import assert from 'node:assert/strict';
import { chartHighlightColors, textColorForFill } from '@openpresentation/opf/composition';
import { toSvg } from './catalog-harness.mjs'; // FA-23: registers the gallery snapshot (the documents name gallery records)
import { CHART_TYPES } from '../src/charts.js';

// FA-14: chart.highlight in the preview. Core resolves the marks (chartHighlightMarks) and the two colours
// (chartHighlightColors); these tests assert what the preview draws from them, and that a chart without a highlight is untouched.

const attributesOf = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const data = { columns: ['Quarter', 'North', 'South'], rows: [['Q1', 10, 5], ['Q2', 20, 8], ['Q3', 15, 12], ['Q4', 22, 9]] };
const scheme = { id: 'cool-horizon', primary: '#C0392B' };
const deck = (chart, design = { colorScheme: scheme }) => ({ design: { fontScheme: 'roboto', ...design }, slides: [{ title: 'Chart', chart: { type: 'column', data, ...chart } }] });
const render = (chart, options = {}, design) => toSvg(deck(chart, design), 1, { trace: true, ...options });

// Every drawn mark of the chart, by trace path: its element name and fill (or stroke for an unfilled line).
function marks(svg) {
  return [...svg.matchAll(/<(rect|circle|path|polyline)\b([^>]*)\/>/g)]
    .map(([, name, attrs]) => ({ name, ...attributesOf(attrs) }))
    .filter((mark) => mark['data-opf-path']?.startsWith('slides.0.chart.data.'))
    .map((mark) => ({ name: mark.name, path: mark['data-opf-path'], color: mark.fill && mark.fill !== 'none' ? mark.fill : mark.stroke, fill: mark.fill, stroke: mark.stroke }));
}
const colorsOf = (svg, pattern) => marks(svg).filter((mark) => pattern.test(mark.path)).map((mark) => mark.color);
const plainFor = (chart) => toSvg(deck(chart), 1, { trace: true });

// The chart panel and text colours the preview computes, so the expected colours come from the same core function.
const surface = toSvg(deck({}), 1, { trace: true }).match(/<rect[^>]*data-opf-path="slides\.0\.chart"[^>]*>/)?.[0].match(/fill="([^"]+)"/)?.[1];
assert.match(surface, /^#[0-9A-Fa-f]{6}$/, 'the chart panel fill');
const expected = chartHighlightColors(surface, '#C0392B', textColorForFill(surface, '#0F172A'));

const HIGHLIGHTABLE = new Set(['bar', 'line', 'area', 'pie', 'doughnut', 'scatter', 'radar']);

// 1. Absent, and an unsupported or empty highlight, leave every chart byte-identical.
for (const id of Object.keys(CHART_TYPES)) {
  const plain = plainFor({ type: id });
  assert.doesNotMatch(plain, /highlight/, `${id}: no highlight paths in a plain chart`);
  if (!HIGHLIGHTABLE.has(CHART_TYPES[id].kind)) assert.equal(toSvg(deck({ type: id, highlight: { series: ['North'], categories: ['Q2'] } }), 1, { trace: true }), plain, `${id}: a construct that cannot highlight draws as it always did`);
}

// 2. Column: series highlight. North is accent, South muted; the legend keys follow.
{
  const svg = render({ highlight: { series: ['North'] } });
  assert.deepEqual([...new Set(colorsOf(svg, /\.data\.rows\.\d\.1$/))], [expected.accent], 'North bars take the accent');
  assert.deepEqual([...new Set(colorsOf(svg, /\.data\.rows\.\d\.2$/))], [expected.muted], 'South bars are muted');
  assert.equal(colorsOf(svg, /\.data\.columns\.1$/)[0], expected.accent, 'the North legend key is the accent');
  assert.equal(colorsOf(svg, /\.data\.columns\.2$/)[0], expected.muted, 'the South legend key is muted');
  assert.equal(expected.accent, '#C0392B', 'the accent is the deck primary when it has the contrast');
  assert.notEqual(svg, plainFor({}), 'a highlight changes the colours');
  // Geometry is untouched: strip every fill and the two renderings are the same.
  const geometry = (text) => text.replace(/fill="#[0-9A-Fa-f]{6}"/g, 'fill=""');
  assert.equal(geometry(svg), geometry(plainFor({})), 'only colours change');
}

// 3. Column: category highlight marks that category's bar in every series; a shared label marks every row; OR with series.
{
  const svg = render({ highlight: { categories: ['Q3'] } });
  for (const row of [0, 1, 3]) for (const column of [1, 2]) assert.equal(colorsOf(svg, new RegExp(`\\.data\\.rows\\.${row}\\.${column}$`))[0], expected.muted, `Q${row + 1} is muted`);
  for (const column of [1, 2]) assert.equal(colorsOf(svg, new RegExp(`\\.data\\.rows\\.2\\.${column}$`))[0], expected.accent, 'Q3 is accent in both series');
  const both = render({ highlight: { series: ['South'], categories: ['Q1'] } });
  assert.equal(colorsOf(both, /\.data\.rows\.0\.1$/)[0], expected.accent, 'Q1 North: its category is named');
  assert.equal(colorsOf(both, /\.data\.rows\.0\.2$/)[0], expected.accent, 'Q1 South: both named');
  assert.equal(colorsOf(both, /\.data\.rows\.1\.2$/)[0], expected.accent, 'Q2 South: its series is named');
  assert.equal(colorsOf(both, /\.data\.rows\.1\.1$/)[0], expected.muted, 'Q2 North: neither named');
}

// 4. A bar chart, a stacked column and a single-series column.
{
  const bar = render({ type: 'bar', highlight: { categories: ['Q2'] } });
  assert.equal(colorsOf(bar, /\.data\.rows\.1\.1$/)[0], expected.accent);
  assert.equal(colorsOf(bar, /\.data\.rows\.0\.1$/)[0], expected.muted);
  const stacked = render({ type: 'stacked-column', highlight: { series: ['South'] } });
  assert.equal(colorsOf(stacked, /\.data\.rows\.2\.2$/)[0], expected.accent);
  assert.equal(colorsOf(stacked, /\.data\.rows\.2\.1$/)[0], expected.muted);
  const single = render({ data: { columns: ['Quarter', 'Revenue'], rows: [['Q1', 1], ['Q2', 5], ['Q3', 2]] }, highlight: { categories: ['Q2'] } });
  assert.deepEqual(colorsOf(single, /\.data\.rows\.\d\.1$/), [expected.muted, expected.accent, expected.muted]);
}

// 5. Data labels on muted marks stay readable: an inside label takes the text colour that contrasts with its mark.
{
  const svg = render({ highlight: { series: ['North'] }, dataLabels: { position: 'center' } });
  const labels = [...svg.matchAll(/<g\b([^>]*data-opf-source-text="true"[^>]*)>([\s\S]*?)<\/g>/g)].map(([, attrs, body]) => ({ path: attributesOf(attrs)['data-opf-path'], fill: /<text\b[^>]*fill="([^"]+)"/.exec(body)?.[1] }));
  const label = (path) => labels.find((entry) => entry.path === path)?.fill;
  assert.equal(label('slides.0.chart.data.rows.1.2'), textColorForFill(expected.muted, textColorForFill(surface, '#0F172A')).toUpperCase().replace(/^#/, '#'), 'the label inside a muted bar contrasts with it');
  assert.equal(label('slides.0.chart.data.rows.1.1')?.toLowerCase(), textColorForFill(expected.accent, textColorForFill(surface, '#0F172A')).toLowerCase(), 'the label inside an accent bar contrasts with it');
}

// 6. Line: series highlight (lines keep series order, as PowerPoint draws them); a category highlight marks its points even without markers.
{
  const svg = render({ type: 'line', highlight: { series: ['North'] } });
  // The legend keys are drawn first (North, South); the plotted lines follow.
  const lines = marks(svg).filter((mark) => mark.name === 'polyline');
  assert.deepEqual(lines.map((mark) => mark.color), [expected.accent, expected.muted, expected.accent, expected.muted], 'legend keys, then the lines in series order');
  assert.equal(marks(svg).filter((mark) => mark.name === 'circle').length, 0, 'no markers on a plain line');
  const points = render({ type: 'line', highlight: { categories: ['Q3'] } });
  const circles = marks(points).filter((mark) => mark.name === 'circle');
  assert.ok(circles.every((mark) => mark.path.includes('.data.rows.')), 'plain lines have no legend marker');
  assert.deepEqual(circles.map((mark) => [mark.path, mark.color]), [['slides.0.chart.data.rows.2.1', expected.accent], ['slides.0.chart.data.rows.2.2', expected.accent]], 'Q3 points carry accent markers');
  assert.deepEqual(marks(points).filter((mark) => mark.name === 'polyline').map((mark) => mark.color), Array(4).fill(expected.muted), 'a category-only highlight mutes the lines');
  const withMarkers = render({ type: 'line-with-markers', highlight: { series: ['North'], categories: ['Q1'] } });
  const north = marks(withMarkers).filter((mark) => mark.name === 'circle' && /\.data\.rows\.\d\.1$/.test(mark.path)).map((mark) => mark.color);
  const south = marks(withMarkers).filter((mark) => mark.name === 'circle' && /\.data\.rows\.\d\.2$/.test(mark.path)).map((mark) => mark.color);
  assert.deepEqual(north, Array(4).fill(expected.accent));
  assert.deepEqual(south, [expected.accent, expected.muted, expected.muted, expected.muted], 'only Q1 is highlighted on South');
}

// 7. Area, scatter and radar: series highlight, series order unchanged.
{
  const area = render({ type: 'area', highlight: { series: ['North'] } });
  assert.deepEqual(marks(area).filter((mark) => mark.name === 'path' && /\.data\.columns\.\d$/.test(mark.path)).map((mark) => [mark.path.slice(-1), mark.color]), [['1', expected.accent], ['2', expected.muted]]);
  const scatter = render({ type: 'scatter', data: { columns: ['Label', 'Spend', 'North', 'South'], rows: [['a', 1, 2, 3], ['b', 2, 4, 1], ['c', 3, 3, 5]] }, highlight: { series: ['South'] } });
  const dots = (column) => [...new Set(marks(scatter).filter((mark) => mark.name === 'circle' && mark.path.endsWith(`.${column}`) && mark.path.includes('.data.rows.')).map((mark) => mark.color))];
  assert.deepEqual(dots(3), [expected.accent]);
  assert.deepEqual(dots(2), [expected.muted]);
  const radar = render({ type: 'filled-radar', highlight: { series: ['South'] } });
  assert.deepEqual(marks(radar).filter((mark) => mark.name === 'path' && /\.data\.columns\.\d$/.test(mark.path)).map((mark) => [mark.path.slice(-1), mark.color]), [['1', expected.muted], ['2', expected.accent]]);
}

// 8. Pie and doughnut: categories are slices; the legend keys follow; a series name is dropped.
for (const type of ['pie', 'doughnut']) {
  const svg = render({ type, data: { columns: ['Region', 'Share'], rows: [['EMEA', 40], ['APAC', 35], ['AMER', 25]] }, highlight: { categories: ['APAC'] } });
  assert.deepEqual(colorsOf(svg, /\.data\.rows\.\d\.1$/), [expected.muted, expected.accent, expected.muted], `${type} slices`);
  assert.deepEqual(colorsOf(svg, /\.data\.rows\.\d\.0$/), [expected.muted, expected.accent, expected.muted], `${type} legend keys`);
}
{
  const diagnostics = [];
  const svg = render({ type: 'pie', highlight: { series: ['North'] } }, { onDiagnostic: (d) => diagnostics.push(d) });
  assert.equal(svg, plainFor({ type: 'pie' }), 'a series highlight on a pie draws as it always did');
  assert.deepEqual(diagnostics.filter((d) => d.code === 'chart-option-adapted').map((d) => d.option), ['highlight.series']);
}

// 9. A dark chart panel: the muted colour is a dim grey, the accent is lifted for contrast, and both match core.
{
  const dark = { background: '#0B1220', colorScheme: { id: 'cool-horizon', primary: '#1B4F72', dark2: '#1E293B', light2: '#1E293B', dark1: '#F8FAFC', light1: '#F8FAFC' } };
  const svg = render({ highlight: { series: ['North'] } }, {}, dark);
  const panel = svg.match(/<rect[^>]*data-opf-path="slides\.0\.chart"[^>]*>/)?.[0].match(/fill="([^"]+)"/)?.[1];
  const colors = chartHighlightColors(panel, '#1B4F72', textColorForFill(panel, '#F8FAFC'));
  assert.deepEqual([...new Set(colorsOf(svg, /\.data\.rows\.\d\.1$/))], [colors.accent]);
  assert.deepEqual([...new Set(colorsOf(svg, /\.data\.rows\.\d\.2$/))], [colors.muted]);
  assert.notEqual(colors.muted, expected.muted, 'the muted colour follows the surface');
}

// 10. Deterministic bytes, and a highlight on a chart with explicit option fields still draws them.
{
  const first = render({ highlight: { series: ['North'] }, legend: 'bottom', axisTitles: { value: 'Revenue' }, dataLabels: true });
  assert.equal(first, render({ highlight: { series: ['North'] }, legend: 'bottom', axisTitles: { value: 'Revenue' }, dataLabels: true }));
  assert.match(first, /Revenue/);
  assert.deepEqual([...new Set(colorsOf(first, /\.data\.rows\.\d\.1$/))], [expected.accent]);
}

console.log('Chart highlight passed: series and category marks, OR rule, legend keys, label contrast, line points, area/scatter/radar series, pie slices, dark surface, unsupported constructs unchanged.');
