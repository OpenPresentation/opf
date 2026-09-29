// Controls for the preview's drawn table extent (FF-39). Run: node --test table-box.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {drawnTableBox} from './table-box.mjs';

const cell = (path, x, y, w, h, tag = 'rect', kind = 'shape') => ({kind, tag, path, x, y, w, h});
const table = [cell('slides.0.table.columns.0', 57.6, 147.48, 582.4, 54), cell('slides.0.table.columns.1', 640, 147.48, 582.4, 54),
  cell('slides.0.table.rows.0.0', 57.6, 201.48, 582.4, 54), cell('slides.0.table.rows.0.1', 640, 201.48, 582.4, 54),
  cell('slides.0.table.rows.1.0', 57.6, 255.48, 582.4, 54), cell('slides.0.table.rows.1.1', 640, 255.48, 582.4, 54)];

test('the drawn table is the union of its cell rectangles, not the composed allocation', () => {
  const box = drawnTableBox(table, 'slides.0.table');
  assert.ok(Math.abs(box.x - 57.6) < 1e-9 && Math.abs(box.y - 147.48) < 1e-9 && Math.abs(box.w - 1164.8) < 1e-9 && Math.abs(box.h - 162) < 1e-9);
});
test('cells of other tables, text and non-rect shapes are ignored', () => {
  const other = [...table, cell('slides.0.blocks.1.table.rows.0.0', 0, 900, 10, 10), cell('slides.0.table.rows.0.0', 0, 0, 5, 5, 'line'), cell('slides.0.table.rows.0.0', 0, 0, 5, 5, 'rect', 'text')];
  assert.ok(Math.abs(drawnTableBox(other, 'slides.0.table').h - 162) < 1e-9);
  assert.ok(Math.abs(drawnTableBox(other, 'slides.0.blocks.1.table').h - 10) < 1e-9);
});
test('a path prefix does not match a longer path, and no cells give null', () => {
  assert.equal(drawnTableBox(table, 'slides.0.tab'), null);
  assert.equal(drawnTableBox([], 'slides.0.table'), null);
});
test('a non-finite cell is skipped', () => {
  assert.ok(Math.abs(drawnTableBox([...table, cell('slides.0.table.rows.9.0', NaN, 0, 1, 1)], 'slides.0.table').h - 162) < 1e-9);
});
