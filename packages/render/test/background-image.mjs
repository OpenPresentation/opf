// FA-23: image backgrounds draw from core's SlideComposition.backgroundImage (FA-22): the canvas colour, the picture (cover
// with focus, contain, stretch, or tile at its intrinsic size; opacity on its pixels only), then the overlay (the whole slide
// or an edge band), all beneath the watermark and the content; alt is the picture's accessible name.
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { resolveSlideContext } from '@openpresentation/opf';
import { composeSlide, fitImage } from '@openpresentation/opf/composition';
import { toPng, toSvg } from '../dist/index.js';

assert.ok(composeSlide({ design: { background: { type: 'image', src: 'data:image/png;base64,AA' } } }).backgroundImage,
  'Linked core composition has no backgroundImage; pin a core with FA-22.');

const png = async (width, height, paint) => {
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) raw.set(paint(x, y), (y * width + x) * 3);
  return `data:image/png;base64,${(await sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer()).toString('base64')}`;
};
// 400x100 (4:1): left quarter red, right quarter blue, middle green.
const strip = await png(400, 100, x => x < 100 ? [220, 30, 30] : x >= 300 ? [30, 30, 220] : [30, 200, 30]);
const tile = await png(40, 30, () => [200, 120, 40]);
const COLORS = { dark1: '#101820', light1: '#F4F1EA', dark2: '#2B3A4A', light2: '#E4DED2', accent1: '#1F5AA6', accent2: '#C2410C', accent3: '#15803D', accent4: '#7C3AED', accent5: '#C0C8D0', accent6: '#0E7490', hyperlink: '#1F5AA6', followedHyperlink: '#7C3AED' };
const deckWith = (background, design = {}, slide = {}) => ({ design: { colorScheme: { ...COLORS }, ...design }, slides: [{ title: 'Over the photo', design: { background }, ...slide }] });
const geometryOf = deck => composeSlide(deck.slides[0], resolveSlideContext(deck, 0, {}).options);
const attr = (tag, name) => tag?.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
const element = (svg, name, filter = '') => [...svg.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'g'))].map(m => m[0]).find(tag => tag.includes(filter));
async function raster(deck, options) {
  const { data, info } = await sharp(await toPng(toSvg(deck, 1, options), { scale: 0.25 })).raw().toBuffer({ resolveWithObject: true });
  return (x, y) => [...data.subarray((Math.round(y * 0.25) * info.width + Math.round(x * 0.25)) * info.channels, (Math.round(y * 0.25) * info.width + Math.round(x * 0.25)) * info.channels + 3)];
}
const near = (actual, expected, tolerance = 2) => actual.every((channel, i) => Math.abs(channel - expected[i]) <= tolerance);
let checked = 0;

// Paint order: canvas colour, picture, overlay, then the content; the canvas is the scheme's default slide background.
{
  const deck = deckWith({ type: 'image', src: strip, alt: 'Harbour at dawn', overlay: { color: 'dark1', opacity: 0.4 } });
  const svg = toSvg(deck, 1, { trace: true });
  const canvas = element(svg, 'rect');
  assert.equal(attr(canvas, 'fill'), COLORS.light1, 'canvas colour');
  const picture = svg.indexOf('<image'), overlay = svg.indexOf('data-opf-image-overlay'), title = svg.indexOf('data-opf-path="slides.0.title"');
  assert.ok(svg.indexOf(canvas) < picture && picture < overlay && overlay < title, 'canvas, picture, overlay, content');
  assert.equal(attr(element(svg, 'image'), 'aria-label'), 'Harbour at dawn');
  assert.equal(attr(element(svg, 'image'), 'role'), 'img');
  assert.equal(attr(element(svg, 'image'), 'data-opf-path'), 'slides.0.design.background');
  assert.equal(attr(element(svg, 'path', 'data-opf-image-overlay'), 'data-opf-image-overlay'), 'slides.0.design.background.overlay');
  // Without alt the picture is decorative.
  const plain = element(toSvg(deckWith({ type: 'image', src: strip }), 1), 'image');
  assert.equal(attr(plain, 'aria-hidden'), 'true');
  assert.equal(attr(plain, 'aria-label'), undefined);
  checked += 3;
}

// Fits: cover (default; also what an image source string means), contain and stretch.
for (const [background, aspect] of [[{ type: 'image', src: strip }, 'xMidYMid slice'], [strip, 'xMidYMid slice'], [{ type: 'image', src: strip, fit: 'contain' }, 'xMidYMid meet'], [{ type: 'image', src: strip, fit: 'stretch' }, 'none']]) {
  const tag = element(toSvg(deckWith(background), 1), 'image');
  assert.deepEqual(['x', 'y', 'width', 'height'].map(name => Number(attr(tag, name))), [0, 0, 1280, 720]);
  assert.equal(attr(tag, 'preserveAspectRatio'), aspect, JSON.stringify(background).slice(0, 60));
  checked++;
}
{
  // contain letterboxes over the canvas colour; stretch reaches both edges with the red quarter.
  const contain = await raster(deckWith({ type: 'image', src: strip, fit: 'contain' }));
  assert.ok(near(contain(640, 40), [0xF4, 0xF1, 0xEA]), `contain shows the canvas above the picture: ${contain(640, 40)}`);
  const stretch = await raster(deckWith({ type: 'image', src: strip, fit: 'stretch' }));
  assert.ok(near(stretch(100, 700), [220, 30, 30], 3), `stretch: ${stretch(100, 700)}`);
  checked += 2;
}

