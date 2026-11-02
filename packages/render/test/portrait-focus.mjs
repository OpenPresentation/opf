// LH-84: the preview of a portrait picture cover-cropped into a wider frame keeps its heads: the SVG draws core's placement for
// focus y 0.3 (the picture's top kept in view) unless the author gave a focus. PPTX reads the same core crop
// (packages/pptx/test/portrait-focus.mjs).
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { resolveSlideContext } from '@openpresentation/opf';
import { composeSlide, fitImage } from '@openpresentation/opf/composition';
import { toSvg } from '../dist/index.js';

// 60 x 120: red top (the head), blue bottom.
const portrait = await (async () => {
  const raw = Buffer.alloc(60 * 120 * 3);
  for (let y = 0; y < 120; y++) for (let x = 0; x < 60; x++) raw.set(y < 40 ? [220, 30, 30] : [30, 30, 220], (y * 60 + x) * 3);
  return `data:image/png;base64,${(await sharp(raw, { raw: { width: 60, height: 120, channels: 3 } }).png().toBuffer()).toString('base64')}`;
})();
const deckFor = (block = {}) => ({ slides: [{ title: 'Team', blocks: [{ type: 'image', image: { src: portrait, alt: 'Portrait' }, fit: 'cover', placement: { edge: 'top', size: 0.45 }, ...block }, { type: 'text', text: 'Body copy under the picture.' }] }] });
const imageItem = deck => composeSlide(deck.slides[0], resolveSlideContext(deck, 0, {}).options).items.find(item => item.field === 'image');
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) <= 0.01, `${label}: ${actual} vs ${expected}`);
// The nested <svg> viewport of a cropped picture and its <image>, as the preview draws them.
const attributes = tag => Object.fromEntries([...tag.matchAll(/([a-zA-Z:-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value]));
const drawn = deck => {
  const svg = toSvg(deck)[0];
  const match = /<svg ([^>]*overflow="hidden"[^>]*)><image ([^>]*preserveAspectRatio="none"[^>]*)\/?>/.exec(svg);
  if (!match) return undefined;
  const [viewport, image] = [attributes(match[1]), attributes(match[2])];
  return { viewport: ['x', 'y', 'width', 'height'].map(key => Number(viewport[key])), image: ['x', 'y', 'width', 'height'].map(key => Number(image[key])) };
};

{
  const deck = deckFor();
  const item = imageItem(deck), box = item.image.box;
  assert.deepEqual(item.image.focus, { x: 0.5, y: 0.3 });
  const placed = fitImage(box, 'cover', 0.5, item.image.focus).image;
  const result = drawn(deck);
  assert.ok(result, 'a portrait picture with a default focus is drawn from core\'s placement, not a centered slice');
  near(result.viewport[1], box.y, 'viewport y');
  near(result.image[1], placed.y - box.y, 'image offset: the top of the picture sits above the frame by core\'s crop');
  assert.ok(result.image[1] > -placed.height / 2 + box.height / 2 - 0.01 && result.image[1] < 0, 'less than half of the overflow is trimmed from the top');
  near(result.image[3], placed.height, 'image height');
}

// An authored center focus is the native centered slice (no nested viewport), exactly as before.
{
  const deck = deckFor({ focus: { x: 0.5, y: 0.5 } });
  assert.equal(drawn(deck), undefined);
  assert.match(toSvg(deck)[0], /preserveAspectRatio="xMidYMid slice"/);
}
// An authored focus is drawn at its own placement.
{
  const deck = deckFor({ focus: { x: 0.5, y: 0 } });
  const item = imageItem(deck), placed = fitImage(item.image.box, 'cover', 0.5, { x: 0.5, y: 0 }).image;
  near(drawn(deck).image[1], placed.y - item.image.box.y, 'focus y 0');
}
console.log('portrait focus: preview agrees with core');
