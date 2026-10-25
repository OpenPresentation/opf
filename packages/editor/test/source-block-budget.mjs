// The verdict behind test/source-worker-perf-browser.mjs (test/support/block-budget.mjs): a runner stall passes, the pane's own work on the main thread fails.
import assert from 'node:assert/strict';
import test from 'node:test';
import { blockFailures, median } from './support/block-budget.mjs';

const series = (value, count = 12) => Array.from({ length: count }, () => value);
const withStalls = (base, ...stalls) => series(base).map((value, index) => stalls[index] ?? value);

test('the median is the upper one of two', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 3);
});
test('one 101 ms stall among twelve quiet edits does not break the 100 ms limit it was reported against', () => {
  assert.deepEqual(blockFailures({ samples: withStalls(60, 101), limit: 100 }), []);
  assert.deepEqual(blockFailures({ samples: withStalls(16, 101), limit: 100 }), []);
  assert.deepEqual(blockFailures({ samples: withStalls(60, 101, 130), limit: 100, baseline: series(150) }), []);
  assert.deepEqual(blockFailures({ samples: withStalls(16, 31, 20, 18, 13), limit: 50, baseline: series(60) }), []);
});
test('four quick bursts tolerate one stall, not two', () => {
  assert.deepEqual(blockFailures({ samples: [16, 17, 140, 18], limit: 100 }), []);
  assert.notDeepEqual(blockFailures({ samples: [16, 140, 140, 18], limit: 100 }), []);
});
test('the check back on the main thread breaks the budget on a fast machine and on a CI runner, even when it is under the limit', () => {
  // 55 ms per edit on a fast machine, 60 ms on CI against a 100 ms limit: both as slow as the main-thread run.
  assert.match(blockFailures({ samples: series(55), limit: 50, baseline: series(55) }).join(), /without it/);
  assert.match(blockFailures({ samples: series(60), limit: 100, baseline: series(62) }).join(), /without it/);
  assert.match(blockFailures({ samples: series(150), limit: 100, baseline: series(150) }).join(), /without it/);
  // No comparison run: the limit alone judges.
  assert.match(blockFailures({ samples: series(55), limit: 50 }).join(), /over the 50 ms limit/);
});
test('the worker that is clearly cheaper than the main-thread run passes, on a fast and a slow machine', () => {
  assert.deepEqual(blockFailures({ samples: series(17), limit: 50, baseline: series(55) }), []);
  assert.deepEqual(blockFailures({ samples: series(45), limit: 100, baseline: series(150) }), []);
  assert.deepEqual(blockFailures({ samples: series(20), limit: 50, baseline: series(66) }), []);
  // A runner six times slower than the reference: the pane's own work is over the limit, the main-thread check is far over it.
  assert.deepEqual(blockFailures({ samples: series(105), limit: 100, baseline: series(340) }), []);
});
test('a regression that a second main-thread run of the same edits matches within noise fails', () => {
  // Two main-thread runs of the same edits differed by 56 ms against 45 ms in practice.
  assert.match(blockFailures({ samples: series(45), limit: 100, baseline: series(56) }).join(), /without it/);
});
test('a main-thread run that does not block measurably does not judge the worker', () => {
  assert.deepEqual(blockFailures({ samples: series(16), limit: 50, baseline: series(18) }), []);
  assert.match(blockFailures({ samples: series(60), limit: 50, baseline: series(18) }).join(), /over the 50 ms limit/);
});
test('a slow stretch that hits half the edits breaks the budget, and so does a single huge block', () => {
  assert.notDeepEqual(blockFailures({ samples: withStalls(16, 120, 120, 120, 120, 120, 120, 120), limit: 100 }), []);
  assert.match(blockFailures({ samples: withStalls(16, 400), limit: 100 }).join(), /one edit blocks/);
});
