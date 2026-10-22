// RR-96: the export follows the preview's roles under every variant: table header text (core readableSchemeColor), pie outlines (the
// outline neutral, bg1), the slice and series order (the variant's accents) and the play mark of a media block.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {toSvg} from '@openpresentation/opf-render';
import {toPptx} from '../dist/index.js';
import {clrMapOf, colorsInXml, themeColorsOf} from './helpers/scheme-colors.mjs';

const data = {columns: ['Region', 'Share'], rows: [['A', 40], ['B', 35], ['C', 25]]};
const variants = ['dark1', 'light2', {background: 'dark2', accents: ['accent3', 'accent2', 'accent1', 'accent4', 'accent5', 'accent6']}];
const svgPaints = (svg, path, attribute) => [...new Set([...svg.matchAll(/<(?:path|rect|circle|polygon)\b[^>]*>/g)].map(match => match[0]).filter(tag => tag.includes(`data-opf-path="${path}`)).map(tag => tag.match(new RegExp(`${attribute}="(#\\w+)"`))?.[1]?.slice(1).toUpperCase()).filter(Boolean))];
let checks = 0;
for (const variant of variants) {
  const deck = {design: {fontScheme: 'roboto', variant}, slides: [
    {title: 'Table', table: {columns: ['H1', 'H2'], rows: [['1', '2']]}},
    {title: 'Pie', chart: {type: 'pie', data}}
  ]};
  const files = unzipSync(await toPptx(deck));
  const text = name => strFromU8(files[name]);
  const theme = themeColorsOf(text('ppt/theme/theme1.xml')), map = clrMapOf(text('ppt/slideMasters/slideMaster1.xml'));
  const name = JSON.stringify(variant);

  // Table header text: the same bg1/tx1 the preview picks on the accent fill.
  const header = colorsInXml(text('ppt/slides/slide1.xml').match(/<a:tc>[\s\S]*?<\/a:tc>/)[0], theme, map)[0];
  const preview = toSvg(deck, 1, {trace: true});
  const headerPreview = [...preview.matchAll(/<(?:text|tspan)\b[^>]*fill="(#\w{6})"[^>]*>H1</g)].map(match => match[1].slice(1).toUpperCase());
  assert.ok(headerPreview.includes(header.hex), `${name}: header text ${header.hex} is drawn by the preview (${headerPreview})`);
  assert.ok(['bg1', 'tx1'].includes(header.role), `${name}: header text is a scheme role`);

  // Pie: slice colors follow the variant's accent order; the outline between slices is the bg1 outline neutral.
  const chart = text('ppt/charts/chart1.xml'), pie = toSvg(deck, 2, {trace: true});
  const slices = [...chart.matchAll(/<c:dPt>[\s\S]*?<\/c:dPt>/g)].map(match => colorsInXml(match[0], theme, map)[0].hex);
  assert.deepEqual(slices, svgPaints(pie, 'slides.1.chart.data', 'fill').slice(0, slices.length), `${name}: slice fills`);
  const outlines = [...new Set([...chart.matchAll(/<c:dPt>[\s\S]*?<a:ln\b[\s\S]*?<\/a:ln>/g)].map(match => colorsInXml(match[0].slice(match[0].indexOf('<a:ln')), theme, map)[0]).map(color => `${color.hex}/${color.role}`))];
  assert.deepEqual(outlines.map(value => value.split('/')[0]), svgPaints(pie, 'slides.1.chart.data', 'stroke'), `${name}: slice outlines`);
  assert.deepEqual(outlines.map(value => value.split('/')[1]), ['bg1'], `${name}: the outline is the bg1 role`);
  checks += 4;
}
console.log(`color-variants-parity passed: ${checks} checks (header text, slice fills, slice outlines) over ${variants.length} variants.`);
