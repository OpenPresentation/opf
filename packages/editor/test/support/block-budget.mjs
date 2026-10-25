// How the source worker's main-thread budget (SPEC R-PERF-03, test/source-worker-perf-browser.mjs) is judged. One sample is the longest main-thread block
// (the worst gap of a 4 ms heartbeat, in ms) while ONE edit was typed, checked and applied. A shared CI runner stalls a page now and then (a neighbor, a GC
// pause, a scheduler tick: one 101 ms heartbeat gap against a 100 ms limit), and no single sample can tell such a stall from the pane's own work. The pane's
// own work happens once per edit, so it shows in every sample; a stall shows in a few. The verdict therefore judges the typical sample (the median), not the worst.
import assert from 'node:assert/strict';

/** The median of a list of numbers (the upper one of two). */
export const median = (list) => [...list].sort((left, right) => left - right)[list.length >> 1];

/** The comparison with the main-thread run applies only when that run blocks by this much (ms): below it the heartbeat's own noise is as big as the signal. */
export const MEASURABLE_MS = 30;
/** With the main-thread run in hand, the typical worker sample must be at most this share of the typical main-thread sample. (Measured on 1000 slides: the worker's edit blocks for 25 to 35% of the main-thread one in YAML and Markdown, the same edit with the check
 * on the main thread for 80 to 100% of another main-thread run; JSON, whose main-thread check is cheap, is 50% and is not judged this way.) */
export const RATIO = 0.6;
/** One block of this many limits is no noise: the pane did it once. */
export const CEILING = 3;

/**
 * The reasons a series of samples breaks the budget, or an empty list.
 * `samples`: the block of each edit with the worker on. `limit`: the budget for a typical edit on a reference machine (ms). `baseline`: the samples of the same
 * edits checked on the main thread (the same page, runner and deck), or undefined.
 * 1. With a measurable baseline, the typical worker edit blocks for at most RATIO of what the main-thread one does. The baseline is the runner's own speed: a
 *    fixed number is too slack on a fast machine (a check back on the main thread, 55 ms, would pass a 100 ms limit) and too tight on a slow one (the pane's
 *    own work, painting and applying the deck, took 100 ms at a CPU six times slower, with a main-thread check of 340 ms).
 * 2. Without one (no comparison run, or a main-thread check too cheap to measure), the typical edit blocks for at most `limit`.
 * 3. No single edit blocks for CEILING limits: a one-time cost, for example the first check, is not a typical edit, and a stall that long is not noise either.
 */
export function blockFailures({ samples, limit, baseline }) {
  const typical = median(samples), failures = [];
  const reference = baseline ? median(baseline) : 0;
  if (reference >= MEASURABLE_MS) {
    if (typical > RATIO * reference) failures.push(`the typical edit blocks for ${typical.toFixed(0)} ms with the worker, over ${Math.round(RATIO * 100)}% of the ${reference.toFixed(0)} ms it blocks without it`);
  } else if (typical > limit) failures.push(`the typical edit blocks the main thread for ${typical.toFixed(0)} ms, over the ${limit} ms limit`);
  const worst = Math.max(...samples);
  if (worst > CEILING * limit) failures.push(`one edit blocks the main thread for ${worst.toFixed(0)} ms, over ${CEILING * limit} ms`);
  return failures;
}

/** Throws when `samples` break the budget; `what` names them. */
export function assertBlockBudget(what, options) {
  const failures = blockFailures(options);
  assert.deepEqual(failures, [], `${what}: ${failures.join('; ')} (samples ${JSON.stringify(options.samples.map(Math.round))})`);
}
