// LH-03 and LH-81: the chart layer in the PPTX export and import. Composition decides a chart's small-chart treatment and header row
// (core chart-layer.ts); this asserts the native parts the export writes for them, that the preview draws the same colours, and that
// fromPptx does not write the defaults back as options.
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {chartEmphasisColors, composeSlide} from '@openpresentation/opf/composition';
import {toSvg} from '@openpresentation/opf-render';
import {toPptx, fromPptx} from '../dist/index.js';

const decoder = new TextDecoder();
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: ''});
const two = {columns: ['Quarter', 'Current', 'Baseline'], rows: [['Q1', 28, 25], ['Q2', 32, 27], ['Q3', 35, 29], ['Q4', 39, 31]]};
const one = {columns: ['Stage', 'Count'], rows: [['Lead', 120], ['Qualified', 64], ['Proposal', 31], ['Won', 12]]};
const deckOf = (chart, design = {}) => ({design: {fontScheme: 'roboto', ...design}, slides: [{title: 'Chart', chart}]});
// A light deck (LH-95: the emphasis is a darker shade here, a lighter one on the default navy).
const LIGHT = {colorScheme: 'cool-horizon', variant: 'light1'};
const attrs = text => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
let checks = 0;

async function exported(chart, design) {
  const bytes = await toPptx(deckOf(chart, design));
  const entries = unzipSync(bytes);
  const xml = decoder.decode(entries['ppt/charts/chart1.xml']), slide = decoder.decode(entries['ppt/slides/slide1.xml']);
  assert.doesNotThrow(() => parser.parse(xml), 'the chart part is well-formed');
  const imported = (await fromPptx(bytes)).slides[0];
  return {xml, slide, imported: imported.chart ?? imported.blocks?.find(block => block.chart)?.chart};
}
const valueAxisDeleted = xml => /<c:valAx>(?:(?!<\/c:valAx>)[\s\S])*<c:delete val="1"\/>/.test(xml);
const shownValues = xml => [...xml.matchAll(/<c:showVal val="1"\/>/g)].length;

// 1. A small chart: value labels, no value axis, no gridlines, no chart area fill; the defaults import as no option.
{
  const {xml, imported} = await exported({type: 'column', data: two});
  assert.ok(valueAxisDeleted(xml), 'the value axis is deleted');
  assert.doesNotMatch(xml, /<c:majorGridlines/, 'no gridlines');
  assert.match(xml, /<\/c:chart>\s*<c:spPr>\s*<a:noFill\/>/, 'the chart area has no fill');
  assert.ok(shownValues(xml) > 0, 'the values are labelled');
  assert.match(xml, /<c:dLblPos val="outEnd"\/>/, 'outside the end of each column');
  assert.equal(imported.dataLabels, undefined, 'the default labels are not written back');
  assert.equal(imported.legend, undefined, 'the header legend is not written back');
  checks += 7;
}

// 2. Explicit options win: dataLabels false keeps the axis, gridlines and panel; a value axis title keeps the axis.
{
  const off = await exported({type: 'column', data: two, dataLabels: false});
  assert.ok(!valueAxisDeleted(off.xml) && /<c:majorGridlines/.test(off.xml), 'dataLabels false keeps the value axis');
  assert.equal(shownValues(off.xml), 0);
  assert.match(off.xml, /<\/c:chart>\s*<c:spPr>\s*<a:solidFill>/, 'and the panel');
  const titled = await exported({type: 'column', data: two, axisTitles: {value: 'Signal'}});
  assert.ok(!valueAxisDeleted(titled.xml) && shownValues(titled.xml) > 0, 'a value axis title keeps the axis; the labels stay');
  assert.deepEqual(titled.imported.axisTitles, {value: 'Signal'});
  checks += 5;
}

