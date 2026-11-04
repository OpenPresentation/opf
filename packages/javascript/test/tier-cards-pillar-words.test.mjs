// LH-135 and LH-136: pricing tiers as one equal card each (the tier name as an eyebrow, the price at display size), and pillars whose titles are
// one word as the word at display size over an accent rule, without a card.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide, EYEBROW_TAG_SIZE, LIST_DISPLAY_SCALE, METRIC_ROLE_VALUE_SIZE } from '../dist/composition.js';
import { layouts } from './support/template-samples.mjs';

const tier = (label, value, description, bullets, extra = {}) => ({ composition: { mode: 'column' }, blocks: [{ metric: { value, label, description } }, { bullets }], ...extra });
const tiers = [
  tier('Starter', '$12', 'per user, per month', ['Up to 10 users', '5 GB shared storage', 'Email support', 'Core reports']),
  tier('Team', '$29', 'per user, per month', ['Unlimited users', '1 TB shared storage', 'Single sign-on']),
  tier('Enterprise', 'Custom', 'annual contract', ['Dedicated success manager', 'Audit logs', 'Roadmap input']),
];
const inRegions = (blocks) => blocks.map((block, index) => ({ ...block, region: ['first', 'second', 'third'][index] }));
const pillars = (blocks) => blocks.map((block) => ({ ...block, region: 'pillars' }));
const three = (blocks = tiers) => composeSlide({ title: 'Plans', blocks: inRegions(blocks) }, { layout: layouts['three-column'] });
const metrics = (result) => result.items.filter((item) => item.metricLayout);
const part = (item, role) => item.metricLayout.parts.find((entry) => entry.role === role);
const sameBox = (a, b) => ['x', 'y', 'width', 'height'].every((key) => Math.abs(a[key] - b[key]) < 0.01);
const findings = (result) => result.diagnostics.filter((entry) => entry.code === 'text-overflow' || entry.code === 'small-cell');

for (const direction of ['ltr', 'rtl']) {
  test(`LH-135 (${direction}): each pricing tier is one card of equal height with its content from the top`, () => {
    const result = composeSlide({ title: 'Plans', blocks: inRegions(tiers) }, { layout: layouts['three-column'], direction });
    assert.deepEqual(findings(result), []);
    const frames = tiers.map((_, index) => {
      const own = result.items.filter((item) => item.path.startsWith(`slides.0.blocks.${index}.`));
      assert.equal(own.length, 2, 'the tier draws a metric and a list');
      assert.ok(own.every((item) => item.frameBox && sameBox(item.frameBox, own[0].frameBox)), 'the tier shares one card');
      return own[0].frameBox;
    });
    assert.ok(frames.every((frame) => Math.abs(frame.y - frames[0].y) < 0.01 && Math.abs(frame.height - frames[0].height) < 0.01), 'one top edge, one height');
    // The cards stand side by side in the regions' order (mirrored on a right-to-left slide).
    const xs = frames.map((frame) => frame.x);
    assert.deepEqual([...xs].sort((a, b) => (direction === 'rtl' ? b - a : a - b)), xs);
    for (const item of metrics(result)) {
      const tops = [part(item, 'label'), part(item, 'value'), part(item, 'description')].map((entry) => entry.box.y);
      assert.deepEqual([...tops].sort((a, b) => a - b), tops, 'label, value, description from the top');
      assert.equal(part(item, 'label').fit.fontSize, EYEBROW_TAG_SIZE, 'the label is the eyebrow');
    }
  });
}

test('LH-135: the label is the metric eyebrow: bold capitals with tracking, flagged for the engines', () => {
  const [first] = metrics(three());
  assert.equal(first.metricLayout.eyebrow, true);
  const label = part(first, 'label');
  assert.equal(label.style.caps, true);
  assert.ok(label.style.tracking > 0);
  assert.equal(label.style.fontWeight, 700);
  assert.equal(label.fit.fontSize, EYEBROW_TAG_SIZE);
  assert.equal(first.metricLayout.alignment, 'left');
  // A deck without cards, or a metric outside a tier, keeps its label as before.
  const alone = composeSlide({ title: 'One', blocks: [{ metric: { value: '$12', label: 'Starter' } }] }, { layout: layouts['three-column'] });
  assert.equal(metrics(alone)[0].metricLayout.eyebrow, undefined);
});

