// FA-23: image blocks draw from core's ComposedItem.image (FA-22): the picture in the frame with the block's fit and focus,
// the shape mask (core imageShape outline), Rec. 601 recolor and pixel-only opacity, the centered border, then the overlay,
// in the paint order of 0.14's slide-level image; a placed block at its edge band.
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { resolveSlideContext } from '@openpresentation/opf';
import { composeSlide, fitImage } from '@openpresentation/opf/composition';
import { svgToPng, renderSlideSvg } from '../dist/index.js';

// A core without image block geometry is a pinning error, not a reason to skip.
assert.ok(composeSlide({ blocks: [{ type: 'image', image: 'data:image/png;base64,AA' }] }).items.find(item => item.field === 'image')?.image?.shape,
  'Linked core composition has no image block geometry (ComposedItem.image); pin a core with FA-22.');

const solid = async (color, width = 64, height = 64) => {
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i++) raw.set(color, i * 3);
  return `data:image/png;base64,${(await sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer()).toString('base64')}`;
};
// 120x60: left half red, right half blue.
const split = await (async () => {
  const raw = Buffer.alloc(120 * 60 * 3);
  for (let y = 0; y < 60; y++) for (let x = 0; x < 120; x++) raw.set(x < 60 ? [220, 30, 30] : [30, 30, 220], (y * 120 + x) * 3);
  return `data:image/png;base64,${(await sharp(raw, { raw: { width: 120, height: 60, channels: 3 } }).png().toBuffer()).toString('base64')}`;
})();
const orange = [230, 120, 20], orangeUri = await solid(orange);
const COLORS = { dark1: '#101820', light1: '#F4F1EA', dark2: '#2B3A4A', light2: '#E4DED2', accent1: '#1F5AA6', accent2: '#C2410C', accent3: '#15803D', accent4: '#7C3AED', accent5: '#C0C8D0', accent6: '#0E7490', hyperlink: '#1F5AA6', followedHyperlink: '#7C3AED' };
const deckWith = (block, design = {}, slide = {}) => ({ design: { colorScheme: { ...COLORS }, ...design }, slides: [{ title: 'Treatment', blocks: [{ type: 'image', image: orangeUri, ...block }, { type: 'text', text: 'Copy beside the picture.' }], ...slide }] });
const imageOf = (deck, index = 0) => {
  const context = resolveSlideContext(deck, index, {});
  return composeSlide(deck.slides[index], context.options).items.find(item => item.field === 'image');
};
const attr = (tag, name) => tag?.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
const element = (svg, name, filter = '') => [...svg.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'g'))].map(m => m[0]).find(tag => tag.includes(filter));
const imageTag = svg => element(svg, 'image');
let checked = 0;

// Fit: cover (the default), contain and stretch draw in the frame (item.image.box) with the matching preserveAspectRatio.
for (const [fit, aspect] of [[undefined, 'xMidYMid slice'], ['cover', 'xMidYMid slice'], ['contain', 'xMidYMid meet'], ['stretch', 'none']]) {
  const deck = deckWith({ image: split, ...(fit ? { fit } : {}) });
  const item = imageOf(deck), svg = renderSlideSvg(deck, 0, { trace: true });
  const tag = imageTag(svg);
  assert.equal(item.image.fit, fit ?? 'cover');
  assert.deepEqual(['x', 'y', 'width', 'height'].map(name => Number(attr(tag, name))), ['x', 'y', 'width', 'height'].map(key => item.image.box[key]), `${fit}: frame`);
  assert.equal(attr(tag, 'preserveAspectRatio'), aspect, `${fit}: preserveAspectRatio`);
  assert.equal(attr(tag, 'data-opf-path'), item.path);
  checked++;
}
// design.imageFit is the default for blocks without fit.
assert.equal(attr(imageTag(renderSlideSvg(deckWith({ image: split }, { imageFit: 'contain' }), 0)), 'preserveAspectRatio'), 'xMidYMid meet');
checked++;

