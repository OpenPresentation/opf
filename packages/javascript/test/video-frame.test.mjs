import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';

// WI-3 (P23): a video is drawn in a 16:9 frame, the largest that fits its cell, placed by the region's anchor like a contained
// picture. A portrait cell no longer holds a mostly empty 372 x 515 box around a play button.
const { layouts } = gallery;
const videos = (count) => Array.from({ length: count }, (_, index) => ({ video: { src: `https://example.com/clip-${index}.mp4`, title: `Walkthrough ${index + 1}` } }));
const near = (a, b, message) => assert.ok(Math.abs(a - b) <= 0.51, `${message ?? ''} ${a} vs ${b}`);

test('three columns: each video is 16:9 at the top of its portrait cell', () => {
  const result = composeSlide({ title: 'Three peer columns of video', blocks: videos(3) }, { layout: layouts['three-column'] });
  const items = result.items.filter((item) => item.field === 'video');
  assert.equal(items.length, 3);
  for (const [index, item] of items.entries()) {
    const region = result.regions.find((entry) => entry.name === ['first', 'second', 'third'][index]).box;
    assert.ok(region.height > region.width, 'the cell is portrait');
    near(item.box.width, region.width, 'the frame takes the cell width');
    near(item.box.width / item.box.height, 16 / 9, 'the frame is 16:9');
    near(item.box.y, region.y, 'the frame is at the top');
    near(item.box.x, region.x);
  }
  assert.deepEqual(result.diagnostics, []);
});

test('a wide cell: the frame takes the cell height and sits centered across', () => {
  const result = composeSlide({ title: 'One video', blocks: videos(1) }, { layout: layouts.image });
  const [item] = result.items.filter((entry) => entry.field === 'video');
  const region = result.regions.find((entry) => entry.name === 'media').box;
  assert.ok(region.width / region.height > 16 / 9, 'the cell is wider than 16:9');
  near(item.box.height, region.height);
  near(item.box.width / item.box.height, 16 / 9);
  near(item.box.x + item.box.width / 2, region.x + region.width / 2, 'centered across');
});

test('the region anchor places the frame down a tall cell', () => {
  const record = (anchor) => ({ name: 'Columns', direction: 'column', regions: [{ name: 'title' }, { direction: 'row', regions: ['first', 'second'].map((name) => ({ name, accepts: ['video'], role: 'primary', flow: 'none', anchor })) }] });
  const frame = (anchor) => composeSlide({ title: 'T', blocks: videos(2) }, { layout: record(anchor) }).items.find((item) => item.field === 'video').box;
  const top = frame('top'), middle = frame('middle'), bottom = frame('bottom');
  const spare = composeSlide({ title: 'T', blocks: videos(2) }, { layout: record('top') }).regions.find((entry) => entry.name === 'first').box.height - top.height;
  near(middle.y, top.y + spare / 2);
  near(bottom.y, top.y + spare);
});

test('a video in automatic composition is 16:9 and a caption sits just under it', () => {
  const result = composeSlide({ title: 'T', blocks: [{ video: { src: 'https://example.com/a.mp4', title: 'Intro' }, caption: 'The walkthrough' }, { text: 'Expansion should follow evidence rather than a fixed launch calendar.' }] });
  const item = result.items.find((entry) => entry.field === 'video');
  near(item.box.width / item.box.height, 16 / 9);
  assert.ok(item.caption.box.y >= item.box.y + item.box.height - 0.01 && item.caption.box.y - (item.box.y + item.box.height) < 20);
});

test('the title and the label still fit the frame', () => {
  const result = composeSlide({ title: 'T', blocks: videos(3) }, { layout: layouts['three-column'] });
  for (const item of result.items.filter((entry) => entry.field === 'video')) assert.ok(item.box.height >= 180, `${item.box.height}`);
});
