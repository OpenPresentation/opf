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
//  - while the worker's request is in flight (the pane sets `data-opf-checking`) the main thread has nothing of the check to do: the typical block there, less
//    CodeMirror's background parse, must be at most 25% of the main-thread run's (0 to 11 ms against 63 to 139 ms on CI); a check that also runs on the main
//    thread fills that span. Most edits must have had a request in flight, so a check that never reached the worker fails, too. The parse is left out because
//    it is no check: CodeMirror re-parses the text in idle time, 100 ms after a key, in slices of up to 100 ms on Chromium, with or without the worker. When
//    the worker answers later than that (a slow runner) the slice lands in the span: on 2026-11-14 it measured 38 to 88 ms there against 113 and 172 ms, and
//    failed the budget twice on unchanged code. The log prints the in-flight block with the parse as well.
//  - the typical block of the whole edit (typed, checked, applied, painted) must be at most 85% of the main-thread run's. That is 17 to 36% on a fast machine
//    and a good 2-vCPU runner, 65 to 70% on a bad one (two of three runs of one job, where receiving, applying and painting the answer took 50 to 70 ms instead of
//    10 to 20), and about 100% with the check on the main thread. A check that is only part of the work that stays on the main thread (a re-validation after the
//    answer) is the one regression this budget sees only when it is most of the main-thread cost.
// Where there is no measurable comparison (JSON, whose main-thread check is cheap, or OPF_PERF_COMPARE=0) the median must be within the limit (50 ms; 100 ms on
// CI). No single edit may block for three limits. No retries.
// Flight uses native busy-write bounds and EVERY heartbeat interval: at most min(positive excess, intersected busy-union time less the parse's idle
// callbacks). This conservative wall-time upper bound keeps true boundary overlaps; delayed MutationObserver spans remain raw evidence, never the flight verdict.
//
// OPF_PERF_LIMIT_MS sets the limit for a typical edit; OPF_PERF_COMPARE=0 skips the main-thread run (then the limit judges); OPF_PERF_ROUNDS
// repeats the whole measurement (default 1; the samples of all rounds count); OPF_CPU_THROTTLE=<rate> slows Chromium down; OPF_BROWSER_ENGINE=webkit runs it on WebKit.
// To see that the test can fail (YAML must fail): OPF_PERF_WORKER_OFF=1 makes the worker's run on the main thread, as if the pane checked there;
// OPF_PERF_BURN_MS=<ms> keeps the worker but holds the main thread that long at every request to it, as a check done twice (it fails from about 25% of the
// main-thread run: 15 ms passes, 25 ms fails, unthrottled); OPF_PERF_DUPLICATE_CHECK=1 runs a real one, the pane's inline check of the same text in a second,
// hidden pane with the worker off, at every request (fails). To see that a bad runner passes: OPF_PERF_SLOW_APPLY_MS=<ms> holds the main thread that long
// right after every answer of the worker (about 70% of the main-thread run passes: 26 ms unthrottled; about 90% fails: 40 ms); OPF_PERF_SLOW_WORKER_MS=<ms>
// hands each answer to the pane that much later, so the background parse can land in the span (on a fast machine the parse is too short to matter; with
// OPF_CPU_THROTTLE=4 it lands there on most edits even without this, 35 to 104 ms each).
import assert from 'node:assert/strict';
import { engineName, startKeyboardSuite } from './support/source-keyboard.mjs';
import { assertBlockBudget, median } from './support/block-budget.mjs';
import { bigDeck, bigText } from './support/source-perf.mjs';
import { installWorkerFlightClock, workerFlightBlock } from './support/worker-flight.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// On a CI runner (CI is set) the limit is the plan's 2x for noise.
const CI = Boolean(process.env.CI);
const LIMIT = Number(process.env.OPF_PERF_LIMIT_MS ?? (CI ? 100 : 50));
const ROUNDS = Number(process.env.OPF_PERF_ROUNDS ?? 1);
const COMPARE = process.env.OPF_PERF_COMPARE !== '0';
const WORKER_OFF = process.env.OPF_PERF_WORKER_OFF === '1';
const BURN = Number(process.env.OPF_PERF_BURN_MS ?? 0);
const SLOW_APPLY = Number(process.env.OPF_PERF_SLOW_APPLY_MS ?? 0);
const SLOW_WORKER = Number(process.env.OPF_PERF_SLOW_WORKER_MS ?? 0);
const DUPLICATE = process.env.OPF_PERF_DUPLICATE_CHECK === '1';
const SLIDES = 1000;
const TAIL = 150;
const PATTERNS = { quick: { bursts: 4, size: 3, spacing: 30 }, paced: { bursts: 12, size: 1, spacing: 90 } };
const cases = [
  { format: 'yaml', label: 'YAML', heavy: true, needle: 'title: Slide 500 headline', text: () => bigText('yaml', SLIDES) },
  { format: 'md', label: 'Markdown', heavy: true, needle: '# Slide 500 headline', text: () => bigText('md', SLIDES) },
  { format: 'json', label: 'JSON', needle: '"title": "Slide 500 headline', text: () => `${JSON.stringify(bigDeck(SLIDES), null, 2)}\n` },
];