// Focus: a cover crop away from the center places the whole picture by core's fit math and clips it to the frame.
{
  const deck = deckWith({ image: split, focus: { x: 0, y: 0.5 } });
  const item = imageOf(deck), svg = renderSlideSvg(deck, 0);
  const frame = item.image.box, placement = item.image.picture ?? fitImage(frame, 'cover', 2, { x: 0, y: 0.5 });
  const viewport = element(svg, 'svg', 'overflow="hidden"');
  assert.deepEqual(['x', 'y', 'width', 'height'].map(name => Number(attr(viewport, name))), ['x', 'y', 'width', 'height'].map(key => frame[key]));
  const tag = imageTag(svg);
  assert.equal(attr(tag, 'preserveAspectRatio'), 'none');
  assert.equal(Number(attr(tag, 'x')), Number((placement.image.x - frame.x).toFixed(3)), 'focus x = 0 keeps the left edge');
  assert.equal(Number(attr(tag, 'width')), Number(placement.image.width.toFixed(3)));
  // Raster: the left (red) half fills the frame.
  const { data, info } = await sharp(await svgToPng(svg, { scale: 0.25 })).raw().toBuffer({ resolveWithObject: true });
  const at = (x, y) => [...data.subarray((Math.round(y) * info.width + Math.round(x)) * info.channels, (Math.round(y) * info.width + Math.round(x)) * info.channels + 3)];
  // Each sampled point shows the half of the source the fit math puts there (red left, blue right); focus x = 0 keeps the red half in view.
  let sampled = 0;
  for (const share of [0.05, 0.3, 0.6, 0.95]) {
    const x = frame.x + frame.width * share, u = (x - placement.image.x) / placement.image.width;
    if (Math.abs(u - 0.5) < 0.05) continue;
    const pixel = at(x * 0.25, (frame.y + frame.height / 2) * 0.25);
    assert.ok(u < 0.5 ? pixel[0] > 150 && pixel[2] < 90 : pixel[2] > 150 && pixel[0] < 90, `focus left at ${share}: source ${u.toFixed(2)} drawn as ${pixel}`);
    sampled++;
  }
  assert.ok(sampled >= 3);
  assert.ok((frame.x - placement.image.x) / placement.image.width < 0.01, 'the left edge of the source is in view');
  checked++;
}

// A picture the host's imageResolver supplies: core cannot read it at compose time (no item.image.picture), so the renderer
// places it with core's intrinsicImageAspect of the resolved source and the same fit math.
{
  const deck = deckWith({ image: './split.png', focus: { x: 0, y: 0.5 } });
  const item = imageOf(deck);
  assert.equal(item.image.picture, undefined, 'core reads no aspect from a relative path');
  const tag = imageTag(renderSlideSvg(deck, 0, { imageResolver: src => src === './split.png' ? split : undefined }));
  const placement = fitImage(item.image.box, 'cover', 2, { x: 0, y: 0.5 });
  assert.equal(attr(tag, 'preserveAspectRatio'), 'none');
  assert.equal(Number(attr(tag, 'width')), Number(placement.image.width.toFixed(3)));
  assert.equal(Number(attr(tag, 'x')), Number((placement.image.x - item.image.box.x).toFixed(3)));
  checked++;
}

// Masks use exactly the core outline in a clipPath around the picture; rectangles need none.
for (const shape of ['rounded', 'circle', 'hexagon']) {
  const deck = deckWith({ shape });
  const item = imageOf(deck), svg = renderSlideSvg(deck, 0);
  const id = `opf-s1-image-${item.path.replace(/[^A-Za-z0-9]+/g, '-')}-clip`;
  const clip = svg.match(new RegExp(`<clipPath id="${id}"><path d="([^"]+)"/></clipPath>`));
  assert.equal(clip?.[1], item.image.shape.path, shape);
  assert.match(svg, new RegExp(`<g clip-path="url\\(#${id}\\)"><image `));
  checked++;
}
assert.doesNotMatch(renderSlideSvg(deckWith({}), 0), /clipPath/);

