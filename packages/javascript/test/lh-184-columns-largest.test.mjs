import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';

// LH-184: `columns: "auto"` keeps the largest text. When no count fits at the starting size it takes the count with the
// largest fitted size (fewer columns on a tie) and is never smaller than the list in one column.
const words = n => Array.from({ length: n }, (_, i) => ['growth', 'revenue', 'customers', 'market', 'platform', 'strategy', 'quarter', 'team'][i % 8]).join(' ');
const sizeOf = slide => {
  const result = composeSlide(slide), scale = Math.min(result.width, result.height) / 720;
  const list = result.items.find(item => item.field === 'items');
  return { size: list.text.fontSize / scale, columns: list.listColumns?.length ?? 1 };
};

test('a long list with columns: auto is never smaller than the same list in one column', () => {
  const items = Array.from({ length: 14 }, (_, i) => `Point ${i + 1}: ${words(10)}`);
  const one = sizeOf({ title: 'x', items });
  const auto = sizeOf({ title: 'x', items, columns: 'auto' });
  assert.ok(auto.size >= one.size - 0.01, `auto ${auto.size} px (${auto.columns} columns) against one column ${one.size} px`);
});

test('a list that fits at the starting size in two columns still takes two', () => {
  const items = Array.from({ length: 12 }, (_, i) => `Item ${i + 1}: ${words(3)}`);
  const auto = sizeOf({ title: 'x', items, columns: 'auto' });
  assert.equal(auto.columns, 2);
});

test('a fixed count is used as written', () => {
  const items = Array.from({ length: 14 }, (_, i) => `Point ${i + 1}: ${words(10)}`);
  assert.equal(sizeOf({ title: 'x', items, columns: 3 }).columns, 3);
});
