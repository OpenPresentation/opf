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
    // Every message the live region gets, in order (the region clears itself after 1.5 s).
    await page.addInitScript(() => {
      window.__live = [];
      new MutationObserver(() => {
        const text = document.querySelector('.opf-source-live')?.textContent?.replace(/\u200b/g, '') ?? '';
        if (text && window.__live.at(-1) !== text) window.__live.push(text);
      }).observe(document, { subtree: true, childList: true, characterData: true });
    });
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
      async put(doc, { format = 'json', notify = false } = {}) {
        const { text, from, to } = parseMarkers(doc);
        await page.evaluate(([nextFormat, value, start, end, tell]) => {
          if (demo.pane.getFormat() !== nextFormat) demo.pane.setFormat(nextFormat);
          // As a host opening a document does: an external update, which also reads the document's indentation.
          const control = demo.pane.editor;
          control.api.focus();
          control.update(value);
          // `notify`: the pane is told the text changed (a paste of the whole text), so it checks it and draws its problems.
          if (tell) control.api.replace(0, value.length, value);
          control.resetHistory();
          control.api.setSelection(start, end);
        }, [format, text, from, to, notify]);
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
          name: option.getAttribute('aria-label') ?? '',
        })) : [];
        return { open: Boolean(node) && !node.classList.contains('cm-tooltip-autocomplete-disabled'), items, selectedIndex: items.findIndex((item) => item.selected), selected: items.find((item) => item.selected)?.label };
      }),
      /** The problems panel: the count line and the rows. */
      findings: () => page.evaluate(() => (demo.pane.getText(), {
        hidden: document.querySelector('.opf-source-findings')?.hidden ?? true,
        count: document.querySelector('.opf-source-findings-count')?.textContent ?? '',
        rows: [...document.querySelectorAll('.opf-source-finding')].map((row) => {
          const where = /^Ln (\d+)(?:, Col (\d+))?/.exec(row.querySelector('.opf-source-finding-line')?.textContent ?? '');
          return {
            severity: row.dataset.severity,
            text: row.querySelector('.opf-source-finding-message')?.textContent ?? '',
            next: (row.querySelector('.opf-source-finding-next')?.textContent ?? '').replace(/^Next: /, ''),
            line: where ? Number(where[1]) : undefined,
            col: where?.[2] ? Number(where[2]) : undefined,
            rule: row.querySelector('.opf-source-finding-rule')?.textContent ?? '',
            path: row.querySelector('.opf-source-finding-path')?.textContent ?? '',
            fixes: [...(row.closest('li')?.querySelectorAll('.opf-source-finding-fix') ?? [])].map((button) => button.textContent),
          };
        }),
      })),
      /** The problems drawn in the text: severity, range and the text covered. */
      squiggles: () => page.evaluate(() => (demo.pane.getText(), demo.pane.getProblems().map((problem) => ({ severity: problem.severity, from: problem.from, to: problem.to, message: problem.message, next: problem.next, text: demo.pane.editor.api.getValue().slice(problem.from, problem.to), fixes: (problem.fixes ?? []).map((fix) => fix.title) })))),
      /** Everything the live region said so far. */
      live: () => page.evaluate(() => window.__live ?? []),
      /** The hover and lint tooltips on screen (not the completion list). */
      hover: () => page.evaluate(() => {
        const nodes = [...document.querySelectorAll('.cm-tooltip')].filter((node) => !node.classList.contains('cm-tooltip-autocomplete') && !node.classList.contains('cm-completionInfo') && node.getBoundingClientRect().width > 0);
        return { open: nodes.length > 0, text: nodes.map((node) => node.textContent).join(' | ') };
      }),
      /** The documentation panel beside the selected item: whether it shows, and its text. */
      docs: () => page.evaluate(() => {
        const node = document.querySelector('.cm-tooltip-autocomplete .cm-completionInfo, .cm-tooltip.cm-completionInfo');
        const shown = Boolean(node) && getComputedStyle(node).display !== 'none' && node.getBoundingClientRect().width > 0;
        return { shown, text: shown ? node.textContent : '' };
      }),
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
  if (kind === 'chord') {
    // A two-key chord (Cmd+K Cmd+I): the keys one after the other.
    for (const key of args) await kb.page.keyboard.press(keyFor(key));
    return kb.settle();
  }
  if (kind === 'hoverText') {
    // The pointer over the text of a token, long enough for the tooltip (300 ms by default) to show.
    const box = await kb.page.evaluate((needle) => {
      const { view, api } = demo.pane.editor, at = view.state.doc.toString().indexOf(needle);
      if (at < 0) throw new Error(`"${needle}" is not in the text`);
      const a = view.coordsAtPos(at + Math.min(1, needle.length)), b = view.coordsAtPos(at + needle.length - 1) ?? a;
      void api;
      return { x: (a.left + (b?.right ?? a.right)) / 2, y: (a.top + a.bottom) / 2 };
    }, args[0]);
    await kb.page.mouse.move(box.x - 30, box.y + 40);
    await kb.page.mouse.move(box.x, box.y, { steps: 4 });
    await kb.page.waitForFunction(() => [...document.querySelectorAll('.cm-tooltip')].some((node) => !node.classList.contains('cm-tooltip-autocomplete') && node.getBoundingClientRect().width > 0), null, { timeout: 2500 }).catch(() => {});
    return undefined;
  }
  if (kind === 'quickFix') {
    // Cmd/Ctrl+. at the caret, then the action by its title with the arrows and Enter. With no fix at the caret the author presses F8 first.
    await kb.press('Mod+.');
    if (!(await kb.page.locator('.opf-fixes').count())) { await kb.press('F8'); await kb.press('Mod+.'); }
    const titles = await kb.page.evaluate(() => [...document.querySelectorAll('.opf-fixes .opf-fix')].map((node) => node.textContent));
    const index = titles.indexOf(args[0]);
    assert.ok(index >= 0, `the quick fix "${args[0]}" is offered: ${JSON.stringify(titles)}`);
    for (let step = 0; step < index; step++) await kb.press('ArrowDown');
    return kb.press('Enter');
  }
  if (kind === 'hoverProblem') {
    // The pointer over the first character of the nth problem, long enough for its tooltip.
    const box = await kb.page.evaluate((index) => {
      const problem = demo.pane.getProblems()[index], view = demo.pane.editor.view;
      const at = demo.pane.editor.view.state.doc.toString().length >= 0 ? problem.from : 0;
      const a = view.coordsAtPos(Math.min(at + 0, view.state.doc.length)), b = view.coordsAtPos(Math.min(problem.to, view.state.doc.length)) ?? a;
      return { x: Math.max(a.left + 1, (a.left + b.right) / 2 - 2), y: (a.top + a.bottom) / 2 };
    }, args[0] ?? 0);
    await kb.page.mouse.move(box.x - 30, box.y + 40);
    await kb.page.mouse.move(box.x, box.y, { steps: 4 });
    await kb.page.waitForFunction(() => [...document.querySelectorAll('.cm-tooltip')].some((node) => !node.classList.contains('cm-tooltip-autocomplete') && node.getBoundingClientRect().width > 0), null, { timeout: 2500 }).catch(() => {});
    return undefined;
  }
  if (kind === 'placeCaret') {
    // The caret at the start of a needle (or its end when `end`), for problems that are not under the caret yet.
    await kb.page.evaluate(([needle, end]) => { const { api } = demo.pane.editor, at = api.getValue().indexOf(needle); if (at < 0) throw new Error(`"${needle}" is not in the source`); api.focus(); api.setSelection(at + (end ? needle.length : 0)); }, [args[0], args[1]]);
    return kb.settle();
  }
  if (kind === 'waitProblems') {
    // The pane checks the text 150 ms after the last key (syntax) and 250 ms in the harness (the rest): wait for the problems, not for a time.
    await kb.page.waitForFunction((count) => demo.pane.getProblems().length >= count, args[0] ?? 1, { timeout: 4000 });
    return kb.settle();
  }
  if (kind === 'waitNoProblems') {
    await kb.page.waitForFunction(() => (demo.pane.getText(), demo.pane.getProblems().length === 0), null, { timeout: 4000 });
    return kb.settle();
  }
  if (kind === 'readOnly') { await kb.page.evaluate((value) => demo.pane.setReadOnly(value), args[0]); return kb.settle(); }
  if (kind === 'pause') { await kb.page.waitForTimeout(args[0]); return undefined; }
  if (kind === 'expectRow') {
    const at = await kb.page.evaluate(() => [...document.querySelectorAll('.opf-source-finding')].indexOf(document.activeElement));
    assert.equal(at, args[0], 'the focused row of the panel');
    return undefined;
  }
  if (kind === 'clickRowFix') {
    await kb.page.locator('.opf-source-finding-fix', { hasText: args[0] }).first().click();
    return kb.settle();
  }
  if (kind === 'waitLive') {
    await kb.page.waitForFunction((pattern) => (window.__live ?? []).some((message) => new RegExp(pattern).test(message)), args[0], { timeout: 2500 }).catch(() => {});
    return undefined;
  }
  if (kind === 'waitLabels') {
    // The accessible names of the options are set a moment after the list shows.
    await kb.page.waitForFunction(() => [...document.querySelectorAll('.cm-tooltip-autocomplete [role="option"]')].every((option) => option.getAttribute('aria-label')), null, { timeout: 2000 });
    return undefined;
  }
  if (kind === 'snapshotPopup') { kb.popups ??= {}; kb.popups[args[0]] = (await kb.popup()).items.map((item) => item.label); return undefined; }
  if (kind === 'expectSamePopup') { assert.deepEqual((await kb.popup()).items.map((item) => item.label), kb.popups[args[0]], 'the same input gives the same list'); return undefined; }
  if (kind === 'expectDocs') {
    // The panel is positioned a frame after the selection changes.
    await kb.page.waitForFunction((want) => {
      const node = document.querySelector('.cm-tooltip-autocomplete .cm-completionInfo, .cm-tooltip.cm-completionInfo');
      const shown = Boolean(node) && getComputedStyle(node).display !== 'none' && node.getBoundingClientRect().width > 0;
      return shown === want;
    }, args[0], { timeout: 2000 }).catch(() => {});
    assert.equal((await kb.docs()).shown, args[0], `the documentation panel is ${args[0] ? 'shown' : 'hidden'}`);
    return undefined;
  }
  if (kind === 'openOptionsDialog') return kb.press('Alt+Shift+O');
  throw new Error(`unknown step ${kind}`);
}

