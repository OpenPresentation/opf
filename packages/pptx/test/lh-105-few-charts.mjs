// LH-105: chart defaults that follow Stephen Few, in the PPTX export and import. Composition decides them (core chart-focus.ts,
// chart-direct-labels.ts, softenChartPalette); this asserts the native parts the export writes, their parity with the preview, and that
// fromPptx does not write the defaults back as options.
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {applyHslTransforms} from '@openpresentation/opf/composition';
import {toSvg} from '@openpresentation/opf-render';
import {toPptx, fromPptx} from '../dist/index.js';
import {clrMapOf, colorsInXml, themeColorsOf} from './helpers/scheme-colors.mjs';

const decoder = new TextDecoder();
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: ''});
// A light deck: on the default navy the accents are lifted for contrast, so they are literals before any softening.
const deckOf = (slide, extra = {}) => ({design: {fontScheme: 'roboto', colorScheme: 'cool-horizon', variant: 'light1'}, ...extra, slides: [slide]});
async function exported(document) {
  const bytes = await toPptx(document), entries = unzipSync(bytes);
  const xml = decoder.decode(entries['ppt/charts/chart1.xml']);
  const imported = await fromPptx(bytes);
  const chart = imported.slides[0].chart ?? imported.slides[0].blocks?.find((block) => block.chart)?.chart;
  return {xml, entries, chart, theme: themeColorsOf(decoder.decode(entries['ppt/theme/theme1.xml'])), map: clrMapOf(decoder.decode(entries['ppt/slideMasters/slideMaster1.xml']))};
}
const attrs = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
let checks = 0;

// 1. No panel, no category tick marks, soft series written as the theme accent with core's HSL transforms (the preview's colour).
{
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
  const document = deckOf({title: 'Two regions', chart: {type: 'column', data: {columns: ['Month', 'North', 'South'], rows: months.map((month, i) => [month, 20 + i, 10 + i])}}});
  const {xml, theme, map, chart} = await exported(document);
  assert.match(xml, /<\/c:chart>\s*<c:spPr>\s*<a:noFill\/>/, 'the chart area is unfilled');
  assert.match(xml, /<c:catAx>(?:(?!<\/c:catAx>)[\s\S])*<c:majorTickMark val="none"\/>/, 'no category tick marks');
  const first = xml.match(/<c:ser>[\s\S]*?<c:spPr>\s*<a:solidFill>([\s\S]*?)<\/a:solidFill>/)[1];
  assert.match(first, /<a:schemeClr val="accent1"><a:satMod val="\d+"\/><a:lumMod val="\d+"\/><a:lumOff val="\d+"\/><\/a:schemeClr>/, 'a soft accent stays a theme colour');
  const [{hex}] = colorsInXml(first, theme, map);
  const svg = toSvg(document, 1, {trace: true});
  const preview = attrs(svg.match(/<rect\b([^>]*data-opf-path="slides\.0\.chart\.data\.rows\.0\.1"[^>]*)>/)[1]).fill.toUpperCase();
  assert.equal(`#${hex}`, preview, 'the preview draws the same soft colour');
  assert.equal(applyHslTransforms(`#${theme.accent1}`, {satMod: 75000, lumMod: 75000, lumOff: 25000}).toUpperCase(), preview);
  assert.equal(chart.legend, undefined);
  checks += 6;
}

// 2. Line ends: the last point's c:dLbl names the series with its value as text, bold for the series the title names; no legend; import
// writes no option back. Right to left the label sits at the left of the point.
{
  const quarters = ["Q1 '24", "Q2 '24", "Q3 '24", "Q4 '24", "Q1 '25", "Q2 '25", "Q3 '25", "Q4 '25"];
  const slide = {title: 'Enterprise satisfaction pulled ahead of mid-market', chart: {type: 'line', data: {columns: ['Quarter', 'Enterprise NPS', 'Mid-market NPS'], rows: quarters.map((q, i) => [q, 38 + i * 3, 40 + (i % 3)])}}};
  const {xml, chart, theme, map} = await exported(deckOf(slide));
  assert.doesNotMatch(xml, /<c:legend>/, 'no legend');
  const labels = [...xml.matchAll(/<c:dLbl><c:idx val="(\d+)"\/>([\s\S]*?)<\/c:dLbl>/g)].map(([, idx, body]) => ({idx: Number(idx), text: body.match(/<a:t>([^<]*)<\/a:t>/)?.[1], bold: /<a:rPr [^>]*b="1"/.test(body), position: body.match(/<c:dLblPos val="(\w+)"\/>/)?.[1], serName: /<c:showSerName val="1"\/>/.test(body)}));
  assert.deepEqual(labels, [{idx: 7, text: '59 Enterprise NPS', bold: true, position: 'r', serName: true}, {idx: 7, text: '41 Mid-market NPS', bold: false, position: 'r', serName: true}]);
  assert.equal(chart.legend, undefined, 'no legend option on import');
  assert.equal(chart.dataLabels, undefined, 'no data labels option on import');
  // The title names Enterprise: it keeps its colour, Mid-market takes the light context neutral (its line is labeled at its end), the
  // preview's gray; the export writes it as the tx1 neutral it equals.
  const midMarket = xml.match(/<c:ser>[\s\S]*?<\/c:ser>/g)[1].match(/<a:ln\b[^>]*>\s*<a:solidFill>([\s\S]*?)<\/a:solidFill>/)[1];
  const lineColor = colorsInXml(midMarket, theme, map)[0].hex;
  const preview = toSvg(deckOf(slide), 1, {trace: true}).match(/<polyline\b([^>]*data-opf-path="slides\.0\.chart\.data\.columns\.2"[^>]*)>/)[1];
  assert.equal(`#${lineColor}`, attrs(preview).stroke.toUpperCase(), 'the preview draws the same context gray');
  const rtl = await exported(deckOf(slide, {language: 'ar'}));
  assert.ok([...rtl.xml.matchAll(/<c:dLblPos val="(\w+)"\/>/g)].every(([, position]) => position === 'l'), 'right to left: before the point');
  checks += 5;
}

