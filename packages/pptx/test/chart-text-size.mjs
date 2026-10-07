// FF-62: chart text is written at the size the preview draws it, per text role (axis, data labels, legend), not 9 pt on the axes and the
// PowerPoint default on the legend. The preview draws all chart text at max(14, composition.minFontSize ?? 16) px scaled by the slide's
// shorter side over 720 px (renderer charts.js, `fontPx`): the test renders the real preview, reads each chart text line's size and role
// from its trace path, and requires the exported classic and chartex parts to name that size for the same role, in every part that carries text.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {renderSvgDeck} from '@openpresentation/opf-render';
import {strFromU8, unzipSync} from 'fflate';
import {toPptx} from '../dist/index.js';

const data = {columns: ['Region', 'Alpha', 'Beta'], rows: [['North', 10, 20], ['South', 30, 15], ['East', 5, 25], ['West', 40, 10]]};
const types = ['column', 'stacked-column', '100pct-stacked-column', 'bar', 'stacked-bar', 'line', 'line-with-markers', 'area', 'stacked-area', 'scatter',
  'radar', 'radar-with-markers', 'filled-radar', 'pie', 'doughnut', 'treemap', 'histogram', 'pareto', 'box-and-whisker', 'waterfall', 'funnel', 'world'];
// What each text row is, from its trace path and construct: renderer charts.js draws a series name as `data.columns.N`, a category or value as
// `data.rows.R.C`, and an axis tick on the chart's own path. A pie or doughnut draws its categories as the legend, a treemap its tiles as data labels.
const circular = new Set(['pie', 'doughnut']);
const roleOf = (path, type) => {
  const match = /\.data\.(columns|rows)\.(\d+)(?:\.(\d+))?$/.exec(path ?? '');
  if (!match) return 'axis';
  if (match[1] === 'columns') return 'legend';
  if (circular.has(type)) return 'legend';
  if (type === 'treemap') return 'dataLabels';
  return Number(match[3]) === 0 ? 'axis' : 'dataLabels';
};
const unique = (values) => [...new Set(values)].sort((a, b) => a - b);

