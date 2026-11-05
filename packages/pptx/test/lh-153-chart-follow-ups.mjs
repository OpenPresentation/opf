// LH-153 and LH-154 in the PPTX export: the chartex constructs (waterfall, funnel, treemap, histogram, pareto) write `#,##0` on their labels and
// value axis where the preview groups thousands (a binned histogram's counts always; the signed waterfall format keeps its signs), a combo
// chart's two value axes and a scatter chart's Y axis (and its X axis over a span of 1000 or more) take it too; an author's format is kept and
// years stay years. The horizontal stacked bar chart's plot leaves its value axis title a band under the tick labels.
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {toPptx} from '../dist/index.js';

const decoder = new TextDecoder();
const deckOf = (slide, language = 'en') => ({language, design: {fontScheme: 'roboto', colorScheme: 'cool-horizon', variant: 'light1'}, slides: [slide]});
async function exported(chart) {
  const entries = unzipSync(await toPptx(deckOf({title: 'Chart', chart})));
  return {chartex: entries['ppt/charts/chartEx1.xml'] ? decoder.decode(entries['ppt/charts/chartEx1.xml']) : undefined, chart: decoder.decode(entries['ppt/charts/chart1.xml'])};
}
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const codes = (xml, tag) => [...xml.matchAll(new RegExp(`<cx:${tag}\\b[\\s\\S]*?</cx:${tag}>`, 'g'))].flatMap(block => [...block[0].matchAll(/<cx:numFmt formatCode="([^"]*)"/g)].map(match => match[1].replace(/&quot;/g, "\"")));
const axisCodes = xml => [...xml.matchAll(/<cx:axis id="(\d)"[^>]*>[\s\S]*?<\/cx:axis>/g)].map(block => [block[1], /<cx:numFmt formatCode="([^"]*)"/.exec(block[0])?.[1]]);

// 1. A waterfall of whole numbers with a four-digit value: its signed label format, its totals and its value axis take `#,##0`.
{
  const rows = [['2023', 12400], ['New', 3200], ['Churn', -1450], ['Upsell', 900], ['2024', 15050]];
  const {chartex} = await exported({type: 'waterfall', dataLabels: false, data: {columns: ['Step', 'Revenue'], rows}});
  check(chartex, 'a chartex part is written');
  check(axisCodes(chartex).some(([id, code]) => id === '1' && code === '#,##0'), `the value axis groups (${JSON.stringify(axisCodes(chartex))})`);
  const labeled = (await exported({type: 'waterfall', data: {columns: ['Step', 'Revenue'], rows}})).chartex;
  const formats = codes(labeled, 'dataLabels');
  check(formats.includes('"+"#,##0;"−"#,##0;#,##0'), `the signed label format groups (${formats})`);
  check(formats.includes('#,##0'), `the totals' own labels group (${formats})`);
  const written = (await exported({type: 'waterfall', data: {columns: ['Step', {name: 'Revenue', format: '0'}], rows}})).chartex;
  check(!codes(written, 'dataLabels').some(code => code.includes('#,##0')) && axisCodes(written).every(([, code]) => code === '0' || code === undefined), 'an author format is kept');
  const fractions = (await exported({type: 'waterfall', data: {columns: ['Step', 'Profit'], rows: [['2023', 1240.5], ['New', 320.5], ['2024', 1561]]}})).chartex;
  check(!fractions.includes('#,##0'), 'fractions keep the General form');
}

