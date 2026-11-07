// LH-60, LH-33 and LH-35: chart fallbacks (chartDrawPlan), the chart-series-dropped warning, shared axes of sibling charts and the
// lightness check of chart-color-only.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { chartDrawPlan, chartDrawDiagnostics, composeSlide, isPlaceLabel, resolveChartData, shareSiblingChartAxes } from '../dist/composition.js';
import { validate } from '../dist/index.js';

const quarters = { columns: ['Quarter', 'Current', 'Baseline'], rows: [['Q1', 21, 18], ['Q2', 25, 20], ['Q3', 28, 22], ['Q4', 32, 24]] };
const plan = (chart, options) => {
	const resolved = resolveChartData(chart);
	assert.equal(resolved.ok, true);
	return chartDrawPlan(chart, resolved, options);
};
const found = async (document, rule) => (await validate(document)).findings.filter((finding) => finding.ruleId === `opf/${rule}`);

describe('chartDrawPlan', () => {
	test('a map over categories that are not places draws as columns with every series', () => {
		const drawn = plan({ type: 'world', data: quarters });
		assert.equal(drawn.type, 'column');
		assert.equal(drawn.fallback, 'map-as-columns');
		assert.deepEqual(drawn.columns, quarters.columns);
		assert.deepEqual(drawn.dropped, []);
	});

	test('a map over places stays a map and plots one series', () => {
		const countries = { columns: ['Country', 'Sales', 'Target'], rows: [['Germany', 4, 5], ['FR', 3, 3], ['United States', 9, 8], ['Other', 1, 1]] };
		const drawn = plan({ type: 'world', data: countries });
		assert.equal(drawn.type, 'world');
		assert.equal(drawn.fallback, undefined);
		assert.deepEqual(drawn.dropped, ['Target']);
	});

	test('place names are read in the deck language (CLDR region names) and in English', () => {
		assert.equal(isPlaceLabel('Deutschland', 'de'), true);
		assert.equal(isPlaceLabel('ألمانيا', 'ar'), true);
		assert.equal(isPlaceLabel('Germany', 'ar'), true);
		assert.equal(isPlaceLabel('Texas'), true);
		assert.equal(isPlaceLabel('Q1'), false);
		assert.equal(isPlaceLabel('de'), false, 'a region code is upper case');
		const arabic = { columns: ['الدولة', 'المبيعات'], rows: [['ألمانيا', 4], ['فرنسا', 3], ['مصر', 2]] };
		assert.equal(plan({ type: 'world', data: arabic }, { language: 'ar' }).type, 'world');
	});

	test('one value per box-and-whisker category draws one box per series', () => {
		const drawn = plan({ type: 'box-and-whisker', data: quarters });
		assert.equal(drawn.fallback, 'box-per-series');
		assert.deepEqual(drawn.rows.map((row) => row[0]), ['Quarter', 'Quarter', 'Quarter', 'Quarter']);
		assert.deepEqual(drawn.rows.map((row) => row.slice(1)), quarters.rows.map((row) => row.slice(1)));
		const grouped = { columns: ['Team', 'Days'], rows: [['A', 3], ['A', 5], ['B', 4], ['B', 6]] };
		assert.equal(plan({ type: 'box-and-whisker', data: grouped }).fallback, undefined, 'repeated categories are distributions already');
	});

	test('a pie or doughnut of several series draws nested rings; one series stays as authored', () => {
		for (const type of ['pie', 'doughnut']) {
			const drawn = plan({ type, data: quarters });
			assert.equal(drawn.type, 'doughnut', type);
			assert.equal(drawn.fallback, 'nested-rings', type);
			assert.deepEqual(drawn.dropped, [], type);
		}
		const single = { columns: ['Region', 'Share'], rows: [['EMEA', 40], ['APAC', 60]] };
		assert.equal(plan({ type: 'pie', data: single }).type, 'pie');
		assert.equal(plan({ type: 'pie', data: single }).fallback, undefined);
	});

	test('a scatter whose X column holds no numbers plots its series against the category position', () => {
		const data = { columns: ['Name', 'Region', 'Score', 'Target'], rows: [['a', 'North', 4, 5], ['b', 'South', 6, 5]] };
		const drawn = plan({ type: 'scatter', data });
		assert.equal(drawn.fallback, 'scatter-by-position');
		assert.equal(drawn.hasX, false);
		assert.deepEqual(drawn.columns, ['Name', 'Score', 'Target']);
		assert.deepEqual(drawn.sources, [0, 2, 3]);
		assert.deepEqual(drawn.dropped, ['Region']);
		const numeric = plan({ type: 'scatter', data: quarters });
		assert.equal(numeric.hasX, true, 'a numeric X column stays the X axis');
		assert.equal(numeric.fallback, undefined);
	});

	test('a Pareto chart of several series draws as clustered columns with every series (LH-175)', () => {
		const drawn = plan({ type: 'pareto', data: quarters });
		assert.equal(drawn.type, 'column');
		assert.equal(drawn.kind, 'bar');
		assert.equal(drawn.fallback, 'pareto-as-columns');
		assert.deepEqual(drawn.columns, quarters.columns);
		assert.deepEqual(drawn.rows, quarters.rows, 'data order, not sorted');
		assert.deepEqual(drawn.dropped, []);
		const one = plan({ type: 'pareto', data: { columns: ['Quarter', 'Current'], rows: quarters.rows.map(row => row.slice(0, 2)) } });
		assert.equal(one.type, 'pareto');
		assert.equal(one.fallback, undefined);
	});

	test('one-series constructs name the series they leave out', () => {
		for (const type of ['treemap', 'funnel', 'waterfall', 'histogram']) assert.deepEqual(plan({ type, data: quarters }).dropped, ['Baseline'], type);
		const notes = { columns: ['Quarter', 'Current', 'Note'], rows: [['Q1', 21, 'a'], ['Q2', 25, 'b']] };
		assert.deepEqual(plan({ type: 'pareto', data: notes }).dropped, ['Note'], 'a Pareto chart of one numeric series names the other column');
		for (const type of ['column', 'line', 'radar', 'combo']) assert.deepEqual(plan({ type, data: quarters }).dropped, [], type);
		const resolved = resolveChartData({ type: 'treemap', data: quarters });
		const [diagnostic] = chartDrawDiagnostics({ type: 'treemap', data: quarters }, resolved, '/slides/0/chart');
		assert.equal(diagnostic.code, 'chart-series-dropped');
		assert.equal(diagnostic.path, '/slides/0/chart/type');
		assert.match(diagnostic.message, /plots one series, so "Baseline" is not drawn/);
	});
});

