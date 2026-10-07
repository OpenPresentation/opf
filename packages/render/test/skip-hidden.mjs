// FA-08: renderSvg can leave out hidden slides, as the player does; the default keeps one SVG per slide.
import assert from 'node:assert/strict';
import { renderSvg, renderSlideSvg } from '../dist/index.js';

const deck = {
  name: 'Skip hidden',
  slides: [
    { id: 'a', title: 'Shown one' },
    { id: 'b', title: 'Backup slide', hidden: true },
    { id: 'c', title: 'Shown two' },
    { id: 'd', title: 'Also hidden', hidden: true }
  ]
};

const all = renderSvg(deck);
assert.equal(all.length, 4, 'by default every slide is rendered, hidden or not');
assert.deepEqual(renderSvg(deck, { skipHidden: false }), all);

const visible = renderSvg(deck, { skipHidden: true });
assert.equal(visible.length, 2);
assert.deepEqual(visible, [all[0], all[2]], 'the visible slides are byte-identical to their entries in the full deck');
assert.match(visible[0], /Shown one/);
assert.match(visible[1], /Shown two/);
assert.ok(!visible.join('').includes('Backup slide'), 'a hidden slide is not drawn');

// Single-slide rendering is unchanged: a hidden slide named by index still renders.
assert.equal(renderSlideSvg(deck, 1), all[1]);
assert.equal(renderSlideSvg(deck, 1, { skipHidden: true }), all[1], 'renderSlideSvg ignores skipHidden');

// A deck with no hidden slides is unaffected.
const plain = { slides: [{ title: 'One' }, { title: 'Two' }] };
assert.deepEqual(renderSvg(plain, { skipHidden: true }), renderSvg(plain));
assert.deepEqual(renderSvg({ slides: [{ title: 'Only', hidden: true }] }, { skipHidden: true }), [], 'a deck of hidden slides gives an empty list');

console.log('Skip hidden: renderSvg skipHidden leaves out hidden slides and changes nothing else.');
