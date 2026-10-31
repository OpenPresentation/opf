import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { copyPreviewFonts } from '@openpresentation/opf-render/preview-fonts-node';
import { startWorkspacePage, bundleWorkspace, deck } from './support/workspace-page.mjs';
import { buildStyles } from '../scripts/build-styles.mjs';

const EXTRA = "import * as element from './src/element.js'; window.opfEl = element;";

// CE-30 in a real browser: `<opf-editor>` (src/element.js) on a bare page with the package stylesheet, the renderer's browser fonts handle and
// the gallery catalog, bundled the way a host's bundler would. Covers defining (no side effect on import, idempotent), mounting from markup with
// inline JSON, YAML and Markdown, `src` (fetched only when set; errors become `opf-error`), the observed attributes (live and remounting), the
// `document` property, the re-dispatched events, a move in the DOM, removal without leaks, two elements, an invalid layout, and parse-time definition.
const checks = [];
const mark = (name) => checks.push(name);
const app = await startWorkspacePage({ body: '', bundle: { extraEntry: EXTRA } });
const { page, errors, browser } = app;
const ev = (fn, arg) => page.evaluate(fn, arg);

const json = (value) => JSON.stringify(value);
const yamlText = ['name: YAML deck', 'language: en-US', 'design:', '  theme: classic', '  fontScheme: roboto', 'slides:', '  - id: y1', '    title: From YAML', '  - id: y2', '    title: Second YAML slide', ''].join('\n');
const markdownText = ['---', 'name: Markdown deck', 'language: en-US', 'design:', '  theme: classic', '  fontScheme: roboto', '---', '', '# From Markdown', '', '---', '', '# Second Markdown slide', ''].join('\n');
const inline = (type, text, attrs = '') => `<opf-editor ${attrs}><script type="${type}">${text.replace(/<\/script/g, '<\\/script')}</script></opf-editor>`;

