// Editor startup budget (the 0.28.0 regression): the built playground, opened with the sample deck and with a 300-slide deck, draws its first preview
// (`#preview svg`) within a budget, and the font analysis behind the font gate does each piece of work once.
//
// 0.28.0 drew the first preview 2.3 times later than 0.26.10 (pptx.gallery's /editor: 23.2 s against 10.1 s on a Mac, over 30 s on a CI runner). The time
// was in the fonts handle's `pending`, which the editor asks before every render: `pendingScripts` resolved the font families of the deck by composing every
// slide with core's default measurement (a dozen `\p{...}` regexes per character, run again for every fitting trial, and 0.28.0's content sizing tries more
// sizes), and `pendingLazyFonts` composed and drew every slide again, on every call.
//
// Two judgments, so a busy runner cannot fail a correct editor and a fast one cannot hide a regression:
//  - Work counts, which do not depend on the machine: the handle's `analysisStats` after the first preview. Each slide is composed for its faces once and
//    its design resolved once, each drawn string is scanned once, and an edit of one slide analyzes that slide again and no other.
//  - Time to the first preview, the median of OPF_PERF_ROUNDS fresh pages (default 3), at most 0.26.10's (OPF_STARTUP_LIMIT_MS for the sample deck,
//    OPF_STARTUP_LARGE_LIMIT_MS for the large one). Measured with this test on an M-series Mac (Chromium): 0.26.10 took 3.2 s and 6.4 s, 0.28.0 4.1 s and
//    6.4 s, this fix 2.3 s and 3.4 s. The limits are 0.26.10's times: 3.2 s and 6.4 s here, and 8 s and 16 s on CI, where a runner is two to three times
//    slower. The time judges only "no slower than 0.26.10"; the work counts above are what catch a regression to repeated whole-deck work.
//
// OPF_STARTUP_PLAYGROUND points the test at another built playground (an older release, to compare; it needs `OPF_EDITOR_HOST.document` support, and
// without `analysisStats` only the times are printed and judged). OPF_BROWSER_ENGINE=webkit runs it on WebKit.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';
import { largeDeck, playgroundDeck } from './support/startup-decks.mjs';
import { median } from './support/block-budget.mjs';

const CI = Boolean(process.env.CI);
const ROUNDS = Number(process.env.OPF_PERF_ROUNDS ?? 3);
const LIMIT = Number(process.env.OPF_STARTUP_LIMIT_MS ?? (CI ? 8000 : 3200));
const LARGE_LIMIT = Number(process.env.OPF_STARTUP_LARGE_LIMIT_MS ?? (CI ? 16000 : 6400));
const ENGINE = process.env.OPF_BROWSER_ENGINE === 'webkit' ? 'webkit' : 'chromium';
const root = path.resolve(process.env.OPF_STARTUP_PLAYGROUND ?? fileURLToPath(new URL('../artifacts/playground/', import.meta.url)));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.ttf': 'font/ttf', '.wasm': 'application/wasm' };

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
    const target = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403).end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] ?? 'application/octet-stream' }).end(await readFile(target));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const sample = await playgroundDeck();
const decks = [
  { label: 'sample deck', deck: sample, limit: LIMIT },
  { label: '300-slide deck', deck: largeDeck(sample, 300), limit: LARGE_LIMIT },
];

/** The strings the font analysis scans: every distinct string of the deck (an upper bound of the drawn ones). */
function distinctStrings(value, into = new Set()) {
  if (typeof value === 'string') into.add(value);
  else if (Array.isArray(value)) for (const item of value) distinctStrings(item, into);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) distinctStrings(item, into);
  return into;
}

let browser;
const problems = [];
try {
  browser = await (ENGINE === 'webkit' ? webkit : chromium).launch();
  /** One fresh page: the time from navigation to the first `#preview svg`, and the handle's analysis counters then. */
  const open = async (deck) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => problems.push(`pageerror: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') problems.push(`console: ${message.text()}`); });
    await page.route(/^https?:/, route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    await page.addInitScript(start => {
      window.OPF_EDITOR_HOST = { persistence: false, document: start, onReady: handles => { window.__opf = handles; } };
      const seen = () => {
        if (window.__firstPreview === undefined && document.querySelector('#preview svg')) window.__firstPreview = performance.now();
        return window.__firstPreview !== undefined;
      };
      new MutationObserver((_, observer) => { if (seen()) observer.disconnect(); }).observe(document, { childList: true, subtree: true });
    }, deck);
    await page.goto(`${base}/index.html`);
    await page.locator('#preview svg').first().waitFor({ timeout: 120000 });
    const result = await page.evaluate(() => ({ ms: window.__firstPreview, stats: window.__opf?.fonts?.analysisStats ?? null }));
    return { page, ...result };
  };

  for (const entry of decks) {
    const slides = entry.deck.slides.length, strings = distinctStrings(entry.deck).size;
    const times = [];
    let last;
    for (let round = 0; round < ROUNDS; round++) {
      const result = await open(entry.deck);
      times.push(result.ms);
      if (round < ROUNDS - 1) await result.page.close();
      else last = result;
    }
    const typical = median(times);
    console.log(`${entry.label} (${slides} slides): first preview ${times.map(ms => `${Math.round(ms)} ms`).join(', ')}; median ${Math.round(typical)} ms (limit ${entry.limit} ms, ${ENGINE})`);
    if (last.stats) {
      const { stats, page } = last;
      console.log(`  analysis at the first preview: ${JSON.stringify(stats)}`);
      // Work counts: the editor asks `pending` several times per render; each slide is analyzed once, each string scanned once.
      assert.ok(stats.slides <= slides, `${entry.label}: ${stats.slides} slide analyses for the faces of ${slides} slides; each slide is composed once.`);
      assert.ok(stats.designs <= slides, `${entry.label}: ${stats.designs} slide designs resolved for ${slides} slides; each is resolved once.`);
      assert.ok(stats.strings <= strings, `${entry.label}: ${stats.strings} strings scanned for scripts, more than the deck's ${strings} distinct strings.`);
      // An edit of one slide analyzes that slide again, and no other.
      const before = await page.evaluate(() => ({ ...window.__opf.fonts.analysisStats }));
      const title = `Edited ${Date.now()}`;
      await page.evaluate(title => window.__opf.session.set('/slides/1/title', title), title);
      await page.waitForFunction(title => [...document.querySelectorAll('#preview svg text')].some(node => node.textContent.includes(title)) || document.querySelector('#slide-title')?.textContent === title, title, { timeout: 60000 }).catch(() => {});
      const after = await page.evaluate(() => ({ ...window.__opf.fonts.analysisStats }));
      console.log(`  after an edit of slide 2: ${JSON.stringify(after)}`);
      assert.ok(after.slides - before.slides <= 1, `${entry.label}: an edit of one slide composed ${after.slides - before.slides} slides for their faces.`);
      assert.ok(after.designs - before.designs <= 1, `${entry.label}: an edit of one slide resolved ${after.designs - before.designs} slide designs.`);
      assert.ok(after.strings - before.strings <= 1, `${entry.label}: an edit of one title scanned ${after.strings - before.strings} strings.`);
    } else console.log('  this playground has no analysisStats: only the time is judged.');
    await last.page.close();
    assert.ok(typical <= entry.limit, `${entry.label}: the first preview took ${Math.round(typical)} ms (median of ${ROUNDS}), over the ${entry.limit} ms limit.`);
  }
  assert.deepEqual(problems, [], 'The playground reported no errors.');
  console.log('Editor startup budget holds.');
} finally {
  await browser?.close();
  server.close();
}
