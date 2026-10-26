import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import axe from 'axe-core';

// CE-18, the studio kit in a browser, against the kit API only (no layout record, no deck): the DOM helpers and the menu, the keyed overlay
// with its badges, dividers, drop line, ratio and markers, the viewport with real wheel, Space-drag and synthetic two-finger pinch events,
// the drag controller with a real mouse, the layers tree by keyboard, and the inspector frame (sections by selection, typing keeps focus,
// findings under fields). The page imports dist/studio-kit/ as it is: the kit has no dependencies. Layout Studio's own suites
// (layout-editor-browser and the others) prove the kit behaves as Layout Studio did.
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const HARNESS = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Studio kit</title><style>
  body { margin: 0; font: 14px system-ui; }
  #viewport { width: 400px; height: 300px; overflow: auto; position: relative; }
  #stage { width: calc(400px * var(--opf-kit-zoom, 1)); height: calc(300px * var(--opf-kit-zoom, 1)); position: relative; background: #eef; }
  #frame { position: absolute; inset: 0; }
  #layer > *, .opf-kit-drop, .opf-kit-ratio, .opf-kit-cut { position: absolute; }
  #host { position: relative; width: 400px; height: 200px; }
  .opf-kit-menu { position: absolute; }
  /* As in the studios, a drag never selects text: a selection left by one drag makes the next press start the browser's own drag and drop
     of that text (it takes the pointer, so the page sees pointercancel and no more moves). */
  #list { user-select: none; -webkit-user-select: none; }
  #list li { height: 24px; }
</style></head><body>
<main>
  <h1>Studio kit</h1>
  <div id="viewport"><div id="stage"><div id="frame"><div id="layer"></div><div id="marks"></div></div></div></div>
  <div id="host"></div>
  <ul id="list" aria-label="Drag list"><li data-id="a">a</li><li data-id="b">b</li><li data-id="c">c</li></ul>
  <ul id="tree" role="tree" aria-label="Layers"></ul>
  <section id="inspector" aria-label="Inspector"><div id="body"></div></section>
</main>
<script type="module">
  import * as kit from "/studio-kit/index.js";
  window.kit = kit;
  window.ready = true;
