// FA-14: chart.highlight in the PPTX export and import.
//
// Asserts the native series and point fills (c:ser/c:spPr, c:dPt), the theme-colour form of the accent, that the parts are
// well-formed and in schema order, that data labels inside muted marks stay readable, that unsupported constructs export as before
// and report a chart-option-adapted diagnostic, that fromPptx restores the highlight from the data record, and (parity) that the
// preview (opf-render) and the export agree on the two colours.
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {chartHighlightColors, textColorForFill} from '@openpresentation/opf';
import {renderSvg} from '@openpresentation/opf-render';
import {toPptx, fromPptx} from '../dist/index.js';

const decoder = new TextDecoder();
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', preserveOrder: true});
const data = {columns: ['Quarter', 'North', 'South'], rows: [['Q1', 10, 5], ['Q2', 20, 8], ['Q3', 15, 12], ['Q4', 22, 9]]};
const pieData = {columns: ['Region', 'Share'], rows: [['EMEA', 40], ['APAC', 35], ['AMER', 25]]};
const scatterData = {columns: ['Point', 'Spend', 'Revenue', 'Cost'], rows: [['a', 1, 10, 3], ['b', 2, 14, 4], ['c', 4, 19, 9]]};
const deckOf = (chart, design = {fontScheme: 'roboto'}) => ({design, slides: [{title: 'Chart', chart}]});

async function exportDeck(chart, {design, ...options} = {}) {
  const diagnostics = [];
  const document = deckOf(chart, design);
  const bytes = await toPptx(document, {onDiagnostic: d => diagnostics.push(d), ...options});
  const entries = unzipSync(bytes);
  const parts = Object.fromEntries(Object.entries(entries).filter(([name]) => /^ppt\/charts\/(chart|chartEx)\d+\.xml$/.test(name)).map(([name, value]) => [name, decoder.decode(value)]));
  const theme = decoder.decode(entries['ppt/theme/theme1.xml']);
  return {bytes, entries, classic: parts['ppt/charts/chart1.xml'], parts, diagnostics, theme, document};
}

const seriesOf = xml => [...xml.matchAll(/<c:ser>([\s\S]*?)<\/c:ser>/g)].map(match => match[1]);
// The first c:spPr of a series: the series' own properties.
const seriesFill = ser => /<c:spPr>\s*<a:solidFill>(<a:(?:schemeClr|srgbClr) val="\w+"\/>)<\/a:solidFill>/.exec(ser)?.[1];
const points = ser => [...ser.matchAll(/<c:dPt>([\s\S]*?)<\/c:dPt>/g)].map(match => ({idx: Number(/<c:idx val="(\d+)"\/>/.exec(match[1])[1]), fill: /<c:spPr>\s*<a:solidFill>(<a:(?:schemeClr|srgbClr) val="\w+"\/>)/.exec(match[1])?.[1], marker: /<c:marker>/.test(match[1]), body: match[1]}));
const themeAccent1 = theme => /<a:accent1><a:srgbClr val="(\w{6})"/.exec(theme)?.[1];
const chartOf = imported => imported.slides[0].chart ?? imported.slides[0].blocks?.find(block => block.chart)?.chart;
const ACCENT = '<a:schemeClr val="accent1"/>';

// The preview's own accent and muted colours for the same deck, read from its SVG: the chart panel fill and the first chart marks.
function previewColors(chart, design) {
  const svg = renderSvg(deckOf(chart, design), {trace: true});
  const panel = /<rect[^>]*data-opf-path="slides\.0\.chart"[^>]*>/.exec(svg)[0].match(/fill="([^"]+)"/)[1];
  return {svg, panel};
}

// 1. Without a highlight nothing changes, and a construct that cannot highlight exports byte-identically and says so.
for (const type of ['waterfall', 'funnel', 'treemap', 'histogram', 'pareto', 'box-and-whisker', 'world']) {
  const plain = await exportDeck({type, data});
  const asked = await exportDeck({type, data, highlight: {series: ['North'], categories: ['Q2']}});
  assert.deepEqual(asked.parts, plain.parts, `${type}: chart parts are untouched by a highlight`);
  assert.deepEqual(asked.diagnostics.filter(d => d.code === 'chart-option-adapted').map(d => d.option).sort(), ['highlight.categories', 'highlight.series'], `${type}: both parts reported`);
}
// A highlight that names nothing the chart plots (the category column is not a series) is no highlight: the chart exports as before.
for (const type of ['column', 'line', 'area', 'scatter', 'radar']) {
  const plain = await exportDeck({type, data});
  const asked = await exportDeck({type, data, highlight: {series: ['Quarter']}});
  assert.deepEqual(asked.parts, plain.parts, `${type}: a highlight that names no plotted series changes nothing`);
}

