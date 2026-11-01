import assert from 'node:assert/strict';
import { startWorkspacePage, deck } from './support/workspace-page.mjs';

// CE-28 wave 2 in a real browser: the toolbar's `design`, `review`, `help` and `actions` items as `createOpfEditor` mounts them, slide management
// on the strip (`slideActions`), the unsaved-changes contract (`dirty`, `markSaved`, `save` on Ctrl/Cmd+S, `guardUnload`), `layout: "viewer"`,
// Export from ⋯ as a sheet, the Studio's title, expand and shared shortcut list, and `<opf-editor>` with the new layouts and its new events.
const checks = [];
const mark = (name) => checks.push(name);
const EXTRA = "import * as element from './src/element.js'; window.opfEl = element;";
const app = await startWorkspacePage({ bundle: { extraEntry: EXTRA } });
const { page, errors } = app;
const ev = (fn, arg) => page.evaluate(fn, arg);
const items = () => ev(() => [...document.querySelector('#host .opf-tb').children].filter((node) => !node.hidden).map((node) => node.dataset.opfToolbarItem));

try {
  await ev(() => {
    window.base = () => ({ fonts: window.fonts, catalogs: [window.opfWs.gallery] });
    window.makeHost = (id = 'host', width = 1600) => { document.querySelector(`#${id}`)?.remove(); const host = document.createElement('div'); host.id = id; host.style.cssText = `width:${width}px;height:700px`; document.body.append(host); return host; };
    window.mountEditor = async (options, width) => { window.ed?.destroy(); const host = window.makeHost('host', width); window.ed = window.opfWs.createOpfEditor(host, { ...window.base(), ...options }); await window.ed.ready; await window.ed.whenIdle(); return host; };
  });

  // ---- design, review, help in the full layout -------------------------------------------------------------------------------------------
  await ev((d) => window.mountEditor({ document: d }), deck());
  assert.deepEqual(await items(), ['title', 'history', 'find', 'views', 'spacer', 'design', 'review', 'export', 'present', 'help', 'expand'], 'the full preset (actions is hidden while there are none; ⋯ while nothing is in it)');
  await page.locator('#host .opf-design-menu-trigger').click();
  await page.locator('#host .opf-design-menu-popover:not([hidden]), #host .opf-design-menu [role=dialog]:not([hidden])').first().waitFor({ timeout: 5000 });
  const design = await ev(() => ({ items: document.querySelectorAll('#host .opf-design-menu-item').length, more: [...document.querySelectorAll('#host .opf-design-menu-item, #host .opf-design-menu button')].some((node) => /More design options/.test(node.textContent) && !node.hidden) }));
  assert.ok(design.items > 0, 'the Design menu lists the catalog choices');
  assert.equal(design.more, false, 'without a Design panel there is no "More design options" row');
  await page.keyboard.press('Escape');
  // With the Design side panel on, the preset leaves the quick menu out; listed explicitly, its "More design options" opens the panel.
  await ev((d) => window.mountEditor({ document: d, panels: { design: true } }), deck());
  assert.equal((await items()).includes('design'), false, 'the preset leaves the quick menu out next to the Design panel');
  await ev((d) => window.mountEditor({ document: d, panels: { design: true }, toolbar: ['title', 'design', 'review', 'more'] }), deck());
  await page.locator('#host .opf-design-menu-trigger').click();
  await page.locator('#host .opf-design-menu button', { hasText: 'More design options' }).click();
  await page.waitForFunction(() => document.querySelector('#host [data-opf-tab=design]')?.getAttribute('aria-selected') === 'true', undefined, { timeout: 5000 });
  mark('the Design quick menu is in the full bar where there is no Design panel, lists the choices, and opens the panel when one exists');

  // The review pill follows the Review panel's counts and opens it.
  await ev((d) => window.mountEditor({ document: d, panels: { design: true }, panel: 'design' }), deck());
  await page.waitForFunction(() => ['valid', 'issues'].includes(document.querySelector('#host .opf-review-pill')?.dataset.state), undefined, { timeout: 20000 });
  await page.locator('#host .opf-review-pill').click();
  await page.waitForFunction(() => document.querySelector('#host [data-opf-tab=review]').getAttribute('aria-selected') === 'true', undefined, { timeout: 5000 });
  // Without a Review panel (the embed), listed, the review runs headless and the pill asks the host (`review-open`).
  await ev((d) => { window.opened = []; return window.mountEditor({ document: d, layout: 'embed', toolbar: ['title', 'review', 'more'], on: { 'review-open': (detail) => window.opened.push(detail) } }); }, deck());
  await page.waitForFunction(() => ['valid', 'issues'].includes(document.querySelector('#host .opf-review-pill')?.dataset.state), undefined, { timeout: 20000 });
  assert.equal(await ev(() => !!document.querySelector('#host [data-opf-headless=review]')?.hidden && !!document.querySelector('#host [data-opf-headless=review] [data-opf-slot=review]')), true, 'the review runs in a hidden element');
  await page.locator('#host .opf-review-pill').click();
  const opened = await ev(() => window.opened.map((detail) => ({ total: typeof detail.counts?.total, findings: Array.isArray(detail.findings) })));
  assert.deepEqual(opened, [{ total: 'number', findings: true }]);
  mark('the review pill shows the Review counts and opens the Review tab; in the embed the review runs headless and the pill emits review-open');

  // Help: the sheet lists the bindings the editor has.
  await ev((d) => window.mountEditor({ document: d, on: { save: () => {} } }), deck());
  const shortcutIds = await ev(() => window.ed.shortcuts().map((entry) => entry.id));
  for (const id of ['undo', 'redo', 'find', 'previous', 'next', 'present', 'save', 'title-commit', 'expand-exit', 'help']) assert.ok(shortcutIds.includes(id), `shortcuts() lists ${id}: ${shortcutIds}`);
  await page.locator('#host .opf-help-button').click();
  await page.locator('.opf-shortcuts-dialog').waitFor({ timeout: 5000 });
  const rows = await ev(() => [...document.querySelectorAll('.opf-shortcuts-row')].map((row) => row.dataset.id));
  assert.deepEqual(rows.sort(), [...shortcutIds].sort(), 'the help sheet lists editor.shortcuts()');
  await page.keyboard.press('Escape');
  await page.locator('.opf-shortcuts-dialog').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  mark('the help item lists the editor\'s real bindings (Undo, Redo, Find, the arrows, F5, Save, the title, expand, ?), the same as shortcuts()');

  // ---- actions --------------------------------------------------------------------------------------------------------------------------
  await ev((d) => {
    window.ran = [];
    window.flag = false;
    return window.mountEditor({ document: d, actions: [
      { id: 'share', label: 'Share', primary: true, run: () => window.ran.push('share') },
      { id: 'two', label: 'Two slides?', enabled: () => window.ed?.getDocument().slides.length === 2, run: () => window.ran.push('two') },
      { id: 'flag', label: 'Flag', pressed: () => window.flag, run: () => { window.flag = !window.flag; } },
    ] });
  }, deck(3));
  const actionState = () => ev(() => [...document.querySelectorAll('#host .opf-actions-button')].map((button) => `${button.dataset.action}:${button.disabled || button.getAttribute('aria-disabled') === 'true' ? 'off' : 'on'}:${button.getAttribute('aria-pressed') ?? '-'}`));
  assert.deepEqual(await actionState(), ['share:on:-', 'two:off:-', 'flag:on:false']);
  await page.locator('#host .opf-actions-button[data-action=share]').click();
  await page.locator('#host .opf-actions-button[data-action=flag]').click();
  await ev(() => window.ed.session.applyPatch([{ op: 'remove', path: '/slides/2' }]));
  assert.deepEqual(await actionState(), ['share:on:-', 'two:on:-', 'flag:on:true'], 'enabled() and pressed() are read again after a change');
  assert.deepEqual(await ev(() => window.ran), ['share']);
  await ev(() => window.ed.setActions([]));
  assert.equal(await ev(() => document.querySelector('#host [data-opf-slot=actions]').hidden), true, 'no actions: the item is hidden');
  await ev(() => window.ed.setActions([{ id: 'only', label: 'Only', run: () => {} }]));
  assert.deepEqual(await actionState(), ['only:on:-']);
  mark('`actions` puts the host\'s buttons in the bar, re-reads enabled() and pressed() after every change, and setActions replaces them');

  // ---- slide management on the strip -------------------------------------------------------------------------------------------------------
  await ev((d) => window.mountEditor({ document: d }), deck(3));
  assert.equal(await page.locator('#host .opf-thumbs-add').count(), 1, 'the full layout has "+" on the strip');
  await page.locator('#host .opf-thumbs-add').click();
  const added = await ev(async () => { const menu = document.querySelector('#host .opf-thumbs-menu:not([hidden])'); return { menu: Boolean(menu), entries: menu ? menu.querySelectorAll('[role^=menuitem]').length : 0 }; });
  assert.ok(added.menu && added.entries > 0, `"+" offers the deck's layouts: ${JSON.stringify(added)}`);
  await page.keyboard.press('Escape');
  await ev(() => window.ed.setReadOnly(true));
  assert.equal(await page.locator('#host .opf-thumbs-add').count(), 0, 'read-only removes "+"');
  await ev(() => window.ed.setReadOnly(false));
  const slotsHost = await ev(async (d) => {
    window.ed.destroy();
    const host = window.makeHost();
    host.innerHTML = '<div id="c" style="width:640px;height:360px"></div><div id="t"></div>';
    window.ed = window.opfWs.createOpfEditor(host, { document: d, ...window.base(), slots: { canvas: host.querySelector('#c'), thumbnails: host.querySelector('#t') } });
    await window.ed.ready;
    const plain = !host.querySelector('.opf-thumbs-add');
    window.ed.destroy();
    window.ed = window.opfWs.createOpfEditor(host, { document: d, ...window.base(), slideActions: true, slots: { canvas: host.querySelector('#c'), thumbnails: host.querySelector('#t') } });
    await window.ed.ready;
    return { plain, opted: !!host.querySelector('.opf-thumbs-add') };
  }, deck(2));
  assert.deepEqual(slotsHost, { plain: true, opted: true });
  mark('the strip has "+" and its menu in the full layout (layouts offered, read-only follows); a host\'s own arrangement opts in with slideActions');

  // ---- unsaved changes and save ------------------------------------------------------------------------------------------------------------
  await ev((d) => { window.dirt = []; window.saves = []; return window.mountEditor({ document: d, on: { dirty: (e) => window.dirt.push(e.dirty), save: (e) => window.saves.push(e) } }); }, deck(2));
  assert.equal(await ev(() => window.ed.dirty), false, 'a document as opened is not dirty');
  await ev(() => window.ed.setDeckName('Changed'));
  assert.equal(await ev(() => window.ed.dirty), true);
  await ev(() => window.ed.undo());
  assert.equal(await ev(() => window.ed.dirty), false, 'back to the baseline is not dirty');
  await ev(() => window.ed.setDeckName('Changed again'));
  assert.equal(await ev(() => window.ed.markSaved()), true);
  assert.equal(await ev(() => window.ed.dirty), false, 'markSaved records the baseline');
  // A source draft that is not a deck never reaches the document, and is still unsaved work.
  await ev(() => { window.ed.sourcePane.editor.api.replace(0, window.ed.sourcePane.editor.api.getValue().length, '{ "name": "half typed'); window.ed.sourcePane.getText(); });
  assert.equal(await ev(() => window.ed.inSync), false);
  assert.equal(await ev(() => window.ed.dirty), true, 'a draft that differs from the baseline is dirty');
  await page.locator('#host .opf-source .cm-content').click();
  await page.keyboard.press('Control+s');
  await page.waitForFunction(() => window.saves.length === 1);
  const saved = await ev(() => ({ draft: window.saves[0].draft, text: window.saves[0].text, format: window.saves[0].format, name: window.saves[0].document.name }));
  assert.deepEqual(saved, { draft: true, text: '{ "name": "half typed', format: 'json', name: 'Changed again' }, 'save carries the document and the draft text');
  await ev(() => window.ed.setDocument({ name: 'Loaded', slides: [{ id: 'l', title: 'L' }] }));
  assert.equal(await ev(() => window.ed.dirty), false, 'setDocument resets the baseline');
  assert.deepEqual(await ev(() => window.dirt), [true, false, true, false, true, false]);
  // Without a save listener Ctrl/Cmd+S is left to the browser.
  const unprevented = await ev(async (d) => {
    window.ed.destroy();
    window.ed = window.opfWs.createOpfEditor(window.makeHost(), { document: d, ...window.base() });
    await window.ed.ready;
    const target = document.querySelector('#host .opf-ws-canvas');
    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  }, deck(2));
  assert.equal(unprevented, false);
  // guardUnload: the browser asks while dirty; a function decides itself.
  const guard = await ev(async (d) => {
    const unload = () => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; };
    window.ed.destroy();
    window.ed = window.opfWs.createOpfEditor(window.makeHost(), { document: d, ...window.base(), guardUnload: true });
    await window.ed.ready;
    const clean = unload();
    window.ed.setDeckName('Unsaved');
    const dirtyUnload = unload();
    window.ed.markSaved();
    const savedUnload = unload();
    window.ed.destroy();
    const afterDestroy = unload();
    let asked = 0;
    window.ed = window.opfWs.createOpfEditor(window.makeHost(), { document: d, ...window.base(), guardUnload: (editor) => { asked += 1; return editor.getDeckName() === 'Workspace fixture'; } });
    await window.ed.ready;
    const byFunction = unload();
    return { clean, dirtyUnload, savedUnload, afterDestroy, byFunction, asked };
  }, deck(2));
  assert.deepEqual(guard, { clean: false, dirtyUnload: true, savedUnload: false, afterDestroy: false, byFunction: true, asked: 1 });
  mark('dirty follows the baseline (edits, undo back, markSaved, a source draft, setDocument), Ctrl/Cmd+S emits save with the draft text only when someone listens, and guardUnload asks while dirty or as its function says');

  // ---- layout: "viewer" -------------------------------------------------------------------------------------------------------------------
  await ev((d) => window.mountEditor({ document: d, layout: 'viewer' }, 900), deck(3));
  assert.deepEqual(await items(), ['title', 'counter', 'spacer', 'present', 'expand']);
  const viewer = await ev(() => {
    const host = document.querySelector('#host');
    return {
      readOnly: window.ed.readOnly, title: host.querySelector('.opf-title').dataset.state, parts: ['.opf-source', '.opf-thumbs', '.opf-ws-side', '.opf-export', '[data-opf-action=undo]'].filter((selector) => host.querySelector(selector)),
      counter: host.querySelector('.opf-ws-counter .opf-nav-counter').textContent, shortcuts: window.ed.shortcuts().map((entry) => entry.id),
    };
  });
  assert.deepEqual(viewer, { readOnly: true, title: 'readonly', parts: [], counter: '01 / 03', shortcuts: ['previous', 'next', 'present', 'expand-exit'] });
  await ev(() => window.ed.session.set('name', 'Host write'));
  await page.locator('#host .opf-ws-counter .opf-nav-button').last().focus();
  await page.keyboard.press('Control+z');
  assert.equal(await ev(() => window.ed.getDeckName()), 'Host write', 'the viewer has no Undo keys');
  await ev((d) => window.mountEditor({ document: d, layout: 'viewer', toolbar: ['title', 'counter', 'spacer', 'export', 'present', 'more'] }, 900), deck(3));
  assert.equal(await page.locator('#host .opf-export-trigger').count(), 1, 'Export works in the viewer when the toolbar lists it');
  mark('layout "viewer" is read-only: the title read-only, the counter, Present and expand; no source, strip, side panel or Undo; Export when listed');

  // ---- Export from ⋯ opens the sheet ------------------------------------------------------------------------------------------------------
  await ev((d) => window.mountEditor({ document: d }, 1600), deck(2));
  await ev(() => { document.querySelector('#host').style.width = '360px'; });
  await page.waitForFunction(() => window.ed.toolbar.collapsed.includes('export'), undefined, { timeout: 5000 });
  await page.locator('#host .opf-tb-more-button').click();
  const exportEntries = await ev(() => [...document.querySelectorAll('.opf-tb-menu [data-opf-toolbar-part=export]')].map((node) => node.textContent));
  assert.deepEqual(exportEntries, ['Export…'], 'one entry for Export');
  await page.locator('.opf-tb-menu [data-opf-toolbar-menu-item=export]').click();
  await page.waitForFunction(() => { const sheet = document.querySelector('#host .opf-export-sheet'); return sheet && !sheet.hidden && sheet.getBoundingClientRect().height > 40 && getComputedStyle(sheet).visibility === 'visible'; }, undefined, { timeout: 5000 });
  assert.equal(await ev(() => document.querySelector('#host .opf-export').dataset.mode), 'sheet');
  await page.keyboard.press('Escape');
  await ev(() => { document.querySelector('#host').style.width = '1600px'; });
  await page.waitForFunction(() => !window.ed.toolbar.collapsed.includes('export') && document.querySelector('#host .opf-export').dataset.mode === 'menu', undefined, { timeout: 5000 });
  mark('Export collapsed into ⋯ is one "Export…" entry that opens the Export sheet on screen; back in the bar it is a menu again');

  // ---- the Studio: title, expand and one shortcut list -----------------------------------------------------------------------------------
  const studio = await ev(async (d) => {
    window.ed.destroy();
    const host = window.makeHost('host', 1400);
    window.ed = window.opfWs.createOpfEditor(host, { document: d, ...window.base(), layout: 'studio' });
    await window.ed.ready;
    const bar = host.querySelector('.opf-studio-bar');
    const order = [...bar.children].map((node) => node.dataset.opfSlot ?? node.className.split(' ')[0]);
    const list = window.ed.shortcuts();
    const title = bar.querySelector('[data-opf-slot=title] .opf-title-input')?.value;
    window.ed.setDeckName('Studio name');
    return {
      title, expand: !!bar.querySelector('[data-opf-slot=expand] .opf-expand-button'),
      expandBeforeEnd: order.indexOf('expand') === order.indexOf('topbarEnd') - 1, commands: list.filter((entry) => entry.id.startsWith('studio.')).length, chrome: list.some((entry) => entry.id === 'expand-exit'),
      renamed: window.ed.getDocument().name,
    };
  }, deck(2));
  assert.equal(studio.title, 'Workspace fixture');
  assert.ok(studio.expand && studio.expandBeforeEnd && studio.commands > 5 && studio.chrome, JSON.stringify(studio));
  assert.equal(studio.renamed, 'Studio name');
  await page.waitForFunction(() => document.querySelector('[data-opf-slot=title] .opf-title-input').value === 'Studio name');
  await ev(() => window.ed.commands.run('studio.shortcuts'));
  await page.locator('.opf-studio-shortcuts').waitFor({ timeout: 5000 });
  assert.equal(await ev(() => document.querySelector('.opf-studio-shortcuts').textContent.includes('Leave the expanded editor')), true, 'the Studio sheet lists the chrome\'s keys too');
  await page.keyboard.press('Escape');
  mark('the Studio bar has the deck title and expand before topbarEnd, and its shortcut sheet and shortcuts() share one list');

  // ---- <opf-editor> with the new layouts ---------------------------------------------------------------------------------------------------
  const element = await ev(async (d) => {
    window.ed.destroy();
    document.querySelector('#host')?.remove();
    window.opfEl.defineOpfEditorElement('opf-editor', { fonts: window.fonts, catalogs: [window.opfWs.gallery] });
    const out = {};
    for (const [key, attributes] of Object.entries({ embed: 'layout="embed" toolbar="title,history,counter,expand"', viewer: 'layout="viewer"' })) {
      const wrap = document.createElement('div');
      wrap.innerHTML = `<opf-editor ${attributes} style="display:block;width:900px;height:500px"></opf-editor>`;
      const node = wrap.firstElementChild;
      node.document = d;
      const names = [];
      node.addEventListener('opf-deck-name', (event) => names.push(event.detail.name));
      document.body.append(wrap);
      await new Promise((resolve) => node.addEventListener('opf-ready', resolve, { once: true }));
      const items = [...node.querySelectorAll('.opf-tb > *')].filter((child) => !child.hidden).map((child) => child.dataset.opfToolbarItem);
      node.editor.session.set('name', `${key} renamed`);
      out[key] = { items, layout: node.editor.layout, names };
      wrap.remove();
    }
    return out;
  }, deck(2));
  assert.deepEqual(element.embed, { items: ['title', 'history', 'counter', 'expand'], layout: 'embed', names: ['embed renamed'] });
  assert.equal(element.viewer.layout, 'viewer');
  assert.deepEqual(element.viewer.names, ['viewer renamed']);
  assert.ok(element.viewer.items.includes('title') && element.viewer.items.includes('counter'), element.viewer.items.join(','));
  mark('<opf-editor layout="embed" toolbar="title,history,counter,expand"> and layout="viewer" mount, and opf-deck-name is dispatched');

  assert.deepEqual(errors, [], errors.join('\n'));
} finally {
  await app.close();
}
console.log(checks.map((name) => `ok - ${name}`).join('\n'));
