// Phase 4 keyboard cases that belong to the editor itself (artifacts/source-editor/TEST-PLAN.md sections 4.8 and 7): the fold gutter and chords, the line
// and selection keys, go to line and replace, and the shortcuts list, with real keyboard events on the source pane harness.
// OPF_BROWSER_ENGINE=webkit runs it on WebKit; OPF_KEYBOARD_PLATFORM=darwin|win32|linux picks the keymap; OPF_KEYBOARD_ONLY=<regexp> runs matching case ids.
import assert from 'node:assert/strict';
import { engineName, platform, runCases, startKeyboardSuite } from './support/source-keyboard.mjs';
import { keymapCases, outlinePanelCases } from './support/source-cases/keymap.mjs';
import { bigDeck, bigText } from './support/source-perf.mjs';
import { ATTEMPTS, longest, observeLongTasks, taskFailures, taskLimit } from './support/task-budget.mjs';

const suite = await startKeyboardSuite();
const only = process.env.OPF_KEYBOARD_ONLY ? new RegExp(process.env.OPF_KEYBOARD_ONLY) : null;
try {
  const result = await runCases(suite, (only ? [...keymapCases, ...outlinePanelCases].filter((row) => only.test(row[0])) : [...keymapCases, ...outlinePanelCases]), { onFailure: (detail) => console.error(`  FAIL ${detail}`) });
  console.log(`Keymap: ${result.passed} cases pass${result.failed.length ? `, ${result.failed.length} fail` : ''} (${engineName} ${suite.browserVersion}, keymap ${platform}).`);
  assert.deepEqual(result.failed, [], 'every keymap case passes');
  // Fold All, Fold Level, Unfold All and the symbol picker on 1000 slides (about 140 KB of YAML, 108 KB of Markdown, 190 KB of JSON) hold the main thread for under
  // 50 ms on a laptop (SPEC R-PERF-03). The longtask API reports tasks of 50 ms or more, so there that is "no long task"; WebKit has none. A CI runner is two to four
  // times slower (the YAML run is 93 ms at a CPU four times slower) and stalls now and then, so one run against 100 ms failed by a hair (101 to 109 ms) while the
  // code had not changed. The run is therefore made three times on the same page and judged by its typical attempt, with CI headroom of 150 ms (300 ms is a freeze
  // and fails on any machine); test/support/task-budget.mjs has the reasons, OPF_PERF_LIMIT_MS sets the limit.
  if (!only || only.test('P-')) {
    const mod = platform === 'darwin' ? 'Meta' : 'Control';
    const limit = taskLimit();
    for (const format of ['json', 'yaml', 'md']) {
      const page = await suite.openPage('?worker=off');
      const kb = suite.driver(page);
      try {
        await kb.put(format === 'json' ? JSON.stringify(bigDeck(1000), null, 2) : bigText(format, 1000), { format });
        await page.waitForTimeout(500);
        const take = await observeLongTasks(page);
        await take();
        const chord = async (second) => { await page.keyboard.press(`${mod}+k`); await page.keyboard.press(`${mod}+${second}`); await kb.settle(); };
        const attempts = [];
        for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
          await chord('0'); await chord('j'); await chord('2'); await chord('j');
          await page.keyboard.press(`${mod}+Shift+o`);
          await page.waitForSelector('.opf-quickpick-item');
          await page.keyboard.type('slide 500');
          await kb.settle();
          assert.equal(await page.locator('.opf-quickpick-item').first().locator('.opf-quickpick-label').textContent(), '500. Slide 500 headline');
          await page.keyboard.press('Enter');
          await kb.settle();
          attempts.push(longest(await take()));
        }
        console.log(`P-004 ${format} fold all, unfold all, fold level 2 and the symbol picker on 1000 slides: longest task per attempt ${attempts.join(', ')} ms (limit ${limit} ms for the typical attempt).`);
        assert.deepEqual(taskFailures({ attempts, limit }), [], `${format}: no main-thread task of ${limit} ms or more in the typical attempt (${attempts})`);
      } finally { await page.close(); }
    }
  }
  console.log('Source editor keyboard: phase 4 keymap cases pass.');
} finally { await suite.close(); }
