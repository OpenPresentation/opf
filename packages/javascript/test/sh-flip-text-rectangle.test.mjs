// RR-105: PowerPoint flips a shape's text rectangle with its geometry (the glyphs stay upright), so a flipped shape with an asymmetric
// text rectangle (rtTriangle, homePlate) places its text in the mirrored rectangle; an unflipped shape is unchanged.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';

const shapeOf = (block) => composeSlide({ title: 'Flip', blocks: [block] }, { presentation: { name: 'Flip', language: 'en-US', slides: [{ title: 'Flip', blocks: [block] }] } }).items.find((item) => item.field === 'shape').shape;
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.02, `${a} vs ${b}`);

for (const preset of ['rtTriangle', 'homePlate']) {
  test(`${preset}: flip mirrors the text rectangle about the frame center`, () => {
    const plain = shapeOf({ shape: preset, text: 'flip' });
    const { box } = plain, own = plain.textRect;
    assert.notEqual(Math.round(own.x - box.x), Math.round(box.width - (own.x - box.x) - own.width), 'the preset text rectangle is asymmetric horizontally');
    const h = shapeOf({ shape: preset, text: 'flip', flip: 'horizontal' });
    near(h.textRect.x - box.x, box.width - (own.x - box.x) - own.width);
    near(h.textRect.y, own.y); near(h.textRect.width, own.width); near(h.textRect.height, own.height);
    assert.ok(h.textBox.x > plain.textBox.x - 1e-6 && Math.abs(h.textBox.x - plain.textBox.x) > 1);
    assert.equal(h.flipH, true);
    const v = shapeOf({ shape: preset, text: 'flip', flip: 'vertical' });
    near(v.textRect.x, own.x);
    near(v.textRect.y - box.y, box.height - (own.y - box.y) - own.height);
    const both = shapeOf({ shape: preset, text: 'flip', flip: 'both' });
    near(both.textRect.x - box.x, box.width - (own.x - box.x) - own.width);
    near(both.textRect.y - box.y, box.height - (own.y - box.y) - own.height);
  });
}

test('an unflipped shape keeps the preset text rectangle', () => {
  const a = shapeOf({ shape: 'rtTriangle', text: 'x' }), b = shapeOf({ shape: 'rtTriangle', text: 'x', flip: 'none' });
  assert.deepEqual(a.textRect, b.textRect);
});
