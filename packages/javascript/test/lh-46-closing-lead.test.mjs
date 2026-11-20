// LH-46: a closing's details of mixed lengths (a long call to action and shorter details) that its own flow would stack as one
// column of paragraphs draw as a lead plus cards: the first block across the region, the others in the balanced grid below it.
import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { composeSlide } from '../dist/composition.js';

const { layouts } = gallery;
const lead = 'AeroVista Airlines should focus the next cycle on shorten recovery time after weather-driven network disruption while making the operating tradeoffs clear to air travel stakeholders.';
const details = [
  'Growth was broad-based, with margin expansion from infrastructure savings.',
  'Kiteframe should focus the next cycle on coordinate launch story, proof, and field actions while making the operating tradeoffs clear to product launch stakeholders.',
  'Measure the result.',
  'Learn with two teams before expanding the rollout.',
];
const slide = (texts) => ({ title: 'Airline Disruption Recovery Review', layout: 'closing', blocks: texts.map((text) => ({ text })) });
const findings = (result) => result.diagnostics.filter((entry) => ['text-overflow', 'small-cell', 'layout-unplaced'].includes(entry.code));
const body = (result) => result.items.filter((item) => item.field === 'text');
const sizes = (result) => body(result).map((item) => item.text.fontSize);

describe('LH-46: the closing\'s lead plus cards', () => {
  for (const direction of ['ltr', 'rtl']) {
    test(`${direction}: the call to action leads across the region and the details sit in a grid below it`, () => {
      const result = composeSlide(slide([lead, ...details]), { layout: layouts.closing, direction });
      const [first, ...rest] = body(result);
      assert.deepEqual(findings(result), []);
      // The lead is alone in its row, above every detail.
      for (const item of rest) assert.ok(item.box.y >= first.box.y + first.box.height - 1, 'the details sit below the lead');
      // The details are a grid: two side by side in a row.
      const rows = [...new Set(rest.map((item) => Math.round(item.box.y / 4)))];
      assert.ok(rows.length < rest.length, 'not one column');
      const pair = rest.filter((item) => Math.abs(item.box.y - rest[0].box.y) < 4);
      assert.equal(pair.length, 2);
      // Reading order runs from the start edge (the right in a right-to-left deck).
      const [a, b] = pair;
      if (direction === 'rtl') assert.ok(a.box.x > b.box.x); else assert.ok(a.box.x < b.box.x);
    });
  }

  test('the lead and its details keep the size the stacked column had (28 px at 1280 by 720)', () => {
    const result = composeSlide(slide([lead, ...details]), { layout: layouts.closing });
    for (const size of sizes(result)) assert.ok(size >= 28 - 0.01, `size ${size}`);
  });

  test('details that would leave a short last row keep the stack', () => {
    const result = composeSlide(slide([lead, ...details, 'Write the reason back to the audit log so the next review starts from it.']), { layout: layouts.closing });
    const xs = new Set(body(result).map((item) => Math.round(item.box.x)));
    assert.equal(xs.size, 1, 'one column');
  });

  test('similar paragraphs keep their columns and two blocks keep the region\'s own flow', () => {
    const similar = Array.from({ length: 4 }, (_, index) => `${['Pinnacle Mutual', 'Civic Data Lab', 'Oaktrail Animal Health', 'Department of Revenue Services'][index]} should focus the next cycle on speed low-complexity claims while making the operating tradeoffs clear to insurance stakeholders.`);
    const grid = composeSlide(slide(similar), { layout: layouts.closing });
    const tops = [...new Set(body(grid).map((item) => Math.round(item.box.y / 4)))];
    assert.equal(tops.length, 2, 'two rows of two columns');
    const two = composeSlide(slide([lead, details[0]]), { layout: layouts.closing });
    const [x, y] = body(two);
    assert.ok(y.box.y >= x.box.y + x.box.height - 1 || y.box.x >= x.box.x + x.box.width - 1);
  });
});
