import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { createValidator, resolveSlideContext, validate } from '../dist/index.js';
import { composeSlide, measureText } from '../dist/composition.js';

// The established LH-149 six-pair fixture takes a genuine half step. Keep the composer's own-symbol and copy
// semantics; a review snapshot may omit only its known transient marker, with complete cold reports unchanged.
const pair = (question, answer) => ({ region: 'questions', text: `${question}\n${answer}` });
const document = {
  name: 'Half-step review', language: 'en-US',
  slides: [{ id: 'faq', layout: 'faq', title: 'What the pilot involves', subtitle: 'Illustrative example', blocks: [
    pair('Who takes part?', 'Two field teams, with 52 participants in total.'),
    pair('How long does it run?', 'Six weeks, including a baseline measurement.'),
    pair('What happens next?', 'Review completion and task time before expanding.'),
    pair('Who takes part?', 'Two field teams, with 52 participants in total.'),
    pair('How long does it run?', 'Six weeks, including a baseline measurement.'),
    pair('What happens next?', 'Review completion and task time before expanding.'),
  ] }],
};

test('half-stepped geometry is retained without redoing its expensive composition', () => {
  let calls = 0;
  const measurement = { measure(text, size) { calls++; return measureText(text, size); } };
  const options = { catalogs: [gallery], fonts: { textMeasurement: measurement } };
  const context = resolveSlideContext(document, 0, { catalogs: [gallery], fonts: { textMeasurement: measurement }, date: '2000-01-01' });
  const geometry = composeSlide(context.slide, context.options);
  const marker = Object.getOwnPropertySymbols(geometry).find(key => key.description === 'opf.halfStepped');
  assert.ok(marker, 'a real half-step marker is present before snapshot projection');
  assert.equal({ ...geometry }[marker], geometry[marker], 'ordinary composition copies keep private arrangement bookkeeping');
  const body = geometry.items.filter(item => !['title', 'subtitle', 'tag'].includes(item.field) && !item.eyebrow);
  assert.deepEqual(body.map(item => item.text.fontSize), [23, 23, 23, 23, 23, 23], 'established half-step geometry stays exact');

  const checker = createValidator();
  calls = 0;
  const first = checker.validate(document, options), firstCalls = calls;
  assert.equal(first.schemaValid, true);
  assert.equal(checker.cache.entries, 1, 'the genuine half-stepped slide is cached');
  calls = 0;
  const second = checker.validate(structuredClone(document), options), warmCalls = calls;
  assert.ok(warmCalls < firstCalls, `composition work is reused (${warmCalls} warm measurements vs ${firstCalls} first)`);
  assert.deepEqual(second, validate(document, options), 'every finding, fix, check and count equals a complete cold report');
  assert.deepEqual(first, second);
  assert.ok(checker.cache.bytes <= checker.cache.maxBytes);
  assert.ok(geometry[marker] instanceof Set, 'the original composition marker remains intact');
});

test('an authored symbol with the same description still declines caching', () => {
  const opaque = structuredClone(document), checker = createValidator();
  opaque[Symbol('opf.halfStepped')] = new Set(['not engine metadata']);
  assert.deepEqual(checker.validate(opaque, { catalogs: [gallery] }), validate(opaque, { catalogs: [gallery] }));
  assert.equal(checker.cache.entries, 0, 'the known derived marker projection does not whitelist authored symbols');
});
