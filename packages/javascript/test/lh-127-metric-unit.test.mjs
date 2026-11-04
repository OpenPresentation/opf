// LH-127: an inline unit follows its value as it is drawn, with a host measurement and without one. LH-39: a figure never wraps.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { METRIC_UNIT_GAP, composeSlide, layoutMetric } from '../dist/composition.js';

const box = { x: 0, y: 0, width: 600, height: 360 };
const part = (layout, role) => layout.parts.find((entry) => entry.role === role);
// A heavy sans face as a host measures it: digits .58 em, separators .3, a lowercase unit .51.
const advance = (character) => (/[0-9]/.test(character) ? .58 : /[.,]/.test(character) ? .3 : .51);
const measure = (text, size) => [...text].reduce((sum, character) => sum + advance(character) * size, 0);
const measured = { measure };
const display = { start: 120, max: 160 };
const kpi = { value: '2.4', unit: 'x', label: 'Illustrative result', delta: '+0.3x', trend: 'up' };

test('LH-127: without a measurement the unit sits one gap after the figure, as it does with one', () => {
  for (const align of ['left', 'center', 'right']) {
    const estimated = layoutMetric(kpi, box, { display, align }), real = layoutMetric(kpi, box, { display, align, textMeasurement: measured });
    assert.equal(estimated.arrangement, 'inline-unit');
    assert.equal(real.arrangement, 'inline-unit');
    const size = part(estimated, 'value').fit.fontSize, trueWidth = measure('2.4', size);
    for (const layout of [estimated, real]) {
      const value = part(layout, 'value'), unit = part(layout, 'unit'), origin = value.linePositions[0];
      // Where the figure is drawn (its line is anchored on the accepted alignment point) and where its ink ends.
      const factor = align === 'left' ? 0 : align === 'center' ? .5 : 1, line = value.fit.sourceLines[0].width;
      const start = origin.x + (line - trueWidth) * factor, end = start + trueWidth;
      const gap = Math.max(8, METRIC_UNIT_GAP * size);
      assert.ok(Math.abs(unit.box.x - end - gap) <= 3, `${align}: the unit starts a gap after the figure's end (${(unit.box.x - end).toFixed(1)} px)`);
    }
  }
});

test('LH-127: the figure line takes its measured width, so engines that anchor on it draw it where the unit expects', () => {
  const layout = layoutMetric(kpi, box, { display, align: 'center' }), value = part(layout, 'value');
  assert.ok(Math.abs(value.fit.sourceLines[0].width - measure('2.4', value.fit.fontSize)) < 1, 'the line is the figure, not the estimate slack');
  assert.ok(Math.abs(value.box.width - value.fit.sourceLines[0].width) < 1e-6);
  // Wide and narrow figures alike (the estimate counted every separator as a letter).
  for (const text of ['1,200', '99.9', '$1.24', '-3.5']) {
    const one = layoutMetric({ value: text, unit: 'k' }, box, { display, align: 'left' }), unit = part(one, 'unit');
    if (one.arrangement !== 'inline-unit') continue;
    const value = part(one, 'value');
    assert.ok(Math.abs(unit.box.x - (value.box.x + value.fit.sourceLines[0].width) - Math.max(8, METRIC_UNIT_GAP * value.fit.fontSize)) < 1e-6, text);
  }
});

test('LH-127: a value with a letter or a percent sign keeps the estimate, which is not slack for it', () => {
  const layout = layoutMetric({ value: '99.9%', unit: 'pts' }, box, { display, align: 'left' }), value = part(layout, 'value');
  assert.ok(value.fit.sourceLines[0].width > measure('99.9', value.fit.fontSize), 'not narrowed below the estimate');
});

