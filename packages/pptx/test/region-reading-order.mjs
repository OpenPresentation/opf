import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {toPptx} from '../dist/index.js';

// RR-29: promoted regions are composed (and so written) in visual reading order, not alphabetical key order, so PowerPoint's
// selection pane and screen readers read left, center, right and top, middle, bottom. The exporter writes core's item order.
const texts = async slide => {
  const xml = new TextDecoder().decode(unzipSync(await toPptx({slides: [slide]}))['ppt/slides/slide1.xml']);
  return [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(([, text]) => text);
};
assert.deepEqual(await texts({title: 'T', right: {text: 'R'}, center: {text: 'C'}, left: {text: 'L'}}), ['T', 'L', 'C', 'R']);
assert.deepEqual(await texts({title: 'T', bottom: {text: 'B'}, top: {text: 'A'}, middle: {text: 'M'}}), ['T', 'A', 'M', 'B']);
assert.deepEqual(await texts({title: 'T', 'middle+bottom:center+right': {text: 'D'}, 'middle+bottom:left': {text: 'C'}, 'top:center+right': {text: 'B'}, 'top:left': {text: 'A'}}), ['T', 'A', 'B', 'C', 'D']);
// the same slide written with its keys in another order exports the same shapes in the same order
const first = await toPptx({slides: [{title: 'T', left: {text: 'L'}, center: {text: 'C'}, right: {text: 'R'}}]});
const second = await toPptx({slides: [{title: 'T', right: {text: 'R'}, left: {text: 'L'}, center: {text: 'C'}}]});
const slide = bytes => new TextDecoder().decode(unzipSync(bytes)['ppt/slides/slide1.xml']);
assert.equal(slide(first), slide(second));
console.log('Promoted regions export in reading order: columns, rows, spans and key-order independence.');
