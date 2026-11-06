// LH-160 and LH-161 in the PPTX export: a native histogram writes core's bin count (cx:binCount), the bin edges' number format on its category
// axis (so PowerPoint keeps each bin label on one line) and no data labels that would overlap; a pie's last slice is written as the preview
// draws it (an sRGB literal moved off the first slice's lightness).
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {composeSlide, histogramBins, scottBinCount} from '@openpresentation/opf/composition';
import {gallery} from '@openpresentation/gallery';
import {toPptx} from '../dist/index.js';

const decoder = new TextDecoder();
const deckOf = (slide) => ({language: 'en', design: {fontScheme: 'roboto', colorScheme: 'forest-green', variant: 'light1'}, slides: [slide]});
async function exported(chart) {
  const entries = unzipSync(await toPptx(deckOf({title: 'Chart', chart})));
  return {chartex: entries['ppt/charts/chartEx1.xml'] ? decoder.decode(entries['ppt/charts/chartEx1.xml']) : undefined, chart: decoder.decode(entries['ppt/charts/chart1.xml'])};
}
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };

let seed = 5;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
const rows = Array.from({length: 30000}, () => [Math.round(20000 + 60000 * (rand() + rand() + rand() - 1.5))]);
const histogram = (extra = {}) => ({type: 'histogram', data: {columns: ['Salary'], rows}, ...extra});
const categoryFormat = (xml) => /<cx:axis id="0">[\s\S]*?<cx:tickLabels\/>(?:<cx:numFmt formatCode="([^"]*)" sourceLinked="0"\/>)?/.exec(xml)?.[1];

// 1. The bin count is core's, the category axis takes the edges' format, and the labels that cannot fit are not written.
{
  const layer = composeSlide({title: 'Chart', chart: histogram()}, {width: 1280, height: 720}).items.find((item) => item.field === 'chart').chart.layer.histogram;
  const scott = scottBinCount(rows.map((row) => row[0]));
  check(layer.bins < scott, `core caps the bins (${layer.bins} of ${scott})`);
  const {chartex} = await exported(histogram({dataLabels: {content: ['value']}}));
  check(chartex, 'a chartex part is written');
  check(new RegExp(`<cx:binCount val="${layer.bins}"/>`).test(chartex), `cx:binCount is core's ${layer.bins}`);
  check(categoryFormat(chartex) === (layer.decimals ? `0.${'0'.repeat(layer.decimals)}` : '0'), `the category axis format follows the bin width (${categoryFormat(chartex)})`);
  check(!chartex.includes('<cx:dataLabels'), 'data labels that would overlap are not written');
  const kept = await exported({type: 'histogram', dataLabels: {content: ['value']}, data: {columns: ['Minutes'], rows: Array.from({length: 60}, (_, index) => [20 + (index % 30)])}});
  check(kept.chartex.includes('<cx:dataLabels'), 'a few wide bars keep their counts');
  const classic = (await exported(histogram({dataLabels: {content: ['value']}}))).chart;
  check(!classic.includes('<c:dLbls>') || !/<c:showVal val="1"\/>/.test(classic), 'the classic fallback draws no overlapping labels either');
  check(histogramBins(rows.map((row) => row[0]), {count: layer.bins, decimals: layer.decimals}).length === layer.bins, 'the preview bins the same way');
}

// 2. A histogram over a category column has no bin axis format; a Pareto chart of a lone column follows the same bins.
{
  const hours = Array.from({length: 24}, (_, index) => [`${index}:00`, 40 + index]);
  const {chartex} = await exported({type: 'histogram', data: {columns: ['Hour', 'Tickets'], rows: hours}});
  check(categoryFormat(chartex) === undefined, 'no edge format on a category axis');
  const pareto = (await exported({type: 'pareto', data: {columns: ['Salary'], rows}})).chartex;
  check(/<cx:binCount val="\d+"\/>/.test(pareto) && categoryFormat(pareto) !== undefined, 'a binned Pareto chart takes the same bin count and edge format');
}

// 3. A pie's last slice: the preview's color as an sRGB literal, or every data point bordered 2 px (1.5 pt) in the surface color.
{
  const pie = async (scheme, count) => {
    const data = {columns: ['Segment', 'Revenue'], rows: Array.from({length: count}, (_, index) => [`S${index + 1}`, 50 - index * 3])};
    const entries = unzipSync(await toPptx({language: 'en', design: {colorScheme: scheme, variant: 'light1'}, slides: [{title: 'Chart', chart: {type: 'pie', data}}]}, {catalogs: [gallery]}));
    const xml = decoder.decode(entries['ppt/charts/chart1.xml']);
    return [...xml.matchAll(/<c:dPt>[\s\S]*?<\/c:dPt>/g)].map((point) => ({color: /<c:spPr><a:solidFill><a:(?:srgbClr|schemeClr) val="([^"]+)"/.exec(point[0])?.[1], line: /<a:ln w="(\d+)"[^>]*><a:solidFill><a:(?:srgbClr|schemeClr) val="([^"]+)"/.exec(point[0])}));
  };
  let bordered = 0, moved = 0;
  for (const scheme of ['forest-green', 'boost', 'golden-yellow', 'corporate-blue', 'deep-purple']) for (const count of [3, 4, 5, 6, 7, 8]) {
    const slices = await pie(scheme, count), longer = await pie(scheme, count + 1);
    check(slices.length === count, `a point per slice (${scheme}, ${count})`);
    check(slices.slice(0, count - 1).every((slice, index) => slice.color === longer[index].color), `only the last slice differs (${scheme}, ${count})`);
    const widths = new Set(slices.map((slice) => slice.line?.[1]));
    check(widths.size === 1, 'every point has the same border width');
    if (slices[0].line?.[1] === '19050') { bordered++; check(slices.every((slice) => slice.line[2] === 'FFFFFF' || slice.line[2] === 'bg1'), 'the border is the surface color (bg1)'); }
    if (slices[count - 1].color !== longer[count - 1].color) { moved++; check(/^[0-9A-F]{6}$/.test(slices[count - 1].color), 'a moved slice is an sRGB literal'); }
  }
  check(bordered > 0 && moved > 0, `both ways of separating the wrap pair occur (${bordered} bordered, ${moved} moved)`);
}

console.log(`lh-160-chart-labels pptx: ${checks} checks`);
