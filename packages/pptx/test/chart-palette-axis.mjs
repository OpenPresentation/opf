// RR-89 / RR-92: native chart series follow the deck colour scheme and chart.colors (theme colours where they stay unadjusted), and the
// value axis core composed (min, max, major unit) is written to the chart part.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {composeSlide} from '@openpresentation/opf/composition';
import {toPptx} from '../dist/index.js';

const scheme = {id: 'test-scheme', accent1: '#7B241C', accent2: '#1B4F72', accent3: '#27AE60', accent4: '#8E44AD', accent5: '#F39C12', accent6: '#16A085', dark1: '#111827', dark2: '#334155', light1: '#FFFFFF', light2: '#F8FAFC'};
const wide = {columns: ['Quarter', ...Array.from({length: 8}, (_, i) => `S${i + 1}`)], rows: [['Q1', ...Array.from({length: 8}, (_, i) => 10 + i)], ['Q2', ...Array.from({length: 8}, (_, i) => 20 - i)]]};
const small = {columns: ['Quarter', 'A', 'B'], rows: [['Q1', 120, 480], ['Q2', 300, 760]]};
const light = {type: 'solid', color: '#FFFFFF'};
const deckOf = (chart, design = {colorScheme: scheme, background: light}) => ({name: 'Palette', language: 'en-US', design, slides: [{title: 'T', chart}]});
const chartXml = async (chart, design) => strFromU8(unzipSync(await toPptx(deckOf(chart, design)))['ppt/charts/chart1.xml']);
const themeXml = async (chart, design) => strFromU8(unzipSync(await toPptx(deckOf(chart, design)))['ppt/theme/theme1.xml']);
// The fill of each series: `accentN` for a theme colour, RRGGBB for sRGB.
const fills = (xml) => [...xml.matchAll(/<c:ser>[\s\S]*?<c:spPr>\s*<a:solidFill>\s*<a:(?:srgbClr|schemeClr) val="([0-9A-Za-z]+)"/g)].map((match) => match[1]);
const axis = (xml) => {
  const scaling = xml.match(/<c:valAx>[\s\S]*?<c:scaling>([\s\S]*?)<\/c:scaling>/)?.[1] ?? '';
  const number = (tag, source) => source.match(new RegExp(`<c:${tag} val="([^"]+)"`))?.[1];
  return {min: number('min', scaling), max: number('max', scaling), majorUnit: number('majorUnit', xml.match(/<c:valAx>[\s\S]*?<\/c:valAx>/)?.[0] ?? '')};
};
let checked = 0;

// 1. Series follow the deck colour scheme: accents are theme colours, tints are sRGB.
{
  const xml = await chartXml({type: 'column', data: wide});
  const found = fills(xml);
  assert.equal(found.length, 8);
  // On the light panel the accents with 3:1 contrast keep their colour and are theme colours; accent3 (#27AE60) and accent5 need a darker
  // shade there, which is sRGB.
  assert.deepEqual(found.slice(0, 6).map((fill) => (/^accent\d$/.test(fill) ? fill : 'srgb')), ['accent1', 'accent2', 'srgb', 'accent4', 'srgb', 'accent6']);
  for (const fill of found) assert.match(fill, /^(?:accent\d|[0-9A-F]{6})$/);
  assert.ok(!found.includes('2874A6'), 'the cool-horizon palette is gone');
  assert.ok(found.slice(6).every((fill) => /^[0-9A-F]{6}$/.test(fill)), 'tints are sRGB');
  // The theme holds the scheme's accents the schemeClr values refer to.
  const theme = await themeXml({type: 'column', data: wide});
  assert.match(theme, /<a:accent1><a:srgbClr val="7B241C"\/><\/a:accent1>/);
  checked++;
}

