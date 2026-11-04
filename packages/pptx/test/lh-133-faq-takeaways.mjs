// LH-133 and LH-134 in the PPTX export and import: a glossary's terms and a question grid's rules in the accent, numerals as tagged text
// boxes at core's line boxes (no ellipse), hairlines between rows; import gives every document back as written, numbering included.
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {toPptx, fromPptx, resolvePresentation} from './helpers/default-catalog.mjs';

const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false}), list = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const qa = (text, description) => ({region: 'questions', items: [{text, description}]});
const deck = {
  design: {background: 'light1'},
  slides: [
    {layout: 'faq', title: 'Terms used in this review', blocks: [{region: 'questions', items: [{text: 'ARR', description: 'Annual recurring revenue.'}, {text: 'Churn', description: 'The share of customers who cancel.'}, {text: 'SLA', description: 'Service level agreement.'}]}]},
    {layout: 'faq', title: 'Questions we hear about returns', blocks: [qa('How long do I have?', '45 days from delivery.'), qa('Is shipping free?', 'Yes, in the United States.'), qa('When is my refund?', 'Two business days later.'), qa('Can I exchange?', 'Yes, in the app.'), qa('What if it is damaged?', 'Send a photo.'), qa('Do gift returns work?', 'As store credit.')]},
    {layout: 'list', title: 'Three things to remember', blocks: [{region: 'body', numbering: 'arabic', items: [{text: 'Triage cut the backlog by 41%', description: 'Premium accounts gained the most.'}, {text: 'Guided setup halved time to value', description: 'From 21 days to 9.'}, {text: 'Regional pricing adds $2.1M', description: 'Two regions trail competitors.'}]}]},
    {layout: 'agenda', title: 'Today’s agenda', blocks: [{items: [{text: 'Where we stand', description: 'Results from nine months'}, {text: 'What changed', description: 'The drivers behind the numbers'}]}]},
    {layout: 'faq', title: 'About the pilot', blocks: [qa('How long does the pilot last?', 'Twelve weeks.'), qa('What does it cost?', 'Nothing during the pilot.'), qa('Who owns our data?', 'You do.')]},
  ],
};
const before = structuredClone(deck);
const resolved = resolvePresentation(deck), geometry = resolved.slides.map(slide => slide.geometry);
const accent = resolved.slides[0].design.colors.primary.replace('#', '').toUpperCase();
const bytes = await toPptx(deck), zip = unzipSync(bytes);
const shapesOf = index => {
  const tree = parser.parse(new TextDecoder().decode(zip[`ppt/slides/slide${index + 1}.xml`]))['p:sld']['p:cSld']['p:spTree'];
  return [...list(tree['p:sp']), ...list(tree['p:cxnSp'])];
};
const nameOf = shape => (shape['p:nvSpPr'] ?? shape['p:nvCxnSpPr'])['p:cNvPr'].name;
const colorOf = node => node?.['a:solidFill']?.['a:srgbClr']?.val ?? (node?.['a:solidFill']?.['a:schemeClr']?.val === 'accent1' ? accent : node?.['a:solidFill']?.['a:schemeClr']?.val);
const emu = value => Number(value) / 9525, near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < .02, `${label}: ${actual} vs ${expected}`);

// The glossary: each term's run in the accent, each definition's not.
const glossary = shapesOf(0).filter(shape => /^OPF list slides\.0\.blocks\.0\.items line \d+$/.test(nameOf(shape)));
const runs = glossary.map(shape => list(list(shape['p:txBody']['a:p'])[0]['a:r'])[0]);
const terms = runs.filter(run => ['ARR', 'Churn', 'SLA'].includes(run['a:t']));
assert.equal(terms.length, 3);
for (const run of terms) assert.equal(String(colorOf(run['a:rPr'])).toUpperCase(), accent, `${run['a:t']} in the accent`);
assert.ok(runs.filter(run => !terms.includes(run)).every(run => String(colorOf(run['a:rPr'])).toUpperCase() !== accent), 'definitions are not');

// The question grid: an accent line over each cell, LIST_ACCENT_RULE_WIDTH thick (3 px is 2.25 pt, 28575 EMU).
const rules = shapesOf(1).filter(shape => nameOf(shape).startsWith('OPF list rule '));
assert.equal(rules.length, 6);
for (const rule of rules) {
  const line = rule['p:spPr']['a:ln'];
  assert.equal(line.w, '28575');
  assert.equal(String(colorOf(line)).toUpperCase(), accent);
}

// Numerals: a text box at core's line box with the numeral bold in the accent, no ellipse, tagged; hairlines between the rows.
for (const [index, labels] of [[2, ['1', '2', '3']], [3, ['01', '02']]]) {
  const [steps] = geometry[index].steps, shapes = shapesOf(index);
  const numerals = shapes.filter(shape => nameOf(shape).startsWith(`OPF steps ${steps.path} numeral `));
  assert.equal(numerals.length, labels.length);
  assert.equal(shapes.filter(shape => nameOf(shape).startsWith(`OPF steps ${steps.path} badge `)).length, 0, 'no ellipse');
  for (const [at, shape] of numerals.entries()) {
    const badge = steps.badges[at], position = shape['p:spPr']['a:xfrm'], run = list(list(shape['p:txBody']['a:p'])[0]['a:r'])[0];
    assert.equal(run['a:t'], labels[at]);
    assert.equal(run['a:rPr'].b, '1');
    assert.equal(String(colorOf(run['a:rPr'])).toUpperCase(), accent);
    near(emu(position['a:off'].x), badge.numeral.x, 'numeral x');
    near(emu(position['a:off'].y), badge.numeral.y, 'numeral y');
    near(emu(position['a:ext'].cx), badge.numeral.width, 'numeral width');
    assert.notEqual(shape['p:spPr']['a:prstGeom']?.prst, 'ellipse');
    assert.ok(shape['p:nvSpPr']['p:nvPr']['p:custDataLst'], 'tagged');
  }
  assert.equal(shapes.filter(shape => nameOf(shape).startsWith('OPF list rule ')).length, labels.length - 1);
}

// Import: rules and numerals are drawing, not content; the glossary keeps plain terms (their accent is the export's look), the
// takeaways keep their numbering, the unnumbered agenda stays unnumbered, and the one-question blocks stay one block each.
const imported = await fromPptx(bytes);
assert.ok(!JSON.stringify(imported).includes('OPF '), 'no generated shape imports as content');
const blocks = imported.slides.map(slide => slide.blocks.map(({region: _region, ...block}) => block));
assert.deepEqual(blocks, deck.slides.map(slide => slide.blocks.map(({region: _region, ...block}) => block)));
assert.deepEqual(deck, before, 'export leaves the deck unchanged');
console.log('LH-133 and LH-134: accent terms, accent rules and numerals export natively and import as written');
