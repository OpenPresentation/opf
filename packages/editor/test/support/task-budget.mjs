// How the "no main-thread task of N ms or more" budgets are judged (SPEC R-PERF-03). The `longtask` API reports every task of 50 ms or more; the budgets
// of the source pane suites ask for the longest one, per attempt (an attempt is one run of the same commands or keystrokes on the same page).
//
// Why this is not one worst task against one number. A shared CI runner stalls a page now and then (a neighbor, a GC pause, a scheduler tick), and the
// same run of commands costs 2 to 4 times what it costs on a laptop: the fold chords on 1000 slides of YAML are under 50 ms on a laptop (no long task at all)
// and 93 ms at a CPU four times slower, so a 100 ms bound failed CI by a hair (101 to 109 ms) in about one run in five while the code had not changed.
// Three things make the verdict follow the code and not the runner:
//  1. The bound has CI headroom: `taskLimit()` is the budget on a laptop and 3 times the 50 ms SPEC budget on CI (OPF_PERF_LIMIT_MS sets it either way). It is
//     still far below a real regression: a command that freezes the page for 300 ms makes a task of 300 ms or more on any machine.
//  2. The verdict judges the typical attempt, the median of at least three, not the worst. The work of the code under test happens in every attempt, so it
//     shows in the median; a runner's stall shows in one attempt.
//  3. No single attempt may hold the page for CEILING limits: a freeze of that length is not noise, whatever the median says.
// Unit tests: test/task-budget.mjs.
import { median } from './block-budget.mjs';

/** One attempt of CEILING limits or more is no noise. */
export const CEILING = 3;
/** How many attempts a suite makes of a run that is repeatable. */
export const ATTEMPTS = 3;

/** The bound for the longest task of an attempt (ms): `OPF_PERF_LIMIT_MS`, else `ci` when CI is set, else `local`. */
export const taskLimit = ({ local = 50, ci = 150 } = {}) => Number(process.env.OPF_PERF_LIMIT_MS ?? (process.env.CI ? ci : local));

/** The longest of some long task durations, 0 when there is none (the engine reports nothing below 50 ms, and WebKit nothing at all). */
export const longest = (durations) => Math.max(0, ...durations);

/**
 * The reasons a series of attempts breaks the budget, or an empty list. `attempts`: the longest task of each attempt (ms). `limit`: the bound for a typical attempt.
 */
export function taskFailures({ attempts, limit }) {
  const typical = median(attempts), worst = Math.max(...attempts), failures = [];
  if (typical >= limit) failures.push(`the typical attempt holds the main thread for ${typical.toFixed(0)} ms, over the ${limit} ms limit`);
  if (worst >= CEILING * limit) failures.push(`one attempt holds the main thread for ${worst.toFixed(0)} ms, over ${CEILING} limits (${CEILING * limit} ms)`);
  return failures;
}

/** The long tasks of one attempt: call `start` before it and `take` after it; `take` returns their durations since the last call and clears them. */
export async function observeLongTasks(page) {
  await page.evaluate(() => {
    window.__tasks = [];
    try { new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.__tasks.push(Math.round(entry.duration)); }).observe({ entryTypes: ['longtask'] }); } catch { /* This engine has no longtask entries. */ }
  });
  return () => page.evaluate(() => window.__tasks.splice(0));
}
