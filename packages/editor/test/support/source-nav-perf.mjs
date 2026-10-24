// The speed of go to definition, peek, references and rename on a 1000-slide deck (SPEC.md section 14 asks for no task of 50 ms on the main thread; the
// commands are asked for an answer well under 100 ms). The deck is `bigDeck(1000)` with slide ids and a logo used by every tenth slide, written as JSON
// (about 190 KB), YAML (140 KB) or Markdown (110 KB). Shared by the navigation suite.
import assert from 'node:assert/strict';
import { toMarkdown } from '@openpresentation/opf/markdown';
import { toYaml } from '@openpresentation/opf/yaml';
import { bigDeck } from './source-perf.mjs';

export function navigationDeck(count = 1000) {
  const deck = bigDeck(count);
  deck.assets = { logo: './logo.svg' };
  deck.slides.forEach((slide, index) => { slide.id = `s-${index + 1}`; if (index % 10 === 0) slide.image = 'asset:logo'; });
  return deck;
}
export const navigationText = (format, count = 1000) => (format === 'json' ? JSON.stringify(navigationDeck(count), null, 2) : format === 'yaml' ? toYaml(navigationDeck(count)).yaml : toMarkdown(navigationDeck(count)).markdown);

const median = (values) => [...values].sort((a, b) => a - b)[values.length >> 1];

/** Run each command five times on a deck of 1000 slides and check the time from the key to the announcement and the longest task. */
export async function runNavigationBudgets(suite, { format, limit = 100, taskLimit = 50 }) {
  const text = navigationText(format);
  const page = await suite.openPage();
  const kb = suite.driver(page);
  try {
    await kb.put(text, { format, literal: true });
    // The pane checks a new text in the background (its own budget, SPEC R-PERF-03); the commands are timed once that has finished.
    await page.waitForTimeout(2500);
    await page.evaluate(() => {
      const { api } = demo.pane.editor, source = api.getValue(), at = source.indexOf('asset:logo', source.length >> 1);
      window.__use = at + 8;
      window.__long = [];
      window.__windows = [];
      new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.__long.push({ start: entry.startTime, duration: entry.duration }); }).observe({ entryTypes: ['longtask'] });
    });
    const measure = async (name, key, { after = [], settle = true } = {}) => {
      const times = [];
      for (let round = 0; round < 5; round++) {
        await page.evaluate(() => { const { api } = demo.pane.editor; api.focus(); api.setSelection(window.__use); });
        await kb.settle();
        await page.evaluate(() => {
          window.__t0 = null; window.__t1 = null;
          document.addEventListener('keydown', () => { window.__t0 = performance.now(); }, { capture: true, once: true });
          const watch = new MutationObserver(() => { if (window.__t1 === null && window.__t0 !== null && document.querySelector('.opf-source-live').textContent) { window.__t1 = performance.now(); watch.disconnect(); } });
          watch.observe(document.querySelector('.opf-source-live'), { childList: true, characterData: true, subtree: true });
        });
        await page.keyboard.press(key);
        await page.waitForFunction(() => window.__t1 !== null, null, { timeout: 5000 });
        times.push(await page.evaluate(() => { window.__windows.push([window.__t0, window.__t1 + 20]); return window.__t1 - window.__t0; }));
        for (const step of after) await page.keyboard.press(step);
        if (settle) await kb.settle();
      }
      console.log(`P-NAV ${format} ${name} on 1000 slides: median ${median(times).toFixed(0)} ms, worst ${Math.max(...times).toFixed(0)} ms (limit ${limit} ms).`);
      assert.ok(Math.max(...times) <= limit, `${format}: ${name} answers within ${limit} ms on 1000 slides (took ${times.map((time) => time.toFixed(0))})`);
    };
    // The first use loads the language chunk: not counted.
    await page.keyboard.press('F12');
    await page.waitForFunction(() => (window.__live ?? []).length > 0);
    await measure('go to definition (F12)', 'F12');
    await measure('peek (Alt+F12)', 'Alt+F12', { after: ['Escape'] });
    await measure('references (Shift+F12)', 'Shift+F12', { after: ['Escape'] });
    await measure('rename opens (F2)', 'F2', { after: ['Escape'] });
    // Applying a rename that changes a hundred and one places.
    const applied = [];
    for (let round = 0; round < 3; round++) {
      await page.evaluate((name) => { const { api } = demo.pane.editor; api.focus(); api.setSelection(api.getValue().lastIndexOf(`asset:${name}`) + 8); }, round === 0 ? 'logo' : `brand${round - 1}`);
      await kb.settle();
      await page.keyboard.press('F2');
      await page.waitForSelector('.opf-sym-input', { timeout: 4000 }).catch(async (error) => { throw new Error(`${error.message} live=${JSON.stringify(await kb.live())} nav=${JSON.stringify(await kb.nav())} focus=${await kb.focus()}`); });
      await page.keyboard.type(`brand${round}`);
      await page.evaluate(() => { window.__t0 = null; window.__t1 = null; document.addEventListener('keydown', () => { window.__t0 = performance.now(); }, { capture: true, once: true }); const watch = new MutationObserver(() => { if (window.__t0 !== null && /Renamed/.test(document.querySelector('.opf-source-live').textContent)) { window.__t1 = true; watch.disconnect(); } }); watch.observe(document.querySelector('.opf-source-live'), { childList: true, characterData: true, subtree: true }); });
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => window.__t1 === true, null, { timeout: 5000 });
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      applied.push(await page.evaluate(() => { const done = performance.now(); window.__windows.push([window.__t0, done]); return done - window.__t0; }));
      await kb.settle();
    }
    console.log(`P-NAV ${format} rename applied to 101 places on 1000 slides: median ${median(applied).toFixed(0)} ms, worst ${Math.max(...applied).toFixed(0)} ms (limit ${limit * 2} ms, to the next painted frame).`);
    assert.ok(Math.max(...applied) <= limit * 2, `${format}: a rename of 101 places is painted within ${limit * 2} ms (took ${applied.map((time) => time.toFixed(0))})`);
    // Only the tasks that ran while a command was answering count (a text the pane has just been given is checked by the pane on its own schedule).
    const long = await page.evaluate(() => window.__long.filter((task) => window.__windows.some(([from, to]) => task.start < to && task.start + task.duration > from)).map((task) => task.duration));
    console.log(`P-NAV ${format} longest main-thread task while a command answers, on 1000 slides: ${Math.max(0, ...long).toFixed(0)} ms (limit ${taskLimit} ms).`);
    assert.ok(Math.max(0, ...long) <= taskLimit, `${format}: no task holds the main thread for ${taskLimit} ms (${long.map((time) => time.toFixed(0))})`);
  } finally { await page.close(); }
}
