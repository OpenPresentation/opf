// LH-64 and LH-04: how a row of cards stands in a template region. Body-text cards in a bottom- or middle-anchored region hug a
// short text and the row centres, a shorter text in the middle of its card (COL-3); very unequal texts start at the card's top
// under a bottom anchor and center under a middle one; a heading line, a picture or a metric keeps the
// anchor (LH-22). Top-anchored cards hug their content with one height per row. Short bodies are checked with `fill: false`: LH-48
// grows an under-filled body and centers it (lone-fill.test.mjs).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';

const record = (anchor, regions) => ({ id: 'cards', name: 'Cards', design: { contentBox: true }, direction: 'column', anchor, regions: [{ name: 'title' }, ...regions] });
const grid = (anchor) => record(anchor, [{ name: 'body', accepts: ['text', 'list', 'metric', 'image', 'group'], role: 'primary', flow: 'grid' }]);
const columns = (anchor) => record(anchor, [{ direction: 'row', regions: ['first', 'second', 'third'].map((name) => ({ name, accepts: ['text', 'list'], role: 'primary', max: 1 })) }]);
const cards = (result) => result.items.filter((item) => item.frameBox);
const body = (result) => result.regions.find((region) => region.content.length).box;
const bottomOf = (box) => box.y + box.height;
const middleOf = (box) => box.y + box.height / 2;
const sentence = 'Measure task completion and time against the baseline before deciding what to scale, and name the owner of each decision.';

for (const anchor of ['bottom', 'middle']) {
  for (const [shape, layout, blocks] of [
    ['a grid', grid(anchor), [{ text: 'Two teams.' }, { bullets: ['Six weeks', 'One workflow'] }, { text: 'A named owner.' }]],
    ['regions side by side', columns(anchor), [{ text: 'Two teams.' }, { items: ['Six weeks', 'One workflow'] }, { text: 'A named owner.' }]],
  ]) {
    test(`${anchor} anchor, ${shape}: short body-text cards hug the tallest text and the row centres`, () => {
      const result = composeSlide({ title: 'Cards', blocks }, { layout, fill: false });
      assert.deepEqual(result.diagnostics, []);
      const items = cards(result), area = body(result);
      assert.equal(items.length, 3);
      assert.equal(new Set(items.map((item) => item.frameBox.height)).size, 1, 'one height');
      assert.equal(new Set(items.map((item) => item.frameBox.y)).size, 1, 'one top edge');
      assert.ok(items[0].frameBox.height < area.height * 0.3, 'the cards hug');
      assert.ok(Math.abs(middleOf(items[0].frameBox) - middleOf(area)) < 1, 'the row centres');
      for (const item of items) {
        assert.ok(item.box.y >= item.frameBox.y && bottomOf(item.box) <= bottomOf(item.frameBox) + 0.01, `${item.path}: the payload stays on its card`);
        assert.ok(!item.text.overflow, `${item.path} fits`);
      }
    });
  }
}

test('right to left: hugging cards keep their cells, mirrored', () => {
  const blocks = [{ text: 'Two teams.' }, { text: 'Six weeks.' }, { text: 'A named owner.' }];
  const ltr = cards(composeSlide({ title: 'Cards', blocks }, { layout: grid('bottom') })), rtl = cards(composeSlide({ title: 'Cards', blocks }, { layout: grid('bottom'), direction: 'rtl' }));
  ltr.forEach((item, index) => {
    const mirror = rtl[index].frameBox;
    assert.ok(Math.abs(mirror.x - (1280 - item.frameBox.x - item.frameBox.width)) < 0.01 && mirror.y === item.frameBox.y && mirror.height === item.frameBox.height, `${item.path} mirrored`);
  });
});

test('long body text keeps the filled card at its anchor; very unequal texts start at the card top', () => {
  // Plain lists of long entries: three long paragraphs side by side are drawn one card per row instead (LH-86, split-fill.test.mjs).
  const even = composeSlide({ title: 'Cards', blocks: [{ bullets: [sentence, sentence] }, { bullets: [sentence, sentence] }, { bullets: [sentence, sentence] }] }, { layout: columns('bottom') });
  for (const item of cards(even)) {
    assert.ok(Math.abs(bottomOf(item.frameBox) - bottomOf(body(even))) < 1, `${item.path}: the card fills its region`);
    assert.ok(item.box.y - item.frameBox.y > bottomOf(item.frameBox) - bottomOf(item.box), `${item.path}: at the foot`);
  }
  const uneven = composeSlide({ title: 'Cards', blocks: [{ text: `${sentence} ${sentence} ${sentence}` }, { text: 'Two teams.' }, { text: 'Six weeks.' }] }, { layout: columns('bottom'), recompose: false });
  // LH-186: without recompose: false the slide is composed as the automatic grid, where the long text reads larger.
  const items = cards(uneven);
  assert.equal(new Set(items.map((item) => item.box.y)).size, 1, 'one first line');
  for (const item of items) assert.ok(item.box.y - item.frameBox.y < 25, `${item.path}: at the card top`);
});

