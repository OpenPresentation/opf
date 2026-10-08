// FA-23: image backgrounds (core 0.15 SlideComposition.backgroundImage). Without alt text the picture is the native slide
// background fill (test/background-fills.mjs); with alt text it is a full-slide picture at the back of the slide carrying
// descr, over the canvas colour. The overlay is one shape directly above the picture. Both import back as the slide's
// image background, and the design's round-trip deck imports back to the same OPF.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {unzipSync, zipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {composeSlide} from '@openpresentation/opf/composition';
import {validate} from '@openpresentation/opf';
import {toPptx, fromPptx} from '../dist/index.js';

const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false});
const array = value => value == null ? [] : Array.isArray(value) ? value : [value];
const decode = bytes => new TextDecoder().decode(bytes);
const read = async name => `data:image/png;base64,${(await readFile(new URL(`fixtures/images/${name}`, import.meta.url))).toString('base64')}`;
const wide = await read('wide.png'), square = await read('square.png');
assert.ok(composeSlide({title: 'probe', design: {background: {type: 'image', src: 'asset:x'}}}).backgroundImage, 'Linked core composition has no backgroundImage; pin a core with the FA-22 backgrounds.');
const emu = value => Math.round(value / 96 * 914400);
async function exported(deck, options = {}) {
  const diagnostics = [];
  const bytes = await toPptx(deck, {imageFormat: 'preserve', strictAssets: true, onDiagnostic: d => diagnostics.push(d), ...options});
  const entries = unzipSync(bytes), xml = decode(entries['ppt/slides/slide1.xml']);
  const tree = parser.parse(xml)['p:sld']['p:cSld'];
  return {bytes, entries, xml, background: /<p:bg>[\s\S]*?<\/p:bg>/.exec(xml)[0], pictures: array(tree['p:spTree']['p:pic']), shapes: array(tree['p:spTree']['p:sp']), diagnostics};
}
const names = xml => [...xml.matchAll(/<p:cNvPr\b[^>]*\bname="([^"]*)"/g)].map(match => match[1]).filter(Boolean);
let checked = 0;

// With alt: a full-slide picture at the back with descr; the native background is the canvas colour.
for (const fit of ['cover', 'contain', 'stretch', 'tile']) {
  const deck = {slides: [{title: 'Harbour', design: {background: {type: 'image', src: wide, alt: 'Container ships at dawn', fit}}}]};
  const {xml, background, pictures, bytes} = await exported(deck);
  assert.match(background, /<a:solidFill>/, `${fit}: the slide background is the canvas colour`);
  assert.equal(names(xml)[0], 'OPF background slides.0', `${fit}: the picture is the back-most object`);
  const picture = pictures[0];
  assert.equal(picture['p:nvPicPr']['p:cNvPr'].descr, 'Container ships at dawn');
  const xfrm = picture['p:spPr']['a:xfrm'];
  assert.deepEqual([xfrm['a:off'].x, xfrm['a:off'].y, xfrm['a:ext'].cx, xfrm['a:ext'].cy].map(Number), [0, 0, emu(1280), emu(720)], `${fit}: full slide`);
  const fill = picture['p:blipFill'];
  if (fit === 'tile') assert.deepEqual(fill['a:tile'], {tx: '0', ty: '0', sx: '100000', sy: '100000', flip: 'none', algn: 'tl'});
  // A 2:1 picture on a 16:9 slide: contain pads above and below, cover crops the sides.
  if (fit === 'contain') assert.ok(Number(fill['a:srcRect'].t) < 0 && fill['a:srcRect'].l === '0', 'contain pads the picture over the canvas colour');
  if (fit === 'cover') assert.ok(Number(fill['a:srcRect'].l) > 0 && fill['a:srcRect'].t === '0');
  if (fit === 'stretch') assert.equal(fill['a:srcRect'], undefined);
  const diagnostics = [];
  const imported = await fromPptx(await toPptx(deck, {imageFormat: 'preserve', provenance: false}), {onDiagnostic: d => diagnostics.push(d)});
  assert.deepEqual(imported.slides[0].design.background, {type: 'image', src: wide, alt: 'Container ships at dawn', fit}, `${fit}: the tagged picture is the background`);
  assert.equal(imported.slides[0].blocks, undefined, `${fit}: the picture is no content`);
  assert.deepEqual(diagnostics.filter(d => /image-provenance|image-crop|background/.test(d.code)), []);
  assert.deepEqual((await fromPptx(bytes, {onDiagnostic: () => {}})).slides[0].design.background, deck.slides[0].design.background);
  checked++;
}

