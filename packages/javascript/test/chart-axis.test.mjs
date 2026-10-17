// RR-92: the value axis of a category chart is computed in core (niceScale, maxIntervalsFor, chartValueAxis) and composition exposes it
// on the composed chart item, so the preview and the PPTX export read one axis.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { CHART_TEXT_PX, chartValueAxis, composeSlide, maxIntervalsFor, niceScale, resolveChartData, stackCategoryValues } from '../dist/composition.js';
import * as root from '../dist/index.js';

const steps = (scale) => scale.ticks.slice(1).map((tick, i) => Math.round((tick - scale.ticks[i]) * 1e9) / 1e9);
const chartOf = (values, type = 'column', extra = {}) => ({
	type,
	data: { columns: ['Quarter', ...values.map((_, i) => `S${i + 1}`)], rows: Array.from({ length: values[0].length }, (_, r) => [`Q${r + 1}`, ...values.map((series) => series[r])]) },
	...extra,
});
const axisOf = (chart, geometry = { width: 800, height: 450, scale: 1 }) => chartValueAxis(chart, resolveChartData(chart), geometry);

describe('niceScale', () => {
	test('includes zero, adds 5% headroom and picks a 1/2/5 unit', () => {
		assert.deepEqual(niceScale(0, 760, 10), { min: 0, max: 800, step: 100, ticks: [0, 100, 200, 300, 400, 500, 600, 700, 800] });
		assert.deepEqual(niceScale(0, 760, 5), { min: 0, max: 800, step: 200, ticks: [0, 200, 400, 600, 800] });
		assert.deepEqual(niceScale(3, 97, 10).ticks, [0, 20, 40, 60, 80, 100, 120]);
		assert.deepEqual(niceScale(-30, 70, 10), { min: -40, max: 80, step: 20, ticks: [-40, -20, 0, 20, 40, 60, 80] });
	});

	test('keeps a narrow range that sits high on the scale off zero, and handles equal and missing bounds', () => {
		assert.deepEqual(niceScale(980, 1000, 10), { min: 975, max: 1005, step: 5, ticks: [975, 980, 985, 990, 995, 1000, 1005] });
		assert.deepEqual(niceScale(5, 5, 10).ticks.slice(0, 3), [0, 1, 2]);
		assert.equal(niceScale(0, 0, 10).max, 1.2);
		assert.deepEqual(niceScale(Number.NaN, 3, 10), niceScale(0, 1, 10));
		assert.deepEqual(niceScale(0, 100, Number.NaN), niceScale(0, 100, 10));
		assert.deepEqual(niceScale(0, 100, 0).ticks, [0, 200]);
	});

	test('percent scales run from 0 (or -1) to 1', () => {
		assert.deepEqual(niceScale(0, 1, 10, { percent: true }), { min: 0, max: 1, step: 0.1, ticks: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] });
		assert.equal(niceScale(0, 1, 4, { percent: true }).step, 0.25);
		assert.equal(niceScale(0, 1, 1, { percent: true }).step, 1);
		assert.equal(niceScale(-0.5, 0.5, 10, { percent: true }).min, -1);
	});

	test('huge and tiny magnitudes stay finite and ordered', () => {
		const huge = niceScale(0, Number.MAX_VALUE, 10);
		assert.ok(huge.ticks.every(Number.isFinite));
		assert.equal(huge.max, Number.MAX_VALUE);
		const tiny = niceScale(0, 4e-7, 10);
		assert.ok(steps(tiny).every((step) => step > 0));
		assert.deepEqual([tiny.min, tiny.max, tiny.step], [0, 4.5e-7, 5e-8]);
	});
});

describe('maxIntervalsFor', () => {
	test('one interval per label extent, between 1 and 10', () => {
		assert.equal(maxIntervalsFor(500, 30), 10);
		assert.equal(maxIntervalsFor(100, 30), 3);
		assert.equal(maxIntervalsFor(10, 30), 1);
		assert.equal(maxIntervalsFor(0, 0), 1);
		assert.equal(maxIntervalsFor(50, 0), 10);
	});
});

