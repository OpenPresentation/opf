import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {unzipSync} from 'fflate';
import {toSvg as renderToSvg} from '@openpresentation/opf-render';
import {resolvePresentation as resolveForPreview} from '@openpresentation/opf-render/svg';
import {toPptx as exportPptx, fromPptx as importPptx} from '../dist/index.js';
import {gallery as defaultCatalog} from '@openpresentation/gallery';

// OPF 0.15: the deck's font scheme (roboto) is the gallery snapshot's, which the host registers for preview, export and
// import alike; the layout under test is embedded in catalogs.custom.
const catalogs = [defaultCatalog];
const toSvg = (deck, slide, options = {}) => renderToSvg(deck, slide, {catalogs, ...options});
const resolvePresentation = (deck, options = {}) => resolveForPreview(deck, {catalogs, ...options});
const toPptx = (deck, options = {}) => exportPptx(deck, {catalogs, ...options});
const fromPptx = (bytes, options = {}) => importPptx(bytes, {catalogs, ...options});
const embedLayout = record => ({custom: {layouts: {'design-layout': record}}});

// FA-17: a layout record's `design` is the lowest-precedence default of one merge (slide design, deck design,
// layout design, engine default) that core resolves once (SlideComposition.design). The preview and the export
// read that result, so a layout that sets titleAlignment, contentAlignment, contentBox or imageFit is drawn the
// same way in both, with no copy of the layout design in the deck or the slide.
const decoder = new TextDecoder();
const native = {left: 'l', center: 'ctr', right: 'r'}, anchor = {start: 'l', middle: 'ctr', end: 'r'};
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
const layout = design => ({name: 'Design layout', design, areas: ['title', 'body'], regions: {body: {accepts: ['text']}}});
const deckOf = (design, slide, deckDesign = {}) => ({design: {fontScheme: 'roboto', ...deckDesign}, catalogs: embedLayout(layout(design)), slides: [{layout: 'design-layout', title: 'Layout title', subtitle: 'Layout subtitle', text: 'Layout body text', ...slide}]});
const slideXml = async deck => decoder.decode(unzipSync(await toPptx(deck, {seed: 1, timestamp: '2026-01-01T00:00:00Z', zipDate: '2026-01-01T00:00:00Z'}))['ppt/slides/slide1.xml']);

