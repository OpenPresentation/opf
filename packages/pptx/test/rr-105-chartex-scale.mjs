// RR-105 (v0.33 PowerPoint qualification, opf#1092): a native histogram and Pareto chart write core's value axis as cx:valScaling min, max
// and majorUnit (PowerPoint's automatic chartex axis drew 0 to 4,500 by 500 where the preview drew 0 to 5,000 by 1,000), a Pareto chart its
// percentage step, and the bin labels the preview draws are PowerPoint's (3.05 reads 3.1 under the 0.0 format both use).
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {composeSlide} from '@openpresentation/opf/composition';
import {toPptx} from '../dist/index.js';

const decoder = new TextDecoder();
const slideOf = (chart) => ({title: 'Chart', chart});
const chartexOf = async (chart) => decoder.decode(unzipSync(await toPptx({slides: [slideOf(chart)]}))['ppt/charts/chartEx1.xml']);
const layerOf = (chart) => composeSlide(slideOf(chart), {width: 1280, height: 720}).items.find((item) => item.field === 'chart').chart.layer.histogram;
const scaling = (xml, id) => new RegExp(`<cx:axis id="${id}"(?: hidden="1")?><cx:valScaling([^>]*)/>`).exec(xml)?.[1] ?? '';
const attr = (text, name) => Number(new RegExp(`${name}="([^"]+)"`).exec(text)?.[1]);

const pareto = {type: 'pareto', data: {columns: ['Cause', 'Orders'], rows: [['Carrier delay', 4120], ['Stock out', 2310], ['Address error', 1180], ['Customs', 640], ['Other', 310]]}};
{
  const layer = layerOf(pareto), xml = await chartexOf(pareto);
  const value = scaling(xml, 1);
  assert.deepEqual([attr(value, 'min'), attr(value, 'max'), attr(value, 'majorUnit')], [layer.valueAxis.min, layer.valueAxis.max, layer.valueAxis.majorUnit], 'Pareto value axis is core\'s');
  const percent = scaling(xml, 2);
  assert.deepEqual([attr(percent, 'min'), attr(percent, 'max'), attr(percent, 'majorUnit')], [0, 1, layer.percentUnit], 'Pareto percentage axis step is core\'s');
}
const days = [1.2, 1.8, 2.1, 2.4, 2.6, 2.9, 3.1, 3.3, 3.4, 3.8, 4.2, 4.4, 4.9, 5.3, 5.8, 6.4, 7.1, 8.6, 2.2, 2.7, 3, 3.6, 1.5, 4];
const histogram = {type: 'histogram', data: {columns: ['Days'], rows: days.map((value) => [value])}};
{
  const layer = layerOf(histogram), xml = await chartexOf(histogram);
  const value = scaling(xml, 1);
  assert.deepEqual([attr(value, 'min'), attr(value, 'max'), attr(value, 'majorUnit')], [layer.valueAxis.min, layer.valueAxis.max, layer.valueAxis.majorUnit], 'histogram value axis is core\'s');
  assert.match(xml, new RegExp(`<cx:binCount val="${layer.bins}"/>`));
  assert.ok(!xml.includes('<cx:axis id="2">'), 'a histogram has no percentage axis');
}
// Signed box data and running-total waterfalls now share explicit core scales too.
for (const [type, expected] of [['waterfall', [0, 6, 1]], ['box-and-whisker', [-4, 5, 2]]]) {
  const chart = {type, data: {columns: ['Step', 'Value'], rows: [['A', 4], ['B', -2], ['C', 3]]}};
  const core = composeSlide(slideOf(chart), {width: 1280, height: 720}).items.find(item => item.field === 'chart').chart.layer.numericAxes.value;
  assert.deepEqual([core.min, core.max, core.majorUnit], expected, `${type}: exact signed-data scale`);
  const value = scaling(await chartexOf(chart), 1);
  assert.deepEqual([attr(value, 'min'), attr(value, 'max'), attr(value, 'majorUnit')], expected, `${type}: native axis is core's, including when hidden`);
}
console.log('RR-105 chartex scale: histogram, Pareto, waterfall and box value axes, the Pareto percentage step and the bin labels follow core in PowerPoint.');
