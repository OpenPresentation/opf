// LH wave 2: the rules the integration added where two wave 2 features meet (packages/render/test/golden/notes/LH-wave-2.md).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';
import { layouts, sampleSlide } from './support/template-samples.mjs';

const overflow = (result) => result.diagnostics.filter((entry) => entry.code === 'text-overflow' || entry.code === 'small-cell');
const code = (name) => ({ code: { filename: `${name}-inspection-rule.ts`, language: 'ts', source: 'const score = urgency * confidence;\nif (score >= threshold) {\n  routeToSponsor(workstream);\n} else {\n  keepInWeeklyReview(workstream);\n}' } });

test('LH-58 with LH-47: an automatic majority band is measured as the grid it draws, so the row under it keeps its room', () => {
  // Three code panels and two texts interleaved: the panels are a grid above a row of the texts (LH-82). Measured as a stack, the
  // band asked for three panels' height and left the texts at their floor (two small-cell findings and an overflow).
  const slide = { title: 'Signal trend', blocks: [code('video-demo-sales-narrative'), { text: 'Prairie Ridge High School should focus the next cycle on secure funding for hands-on robotics and chemistry labs.' }, code('validator'), { text: 'Keep the recommendation and its evidence together.' }, code('revenue-forecast')] };
  const result = composeSlide(slide, {});
  assert.deepEqual(overflow(result), []);
  const panels = result.items.filter((item) => item.codeLayout), texts = result.items.filter((item) => item.field === 'text');
  assert.equal(new Set(panels.map((item) => Math.round(item.box.y))).size, 1, 'the panels share one row');
  assert.ok(texts.every((item) => item.box.y > Math.max(...panels.map((panel) => panel.box.y + panel.box.height))), 'the texts sit under the panels');
  // Right to left the same row mirrors.
  const rtl = composeSlide(slide, { direction: 'rtl' });
  assert.deepEqual(overflow(rtl), []);
});

test('LH-46 with LH-44: extra tables stay below the grid when joining the fixed region overflows more', () => {
  const table = (first) => ({ table: { columns: ['Workstream', 'Owner', 'Status', 'Decision'], rows: [[first, 'Program lead', 'On track', 'Continue'], ['Data and reporting', 'Analytics', 'Watch', 'Tighten metric definitions'], ['Field adoption', 'Operations', 'At risk', 'Add weekly office hours']] } });
  const slide = { title: 'Advising retention review', blocks: [table('Student success'), { text: 'North Valley State should focus the next cycle on first-year retention through proactive advising.' }, table('Hospitality'), { text: 'First: state the situation.' }, table('Compliance')] };
  const result = composeSlide(slide, { layout: layouts['table-beside'] });
  assert.deepEqual(overflow(result), [], 'no table is squeezed until its words break');
  assert.deepEqual(result.diagnostics.filter((entry) => entry.code === 'layout-unplaced').map((entry) => entry.path), ['slides.0.blocks.2', 'slides.0.blocks.4']);
  // Pictures that fit still join (LH-46's mosaic).
  const image = (index) => ({ image: { src: `https://example.com/${index}.png`, alt: `Picture ${index}` } });
  const mosaic = composeSlide({ title: 'Gallery', blocks: [image(1), image(2), image(3), image(4)] }, { layout: layouts.image });
  assert.deepEqual(mosaic.diagnostics.filter((entry) => entry.code === 'layout-unplaced'), []);
});

test('LH-83 with LH-43: a recomposition as large as the layout with less overflow is kept', () => {
  const slide = sampleSlide(layouts['agenda-split'], 3, 'long');
  const kept = composeSlide(slide, { layout: layouts['agenda-split'], recompose: false });
  const result = composeSlide(slide, { layout: layouts['agenda-split'] });
  assert.ok(overflow(kept).length > 0, 'the layout overflows at the floor');
  assert.ok(result.recomposed, 'recomposed');
  assert.ok(result.recomposed.size >= result.recomposed.layoutSize);
  assert.ok(overflow(result).length < overflow(kept).length);
});

test('LH-03 with LH-60: the chart layer is decided for the construct drawn', () => {
  const quarters = { columns: ['Quarter', 'Current', 'Prior'], rows: [['Q1', 4, 3], ['Q2', 5, 4], ['Q3', 6, 5], ['Q4', 7, 5]] };
  const chartOf = (type) => composeSlide({ title: 'Chart', blocks: [{ chart: { type, data: quarters } }] }, {}).items.find((item) => item.field === 'chart').chart;
  const world = chartOf('world'), column = chartOf('column');
  // A world chart over quarters is drawn as clustered columns, so it takes their header row and small-chart labels.
  assert.ok(world.layer?.header?.legend, 'the header legend');
  assert.deepEqual(world.layer, column.layer);
  assert.deepEqual(world.valueAxis, column.valueAxis);
  // A world chart over places is a map: no layer.
  const places = composeSlide({ title: 'Chart', blocks: [{ chart: { type: 'world', data: { columns: ['Country', 'Sales'], rows: [['France', 4], ['Germany', 5], ['Japan', 6]] } } }] }, {}).items.find((item) => item.field === 'chart');
  assert.equal(places.chart?.layer, undefined);
});

test('LH-71 and LH-52 with LH-44: a table that wraps beside its text goes full width above it, and the pair is centred', () => {
  const table = { table: { columns: ['Workstream', 'Owner', 'Status', 'Decision'], rows: [['Community college', 'Program lead', 'At risk', 'Continue'], ['Data and reporting', 'Analytics', 'On track', 'Tighten metric definitions'], ['Field adoption', 'Operations', 'Watch', 'Add weekly office hours']] } };
  const text = { text: 'Metro Technical College should focus the next cycle on connecting employer demand to short-cycle training capacity while making the operating tradeoffs clear.' };
  for (const direction of ['ltr', 'rtl']) {
    const result = composeSlide({ title: 'Execution timeline', blocks: [table, text] }, { direction, explain: true });
    assert.deepEqual(overflow(result), []);
    const grid = result.items.find((item) => item.field === 'table'), note = result.items.find((item) => item.field === 'text');
    // LH-44's row would give the table 65% of the width and wrap its cells; the column shows every cell on one line.
    assert.equal(result.explanation.decisions[0].reason, 'split-fill');
    assert.ok(Math.abs(grid.box.width - result.contentBox.width) < 1);
    // The table keeps its rows' height (no spare height), so the text follows it.
    assert.ok(note.box.y - (grid.box.y + grid.box.height) < 40);
  }
});

test('LH-86 with LH-43 and LH-46: long rows joined into one region share its height at one size', () => {
  const paragraph = (name) => ({ text: `${name} should focus the next cycle on preparing supplier data collection for annual reporting while making the operating tradeoffs clear to its stakeholders.` });
  for (const direction of ['ltr', 'rtl']) {
    const result = composeSlide({ title: 'Scope 3 reporting readiness', blocks: ['Lumina Foods', 'Cedarwell Properties', 'Brightpath Analytics', 'North Pier Advisory', 'RheinWorks Mobility'].map(paragraph) }, { layout: layouts['two-column'], direction });
    assert.deepEqual(overflow(result), []);
    const texts = result.items.filter((item) => item.field === 'text');
    assert.equal(texts.length, 5);
    assert.equal(new Set(texts.map((item) => item.text.fontSize)).size, 1);
    const region = result.regions.find((entry) => entry.arrangement === 'column').box;
    assert.ok(Math.abs(texts[0].frameBox.y - region.y) < 1 && Math.abs(texts[4].frameBox.y + texts[4].frameBox.height - region.y - region.height) < 1);
  }
});
