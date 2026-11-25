// NT-04a: the picture compare on synthetic pictures made in memory (no picture is committed).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { comparePictures, gaussianBlur, iccDescription, loadPicture, pairSlides, pictureFacts, resizeLanczos, sharp, toGray } from './picture.mjs';

const W = 320;
const H = 180;

/** A white slide with dark blocks [x, y, w, h] and an optional block color. */
async function slide({ blocks = [], width = W, height = H, color = { r: 20, g: 20, b: 20 }, background = { r: 255, g: 255, b: 255 } } = {}) {
  const layers = await Promise.all(
    blocks.map(async ([left, top, w, h]) => ({ input: await sharp()({ create: { width: w, height: h, channels: 3, background: color } }).png().toBuffer(), left, top })),
  );
  return sharp()({ create: { width, height, channels: 3, background } })
    .composite(layers)
    .png()
    .toBuffer();
}

const small = { width: W };

test('identical pictures score 0 with no regions', async () => {
  const picture = await slide({ blocks: [[40, 40, 120, 30]] });
  const found = await comparePictures(picture, picture, small);
  assert.equal(found.score, 0);
  assert.deepEqual(found.regions, []);
  assert.deepEqual(found.size, [W, H]);
  assert.equal(found.aspectDiffers, false);
});

test('a 2 px shift does not count', async () => {
  const a = await slide({ blocks: [[40, 40, 120, 30], [200, 100, 60, 50]] });
  const b = await slide({ blocks: [[42, 42, 120, 30], [202, 98, 60, 50]] });
  const found = await comparePictures(a, b, small);
  assert.equal(found.score, 0);
  const far = await slide({ blocks: [[46, 40, 120, 30], [200, 100, 60, 50]] });
  assert.ok((await comparePictures(a, far, small)).score > 0, 'a 6 px shift does count');
});

test('a moved block is a region where it was and where it went', async () => {
  const a = await slide({ blocks: [[24, 24, 48, 32]] });
  const b = await slide({ blocks: [[232, 120, 48, 32]] });
  const found = await comparePictures(a, b, small);
  assert.ok(found.score > 0.04 && found.score < 0.08, `score ${found.score}`);
  assert.equal(found.regions.length, 2);
  const boxes = found.regions.map((region) => region.box).sort((p, q) => p[0] - q[0]);
  const near = (box, [x0, y0, x1, y1]) => Math.abs(box[0] - x0) < 0.04 && Math.abs(box[1] - y0) < 0.06 && Math.abs(box[2] - x1) < 0.04 && Math.abs(box[3] - y1) < 0.06;
  assert.ok(near(boxes[0], [24 / W, 24 / H, 72 / W, 56 / H]), `first region ${boxes[0]}`);
  assert.ok(near(boxes[1], [232 / W, 120 / H, 280 / W, 152 / H]), `second region ${boxes[1]}`);
  for (const region of found.regions) assert.ok(region.cells > 0 && region.share > 0 && region.share <= 1);
});

test('transparent pixels are composited onto white', async () => {
  // A fully transparent picture with black color values looks white; half-transparent black looks mid gray.
  const clear = await sharp()({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .png()
    .toBuffer();
  const white = await slide();
  assert.equal((await comparePictures(white, clear, small)).score, 0);
  const half = await loadPicture(await sharp()({ create: { width: 4, height: 4, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.5 } } }).png().toBuffer());
  assert.ok(Math.abs(half.rgb[0] - 127) <= 1, `half-transparent black on white is ${half.rgb[0]}`);
  assert.equal(half.alpha, true);
});

test('a Display P3 picture is converted to sRGB before it is compared', async () => {
  // A saturated sRGB green written with the P3 profile: sharp converts the pixels to P3 and embeds the profile.
  const green = { r: 0, g: 200, b: 0 };
  const srgb = await slide({ blocks: [[60, 40, 200, 100]], color: green });
  const p3 = await sharp()(srgb).withIccProfile('p3').png().toBuffer();
  const facts = await pictureFacts(p3);
  // libvips names its built-in P3 profile "sP3C" (Keynote's is "Display P3"); either is a P3 profile embedded in the PNG.
  assert.match(facts.colorProfile, /P3/u);
  const stored = await loadPicture(p3, { ignoreProfile: true });
  const converted = await loadPicture(p3);
  const center = (picture) => Array.from(picture.rgb.subarray((90 * W + 160) * 3, (90 * W + 160) * 3 + 3));
  assert.notDeepEqual(center(stored), [0, 200, 0], 'the stored numbers are P3, not sRGB');
  for (const [channel, value] of center(converted).entries()) assert.ok(Math.abs(value - [0, 200, 0][channel]) <= 2, `converted ${center(converted)}`);
  assert.equal((await comparePictures(srgb, converted, small)).score, 0);
  assert.ok((await comparePictures(srgb, stored, small)).score > 0.2, 'ignoring the profile would make the block differ');
});

test('a different aspect ratio is flagged; both are compared at the preview’s aspect', async () => {
  const wide = await slide();
  const square = await slide({ width: 240, height: 180 });
  const found = await comparePictures(wide, square, small);
  assert.equal(found.aspectDiffers, true);
  assert.deepEqual(found.previewSize, [W, H]);
  assert.deepEqual(found.appSize, [240, 180]);
  assert.deepEqual(found.size, [W, H]);
});

test('the Pillow ports keep a flat picture flat and match hand-checked values', () => {
  const flat = new Uint8Array(6 * 4 * 3).fill(200);
  assert.ok(resizeLanczos(flat, 6, 4, 3, 8, 5).every((value) => value === 200));
  assert.deepEqual(Array.from(toGray(Uint8Array.from([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255]), 4)), [76, 150, 29, 255]);
  const line = new Uint8Array(9);
  line[4] = 255;
  const blurred = gaussianBlur(line, 9, 1, 1.5);
  assert.equal(
    blurred.reduce((sum, value) => sum + value, 0) > 240,
    true,
  );
  assert.ok(blurred[4] < 255 && blurred[4] > blurred[3] && blurred[3] > blurred[2], `a peak spreads symmetrically: ${blurred}`);
  assert.equal(blurred[3], blurred[5]);
});

test('iccDescription reads nothing from a foreign buffer', () => {
  assert.equal(iccDescription(Buffer.alloc(16)), null);
});

test('pairSlides: preview k pairs with the k-th slide that is not hidden', () => {
  const slides = [
    { index: 1, hidden: false, picture: 'slides/slide-001.png' },
    { index: 2, hidden: true, picture: null },
    { index: 3, hidden: false, picture: 'slides/slide-003.png' },
    { index: 4, hidden: false, picture: null },
  ];
  assert.deepEqual(pairSlides(slides, 3), [
    { index: 1, preview: 1, picture: 'slides/slide-001.png' },
    { index: 2, preview: null, picture: null, note: 'hidden slide: the application exported no picture' },
    { index: 3, preview: 2, picture: 'slides/slide-003.png' },
    { index: 4, preview: 3, picture: null, note: 'no application picture' },
  ]);
  assert.equal(pairSlides(slides, 2)[3].note, 'no preview picture');
  // A preview that kept the hidden slide (as many pictures as slides) pairs by index.
  assert.deepEqual(
    pairSlides(slides, 4).map((pair) => pair.preview),
    [1, 2, 3, 4],
  );
});
