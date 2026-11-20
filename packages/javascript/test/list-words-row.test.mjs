import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { resolveSlideContext } from '../dist/index.js';
import { composeSlide } from '../dist/composition.js';

// OPF 0.35 (the release supervisor's narrow-column words; the owner's "never shrink text"): in a row of cells sized by
// composition.weights, a list's cell narrower than its longest word broke the word ("acknowledg|ment"). The row is rebalanced (or
// stacked) so every word holds, and the list is never set smaller to do it (a reverted change kept the words whole by setting the list
// tiny). The decks are the supervisor's, at core's estimated measurement; `before` is what the branch drew before the rule (the list's
// size and its weighted cell's width, with a word broken), measured on 254f888b4.
const deck = (name) => JSON.parse(readFileSync(new URL(`./fixtures/list-words-${name}.opf.json`, import.meta.url), 'utf8'));
const word = /[\p{L}\p{N}]/u;
const cutsWord = (entry) => entry.text.richLines.slice(1).some((line, index) => {
  const last = entry.text.richLines[index].fragments.filter((fragment) => fragment.kind === undefined).at(-1), first = line.fragments.find((fragment) => fragment.kind === undefined);
  if (!last || !first || last.runIndex !== first.runIndex || first.start !== last.end) return false;
  return word.test([...last.text].at(-1) ?? '') && word.test([...first.text][0] ?? '');
});
const compose = (document, index) => {
  const context = resolveSlideContext(document, index);
  return composeSlide(context.slide, context.options);
};
const of = (composed, field) => composed.items.find((item) => item.field === field);
const entries = (item) => item.listColumns?.flatMap((column) => column.text.listEntries) ?? item.text.listEntries;

for (const [name, index, label, before] of [
  ['wordsplit', 0, 'narrow weighted row', { size: 32, width: 190, text: 28 }],
  ['wordsplit', 1, 'a word wider than its column', { size: 32, width: 114, text: 28 }],
  ['noroom', 0, 'a narrow row of an icon list', { size: 23, width: 190, text: 28 }],
]) {
  test(`${label}: every word of the list holds, at the size the list had or larger`, () => {
    const composed = compose(deck(name), index), list = of(composed, 'items');
    assert.ok(!entries(list).some(cutsWord), 'no word breaks');
    assert.ok(list.text.fontSize >= before.size - 0.01, `the list is not set smaller (${before.size} -> ${list.text.fontSize})`);
    assert.ok(list.box.width > before.width, `the list cell widened (${before.width} -> ${list.box.width})`);
    assert.ok(of(composed, 'text').text.fontSize >= before.text - 0.01, 'the paragraph beside it keeps its size');
    assert.equal(composed.diagnostics.filter((entry) => entry.code === 'text-overflow').length, 0);
  });
}

test('a list that holds its words keeps the weighted row as authored', () => {
  const document = { slides: [{ title: 'Room enough', composition: { mode: 'row', weights: [3, 2] }, blocks: [{ text: 'The gateway only validates and enqueues.' }, { items: ['Ack fast', 'Scale out', 'Replay'] }] }] };
  const composed = compose(document, 0), text = of(composed, 'text'), list = of(composed, 'items');
  assert.ok(Math.abs(text.box.width / list.box.width - 1.5) < 0.05, `3 : 2 kept (${text.box.width} : ${list.box.width})`);
});

test('a row whose neighbors cannot give the width up never sets the list smaller', () => {
  const long = 'A paragraph long enough to fill its cell at its size, so it has no width to give up to its neighbor without wrapping onto more lines than its cell holds at this size, and then some more words to be sure of it.';
  const document = { slides: [{ title: 'Crowded row', composition: { mode: 'row', weights: [3, 3, 1] }, blocks: [{ text: long }, { text: long }, { items: ['Internationalization', 'Localization', 'Accessibility'] }] }] };
  const composed = compose(document, 0), list = of(composed, 'items');
  assert.ok(list.text.fontSize >= 23 - 0.01, `the list keeps a readable size (${list.text.fontSize})`);
  assert.ok(composed.items.filter((item) => item.field === 'text').every((item) => item.text.fontSize >= 20), 'the paragraphs are not set smaller to make room');
});