// The effective alignment per field, stated independently of core.
const cases = [
  ['layout only', deckOf({titleAlignment: 'right', contentAlignment: 'center'}), {title: 'right', subtitle: 'center', text: 'center'}],
  ['deck over layout (per key)', deckOf({titleAlignment: 'right', contentAlignment: 'center'}, {}, {titleAlignment: 'left'}), {title: 'left', subtitle: 'center', text: 'center'}],
  ['slide over deck over layout', deckOf({titleAlignment: 'right', contentAlignment: 'center'}, {design: {contentAlignment: 'right'}}, {titleAlignment: 'left', contentAlignment: 'left'}), {title: 'left', subtitle: 'right', text: 'right'}],
];
let compared = 0;
for (const [name, deck, expected] of cases) {
  const bound = resolvePresentation(deck, {}).slides[0];
  for (const item of bound.geometry.items) assert.equal(item.alignment, expected[item.field], `${name}: core ${item.field}`);
  const svg = toSvg(deck, 1, {trace: true}), xml = await slideXml(deck);
  const shapes = [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(match => match[0]);
  for (const field of ['title', 'subtitle', 'text']) {
    const path = `slides.0.${field}`;
    const previews = [...svg.matchAll(/<text\b[^>]*>/g)].map(match => match[0]).filter(tag => attr(tag, 'data-opf-path') === path);
    assert.ok(previews.length, `${name}: ${field} preview text`);
    for (const [index, preview] of previews.entries()) {
      assert.equal(anchor[attr(preview, 'text-anchor') ?? 'start'], native[expected[field]], `${name}: ${field} preview anchor`);
      const shape = shapes.find(value => value.includes(`name="OPF ${field === 'text' ? 'text' : 'heading'} ${path} line ${index}"`));
      assert.ok(shape, `${name}: ${field} native line ${index}`);
      assert.equal(shape.match(/<a:pPr\b[^>]*\salgn="([^"]+)"/)?.[1] ?? 'l', native[expected[field]], `${name}: ${field} native alignment`);
      compared++;
    }
  }
}
// Without a layout value, deck value or slide value the engine default is left in both engines.
const plain = deckOf({}, {});
assert.ok((await slideXml(plain)).match(/<a:pPr\b[^>]*\salgn="/g) === null || [...(await slideXml(plain)).matchAll(/\balgn="(\w+)"/g)].every(match => match[1] === 'l'));

// contentBox: the layout asks for cards; both engines draw one card per body item, the deck's false removes them.
const cards = async deck => ({svg: [...toSvg(deck, 1, {trace: true}).matchAll(/<rect\b[^>]*data-opf-path="slides\.0\.text"/g)].length, native: (await slideXml(deck)).includes('name="OPF card slides.0.text"')});
assert.deepEqual(await cards(deckOf({contentBox: true}, {})), {svg: 1, native: true}, 'layout contentBox draws a card in both engines');
assert.deepEqual(await cards(deckOf({contentBox: true}, {}, {contentBox: false})), {svg: 0, native: false}, 'deck contentBox false removes it');
assert.deepEqual(await cards(deckOf({contentBox: false}, {design: {contentBox: true}})), {svg: 1, native: true}, 'slide contentBox true adds it');

// imageFit: cover covers the region (a slice in the preview, a srcRect in the export); contain shows the whole image.
const wide = await readFile(new URL('fixtures/images/wide.png', import.meta.url));
const image = {src: `data:image/png;base64,${wide.toString('base64')}`, alt: 'Wide image'};
const fill = async deck => {
  const svg = toSvg(deck, 1, {trace: true});
  const preview = [...svg.matchAll(/<image\b[^>]*>/g)].map(match => match[0]).find(tag => attr(tag, 'data-opf-path') === 'slides.0.image');
  const output = unzipSync(await toPptx(deck, {imageFormat: 'preserve', strictAssets: true}));
  return {preview: attr(preview, 'preserveAspectRatio'), cropped: /<a:srcRect\b/.test(decoder.decode(output['ppt/slides/slide1.xml']))};
};
const imageDeck = (design, slide = {}, deckDesign = {}) => ({design: {fontScheme: 'roboto', ...deckDesign}, catalogs: embedLayout({...layout(design), areas: ['title', 'media'], regions: {media: {accepts: ['image'], flow: 'none'}}}), slides: [{layout: 'design-layout', title: 'Image', image, ...slide}]});
assert.deepEqual(await fill(imageDeck({imageFit: 'cover'})), {preview: 'xMidYMid slice', cropped: true}, 'layout cover');
assert.deepEqual(await fill(imageDeck({imageFit: 'cover'}, {}, {imageFit: 'contain'})), {preview: 'xMidYMid meet', cropped: false}, 'deck contain over layout cover');
assert.deepEqual(await fill(imageDeck({imageFit: 'contain'}, {design: {imageFit: 'cover'}})), {preview: 'xMidYMid slice', cropped: true}, 'slide cover over layout contain');
// 0.15: cover is the engine default fit.
assert.deepEqual(await fill(imageDeck({})), {preview: 'xMidYMid slice', cropped: true}, 'engine default cover');

// Re-import keeps the layout record and writes no design the deck never had: the layout default still applies.
const reimported = await fromPptx(await toPptx(deckOf({titleAlignment: 'right', contentAlignment: 'center'}, {}), {seed: 1, timestamp: '2026-01-01T00:00:00Z', zipDate: '2026-01-01T00:00:00Z'}));
assert.equal(reimported.slides[0].layout, 'design-layout');
assert.equal(reimported.slides[0].design?.titleAlignment, undefined, 're-import does not copy the layout design into the slide');
assert.equal(reimported.design?.titleAlignment, undefined);
assert.deepEqual(reimported.catalogs?.custom?.layouts?.['design-layout']?.design, {titleAlignment: 'right', contentAlignment: 'center'});
assert.equal(resolvePresentation(reimported, {}).slides[0].geometry.items.find(item => item.field === 'title').alignment, 'right', 'the re-imported layout still aligns the title');

console.log(`Layout design applied: ${compared} text lines agree between preview and export for layout-only, deck-over-layout and slide-over-deck alignment; contentBox and imageFit follow the same merge; re-import keeps the layout record.`);
