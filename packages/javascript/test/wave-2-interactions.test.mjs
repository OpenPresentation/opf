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

test('LH-06 with LH-43 and LH-58: a foot band is no sibling of the blocks above it, which still share one size', () => {
  const text = (name, more = '') => ({ text: `${name} should focus the next cycle on secure funding for hands-on robotics and chemistry labs${more}.` });
  const slide = { title: 'Demo moment', blocks: [text('Prairie Ridge'), text('Canyon Unified'), text('Morrow Labs'), { text: 'Next step: name the pilot lead.' }] };
  for (const direction of ['ltr', 'rtl']) for (const layout of [undefined, layouts.pillars]) {
    const result = composeSlide(slide, { direction, ...(layout ? { layout } : {}) });
    assert.equal(result.emphasis?.shape, 'band');
    const above = result.items.filter((item) => item.field === 'text' && !item.emphasis);
    assert.equal(new Set(above.map((item) => item.text.fontSize)).size, 1, 'the blocks above share one size');
    assert.deepEqual(overflow(result), []);
    // The band costs no block its size (LH-06's guard): the blocks above keep the size they have without it.
    const plain = composeSlide({ ...slide, blocks: slide.blocks.map((block, index) => (index === 3 ? { ...block, emphasis: false } : block)) }, { direction, ...(layout ? { layout } : {}) });
    for (const item of above) assert.ok(item.text.fontSize >= plain.items.find((entry) => entry.path === item.path).text.fontSize - 1e-6, item.path);
  }
});
