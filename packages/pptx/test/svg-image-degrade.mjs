// An image that cannot be exported as a picture (bytes that are no image, a malformed SVG, an SVG with no size, an SVG
// whose fallback raster cannot be drawn) exports what the preview shows: the unavailable-image placeholder (or no
// watermark / the background colour), with one `unresolved-asset` diagnostic. It throws only when `strictAssets` is set.
// A valid SVG is a native SVG picture (test/svg-image.mjs); a host that supplies a raster through `imageResolver`
// gets a native raster picture and no diagnostic.
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import { renderSlideSvg, svgToPng } from '@openpresentation/opf-render';
import {toPptx} from '../dist/index.js';

const decode = bytes => new TextDecoder().decode(bytes);
const drawing = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="#c00"/></svg>';
const uriOf = text => `data:image/svg+xml;base64,${Buffer.from(text).toString('base64')}`;
const svgUri = uriOf(drawing);
const notAPng = 'data:image/png;base64,bm90LWEtcG5n';
const broken = [
  ['svg without xmlns', uriOf('<svg width="40" height="20"><rect width="40" height="20"/></svg>'), 'svg-malformed'],
  ['svg that is not closed', uriOf('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><g></svg>'), 'svg-malformed'],
  ['svg with no size', uriOf('<svg xmlns="http://www.w3.org/2000/svg"><rect width="40" height="20"/></svg>'), 'svg-no-size'],
  ['svg with an external entity', uriOf('<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>'), 'svg-unsafe'],
  ['svg that is not base64', 'data:image/svg+xml;base64,@@@', 'svg-malformed'],
  ['png label over non-image bytes', notAPng, 'unsupported-format'],
];

async function run(deck, options = {}) {
  const diagnostics = [];
  const bytes = await toPptx(deck, {provenance: false, onDiagnostic: diagnostic => diagnostics.push(diagnostic), ...options});
  const entries = unzipSync(bytes);
  return {diagnostics, slide: decode(entries['ppt/slides/slide1.xml']), media: Object.keys(entries).filter(path => path.startsWith('ppt/media/') && !path.endsWith('/'))};
}
const unresolved = diagnostics => diagnostics.filter(diagnostic => diagnostic.code === 'unresolved-asset');
// Strict mode: an unreadable raster keeps `unsupported-image-dimensions`; an SVG that cannot be exported is `invalid-svg-image`.
const strictCode = reason => reason === 'unsupported-format' ? 'unsupported-image-dimensions' : 'invalid-svg-image';

let checked = 0;
for (const [name, source, reason] of broken) {
  for (const [shape, image, path] of [
    ['root image', source, 'slides.0.image'],
    ['image object', {src: source, alt: 'Company logo'}, 'slides.0.image'],
    ['block image', undefined, 'slides.0.blocks.0.image'],
  ]) {
    const deck = shape === 'block image'
      ? {slides: [{title: 'T', blocks: [{image: {src: source, alt: 'Company logo'}}]}]}
      : {slides: [{title: 'T', image}]};
    const {diagnostics, slide, media} = await run(deck);
    assert.deepEqual(unresolved(diagnostics).map(({path: at, reason: why}) => ({at, why})), [{at: path, why: reason}], `${name} ${shape}: one diagnostic`);
    assert.ok(!slide.includes('<p:pic>'), `${name} ${shape}: no picture`);
    assert.equal(media.length, 0, `${name} ${shape}: no media`);
    assert.match(slide, /name="OPF image placeholder 1"/, `${name} ${shape}: the preview's placeholder panel`);
    if (shape !== 'root image') assert.match(slide, /descr="Image unavailable: Company logo"/);
    await assert.rejects(run(deck, {strictAssets: true}), error => error.code === strictCode(reason) && error.details?.path === path, `${name} ${shape}: strictAssets throws`);
    checked++;
  }
}

// Watermark: no picture, one diagnostic (not two); strictAssets throws.
{
  const deck = {design: {watermark: {src: broken[0][1], opacity: 0.1}}, slides: [{title: 'A'}]};
  const {diagnostics, slide} = await run(deck);
  assert.deepEqual(unresolved(diagnostics).map(({path, reason}) => ({path, reason})), [{path: 'design.watermark', reason: 'svg-malformed'}]);
  assert.ok(!slide.includes('name="OPF watermark"'));
  await assert.rejects(run(deck, {strictAssets: true}), error => error.code === 'invalid-svg-image' && error.details?.path === 'design.watermark');
  checked++;
}

