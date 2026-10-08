import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

// RR-21 in a real browser, on the built playground (npm run build:playground): slide management in the navigator, the slide sorter and
// the outline view. Drag and drop and Alt+arrow reorder, hide, duplicate, delete, sections, layouts, outline editing with promote and
// demote, and one undo step for each change; plus the accessibility contract (names, roles, focus, announcements).
const root = fileURLToPath(new URL('../artifacts/playground/', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.ttf': 'font/ttf' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
    const target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403).end(); return; }
    const body = await readFile(target);
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] ?? 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

const source = {
  name: 'Slide management',
  language: 'en-US',
  design: { theme: 'classic', fontScheme: 'roboto' },
  slides: [
    { id: 'a', title: 'Alpha', text: 'First words', section: 'Intro' },
    { id: 'b', title: 'Beta', text: 'Second words', section: 'Intro' },
    { id: 'c', title: 'Gamma', items: ['One', 'Two', { text: 'Two point one', level: 1 }, 'Three'], section: 'Body' },
    { id: 'd', title: 'Delta', text: 'Fourth words', section: 'Body' },
    { id: 'e', title: 'Epsilon', text: 'Fifth words', section: 'End' },
    { id: 'f', title: 'Zeta', text: 'Sixth words', section: 'End' },
  ],
};
const plainSource = { name: 'Plain', design: { theme: 'classic', fontScheme: 'roboto' }, slides: [{ id: 'p1', title: 'One', text: 'x' }, { id: 'p2', title: 'Two', text: 'y' }, { id: 'p3', title: 'Three', text: 'z' }] };

