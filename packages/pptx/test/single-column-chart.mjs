// A chart whose data is a single column (histogram, dot plot: values without a category column) was replaced by
// a text placeholder with no chart part, no graphic frame and no diagnostic. It now exports a native chart and
// says how the data was adapted; data that cannot be plotted keeps its placeholder and reports why.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {catalogs} from '@openpresentation/opf';
import {fromPptx, toPptx} from '../dist/index.js';

const deck = (type, data) => ({name: 'single column chart', language: 'english', design: {fontScheme: 'calibri'}, slides: [{id: 'a', layout: 'chart-1x', title: 'Chart', chart: {type, data}, text: 'Body'}]});
async function exported(type, data) {
  const diagnostics = [];
  const bytes = await toPptx(deck(type, data), {onDiagnostic: (diagnostic) => diagnostics.push(diagnostic)});
  const parts = unzipSync(bytes);
  const slide = strFromU8(parts['ppt/slides/slide1.xml']);
  const charts = Object.keys(parts).filter((name) => /^ppt\/charts\/chart\d+\.xml$/.test(name));
  return {bytes, parts, slide, charts, diagnostics, chart: charts.length ? strFromU8(parts[charts[0]]) : '', frame: slide.includes('graphicFrame'), chartDiagnostics: diagnostics.filter((diagnostic) => diagnostic.code.startsWith('chart-'))};
}
const numbers = (xml, tag) => [...xml.matchAll(new RegExp(`<c:${tag}>([\\s\\S]*?)</c:${tag}>`, 'g'))].map(([, body]) => [...body.matchAll(/<c:v>([^<]*)<\/c:v>/g)].map(([, value]) => value));

// The FF-09 case: a one-column histogram.
const values = [3, 5, 8, 13];
const histogram = await exported('histogram', {columns: ['Value'], rows: values.map((value) => [value])});
assert.equal(histogram.charts.length, 1, 'a chart part is exported');
assert.ok(histogram.frame, 'the slide has a graphic frame');
assert.doesNotMatch(histogram.slide, /&quot;type&quot;/, 'no placeholder dump replaces the chart');
assert.equal(histogram.chartDiagnostics.length, 1);
assert.deepEqual({code: histogram.chartDiagnostics[0].code, adaptation: histogram.chartDiagnostics[0].adaptation, path: histogram.chartDiagnostics[0].path}, {code: 'chart-data-adapted', adaptation: 'histogram-binned', path: 'slides.0.chart'});
assert.match(histogram.chartDiagnostics[0].message, /4 values.*3 equal-width bins/);
// Sturges: ceil(log2(4)) + 1 = 3 bins over [3, 13]; the maximum falls in the last bin.
assert.match(histogram.chart, /<c:barDir val="col"\/>/);
assert.deepEqual(numbers(histogram.chart, 'cat'), [['3–6.33333', '6.33333–9.66667', '9.66667–13']]);
assert.deepEqual(numbers(histogram.chart, 'val'), [['2', '1', '1']]);
assert.equal(numbers(histogram.chart, 'val')[0].reduce((total, count) => total + Number(count), 0), values.length, 'every value is counted once');
assert.deepEqual(await toPptx(deck('histogram', {columns: ['Value'], rows: values.map((value) => [value])})), histogram.bytes, 'deterministic');
// The export re-imports as a valid column chart of the binned counts.
const imported = await fromPptx(histogram.bytes);
const importedChart = (imported.slides[0].chart ?? imported.slides[0].blocks?.find((block) => block.chart)?.chart);
assert.equal(importedChart.type, 'column');
assert.deepEqual(importedChart.data.columns, ['Bin', 'Frequency']);
assert.deepEqual(importedChart.data.rows.map((row) => row[1]), [2, 1, 1]);

