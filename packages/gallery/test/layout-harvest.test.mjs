// The layout harvest (examples/technical/layout-sampler.opf.json compared with Claude Design): pillars, team and scorecard
// draw full-height cards with their content at the region's anchor (LH-22) when a card carries a picture, a metric or a
// heading line; cards of body text only hug their text and the row centres when the text is short (LH-64); top-anchored
// cards hug their content (LH-04); and hero sets a full-height picture beside its text column.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '@openpresentation/opf/composition';
import { gallery } from '../dist/index.js';

// The records' own card rules at the role sizes (`fill: false`): LH-48 grows an under-filled body and centers it (core lone-fill.test.mjs).
const compose = (id, slide, options = {}) => composeSlide(slide, { width: 1280, height: 720, layout: gallery.layouts[id], fill: false, ...options });
const labelled = (text, description) => ({ items: [{ text, description }] });
const bottomOf = (box) => box.y + box.height;
const carded = (result) => result.items.filter((item) => item.frameBox);
const bodyOf = (result) => result.regions.filter((region) => region.content.length).map((region) => region.box);
const textHeight = (item) => item.text.height ?? item.text.lines.length * item.text.lineHeight;
const long = 'Shift the library from stacks-first to research-services-first before the next budget cycle, and report the change in use each term so the board can judge it.';

for (const [id, anchor, blocks] of [
  ['pillars', 'bottom', [labelled('Clear scope', 'Two teams and one workflow keep the pilot focused.'), labelled('Consistent measures', 'Track completion and task time against a baseline.'), labelled('An explicit decision', 'Agree the evidence needed before expanding the rollout to every team.')]],
  ['team', 'bottom', [labelled('Ana Ruiz', 'Pilot lead'), labelled('Sam Lee', 'Product lead. Turns participant feedback into product changes.'), labelled('Kai Moreau', 'Analytics lead')]],
  // LH-68: scorecard metrics are tiles: label at the card's top, value under it, description at its foot.
  ['scorecard', 'tile', [{ metric: { value: 52, label: 'Participants', description: 'Target: 50' } }, { metric: { value: '84%', label: 'Completion', description: 'Target: at least 80%' } }, { metric: { value: '6.2', unit: 'min', label: 'Median time' } }]],
]) {
  test(`${id}: cards with a heading line or a metric fill the body and set their content at the ${anchor === 'tile' ? 'tile positions' : anchor}`, () => {
    const result = compose(id, { title: 'Side by side', blocks });
    assert.equal(result.diagnostics.length, 0);
    const items = carded(result);
    assert.equal(items.length, blocks.length, 'every block is on a card');
    const cards = items.map((item) => item.frameBox);
    assert.equal(new Set(cards.map((card) => card.y)).size, 1, 'the cards share a top edge');
    assert.equal(new Set(cards.map((card) => card.height)).size, 1, 'the cards share a height');
    const body = bodyOf(result);
    // A filled card starts half a gap (12 px) under its region's top, clear of the heading, and reaches the region's foot.
    assert.ok(cards[0].y - body[0].y > -1 && cards[0].y - body[0].y < 13 && Math.abs(bottomOf(cards[0]) - bottomOf(body[0])) < 1, 'a card fills its region');
    for (const item of items) {
      const above = item.box.y - item.frameBox.y, below = bottomOf(item.frameBox) - bottomOf(item.box);
      if (anchor === 'bottom') assert.ok(above > below, `${item.path}: the content sits low in its card (${above} above, ${below} below)`);
      else if (anchor === 'tile') {
        const part = (role) => item.metricLayout.parts.find((entry) => entry.role === role);
        assert.ok(above > 0 && above <= 24 && below > 0 && below <= 24, `${item.path}: the tile fills its card inside the inset`);
        assert.ok(part('label').box.y < part('value').box.y, `${item.path}: the label is the eyebrow`);
        if (part('description')) assert.ok(Math.abs(bottomOf(part('description').box) - bottomOf(item.box)) < 1, `${item.path}: the description sits at the foot`);
      }
      else assert.ok(above > 24 && below > 24, `${item.path}: the content sits inside its card, clear of both edges`);
    }
  });
}

