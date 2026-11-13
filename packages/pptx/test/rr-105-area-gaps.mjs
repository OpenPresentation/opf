// RR-105 finding 08: a gap in a line or area chart stays a gap in PowerPoint (c:dispBlanksAs "gap" and an omitted c:pt),
// as the preview draws it, and the import returns the same data.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {unzipSync} from 'fflate';
import {toPptx, fromPptx} from '../dist/index.js';
import {chartOrderProblems} from './helpers/chart-schema-order.mjs';

const decoder = new TextDecoder();
const rows = [['Jul', 1200], ['Aug', 1350], ['Sep', null], ['Oct', 1610]];
const chart = (type) => ({type, data: {columns: ['Month', 'Visits'], rows}});

for (const type of ['area', 'stacked-area', 'line', 'line-with-markers']) {
  test(`${type}: a null is an empty point and PowerPoint shows it as a gap`, async () => {
    const bytes = await toPptx({design: {fontScheme: 'roboto'}, slides: [{title: 'Visits', chart: chart(type)}]});
    const xml = decoder.decode(unzipSync(bytes)['ppt/charts/chart1.xml']);
    assert.deepEqual(chartOrderProblems(xml), []);
    assert.equal(/<c:dispBlanksAs val="([^"]*)"\/>/.exec(xml)?.[1], 'gap');
    const cache = /<c:val>[\s\S]*?<\/c:val>/.exec(xml)[0];
    assert.match(cache, /<c:ptCount val="4"\/>/);
    assert.doesNotMatch(cache, /<c:pt idx="2">/, 'the gap writes no point (never 0)');
    const imported = (await fromPptx(bytes)).slides[0].chart;
    assert.equal(imported.type, type);
    assert.deepEqual(imported.data.rows.map((row) => row[1]), [1200, 1350, null, 1610], 'the import returns the gap');
  });
}
