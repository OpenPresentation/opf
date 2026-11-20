// RR-105: explicit reference bounds keep vertical categories in the preview's lower gutter.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { unzipSync, strFromU8 } from 'fflate';
import { XMLParser } from 'fast-xml-parser';
import { validate } from '@openpresentation/opf';
import { composeSlide } from '@openpresentation/opf/composition';
import { toPptx, fromPptx } from '../dist/index.js';
import { chartOrderProblems } from './helpers/chart-schema-order.mjs';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false });
const arr = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const data = { columns: ['Period', 'Actual'], rows: [['Jan', 40], ['Feb', 60], ['Mar', 50]] };
const refs = [
  { value: 80, label: 'Target 80', stroke: { color: '#C44900', width: 2, dash: 'dash' } },
  { value: -10, label: 'Floor -10', labelPosition: 'start', stroke: { color: '#087E8B', width: 1.5, dash: 'dot' } },
];
const deck = (type = 'line', extra = {}) => ({
  design: { theme: 'minimal', fontScheme: 'roboto', variant: 'light1' },
  slides: [{ chart: { type, data: structuredClone(data), legend: 'none', dataLabels: false, referenceLines: structuredClone(refs), ...extra } }],
});
const chartOf = document => document.slides[0].chart ?? document.slides[0].blocks?.find(block => block.chart)?.chart;
async function inspect(document) {
  assert.equal(validate(document, { only: ['format'] }).valid, true, 'public format input is supported');
  const bytes = await toPptx(document), entries = unzipSync(bytes), xml = strFromU8(entries['ppt/charts/chart1.xml']);
  const plot = parser.parse(xml)['c:chartSpace']['c:chart']['c:plotArea'];
  const categories = arr(plot['c:catAx']), values = arr(plot['c:valAx']);
  const category = categories.find(axis => axis['c:delete']?.val !== '1');
  assert.ok(category, 'visible category axis exists');
  const value = values.find(axis => axis['c:axId'].val === category['c:crossAx'].val);
  assert.ok(value, 'category axis retains its associated value axis');
  const composed = composeSlide(document.slides[0], { width: 1280, height: 720, presentation: document }).items.find(item => item.field === 'chart').chart;
  for (const [key, field] of [['min', 'c:min'], ['max', 'c:max']])
    assert.equal(Number(value['c:scaling'][field].val), composed.valueAxis[key], 'same composed primary ' + key);
  assert.equal(Number(value['c:majorUnit'].val), composed.valueAxis.majorUnit);
  assert.deepEqual(chartOrderProblems(xml), []);
  return { bytes, xml, plot, categories, category, value, values, composed };
}

for (const type of ['line', 'line-with-markers', 'area', 'column']) {
  test(`${type}: negative explicit floor uses low category labels without moving the axis or data`, async () => {
    const document = deck(type), e = await inspect(document);
    assert.equal(e.category['c:tickLblPos'].val, 'low');
    assert.equal(e.category['c:crosses'].val, 'autoZero', 'numeric crossing policy stays unchanged');
    assert.ok(Number(e.value['c:scaling']['c:min'].val) <= -10);
    assert.ok(Number(e.value['c:scaling']['c:max'].val) >= 80);
    const out = await fromPptx(e.bytes), chart = chartOf(out);
    assert.deepEqual(chart.data, data);
    assert.deepEqual(chart.referenceLines.map(r => [r.value, r.label, r.stroke.width, r.stroke.dash, r.stroke.color.toUpperCase()]), refs.map(r => [r.value, r.label, r.stroke.width, r.stroke.dash, r.stroke.color.toUpperCase()]));
    for (const ref of refs) assert.match(e.xml, new RegExp(`<a:ln w="${Math.round(ref.stroke.width * 9525)}"`), 'native EMU width stays quantized while unchanged ownership preserves authored units');
  });
}

test('all-negative primary bounds still place category labels below the plot', async () => {
  const e = await inspect(deck('line', { data: { columns: data.columns, rows: [['Jan', -30], ['Feb', -20], ['Mar', -10]] }, referenceLines: [{ value: -40, label: 'Floor -40' }] }));
  assert.equal(e.category['c:tickLblPos'].val, 'low');
  assert.equal(e.category['c:crosses'].val, 'autoZero');
  assert.ok(Number(e.value['c:scaling']['c:min'].val) <= -40);
});

test('fractional percentage references retain their values, scale and number format', async () => {
  const document = deck('line', { data: { columns: ['Period', { name: 'Actual', format: '0%' }], rows: [['Jan', 0.4], ['Feb', 0.6], ['Mar', 0.5]] }, referenceLines: [{ value: -0.1, label: 'Floor -10%' }, { value: 0.8, label: 'Target 80%' }] });
  const e = await inspect(document);
  assert.equal(e.category['c:tickLblPos'].val, 'low');
  assert.equal(e.value['c:numFmt'].formatCode, '0%');
  const out = await fromPptx(e.bytes);
  assert.deepEqual(chartOf(out).referenceLines.map(r => r.value), [-0.1, 0.8]);
  assert.deepEqual(chartOf(out).data, document.slides[0].chart.data);
});

