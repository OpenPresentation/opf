// Keynote review of 0.36 (opf#1492): a bar or column chart below a header row wrote its plot area as an outer box (layoutTarget outer),
// which PowerPoint fills with the plot after it takes the room for the tick labels out of it. Keynote reads a manual box as the inner plot
// whatever its target says, so it drew the category names of a horizontal bar chart past the chart's left edge, cut off ("Cranes" read
// "ranes"). Only the charts of a value range below zero (opf#1425) and the charts that opf#1415 gave the preview's plot had an inner box:
// a horizontal bar chart with data labels fell through the second rule (its value axis is hidden and core's horizontalBarPlot refuses a
// chart with options, so the export had no plot to write) and kept the outer box. Every bar and column chart with a manual plot area is now
// written as the plot itself (layoutTarget inner). This test pins, for a set of charts (horizontal and vertical, with data labels and
// without, one series and several, a legend at each side, axis titles, stacked, a range below zero), that no such chart keeps an outer
// box and that each inner box is the plot rectangle the preview draws, within the rounding of the fractions the file stores (four
// decimals of the frame, and the preview's three decimals of a pixel).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {unzipSync, strFromU8} from 'fflate';
import {toSvg} from '@openpresentation/opf-render';
import {toPptx} from '../dist/index.js';

const EMU_PX = 9525;
const rows = [['Cranes', 14, 9], ['Software', 22, 12], ['Leasing', 6, 8], ['Repairs', 3, 5]];
const series = count => ({columns: ['Product', 'Margin', 'Cost'].slice(0, count + 1), rows: rows.map(row => row.slice(0, count + 1))});
const longNames = (type, legend) => ({type, legend, data: {columns: ['Product', 'Margin this quarter, all regions', 'Cost this quarter, all regions'], rows: rows.map(row => row.slice(0, 3))}});
const chart = (type, count, extra = {}) => ({type, data: series(count), ...extra});
const cases = {
  'bar with data labels (opf#1492)': chart('bar', 1, {dataLabels: true}),
  'bar, two series, data labels': chart('bar', 2, {dataLabels: true}),
  'bar with an axis title and data labels': chart('bar', 1, {dataLabels: true, axisTitles: {category: 'Product'}}),
  'bar with both axis titles': chart('bar', 1, {axisTitles: {category: 'Product', value: 'Margin'}}),
  'bar without data labels': chart('bar', 1),
  'bar, two series': chart('bar', 2),
  'bar with reference lines': chart('bar', 1, {referenceLines: [{value: 10, label: 'Goal'}]}),
  'bar, highlight and data labels': chart('bar', 1, {dataLabels: true, highlight: {categories: ['Software']}}),
  'bar with a percent format': {type: 'bar', dataLabels: true, data: {columns: ['Product', {name: 'Share', format: '0%'}], rows: [['A', 0.3], ['B', 0.5], ['C', 1]]}},
  'bar, twelve rows': {type: 'bar', dataLabels: true, data: {columns: ['Product', 'Margin'], rows: Array.from({length: 12}, (_, index) => [`Item number ${index}`, index * 3 + 1])}},
  'bar, legend at the left': chart('bar', 2, {legend: 'left'}),
  'bar, legend at the right': chart('bar', 2, {legend: 'right'}),
  'bar, legend at the top': chart('bar', 2, {legend: 'top'}),
  'bar, legend at the bottom': chart('bar', 2, {legend: 'bottom'}),
  'bar, legend at the bottom, data labels': chart('bar', 2, {legend: 'bottom', dataLabels: true}),
  'column with data labels': chart('column', 1, {dataLabels: true}),
  'column without data labels': chart('column', 1),
  'column, two series': chart('column', 2),
  'column with both axis titles': chart('column', 1, {axisTitles: {category: 'Product', value: 'Margin'}}),
  'column, legend at the left': chart('column', 2, {legend: 'left'}),
  'column, legend at the right': chart('column', 2, {legend: 'right'}),
  'column, legend at the top': chart('column', 2, {legend: 'top'}),
  'column, legend at the bottom': chart('column', 2, {legend: 'bottom'}),
  'column with reference lines': chart('column', 1, {referenceLines: [{value: 10, label: 'Goal'}]}),
  'stacked bar': chart('stacked-bar', 2),
  'stacked bar with data labels': chart('stacked-bar', 2, {dataLabels: true}),
  '100% stacked bar': chart('100pct-stacked-bar', 2),
  '100% stacked bar with data labels': chart('100pct-stacked-bar', 2, {dataLabels: true}),
  'stacked bar, legend at the bottom': chart('stacked-bar', 2, {legend: 'bottom'}),
  // opf#1513: a chart with a legend option has no header row, and its plot was left to PowerPoint: it is the preview's (long names: a wide side legend).
  'bar with long series names, legend at the left': longNames('bar', 'left'),
  'bar with long series names, legend at the right': longNames('bar', 'right'),
  'bar with long series names, legend at the top': longNames('bar', 'top'),
  'bar with long series names, legend at the bottom, data labels': {...longNames('bar', 'bottom'), dataLabels: true},
  'stacked bar, legend at the right': chart('stacked-bar', 2, {legend: 'right'}),
  '100% stacked bar, legend at the left': chart('100pct-stacked-bar', 2, {legend: 'left'}),
  '100% stacked bar, legend at the top, data labels': chart('100pct-stacked-bar', 2, {legend: 'top', dataLabels: true}),
  'stacked column, legend at the right': chart('stacked-column', 2, {legend: 'right'}),
  'column with long series names, legend at the right': longNames('column', 'right'),
  'stacked column': chart('stacked-column', 2),
  'stacked column with data labels': chart('stacked-column', 2, {dataLabels: true}),
};
const deck = {language: 'en-US', slides: Object.keys(cases).map(name => ({title: name, chart: cases[name]}))};
const parts = unzipSync(await toPptx(deck));
const names = Object.keys(cases);

