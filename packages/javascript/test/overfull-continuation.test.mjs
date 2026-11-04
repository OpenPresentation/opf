// LH-90: a slide of sibling blocks of one kind (each with the blocks that follow it) that overflows at its readability floor
// continues on further slides, split between whole blocks (`continueOverfull`, `paginateSlide` with `wholeBlocks`). The export
// draws that deck by default, so the preview and the PPTX show readable pages instead of overlapping bands.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { blockUnits, continueOverfull, OPFPaginationError, paginateSlide, resolveSlideContext } from '../dist/index.js';
import { composeSlide, OPFCompositionError } from '../dist/composition.js';

const catalogs = [gallery];
const overflow = (result) => result.diagnostics.filter((entry) => entry.code === 'text-overflow' || entry.code === 'small-cell');
const timeline = (index) => ({ timeline: { name: `Workstream ${index + 1} execution path`, description: `Major milestones for workstream ${index + 1}.`, events: [
  { when: 'May', what: 'Baseline', description: 'Confirm current state, owners, and constraints.' },
  { when: 'Jun', what: 'Pilot', description: 'Run a narrow pilot with visible success criteria.' },
  { when: 'Jul', what: 'Scale', description: 'Expand the approach after risk review.' },
  { when: 'Aug', what: 'Embed', description: 'Move reporting and routines into steady-state operations.' },
] } });
const timelines = (count, extra = {}) => ({ id: 'plan', layout: 'process', title: 'Execution paths for the next cycle', notes: 'Walk through each path.', blocks: Array.from({ length: count }, (_, index) => timeline(index)), ...extra });
const composed = (deck, index) => { const context = resolveSlideContext(deck, index, { catalogs }); return composeSlide(context.slide, context.options); };
/** The source blocks of every page, in order: each block once, never split. */
const pageBlocks = (deck) => deck.slides.flatMap((slide) => slide.blocks);

test('eight overlapping timelines continue on two slides of four whole timelines', () => {
  const deck = { name: 'Plan', slides: [{ id: 'intro', title: 'Plan' }, timelines(8), { id: 'close', title: 'Next steps' }] };
  assert.ok(overflow(composed(deck, 1)).length > 0, 'the slide overflows at its floor');
  const result = continueOverfull(deck, { catalogs });
  assert.equal(result.layout, 'estimated');
  assert.equal(result.presentation.slides.length, 4);
  assert.equal(result.continued.length, 1);
  const [continued] = result.continued;
  assert.equal(continued.sourceSlideIndex, 1);
  assert.deepEqual(continued.slideIndices, [1, 2]);
  assert.equal(continued.kind, 'timeline');
  assert.deepEqual(continued.units, [4, 4], 'spread evenly');
  assert.deepEqual(continued.blocks, [[0, 1, 2, 3], [4, 5, 6, 7]]);
  const pages = result.presentation.slides.slice(1, 3);
  assert.deepEqual(pageBlocks({ slides: pages }), deck.slides[1].blocks, 'every timeline once, whole, in order');
  // Pagination's convention: the headings and layout repeat, the notes stay on the first page, the ids stay unique.
  assert.deepEqual(pages.map((page) => [page.id, page.layout, page.title]), [['plan', 'process', deck.slides[1].title], ['plan--2', 'process', deck.slides[1].title]]);
  assert.equal(pages[0].notes, deck.slides[1].notes);
  assert.equal(pages[1].notes, undefined);
  // The pages keep the slide's composition as authored (no readability floor is written into them); LH-144: the second carries the
  // first page's largest timeline size as its cap, so it does not read larger.
  assert.equal(pages[0].composition, undefined);
  assert.deepEqual(Object.keys(pages[1].composition), ['maxFontSize']);
  for (const index of [1, 2]) assert.deepEqual(overflow(composed(result.presentation, index)), [], `page ${index} fits`);
  // The other slides and the input are untouched.
  assert.deepEqual(result.presentation.slides[0], deck.slides[0]);
  assert.deepEqual(result.presentation.slides[3], deck.slides[2]);
  assert.equal(deck.slides.length, 3);
  assert.equal(result.continued[0].pages.length, 2);
  assert.ok(result.continued[0].pages[1].mappings.every((mapping) => mapping.outputPath.startsWith('slides.2.')));
});

