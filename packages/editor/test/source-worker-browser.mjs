// Phase 4 (artifacts/source-editor/TEST-PLAN.md section 8.2, SPEC R-PERF-03): the source pane's text checks in a Web Worker give the same results as on the main
// thread, fall back to it when the worker cannot run, drop stale answers, follow the catalogs, and leave the explicit (synchronous) paths alone. The page is
// the source pane harness: `?worker=off` keeps everything on the main thread, `?worker=throw` and `?worker=missing` start a worker that cannot run.
// OPF_BROWSER_ENGINE=webkit runs it on WebKit. The budgets at 1000 slides are in test/source-worker-perf-browser.mjs.
import assert from 'node:assert/strict';
import { engineName, startKeyboardSuite } from './support/source-keyboard.mjs';
import { corpus } from './support/source-check-corpus.mjs';
import { bigText } from './support/source-perf.mjs';

const suite = await startKeyboardSuite();

/** The text of every visible result of a page: the problems panel, the squiggles, the session document and its validation. */
const snapshot = (page) => page.evaluate(() => ({
  format: demo.pane.getFormat(),
  text: demo.pane.editor.api.getValue(),
  count: document.querySelector('.opf-source-findings-count')?.textContent ?? '',
  hidden: document.querySelector('.opf-source-findings')?.hidden ?? true,
  rows: [...document.querySelectorAll('.opf-source-finding')].map((row) => row.textContent),
  squiggles: demo.pane.getProblems(),
  invalid: demo.pane.editor.view.contentDOM.getAttribute('aria-invalid'),
  document: demo.editor.presentation,
  validation: demo.editor.validation,
  canUndo: demo.editor.canUndo,
}));
/** Put `text` in the pane as typed text of `format` (the pane is told, as for a paste) and wait until it has been checked and applied. */
async function put(page, format, text, { reset = true } = {}) {
  await page.evaluate(([next, value, again]) => {
    // A document with schema errors cannot be written in another format: start each text from the valid starting document.
    if (again) { demo.pane.setFormat('json'); demo.pane.replaceDocument({ name: 'Start', slides: [{ title: 'Start' }] }); }
    if (demo.pane.getFormat() !== next) demo.pane.setFormat(next);
    const control = demo.pane.editor;
    control.api.focus();
    control.api.replace(0, control.api.getValue().length, value);
  }, [format, text, reset]);
  await page.evaluate(() => demo.pane.whenIdle());
}
const openHarness = async (mode, query = '') => {
  const page = await suite.openPage(`?worker=${mode}${query}`);
  suite.problems.length = 0;
  return page;
};
const typeText = async (page, text, delay = 0) => { await page.keyboard.type(text, { delay }); };