// The chart's frame in slide pixels and its plot area layout, written as fractions of the frame.
function written(n) {
  const slide = strFromU8(parts[`ppt/slides/slide${n}.xml`]);
  const frame = /<p:graphicFrame>[\s\S]*?<a:off x="(\d+)" y="(\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(slide).slice(1).map(value => Number(value) / EMU_PX);
  const xml = strFromU8(parts[`ppt/charts/chart${n}.xml`]);
  const layout = /<c:plotArea><c:layout(?:\/>|>(?:<c:manualLayout><c:layoutTarget val="(\w+)"\/><c:xMode val="edge"\/><c:yMode val="edge"\/><c:x val="([\d.]+)"\/><c:y val="([\d.]+)"\/><c:w val="([\d.]+)"\/><c:h val="([\d.]+)"\/>)?)/.exec(xml);
  assert.ok(layout, `${names[n - 1]}: the plot area has a layout element`);
  const [fx, fy, fw, fh] = frame;
  const [target, x, y, w, h] = [layout[1], ...layout.slice(2).map(Number)];
  return {frame, xml, target, plot: layout[1] ? {left: fx + x * fw, top: fy + y * fh, right: fx + (x + w) * fw, bottom: fy + (y + h) * fh} : undefined};
}

// The plot rectangle the preview draws, from its SVG: the axis and gridlines span the plot; a chart without its value axis (a small chart
// labels its marks) has only the category axis line, so the value end of the plot follows the marks and the axis bounds written in the chart.
function previewPlot(n, {frame, xml}, horizontal) {
  const [fx, fy, fw, fh] = frame;
  const svg = toSvg(deck, n);
  const inside = box => box.x >= fx - 1 && box.y >= fy - 1 && box.x + box.w <= fx + fw + 1 && box.y + box.h <= fy + fh + 1;
  const lines = [...svg.matchAll(/<line\b[^>]*>/g)].map(([tag]) => Object.fromEntries([...tag.matchAll(/\b(x1|x2|y1|y2)="([\d.]+)"/g)].map(([, key, value]) => [key, Number(value)])))
    .filter(line => inside({x: Math.min(line.x1, line.x2), y: Math.min(line.y1, line.y2), w: Math.abs(line.x2 - line.x1), h: Math.abs(line.y2 - line.y1)}));
  assert.ok(lines.length >= 1, `${names[n - 1]}: the preview draws an axis line`);
  const box = {left: Math.min(...lines.map(line => Math.min(line.x1, line.x2))), right: Math.max(...lines.map(line => Math.max(line.x1, line.x2))),
    top: Math.min(...lines.map(line => Math.min(line.y1, line.y2))), bottom: Math.max(...lines.map(line => Math.max(line.y1, line.y2)))};
  if (!/<c:valAx>[\s\S]*?<c:delete val="1"\/>/.test(xml)) return box;
  const min = Number(/<c:valAx>[\s\S]*?<c:min val="([-\d.]+)"/.exec(xml)?.[1] ?? 0), max = Number(/<c:valAx>[\s\S]*?<c:max val="([-\d.]+)"/.exec(xml)[1]);
  const marks = [...svg.matchAll(/<rect\b[^>]*>/g)].map(([tag]) => Object.fromEntries([...tag.matchAll(/\b(x|y|width|height)="([\d.]+)"/g)].map(([, key, value]) => [key, Number(value)])))
    .map(rect => ({x: rect.x, y: rect.y, w: rect.width, h: rect.height})).filter(rect => rect.w > 12 && rect.h > 12 && rect.w < 1200 && inside(rect)
      && (horizontal ? rect.x >= box.left - 1 && rect.y >= box.top - 1 && rect.y + rect.h <= box.bottom + 1 : rect.x >= box.left - 1 && rect.x + rect.w <= box.right + 1 && rect.y + rect.h <= box.bottom + 1));
  assert.ok(marks.length >= 3, `${names[n - 1]}: the preview draws the marks (${marks.length})`);
  // The largest end value the marks reach: the tallest value of a clustered chart, the tallest stack of a stacked one.
  const chart = cases[names[n - 1]], stacked = /^(stacked|100pct)/.test(chart.type);
  const values = chart.data.rows.map(row => row.slice(1).map(Number));
  const reach = /^100pct/.test(chart.type) ? max : Math.max(...values.map(row => stacked ? row.reduce((sum, value) => sum + value, 0) : Math.max(...row)));
  if (horizontal) {
    const longest = Math.max(...marks.map(rect => rect.x + rect.w)) - box.left;
    return {...box, right: box.left + longest * (max - min) / (reach - min)};
  }
  const tallest = box.bottom - Math.min(...marks.map(rect => rect.y));
  return {...box, top: box.bottom - tallest * (max - min) / (reach - min)};
}

