// FF-22: every classic chart type the core catalog keeps exports the exact
// native construct for its Aspose.Slides ChartType and imports back to the
// same id; deprecated ids export like their replacement; other ids keep the
// legacy construct.
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {catalogs} from '@openpresentation/opf';
import {toPptx, fromPptx} from '../dist/index.js';
import {CHART_TYPES, CHARTEX_FALLBACK, DEPRECATED_CHART_TYPES, resolveChartType} from '../dist/chart-types.js';

const decoder = new TextDecoder();
const categoryData = {columns: ['Quarter', 'North', 'South', 'West'], rows: [['Q1', 4, 3, 2], ['Q2', 5, 2, 3], ['Q3', 6, 4, 1]]};
const scatterData = {columns: ['Point', 'Spend', 'Revenue', 'Margin'], rows: [['a', 1, 10, 3], ['b', 2, 14, 4], ['c', 4, 19, 6]]};
const dataFor = (id) => (CHART_TYPES[id].family === 'xy' ? scatterData : categoryData);

async function exportChart(type, data) {
  const bytes = await toPptx({slides: [{title: type, chart: {type, data}}]});
  const entries = unzipSync(bytes);
  const xml = decoder.decode(entries['ppt/charts/chart1.xml']);
  const imported = (await fromPptx(bytes)).slides[0];
  const chart = imported.chart ?? imported.blocks?.find((block) => block.chart)?.chart;
  return {xml, chart};
}

function construct(xml) {
  const plot = xml.match(/<c:plotArea>([\s\S]*)<\/c:plotArea>/)[1];
  const element = plot.match(/<c:(\w+Chart)>/)[1];
  const body = plot.match(new RegExp(`<c:${element}>([\\s\\S]*?)</c:${element}>`))[1];
  const val = (name) => body.match(new RegExp(`<c:${name} val="([^"]*)"/>`))?.[1];
  const series = [...body.matchAll(/<c:ser>([\s\S]*?)<\/c:ser>/g)].map((m) => m[1]);
  return {
    element,
    body,
    barDir: val('barDir'),
    grouping: val('grouping'),
    overlap: val('overlap'),
    radarStyle: val('radarStyle'),
    series,
    symbols: series.map((ser) => ser.match(/<c:marker>\s*<c:symbol val="([^"]*)"/)?.[1]),
    valFormat: plot.match(/<c:valAx>[\s\S]*?<c:numFmt formatCode="([^"]*)"/)?.[1],
  };
}

const expected = {
  column: {element: 'barChart', barDir: 'col', grouping: 'clustered'},
  'stacked-column-3x': {element: 'barChart', barDir: 'col', grouping: 'stacked', overlap: '100'},
  '100pct-stacked-column-3x': {element: 'barChart', barDir: 'col', grouping: 'percentStacked', overlap: '100', valFormat: '0%'},
  bar: {element: 'barChart', barDir: 'bar', grouping: 'clustered'},
  'stacked-bar-3x': {element: 'barChart', barDir: 'bar', grouping: 'stacked', overlap: '100'},
  '100pct-stacked-bar-3x': {element: 'barChart', barDir: 'bar', grouping: 'percentStacked', overlap: '100', valFormat: '0%'},
  line: {element: 'lineChart', grouping: 'standard', symbol: 'none'},
  'line-with-markers': {element: 'lineChart', grouping: 'standard', symbol: 'circle'},
  'stacked-line-3x': {element: 'lineChart', grouping: 'stacked', symbol: 'none'},
  'stacked-line-with-markers-3x': {element: 'lineChart', grouping: 'stacked', symbol: 'circle'},
  area: {element: 'areaChart', grouping: 'standard'},
  'stacked-area-3x': {element: 'areaChart', grouping: 'stacked'},
  '100pct-stacked-area-3x': {element: 'areaChart', grouping: 'percentStacked', valFormat: '0%'},
  pie: {element: 'pieChart', seriesCount: 1},
  doughnut: {element: 'doughnutChart', seriesCount: 1},
  scatter: {element: 'scatterChart', seriesCount: 2, symbol: 'circle'},
  radar: {element: 'radarChart', radarStyle: 'standard', symbol: 'none'},
  'radar-with-markers': {element: 'radarChart', radarStyle: 'marker', symbol: 'circle'},
  'filled-radar': {element: 'radarChart', radarStyle: 'filled'},
};

