// LH-130: a cover's or section's title rule (core geometry.titleRule) exports as one native rectangle at core's box in the tag's color,
// tagged OPF_TITLE_RULE_V1, and import consumes it: it is the layout's drawing, so the document comes back without an extra block.
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {fromPptx, resolvePresentation, toPptx} from './helpers/default-catalog.mjs';

const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false}), list = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const deck = {design: {background: 'light1'}, slides: [
  {layout: 'cover', title: 'Third-quarter customer review', subtitle: 'November 4, 2026'},
  {layout: 'section', title: 'How we deliver', subtitle: 'Teams, budget and risks'},
  {layout: 'section', tag: 'Part 3', title: 'How we deliver'},
]};
const geometry = resolvePresentation(deck).slides.map(slide => slide.geometry);
const bytes = await toPptx(deck), zip = unzipSync(bytes), emu = value => Number(value) / 9525;
for (const [index, slide] of geometry.entries()) {
  const xml = new TextDecoder().decode(zip[`ppt/slides/slide${index + 1}.xml`]), shapes = list(parser.parse(xml)['p:sld']['p:cSld']['p:spTree']['p:sp']);
  const rules = shapes.filter(shape => shape['p:nvSpPr']['p:cNvPr'].name.startsWith('OPF title rule '));
  if (!slide.titleRule) { assert.equal(rules.length, 0, `slide ${index + 1}: no rule beside a tag`); continue; }
  assert.equal(rules.length, 1);
  const [rule] = rules, position = rule['p:spPr']['a:xfrm'], {box} = slide.titleRule;
  assert.equal(rule['p:nvSpPr']['p:cNvPr'].name, `OPF title rule ${slide.titleRule.path}`);
  assert.equal(rule['p:spPr']['a:prstGeom'].prst, 'rect');
  for (const [actual, expected] of [[position['a:off'].x, box.x], [position['a:off'].y, box.y], [position['a:ext'].cx, box.width], [position['a:ext'].cy, box.height]]) assert.ok(Math.abs(emu(actual) - expected) < .02, `${actual} vs ${expected}`);
  // The tag's color: the scheme accent on the white cover; on the section's accent1 surface, the slide text color instead.
  const fill = rule['p:spPr']['a:solidFill'];
  if (index === 0) assert.equal(fill['a:schemeClr']?.val, 'accent1');
  else assert.notEqual(fill['a:schemeClr']?.val, 'accent1');
  assert.ok(rule['p:nvSpPr']['p:nvPr']['p:custDataLst'], 'tagged');
}
const imported = await fromPptx(bytes);
assert.deepEqual(imported.slides.map(slide => slide.blocks ?? []), [[], [], []], 'no rule imports as content');
assert.deepEqual(imported.slides.map(slide => slide.title), deck.slides.map(slide => slide.title));
console.log('title-rule: ok');