// 2. A funnel's labels, a treemap's value labels and a categorized histogram or Pareto chart group; a histogram of a lone column groups its counts.
{
  const funnel = (await exported({type: 'funnel', data: {columns: ['Stage', 'People'], rows: [['Visitors', 48200], ['Signups', 12400], ['Paid', 1850]]}})).chartex;
  check(codes(funnel, 'dataLabels').every(code => code === '#,##0') && codes(funnel, 'dataLabels').length > 0, `funnel labels (${codes(funnel, 'dataLabels')})`);
  const treemap = (await exported({type: 'treemap', dataLabels: {content: ['category', 'value']}, data: {columns: ['Line', 'Revenue'], rows: [['Hardware', 8400], ['Software', 5200]]}})).chartex;
  check(codes(treemap, 'dataLabels').includes('#,##0'), `treemap value labels (${codes(treemap, 'dataLabels')})`);
  const histogram = (await exported({type: 'histogram', dataLabels: {content: ['value']}, data: {columns: ['Bin', 'Orders'], rows: [['a', 1200], ['b', 5200], ['c', 4100]]}})).chartex;
  check(codes(histogram, 'dataLabels').includes('#,##0') && axisCodes(histogram).some(([id, code]) => id === '1' && code === '#,##0'), 'categorized histogram labels and axis');
  const raw = Array.from({length: 4000}, (_, index) => [20000 + Math.round(Math.sin(index) * 3000 + (index % 7) * 500)]);
  const binned = (await exported({type: 'histogram', dataLabels: {content: ['value']}, data: {columns: ['Salary'], rows: raw}})).chartex;
  check(codes(binned, 'dataLabels').includes('#,##0') && axisCodes(binned).some(([id, code]) => id === '1' && code === '#,##0'), 'binned histogram counts group');
  const pareto = (await exported({type: 'pareto', data: {columns: ['Cause', 'Defects'], rows: [['Scratches', 4200], ['Dents', 2900], ['Cracks', 800]]}})).chartex;
  const axes = axisCodes(pareto);
  check(axes.some(([id, code]) => id === '1' && code === '#,##0') && axes.every(([id, code]) => id !== '2' || code === undefined), `pareto groups, its percent axis keeps its unit (${JSON.stringify(axes)})`);
  const small = (await exported({type: 'funnel', data: {columns: ['Stage', 'People'], rows: [['a', 480], ['b', 120]]}})).chartex;
  check(!small.includes('#,##0'), 'three digits keep the General form');
}

// 3. A combo chart's primary and secondary axes, a scatter chart's Y axis and (over a span of 1000) X axis.
{
  const axes = xml => [...xml.matchAll(/<c:valAx>[\s\S]*?<\/c:valAx>/g)].map(block => ({code: /<c:numFmt formatCode="([^"]*)"/.exec(block[0])?.[1], position: /<c:axPos val="(\w)"/.exec(block[0])?.[1]}));
  const combo = (await exported({type: 'combo', line: ['Orders'], secondaryAxis: ['Orders'], data: {columns: ['Quarter', 'Revenue', 'Orders'], rows: [['Q1', 12400, 5200], ['Q2', 15800, 6100], ['Q3', 21500, 8400]]}})).chart;
  check(axes(combo).map(axis => axis.code).join('|') === '#,##0|#,##0', `combo axes (${JSON.stringify(axes(combo))})`);
  const split = (await exported({type: 'combo', line: ['Margin'], secondaryAxis: ['Margin'], data: {columns: ['Quarter', 'Revenue', {name: 'Margin', format: '0%'}], rows: [['Q1', 12400, 0.31], ['Q2', 15800, 0.34]]}})).chart;
  check(axes(split).map(axis => axis.code).join('|') === '#,##0|0%', `only the axis with no format groups (${JSON.stringify(axes(split))})`);
  const scatter = (await exported({type: 'scatter', data: {columns: ['Region', 'Spend', 'Revenue'], rows: [['A', 5000, 12000], ['B', 18000, 26500], ['C', 41000, 62000]]}})).chart;
  check(axes(scatter).length === 2 && axes(scatter).every(axis => axis.code === '#,##0'), `scatter axes (${JSON.stringify(axes(scatter))})`);
  check([...scatter.matchAll(/<c:xVal>[\s\S]*?<c:formatCode>([^<]*)<\/c:formatCode>/g)].every(match => match[1] === 'General'), 'the X cache keeps General');
  const years = (await exported({type: 'scatter', data: {columns: ['Point', 'Year', 'Units'], rows: [['a', 1990, 120], ['b', 2000, 560], ['c', 2010, 1450], ['d', 2020, 2300]]}})).chart;
  const yearAxes = axes(years);
  check(yearAxes.find(axis => axis.position === 'b')?.code !== '#,##0', `years stay years (${JSON.stringify(yearAxes)})`);
  check(yearAxes.find(axis => axis.position === 'l')?.code === '#,##0', 'the Y axis groups');
}

console.log(`lh-153-chart-follow-ups pptx: ${checks} checks`);
