import assert from 'node:assert/strict';
import {colorContrast, chartPaletteForFill, chartSeriesPalette} from '@openpresentation/opf/composition';
import {examples} from '@openpresentation/opf/examples';
import {defaultCatalog, resolvePresentation, toSvg} from './catalog-harness.mjs';

// RR-96: the preview draws every slide from core's resolved roles for its variant (design.variant per deck and per slide, the
// "dark1" shorthand, the accent order, a picture's tone): the background is bg1, text tx1, and borders, gridlines, axis lines and chart
// text are the scheme-derived neutrals (tx1 mixed into bg1), so a variant flips all of them together.
const attrs = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const tags = (svg, name) => [...svg.matchAll(new RegExp(`<${name}\\b([^>]*?)/?>`, 'g'))].map(([, a]) => attrs(a));
const backgroundOf = (svg) => tags(svg, 'rect').find((rect) => (rect['data-opf-path'] ?? '').endsWith('.design.background') || rect.width === '1280' && rect.height === '720').fill.toUpperCase();
const titleFill = (svg) => attrs(/<text\b([^>]*data-opf-path="slides\.0\.title"[^>]*)>/.exec(svg)[1]).fill.toUpperCase();
const colors = {id: 'forest', dark1: '#10231A', light1: '#F5F7F2', dark2: '#2B3A33', light2: '#E6ECE3', accent1: '#B45309', accent2: '#7C2D12', accent3: '#0F766E', accent4: '#6D28D9', accent5: '#BE185D', accent6: '#4D7C0F', hyperlink: '#B45309', followedHyperlink: '#6D28D9'};
const chart = {type: 'column', data: {columns: ['Quarter', 'A', 'B'], rows: [['Q1', 3, 5], ['Q2', 4, 6], ['Q3', 6, 8]]}};
const deck = (design, slideDesign) => ({design: {colorScheme: colors, ...design}, slides: [{title: 'T', chart, ...(slideDesign ? {design: slideDesign} : {})}]});
const rolesOf = (input) => resolvePresentation(input).slides[0].design.roles;

// The color-variants example: light and dark slides, a warm light2 slide and a picture with a tone.
{
  const example = examples.find(({file}) => file.endsWith('technical/color-variants.opf.json')).deck;
  const svgs = toSvg(example, {trace: true, catalogs: [defaultCatalog]});
  assert.equal(svgs.length, example.slides.length);
  const lightness = (hex) => colorContrast(hex, '#000000');
  const surfaces = svgs.map((svg) => backgroundOf(svg));
  for (const index of [0, 1, 2, 5]) assert.ok(lightness(surfaces[index]) > 10, `slide ${index} has a light background (${surfaces[index]})`);
  for (const index of [3, 4]) assert.ok(lightness(surfaces[index]) < 3, `slide ${index} has a dark background (${surfaces[index]})`);
  svgs.forEach((svg, index) => {
    const text = attrs(/<text\b([^>]*data-opf-path="slides\.\d+\.title"[^>]*)>/.exec(svg)[1]).fill.toUpperCase();
    assert.ok(colorContrast(text, surfaces[index]) >= 4.5, `slide ${index}: title ${text} on ${surfaces[index]}`);
  });
}

// "dark1" shorthand at deck level, light1 on one slide: backgrounds and every neutral flip with the variant.
{
  const dark = deck({variant: 'dark1'}), light = deck({variant: 'dark1'}, {variant: 'light1'});
  const darkRoles = rolesOf(dark), lightRoles = rolesOf(light);
  assert.equal(darkRoles.variant.background, 'dark1');
  assert.equal(lightRoles.variant.background, 'light1');
  const darkSvg = toSvg(dark, 1, {trace: true}), lightSvg = toSvg(light, 1, {trace: true});
  assert.equal(backgroundOf(darkSvg), colors.dark1);
  assert.equal(backgroundOf(lightSvg), colors.light1.toUpperCase());
  assert.equal(titleFill(darkSvg), colors.light1.toUpperCase());
  assert.equal(titleFill(lightSvg), colors.dark1);
  for (const [svg, roles] of [[darkSvg, darkRoles], [lightSvg, lightRoles]]) {
    const lines = tags(svg, 'line');
    assert.ok(lines.some((line) => line.stroke === roles.neutrals.gridline.hex), 'gridlines are the gridline neutral');
    assert.ok(lines.some((line) => line.stroke === roles.neutrals.axisLine.hex), 'axis lines are the axis neutral');
    // WI-5 (P19): the chart panel is a fill only: no outer frame, the axes and gridlines draw the plot.
    assert.ok(!tags(svg, 'rect').some((rect) => rect.stroke === roles.border), 'the chart has no outer frame');
    assert.ok(!/#888888|#CBD5E1|#475569|#F9F9F9/i.test(svg), 'no fixed neutral literal is drawn');
  }
  assert.notEqual(darkRoles.neutrals.gridline.hex, lightRoles.neutrals.gridline.hex, 'the gridline neutral follows the variant');
}

// The variant's accent order is the order of the series colours.
{
  const accents = ['accent3', 'accent1', 'accent2', 'accent4', 'accent5', 'accent6'];
  const input = deck({variant: {background: 'light1', accents}});
  const roles = rolesOf(input);
  assert.deepEqual(roles.map.accents, accents);
  const svg = toSvg(input, 1, {trace: true});
  const fills = new Map(tags(svg, 'rect').filter((rect) => /\.chart\.data\.rows\.\d+\.[12]$/.test(rect['data-opf-path'] ?? '')).map((rect) => [Number(rect['data-opf-path'].split('.').at(-1)), rect.fill.toUpperCase()]));
  const expected = chartPaletteForFill(roles.surface, chartSeriesPalette(colors, undefined, {accents})).slice(0, 2).map((color) => color.toUpperCase());
  assert.deepEqual([fills.get(1), fills.get(2)], expected, 'series follow the variant accent order');
  assert.equal(fills.get(1), colors.accent3.toUpperCase());
}

// A picture that names its tone gets the tone's variant and a scrim of its bg1; without a tone there is none.
{
  const picture = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const input = (tone) => ({design: {colorScheme: colors, background: {type: 'image', src: picture, alt: 'Backdrop', ...(tone ? {tone} : {})}}, slides: [{title: 'T', text: ['Body']}]});
  const toned = toSvg(input('dark'), 1, {trace: true}), plain = toSvg(input(undefined), 1, {trace: true});
  assert.equal(titleFill(toned), colors.light1.toUpperCase(), 'tone dark picks the dark1 variant: light text');
  const scrim = tags(toned, 'rect').find((rect) => rect['data-opf-tone-overlay'] === 'dark');
  assert.ok(scrim, 'a tone scrim covers the picture');
  assert.equal(scrim.fill.toUpperCase(), colors.dark1);
  assert.ok(Number(scrim.opacity) > 0 && Number(scrim.opacity) < 1);
  assert.ok(!/data-opf-tone-overlay/.test(plain), 'no tone, no scrim');
  const light = toSvg(input('light'), 1, {trace: true});
  assert.equal(titleFill(light), colors.dark1);
  assert.equal(tags(light, 'rect').find((rect) => rect['data-opf-tone-overlay'] === 'light').fill.toUpperCase(), colors.light1.toUpperCase());
}

console.log('Color variants passed: per-deck and per-slide variants, the dark1 shorthand, variant neutrals on every chart line and frame, accent order and picture tone.');
