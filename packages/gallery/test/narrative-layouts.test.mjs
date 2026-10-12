import assert from 'node:assert/strict';
import {test} from 'node:test';
import {gallery} from '../dist/index.js';

test('every narrative beat names an existing v2 intent template', () => {
  let references = 0;
  for (const [id, narrative] of Object.entries(gallery.narratives)) {
    for (const beat of narrative.beats) {
      if (!beat.layout) continue;
      assert.ok(gallery.layouts[beat.layout]?.areas, `${id}/${beat.id}: ${beat.layout}`);
      references++;
    }
  }
  assert.equal(references, 344);
});

test('image templates preserve whole-picture fitting', () => {
  for (const id of ['image', 'image-beside']) assert.equal(gallery.layouts[id].design.imageFit, 'contain', id);
});
