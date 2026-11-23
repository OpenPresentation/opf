// LH-67: a lead plus stack keeps the author's order. Only a first or last block leads; a long block between short siblings is never
// drawn before the block that precedes it, not on an automatic slide and not on a layout's recomposition (LH-83).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';
import { layouts } from './support/template-samples.mjs';

const long = 'Test with two teams for six weeks. Measure task completion and time before deciding what to scale. Keep the scope narrow, collect feedback weekly and give each decision a named owner. Compare the results with the baseline and expand only when the evidence supports the next step. Review the plan again at the end of week three with every stakeholder present.';
const body = (result) => result.items.filter((item) => item.field === 'text');
// Reading order of the drawn blocks: top to bottom, then start to end (a block whose top is above another's bottom-left reads first).
const before = (a, b) => a.box.y + a.box.height <= b.box.y + 1 || (a.box.x + a.box.width <= b.box.x + 1 && a.box.y < b.box.y + b.box.height);

test('LH-67: an automatic slide with a long middle block stacks its blocks in order', () => {
  const result = composeSlide({ title: 'Three steps', blocks: [{ text: 'First: a short pilot.' }, { text: `Second: ${long} ${long}` }, { text: 'Third: decide.' }] }, { explain: true });
  assert.notEqual(result.explanation.decisions[0].reason, 'lead-stack');
  const [first, second, third] = body(result);
  assert.ok(before(first, second) && before(second, third), 'first, second and third read in the author\'s order');
});

test('LH-67: a long first or last block still leads', () => {
  for (const blocks of [[{ text: `Lead: ${long}` }, { text: 'A short one.' }, { text: 'Another.' }], [{ text: 'A short one.' }, { text: 'Another.' }, { text: `Lead: ${long}` }]]) {
    const result = composeSlide({ title: 'Lead plus stack', blocks }, { explain: true });
    assert.equal(result.explanation.decisions[0].reason, 'lead-stack');
    const texts = body(result);
    assert.ok(before(texts[0], texts[1]) && before(texts[1], texts[2]));
  }
});

test('LH-67 with LH-83: a comparison with a long second option keeps its options in order, side by side', () => {
  const slide = { title: 'Choose the smallest useful test', blocks: [{ text: 'Option A: focused pilot\nTwo teams.' }, { text: `Option B: broad rollout\n${long} ${long}` }, { text: 'Recommendation: Option A.' }] };
  const result = composeSlide(slide, { layout: layouts.comparison });
  const [a, b] = body(result);
  assert.equal(result.recomposed, undefined);
  assert.ok(a.box.x + a.box.width <= b.box.x + 1, 'Option A is drawn before Option B');
  assert.equal(a.text.fontSize, b.text.fontSize, 'the two options share one size');
});
