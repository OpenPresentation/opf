// LH-107 to LH-110 in the PPTX export and import: the native waterfall's roles, signed labels, hidden value axis and caption (chartex);
// a pie's value list, a stacked chart's series names and the title's reference marks as tagged native shapes over (or, the band, under)
// the chart frame; the values inside stacked segments as the chart's own labels, hidden per point where they do not fit; and fromPptx
// consuming the shapes and writing none of these defaults back as options.
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {toPptx, fromPptx} from '../dist/index.js';

const decoder = new TextDecoder();
const deckOf = (slide) => ({design: {fontScheme: 'roboto', colorScheme: 'cool-horizon', variant: 'light1'}, slides: [slide]});
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
async function exported(slide) {
  const bytes = await toPptx(deckOf(slide)), entries = unzipSync(bytes);
  const text = path => entries[path] ? decoder.decode(entries[path]) : '';
  const imported = await fromPptx(bytes);
  const blocks = imported.slides[0].blocks ?? (imported.slides[0].chart ? [{chart: imported.slides[0].chart}] : []);
  const tags = Object.keys(entries).filter(path => /^ppt\/tags\/opfChartMark\d+\.xml$/.test(path));
  return {entries, text, slideXml: text('ppt/slides/slide1.xml'), chartXml: text('ppt/charts/chart1.xml'), blocks, chart: blocks.find(block => block.chart)?.chart, tags};
}
let checks = 0;

// 1. Waterfall (native chartex): role colours per point, signed number format, bold unsigned totals, no value axis, the caption title.
{
  const {text, chart} = await exported({title: 'Price and volume more than offset cost increases', chart: {type: 'waterfall', data: {columns: ['Step', 'Operating profit ($M)'], rows: [['2024 profit', 42], ['Volume', 9.3], ['Price', 6.1], ['Materials', -7.4], ['Labor', -5.2], ['Currency', -2.1], ['2025 profit', 42.7]]}}});
  const xml = text('ppt/charts/chartEx1.xml');
  assert.match(xml, /<cx:dataLabels pos="outEnd"><cx:numFmt formatCode="&quot;\+&quot;General;&quot;−&quot;General;General" sourceLinked="0"\/>/, 'steps signed by their format');
  for (const row of [0, 6]) assert.match(xml, new RegExp(`<cx:dataLabel idx="${row}"><cx:numFmt formatCode="General" sourceLinked="0"/><cx:txPr>(?:(?!</cx:txPr>)[\\s\\S])*b="1"`), `total ${row} unsigned and bold`);
  assert.match(xml, /<cx:axis id="1" hidden="1">(?:(?!<\/cx:axis>)[\s\S])*<\/cx:axis>/, 'the value axis is hidden');
  assert.doesNotMatch(xml.match(/<cx:axis id="1"[\s\S]*?<\/cx:axis>/)[0], /majorGridlines/, 'no gridlines');
  assert.match(xml, /<cx:chart><cx:title pos="t" align="min" overlay="0">[\s\S]*?<a:t>Operating profit \(\$M\)<\/a:t>/, 'the caption title');
  const fill = row => xml.match(new RegExp(`<cx:dataPt idx="${row}"><cx:spPr>([\\s\\S]*?)</cx:spPr>`))[1];
  assert.equal(fill(0), fill(6), 'opening and closing totals share a colour');
  assert.notEqual(fill(0), fill(1));
  assert.notEqual(fill(1), fill(3), 'a gain and a loss differ');
  assert.equal(fill(3), fill(4));
  assert.equal(chart.type, 'waterfall');
  assert.equal(chart.dataLabels, undefined, 'the default labels import as no option');
  checks += 6;
}

// 2. A pie with its value list: the pie in core's square (inner plot layout), no legend, tagged list shapes; import consumes them.
{
  const {chartXml, slideXml, chart, blocks, tags} = await exported({title: 'Enterprise accounts bring 62% of revenue', chart: {type: 'pie', data: {columns: ['Segment', 'Revenue ($M)'], rows: [['Enterprise', 62.4], ['Mid-market', 25.1], ['Small business', 12.5]]}}});
  assert.match(chartXml, /<c:plotArea><c:layout><c:manualLayout><c:layoutTarget val="inner"\/>/, 'the pie in its square');
  assert.doesNotMatch(chartXml, /<c:legend>/, 'no legend');
  for (const value of ['62.4', '25.1', '12.5', 'Enterprise', 'Mid-market', 'Small business', 'Revenue ($M)']) assert.ok(slideXml.includes(`<a:t>${value.replace('$', '$')}</a:t>`), `list text ${value}`);
  assert.match(slideXml, /name="OPF chart 1 mark over \d+ list-value"[\s\S]*?b="1"[\s\S]*?<a:t>62\.4<\/a:t>/, 'the focused value is bold');
  assert.ok(tags.length >= 3 * 4, 'every list shape is tagged');
  assert.equal(blocks.length, 1, 'the list imports as nothing but its chart');
  assert.equal(chart.legend, undefined);
  assert.equal(chart.dataLabels, undefined);
  checks += 5;
}

