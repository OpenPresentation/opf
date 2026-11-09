// RR-105: categorical histogram aggregation must not silently hide negative values in PowerPoint.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {strFromU8, unzipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {fromPptx, toPptx} from './helpers/default-catalog.mjs';

const data = {columns: ['Region', 'Value'], rows: [['North', 42], ['South', 31], ['East', -8], ['West', 19]]};
const modes = [undefined, 'auto', 'native', 'fallback'];
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '@', parseTagValue: false});
const array = (value) => value === undefined ? [] : Array.isArray(value) ? value : [value];
const textOf = (value) => typeof value === 'string' ? value : value?.['#text'] ?? '';
const xml = (parts, name) => strFromU8(parts[name]);
const chartParts = (parts) => Object.keys(parts).filter((name) => /^ppt\/charts\/chart(?:Ex)?\d+\.xml$/.test(name));
const points = (chart, kind) => {
  const block = chart.match(new RegExp('<c:' + kind + '[ >][\\s\\S]*?</c:' + kind + '>'))?.[0] ?? '';
  return [...block.matchAll(/<c:pt idx="(\d+)"><c:v>([^<]*)<\/c:v><\/c:pt>/g)].map(([, index, value]) => [Number(index), value]);
};
function workbookRows(parts) {
  const books = Object.keys(parts).filter((name) => /^ppt\/embeddings\/.*\.xlsx$/.test(name));
  assert.equal(books.length, 1, 'one workbook owns the chart data');
  const book = unzipSync(parts[books[0]]);
  const strings = array(parser.parse(xml(book, 'xl/sharedStrings.xml')).sst.si).map((entry) => textOf(entry.t));
  return array(parser.parse(xml(book, 'xl/worksheets/sheet1.xml')).worksheet.sheetData.row).map((row) =>
    array(row.c).map((cell) => cell['@t'] === 's' ? strings[Number(cell.v)] : cell['@t'] === 'inlineStr' ? textOf(cell.is.t) : Number(cell.v)));
}
async function exported(mode, sourceData = data) {
  const diagnostics = [];
  const bytes = await toPptx({slides: [{title: 'histogram', chart: {type: 'histogram', data: sourceData}}]}, {
    ...(mode === undefined ? {} : {chartex: mode}), onDiagnostic: (entry) => diagnostics.push(entry),
  });
  return {bytes, parts: unzipSync(bytes), diagnostics};
}
function chartsIn(value, result = []) {
  if (Array.isArray(value)) for (const entry of value) chartsIn(entry, result);
  else if (value && typeof value === 'object') {
    if (value.chart) result.push(value.chart);
    for (const [key, entry] of Object.entries(value)) if (key !== 'chart') chartsIn(entry, result);
  }
  return result;
}

