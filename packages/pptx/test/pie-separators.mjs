// opf#1430: a pie or doughnut exports as the preview draws it. The preview separates its slices with an outline in the color of the surface
// it stands on (CHART_SLICE_SEPARATOR_PX, or the 0.75 pt outline neutral when the slice colors already differ enough), but a highlight
// recolored every solid fill of a slice's c:dPt, its outline included, so two muted slices of one fill read as one slice in PowerPoint. And
// the plot area was automatic (or outer below a header row), so PowerPoint drew the pie about a tenth larger than the preview and higher.
// Pins, for every case of the family, each slice outline (color and width) and the plot square (center and radius, within a pixel) against
// the preview's SVG.
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {toSvg} from '@openpresentation/opf-render';
import {toPptx} from '../dist/index.js';

const EMU = 9525, decoder = new TextDecoder();
const share = {columns: ['Region', 'Share'], rows: [['EMEA', 40], ['APAC', 35], ['AMER', 25]]};
const arabic = {columns: ['المنطقة', 'الحصة'], rows: [['أوروبا', 40], ['آسيا', 35], ['أمريكا', 25]]};
const rtl = {name: 'Arabic', bcp47: 'ar', direction: 'rtl', script: 'Arab'};
const pie = (extra = {}, data = share) => ({type: 'pie', data, ...extra});
const doughnut = (extra = {}, data = share) => ({type: 'doughnut', data, ...extra});
const slides = [
  ['the issue: legend right, highlight', {chart: pie({legend: 'right', highlight: {categories: ['EMEA']}})}],
  ['no options (value list)', {chart: pie()}],
  ['legend right', {chart: pie({legend: 'right'})}],
  ['legend left', {chart: pie({legend: 'left'})}],
  ['legend top', {chart: pie({legend: 'top'})}],
  ['legend bottom, highlight', {chart: pie({legend: 'bottom', highlight: {categories: ['APAC']}})}],
  ['no legend', {chart: pie({legend: 'none'})}],
  ['highlight only', {chart: pie({highlight: {categories: ['AMER']}})}],
  ['labels outside', {chart: pie({dataLabels: {content: ['category', 'value'], position: 'outside-end'}})}],
  ['labels inside the end', {chart: pie({dataLabels: {content: ['percent'], position: 'inside-end'}})}],
  ['labels centered, highlight', {chart: pie({dataLabels: {content: ['value'], position: 'center'}, highlight: {categories: ['EMEA']}})}],
  ['labels on, formatted, legend bottom', {chart: pie({dataLabels: true, legend: 'bottom'}, {columns: ['Region', {name: 'Share', format: '0.0'}], rows: share.rows})}],
  ['one slice', {chart: pie({legend: 'right'}, {columns: ['Region', 'Share'], rows: [['EMEA', 100]]})}],
  ['two slices', {chart: pie({}, {columns: ['Region', 'Share'], rows: [['EMEA', 60], ['APAC', 40]]})}],
  ['a zero value', {chart: pie({legend: 'right'}, {columns: ['Region', 'Share'], rows: [['EMEA', 40], ['APAC', 0], ['AMER', 25], ['LATAM', 35]]})}],
  ['eight slices', {chart: pie({}, {columns: ['Office', 'Staff'], rows: [['Lisbon', 30], ['Austin', 22], ['Osaka', 14], ['Berlin', 11], ['Lagos', 8], ['Quito', 6], ['Perth', 5], ['Oslo', 4]]})}],
  ['doughnut', {chart: doughnut()}],
  ['doughnut, legend right, highlight', {chart: doughnut({legend: 'right', highlight: {categories: ['EMEA']}})}],
  ['doughnut, labels, legend bottom', {chart: doughnut({dataLabels: {content: ['percent']}, legend: 'bottom'})}],
  ['doughnut, no legend, a zero value', {chart: doughnut({legend: 'none'}, {columns: ['Region', 'Share'], rows: [['EMEA', 40], ['APAC', 0], ['AMER', 25]]})}],
  ['pie of two series (rings)', {chart: pie({}, {columns: ['Region', '2025', '2026'], rows: [['EMEA', 40, 38], ['APAC', 35, 37], ['AMER', 25, 25]]})}],
  ['beside a table', {blocks: [{chart: pie({legend: 'right'})}, {table: {columns: ['Region', 'Share', 'Change'], rows: [['EMEA', '40%', '+2'], ['APAC', '35%', '+1'], ['AMER', '25%', '-3']]}}]}],
  ['beside a table, no options', {blocks: [{chart: pie()}, {table: {columns: ['Region', 'Share'], rows: [['EMEA', '40%'], ['APAC', '35%'], ['AMER', '25%']]}}]}],
  ['beside text', {blocks: [{chart: pie({highlight: {categories: ['EMEA']}, legend: 'bottom'})}, {text: 'EMEA leads with 40 percent of the share, ahead of APAC and AMER.'}]}],
  ['under a heading', {composition: {mode: 'column'}, blocks: [{text: 'Share by region, 2026'}, {chart: pie({legend: 'right'})}]}],
  ['with a caption', {caption: 'Share by region, 2026', chart: pie({legend: 'right', highlight: {categories: ['EMEA']}})}],
  ['right to left, legend right, highlight', {language: rtl, chart: pie({legend: 'right', highlight: {categories: ['أوروبا']}}, arabic)}],
  ['right to left, labels', {language: rtl, chart: pie({dataLabels: {content: ['category', 'percent']}}, arabic)}],
  ['right to left, doughnut', {language: rtl, chart: doughnut({}, arabic)}],
  ['right to left, no options', {language: rtl, chart: pie({}, arabic)}],
];
const deck = {name: 'opf#1430', slides: slides.map(([title, slide]) => ({title, ...slide}))};
const entries = unzipSync(await toPptx(deck));
const text = name => entries[name] ? decoder.decode(entries[name]) : '';
const target = (from, rel) => new URL(rel, `file:///${from}`).pathname.slice(1);
const relsOf = name => [...text(name.replace(/([^/]+)$/, '_rels/$1.rels')).matchAll(/<Relationship\b[^>]*>/g)].map(([tag]) => ({id: /Id="([^"]+)"/.exec(tag)[1], type: /Type="([^"]+)"/.exec(tag)[1], target: target(name, /Target="([^"]+)"/.exec(tag)[1])}));
const relOfType = (name, type) => relsOf(name).find(rel => rel.type.endsWith(`/${type}`)).target;

// A color as the slide shows it: an sRGB literal, or a scheme color through the slide's color map and its theme.
function colorResolver(slide) {
  const master = relOfType(relOfType(slide, 'slideLayout'), 'slideMaster'), theme = relOfType(master, 'theme');
  const scheme = Object.fromEntries([...text(theme).matchAll(/<a:(dk1|lt1|dk2|lt2|accent\d)>\s*<a:(?:srgbClr val="(\w{6})"|sysClr[^>]*lastClr="(\w{6})")/g)].map(([, key, a, b]) => [key, (a ?? b).toUpperCase()]));
  const mapOf = tag => Object.fromEntries([...(tag ?? '').matchAll(/\b(bg1|tx1|bg2|tx2)="(\w+)"/g)].map(([, key, value]) => [key, value]));
  const map = {...mapOf(/<p:clrMap\b[^>]*>/.exec(text(master))?.[0]), ...mapOf(/<a:overrideClrMapping\b[^>]*>/.exec(text(slide))?.[0])};
  return xml => {
    const srgb = /^<a:srgbClr val="(\w{6})"\s*\/>$/.exec(xml.trim());
    if (srgb) return srgb[1].toUpperCase();
    const named = /^<a:schemeClr val="(\w+)"\s*(?:\/>|><\/a:schemeClr>)$/.exec(xml.trim());
    return named ? scheme[map[named[1]] ?? named[1]] : `unresolved ${xml.trim()}`;
  };
}

// The preview's pie: its center, outer radius and slice outlines (a pie slice starts at the center; the first drawn slice of the outer
// ring starts at 12 o'clock; a whole slice is a circle, or two arcs from the left end of the ring).
function previewPie(svg) {
  const marks = [...svg.matchAll(/<(path|circle)\b([^>]*)>/g)].map(([, tag, attributes]) => ({tag, ...Object.fromEntries([...attributes.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]))}))
    .filter(mark => mark.stroke && mark.fill && mark.fill !== 'none' && (mark.tag === 'circle' || / A /.test(mark.d ?? '')));
  const radii = mark => mark.tag === 'circle' ? [Number(mark.r)] : [...mark.d.matchAll(/A ([\d.]+)/g)].map(match => Number(match[1]));
  const r = Math.max(...marks.flatMap(radii));
  const start = mark => /^M ([\d.]+) ([\d.]+)/.exec(mark.d).slice(1).map(Number);
  const wedge = marks.find(mark => mark.tag === 'path' && /^M [\d.]+ [\d.]+ L/.test(mark.d)), circle = marks.find(mark => mark.tag === 'circle');
  const outer = marks.find(mark => mark.tag === 'path' && radii(mark)[0] === r);
  const [cx, cy] = wedge ? start(wedge) : circle ? [Number(circle.cx), Number(circle.cy)]
    : /Z M/.test(outer.d) ? [start(outer)[0] + r, start(outer)[1]] : [start(outer)[0], start(outer)[1] + r];
  return {cx, cy, r, outlines: new Set(marks.map(mark => `${mark.stroke.replace('#', '').toUpperCase()} ${Number(mark['stroke-width']).toFixed(2)}`))};
}

slides.forEach(([name], index) => {
  const slide = `ppt/slides/slide${index + 1}.xml`, slideXml = text(slide);
  const frame = /<p:graphicFrame>(?:(?!<\/p:graphicFrame>)[\s\S])*?<c:chart\b[^>]*r:id="([^"]+)"/.exec(slideXml);
  assert.ok(frame, `${name}: a chart frame`);
  const [x, y, width, height] = /<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(frame[0]).slice(1).map(value => Number(value) / EMU);
  const chart = text(relsOf(slide).find(rel => rel.id === frame[1]).target);
  const preview = previewPie(toSvg(deck, index + 1));
  // Every slice's outline is the preview's: its color (through the slide's color map) and its width.
  const resolve = colorResolver(slide);
  const points = [...chart.matchAll(/<c:dPt>([\s\S]*?)<\/c:dPt>/g)];
  assert.ok(points.length > 0, `${name}: the slices have their own formatting`);
  for (const [, point] of points) {
    const line = /<a:ln w="(\d+)"[^>]*>\s*<a:solidFill>([\s\S]*?)<\/a:solidFill>/.exec(point);
    assert.ok(line, `${name}: each slice has an outline`);
    const outline = `${resolve(line[2])} ${(Number(line[1]) / EMU).toFixed(2)}`;
    assert.ok(preview.outlines.has(outline), `${name}: slice outline ${outline}, the preview draws ${[...preview.outlines].join(' or ')}`);
  }
  // The plot area is the pie's square (layoutTarget inner), so the pie's center and diameter are the preview's.
  const layout = /<c:plotArea>\s*<c:layout>\s*<c:manualLayout>([\s\S]*?)<\/c:manualLayout>/.exec(chart)?.[1];
  assert.match(layout ?? '', /<c:layoutTarget val="inner"\/>/, `${name}: the plot area is the pie itself`);
  const at = key => Number(new RegExp(`<c:${key} val="([^"]+)"/>`).exec(layout)[1]);
  const plot = {x: x + at('x') * width, y: y + at('y') * height, w: at('w') * width, h: at('h') * height};
  const pptx = {cx: plot.x + plot.w / 2, cy: plot.y + plot.h / 2, r: Math.min(plot.w, plot.h) / 2};
  for (const key of ['cx', 'cy', 'r']) assert.ok(Math.abs(pptx[key] - preview[key]) < 1, `${name}: ${key} ${pptx[key].toFixed(2)} in PowerPoint, ${preview[key].toFixed(2)} in the preview`);
});
console.log(`Pie separators and squares: ${slides.length} pies and doughnuts have the preview's slice outlines and square.`);
