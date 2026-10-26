import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';

// WI-3 (P12): a picture shown whole sits at its region's anchor (top by default) inside its cell and takes the picture's own
// frame, instead of being centered in a cell taller than it. Cover and stretch keep the whole cell.
const svg = (width, height) => `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#3f8a55"/></svg>`).toString('base64')}`;
const { layouts } = gallery;
const body = 'Keep a named owner from intake through the final decision. The owner collects the evidence, explains exceptions, and records what happens next.';
const near = (a, b, message) => assert.ok(Math.abs(a - b) <= 0.51, `${message ?? ''} ${a} vs ${b}`);
const columns = (anchor) => ({ name: 'Columns', direction: 'column', regions: [{ name: 'title' }, { direction: 'row', regions: ['first', 'second'].map((name) => ({ name, accepts: ['text', 'image', 'video'], role: 'primary', flow: 'none', ...(anchor ? { anchor } : {}) })) }], design: { imageFit: 'contain' } });

test('mixed image and text: the picture top equals the neighbouring text top', () => {
  const result = composeSlide({ title: 'Review visual context beside its explanation', blocks: [{ image: svg(1600, 1000) }, { text: body }] }, { layout: layouts['two-column'] });
  const image = result.items.find((item) => item.field === 'image'), text = result.items.find((item) => item.field === 'text');
  assert.equal(image.image.fit, 'contain');
  near(image.image.box.y, text.box.y, 'the frame starts at the cell top');
  near(image.image.box.y, image.box.y, 'the cell top');
  near(image.image.box.width / image.image.box.height, 1.6, 'the frame is the picture');
  near(image.image.box.width, image.box.width, 'the picture takes the cell width');
  assert.ok(image.image.box.height < image.box.height, 'a landscape picture is shorter than the cell');
  assert.deepEqual(image.image.picture.crop, { left: 0, top: 0, right: 0, bottom: 0 }, 'the whole picture, no crop or padding');
  assert.deepEqual(result.diagnostics, []);
});

test('the region anchor places the frame: middle centers it and bottom rests it on the cell', () => {
  const compose = (anchor) => {
    const result = composeSlide({ title: 'T', blocks: [{ image: svg(1600, 1000) }, { text: body }] }, { layout: columns(anchor) });
    return result.items.find((item) => item.field === 'image');
  };
  const top = compose(), middle = compose('middle'), bottom = compose('bottom');
  const spare = top.box.height - top.image.box.height;
  assert.ok(spare > 100);
  near(middle.image.box.y, top.image.box.y + spare / 2);
  near(bottom.image.box.y, top.image.box.y + spare);
  near(bottom.image.box.y + bottom.image.box.height, bottom.box.y + bottom.box.height);
});

test('a portrait picture in a wide cell keeps its frame centered across and at the top', () => {
  const result = composeSlide({ title: 'T', blocks: [{ image: svg(900, 1200) }, { text: body }] }, { layout: columns() });
  const image = result.items.find((item) => item.field === 'image');
  near(image.image.box.height, image.box.height, 'the frame fills the cell height');
  near(image.image.box.width / image.image.box.height, 0.75);
  near(image.image.box.x + image.image.box.width / 2, image.box.x + image.box.width / 2, 'centered across');
});

test('an explicit cover or stretch keeps the whole cell', () => {
  for (const fit of ['cover', 'stretch']) {
    const result = composeSlide({ title: 'T', blocks: [{ image: svg(1600, 1000), fit }, { text: body }] }, { layout: layouts['two-column'] });
    const image = result.items.find((item) => item.field === 'image');
    assert.equal(image.image.fit, fit);
    assert.deepEqual(image.image.box, image.box, fit);
  }
});

test('a layout without a contained default still crops: the engine default is cover', () => {
  const result = composeSlide({ title: 'T', blocks: [{ image: svg(1600, 1000) }, { image: svg(1600, 1000) }, { image: svg(1600, 1000) }] }, { layout: layouts.gallery });
  for (const image of result.items.filter((item) => item.field === 'image')) {
    assert.equal(image.image.fit, 'cover');
    assert.deepEqual(image.image.box, image.box);
  }
});

test('a frame the block shapes with aspectRatio stays centered whatever the fit', () => {
  const frame = (fit) => composeSlide({ title: 'T', blocks: [{ image: svg(1600, 1000), aspectRatio: 2, fit }, { text: body }] }, { layout: columns() }).items.find((item) => item.field === 'image');
  for (const fit of ['contain', 'cover']) {
    const item = frame(fit);
    near(item.image.box.y + item.image.box.height / 2, item.box.y + item.box.height / 2, fit);
  }
});

test('a caption closes up under a top-anchored frame', () => {
  const result = composeSlide({ title: 'T', blocks: [{ image: svg(1600, 1000), caption: 'Field context' }, { text: body }] }, { layout: columns() });
  const image = result.items.find((item) => item.field === 'image');
  assert.ok(image.caption, 'the block has a caption');
  const bottom = image.image.box.y + image.image.box.height;
  assert.ok(image.caption.box.y >= bottom - 0.01 && image.caption.box.y - bottom < 20, `${image.caption.box.y - bottom}`);
});

test('every composed picture still draws inside its cell', () => {
  const result = composeSlide({ title: 'T', blocks: [{ image: svg(1000, 1600) }, { image: svg(1600, 1000) }] }, { layout: columns('middle') });
  for (const item of result.items.filter((entry) => entry.field === 'image')) {
    assert.ok(item.image.box.x >= item.box.x - 0.51 && item.image.box.y >= item.box.y - 0.51);
    assert.ok(item.image.box.x + item.image.box.width <= item.box.x + item.box.width + 0.51);
    assert.ok(item.image.box.y + item.image.box.height <= item.box.y + item.box.height + 0.51);
  }
});
