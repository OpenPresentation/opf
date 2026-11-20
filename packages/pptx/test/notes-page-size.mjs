// RR-105 (#1290, ribbon audit gap 16): the notes page is the standard portrait page (p:notesSz 6858000 x 9144000 EMU, 7.5 x 10 in)
// whatever the slide size. The vendored writer turned the slide size on its side (7.5 x 13.33 in for 16:9), so View > Notes Page and
// printed notes pages laid out on an odd page. The notes master's placeholders already sit on the standard page, and the slide size
// (p:sldSz), which import reads, is unchanged.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {fromPptx, toPptx} from '../dist/index.js';

let checks = 0;
for (const dimensions of [undefined, '16:9', '4:3', 'a4', '16:10']) {
  const deck = {name: 'Notes page', ...(dimensions ? {design: {dimensions}} : {}), slides: [{title: 'Agenda', notes: 'Say hello.'}, {title: 'Close'}]};
  const bytes = await toPptx(structuredClone(deck), {});
  const parts = unzipSync(bytes);
  const presentation = strFromU8(parts['ppt/presentation.xml']);
  const notes = presentation.match(/<p:notesSz\b[^>]*\/>/g);
  assert.deepEqual(notes, ['<p:notesSz cx="6858000" cy="9144000"/>'], `${dimensions ?? 'default'}: the standard portrait notes page`);
  const slide = /<p:sldSz cx="(\d+)" cy="(\d+)"/.exec(presentation);
  assert.ok(slide, `${dimensions ?? 'default'}: the slide size is written`);
  // Every notes master placeholder lies on the page.
  const master = strFromU8(parts['ppt/notesMasters/notesMaster1.xml']);
  const boxes = [...master.matchAll(/<a:off x="(\d+)" y="(\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/g)].map(match => match.slice(1).map(Number));
  assert.ok(boxes.length >= 6, 'the notes master has its placeholders');
  for (const [x, y, cx, cy] of boxes) assert.ok(x + cx <= 6858000 && y + cy <= 9144000, `notes master box ${[x, y, cx, cy]} lies on the notes page`);
  // The import round trip reads the slide size from p:sldSz, not the notes page.
  const imported = await fromPptx(bytes);
  const again = await fromPptx(await toPptx(structuredClone(imported), {}));
  assert.deepEqual(again, imported, `${dimensions ?? 'default'}: the round trip is stable`);
  if (dimensions) assert.deepEqual(imported.design?.dimensions, deck.design.dimensions, `${dimensions}: the slide size returns`);
  assert.equal(imported.slides[0].notes, 'Say hello.');
  checks++;
}
console.log(`notes-page-size: ${checks} decks checked`);