// Image background: the slide keeps its background colour, one diagnostic.
{
  const deck = {design: {background: {type: 'image', src: broken[0][1]}}, slides: [{title: 'A'}]};
  const {diagnostics, slide} = await run(deck);
  assert.deepEqual(unresolved(diagnostics).map(({path, reason}) => ({path, reason})), [{path: 'design.background', reason: 'svg-malformed'}]);
  assert.ok(!slide.includes('<a:blip'));
  await assert.rejects(run(deck, {strictAssets: true}), error => error.code === 'invalid-svg-image' && error.details?.path === 'design.background');
  checked++;
}

// Placed image block: the placeholder fills the image frame.
{
  const deck = {slides: [{title: 'A', blocks: [{type: 'image', image: broken[0][1], placement: {edge: 'right'}}]}]};
  const {diagnostics, slide} = await run(deck);
  assert.ok(unresolved(diagnostics).length >= 1 && unresolved(diagnostics).every(diagnostic => diagnostic.reason === 'svg-malformed'));
  assert.match(slide, /name="OPF image placeholder 1"/);
  assert.ok(!slide.includes('<p:pic>'));
  await assert.rejects(run(deck, {strictAssets: true}), error => error.code === 'invalid-svg-image');
  checked++;
}

// The preview shows the same placeholder for an SVG it cannot size or decode (it only trusts the declared type of raster
// data URIs, so not for a mislabeled PNG). opf-render main after opf-render#88 draws the unclosed document and the one with
// an external entity (its own parser repairs the first and never resolves the second), so the preview check covers the
// cases every renderer flags; the export still degrades all of them.
const drawnByRendererMain = new Set(['svg that is not closed', 'svg with an external entity']);
for (const [, source] of broken.filter(([name, source]) => source !== notAPng && !drawnByRendererMain.has(name))) {
  const preview = [];
  const svg = renderSlideSvg({slides: [{title: 'T', image: source}]}, 0, {onDiagnostic: diagnostic => preview.push(diagnostic)});
  assert.ok(svg.includes('data-opf-asset-status="unresolved"'), 'preview placeholder');
  checked++;
}

// An SVG whose fallback raster cannot be drawn (the rasterizer throws, or returns no PNG): the placeholder, reason svg-render-failed.
for (const svgRasterizer of [async () => { throw new Error('boom'); }, async () => new Uint8Array([1, 2, 3])]) {
  const deck = {slides: [{title: 'T', image: svgUri}]};
  const {diagnostics, slide} = await run(deck, {svgRasterizer});
  assert.deepEqual(unresolved(diagnostics).map(({path, reason}) => ({path, reason})), [{path: 'slides.0.image', reason: 'svg-render-failed'}]);
  assert.ok(!slide.includes('<p:pic>') && /name="OPF image placeholder 1"/.test(slide));
  await assert.rejects(run(deck, {svgRasterizer, strictAssets: true}), error => error.code === 'svg-render-failed' && error.details?.path === 'slides.0.image');
  checked++;
}

// A host rasterizes the SVG itself: imageResolver returns a PNG for the SVG source, so the picture is a native raster
// picture (no SVG part), no diagnostic, even with strictAssets.
{
  let calls = 0;
  const imageResolver = async src => {
    assert.equal(src, svgUri);
    calls++;
    return {data: await svgToPng(drawing), mediaType: 'image/png'};
  };
  for (const strictAssets of [false, true]) {
    const {diagnostics, slide, media} = await run({slides: [{title: 'T', image: {src: svgUri, alt: 'Company logo'}}]}, {imageResolver, strictAssets});
    assert.deepEqual(unresolved(diagnostics), []);
    assert.match(slide, /<p:pic>/);
    assert.ok(!slide.includes('svgBlip'));
    assert.equal(media.length, 1);
  }
  assert.equal(calls, 2);
  checked++;
}

console.log(`Unexportable image checks passed (${checked}).`);
