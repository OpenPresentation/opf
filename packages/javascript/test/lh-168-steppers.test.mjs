// LH-168: steps whose descriptions wrap draw as a stepper (badges on a connector) in left-to-right decks as they do in right-to-left ones:
// the step badges' guard compared a list's base size, which is the label's in the columns and the description's beside a badge, so
// a stepper set larger on every line (32 over 30) read as smaller (32 against 37) and lost; it now compares the smallest size drawn.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';
import { layouts } from './support/template-samples.mjs';

const { process: processLayout } = layouts;
const plain = (record) => ({ ...record, regions: record.regions.map(({ sequence: _sequence, ...region }) => region) });
const step = (text, description, start) => ({ region: 'steps', items: [{ text, description }], numbering: { style: 'arabic', start } });
const slide = (title, steps) => ({ title, blocks: steps.map(([text, description], index) => step(text, description, index + 1)) });
const findings = (result) => result.diagnostics.filter((entry) => ['text-overflow', 'small-cell', 'layout-unplaced'].includes(entry.code));
// The smallest size any line of the body draws: a list's label and description sizes (its fontSize is only the base of the two).
const drawn = (result) => Math.min(...result.items.filter((item) => !['title', 'subtitle', 'tag'].includes(item.field)).flatMap((item) => item.text.listEntries?.flatMap((entry) => [entry.text.fontSize, ...(entry.description ? [entry.description.fontSize] : [])]) ?? [item.text.fontSize]));

const returns = slide('From return request to refund in five steps', [
  ['Request', 'The customer starts a return in the app and picks a reason.'],
  ['Label', 'A prepaid label arrives by email within a minute.'],
  ['Inspect', 'The returns team grades the item within 48 hours of arrival.'],
  ['Restock or recycle', 'Sellable items return to the shelf; the rest are recycled.'],
  ['Refund', 'Money goes back to the original payment method in two business days.'],
]);
const clinic = slide('Getting a new clinic live in 30 days', [
  ['Kickoff', 'Confirm goals, data sources and a named owner on each side.'],
  ['Connect', 'Link the scheduling system and import 24 months of records.'],
  ['Train', 'Two 90-minute sessions for front desk and clinical staff.'],
  ['Go live', 'Daily check-ins for the first week, then weekly reviews.'],
]);

for (const [name, deck] of [['five steps', returns], ['four steps', clinic]]) {
  for (const direction of ['ltr', 'rtl']) {
    test(`LH-168 (${direction}): ${name} with wrapping descriptions draw as a stepper that sets no line smaller`, () => {
      const result = composeSlide(deck, { layout: processLayout, direction }), without = composeSlide(deck, { layout: plain(processLayout), direction });
      assert.deepEqual(result.steps?.map((entry) => entry.form), ['row']);
      assert.equal(result.steps[0].badges.length, deck.blocks.length);
      assert.ok(drawn(result) >= drawn(without) - 1e-6, `drawn ${drawn(result)} against ${drawn(without)} in columns`);
      assert.deepEqual(findings(result), []);
      // Centered under the title as the columns are, not set against it.
      const body = result.items.filter((item) => item.region === 'steps'), top = Math.min(...result.steps[0].badges.map((badge) => badge.cy - badge.radius));
      const bottom = Math.max(...body.map((item) => item.box.y + item.box.height)), titleBottom = Math.max(...result.items.filter((item) => item.field === 'title').map((item) => item.box.y + item.box.height));
      const above = top - titleBottom, below = result.contentBox.y + result.contentBox.height - bottom;
      assert.ok(above > 0 && below >= 0);
    });
  }
}

test('LH-168: steps whose descriptions are long enough to lose size under the badges keep the columns', () => {
  const long = 'Write down the decision the board must take, the evidence it needs, the date it needs it by and who owns each part of it.';
  const result = composeSlide(slide('Six steps to a funded program', Array.from({ length: 6 }, (_, index) => [`Step number ${index + 1} of the program`, long])), { layout: processLayout }), without = composeSlide(slide('Six steps to a funded program', Array.from({ length: 6 }, (_, index) => [`Step number ${index + 1} of the program`, long])), { layout: plain(processLayout) });
  assert.equal(result.steps, undefined);
  assert.ok(drawn(result) >= drawn(without) - 1e-6);
});
