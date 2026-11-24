// IM1: a lone picture the `image` layout shows whole (not cropped to cover its bled cell), or one with a caption, keeps the cell inside the
// margins and above the footer, in the middle of it, and its caption starts at the picture's edge right under it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';
import { layouts } from './support/template-samples.mjs';

const svg = (width, height) => `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#3f8a55"/></svg>`).toString('base64')}`;
const footer = { footer: { start: { text: 'Illustrative example' } } };
const near = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;

test('IM1: a panorama shown whole sits in the middle of the body, inside the margins', () => {
  const result = composeSlide({ title: 'Give the visual room to speak', blocks: [{ image: { src: svg(3000, 1000), alt: 'A wide panorama' } }], design: footer }, { layout: layouts.image });
  const picture = result.items.find((item) => item.field === 'image'), box = picture.image?.box ?? picture.box, body = result.regions.find((region) => region.name === 'media').box;
  assert.ok(box.x >= result.contentBox.x - 0.5 && box.x + box.width <= result.contentBox.x + result.contentBox.width + 0.5, 'inside the margins');
  assert.ok(near(box.y - body.y, body.y + body.height - (box.y + box.height), 2), 'in the middle of the body');
});

test('IM1: a captioned picture keeps above the footer, its caption at its edge', () => {
  const result = composeSlide({ title: 'Give the visual room to speak', blocks: [{ image: { src: svg(1600, 1000), alt: 'Boxes' }, caption: 'Before: loose boxes, tape and paper' }], design: footer }, { layout: layouts.image });
  const picture = result.items.find((item) => item.field === 'image'), box = picture.image?.box ?? picture.box, caption = picture.caption.box;
  const footerTop = Math.min(...result.furniture.parts.map((part) => part.box.y));
  assert.ok(caption.y + caption.height <= footerTop + 0.5, 'the caption is above the footer');
  assert.ok(near(caption.x, box.x), 'the caption starts at the picture edge');
  assert.ok(caption.y >= box.y + box.height - 0.5 && caption.y - (box.y + box.height) < 20, 'right under the picture');
});
