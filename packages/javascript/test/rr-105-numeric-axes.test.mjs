import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { resolveSlideContext } from '../dist/index.js';
import { chartNumericAxes, composeSlide, resolveChartData } from '../dist/composition.js';
import { gallery } from '@openpresentation/gallery';
const document = JSON.parse(fs.readFileSync(new URL('../../../examples/technical/chart-type-sampler.opf.json', import.meta.url), 'utf8'));
test('RR-105: sampler box and scatter retain reviewed preview axes', () => {
 const context = resolveSlideContext(document, 0, {catalogs: [gallery]});
 const items = composeSlide(context.slide, context.options).items.filter(item => item.field === 'chart');
 assert.deepEqual(items[0].chart.layer.numericAxes, {value: {min: 0, max: 15, majorUnit: 5}});
 assert.deepEqual(items[2].chart.layer.numericAxes, {value: {min: 0, max: 250, majorUnit: 100}, category: {min: 0, max: 500, majorUnit: 100}});
});
test('RR-105: scatter axes include all valid series and preserve numeric X gaps', () => {
 const chart = {type: 'scatter', data: {columns: ['Point', 'X', 'A', 'B'], rows: [['A', -100, 10, -20], ['B', 200, 40, 70], ['Gap', null, 10000, 20000]]}};
 const axes = chartNumericAxes(chart, resolveChartData(chart), {box: {x: 0, y: 0, width: 600, height: 400}, scale: 1, measure: (text, size) => text.length * size * .5});
 assert.ok(axes.value.min <= -20 && axes.value.max >= 70 && axes.value.max < 10000);
 assert.ok(axes.category.min <= -100 && axes.category.max >= 200);
});