const classic = Object.keys(CHART_TYPES).filter((id) => CHART_TYPES[id].family !== 'chartex');
assert.deepEqual(classic.sort(), Object.keys(expected).sort(), 'every classic kept chart type has an expectation');

let checked = 0;
for (const [id, want] of Object.entries(expected)) {
  const data = dataFor(id);
  const {xml, chart} = await exportChart(id, data);
  const got = construct(xml);
  for (const key of ['element', 'barDir', 'grouping', 'overlap', 'radarStyle', 'valFormat']) {
    if (want[key] !== undefined) assert.equal(got[key], want[key], `${id}: ${key}`);
  }
  if (want.seriesCount !== undefined) assert.equal(got.series.length, want.seriesCount, `${id}: series count`);
  if (want.symbol !== undefined) assert.ok(got.symbols.every((symbol) => symbol === want.symbol), `${id}: marker symbols ${got.symbols}`);
  if (got.element === 'lineChart' || got.element === 'areaChart') {
    assert.ok(got.body.startsWith(`<c:grouping val="${want.grouping}"/>`), `${id}: grouping is the first child (CT_${got.element})`);
    assert.doesNotMatch(got.body, /<c:invertIfNegative/, `${id}: invertIfNegative belongs to bar series only`);
  }
  assert.equal(chart.type, id, `${id}: imports back to the same chart type id`);
  if (id === 'pie' || id === 'doughnut') assert.deepEqual(chart.data, {columns: data.columns.slice(0, 2), rows: data.rows.map((row) => row.slice(0, 2))});
  else if (id === 'scatter') assert.deepEqual(chart.data.rows.map((row) => row.slice(1)), data.rows.map((row) => row.slice(1)), 'scatter X/Y values round-trip');
  else assert.deepEqual(chart.data, data, `${id}: data round-trips`);
  checked++;
}

// Deprecated ids export exactly like their replacement and import as it.
for (const [deprecated, replacement] of Object.entries(DEPRECATED_CHART_TYPES)) {
  assert.equal(resolveChartType(deprecated).id, replacement);
  if (CHART_TYPES[replacement].family === 'chartex') continue;
  const data = dataFor(replacement);
  const [a, b] = await Promise.all([exportChart(deprecated, data), exportChart(replacement, data)]);
  const strip = (xml) => construct(xml).body;
  assert.equal(strip(a.xml), strip(b.xml), `${deprecated} exports like ${replacement}`);
  assert.equal(a.chart.type, replacement, `${deprecated} imports as ${replacement}`);
  checked++;
}

// Ids outside the core catalog keep the legacy heuristic.
for (const [id, element, barDir] of [['custom-kpi', 'barChart', 'col'], ['my-bar', 'barChart', 'bar'], ['trend-line', 'lineChart', undefined], ['donut', 'doughnutChart', undefined]]) {
  const got = construct((await exportChart(id, categoryData)).xml);
  assert.equal(got.element, element, id);
  if (barDir) assert.equal(got.barDir, barDir, id);
  checked++;
}

