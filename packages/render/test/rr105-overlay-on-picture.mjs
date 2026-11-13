// RR-105 (coverage finding 10): an image block's overlay covers the drawn picture. A contained picture whose size core cannot read (a
// file path the host's imageResolver supplies) is measured by the preview from the drawable source, so a band covers its share of the
// picture and not the empty frame beside it, as the PPTX export draws it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toSvg } from '../dist/index.js';

const square = `data:image/png;base64,${readFileSync(new URL('../../pptx/test/fixtures/images/square.png', import.meta.url)).toString('base64')}`;
const deck = (overlay) => ({ slides: [{ title: 'Bands', blocks: [{ type: 'image', image: { src: './square.png', alt: 'Square' }, fit: 'contain', overlay }] }] });
const drawn = (overlay) => {
  const svg = toSvg(deck(overlay), 1, { trace: true, imageResolver: (src) => (src === './square.png' ? square : null) });
  const image = svg.match(/<image\b[^>]*>/)[0], path = svg.match(/<path\b[^>]*data-opf-image-overlay[^>]*>/)[0];
  const number = (name) => Number(image.match(new RegExp(` ${name}="([^"]+)"`))[1]);
  const frame = { x: number('x'), y: number('y'), width: number('width'), height: number('height') };
  const [x1, y1, x2, y2] = path.match(/d="M([\d.]+) ([\d.]+)H([\d.]+)V([\d.]+)H/).slice(1).map(Number);
  return { frame, band: { x: x1, y: y1, width: x2 - x1, height: y2 - y1 } };
};

// The square picture is contained in a wide frame: it is drawn as a square in the middle of the frame.
for (const edge of ['top', 'bottom', 'start', 'end']) {
  const { frame, band } = drawn({ color: 'dark1', opacity: 0.5, edge, size: 0.3 });
  const side = Math.min(frame.width, frame.height), left = frame.x + (frame.width - side) / 2;
  assert.ok(frame.width > frame.height + 10, 'the frame is wider than the picture');
  assert.ok(band.x >= left - 0.01 && band.x + band.width <= left + side + 0.01, `${edge}: the band stays on the picture (${JSON.stringify(band)})`);
  const across = edge === 'top' || edge === 'bottom';
  assert.ok(Math.abs((across ? band.height : band.width) - side * 0.3) < 0.02, `${edge}: 0.3 of the picture`);
}
const { frame, band } = drawn({ color: 'dark1', opacity: 0.5 });
assert.ok(Math.abs(band.width - Math.min(frame.width, frame.height)) < 0.01, 'a whole-frame overlay covers the picture');
console.log('rr105-overlay-on-picture: ok');
