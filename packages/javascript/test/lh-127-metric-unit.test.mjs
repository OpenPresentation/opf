// LH-127: an inline unit follows its value as it is drawn, with a host measurement and without one. LH-39: a figure never wraps.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide, layoutMetric } from '../dist/composition.js';

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
      assert.ok(Math.abs(unit.box.x - end - 8) <= 3, `${align}: the unit starts a gap after the figure's end (${(unit.box.x - end).toFixed(1)} px)`);
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
    assert.ok(unit.box.x - (value.box.x + value.fit.sourceLines[0].width) <= 8 + 1e-6, text);
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

test('LH-39: in a composition the guard keeps every block at its size, so a figure shrinks only where it costs nothing', () => {
  const slide = {
    title: 'Why This Matters', composition: { mode: 'row' },
    blocks: [{ metric: { value: '2.4x', label: 'Primary signal', description: 'Decide which roadmap bets move into the second half build window', trend: 'up' } },
      { chart: { type: 'line', data: { columns: ['Quarter', 'Current'], rows: [['Q1', 20], ['Q2', 24], ['Q3', 27]] } } },
      { quote: { text: 'The path is workable if we keep the metric simple and the decision owner visible.', attribution: 'Transportation working group' } }],
  };
  const metric = composeSlide(slide).items.find((item) => item.metricLayout).metricLayout;
  assert.ok(part(metric, 'value').fit.fontSize >= 72, 'the value keeps the size it had');
});
