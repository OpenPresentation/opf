// How the source editor's latency budgets (SPEC R-PERF-01 and R-PERF-02: the completion list is visible within a limit of the key that opens it, a keystroke is
// painted within a limit) are judged. One sample is one try (one list opened, one key typed). A shared CI runner stalls a page now and then (a neighbor, a GC
// pause, a scheduler tick: one list at 206 ms against a limit of 200 ms with a median of 35 ms), and no single sample can tell such a stall from the editor's own
// work. The editor's work happens on every try, so it shows in every sample; a stall shows in one or two. The verdict therefore does not judge the worst sample.
// It asks three things, and a list that is really slow fails the first or the second:
//  1. the typical try (the median) is within the budget;
//  2. all but the single worst try are within the limit, so one stall passes and two slow tries fail;
//  3. no try takes more than CEILING limits: one stall that long is no noise.
import assert from 'node:assert/strict';

/** The median of a list of numbers (the upper one of two). */
export const median = (list) => [...list].sort((left, right) => left - right)[list.length >> 1];

/** One try of this many limits is no noise. */
export const CEILING = 3;

/** The reasons `samples` (ms) break the budget (the typical try) or the limit (every try but the worst), or an empty list. */
export function latencyFailures({ samples, budget, limit }) {
  const sorted = [...samples].sort((left, right) => left - right), failures = [];
  const typical = median(sorted);
  if (typical > budget) failures.push(`the typical try takes ${typical.toFixed(0)} ms, over the ${budget} ms budget`);
  const second = sorted.length > 1 ? sorted.at(-2) : sorted[0];
  if (second > limit) failures.push(`two tries take over the ${limit} ms limit (${second.toFixed(0)} ms)`);
  const worst = sorted.at(-1);
  if (worst > CEILING * limit) failures.push(`one try takes ${worst.toFixed(0)} ms, over ${CEILING * limit} ms`);
  return failures;
}

/** Throws when `samples` break the budget; `what` names them. */
export function assertLatency(what, options) {
  const failures = latencyFailures(options);
  assert.deepEqual(failures, [], `${what}: ${failures.join('; ')} (tries ${JSON.stringify([...options.samples].sort((left, right) => left - right).map(Math.round))})`);
}
