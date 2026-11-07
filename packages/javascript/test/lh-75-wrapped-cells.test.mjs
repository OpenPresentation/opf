// LH-75 decision (2026-11-07, vetoable): beside its note a table's cells may wrap onto two lines, words whole, so the table keeps its
// size and the note its card instead of the two stacking with the note under a full-width table (b15 s23, s41). A cell that would take
// three lines, or a word too wide for its column, keeps the stack.
import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide, layoutTable } from '../dist/composition.js';

const note = 'Customers told us onboarding took too long, so we rebuilt it around three steps and removed the two that nobody needed; the flow now takes four minutes instead of twenty.';
const table = (decisions) => ({ table: { columns: ['Workstream', 'Owner', 'Status', 'Decision'], rows: [['Pricing', 'Program lead', 'At risk', 'Continue'], ['Data and reporting', 'Analytics', 'On track', decisions[0]], ['Field adoption', 'Operations', 'Watch', decisions[1]]] } });
const slide = (decisions) => ({ title: 'Plans at a glance', blocks: [table(decisions), { text: note }] });
const itemOf = (result, field) => result.items.find((item) => item.field === field);
const beside = (a, b) => a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1;
const cellLines = (item) => Math.max(...layoutTable(item.value, item.box, { scale: 1, minFontSize: item.composition.minFontSize, ...(item.tableGrowth ? { growth: item.tableGrowth } : {}) }).rows.flatMap((row) => row.cells.map((cell) => cell.fit.lines.length)));
const findings = (result) => result.diagnostics.filter((entry) => ['text-overflow', 'small-cell'].includes(entry.code));

for (const [name, options] of [['the table layout', { layout: gallery.layouts.table }], ['automatic composition', {}]]) {
  test(`LH-75, ${name}: a table whose cells wrap onto two lines sits beside its note at no smaller size`, () => {
    const input = slide(['Tighten the definitions', 'Add office hours']);
    const result = composeSlide(input, options), stacked = composeSlide(input, { ...options, recompose: false, fill: false });
    const placed = itemOf(result, 'table'), text = itemOf(result, 'text');
    assert.ok(beside(placed.box, text.box), 'side by side');
    assert.ok(text.frameBox, 'the note is on its card');
    assert.ok(cellLines(placed) >= 2 && cellLines(placed) <= 2, `cells on at most two lines (${cellLines(placed)})`);
    assert.deepEqual(findings(result), []);
    const size = (composed) => Math.min(...layoutTable(itemOf(composed, 'table').value, itemOf(composed, 'table').box, { scale: 1, minFontSize: 16 }).rows.flatMap((row) => row.cells.map((cell) => cell.fit.fontSize)));
    assert.ok(size(result) >= size(stacked) - 1e-6, 'the table is no smaller than stacked');
  });
}

test('LH-75: a table whose cells would take three lines beside the note keeps the stack', () => {
  const result = composeSlide(slide(['Tighten every one of the metric definitions', 'Add weekly office hours for the field teams']), {});
  assert.ok(!beside(itemOf(result, 'table').box, itemOf(result, 'text').box));
});

// LH-75 follow-up (2026-11-07): the pair grows by LH-48's steps like any short body, never below its role sizes.
test('LH-75: a short table and its note grow together, the note card widening to keep its measure', () => {
  const plans = { table: { columns: ['Plan', 'Seats', 'Price'], rows: [['Plan 1', '10', '$9'], ['Plan 2', '20', '$29'], ['Plan 3', '30', '$49']] } };
  const input = { title: 'Plans at a glance', blocks: [plans, { text: note }] };
  const grown = composeSlide(input, { layout: gallery.layouts.table }), role = composeSlide(input, { layout: gallery.layouts.table, fill: false });
  const text = itemOf(grown, 'text');
  assert.ok(beside(itemOf(grown, 'table').box, text.box) && text.frameBox);
  assert.ok(text.text.fontSize > itemOf(role, 'text').text.fontSize, `note ${text.text.fontSize} over ${itemOf(role, 'text').text.fontSize}`);
  assert.ok((itemOf(grown, 'table').tableGrowth ?? 1) >= 1);
  assert.deepEqual(findings(grown), []);
});
