// RR-105 finding 06: a small radar fills its box (square box, legend under the web when that is larger, an axis that follows the data).
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide} from '../dist/composition.js';

const skills = {columns: ['Skill', 'Team A', 'Team B'], rows: [['Design', 4, 3], ['Research', 3, 5], ['Build', 5, 4], ['Test', 2, 4], ['Ship', 4, 3]]};
const charts = (slide, width = 1280, height = 720) => composeSlide(slide, {width, height}).items.filter((item) => item.field === 'chart');

test('three radars in a row: square boxes, legend under the web, axis to 6 for data to 5', () => {
  const items = charts({title: 'Two teams, five skills', blocks: ['radar', 'radar-with-markers', 'filled-radar'].map((type) => ({chart: {type, data: skills}}))});
  assert.equal(items.length, 3);
  for (const item of items) {
    assert.ok(Math.abs(item.box.height - item.box.width) < 0.01, `square box ${JSON.stringify(item.box)}`);
    assert.equal(item.chart.layer.radar.legend, 'bottom');
    const box = item.chart.layer.radar.legendBox;
    assert.ok(box.y + box.height <= item.box.y + item.box.height && box.y > item.box.y + item.box.height / 2, 'the legend is a row at the bottom of the box');
    assert.deepEqual(item.chart.layer.radar.axis, {min: 0, max: 6, majorUnit: 2});
  }
});

test('a wide radar keeps its side legend; an authored legend is the author\'s', () => {
  const [wide] = charts({title: 'One radar', chart: {type: 'radar', data: skills}});
  assert.equal(wide.chart.layer.radar.legend, 'right');
  assert.equal(wide.chart.layer.radar.legendBox, undefined);
  assert.equal(wide.chart.layer.radar.axis.max, 6);
  const [authored] = charts({title: 'Two', blocks: [{chart: {type: 'radar', data: skills, legend: 'right'}}, {chart: {type: 'radar', data: skills}}, {chart: {type: 'radar', data: skills}}]});
  assert.equal(authored.chart.layer.radar.legend, 'right');
});