test('LH-39: a value of one word never wraps; one of several words may, between words', () => {
  const narrow = { x: 0, y: 0, width: 200, height: 240 };
  const figure = layoutMetric({ value: '$1.24M', label: 'Revenue' }, narrow, {});
  assert.equal(part(figure, 'value').fit.sourceLines.length, 1);
  assert.equal(figure.overflow, false);
  const before = layoutMetric({ value: '$1.24M', label: 'Revenue' }, narrow, { figure: false });
  assert.equal(part(before, 'value').fit.sourceLines.length, 2, 'without the rule the figure is split inside');
  assert.ok(part(figure, 'value').fit.fontSize <= part(before, 'value').fit.fontSize, 'one line costs size, which the guarded rule weighs');
  const phrase = layoutMetric({ value: 'Q4 2026 plan', label: 'Revenue' }, { x: 0, y: 0, width: 300, height: 240 }, {});
  assert.equal(part(phrase, 'value').fit.sourceLines.length, 2);
  // A value that fits on one line at its size is unchanged.
  const same = layoutMetric({ value: '12', label: 'Revenue' }, { x: 0, y: 0, width: 300, height: 240 }, {}), alike = layoutMetric({ value: '12', label: 'Revenue' }, { x: 0, y: 0, width: 300, height: 240 }, { figure: false });
  assert.deepEqual(same, alike);
});

test('LH-39: a figure that cannot fit on one line down to the floor wraps as before', () => {
  const layout = layoutMetric({ value: '1234567890123456789012345678901234567890', label: 'Digits' }, { x: 0, y: 0, width: 200, height: 400 }, { floorFallback: true });
  assert.ok(part(layout, 'value').fit.sourceLines.length >= 1);
  assert.ok(part(layout, 'value').fit.fontSize >= 16);
});

test('LH-127: the gap is about 0.12 em of the value, at least 8 px, with and without a measurement', () => {
  const estimated = layoutMetric(kpi, box, { display, align: 'left' }), real = layoutMetric(kpi, box, { display, align: 'left', textMeasurement: measured });
  for (const layout of [estimated, real]) {
    const value = part(layout, 'value'), unit = part(layout, 'unit');
    assert.equal(value.fit.fontSize, 120);
    assert.ok(Math.abs(unit.box.x - (value.box.x + value.fit.sourceLines[0].width) - 14.4) < 1e-6, 'about 14 px at 120 px');
  }
  const small = layoutMetric({ value: '5', unit: 'x' }, { x: 0, y: 0, width: 300, height: 100 }, { align: 'left' });
  assert.ok(part(small, 'unit').box.x - part(small, 'value').box.width >= 8);
});

const chart = { chart: { type: 'bar', data: { columns: ['Quarter', 'Revenue'], rows: [['Q1', 12], ['Q2', 15], ['Q3', 19]] } } };
const valueAt = (composed, index) => composed.items.filter((item) => item.metricLayout)[index].metricLayout.parts.find((entry) => entry.role === 'value');

test('LH-39: a split figure counts as unreadable: the row takes one size on the type scale, one line each', () => {
  const slide = { title: 'Figures beside a chart', blocks: ['$1.24M', '$0.98M', '$2.31M'].map((value, index) => ({ metric: { value, label: `Revenue ${index + 1}`, delta: '+4%', trend: 'up' } })).concat([chart]) };
  const composed = composeSlide(slide), values = [0, 1, 2].map((index) => valueAt(composed, index));
  for (const value of values) assert.equal(value.fit.sourceLines.length, 1, 'no figure is split');
  assert.equal(new Set(values.map((value) => value.fit.fontSize)).size, 1, 'the three figures stay one size');
  assert.ok(values[0].fit.fontSize >= 16);
});

test('LH-39: the figure a guarded composition can keep at its size is kept (three large figures in a 2 + 1 grid)', () => {
  const slide = { title: 'Three figures', blocks: ['$1,240,000', '$980,500', '$2,310,000'].map((value, index) => ({ metric: { value, label: `Revenue ${index + 1}` } })) };
  const composed = composeSlide(slide);
  for (const index of [0, 1, 2]) { assert.equal(valueAt(composed, index).fit.sourceLines.length, 1); assert.equal(valueAt(composed, index).fit.fontSize, 76); }
});

test('LH-39: a size drop is taken only for a split figure: a slide whose figures fit keeps every block', () => {
  const slide = { title: 'Why', composition: { mode: 'row' }, blocks: [{ metric: { value: '12', label: 'Signal' } }, chart, { quote: { text: 'The path is workable if we keep the metric simple.', attribution: 'Working group' } }] };
  assert.equal(valueAt(composeSlide(slide), 0).fit.fontSize >= 72, true);
});
