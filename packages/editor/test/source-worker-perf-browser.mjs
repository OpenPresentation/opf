// Phase 4 budget (SPEC R-PERF-03, artifacts/source-editor/TEST-PLAN.md section 8.2): typing in a 1000-slide YAML, Markdown or JSON deck does not block the
// main thread for long, because the text checks run in the source worker. Twelve characters are typed in the middle of slide 500 with real keyboard events, in
// two patterns: "quick" is four bursts of three characters 30 ms apart, "paced" is twelve single characters 90 ms apart. Every burst is followed by the pane
// being left alone until it has checked and applied the text (`whenIdle`) and a moment for the paint, so each burst is one edit and one sample: the worst gap of
// a 4 ms heartbeat while it was typed, checked and applied (and, on engines that have them, the longest `longtask` entry, printed for information).
//
// Why samples and a median. One heartbeat gap cannot tell the pane's work from a stall of a shared runner: a single gap of 101 ms against a limit of 100 ms
// failed CI once. The pane's work is done once per edit, so it shows in every sample; a stall shows in a few. The verdict (test/support/block-budget.mjs, with
// unit tests in test/source-block-budget.mjs) therefore judges the typical sample, the median, not the worst.
//
// What the median is compared with. For YAML and Markdown, where the main-thread check is a long task, the same edits are also run with `?worker=off` in the
// same job (the main-thread run), so the budget follows the runner's speed and core count instead of a fixed number. Two judgments, neither of which depends on
// how many cores the runner has:
//  - while the worker's request is in flight (the pane sets `data-opf-checking`) the main thread has nothing of the check to do: the typical block there must be
//    at most 40% of the main-thread run's (0 to 11 ms against 63 to 139 ms on CI); a check that also runs on the main thread fills that span. Most edits must have
//    had a request in flight, so a check that never reached the worker fails, too.
//  - the typical block of the whole edit (typed, checked, applied, painted) must be at most 85% of the main-thread run's. That is 17 to 36% on a fast machine
//    and a good 2-vCPU runner, 65 to 70% on a bad one (two of three runs of one job, where receiving, applying and painting the answer took 50 to 70 ms instead of
//    10 to 20), and about 100% with the check on the main thread. A check that is only part of the work that stays on the main thread (a re-validation after the
//    answer) is the one regression this budget sees only when it is most of the main-thread cost.
// Where there is no measurable comparison (JSON, whose main-thread check is cheap, or OPF_PERF_COMPARE=0) the median must be within the limit (50 ms; 100 ms on
// CI). No single edit may block for three limits. No retries.
//
// OPF_PERF_LIMIT_MS sets the limit for a typical edit; OPF_PERF_COMPARE=0 skips the main-thread run (then the limit judges); OPF_PERF_ROUNDS
// repeats the whole measurement (default 1; the samples of all rounds count); OPF_CPU_THROTTLE=<rate> slows Chromium down; OPF_BROWSER_ENGINE=webkit runs it on WebKit.
// To see that the test can fail (YAML must fail): OPF_PERF_WORKER_OFF=1 makes the worker's run on the main thread, as if the pane checked there;
// OPF_PERF_BURN_MS=<ms> keeps the worker but holds the main thread that long at every request to it, as a check done twice (it fails from about 40% of the
// main-thread check: 25 ms passes, 45 ms fails, unthrottled; 100 ms at throttle 3). To see that a bad runner passes: OPF_PERF_SLOW_APPLY_MS=<ms> holds the main
// thread that long right after every answer of the worker (about 70% of the main-thread run passes: 26 ms unthrottled; about 90% fails: 40 ms).
import assert from 'node:assert/strict';
import { engineName, startKeyboardSuite } from './support/source-keyboard.mjs';
import { assertBlockBudget, median } from './support/block-budget.mjs';
import { bigDeck, bigText } from './support/source-perf.mjs';

// On a CI runner (CI is set) the limit is the plan's 2x for noise.
const CI = Boolean(process.env.CI);
const LIMIT = Number(process.env.OPF_PERF_LIMIT_MS ?? (CI ? 100 : 50));
const ROUNDS = Number(process.env.OPF_PERF_ROUNDS ?? 1);
const COMPARE = process.env.OPF_PERF_COMPARE !== '0';
const WORKER_OFF = process.env.OPF_PERF_WORKER_OFF === '1';
const BURN = Number(process.env.OPF_PERF_BURN_MS ?? 0);
const SLOW_APPLY = Number(process.env.OPF_PERF_SLOW_APPLY_MS ?? 0);
const SLIDES = 1000;
const TAIL = 150;
const PATTERNS = { quick: { bursts: 4, size: 3, spacing: 30 }, paced: { bursts: 12, size: 1, spacing: 90 } };
const cases = [
  { format: 'yaml', label: 'YAML', heavy: true, needle: 'title: Slide 500 headline', text: () => bigText('yaml', SLIDES) },
  { format: 'md', label: 'Markdown', heavy: true, needle: '# Slide 500 headline', text: () => bigText('md', SLIDES) },
  { format: 'json', label: 'JSON', needle: '"title": "Slide 500 headline', text: () => `${JSON.stringify(bigDeck(SLIDES), null, 2)}\n` },
];

