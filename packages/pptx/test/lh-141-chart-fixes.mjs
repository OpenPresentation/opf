// LH-141, LH-142, LH-143 in the PPTX export: a series that groups its thousands has its own labels formatted `#,##0` (PowerPoint's labels agree with
// the preview), a metric's numeric value and the doughnut hole are grouped text; a horizontal stacked bar chart whose every segment is labeled has
// its value axis deleted and no gridlines; a legend wider than its header row is the chart's top legend on two rows, with the plot at the chart's
// width. Composition decides them (core); the preview draws the same.
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {toPptx} from '../dist/index.js';

const decoder = new TextDecoder();
const deckOf = (slide, language = 'en') => ({language, design: {fontScheme: 'roboto', colorScheme: 'cool-horizon', variant: 'light1'}, slides: [slide]});
async function exported(slide, language) {
  const entries = unzipSync(await toPptx(deckOf(slide, language)));
  return {chart: decoder.decode(entries['ppt/charts/chart1.xml']), slide: decoder.decode(entries['ppt/slides/slide1.xml'])};
}
const texts = xml => [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match => match[1]);
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const labelFormats = chart => [...chart.matchAll(/<c:dLbls>[\s\S]*?<\/c:dLbls>/g)].flatMap(block => [...block[0].matchAll(/<c:numFmt formatCode="([^"]*)"/g)].map(match => match[1]));

// 1. A column chart's default labels: a series of whole numbers with a four-digit value labels with `#,##0`; an author's format, a series of
//    fractions and a series under four digits keep what they had.
{
  const column = (columns, rows) => ({title: 'Orders', chart: {type: 'column', data: {columns, rows}}});
  const grouped = (await exported(column(['Month', 'Orders'], [['Jan', 4120], ['Feb', 6240]]))).chart;
  check(labelFormats(grouped).length > 0 && labelFormats(grouped).every(code => code === '#,##0'), `labels take #,##0 (${labelFormats(grouped)})`);
  const caches = [...grouped.matchAll(/<c:numCache><c:formatCode>([^<]*)<\/c:formatCode>/g)].map(match => match[1]);
  check(caches.every(code => code === 'General'), `the series cache stays General (${caches})`);
  const written = (await exported(column(['Month', {name: 'Orders', format: '0'}], [['Jan', 4120], ['Feb', 6240]]))).chart;
  check(labelFormats(written).every(code => code === '0'), `an author's format is kept (${labelFormats(written)})`);
  const fractions = (await exported(column(['Month', 'Orders'], [['Jan', 4120.5], ['Feb', 6240]]))).chart;
  check(labelFormats(fractions).every(code => code === 'General'), `fractions keep General (${labelFormats(fractions)})`);
  const small = (await exported(column(['Month', 'Orders'], [['Jan', 412], ['Feb', 624]]))).chart;
  check(labelFormats(small).every(code => code === 'General'), `three digits keep General (${labelFormats(small)})`);
}

// 1b. The value axis takes `#,##0` by the same rule (no format of its own, whole-number ticks of four digits, not a share axis).
{
  const axisFormat = chart => /<c:valAx>[\s\S]*?<c:numFmt formatCode="([^"]*)"/.exec(chart)?.[1];
  const line = (columns, type = 'line') => ({title: 'Orders grew', chart: {type, dataLabels: false, data: {columns, rows: [['Jan', 4120], ['Feb', 5240], ['Mar', 6240]]}}});
  check(axisFormat((await exported(line(['Month', 'Orders']))).chart) === '#,##0', 'the value axis groups');
  check(axisFormat((await exported(line(['Month', {name: 'Orders', format: '0'}]))).chart) === '0', 'an axis format the author wrote is kept');
  check(axisFormat((await exported(line(['Month', 'Orders'], '100pct-stacked-column'))).chart) === '0%', 'a share axis stays percent');
  check(axisFormat((await exported({title: 'Orders', chart: {type: 'line', dataLabels: false, data: {columns: ['Month', 'Orders'], rows: [['Jan', 41], ['Feb', 62]]}}})).chart) === 'General', 'three digits keep General');
}

