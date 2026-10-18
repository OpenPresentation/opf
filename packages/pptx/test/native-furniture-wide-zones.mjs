import assert from 'node:assert/strict';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {fromPptx, toPptx} from './helpers/default-catalog.mjs';

// RR-91: core gives a lone header/footer zone the content width, so an untagged native footer's zone cannot come from its
// box centre alone. A box wider than a zone takes the zone its paragraphs align to (its own, else the layout's or the
// master's placeholder), and a narrow box keeps the zone its centre is in.
const options = {seed: 1};
const stripTags = entries => {
  for (const path of Object.keys(entries)) {
    if (/^ppt\/tags\//.test(path)) { delete entries[path]; continue; }
    if (/\.xml$/.test(path) && !/Content_Types/.test(path)) entries[path] = strToU8(strFromU8(entries[path]).replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/g, ''));
  }
  return entries;
};
const footerOf = async (footer, mutate) => {
  const entries = stripTags(unzipSync(await toPptx({name: 'Footer', language: 'en-US', design: {fontScheme: 'roboto', footer}, slides: [{title: 'A', text: 'Body'}]}, options)));
  mutate?.(entries);
  return (await fromPptx(zipSync(entries))).design?.footer;
};
const editSlide = edit => entries => { entries['ppt/slides/slide1.xml'] = strToU8(edit(strFromU8(entries['ppt/slides/slide1.xml']))); };
// Edit the placeholder shape of one type in the slide.
const editShape = (type, edit) => editSlide(xml => xml.replace(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?<\/p:sp>/g, shape => new RegExp(`<p:ph\\b[^>]*type="${type}"`).test(shape) ? edit(shape) : shape));
const box = (x, cx) => shape => shape.replace(/<a:off x="-?\d+"/, `<a:off x="${x}"`).replace(/<a:ext cx="\d+"/, `<a:ext cx="${cx}"`);
const SLIDE = 12192000;
const algnOf = shape => shape.match(/<a:pPr\b[^>]*\salgn="(\w+)"/)?.[1];

// 1. A lone zone is full width, aligned to its edge: every zone survives the round trip without tags.
for (const zone of ['left', 'center', 'right']) {
  assert.deepEqual(await footerOf({[zone]: {text: 'Note'}}), {[zone]: {text: 'Note'}}, `a lone ${zone} text`);
  assert.deepEqual(await footerOf({[zone]: {text: '{{slide.number}}'}}), {[zone]: {text: '{{slide.number}}'}}, `a lone ${zone} slide number`);
  assert.deepEqual(await footerOf({[zone]: {date: '2026-05-02'}}), {[zone]: {date: '2026-05-02'}}, `a lone ${zone} date`);
}

// 2. Wide boxes with explicit alignment, whatever their centre: a right-aligned full-width box is right, and so on.
for (const [algn, zone] of [['l', 'left'], ['ctr', 'center'], ['r', 'right']]) {
  const edit = shape => box(Math.round(SLIDE * .05), Math.round(SLIDE * .9))(shape).replace(/(<a:pPr\b[^>]*?)\salgn="\w+"/, '$1').replace(/<a:pPr\b/, `<a:pPr algn="${algn}"`);
  const footer = await footerOf({center: {text: 'Wide'}}, editShape('ftr', edit));
  assert.deepEqual(footer, {[zone]: {text: 'Wide'}}, `a wide ${algn} box`);
}

// 3. A narrow box keeps the zone of its centre, even when its text aligns to the other edge.
{
  const edit = shape => box(Math.round(SLIDE * .70), Math.round(SLIDE * .26))(shape).replace(/(<a:pPr\b[^>]*?)\salgn="\w+"/, '$1').replace(/<a:pPr\b/, '<a:pPr algn="l"');
  assert.deepEqual(await footerOf({center: {text: 'Narrow'}}, editShape('ftr', edit)), {right: {text: 'Narrow'}}, 'a narrow box is placed by its centre');
  const edit3 = shape => box(Math.round(SLIDE * .37), Math.round(SLIDE * .26))(shape).replace(/(<a:pPr\b[^>]*?)\salgn="\w+"/, '$1').replace(/<a:pPr\b/, '<a:pPr algn="r"');
  assert.deepEqual(await footerOf({left: {text: 'Narrow'}}, editShape('ftr', edit3)), {center: {text: 'Narrow'}}, 'and so is a centred one');
}

// 4. No own alignment: a wide box takes the master placeholder's (a slide-number placeholder is right-aligned there),
// and with no alignment anywhere it keeps the zone of its centre.
{
  const bare = shape => shape.replace(/\salgn="\w+"/g, '');
  const wide = shape => box(Math.round(SLIDE * .05), Math.round(SLIDE * .9))(bare(shape));
  const inherited = await footerOf({right: {text: '{{slide.number}}'}}, editShape('sldNum', wide));
  assert.deepEqual(inherited, {right: {text: '{{slide.number}}'}}, 'the inherited master alignment places the wide box');
  const centred = await footerOf({right: {text: '{{slide.number}}'}}, entries => {
    editShape('sldNum', wide)(entries);
    // Nothing aligns the paragraphs anywhere: no layout or master alignment either.
    for (const path of Object.keys(entries)) if (/^ppt\/(slideMasters|slideLayouts)\//.test(path) && path.endsWith('.xml')) entries[path] = strToU8(strFromU8(entries[path]).replace(/\salgn="\w+"/g, ''));
  });
  assert.deepEqual(centred, {center: {text: '{{slide.number}}'}}, 'without any alignment the wide box falls back to its centre');
}
assert.equal(algnOf('<a:pPr algn="r"/>'), 'r');
console.log('Native furniture wide zones passed: lone zones round trip untagged, wide boxes take the paragraph or inherited alignment, narrow boxes keep their centre.');
