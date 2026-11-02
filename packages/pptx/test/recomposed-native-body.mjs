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
const deck = {slides: [agenda(3, {id: 'recomposed'}), agenda(1, {id: 'layout'})]};
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
  assert.deepEqual(diagnostics.filter(item => item.code === 'native-body-fallback').map(item => item.path), [], 'every list keeps a native body');
  const slide = strFromU8(entries['ppt/slides/slide1.xml']);
  const bodies = [...slide.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape]) => shape).filter(shape => shape.includes('name="OPF native body '));
  assert.equal(bodies.length, 3, 'one native body per list');
  const bound = bodies.filter(shape => /<p:ph type="body" idx="\d+"\/>/.test(shape));
  assert.equal(bound.length, 1, 'the first binds to the Body placeholder');
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
