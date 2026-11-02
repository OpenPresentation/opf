// LH-44: a table row is never shorter than its text at the floor plus its insets, a word never breaks silently, and automatic
// composition gives a table the width its words need (its natural width up to 65% of a row, or the whole width).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { composeSlide, layoutTable } from '../dist/composition.js';

// Half an em per character, so widths are easy to reason about.
const measurement = { measure: (text, size) => [...text].length * size * 0.5 };
const decisions = {
	columns: ['Workstream', 'Owner', 'Status', 'Decision'],
	rows: [
		['Emergency management', 'Program lead', 'At risk', 'Continue'],
		['Data and reporting', 'Analytics', 'On track', 'Tighten metric definitions'],
		['Field adoption', 'Operations', 'Watch', 'Add weekly office hours'],
	],
};
const sum = (values) => values.reduce((a, b) => a + b, 0);
const wordsOf = (text) => String(text).split(/\s+/u).filter(Boolean);
const tableItem = (result) => result.items.find((item) => item.field === 'table');
const options = { width: 1280, height: 720, textMeasurement: measurement };

function assertWholeWords(layout) {
	for (const cell of layout.rows.flatMap((row) => row.cells)) {
		assert.deepEqual(wordsOf(cell.fit.lines.join(' ')), wordsOf(cell.value), `"${cell.value}" breaks inside a word: ${JSON.stringify(cell.fit.lines)}`);
	}
}

describe('layoutTable', () => {
	test('reports the width it asks for and the width its words need', () => {
		const layout = layoutTable(decisions, { x: 0, y: 0, width: 1200, height: 1000 }, { textMeasurement: measurement });
		assert.ok(layout.minimumWidth < layout.naturalWidth, `${layout.minimumWidth} < ${layout.naturalWidth}`);
		// Every cell on one line: the longest row of "Tighten metric definitions" (26 characters at 25 px) plus padding.
		assert.ok(layout.naturalWidth >= 26 * 25 * 0.5 + 20);
		assert.ok(layout.naturalHeight > 0 && layout.naturalHeight <= layout.height + 1e-6);
		assert.equal(layout.overflow, false);
	});

	test('a row is never shorter than its line height plus its insets: a table that cannot fit runs past its box and reports overflow', () => {
		const box = { x: 0, y: 0, width: 1200, height: 60 };
		const layout = layoutTable(decisions, box, { textMeasurement: measurement });
		assert.equal(layout.overflow, true);
		assert.ok(layout.height > box.height);
		for (const row of layout.rows) {
			const lines = Math.max(...row.cells.map((cell) => cell.fit.lines.length));
			const size = row.cells[0].fit.fontSize;
			assert.equal(size, 16, 'the type steps down to the floor first');
			assert.ok(row.box.height >= lines * size * 1.2 + 12 - 0.5, `row ${row.box.height} for ${lines} line(s) at ${size}px`);
		}
		for (const cell of layout.rows.flatMap((row) => row.cells)) assert.equal(cell.fit.overflow, false, `"${cell.value}" overflows its row`);
	});

	test('a word wider than its column at the floor is overflow', () => {
		const layout = layoutTable(decisions, { x: 0, y: 0, width: 200, height: 600 }, { textMeasurement: measurement });
		assert.equal(layout.splitsWords, true);
		assert.equal(layout.overflow, true);
	});
});

describe('automatic composition', () => {
	test('a table beside text takes its natural width, up to 65% of the row, and keeps every word whole', () => {
		const result = composeSlide({ title: 'Operating model', blocks: [{ table: decisions }, { text: 'Rural Connectivity Office should focus the next cycle on explaining broadband route choices.' }] }, options);
		const item = tableItem(result), text = result.items.find((entry) => entry.field === 'text');
		assert.ok(item.box.width > text.box.width, `table ${item.box.width} beside text ${text.box.width}`);
		const row = item.box.width + text.box.width;
		assert.ok(item.box.width <= 0.65 * row + 1, `table ${item.box.width} of ${row}`);
		const layout = layoutTable(item.value, item.box, { textMeasurement: measurement });
		assert.equal(layout.overflow, false);
		assertWholeWords(layout);
		assert.deepEqual(result.diagnostics, []);
	});

	test('a grid that leaves a table too narrow for its words gives the table the whole width', () => {
		const slide = {
			title: 'Signal trend',
			composition: { mode: 'grid' },
			blocks: [
				{ metric: { value: '91%', label: 'Primary signal' } },
				{ chart: { type: 'column', data: { columns: ['Quarter', 'Value'], rows: [['Q1', 1], ['Q2', 2]] } } },
				{ table: decisions },
				{ quote: { text: 'The bottom row remains available for interpretation.', attribution: 'Program lead' } },
			],
		};
		const result = composeSlide(slide, { ...options, explain: true });
		const item = tableItem(result);
		assert.equal(result.explanation.decisions[0].reason, 'table-width');
		assert.ok(Math.abs(item.box.width - result.contentBox.width) < 1, `table ${item.box.width} of ${result.contentBox.width}`);
		const metric = result.items.find((entry) => entry.field === 'metric'), quote = result.items.find((entry) => entry.field === 'quote');
		assert.ok(metric.box.y < item.box.y && quote.box.y > item.box.y, 'the blocks before the table sit above it and the ones after below');
		const layout = layoutTable(item.value, item.box, { textMeasurement: measurement });
		assert.equal(layout.splitsWords, false);
		assertWholeWords(layout);
		assert.equal(result.diagnostics.filter((entry) => entry.path.endsWith('.table')).length, 0);
	});

	test('an explicit column count is kept', () => {
		const slide = { composition: { mode: 'grid', columns: 4 }, blocks: [{ text: 'One' }, { text: 'Two' }, { table: decisions }, { text: 'Four' }] };
		const result = composeSlide(slide, options);
		assert.ok(tableItem(result).box.width < result.contentBox.width / 3);
	});

	test('stacked tables keep rows at least as tall as their floor', () => {
		const result = composeSlide({ composition: { mode: 'column' }, blocks: [{ table: decisions }, { table: decisions }, { text: 'A short note.' }] }, options);
		for (const item of result.items.filter((entry) => entry.field === 'table')) {
			const layout = layoutTable(item.value, item.box, { textMeasurement: measurement });
			assert.equal(layout.overflow, false);
			assert.ok(Math.abs(sum(layout.rows.map((row) => row.box.height)) - layout.height) < 1e-6);
		}
		assert.deepEqual(result.diagnostics, []);
	});
});
