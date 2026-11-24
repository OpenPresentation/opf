// opf#1415: a column or bar chart without its value axis whose marks carry value labels (the small chart, LH-03) has the preview's plot.
// Since a small column chart's axis ends at its tallest column (0.35.2), PowerPoint drew that column up to the top of the outer plot area,
// right under the heading row, and its label on the heading's line ("Wait by terminal 42"). The export now writes the plot area as the
// plot itself (layoutTarget inner) at the box the preview draws: the tallest column's top lies one label line under the heading, and a
// horizontal bar chart's plot ends the widest label's room before the chart's edge. Pins that geometry against the preview's SVG.
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {toSvg} from '@openpresentation/opf-render';
import {toPptx} from '../dist/index.js';

const decoder = new TextDecoder();
const EMU = 9525;
const columns = (rows, extra = {}) => ({type: 'column', data: {columns: ['Terminal', ...Object.keys(rows[0][1])], rows: rows.map(([name, values]) => [name, ...Object.values(values)])}, ...extra});
const cases = {
  'one series, tallest first': columns([['North', {Wait: 42}], ['South', {Wait: 28}], ['East', {Wait: 35}]]),
  'one series, tallest last': columns([['North', {Wait: 18}], ['South', {Wait: 28}], ['East', {Wait: 47}]]),
  'two series': columns([['North', {Wait: 42, Queue: 12}], ['South', {Wait: 28, Queue: 31}], ['East', {Wait: 35, Queue: 14}]]),
  'legend at the top': columns([['North', {Wait: 42}], ['South', {Wait: 28}], ['East', {Wait: 35}]], {legend: 'top'}),
  'two series, legend at the bottom': columns([['North', {Wait: 42, Queue: 12}], ['South', {Wait: 28, Queue: 31}], ['East', {Wait: 35, Queue: 14}]], {legend: 'bottom'}),
  'bar, longest last': {type: 'bar', data: {columns: ['Terminal', 'Wait'], rows: [['North', 18], ['South', 28], ['East', 47]]}},
};
// Charts with their value axis below a heading: the plot starts where the preview's does (its padding and half a text line under the
// heading), not at the heading's bottom edge, and keeps the preview's tick label and axis title room (the dashboard of the sweep, C05).
const axisCases = {
  'column with its axis and axis titles': {type: 'column', axisTitles: {category: 'Week', value: 'Task completion'}, data: {columns: ['Week', {name: 'Task completion', format: '0%'}], rows: [['1', 0.68], ['2', 0.72], ['3', 0.76], ['4', 0.84]]}},
  'bar with its axis and an axis title': {type: 'bar', axisTitles: {value: 'Median task time (min)'}, data: {columns: ['Team', {name: 'Median task time (min)', format: '0.0'}], rows: [['A', 5.8], ['B', 6.7]]}},
};
const dashboard = {slides: [{title: 'Pilot at a glance', layout: 'dashboard', blocks: [{metric: {value: 52, label: 'Trial participants'}}, {metric: {value: '84%', label: 'Task completion'}}, ...Object.values(axisCases).map(chart => ({chart}))]}]};
{
  const entries = unzipSync(await toPptx(dashboard));
  const slide = decoder.decode(entries['ppt/slides/slide1.xml']);
  const frames = [...slide.matchAll(/<p:graphicFrame>[\s\S]*?<a:off x="(\d+)" y="(\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/g)].map(match => match.slice(1).map(value => Number(value) / EMU));
  assert.equal(frames.length, 2);
  const svg = toSvg(dashboard, 1);
  // The preview's gridlines and axis lines of each chart span its plot.
  const lines = [...svg.matchAll(/<line\b[^>]*>/g)].map(([tag]) => Object.fromEntries([...tag.matchAll(/\b(x1|x2|y1|y2)="([\d.]+)"/g)].map(([, key, value]) => [key, Number(value)])));
  Object.keys(axisCases).forEach((name, index) => {
    const xml = decoder.decode(entries[`ppt/charts/chart${index + 1}.xml`]);
    assert.match(xml, /<c:valAx>[\s\S]*?<c:delete val="0"\/>/, `${name}: the value axis is shown`);
    const layout = /<c:plotArea><c:layout><c:manualLayout>([\s\S]*?)<\/c:manualLayout>/.exec(xml)?.[1];
    assert.match(layout ?? '', /<c:layoutTarget val="inner"\/>/, `${name}: the plot itself`);
    const at = key => Number(new RegExp(`<c:${key} val="([^"]+)"/>`).exec(layout)[1]);
    const [fx, fy, fw, fh] = frames[index];
    const plot = {left: fx + at('x') * fw, top: fy + at('y') * fh, right: fx + (at('x') + at('w')) * fw, bottom: fy + (at('y') + at('h')) * fh};
    const inside = lines.filter(line => Math.min(line.x1, line.x2) >= fx - 1 && Math.max(line.x1, line.x2) <= fx + fw + 1 && Math.min(line.y1, line.y2) >= fy - 1 && Math.max(line.y1, line.y2) <= fy + fh + 1);
    assert.ok(inside.length >= 3, `${name}: the preview draws its gridlines`);
    const preview = {left: Math.min(...inside.map(line => Math.min(line.x1, line.x2))), right: Math.max(...inside.map(line => Math.max(line.x1, line.x2))),
      top: Math.min(...inside.map(line => Math.min(line.y1, line.y2))), bottom: Math.max(...inside.map(line => Math.max(line.y1, line.y2)))};
    for (const side of ['left', 'top', 'right', 'bottom']) assert.ok(Math.abs(plot[side] - preview[side]) < 1, `${name}: plot ${side} ${plot[side].toFixed(2)} in PowerPoint, ${preview[side].toFixed(2)} in the preview`);
  });
}

for (const [name, chart] of Object.entries(cases)) {
  const deck = {slides: [{title: name, chart}]};
  const entries = unzipSync(await toPptx(deck));
  const xml = decoder.decode(entries['ppt/charts/chart1.xml']);
  assert.match(xml, /<c:valAx>[\s\S]*?<c:delete val="1"\/>/, `${name}: a small chart (no value axis)`);
  assert.match(xml, /<c:showVal val="1"\/>/, `${name}: labeled marks`);
  const layout = /<c:plotArea><c:layout><c:manualLayout>([\s\S]*?)<\/c:manualLayout>/.exec(xml)?.[1];
  assert.ok(layout, `${name}: the plot area has a layout`);
  assert.match(layout, /<c:layoutTarget val="inner"\/>/, `${name}: the plot itself`);
  const at = key => Number(new RegExp(`<c:${key} val="([^"]+)"/>`).exec(layout)[1]);
  const frame = /<p:graphicFrame>[\s\S]*?<a:off x="(\d+)" y="(\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(decoder.decode(entries['ppt/slides/slide1.xml'])).slice(1).map(value => Number(value) / EMU);
  const plot = {x: frame[0] + at('x') * frame[2], y: frame[1] + at('y') * frame[3], width: at('w') * frame[2], height: at('h') * frame[3]};
  // The preview's marks: the bars or columns in the first series color, in slide pixels (1280 x 720).
  const svg = toSvg(deck, 1);
  assert.equal(typeof svg, 'string');
  const marks = [...String(svg).matchAll(/<rect\b[^>]*>/g)].map(([tag]) => Object.fromEntries([...tag.matchAll(/\b(x|y|width|height)="([\d.]+)"/g)].map(([, key, value]) => [key, Number(value)])))
    .filter(rect => rect.width > 20 && rect.height > 20 && rect.width < 1200);
  assert.ok(marks.length >= 3, `${name}: the preview draws the marks (${marks.length})`);
  const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1, `${name}: ${what} ${a.toFixed(2)} in PowerPoint, ${b.toFixed(2)} in the preview`);
  if (chart.type === 'bar') {
    // The longest bar ends where the axis maximum puts it in the preview's plot; the plot keeps the label's room before the chart edge.
    const max = Number(/<c:max val="([^"]+)"\/>/.exec(xml)[1]), longest = Math.max(...marks.map(rect => rect.width));
    near(plot.x, Math.min(...marks.map(rect => rect.x)), 'the plot starts');
    near(plot.width * 47 / max, longest, 'the longest bar');
    assert.ok(frame[0] + frame[2] - (plot.x + longest) > 30, `${name}: room for the last label before the chart's edge`);
  } else {
    // The tallest column (the axis maximum) reaches the plot's top, one label line under the heading or legend, as in the preview.
    near(plot.y, Math.min(...marks.map(rect => rect.y)), 'the tallest column top');
    near(plot.y + plot.height, Math.max(...marks.map(rect => rect.y + rect.height)), 'the plot bottom');
    assert.ok(plot.y - frame[1] > 40, `${name}: a label line between the chart's top and its tallest column`);
  }
}
console.log(`Chart label room passed: ${Object.keys(cases).length} small column and bar charts and ${Object.keys(axisCases).length} charts with their axis keep the preview's plot under the heading.`);
