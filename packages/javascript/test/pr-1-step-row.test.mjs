// PR1: the lone list of the process layout's `steps` region draws as the row its steps make when written as separate blocks (a badge
// over each entry, joined by the connector, the row in the middle of the region), not as a small column of badges in the corner.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { composeSlide } from '../dist/composition.js';
import { resolveSlideContext } from '../dist/index.js';

const compose = (slide, direction) => { const context = resolveSlideContext({ slides: [slide] }, 0, { catalogs: [gallery] }); return composeSlide(context.slide, { ...context.options, ...(direction ? { direction } : {}) }); };
const findings = (result) => result.diagnostics.filter((entry) => ['text-overflow', 'small-cell', 'layout-unplaced'].includes(entry.code));

for (const direction of ['ltr', 'rtl']) {
  test(`PR1 (${direction}): three sentence-length steps are a row of badged columns in the middle of the body`, () => {
    const items = ['Establish a baseline of completion', 'Run the pilot with two teams', 'Decide what to scale next'];
    const result = compose({ layout: 'process', title: 'Three steps from evidence to decision', blocks: [{ region: 'body', items }] }, direction);
    assert.deepEqual(findings(result), []);
    const list = result.items.find((item) => item.field === 'items'), [steps] = result.steps;
    assert.equal(steps.form, 'row');
    assert.equal(steps.badges.length, 3);
    assert.ok(steps.connector, 'joined by the connector');
    assert.equal(list.listColumns.length, 3);
    // One badge over each column, at its start; all on one line above the text.
    const cy = steps.badges[0].cy;
    for (const badge of steps.badges) assert.ok(Math.abs(badge.cy - cy) < 0.01);
    for (const column of list.listColumns) assert.ok(column.box.y > cy);
    const xs = list.listColumns.map((column) => column.box.x);
    assert.ok(direction === 'rtl' ? xs[0] > xs[2] : xs[0] < xs[2], 'reading order');
    // The row sits in the middle of the region, and its text is no smaller than the list's role size.
    const region = result.regions.find((entry) => entry.name === 'body').box;
    const top = cy - steps.badges[0].radius, bottom = Math.max(...list.listColumns.map((column) => column.box.y + column.box.height));
    assert.ok(Math.abs((top - region.y) - (region.y + region.height - bottom)) < 0.1 * region.height, `above ${top - region.y}, below ${region.y + region.height - bottom}`);
    assert.ok(list.text.fontSize >= 28 - 1e-6, `size ${list.text.fontSize}`);
  });
}

test('PR1: a list too long for columns keeps its badges down the side', () => {
  const items = ['Establish a baseline of completion and time', 'Run the pilot with two teams', 'Review the results each week', 'Decide what to scale', 'Agree the owner'];
  const result = compose({ layout: 'process', title: 'Five steps', blocks: [{ region: 'body', items }] });
  assert.equal(result.steps[0].form, 'column');
});
