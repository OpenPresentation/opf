// LH-84: a portrait picture cover-cropped into a wider frame keeps its heads. Without an authored focus core's image block carries
// focus y 0.3, and the exported picture's a:srcRect is core's fitImage crop for it (more trimmed from the bottom than the top);
// an authored focus wins. The preview reads the same core placement (packages/render/test/portrait-focus.mjs).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import { XMLParser } from 'fast-xml-parser';
import { composeSlide, fitImage } from '@openpresentation/opf/composition';
import { resolveSlideContext } from '@openpresentation/opf';
import { toPptx, fromPptx } from '../dist/index.js';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false });
const array = value => value == null ? [] : Array.isArray(value) ? value : [value];
const tall = await readFile(new URL('fixtures/images/tall.png', import.meta.url));
const wide = await readFile(new URL('fixtures/images/wide.png', import.meta.url));
const uri = bytes => `data:image/png;base64,${bytes.toString('base64')}`;
const deckFor = (src, block = {}) => ({ slides: [{ title: 'Team', blocks: [{ type: 'image', image: { src, alt: 'Portrait' }, fit: 'cover', placement: { edge: 'top', size: 0.45 }, ...block }, { type: 'text', text: 'Body copy under the picture.' }] }] });
const imageItem = deck => composeSlide(deck.slides[0], resolveSlideContext(deck, 0, {}).options).items.find(item => item.field === 'image');
const crop = async deck => {
  const entries = unzipSync(await toPptx(deck, { imageFormat: 'preserve', strictAssets: true }));
  const slide = parser.parse(new TextDecoder().decode(entries['ppt/slides/slide1.xml']))['p:sld']['p:cSld']['p:spTree'];
  const rect = array(slide['p:pic'])[0]['p:blipFill']['a:srcRect'];
  return Object.fromEntries(['l', 't', 'r', 'b'].map(key => [key, Number(rect?.[key] ?? 0) / 100000]));
};
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) <= 1e-5, `${label}: ${actual} vs ${expected}`);

// 60 x 120 picture (aspect 0.5) in a wide band: the crop is vertical, and the default focus keeps the top.
{
  const deck = deckFor(uri(tall));
  const item = imageItem(deck);
  assert.deepEqual(item.image.focus, { x: 0.5, y: 0.3 }, 'core resolves the portrait default');
  const expected = fitImage(item.image.box, 'cover', 60 / 120, item.image.focus).crop;
  const native = await crop(deck);
  near(native.l, expected.left, 'l'); near(native.r, expected.right, 'r'); near(native.t, expected.top, 't'); near(native.b, expected.bottom, 'b');
  assert.ok(native.t > 0 && native.b > native.t, `the bottom is trimmed more than the top: ${JSON.stringify(native)}`);
  // An unchanged export imports back without an invented focus: the default is not authored.
  const imported = await fromPptx(await toPptx(deck, { imageFormat: 'preserve', strictAssets: true }), { onDiagnostic: () => {} });
  assert.equal(imported.slides[0].blocks.find(block => block.type === 'image').focus, undefined);
}

// An authored focus wins, the center included.
for (const focus of [{ x: 0.5, y: 0.5 }, { x: 0.5, y: 0 }, { x: 0.2, y: 0.9 }]) {
  const deck = deckFor(uri(tall), { focus });
  const item = imageItem(deck);
  assert.deepEqual(item.image.focus, focus);
  const expected = fitImage(item.image.box, 'cover', 60 / 120, focus).crop;
  const native = await crop(deck);
  near(native.t, expected.top, `focus ${JSON.stringify(focus)} t`); near(native.b, expected.bottom, `focus ${JSON.stringify(focus)} b`);
}
{
  const centered = await crop(deckFor(uri(tall), { focus: { x: 0.5, y: 0.5 } }));
  near(centered.t, centered.b, 'a centered crop trims top and bottom alike');
}

// A landscape picture in the same band keeps the centered crop (it has nothing to trim at the top and bottom of a head).
{
  const deck = deckFor(uri(wide));
  assert.deepEqual(imageItem(deck).image.focus, { x: 0.5, y: 0.5 });
  const native = await crop(deck);
  near(native.t, native.b, 'landscape t/b'); near(native.l, native.r, 'landscape l/r');
}
console.log('portrait focus: pptx crop agrees with core');
