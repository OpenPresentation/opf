// FA-23: the 15 pptx.gallery image treatments (core docs/image-treatments.md) as OPF 0.15 image blocks and image
// backgrounds keep the native frames and paint order 0.14 exported for them as its slide-level image
// (test/fixtures/image-treatments-0.14.json, recorded from opf-pptx 0.14.0). Four treatments need a 0.14 frame that 0.15
// has no form for (a slide-wide frame inside the padding, or a centered band); they are listed in CHANGED with what 0.15
// draws instead.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {unzipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {gallery as defaultCatalog} from '@openpresentation/gallery';
import {toPptx} from '../dist/index.js';

const before = JSON.parse(await readFile(new URL('fixtures/image-treatments-0.14.json', import.meta.url), 'utf8'));
const hero = {src: `data:image/png;base64,${(await readFile(new URL('fixtures/images/treatment-hero.png', import.meta.url))).toString('base64')}`, alt: 'Project-authored posterized landscape with a sun', mediaType: 'image/png'};
const block = fields => ({type: 'image', image: 'asset:hero', ...fields});
const background = fields => ({type: 'image', src: 'asset:hero', ...fields});
const heading = id => ({title: id.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join('-'), subtitle: `pptx.gallery image-treatments/${id}`});
// The 0.15 form of each reference slide: core's docs/fixtures/image-treatments.opf.json at FA-22 (codex/fa-22-backgrounds-images
// 94535d4b), with the 0.14 slide-level image it replaces on the right.
const SLIDES = {
  'full-bleed': {design: {background: background({overlay: {color: 'dark1', opacity: 0.2}})}},                      // background, crop, overlay
  'text-overlay': {design: {background: background({overlay: {color: 'dark1', opacity: 0.55}})}},
  'side-by-side': {blocks: [block({fit: 'cover', placement: {edge: 'left', size: 0.46}})]},                           // left 0.46 crop
  'caption-overlay': {blocks: [block({fit: 'cover', overlay: {color: 'dark1', opacity: 0.75, edge: 'bottom', size: 0.25}})]},
  'masked-shape': {blocks: [block({fit: 'cover', aspectRatio: 1.1547, shape: 'hexagon', placement: {edge: 'right', inset: true}})]},
  'circular-crop': {blocks: [block({fit: 'cover', shape: 'circle', placement: {edge: 'left', size: 0.4, inset: true}})]},
  'rounded-card': {blocks: [block({fit: 'cover', shape: 'rounded', cornerRadius: 0.05, border: {color: 'accent5', width: 1}})]},
  duotone: {design: {background: background({recolor: {dark: 'accent1', light: 'light1'}})}},                     // background, crop, duotone
  'background-blur': {design: {contentBox: true, background: background({overlay: {color: 'light1', opacity: 0.4}})}},
  'image-strip': {blocks: [block({fit: 'cover', placement: {edge: 'bottom', size: 0.3}})]},
  'collage-grid': {design: {imageFit: 'cover'}, composition: {mode: 'grid', columns: 2}, blocks: [block({}), block({}), block({}), block({})]},
  'device-frame': {blocks: [block({fit: 'cover', aspectRatio: 0.5, shape: 'rounded', cornerRadius: 0.12, border: {color: 'dark1', width: 12}, placement: {edge: 'right', inset: true}})]},
  'cutout-subject': {blocks: [block({fit: 'contain', placement: {edge: 'right'}})]},
  watermark: {blocks: [block({fit: 'contain', opacity: 0.1, recolor: 'grayscale'})]},
  'cinematic-crop': {design: {background: 'dark1'}, blocks: [block({fit: 'cover', aspectRatio: 2.39})]}
};
// 0.14 drew these in a slide-wide frame (the slide inside its padding, or a centered band) that 0.15 has no form for: a
// background has no inset, mask, line or aspect ratio, so they are flowed image blocks in the body area.
const CHANGED = {
  'caption-overlay': 'a flowed cover image block with its bottom-band overlay, below the headings',
  'rounded-card': 'a flowed rounded image block with its line, below the headings',
  watermark: 'a flowed contained, grayscale, 10% image block, below the headings',
  'cinematic-crop': 'a flowed 2.39:1 image block below the headings, on the dark1 background'
};
const deck = {assets: {hero}, design: {theme: 'classic'}, slides: Object.entries(SLIDES).map(([id, slide]) => ({id, ...(id === 'collage-grid' ? {title: 'Collage Grid'} : heading(id)), ...slide}))};
const bytes = await toPptx(deck, {imageFormat: 'preserve', strictAssets: true, provenance: false, catalogs: [defaultCatalog]});
const entries = unzipSync(bytes);
const flat = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false});
// 0.14's names for the same objects, so the paint order compares as is.
const legacy = (name, index) => name.replace(/^OPF background slides\.\d+ overlay$/, `OPF slide image overlay slides.${index}`).replace(/^OPF background overlay slides\.\d+$/, `OPF slide image overlay slides.${index}`)
  .replace(/^OPF background slides\.\d+$/, `OPF slide image slides.${index}`);
