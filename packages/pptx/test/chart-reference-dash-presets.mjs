// OPF 0.37: every preset dash of a chart reference line is written as its a:prstDash and read back as the OPF name.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {fromPptx, toPptx} from '../dist/index.js';
import {PRESET_DASH_VALUES} from '../dist/shape-blocks.js';

const data = {columns: ['Quarter', 'Actual'], rows: [['Q1', 10], ['Q2', 20], ['Q3', 30]]};
let value = 12;
for (const [name, prst] of Object.entries(PRESET_DASH_VALUES)) {
  const deck = {design: {fontScheme: 'roboto'}, slides: [{title: 'Dash', chart: {type: 'line', data, referenceLines: [{value: value++, label: 'Target', stroke: {color: '#BC1234', width: 2, dash: name}}]}}]};
  const bytes = await toPptx(deck);
  const xml = strFromU8(unzipSync(bytes)['ppt/charts/chart1.xml']);
  assert.ok(xml.includes(`<a:prstDash val="${prst}"/>`), `${name} is written as ${prst}`);
  const back = await fromPptx(bytes);
  const chart = back.slides[0].chart ?? back.slides[0].blocks?.find(block => block.chart)?.chart;
  assert.equal(chart.referenceLines?.[0]?.stroke?.dash ?? 'dash', name === 'dash' ? 'dash' : name, `${name} comes back`);
}
console.log('Reference line dashes passed: every preset is written as a:prstDash and read back.');
