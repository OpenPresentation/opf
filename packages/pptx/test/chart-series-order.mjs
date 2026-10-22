// opf-pptx#175: every classic chart part the exporter writes has its series (and the scatter value axes) in ECMA-376 schema
// order (dml-chart.xsd). pptxgenjs-plus 4.3.4 writes a line series' c:dLbls before c:marker, gives radar series the bar-only
// c:invertIfNegative and the scatter X c:valAx the category-axis-only c:auto, c:lblAlgn and c:noMultiLvlLbl; the export puts
// them in sequence (src/chart-order.js), keeps a series already in sequence byte-identical, and still imports the same chart.
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {toPptx, fromPptx} from '../dist/index.js';
import {orderChartSeries} from '../dist/chart-order.js';
import {chartOrderProblems} from './helpers/chart-schema-order.mjs';

const decoder = new TextDecoder();
const data = {columns: ['Quarter', 'North', 'South'], rows: [['Q1', 10, 5], ['Q2', 20, 8], ['Q3', 15, 12], ['Q4', 22, 9]]};
const single = {columns: ['Quarter', 'Revenue'], rows: [['Q1', 10], ['Q2', -20], ['Q3', 15]]};
const scatterData = {columns: ['Point', 'Spend', 'Revenue'], rows: [['a', 1, 10], ['b', 2, 14], ['c', 4, 19]]};
const CLASSIC = ['column', 'stacked-column', '100pct-stacked-column', 'bar', 'stacked-bar', '100pct-stacked-bar', 'line', 'line-with-markers',
  'stacked-line', 'stacked-line-with-markers', 'area', 'stacked-area', '100pct-stacked-area', 'pie', 'doughnut', 'scatter', 'radar',
  'radar-with-markers', 'filled-radar', 'combo'];
let checks = 0;

const chartParts = bytes => {
  const entries = unzipSync(bytes);
  return Object.keys(entries).filter(name => /^ppt\/charts\/chart\d+\.xml$/.test(name)).map(name => decoder.decode(entries[name]));
};

// 1. Every classic type, plain, with data labels, and with a category highlight (per-point c:dPt), for two series and one.
for (const type of CLASSIC) {
  const variants = [{}, {dataLabels: true}, ...(type === 'scatter' ? [] : [{highlight: {categories: ['Q2']}, dataLabels: true}])];
  for (const extra of variants) for (const rows of type === 'scatter' ? [scatterData] : [data, single]) {
    const parts = chartParts(await toPptx({slides: [{title: type, chart: {type, data: rows, ...extra}}]}));
    assert.ok(parts.length >= 1, `${type}: a classic chart part`);
    for (const xml of parts) assert.deepEqual(chartOrderProblems(xml), [], `${type} ${JSON.stringify(extra)}: dml-chart.xsd sequences`);
    checks++;
  }
}

// 2. The issue's repro: a line chart with data labels writes c:marker before c:dLbls in every series, and nothing bar-only.
{
  for (const type of ['line', 'line-with-markers']) {
    const [xml] = chartParts(await toPptx({slides: [{title: type, chart: {type, data, dataLabels: true}}]}));
    const series = [...xml.matchAll(/<c:ser>[\s\S]*?<\/c:ser>/g)].map(match => match[0]);
    assert.equal(series.length, 2);
    for (const ser of series) {
      assert.ok(ser.indexOf('<c:marker>') > 0 && ser.indexOf('<c:marker>') < ser.indexOf('<c:dLbls>'), `${type}: c:marker precedes c:dLbls`);
      assert.ok(ser.indexOf('</c:dLbls>') < ser.indexOf('<c:cat>'), `${type}: c:dLbls precedes c:cat`);
      assert.doesNotMatch(ser, /invertIfNegative/);
    }
    checks++;
  }
  const [radar] = chartParts(await toPptx({slides: [{title: 'radar', chart: {type: 'radar-with-markers', data}}]}));
  assert.doesNotMatch(radar, /<c:invertIfNegative/, 'CT_RadarSer has no invertIfNegative');
  const [scatter] = chartParts(await toPptx({slides: [{title: 'scatter', chart: {type: 'scatter', data: scatterData}}]}));
  for (const axis of scatter.match(/<c:valAx>[\s\S]*?<\/c:valAx>/g)) assert.doesNotMatch(axis, /<c:(?:auto|lblAlgn|noMultiLvlLbl)\b/, 'CT_ValAx has no category-axis children');
  checks += 2;
}