test('LH-135: a price at display size, on one line: a figure or a word never splits', () => {
  const result = three();
  const sizes = metrics(result).map((item) => part(item, 'value').fit.fontSize);
  assert.ok(sizes.every((size) => size >= METRIC_ROLE_VALUE_SIZE * (result.width / 1280) - 0.01), 'no price below its role size');
  for (const item of metrics(result)) assert.equal(part(item, 'value').fit.sourceLines.length, 1, `${part(item, 'value').text} on one line`);
});

test('LH-135: four tiers on the pillars layout stand in one row of equal cards', () => {
  const four = ['Free:$0', 'Plus:$9', 'Pro:$24', 'Scale:$79'].map((entry) => tier(entry.split(':')[0], entry.split(':')[1], 'per month', ['1 site', '1 GB storage']));
  const result = composeSlide({ title: 'Plans', blocks: pillars(four) }, { layout: layouts.pillars });
  assert.deepEqual(findings(result), []);
  const frames = four.map((_, index) => result.items.find((item) => item.path.startsWith(`slides.0.blocks.${index}.`)).frameBox);
  assert.ok(frames.every((frame) => Math.abs(frame.y - frames[0].y) < 0.01 && Math.abs(frame.height - frames[0].height) < 0.01), 'one row');
  assert.ok(frames.every((frame, index) => index === 0 || frame.x > frames[index - 1].x), 'left to right');
});

test('LH-135: the size guard keeps the plain cards where a wide price would read smaller in the narrower tier cards', () => {
  const wide = ['Free:$0', 'Plus:$9', 'Pro:$24', 'Scale:$1,200/mo'].map((entry) => tier(entry.split(':')[0], entry.split(':')[1], 'per month', ['1 site', '1 GB storage']));
  const result = composeSlide({ title: 'Plans', blocks: pillars(wide) }, { layout: layouts.pillars });
  assert.equal(metrics(result).some((item) => item.metricLayout.eyebrow), false, 'the two cards per tier stand');
});

test('LH-135: only a set of 2 to 5 labeled tiers is drawn as cards', () => {
  const cardsOf = (result) => new Set(result.items.filter((item) => item.frameBox).map((item) => `${item.frameBox.x},${item.frameBox.y}`)).size;
  const own = (result) => result.items.filter((item) => item.field !== 'title');
  // A group without a label keeps a card for each of its blocks.
  const unlabeled = [tier(undefined, '$12', 'per month', ['A', 'B']), tier(undefined, '$29', 'per month', ['C', 'D'])].map((block) => { delete block.blocks[0].metric.label; return block; });
  const plain = composeSlide({ title: 'Plans', blocks: inRegions(unlabeled) }, { layout: layouts['three-column'] });
  assert.equal(cardsOf(plain), own(plain).length, 'one card per block');
  // Six tiers are not a comparison.
  const many = Array.from({ length: 6 }, (_, index) => tier(`Tier ${index + 1}`, `$${index + 1}`, 'per month', ['A', 'B']));
  const six = composeSlide({ title: 'Plans', blocks: pillars(many) }, { layout: layouts.pillars });
  assert.equal(metrics(six).some((item) => item.metricLayout.eyebrow), false);
});

