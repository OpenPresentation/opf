// LH-188: a one-message slide's statement, quote or lone figure grows past today's caps as far as its length allows, to the length-keyed
// ceilings, keeping every word whole, its lines balanced and the body's fill target; a title over a paragraph is no statement.
import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  composeSlide, FIGURE_CEILING, HEADING_DISPLAY_SIZES, LONE_DISPLAY_SIZES, MESSAGE_CEILINGS, MESSAGE_DISPLAY_SIZE, messageCeiling, messageCharacters, oneMessageField,
} from '../dist/composition.js';

const { layouts } = gallery;
const item = (result, field) => result.items.find((entry) => entry.field === field);
const lines = (fit) => ('richLines' in fit ? fit.richLines.map((line) => line.fragments.map((fragment) => fragment.text).join('')) : fit.lines);
const words = (text) => text.trim().split(/\s+/u);
// Every line holds whole words of the text: joined again they give its words back.
const wholeWords = (text, fit) => assert.deepEqual(lines(fit).flatMap(words).filter(Boolean), words(text), `no word is broken (${JSON.stringify(lines(fit))})`);

test('LH-188: characters count grapheme clusters, a run of white space as one and a full-width character as two', () => {
  assert.equal(messageCharacters('Ship in March.'), 14);
  assert.equal(messageCharacters('  Ship   in\nMarch. '), 14);
  assert.equal(messageCharacters([{ text: 'Ship ' }, { text: 'in March.', bold: true }]), 14);
  assert.equal(messageCharacters('三月に出荷します'), 16);
  assert.equal(messageCharacters('مرحبا بالعالم'), 13);
  assert.equal(messageCharacters('Café 👩‍👩‍👧'), 6);
  assert.equal(messageCharacters(''), 0);
});

test('LH-188: the ceilings by length, from the shortest row; past the last row there is none', () => {
  const of = (kind, length) => messageCeiling(kind, 'x'.repeat(length));
  assert.deepEqual([of('statement', 1), of('statement', 30), of('statement', 31), of('statement', 60), of('statement', 61), of('statement', 120), of('statement', 121)], [115, 115, 80, 80, 54, 54, undefined]);
  assert.deepEqual([of('quote', 30), of('quote', 31), of('quote', 60), of('quote', 61), of('quote', 120), of('quote', 121)], [86, 72, 72, 56, 56, undefined]);
  assert.equal(messageCeiling('statement', ''), undefined);
  assert.deepEqual(MESSAGE_CEILINGS.statement.map(([, size]) => Math.round(size / 7.2 * 10) / 10), [16, 11.1, 7.5], 'shares of the 720 px short edge');
  assert.deepEqual(FIGURE_CEILING, { characters: 6, size: 252 });
});

test('LH-188: a one-message slide has one text, quote or metric, no subtitle, and no title or one that only labels it', () => {
  assert.equal(oneMessageField({ text: 'Ship in March.' }), 'text');
  assert.equal(oneMessageField({ title: 'Our goal', text: 'Ship in March.' }), 'text');
  assert.equal(oneMessageField({ blocks: [{ quote: { text: 'Less, but better.' } }] }), 'quote');
  assert.equal(oneMessageField({ title: 'Runway', metric: { value: '18 mo' } }), 'metric');
  assert.equal(oneMessageField({ title: 'Why we moved the ledger.', text: 'It was slow.' }), undefined, 'a title that is a sentence');
  assert.equal(oneMessageField({ title: 'Why we moved the ledger this year', text: 'It was slow.' }), undefined, 'a title of more than four words');
  assert.equal(oneMessageField({ title: 'Goal', subtitle: '2027', text: 'Ship in March.' }), undefined, 'a subtitle');
  assert.equal(oneMessageField({ blocks: [{ text: 'Ship.' }, { text: 'Then sell.' }] }), undefined, 'two blocks');
  assert.equal(oneMessageField({ items: ['One', 'Two'] }), undefined, 'a list');
  assert.equal(oneMessageField({ title: 'Cover title' }), undefined, 'no body');
});

