import assert from 'node:assert/strict';
import {test} from 'node:test';
import {applyReferenceSeries, assertReferenceExportBudget} from '../dist/chart-references.js';
import {decodeTextTag} from '../dist/code-provenance.js';

const key = 'OPF chart budget';
const limit = 4 * 1024 * 1024;
const xml = '<c:chartSpace><c:chart><c:plotArea><c:lineChart><c:ser><c:idx val="0"/><c:tx><c:v>Data</c:v></c:tx></c:ser><c:ser><c:idx val="1"/><c:tx><c:v>Helper</c:v></c:tx></c:ser></c:lineChart></c:plotArea></c:chart></c:chartSpace>';
const series = [{labels: ['A', 'B'], values: [1, 2]}];

for (const authoredStroke of [{width: 4 / 3}, 'none']) {
  test(`preflight bounds actual ${JSON.stringify(authoredStroke)} helper metadata at the existing reader boundary`, () => {
    const line = index => ({index, value: 80, axis: 'value', labelPosition: 'end', native: true,
      strokeWidth: authoredStroke === 'none' ? 0 : 4 / 3,
      stroke: {color: '#123456', width: authoredStroke === 'none' ? 0 : 4 / 3, dash: 'solid'}, authoredStroke});
    // Obtain the fields from the real writer, then replicate only the bounded
    // ownership record. No enormous chart/workbook/export is needed.
    const written = applyReferenceSeries(xml, {key, primaryCount: 1, lines: [line(0)], context: {}, color: '#123456', hidden: []}, {});
    const hex = /<opf:references\b[^>]*\bdata="([A-F0-9]+)"/.exec(written)?.[1];
    assert.ok(hex);
    const record = decodeTextTag(hex);
    assert.equal(record.helpers.length, 1);
    const helper = record.helpers[0];
    assert.deepEqual(helper.stroke, authoredStroke);
    assert.equal(helper.written, authoredStroke === 'none' ? '0|123456|0|solid' : '12700|123456|255|solid');
    const item = index => ({...helper, id: `${key}:${index}`, index});
    let bytes = Buffer.byteLength(JSON.stringify({...record, helpers: []})), count = 0, below;
    while (bytes * 2 <= limit) {
      below = bytes * 2;
      bytes += Buffer.byteLength(JSON.stringify(item(count))) + Number(count > 0);
      count++;
    }
    const lines = Array.from({length: count}, (_, index) => line(index));
    assert.equal(Buffer.byteLength(JSON.stringify({...record, helpers: lines.map((_, index) => item(index))})) * 2, bytes * 2);
    assert.ok(below <= limit && bytes * 2 > limit, 'adjacent counts straddle the unchanged 4 MiB hex limit');
    assert.doesNotThrow(() => assertReferenceExportBudget(series, lines.slice(0, -1), {key}));
    assert.throws(() => assertReferenceExportBudget(series, lines, {key}), error =>
      error.code === 'chart-reference-resource-limit' && error.details?.budget === 'ownership-metadata' && error.details?.limit === limit);
  });
}
