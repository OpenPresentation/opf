// Mobile and touch (320px and 390px phones, an 820px tablet, a coarse pointer), in Chromium and WebKit: the source pane's wrapped lines hang under
// their own indentation, every control has a 44px hit area, every field is 16px, nothing scrolls sideways, is cut off or covers another control,
// and the playground's top bar and bottom bar fit a phone ("Galleries" is whole, the document name has its own row, the zoom does not sit on the
// notes). The layout editor (examples/layout-editor.html) is audited the same way, state by state: the zoom buttons, the validity button, the
// inspector's segments, checkbox and remove buttons, the menus. The tablet is `(pointer: coarse)` at a width past the phone layout: touch.css and
// the component styles key on the pointer, not the width, so a finger on a tablet gets the same 44px; the same page with a mouse keeps the
// compact sizes (checked at the end). A 1024px touch landscape screen (Chromium) audits the playground's start, where the
// slide toolbar's own controls (the view switch, Undo, Redo) show.
// The viewport is a fixed layout viewport (`isMobile: false`): an `isMobile` viewport widens itself to fit overflowing content, which would hide
// the sideways scroll this test looks for. Touch is on (`hasTouch`), so `(pointer: coarse)` holds; the test asserts it.
// CI runs the core states (every page load costs seconds, and the browser job has a time limit): Chromium at 320, 390 and 820px, WebKit at 320px,
// the four browser/width runs side by side. OPF_TOUCH_FULL=1 runs every state in both engines at every width (what the audit behind the PR used).
// OPF_TOUCH_ENGINES=chromium,webkit picks the engines (default both); OPF_WEBKIT_EXECUTABLE points at a WebKit build you already have.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';
import { touchAudit } from './support/touch-audit.mjs';

const root = fileURLToPath(new URL('../artifacts/playground/', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.ttf': 'font/ttf', '.wasm': 'application/wasm' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const target = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403).end(); return; }
    const body = await readFile(target);
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] ?? 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const launchers = {
  chromium: () => chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined }),
  webkit: () => webkit.launch({ executablePath: process.env.OPF_WEBKIT_EXECUTABLE || undefined }),
};
const engines = (process.env.OPF_TOUCH_ENGINES ?? 'chromium,webkit').split(',');
// A phone is narrower than the playground's phone layout needs (480px); the tablet is still in that layout (900px and narrower), but with the
// long labels and a tall screen.
const sizes = [{ width: 320, height: 740 }, { width: 390, height: 740 }, { width: 820, height: 1180 }];
const full = process.env.OPF_TOUCH_FULL === '1';
const sizesFor = (engine) => (full || engine === 'chromium' ? sizes : [sizes[0]]);
const isPhone = (width) => width <= 480;
const checks = [];
const problems = [];

// Popups and sheets (a menu, the find panel, the code under a list) lie over the page by design: a control of the page that one of them covers is
// not a finding, two controls of the popup covering each other is.
const POPUP = /opf-menu-item|opf-source-menu-item|opf-lx-menu|opf-find|cm-content|cm-line/;
const coveredByPopup = (entry) => entry.split(' x ').filter((part) => POPUP.test(part)).length === 1;

/** Fail with every finding of an audit, so one run shows all of them. */
function assertClean(report, where, { allowClipped = false } = {}) {
  const found = [];
  if (report.scrollWidth > report.width || report.bodyScrollWidth > report.width) found.push(`the page scrolls sideways (${report.scrollWidth} > ${report.width})`);
  for (const key of ['small', 'fonts', 'outside', 'overlaps']) for (const entry of report[key]) found.push(`${key}: ${entry}`);
  if (!allowClipped) for (const entry of report.clipped) found.push(`clipped: ${entry}`);
  assert.deepEqual(found, [], `${where}: ${found.length} problem(s)`);
}

