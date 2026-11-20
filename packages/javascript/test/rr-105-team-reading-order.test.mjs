// RR-105 (coverage finding 13): a team of three cards (a picture over a name in each) reads card by card, which is the visual order of
// cards, so it gets no opf/reading-order.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validate } from '../dist/index.js';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9V3iWggAAAAASUVORK5CYII=';
const rules = (deck) => validate(deck, { only: ['accessibility'] }).findings.map((finding) => finding.ruleId);
const card = (name, role) => ({ type: 'group', blocks: [{ image: { src: png, alt: `Portrait of ${name}` }, portrait: 'top' }, { items: [{ text: name, description: role }] }] });

test('a team of three cards has no opf/reading-order', () => {
  const deck = { language: 'en-US', slides: [{ title: 'Top', blocks: [card('Alice Moreno', 'Operations'), card('Ben Okafor', 'Finance'), card('Chen Wei', 'Engineering')] }] };
  assert.ok(!rules(deck).includes('opf/reading-order'));
});
