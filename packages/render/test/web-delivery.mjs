// RR-59: standalone and SSR font delivery preserve the measured text and only carry drawn faces.
import assert from 'node:assert/strict';
import {loadFonts} from '../dist/fonts-node.js';
import {toSvg} from '../dist/svg.js';
import {toHtml} from '../dist/element.js';
import {embed} from '@openpresentation/opf';
import {defaultCatalog} from '@openpresentation/opf/catalog';

// OPF 0.15: the renderer registers no catalog, so each deck embeds the font scheme it names (core embed), as a saved
// document does; every delivery mode then resolves the same records with no host catalog.
const saved = document => embed(document, {catalogs: [defaultCatalog]}).document;
const deck = saved({name: 'Delivery', design: {fontScheme: 'roboto'}, slides: [
  {title: 'One', text: 'Measured body'}, {title: 'Two', text: 'Measured body'}, {title: 'Three', text: 'Measured body'},
]});
const rules = svg => [...svg.matchAll(/@font-face\{font-family:"([^"]+)";font-weight:(\d+);font-style:([^;]+);src:url\("([^"]+)"\)\}/g)].map(match => match[0]);
for (const pack of ['base', 'office']) {
  const fonts = await loadFonts({pack});
  const slides = toSvg(deck, {fonts});
  for (const svg of slides) {
    assert.equal(rules(svg).length, 2, `${pack}: only Roboto regular and bold are drawn`);
    assert.ok(rules(svg).every(rule => /font-family:"Roboto"/.test(rule)));
    assert.doesNotMatch(svg, /font-family:"(?:Carlito|Caladea|Arimo|Intos|Noto Sans)"/);
    assert.match(svg, /<metadata>.*SIL OPEN FONT LICENSE/s, 'retain the license of the embedded faces');
  }
  const rich = {...deck, slides: [{title: 'Styles', text: [{text: 'Regular '}, {text: 'bold ', bold: true}, {text: 'italic ', italic: true}, {text: 'both', bold: true, italic: true}]}]};
  assert.equal(rules(toSvg(rich, 1, {fonts})).length, 4, `${pack}: four actual styles are embedded`);
  const standalone = toHtml(deck, '1-', {fonts});
  const shared = toHtml(deck, '1-', {fonts, fontMode: 'shared'});
  const external = toHtml(deck, '1-', {fonts, fontMode: 'external'});
  assert.equal(rules(standalone).length, 6);
  assert.equal(rules(shared).length, 2);
  assert.equal(rules(external).length, 0);
  const nestedExternal = toHtml(deck, '1-', {fontMode: 'external', renderOptions: {fonts}});
  assert.equal(rules(nestedExternal).length, 0, 'renderOptions.fonts follows the same external delivery contract');
  // Font delivery is the sole SVG difference: text layout, fallback, sizes and positions stay identical.
  const geometry = html => [...html.matchAll(/<text\b[\s\S]*?<\/text>/g)].map(match => match[0]);
  assert.deepEqual(geometry(shared), geometry(standalone));
  assert.deepEqual(geometry(external), geometry(standalone));
  assert.deepEqual(geometry(nestedExternal), geometry(standalone));
}
const office = await loadFonts({pack: 'office', substitutionPolicy: 'visual'});
const calibri = toSvg(saved({...deck, catalogs: undefined, design: {fontScheme: 'calibri'}}), 1, {fonts: office});
assert.equal(rules(calibri).length, 2);
assert.ok(rules(calibri).every(rule => /font-family:"Carlito"/.test(rule)), 'aliases embed the resolved drawn family');
const fallback = toSvg(saved({...deck, catalogs: undefined, language: 'ru', design: {fontScheme: 'georgia'}, slides: [{title: 'English', text: 'Текст'}]}), 1, {fonts: office});
assert.ok(rules(fallback).some(rule => /font-family:"Noto Sans"/.test(rule)), 'glyph fallback face is self-contained too');
// A custom handle without exact style resolution can draw both matched and unmatched weights in one family.
const custom = {embeddedFonts: office.embeddedFonts.filter(face => face.family === 'Roboto' && [400, 700].includes(face.weight) && !face.italic)};
const unmatched = toSvg({...deck, slides: [{title: 'Bold', metric: {value: '42', label: 'Label'}}]}, 1, {fonts: custom});
assert.equal(rules(unmatched).length, 2, 'unmatched weights cannot remove the face a browser needs alongside a matched one');
assert.throws(() => toHtml(deck, {fontMode: 'wrong'}), error => error.code === 'invalid-font-mode');
console.log('web delivery: base/Office used faces, styles, aliases, glyph fallback and measured SSR modes pass');
