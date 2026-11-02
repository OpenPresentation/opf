import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as core from '@openpresentation/opf/composition';
// FA-23: the documents name the gallery's `roboto` font scheme, so the host catalog is registered.
import {toSvg} from './catalog-harness.mjs';
import { chartNumber, formatTick } from '../dist/charts.js';

// RR-54: chart and table data in the preview. Strict chart numbers, number formats on data labels, value-axis ticks and table
// cells, shared datasets, series mapping by column name, DataColumn headers, and trace paths. Core owns the resolution
// (resolveChartData, tableCellDisplayValue); these tests assert what the preview draws from it.
// OPF 0.15: chart.type is core's CHART_TYPES enum, so a type outside it (the `sketch` below, which exercises the renderer's
// legacy single-series preview) no longer validates; those documents are drawn with validation off to reach that path.

const attributesOf = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const plain = (html) => html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&');
// The text of every drawn <text> element (tags stripped), in document order.
const words = (svg) => [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map(([, body]) => plain(body));
const paths = (svg) => [...svg.matchAll(/data-opf-path="([^"]*)"/g)].map(([, path]) => path);
const LEGACY_TYPE = 'sketch';
const drawsLegacyType = (document) => document.slides.some((slide) => [slide.chart, ...(slide.blocks ?? []).map((block) => block.chart)].some((chart) => chart?.type === LEGACY_TYPE));
const render = (document, options = {}) => toSvg(document, 1, drawsLegacyType(document) ? { validate: false, ...options } : options);
const doc = (slide, extra = {}) => ({ design: { fontScheme: 'roboto' }, slides: [slide], ...extra });
const chartDoc = (chart, extra = {}) => doc({ title: 'Chart', chart }, extra);

// ---------------------------------------------------------------------------------------------------------------------
// 0. Traced SVG digests for one chart per type, a legacy sketch, and a styled table (RR54_PRINT_DIGESTS=1 prints them).
//    RR-20 changes only the neutral structural stroke in 30 SVGs; the styled table also right-aligns two numeric cells.
//    Old and new full SVG strings were compared before these reviewed digests changed. RR-90 (core): table cells ask for the 25 px body size, so only the styled table's digest changed (b0bbca64..., was d5d091b9...); the SVG differs in the cell text sizes and row heights. WI-5: the chart panel has no outer frame, the axis has fewer intervals and series 1 is lifted on a dark panel, so every chart digest changed except the legacy sketch; the styled table draws horizontal rules only and sizes its columns from content. Further drift needs a reason.
//    Full old/new SVG comparisons are recorded in the RR-20 source qualification. FA-03: the eight stacked types lost their -3x suffix; the SVG names the chart type in data-opf-chart, so only those digests changed, and rendering with the old id string put back reproduces the previous digests. FA-30: the slide root became a labelled group (role="group", aria-roledescription="slide") and decorative shapes gained aria-hidden, so every digest changed; with those attributes taken out and role="img" put back on the root the SVG reproduces the previous digests, so only accessibility attributes differ.
//    LH-59: bar, stacked-bar and 100pct-stacked-bar list their categories top to bottom; the waterfall and the lone-column histogram size
//    their tick-label column from the tightened probe axes (the axis maximum stays within 1.25 x the data), so those five digests changed.
//    LH-55: on the default dark panel every series from the scheme reaches 4.5:1 and series 2 keeps 20 L* from series 1, so the digest of every chart with more than one series or category changed (24); the single-series histogram, waterfall, funnel, map, sketch and table did not. LH wave 1: with both, bar, stacked-bar and 100pct-stacked-bar carry both changes (new digests); every other digest is the one its own change gave.
//    LH-48: the styled table is the slide's only block and fills little of the body, so it grows (its type and rows, `tableGrowth`) and sits in
//    the middle of the body; only its digest changed.

const CATALOG_TYPES = ['column', 'stacked-column', '100pct-stacked-column', 'bar', 'stacked-bar', '100pct-stacked-bar', 'line', 'line-with-markers', 'stacked-line', 'stacked-line-with-markers', 'area', 'stacked-area', '100pct-stacked-area', 'pie', 'doughnut', 'scatter', 'radar', 'radar-with-markers', 'filled-radar', 'treemap', 'histogram', 'pareto', 'box-and-whisker', 'waterfall', 'funnel', 'world', 'sketch'];
const plainRows = [['Q1', 12.4, 3, 8], ['Q2', 18.1, 5, 9], ['Q3', 21.75, 2, 4], ['Q4', 9, 7, 6]];
const plainDocuments = {
  ...Object.fromEntries(CATALOG_TYPES.map((type) => [type, chartDoc({ type, dataLabels: { content: ['category', 'value'] }, data: { columns: ['Quarter', 'North', 'South', 'West'], rows: plainRows } })])),
  'column-no-options': chartDoc({ type: 'column', data: { columns: ['Quarter', 'North', 'South', 'West'], rows: plainRows } }),
  'line-string-numbers': chartDoc({ type: 'line', data: { columns: ['Quarter', 'North', 'South'], rows: [['Q1', '12.5', 3], ['Q2', 18, '5'], ['Q3', 21, 2]] } }),
  'histogram-lone-column': chartDoc({ type: 'histogram', data: { columns: ['Values'], rows: [[1], [2], [2], [3], [3], [3], [4], [8]] } }),
  'table-styled': doc({ title: 'T', table: { columns: ['Region', { value: 'Growth', style: { align: 'right' } }], rows: [['EMEA', 8.2], [{ value: ['rich ', { text: 'run', bold: true }] }, { value: 0.4, style: { color: '#ff0000' } }], ['APAC', 'n/a']] } })
};
const digestOf = (svg) => createHash('sha256').update(svg).digest('hex').slice(0, 24);
const digests = Object.fromEntries(Object.entries(plainDocuments).map(([name, document]) => [name, digestOf(render(document, { trace: true }))]));
if (process.env.RR54_PRINT_DIGESTS) {
  console.log(JSON.stringify(digests, null, 2));
  process.exit(0);
}
// LH-60 and LH-56 moved six on purpose: the two-series pie and doughnut draw nested rings, the box-and-whisker (one value per category)
// one box per series, the world chart over quarters columns, and the treemap and funnel labels contrast with their fills.
// LH wave 2: LH-03 and LH-81 moved fifteen (the column, bar, line and area types, column-no-options and line-string-numbers): the
// header row replaces the side legend, and the small column and line charts label their values without the value axis or panel. The
// world chart over quarters, drawn as columns (LH-60), takes the column chart's header row too, so its digest moved again.
const REVIEWED_SVG_DIGESTS = {
  'column': 'c027339ea7d6c699b4dfd5f8',
  'stacked-column': 'bcc1964a00d7827622374f49',
  '100pct-stacked-column': '3775a859b0eb6a3902b6924a',
  'bar': '903a3fbab280383f114e726d',
  'stacked-bar': '9b7fb2b76a52783bc0786afa',
  '100pct-stacked-bar': 'c3bc2ec3587b183ac63833e2',
  'line': 'ebedc29d4a70445cdc4d3107',
  'line-with-markers': '3aab22d3d6b4a3ac8bf3c791',
  'stacked-line': '1a43ebe46faecb071edd06f7',
  'stacked-line-with-markers': 'e6def7ff90da0b79a3abc29d',
  'area': 'b2a4ea43d2afa99b7cc298a8',
  'stacked-area': 'ea6e3661c32b7bcd4ca0986b',
  '100pct-stacked-area': '445a6ec13e4459cbb699f3b2',
  'pie': 'b923fe0ee2c2d8a903015c83',
  'doughnut': '151f47d0ebc53d35b4f6e63d',
  'scatter': '44baab35d353e214a225bf68',
  'radar': '9f0bf90fdffcebfa65edd7ee',
  'radar-with-markers': '79796466e2ad84d3b1b62506',
  'filled-radar': 'b044881d170ae269eb127c96',
  'treemap': 'cb63c8922c227f3ae6f8c234',
  'histogram': 'e4a1342012db24e6c5585283',
  'pareto': '20f13a2185543acb45794d90',
  'box-and-whisker': 'a65be9e95948c1e6a06ea533',
  'waterfall': '70a315ec3bb6754e9e1866e1',
  'funnel': '6208efa6e685004b27a8f3d2',
  'world': 'fdc75fe9a707636ee2602c4d',
  'sketch': '412f5a537d5291557428c038',
  'column-no-options': '1b6bd1696b69e0708101550b',
  'line-string-numbers': 'ddd95c76dd8de9724cdb1be9',
  'histogram-lone-column': '3c2269d823eed5e38ba85da0',
  'table-styled': '1fb1ac9862fa48e2107a7043',
};
assert.deepEqual(digests, REVIEWED_SVG_DIGESTS, 'documents without the new fields retain the reviewed traced SVG output');

// ---------------------------------------------------------------------------------------------------------------------
// 1. Strict numbers: the renderer's chartNumber is core's. "12%", "(5)" and "Q1" are gaps, "1e6" is 1000000.

assert.equal(chartNumber('12%'), null);
assert.equal(chartNumber('(5)'), null);
assert.equal(chartNumber('Q1'), null);
assert.equal(chartNumber('1e6'), 1000000);
assert.equal(chartNumber(' 12.5 '), 12.5);
assert.equal(chartNumber(true), null);
assert.equal(chartNumber(Number.POSITIVE_INFINITY), null);
{
  const strings = chartDoc({ type: 'column', data: { columns: ['Quarter', 'Revenue'], rows: [['Q1', '12%'], ['Q2', '1e6'], ['Q3', '(5)'], ['Q4', 7]] } });
  const numbers = chartDoc({ type: 'column', data: { columns: ['Quarter', 'Revenue'], rows: [['Q1', null], ['Q2', 1000000], ['Q3', null], ['Q4', 7]] } });
  const svg = render(strings, { trace: true });
  assert.equal(svg, render(numbers, { trace: true }), 'string cells that are not strict numbers plot exactly like gaps; 1e6 plots as 1000000');
  assert.deepEqual(paths(svg).filter((path) => /^slides\.0\.chart\.data\.rows\.\d\.1$/.test(path)).filter((path, i, all) => all.indexOf(path) === i), ['slides.0.chart.data.rows.1.1', 'slides.0.chart.data.rows.3.1'], 'only Q2 and Q4 draw a column');
  // The legacy sketch (a chart type outside CHART_TYPES) reads the same strict values.
  const legacy = (rows) => render(chartDoc({ type: 'sketch', data: { columns: ['Quarter', 'Revenue'], rows } }), { trace: true });
  assert.equal(legacy([['Q1', '12%'], ['Q2', '1e6'], ['Q3', '(5)'], ['Q4', 7]]), legacy([['Q1', null], ['Q2', 1000000], ['Q3', null], ['Q4', 7]]), 'the legacy sketch reads strict numbers too');
}

// ---------------------------------------------------------------------------------------------------------------------
// 2. Formats on data labels and value-axis tick labels. No format keeps the General output.

const money = { name: 'Revenue', format: '$#,##0.0' };
const rows = [['Q1', 12.4, 0.31], ['Q2', 18.1, 0.34], ['Q3', 21.75, 0.4]];
{
  // LH-03: a small chart whose labels show the value drops its value axis; a value axis title keeps it, so the ticks are drawn.
  const formatted = chartDoc({ type: 'column', dataLabels: { content: ['value'] }, axisTitles: { value: 'Amount' }, data: { columns: ['Quarter', money, { name: 'Margin', format: '0%' }], rows } });
  const svg = render(formatted);
  const shown = words(svg);
  for (const label of ['$12.4', '$18.1', '$21.8', '31%', '34%', '40%']) assert.ok(shown.includes(label), `${label} is a data label (${shown.join(' | ')})`);
  // The value axis takes the first plotted series' format: Revenue, so dollars with one decimal.
  assert.ok(shown.includes('$0.0') && shown.includes('$20.0'), `value ticks are dollars (${shown.join(' | ')})`);
  assert.ok(!shown.includes('12.4') && !shown.includes('20'), 'no General label or tick remains');
  const general = words(render(chartDoc({ type: 'column', dataLabels: { content: ['value'] }, axisTitles: { value: 'Amount' }, data: { columns: ['Quarter', 'Revenue', 'Margin'], rows } })));
  assert.ok(general.includes('12.4') && general.includes('20') && general.includes('0.31'), 'without a format the labels and ticks are General');
  // Lines, scatter, pie (the percent label stays a percent, the value takes the format) and the chartex constructs.
  for (const type of ['line', 'area', 'bar', 'radar']) {
    const shownType = words(render(chartDoc({ type, dataLabels: { content: ['value'] }, axisTitles: { value: 'Amount' }, data: { columns: ['Quarter', money], rows: rows.map((row) => row.slice(0, 2)) } })));
    assert.ok(shownType.includes('$12.4'), `${type}: label formatted`);
    assert.ok(shownType.some((word) => /^\$\d+\.0$/.test(word)), `${type}: tick formatted`);
  }
  const pie = words(render(chartDoc({ type: 'pie', dataLabels: { content: ['value', 'percent'], separator: ' / ' }, data: { columns: ['Quarter', money], rows: [['Q1', 10], ['Q2', 30]] } })));
  assert.ok(pie.includes('$10.0 / 25%') && pie.includes('$30.0 / 75%'), `pie: formatted value and percent (${pie.join(' | ')})`);
  const scatter = words(render(chartDoc({ type: 'scatter', dataLabels: { content: ['category', 'value'], separator: ' / ' }, data: { columns: ['Point', { name: 'Spend', format: '#,##0 k' }, money], rows: [['a', 1000, 5], ['b', 2000, 9]] } })));
  assert.ok(scatter.includes('1,000 k / $5.0') && scatter.includes('2,000 k / $9.0'), `scatter: the X column format on the X label, the Y format on the value (${scatter.join(' | ')})`);
  assert.ok(scatter.some((word) => /^[\d,]+ k$/.test(word)) && scatter.some((word) => /^\$\d+\.0$/.test(word)), 'scatter: X and Y ticks follow their columns');
  for (const type of ['waterfall', 'funnel', 'treemap', 'histogram', 'box-and-whisker']) {
    const shownEx = words(render(chartDoc({ type, dataLabels: { content: ['value'] }, data: { columns: ['Step', money], rows: [['A', 10], ['B', 25], ['C', 15]] } })));
    assert.ok(shownEx.includes('$10.0'), `${type}: label formatted (${shownEx.join(' | ')})`);
  }
  // Percent-stacked axes stay percent; the format moves to the data labels only.
  const stacked = words(render(chartDoc({ type: '100pct-stacked-column', dataLabels: { content: ['value'] }, data: { columns: ['Quarter', money, { name: 'Costs', format: '$#,##0.0' }], rows: [['Q1', 10, 10], ['Q2', 20, 5]] } })));
  assert.ok(stacked.includes('100%') && stacked.includes('$10.0'), `100% stacked: percent axis, formatted labels (${stacked.join(' | ')})`);
}
// An invalid format never reaches the drawing (core reports number-format-invalid); formatTick takes a format or none.
assert.equal(formatTick(1500, false, '#,##0'), '1,500');
assert.equal(formatTick(0.5, true, '#,##0'), '50%');
assert.equal(formatTick(1500), '1500');

// ---------------------------------------------------------------------------------------------------------------------
// 3. DataColumn without a format is the string column: the same SVG, trace paths included.

const columnsOf = (...names) => names;
for (const type of ['column', 'bar', 'line', 'area', 'pie', 'scatter', 'radar', 'treemap', 'histogram', 'pareto', 'box-and-whisker', 'waterfall', 'funnel', 'world', 'sketch']) {
  const data = (columns) => ({ columns, rows: [['a', 3, 4], ['b', 5, 6], ['c', 8, 2]] });
  const named = chartDoc({ type, data: data(columnsOf('Label', 'North', 'South')) });
  const objects = chartDoc({ type, data: data(columnsOf({ name: 'Label' }, { name: 'North' }, { name: 'South' })) });
  assert.equal(render(objects, { trace: true }), render(named, { trace: true }), `${type}: DataColumn headers draw as the string headers`);
}
{
  const svg = render(chartDoc({ type: 'column', data: { columns: [{ name: 'Quarter' }, { name: 'North' }, { name: 'South' }], rows: [['Q1', 1, 2]] } }));
  assert.ok(words(svg).includes('North') && words(svg).includes('South'), 'legend entries use the DataColumn name');
}

// ---------------------------------------------------------------------------------------------------------------------
// 4. Datasets: a chart that references a dataset draws exactly the inline chart; its parts report the chart's authored path.

const dataset = { title: 'Revenue', columns: ['Quarter', money, { name: 'Margin', format: '0%' }], rows };
for (const type of ['column', 'line', 'pie', 'scatter', 'treemap', 'sketch']) {
  const inline = chartDoc({ type, dataLabels: { content: ['value'] }, data: { columns: dataset.columns, rows: dataset.rows } });
  const viaDataset = chartDoc({ type, dataLabels: { content: ['value'] }, data: { dataset: 'revenue' } }, { datasets: { revenue: dataset } });
  assert.equal(render(viaDataset), render(inline), `${type}: a dataset chart draws exactly the inline chart`);
  const traced = render(viaDataset, { trace: true });
  const reported = paths(traced).filter((path) => path.startsWith('slides.0.chart'));
  assert.ok(reported.length > 0, `${type}: the chart reports its path`);
  assert.deepEqual([...new Set(reported)], ['slides.0.chart'], `${type}: every part of a dataset chart reports the authored chart path, never data.rows or data.columns (${[...new Set(reported)].join(', ')})`);
}
{
  // fields selects and orders the dataset's columns.
  const viaFields = chartDoc({ type: 'column', data: { dataset: 'revenue', fields: ['Quarter', 'Margin'] } }, { datasets: { revenue: dataset } });
  const inline = chartDoc({ type: 'column', data: { columns: ['Quarter', dataset.columns[2]], rows: rows.map((row) => [row[0], row[2]]) } });
  assert.equal(render(viaFields), render(inline), 'dataset fields select columns');
  // Two charts share one dataset.
  const shared = doc({ title: 'Shared', blocks: [{ chart: { type: 'column', data: { dataset: 'revenue' } } }, { chart: { type: 'line', data: { dataset: 'revenue', fields: ['Quarter', 'Revenue'] } } }] }, { datasets: { revenue: dataset } });
  const sharedSvg = render(shared, { trace: true });
  assert.ok(paths(sharedSvg).includes('slides.0.blocks.0.chart') && paths(sharedSvg).includes('slides.0.blocks.1.chart'), 'both charts report their own paths');
  assert.ok(words(sharedSvg).includes('Revenue'), 'dataset column names label the series');
  // An unknown dataset is a validation error (dataset-unknown), as an unknown mapping column is.
  assert.throws(() => render(chartDoc({ type: 'column', data: { dataset: 'missing' } }, { datasets: { revenue: dataset } })), (error) => error.code === 'invalid-opf' && error.details.findings.some((finding) => finding.ruleId === 'opf/dataset-unknown'), 'an unknown dataset is rejected at the boundary');
  assert.throws(() => render(chartDoc({ type: 'column', mapping: { series: ['Nope'] }, data: { columns: ['A', 'B'], rows: [['x', 1]] } })), (error) => error.details.findings.some((finding) => finding.ruleId === 'opf/chart-mapping-unknown-column'), 'an unknown mapping column is rejected at the boundary');
}
{
  // ChartDataSource is removed from the format (opf#240, descoped): a data source by file is rejected at the boundary.
  assert.throws(() => render(chartDoc({ type: 'column', data: { src: 'revenue.csv' } })), (error) => error.code === 'invalid-opf', 'a data source by file is a validation error');
}

// ---------------------------------------------------------------------------------------------------------------------
// 5. Mapping by column name: category, series order and selection, and scatter X.

{
  const base = { columns: ['Quarter', 'North', 'South', 'West'], rows: [['Q1', 10, 5, 7], ['Q2', 20, 8, 9], ['Q3', 15, 12, 11]] };
  const reordered = chartDoc({ type: 'column', mapping: { series: ['West', 'North'] }, data: base });
  const direct = chartDoc({ type: 'column', data: { columns: ['Quarter', 'West', 'North'], rows: base.rows.map((row) => [row[0], row[3], row[1]]) } });
  assert.equal(render(reordered), render(direct), 'mapping.series reorders and selects the plotted columns');
  const traced = render(reordered, { trace: true });
  const seriesPaths = [...new Set(paths(traced).filter((path) => /^slides\.0\.chart\.data\.rows\.0\.\d$/.test(path)))];
  assert.deepEqual(seriesPaths.sort(), ['slides.0.chart.data.rows.0.0', 'slides.0.chart.data.rows.0.1', 'slides.0.chart.data.rows.0.3'], 'marks report the authored column index (West is column 3, North column 1)');
  assert.ok(paths(traced).includes('slides.0.chart.data.columns.3') && paths(traced).includes('slides.0.chart.data.columns.1'), 'legend entries report authored columns');
  assert.ok(!paths(traced).includes('slides.0.chart.data.columns.2'), 'the unmapped South column is not drawn');

  const swapped = chartDoc({ type: 'column', mapping: { category: 'Region', series: ['Sales'] }, data: { columns: ['Sales', 'Region'], rows: [[3, 'EMEA'], [5, 'APAC']] } });
  const direct2 = chartDoc({ type: 'column', data: { columns: ['Region', 'Sales'], rows: [['EMEA', 3], ['APAC', 5]] } });
  assert.equal(render(swapped), render(direct2), 'mapping.category picks the label column');
  assert.ok(words(render(swapped)).includes('EMEA'), 'category labels come from the mapped column');

  // Scatter: mapping.x chooses the X column; the default is the second column.
  const points = { columns: ['Point', 'Spend', 'Leads', 'Score'], rows: [['a', 10, 1, 4], ['b', 20, 3, 6], ['c', 30, 2, 5]] };
  const mapped = chartDoc({ type: 'scatter', mapping: { x: 'Score', series: ['Leads', 'Spend'] }, data: points });
  const directX = chartDoc({ type: 'scatter', data: { columns: ['Point', 'Score', 'Leads', 'Spend'], rows: points.rows.map((row) => [row[0], row[3], row[2], row[1]]) } });
  assert.equal(render(mapped), render(directX), 'mapping.x chooses the scatter X column');
  const defaultX = chartDoc({ type: 'scatter', data: points });
  const unmapped = chartDoc({ type: 'scatter', mapping: {}, data: points });
  assert.equal(render(unmapped, { trace: true }), render(defaultX, { trace: true }), 'an empty mapping is the positional rule');
  assert.notEqual(render(mapped), render(defaultX), 'the mapped X changes the plot');
}

// ---------------------------------------------------------------------------------------------------------------------
// 6. Tables: formatted cells, DataColumn headers (and their formats), dataset-backed tables.

{
  const table = {
    columns: ['Region', { name: 'Revenue', format: '$#,##0.0' }, { value: 'Growth', style: { align: 'right' }, format: '0%' }],
    rows: [['EMEA', 8.2, 0.4], ['APAC', 6.1, { value: 0.52, format: '0.0%' }], ['AMER', 'n/a', null]]
  };
  const svg = render(doc({ title: 'T', table }), { trace: true });
  const shown = words(svg);
  for (const text of ['Region', 'Revenue', 'Growth', 'EMEA', '$8.2', '40%', '$6.1', '52.0%', 'n/a']) assert.ok(shown.includes(text), `${text} is drawn (${shown.join(' | ')})`);
  assert.ok(!shown.includes('8.2') && !shown.includes('0.52'), 'the authored numbers are not drawn');
  assert.ok(paths(svg).some((path) => path.startsWith('slides.0.table.rows.0.1')), 'cells keep their authored paths');
  // The same table with the formatted text and resulting numeric alignment written out by hand draws the same.
  const right = (value) => ({ value, style: { align: 'right' } });
  const written = { columns: ['Region', 'Revenue', { value: 'Growth', style: { align: 'right' } }], rows: [['EMEA', right('$8.2'), right('40%')], ['APAC', right('$6.1'), right('52.0%')], ['AMER', 'n/a', null]] };
  const strip = (markup) => markup.replace(/ data-opf-path="[^"]*"/g, '');
  assert.equal(strip(render(doc({ title: 'T', table: written }), { trace: true })), strip(svg), 'formatting a cell draws what its text would draw');

  // DataColumn headers draw their name.
  const headers = render(doc({ title: 'T', table: { columns: [{ name: 'Region' }, { name: 'Revenue' }], rows: [['EMEA', 8]] } }));
  assert.ok(words(headers).includes('Region') && words(headers).includes('Revenue'), 'DataColumn headers draw their name');
  const stringHeaders = render(doc({ title: 'T', table: { columns: ['Region', 'Revenue'], rows: [['EMEA', 8]] } }));
  assert.equal(headers, stringHeaders, 'a DataColumn header without a format is the string header');

  // Dataset-backed table: same pixels as the inline table, with the dataset's headers and column formats.
  const tableDataset = { columns: ['Region', { name: 'Revenue', format: '$#,##0.0' }, { name: 'Growth', format: '0%' }], rows: [['EMEA', 8.2, 0.4], ['APAC', 6.1, 0.52]] };
  const viaDataset = doc({ title: 'T', table: { dataset: 'regions' } }, { datasets: { regions: tableDataset } });
  const inline = doc({ title: 'T', table: { columns: tableDataset.columns, rows: tableDataset.rows } });
  assert.equal(render(viaDataset), render(inline), 'a dataset table draws exactly the inline table');
  const datasetWords = words(render(viaDataset));
  assert.ok(['$8.2', '40%', '$6.1', '52%', 'Revenue'].every((text) => datasetWords.includes(text)), `dataset table shows formatted values (${datasetWords.join(' | ')})`);
  const traced = render(viaDataset, { trace: true });
  assert.deepEqual([...new Set(paths(traced).filter((path) => path.startsWith('slides.0.table')))], ['slides.0.table'], 'every part of a dataset table reports the authored table path, never rows or columns');
  // fields select dataset columns.
  const fields = doc({ title: 'T', table: { dataset: 'regions', fields: ['Region', 'Growth'] } }, { datasets: { regions: tableDataset } });
  const fieldsInline = doc({ title: 'T', table: { columns: ['Region', tableDataset.columns[2]], rows: tableDataset.rows.map((row) => [row[0], row[2]]) } });
  assert.equal(render(fields), render(fieldsInline), 'table fields select dataset columns');
}

// ---------------------------------------------------------------------------------------------------------------------
// 7. A chart and a table that use none of the new fields keep their trace paths and draw as before (the golden corpus holds
//    the byte-level baseline; here the paths the editor relies on).

{
  const svg = render(chartDoc({ type: 'column', data: { columns: ['Quarter', 'North', 'South'], rows: [['Q1', 10, 5], ['Q2', 20, 8]] } }), { trace: true });
  const reported = new Set(paths(svg));
  for (const path of ['slides.0.chart', 'slides.0.chart.data.rows.0.1', 'slides.0.chart.data.rows.1.2', 'slides.0.chart.data.columns.1', 'slides.0.chart.data.rows.0.0']) assert.ok(reported.has(path), `${path} is reported`);
  const tableSvg = render(doc({ title: 'T', table: { columns: ['A', 'B'], rows: [['x', 1], [{ value: ['rich ', { text: 'run', bold: true }] }, 2]] } }), { trace: true });
  const tablePaths = new Set(paths(tableSvg));
  for (const path of ['slides.0.table', 'slides.0.table.rows.0.0', 'slides.0.table.rows.1.0']) assert.ok([...tablePaths].some((reported) => reported === path || reported.startsWith(`${path}.`)), `${path} is reported`);
}

// ---------------------------------------------------------------------------------------------------------------------
// 8. Tick labels with a long format stay inside the chart: the horizontal value axis (bars) and the scatter X axis reserve room for the
//    first and last formatted tick label (a General label is short, a code like `$#,##0.00 "million"` is not). General axes keep
//    their placement (section 0 holds the digests).

{
  const long = '$#,##0.00 "million"';
  const textBoxes = (svg) => [...svg.matchAll(/<g data-opf-box-height="[\d.-]+" data-opf-box-width="([\d.-]+)" data-opf-box-x="([\d.-]+)" data-opf-box-y="[\d.-]+"[^>]*path="slides\.0\.blocks\.0\.chart[^"]*"[^>]*><text[^>]*>([^<]*)<\/text>/g)].map(([, width, x, text]) => ({ text, left: Number(x), right: Number(x) + Number(width) }));
  const chartRect = (svg) => { const [, width, x] = svg.match(/<rect data-opf-path="slides\.0\.blocks\.0\.chart" [^>]*?width="([\d.]+)" x="([\d.-]+)"/); return { left: Number(x), right: Number(x) + Number(width) }; };
  const outside = (type, columns, data) => {
    const svg = render(doc({ title: 'T', blocks: [{ chart: { type, data: { columns, rows: data } } }, { text: 'side' }] }), { trace: true });
    const rect = chartRect(svg);
    // A text box carries one font size of padding (8 px each side); the text itself must be inside the chart.
    return textBoxes(svg).filter((box) => box.left + 8 < rect.left || box.right - 8 > rect.right).map((box) => box.text);
  };
  const values = [['Q1', 12400.4, 3000.5], ['Q2', 18100.1, -5000], ['Q3', 21750.75, 2], ['Q4', 9000, 7]];
  for (const type of ['bar', 'stacked-bar']) {
    assert.deepEqual(outside(type, ['Q', { name: 'N', format: long }, { name: 'S', format: long }], values), [], `${type}: formatted value-axis labels stay inside the chart`);
  }
  assert.deepEqual(outside('scatter', ['P', { name: 'X', format: long }, { name: 'Y', format: long }], values), [], 'scatter: formatted X-axis labels stay inside the chart');
}

// ---------------------------------------------------------------------------------------------------------------------
// 9. The legacy sketch plots a gap as nothing: a label that reads as a number ("2020") is not the value of a gap.

{
  const sketch = (rows) => render(chartDoc({ type: 'sketch', data: { columns: ['Year', 'V'], rows } }), { trace: true });
  const heights = (svg) => [...svg.matchAll(/<rect [^>]*data-opf-path="slides\.0\.chart\.data\.rows\.\d"[^>]*height="([\d.]+)"/g)].map(([, height]) => Number(height));
  const [gap, bar] = heights(sketch([['2020', 'n/a'], ['2021', 5]]));
  assert.equal(gap, 0, 'a gap row draws a zero-height mark');
  assert.ok(bar > 0, 'the next row still draws');
  assert.equal(sketch([['2020', 'n/a'], ['2021', 5]]), sketch([['2020', null], ['2021', 5]]), 'a non-numeric string and null are the same gap');
}

console.log('Chart and table data passed: strict numbers, formatted labels, ticks and cells, DataColumn headers, dataset charts and tables, mapping, scatter X, trace paths.');