// Overlay: one shape directly above the picture, whole slide or an edge band, beneath content.
{
  const band = {color: 'dark1', opacity: 0.6, edge: 'bottom', size: 0.25};
  for (const [label, background] of [['fill', {type: 'image', src: wide, overlay: {color: 'dark1', opacity: 0.4}}], ['picture', {type: 'image', src: wide, alt: 'Harbour', overlay: band}]]) {
    const deck = {design: {watermark: {src: square, opacity: 0.2}}, slides: [{title: 'Over a photo', design: {background}}]};
    const geometry = composeSlide(deck.slides[0], {width: 1280, height: 720, presentation: deck}).backgroundImage;
    const {xml, shapes} = await exported(deck);
    const order = names(xml);
    const overlayName = label === 'fill' ? 'OPF background overlay slides.0' : 'OPF background slides.0 overlay';
    const expected = label === 'fill' ? [overlayName, 'OPF watermark'] : ['OPF background slides.0', overlayName, 'OPF watermark'];
    assert.deepEqual(order.slice(0, expected.length), expected, `${label}: picture, overlay, watermark, then content`);
    const overlay = shapes.find(shape => shape['p:nvSpPr']['p:cNvPr'].name === overlayName)['p:spPr'];
    const box = geometry.overlay.box;
    assert.deepEqual([overlay['a:xfrm']['a:off'].x, overlay['a:xfrm']['a:off'].y, overlay['a:xfrm']['a:ext'].cx, overlay['a:xfrm']['a:ext'].cy].map(Number), [box.x, box.y, box.width, box.height].map(emu));
    assert.equal(Number(overlay['a:solidFill']['a:srgbClr']['a:alpha'].val), Math.round((label === 'fill' ? 0.4 : 0.6) * 100000));
    const imported = await fromPptx(await toPptx(deck, {imageFormat: 'preserve', provenance: false}), {onDiagnostic: () => {}});
    assert.deepEqual(imported.slides[0].design.background.overlay, background.overlay, `${label}: the overlay returns`);
    assert.equal(JSON.stringify(imported.slides[0].blocks ?? []).includes('PowerPoint shape'), false, `${label}: the overlay is no content`);
    checked++;
  }
}

// Recolor (FA-22 draft 3): a:grayscl or a:duotone, then a:alphaModFix, on the background's blip, in the native fill or the
// alt picture; both import back.
{
  const scheme = {name: 'Recolor', dark1: '#101820', light1: '#F4F1EA', dark2: '#2A3440', light2: '#E8E4DC', accent1: '#1F5AA6', accent2: '#4A7A3A', accent3: '#B05A2A', accent4: '#7A4A9A', accent5: '#C0C8D0', accent6: '#5A8A9A', hyperlink: '#1F5AA6', followedHyperlink: '#7A4A9A'};
  for (const alt of [undefined, 'Harbour']) {
    const duotone = {type: 'image', src: wide, ...(alt ? {alt} : {}), recolor: {dark: 'accent1', light: 'light1'}, opacity: 0.5};
    const deck = {design: {colorScheme: scheme}, slides: [{title: 'Duotone', design: {background: duotone}}]};
    const {xml, background} = await exported(deck);
    assert.match(alt ? xml : background, /<a:blip r:embed="[^"]+"><a:duotone><a:srgbClr val="1F5AA6"><\/a:srgbClr><a:srgbClr val="F4F1EA"><\/a:srgbClr><\/a:duotone><a:alphaModFix amt="50000"\/>/, `${alt ? 'picture' : 'fill'}: duotone then alpha`);
    const plain = await fromPptx(await toPptx(deck, {imageFormat: 'preserve', provenance: false}), {onDiagnostic: () => {}});
    assert.deepEqual(plain.slides[0].design.background.recolor, alt ? duotone.recolor : {dark: '#1F5AA6', light: '#F4F1EA'}, 'the tag keeps the authored colours; the native fill reads the literal ones');
    const gray = await exported({slides: [{title: 'Gray', design: {background: {type: 'image', src: wide, recolor: 'grayscale'}}}]});
    assert.match(gray.background, /<a:blip r:embed="[^"]+"><a:grayscl\/><\/a:blip>/);
    assert.equal((await fromPptx(gray.bytes, {onDiagnostic: () => {}})).slides[0].design.background.recolor, 'grayscale');
  }
  checked++;
}

