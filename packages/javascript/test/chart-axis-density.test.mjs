// WI-5 (P19): the value axis follows the axis length (intervals at least 48 reference px apart, at most 8), the 18 px floor of a box with room,
// and the zero baseline and explicit axis settings are unchanged.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { CHART_MAX_INTERVALS, CHART_MIN_TICK_SPACING_PX, CHART_TEXT_FLOOR_PX, chartIntervalsFor, chartTextSize, chartValueAxis, composeSlide, niceScale, resolveChartData } from '../dist/composition.js';

const chartOf = (values, type = 'column', extra = {}) => ({
	type,
	data: { columns: ['Week', 'Completion'], rows: values.map((value, index) => [String(index + 1), value]) },
	...extra,
});
const axisOf = (chart, geometry) => chartValueAxis(chart, resolveChartData(chart), geometry);
const intervals = (axis) => Math.round((axis.max - axis.min) / axis.majorUnit);
// The gallery chart: 68, 72, 76, 84 percent over four weeks (the 0 to 90% case of chart-beside and the three-column charts).
const completion = chartOf([68, 72, 76, 84]);

describe('the axis step depends on the axis length', () => {
	test('a short axis shows fewer, wider intervals; a tall one never more than eight', () => {
		const heights = [150, 200, 260, 320, 380, 450, 700, 1200];
		const counts = heights.map((height) => intervals(axisOf(completion, { width: 800, height, scale: 1 })));
		for (let index = 1; index < counts.length; index++) assert.ok(counts[index] >= counts[index - 1], `${heights[index]} px: ${counts}`);
		assert.ok(counts.every((count) => count >= 1 && count <= CHART_MAX_INTERVALS), String(counts));
		assert.ok(counts[0] < counts.at(-1), String(counts));
	});

	test('intervals are at least 40 px apart on the axis the preview draws', () => {
		for (const height of [200, 260, 320, 380, 450, 600]) {
			const geometry = { width: 800, height, scale: 1 };
			const axis = axisOf(completion, geometry);
			// plot length per the chartValueAxis estimate: height - 2 pad - 1.5 lines of 20 px text at 1.5 line height
			const length = height - 20 - 45 * (chartTextSize(geometry) / 20) * 1;
			assert.ok(length / intervals(axis) >= 40 - 1e-9 || intervals(axis) === 1, `${height}: ${length / intervals(axis)} px per interval`);
		}
	});

	test('a chart beside text or in one of three columns draws 0 to 100% in steps of 20, not 0 to 90% in tens', () => {
		const beside = axisOf(completion, { width: 560, height: 420, scale: 1 });
		assert.deepEqual(beside, { min: 0, max: 100, majorUnit: 20 });
		const column = axisOf(completion, { width: 380, height: 470, scale: 1 });
		assert.deepEqual(column, { min: 0, max: 100, majorUnit: 20 });
	});

	test('the spacing follows the slide scale', () => {
		assert.equal(chartIntervalsFor(480, 20, 1), 8);
		assert.equal(chartIntervalsFor(480, 20, 2), 5);
		assert.equal(chartIntervalsFor(480, 20, 0), 8, 'a bad scale reads as 1');
		assert.equal(chartIntervalsFor(10000, 1, 1), CHART_MAX_INTERVALS);
		assert.equal(chartIntervalsFor(1, 1, 1), 1);
		assert.equal(CHART_MIN_TICK_SPACING_PX >= 40, true);
	});

	test('the composed chart item carries the same axis', () => {
		const document = { slides: [{ title: 'Completion', chart: completion }] };
		const item = composeSlide(document.slides[0], { width: 1280, height: 720, presentation: document, slideIndex: 0 }).items.find((entry) => entry.field === 'chart');
		assert.deepEqual(item.chart.valueAxis, axisOf(completion, { width: item.box.width, height: item.box.height, scale: 1 }));
	});
});

describe('the zero baseline and explicit settings are unchanged', () => {
	test('bars and areas still include zero at every length', () => {
		for (const height of [150, 300, 600]) {
			for (const type of ['column', 'bar', 'area']) assert.equal(axisOf(chartOf([980, 990, 1000], type), { width: 800, height, scale: 1 }).min, 0, `${type} ${height}`);
		}
	});

	test('niceScale with an explicit interval limit is the old function', () => {
		assert.deepEqual(niceScale(0, 760, 10), { min: 0, max: 800, step: 100, ticks: [0, 100, 200, 300, 400, 500, 600, 700, 800] });
		assert.equal(niceScale(0, 84, 5).step, 20);
	});
});

describe('the 18 px text floor', () => {
	test('a box with room for it floors at 18 px, a smaller one at the minimum', () => {
		assert.equal(CHART_TEXT_FLOOR_PX, 18);
		assert.equal(chartTextSize({ width: 380, height: 470, scale: 1 }), 18, 'a peer column of three');
		assert.equal(chartTextSize({ width: 570, height: 270, scale: 1 }), 18, 'a dashboard panel');
		assert.equal(chartTextSize({ width: 560, height: 200, scale: 1 }), 16);
		assert.equal(chartTextSize({ width: 280, height: 470, scale: 1 }), 16);
		assert.equal(chartTextSize({ width: 380, height: 470, scale: 2 }), 16, 'the same slide pixels are half the room at twice the scale');
		assert.equal(chartTextSize({ width: 760, height: 940, scale: 2 }), 18);
	});

	test('a larger minFontSize and a roomy box are unchanged', () => {
		assert.equal(chartTextSize({ width: 1000, height: 600, scale: 1 }), 20);
		assert.equal(chartTextSize({ width: 380, height: 470, scale: 1, minFontSize: 24 }), 24);
		assert.equal(chartTextSize({ width: 0, height: 600, scale: 1 }), 20);
	});
});
