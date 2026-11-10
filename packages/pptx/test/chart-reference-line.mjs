import assert from 'node:assert/strict';
import {test} from 'node:test';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {fromPptx, toPptx} from '../dist/index.js';

const chartOf = document => document.slides[0].chart ?? document.slides[0].blocks.find(block => block.chart).chart;
const source = (type, stroke) => ({design: {fontScheme: 'roboto'}, slides: [{chart: {type,
  data: {columns: ['Category', 'Value'], rows: [['A', 10], ['B', 20]]},
  referenceLines: [{value: 15, label: 'Target', ...(stroke !== undefined ? {stroke} : {})}]}}]});

for (const type of ['column', 'bar', 'line', 'line-with-markers', 'area', 'combo']) {
  test(`${type} preserves authored partial, absent and none reference strokes with canonical axis/label defaults`, async () => {
    for (const stroke of [undefined, {color: '#123456'}, {width: 2}, {dash: 'dash'}, 'none']) {
      const document = source(type, stroke), back = await fromPptx(await toPptx(document));
      assert.deepEqual(chartOf(back).referenceLines, [{value: 15, axis: 'value', label: 'Target', labelPosition: 'end', ...(stroke !== undefined ? {stroke} : {})}]);
      assert.equal(back.slides[0].shapes?.length ?? 0, 0, 'owned lines and labels are consumed once');
    }
  });
}

for (const type of ['line', 'bar']) {
  test(`${type} keeps a current native color edit visible instead of replaying the authored partial stroke`, async () => {
    const parts = unzipSync(await toPptx(source(type, {color: '#123456'})));
    const part = type === 'line' ? 'ppt/charts/chart1.xml' : 'ppt/slides/slide1.xml';
    const xml = strFromU8(parts[part]);
    assert.equal((xml.match(/<a:srgbClr val="123456"/g) ?? []).length, 1, 'one actual reference paint is edited');
    parts[part] = strToU8(xml.replace('<a:srgbClr val="123456"', '<a:srgbClr val="654321"'));
    const diagnostics = [], back = await fromPptx(zipSync(parts), {onDiagnostic: issue => diagnostics.push(issue)});
    if (type === 'bar') {
      assert.equal(chartOf(back).referenceLines, undefined, 'an edited overlay loses its exact ownership binding');
      assert.equal(back.slides[0].shapes.length, 2, 'the current line and label remain ordinary visible shapes once');
      assert.ok(back.slides[0].shapes.some(shape => shape.stroke?.color === '#654321'));
      assert.ok(back.slides[0].shapes.some(shape => JSON.stringify(shape.text ?? '').includes('Target')));
      assert.ok(diagnostics.some(issue => issue.code === 'chart-reference-overlay-uncertain'));
      return;
    }
    const reference = chartOf(back).referenceLines[0];
    assert.equal(reference.stroke.color, '#654321');
    assert.equal(typeof reference.stroke.width, 'number');
    assert.equal(reference.stroke.dash, 'dash');
    assert.equal(reference.axis, 'value');
    assert.equal(reference.labelPosition, 'end');
    assert.equal(back.slides[0].shapes?.length ?? 0, 0);
  });
}
