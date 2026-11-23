// COL-2 (0.35.2): a table on a column's card grows (LH-48, TAB-1) with the text on the card beside it, instead of a thin band at its role size.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { composeSlide } from '../dist/composition.js';
import { resolveSlideContext } from '../dist/index.js';

const compose = (slide, extra = {}) => {
  const document = { $schema: 'https://openpresentation.org/schema/opf/v1', language: 'en-US', design: { background: 'light1' }, slides: [slide] };
  const context = resolveSlideContext(document, 0, { catalogs: [gallery] });
  return composeSlide(context.slide, { ...context.options, ...extra });
};
const table = { columns: ['Team', 'Participants', 'Completion'], rows: [['A', '28', '89%'], ['B', '24', '79%']] };

test('a two-column table beside a short text grows with it', () => {
  const slide = { layout: 'two-column', title: 'Columns', blocks: [{ table }, { text: 'Short text.' }] };
  const result = compose(slide), kept = compose(slide, { fill: false });
  const grown = result.items.find((item) => item.field === 'table'), text = result.items.find((item) => item.field === 'text');
  assert.equal(result.diagnostics.filter((entry) => entry.code === 'text-overflow').length, 0);
  assert.ok(grown.tableGrowth > 1, 'the table grew');
  assert.ok(text.text.fontSize >= kept.items.find((item) => item.field === 'text').text.fontSize, 'the text is not smaller');
});
