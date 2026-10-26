import assert from 'node:assert/strict';
import { test } from 'node:test';
import { intrinsicImageAspect, intrinsicImageSize } from '../dist/composition.js';

// WI-3: a contained picture's frame is its own proportions, so core reads them as the picture is shown: a JPEG whose EXIF
// orientation turns it a quarter (5 to 8) is shown with its stored width and height swapped.
const u16 = (value, little) => little ? [value & 255, value >> 8] : [value >> 8, value & 255];
const u32 = (value, little) => little ? [value & 255, (value >> 8) & 255, (value >> 16) & 255, value >>> 24] : [value >>> 24, (value >> 16) & 255, (value >> 8) & 255, value & 255];
const jpeg = (width, height, orientation, little = false) => {
  const tiff = [...(little ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42, little), ...u32(8, little), ...u16(1, little), ...u16(0x0112, little), ...u16(3, little), ...u32(1, little), ...u16(orientation, little), 0, 0, ...u32(0, little)];
  const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const app1 = orientation ? [0xff, 0xe1, ...u16(exif.length + 2, false), ...exif] : [];
  const frame = [0xff, 0xc0, 0, 17, 8, ...u16(height, false), ...u16(width, false), 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  return `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, ...app1, ...frame, 0xff, 0xd9]).toString('base64')}`;
};

test('a JPEG with no orientation, or an upright one, keeps its stored proportions', () => {
  assert.equal(intrinsicImageAspect(jpeg(120, 60, 0)), 2);
  for (const orientation of [1, 2, 3, 4]) assert.equal(intrinsicImageAspect(jpeg(120, 60, orientation)), 2, `orientation ${orientation}`);
});

test('EXIF orientations 5 to 8 swap the proportions, in either byte order', () => {
  for (const orientation of [5, 6, 7, 8]) for (const little of [false, true]) {
    assert.equal(intrinsicImageAspect(jpeg(120, 60, orientation, little)), 0.5, `orientation ${orientation} ${little ? 'II' : 'MM'}`);
    assert.deepEqual({ width: intrinsicImageSize(jpeg(120, 60, orientation, little)).width, height: intrinsicImageSize(jpeg(120, 60, orientation, little)).height }, { width: 60, height: 120 });
  }
});

test('an unreadable orientation is the stored proportions', () => {
  assert.equal(intrinsicImageAspect(jpeg(120, 60, 9)), 2);
});
