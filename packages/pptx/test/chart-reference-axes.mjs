// LH-110: native reference helpers never change a chart's axes. Keynote refused line charts whose helpers had laid the axes out as for a
// horizontal bar (category axis left, value axis bottom); every axis element must equal the same chart's export without references.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { unzipSync, strFromU8 } from 'fflate';
import { toPptx, fromPptx } from '../dist/index.js';

const data = { columns: ['Quarter', 'Actual', 'Plan'], rows: [['Q1', 10, 12], ['Q2', 20, 18], ['Q3', 30, 26]] };
const refs = [
  { value: 25, label: 'Target', stroke: { color: '#BC1234', width: 2, dash: 'dash' } },
  { value: 15, stroke: { color: '#123456', width: 1, dash: 'dot' } },
  { value: 28, label: 'Stretch', labelPosition: 'start', stroke: { color: '#345678', width: 2, dash: 'solid' } },
];
const deck = (chart) => ({ design: { fontScheme: 'roboto' }, slides: [{ title: 'Results', chart }] });
const chartXml = async (d) => strFromU8(unzipSync(await toPptx(d))['ppt/charts/chart1.xml']);
const axes = (xml) => [...xml.matchAll(/<c:(catAx|valAx)>[\s\S]*?<\/c:\1>/g)].map((m) => m[0].replace(/>\s+</g, '><'));
const axisPositions = (xml) => [...xml.matchAll(/<c:(catAx|valAx)>[\s\S]*?<c:axPos val="(\w)"\/>[\s\S]*?<c:tickLblPos val="(\w+)"\/>/g)].map((m) => `${m[1]}:${m[2]}:${m[3]}`);

const cases = [
  ['line, one reference', { type: 'line', data, referenceLines: refs.slice(0, 1) }],
  ['line, three references', { type: 'line', data, referenceLines: refs }],
  ['line-with-markers', { type: 'line-with-markers', data, referenceLines: refs.slice(0, 2) }],
  ['area', { type: 'area', data, referenceLines: refs.slice(0, 1) }],
  ['column', { type: 'column', data, referenceLines: refs }],
  ['bar (horizontal, overlay references)', { type: 'bar', data, referenceLines: refs }, false],
  ['combo, references on both axes', { type: 'combo', data, line: ['Plan'], secondaryAxis: ['Plan'], referenceLines: [refs[0], { ...refs[1], axis: 'secondary' }] }],
];

// Every chart type that takes references (CHART_REFERENCE_TYPES): column, bar, line, line-with-markers, area and combo.
for (const [name, chart, vertical = true] of cases)
  test(`${name}: the axes equal the export without references, and the references import back`, async () => {
    const withRefs = await chartXml(deck(chart)),
      { referenceLines: _drop, ...plain } = chart,
      without = await chartXml(deck(plain));
    assert.ok(withRefs.includes('urn:openpresentation:chart-references:v1'), 'the chart carries its references');
    assert.deepEqual(axisPositions(withRefs), axisPositions(without));
    // A vertical chart: category axis at the bottom, primary value axis at the left.
    if (vertical) assert.deepEqual(axisPositions(withRefs).slice(0, 2), ['catAx:b:low', 'valAx:l:nextTo']);
    // Axis bounds come from composition with the references, so compare everything but c:scaling and c:majorUnit.
    const shape = (xml) => axes(xml).map((a) => a.replace(/<c:scaling>[\s\S]*?<\/c:scaling>/, '').replace(/<c:majorUnit val="[^"]*"\/>/, ''));
    assert.deepEqual(shape(withRefs), shape(without));
    const back = (await fromPptx(await toPptx(deck(chart)))).slides[0].chart;
    assert.deepEqual(back.referenceLines.map((r) => [r.value, r.axis, r.label]), chart.referenceLines.map((r) => [r.value, r.axis ?? 'value', r.label]));
    assert.deepEqual(back.data.rows, data.rows);
    assert.equal(back.type, chart.type);
  });