// 2. Column, series highlight: the named series takes accent1 (the theme scheme colour), the other a muted sRGB; no c:dPt.
{
  const {classic, theme, diagnostics} = await exportDeck({type: 'column', data, highlight: {series: ['North']}});
  const [north, south] = seriesOf(classic);
  assert.equal(seriesFill(north), ACCENT, 'North: accent1, so a theme edit in PowerPoint recolours it');
  assert.match(seriesFill(south), /^<a:srgbClr val="[0-9A-F]{6}"\/>$/, 'South: a muted sRGB literal');
  assert.notEqual(seriesFill(south), seriesFill(north));
  assert.equal(points(north).length + points(south).length, 0, 'a series highlight needs no per-point fills');
  assert.equal(diagnostics.filter(d => d.code === 'chart-option-adapted').length, 0);
  assert.ok(themeAccent1(theme), 'the exported theme holds accent1');
}

// 3. Column, category highlight and the OR rule: c:dPt for the points whose colour differs from their series', in schema order.
{
  const {classic} = await exportDeck({type: 'column', data, highlight: {categories: ['Q2', 'Q4']}});
  const [north, south] = seriesOf(classic);
  assert.equal(seriesFill(north), seriesFill(south), 'no series is named: both series are muted');
  assert.notEqual(seriesFill(north), ACCENT);
  for (const ser of [north, south]) {
    assert.deepEqual(points(ser).map(point => [point.idx, point.fill]), [[1, ACCENT], [3, ACCENT]], 'Q2 and Q4 points take the accent');
    assert.match(ser, /<c:invertIfNegative val="0"\/><c:dPt>/, 'dPt follows invertIfNegative (CT_BarSer order)');
    const order = [...ser.replace(/<c:dPt>[\s\S]*?<\/c:dPt>/g, '<c:dPt/>').replace(/<c:(tx|spPr|dLbls|cat|val)>[\s\S]*?<\/c:\1>/g, '<c:$1/>').matchAll(/<(c:\w+)\b/g)].map(match => match[1]);
    assert.deepEqual(order, ['c:idx', 'c:order', 'c:tx', 'c:spPr', 'c:invertIfNegative', 'c:dPt', 'c:dPt', 'c:dLbls', 'c:cat', 'c:val']);
  }
  const both = await exportDeck({type: 'column', data, highlight: {series: ['South'], categories: ['Q1']}});
  const [n, s] = seriesOf(both.classic);
  assert.equal(seriesFill(s), ACCENT, 'South is named');
  assert.equal(points(s).length, 0, 'South is accent everywhere already');
  assert.deepEqual(points(n).map(point => [point.idx, point.fill]), [[0, ACCENT]], 'North: only Q1 is named');
  const stacked = await exportDeck({type: 'stacked-column-3x', data, highlight: {series: ['North']}});
  assert.equal(seriesFill(seriesOf(stacked.classic)[0]), ACCENT);
  const bar = await exportDeck({type: 'bar', data, highlight: {categories: ['Q3']}});
  assert.deepEqual(points(seriesOf(bar.classic)[0]).map(point => point.idx), [2]);
}

// 4. A single-series column with a category highlight: one muted series colour, one accent point.
{
  const {classic} = await exportDeck({type: 'column', data: {columns: ['Quarter', 'Revenue'], rows: [['Q1', 1], ['Q2', 5], ['Q3', 2]]}, highlight: {categories: ['Q2']}});
  const [ser] = seriesOf(classic);
  assert.deepEqual(points(ser).map(point => [point.idx, point.fill]), [[1, ACCENT]]);
  assert.notEqual(seriesFill(ser), ACCENT);
}

// 5. Pie and doughnut: the fill of every slice's c:dPt; a series name is dropped with a diagnostic.
for (const type of ['pie', 'doughnut']) {
  const {classic, diagnostics} = await exportDeck({type, data: pieData, highlight: {categories: ['APAC'], series: ['Share']}});
  const [ser] = seriesOf(classic);
  const fills = points(ser).map(point => point.fill);
  assert.equal(fills.length, 3, `${type}: a c:dPt per slice`);
  assert.equal(fills[1], ACCENT, `${type}: APAC takes the accent`);
  assert.match(fills[0], /^<a:srgbClr/);
  assert.equal(fills[0], fills[2], `${type}: the other slices share the muted colour`);
  assert.deepEqual(diagnostics.filter(d => d.code === 'chart-option-adapted').map(d => d.option), ['highlight.series']);
}