// The size the preview draws per role, in points: the SVG is in slide pixels (96 per inch), 0.75 pt per pixel.
async function previewSizes(deck, type) {
  const rendered = await renderSvgDeck(deck, {trace: true});
  const svg = typeof rendered[0] === 'string' ? rendered[0] : rendered[0].svg;
  const roles = {axis: [], dataLabels: [], legend: []};
  for (const [, attributes] of svg.matchAll(/<text\b([^>]*)>/g)) {
    const path = attributes.match(/data-opf-path="([^"]*)"/)?.[1];
    if (!path?.includes('.chart')) continue;
    // Hundredths of a point, as the export writes them: core composes on the 0.01 pt grid, the preview prints the size in px to 0.001.
    roles[roleOf(path, type)].push(Math.round(Number(attributes.match(/font-size="([^"]*)"/)[1]) * 75) / 100);
  }
  return Object.fromEntries(Object.entries(roles).map(([role, sizes]) => [role, unique(sizes)]));
}

// The sizes the part names per role (every `sz` in the role's elements) and in all, in points.
const sizesIn = (xml) => [...xml.matchAll(/\bsz="(\d+)"/g)].map((match) => Number(match[1]) / 100);
function partRoles(xml, chartex) {
  const patterns = chartex
    ? {axis: /<cx:axis\b[^>]*>[\s\S]*?<\/cx:axis>/g, legend: /<cx:legend\b[^>]*>[\s\S]*?<\/cx:legend>/g, dataLabels: /<cx:dataLabels\b[^>]*>[\s\S]*?<\/cx:dataLabels>/g}
    : {axis: /<c:(?:catAx|valAx)\b[\s\S]*?<\/c:(?:catAx|valAx)>/g, legend: /<c:legend\b[\s\S]*?<\/c:legend>/g, dataLabels: /<c:dLbls\b[\s\S]*?<\/c:dLbls>/g};
  return Object.fromEntries(Object.entries(patterns).map(([role, pattern]) => {
    const blocks = xml.match(pattern) ?? [];
    return [role, {blocks: blocks.length, sizes: unique(blocks.flatMap(sizesIn)), explicit: blocks.every((block) => /\bsz="\d+"/.test(block))}];
  }));
}

const configs = [
  {name: 'default 13.33 x 7.5 in', design: {}, composition: undefined, expected: 12},
  {name: '1920 x 1080 px', design: {dimensions: {widthInches: 20, heightInches: 11.25}}, composition: undefined, expected: 18},
  {name: 'portrait 540 x 960 px', design: {dimensions: {widthInches: 5.625, heightInches: 10}}, composition: undefined, expected: 9},
  {name: 'minFontSize 20', design: {}, composition: {minFontSize: 20}, expected: 15},
  {name: 'minFontSize 10 (the 14 px floor)', design: {}, composition: {minFontSize: 10}, expected: 10.5},
  // RR-16: core composes font sizes on the 0.01 pt grid. The scale of an A4 slide (8.27 in * 96 / 720 = 1.10267) makes the 16 px floor 13.232 pt,
  // which rounds up to 13.24 pt (Math.round wrote 13.23 pt, 0.01 pt under the preview), and the 14 px request 11.578 pt, which rounds down to 11.57 pt.
  {name: 'A4 11.69 x 8.27 in (fractional scale)', design: {dimensions: {widthInches: 11.69, heightInches: 8.27}}, composition: undefined, expected: 13.24},
  {name: 'A4, minFontSize 10 (the 14 px request)', design: {dimensions: {widthInches: 11.69, heightInches: 8.27}}, composition: {minFontSize: 10}, expected: 11.57},
];

let checks = 0;
for (const config of configs) {
  for (const type of types) {
    const label = `${config.name}, ${type}`;
    const deck = {design: {fontScheme: 'roboto', ...config.design}, slides: [{layout: 'chart-1x', title: type, ...(config.composition ? {composition: config.composition} : {}), chart: {type, data}}]};
    const preview = await previewSizes(deck, type);
    const parts = unzipSync(await toPptx(structuredClone(deck)));
    const chartParts = Object.keys(parts).filter((name) => /^ppt\/charts\/(?:chart|chartEx|style)\d+\.xml$/.test(name));
    assert.ok(chartParts.some((name) => /chart\d+\.xml$/.test(name)), `${label}: a chart part`);

    for (const name of chartParts) {
      const xml = strFromU8(parts[name]);
      const chartex = /chartEx\d+\.xml$/.test(name);
      // The chart size is the preview's: every explicit size the chart parts name is the size the preview draws (axis, data label and legend
      // text alike), on the default slide and on every other slide size and minimum font size.
      const named = unique(sizesIn(xml.replace(/<cs:(?:axisTitle|title)\b[\s\S]*?<\/cs:(?:axisTitle|title)>/g, '')));
      assert.deepEqual(named, [config.expected], `${label}: every size in ${name} is ${config.expected} pt`);
      checks++;
      if (name.startsWith('ppt/charts/style')) continue;
      const roles = partRoles(xml, chartex);
      for (const role of ['axis', 'dataLabels', 'legend']) {
        if (!preview[role].length || !roles[role].blocks) continue;
        assert.ok(roles[role].explicit, `${label}: ${name} ${role} text names its size (it would inherit the PowerPoint default)`);
        assert.deepEqual(roles[role].sizes, preview[role], `${label}: ${name} ${role} size equals the preview's`);
        checks++;
      }
    }
  }
}

// Determinism: the size comes from the deck alone, so the same deck exports the same bytes.
{
  const deck = {design: {fontScheme: 'roboto'}, slides: types.map((type) => ({layout: 'chart-1x', title: type, composition: {minFontSize: 18}, chart: {type, data}}))};
  const digest = async () => createHash('sha256').update(await toPptx(structuredClone(deck))).digest('hex');
  assert.equal(await digest(), await digest(), 'two exports of one chart deck are byte-identical');
  checks++;
}

// The chart size follows the slide it is on: two slides with different minimum font sizes write different sizes.
{
  const deck = {design: {fontScheme: 'roboto'}, slides: [{layout: 'chart-1x', title: 'a', chart: {type: 'column', data}}, {layout: 'chart-1x', title: 'b', composition: {minFontSize: 24}, chart: {type: 'column', data}}]};
  const parts = unzipSync(await toPptx(deck));
  assert.deepEqual(unique(sizesIn(strFromU8(parts['ppt/charts/chart1.xml']))), [12]);
  assert.deepEqual(unique(sizesIn(strFromU8(parts['ppt/charts/chart2.xml']))), [18]);
  checks++;
}

console.log(`Chart text size passed: ${checks} checks; axis, data label and legend text at the preview's size for ${types.length} chart types on ${configs.length} slide and font-size settings, classic and chartex parts and the chartex style part.`);
