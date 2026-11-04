// LH-131 and LH-137: the featured card of a pair or a set, a before and after pair's arrow, the delta pill and the check-mark tiles.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkMarkPoints, composeSlide, featuredCells, layoutMetric } from '../dist/composition.js';
import { layouts } from './support/template-samples.mjs';

const group = (label, ...rest) => ({ blocks: [{ text: [{ text: label, bold: true }] }, ...rest] });
const metric = (value, extra = {}) => ({ metric: { value, label: 'Quote to contract', ...extra } });
const after = { delta: '-8 days', trend: 'down', sentiment: 'positive' };
const beforeAfter = (first = 'Before', second = 'After') => ({
  title: 'Contract turnaround',
  blocks: [{ region: 'first', ...group(first, metric('11 days')) }, { region: 'second', ...group(second, metric('3 days', after)) }],
});

test('featuredCells: a pair names its second side, in any order and in other languages', () => {
  const cells = (labels) => labels.map((label) => group(label, { text: 'Some longer text that describes this side.' }));
  assert.deepEqual(featuredCells(cells(['The problem', 'The solution'])), { kind: 'problem-solution', featured: 1, cells: [0, 1] });
  assert.deepEqual(featuredCells(cells(['After', 'Before'])), { kind: 'before-after', featured: 0, cells: [0, 1] });
  assert.equal(featuredCells(cells(['Vorher', 'Nachher']))?.featured, 1);
  assert.equal(featuredCells(cells(['Das Problem', 'Die Lösung']))?.featured, 1);
  assert.equal(featuredCells(cells(['قبل', 'بعد']))?.featured, 1);
  assert.equal(featuredCells(cells(['المشكلة', 'الحل']))?.featured, 1);
  assert.equal(featuredCells(cells(['導入前', '導入後']))?.featured, 1);
  // Two labels of one side, unrelated labels and a long sentence name no pair.
  assert.equal(featuredCells(cells(['Before', 'Before launch'])), undefined);
  assert.equal(featuredCells(cells(['North', 'South'])), undefined);
  assert.equal(featuredCells(cells(['What happened before we started the program', 'After'])), undefined);
});

test('featuredCells: a set has one marked tier; list entries are not marks', () => {
  const tier = (name, note, features = ['A', 'B']) => group(name, metric('$9', { description: note }), { bullets: features });
  assert.equal(featuredCells([tier('Starter', 'per month'), tier('Team', 'per month (most popular)'), tier('Enterprise', 'annual')]).featured, 1);
  assert.equal(featuredCells([tier('Basic', 'per month'), tier('Pro', 'おすすめ')]).featured, 1);
  // Two marked tiers, or a mark only in a feature list, feature none.
  assert.equal(featuredCells([tier('A', 'recommended'), tier('B', 'most popular')]), undefined);
  assert.equal(featuredCells([tier('A', 'per month', ['Recommended by teams']), tier('B', 'per month')]), undefined);
  // Cells of mixed kinds are no set.
  assert.equal(featuredCells([tier('A', 'per month'), metric('$9', { description: 'recommended' })]), undefined);
});

for (const direction of ['ltr', 'rtl']) {
  test(`LH-131 (${direction}): "after" takes the emphasis surface, "before" a plain card, and an arrow points from one to the other`, () => {
    const result = composeSlide(beforeAfter(), { layout: layouts.comparison, direction });
    assert.equal(result.emphasis?.source, 'featured');
    assert.equal(result.emphasis.path, 'slides.0.blocks.1');
    const first = result.items.filter((item) => item.path.startsWith('slides.0.blocks.0.'));
    const card = first[0].frameBox;
    assert.ok(card && first.every((item) => item.frameBox === card || JSON.stringify(item.frameBox) === JSON.stringify(card)), 'the before cell shares one card');
    assert.ok(result.items.filter((item) => item.path.startsWith('slides.0.blocks.1.')).every((item) => item.emphasis && !item.frameBox));
    const arrow = result.emphasis.arrow, surface = result.emphasis.box;
    assert.ok(arrow, 'an arrow between the cards');
    assert.equal(arrow.direction, direction === 'rtl' ? 'left' : 'right');
    const [left, right] = direction === 'rtl' ? [surface, card] : [card, surface];
    assert.ok(arrow.box.x >= left.x + left.width - 0.5 && arrow.box.x + arrow.box.width <= right.x + 0.5, 'the arrow sits in the room between the cards');
    // No block reads smaller than without the rule (a value at display size reads at its 76 px role size, as the guard reads it).
    const plain = composeSlide({ ...beforeAfter(), blocks: beforeAfter().blocks.map((block, index) => (index === 1 ? { ...block, emphasis: false } : block)) }, { layout: layouts.comparison, direction });
    assert.equal(plain.emphasis, undefined);
    const sizes = (composed) => composed.items.filter((item) => item.metricLayout).flatMap((item) => item.metricLayout.parts.filter((part) => part.visible && part.fit).map((part) => [`${item.path}:${part.role}`, part.role === 'value' && item.metricLayout.display ? Math.min(part.fit.fontSize, 76) : part.fit.fontSize]));
    const before = new Map(sizes(plain));
    for (const [key, size] of sizes(result)) assert.ok(size >= before.get(key) - 1e-6, key);
  });
}

