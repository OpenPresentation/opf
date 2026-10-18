import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide, layoutTable} from '../dist/composition.js';

// RR-90: table cells ask for the body size (25 px, about 19 pt) instead of 15 px floored to 16 px (12 pt), and the whole table
// shrinks together toward the floor when its rows do not fit.
const measurement = {measure: (text, size, style) => [...text].length * size * (style?.fontWeight >= 600 ? .56 : .5)};
const box = {x: 0, y: 0, width: 1160, height: 420};
const sizes = layout => layout.rows.flatMap(row => row.cells.map(cell => cell.fit.fontSize));
const four = {columns: ['Segment', 'Q2', 'Q3'], rows: [['Enterprise', 4.1, 4.9], ['Mid-market', 2.2, 2.6], ['SMB', 1.4, 1.5], ['Other', 0.3, 0.2]]};

test('a table that fits is set at the body size, not the 12 pt floor', () => {
  const layout = layoutTable(four, box, {textMeasurement: measurement});
  assert.equal(layout.overflow, false);
  assert.deepEqual([...new Set(sizes(layout))], [25]);
  assert.deepEqual(layout.rows.map(row => row.box.height), [54, 54, 54, 54, 54]);
  // Scaled canvases and a raised floor behave the same way.
  assert.deepEqual([...new Set(sizes(layoutTable(four, {x: 0, y: 0, width: 580, height: 210}, {scale: .5, textMeasurement: measurement})))].map(size => Math.round(size * 2)), [25]);
  assert.deepEqual([...new Set(sizes(layoutTable(four, box, {minFontSize: 30, textMeasurement: measurement})))], [30]);
});

test('a crowded table shrinks together, never below the floor, and keeps one size', () => {
  const rows = Array.from({length: 11}, (_, index) => [`Row ${index}`, index * 11, 'a longer text cell that needs room']);
  const table = {columns: ['Name', 'Value', 'Note'], rows};
  const layout = layoutTable(table, {...box, height: 420}, {textMeasurement: measurement});
  assert.equal(layout.overflow, false);
  const [size, ...rest] = [...new Set(sizes(layout))];
  assert.equal(rest.length, 0, 'every cell shares one size');
  assert.ok(size < 25 && size >= 16, `shrunk to ${size}`);
  assert.ok(layout.height <= 420.001);
  // The size is the largest that fits: one pixel more overflows.
  const larger = layoutTable(table, {...box, height: 420}, {minFontSize: size + 1, textMeasurement: measurement});
  assert.equal(larger.overflow, true);
  // Nothing fits at the floor: it is reported, at the floor.
  const crushed = layoutTable(table, {...box, height: 120}, {textMeasurement: measurement});
  assert.equal(crushed.overflow, true);
  assert.deepEqual([...new Set(sizes(crushed))], [16]);
});

test('a wrapped cell lowers the whole table, not one cell, and rich runs keep their proportions', () => {
  const table = {rows: [['short', 'also short'], ['word '.repeat(30), 'x'], [[{text: 'rich '}, {text: 'bold', bold: true}], 'y']]};
  const layout = layoutTable(table, {...box, width: 600, height: 230}, {textMeasurement: measurement});
  assert.equal(layout.overflow, false);
  assert.equal(new Set(sizes(layout)).size, 1);
  // A run with its own fontSize is drawn at that size when the table is at the body size.
  const own = layoutTable({rows: [[[{text: 'Big', fontSize: 24}]], ['small']]}, box, {textMeasurement: measurement});
  assert.equal(own.rows[0].cells[0].fit.richLines[0].fragments[0].fontSize, 32);
});

test('a slide with a four-row table beside bullets draws table text at the body size', () => {
  const slide = {title: 'What changed', blocks: [{items: ['Enterprise renewals closed two weeks early', 'Churn fell for the third quarter running']}, {table: four}]};
  const composed = composeSlide(slide, {textMeasurement: measurement});
  assert.deepEqual(composed.diagnostics, []);
  const table = composed.items.find(item => item.field === 'table');
  assert.ok(table, 'the table item');
  assert.ok(table.box.height > 0);
});
