import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide, layoutQuote, resolveFontFamilies} from '../dist/composition.js';

// The accent font (spec-gap closure A6): fontScheme.accent styles the tag and the quote body. OPF 0.35 removed the layout hints
// A3 and A4 (design.contentDirection, design.chartPrimary). Decisions are recorded in docs/design-resolution.md.

test('fontScheme.accent resolves only when defined and styles the tag and the quote body', () => {
  assert.equal(resolveFontFamilies({major: 'Aptos Display', minor: 'Aptos'}).accent, undefined);
  assert.equal('accent' in resolveFontFamilies({}), false);
  assert.equal(resolveFontFamilies({accent: 'Impact'}).accent, 'Impact');
  // A role is a family name: a Font object is not part of the format and names no family.
  assert.equal(resolveFontFamilies({accent: {family: 'Impact', weight: 700}}).accent, undefined);
  assert.equal(resolveFontFamilies({accent: ''}).accent, undefined);
  const fonts = {heading: 'Heading Face', body: 'Body Face', code: 'Code Face', accent: 'Accent Face'};
  const slide = {tag: 'Eyebrow', title: 'Title', subtitle: 'Sub', blocks: [{text: 'Body'}, {quote: {text: 'Quoted', attribution: 'Someone'}}, {code: 'x = 1'}]};
  const result = composeSlide(slide, {fontFamilies:fonts});
  const family = field => result.items.find(item => item.field === field).textStyle.fontFamily;
  assert.equal(family('tag'), 'Accent Face');
  assert.equal(family('title'), 'Heading Face');
  assert.equal(family('subtitle'), 'Body Face');
  assert.equal(family('text'), 'Body Face');
  assert.equal(family('code'), 'Code Face');
  const quote = result.items.find(item => item.field === 'quote').quoteLayout;
  assert.equal(quote.parts.find(part => part.role === 'body').style.fontFamily, 'Accent Face');
  assert.equal(quote.parts.find(part => part.role === 'footer').style.fontFamily, 'Body Face');
  assert.equal(layoutQuote('Q', {x: 0, y: 0, width: 400, height: 200}, {fontFamilies:fonts}).parts[0].requestedStyle.fontFamily, 'Accent Face');
  // Without an accent family nothing changes.
  const plain = composeSlide(slide, {fontFamilies: {heading: 'Heading Face', body: 'Body Face', code: 'Code Face'}});
  assert.equal(plain.items.find(item => item.field === 'tag').textStyle.fontFamily, 'Body Face');
  assert.equal(plain.items.find(item => item.field === 'quote').quoteLayout.parts[0].style.fontFamily, 'Heading Face');
  assert.deepEqual(plain.items.map(item => item.box), result.items.map(item => item.box), 'estimated geometry is font-independent');
});
