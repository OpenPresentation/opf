// RR-105 finding 09: PowerPoint shows a reference label where the preview does: at the free end of its line (the c:dLbl point), on a
// plate of the chart's surface when no free place exists, and the import returns the authored labelPosition.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {unzipSync} from 'fflate';
import {toPptx, fromPptx} from '../dist/index.js';
import {chartOrderProblems} from './helpers/chart-schema-order.mjs';

const decoder = new TextDecoder();
const deck = (type, value, extra = {}) => ({design: {fontScheme: 'roboto', background: 'light1'}, slides: [{title: 'Floor line', chart: {type, data: {columns: ['Quarter', 'Revenue'], rows: [['Q1', 12], ['Q2', 18], ['Q3', 22], ['Q4', 26]]}, referenceLines: [{value, label: 'Floor', ...extra}]}}]});
const label = (xml) => /<c:dLbl>([\s\S]*?)<\/c:dLbl>/.exec(xml)?.[1];

for (const [type, value, idx, plate] of [['column', 15, 0, false], ['area', 15, 0, false], ['column', 6, 3, true], ['area', 6, 3, true], ['line', 15, 3, false]]) {
  test(`${type} at ${value}: label on point ${idx}${plate ? ' on a plate' : ''}, authored end kept on import`, async () => {
    for (const labelPosition of [undefined, 'end', 'start']) {
      const doc = deck(type, value, labelPosition ? {labelPosition} : {});
      const bytes = await toPptx(doc), xml = decoder.decode(unzipSync(bytes)['ppt/charts/chart1.xml']);
      assert.deepEqual(chartOrderProblems(xml), []);
      const dLbl = label(xml);
      assert.ok(dLbl, 'the helper series carries its label');
      if (labelPosition !== 'start') assert.match(dLbl, new RegExp(`^<c:idx val="${idx}"/>`));
      // Both ends are blocked at 6 and the start is free at 15, whichever end the author asked for.
      assert.equal(/<c:spPr><a:solidFill>/.test(dLbl), plate);
      const ref = (await fromPptx(bytes)).slides[0].chart.referenceLines[0];
      assert.equal(ref.labelPosition, labelPosition ?? 'end', 'the import returns the authored end, not the drawn one');
      assert.equal(ref.label, 'Floor');
    }
  });
}

test('a horizontal bar label overlay on a plate is filled and imports unchanged', async () => {
  const doc = {design: {fontScheme: 'roboto', background: 'light1'}, slides: [{title: 'Floor', chart: {type: 'bar', data: {columns: ['Region', 'Sales'], rows: [['North', 12], ['South', 18]]}, referenceLines: [{value: 15, label: 'Floor'}]}}]};
  const bytes = await toPptx(doc);
  const ref = (await fromPptx(bytes)).slides[0].chart.referenceLines[0];
  assert.deepEqual({value: ref.value, label: ref.label, labelPosition: ref.labelPosition}, {value: 15, label: 'Floor', labelPosition: 'end'});
});
