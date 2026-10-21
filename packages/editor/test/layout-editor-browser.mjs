import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import axe from 'axe-core';

// RR-99: the layout editor in the example harness, examples/layout-editor.html: every tool, drag, keyboard path and validation case,
// the inspector, undo, the deck functions, Preview, touch density and the parts arranged separately.
const root = fileURLToPath(new URL('../artifacts/playground/', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };
const server = createServer(async (req, res) => {
  try {
    const target = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403).end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] ?? 'application/octet-stream' }).end(await readFile(target));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
let browser;
try {
  browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const errors = [], requests = [];
  const open = async (query = '', viewport) => {
    const page = await context.newPage();
    if (viewport) await page.setViewportSize(viewport);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith(origin)) requests.push(request.url()); });
    await page.goto(`${origin}/layout-editor.html${query}`);
    await page.locator('.opf-lx-node').first().waitFor();
    return page;
  };
  const record = page => page.evaluate(() => demo.model.getRecord());
  const regions = async page => (await record(page)).regions;
  const selection = page => page.evaluate(() => demo.model.selection);
  const node = (page, key) => page.locator(`.opf-lx-node[data-path="${key}"]`);
  const point = async (page, key, fx = 0.5, fy = 0.5) => { const box = await node(page, key).boundingBox(); assert.ok(box, `node ${key} is drawn`); return { x: box.x + box.width * fx, y: box.y + box.height * fy }; };
  const clickNode = async (page, key, options = {}, fx, fy) => {
    const at = await point(page, key, fx, fy);
    const { modifiers = [], ...rest } = options;
    for (const key of modifiers) await page.keyboard.down(key);
    await page.mouse.click(at.x, at.y, rest);
    for (const key of modifiers) await page.keyboard.up(key);
  };
  const dividerAt = async (page, key) => { const box = await page.locator(`.opf-lx-divider[data-key="${key}"]`).boundingBox(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; };
  const row = (page, name) => page.getByRole('treeitem', { name }).first().locator('> .opf-lx-row');
  const tool = page => page.evaluate(() => demo.model.tool);
  const names = list => list.map(entry => entry.name ?? `${entry.direction}[${names(entry.regions)}]`);
  const canUndo = page => page.evaluate(() => demo.model.canUndo());
  const undo = page => page.evaluate(() => demo.model.undo());

  // 1. The palette: seven tools, their shortcuts, and the pressed state.
  {
    const page = await open('?layout=blank&render=0');
    const palette = page.getByRole('toolbar', { name: 'Layout tools' });
    const labels = await palette.getByRole('button').evaluateAll(buttons => buttons.map(button => [button.getAttribute('aria-label'), button.getAttribute('aria-keyshortcuts')]));
    assert.deepEqual(labels, [['Select', 'V'], ['Split into a row', 'R'], ['Split into a column', 'C'], ['Insert region', 'I'], ['Heading regions', 'T'], ['Hand', 'H'], ['Preview', 'P']]);
    assert.equal(await palette.getByRole('button', { name: 'Select' }).getAttribute('aria-pressed'), 'true');
    for (const [key, expected] of [['r', 'split-row'], ['c', 'split-column'], ['i', 'insert'], ['h', 'hand'], ['v', 'select']]) {
      await page.locator('.opf-lx-frame').focus();
      await page.keyboard.press(key);
      assert.equal(await tool(page), expected, `${key} chooses ${expected}`);
      assert.equal(await palette.locator(`[data-tool="${expected}"]`).getAttribute('aria-pressed'), 'true');
    }
    await palette.getByRole('button', { name: 'Split into a row' }).click();
    assert.equal(await tool(page), 'split-row', 'the palette button chooses the tool');
    await palette.getByRole('button', { name: 'Split into a row' }).click();
    assert.equal(await tool(page), 'select', 'choosing the active tool again returns to Select');
    // Arrow keys move along the toolbar (a roving tab stop).
    await palette.getByRole('button', { name: 'Select' }).focus();
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.tool), 'split-row');
    assert.equal(await page.locator('.opf-lx-palette [tabindex="0"]').count(), 1);
    // Preview (P): placeholder blocks per accepted kind; a wireframe without a renderer.
    await page.keyboard.press('p');
    assert.equal(await page.evaluate(() => demo.model.preview), true);
    assert.ok(await page.locator('.opf-lx-node[data-name="content"] .opf-lx-wire-block').count() >= 1, 'the wireframe shows blocks in a region');
    assert.equal(await page.locator('.opf-lx-render svg').count(), 0, 'no renderer: no drawing');
    await page.keyboard.press('p');
    assert.equal(await page.locator('.opf-lx-wire').count(), 0);
    await page.close();
  }

  // 2. Select: click, click again inside a split, Esc to the parent, Shift-click for siblings.
  {
    const page = await open('?layout=hero&render=0');
    await clickNode(page, '0');
    assert.deepEqual(await selection(page), [[0]]);
    await page.keyboard.press('Escape');
    assert.deepEqual(await selection(page), [], 'Esc from a top-level node selects the layout');
    // A split is selected (from the layers); the next click goes into it.
    await row(page, /Row split/).click();
    assert.deepEqual(await selection(page), [[1]]);
    assert.equal(await page.locator('.opf-lx-inspector-title, .opf-lx-panel-title').filter({ hasText: 'Split' }).count() >= 1, true, 'the inspector shows the split');
    await clickNode(page, '1.1', {}, 0.5, 0.5);
    assert.deepEqual(await selection(page), [[1, 1]], 'clicking again goes into the split');
    await page.keyboard.press('Escape');
    assert.deepEqual(await selection(page), [[1]], 'Esc selects the parent');
    await clickNode(page, '1.0');
    await clickNode(page, '1.1', { modifiers: ['Shift'] });
    assert.deepEqual(await selection(page), [[1, 0], [1, 1]], 'Shift-click adds a sibling');
    assert.equal(await page.getByText('2 selected').count(), 1);
    await clickNode(page, '2', { modifiers: ['Shift'] });
    assert.deepEqual(await selection(page), [[2]], 'a node from another list replaces the selection');
    await page.mouse.click((await page.locator('.opf-lx-frame').boundingBox()).x + 4, (await page.locator('.opf-lx-frame').boundingBox()).y + 4);
    assert.deepEqual(await selection(page), [], 'a click on the empty slide clears the selection');
    await page.close();
  }

  // 3. Split into a row (R) and into a column (C).
  {
    const page = await open('?layout=blank&render=0');
    await page.locator('.opf-lx-frame').focus();
    await page.keyboard.press('c');
    await clickNode(page, '1');
    let list = await regions(page);
    assert.deepEqual(names(list), ['title', 'content', 'region-1'], 'splitting a column across its own axis adds a sibling');
    assert.equal(list[1].size, 0.5);
    assert.equal(await tool(page), 'select', 'the tool returns to Select');
    assert.deepEqual(await selection(page), [[2]], 'the new region is selected');
    await page.keyboard.press('r');
    await clickNode(page, '1');
    list = await regions(page);
    assert.deepEqual(names(list), ['title', 'row[content,region-2]', 'region-1'], 'the original keeps its name and takes the other axis');
    assert.equal(list[1].size, 0.5, 'the split takes the region\'s share');
    assert.deepEqual(await selection(page), [[1, 1]]);
    // Keyboard: with a split tool active, Enter splits the selected region.
    await page.keyboard.press('r');
    await page.keyboard.press('Enter');
    assert.deepEqual(names((await regions(page))[1].regions), ['content', 'region-2', 'region-3']);
    // Undo steps back through the three edits.
    for (let n = 0; n < 3; n++) await undo(page);
    assert.deepEqual(names(await regions(page)), ['title', 'content']);
    assert.equal(await canUndo(page), false);
    await page.close();
  }

  // 4. Insert region (I): slots between siblings and at a split's edge.
  {
    const page = await open('?layout=hero&render=0');
    assert.equal(await page.locator('.opf-lx-slot').count(), 0, 'no slots until the tool is chosen');
    await page.locator('.opf-lx-frame').focus();
    await page.keyboard.press('i');
    const slots = page.locator('.opf-lx-slot');
    assert.equal(await slots.count(), 4 + 3, 'the layout list has four slots, the split three');
    assert.ok(await page.getByRole('button', { name: 'Insert a region between lead and media' }).count() === 1);
    await page.getByRole('button', { name: 'Insert a region between lead and media' }).click();
    const row = (await regions(page))[1];
    assert.deepEqual(names(row.regions), ['lead', 'region-1', 'media']);
    assert.equal(await tool(page), 'select');
    assert.deepEqual(await selection(page), [[1, 1]]);
    await page.keyboard.press('i');
    await page.getByRole('button', { name: 'Insert a region after support' }).click();
    assert.equal(names(await regions(page)).at(-1), 'region-2');
    await undo(page); await undo(page);
    assert.deepEqual(names(await regions(page)), ['title', 'row[lead,media]', 'support']);
    await page.close();
  }

  // 5. Heading regions (T): add and remove title and subtitle; without a title row the title is implicit.
  {
    const page = await open('?layout=blank&render=0');
    assert.equal(await page.locator('.opf-lx-implicit:not([hidden])').count(), 0, 'a title region: no implicit band');
    await page.locator('.opf-lx-frame').focus();
    await page.keyboard.press('t');
    const menu = page.getByRole('menu', { name: 'Heading regions' });
    await menu.waitFor();
    assert.equal(await menu.getByRole('menuitemcheckbox', { name: /Title region/ }).getAttribute('aria-checked'), 'true');
    assert.equal(await menu.getByRole('menuitemcheckbox', { name: /Subtitle region/ }).getAttribute('aria-checked'), 'false');
    await menu.getByRole('menuitemcheckbox', { name: /Subtitle region/ }).click();
    assert.deepEqual(names(await regions(page)), ['title', 'subtitle', 'content']);
    assert.equal(await tool(page), 'select');
    await page.keyboard.press('t');
    await page.getByRole('menuitemcheckbox', { name: /Title region/ }).click();
    assert.deepEqual(names(await regions(page)), ['content'], 'removing the title removes the subtitle too');
    assert.equal(await page.locator('.opf-lx-implicit:not([hidden])').count(), 1, 'without a title region the title row is shown as implicit');
    await page.keyboard.press('t');
    await page.keyboard.press('Escape');
    assert.equal(await tool(page), 'select', 'Esc closes the menu and returns to Select');
    assert.equal(await page.getByRole('menu').count(), 0);
    await page.close();
  }

  // 6. Hand (H, or hold Space): pan when zoomed.
  {
    const page = await open('?layout=blank&render=0');
    const viewport = page.locator('.opf-lx-viewport');
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.getByRole('button', { name: 'Zoom in' }).click();
    assert.equal(await page.locator('.opf-lx-zoom-label').textContent(), '200%');
    assert.ok(await viewport.evaluate(el => el.scrollWidth > el.clientWidth), 'a zoomed slide scrolls');
    const box = await viewport.boundingBox();
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.locator('.opf-lx-frame').focus();
    await page.keyboard.press('h');
    await page.mouse.move(centre.x, centre.y);
    await page.mouse.down();
    await page.mouse.move(centre.x - 120, centre.y - 40, { steps: 4 });
    await page.mouse.up();
    const panned = await viewport.evaluate(el => el.scrollLeft);
    assert.ok(panned > 80, `the Hand tool pans (${panned})`);
    assert.deepEqual(await selection(page), [], 'panning does not select');
    await page.keyboard.press('v');
    await viewport.evaluate(el => { el.scrollLeft = 0; });
    await page.locator('.opf-lx-frame').focus();
    await page.keyboard.down('Space');
    assert.equal(await page.locator('.opf-lx-canvas').getAttribute('data-space'), 'true');
    await page.mouse.move(centre.x, centre.y);
    await page.mouse.down();
    await page.mouse.move(centre.x - 100, centre.y, { steps: 4 });
    await page.mouse.up();
    await page.keyboard.up('Space');
    assert.ok(await viewport.evaluate(el => el.scrollLeft) > 60, 'holding Space pans');
    await page.getByRole('button', { name: 'Fit to screen' }).click();
    assert.equal(await page.locator('.opf-lx-zoom-label').textContent(), '100%');
    await page.close();
  }

  // 7. Dividers: drag to resize with snapping and a ratio label (one drag is one step), double-click to equalize, arrows on the separator.
  {
    const page = await open('?layout=row&render=0');
    const divider = page.locator('.opf-lx-divider[data-key="d::0"]');
    assert.equal(await divider.getAttribute('role'), 'separator');
    assert.equal(await divider.getAttribute('aria-orientation'), 'vertical');
    assert.equal(await divider.getAttribute('aria-valuenow'), '67');
    assert.equal(await divider.getAttribute('aria-valuetext'), '2 : 1');
    const frame = await page.locator('.opf-lx-content').boundingBox();
    const start = await dividerAt(page, 'd::0');
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(frame.x + frame.width * 0.76, start.y, { steps: 6 });
    assert.equal((await page.locator('.opf-lx-ratio').textContent()), '3 : 1', 'the ratio shows while dragging');
    assert.equal(await page.locator('.opf-lx-ratio').isVisible(), true);
    await page.mouse.move(frame.x + frame.width * 0.5, start.y, { steps: 6 });
    assert.equal((await page.locator('.opf-lx-ratio').textContent()), '1 : 1', 'it snaps to whole numbers');
    assert.equal(await canUndo(page), false, 'nothing is recorded until the drag ends');
    await page.mouse.move(frame.x + frame.width * 0.62, start.y, { steps: 6 });
    await page.mouse.up();
    assert.equal(await page.locator('.opf-lx-ratio').isVisible(), false);
    let list = await regions(page);
    assert.deepEqual(list.map(entry => entry.size), [5, 3], 'the nearest whole ratio is written');
    await undo(page);
    assert.equal(await canUndo(page), false, 'one drag is one undo step');
    assert.deepEqual((await regions(page)).map(entry => entry.size), [2, 1]);
    await page.evaluate(() => demo.model.redo());
    assert.ok((await regions(page))[0].size !== 2);
    // Escape cancels a drag.
    const again = await dividerAt(page, 'd::0');
    const before = JSON.stringify(await regions(page));
    await page.mouse.move(again.x, again.y);
    await page.mouse.down();
    await page.mouse.move(again.x + 150, again.y, { steps: 4 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    assert.equal(JSON.stringify(await regions(page)), before, 'Escape cancels the drag');
    // Double-click makes both sides equal.
    const there = await dividerAt(page, 'd::0');
    await page.mouse.dblclick(there.x, there.y);
    assert.deepEqual((await regions(page)).map(entry => entry.size), [undefined, undefined], 'equal sides, alone in the list: 1 : 1');
    // Keyboard: arrows resize, Enter equalizes.
    await divider.focus();
    await page.keyboard.press('ArrowRight');
    assert.deepEqual((await regions(page)).map(entry => entry.size), [1.5, 0.5]);
    assert.equal(await divider.getAttribute('aria-valuenow'), '75');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    assert.deepEqual((await regions(page)).map(entry => entry.size), [0.5, 1.5]);
    await page.keyboard.press('Enter');
    assert.deepEqual((await regions(page)).map(entry => entry.size), [undefined, undefined]);
    await page.close();
  }

  // 7b. A divider beside an auto size is not a share; columns resize vertically.
  {
    const page = await open('?layout=hero&render=0');
    assert.equal(await page.locator('.opf-lx-divider[data-fixed="true"]').count(), 1, 'the title row is auto: its divider is fixed');
    assert.equal(await page.locator('.opf-lx-divider[data-fixed="false"]').count(), 2);
    const vertical = page.locator('.opf-lx-divider[data-key="d:1:0"]');
    assert.equal(await vertical.getAttribute('aria-orientation'), 'vertical');
    const horizontal = page.locator('.opf-lx-divider[data-key="d::1"]');
    assert.equal(await horizontal.getAttribute('aria-orientation'), 'horizontal');
    assert.equal(await horizontal.getAttribute('aria-valuetext'), '2 : 1');
    await horizontal.focus();
    await page.keyboard.press('ArrowUp');
    assert.deepEqual((await regions(page)).slice(1).map(entry => entry.size), [1.5, 1.5], 'arrows move a horizontal separator by half a share');
    await page.close();
  }

  // 8. Drag to reorder and to move between splits, with drop indicators (one drag is one step).
  {
    const page = await open('?layout=hero&render=0');
    const media = await point(page, '1.1', 0.5, 0.5);
    const lead = await point(page, '1.0', 0.2, 0.5);
    await page.mouse.move(media.x, media.y);
    await page.mouse.down();
    await page.mouse.move(media.x - 40, media.y, { steps: 3 });
    await page.mouse.move(lead.x, lead.y, { steps: 6 });
    assert.equal(await page.locator('.opf-lx-drop').isVisible(), true, 'a drop indicator shows');
    assert.equal(await page.locator('.opf-lx-drop').getAttribute('data-state'), 'ok');
    assert.equal(await page.locator('.opf-lx-ghost').count(), 1);
    await page.mouse.up();
    assert.deepEqual(names((await regions(page))[1].regions), ['media', 'lead'], 'dropped before lead');
    assert.equal(await page.locator('.opf-lx-drop').isVisible(), false);
    await undo(page);
    assert.equal(await canUndo(page), false, 'one drag is one step');
    // Into another split: support moves into the row, after lead.
    const support = await point(page, '2');
    const target = await point(page, '1.0', 0.8, 0.5);
    await page.mouse.move(support.x, support.y);
    await page.mouse.down();
    await page.mouse.move(support.x, support.y - 30, { steps: 3 });
    await page.mouse.move(target.x, target.y, { steps: 8 });
    await page.mouse.up();
    assert.deepEqual(names(await regions(page)), ['title', 'row[lead,support,media]'], 'moved between splits');
    await undo(page);
    // Dropping a split into itself is refused with a reason; Escape cancels a drag.
    const row = await point(page, '1', 0.5, 0.5);
    const inside = await point(page, '1.1', 0.5, 0.5);
    await page.mouse.move(row.x, row.y);
    await page.mouse.down();
    await page.mouse.move(row.x + 5, row.y + 5, { steps: 2 });
    await page.mouse.move(inside.x, inside.y, { steps: 3 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    assert.deepEqual(names(await regions(page)), ['title', 'row[lead,media]', 'support']);
    assert.equal(await page.locator('.opf-lx-ghost').count(), 0);
    await page.close();
  }

  // 9. Delete: a split left with one child collapses into it.
  {
    const page = await open('?layout=hero&render=0');
    await clickNode(page, '1.0');
    await page.keyboard.press('Delete');
    assert.deepEqual(names(await regions(page)), ['title', 'media', 'support'], 'the one-child split collapsed');
    assert.equal((await regions(page))[1].size, 2, 'the child took the split\'s size');
    assert.deepEqual(await selection(page), [[1]], 'the region that took its place is selected');
    await undo(page);
    assert.deepEqual(names(await regions(page)), ['title', 'row[lead,media]', 'support']);
    // Backspace deletes too; the last region is refused.
    await clickNode(page, '2');
    await page.keyboard.press('Backspace');
    assert.deepEqual(names(await regions(page)), ['title', 'row[lead,media]']);
    const lone = await open('?layout=blank&render=0');
    await lone.evaluate(() => demo.editor.setRecord({ id: 'one', name: 'One', regions: [{ name: 'only' }] }));
    await clickNode(lone, '0');
    await lone.keyboard.press('Delete');
    assert.deepEqual(names(await regions(lone)), ['only']);
    assert.match(await lone.locator('.opf-lx-alert').textContent(), /at least one region/);
    await lone.close();
    await page.close();
  }

  // 10. The context menu: wrap in row or column, unwrap, duplicate, delete and rename.
  {
    const page = await open('?layout=hero&render=0');
    const at = await point(page, '1.0');
    await page.mouse.click(at.x, at.y, { button: 'right' });
    const menu = page.getByRole('menu', { name: 'Region actions' });
    await menu.waitFor();
    assert.deepEqual(await menu.getByRole('menuitem').allTextContents(), ['Wrap in row', 'Wrap in column', 'Unwrap', 'Duplicate⌘D'.replace('⌘', process.platform === 'darwin' ? '⌘' : 'Ctrl+'), 'Delete⌫', 'RenameF2']);
    assert.equal(await menu.getByRole('menuitem', { name: /Unwrap/ }).getAttribute('aria-disabled'), 'true', 'unwrap is for splits');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('menu').count(), 0, 'Escape closes the menu');
    await page.mouse.click(at.x, at.y, { button: 'right' });
    await menu.getByRole('menuitem', { name: 'Wrap in column' }).click();
    assert.deepEqual(names((await regions(page))[1].regions), ['column[lead]', 'media'], 'wrapped in a column');
    // The new split is selected; the keyboard opens the menu for it.
    assert.deepEqual(await selection(page), [[1, 0]]);
    await page.keyboard.press('Shift+F10');
    await menu.getByRole('menuitem', { name: /Unwrap/ }).click();
    assert.deepEqual(names((await regions(page))[1].regions), ['lead', 'media'], 'unwrapped');
    const lead = await point(page, '1.0');
    await page.mouse.click(lead.x, lead.y, { button: 'right' });
    await menu.getByRole('menuitem', { name: 'Wrap in row' }).click();
    assert.deepEqual(names((await regions(page))[1].regions), ['row[lead]', 'media']);
    await undo(page);
    await page.mouse.click(lead.x, lead.y, { button: 'right' });
    await menu.getByRole('menuitem', { name: /Duplicate/ }).click();
    assert.deepEqual(names((await regions(page))[1].regions), ['lead', 'lead-2', 'media']);
    assert.deepEqual(await selection(page), [[1, 1]]);
    await page.mouse.click((await point(page, '1.1')).x, (await point(page, '1.1')).y, { button: 'right' });
    await menu.getByRole('menuitem', { name: /Rename/ }).click();
    const input = page.getByRole('textbox', { name: 'Rename lead-2' });
    await input.waitFor();
    await page.keyboard.press(`${mod}+a`);
    await page.keyboard.type('sidebar');
    await page.keyboard.press('Enter');
    assert.deepEqual(names((await regions(page))[1].regions), ['lead', 'sidebar', 'media'], 'renamed in place');
    assert.equal(await page.getByRole('textbox', { name: /Rename/ }).count(), 0);
    await page.mouse.click((await point(page, '1.1')).x, (await point(page, '1.1')).y, { button: 'right' });
    await menu.getByRole('menuitem', { name: /Delete/ }).click();
    assert.deepEqual(names((await regions(page))[1].regions), ['lead', 'media']);
    // Double-click renames, and Escape keeps the name.
    await page.mouse.dblclick(lead.x, lead.y);
    await page.getByRole('textbox', { name: 'Rename lead' }).waitFor();
    await page.keyboard.type('zzz');
    await page.keyboard.press('Escape');
    assert.equal((await regions(page))[1].regions[0].name, 'lead');
    // The keyboard opens the menu too.
    await clickNode(page, '1.0');
    await page.keyboard.press('Shift+F10');
    await menu.waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.path), '1.0', 'focus returns to the region');
    await page.close();
  }

  // 11. The inspector: layout, split and region fields.
  {
    const page = await open('?layout=hero&render=0');
    const inspector = page.locator('.opf-lx-inspector');
    // Layout: id, name, summary, direction, anchor, overflow region and design hints.
    for (const label of ['Id', 'Name', 'Summary', 'Anchor', 'Overflow region']) assert.equal(await inspector.getByLabel(label, { exact: true }).count(), 1, label);
    assert.equal(await inspector.getByRole('group', { name: 'Direction' }).count(), 1);
    await inspector.getByLabel('Name', { exact: true }).fill('Hero copy 2');
    assert.equal((await record(page)).name, 'Hero copy 2');
    await inspector.getByLabel('Id', { exact: true }).fill('hero-2');
    assert.equal((await record(page)).id, 'hero-2');
    await inspector.getByLabel('Anchor', { exact: true }).selectOption('bottom');
    assert.equal((await record(page)).anchor, 'bottom');
    await inspector.getByLabel('Overflow region', { exact: true }).selectOption('support');
    assert.equal((await record(page)).overflowRegion, 'support');
    assert.deepEqual(await inspector.getByLabel('Overflow region', { exact: true }).locator('option').allTextContents(), ['Default · the first primary region', 'lead', 'media', 'support'], 'the picker lists the body regions');
    await inspector.getByRole('button', { name: 'Row', exact: true }).click();
    assert.equal((await record(page)).direction, 'row');
    await inspector.getByRole('button', { name: 'Column', exact: true }).click();
    assert.deepEqual(await inspector.locator('.opf-lx-hint-key').allTextContents(), ['imageFit'], 'design hints are listed');
    await inspector.getByRole('button', { name: 'Remove the imageFit design hint' }).click();
    assert.equal((await record(page)).design, undefined);
    // A split: direction, size and anchor.
    await row(page, /Row split/).click();
    assert.equal(await inspector.getByRole('button', { name: 'Auto' }).count(), 1, 'the split sits in a column: auto is offered');
    await inspector.getByRole('group', { name: 'Direction' }).getByRole('button', { name: 'Column' }).click();
    assert.equal((await regions(page))[1].direction, 'column');
    await inspector.getByRole('group', { name: 'Direction' }).getByRole('button', { name: 'Row' }).click();
    await inspector.getByLabel('Anchor', { exact: true }).selectOption('top');
    assert.equal((await regions(page))[1].anchor, 'top');
    // A region in a row: no auto. Name with unique-name validation.
    await row(page, /^lead/).click();
    assert.equal(await inspector.getByRole('button', { name: 'Auto' }).count(), 0, 'auto is offered only in a column parent');
    assert.equal(await inspector.getByLabel('Anchor', { exact: true }).locator('option').first().textContent(), 'Inherited · top (from the split)', 'an inherited anchor is shown as inherited');
    assert.equal(await inspector.getByLabel('Anchor', { exact: true }).inputValue(), '');
    await inspector.getByLabel('Size', { exact: true }).fill('3');
    assert.equal((await regions(page))[1].regions[0].size, 3);
    await inspector.getByLabel('Size', { exact: true }).fill('0');
    assert.match(await inspector.locator('.opf-lx-size-error').textContent(), /above 0/);
    assert.equal((await regions(page))[1].regions[0].size, 3, 'an invalid size is not committed');
    await inspector.getByLabel('Size', { exact: true }).fill('');
    assert.equal((await regions(page))[1].regions[0].size, undefined);
    await inspector.getByLabel('Name', { exact: true }).fill('media');
    assert.match(await inspector.locator('[data-field-name="name"] .opf-lx-field-error').textContent(), /used twice/, 'a repeated name is a finding under the field');
    assert.equal(await inspector.getByLabel('Name', { exact: true }).getAttribute('aria-invalid'), 'true');
    await inspector.getByLabel('Name', { exact: true }).fill('lead');
    assert.equal(await inspector.locator('.opf-lx-field-error:not([hidden])').count(), 0);
    // accepts chips: none means all.
    assert.equal(await inspector.getByRole('button', { name: 'text', exact: true }).getAttribute('aria-pressed'), 'true');
    await inspector.getByRole('button', { name: 'text', exact: true }).click();
    await inspector.getByRole('button', { name: 'quote', exact: true }).click();
    await inspector.getByRole('button', { name: 'metric', exact: true }).click();
    assert.equal((await regions(page))[1].regions[0].accepts, undefined, 'every chip off: the key is gone');
    assert.match(await inspector.locator('.opf-lx-help').filter({ hasText: 'Every kind' }).textContent(), /Every kind/);
    await inspector.getByRole('button', { name: 'table', exact: true }).click();
    assert.deepEqual((await regions(page))[1].regions[0].accepts, ['table']);
    // role, flow, max, bleed, listColumns, empty.
    await inspector.getByLabel('Role', { exact: true }).selectOption('media');
    await inspector.getByLabel('Flow', { exact: true }).selectOption('grid');
    await inspector.getByLabel('Max blocks', { exact: true }).fill('4');
    await inspector.getByLabel('Bleed to the slide edge').check();
    await inspector.getByLabel('List columns', { exact: true }).selectOption('auto');
    await inspector.getByLabel('When empty', { exact: true }).selectOption('keep');
    await inspector.getByLabel('Anchor', { exact: true }).selectOption('bottom');
    assert.deepEqual((await regions(page))[1].regions[0], { name: 'lead', accepts: ['table'], role: 'media', flow: 'grid', max: 4, bleed: true, listColumns: 'auto', anchor: 'bottom', empty: 'keep' });
    // A region in a column: auto is offered, and sets the size.
    await row(page, /^support/).click();
    await inspector.getByRole('button', { name: 'Auto' }).click();
    assert.equal((await regions(page))[2].size, 'auto');
    assert.equal(await inspector.getByLabel('Size', { exact: true }).isDisabled(), true);
    await inspector.getByRole('button', { name: 'Auto' }).click();
    assert.equal((await regions(page))[2].size, undefined);
    // Heading regions take only a size.
    await row(page, /^title/).click();
    assert.equal(await inspector.getByLabel('Role', { exact: true }).count(), 0);
    assert.equal(await inspector.getByLabel('Size', { exact: true }).count(), 1);
    // Actions.
    await row(page, /^support/).click();
    await inspector.getByRole('button', { name: 'Split into a row' }).click();
    assert.equal(names(await regions(page)).at(-1), 'row[support,region-1]');
    await inspector.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.close();
  }

  // 12. Live validation: core's findings, on the canvas, in the layers and the inspector.
  {
    const page = await open('?layout=broken&render=0');
    const findings = await page.evaluate(() => demo.model.findings.map(finding => [finding.ruleId, finding.node, finding.field]));
    assert.deepEqual(findings.sort(), [['opf/layout-region', [1], 'name'], ['opf/layout-template', [2], 'size']].sort());
    assert.equal(await node(page, '1').getAttribute('data-finding'), 'error', 'the region is highlighted on the canvas');
    assert.equal(await node(page, '2').getAttribute('data-finding'), 'error');
    assert.equal(await node(page, '0').getAttribute('data-finding'), 'error', 'the first of two regions with one name is part of the finding');
    assert.equal(await page.locator('.opf-lx-row[data-finding="error"]').count(), 3, 'and in the layers panel');
    assert.equal(await page.locator('.opf-lx-findings-list button').count(), 2);
    assert.match(await page.locator('.opf-lx-findings-list').textContent(), /opf\/layout-region/);
    assert.match(await page.locator('.opf-lx-validity').textContent(), /2 findings/);
    // A finding is a way in: it selects the node.
    await page.locator('.opf-lx-findings-list button').filter({ hasText: 'used twice' }).click();
    assert.deepEqual(await selection(page), [[1]]);
    const inspector = page.locator('.opf-lx-inspector');
    assert.match(await inspector.locator('[data-field-name="name"] .opf-lx-field-error').textContent(), /used twice/);
    await inspector.getByLabel('Name', { exact: true }).fill('a2');
    assert.equal(await page.locator('.opf-lx-findings-list button').count(), 1, 'a fix removes the finding live');
    await row(page, /^b/).click();
    assert.equal(await inspector.getByRole('button', { name: 'Auto', exact: true }).getAttribute('aria-pressed'), 'true', 'an auto in a row is shown, and can be cleared');
    await inspector.getByRole('button', { name: 'Auto', exact: true }).click();
    assert.equal(await page.locator('.opf-lx-findings-list').isHidden(), true);
    assert.match(await page.locator('.opf-lx-validity').textContent(), /Valid/);
    await undo(page); await undo(page);
    assert.equal(await page.locator('.opf-lx-findings-list button').count(), 2, 'undo brings the findings back');
    // Operations that would break the layout are refused instead: depth.
    const deep = await open('?layout=blank&render=0');
    await deep.evaluate(() => demo.editor.setRecord({ id: 'deep', name: 'Deep', direction: 'row', regions: [{ direction: 'column', regions: [{ direction: 'row', regions: [{ name: 'x' }, { name: 'y' }] }] }] }));
    await clickNode(deep, '0.0.0');
    await deep.keyboard.press('c');
    await clickNode(deep, '0.0.0');
    assert.match(await deep.locator('.opf-lx-alert').textContent(), /nest at most 3/);
    assert.deepEqual((await record(deep)).regions[0].regions[0].regions.length, 2);
    await deep.close();
    await page.close();
  }

  // 13. History: Cmd/Ctrl+Z and Shift+Z, typing coalesces, setRecord resets.
  {
    const page = await open('?layout=hero&render=0');
    await clickNode(page, '2');
    await page.keyboard.press('Delete');
    assert.deepEqual(names(await regions(page)), ['title', 'row[lead,media]']);
    await page.keyboard.press(`${mod}+z`);
    assert.deepEqual(names(await regions(page)), ['title', 'row[lead,media]', 'support']);
    await page.keyboard.press(`${mod}+Shift+z`);
    assert.deepEqual(names(await regions(page)), ['title', 'row[lead,media]']);
    await page.getByRole('button', { name: 'Undo' }).click();
    assert.equal(await page.getByRole('button', { name: 'Undo' }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Redo' }).isEnabled(), true);
    // Typing a name is one step.
    await clickNode(page, '2');
    await page.getByLabel('Name', { exact: true }).fill('');
    await page.getByLabel('Name', { exact: true }).pressSequentially('closing');
    assert.equal((await regions(page))[2].name, 'closing');
    await page.locator('.opf-lx-frame').focus();
    await page.keyboard.press(`${mod}+z`);
    assert.equal((await regions(page))[2].name, 'support', 'a typed name is one undo step');
    // Undo does not take over text fields: the browser's own undo applies there.
    await page.close();
  }

  // 14. Keyboard: arrows between siblings, Enter into a split, Esc up, [ and ] to reorder, Cmd/Ctrl+D to duplicate.
  {
    const page = await open('?layout=hero&render=0');
    await page.locator('.opf-lx-frame').focus();
    await page.keyboard.press('ArrowRight');
    assert.deepEqual(await selection(page), [[0]], 'the first arrow selects the first node');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    assert.deepEqual(await selection(page), [[2]]);
    await page.keyboard.press('ArrowDown');
    assert.deepEqual(await selection(page), [[2]], 'the end of the list');
    await page.keyboard.press('ArrowUp');
    assert.deepEqual(await selection(page), [[1]]);
    assert.equal(await page.evaluate(() => document.activeElement.dataset.path), '1', 'DOM focus follows');
    await page.keyboard.press('Enter');
    assert.deepEqual(await selection(page), [[1, 0]], 'Enter goes into a split');
    await page.keyboard.press('ArrowRight');
    assert.deepEqual(await selection(page), [[1, 1]]);
    await page.keyboard.press('[');
    assert.deepEqual(names((await regions(page))[1].regions), ['media', 'lead'], '[ moves earlier');
    assert.deepEqual(await selection(page), [[1, 0]]);
    await page.keyboard.press('[');
    assert.deepEqual(names(await regions(page)), ['title', 'media', 'lead', 'support'], '[ at the start of a split leaves it, and the one-child split collapses');
    await page.keyboard.press(']');
    await page.keyboard.press(']');
    assert.deepEqual(names(await regions(page)), ['title', 'lead', 'support', 'media'], '] moves later');
    await page.keyboard.press(`${mod}+d`);
    assert.ok(names(await regions(page)).includes('media-2'), 'Cmd/Ctrl+D duplicates');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.path !== undefined), true);
    await page.keyboard.press('Escape');
    assert.deepEqual(await selection(page), []);
    // The keyboard shortcuts of a tool also work from the layers.
    await page.getByRole('treeitem', { name: /^title/ }).focus();
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('role')), 'treeitem');
    await page.close();
  }

  // 14b. The layers: role="tree", keyboard, rename, drag.
  {
    const page = await open('?layout=hero&render=0');
    const tree = page.getByRole('tree', { name: 'Layout layers' });
    assert.equal(await tree.getByRole('treeitem').count(), 6, 'layout, title, split, lead, media, support');
    assert.deepEqual(await tree.getByRole('treeitem').evaluateAll(items => items.map(item => item.getAttribute('aria-level'))), ['1', '2', '2', '3', '3', '2']);
    assert.equal(await page.locator('.opf-lx-tree [tabindex="0"]').count(), 1, 'one tab stop');
    await tree.getByRole('treeitem', { name: /^title/ }).focus();
    await page.keyboard.press('ArrowDown');
    assert.deepEqual(await selection(page), [[1]], 'selection follows focus');
    await page.keyboard.press('ArrowRight');
    assert.deepEqual(await selection(page), [[1, 0]]);
    await page.keyboard.press('ArrowLeft');
    assert.deepEqual(await selection(page), [[1]]);
    await page.keyboard.press('ArrowLeft');
    assert.equal(await tree.getByRole('treeitem', { name: /Row split/ }).getAttribute('aria-expanded'), 'false', 'Left collapses');
    assert.equal(await tree.getByRole('treeitem').count(), 4);
    await page.keyboard.press('ArrowRight');
    assert.equal(await tree.getByRole('treeitem').count(), 6);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('F2');
    await page.getByRole('textbox', { name: 'Rename lead' }).fill('opening');
    await page.keyboard.press('Enter');
    assert.equal((await regions(page))[1].regions[0].name, 'opening');
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('role')), 'treeitem', 'focus returns to the row');
    await page.keyboard.press(']');
    assert.deepEqual(names((await regions(page))[1].regions), ['media', 'opening']);
    await page.keyboard.press(`${mod}+d`);
    assert.ok(names((await regions(page))[1].regions).includes('opening-2'));
    await page.keyboard.press('Delete');
    assert.deepEqual(names((await regions(page))[1].regions), ['media', 'opening']);
    // Drag a row onto another: support moves into the split.
    const support = await tree.getByRole('treeitem', { name: /^support/ }).locator('> .opf-lx-row').boundingBox();
    const split = await tree.getByRole('treeitem', { name: /Row split/ }).locator('> .opf-lx-row').boundingBox();
    await page.mouse.move(support.x + 60, support.y + support.height / 2);
    await page.mouse.down();
    await page.mouse.move(support.x + 60, support.y - 10, { steps: 3 });
    await page.mouse.move(split.x + 60, split.y + split.height / 2, { steps: 5 });
    assert.equal(await page.locator('.opf-lx-tree-drop').isVisible(), true);
    await page.mouse.up();
    assert.deepEqual(names(await regions(page)), ['title', 'row[media,opening,support]'], 'dragged into the split in the layers panel');
    await undo(page);
    // Right-click in the layers opens the same menu.
    await tree.getByRole('treeitem', { name: /^support/ }).locator('> .opf-lx-row').click({ button: 'right' });
    await page.getByRole('menu', { name: 'Layer actions' }).waitFor();
    await page.keyboard.press('Escape');
    await page.close();
  }

  // 15. The API: getRecord, setRecord, onChange, saveToDeck and applyToSlide.
  {
    const page = await open('?layout=hero&render=0');
    await page.evaluate(() => { demo.log.length = 0; });
    assert.equal((await record(page)).id, 'hero-copy');
    await clickNode(page, '2');
    await page.keyboard.press('Delete');
    assert.deepEqual(await page.evaluate(() => demo.log.map(entry => entry.change)), ['Hero copy'], 'onChange runs after an edit');
    await page.evaluate(() => demo.editor.setRecord(demo.records.row));
    assert.deepEqual(await page.evaluate(() => demo.log.length), 1, 'setRecord does not call onChange');
    assert.equal(await page.evaluate(() => demo.editor.canUndo()), false, 'and clears the history');
    assert.deepEqual(names(await regions(page)), ['main', 'aside']);
    await page.getByRole('button', { name: 'Save to deck' }).click();
    assert.match(await page.locator('#result').textContent(), /^ok · story/);
    const deck = await page.evaluate(() => demo.session.presentation);
    assert.deepEqual(deck.catalogs.custom.layouts.story, { name: 'Story and evidence', direction: 'row', regions: [{ name: 'main', size: 2, accepts: ['text'] }, { name: 'aside', size: 1, accepts: ['metric'] }] }, 'the record is written without $schema and id');
    await page.getByRole('button', { name: 'Save to deck', exact: true }).click();
    assert.match(await page.locator('#result').textContent(), /layout-exists/, 'an id the deck has is refused');
    await page.getByRole('button', { name: 'Save replacing' }).click();
    assert.match(await page.locator('#result').textContent(), /^ok/);
    await page.getByRole('button', { name: 'Apply to slide 1' }).click();
    assert.match(await page.locator('#result').textContent(), /^ok · story/);
    assert.deepEqual(await page.evaluate(() => demo.session.presentation.slides.map(slide => slide.layout ?? null)), ['story', null]);
    // Saving and applying are single undoable edits on the session.
    await page.evaluate(() => demo.session.undo());
    assert.deepEqual(await page.evaluate(() => demo.session.presentation.slides.map(slide => slide.layout ?? null)), [null, null], 'apply is one undo step');
    assert.ok(await page.evaluate(() => Boolean(demo.session.presentation.catalogs.custom.layouts.story)), 'the saved layout remains');
    // A layout with a finding is not saved.
    await page.evaluate(() => demo.editor.setRecord(demo.records.broken));
    await page.getByRole('button', { name: 'Save to deck', exact: true }).click();
    assert.match(await page.locator('#result').textContent(), /layout-invalid: Fix the findings/);
    // The headless editor-side checks: bad input.
    assert.equal(await page.evaluate(() => { try { demo.editor.setRecord({ id: 'x' }); } catch (error) { return error.constructor.name; } }), 'TypeError');
    await page.close();
  }

  // 16. Preview with the host's renderer.
  {
    const page = await open('?layout=hero');
    await page.locator('.opf-lx-frame').focus();
    await page.keyboard.press('p');
    await page.locator('.opf-lx-canvas[data-rendered="true"] .opf-lx-render svg').waitFor({ timeout: 20000 });
    assert.ok((await page.locator('.opf-lx-render svg').innerHTML()).length > 500, 'the renderer drew the sample slide');
    assert.equal(await page.locator('.opf-lx-wire:visible').count(), 0, 'the drawing replaces the wireframe');
    await clickNode(page, '1.0');
    await page.getByLabel('Name', { exact: true }).fill('opening');
    await page.waitForFunction(() => document.querySelector('.opf-lx-render svg')?.textContent.includes('Quarterly operating plan'));
    // A layout with a finding falls back to the wireframe.
    await page.evaluate(() => demo.editor.setRecord(demo.records.broken));
    await page.waitForFunction(() => document.querySelector('.opf-lx-canvas').dataset.rendered === 'false');
    assert.ok(await page.locator('.opf-lx-wire:visible').count() > 0);
    await page.close();
  }

  // 16b. The region chips sit outside the boxes, so they never cover content: not the rendered text of the sample slide, not the
  // wireframe blocks, not each other; at comfortable and touch density, in light and dark.
  {
    const overlaps = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
    const rects = (page, selector) => page.evaluate(selector => [...document.querySelectorAll(selector)].filter(el => { const box = el.getBoundingClientRect(); return box.width > 0 && box.height > 0; }).map(el => { const box = el.getBoundingClientRect(); return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, text: (el.dataset?.text ?? el.textContent ?? '').slice(0, 30) }; }), selector);
    const apart = (list, others, what) => { for (const a of list) for (const b of others) if (a !== b) assert.ok(!overlaps(a, b), `${what}: chip "${a.text}" meets "${b.text}"`); };
    for (const dark of [false, true]) {
      const page = await open(`?layout=hero${dark ? '&dark=1' : ''}`, { width: 1440, height: 900 });
      await page.locator('.opf-lx-frame').focus();
      await page.keyboard.press('p');
      await page.locator('.opf-lx-canvas[data-rendered="true"] .opf-lx-render svg').waitFor({ timeout: 20000 });
      await clickNode(page, '1.0');
      const chips = await rects(page, '.opf-lx-label');
      assert.equal(chips.length, 5, 'a chip for each region and the split');
      const text = await rects(page, '.opf-lx-render svg text');
      assert.ok(text.length >= 4, `the sample slide has text boxes (${text.length})`);
      apart(chips, text, `rendered ${dark ? 'dark' : 'light'}`);
      apart(chips, chips, 'chips');
      // Each chip sits above its box, not inside it.
      const placed = await page.evaluate(() => [...document.querySelectorAll('.opf-lx-node')].map(node => { const chip = node.firstElementChild.getBoundingClientRect(), box = node.getBoundingClientRect(); return chip.bottom <= box.top + 2; }));
      assert.ok(placed.every(Boolean), 'every chip is outside the top edge of its box');
      await page.keyboard.press('p');
      await page.locator('.opf-lx-frame').focus();
      await page.keyboard.press('p');
      await page.close();
    }
    for (const [viewport, query] of [[{ width: 1440, height: 900 }, '?layout=hero&render=0'], [{ width: 390, height: 844 }, '?layout=hero&render=0&density=touch'], [{ width: 1440, height: 900 }, '?layout=hero&render=0&density=touch&dark=1']]) {
      const page = await open(query, viewport);
      await page.locator('.opf-lx-frame').focus();
      await page.keyboard.press('p');
      await page.locator('.opf-lx-wire-block').first().waitFor();
      const chips = await rects(page, '.opf-lx-label');
      apart(chips, await rects(page, '.opf-lx-wire-block, .opf-lx-bar'), `wireframe ${query}`);
      apart(chips, chips, `chips ${query}`);
      await page.close();
    }
  }

  // 17. Touch density: controls are 40px.
  {
    const page = await open('?layout=hero&density=touch&render=0', { width: 390, height: 844 });
    assert.equal(await page.locator('.opf-lx').getAttribute('data-compact'), 'true', 'a narrow container stacks the panels');
    const heights = await page.locator('.opf-lx-tool').evaluateAll(buttons => buttons.map(button => Math.round(button.getBoundingClientRect().height)));
    assert.ok(heights.every(height => height >= 40), `palette buttons are 40px (${heights})`);
    assert.ok((await page.getByRole('tab', { name: 'Layers' }).boundingBox()).height >= 40);
    // The panels are tabs under the canvas.
    assert.equal(await page.locator('.opf-lx-inspector').isVisible(), true);
    assert.equal(await page.locator('.opf-lx-layers').isVisible(), false);
    await page.getByRole('tab', { name: 'Layers' }).click();
    assert.equal(await page.locator('.opf-lx-layers').isVisible(), true);
    assert.equal(await page.locator('.opf-lx-inspector').isVisible(), false);
    // A touch tap selects; a divider has a wide target.
    const tap = await point(page, '2');
    await page.touchscreen.tap(tap.x, tap.y).catch(async () => { await page.mouse.click(tap.x, tap.y); });
    const divider = await page.locator('.opf-lx-divider[data-fixed="false"]').first().evaluate(el => { const style = getComputedStyle(el, '::before'); return [style.top, style.bottom, style.left, style.right]; });
    assert.ok(divider.some(value => parseFloat(value) <= -12), `a wide hit area (${divider})`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 0, `no horizontal page scroll (${overflow})`);
    await page.close();
  }

  // 18. The parts arranged separately around one model.
  {
    const page = await open('?layout=hero&parts=1&render=0');
    assert.equal(await page.locator('.opf-layout-editor').count(), 0, 'no composed editor');
    assert.equal(await page.getByRole('toolbar', { name: 'Layout tools' }).getAttribute('aria-orientation'), 'horizontal');
    await row(page, /^media/).click();
    assert.equal(await node(page, '1.1').getAttribute('aria-pressed'), 'true', 'the canvas follows the layers');
    assert.equal(await page.getByLabel('Name', { exact: true }).inputValue(), 'media', 'and so does the inspector');
    await page.getByLabel('Name', { exact: true }).fill('picture');
    assert.equal(await page.getByRole('treeitem', { name: /^picture/ }).count(), 1);
    assert.equal(await node(page, '1.1').getAttribute('data-name'), 'picture');
    await page.getByRole('button', { name: 'Save to deck' }).click();
    assert.match(await page.locator('#result').textContent(), /^ok · hero-copy/, 'the deck functions work on the shared model');
    await page.close();
  }

  // 19. Accessibility: axe on the composed editor, light and dark.
  for (const query of ['?layout=hero&render=0', '?layout=hero&render=0&dark=1', '?layout=broken&render=0']) {
    const page = await open(query);
    await clickNode(page, query.includes('broken') ? '1' : '1.0');
    await page.evaluate(axe.source);
    const result = await page.evaluate(async () => (await axe.run(document.querySelector('.opf-lx'), { rules: { 'color-contrast': { enabled: true } } })).violations.map(violation => ({ id: violation.id, nodes: violation.nodes.map(node => node.html.slice(0, 120)) })));
    assert.deepEqual(result, [], `axe ${query}: ${JSON.stringify(result)}`);
    await page.close();
  }

  assert.deepEqual(requests, [], 'the editor makes no network request');
  assert.deepEqual(errors, [], 'no page errors');
  console.log('layout editor: tools, canvas drags, keyboard, inspector, validation, history, deck functions, preview, touch and parts passed');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