// A deck background (or a theme's) applies to every slide that sets none; a slide background replaces it.
{
  const deck = {design: {background: {type: 'image', src: wide, alt: 'Deck photo'}}, slides: [{title: 'A'}, {title: 'B', design: {background: '#112233'}}]};
  const bytes = await toPptx(deck, {imageFormat: 'preserve', provenance: false});
  const entries = unzipSync(bytes);
  assert.match(decode(entries['ppt/slides/slide1.xml']), /name="OPF background slides.0"/);
  assert.doesNotMatch(decode(entries['ppt/slides/slide2.xml']), /OPF background/);
  const tagged = await fromPptx(await toPptx(deck, {imageFormat: 'preserve'}), {onDiagnostic: () => {}});
  assert.deepEqual(tagged.design.background, deck.design.background);
  checked++;
}

// An edited background picture stays an ordinary picture with a diagnostic; the document tag does not restore the
// background either, because the picture is part of its native evidence.
for (const provenance of [false, 'full']) {
  const {entries} = await exported({slides: [{title: 'Edited', design: {background: {type: 'image', src: wide, alt: 'Harbour'}}}]}, {provenance});
  const path = 'ppt/slides/slide1.xml';
  entries[path] = new TextEncoder().encode(decode(entries[path]).replace(/(<p:pic>[\s\S]*?<a:off x=")(\d+)/, (_, head, x) => `${head}${Number(x) + 9525}`));
  const diagnostics = [];
  const imported = await fromPptx(zipSync(entries), {onDiagnostic: d => diagnostics.push(d)});
  assert.notEqual(imported.slides[0].design?.background?.type, 'image', `provenance ${provenance}`);
  assert.ok(diagnostics.some(d => d.code === 'invalid-image-provenance' && d.path === 'slides.0.design.background'));
  assert.ok(JSON.stringify(imported.slides[0].blocks).includes('"type":"image"'));
  checked++;
}

// Design "Round trip": a deck with an image background, an overlay and a treated, placed image block imports back to the
// same OPF.
{
  const deck = {
    $schema: 'https://openpresentation.org/schema/opf/v1', name: 'Round trip', language: 'en-US',
    design: {dimensions: 'widescreen', colorScheme: {name: 'Harbour', dark1: '#101820', light1: '#F4F1EA', dark2: '#2A3440', light2: '#E8E4DC', accent1: '#1F5AA6', accent2: '#4A7A3A',
      accent3: '#B05A2A', accent4: '#7A4A9A', accent5: '#C0C8D0', accent6: '#5A8A9A', hyperlink: '#1F5AA6', followedHyperlink: '#7A4A9A'}},
    slides: [
      {title: 'Shipping, rebuilt', design: {background: {type: 'image', src: wide, alt: 'Container ships at dawn', focus: {x: 0.5, y: 0.7}, overlay: {color: 'dark1', opacity: 0.4}}}},
      {title: 'Where we ship', blocks: [
        {type: 'image', image: {src: square, alt: 'Shipping routes'}, fit: 'contain', shape: 'rounded', cornerRadius: 0.1, border: {color: 'accent1', width: 2}, overlay: {color: '#000000', opacity: 0.2}, placement: {edge: 'right', size: 0.45}},
        {type: 'text', text: 'Twelve ports, three continents'}]}
    ]
  };
  assert.equal(validate(deck, {only: ['format']}).valid, true);
  const diagnostics = [];
  const imported = await fromPptx(await toPptx(deck, {imageFormat: 'preserve', strictAssets: true}), {onDiagnostic: d => diagnostics.push(d)});
  assert.deepEqual(imported, deck);
  assert.deepEqual(diagnostics.filter(d => /provenance|reference-changed|image-crop/.test(d.code)), []);
  checked++;
}
console.log(`background images: ${checked} native picture checks passed`);
