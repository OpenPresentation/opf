import assert from 'node:assert/strict';
import { startWorkspacePage } from './support/workspace-page.mjs';
import { studioDeck } from './support/studio-page.mjs';

// CE-20: the Studio from React (`<OpfEditor layout="studio" hostPanels={...}>`) under React 19 and React 18, in StrictMode: exactly one Studio
// mounts, a host panel's `render` lands in its Studio tab through a portal and follows the host's state, `useOpfSelection` returns the list,
// `useOpfCommands` lists and runs the commands, and an unmount leaves no editor, listener or observer behind (STUDIO-SPEC 12, test 1).
const checks = [];
const mark = (name) => checks.push(name);
const reactEntry = `
  import * as React from 'react';
  import { createRoot } from 'react-dom/client';
  window.R = { React, createRoot, version: React.version };
`;

async function run(label, alias, expectedMajor) {
  const app = await startWorkspacePage({ viewport: { width: 1440, height: 900 }, body: '', bundle: { extraEntry: reactEntry, alias } });
  const { page, errors } = app;
  const ev = (fn, arg) => page.evaluate(fn, arg);
  try {
    assert.equal(await ev(() => window.R.version.split('.')[0]), String(expectedMajor));
    await ev(() => {
      const live = new Map();
      const add = document.addEventListener.bind(document), remove = document.removeEventListener.bind(document);
      document.addEventListener = (type, listener, options) => { live.set(type, (live.get(type) ?? new Set()).add(listener)); return add(type, listener, options); };
      document.removeEventListener = (type, listener, options) => { live.get(type)?.delete(listener); return remove(type, listener, options); };
      const observers = new Set();
      for (const name of ['ResizeObserver', 'MutationObserver', 'IntersectionObserver']) {
        const Base = window[name];
        window[name] = class extends Base { constructor(callback, options) { super(callback, options); observers.add(this); } disconnect() { observers.delete(this); super.disconnect(); } };
      }
      window.leaks = () => ({ listeners: Object.fromEntries([...live].map(([type, set]) => [type, set.size]).filter(([, count]) => count)), observers: observers.size, studios: document.querySelectorAll('.opf-studio').length });
    });
    // One mount and destroy first: the libraries add their stylesheets and document-wide listeners once per document.
    await ev(async (deck) => {
      const host = document.body.appendChild(document.createElement('div'));
      host.style.cssText = 'width:1200px;height:800px';
      const warm = window.opfWs.createOpfEditor(host, { document: deck, fonts: window.fonts, catalogs: [window.opfWs.gallery], layout: 'studio' });
      await warm.ready;
      warm.setView('layouts');
      warm.destroy();
      host.remove();
    }, studioDeck());
    await ev((deck) => {
      const { React, createRoot } = window.R, h = React.createElement;
      const { OpfEditor, useOpfSelection, useOpfCommands } = window.opfWs.react;
      window.created = [];
      function Agent({ count }) { return h('p', { id: 'agent-panel' }, `Agent panel ${count}`); }
      function App({ count = 0 }) {
        const [editor, setEditor] = React.useState(null);
        const selection = useOpfSelection(editor);
        const { commands, run } = useOpfCommands(editor);
        window.palette = { commands, run };
        return h('div', null,
          h('output', { id: 'selected' }, Array.isArray(selection) ? selection.map((item) => item.key).join(',') : 'none'),
          h(OpfEditor, {
            id: 'studio', style: { width: 1400, height: 820 }, layout: 'studio', document: deck, fonts: window.fonts, catalogs: [window.opfWs.gallery],
            hostPanels: [{ id: 'agent', label: 'Agent', render: () => h(Agent, { count }) }],
            onEditor: (value) => { setEditor(value); if (value) window.created.push(value); },
          }));
      }
      const root = createRoot(document.body.appendChild(Object.assign(document.createElement('div'), { id: 'app' })));
      window.render = (count) => root.render(h(React.StrictMode, null, h(App, { count })));
      window.unmount = () => root.unmount();
    }, studioDeck());
    // The baseline is taken with the React root made (React DOM listens to the document itself), before anything renders.
    const baseline = await ev(() => window.leaks());
    await ev(() => window.render(0));
    await page.waitForFunction(() => window.created.length && document.querySelector('.opf-studio-box'), undefined, { timeout: 30000 });
    await ev(() => window.created.at(-1).ready);
    assert.equal(await ev(() => window.leaks().studios), 1, `${label} StrictMode: exactly one Studio is in the page`);
    assert.equal(await ev(() => window.created.length), 1, 'one editor was created');
    await page.locator('.opf-studio-tab', { hasText: 'Agent' }).click();
    await page.waitForFunction(() => document.querySelector('.opf-studio-tabpanel[data-host-panel=agent] #agent-panel')?.textContent === 'Agent panel 0');
    await ev(() => window.render(1));
    await page.waitForFunction(() => document.querySelector('#agent-panel')?.textContent === 'Agent panel 1');
    mark(`${label}: one Studio under StrictMode; a host panel renders through a portal into its tab and follows the host's state`);

    await page.waitForFunction(() => document.querySelector('#selected').textContent === '/slides/@row');
    await ev(() => window.created[0].select(['/slides/@row/blocks/@first']));
    await page.waitForFunction(() => document.querySelector('#selected').textContent === '/slides/@row/blocks/@first');
    const palette = await ev(() => window.palette.commands.filter((command) => ['studio.group', 'studio.zoom.in', 'studio.delete'].includes(command.id)).map(({ id, enabled }) => [id, enabled]));
    assert.deepEqual(palette, [['studio.zoom.in', true], ['studio.delete', true], ['studio.group', true]]);
    assert.equal(await ev(() => window.palette.run('studio.zoom.in')), true);
    assert.equal(await ev(() => window.created[0].zoom), 1.5, 'useOpfCommands runs a command');
    mark(`${label}: useOpfSelection returns the Studio's list and useOpfCommands lists and runs its commands`);

    await ev(() => window.unmount());
    const after = await ev(() => window.leaks());
    assert.deepEqual(after, baseline, 'unmount leaves no Studio, listener or observer');
    assert.equal(await ev(() => window.created[0].destroyed), true);
    mark(`${label}: unmount destroys the Studio and leaves nothing behind`);
    const warnings = errors.filter((text) => !/Download the React DevTools/.test(text));
    assert.deepEqual(warnings, [], 'no React warning or page error');
  } finally {
    await app.close();
  }
}

try {
  await run('React 19', undefined, 19);
  await run('React 18', { react: 'react-18', 'react-dom': 'react-dom-18' }, 18);
  console.log(`studio react browser: ${checks.length} checks passed\n- ${checks.join('\n- ')}`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
