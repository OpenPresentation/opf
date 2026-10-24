// Mobile and touch (320px and 390px, a coarse pointer), in Chromium and WebKit: the source pane's wrapped lines hang under their own indentation,
// every control has a 44px hit area, every field is 16px, nothing scrolls sideways, is cut off or covers another control, and the playground's
// top bar and bottom bar fit a phone ("Galleries" is whole, the document name has its own row, the zoom does not sit on the notes).
// The viewport is a fixed layout viewport (`isMobile: false`): an `isMobile` viewport widens itself to fit overflowing content, which would hide
// the sideways scroll this test looks for. Touch is on (`hasTouch`), so `(pointer: coarse)` holds; the test asserts it.
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
const widths = [320, 390];
const checks = [];
const problems = [];

// Popups and sheets (a menu, the find panel, the code under a list) lie over the page by design: a control of the page that one of them covers is
// not a finding, two controls of the popup covering each other is.
const POPUP = /opf-menu-item|opf-source-menu-item|opf-find|cm-content|cm-line/;
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

  // A wrapped line hangs under its own indentation in JSON, YAML and Markdown, and the editor never scrolls sideways.
  const hang = await open();
  const cases = [
    ['json', '{\n  "slides": [\n    {\n      "title": "A very long title that must wrap onto several lines at phone width, and then keep going for a good while longer than that"\n    }\n  ]\n}\n', '"title": "A very long', 6],
    ['yaml', 'slides:\n  - title: A very long title that must wrap onto several lines at phone width, and then keep going for a good while longer than that\n', '- title: A very long', 2],
    ['md', '# Deck\n\nA very long paragraph line that must wrap onto several lines at phone width, and then some, and then keep going for a good while longer.\n', 'A very long paragraph', 0],
  ];
  for (const [format, text, needle, indent] of cases) {
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
  checks.push(`${engine} ${width}px: wrapped lines hang 2 columns under their first glyph in JSON, YAML and Markdown; no sideways scroll`);
  await hang.close();

  // Controls, state by state.
  const states = [
    ['JSON', '', async () => {}],
    ['YAML (Canonicalize)', '?format=yaml', async () => {}],
    ['outline', '?outline=open', async () => {}],
    ['format menu', '', async (page) => { await page.getByRole('button', { name: 'Source format', exact: true }).click(); }],
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
  for (const [name, query, run] of states) {
    const page = await open(query);
    await run(page);
    await page.waitForTimeout(250);
    const report = await page.evaluate(touchAudit);
    assert.ok(report.controls >= 4, `${tag(name)}: found its controls (${report.controls})`);
    assertClean({ ...report, overlaps: report.overlaps.filter((entry) => !coveredByPopup(entry)) }, tag(name));
    if (name === 'rename') assert.ok(await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.opf-source-name-input')).fontSize) >= 16), `${tag(name)}: the name field is 16px`);
    await page.close();
  }
  checks.push(`${engine} ${width}px: the source pane's bar, menu, rename field, outline, problems, fix and detail buttons, completion list and search panel are all 44px, fields 16px, nothing overlaps`);
}

async function playground(browser, engine, width) {
  const context = await browser.newContext({ viewport: { width, height: 740 }, deviceScaleFactor: 2, hasTouch: true, isMobile: false });
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
  for (const [name, run] of states) {
    const page = await open();
    await run(page);
    await page.waitForTimeout(350);
    const report = await page.evaluate(touchAudit);
    assert.ok(report.controls >= 3, `${tag(name)}: found its controls (${report.controls})`);
    assertClean({ ...report, overlaps: report.overlaps.filter((entry) => !coveredByPopup(entry)) }, tag(name));
    await page.close();
  }
  checks.push(`${engine} ${width}px: 14 playground states (start, More, Edit, Design, Review, Source, Import, Copy, Properties, Outline, Layouts, Find, Add content, slide menu) have 44px controls, 16px fields, no sideways scroll, no cut-off or overlapping control`);

  // The top bar and the footer, by name.
  const page = await open();
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
  checks.push(`${engine} ${width}px: "Galleries" and "Layout…" are whole (full names in aria-label), the document name has its own 16px row, the zoom select is 16px, and it stays off the notes field`);
  await context.close();
}

try {
  for (const engine of engines) {
    let browser;
    try { browser = await launchers[engine](); } catch (error) {
      if (engine === 'webkit' && !process.env.CI && !process.env.OPF_WEBKIT_EXECUTABLE) { console.log(`Skipping WebKit: ${error.message.split('\n')[0]}`); continue; }
      throw error;
    }
    try {
      for (const width of widths) {
        const context = await browser.newContext({ viewport: { width, height: 740 }, deviceScaleFactor: 2, hasTouch: true, isMobile: false });
        await sourcePane(context, engine, width);
        await context.close();
        await playground(browser, engine, width);
      }
    } finally { await browser.close(); }
  }
  assert.deepEqual(problems, [], 'no page or console error');
  console.log(`Mobile and touch (${engines.join(', ')}; ${widths.join(' and ')}px): ${checks.length} groups.\n  ${checks.join('\n  ')}`);
} finally { server.close(); }
