// Layout harvest wave 6: the rules where two wave 6 features meet and the integration decided, left to right and right to left.
import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';

const { layouts } = gallery;
const metrics = (result) => result.items.filter((item) => item.metricLayout);
const near = (a, b) => Math.abs(a - b) < 0.5;
// Narrative n20: three tiers, the second marked "most popular" in its description.
const tiers = (marked = 1) => ({
  title: 'Plans for teams of every size',
  blocks: [
    ['$12', 'Starter', 'per user, per month', ['Up to 10 users', '5 GB shared storage', 'Email support', 'Core reports']],
    ['$29', 'Team', 'per user, per month', ['Unlimited users', '1 TB shared storage', 'Chat support in 4 hours', 'Custom dashboards', 'Single sign-on']],
    ['Custom', 'Enterprise', 'annual contract', ['Dedicated success manager', '99.99% uptime commitment', 'Audit logs and data residency']],
  ].map(([value, label, description, bullets], index) => ({
    region: ['first', 'second', 'third'][index],
    composition: { mode: 'column' },
    blocks: [{ metric: { value, label, description: index === marked ? `${description} (most popular)` : description } }, { bullets }],
  })),
});

for (const direction of ['ltr', 'rtl']) {
  test(`wave 6 (${direction}): LH-135's tier cards and LH-131's featured tier draw equal cards, the featured one on the emphasis surface`, () => {
    const result = composeSlide(tiers(), { layout: layouts['three-column'], direction });
    assert.equal(result.emphasis?.source, 'featured', 'the "most popular" tier is on the surface');
    assert.ok(metrics(result).every((item) => item.metricLayout.eyebrow), 'every tier name is its price\'s eyebrow');
    const cards = [0, 1, 2].map((index) => {
      const own = result.items.filter((item) => item.path.startsWith(`slides.0.blocks.${index}.`));
      return index === 1 ? (assert.ok(own.every((item) => item.emphasis && !item.frameBox), 'the featured tier draws no plain card'), result.emphasis.box) : own[0].frameBox;
    });
    assert.ok(cards.every(Boolean), 'each tier has its card');
    for (const card of cards) assert.ok(near(card.y, cards[0].y) && near(card.height, cards[0].height) && near(card.width, cards[0].width), 'one top edge, one height and one width');
    // Each tier's blocks sit inside its card at the same inset.
    const insets = [0, 1, 2].map((index) => result.items.find((item) => item.path === `slides.0.blocks.${index}.blocks.0.metric`).box.x - cards[index].x);
    assert.ok(insets.every((inset) => near(inset, insets[0])), 'the same inset in every card');
    assert.deepEqual(result.diagnostics.filter((entry) => entry.code === 'text-overflow'), []);
  });

  test(`wave 6 (${direction}): a group headed by a label (LH-152) is no pricing tier (LH-135), so its label is drawn`, () => {
    const slide = tiers(-1);
    // Automatic composition, groups with no region or composition of their own: LH-152 heads each group with its label (it takes no
    // eyebrows in a layout's regions or an explicit arrangement); the same tiers without labels are tier cards there too.
    const strip = ({ composition: _composition, region: _region, ...group }) => group;
    const bare = { ...slide, design: { contentBox: true }, blocks: slide.blocks.map(strip) };
    assert.ok(metrics(composeSlide(bare, { direction })).every((item) => item.metricLayout.eyebrow), 'without labels: tier cards');
    slide.blocks = bare.blocks.map((group, index) => ({ ...group, blocks: [{ text: ['Basic', 'Plus', 'Max'][index] }, ...group.blocks] }));
    const result = composeSlide(slide, { direction });
    const eyebrows = result.items.filter((item) => item.eyebrow).map((item) => item.value);
    assert.deepEqual(eyebrows, ['Basic', 'Plus', 'Max'], 'every group label is drawn as its eyebrow');
    assert.ok(metrics(result).every((item) => !item.metricLayout.eyebrow), 'no tier card took the group');
  });

  test(`wave 6 (${direction}): a group eyebrow (LH-152) on a featured set's cell card (LH-131) sits inside that card`, () => {
    const result = composeSlide({ title: 'Choose the rollout pace', blocks: [
      { blocks: [{ text: 'Conservative' }, { metric: { value: '1 team', label: 'Added per month' } }, { text: 'Lowest support load. Slower learning.' }] },
      { blocks: [{ text: 'Recommended' }, { metric: { value: '2 teams', label: 'Added per month' } }, { text: 'Balances support capacity with pace.' }] }] }, { direction });
    assert.equal(result.emphasis?.source, 'featured');
    const plain = result.items.find((item) => item.eyebrow && item.value === 'Conservative'), featured = result.items.find((item) => item.eyebrow && item.value === 'Recommended');
    const card = plain.frameBox, surface = result.emphasis.box;
    assert.ok(card, 'the plain cell\'s eyebrow shares its cell card');
    assert.ok(featured.emphasis && !featured.frameBox, 'the featured cell\'s eyebrow is on the surface');
    for (const [eyebrow, box] of [[plain, card], [featured, surface]]) {
      assert.ok(eyebrow.box.y >= box.y - 0.5 && eyebrow.box.x >= box.x - 0.5 && eyebrow.box.x + eyebrow.box.width <= box.x + box.width + 0.5, 'inside its card');
    }
  });

  test(`wave 6 (${direction}): LH-144's page cap leaves headings alone (LH-129, LH-130) and caps LH-133's spread rows`, () => {
    const section = { tag: 'Part 1', title: 'Where we stand', subtitle: 'Results from the first nine months', composition: { maxFontSize: 24 } };
    const capped = composeSlide(section, { layout: layouts.section, direction }), free = composeSlide({ ...section, composition: {} }, { layout: layouts.section, direction });
    for (const field of ['title', 'subtitle', 'tag']) assert.equal(capped.items.find((item) => item.field === field).text.fontSize, free.items.find((item) => item.field === field).text.fontSize, `${field} is not capped`);
    const questions = [
      { text: 'How long does setup take?', description: 'About a week for most teams.' },
      { text: 'Can we keep our data?', description: 'Yes, export it at any time.' },
      { text: 'Who supports us?', description: 'A named engineer for the first quarter.' },
    ];
    const rows = composeSlide({ title: 'Questions', composition: { maxFontSize: 24 }, blocks: [{ items: questions }] }, { direction });
    const list = rows.items.find((item) => item.field === 'items');
    assert.equal(list.text.fontSize, 24, 'the rows are set at the cap');
    assert.equal(list.text.rules?.length, questions.length - 1, 'still ruled rows');
  });

  test(`wave 6 (${direction}): LH-141 groups a numeric delta (LH-137's pill) as it groups the value`, () => {
    for (const [language, value, delta] of [['en-US', '12,480', '1,250'], ['de-DE', '12.480', '1.250']]) {
      const result = composeSlide({ title: 'Orders', blocks: [{ metric: { value: 12480, label: 'Orders this week', delta: 1250, trend: 'up' } }, { metric: { value: 9800, label: 'Orders last week', delta: -340, trend: 'down' } }] }, { direction, presentation: { language } });
      const [first] = metrics(result), text = (role) => first.metricLayout.parts.find((part) => part.role === role).text;
      assert.equal(text('value'), value, language);
      assert.equal(text('delta'), delta, language);
    }
  });
}
