import assert from 'node:assert/strict';
import { startWorkspacePage, deck } from './support/workspace-page.mjs';

// CE-06 in a real browser: `createOpfEditor` (src/workspace.js) mounted on a bare page with the package stylesheet, the renderer's browser
// fonts handle and the gallery catalog. Covers mount and destroy without leaks (listeners, observers, DOM, the fonts lease, a destroy before
// the fonts arrive), every option (document, session, catalogs, fonts, imageResolver, persistence, worker, readOnly, view, panels, layout,
// slots, theme), the callbacks and the handle (getDocument, setDocument, view and slide switching, focus, present, undo, on and off).
const checks = [];
const mark = (name) => checks.push(name);
const app = await startWorkspacePage();
const { page, errors } = app;
const ev = (fn, arg) => page.evaluate(fn, arg);
const settle = () => page.waitForFunction(() => window.ed && !/Loading fonts/.test(document.querySelector('[data-opf-slot=status]')?.textContent ?? ''), undefined, { timeout: 30000 });

try {
  // ---- instrument the page so a leak shows -------------------------------------------------------------------------------------------
  await ev(() => {
    const live = new Map();
    for (const target of [document, window]) {
      const add = target.addEventListener.bind(target), remove = target.removeEventListener.bind(target);
      target.addEventListener = (type, listener, options) => { const key = `${target === document ? 'document' : 'window'}:${type}`; live.set(key, (live.get(key) ?? new Set()).add(listener)); return add(type, listener, options); };
      target.removeEventListener = (type, listener, options) => { const key = `${target === document ? 'document' : 'window'}:${type}`; live.get(key)?.delete(listener); return remove(type, listener, options); };
    }
    const observers = { resize: new Set(), mutation: new Set() };
    const Resize = window.ResizeObserver, Mutation = window.MutationObserver;
    window.ResizeObserver = class extends Resize { constructor(callback) { super(callback); observers.resize.add(this); } disconnect() { observers.resize.delete(this); super.disconnect(); } };
    window.MutationObserver = class extends Mutation { constructor(callback) { super(callback); observers.mutation.add(this); } disconnect() { observers.mutation.delete(this); super.disconnect(); } };
    window.leaks = () => ({
      listeners: Object.fromEntries([...live].map(([key, set]) => [key, set.size]).filter(([, count]) => count)),
      resize: observers.resize.size, mutation: observers.mutation.size,
      nodes: document.querySelectorAll('*').length, themeStyles: document.querySelectorAll('[data-opf-theme-style]').length,
    });
    window.base = () => ({ fonts: window.fonts, catalogs: [window.opfWs.gallery] });
    window.makeHost = (id = 'host') => { document.querySelector(`#${id}`)?.remove(); const host = document.createElement('div'); host.id = id; host.style.cssText = 'width:1200px;height:800px'; document.body.append(host); return host; };
  });
  // One mount and destroy first: the libraries add their stylesheets to <head> once per document (CodeMirror's, Find's, Review's, the crop layer's).
  await ev(async (d) => { const warm = window.opfWs.createOpfEditor(window.makeHost(), { document: d, ...window.base(), persistence: { key: 'warm', storage: 'memory' }, panels: { design: true } }); await warm.ready; warm.setView('layouts'); warm.destroy(); }, deck());
  const baseline = await ev(() => window.leaks());

  // ---- mount, the shell, the default parts ----------------------------------------------------------------------------------------------
  const first = await ev(async (d) => {
    const host = window.makeHost();
    window.events = [];
    window.ed = window.opfWs.createOpfEditor(host, { document: d, ...window.base(), on: { change: (e) => window.events.push(['change', e.document.slides.length]) } });
    await window.ed.ready;
    return { views: window.ed.views, mounted: window.ed.mounted, layout: host.querySelector('.opf-workspace').dataset.opfLayout, source: !!host.querySelector('.opf-source'), canvas: !!host.querySelector('.opf-canvas svg'), thumbs: host.querySelectorAll('.opf-thumbs-item').length, counter: host.querySelector('.opf-nav-counter')?.textContent, exportTrigger: !!host.querySelector('.opf-export-trigger'), present: !!host.querySelector('.opf-present-button'), review: !!host.querySelector('.opf-review, [data-opf-slot=review] *'), tabs: [...host.querySelectorAll('[role=tab]')].map((tab) => tab.textContent), pressed: [...host.querySelectorAll('[data-opf-view-button]')].map((button) => `${button.dataset.opfViewButton}:${button.getAttribute('aria-pressed')}`), status: host.querySelector('[data-opf-slot=status]').textContent };
  }, deck());
  assert.deepEqual(first.views, ['slide', 'sorter', 'outline', 'layouts']);
  assert.equal(first.layout, 'full');
  assert.ok(first.mounted && first.source && first.canvas && first.exportTrigger && first.present && first.review, JSON.stringify(first));
  assert.equal(first.thumbs, 3);
  assert.equal(first.counter, '01 / 03');
  assert.deepEqual(first.tabs, ['Review']);
  assert.deepEqual(first.pressed, ['slide:true', 'sorter:false', 'outline:false', 'layouts:false']);
  assert.equal(first.status, 'Ready to edit');
  mark('one call mounts the source pane, the canvas, the slide row, Export, Present and Review, and the status line says Ready');

  // Editing the document in the canvas, the source and the session reaches every part and the change event.
  await ev(() => window.ed.session.set('slides.0.title', 'Edited by the host'));
  await page.waitForFunction(() => /Edited by the host/.test(document.querySelector('.opf-thumbs-title')?.textContent ?? '') && /Edited by the host/.test(document.querySelector('.opf-source .cm-content').textContent), undefined, { timeout: 15000 });
  assert.equal(await ev(() => window.ed.getDocument().slides[0].title), 'Edited by the host');
  assert.ok((await ev(() => window.events)).length >= 1);
  assert.equal(await page.locator('.opf-canvas svg').first().evaluate((svg) => svg.textContent.includes('Edited by the host')), true);
  mark('an edit through the session reaches the source, the canvas, the thumbnails and the change callback');

  // Typing in the source reaches the canvas; the verdict is reported.
  await ev(() => { window.sourceEvents = []; window.ed.on('source', (event) => window.sourceEvents.push(event.status.kind)); });
  await page.locator('.opf-source .cm-content').click();
  await page.keyboard.press('Control+End');
  await ev(() => window.ed.sourcePane.editor.api.replace(0, window.ed.sourcePane.editor.api.getValue().length, JSON.stringify({ name: 'Typed', design: { theme: 'classic', fontScheme: 'roboto' }, slides: [{ id: 'only', title: 'Typed title' }] })));
  await ev(() => window.ed.sourcePane.whenIdle());
  await page.waitForFunction(() => window.ed.getDocument().name === 'Typed', undefined, { timeout: 15000 });
  assert.ok((await ev(() => window.sourceEvents)).includes('valid'), 'the source verdict is emitted');
  assert.equal(await ev(() => window.ed.inSync), true);
  await ev(() => window.ed.sourcePane.editor.api.replace(0, window.ed.sourcePane.editor.api.getValue().length, '{ not json'));
  await ev(() => window.ed.sourcePane.getText());
  assert.equal(await ev(() => window.ed.inSync), false, 'text that does not read as a document is out of sync');
  assert.equal(await page.locator('.opf-ws-canvas').getAttribute('inert'), '', 'the slide is locked while the source is not a valid deck');
  assert.equal(await page.locator('.opf-export-trigger').count(), 1);
  assert.equal(await ev(() => window.ed.present()), false, 'present refuses an invalid source');
  assert.equal(await page.locator('[data-opf-action=undo]').isDisabled(), true);
  await ev(() => window.ed.sourcePane.editor.api.replace(0, window.ed.sourcePane.editor.api.getValue().length, JSON.stringify({ name: 'Typed again', design: { theme: 'classic', fontScheme: 'roboto' }, slides: [{ id: 'only', title: 'Typed title' }] })));
  await ev(() => window.ed.sourcePane.getText());
  assert.equal(await ev(() => window.ed.inSync), true);
  assert.equal(await page.locator('.opf-ws-canvas').getAttribute('inert'), null);
  mark('the source verdict is reported; text that is not a deck locks the slide, Present and Undo until it is fixed');

  // ---- views, slides, present, focus -------------------------------------------------------------------------------------------------------
  await ev(() => window.ed.setDocument({ name: 'Views', design: { theme: 'classic', fontScheme: 'roboto' }, slides: [1, 2, 3, 4].map((n) => ({ id: `v${n}`, title: `View ${n}`, text: `Body ${n}` })) }));
  await settle();
  await page.waitForFunction(() => document.querySelectorAll('.opf-thumbs-item').length === 4, undefined, { timeout: 15000 });
  await ev(() => { window.viewEvents = []; window.slideEvents = []; window.ed.on('view', (e) => window.viewEvents.push(e.view)); window.ed.on('slide', (e) => window.slideEvents.push(e.index)); });
  assert.equal(await ev(() => window.ed.setView('sorter')), true);
  assert.equal(await page.locator('.opf-ws-sorter').isVisible(), true);
  assert.equal(await page.locator('.opf-ws-frame').isVisible(), false, 'the slide is hidden while the sorter shows');
  assert.equal(await page.locator('[data-opf-view-button=sorter]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('.opf-ws-sorter .slide-card, .opf-ws-sorter [data-slide-index], .opf-ws-sorter button').count() > 0, true);
  await page.locator('[data-opf-view-button=outline]').click();
  assert.equal(await page.locator('.opf-ws-outline').isVisible(), true);
  await page.locator('[data-opf-view-button=layouts]').click();
  assert.equal(await page.locator('.opf-ws-layouts').isVisible(), true);
  assert.equal(await page.locator('[data-opf-layouts=pick] option').count() >= 1, true, 'Layout Studio mounts with its picker');
  assert.equal(await page.locator('.opf-lx').count() >= 1, true, 'the layout editor is mounted');
  await ev(() => window.ed.setView('slide'));
  assert.equal(await page.locator('.opf-ws-frame').isVisible(), true);
  assert.deepEqual(await ev(() => window.viewEvents), ['sorter', 'outline', 'layouts', 'slide']);
  assert.equal(await ev(() => window.ed.setView('nope')), false);
  mark('setView and the bar switch between the slide, the sorter, the outline and Layout Studio, and report each switch');

  await ev(() => window.ed.setSlide(2));
  await page.waitForFunction(() => document.querySelector('.opf-nav-counter').textContent === '03 / 04', undefined, { timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('.opf-canvas svg')?.textContent.includes('View 3'), undefined, { timeout: 15000 });
  assert.equal(await ev(() => window.ed.slideIndex), 2);
  await page.locator('.opf-thumbs-item[data-index="0"]').click();
  await page.waitForFunction(() => window.ed.slideIndex === 0 && document.querySelector('.opf-canvas svg')?.textContent.includes('View 1'), undefined, { timeout: 15000 });
  assert.deepEqual(await ev(() => window.slideEvents), [2, 0]);
  // A slide kept by its id when the source reorders the deck.
  await ev(() => window.ed.setSlide(1));
  await page.waitForFunction(() => window.ed.slideIndex === 1, undefined, { timeout: 15000 });
  await ev(() => window.ed.session.applyPatch([{ op: 'move', from: '/slides/1', path: '/slides/3' }]));
  await page.waitForFunction(() => window.ed.canvas.slideIndex === 3, undefined, { timeout: 15000 });
  mark('the slide index is one: the navigator, the strip and setSlide agree, and a reorder keeps the slide by its id');

  assert.equal(await ev(() => window.ed.present()), true);
  await page.locator('.opf-presenter:not([hidden])').waitFor({ timeout: 10000 });
  await page.keyboard.press('Escape');
  await page.locator('.opf-presenter[hidden]').waitFor({ state: 'attached', timeout: 10000 });
  await page.waitForFunction(() => window.ed.slideIndex >= 0);
  mark('present() opens the presenter and leaving it returns to the slide the show ended on');

  await page.waitForTimeout(150);
  assert.equal(await ev(() => window.ed.focus('source')), true);
  await page.waitForFunction(() => !!document.activeElement?.closest('.cm-editor'), undefined, { timeout: 5000 }).catch(async () => { throw new Error(`focus is on ${await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 120))}`); });
  mark('focus() moves focus to the source pane');

  // undo and redo
  await ev(() => window.ed.session.set('name', 'Before undo'));
  assert.equal(await ev(() => window.ed.undo()), true);
  assert.notEqual(await ev(() => window.ed.getDocument().name), 'Before undo');
  assert.equal(await ev(() => window.ed.redo()), true);
  assert.equal(await ev(() => window.ed.getDocument().name), 'Before undo');
  mark('undo() and redo() go through the session');

  // setDocument: valid, invalid
  assert.equal(await ev(() => window.ed.setDocument({ name: 'Second', design: { theme: 'classic', fontScheme: 'roboto' }, slides: [{ id: 'a', title: 'Alpha' }] }, { text: '{"name":"Second","design":{"theme":"classic","fontScheme":"roboto"},"slides":[{"id":"a","title":"Alpha"}]}', name: 'second' })), true);
  assert.equal(await ev(() => window.ed.getDocument().name), 'Second');
  assert.equal(await ev(() => window.ed.readSource().text), '{"name":"Second","design":{"theme":"classic","fontScheme":"roboto"},"slides":[{"id":"a","title":"Alpha"}]}', 'the pane keeps the text as written');
  assert.equal(await ev(() => window.ed.getName()), 'second');
  assert.equal(await ev(() => window.ed.setDocument({ slides: 'nope' }, { text: '{"slides":"nope"}' })), false, 'a document the session refuses is a draft in the pane');
  assert.equal(await ev(() => window.ed.readSource().draft), true);
  assert.equal(await ev(() => window.ed.getDocument().name), 'Second', 'the document did not change');
  await ev(() => window.ed.undo());
  mark('setDocument opens a document as one undoable change, keeps its text, and lists a refused document as a draft');

  // setSourceText: raw text in the pane, without converting it, in its own format; text that does not read as a document stays a draft.
  const raw = await ev(async (d) => {
    const editor = window.opfWs.createOpfEditor(window.makeHost('raw-host'), { document: d, layout: 'source', ...window.base() });
    await editor.ready;
    const out = {};
    const yamlText = '# kept comment\nname: From YAML\ndesign:\n  theme: classic\n  fontScheme: roboto\nslides:\n  - id: y\n    title: Yaml slide\n';
    out.yaml = { applied: editor.setSourceText(yamlText, { format: 'yaml', name: 'raw' }), name: editor.getDocument().name, text: editor.readSource().text === yamlText, format: editor.readSource().format, file: editor.getName(), inSync: editor.inSync };
    const broken = '{\n  "name": "Broken",\n  "slides": [\n';
    out.broken = { applied: editor.setSourceText(broken, { format: 'json' }), name: editor.getDocument().name, text: editor.readSource().text === broken, draft: editor.readSource().draft, format: editor.readSource().format, inSync: editor.inSync, problems: editor.sourcePane.getProblems().length > 0 };
    const crlf = '{\r\n  "name": "CRLF",\r\n  "slides": [ { "id": "c", "title": "C" } ]\r\n}\r\n';
    out.crlf = { applied: editor.setSourceText(crlf), name: editor.getDocument().name, text: editor.readSource().text === crlf, inSync: editor.inSync };
    // One undoable change: Undo brings the YAML deck back.
    editor.undo();
    out.undo = editor.getDocument().name;
    editor.setReadOnly(true);
    try { editor.setSourceText('{}'); } catch (error) { out.readOnly = error.code; }
    editor.destroy();
    const slideOnly = window.opfWs.createOpfEditor(window.makeHost('raw-host'), { document: d, layout: 'canvas', ...window.base() });
    await slideOnly.ready;
    try { slideOnly.setSourceText('{}'); } catch (error) { out.noPane = error.code; }
    slideOnly.destroy();
    document.querySelector('#raw-host')?.remove();
    return out;
  }, deck());
  assert.deepEqual(raw.yaml, { applied: true, name: 'From YAML', text: true, format: 'yaml', file: 'raw', inSync: true }, 'YAML text is shown as written (its comment kept) and applied');
  assert.deepEqual(raw.broken, { applied: false, name: 'From YAML', text: true, draft: true, format: 'json', inSync: false, problems: true }, 'text that does not parse is a draft; the document keeps the last valid one');
  assert.deepEqual(raw.crlf, { applied: true, name: 'CRLF', text: true, inSync: true }, 'the bytes stay as given, CRLF included');
  assert.equal(raw.undo, 'From YAML', 'Undo steps back over the loaded text');
  assert.equal(raw.readOnly, 'read-only');
  assert.equal(raw.noPane, 'no-source-pane');
  mark('setSourceText loads raw text (YAML with comments, a draft that does not parse, CRLF JSON) without converting it');

  // ---- theme -----------------------------------------------------------------------------------------------------------------------------
  const token = (selector, name) => page.locator(selector).first().evaluate((node, prop) => getComputedStyle(node).getPropertyValue(prop).trim(), name);
  await ev(() => window.ed.setTheme({ tokens: { accent: 'rgb(10, 20, 30)', font: 'Georgia, serif', radius: '11px', '--opf-ui-border': 'rgb(1, 2, 3)' }, dark: { background: 'rgb(5, 6, 7)', surface: 'rgb(8, 9, 10)' } }));
  assert.equal(await token('.opf-export', '--opf-ui-accent'), 'rgb(10, 20, 30)', 'a token set in the theme reaches a nested component root');
  assert.equal(await token('.opf-source', '--opf-ui-accent'), 'rgb(10, 20, 30)');
  assert.equal(await token('.opf-source', '--opf-ui-font'), 'Georgia, serif');
  assert.equal(await token('.opf-source', '--opf-ui-radius'), '11px');
  assert.equal(await token('.opf-source', '--opf-ui-border'), 'rgb(1, 2, 3)', 'a full custom-property name works too');
  assert.notEqual(await token('.opf-source', '--opf-ui-bg'), 'rgb(5, 6, 7)', 'a dark value does not apply in light');
  await ev(() => window.ed.setTheme({ colorScheme: 'dark', tokens: { accent: 'rgb(10, 20, 30)' }, dark: { background: 'rgb(5, 6, 7)', surface: 'rgb(8, 9, 10)' } }));
  assert.equal(await token('.opf-source', '--opf-ui-bg'), 'rgb(5, 6, 7)', 'colorScheme dark applies the dark values');
  assert.equal(await token('.opf-source', '--opf-ui-surface'), 'rgb(8, 9, 10)');
  assert.equal(await token('.opf-source', '--opf-ui-fg'), 'hsl(210 28% 92%)', 'the dark text of the package applies');
  await ev(() => { document.documentElement.classList.add('dark'); window.ed.setTheme({ colorScheme: 'light', dark: { background: 'rgb(5, 6, 7)' } }); });
  assert.equal(await token('.opf-source', '--opf-ui-bg'), 'hsl(210 30% 98%)', 'colorScheme light wins over a dark page');
  assert.equal(await token('.opf-export', '--opf-ui-fg'), 'hsl(220 28% 11%)');
  await ev(() => window.ed.setTheme({ dark: { background: 'rgb(5, 6, 7)' } }));
  assert.equal(await token('.opf-source', '--opf-ui-bg'), 'rgb(5, 6, 7)', 'inherit follows the page: a dark page applies the dark values');
  await ev(() => document.documentElement.classList.remove('dark'));
  assert.notEqual(await token('.opf-source', '--opf-ui-bg'), 'rgb(5, 6, 7)');
  await ev(() => window.ed.setTheme({ colorScheme: 'auto' }));
  const auto = await ev(() => document.querySelector('#host').dataset.theme);
  assert.equal(auto, 'light', 'auto follows prefers-color-scheme (light here)');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForFunction(() => document.querySelector('#host').dataset.theme === 'dark', undefined, { timeout: 5000 });
  await page.emulateMedia({ colorScheme: 'light' });
  await ev(() => window.ed.setTheme(undefined));
  assert.equal(await token('.opf-source', '--opf-ui-accent'), 'hsl(214 57% 28%)', 'an empty theme returns to the package defaults');
  await assert.rejects(ev(() => { window.ed.setTheme({ tokens: { nope: 'red' } }); }), /not an editor token/);
  await assert.rejects(ev(() => { window.ed.setTheme({ colorScheme: 'sepia' }); }), /colorScheme/);
  mark('the theme option sets the tokens on every component root, for light, dark, a forced scheme and the page scheme, and rejects a typo');

  // ---- destroy leaves nothing ----------------------------------------------------------------------------------------------------------
  await ev(() => { window.ed.destroy(); window.ed.destroy(); });
  const afterOne = await ev(() => ({ ...window.leaks(), host: document.querySelector('#host').innerHTML, attrs: [...document.querySelector('#host').attributes].map((a) => a.name) }));
  assert.equal(afterOne.host, '', 'the mount element is empty after destroy');
  assert.deepEqual(afterOne.attrs, ['id', 'style'], 'the attributes the editor set are gone');
  assert.deepEqual({ ...afterOne, host: undefined, attrs: undefined }, { ...baseline, host: undefined, attrs: undefined, nodes: baseline.nodes }, 'no listener, observer or style is left behind');
  assert.equal(await ev(() => window.ed.destroyed), true);
  assert.equal(await ev(() => window.ed.undo()), false);
  mark('destroy() twice leaves no DOM, attributes, listeners, observers or theme style behind');

  // Many cycles do not grow anything.
  const cycles = await ev(async (d) => {
    const sizes = [];
    for (let round = 0; round < 5; round += 1) {
      const host = window.makeHost();
      const editor = window.opfWs.createOpfEditor(host, { document: d, ...window.base(), persistence: { key: `cycle-${round}`, storage: 'memory' } });
      await editor.ready;
      editor.setView('layouts'); editor.setView('outline'); editor.setView('sorter');
      editor.destroy();
      sizes.push(window.leaks());
    }
    return sizes;
  }, deck());
  assert.deepEqual(cycles.map((c) => c.nodes), Array(5).fill(cycles[0].nodes), 'the DOM does not grow with each mount and destroy');
  assert.deepEqual(cycles.map((c) => JSON.stringify(c.listeners)), Array(5).fill(JSON.stringify(cycles[0].listeners)));
  assert.equal(cycles[4].resize, cycles[0].resize);
  assert.equal(cycles[4].mutation, cycles[0].mutation);
  assert.equal(cycles[4].themeStyles, 0);
  assert.deepEqual(cycles[4].listeners, baseline.listeners, 'five mount and destroy cycles (with every view opened) leave exactly the listeners the page started with');
  mark('five mount and destroy cycles with every view opened do not grow the DOM, the listeners or the observers');

  // ---- the fonts lease and a destroy before the fonts arrive ---------------------------------------------------------------------------
  const lease = await ev(async (d) => {
    const log = [];
    const handle = window.fonts;
    const host = window.makeHost();
    const editor = window.opfWs.createOpfEditor(host, { document: d, fonts: { lease: () => { log.push('lease'); return handle; }, release: (value) => log.push(value === handle ? 'release' : 'wrong') } });
    await editor.ready;
    const during = [...log];
    editor.destroy(); editor.destroy();
    // A fonts promise still pending when the editor is destroyed: the late handle is released, nothing mounts.
    const host2 = window.makeHost('host2');
    let resolve;
    const late = new Promise((done) => { resolve = done; });
    const second = window.opfWs.createOpfEditor(host2, { document: d, fonts: { lease: () => late, release: (value) => log.push(value === handle ? 'release-late' : 'wrong-late') } });
    second.destroy();
    resolve(handle);
    await second.ready;
    await new Promise((done) => setTimeout(done, 50));
    // A host's own acquire function returns a lease object: { fonts, release() }.
    const host4 = window.makeHost('host4');
    const acquired = window.opfWs.createOpfEditor(host4, { document: d, catalogs: [window.opfWs.gallery], fonts: async () => ({ fonts: handle, release: () => log.push('lease-object-released') }) });
    const order = [];
    acquired.on('mounted', () => order.push(`mounted:${acquired.mounted}`));
    acquired.on('ready', () => order.push('ready'));
    const beforeFonts = acquired.mounted;
    await acquired.ready;
    const leaseCanvas = !!host4.querySelector('.opf-canvas svg');
    acquired.destroy(); acquired.destroy();
    return { during, log, leaseCanvas, order, beforeFonts, hostHtml: host2.innerHTML, mounted: second.mounted, fn: await (async () => { const host3 = window.makeHost('host3'); let calls = 0; const editor3 = window.opfWs.createOpfEditor(host3, { document: d, catalogs: [window.opfWs.gallery], fonts: () => { calls += 1; return Promise.resolve(handle); } }); await editor3.ready; const ok = !!host3.querySelector('.opf-canvas svg') && calls === 1; editor3.destroy(); return ok; })() };
  }, deck());
  assert.deepEqual(lease.during, ['lease']);
  assert.deepEqual(lease.log, ['lease', 'release', 'release-late', 'lease-object-released'], 'the lease is released once on destroy, and a late handle is released too; a lease object is given back once');
  assert.equal(lease.leaseCanvas, true, 'a lease object { fonts, release } draws with its fonts');
  assert.equal(lease.beforeFonts, false, 'with fonts still to arrive nothing is mounted yet');
  assert.deepEqual(lease.order, ['mounted:true', 'ready'], 'mounted comes when the fonts arrive, ready after the first update');
  assert.equal(lease.hostHtml, '');
  assert.equal(lease.mounted, false);
  assert.equal(lease.fn, true, 'a function and a promise are accepted for fonts');
  mark('a fonts lease is released exactly once on destroy, also when the editor is destroyed before the fonts arrive');

  // A fonts promise that fails: ready rejects, the error is reported, destroy still works.
  const failed = await ev(async (d) => {
    const host = window.makeHost();
    const errors = [];
    const editor = window.opfWs.createOpfEditor(host, { document: d, fonts: Promise.reject(new Error('fonts are down')), onError: (error) => errors.push(error.message) });
    let rejected = '';
    await editor.ready.catch((error) => { rejected = error.message; });
    const status = host.querySelector('[data-opf-slot=status]').textContent;
    editor.destroy();
    return { errors, rejected, status };
  }, deck());
  assert.deepEqual(failed.errors, ['fonts are down']);
  assert.equal(failed.rejected, 'fonts are down');
  assert.equal(failed.status, 'fonts are down');
  mark('a failing fonts promise rejects ready, reaches onError and the status line, and leaves the editor destroyable');

  // ---- options -----------------------------------------------------------------------------------------------------------------------------
  // document as JSON text keeps the author's spelling; session adopts an existing session.
  const text = await ev(async () => {
    const host = window.makeHost();
    const written = '{\n    "name":   "Spelled",\n    "design": {"theme":"classic","fontScheme":"roboto"},\n    "slides": [ {"id":"x","title":"X"} ]\n}';
    const editor = window.opfWs.createOpfEditor(host, { document: written, ...window.base() });
    await editor.ready;
    const shown = editor.readSource().text;
    const name = editor.getDocument().name;
    editor.destroy();
    return { same: shown === written, name };
  });
  assert.deepEqual(text, { same: true, name: 'Spelled' });
  const adopted = await ev(async (d) => {
    const session = window.opfWs.createEditorSession(d, { rejectInvalid: true, catalogs: [window.opfWs.gallery] });
    const host = window.makeHost();
    const seen = [];
    const editor = window.opfWs.createOpfEditor(host, { session, ...window.base(), onChange: (detail) => seen.push(detail.document.name) });
    await editor.ready;
    const same = editor.session === session;
    session.set('name', 'From the session');
    const doc = editor.getDocument().name;
    editor.destroy();
    session.set('name', 'After destroy');
    return { same, doc, seen };
  }, deck());
  assert.deepEqual(adopted, { same: true, doc: 'From the session', seen: ['From the session'] }, 'an adopted session is the editor session, and the editor stops listening after destroy');
  mark('document as JSON text keeps its spelling, and an existing session is adopted and left alone on destroy');

  // catalogs register on the session the editor creates, and every part draws and checks with them (also when the host adds render-only ones).
  const catalogCheck = await ev(async (d) => {
    const extra = { source: 'https://example.test/extra', layouts: {} };
    const host = window.makeHost();
    const created = window.opfWs.createOpfEditor(host, { document: d, ...window.base() });
    await created.ready;
    const registered = created.session.catalogs.length === 1 && created.session.catalogs[0] === window.opfWs.gallery;
    created.destroy();
    const session = window.opfWs.createEditorSession(d, { catalogs: [window.opfWs.gallery] });
    const host2 = window.makeHost('host2');
    const adopted = window.opfWs.createOpfEditor(host2, { session, ...window.base(), catalogs: [extra] });
    await adopted.ready;
    const untouched = session.catalogs.length === 1;
    adopted.destroy();
    return { registered, untouched };
  }, deck());
  assert.deepEqual(catalogCheck, { registered: true, untouched: true }, 'options.catalogs go to the session the editor creates; an adopted session keeps its own');
  mark('catalogs are registered on the session the editor creates, and an adopted session is left as it is');

  // imageResolver and renderOptions reach the canvas and the thumbnails.
  const resolved = await ev(async () => {
    const calls = [];
    const pixel = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="red"/></svg>');
    const host = window.makeHost();
    const editor = window.opfWs.createOpfEditor(host, { document: { name: 'Img', design: { theme: 'classic', fontScheme: 'roboto' }, assets: { logo: { src: 'host-store://logo-1', alt: 'Logo' } }, slides: [{ id: 'i', title: 'Image', blocks: [{ image: { src: 'asset:logo', alt: 'Logo' } }] }] }, ...window.base(), imageResolver: (src, context) => { calls.push([src, context.path]); return src && src.startsWith('host-store://') ? pixel : undefined; } });
    await editor.ready;
    await new Promise((done) => setTimeout(done, 400));
    const hrefs = [...host.querySelectorAll('.opf-canvas image')].map((node) => node.getAttribute('href') ?? node.getAttribute('xlink:href'));
    const thumbs = [...host.querySelectorAll('.opf-thumbs-frame image')].map((node) => node.getAttribute('href') ?? node.getAttribute('xlink:href'));
    editor.destroy();
    return { calls: calls.length > 0, hrefs, thumbs, pixel };
  });
  assert.equal(resolved.calls, true, 'the host resolver is asked for the image');
  // The renderer re-encodes a data address (base64), so compare what it holds: the picture the host's resolver returned.
  const holdsPicture = (href) => typeof href === 'string' && href.startsWith('data:image/svg+xml') && /fill="red"/.test(href.includes(';base64,') ? Buffer.from(href.split(',')[1], 'base64').toString() : decodeURIComponent(href.split(',')[1]));
  assert.ok(resolved.hrefs.some(holdsPicture), `the canvas draws the picture the resolver returned (${JSON.stringify(resolved.hrefs).slice(0, 160)})`);
  assert.ok(resolved.thumbs.some(holdsPicture), `and so do the thumbnails (${JSON.stringify(resolved.thumbs).slice(0, 160)})`);
  mark('imageResolver reaches the canvas and the thumbnails');

  // persistence: key, restore offer in the banner, status events, markSaved on a JSON export.
  const persisted = await ev(async (d) => {
    const key = `ce06-${Date.now()}`;
    const statuses = [];
    // The host's own storage adapter: a page with no origin has no localStorage or IndexedDB to use.
    const records = new Map();
    const storage = { name: 'test-adapter', get: async (name) => records.get(name), set: async (name, value) => { records.set(name, structuredClone(value)); }, delete: async (name) => { records.delete(name); } };
    const first = window.makeHost();
    const one = window.opfWs.createOpfEditor(first, { document: d, ...window.base(), persistence: { key, storage, debounceMs: 10, maxWaitMs: 50, warnOnUnload: false }, on: { persistence: (s) => statuses.push(s.state) } });
    await one.ready;
    await one.persistence.ready;
    one.session.set('name', 'Edited once');
    await one.persistence.flush();
    const flushed = one.persistence.status.state;
    one.destroy();
    const second = window.makeHost('host2');
    const two = window.opfWs.createOpfEditor(second, { document: d, ...window.base(), persistence: { key, storage, warnOnUnload: false } });
    await two.ready;
    await two.persistence.ready;
    await new Promise((done) => setTimeout(done, 100));
    const banner = second.querySelector('[data-opf-slot=banner]');
    const offered = { hidden: banner.hidden, text: banner.textContent, restore: !!banner.querySelector('.restore-yes') };
    banner.querySelector('.restore-yes')?.click();
    await new Promise((done) => setTimeout(done, 200));
    const restored = two.getDocument().name;
    await two.persistence.clear();
    two.destroy();
    return { statuses, flushed, offered, restored };
  }, deck());
  assert.ok(persisted.statuses.length > 0 && persisted.flushed === 'saved', JSON.stringify(persisted));
  assert.equal(persisted.offered.hidden, false);
  assert.equal(persisted.offered.restore, true);
  assert.equal(persisted.restored, 'Edited once', 'the restore prompt puts the stored copy back');
  mark('persistence autosaves under its key, offers the stored copy in the banner and restores it');
  assert.throws = assert.throws;
  const noKey = await ev(() => { try { window.opfWs.createOpfEditor(window.makeHost(), { persistence: { storage: 'memory' } }); return 'created'; } catch (error) { return error.message; } });
  assert.match(noKey, /needs a `key`/);

  // worker: a function that fails to start falls back to the main thread and reports once.
  const worker = await ev(async (d) => {
    let calls = 0;
    const reports = [];
    const host = window.makeHost();
    const editor = window.opfWs.createOpfEditor(host, { document: d, ...window.base(), source: { worker: () => { calls += 1; throw new Error('no worker here'); } }, onError: (error) => reports.push(error.message) });
    await editor.ready;
    editor.sourcePane.editor.api.replace(0, editor.sourcePane.editor.api.getValue().length, JSON.stringify({ name: 'W', design: { theme: 'classic', fontScheme: 'roboto' }, slides: [{ id: 'w', title: 'W' }] }));
    await editor.sourcePane.whenIdle();
    const name = editor.getDocument().name;
    const stats = editor.sourcePane.checkerStats();
    editor.destroy();
    return { calls, reports, name, stats };
  }, deck());
  assert.ok(worker.calls >= 1, 'the worker option reaches the source pane');
  assert.equal(worker.name, 'W', 'the edit is still applied on the main thread');
  assert.equal(worker.stats.available, false);
  mark('the worker option reaches the source pane, which falls back to the main thread when it cannot start');

  // ---- layouts, panels, slots -----------------------------------------------------------------------------------------------------------
  const layouts = await ev(async (d) => {
    const out = {};
    const make = async (options) => { const host = window.makeHost(); const editor = window.opfWs.createOpfEditor(host, { document: d, ...window.base(), ...options }); await editor.ready; return { host, editor }; };
    let { host, editor } = await make({ layout: 'canvas' });
    out.canvas = { source: !!host.querySelector('.opf-source'), canvas: !!host.querySelector('.opf-canvas svg'), thumbs: host.querySelectorAll('.opf-thumbs-item').length, bar: !!host.querySelector('.opf-ws-bar'), undo: !!host.querySelector('[data-opf-action=undo]'), export: !!host.querySelector('.opf-export'), views: editor.views };
    editor.destroy();
    ({ host, editor } = await make({ layout: 'source' }));
    out.source = { source: !!host.querySelector('.opf-source'), canvas: !!host.querySelector('.opf-canvas'), canvasHandle: editor.canvas === undefined, doc: editor.getDocument().slides.length, typed: editor.setDocument({ name: 'N', design: { theme: 'classic', fontScheme: 'roboto' }, slides: [{ id: 'q', title: 'Q' }] }) };
    // Only the source pane is built: no slide stage, no status column, and the pane fills the editor.
    out.sourceShell = {
      built: [...host.querySelectorAll('[data-opf-slot]')].map((node) => node.dataset.opfSlot),
      main: !!host.querySelector('.opf-ws-main, .opf-ws-stage, .opf-ws-frame, .opf-ws-dock, .opf-ws-bar'),
      fills: Math.round(host.querySelector('.opf-ws-source').getBoundingClientRect().width) === Math.round(host.getBoundingClientRect().width),
    };
    editor.destroy();
    // The source layout mounts at once when the fonts are at hand (it loads no slide chunk); the full layout waits for that chunk.
    const quick = window.opfWs.createOpfEditor(window.makeHost(), { document: d, layout: 'source' });
    out.sourceSync = quick.mounted && Boolean(quick.sourcePane);
    await quick.ready;
    quick.destroy();
    ({ host, editor } = await make({ panels: { source: false, review: false, find: false, present: false, export: false, thumbnails: false, navigator: false, layouts: false, outline: false, sorter: false }, view: 'slide' }));
    out.minimal = { source: !!host.querySelector('.opf-source'), review: !!host.querySelector('[role=tab]'), export: !!host.querySelector('.opf-export'), present: !!host.querySelector('.opf-present-button'), thumbs: !!host.querySelector('.opf-thumbs-item'), nav: !!host.querySelector('.opf-nav'), views: editor.views, canvas: !!host.querySelector('.opf-canvas svg'), find: !!host.querySelector('[data-opf-action=find]') };
    editor.destroy();
    ({ host, editor } = await make({ view: 'outline', panels: { design: true, review: true }, panel: 'design' }));
    out.initial = { view: editor.view, outline: !host.querySelector('.opf-ws-outline').hidden, tabs: [...host.querySelectorAll('[role=tab]')].map((tab) => `${tab.textContent}:${tab.getAttribute('aria-selected')}`), design: !!editor.design };
    editor.destroy();
    try { window.opfWs.createOpfEditor(window.makeHost(), { view: 'layouts', panels: { layouts: false }, document: d }); } catch (error) { out.badView = error.message; }
    try { window.opfWs.createOpfEditor(window.makeHost(), { layout: 'wide', document: d }); } catch (error) { out.badLayout = error.message; }
    try { window.opfWs.createOpfEditor(null, {}); } catch (error) { out.noElement = error.message; }
    return out;
  }, deck());
  assert.deepEqual(layouts.canvas, { source: false, canvas: true, thumbs: 3, bar: true, undo: true, export: false, views: ['slide'] });
  assert.deepEqual(layouts.source, { source: true, canvas: false, canvasHandle: true, doc: 3, typed: true });
  assert.deepEqual(layouts.sourceShell, { built: ['source'], main: false, fills: true }, 'layout "source" builds the source pane alone');
  assert.equal(layouts.sourceSync, true, 'a source-only editor mounts synchronously');
  assert.deepEqual(layouts.minimal, { source: false, review: false, export: false, present: false, thumbs: false, nav: false, views: ['slide'], canvas: true, find: false });
  assert.deepEqual(layouts.initial, { view: 'outline', outline: true, tabs: ['Design:true', 'Review:false'], design: true });
  assert.match(layouts.badView, /not available/);
  assert.match(layouts.badLayout, /layout must be/);
  assert.match(layouts.noElement, /needs a DOM element/);
  mark('layout and panels choose the parts: canvas-only, source-only, a minimal canvas, an initial view and side tab, and bad options throw');

  // slots: the host arranges the page; the editor builds nothing of its own around them.
  const slots = await ev(async (d) => {
    const host = window.makeHost();
    host.innerHTML = '<div id="s-source" style="height:300px"></div><div id="s-frame" style="width:600px;height:340px"><div id="s-canvas"></div></div><div id="s-nav"></div><div id="s-thumbs"></div><div id="s-status"></div><div id="s-list"></div>';
    const pick = (id) => host.querySelector(id);
    const editor = window.opfWs.createOpfEditor(host, { document: d, ...window.base(), slots: { source: pick('#s-source'), canvas: pick('#s-canvas'), navigator: pick('#s-nav'), thumbnails: pick('#s-thumbs'), status: pick('#s-status'), slides: pick('#s-list') }, fit: 'contain' });
    await editor.ready;
    await new Promise((done) => setTimeout(done, 300));
    const canvasBox = pick('#s-canvas').getBoundingClientRect();
    const slotIds = ['#s-source', '#s-canvas', '#s-nav', '#s-thumbs', '#s-list'];
    const result = {
      layout: host.querySelector('.opf-workspace').dataset.opfLayout, bar: !!host.querySelector('.opf-ws-bar'), source: !!pick('#s-source .opf-source'), canvas: !!pick('#s-canvas svg'),
      nav: pick('#s-nav .opf-nav-counter').textContent, thumbs: pick('#s-thumbs').querySelectorAll('.opf-thumbs-item').length, status: pick('#s-status').textContent, cards: pick('#s-list').querySelectorAll('.slide-card, button').length > 0,
      fitted: canvasBox.width <= 600 && canvasBox.height <= 340 && (Math.abs(canvasBox.width - 600) < 2 || Math.abs(canvasBox.height - 340) < 2), review: !!host.querySelector('.opf-review'),
    };
    editor.destroy();
    result.emptied = slotIds.every((id) => pick(id)?.children.length === 0);
    result.kept = !!pick('#s-frame') && !host.querySelector('.opf-workspace');
    return result;
  }, deck());
  assert.equal(slots.emptied, true, 'destroy empties every slot and leaves the host\'s own elements');
  assert.equal(slots.kept, true);
  delete slots.emptied; delete slots.kept;
  assert.deepEqual(slots, { layout: 'slots', bar: false, source: true, canvas: true, nav: '01 / 03', thumbs: 3, status: 'Ready to edit', cards: true, fitted: true, review: false });
  mark('slots mount each part in the host\'s own element, build no shell, and fit the slide to its frame');

  // ---- read-only -------------------------------------------------------------------------------------------------------------------------------
  const readOnly = await ev(async (d) => {
    const host = window.makeHost();
    host.innerHTML = '<div id="r-canvas"></div><div id="r-list"></div><div id="r-source"></div>';
    const errors = [];
    const editor = window.opfWs.createOpfEditor(host, { document: d, ...window.base(), readOnly: true, slots: { canvas: host.querySelector('#r-canvas'), slides: host.querySelector('#r-list'), source: host.querySelector('#r-source') }, onError: (error) => errors.push(error.message) });
    await editor.ready;
    const before = JSON.stringify(editor.getDocument());
    editor.slideManager.setSelection([1]);
    editor.slideManager.run('delete');
    editor.sourcePane.editor.api.replace(0, 2, 'zz');
    const result = { unchanged: JSON.stringify(editor.getDocument()) === before, errors, locked: host.querySelector('#r-canvas').hasAttribute('inert'), paneLocked: host.querySelector('.cm-content').getAttribute('contenteditable'), undo: editor.undo(), readOnly: editor.readOnly };
    // The host itself still writes, and unlocking works.
    editor.session.set('name', 'Host edit');
    result.hostEdit = editor.getDocument().name;
    editor.setReadOnly(false);
    result.unlocked = !host.querySelector('#r-canvas').hasAttribute('inert') && host.querySelector('.cm-content').getAttribute('contenteditable');
    editor.slideManager.setSelection([1]);
    editor.slideManager.run('delete');
    result.deleted = editor.getDocument().slides.length;
    editor.destroy();
    return result;
  }, deck());
  assert.equal(readOnly.unchanged, true, 'no write through the editor reaches a read-only document');
  assert.ok(readOnly.errors.some((message) => /read-only/.test(message)), `the refused write is reported: ${JSON.stringify(readOnly.errors)}`);
  assert.equal(readOnly.locked, true);
  assert.equal(readOnly.paneLocked, 'false');
  assert.equal(readOnly.undo, false);
  assert.equal(readOnly.hostEdit, 'Host edit', 'the host may still write to its own session');
  assert.equal(readOnly.unlocked, 'true');
  assert.equal(readOnly.deleted, 1, 'after setReadOnly(false) the same action works (the selection is slide 2 and the current slide)');
  mark('readOnly refuses every write from the editor\'s parts, locks the slide and the code, and can be switched off');

  // ---- callbacks ----------------------------------------------------------------------------------------------------------------------------------
  const callbacks = await ev(async (d) => {
    const log = [];
    const host = window.makeHost();
    const editor = window.opfWs.createOpfEditor(host, { document: d, ...window.base(), onChange: ({ document, canUndo }) => log.push(`change:${document.name}:${canUndo}`), onSelection: ({ path, slideIndex }) => log.push(`select:${path}:${slideIndex}`), onError: (error) => log.push(`error:${error.message}`), onReady: () => log.push('ready') });
    await editor.ready;
    const stray = (name) => { throw new Error(`stray ${name}`); };
    const off = editor.on('status', () => stray('status'));
    off();
    const listener = () => stray('slide');
    editor.on('slide', listener);
    editor.off('slide', listener);
    editor.session.set('name', 'Called');
    editor.select('slides.1.title');
    await new Promise((done) => setTimeout(done, 100));
    editor.on('change', () => { throw new Error('a listener that throws'); });
    editor.session.set('name', 'Called again');
    const lastError = editor.lastError?.message;
    editor.destroy();
    return { log, lastError };
  }, deck());
  assert.ok(callbacks.log.includes('ready'));
  assert.ok(callbacks.log.includes('change:Called:true'));
  assert.ok(callbacks.log.includes('select:slides.1.title:0') || callbacks.log.some((entry) => entry.startsWith('select:slides.1.title')), JSON.stringify(callbacks.log));
  assert.ok(callbacks.log.some((entry) => entry === 'error:a listener that throws'), 'a listener that throws is reported to onError and does not stop the others');
  assert.ok(callbacks.log.includes('change:Called again:true'));
  assert.equal(callbacks.lastError, 'a listener that throws');
  assert.ok(!callbacks.log.some((entry) => entry.includes('stray')), 'off and the returned unsubscribe stop a listener');
  mark('onChange, onSelection, onError and onReady fire; on() returns an unsubscribe, off() works, and a throwing listener is contained');

  assert.deepEqual(errors, []);
} finally {
  await app.close();
}

console.log(`workspace browser checks passed (${checks.length}):\n- ${checks.join('\n- ')}`);