// Border: centered stroke on the same outline, width scaled with the canvas; alpha as stroke-opacity.
{
  const deck = deckWith({ shape: 'rounded', border: { color: '#10182080', width: 12 } }, { dimensions: { widthInches: 20, heightInches: 11.25 } });
  const item = imageOf(deck), stroke = element(renderSlideSvg(deck, 0), 'path', 'stroke=');
  assert.equal(attr(stroke, 'd'), item.image.shape.path);
  assert.equal(attr(stroke, 'stroke'), '#101820');
  assert.equal(Number(attr(stroke, 'stroke-opacity')), Math.round(0x80 / 255 * 1e6) / 1e6);
  assert.equal(Number(attr(stroke, 'stroke-width')), item.image.border.width);
  assert.equal(item.image.border.width, 18);
  assert.equal(attr(stroke, 'fill'), 'none');
  checked++;
}

// Recolor matrices and pixel-only opacity, checked on raster output at the frame's center.
async function framePixel(deck) {
  const item = imageOf(deck), box = item.image.box;
  const { data, info } = await sharp(await svgToPng(renderSlideSvg(deck, 0), { scale: 0.25 })).raw().toBuffer({ resolveWithObject: true });
  const x = Math.round((box.x + box.width / 2) * 0.25), y = Math.round((box.y + box.height / 2) * 0.25), at = (y * info.width + x) * info.channels;
  return [...data.subarray(at, at + 3)];
}
const luma = (0.299 * orange[0] + 0.587 * orange[1] + 0.114 * orange[2]) / 255;
{
  const [r, g, b] = await framePixel(deckWith({ recolor: 'grayscale' }));
  for (const channel of [r, g, b]) assert.ok(Math.abs(channel - luma * 255) <= 1, `grayscale ${channel} vs ${luma * 255}`);
  const duo = await framePixel(deckWith({ recolor: { dark: 'accent1', light: 'light1' } }));
  const dark = [0x1f, 0x5a, 0xa6], light = [0xf4, 0xf1, 0xea];
  duo.forEach((channel, i) => assert.ok(Math.abs(channel - (dark[i] + (light[i] - dark[i]) * luma)) <= 1, `duotone ${i}: ${channel}`));
  // Opacity blends the pixels over what lies beneath (a white slide background here).
  const faint = await framePixel(deckWith({ opacity: 0.25 }, { background: { type: 'solid', color: '#FFFFFF' } }));
  faint.forEach((channel, i) => assert.ok(Math.abs(channel - (255 + (orange[i] - 255) * 0.25)) <= 1, `opacity ${i}: ${channel}`));
  const svg = renderSlideSvg(deckWith({ recolor: 'grayscale', opacity: 0.12345 }), 0);
  assert.match(svg, /<g filter="url\(#opf-s1-image-[A-Za-z0-9-]+-recolor\)" opacity="0\.12345"><image /);
  assert.match(svg, /<filter color-interpolation-filters="sRGB" id="opf-s1-image-[A-Za-z0-9-]+-recolor"><feColorMatrix type="matrix" values="0\.299 0\.587 0\.114 0 0 0\.299 0\.587 0\.114 0 0 0\.299 0\.587 0\.114 0 0 0 0 0 1 0"\/>/);
  checked += 4;
}

