// LH-01: a layout record's design.variant reaches the PPTX as the slide's clrMapOvr and a bg1 (or accent) background, as the preview draws
// it: section on accent1, statement and quote on light2, closing on dark1. A slide's own variant wins, and the import drops the variant
// its layout already gives.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {gallery} from '@openpresentation/gallery';
import {fromPptx, toPptx} from '../dist/index.js';
import {clrMapOf} from './helpers/scheme-colors.mjs';

const deck = (design = {}, extra = {}) => ({
  name: 'Layout variants', language: 'en-US', ...extra, design: {theme: 'classic', ...design},
  slides: [
    {layout: 'section', title: 'Part two', subtitle: 'The evidence'},
    {layout: 'statement', title: 'Start small', text: 'Learn with two teams first.'},
    {layout: 'quote', title: 'In their words', quote: {text: 'We can see where help is needed.', source: 'Pilot lead'}},
    {layout: 'closing', title: 'Agree the start date', text: 'Name the pilot lead.'},
    {layout: 'section', title: 'Own variant', design: {variant: 'light1'}},
    {title: 'Content', text: 'A plain slide.'},
  ],
});
const open = async (document) => {
  const bytes = await toPptx(document, {catalogs: [gallery]});
  const files = unzipSync(bytes);
  const slide = index => strFromU8(files[`ppt/slides/slide${index + 1}.xml`]);
  const override = index => { const xml = slide(index); return /<a:overrideClrMapping/.test(xml) ? clrMapOf(xml.match(/<p:clrMapOvr>[\s\S]*?<\/p:clrMapOvr>/)[0]) : undefined; };
  const background = index => slide(index).match(/<p:bg>[\s\S]*?<\/p:bg>/)?.[0] ?? '';
  return {bytes, override, background, master: clrMapOf(strFromU8(files['ppt/slideMasters/slideMaster1.xml']))};
};

for (const extra of [{}, {language: 'ar'}]) {
  const {bytes, override, background} = await open(deck({}, extra));
  // 1. Each layout writes its variant's map; the accent is the background and bg2, light1 the text on classic's dark accent1.
  assert.equal(override(0)?.bg1, 'accent1');
  assert.equal(override(0)?.bg2, 'accent1');
  assert.equal(override(0)?.tx1, 'lt1');
  assert.match(background(0), /<a:schemeClr val="accent1"\/>|<a:schemeClr val="bg1"\/>/);
  for (const index of [1, 2]) assert.equal(override(index)?.bg1, 'lt2', `slide ${index + 1}`);
  assert.equal(override(3)?.bg1, 'dk1');
  assert.equal(override(3)?.tx1, 'lt1');
  for (const index of [1, 2, 3]) assert.match(background(index), /<a:schemeClr val="bg1"\/>/, `slide ${index + 1} background follows its map`);
  // 2. The slide's own variant wins; a slide without a layout variant keeps the master map.
  assert.equal(override(4), undefined);
  assert.equal(override(5), undefined);
  // 3. The import reads each override back and drops it where the restored layout gives it.
  const back = await fromPptx(bytes, {catalogs: [gallery]});
  const slides = (back.presentation ?? back.document ?? back).slides;
  for (const index of [0, 1, 2, 3]) assert.equal(slides[index].design?.variant, undefined, `imported slide ${index + 1}`);
  assert.equal(slides[4].layout, 'section');
}

// 4. A dark deck: the layout outranks the deck variant (README decision), so statement and quote are light2 and closing keeps the dark master.
{
  const {master, override} = await open(deck({variant: 'dark1'}));
  assert.equal(master.bg1, 'dk1');
  assert.equal(override(0)?.bg1, 'accent1');
  for (const index of [1, 2]) assert.equal(override(index)?.bg1, 'lt2');
  assert.equal(override(3), undefined);
  assert.equal(override(4)?.bg1, 'lt1', "the slide's own light1 overrides the dark master");
}
console.log('layout variants: ok');
