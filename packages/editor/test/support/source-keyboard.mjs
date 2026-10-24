// The keyboard driver for the source editor suites (artifacts/source-editor/TEST-PLAN.md, section 2). A case is one array row:
//   [id, requirement, title, format, doc, steps, expect, options?]
// `doc` is the starting text with `|` for the caret and `⟦...⟧` for a selection; `steps` are real keyboard events (Playwright
// `keyboard.press` and `keyboard.type`), never edits made through the editor's API; `expect` lists what must hold afterwards.
// The page is the source pane harness (artifacts/playground/source-pane.html). There are no sleeps: a step ends when the editor
// says it is idle (`data-opf-busy` on `.cm-editor` is set while a completion query is pending). The only waits are the ones a
// case asks for by name, where elapsed time is the point of the test.
//
// OPF_BROWSER_ENGINE=chromium|webkit|firefox picks the browser (default chromium; OPF_BROWSER_EXECUTABLE points at a browser build you already have); OPF_KEYBOARD_PLATFORM=darwin|win32|linux picks the
// keymap the page sees (default: this machine), so one runner covers all three key maps on any machine.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';

const root = fileURLToPath(new URL('../../artifacts/playground/', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const engines = { chromium, webkit, firefox };

export const engineName = process.env.OPF_BROWSER_ENGINE ?? 'chromium';
export const platform = process.env.OPF_KEYBOARD_PLATFORM ?? process.platform;
export const mod = platform === 'darwin' ? 'Meta' : 'Control';

// ---- case helpers ---------------------------------------------------------------------------------------------------------------
export const T = (text) => ['type', text];
export const K = (key) => ['press', key];
export const P = (text) => ['paste', text];
export const M = (key) => ['press', `Mod+${key}`];
export const MS = (key) => ['press', `Mod+Shift+${key}`];
/** Type `text`, then press `key` `ms` after the last character (the accept race). */
export const FAST = (text, key, ms) => ['fast', text, key, ms];
export const WAIT = (ms, why) => ['wait', ms, why];

// ---- markers --------------------------------------------------------------------------------------------------------------------
/** `{ text, from, to }` for a doc with `|` (a caret) or `⟦...⟧` (a selection). */
export function parseMarkers(doc) {
  const selection = /⟦([\s\S]*?)⟧/.exec(doc);
  if (selection) {
    const text = doc.replace('⟦', '').replace('⟧', '');
    const from = selection.index;
    return { text, from, to: from + selection[1].length };
  }
  const at = doc.indexOf('|');
  if (at < 0) return { text: doc, from: doc.length, to: doc.length };
  return { text: doc.slice(0, at) + doc.slice(at + 1), from: at, to: at };
}

const keyFor = (key) => key.replace(/^Mod\+/, `${mod}+`).replace(/\+Mod\+/, `+${mod}+`);

// ---- the page -------------------------------------------------------------------------------------------------------------------
export async function startKeyboardSuite({ viewport = { width: 1200, height: 800 } } = {}) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const target = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
      const relative = path.relative(root, target);
      if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403).end(); return; }
      res.writeHead(200, { 'Content-Type': types[path.extname(target)] ?? 'application/octet-stream' }).end(await readFile(target));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await engines[engineName].launch({ channel: engineName === 'chromium' && process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined, executablePath: process.env.OPF_BROWSER_EXECUTABLE || undefined });
  const context = await browser.newContext({ viewport, acceptDownloads: true });
  if (engineName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  await context.addInitScript((value) => {
    Object.defineProperty(navigator, 'platform', { get: () => ({ darwin: 'MacIntel', win32: 'Win32', linux: 'Linux x86_64' })[value] ?? value });
  }, platform);
  const problems = [];

  async function openPage(query = '') {
    const page = await context.newPage();
    page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
    page.on('console', (message) => { if (message.type() === 'error') problems.push(`console: ${message.text()}`); });
    await page.goto(`${origin}/source-pane.html${query}`);
    await page.locator('.opf-source-code .cm-content').waitFor();
    return page;
  }

  /** The driver for one page. */
  function driver(page) {
    const kb = {
      page,
      /** Replace the text (and the format) with `doc` and put the caret or selection where the markers say. */
      async put(doc, { format = 'json' } = {}) {
        const { text, from, to } = parseMarkers(doc);
        await page.evaluate(([nextFormat, value, start, end]) => {
          if (demo.pane.getFormat() !== nextFormat) demo.pane.setFormat(nextFormat);
          // As a host opening a document does: an external update, which also reads the document's indentation.
          const control = demo.pane.editor;
          control.api.focus();
          control.update(value);
          control.resetHistory();
          control.api.setSelection(start, end);
        }, [format, text, from, to]);
        await kb.settle();
      },
      async press(key) { await page.keyboard.press(keyFor(key)); await kb.settle(); },
      async type(text, { delay = 0 } = {}) { await page.keyboard.type(text, { delay }); await kb.settle(); },
      /** Dispatch a paste event with `text` on the editor, as the browser does for Cmd/Ctrl+V. */
      async paste(text) {
        await page.locator('.opf-source-code .cm-content').evaluate((node, value) => {
          const clipboardData = new DataTransfer();
          clipboardData.setData('text/plain', value);
          node.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
        }, text);
        await kb.settle();
      },
      async settle() {
        await page.waitForFunction(() => !document.querySelector('.opf-source-code .cm-editor')?.dataset.opfBusy);
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      },
      /** The editor text with `|` at a caret and `⟦...⟧` around a selection. */
      text: () => page.evaluate(() => {
        const { state } = demo.pane.editor.view, doc = state.doc.toString();
        let out = '', position = 0;
        for (const range of state.selection.ranges) {
          out += doc.slice(position, range.from) + (range.empty ? '|' : `⟦${doc.slice(range.from, range.to)}⟧`);
          position = range.to;
        }
        return out + doc.slice(position);
      }),
      /** The editor text without markers. */
      plain: () => page.evaluate(() => demo.pane.editor.view.state.doc.toString()),
      source: () => page.evaluate(() => demo.pane.getText()),
      /** The session document, once the pane has applied the pending edit. */
      deck: () => page.evaluate(() => { demo.pane.getText(); return demo.editor.presentation; }),
      cursors: () => page.evaluate(() => demo.pane.editor.view.state.selection.ranges.length),
      popup: () => page.evaluate(() => {
        const node = document.querySelector('.cm-tooltip-autocomplete');
        const items = node ? [...node.querySelectorAll('[role="option"]')].map((option) => ({
          label: option.querySelector('.cm-completionLabel')?.textContent ?? '',
          detail: option.querySelector('.cm-completionDetail')?.textContent ?? '',
          selected: option.getAttribute('aria-selected') === 'true',
        })) : [];
        return { open: Boolean(node) && !node.classList.contains('cm-tooltip-autocomplete-disabled'), items, selectedIndex: items.findIndex((item) => item.selected), selected: items.find((item) => item.selected)?.label };
      }),
      /** The problems panel: the count line and the rows. */
      findings: () => page.evaluate(() => (demo.pane.getText(), {
        hidden: document.querySelector('.opf-source-findings')?.hidden ?? true,
        count: document.querySelector('.opf-source-findings-count')?.textContent ?? '',
        rows: [...document.querySelectorAll('.opf-source-finding')].map((row) => ({ severity: row.dataset.severity, text: row.querySelector('.opf-source-finding-message')?.textContent ?? '', line: row.querySelector('.opf-source-finding-line')?.textContent ?? '' })),
      })),
      dialog: () => page.evaluate(() => {
        const node = document.querySelector('.json-field-menu');
        return { open: Boolean(node), focusInside: Boolean(node?.contains(document.activeElement)) };
      }),
      status: () => page.evaluate(() => document.querySelector('.opf-source-status')?.textContent ?? ''),
      focus: () => page.evaluate(() => {
        const active = document.activeElement;
        if (!active) return 'none';
        if (active.closest('.cm-editor')) return 'editor';
        if (active.closest('.json-field-menu')) return 'dialog';
        return `${active.tagName.toLowerCase()}${active.className ? `.${String(active.className).split(' ')[0]}` : ''}`;
      }),
      undoDepth: () => page.evaluate(() => demo.pane.editor.undoDepth()),
    };
    return kb;
  }

  return {
    origin, problems, openPage, driver,
    browserVersion: browser.version(),
    async close() { await browser.close(); server.close(); },
  };
}

