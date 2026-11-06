// RR-102: the slide master's Date, Footer and Slide Number placeholders (which the layouts, and so every item Insert > Header &
// Footer turns on, inherit) sit where OPF draws that part when the author adds it to the deck's footer, on one baseline, so a
// date turned on beside the organization name never covers it (docs/native-header-footer.md).
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {unzipSync} from 'fflate';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {toPptx, resolvePresentation} from './helpers/default-catalog.mjs';

const fonts = await loadFonts();
const DATE = '2026-11-06', EMU = 9525;
const dec = new TextDecoder();
// The organization icon of examples/technical/header-footer-logo-set.opf.json.
const baseDir = fileURLToPath(new URL('../../../examples/technical/', import.meta.url));
const options = {fonts, baseDir, date: DATE, seed: 1, timestamp: '2026-01-01T00:00:00Z', zipDate: '2026-01-01T00:00:00Z'};
const masterBoxes = async deck => {
  const entries = unzipSync(await toPptx(deck, options));
  const xml = dec.decode(entries['ppt/slideMasters/slideMaster1.xml']);
  const boxes = {};
  for (const [shape] of xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)) {
    const ph = shape.match(/<p:ph type="(dt|ftr|sldNum)"/)?.[1];
    const at = shape.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/);
    if (ph && at) boxes[ph] = {x: Number(at[1]), y: Number(at[2]), cx: Number(at[3]), cy: Number(at[4]), noWrap: /wrap="none"/.test(shape), field: shape.match(/<a:fld [^>]*type="(\w+)"/)?.[1]};
  }
  return {boxes, entries};
};
// What OPF draws for a footer: its text parts, as the box of the line the slide's shape would have.
const drawn = deck => resolvePresentation(deck, {fonts, baseDir, date: DATE}).slides[0].geometry.furniture.parts.filter(part => part.kind === 'footer' && part.type === 'text').map(part => {
  const placed = part.fit.placement?.lines[0], factor = part.alignment === 'right' ? 1 : part.alignment === 'center' ? .5 : 0;
  const x = placed ? placed.x + placed.width * factor - part.box.width * factor : part.box.x;
  return {field: part.field, zone: part.zone, text: part.text, x: Math.round(x * EMU), width: Math.round(part.box.width * EMU), y: Math.round((placed ? placed.baseline - part.fit.fontSize : part.box.y) * EMU),
    ink: placed?.outline ? {left: Math.round(placed.outline.x * EMU), right: Math.round((placed.outline.x + placed.outline.width) * EMU)} : undefined};
});
const slides = [{title: 'One', text: 'Body'}, {title: 'Two', text: 'Body'}];
const org = {left: {text: 'Tandem BioSystems'}, center: {text: 'Internal planning draft'}, right: {text: '{{slide.number}}'}};

{
  // Every zone holds a part and the deck has no date: the date goes into the left zone's row, after the organization name,
  // exactly where OPF draws it when the author adds date: true there.
  const {boxes} = await masterBoxes({design: {fontScheme: 'roboto', footer: org}, slides});
  const withDate = drawn({design: {fontScheme: 'roboto', footer: {...org, left: {...org.left, date: true}}}, slides});
  const date = withDate.find(part => part.field === 'date'), name = withDate.find(part => part.text === 'Tandem BioSystems');
  assert.equal(boxes.dt.x, date.x, 'The master date starts where OPF draws a date added to the left zone.');
  assert.ok(boxes.dt.x > name.ink.right, 'The date starts after the organization name: turning it on never covers the name.');
  assert.equal(boxes.dt.noWrap, true, 'A date beside another part does not wrap.');
  const own = drawn({design: {fontScheme: 'roboto', footer: org}, slides});
  assert.equal(boxes.ftr.x, own.find(part => part.zone === 'left').x, 'The footer text stays where the deck draws it.');
  assert.equal(boxes.sldNum.x + boxes.sldNum.cx, own.find(part => part.zone === 'right').x + own.find(part => part.zone === 'right').width);
  assert.deepEqual(new Set([boxes.dt.y, boxes.ftr.y, boxes.sldNum.y]), new Set([own.find(part => part.zone === 'left').y]), 'One baseline: the deck\'s footer text.');
  assert.equal(boxes.dt.field, 'datetimeFigureOut', 'A deck without a date keeps PowerPoint\'s own master date field.');
}

