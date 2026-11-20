import assert from 'node:assert/strict';
import {test} from 'node:test';
import {paretoPlan} from '../dist/composition.js';

test('Pareto preserves signed bars, source ownership and stable ties with positive-only cumulative shares', () => {
  const source = [{value: 42, row: 'North'}, {value: 31, row: 'South'}, {value: -8, row: 'East'}, {value: 19, row: 'West'}];
  const before = structuredClone(source), plan = paretoPlan(source);
  assert.deepEqual(plan.bars.map(bar => bar.row), ['North', 'South', 'West', 'East']);
  assert.deepEqual(plan.bars.map(bar => bar.value), [42, 31, 19, -8]);
  assert.equal(plan.total, 92);
  assert.deepEqual(plan.cumulative, [42 / 92, 73 / 92, 1, 1]);
  assert.equal(plan.bars[3], source[2]);
  assert.deepEqual(source, before);
  assert.deepEqual(paretoPlan([{value: 2, row: 'first'}, {value: 2, row: 'second'}, {value: 0, row: 'zero'}]).bars.map(bar => bar.row), ['first', 'second', 'zero']);
});

test('empty, zero and all-negative Pareto plans keep finite zero cumulative values', () => {
  assert.deepEqual(paretoPlan([]), {bars: [], total: 0, cumulative: []});
  const plan = paretoPlan([{value: -3}, {value: 0}, {value: -1}]);
  assert.deepEqual(plan.bars.map(bar => bar.value), [0, -1, -3]);
  assert.deepEqual(plan.cumulative, [0, 0, 0]);
  assert.equal(plan.total, 0);
});

test('non-finite aggregate remains visible to each consumer safety guard', () => {
  assert.equal(paretoPlan([{value: 1e308}, {value: 1e308}, {value: -1}]).total, Infinity);
});
