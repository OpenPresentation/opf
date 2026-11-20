// SH-10: text in a large shape grows as a lone body block does (up the type scale, to a paragraph's display size, while it fits and fills
// at most LONE_TARGET of the text rectangle), never below the body size, and sibling shapes keep one size.
import test from 'node:test';
import assert from 'node:assert/strict';
import {LONE_DISPLAY_SIZES, LONE_TARGET, composeSlide} from '../dist/composition.js';

const options = {width: 1280, height: 720, scale: 1};
const shapes = composed => composed.items.filter(item => item.field === 'shape');
const height = text => text.lines.length * text.lineHeight;
const BODY = 28;

test('short text in a large shape grows past the body size, up to the display size, and fills at most LONE_TARGET', () => {
  const [shape] = shapes(composeSlide({title: 'One', blocks: [{shape: 'rect', text: 'Grow'}]}, options));
  assert.ok(shape.text.fontSize > BODY, `${shape.text.fontSize}`);
  assert.ok(shape.text.fontSize <= LONE_DISPLAY_SIZES.text + 1e-9);
  assert.ok(height(shape.text) <= LONE_TARGET * shape.shape.textBox.height + .5);
  assert.ok(!shape.text.overflow);
});

test('text that holds only the body size keeps it, and text that does not is fitted down as before', () => {
  const small = {title: 'Small', blocks: [{shape: 'rect', text: 'Fit', aspectRatio: 4}, {text: 'Context in a paragraph beside the shape.'}]};
  for (const shape of shapes(composeSlide(small, options))) assert.ok(shape.text.fontSize >= 16 - 1e-9);
  const long = 'A long sentence that cannot be set at the body size inside this small shape, so it is fitted down toward the floor. '.repeat(2);
  const [tight] = shapes(composeSlide({title: 'Long', blocks: [{shape: 'ellipse', text: long, aspectRatio: 1}, {text: 'x'}, {text: 'y'}, {text: 'z'}]}, options));
  assert.ok(tight.text.fontSize <= BODY + 1e-9, 'not grown');
});

test('sibling shapes share one size: the smallest any of them reached above the body size', () => {
  const composed = composeSlide({title: 'Siblings', blocks: [{shape: 'rect', text: 'A'}, {shape: 'rect', text: 'A much longer label for this one'}, {shape: 'rect', text: 'C'}]}, options);
  const sizes = new Set(shapes(composed).map(shape => shape.text.fontSize));
  assert.equal(sizes.size, 1, [...sizes].join(', '));
  assert.ok([...sizes][0] >= BODY - 1e-9);
  for (const shape of shapes(composed)) assert.ok(!shape.text.overflow);
});

test('overlay shapes grow and share one size too', () => {
  const composed = composeSlide({title: 'Overlays', text: 'Body', shapes: [{shape: 'rect', x: .1, y: .3, width: .35, height: .4, text: 'Plan'}, {shape: 'rect', x: .55, y: .3, width: .35, height: .4, text: 'Ship'}]}, options);
  const overlays = (composed.overlayShapes ?? []).filter(entry => entry.kind === 'shape');
  assert.equal(overlays.length, 2);
  assert.ok(overlays[0].text.fontSize > BODY);
  assert.equal(overlays[0].text.fontSize, overlays[1].text.fontSize);
});
