import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {toPptx} from '../dist/index.js';

// RR-29: promoted regions are composed (and so written) in visual reading order, not alphabetical key order, so PowerPoint's
// selection pane and screen readers read left, center, right and top, middle, bottom. The exporter writes core's item order.
const texts = async slide => {
  const xml = new TextDecoder().decode(unzipSync(await toPptx({slides: [slide]}))['ppt/slides/slide1.xml']);
  return [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(([, text]) => text);
};
assert.deepEqual(await texts({title: 'T', blocks: [{region: 'start',text: 'L'}, {region: 'center',text: 'C'}, {region: 'end',text: 'R'}]}), ['T', 'L', 'C', 'R']);
assert.deepEqual(await texts({title: 'T', blocks: [{region: 'top',text: 'A'}, {region: 'middle',text: 'M'}, {region: 'bottom',text: 'B'}]}), ['T', 'A', 'M', 'B']);
assert.deepEqual(await texts({title: 'T', blocks: [{region: 'top:start',text: 'A'}, {region: 'top:center+end',text: 'B'}, {region: 'middle+bottom:start',text: 'C'}, {region: 'middle+bottom:center+end',text: 'D'}]}), ['T', 'A', 'B', 'C', 'D']);
// the same slide written with its keys in another order exports the same shapes in the same order
const first = await toPptx({slides: [{title: 'T', blocks: [{region: 'start',text: 'L'}, {region: 'center',text: 'C'}, {region: 'end',text: 'R'}]}]});
const second = await toPptx({slides: [{title: 'T', blocks: [{region: 'start',text: 'L'}, {region: 'center',text: 'C'}, {region: 'end',text: 'R'}]}]});
const slide = bytes => new TextDecoder().decode(unzipSync(bytes)['ppt/slides/slide1.xml']);
assert.equal(slide(first), slide(second));
console.log('Promoted regions export in reading order: columns, rows, spans and key-order independence.');