let boxes = 0, automatic = 0;
for (const [index, name] of names.entries()) {
  const n = index + 1, plotArea = written(n);
  assert.notEqual(plotArea.target, 'outer', `${name}: a bar or column chart writes no outer plot area (Keynote reads it as the inner plot and cuts the names)`);
  if (!plotArea.plot) { automatic++; continue; }
  assert.equal(plotArea.target, 'inner', `${name}: the plot itself`);
  const horizontal = /bar$/.test(cases[name].type), preview = previewPlot(n, plotArea, horizontal);
  // One rounding step: a fraction is written to four decimals of the frame; the preview prints three decimals of a pixel.
  for (const side of ['left', 'top', 'right', 'bottom']) {
    const dimension = side === 'left' || side === 'right' ? plotArea.frame[2] : plotArea.frame[3], step = 1e-4 * dimension + 0.002;
    // A 100% stacked bar chart's right edge is pulled in by what its "100%" end label lacks (PowerPoint moved the whole plot left by 2.3 px
    // otherwise, measured 2026-11-25); the preview keeps no room for that label, so this one edge is allowed to be up to 4 px short, never long.
    if (side === 'right' && /^100pct/.test(cases[name].type)) { assert.ok(preview.right - plotArea.plot.right >= -step && preview.right - plotArea.plot.right <= 4, `${name}: plot right ${plotArea.plot.right.toFixed(3)} in the file, ${preview.right.toFixed(3)} in the preview`); continue; }
    assert.ok(Math.abs(plotArea.plot[side] - preview[side]) <= step, `${name}: plot ${side} ${plotArea.plot[side].toFixed(3)} in the file, ${preview[side].toFixed(3)} in the preview`);
  }
  boxes++;
}
assert.ok(boxes >= 20, `most of the charts have a manual plot area (${boxes})`);

