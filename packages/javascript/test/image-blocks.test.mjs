import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { composeSlide, imageShape } from '../dist/composition.js';
import { resolveSlideContext } from '../dist/index.js';
import { check, errorsOf } from './support/validation.mjs';

// FA-22: every content picture is an image block. It carries fit and focus and the treatment vocabulary of 0.14's slide
// image (shape, cornerRadius, border, opacity, recolor, overlay, aspectRatio); composeSlide reports the resolved picture
// geometry as ComposedItem.image, computed by the same code 0.14 used for the slide image.

const photo = 'data:image/png;base64,iVBORw0KGgo=';
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-5, `${label}: ${actual} vs ${expected}`);
const imageOf = (geometry) => geometry.items.find((item) => item.field === 'image');
const compose = (block, options = {}, slide = {}) => composeSlide({ title: 'Heading', blocks: [{ type: 'image', image: photo, ...block }], ...slide }, options);
const deck = (slides, design) => ({ $schema: 'https://openpresentation.org/schema/opf/v1', name: 'Images', ...(design ? { design } : {}), slides });

test('every image item carries its picture geometry; an untreated block draws in its cell', () => {
  const item = imageOf(compose({}));
  assert.deepEqual(item.image.region, item.box);
  assert.deepEqual(item.image.box, item.box);
  assert.equal(item.image.fit, 'cover');
  assert.deepEqual(item.image.focus, { x: 0.5, y: 0.5 });
  assert.equal(item.image.shape.preset, 'rect');
  for (const key of ['border', 'opacity', 'recolor', 'overlay', 'placement']) assert.equal(item.image[key], undefined, key);
  // Slide.image is shorthand for one image block, and region payloads carry the same geometry.
  assert.equal(imageOf(composeSlide({ title: 'Heading', image: photo })).image.fit, 'cover');
  assert.ok(imageOf(composeSlide({ title: 'Heading', left: { image: photo, shape: 'circle' }, right: { text: 'Body' } })).image.shape.preset === 'ellipse');
  // The payload reports the block's own options for editors.
  assert.deepEqual(imageOf(compose({ fit: 'contain', shape: 'rounded' })).payload, { type: 'image', image: photo, fit: 'contain', shape: 'rounded' });
});

test('fit: the block, then design.imageFit of the slide, the deck and the layout, then cover', () => {
  const fit = (block, slide, presentation, layout) => imageOf(compose(block, { ...(presentation ? { presentation: { design: presentation } } : {}), ...(layout ? { layout: { design: layout } } : {}) }, slide ? { design: slide } : {})).image.fit;
  assert.equal(fit({}), 'cover');
  assert.equal(fit({}, undefined, undefined, { imageFit: 'contain' }), 'contain');
  assert.equal(fit({}, undefined, { imageFit: 'stretch' }, { imageFit: 'contain' }), 'stretch');
  assert.equal(fit({}, { imageFit: 'cover' }, { imageFit: 'stretch' }), 'cover');
  assert.equal(fit({ fit: 'contain' }, { imageFit: 'cover' }), 'contain');
  assert.equal(fit({ fit: 'nonsense' }), 'cover');
});

test('aspect ratio and circle shape the frame inside the region', () => {
  const letterbox = imageOf(compose({ aspectRatio: 2.39 })).image;
  near(letterbox.box.width / letterbox.box.height, 2.39, 'letterbox ratio');
  near(letterbox.box.x + letterbox.box.width / 2, letterbox.region.x + letterbox.region.width / 2, 'centered');
  near(letterbox.box.y + letterbox.box.height / 2, letterbox.region.y + letterbox.region.height / 2, 'centered');
  const circle = imageOf(compose({ shape: 'circle', aspectRatio: 3 })).image;
  assert.equal(circle.box.width, circle.box.height);
  assert.equal(circle.shape.preset, 'ellipse');
});

