import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import {layouts} from './support/catalog.mjs';

// FA-16: no bundled layout record is bare. Each states when to reach for it, what it holds and how it is tagged, and
// points at the SVG the gallery publishes for it.
describe('bundled layout records are described', () => {
  test('every record has a summary, a description, tags and a vector preview', () => {
    assert.equal(layouts.length, 30, 'the full v2 gallery catalog');
    for (const record of layouts) {
      assert.ok(record.summary?.trim(), `${record.id}: summary`);
      assert.ok(record.description?.trim(), `${record.id}: description`);
      assert.ok(Array.isArray(record.tags) && record.tags.length > 0, `${record.id}: tags`);
      assert.equal(record.preview?.vectorSrc, `https://www.pptx.gallery/layout-previews/${record.id}.svg`, `${record.id}: preview`);
    }
  });

  test('a design is stated only where the gallery layout data states one', () => {
    // Owner decision (FA-24): the image grid layouts show the whole picture.
    for (const id of ['image']) assert.deepEqual(layouts.find(record => record.id === id).design, {imageFit: 'contain'}, id);
    // FA-22: a full-bleed photo is a background, not a layout; no record reserves a slide image any more.
    assert.equal(layouts.find(record => record.id === 'image-bleed'), undefined);
    assert.ok(layouts.every(record => record.design?.slideImage === undefined && record.design?.imageFill === undefined));
  });
});
