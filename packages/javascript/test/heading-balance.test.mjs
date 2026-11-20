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

// RR-105: an authored run of two or more spaces, or a tab, between two words of a heading paragraph is the author's separation.
// The balancer keeps every such run at the end of a line, where it hangs, and never inside a balanced line, so it does not move the
// word before the run down beside it ("Strong quarter / across<17 spaces>business" when "across" fits on line 1). When no break set of
// the greedy line count does that, the paragraph keeps its greedy wrap, which is how PowerPoint wraps it. Nothing is trimmed.
const STRONG = 'Strong quarter across';
const runsOf = (text) => [{ text: text.slice(0, text.lastIndexOf('business')) }, { text: 'business', bold: true }];
const richBalanced = (value, width, size = 54) => fitRichText(value, box(width), size, 16, { style: { fontFamily: 'x', fontWeight: 700 }, textMeasurement: { measure }, balance: true });

test('RR-105: a run of two or more spaces never moves the word before it to the next line, plain and rich', () => {
  // At 700 every run wraps "business"; at 1000 only the 17-space run (the reported title) does: the others fit on one line.
  for (const [width, counts] of [[700, [2, 4, 8, 17]], [1000, [17]]]) {
    for (const count of counts) {
      const text = `${STRONG}${' '.repeat(count)}business`, label = `${count} spaces at ${width}`;
      const expected = greedy(text, width).lines;
      assert.ok(expected.length === 2 && expected[0] === `${STRONG}${' '.repeat(count)}`, `${label}: ${JSON.stringify(expected)}`);
      const plain = balanced(text, width);
      assert.deepEqual(plain.lines, expected, label);
      assert.equal(plain.fontSize, greedy(text, width).fontSize);
      assert.equal(plain.lines.join(''), text, 'the authored spaces stay in the source lines');
      const rich = richBalanced(runsOf(text), width);
      assert.deepEqual(rich.lines, expected, `rich ${label}`);
      // The second line is the bold run alone: run ownership and style are kept.
      assert.deepEqual(rich.richLines[1].fragments.map((part) => [part.runIndex, part.text, part.style.fontWeight]), [[1, 'business', 700]]);
    }
  }
});

test('RR-105: single spaces still balance exactly as before, plain and rich', () => {
  const text = `${STRONG} business`;
  assert.deepEqual(greedy(text, 700).lines, [`${STRONG} `, 'business']);
  assert.deepEqual(balanced(text, 700).lines, ['Strong quarter ', 'across business']);
  assert.deepEqual(richBalanced(runsOf(text), 700).lines, ['Strong quarter ', 'across business']);
  assert.deepEqual(balanced('A smaller pilot. A clearer decision.', 600).lines, ['A smaller pilot. ', 'A clearer decision.']);
});

test('RR-105: the balancer breaks at the run when it can, and keeps the greedy wrap when it cannot', () => {
  // The break at the run balances the lines: greedy would strand "business".
  const long = `${STRONG}  the core business`;
  assert.deepEqual(greedy(long, 1000).lines, [`${STRONG}  the core `, 'business']);
  assert.deepEqual(balanced(long, 1000).lines, [`${STRONG}  `, 'the core business']);
  assert.deepEqual(richBalanced([{ text: `${STRONG}  ` }, { text: 'the core business', bold: true }], 1000).lines, [`${STRONG}  `, 'the core business']);
  // Two spaces after a sentence: the balanced break is at the run.
  assert.deepEqual(balanced('A smaller pilot.  A clearer decision.', 600).lines, ['A smaller pilot.  ', 'A clearer decision.']);
  // Two runs in a two-line heading cannot both end a line: the greedy wrap stays.
  const twice = 'Strong  quarter across  business';
  assert.deepEqual(greedy(twice, 700).lines, ['Strong  quarter across  ', 'business']);
  assert.deepEqual(balanced(twice, 700).lines, greedy(twice, 700).lines);
  assert.deepEqual(richBalanced([twice], 700).lines, greedy(twice, 700).lines);
});

test('RR-105: a tab between words is a run too', () => {
  const text = `${STRONG}\tbusiness`;
  const expected = greedy(text, 700).lines;
  assert.deepEqual(expected, [`${STRONG}\t`, 'business']);
  assert.deepEqual(balanced(text, 700).lines, expected);
  assert.deepEqual(richBalanced(runsOf(text), 700).lines, expected);
});

test('RR-105: no-break space runs belong to their word and do not stop balancing', () => {
  for (const space of ['\u00a0', '\u202f']) {
    const text = `A${space}${space}smaller pilot. A clearer decision.`;
    assert.deepEqual(greedy(text, 600).lines, [`A${space}${space}smaller pilot. A `, 'clearer decision.']);
    assert.deepEqual(balanced(text, 600).lines, [`A${space}${space}smaller pilot. `, 'A clearer decision.']);
    assert.deepEqual(richBalanced([text], 600).lines, [`A${space}${space}smaller pilot. `, 'A clearer decision.']);
  }
  // A word joiner binds too: it is part of its word.
  const joined = 'A smaller\u2060pilot. A clearer decision.';
  assert.deepEqual(balanced(joined, 600).lines.map((line) => line.trim()), ['A smaller\u2060pilot.', 'A clearer decision.']);
});

test('RR-105: a run at the very start or end of a heading is not between words and the heading still balances', () => {
  const indented = '  A smaller pilot. A clearer decision.';
  assert.deepEqual(balanced(indented, 600).lines, ['  A smaller pilot. ', 'A clearer decision.']);
  assert.deepEqual(richBalanced([indented], 600).lines, ['  A smaller pilot. ', 'A clearer decision.']);
  const trailing = 'A smaller pilot. A clearer decision.   ';
  assert.deepEqual(balanced(trailing, 600).lines, ['A smaller pilot. ', 'A clearer decision.   ']);
  assert.deepEqual(richBalanced([trailing], 600).lines, ['A smaller pilot. ', 'A clearer decision.   ']);
});

test('RR-105: a hard break next to a run: each paragraph decides alone', () => {
  // The run ends the first paragraph (not between its words): the second paragraph still balances.
  const before = 'Line one   \nA smaller pilot. A clearer decision.';
  assert.deepEqual(balanced(before, 600).lines, ['Line one   ', 'A smaller pilot. ', 'A clearer decision.']);
  assert.deepEqual(richBalanced([before], 600).lines, ['Line one   ', 'A smaller pilot. ', 'A clearer decision.']);
  // The run is inside the second paragraph, where no balanced break set keeps it at a line end: that paragraph wraps greedily, and the
  // first paragraph's balanced break stays.
  const inside = 'A smaller pilot. A clearer decision.\nA smaller  pilot. A clearer decision.';
  const lines = balanced(inside, 600).lines;
  assert.deepEqual(lines, ['A smaller pilot. ', 'A clearer decision.', 'A smaller  pilot. A ', 'clearer decision.']);
  assert.deepEqual(richBalanced([inside], 600).lines, lines);
});

test('RR-105: the cover title keeps "across" on its first line under the default estimate', () => {
  const title = `${STRONG}${' '.repeat(17)}business`;
  for (const value of [title, runsOf(title)]) {
    const item = composeSlide({ title: value, subtitle: 'Revenue grew 34% YoY and net retention beat plan.' }, { layout: layouts.cover }).items.find((entry) => entry.field === 'title');
    assert.ok(item.text.lines[0].startsWith(STRONG), JSON.stringify(item.text.lines));
    assert.equal(item.text.lines.join(''), title);
  }
});
