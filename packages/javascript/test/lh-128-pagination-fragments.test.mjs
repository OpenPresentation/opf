// LH-128: pagination splits a paragraph at sentence or block boundaries, so no page carries a fragment of under a full sentence
// ("twenty.") when a sentence boundary is available.
import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { paginate } from '../dist/index.js';

const sentence = 'Customers told us onboarding took too long, so we rebuilt it around three steps, measured every one of them and removed the two that nobody needed; the flow now takes four minutes instead of twenty.';
const events = (count) => ({ timeline: { events: Array.from({ length: count }, (_, index) => ({ when: `Q${index + 1}`, what: `Milestone ${index + 1} with a longer description` })) } });
const deck = (blocks) => ({ catalogs: { custom: { layouts: { timeline: gallery.layouts.timeline } } }, slides: [{ layout: 'timeline', title: 'Timeline: a longer title that may need a second line on the slide', blocks, design: { contentBox: true } }] });
const texts = (presentation) => presentation.slides.flatMap((slide) => (slide.blocks ?? []).filter((block) => typeof block.text === 'string').map((block) => block.text));

describe('LH-128 pagination fragments', () => {
  test('the paginated timeline 4 long sample moves its one-sentence paragraph whole instead of leaving "twenty."', () => {
    const blocks = [events(6), { text: `2. ${sentence}` }, { text: `3. ${sentence}` }, events(6)];
    const { presentation } = paginate(deck(blocks));
    assert.ok(presentation.slides.length >= 2);
    const written = texts(presentation);
    assert.deepEqual(written, [`2. ${sentence}`, `3. ${sentence}`], 'each paragraph is on one page, whole');
    assert.ok(!written.includes('twenty.'));
  });

  test('a sentence that no page can hold alone is still split inside, and nothing is lost', () => {
    const long = Array.from({ length: 14 }, (_, index) => `word${index} ${sentence.slice(0, 60)}`).join(' ').replace(/\.?$/, '.');
    const { presentation } = paginate(deck([events(6), { text: long }]));
    assert.equal(texts(presentation).join(' ').replace(/\s+/g, ' '), long.replace(/\s+/g, ' '));
  });

  test('a paragraph of several sentences breaks after a sentence, not inside one', () => {
    const paragraph = Array.from({ length: 10 }, (_, index) => `Sentence ${index + 1} says that onboarding now takes four minutes instead of twenty.`).join(' ');
    const { presentation } = paginate(deck([events(6), { text: paragraph }, { text: `3. ${sentence}` }]));
    const parts = texts(presentation).filter((text) => text.startsWith('Sentence'));
    assert.equal(parts.join(' ').replace(/\s+/g, ' '), paragraph, 'every sentence survives, in order');
    for (const part of parts) assert.ok(/^Sentence \d+ /.test(part) && /instead of twenty\.\s*$/.test(part), `a page starts and ends on a sentence: ${part.slice(0, 40)}...`);
  });

  test('a list marker such as "2." is not a sentence end', () => {
    const { presentation } = paginate(deck([events(6), { text: `2. ${sentence}` }]));
    assert.ok(!texts(presentation).includes('2. '), 'the marker is never left alone on a page');
    assert.deepEqual(texts(presentation), [`2. ${sentence}`]);
  });
});

describe('LH-128 a short first sentence', () => {
  test('page one ends after it even when it is a small part of what fits, and the long sentence follows whole', () => {
    const { presentation } = paginate(deck([events(6), { text: `Short opening sentence. ${sentence}` }]));
    assert.deepEqual(texts(presentation).map((text) => text.trim()), ['Short opening sentence.', sentence]);
  });
});
