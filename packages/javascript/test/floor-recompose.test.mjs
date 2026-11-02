// LH-83: a layout template whose best fit sets a body role at the readability floor is composed again as the automatic grid, and
// that result is kept when its smallest body size is larger and it neither overflows nor splits words more (`recomposed`).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { composeSlide } from '../dist/composition.js';
import { resolveSlideContext } from '../dist/index.js';
import { layouts, sampleSlide } from './support/template-samples.mjs';

const FLOOR = 16;
const HEADINGS = new Set(['title', 'subtitle', 'tag']);
const overflows = (result) => result.diagnostics.filter((entry) => entry.code === 'text-overflow').length;
const blocksDrawn = (result) => new Set(result.items.flatMap((item) => (/\.blocks\.(\d+)/.exec(item.path) ? [/\.blocks\.(\d+)/.exec(item.path)[1]] : [])));
// The smallest text or list size of a composition, in reference pixels (the samples are composed at 1280 x 720).
const smallestText = (result) => Math.min(...result.items.filter((item) => !HEADINGS.has(item.field) && item.text && !item.quoteLayout && !item.codeLayout && !item.metricLayout && !item.timelineLayout).map((item) => item.text.fontSize));
const meet = (a, b) => a.x < b.x + b.width - 0.5 && a.x + a.width > b.x + 0.5 && a.y < b.y + b.height - 0.5 && a.y + a.height > b.y + 0.5;

const samples = Object.entries(layouts).flatMap(([id, record]) => ['short', 'long'].flatMap((size) => [1, 2, 3, 4, 5, 6].map((count) => ({ key: `${id} ${count} ${size}`, record, slide: sampleSlide(record, count, size) }))));

test('the gallery layouts at their sample content: a slide the layout fits above the floor is unchanged', () => {
  const recomposed = [];
  for (const { key, record, slide } of samples) {
    const result = composeSlide(slide, { layout: record }), kept = composeSlide(slide, { layout: record, recompose: false });
    assert.deepEqual(composeSlide(slide, { layout: record }), result, `${key}: deterministic`);
    if (!result.recomposed) {
      assert.deepEqual(result, kept, `${key}: unchanged`);
      continue;
    }
    recomposed.push(key);
    // Recomposed only from the floor, to a larger smallest size, with no more overflow and every block still drawn.
    assert.ok(result.recomposed.layoutSize <= FLOOR + 1e-6, `${key}: the layout was at the floor (${result.recomposed.layoutSize})`);
    assert.ok(result.recomposed.size > result.recomposed.layoutSize, `${key}: the recomposition is larger`);
    assert.ok(overflows(result) <= overflows(kept), `${key}: no more overflow`);
    assert.deepEqual(blocksDrawn(result), blocksDrawn(kept), `${key}: no block is lost`);
    assert.equal(result.regions, undefined, `${key}: no regions`);
    assert.equal(result.headingAreas, undefined, `${key}: no heading areas`);
    assert.ok(result.items.every((item) => item.region === undefined), `${key}: no item names a region`);
    // The headings sit above the body, as on an automatic slide.
    const headings = result.items.filter((item) => HEADINGS.has(item.field));
    for (const item of result.items) if (!HEADINGS.has(item.field)) for (const heading of headings) assert.ok(!meet(item.frameBox ?? item.box, heading.box), `${key}: ${item.path} crosses the ${heading.field}`);
  }
  // The long agendas beside their title, the long tables and the crowded heroes are the cases at the floor today.
  assert.ok(recomposed.includes('agenda-split 3 long'), recomposed.join(', '));
  assert.ok(recomposed.length < samples.length / 10, `only slides at the floor recompose (${recomposed.length})`);
});

test('the layout sampler deck: no gallery layout at its sample content is recomposed', () => {
  const deck = JSON.parse(readFileSync(new URL('../../../examples/technical/layout-sampler.opf.json', import.meta.url), 'utf8'));
  delete deck.catalogs;
  for (const [index, slide] of deck.slides.entries()) {
    const context = resolveSlideContext(deck, index, { catalogs: [gallery] });
    const result = composeSlide(context.slide, context.options);
    assert.equal(result.recomposed, undefined, slide.id);
    assert.deepEqual(result, composeSlide(context.slide, { ...context.options, recompose: false }), slide.id);
  }
});