// 3. LH-95: the emphasis of a one-series bar chart: the series keeps its colour, the last point is one c:dPt in core's stronger shade of it,
// and the preview draws the same two colours. On the default navy, where LH-03's faded tint found no room, the shade is lighter.
for (const [design, label] of [[LIGHT, 'light'], [undefined, 'navy']]) {
  const {xml} = await exported({type: 'bar', data: one}, design);
  const ser = xml.match(/<c:ser>[\s\S]*?<\/c:ser>/)[0];
  const points = [...ser.matchAll(/<c:dPt><c:idx val="(\d+)"\/>[\s\S]*?<a:srgbClr val="(\w{6})"\/>[\s\S]*?<\/c:dPt>/g)].map(([, idx, hex]) => [Number(idx), hex]);
  assert.deepEqual(points.map(([idx]) => idx), [3], `${label}: one c:dPt, the emphasised point`);
  const svg = toSvg(deckOf({type: 'bar', data: one}, design), 1, {trace: true});
  const fills = [...svg.matchAll(/<rect\b([^>]*)\/>/g)].map(([, a]) => attrs(a)).filter(a => /^slides\.0\.chart\.data\.rows\.\d\.1$/.test(a['data-opf-path'] ?? '')).map(a => a.fill.toUpperCase());
  assert.equal(fills.length, 4);
  assert.equal(fills[3], `#${points[0][1]}`, `${label}: the preview shades the same point with the same colour`);
  assert.equal(new Set(fills.slice(0, 3)).size, 1, `${label}: the other bars keep one colour`);
  // The shade is core's for the series colour on the slide background.
  const background = svg.match(/<rect\b[^>]*data-opf-path="slides\.0"[^>]*fill="(#[0-9A-Fa-f]{6})"/)?.[1] ?? svg.match(/<rect\b[^>]*fill="(#[0-9A-Fa-f]{6})"/)[1];
  const {accent, muted} = chartEmphasisColors(background, fills[0]);
  assert.equal(muted.toUpperCase(), fills[0]);
  assert.equal(accent.toUpperCase(), fills[3]);
  checks += 5;
}

// 4. The header row: the caption is the chart title at core's position, the legend sits at the top at core's position, and the plot
// area takes the chart below them; the chart frame carries no alt title.
{
  // Two series: the caption comes from the value axis title (the legend names the series); its category is in sentence case.
  const {xml, slide} = await exported({type: 'line', data: two, axisTitles: {value: 'Signal'}});
  const title = xml.match(/<c:chart>\s*<c:title>[\s\S]*?<\/c:title>/)?.[0];
  assert.ok(title, 'a chart title');
  assert.match(title, /<a:t>Signal by quarter<\/a:t>/);
  assert.match(title, /b="1"/, 'bold');
  assert.match(title, /<c:manualLayout><c:xMode val="edge"\/><c:yMode val="edge"\/><c:x val="[\d.]+"\/><c:y val="[\d.]+"\/><\/c:manualLayout>/);
  assert.match(xml, /<c:legend><c:legendPos val="t"\/><c:layout><c:manualLayout><c:xMode val="edge"\/><c:yMode val="edge"\/><c:x val="[\d.]+"\/><c:y val="[\d.]+"\/><c:w val="[\d.]+"\/><c:h val="[\d.]+"\/><\/c:manualLayout><\/c:layout><c:overlay val="0"\/>/);
  assert.match(xml, /<c:plotArea><c:layout><c:manualLayout><c:layoutTarget val="outer"\/>/);
  assert.doesNotMatch(slide.match(/<p:cNvPr\b[^>]*name="OPF chart 1"[^>]*>/)[0], /\btitle=/, 'no alt title on the frame');
  // The caption's position is core's: the composed caption box over the composed chart box.
  const item = composeSlide(deckOf({type: 'line', data: two, axisTitles: {value: 'Signal'}}).slides[0], {dimensions: {width: 1280, height: 720}, fontFamilies: {body: 'Roboto', heading: 'Roboto'}}).items.find(entry => entry.field === 'chart');
  const x = Number(title.match(/<c:x val="([\d.]+)"\/>/)[1]);
  assert.ok(Math.abs(x - (item.chart.layer.header.caption.box.x - item.box.x) / item.box.width) < 0.01, 'the caption sits where core put it');
  checks += 8;
}

// 5. A legend option keeps that legend and draws no header row; a stacked chart has a header but no small-chart treatment.
{
  const right = await exported({type: 'column', data: two, legend: 'right'});
  assert.doesNotMatch(right.xml, /<c:chart>\s*<c:title>/, 'no caption');
  assert.match(right.xml, /<c:legendPos val="r"\/>/);
  assert.doesNotMatch(right.xml, /<c:legend>[\s\S]*?<c:manualLayout>[\s\S]*?<\/c:legend>/);
  assert.equal(right.imported.legend, 'right', 'a right legend is not the default of a two-series column chart: it imports as an option');
  const stacked = await exported({type: 'stacked-column', data: two});
  assert.doesNotMatch(stacked.xml, /<c:chart>\s*<c:title>/, 'two series and no value axis title: no generated caption');
  assert.match(stacked.xml, /<c:legend><c:legendPos val="t"\/><c:layout><c:manualLayout>/, 'the header legend');
  assert.ok(!valueAxisDeleted(stacked.xml) && shownValues(stacked.xml) === 0, 'a stacked chart keeps its value axis and draws no labels');
  checks += 7;
}

console.log(`Chart layer export passed: ${checks} checks (small charts, explicit options, emphasis parity, header row, legend option).`);
