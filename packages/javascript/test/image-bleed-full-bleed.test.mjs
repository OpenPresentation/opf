import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide} from '../dist/composition.js';
import {resolveSlideContext} from '../dist/index.js';
import {layouts} from '../dist/catalogs.js';

// RR-58: image-bleed draws its picture full-bleed behind the slide, and the title keeps the normal slide padding. The record
// reserves a background slide image (design.slideImage.position); a slide names its picture as its slide image (the same
// source as its image), so the picture fills the canvas edge to edge and is not laid out as padded content.
const src = 'data:image/png;base64,iVBORw0KGgo=';
const image = {src, alt: 'Full-bleed photograph'};
const full = {x: 0, y: 0, width: 1280, height: 720};
const deck = slide => ({$schema: 'https://openpresentation.org/schema/opf/v1', name: 'Bleed', slides: [slide]});
const compose = presentation => {
  const context = resolveSlideContext(presentation, 0);
  assert.deepEqual(context.diagnostics, []);
  return composeSlide(presentation.slides[0], {...context.options, width: 1280, height: 720});
};

test('the bundled image-bleed record reserves a background slide image and keeps the default padding', () => {
  const record = layouts.find(layout => layout.id === 'image-bleed');
  assert.deepEqual(record.design, {slideImage: {position: 'background'}});
  assert.deepEqual(record.placeholders.map(placeholder => placeholder.type), ['title', 'image']);
  assert.equal(record.composition, undefined);
});

test('an image-bleed slide draws its picture at 0,0,1280,720 and its title at the normal padding', () => {
  const bleed = compose(deck({id: 's1', layout: 'image-bleed', title: 'Field Context', image, design: {slideImage: src}}));
  assert.deepEqual(bleed.slideImage?.box, full);
  assert.equal(bleed.slideImage.position, 'background');
  assert.equal(bleed.slideImage.replacesContent, true);
  assert.equal(bleed.items.some(item => item.field === 'image'), false, 'the picture is the slide image, not padded content');
  assert.deepEqual(bleed.diagnostics, []);
  // The title sits exactly where a padded content layout puts it (image-1x, the same slide without a slide image).
  const padded = compose(deck({id: 's1', layout: 'image-1x', title: 'Field Context', image}));
  const title = geometry => geometry.items.find(item => item.field === 'title')?.box;
  assert.ok(title(bleed));
  assert.deepEqual(title(bleed), title(padded));
  assert.equal(title(bleed).x, 0.08 * 720);
  assert.equal(title(bleed).y, 0.08 * 720);
});

test('a slide that does not name a slide image keeps its picture as padded content', () => {
  const plain = compose(deck({id: 's1', layout: 'image-bleed', title: 'Field Context', image}));
  assert.equal(plain.slideImage, undefined);
  const picture = plain.items.find(item => item.field === 'image');
  assert.ok(picture && picture.box.x >= 0.08 * 720);
});
