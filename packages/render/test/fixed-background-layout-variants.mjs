import assert from 'node:assert/strict';
import {crc32, deflateSync} from 'node:zlib';
import {colorContrast} from '@openpresentation/opf/composition';
import {defaultCatalog, toSvg} from './catalog-harness.mjs';

// LH-103: a fixed deck background (a picture, a hex color) beats a gallery layout's variant. The section, statement, quote and closing
// slides of a deck with a dark picture or a hard-coded color keep that background, as a plain slide does, with text at 4.5:1 or more on it
// (the picture's tone, the color's luminance). A scheme-based deck background (a role name) still takes the layout's variant.
const attrs = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const rects = (svg) => [...svg.matchAll(/<rect\b([^>]*?)\/?>/g)].map(([, a]) => attrs(a));
const backgroundOf = (svg) => rects(svg).find((rect) => (rect['data-opf-path'] ?? '').endsWith('.design.background')).fill.toUpperCase();
const pictureOf = (svg) => [...svg.matchAll(/<image\b([^>]*?)\/?>/g)].map(([, a]) => attrs(a)).find((image) => image['data-opf-path'] === 'design.background');
const textFills = (svg) => [...svg.matchAll(/<text\b([^>]*data-opf-path="slides\.\d+\.(?:title|subtitle|text|quote)[^"]*"[^>]*)>/g)].map(([, a]) => attrs(a).fill.toUpperCase());

// A one-pixel PNG of one color, so the picture's color is known.
const chunk = (type, data) => {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'latin1');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'latin1'), data])), 8 + data.length);
  return out;
};
const png = (hex) => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const pixel = Buffer.from([0, ...hex.slice(1).match(/\w\w/g).map((value) => Number.parseInt(value, 16))]);
  return `data:image/png;base64,${Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixel)), chunk('IEND', Buffer.alloc(0))]).toString('base64')}`;
};

const slides = [
  {layout: 'section', title: 'Part two', subtitle: 'The evidence'},
  {layout: 'statement', title: 'Start small', text: 'Learn with two teams first.'},
  {layout: 'quote', title: 'In their words', quote: {text: 'We can see where help is needed.', source: 'Pilot lead'}},
  {layout: 'closing', title: 'Agree the start date', text: 'Name the pilot lead.'},
  {title: 'Content', text: 'A plain slide.'},
];
const PICTURE = '#14202E';
const cases = [
  ['dark picture', {type: 'image', src: png(PICTURE), tone: 'dark'}, PICTURE],
  ['dark hex', '#7A1F3D', '#7A1F3D'],
  ['light hex', '#FAF7F0', '#FAF7F0'],
  ['solid var:', {type: 'solid', color: 'var:brand'}, '#0F3D2E'],
];
for (const [name, background, color] of cases) {
  for (const language of ['en-US', 'ar']) {
    const svgs = toSvg({name: 'Fixed background', language, variables: {brand: '#0F3D2E'}, design: {theme: 'classic', background}, slides}, {trace: true, catalogs: [defaultCatalog]});
    const label = `${name} ${language}`;
    const plain = textFills(svgs[4])[0];
    svgs.forEach((svg, index) => {
      if (name.endsWith('picture')) assert.ok(pictureOf(svg), `${label}: slide ${index + 1} draws the deck picture`);
      else assert.equal(backgroundOf(svg), color, `${label}: slide ${index + 1} on the deck color`);
      const fills = textFills(svg);
      assert.ok(fills.length, `${label}: slide ${index + 1} has text`);
      for (const fill of fills) assert.ok(colorContrast(fill, color) >= 4.5, `${label}: slide ${index + 1} text ${fill} on ${color}`);
      assert.equal(fills[0], plain, `${label}: slide ${index + 1} title takes the plain slide's text color`);
    });
  }
}

// A theme-based deck background (a role name, resolved through the scheme) still takes the layout's variant.
{
  const scheme = defaultCatalog.colorSchemes['cool-horizon'];
  const svgs = toSvg({name: 'Scheme background', language: 'en-US', design: {theme: 'classic', background: {type: 'solid', color: 'background'}}, slides}, {trace: true, catalogs: [defaultCatalog]});
  assert.equal(backgroundOf(svgs[0]), scheme.accent1.toUpperCase(), 'section on accent1');
  assert.equal(backgroundOf(svgs[3]), scheme.dark2.toUpperCase(), 'closing on dark2');
}
console.log('fixed background layout variants: ok');