test('LH-131: an authored emphasis always wins', () => {
  const slide = beforeAfter();
  slide.blocks[0].emphasis = true;
  const result = composeSlide(slide, { layout: layouts.comparison });
  assert.equal(result.emphasis.source, 'authored');
  assert.equal(result.emphasis.path, 'slides.0.blocks.0');
  assert.equal(result.emphasis.arrow, undefined);
});

test('LH-137: a delta draws as a pill beside its value, or above it, and keeps every size', () => {
  const value = { value: '3 days', label: 'From quote to signed contract', delta: '-8 days', trend: 'down' };
  const box = { x: 0, y: 0, width: 560, height: 220 };
  const plain = layoutMetric(value, box, { align: 'left' }), pilled = layoutMetric(value, box, { align: 'left', deltaPill: true });
  assert.equal(pilled.deltaPill?.placement, 'beside');
  const part = (layout, role) => layout.parts.find((entry) => entry.role === role);
  for (const role of ['value', 'label', 'delta']) assert.ok(part(pilled, role).fit.fontSize >= part(plain, role).fit.fontSize - 1e-6, role);
  const pill = pilled.deltaPill.box, delta = part(pilled, 'delta').box;
  assert.ok(pill.x <= pilled.trendBox.x && pill.x + pill.width >= delta.x + delta.width, 'the pill holds the arrow and the delta');
  assert.ok(pill.x > part(pilled, 'value').box.x + part(pilled, 'value').box.width, 'after the value');
  assert.equal(pilled.deltaPill.radius, pill.height / 2);
  // A narrow cell has no room beside the value: the pill goes above it.
  const narrow = layoutMetric({ ...value, value: '$12.4M' }, { x: 0, y: 0, width: 260, height: 260 }, { deltaPill: true });
  assert.equal(narrow.deltaPill?.placement, 'above');
  assert.ok(narrow.deltaPill.box.y + narrow.deltaPill.box.height <= part(narrow, 'value').box.y + 1e-6);
  // A tile keeps its delta in place.
  assert.equal(layoutMetric(value, box, { align: 'left', tile: true, deltaPill: true }).deltaPill, undefined);
});

for (const direction of ['ltr', 'rtl']) {
  test(`LH-137 (${direction}): a dark summary list draws as check-marked tiles; a light one keeps its bullets`, () => {
    const slide = { title: 'What we decided today', design: { variant: 'dark1' }, blocks: [{ bullets: ['Approve the expansion budget', 'Launch the pilot in March', 'Hire a program lead by January', 'Review progress in June'] }] };
    const dark = composeSlide(slide, { darkBackground: true, direction }), light = composeSlide(slide, { direction });
    const tiles = dark.steps?.find((step) => step.form === 'tiles');
    assert.ok(tiles, 'tiles on the dark slide');
    assert.equal(tiles.chips.length, 4);
    assert.ok(tiles.badges.every((badge) => badge.check?.length === 6 && badge.label === ''));
    const list = (composed) => composed.items.find((item) => item.field === 'bullets');
    assert.equal(list(dark).listColumns.length, 4);
    assert.equal(list(dark).text.fontSize, list(light).text.fontSize, 'the entries keep the list size');
    // Each badge sits at its tile's reading start.
    for (const [index, badge] of tiles.badges.entries()) {
      const chip = tiles.chips[index].box, middle = chip.x + chip.width / 2;
      assert.ok(direction === 'rtl' ? badge.cx > middle : badge.cx < middle);
    }
    assert.equal(light.steps?.find((step) => step.form === 'tiles'), undefined);
  });
}

test('LH-137: checkMarkPoints stays inside its badge', () => {
  const points = checkMarkPoints(100, 50, 40);
  assert.equal(points.length, 6);
  for (const [x, y] of points) assert.ok(Math.hypot(x - 100, y - 50) < 20, `${x},${y}`);
});
