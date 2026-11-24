// Open choice 6, option D (opf#1415): a native body that core set in the middle (or at the bottom) of the space it was given on a slide
// without a layout region is written as a box over that space, anchored in the middle (or at the bottom), so PowerPoint keeps the text
// there when lines are added; it opens with its lines where the top-anchored box put them. Pins the placement (automaticPlacement) for a
// centered list, a bottom-placed text, a top-pinned list, two blocks stacked in one column and two side by side, the text height
// PowerPoint stacks (nativeTextHeight), and an exported deck: the box, its anchor, no autofit, and the first line's place.
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {toPptx} from '../dist/index.js';
import {automaticPlacement, nativeTextHeight} from '../dist/native-body.js';

const content = {x: 57.6, y: 147.5, width: 1164.8, height: 514.9};
const entry = (y, lines = 1) => ({textBox: {x: 87, y, width: 1100, height: 68.32 * lines}, text: {lineHeight: 68.32, lines: Array(lines).fill('line')}});
// A list of three one-line entries 15.68 px apart, as core composes the minimal deck's list (core's box is 3 px taller than the lines).
const list = (y) => ({path: 'slides.1.items', field: 'items', box: {x: 57.6, y, width: 1164.8, height: 239.32},
  text: {listEntries: [entry(y), entry(y + 68.32 + 15.68), entry(y + 2 * (68.32 + 15.68))]}});
const text = (y, height = 37.16) => ({path: 'slides.1.text', field: 'text', box: {x: 57.6, y, width: 1164.8, height}, text: {lineHeight: 34.16, lines: ['one line']}});
const geometry = (...items) => ({contentBox: content, items: [{path: 'slides.1.title', field: 'title', box: {x: 57.6, y: 57.6, width: 1164.8, height: 65.9}}, ...items]});
const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-6, `${what}: ${a} against ${b}`);

// The text height PowerPoint stacks: each line at its exact spacing in whole hundredths of a point, and the space before later entries.
const points = value => Math.round(value * 75) / 100 / .75;
near(nativeTextHeight(list(285.28), true), 3 * points(68.32) + 2 * points(15.68), 'list height');
near(nativeTextHeight(text(386.36), false), points(34.16), 'text height');

// 1. A centered list: a box over the whole content box's height around the text's own center, anchored in the middle; the first line
//    opens where the top-anchored box put it.
{
  const item = list(content.y + (content.height - 239.32) / 2);
  const placed = automaticPlacement(item, true, geometry(item));
  assert.equal(placed.anchor, 'middle');
  const height = nativeTextHeight(item, true), center = item.box.y + height / 2;
  near(placed.box.y + placed.box.height / 2, center, 'the box is centered on the text, not on core\'s taller box');
  near(placed.box.y, content.y, 'it reaches the content box\'s nearer edge');
  assert.ok(placed.box.y + placed.box.height <= content.y + content.height + 1e-6, 'and stays inside it');
  near(placed.box.y + (placed.box.height - height) / 2, item.box.y, 'first line where it opened before');
  assert.equal(placed.box.x, item.box.x);
}

// 2. A bottom-placed text: from the content box's top to the end of its own lines, anchored at the bottom.
{
  const item = text(content.y + content.height - 37.16);
  const placed = automaticPlacement(item, false, geometry(item));
  assert.equal(placed.anchor, 'bottom');
  near(placed.box.y, content.y, 'from the top of the space');
  near(placed.box.y + placed.box.height - nativeTextHeight(item, false), item.box.y, 'the line stays where it was');
}

// 3. A list core pinned to the top keeps the box that hugs it, anchored at the top.
{
  const item = list(content.y);
  assert.deepEqual(automaticPlacement(item, true, geometry(item)), {box: item.box, anchor: 'top'});
}

// 4. Two blocks stacked in one column (core centers them as one group): each keeps its own box, so neither covers the other.
{
  const first = text(300), second = {...list(360), path: 'slides.1.items'};
  const g = geometry(first, second);
  const a = automaticPlacement(first, false, g), b = automaticPlacement(second, true, g);
  assert.deepEqual(a, {box: first.box, anchor: 'top'});
  assert.deepEqual(b, {box: second.box, anchor: 'top'});
  assert.ok(a.box.y + a.box.height <= b.box.y, 'no overlap');
}

