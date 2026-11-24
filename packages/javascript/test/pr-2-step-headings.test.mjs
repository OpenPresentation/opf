// PR2: a step without a description in a row of steps with descriptions draws as a heading too (bold, a step up), so the row reads alike.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { composeSlide } from '../dist/composition.js';
import { resolveSlideContext } from '../dist/index.js';

const compose = (slide) => { const context = resolveSlideContext({ slides: [slide] }, 0, { catalogs: [gallery] }); return composeSlide(context.slide, context.options); };
const step = (text, start, description) => ({ region: 'body', numbering: 'arabic', items: [{ text, start, ...(description ? { description } : {}) }] });
const label = (item) => item.text.listEntries[0].text;

test('PR2: the step without a description is a heading at its siblings\' size', () => {
  const result = compose({ layout: 'process', title: 'Three steps', blocks: [step('Baseline', 1, 'Measure the current rate.'), step('Run', 2, 'Test with two teams.'), step('Decide', 3)] });
  const lists = result.items.filter((item) => item.field === 'items');
  assert.equal(result.steps[0].form, 'row');
  const sizes = lists.map((item) => label(item).fontSize);
  assert.ok(sizes.every((size) => Math.abs(size - sizes[0]) < 0.01), `sizes ${sizes}`);
  assert.equal(lists[2].text.listEntries[0].marker.text, '');
  // The three labels start on one line under the badges.
  const tops = lists.map((item) => item.text.listEntries[0].textBox.y);
  assert.ok(tops.every((top) => Math.abs(top - tops[0]) < 0.5), `tops ${tops}`);
});

test('PR2: steps without any description keep their plain lines', () => {
  const result = compose({ layout: 'process', title: 'Three steps', blocks: [step('Baseline', 1), step('Run', 2), step('Decide', 3)] });
  for (const item of result.items.filter((entry) => entry.field === 'items')) assert.ok(Math.abs(label(item).fontSize - item.text.fontSize) < 0.01, 'no heading step-up');
});