const near = (a, b) => Math.abs(Number(a) - Number(b)) <= 1;
const sameNumbers = (actual, expected, label) => {
  const flatten = (value, prefix = '') => value && typeof value === 'object' ? Object.entries(value).flatMap(([key, item]) => flatten(item, `${prefix}.${key}`)) : [[prefix, value]];
  const a = Object.fromEntries(flatten(actual)), e = Object.fromEntries(flatten(expected));
  assert.deepEqual(Object.keys(a).sort(), Object.keys(e).sort(), label);
  for (const key of Object.keys(e)) assert.ok(/^-?\d+$/.test(e[key]) ? near(a[key], e[key]) : a[key] === e[key], `${label}${key}: ${a[key]} vs ${e[key]}`);
};
let same = 0, changed = 0;
const blipEffects = blip => Object.fromEntries(Object.entries(blip).filter(([key]) => !key.startsWith('r:') && key !== 'a:extLst'));
deck.slides.forEach((slide, index) => {
  const xml = new TextDecoder().decode(entries[`ppt/slides/slide${index + 1}.xml`]);
  const expected = before[slide.id];
  const pictures = [...xml.matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)].map(([p]) => flat.parse(p)['p:pic']);
  if (CHANGED[slide.id]) { assert.equal(pictures.length, 1, slide.id); changed++; return; }
  const backgroundSlide = slide.design?.background?.type === 'image';
  // Paint order: the picture, then its overlay directly above it, as in 0.14. A background without alt text is the native
  // slide background fill, beneath everything (0.14 drew it as the first picture); a placed block follows the headings, in
  // core's item order as the preview draws it (the band and the headings never overlap, so the drawing is unchanged).
  // Image blocks are numbered across the deck in 0.15 ("OPF image N"), so names compare by kind.
  const order = [...xml.matchAll(/<p:(sp|pic|graphicFrame)>[\s\S]*?<p:cNvPr\b[^>]*\bname="([^"]*)"/g)].map(m => `${m[1]}:${legacy(m[2], index)}`)
    .map(entry => entry.replace(/^pic:OPF image \d+$/, slide.id === 'collage-grid' ? 'pic:OPF image' : `pic:OPF slide image slides.${index}`).replace(/^sp:OPF image \d+ overlay$/, `sp:OPF slide image overlay slides.${index}`));
  const placed = slide.blocks?.some(entry => entry.placement);
  const headingsFirst = list => placed ? [...list.filter(entry => /OPF heading/.test(entry)), ...list.filter(entry => !/OPF heading/.test(entry))] : list;
  const was = expected.order.map(entry => entry.replace(/^pic:OPF image \d+$/, 'pic:OPF image')).filter(entry => !(backgroundSlide && entry.startsWith('pic:')));
  assert.deepEqual(order, headingsFirst(was), `${slide.id}: paint order`);
  const drawn = backgroundSlide ? [(() => {
    const fill = flat.parse(/<p:bg>[\s\S]*?<\/p:bg>/.exec(xml)[0])['p:bg']['p:bgPr']['a:blipFill'];
    // The native fill covers the slide (the 0.14 picture frame) with the same crop and blip effects.
    return {xfrm: {'a:off': {x: '0', y: '0'}, 'a:ext': {cx: String(Math.round(13.333333 * 914400)), cy: '6858000'}}, geom: {'a:avLst': '', prst: 'rect'}, ln: null, srcRect: fill['a:srcRect'] ?? null, blip: blipEffects(fill['a:blip'])};
  })()] : pictures.map(picture => ({xfrm: picture['p:spPr']['a:xfrm'], geom: picture['p:spPr']['a:prstGeom'], ln: picture['p:spPr']['a:ln'] ?? null, srcRect: picture['p:blipFill']['a:srcRect'] ?? null, blip: blipEffects(picture['p:blipFill']['a:blip'])}));
  assert.equal(drawn.length, expected.pictures.length, slide.id);
  drawn.forEach((picture, at) => {
    const was = expected.pictures[at];
    sameNumbers(picture.xfrm, was.xfrm, `${slide.id} frame`);
    sameNumbers(picture.geom, was.geom, `${slide.id} mask`);
    sameNumbers(picture.ln, was.ln, `${slide.id} line`);
    // Zero sides of a crop are no crop (a native background fill omits them, as PowerPoint does when it saves).
    const crop = rect => rect && Object.fromEntries(Object.entries(rect).filter(([, value]) => Number(value) !== 0));
    sameNumbers(crop(picture.srcRect), crop(was.srcRect), `${slide.id} crop`);
    sameNumbers(picture.blip, was.blip, `${slide.id} effects`);
  });
  const overlay = [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([s]) => flat.parse(s)['p:sp']).find(s => /overlay/.test(s['p:nvSpPr']['p:cNvPr'].name));
  if (expected.overlay) {
    sameNumbers(overlay['p:spPr']['a:xfrm'], expected.overlay.xfrm, `${slide.id} overlay frame`);
    sameNumbers(overlay['p:spPr']['a:prstGeom'], expected.overlay.geom, `${slide.id} overlay shape`);
    sameNumbers(overlay['p:spPr']['a:solidFill'], expected.overlay.fill, `${slide.id} overlay fill`);
  } else assert.equal(overlay, undefined, slide.id);
  same++;
});
assert.equal(same + changed, 15);
console.log(`image treatments vs 0.14: ${same} treatments keep 0.14's frames and paint order; ${changed} changed by design (${Object.keys(CHANGED).join(', ')})`);