describe('stackCategoryValues', () => {
	const series = [{ values: [1, -2, null] }, { values: [3, 4, 5] }];
	test('bars stack positive and negative runs apart; lines accumulate; a gap is null except in an area', () => {
		const bars = stackCategoryValues(series, 3, 'bar', 'stacked');
		assert.deepEqual(bars[1].map((point) => point && [point.from, point.to]), [[1, 4], [0, 4], [0, 5]]);
		assert.deepEqual(bars[0][1], { value: -2, from: 0, to: -2 });
		assert.equal(bars[0][2], null);
		assert.equal(stackCategoryValues(series, 3, 'area', 'stacked')[0][2].to, 0);
		assert.deepEqual(stackCategoryValues(series, 3, 'line', 'stacked')[1].map((point) => point.to), [4, 2, 5]);
	});
	test('100% divides by the category total and rejects an overflowing total', () => {
		assert.equal(stackCategoryValues(series, 3, 'bar', 'percentStacked')[1][0].to, 1);
		assert.throws(() => stackCategoryValues([{ values: [Number.MAX_VALUE] }, { values: [Number.MAX_VALUE] }], 1, 'bar', 'stacked'), RangeError);
	});
});

describe('chartValueAxis', () => {
	test('a column chart gets min, max and majorUnit; a bar and a line chart too', () => {
		const axis = axisOf(chartOf([[120, 480, 760, 310]]));
		assert.deepEqual(axis, { min: 0, max: 800, majorUnit: 100 });
		assert.deepEqual(axisOf(chartOf([[120, 480, 760, 310]], 'bar')), axis);
		assert.deepEqual(axisOf(chartOf([[120, 480, 760, 310]], 'line')), axis);
	});

	test('bars and areas include zero, a line follows its data', () => {
		const high = chartOf([[980, 990, 1000]]);
		assert.equal(axisOf({ ...high, type: 'column' }).min, 0);
		assert.equal(axisOf({ ...high, type: 'area' }).min, 0);
		assert.deepEqual(axisOf({ ...high, type: 'line' }), { min: 975, max: 1005, majorUnit: 5 });
	});

	test('stacked totals set the bound; 100% charts get a fractional percent axis', () => {
		assert.deepEqual(axisOf(chartOf([[100, 200], [300, 150]], 'stacked-column')), { min: 0, max: 450, majorUnit: 50 });
		assert.deepEqual(axisOf(chartOf([[1, 2], [3, 4]], '100pct-stacked-column')), { min: 0, max: 1, majorUnit: 0.1, percent: true });
	});

	test('a short chart gets fewer, larger intervals; the slide scale and minFontSize move the density', () => {
		const chart = chartOf([[120, 480, 760, 310]]);
		const tall = axisOf(chart, { width: 800, height: 450, scale: 1 });
		const short = axisOf(chart, { width: 800, height: 200, scale: 1 });
		assert.equal(tall.majorUnit, 100);
		assert.equal(axisOf(chart, { width: 800, height: 300, scale: 1 }).majorUnit, 100);
		assert.equal(short.majorUnit, 200);
		assert.equal(axisOf(chart, { width: 800, height: 150, scale: 1 }).majorUnit, 500);
		assert.equal(axisOf(chart, { width: 800, height: 450, scale: 1, minFontSize: 40 }).majorUnit, 200);
		assert.equal(axisOf(chart, { width: 1600, height: 900, scale: 2 }).majorUnit, 100);
		assert.equal(CHART_TEXT_PX, 14);
	});

	test('a bottom legend and a category axis title take height from the plot', () => {
		const base = chartOf([[120, 480, 760, 310]]);
		const geometry = { width: 800, height: 260, scale: 1 };
		const plain = axisOf(base, geometry);
		const crowded = axisOf({ ...base, legend: 'bottom', axisTitles: { category: 'Quarter' } }, geometry);
		assert.ok(crowded.majorUnit >= plain.majorUnit);
		assert.equal(axisOf({ ...base, legend: 'bottom', axisTitles: { category: 'Quarter' } }, { width: 800, height: 450, scale: 1 }).majorUnit, 100);
	});

	test('other types, unresolved data and bad geometry give no axis', () => {
		for (const type of ['pie', 'scatter', 'radar', 'combo', 'waterfall', 'funnel', 'treemap', 'nonsense'])
			assert.equal(axisOf(chartOf([[1, 2, 3]], type)), undefined, type);
		assert.equal(axisOf({ type: 'column', data: { dataset: 'missing' } }), undefined);
		assert.equal(axisOf(chartOf([[1, 2]]), { width: 0, height: 450, scale: 1 }), undefined);
		assert.equal(chartValueAxis(undefined, { ok: false, reason: 'no-rows', message: '', diagnostics: [] }, { width: 1, height: 1, scale: 1 }), undefined);
	});

	test('gaps and non-numeric cells are not plotted', () => {
		assert.deepEqual(axisOf(chartOf([[10, null, 'x', 90]])), { min: 0, max: 100, majorUnit: 10 });
	});
});