// ---- running cases --------------------------------------------------------------------------------------------------------------
const pointer = (deck, at) => at.split('/').slice(1).reduce((value, part) => value?.[part.replaceAll('~1', '/').replaceAll('~0', '~')], deck);
const contains = (haystack, needle) => (Array.isArray(needle) ? needle : [needle]).every((item) => haystack.includes(item));

async function runStep(kb, step) {
  const [kind, ...args] = step;
  if (kind === 'type') return kb.type(args[0]);
  if (kind === 'press') return kb.press(args[0]);
  if (kind === 'paste') return kb.paste(args[0]);
  if (kind === 'wait') return kb.page.waitForTimeout(args[0]);
  if (kind === 'fast') {
    const [text, key, ms] = args;
    await kb.page.keyboard.type(text);
    if (ms > 0) await kb.page.waitForTimeout(ms);
    await kb.page.keyboard.press(keyFor(key));
    return kb.settle();
  }
  if (kind === 'caret') {
    // Put the caret at an offset from a needle (source offsets), keeping the focus in the editor.
    const [needle, offset = 0, end] = args;
    await kb.page.evaluate(([value, shift, last]) => { const { api } = demo.pane.editor, at = api.getValue().indexOf(value); if (at < 0) throw new Error(`"${value}" is not in the source`); api.focus(); api.setSelection(at + shift, last === undefined ? at + shift : at + last); }, [needle, offset, end]);
    return kb.settle();
  }
  if (kind === 'addCursors') {
    // Several carets at once, at the ends of the given needles (the first match of each).
    await kb.page.evaluate((needles) => {
      const { view, api } = demo.pane.editor, source = api.getValue(), Selection = view.state.selection.constructor;
      const ranges = needles.map((value) => { const at = source.indexOf(value); if (at < 0) throw new Error(`"${value}" is not in the source`); return Selection.cursor(at + value.length); });
      api.focus();
      view.dispatch({ selection: Selection.create(ranges, 0) });
    }, args[0]);
    return kb.settle();
  }
  if (kind === 'waitPopup') {
    // A list that opens by itself after a step (a key chains into the list of its values): wait for it to show, not for a time.
    await kb.page.waitForSelector('.cm-tooltip-autocomplete [role="option"]');
    return kb.settle();
  }
  if (kind === 'realPaste') {
    // The OS clipboard and the browser's own paste command (Chromium; the page is allowed to read and write it).
    await kb.page.evaluate((value) => navigator.clipboard.writeText(value), args[0]);
    return kb.press('Mod+v');
  }
  if (kind === 'clickItem') {
    await kb.page.locator('.cm-tooltip-autocomplete [role="option"]', { hasText: args[0] }).first().click();
    return kb.settle();
  }
  if (kind === 'clickText') {
    // A real mouse click on the text of a token.
    await kb.page.locator('.opf-source-code .cm-content').getByText(args[0], { exact: false }).first().click();
    return kb.settle();
  }
  if (kind === 'altClickText') {
    await kb.page.locator('.opf-source-code .cm-content').getByText(args[0], { exact: false }).first().click({ modifiers: ['Alt'] });
    return kb.settle();
  }
  if (kind === 'clickFormat') {
    await kb.page.getByRole('button', { name: 'Format (fix indentation)' }).click();
    return kb.settle();
  }
  if (kind === 'snapshot') { kb.snapshots ??= {}; kb.snapshots[args[0]] = await kb.source(); return undefined; }
  if (kind === 'expectSame') { assert.equal(await kb.source(), kb.snapshots[args[0]], 'the second run changed the text again (not idempotent)'); return undefined; }
  if (kind === 'openOptionsDialog') return kb.press('Alt+Shift+O');
  throw new Error(`unknown step ${kind}`);
}

