// The layout harvest (examples/technical/layout-sampler.opf.json compared with Claude Design): pillars, team, scorecard,
// two-column and three-column draw full-height cards with their content at the region's anchor, and hero sets a
// full-height picture beside its text column.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '@openpresentation/opf/composition';
import { gallery } from '../dist/index.js';

const compose = (id, slide) => composeSlide(slide, { width: 1280, height: 720, layout: gallery.layouts[id] });
const labelled = (text, description) => ({ items: [{ text, description }] });
const bottomOf = (box) => box.y + box.height;

for (const [id, anchor, blocks] of [
  ['pillars', 'bottom', [labelled('Clear scope', 'Two teams and one workflow keep the pilot focused.'), labelled('Consistent measures', 'Track completion and task time against a baseline.'), labelled('An explicit decision', 'Agree the evidence needed before expanding the rollout to every team.')]],
  ['team', 'bottom', [labelled('Ana Ruiz', 'Pilot lead'), labelled('Sam Lee', 'Product lead. Turns participant feedback into product changes.'), labelled('Kai Moreau', 'Analytics lead')]],
  ['scorecard', 'middle', [{ metric: { value: 52, label: 'Participants', description: 'Target: 50' } }, { metric: { value: '84%', label: 'Completion', description: 'Target: at least 80%' } }, { metric: { value: '6.2', unit: 'min', label: 'Median time' } }]],
  ['three-column', 'bottom', [{ text: 'Test with two teams for six weeks.' }, { text: 'Keep the scope narrow and collect feedback weekly.' }, { text: 'Compare the results with the baseline.' }]],
  ['two-column', 'bottom', [{ text: 'Test with two teams for six weeks.' }, { text: 'Keep the scope narrow, collect feedback weekly and give each decision a named owner.' }]],
]) {
  test(`${id} fills the body with equal cards and sets their content at the ${anchor}`, () => {
    const result = compose(id, { title: 'Side by side', blocks });
    assert.equal(result.diagnostics.length, 0);
    const items = result.items.filter((item) => item.frameBox);
    assert.equal(items.length, blocks.length, 'every block is on a card');
    const cards = items.map((item) => item.frameBox);
    assert.equal(new Set(cards.map((card) => card.y)).size, 1, 'the cards share a top edge');
    assert.equal(new Set(cards.map((card) => card.height)).size, 1, 'the cards share a height');
    const body = result.regions.filter((region) => region.content.length).map((region) => region.box);
    // A filled card starts half a gap (12 px) under its region's top, clear of the heading, and reaches the region's foot.
    assert.ok(cards[0].y - body[0].y > -1 && cards[0].y - body[0].y < 13 && Math.abs(bottomOf(cards[0]) - bottomOf(body[0])) < 1, 'a card fills its region');
    for (const item of items) {
      const above = item.box.y - item.frameBox.y, below = bottomOf(item.frameBox) - bottomOf(item.box);
      if (anchor === 'bottom') assert.ok(above > below, `${item.path}: the content sits low in its card (${above} above, ${below} below)`);
      else assert.ok(above > 24 && below > 24, `${item.path}: the content sits inside its card, clear of both edges`);
    }
  });
}

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
  const long = 'Shift the library from stacks-first to research-services-first before the next budget cycle';
  const blocks = Array.from({ length: 9 }, (_, index) => ({ metric: { value: `$${index + 1}.8M`, label: `Signal ${index + 1}`, description: long, trend: 'up' } }));
  const result = compose('scorecard', { title: 'Nine measures', blocks });
  for (const item of result.items.filter((entry) => entry.field === 'metric')) {
    assert.ok(item.frameBox, `${item.path} is on a card`);
    assert.ok(item.metricLayout.parts.every((part) => part.fit), `${item.path} lays out every part`);
  }
});