describe('composition exposes the axis on the chart item', () => {
	const slide = (chart, extra = {}) => ({ title: 'Revenue', chart, ...extra });
	const compose = (document, index = 0) => composeSlide(document.slides[index], { width: 1280, height: 720, presentation: document, slideIndex: index });
	const chartItem = (composed) => composed.items.find((item) => item.field === 'chart');

	test('a column chart carries its axis, computed from its own box', () => {
		const chart = chartOf([[120, 480, 760, 310]]);
		const item = chartItem(compose({ slides: [slide(chart)] }));
		assert.deepEqual(item.chart.valueAxis, axisOf(chart, { width: item.box.width, height: item.box.height, scale: 1 }));
		assert.equal(item.chart.valueAxis.max, 800);
		assert.equal(item.chart.valueAxis.majorUnit, 100);
	});

	test('a half-height box (chart beside a text block, or below one) gets fewer intervals than a full one', () => {
		const chart = chartOf([[120, 480, 760, 310]]);
		const full = chartItem(compose({ slides: [slide(chart)] }));
		const squeezed = chartItem(compose({ slides: [{ title: 'Revenue', bullets: ['One', 'Two', 'Three', 'Four', 'Five'], chart, composition: { mode: 'column' } }] }));
		assert.ok(squeezed.box.height < full.box.height);
		assert.ok(squeezed.chart.valueAxis.majorUnit >= full.chart.valueAxis.majorUnit);
	});

	test('the slide scale follows the canvas, and a dataset chart is resolved too', () => {
		const document = { datasets: { sales: { columns: ['Quarter', 'Sales'], rows: [['Q1', 120], ['Q2', 480], ['Q3', 790]] } }, slides: [slide({ type: 'column', data: { dataset: 'sales' } })] };
		const item = chartItem(composeSlide(document.slides[0], { width: 1920, height: 1080, presentation: document, slideIndex: 0 }));
		assert.deepEqual(item.chart.valueAxis, { min: 0, max: 900, majorUnit: 100 });
	});

	test('other chart types and non-chart items carry no chart', () => {
		const composed = compose({ slides: [slide(chartOf([[1, 2, 3]], 'pie'), { bullets: ['One'] })] });
		assert.equal(chartItem(composed).chart, undefined);
		assert.ok(composed.items.filter((item) => item.field !== 'chart').every((item) => item.chart === undefined));
	});

	test('the names live on /composition, not the package root', () => {
		for (const name of ['niceScale', 'maxIntervalsFor', 'stackCategoryValues', 'chartValueAxis', 'CHART_TEXT_PX']) assert.equal(root[name], undefined, name);
	});
});
