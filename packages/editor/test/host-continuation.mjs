// LH-99: the editor's view of the export's continuation (LH-90). `continuationOf` maps each source slide to the pages the export draws it
// on, never changes the deck, and is reused while the slides that can continue are unchanged; the slide manager draws a continued slide
// as one card at its own index. The browser behavior (thumbnails, canvas preview, presenter steps) is in host-continuation-browser.mjs.
import assert from 'node:assert/strict';
import { gallery } from '@openpresentation/gallery';
import { clearContinuations, continuationOf, pageCount } from '../src/continuation.js';

const catalogs = [gallery];
const timeline = (index) => ({ timeline: { name: `Workstream ${index + 1} execution path`, description: `Major milestones for workstream ${index + 1}.`, events: [
  { when: 'May', what: 'Baseline', description: 'Confirm current state, owners, and constraints.' },
  { when: 'Jun', what: 'Pilot', description: 'Run a narrow pilot with visible success criteria.' },
  { when: 'Jul', what: 'Scale', description: 'Expand the approach after risk review.' },
  { when: 'Aug', what: 'Embed', description: 'Move reporting and routines into steady-state operations.' },
] } });
const deck = { name: 'Plan', slides: [
  { id: 'intro', title: 'Plan' },
  { id: 'plan', layout: 'process', title: 'Execution paths', blocks: Array.from({ length: 8 }, (_, index) => timeline(index)) },
  { id: 'close', title: 'Next steps' },
] };
const before = JSON.stringify(deck);

const continuation = continuationOf(deck, { catalogs });
assert.ok(continuation, 'the eight timelines continue');
assert.deepEqual(continuation.pages, [[0], [1, 2], [3]], 'each source slide keeps its index; the continued one has two pages');
assert.deepEqual([0, 1, 2].map((index) => pageCount(continuation, index)), [1, 2, 1]);
assert.equal(pageCount(null, 1), 1, 'no continuation: one page');
assert.equal(JSON.stringify(deck), before, 'the deck is not changed');

// Reused while the slides that can continue are unchanged: an edit to another slide asks nothing new.
const edited = { ...deck, slides: [{ ...deck.slides[0], title: 'Plan, edited' }, deck.slides[1], deck.slides[2]] };
assert.equal(continuationOf(edited, { catalogs }), continuation, 'an edit to a slide that cannot continue reuses the answer');
assert.notEqual(continuationOf(edited, { catalogs, exact: true }), continuation, 'exact asks for this very deck');
const fewer = { ...deck, slides: [deck.slides[0], { ...deck.slides[1], blocks: deck.slides[1].blocks.slice(0, 2) }, deck.slides[2]] };
assert.equal(continuationOf(fewer, { catalogs }), null, 'two timelines fit: nothing continues');
assert.equal(continuationOf({ slides: [{ title: 'Only text' }] }, { catalogs }), null, 'a deck without block units is not split');

// Faces still loading: nothing is split and nothing is kept, so the answer comes once the faces are in.
clearContinuations();
let pending = ['Roboto 400'];
const fonts = { pending: () => pending };
assert.equal(continuationOf(deck, { catalogs, fonts }), null);
pending = [];
assert.deepEqual(continuationOf(deck, { catalogs, fonts })?.pages, [[0], [1, 2], [3]]);
console.log('LH-99 editor continuation ok');