// 3. A pie names its slices (inside the end, or outside a small slice) with leader lines on and no legend; import writes nothing back.
{
  const {xml, chart} = await exported(deckOf({title: 'Budget', chart: {type: 'pie', data: {columns: ['Team', 'Budget'], rows: [['Engineering', 80], ['Sales', 17], ['Legal and compliance', 3]]}}}));
  assert.doesNotMatch(xml, /<c:legend>/, 'no legend');
  const points = [...xml.matchAll(/<c:dLbl><c:idx val="(\d+)"\/>([\s\S]*?)<\/c:dLbl>/g)].map(([, idx, body]) => [Number(idx), body.match(/<c:dLblPos val="(\w+)"\/>/)?.[1], /<c:showCatName val="1"\/>/.test(body)]);
  assert.deepEqual(points, [[0, 'inEnd', true], [1, 'inEnd', true], [2, 'outEnd', true]]);
  assert.match(xml, /<c:showLeaderLines val="1"\/>/);
  assert.equal(chart.legend, undefined);
  assert.equal(chart.dataLabels, undefined);
  // An explicit legend keeps the legend and no slice names.
  const explicit = await exported(deckOf({title: 'Budget', chart: {type: 'pie', legend: 'right', data: {columns: ['Team', 'Budget'], rows: [['A', 3], ['B', 2]]}}}));
  assert.match(explicit.xml, /<c:legend>/);
  assert.equal(explicit.chart.legend, undefined, 'right is the pie default it was before');
  checks += 6;
}

// 4. The title names a category: one c:dPt in the full-strength colour, the series in the context neutral, as the preview draws them.
{
  const document = deckOf({title: 'North America still leads on bookings', chart: {type: 'column', data: {columns: ['Region', 'Bookings'], rows: [['North America', 48.2], ['Europe', 31.5], ['Asia Pacific', 27.9], ['Latin America', 12.4], ['Middle East', 9.1], ['Africa', 6.3]]}}});
  const {xml, theme, map} = await exported(document);
  const ser = xml.match(/<c:ser>[\s\S]*?<\/c:ser>/)[0];
  const series = colorsInXml(ser.match(/<c:spPr>([\s\S]*?)<\/c:spPr>/)[1], theme, map)[0].hex;
  const point = [...ser.matchAll(/<c:dPt><c:idx val="(\d+)"\/>([\s\S]*?)<\/c:dPt>/g)].map(([, idx, body]) => [Number(idx), colorsInXml(body, theme, map)[0].hex]);
  assert.deepEqual(point.map(([idx]) => idx), [0]);
  const svg = toSvg(document, 1, {trace: true});
  const fill = (row) => attrs(svg.match(new RegExp(`<rect\\b([^>]*data-opf-path="slides\\.0\\.chart\\.data\\.rows\\.${row}\\.1"[^>]*)>`))[1]).fill.toUpperCase();
  assert.equal(`#${point[0][1]}`, fill(0), 'the focused bar');
  assert.equal(`#${series}`, fill(1), 'the context bars');
  checks += 3;
}

// 5. The title names a slice: it keeps its colour, the other slices take two distinct context grays, as the preview draws them.
{
  const document = deckOf({title: 'Enterprise accounts bring 62% of revenue', chart: {type: 'pie', data: {columns: ['Segment', 'Revenue'], rows: [['Enterprise', 62.4], ['Mid-market', 25.1], ['Small business', 12.5]]}}});
  const {xml, theme, map} = await exported(document);
  const fills = [...xml.matchAll(/<c:dPt>\s*<c:idx val="(\d+)"\/>([\s\S]*?)<\/c:dPt>/g)].map(([, , body]) => colorsInXml(body.match(/<c:spPr>([\s\S]*?)<\/c:spPr>/)[1], theme, map)[0].hex);
  const svg = toSvg(document, 1, {trace: true});
  const preview = [0, 1, 2].map(row => attrs(svg.match(new RegExp(`<path\\b([^>]*data-opf-path="slides\\.0\\.chart\\.data\\.rows\\.${row}\\.1"[^>]*)>`))[1]).fill.toUpperCase());
  assert.deepEqual(fills.map(hex => `#${hex}`), preview);
  assert.equal(new Set(preview).size, 3, 'the focused slice and two distinct context grays');
  checks += 2;
}

// 6. Every part parses.
{
  const {xml} = await exported(deckOf({title: 'T', chart: {type: 'line', data: {columns: ['Year', 'A', 'B'], rows: [['2022', 1, 2], ['2023', 3, 4], ['2024', 5, 7]]}}}));
  assert.doesNotThrow(() => parser.parse(xml));
  checks++;
}

console.log(`LH-105 export passed: ${checks} checks (no panel, soft theme accents, no category ticks, line-end labels, pie slice names, title focus, import).`);