// 2. A line chart with two series groups only the series that does; the value list, hole and metric are grouped text, in the deck language.
{
  const {chart} = await exported({title: 'Orders grew', chart: {type: 'line', dataLabels: true, data: {columns: ['Month', 'Orders', 'Rate'], rows: [['Jan', 4120, 3.1], ['Feb', 6240, 3.4]]}}});
  const formats = [...chart.matchAll(/<c:ser>[\s\S]*?<\/c:ser>/g)].map(ser => (/<c:dLbls>[\s\S]*?<c:numFmt formatCode="([^"]*)"/.exec(ser[0]) ?? [])[1]);
  check(formats.join('|') === '#,##0|General', `each series has its own label format (${formats})`);
  const doughnut = {title: 'Two in three tickets are resolved on first contact', chart: {type: 'doughnut', data: {columns: ['Outcome', 'Tickets'],
    rows: [['Resolved on first contact', 6240], ['Resolved after follow-up', 2180], ['Escalated', 890], ['Unresolved', 310]]}}};
  check(texts((await exported(doughnut)).slide).filter(text => text === '6,240').length >= 2, 'the hole and the list print 6,240');
  check(texts((await exported(doughnut, 'de')).slide).filter(text => text === '6.240').length >= 2, 'German: 6.240');
  const metric = (await exported({title: 'Tickets', metric: {value: 6240, label: 'Tickets resolved'}}, 'de')).slide;
  check(texts(metric).includes('6.240'), 'a metric value is grouped in German');
}

// 3. A horizontal stacked bar chart whose every segment holds its value has no value axis and no gridlines; one hairline segment keeps both.
{
  const stacked = rows => ({title: 'Self-service carries most requests', chart: {type: 'stacked-bar', data: {columns: ['Region', 'Self-service', 'Chat', 'Phone'], rows}}});
  const valueAxis = chart => /<c:valAx>[\s\S]*?<\/c:valAx>/.exec(chart)[0];
  const dropped = await exported(stacked([['North America', 5400, 2100, 900], ['Europe', 4600, 2300, 1300], ['Asia Pacific', 3900, 2800, 1100]]));
  check(/<c:delete val="1"\/>/.test(valueAxis(dropped.chart)), 'the value axis is deleted');
  check(!/<c:majorGridlines>/.test(valueAxis(dropped.chart)), 'no gridlines');
  check(labelFormats(dropped.chart).every(code => code === '#,##0'), 'the segment values are grouped');
  const kept = await exported(stacked([['North America', 5400, 2100, 90], ['Europe', 4600, 2300, 130]]));
  check(/<c:delete val="0"\/>/.test(valueAxis(kept.chart)) && /<c:majorGridlines>/.test(valueAxis(kept.chart)), 'a hairline segment keeps the axis and its gridlines');
}

// 4. A legend wider than the header row is the top legend on two rows, with the plot at the chart's width; the box holds both rows.
{
  const slide = columns => ({layout: 'comparison', title: 'Warranty claims by product line', blocks: [{chart: {type: 'stacked-bar', data: {columns: ['Product line', ...columns],
    rows: [['Controllers', 4.9, 2.5], ['Pumps', 2.1, 1.2], ['Valves', 0.8, 0.5], ['Sensors', 0.4, 0.3]]}}},
  {table: {columns: ['Product line', 'Claims per 1,000', 'Average cost', 'Main cause'], rows: [['Controllers', 24, '$310', 'Firmware faults'], ['Pumps', 18, '$185', 'Seal wear'], ['Valves', 11, '$120', 'Corrosion'], ['Sensors', 7, '$95', 'Calibration drift']]}}]});
  const manual = (chart, element) => {
    const block = new RegExp(`<c:${element}>[\\s\\S]*?<c:manualLayout>([\\s\\S]*?)</c:manualLayout>`).exec(chart)?.[1] ?? '';
    return Object.fromEntries([...block.matchAll(/<c:(x|y|w|h) val="([^"]*)"\/>/g)].map(match => [match[1], Number(match[2])]));
  };
  const wide = (await exported(slide(['Parts ($K per 1,000 units)', 'Labor ($K per 1,000 units)']))).chart;
  check(/<c:legendPos val="t"\/>/.test(wide), 'the legend is at the top');
  const legend = manual(wide, 'legend'), plot = manual(wide, 'plotArea');
  check(legend.w > 0 && legend.h > 0 && legend.x + legend.w <= 1.0001, `the legend box is inside the chart (${JSON.stringify(legend)})`);
  check(plot.x + plot.w > 0.9, `the plot reaches the chart's end, no side legend takes its width (${plot.x + plot.w})`);
  check(plot.y >= legend.y + legend.h - 0.001, 'the plot starts under the legend');
}

console.log(`lh-141-chart-fixes: ${checks} checks passed`);
