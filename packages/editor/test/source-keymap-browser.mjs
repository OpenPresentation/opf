// Phase 4 keyboard cases that belong to the editor itself (artifacts/source-editor/TEST-PLAN.md sections 4.8 and 7): the fold gutter and chords, the line
// and selection keys, go to line and replace, and the shortcuts list, with real keyboard events on the source pane harness.
// OPF_BROWSER_ENGINE=webkit runs it on WebKit; OPF_KEYBOARD_PLATFORM=darwin|win32|linux picks the keymap; OPF_KEYBOARD_ONLY=<regexp> runs matching case ids.
import assert from 'node:assert/strict';
import { engineName, platform, runCases, startKeyboardSuite } from './support/source-keyboard.mjs';
import { keymapCases, outlinePanelCases } from './support/source-cases/keymap.mjs';
import { bigDeck, bigText } from './support/source-perf.mjs';

const suite = await startKeyboardSuite();
const only = process.env.OPF_KEYBOARD_ONLY ? new RegExp(process.env.OPF_KEYBOARD_ONLY) : null;
try {
  const result = await runCases(suite, (only ? [...keymapCases, ...outlinePanelCases].filter((row) => only.test(row[0])) : [...keymapCases, ...outlinePanelCases]), { onFailure: (detail) => console.error(`  FAIL ${detail}`) });
  console.log(`Keymap: ${result.passed} cases pass${result.failed.length ? `, ${result.failed.length} fail` : ''} (${engineName} ${suite.browserVersion}, keymap ${platform}).`);
  assert.deepEqual(result.failed, [], 'every keymap case passes');
  // Fold All, Fold Level, Unfold All and the symbol picker on 1000 slides (about 140 KB of YAML, 108 KB of Markdown, 190 KB of JSON) hold the main thread for under
  // 50 ms (SPEC R-PERF-03; 100 ms on a CI runner, the plan's 2x for noise; OPF_PERF_LIMIT_MS sets it). The longtask API reports tasks of 50 ms or more; WebKit has none.
  if (!only || only.test('P-')) {
    const mod = platform === 'darwin' ? 'Meta' : 'Control';
    const limit = Number(process.env.OPF_PERF_LIMIT_MS ?? (process.env.CI ? 100 : 50));
    for (const format of ['json', 'yaml', 'md']) {
      const page = await suite.openPage('?worker=off');
      const kb = suite.driver(page);
      try {
        await kb.put(format === 'json' ? JSON.stringify(bigDeck(1000), null, 2) : bigText(format, 1000), { format });
        await page.waitForTimeout(500);
        await page.evaluate(() => { window.__long = []; try { new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.__long.push(Math.round(entry.duration)); }).observe({ entryTypes: ['longtask'] }); } catch { /* No longtask entries here. */ } });
        const chord = async (second) => { await page.keyboard.press(`${mod}+k`); await page.keyboard.press(`${mod}+${second}`); await kb.settle(); };
        await chord('0'); await chord('j'); await chord('2'); await chord('j');
        await page.keyboard.press(`${mod}+Shift+o`);
        await page.waitForSelector('.opf-quickpick-item');
        await page.keyboard.type('slide 500');
        await kb.settle();
        assert.equal(await page.locator('.opf-quickpick-item').first().locator('.opf-quickpick-label').textContent(), '500. Slide 500 headline');
        await page.keyboard.press('Enter');
        await kb.settle();
        const long = await page.evaluate(() => window.__long);
        console.log(`P-004 ${format} fold all, unfold all, fold level 2 and the symbol picker on 1000 slides: longest task ${Math.max(0, ...long)} ms (limit ${limit} ms).`);
        assert.ok(Math.max(0, ...long) < limit, `${format}: no main-thread task of ${limit} ms or more (${long})`);
      } finally { await page.close(); }
    }
  }
  console.log('Source editor keyboard: phase 4 keymap cases pass.');
} finally { await suite.close(); }
