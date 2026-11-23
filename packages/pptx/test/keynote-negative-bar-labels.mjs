// Keynote review of 0.34 (opf#1278, coverage-charts slide 15): a bar or column chart whose values run below zero writes its category
// names at the low edge of the plot (c:tickLblPos low). Below a header row its plot area was an outer box, which Keynote fills with the plot,
// drawing the names past the chart frame ("Cranes" read "ranes"). The plot area is now the plot itself (layoutTarget inner): the labeled
// sides end where the preview's plot ends, so the names have their gutter outside it, and the other sides stay on the outer box, where
// PowerPoint's plot already reached. A chart of positive values keeps its outer box.
import assert from 'node:assert/strict';
import {unzipSync, strFromU8} from 'fflate';
import {toSvg} from '@openpresentation/opf-render';
import {toPptx} from '../dist/index.js';

const rows = [['Cranes', 14], ['Software', 22], ['Leasing', -6], ['Repairs', -3]];
const chart = (type, values, extra = {}) => ({type, data: {columns: ['Product', 'Margin'], rows: values}, ...extra});
const deck = {language: 'en-US', slides: [
  {title: 'Margins by product, two below zero', chart: chart('bar', rows, {dataLabels: true})},
  {title: 'Quarterly result, two quarters below zero', chart: chart('column', rows)},
  {title: 'Margins by product, all above zero', chart: chart('bar', rows.map(([name, value]) => [name, Math.abs(value)]), {dataLabels: true})},
  {title: 'Margins by product, with axis titles', chart: chart('bar', rows, {axisTitles: {category: 'Product', value: 'Margin'}})},
]};
const parts = unzipSync(await toPptx(deck));
const EMU_PX = 9525;

// The plot area's manual layout of slide n's chart, and its frame in slide pixels.
function plotArea(n) {
  const slide = strFromU8(parts[`ppt/slides/slide${n}.xml`]);
  const frame = /<p:graphicFrame>[\s\S]*?<a:off x="(\d+)" y="(\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(slide).slice(1).map(value => Number(value) / EMU_PX);
  const xml = strFromU8(parts[`ppt/charts/chart${n}.xml`]);
  const match = /<c:plotArea><c:layout><c:manualLayout><c:layoutTarget val="(\w+)"\/><c:xMode val="edge"\/><c:yMode val="edge"\/><c:x val="([\d.]+)"\/><c:y val="([\d.]+)"\/><c:w val="([\d.]+)"\/><c:h val="([\d.]+)"\/><\/c:manualLayout><\/c:layout>/.exec(xml);
  assert.ok(match, `chart ${n}: the plot area has a manual layout`);
  const [x, y, w, h] = match.slice(2).map(Number);
  const [fx, fy, fw, fh] = frame;
  return {target: match[1], x, y, w, h, xml, left: fx + x * fw, top: fy + y * fh, right: fx + (x + w) * fw, bottom: fy + (y + h) * fh};
}

// The preview's plot of slide n: the zero line and the bars or columns scaled to the axis bounds written in the chart part.
function previewPlot(n, horizontal, xml) {
  const svg = toSvg(deck, n);
  const min = Number(/<c:valAx>[\s\S]*?<c:min val="([-\d.]+)"/.exec(xml)[1]), max = Number(/<c:valAx>[\s\S]*?<c:max val="([-\d.]+)"/.exec(xml)[1]);
  const marks = [...svg.matchAll(/<rect fill="#(?!FFFFFF)[0-9A-F]{6}" height="([\d.]+)" width="([\d.]+)" x="([\d.]+)" y="([\d.]+)"\/>/g)].map(m => ({h: +m[1], w: +m[2], x: +m[3], y: +m[4]}));
  const lines = [...svg.matchAll(/<line [^>]*x1="([\d.]+)" x2="([\d.]+)" y1="([\d.]+)" y2="([\d.]+)"/g)].map(m => ({x1: +m[1], x2: +m[2], y1: +m[3], y2: +m[4]}));
  const top = Math.max(...rows.map(([, value]) => value));
  if (horizontal) {
    const zero = lines.find(line => line.x1 === line.x2 && marks.some(mark => Math.abs(mark.x - line.x1) < 0.01));
    const unit = (Math.max(...marks.map(mark => mark.x + mark.w)) - zero.x1) / top;
    return {left: zero.x1 + min * unit, right: zero.x1 + max * unit, top: zero.y1, bottom: zero.y2};
  }
  const zero = lines.find(line => line.y1 === line.y2 && marks.some(mark => Math.abs(mark.y + mark.h - line.y1) < 0.01));
  const unit = (zero.y1 - Math.min(...marks.map(mark => mark.y))) / top;
  return {left: zero.x1, right: zero.x2, top: zero.y1 - max * unit, bottom: zero.y1 - min * unit};
}

const near = (actual, expected, what) => assert.ok(Math.abs(actual - expected) < 0.6, `${what}: ${actual} px, expected ${expected} px`);
const outer = plotArea(3);
assert.equal(outer.target, 'outer', 'a positive bar chart keeps its outer plot area');
assert.match(outer.xml, /<c:catAx>[\s\S]*?<c:tickLblPos val="nextTo"\/>/);

// A horizontal bar chart: the names in the preview's gutter at the left; top, right and bottom on the outer box (no value axis).
const bar = plotArea(1);
assert.equal(bar.target, 'inner', 'a negative bar chart pins its plot (inner)');
assert.match(bar.xml, /<c:catAx>[\s\S]*?<c:tickLblPos val="low"\/>/);
near(bar.left, previewPlot(1, true, bar.xml).left, 'bar: the plot starts after the preview\'s category gutter');
assert.ok(bar.x > outer.x + 0.05, 'bar: the gutter lies outside the plot');
assert.deepEqual([bar.y, bar.h, Number((bar.x + bar.w).toFixed(4))], [outer.y, outer.h, Number((outer.x + outer.w).toFixed(4))], 'bar: the unlabeled sides stay on the outer box');

// A column chart: the names under the plot, where the preview's plot ends; left, top and right on the outer box (no value axis).
const column = plotArea(2);
assert.equal(column.target, 'inner', 'a negative column chart pins its plot (inner)');
near(column.bottom, previewPlot(2, false, column.xml).bottom, 'column: the plot ends above the preview\'s category labels');
assert.deepEqual([column.x, column.y, column.w], [outer.x, outer.y, outer.w], 'column: the unlabeled sides stay on the outer box');

// With its value axis (axis titles): the value tick labels under the plot also keep the preview's room.
const titled = plotArea(4);
const titledPreview = previewPlot(4, true, titled.xml);
assert.equal(titled.target, 'inner');
near(titled.left, titledPreview.left, 'titled bar: the category gutter');
near(titled.bottom, titledPreview.bottom, 'titled bar: the value tick row');
console.log('Keynote: negative bar and column charts pin their plot with the category names outside it.');