// LH-64: short body text set at the foot of a tall card reads as an empty card. The cards hug the tallest text, keep one height
// and the row centres in the body: in regions side by side (two and three columns) and in one grid (pillars), at 16:9 and 4:3.
for (const [id, blocks] of [
  ['three-column', [{ text: 'Test with two teams for six weeks.' }, { text: 'Keep the scope narrow and collect feedback weekly.' }, { text: 'Compare the results with the baseline.' }]],
  ['two-column', [{ text: 'Test with two teams for six weeks.' }, { text: 'Keep the scope narrow, collect feedback weekly and give each decision a named owner.' }]],
  ['pillars', [{ bullets: ['Two teams', 'Six weeks'] }, { text: 'Keep the scope narrow.' }, { items: ['Completion', 'Task time'] }]],
]) {
  for (const [width, height] of [[1280, 720], [960, 720]]) {
    test(`${id} at ${width} x ${height}: short body-text cards hug their text and the row centres`, () => {
      const result = compose(id, { title: 'Side by side', blocks }, { width, height });
      assert.equal(result.diagnostics.length, 0);
      const items = carded(result), cards = items.map((item) => item.frameBox), body = bodyOf(result);
      assert.equal(items.length, blocks.length, 'every block is on a card');
      assert.equal(new Set(cards.map((card) => card.y)).size, 1, 'the cards share a top edge');
      assert.equal(new Set(cards.map((card) => card.height)).size, 1, 'the cards share a height');
      assert.ok(cards[0].height < body[0].height * 0.45, `the cards hug their text (${cards[0].height} of ${body[0].height})`);
      const middle = (box) => box.y + box.height / 2;
      assert.ok(Math.abs(middle(cards[0]) - middle(body[0])) < 1, 'the row centres in the body');
      for (const item of items) assert.ok(item.box.y - item.frameBox.y < 25, `${item.path}: the text starts at the card's top`);
      // The tallest text has about as much room under it as above it.
      const tallest = items.reduce((best, item) => (textHeight(item) > textHeight(best) ? item : best));
      const under = bottomOf(tallest.frameBox) - tallest.box.y - textHeight(tallest), above = tallest.box.y - tallest.frameBox.y;
      assert.ok(under < above + 12, `no empty band under the tallest text (${above} above, ${under} under)`);
    });
  }
}

test('LH-64: rows of short body-text cards stack one gap apart, centred in the body', () => {
  const result = compose('pillars', { title: 'Six conditions', blocks: ['Scope', 'Measures', 'Owner', 'Baseline', 'Feedback', 'Decision'].map((text) => ({ text })) });
  assert.equal(result.diagnostics.length, 0);
  const cards = carded(result).map((item) => item.frameBox), body = bodyOf(result)[0];
  const rows = [...new Set(cards.map((card) => card.y))].sort((a, b) => a - b);
  assert.equal(rows.length, 2);
  assert.equal(new Set(cards.map((card) => card.height)).size, 1, 'one card height');
  assert.ok(Math.abs(rows[1] - rows[0] - cards[0].height - 24) < 1, 'one gap between the rows');
  const above = rows[0] - body.y, under = bottomOf(body) - rows[1] - cards[0].height;
  assert.ok(Math.abs(above - under) < 1, `the stack centres (${above} above, ${under} under)`);
});

test('LH-64: body-text cards of very unequal length fill the body and start their text at the top', () => {
  const result = compose('three-column', { title: 'Side by side', blocks: [{ text: `${long} ${long}` }, { text: 'Two teams.' }, { text: 'Six weeks.' }] });
  assert.equal(result.diagnostics.length, 0);
  const items = carded(result), body = bodyOf(result)[0];
  assert.equal(new Set(items.map((item) => item.frameBox.height)).size, 1, 'the cards share a height');
  assert.ok(Math.abs(bottomOf(items[0].frameBox) - bottomOf(body)) < 1, 'the cards fill the body');
  assert.equal(new Set(items.map((item) => item.box.y)).size, 1, 'the texts start on one line');
  for (const item of items) assert.ok(item.box.y - item.frameBox.y < 25, `${item.path}: at the card's top, not its foot`);
});