test('shape outlines follow the DrawingML preset formulas', () => {
  const box = { x: 10, y: 20, width: 300, height: 200 };
  assert.deepEqual(imageShape('rectangle', box), { kind: 'rectangle', preset: 'rect', adjust: {}, path: 'M10 20H310V220H10Z' });
  // roundRect: radius = min(w,h) * adj / 100000, circular arcs.
  const rounded = imageShape('rounded', box);
  assert.deepEqual(rounded.adjust, { adj: 16667 });
  assert.equal(rounded.path, 'M10 53.334A33.334 33.334 0 0 1 43.334 20H276.666A33.334 33.334 0 0 1 310 53.334V186.666A33.334 33.334 0 0 1 276.666 220H43.334A33.334 33.334 0 0 1 10 186.666Z');
  assert.deepEqual(imageShape('rounded', box, 0.25).adjust, { adj: 25000 });
  assert.equal(imageShape('rounded', box, 0).path, 'M10 20H310V220H10Z');
  assert.equal(imageShape('circle', { x: 0, y: 0, width: 100, height: 100 }).path, 'M0 50A50 50 0 1 1 100 50A50 50 0 1 1 0 50Z');
  // hexagon (adj 25000, vf 115470): x1 = ss*adj/100000, dy1 = h/2 * vf/100000 * sin 60.
  const hexagon = imageShape('hexagon', { x: 0, y: 0, width: 100, height: 100 });
  assert.deepEqual(hexagon.adjust, { adj: 25000, vf: 115470 });
  const points = [...hexagon.path.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((match) => [Number(match[1]), Number(match[2])]);
  const dy1 = 50 * 1.1547 * Math.sin(Math.PI / 3);
  for (const [actual, expected] of points.map((point, index) => [point, [[0, 50], [25, 50 - dy1], [75, 50 - dy1], [100, 50], [75, 50 + dy1], [25, 50 + dy1]][index]])) {
    near(actual[0], expected[0], 'hexagon x'); near(actual[1], expected[1], 'hexagon y');
  }
});

test('border, opacity, recolor and overlay are normalized for both engines', () => {
  const image = imageOf(compose({ shape: 'rounded', cornerRadius: 0.1, border: { color: 'dark1', width: 12 }, opacity: 0.4,
    recolor: { dark: 'accent1', light: '#FFFFFF' }, overlay: { color: '#000000', opacity: 0.55 } }, { width: 1920, height: 1080 })).image;
  assert.deepEqual(image.border, { color: 'dark1', width: 18 });
  assert.equal(image.opacity, 0.4);
  assert.deepEqual(image.recolor, { type: 'duotone', dark: 'accent1', light: '#FFFFFF' });
  assert.deepEqual(image.overlay, { path: 'slides.0.blocks.0.overlay', color: '#000000', opacity: 0.55, box: image.box, shape: image.shape });
  assert.deepEqual(imageOf(compose({ recolor: 'grayscale' })).image.recolor, { type: 'grayscale' });
  assert.equal(imageOf(compose({ opacity: 1, border: { color: 'dark1', width: 0 } })).image.opacity, undefined);
  assert.equal(imageOf(compose({ border: { color: 'dark1', width: 0 } })).image.border, undefined);
  const caption = imageOf(compose({ overlay: { color: 'dark1', opacity: 0.75, edge: 'bottom', size: 0.25 } })).image;
  assert.equal(caption.overlay.edge, 'bottom');
  near(caption.overlay.box.height, caption.box.height * 0.25, 'band height');
  near(caption.overlay.box.y + caption.overlay.box.height, caption.box.y + caption.box.height, 'band at the bottom');
  assert.equal(caption.overlay.shape.preset, 'rect');
});

test('edge overlays on masked frames are reported, not drawn, and never fail strict layout', () => {
  const result = composeSlide({ title: 'Heading', composition: { overflow: 'error' }, blocks: [{ image: photo, shape: 'circle', overlay: { color: '#000000', opacity: 0.5, edge: 'bottom' } }] });
  assert.equal(imageOf(result).image.overlay, undefined);
  assert.deepEqual(result.diagnostics.map((d) => [d.code, d.path]), [['unsupported-image-treatment', 'slides.0.blocks.0.overlay.edge']]);
});

test('the treatment vocabulary validates on image payloads and is refused elsewhere', () => {
  const block = { type: 'image', image: photo, fit: 'contain', focus: { x: 0.2, y: 0.8 }, aspectRatio: 0.5, shape: 'rounded', cornerRadius: 0.12, border: { color: 'dark1', width: 12 }, opacity: 0.8,
    recolor: { dark: 'accent1', light: 'light1' }, overlay: { color: 'text', opacity: 0.2, edge: 'bottom', size: 0.3 }, placement: { edge: 'right', size: 0.4, inset: true } };
  assert.equal(check(deck([{ title: 'Heading', blocks: [block] }])).valid, true);
  for (const invalid of [{ blur: 8 }, { shadow: true }, { shape: 'star' }, { recolor: 'sepia' }, { fit: 'tile' }, { fit: 'crop' }, { opacity: 2 }, { border: { color: 'dark1' } }, { placement: { edge: 'middle' } }, { placement: { edge: 'left', size: 0.95 } }])
    assert.equal(check(deck([{ title: 'Heading', blocks: [{ image: photo, ...invalid }] }])).valid, false, JSON.stringify(invalid));
  // Image options on a text block or a group: opf/image-option-unsupported-payload at the option.
  const text = check(deck([{ title: 'Heading', blocks: [{ text: 'Body', fit: 'cover' }] }]));
  assert.deepEqual(errorsOf(text).map((f) => [f.ruleId, f.path]), [['opf/image-option-unsupported-payload', '/slides/0/blocks/0/fit']]);
  const group = check(deck([{ title: 'Heading', blocks: [{ blocks: [{ image: photo }], shape: 'circle' }] }]));
  assert.deepEqual(errorsOf(group).map((f) => [f.ruleId, f.path]), [['opf/image-option-unsupported-payload', '/slides/0/blocks/0/shape']]);
  // The root of a slide has no treatment keys: use a block.
  assert.equal(check(deck([{ title: 'Heading', image: photo, shape: 'circle' }])).valid, false);
});

// The 15 pptx.gallery image treatments (docs/fixtures/image-treatments.opf.json) against core 0.14's frozen picture goldens.
const fixture = JSON.parse(readFileSync(new URL('../../../docs/fixtures/image-treatments.opf.json', import.meta.url), 'utf8'));
const golden = JSON.parse(readFileSync(new URL('./fixtures/image-treatments-0.14.json', import.meta.url), 'utf8')).treatments;
const composeTreatment = (slide, override = {}) => {
  const index = fixture.slides.indexOf(slide);
  const presentation = { ...fixture, slides: fixture.slides.map((entry, at) => (at === index ? { ...entry, ...override } : entry)) };
  const context = resolveSlideContext(presentation, index);
  return composeSlide(presentation.slides[index], context.options);
};
const frameOf = (image) => ({ fit: image.fit, box: image.box, shape: image.shape, ...(image.border ? { border: image.border } : {}), ...(image.opacity !== undefined ? { opacity: image.opacity } : {}),
  ...(image.recolor ? { recolor: image.recolor } : {}), ...(image.overlay ? { overlay: { color: image.overlay.color, opacity: image.overlay.opacity, box: image.overlay.box, shape: image.overlay.shape } } : {}) });

test('the fixture holds the 15 gallery treatments, all valid 0.15 documents', () => {
  assert.equal(fixture.slides.length, 15);
  assert.deepEqual(fixture.slides.map((slide) => slide.id), Object.keys(golden));
  assert.deepEqual(errorsOf(check(fixture)), []);
});

test('backgrounds: full-bleed, text-overlay, background-blur and duotone keep 0.14 frames, recolor, overlays and headings', () => {
  for (const id of ['full-bleed', 'text-overlay', 'background-blur', 'duotone']) {
    const geometry = composeTreatment(fixture.slides.find((slide) => slide.id === id));
    const expected = golden[id];
    assert.deepEqual(geometry.backgroundImage.box, expected.box, id);
    assert.equal(geometry.backgroundImage.fit, expected.fit, id);
    const overlay = geometry.backgroundImage.overlay;
    assert.deepEqual(overlay && { color: overlay.color, opacity: overlay.opacity, box: overlay.box, shape: overlay.shape }, expected.overlay, id);
    assert.deepEqual(geometry.backgroundImage.recolor, expected.recolor, `${id} recolor`);
    assert.equal(geometry.items.some((item) => item.field === 'image'), false, `${id}: no content picture`);
    assert.deepEqual(geometry.items.filter((item) => item.field !== 'image').map((item) => item.box), expected.headings, `${id} headings`);
  }
});

test('placed image blocks: side-by-side, masked-shape, circular-crop, image-strip, device-frame and cutout-subject keep 0.14 frames, treatments and headings', () => {
  for (const id of ['side-by-side', 'masked-shape', 'circular-crop', 'image-strip', 'device-frame', 'cutout-subject']) {
    const geometry = composeTreatment(fixture.slides.find((slide) => slide.id === id));
    const item = imageOf(geometry), expected = golden[id];
    assert.equal(item.image.placement.edge, expected.position, id);
    assert.deepEqual(item.image.region, expected.region, `${id} region`);
    const { position, region, headings, ...frame } = expected;
    assert.deepEqual(frameOf(item.image), frame, `${id} frame`);
    assert.deepEqual(geometry.items.filter((entry) => entry.field !== 'image').map((entry) => entry.box), headings, `${id} headings`);
  }
});

test('frame treatments behind 0.14 headings (caption-overlay, rounded-card, watermark, cinematic-crop) compose the same frame as an image block filling the content area', () => {
  // A background has no inset, shape, border or aspect ratio, so these four are content image blocks. With no
  // headings, the content area is exactly 0.14's frame region: the slide inside the default padding for an inset
  // treatment, the whole slide with composition.padding 0 otherwise. The treatment code then gives 0.14's frames.
  for (const id of ['caption-overlay', 'rounded-card', 'watermark', 'cinematic-crop']) {
    const slide = fixture.slides.find((entry) => entry.id === id);
    const expected = golden[id];
    const inset = expected.region.width !== expected.box.width && expected.box.x === 57.6;
    const geometry = composeTreatment(slide, { title: undefined, subtitle: undefined, ...(inset ? {} : { composition: { padding: 0 } }) });
    const item = imageOf(geometry);
    const { position, region, headings, ...frame } = expected;
    assert.deepEqual(frameOf(item.image), frame, id);
    // With its headings, the block composes below them like any content picture.
    const titled = imageOf(composeTreatment(slide));
    assert.ok(titled.image.box.y > 100, `${id} sits in the content area`);
  }
});

test('collage-grid: four image blocks in a two-column grid, cropped to cover', () => {
  const geometry = composeTreatment(fixture.slides.find((slide) => slide.id === 'collage-grid'));
  const images = geometry.items.filter((item) => item.field === 'image');
  assert.deepEqual(images.map((item) => item.box), golden['collage-grid'].items);
  assert.ok(images.every((item) => item.image.fit === 'cover'));
});
