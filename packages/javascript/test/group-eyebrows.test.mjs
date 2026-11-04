import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';

// LH-152 (a short label before a list or a group is its eyebrow) and LH-62 (decided: the quote layout keeps its whole-group stack).
const { layouts } = gallery;
const item = (result, field) => result.items.find((entry) => entry.field === field);
const findings = (result) => result.diagnostics.filter((entry) => entry.code === 'text-overflow' || entry.code === 'small-cell');
const gap = 720 / 30;

test('LH-62: a stacked record (quote) keeps its own whole-group stack, unchanged', () => {
  const slide = { title: 'Why Brightwater Foods switched', blocks: [{ quote: { text: 'We cut stockouts by a third in the first quarter.', attribution: 'Priya Raman' } }] };
  const result = composeSlide(slide, { layout: layouts.quote });
  const title = item(result, 'title').box, quote = item(result, 'quote');
  const top = Math.min(...quote.quoteLayout.parts.map((part) => part.box.y));
  assert.ok(title.y > result.contentBox.y + 100, 'the title moves with the quote (WI-2 stack)');
  assert.ok(top - (title.y + title.height) < 2 * gap, 'the quote follows its title');
});

test('LH-152: a short label before a list in a group is the list\'s eyebrow, over it in its column, not a cell beside it', () => {
  const slide = { title: 'Keep each owner close to their responsibilities', blocks: [
    { blocks: [{ text: 'Product team' }, { items: ['Resolve access blockers.', 'Confirm release scope.', 'Prepare the next pilot build.'] }] },
    { blocks: [{ text: 'Operations team' }, { items: ['Publish the support rotation.', 'Rehearse the exception route.', 'Review response-time trends.'] }] }] };
  for (const direction of ['ltr', 'rtl']) {
    const result = composeSlide(slide, { direction });
    const eyebrows = result.items.filter((entry) => entry.eyebrow), lists = result.items.filter((entry) => entry.field === 'items');
    assert.deepEqual(eyebrows.map((entry) => entry.path), ['slides.0.blocks.0.blocks.0.text', 'slides.0.blocks.1.blocks.0.text'], direction);
    for (const [index, eyebrow] of eyebrows.entries()) {
      const list = lists[index];
      assert.equal(result.items.indexOf(eyebrow) + 1, result.items.indexOf(list), `${direction}: read before its list`);
      assert.ok(eyebrow.box.y + eyebrow.box.height <= list.box.y + 1e-6 && list.box.y - (eyebrow.box.y + eyebrow.box.height) <= gap, `${direction}: right above its list`);
      assert.ok(Math.abs(eyebrow.box.x - list.box.x) < 1e-6 && Math.abs(eyebrow.box.width - list.box.width) < 1e-6, `${direction}: in its list's column`);
      assert.ok(eyebrow.text.fontSize < list.text.fontSize, `${direction}: smaller than its list`);
    }
    assert.equal(lists[0].box.y, lists[1].box.y, `${direction}: the two groups stay side by side as peers`);
    assert.deepEqual(findings(result), []);
  }
});

test('LH-152: a label that names a whole group is the group\'s eyebrow, over all its blocks; a label before a group heads that group', () => {
  const named = composeSlide({ title: 'Choose the rollout pace', blocks: [
    { blocks: [{ text: 'Conservative' }, { metric: { value: '1 team', label: 'Added per month' } }, { text: 'Lowest support load. Slower learning.' }] },
    { blocks: [{ text: 'Recommended' }, { metric: { value: '2 teams', label: 'Added per month' } }, { text: 'Balances support capacity with pace.' }] }] });
  for (const index of [0, 1]) {
    const eyebrow = named.items.find((entry) => entry.eyebrow && entry.path === `slides.0.blocks.${index}.blocks.0.text`);
    const members = named.items.filter((entry) => !entry.eyebrow && entry.path.startsWith(`slides.0.blocks.${index}.blocks.`));
    assert.equal(members.length, 2);
    const left = Math.min(...members.map((entry) => entry.box.x)), right = Math.max(...members.map((entry) => entry.box.x + entry.box.width));
    assert.ok(Math.abs(eyebrow.box.x - left) < 1e-6 && Math.abs(eyebrow.box.x + eyebrow.box.width - right) < 1e-6, 'it spans the group');
    assert.ok(members.every((entry) => entry.box.y >= eyebrow.box.y + eyebrow.box.height - 1e-6), 'over every block of the group');
  }
  const before = composeSlide({ title: 'Where each team starts', blocks: [
    { blocks: [{ text: 'Platform' }, { blocks: [{ text: 'Move the build to the shared runners first.' }, { items: ['Cache warm-up', 'Signed artifacts'] }] }] },
    { blocks: [{ text: 'Mobile' }, { blocks: [{ text: 'Ship the beta to the pilot group next.' }, { items: ['Crash reporting', 'Store listing'] }] }] }] });
  assert.deepEqual(before.items.filter((entry) => entry.eyebrow).map((entry) => entry.value), ['Platform', 'Mobile']);
  assert.deepEqual(findings(before), []);
});

test('LH-152: a root label before a list is its eyebrow, except in a layout whose lists draw step badges', () => {
  const slide = { title: 'Today', blocks: [{ text: 'Agenda' }, { items: ['Context', 'Options', 'Decision'] }] };
  assert.deepEqual(composeSlide(slide).items.filter((entry) => entry.eyebrow).map((entry) => entry.path), ['slides.0.blocks.0.text']);
  for (const id of ['agenda', 'process']) assert.deepEqual(composeSlide(slide, { layout: layouts[id] }).items.filter((entry) => entry.eyebrow), [], id);
  // An explicit arrangement keeps its blocks as authored, and a group of labels alone heads nothing.
  const authored = { title: 'Shared tracks', composition: { mode: 'row', weights: [2, 1, 1] }, blocks: [{ text: 'One' }, { composition: { mode: 'column' }, blocks: [{ text: 'Two' }, { items: ['Three'] }] }, { text: 'Four' }] };
  assert.deepEqual(composeSlide(authored).items.filter((entry) => entry.eyebrow), []);
  assert.deepEqual(composeSlide({ title: 'Labels', blocks: [{ text: 'Region' }, { blocks: [{ text: 'North' }, { text: 'South' }] }] }).items.filter((entry) => entry.eyebrow), []);
  // Two labels in a row, or a label before another label, are no eyebrows.
  assert.deepEqual(composeSlide({ title: 'Labels', blocks: [{ blocks: [{ text: 'North' }, { text: 'South' }, { text: 'East' }] }] }).items.filter((entry) => entry.eyebrow), []);
});