/** The first glyph that is not white space in each visual row of a line, as { top, left } (document coordinates of the rows). */
const rowsOf = (page, needle) => page.evaluate((text) => {
  const line = [...document.querySelectorAll('.cm-line')].find((node) => node.textContent.includes(text));
  if (!line) throw new Error(`no line with "${text}"`);
  const rows = new Map();
  const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    for (let at = 0; at < node.data.length; at++) {
      if (/\s/.test(node.data[at])) continue;
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + 1);
      const box = range.getBoundingClientRect();
      const key = Math.round(box.top / 4);
      if (!rows.has(key) || box.left < rows.get(key).left) rows.set(key, { top: box.top, left: box.left });
    }
  }
  const { view } = demo.pane.editor;
  return { rows: [...rows.values()].sort((a, b) => a.top - b.top), ch: view.defaultCharacterWidth, scroller: [view.scrollDOM.scrollWidth, view.scrollDOM.clientWidth] };
}, needle);

async function sourcePane(context, engine, width) {
  const phone = isPhone(width);
  const open = async (query = '') => {
    const page = await context.newPage();
    page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
    page.on('console', (message) => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) problems.push(`console: ${message.text()}`); });
    await page.goto(`${origin}/source-pane.html${query}`);
    await page.locator('.opf-source-code .cm-content').waitFor();
    assert.equal(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), true, `${engine} ${width}px: the page sees a coarse pointer`);
    return page;
  };
  const tag = (name) => `${engine} ${width}px source pane, ${name}`;

  // A wrapped line hangs under its own indentation in JSON, YAML and Markdown, and the editor never scrolls sideways (the long line wraps onto
  // three rows only at a phone's width; the tablet runs the states below).
  const hang = await open();
  const cases = [
    ['json', '{\n  "slides": [\n    {\n      "title": "A very long title that must wrap onto several lines at phone width, and then keep going for a good while longer than that"\n    }\n  ]\n}\n', '"title": "A very long', 6],
    ['yaml', 'slides:\n  - title: A very long title that must wrap onto several lines at phone width, and then keep going for a good while longer than that\n', '- title: A very long', 2],
    ['md', '# Deck\n\nA very long paragraph line that must wrap onto several lines at phone width, and then some, and then keep going for a good while longer.\n', 'A very long paragraph', 0],
  ];
  for (const [format, text, needle, indent] of phone ? cases : []) {
    await hang.evaluate(([next, value]) => { if (demo.pane.getFormat() !== next) demo.pane.setFormat(next); demo.pane.editor.update(value); }, [format, text]);
    const { rows, ch, scroller } = await rowsOf(hang, needle);
    assert.ok(rows.length >= 3, `${tag(format)}: the long line wraps onto ${rows.length} rows`);
    const first = rows[0].left;
    for (const [index, row] of rows.slice(1).entries()) {
      // Two columns under the first glyph (one indent step), or the width of a list marker, which is also two.
      assert.ok(Math.abs(row.left - first - 2 * ch) <= 1.5, `${tag(format)}: continuation row ${index + 1} starts 2 columns in (${(row.left - first).toFixed(1)}px, a column is ${ch.toFixed(1)}px; the line is indented ${indent})`);
    }
    assert.ok(scroller[0] <= scroller[1] + 1, `${tag(format)}: the editor does not scroll sideways (${scroller})`);
    assert.ok(await hang.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${tag(format)}: the page does not scroll sideways`);
  }
  // The code keeps its readable size.
  assert.ok(await hang.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.cm-scroller')).fontSize) >= 13), `${tag('code')}: the code is at least 13px`);
  if (phone) checks.push(`${engine} ${width}px: wrapped lines hang 2 columns under their first glyph in JSON, YAML and Markdown; no sideways scroll`);
  await hang.close();

  // Controls, state by state.
  const states = [
    ['JSON', '', async () => {}],
    ['YAML (Canonicalize)', '?format=yaml', async () => {}],
    ['outline', '?outline=open', async () => {}],
    ['format menu', '', async (page) => { await page.getByRole('button', { name: /^Source format \.opf\./ }).click(); }],
    ['rename', '', async (page) => { await page.getByRole('button', { name: 'Rename deck' }).click(); }],
    ['problems with a fix and details', '?deck=broken', async (page) => {
      await page.locator('.opf-source-finding-fix').first().waitFor();
      const toggle = page.locator('.opf-source-findings-toggle');
      if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
      await page.locator('.opf-source-finding-details').first().click();
    }],
    ['completion list', '', async (page) => {
      await page.evaluate(() => { const at = demo.pane.getText().indexOf('"OWAA Rocks!"') + 13; demo.pane.editor.api.setSelection(at); demo.pane.editor.api.focus(); });
      await page.keyboard.type(', "lay');
      await page.locator('.cm-tooltip-autocomplete').waitFor();
    }],
    ['search panel', '', async (page) => {
      await page.evaluate(() => demo.pane.editor.api.focus());
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+f' : 'Control+f');
      await page.locator('.cm-search input').first().waitFor();
    }],
  ];
  const sourceCore = new Set(['JSON', 'YAML (Canonicalize)', 'format menu', 'problems with a fix and details', 'completion list', 'search panel']);
  for (const [name, query, run] of states) {
    if (!full && !(sourceCore.has(name) && (engine === 'chromium' || ['JSON', 'problems with a fix and details'].includes(name)))) continue;
    const page = await open(query);
    await run(page);
    await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== 'running'), undefined, { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(250);
    const report = await page.evaluate(touchAudit);
    assert.ok(report.controls >= 4, `${tag(name)}: found its controls (${report.controls})`);
    assertClean({ ...report, overlaps: report.overlaps.filter((entry) => !coveredByPopup(entry)) }, tag(name));
    if (name === 'rename') assert.ok(await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.opf-source-name-input')).fontSize) >= 16), `${tag(name)}: the name field is 16px`);
    await page.close();
  }
  checks.push(`${engine} ${width}px: the source pane's bar, menu, problems, fix and detail buttons, completion list and search panel (all states with OPF_TOUCH_FULL=1) are all 44px, fields 16px, nothing overlaps`);
}

async function playground(browser, engine, { width, height }) {
  const phone = isPhone(width);
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: true, isMobile: false });
  const tag = (name) => `${engine} ${width}px playground, ${name}`;
  const open = async () => {
    const page = await context.newPage();
    page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
    page.on('console', (message) => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) problems.push(`console: ${message.text()}`); });
    await page.goto(`${origin}/index.html`);
    await page.locator('#preview svg').waitFor({ timeout: 60000 });
    await page.waitForFunction(() => !/Loading fonts/.test(document.querySelector('#status').textContent), undefined, { timeout: 60000 });
    assert.equal(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), true, `${tag('page')}: a coarse pointer`);
    return page;
  };
  const sheet = (page, id) => async () => { await page.locator(`#${id}`).click(); await page.waitForFunction(() => getComputedStyle(document.querySelector('.inspector')).transform === 'none'); };
  const states = [
    ['the start', async () => {}],
    ['the More menu', async (page) => { await page.locator('#more-actions').click(); }],
    ['the Edit sheet (selection, text, notes)', async (page) => sheet(page, 'bar-edit')()],
    ['the Design sheet with every group open', async (page) => { await sheet(page, 'bar-edit')(); await page.locator('#bar-design').click(); await page.evaluate(() => document.querySelectorAll('.opf-dc-group').forEach((group) => { group.open = true; })); }],
    ['the Review sheet', async (page) => { await sheet(page, 'bar-edit')(); await page.locator('#tab-review').click(); }],
    ['the Source dialog', async (page) => { await page.locator('#more-actions').click(); await page.locator('#open-json').click(); }],
    ['the Import dialog, Gallery tab', async (page) => { await page.locator('#more-actions').click(); await page.locator('#add-opf').click(); await page.locator('#import-tab-gallery').click(); }],
    ['the Copy dialog', async (page) => { await page.locator('#more-actions').click(); await page.locator('#copy-opf').click(); }],
    ['the Properties dialog', async (page) => { await page.locator('#more-actions').click(); await page.locator('#open-properties').click(); }],
    ['the Outline view', async (page) => { await page.locator('#view-outline').click(); }],
    ['the Layouts view', async (page) => { await page.locator('#view-layouts').click(); }],
    ['the Find panel', async (page) => { await page.locator('#bar-find').click(); await page.locator('.opf-find').waitFor({ state: 'visible' }); }],
    ['the Add content panel', async (page) => { await page.locator('#insert-content').click(); }],
    ['the slide menu', async (page) => { await page.locator('button.slide-tool[data-action]').last().click(); }],
  ];
  const core = new Set(['the start', 'the Edit sheet (selection, text, notes)', 'the Design sheet with every group open', 'the More menu', 'the Import dialog, Gallery tab', 'the Layouts view', 'the Find panel']);
  for (const [name, run] of states) {
    if (!full && !(core.has(name) && (engine === 'chromium' || ['the start', 'the Edit sheet (selection, text, notes)', 'the Design sheet with every group open', 'the Layouts view'].includes(name)))) continue;
    const page = await open();
    await run(page);
    // A sheet or a menu may still be sliding (a slow machine starts the transition late): measure when nothing moves.
    await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== 'running'), undefined, { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(350);
    const report = await page.evaluate(touchAudit);
    assert.ok(report.controls >= 3, `${tag(name)}: found its controls (${report.controls})`);
    const sheetState = await page.evaluate(() => { const node = document.querySelector('.inspector'); const style = getComputedStyle(node); return { sheet: document.body.dataset.sheet ?? null, visibility: style.visibility, transform: style.transform, top: Math.round(node.getBoundingClientRect().top), animations: document.getAnimations().length }; });
    assertClean({ ...report, overlaps: report.overlaps.filter((entry) => !coveredByPopup(entry)) }, `${tag(name)} ${JSON.stringify(sheetState)}`);
    await page.close();
  }
  checks.push(`${engine} ${width}px: the playground states (${full ? 'start, More, Edit, Design, Review, Source, Import, Copy, Properties, Outline, Layouts, Find, Add content, slide menu' : 'start, Edit, Design, and on Chromium More, Import, Layouts, Find'}) have 44px controls, 16px fields, no sideways scroll, no cut-off or overlapping control`);

  // The top bar and the footer, by name (a phone's layout: the tablet has the long labels and wider rows).
  const page = await open();
  if (phone) {
    const bar = await page.evaluate(() => {
      const box = (selector) => { const node = document.querySelector(selector); const b = node.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width, height: b.height, text: node.textContent.trim().replace(/\s+/g, ' ') }; };
      const name = document.querySelector('#document-name');
      return {
        gallery: { ...box('#browse-gallery'), visible: (() => { const s = document.querySelector('#browse-gallery .label-short'); return getComputedStyle(s).display !== 'none'; })(), aria: document.querySelector('#browse-gallery').getAttribute('aria-label') },
        layout: { ...box('#add-layout'), aria: document.querySelector('#add-layout').getAttribute('aria-label') },
        add: box('#add'),
        name: { width: name.getBoundingClientRect().width, clientWidth: name.clientWidth, scrollWidth: name.scrollWidth, font: parseFloat(getComputedStyle(name).fontSize), value: name.value },
        more: box('#more-actions'),
        zoom: { font: parseFloat(getComputedStyle(document.querySelector('#zoom')).fontSize), height: document.querySelector('#zoom').getBoundingClientRect().height },
        brand: (() => { const s = document.querySelector('.workspace-brand strong'); return { clipped: s.scrollWidth > s.clientWidth + 1, text: s.textContent }; })(),
        viewport: document.documentElement.clientWidth,
      };
    });
    assert.equal(bar.gallery.visible, true, `${tag('top bar')}: the short label shows`);
    assert.equal(bar.gallery.aria, 'Browse galleries', `${tag('top bar')}: the full name stays in aria-label`);
    assert.equal(bar.layout.aria, 'Add with layout…');
    assert.ok(bar.gallery.text.includes('Galleries') && bar.layout.text.includes('Layout…'), `${tag('top bar')}: short labels (${bar.add.text} | ${bar.layout.text} | ${bar.gallery.text})`);
    assert.ok(bar.gallery.right <= bar.viewport && bar.gallery.left >= 0, `${tag('top bar')}: "Galleries" is whole on screen (${bar.gallery.left}..${bar.gallery.right})`);
    assert.ok(bar.add.right <= bar.layout.left && bar.layout.right <= bar.gallery.left, `${tag('top bar')}: the three slide buttons sit side by side`);
    assert.equal(bar.name.scrollWidth <= bar.name.clientWidth, true, `${tag('document name')}: "${bar.name.value}" is not cut off (${bar.name.scrollWidth} > ${bar.name.clientWidth})`);
    assert.ok(bar.name.width >= bar.viewport - 40 && bar.name.font >= 16, `${tag('document name')}: has the whole row at 16px (${bar.name.width}px)`);
    assert.ok(bar.more.top > bar.name.width * 0 && bar.more.height >= 44, `${tag('More')}: is a 44px button`);
    assert.ok(bar.zoom.font >= 16 && bar.zoom.height >= 44, `${tag('zoom')}: the zoom select is 16px and 44px tall`);
    assert.equal(bar.brand.clipped, false, `${tag('brand')}: "${bar.brand.text}" is whole`);
  }
  // Zoom and notes: with the Edit sheet open the footer, which holds the zoom, is out of the way of the notes field.
  await sheet(page, 'bar-edit')();
  const notes = await page.evaluate(() => {
    const zoom = document.querySelector('#zoom'), field = document.querySelector('#notes');
    field.scrollIntoView({ block: 'center' });
    const z = zoom.getBoundingClientRect(), n = field.getBoundingClientRect();
    const overlap = Math.min(z.right, n.right) - Math.max(z.left, n.left) > 0 && Math.min(z.bottom, n.bottom) - Math.max(z.top, n.top) > 0;
    return { overlap, zoomHidden: getComputedStyle(zoom).visibility === 'hidden' || getComputedStyle(zoom.closest('.canvas-footer')).visibility === 'hidden', font: parseFloat(getComputedStyle(field).fontSize), height: n.height };
  });
  assert.ok(!notes.overlap || notes.zoomHidden, `${tag('notes')}: the zoom select does not sit on the notes field`);
  assert.ok(notes.font >= 16 && notes.height >= 44, `${tag('notes')}: the notes field is 16px (${notes.font})`);
  await page.close();
  checks.push(`${engine} ${width}px: ${phone ? '"Galleries" and "Layout…" are whole (full names in aria-label), the document name has its own 16px row, the zoom select is 16px, and ' : ''}the zoom select stays off the notes field, which is 16px`);
  await context.close();
}

