// An image that is not a readable raster (an SVG, or bytes that are no image) exports what the preview shows: the
// unavailable-image placeholder (or no watermark / the background colour), with one `unresolved-asset` diagnostic.
// It no longer throws `unsupported-image-dimensions` unless `strictAssets` is set. A host that supplies a raster
// through `imageResolver` (for example opf-render's `svgToPng`) gets a native picture and no diagnostic.
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {renderSvg, svgToPng} from '@openpresentation/opf-render';
import {toPptx} from '../dist/index.js';

const decode = bytes => new TextDecoder().decode(bytes);
const drawing = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="#c00"/></svg>';
const svgUri = `data:image/svg+xml;base64,${Buffer.from(drawing).toString('base64')}`;
const svgUtf8Uri = `data:image/svg+xml;utf8,${encodeURIComponent(drawing)}`;
const notAPng = 'data:image/png;base64,bm90LWEtcG5n';

async function run(deck, options = {}) {
  const diagnostics = [];
  const bytes = await toPptx(deck, {provenance: false, onDiagnostic: diagnostic => diagnostics.push(diagnostic), ...options});
  const entries = unzipSync(bytes);
  return {diagnostics, slide: decode(entries['ppt/slides/slide1.xml']), media: Object.keys(entries).filter(path => path.startsWith('ppt/media/') && !path.endsWith('/'))};
}
const unresolved = diagnostics => diagnostics.filter(diagnostic => diagnostic.code === 'unresolved-asset');

let checked = 0;
for (const [name, source] of [['svg base64', svgUri], ['svg utf8 data URI', svgUtf8Uri], ['png label over non-image bytes', notAPng]]) {
  for (const [shape, image, path] of [
    ['root image', source, 'slides.0.image'],
    ['image object', {src: source, alt: 'Company logo'}, 'slides.0.image'],
    ['block image', undefined, 'slides.0.blocks.0.image'],
  ]) {
    const deck = shape === 'block image'
      ? {slides: [{title: 'T', blocks: [{image: {src: source, alt: 'Company logo'}}]}]}
      : {slides: [{title: 'T', image}]};
    const {diagnostics, slide, media} = await run(deck);
    assert.deepEqual(unresolved(diagnostics).map(({path: at, reason}) => ({at, reason})), [{at: path, reason: 'unsupported-format'}], `${name} ${shape}: one diagnostic`);
    assert.ok(!slide.includes('<p:pic>'), `${name} ${shape}: no picture`);
    assert.equal(media.length, 0, `${name} ${shape}: no media`);
    assert.match(slide, /name="OPF image placeholder 1"/, `${name} ${shape}: the preview's placeholder panel`);
    if (shape !== 'root image') assert.match(slide, /descr="Image unavailable: Company logo"/);
    // The preview draws the same placeholder for an SVG (it only trusts the declared type of raster data URIs).
    if (source !== notAPng) {
      const preview = [];
      const svg = renderSvg(deck, {onDiagnostic: diagnostic => preview.push(diagnostic)});
      assert.ok(svg.includes('data-opf-asset-status="unresolved"'), `${name} ${shape}: preview placeholder`);
      assert.equal(unresolved(preview).length, 1);
    }
    await assert.rejects(run(deck, {strictAssets: true}), error => error.code === 'unsupported-image-dimensions' && error.details?.path === path, `${name} ${shape}: strictAssets still throws`);
    checked++;
  }
}

// Watermark: no picture, one diagnostic (not two); strictAssets throws.
{
  const deck = {design: {watermark: {src: svgUri, opacity: 0.1}}, slides: [{title: 'A'}]};
  const {diagnostics, slide} = await run(deck);
  assert.deepEqual(unresolved(diagnostics).map(({path, reason}) => ({path, reason})), [{path: 'design.watermark', reason: 'unsupported-format'}]);
  assert.ok(!slide.includes('name="OPF watermark"'));
  await assert.rejects(run(deck, {strictAssets: true}), error => error.code === 'unsupported-image-dimensions' && error.details?.path === 'design.watermark');
  checked++;
}

// Image background: the slide keeps its background colour, one diagnostic.
{
  const deck = {design: {background: {type: 'image', image: {src: svgUri}}}, slides: [{title: 'A'}]};
  const {diagnostics, slide} = await run(deck);
  assert.deepEqual(unresolved(diagnostics).map(({path, reason}) => ({path, reason})), [{path: 'design.background.image', reason: 'unsupported-format'}]);
  assert.ok(!slide.includes('<a:blip'));
  await assert.rejects(run(deck, {strictAssets: true}), error => error.code === 'unsupported-image-dimensions' && error.details?.path === 'design.background.image');
  checked++;
}

// Slide image: the placeholder fills the slide image frame.
{
  const deck = {design: {slideImage: {src: svgUri, position: 'right'}}, slides: [{title: 'A', layout: 'image-1x', image: svgUri}]};
  const {diagnostics, slide} = await run(deck);
  assert.ok(unresolved(diagnostics).length >= 1 && unresolved(diagnostics).every(diagnostic => diagnostic.reason === 'unsupported-format'));
  assert.ok(!slide.includes('<p:pic>'));
  await assert.rejects(run(deck, {strictAssets: true}), error => error.code === 'unsupported-image-dimensions');
  checked++;
}

// A host rasterizes the SVG: a native picture, no diagnostic, even with strictAssets.
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
    assert.equal(media.length, 1);
  }
  assert.equal(calls, 2);
  checked++;
}

console.log(`SVG and unreadable image export checks passed (${checked}).`);