// Focus: cover keeps the focus point in view (a 4:1 strip on 16:9 shows only a slice of it).
{
  const left = deckWith({ type: 'image', src: strip, focus: { x: 0, y: 0.5 } });
  const geometry = geometryOf(left);
  const placement = geometry.backgroundImage.picture ?? fitImage(geometry.backgroundImage.box, 'cover', 4, { x: 0, y: 0.5 });
  assert.equal(placement.image.x, 0);
  const at = await raster(left);
  assert.ok(near(at(40, 360), [220, 30, 30], 3) && near(at(1240, 360), [30, 200, 30], 3), `focus left: red at the left edge, green at the right: ${at(40, 360)} ${at(1240, 360)}`);
  const right = await raster(deckWith({ type: 'image', src: strip, focus: { x: 1, y: 0.5 } }));
  assert.ok(near(right(1240, 360), [30, 30, 220], 3), `focus right: blue at the right edge: ${right(1240, 360)}`);
  // 4:3 deck: the focus corner stays inside the crop.
  const square = await raster(deckWith({ type: 'image', src: strip, focus: { x: 1, y: 0 } }, { dimensions: 'standard' }));
  assert.ok(near(square(900, 40), [30, 30, 220], 3), `4:3 focus top-right: ${square(900, 40)}`);
  checked += 3;
}

// Tile: the picture repeats at its intrinsic size (40x30 reference px) from the canvas top-left.
{
  const svg = toSvg(deckWith({ type: 'image', src: tile, fit: 'tile' }), 1);
  const pattern = element(svg, 'pattern');
  assert.deepEqual(['x', 'y', 'width', 'height'].map(name => Number(attr(pattern, name))), [0, 0, 40, 30]);
  assert.equal(attr(pattern, 'patternUnits'), 'userSpaceOnUse');
  assert.match(svg, /<rect [^>]*fill="url\(#opf-s1-background-tile\)"/);
  checked++;
}

// Opacity applies to the picture pixels only; the overlay keeps its own opacity on top.
{
  const deck = deckWith({ type: 'image', src: strip, fit: 'stretch', opacity: 0.5, overlay: { color: '#000000', opacity: 0.5, edge: 'bottom', size: 0.25 } });
  const svg = toSvg(deck, 1);
  assert.match(svg, /<g opacity="0\.5"><image /);
  const at = await raster(deck);
  const blended = [0, 1, 2].map(i => 0xF4F1EA >> (16 - 8 * i) & 255).map((canvas, i) => canvas + ([220, 30, 30][i] - canvas) * 0.5);
  assert.ok(near(at(100, 300), blended, 3), `half-opaque picture over the canvas: ${at(100, 300)} vs ${blended}`);
  assert.ok(near(at(100, 700), blended.map(channel => channel * 0.5), 3), `bottom band darkened: ${at(100, 700)}`);
  // The band covers only its edge.
  const geometry = geometryOf(deck);
  assert.deepEqual(geometry.backgroundImage.overlay.box, { x: 0, y: 540, width: 1280, height: 180 });
  checked += 2;
}

// Recolor (draft 3): grayscale on the picture pixels only, before the overlay, like an image block.
{
  const deck = deckWith({ type: 'image', src: strip, fit: 'stretch', recolor: 'grayscale', overlay: { color: '#1F5AA6', opacity: 0.5, edge: 'top', size: 0.2 } });
  const svg = toSvg(deck, 1);
  assert.match(svg, /<g filter="url\(#opf-s1-background-recolor\)"><image /);
  const at = await raster(deck);
  const luma = Math.round(0.299 * 220 + 0.587 * 30 + 0.114 * 30);
  assert.ok(near(at(50, 400), [luma, luma, luma], 2), `grayscale red quarter: ${at(50, 400)}`);
  const band = at(50, 40);
  assert.ok(band[2] > band[0] + 20, `the overlay keeps its colour over the grey picture: ${band}`);
  checked += 2;
}

// The background moves nothing: headings compose exactly as on a slide with a solid background.
{
  const withImage = geometryOf(deckWith({ type: 'image', src: strip }));
  const withColour = geometryOf(deckWith({ type: 'solid', color: '#FFFFFF' }));
  assert.deepEqual(withImage.items.map(item => item.box), withColour.items.map(item => item.box));
  checked++;
}

// Deck and theme levels: a deck background image applies to every slide that sets none, beneath the watermark.
{
  const deck = { design: { colorScheme: { ...COLORS }, background: { type: 'image', src: strip }, watermark: { text: 'DRAFT', opacity: 0.1 } }, slides: [{ title: 'One' }] };
  const svg = toSvg(deck, 1, { trace: true });
  assert.equal(attr(element(svg, 'image'), 'data-opf-path'), 'design.background');
  assert.ok(svg.indexOf('<image') < svg.indexOf('>DRAFT<'), 'picture beneath the watermark');
  checked++;
}

// Unresolved sources keep the ordinary placeholder at the background's opacity, without recolor or overlay.
{
  const diagnostics = [];
  const svg = toSvg(deckWith({ type: 'image', src: 'asset:missing', opacity: 0.4, recolor: 'grayscale', overlay: { color: '#000000', opacity: 0.5 } }), 1, { onDiagnostic: entry => diagnostics.push(entry) });
  assert.doesNotMatch(svg, /fill-opacity|feColorMatrix/);
  assert.match(svg, /<g opacity="0\.4"><g [^>]*data-opf-asset-status="unresolved"/);
  assert.ok(diagnostics.some(entry => entry.code === 'unresolved-asset' && entry.path === 'slides.0.design.background'), JSON.stringify(diagnostics));
  checked++;
}
console.log(`background image: ${checked} render checks passed`);
