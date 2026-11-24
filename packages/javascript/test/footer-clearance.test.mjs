// A layout that sets its content at the foot (anchor bottom: closing, cover) keeps a whole gap above the footer text; every other body
// keeps half a gap.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';
import { layouts } from './support/template-samples.mjs';

const footer = { footer: { start: { text: 'Illustrative example' }, end: { text: '{{slide.number}}' } } };
const clearance = (result) => {
  const top = Math.min(...result.furniture.parts.filter((part) => part.kind === 'footer').map((part) => part.box.y));
  return top - (result.contentBox.y + result.contentBox.height);
};

test('a bottom-anchored closing keeps a whole gap above the footer; a top-anchored body half a gap', () => {
  const gap = 720 / 30;
  const closing = composeSlide({ title: 'Agree the pilot team and start date', blocks: [{ text: 'Next step: name the pilot lead.' }], design: footer }, { layout: layouts.closing });
  assert.ok(clearance(closing) >= gap - 0.5, `closing: ${clearance(closing)}`);
  const text = composeSlide({ title: 'Agree the pilot team', blocks: [{ text: 'Next step: name the pilot lead.' }], design: footer }, { layout: layouts.text });
  assert.ok(Math.abs(clearance(text) - gap / 2) < 0.5, `text: ${clearance(text)}`);
});
