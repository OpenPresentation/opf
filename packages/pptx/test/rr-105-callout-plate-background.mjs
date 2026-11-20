// RR-105: the exported image-callout panel is filled with the slide's resolved background, so it matches the preview plate.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {unzipSync} from 'fflate';
import {toPptx} from './helpers/default-catalog.mjs';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';

const src = 'data:image/png;base64,' + readFileSync(new URL('fixtures/images/wide.png', import.meta.url)).toString('base64');
const fonts = await loadFonts();
const callouts = [{text: 'Label', x: .1, y: .1, width: .5, height: .2}];
const cases = {
  'deck color': [{design: {fontScheme: 'roboto', background: '#223344'}, slides: [{image: {src, callouts}}]}, '223344'],
  'slide color': [{design: {fontScheme: 'roboto'}, slides: [{design: {background: '#aa3344'}, image: {src, callouts}}]}, 'AA3344'],
  'slide color over deck color': [{design: {fontScheme: 'roboto', background: '#223344'}, slides: [{design: {background: '#aa3344'}, image: {src, callouts}}]}, 'AA3344'],
  'dark variant': [{design: {fontScheme: 'roboto', variant: 'dark1'}, slides: [{image: {src, callouts}}]}],
  'no background': [{design: {fontScheme: 'roboto'}, slides: [{image: {src, callouts}}]}],
};
for (const [name, [deck, color]] of Object.entries(cases)) {
  const xml = new TextDecoder().decode(unzipSync(await toPptx(deck, {fonts}))['ppt/slides/slide1.xml']);
  const normal = fill => fill.replace(/><\/a:(srgbClr|schemeClr)>/g, '/>');
  const background = /<p:bg>[\s\S]*?(<a:solidFill>[\s\S]*?<\/a:solidFill>)/.exec(xml)?.[1];
  const start = xml.indexOf('OPF image callout'), panel = xml.slice(start, xml.indexOf('</p:sp>', start));
  const plate = /<p:spPr>[\s\S]*?(<a:solidFill>[\s\S]*?<\/a:solidFill>)/.exec(panel)?.[1];
  assert.ok(plate, name + ': the panel is filled');
  assert.equal(normal(plate), normal(background), name + ': the panel fill is the slide background fill');
  if (color) assert.match(plate, new RegExp('val="' + color + '"'), name + ': the resolved color');
}
console.log('image callout panel: filled with the slide background (deck, slide, variant)');
