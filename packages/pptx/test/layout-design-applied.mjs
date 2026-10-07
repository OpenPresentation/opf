import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {unzipSync} from 'fflate';
import {renderSlideSvg} from '@openpresentation/opf-render';
import {resolvePresentation} from '@openpresentation/opf-render/svg';
import {toPptx, fromPptx} from '../dist/index.js';

// FA-17: a layout record's `design` is the lowest-precedence default of one merge (slide design, deck design,
// layout design, engine default) that core resolves once (SlideComposition.design). The preview and the export
// read that result, so a layout that sets titleAlignment, contentAlignment, contentBox or imageFill is drawn the
// same way in both, with no copy of the layout design in the deck or the slide.
const decoder = new TextDecoder();
const native = {left: 'l', center: 'ctr', right: 'r'}, anchor = {start: 'l', middle: 'ctr', end: 'r'};
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
const layout = design => ({$schema: 'https://openpresentation.org/schema/opf-layout/v1', id: 'design-layout', name: 'Design layout', design, placeholders: [{type: 'title'}, {type: 'subtitle'}, {type: 'text'}]});
const deckOf = (design, slide, deckDesign = {}) => ({design: {fontScheme: 'roboto', ...deckDesign}, catalogs: {layouts: {records: [layout(design)]}}, slides: [{layout: 'design-layout', title: 'Layout title', subtitle: 'Layout subtitle', text: 'Layout body text', ...slide}]});
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
  const svg = renderSlideSvg(deck, 0, {trace: true}), xml = await slideXml(deck);
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
const cards = async deck => ({svg: [...renderSlideSvg(deck, 0, {trace: true}).matchAll(/<rect\b[^>]*data-opf-path="slides\.0\.text"/g)].length, native: (await slideXml(deck)).includes('name="OPF card slides.0.text"')});
assert.deepEqual(await cards(deckOf({contentBox: true}, {})), {svg: 1, native: true}, 'layout contentBox draws a card in both engines');
assert.deepEqual(await cards(deckOf({contentBox: true}, {}, {contentBox: false})), {svg: 0, native: false}, 'deck contentBox false removes it');
assert.deepEqual(await cards(deckOf({contentBox: false}, {design: {contentBox: true}})), {svg: 1, native: true}, 'slide contentBox true adds it');

// imageFill: crop covers the region (a slice in the preview, a srcRect in the export); fit shows the whole image.
const wide = await readFile(new URL('fixtures/images/wide.png', import.meta.url));
const image = {src: `data:image/png;base64,${wide.toString('base64')}`, alt: 'Wide image'};
const fill = async deck => {
  const svg = renderSlideSvg(deck, 0, {trace: true});
  const preview = [...svg.matchAll(/<image\b[^>]*>/g)].map(match => match[0]).find(tag => attr(tag, 'data-opf-path') === 'slides.0.image');
  const output = unzipSync(await toPptx(deck, {imageFormat: 'preserve', strictAssets: true}));
  return {preview: attr(preview, 'preserveAspectRatio'), cropped: /<a:srcRect\b/.test(decoder.decode(output['ppt/slides/slide1.xml']))};
};
const imageDeck = (design, slide = {}, deckDesign = {}) => ({design: {fontScheme: 'roboto', ...deckDesign}, catalogs: {layouts: {records: [{...layout(design), placeholders: [{type: 'title'}, {type: 'image'}]}]}}, slides: [{layout: 'design-layout', title: 'Image', image, ...slide}]});
assert.deepEqual(await fill(imageDeck({imageFill: 'crop'})), {preview: 'xMidYMid slice', cropped: true}, 'layout crop');
assert.deepEqual(await fill(imageDeck({imageFill: 'crop'}, {}, {imageFill: 'fit'})), {preview: 'xMidYMid meet', cropped: false}, 'deck fit over layout crop');
assert.deepEqual(await fill(imageDeck({imageFill: 'fit'}, {design: {imageFill: 'crop'}})), {preview: 'xMidYMid slice', cropped: true}, 'slide crop over layout fit');
assert.deepEqual(await fill(imageDeck({})), {preview: 'xMidYMid meet', cropped: false}, 'engine default fit');

// Re-import keeps the layout record and writes no design the deck never had: the layout default still applies.
const reimported = await fromPptx(await toPptx(deckOf({titleAlignment: 'right', contentAlignment: 'center'}, {}), {seed: 1, timestamp: '2026-01-01T00:00:00Z', zipDate: '2026-01-01T00:00:00Z'}));
assert.equal(reimported.slides[0].layout, 'design-layout');
assert.equal(reimported.slides[0].design?.titleAlignment, undefined, 're-import does not copy the layout design into the slide');
assert.equal(reimported.design?.titleAlignment, undefined);
assert.deepEqual(reimported.catalogs?.layouts?.records?.[0]?.design, {titleAlignment: 'right', contentAlignment: 'center'});
assert.equal(resolvePresentation(reimported, {}).slides[0].geometry.items.find(item => item.field === 'title').alignment, 'right', 'the re-imported layout still aligns the title');

console.log(`Layout design applied: ${compared} text lines agree between preview and export for layout-only, deck-over-layout and slide-over-deck alignment; contentBox and imageFill follow the same merge; re-import keeps the layout record.`);