async function check(kb, expect) {
  const text = await kb.text();
  if (expect.text !== undefined) assert.equal(text, expect.text, 'text');
  const plain = await kb.plain();
  for (const item of [expect.has ?? []].flat()) assert.ok(plain.includes(item), `the text has ${JSON.stringify(item)}: ${JSON.stringify(plain)}`);
  for (const item of [expect.not ?? []].flat()) assert.ok(!plain.includes(item), `the text lacks ${JSON.stringify(item)}: ${JSON.stringify(plain)}`);
  if (expect.popup) {
    const popup = await kb.popup(), want = expect.popup, labels = popup.items.map((item) => item.label);
    if (want.open !== undefined) assert.equal(popup.open, Boolean(want.open), `popup open (items: ${labels.slice(0, 8)})`);
    if (want.has) assert.ok(contains(labels, want.has), `popup has ${want.has}: ${labels}`);
    if (want.not) for (const item of want.not) assert.ok(!labels.includes(item), `popup lacks ${item}: ${labels}`);
    if (want.first !== undefined) assert.equal(labels[0], want.first, `popup first: ${labels}`);
    if (want.selected !== undefined) assert.equal(popup.selected, want.selected, 'popup selected');
    if (want.selectedIndex !== undefined) assert.equal(popup.selectedIndex, want.selectedIndex, 'popup selected index');
    if (want.selectedIsLast) assert.equal(popup.selectedIndex, popup.items.length - 1, 'the selection wrapped to the last item');
    if (want.count) assert.ok(popup.items.length >= want.count[0] && popup.items.length <= want.count[1], `popup count ${popup.items.length} in ${want.count}`);
  }
  if (expect.cursors !== undefined) assert.equal(await kb.cursors(), expect.cursors, 'cursors');
  if (expect.deck) {
    const deck = await kb.deck();
    for (const [at, value] of Object.entries(expect.deck)) assert.deepEqual(pointer(deck, at), value, `deck ${at}`);
  }
  if (expect.findings) {
    const findings = await kb.findings();
    if (expect.findings.hidden !== undefined) assert.equal(findings.hidden, expect.findings.hidden, `findings hidden (${findings.count})`);
    if (expect.findings.errors !== undefined) assert.equal(findings.rows.filter((row) => row.severity === 'error').length, expect.findings.errors, `errors: ${JSON.stringify(findings.rows)}`);
    if (expect.findings.warnings !== undefined) assert.equal(findings.rows.filter((row) => row.severity === 'warning').length, expect.findings.warnings, `warnings: ${JSON.stringify(findings.rows)}`);
  }
  if (expect.dialog !== undefined) {
    const dialog = await kb.dialog();
    assert.equal(dialog.open, expect.dialog.open, 'dialog open');
    if (expect.dialog.focusInside !== undefined) assert.equal(dialog.focusInside, expect.dialog.focusInside, 'focus is inside the dialog');
  }
  if (expect.focus !== undefined) assert.equal(await kb.focus(), expect.focus, 'focus');
  if (expect.status !== undefined) assert.match(await kb.status(), expect.status, 'status');
  if (expect.acceptedIsSelected) assert.ok(kb.selectedBefore && plain.includes(kb.selectedBefore), `the text has the item that was selected (${kb.selectedBefore}): ${plain}`);
  if (expect.undo) {
    const [times, want] = expect.undo;
    for (let step = 0; step < times; step++) await kb.press('Mod+z');
    assert.equal(await kb.text(), want, `after ${times} undo`);
  }
}

