// RR-105: the SVG of image callouts and duration timelines formats geometry as the rest of the SVG does (stableNumber:
// at most three decimals), so floating-point noise from core never reaches an attribute.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {toSvg, resolvePresentation} from './catalog-harness.mjs';
import {loadFonts} from '../dist/fonts-node.js';

const src = 'data:image/png;base64,' + readFileSync(new URL('../../pptx/test/fixtures/images/wide.png', import.meta.url)).toString('base64');
const fonts = await loadFonts();
const decimals = /="-?\d+\.\d{4,}/;
const elements = (svg, pattern) => [...svg.matchAll(pattern)].map(match => match[0]);

for (const dimensions of [{width: 1280, height: 720}, {width: 853, height: 479}, {width: 540, height: 960}]) {
  const design = {fontScheme: 'roboto', dimensions: {widthInches: dimensions.width / 96, heightInches: dimensions.height / 96}};
  const callouts = [{text: 'Label', x: .123457, y: .0789123, width: .3333333, height: .2718281}];
  const callout = toSvg({design, slides: [{image: {src, alt: 'Scene', callouts}}]}, 1, {fonts, trace: true});
  const plates = elements(callout, /<g data-opf-image-callout="[^"]*">\s*<rect[^>]*>/g);
  assert.equal(plates.length, 1);
  assert.doesNotMatch(plates[0], decimals, 'callout plate geometry is formatted');

  const timeline = toSvg({design, slides: [{layout: 'timeline', title: 'Delivery', timeline: [{when: 'Week 1', what: 'Scope', duration: 1}, {when: 'Weeks 2 to 5', what: 'Build', duration: 4.333333}, {when: 'Week 6', what: 'Launch'}]}]}, 1, {fonts, trace: true});
  const ranges = elements(timeline, /<rect[^>]*data-opf-timeline-range="\d+"[^>]*>/g), links = elements(timeline, /<line[^>]*data-opf-timeline-range-link="\d+"[^>]*>/g);
  assert.ok(ranges.length >= 2, 'the duration timeline draws range boxes');
  for (const element of [...ranges, ...links]) assert.doesNotMatch(element, decimals, 'timeline range geometry is formatted: ' + element);
}
console.log('image callout and duration timeline SVG: geometry is formatted like the rest of the SVG');
