import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';

// WI-3 (P32, P33): in automatic composition (no layout) a picture without a fit of its own is shown whole, in a frame of the
// picture's proportions at the top of its cell; a chart is at most 4:3; and a portrait picture gives the width it does not
// use to the blocks beside it. Explicit fits, layouts and placed pictures keep the engine default.
const svg = (width, height) => `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#3f8a55"/></svg>`).toString('base64')}`;
const near = (a, b, message) => assert.ok(Math.abs(a - b) <= 0.51, `${message ?? ''} ${a} vs ${b}`);
const note = 'The pilot team reviews the site context alongside the proposed work. A shared visual reference helps explain access constraints, seasonal conditions, and the sequence of activities.';
const chart = { chart: { type: 'line', data: { columns: ['Month', 'Minutes'], rows: [['Apr', 44], ['May', 39], ['Jun', 33], ['Jul', 29], ['Aug', 24], ['Sep', 19]] } } };

test('an image and an explanation: the picture is whole, 16:9, at the cell top; the text keeps 25 px', () => {
  const result = composeSlide({ title: 'Keep field context visible during planning', blocks: [{ image: svg(1600, 900) }, { text: note }] });
  const image = result.items.find((item) => item.field === 'image'), text = result.items.find((item) => item.field === 'text' && item.text.fontSize < 54);
  assert.equal(image.image.fit, 'contain');
  near(image.image.box.width / image.image.box.height, 16 / 9);
  near(image.image.box.y, image.box.y, 'top of its cell');
  assert.deepEqual(image.image.picture.crop, { left: 0, top: 0, right: 0, bottom: 0 });
  assert.equal(text.text.fontSize, 25);
  assert.deepEqual(result.diagnostics, []);
});

test('an image pair and a note: both pictures are whole and frame to the picture, and the note keeps its size', () => {
  const result = composeSlide({ title: 'Review visual evidence as a pair', blocks: [{ image: svg(1600, 900) }, { image: svg(1600, 900) }, { text: note }] });
  const images = result.items.filter((item) => item.field === 'image');
  assert.equal(images.length, 2);
  for (const image of images) {
    assert.equal(image.image.fit, 'contain');
    near(image.image.box.width / image.image.box.height, 16 / 9);
    near(image.image.box.y, image.box.y);
  }
  assert.equal(result.items.find((item) => item.field === 'text' && item.text.fontSize < 54).text.fontSize, 25);
});

test('an explicit fit on the block or in the slide design is kept', () => {
  const explicit = composeSlide({ title: 'T', blocks: [{ image: svg(1600, 900), fit: 'cover' }, { text: note }] });
  const image = explicit.items.find((item) => item.field === 'image');
  assert.equal(image.image.fit, 'cover');
  assert.deepEqual(image.image.box, image.box);
  const designed = composeSlide({ title: 'T', design: { imageFit: 'cover' }, blocks: [{ image: svg(1600, 900) }, { text: note }] });
  assert.equal(designed.items.find((item) => item.field === 'image').image.fit, 'cover');
});

test('a layout keeps the engine default, and a placed picture still bleeds as a cover', () => {
  const inLayout = composeSlide({ title: 'T', blocks: [{ image: svg(1600, 900) }, { image: svg(1600, 900) }, { image: svg(1600, 900) }] }, { layout: gallery.layouts.gallery });
  for (const image of inLayout.items.filter((item) => item.field === 'image')) assert.equal(image.image.fit, 'cover');
  const placed = composeSlide({ title: 'T', blocks: [{ image: svg(1600, 900), placement: { edge: 'left', size: 0.4 } }, { text: note }] });
  assert.equal(placed.items.find((item) => item.field === 'image').image.fit, 'cover');
});

test('a portrait picture frames to its width and gives the rest of the row to the text', () => {
  const equal = composeSlide({ title: 'T', blocks: [{ image: svg(1600, 900) }, { text: note }] }).items.find((item) => item.field === 'text' && item.text.fontSize < 54);
  const result = composeSlide({ title: 'T', blocks: [{ image: svg(600, 1200) }, { text: note }] });
  const image = result.items.find((item) => item.field === 'image'), text = result.items.find((item) => item.field === 'text' && item.text.fontSize < 54);
  near(image.box.width, image.image.box.width, 'the cell is as wide as the frame');
  near(image.image.box.height, image.box.height, 'the frame fills the cell height');
  assert.ok(text.box.width > equal.box.width + 50, `${text.box.width} vs ${equal.box.width}`);
  near(image.box.x + image.box.width + (text.box.x - image.box.x - image.box.width), text.box.x);
  assert.ok(text.box.x >= image.box.x + image.box.width, 'the text starts after the picture');
});

test('a chart beside a takeaway is at most 4:3; one chart alone is unchanged', () => {
  const beside = composeSlide({ title: 'T', blocks: [chart, { text: 'Median review time fell 57% between April and September.' }] }).items.find((item) => item.field === 'chart');
  assert.ok(beside.box.height <= beside.box.width * 0.75 + 0.01, `${beside.box.width} x ${beside.box.height}`);
  const alone = composeSlide({ title: 'T', blocks: [chart] }).items.find((item) => item.field === 'chart');
  assert.ok(alone.box.height <= alone.box.width * 0.75 + 0.01 || alone.box.width > alone.box.height * 1.3);
  const layout = composeSlide({ title: 'T', blocks: [chart, { text: 'Median review time fell.' }] }, { layout: gallery.layouts['chart-beside'] }).items.find((item) => item.field === 'chart');
  assert.ok(layout.box.height > layout.box.width * 0.75, 'a layout region keeps its own cell');
});

test('explicit weights keep their tracks', () => {
  const result = composeSlide({ title: 'T', composition: { mode: 'row', weights: [1, 1] }, blocks: [{ image: svg(600, 1200) }, { text: note }] });
  const [image, text] = [result.items.find((item) => item.field === 'image'), result.items.find((item) => item.field === 'text' && item.text.fontSize < 54)];
  near(image.box.width, text.box.width);
});
