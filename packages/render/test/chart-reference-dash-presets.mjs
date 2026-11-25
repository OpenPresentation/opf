// OPF 0.37: a chart reference line's stroke takes every preset dash a shape outline takes; the preview draws the pattern of each.
import assert from 'node:assert/strict';
import {toSvg} from './catalog-harness.mjs';
import {PRESET_DASHES} from '../src/shapes.js';

const attrs = text => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const refs = svg => [...svg.matchAll(/<line\b([^>]*)>/g)].map(([, text]) => attrs(text)).filter(entry => /^slides\.0\.chart\.referenceLines\.\d+$/.test(entry['data-opf-path'] ?? ''));
const data = {columns: ['Quarter', 'Actual'], rows: [['Q1', 10], ['Q2', 20], ['Q3', 30]]};
const names = Object.keys(PRESET_DASHES);
const deck = {design: {fontScheme: 'roboto'}, slides: [{title: 'Dashes', chart: {type: 'line', data, referenceLines: names.map((dash, index) => ({value: 12 + index, stroke: {width: 2, dash}}))}}]};
const lines = refs(toSvg(deck, 1, {trace: true}));
assert.equal(lines.length, names.length);
names.forEach((name, index) => {
  const pattern = PRESET_DASHES[name], line = lines[index];
  if (pattern === null) assert.equal(line['stroke-dasharray'], undefined, `${name}: solid`);
  else assert.deepEqual(line['stroke-dasharray'].split(' ').map(Number), pattern.map(part => part * 2), name);
});
console.log(`Reference line dashes passed: ${names.length} presets drawn with the shape outline patterns.`);
