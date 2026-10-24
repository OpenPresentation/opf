// Phase 4 budget (SPEC R-PERF-03, artifacts/source-editor/TEST-PLAN.md section 8.2): typing in a 1000-slide YAML, Markdown or JSON deck never blocks the
// main thread for 50 ms, with the text checks in the source worker. Twelve characters are typed in the middle of slide 500 with real keyboard events, 30 ms
// apart, then the pane is left alone until it is idle (and 1.5 s more). A `longtask` entry is a main-thread task of 50 ms or more, so there must be none (the
// worst of three rounds counts); a 4 ms heartbeat shows how close the page came. Then twelve more are typed 90 ms apart, slower than the apply delay, so every
// key is checked and applied on its own. The same run without the worker is printed for comparison, not asserted.
// OPF_PERF_LIMIT_MS raises the limit for a slow machine (default 50); OPF_BROWSER_ENGINE=webkit runs it on WebKit, which has no longtask entries (the heartbeat
// is asserted there); OPF_PERF_ROUNDS sets the rounds (default 3).
import assert from 'node:assert/strict';
import { engineName, startKeyboardSuite } from './support/source-keyboard.mjs';
import { bigDeck, bigText } from './support/source-perf.mjs';

const LIMIT = Number(process.env.OPF_PERF_LIMIT_MS ?? 50);
const ROUNDS = Number(process.env.OPF_PERF_ROUNDS ?? 3);
const SLIDES = 1000;
const cases = [
  { format: 'yaml', label: 'YAML', needle: 'title: Slide 500 headline', text: () => bigText('yaml', SLIDES) },
  { format: 'md', label: 'Markdown', needle: '# Slide 500 headline', text: () => bigText('md', SLIDES) },
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
    await page.evaluate(() => demo.pane.whenIdle());
    await page.waitForFunction(() => demo.pane.getProblems().length === 0 && document.querySelector('.opf-source-findings')?.hidden !== false);
    await page.waitForTimeout(500);
    await page.evaluate((marker) => {
      window.__long = []; window.__gaps = [];
      try { new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.__long.push(entry.duration); }).observe({ entryTypes: ['longtask'] }); } catch { /* No longtask entries on this engine. */ }
      let last = performance.now();
      window.__beat = setInterval(() => { const now = performance.now(); window.__gaps.push(now - last - 4); last = now; }, 4);
      const { api } = demo.pane.editor, at = api.getValue().indexOf(marker);
      api.focus(); api.setSelection(at + marker.length);
    }, needle);
    const before = await page.evaluate(() => demo.pane.checkerStats());
    const collect = () => page.evaluate(() => { const long = window.__long.splice(0), gaps = window.__gaps.splice(0); return { longest: Math.max(0, ...long), count: long.length, gap: Math.max(0, ...gaps) }; });
    const type = async (characters, spacing, tail) => {
      for (const character of characters) { await page.keyboard.type(character); await page.waitForTimeout(spacing); }
      await page.evaluate(() => demo.pane.whenIdle());
      await page.waitForTimeout(tail);
      return collect();
    };
    const quick = await type('abcdefghijkl', 30, 1500);
    const mid = await page.evaluate(() => demo.pane.checkerStats());
    const paced = await type('mnopqrstuvwx', 90, 1000);
    const result = await page.evaluate(() => ({ stats: demo.pane.checkerStats(), slides: demo.editor.presentation.slides.length, title: demo.editor.presentation.slides[499].title }));
    assert.equal(result.slides, SLIDES);
    assert.equal(result.title, 'Slide 500 headlineabcdefghijklmnopqrstuvwx', `${format}: the typed text reached the document`);
    assert.deepEqual(suite.problems, [], `${format}: no page error`);
    return {
      quick: { ...quick, worker: mid.worker - before.worker, inline: mid.inline - before.inline },
      paced: { ...paced, worker: result.stats.worker - mid.worker, inline: result.stats.inline - mid.inline },
    };
  } finally { await page.close(); }
}

try {
  for (const spec of cases) {
    const rounds = { on: [], off: [] };
    for (let round = 0; round < ROUNDS; round++) for (const mode of ['on', 'off']) rounds[mode].push(await measure(mode, spec));
    for (const pattern of ['quick', 'paced']) {
      for (const mode of ['off', 'on']) {
        const list = rounds[mode].map((row) => row[pattern]), worst = (key) => Math.max(...list.map((row) => row[key]));
        console.log(`P-003 ${spec.label} 1000 slides, ${pattern === 'quick' ? 'typed 30 ms apart' : 'typed 90 ms apart'}, ${mode === 'on' ? 'worker' : 'main thread'}: longest task ${worst('longest').toFixed(0)} ms (${worst('count')} over 50 ms), worst gap of a 4 ms heartbeat ${worst('gap').toFixed(0)} ms, ${list[0].worker + list[0].inline} checks in ${mode === 'on' ? 'the worker' : 'the page'} (${engineName}, worst of ${ROUNDS}).`);
      }
    }
    for (const row of rounds.on) for (const pattern of ['quick', 'paced']) {
      const now = row[pattern];
      // The worker did the checking, not the page.
      assert.ok(now.worker >= 1 && now.inline === 0, `${spec.label} ${pattern}: the edits were checked in the worker (${JSON.stringify(now)})`);
      // The budget: no main-thread task of 50 ms (a longtask entry), and the heartbeat under the limit.
      assert.equal(now.count, 0, `${spec.label} ${pattern}: no long task while typing in a 1000-slide deck (${now.longest.toFixed(0)} ms)`);
      assert.ok(now.longest <= LIMIT, `${spec.label} ${pattern}: the longest task ${now.longest} ms is within ${LIMIT} ms`);
      assert.ok(now.gap < LIMIT, `${spec.label} ${pattern}: the main thread was never blocked for ${LIMIT} ms (${now.gap.toFixed(0)} ms)`);
    }
    for (const row of rounds.off) for (const pattern of ['quick', 'paced']) assert.ok(row[pattern].inline >= 1 && row[pattern].worker === 0, `${spec.label}: worker=off checks on the main thread`);
  }
  console.log(`Source worker budgets: no main-thread task of ${LIMIT} ms while typing in a 1000-slide deck (${engineName} ${suite.browserVersion}).`);
} finally { await suite.close(); }