const page_attrs = (page, selector, names) => page.evaluate(([css, list]) => { const node = document.querySelector(css); return Object.fromEntries(list.map((name) => [name, node?.getAttribute(name)])); }, [selector, names]);

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
    if (want.ariaNames) want.ariaNames.forEach((pattern, index) => assert.match(popup.items[index]?.name ?? '', pattern, `option ${index} accessible name`));
    if (want.count) assert.ok(popup.items.length >= want.count[0] && popup.items.length <= want.count[1], `popup count ${popup.items.length} in ${want.count}`);
  }
  if (expect.docs) {
    const docs = await kb.docs();
    if (expect.docs.shown !== undefined) assert.equal(docs.shown, expect.docs.shown, 'documentation panel shown');
    for (const item of [expect.docs.has ?? []].flat()) assert.ok(docs.text.includes(item), `the documentation has ${JSON.stringify(item)}: ${JSON.stringify(docs.text)}`);
  }
  if (expect.squiggles) {
    const squiggles = await kb.squiggles();
    if (Array.isArray(expect.squiggles)) {
      assert.equal(squiggles.length, expect.squiggles.length, `squiggles: ${JSON.stringify(squiggles)}`);
      expect.squiggles.forEach((want, index) => {
        const got = squiggles[index];
        if (want.text !== undefined) assert.equal(got.text, want.text, `squiggle ${index} covers ${JSON.stringify(got.text)}`);
        if (want.sev !== undefined) assert.equal(got.severity, want.sev, `squiggle ${index} severity`);
        if (want.has !== undefined) assert.ok(got.message.includes(want.has), `squiggle ${index} says ${JSON.stringify(got.message)}`);
      });
    }
  }
  if (expect.hover) {
    const hover = await kb.hover();
    if (expect.hover.open !== undefined) assert.equal(hover.open, Boolean(expect.hover.open), `hover open: ${hover.text}`);
    for (const item of [expect.hover.has ?? []].flat()) assert.ok(hover.text.includes(item), `the hover has ${JSON.stringify(item)}: ${JSON.stringify(hover.text)}`);
    for (const item of [expect.hover.not ?? []].flat()) assert.ok(!hover.text.includes(item), `the hover lacks ${JSON.stringify(item)}: ${JSON.stringify(hover.text)}`);
  }
  if (expect.live) {
    const said = await kb.live();
    assert.ok(said.some((message) => new RegExp(expect.live).test(message)), `the live region said ${expect.live}: ${JSON.stringify(said)}`);
  }
  if (expect.attrs) {
    for (const [selector, wanted] of Object.entries(expect.attrs)) {
      const got = await page_attrs(kb.page, selector, Object.keys(wanted));
      for (const [name, value] of Object.entries(wanted)) {
        if (value instanceof RegExp) assert.match(got[name] ?? '', value, `${selector} ${name}`);
        else assert.equal(got[name], value, `${selector} ${name}`);
      }
    }
  }
  if (expect.gutter) assert.ok(await kb.page.locator(expect.gutter).count() > 0, `the gutter has ${expect.gutter}`);
  if (expect.cursors !== undefined) assert.equal(await kb.cursors(), expect.cursors, 'cursors');
  if (expect.deck) {
    const deck = await kb.deck();
    for (const [at, value] of Object.entries(expect.deck)) assert.deepEqual(pointer(deck, at), value, `deck ${at}`);
  }
  if (expect.findings) {
    const findings = await kb.findings();
    if (expect.findings.hidden !== undefined) assert.equal(findings.hidden, expect.findings.hidden, `findings hidden (${findings.count})`);
    if (expect.findings.errors !== undefined) assert.equal(findings.rows.filter((row) => row.severity === 'error').length, expect.findings.errors, `errors: ${JSON.stringify(findings.rows)}`);
    if (expect.findings.n !== undefined) assert.equal(findings.rows.length, expect.findings.n, `findings: ${JSON.stringify(findings.rows)}`);
    for (const [index, want] of (expect.findings.rows ?? []).entries()) {
      const got = findings.rows[index];
      assert.ok(got, `finding ${index} exists: ${JSON.stringify(findings.rows)}`);
      for (const key of ['sev', 'severity']) if (want[key] !== undefined) assert.equal(got.severity, want[key], `finding ${index} severity`);
      for (const key of ['line', 'col']) if (want[key] !== undefined) assert.equal(got[key], want[key], `finding ${index} ${key}: ${JSON.stringify(got)}`);
      for (const key of ['text', 'next', 'rule', 'path']) if (want[key] !== undefined) assert.ok(got[key].includes(want[key]), `finding ${index} ${key} has ${JSON.stringify(want[key])}: ${JSON.stringify(got[key])}`);
      if (want.fixes) for (const title of want.fixes) assert.ok(got.fixes.includes(title), `finding ${index} offers "${title}": ${JSON.stringify(got.fixes)}`);
    }
    if (expect.findings.warnings !== undefined) assert.equal(findings.rows.filter((row) => row.severity === 'warning').length, expect.findings.warnings, `warnings: ${JSON.stringify(findings.rows)}`);
  }
  if (expect.dialog !== undefined) {
    const dialog = await kb.dialog();
    assert.equal(dialog.open, expect.dialog.open, 'dialog open');
    if (expect.dialog.focusInside !== undefined) assert.equal(dialog.focusInside, expect.dialog.focusInside, 'focus is inside the dialog');
  }
  if (expect.focus !== undefined) assert.equal(await kb.focus(), expect.focus, 'focus');
  if (expect.format !== undefined) assert.equal(await kb.page.evaluate(() => demo.pane.getFormat()), expect.format, 'format');
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
export async function runCases(suite, cases, { query = '', onFailure, cpuThrottle = 1, notify = false } = {}) {
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
      await kb.put(doc, { format, notify: options.notify ?? notify });
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