test('LH-64: a heading line on one card keeps the row at the foot of full-height cards', () => {
  const result = compose('pillars', { title: 'Side by side', blocks: [{ text: 'Two teams.' }, labelled('Scope', 'Six weeks.'), { text: 'One workflow.' }] });
  const items = carded(result), body = bodyOf(result)[0];
  for (const item of items) assert.ok(Math.abs(bottomOf(item.frameBox) - bottomOf(body)) < 1, `${item.path}: the card fills the body`);
  assert.ok(items.every((item) => item.box.y - item.frameBox.y > bottomOf(item.frameBox) - bottomOf(item.box)), 'the content sits low');
});

// LH-04: a top-anchored region drawn on cards (here a deck with contentBox) hugs its content instead of filling the cell, with
// one height per row, in a grid (process) and in regions side by side (comparison).
test('LH-04: top-anchored cards hug their content with one height per row', () => {
  const steps = compose('process', { title: 'Four steps', blocks: [{ text: 'Frame the decision.' }, { text: 'Collect the baseline and agree what counts as success.' }, { text: 'Run the pilot.' }, { text: 'Decide.' }] }, { contentBox: true });
  assert.equal(steps.diagnostics.length, 0);
  const cards = carded(steps).map((item) => item.frameBox), body = bodyOf(steps)[0];
  assert.equal(cards.length, 4);
  assert.equal(new Set(cards.map((card) => card.height)).size, 1, 'one height per row');
  assert.ok(cards[0].height < body.height / 2, `the cards hug (${cards[0].height} of ${body.height})`);
  assert.ok(cards[0].y - body.y < 13, 'from the top of the body');
  const options = compose('comparison', { title: 'Two options', blocks: [{ region: 'first', text: 'Option A: a focused pilot.' }, { region: 'second', text: 'Option B: a broad rollout with every team at once, starting next quarter.' }] }, { contentBox: true });
  const sides = carded(options).map((item) => item.frameBox);
  assert.equal(sides.length, 2);
  assert.deepEqual([sides[0].y, sides[0].height], [sides[1].y, sides[1].height], 'the two options share a top edge and a height');
});

test('a row of full-height cards starts one and a half gaps under the title', () => {
  const result = compose('pillars', { title: 'Three conditions', blocks: [labelled('Scope', 'Two teams.')] });
  const title = result.items.find((item) => item.field === 'title');
  const card = result.items.find((item) => item.frameBox).frameBox;
  assert.ok(Math.abs(card.y - bottomOf(title.box) - 36) < 1, `${card.y - bottomOf(title.box)} px under the title`);
});

test('hero sets the picture full height beside the title, lead and support', () => {
  const picture = { src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', alt: 'A landscape' };
  const result = compose('hero', { title: 'One team. One outcome.', blocks: [{ text: 'Test with two teams for six weeks.' }, { image: picture }, { text: 'Keep the scope narrow.' }] });
  assert.equal(result.diagnostics.length, 0);
  const media = result.regions.find((region) => region.name === 'media');
  assert.ok(media.bleed, 'the picture region bleeds');
  assert.deepEqual([media.box.y, media.box.y + media.box.height, media.box.x + media.box.width], [0, 720, 1280], 'it reaches the top, bottom and right edges');
  const title = result.items.find((item) => item.field === 'title'), lead = result.items.find((item) => item.region === 'lead');
  assert.ok(title.box.x + title.box.width <= media.box.x, 'the title stays in the text column');
  assert.ok(lead.box.y > title.box.y, 'the lead follows the title');
});

test('a scorecard of nine long measures fits every metric: a metric with no room inside its card inset takes the whole card', () => {
  const measure = 'Shift the library from stacks-first to research-services-first before the next budget cycle';
  const blocks = Array.from({ length: 9 }, (_, index) => ({ metric: { value: `$${index + 1}.8M`, label: `Signal ${index + 1}`, description: measure, trend: 'up' } }));
  const result = compose('scorecard', { title: 'Nine measures', blocks });
  for (const item of result.items.filter((entry) => entry.field === 'metric')) {
    assert.ok(item.frameBox, `${item.path} is on a card`);
    assert.ok(item.metricLayout.parts.every((part) => part.fit), `${item.path} lays out every part`);
  }
});
