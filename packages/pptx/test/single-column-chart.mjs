// A chart whose data is a single column (histogram, dot plot: values without a category column) was replaced by
// a text placeholder with no chart part, no graphic frame and no diagnostic. It now exports a native chart and
// says how the data was adapted; data that cannot be plotted keeps its placeholder and reports why.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {CHART_TYPES as CORE_CHART_TYPES} from '@openpresentation/opf/composition';
import {fromPptx, toPptx} from '../dist/index.js';
import {resolveChartType} from '../dist/chart-types.js';

const deck = (type, data) => ({name: 'single column chart', language: 'en', design: {fontScheme: 'calibri'}, slides: [{id: 'a', layout: 'chart', title: 'Chart', chart: {type, data}, text: 'Body'}]});
async function exported(type, data) {
  const diagnostics = [];
  const bytes = await toPptx(deck(type, data), {onDiagnostic: (diagnostic) => diagnostics.push(diagnostic)});
  const parts = unzipSync(bytes);
  const slide = strFromU8(parts['ppt/slides/slide1.xml']);
  const charts = Object.keys(parts).filter((name) => /^ppt\/charts\/chart\d+\.xml$/.test(name));
  const chartex = Object.keys(parts).filter((name) => /^ppt\/charts\/chartEx\d+\.xml$/.test(name));
  return {bytes, parts, slide, charts, diagnostics, chart: charts.length ? strFromU8(parts[charts[0]]) : '', chartex: chartex.length ? strFromU8(parts[chartex[0]]) : '', frame: slide.includes('graphicFrame'), chartDiagnostics: diagnostics.filter((diagnostic) => diagnostic.code.startsWith('chart-'))};
}
const numbers = (xml, tag) => [...xml.matchAll(new RegExp(`<c:${tag}>([\\s\\S]*?)</c:${tag}>`, 'g'))].map(([, body]) => [...body.matchAll(/<c:v>([^<]*)<\/c:v>/g)].map(([, value]) => value));
const chartexValues = (xml) => [...xml.matchAll(/<cx:numDim\b[^>]*>([\s\S]*?)<\/cx:numDim>/g)].map(([, body]) => [...body.matchAll(/<cx:pt idx="\d+">([^<]*)<\/cx:pt>/g)].map(([, value]) => value));
const binCount = (xml) => Number(xml.match(/<cx:binCount val="(\d+)"\/>/)?.[1]);

// The FF-09 case: a one-column histogram. It is PowerPoint's own histogram (chartex, FF-22b): the raw values are the
// data, PowerPoint bins them with the explicit automatic bin count (Scott's rule), and the classic fallback plots them.
const values = [3, 5, 8, 13];
const histogram = await exported('histogram', {columns: ['Value'], rows: values.map((value) => [value])});
assert.equal(histogram.charts.length, 1, 'a fallback chart part is exported');
assert.ok(histogram.chartex, 'a chartEx part is exported');
assert.ok(histogram.frame, 'the slide has a graphic frame');
assert.doesNotMatch(histogram.slide, /&quot;type&quot;/, 'no placeholder dump replaces the chart');
assert.deepEqual(histogram.chartDiagnostics, [], 'a histogram bins its own values: nothing is adapted');
assert.doesNotMatch(histogram.chartex, /<cx:strDim/, 'no category dimension for a lone value column');
assert.deepEqual(chartexValues(histogram.chartex), [['3', '5', '8', '13']]);
assert.equal(binCount(histogram.chartex), 2, 'Scott: 3.49 * sd(4.35) / 4^(1/3) = 9.56 wide over a range of 10');
assert.match(histogram.chart, /<c:barDir val="col"\/>/);
assert.deepEqual(numbers(histogram.chart, 'cat'), [['1', '2', '3', '4']], 'the fallback plots the values against their row numbers');
assert.deepEqual(numbers(histogram.chart, 'val'), [['3', '5', '8', '13']]);
assert.deepEqual(await toPptx(deck('histogram', {columns: ['Value'], rows: values.map((value) => [value])})), histogram.bytes, 'deterministic');
// The export re-imports as the same histogram with its raw values.
const imported = await fromPptx(histogram.bytes);
const importedChart = (imported.slides[0].chart ?? imported.slides[0].blocks?.find((block) => block.chart)?.chart);
assert.equal(importedChart.type, 'histogram');
assert.deepEqual(importedChart.data, {columns: ['Value'], rows: values.map((value) => [value])});