// The tables agree with the core catalog (@openpresentation/opf catalogs.chartTypes): the same kept and deprecated ids,
// the same replacements, and the catalog's Open XML construct for every classic kept id, both in the table and in the exported part.
const records = new Map(catalogs.chartTypes.map((record) => [record.id, record]));
const keptRecords = catalogs.chartTypes.filter((record) => !record.deprecation);
const deprecatedRecords = catalogs.chartTypes.filter((record) => record.deprecation);
assert.deepEqual(Object.keys(CHART_TYPES).sort(), keptRecords.map((record) => record.id).sort(), 'kept ids match the catalog');
assert.deepEqual(Object.keys(DEPRECATED_CHART_TYPES).sort(), deprecatedRecords.map((record) => record.id).sort(), 'deprecated ids match the catalog');
for (const record of deprecatedRecords) assert.equal(DEPRECATED_CHART_TYPES[record.id], record.deprecation.replacedBy, `${record.id}: replacedBy`);
for (const replacement of Object.values(DEPRECATED_CHART_TYPES)) assert.ok(Object.hasOwn(CHART_TYPES, replacement) && !records.get(replacement).deprecation, `${replacement} is a kept id`);
const nativeElement = {bar: 'barChart', line: 'lineChart', area: 'areaChart', pie: 'pieChart', doughnut: 'doughnutChart', scatter: 'scatterChart', radar: 'radarChart'};
for (const record of keptRecords) {
  const spec = CHART_TYPES[record.id];
  const openxml = record.mappings.openxml;
  assert.equal(spec.aspose, record.mappings.renderers['aspose-slides'].chartType, `${record.id}: Aspose.Slides ChartType`);
  assert.equal(spec.family === 'chartex', openxml.composition === 'extension', `${record.id}: chartex family is the catalog's extension composition`);
  if (spec.family === 'chartex') continue;
  assert.equal(openxml.composition, 'single', record.id);
  assert.equal(nativeElement[spec.pptx], openxml.element, `${record.id}: chart element`);
  if (spec.pptx === 'bar') assert.equal(spec.barDir, openxml.barDir, `${record.id}: barDir`);
  else assert.equal(openxml.barDir, undefined, `${record.id}: only bar charts have barDir`);
  if (spec.family === 'category' && spec.pptx !== 'radar') assert.equal(spec.grouping, openxml.grouping ?? 'standard', `${record.id}: grouping (an absent catalog grouping is standard)`);
  else assert.equal(openxml.grouping, undefined, `${record.id}: no grouping`);
  assert.equal(spec.radarStyle, openxml.radarStyle, `${record.id}: radarStyle`);
  assert.equal(spec.family === 'xy' ? 'marker' : undefined, openxml.scatterStyle, `${record.id}: scatterStyle`);
  if (spec.pptx === 'line') assert.equal(spec.markers, openxml.marker === true, `${record.id}: marker`);
  if (spec.pptx === 'radar') assert.equal(spec.markers, openxml.radarStyle === 'marker', `${record.id}: radar markers`);
  // The exported part states the same construct.
  const {xml} = await exportChart(record.id, dataFor(record.id));
  const got = construct(xml);
  assert.equal(got.element, openxml.element, `${record.id}: exported element`);
  assert.equal(got.barDir, openxml.barDir, `${record.id}: exported barDir`);
  if (spec.pptx !== 'radar' && spec.family === 'category') assert.equal(got.grouping, openxml.grouping ?? 'standard', `${record.id}: exported grouping`);
  assert.equal(got.radarStyle, openxml.radarStyle, `${record.id}: exported radarStyle`);
  assert.equal(xml.match(/<c:scatterStyle val="([^"]*)"\/>/)?.[1], openxml.scatterStyle, `${record.id}: exported scatterStyle`);
  if (spec.pptx === 'scatter') assert.ok(got.series.every((ser) => /<c:spPr>[\s\S]*?<a:ln[^>]*>\s*<a:noFill\/>/.test(ser)), 'scatter markers are drawn without a connecting line');
  if (spec.pptx === 'line' || spec.pptx === 'radar') {
    const expectMarkers = openxml.marker === true || openxml.radarStyle === 'marker';
    assert.ok(got.symbols.every((symbol) => (symbol !== 'none') === expectMarkers), `${record.id}: exported marker symbols ${got.symbols}`);
  }
  checked++;
}