// Numeric strings count, other cells are ignored; a constant column is one bin; one value is one bin.
const strings = await exported('histogram', {columns: ['Value'], rows: [['1'], ['2'], ['x'], [null], [3], ['4.5']]});
assert.equal(numbers(strings.chart, 'val')[0].reduce((total, count) => total + Number(count), 0), 4, 'non-numeric cells are not counted as zeros');
const constant = await exported('histogram', {columns: ['Value'], rows: [[7], [7], [7]]});
assert.deepEqual(numbers(constant.chart, 'cat'), [['7']]);
assert.deepEqual(numbers(constant.chart, 'val'), [['3']]);
const one = await exported('histogram', {columns: ['Value'], rows: [[7]]});
assert.deepEqual(numbers(one.chart, 'val'), [['1']]);
const wide = await exported('histogram', {columns: ['Value'], rows: Array.from({length: 1000}, (_, index) => [index])});
assert.equal(numbers(wide.chart, 'val')[0].length, 11, 'Sturges bins for 1000 values');
assert.equal(numbers(wide.chart, 'val')[0].reduce((total, count) => total + Number(count), 0), 1000);

// The same silent drop applied to every chart type with one data column (dot plot is the other catalog one).
const singleColumn = catalogs.chartTypes.filter((record) => record.columns?.length === 1).map((record) => record.id);
assert.deepEqual(singleColumn.sort(), ['dot-plot', 'histogram'], 'the catalog chart types with one data column');
const types = new Set([...catalogs.chartTypes.map((record) => record.id), 'column', 'bar', 'line', 'area', 'pie', 'doughnut', 'scatter', 'radar']);
for (const type of types) {
  const result = await exported(type, {columns: ['Value'], rows: [[3], [5], [8]]});
  assert.equal(result.charts.length, 1, `${type}: a chart part is exported`);
  assert.ok(result.frame, `${type}: the slide has a graphic frame`);
  assert.deepEqual(result.chartDiagnostics.map((diagnostic) => diagnostic.code), ['chart-data-adapted'], `${type}: the adaptation is reported`);
  assert.equal(result.chartDiagnostics[0].adaptation, type === 'histogram' ? 'histogram-binned' : 'row-numbers', type);
}
const dots = await exported('dot-plot', {columns: ['2023'], rows: [[3], [5], [8]]});
assert.deepEqual(numbers(dots.chart, 'cat'), [['1', '2', '3']], 'rows are numbered');
assert.deepEqual(numbers(dots.chart, 'val'), [['3', '5', '8']]);
assert.match(dots.chartDiagnostics[0].message, /'2023'.*row numbers/);
const scatter = await exported('scatter', {columns: ['Y'], rows: [[3], [5], [8]]});
assert.deepEqual(numbers(scatter.chart, 'yVal'), [['3', '5', '8']]);
assert.deepEqual(numbers(scatter.chart, 'xVal'), [['1', '2', '3']]);

// Data that cannot be plotted keeps the placeholder frame and says why, instead of dropping the chart quietly.
for (const [label, data, reason] of [
  ['text only', {columns: ['Category'], rows: [['a'], ['b']]}, 'single-column-not-numeric'],
  ['external data', {src: 'https://example.invalid/data.csv'}, 'data-not-inline']
]) {
  const result = await exported('histogram', data);
  assert.equal(result.charts.length, 0, label);
  assert.match(result.slide, /Chart/, `${label}: the placeholder frame stays`);
  assert.deepEqual(result.chartDiagnostics.map((diagnostic) => [diagnostic.code, diagnostic.reason, diagnostic.path]), [['chart-data-unplottable', reason, 'slides.0.chart']], label);
  assert.ok(result.chartDiagnostics[0].message.length > 20, label);
}

