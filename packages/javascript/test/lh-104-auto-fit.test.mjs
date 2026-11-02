// LH-104: `fit: "auto"` (and `design.imageFit: "auto"`) covers when the crop keeps at least 85% of the picture along the cropped
// dimension and contains otherwise; an SVG and a picture of unknown size are contained. Core decides it (fitImage, composeImage), so
// the preview and the PPTX export draw the same fit, and the composed image says which fit `auto` took. LH-80 tracks use the same rule.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AUTO_FIT_MIN_KEPT, PORTRAIT_FOCUS_Y, autoImageFit, composeSlide, coverKept, fitImage } from '../dist/composition.js';
import { layouts } from './support/template-samples.mjs';

// A PNG signature and IHDR are all core reads for the size; not a decodable image.
const png = (width, height) => {
  const bytes = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0);
  bytes.writeUInt32BE(13, 8);
  bytes.write('IHDR', 12, 'ascii');
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return `data:image/png;base64,${bytes.toString('base64')}`;
};
const u16 = (value) => [value >> 8, value & 255];
// A JPEG of `width` x `height` stored pixels whose EXIF orientation 6 turns it a quarter.
const turnedJpeg = (width, height) => {
  const tiff = [0x4d, 0x4d, ...u16(42), 0, 0, 0, 8, ...u16(1), ...u16(0x0112), ...u16(3), 0, 0, 0, 1, ...u16(6), 0, 0, 0, 0, 0, 0];
  const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const frame = [0xff, 0xc0, 0, 17, 8, ...u16(height), ...u16(width), 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  return `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe1, ...u16(exif.length + 2), ...exif, ...frame, 0xff, 0xd9]).toString('base64')}`;
};
const svg = (width, height) => `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}"/></svg>`).toString('base64')}`;
const picture = (result) => result.items.find((item) => item.field === 'image').image;
const paragraph = 'City Sanitation Bureau should focus the next cycle on increasing household recycling participation with clearer guidance while making the operating tradeoffs clear to sanitation stakeholders.';

test('LH-104: auto covers when the crop keeps at least 85% of the picture, else contains', () => {
  assert.equal(AUTO_FIT_MIN_KEPT, 0.85);
  const frame = { x: 0, y: 0, width: 200, height: 100 };
  assert.equal(coverKept(frame, 16 / 9), (16 / 9) / 2);
  assert.equal(coverKept(frame, undefined), 1);
  assert.equal(autoImageFit(frame, 16 / 9), 'cover', '16:9 in 2:1 keeps 89%');
  assert.equal(autoImageFit(frame, 1.7), 'cover', '1.7 in 2:1 keeps exactly 85%');
  assert.equal(autoImageFit(frame, 1.68), 'contain', '1.68 in 2:1 keeps 84%');
  assert.equal(autoImageFit(frame, 1.6), 'contain', '16:10 in 2:1 keeps 80%');
  assert.equal(autoImageFit({ width: 100, height: 100 }, 1.5), 'contain', '3:2 in a square keeps 67%');
  assert.equal(autoImageFit({ width: 100, height: 100 }, 1 / 1.15), 'cover', 'a portrait as tall as 115% of its width keeps 87%');
  assert.equal(autoImageFit(frame, 2, { svg: true }), 'contain', 'an SVG is never cropped');
  assert.equal(autoImageFit(frame, undefined), 'contain', 'a picture of unknown size is shown whole');
  // fitImage resolves auto itself, so a host engine that reads the aspect draws the same fit.
  assert.deepEqual(fitImage(frame, 'auto', 16 / 9), fitImage(frame, 'cover', 16 / 9));
  assert.deepEqual(fitImage(frame, 'auto', 4 / 3), fitImage(frame, 'contain', 4 / 3));
});

test('LH-104: a composed image reports the fit auto took, and the frame follows it', () => {
  // Under a title the body is about 2.26:1: a 2.1:1 picture is covered (it fills the frame); a square one is contained in a frame of its own shape.
  const wide = picture(composeSlide({ title: 'Field context', design: { imageFit: 'auto' }, blocks: [{ image: png(2100, 1000) }] }));
  assert.equal(wide.fit, 'cover');
  assert.equal(wide.autoFit, true);
  assert.deepEqual(wide.box, wide.region, 'a covered picture fills its frame');
  assert.ok(wide.picture.crop.top > 0 && wide.picture.crop.top < 0.075, 'a light crop off the top and bottom');
  const square = picture(composeSlide({ title: 'Field context', blocks: [{ image: png(1000, 1000), fit: 'auto' }] }));
  assert.equal(square.fit, 'contain');
  assert.equal(square.autoFit, true);
  assert.ok(Math.abs(square.box.width - square.box.height) < 0.01, 'the contained frame takes the picture\'s shape');
  // An explicit fit is reported as it is, with no autoFit.
  assert.equal(picture(composeSlide({ title: 'T', blocks: [{ image: png(1000, 1000), fit: 'cover' }] })).autoFit, undefined);
  // SVG and unknown size: contained.
  assert.equal(picture(composeSlide({ title: 'T', blocks: [{ image: svg(1600, 900), fit: 'auto' }] })).fit, 'contain');
  assert.equal(picture(composeSlide({ title: 'T', blocks: [{ image: { src: 'https://example.com/photo.jpg', alt: 'Photo' }, fit: 'auto' }] })).fit, 'contain');
});

test('LH-104: auto reads the EXIF-corrected proportions', () => {
  // Stored 1000 x 1150, turned a quarter: shown 1150 x 1000, so a frame of that shape covers it; read unturned it would be contained.
  const frame = { x: 0, y: 0, width: 1150, height: 1000 };
  const result = picture(composeSlide({ title: 'T', blocks: [{ image: turnedJpeg(1000, 1150), fit: 'auto', aspectRatio: 1.15 }] }));
  assert.equal(result.fit, 'cover');
  assert.equal(autoImageFit(frame, 1000 / 1150), 'contain');
});

test('LH-104: a covered auto picture keeps the focus rules: the authored focus, else the LH-84 portrait default', () => {
  // A portrait cropped into a slightly wider frame keeps its heads.
  const portrait = picture(composeSlide({ title: 'T', blocks: [{ image: png(900, 1000), fit: 'auto', aspectRatio: 1 }] }));
  assert.equal(portrait.fit, 'cover');
  assert.deepEqual(portrait.focus, { x: 0.5, y: PORTRAIT_FOCUS_Y });
  const focused = picture(composeSlide({ title: 'T', blocks: [{ image: png(900, 1000), fit: 'auto', aspectRatio: 1, focus: { x: 0.5, y: 0.8 } }] }));
  assert.deepEqual(focused.focus, { x: 0.5, y: 0.8 });
  assert.ok(focused.picture.crop.top > portrait.picture.crop.top, 'the crop follows the focus');
});

test('LH-104: the gallery image layout shows a near-fitting photo full frame and any other picture whole', () => {
  assert.equal(layouts.image.design.imageFit, 'auto');
  const slide = (image) => ({ layout: 'image', title: 'Field context', image });
  // Without a title the region is the 16:9 slide: a 16:9 photo fills it. Under a title the region is about 2.24:1, so a 16:9 photo
  // (it would keep 79%) is shown whole and a wider one fills it.
  assert.equal(picture(composeSlide({ layout: 'image', image: png(1920, 1080) }, { layout: layouts.image })).fit, 'cover');
  assert.equal(picture(composeSlide(slide(png(1920, 1080)), { layout: layouts.image })).fit, 'contain');
  const photo = picture(composeSlide(slide(png(2100, 900)), { layout: layouts.image }));
  assert.equal(photo.fit, 'cover');
  const square = picture(composeSlide(slide(png(1000, 1000)), { layout: layouts.image }));
  assert.equal(square.fit, 'contain');
  const diagram = picture(composeSlide(slide(svg(1920, 1080)), { layout: layouts.image }));
  assert.equal(diagram.fit, 'contain');
});

test('LH-104: an LH-80 track crops no more than auto would, unless the slide reads better with it', () => {
  // A 9:10 picture fills a half-slide track (it keeps 99%).
  const near = composeSlide({ title: 'Signal trend', blocks: [{ image: png(900, 1000) }, { text: paragraph }] });
  assert.equal(near.track?.kind, 'picture');
  assert.ok(coverKept(picture(near).box, 0.9) >= AUTO_FIT_MIN_KEPT);
  // A 16:10 photo would lose 44% in the widest track: beside a paragraph and a quote the slide reads as well without it, so it stays in the flow.
  const quote = { quote: { text: 'Teams already know where the friction is.', attribution: 'Sponsor' } };
  const wide = composeSlide({ title: 'Signal trend', blocks: [{ image: png(1600, 1000) }, { text: paragraph }, quote] });
  assert.equal(wide.track, undefined);
  assert.equal(picture(wide).fit, 'contain');
  // Beside one paragraph the track lets the paragraph take a larger size than the flow does, so it is kept (the wave 3 size guard).
  assert.equal(composeSlide({ title: 'Signal trend', blocks: [{ image: png(1600, 1000) }, { text: paragraph }] }).track?.kind, 'picture');
  // With auto, an SVG or a picture of unknown size takes no track (it is shown whole).
  assert.equal(composeSlide({ title: 'T', design: { imageFit: 'auto' }, blocks: [{ image: svg(900, 1000) }, { text: paragraph }] }).track, undefined);
  assert.equal(composeSlide({ title: 'T', design: { imageFit: 'auto' }, blocks: [{ image: png(900, 1000) }, { text: paragraph }] }).track?.kind, 'picture');
});
