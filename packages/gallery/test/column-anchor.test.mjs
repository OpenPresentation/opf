// The two column layouts set a column's content in the middle of its box. A short block (a few words, a picture, a chart beside
// text) used to sit at the foot of a full-height box, alone at the bottom of an empty card (0.35.0, `anchor: "bottom"`).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '@openpresentation/opf/composition';
import { gallery } from '../dist/index.js';

const compose = (id, slide) => composeSlide(slide, { width: 1280, height: 720, layout: gallery.layouts[id], fill: false });
const bottomOf = (box) => box.y + box.height;
const picture = { src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNjAgMTAwIj48cmVjdCB3aWR0aD0iMTYwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzdhYTdlNiIvPjwvc3ZnPg==', alt: 'A landscape' };
const CASES = {
  'one short statement among fuller columns': [
    { items: [{ text: 'Left column', description: 'Pinned to the first column.' }, { text: 'Second item', description: 'Stays inside the first column.' }] },
    { text: 'Centered rich runs' },
    { bullets: ['Right bullets A', 'Right bullets B with a longer line to test wrapping inside the narrow band'] },
  ],
  'short text beside a picture': [{ image: picture }, { text: 'Weekly feedback and one named owner.' }, { text: 'Expand only on clear evidence.' }],
  'short text beside a chart': [
    { chart: { type: 'column', data: { columns: ['Week', 'Completion'], rows: [['1', 0.68], ['2', 0.72], ['3', 0.84]] } } },
    { text: 'Weekly feedback and one named owner.' }, { text: 'Expand only on clear evidence.' },
  ],
};

for (const [id, columns] of [['two-column', 2], ['three-column', 3]]) {
  test(`${id}: the record anchors its columns in the middle, not at the foot`, () => {
    assert.equal(gallery.layouts[id].anchor, 'middle');
    for (const region of gallery.layouts[id].regions.flatMap((entry) => entry.regions ?? [])) assert.ok(!region.anchor || region.anchor === 'middle', region.name);
  });
  for (const [name, blocks] of Object.entries(CASES)) {
    test(`${id}: ${name} sits in the middle of its box, none at the foot`, () => {
      const result = compose(id, { title: 'Columns', blocks: blocks.slice(0, columns).map((block, index) => ({ region: ['first', 'second', 'third'][index], ...block })) });
      assert.equal(result.diagnostics.length, 0);
      const carded = result.items.filter((item) => item.frameBox && item.field !== 'title');
      assert.equal(carded.length, columns, 'every block is in a box');
      assert.equal(new Set(carded.map((item) => item.frameBox.y)).size, 1, 'the boxes share a top edge');
      assert.equal(new Set(carded.map((item) => item.frameBox.height)).size, 1, 'the boxes share a height');
      for (const item of carded) {
        const above = item.box.y - item.frameBox.y, below = bottomOf(item.frameBox) - bottomOf(item.box);
        assert.ok(Math.abs(above - below) <= 14, `${item.path}: the content is centered in its box, not at the foot (${above} above, ${below} below)`);
      }
    });
  }
}