</script></body></html>`;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (pathname === '/harness.html') { res.writeHead(200, { 'Content-Type': 'text/html' }).end(HARNESS); return; }
  try {
    const target = path.resolve(dist, '.' + pathname);
    const relative = path.relative(dist, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403).end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] ?? 'application/octet-stream' }).end(await readFile(target));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
  const page = await (await browser.newContext({ viewport: { width: 1000, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`${origin}/harness.html`);
  await page.waitForFunction(() => window.ready === true);

  // 1. DOM helpers and the menu: the prefix, the icon, the button; arrow keys skip disabled items; Enter chooses; Escape returns focus.
  {
    const shape = await page.evaluate(() => {
      const dom = kit.createDom(document, { prefix: 'opf-test' });
      const button = dom.button('opf-test-b', { label: 'Zoom in', iconName: 'ZoomIn' });
      const text = dom.button('opf-test-b', { text: 'Undo', iconName: 'Undo2' });
      return { icon: button.querySelector('svg').getAttribute('class'), label: button.getAttribute('aria-label'), title: button.title, text: text.querySelector('span').className, el: dom.el('p', 'x', { text: 'hi', hidden: false, 'data-a': 1 }).outerHTML };
    });
    assert.deepEqual(shape, { icon: 'opf-test-icon opf-test-icon-zoomin', label: 'Zoom in', title: 'Zoom in', text: 'opf-test-button-text', el: '<p class="x" data-a="1">hi</p>' });
    await page.evaluate(() => {
      const dom = kit.createDom(document);
      const opener = dom.button('opener', { text: 'Open' });
      document.getElementById('host').append(opener);
      opener.focus();
      window.chosen = [];
      window.menu = kit.openMenu(dom, document.getElementById('host'), { x: 20, y: 20, label: 'Actions', returnFocus: opener, items: [
        { label: 'Cut', onSelect: () => chosen.push('cut') }, { label: 'Paste', disabled: true }, { label: 'Delete', hint: '⌫', onSelect: () => chosen.push('delete') },
      ] });
    });
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Cut', 'the first item has focus');
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Delete⌫', 'a disabled item is skipped');
    await page.keyboard.press('Home');
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    assert.deepEqual(await page.evaluate(() => [chosen, document.querySelector('.opf-kit-menu'), document.activeElement.className]), [['delete'], null, 'opener'], 'Enter chose Delete, closed the menu and returned focus');
    await page.evaluate(() => { window.menu = kit.openMenu(kit.createDom(document), document.getElementById('host'), { x: 0, y: 0, label: 'Again', returnFocus: document.querySelector('.opener'), items: [{ label: 'One' }] }); });
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => [document.querySelector('.opf-kit-menu'), document.activeElement.className].join('|')), '|opener');
  }

  // 2. The overlay: keyed boxes keep their element (and focus) across a redraw; stale ones go; badges, dividers, drop line, ratio, guide, markers.
  {
    const result = await page.evaluate(() => {
      const dom = kit.createDom(document);
      const layer = document.getElementById('layer');
      const keyed = kit.createKeyedLayer(layer);
      const draw = (keys) => { const pass = keyed.begin(); for (const key of keys) { const node = pass.ensure(key, () => dom.el('div', 'box', { 'data-key': key })); kit.paintSelectable(node, { box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 }, selected: key === 'b', pressable: key !== 'c', label: `Box ${key}`, tabStop: key === 'b' }); } pass.done(); };
      draw(['a', 'b', 'c']);
      const b = layer.querySelector('[data-key="b"]');
      b.focus();
      draw(['c', 'b']);
      const after = { order: [...layer.children].map((node) => node.dataset.key), same: layer.querySelector('[data-key="b"]') === b, focused: document.activeElement === b };
      const attrs = { role: b.getAttribute('role'), pressed: b.getAttribute('aria-pressed'), label: b.getAttribute('aria-label'), tab: b.tabIndex, selected: b.classList.contains('is-selected'), left: b.style.left, width: b.style.width };
      const c = layer.querySelector('[data-key="c"]');
      const group = { role: c.getAttribute('role'), pressed: c.hasAttribute('aria-pressed'), tab: c.tabIndex };
      kit.paintBadge(dom, b, ['Too small', 'Name used twice']);
      const badge = b.querySelector('.opf-kit-badge').title;
      kit.paintBadge(dom, b, []);
      const badgeGone = b.querySelector('.opf-kit-badge') === null;
      const divider = dom.el('div');
      kit.paintDivider(divider, { box: { x: 0.5, y: 0, w: 0.01, h: 1 }, orientation: 'vertical', draggable: true, label: 'Resize a and b', valueNow: 67, valueText: kit.ratioLabel(2, 1), title: 'Drag to resize' });
      const draggable = ['role', 'aria-orientation', 'aria-valuenow', 'aria-valuetext', 'tabindex', 'aria-disabled'].map((name) => divider.getAttribute(name));
      kit.paintDivider(divider, { orientation: 'vertical', draggable: false });
      const fixed = ['aria-valuenow', 'tabindex', 'aria-disabled', 'aria-label'].map((name) => divider.getAttribute(name));
      const marks = kit.createOverlay(dom, document.getElementById('marks'), { guide: 'cut', markers: true });
      const order = [...document.getElementById('marks').children].map((node) => node.className);
      marks.showDrop({ x: 0.5, y: 0, w: 0, h: 1 }, { orientation: 'vertical', state: 'refused', reason: 'A heading cannot move.' });
      const drop = [marks.drop.hidden, marks.drop.dataset.state, marks.drop.title, marks.drop.style.left, marks.drop.style.width, marks.drop.style.height];
      marks.showRatio('2 : 1', { x: 0.5, y: 0.5 });
      marks.showGuide({ x: 0, y: 0, w: 0.5, h: 1 }, 'row');
      const ratio = [marks.ratio.hidden, marks.ratio.textContent, marks.guide.style.left, marks.guide.dataset.axis];
      marks.hover(layer, b);
      marks.hover(layer, c);
      marks.into(layer, b);
      const flags = [b.hasAttribute('data-hover'), c.dataset.hover, b.dataset.into];
      marks.hideDrop(); marks.hideRatio(); marks.hideGuide(); marks.into(layer, null);
      return { after, attrs, group, badge, badgeGone, draggable, fixed, order, drop, ratio, flags, hidden: [marks.drop.hidden, marks.ratio.hidden, marks.guide.hidden, b.hasAttribute('data-into')] };
    });
    assert.deepEqual(result.after, { order: ['c', 'b'], same: true, focused: true }, 'a redraw reorders and removes without rebuilding the focused box');
    assert.deepEqual(result.attrs, { role: 'button', pressed: 'true', label: 'Box b', tab: 0, selected: true, left: '10%', width: '20%' });
    assert.deepEqual(result.group, { role: 'group', pressed: false, tab: -1 }, 'a container is a group');
    assert.equal(result.badge, 'Too small\nName used twice');
    assert.equal(result.badgeGone, true);
    assert.deepEqual(result.draggable, ['separator', 'vertical', '67', '2 : 1', '0', null]);
    assert.deepEqual(result.fixed, [null, null, 'true', null], 'a fixed divider is disabled and out of the tab order');
    assert.deepEqual(result.order, ['opf-kit-cut', 'opf-kit-drop', 'opf-kit-ratio', 'opf-kit-markers'], 'guide, drop line, ratio, then the marker layer');
    assert.deepEqual(result.drop, [false, 'refused', 'A heading cannot move.', '50%', '0px', '100%']);
    assert.deepEqual(result.ratio, [false, '2 : 1', '25%', 'row']);
    assert.deepEqual(result.flags, [false, 'true', 'true'], 'one hovered box; the drop target is marked');
    assert.deepEqual(result.hidden, [true, true, true, false]);
  }

  // 3. The viewport: Ctrl+wheel steps; Space-drag pans; two fingers pinch around their midpoint; fit.
  {
    await page.evaluate(() => {
      window.zooms = [];
      window.view = kit.createViewport(document.getElementById('viewport'), { pinch: true, onZoom: (zoom) => zooms.push(zoom) });
      document.addEventListener('keydown', (event) => { if (event.key === ' ') { event.preventDefault(); view.holdSpace(true); } });
      document.addEventListener('keyup', (event) => { if (event.key === ' ') view.holdSpace(false); });
    });
    const box = await page.locator('#viewport').boundingBox();
    await page.mouse.move(box.x + 100, box.y + 100);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -100);
    await page.keyboard.up('Control');
    assert.equal(await page.evaluate(() => view.zoom), 1.5, 'Ctrl+wheel steps to 150%');
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('stage')).width), '600px', 'the stage follows the zoom variable');
    await page.mouse.wheel(0, 100);
    await page.waitForFunction(() => document.getElementById('viewport').scrollTop > 0, null, { timeout: 5000 });
    assert.equal(await page.evaluate(() => view.zoom), 1.5, 'a plain wheel scrolls and leaves the zoom');
    await page.evaluate(() => { const v = document.getElementById('viewport'); v.scrollLeft = 0; v.scrollTop = 0; });
    await page.locator('#viewport').focus().catch(() => {});
    await page.keyboard.down(' ');
    await page.mouse.move(box.x + 200, box.y + 200);
    await page.mouse.down();
    await page.mouse.move(box.x + 150, box.y + 170, { steps: 3 });
    await page.mouse.up();
    await page.keyboard.up(' ');
    assert.deepEqual(await page.evaluate(() => { const v = document.getElementById('viewport'); return [v.scrollLeft, v.scrollTop, v.dataset.space ?? null]; }), [50, 30, null], 'Space-drag pans by the drag');
    const pinch = await page.evaluate(() => {
      const v = document.getElementById('viewport');
      view.setZoom(1);
      v.scrollLeft = 0; v.scrollTop = 0;
      const r = v.getBoundingClientRect();
      const fire = (type, id, x, y) => v.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: r.left + x, clientY: r.top + y, bubbles: true, cancelable: true }));
      fire('pointerdown', 1, 150, 100); fire('pointerdown', 2, 250, 100);
      fire('pointermove', 1, 100, 100); fire('pointermove', 2, 300, 100);
      const out = { zoom: view.zoom, left: v.scrollLeft, panning: v.dataset.panning };
      fire('pointerup', 1, 100, 100); fire('pointerup', 2, 300, 100);
      out.after = v.dataset.panning ?? null;
      return out;
    });
    assert.deepEqual(pinch, { zoom: 2, left: 200, panning: 'true', after: null }, 'a pinch to twice the distance doubles the zoom and keeps the midpoint (200px) still');
    assert.equal(await page.evaluate(() => view.fit()), 1);
    assert.ok(await page.evaluate(() => zooms.length >= 4));
    await page.evaluate(() => view.destroy());
  }

  // 4. The drag controller with a real mouse: under 4px nothing; past it the session starts, moves, and drops once; Escape cancels.
  {
    await page.evaluate(() => {
      const list = document.getElementById('list');
      const dom = kit.createDom(document);
      window.dragLog = [];
      window.pointerLog = [];
      const drag = window.dragKit = kit.createDragController({
        doc: document,
        onStart: (press) => ({ id: press.payload, ghost: kit.dragGhost(dom, document.getElementById('host'), press.payload) }),
        onStarted: (session) => dragLog.push(`start ${session.id}`),
        onMove: (session, event) => { session.ghost.moveTo(event); session.over = document.elementFromPoint(event.clientX, event.clientY)?.dataset?.id; },
        onEnd: (session, { cancelled }) => { session.ghost.remove(); dragLog.push(cancelled ? 'cancelled' : 'ended'); },
        onDrop: (session) => dragLog.push(`drop ${session.id} on ${session.over}`),
        onEscape: () => dragLog.push('escape'),
      });
      const note = (event) => { pointerLog.push(`${event.type} ${Math.round(event.clientX)},${Math.round(event.clientY)} ${event.target?.dataset?.id ?? event.target?.id ?? event.target?.nodeName}`); if (pointerLog.length > 60) pointerLog.shift(); };
      list.addEventListener('pointerdown', (event) => { note(event); drag.press(event, event.target.dataset.id); list.setPointerCapture(event.pointerId); });
      list.addEventListener('pointermove', (event) => { note(event); drag.move(event); });
      list.addEventListener('pointerup', (event) => { note(event); drag.release(event); });
      // A host forwards pointercancel too (the browser took the pointer): the drag ends as cancelled instead of staying open.
      list.addEventListener('pointercancel', (event) => { note(event); drag.cancel(); });
      for (const type of ['dragstart', 'selectstart']) document.addEventListener(type, (event) => pointerLog.push(`${type} ${event.target?.nodeName}`), true);
    });
    const center = async (id) => { const box = await page.locator(`#list li[data-id="${id}"]`).boundingBox(); return { x: box.x + 10, y: box.y + box.height / 2 }; };
    const a = await center('a'), b = await center('b'), c = await center('c');
    // What the page saw, printed when a wait times out (CI's container is not reproducible on a laptop).
    const state = (target) => page.evaluate((point) => ({
      active: window.dragKit.active ? { id: window.dragKit.active.id, over: window.dragKit.active.over ?? null } : null,
      pending: window.dragKit.pending ? { x: window.dragKit.pending.x, y: window.dragKit.pending.y, payload: window.dragKit.pending.payload } : null,
      log: [...dragLog],
      pointer: pointerLog.slice(-12),
      selection: String(getSelection()),
      ghosts: document.querySelectorAll('.opf-kit-ghost').length,
      at: point ? document.elementsFromPoint(point.x, point.y).slice(0, 4).map((node) => node.dataset?.id ?? node.id ?? node.nodeName) : null,
      c: (() => { const r = document.querySelector('#list li[data-id="c"]').getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round); })(),
    }), target ?? null);
    const until = async (label, predicate, target) => {
      try { await page.waitForFunction(predicate, null, { timeout: 10000 }); }
      catch (error) { throw new Error(`${label}: timed out; the page saw ${JSON.stringify(await state(target))}`, { cause: error }); }
    };
    // Explicit moves, each waiting until the controller reports it (pointer moves arrive on animation frames, after a key press sent later).
    const dragTo = async (from, to) => {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await until('the press', () => window.dragKit.pending !== null || window.dragKit.active !== null, from);
      await page.mouse.move(from.x, from.y + 8);
      await until('the drag start (past 4px)', () => window.dragKit.active !== null, { x: from.x, y: from.y + 8 });
      await page.mouse.move(b.x, b.y);
      await until('the move over b', () => window.dragKit.active?.over === 'b', b);
      await page.mouse.move(to.x, to.y);
      await until('the move over c', () => window.dragKit.active?.over === 'c', to);
    };
    const clean = async (label) => {
      const now = await state();
      assert.deepEqual([now.active, now.pending, now.ghosts, now.selection], [null, null, 0, ''], `${label}: nothing left over (${JSON.stringify(now)})`);
    };
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(a.x + 2, a.y + 2);
    await page.mouse.up();
    assert.deepEqual(await page.evaluate(() => dragLog), [], 'a 3px wobble is a click, not a drag');
    await clean('after the click');
    await dragTo(a, c);
    assert.equal(await page.locator('.opf-kit-ghost').textContent(), 'a', 'the label follows the pointer');
    await page.mouse.up();
    await until('the drop', () => window.dragKit.active === null && dragLog.includes('drop a on c'));
    await clean('between the two drags');
    await dragTo(a, c);
    await page.keyboard.press('Escape');
    await until('the cancel', () => window.dragKit.active === null);
    await page.mouse.up();
    assert.deepEqual(await page.evaluate(() => dragLog), ['start a', 'ended', 'drop a on c', 'start a', 'cancelled', 'escape']);
    await clean('after the cancel');
  }

  // 5. The layers tree by keyboard: items with level, place, selection and expansion; one tab stop; arrows, expand, collapse, Enter.
  {
    await page.evaluate(() => {
      const dom = kit.createDom(document);
      const tree = document.getElementById('tree');
      const data = { id: 'slide', children: [{ id: 'title' }, { id: 'row', children: [{ id: 'text' }, { id: 'chart' }] }] };
      const collapsed = new Set();
      window.activated = [];
      const build = (node, level, place, size) => {
        const kids = node.children;
        const li = kit.treeItem(dom, { level, selected: node.id === 'title', expanded: kids ? !collapsed.has(node.id) : undefined, setsize: level > 1 ? size : undefined, posinset: level > 1 ? place : undefined, attributes: { 'data-id': node.id } });
        li.append(dom.el('span', '', { text: node.id }));
        if (kids && !collapsed.has(node.id)) { const ul = dom.el('ul', '', { role: 'group' }); kids.forEach((kid, index) => ul.append(build(kid, level + 1, index + 1, kids.length))); li.append(ul); }
        return li;
      };
      const parentOf = (id, node = data, parent = null) => { if (node.id === id) return parent; for (const kid of node.children ?? []) { const found = parentOf(id, kid, node); if (found !== undefined) return found; } return undefined; };
      window.renderTree = (focusId) => {
        tree.replaceChildren(build(data, 1));
        const items = [...tree.querySelectorAll('[role="treeitem"]')];
        kit.rovingTabStop(items, items.find((item) => item.dataset.id === (focusId ?? 'slide')));
        if (focusId) tree.querySelector(`[data-id="${focusId}"]`).focus();
      };
      tree.addEventListener('keydown', (event) => {
        const item = event.target.closest('[role="treeitem"]');
        const id = item.dataset.id;
        const items = [...tree.querySelectorAll('[role="treeitem"]')];
        const parent = parentOf(id);
        const action = kit.treeKeyAction(event, item, items, { expandable: item.hasAttribute('aria-expanded'), expanded: item.getAttribute('aria-expanded') === 'true', collapsible: Boolean(parent), parent: parent ? tree.querySelector(`[data-id="${parent.id}"]`) : null, firstChild: item.querySelector(':scope > ul > [role="treeitem"]'), menu: false });
        if (!action) return;
        event.preventDefault();
        if (action.type === 'focus') action.target?.focus();
        else if (action.type === 'expand') { collapsed.delete(id); renderTree(id); }
        else if (action.type === 'collapse') { collapsed.add(id); renderTree(id); }
        else if (action.type === 'activate') activated.push(id);
      });
      renderTree();
    });
    assert.equal(await page.locator('#tree [tabindex="0"]').count(), 1, 'one tab stop');
    const attrs = await page.locator('#tree [data-id="chart"]').evaluate((node) => ['aria-level', 'aria-setsize', 'aria-posinset', 'aria-selected', 'aria-expanded'].map((name) => node.getAttribute(name)));
    assert.deepEqual(attrs, ['3', '2', '2', 'false', null]);
    await page.locator('#tree [data-id="slide"]').focus();
    const focused = () => page.evaluate(() => document.activeElement.dataset.id);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    assert.equal(await focused(), 'row');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.locator('#tree [data-id="row"]').getAttribute('aria-expanded'), 'false', 'ArrowLeft collapses');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    assert.equal(await focused(), 'text', 'ArrowRight expands, then goes in');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await focused(), 'row', 'ArrowLeft on a child goes to the parent');
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Home');
    assert.deepEqual(await page.evaluate(() => [document.activeElement.dataset.id, activated.join()]), ['slide', 'chart']);
  }

  // 6. The inspector frame: the sections for the selection; typing keeps focus; a redraw puts focus back; findings show under a field.
  {
    await page.evaluate(() => {
      const dom = kit.createDom(document);
      const body = document.getElementById('body');
      window.state = { selection: 'none', name: 'Hero', findings: [] };
      const frame = kit.createInspectorFrame(body, {
        context: () => ({ selection: state.selection }),
        sections: [
          { id: 'deck', when: (ctx) => ctx.selection === 'none', render: (el) => el.append(dom.el('h3', '', { text: 'Deck' })) },
          { id: 'block', when: (ctx) => ctx.selection === 'block', render: (el) => el.append(fields.section('Block'), fields.field('Name', fields.textInput(state.name, { name: 'name', onInput: (value) => { state.name = value; changed(); } }), { path: 'block', field: 'name', help: 'A short name.' })) },
          { id: 'advanced', render: (el) => el.append(dom.el('h3', '', { text: 'Advanced' })) },
        ],
      });
      const fields = kit.createFields(dom, frame, { idPrefix: 'insp', issues: (path, key) => state.findings.filter((finding) => finding.path === path && finding.field === key) });
      window.renders = 0;
      const render = frame.render;
      window.frame = { ...frame, render: () => { renders++; render(); } };
      window.changed = () => { if (frame.editing) frame.update(); else window.frame.render(); };
      window.frame.render();
    });
    const titles = () => page.locator('#body h3').allTextContents();
    assert.deepEqual(await titles(), ['Deck', 'Advanced'], 'every section whose when holds, in order; a section without when always shows');
    await page.evaluate(() => { state.selection = 'block'; frame.render(); });
    assert.deepEqual(await titles(), ['Block', 'Advanced']);
    const input = page.getByLabel('Name');
    assert.equal(await input.getAttribute('aria-describedby'), await page.locator('#body .opf-kit-help').getAttribute('id'));
    await input.focus();
    await page.keyboard.type('X');
    assert.deepEqual(await page.evaluate(() => [state.name, renders, document.activeElement.dataset.field]), ['HeroX', 2, 'name'], 'typing does not redraw the panel');
    await page.evaluate(() => { state.findings = [{ path: 'block', field: 'name', message: 'Use lowercase.' }]; frame.render(); });
    assert.equal(await page.evaluate(() => document.activeElement.dataset.field), 'name', 'a redraw puts focus back on the same field');
    assert.equal(await page.locator('#body .opf-kit-field-error').textContent(), 'Use lowercase.');
    assert.equal(await page.getByLabel('Name').getAttribute('aria-invalid'), 'true');
    assert.equal(await page.locator('#body .opf-kit-field').getAttribute('data-invalid'), 'true');
    await page.evaluate(() => { state.findings = []; frame.update(); });
    assert.equal(await page.getByLabel('Name').getAttribute('aria-invalid'), null, 'update clears the finding without a redraw');
    const removed = await page.evaluate(() => { const remove = frame.register({ id: 'first', render: (el) => el.append(Object.assign(document.createElement('h3'), { textContent: 'First' })) }, { before: 'block' }); frame.render(); const titles = [...document.querySelectorAll('#body h3')].map((node) => node.textContent); remove(); frame.render(); return titles; });
    assert.deepEqual(removed, ['First', 'Block', 'Advanced'], 'a host registers a section before another');
    assert.deepEqual(await titles(), ['Block', 'Advanced']);
  }

  // 7. Accessibility of what the kit drew: no serious or critical axe violations.
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.filter((violation) => ['serious', 'critical'].includes(violation.impact)).map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`));
  assert.deepEqual(violations, []);
  assert.deepEqual(errors, []);
  console.log('studio kit browser: DOM and menu, overlay, viewport (wheel, Space pan, pinch, fit), drag, tree keyboard, inspector frame and axe passed');
} finally {
  await browser?.close();
  server.close();
}
