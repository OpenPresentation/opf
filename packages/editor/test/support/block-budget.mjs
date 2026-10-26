// How the source worker's main-thread budget (SPEC R-PERF-03, test/source-worker-perf-browser.mjs) is judged. One sample is the longest main-thread block
// (the worst gap of a 4 ms heartbeat, in ms) while ONE edit was typed, checked and applied. A shared CI runner stalls a page now and then (a neighbor, a GC
// pause, a scheduler tick: one 101 ms heartbeat gap against a 100 ms limit), and no single sample can tell such a stall from the pane's own work. The pane's
// own work happens once per edit, so it shows in every sample; a stall shows in a few. The verdict therefore judges the typical sample (the median), not the worst.
import assert from 'node:assert/strict';

/** The median of a list of numbers (the upper one of two). */
export const median = (list) => [...list].sort((left, right) => left - right)[list.length >> 1];

/** The comparison with the main-thread run applies only when that run blocks by this much (ms): below it the heartbeat's own noise is as big as the signal. */
export const MEASURABLE_MS = 30;
/**
 * With the main-thread run in hand, the typical worker sample must be at most this share of the typical main-thread sample. Measured on 1000 slides of YAML:
 * the worker's edit is 17 to 36% of the main-thread one on a fast machine and on a good 2-vCPU CI runner, and 65 to 70% on a bad one (two of three runs of the
 * same job: the pane's own work after the worker's answer, receiving and applying the deck and the paint, took 50 to 70 ms instead of 10 to 20 ms; the long task
 * entries show it, so it is main-thread work and no measurement noise). An edit whose check has moved back to the main thread is as slow as the main-thread run
 * (80 to 100% in repeated runs: two main-thread runs of the same edits differ by up to 20%). 0.85 sits between them. This ratio cannot see a check that is only
 * a part of the main-thread one (a re-validation after the worker's answer); the in-flight budget below sees a check that runs beside the worker's.
 */
export const RATIO = 0.85;
/**
 * While the worker's request is in flight (`data-opf-checking` is set) the main thread has nothing of the check to do, whatever the runner's speed or core
 * count: the typical edit's worst heartbeat gap in that span must be at most this share of the main-thread run's typical edit. Measured: 0 to 11 ms against
 * 63 to 139 ms on CI, 1 to 19 ms against 43 to 60 ms on a fast machine; a check that also runs on the main thread blocks there for its whole cost.
 */
export const FLIGHT_RATIO = 0.4;
/** One block of this many limits is no noise: the pane did it once. */
export const CEILING = 3;

/**
 * The reasons a series of samples breaks the budget, or an empty list.
 * `samples`: the block of each edit with the worker on. `flight`: for each edit, the block while the worker's request was in flight, or null when no request
 * was (the check ran elsewhere); omitted when not measured. `limit`: the budget for a typical edit on a reference machine (ms). `baseline`: the samples of the
 * same edits checked on the main thread (the same page, runner and deck), or undefined.
 * 1. With a measurable baseline, the typical worker edit blocks for at most RATIO of what the main-thread one does, and the typical block while the worker's
 *    request is in flight for at most FLIGHT_RATIO of it. The baseline is the runner's own speed: a fixed number is too slack on a fast machine (a check back on
 *    the main thread, 55 ms, would pass a 100 ms limit) and too tight on a slow one.
 * 2. Without one (no comparison run, or a main-thread check too cheap to measure), the typical edit blocks for at most `limit`.
 * 3. No single edit blocks for CEILING limits: a one-time cost, for example the first check, is not a typical edit, and a stall that long is not noise either.
 * 4. When `flight` is given, most edits have a request in flight: otherwise the worker did not do the checking.
 */
export function blockFailures({ samples, flight, limit, baseline }) {
  const typical = median(samples), failures = [];
  const reference = baseline ? median(baseline) : 0;
  if (reference >= MEASURABLE_MS) {
    if (typical > RATIO * reference) failures.push(`the typical edit blocks for ${typical.toFixed(0)} ms with the worker, over ${Math.round(RATIO * 100)}% of the ${reference.toFixed(0)} ms it blocks without it`);
  } else if (typical > limit) failures.push(`the typical edit blocks the main thread for ${typical.toFixed(0)} ms, over the ${limit} ms limit`);
  if (flight) {
    const waited = flight.filter((value) => value !== null);
    if (waited.length <= flight.length / 2) failures.push(`only ${waited.length} of ${flight.length} edits were checked in the worker`);
    else if (reference >= MEASURABLE_MS && median(waited) > FLIGHT_RATIO * reference) failures.push(`the main thread blocks for ${median(waited).toFixed(0)} ms while the worker checks, over ${Math.round(FLIGHT_RATIO * 100)}% of the ${reference.toFixed(0)} ms an edit blocks without the worker`);
  }
  const worst = Math.max(...samples);
  if (worst > CEILING * limit) failures.push(`one edit blocks the main thread for ${worst.toFixed(0)} ms, over ${CEILING * limit} ms`);
  return failures;
}

/** Throws when `samples` break the budget; `what` names them. */
export function assertBlockBudget(what, options) {
  const failures = blockFailures(options);
  assert.deepEqual(failures, [], `${what}: ${failures.join('; ')} (edits ${JSON.stringify(options.samples.map(Math.round))}, in flight ${JSON.stringify((options.flight ?? []).map((value) => (value === null ? null : Math.round(value))))})`);
}
