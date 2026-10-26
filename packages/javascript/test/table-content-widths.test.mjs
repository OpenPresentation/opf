// WI-5 (P20 and N2): table columns are sized from content, a line breaks only between words, and a word that cannot fit shrinks the table
// first. Explicit padding, alignment and span geometry still win; overflow is still reported.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { layoutTable } from '../dist/composition.js';

// Half an em per character: "completion" is 125 px at the 25 px table type size.
const measurement = { measure: (text, size) => [...text].length * size * 0.5 };
const wordsOf = (text) => String(text).split(/\s+/u).filter(Boolean);
// The three-column fixture of the gallery's peer-column table (the third column of renders/compare/P13-3col-table.png).
const fixture = {
	columns: ['Measure', 'Baseline', 'Pilot'],
	rows: [['Task completion', '68%', '84%'], ['Median review (h)', 44, 19], ['Escalation rate', '11%', '6%'], ['First response on time', '81%', '92%'], ['Participant satisfaction', '3.8 / 5', '4.6 / 5']],
};
const box = { x: 0, y: 0, width: 390, height: 640 };
const sum = (values) => values.reduce((a, b) => a + b, 0);

function assertWholeWords(layout) {
	for (const row of layout.rows) for (const cell of row.cells) {
		const text = String(cell.value ?? '');
		assert.deepEqual(wordsOf(cell.fit.lines.join(' ')), wordsOf(text), `a line of "${text}" breaks inside a word: ${JSON.stringify(cell.fit.lines)}`);
	}
}

describe('no mid-word breaks', () => {
	test('the three-column fixture keeps every word whole at the default size', () => {
		const layout = layoutTable(fixture, box, { textMeasurement: measurement });
		assert.equal(layout.overflow, false);
		assert.equal(layout.splitsWords, false);
		assert.equal(layout.rows[0].cells[0].fit.fontSize, 25, 'the default cell size is kept');
		assertWholeWords(layout);
	});

	test('equal columns would have split "completion"; content widths do not', () => {
		// 390 / 3 = 130 px, less 20 px of padding, is 110 px: "completion" (125 px) and "satisfaction" (150 px) cannot fit an equal column.
		const equal = (box.width / 3 - 20);
		assert.ok(equal < 125);
		const layout = layoutTable(fixture, box, { textMeasurement: measurement });
		const widest = Math.max(...layout.rows.flatMap((row) => row.cells.filter((cell) => cell.column === 0).map((cell) => cell.textBox.width)));
		assert.ok(widest >= 150, `the first column's text width is ${widest}`);
	});

	test('a word that cannot fit shrinks the table before any line breaks inside it', () => {
		const table = { columns: ['Measure', 'Value'], rows: [['Internationalization', '1'], ['Participation', '2']] };
		const narrow = { x: 0, y: 0, width: 330, height: 400 };
		const layout = layoutTable(table, narrow, { textMeasurement: measurement });
		assert.equal(layout.splitsWords, false);
		const size = layout.rows[0].cells[0].fit.fontSize;
		assert.ok(size < 25 && size >= 16, `size ${size}`);
		assertWholeWords(layout);
	});

	test('only at the minimum size does a word that still cannot fit break', () => {
		const table = { columns: ['Measure', 'Value'], rows: [['Internationalization', '1']] };
		const layout = layoutTable(table, { x: 0, y: 0, width: 150, height: 400 }, { textMeasurement: measurement });
		assert.equal(layout.rows[0].cells[0].fit.fontSize, 16);
		assert.equal(layout.splitsWords, true);
	});

	test('text without word spaces breaks between characters, not as one unbreakable word', () => {
		const table = { columns: ['Measure', 'Value'], rows: [['這是一個很長的中文表格欄位內容需要換行', '1']] };
		const layout = layoutTable(table, { x: 0, y: 0, width: 400, height: 400 }, { textMeasurement: measurement });
		assert.equal(layout.splitsWords, false);
		assert.equal(layout.rows[0].cells[0].fit.fontSize, 25);
	});
});

