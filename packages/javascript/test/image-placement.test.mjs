import assert from 'node:assert/strict';
import test from 'node:test';
import { composeSlide } from '../dist/composition.js';
import { check, errorsOf } from './support/validation.mjs';

// FA-22: placement bleeds a top-level image block to one slide edge; headings and the other content compose in the
// rest of the slide at the normal padding. It is the only mechanism that moves content aside.

const photo = 'data:image/png;base64,iVBORw0KGgo=';
const padding = 0.08 * 720;
const overlaps = (a, b) => a.x < b.x + b.width - 1e-6 && a.x + a.width > b.x + 1e-6 && a.y < b.y + b.height - 1e-6 && a.y + a.height > b.y + 1e-6;
const within = (box, area) => box.x >= area.x - 1e-6 && box.y >= area.y - 1e-6 && box.x + box.width <= area.x + area.width + 1e-6 && box.y + box.height <= area.y + area.height + 1e-6;
const deck = (slides) => ({ $schema: 'https://openpresentation.org/schema/opf/v1', name: 'Placement', slides });
const placed = (placement, extra = {}) => ({ type: 'image', image: { src: photo, alt: 'Shipping routes' }, placement, ...extra });

test('left 0.45: the image bleeds to the left, top and bottom edges; title and text compose in the remaining 55% at normal padding', () => {
  const result = composeSlide({ title: 'Where we ship', blocks: [placed({ edge: 'left', size: 0.45 }), { type: 'text', text: 'Twelve ports, three continents' }] });
  const image = result.items.find((item) => item.field === 'image');
  assert.deepEqual(image.box, { x: 0, y: 0, width: 576, height: 720 });
  assert.deepEqual(image.image.region, image.box);
  assert.deepEqual(image.image.box, image.box, 'edge to edge');
  assert.deepEqual(image.image.placement, { edge: 'left', size: 0.45, inset: false, path: 'slides.0.blocks.0.placement' });
  const title = result.items.find((item) => item.field === 'title'), text = result.items.find((item) => item.field === 'text');
  assert.equal(title.box.x, 576 + padding);
  assert.equal(title.box.y, padding);
  assert.equal(title.box.width, 1280 - 576 - 2 * padding);
  assert.equal(result.contentBox.x, 576 + padding);
  assert.ok(within(text.box, { x: 576 + padding, y: 0, width: 1280 - 576 - 2 * padding, height: 720 - padding }));
  // Placed items follow the headings and come before the flowed body.
  assert.deepEqual(result.items.map((item) => item.field), ['title', 'image', 'text']);
});

test('each edge takes its band and leaves the rest of the slide to the content', () => {
  for (const [edge, region] of Object.entries({
    left: { x: 0, y: 0, width: 640, height: 720 }, right: { x: 640, y: 0, width: 640, height: 720 },
    top: { x: 0, y: 0, width: 1280, height: 360 }, bottom: { x: 0, y: 360, width: 1280, height: 360 },
  })) {
    const result = composeSlide({ title: 'Heading', blocks: [{ text: 'Body' }, placed({ edge })] });
    const image = result.items.find((item) => item.field === 'image');
    assert.deepEqual(image.box, region, edge);
    for (const item of result.items) if (item !== image) assert.equal(overlaps(item.box, region), false, `${edge} ${item.field}`);
    assert.equal(overlaps(result.contentBox, region), false, edge);
  }
});

test('inset frames the image inside the slide padding of its band; treatments apply inside the frame', () => {
  const image = composeSlide({ title: 'Heading', blocks: [placed({ edge: 'right', inset: true }, { aspectRatio: 0.5, shape: 'rounded', border: { color: 'dark1', width: 12 } })] }).items.find((item) => item.field === 'image').image;
  assert.deepEqual(image.region, { x: 640, y: 0, width: 640, height: 720 });
  assert.equal(image.box.height, 720 - 2 * padding);
  assert.equal(image.box.width, (720 - 2 * padding) * 0.5);
  assert.equal(image.box.x + image.box.width / 2, 960);
  assert.equal(image.shape.preset, 'roundRect');
  assert.equal(image.border.width, 12);
});

test('bands are taken in block order; a second block on a used edge flows as content', () => {
  const result = composeSlide({ title: 'Heading', blocks: [placed({ edge: 'left', size: 0.4 }), placed({ edge: 'top', size: 0.3 }), placed({ edge: 'left' }), { text: 'Body' }] });
  const images = result.items.filter((item) => item.field === 'image');
  assert.deepEqual(images[0].box, { x: 0, y: 0, width: 512, height: 720 });
  assert.deepEqual(images[1].box, { x: 512, y: 0, width: 768, height: 216 });
  assert.equal(images[2].image.placement, undefined, 'the second left block is not placed');
  assert.ok(within(images[2].box, result.contentBox));
  assert.equal(result.contentBox.x, 512 + padding);
});

