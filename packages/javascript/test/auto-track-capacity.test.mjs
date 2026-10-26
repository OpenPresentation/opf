import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allocateRows, composeSlide, shareHeights } from '../dist/composition.js';

// WI-1 (P27): an `auto` row takes what its content needs, up to the space the heading rows and the numeric rows' content
// leave, instead of at most half the content box. When the needs do not fit, every row gives up the same fraction of what
// it can give up above its height at the minimum font size, so a one-line row is not squeezed by a dense neighbour.
const { layouts } = gallery;
// The all-auto stack of the slide-design audit: a title and one auto body region.
const allAuto = { name: 'Text', direction: 'column', regions: [{ name: 'title' }, { name: 'body', size: 'auto', accepts: ['text', 'list', 'quote', 'code', 'group'], role: 'primary', flow: 'auto' }] };
const passages = [
  'Who takes part in the pilot and how will they be supported?\nTwo field teams will test the new workflow in their normal operating environment. Their managers will receive a short guide, and the support team will review questions every week so that issues are resolved before they affect the next cohort.',
  'How long does the pilot run and what happens at each checkpoint?\nThe six-week pilot begins with a baseline measurement, continues with four weeks of live use and weekly feedback, and finishes with a review of completion, task time and support demand. The steering group will decide whether each readiness condition has been met.',
  'What will determine the next investment decision?\nWe will compare the outcomes with the baseline, check the confidence and completeness of the evidence, and confirm that the support and training model can scale. Any unresolved dependency will have an accountable owner and an explicit review date before more teams are added.',
];
const heading = { title: 'Learn before scaling', subtitle: 'Illustrative example' };
const sizes = (result) => result.items.filter((item) => item.region === 'body').map((item) => item.text.fontSize);

test('three detailed passages in an all-auto stack share one size (WI-4: they do not fit at 28 px, and none is left at 23 or 25)', () => {
  const result = composeSlide({ ...heading, blocks: passages.map((text) => ({ text })) }, { layout: allAuto });
  const [first, second, third] = sizes(result);
  assert.ok(first === second && second === third && first >= 20, `one shared size, not a spread: ${sizes(result)}`);
  assert.deepEqual(result.diagnostics, []);
  const body = result.regions.find((region) => region.name === 'body');
  assert.ok(body.box.height > result.contentBox.height / 2, 'the auto row is not capped at half the content box');
});

test('a code payload in an auto row does not overflow', () => {
  const source = 'function routeReview(request) {\n  if (request.irreversible || request.risk > 3) {\n    return escalateToOwner(request);\n  }\n  return approveRoutineRequest(request);\n}';
  const result = composeSlide({ ...heading, code: { language: 'javascript', filename: 'review-policy.js', source } }, { layout: allAuto });
  assert.deepEqual(result.diagnostics, []);
  const code = result.items.find((item) => item.field === 'code');
  assert.equal(code.codeLayout.parts.find((part) => part.role === 'body').fit.fontSize, 22);
});

test('dense comparison options in an auto row keep at least 20 px, and the verdict follows them within one gap', () => {
  const option = (name) => `${name}\n${'Each team must complete training, collect baseline evidence, assign an accountable owner and confirm support capacity before this option can proceed. '.repeat(5)}`;
  // The comparison record with its option row sized auto, as WI-2 proposes.
  const record = structuredClone(layouts.comparison);
  record.regions[1].size = 'auto';
  const result = composeSlide({ ...heading, blocks: [{ region: 'first', text: option('Option A: focused pilot') }, { region: 'second', text: option('Option B: broad rollout') }, { region: 'verdict', text: 'Recommendation: establish the evidence with Option A before committing to Option B.' }] }, { layout: record });
  const [first, second, verdict] = ['first', 'second', 'verdict'].map((name) => result.items.find((item) => item.region === name));
  assert.ok(first.text.fontSize >= 20 && second.text.fontSize >= 20, `${first.text.fontSize} ${second.text.fontSize}`);
  assert.equal(result.diagnostics.length, 0);
  const options = result.regions.find((region) => region.name === 'first').box;
  assert.ok(verdict.box.y - (options.y + options.height) <= 720 / 30 + 1, 'one gap between the options and the verdict');
});

test('allocateRows: a body auto row may take more than half the box; the numeric rows keep their content need', () => {
  const heights = allocateRows([{ size: 'auto', need: 100, kind: 'heading' }, { size: 'auto', need: 400, kind: 'body' }, { size: 1, need: 50, kind: 'body' }], 600, 20);
  assert.equal(heights[0], 100);
  assert.equal(heights[1], 400);
  assert.ok(heights[2] >= 50 - 1e-6);
});

test('shareHeights: needs that fit are kept; otherwise each gives up the same share of what it can give up above its floor', () => {
  assert.deepEqual(shareHeights([30, 200], [20, 80], 300), [30, 200]);
  const [note, dense] = shareHeights([30, 600], [20, 250], 400);
  assert.ok(Math.abs(note + dense - 400) < 1e-9);
  assert.ok(note > 20 && dense > 250, 'both stay above their floors');
  assert.ok(note / 30 > dense / 600, 'the note, which can give up little, keeps more of its need');
  // Floors that do not fit share in proportion to the floors.
  assert.deepEqual(shareHeights([100, 100], [60, 20], 40), [30, 10]);
  // No floors (0): proportional, the earlier rule.
  assert.deepEqual(shareHeights([100, 300], [0, 0], 200), [50, 150]);
});
