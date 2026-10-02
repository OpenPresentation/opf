// RR-36: a single-series column or bar chart has one colour, as the preview draws it. PptxGenJS wrote a c:dPt per point
// (cycling the palette) for a bar chart with one series and a custom palette, so PowerPoint drew every column in a
// different colour while opf-render drew the series colour. Pie and doughnut keep one colour per slice.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {fromPptx, toPptx} from '../dist/index.js';

const one = {columns: ['Quarter', 'Revenue'], rows: [['Q1', 12], ['Q2', 20], ['Q3', 15], ['Q4', 22]]};
const two = {columns: ['Quarter', 'North', 'South'], rows: [['Q1', 12, 5], ['Q2', 20, 8], ['Q3', 15, 12], ['Q4', 22, 9]]};
const signed = {columns: ['Step', 'Delta'], rows: [['Start', 40], ['Gain', 25], ['Loss', -18], ['Gain', 12]]};

async function chartXml(chart, design = {fontScheme: 'roboto'}) {
  const parts = unzipSync(await toPptx({design, slides: [{title: 'Chart', chart}]}));
  return strFromU8(parts['ppt/charts/chart1.xml']);
}
const series = (xml) => [...xml.matchAll(/<c:ser>([\s\S]*?)<\/c:ser>/g)].map(([, body]) => body);
const seriesFill = (body) => body.match(/<c:spPr>\s*<a:solidFill>\s*<a:srgbClr val="([0-9A-F]{6})"/)?.[1];
const pointFills = (body) => [...body.matchAll(/<c:dPt>[\s\S]*?<a:srgbClr val="([0-9A-F]{6})"[\s\S]*?<\/c:dPt>/g)].map(([, color]) => color);

let checked = 0;
for (const design of [{fontScheme: 'roboto'}, {fontScheme: 'roboto', theme: 'dark'}]) {
  // The colour of series 0 in a two-series chart is the colour the single series must have (preview: palette colour 0).
  const reference = seriesFill(series(await chartXml({type: 'column', data: two}, design))[0]);
  assert.match(reference ?? '', /^[0-9A-F]{6}$/);
  for (const [type, data] of [['column', one], ['bar', one], ['stacked-column-3x', one], ['column', signed], ['waterfall', signed]]) {
    const xml = await chartXml({type, data}, design);
    assert.match(xml, /<c:barChart>/, `${type}: a classic bar chart part`);
    assert.match(xml, /<c:varyColors val="0"\/>/, `${type}: colours do not vary by point`);
    const [only, ...rest] = series(xml);
    assert.equal(rest.length, 0, `${type}: one series`);
    assert.deepEqual(pointFills(only), [], `${type}: no per-point colour (c:dPt)`);
    assert.equal(seriesFill(only), reference, `${type}: the series has palette colour 0, as in the preview`);
    checked++;
  }
  // Two or more series: one colour per series, no point overrides (unchanged).
  for (const type of ['column', 'bar']) {
    const sers = series(await chartXml({type, data: two}, design));
    assert.equal(sers.length, 2);
    assert.ok(sers.every((body) => pointFills(body).length === 0), `${type}: no c:dPt with two series`);
    assert.notEqual(seriesFill(sers[0]), seriesFill(sers[1]), `${type}: each series has its own colour`);
    checked++;
  }
  // Pie and doughnut keep one colour per slice (c:dPt), as the preview draws them.
  for (const type of ['pie', 'doughnut']) {
    const [slices] = series(await chartXml({type, data: one}, design));
    const fills = pointFills(slices);
    assert.equal(fills.length, one.rows.length, `${type}: one c:dPt per slice`);
    assert.equal(new Set(fills).size, fills.length, `${type}: each slice its own colour`);
    checked++;
  }
}
// The data still round-trips.
const imported = await fromPptx(await toPptx({slides: [{title: 'Chart', chart: {type: 'column', data: one}}]}));
assert.deepEqual((imported.slides[0].chart ?? imported.slides[0].blocks?.find((block) => block.chart)?.chart).data, one);
console.log(`Single-series colour passed: ${checked} charts, single-series column and bar charts write one series colour and no c:dPt; multi-series and pie/doughnut unchanged.`);
