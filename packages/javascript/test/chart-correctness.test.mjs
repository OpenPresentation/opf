// LH-59: chart correctness in core. The value axis ends near the data (at most 1.25 x the data maximum on a zero-based axis), and a
// waterfall's last value that equals the running sum of the steps before it is a total bar from zero.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CHART_AXIS_MAX_OVERSHOOT, chartValueAxis, niceScale, waterfallSteps } from '@openpresentation/opf/composition';
import { resolveChartData } from '@openpresentation/opf';

describe('niceScale keeps the axis maximum near the data', () => {
  test('every zero-based axis ends within 1.25 x the data maximum, at or above it, and its ticks lie on the axis', () => {
    assert.equal(CHART_AXIS_MAX_OVERSHOOT, 0.25);
    for (const max of [0.7, 1, 3, 9.5, 11, 23, 38.5, 41, 52, 97, 101, 124, 232, 499, 760, 790, 1001, 4321, 98765]) {
      for (let intervals = 1; intervals <= 10; intervals++) {
        const scale = niceScale(0, max, intervals);
        const label = `data 0 to ${max}, ${intervals} intervals`;
        assert.ok(scale.max >= max, `${label}: the axis covers the data (${scale.max})`);
        assert.ok(scale.max <= max * 1.25 + 1e-9, `${label}: the axis ends near the data (${scale.max})`);
        assert.equal(scale.min, 0, label);
        assert.ok(scale.ticks.length >= 2, `${label}: at least two labels`);
        assert.ok(scale.ticks.length - 1 <= intervals, `${label}: no more intervals than fit`);
        assert.ok(scale.ticks.every((tick, i) => tick <= scale.max && (i === 0 || Math.abs(tick - scale.ticks[i - 1] - scale.step) < 1e-9 * scale.step)), `${label}: even ticks from the minimum`);
      }
    }
  });

  test('the corpus waterfall (data peaking at 124) on a one-interval axis ends at 150, not 200 or 500', () => {
    assert.deepEqual(niceScale(0, 124, 1), { min: 0, max: 150, step: 150, ticks: [0, 150] });
    // A two-interval axis divides the tightened end evenly: 0, 400, 800 for data peaking at 760 (it was 0 to 1000 in steps of 500).
    assert.deepEqual(niceScale(0, 760, 2), { min: 0, max: 800, step: 400, ticks: [0, 400, 800] });
    // The major unit stays when its last tick is within half a unit of the end, which is then not a tick (as PowerPoint draws c:max).
    assert.deepEqual(niceScale(0, 38.5, 8), { min: 0, max: 45, step: 10, ticks: [0, 10, 20, 30, 40] });
  });

  test('an axis that already ends near the data is unchanged, and endOnTick keeps the end on a tick', () => {
    assert.deepEqual(niceScale(0, 760, 10), { min: 0, max: 800, step: 100, ticks: [0, 100, 200, 300, 400, 500, 600, 700, 800] });
    assert.deepEqual(niceScale(-30, 70, 10), { min: -40, max: 80, step: 20, ticks: [-40, -20, 0, 20, 40, 60, 80] });
    assert.deepEqual(niceScale(0, 124, 1, { endOnTick: true }), { min: 0, max: 200, step: 200, ticks: [0, 200] });
    assert.deepEqual(niceScale(0, 1, 4, { percent: true }).ticks, [0, 0.25, 0.5, 0.75, 1]);
  });

  test('the composed axis of a column and a bar chart stays within 1.25 x the data maximum in every box size', () => {
    for (const type of ['column', 'bar', 'stacked-column', 'line', 'area']) {
      const chart = { type, data: { columns: ['Quarter', 'Current', 'Baseline'], rows: [['Q1', 12, 9], ['Q2', 16, 11], ['Q3', 19, 13], ['Q4', 23, 15]] } };
      const peak = type === 'stacked-column' ? 38 : 23;
      for (const [width, height] of [[1160, 460], [560, 460], [360, 220], [300, 140], [1160, 120]]) {
        const axis = chartValueAxis(chart, resolveChartData(chart), { width, height, scale: 1 });
        assert.ok(axis.max >= peak && axis.max <= peak * 1.25 + 1e-9, `${type} ${width}x${height}: axis max ${axis.max} for data peaking at ${peak}`);
      }
    }
  });
});

describe('waterfallSteps', () => {
  test('a last value equal to the running sum of two or more steps before it is a total from zero', () => {
    const steps = waterfallSteps([100, 24, -8, 116]);
    assert.deepEqual(steps.map(({ index, from, to, total }) => ({ index, from, to, total })), [
      { index: 0, from: 0, to: 100, total: false },
      { index: 1, from: 100, to: 124, total: false },
      { index: 2, from: 124, to: 116, total: false },
      { index: 3, from: 0, to: 116, total: true },
    ]);
    // The running sum is compared to twelve significant digits.
    assert.equal(waterfallSteps([0.1, 0.2, 0.3]).at(-1).total, true);
    // Rows without a value are skipped and keep their row index.
    assert.deepEqual(waterfallSteps([50, null, 25, 75]).map((step) => [step.index, step.total]), [[0, false], [2, false], [3, true]]);
  });

  test('a last value that differs from the running sum, or follows a single step, is a step', () => {
    assert.equal(waterfallSteps([23, 27, 30, 34]).at(-1).total, false);
    assert.deepEqual(waterfallSteps([23, 27, 30, 34]).at(-1), { index: 3, value: 34, from: 80, to: 114, total: false });
    assert.equal(waterfallSteps([5, 5]).at(-1).total, false);
    assert.deepEqual(waterfallSteps([]), []);
  });

  test('a running total past the finite range throws', () => {
    assert.throws(() => waterfallSteps([Number.MAX_VALUE, Number.MAX_VALUE], 'slides.0.chart'), /slides\.0\.chart: running total exceeds the finite numeric range/);
  });
});
