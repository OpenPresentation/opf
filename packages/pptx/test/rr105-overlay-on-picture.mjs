// RR-105 (coverage finding 10): an image block's overlay covers the drawn picture. A contained picture whose size core cannot read (a
// file path a host imageResolver supplies) is measured from the embedded source, so the band is the same native rectangle the preview
// draws, on the picture and not on the empty frame beside it; the block imports back unchanged.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';
import { fromPptx, toPptx } from '../dist/index.js';

const square = `data:image/png;base64,${readFileSync(new URL('./fixtures/images/square.png', import.meta.url)).toString('base64')}`;
const imageResolver = (src) => (src === './square.png' ? square : null);
const EMU = 914400 / 96;
const deck = (overlay) => ({ name: 'Bands', language: 'en-US', slides: [{ title: 'Bands', blocks: [{ type: 'image', image: { src: './square.png', alt: 'Square' }, fit: 'contain', overlay }] }] });
const xfrm = (xml, name) => {
  const shape = xml.match(new RegExp(`<p:(?:sp|pic)>(?:(?!</p:(?:sp|pic)>).)*?name="${name}"(?:(?!</p:(?:sp|pic)>).)*?</p:(?:sp|pic)>`, 's'))[0];
  const [x, y] = shape.match(/<a:off x="(\d+)" y="(\d+)"/).slice(1).map(Number), [width, height] = shape.match(/<a:ext cx="(\d+)" cy="(\d+)"/).slice(1).map(Number);
  return { x: x / EMU, y: y / EMU, width: width / EMU, height: height / EMU };
};

for (const edge of ['top', 'bottom', 'start', 'end']) {
  const overlay = { color: 'dark1', opacity: 0.5, edge, size: 0.3 };
  const xml = strFromU8(unzipSync(await toPptx(deck(overlay), { imageResolver }))['ppt/slides/slide1.xml']);
  const name = xml.match(/name="(OPF image \d+)"/)[1];
  const frame = xfrm(xml, name), band = xfrm(xml, `${name} overlay`);
  const side = Math.min(frame.width, frame.height), left = frame.x + (frame.width - side) / 2;
  assert.ok(frame.width > frame.height + 10, 'the frame is wider than the picture');
  assert.ok(band.x >= left - 0.1 && band.x + band.width <= left + side + 0.1, `${edge}: the band stays on the picture (${JSON.stringify({ band, frame })})`);
  const across = edge === 'top' || edge === 'bottom';
  assert.ok(Math.abs((across ? band.height : band.width) - side * 0.3) < 0.2, `${edge}: 0.3 of the picture`);
  const imported = await fromPptx(await toPptx(deck(overlay), { imageResolver }));
  assert.deepEqual(imported.slides[0].blocks[0].overlay, overlay, `${edge}: the overlay imports back as authored`);
}
console.log('rr105-overlay-on-picture: ok');
