// opf#1412 (A3): a slide that asks for `mode: "column"` keeps its blocks in a column: LH-49's chart track does not set the chart
// beside them (on a portrait canvas, `mode: "row"` keeps its row the same way).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';

const chart = { chart: { type: 'column', alt: 'Two regions.', data: { columns: ['Region', 'Revenue'], rows: [['North', 42], ['South', 31]] } } };
const text = { text: 'Ship the pilot in March.' };

test('mode column keeps a text above the chart it shares the slide with', () => {
  const blocks = [text, chart];
  assert.equal(composeSlide({ title: 'Auto', blocks }).track?.kind, 'chart', 'without a mode the chart takes its track');
  const result = composeSlide({ title: 'Column', composition: { mode: 'column' }, blocks });
  assert.equal(result.track, undefined, 'no chart track');
  const drawn = result.items.find((item) => item.field === 'chart'), placed = result.items.find((item) => item.path === 'slides.0.blocks.0.text');
  assert.ok(placed.box.y + placed.box.height <= drawn.box.y + 1, 'the text is above the chart');
});
