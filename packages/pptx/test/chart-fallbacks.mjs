// LH-60 and LH-56 in the PPTX export: core's chartDrawPlan decides the construct, so PowerPoint shows what the preview draws (a map over
// categories that are not places as clustered columns, a pie or doughnut of several series as nested rings, one box per series, a scatter
// by position), the fallback is reported, import restores the authored data, and labels inside chartex marks contrast with their fill.
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {colorContrast} from '@openpresentation/opf/composition';
import {toPptx, fromPptx} from '../dist/index.js';

const decoder = new TextDecoder();
const parser = new XMLParser({ignoreAttributes: false});
const quarters = {columns: ['Quarter', 'Current', 'Baseline'], rows: [['Q1', 21, 18], ['Q2', 25, 20], ['Q3', 28, 22], ['Q4', 32, 24]]};

async function exportChart(chart, options = {}) {
  const diagnostics = [];
  const bytes = await toPptx({design: {fontScheme: 'roboto'}, slides: [{title: 'Chart', chart: {alt: 'A chart', ...chart}}]}, {onDiagnostic: d => diagnostics.push(d), ...options});
  const entries = unzipSync(bytes);
  const part = (pattern) => Object.entries(entries).find(([name]) => pattern.test(name))?.[1];
  const classic = part(/^ppt\/charts\/chart\d+\.xml$/);
  const chartex = part(/^ppt\/charts\/chartEx\d+\.xml$/);
  return {bytes, diagnostics, classic: classic && decoder.decode(classic), chartex: chartex && decoder.decode(chartex)};
}
const fallbacks = (diagnostics) => diagnostics.filter(d => d.adaptation === 'chart-fallback').map(d => d.message.match(/core's (\S+) fallback/)?.[1]);

// A map over quarters: a clustered column chart of both series, in every chartex mode.
for (const chartex of ['auto', 'native', 'fallback']) {
  const {classic, chartex: part, diagnostics} = await exportChart({type: 'world', data: quarters}, {chartex});
  assert.match(classic, /<c:barChart>/, `${chartex}: columns`);
  assert.equal(classic.match(/<c:ser>/g).length, 2, `${chartex}: every series`);
  assert.equal(part, undefined, `${chartex}: no region map part`);
  assert.deepEqual(fallbacks(diagnostics), ['map-as-columns'], chartex);
  assert.ok(!diagnostics.some(d => d.code === 'chart-map-geodata'), `${chartex}: no geodata notice`);
}

// A pie and a doughnut of two series: one c:doughnutChart with two series of the same four categories, well-formed and re-importable.
for (const type of ['pie', 'doughnut']) {
  const {classic, diagnostics, bytes} = await exportChart({type, data: quarters});
  assert.match(classic, /<c:doughnutChart>/, type);
  assert.doesNotThrow(() => parser.parse(classic), type);
  const series = [...classic.matchAll(/<c:ser>[\s\S]*?<\/c:ser>/g)].map(([ser]) => ser);
  assert.equal(series.length, 2, `${type}: two rings`);
  assert.match(series[1], /<c:idx val="1"\/><c:order val="1"\/>/);
  assert.match(series[1], /<c:f>Sheet1!\$C\$1<\/c:f>[\s\S]*<c:v>Baseline<\/c:v>/);
  assert.match(series[1], /<c:f>Sheet1!\$C\$2:\$C\$5<\/c:f>/);
  assert.deepEqual([...series[1].matchAll(/<c:val>[\s\S]*<\/c:val>/g)][0][0].match(/<c:v>([^<]*)<\/c:v>/g).map(v => Number(v.replace(/<\/?c:v>/g, ''))), [18, 20, 22, 24]);
  assert.equal(series[1].match(/<c:dPt>/g).length, 4, `${type}: the outer ring is coloured by category too`);
  assert.ok(!diagnostics.some(d => d.adaptation === 'series-dropped'), `${type}: no series dropped`);
  assert.deepEqual(fallbacks(diagnostics), ['nested-rings'], type);
  const imported = (await fromPptx(bytes)).presentation ?? (await fromPptx(bytes));
  const chart = imported.slides[0].chart;
  assert.equal(chart.type, 'doughnut');
  assert.deepEqual(chart.data.columns, quarters.columns, `${type}: both series import`);
}

// One value per box-and-whisker category: one category group, so PowerPoint draws one box per series; import restores the quarters.
{
  const {chartex, diagnostics, bytes} = await exportChart({type: 'box-and-whisker', data: quarters});
  const categories = [...chartex.matchAll(/<cx:strDim type="cat">[\s\S]*?<\/cx:strDim>/g)][0][0];
  assert.deepEqual([...categories.matchAll(/<cx:pt idx="\d+">([^<]*)<\/cx:pt>/g)].map(([, label]) => label), ['Quarter', 'Quarter', 'Quarter', 'Quarter']);
  assert.equal(chartex.match(/<cx:series /g).length, 2);
  assert.deepEqual(fallbacks(diagnostics), ['box-per-series']);
  const imported = await fromPptx(bytes);
  const chart = (imported.presentation ?? imported).slides[0].chart;
  assert.equal(chart.type, 'box-and-whisker');
  assert.deepEqual(chart.data, quarters, 'the data record restores the authored quarters');
}

// A scatter whose X column is text: every numeric series against the row numbers (X = 1, 2, 3).
{
  const data = {columns: ['Name', 'Region', 'Score', 'Target'], rows: [['a', 'North', 4, 5], ['b', 'South', 6, 5], ['c', 'East', 5, 7]]};
  const {classic, diagnostics} = await exportChart({type: 'scatter', data});
  const series = [...classic.matchAll(/<c:ser>[\s\S]*?<\/c:ser>/g)].map(([ser]) => ser);
  assert.equal(series.length, 2, 'Score and Target');
  for (const ser of series) assert.deepEqual(ser.match(/<c:xVal>[\s\S]*?<\/c:xVal>/)[0].match(/<c:v>([^<]*)<\/c:v>/g).map(v => v.replace(/<\/?c:v>/g, '')), ['1', '2', '3']);
  assert.deepEqual(fallbacks(diagnostics), ['scatter-by-position']);
}

// LH-56: treemap tiles carry their own label colour at 4.5:1 (or black or white), a funnel's labels one colour against the series fill.
{
  const one = {columns: ['Quarter', 'Current'], rows: quarters.rows.map(row => row.slice(0, 2))};
  const {chartex: treemap} = await exportChart({type: 'treemap', data: one});
  const fills = [...treemap.matchAll(/<cx:dataPt idx="(\d+)"><cx:spPr><a:solidFill><a:srgbClr val="([0-9A-F]{6})"/g)].map(([, idx, hex]) => [Number(idx), hex]);
  const labels = new Map([...treemap.matchAll(/<cx:dataLabel idx="(\d+)">[\s\S]*?<a:srgbClr val="([0-9A-F]{6})"/g)].map(([, idx, hex]) => [Number(idx), hex]));
  // Tiles that keep a theme accent are written as schemeClr (RR-89); the others are checked by their hex fill.
  assert.equal(labels.size, 4, 'every tile has its own label colour');
  assert.ok(fills.length >= 1);
  for (const [idx, fill] of fills) {
    const label = labels.get(idx);
    assert.ok(label, `tile ${idx} has its own label colour`);
    assert.ok(colorContrast(`#${label}`, `#${fill}`) >= 4.5 || ['000000', 'FFFFFF'].includes(label), `tile ${idx}: ${label} on ${fill}`);
  }
  assert.doesNotThrow(() => parser.parse(treemap));
  const {chartex: funnel} = await exportChart({type: 'funnel', data: one});
  const seriesFill = funnel.match(/<cx:series [^>]*>[\s\S]*?<cx:spPr><a:solidFill><a:srgbClr val="([0-9A-F]{6})"/)[1];
  const labelFill = funnel.match(/<cx:dataLabels [^>]*><cx:numFmt[^>]*\/>?<cx:txPr>[\s\S]*?<a:srgbClr val="([0-9A-F]{6})"/)?.[1] ?? funnel.match(/<cx:dataLabels [^>]*>[\s\S]*?<a:srgbClr val="([0-9A-F]{6})"/)[1];
  assert.ok(colorContrast(`#${labelFill}`, `#${seriesFill}`) >= 4.5 || ['000000', 'FFFFFF'].includes(labelFill), `funnel: ${labelFill} on ${seriesFill}`);
}

console.log('pptx chart fallbacks ok');
