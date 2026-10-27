// The verdict behind the "no main-thread task of N ms or more" budgets of the source pane suites (test/support/task-budget.mjs): a runner's stall passes,
// a command that holds the page for a long time in every attempt fails.
import assert from 'node:assert/strict';
import test from 'node:test';
import { CEILING, longest, taskFailures, taskLimit } from './support/task-budget.mjs';

test('one 101 to 109 ms stall among three attempts does not break the 100 ms limit it was reported against', () => {
  assert.deepEqual(taskFailures({ attempts: [0, 109, 0], limit: 100 }), []);
  assert.deepEqual(taskFailures({ attempts: [93, 109, 71], limit: 100 }), []);
  assert.deepEqual(taskFailures({ attempts: [101, 60, 0], limit: 100 }), []);
});
test('a typical attempt over the limit fails, and so does a block that every attempt has', () => {
  assert.match(taskFailures({ attempts: [101, 109, 60], limit: 100 }).join(), /typical attempt/);
  // A 300 ms freeze on top of 90 ms of the pane's own work, on the CI bound of 150 ms and on the laptop one of 50 ms.
  assert.match(taskFailures({ attempts: [390, 380, 400], limit: 150 }).join(), /typical attempt/);
  assert.match(taskFailures({ attempts: [320, 310, 330], limit: 50 }).join(), /typical attempt/);
});
test('a single attempt of three limits fails whatever the median says', () => {
  assert.equal(CEILING, 3);
  assert.match(taskFailures({ attempts: [0, 0, 300], limit: 100 }).join(), /one attempt/);
  assert.deepEqual(taskFailures({ attempts: [0, 0, 299], limit: 100 }), []);
});
test('an engine without long task entries (WebKit) reports no tasks and passes', () => {
  assert.equal(longest([]), 0);
  assert.deepEqual(taskFailures({ attempts: [0, 0, 0], limit: 50 }), []);
});
test('the limit is the laptop one, the CI one, or OPF_PERF_LIMIT_MS', () => {
  const saved = { limit: process.env.OPF_PERF_LIMIT_MS, ci: process.env.CI };
  try {
    delete process.env.OPF_PERF_LIMIT_MS; delete process.env.CI;
    assert.equal(taskLimit(), 50);
    assert.equal(taskLimit({ local: 100, ci: 200 }), 100);
    process.env.CI = 'true';
    assert.equal(taskLimit(), 150);
    assert.equal(taskLimit({ local: 100, ci: 200 }), 200);
    process.env.OPF_PERF_LIMIT_MS = '80';
    assert.equal(taskLimit(), 80);
  } finally {
    for (const [name, value] of [['OPF_PERF_LIMIT_MS', saved.limit], ['CI', saved.ci]]) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  }
});