// 2. chart.colors: a scheme slot stays a theme colour, hex and variable colours are sRGB, positions past the list keep the deck palette.
{
  const xml = await chartXml({type: 'column', data: small, colors: ['accent4', '#336699']});
  const [first, second] = fills(xml);
  assert.equal(first, 'accent4', 'a chart.colors scheme slot is a theme colour');
  assert.equal(fills(await chartXml({type: 'column', data: small}))[0], 'accent1', 'without chart.colors series 1 is accent1');
  assert.match(second, /^[0-9A-F]{6}$/, 'a hex colour is sRGB');
  assert.ok(Math.abs(Number.parseInt(second.slice(0, 2), 16) - 0x33) <= 0x40, 'close to the authored hue (contrast adjustment only)');
  const plain = fills(await chartXml({type: 'column', data: wide}));
  const third = fills(await chartXml({type: 'column', data: wide, colors: ['accent4', '#336699']}));
  // A colour the panel adjusts is placed around the other series, so only the unadjusted theme colours are compared.
  plain.forEach((fill, index) => { if (index >= 2 && /^accent\d$/.test(fill)) assert.equal(third[index], fill, `series ${index + 1} keeps the deck palette`); });
  assert.equal(third.length, plain.length);
  const variable = await chartXml({type: 'column', data: small, colors: ['var:brand']}, {colorScheme: scheme, background: light});
  // RR-96: the position's colour is the deck's accent1, which the finished part writes as the theme colour (the entry itself is not a scheme name).
  assert.equal(fills(variable)[0], 'accent1', 'an unresolvable variable keeps the palette colour of its position (accent1, the deck colour)');
  assert.match(await themeXml({type: 'column', data: small, colors: ['var:brand']}, {colorScheme: scheme, background: light}), /<a:accent1><a:srgbClr val="7B241C"\/>/, 'accent1 of the theme is that colour');
  checked += 3;
}

// 3. A slide with its own colour scheme is pinned to literal colours; a colour the panel adjusts is sRGB.
{
  const document = {name: 'Pinned', language: 'en-US', slides: [{title: 'T', design: {colorScheme: scheme, background: light}, chart: {type: 'column', data: small}}]};
  const xml = strFromU8(unzipSync(await toPptx(document))['ppt/charts/chart1.xml']);
  assert.ok(fills(xml).every((fill) => /^[0-9A-F]{6}$/.test(fill)), `slide-scoped schemes stay sRGB: ${fills(xml)}`);
  const dark = await chartXml({type: 'column', data: small}, {colorScheme: {...scheme, id: 'dark-test', dark2: '#1B1B1B', light2: '#1B1B1B', light1: '#FFFFFF', dark1: '#FFFFFF'}, background: {type: 'solid', color: '#000000'}});
  assert.ok(fills(dark).some((fill) => /^[0-9A-F]{6}$/.test(fill)), 'a colour lightened for a dark panel is sRGB');
  checked += 2;
}

// 4. The value axis core composed is written: bounds and major unit.
{
  const composed = composeSlide(deckOf({type: 'column', data: small}).slides[0], {width: 1280, height: 720, presentation: deckOf({type: 'column', data: small}), slideIndex: 0});
  const expected = composed.items.find((item) => item.field === 'chart').chart.valueAxis;
  assert.ok(expected, 'composition exposes the value axis');
  const found = axis(await chartXml({type: 'column', data: small}));
  assert.deepEqual(found, {min: String(expected.min), max: String(expected.max), majorUnit: String(expected.majorUnit)});
  assert.deepEqual(found, {min: '0', max: '800', majorUnit: '100'});
  checked += 2;
}

// 5. The axis of each category type, and none for the others.
{
  assert.deepEqual(axis(await chartXml({type: 'line', data: {columns: ['Q', 'A'], rows: [['Q1', 980], ['Q2', 1000]]}})), {min: '975', max: '1005', majorUnit: '5'});
  assert.deepEqual(axis(await chartXml({type: 'stacked-column', data: {columns: ['Q', 'A', 'B'], rows: [['Q1', 100, 300], ['Q2', 200, 150]]}})), {min: '0', max: '450', majorUnit: '50'});
  assert.deepEqual(axis(await chartXml({type: '100pct-stacked-column', data: small})), {min: '0', max: '1', majorUnit: '0.1'});
  assert.deepEqual(axis(await chartXml({type: 'area', data: small})), {min: '0', max: '800', majorUnit: '100'});
  const bar = axis(await chartXml({type: 'bar', data: small}));
  assert.equal(bar.min, '0');
  assert.ok(bar.majorUnit && bar.max);
  const scatter = axis(await chartXml({type: 'scatter', data: {columns: ['X', 'Y'], rows: [[1, 2], [2, 3]]}}));
  assert.equal(scatter.majorUnit, undefined, 'a scatter chart keeps the application axis');
  checked += 6;
}

// 6. Negative values: bounds below zero, the axis still comes from core.
{
  const found = axis(await chartXml({type: 'column', data: {columns: ['Step', 'Delta'], rows: [['A', -30], ['B', 70]]}}));
  assert.deepEqual(found, {min: '-40', max: '80', majorUnit: '20'});
  checked++;
}

console.log(`Chart palette and value axis passed: ${checked} checks (scheme-following series, theme colours, chart.colors, pinned slides, core value axis).`);
