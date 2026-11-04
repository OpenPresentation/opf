import assert from 'node:assert/strict';
import {colorContrast} from '@openpresentation/opf/composition';
import {toSvg, resolvePresentation} from './catalog-harness.mjs';

// LH-07: the preview draws core's step badges (a primary circle with its numeral, readable on it), connector (a border-colored line
// through the badge centers) and flow (card chips with primary block arrows between them), under the step text, at core's geometry.
const attrs = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const step = (text, description, start) => ({items: [{text, description, start}], numbering: 'arabic'});
const deck = {
  design: {background: 'light1'},
  slides: [
    {layout: 'process', title: 'Three steps', blocks: [step('Establish a baseline', 'Measure the current rate.', 1), step('Run the pilot', 'Test with two teams.', 2), step('Decide what to scale', 'Agree the next step.', 3)]},
    {layout: 'agenda', title: 'Agenda', blocks: [{numbering: 'roman-upper', items: ['Where we are today', 'What the pilot showed', 'The decision we need']}]},
    {layout: 'process', title: 'How support works', blocks: [{items: ['Queue', 'Route', 'Resolve']}]},
  ],
};
const resolved = resolvePresentation(deck), svgs = toSvg(deck, {trace: true});
for (const [index, svg] of svgs.entries()) {
  const {geometry, design} = resolved.slides[index], [steps] = geometry.steps;
  const group = svg.match(new RegExp(`<g [^>]*data-opf-steps="${steps.form}"[^>]*>([\\s\\S]*?)</g>`))?.[1];
  assert.ok(group, `slide ${index + 1}: a sequence group`);
  const circles = [...group.matchAll(/<circle\b([^>]*?)\/?>/g)].map(([, a]) => attrs(a));
  const numerals = [...group.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)].map(([, a, text]) => ({...attrs(a), text}));
  assert.equal(circles.length, steps.badges.length);
  assert.deepEqual(numerals.map((numeral) => numeral.text), steps.badges.map((badge) => badge.label));
  for (const [at, badge] of steps.badges.entries()) {
    assert.deepEqual([Number(circles[at].cx), Number(circles[at].cy), Number(circles[at].r)].map((v) => Math.round(v * 100)), [badge.cx, badge.cy, badge.radius].map((v) => Math.round(v * 100)));
    assert.equal(circles[at].fill.toUpperCase(), design.colors.primary.toUpperCase());
    assert.equal(numerals[at]['text-anchor'], 'middle');
    assert.equal(numerals[at]['font-weight'], '700');
    assert.ok(colorContrast(numerals[at].fill, circles[at].fill) >= 4.5, 'the numeral reads on its badge');
  }
  if (steps.form === 'column') assert.deepEqual(steps.badges.map((badge) => badge.label), ['I', 'II', 'III']);
  const lines = [...group.matchAll(/<line\b([^>]*?)\/?>/g)].map(([, a]) => attrs(a));
  assert.equal(lines.length, steps.connector ? 1 : 0);
  if (steps.connector) assert.equal(lines[0].stroke.toUpperCase(), design.colors.border.toUpperCase());
  assert.equal([...group.matchAll(/<rect\b/g)].length, steps.chips?.length ?? 0, 'one chip per flow entry');
  assert.equal([...group.matchAll(/<path\b/g)].length, steps.arrows?.length ?? 0, 'one arrow between each two chips');
  // Under the text: the sequence group comes before the first list of the slide.
  assert.ok(svg.indexOf('data-opf-steps') < svg.indexOf('data-opf-path="slides.' + index + '.blocks.0.items'), 'drawn under the step text');
}
console.log('LH-07 step badges: the preview draws badges, connectors and flows');