// Bands (FR-07): a bar or column chart with labeled bands keeps an inner plot too (core pins it for the bands, the same rule that gives every
// other bar and column chart the preview's plot), and the bars start on the preview's axis line. The bands are drawn behind the data over
// the plot, so the union of the preview's large rectangles is the plot. A bullet chart (bars, a target and bands on two axes) is not changed
// by this rule: its plot is whatever its own layout wrote.
{
  const rows = [['Cranes', 14], ['Software', 22], ['Leasing', 6], ['Repairs', 3]];
  const bands = [{to: 10, label: 'Low'}, {to: 20, label: 'Mid'}, {to: 30, label: 'High'}];
  const banded = {};
  for (const type of ['bar', 'column']) for (const labels of [false, true]) banded[`${type} with three labeled bands${labels ? ' and data labels' : ''}`] = {type, data: {columns: ['Product', 'Margin'], rows}, bands, ...(labels ? {dataLabels: true} : {})};
  const bandDeck = {language: 'en-US', slides: Object.entries(banded).map(([name, chart]) => ({title: name, chart}))};
  const bandParts = unzipSync(await toPptx(bandDeck));
  for (const [index, [name, chart]] of Object.entries(banded).entries()) {
    const n = index + 1, slide = strFromU8(bandParts[`ppt/slides/slide${n}.xml`]);
    const [fx, fy, fw, fh] = /<p:graphicFrame>[\s\S]*?<a:off x="(\d+)" y="(\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(slide).slice(1).map(value => Number(value) / EMU_PX);
    const xml = strFromU8(bandParts[`ppt/charts/chart${n}.xml`]);
    const layout = /<c:plotArea><c:layout><c:manualLayout><c:layoutTarget val="(\w+)"\/><c:xMode val="edge"\/><c:yMode val="edge"\/><c:x val="([\d.]+)"\/><c:y val="([\d.]+)"\/><c:w val="([\d.]+)"\/><c:h val="([\d.]+)"\/>/.exec(xml);
    assert.ok(layout, `${name}: a manual plot area`);
    assert.equal(layout[1], 'inner', `${name}: the plot itself`);
    const [x, y, w, h] = layout.slice(2).map(Number), plot = {left: fx + x * fw, top: fy + y * fh, right: fx + (x + w) * fw, bottom: fy + (y + h) * fh};
    const svg = toSvg(bandDeck, n);
    const rects = [...svg.matchAll(/<rect\b[^>]*>/g)].map(([tag]) => Object.fromEntries([...tag.matchAll(/\b(x|y|width|height)="([\d.]+)"/g)].map(([, key, value]) => [key, Number(value)])))
      .map(rect => ({x: rect.x, y: rect.y, w: rect.width, h: rect.height})).filter(rect => rect.w > 12 && rect.h > 12 && rect.w < 1200 && rect.x >= fx - 1 && rect.y >= fy - 1 && rect.x + rect.w <= fx + fw + 1 && rect.y + rect.h <= fy + fh + 1);
    const union = {left: Math.min(...rects.map(r => r.x)), top: Math.min(...rects.map(r => r.y)), right: Math.max(...rects.map(r => r.x + r.w)), bottom: Math.max(...rects.map(r => r.y + r.h))};
    // The last band ends at its own value, and the axis may run further (35 for a last band of 30): the far edge follows the axis bounds.
    const axisMin = Number(/<c:valAx>[\s\S]*?<c:min val="([-\d.]+)"/.exec(xml)?.[1] ?? 0), axisMax = Number(/<c:valAx>[\s\S]*?<c:max val="([-\d.]+)"/.exec(xml)[1]), lastBand = chart.bands.at(-1).to;
    if (chart.type === 'bar') union.right = union.left + (union.right - union.left) * (axisMax - axisMin) / (lastBand - axisMin);
    else union.top = union.bottom - (union.bottom - union.top) * (axisMax - axisMin) / (lastBand - axisMin);
    for (const side of ['left', 'top', 'right', 'bottom']) assert.ok(Math.abs(plot[side] - union[side]) <= 1e-4 * (side === 'left' || side === 'right' ? fw : fh) + 0.2, `${name}: plot ${side} ${plot[side].toFixed(2)} in the file, ${union[side].toFixed(2)} in the preview's bands`);
    const axis = toSvg(bandDeck, n).match(/<line\b[^>]*>/)?.[0], at = key => Number(new RegExp(`\\b${key}="([\\d.]+)"`).exec(axis)[1]);
    if (chart.type === 'bar') assert.ok(Math.abs(plot.left - at('x1')) < 0.2, `${name}: the bars start on the preview's axis line`);
    else assert.ok(Math.abs(plot.bottom - at('y1')) < 0.2, `${name}: the columns stand on the preview's axis line`);
  }
  const bullet = JSON.parse(fs.readFileSync(new URL('../../../examples/technical/bands-and-bullet.opf.json', import.meta.url), 'utf8'));
  const bulletIndex = bullet.slides.findIndex(slide => [slide.chart, ...(slide.blocks ?? []).map(block => block.chart)].some(chart => chart?.type === 'bullet'));
  assert.ok(bulletIndex >= 0, 'the bands example has a bullet chart');
  const bulletParts = unzipSync(await toPptx({...bullet, slides: [bullet.slides[bulletIndex]]}));
  const bulletXml = strFromU8(bulletParts['ppt/charts/chart1.xml']);
  assert.match(bulletXml, /<c:scatterChart>/, 'the bullet chart keeps its target series');
  assert.ok(!/<c:layoutTarget val="outer"\/>/.test(bulletXml), 'the bullet chart has no outer plot area either');
}

// The first case is the report's: its category names have their room at the left, as the preview's gutter.
const report = written(1);
assert.ok(report.plot.left - report.frame[0] > 60, 'the category names keep a gutter left of the plot');
// A chart whose range runs below zero keeps its form from opf#1425: the labeled sides on the preview's plot, the others on the outer box.
const negative = unzipSync(await toPptx({slides: [{title: 'Below zero', chart: {type: 'bar', data: {columns: ['Product', 'Margin'], rows: [['Cranes', 14], ['Software', 22], ['Leasing', -6], ['Repairs', -3]]}, dataLabels: true}}]}));
assert.match(strFromU8(negative['ppt/charts/chart1.xml']), /<c:plotArea><c:layout><c:manualLayout><c:layoutTarget val="inner"\/>/);
console.log(`Keynote: ${boxes} bar and column charts write the preview's plot as an inner box (${automatic} keep an automatic plot area; none an outer box).`);
