// Wave 5 (opf#1010 review): on a picture background the tag (and every heading) is written in the color the preview draws. The preview
// judges the tag against its canvas, the variant's bg1 (the color of the automatic scrim, LH-02); the export judged it against the
// scheme's default background instead, so a section on a photo drew its tag white in the preview and in accent1 in PowerPoint, where it
// nearly vanished on the photo.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {toPptx, toSvg} from './helpers/default-catalog.mjs';
import {colorsInXml, themeColorsOf, clrMapOf} from './helpers/scheme-colors.mjs';

const photo = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="#7A8C6E"/><rect y="50" width="160" height="40" fill="#2E4A2A"/></svg>').toString('base64')}`;
const deck = (slide, design = {}) => ({name: 'Picture tags', language: 'en-US', design, slides: [slide]});
const section = {layout: 'section', tag: 'Part 2', title: 'Where we go next', subtitle: 'Three bets for 2027', design: {background: {type: 'image', src: photo}}};
const cover = {layout: 'cover', tag: 'Board review', title: 'Shipping, rebuilt', subtitle: 'The harbor plan', design: {background: {type: 'image', src: photo}}};
const plain = {...section, design: {}};

// The fill of each traced text item of the preview, by field.
const previewFills = document => {
  const svg = toSvg(document, 1, {trace: true}), fills = {};
  for (const match of svg.matchAll(/<text\b[^>]*>/g)) {
    const path = /data-opf-path="slides\.0\.(tag|title|subtitle)"/.exec(match[0])?.[1], fill = /\sfill="(#[0-9A-Fa-f]{6})"/.exec(match[0])?.[1];
    if (path && fill) fills[path] = fill.slice(1).toUpperCase();
  }
  return fills;
};
// The resolved color of the first run of each heading shape of the export, by field.
const exportedFills = async document => {
  const entries = unzipSync(await toPptx(document)), xml = strFromU8(entries['ppt/slides/slide1.xml']);
  const theme = themeColorsOf(strFromU8(entries['ppt/theme/theme1.xml']));
  const map = {...clrMapOf(strFromU8(entries['ppt/slideMasters/slideMaster1.xml'])), ...clrMapOf(xml)};
  const fills = {};
  for (const shape of xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)) {
    const field = /name="OPF heading slides\.0\.(tag|title|subtitle) line 0"/.exec(shape[0])?.[1];
    const fill = /<a:rPr[^>]*>[\s\S]*?<a:solidFill>(<a:(?:srgbClr|schemeClr) val="[^"]+"\s*\/>|<a:schemeClr val="[^"]+">[\s\S]*?<\/a:schemeClr>)<\/a:solidFill>/.exec(shape[0])?.[1];
    if (field && fill && !fills[field]) fills[field] = colorsInXml(fill, theme, map)[0].hex.replace(/^#/, '').toUpperCase();
  }
  return fills;
};

let checks = 0;
for (const [name, slide] of Object.entries({section, cover, plain}))
  for (const design of [{}, {colorScheme: 'corporate-blue'}, {variant: 'dark1'}]) {
    const document = deck(slide, design), preview = previewFills(document), exported = await exportedFills(document);
    assert.ok(preview.tag && exported.tag, `${name} ${JSON.stringify(design)}: a tag in both engines`);
    for (const field of ['tag', 'title', 'subtitle']) assert.equal(exported[field], preview[field], `${name} ${JSON.stringify(design)}: the ${field} is written in the preview's color`);
    checks++;
  }
// The section on a photo: its tag reads white over the accent1 surface the variant gives it, as the title does.
const sectionFills = previewFills(deck(section));
assert.equal(sectionFills.tag, sectionFills.title, 'the section tag on a photo takes the text color');
console.log(`Picture tag colors passed: ${checks} slides, tag, title and subtitle in the preview's color in PPTX.`);
