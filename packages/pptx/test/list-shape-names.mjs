import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {resolvePresentation} from '@openpresentation/opf-render';
import {toPptx} from '../dist/index.js';

// FF-38: every native line of a measured list is named for the list it belongs
// to, `OPF list <path> line N`, like the other measured text shapes. A reader
// that maps shapes to their composed item by name then keeps the lines of an
// overflowing list, which sit below the item's box, with that list. Mapping them
// by geometry left the lower items unmapped and their bullets uncounted.
const decoder = new TextDecoder();
const items = [
  'First point',
  {text: 'Supporting detail', description: 'An explanation that is long enough to wrap onto a second line at least once, maybe twice, given the narrow box it sits in.'},
  'Next step',
  'Last one',
];
// Five stacked lists cannot hold four entries each: the lower entries fall outside their item's box.
const deck = {design: {fontScheme: 'roboto'}, slides: [
  {title: 'Lists', composition: {mode: 'column'}, blocks: Array.from({length: 5}, () => ({items}))},
  {title: 'Roomy', items: ['a', 'b', 'c']},
]};

const resolved = resolvePresentation(structuredClone(deck), {});
const entries = unzipSync(await toPptx(deck, {seed: 1}));
const shapes = index => [...decoder.decode(entries[`ppt/slides/slide${index + 1}.xml`]).matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape]) => ({
  name: shape.match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)[1],
  text: [...shape.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match => match[1]).join(''),
  bullet: shape.match(/<a:buChar char="([^"]*)"/)?.[1],
  styledBullet: /<a:buSzPts val="\d+"\/>/.test(shape) && /<a:buFont typeface="[^"]+"\/>/.test(shape),
  y: +shape.match(/<a:off x="-?\d+" y="(-?\d+)"/)[1] / 9525,
  h: +shape.match(/<a:ext cx="\d+" cy="(\d+)"/)[1] / 9525,
}));

let lists = 0, overflowing = 0;
for (const [slideIndex, slide] of resolved.slides.entries()) {
  const native = shapes(slideIndex);
  assert.ok(!native.some(shape => /^OPF list paragraph/.test(shape.name)), 'Lines are named for their list path, not a running paragraph number');
  assert.equal(new Set(native.map(shape => shape.name)).size, native.length, 'Names are unique within the slide');
  for (const item of slide.geometry.items.filter(candidate => candidate.field === 'items' && candidate.text?.listEntries)) {
    const lines = item.text.listEntries.flatMap(entry => [
      ...entry.text.richLines.map((line, index) => ({bullet: index === 0, top: entry.textBox.y + line.y, height: line.height})),
      ...(entry.description?.richLines ?? []).map(line => ({bullet: false, top: entry.descriptionBox.y + line.y, height: line.height})),
    ]);
    const named = native.filter(shape => shape.name.startsWith(`OPF list ${item.path} line `));
    assert.deepEqual(named.map(shape => shape.name), lines.map((_, number) => `OPF list ${item.path} line ${number}`), `${item.path}: one named shape per laid-out line, in order`);
    assert.deepEqual(named.map(shape => shape.bullet !== undefined), lines.map(line => line.bullet), `${item.path}: only an entry's first line carries its marker`);
    assert.ok(named.filter(shape => shape.bullet !== undefined).every(shape => shape.styledBullet), `${item.path}: measured marker size and font survive the rename`);
    for (const [number, shape] of named.entries()) {
      assert.ok(Math.abs(shape.y - lines[number].top) < .05 && Math.abs(shape.h - lines[number].height) < .05, `${item.path}: line ${number} geometry`);
    }
    // The point of the name: where geometry cannot say which list a line belongs to.
    if (named.some(shape => shape.y + shape.h / 2 > item.box.y + item.box.height)) overflowing++;
    lists++;
  }
}
assert.equal(lists, 6);
assert.equal(overflowing, 5, 'Every stacked list has lines below its composed box');

console.log(`List shape names passed: ${lists} lists, ${overflowing} with lines below their box, all lines named for their list path with measured markers intact.`);
