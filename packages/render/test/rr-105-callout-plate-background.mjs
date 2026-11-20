// RR-105: the image-callout plate is drawn in the slide's resolved background (design.backgroundColor, else the variant's
// background role), whether the deck, the slide or a variant sets it, as the timeline's range outlines are.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {toSvg, resolvePresentation} from './catalog-harness.mjs';
import {loadFonts} from '../dist/fonts-node.js';

const src = 'data:image/png;base64,' + readFileSync(new URL('../../pptx/test/fixtures/images/wide.png', import.meta.url)).toString('base64');
const fonts = await loadFonts();
const callouts = [{text: 'Label', x: .1, y: .1, width: .5, height: .2}];
const gradient = {type: 'gradient', gradient: {stops: [{position: 0, color: '#112233'}, {position: 1, color: '#ccddee'}]}};
const cases = {
  'no background': {design: {fontScheme: 'roboto'}, slides: [{image: {src, callouts}}]},
  'deck color': {design: {fontScheme: 'roboto', background: '#223344'}, slides: [{image: {src, callouts}}]},
  'slide color': {design: {fontScheme: 'roboto'}, slides: [{design: {background: '#aa3344'}, image: {src, callouts}}]},
  'slide color over deck color': {design: {fontScheme: 'roboto', background: '#223344'}, slides: [{design: {background: '#aa3344'}, image: {src, callouts}}]},
  'dark variant': {design: {fontScheme: 'roboto', variant: 'dark1'}, slides: [{image: {src, callouts}}]},
  'slide gradient': {design: {fontScheme: 'roboto'}, slides: [{design: {background: gradient}, image: {src, callouts}}]},
};
const fillOf = (svg, pattern) => pattern.exec(svg)?.[1];
for (const [name, deck] of Object.entries(cases)) {
  const svg = toSvg(deck, 1, {fonts, trace: true});
  const design = resolvePresentation(deck, {fonts}).slides[0].design;
  const plate = fillOf(svg, /data-opf-image-callout="[^"]*"><rect[^>]*fill="([^"]*)"/);
  assert.equal(plate, design.backgroundColor ?? design.colors.background, name + ': the plate follows the slide background');
}
const solid = toSvg(cases['slide color over deck color'], 1, {fonts, trace: true});
assert.match(solid, /data-opf-image-callout="[^"]*"><rect[^>]*fill="#AA3344"/, 'a slide background replaces the deck background in the plate');
console.log('image callout plate: follows the slide background (deck, slide, variant, gradient)');
