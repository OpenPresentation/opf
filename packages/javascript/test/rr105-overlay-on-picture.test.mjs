import assert from 'node:assert/strict';
import test from 'node:test';
import { composeSlide, pictureOverlay } from '../dist/composition.js';

// RR-105 (coverage finding 10): an image block's overlay belongs to the drawn picture. Under `fit: "contain"` a picture smaller than its
// frame is covered where it is drawn (a band takes its share of the picture, not of the empty frame), whether core read the picture's
// aspect ratio itself or a host that read it passes it to pictureOverlay; other fits and masked frames keep the frame.

// A PNG header of `width` x `height` (core reads the size from the IHDR chunk).
const png = (width, height) => {
  const bytes = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0);
  bytes.writeUInt32BE(13, 8);
  bytes.write('IHDR', 12, 'ascii');
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  bytes.set([8, 6, 0, 0, 0], 24);
  return `data:image/png;base64,${bytes.toString('base64')}`;
};
const imageOf = (block) => composeSlide({ title: 'Bands', blocks: [{ type: 'image', ...block }] }, { width: 1280, height: 720 }).items.find((item) => item.field === 'image').image;
const inside = (box, area) => box.x >= area.x - 0.01 && box.y >= area.y - 0.01 && box.x + box.width <= area.x + area.width + 0.01 && box.y + box.height <= area.y + area.height + 0.01;

test('a band on a contained picture covers its share of the picture, along its edge', () => {
  for (const edge of ['top', 'bottom', 'start', 'end']) {
    // A square frame (aspectRatio 1) letterboxes a 16:9 picture.
    const image = imageOf({ image: png(160, 90), fit: 'contain', aspectRatio: 1, overlay: { color: 'dark1', opacity: 0.5, edge, size: 0.3 } });
    const picture = image.picture.image;
    assert.ok(picture.height < image.box.height - 1, 'the picture is letterboxed');
    assert.ok(inside(image.overlay.box, picture), `${edge}: ${JSON.stringify(image.overlay.box)} inside ${JSON.stringify(picture)}`);
    const across = edge === 'top' || edge === 'bottom';
    assert.ok(Math.abs((across ? image.overlay.box.width : image.overlay.box.height) - (across ? picture.width : picture.height)) < 0.01, 'the band spans the picture');
    assert.ok(Math.abs((across ? image.overlay.box.height / picture.height : image.overlay.box.width / picture.width) - 0.3) < 0.01, 'and covers 0.3 of it');
    assert.equal(image.overlay.shape.preset, 'rect');
  }
  const whole = imageOf({ image: png(160, 90), fit: 'contain', aspectRatio: 1, overlay: { color: 'dark1', opacity: 0.5 } });
  assert.deepEqual(whole.overlay.box, { x: Math.round(whole.picture.image.x * 1e6) / 1e6, y: Math.round(whole.picture.image.y * 1e6) / 1e6, width: Math.round(whole.picture.image.width * 1e6) / 1e6, height: Math.round(whole.picture.image.height * 1e6) / 1e6 });
});

test('cover, a masked frame and a picture that fills its frame keep the overlay on the frame', () => {
  const cover = imageOf({ image: png(160, 90), fit: 'cover', aspectRatio: 1, overlay: { color: 'dark1', opacity: 0.5, edge: 'bottom' } });
  assert.equal(cover.overlay.box.width, cover.box.width);
  const ellipse = imageOf({ image: png(160, 90), fit: 'contain', shape: 'ellipse', overlay: { color: 'dark1', opacity: 0.5 } });
  assert.equal(ellipse.overlay.shape.preset, 'ellipse');
  assert.deepEqual(ellipse.overlay.box, ellipse.box);
});

test('pictureOverlay moves the overlay of a picture core could not measure onto the picture the host draws', () => {
  const image = imageOf({ image: 'https://example.com/harbor.png', fit: 'contain', overlay: { color: 'dark1', opacity: 0.5, edge: 'top', size: 0.3 } });
  assert.equal(image.picture, undefined, 'core reads no size from a URL');
  assert.equal(image.overlay.box.width, image.box.width, 'core places the band on the frame');
  const aspect = image.box.width / image.box.height / 2; // a picture half as wide as the frame
  const moved = pictureOverlay(image, aspect);
  assert.ok(Math.abs(moved.box.width - image.box.width / 2) < 0.01, JSON.stringify(moved.box));
  assert.ok(Math.abs(moved.box.x - (image.box.x + image.box.width / 4)) < 0.01);
  assert.ok(Math.abs(moved.box.height - image.overlay.box.height) < 0.01, 'a top band keeps its share of the height');
  assert.equal(pictureOverlay(image, undefined), image.overlay, 'without an aspect nothing moves');
});
