// LH-96: PowerPoint's own slide layouts for section, statement, quote and closing (the ones New Slide and Change Layout offer) carry the
// variant of the layout record (LH-01): the color map as the layout's `p:clrMapOvr` and a bg1 background, so a slide added in PowerPoint
// draws on the variant as an exported one does (section on accent1, statement and quote on the tone-relative surface, closing on the
// brand). A fixed deck background beats the variant (LH-103), so those layouts stay as they were. The slides an export writes keep
// their look: a slide on one of these layouts that draws on the master's map states that map instead of inheriting the layout's.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {gallery} from '@openpresentation/gallery';
import {fromPptx, toPptx} from '../dist/index.js';
import {clrMapOf} from './helpers/scheme-colors.mjs';

const VARIANT_LAYOUTS = ['Section', 'Statement', 'Quote', 'Closing'];
const deck = (design = {}, extra = {}) => ({
  name: 'Layout variant layouts', language: 'en-US', ...extra, design: {theme: 'classic', ...design},
  slides: [
    {layout: 'section', title: 'Part two', subtitle: 'The evidence'},
    {layout: 'statement', title: 'Start small', text: 'Learn with two teams first.'},
    {layout: 'quote', title: 'In their words', quote: {text: 'We can see where help is needed.', source: 'Pilot lead'}},
    {layout: 'closing', title: 'Agree the start date', text: 'Name the pilot lead.'},
    {layout: 'section', title: 'Own variant', design: {variant: 'light1'}},
    {layout: 'text', title: 'Content', text: 'A plain slide.'},
  ],
});
const open = async (document) => {
  const bytes = await toPptx(document, {catalogs: [gallery]});
  const files = unzipSync(bytes);
  const text = name => strFromU8(files[name]);
  const layouts = Object.keys(files).filter(name => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(name)).map(name => ({name, xml: text(name)}));
  const layout = title => layouts.find(({xml}) => xml.includes(`<p:cSld name="${title}">`));
  const slide = index => text(`ppt/slides/slide${index + 1}.xml`);
  const override = xml => /<a:overrideClrMapping/.test(xml) ? clrMapOf(xml.match(/<p:clrMapOvr>[\s\S]*?<\/p:clrMapOvr>/)[0]) : undefined;
  return {bytes, layouts, layout, slide, override, master: clrMapOf(text('ppt/slideMasters/slideMaster1.xml'))};
};
const bg1Fill = '<p:bg><p:bgPr><a:solidFill><a:schemeClr val="bg1"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>';

for (const extra of [{}, {language: 'ar'}]) {
  const {layout, slide, override, master, layouts} = await open(deck({}, extra));
  // 1. Each variant layout writes the map its slide writes, and the bg1 background that map turns into the variant's color.
  const expected = {Section: 'accent1', Statement: 'lt2', Quote: 'lt2', Closing: 'dk2'};
  for (const [index, title] of VARIANT_LAYOUTS.entries()) {
    const xml = layout(title).xml, map = override(xml);
    assert.ok(map, `${title} carries a color map override`);
    assert.equal(map.bg1, expected[title], `${title} background slot`);
    assert.deepEqual(map, override(slide(index)), `${title} layout and its slide use one map`);
    assert.ok(xml.includes(bg1Fill), `${title} draws bg1`);
    assert.ok(!xml.includes('<p:bgRef'), `${title} has no style background`);
    // Placeholder text follows the map's tx1, so a new slide's text is the variant's text color whatever the master's text style is.
    assert.match(xml, /<a:defRPr\b[^>]*><a:solidFill><a:schemeClr val="tx1"\/><\/a:solidFill><a:latin/, `${title} text follows tx1`);
  }
  assert.equal(override(layout('Section').xml).tx1, 'lt1');
  assert.equal(override(layout('Closing').xml).tx1, 'lt1');
  // 2. Every other layout is as it was: the master's map and the style background.
  for (const {name, xml} of layouts) {
    if (VARIANT_LAYOUTS.some(title => xml.includes(`<p:cSld name="${title}">`))) continue;
    assert.ok(xml.includes('<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>'), `${name} keeps the master map`);
    assert.ok(!/<a:schemeClr val="tx1"\/><\/a:solidFill><a:latin/.test(xml), `${name} placeholders are untouched`);
  }
  assert.ok(layout('Text').xml.includes('<p:bgRef idx="1001">'));
  // 3. A slide on a variant layout that draws on the master's map states it (its own variant light1, equal to the deck's): left to
  // inherit, PowerPoint would draw it on the layout's accent.
  assert.deepEqual(override(slide(4)), master, 'an own-variant slide states the master map');
  assert.equal(override(slide(5)), undefined, 'a slide on a layout without a variant inherits the master');
}

// 4. A dark deck: surface and brand resolve against the dark master (dark2), the section stays on the accent.
{
  const {layout, override, master} = await open(deck({variant: 'dark1'}));
  assert.equal(master.bg1, 'dk1');
  assert.equal(override(layout('Section').xml)?.bg1, 'accent1');
  for (const title of ['Statement', 'Quote', 'Closing']) assert.equal(override(layout(title).xml)?.bg1, 'dk2', title);
}

// 5. A fixed deck background (a hex color, LH-103) beats the variant: its layouts and slides carry no override.
{
  const {layouts, slide, override} = await open(deck({background: '#F5E6C8'}));
  assert.ok(layouts.length > 4);
  for (const {name, xml} of layouts) {
    assert.ok(xml.includes('<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>'), `${name} keeps the master map`);
    assert.ok(!xml.includes(bg1Fill), `${name} keeps its background`);
  }
  for (let index = 0; index < 6; index += 1) assert.equal(override(slide(index)), undefined, `slide ${index + 1}`);
}

// 6. A deck that uses none of the four layouts still offers them (Change Layout reaches every template), on the variant.
{
  const {layout, override} = await open({name: 'Plain', language: 'en-US', design: {theme: 'classic'}, slides: [{layout: 'text', title: 'Only text', text: 'Body'}]});
  assert.equal(override(layout('Section').xml)?.bg1, 'accent1');
  assert.equal(override(layout('Closing').xml)?.bg1, 'dk2');
  assert.ok(layout('Text').xml.includes('<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>'));
}

// 7. The exported slides still import on their layout alone: the variant is the layout's, so no design is imported for them.
// (A slide added in PowerPoint with these layouts imports the same way, with no spurious background; checked through COM, see the PR.)
{
  const {bytes} = await open(deck());
  const files = unzipSync(bytes);
  const sectionLayout = Object.keys(files).find(name => /slideLayout\d+\.xml$/.test(name) && strFromU8(files[name]).includes('<p:cSld name="Section">'));
  const slideRels = strFromU8(files['ppt/slides/_rels/slide1.xml.rels']);
  assert.match(slideRels, new RegExp(sectionLayout.split('/').pop().replace('.', '\\.')));
  const back = await fromPptx(bytes, {catalogs: [gallery]});
  const slides = (back.presentation ?? back.document ?? back).slides;
  for (const index of [0, 1, 2, 3]) assert.equal(slides[index].design?.variant, undefined, `imported slide ${index + 1}`);
}

console.log('LH-96 layout variant layouts ok');
