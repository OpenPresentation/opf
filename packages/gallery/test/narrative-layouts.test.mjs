import assert from 'node:assert/strict';
import {test} from 'node:test';
import {gallery} from '../dist/index.js';

test('every narrative beat names an existing v2 intent template', () => {
  let references = 0;
  for (const [id, narrative] of Object.entries(gallery.narratives)) {
    for (const beat of narrative.beats) {
      if (!beat.layout) continue;
      assert.ok(Array.isArray(gallery.layouts[beat.layout]?.regions), `${id}/${beat.id}: ${beat.layout}`);
      references++;
    }
  }
  assert.equal(references, 362);
});

test('image templates preserve whole-picture fitting', () => {
  // LH-104: the image layout covers only a near-fitting picture (auto) and shows any other whole; image-beside keeps contain.
  assert.equal(gallery.layouts.image.design.imageFit, 'auto');
  assert.equal(gallery.layouts['image-beside'].design.imageFit, 'contain');
});
