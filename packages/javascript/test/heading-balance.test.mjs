import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide, fitRichText, fitText, measureText } from '../dist/composition.js';

// WI-4 (P15): a wrapped title or subtitle keeps its size and line count and balances its breaks (the variance of the line
// widths, with a credit for a line that ends a sentence), so the last line is not a stranded word. An explicit line break stays
// authoritative; body text keeps the greedy wrap.
const { layouts } = gallery;
const measure = (text, size) => [...text].length * size * 0.5;
const box = (width, height = 400) => ({ x: 0, y: 0, width, height });
const greedy = (text, width, size = 54) => fitText(text, box(width), size, 16, measure, undefined, false);
const balanced = (text, width, size = 54) => fitText(text, box(width), size, 16, measure, undefined, true);

test('the cover title balances at the same size and line count', () => {
  const text = 'A smaller pilot. A clearer decision.';
  assert.deepEqual(greedy(text, 600).lines, ['A smaller pilot. A ', 'clearer decision.']);
  const fit = balanced(text, 600);
  assert.deepEqual(fit.lines.map((line) => line.trim()), ['A smaller pilot.', 'A clearer decision.']);
  assert.equal(fit.fontSize, greedy(text, 600).fontSize);
  assert.equal(fit.overflow, false);
  // The rich-text path balances the same way.
  const rich = fitRichText([text], box(600), 54, 16, { style: { fontFamily: 'x', fontWeight: 700 }, textMeasurement: { measure }, balance: true });
  assert.deepEqual(rich.lines.map((line) => line.trim()), ['A smaller pilot.', 'A clearer decision.']);
});

test('without a sentence end the lines even out and the last line is not a single word', () => {
  const text = 'Compare paragraph, talking points, and structured list';
  assert.equal(greedy(text, 1100).lines.at(-1).trim(), 'structured list');
  const lines = balanced(text, 1100).lines.map((line) => line.trim());
  assert.equal(lines.length, 2);
  const widths = lines.map((line) => line.length);
  assert.ok(Math.abs(widths[0] - widths[1]) <= 6, widths.join('/'));
});

test('an explicit newline wins: each paragraph balances alone and the break stays', () => {
  const fit = balanced('Line one\nA smaller pilot. A clearer decision.', 600);
  assert.deepEqual(fit.lines.map((line) => line.trim()), ['Line one', 'A smaller pilot.', 'A clearer decision.']);
});

test('balancing never adds a line, never reduces the size and leaves one-line titles alone', () => {
  assert.deepEqual(balanced('Short title', 600).lines, ['Short title']);
  for (const width of [420, 520, 640, 780, 900, 1100]) {
    for (const text of ['Remove the handoff that slows every review process now', 'The next rollout should preserve clear ownership while giving support time', 'One extraordinarily-long-unbreakable-heading-word and then a few more words']) {
      const before = greedy(text, width), after = balanced(text, width);
      assert.equal(after.lines.length, before.lines.length, `${text} at ${width}`);
      assert.equal(after.fontSize, before.fontSize);
      assert.equal(after.lines.join('').replace(/\s/g, ''), text.replace(/\s/g, ''), 'no word is lost or split');
      assert.ok(after.lines.every((line) => !line.trim() || measure(line.trim(), after.fontSize) <= width + 0.01));
    }
  }
});

test('a title that does not fit keeps its greedy wrap at the floor', () => {
  const text = 'Words '.repeat(60);
  const before = greedy(text, 400), after = balanced(text, 400);
  assert.equal(after.overflow, before.overflow);
  assert.deepEqual(after.lines, before.lines);
});

test('the three-line heading of auto 19 never shrinks to balance', () => {
  const title = 'The next rollout should preserve clear ownership while giving support time to resolve the remaining access dependencies';
  const result = composeSlide({ title, subtitle: 'A measured expansion creates enough variation to test the process.', items: ['Close the remaining access blockers'] }, { layout: layouts.list });
  const item = result.items.find((entry) => entry.field === 'title');
  // The greedy fit of the same box and the same estimate: the balanced title keeps its size and its three lines.
  const plain = fitText(title, { ...item.box, height: 720 * 0.26 }, 54, 16, measureText);
  assert.equal(item.text.fontSize, plain.fontSize);
  assert.equal(item.text.lines.length, plain.lines.length);
  assert.equal(item.text.lines.length, 3);
  const widths = item.text.lines.map((line) => line.trim().length);
  assert.ok(Math.max(...widths) - Math.min(...widths) < 30, widths.join('/'));
  assert.equal(result.items.find((entry) => entry.field === 'subtitle').text.fontSize, 28);
});

test('body text keeps the greedy wrap', () => {
  const result = composeSlide({ title: 'Body', text: 'A smaller pilot. A clearer decision. '.repeat(8) }, { layout: layouts.text });
  const item = result.items.find((entry) => entry.field === 'text');
  const widths = item.text.lines.slice(0, -1).map((line) => line.length);
  assert.ok(widths.length > 1);
  // A greedy wrap fills every line but the last; a balanced one would take shorter lines.
  assert.ok(Math.min(...widths) >= Math.max(...widths) - 14, widths.join('/'));
});