/** The layout editor (examples/layout-editor.html), state by state: the controls of its palette, canvas, layers and inspector. */
async function layoutEditor(browser, engine, { width, height }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: true, isMobile: false });
  const tag = (name) => `${engine} ${width}px layout editor, ${name}`;
  const open = async (query) => {
    const page = await context.newPage();
    page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
    page.on('console', (message) => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) problems.push(`console: ${message.text()}`); });
    await page.goto(`${origin}/layout-editor.html${query}`);
    await page.locator('.opf-lx-node').first().waitFor();
    assert.equal(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), true, `${tag('page')}: a coarse pointer`);
    return page;
  };
  // In a narrow editor the layers are a tab beside the inspector; in a wide one both panels are on screen.
  const showLayers = async (page) => { const tab = page.getByRole('tab', { name: 'Layers' }); if (await tab.count()) await tab.click(); };
  const select = (...paths) => (page) => page.evaluate((list) => { demo.model.select([list[0]]); for (const path of list.slice(1)) demo.model.selectAdd(path); }, paths);
  const states = [
    // The zoom buttons, the validity button, the Row and Column segments, the remove button of a design hint: the controls that sized themselves.
    ['the start (zoom, validity, segments, hint)', '?layout=hero', async () => {}],
    ['a nested region (name, size, chips, flow, bleed checkbox)', '?layout=hero', select([1, 0])],
    ['a layout with findings (the validity button asks to show them)', '?layout=broken', select([0])],
    ['the context menu', '?layout=hero', async (page) => { await select([0])(page); await page.locator('.opf-lx-node[data-path="0"]').click({ button: 'right', force: true }); await page.locator('.opf-lx-menu').waitFor(); }],
    ['the heading tool menu', '?layout=hero', async (page) => { await page.getByRole('toolbar', { name: 'Layout tools' }).getByRole('button', { name: 'Heading regions' }).click(); await page.locator('.opf-lx-menu').waitFor(); }],
    ['renaming a region in the layers', '?layout=hero', async (page) => { await showLayers(page); await page.evaluate(() => { demo.model.select([[0]]); demo.model.requestRename([0], 'layers'); }); await page.locator('input.opf-lx-rename-row').waitFor(); }],
    ['renaming a region on the canvas', '?layout=hero', async (page) => { await page.evaluate(() => { demo.model.select([[0]]); demo.model.requestRename([0], 'canvas'); }); await page.locator('.opf-lx-rename').waitFor(); }],
    ['two regions selected', '?layout=hero', select([1, 0], [1, 1])],
    ['the Layers panel', '?layout=hero', showLayers],
    ['touch density', '?layout=hero&density=touch', select([1, 0])],
    // The harness's four parts around one model have a fixed 300px column for the inspector: no phone layout to audit.
    ...(width >= 390 ? [['the parts arranged separately', '?layout=hero&parts=1', select([1, 0])]] : []),
  ];
  const core = new Set([states[0][0], states[1][0], states[2][0]]);
  for (const [name, query, run] of states) {
    if (!full && !(core.has(name) && (engine === 'chromium' || name !== states[1][0]))) continue;
    const page = await open(query);
    await run(page);
    await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== 'running'), undefined, { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(250);
    const report = await page.evaluate(touchAudit);
    assert.ok(report.controls >= 15, `${tag(name)}: found its controls (${report.controls})`);
    assertClean({ ...report, overlaps: report.overlaps.filter((entry) => !coveredByPopup(entry)) }, tag(name));
    if (name === states[0][0]) {
      // By name, so a failure says which one: the controls that used to be 28px under the touch size by a few pixels.
      const measured = await page.evaluate(() => Object.fromEntries([['zoom', '.opf-lx-zoom-button'], ['validity', '.opf-lx-validity'], ['segment', '.opf-lx-segment'], ['hint remove', '.opf-lx-hint-remove'], ['undo/redo', '.opf-lx-top-button']].map(([key, selector]) => {
        const boxes = [...document.querySelectorAll(selector)].map((node) => node.getBoundingClientRect());
        return [key, { count: boxes.length, width: Math.min(...boxes.map((box) => box.width)), height: Math.min(...boxes.map((box) => box.height)) }];
      })));
      for (const [key, size] of Object.entries(measured)) {
        assert.ok(size.count >= 1, `${tag(key)}: is on the page`);
        assert.ok(size.height >= 43.5 && (key === 'validity' || size.width >= 43.5), `${tag(key)}: is 44px (${size.width}x${size.height})`);
      }
    }
    await page.close();
  }
  checks.push(`${engine} ${width}px: the layout editor's ${full ? 'start, regions, findings, menus, rename, selection, Layers, touch density and parts' : 'start, nested region and findings states'} have 44px controls (zoom, validity, segments, remove, checkbox), 16px fields, no sideways scroll, no cut-off or overlapping control`);
  await context.close();
}

