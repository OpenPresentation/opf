// Controls for reading a restored slide in either import form. Run: node --test restored-content.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {restoredCharts} from './restored-content.mjs';

const chart = type => ({type, data: {columns: ['A', 'B'], rows: [['x', 1]]}});

test('the old flat form: a chart block in slide.blocks', () => {
  assert.deepEqual(restoredCharts({title: 't', blocks: [{type: 'text', text: 'a'}, {type: 'chart', chart: chart('pie')}]}).map(c => c.type), ['pie']);
});
test('the authored form: a chart on the slide root', () => {
  assert.deepEqual(restoredCharts({title: 't', chart: chart('column')}).map(c => c.type), ['column']);
});
test('a chart inside a group or a region is found, in document order', () => {
  const slide = {blocks: [{group: {blocks: [{chart: chart('line')}]}}, {type: 'chart', chart: chart('bar')}], 'top:left': {chart: chart('area')}};
  assert.deepEqual(restoredCharts(slide).map(c => c.type), ['line', 'bar', 'area']);
});
test('a slide with no chart, or no slide, gives nothing', () => {
  assert.deepEqual(restoredCharts({title: 't', text: 'x'}), []);
  assert.deepEqual(restoredCharts(undefined), []);
  assert.deepEqual(restoredCharts({design: {chart: 'not a chart object'}}), []);
});
