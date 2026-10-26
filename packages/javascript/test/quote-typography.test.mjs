import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ASCII_QUOTE_MARKS, QUOTE_MARKS, QUOTE_NOMINAL_SIZE, QUOTE_SOURCE_SEPARATOR, composeSlide, isWrappedInQuoteMarks, layoutQuote, quoteMarksFor, unwrapQuoteMarks } from '../dist/composition.js';

// WI-4 (P17 size, N3): a quote body asks for 40 px and fits down (28 px and below); the marks are the typographic pair of the
// deck language ("..." for English), ASCII only for a language the table does not know; attribution and source join with an en dash.
const { layouts } = gallery;
const cell = { x: 0, y: 0, width: 1000, height: 400 };

test('the marks follow the deck language; an unknown language draws ASCII, no language reads as English', () => {
  assert.deepEqual(quoteMarksFor('en'), { open: '“', close: '”' });
  assert.deepEqual(quoteMarksFor('en-GB'), { open: '“', close: '”' });
  assert.deepEqual(quoteMarksFor('de-DE'), { open: '„', close: '“' });
  assert.deepEqual(quoteMarksFor('de-CH'), { open: '«', close: '»' });
  assert.deepEqual(quoteMarksFor('fr'), { open: '«', close: '»' });
  assert.deepEqual(quoteMarksFor('ja'), { open: '「', close: '」' });
  assert.deepEqual(quoteMarksFor('zh-TW'), { open: '「', close: '」' });
  assert.deepEqual(quoteMarksFor('zh-CN'), { open: '“', close: '”' });
  assert.deepEqual(quoteMarksFor('da'), { open: '»', close: '«' });
  assert.deepEqual(quoteMarksFor('xx'), ASCII_QUOTE_MARKS);
  assert.deepEqual(quoteMarksFor(undefined), QUOTE_MARKS.en);
  // Every mark is one UTF-16 code unit: a quote body's source offsets shift by exactly one.
  for (const [tag, marks] of Object.entries(QUOTE_MARKS)) assert.equal(marks.open.length + marks.close.length, 2, tag);
});

test('layoutQuote draws the pair of its language around the body and offsets the source by one', () => {
  for (const [language, open, close] of [[undefined, '“', '”'], ['en-US', '“', '”'], ['de', '„', '“'], ['es', '«', '»'], ['xx', '"', '"']]) {
    const body = layoutQuote({ text: 'Keep it simple.', attribution: 'Ada' }, cell, { ...(language ? { language } : {}) }).parts[0];
    assert.equal(body.text, `${open}Keep it simple.${close}`, String(language));
    assert.equal(body.sources[0].outputStart, 1);
    assert.equal(body.text.slice(body.sources[0].outputStart, body.sources[0].outputEnd), 'Keep it simple.');
  }
  // A rich body joins the marks to its first and last run.
  const rich = layoutQuote({ text: ['Cut review time by ', { text: '40%', bold: true }, ' in a quarter'] }, cell, { language: 'de' }).parts[0];
  assert.equal(rich.runs[0], '„Cut review time by ');
  assert.equal(rich.runs[2], ' in a quarter“');
});

test('a slide takes its quote marks from the deck language', () => {
  const slide = { title: 'Voices', quote: { text: 'Das funktioniert.', attribution: 'Mia' } };
  const body = (presentation) => composeSlide(slide, { layout: layouts.quote, presentation }).items.find((item) => item.field === 'quote').quoteLayout.parts[0].text;
  assert.equal(body(undefined), '“Das funktioniert.”');
  assert.equal(body({ language: 'de-DE' }), '„Das funktioniert.“');
  assert.equal(body({ language: 'fr' }), '«Das funktioniert.»');
  assert.equal(body({ language: 'sw' }), '"Das funktioniert."');
});

test('a short quote requests 40 px, a long one fits down through 28 px before the floor', () => {
  assert.equal(QUOTE_NOMINAL_SIZE, 40);
  const short = layoutQuote({ text: 'Short and clear.', attribution: 'Ada' }, cell).parts[0];
  assert.equal(short.requestedFontSize, 40);
  assert.equal(short.fit.fontSize, 40);
  const long = layoutQuote({ text: 'A longer quotation that needs several lines at the starting size and then some more words. '.repeat(3), attribution: 'Ada' }, { x: 0, y: 0, width: 700, height: 360 }).parts[0];
  assert.equal(long.requestedFontSize, 40);
  assert.ok(long.fit.fontSize < 40 && long.fit.fontSize >= 16 && !long.fit.overflow, String(long.fit.fontSize));
  const footer = layoutQuote({ text: 'Short and clear.', attribution: 'Ada' }, cell).parts[1];
  assert.equal(footer.fit.fontSize, 17, 'the attribution keeps its own role size');
});

test('attribution, role and source join with an en dash', () => {
  assert.equal(QUOTE_SOURCE_SEPARATOR, ' – ');
  assert.equal(layoutQuote({ text: 'Body', attribution: 'Ada', source: 'Interview' }, cell).parts[1].text, 'Ada – Interview');
  assert.equal(layoutQuote({ text: 'Body', attribution: 'Ada', role: 'CTO', source: 'Interview' }, cell).parts[1].text, 'Ada\nCTO – Interview');
});

test('the wrapping the export adds can be recognized and removed again', () => {
  assert.equal(isWrappedInQuoteMarks('“Hello”'), true);
  assert.equal(isWrappedInQuoteMarks('"Hello"'), true);
  assert.equal(isWrappedInQuoteMarks('„Hello“'), true);
  assert.equal(isWrappedInQuoteMarks('Hello'), false);
  assert.equal(unwrapQuoteMarks('“Hello”'), 'Hello');
  assert.equal(unwrapQuoteMarks('«Bonjour»'), 'Bonjour');
  assert.equal(unwrapQuoteMarks('Hello'), 'Hello');
});
