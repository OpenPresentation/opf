// A short list composes alike whether it is written as `bullets` or `items`: a block of bullets groups as the list it draws, never as a
// paragraph of no length (which paired every two of them as LH-58's long + short paragraphs and drew them small at the top).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide, groupingNode } from '../dist/composition.js';

const boxes = (result) => result.items.filter((item) => item.field === 'bullets' || item.field === 'items').map((item) => [Math.round(item.box.x), Math.round(item.box.y), Math.round(item.box.width), Math.round(item.box.height), item.text.fontSize]);

test('four one-word bullets blocks compose as the same points written as items', () => {
  for (const words of [['Reviews', 'Handoffs', 'Owners', 'Queue'], ['Faster reviews', 'Fewer handoffs', 'Clear owners', 'One queue']]) {
    const bullets = composeSlide({ title: 'Four points', blocks: words.map((word) => ({ bullets: [word] })) }, {});
    const items = composeSlide({ title: 'Four points', blocks: words.map((word) => ({ items: [word] })) }, {});
    assert.deepEqual(boxes(bullets), boxes(items));
  }
});

test('a block of bullets alone is a list to block grouping; bullets under a text stay with the text', () => {
  assert.deepEqual(groupingNode({ kind: 'text', value: { bullets: ['One'] } }), { kind: 'list' });
  assert.equal(groupingNode({ kind: 'text', value: { text: 'Lead', bullets: ['One'] } }).kind, 'text');
});
