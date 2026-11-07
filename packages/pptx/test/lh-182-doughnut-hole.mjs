// LH-182: a doughnut's hole takes the surface in PowerPoint too: the plot area is pinned to core's square (inner manual layout) and an
// ellipse in the surface color lies under the chart frame at core's hole, above the watermark, tagged as a chart mark that import consumes.
import assert from 'node:assert/strict';
import {unzipSync, strFromU8} from 'fflate';
import {composeSlide} from '@openpresentation/opf/composition';
import {toPptx, fromPptx} from '../dist/index.js';

const quarters = {columns: ['Quarter', 'Current', 'Baseline'], rows: [['Q1', 13, 10], ['Q2', 17, 12], ['Q3', 20, 14], ['Q4', 24, 16]]};
const slide = {title: 'Signal Trend', chart: {type: 'doughnut', data: quarters}};
const deck = {design: {background: '#F8FAFC'}, slides: [slide]};
const bytes = await toPptx(deck);
const parts = unzipSync(bytes);
const xml = strFromU8(parts['ppt/slides/slide1.xml']);
const shapes = [...xml.matchAll(/<p:cNvPr id="\d+" name="([^"]+)"/g)].map(m => m[1]);
const holeIndex = shapes.findIndex(name => / hole$/.test(name)), chartIndex = shapes.findIndex(name => /^OPF chart \d+$/.test(name));
assert.ok(holeIndex >= 0, 'a hole shape');
assert.ok(holeIndex < chartIndex, 'under the chart frame');
const hole = new RegExp(String.raw`name="${shapes[holeIndex]}"[\s\S]*?<a:off x="(\d+)" y="(\d+)"/><a:ext cx="(\d+)" cy="(\d+)"/>[\s\S]*?<a:prstGeom prst="ellipse">[\s\S]*?<a:srgbClr val="([0-9A-F]{6})"`).exec(xml);
assert.ok(hole, 'an ellipse with a solid fill');
assert.equal(hole[5], 'F8FAFC', 'in the surface color');
const px = value => Number(value) / 9525;
const composed = composeSlide(slide, {width: 1280, height: 720}).items.find(item => item.field === 'chart').chart.layer.doughnut;
// The export works in slide pixels at its own canvas; compare the shape to core's hole relative to the chart frame.
const frame = /name="OPF chart \d+"[\s\S]*?<a:off x="(\d+)" y="(\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(xml).slice(1).map(px);
const chart = strFromU8(parts['ppt/charts/chart1.xml']);
const layout = /<c:plotArea><c:layout><c:manualLayout><c:layoutTarget val="inner"\/><c:xMode val="edge"\/><c:yMode val="edge"\/><c:x val="([\d.]+)"\/><c:y val="([\d.]+)"\/><c:w val="([\d.]+)"\/><c:h val="([\d.]+)"\/>/.exec(chart);
assert.ok(layout, 'the plot area is pinned (inner)');
const [fx, fy, fw, fh] = layout.slice(1).map(Number);
const plot = {x: frame[0] + fx * frame[2], y: frame[1] + fy * frame[3], w: fw * frame[2], h: fh * frame[3]};
assert.ok(Math.abs(plot.w - plot.h) < 1.5, `a square plot (${plot.w} x ${plot.h})`);
const [hx, hy, hw] = hole.slice(1, 4).map(px);
assert.ok(Math.abs(hw - plot.w / 2) < 1.5, 'the hole is half the doughnut diameter (c:holeSize 50)');
assert.ok(Math.abs(hx + hw / 2 - (plot.x + plot.w / 2)) < 1.5 && Math.abs(hy + hw / 2 - (plot.y + plot.h / 2)) < 1.5, 'centered on the plot');
assert.match(chart, /<c:holeSize val="50"\/>/);
assert.ok(composed, 'core composed the doughnut');
// Import consumes the hole: the slide comes back with its chart and nothing else.
const back = await fromPptx(bytes);
assert.deepEqual(back.slides[0].chart.data, quarters);
assert.equal(JSON.stringify(back.slides[0]).includes('ellipse'), false, 'no shape block for the hole');
console.log('LH-182: the doughnut hole is a surface-colored ellipse under a pinned plot, consumed on import.');
