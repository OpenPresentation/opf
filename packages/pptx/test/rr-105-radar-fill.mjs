// RR-105 finding 06: a radar writes core's value axis and, in a narrow box, its legend under the web at core's box with the plot above;
// the import reads that legend as the default, so the document comes back unchanged.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {unzipSync} from 'fflate';
import {toPptx, fromPptx} from '../dist/index.js';
import {chartOrderProblems} from './helpers/chart-schema-order.mjs';

const decoder = new TextDecoder();
const skills = {columns: ['Skill', 'Team A', 'Team B'], rows: [['Design', 4, 3], ['Research', 3, 5], ['Build', 5, 4], ['Test', 2, 4], ['Ship', 4, 3]]};
const attr = (xml, element) => new RegExp(`<c:${element} val="([^"]*)"/>`).exec(xml)?.[1];
const valAx = (xml) => /<c:valAx>[\s\S]*?<\/c:valAx>/.exec(xml)[0];

test('three radars in a row: bottom legend at a manual position, plot above it, axis 0 to 6 by 2; import keeps no legend option', async () => {
  const doc = {design: {fontScheme: 'roboto', background: 'light1'}, slides: [{title: 'Two teams, five skills', blocks: ['radar', 'radar-with-markers', 'filled-radar'].map((type) => ({chart: {type, data: structuredClone(skills)}}))}]};
  const bytes = await toPptx(doc), entries = unzipSync(bytes);
  for (const part of ['ppt/charts/chart1.xml', 'ppt/charts/chart2.xml', 'ppt/charts/chart3.xml']) {
    const xml = decoder.decode(entries[part]);
    assert.deepEqual(chartOrderProblems(xml), [], part);
    assert.match(xml, /<c:legend>\s*<c:legendPos val="b"\/><c:layout><c:manualLayout>/, part);
    assert.match(xml, /<c:plotArea><c:layout><c:manualLayout><c:layoutTarget val="outer"\/>/, part);
    const axis = valAx(xml);
    assert.equal(attr(axis, 'max'), '6', part);
    assert.equal(attr(axis, 'min'), '0', part);
    assert.equal(attr(axis, 'majorUnit'), '2', part);
  }
  const imported = await fromPptx(bytes);
  const charts = imported.slides[0].blocks.map((block) => block.chart);
  assert.deepEqual(charts.map((chart) => chart.type), ['radar', 'radar-with-markers', 'filled-radar']);
  for (const chart of charts) {
    assert.equal(chart.legend, undefined, 'the default legend imports as no option');
    assert.deepEqual(chart.data, skills);
  }
});

test('a wide radar keeps its side legend and writes its axis; an authored bottom legend imports as authored', async () => {
  const wide = await toPptx({design: {fontScheme: 'roboto'}, slides: [{title: 'One radar', chart: {type: 'radar', data: skills}}]});
  const xml = decoder.decode(unzipSync(wide)['ppt/charts/chart1.xml']);
  assert.equal(attr(xml, 'legendPos'), 'r');
  assert.equal(attr(valAx(xml), 'max'), '6');
  assert.equal((await fromPptx(wide)).slides[0].chart.legend, undefined);
  const authored = await toPptx({design: {fontScheme: 'roboto'}, slides: [{title: 'One radar', chart: {type: 'radar', data: skills, legend: 'bottom'}}]});
  assert.equal((await fromPptx(authored)).slides[0].chart.legend, 'bottom');
});
