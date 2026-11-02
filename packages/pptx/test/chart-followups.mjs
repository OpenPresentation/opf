// LH-92 and LH-93 in the PPTX export: each ring of a nested-ring doughnut names its series on the slice core chose (a c:dLbl that shows
// the series name), and sibling charts that share a value axis write core's plot box as the plot area's inner manual layout, the plot
// the preview draws. Import does not turn either into options. LH-95's emphasis is chart-layer.mjs's.
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {composeSlide, resolveChartData} from '@openpresentation/opf/composition';
import {toSvg} from '@openpresentation/opf-render';
import {fromPptx, toPptx} from '../dist/index.js';

const decoder = new TextDecoder();
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: ''});
const attrs = text => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
let checks = 0;

async function exported(deck) {
  const bytes = await toPptx(deck);
  const entries = unzipSync(bytes);
  const charts = Object.keys(entries).filter(name => /^ppt\/charts\/chart\d+\.xml$/.test(name)).sort().map(name => decoder.decode(entries[name]));
  for (const xml of charts) assert.doesNotThrow(() => parser.parse(xml), 'the chart part is well-formed');
  return {charts, imported: (await fromPptx(bytes)).slides[0]};
}

// 1. LH-92: the rings of a pie of several series (drawn as nested rings) name their series on their largest slice.
{
  const data = {columns: ['Region', 'FY24', 'FY25'], rows: [['North', 40, 35], ['South', 25, 45], ['East', 20, 22], ['West', 15, 13]]};
  const deck = chart => ({design: {fontScheme: 'roboto'}, slides: [{title: 'Mix', chart}]});
  const named = xml => [...xml.matchAll(/<c:ser>[\s\S]*?<\/c:ser>/g)].map(([ser]) => [...ser.matchAll(/<c:dLbl><c:idx val="(\d+)"\/>((?:(?!<\/c:dLbl>)[\s\S])*)<\/c:dLbl>/g)].filter(([, , body]) => body.includes('<c:showSerName val="1"/>')).map(([, idx]) => Number(idx)));
  const plain = await exported(deck({type: 'pie', data}));
  assert.deepEqual(named(plain.charts[0]), [[0], [1]], 'one named slice per ring: its largest');
  assert.doesNotMatch(plain.charts[0], /<c:showVal val="1"\/>|<c:showPercent val="1"\/>/, 'no other label is shown');
  assert.equal(plain.imported.chart.dataLabels, undefined, 'the ring names import as no option');
  // The name runs along its ring: North's middle is 72 degrees past 12 o'clock (core's rotation, 60000ths of a degree).
  assert.match(plain.charts[0].match(/<c:ser>[\s\S]*?<\/c:ser>/)[0], /<c:dLbl><c:idx val="0"\/>[\s\S]*?<a:bodyPr rot="4320000" vert="horz"\/>/);
  // With data labels the named slice shows the name before its own parts; a pie drawn as rings writes no c:dLblPos (a doughnut has none).
  const labelled = await exported(deck({type: 'pie', data, dataLabels: {content: ['percent']}}));
  assert.deepEqual(named(labelled.charts[0]), [[0], [1]]);
  assert.doesNotMatch(labelled.charts[0], /<c:dLblPos\b/, 'no label position on the rings');
  assert.deepEqual(labelled.imported.chart.dataLabels, {content: ['percent']}, 'the labels import as authored');
  // The name contrasts with its slice, the colour the preview draws.
  const svg = toSvg(deck({type: 'pie', data}), 1, {trace: true});
  const text = [...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].find(([, , body]) => body.replace(/<[^>]*>/g, '') === 'FY24');
  const ser = plain.charts[0].match(/<c:ser>[\s\S]*?<\/c:ser>/)[0];
  assert.equal(`#${ser.match(/<c:dLbl>[\s\S]*?<a:srgbClr val="(\w{6})"\/>/)[1]}`, attrs(text[1]).fill.toUpperCase());
  checks += 8;
}

// 2. LH-93: sibling charts of one unit write one plot height (c:plotArea c:manualLayout, layoutTarget inner) at the preview's plot.
{
  const rows = [['Q1', 28, 25], ['Q2', 32, 27], ['Q3', 35, 29], ['Q4', 39, 31]];
  const deck = {design: {fontScheme: 'roboto'}, slides: [{title: 'Two', blocks: [
    {chart: {type: 'column', data: {columns: ['Quarter', 'Current', 'Baseline'], rows}, dataLabels: false, axisTitles: {category: 'Fiscal quarter'}}},
    {chart: {type: 'column', data: {columns: ['Quarter', 'Current', 'Baseline'], rows: rows.map(row => [row[0], row[1] - 10, row[2] - 9])}, dataLabels: false}}]}]};
  const {charts, imported} = await exported(deck);
  const layouts = charts.map(xml => {
    const layout = xml.match(/<c:plotArea><c:layout><c:manualLayout>([\s\S]*?)<\/c:manualLayout>/)?.[1] ?? '';
    return Object.fromEntries([...layout.matchAll(/<c:(\w+) val="([^"]+)"\/>/g)].map(([, key, value]) => [key, Number.isNaN(Number(value)) ? value : Number(value)]));
  });
  assert.ok(layouts.every(layout => layout.layoutTarget === 'inner'), 'the inner plot');
  assert.equal(layouts[0].y, layouts[1].y);
  assert.equal(layouts[0].h, layouts[1].h, 'one plot height');
  // The fractions are the preview's plot in the chart box: the value axis line spans it.
  const svg = toSvg(deck, 1, {trace: true});
  const composed = composeSlide(deck.slides[0], {});
  const box = composed.items.find(item => item.field === 'chart').box;
  const axis = [...svg.matchAll(/<line\b([^>]*)\/>/g)].map(([, a]) => attrs(a)).filter(line => line.x1 === line.x2 && Number(line.x1) < box.x + box.width);
  const top = Math.min(...axis.map(line => Number(line.y1))), bottom = Math.max(...axis.map(line => Number(line.y2)));
  assert.ok(Math.abs(layouts[0].y - (top - box.y) / box.height) < 0.002, `${layouts[0].y} and ${(top - box.y) / box.height}`);
  assert.ok(Math.abs(layouts[0].h - (bottom - top) / box.height) < 0.002, `${layouts[0].h} and ${(bottom - top) / box.height}`);
  assert.equal(imported.blocks.filter(block => block.chart).length, 2);
  assert.ok(imported.blocks.every(block => !block.chart || resolveChartData(block.chart).ok), 'the charts import');
  checks += 6;
}

console.log(`Chart follow-ups export passed: ${checks} checks (ring names, one plot height).`);