let browser;
const checks = [];
try {
  browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.stack ?? error.message));
  page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text()); });
  const mark = name => checks.push(name);
  const doc = async () => JSON.parse(await page.locator('#json').inputValue());
  const ids = async () => (await doc()).slides.map(slide => slide.id);
  const sections = async () => (await doc()).slides.map(slide => slide.section ?? '-');
  const settle = () => page.waitForFunction(() => !/Loading fonts/.test(document.querySelector('#status').textContent) && !document.querySelector('#preview')?.textContent.includes('Loading fonts'), undefined, { timeout: 60000 });
  const waitDoc = async (predicate, message) => {
    const started = Date.now();
    for (;;) {
      const current = await doc();
      if (predicate(current)) return current;
      if (Date.now() - started > 8000) assert.fail(`${message}: ${JSON.stringify(current).slice(0, 400)}`);
      await page.waitForTimeout(40);
    }
  };
  const live = region => page.locator(region).first().textContent();
  const waitLive = async (pattern, message, region = '#slide-list ~ .opf-slides-live') => {
    const started = Date.now();
    for (;;) {
      const text = await live(region);
      if (pattern.test(text)) return text;
      if (Date.now() - started > 4000) assert.fail(`${message}: announcement was "${text}"`);
      await page.waitForTimeout(40);
    }
  };
  const load = async deck => {
    await page.getByRole('button', { name: 'Source', exact: true }).click();
    await page.locator('#json').fill(JSON.stringify(deck));
    await page.waitForFunction(() => !document.querySelector('#apply-json').disabled && !document.querySelector('#json-error').textContent);
    await page.getByRole('button', { name: 'Apply changes', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('#source-dialog').open);
    await settle();
  };
  // axe-core on one part of the page: no WCAG 2.x A/AA or best-practice violation (contrast included).
  const axe = async (include, name) => {
    await page.addScriptTag({ content: axeSource }).catch(() => {});
    const result = await page.evaluate(selectors => window.axe.run({ include: selectors.map(selector => [selector]) }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } }), include);
    const found = result.violations.map(violation => `${violation.id} (${violation.nodes.length}): ${violation.nodes.slice(0, 3).map(node => node.target.join(' ')).join(' | ')}`);
    assert.deepEqual(found, [], `${name}: axe violations`);
    mark(`axe: ${name}`);
  };
  const cards = () => page.locator('#slide-list .slide-card');
  const card = index => page.locator(`#slide-list .slide-card[data-index="${index}"]`);
  const titles = () => page.locator('#slide-list .slide-card .thumbnail-title').allTextContents();
  const undoDepth = () => page.evaluate(() => { let depth = 0; return depth; });
  void undoDepth;
  // One undo step: after `action`, a single Undo restores `before` exactly and a single Redo restores the result.
  async function oneStep(name, action, expect, inspect) {
    const before = await doc();
    await action();
    const after = await waitDoc(expect, name);
    assert.notDeepEqual(after, before, `${name} changed the document`);
    await settle();
    await inspect?.(after);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await waitDoc(current => JSON.stringify(current) === JSON.stringify(before), `${name}: one Undo restores the deck`);
    await settle();
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await waitDoc(current => JSON.stringify(current) === JSON.stringify(after), `${name}: Redo restores the change`);
    await settle();
    mark(name);
    return after;
  }

  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.locator('#preview svg').waitFor();
  await settle();
  await load(source);
  assert.deepEqual(await doc(), source);

  // --- the navigator -------------------------------------------------------------------------------------
  assert.equal(await cards().count(), 6);
  assert.deepEqual(await page.locator('#slide-list .section-name').allTextContents(), ['Intro', 'Body', 'End']);
  assert.equal(await page.locator('#slide-list').getAttribute('aria-label'), 'Slides');
  // Names: every card and section control says what it is; one card is the tab stop (roving), the current one.
  const cardNames = await cards().evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')));
  assert.equal(cardNames[0], 'Slide 1 of 6: Alpha');
  assert.equal(await page.locator('#slide-list .slide-card[tabindex="0"]').count(), 1);
  assert.equal(await card(0).getAttribute('aria-current'), 'true');
  assert.ok(await page.locator('#slide-list .section-more').first().getAttribute('aria-label'), 'section menus are labelled');
  mark('the navigator lists slides and sections with accessible names');
  await axe(['#slide-list', '#slide-toolbar'], 'navigator and toolbar');

  // Keyboard reorder: Alt+Down moves the slide, focus follows it, and the change is announced.
  await card(1).click();
  await page.waitForFunction(() => document.querySelector('#slide-list .slide-card[data-index="1"]').getAttribute('aria-current') === 'true');
  await oneStep('Alt+Down moves a slide down one place', async () => { await page.keyboard.press('Alt+ArrowDown'); }, current => current.slides.map(slide => slide.id).join() === 'a,c,b,d,e,f', async () => {
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Slide 3 of 6: Beta, selected'.replace(', selected', ''), 'focus follows the moved slide');
  });
  // After the redo above the order is a,c,b,...: Beta crossed into the Body section.
  assert.deepEqual(await sections(), ['Intro', 'Body', 'Body', 'Body', 'End', 'End'], 'crossing a boundary joins the next section');
  await card(2).focus();
  await page.keyboard.press('Alt+ArrowUp');
  await waitDoc(current => current.slides.map(slide => slide.id).join() === 'a,b,c,d,e,f', 'Alt+Up moves it back');
  assert.match(await waitLive(/moved to position 2 of 6/, 'announces the move'), /Slide moved to position 2 of 6, in section Intro/);
  assert.deepEqual(await sections(), ['Intro', 'Intro', 'Body', 'Body', 'End', 'End']);
  await settle();
  // The ends do not move, and say so.
  await card(0).click();
  await page.keyboard.press('Alt+ArrowUp');
  await waitLive(/Already the first slide/, 'first slide');
  assert.deepEqual(await ids(), ['a', 'b', 'c', 'd', 'e', 'f']);
  mark('Alt+Up and Alt+Down reorder from the keyboard with announcements');

  // Plain arrows move between slides; Home and End jump.
  await page.keyboard.press('ArrowDown');
  assert.equal(await card(1).getAttribute('aria-current'), 'true');
  await page.keyboard.press('End');
  assert.equal(await card(5).getAttribute('aria-current'), 'true');
  await page.keyboard.press('Home');
  assert.equal(await card(0).getAttribute('aria-current'), 'true');
  await settle();

  // Drag and drop.
  await oneStep('dragging a slide below another moves it there', async () => {
    const target = await card(3).boundingBox();
    await card(0).dragTo(card(3), { targetPosition: { x: target.width / 2, y: target.height - 4 } });
  }, current => current.slides.map(slide => slide.id).join() === 'b,c,d,a,e,f');
  assert.deepEqual(await sections(), ['Intro', 'Body', 'Body', 'Body', 'End', 'End'], 'dropped slides take the section they land in');
  await settle();
  mark('drag and drop reorders and adopts the section');
  // Dropping on a section header puts the slide first in that section.
  await load(source);
  await oneStep('dropping on a section header starts that section', async () => {
    await card(0).dragTo(page.locator('#slide-list .slide-section').nth(2));
  }, current => current.slides.map(slide => `${slide.id}:${slide.section}`).join() === 'b:Intro,c:Body,d:Body,a:End,e:End,f:End');
  mark('dropping on a section header joins that section');

  // --- hide, duplicate, delete -------------------------------------------------------------------------------
  await load(source);
  await card(1).click();
  await oneStep('hiding a slide', async () => { await page.locator('#slide-toolbar [data-action="hide"]').click(); },
    current => current.slides[1].hidden === true && !('hidden' in current.slides[0]),
    async () => {
      assert.equal(await card(1).getAttribute('aria-label'), 'Slide 2 of 6: Beta, hidden');
      assert.equal(await card(1).locator('.slide-badge').textContent(), 'Hidden');
      assert.equal(await page.locator('#slide-toolbar [data-action="hide"]').getAttribute('aria-label'), 'Show slide');
      await waitLive(/hidden from the slide show/, 'announces hiding');
    });
  await page.locator('#slide-toolbar [data-action="hide"]').click();
  await waitDoc(current => !('hidden' in current.slides[1]), 'showing removes the hidden flag');
  assert.equal(await page.locator('#slide-toolbar [data-action="hide"]').getAttribute('aria-label'), 'Hide slide');
  await settle();
  mark('hide and show use the OPF hidden flag');

  await card(2).click();
  await card(2).focus();
  await oneStep('Ctrl+D duplicates the slide', async () => { await page.keyboard.press('Control+d'); },
    current => current.slides.map(slide => slide.id).join() === 'a,b,c,c-2,d,e,f' && current.slides[3].section === 'Body',
    async () => { assert.equal(await card(3).getAttribute('aria-current'), 'true', 'the copy is shown'); await waitLive(/Duplicated 1 slide/, 'announces the copy'); });
  await card(3).focus();
  await oneStep('Delete removes the slide', async () => { await page.keyboard.press('Delete'); },
    current => current.slides.map(slide => slide.id).join() === 'a,b,c,d,e,f',
    async () => { await waitLive(/Deleted 1 slide\. 6 left/, 'announces the delete and how to undo'); });
  await settle();
  // A deck keeps one slide.
  await load({ name: 'One', design: { theme: 'classic', fontScheme: 'roboto' }, slides: [{ id: 'only', title: 'Only', text: 'x' }] });
  assert.equal(await page.locator('#slide-toolbar [data-action="delete"]').isDisabled(), true, 'the last slide cannot be deleted from the toolbar');
  await card(0).focus();
  await page.keyboard.press('Delete');
  await waitLive(/at least one slide/, 'the last slide is kept');
  assert.deepEqual(await ids(), ['only']);
  mark('duplicate and delete are one undo step, and the last slide stays');

  // --- multi-select ------------------------------------------------------------------------------------------
  await load(source);
  await card(1).click();
  await card(3).click({ modifiers: ['Shift'] });
  assert.deepEqual(await cards().evaluateAll(nodes => nodes.map(node => node.dataset.selected)), ['false', 'true', 'true', 'true', 'false', 'false']);
  assert.match(await card(2).getAttribute('aria-label'), /selected/);
  await oneStep('Alt+Down moves several selected slides together', async () => { await page.keyboard.press('Alt+ArrowDown'); },
    current => current.slides.map(slide => `${slide.id}:${slide.section}`).join() === 'a:Intro,e:End,b:End,c:End,d:End,f:End');
  await load(source);
  await card(0).click();
  // ControlOrMeta: Chromium on macOS turns Ctrl+click into a context-menu click; Cmd+click is the platform's add-to-selection.
  await card(4).click({ modifiers: ['ControlOrMeta'] });
  assert.deepEqual(await cards().evaluateAll(nodes => nodes.map(node => node.dataset.selected)), ['true', 'false', 'false', 'false', 'true', 'false'], 'Ctrl+click adds a slide');
  await oneStep('hiding several selected slides at once', async () => { await page.locator('#slide-toolbar [data-action="hide"]').click(); },
    current => current.slides.filter(slide => slide.hidden).map(slide => slide.id).join() === 'a,e');
  await card(4).focus();
  await page.keyboard.press('Control+a');
  assert.equal(await cards().evaluateAll(nodes => nodes.every(node => node.dataset.selected === 'true')), true, 'Ctrl+A selects every slide');
  await page.keyboard.press('Escape');
  assert.equal(await cards().evaluateAll(nodes => nodes.filter(node => node.dataset.selected === 'true').length), 1, 'Escape returns to one slide');
  mark('multi-select: Shift range, Ctrl toggle, Ctrl+A, Escape');
  // A change that did not come from the slide list (Undo, Apply in the source dialog) collapses the selection to the current slide.
  await card(0).click();
  await card(2).click({ modifiers: ['Shift'] });
  assert.equal(await cards().evaluateAll(nodes => nodes.filter(node => node.dataset.selected === 'true').length), 3);
  await load(source);
  assert.equal(await cards().evaluateAll(nodes => nodes.filter(node => node.dataset.selected === 'true').length), 1, 'a replaced document leaves one slide selected');
  // Dragging one of several selected slides moves the whole selection.
  await load(source);
  await card(0).click();
  await card(1).click({ modifiers: ['Shift'] });
  await oneStep('dragging a selection moves all of it', async () => {
    const target = await card(5).boundingBox();
    await card(0).dragTo(card(5), { targetPosition: { x: target.width / 2, y: target.height - 4 } });
  }, current => current.slides.map(slide => slide.id).join() === 'c,d,e,f,a,b');

  // --- sections ----------------------------------------------------------------------------------------------
  await load(source);
  await card(3).click({ button: 'right' });
  assert.equal(await page.getByRole('menu').count(), 1, 'the context menu opens');
  assert.ok(await page.getByRole('menuitem').count() >= 8, 'with its actions');
  await axe(['.opf-menu'], 'slide menu');
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('menu').count(), 0, 'Escape closes it');
  assert.equal(await page.evaluate(() => document.activeElement.classList.contains('slide-card')), true, 'and focus returns to the slide');
  await card(3).click({ button: 'right' });
  await oneStep('Add section starts a section at the slide', async () => {
    await page.getByRole('menuitem', { name: /^Add section here/ }).click();
    const dialog = page.locator('dialog.opf-sm-dialog[open]');
    await axe(['dialog.opf-sm-dialog'], 'name dialog');
    await dialog.getByLabel('Section name').fill('Details');
    await dialog.getByRole('button', { name: 'OK' }).click();
  }, current => current.slides.map(slide => slide.section).join() === 'Intro,Intro,Body,Details,End,End',
  async () => { assert.deepEqual(await page.locator('#slide-list .section-name').allTextContents(), ['Intro', 'Body', 'Details', 'End']); });
  // Rename a section from its menu.
  await load(source);
  await page.locator('#slide-list .section-more').nth(1).click();
  await oneStep('renaming a section relabels all its slides', async () => {
    await page.getByRole('menuitem', { name: /^Rename section/ }).click();
    const dialog = page.locator('dialog.opf-sm-dialog[open]');
    assert.equal(await dialog.getByLabel('Section name').inputValue(), 'Body');
    await dialog.getByLabel('Section name').fill('Main');
    await page.keyboard.press('Enter');
  }, current => current.slides.map(slide => slide.section).join() === 'Intro,Intro,Main,Main,End,End');
  // Collapse and expand.
  await load(source);
  const toggle = page.locator('#slide-list .section-toggle').nth(2);
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  await toggle.click();
  assert.equal(await page.locator('#slide-list .section-toggle').nth(2).getAttribute('aria-expanded'), 'false');
  assert.equal(await cards().count(), 4, 'a collapsed section hides its slides');
  await page.locator('#slide-list .section-toggle').nth(2).click();
  assert.equal(await cards().count(), 6);
  // Move a section down, remove a section.
  await page.locator('#slide-list .section-more').nth(0).click();
  await oneStep('moving a section moves its slides', async () => { await page.getByRole('menuitem', { name: 'Move section down' }).click(); },
    current => current.slides.map(slide => slide.id).join() === 'c,d,a,b,e,f');
  await page.locator('#slide-list .section-more').nth(1).click();
  await oneStep('removing a section keeps its slides', async () => { await page.getByRole('menuitem', { name: 'Remove section (keep slides)' }).click(); },
    current => current.slides.map(slide => slide.section).join() === 'Body,Body,Body,Body,End,End');
  // Move to a section from the slide menu.
  await load(source);
  await card(0).click({ button: 'right' });
  await oneStep('Move to section relabels the slide', async () => { await page.getByRole('menuitem', { name: 'Move to section: End' }).click(); },
    current => current.slides[0].section === 'End' && current.slides.map(slide => slide.id).join() === 'a,b,c,d,e,f');
  mark('sections: add, rename, collapse, move, remove and assign');

  // --- add with a layout ---------------------------------------------------------------------------------------
  await load(source);
  await card(1).click();
  await page.locator('#add-layout').click();
  const picker = page.locator('dialog.opf-layout-dialog[open]');
  await axe(['dialog.opf-layout-dialog'], 'layout dialog');
  await picker.getByPlaceholder('Filter layouts').fill('list-2x');
  await oneStep('Add slide with layout inserts after the current slide', async () => { await picker.getByRole('button', { name: 'Add slide' }).click(); },
    current => current.slides.length === 7 && current.slides[2].layout === 'list-2x' && current.slides[2].section === 'Intro',
    async () => { assert.equal(await card(2).getAttribute('aria-current'), 'true'); });
  await page.locator('#add').click();
  await waitDoc(current => current.slides.length === 8 && current.slides[7].title === 'New slide', 'Add slide still appends a starter slide');
  mark('add slide with a layout, and plain Add slide');

  // --- the slide sorter ----------------------------------------------------------------------------------------
  await load(source);
  await page.locator('#view-sorter').click();
  assert.equal(await page.locator('#view-sorter').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('.canvas-scroll').isHidden(), true);
  assert.equal(await page.locator('#sorter-list .slide-card').count(), 6);
  assert.equal(await page.locator('#sorter-list').getAttribute('aria-label'), 'Slide sorter');
  await axe(['#sorter-view', '#view-switch'], 'slide sorter');
  const sorterCard = index => page.locator(`#sorter-list .slide-card[data-index="${index}"]`);
  await sorterCard(0).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await sorterCard(1).getAttribute('aria-current'), 'true', 'arrow keys move through the grid');
  await page.keyboard.press('ArrowDown');
  const gridColumns = await page.locator('#sorter-list').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length);
  assert.ok(gridColumns > 1, 'the sorter lays slides out in a grid');
  assert.equal(Number(await page.evaluate(() => document.activeElement.dataset.index)), Math.min(5, 1 + gridColumns), 'Down moves to the slide in the next row');
  await sorterCard(0).click();
  await oneStep('Alt+Right moves a slide in the sorter', async () => { await page.keyboard.press('Alt+ArrowRight'); },
    current => current.slides.map(slide => slide.id).join() === 'b,a,c,d,e,f');
  await oneStep('dragging in the sorter reorders', async () => {
    const target = await sorterCard(4).boundingBox();
    await sorterCard(0).dragTo(sorterCard(4), { targetPosition: { x: target.width - 6, y: target.height / 2 } });
  }, current => current.slides.map(slide => slide.id).join() === 'a,c,d,e,b,f');
  await sorterCard(2).click({ button: 'right' });
  assert.equal(await page.getByRole('menu').count(), 1, 'the sorter has the same menu');
  await page.keyboard.press('Escape');
  await page.locator('#view-slide').click();
  assert.equal(await page.locator('.canvas-scroll').isHidden(), false);
  mark('the slide sorter: grid keys, Alt+arrow and drag reorder, menu');

  // --- the outline ---------------------------------------------------------------------------------------------
  await load(source);
  await page.locator('#view-outline').click();
  const outlineInput = key => page.locator(`#outline-view [data-key="${key}"] .outline-input`);
  assert.equal(await page.locator('#outline-view .outline-input').count(), 15, 'a row per title, text and bullet');
  assert.deepEqual(await page.locator('#outline-view .outline-section').allTextContents(), ['Intro', 'Body', 'End']);
  await axe(['#outline-view'], 'outline');
  assert.equal(await outlineInput('slide:slides.2').getAttribute('aria-label'), 'Slide 3 title');
  assert.equal(await outlineInput('item:slides.2.items.2').getAttribute('aria-label'), 'Slide 3, level 2 bullet');
  // Editing a title commits one change when the row loses focus.
  await oneStep('editing a title in the outline', async () => {
    await outlineInput('slide:slides.0').fill('Alpha prime');
    await outlineInput('slide:slides.0').press('Tab');
  }, current => current.slides[0].title === 'Alpha prime');
  await oneStep('editing a bullet in the outline', async () => {
    await outlineInput('item:slides.2.items.1').fill('Two (edited)');
    await outlineInput('item:slides.2.items.1').press('Tab');
  }, current => current.slides[2].items[1] === 'Two (edited)');
  await outlineInput('item:slides.2.items.1').focus();
  await oneStep('Enter adds a line after the bullet and its nested bullets', async () => { await page.keyboard.press('Enter'); },
    current => current.slides[2].items.length === 5 && current.slides[2].items[3] === '',
    async () => { assert.equal(await page.evaluate(() => document.activeElement?.closest('[data-key]')?.dataset.key), 'item:slides.2.items.3', 'the new line has focus'); });
  // Backspace on the empty line removes it again.
  await outlineInput('item:slides.2.items.3').focus();
  await page.keyboard.press('Backspace');
  await waitDoc(current => current.slides[2].items.length === 4, 'Backspace on an empty bullet removes it');
  // Move, demote, promote with the keyboard.
  await outlineInput('item:slides.2.items.3').focus();
  await oneStep('Alt+Up moves a bullet above its sibling and that sibling\'s children', async () => { await page.keyboard.press('Alt+ArrowUp'); },
    current => current.slides[2].items.map(item => item.text ?? item).join() === 'One,Three,Two (edited),Two point one');
  await load(source);
  await page.locator('#view-outline').click();
  await outlineInput('item:slides.2.items.3').focus();
  await oneStep('Alt+Shift+Right demotes a bullet', async () => { await page.keyboard.press('Alt+Shift+ArrowRight'); },
    current => JSON.stringify(current.slides[2].items[3]) === JSON.stringify({ text: 'Three', level: 1 }));
  await outlineInput('item:slides.2.items.1').focus();
  await oneStep('Alt+Shift+Left on a top-level bullet makes it a slide', async () => { await page.keyboard.press('Alt+Shift+ArrowLeft'); },
    current => current.slides.length === 7 && current.slides[3].title === 'Two' && current.slides[3].items?.length === 2 && current.slides[2].items.length === 1,
    async () => { await waitLive(/Promoted to slide 4/, 'announced', '#outline-view [role="status"]'); });
  await outlineInput('slide:slides.3').focus();
  await oneStep('Alt+Down moves a slide with its text', async () => { await page.keyboard.press('Alt+ArrowDown'); },
    current => current.slides.length === 7 && current.slides[3].id === 'd' && current.slides[4].title === 'Two');
  await outlineInput('slide:slides.4').focus();
  await oneStep('Enter on a title adds a slide after it', async () => { await page.keyboard.press('Enter'); },
    current => current.slides.length === 8 && current.slides[5].title === '');
  await outlineInput('slide:slides.5').focus();
  await oneStep('Backspace on an empty slide title removes the slide', async () => { await page.keyboard.press('Backspace'); },
    current => current.slides.length === 7 && current.slides.every(slide => slide.title !== ''));
  await settle();
  mark('the outline edits titles and text, moves, promotes and demotes, one undo step each');

  // --- accessibility ---------------------------------------------------------------------------------------------
  await load(source);
  await page.locator('#view-outline').click();
  const unnamed = await page.evaluate(() => [...document.querySelectorAll('#slide-list button, #slide-toolbar button, #outline-view button, #outline-view input, #view-switch button')].filter(node => {
    const name = node.getAttribute('aria-label') || node.textContent.trim() || [...(node.labels ?? [])].map(label => label.textContent).join('');
    return !name;
  }).map(node => node.outerHTML.slice(0, 100)));
  assert.deepEqual(unnamed, [], 'every control has an accessible name');
  assert.equal(await page.locator('#view-switch').getAttribute('role'), 'group');
  assert.equal(await page.locator('#view-switch').getAttribute('aria-label'), 'Slide view');
  assert.equal(await page.locator('#slide-toolbar').getAttribute('role'), 'toolbar');
  for (const region of await page.locator('.opf-slides-live, #outline-view [role="status"]').all()) assert.equal(await region.getAttribute('aria-live'), 'polite');
  await page.locator('#view-slide').click();
  const snapshot = await page.locator('#slide-list').ariaSnapshot();
  assert.match(snapshot, /Slide 1 of 6: Alpha/);
  assert.match(snapshot, /button "Intro, 2 slides"/);
  // The menu is a real menu: arrows move, Escape closes, and a dialog opened from a button returns focus on close.
  await card(2).focus();
  await page.keyboard.press('Shift+F10');
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('role')), 'menuitem');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowUp');
  assert.equal(await page.evaluate(() => document.activeElement.textContent.startsWith('Duplicate')), true);
  await page.keyboard.press('Escape');
  await page.locator('#add-layout').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.id.endsWith('layout-filter')), true, 'the layout dialog focuses its filter');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('dialog.opf-layout-dialog'));
  assert.equal(await page.evaluate(() => document.activeElement.id), 'add-layout', 'focus returns to the button that opened it');
  mark('accessibility: names, roles, live regions, menu and dialog focus');

  // --- split and merge (the content actions of RR-26) -------------------------------------------------------------
  await load({ name: 'Split and merge', design: { theme: 'classic', fontScheme: 'roboto' }, slides: [
    { id: 'multi', title: 'Many parts', blocks: [{ text: 'One' }, { text: 'Two' }, { items: ['a', 'b'] }] },
    { id: 'tail', title: 'Tail', text: 'The end' },
  ] });
  await card(0).click({ button: 'right' });
  assert.equal(await page.getByRole('menuitem', { name: 'Split slide into one slide per block' }).isEnabled(), true);
  await oneStep('Split slide into one slide per block', async () => { await page.getByRole('menuitem', { name: 'Split slide into one slide per block' }).click(); },
    current => current.slides.length === 4 && current.slides.at(-1).id === 'tail' && current.slides[0].title === 'Many parts',
    async () => { await waitLive(/Slide split into 3 slides/, 'announces the split'); assert.equal(await cards().count(), 4); });
  await card(0).click();
  await card(1).click({ modifiers: ['Shift'] });
  await card(1).click({ button: 'right' });
  await oneStep('Merge the selected slides into one', async () => { await page.getByRole('menuitem', { name: 'Merge 2 slides into one' }).click(); },
    current => current.slides.length === 3 && current.slides.at(-1).id === 'tail',
    async () => { await waitLive(/Merged 2 slides into one/, 'announces the merge'); });
  await card(0).click({ button: 'right' });
  await oneStep('Merge with next slide', async () => { await page.getByRole('menuitem', { name: 'Merge with next slide' }).click(); },
    current => current.slides.length === 2);
  mark('split and merge slides from the slide menu, one undo step each');

  // --- a plain deck has no section headers -----------------------------------------------------------------------
  await load(plainSource);
  assert.equal(await page.locator('#slide-list .slide-section').count(), 0);
  assert.equal(await page.locator('#slide-list').evaluate(node => [...node.children].every(child => child.classList.contains('slide-card'))), true, 'the navigator children are the cards');
  mark('a deck without sections shows none');

  assert.deepEqual(errors, []);
} catch (error) {
  if (process.env.SLIDES_DEBUG) { const pages = browser?.contexts()[0]?.pages(); await pages?.[0]?.screenshot({ path: 'artifacts/slides-fail.png' }); console.log('status:', await pages?.[0]?.locator('#status').textContent()); }
  throw error;
} finally {
  await browser?.close();
  server.close();
}
console.log(`RR-21 browser: ${checks.length} checks ok`);