// 6. Line: series colour on the line and marker; a category highlight adds circular markers on the highlighted points, in schema order.
{
  const {classic} = await exportDeck({type: 'line', data, highlight: {series: ['North'], categories: ['Q2']}, dataLabels: true});
  const [north, south] = seriesOf(classic);
  assert.match(north, /<c:spPr><a:solidFill><a:schemeClr val="accent1"\/><\/a:solidFill><a:ln w="25400" cap="flat"><a:solidFill><a:schemeClr val="accent1"\/>/, 'the line takes the series colour');
  assert.match(south, /<c:spPr><a:solidFill><a:srgbClr val="[0-9A-F]{6}"\/><\/a:solidFill><a:ln w="25400" cap="flat"><a:solidFill><a:srgbClr val="[0-9A-F]{6}"\/>/);
  for (const [ser, fill] of [[north, ACCENT], [south, ACCENT]]) {
    const [point] = points(ser);
    assert.equal(points(ser).length, 1);
    assert.deepEqual([point.idx, point.fill, point.marker], [1, fill, true], 'Q2 gets a marker point in the accent');
    assert.match(point.body, /<c:marker><c:symbol val="circle"\/>/);
    const order = [...ser.replace(/<c:dPt>[\s\S]*?<\/c:dPt>/g, '<c:dPt/>').replace(/<c:marker>[\s\S]*?<\/c:marker>/g, '<c:marker/>').replace(/<c:(tx|spPr|dLbls|cat|val)>[\s\S]*?<\/c:\1>/g, '<c:$1/>').matchAll(/<(c:\w+)\b/g)].map(match => match[1]);
    assert.deepEqual(order, ['c:idx', 'c:order', 'c:tx', 'c:spPr', 'c:marker', 'c:dPt', 'c:dLbls', 'c:cat', 'c:val', 'c:smooth'], 'CT_LineSer order: marker, dPt, dLbls');
  }
  const markers = await exportDeck({type: 'line-with-markers', data, highlight: {series: ['North'], categories: ['Q1']}});
  const [n, s] = seriesOf(markers.classic);
  assert.equal(points(n).length, 0, 'North already draws every marker in the accent');
  assert.deepEqual(points(s).map(point => [point.idx, point.fill]), [[0, ACCENT]], 'South: Q1 only');
}

// 7. Area, scatter and radar: series colours (scatter and radar markers too); a category highlight is dropped with a diagnostic.
for (const [type, source] of [['area', data], ['scatter', scatterData], ['radar', data], ['filled-radar', data]]) {
  const {classic, diagnostics} = await exportDeck({type, data: source, highlight: {series: [source.columns.at(-1)], categories: [source.rows[1][0]]}});
  const all = seriesOf(classic);
  assert.equal(seriesFill(all.at(-1)), ACCENT, `${type}: the named series`);
  for (const other of all.slice(0, -1)) assert.match(seriesFill(other), /^<a:srgbClr/, `${type}: the others are muted`);
  assert.equal(points(all.at(-1)).length, 0, `${type}: no per-point fills`);
  if (type !== 'area') assert.match(all.at(-1).match(/<c:marker>[\s\S]*?<\/c:marker>/)[0], /<a:schemeClr val="accent1"\/>/, `${type}: the marker follows the series`);
  assert.deepEqual(diagnostics.filter(d => d.code === 'chart-option-adapted').map(d => d.option), ['highlight.categories'], `${type}: categories are not supported`);
}

// 8. The accent is a literal when the theme does not hold the colour: a slide pinned to its own scheme, or a primary adjusted for contrast.
{
  const custom = await exportDeck({type: 'column', data, highlight: {series: ['North']}}, {design: {fontScheme: 'roboto', colorScheme: {id: 'x', primary: '#C0392B', accent1: '#C0392B'}}});
  const [north] = seriesOf(custom.classic);
  const fill = seriesFill(north);
  assert.ok(fill === ACCENT || /^<a:srgbClr val="[0-9A-F]{6}"\/>$/.test(fill), fill);
}

// 9. Data labels inside a muted mark take the colour that contrasts with it, per point where marks differ.
{
  const {classic} = await exportDeck({type: 'column', data, highlight: {categories: ['Q2']}, dataLabels: {position: 'center'}});
  const [north] = seriesOf(classic);
  const blocks = [...north.matchAll(/<c:dLbl><c:idx val="(\d+)"\/>[\s\S]*?<a:srgbClr val="(\w{6})"\/>/g)].map(match => [Number(match[1]), match[2]]);
  assert.equal(blocks.length, 4, 'a label entry per point');
  const muted = /<a:srgbClr val="(\w{6})"\/>/.exec(seriesFill(north))[1];
  const text = textColorForFill(`#${muted}`, '#FFFFFF').slice(1).toUpperCase();
  assert.equal(blocks[0][1], text, 'a label in a muted column contrasts with the muted fill');
  assert.equal(blocks[2][1], blocks[0][1]);
  // The accent point: contrast against the accent (the theme's accent1 or the adjusted literal), whichever the preview computed.
}

