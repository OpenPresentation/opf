// A focused chart's context neutral: a filled mark (column, bar, area, slice) whose value is printed on or beside it may be the light
// labeled neutral (1.6:1); a mark drawn as a stroke (a line series, a combo's line) keeps 3:1 even when labeled, because the line is the
// data. One decision in core (chartFocusContextColors, chartSeriesStrokes) that the preview and the PPTX export both read.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHART_CONTEXT_LABELED_MIN_CONTRAST, CHART_CONTEXT_MIN_CONTRAST, chartContextColors, chartFocusContextColors, chartSeriesStrokes, colorContrast, composeSlide } from '../dist/composition.js';

const navy = '#0B1F3A', ink = '#FFFFFF', white = '#FFFFFF', text = '#333333';

test('which series are strokes: every line series, a combo line, never a column, bar, area or slice', () => {
	assert.deepEqual(chartSeriesStrokes('line', 3), [true, true, true]);
	assert.deepEqual(chartSeriesStrokes('combo', 3, [{ role: 'bar' }, { role: 'bar' }, { role: 'line' }]), [false, false, true]);
	for (const kind of ['bar', 'area', 'pie', 'doughnut', undefined]) assert.deepEqual(chartSeriesStrokes(kind, 2), [false, false], String(kind));
});

test('a labeled stroke keeps the ordinary floor; a labeled fill keeps the light one', () => {
	for (const [surface, ink2] of [[navy, ink], [white, text]]) {
		const [line] = chartFocusContextColors(surface, ink2, [0], { labeled: true, strokes: [true] });
		const [column] = chartFocusContextColors(surface, ink2, [0], { labeled: true, strokes: [false] });
		assert.ok(colorContrast(line, surface) >= CHART_CONTEXT_MIN_CONTRAST, `${surface} line ${line}`);
		assert.ok(colorContrast(column, surface) >= CHART_CONTEXT_LABELED_MIN_CONTRAST, `${surface} column ${column}`);
		assert.ok(colorContrast(column, surface) < CHART_CONTEXT_MIN_CONTRAST, 'the labeled fill is the light neutral');
		// One kind of mark gets exactly what chartContextColors gives.
		assert.deepEqual(chartFocusContextColors(surface, ink2, [1, 2], { labeled: true, strokes: [true, true, true] }), chartContextColors(surface, ink2, 2));
		assert.deepEqual(chartFocusContextColors(surface, ink2, [1, 2], { labeled: true, strokes: [false, false, false] }), chartContextColors(surface, ink2, 2, { labeled: true }));
		assert.deepEqual(chartFocusContextColors(surface, ink2, [1, 2], { labeled: false, strokes: [false, false, false] }), chartContextColors(surface, ink2, 2));
	}
	// A combo's context: its columns may be light, its line may not.
	const [bars, lineSeries] = chartFocusContextColors(navy, ink, [0, 2], { labeled: true, strokes: [false, false, true] });
	assert.ok(colorContrast(bars, navy) < CHART_CONTEXT_MIN_CONTRAST && colorContrast(lineSeries, navy) >= CHART_CONTEXT_MIN_CONTRAST);
});

test('a labeled small line chart whose title names a category: the composed focus is labeled, and its context line stays at 3:1', () => {
	const slide = { title: 'Since 2023, delivery stayed above ninety-two percent', chart: { type: 'line', data: { columns: ['Year', 'On time'], rows: [['2021', 93.4], ['2022', 94.1], ['2023', 92.8], ['2024', 95.2], ['2025', 96.1]] } } };
	const chart = composeSlide(slide, { width: 1280, height: 720 }).items.find((item) => item.field === 'chart');
	assert.deepEqual(chart.chart.layer.focus.categories, [2]);
	assert.equal(chart.chart.layer.focus.labeled, true);
	const [gray] = chartFocusContextColors(navy, ink, [0], { labeled: true, strokes: chartSeriesStrokes('line', 1) });
	assert.ok(colorContrast(gray, navy) >= CHART_CONTEXT_MIN_CONTRAST, gray);
});