// 3. The rewrite: stable (repeated c:dPt keep their order), whitespace travels with its element, a series in sequence and a part
// without classic series are returned unchanged, and an unparseable series is left alone.
{
  const inOrder = '<c:lineChart><c:grouping val="standard"/><c:ser><c:idx val="0"/><c:order val="0"/>  <c:marker><c:symbol val="none"/></c:marker><c:dLbls><c:showVal val="1"/></c:dLbls><c:val/><c:smooth val="0"/></c:ser></c:lineChart>';
  assert.equal(orderChartSeries(inOrder), inOrder, 'a series in sequence keeps its bytes');
  const swapped = '<c:lineChart><c:ser><c:idx val="0"/><c:order val="0"/><c:spPr/><c:invertIfNegative val="0"/><c:dLbls><c:showVal val="1"/></c:dLbls>  <c:marker><c:symbol val="circle"/><c:spPr/></c:marker><c:dPt><c:idx val="2"/></c:dPt><c:dPt><c:idx val="1"/></c:dPt><c:cat/><c:val/><c:smooth val="0"/><c:errBars><c:errDir val="y"/></c:errBars></c:ser></c:lineChart>';
  assert.equal(orderChartSeries(swapped), '<c:lineChart><c:ser><c:idx val="0"/><c:order val="0"/><c:spPr/>  <c:marker><c:symbol val="circle"/><c:spPr/></c:marker><c:dPt><c:idx val="2"/></c:dPt><c:dPt><c:idx val="1"/></c:dPt><c:dLbls><c:showVal val="1"/></c:dLbls><c:errBars><c:errDir val="y"/></c:errBars><c:cat/><c:val/><c:smooth val="0"/></c:ser></c:lineChart>');
  const bar = '<c:barChart><c:barDir val="col"/><c:ser><c:idx val="0"/><c:order val="0"/><c:invertIfNegative val="0"/><c:dLbls/><c:dPt><c:idx val="0"/></c:dPt><c:val/></c:ser></c:barChart>';
  assert.equal(orderChartSeries(bar), '<c:barChart><c:barDir val="col"/><c:ser><c:idx val="0"/><c:order val="0"/><c:invertIfNegative val="0"/><c:dPt><c:idx val="0"/></c:dPt><c:dLbls/><c:val/></c:ser></c:barChart>', 'CT_BarSer: dPt before dLbls, invertIfNegative kept');
  const pie = '<c:pieChart><c:ser><c:idx val="0"/><c:order val="0"/><c:dLbls/><c:dPt><c:idx val="0"/></c:dPt><c:cat/><c:val/></c:ser></c:pieChart>';
  assert.equal(orderChartSeries(pie), '<c:pieChart><c:ser><c:idx val="0"/><c:order val="0"/><c:dPt><c:idx val="0"/></c:dPt><c:dLbls/><c:cat/><c:val/></c:ser></c:pieChart>');
  const scatter = '<c:scatterChart><c:ser><c:idx val="0"/><c:order val="0"/><c:dLbls/><c:marker/><c:xVal/><c:yVal/></c:ser></c:scatterChart>';
  assert.equal(orderChartSeries(scatter), '<c:scatterChart><c:ser><c:idx val="0"/><c:order val="0"/><c:marker/><c:dLbls/><c:xVal/><c:yVal/></c:ser></c:scatterChart>');
  const odd = '<c:lineChart><c:ser>text<c:dLbls/><c:marker/></c:ser></c:lineChart>';
  assert.equal(orderChartSeries(odd), odd, 'a series with text content is left alone');
  const plain = '<c:chartSpace><c:chart><c:plotArea><c:catAx><c:auto val="1"/></c:catAx></c:plotArea></c:chart></c:chartSpace>';
  assert.equal(orderChartSeries(plain), plain, 'a category axis keeps c:auto');
  checks += 7;
}

// 4. The reordered parts import as before: chart type, series and data labels.
{
  for (const type of ['line', 'line-with-markers', 'radar-with-markers', 'scatter']) {
    const chart = {type, data: type === 'scatter' ? scatterData : data, dataLabels: true};
    const imported = (await fromPptx(await toPptx({slides: [{title: type, chart}]}, {provenance: false}))).slides[0];
    const back = imported.chart ?? imported.blocks?.find(block => block.chart)?.chart;
    assert.equal(back?.type, type, `${type}: the chart type reads back from the native part`);
    assert.deepEqual(back.data.columns.map(column => column.name ?? column), chart.data.columns, `${type}: the series read back`);
    assert.ok(back.dataLabels, `${type}: the data labels read back`);
    checks++;
  }
}

console.log(`Chart series schema order passed: ${checks} checks (every classic type in dml-chart.xsd sequence, the line, radar and scatter repairs, the stable rewrite, native import).`);
