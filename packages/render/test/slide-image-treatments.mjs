// design.slideImage treatments render from core's normalized geometry: the
// preset mask outline, Rec. 601 recolor matrices, pixel-only opacity, the
// centered line and the overlay scrim, in the native picture's paint order.
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { composeSlide } from '@openpresentation/opf/composition';
import { renderSvg, svgToPng } from '../dist/index.js';

// This suite runs against the linked coordinated core; a core without treatment
// geometry is a pinning error, not a reason to skip.
assert.ok(composeSlide({ title: 'probe', design: { slideImage: { src: 'x', position: 'left' } } }).slideImage?.shape,
  'Linked core composition has no slide image treatment geometry; pin a core with the FF-26 treatment vocabulary.');
// 64x64 source: a uniform saturated orange so recolor results are exact.
const orange = [230, 120, 20];
const raw = Buffer.alloc(64 * 64 * 3);
for (let i = 0; i < 64 * 64; i++) raw.set(orange, i * 3);
const png = await sharp(raw, { raw: { width: 64, height: 64, channels: 3 } }).png().toBuffer();
const uri = `data:image/png;base64,${png.toString('base64')}`;
const deckFor = (treatment, design = {}) => ({ design: { theme: 'classic', colorScheme: { id: 'custom', name: 'Custom', dark1: '#101820', light1: '#F4F1EA', accent1: '#1F5AA6', accent5: '#C0C8D0' }, ...design },
  slides: [{ title: 'Treatment', design: { slideImage: { src: uri, ...treatment } } }] });
const attr = (tag, name) => tag?.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
const element = (svg, name, filter = '') => [...svg.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'g'))].map(m => m[0]).find(tag => tag.includes(filter));
let checked = 0;

// Masks use exactly the core outline in a clipPath around the image.
for (const shape of ['rounded', 'circle', 'hexagon']) {
  const deck = deckFor({ position: 'right', inset: true, shape });
  const geometry = composeSlide(deck.slides[0], { width: 1280, height: 720, presentation: deck });
  const svg = renderSvg(deck);
  const clip = svg.match(/<clipPath id="opf-s1-slide-image-clip"><path d="([^"]+)"\/><\/clipPath>/);
  assert.equal(clip?.[1], geometry.slideImage.shape.path, shape);
  assert.match(svg, /<g clip-path="url\(#opf-s1-slide-image-clip\)"><image /);
  checked++;
}
// Rectangle frames need no mask.
assert.doesNotMatch(renderSvg(deckFor({ position: 'left' })), /clipPath/);

// Border: centered stroke on the same outline, width scaled with the canvas; alpha as stroke-opacity.
{
  const deck = deckFor({ position: 'left', inset: true, shape: 'rounded', border: { color: '#10182080', width: 12 } }, { dimensions: { widthInches: 20, heightInches: 11.25 } });
  const geometry = composeSlide(deck.slides[0], { width: 1920, height: 1080, presentation: deck });
  const stroke = element(renderSvg(deck), 'path', 'stroke=');
  assert.equal(attr(stroke, 'd'), geometry.slideImage.shape.path);
  assert.equal(attr(stroke, 'stroke'), '#101820');
  assert.equal(Number(attr(stroke, 'stroke-opacity')), Math.round(0x80 / 255 * 1e6) / 1e6);
  assert.equal(Number(attr(stroke, 'stroke-width')), 18);
  assert.equal(attr(stroke, 'fill'), 'none');
  checked++;
}

// Recolor matrices and pixel-only opacity, checked on raster output.
async function centerPixel(deck) {
  const { data, info } = await sharp(await svgToPng(renderSvg(deck), { scale: 0.25, loadSystemFonts: false })).raw().toBuffer({ resolveWithObject: true });
  const at = ((info.height >> 1) * info.width + (info.width >> 1)) * info.channels;
  return [...data.subarray(at, at + 3)];
}
const luma = (0.299 * orange[0] + 0.587 * orange[1] + 0.114 * orange[2]) / 255;
{
  const [r, g, b] = await centerPixel(deckFor({ position: 'background', recolor: 'grayscale' }));
  for (const channel of [r, g, b]) assert.ok(Math.abs(channel - luma * 255) <= 1, `grayscale ${channel} vs ${luma * 255}`);
  const duo = await centerPixel(deckFor({ position: 'background', recolor: { dark: 'accent1', light: 'light1' } }));
  const dark = [0x1f, 0x5a, 0xa6], light = [0xf4, 0xf1, 0xea];
  duo.forEach((channel, i) => assert.ok(Math.abs(channel - (dark[i] + (light[i] - dark[i]) * luma)) <= 1, `duotone ${i}: ${channel}`));
  // Opacity blends the pixels over the slide background; the matrix keeps 1e-6 precision.
  const faint = await centerPixel(deckFor({ position: 'background', opacity: 0.25 }, { background: '#FFFFFF' }));
  faint.forEach((channel, i) => assert.ok(Math.abs(channel - (255 + (orange[i] - 255) * 0.25)) <= 1, `opacity ${i}: ${channel}`));
  const svg = renderSvg(deckFor({ position: 'background', recolor: 'grayscale', opacity: 0.12345 }));
  assert.match(svg, /<g filter="url\(#opf-s1-slide-image-recolor\)" opacity="0\.12345"><image /);
  assert.match(svg, /<filter color-interpolation-filters="sRGB" id="opf-s1-slide-image-recolor"><feColorMatrix type="matrix" values="0\.299 0\.587 0\.114 0 0 0\.299 0\.587 0\.114 0 0 0\.299 0\.587 0\.114 0 0 0 0 0 1 0"\/>/);
  checked += 4;
}

// Overlay: a scrim path over the image and border, color alpha times overlay opacity.
{
  const deck = deckFor({ position: 'background', inset: true, border: { color: 'dark1', width: 2 }, overlay: { color: '#00000080', opacity: 0.5, edge: 'bottom', size: 0.25 } });
  const geometry = composeSlide(deck.slides[0], { width: 1280, height: 720, presentation: deck });
  const svg = renderSvg(deck, { trace: true });
  const overlay = element(svg, 'path', 'data-opf-slide-image-overlay');
  assert.equal(attr(overlay, 'd'), geometry.slideImage.overlay.shape.path);
  assert.equal(Number(attr(overlay, 'fill-opacity')), Math.round(0x80 / 255 * 0.5 * 1e6) / 1e6);
  assert.ok(svg.indexOf('<image') < svg.indexOf('stroke=') && svg.indexOf('stroke=') < svg.indexOf('data-opf-slide-image-overlay'), 'paint order: image, line, overlay');
  const [r, g, b] = await centerPixel(deckFor({ position: 'background', overlay: { color: '#000000', opacity: 0.5 } }));
  [r, g, b].forEach((channel, i) => assert.ok(Math.abs(channel - orange[i] * 0.5) <= 1, `scrim ${i}: ${channel}`));
  checked += 2;
}

// Alt text override and unresolved sources without treatments.
{
  assert.match(renderSvg(deckFor({ position: 'left', alt: 'Harbor at dusk' })), /aria-label="Harbor at dusk"/);
  const svg = renderSvg({ slides: [{ title: 'Missing', design: { slideImage: { src: 'asset:missing', position: 'left', shape: 'circle', overlay: { color: '#000000', opacity: 0.5 } } } }] });
  assert.doesNotMatch(svg, /clipPath|fill-opacity/);
  checked += 2;
}
console.log(`slide image treatments: ${checked} render checks passed`);