test('a right-to-left deck mirrors placement: left is the start side, drawn at the right', () => {
  const image = composeSlide({ title: 'Heading', blocks: [placed({ edge: 'left', size: 0.4 }), { text: 'Body' }] }, { direction: 'rtl' }).items.find((item) => item.field === 'image');
  assert.equal(image.image.placement.edge, 'right');
  assert.deepEqual(image.box, { x: 768, y: 0, width: 512, height: 720 });
});

test('a layout image placeholder may carry the placement for the slide\'s image', () => {
  const layout = { id: 'image-left', placeholders: [{ type: 'title' }, { type: 'image', placement: { edge: 'left', size: 0.4 } }, { type: 'text' }] };
  const root = composeSlide({ title: 'Heading', image: photo, text: 'Body' }, { layout });
  const image = root.items.find((item) => item.field === 'image');
  assert.deepEqual(image.box, { x: 0, y: 0, width: 512, height: 720 });
  assert.equal(image.path, 'slides.0.image');
  assert.equal(image.image.placement.path, 'layout.placeholders.1.placement');
  // A block's own placement wins over the placeholder's.
  const own = composeSlide({ title: 'Heading', blocks: [placed({ edge: 'right' }), { text: 'Body' }] }, { layout });
  assert.equal(own.items.find((item) => item.field === 'image').image.placement.edge, 'right');
  // The placed image's slot is not reserved in the flow: the text takes the whole content box.
  const text = root.items.find((item) => item.field === 'text');
  assert.equal(text.box.width, root.contentBox.width);
  // Validation: placement only on image placeholders.
  assert.equal(check({ $schema: 'https://openpresentation.org/schema/opf/v1', name: 'L', catalogs: { custom: { layouts: { 'image-left': { name: 'Image left', placeholders: layout.placeholders } } } }, slides: [{ layout: 'image-left', title: 'T', image: photo }] }).valid, true);
});

test('a slide whose only body is placed images is composed like a cover: its headings center in the free area', () => {
  const result = composeSlide({ title: 'Heading', subtitle: 'Sub', blocks: [placed({ edge: 'left', size: 0.46 })] });
  const title = result.items.find((item) => item.field === 'title');
  assert.equal(title.box.x, 588.8 + padding);
  assert.ok(title.box.y > 200, 'centered vertically');
  // With other body content the headings stay at the top.
  const content = composeSlide({ title: 'Heading', blocks: [placed({ edge: 'left', size: 0.46 }), { text: 'Body' }] });
  assert.equal(content.items.find((item) => item.field === 'title').box.y, padding);
});

test('a caption of a placed block sits inside its band', () => {
  const result = composeSlide({ title: 'Heading', blocks: [placed({ edge: 'left', inset: true }, { caption: 'Routes in 2026' }), { text: 'Body' }] });
  const image = result.items.find((item) => item.field === 'image');
  assert.ok(image.caption);
  assert.ok(within(image.caption.box, image.box));
  assert.ok(image.image.box.y + image.image.box.height <= image.caption.box.y + 1e-6);
});

test('validation: two blocks on the same edge, a placed block inside a group or a region, and placement on a non-image block are errors', () => {
  assert.equal(check(deck([{ title: 'T', blocks: [placed({ edge: 'left' }), placed({ edge: 'right' }), { text: 'Body' }] }])).valid, true);
  const twice = errorsOf(check(deck([{ title: 'T', blocks: [placed({ edge: 'left' }), placed({ edge: 'left', size: 0.3 })] }])));
  assert.deepEqual(twice.map((f) => [f.ruleId, f.path]), [['opf/image-placement-invalid', '/slides/0/blocks/1/placement/edge']]);
  const grouped = errorsOf(check(deck([{ title: 'T', blocks: [{ blocks: [placed({ edge: 'left' }), { text: 'Body' }] }] }])));
  assert.deepEqual(grouped.map((f) => [f.ruleId, f.path]), [['opf/image-placement-invalid', '/slides/0/blocks/0/blocks/0/placement']]);
  const region = errorsOf(check(deck([{ title: 'T', left: placed({ edge: 'left' }), right: { text: 'Body' } }])));
  assert.deepEqual(region.map((f) => [f.ruleId, f.path]), [['opf/image-placement-invalid', '/slides/0/left/placement']]);
  const text = errorsOf(check(deck([{ title: 'T', blocks: [{ text: 'Body', placement: { edge: 'left' } }] }])));
  assert.deepEqual(text.map((f) => [f.ruleId, f.path]), [['opf/image-option-unsupported-payload', '/slides/0/blocks/0/placement']]);
});