// 3. Stacked columns: values inside as the chart's labels (ctr), the ones that do not fit hidden per point, names beside as tagged shapes.
{
  const {chartXml, slideXml, chart, blocks} = await exported({title: 'Subscriptions drive the growth in revenue', chart: {type: 'stacked-column', data: {columns: ['Quarter', 'Subscriptions ($M)', 'Services ($M)', 'Hardware ($M)'], rows: [['Q1', 12.1, 8.3, 0.4], ['Q2', 14, 8.6, 4.2], ['Q3', 16.2, 8.9, 4.3], ['Q4', 19.4, 9.1, 4.7]]}}});
  const series = [...chartXml.matchAll(/<c:ser>[\s\S]*?<\/c:ser>/g)].map(match => match[0]);
  assert.equal(series.length, 3);
  for (const ser of series) assert.match(ser, /<c:dLbls>[\s\S]*<c:dLblPos val="ctr"\/><c:showLegendKey val="0"\/><c:showVal val="1"\/>/, 'values in the middle of each segment');
  assert.match(series[2], /<c:dLbl><c:idx val="0"\/><c:delete val="1"\/><\/c:dLbl>/, 'the thin Q1 hardware segment hides its value');
  assert.doesNotMatch(series[0], /<c:delete val="1"\/>/);
  assert.doesNotMatch(chartXml, /<c:legend>/, 'names instead of a legend');
  for (const name of ['Subscriptions ($M)', 'Services ($M)', 'Hardware ($M)']) assert.ok(slideXml.includes(`<a:t>${name}</a:t>`), name);
  assert.equal(blocks.length, 1);
  assert.equal(chart.dataLabels, undefined, 'the values import as the default');
  assert.equal(chart.legend, undefined);
  checks += 5;
}

// 4. Reference line and band: the band under the chart frame, the dashed line and its label over it; import consumes them.
{
  const delivery = {type: 'line', data: {columns: ['Month', {name: 'On-time delivery', format: '0.0%'}], rows: months.map((month, i) => [month, [0.934, 0.941, 0.928, 0.952, 0.961, 0.957, 0.944, 0.936, 0.949, 0.968, 0.972, 0.979][i]])}};
  const {slideXml, blocks, chart} = await exported({title: 'On-time delivery stayed above 92% all year', chart: delivery});
  const frame = slideXml.indexOf('<p:graphicFrame>'), line = slideXml.indexOf('reference"');
  assert.ok(line > frame, 'the reference line over the chart');
  assert.match(slideXml, /name="OPF chart 1 mark over \d+ reference"[\s\S]*?<a:prstDash val="dash"\/>/, 'dashed');
  assert.match(slideXml, /<a:t>92%<\/a:t>/);
  assert.equal(blocks.length, 1);
  assert.equal(chart.type, 'line');
  const spend = {type: 'line', data: {columns: ['Year', 'Cloud ($B)', 'On-premises ($B)'], rows: [['2020', 3.1, 8.4], ['2021', 4.2, 7.9], ['2022', 5.6, 7.3], ['2023', 7.3, 6.5], ['2024', 9.4, 5.6], ['2025', 11.8, 4.8]]}};
  const banded = await exported({title: 'Cloud spend overtook on-premises in 2023', chart: spend});
  const band = banded.slideXml.indexOf(' band"'), bandFrame = banded.slideXml.indexOf('<p:graphicFrame>');
  assert.ok(band > 0 && band < bandFrame, 'the band under the chart frame');
  assert.equal(banded.blocks.length, 1);
  checks += 4;
}

console.log(`LH-107 to LH-110 PPTX passed: ${checks} checks; chartex waterfall roles and labels, value list, stacked values and names, reference marks; import consumes the marks.`);
