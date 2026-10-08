import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import {layouts} from './support/catalog.mjs';

// FA-16: no bundled layout record is bare. Each states when to reach for it, what it holds and how it is tagged, and
// points at the SVG the gallery publishes for it.
describe('bundled layout records are described', () => {
  test('every record has a summary, a description, tags and a vector preview', () => {
    assert.ok(layouts.length >= 100);
    for (const record of layouts) {
      assert.ok(record.summary?.trim(), `${record.id}: summary`);
      assert.ok(record.description?.trim(), `${record.id}: description`);
      assert.ok(Array.isArray(record.tags) && record.tags.length > 0, `${record.id}: tags`);
      assert.equal(record.preview?.vectorSrc, `https://www.pptx.gallery/layout-previews/${record.id}.svg`, `${record.id}: preview`);
    }
  });

  test('a design is stated only where the gallery layout data states one', () => {
    const designed = new Set(['chart-1x', 'chart-2x', 'chart-3x', 'list-1x', 'list-2x', 'list-3x', 'list-4x', 'list-5x', 'list-6x', 'number-1x', 'number-2x', 'number-3x', 'number-4x', 'number-5x', 'number-6x']);
    const was = new Set(['blank', 'title', 'title-subtitle', 'text-1x', 'text-2x', 'text-3x', 'code-1x', 'image-1x', 'image-2x', 'image-3x', 'media-1x', 'quote-1x', 'table-1x', 'timeline-1x']);
    for (const record of layouts) {
      if (designed.has(record.id)) assert.equal(record.design?.contentAlignment, 'center', record.id);
      if (was.has(record.id)) assert.equal(record.design, undefined, record.id);
    }
    // RR-58: image-bleed reserves a full-bleed background slide image; its title keeps the normal padding.
    assert.deepEqual(layouts.find(record => record.id === 'image-bleed').design, {slideImage: {position: 'background'}});
  });
});
