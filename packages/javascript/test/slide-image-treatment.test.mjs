import assert from 'node:assert/strict';
import test from 'node:test';
import { composeSlide, slideImageShape } from '../dist/composition.js';
import { validatePresentation } from '../dist/index.js';

const photo = 'data:image/png;base64,iVBORw0KGgo=';
const compose = (treatment, options = {}) => composeSlide({ title: 'Heading', text: 'Body', design: { slideImage: { src: photo, ...treatment } } }, options);
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-5, `${label}: ${actual} vs ${expected}`);

test('size, inset and aspect ratio shape the frame inside its band', () => {
  const wide = compose({ position: 'top', size: 0.62 });
  assert.deepEqual(wide.slideImage.region, { x: 0, y: 0, width: 1280, height: 446.4 });
  assert.ok(wide.items.every(item => item.box.y >= 446.4));
  const card = compose({ position: 'background', inset: true });
  assert.deepEqual(card.slideImage.box, { x: 57.6, y: 57.6, width: 1164.8, height: 604.8 });
  const letterbox = compose({ position: 'background', aspectRatio: 2.39 });
  near(letterbox.slideImage.box.width, 1280, 'letterbox width');
  near(letterbox.slideImage.box.width / letterbox.slideImage.box.height, 2.39, 'letterbox ratio');
  near(letterbox.slideImage.box.y + letterbox.slideImage.box.height / 2, 360, 'letterbox centered');
  const phone = compose({ position: 'right', inset: true, aspectRatio: 0.5 });
  near(phone.slideImage.box.height, 604.8, 'phone height');
  near(phone.slideImage.box.width, 302.4, 'phone width');
  near(phone.slideImage.box.x + phone.slideImage.box.width / 2, 960, 'phone centered in the right band');
  // circle always uses a square frame
  const circle = compose({ position: 'left', inset: true, shape: 'circle', aspectRatio: 3 });
  assert.equal(circle.slideImage.box.width, circle.slideImage.box.height);
  assert.equal(circle.slideImage.shape.preset, 'ellipse');
});

test('shape outlines follow the DrawingML preset formulas', () => {
  const box = { x: 10, y: 20, width: 300, height: 200 };
  assert.deepEqual(slideImageShape('rectangle', box), { kind: 'rectangle', preset: 'rect', adjust: {}, path: 'M10 20H310V220H10Z' });
  // roundRect: radius = min(w,h) * adj / 100000, circular arcs.
  const rounded = slideImageShape('rounded', box);
  assert.deepEqual(rounded.adjust, { adj: 16667 });
  assert.equal(rounded.path, 'M10 53.334A33.334 33.334 0 0 1 43.334 20H276.666A33.334 33.334 0 0 1 310 53.334V186.666A33.334 33.334 0 0 1 276.666 220H43.334A33.334 33.334 0 0 1 10 186.666Z');
  assert.deepEqual(slideImageShape('rounded', box, 0.25).adjust, { adj: 25000 });
  assert.equal(slideImageShape('rounded', box, 0).path, 'M10 20H310V220H10Z');
  assert.equal(slideImageShape('circle', { x: 0, y: 0, width: 100, height: 100 }).path, 'M0 50A50 50 0 1 1 100 50A50 50 0 1 1 0 50Z');
  // hexagon (adj 25000, vf 115470): x1 = ss*adj/100000, dy1 = h/2 * vf/100000 * sin 60.
  const hexagon = slideImageShape('hexagon', { x: 0, y: 0, width: 100, height: 100 });
  assert.deepEqual(hexagon.adjust, { adj: 25000, vf: 115470 });
  const points = [...hexagon.path.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(match => [Number(match[1]), Number(match[2])]);
  const dy1 = 50 * 1.1547 * Math.sin(Math.PI / 3);
  for (const [actual, expected] of points.map((point, index) => [point, [[0, 50], [25, 50 - dy1], [75, 50 - dy1], [100, 50], [75, 50 + dy1], [25, 50 + dy1]][index]])) {
    near(actual[0], expected[0], 'hexagon x'); near(actual[1], expected[1], 'hexagon y');
  }
});

test('border, opacity, recolor and overlay are normalized for both engines', () => {
  const result = compose({ position: 'right', shape: 'rounded', cornerRadius: 0.1, border: { color: 'dark1', width: 12 }, opacity: 0.4,
    recolor: { dark: 'accent1', light: '#FFFFFF' }, overlay: { color: '#000000', opacity: 0.55 }, alt: 'Harbor' }, { width: 1920, height: 1080 });
  const image = result.slideImage;
  assert.deepEqual(image.border, { color: 'dark1', width: 18 });
  assert.equal(image.opacity, 0.4);
  assert.deepEqual(image.recolor, { type: 'duotone', dark: 'accent1', light: '#FFFFFF' });
  assert.equal(image.alt, 'Harbor');
  assert.deepEqual(image.overlay, { color: '#000000', opacity: 0.55, box: image.box, shape: image.shape });
  assert.deepEqual(compose({ position: 'background', recolor: 'grayscale' }).slideImage.recolor, { type: 'grayscale' });
  assert.equal(compose({ position: 'background', opacity: 1, border: { color: 'dark1', width: 0 } }).slideImage.opacity, undefined);
  assert.equal(compose({ position: 'background', border: { color: 'dark1', width: 0 } }).slideImage.border, undefined);
  const caption = compose({ position: 'background', inset: true, overlay: { color: 'dark1', opacity: 0.75, edge: 'bottom', size: 0.25 } }).slideImage;
  assert.deepEqual(caption.overlay.box, { x: 57.6, y: 511.2, width: 1164.8, height: 151.2 });
  assert.equal(caption.overlay.shape.preset, 'rect');
});

test('edge overlays on masked frames are reported, not drawn, and never fail strict layout', () => {
  const slide = { title: 'Heading', composition: { overflow: 'error' }, design: { slideImage: { src: photo, position: 'left', shape: 'circle', overlay: { color: '#000000', opacity: 0.5, edge: 'bottom' } } } };
  const result = composeSlide(slide);
  assert.equal(result.slideImage.overlay, undefined);
  assert.deepEqual(result.diagnostics.map(d => [d.code, d.path]), [['unsupported-image-treatment', 'slides.0.design.slideImage.overlay.edge']]);
});

test('the treatment vocabulary validates and rejects unsupported effects', () => {
  const deck = slideImage => ({ $schema: 'https://openpresentation.org/schema/opf/v1', name: 'Treatments', slides: [{ title: 'Heading', design: { slideImage } }] });
  assert.equal(validatePresentation(deck({ src: photo, position: 'right', alt: 'Harbor', fill: 'fit', size: 0.46, inset: true, aspectRatio: 0.5, shape: 'rounded', cornerRadius: 0.12,
    border: { color: 'dark1', width: 12 }, opacity: 0.8, recolor: { dark: 'accent1', light: 'light1' }, overlay: { color: 'text', opacity: 0.2, edge: 'bottom', size: 0.3 } })).valid, true);
  assert.equal(validatePresentation(deck({ src: photo, position: 'background', recolor: 'grayscale' })).valid, true);
  for (const invalid of [{ blur: 8 }, { shadow: true }, { shape: 'star' }, { recolor: 'sepia' }, { size: 0.95 }, { opacity: 2 }, { border: { color: 'dark1' } }])
    assert.equal(validatePresentation(deck({ src: photo, position: 'background', ...invalid })).valid, false, JSON.stringify(invalid));
});
