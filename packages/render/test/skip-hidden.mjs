// FA-08: toSvg can leave out hidden slides, as the player does; the default keeps one SVG per slide.
import assert from 'node:assert/strict';
import { toSvg } from '../dist/index.js';

const deck = {
  name: 'Skip hidden',
  slides: [
    { id: 'a', title: 'Shown one' },
    { id: 'b', title: 'Backup slide', hidden: true },
    { id: 'c', title: 'Shown two' },
    { id: 'd', title: 'Also hidden', hidden: true }
  ]
};

const all = toSvg(deck);
assert.equal(all.length, 4, 'by default every slide is rendered, hidden or not');
assert.deepEqual(toSvg(deck, { skipHidden: false }), all);

const visible = toSvg(deck, { skipHidden: true });
assert.equal(visible.length, 2);
assert.deepEqual(visible, [all[0], all[2]], 'the visible slides are byte-identical to their entries in the full deck');
assert.match(visible[0], /Shown one/);
assert.match(visible[1], /Shown two/);
assert.ok(!visible.join('').includes('Backup slide'), 'a hidden slide is not drawn');

// Single-slide rendering is unchanged: a hidden slide named by index still renders.
assert.equal(toSvg(deck, 2), all[1]);
assert.equal(toSvg(deck, 2, { skipHidden: true }), all[1], 'toSvg ignores skipHidden');

// A deck with no hidden slides is unaffected.
const plain = { slides: [{ title: 'One' }, { title: 'Two' }] };
assert.deepEqual(toSvg(plain, { skipHidden: true }), toSvg(plain));
assert.deepEqual(toSvg({ slides: [{ title: 'Only', hidden: true }] }, { skipHidden: true }), [], 'a deck of hidden slides gives an empty list');

console.log('Skip hidden: toSvg skipHidden leaves out hidden slides and changes nothing else.');