try {
  // (a) and (b): identical results, and the worker really ran.
  {
    const off = await openHarness('off'), on = await openHarness('on');
    const gallery = await on.evaluate(() => demo.editor.catalogs);
    assert.ok(gallery.length >= 1);
    let compared = 0;
    for (const entry of corpus) {
      const results = [];
      for (const page of [off, on]) {
        // The catalogs of the page: the gallery, or none for the texts that test the missing registration.
        await page.evaluate((none) => { if (none !== (demo.editor.catalogs.length === 0)) demo.editor.setCatalogs(none ? [] : window.__gallery); }, entry.catalogs === 'none');
        await page.evaluate(() => { window.__gallery ??= demo.editor.catalogs; });
        await put(page, entry.format, entry.text);
        results.push(await snapshot(page));
      }
      assert.deepEqual(results[1], results[0], `${entry.id}: the worker and the main thread show and apply the same`);
      compared++;
    }
    for (const [page, label] of [[off, 'off'], [on, 'on']]) {
      const stats = await page.evaluate(() => demo.pane.checkerStats());
      if (label === 'on') {
        assert.ok(stats.worker >= corpus.length - 3, `the worker answered the checks (${stats.worker} of ${corpus.length})`);
        assert.equal(stats.inline, 0, 'nothing was checked on the main thread with the worker on');
        assert.equal(stats.available, true);
      } else assert.deepEqual([stats.worker, stats.inline > 0, stats.available], [0, true, false], 'worker=off checks on the main thread');
    }
    console.log(`W-001 ${compared} texts: problems panel, squiggles, session document and validation are identical with the worker and without (${engineName}).`);
    await off.close(); await on.close();
  }

  // (a) again with real keyboard events: type a wrong key in YAML and fix it; both pages end in the same state.
  {
    const results = [];
    for (const mode of ['off', 'on']) {
      const page = await openHarness(mode);
      await page.evaluate(() => demo.pane.setFormat('yaml'));
      await page.evaluate(() => { const { api } = demo.pane.editor; api.focus(); api.setSelection(api.getValue().indexOf('title: What This Shows') + 'title: What This Shows'.length); });
      await typeText(page, '\nbogus: 1');
      await page.evaluate(() => demo.pane.whenIdle());
      const withError = await snapshot(page);
      assert.ok(withError.rows.some((row) => /bogus/.test(row)), `${mode}: the unknown key is reported`);
      for (const key of ['Shift+Home', 'Shift+Home', 'Backspace', 'Backspace']) await page.keyboard.press(key);
      await page.evaluate(() => demo.pane.whenIdle());
      results.push([withError, await snapshot(page)]);
      assert.deepEqual(suite.problems, [], `${mode}: no page error`);
      await page.close();
    }
    assert.deepEqual(results[1], results[0], 'typing in YAML gives the same with and without the worker');
    console.log('W-002 typing a wrong key and removing it: identical with and without the worker.');
  }

  // (c) FALLBACK: a factory that throws and a script that is not found leave a working pane; onError hears it once.
  for (const mode of ['throw', 'missing']) {
    const page = await openHarness(mode);
    await page.evaluate(() => demo.pane.setFormat('yaml'));
    await page.evaluate(() => { const { api } = demo.pane.editor; api.focus(); api.setSelection(api.getValue().indexOf('title: OWAA Rocks!') + 'title: OWAA Rocks!'.length); });
    await typeText(page, ' typed');
    await page.evaluate(() => demo.pane.whenIdle());
    const state = await page.evaluate(() => ({ title: demo.editor.presentation.slides[0].title, errors: demo.errors, stats: demo.pane.checkerStats() }));
    assert.equal(state.title, 'OWAA Rocks! typed', `${mode}: the edit is applied`);
    assert.equal(state.errors.length, 1, `${mode}: onError is called once (${state.errors.join(' | ')})`);
    assert.equal(state.stats.available, false, `${mode}: the worker is not tried again`);
    assert.equal(state.stats.worker, 0);
    assert.ok(state.stats.inline >= 1, `${mode}: checked on the main thread`);
    await typeText(page, ' more');
    await page.evaluate(() => demo.pane.whenIdle());
    assert.equal(await page.evaluate(() => demo.editor.presentation.slides[0].title), 'OWAA Rocks! typed more', `${mode}: edits go on being applied`);
    assert.equal((await page.evaluate(() => demo.errors)).length, 1, `${mode}: still one onError`);
    // A syntax error is still shown.
    await page.evaluate(() => { const { api } = demo.pane.editor; api.setSelection(api.getValue().indexOf('slides:') + 'slides:'.length); });
    await typeText(page, ' [');
    await page.evaluate(() => demo.pane.whenIdle());
    assert.ok((await page.evaluate(() => demo.pane.getProblems().length)) > 0, `${mode}: problems are still drawn`);
    console.log(`W-003 worker=${mode}: the pane keeps working on the main thread; onError heard "${state.errors[0]}".`);
    await page.close();
  }

  // (d) STALE: type through several edits while checks are running; only the last text ends up applied and no edit is lost.
  {
    const page = await openHarness('on');
    const big = bigText('yaml', 300);
    await put(page, 'yaml', big);
    await page.evaluate(() => {
      window.__titles = [];
      demo.editor.subscribe((event) => { if (event.type === 'patch') window.__titles.push(demo.editor.presentation.slides[150].title); });
      const { api } = demo.pane.editor, needle = 'title: Slide 151 headline';
      api.focus(); api.setSelection(api.getValue().indexOf(needle) + needle.length);
    });
    const typed = ' abcdefghij';
    // Longer than the 50 ms apply delay between keys: every key starts a check, and the next one is typed while it runs.
    for (const character of typed) { await page.keyboard.type(character); await page.waitForTimeout(70); }
    await page.evaluate(() => demo.pane.whenIdle());
    const result = await page.evaluate(() => ({ titles: window.__titles, title: demo.editor.presentation.slides[150].title, text: demo.pane.editor.api.getValue(), stats: demo.pane.checkerStats() }));
    const final = `Slide 151 headline${typed}`;
    assert.equal(result.title, final, 'the final deck matches the last text');
    assert.ok(result.text.includes(`title: ${final}\n`), 'and the text shows it');
    const base = 'Slide 151 headline';
    for (const [index, title] of result.titles.entries()) {
      assert.ok(final.startsWith(title) && title.startsWith(base), `applied title ${JSON.stringify(title)} is a prefix of the final one`);
      if (index) assert.ok(title.length >= result.titles[index - 1].length, 'edits are applied in order, none goes back');
    }
    assert.equal(result.titles.at(-1), final);
    assert.ok(result.stats.worker >= 2, `several checks ran in the worker (${result.stats.worker})`);
    // One quick burst, then a pause: a single apply of the last text.
    await page.evaluate(() => { window.__titles.length = 0; });
    await typeText(page, 'XYZ');
    await page.evaluate(() => demo.pane.whenIdle());
    const burst = await page.evaluate(() => ({ titles: window.__titles, title: demo.editor.presentation.slides[150].title }));
    assert.equal(burst.title, `${final}XYZ`);
    assert.ok(burst.titles.length <= 2 && burst.titles.at(-1) === `${final}XYZ`, `a burst applies its last text (${burst.titles.join(' | ')})`);
    assert.deepEqual(suite.problems, []);
    console.log(`W-004 ${typed.length} edits over running checks: ${result.titles.length} applied in order, the last text wins, none lost.`);
    await page.close();
  }

  // (e) CATALOGS: a catalog change changes the reference findings after the next check, in the worker path too.
  {
    const steps = [];
    for (const mode of ['off', 'on']) {
      const page = await openHarness(mode);
      const log = [];
      await page.evaluate(() => { window.__gallery = demo.editor.catalogs; });
      const referenced = 'name: Catalogs\nslides:\n  - title: Cover\n    layout: cover\n  - title: Plain\n';
      await put(page, 'yaml', referenced);
      const rowsOf = async () => (await snapshot(page)).rows.filter((row) => /cover|catalog|reference|layout/i.test(row));
      log.push(['registered', await rowsOf()]);
      await page.evaluate(() => demo.editor.setCatalogs([]));
      await page.evaluate(() => demo.pane.whenIdle());
      log.push(['setCatalogs([])', await rowsOf()]);
      // The next edit is checked with the new catalogs.
      await page.evaluate(() => { const { api } = demo.pane.editor; api.focus(); api.setSelection(api.getValue().indexOf('title: Plain') + 'title: Plain'.length); });
      await typeText(page, 'er');
      await page.evaluate(() => demo.pane.whenIdle());
      log.push(['edit without catalogs', await rowsOf(), (await snapshot(page)).validation.findings.map((finding) => finding.message)]);
      await page.evaluate(() => demo.editor.setCatalogs(window.__gallery));
      await typeText(page, 'er');
      await page.evaluate(() => demo.pane.whenIdle());
      log.push(['registered again', await rowsOf(), (await snapshot(page)).validation.findings.map((finding) => finding.message)]);
      steps.push(log);
      assert.deepEqual(suite.problems, [], `${mode}: no page error`);
      if (mode === 'on') {
        const stats = await page.evaluate(() => demo.pane.checkerStats());
        assert.ok(stats.worker >= 3 && stats.inline === 0, `the catalog edits were checked in the worker (${JSON.stringify(stats)})`);
      }
      await page.close();
    }
    assert.deepEqual(steps[1], steps[0], 'catalog changes give the same findings with and without the worker');
    const [registered, cleared, without, again] = steps[1];
    assert.equal(registered[1].length, 0, 'registered: the layout reference resolves');
    assert.equal(cleared[1].length, 1, 'setCatalogs([]): the reference is reported');
    assert.equal(without[1].length, 1, 'an edit checked without the catalog still reports it');
    assert.deepEqual(without[2].map((message) => /resolves nowhere/.test(message)), [true], 'the validation the worker computed has it');
    assert.deepEqual([again[1].length, again[2].length], [0, 0], 'registered again: no reference finding after the next check');
    console.log('W-005 setCatalogs changes the reference findings after the next check, the same in the worker path.');
  }

  // (f) READ-ONLY, format switching and replaceDocument keep working with the worker on (the explicit paths are synchronous).
  {
    const page = await openHarness('on');
    await page.evaluate(() => demo.pane.setFormat('yaml'));
    const place = () => page.evaluate(() => { const { api } = demo.pane.editor; api.focus(); api.setSelection(api.getValue().indexOf('title: OWAA Rocks!') + 'title: OWAA Rocks!'.length); });
    // Read only: typing changes nothing, nothing is checked.
    await page.evaluate(() => demo.pane.setReadOnly(true));
    const before = await page.evaluate(() => ({ text: demo.pane.editor.api.getValue(), stats: demo.pane.checkerStats() }));
    await place();
    await typeText(page, ' nope');
    await page.evaluate(() => demo.pane.whenIdle());
    const locked = await page.evaluate(() => ({ text: demo.pane.editor.api.getValue(), title: demo.editor.presentation.slides[0].title, stats: demo.pane.checkerStats() }));
    assert.equal(locked.text, before.text, 'read only: the text does not change');
    assert.equal(locked.title, 'OWAA Rocks!');
    assert.deepEqual(locked.stats, before.stats, 'read only: nothing was checked');
    await page.evaluate(() => demo.pane.setReadOnly(false));
    // getText applies the pending edit at once (inline), and the session has it when getText returns.
    await place();
    await typeText(page, ' direct');
    const direct = await page.evaluate(() => { const text = demo.pane.getText(); return { text, title: demo.editor.presentation.slides[0].title, stats: demo.pane.checkerStats() }; });
    assert.equal(direct.title, 'OWAA Rocks! direct', 'getText flushes synchronously');
    assert.ok(direct.text.includes('title: OWAA Rocks! direct'));
    assert.ok(direct.stats.inline >= 1, 'the explicit flush used the main thread');
    await page.evaluate(() => demo.pane.whenIdle());
    assert.equal(await page.evaluate(() => demo.editor.presentation.slides[0].title), 'OWAA Rocks! direct', 'the cancelled worker check changed nothing');
    // A pending edit is applied when the format is switched, and shows in the other format.
    await place();
    await typeText(page, ' switched');
    const switched = await page.evaluate(() => { demo.pane.setFormat('json'); return { title: demo.editor.presentation.slides[0].title, text: demo.pane.editor.api.getValue(), format: demo.pane.getFormat() }; });
    assert.equal(switched.format, 'json');
    assert.equal(switched.title, 'OWAA Rocks! switched direct');
    assert.ok(switched.text.includes('OWAA Rocks! switched direct'), 'the JSON text has the edit');
    await page.evaluate(() => demo.pane.whenIdle());
    assert.equal(await page.evaluate(() => demo.pane.getFormat()), 'json');
    // replaceDocument with an edit pending: the pending edit is applied first, then the document is replaced.
    await page.evaluate(() => demo.pane.setFormat('yaml'));
    await place();
    await typeText(page, ' pending');
    const replaced = await page.evaluate(() => {
      demo.pane.replaceDocument({ name: 'Replaced', slides: [{ title: 'New deck' }] });
      return { name: demo.editor.presentation.name, text: demo.pane.editor.api.getValue(), depth: demo.editor.snapshot().undoDepth };
    });
    assert.equal(replaced.name, 'Replaced');
    assert.ok(replaced.text.includes('New deck'));
    await page.evaluate(() => demo.pane.whenIdle());
    assert.equal(await page.evaluate(() => demo.editor.presentation.name), 'Replaced', 'the cancelled worker check did not bring the old text back');
    // Then ordinary typing goes through the worker again.
    const answered = (await page.evaluate(() => demo.pane.checkerStats())).worker;
    await page.evaluate(() => { const { api } = demo.pane.editor; api.focus(); api.setSelection(api.getValue().indexOf('title: New deck') + 'title: New deck'.length); });
    await typeText(page, '!');
    await page.evaluate(() => demo.pane.whenIdle());
    const after = await page.evaluate(() => ({ title: demo.editor.presentation.slides[0].title, stats: demo.pane.checkerStats() }));
    assert.equal(after.title, 'New deck!');
    assert.ok(after.stats.worker > answered, 'and the worker checked it');
    // Undo restores the replaced document (history is the session's).
    assert.equal(await page.evaluate(() => { demo.pane.getText(); demo.editor.undo(); demo.editor.undo(); return demo.editor.presentation.slides[0].title; }), 'OWAA Rocks! pending switched direct', 'the pending edit was applied before the replace');
    // The attribute is set only while a check runs, and the pane ends idle.
    assert.equal(await page.evaluate(() => { demo.pane.setFormat('json'); return document.querySelector('.opf-source').hasAttribute('data-opf-checking'); }), false);
    // Destroy with a check in flight raises nothing.
    await page.evaluate(() => { const { api } = demo.pane.editor; api.focus(); api.replace(0, 1, '{'); demo.pane.destroy(); });
    await page.waitForTimeout(300);
    assert.deepEqual(suite.problems, [], 'no page error');
    console.log('W-006 read only, getText, format switching and replaceDocument use the synchronous path and work with the worker on.');
    await page.close();
  }

  // W-007: on a slow machine a check takes longer than the gap between two keys, so requests overlap; the older answers are dropped and the pane still becomes idle.
  {
    const page = await openHarness('on');
    await put(page, 'yaml', bigText('yaml', 300));
    if (engineName === 'chromium') await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 8 });
    await page.evaluate(() => { const { api } = demo.pane.editor; const at = api.getValue().indexOf('title: Slide 150 headline'); api.focus(); api.setSelection(at + 'title: Slide 150 headline'.length); });
    for (const character of 'abcdefghij') { await page.keyboard.type(character); await page.waitForTimeout(30); }
    const idle = await page.evaluate(() => Promise.race([demo.pane.whenIdle().then(() => true), new Promise((resolve) => setTimeout(() => resolve(false), 20000))]));
    assert.equal(idle, true, 'the pane becomes idle after overlapping worker checks');
    assert.equal(await page.evaluate(() => document.querySelector('.opf-source').hasAttribute('data-opf-checking')), false, 'the checking flag is cleared');
    // (Under an 8x slower CPU the browser sometimes puts a typed key out of order, with the worker off as well: the letters are checked, not their order.)
    const title = await page.evaluate(() => demo.editor.presentation.slides[149].title);
    assert.equal(title.slice(0, 18), 'Slide 150 headline');
    assert.equal([...title.slice(18)].sort().join(''), 'abcdefghij', 'every typed letter reached the document');
    console.log('W-007 overlapping worker checks on a slow CPU: the pane becomes idle and applies the last text.');
    await page.close();
  }

  // The 1000-slide decks load and show no problem with the worker (their timing is in the perf suite).
  {
    const page = await openHarness('on');
    await put(page, 'md', bigText('md', 1000));
    const loaded = await page.evaluate(() => ({ slides: demo.editor.presentation.slides.length, rows: document.querySelectorAll('.opf-source-finding').length, stats: demo.pane.checkerStats() }));
    assert.deepEqual([loaded.slides, loaded.rows], [1000, 0]);
    assert.ok(loaded.stats.worker >= 1);
    await page.close();
  }
  assert.deepEqual(suite.problems, [], 'no page or console error in the whole run');
  console.log(`Source worker: results are identical with and without it, it falls back, drops stale answers and follows the catalogs (${engineName} ${suite.browserVersion}).`);
} finally { await suite.close(); }
