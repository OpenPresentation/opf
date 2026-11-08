// LH-91: a slide recomposed at the readability floor (LH-83, `geometry.recomposed`) is drawn as the automatic grid and has no
// regions. Under bodyText 'native' its text keeps a native body, as an automatic slide's does: the first binds to a Body placeholder
// on a variant of the template's slide layout ("(automatic grid)") at the recomposed body's box, so import still reads the slide's
// layout from the layout tag, and pins no block to a region.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {XMLValidator} from 'fast-xml-parser';
import {composeSlide} from '@openpresentation/opf/composition';
import {defaultCatalog, fromPptx, toPptx} from './helpers/default-catalog.mjs';

const options = {seed: 991, timestamp: '2026-11-02T00:00:00Z', zipDate: '2026-11-02T00:00:00Z'};
const agenda = (count, extra = {}) => ({layout: 'agenda-split', title: 'Six workstreams to align before the next budget cycle', ...extra,
  blocks: Array.from({length: count}, (_, index) => ({items: Array.from({length: 6}, (_, item) => `Workstream ${index + 1}, step ${item + 1}: agree the owner, the reporting cadence and the first readout`)}))});
// LH-186: slide 2's five entries are short enough to fit its numbered region near the list's role size, so the slide keeps its layout
// and its step badges (long entries set two steps under the role size move to the automatic grid before they shrink).
const deck = {slides: [agenda(3, {id: 'recomposed'}), {...agenda(1, {id: 'layout'}), blocks: [{items: Array.from({length: 5}, (_, item) => `Workstream ${item + 1}: agree the owner and the reporting cadence`)}]}]};
assert.ok(composeSlide(deck.slides[0], {layout: defaultCatalog.layouts['agenda-split']}).recomposed, 'slide 1 is recomposed at the floor');
assert.equal(composeSlide(deck.slides[1], {layout: defaultCatalog.layouts['agenda-split']}).recomposed, undefined, 'slide 2 keeps its layout');

const exported = async extra => {
  const diagnostics = [], bytes = new Uint8Array(await toPptx(deck, {...options, ...extra, onDiagnostic: diagnostic => diagnostics.push(diagnostic)}));
  const entries = unzipSync(bytes);
  for (const [path, data] of Object.entries(entries)) if (/\.(xml|rels)$/.test(path)) assert.equal(XMLValidator.validate(strFromU8(data)), true, path);
  return {bytes, entries, diagnostics};
};
const layoutOf = (entries, slide) => {
  const target = /Target="\.\.\/slideLayouts\/(slideLayout\d+\.xml)"/.exec(strFromU8(entries[`ppt/slides/_rels/slide${slide}.xml.rels`]))[1];
  const xml = strFromU8(entries[`ppt/slideLayouts/${target}`]);
  return {name: /<p:cSld\b[^>]*\bname="([^"]*)"/.exec(xml)[1], placeholders: [...xml.matchAll(/<p:ph\b[^>]*\/>/g)].map(([ph]) => ph)};
};

// 1. Native: no fallback; the recomposed slide's first list is the Body placeholder of its own layout variant.
{
  const {bytes, entries, diagnostics} = await exported({bodyText: 'native'});
  // LH-07: slide 2's agenda list (on its layout) is drawn beside step badges at core's measured lines, so it keeps measured shapes; every
  // list of the recomposed slide, which has no sequence region, keeps a native body.
  assert.deepEqual(diagnostics.filter(item => item.code === 'native-body-fallback').map(item => `${item.path} ${item.reason}`), ['slides.1.blocks.0.items step-badges']);
  const slide = strFromU8(entries['ppt/slides/slide1.xml']);
  const bodies = [...slide.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape]) => shape).filter(shape => shape.includes('name="OPF native body '));
  assert.equal(bodies.length, 3, 'one native body per list');
  const bound = bodies.filter(shape => /<p:ph type="body" idx="\d+"\/>/.test(shape));
  assert.equal(bound.length, 1, 'the first binds to the Body placeholder');
  // The bound body draws where core measured it, as the text boxes beside it do: the same insets, anchor and paragraph spacing,
  // with no space before or after a paragraph written explicitly, so the master's body style (spcBef 20%) never applies.
  const format = shape => ({bodyPr: /<a:bodyPr\b[^>]*>/.exec(shape)[0], lstStyle: /<a:lstStyle>[\s\S]*?<\/a:lstStyle>/.exec(shape)[0], paragraphs: [...shape.matchAll(/<a:pPr\b[^>]*>[\s\S]*?<\/a:pPr>/g)].map(([pPr]) => pPr)});
  for (const shape of bodies) {
    const {paragraphs, lstStyle, bodyPr} = format(shape);
    assert.equal(paragraphs.length, 6);
    // LH-98: core's line pitch as exact spacing, and core's gap between entries as space before each later entry.
    for (const pPr of [paragraphs[0], lstStyle]) assert.match(pPr, /<a:lnSpc><a:spcPts val="\d+"\/><\/a:lnSpc><a:spcBef><a:spcPts val="0"\/><\/a:spcBef><a:spcAft><a:spcPts val="0"\/><\/a:spcAft>/);
    for (const pPr of paragraphs.slice(1)) assert.match(pPr, /<a:lnSpc><a:spcPts val="\d+"\/><\/a:lnSpc><a:spcBef><a:spcPts val="[1-9]\d*"\/><\/a:spcBef><a:spcAft><a:spcPts val="0"\/><\/a:spcAft>/);
    assert.match(bodyPr, /lIns="0" tIns="0" rIns="0" bIns="0"[^>]*anchor="t"/);
  }
  for (const other of bodies.filter(shape => shape !== bound[0])) assert.deepEqual(format(bound[0]), format(other), 'the placeholder is formatted as the text boxes are');
  const idx = /<p:ph type="body" idx="(\d+)"\/>/.exec(bound[0])[1];
  const layout = layoutOf(entries, 1);
  assert.equal(layout.name, 'Agenda beside (automatic grid)');
  assert.ok(layout.placeholders.includes(`<p:ph type="body" idx="${idx}"/>`), 'the layout has that Body placeholder');
  assert.ok(layout.placeholders.includes('<p:ph type="title"/>'), 'and the title');
  // The slide on its layout keeps the template's own slide layout.
  assert.equal(layoutOf(entries, 2).name.includes('automatic grid'), false);
  // Import reads the layout from the variant's tag and pins no block to a region; the lists come back whole.
  const back = await fromPptx(bytes, {});
  assert.deepEqual(back.slides.map(slide => slide.layout), ['agenda-split', 'agenda-split']);
  assert.ok(back.slides[0].blocks.every(block => block.region === undefined));
  // Native paragraphs come back as styled runs (as every native body does); their text is the source's.
  const plain = value => typeof value === 'string' ? value : value.map(run => typeof run === 'string' ? run : run.text).join('');
  assert.deepEqual(back.slides[0].blocks.map(block => block.items.map(plain)), deck.slides[0].blocks.map(block => block.items));
}

// 2. Measured (the default): nothing changes for the recomposed slide; it stays on the template's layout.
{
  const {entries} = await exported({});
  assert.equal(layoutOf(entries, 1).name, 'Agenda beside');
}

console.log('LH-91: a slide recomposed at the floor keeps native bodies on its layout variant, and round-trips its layout.');