for (const negativeAxis of ['value', 'secondary']) {
  test(`combo: ${negativeAxis} negative reference preserves primary/secondary axis association`, async () => {
    const document = deck('combo', { data: { columns: ['Period', 'Actual', { name: 'Margin', format: '0%' }], rows: [['Jan', 40, 0.2], ['Feb', 60, 0.3], ['Mar', 50, 0.25]] }, line: ['Margin'], secondaryAxis: ['Margin'], referenceLines: [{ value: negativeAxis === 'value' ? -10 : -0.1, axis: negativeAxis, label: 'Floor' }] });
    const e = await inspect(document);
    assert.equal(e.category['c:tickLblPos'].val, 'low');
    assert.equal(e.categories.length, 2);
    assert.equal(e.categories.filter(a => a['c:delete']?.val === '1').length, 1, 'secondary categories stay hidden');
    const hidden = e.categories.find(a => a['c:delete']?.val === '1');
    const secondary = e.values.find(a => a['c:axId'].val === hidden['c:crossAx'].val);
    for (const [key, field] of [['min', 'c:min'], ['max', 'c:max']])
      assert.equal(Number(secondary['c:scaling'][field].val), e.composed.secondaryValueAxis[key]);
    assert.equal(Number(secondary['c:majorUnit'].val), e.composed.secondaryValueAxis.majorUnit);
    if (negativeAxis === 'secondary') assert.ok(e.composed.valueAxis.min >= 0, 'secondary reference does not extend primary bounds');
    const out = await fromPptx(e.bytes);
    assert.deepEqual(chartOf(out).data, document.slides[0].chart.data);
    assert.equal(chartOf(out).referenceLines[0].axis, negativeAxis);
  });
}

test('positive references and negative charts without explicit references retain existing label policies', async () => {
  // LH-110: every vertical chart keeps the vendor col default ('low'), with or without references. Line and area helpers once
  // wrote the horizontal-bar layout ('nextTo' with the category axis on the left), which Keynote refused.
  for (const [type, expected] of [['line', 'low'], ['line-with-markers', 'low'], ['area', 'low'], ['column', 'low']]) {
    const positive = await inspect(deck(type, { referenceLines: [refs[0]] }));
    assert.ok(positive.composed.valueAxis.min >= 0);
    assert.equal(positive.category['c:tickLblPos'].val, expected);
    const bare = deck(type, { data: { columns: data.columns, rows: [['Jan', -10], ['Feb', 60], ['Mar', 50]] }, referenceLines: [] });
    bare.slides[0].title = 'Target -10';
    const negative = await inspect(bare);
    assert.ok(negative.composed.valueAxis.min < 0);
    assert.equal(negative.category['c:tickLblPos'].val, 'low', 'ordinary no-helper charts keep the vendor col default');
    assert.doesNotMatch(negative.xml, /opf:reference /);
  }
});

test('horizontal bars keep their existing low category gutter and bottom value-label policy', async () => {
  const e = await inspect(deck('bar'));
  assert.equal(e.category['c:tickLblPos'].val, 'low');
  assert.equal(e.category['c:scaling']['c:orientation'].val, 'maxMin');
  assert.equal(e.category['c:crosses'].val, 'autoZero');
  assert.equal(e.value['c:crosses'].val, 'max');
  assert.equal(e.value['c:tickLblPos'].val, 'nextTo');
});
test('singleton vertical overlay references use the same lower category gutter', async () => {
  const document = deck('line', { data: { columns: data.columns, rows: [['Jan', 40]] }, referenceLines: [refs[1]] });
  const e = await inspect(document);
  assert.equal(e.category['c:tickLblPos'].val, 'low');
  assert.equal((e.xml.match(/<c:ser>/g) ?? []).length, 1, 'overlay fallback adds no native helper series');
  assert.equal(chartOf(await fromPptx(e.bytes)).referenceLines[0].value, -10);
});

test('RTL category order stays reversed while negative reference labels use the lower gutter', async () => {
  const document = { ...deck('line'), language: 'ar-SA' };
  const e = await inspect(document);
  assert.equal(e.category['c:tickLblPos'].val, 'low');
  assert.equal(e.category['c:scaling']['c:orientation'].val, 'maxMin');
  assert.equal(e.category['c:crosses'].val, 'autoZero');
  assert.deepEqual(chartOf(await fromPptx(e.bytes)).data, data);
});
