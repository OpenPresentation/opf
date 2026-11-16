// A list never splits a word (as LH-44 rules for table cells): in a narrow cell it steps down to the size its longest word fits at, never
// under its minimum; where even the minimum is too large, the list is an overflow with a finding that says what to change.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { composeSlide } from '../dist/composition.js';
import { resolveSlideContext } from '../dist/index.js';

const compose = (slide) => {
  const document = { $schema: 'https://openpresentation.org/schema/opf/v1', language: 'en-US', design: { theme: 'classic', colorScheme: 'corporate-blue', fontScheme: 'aptos' }, slides: [slide] };
  const context = resolveSlideContext(document, 0, { catalogs: [gallery] });
  return composeSlide(context.slide, context.options);
};
const words = (entries) => entries.flatMap((entry) => entry.split(/\s+/u));
const drawnWords = (list) => list.text.listEntries.flatMap((entry) => entry.text.richLines.map((line) => line.fragments.map((fragment) => fragment.text).join('')).join(' ').split(/\s+/u).filter(Boolean));

test('a list in a narrow weighted cell keeps every word whole', () => {
  const entries = ['Fast acknowledgment', 'Scale on queue depth', 'Append-only ledger', 'Replay safely'];
  const composed = compose({ title: 'Narrow weighted row', composition: { mode: 'row', weights: [5, 1] }, blocks: [{ text: 'The gateway only validates and enqueues; workers are stateless and scale on queue depth.' }, { items: entries.map((text) => ({ text })) }] });
  const list = composed.items.find((item) => item.field === 'items');
  for (const word of words(entries)) assert.ok(drawnWords(list).includes(word), `"${word}" is drawn whole`);
  assert.ok(list.text.fontSize >= 16, 'never under the minimum');
  assert.equal(composed.diagnostics.filter((entry) => entry.code === 'text-overflow').length, 0);
});

test('a word wider than its column at the minimum size is reported, not split silently', () => {
  const composed = compose({ title: 'A word wider than its column', composition: { mode: 'row', weights: [9, 1] }, blocks: [{ text: 'The column beside this paragraph is too narrow for its longest word even at the minimum size.' }, { items: [{ text: 'Internationalization' }, { text: 'Localization' }] }] });
  const list = composed.items.find((item) => item.field === 'items');
  assert.equal(list.text.fontSize, 16, 'at the minimum, not under it');
  const finding = composed.diagnostics.find((entry) => entry.code === 'text-overflow' && entry.path === 'slides.0.blocks.1.items');
  assert.ok(finding, 'reported');
  assert.match(finding.message, /wider than its column/);
  assert.match(finding.message, /composition\.weights/);
});
