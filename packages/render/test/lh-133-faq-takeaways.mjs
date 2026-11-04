import assert from 'node:assert/strict';
import {LIST_ACCENT_RULE_WIDTH, LIST_RULE_WIDTH} from '@openpresentation/opf/composition';
import {toSvg, resolvePresentation} from './catalog-harness.mjs';

// LH-133 and LH-134 in the preview: a glossary's terms and a question grid's rules in the accent, numerals without a circle in the accent,
// at core's geometry, as the PPTX export writes them.
const attrs = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const qa = (text, description) => ({region: 'questions', items: [{text, description}]});
const deck = {
  design: {background: 'light1'},
  slides: [
    {layout: 'faq', title: 'Terms used in this review', blocks: [{region: 'questions', items: [{text: 'ARR', description: 'Annual recurring revenue.'}, {text: 'Churn', description: 'The share of customers who cancel.'}, {text: 'SLA', description: 'Service level agreement.'}]}]},
    {layout: 'faq', title: 'Questions we hear about returns', blocks: [qa('How long do I have?', '45 days from delivery.'), qa('Is shipping free?', 'Yes, in the United States.'), qa('When is my refund?', 'Two business days later.'), qa('Can I exchange?', 'Yes, in the app.'), qa('What if it is damaged?', 'Send a photo.'), qa('Do gift returns work?', 'As store credit.')]},
    {layout: 'list', title: 'Three things to remember', blocks: [{region: 'body', numbering: 'arabic', items: [{text: 'Triage cut the backlog by 41%', description: 'Premium accounts gained the most.'}, {text: 'Guided setup halved time to value', description: 'From 21 days to 9.'}, {text: 'Regional pricing adds $2.1M', description: 'Two regions trail competitors.'}]}]},
    {layout: 'agenda', title: 'Today’s agenda', blocks: [{items: [{text: 'Where we stand', description: 'Results from nine months'}, {text: 'What changed', description: 'The drivers behind the numbers'}]}]},
  ],
};
const resolved = resolvePresentation(deck), svgs = toSvg(deck, {trace: true});
const primary = resolved.slides[0].design.colors.primary.toUpperCase(), unit = 1;

// The glossary's terms draw in the accent; their definitions keep the muted text color.
for (const index of [0, 1, 2]) {
  const term = svgs[0].match(new RegExp(`data-opf-path="slides\\.0\\.blocks\\.0\\.items\\.${index}\\.text"[^>]*>\\s*<text[^>]*>\\s*<tspan([^>]*)>`))?.[1];
  assert.ok(term, `term ${index} drawn`);
  assert.equal(attrs(term).fill.toUpperCase(), primary, `term ${index} in the accent`);
}

// The question grid: one accent rule over each cell, LIST_ACCENT_RULE_WIDTH thick, and no hairline.
const lines = [...svgs[1].matchAll(/<line\b([^>]*?)\/?>/g)].map(([, a]) => attrs(a));
const accent = lines.filter((line) => line.stroke.toUpperCase() === primary);
assert.equal(accent.length, 6);
assert.ok(accent.every((line) => Number(line['stroke-width']) === LIST_ACCENT_RULE_WIDTH * unit));
const rules = resolved.slides[1].geometry.items.filter((item) => item.field === 'items').flatMap((item) => item.text.rules);
assert.deepEqual(accent.map((line) => Number(line.y1)).sort((a, b) => a - b), rules.map((rule) => rule.y).sort((a, b) => a - b));

// Numerals: no circle, the label bold in the accent at core's size and baseline; takeaways and an agenda's rows keep their hairlines.
for (const [index, labels] of [[2, ['1', '2', '3']], [3, ['01', '02']]]) {
  const {geometry} = resolved.slides[index], [steps] = geometry.steps;
  const group = svgs[index].match(/<g [^>]*data-opf-steps="column"[^>]*>([\s\S]*?)<\/g>/)?.[1];
  assert.ok(group, `slide ${index + 1}: a sequence group`);
  assert.equal([...group.matchAll(/<circle\b/g)].length, 0, 'no circle');
  assert.equal([...group.matchAll(/<line\b/g)].length, 0, 'no connector');
  const numerals = [...group.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)].map(([, a, text]) => ({...attrs(a), text}));
  assert.deepEqual(numerals.map((numeral) => numeral.text), labels);
  for (const [at, badge] of steps.badges.entries()) {
    assert.equal(numerals[at].fill.toUpperCase(), primary);
    assert.equal(numerals[at]['font-weight'], '700');
    assert.equal(Number(numerals[at]['font-size']), Math.round(badge.fontSize * 1e4) / 1e4);
    assert.ok(Math.abs(Number(numerals[at].y) - badge.baseline) < .01);
  }
  const hairlines = [...svgs[index].matchAll(/<line\b([^>]*?)\/?>/g)].map(([, a]) => attrs(a)).filter((line) => Number(line['stroke-width']) === LIST_RULE_WIDTH * unit);
  assert.equal(hairlines.length, steps.badges.length - 1, 'a hairline between two rows');
}
console.log('LH-133 and LH-134: the preview draws accent terms, accent rules and numerals');
