// C02: a quote beside a chart keeps its card and its quote mark, the card centered in the aside's column level with the chart.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '@openpresentation/opf/composition';
import { gallery } from '../dist/index.js';

const middle = (box) => box.y + box.height / 2;
test('chart-beside: a quote aside keeps its card and quote mark, the card centered beside the chart', () => {
  const chart = { chart: { type: 'column', title: 'Task completion by week', data: { columns: ['Week', 'Completion'], rows: [['1', 0.68], ['2', 0.72], ['3', 0.76], ['4', 0.84]] } } };
  const quote = { quote: { text: 'We can now see where participants need help.', attribution: 'Pilot lead' } };
  const result = composeSlide({ title: 'The largest gain came in week four', blocks: [chart, quote] }, { width: 1280, height: 720, layout: gallery.layouts['chart-beside'] });
  const item = result.items.find((entry) => entry.field === 'quote'), region = result.regions.find((entry) => entry.name === 'aside');
  assert.ok(item.frameBox, 'the quote is on its card');
  assert.ok(item.quoteLayout.mark, 'the card draws its quote mark');
  assert.ok(Math.abs(middle(item.frameBox) - middle(region.box)) <= 0.15 * region.box.height, 'the card stands in the middle of the aside');
});
