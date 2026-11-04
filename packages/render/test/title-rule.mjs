// LH-130: the preview draws core's title rule (geometry.titleRule) above a cover's or section's title as one rectangle at core's box,
// in the tag's color: the primary on a light slide, the text color where the primary is under 4.5:1 (a section on its accent variant).
import assert from 'node:assert/strict';
import {resolvePresentation, toSvg} from './catalog-harness.mjs';

const deck = {design: {background: 'light1'}, slides: [
  {layout: 'cover', title: 'Third-quarter customer review', subtitle: 'November 4, 2026'},
  {layout: 'section', title: 'How we deliver', subtitle: 'Teams, budget and risks'},
  {layout: 'section', tag: 'Part 3', title: 'How we deliver'},
]};
const resolved = resolvePresentation(deck), svgs = toSvg(deck, {trace: true});
const rects = svg => [...svg.matchAll(/<rect\b([^>]*)>/g)].map(([, attrs]) => attrs).filter(attrs => attrs.includes('data-opf-title-rule='));
const attr = (attrs, name) => new RegExp(String.raw`(?:^|\s)${name}="([^"]*)"`).exec(attrs)?.[1];
for (const [index, svg] of svgs.entries()) {
  const {geometry, design} = resolved.slides[index], drawn = rects(svg);
  if (!geometry.titleRule) { assert.equal(drawn.length, 0, `slide ${index + 1}: a tag takes the rule's place`); continue; }
  assert.equal(drawn.length, 1, `slide ${index + 1}: one rule`);
  const {box, path} = geometry.titleRule;
  assert.equal(attr(drawn[0], 'data-opf-title-rule'), path);
  for (const [name, value] of [['x', box.x], ['y', box.y], ['width', box.width], ['height', box.height]]) assert.ok(Math.abs(Number(attr(drawn[0], name)) - value) < .01, `${name}`);
  // The tag's color: the primary on the white cover, the text color on the section's accent1 surface (the primary itself).
  const expected = index === 0 ? design.colors.primary : design.colors.text;
  assert.equal(attr(drawn[0], 'fill').toUpperCase(), expected.toUpperCase(), `slide ${index + 1} fill`);
}
assert.ok(resolved.slides[2].geometry.titleRule === undefined && resolved.slides[0].geometry.titleRule && resolved.slides[1].geometry.titleRule);
console.log('title-rule: ok');