const suite = await startKeyboardSuite();

/** One round: open the harness, load the deck, type, and report the longest long task, the worst heartbeat gap and the pane's check counts. */
async function measure(mode, { format, needle, text }) {
  const page = await suite.openPage(`?worker=${mode}`);
  suite.problems.length = 0;
  try {
    const value = text();
    await page.evaluate(([name, source]) => {
      if (demo.pane.getFormat() !== name) demo.pane.setFormat(name);
      const control = demo.pane.editor;
      control.api.focus(); control.update(source); control.api.replace(0, source.length, source); control.resetHistory();
    }, [format, value]);
    await page.evaluate(() => Promise.race([demo.pane.whenIdle(), new Promise((_, reject) => setTimeout(() => reject(new Error('the pane did not become idle in 60 s')), 60000))]));
    await page.waitForFunction(() => demo.pane.getProblems().length === 0 && document.querySelector('.opf-source-findings')?.hidden !== false);
    await page.waitForTimeout(500);
    await page.evaluate((marker) => {
      window.__long = []; window.__gaps = []; window.__checks = [];
      try { new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.__long.push(entry.duration); }).observe({ entryTypes: ['longtask'] }); } catch { /* No longtask entries on this engine. */ }
      let last = performance.now();
      window.__beat = setInterval(() => { const now = performance.now(); window.__gaps.push([now, now - last - 4]); last = now; }, 4);
      // The pane marks `data-opf-checking` while a worker request is in flight: the span between the mark and its removal is when only the worker is working.
      let opened = null;
      new MutationObserver(() => {
        const now = performance.now(), on = Boolean(document.querySelector('[data-opf-checking]'));
        if (on && opened === null) opened = now; else if (!on && opened !== null) { window.__checks.push([opened, now]); opened = null; }
      }).observe(document, { attributes: true, attributeFilter: ['data-opf-checking'], subtree: true });
      const { api } = demo.pane.editor, at = api.getValue().indexOf(marker);
      api.focus(); api.setSelection(at + marker.length);
    }, needle);
    // The caret was moved with a scroll into view: let the editor draw that (two frames) before the first key. A key that arrives in the same frame is read
    // by CodeMirror before the page has the caret settled and lands after the keys that follow it (the first letter ended up last).
    await suite.driver(page).settle();
    if (BURN > 0 && mode === 'on') await page.evaluate((ms) => {
      const post = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function (...args) { const end = performance.now() + ms; while (performance.now() < end); return post.apply(this, args); };
    }, BURN);
    // A slow runner receives, applies and paints the worker's answer slowly (50 to 70 ms in two of three CI runs of one job, 10 to 20 ms in the third): the same
    // hold on the main thread right after each answer (a listener added to the worker comes after the pane's, which has applied the answer by then).
    if (SLOW_APPLY > 0 && mode === 'on') await page.evaluate((ms) => {
      const post = Worker.prototype.postMessage, seen = new WeakSet();
      Worker.prototype.postMessage = function (...args) {
        if (!seen.has(this)) { seen.add(this); this.addEventListener('message', () => { const end = performance.now() + ms; while (performance.now() < end); }); }
        return post.apply(this, args);
      };
    }, SLOW_APPLY);
    const collect = () => page.evaluate(() => {
      const long = window.__long.splice(0), beats = window.__gaps.splice(0), spans = window.__checks.splice(0);
      const inflight = beats.filter(([end]) => spans.some(([from, to]) => end >= from && end <= to)).map(([, gap]) => gap);
      return { longest: Math.max(0, ...long), count: long.length, gap: Math.max(0, ...beats.map(([, gap]) => gap)), flight: spans.length ? Math.max(0, ...inflight) : null };
    });
    // One pattern is a series of bursts. A burst is typed, then the pane is left alone until it has checked and applied it (`whenIdle`) plus a moment for the paint
    // that follows, and only then is the next burst typed. That makes every burst exactly one sample of "typing, then a check", whatever the machine's speed; with
    // keys typed on a timer, a slow runner merged them into one check (one sample, paced run: `1 checks in the worker`).
    const run = async ({ bursts, size, spacing }, characters) => {
      const samples = [], start = await page.evaluate(() => demo.pane.checkerStats());
      for (let burst = 0; burst < bursts; burst++) {
        for (const character of characters.slice(burst * size, (burst + 1) * size)) { await page.keyboard.type(character); await page.waitForTimeout(spacing); }
        await page.evaluate(() => Promise.race([demo.pane.whenIdle(), new Promise((_, reject) => setTimeout(() => reject(new Error('the pane did not become idle in 60 s')), 60000))]));
        await page.waitForTimeout(TAIL);
        samples.push(await collect());
      }
      const end = await page.evaluate(() => demo.pane.checkerStats());
      return { samples, worker: end.worker - start.worker, inline: end.inline - start.inline };
    };
    const quick = await run(PATTERNS.quick, 'abcdefghijkl');
    const paced = await run(PATTERNS.paced, 'mnopqrstuvwx');
    const result = await page.evaluate(() => ({ stats: demo.pane.checkerStats(), slides: demo.editor.presentation.slides.length, title: demo.editor.presentation.slides[499].title }));
    assert.equal(result.slides, SLIDES);
    assert.equal(result.title, 'Slide 500 headlineabcdefghijklmnopqrstuvwx', `${format}: the typed text reached the document`);
    assert.deepEqual(suite.problems, [], `${format}: no page error`);
    return { quick, paced };
  } finally { await page.close(); }
}