/**
 * Run `cases` on `suite` (a `startKeyboardSuite()` result). Each case gets a fresh page. Returns `{ passed, failed }`; a failure is the
 * case id and its message, so the whole table is reported, not just the first row.
 */
export async function runCases(suite, cases, { query = '', onFailure, cpuThrottle = 1 } = {}) {
  const failed = [];
  let passed = 0;
  for (const [id, requirement, title, format, doc, steps, expect, options = {}] of cases) {
    if (options.plat && options.plat !== platform && !(options.plat === '!darwin' && platform !== 'darwin')) continue;
    if (options.engines && !options.engines.includes(engineName)) continue;
    // `native`: the key reaches the browser's own clipboard command, which only the machine's own modifier triggers.
    if (options.native && platform !== process.platform) continue;
    const page = await suite.openPage(query);
    // Chromium only: slow the CPU down so a race that "usually" works shows up.
    if (cpuThrottle > 1 && engineName === 'chromium') await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle });
    const kb = suite.driver(page);
    suite.problems.length = 0;
    try {
      await kb.put(doc, { format });
      for (const step of steps) {
        if (['press', 'fast'].includes(step[0]) && expect.acceptedIsSelected) kb.selectedBefore = (await kb.popup()).selected;
        await runStep(kb, step);
      }
      await check(kb, expect);
      if (!options.allowError) assert.deepEqual(suite.problems, [], 'no page error or console error');
      passed++;
    } catch (error) {
      const detail = `${id} (${requirement}) ${title}: ${error.message.split('\n').slice(0, 6).join(' | ')}`;
      failed.push(detail);
      onFailure?.(detail);
      // With OPF_KEYBOARD_ARTIFACTS set, a failing case leaves its screenshot there.
      if (process.env.OPF_KEYBOARD_ARTIFACTS) await page.screenshot({ path: path.join(process.env.OPF_KEYBOARD_ARTIFACTS, `${id}.png`) }).catch(() => {});
    } finally { await page.close(); }
  }
  return { passed, failed };
}
