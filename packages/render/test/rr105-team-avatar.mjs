// RR-105 (coverage finding 12): a team with `portrait: "avatar"` draws core's small circle over each name; the preview clips each picture
// to the circle core composed, as the PPTX export writes an ellipse picture of the same size.
import assert from 'node:assert/strict';
import { TEAM_AVATAR, composeSlide } from '@openpresentation/opf/composition';
import { resolveSlideContext } from '@openpresentation/opf';
import { toSvg } from '../dist/index.js';

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const person = (name) => ({ type: 'group', blocks: [{ image: { src: PIXEL, alt: `Portrait of ${name}` }, portrait: 'avatar' }, { items: [{ text: name, description: 'Operations' }] }] });
const deck = { slides: [{ title: 'Avatar', blocks: ['Alice Moreno', 'Ben Okafor', 'Chen Wei'].map(person) }] };
const context = resolveSlideContext(deck, 0);
const pictures = composeSlide(context.slide, context.options).items.filter((item) => item.field === 'image');
const svg = toSvg(deck, 1);
for (const item of pictures) {
  const box = item.image.box;
  assert.ok(box.width <= TEAM_AVATAR.most + 0.01, `a small picture: ${box.width}`);
  assert.equal(item.image.shape.preset, 'ellipse');
  assert.ok(svg.includes(`d="${item.image.shape.path}"`), 'the preview clips the picture to core\'s circle');
}
console.log('rr105-team-avatar: ok');