{
  // A 4:3 deck: the left zone is too narrow for the name and a date side by side (OPF would wrap the name), so the date follows the
  // name's ink by one gap, still clear of the center text (wildfire-evacuation-preparedness in the gallery).
  const footer = {...org, left: {text: 'Pine County Emergency Management'}};
  const deck = {design: {fontScheme: 'roboto', dimensions: '4:3', footer}, slides};
  const {boxes} = await masterBoxes(deck);
  const own = drawn(deck), name = own.find(part => part.zone === 'left'), center = own.find(part => part.zone === 'center');
  assert.ok(boxes.dt.x > name.ink.right, 'The date starts after the name.');
  assert.ok(boxes.dt.x + boxes.dt.cx < center.ink.left, 'and ends before the center text.');
  assert.equal(boxes.dt.noWrap, true);
}

{
  // A logo beside the organization name (RR-71) and a lone number: the three share the footer text's baseline (the number on the
  // slides sits higher, centered differently, but a footer and number turned on where OPF hid the footer line up), the footer text
  // spans its zone, and the date follows the name.
  const footer = {left: {image: 'var:organization.logo.icon', text: '{{organization.name}}'}, center: {text: 'Confidential fixture'}, right: {text: '{{slide.number}}'}};
  const organization = {id: 'fixture-org', name: 'Fixture Org', logo: {icon: 'asset:icon'}};
  const deck = {organization, assets: {icon: './assets/icon.svg'}, design: {fontScheme: 'roboto', footer}, slides: [...slides, {title: 'Hidden', design: {footer: false}}]};
  const {boxes} = await masterBoxes(deck);
  const own = drawn(deck), name = own.find(part => part.text === 'Fixture Org');
  assert.deepEqual(new Set([boxes.dt.y, boxes.ftr.y, boxes.sldNum.y]), new Set([name.y]), 'One baseline: the footer text\'s.');
  assert.notEqual(own.find(part => part.zone === 'right').y, name.y, 'OPF draws the lone number on another line than the text beside the logo (RR-72 decision 21).');
  assert.ok(boxes.ftr.cx > name.width && boxes.ftr.x < name.x, 'Beside a logo the master footer text spans its zone.');
  assert.ok(boxes.dt.x > name.ink.right, 'The date follows the name.');
}

{
  // A deck with a current date of its own: the master date is that field, in that pattern, so a date turned on is OPF's date.
  const {boxes, entries} = await masterBoxes({design: {fontScheme: 'roboto', footer: {left: {date: true, dateFormat: 'MMMM d, yyyy'}, right: {text: 'Page {{slide.number}} of {{deck.slideCount}}'}}}, slides});
  assert.equal(boxes.dt.field, 'datetime4');
  assert.match(dec.decode(entries['ppt/slideLayouts/slideLayout1.xml']), /<a:fld [^>]*type="datetime4"><a:rPr lang="en-US"\/><a:t>November 6, 2026<\/a:t>/);
  // The footer text is missing: it goes to the empty center zone, between the date and the number.
  assert.ok(boxes.ftr.x > boxes.dt.x && boxes.ftr.x + boxes.ftr.cx < boxes.sldNum.x + boxes.sldNum.cx);
  assert.deepEqual(new Set([boxes.dt.y, boxes.ftr.y, boxes.sldNum.y]).size, 1);
  // "Page 2 of 2" is the Slide Number placeholder (live by default) and the notes pages carry the date.
  const slide = dec.decode(entries['ppt/slides/slide2.xml']);
  assert.match(slide, /<p:ph type="sldNum"[^>]*\/>[\s\S]*?<a:t>Page <\/a:t>[\s\S]*?type="slidenum"[\s\S]*?<a:t>2<\/a:t><\/a:fld>[\s\S]*?<a:t> of 2<\/a:t>/);
  assert.match(dec.decode(entries['ppt/notesMasters/notesMaster1.xml']), /<p:hf hdr="0" ftr="0" dt="1"\/>/);
}

console.log('Header & Footer placeholders: master dates beside a full footer, in a 4:3 deck and beside a logo row, one baseline, the deck\'s date field.');
