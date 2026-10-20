// RR-97: an image the renderer cannot draw is an `unresolved-asset` warning that names the source and the document path, in every
// place a deck spells an image (background, picture block, organization logo, watermark, picture bullet, asset reference). The
// picture itself is skipped (the unavailable-image placeholder), the render succeeds, and strictAssets still throws.
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { OPFRenderError, toPng, toSvg } from '../dist/index.js';

const png = async () => `data:image/png;base64,${(await sharp({ create: { width: 160, height: 90, channels: 3, background: { r: 200, g: 30, b: 30 } } }).png().toBuffer()).toString('base64')}`;
const good = await png();
const collect = (deck, options = {}, slide = 1) => {
  const diagnostics = [];
  const svg = toSvg(deck, slide, { ...options, onDiagnostic: diagnostic => diagnostics.push(diagnostic) });
  return { svg, unresolved: diagnostics.filter(diagnostic => diagnostic.code === 'unresolved-asset') };
};
const placeholders = svg => (svg.match(/data-opf-asset-status="unresolved"/g) ?? []).length;
let checked = 0;

// A missing background image: one warning at the background's path naming the src; the slide still draws.
{
  const deck = { name: 'Missing background', slides: [{ title: 'Hello', design: { background: { type: 'image', src: './assets/missing.jpg' } } }] };
  const { svg, unresolved } = collect(deck);
  assert.equal(unresolved.length, 1);
  const [found] = unresolved;
  assert.equal(found.path, 'slides.0.design.background');
  assert.equal(found.source, './assets/missing.jpg');
  assert.equal(found.reason, 'unsupported-source');
  assert.match(found.message, /^Image ".\/assets\/missing\.jpg" was not resolved /);
  assert.match(found.message, /Fix the path, embed the image as a data URI, or resolve it in the host/);
  assert.equal(placeholders(svg), 1);
  assert.ok(svg.includes('Hello'), 'the slide content still draws');
  checked += 1;
}

// A picture block with a bad relative src.
{
  const deck = { name: 'Missing picture', slides: [{ title: 'Pic', image: { src: 'nope/x.png', alt: 'A diagram' } }] };
  const { svg, unresolved } = collect(deck);
  assert.equal(unresolved.length, 1);
  assert.equal(unresolved[0].path, 'slides.0.image');
  assert.equal(unresolved[0].source, 'nope/x.png');
  assert.equal(unresolved[0].description, 'A diagram');
  assert.match(unresolved[0].message, /^Image "nope\/x\.png" was not resolved /);
  assert.equal(placeholders(svg), 1);
  // A host that resolves the file removes the warning and draws the picture.
  const resolved = collect(deck, { imageResolver: source => (source === 'nope/x.png' ? good : undefined) });
  assert.equal(resolved.unresolved.length, 0);
  assert.equal(placeholders(resolved.svg), 0);
  assert.ok(resolved.svg.includes(good));
  checked += 1;
}

// A resolvable image (an embedded data URI) has no finding and draws no placeholder.
{
  const deck = { name: 'Embedded', slides: [{ title: 'Pic', image: { src: good, alt: 'Red' } }] };
  const { svg, unresolved } = collect(deck);
  assert.deepEqual(unresolved, []);
  assert.equal(placeholders(svg), 0);
  assert.ok(svg.includes(good));
  checked += 1;
}

// The logo, the picture watermark and an undeclared asset reference are reported the same way; a long data URI is shortened.
{
  const deck = {
    name: 'Furniture', organization: { id: 'x', name: 'X', logo: { src: 'assets/logo.png' } }, design: { watermark: { src: 'assets/wm.png' } },
    slides: [{ title: 'One', design: { background: { type: 'image', src: 'asset:ghost' } } }, { title: 'Two', image: { src: `data:image/bmp;base64,${'A'.repeat(500)}` } }]
  };
  const first = collect(deck);
  const byPath = Object.fromEntries(first.unresolved.map(found => [found.path, found]));
  assert.equal(byPath['organization.logo'].source, 'assets/logo.png');
  assert.equal(byPath['design.watermark'].source, 'assets/wm.png');
  assert.equal(byPath['slides.0.design.background'].reason, 'missing-reference');
  assert.match(byPath['slides.0.design.background'].message, /^Image asset "ghost" is not declared in the deck's assets/);
  const second = collect(deck, {}, 2).unresolved.find(found => found.path === 'slides.1.image');
  assert.equal(second.reason, 'unsupported-source');
  assert.ok(second.source.length > 400 && second.message.length < 400 && second.message.includes('data:image/bmp;base64,...'), 'a long data URI is shortened in the message only');
  checked += 1;
}

// Rendering still succeeds as PNG, and strictAssets still rejects.
{
  const deck = { name: 'Missing', slides: [{ title: 'Pic', image: { src: 'missing.png' } }] };
  const seen = [];
  const bytes = await toPng(deck, 1, { onDiagnostic: diagnostic => seen.push(diagnostic.code) });
  assert.ok(bytes.length > 100 && seen.includes('unresolved-asset'));
  assert.throws(() => toSvg(deck, 1, { strictAssets: true }), error => error instanceof OPFRenderError && error.code === 'unresolved-asset' && error.path === 'slides.0.image');
  checked += 1;
}

console.log(`Unresolved asset warning passed ${checked} checks.`);