// Numeric strings count, other cells are ignored; a constant column and a single value are one bin.
const strings = await exported('histogram', {columns: ['Value'], rows: [['1'], ['2'], ['x'], [null], [3], ['4.5']]});
assert.deepEqual(chartexValues(strings.chartex), [['1', '2', '3', '4.5']], 'non-numeric cells are not plotted as zeros');
const constant = await exported('histogram', {columns: ['Value'], rows: [[7], [7], [7]]});
assert.equal(binCount(constant.chartex), 1);
const one = await exported('histogram', {columns: ['Value'], rows: [[7]]});
assert.equal(binCount(one.chartex), 1);
const wide = await exported('histogram', {columns: ['Value'], rows: Array.from({length: 1000}, (_, index) => [index])});
assert.equal(binCount(wide.chartex), 10, 'Scott bins for 0..999: 3.49 * 288.8 / 10 = 100.8 wide');
assert.equal(chartexValues(wide.chartex)[0].length, 1000);

// The same silent drop applied to every chart type with one data column.
const types = new Set([...CORE_CHART_TYPES, 'column', 'bar', 'line', 'area', 'pie', 'doughnut', 'scatter', 'radar']);
for (const type of types) {
  const result = await exported(type, {columns: ['Value'], rows: [[3], [5], [8]]});
  assert.equal(result.charts.length, 1, `${type}: a chart part is exported`);
  assert.ok(result.frame, `${type}: the slide has a graphic frame`);
  const spec = resolveChartType(type).spec;
  // The default ('auto') writes chartex parts for the constructs the native check confirmed; the unconfirmed map keeps the clustered column fallback and says so.
  const native = spec.family === 'chartex' && !spec.unconfirmed;
  assert.equal(Boolean(result.chartex), native, `${type}: a chartEx part exactly for confirmed chartex types`);
  // A histogram or Pareto chart bins the values themselves; every other type plots them against row numbers and says so.
  const binned = native && spec.binning;
  const adapted = result.chartDiagnostics.filter((diagnostic) => diagnostic.code === 'chart-data-adapted');
  assert.deepEqual(adapted.map((diagnostic) => diagnostic.adaptation), binned ? [] : spec.unconfirmed ? ['chartex-fallback', 'row-numbers'] : ['row-numbers'], `${type}: the adaptation is reported`);
  assert.deepEqual(result.chartDiagnostics.filter((diagnostic) => diagnostic.code !== 'chart-data-adapted'), [], `${type}: no other chart diagnostic by default`);
  if (binned) assert.doesNotMatch(result.chartex, /<cx:strDim/, `${type}: the values are binned, not categorised`);
  else if (result.chartex) assert.match(result.chartex, /<cx:strDim type="cat">[\s\S]*<cx:pt idx="0">1<\/cx:pt>/, `${type}: the chartex categories are the row numbers`);
}
const dots = await exported('scatter', {columns: ['2023'], rows: [[3], [5], [8]]});
// A scatter chart with one data column: X is the row number, Y the value.
assert.deepEqual(numbers(dots.chart, 'xVal'), [['1', '2', '3']], 'rows are numbered');
assert.deepEqual(numbers(dots.chart, 'yVal'), [['3', '5', '8']]);
assert.match(dots.chartDiagnostics[0].message, /'2023'.*row numbers/);
const scatter = await exported('scatter', {columns: ['Y'], rows: [[3], [5], [8]]});
assert.deepEqual(numbers(scatter.chart, 'yVal'), [['3', '5', '8']]);
assert.deepEqual(numbers(scatter.chart, 'xVal'), [['1', '2', '3']]);

// Data that cannot be plotted keeps the placeholder frame and says why, instead of dropping the chart quietly.
for (const [label, data, reason] of [
  ['text only', {columns: ['Category'], rows: [['a'], ['b']]}, 'single-column-not-numeric']
]) {
  const result = await exported('histogram', data);
  assert.equal(result.charts.length, 0, label);
  assert.match(result.slide, /Chart/, `${label}: the placeholder frame stays`);
  assert.deepEqual(result.chartDiagnostics.map((diagnostic) => [diagnostic.code, diagnostic.reason, diagnostic.path]), [['chart-data-unplottable', reason, 'slides.0.chart']], label);
  assert.ok(result.chartDiagnostics[0].message.length > 20, label);
}

