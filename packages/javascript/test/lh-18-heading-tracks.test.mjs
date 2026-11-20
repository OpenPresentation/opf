// LH-18: sibling heading lists in one row (pillars, the cells of a grid, cards of a heading over its description) share
// the row's heading track, so their descriptions start on one line; sizes never change, and a row whose aligned tracks would not fit
// keeps its arrangement.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';
import { layouts } from './support/template-samples.mjs';

const pillar = (text, description) => ({ region: 'pillars', items: [{ text, description }] });
const unequal = [
  pillar('Reliable by design and proven in production', 'Every release runs for a week on our own traffic before a customer sees it.'),
  pillar('Fair', 'No overage fees. You pay one flat rate per user, whatever you use.'),
  pillar('Local support in every time zone', 'Engineers in your time zone answer within four minutes from the first day.'),
];
const equal = [pillar('Fast and safe', 'Support answers in under four minutes.'), pillar('Fair and flat', 'No overage fees. You pay one flat rate.'), pillar('Local and kind', 'Engineers in your time zone.')];
const lists = (result) => result.items.filter((item) => item.text?.listEntries?.length === 1 && item.text.listEntries[0].heading);
const entryOf = (item) => item.text.listEntries[0];
const findings = (result) => result.diagnostics.filter((entry) => entry.code === 'text-overflow' || entry.code === 'small-cell');
const compose = (blocks, layout, direction) => composeSlide({ title: 'Heading tracks', blocks }, { layout: layouts[layout], ...(direction ? { direction } : {}) });
const tolerance = 0.01;

for (const direction of ['ltr', 'rtl']) {
  test(`LH-18 (${direction}): pillars of unequal heading lengths start their descriptions on one line`, () => {
    const result = compose(unequal, 'pillars', direction);
    assert.deepEqual(findings(result), []);
    const pillars = lists(result);
    assert.equal(pillars.length, 3);
    const lines = pillars.map((item) => entryOf(item).text.richLines.length);
    assert.ok(new Set(lines).size > 1, 'the headings wrap to different line counts');
    const tops = pillars.map((item) => entryOf(item).descriptionBox.y);
    assert.ok(tops.every((top) => Math.abs(top - tops[0]) < tolerance), `descriptions start together: ${tops}`);
    // Headings start together too and keep the size they have; the descriptions share one size.
    assert.ok(pillars.every((item) => Math.abs(entryOf(item).textBox.y - entryOf(pillars[0]).textBox.y) < tolerance));
    assert.equal(new Set(pillars.map((item) => entryOf(item).text.fontSize)).size, 1);
    assert.equal(new Set(pillars.map((item) => entryOf(item).description.fontSize)).size, 1);
    // The shorter headings only gained space: every list ends inside the room it was fitted in.
    for (const item of pillars) {
      const entry = entryOf(item);
      assert.ok(entry.descriptionBox.y + entry.descriptionBox.height <= item.box.y + item.box.height + 0.5, 'inside its cell');
      assert.equal(item.text.overflow, false);
    }
  });
}

test('LH-18: pillars whose headings wrap alike are not moved', () => {
  const result = compose(equal, 'pillars');
  const tops = lists(result).map((item) => entryOf(item).descriptionBox.y - entryOf(item).textBox.y - entryOf(item).textBox.height);
  assert.ok(tops.every((gap) => Math.abs(gap - tops[0]) < tolerance), 'every description sits the same gap under its heading');
});

test('LH-18: the height a heading adds is the tallest heading minus its own, and the list grows by as much', () => {
  const result = compose(unequal, 'pillars');
  const pillars = lists(result), track = Math.max(...pillars.map((item) => entryOf(item).textBox.height));
  const gaps = pillars.map((item) => entryOf(item).descriptionBox.y - entryOf(item).textBox.y - track);
  assert.ok(gaps.every((gap) => Math.abs(gap - gaps[0]) < tolerance), 'one gap under the shared track');
  for (const item of pillars) {
    const entry = entryOf(item);
    assert.ok(Math.abs(item.text.height - (entry.descriptionBox.y + entry.descriptionBox.height - entry.textBox.y)) < tolerance, 'the list height covers the moved description');
  }
});

test('LH-18: six pillars in two rows align each row on its own track, and a row whose aligned tracks would not fit keeps its arrangement', () => {
  const blocks = [
    pillar('How long do I have to return an item?', '45 days from delivery.'),
    pillar('Is return shipping free?', 'Yes, for orders in the United States and Canada.'),
    pillar('When will I get my refund?', 'Two business days after we inspect the item.'),
    pillar('Can I exchange?', 'Yes. Choose "exchange" in the app and we ship the new size first.'),
    pillar('What if my item arrived damaged or was not what I ordered?', 'Send a photo and we will replace it without a return.'),
    pillar('Do gift returns work?', 'Gift recipients receive store credit with no questions asked.'),
  ];
  const result = compose(blocks, 'pillars');
  assert.deepEqual(findings(result), []);
  const cells = lists(result);
  assert.equal(cells.length, 6);
  for (const row of [cells.slice(0, 3), cells.slice(3)]) {
    const tops = row.map((item) => entryOf(item).descriptionBox.y), aligned = tops.every((top) => Math.abs(top - tops[0]) < tolerance);
    // Aligned, or left as it was because the track would not fit: never overflowing, never smaller.
    for (const item of row) assert.equal(item.text.overflow, false);
    if (!aligned) {
      const heads = row.map((item) => entryOf(item).text.richLines.length);
      assert.ok(new Set(heads).size > 1);
      for (const item of row) assert.ok(Math.abs(entryOf(item).descriptionBox.y - entryOf(item).textBox.y - entryOf(item).textBox.height) < 20, 'a description under its own heading');
    }
  }
  // The text sizes are one for the whole grid, as LH-43 gives them.
  assert.equal(new Set(cells.map((item) => entryOf(item).description.fontSize)).size, 1);
});

test('LH-18: a row whose tallest heading leaves no room for a taller description is left as it was', () => {
  // The long heading and the long description sit in different pillars: aligning would need the heading track plus the longest description.
  const blocks = [
    pillar('A heading that wraps to many lines because it is long and keeps going on and on and on', 'Short.'),
    pillar('Short', 'A description that runs long enough to wrap to many lines of its own because it keeps going, and going, and going, and then some more words for good measure, and a few more.'),
  ];
  const result = compose(blocks, 'two-column'.replace('two-column', 'pillars'));
  assert.deepEqual(findings(result), []);
  const gaps = lists(result).map((item) => entryOf(item).descriptionBox.y - entryOf(item).textBox.y - entryOf(item).textBox.height);
  assert.ok(gaps.every((gap) => Math.abs(gap - gaps[0]) < tolerance), 'each description keeps its own gap under its heading');
  for (const item of lists(result)) {
    const entry = entryOf(item);
    assert.equal(item.text.overflow, false);
    assert.ok(entry.descriptionBox.y + entry.descriptionBox.height <= item.box.y + item.box.height + 0.5, 'inside its cell');
  }
});
