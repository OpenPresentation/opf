// C15: pictures in one row of a gallery, some captioned and some not, share one height: an uncaptioned picture keeps the room of the
// tallest caption band beside it, so the top and bottom edges of the row line up.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';
import { layouts } from './support/template-samples.mjs';

const svg = (fill) => `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1250" viewBox="0 0 1000 1250"><rect width="1000" height="1250" fill="${fill}"/></svg>`).toString('base64')}`;
const picture = (fill, caption) => ({ image: { src: svg(fill), alt: `A ${fill} field` }, ...(caption ? { caption } : {}) });
const frames = (result) => result.items.filter((item) => item.field === 'image').map((item) => item.image?.box ?? item.box);

test('C15: an uncaptioned picture beside captioned ones keeps their height', () => {
  for (const blocks of [[picture('#3f8a55', 'Cool: calm blues'), picture('#b86b4f'), picture('#6f6597', 'Purple')], [picture('#3f8a55'), picture('#b86b4f', 'Warm: earth tones')]]) {
    const result = composeSlide({ title: 'Directions', blocks }, { layout: layouts.gallery });
    const boxes = frames(result);
    assert.equal(new Set(boxes.map((box) => Math.round(box.y))).size, 1, 'one top edge');
    assert.equal(new Set(boxes.map((box) => Math.round(box.y + box.height))).size, 1, 'one bottom edge');
  }
});
