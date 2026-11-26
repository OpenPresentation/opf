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
    {title: 'KPIs', chart: {type: 'bullet', data: {dataset: 'kpis'}, mapping: {category: 'KPI', series: ['Actual'], target: 'Target'}, legend: 'bottom', bands: [{to: 0.6, label: 'Poor'}, {to: 0.85, label: 'Fair'}, {to: 1, label: 'Good'}], alt: 'KPIs against targets.'}},
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

test('a column chart with bands: a stacked band group first on the visible axes, the data on deleted axes of the same scale', async () => {
  const xml = chartXml(await bytes(), 1), parts = groups(xml);
  assert.deepEqual(parts.map(part => part.element), ['barChart', 'barChart']);
  const [band, data] = parts;
  assert.match(band.group, /<c:grouping val="stacked"\/>/);
  assert.match(band.group, /<c:gapWidth val="0"\/>/);
  assert.match(band.group, /<c:overlap val="100"\/>/);
  assert.match(data.group, /<c:grouping val="clustered"\/>/);
  assert.equal(band.group.split('<opf:band ').length - 1, 3, 'every band series carries the band extension');
  assert.doesNotMatch(band.group, /<c:dLbls>/);
  // Decision A (native check 2026-11-25): the bands on the first (primary, visible) pair, the data on the second (deleted, same bounds).
  assert.deepEqual(band.axes, ['2094734554', '2094734552']);
  assert.deepEqual(data.axes, ['2094734555', '2094734553']);
  for (const id of data.axes) assert.match(axis(xml, id), /<c:delete val="1"\/>/, `data axis ${id} deleted`);
  const visible = axis(xml, band.axes[1]), hidden = axis(xml, data.axes[1]);
  const scaling = (text) => /<c:scaling>[\s\S]*?<\/c:scaling>/.exec(text)[0].replace(/\s+/g, '');
  assert.equal(scaling(hidden), scaling(visible), 'one scale for bands and data');
  // Stacked from 0: the first band's value is its end, then the heights; its name and tint; an unlabeled band is "Band 2" and, the bands being
  // listed first, its legend entry is its position (1).
  const heights = [...band.group.matchAll(/<c:val>[\s\S]*?<c:v>([^<]*)<\/c:v>/g)].map(m => Number(m[1]));
  assert.deepEqual(heights, [10, 5, 5]);
  assert.match(band.group, /<c:v>Within target<\/c:v>[\s\S]*?<a:srgbClr val="[0-9A-F]{6}"\/>/);
  assert.match(band.group, /<c:v>Band 2<\/c:v>/);
  assert.match(xml, /<c:legendEntry><c:idx val="1"\/><c:delete val="1"\/><\/c:legendEntry>/);
  assert.equal((xml.match(/<c:legendEntry>/g) ?? []).length, 1);
  // Its labels meet the columns at both places (composition's fallback): they stay in the legend, bands first, and no band has a data label.
  assert.doesNotMatch(band.group, /<c:dLbl>/);
});

