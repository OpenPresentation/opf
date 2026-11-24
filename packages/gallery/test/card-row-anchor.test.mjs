// The pillars and team layouts set a card's content in the middle of its card. Their records said `anchor: "bottom"`, so the
// content of a row of labeled cards (a heading and its text) stood low in the cards, a short text beside pictures sat alone at
// a card's foot, and the display words of short pillars sat under the middle of the body (0.35.1 and before).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '@openpresentation/opf/composition';
import { gallery } from '../dist/index.js';

const compose = (id, slide) => composeSlide(slide, { width: 1280, height: 720, layout: gallery.layouts[id], fill: false });
const bottomOf = (box) => box.y + box.height;
const picture = { src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNjAgMTAwIj48cmVjdCB3aWR0aD0iMTYwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzdhYTdlNiIvPjwvc3ZnPg==', alt: 'A landscape' };
const labeled = (text, description) => ({ items: [{ text, description }] });

for (const id of ['pillars', 'team']) {
  test(`${id}: the record anchors its cards' content in the middle, not at the foot`, () => {
    assert.equal(gallery.layouts[id].anchor, 'middle');
    for (const region of gallery.layouts[id].regions) assert.ok(!region.anchor || region.anchor === 'middle', region.name ?? 'split');
  });
  test(`${id}: a row of labeled cards shares one line and stands in the middle of the cards`, () => {
    const result = compose(id, { title: 'Owners', blocks: [labeled('Ana Ruiz', 'Pilot lead'), labeled('Sam Lee', 'Product lead\nTurns participant feedback into product changes.'), labeled('Kai Moreau', 'Analytics lead')] });
    assert.equal(result.diagnostics.length, 0);
    const carded = result.items.filter((item) => item.frameBox && item.field !== 'title');
    assert.equal(carded.length, 3);
    assert.equal(new Set(carded.map((item) => item.box.y)).size, 1, 'the cards share one line');
    for (const item of carded) {
      const above = item.box.y - item.frameBox.y, below = bottomOf(item.frameBox) - bottomOf(item.box);
      assert.ok(above <= below + 14, `${item.path}: the content does not stand low in its card (${above} above, ${below} below)`);
    }
  });
}

test('pillars: a short text between pictures sits in the middle of its card, not at its foot', () => {
  const result = compose('pillars', { title: 'Pillars', blocks: [{ image: picture }, { text: 'Two teams and one workflow.' }, { image: picture }] });
  const text = result.items.find((item) => item.field === 'text' && item.frameBox);
  assert.ok(text, 'the text is on a card');
  const above = text.box.y - text.frameBox.y, below = bottomOf(text.frameBox) - bottomOf(text.box);
  assert.ok(Math.abs(above - below) <= 14, `centered in its card (${above} above, ${below} below)`);
});
