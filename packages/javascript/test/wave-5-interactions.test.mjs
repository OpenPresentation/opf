// Layout harvest wave 5: the rules where two wave 5 features meet, left to right and right to left.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide, EYEBROW_TAG_SIZE, HEADING_DISPLAY_SIZES } from '../dist/composition.js';
import { layouts } from './support/template-samples.mjs';

const { agenda, section } = layouts;
// The same record without its sequence key: what the slide draws without LH-07.
const plain = (record) => ({ ...record, regions: record.regions.map(({ sequence: _sequence, ...region }) => region) });
// Short labels, each with a description: LH-08 rules such a list automatically.
const labeled = [
  { text: 'Where we stand', description: 'Results from the first nine months' },
  { text: 'What changed', description: 'The drivers behind the numbers' },
  { text: 'The 2027 plan', description: 'Three bets and their budgets' },
  { text: 'Decisions', description: 'What we need from the board today' },
];
const list = (result) => result.items.find((item) => item.field === 'items');
const field = (result, name) => result.items.find((item) => item.field === name);

for (const direction of ['ltr', 'rtl']) {
  test(`wave 5 (${direction}): a list in a sequence region keeps LH-07's badges and takes no LH-08 rows`, () => {
    const slide = { title: 'Today’s agenda', blocks: [{ items: labeled }] };
    const result = composeSlide(slide, { layout: agenda, direction });
    const fit = list(result).text;
    assert.ok(fit.listEntries.every((entry) => entry.badge), 'every entry beside its badge');
    assert.equal(fit.rules, undefined, 'no hairlines');
    // Without the sequence the same list is ruled, as LH-08 rules a list of short labels with descriptions.
    const ruled = list(composeSlide(slide, { layout: plain(agenda), direction })).text;
    assert.equal(ruled.rules?.length, labeled.length - 1);
    assert.ok(ruled.listEntries.every((entry) => !entry.badge));
  });

  test(`wave 5 (${direction}): LH-129 grows a section's title and subtitle and keeps LH-32's 22 px tag`, () => {
    const slide = { tag: 'Part 1', title: 'Where we stand', subtitle: 'Results from the first nine months of 2026' };
    const result = composeSlide(slide, { layout: section, direction }), kept = composeSlide(slide, { layout: section, direction, fill: false });
    assert.equal(HEADING_DISPLAY_SIZES.tag, EYEBROW_TAG_SIZE);
    assert.equal(field(result, 'tag').text.fontSize, EYEBROW_TAG_SIZE);
    assert.equal(field(kept, 'tag').text.fontSize, EYEBROW_TAG_SIZE);
    assert.ok(field(result, 'title').text.fontSize > field(kept, 'title').text.fontSize);
    assert.ok(field(result, 'subtitle').text.fontSize > field(kept, 'subtitle').text.fontSize);
  });
}

test('wave 5: the automatic scrim covers the slide LH-07 keeps, over the grown text', () => {
  const picture = { background: { type: 'image', src: 'https://example.com/photo.jpg' } };
  const slide = { title: 'Today’s agenda', design: picture, blocks: [{ items: labeled }] };
  const result = composeSlide(slide, { layout: agenda });
  const scrims = result.backgroundImage?.scrims ?? [];
  assert.ok(scrims.length > 0, 'a scrim');
  const entries = list(result).text.listEntries;
  assert.ok(entries.every((entry) => entry.badge), 'the badges are kept');
  const top = Math.min(...entries.map((entry) => entry.textBox.y)), bottom = Math.max(...entries.map((entry) => (entry.descriptionBox ?? entry.textBox).y + (entry.descriptionBox ?? entry.textBox).height));
  assert.ok(scrims.some((scrim) => scrim.box.y <= top + 0.5 && scrim.box.y + scrim.box.height >= bottom - 0.5), 'the list lies under a scrim');
});
