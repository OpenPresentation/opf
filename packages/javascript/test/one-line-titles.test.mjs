import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';

// LH-51: a content slide's title steps down from 54 px in three equal steps (49.5, 45, 40.5) to the largest that keeps it on
// one line; only a title that wraps even at 40.5 px wraps, at 54 px. LH-76: such a "Topic: qualifier" title, on a slide with no
// subtitle, draws the topic as the title and the qualifier as the subtitle; the document keeps the whole title.
const { layouts } = gallery;
const STEPS = [54, 49.5, 45, 40.5];
const headings = (slide, layout = layouts.text, options = {}) => composeSlide(slide, { layout, ...options }).items.filter((item) => ['title', 'subtitle'].includes(item.field));
const title = (slide, layout, options) => headings(slide, layout, options).find((item) => item.field === 'title');
const near = (size, expected) => Math.abs(size - expected) < 0.02;

test('a short title keeps the role size', () => {
  const item = title({ title: 'Quarterly results', text: 'Body.' });
  assert.equal(item.text.fontSize, 54);
  assert.equal(item.text.lines.length, 1);
});

test('a title that would wrap steps down to one line, at one of the four steps', () => {
  const text = 'Revenue grew in every region this quarter, led by EMEA';
  const item = title({ title: text, text: 'Body.' });
  assert.equal(item.text.lines.length, 1);
  assert.ok(item.text.fontSize < 54 && STEPS.some((step) => near(item.text.fontSize, step)), String(item.text.fontSize));
  assert.equal(item.value, text);
  assert.equal(item.titleSplit, undefined);
  // Automatic composition (no layout record) steps the same way.
  assert.equal(title({ title: text, text: 'Body.' }, undefined).text.fontSize, item.text.fontSize);
});

test('a title that wraps even at the smallest step wraps at the role size', () => {
  const item = title({ title: 'Why the pilot matters for the whole programme and every team involved in it', text: 'Body.' });
  assert.equal(item.text.fontSize, 54);
  assert.ok(item.text.lines.length > 1);
});

test('covers, sections and statements never step their title down; a cover or section title grows (LH-129)', () => {
  const text = 'Revenue grew in every region this quarter, led by EMEA';
  for (const layout of [layouts.cover, layouts.section, layouts.text]) assert.ok(title({ title: text }, layout).text.fontSize >= 54, 'a slide with no body is a cover');
  assert.ok(title({ title: text }, layouts.section).text.fontSize > 54, 'its headings are the message (LH-129)');
  // LH-09: a statement's sentence title over its paragraph is its message and grows to display size.
  assert.ok(title({ title: text, text: 'One message.' }, layouts.statement).text.fontSize > 54);
});

test('a "Topic: qualifier" title that still wraps splits at the colon', () => {
  const text = 'Market sizing: a bottom-up estimate across every region we serve today';
  const [topic, qualifier] = headings({ title: text, text: 'Body.' });
  assert.deepEqual([topic.field, topic.path, topic.value, topic.text.lines.length], ['title', 'slides.0.title', 'Market sizing', 1]);
  assert.deepEqual(topic.titleSplit, { part: 'topic', start: 0, end: 13 });
  assert.deepEqual([qualifier.field, qualifier.path, qualifier.value], ['subtitle', 'slides.0.title', 'a bottom-up estimate across every region we serve today']);
  assert.deepEqual(qualifier.titleSplit, { part: 'qualifier', start: 15, end: text.length });
  assert.equal(qualifier.text.fontSize, 28);
  assert.ok(qualifier.box.y >= topic.box.y + topic.box.height, 'the qualifier sits below the topic');
  // Both parts together are the authored title.
  assert.equal(text.slice(0, topic.titleSplit.end) + text.slice(topic.titleSplit.end, qualifier.titleSplit.start) + qualifier.value, text);
});

test('no split with a subtitle, a rich title, a title that fits, or a separate subtitle area', () => {
  const text = 'Market sizing: a bottom-up estimate across every region we serve today';
  const withSubtitle = headings({ title: text, subtitle: 'Own subtitle', text: 'Body.' });
  assert.ok(withSubtitle.every((item) => !item.titleSplit));
  assert.equal(withSubtitle.find((item) => item.field === 'subtitle').value, 'Own subtitle');
  assert.ok(headings({ title: [{ text }], text: 'Body.' }).every((item) => !item.titleSplit));
  assert.ok(headings({ title: 'Plan: next steps', text: 'Body.' }).every((item) => !item.titleSplit));
  assert.ok(headings({ title: 'Ratio 3:1 across every region we serve today and the ones we enter', text: 'Body.' }).every((item) => !item.titleSplit));
  const ownSubtitle = { regions: [{ name: 'title', size: 'auto' }, { name: 'subtitle', size: 'auto' }, { name: 'body' }], direction: 'column' };
  assert.ok(headings({ title: text, text: 'Body.' }, ownSubtitle).every((item) => !item.titleSplit));
  // A statement keeps the whole title.
  assert.ok(headings({ title: text, text: 'One message.' }, layouts.statement).every((item) => !item.titleSplit));
});

test('a split happens only when the topic fits one line', () => {
  const text = 'An extraordinarily long topic phrase that cannot fit on one line at any step: and a qualifier';
  const items = headings({ title: text, text: 'Body.' });
  assert.equal(items.length, 1);
  assert.equal(items[0].value, text);
});
