// LH-113, LH-115: shared emphasis and row alignment in the PPTX export and import. Composition decides them (core chart-focus.ts,
// chart-rows.ts); this asserts the native parts the export writes, their parity with the preview, and what import restores.
import assert from 'node:assert/strict';
import {unzipSync, zipSync} from 'fflate';
import {toSvg} from '@openpresentation/opf-render';
import {toPptx, fromPptx} from '../dist/index.js';

const decoder = new TextDecoder(), encoder = new TextEncoder();
const deckOf = (slide) => ({design: {fontScheme: 'roboto'}, slides: [slide]});
const attrs = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const pricing = {columns: ['Region', 'Our price', 'Change'], rows: [['Northeast', '$42', 'Hold'], ['Southeast', '$38', '+3%'], ['Southwest', '$36', '+3%']]};
const tableOf = (document) => document.slides[0].table ?? document.slides[0].blocks?.find((block) => block.table)?.table;
// The fill of each native table row's first cell, as the srgb literal or scheme name it writes.
const rowFills = (xml) => [...xml.matchAll(/<a:tr\b[\s\S]*?<\/a:tr>/g)].map(([row]) => { const cell = row.match(/<a:tcPr\b[\s\S]*?<\/a:tcPr>/)[0]; const fill = cell.match(/<\/a:lnB>\s*<a:solidFill>\s*<a:(srgbClr|schemeClr) val="(\w+)"/); return fill ? fill[2] : undefined; });
let checks = 0;

// 1. An authored highlight: the tint as the cells' fill, the preview's color; import restores the list, also after a native edit elsewhere.
{
  const document = deckOf({title: 'Regional pricing review', blocks: [{table: {...pricing, highlight: {rows: ['Southwest']}}}]});
  const bytes = await toPptx(document), entries = unzipSync(bytes), xml = decoder.decode(entries['ppt/slides/slide1.xml']);
  const svg = toSvg(document, 1, {trace: true});
  const preview = attrs(svg.match(/<rect\b([^>]*data-opf-path="slides\.0\.blocks\.0\.table\.rows\.2\.0"[^>]*)>/)[1]).fill.replace('#', '').toUpperCase();
  const fills = rowFills(xml);
  assert.equal(fills[3], preview, 'the preview tint');
  assert.notEqual(fills[2], preview, 'a plain row keeps the surface');
  assert.equal(fills.filter((fill) => fill === preview).length, 1);
  assert.deepEqual(tableOf(await fromPptx(bytes)).highlight, {rows: ['Southwest']}, 'import restores the list');
  // Edit one native cell of another row: the table restores cell by cell and keeps the highlight while its row keeps its key.
  const edited = {...entries, 'ppt/slides/slide1.xml': encoder.encode(xml.replace('<a:t>Hold</a:t>', '<a:t>Freeze</a:t>'))};
  const partial = tableOf(await fromPptx(zipSync(edited)));
  assert.match(JSON.stringify(partial.rows[0][2]), /Freeze/, 'the native edit is kept');
  assert.deepEqual(partial.highlight, {rows: ['Southwest']}, 'kept through a partial restore');
  checks += 5;
}

// 2. A highlight from the slide's text, and the tint core computes from the deck's roles.
{
  const document = deckOf({title: 'Regional pricing review', blocks: [{text: 'Prices rise 3% in the two regions where we trail competitors.'}, {table: pricing}]});
  const bytes = await toPptx(document), xml = decoder.decode(unzipSync(bytes)['ppt/slides/slide1.xml']);
  const fills = rowFills(xml);
  assert.equal(fills[2], fills[3]);
  assert.match(fills[2], /^[0-9A-F]{6}$/, 'a literal tint');
  assert.notEqual(fills[1], fills[2]);
  assert.equal(tableOf(await fromPptx(bytes)).highlight, undefined, 'a derived highlight is not written back');
  checks += 3;
}

// 3. Bars beside a table of the same keys: the plot area is the table's body rows (an inner manual layout).
{
  const warranty = {columns: ['Product line', 'Claims per 1,000', 'Main cause'], rows: [['Controllers', 24, 'Firmware faults'], ['Pumps', 18, 'Seal wear'], ['Valves', 11, 'Corrosion'], ['Sensors', 7, 'Calibration drift']]};
  const bars = {type: 'bar', data: {columns: ['Product line', 'Cost ($K)'], rows: [['Controllers', 7.4], ['Pumps', 3.3], ['Valves', 1.3], ['Sensors', 0.7]]}};
  const document = deckOf({title: 'Warranty claims by product line', blocks: [{chart: bars}, {table: warranty}]});
  const entries = unzipSync(await toPptx(document)), chart = decoder.decode(entries['ppt/charts/chart1.xml']), slide = decoder.decode(entries['ppt/slides/slide1.xml']);
  const layout = chart.match(/<c:plotArea>\s*<c:layout><c:manualLayout><c:layoutTarget val="inner"\/><c:xMode val="edge"\/><c:yMode val="edge"\/><c:x val="([\d.]+)"\/><c:y val="([\d.]+)"\/><c:w val="([\d.]+)"\/><c:h val="([\d.]+)"\/>/);
  assert.ok(layout, 'an inner plot layout');
  const frame = (name) => { const shape = slide.match(new RegExp(`<p:graphicFrame>(?:(?!</p:graphicFrame>)[\\s\\S])*?name="${name}"[\\s\\S]*?</p:graphicFrame>`))[0]; const off = attrs(shape.match(/<a:off\b[^>]*>/)[0]), ext = attrs(shape.match(/<a:ext\b[^>]*>/)[0]); return {y: Number(off.y), h: Number(ext.cy), shape}; };
  const chartFrame = frame('OPF chart 1'), tableFrame = frame('OPF table 1');
  const heights = [...tableFrame.shape.matchAll(/<a:tr h="(\d+)"/g)].map(([, h]) => Number(h));
  const top = tableFrame.y + heights[0], bottom = tableFrame.y + heights.reduce((sum, h) => sum + h, 0);
  const plotTop = chartFrame.y + Number(layout[2]) * chartFrame.h, plotBottom = plotTop + Number(layout[4]) * chartFrame.h;
  assert.ok(Math.abs(plotTop - top) < 9525 * 1.5 && Math.abs(plotBottom - bottom) < 9525 * 1.5, `plot ${plotTop}-${plotBottom}, rows ${top}-${bottom}`);
  checks += 2;
}

console.log(`lh-113-shared-emphasis: ${checks} checks passed`);