for (const mode of modes) {
  test((mode ?? 'default') + ': negative categories use one editable column chart and retain every row', async () => {
    const {bytes, parts, diagnostics} = await exported(mode);
    assert.deepEqual(chartParts(parts), ['ppt/charts/chart1.xml'], 'no native aggregation may hide the negative category');
    const chart = xml(parts, 'ppt/charts/chart1.xml');
    assert.match(chart, /<c:barChart><c:barDir val="col"\/>/);
    assert.equal([...chart.matchAll(/<c:ser>/g)].length, 1);
    assert.deepEqual(points(chart, 'cat'), data.rows.map(([label], index) => [index, label]));
    assert.deepEqual(points(chart, 'val'), data.rows.map(([, value], index) => [index, String(value)]));
    assert.deepEqual(workbookRows(parts), [data.columns, ...data.rows]);
    const axis = chart.match(/<c:valAx>[\s\S]*?<\/c:valAx>/)?.[0] ?? '';
    // The existing classic fallback uses automatic bounds. If a bound is ever explicit, it must enclose every value.
    assert.match(axis, /<c:scaling>/);
    const minimum = axis.match(/<c:min val="([^"]+)"\/>/)?.[1];
    const maximum = axis.match(/<c:max val="([^"]+)"\/>/)?.[1];
    assert.ok(minimum === undefined || Number(minimum) <= -8, 'no lower bound clips the negative category');
    assert.ok(maximum === undefined || Number(maximum) >= 42, 'no upper bound clips the positive categories');
    assert.match(axis, /<c:crosses val="autoZero"\/>/);
    const slide = xml(parts, 'ppt/slides/slide1.xml');
    assert.equal([...slide.matchAll(/<p:graphicFrame>/g)].length, 1, 'one chart, without a second representation');
    assert.doesNotMatch(slide, /AlternateContent|chartEx/);
    const notices = diagnostics.filter((entry) => entry.code === 'chart-data-adapted');
    assert.equal(notices.length, 1);
    assert.equal(notices[0].adaptation, 'chartex-fallback');
    assert.match(notices[0].message, /categorical histogram.*negative/i);
    assert.match(notices[0].message, /column chart/i);
    assert.doesNotMatch(notices[0].message, /pass chartex|does not write|not yet accepted/);
    const imported = await fromPptx(bytes);
    assert.equal(imported.slides.length, 1);
    const charts = chartsIn(imported.slides[0]);
    assert.equal(charts.length, 1, 'import does not duplicate a chart');
    assert.equal(charts[0].type, 'column', 'the fallback truthfully imports its editable column representation');
    assert.deepEqual(charts[0].data, data);
    assert.equal(imported.slides[0].shapes?.length ?? 0, 0, 'no fallback overlay is imported as a duplicate shape');
    assert.deepEqual((await exported(mode)).bytes, bytes, 'deterministic archive');
    assert.deepEqual((await exported('fallback')).bytes, bytes, 'all modes use the existing fallback bytes');
  });
}

for (const mode of [undefined, 'auto', 'native']) {
  test((mode ?? 'default') + ': nonnegative category values retain native aggregation', async () => {
    const positive = {columns: data.columns, rows: data.rows.map(([label, value]) => [label, Math.abs(value)])};
    const {parts, diagnostics} = await exported(mode, positive);
    assert.deepEqual(chartParts(parts), ['ppt/charts/chart1.xml', 'ppt/charts/chartEx1.xml']);
    const chart = xml(parts, 'ppt/charts/chartEx1.xml');
    assert.match(chart, /<cx:aggregation\/>/);
    assert.doesNotMatch(chart, /<cx:binning/);
    assert.deepEqual([...chart.matchAll(/<cx:numDim type="val">[\s\S]*?<cx:lvl[^>]*>([\s\S]*?)<\/cx:lvl>/g)].flatMap(([, block]) => [...block.matchAll(/<cx:pt idx="\d+">([^<]*)<\/cx:pt>/g)].map(([, value]) => Number(value))), positive.rows.map(([, value]) => value));
    assert.deepEqual(diagnostics.filter((entry) => entry.code === 'chart-data-adapted'), []);
    assert.deepEqual(chartsIn((await fromPptx(await toPptx({slides: [{chart: {type: 'histogram', data: positive}}]}, {chartex: mode ?? 'auto'})))).map((chart) => chart.type), ['histogram']);
  });
  test((mode ?? 'default') + ': negative raw samples retain native histogram binning', async () => {
    const samples = {columns: ['Sample'], rows: [[-8], [-3], [0], [4], [19]]};
    const {bytes, parts, diagnostics} = await exported(mode, samples);
    const chart = xml(parts, 'ppt/charts/chartEx1.xml');
    assert.match(chart, /<cx:binning/);
    assert.doesNotMatch(chart, /<cx:aggregation/);
    assert.deepEqual([...chart.matchAll(/<cx:numDim type="val">[\s\S]*?<cx:lvl[^>]*>([\s\S]*?)<\/cx:lvl>/g)].flatMap(([, block]) => [...block.matchAll(/<cx:pt idx="\d+">([^<]*)<\/cx:pt>/g)].map(([, value]) => Number(value))), samples.rows.flat());
    assert.deepEqual(diagnostics.filter((entry) => entry.code === 'chart-data-adapted'), []);
    const charts = chartsIn(await fromPptx(bytes));
    assert.equal(charts.length, 1);
    assert.equal(charts[0].type, 'histogram');
    assert.deepEqual(charts[0].data, samples);
  });
}
