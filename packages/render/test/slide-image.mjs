// design.slideImage renders at the shared composition frame, beneath content,
// with crop (cover) or fit (contain) matching the native a:srcRect export.
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { composeSlide } from '@openpresentation/opf/composition';
import { renderSvg, svgToPng } from '../dist/index.js';

// This suite runs against the linked coordinated core. A core without
// geometry.slideImage is a pinning error, not a reason to skip.
assert.ok(composeSlide({ title: 'probe', design: { slideImage: { src: 'x', position: 'left' } } }).slideImage,
  'Linked core composition has no geometry.slideImage; pin a core with FF-26 slide-image composition.');
// 120x60 source: left half red, right half blue.
const raw = Buffer.alloc(120 * 60 * 3);
for (let y = 0; y < 60; y++) for (let x = 0; x < 120; x++) raw.set(x < 60 ? [220, 30, 30] : [30, 30, 220], (y * 120 + x) * 3);
const png = await sharp(raw, { raw: { width: 120, height: 60, channels: 3 } }).png().toBuffer();
const uri = `data:image/png;base64,${png.toString('base64')}`;
const imageTag = svg => svg.match(/<image\b[^>]*>/)?.[0];
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
let checked = 0;

for (const position of ['background', 'left', 'right', 'top', 'bottom']) {
  for (const fill of ['crop', 'fit']) {
    const deck = { design: { theme: 'classic' }, slides: [{ title: 'Slide image', text: 'Body copy.', design: { imageFill: fill, slideImage: { src: uri, position } } }] };
    const geometry = composeSlide(deck.slides[0], { width: 1280, height: 720, presentation: deck });
    const svg = renderSvg(deck, { trace: true });
    const image = imageTag(svg);
    assert.ok(image, `${position} ${fill}: image`);
    const box = geometry.slideImage.box;
    assert.deepEqual(['x', 'y', 'width', 'height'].map(name => Number(attr(image, name))), [box.x, box.y, box.width, box.height], `${position} ${fill}`);
    assert.equal(attr(image, 'preserveAspectRatio'), fill === 'crop' ? 'xMidYMid slice' : 'xMidYMid meet');
    assert.match(svg, new RegExp(`data-opf-slide-image="slides\\.0\\.design\\.slideImage" data-opf-slide-image-position="${position}"`));
    // Beneath every content item.
    assert.ok(svg.indexOf('<image') < svg.indexOf('data-opf-path="slides.0.title"'), `${position}: image first`);
    checked++;
  }
}

// Raster check: the left band shows the cropped image center; content keeps the other half.
{
  const deck = { design: { theme: 'classic' }, slides: [{ title: 'Left band', design: { slideImage: { src: uri, position: 'left' } } }] };
  const { data, info } = await sharp(await svgToPng(renderSvg(deck), { scale: 0.25, loadSystemFonts: false })).raw().toBuffer({ resolveWithObject: true });
  const pixel = (x, y) => [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3)];
  // Cover crop of a 2:1 image into a 640x720 band shows the middle 16% of the source.
  const left = pixel(Math.round(info.width * 0.24), info.height >> 1), right = pixel(Math.round(info.width * 0.26), info.height >> 1);
  assert.ok(left[0] > 150 && left[2] < 90, `red half at the band center-left: ${left}`);
  assert.ok(right[2] > 150 && right[0] < 90, `blue half at the band center-right: ${right}`);
  const content = pixel(Math.round(info.width * 0.9), Math.round(info.height * 0.9));
  assert.ok(!(content[0] > 150 && content[2] < 90) && !(content[2] > 150 && content[0] < 90), `content half is not image: ${content}`);
  checked++;
}

// Deck-level images apply only to layouts that reserve a slide image.
{
  const deck = { design: { theme: 'classic', slideImage: { src: uri, position: 'right' } },
    catalogs: { layouts: { records: [{ id: 'hero-right', name: 'Hero right', slideImage: true, placeholders: [{ type: 'title' }] }] } },
    slides: [{ title: 'Uses the deck image', layout: 'hero-right' }, { title: 'Default layout, no image' }] };
  assert.ok(imageTag(renderSvg(deck, { slideIndex: 0 })));
  assert.equal(imageTag(renderSvg(deck, { slideIndex: 1 })), undefined);
  checked++;
}

// A root image with the same source renders once, as the slide image.
{
  const deck = { design: { theme: 'classic' }, slides: [{ title: 'Once', image: { src: uri, alt: 'Split' }, design: { slideImage: { src: uri, position: 'left' } } }] };
  const svg = renderSvg(deck, { trace: true });
  assert.equal((svg.match(/<image\b/g) ?? []).length, 1);
  assert.match(imageTag(svg), /aria-label="Split"/);
  assert.match(imageTag(svg), /data-opf-path="slides\.0\.image"/);
  checked++;
}

// Unresolved sources use the ordinary placeholder and diagnostic.
{
  const diagnostics = [];
  renderSvg({ slides: [{ title: 'Missing', design: { slideImage: { src: 'asset:missing', position: 'left' } } }] }, { onDiagnostic: d => diagnostics.push(d) });
  assert.ok(diagnostics.some(d => d.code === 'unresolved-asset' && d.path === 'slides.0.design.slideImage'));
  checked++;
}
console.log(`slide image: ${checked} render checks passed`);
