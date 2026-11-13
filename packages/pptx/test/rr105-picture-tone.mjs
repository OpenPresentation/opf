// RR-105 (coverage findings 17 and 18): a picture background that names no tone takes the one its recolor and overlay imply. The export
// writes that slide's dark color map (bg1 on dk1, tx1 on lt1), as the preview draws light text, and imports back as the same document:
// the map is the picture's own, so no `variant` appears; an explicit tone still wins.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {fromPptx, toPptx} from '../dist/index.js';
import {clrMapOf} from './helpers/scheme-colors.mjs';

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const deck = (background) => ({name: 'Tone', language: 'en-US', design: {background: 'light1'}, slides: [{title: 'Harbor title', text: 'Body over the band.', design: {background: {type: 'image', src: PIXEL, alt: 'Harbor', ...background}}}]});
const slideMap = async (document) => {
  const xml = strFromU8(unzipSync(await toPptx(document))['ppt/slides/slide1.xml']);
  return /<a:overrideClrMapping/.test(xml) ? clrMapOf(xml.match(/<p:clrMapOvr>[\s\S]*?<\/p:clrMapOvr>/)[0]) : undefined;
};

const duotone = {recolor: {dark: 'dark2', light: 'accent1'}, overlay: {color: 'dark1', opacity: 0.6, edge: 'bottom', size: 0.5}};
for (const background of [duotone, {overlay: {color: 'dark1', opacity: 0.4}}]) {
  const map = await slideMap(deck(background));
  assert.deepEqual([map?.bg1, map?.tx1], ['dk1', 'lt1'], `${JSON.stringify(background)}: the slide takes the dark map`);
  const imported = await fromPptx(await toPptx(deck(background)));
  assert.equal(imported.slides[0].design?.variant, undefined, 'the inferred map imports as no variant');
  assert.equal(imported.slides[0].design?.background?.tone, undefined, 'and as no tone');
  assert.deepEqual(imported.slides[0].design.background.overlay, background.overlay);
}
// An explicit tone wins: light text, the master's map.
assert.equal((await slideMap(deck({...duotone, tone: 'light'})))?.bg1 ?? 'lt1', 'lt1');
// A photograph with nothing over it keeps the old default.
assert.equal((await slideMap(deck({overlay: false})))?.bg1 ?? 'lt1', 'lt1');
console.log('rr105-picture-tone: ok');
