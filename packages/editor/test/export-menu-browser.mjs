// RR-98: the Export menu (src/export-menu.js) in a real browser, on a small host page with the real module and CSS. Covers the structure and
// ARIA of the trigger, menu and groups; keyboard and focus; PowerPoint through an injected exporter (progress, warnings, failure); Cancel;
// the disabled state; the three OPF source formats read back with core; `items`; the agent handoff entry; the mobile bottom sheet; destroy.
// The real PDF, PNG and SVG conversions run in the playground suite (test/export-menu-playground-browser.mjs), which has the fonts.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fromMarkdown } from '@openpresentation/opf/markdown';
import { fromYaml } from '@openpresentation/opf/yaml';
import { startFixture, deck } from './support/export-fixture.mjs';

const checks = [];
const mark = (name) => checks.push(name);
const app = await startFixture();
const { page, errors } = app;
try {
  const trigger = page.getByRole('button', { name: 'Export', exact: true });
  const menu = page.getByRole('menu', { name: 'Export formats' });
  const item = (name) => page.getByRole('menuitem', { name });
  const active = () => page.evaluate(() => document.activeElement?.textContent?.trim() ?? document.activeElement?.tagName);
  const activeName = () => page.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.trim().replace(/\s+/g, ' '));
  const live = () => page.locator('.opf-export-live').innerText();
  const status = () => page.locator('.opf-export-status');
  const download = async (action) => {
    const event = page.waitForEvent('download');
    await action();
    const file = await event;
    assert.equal(await file.failure(), null);
    return { name: file.suggestedFilename(), bytes: await readFile(await file.path()) };
  };
  const PPTX = [80, 75, 3, 4, 20, 0, 0, 0]; // the start of any ZIP-based file: enough to tell a real download from an empty one
  const mountWithPptx = (extra = '{}') => page.evaluate((extraSource) => {
    const extra = new Function(`return (${extraSource})`)();
    window.log = { downloads: [], statuses: [], exports: [], pptxCalls: 0, signals: [] };
    window.menu?.destroy();
    window.menu = window.mountMenu({
      exportPptx: async (document, { signal, onProgress }) => {
        window.log.pptxCalls++;
        window.log.signals.push(signal);
        onProgress({ stage: 'convert', done: 1, total: 3, message: 'Slide 1 of 3' });
        return new Uint8Array([80, 75, 3, 4, 20, 0, 0, 0, ...Array(2000).fill(7)]);
      },
      onStatus: (s) => window.log.statuses.push(s),
      onExport: (e) => window.log.exports.push({ fileName: e.fileName, format: e.format, notes: e.notes }),
      ...extra,
    });
  }, extra);

  // ---- structure and ARIA -------------------------------------------------------------------------------------------------------------
  await mountWithPptx();
  assert.equal(await trigger.getAttribute('aria-haspopup'), 'menu');
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(await trigger.locator('svg').count(), 2, 'the trigger shows the Download and ChevronDown icons');
  assert.equal(await trigger.locator('svg[aria-hidden="true"]').count(), 2, 'both icons are decorative');
  assert.equal(await menu.isHidden(), true, 'the menu is closed until the trigger is used');
  await trigger.click();
  assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(await menu.isVisible(), true);
  assert.deepEqual(await page.getByRole('group').evaluateAll((nodes) => nodes.filter((n) => n.closest('[role=menu]')).map((n) => n.getAttribute('data-group'))), ['slides', 'source', 'agent']);
  assert.equal(await page.getByRole('group', { name: 'Slides' }).count(), 1, 'each group is named by its visible label');
  assert.equal(await page.getByRole('group', { name: 'OPF source' }).count(), 1);
  assert.equal(await page.getByRole('group', { name: 'For an agent' }).count(), 1);
  const labels = await page.getByRole('menuitem').evaluateAll((nodes) => nodes.map((n) => [n.querySelector('.opf-export-item-label').textContent, n.querySelector('.opf-export-item-meta').textContent]));
  assert.deepEqual(labels, [['PowerPoint (.pptx)', 'editable'], ['PDF', 'all slides'], ['SVG slides', 'ZIP'], ['PNG images', 'ZIP'], ['JSON', '.opf.json'], ['YAML', '.opf.yaml'], ['Markdown', '.opf.md'], ['Agent handoff', '.md']]);
  assert.equal(await page.getByRole('menuitem').evaluateAll((nodes) => nodes.every((n) => n.tagName === 'BUTTON' && n.querySelector('svg[aria-hidden="true"]'))), true, 'menu items are real buttons with a decorative icon');
  const styles = await page.evaluate(() => {
    const label = getComputedStyle(document.querySelector('.opf-export-group-label')), meta = getComputedStyle(document.querySelector('.opf-export-item-meta'));
    return { transform: label.textTransform, tracking: label.letterSpacing, mono: label.fontFamily, size: label.fontSize, metaMono: meta.fontFamily, metaSize: meta.fontSize };
  });
  assert.equal(styles.transform, 'uppercase', 'group labels are uppercased by CSS, not in the text');
  assert.equal(styles.size, '10.5px');
  assert.match(styles.mono, /Geist Mono|ui-monospace|Menlo|monospace/);
  assert.equal(styles.metaSize, '11px');
  await page.keyboard.press('Escape');
  mark('structure and ARIA');

  // ---- keyboard and focus ---------------------------------------------------------------------------------------------------------
  await page.locator('#before').focus();
  await page.keyboard.press('Tab');
  assert.equal(await activeName(), 'Export', 'the trigger is in the tab order');
  await page.keyboard.press('ArrowDown');
  assert.equal(await menu.isVisible(), true, 'ArrowDown opens the menu');
  assert.match(await activeName(), /^PowerPoint \(\.pptx\)/, 'the first item takes focus');
  await page.keyboard.press('ArrowDown');
  assert.match(await activeName(), /^PDF/);
  await page.keyboard.press('End');
  assert.match(await activeName(), /^Agent handoff/);
  await page.keyboard.press('ArrowDown');
  assert.match(await activeName(), /^PowerPoint/, 'ArrowDown wraps to the first item');
  await page.keyboard.press('ArrowUp');
  assert.match(await activeName(), /^Agent handoff/, 'ArrowUp wraps to the last item');
  await page.keyboard.press('Home');
  assert.match(await activeName(), /^PowerPoint/);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('.opf-export-item')].every((n) => n.tabIndex === -1)), true, 'items are reached with arrows, not Tab');
  const ring = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return [s.outlineStyle, s.outlineWidth, s.outlineOffset]; });
  assert.deepEqual(ring, ['solid', '2px', '2px'], 'the focused item shows the 2px focus ring at a 2px offset');
  await page.keyboard.press('Escape');
  assert.equal(await menu.isHidden(), true, 'Escape closes the menu');
  assert.equal(await activeName(), 'Export', 'and returns focus to the trigger');
  await page.keyboard.press('Enter');
  assert.equal(await menu.isVisible(), true, 'Enter opens it');
  await page.keyboard.press('Tab');
  assert.equal(await menu.isHidden(), true, 'Tab closes the menu');
  assert.equal(await activeName(), 'After', 'and moves on to the next control');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('ArrowUp');
  assert.match(await activeName(), /^Agent handoff/, 'ArrowUp on the trigger opens on the last item');
  await page.keyboard.press('Escape');
  await trigger.click();
  await page.locator('#before').click({ force: true });
  assert.equal(await menu.isHidden(), true, 'a press outside closes the menu');
  await trigger.click();
  await trigger.click();
  assert.equal(await menu.isHidden(), true, 'the trigger toggles');
  // Enter on an item exports; Space does too.
  await trigger.focus();
  await page.keyboard.press('Enter');
  const viaKeyboard = await download(() => page.keyboard.press('Enter'));
  assert.equal(viaKeyboard.name, 'Fixture-deck.pptx');
  assert.equal(await activeName(), 'Export', 'focus is back on the trigger after an export starts');
  mark('keyboard and focus');

  // ---- PowerPoint through the injected exporter ---------------------------------------------------------------------------------------
  assert.deepEqual([...viaKeyboard.bytes.subarray(0, 8)], PPTX);
  assert.equal(viaKeyboard.bytes.length, 2008);
  await page.waitForFunction(() => window.log.statuses.some((s) => s.state === 'success'));
  const success = await page.evaluate(() => window.log.statuses.at(-1));
  assert.match(success.message, /^Fixture-deck\.pptx · 2 slides · 2 KB$/, `a success line in the "·" style: ${success.message}`);
  assert.equal(await status().isVisible(), true, 'the result is shown under the trigger');
  assert.match(await status().innerText(), /Fixture-deck\.pptx/);
  await page.waitForFunction(() => /Fixture-deck\.pptx/.test(document.querySelector('.opf-export-live').textContent));
  assert.match(await live(), /Fixture-deck\.pptx · 2 slides/, 'the result is announced through aria-live');
  assert.equal(await page.locator('.opf-export-live').getAttribute('aria-live'), 'polite');
  assert.equal(await page.locator('.opf-export-live').getAttribute('role'), 'status');
  assert.equal(await page.evaluate(() => window.log.pptxCalls), 1);
  assert.ok((await page.evaluate(() => window.log.statuses)).some((s) => s.state === 'busy' && s.message === 'Slide 1 of 3'), 'exportPptx progress reaches the status line');
  assert.deepEqual(await page.evaluate(() => window.log.exports), [{ fileName: 'Fixture-deck.pptx', format: 'pptx', notes: [] }]);
  await status().getByRole('button', { name: 'Dismiss export status' }).click();
  assert.equal(await status().isHidden(), true);
  mark('powerpoint via exportPptx');

  // exportPptx receives a snapshot, not the live document.
  await page.evaluate(() => { window.mountMenu({ exportPptx: async (d) => { window.seen = d; window.deck.name = 'Changed meanwhile'; return new Uint8Array([1, 2, 3]); } }); });
  await download(async () => { await trigger.click(); await item(/^PowerPoint/).click(); });
  assert.equal(await page.evaluate(() => window.seen.name), 'Fixture deck', 'the export is of the committed snapshot');
  await page.evaluate(() => { window.deck.name = 'Fixture deck'; });

  // Warnings from the exporter are listed; the line says how many.
  await mountWithPptx(`{ exportPptx: async () => ({ bytes: new Uint8Array([1,2,3,4]), warnings: [{ path: 'slides.0.blocks.1', message: 'A chart was drawn as a picture.' }, 'Plain sentence note.'] }) }`);
  await download(async () => { await trigger.click(); await item(/^PowerPoint/).click(); });
  await page.waitForFunction(() => document.querySelector('.opf-export-notes li'));
  assert.match(await status().innerText(), /2 notes to review/);
  assert.deepEqual(await status().locator('.opf-export-notes li').allInnerTexts(), ['slides.0.blocks.1: A chart was drawn as a picture.', 'Plain sentence note.']);
  assert.deepEqual((await page.evaluate(() => window.log.exports.at(-1))).notes, ['slides.0.blocks.1: A chart was drawn as a picture.', 'Plain sentence note.']);
  await page.waitForTimeout(4400);
  assert.equal(await status().isVisible(), true, 'a result with notes stays until it is dismissed');
  await status().getByRole('button', { name: 'Dismiss export status' }).click();
  mark('exporter warnings');

  // A result without notes goes away on its own; the live region keeps what it said.
  await mountWithPptx();
  await download(async () => { await trigger.click(); await item(/^PowerPoint/).click(); });
  await status().waitFor({ state: 'visible' });
  await status().waitFor({ state: 'hidden', timeout: 8000 });
  assert.match(await live(), /Fixture-deck\.pptx/);

  // A failure is shown and announced, and nothing downloads.
  await mountWithPptx(`{ exportPptx: async () => { throw new Error('Font Aptos cannot be measured.'); } }`);
  let downloaded = false;
  page.once('download', () => { downloaded = true; });
  await trigger.click();
  await item(/^PowerPoint/).click();
  await page.waitForFunction(() => document.querySelector('.opf-export-status')?.dataset.state === 'error');
  assert.match(await status().innerText(), /PowerPoint \(\.pptx\) export failed\. Font Aptos cannot be measured\./);
  await page.waitForFunction(() => /export failed/.test(document.querySelector('.opf-export-live').textContent));
  assert.equal(downloaded, false);
  assert.equal(await page.evaluate(() => window.log.statuses.at(-1).state), 'error');
  await status().getByRole('button', { name: 'Dismiss export status' }).click();
  await trigger.click();
  assert.equal(await item(/^PowerPoint/).getAttribute('aria-disabled'), null, 'a failed export leaves the menu usable');
  await page.keyboard.press('Escape');
  mark('failure');

  // An exporter that returns nothing is a failure, not an empty download.
  await mountWithPptx(`{ exportPptx: async () => new Uint8Array(0) }`);
  await trigger.click();
  await item(/^PowerPoint/).click();
  await page.waitForFunction(() => document.querySelector('.opf-export-status')?.dataset.state === 'error');
  assert.match(await status().innerText(), /returned no data/);

  // ---- Cancel ---------------------------------------------------------------------------------------------------------------------------------
  await mountWithPptx(`{ exportPptx: (d, { signal, onProgress }) => { window.log.signals.push(signal); onProgress({ stage: 'convert', done: 2, total: 4, message: 'Converting slide 2 of 4…' }); return new Promise(() => {}); } }`);
  downloaded = false;
  page.once('download', () => { downloaded = true; });
  await trigger.click();
  await item(/^PowerPoint/).click();
  await page.waitForFunction(() => /Converting slide 2 of 4/.test(document.querySelector('.opf-export-status')?.textContent ?? ''));
  const bar = status().locator('progress');
  assert.equal(await bar.isVisible(), true, 'progress is shown');
  assert.equal(Number(await bar.getAttribute('value')), 0.5, 'from onProgress done / total');
  assert.equal(await trigger.getAttribute('aria-busy'), 'true');
  await trigger.click();
  assert.equal(await item(/^PDF/).getAttribute('aria-disabled'), 'true', 'other exports wait for the running one');
  assert.equal(await item(/^PDF/).getAttribute('title'), 'Another export is running. Cancel it first.');
  assert.equal(await item(/^Agent handoff/).getAttribute('aria-disabled'), null, 'the handoff is still available');
  await page.keyboard.press('Escape');
  await status().getByRole('button', { name: 'Cancel export' }).click();
  await page.waitForFunction(() => document.querySelector('.opf-export-status')?.dataset.state === 'cancelled');
  assert.equal(await page.evaluate(() => window.log.signals.at(-1).aborted), true, 'Cancel aborts the signal the exporter was given');
  assert.match(await status().innerText(), /Export cancelled\./);
  await page.waitForFunction(() => /Export cancelled/.test(document.querySelector('.opf-export-live').textContent));
  assert.equal(downloaded, false, 'a cancelled export offers no file');
  assert.equal(await trigger.getAttribute('aria-busy'), null);
  await trigger.click();
  assert.equal(await item(/^PDF/).getAttribute('aria-disabled'), null, 'the menu recovers');
  await page.keyboard.press('Escape');
  // menu.cancel() does the same, and a late result is ignored.
  await mountWithPptx(`{ exportPptx: (d, { signal }) => new Promise((resolve) => { window.finish = () => resolve(new Uint8Array([9, 9, 9])); }) }`);
  downloaded = false;
  page.once('download', () => { downloaded = true; });
  await trigger.click();
  await item(/^PowerPoint/).click();
  await page.waitForFunction(() => window.finish);
  await page.evaluate(() => { window.menu.cancel(); window.finish(); });
  await page.waitForFunction(() => document.querySelector('.opf-export-status')?.dataset.state === 'cancelled');
  await page.waitForTimeout(300);
  assert.equal(downloaded, false, 'an exporter that ignores the signal cannot download after Cancel');
  mark('cancel');

  // ---- the disabled state -----------------------------------------------------------------------------------------------------------------------
  const DEFAULT_REASON = 'Showing the last valid slides. Fix the JSON to resume editing and downloads.';
  await mountWithPptx(`{ disabled: true }`);
  await trigger.click();
  for (const name of [/^PowerPoint/, /^PDF/, /^SVG slides/, /^PNG images/]) {
    assert.equal(await item(name).getAttribute('aria-disabled'), 'true');
    assert.equal(await item(name).getAttribute('title'), DEFAULT_REASON, 'the reason is the title');
  }
  for (const name of [/^JSON/, /^YAML/, /^Markdown/, /^Agent handoff/]) assert.equal(await item(name).getAttribute('aria-disabled'), null, 'source and handoff stay available');
  downloaded = false;
  page.once('download', () => { downloaded = true; });
  await item(/^PDF/).click({ force: true });
  await page.waitForTimeout(200);
  assert.equal(downloaded, false);
  assert.equal(await menu.isVisible(), true, 'a disabled item does nothing, not even close the menu');
  assert.equal(await page.evaluate(() => window.log.pptxCalls), 0);
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.menu.setDisabled('Fix the JSON first.'));
  await trigger.click();
  assert.equal(await item(/^PDF/).getAttribute('title'), 'Fix the JSON first.');
  await page.evaluate(() => window.menu.setDisabled(false));
  assert.equal(await item(/^PDF/).getAttribute('aria-disabled'), null, 'setDisabled(false) enables the slide exports while the menu is open');
  assert.equal(await item(/^PDF/).getAttribute('title'), null);
  await page.evaluate(() => window.menu.setDisabled(true));
  assert.equal(await item(/^PDF/).getAttribute('aria-disabled'), 'true');
  await page.keyboard.press('Escape');
  mark('disabled state');

  // ---- OPF source: JSON, YAML, Markdown ---------------------------------------------------------------------------------------------------
  const richDeck = {
    name: 'Source deck', language: 'en-US', design: { theme: 'classic', fontScheme: 'roboto' },
    slides: [{ id: 'a', title: 'Hello', items: ['One', 'Two'] }, { id: 'b', title: 'Table', table: { columns: ['A', 'B'], rows: [['1', '2']] } }],
  };
  await page.evaluate((value) => { window.deck = value; }, richDeck);
  await mountWithPptx();
  await trigger.click();
  const json = await download(() => item(/^JSON/).click());
  assert.equal(json.name, 'Source-deck.opf.json');
  assert.deepEqual(JSON.parse(json.bytes.toString('utf8')), richDeck, 'the JSON is the document');
  await page.waitForFunction(() => window.log.exports.at(-1)?.format === 'json');
  // This host registers no catalogs, so the theme and font scheme the deck names cannot be embedded: the author is told.
  assert.match(await page.evaluate(() => window.log.statuses.at(-1).message), /^Source-deck\.opf\.json · \d+ KB · 1 note to review$/);
  assert.deepEqual((await page.evaluate(() => window.log.exports.at(-1))).notes, ['2 catalog references did not resolve, so no record was embedded for them.']);
  await status().getByRole('button', { name: 'Dismiss export status' }).click();
  await trigger.click();
  const yaml = await download(() => item(/^YAML/).click());
  assert.equal(yaml.name, 'Source-deck.opf.yaml');
  const yamlText = yaml.bytes.toString('utf8');
  assert.match(yamlText, /^name: Source deck$/m, 'the YAML is readable');
  const fromYamlResult = fromYaml(yamlText);
  assert.equal(fromYamlResult.valid, true);
  assert.deepEqual(fromYamlResult.presentation, richDeck, 'core reads the YAML back to the same document');
  await trigger.click();
  const markdown = await download(() => item(/^Markdown/).click());
  assert.equal(markdown.name, 'Source-deck.opf.md');
  const mdText = markdown.bytes.toString('utf8');
  assert.match(mdText, /^---\n/, 'OPF Markdown starts with front matter');
  assert.match(mdText, /# Hello/);
  const fromMd = fromMarkdown(mdText);
  assert.equal(fromMd.valid, true);
  assert.deepEqual(fromMd.presentation, richDeck, 'core reads the Markdown back to the same document');
  mark('opf source');

  // Parts the Markdown dialect has no syntax for are written as YAML fences and the author is told.
  assert.deepEqual((await page.evaluate(() => window.log.exports.at(-1))).notes, [], 'a deck the dialect expresses has nothing to report');
  await status().getByRole('button', { name: 'Dismiss export status' }).click().catch(() => {});
  const styled = { name: 'Emb', slides: [{ id: 't', title: 'Styled', table: { columns: ['A', 'B'], rows: [[{ value: 'x', style: { fill: '#E9E3FF' } }, 'y']] } }] };
  await page.evaluate((value) => { window.deck = value; }, styled);
  await trigger.click();
  const styledMd = await download(() => item(/^Markdown/).click());
  assert.match(styledMd.bytes.toString('utf8'), /```opf-block/, 'the part with no Markdown form is embedded as YAML');
  assert.deepEqual(fromMarkdown(styledMd.bytes.toString('utf8')).presentation, styled, 'and nothing is lost');
  await page.waitForFunction(() => document.querySelector('.opf-export-notes li'));
  assert.deepEqual(await status().locator('.opf-export-notes li').allInnerTexts(), ['Written as YAML inside the Markdown, which has no syntax for it: /slides/0/table, table content has a part with no Markdown form']);
  assert.match(await status().innerText(), /1 note to review/);
  await status().getByRole('button', { name: 'Dismiss export status' }).click();

  // A deck that is not OPF cannot be written as YAML: the failure says so.
  await page.evaluate(() => { window.deck = { name: 'Broken', slides: [{ title: 5 }] }; });
  await trigger.click();
  await item(/^YAML/).click();
  await page.waitForFunction(() => document.querySelector('.opf-export-status')?.dataset.state === 'error');
  assert.match(await status().innerText(), /YAML export failed\./);
  await status().getByRole('button', { name: 'Dismiss export status' }).click();
  await page.evaluate((value) => { window.deck = value; }, deck);
  mark('invalid source reports a failure');

  // ---- onDownload, items, labels, refresh -----------------------------------------------------------------------------------------
  await mountWithPptx(`{ onDownload: async ({ blob, fileName, format }) => { window.log.downloads.push({ fileName, format, type: blob.type, size: blob.size, text: blob.size < 4000 ? await blob.text() : '' }); } }`);
  downloaded = false;
  page.once('download', () => { downloaded = true; });
  await trigger.click();
  await item(/^JSON/).click();
  await page.waitForFunction(() => window.log.downloads.length === 1);
  const handed = await page.evaluate(() => window.log.downloads[0]);
  assert.equal(handed.fileName, 'Fixture-deck.opf.json');
  assert.equal(handed.format, 'json');
  assert.equal(handed.type, 'application/json');
  assert.deepEqual(JSON.parse(handed.text), deck);
  await page.waitForTimeout(200);
  assert.equal(downloaded, false, 'with onDownload there is no Blob-link download');
  await trigger.click();
  await item(/^PowerPoint/).click();
  await page.waitForFunction(() => window.log.downloads.length === 2);
  const handedPptx = await page.evaluate(() => window.log.downloads[1]);
  assert.deepEqual([handedPptx.fileName, handedPptx.format, handedPptx.type, handedPptx.size], ['Fixture-deck.pptx', 'pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 2008]);
  // A host that rejects its own download reports a failure.
  await mountWithPptx(`{ onDownload: async () => { throw new Error('Storage is full.'); } }`);
  await trigger.click();
  await item(/^JSON/).click();
  await page.waitForFunction(() => document.querySelector('.opf-export-status')?.dataset.state === 'error');
  assert.match(await status().innerText(), /Storage is full\./);
  mark('onDownload');

  // beforeExport can stop an export (a canvas edit that does not validate).
  await mountWithPptx(`{ beforeExport: (kind, format) => { window.log.before = [kind, format]; return false; } }`);
  await trigger.click();
  await item(/^JSON/).click();
  await page.waitForTimeout(150);
  assert.deepEqual(await page.evaluate(() => window.log.before), ['source', 'json']);
  assert.equal(await page.evaluate(() => window.log.statuses.length), 0, 'nothing ran');

  // items: hide formats and groups.
  await mountWithPptx(`{ items: { slides: ['pdf', 'png'], source: ['json'], agent: false } }`);
  await trigger.click();
  assert.deepEqual(await page.getByRole('menuitem').evaluateAll((nodes) => nodes.map((n) => n.querySelector('.opf-export-item-label').textContent)), ['PDF', 'PNG images', 'JSON']);
  await page.keyboard.press('Escape');
  await mountWithPptx(`{ items: { slides: false, source: false } }`);
  await trigger.click();
  assert.deepEqual(await page.getByRole('menuitem').evaluateAll((nodes) => nodes.map((n) => n.querySelector('.opf-export-item-label').textContent)), ['Agent handoff']);
  assert.equal(await page.getByRole('group').count(), 1);
  await page.keyboard.press('Escape');
  // Without exportPptx the PowerPoint item is not offered; asked for by name it shows, disabled, and says why.
  await page.evaluate(() => { window.mountMenu({}); });
  await trigger.click();
  assert.equal(await page.getByRole('menuitem', { name: /PowerPoint/ }).count(), 0);
  await page.keyboard.press('Escape');
  await page.evaluate(() => { window.mountMenu({ items: { slides: ['pptx', 'pdf'] } }); });
  await trigger.click();
  assert.equal(await item(/^PowerPoint/).getAttribute('aria-disabled'), 'true');
  assert.match(await item(/^PowerPoint/).getAttribute('title'), /not set up/);
  await page.keyboard.press('Escape');
  mark('items');

  // The ZIP hint follows the document (refresh and every open).
  await page.evaluate(() => { window.mountMenu({}); window.deck = { name: 'One', slides: [{ title: 'Only' }] }; });
  await trigger.click();
  assert.equal(await item(/^SVG slides/).locator('.opf-export-item-meta').innerText(), '.svg', 'one slide is one file');
  assert.equal(await item(/^PNG images/).locator('.opf-export-item-meta').innerText(), '.png');
  await page.keyboard.press('Escape');
  await page.evaluate((value) => { window.deck = value; window.menu.refresh(); }, deck);
  await trigger.click();
  assert.equal(await item(/^SVG slides/).locator('.opf-export-item-meta').innerText(), 'ZIP');
  await page.keyboard.press('Escape');
  // A custom label.
  await page.evaluate(() => { window.mountMenu({ label: 'Download' }); });
  assert.equal(await page.getByRole('button', { name: 'Download', exact: true }).count(), 1);
  mark('labels and hints');

  // ---- the agent handoff entry -------------------------------------------------------------------------------------------------------------
  await mountWithPptx(`{ onAgentHandoff: (h) => { window.log.handoffs = [h]; } }`);
  await trigger.click();
  await item(/^Agent handoff/).click();
  assert.deepEqual(await page.evaluate(() => JSON.parse(JSON.stringify(window.log.handoffs))), [{ document: deck, target: 'pptx' }], 'onAgentHandoff gets the document and the default target');
  assert.equal(await page.getByRole('dialog', { name: 'Agent handoff' }).count(), 0, 'and then no dialog opens');
  await page.evaluate(() => { window.mountMenu({}); });
  await trigger.click();
  await item(/^Agent handoff/).click();
  const dialog = page.getByRole('dialog', { name: 'Agent handoff' });
  await dialog.waitFor();
  assert.equal(await menu.isHidden(), true, 'the menu closes');
  assert.match(await page.locator('.opf-handoff-prompt').inputValue(), /"name": "Fixture deck"/, 'the default is the handoff dialog, with the deck');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await activeName(), 'Export', 'focus returns to the Export trigger');
  mark('agent handoff entry');

  // ---- density and the mobile bottom sheet -----------------------------------------------------------------------------------------
  await page.evaluate(() => { window.mountMenu({ density: 'touch' }); });
  assert.ok((await trigger.boundingBox()).height >= 40, 'touch density makes the trigger 40px');
  await trigger.click();
  assert.ok((await item(/^PDF/).boundingBox()).height >= 40, 'and the items');
  await page.keyboard.press('Escape');
  await page.evaluate(() => { window.mountMenu({ density: 'comfortable' }); });
  assert.equal(Math.round((await trigger.boundingBox()).height), 32, 'the default is 32px');

  await page.setViewportSize({ width: 390, height: 780 });
  await mountWithPptx(`{ mode: 'sheet', density: 'touch' }`);
  const sheet = page.getByRole('dialog', { name: 'Export' });
  assert.equal(await sheet.isHidden(), true);
  assert.equal(await trigger.getAttribute('aria-haspopup'), 'dialog');
  await trigger.click();
  assert.equal(await sheet.isVisible(), true, 'the bottom sheet is a dialog named Export');
  assert.equal(await sheet.getAttribute('aria-modal'), 'true');
  assert.equal(await page.locator('.opf-export-scrim').isVisible(), true, 'with a scrim');
  assert.equal(await page.locator('.opf-export-handle').isVisible(), true, 'a drag handle');
  assert.equal(await sheet.getByRole('menu').count(), 1, 'the same menu sits inside');
  const box = await sheet.boundingBox();
  assert.ok(Math.abs(box.y + box.height - 780) < 1 && box.x === 0 && box.width === 390, `the sheet fills the bottom edge: ${JSON.stringify(box)}`);
  assert.ok((await item(/^PDF/).boundingBox()).height >= 44, 'rows are 44px in the sheet');
  assert.equal(await menu.getByRole('group').count(), 3);
  assert.match(await activeName(), /^PowerPoint/, 'focus moves into the sheet');
  const closeButton = sheet.getByRole('button', { name: 'Close' });
  assert.ok((await closeButton.boundingBox()).height >= 40);
  // Tab stays inside the sheet: eight items, then Close, then around.
  const seen = [];
  for (let i = 0; i < 10; i++) { await page.keyboard.press('Tab'); seen.push(await activeName()); }
  assert.ok(seen.every((name) => name === 'Close' || /^(PowerPoint|PDF|SVG|PNG|JSON|YAML|Markdown|Agent)/.test(name)), `focus stays in the sheet: ${seen}`);
  assert.ok(seen.includes('Close'));
  await page.keyboard.press('Shift+Tab');
  await closeButton.focus();
  await page.keyboard.press('Tab');
  assert.match(await activeName(), /^PowerPoint/, 'Tab from Close wraps to the first item');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await activeName(), 'Close', 'and Shift+Tab goes back');
  await page.keyboard.press('Escape');
  assert.equal(await sheet.isHidden(), true, 'Escape closes the sheet');
  assert.equal(await activeName(), 'Export');
  await trigger.click();
  await closeButton.click();
  assert.equal(await sheet.isHidden(), true, 'Close closes the sheet');
  await trigger.click();
  await page.mouse.click(200, 60);
  assert.equal(await sheet.isHidden(), true, 'a tap on the scrim closes it');
  await trigger.click();
  const fromSheet = await download(() => item(/^JSON/).click());
  assert.equal(fromSheet.name, 'Fixture-deck.opf.json');
  assert.equal(await sheet.isHidden(), true, 'choosing a format closes the sheet');
  const placed = await status().boundingBox();
  assert.ok(placed.y + placed.height <= 780 && placed.y > 600, `the status line sits at the bottom: ${JSON.stringify(placed)}`);
  await status().getByRole('button', { name: 'Dismiss export status' }).click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, 'no sideways scroll at 390px');
  // The mode can change at runtime (a media query).
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.evaluate(() => window.menu.setMode('menu'));
  await trigger.click();
  assert.equal(await sheet.isHidden(), true);
  assert.equal(await menu.isVisible(), true, 'back to the popover');
  assert.equal(await page.locator('.opf-export-scrim').isHidden(), true);
  await page.keyboard.press('Escape');
  mark('mobile bottom sheet');

  // ---- destroy ---------------------------------------------------------------------------------------------------------------------------------
  await mountWithPptx(`{ exportPptx: (d, { signal }) => { window.log.signals.push(signal); return new Promise(() => {}); } }`);
  await trigger.click();
  await item(/^PowerPoint/).click();
  await page.waitForFunction(() => window.log.signals.length);
  await page.evaluate(() => window.menu.destroy());
  assert.equal(await page.evaluate(() => window.log.signals.at(-1).aborted), true, 'destroy cancels a running export');
  assert.equal(await page.locator('.opf-export').count(), 0, 'and removes the menu');
  await page.keyboard.press('Escape');
  mark('destroy');

  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, browser: app.browser.version(), checks }, null, 2));
} finally {
  await app.close();
}