describe('opf/chart-series-dropped', () => {
	test('validate warns about a series the chart type cannot draw, and not about a fallback that draws every series', async () => {
		const deck = (chart) => ({ slides: [{ title: 'T', chart: { alt: 'A chart', ...chart } }] });
		const dropped = await found(deck({ type: 'funnel', data: quarters }), 'chart-series-dropped');
		assert.equal(dropped.length, 1);
		assert.equal(dropped[0].severity, 'warning');
		assert.equal(dropped[0].path, '/slides/0/chart/type');
		for (const type of ['world', 'box-and-whisker', 'pie', 'doughnut', 'pareto', 'column']) assert.equal((await found(deck({ type, data: quarters }), 'chart-series-dropped')).length, 0, type);
	});
});

describe('LH-33: sibling charts of one unit share their value axis', () => {
	test('shareSiblingChartAxes unites charts of one unit and leaves other units alone', () => {
		const make = (rows, axis, format) => ({ value: { type: 'column', data: { columns: ['Quarter', format ? { name: 'Current', format } : 'Current'], rows } }, chart: { valueAxis: axis } });
		const a = make([['Q1', 10]], { min: 0, max: 12, majorUnit: 2 });
		const b = make([['Q1', 40]], { min: 0, max: 50, majorUnit: 10 });
		const other = make([['Q1', 0.4]], { min: 0, max: 0.5, majorUnit: 0.1 }, '0%');
		shareSiblingChartAxes([a, b, other]);
		assert.deepEqual(a.chart.valueAxis, b.chart.valueAxis);
		assert.equal(a.chart.valueAxis.max >= 50, true);
		assert.deepEqual(other.chart.valueAxis, { min: 0, max: 0.5, majorUnit: 0.1 });
	});

	test('two column charts of the same series on one slide get one axis from composeSlide', () => {
		const slide = { title: 'Two charts', blocks: [
			{ chart: { type: 'column', data: { columns: ['Quarter', 'Current', 'Baseline'], rows: [['Q1', 5, 4], ['Q2', 7, 6]] } } },
			{ chart: { type: 'column', data: { columns: ['Quarter', 'Current', 'Baseline'], rows: [['Q1', 50, 40], ['Q2', 70, 60]] } } },
		] };
		const charts = composeSlide(slide).items.filter((item) => item.field === 'chart');
		assert.equal(charts.length, 2);
		assert.deepEqual(charts[0].chart.valueAxis, charts[1].chart.valueAxis);
		assert.equal(charts[0].chart.valueAxis.max >= 70, true);
	});
});

describe('LH-35: chart-color-only checks lightness', () => {
	test('neighbouring series of one lightness are reported as a lightness pair', async () => {
		// A red and a blue 10.6 L* apart: clear of the greyscale threshold (10), under the engines' neighbour step (11).
		const deck = (colors) => ({ slides: [{ title: 'T', chart: { type: 'column', alt: 'A', colors, data: quarters } }] });
		const close = await found(deck(['#A84B47', '#4A86C4']), 'chart-color-only');
		assert.equal(close.length, 1);
		assert.match(close[0].message, /lightness/);
		assert.equal((await found(deck(['#1B4F72', '#F5B041']), 'chart-color-only')).length, 0);
	});
});