// Charts with a category column and one or more series are unchanged: same shape, no chart diagnostics.
for (const type of ['column', 'bar', 'line', 'area', 'pie', 'doughnut', 'radar', 'histogram', 'waterfall']) {
  const result = await exported(type, {columns: ['Category', 'Value'], rows: [['a', 3], ['b', 4]]});
  assert.equal(result.charts.length, 1, type);
  assert.deepEqual(result.chartDiagnostics, [], `${type}: no diagnostic for ordinary data`);
  assert.deepEqual(numbers(result.chart, 'cat'), [['a', 'b']], type);
}
// Extremes: finite arithmetic for any finite input, every value counted once.
for (const rows of [[[-1e308], [1e308]], [[-1e308], [0], [1e308]], [[1.7976931348623157e308], [-1.7976931348623157e308], [5]], [[Number.MIN_VALUE], [Number.MAX_VALUE]], [[0], [Number.MIN_VALUE]]]) {
  const result = await exported('histogram', {columns: ['Value'], rows});
  assert.equal(result.charts.length, 1, JSON.stringify(rows));
  const counts = numbers(result.chart, 'val')[0].map(Number);
  assert.equal(counts.reduce((total, count) => total + count, 0), rows.length, `extremes ${JSON.stringify(rows)}: every value is counted once`);
  assert.ok(counts.every(Number.isInteger), 'integer counts');
  assert.ok(numbers(result.chart, 'cat')[0].every((label) => label && !/NaN|Infinity/.test(label)), 'finite labels');
}
// Labels stay distinct when six significant digits would make two bins read alike.
{
  const result = await exported('histogram', {columns: ['Value'], rows: [[1000000], [1000000.4], [1000000.8], [1000001.2], [1000001.6], [1000002]]});
  const labels = numbers(result.chart, 'cat')[0];
  assert.equal(new Set(labels).size, labels.length, `distinct labels: ${labels}`);
  assert.equal(numbers(result.chart, 'val')[0].reduce((total, count) => total + Number(count), 0), 6);
}
// One-column paths parse numbers as multi-column charts do ("12%", "$5", "1,234"), and skip cells that hold none.
{
  const rows = [['12%'], ['$5'], ['1,234'], ['n/a'], [''], [null], [7]];
  const histogram = await exported('histogram', {columns: ['Value'], rows});
  assert.equal(numbers(histogram.chart, 'val')[0].reduce((total, count) => total + Number(count), 0), 4, 'four cells hold numbers');
  assert.match(histogram.chartDiagnostics[0].message, /4 values \(3 non-numeric cells were skipped\)/);
  const dots = await exported('dot-plot', {columns: ['V'], rows});
  assert.deepEqual(numbers(dots.chart, 'cat'), [['1', '2', '3', '7']], 'skipped rows leave gaps in the row numbers');
  assert.deepEqual(numbers(dots.chart, 'val'), [['12', '5', '1234', '7']], 'skipped cells are not plotted as 0');
  assert.match(dots.chartDiagnostics[0].message, /its 4 values \(3 non-numeric cells were skipped\)/);
  const multi = await exported('column', {columns: ['Cat', 'V'], rows: [['a', '12%'], ['b', '$5'], ['c', '1,234']]});
  assert.deepEqual(numbers(multi.chart, 'val'), [['12', '5', '1234']], 'multi-column charts parse the same way');
}
// A placeholder is plain words: no raw JSON, data or source URL in slide text.
for (const data of [{columns: ['Category'], rows: [['a'], ['b']]}, {src: 'https://example.invalid/data.csv?token=secret'}]) {
  const result = await exported('histogram', data);
  const text = [...result.slide.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(([, value]) => value).join('|');
  assert.doesNotMatch(text, /&quot;|\{|example\.invalid|secret/, `placeholder text is readable: ${text}`);
  assert.match(text, /Chart data is not inline, so it cannot be drawn here|chart&apos;s data column has no numbers/);
}
{
  const placeholderDiagnostics = [];
  const bytes = await toPptx({name: 'x', slides: [{id: 'a', title: 'T', table: {columns: [], rows: []}}]}, {onDiagnostic: (diagnostic) => placeholderDiagnostics.push(diagnostic)});
  assert.deepEqual(placeholderDiagnostics.map((diagnostic) => [diagnostic.code, diagnostic.reason]), [['content-placeholder', 'table-has-no-rows']]);
  const text = [...strFromU8(unzipSync(bytes)['ppt/slides/slide1.xml']).matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(([, value]) => value).join('|');
  assert.doesNotMatch(text, /&quot;|\{/);
}
console.log(`Single-column charts passed: histogram binning (${values.length} values to 3 bins, constant, single and 1000 values), ${types.size} chart types exported with a reported adaptation, unplottable data reported, ordinary charts unchanged.`);
