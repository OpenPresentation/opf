// LH-99: `continuationPages` maps the export's continuation (LH-90) back to the source slides, so a host that draws slide by slide
// keeps addressing source slides and steps through a continued slide's pages as sub-steps: no source index shifts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { continuationPages, continueOverfull } from '../dist/index.js';

const catalogs = [gallery];
const timeline = (index) => ({ timeline: { name: `Workstream ${index + 1} execution path`, description: `Major milestones for workstream ${index + 1}.`, events: [
  { when: 'May', what: 'Baseline', description: 'Confirm current state, owners, and constraints.' },
  { when: 'Jun', what: 'Pilot', description: 'Run a narrow pilot with visible success criteria.' },
  { when: 'Jul', what: 'Scale', description: 'Expand the approach after risk review.' },
  { when: 'Aug', what: 'Embed', description: 'Move reporting and routines into steady-state operations.' },
] } });
const timelines = (id, count) => ({ id, layout: 'process', title: 'Execution paths for the next cycle', blocks: Array.from({ length: count }, (_, index) => timeline(index)) });

test('each source slide maps to the output slides that draw it, in order', () => {
  const deck = { slides: [{ id: 'intro', title: 'Plan' }, timelines('a', 8), { id: 'mid', title: 'Between' }, timelines('b', 8), { id: 'close', title: 'Next steps' }] };
  const result = continueOverfull(deck, { catalogs });
  assert.equal(result.presentation.slides.length, 7);
  const pages = continuationPages(result, deck.slides.length);
  assert.deepEqual(pages, [[0], [1, 2], [3], [4, 5], [6]]);
  // Every output slide is drawn by exactly one source slide, and each page carries its source slide's id (or its continuation id).
  assert.deepEqual(pages.flat(), [0, 1, 2, 3, 4, 5, 6]);
  pages.forEach((outputs, index) => outputs.forEach((output, page) => assert.equal(result.presentation.slides[output].id, page ? `${deck.slides[index].id}--${page + 1}` : deck.slides[index].id)));
});

test('a deck that does not continue maps each slide to itself', () => {
  const deck = { slides: [{ id: 'a', title: 'One' }, timelines('fits', 2), { id: 'c', title: 'Three' }] };
  const result = continueOverfull(deck, { catalogs });
  assert.deepEqual(result.continued, []);
  assert.deepEqual(continuationPages(result, 3), [[0], [1], [2]]);
  assert.deepEqual(continuationPages({ continued: [] }, 0), []);
  assert.throws(() => continuationPages(result, -1), RangeError);
  assert.throws(() => continuationPages(result, 1.5), RangeError);
});