test('LH-188: a short statement grows to its ceiling, a medium one to its own, a long one keeps today\'s cap', () => {
  const short = item(composeSlide({ text: 'Ship in March.' }), 'text');
  assert.ok(short.text.fontSize > HEADING_DISPLAY_SIZES.title && short.text.fontSize <= MESSAGE_CEILINGS.statement[0][1], `${short.text.fontSize}`);
  const statement = 'Teams that own their calendar ship twice as often.';
  assert.ok(messageCharacters(statement) > 30 && messageCharacters(statement) <= 60);
  const medium = item(composeSlide({ title: 'Our position', text: statement }), 'text');
  assert.ok(medium.text.fontSize > MESSAGE_DISPLAY_SIZE && medium.text.fontSize <= MESSAGE_CEILINGS.statement[1][1], `${medium.text.fontSize}`);
  wholeWords(statement, medium.text);
  const sentence = 'Teams that owned their release calendar shipped twice as often as teams on the shared release train.';
  assert.ok(messageCharacters(sentence) > 60);
  const long = item(composeSlide({ text: sentence }), 'text');
  assert.ok(long.text.fontSize <= MESSAGE_DISPLAY_SIZE + 1e-6, `today's cap (${long.text.fontSize})`);
  // On the statement layout as in automatic composition.
  const record = item(composeSlide({ layout: 'statement', blocks: [{ region: 'message', text: 'Ship in March.' }] }, { layout: layouts.statement }), 'text');
  assert.equal(record.text.fontSize, short.text.fontSize);
});

test('LH-188: a title over a paragraph is no statement: the paragraph keeps today\'s sizes', () => {
  const title = 'Why we moved the ledger.', text = 'It was slow and costly.';
  const content = item(composeSlide({ title, text }), 'text');
  assert.ok(content.text.fontSize <= HEADING_DISPLAY_SIZES.title + 1e-6, `${content.text.fontSize}`);
  const statement = composeSlide({ title, blocks: [{ region: 'message', text }] }, { layout: layouts.statement });
  assert.ok(item(statement, 'text').text.fontSize <= HEADING_DISPLAY_SIZES.title + 1e-6);
});

test('LH-188: a statement never grows into a broken word', () => {
  const text = 'Internationalization everywhere.';
  const grown = item(composeSlide({ text }), 'text');
  wholeWords(text, grown.text);
  assert.ok(grown.text.fontSize >= MESSAGE_DISPLAY_SIZE - 1e-6, `it still grows (${grown.text.fontSize})`);
});

test('LH-188: right to left and CJK statements grow by their length too', () => {
  const arabic = item(composeSlide({ text: 'الإطلاق في مارس' }, { direction: 'rtl' }), 'text');
  assert.ok(arabic.text.fontSize > HEADING_DISPLAY_SIZES.title, `${arabic.text.fontSize}`);
  const japanese = item(composeSlide({ text: '三月に出荷します' }, { language: 'ja' }), 'text');
  assert.ok(japanese.text.fontSize > HEADING_DISPLAY_SIZES.title && japanese.text.fontSize <= 115, `${japanese.text.fontSize}`);
});

test('LH-188: a one-message quote grows to its ceiling, alone and on the quote layout', () => {
  const quote = { text: 'Less, but better.', attribution: 'Dieter Rams' };
  const body = (result) => item(result, 'quote').quoteLayout.parts.find((part) => part.role === 'body');
  const lone = body(composeSlide({ quote }));
  assert.ok(lone.fit.fontSize > LONE_DISPLAY_SIZES.quote && lone.fit.fontSize <= MESSAGE_CEILINGS.quote[0][1], `${lone.fit.fontSize}`);
  const record = body(composeSlide({ layout: 'quote', blocks: [{ region: 'quotes', quote }] }, { layout: layouts.quote }));
  assert.ok(record.fit.fontSize > LONE_DISPLAY_SIZES.quote && record.fit.fontSize <= MESSAGE_CEILINGS.quote[0][1], `${record.fit.fontSize}`);
  // Beside a sentence title the quote keeps today's cap.
  const titled = body(composeSlide({ title: 'What our customers told us in the survey', quote }));
  assert.ok(titled.fit.fontSize <= LONE_DISPLAY_SIZES.quote + 1e-6, `${titled.fit.fontSize}`);
});

test('LH-188: a lone figure of six characters or fewer grows to FIGURE_CEILING; a longer one keeps LONE_DISPLAY_SIZES.value', () => {
  const value = (result) => item(result, 'metric').metricLayout.parts.find((part) => part.role === 'value').fit;
  const short = value(composeSlide({ metric: { value: '$1.2M', label: 'Annual revenue' } }));
  assert.ok(short.fontSize > LONE_DISPLAY_SIZES.value && short.fontSize <= FIGURE_CEILING.size, `${short.fontSize}`);
  assert.equal(short.lines.length, 1);
  const long = value(composeSlide({ metric: { value: '$1,234,567', label: 'Annual revenue' } }));
  assert.ok(long.fontSize <= LONE_DISPLAY_SIZES.value + 1e-6, `${long.fontSize}`);
});

test('LH-188: with fill off nothing grows', () => {
  assert.ok(item(composeSlide({ text: 'Ship in March.' }, { fill: false }), 'text').text.fontSize <= LONE_DISPLAY_SIZES.text);
});
