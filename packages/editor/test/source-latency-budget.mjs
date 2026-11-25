// The verdict behind the source editor's latency budgets (test/support/latency-budget.mjs): a runner stall passes, a slow editor fails.
import assert from 'node:assert/strict';
import test from 'node:test';
import { latencyFailures, median } from './support/latency-budget.mjs';

const budget = { budget: 100, limit: 200 };
const series = (value, count = 6) => Array.from({ length: count }, () => value);
const withTries = (base, ...tries) => series(base).map((value, index) => tries[index] ?? value);

test('the median is the upper one of two', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 3);
});
test('one 206 ms try among six quiet ones (the failure reported against a 200 ms limit) passes', () => {
  assert.deepEqual(latencyFailures({ samples: withTries(35, 206), ...budget }), []);
  assert.deepEqual(latencyFailures({ samples: withTries(35, 450), ...budget }), []);
});
test('two tries over the limit fail', () => {
  assert.match(latencyFailures({ samples: withTries(35, 206, 210), ...budget }).join(), /two tries take over the 200 ms limit/);
});
test('a list that is really slow fails: a median over the budget, with or without a stall', () => {
  assert.match(latencyFailures({ samples: series(150), ...budget }).join(), /typical try takes 150 ms, over the 100 ms budget/);
  assert.notDeepEqual(latencyFailures({ samples: withTries(120, 140, 130), ...budget }), []);
  assert.notDeepEqual(latencyFailures({ samples: [20, 30, 120, 150, 160, 190], ...budget }), []);
});
test('one try beyond three limits fails even when the rest is quick', () => {
  assert.match(latencyFailures({ samples: withTries(35, 650), ...budget }).join(), /over 600 ms/);
});
test('a single sample is judged against the limit', () => {
  assert.deepEqual(latencyFailures({ samples: [60], ...budget }), []);
  assert.notDeepEqual(latencyFailures({ samples: [260], ...budget }), []);
});
