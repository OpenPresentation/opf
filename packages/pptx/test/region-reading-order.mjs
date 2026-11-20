import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {toPptx} from '../dist/index.js';

// RR-29: the cells of a slide's grid (blocks that name a cell with `region`, OPF 0.35) are composed (and so written) in visual
// reading order, not in the order the blocks are written, so PowerPoint's selection pane and screen readers read start, center, end
// and top, middle, bottom. The exporter writes core's item order.
const texts = async slide => {
  const xml = new TextDecoder().decode(unzipSync(await toPptx({slides: [slide]}))['ppt/slides/slide1.xml']);
  return [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(([, text]) => text);
};
const cells = (...entries) => ({title: 'T', blocks: entries.map(([region, text]) => ({region, text}))});
assert.deepEqual(await texts(cells(['end', 'R'], ['center', 'C'], ['start', 'L'])), ['T', 'L', 'C', 'R']);
assert.deepEqual(await texts(cells(['bottom', 'B'], ['top', 'A'], ['middle', 'M'])), ['T', 'A', 'M', 'B']);
assert.deepEqual(await texts(cells(['middle+bottom:center+end', 'D'], ['middle+bottom:start', 'C'], ['top:center+end', 'B'], ['top:start', 'A'])), ['T', 'A', 'B', 'C', 'D']);
// The same slide with its blocks written in another order exports its shapes in the same order and places (only the names, which
// carry each block's own path, differ).
const shapes = bytes => [...new TextDecoder().decode(unzipSync(bytes)['ppt/slides/slide1.xml']).matchAll(/<a:off x="(\d+)" y="(\d+)"\/>(?:(?!<\/p:sp>)[\s\S])*?<a:t>([^<]*)<\/a:t>/g)].map(([, x, y, text]) => [x, y, text]);
const first = await toPptx({slides: [cells(['start', 'L'], ['center', 'C'], ['end', 'R'])]});
const second = await toPptx({slides: [cells(['end', 'R'], ['start', 'L'], ['center', 'C'])]});
assert.deepEqual(shapes(second), shapes(first));
assert.ok(shapes(first).length >= 4);
console.log('Cells export in reading order: columns, rows, spans and independence from the order the blocks are written in.');