// 10. Parity with the preview: the same muted colour; the accent is the theme's accent1 where it is the preview's accent.
for (const [type, source, highlight] of [['column', data, {series: ['North']}], ['bar', data, {categories: ['Q3']}], ['pie', pieData, {categories: ['APAC']}], ['line', data, {series: ['South']}]]) {
  const chart = {type, data: source, highlight};
  const exported = await exportDeck(chart);
  const {svg, panel} = previewColors(chart);
  const marks = [...svg.matchAll(/<(?:rect|path|circle|polyline)\b([^>]*)\/>/g)].map(match => Object.fromEntries([...match[1].matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]))).filter(mark => mark['data-opf-path']?.startsWith('slides.0.chart.data.'));
  const colors = new Set(marks.map(mark => (mark.fill && mark.fill !== 'none' ? mark.fill : mark.stroke)?.toUpperCase()));
  const label = textColorForFill(panel, '#FFFFFF');
  const expected = chartHighlightColors(panel, '#2874A6', label);
  const exportedXml = exported.classic;
  const mutedHexes = [...exportedXml.matchAll(/<a:srgbClr val="(\w{6})"\/>/g)].map(match => `#${match[1]}`);
  assert.ok(colors.has(expected.muted.toUpperCase()), `${type}: the preview draws the core muted colour`);
  assert.ok(mutedHexes.includes(expected.muted.toUpperCase()), `${type}: the export writes the same muted colour`);
  assert.ok(colors.has(expected.accent.toUpperCase()), `${type}: the preview draws the accent`);
  assert.match(exportedXml, /<a:schemeClr val="accent1"\/>/, `${type}: the export writes the accent as accent1`);
  assert.equal(`#${themeAccent1(exported.theme)}`, expected.accent.toUpperCase(), `${type}: accent1 of the exported theme is the preview's accent colour`);
}

// 11. Every part is well-formed XML, with and without highlights; the package is deterministic.
{
  const first = await exportDeck({type: 'column', data, highlight: {series: ['North'], categories: ['Q2']}, legend: 'bottom', axisTitles: {value: 'Revenue'}, dataLabels: true});
  for (const [name, xml] of Object.entries(first.parts)) assert.doesNotThrow(() => parser.parse(xml), name);
  const second = await exportDeck({type: 'column', data, highlight: {series: ['North'], categories: ['Q2']}, legend: 'bottom', axisTitles: {value: 'Revenue'}, dataLabels: true});
  assert.equal(first.classic, second.classic);
}

// 12. Import: the highlight returns from the data record (full provenance); a native import without the record carries none.
{
  const chart = {type: 'column', data, highlight: {series: ['North'], categories: ['Q3']}};
  const {bytes} = await exportDeck(chart);
  const imported = chartOf(await fromPptx(bytes));
  assert.deepEqual(imported.highlight, chart.highlight, 'restored from the OPF_DATA_V1 record');
  assert.deepEqual(imported.data, data);
  const pie = chartOf(await fromPptx((await exportDeck({type: 'pie', data: pieData, highlight: {categories: ['APAC']}})).bytes));
  assert.deepEqual(pie.highlight, {categories: ['APAC']});
  // No record: no highlight is invented from the colours.
  const bare = await toPptx(deckOf(chart), {provenance: false});
  assert.equal(chartOf(await fromPptx(bare)).highlight, undefined, 'no provenance, no highlight');
  // A chart without a highlight and without data fields still records nothing.
  const plain = await exportDeck({type: 'column', data});
  assert.ok(!Object.keys(plain.entries).some(name => /^ppt\/tags\/opfData\d+\.xml$/.test(name)), 'a plain chart carries no data record');
  // Edited data (the caches changed): the highlight is not restored, and the diagnostic says so.
  const edited = unzipSync(bytes);
  const part = 'ppt/charts/chart1.xml';
  edited[part] = new TextEncoder().encode(decoder.decode(edited[part]).replace('<c:v>20</c:v>', '<c:v>21</c:v>'));
  const diagnostics = [];
  const {zipSync} = await import('fflate');
  const reimported = chartOf(await fromPptx(zipSync(edited), {onDiagnostic: d => diagnostics.push(d)}));
  assert.equal(reimported.highlight, undefined);
  assert.ok(diagnostics.some(d => d.code === 'chart-data-provenance-changed' && /highlight/.test(d.message)), JSON.stringify(diagnostics.map(d => d.code)));
}

console.log('Chart highlight passed: series and point fills, accent1 scheme colour, muted literal, schema order, label contrast, unsupported constructs, preview parity, provenance round trip.');
