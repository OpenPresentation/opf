import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stats, validate } from '../dist/index.js';

test('rich-text titles count and flatten like equivalent plain titles without mutating input', () => {
  const deck = { slides: [{ title: ['Quarterly ', { text: 'review', bold: true }], text: 'Body' }] };
  const before = structuredClone(deck);
  assert.equal(validate(deck, { only: ['format'] }).valid, true);
  const rich = stats(deck, { perSlide: true });
  const plain = stats({ slides: [{ title: 'Quarterly review', text: 'Body' }] }, { perSlide: true });
  assert.deepEqual(rich.slides, plain.slides);
  assert.equal(rich.slides.withTitle, 1);
  assert.equal(rich.slides.withoutTitle, 0);
  assert.equal(rich.perSlide[0].title, 'Quarterly review');
  assert.deepEqual(rich.words, plain.words);
  assert.deepEqual(deck, before);
});

test('plain title bytes and empty or unsupported title behavior stay unchanged', () => {
  const titles = ['  Plain title  ', '', '  ', [], [' ', { text: '  ', italic: true }], undefined, 5];
  const result = stats({ slides: titles.map(title => ({ title })) }, { perSlide: true });
  assert.equal(result.slides.withTitle, 1);
  assert.equal(result.slides.withoutTitle, 6);
  assert.deepEqual(result.perSlide.map(slide => slide.title), ['  Plain title  ', null, null, null, null, null, null]);
});
