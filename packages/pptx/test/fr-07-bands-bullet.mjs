import assert from 'node:assert/strict';
import {test} from 'node:test';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {gallery} from '@openpresentation/gallery';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {toPptx, fromPptx} from '../dist/index.js';
import {BANDS_URI, readNativeBands} from '../dist/chart-bands.js';

// FR-07 (CR 5): bands export as a stacked chart group drawn first on deleted axes fixed to the value axis's span, a bullet chart as a clustered
// measure, its bands and a target scatter with Y error bars; import restores the authored chart while the caches are unchanged and reads the
// bands and targets PowerPoint holds after an edit.

const kpis = {columns: ['KPI', {name: 'Actual', format: '0%'}, {name: 'Target', format: '0%'}], rows: [['Win rate', 0.31, 0.35], ['Retention', 0.92, 0.9], ['NPS', 0.64, null]]};
const wait = {columns: ['Week', 'Wait'], rows: [['W1', 14], ['W2', 11], ['W3', 9], ['W4', 12]]};
const deck = () => ({
  name: 'Bands',
  language: 'en-US',
  datasets: {kpis},
  slides: [
    {title: 'Wait', chart: {type: 'column', data: wait, legend: 'bottom', bands: [{to: 10, label: 'Within target', color: 'accent3'}, {to: 15}, {to: 20, label: 'Over target'}], alt: 'Wait by week.'}},
    {title: 'KPIs', chart: {type: 'bullet', data: {dataset: 'kpis'}, mapping: {category: 'KPI', series: ['Actual'], target: 'Target'}, bands: [{to: 0.6, label: 'Poor'}, {to: 0.85, label: 'Fair'}, {to: 1, label: 'Good'}], alt: 'KPIs against targets.'}},
    {title: 'Trend', chart: {type: 'line', data: wait, bands: [{to: 10}, {to: 20}], referenceLines: [{value: 12, label: 'Plan'}], alt: 'Wait trend.'}},
    {title: 'Plain', chart: {type: 'column', data: wait, alt: 'Wait by week.'}},
  ],
});
const exportDeck = async source => toPptx(source, {catalogs: [gallery], fonts: await loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'auto', presentation: source})});
const importDeck = async (bytes, diagnostics = []) => fromPptx(bytes, {catalogs: [gallery], onDiagnostic: d => diagnostics.push(d)});
const chartXml = (bytes, n) => strFromU8(unzipSync(bytes)[`ppt/charts/chart${n}.xml`]);
const groups = xml => [...xml.matchAll(/<c:(barChart|lineChart|areaChart|scatterChart)>([\s\S]*?)<\/c:\1>/g)].map(([group, element]) => ({element, group, axes: [...group.matchAll(/<c:axId val="(\d+)"\/>/g)].map(m => m[1])}));
const axis = (xml, id) => new RegExp(`<c:(?:valAx|catAx)>\\s*<c:axId val="${id}"\\/>[\\s\\S]*?<\\/c:(?:valAx|catAx)>`).exec(xml)?.[0];
const presentationOf = result => result.presentation ?? result.document ?? result;

let exported;
const bytes = async () => (exported ??= await exportDeck(deck()));

test('a column chart with bands: a stacked band group first, on deleted axes fixed to the value axis span, painted and named', async () => {
  const xml = chartXml(await bytes(), 1), parts = groups(xml);
  assert.deepEqual(parts.map(part => part.element), ['barChart', 'barChart']);
  const [band, data] = parts;
  assert.match(band.group, /<c:grouping val="stacked"\/>/);
  assert.match(band.group, /<c:gapWidth val="0"\/>/);
  assert.match(band.group, /<c:overlap val="100"\/>/);
  assert.match(data.group, /<c:grouping val="clustered"\/>/);
  assert.equal(band.group.split('<opf:band ').length - 1, 3, 'every band series carries the band extension');
  assert.doesNotMatch(band.group, /<c:dLbls>/);
  for (const id of band.axes) assert.match(axis(xml, id), /<c:delete val="1"\/>/, `band axis ${id} deleted`);
  const valueAxis = axis(xml, data.axes[1]), bandAxis = axis(xml, band.axes[1]);
  assert.equal(/<c:max val="([^"]+)"/.exec(bandAxis)[1], /<c:max val="([^"]+)"/.exec(valueAxis)[1], 'the band axis spans the value axis (min 0)');
  assert.match(bandAxis, /<c:min val="0"\/>/);
  // Heights: 10, 5, 5; the first band's name and its tint; an unlabeled band is "Band 2" and has no legend entry.
  const heights = [...band.group.matchAll(/<c:val>[\s\S]*?<c:v>([^<]*)<\/c:v>/g)].map(m => Number(m[1]));
  assert.deepEqual(heights, [10, 5, 5]);
  assert.match(band.group, /<c:v>Within target<\/c:v>[\s\S]*?<a:srgbClr val="[0-9A-F]{6}"\/>/);
  assert.match(band.group, /<c:v>Band 2<\/c:v>/);
  assert.match(xml, /<c:legendEntry><c:idx val="2"\/><c:delete val="1"\/><\/c:legendEntry>/);
});

