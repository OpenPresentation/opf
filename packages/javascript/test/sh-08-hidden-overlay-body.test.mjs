import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide, overlaysDrawBody } from '../dist/composition.js';

test('a hidden overlay cannot turn a cover into a content slide or move its heading', () => {
  const overlay = { x: 0.1, y: 0.1, width: 0.8, height: 0.8, shape: 'ellipse', hidden: true };
  assert.equal(overlaysDrawBody([overlay]), false);
  const title = slide => composeSlide(slide).items.find(item => item.field === 'title').box;
  assert.deepEqual(title({ title: 'A cover', shapes: [overlay] }), title({ title: 'A cover' }));
  assert.equal(overlaysDrawBody([{ ...overlay, hidden: false }]), true);
});