const agenda = (count) => ({
  title: 'Six workstreams to align before the next budget cycle',
  blocks: Array.from({ length: count }, (_, index) => ({ items: Array.from({ length: 6 }, (_, item) => `Workstream ${index + 1}, step ${item + 1}: agree the owner, the reporting cadence and the first readout`) })),
});

test('a long agenda beside its title is composed as the automatic grid, larger and without overflow', () => {
  const record = gallery.layouts['agenda-split'];
  const kept = composeSlide(agenda(3), { layout: record, recompose: false }), result = composeSlide(agenda(3), { layout: record });
  assert.ok(smallestText(kept) <= FLOOR + 1e-6 && overflows(kept) > 0, 'the layout sets the agenda at the floor and overflows');
  assert.ok(result.recomposed, 'recomposed');
  assert.equal(overflows(result), 0);
  assert.ok(smallestText(result) > FLOOR, `larger than the floor (${smallestText(result)})`);
  assert.equal(result.recomposed.size, smallestText(result));
  // The title is a content title above the body, over the whole width; the body is below it.
  const title = result.items.find((item) => item.field === 'title'), body = result.items.filter((item) => !HEADINGS.has(item.field));
  assert.ok(title.box.width > 1000, 'the title spans the slide');
  assert.ok(body.every((item) => item.box.y >= title.box.y + title.box.height), 'the body is below the title');
});

test('the recomposition keeps the layout record\'s design and composition', () => {
  const record = { ...gallery.layouts['agenda-split'], design: { contentBox: true, contentAlignment: 'center' }, composition: { padding: 0.06 } };
  const result = composeSlide(agenda(3), { layout: record });
  assert.ok(result.recomposed);
  const body = result.items.filter((item) => !HEADINGS.has(item.field));
  assert.ok(body.every((item) => item.frameBox), 'cards from the record\'s design');
  assert.ok(body.every((item) => item.alignment === 'center'), 'alignment from the record\'s design');
  assert.equal(result.items.find((item) => item.field === 'title').box.x, Math.round(0.06 * 720 * 10) / 10, 'padding from the record\'s composition');
});

test('a pinned block, recompose: false and a slide above the floor keep the layout', () => {
  const record = gallery.layouts['agenda-split'];
  const pinned = agenda(3);
  pinned.blocks[0].region = 'items';
  assert.equal(composeSlide(pinned, { layout: record }).recomposed, undefined, 'a block pinned to a region');
  assert.equal(composeSlide(agenda(3), { layout: record, recompose: false }).recomposed, undefined, 'recompose: false');
  const short = composeSlide(agenda(1), { layout: record });
  assert.equal(short.recomposed, undefined, 'one agenda fits above the floor');
  assert.ok(short.regions);
});

test('a right-to-left deck recomposes the same way, mirrored', () => {
  const record = gallery.layouts['agenda-split'];
  const result = composeSlide(agenda(3), { layout: record, direction: 'rtl' });
  assert.ok(result.recomposed);
  assert.equal(result.direction, 'rtl');
  assert.equal(overflows(result), 0);
  const body = result.items.filter((item) => !HEADINGS.has(item.field)).sort((a, b) => a.path.localeCompare(b.path));
  assert.ok(body[0].box.x > body[1].box.x, 'the first block is drawn at the right');
});

test('a recomposition that would break words inside the grid is not kept', () => {
  // Three code panels of long identifiers beside text: the automatic grid gives each a narrow cell, which splits the identifiers.
  const code = (name) => ({ code: { filename: `${name}-inspection-rule.ts`, language: 'ts', source: 'const score = urgency * confidence;\nif (score >= threshold) {\n  routeToSponsor(workstream);\n} else {\n  keepInWeeklyReview(workstream);\n}' } });
  const slide = { title: 'Signal trend', blocks: [code('video-demo-sales-narrative'), { text: 'Prairie Ridge High School should focus the next cycle on secure funding for hands-on robotics and chemistry labs.' }, code('validator'), { text: 'Keep the recommendation and its evidence together.' }, code('revenue-forecast')] };
  const result = composeSlide(slide, { layout: gallery.layouts.code });
  // The layout sets the code bodies at the floor and overflows; the automatic grid sets them larger and fits, but splits words.
  assert.ok(overflows(composeSlide(slide, { layout: gallery.layouts.code, recompose: false })) > 0);
  assert.equal(overflows(composeSlide(slide, {})), 0);
  assert.equal(result.recomposed, undefined);
  assert.ok(result.regions);
});
