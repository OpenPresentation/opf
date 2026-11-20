// LH-156: a flow chip fits its entry alone, so its citation marker is looked up at the entry's own index (as a tile's is, LH-137): a cited
// second entry keeps its marker on its own chip's text, and the entries before it get none.
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {toPptx, resolvePresentation} from './helpers/default-catalog.mjs';

const decoder = new TextDecoder();
const deck = {name: 'Cited flow', references: [{id: 'a', text: 'Source A'}, {id: 'b', text: 'Source B'}], slides: [
  {layout: 'process', title: 'How support works', blocks: [{items: ['Queue', [{text: 'Route', cite: 'b'}], [{text: 'Resolve', cite: 'a'}]]}]},
]};
const geometry = resolvePresentation(deck).slides[0].geometry;
assert.equal(geometry.steps?.[0]?.form, 'flow', 'the list is a flow of chips');
const xml = decoder.decode(unzipSync(await toPptx(deck))['ppt/slides/slide1.xml']);
const shapes = xml.split('<p:sp>').filter(shape => /baseline="30000"/.test(shape));
const names = shapes.map(shape => /name="([^"]*)"/.exec(shape)[1]);
assert.equal(shapes.length, 2, `two markers, one per cited chip: ${names.join(' | ')}`);
const markers = shapes.map(shape => /baseline="30000"[^>]*>(?:<[^>]*>)*?<a:t>([^<]*)<\/a:t>/.exec(shape)?.[1]);
assert.deepEqual(names.map(name => /list slides\.0\.blocks\.0\.items line (\d+)/.exec(name)?.[1] ?? name), names.map((_, index) => String(index + 1)), `the markers are on the second and third chips: ${names.join(' | ')}`);
assert.deepEqual(markers, ['1', '2'], 'numbered in reading order');
console.log('LH-156 a cited flow chip keeps its citation marker');
