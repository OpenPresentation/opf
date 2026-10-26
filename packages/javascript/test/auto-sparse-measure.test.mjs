import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide, LEAD_NOMINAL_SIZE } from '../dist/composition.js';

// WI-4 (P34): in auto mode a prose block that wraps is no wider than about 70 average characters of its size, placed by the
// content alignment; a lone block of up to two lines uses the 32 px lead size. The measure never costs size, and a line
// that fits across its cell stays one line.
const { layouts } = gallery;
const sentence = 'Give one owner responsibility from intake through decision. A shared queue makes exceptions visible and keeps routine work moving. ';
const textOf = (result) => result.items.filter((item) => item.field === 'text');

test('a lone paragraph that wraps keeps a reading measure of about 70 characters', () => {
  const result = composeSlide({ title: 'Remove the handoff', blocks: [{ text: sentence + sentence }] }, { layout: layouts.text });
  const [item] = textOf(result);
  const body = result.regions.find((region) => region.name === 'body').box;
  assert.equal(item.text.fontSize, 28);
  assert.ok(item.box.width < body.width - 100, `${item.box.width} of ${body.width}`);
  assert.ok(Math.abs(item.box.width - 70 * 0.5 * 28) < 1, `${item.box.width}`);
  assert.equal(item.box.x, body.x, 'left aligned by default');
});

test('the measure follows the content alignment', () => {
  const body = (alignment) => {
    const result = composeSlide({ title: 'Aligned', design: { contentAlignment: alignment }, blocks: [{ text: sentence + sentence }] }, { layout: layouts.text });
    return [textOf(result)[0], result.regions.find((region) => region.name === 'body').box];
  };
  const [centered, area] = body('center');
  assert.ok(Math.abs(centered.box.x + centered.box.width / 2 - (area.x + area.width / 2)) < 1);
  const [right] = body('right');
  assert.ok(Math.abs(right.box.x + right.box.width - (area.x + area.width)) < 1);
});

test('a lone block of up to two lines uses the 32 px lead size', () => {
  assert.equal(LEAD_NOMINAL_SIZE, 32);
  const lone = composeSlide({ title: 'One idea', blocks: [{ text: 'Give one owner responsibility from intake through decision.' }] }, { layout: layouts.text });
  assert.equal(textOf(lone)[0].text.fontSize, 32);
  const twoLines = composeSlide({ title: 'One idea', blocks: [{ text: 'Give one owner responsibility from intake through decision. A shared queue makes exceptions visible and keeps routine work moving.' }] }, { layout: layouts.text });
  assert.equal(textOf(twoLines)[0].text.fontSize, 32);
  assert.ok(textOf(twoLines)[0].text.lines.length <= 2);
  // Longer text, and a block that has a neighbour, keep the 28 px body size.
  assert.equal(textOf(composeSlide({ title: 'Long', blocks: [{ text: sentence.repeat(4) }] }, { layout: layouts.text }))[0].text.fontSize, 28);
  const pair = composeSlide({ title: 'Two', blocks: [{ text: 'Give one owner responsibility.' }, { text: 'Make exceptions visible.' }] }, { layout: layouts.text });
  assert.deepEqual(textOf(pair).map((item) => item.text.fontSize), [28, 28]);
});

test('a block that is one line across its cell keeps the whole cell', () => {
  const result = composeSlide({ title: 'Line', blocks: [{ text: 'A short sentence of about sixty characters, set on one line only.' }] }, { layout: layouts.text });
  const [item] = textOf(result);
  const body = result.regions.find((region) => region.name === 'body').box;
  assert.equal(item.text.lines.length, 1);
  assert.equal(item.box.width, body.width);
});

test('the measure never costs size: dense prose uses its whole cell', () => {
  const dense = composeSlide({ title: 'Dense', blocks: [{ text: sentence.repeat(14) }] }, { layout: layouts.text });
  const [item] = textOf(dense);
  const body = dense.regions.find((region) => region.name === 'body').box;
  assert.equal(item.box.width, body.width, 'the cell, because the measure would shrink the type');
  assert.equal(dense.diagnostics.length, 0);
  assert.ok(item.text.fontSize >= 16);
});

test('a composition that is not auto keeps the whole cell', () => {
  const result = composeSlide({ title: 'Grid', blocks: [{ text: sentence + sentence }, { text: 'Second.' }], composition: { mode: 'column' } });
  const wide = textOf(result)[0];
  assert.ok(wide.box.width > 70 * 0.5 * 28 + 100, `${wide.box.width}`);
});
