import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {composeSlide, metricPillFill} from '@openpresentation/opf/composition';
import {resolveSlideContext} from '@openpresentation/opf';
import {defaultCatalog, fromPptx, toPptx, toSvg} from './helpers/default-catalog.mjs';

// LH-131, LH-137: what the preview draws for a featured before and after pair, a delta pill and check-mark tiles, the PPTX writes as
// native shapes at core's geometry: the pair's arrow (a rightArrow or leftArrow preset in the accent), the delta's pill (a roundRect in
// core metricPillFill, tagged into the metric's group) and each tile's chip, badge and check mark (a custom geometry). None is a picture,
// and import consumes every one of them as the layout's drawing, giving back the content as written.
const decoder = new TextDecoder();
const group = (label, ...rest) => ({composition: {mode: 'column'}, blocks: [{text: [{text: label, bold: true}]}, ...rest]});
const slides = [
  {title: 'Contract turnaround', layout: 'comparison', blocks: [
    {region: 'first', ...group('Before', {metric: {value: '11 days', label: 'From quote to signed contract', description: 'Printed, signed and scanned by hand'}})},
    {region: 'second', ...group('After', {metric: {value: '3 days', label: 'From quote to signed contract', description: 'Standard templates and electronic signature', delta: '-8 days', trend: 'down', sentiment: 'positive'}})},
    {region: 'verdict', text: 'Standard legal templates and e-signature removed eight days from every deal.'},
  ]},
  {title: 'What we decided today', design: {variant: 'dark1'}, blocks: [{bullets: ['Approve the expansion budget', 'Launch the pilot in March', 'Hire a program lead by January', 'Review progress in June']}]},
];
for (const direction of ['ltr', 'rtl']) {
  const deck = {name: 'LH-131', language: direction === 'rtl' ? 'ar' : 'en', design: {background: 'light1'}, slides};
  const bytes = await toPptx(deck), zip = unzipSync(bytes), svgs = toSvg(deck, {trace: true});
  const geometry = slides.map((_, index) => { const context = resolveSlideContext(deck, index, {catalogs: [defaultCatalog]}); return composeSlide(context.slide, context.options); });
  const emu = value => Math.round(value / 96 * 914400);
  // The pair: the arrow where core placed it, and the metric's pill.
  const pair = decoder.decode(zip['ppt/slides/slide1.xml']), arrow = geometry[0].emphasis?.arrow;
  assert.ok(arrow, `${direction}: core places the pair's arrow`);
  const arrowShape = pair.split('<p:sp>').find(shape => shape.includes(`name="OPF steps ${geometry[0].emphasis.path} arrow"`));
  assert.ok(arrowShape, `${direction}: the arrow is exported`);
  assert.match(arrowShape, new RegExp(`prst="${arrow.direction === 'left' ? 'leftArrow' : 'rightArrow'}"`));
  assert.match(arrowShape, new RegExp(`<a:off x="${emu(arrow.box.x)}" y="${emu(arrow.box.y)}"/>`));
  assert.match(svgs[0], /data-opf-emphasis-arrow=/, `${direction}: the preview draws the arrow`);
  const metric = geometry[0].items.find(item => item.metricLayout?.deltaPill);
  assert.ok(metric, `${direction}: the after metric has a delta pill`);
  const pillShape = pair.split('<p:sp>').find(shape => / pill"/.test(shape) && shape.includes('name="OPF metric'));
  assert.ok(pillShape, `${direction}: the pill is exported`);
  assert.match(pillShape, /prst="roundRect"/);
  assert.match(svgs[0], /data-opf-metric-role="pill"/, `${direction}: the preview draws the pill`);
  // The tiles: a chip, a badge and a check mark for each entry, the check a custom geometry.
  const tiles = decoder.decode(zip['ppt/slides/slide2.xml']), steps = geometry[1].steps.find(step => step.form === 'tiles');
  assert.equal(steps.chips.length, 4);
  for (const role of ['chip', 'badge', 'check']) assert.equal((tiles.match(new RegExp(`name="OPF steps [^"]* ${role} \\d"`, 'g')) ?? []).length, 4, `${direction}: four ${role}s`);
  assert.equal((tiles.match(/<a:custGeom>/g) ?? []).length, 4, `${direction}: the check marks are custom geometry`);
  assert.doesNotMatch(pair + tiles, /<p:pic>/, `${direction}: no picture`);
  // Import: the drawing is consumed, the content comes back as written.
  const diagnostics = [];
  const imported = await fromPptx(bytes, {onDiagnostic: entry => diagnostics.push(entry.code)});
  assert.ok(!diagnostics.includes('invalid-metric-provenance'), diagnostics.join());
  const back = JSON.stringify(imported.slides);
  for (const text of ['-8 days', 'Approve the expansion budget', 'Review progress in June']) assert.ok(back.includes(text), text);
  assert.ok(!/OPF steps|OPF metric \d+ pill/.test(back));
  const blocks = imported.slides[1].blocks.flatMap(block => block.bullets ?? block.items ?? []);
  assert.equal(blocks.length, 4, `${direction}: the list comes back whole`);
}
// A tile's citation marker stays on its own entry (each entry is fitted alone).
{
  const deck = {name: 'Cited tiles', references: [{id: 'b', text: 'Source B'}], slides: [{title: 'Decisions', design: {variant: 'dark1'}, bullets: [[{text: 'Approve the budget', cite: 'b'}], 'Launch the pilot']}]};
  const xml = decoder.decode(unzipSync(await toPptx(deck))['ppt/slides/slide1.xml']);
  const marked = xml.split('<p:sp>').filter(shape => /baseline="30000"/.test(shape)).map(shape => /name="([^"]*)"/.exec(shape)[1]);
  assert.deepEqual(marked, ['OPF list slides.0.bullets line 0']);
}
assert.match(metricPillFill('#FFFFFF', '#000000'), /^#[0-9A-F]{6}$/i);
console.log('featured cards, pair arrows, delta pills and check tiles export natively');
