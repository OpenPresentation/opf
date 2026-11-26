// COL-2 (0.35.2): a table on a column's card grows (LH-48, TAB-1) with the text on the card beside it, instead of a thin band at its role size.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { composeSlide, layoutTable } from '../dist/composition.js';
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

test('a four-column table in one of three columns takes the width it needs and keeps a readable size', () => {
  const wide = { columns: ['Team', 'Participants', 'Completion', 'Median time (min)'], rows: [['A', '28', '89%', '5.8'], ['B', '24', '79%', '6.7']] };
  const slide = { layout: 'three-column', title: 'Columns', blocks: [{ region: 'first', table: wide }, { region: 'second', text: 'Short text.' }, { region: 'third', text: 'Another.' }] };
  const result = compose(slide);
  assert.equal(result.diagnostics.filter((entry) => entry.code === 'text-overflow').length, 0);
  const table = result.items.find((item) => item.field === 'table'), texts = result.items.filter((item) => item.field === 'text');
  assert.ok(texts.every((text) => table.box.width > text.box.width), 'the table column is the widest');
  const laid = layoutTable(table.value, table.box, { scale: 1, minFontSizePx: table.composition.minFontSizePx, ...(table.tableGrowth ? { growth: table.tableGrowth } : {}) });
  const size = Math.min(...laid.rows.flatMap((row) => row.cells.map((cell) => cell.fit.fontSize)));
  assert.ok(size >= 25 - 1e-6, `the table keeps at least its 25 px role size: ${size}`);
  assert.ok(texts.every((text) => text.text.fontSize >= 28 - 1e-6), 'the texts keep their size');
});
