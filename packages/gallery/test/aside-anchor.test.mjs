// A layout's aside beside a figure sets its content in the middle of the aside, level with the figure: chart-beside's aside was
// as tall as the chart while its text, list, metric or quote stood in the top third (0.35.1 and before, C02); code's aside started
// at the top of the snippet's column (C07).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '@openpresentation/opf/composition';
import { gallery } from '../dist/index.js';

const compose = (id, slide) => composeSlide(slide, { width: 1280, height: 720, layout: gallery.layouts[id] });
const middle = (box) => box.y + box.height / 2;
const aside = (id) => gallery.layouts[id].regions.flatMap((entry) => entry.regions ?? [entry]).find((region) => region.name === 'aside');
const chart = { chart: { type: 'column', title: 'Task completion by week', data: { columns: ['Week', 'Completion'], rows: [['1', 0.68], ['2', 0.72], ['3', 0.76], ['4', 0.84]] } } };
const ASIDES = {
  text: { text: 'Test with two teams for six weeks. Measure task completion and time before deciding what to scale.' },
  list: { bullets: ['Baseline 68%', 'Week four 84%'] },
  metric: { metric: { value: '84%', label: 'Task completion', description: 'Up from 68%' } },
  quote: { quote: { text: 'We can now see where participants need help.', attribution: 'Pilot lead' } },
};

test('chart-beside: the aside region is anchored in the middle', () => assert.equal(aside('chart-beside').anchor, 'middle'));
for (const [kind, block] of Object.entries(ASIDES)) {
  test(`chart-beside: a ${kind} aside stands level with the middle of the chart's column`, () => {
    const result = compose('chart-beside', { title: 'The largest gain came in week four', blocks: [chart, block] });
    const region = result.regions.find((entry) => entry.name === 'aside');
    const items = result.items.filter((item) => item.path.startsWith('slides.0.blocks.1'));
    assert.ok(items.length, 'the aside is drawn');
    const top = Math.min(...items.map((item) => item.box.y)), bottom = Math.max(...items.map((item) => item.box.y + item.box.height));
    assert.ok(Math.abs((top + bottom) / 2 - middle(region.box)) <= 0.1 * region.box.height, `${kind}: centered in the aside (${top}..${bottom} in ${region.box.y}..${region.box.y + region.box.height})`);
  });
}
