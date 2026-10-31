import assert from 'node:assert/strict';
import { startWorkspacePage, deck } from './support/workspace-page.mjs';
import { touchAudit } from './support/touch-audit.mjs';

// CE-28 in a real browser: the editor's toolbar (src/toolbar.js) as `createOpfEditor` builds it. The default items of each layout, a `toolbar`
// list in its order, `toolbar: false` with the items in the host's own elements (mode B), the overflow into the ⋯ menu as the bar narrows and
// back, the menu's keyboard, the new `layout: "embed"` (mount, fit, its counter in step with the slide index), the deck name (`setDeckName`, undo,
// the `deckName` event from a source edit, before mount), the expand item, and the 44px / 16px touch sizes of the embed bar on a 320px phone.
const checks = [];
const mark = (name) => checks.push(name);
const app = await startWorkspacePage();
const { page, errors } = app;
const ev = (fn, arg) => page.evaluate(fn, arg);
const items = (selector = '.opf-tb') => ev((sel) => [...document.querySelector(sel).children].map((node) => node.dataset.opfToolbarItem), selector);

try {
  await ev(() => {
    window.base = () => ({ fonts: window.fonts, catalogs: [window.opfWs.gallery] });
    window.makeHost = (id = 'host', width = 1200) => { document.querySelector(`#${id}`)?.remove(); const host = document.createElement('div'); host.id = id; host.style.cssText = `width:${width}px;height:700px`; document.body.append(host); return host; };
    window.mountEditor = async (options, width) => { window.ed?.destroy(); const host = window.makeHost('host', width); window.ed = window.opfWs.createOpfEditor(host, { ...window.base(), ...options }); await window.ed.ready; await window.ed.whenIdle(); return host; };
    window.frames = (n = 2) => new Promise((resolve) => { const step = () => (n-- <= 0 ? resolve() : requestAnimationFrame(step)); step(); });
  });

  // ---- the default items of each layout -------------------------------------------------------------------------------------------------
  await ev((d) => window.mountEditor({ document: d, persistence: { key: 'tb', storage: 'memory' } }), deck());
  assert.deepEqual(await items(), ['title', 'history', 'find', 'views', 'spacer', 'autosave', 'export', 'present', 'expand', 'more']);
  const full = await ev(() => {
    const bar = document.querySelector('.opf-ws-bar');
    return {
      title: bar.querySelector('.opf-title-input')?.value,
      undo: !!bar.querySelector('[data-opf-action=undo]'), redo: !!bar.querySelector('[data-opf-action=redo]'), find: !!bar.querySelector('[data-opf-action=find]'),
      views: [...bar.querySelectorAll('[data-opf-view-button]')].map((b) => b.dataset.opfViewButton),
      slots: ['autosave', 'export', 'present'].map((name) => bar.querySelector(`[data-opf-slot=${name}]`) === window.ed.slots[name]),
      expand: !!bar.querySelector('.opf-expand-button'), moreHidden: bar.querySelector('[data-opf-toolbar-item=more]').hidden, collapsed: window.ed.toolbar.collapsed,
    };
  });
  assert.deepEqual(full, { title: 'Workspace fixture', undo: true, redo: true, find: true, views: ['slide', 'sorter', 'outline', 'layouts'], slots: [true, true, true], expand: true, moreHidden: true, collapsed: [] });
  await ev((d) => window.mountEditor({ document: d, layout: 'canvas' }), deck());
  assert.deepEqual(await items(), ['title', 'history', 'spacer', 'expand', 'more']);
  await ev((d) => window.mountEditor({ document: d, layout: 'source' }), deck());
  assert.equal(await ev(() => document.querySelector('#host .opf-ws-bar, #host .opf-tb')), null, 'the source layout has no toolbar');
  mark('full and canvas build their preset toolbars (title, history, find, views, autosave, Export, Present, expand, more); source builds none');

  // ---- `toolbar: [...]`: the host's order -------------------------------------------------------------------------------------------------
  await ev((d) => window.mountEditor({ document: d, toolbar: ['present', 'history', '|', { id: 'title', priority: 99 }, 'zoom', 'more', { id: 'export', priority: 1 }] }), deck());
  assert.deepEqual(await items(), ['present', 'history', '|', 'title', 'more', 'export'], 'the items in the given order; a reserved name (zoom) is left out');
  const ordered = await ev(() => ({ divider: !document.querySelector('.opf-tb-divider').hidden, export: window.ed.toolbar.items.find((item) => item.id === 'export'), title: window.ed.toolbar.items.find((item) => item.id === 'title') }));
  assert.deepEqual(ordered, { divider: true, export: { id: 'export', priority: 1, collapsible: true }, title: { id: 'title', priority: 99, collapsible: false } });
  const bad = await ev((d) => {
    const out = {};
    for (const [key, toolbar] of Object.entries({ unknown: ['nope'], twice: ['title', 'title'], shape: 'title' })) {
      try { window.opfWs.createOpfEditor(window.makeHost('bad'), { document: d, toolbar }).destroy(); } catch (error) { out[key] = error.message; }
    }
    document.querySelector('#bad').remove();
    return out;
  }, deck());
  assert.match(bad.unknown, /"nope" is not a toolbar item/);
  assert.match(bad.twice, /given twice/);
  assert.match(bad.shape, /toolbar must be false or an array/);
  mark('`toolbar: [...]` builds the items in its order with their priorities and a divider between two visible items; a wrong list throws');

  // ---- `toolbar: false` with the items in the host's own elements (mode B) --------------------------------------------------------------
  const modeB = await ev(async (d) => {
    window.ed?.destroy();
    document.querySelector('#own')?.remove();
    const own = document.createElement('header');
    own.id = 'own';
    own.innerHTML = '<span id="own-title"></span><span id="own-history"></span><span id="own-counter"></span><span id="own-views"></span><span id="own-expand"></span>';
    document.body.prepend(own);
    const pick = (id) => document.querySelector(`#own-${id}`);
    const host = window.makeHost();
    window.ed = window.opfWs.createOpfEditor(host, { document: d, ...window.base(), toolbar: false, slots: { title: pick('title'), history: pick('history'), counter: pick('counter'), views: pick('views'), expand: pick('expand') } });
    await window.ed.ready;
    await window.ed.whenIdle();
    const out = {
      layout: window.ed.layout, bar: !!host.querySelector('.opf-ws-bar, .opf-tb'), source: !!host.querySelector('.opf-source'), canvas: !!host.querySelector('.opf-canvas svg'),
      title: pick('title').querySelector('.opf-title-input')?.value, undo: !!pick('history').querySelector('[data-opf-action=undo]'), counter: pick('counter').querySelector('.opf-nav-counter')?.textContent,
      views: pick('views').querySelectorAll('[data-opf-view-button]').length, expand: !!pick('expand').querySelector('.opf-expand-button'), toolbar: window.ed.toolbar === undefined,
    };
    window.ed.session.set('slides.0.title', 'Changed');
    pick('history').querySelector('[data-opf-action=undo]').click();
    out.undone = window.ed.getDocument().slides[0].title;
    pick('views').querySelector('[data-opf-view-button=outline]').click();
    out.view = window.ed.view;
    window.ed.setView('slide');
    window.ed.setSlide(2);
    await window.ed.whenIdle();
    out.counterAfter = pick('counter').querySelector('.opf-nav-counter').textContent;
    return out;
  }, deck());
  assert.deepEqual(modeB, { layout: 'full', bar: false, source: true, canvas: true, title: 'Workspace fixture', undo: true, counter: '01 / 03', views: 4, expand: true, toolbar: true, undone: 'Slide 1', view: 'outline', counterAfter: '03 / 03' });
  // A host that arranges the page itself puts the editor's toolbar in its own element.
  const ownBar = await ev(async (d) => {
    window.ed?.destroy();
    const host = window.makeHost();
    host.innerHTML = '<div id="s-bar"></div><div id="s-frame" style="width:800px;height:450px"><div id="s-canvas"></div></div>';
    window.ed = window.opfWs.createOpfEditor(host, { document: d, ...window.base(), toolbar: ['title', 'history', 'spacer', 'counter', 'more'], slots: { toolbar: host.querySelector('#s-bar'), canvas: host.querySelector('#s-canvas') } });
    await window.ed.ready;
    await window.ed.whenIdle();
    const bar = host.querySelector('#s-bar .opf-tb');
    return { layout: window.ed.layout, items: bar && [...bar.children].map((node) => node.dataset.opfToolbarItem), title: !!bar?.querySelector('.opf-title-input'), counter: bar?.querySelector('.opf-nav-counter')?.textContent };
  }, deck());
  assert.deepEqual(ownBar, { layout: 'slots', items: ['title', 'history', 'spacer', 'counter', 'more'], title: true, counter: '01 / 03' });
  await ev(() => document.querySelector('#own')?.remove());
  mark('`toolbar: false` builds no bar and mounts the title, the history, the counter, the views and expand in the host\'s elements; `slots.toolbar` takes the whole bar');

  // ---- overflow into ⋯ and back ---------------------------------------------------------------------------------------------------------------
  await ev((d) => window.mountEditor({ document: d, persistence: { key: 'tb2', storage: 'memory' } }), deck());
  const state = () => ev(() => {
    const bar = window.ed.toolbar.element;
    const priority = Object.fromEntries(window.ed.toolbar.items.map((item) => [item.id, item]));
    const collapsed = window.ed.toolbar.collapsed;
    const visible = window.ed.toolbar.items.filter((item) => item.collapsible && !collapsed.includes(item.id) && bar.querySelector(`[data-opf-toolbar-item=${item.id}]`)?.childNodes.length);
    return {
      collapsed,
      hiddenOk: collapsed.every((id) => getComputedStyle(bar.querySelector(`[data-opf-toolbar-item=${id}]`)).display === 'none'),
      lowestFirst: collapsed.every((id) => visible.every((item) => priority[id].priority <= item.priority)),
      more: !bar.querySelector('[data-opf-toolbar-item=more]').hidden,
      fits: [...bar.children].every((node) => node.hidden || getComputedStyle(node).display === 'none' || node.getBoundingClientRect().right <= bar.getBoundingClientRect().right + 0.5),
    };
  });
  await ev(() => { document.querySelector('#host').style.width = '560px'; });
  await page.waitForFunction(() => window.ed.toolbar.collapsed.length > 0, undefined, { timeout: 5000 });
  await ev(() => window.frames());
  const narrow = await state();
  assert.ok(narrow.hiddenOk && narrow.lowestFirst && narrow.more && narrow.fits, JSON.stringify(narrow));
  assert.ok(narrow.collapsed.includes('autosave') && narrow.collapsed.includes('views'), `the lowest priorities go first: ${narrow.collapsed}`);
  assert.ok(!narrow.collapsed.includes('history'), `history stays at 560px: ${narrow.collapsed}`);
  mark('a narrow bar moves the collapsible items into ⋯, lowest priority first, and the row fits its width');

  // The menu: its items, the keyboard, a run.
  const more = page.locator('.opf-tb-more-button');
  assert.equal(await more.getAttribute('aria-haspopup'), 'menu');
  await more.click();
  assert.equal(await more.getAttribute('aria-expanded'), 'true');
  const menu = await ev(() => ({ role: document.querySelector('.opf-tb-menu').getAttribute('role'), labels: [...document.querySelectorAll('.opf-tb-menu [role^=menuitem]')].map((node) => node.textContent), focused: document.activeElement.textContent, checked: document.querySelector('[data-opf-toolbar-menu-item="view:slide"]')?.getAttribute('aria-checked') }));
  assert.equal(menu.role, 'menu');
  assert.ok(menu.labels.includes('Find…') && menu.labels.includes('Sorter'), menu.labels.join(' | '));
  assert.equal(menu.focused, menu.labels[0], 'opening focuses the first item');
  assert.equal(menu.checked, 'true', 'the view on show is checked');
  await page.keyboard.press('ArrowDown');
  assert.equal(await ev(() => document.activeElement.textContent), menu.labels[1]);
  await page.keyboard.press('End');
  assert.equal(await ev(() => document.activeElement.textContent), menu.labels.at(-1));
  await page.keyboard.press('ArrowDown');
  assert.equal(await ev(() => document.activeElement.textContent), menu.labels[0], 'the arrows wrap');
  await page.keyboard.press('Escape');
  assert.equal(await ev(() => document.querySelector('.opf-tb-menu').hidden), true);
  assert.equal(await ev(() => document.activeElement.classList.contains('opf-tb-more-button')), true, 'Escape returns the focus to ⋯');
  await page.keyboard.press('ArrowUp');
  assert.equal(await ev(() => document.activeElement.textContent), menu.labels.at(-1), 'ArrowUp on ⋯ opens at the last item');
  await page.keyboard.press('Escape');
  await more.press('Enter');
  await page.locator('.opf-tb-menu [data-opf-toolbar-menu-item="view:sorter"]').focus();
  await page.keyboard.press('Enter');
  assert.equal(await ev(() => window.ed.view), 'sorter', 'Enter runs the item');
  assert.equal(await ev(() => document.querySelector('.opf-tb-menu').hidden), true);
  await ev(() => window.ed.setView('slide'));
  await more.click();
  await page.locator('.opf-tb-menu [data-opf-toolbar-menu-item=find]').click();
  await page.waitForFunction(() => !document.querySelector('[data-opf-slot=find]').hidden && document.querySelector('[data-opf-slot=find]').contains(document.activeElement), undefined, { timeout: 5000 });
  await page.keyboard.press('Escape');
  await more.click();
  await page.mouse.click(5, 690);
  assert.equal(await ev(() => document.querySelector('.opf-tb-menu').hidden), true, 'a press outside closes the menu');
  mark('the ⋯ menu is a role=menu built from the collapsed parts: arrows, Home/End, Escape back to ⋯, Enter runs, a press outside closes');

  await ev(() => { document.querySelector('#host').style.width = '1200px'; });
  await page.waitForFunction(() => window.ed.toolbar.collapsed.length === 0, undefined, { timeout: 5000 });
  await ev(() => window.frames());
  assert.deepEqual(await state(), { collapsed: [], hiddenOk: true, lowestFirst: true, more: false, fits: true });
  mark('widening the bar brings every item back and hides ⋯');

  // ---- the counter: one slide index --------------------------------------------------------------------------------------------------------
  await ev((d) => window.mountEditor({ document: d, toolbar: ['title', 'history', 'counter', 'spacer', 'more'] }), deck());
  const counters = () => ev(() => [...document.querySelectorAll('#host .opf-nav-counter')].map((node) => node.textContent));
  assert.deepEqual(await counters(), ['01 / 03', '01 / 03'], 'the bar\'s counter and the slide row\'s');
  await ev(() => window.ed.setSlide(2));
  await page.waitForFunction(() => [...document.querySelectorAll('#host .opf-nav-counter')].every((node) => node.textContent === '03 / 03'), undefined, { timeout: 10000 });
  await page.locator('.opf-thumbs-item[data-index="1"]').click();
  await page.waitForFunction(() => window.ed.slideIndex === 1 && [...document.querySelectorAll('#host .opf-nav-counter')].every((node) => node.textContent === '02 / 03'), undefined, { timeout: 10000 });
  await page.locator('.opf-ws-counter .opf-nav-button').first().click();
  await page.waitForFunction(() => window.ed.slideIndex === 0, undefined, { timeout: 10000 });
  assert.deepEqual(await counters(), ['01 / 03', '01 / 03']);
  await ev(() => document.activeElement?.blur());
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => window.ed.slideIndex === 1, undefined, { timeout: 10000 });
  await ev(() => window.frames(4));
  assert.equal(await ev(() => window.ed.slideIndex), 1, 'one arrow press moves one slide: only one navigator binds the keys');
  mark('the toolbar counter follows setSlide, the strip and its own buttons, and only one navigator binds the arrow keys');

  // ---- layout: "embed" ---------------------------------------------------------------------------------------------------------------------
  await ev((d) => window.mountEditor({ document: d, layout: 'embed' }, 900), deck());
  assert.deepEqual(await items(), ['title', 'history', 'counter', 'spacer', 'expand', 'present', 'more']);
  await page.waitForFunction(() => document.querySelector('#host .opf-ws-canvas').getBoundingClientRect().width > 100, undefined, { timeout: 10000 });
  const embed = await ev(() => {
    const host = document.querySelector('#host');
    const frame = host.querySelector('.opf-ws-frame').getBoundingClientRect();
    const canvas = host.querySelector('.opf-ws-canvas').getBoundingClientRect();
    return {
      layout: host.querySelector('.opf-workspace').dataset.opfLayout, views: window.ed.views,
      parts: ['.opf-source', '.opf-thumbs', '.opf-ws-side', '.opf-ws-dock', '.opf-export'].filter((selector) => host.querySelector(selector)),
      counter: host.querySelector('.opf-ws-counter .opf-nav-counter')?.textContent, svg: !!host.querySelector('.opf-canvas svg'),
      fitted: canvas.width > 100 && canvas.width <= frame.width + 1 && canvas.height <= frame.height + 1 && (Math.abs(canvas.width - frame.width) < 2 || Math.abs(canvas.height - frame.height) < 2),
      status: getComputedStyle(host.querySelector('.opf-ws-status')).width,
    };
  });
  assert.deepEqual(embed, { layout: 'embed', views: ['slide'], parts: [], counter: '01 / 03', svg: true, fitted: true, status: '1px' });
  await ev(() => window.ed.setSlide(2));
  await page.waitForFunction(() => document.querySelector('.opf-ws-counter .opf-nav-counter').textContent === '03 / 03', undefined, { timeout: 10000 });
  // The embed keeps its keys: an arrow pressed outside it does nothing, inside it moves the slide.
  await ev(() => { document.activeElement?.blur(); window.ed.setSlide(0); });
  await page.waitForFunction(() => window.ed.slideIndex === 0);
  await page.keyboard.press('ArrowRight');
  await ev(() => window.frames(4));
  assert.equal(await ev(() => window.ed.slideIndex), 0, 'an arrow outside the embedded editor does not move it');
  await page.locator('.opf-ws-counter .opf-nav-button').first().focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => window.ed.slideIndex === 1, undefined, { timeout: 10000 });
  mark('layout "embed" mounts the slide alone (no source, strip, slide row, side panel or Export), fits it, and its counter and keys stay inside it');

  // ---- the deck name -------------------------------------------------------------------------------------------------------------------
  await ev((d) => window.mountEditor({ document: d, on: { deckName: (detail) => window.names.push(detail) } }), deck());
  await ev(() => { window.names = []; });
  assert.equal(await ev(() => window.ed.getDeckName()), 'Workspace fixture');
  assert.equal(await ev(() => window.ed.setDeckName('Quarterly review')), true);
  assert.equal(await ev(() => window.ed.getDocument().name), 'Quarterly review');
  assert.equal(await page.locator('.opf-title-input').inputValue(), 'Quarterly review');
  assert.equal(await ev(() => window.ed.undo()), true);
  assert.equal(await ev(() => window.ed.getDeckName()), 'Workspace fixture', 'the rename is one undoable edit');
  await ev(() => window.ed.setSourceText(JSON.stringify({ name: 'From source', design: { theme: 'classic', fontScheme: 'roboto' }, slides: [{ id: 's1', title: 'One' }] })));
  assert.equal(await ev(() => window.ed.setDeckName('   ')), true);
  assert.equal(await ev(() => 'name' in window.ed.getDocument()), false, 'an empty name removes the key');
  await page.locator('.opf-title-input').click();
  await page.locator('.opf-title-input').fill('Typed in the bar');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.ed.getDeckName() === 'Typed in the bar');
  await ev(() => window.ed.session.set('name', 'By the host'));
  assert.deepEqual(await ev(() => window.names), [
    { name: 'Quarterly review', previous: 'Workspace fixture' },
    { name: 'Workspace fixture', previous: 'Quarterly review' },
    { name: 'From source', previous: 'Workspace fixture' },
    { name: '', previous: 'From source' },
    { name: 'Typed in the bar', previous: '' },
    { name: 'By the host', previous: 'Typed in the bar' },
  ]);
  // Not over a source draft that is not a deck, nor while read-only.
  await ev(() => window.ed.sourcePane.editor.api.replace(0, window.ed.sourcePane.editor.api.getValue().length, '{ broken'));
  await ev(() => window.ed.sourcePane.getText());
  assert.equal(await ev(() => window.ed.setDeckName('Over a draft')), false);
  assert.equal(await page.locator('.opf-title').getAttribute('data-state'), 'disabled');
  await ev(() => window.ed.setSourceText(JSON.stringify({ name: 'Fixed', slides: [{ id: 'a', title: 'A' }] })));
  assert.equal(await page.locator('.opf-title').getAttribute('data-state'), 'editable');
  await ev(() => window.ed.setReadOnly(true));
  assert.equal(await ev(() => window.ed.setDeckName('Locked')), false);
  assert.equal(await page.locator('.opf-title').getAttribute('data-state'), 'readonly');
  // Before mount: queued, applied when the editor mounts.
  const early = await ev(async (d) => {
    window.ed.destroy();
    window.ed = window.opfWs.createOpfEditor(window.makeHost(), { document: d, ...window.base() });
    const accepted = window.ed.setDeckName('Named early');
    const before = window.ed.getDeckName();
    await window.ed.ready;
    return { accepted, before, after: window.ed.getDeckName(), field: document.querySelector('.opf-title-input').value };
  }, deck());
  assert.deepEqual(early, { accepted: true, before: 'Workspace fixture', after: 'Named early', field: 'Named early' });
  mark('setDeckName renames through the session (undoable, empty removes), the title field commits, and deckName is told for every source of change; refused over a draft and while read-only; queued before mount');

  // ---- expand ----------------------------------------------------------------------------------------------------------------------------
  await ev(() => { window.expands = []; window.ed.on('expand', (detail) => window.expands.push(detail.expanded)); });
  await page.locator('.opf-expand-button').click();
  const expanded = await ev(() => ({ expanded: window.ed.expanded, attribute: document.querySelector('#host').hasAttribute('data-opf-expanded'), fills: Math.round(document.querySelector('#host').getBoundingClientRect().width) === innerWidth, pressed: document.querySelector('.opf-expand-button').getAttribute('aria-pressed') }));
  assert.deepEqual(expanded, { expanded: true, attribute: true, fills: true, pressed: 'true' });
  await page.locator('.opf-expand-button').focus();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.ed.expanded);
  assert.equal(await ev(() => window.ed.expand()), true);
  assert.equal(await ev(() => window.ed.expand(false)), false);
  assert.deepEqual(await ev(() => window.expands), [true, false, true, false]);
  const noExpand = await ev(async (d) => {
    window.ed.destroy();
    window.ed = window.opfWs.createOpfEditor(window.makeHost(), { document: d, ...window.base(), expand: false, toolbar: ['title', 'expand', 'more'] });
    const early = window.ed.expand();
    await window.ed.ready;
    return { early, now: window.ed.expand(), button: !!document.querySelector('#host .opf-expand-button') };
  }, deck());
  assert.deepEqual(noExpand, { early: false, now: false, button: false });
  mark('the expand item and expand(on) make the editor fill the window and back (the button, Escape, the handle), each told as `expand`; `expand: false` turns it off');

  console.log(checks.map((name) => `ok - ${name}`).join('\n'));
  assert.deepEqual(errors, [], errors.join('\n'));
} finally {
  await app.close();
}
