// LH-48 as its burndown row is written ("any body under half full grows"): a body of two or more bare metrics grows value and label
// together, keeping their ratio; and a table with the one note under it leaves no empty band between them (the note follows the table
// and the pair sits in the middle of the body; a pair under half full also grows).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { composeSlide } from '../dist/composition.js';
import { resolveSlideContext } from '../dist/index.js';

const compose = (slide) => {
  const document = { $schema: 'https://openpresentation.org/schema/opf/v1', language: 'en-US', design: { theme: 'bold', colorScheme: 'forest-green', fontScheme: 'georgia' }, slides: [slide] };
  const context = resolveSlideContext(document, 0, { catalogs: [gallery] });
  return composeSlide(context.slide, context.options);
};
const role = (item, name) => item.metricLayout.parts.find((part) => part.role === name).fit.fontSize;
const metrics = [{ metric: { value: '11', label: 'Farms under contract' } }, { metric: { value: '$640K', label: 'Annualized revenue' } }, { metric: { value: '9 of 11', label: 'Farms renewed' } }];
const rows = [['Food', '210', '14,000', '$900'], ['Fertilizer', '340', '31,000', '$310'], ['Bioplastics', '120', '48,000', '$220'], ['Carbon credits', '60', '9,000', '$400']];
const table = { columns: ['Buyer', 'Farms', 'Tons', 'Price'], rows };

test('a body of three metrics under half full grows value and label in proportion', () => {
  for (const slide of [{ layout: 'metrics', title: 'Three figures', blocks: metrics }, { title: 'Three figures', blocks: metrics }]) {
    const items = compose(slide).items.filter((item) => item.field === 'metric');
    for (const item of items) {
      assert.ok(role(item, 'value') > 76 + 1, `the value grows past its 76 px role size: ${role(item, 'value')}`);
      assert.ok(role(item, 'label') > 23 + 1, `the label grows past its 23 px role size: ${role(item, 'label')}`);
      assert.ok(Math.abs(role(item, 'label') / role(item, 'value') - 23 / 76) < 0.02, 'value and label keep their ratio');
    }
    assert.equal(new Set(items.map((item) => role(item, 'value'))).size, 1, 'one value size');
  }
});

test('metrics with a note on the band keep their sizes', () => {
  const items = compose({ layout: 'metrics', title: 'Three figures', blocks: [...metrics, { text: 'These are the first three months.' }] }).items.filter((item) => item.field === 'metric');
  for (const item of items) assert.ok(role(item, 'value') <= 76 + 1e-6 || item.metricLayout.display, 'no growth beside a band note');
});

test('a table with a note under it: the note follows the table and the pair sits in the middle', () => {
  for (const slide of [{ layout: 'table', title: 'Table with a note', blocks: [{ table }, { text: 'One rover serves all four buyers, so every ton cut adds to the same fleet.' }] }, { layout: 'table', title: 'Table with a note', blocks: [{ table: { ...table, rows: [...rows, ['Total', '730', '102,000', '']] } }, { text: 'One rover serves all four buyers, so every ton cut adds to the same fleet.' }] }]) {
    const composed = compose(slide);
    const placed = composed.items.find((item) => item.field === 'table'), note = composed.items.find((item) => item.field === 'text');
    const gapUnder = note.box.y - (placed.box.y + placed.box.height);
    assert.ok(gapUnder >= 0 && gapUnder <= 45, `the note follows the table: ${gapUnder}`);
    const title = composed.items.find((item) => item.field === 'title'), top = title.box.y + title.box.height, bottom = composed.contentBox.y + composed.contentBox.height;
    const above = placed.box.y - top, below = bottom - (note.box.y + note.box.height);
    assert.ok(above > 40 && below > 40, `the pair is not pinned to the top or the foot: ${above}, ${below}`);
    assert.equal(composed.diagnostics.filter((entry) => entry.code === 'text-overflow').length, 0);
  }
});