// Charts with a category column and one or more series are unchanged: same shape, no chart diagnostics. A histogram
// with a category column bins by category (cx:aggregation) instead of by value.
for (const type of ['column', 'bar', 'line', 'area', 'pie', 'doughnut', 'radar', 'histogram', 'waterfall']) {
  const result = await exported(type, {columns: ['Category', 'Value'], rows: [['a', 3], ['b', 4]]});
  assert.equal(result.charts.length, 1, type);
  assert.deepEqual(result.chartDiagnostics, [], `${type}: no diagnostic for ordinary data`);
  assert.deepEqual(numbers(result.chart, 'cat'), [['a', 'b']], type);
  if (type === 'histogram') assert.match(result.chartex, /<cx:layoutPr><cx:aggregation\/><\/cx:layoutPr>/, 'a categorised histogram aggregates by category');
}
// Extremes: finite arithmetic for any finite input, every value written once and a finite bin count.
for (const rows of [[[-1e308], [1e308]], [[-1e308], [0], [1e308]], [[1.7976931348623157e308], [-1.7976931348623157e308], [5]], [[Number.MIN_VALUE], [Number.MAX_VALUE]], [[0], [Number.MIN_VALUE]]]) {
  const result = await exported('histogram', {columns: ['Value'], rows});
  assert.equal(result.charts.length, 1, JSON.stringify(rows));
  assert.deepEqual(chartexValues(result.chartex)[0].map(Number), rows.map(([value]) => value), `extremes ${JSON.stringify(rows)}: every value is written once`);
  const count = binCount(result.chartex);
  assert.ok(Number.isInteger(count) && count >= 1, `finite bin count ${count}`);
  assert.doesNotMatch(result.chartex, /NaN|Infinity/, 'finite markup');
}
// One-column paths parse numbers as multi-column charts do (RR-54: core chartNumber, strict decimal strings only; "12%",
// "$5" and "1,234" hold no number), and skip cells that hold none.
{
  const rows = [['12'], ['-5'], ['1e3'], ['12%'], ['$5'], ['1,234'], ['n/a'], [''], [null], [7]];
  const histogram = await exported('histogram', {columns: ['Value'], rows});
  assert.deepEqual(chartexValues(histogram.chartex), [['12', '-5', '1000', '7']], 'four cells hold numbers');
  assert.deepEqual(numbers(histogram.chart, 'cat'), [['1', '2', '3', '10']], 'the fallback keeps the row numbers');
  const dots = await exported('scatter', {columns: ['V'], rows});
  assert.deepEqual(numbers(dots.chart, 'xVal'), [['1', '2', '3', '10']], 'skipped rows leave gaps in the row numbers');
  assert.deepEqual(numbers(dots.chart, 'yVal'), [['12', '-5', '1000', '7']], 'skipped cells are not plotted as 0');
  assert.match(dots.chartDiagnostics.find((diagnostic) => diagnostic.code === 'chart-data-adapted').message, /its 4 values \(6 non-numeric cells were skipped\)/);
  assert.equal(dots.chartDiagnostics.find((diagnostic) => diagnostic.code === 'chart-value-not-numeric').count, 4, '"12%", "$5", "1,234" and "n/a" are reported; "" and null are gaps');
  const multi = await exported('column', {columns: ['Cat', 'V'], rows: [['a', '12'], ['b', '12%'], ['c', '1,234']]});
  assert.deepEqual(numbers(multi.chart, 'val'), [['12']], 'multi-column charts parse the same way');
}
// A placeholder is plain words: no raw JSON, data or source URL in slide text.
for (const data of [{columns: ['Category'], rows: [['a'], ['b']]}]) {
  const result = await exported('histogram', data);
  const text = [...result.slide.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(([, value]) => value).join('|');
  assert.doesNotMatch(text, /&quot;|\{|example\.invalid|secret/, `placeholder text is readable: ${text}`);
  assert.match(text, /chart&apos;s data column has no numbers/);
}
{
  const placeholderDiagnostics = [];
  const bytes = await toPptx({name: 'x', slides: [{id: 'a', title: 'T', table: {columns: [], rows: []}}]}, {onDiagnostic: (diagnostic) => placeholderDiagnostics.push(diagnostic)});
  assert.deepEqual(placeholderDiagnostics.map((diagnostic) => [diagnostic.code, diagnostic.reason]), [['content-placeholder', 'table-has-no-rows']]);
  const text = [...strFromU8(unzipSync(bytes)['ppt/slides/slide1.xml']).matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(([, value]) => value).join('|');
  assert.doesNotMatch(text, /&quot;|\{/);
}
console.log(`Single-column charts passed: native histogram bins (${values.length} values, constant, single, 1000 values and extremes), ${types.size} chart types exported (row numbers reported, histogram and pareto binned natively), unplottable data reported, ordinary charts unchanged.`);
