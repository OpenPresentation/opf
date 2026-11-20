// LH-182 optioned hole: every explicit legend position retains the authored options while the surface ellipse and native plot agree.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {toPptx, fromPptx} from '../dist/index.js';
import {toSvg} from '@openpresentation/opf-render/svg';
const quarters = {columns: ['Quarter', 'Current', 'Baseline'], rows: [['Q1', 13, 10], ['Q2', 17, 12], ['Q3', 20, 14], ['Q4', 24, 16]]};
const legends = [undefined, 'none', 'left', 'right', 'top', 'bottom'], slides = [];
for (const series of [1, 2]) for (const legend of legends) {
  const data = series === 1 ? {columns: quarters.columns.slice(0, 2), rows: quarters.rows.map(row => row.slice(0, 2))} : quarters;
  slides.push({title: 'Signal Trend', chart: {type: 'doughnut', data, ...(legend ? {legend} : {}), dataLabels: {content: ['percent']}}});
}
const deck = {design: {background: '#F8FAFC'}, slides};
const bytes = new Uint8Array(await toPptx(deck)), parts = unzipSync(bytes), back = await fromPptx(bytes), previews = toSvg(deck);
const px = value => Number(value) / 9525;
for (const [index, source] of slides.entries()) {
  const circles = [...previews[index].matchAll(/<circle\b[^>]*\/>/g)].map(match => match[0]);
  assert.equal(circles.filter(circle => circle.includes('fill="#F8FAFC"')).length, 1, 'preview fills the surface hole');
  const xml = strFromU8(parts[`ppt/slides/slide${index + 1}.xml`]), chart = strFromU8(parts[`ppt/charts/chart${index + 1}.xml`]);
  const shapes = [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape]) => shape), holes = shapes.filter(shape => /name="[^"]+ hole"/.test(shape));
  assert.equal(holes.length, 1, `${index}: exactly one opaque hole`);
  assert.match(holes[0], /<a:prstGeom prst="ellipse">/);
  assert.match(holes[0], /<a:srgbClr val="F8FAFC"\/>/);
  const [hx, hy, hw, hh] = /<a:off x="(\d+)" y="(\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(holes[0]).slice(1).map(px);
  const [x, y, w, h] = /name="OPF chart \d+"[\s\S]*?<a:off x="(\d+)" y="(\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(xml).slice(1).map(px);
  const plot = /<c:plotArea><c:layout><c:manualLayout><c:layoutTarget val="inner"\/><c:xMode val="edge"\/><c:yMode val="edge"\/><c:x val="([\d.]+)"\/><c:y val="([\d.]+)"\/><c:w val="([\d.]+)"\/><c:h val="([\d.]+)"\/>/.exec(chart);
  assert.ok(plot, 'native plot is pinned');
  const [fx, fy, fw, fh] = plot.slice(1).map(Number), diameter = fw * w;
  assert.ok(Math.abs(diameter - fh * h) < .2 && Math.abs(hw - hh) < .001, 'square native plot and circular hole');
  assert.ok(Math.abs(hw - diameter / 2) < .2, 'hole diameter is half of plot');
  assert.ok(Math.abs(hx + hw / 2 - (x + fx * w + diameter / 2)) < .2 && Math.abs(hy + hh / 2 - (y + fy * h + fh * h / 2)) < .2, 'hole centered on native plot');
  assert.ok(xml.indexOf(' hole"') < /name="OPF chart \d+"/.exec(xml).index, 'hole under chart frame');
  assert.match(chart, /<c:holeSize val="50"\/>/);
  const imported = back.slides[index].chart;
  assert.deepEqual(imported.data.rows, source.chart.data.rows);
  assert.equal(imported.legend ?? 'right', source.chart.legend ?? 'right', 'legend choice survives');
  assert.deepEqual(imported.dataLabels?.content, ['percent'], 'the surface-only hole tag must not suppress authored labels on import');
  assert.ok(!JSON.stringify(back.slides[index]).includes('ellipse'), 'generated hole is consumed');
}
console.log('LH-182: 12 optioned native plots/holes agree, and legend/percentage label choices survive current-content import.');
