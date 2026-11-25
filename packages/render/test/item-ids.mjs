import assert from 'node:assert/strict';
import { toSvg } from './catalog-harness.mjs'; // registers the gallery snapshot (the documents name gallery records)

// FR-02 (CR 6): an id on a list item, bullet, timeline event or table row is identity, not content. A deck draws the same SVG with its ids
// as without them, whichever form (array row or `{ id, cells }`) carries a row, and the ids are never drawn.

const plain = () => ({
  design: { fontScheme: 'roboto' },
  slides: [
    { title: 'Items', items: ['Signed the pilot', { text: 'Expanded to EMEA', description: 'Two new accounts' }, 'Hired a lead'] },
    { title: 'Bullets', bullets: ['One', { text: 'Two', level: 1 }, 'Three'] },
    { title: 'Timeline', timeline: [{ when: 'Q1', what: 'Pilot', status: 'done' }, { when: 'Q2', what: 'Rollout', status: 'current' }, { when: 'Q3', what: 'Scale', status: 'planned' }] },
    { title: 'Table', table: { columns: ['Region', 'Revenue'], rows: [['EMEA', 8.2], ['APAC', 5.1], ['Americas', 12.4]] } },
  ],
});

const withIds = () => {
  const deck = plain();
  deck.slides[0].items = deck.slides[0].items.map((item, index) => ({ ...(typeof item === 'string' ? { text: item } : item), id: `ITEMID-${index}` }));
  deck.slides[1].bullets = deck.slides[1].bullets.map((item, index) => ({ ...(typeof item === 'string' ? { text: item } : item), id: `BULLETID-${index}` }));
  deck.slides[2].timeline = deck.slides[2].timeline.map((event, index) => ({ id: `EVENTID-${index}`, ...event }));
  deck.slides[3].table.rows = deck.slides[3].table.rows.map((cells, index) => (index === 1 ? cells : { id: `ROWID-${index}`, cells }));
  return deck;
};

for (let slide = 0; slide < 4; slide += 1) {
  const only = (deck) => ({ ...deck, slides: [deck.slides[slide]] });
  const before = toSvg(only(plain()), 1);
  const after = toSvg(only(withIds()), 1);
  assert.equal(after, before, `slide ${slide + 1} draws the same with ids`);
  assert.doesNotMatch(after, /ITEMID|BULLETID|EVENTID|ROWID/, `slide ${slide + 1} never draws an id`);
}
console.log('item-ids ok');
