// LH-103: a fixed deck background (a picture, a hex color) beats a gallery layout's variant in the PPTX as in the preview. The section,
// statement, quote and closing slides of a deck with a dark picture or a hard-coded color write no clrMapOvr of their own and the same
// slide background as a plain slide, and their text reads at 4.5:1 or more on that background (resolved through the theme and the master's
// color map). A scheme-based deck background (a role name) still takes the layout's variant.
import assert from 'node:assert/strict';
import {crc32, deflateSync} from 'node:zlib';
import {strFromU8, unzipSync} from 'fflate';
import {gallery} from '@openpresentation/gallery';
import {colorContrast} from '@openpresentation/opf/composition';
import {toPptx} from '../dist/index.js';
import {clrMapOf, colorsInXml, themeColorsOf} from './helpers/scheme-colors.mjs';

// A one-pixel PNG of one color, so the picture's color is known.
const chunk = (type, data) => {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'latin1');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'latin1'), data])), 8 + data.length);
  return out;
};
const png = hex => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const pixel = Buffer.from([0, ...hex.slice(1).match(/\w\w/g).map(value => Number.parseInt(value, 16))]);
  return `data:image/png;base64,${Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixel)), chunk('IEND', Buffer.alloc(0))]).toString('base64')}`;
};

const slides = [
  {layout: 'section', title: 'Part two', subtitle: 'The evidence'},
  {layout: 'statement', title: 'Start small', text: 'Learn with two teams first.'},
  {layout: 'quote', title: 'In their words', quote: {text: 'We can see where help is needed.', source: 'Pilot lead'}},
  {layout: 'closing', title: 'Agree the start date', text: 'Name the pilot lead.'},
  {title: 'Content', text: 'A plain slide.'},
];
const open = async document => {
  const files = unzipSync(await toPptx(document, {catalogs: [gallery]}));
  const text = name => strFromU8(files[name]);
  const slide = index => text(`ppt/slides/slide${index + 1}.xml`);
  const theme = themeColorsOf(text('ppt/theme/theme1.xml')), master = clrMapOf(text('ppt/slideMasters/slideMaster1.xml'));
  const background = index => slide(index).match(/<p:bg>[\s\S]*?<\/p:bg>/)?.[0] ?? '';
  // The colors of every text run of the slide's own text shapes, through the master's map (the slide writes no override).
  const runs = index => [...slide(index).matchAll(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?name="OPF [^"]*slides\.\d+\.(?:title|subtitle|text|quote)[^"]*"[\s\S]*?<\/p:sp>/g)]
    .flatMap(([shape]) => [...shape.matchAll(/<a:rPr\b[^>]*>([\s\S]*?)<\/a:rPr>/g)].map(([, inner]) => colorsInXml(inner.match(/<a:solidFill>[\s\S]*?<\/a:solidFill>/)?.[0] ?? '<a:schemeClr val="tx1"/>', theme, master)[0]?.hex));
  return {slide, background, runs};
};

const PICTURE = '#14202E';
for (const [name, background, color] of [['dark picture', {type: 'image', src: png(PICTURE), tone: 'dark'}, PICTURE], ['dark hex', '#7A1F3D', '#7A1F3D'], ['light hex', '#FAF7F0', '#FAF7F0']]) {
  for (const language of ['en-US', 'ar']) {
    const label = `${name} ${language}`;
    const {slide, background: bg, runs} = await open({name: 'Fixed background', language, design: {theme: 'classic', background}, slides});
    const plain = bg(4);
    assert.match(plain, name.endsWith('picture') ? /<a:blipFill\b/ : new RegExp(`<a:srgbClr val="${color.slice(1)}"`), `${label}: the plain slide draws the deck background`);
    for (const index of [0, 1, 2, 3]) {
      assert.doesNotMatch(slide(index), /<a:overrideClrMapping/, `${label}: slide ${index + 1} writes no color map override`);
      assert.equal(bg(index), plain, `${label}: slide ${index + 1} keeps the deck background`);
      const colors = runs(index);
      assert.ok(colors.length, `${label}: slide ${index + 1} has text runs`);
      for (const hex of colors) assert.ok(hex && colorContrast(`#${hex}`, color) >= 4.5, `${label}: slide ${index + 1} text ${hex} on ${color}`);
    }
  }
}

// A scheme-based deck background (a role name) still takes the layout's variant: the section writes its accent1 override.
{
  const {slide} = await open({name: 'Scheme background', language: 'en-US', design: {theme: 'classic', background: {type: 'solid', color: 'background'}}, slides});
  assert.match(slide(0), /<a:overrideClrMapping[^>]*bg1="accent1"/);
  assert.match(slide(3), /<a:overrideClrMapping[^>]*bg1="dk2"/);
}
console.log('fixed background layout variants: ok');