test('a heading line, a picture or a metric on the row keeps the anchor and the filled cards', () => {
  const picture = { src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', alt: 'A square' };
  for (const odd of [{ items: [{ text: 'Scope', description: 'Two teams.' }] }, { metric: { value: '84%', label: 'Completion' } }, { image: picture }]) {
    const result = composeSlide({ title: 'Cards', blocks: [{ text: 'Two teams.' }, odd, { text: 'Six weeks.' }] }, { layout: grid('bottom') });
    for (const item of cards(result)) assert.ok(Math.abs(bottomOf(item.frameBox) - bottomOf(body(result))) < 1, `${Object.keys(odd)[0]}: ${item.path} fills its region`);
  }
});

test('top anchor: cards hug their content with one height per row; a chart or picture keeps the filled cell', () => {
  for (const layout of [grid('top'), columns('top')]) {
    const result = composeSlide({ title: 'Cards', blocks: [{ text: 'Two teams.' }, { text: sentence }, { text: 'Six weeks.' }] }, { layout, fill: false });
    assert.deepEqual(result.diagnostics, []);
    const items = cards(result), area = body(result);
    assert.equal(new Set(items.map((item) => item.frameBox.height)).size, 1, 'one height per row');
    assert.equal(new Set(items.map((item) => item.frameBox.y)).size, 1, 'one top edge');
    assert.ok(items[0].frameBox.y - area.y < 13 && items[0].frameBox.height < area.height / 2, 'the cards hug from the top');
  }
  const picture = { src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', alt: 'A square' };
  const mixed = composeSlide({ title: 'Cards', blocks: [{ text: 'Two teams.' }, { image: picture }] }, { layout: grid('top') });
  for (const item of cards(mixed)) assert.ok(Math.abs(bottomOf(item.frameBox) - bottomOf(body(mixed))) < 1, `${item.path}: a row with a picture fills its cell`);
});

test('COL-3: under a middle anchor, very unequal texts center in their filled cards instead of starting at the top', () => {
  const uneven = composeSlide({ title: 'Cards', blocks: [{ text: `${sentence} ${sentence} ${sentence}` }, { text: 'Two teams.' }, { text: 'Six weeks.' }] }, { layout: columns('middle'), recompose: false });
  const items = cards(uneven);
  for (const item of items.slice(1)) {
    const over = item.box.y - item.frameBox.y, under = bottomOf(item.frameBox) - bottomOf(item.box);
    assert.ok(over > 25 && Math.abs(over - under) < 24, `${item.path}: in the middle of its card (${over} above, ${under} under)`);
  }
});

test('COL-3: a shorter text in a row of hugging cards sits in the middle of its card', () => {
  for (const anchor of ['bottom', 'middle']) {
    const result = composeSlide({ title: 'Cards', blocks: [{ text: 'Two teams.' }, { text: 'Keep the scope narrow, collect feedback weekly and give each decision a named owner.' }, { text: 'Six weeks.' }] }, { layout: columns(anchor), fill: false });
    const items = cards(result), height = (item) => item.text.height ?? item.text.lines.length * item.text.lineHeight;
    assert.equal(new Set(items.map((item) => item.frameBox.height)).size, 1, 'one card height');
    for (const item of items) {
      const over = item.box.y - item.frameBox.y, under = bottomOf(item.frameBox) - item.box.y - height(item);
      assert.ok(Math.abs(over - under) < 16, `${anchor}: ${item.path} centered in its card (${over} above, ${under} under)`);
      assert.ok(bottomOf(item.box) <= bottomOf(item.frameBox) + 0.01, `${item.path}: the payload stays on its card`);
    }
  }
});

test('P1: under a middle anchor a row of labeled cards hugs its tallest card and centers; a bottom anchor keeps filled cards', () => {
  const blocks = [{ items: [{ text: 'Clear scope', description: 'Two teams.' }] }, { items: [{ text: 'Consistent measures', description: 'Track completion and task time against a baseline.' }] }, { items: [{ text: 'A decision', description: 'Agree first.' }] }];
  const middle = cards(composeSlide({ title: 'Cards', blocks }, { layout: grid('middle'), fill: false })), area = body(composeSlide({ title: 'Cards', blocks }, { layout: grid('middle'), fill: false }));
  assert.equal(new Set(middle.map((item) => item.frameBox.height)).size, 1, 'one card height');
  assert.ok(middle[0].frameBox.height < area.height * 0.8 && Math.abs(middleOf(middle[0].frameBox) - middleOf(area)) < 1, 'the cards hug and the row centers');
  assert.equal(new Set(middle.map((item) => item.box.y)).size, 1, 'the content starts on one line');
  const bottom = composeSlide({ title: 'Cards', blocks }, { layout: grid('bottom'), fill: false });
  for (const item of cards(bottom)) assert.ok(Math.abs(bottomOf(item.frameBox) - bottomOf(body(bottom))) < 1, `${item.path}: a bottom-anchored card fills its region`);
});