// Overlay: its outline over the picture and border, colour alpha times overlay opacity; an edge band covers only its edge.
{
  const deck = deckWith({ border: { color: 'dark1', width: 2 }, overlay: { color: '#00000080', opacity: 0.5, edge: 'bottom', size: 0.25 } });
  const item = imageOf(deck), svg = renderSlideSvg(deck, 0, { trace: true });
  const overlay = element(svg, 'path', 'data-opf-image-overlay');
  assert.equal(attr(overlay, 'd'), item.image.overlay.shape.path);
  assert.equal(attr(overlay, 'data-opf-image-overlay'), item.image.overlay.path);
  assert.equal(item.image.overlay.box.height, Math.round(item.image.box.height * 0.25 * 1e6) / 1e6);
  assert.equal(Number(attr(overlay, 'fill-opacity')), Math.round(0x80 / 255 * 0.5 * 1e6) / 1e6);
  assert.ok(svg.indexOf('<image') < svg.indexOf('stroke=') && svg.indexOf('stroke=') < svg.indexOf('data-opf-image-overlay'), 'paint order: picture, line, overlay');
  const [r, g, b] = await framePixel(deckWith({ overlay: { color: '#000000', opacity: 0.5 } }));
  [r, g, b].forEach((channel, i) => assert.ok(Math.abs(channel - orange[i] * 0.5) <= 1, `scrim ${i}: ${channel}`));
  checked += 2;
}

// An edge overlay on a non-rectangle frame is not drawn; core reports it.
{
  const diagnostics = [];
  const svg = renderSlideSvg(deckWith({ shape: 'circle', overlay: { color: '#000000', opacity: 0.5, edge: 'top' } }), 0, { onDiagnostic: entry => diagnostics.push(entry) });
  assert.doesNotMatch(svg, /fill-opacity/);
  assert.ok(diagnostics.some(entry => entry.code === 'unsupported-image-treatment' && entry.path === 'slides.0.blocks.0.overlay.edge'), JSON.stringify(diagnostics));
  checked++;
}

// Placement: the picture fills its band edge to edge, the copy composes beside it, and the trace names the edge.
{
  const deck = deckWith({ image: split, placement: { edge: 'left', size: 0.45 } });
  const item = imageOf(deck), svg = renderSlideSvg(deck, 0, { trace: true });
  assert.deepEqual(item.image.region, { x: 0, y: 0, width: 576, height: 720 });
  assert.deepEqual(item.image.box, item.image.region);
  assert.match(svg, /<g data-opf-image-placement="left">/);
  const title = composeSlide(deck.slides[0], resolveSlideContext(deck, 0, {}).options).items.find(entry => entry.field === 'title');
  assert.ok(title.box.x >= 576, `the title composes in the remaining 55%: ${JSON.stringify(title.box)}`);
  // Inset: the band minus the slide padding.
  const inset = imageOf(deckWith({ placement: { edge: 'right', size: 0.5, inset: true } }));
  assert.ok(inset.image.box.x > inset.image.region.x && inset.image.box.width < inset.image.region.width);
  checked += 2;
}

// Alt text comes from the Asset; an unresolved source draws the placeholder without treatments.
{
  assert.match(renderSlideSvg(deckWith({ image: { src: orangeUri, alt: 'Harbor at dusk' } }), 0), /aria-label="Harbor at dusk"/);
  const diagnostics = [];
  const svg = renderSlideSvg({ slides: [{ title: 'Missing', blocks: [{ type: 'image', image: 'asset:missing', shape: 'circle', border: { color: '#000000', width: 4 }, overlay: { color: '#000000', opacity: 0.5 } }] }] }, 0, { onDiagnostic: entry => diagnostics.push(entry) });
  assert.doesNotMatch(svg, /clipPath|fill-opacity|stroke-miterlimit/);
  assert.ok(diagnostics.some(entry => entry.code === 'unresolved-asset' && entry.path === 'slides.0.blocks.0.image'), JSON.stringify(diagnostics));
  checked += 2;
}

// Slide.image is shorthand for one image block and draws the same way.
{
  const svg = renderSlideSvg({ design: { colorScheme: { ...COLORS } }, slides: [{ title: 'Root', image: { src: split, alt: 'Split' } }] }, 0, { trace: true });
  assert.equal((svg.match(/<image\b/g) ?? []).length, 1);
  assert.match(imageTag(svg), /aria-label="Split"/);
  assert.match(imageTag(svg), /data-opf-path="slides\.0\.image"/);
  checked++;
}
console.log(`image blocks: ${checked} render checks passed`);