/** A mouse keeps the compact sizes: the layout editor's zoom buttons, validity button and segments under a fine pointer. */
async function fineLayoutEditor(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  await page.goto(`${origin}/layout-editor.html?layout=hero`);
  await page.locator('.opf-lx-node').first().waitFor();
  assert.equal(await page.evaluate(() => matchMedia('(pointer: fine)').matches), true, 'fine pointer: the page sees a fine pointer');
  const heights = await page.evaluate(() => Object.fromEntries([['zoom', '.opf-lx-zoom-button'], ['validity', '.opf-lx-validity'], ['segment', '.opf-lx-segment']].map(([key, selector]) => { const box = document.querySelector(selector).getBoundingClientRect(); return [key, [Math.round(box.width), Math.round(box.height)]]; })));
  assert.deepEqual([heights.zoom[1], heights.validity[1], heights.segment[1]], [28, 26, 30], `fine pointer: the compact sizes stay (${JSON.stringify(heights)})`);
  assert.equal(heights.zoom[0], 28, 'fine pointer: the zoom buttons stay square');
  checks.push('chromium, mouse: the layout editor keeps its compact sizes (zoom 28px, validity 26px, segments 30px)');
  await context.close();
}

/** A touch laptop-width screen (an iPad in landscape, 1024px): past the playground's phone layout (900px), where the slide toolbar's own controls show. */
async function landscapeTablet(browser) {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2, hasTouch: true, isMobile: false });
  const tag = (name) => `chromium 1024px playground, ${name}`;
  const page = await context.newPage();
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) problems.push(`console: ${message.text()}`); });
  await page.goto(`${origin}/index.html`);
  await page.locator('#preview svg').waitFor({ timeout: 60000 });
  await page.waitForFunction(() => !/Loading fonts/.test(document.querySelector('#status').textContent), undefined, { timeout: 60000 });
  assert.equal(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), true, `${tag('page')}: a coarse pointer`);
  await page.waitForTimeout(350);
  const report = await page.evaluate(touchAudit);
  assert.ok(report.controls >= 20, `${tag('start')}: found its controls (${report.controls})`);
  // The slide thumbnails are a scroller by design.
  assertClean({ ...report, clipped: report.clipped.filter((entry) => !/opf-thumbs/.test(entry)) }, tag('start'));
  const heights = await page.evaluate(() => ['view-slide', 'view-sorter', 'view-outline', 'view-layouts', 'undo', 'redo'].map((id) => [id, document.getElementById(id).getBoundingClientRect().height]));
  for (const [id, height] of heights) assert.ok(height >= 43.5, `${tag(id)}: is 44px tall (${height})`);
  checks.push('chromium 1024px: the playground at a touch landscape width (the view switch, Undo and Redo and the rest of the start) has 44px controls, 16px fields, no sideways scroll, no cut-off or overlapping control');
  await context.close();
}

