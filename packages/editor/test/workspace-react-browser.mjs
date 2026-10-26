import assert from 'node:assert/strict';
import { startWorkspacePage, deck } from './support/workspace-page.mjs';

// CE-06: `@openpresentation/opf-editor/react` in a real browser, under React 19 and React 18 (the page is bundled twice, the second time with
// react and react-dom mapped to the react-18 and react-dom-18 dev dependencies). StrictMode mounts, unmounts and mounts again: exactly one editor
// survives, the one the first effect would have made is never made, and an unmount leaves no DOM, listener or observer behind. The hooks follow
// the document and the selection, the props that can change do, the callbacks are the latest, and a server-rendered page hydrates without a warning.
const checks = [];
const mark = (name) => checks.push(name);
const reactEntry = `
  import * as React from 'react';
  import { createRoot, hydrateRoot } from 'react-dom/client';
  import { renderToString } from 'react-dom/server';
  window.R = { React, createRoot, hydrateRoot, renderToString, version: React.version };
`;

async function run(label, alias, expectedMajor) {
  const app = await startWorkspacePage({ bundle: { extraEntry: reactEntry, alias } });
  const { page, errors } = app;
  const ev = (fn, arg) => page.evaluate(fn, arg);
  try {
    assert.equal(await ev(() => window.R.version.split('.')[0]), String(expectedMajor), `${label} is the React the page runs`);
    await ev(() => {
      const live = new Map();
      const add = document.addEventListener.bind(document), remove = document.removeEventListener.bind(document);
      document.addEventListener = (type, listener, options) => { live.set(type, (live.get(type) ?? new Set()).add(listener)); return add(type, listener, options); };
      document.removeEventListener = (type, listener, options) => { live.get(type)?.delete(listener); return remove(type, listener, options); };
      const observers = new Set();
      for (const name of ['ResizeObserver', 'MutationObserver']) {
        const Base = window[name];
        window[name] = class extends Base { constructor(callback) { super(callback); observers.add(this); } disconnect() { observers.delete(this); super.disconnect(); } };
      }
      window.leaks = () => ({ listeners: Object.fromEntries([...live].map(([type, set]) => [type, set.size]).filter(([, count]) => count)), observers: observers.size, workspaces: document.querySelectorAll('.opf-workspace').length, canvases: document.querySelectorAll('.opf-canvas').length });
      window.h = window.R.React.createElement;
      window.base = () => ({ fonts: window.fonts, catalogs: [window.opfWs.gallery] });
      window.fixture = { created: [], nulls: 0 };
    });
    await ev(async (d) => {
      // The libraries add their stylesheets to <head> once; one mount and destroy first.
      const host = document.createElement('div'); document.body.append(host);
      const editor = window.opfWs.createOpfEditor(host, { document: d, ...window.base() }); await editor.ready; editor.destroy(); host.remove();
    }, deck());

    // ---- StrictMode: one editor survives -----------------------------------------------------------------------------------------------
    await ev((d) => {
      const { React, createRoot } = window.R, h = window.h;
      const { OpfEditor, useOpfDocument, useOpfSelection } = window.opfWs.react;
      window.changes = [];
      // A probe that shows StrictMode really runs effects twice in this build: mount, cleanup, mount.
      window.probe = { mounts: 0, unmounts: 0 };
      function Probe() { React.useEffect(() => { window.probe.mounts += 1; return () => { window.probe.unmounts += 1; }; }, []); return null; }
      function App({ show = true, label = 'a' }) {
        const [editor, setEditor] = React.useState(null);
        const doc = useOpfDocument(editor);
        const selection = useOpfSelection(editor);
        return h('div', null,
          h(Probe),
          h('output', { id: 'name' }, doc?.name ?? 'none'),
          h('output', { id: 'selection' }, selection?.path ?? 'none'),
          show ? h(OpfEditor, { id: 'react-editor', className: 'mine', style: { width: 1100, height: 700 }, document: d, ...window.base(), theme: window.theme, readOnly: window.readOnly, view: window.view,
            onEditor: (value) => { if (value) window.fixture.created.push(value); else window.fixture.nulls += 1; setEditor(value); },
            onChange: (detail) => window.changes.push(`${label}:${detail.document.name}`) }) : null);
      }
      window.App = App;
      window.mount = (props) => { window.root ??= createRoot(document.body.appendChild(Object.assign(document.createElement('div'), { id: 'app' }))); window.root.render(h(React.StrictMode, null, h(App, props))); };
      // React adds its own listeners to the document when it makes a root: render the page without an editor first, and take the baseline there.
      window.mount({ show: false });
    }, deck());
    const warm = await ev(() => window.leaks());
    await ev(() => window.mount({ show: true }));
    await page.waitForFunction(() => window.fixture.created.length >= 1 && window.fixture.created.at(-1).mounted && document.querySelector('#react-editor .opf-canvas svg'), undefined, { timeout: 30000 });
    const mounted = await ev(() => ({ created: window.fixture.created.length, destroyed: window.fixture.created.filter((e) => e.destroyed).length, nulls: window.fixture.nulls, ...window.leaks(), container: document.querySelector('#react-editor').className, name: document.querySelector('#name').textContent }));
    assert.deepEqual(await ev(() => window.probe), { mounts: 2, unmounts: 1 }, 'StrictMode ran the effects twice (mount, cleanup, mount)');
    assert.equal(mounted.workspaces, 1, `${label} StrictMode: exactly one editor is in the page`);
    assert.equal(mounted.canvases, 1);
    assert.equal(mounted.created - mounted.destroyed, 1, 'every editor but the last was destroyed');
    assert.equal(mounted.created, 1, 'the effect that StrictMode throws away never made an editor (the editor module is requested after both effects)');
    assert.equal(mounted.container, 'mine');
    assert.equal(mounted.name, 'Workspace fixture', 'useOpfDocument shows the document');
    mark(`${label}: StrictMode mount, unmount and mount leaves exactly one editor`);

    // ---- the hooks ---------------------------------------------------------------------------------------------------------------------------
    await ev(() => window.fixture.created.at(-1).session.set('name', 'Renamed'));
    await page.waitForFunction(() => document.querySelector('#name').textContent === 'Renamed', undefined, { timeout: 10000 });
    await ev(() => window.fixture.created.at(-1).select('slides.1.title'));
    await page.waitForFunction(() => document.querySelector('#selection').textContent === 'slides.1.title', undefined, { timeout: 10000 });
    assert.ok((await ev(() => window.changes)).some((entry) => entry === 'a:Renamed'));
    mark(`${label}: useOpfDocument and useOpfSelection follow the editor, and onChange fires`);

    // The latest callback: re-render with another closure.
    await ev(() => window.mount({ label: 'b' }));
    await ev(() => window.fixture.created.at(-1).session.set('name', 'Renamed twice'));
    await page.waitForFunction(() => window.changes.includes('b:Renamed twice'), undefined, { timeout: 10000 });
    assert.equal(await ev(() => window.fixture.created.length), 1, 're-rendering with new props does not remount');
    mark(`${label}: a re-render keeps the editor and calls the latest callback`);

    // ---- props that change ---------------------------------------------------------------------------------------------------------------------
    await ev(() => { window.theme = { tokens: { accent: 'rgb(11, 22, 33)' } }; window.readOnly = true; window.view = 'outline'; window.mount({ label: 'b' }); });
    await page.waitForFunction(() => window.fixture.created.at(-1).readOnly === true && window.fixture.created.at(-1).view === 'outline', undefined, { timeout: 10000 });
    assert.equal(await page.locator('#react-editor .opf-source').evaluate((node) => getComputedStyle(node).getPropertyValue('--opf-ui-accent').trim()), 'rgb(11, 22, 33)', 'the theme prop reaches the chrome');
    assert.equal(await page.locator('#react-editor .opf-ws-outline').isVisible(), true, 'the view prop switches the view');
    assert.equal(await page.locator('#react-editor .opf-ws-canvas').getAttribute('inert'), '', 'the readOnly prop locks the slide');
    await ev(() => { window.theme = { tokens: { accent: 'rgb(11, 22, 33)' } }; window.readOnly = false; window.view = 'slide'; window.mount({ label: 'b' }); });
    await page.waitForFunction(() => window.fixture.created.at(-1).readOnly === false && window.fixture.created.at(-1).view === 'slide', undefined, { timeout: 10000 });
    assert.equal(await ev(() => window.fixture.created.length), 1);
    mark(`${label}: theme, readOnly and view props follow later renders without a remount`);

    // ---- unmount leaves nothing ------------------------------------------------------------------------------------------------------------
    await ev(() => window.mount({ show: false }));
    await page.waitForFunction(() => document.querySelectorAll('.opf-workspace').length === 0, undefined, { timeout: 10000 });
    const gone = await ev(() => ({ ...window.leaks(), destroyed: window.fixture.created.every((e) => e.destroyed), name: document.querySelector('#name').textContent }));
    assert.equal(gone.destroyed, true);
    assert.equal(gone.name, 'none', 'the hooks return undefined once the editor is gone');
    assert.deepEqual({ listeners: gone.listeners, observers: gone.observers }, { listeners: warm.listeners, observers: warm.observers }, 'unmount removes every listener and observer');
    mark(`${label}: unmount destroys the editor and leaves no listener or observer behind`);

    // Many cycles under StrictMode.
    for (let round = 0; round < 4; round += 1) {
      await ev(() => window.mount({ show: true }));
      await page.waitForFunction((count) => window.fixture.created.length === count && window.fixture.created.at(-1).mounted, 2 + round, { timeout: 30000 });
      await ev(() => window.mount({ show: false }));
      await page.waitForFunction(() => document.querySelectorAll('.opf-workspace').length === 0, undefined, { timeout: 10000 });
    }
    const cycled = await ev(() => ({ ...window.leaks(), created: window.fixture.created.length, destroyed: window.fixture.created.filter((e) => e.destroyed).length }));
    assert.equal(cycled.created, 5);
    assert.equal(cycled.destroyed, 5, 'every editor that was made was destroyed');
    assert.deepEqual({ listeners: cycled.listeners, observers: cycled.observers }, { listeners: warm.listeners, observers: warm.observers });
    mark(`${label}: four more mount and unmount cycles under StrictMode leak nothing`);

    // ---- the hook form, with the host's own element and slots as refs ------------------------------------------------------------------------
    await ev(() => window.root.unmount());
    await ev(() => {
      const { React, createRoot } = window.R, h = window.h;
      const { useOpfEditor, useOpfDocument, OpfEditor } = window.opfWs.react;
      function Hooked() {
        const { ref, editor } = useOpfEditor({ document: { name: 'Hooked', design: { theme: 'classic', fontScheme: 'roboto' }, slides: [{ id: 'h', title: 'Hooked' }] }, ...window.base(), layout: 'canvas' });
        const doc = useOpfDocument(editor);
        return h('div', null, h('output', { id: 'hooked' }, doc?.name ?? 'none'), h('div', { ref, id: 'hooked-editor', style: { width: 600, height: 400 } }));
      }
      function Slotted() {
        const canvas = React.useRef(null), nav = React.useRef(null);
        return h('div', { id: 'slotted' }, h('div', { ref: canvas, style: { width: 400, height: 240 }, id: 'slot-canvas' }), h('div', { ref: nav, id: 'slot-nav' }), h(OpfEditor, { document: { name: 'Slotted', design: { theme: 'classic', fontScheme: 'roboto' }, slides: [{ id: 'h', title: 'Slotted' }, { id: 'i', title: 'Two' }] }, ...window.base(), slots: { canvas, navigator: nav } }));
      }
      window.root2 = createRoot(document.body.appendChild(Object.assign(document.createElement('div'), { id: 'app2' })));
      window.root2.render(h(React.StrictMode, null, h(Hooked), h(Slotted)));
    });
    await page.waitForFunction(() => document.querySelector('#hooked').textContent === 'Hooked' && document.querySelector('#hooked-editor .opf-canvas svg') && document.querySelector('#slot-canvas svg') && document.querySelector('#slot-nav .opf-nav-counter'), undefined, { timeout: 30000 });
    assert.equal(await page.locator('#slot-nav .opf-nav-counter').textContent(), '01 / 02');
    assert.equal(await page.locator('#hooked-editor .opf-ws-bar').count(), 1);
    assert.equal(await ev(() => document.querySelectorAll('.opf-canvas').length), 2, 'one canvas per editor under StrictMode');
    await ev(() => window.root2.unmount());
    assert.equal((await ev(() => window.leaks())).workspaces, 0);
    mark(`${label}: useOpfEditor mounts in the host's own element, and slots may be React refs`);

    // ---- server render and hydration ---------------------------------------------------------------------------------------------------------------
    const hydrated = await ev(async (d) => {
      const { React, hydrateRoot, renderToString } = window.R, h = window.h;
      const { OpfEditor } = window.opfWs.react;
      const props = { id: 'ssr-editor', className: 'ssr', style: { width: 800, height: 500 }, document: d, ...window.base(), fonts: () => { throw new Error('fonts are not asked for on the server'); } };
      const html = renderToString(h(OpfEditor, props));
      const host = document.body.appendChild(Object.assign(document.createElement('div'), { id: 'ssr' }));
      host.innerHTML = html;
      const before = host.innerHTML;
      const problems = [];
      const consoleError = console.error;
      console.error = (...args) => problems.push(args.join(' '));
      const created = [];
      const root = hydrateRoot(host, h(React.StrictMode, null, h(OpfEditor, { ...props, fonts: window.fonts, onEditor: (value) => value && created.push(value) })), { onRecoverableError: (error) => problems.push(error.message) });
      await new Promise((done) => { const wait = () => (created[0]?.mounted ? done() : setTimeout(wait, 20)); wait(); });
      await created[0].ready;
      console.error = consoleError;
      const result = { before, problems, workspaces: host.querySelectorAll('.opf-workspace').length, svg: !!host.querySelector('.opf-canvas svg'), created: created.length };
      root.unmount();
      return result;
    }, deck());
    assert.equal(hydrated.before, '<div id="ssr-editor" class="ssr" style="width:800px;height:500px" data-opf-react=""></div>', 'the server renders an empty container and no editor');
    assert.deepEqual(hydrated.problems, [], 'hydration reports no mismatch');
    assert.equal(hydrated.workspaces, 1);
    assert.equal(hydrated.svg, true);
    assert.equal(hydrated.created, 1);
    mark(`${label}: the server renders an empty container, and the client hydrates it and mounts one editor with no warning`);

    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
}

await run('React 19', undefined, 19);
await run('React 18', { react: 'react-18', 'react-dom': 'react-dom-18' }, 18);

console.log(`workspace React browser checks passed (${checks.length}):\n- ${checks.join('\n- ')}`);
