// LH-182: a doughnut's square and its hole are composed in core (layer.doughnut), so both engines draw the doughnut in one place and fill
// its hole with the surface the chart stands on.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';

const quarters = { columns: ['Quarter', 'Current', 'Baseline'], rows: [['Q1', 13, 10], ['Q2', 17, 12], ['Q3', 20, 14], ['Q4', 24, 16]] };
const chartOf = (chart) => composeSlide({ title: 'Signal Trend', chart }, { width: 1280, height: 720 }).items.find((item) => item.field === 'chart');

test('nested rings get a square inside the chart box and a hole of half the radius', () => {
	const item = chartOf({ type: 'doughnut', data: quarters });
	const doughnut = item.chart.layer.doughnut;
	assert.ok(doughnut, 'a doughnut layer');
	const { pie, hole } = doughnut;
	assert.ok(Math.abs(pie.width - pie.height) < 1e-9, 'a square');
	assert.ok(pie.x >= item.box.x && pie.y >= item.box.y && pie.x + pie.width <= item.box.x + item.box.width && pie.y + pie.height <= item.box.y + item.box.height, 'inside the chart box');
	assert.ok(Math.abs(hole.r - pie.width / 4) < 1e-9 && Math.abs(hole.cx - (pie.x + pie.width / 2)) < 1e-9 && Math.abs(hole.cy - (pie.y + pie.height / 2)) < 1e-9);
	assert.ok(pie.x + pie.width < item.box.x + item.box.width - 40, 'the category legend keeps its room at the end');
});

test('a pie of several series is drawn as nested rings and gets one too; a pie and a chart with options do not', () => {
	assert.ok(chartOf({ type: 'pie', data: quarters }).chart.layer.doughnut, 'nested-rings fallback');
	const one = { columns: ['Quarter', 'Current'], rows: quarters.rows.map((row) => row.slice(0, 2)) };
	assert.equal(chartOf({ type: 'pie', data: one }).chart.layer?.doughnut, undefined, 'a pie has no hole');
	assert.equal(chartOf({ type: 'doughnut', data: quarters, legend: 'bottom' }).chart.layer?.doughnut, undefined, 'options carve the box themselves');
});

test('a doughnut with a value list takes the list square', () => {
	const shares = { columns: ['Channel', 'Share'], rows: [['Direct', 42], ['Partner', 31], ['Online', 18], ['Other', 9]] };
	const layer = chartOf({ type: 'doughnut', data: shares }).chart.layer;
	if (layer.valueList) assert.deepEqual(layer.doughnut.pie, layer.valueList.pie);
	else assert.ok(layer.doughnut, 'a one-series doughnut without a list still gets its square');
});