// No silent loss: a pie or doughnut plots one series and a chartex type is written as a clustered column chart; both say so.
async function diagnosticsFor(type, data) {
  const diagnostics = [];
  const bytes = await toPptx({slides: [{title: type, chart: {type, data}}]}, {onDiagnostic: (diagnostic) => diagnostics.push(diagnostic)});
  const entries = unzipSync(bytes);
  return {diagnostics: diagnostics.filter((diagnostic) => diagnostic.code === 'chart-data-adapted'), xml: decoder.decode(entries['ppt/charts/chart1.xml']), chartex: Object.hasOwn(entries, 'ppt/charts/chartEx1.xml')};
}
for (const type of ['pie', 'doughnut']) {
  const {diagnostics, xml} = await diagnosticsFor(type, categoryData);
  assert.deepEqual(diagnostics.map((diagnostic) => [diagnostic.adaptation, diagnostic.path]), [['series-dropped', 'slides.0.chart']], type);
  assert.match(diagnostics[0].message, /first series 'North'.*other 2 \('South', 'West'\) are not/, type);
  assert.equal(construct(xml).series.length, 1, `${type}: only the first series is written`);
  const single = await diagnosticsFor(type, {columns: ['Quarter', 'North'], rows: [['Q1', 4], ['Q2', 5]]});
  assert.deepEqual(single.diagnostics, [], `${type}: one series is unchanged and silent`);
  checked++;
}
// By default ('auto') a confirmed chartex type is written natively (test/chartex.mjs): its classic part is the clustered
// column mc:Fallback and no fallback is reported. The unconfirmed map keeps the clustered column chart and reports it.
const chartexTypes = Object.keys(CHART_TYPES).filter((id) => CHART_TYPES[id].family === 'chartex');
for (const type of [...chartexTypes, 'treemap-2x', 'australia']) {
  const single = {columns: categoryData.columns.slice(0, 2), rows: categoryData.rows.map((row) => row.slice(0, 2))};
  const {diagnostics, xml, chartex} = await diagnosticsFor(type, type === 'box-and-whisker' ? categoryData : single);
  const unconfirmed = Boolean(resolveChartType(type).spec.unconfirmed);
  assert.deepEqual(diagnostics.map((diagnostic) => diagnostic.adaptation), unconfirmed ? ['chartex-fallback'] : [], `${type}: ${unconfirmed ? 'fallback reported' : 'no adaptation for its own data shape'}`);
  if (unconfirmed) assert.match(diagnostics[0].message, /not yet accepted natively.*chartex: 'native'/, type);
  assert.equal(chartex, !unconfirmed, `${type}: a chartEx part is written exactly for confirmed constructs`);
  const got = construct(xml);
  assert.deepEqual([got.element, got.barDir, got.grouping], ['barChart', 'col', 'clustered'], `${type}: the classic part is a clustered column chart`);
  assert.equal(CHARTEX_FALLBACK, CHART_TYPES.column);
  checked++;
}
assert.deepEqual(chartexTypes.filter((id) => CHART_TYPES[id].unconfirmed), ['world'], 'only the map is unconfirmed natively');
// A single-series chartex construct given several series keeps the first and says so, like a pie (the map's fallback keeps every series).
for (const type of ['treemap', 'waterfall', 'funnel', 'histogram', 'pareto']) {
  const {diagnostics} = await diagnosticsFor(type, categoryData);
  assert.deepEqual(diagnostics.map((diagnostic) => [diagnostic.adaptation, diagnostic.path]), [['series-dropped', 'slides.0.chart']], type);
}
// Classic kept ids and legacy ids report nothing.
for (const type of [...classic, 'custom-kpi']) {
  if (['pie', 'doughnut'].includes(type)) continue;
  const {diagnostics} = await diagnosticsFor(type, dataFor(type in CHART_TYPES ? type : 'column'));
  assert.deepEqual(diagnostics, [], `${type}: no adaptation`);
}

console.log(`Chart types passed: ${checked} exports (${Object.keys(expected).length} classic Aspose chart types, ${Object.keys(DEPRECATED_CHART_TYPES).length} deprecated aliases, legacy ids) with exact constructs and same-id reimport.`);
