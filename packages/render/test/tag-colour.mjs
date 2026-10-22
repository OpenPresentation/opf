import assert from 'node:assert/strict';
import {toSvg} from './catalog-harness.mjs'; // FA-23: registers the gallery snapshot (the documents name gallery records)

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
  const svg = toSvg({design, slides: [slide]}, 1, {trace: true});
  assert.equal(one(fills(svg, 'slides.0.tag')).toUpperCase(), primary.toUpperCase(), `${name}: tag fill`);
  assert.equal(one(fills(svg, 'slides.0.title')).toUpperCase(), text.toUpperCase(), `${name}: title fill`);
  assert.equal(one(fills(svg, 'slides.0.subtitle')).toUpperCase(), text.toUpperCase(), `${name}: subtitle fill`);
}

// A tag that wraps draws every line in the primary colour.
const wrapped = toSvg({design: {colorScheme: 'cool-horizon', fontScheme: 'aptos', background: white}, slides: [{...slide, tag: 'A long eyebrow label that needs more than one line to fit '.repeat(6)}]}, 1, {trace: true});
const lines = fills(wrapped, 'slides.0.tag');
assert.ok(lines.length > 1, 'tag wraps');
assert.equal(one(lines).toUpperCase(), '#2874A6');
// FF-61: when the primary is under 4.5:1 (WCAG 2.x) against the slide background the tag draws in the slide text
// colour; otherwise it keeps the primary. The same colour pairs, background-first, are pinned in opf-pptx
// test/tag-colour.mjs: the eight distinct pairs of the ten corpus tags that were under 4.5:1 (core example corpus, FF-59; 9E9E9E on white occurs three times) and four that pass.
const wcag = hex => {
  const channels = [1, 3, 5].map(offset => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};
const contrast = (a, b) => { const [hi, lo] = [wcag(a), wcag(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const pairs = [
  ['#FE938C', '#FFFFFF', 2.15], ['#6A1B9A', '#000000', 2.24], ['#4A1BE4', '#000000', 2.57], ['#F77F00', '#FFFFFF', 2.63],
  ['#9E9E9E', '#FFFFFF', 2.68], ['#A41410', '#000000', 2.69], ['#FD3223', '#FFFFFF', 3.71], ['#997929', '#FFFFFF', 4.10],
  ['#767676', '#FFFFFF', 4.54], ['#2874A6', '#FFFFFF', 5.07], ['#38BDF8', '#0B1220', 8.74], ['#FFFFFF', '#000000', 21],
];
for (const [primary, background, ratio] of pairs) {
  const dark = wcag(background) < 0.179;
  const text = dark ? '#FFFFFF' : '#111111';
  const expected = contrast(primary, background) < 4.5 ? text : primary;
  assert.equal(Number(contrast(primary, background).toFixed(2)), ratio, `${primary} on ${background}: ratio`);
  const design = {colorScheme: {light1: '#FFFFFF', dark1: '#111111', accent1: primary}, fontScheme: 'aptos', background: {type: 'solid', color: background}};
  const svg = toSvg({design, slides: [slide]}, 1, {trace: true});
  assert.equal(one(fills(svg, 'slides.0.tag')).toUpperCase(), expected.toUpperCase(), `${primary} on ${background}: tag fill`);
  assert.equal(one(fills(svg, 'slides.0.title')).toUpperCase(), text.toUpperCase(), `${primary} on ${background}: title fill`);
}
// The threshold is 4.5 exactly: #767676 on white is 4.54 (kept), #777777 is 4.48 (text colour).
for (const [primary, kept] of [['#767676', true], ['#777777', false]]) {
  const design = {colorScheme: {light1: '#FFFFFF', dark1: '#111111', accent1: primary}, fontScheme: 'aptos', background: white};
  assert.equal(one(fills(toSvg({design, slides: [slide]}, 1, {trace: true}), 'slides.0.tag')).toUpperCase(), kept ? primary : '#111111');
}
// A slide-level background is the one the tag sits on, per slide.
{
  const design = {colorScheme: {light1: '#FFFFFF', dark1: '#111111', accent1: '#6A1B9A'}, fontScheme: 'aptos', background: white};
  const deck = {design, slides: [slide, {...slide, id: 'dark', design: {background: {type: 'solid', color: '#000000'}}}]};
  const first = toSvg(deck, 1, {trace: true}), second = toSvg(deck, 2, {trace: true});
  assert.equal(one(fills(first, 'slides.0.tag')).toUpperCase(), '#6A1B9A', 'white slide keeps the primary');
  assert.equal(one(fills(second, 'slides.1.tag')).toUpperCase(), '#FFFFFF', 'black slide takes the text colour');
}
// A wrapped low-contrast tag draws every line in the text colour.
{
  const long = toSvg({design: {colorScheme: {light1: '#FFFFFF', dark1: '#111111', accent1: '#FE938C'}, fontScheme: 'aptos', background: white}, slides: [{...slide, tag: 'A long eyebrow label that needs more than one line to fit '.repeat(6)}]}, 1, {trace: true});
  const lines2 = fills(long, 'slides.0.tag');
  assert.ok(lines2.length > 1);
  assert.equal(one(lines2).toUpperCase(), '#111111');
}
console.log('tag colour ok');