try {
  const browsers = new Map();
  for (const engine of engines) {
    try { browsers.set(engine, await launchers[engine]()); } catch (error) {
      if (engine === 'webkit' && !process.env.CI && !process.env.OPF_WEBKIT_EXECUTABLE) { console.log(`Skipping WebKit: ${error.message.split('\n')[0]}`); continue; }
      throw error;
    }
  }
  try {
    // One run per engine and size, side by side: a run only waits for its own page loads, and its three parts (the source pane, the playground
    // and the layout editor) load in separate contexts at once.
    await Promise.all([
      ...[...browsers].flatMap(([engine, browser]) => sizesFor(engine).map(async (size) => {
        const sourceRun = (async () => {
          const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 2, hasTouch: true, isMobile: false });
          await sourcePane(context, engine, size.width);
          await context.close();
        })();
        await Promise.all([sourceRun, playground(browser, engine, size), layoutEditor(browser, engine, size)]);
      })),
      ...(browsers.has('chromium') ? [fineLayoutEditor(browsers.get('chromium')), landscapeTablet(browsers.get('chromium'))] : []),
    ]);
  } finally { for (const browser of browsers.values()) await browser.close(); }
  assert.deepEqual(problems, [], 'no page or console error');
  console.log(`Mobile and touch (${[...browsers.keys()].join(', ')}; ${full ? 'full' : 'core states'}): ${checks.length} groups.\n  ${checks.sort().join('\n  ')}`);
} finally { server.close(); }
