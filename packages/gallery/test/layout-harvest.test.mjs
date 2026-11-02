// The layout harvest (examples/technical/layout-sampler.opf.json compared with Claude Design): pillars, team and scorecard
// draw a centred row of equal cards, and hero sets a full-height picture beside its text column.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '@openpresentation/opf/composition';
import { gallery } from '../dist/index.js';

const compose = (id, slide) => composeSlide(slide, { width: 1280, height: 720, layout: gallery.layouts[id] });
const SUB = 'Illustrative example';
const labelled = (text, description) => ({ items: [{ text, description }] });

for (const [id, blocks] of [
  ['pillars', [labelled('Clear scope', 'Two teams and one workflow keep the pilot focused.'), labelled('Consistent measures', 'Track completion and task time against a baseline.'), labelled('An explicit decision', 'Agree the evidence needed before expanding the rollout to every team.')]],
  ['team', [labelled('Ana Ruiz', 'Pilot lead'), labelled('Sam Lee', 'Product lead. Turns participant feedback into product changes.'), labelled('Kai Moreau', 'Analytics lead')]],
  ['scorecard', [{ metric: { value: 52, label: 'Participants', description: 'Target: 50' } }, { metric: { value: '84%', label: 'Completion', description: 'Target: at least 80%' } }, { metric: { value: '6.2', unit: 'min', label: 'Median time' } }]],
]) {
  test(`${id} draws a centred row of equal cards`, () => {
    const result = compose(id, { title: 'Three in a row', subtitle: SUB, blocks });
    assert.equal(result.diagnostics.length, 0);
    const cards = result.items.filter((item) => item.frameBox).map((item) => item.frameBox);
    assert.equal(cards.length, 3, 'every block is on a card');
    assert.equal(new Set(cards.map((card) => card.y)).size, 1, 'the cards share a top edge');
    assert.equal(new Set(cards.map((card) => card.height)).size, 1, 'the cards share a height');
    const region = result.regions.find((entry) => entry.content.length).box;
    const above = cards[0].y - region.y, below = region.y + region.height - (cards[0].y + cards[0].height);
    assert.ok(above > 24 && Math.abs(above - below) <= 2, `the row is centred in its region (${above} above, ${below} below)`);
  });
}

test('hero sets the picture full height beside the title, lead and support', () => {
  const picture = { src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', alt: 'A landscape' };
  const result = compose('hero', { title: 'One team. One outcome.', subtitle: SUB, blocks: [{ text: 'Test with two teams for six weeks.' }, { image: picture }, { text: 'Keep the scope narrow.' }] });
  assert.equal(result.diagnostics.length, 0);
  const media = result.regions.find((region) => region.name === 'media');
  assert.ok(media.bleed, 'the picture region bleeds');
  assert.deepEqual([media.box.y, media.box.y + media.box.height, media.box.x + media.box.width], [0, 720, 1280], 'it reaches the top, bottom and right edges');
  const title = result.items.find((item) => item.field === 'title'), lead = result.items.find((item) => item.region === 'lead');
  assert.ok(title.box.x + title.box.width <= media.box.x, 'the title stays in the text column');
  assert.ok(lead.box.y > title.box.y, 'the lead follows the title');
});