try {
  // ---- instrument the page: the events every element dispatches, and anything that leaks -----------------------------------------------------
  await ev(() => {
    window.log = [];
    for (const name of window.opfEl.OPF_EDITOR_EVENTS) {
      const type = window.opfEl.opfEventType(name);
      document.addEventListener(type, (event) => window.log.push({ type, target: event.target.id || event.target.localName, bubbles: event.bubbles, composed: event.composed, detail: event.detail }));
    }
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
    window.tick = (ms = 0) => new Promise((done) => setTimeout(done, ms));
    window.mount = (html) => { const stage = document.querySelector('#stage') ?? document.body.appendChild(Object.assign(document.createElement('div'), { id: 'stage' })); stage.insertAdjacentHTML('beforeend', html); return stage.lastElementChild; };
    window.clear = () => { document.querySelector('#stage')?.replaceChildren(); window.log.length = 0; };
  });

  // ---- importing does not define; defining is idempotent -------------------------------------------------------------------------------------
  const before = await ev(() => ({ defined: !!customElements.get('opf-editor'), exports: Object.keys(window.opfEl).sort() }));
  assert.equal(before.defined, false, 'importing ./element has no side effect');
  assert.deepEqual(before.exports, ['OPF_EDITOR_EVENTS', 'defineOpfEditorElement', 'opfEventType']);
  const defined = await ev(async () => {
    // A tag in the page before the class exists is upgraded by the definition.
    window.mount(`<opf-editor id="early" layout="canvas"><script type="application/json">${JSON.stringify({ name: 'Early', language: 'en-US', design: { theme: 'classic', fontScheme: 'roboto' }, slides: [{ id: 'e1', title: 'Early slide' }] })}</script></opf-editor>`);
    const first = window.opfEl.defineOpfEditorElement('opf-editor', { fonts: window.fonts, catalogs: [window.opfWs.gallery] });
    const again = window.opfEl.defineOpfEditorElement();
    const other = window.opfEl.defineOpfEditorElement('opf-editor-two', { fonts: window.fonts, catalogs: [window.opfWs.gallery] });
    customElements.define('not-ours', class extends HTMLElement {});
    let foreign = '';
    try { window.opfEl.defineOpfEditorElement('not-ours'); } catch (error) { foreign = error.message; }
    const early = document.querySelector('#early');
    await early.ready;
    return { same: first === again, distinct: first !== other, is: early instanceof first, upgraded: [early.dataset.opfState, early.document.name, !!early.querySelector('.opf-canvas svg')], foreign };
  });
  assert.ok(defined.same && defined.distinct && defined.is);
  assert.deepEqual(defined.upgraded, ['ready', 'Early', true]);
  assert.match(defined.foreign, /already defined by another element/);
  mark('importing ./element defines nothing; defineOpfEditorElement is idempotent, defines other names, refuses a name another element owns, and upgrades tags already in the page');

  // ---- warm up (the libraries add their stylesheets once per document), then take the baseline ---------------------------------------------------
  await ev(async () => { const warm = window.mount('<opf-editor id="warm" layout="full"></opf-editor>'); await warm.ready; warm.editor.setView('layouts'); warm.remove(); await window.tick(20); window.clear(); });
  const baseline = await ev(() => window.leaks());

  // ---- inline JSON, upgrade of an element already in the page --------------------------------------------------------------------------------
  const early = await ev(async () => {

    window.clear();
    const fresh = window.mount(`<opf-editor id="json" layout="canvas"><script type="application/json">${JSON.stringify({ name: 'Inline JSON', language: 'en-US', design: { theme: 'classic', fontScheme: 'roboto' }, slides: [{ id: 'a', title: 'Alpha' }, { id: 'b', title: 'Beta' }] })}</script></opf-editor>`);
    const handle = await fresh.ready;
    return {
      sameHandle: handle === fresh.editor, state: fresh.dataset.opfState, name: fresh.document.name, slides: fresh.document.slides.length,
      canvas: !!fresh.querySelector('.opf-canvas svg'), host: fresh.querySelectorAll('[data-opf-element-host]').length,
      script: fresh.querySelector('script[type="application/json"]')?.textContent.length > 10, layout: fresh.querySelector('.opf-workspace')?.dataset.opfLayout,
      boxed: getComputedStyle(fresh).display + ' ' + getComputedStyle(fresh).height, hostHeight: fresh.querySelector('[data-opf-element-host]').getBoundingClientRect().height,
    };
  });
  assert.ok(early.sameHandle);
  assert.equal(early.state, 'ready');
  assert.equal(early.name, 'Inline JSON');
  assert.equal(early.slides, 2);
  assert.ok(early.canvas, 'the canvas drew the inline deck');
  assert.equal(early.host, 1);
  assert.ok(early.script, 'the inline script stays where the author put it');
  assert.equal(early.layout, 'canvas');
  assert.equal(early.boxed, 'block 600px', 'display:block and a default height the page can override');
  assert.equal(early.hostHeight, 600);
  mark('inline application/json is read; the editor mounts in a div inside the element (the script survives), display:block with a 600px default box');

  // ---- the box is the page's to override ----------------------------------------------------------------------------------------------------
  const sized = await ev(async () => {
    window.clear();
    const el = window.mount('<opf-editor layout="canvas" style="height:300px"></opf-editor>');
    await el.ready;
    const result = { inlineStyle: getComputedStyle(el).height, host: el.querySelector('[data-opf-element-host]').getBoundingClientRect().height };
    el.style.height = ''; el.className = 'big';
    document.head.append(Object.assign(document.createElement('style'), { textContent: 'opf-editor.big{height:420px}' }));
    result.byRule = getComputedStyle(el).height;
    return result;
  });
  assert.deepEqual(sized, { inlineStyle: '300px', host: 300, byRule: '420px' });
  mark('an inline style or any page rule overrides the default height (the default rule has zero specificity)');

  // ---- inline YAML and Markdown ---------------------------------------------------------------------------------------------------------------
  const texts = await ev(async ([yaml, markdown, yamlTag, mdTag]) => {
    window.clear();
    const y = window.mount(yamlTag);
    const m = window.mount(mdTag);
    await Promise.all([y.ready, m.ready]);
    return {
      y: { name: y.document.name, slides: y.document.slides.length, format: y.editor.sourcePane.getFormat(), text: y.editor.readSource().text === yaml },
      m: { name: m.document.name, slides: m.document.slides.length, format: m.editor.sourcePane.getFormat(), text: m.editor.readSource().text === markdown },
    };
  }, [yamlText, markdownText, inline('application/yaml', yamlText, 'layout="full"'), inline('text/markdown', markdownText, 'layout="full"')]);
  assert.deepEqual(texts.y, { name: 'YAML deck', slides: 2, format: 'yaml', text: true });
  assert.deepEqual(texts.m, { name: 'Markdown deck', slides: 2, format: 'md', text: true });
  mark('inline application/yaml and text/markdown open in their own format with the text as the author wrote it');

  // ---- events: names, bubbling, details --------------------------------------------------------------------------------------------------
  const events = await ev(async (text) => {
    window.clear();
    const el = window.mount(`<opf-editor id="ev" layout="full"><script type="application/json">${text}</script></opf-editor>`);
    const own = [];
    el.addEventListener('opf-slide', (event) => own.push(event.target === el));
    await el.ready;
    el.editor.session.set('slides.0.title', 'Edited by the host');
    el.editor.setSlide(1);
    await window.tick(60);
    const first = (type) => window.log.find((entry) => entry.type === type);
    const ready = first('opf-ready'), change = first('opf-change'), slide = window.log.filter((entry) => entry.type === 'opf-slide').pop();
    return {
      types: [...new Set(window.log.map((entry) => entry.type))],
      ready: ready && { bubbles: ready.bubbles, composed: ready.composed, target: ready.target, hasEditor: ready.detail.editor === el.editor },
      change: change && { bubbles: change.bubbles, title: change.detail.document.slides[0].title, canUndo: change.detail.canUndo },
      slide: slide && slide.detail, own,
      kebab: [window.opfEl.opfEventType('layoutStudio'), window.opfEl.opfEventType('review-goto'), window.opfEl.opfEventType('deck-name')],
    };
  }, json(deck(3)));
  assert.ok(events.types.includes('opf-mounted') && events.types.includes('opf-ready') && events.types.includes('opf-change') && events.types.includes('opf-slide') && events.types.includes('opf-render'), JSON.stringify(events.types));
  assert.deepEqual(events.ready, { bubbles: true, composed: true, target: 'ev', hasEditor: true });
  assert.deepEqual(events.change, { bubbles: true, title: 'Edited by the host', canUndo: true });
  assert.deepEqual(events.slide, { index: 1, count: 3 });
  assert.ok(events.own.length >= 1 && events.own.every(Boolean), 'a listener on the element hears it with the element as its target');
  assert.deepEqual(events.kebab, ['opf-layout-studio', 'opf-review-goto', 'opf-deck-name']);
  mark('workspace events arrive as bubbling, composed CustomEvents named opf-<kebab-name> with the workspace detail (ready, change, slide, render...)');

  // ---- attributes: live updates ----------------------------------------------------------------------------------------------------------
  const live = await ev(async (text) => {
    window.clear();
    const el = window.mount(`<opf-editor id="live" layout="full"><script type="application/json">${text}</script></opf-editor>`);
    const handle = await el.ready;
    const out = {};
    el.setAttribute('readonly', '');
    out.readOnly = handle.readOnly;
    el.removeAttribute('readonly');
    out.writable = !handle.readOnly;
    el.setAttribute('theme', 'dark');
    out.dark = el.querySelector('[data-opf-element-host]').getAttribute('data-theme');
    el.setAttribute('theme', 'light');
    out.light = el.querySelector('[data-opf-element-host]').getAttribute('data-theme');
    el.setAttribute('density', 'touch');
    out.density = el.querySelector('.opf-workspace').getAttribute('data-density');
    el.setAttribute('slide', '2');
    await window.tick(60);
    out.slide = handle.slideIndex;
    out.counter = el.querySelector('.opf-nav-counter')?.textContent;
    el.slide = 0;
    out.slideProperty = [handle.slideIndex, el.slide];
    out.sameHandle = el.editor === handle;
    return out;
  }, json(deck(3)));
  assert.deepEqual(live, { readOnly: true, writable: true, dark: 'dark', light: 'light', density: 'touch', slide: 2, counter: '03 / 03', slideProperty: [0, 0], sameHandle: true });
  mark('readonly, theme, density and slide apply to the mounted editor without remounting (same handle); the slide property navigates');

  // toolbar: a handle that can set it is called; one that cannot is remounted (the chrome of CE-28 decides which this build has).
  const toolbar = await ev(async (text) => {
    window.clear();
    const el = window.mount(`<opf-editor layout="canvas"><script type="application/json">${text}</script></opf-editor>`);
    const first = await el.ready;
    const calls = [];
    first.setToolbar = (value) => calls.push(value);
    el.setAttribute('toolbar', 'title, history,|,export');
    el.setAttribute('toolbar', 'none');
    el.removeAttribute('toolbar');
    const live = { calls, same: el.editor === first };
    delete first.setToolbar;
    el.setAttribute('toolbar', 'none');
    await el.ready.then(() => {});
    await window.tick(40);
    return { live, remounted: el.editor !== first && el.editor.mounted, name: el.document.name };
  }, json(deck(2)));
  assert.deepEqual(toolbar.live, { calls: [['title', 'history', '|', 'export'], false, undefined], same: true });
  assert.ok(toolbar.remounted && toolbar.name === 'Workspace fixture');
  mark('toolbar: "a, b, |" becomes a list, "none" becomes false; applied live when the handle can, else the element remounts with the same document');

  // ---- layout remounts and keeps the document ----------------------------------------------------------------------------------------------
  const remount = await ev(async (text) => {
    window.clear();
    const el = window.mount(`<opf-editor id="re" layout="canvas"><script type="application/json">${text}</script></opf-editor>`);
    const first = await el.ready;
    first.session.set('slides.1.title', 'Edited before the layout switch');
    first.setSlide(2);
    window.log.length = 0;
    el.setAttribute('layout', 'full');
    el.setAttribute('density', 'touch');
    const wasReady = el.ready;
    await el.ready;
    await window.tick(40);
    const next = el.editor;
    return {
      differentHandle: next !== first, firstDestroyed: first.destroyed, layout: el.querySelector('.opf-workspace').dataset.opfLayout, source: !!el.querySelector('.opf-source'),
      title: el.document.slides[1].title, slide: next.slideIndex, density: el.querySelector('.opf-workspace').getAttribute('data-density'),
      hosts: el.querySelectorAll('[data-opf-element-host]').length, scripts: el.querySelectorAll('script').length,
      destroys: window.log.filter((entry) => entry.type === 'opf-destroy').length, readies: window.log.filter((entry) => entry.type === 'opf-ready').length,
      sourceText: next.readSource().text.includes('Edited before the layout switch'), awaitedNew: (await wasReady) === next,
    };
  }, json(deck(3)));
  assert.deepEqual(remount, { differentHandle: true, firstDestroyed: true, layout: 'full', source: true, title: 'Edited before the layout switch', slide: 2, density: 'touch', hosts: 1, scripts: 1, destroys: 1, readies: 1, sourceText: true, awaitedNew: true });
  mark('a layout change remounts once (several attribute changes in one task make one remount), keeping the edited document, the slide and the inline script');

  // ---- the document property ---------------------------------------------------------------------------------------------------------------
  const property = await ev(async ([yaml, text]) => {
    window.clear();
    // Set before the element is in the page; it wins over the inline script.
    const el = document.createElement('opf-editor');
    el.setAttribute('layout', 'full');
    el.innerHTML = `<script type="application/json">${text}</script>`;
    el.document = { name: 'From property', language: 'en-US', design: { theme: 'classic', fontScheme: 'roboto' }, slides: [{ id: 'p1', title: 'P one' }] };
    const out = { beforeMount: el.document.name, editorBefore: el.editor };
    document.querySelector('#stage').append(el);
    await el.ready;
    out.mounted = el.document.name;
    // After mount: an object opens as one undoable change and fires opf-change; text is read by its format.
    window.log.length = 0;
    el.document = { name: 'Second', language: 'en-US', design: { theme: 'classic', fontScheme: 'roboto' }, slides: [{ id: 'q1', title: 'Q one' }, { id: 'q2', title: 'Q two' }] };
    await window.tick(60);
    out.second = [el.document.name, el.document.slides.length, window.log.some((entry) => entry.type === 'opf-change')];
    el.editor.undo();
    out.undone = el.document.name;
    el.document = yaml;
    await window.tick(80);
    out.yaml = [el.document.name, el.editor.sourcePane.getFormat()];
    const handle = el.editor;
    out.same = handle === el.editor;
    return out;
  }, [yamlText, json(deck(2))]);
  assert.equal(property.beforeMount, 'From property');
  assert.equal(property.editorBefore, null);
  assert.equal(property.mounted, 'From property', 'the document property wins over the inline script');
  assert.deepEqual(property.second, ['Second', 2, true]);
  assert.equal(property.undone, 'From property', 'setting the document is one undoable change');
  assert.deepEqual(property.yaml, ['YAML deck', 'yaml']);
  assert.ok(property.same);
  mark('the document property: set before connect (wins over inline), after mount (one undoable change, opf-change), as an object or as YAML text; getter reads the live document');

  // ---- src: fetched only when the page sets it ----------------------------------------------------------------------------------------------
  const CORS = { 'access-control-allow-origin': '*' };
  const requested = [];
  await page.route('http://decks.test/**', async (route) => {
    const url = new URL(route.request().url());
    requested.push(url.pathname);
    if (url.pathname.endsWith('/q3.json')) await route.fulfill({ headers: CORS, contentType: 'application/json', body: json({ ...deck(2), name: 'Fetched JSON' }) });
    else if (url.pathname.endsWith('/q4.yaml')) await route.fulfill({ headers: CORS, contentType: 'text/yaml', body: yamlText });
    else if (url.pathname.endsWith('/plain')) await route.fulfill({ headers: CORS, contentType: 'text/markdown; charset=utf-8', body: markdownText });
    else if (url.pathname.endsWith('/bad.json')) await route.fulfill({ headers: CORS, contentType: 'application/json', body: '{ not json' });
    else await route.fulfill({ headers: CORS, status: 404, body: 'gone' });
  });
  const noSrc = await ev(async (text) => { window.clear(); const el = window.mount(`<opf-editor layout="canvas"><script type="application/json">${text}</script></opf-editor>`); await el.ready; await window.tick(50); return el.document.name; }, json(deck(1)));
  assert.deepEqual(requested, [], 'an element without src fetches nothing');
  assert.equal(noSrc, 'Workspace fixture');
  const fetched = await ev(async () => {
    window.clear();
    const out = {};
    const json = window.mount('<opf-editor layout="full" src="http://decks.test/decks/q3.json"></opf-editor>');
    const handle = await json.ready;
    out.json = [json.document.name, json.document.slides.length];
    // Changing src on a mounted element opens the new deck in the same editor.
    json.setAttribute('src', 'http://decks.test/decks/q4.yaml');
    await window.tick(150);
    out.yamlInPlace = [json.document.name, json.editor === handle, json.editor.sourcePane.getFormat()];
    const md = window.mount('<opf-editor layout="full" src="http://decks.test/decks/plain"></opf-editor>');
    await md.ready;
    out.markdownByContentType = [md.document.name, md.editor.sourcePane.getFormat()];
    return out;
  });
  assert.deepEqual(fetched.json, ['Fetched JSON', 2]);
  assert.deepEqual(fetched.yamlInPlace, ['YAML deck', true, 'yaml']);
  assert.deepEqual(fetched.markdownByContentType, ['Markdown deck', 'md']);
  assert.deepEqual(requested.sort(), ['/decks/plain', '/decks/q3.json', '/decks/q4.yaml']);
  mark('src is fetched only when set (JSON, YAML, Markdown by extension or content type); a new src opens in the same editor');

  const failures = await ev(async () => {
    window.clear();
    const errs = [];
    const seen = (event) => errs.push([event.target.id, event.detail.source, event.detail.error instanceof Error, event.detail.message]);
    document.addEventListener('opf-error', seen);
    const missing = window.mount('<opf-editor id="missing" layout="canvas" src="http://decks.test/decks/missing.json"></opf-editor>');
    const bad = window.mount('<opf-editor id="bad" layout="canvas" src="http://decks.test/decks/bad.json"></opf-editor>');
    const rejected = await Promise.allSettled([missing.ready, bad.ready]);
    const out = { states: [missing.dataset.opfState, bad.dataset.opfState], editors: [missing.editor, bad.editor], rejected: rejected.map((r) => r.status), errs };
    // The page fixes the address and the same element recovers.
    missing.setAttribute('src', 'http://decks.test/decks/q3.json');
    await missing.ready;
    out.recovered = [missing.dataset.opfState, missing.document.name];
    document.removeEventListener('opf-error', seen);
    return out;
  });
  assert.deepEqual(failures.states, ['error', 'error']);
  assert.deepEqual(failures.editors, [null, null]);
  assert.deepEqual(failures.rejected, ['rejected', 'rejected']);
  assert.deepEqual(failures.errs.map((entry) => entry.slice(0, 3)), [['missing', 'src', true], ['bad', 'src', true]]);
  assert.match(failures.errs[0][3], /404/);
  assert.match(failures.errs[1][3], /not valid JSON/i);
  assert.deepEqual(failures.recovered, ['ready', 'Fetched JSON']);
  mark('a src that 404s or is not a deck dispatches opf-error {source:"src"}, rejects ready, throws nothing, and the element recovers when src is fixed');

  // ---- an invalid layout is an opf-error, not an exception ---------------------------------------------------------------------------------------
  const invalid = await ev(async (text) => {
    window.clear();
    const errs = [];
    const seen = (event) => errs.push([event.target.id, event.detail.source, event.detail.error.name, event.detail.message]);
    document.addEventListener('opf-error', seen);
    const el = window.mount(`<opf-editor id="nope" layout="bogus"><script type="application/json">${text}</script></opf-editor>`);
    const settled = await el.ready.then(() => 'resolved', () => 'rejected');
    const out = { settled, errs, state: el.dataset.opfState, editor: el.editor, children: [...el.children].map((child) => child.localName) };
    el.setAttribute('layout', 'canvas');
    await el.ready;
    out.fixed = [el.dataset.opfState, !!el.editor?.mounted];
    document.removeEventListener('opf-error', seen);
    return out;
  }, json(deck(1)));
  assert.equal(invalid.settled, 'rejected');
  assert.equal(invalid.errs.length, 1, JSON.stringify(invalid.errs));
  assert.deepEqual(invalid.errs[0].slice(0, 3), ['nope', 'mount', 'RangeError']);
  assert.match(invalid.errs[0][3], /layout must be/);
  assert.deepEqual([invalid.state, invalid.editor, invalid.children], ['error', null, ['script']], 'nothing but the inline script is left in the element');
  assert.deepEqual(invalid.fixed, ['ready', true]);
  mark('an unknown layout reaches opf-error {source:"mount"} (createOpfEditor validates), leaves the element empty, and fixing the attribute mounts it');

  const badSlide = await ev(async (text) => {
    window.clear();
    const errs = [];
    const seen = (event) => errs.push(event.detail.source ?? event.detail.message);
    document.addEventListener('opf-error', seen);
    const el = window.mount(`<opf-editor layout="canvas"><script type="application/json">${text}</script></opf-editor>`);
    const handle = await el.ready;
    el.setAttribute('slide', 'second');
    el.setAttribute('theme', 'chartreuse');
    await window.tick(20);
    document.removeEventListener('opf-error', seen);
    return { errs, mounted: el.editor === handle && handle.mounted };
  }, json(deck(2)));
  assert.deepEqual(badSlide, { errs: ['slide', 'theme'], mounted: true });
  mark('an attribute value the editor cannot take (slide="second") is an opf-error and leaves the editor running');

  // ---- two elements on one page -------------------------------------------------------------------------------------------------------------
  const two = await ev(async ([a, b]) => {
    window.clear();
    const one = window.mount(`<opf-editor id="one" layout="canvas"><script type="application/json">${a}</script></opf-editor>`);
    const second = window.mount(`<opf-editor id="two" layout="full"><script type="application/json">${b}</script></opf-editor>`);
    await Promise.all([one.ready, second.ready]);
    window.log.length = 0;
    one.editor.session.set('name', 'Changed one');
    await window.tick(40);
    const changes = window.log.filter((entry) => entry.type === 'opf-change').map((entry) => entry.target);
    second.remove();
    await window.tick(20);
    return { names: [one.document.name, JSON.parse(b).name], changes, oneAlive: !one.editor.destroyed, oneCanvas: !!one.querySelector('.opf-canvas svg'), secondEditor: second.editor, ids: [...document.querySelectorAll('#stage opf-editor')].map((e) => e.id) };
  }, [json(deck(2, { name: 'First deck' })), json(deck(3, { name: 'Second deck' }))]);
  assert.deepEqual(two.changes, ['one'], 'events name the element they came from');
  assert.ok(two.oneAlive && two.oneCanvas && two.secondEditor === null);
  assert.deepEqual(two.ids, ['one']);
  mark('two elements on a page are independent: events carry their own target, and removing one leaves the other running');

  // ---- move in the DOM does not remount; removal destroys ---------------------------------------------------------------------------------------
  const moved = await ev(async (text) => {
    window.clear();
    const target = document.body.appendChild(Object.assign(document.createElement('div'), { id: 'elsewhere' }));
    const el = window.mount(`<opf-editor id="mv" layout="canvas"><script type="application/json">${text}</script></opf-editor>`);
    const handle = await el.ready;
    window.log.length = 0;
    target.append(el);
    await window.tick(60);
    const sameTask = { same: el.editor === handle, alive: !handle.destroyed, events: window.log.map((entry) => entry.type), parent: el.parentElement.id, canvas: !!el.querySelector('.opf-canvas svg') };
    // Removed and put back in a later task: the first editor is gone and a new one opens the same document.
    handle.session.set('slides.0.title', 'Edited across a removal');
    el.remove();
    await window.tick(30);
    const gone = { editor: el.editor, destroyed: handle.destroyed, children: [...el.children].map((child) => child.localName), state: el.dataset.opfState ?? null };
    document.querySelector('#stage').append(el);
    const next = await el.ready;
    target.remove();
    return { sameTask, gone, back: { fresh: next !== handle, title: el.document.slides[0].title, mounted: next.mounted } };
  }, json(deck(2)));
  assert.deepEqual(moved.sameTask, { same: true, alive: true, events: [], parent: 'elsewhere', canvas: true });
  assert.deepEqual(moved.gone, { editor: null, destroyed: true, children: ['script'], state: null });
  assert.deepEqual(moved.back, { fresh: true, title: 'Edited across a removal', mounted: true });
  mark('moving the element (disconnect and connect in one task) keeps the same editor and fires nothing; removing it destroys the editor, and putting it back opens the same document in a new one');

  // ---- removal leaves nothing behind -------------------------------------------------------------------------------------------------------
  const after = await ev(async (text) => {
    window.clear();
    for (let round = 0; round < 3; round += 1) {
      const el = window.mount(`<opf-editor layout="full"><script type="application/json">${text}</script></opf-editor>`);
      await el.ready;
      el.editor.setView('outline');
      el.setAttribute('layout', 'canvas');
      await el.ready;
      el.remove();
    }
    document.querySelector('#stage').remove();
    await window.tick(60);
    return window.leaks();
  }, json(deck(3)));
  assert.deepEqual(after, baseline, 'no listener, observer, node or theme style outlives a removed element');
  mark('three mount, remount and remove rounds leave the page as it was: listeners, resize and mutation observers, nodes and theme styles equal the baseline');

  // ---- an element without fonts or catalogs of its own uses the defaults and the properties ------------------------------------------------------
  const props = await ev(async (text) => {
    window.clear();
    const el = document.createElement('opf-editor-two');
    el.setAttribute('layout', 'canvas');
    el.innerHTML = `<script type="application/json">${text}</script>`;
    const defaults = [el.fonts === window.fonts, el.catalogs[0] === window.opfWs.gallery];
    document.body.append(el);
    await el.ready;
    const own = [];
    el.options = { on: { change: (detail) => own.push(detail.document.name) } };
    await window.tick(20);
    const remounted = el.editor.mounted;
    el.editor.session.set('name', 'Option listener');
    await window.tick(30);
    el.remove();
    return { defaults, remounted, own };
  }, json(deck(2)));
  assert.deepEqual(props.defaults, [true, true]);
  assert.ok(props.remounted);
  assert.deepEqual(props.own, ['Option listener'], 'options.on listeners run beside the re-dispatched events');
  mark('fonts and catalogs come from defineOpfEditorElement and can be set per element; options merge into createOpfEditor (a new options object remounts)');

  assert.deepEqual(errors, []);

  // ---- defined while the page is parsed: the inline script child exists by the time the editor starts -------------------------------------
  const parsed = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  const parseErrors = [];
  parsed.on('pageerror', (error) => parseErrors.push(error.message));
  const faces = app.faces.map((face) => ({ family: face.family, weight: face.weight, italic: face.italic, license: face.license, dataUrl: face.dataUrl }));
  const bundle = await bundleWorkspace({ extraEntry: EXTRA });
  const css = (await buildStyles(new URL('../src/styles/', import.meta.url))).css;
  const page1 = `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/styles.css"><script src="/bundle.js"></script>
<script>
  // Synchronous, in the head: the element is defined before the parser reaches the tags below.
  const fonts = fetch('/faces.json').then((response) => response.json()).then((list) => window.opfWs.loadFonts({ faces: list.map((face) => ({ ...face, data: Uint8Array.from(atob(face.dataUrl.split(',')[1]), (c) => c.charCodeAt(0)) })), substitutionPolicy: 'visual', fallbackFamily: 'Roboto' }));
  window.opfEl.defineOpfEditorElement('opf-editor', { fonts, catalogs: [window.opfWs.gallery] });
</script>
<body><opf-editor id="middle" layout="canvas"><script type="application/json">${json(deck(2, { name: 'Parsed in the middle' }))}</script></opf-editor>
<p id="after">after</p>
<opf-editor id="last" layout="canvas" theme="dark"><script type="application/yaml">${yamlText}</script></opf-editor>`;
  await parsed.route('http://parse.test/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === '/bundle.js') await route.fulfill({ headers: CORS, contentType: 'text/javascript', body: bundle });
    else if (pathname === '/styles.css') await route.fulfill({ headers: CORS, contentType: 'text/css', body: css });
    else if (pathname === '/faces.json') await route.fulfill({ headers: CORS, contentType: 'application/json', body: json(faces) });
    else await route.fulfill({ headers: CORS, contentType: 'text/html', body: page1 });
  });
  await parsed.goto('http://parse.test/');
  await parsed.waitForFunction(() => ['middle', 'last'].every((id) => document.getElementById(id)?.dataset.opfState === 'ready'), undefined, { timeout: 30000 });
  const atParse = await parsed.evaluate(() => ({
    middle: document.getElementById('middle').document.name, last: document.getElementById('last').document.name,
    lastFormat: document.getElementById('last').editor.sourcePane?.getFormat() ?? 'no pane', dark: document.getElementById('last').querySelector('[data-opf-element-host]').getAttribute('data-theme'),
  }));
  assert.deepEqual(atParse, { middle: 'Parsed in the middle', last: 'YAML deck', lastFormat: 'no pane', dark: 'dark' });
  assert.deepEqual(parseErrors, []);
  await parsed.close();
  mark('an element defined by a script in the head, before the parser reaches the tag, still reads its inline script (the start waits for the element to be parsed), also when it is the last thing in the page');
  // ---- fonts: none given (estimated layout, system fonts), a font root in the attribute or the property -------------------------------------------------------
  // On a localhost origin (a secure context: the registry verifies each face's SHA-256 with Web Crypto), with a root filled by copyPreviewFonts.
  const fontRoot = mkdtempSync(path.join(os.tmpdir(), 'opf-element-fonts-'));
  const fontRequests = [];
  const rooted = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  const rootErrors = [];
  rooted.on('pageerror', (error) => rootErrors.push(error.message));
  try {
    assert.equal(copyPreviewFonts({ outDir: fontRoot }).missing.length, 0);
    const inlineDeck = `<script type="application/json">${json(deck(1))}</script>`;
    const page2 = `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/styles.css"><script src="/bundle.js"></script>
<body><opf-editor id="none" layout="canvas">${inlineDeck}</opf-editor>
<opf-editor id="attribute" layout="canvas" fonts="/opf-fonts">${inlineDeck}</opf-editor>
<opf-editor id="property" layout="canvas">${inlineDeck}</opf-editor>
<script>
  window.opfEl.defineOpfEditorElement('opf-editor', { catalogs: [window.opfWs.gallery] });
  document.getElementById('property').fonts = '/opf-fonts';
</script>`;
    await rooted.route('http://localhost:4173/**', async (route) => {
      const { pathname } = new URL(route.request().url());
      if (pathname === '/bundle.js') await route.fulfill({ contentType: 'text/javascript', body: bundle });
      else if (pathname === '/styles.css') await route.fulfill({ contentType: 'text/css', body: css });
      else if (pathname.startsWith('/opf-fonts/')) {
        fontRequests.push(pathname);
        const file = path.join(fontRoot, decodeURIComponent(pathname.slice('/opf-fonts/'.length)));
        if (existsSync(file)) await route.fulfill({ contentType: 'font/ttf', body: readFileSync(file) });
        else await route.fulfill({ status: 404, body: 'no such font' });
      } else await route.fulfill({ contentType: 'text/html', body: page2 });
    });
    await rooted.goto('http://localhost:4173/');
    await rooted.waitForFunction(() => ['none', 'attribute', 'property'].every((id) => document.getElementById(id)?.dataset.opfState === 'ready'), undefined, { timeout: 60000 });
    const roots = await rooted.evaluate(() => Object.fromEntries(['none', 'attribute', 'property'].map((id) => {
      const el = document.getElementById(id);
      return [id, [!!el.querySelector('.opf-canvas svg'), typeof el.editor.fonts?.registry, el.fonts ?? null]];
    })));
    assert.deepEqual(roots, { none: [true, 'undefined', null], attribute: [true, 'object', '/opf-fonts'], property: [true, 'object', '/opf-fonts'] });
    assert.ok(fontRequests.length > 0 && fontRequests.every((pathname) => !pathname.includes('..')), JSON.stringify(fontRequests));
    assert.ok(fontRequests.some((pathname) => pathname.startsWith('/opf-fonts/base/')), 'Roboto Regular, the startup face, comes from the page-served root');
    assert.deepEqual(rootErrors, []);
    mark('fonts: with none the editor draws without a handle and asks for nothing; the fonts attribute or a string property is a font root, loaded on demand with the renderer loadPreviewFonts from the page own server (one shared handle per root)');
  } finally {
    await rooted.close();
    rmSync(fontRoot, { recursive: true, force: true });
  }

  // ---- the define entry: one import line defines the tag, and the bundler keeps it (package.json sideEffects) ---------------------------------------
  const defineBundle = await bundleWorkspace({ extraEntry: "import './dist/element-define.js';" });
  const defining = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  const defineErrors = [];
  defining.on('pageerror', (error) => defineErrors.push(error.message));
  try {
    await defining.route('http://localhost:4174/**', async (route) => {
      const { pathname } = new URL(route.request().url());
      if (pathname === '/bundle.js') await route.fulfill({ contentType: 'text/javascript', body: defineBundle });
      else if (pathname === '/styles.css') await route.fulfill({ contentType: 'text/css', body: css });
      else await route.fulfill({ contentType: 'text/html', body: `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/styles.css"><script src="/bundle.js"></script><body><opf-editor id="only" layout="canvas"><script type="application/json">{"name":"Define entry","slides":[{"id":"d1","title":"Defined by one import"}]}</script></opf-editor>` });
    });
    await defining.goto('http://localhost:4174/');
    await defining.waitForFunction(() => document.getElementById('only')?.dataset.opfState === 'ready', undefined, { timeout: 30000 });
    const defined = await defining.evaluate(() => ({ defined: !!customElements.get('opf-editor'), name: document.getElementById('only').document.name, canvas: !!document.querySelector('#only .opf-canvas svg') }));
    assert.deepEqual(defined, { defined: true, name: 'Define entry', canvas: true });
    assert.deepEqual(defineErrors, []);
    mark('importing element/define (as a bundler keeps it) defines <opf-editor> and nothing else is needed for a tag with an inline deck');
  } finally {
    await defining.close();
  }
} finally {
  await app.close();
}

console.log(`element browser checks passed (${checks.length}):\n- ${checks.join('\n- ')}`);
