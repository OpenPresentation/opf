// LH-07: a layout's sequence region exports its step badges (an ellipse holding its numeral), connector (a line) and flow (rounded
// chips and block arrows) as native shapes at core's geometry, tagged so that import consumes them and gives a list its numbering back.
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {toPptx, fromPptx, resolvePresentation} from './helpers/default-catalog.mjs';

const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false}), list = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const step = (text, description, start) => ({items: [{text, description, start}], numbering: 'arabic'});
const deck = {
  design: {background: 'light1'},
  slides: [
    {layout: 'process', title: 'Three steps from evidence to decision', blocks: [step('Establish a baseline', 'Measure the current rate.', 1), step('Run the pilot', 'Test with two teams.', 2), step('Decide what to scale', 'Agree the next step.', 3)]},
    {layout: 'agenda', title: 'Today’s agenda', blocks: [{numbering: 'arabic', items: ['Where we are today', 'What the pilot showed', 'The decision we need']}]},
    {layout: 'process', title: 'How support works', blocks: [{items: ['Queue', 'Route', 'Resolve']}]},
  ],
};
const before = structuredClone(deck);
const geometry = resolvePresentation(deck).slides.map(slide => slide.geometry);
assert.deepEqual(geometry.map(slide => slide.steps?.map(entry => entry.form)), [['row'], ['column'], ['flow']]);
const bytes = await toPptx(deck), zip = unzipSync(bytes);
const emu = value => Number(value) / 9525, near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < .01, `${label}: ${actual} vs ${expected}`);
for (const [index, slide] of geometry.entries()) {
  const xml = new TextDecoder().decode(zip[`ppt/slides/slide${index + 1}.xml`]), shapes = list(parser.parse(xml)['p:sld']['p:cSld']['p:spTree']['p:sp']);
  const named = prefix => shapes.filter(shape => shape['p:nvSpPr']['p:cNvPr'].name.startsWith(prefix));
  const [steps] = slide.steps;
  const badges = named(`OPF steps ${steps.path} badge `);
  assert.equal(badges.length, steps.badges.length, `slide ${index + 1}: one ellipse per badge`);
  for (const [at, shape] of badges.entries()) {
    const badge = steps.badges[at], position = shape['p:spPr']['a:xfrm'];
    assert.equal(shape['p:spPr']['a:prstGeom'].prst, 'ellipse');
    near(emu(position['a:off'].x), badge.cx - badge.radius, 'badge x');
    near(emu(position['a:off'].y), badge.cy - badge.radius, 'badge y');
    near(emu(position['a:ext'].cx), 2 * badge.radius, 'badge width');
    // The numeral is the ellipse's own text, not a picture: bold, centered.
    const paragraph = list(shape['p:txBody']['a:p'])[0], run = list(paragraph['a:r'])[0];
    assert.equal(run['a:t'], badge.label);
    assert.equal(run['a:rPr'].b, '1');
    assert.equal(paragraph['a:pPr'].algn, 'ctr');
    assert.equal(shape['p:txBody']['a:bodyPr'].anchor, 'ctr');
    assert.ok(shape['p:nvSpPr']['p:nvPr']['p:custDataLst'], 'tagged');
  }
  const connector = named(`OPF steps ${steps.path} connector`);
  assert.equal(connector.length, steps.connector ? 1 : 0);
  if (steps.connector) assert.equal(connector[0]['p:spPr']['a:prstGeom'].prst, 'line');
  const chips = named(`OPF steps ${steps.path} chip `), arrows = named(`OPF steps ${steps.path} arrow `);
  assert.equal(chips.length, steps.chips?.length ?? 0);
  assert.equal(arrows.length, steps.arrows?.length ?? 0);
  for (const chip of chips) assert.equal(chip['p:spPr']['a:prstGeom'].prst, 'roundRect');
  for (const arrow of arrows) assert.equal(arrow['p:spPr']['a:prstGeom'].prst, 'rightArrow');
  // Every shape of the sequence is drawn before (under) the step text.
  const order = shapes.map(shape => shape['p:nvSpPr']['p:cNvPr'].name), lastStep = Math.max(...order.flatMap((name, at) => name.startsWith('OPF steps ') ? [at] : []));
  assert.ok(order.slice(0, lastStep).every(name => !name.startsWith('OPF list ')), `slide ${index + 1}: sequence shapes under the text`);
}

// Import: the tagged shapes are the layout's drawing, not content, and each list keeps its numbering.
const diagnostics = [], imported = await fromPptx(bytes, {onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
assert.ok(!JSON.stringify(imported).includes('OPF steps'), 'no sequence shape imports as content');
const blocks = imported.slides.map(slide => slide.blocks.map(({region: _region, ...block}) => block));
assert.equal(blocks[0].length, 3);
assert.deepEqual(blocks[0].map(block => block.items[0].text), ['Establish a baseline', 'Run the pilot', 'Decide what to scale']);
assert.ok(blocks[0].every(block => block.numbering !== undefined), 'each step keeps its numbering');
assert.deepEqual(blocks[1], [{items: ['Where we are today', 'What the pilot showed', 'The decision we need'], numbering: 'arabic'}]);
assert.deepEqual(blocks[2], [{items: ['Queue', 'Route', 'Resolve']}], 'a flow imports as its list, with no numbering it never had');
assert.deepEqual(deck, before, 'export leaves the deck unchanged');
console.log('LH-07 step badges: native badges, connectors, chips and arrows export and import');