test('a bullet chart: bands, a clustered measure with gap 200, a target scatter with fixed Y error bars on its own deleted axes', async () => {
  const xml = chartXml(await bytes(), 2), parts = groups(xml);
  assert.deepEqual(parts.map(part => part.element), ['barChart', 'barChart', 'scatterChart']);
  assert.match(parts[0].group, /<c:barDir val="bar"\/><c:grouping val="stacked"\/>/);
  assert.match(parts[1].group, /<c:gapWidth val="200"\/>/);
  const scatter = parts[2].group;
  assert.match(scatter, /<c:marker><c:symbol val="none"\/><\/c:marker>/);
  assert.match(scatter, /<c:errBars><c:errDir val="y"\/><c:errBarType val="both"\/><c:errValType val="fixedVal"\/><c:noEndCap val="1"\/><c:val val="0\.333333333333333"\/>/);
  assert.match(scatter, /<c:xVal>\s*<c:numRef><c:f>Sheet1!\$C\$2:\$C\$4<\/c:f>/, 'the target column of the workbook');
  // Y: the row centers of the rows with a target (the third has none).
  assert.deepEqual([...(/<c:yVal>([\s\S]*?)<\/c:yVal>/.exec(scatter)[1]).matchAll(/<c:v>([^<]*)<\/c:v>/g)].map(m => Number(m[1])), [0.5, 1.5]);
  for (const id of parts[2].axes) assert.match(axis(xml, id), /<c:delete val="1"\/>/);
  assert.match(axis(xml, parts[2].axes[1]), /<c:orientation val="maxMin"\/><c:max val="3"\/><c:min val="0"\/>/);
  assert.match(axis(xml, parts[1].axes[0]), /<c:orientation val="maxMin"\/>/, 'the first category on top');
});

test('a line chart with bands and a reference line: a stacked area group first, the line and its helper on the primary axes', async () => {
  const xml = chartXml(await bytes(), 3), parts = groups(xml);
  assert.equal(parts[0].element, 'areaChart');
  assert.match(parts[0].group, /^<c:areaChart><c:grouping val="stacked"\/>/);
  assert.ok(parts.slice(1).every(part => part.element === 'lineChart'));
  assert.ok(!/<c:crossBetween val="midCat"\/>/.test(xml), 'the line keeps its points between the ticks');
});

test('a chart without bands writes one group and no band extension', async () => {
  const xml = chartXml(await bytes(), 4);
  assert.equal(groups(xml).length, 1);
  assert.ok(!xml.includes(BANDS_URI));
  assert.equal((xml.match(/<c:valAx>/g) ?? []).length, 1);
});

test('import restores the authored chart while the caches are unchanged', async () => {
  const diagnostics = [];
  const slides = presentationOf(await importDeck(await bytes(), diagnostics)).slides;
  assert.deepEqual(slides[0].chart.bands, deck().slides[0].chart.bands);
  assert.equal(slides[1].chart.type, 'bullet');
  assert.deepEqual(slides[1].chart.mapping, {category: 'KPI', series: ['Actual'], target: 'Target'});
  assert.deepEqual(slides[1].chart.data, {dataset: 'kpis'});
  assert.deepEqual(slides[1].chart.bands, deck().slides[1].chart.bands);
  assert.deepEqual(slides[2].chart.bands, [{to: 10}, {to: 20}]);
  assert.deepEqual(slides[2].chart.referenceLines.map(line => line.value), [12]);
  assert.equal(slides[3].chart.bands, undefined);
});

test('after an edit in Edit Data the chart imports what PowerPoint holds: bands from the cached heights, targets from the scatter', async () => {
  const parts = unzipSync(await bytes());
  // A band height (Within target 10 -> 12) and a target (Win rate 0.35 -> 0.4) edited in PowerPoint's caches.
  parts['ppt/charts/chart1.xml'] = strToU8(strFromU8(parts['ppt/charts/chart1.xml']).replace(/(<c:v>Within target<\/c:v>[\s\S]*?<c:val>[\s\S]*?<c:pt idx="0"><c:v>)10(<\/c:v>)/, '$112$2'));
  parts['ppt/charts/chart2.xml'] = strToU8(strFromU8(parts['ppt/charts/chart2.xml']).replace(/(<c:xVal>[\s\S]*?<c:pt idx="0"><c:v>)0\.35(<\/c:v>)/, '$10.4$2'));
  const diagnostics = [];
  const slides = presentationOf(await importDeck(zipSync(parts), diagnostics)).slides;
  assert.ok(diagnostics.some(d => d.code === 'chart-data-provenance-changed'));
  assert.deepEqual(slides[0].chart.bands.map(band => band.to), [12, 17, 22]);
  assert.equal(slides[0].chart.bands[0].label, 'Within target');
  assert.equal(slides[1].chart.type, 'bullet');
  assert.equal(slides[1].chart.mapping.target, 'Target');
  assert.equal(slides[1].chart.data.rows[0][2], 0.4);
  assert.equal(slides[1].chart.data.rows[2][2], null, 'a row without a target stays without one');
});

test('readNativeBands leaves a part without bands unchanged', () => {
  const xml = '<c:chartSpace><c:chart><c:plotArea><c:barChart/></c:plotArea></c:chart></c:chartSpace>';
  assert.deepEqual(readNativeBands(xml), {xml});
});
