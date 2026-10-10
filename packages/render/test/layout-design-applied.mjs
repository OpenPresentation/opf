// FA-17: a layout record's `design` is the lowest-precedence default of one merge (slide design, deck design,
// layout design, engine default) that core resolves once (SlideComposition.design). The preview draws that
// result: text alignment, content cards, image fill and picture bullets follow the layout when nothing above it
// sets the key, and the deck and the slide override it per key. OPF 0.15: the layout record is embedded in the document's
// `custom` catalog group; the deck names the gallery's `roboto` font scheme, so the host catalog is registered.
import assert from 'node:assert/strict';
import sharp from 'sharp';
import * as composition from '@openpresentation/opf/composition';
import { resolvePresentation, toSvg } from './catalog-harness.mjs';

if (typeof composition.resolveDesignHints !== 'function') {
  console.log('Layout design applied skipped: the linked @openpresentation/opf has no resolveDesignHints (core before FA-17).');
  process.exit(0);
}

const attr = (element, name) => element.match(new RegExp(' ' + name + '="([^"]*)"'))?.[1];
const anchors = { left: 'start', center: 'middle', right: 'end' };
const layout = (design, placeholders = [{ type: 'title' }, { type: 'subtitle' }, { type: 'text' }]) => ({ name: 'Design layout', design, placeholders });
const deckOf = (record, slide = {}, deckDesign = {}) => ({ design: { fontScheme: 'roboto', ...deckDesign }, catalogs: { custom: { layouts: { 'design-layout': record } } }, slides: [{ layout: 'design-layout', title: 'Layout title', subtitle: 'Layout subtitle', text: 'Layout body text', ...slide }] });
const texts = (svg, path) => [...svg.matchAll(/<text\b[^>]*>/g)].map(match => match[0]).filter(tag => attr(tag, 'data-opf-path') === path);

// Alignment: layout only, deck over layout, slide over deck, per key.
const cases = [
  ['layout only', deckOf(layout({ titleAlignment: 'right', contentAlignment: 'center' })), { title: 'right', subtitle: 'center', text: 'center' }],
  ['deck over layout', deckOf(layout({ titleAlignment: 'right', contentAlignment: 'center' }), {}, { titleAlignment: 'left' }), { title: 'left', subtitle: 'center', text: 'center' }],
  ['slide over deck over layout', deckOf(layout({ titleAlignment: 'right', contentAlignment: 'center' }), { design: { contentAlignment: 'right' } }, { titleAlignment: 'left', contentAlignment: 'left' }), { title: 'left', subtitle: 'right', text: 'right' }],
  ['no value anywhere', deckOf(layout({})), { title: 'left', subtitle: 'left', text: 'left' }],
];
let checked = 0;
for (const [name, deck, expected] of cases) {
  const bound = resolvePresentation(deck).slides[0];
  const svg = toSvg(deck, 1, { trace: true });
  for (const field of ['title', 'subtitle', 'text']) {
    const item = bound.geometry.items.find(entry => entry.field === field);
    assert.equal(item.alignment, expected[field], `${name}: core ${field} alignment`);
    const lines = texts(svg, `slides.0.${field}`);
    assert.ok(lines.length, `${name}: ${field} preview text`);
    for (const line of lines) assert.equal(attr(line, 'text-anchor') ?? 'start', anchors[expected[field]], `${name}: ${field} anchor`);
    checked++;
  }
}

// The geometry the preview draws from is the same one every engine reads.
const bound = resolvePresentation(deckOf(layout({ titleAlignment: 'center', contentAlignment: 'center', contentBox: true, imageFit: 'cover', listBullet: 'character' }))).slides[0];
assert.deepEqual({ ...bound.geometry.design.sources }, { titleAlignment: 'layout', contentAlignment: 'layout', contentBox: 'layout', imageFit: 'layout', listBullet: 'layout' });

// contentBox: the layout asks for cards; the deck's false removes them and the slide's true adds them back.
const cards = (deck) => [...toSvg(deck, 1, { trace: true }).matchAll(/<rect\b[^>]*data-opf-path="slides\.0\.text"/g)].length;
assert.equal(cards(deckOf(layout({ contentBox: true }))), 1, 'layout contentBox draws a card');
assert.equal(cards(deckOf(layout({ contentBox: true }), {}, { contentBox: false })), 0, 'deck contentBox false removes it');
assert.equal(cards(deckOf(layout({ contentBox: false }), { design: { contentBox: true } })), 1, 'slide contentBox true adds it');
assert.equal(cards(deckOf(layout({}))), 0, 'engine default draws no card');

// imageFit (FA-22): cover covers the frame, contain shows the whole image, stretch fills it.
const wide = `data:image/png;base64,${(await sharp({ create: { width: 160, height: 40, channels: 3, background: { r: 200, g: 30, b: 30 } } }).png().toBuffer()).toString('base64')}`;
const aspect = (deck) => {
  const image = [...toSvg(deck, 1, { trace: true }).matchAll(/<image\b[^>]*>/g)].map(match => match[0]).find(tag => attr(tag, 'data-opf-path') === 'slides.0.image');
  return attr(image, 'preserveAspectRatio');
};
const imageDeck = (design, slide = {}, deckDesign = {}) => deckOf(layout(design, [{ type: 'title' }, { type: 'image' }]), { image: { src: wide, alt: 'Wide' }, ...slide }, deckDesign);
assert.equal(aspect(imageDeck({ imageFit: 'contain' })), 'xMidYMid meet', 'layout contain');
assert.equal(aspect(imageDeck({ imageFit: 'contain' }, {}, { imageFit: 'stretch' })), 'none', 'deck stretch over layout contain');
assert.equal(aspect(imageDeck({ imageFit: 'contain' }, { design: { imageFit: 'cover' } })), 'xMidYMid slice', 'slide cover over layout contain');
assert.equal(aspect(imageDeck({})), 'xMidYMid slice', 'engine default cover');

// listBullet: the layout's picture bullets draw the organization's icon logo (RR-71); the deck's character beats them.
const listDeck = (design, deckDesign = {}) => ({ ...deckOf(layout(design, [{ type: 'title' }, { type: 'list' }]), { text: undefined, items: ['One', 'Two'] }, deckDesign), organization: { id: 'acme', name: 'Acme', logo: { icon: wide } } });
const bullets = (deck) => [...toSvg(deck, 1, { trace: true }).matchAll(/<image\b[^>]*>/g)].length;
assert.equal(bullets(listDeck({ listBullet: 'image' })), 2, 'layout picture bullets');
assert.equal(bullets(listDeck({ listBullet: 'image' }, { listBullet: 'character' })), 0, 'deck character over layout image');
assert.equal(bullets(listDeck({})), 0, 'engine default draws glyph markers');

console.log(`Layout design applied: ${checked} text fields at the layout, deck or slide alignment; contentBox, imageFit and listBullet follow the same merge.`);
