// A list drawn on an arrangement's native shapes (a process, chevrons) imports as written: the node text color the export writes on the
// lines (white on the primary), and the size and face they read back with, are drawing, not run formatting. A list whose runs set a
// color keeps it.
import assert from 'node:assert/strict';
import {fromPptx, toPptx} from './helpers/default-catalog.mjs';

const words = ['Plan work', 'Build well', 'Test parts', 'Ship users', 'Learn use', 'Improve next', 'Review cycle', 'Start again'];
const roundTrip = async (layout, items) => {
  const bytes = await toPptx({design: {background: 'light1'}, slides: [{layout, title: 'Steps', items}]}, {smartArt: 'shapes'});
  const imported = await fromPptx(bytes);
  return imported.slides[0].items ?? imported.slides[0].blocks?.find(block => block.items)?.items;
};
for (const layout of ['process', 'chevrons']) {
  for (const count of [6, 8]) {
    const items = words.slice(0, count);
    assert.deepEqual(await roundTrip(layout, items), items, `${layout} (${count}): entries import as written, with no white runs`);
  }
}
// A run that sets a color keeps it.
const colored = [{text: [{text: 'Plan ', color: '#C00000'}, 'work']}, 'Build it', 'Ship it'];
const back = await roundTrip('process', colored);
assert.ok(JSON.stringify(back[0]).includes('#C00000'), 'an entry run with its own color keeps it');
console.log('native arrangement import: process and chevrons come back as written; an authored run color is kept');
