// TAB-1 (0.35.2): a table and the note under it grow (LH-48) while they cover under three quarters of the body (TABLE_NOTE_GROWN_TARGET),
// as the pair beside each other does (LH-75): a third row, or a longer note, no longer sets the pair smaller while a third of the body is empty.
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
const columns = ['Team', { name: 'Participants', format: '0' }, { name: 'Completion', format: '0%' }, { name: 'Median time (min)', format: '0.0' }];
const all = [['A', 28, 0.89, 5.8], ['B', 24, 0.79, 6.7], ['C', 31, 0.91, 5.1], ['D', 19, 0.7, 7.4], ['E', 22, 0.83, 6.2]];
const note = 'Test with two teams for six weeks. Measure task completion and time before deciding what to scale.';
const longNote = `${note.slice(0, -1)}, then compare the results against the baseline we collected in the first week, and share the findings with every sponsor before expanding to further teams across the organization.`;
const slide = (count, text = note) => ({ layout: 'table', title: 'Compare outcomes', blocks: [{ region: 'body', table: { columns, rows: all.slice(0, count) } }, { region: 'aside', text }] });
const sizes = (result) => {
  const table = result.items.find((item) => item.field === 'table'), text = result.items.find((item) => item.field === 'text');
  const laid = layoutTable(table.value, table.box, { scale: 1, minFontSize: table.composition.minFontSize, ...(table.tableGrowth ? { growth: table.tableGrowth } : {}) });
  return { table: Math.min(...laid.rows.flatMap((row) => row.cells.map((cell) => cell.fit.fontSize))), note: text.text.fontSize, box: table.box, noteBox: text.box };
};

test('a third row keeps the grown sizes of the two-row table and its note; a longer note grows too', () => {
  const two = sizes(compose(slide(2)));
  for (const [name, next] of [['three rows', slide(3)], ['a longer note', slide(2, longNote)]]) {
    const result = compose(next), grown = sizes(result);
    assert.equal(result.diagnostics.filter((entry) => entry.code === 'text-overflow').length, 0, name);
    // The third row takes the two-row table's sizes; the longer note (more lines to fit) grows at least one step.
    if (name === 'three rows') {
      assert.ok(grown.table >= two.table - 1e-6, `${name}: table ${grown.table} vs ${two.table}`);
      assert.ok(grown.note >= two.note - 1e-6, `${name}: note ${grown.note} vs ${two.note}`);
    }
    const kept = sizes(compose(next, { fill: false }));
    assert.ok(grown.table > kept.table + 1 && grown.note > kept.note + 1, `${name} grows past its role sizes`);
  }
});

test('a table and note that already fill most of the body keep their role sizes and place', () => {
  const grown = sizes(compose(slide(5))), kept = sizes(compose(slide(5), { fill: false }));
  assert.deepEqual(grown, kept);
});
