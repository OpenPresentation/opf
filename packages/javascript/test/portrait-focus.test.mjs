// LH-84: a picture taller than wide, cover-cropped into a wider frame, keeps its heads: without an authored focus the crop
// sits at 30% of the picture's height, not at the center. An authored focus always wins; every other crop is centered.
// The crop arithmetic is core's fitImage, which render (SVG) and PPTX (a:srcRect) both read.
import assert from 'node:assert/strict';
import test from 'node:test';
import { composeSlide, defaultImageFocus, fitImage, PORTRAIT_FOCUS_Y } from '../dist/composition.js';

const svg = (width, height) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#ccc"/></svg>`)}`;
const portrait = svg(200, 400), landscape = svg(400, 200);
const wideLayout = { name: 'Wide picture', direction: 'column', regions: [{ name: 'title' }, { name: 'body', accepts: ['image'], role: 'primary', flow: 'none' }] };
const imageOf = (block, options = {}) => composeSlide({ title: 'Heading', blocks: [{ type: 'image', fit: 'cover', ...block }] }, { layout: wideLayout, ...options }).items.find(item => item.field === 'image').image;
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-4, `${label}: ${actual} vs ${expected}`);

test('a portrait picture cover-cropped into a wider frame defaults to focus y 0.3', () => {
  const image = imageOf({ image: portrait });
  assert.ok(image.box.width > image.box.height * 0.5, 'the frame is wider than the picture');
  assert.deepEqual(image.focus, { x: 0.5, y: PORTRAIT_FOCUS_Y });
  assert.equal(PORTRAIT_FOCUS_Y, 0.3);
  // The crop trims more from the bottom than the top, the sides stay whole, and the 30% line of the picture is the frame's center.
  const { crop } = image.picture;
  near(crop.left, 0, 'left'); near(crop.right, 0, 'right');
  assert.ok(crop.top > 0 && crop.bottom > crop.top, JSON.stringify(crop));
  const placed = image.picture.image;
  near(placed.y + 0.3 * placed.height, image.box.y + image.box.height / 2, 'the focus line is the frame center');
  // It is the same placement fitImage gives for the focus.
  assert.deepEqual(image.picture, fitImage(image.box, 'cover', 0.5, { x: 0.5, y: 0.3 }));
  assert.deepEqual(image.picture, fitImage(image.box, 'cover', 0.5), 'fitImage reads the default itself');
});

test('an authored focus wins, including the center', () => {
  const centered = imageOf({ image: portrait, focus: { x: 0.5, y: 0.5 } });
  assert.deepEqual(centered.focus, { x: 0.5, y: 0.5 });
  near(centered.picture.crop.top, centered.picture.crop.bottom, 'a centered crop trims both sides alike');
  const top = imageOf({ image: portrait, focus: { x: 0.5, y: 0 } });
  near(top.picture.crop.top, 0, 'focus y 0 keeps the top');
  assert.deepEqual(imageOf({ image: portrait, focus: { x: 0.2, y: 0.9 } }).focus, { x: 0.2, y: 0.9 });
});

test('other crops stay centered', () => {
  assert.deepEqual(imageOf({ image: landscape }).focus, { x: 0.5, y: 0.5 }, 'a landscape picture');
  assert.deepEqual(imageOf({ image: portrait, fit: 'contain' }).focus, { x: 0.5, y: 0.5 }, 'a contained picture');
  assert.deepEqual(imageOf({ image: portrait, fit: 'stretch' }).focus, { x: 0.5, y: 0.5 }, 'a stretched picture');
  assert.deepEqual(imageOf({ image: svg(300, 300) }).focus, { x: 0.5, y: 0.5 }, 'a square picture');
  // A portrait picture in a frame taller than itself crops the sides, not the top: centered.
  assert.deepEqual(defaultImageFocus({ x: 0, y: 0, width: 100, height: 400 }, 'cover', 0.5), { x: 0.5, y: 0.5 });
  assert.deepEqual(defaultImageFocus({ x: 0, y: 0, width: 100, height: 100 }, 'cover', 0.5), { x: 0.5, y: 0.3 }, 'a square frame crops the top and bottom');
  assert.deepEqual(defaultImageFocus({ x: 0, y: 0, width: 100, height: 200 }, 'cover', 0.5), { x: 0.5, y: 0.5 }, 'the same shape: nothing to crop');
});

test('a circular headshot crop keeps the head: the portrait picture in a round frame', () => {
  const image = imageOf({ image: portrait, shape: 'ellipse', aspectRatio: 1 });
  assert.equal(image.shape.preset, 'ellipse');
  assert.deepEqual(image.focus, { x: 0.5, y: 0.3 });
});

test('a portrait picture as a cover background keeps its heads too, and an authored focus wins', () => {
  const background = (extra = {}) => composeSlide({ title: 'Heading', blocks: [{ type: 'text', text: 'Body' }], design: { background: { type: 'image', src: portrait, fit: 'cover', ...extra } } }).backgroundImage;
  assert.deepEqual(background().focus, { x: 0.5, y: 0.3 });
  assert.deepEqual(background({ focus: { x: 0.5, y: 0.5 } }).focus, { x: 0.5, y: 0.5 });
  assert.deepEqual(background({ fit: 'contain' }).focus, { x: 0.5, y: 0.5 });
});
