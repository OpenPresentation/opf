// LH-125 in the PPTX export: horizontal stacked bars (values as native labels, the series named above the pinned plot, the value labels at the
// bottom), a stacked area that runs edge to edge (c:crossBetween midCat) with its end values as native text boxes, a doughnut's hole value,
// and the dashed connector lines of a native waterfall. Composition decides them (core chart-marks.ts); the preview draws the same.
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {toPptx} from '../dist/index.js';

const decoder = new TextDecoder();
const deckOf = slide => ({design: {fontScheme: 'roboto', colorScheme: 'cool-horizon', variant: 'light1'}, slides: [slide]});
async function exported(slide) {
  const entries = unzipSync(await toPptx(deckOf(slide)));
  return {chart: decoder.decode(entries['ppt/charts/chart1.xml']), chartex: entries['ppt/charts/chartEx1.xml'] ? decoder.decode(entries['ppt/charts/chartEx1.xml']) : undefined, slide: decoder.decode(entries['ppt/slides/slide1.xml']), entries};
}
const texts = xml => [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match => match[1]);
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };

// 1. A horizontal stacked bar chart: its plot is pinned, the names stand over it as native text boxes, no legend, and the value labels sit at the bottom.
{
  const {chart, slide} = await exported({title: 'Self-service carries most requests in every region', chart: {type: 'stacked-bar', data: {columns: ['Region', 'Self-service', 'Chat', 'Phone'],
    rows: [['North America', 5400, 2100, 900], ['Europe', 4600, 2300, 1300], ['Asia Pacific', 3900, 2800, 1100]]}}});
  check(/<c:plotArea><c:layout><c:manualLayout><c:layoutTarget val="inner"\/>/.test(chart), 'the plot area is pinned (inner)');
  check(!/<c:legend>/.test(chart), 'the names replace the legend');
  check(/<c:valAx>(?:(?!<\/c:valAx>)[\s\S])*<c:tickLblPos val="nextTo"\/>/.test(chart), 'the value labels sit next to the axis at the bottom, not at the top');
  check(/<c:dLblPos val="ctr"\/>/.test(chart), 'segment values are the chart\'s own labels, centered');
  for (const name of ['Self-service', 'Chat', 'Phone']) check(texts(slide).includes(name), `the series name ${name} is a text box`);
  check(/name="OPF chart 1 mark over \d+ stack-name"/.test(slide) && /name="OPF chart 1 mark over \d+ stack-swatch"/.test(slide), 'names and swatches are tagged chart marks');
}

// 2. A stacked area runs edge to edge; its first and last values are text boxes (the chart's own labels there are deleted).
{
  const {chart, slide} = await exported({title: 'Mobile now carries most of the traffic', chart: {type: 'stacked-area', data: {columns: ['Month', 'Mobile', 'Desktop'],
    rows: [['Jan', 310, 290], ['Feb', 342, 284], ['Mar', 381, 279], ['Apr', 420, 271], ['May', 462, 266], ['Jun', 503, 258]]}}});
  check(/<c:crossBetween val="midCat"\/>/.test(chart) && !/<c:crossBetween val="between"\/>/.test(chart), 'the category axis crosses on the tick marks');
  const names = [...slide.matchAll(/name="OPF chart 1 mark over \d+ stack-end"/g)].length;
  check(names === 4, `four end values (${names})`);
  for (const value of ['310', '503', '290', '258']) check(texts(slide).includes(value), `end value ${value}`);
  check(/<c:dLbl><c:idx val="0"\/><c:delete val="1"\/><\/c:dLbl>/.test(chart) && /<c:dLbl><c:idx val="5"\/><c:delete val="1"\/><\/c:dLbl>/.test(chart), 'no centered label at the ends');
  // A column chart keeps its categories between the tick marks.
  const column = await exported({title: 'Revenue', chart: {type: 'stacked-column', data: {columns: ['Quarter', 'A', 'B'], rows: [['Q1', 1, 2], ['Q2', 2, 3]]}}});
  check(/<c:crossBetween val="between"\/>/.test(column.chart), 'columns stay between the tick marks');
}

// 3. A doughnut prints the focused slice's value in its hole.
{
  const {slide} = await exported({title: 'Two in three tickets are resolved on first contact', chart: {type: 'doughnut', data: {columns: ['Outcome', 'Tickets'],
    rows: [['Resolved on first contact', 6240], ['Resolved after follow-up', 2180], ['Escalated', 890], ['Unresolved', 310]]}}});
  check(/name="OPF chart 1 mark over \d+ hole-value"/.test(slide), 'the hole value is a tagged text box');
  check(texts(slide).filter(text => text === '6240').length >= 2, 'the value is in the hole and in the list');
  const size = Number(/name="OPF chart 1 mark over \d+ hole-value"[\s\S]*?<a:rPr[^>]*\bsz="(\d+)"/.exec(slide)?.[1]);
  check(size >= 2000, `the hole value is larger than the chart text (${size})`);
}

// 4. A native waterfall's connectors are dashed gray lines (the series line), and its bars carry no outline.
{
  const {chartex: chart} = await exported({title: 'Price and volume more than offset cost increases', chart: {type: 'waterfall', data: {columns: ['Step', 'Operating profit ($M)'],
    rows: [['2024 profit', 42], ['Volume', 9.3], ['Price', 6.1], ['Materials', -7.4], ['2025 profit', 50.0]]}}});
  check(/<cx:visibility connectorLines="1"\/>/.test(chart), 'connector lines on');
  check(/<cx:series [^>]*>[\s\S]*?<cx:spPr><a:solidFill>[\s\S]*?<\/a:solidFill><a:ln w="12700" cap="flat"><a:solidFill>[\s\S]*?<\/a:solidFill><a:prstDash val="dash"\/><\/a:ln><\/cx:spPr>/.test(chart), 'the series line is dashed');
  const bars = [...chart.matchAll(/<cx:dataPt idx="\d+"><cx:spPr>[\s\S]*?<\/cx:spPr><\/cx:dataPt>/g)].map(match => match[0]);
  check(bars.length === 5 && bars.every(bar => bar.includes('<a:ln><a:noFill/></a:ln>')), 'every bar has no outline of its own');
}

console.log(`LH-125 export passed: ${checks} checks (stacked bars, edge-to-edge area, doughnut hole, waterfall connectors).`);
