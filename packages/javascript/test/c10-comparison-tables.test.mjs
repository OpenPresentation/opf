// C10 (0.35.2): two short tables side by side (a comparison) grow together (LH-48 with TAB-1) instead of a thin strip at their role size.
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

test('two short tables of a comparison grow together', () => {
  const slide = { layout: 'comparison', title: 'Two teams', blocks: [{ table }, { table }] };
  const result = compose(slide);
  assert.equal(result.diagnostics.filter((entry) => entry.code === 'text-overflow').length, 0);
  const tables = result.items.filter((item) => item.field === 'table');
  assert.equal(tables.length, 2);
  assert.ok(tables.every((item) => item.tableGrowth > 1), 'both grew');
  assert.equal(tables[0].tableGrowth, tables[1].tableGrowth, 'one size');
  assert.ok(Math.abs(tables[0].box.y - tables[1].box.y) < 1, 'one top line');
});