// Fresh owned evidence is written outside measured edits, before verdict gates and again on failure.
const parent = fileURLToPath(new URL('../artifacts/source-worker-perf/', import.meta.url));
await mkdir(parent, { recursive: true });
const output = path.join(parent, `${Date.now()}-${process.pid}`);
await mkdir(output);
const sources = await Promise.all(['./source-worker-perf-browser.mjs', './support/worker-flight.mjs', './support/block-budget.mjs'].map(async name => {
  const bytes = await readFile(new URL(name, import.meta.url)); return { name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}));
const evidence = { schemaVersion: 1, scope: 'Conservative native-busy heartbeat attribution; wall time, not CPU time', node: process.version, platform: process.platform, sourceHead: process.env.GITHUB_SHA ?? null, sources,
  parameters: { CI, LIMIT, ROUNDS, COMPARE, WORKER_OFF, BURN, SLOW_APPLY, SLOW_WORKER, DUPLICATE, SLIDES, TAIL, PATTERNS, engineName, cpuThrottle: process.env.OPF_CPU_THROTTLE ?? null, keyboardPlatform: process.env.OPF_KEYBOARD_PLATFORM ?? process.platform }, rows: [], originalFailure: null, preservationErrors: [] };
const describeError = error => ({ name: String(error?.name ?? 'Error'), message: String(error?.message ?? error), stack: String(error?.stack ?? '') });
const persist = () => writeFile(path.join(output, 'report.json'), JSON.stringify(evidence, null, 2) + '\n');
await persist();
console.log(`Source worker raw evidence: ${output}`);
const suite = await startKeyboardSuite();
evidence.browserVersion = suite.browserVersion;

/** One round: open the harness, load the deck, type, and report the longest long task, the worst heartbeat gap and the pane's check counts. */
async function measure(mode, { format, needle, text }) {
  const page = await suite.openPage(`?worker=${mode}`);
  suite.problems.length = 0;
  const row = { mode, format, samples: [], result: null, error: null, clock: null }; evidence.rows.push(row);
  let measureError = null;
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
    await page.evaluate(installWorkerFlightClock);
    await page.evaluate((marker) => {
      window.__long = []; window.__gaps = []; window.__checks = [];
      try { new PerformanceObserver((list) => { for (const entry of list.getEntries()) { window.__long.push(entry.duration); window.__workerFlight.record('longtasks', { start: entry.startTime, duration: entry.duration }); } }).observe({ entryTypes: ['longtask'] }); } catch { /* No longtask entries on this engine. */ }
      let last = performance.now();
      window.__beat = setInterval(() => { const now = performance.now(); window.__gaps.push([now, now - last - 4, last]); window.__workerFlight.record('beats', [last, now, now - last - 4]); last = now; }, 4);
      // The pane marks `data-opf-checking` while a worker request is in flight: the span between the mark and its removal is when only the worker is working.
      let opened = null;
      new MutationObserver(() => {
        const now = performance.now(), on = Boolean(document.querySelector('[data-opf-checking]'));
        window.__workerFlight.record('moEdges', { at: now, on, opened });
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
    // A real check beside the worker's: at every check request, a second pane with the worker off (hidden, applying at once) reads and applies the same
    // text on the main thread, the inline path the pane takes without a worker.
    if (DUPLICATE && mode === 'on') await page.evaluate((name) => {
      const host = document.createElement('div');
      host.hidden = true; document.body.append(host);
      const session = demo.createEditorSession({ name: 'Duplicate check', slides: [{ title: 'Duplicate check' }] }, { catalogs: demo.editor.catalogs });
      const twin = window.__twin = demo.createSourcePane(host, { editor: session, format: name, applyDelay: 0, worker: false, completions: false });
      const post = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function (...args) {
        if (args[0]?.type === 'check') { const { api } = twin.editor; api.replace(0, api.getValue().length, args[0].text); }
        return post.apply(this, args);
      };
    }, format);
    // A slow runner's worker answers late: the pane gets each answer that much later, with the main thread idle meanwhile, so CodeMirror's background
    // parse (100 ms after the key, in idle time) runs while the request is in flight, as on the CI runs of 2026-11-14.
    if (SLOW_WORKER > 0 && mode === 'on') await page.evaluate((ms) => {
      const post = Worker.prototype.postMessage, seen = new WeakSet();
      Worker.prototype.postMessage = function (...args) {
        if (!seen.has(this)) { seen.add(this); const handler = this.onmessage; this.onmessage = function (event) { setTimeout(() => handler.call(this, event), ms); }; }
        return post.apply(this, args);
      };
    }, SLOW_WORKER);
    const collect = async () => {
      const raw = await page.evaluate(() => {
        const long = window.__long.splice(0), beats = window.__gaps.splice(0), spans = window.__checks.splice(0);
        const inflight = beats.filter(([end]) => spans.some(([from, to]) => end >= from && end <= to)).map(([, gap]) => gap);
        // Keep the old observer-based result as evidence only. Its whole-edit fields remain the verdict's exact fields.
        const observed = { longest: Math.max(0, ...long), count: long.length, gap: Math.max(0, ...beats.map(([, gap]) => gap)), flight: spans.length ? Math.max(0, ...inflight) : null };
        const { spans: nativeSpans, newSpans: newNativeSpans, parses } = window.__workerFlight.takeSpans(), intervals = beats.map(([end, gap, from]) => [from, end, gap]);
        const record = { at: performance.now(), observed, intervals, nativeSpans, newNativeSpans, parses, moSpans: spans, longDurations: long };
        window.__workerFlight.record('samples', record);
        return record;
      });
      // `flight` leaves CodeMirror's background parse out (support/worker-flight.mjs); `parsedFlight` counts it, as evidence of how much of the span it filled.
      const result = { ...raw.observed, flight: workerFlightBlock(raw.intervals, raw.nativeSpans, raw.newNativeSpans, raw.parses), parsedFlight: workerFlightBlock(raw.intervals, raw.nativeSpans, raw.newNativeSpans) };
      row.samples.push({ ...raw, result });
      return result;
    };
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
    const result = await page.evaluate(() => ({ stats: demo.pane.checkerStats(), twin: window.__twin?.checkerStats().inline ?? null, slides: demo.editor.presentation.slides.length, title: demo.editor.presentation.slides[499].title }));
    if (result.twin !== null) console.log(`P-003 ${format}: ${result.twin} duplicate checks on the main thread beside the worker's.`);
    assert.equal(result.slides, SLIDES);
    assert.equal(result.title, 'Slide 500 headlineabcdefghijklmnopqrstuvwx', `${format}: the typed text reached the document`);
    assert.deepEqual(suite.problems, [], `${format}: no page error`);
    row.result = { quick, paced };
    return { quick, paced };
  } catch (error) { measureError = error; row.error = describeError(error); throw error; }
  finally {
    let secondary = null;
    try {
      row.clock = await page.evaluate(() => {
        const state = window.__workerFlight;
        if (!state) return { notInstalled: true };
        state.restore(); return state.snapshot();
      });
      if (row.clock.notInstalled || !row.clock.restored || row.clock.opened !== null || row.clock.faults.length || Object.keys(row.clock.overflow).length) throw new Error('Worker-flight evidence incomplete, invalid, unrestored or overflowed');
    } catch (error) { secondary = error; evidence.preservationErrors.push(describeError(error)); }
    try { await persist(); } catch (error) { secondary ??= error; evidence.preservationErrors.push(describeError(error)); }
    try { await page.close(); } catch (error) { secondary ??= error; evidence.preservationErrors.push(describeError(error)); }
    if (secondary) { if (measureError) console.error('Source worker evidence also failed:', describeError(secondary)); else throw secondary; }
  }
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
        console.log(`P-003 ${spec.label} 1000 slides, ${pattern === 'quick' ? 'bursts of three keys 30 ms apart' : 'single keys 90 ms apart'}, ${mode === 'on' ? (WORKER_OFF ? 'worker run made on the main thread' : 'worker') : 'main thread'}: typical block ${median(gaps).toFixed(0)} ms, edits ${JSON.stringify(series(mode, pattern, 'gap').map(Math.round))}, in flight ${JSON.stringify(series(mode, pattern, 'flight').map((value) => (value === null ? null : Math.round(value))))} (${JSON.stringify(series(mode, pattern, 'parsedFlight').map((value) => (value === null ? null : Math.round(value))))} with CodeMirror's background parse), worst ${gaps.at(-1).toFixed(0)} ms (${gaps.length} edits; longest task ${Math.max(...longs).toFixed(0)} ms), ${rounds[mode].reduce((sum, row) => sum + row[pattern].worker + row[pattern].inline, 0)} checks in ${mode === 'on' ? 'the worker' : 'the page'} (${engineName}).`);
      }
    }
    // The worker did the checking, not the page, and with the worker off the page did.
    if (!WORKER_OFF) for (const row of rounds.on) for (const pattern of ['quick', 'paced']) assert.ok(row[pattern].worker >= PATTERNS[pattern].bursts && row[pattern].inline === 0, `${spec.label} ${pattern}: the edits were checked in the worker (${row[pattern].worker} in the worker, ${row[pattern].inline} in the page)`);
    for (const row of rounds.off) for (const pattern of ['quick', 'paced']) assert.ok(row[pattern].inline >= PATTERNS[pattern].bursts && row[pattern].worker === 0, `${spec.label} ${pattern}: worker=off checks on the main thread`);
    for (const pattern of ['quick', 'paced']) assertBlockBudget(`${spec.label} ${pattern}`, { samples: series('on', pattern, 'gap'), flight: series('on', pattern, 'flight'), limit: LIMIT, baseline: rounds.off.length ? series('off', pattern, 'gap') : undefined });
  }
  console.log(`Source worker budgets: a typical edit in a 1000-slide deck blocks the main thread for less than ${LIMIT} ms (${engineName} ${suite.browserVersion}).`);
} catch (error) { evidence.originalFailure = describeError(error); throw error; }
finally {
  let secondary = null;
  try { await persist(); } catch (error) { secondary = error; }
  try { await suite.close(); } catch (error) { secondary ??= error; }
  if (secondary) { if (evidence.originalFailure) console.error('Source worker final evidence also failed:', describeError(secondary)); else throw secondary; }
}
