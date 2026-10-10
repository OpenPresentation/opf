import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {XMLValidator} from 'fast-xml-parser';
import {toSvg, toPptx} from './helpers/default-catalog.mjs';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';

// FF-38: an image that cannot be embedded exports the preview's placeholder,
// not a second design. The preview draws a dashed panel with a centered bold
// "Image unavailable" over the asset's alt text (else title, else "Image") at
// 20 px, or a cross when even the minimum font size cannot hold the label, and
// names the group "Image unavailable: <description>". The native shapes must
// agree line by line: same text, size, weight, colour, position and panel.
const decoder = new TextDecoder();
const EMU_PX = 9525, PX_PT = .75;
const unescape = value => value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const attrs = source => Object.fromEntries([...source.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, unescape(value)]));

// Preview placeholders: the balanced <g> of every traced group with data-opf-asset-status.
const placeholders = svg => [...svg.matchAll(/<g\b[^>]*\bdata-opf-asset-status="unresolved"[^>]*>/g)].map(({0: open, index}) => {
  let depth = 1, at = index + open.length;
  for (const tag of svg.slice(at).matchAll(/<(\/?)g\b[^>]*?(\/?)>/g)) {
    depth += tag[1] ? -1 : tag[2] ? 0 : 1;
    if (!depth) { at = at + tag.index; break; }
  }
  const body = svg.slice(index + open.length, at), group = attrs(open);
  const cross = body.match(/<path\b([^>]*)\/>/);
  return {
    path: group['data-opf-path'], label: group['aria-label'],
    panel: attrs(body.match(/<rect\b([^>]*)\/>/)[1]),
    text: [...body.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)].map(([, own, content]) => ({...attrs(own), content: unescape(content)})),
    cross: cross && attrs(cross[1]),
  };
});
const shapes = xml => [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape]) => {
  const off = shape.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>/), ext = shape.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/);
  return {
    name: shape.match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)?.[1] ?? '',
    descr: attrs(shape.match(/<p:cNvPr\b([^>]*)>/)?.[1] ?? '').descr,
    text: [...shape.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match => unescape(match[1])).join(''),
    x: +off?.[1] / EMU_PX, y: +off?.[2] / EMU_PX, w: +ext?.[1] / EMU_PX, h: +ext?.[2] / EMU_PX,
    geometry: shape.match(/<a:prstGeom prst="(\w+)"/)?.[1],
    flipV: /<a:xfrm\b[^>]*\bflipV="1"/.test(shape),
    size: shape.match(/<a:rPr\b[^>]*\bsz="(\d+)"/)?.[1],
    bold: shape.match(/<a:rPr\b[^>]*\bb="(\d)"/)?.[1],
    align: shape.match(/<a:pPr\b[^>]*\balgn="(\w+)"/)?.[1],
    textColor: shape.match(/<a:rPr\b[\s\S]*?<a:solidFill><a:srgbClr val="([0-9A-F]{6})"/)?.[1],
    fill: shape.match(/<p:spPr>[\s\S]*?<a:solidFill><a:srgbClr val="([0-9A-F]{6})"/)?.[1],
    stroke: shape.match(/<a:ln\b[^>]*>[\s\S]*?<a:srgbClr val="([0-9A-F]{6})"/)?.[1],
    strokeWidth: shape.match(/<a:ln w="(\d+)"/)?.[1],
    dash: shape.match(/<a:prstDash val="(\w+)"/)?.[1],
  };
});
// opf-pptx#221: the panel and its label lines or cross strokes are one native group that carries the accessible name.
const PANEL = /^OPF image placeholder \d+$/;
const groupDescr = (xml, panel) => attrs(xml.match(new RegExp(`<p:cNvPr\\b[^>]*\\bname="${panel} group"[^>]*>`))?.[0] ?? '').descr;
const near = (actual, expected, message, tolerance = .05) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);
const hex = color => color.replace(/^#/, '').toUpperCase();

const long = 'A description long enough that no label can fit. '.repeat(120);
const deck = {
  design: {fontScheme: 'roboto'},
  assets: {registered: {src: 'https://example.invalid/missing-registered.png', alt: 'Registry description'}},
  slides: [
    {title: 'Alt text, title and default', blocks: [
      {image: {src: 'asset:registered', alt: 'Block description & <literal markup>'}},
      {image: {src: 'asset:registered'}},
      {image: {src: 'https://example.invalid/missing-titled.png', title: 'Only a title'}},
      {image: 'https://example.invalid/missing-plain.png'},
    ]},
    {title: 'Label too long', image: {src: 'https://example.invalid/missing-long.png', alt: long}},
  ],
};

let checked = 0;
const fonts = await loadFonts({pack: 'office', fallbackFamily: 'Roboto', strictGlyphs: false});
for (const options of [{}, {fonts}]) {
  const preview = toSvg(deck, {trace: true, ...options});
  const entries = unzipSync(await toPptx(deck, {seed: 1, ...options}));
  const slideXml = index => decoder.decode(entries[`ppt/slides/slide${index + 1}.xml`]);
  const native = index => shapes(slideXml(index));

  const labelled = placeholders(preview[0]);
  assert.deepEqual(labelled.map(item => item.label), [
    'Image unavailable: Block description & <literal markup>',
    'Image unavailable: Registry description',
    'Image unavailable: Only a title',
    'Image unavailable: Image',
  ]);
  const first = native(0);
  const panels = first.filter(shape => PANEL.test(shape.name));
  assert.equal(panels.length, 4, 'One native panel per unavailable image');
  for (const [index, item] of labelled.entries()) {
    const panel = panels[index];
    // The panel is the preview's dashed rect; its group carries the accessible name (the preview's <g> aria-label).
    assert.equal(panel.fill, hex(item.panel.fill), `${item.path}: panel fill`);
    assert.equal(panel.stroke, hex(item.panel.stroke), `${item.path}: panel line`);
    assert.equal(panel.dash, 'dash', `${item.path}: 4 3 dashes are PowerPoint's dash`);
    assert.equal(panel.strokeWidth, String(Math.round(+item.panel['stroke-width'] * PX_PT * 12700)), `${item.path}: panel line width`);
    assert.equal(groupDescr(slideXml(0), panel.name), item.label, `${item.path}: accessible name`);
    assert.equal(panel.descr, undefined, `${item.path}: the panel does not repeat it`);
    near(panel.x, +item.panel.x, `${item.path}: panel x`); near(panel.y, +item.panel.y, `${item.path}: panel y`);
    near(panel.w, +item.panel.width, `${item.path}: panel width`); near(panel.h, +item.panel.height, `${item.path}: panel height`);
    // Its label is the same lines, at the preview's size, weight and colour.
    assert.ok(item.text.length === 2 && item.text[0].content === 'Image unavailable', `${item.path}: preview label`);
    const inside = first.filter(shape => shape.text && shape.x >= panel.x - .01 && shape.x + shape.w <= panel.x + panel.w + .01 && shape.y >= panel.y - .01 && shape.y + shape.h <= panel.y + panel.h + .01);
    assert.deepEqual(inside.map(shape => shape.text), item.text.map(line => line.content), `${item.path}: label lines`);
    for (const [line, shape] of inside.entries()) {
      const drawn = item.text[line];
      assert.equal(+shape.size, Math.round(+drawn['font-size'] * PX_PT * 100), `${item.path}: label size`);
      // Measured fonts choose a real 600 face, so the style link is that face's, not necessarily bold.
      if (options.fonts === undefined) assert.equal(shape.bold, +drawn['font-weight'] >= 600 ? '1' : '0', `${item.path}: label weight`);
      else assert.equal(+drawn['font-weight'], 600, `${item.path}: the preview keeps its semibold weight`);
      assert.equal(shape.textColor, hex(drawn.fill), `${item.path}: label colour`);
      assert.equal(shape.align, 'ctr', `${item.path}: label alignment`);
      near(shape.y + +drawn['font-size'], +drawn.y, `${item.path}: label baseline`);
      if (options.fonts === undefined) near(shape.x + shape.w / 2, +drawn.x, `${item.path}: label centre`);
      checked++;
    }
  }

  // A label that cannot fit at the minimum size becomes a status cross, and the
  // full description stays in the accessible name rather than the slide copy.
  const [tight] = placeholders(preview[1]);
  assert.equal(tight.text.length, 0, 'The preview draws no label');
  assert.ok(tight.cross, 'The preview draws a cross');
  const crossColor = tight.cross.stroke, d = tight.cross.d.match(/-?\d+(?:\.\d+)?/g).map(Number);
  const second = native(1);
  assert.ok(!second.some(shape => /Image unavailable/.test(shape.text)), 'No label text is exported');
  const strokes = second.filter(shape => shape.geometry === 'line');
  assert.equal(strokes.length, 2, 'Two native lines make the cross');
  const [x0, y0, x1, y1] = [d[0], d[1], d[2], d[3]];
  for (const [index, stroke] of strokes.entries()) {
    near(stroke.x, Math.min(x0, x1), `cross ${index} x`); near(stroke.y, Math.min(y0, y1), `cross ${index} y`);
    near(stroke.w, Math.abs(x1 - x0), `cross ${index} width`); near(stroke.h, Math.abs(y1 - y0), `cross ${index} height`);
    assert.equal(stroke.flipV, index === 1, `cross ${index}: the second stroke runs bottom left to top right`);
    assert.equal(stroke.stroke, hex(crossColor), `cross ${index} colour`);
  }
  const panel = second.find(shape => PANEL.test(shape.name));
  assert.equal(groupDescr(slideXml(1), panel.name), tight.label, 'The long description stays in the accessible name');
  assert.ok(tight.label.startsWith('Image unavailable: A description long enough'));
  checked++;
}

// Characters XML cannot represent are rejected like the preview rejects them in a label, whether the
// placeholder draws its label (short alt) or falls back to the cross (long alt, where the description
// would otherwise reach the panel's accessible name unchecked).
for (const [name, alt, code] of [
  ['control character in a label', 'Photo \u0001 of the team', 'U+0001 at UTF-16 offset'],
  ['control character in a cross description', `${long}\u0001`, 'U+0001 at UTF-16 offset'],
  ['lone surrogate in a label', 'Photo \ud800 of the team', 'U+D800 at UTF-16 offset'],
  ['lone surrogate in a cross description', `${long}\udfff`, 'U+DFFF at UTF-16 offset'],
]) {
  await assert.rejects(toPptx({slides: [{image: {src: 'https://example.invalid/bad.png', alt}}]}, {seed: 1}),
    error => error.code === 'invalid-text' && error.message.includes(code) && error.details.path === 'slides.0.image', name);
  checked++;
}
// A valid surrogate pair (an emoji) is ordinary text, and the description stays well-formed XML.
{
  const emoji = `${long}\u{1F600} & <done>`;
  const xml = decoder.decode(unzipSync(await toPptx({slides: [{image: {src: 'https://example.invalid/emoji.png', alt: emoji}}]}, {seed: 1}))['ppt/slides/slide1.xml']);
  assert.equal(XMLValidator.validate(xml), true);
  assert.equal(groupDescr(xml, shapes(xml).find(shape => PANEL.test(shape.name)).name), `Image unavailable: ${emoji}`);
  checked++;
}

// Real images never produce a placeholder.
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO8sAAAAASUVORK5CYII=', 'base64'));
const real = decoder.decode(unzipSync(await toPptx({slides: [{image: {src: './real.png', alt: 'Real'}}]}, {seed: 1, imageResolver: async () => png}))['ppt/slides/slide1.xml']);
assert.ok(!/OPF image placeholder|Image unavailable/.test(real) && /<p:pic>/.test(real));

console.log(`Image placeholders passed: ${checked} label and cross cases match the preview's text, size, weight, colour, position, dashed panel and accessible name, with and without measured fonts.`);
