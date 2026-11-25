// TAB-2 (0.35.2): a table beside its aside (table-beside) grows (LH-48) as the table with the note under it does (TAB-1): its type up to
// its display size and its rows with it. A note or a list grows with it; a metric or a quote keeps its own size.
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
const table = { columns, rows: [['A', 28, 0.89, 5.8], ['B', 24, 0.79, 6.7]] };
const asides = {
  text: { text: 'Test with two teams for six weeks. Measure task completion and time before deciding what to scale.' },
  list: { items: ['Measure completion', 'Measure time', 'Decide who owns it'] },
  metric: { metric: { value: '84%', label: 'Completion', description: 'Target 80%' } },
  quote: { quote: { text: 'Start small and measure.', attribution: 'Ana' } },
};
const slide = (aside) => ({ layout: 'table-beside', title: 'Team B needs support', blocks: [{ region: 'body', table }, { region: 'aside', ...aside }] });
const cellSize = (item) => Math.min(...layoutTable(item.value, item.box, { scale: 1, minFontSizePx: item.composition.minFontSizePx, ...(item.tableGrowth ? { growth: item.tableGrowth } : {}) }).rows.flatMap((row) => row.cells.map((cell) => cell.fit.fontSize)));

for (const [kind, aside] of Object.entries(asides)) test(`a table beside a ${kind} grows past its role size`, () => {
  const result = compose(slide(aside)), kept = compose(slide(aside), { fill: false });
  const grown = result.items.find((item) => item.field === 'table'), role = kept.items.find((item) => item.field === 'table');
  assert.equal(result.diagnostics.filter((entry) => entry.code === 'text-overflow').length, 0);
  assert.ok(grown.tableGrowth > 1, `${kind}: the table grew`);
  assert.ok(cellSize(grown) > cellSize(role) + 1, `${kind}: ${cellSize(grown)} vs ${cellSize(role)}`);
  const other = result.items.find((item) => !['title', 'table'].includes(item.field)), before = kept.items.find((item) => item.path === other.path);
  if (other.text && before.text) assert.ok(other.text.fontSize >= before.text.fontSize - 1e-6, `${kind}: the aside is not set smaller`);
  // The table and its aside (a quote: its card) start on one line.
  const top = (other.frameBox ?? other.box).y;
  assert.ok(Math.abs(grown.box.y - top) < 1, `${kind}: ${grown.box.y} vs ${top}`);
});