describe('widths follow content', () => {
	test('short columns keep what they ask for, long ones share the rest, and the columns fill the table', () => {
		const layout = layoutTable(fixture, box, { textMeasurement: measurement });
		assert.equal(layout.columnWidths.length, 3);
		assert.ok(Math.abs(sum(layout.columnWidths) - box.width) < 1e-6);
		const [measure, baseline, pilot] = layout.columnWidths;
		assert.ok(measure > baseline && measure > pilot, String(layout.columnWidths));
		assert.ok(Math.abs(baseline - pilot) < 30, String(layout.columnWidths));
		// cell boxes tile the columns
		for (const cell of layout.rows.flatMap((row) => row.cells)) {
			assert.ok(Math.abs(cell.box.width - layout.columnWidths[cell.column]) < 1e-6);
			assert.ok(Math.abs(cell.box.x - sum(layout.columnWidths.slice(0, cell.column))) < 1e-6);
		}
	});

	test('a table that fits on one line grows its columns in proportion to their content', () => {
		const layout = layoutTable({ columns: ['A', 'Long heading'], rows: [['x', 'y']] }, { x: 0, y: 0, width: 900, height: 300 }, { textMeasurement: measurement });
		const [first, second] = layout.columnWidths;
		assert.ok(Math.abs(first + second - 900) < 1e-6);
		assert.ok(second > 3 * first, `${first} ${second}`);
	});

	test('a merged cell asks its columns, together, for its own width', () => {
		const table = { columns: [{ value: 'Quarterly performance summary', colSpan: 2 }, null], rows: [['a', 'b']] };
		const layout = layoutTable(table, { x: 0, y: 0, width: 500, height: 300 }, { textMeasurement: measurement });
		const heading = layout.rows[0].cells[0];
		assert.equal(heading.colSpan, 2);
		assert.ok(Math.abs(heading.box.width - 500) < 1e-6);
		assert.equal(layout.splitsWords, false);
	});

	test('explicit cell padding and alignment still win', () => {
		const table = { columns: [{ value: 'Name', style: { align: 'right', padding: { left: 40, right: 40 } } }, 'Value'], rows: [['Alpha', 1]] };
		const layout = layoutTable(table, { x: 0, y: 0, width: 500, height: 300 }, { textMeasurement: measurement });
		const header = layout.rows[0].cells[0];
		assert.equal(header.alignment, 'right');
		assert.ok(Math.abs(header.textBox.x - (header.box.x + 40)) < 1e-6);
		assert.ok(Math.abs(header.textBox.width - (header.box.width - 80)) < 1e-6);
		assert.ok(header.box.width >= 80 + 5 * 12, 'the padding is part of the width a column asks for');
	});

	test('a right-to-left table lays the same widths out from the right', () => {
		const ltr = layoutTable(fixture, box, { textMeasurement: measurement });
		const rtl = layoutTable(fixture, box, { textMeasurement: measurement, direction: 'rtl' });
		assert.deepEqual(rtl.columnWidths, ltr.columnWidths);
		const [first, second, third] = ltr.columnWidths;
		const xs = rtl.rows[0].cells.map((cell) => cell.box.x);
		for (const [actual, expected] of [[xs[0], second + third], [xs[1], third], [xs[2], 0]]) assert.ok(Math.abs(actual - expected) < 1e-6);
		assert.ok(first > 0);
	});

	test('layout is deterministic and does not change the input', () => {
		const before = structuredClone(fixture);
		assert.deepEqual(layoutTable(fixture, box, { textMeasurement: measurement }), layoutTable(fixture, box, { textMeasurement: measurement }));
		assert.deepEqual(fixture, before);
	});
});

describe('overflow is still reported', () => {
	test('too many rows for the box overflow at the floor size', () => {
		const rows = Array.from({ length: 40 }, (_, index) => [`Row ${index}`, index, index]);
		const layout = layoutTable({ columns: ['Measure', 'A', 'B'], rows }, { x: 0, y: 0, width: 390, height: 200 }, { textMeasurement: measurement });
		assert.equal(layout.overflow, true);
	});

	test('a table with room does not overflow', () => {
		assert.equal(layoutTable(fixture, { ...box, height: 900 }, { textMeasurement: measurement }).overflow, false);
	});
});
