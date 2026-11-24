// LG1: a name among logos (a plain text in the logos layout's media region) is drawn as a wordmark tile of the pictures' proportions,
// centered and at one size in any row, and a row of pictures alone does not change.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';
import { layouts } from './support/template-samples.mjs';

const mark = (path) => ({ image: { src: `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="240" viewBox="0 0 600 240"><rect width="600" height="240" fill="#f0f0f0"/><path d="${path}" stroke="#263445" stroke-width="24" fill="none"/></svg>`).toString('base64')}`, alt: 'A fictional mark' } });
const compose = (blocks) => composeSlide({ title: 'Recognize the partners', blocks }, { layout: layouts.logos });

test('LG1: a name among logos is a tile of the marks proportions, centered, at one size in any row', () => {
  const names = compose([{ text: 'North' }, { text: 'Field' }, { text: 'Studio Group International' }]).items.filter((item) => item.field === 'text');
  for (const item of names) {
    assert.ok(item.frameBox, 'a tile');
    assert.ok(Math.abs(item.frameBox.width / item.frameBox.height - 2.5) < 0.05, `${item.frameBox.width} x ${item.frameBox.height}`);
    assert.equal(item.alignment, 'center');
  }
  const mixed = compose([mark('M220 170V70l160 100V70'), { text: 'Field' }, mark('M240 70h120')]);
  const picture = mixed.items.find((item) => item.field === 'image'), name = mixed.items.find((item) => item.field === 'text');
  const frame = picture.image?.box ?? picture.box;
  assert.ok(Math.abs(name.frameBox.y - frame.y) < 1 && Math.abs(name.frameBox.height - frame.height) < 1, 'the tile is the pictures frame');
  assert.equal(name.text.fontSize, names[1].text.fontSize, 'the same size as in a row of names');
});

test('LG1: a row of pictures alone draws no tile', () => {
  const result = compose([mark('M220 170V70l160 100V70'), mark('M240 70h120'), mark('M300 60v120')]);
  assert.ok(result.items.filter((item) => item.field === 'image').every((item) => !item.frameBox));
});
