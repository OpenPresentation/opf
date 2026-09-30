import assert from 'node:assert/strict';
import {renderSvg} from '../dist/svg.js';

// FF-59: the slide tag is the eyebrow label. The preview draws it in the scheme's primary colour (accent1),
// which is what opf-pptx writes for the tag run; title, subtitle and body keep the text colour.
const fills = (svg, path) => [...svg.matchAll(/<text\b([^>]*)>/g)]
  .map(([, attrs]) => attrs)
  .filter(attrs => attrs.includes(`data-opf-path="${path}"`))
  .map(attrs => /(?:^|\s)fill="([^"]*)"/.exec(attrs)?.[1]);
const one = set => { assert.equal(new Set(set).size, 1, `one fill: ${set}`); return set[0]; };

const slide = {id: 'intro', layout: 'title-slide', tag: 'Pitch Intro', title: 'New category, clear wedge', subtitle: 'Why now', items: ['Problem worth solving']};
const white = {type: 'solid', color: '#FFFFFF'};
const cases = [
  // Catalog scheme: accent1 is 2874A6, text is black on the white light1 background.
  {name: 'cool-horizon', design: {colorScheme: 'cool-horizon', fontScheme: 'aptos', background: white}, primary: '#2874A6', text: '#000000'},
  // A scheme that names primary overrides accent1.
  {name: 'explicit primary', design: {colorScheme: {light1: '#FFFFFF', dark1: '#111111', accent1: '#AA0000', primary: '#0055AA'}, fontScheme: 'aptos', background: white}, primary: '#0055AA', text: '#111111'},
  // Dark background: the tag stays the primary colour, the text colour flips.
  {name: 'dark', design: {colorScheme: {light1: '#F8FAFC', dark1: '#0B1220', accent1: '#38BDF8'}, background: {type: 'solid', color: '#0B1220'}, fontScheme: 'aptos'}, primary: '#38BDF8', text: '#F8FAFC'},
];
for (const {name, design, primary, text} of cases) {
  const svg = renderSvg({design, slides: [slide]}, {trace: true});
  assert.equal(one(fills(svg, 'slides.0.tag')).toUpperCase(), primary.toUpperCase(), `${name}: tag fill`);
  assert.equal(one(fills(svg, 'slides.0.title')).toUpperCase(), text.toUpperCase(), `${name}: title fill`);
  assert.equal(one(fills(svg, 'slides.0.subtitle')).toUpperCase(), text.toUpperCase(), `${name}: subtitle fill`);
}

// A tag that wraps draws every line in the primary colour.
const wrapped = renderSvg({design: {colorScheme: 'cool-horizon', fontScheme: 'aptos', background: white}, slides: [{...slide, tag: 'A long eyebrow label that needs more than one line to fit '.repeat(6)}]}, {trace: true});
const lines = fills(wrapped, 'slides.0.tag');
assert.ok(lines.length > 1, 'tag wraps');
assert.equal(one(lines).toUpperCase(), '#2874A6');
console.log('tag colour ok');