try {
  for (const spec of cases) {
    const rounds = { on: [], off: [] };
    // OPF_PERF_WORKER_OFF=1: the worker's run is made on the main thread, as if the pane checked there; the comparison run is another one.
    for (let round = 0; round < ROUNDS; round++) for (const mode of COMPARE && spec.heavy ? ['on', 'off'] : ['on']) rounds[mode].push(await measure(mode === 'on' && WORKER_OFF ? 'off' : mode, spec));
    const series = (mode, pattern, key) => rounds[mode].flatMap((row) => row[pattern].samples.map((sample) => sample[key]));
    for (const pattern of ['quick', 'paced']) {
      for (const mode of rounds.off.length ? ['off', 'on'] : ['on']) {
        const gaps = series(mode, pattern, 'gap').sort((x, y) => x - y), longs = series(mode, pattern, 'longest');
        console.log(`P-003 ${spec.label} 1000 slides, ${pattern === 'quick' ? 'bursts of three keys 30 ms apart' : 'single keys 90 ms apart'}, ${mode === 'on' ? (WORKER_OFF ? 'worker run made on the main thread' : 'worker') : 'main thread'}: typical block ${median(gaps).toFixed(0)} ms, edits ${JSON.stringify(series(mode, pattern, 'gap').map(Math.round))}, in flight ${JSON.stringify(series(mode, pattern, 'flight').map((value) => (value === null ? null : Math.round(value))))}, worst ${gaps.at(-1).toFixed(0)} ms (${gaps.length} edits; longest task ${Math.max(...longs).toFixed(0)} ms), ${rounds[mode].reduce((sum, row) => sum + row[pattern].worker + row[pattern].inline, 0)} checks in ${mode === 'on' ? 'the worker' : 'the page'} (${engineName}).`);
      }
    }
    // The worker did the checking, not the page, and with the worker off the page did.
    if (!WORKER_OFF) for (const row of rounds.on) for (const pattern of ['quick', 'paced']) assert.ok(row[pattern].worker >= PATTERNS[pattern].bursts && row[pattern].inline === 0, `${spec.label} ${pattern}: the edits were checked in the worker (${row[pattern].worker} in the worker, ${row[pattern].inline} in the page)`);
    for (const row of rounds.off) for (const pattern of ['quick', 'paced']) assert.ok(row[pattern].inline >= PATTERNS[pattern].bursts && row[pattern].worker === 0, `${spec.label} ${pattern}: worker=off checks on the main thread`);
    for (const pattern of ['quick', 'paced']) assertBlockBudget(`${spec.label} ${pattern}`, { samples: series('on', pattern, 'gap'), flight: series('on', pattern, 'flight'), limit: LIMIT, baseline: rounds.off.length ? series('off', pattern, 'gap') : undefined });
  }
  console.log(`Source worker budgets: a typical edit in a 1000-slide deck blocks the main thread for less than ${LIMIT} ms (${engineName} ${suite.browserVersion}).`);
} finally { await suite.close(); }
