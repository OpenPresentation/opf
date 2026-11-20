// RR-105 (v0.33 PowerPoint qualification, opf#1092): histogram bin edges round as PowerPoint rounds them (3.05 reads 3.1), and the value
// axis of a histogram or Pareto chart (and a Pareto chart's percentage step) is composed in core, so the preview and the chartex part agree.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide, histogramBins, histogramEdgeDecimals, histogramEdgeText } from '../dist/composition.js';

const days = [1.2, 1.8, 2.1, 2.4, 2.6, 2.9, 3.1, 3.3, 3.4, 3.8, 4.2, 4.4, 4.9, 5.3, 5.8, 6.4, 7.1, 8.6, 2.2, 2.7, 3, 3.6, 1.5, 4];
const layerOf = (chart) => composeSlide({ title: 'Chart', chart }, { width: 1280, height: 720 }).items.find((item) => item.field === 'chart').chart.layer;

test('an edge rounds its decimal value half away from zero, as PowerPoint does', () => {
	assert.equal(histogramEdgeText(1.2 + 1.85, 1), '3.1', '3.0499999999999998 is 3.05');
	assert.equal(histogramEdgeText(6.75, 1), '6.8');
	assert.equal(histogramEdgeText(-3.05, 1), '-3.1');
	assert.equal(histogramEdgeText(2.449, 1), '2.4');
	assert.equal(histogramEdgeText(0.125, 2), '0.13');
	assert.equal(histogramEdgeText(-0.04, 1), '0.0', 'no negative zero');
	assert.equal(histogramEdgeText(12, 0), '12');
	assert.equal(histogramEdgeText(1e300, 1), (1e300).toFixed(1), 'beyond the safe integers it keeps toFixed');
});

test('the qualification histogram labels its bins as PowerPoint does', () => {
	const bins = histogramBins(days, { count: 4, decimals: 1 });
	assert.deepEqual(bins.map((bin) => bin.label), ['[1.2, 3.1]', '(3.1, 4.9]', '(4.9, 6.8]', '(6.8, 8.6]']);
	assert.equal(histogramEdgeDecimals(1.85, [1.2, 3.05, 4.9, 6.75, 8.6]), 1);
});

test('a histogram and a Pareto chart carry the value axis both engines draw', () => {
	const histogram = layerOf({ type: 'histogram', data: { columns: ['Days'], rows: days.map((value) => [value]) } }).histogram;
	assert.ok(histogram.valueAxis, 'the histogram has a composed axis');
	assert.equal(histogram.valueAxis.min, 0);
	assert.ok(histogram.valueAxis.max >= Math.max(...histogramBins(days, { count: histogram.bins }).map((bin) => bin.count)));
	assert.equal(histogram.percentUnit, undefined, 'only a Pareto chart has a percentage axis');
	const pareto = layerOf({ type: 'pareto', data: { columns: ['Cause', 'Orders'], rows: [['Carrier delay', 4120], ['Stock out', 2310], ['Address error', 1180], ['Customs', 640], ['Other', 310]] } }).histogram;
	assert.equal(pareto.valueAxis.min, 0);
	assert.ok(pareto.valueAxis.max >= 4120 && pareto.valueAxis.max <= 4120 * 1.25, `the axis ends near the data (${pareto.valueAxis.max})`);
	assert.ok(pareto.percentUnit > 0 && pareto.percentUnit <= 0.5, `a percentage step (${pareto.percentUnit})`);
});