test('a bullet chart: bands, a clustered measure with gap 200, a target scatter with fixed Y error bars on the measure\'s axes', async () => {
  const xml = chartXml(await bytes(), 2), parts = groups(xml);
  assert.deepEqual(parts.map(part => part.element), ['barChart', 'barChart', 'scatterChart']);
  assert.match(parts[0].group, /<c:barDir val="bar"\/><c:grouping val="stacked"\/>/);
  assert.match(parts[1].group, /<c:gapWidth val="200"\/>/);
  const scatter = parts[2].group;
  assert.match(scatter, /<c:marker><c:symbol val="none"\/><\/c:marker>/);
  assert.match(scatter, /<c:errBars><c:errDir val="y"\/><c:errBarType val="both"\/><c:errValType val="fixedVal"\/><c:noEndCap val="1"\/><c:val val="0\.333333333333333"\/>/);
  assert.match(scatter, /<c:xVal>\s*<c:numRef><c:f>Sheet1!\$C\$2:\$C\$4<\/c:f>/, 'the target column of the workbook');
  // Y: the category position of the rows with a target (the third has none); the scatter shares the measure's (secondary) pair, X its value
  // axis and Y its reversed category axis: two axis pairs in all (a third pair makes PowerPoint reject the file).
  assert.deepEqual([...(/<c:yVal>([\s\S]*?)<\/c:yVal>/.exec(scatter)[1]).matchAll(/<c:v>([^<]*)<\/c:v>/g)].map(m => Number(m[1])), [1, 2]);
  assert.deepEqual(parts[0].axes, ['2094734554', '2094734552'], 'bands on the primary pair');
  assert.deepEqual(parts[1].axes, ['2094734555', '2094734553'], 'the measure on the secondary pair');
  assert.deepEqual(parts[2].axes, ['2094734553', '2094734555'], 'the target on the measure\'s pair');
  assert.equal((xml.match(/<c:(?:valAx|catAx)>/g) ?? []).length, 4);
  assert.match(axis(xml, parts[1].axes[0]), /<c:orientation val="maxMin"\/>/, 'the first category on top');
  // The band labels fit inside their strips (owner's '1B'): one data label per band on its top row's point, showing the series name at
  // composition's box; the legend lists the measure only (the bands' entries, 0 to 2, and the target's, the last, are deleted).
  for (const idx of [0, 1, 2, 4]) assert.match(xml, new RegExp('<c:legendEntry><c:idx val="' + idx + '"/><c:delete val="1"/></c:legendEntry>'));
  const bandLabels = [...parts[0].group.matchAll(/<c:dLbl>([\s\S]*?)<\/c:dLbl>/g)].map((m) => m[1]);
  assert.equal(bandLabels.length, 3);
  for (const label of bandLabels) {
    assert.match(label, /^<c:idx val="0"\/><c:layout><c:manualLayout><c:xMode val="edge"\/><c:yMode val="edge"\/>/);
    assert.match(label, /<c:showSerName val="1"\/>/);
  }
  // The preview's plot as the inner plot layout.
  assert.match(xml, /<c:plotArea>\s*<c:layout>\s*<c:manualLayout>\s*<c:layoutTarget val="inner"\/>/);
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

test('an axis below zero: bar bands split at 0 (the parts below first, highest band first), area bands over an unfilled base; read back natively', async () => {
  const signed = {columns: ['Q', 'Change'], rows: [['Q1', -5], ['Q2', 8], ['Q3', 3]]};
  const bands = [{to: -2, label: 'Loss'}, {to: 4, label: 'Flat'}, {to: 10, label: 'Gain'}];
  const source = {name: 'Signed', language: 'en-US', slides: [
    {title: 'Bars', chart: {type: 'column', data: signed, bands, alt: 'x'}},
    {title: 'Areas', chart: {type: 'area', data: signed, bands, alt: 'x'}},
  ]};
  const exported = await exportDeck(source);
  const bars = groups(chartXml(exported, 1))[0].group, areas = groups(chartXml(exported, 2))[0].group;
  const parts = group => [...group.matchAll(/<c:ser>[\s\S]*?<\/c:ser>/g)].map(([ser]) => [/<c:tx>[\s\S]*?<c:v>([^<]*)<\/c:v>/.exec(ser)[1], Number(/<c:val>[\s\S]*?<c:v>([^<]*)<\/c:v>/.exec(ser)[1])]);
  const axisMin = Number(/<c:min val="([^"]+)"/.exec(axis(chartXml(exported, 1), '2094734552'))[1]);
  assert.ok(axisMin < -5, `axis min ${axisMin}`);
  // Below 0: Flat's part (-2..0) next to 0, then Loss (min..-2); above 0: Flat 0..4, Gain 4..10.
  assert.deepEqual(parts(bars), [['Flat below zero', -2], ['Loss', axisMin + 2], ['Flat', 4], ['Gain', 6]]);
  assert.deepEqual(parts(areas), [['Band base', axisMin], ['Loss', -2 - axisMin], ['Flat', 6], ['Gain', 6]]);
  // Natively (the record set aside) the same ends come back.
  for (const n of [1, 2]) assert.deepEqual(readNativeBands(chartXml(exported, n)).bands.map(band => [band.to, band.label]), [[-2, 'Loss'], [4, 'Flat'], [10, 'Gain']]);
});
