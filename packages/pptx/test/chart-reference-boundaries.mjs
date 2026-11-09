// LH-110: bounded export and current fallback eligibility; no large workbook allocation.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { XMLParser } from 'fast-xml-parser';
import { referenceChartTypes } from '../dist/chart-references.js';
import { planScriptFonts } from '../dist/script-fonts.js';
import { toPptx, fromPptx } from '../dist/index.js';
import { toSvg } from '@openpresentation/opf-render/svg';
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false });
const arr = (v) => v === undefined ? [] : Array.isArray(v) ? v : [v];
const line = (value = 17.123456789) => ({ value, label: 'Target', stroke: { color: '#BC1234', width: 2, dash: 'dash' } });
const deck = (type, refs = [line()], rows = [['Only', 20]]) => ({ design: { fontScheme: 'roboto' }, slides: [{ title: 'Results', chart: { type, data: { columns: ['Category', 'Actual'], rows }, referenceLines: refs } }] });
const chart = (d) => d.slides[0].chart ?? d.slides[0].blocks?.find((b) => b.chart)?.chart;
const ownedHelper = (s) => s.includes('opf:reference ');
const series = (xml) => [...xml.matchAll(/<c:ser>[\s\S]*?<\/c:ser>/g)].map((m) => m[0]);
async function exported(d) { const bytes = await toPptx(d), entries = unzipSync(bytes); return { bytes, entries, xml: strFromU8(entries['ppt/charts/chart1.xml']) }; }
async function imported(bytes) { const diagnostics = [], document = await fromPptx(bytes, { onDiagnostic: (d) => diagnostics.push(d) }); return { document, chart: chart(document), diagnostics }; }
const rewrite = (e, fn) => { const changed = fn(e.xml); assert.notEqual(changed, e.xml, 'control really edits current chart XML'); return zipSync({ ...e.entries, 'ppt/charts/chart1.xml': strToU8(changed) }); };
for (const [name, points, count, limit, ordinaryCount = 1] of [['series-count', 2, 1, 100000, 100000], ['points', 100001, 1, 100000], ['cache-cells', 100000, 5, 1000000], ['ownership-count', 2, 100001, 100000], ['ownership-metadata', 2, 52000, 4 * 1024 * 1024]]) {
  test('export refuses ' + name + ' before helper label/value matrix allocation', () => {
    let allocations = 0;
    const labels = { length: points, [Symbol.iterator]() { allocations++; throw Error('PREALLOCATION_READ'); }, map() { allocations++; throw Error('PREALLOCATION_READ'); } };
    const ordinary = Array.from({ length: ordinaryCount }, (_, index) => ({ name: 'Actual ' + index, labels, values: { length: points } }));
    const refs = Array.from({ length: count }, (_, index) => ({ ...line(25), index, axis: 'value', native: true }));
    if (name === 'ownership-metadata') assert.ok(Buffer.byteLength(JSON.stringify({ v: 1, key: 'OPF chart 1', helpers: refs.map((l) => ({ id: 'OPF chart 1:' + l.index, index: l.index })), overlays: [] })) * 2 > limit, 'synthetic record really exceeds the encoded ownership budget');
    assert.throws(() => referenceChartTypes([{ type: 'line', data: ordinary }], ordinary, refs, { key: 'OPF chart 1', path: 'slides.0.chart.referenceLines' }), (error) => error.code === 'chart-reference-resource-limit' && error.path === 'slides.0.chart.referenceLines' && error.details.limit === limit);
    assert.equal(allocations, 0);
  });
}
test('singleton category growth preserves full-span visible overlays rather than restoring a now-native reference', async () => {
  const e = await exported(deck('column'));
  const out = await imported(rewrite(e, (xml) => xml.replace(/<c:cat>[\s\S]*?<\/c:cat>/g, (s) => s.replace('<c:ptCount val="1"/>', '<c:ptCount val="2"/>').replace('</c:strCache>', '<c:pt idx="1"><c:v>Added</c:v></c:pt></c:strCache>')).replace(/<c:val>[\s\S]*?<\/c:val>/g, (s) => s.replace('<c:ptCount val="1"/>', '<c:ptCount val="2"/>').replace('</c:numCache>', '<c:pt idx="1"><c:v>30</c:v></c:pt></c:numCache>'))));
  assert.equal(out.chart.referenceLines, undefined);
  assert.equal(out.chart.type, 'column');
  assert.deepEqual(out.chart.data.rows, [['Only', 20], ['Added', 30]]);
  assert.equal(out.document.slides[0].shapes.length, 2, 'line and label survive once');
  assert.ok(out.diagnostics.some((d) => d.code === 'chart-reference-overlay-uncertain'));
});
test('unrelated ordinary numeric cache edits keep exact overlay value when category eligibility and plot are unchanged', async () => {
  const e = await exported(deck('column'));
  const out = await imported(rewrite(e, (xml) => xml.replace(/<c:val>[\s\S]*?<\/c:val>/g, (s) => s.replace('<c:v>20</c:v>', '<c:v>19</c:v>'))));
  assert.equal(out.chart.referenceLines[0].value, line().value);
  assert.equal(out.chart.data.rows[0][1], 19);
  assert.equal(out.document.slides[0].shapes?.length ?? 0, 0);
});
for (const [language, text, slot] of [['ja', '目標利益', 'ea'], ['ar', 'الهدف الحالي', 'cs']]) {
  test(language + ' native reference labels use existing effective chart language/script normalization', async () => {
    const d = deck('line', [{ ...line(), label: text }], [['One', 10], ['Two', 20]]); d.language = language;
    const expected = planScriptFonts(d).slides[0], e = await exported(d), h = series(e.xml).find(ownedHelper), p = arr(parser.parse(h)['c:ser']['c:dLbls']['c:dLbl']['c:tx']['c:rich']['a:p'])[0], r = arr(p['a:r'])[0], properties = r['a:rPr'];
    assert.equal(properties.lang, expected.lang);
    assert.equal(properties['a:' + slot].typeface, expected.body[slot === 'ea' ? 'eastAsian' : 'complexScript']);
    assert.notEqual(properties['a:' + slot].typeface, properties['a:latin'].typeface, 'script-specific slot really differs');
    assert.equal(r['a:t'], text);
    assert.ok(toSvg(d, { text: 'system' })[0].includes(text), 'actual SVG includes the authored label');
    assert.equal((await imported(e.bytes)).chart.referenceLines[0].label, text);
  });
}
for (const type of ['line', 'bar', 'column']) {
  test(type + ' finite-extreme references keep exact cache/workbook or overlay values and finite axes', async () => {
    const refs = [line(-Number.MAX_VALUE), { ...line(Number.MAX_VALUE), label: 'High' }], d = deck(type, refs, type === 'column' ? [['Only', 0]] : [['One', 0], ['Two', 1]]), e = await exported(d), out = await imported(e.bytes);
    assert.deepEqual(out.chart.referenceLines.map((r) => r.value), [-Number.MAX_VALUE, Number.MAX_VALUE]);
    assert.match(e.xml, /<c:min val="/); assert.match(e.xml, /<c:max val="/);
    for (const match of e.xml.matchAll(/<c:(?:min|max|majorUnit) val="([^"]+)"/g)) assert.ok(Number.isFinite(Number(match[1])), match[0]);
    assert.doesNotMatch(e.xml, /(?:NaN|Infinity)/);
    assert.deepEqual(out.chart.data, d.slides[0].chart.data);
    if (type === 'line') {
      const helpers = series(e.xml).filter(ownedHelper); assert.equal(helpers.length, 2);
      assert.ok(helpers[0].includes(String(-Number.MAX_VALUE))); assert.ok(helpers[1].includes(String(Number.MAX_VALUE)));
      const workbook = unzipSync(e.entries['ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx']), sheet = strFromU8(workbook['xl/worksheets/sheet1.xml']);
      assert.ok(sheet.includes('<v>' + String(-Number.MAX_VALUE) + '</v>')); assert.ok(sheet.includes('<v>' + String(Number.MAX_VALUE) + '</v>'));
    } else assert.equal(out.document.slides[0].shapes?.length ?? 0, 0, 'unchanged owned overlays consumed once');
  });
}