test('a timeline keeps the note that follows it', () => {
  const blocks = [0, 1, 2].flatMap((index) => [timeline(index), { text: `Note ${index + 1}: the owner reports at the monthly review, with the next decision and its date.` }]);
  const slide = { layout: 'timeline', title: 'Why this matters', blocks };
  assert.deepEqual(blockUnits(slide), { kind: 'timeline', units: [[0, 1], [2, 3], [4, 5]] });
  const result = continueOverfull({ slides: [slide] }, { catalogs });
  assert.equal(result.continued.length, 1, 'continued');
  const [continued] = result.continued;
  assert.ok(continued.blocks.every((page) => page.length % 2 === 0 && page.every((index, position) => index % 2 === position % 2)), `pairs stay together: ${JSON.stringify(continued.blocks)}`);
  assert.deepEqual(pageBlocks(result.presentation), blocks);
});

test('a slide that fits, a strict slide and a slide of other blocks are drawn as written', () => {
  const fits = timelines(2, { id: 'fits' });
  assert.deepEqual(overflow(composed({ slides: [fits] }, 0)), []);
  const strict = timelines(8, { id: 'strict', composition: { overflow: 'error' } });
  assert.throws(() => composed({ slides: [strict] }, 0), OPFCompositionError, 'strict composition fails');
  const led = { layout: 'process', title: 'Plan', blocks: [{ text: 'Context for the paths below.' }, ...timelines(8).blocks] };
  const deck = { slides: [fits, strict, led] };
  const result = continueOverfull(deck, { catalogs });
  assert.deepEqual(result.continued, []);
  assert.deepEqual(result.presentation, deck);
  // A strict slide is never split by the whole-block mode either: it fails as the engines do.
  assert.throws(() => paginateSlide(strict, { catalogs, wholeBlocks: true, layout: gallery.layouts.process }), OPFCompositionError);
});

test('block units: one payload per root block, nothing else to move', () => {
  assert.deepEqual(blockUnits({ blocks: [timeline(0), timeline(1)] }), { kind: 'timeline', units: [[0], [1]] });
  assert.equal(blockUnits({ blocks: [timeline(0)] }), undefined, 'one block');
  assert.equal(blockUnits({ blocks: [{ text: 'Lead' }, timeline(0), timeline(1)] }), undefined, 'one unit led by the text');
  assert.equal(blockUnits({ blocks: [timeline(0), { blocks: [timeline(1)] }] }), undefined, 'a nested group');
  assert.equal(blockUnits({ text: 'Root text', blocks: [timeline(0), timeline(1)] }), undefined, 'a root payload');
  assert.equal(blockUnits({ left: { text: 'Side' }, blocks: [timeline(0), timeline(1)] }), undefined, 'a promoted region');
  assert.deepEqual(blockUnits({ blocks: [{ code: { source: 'a()' } }, { text: 'Why' }, { code: { source: 'b()' } }] }), { kind: 'code', units: [[0, 1], [2]] });
});

test('a block that does not fit alone keeps the slide as written', () => {
  // A table of thirty rows does not fit the slide at the floor even alone; splitting between the tables would not help.
  const table = { table: { columns: ['Plan', 'Seats', 'Price'], rows: Array.from({ length: 30 }, (_, row) => [`Plan ${row + 1}`, String(row), `$${row}`]) } };
  const slide = { title: 'Plans', blocks: [table, table] };
  assert.throws(() => paginateSlide(slide, { catalogs, wholeBlocks: true }), OPFPaginationError);
  const deck = { slides: [slide] };
  assert.deepEqual(continueOverfull(deck, { catalogs }), { presentation: deck, continued: [], layout: 'estimated' });
});

test('a right-to-left deck splits the same way, and the slide count settles for {{deck.slideCount}}', () => {
  const deck = { language: 'ar', design: { footer: { text: '{{slide.number}} / {{deck.slideCount}}' } }, slides: [timelines(8, { title: 'مسارات التنفيذ' })] };
  const result = continueOverfull(deck, { catalogs });
  assert.equal(result.continued.length, 1);
  assert.deepEqual(result.continued[0].blocks, [[0, 1, 2, 3], [4, 5, 6, 7]]);
  assert.equal(composed(result.presentation, 0).direction, 'rtl');
  for (const index of [0, 1]) assert.deepEqual(overflow(composed(result.presentation, index)), []);
});
