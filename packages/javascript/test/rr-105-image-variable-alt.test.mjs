// RR-105 (coverage finding 25): an image that comes from an image variable is described by the variable's alt text, which the export
// writes, so it gets no opf/missing-alt-text.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validate } from '../dist/index.js';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9V3iWggAAAAASUVORK5CYII=';
const rules = (deck) => validate(deck, { only: ['accessibility'] }).findings.map((finding) => finding.ruleId);

test('an image variable is described by the variable value', () => {
  const deck = (value, extra = {}) => ({ language: 'en-US', ...extra, variables: { logo: { type: 'image', ...value } }, slides: [{ title: 'Mark', image: 'var:logo' }] });
  assert.ok(!rules(deck({ value: { src: png, alt: 'Client mark' } })).includes('opf/missing-alt-text'));
  // A decorative variable (alt "") is the opt-out, as on an inline image.
  assert.ok(!rules(deck({ value: { src: png, alt: '' } })).includes('opf/missing-alt-text'));
  // A variable whose value has no alt text is still reported, and so is a poor one.
  assert.ok(rules(deck({ value: { src: png } })).includes('opf/missing-alt-text'));
  assert.ok(rules(deck({ value: png })).includes('opf/missing-alt-text'));
  assert.ok(rules(deck({ value: { src: png, alt: 'image' } })).includes('opf/poor-alt-text'));
  // A variable that names a registry asset takes the asset's alt text.
  assert.ok(!rules(deck({ value: 'asset:mark' }, { assets: { mark: { src: png, alt: 'Client mark' } } })).includes('opf/missing-alt-text'));
  // A template's unfilled variable is described by its example, which its previews draw.
  assert.ok(!rules({ ...deck({ example: { src: png, alt: 'Client mark' } }), template: true }).includes('opf/missing-alt-text'));
});
