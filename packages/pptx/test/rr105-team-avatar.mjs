// RR-105 (coverage finding 12): a team with `portrait: "avatar"` exports each picture as core's small circle (an ellipse picture of the
// composed size) over the name, as the preview draws it, and imports back as the same document.
import assert from 'node:assert/strict';
import { strFromU8, unzipSync } from 'fflate';
import { TEAM_AVATAR, composeSlide } from '@openpresentation/opf/composition';
import { resolveSlideContext } from '@openpresentation/opf';
import { fromPptx, toPptx } from '../dist/index.js';

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const person = (name) => ({ type: 'group', blocks: [{ image: { src: PIXEL, alt: `Portrait of ${name}` }, portrait: 'avatar' }, { items: [{ text: name, description: 'Operations' }] }] });
const deck = { name: 'Avatar', language: 'en-US', slides: [{ title: 'Avatar', blocks: ['Alice Moreno', 'Ben Okafor', 'Chen Wei'].map(person) }] };
const context = resolveSlideContext(deck, 0);
const boxes = composeSlide(context.slide, context.options).items.filter((item) => item.field === 'image').map((item) => item.image.box);
const xml = strFromU8(unzipSync(await toPptx(deck))['ppt/slides/slide1.xml']);
const pics = [...xml.matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)].map(([pic]) => pic);
assert.equal(pics.length, 3);
const EMU = 914400 / 96;
for (const [index, pic] of pics.entries()) {
  assert.match(pic, /<a:prstGeom prst="ellipse"/, 'a circle');
  const [cx, cy] = pic.match(/<a:ext cx="(\d+)" cy="(\d+)"/).slice(1).map(Number);
  assert.ok(Math.abs(cx / EMU - boxes[index].width) < 0.5 && Math.abs(cy / EMU - boxes[index].height) < 0.5, 'the composed size');
  assert.ok(cx / EMU <= TEAM_AVATAR.most + 0.5, 'small');
}
const imported = await fromPptx(await toPptx(deck));
assert.deepEqual(imported.slides[0].blocks.map((block) => block.blocks[0].portrait), ['avatar', 'avatar', 'avatar']);
assert.equal(imported.slides[0].blocks[0].blocks[0].shape, undefined, 'the circle is the avatar\'s, not an authored shape');
console.log('rr105-team-avatar: ok');