test('LH-135: a tier with emphasis keeps LH-06 surface; the other tiers stay cards', () => {
  const marked = [tiers[0], { ...tiers[1], emphasis: true }, tiers[2]];
  const result = composeSlide({ title: 'Plans', blocks: inRegions(marked) }, { layout: layouts['three-column'] });
  assert.ok(result.emphasis, 'one emphasis surface');
  assert.ok(result.items.filter((item) => item.path.startsWith('slides.0.blocks.1.')).every((item) => item.emphasis));
  assert.ok(result.items.filter((item) => item.path.startsWith('slides.0.blocks.0.')).every((item) => item.frameBox && !item.emphasis));
});

// LH-136
const word = (title, description) => ({ items: [{ text: title, description }] });
const promises = [word('Fast', 'Support answers in under four minutes during business hours.'), word('Fair', 'No overage fees. You pay one flat rate per user.'), word('Local', 'Engineers in your time zone from the first day.')];
const listOf = (result, index) => result.items.find((item) => item.path.startsWith(`slides.0.blocks.${index}.`));

test('LH-136: one-word pillar titles are display words over an accent rule, with no card', () => {
  const result = composeSlide({ title: 'Three promises', blocks: pillars(promises) }, { layout: layouts.pillars });
  assert.deepEqual(findings(result), []);
  for (const [index] of promises.entries()) {
    const item = listOf(result, index), fit = item.text, [entry] = fit.listEntries;
    assert.equal(item.frameBox, undefined, 'no card');
    assert.equal(fit.rules?.length, 1);
    const [rule] = fit.rules;
    assert.equal(rule.accent, true);
    assert.ok(rule.thickness > 2, 'a rule, not a hairline');
    assert.ok(rule.y < entry.textBox.y, 'the rule is over the word');
    assert.ok(entry.text.richLines.length === 1, 'the word on one line');
    assert.ok(entry.text.fontSize >= fit.fontSize * LIST_DISPLAY_SCALE * 0.95 || entry.text.fontSize > fit.fontSize * 2, 'display size');
    assert.ok(entry.description.richLines.length >= 1);
  }
  // Every rule sits at one height and every word at one size.
  const rules = promises.map((_, index) => listOf(result, index).text.rules[0].y), words = promises.map((_, index) => listOf(result, index).text.listEntries[0].text.fontSize);
  assert.ok(rules.every((y) => Math.abs(y - rules[0]) < 0.01));
  assert.ok(words.every((size) => Math.abs(size - words[0]) < 0.01));
});

test('LH-136: pillars whose titles are not each one word keep their cards', () => {
  const mixed = [word('Fast', 'One.'), word('Fair pricing', 'Two.'), word('Local', 'Three.')];
  const result = composeSlide({ title: 'Promises', blocks: pillars(mixed) }, { layout: layouts.pillars });
  for (const [index] of mixed.entries()) {
    const item = listOf(result, index);
    assert.ok(item.frameBox, 'a card');
    assert.equal(item.text.rules, undefined);
  }
  const six = composeSlide({ title: 'Promises', blocks: pillars(Array.from({ length: 6 }, (_, index) => word(`Word${index}`, 'Detail.'))) }, { layout: layouts.pillars });
  assert.ok(listOf(six, 0).frameBox, 'six pillars keep their cards');
});

test('LH-136: a long word steps down to one line and the description is never smaller than without the display word', () => {
  const long = [word('Transparency', 'We publish every price.'), word('Reliability', 'Four nines, measured.'), word('Craft', 'Built by hand.')];
  const result = composeSlide({ title: 'Values', blocks: pillars(long) }, { layout: layouts.pillars });
  assert.deepEqual(findings(result), []);
  for (const [index] of long.entries()) {
    const entry = listOf(result, index).text.listEntries[0];
    assert.equal(entry.text.richLines.length, 1, 'the word is never split');
  }
  // The same pillars with a two-word title are the plain cards: the display words cost the descriptions no size.
  const plain = composeSlide({ title: 'Values', blocks: pillars(long.map((block, index) => word(`Core of ${index}`, block.items[0].description))) }, { layout: layouts.pillars });
  assert.ok(listOf(result, 0).text.fontSize >= listOf(plain, 0).text.fontSize - 0.01);
});