// 5. Two blocks side by side, each centered in its own column: each takes its column's height; a wrap box that reaches into the other's
//    column leaves the text its own box.
{
  const left = {...text(content.y + (content.height - 37.16) / 2), box: {x: 57.6, y: content.y + (content.height - 37.16) / 2, width: 560, height: 37.16}};
  const right = {...list(content.y + (content.height - 239.32) / 2), box: {x: 662, y: content.y + (content.height - 239.32) / 2, width: 560, height: 239.32}};
  const g = geometry(left, right);
  assert.equal(automaticPlacement(left, false, g, {x: 57.6, width: 560}).anchor, 'middle');
  assert.equal(automaticPlacement(right, true, g, {x: 662, width: 560}).anchor, 'middle');
  assert.deepEqual(automaticPlacement(left, false, g, {x: 57.6, width: 640}), {box: left.box, anchor: 'top'}, 'a wrap into the next column');
}

// 6. An exported deck (the minimal deck's list slide, --body-text native): a box anchored in the middle, no autofit, the text centered.
{
  const deck = {slides: [{title: 'What This Shows', items: ['A title slide', 'A simple list slide', 'A closing slide']}]};
  const entries = unzipSync(await toPptx(deck, {bodyText: 'native'}));
  const xml = new TextDecoder().decode(entries['ppt/slides/slide1.xml']);
  const shape = /<p:sp>(?:(?!<\/p:sp>)[\s\S])*?name="OPF native body slides\.0\.items"[\s\S]*?<\/p:sp>/.exec(xml)?.[0];
  assert.ok(shape, 'a native body');
  const body = /<a:bodyPr\b[^>]*>/.exec(shape)[0];
  assert.match(body, /\banchor="ctr"/);
  assert.match(body, /\btIns="0"/); assert.match(body, /\bbIns="0"/);
  assert.match(shape, /<a:noAutofit\/>/, 'no autofit: spAutoFit would resize the box from its top');
  const [y, height] = [/<a:off x="\d+" y="(\d+)"/.exec(shape)[1], /<a:ext cx="\d+" cy="(\d+)"/.exec(shape)[1]].map(value => Number(value) / 9525);
  const paragraphs = [...shape.slice(shape.indexOf('<p:txBody>')).matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)].map(match => match[1]);
  const lines = paragraphs.reduce((total, paragraph, index) => total + Number(/<a:lnSpc><a:spcPts val="(\d+)"/.exec(paragraph)[1]) / 75
    + (index ? Number(/<a:spcBef><a:spcPts val="(\d+)"/.exec(paragraph)?.[1] ?? 0) / 75 : 0), 0);
  const top = y + (height - lines) / 2;
  assert.ok(top > y + 50 && top + lines < y + height - 50, `the lines sit in the middle of a box over the body (${top.toFixed(2)} in ${y.toFixed(2)}..${(y + height).toFixed(2)})`);
  // The first line opens where the top-anchored box put it: at core's first line, which the measured export writes as the list's first
  // line shape (and which the native body's box started at before option D).
  const measured = new TextDecoder().decode(unzipSync(await toPptx(deck))['ppt/slides/slide1.xml']);
  const first = Number(/name="OPF list slides\.0\.items line 0"[\s\S]*?<a:off x="\d+" y="(\d+)"/.exec(measured)[1]) / 9525;
  assert.ok(Math.abs(top - first) < 0.01, `first line at ${top.toFixed(3)} px, where it opened before (${first.toFixed(3)} px)`);
  // The automatic layout's Body placeholder takes the same box and anchor, so Reset puts the text back where it is.
  const target = /Target="\.\.\/slideLayouts\/(slideLayout\d+\.xml)"/.exec(new TextDecoder().decode(entries['ppt/slides/_rels/slide1.xml.rels']))?.[1];
  assert.ok(target && entries[`ppt/slideLayouts/${target}`], 'the slide\'s layout');
  assert.match(new TextDecoder().decode(entries[`ppt/slideLayouts/${target}`]), /<p:ph type="body"[\s\S]*?anchor="ctr"/);
}

console.log('Native body anchor passed: centered and bottom-placed bodies cover their space and keep their lines, top-pinned and stacked ones keep their boxes.');
