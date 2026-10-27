import assert from 'node:assert/strict';
import { startStudioPage, studioDeck } from './support/studio-page.mjs';

// OpenPresentation/opf#912: the handle methods work before the editor has mounted. The slide parts load as a chunk, so for a moment after
// `createOpfEditor` returns the slide row's factories are not bound yet: `setDensity` used to rebuild the slide row there and threw "createSlideNavigator
// is not a function" (a React host whose `density` prop settles in the first effects hit it, so did the Playground on a phone). Every setter is
// called right after `createOpfEditor`, before `ready`, in a source-only host, with `slots`, in the Studio and in the Playground, and the result is
// checked once the editor is mounted. The same through the React bindings: `density` changing while the editor is not mounted.
const checks = [];
const mark = (name) => checks.push(name);
const reactEntry = `
  import * as React from 'react';
  import { createRoot } from 'react-dom/client';
  window.R = { React, createRoot };
`;
const app = await startStudioPage({ bundle: { extraEntry: reactEntry } });
const { page, errors } = app;
const ev = (fn, arg) => page.evaluate(fn, arg);
const settle = () => page.waitForFunction(() => window.ed?.mounted && !/Loading fonts/.test(document.querySelector('[data-opf-slot=status], .opf-studio-message')?.textContent ?? '') && !document.querySelector('.opf-canvas-fonts'), undefined, { timeout: 30000 });

// Create an editor, run `calls` (names of handle methods with their arguments) before it is mounted, and report what threw and what they returned.
async function early(options, calls, script = '') {
  const result = await ev(({ options, calls, script, d }) => {
    window.ed?.destroy();
    const host = window.makeHost();
    window.ed = window.opfWs.createOpfEditor(host, { document: d, ...window.base(), ...options });
    const out = { mountedAtOnce: window.ed.mounted, threw: {}, returned: {} };
    for (const [name, ...args] of calls) {
      try {
        out.returned[name] = window.ed[name](...args);
      } catch (error) {
        out.threw[name] = String(error?.message ?? error);
      }
    }
    // `script` runs right after the calls, still before the editor can have mounted, with the editor and the result.
    if (script) new Function('ed', 'out', script)(window.ed, out);
    return out;
  }, { options, calls, script, d: studioDeck() });
  return result;
}
const mountedNow = async () => { await ev(() => window.ed.ready); await settle(); };

try {
  // ---- the default workspace (a slide row, Export, Present, Review, the views), with `layout: "full"` ---------------------------------------------------------
  const full = await early({ density: 'comfortable', exportMode: 'menu' }, [
    ['setDensity', 'touch'], ['setExportMode', 'sheet'], ['setTheme', { tokens: { accent: 'rgb(11, 22, 33)' } }], ['setReadOnly', true],
    ['setView', 'outline'], ['setSlide', 2], ['setName', 'early-name'], ['status', 'An early message'], ['showPanel', 'review'], ['select', 'slides.2.title'],
    ['focus', 'source'], ['openFind', { query: 'Short' }], ['undo'], ['redo'], ['commit'], ['refresh'],
    ['setLayout', 'playground'], ['setZoom', 2], ['fit', 'width'], ['openLayout', 'text-and-media'],
  ], 'out.nameBefore = ed.getName();');
  assert.equal(full.mountedAtOnce, false);
  assert.deepEqual(full.threw, {}, 'no handle method throws before the editor is mounted');
  assert.equal(full.nameBefore, 'early-name', 'getName answers with the name set before mount');
  await mountedNow();
  const after = await ev(() => {
    const root = window.ed.root;
    return {
      density: root.dataset.density,
      nav: root.querySelector('.opf-nav')?.dataset.density,
      strip: root.querySelector('.opf-thumbs')?.dataset.density ?? root.querySelector('nav[data-density]')?.dataset.density,
      source: root.querySelector('.opf-source')?.dataset.density,
      exportMode: root.querySelector('.opf-export')?.dataset.mode,
      exportDensity: root.querySelector('.opf-export')?.dataset.density,
      readOnly: window.ed.readOnly,
      readOnlyAttribute: root.hasAttribute('data-readonly'),
      view: window.ed.view,
      dataView: root.dataset.view,
      slideIndex: window.ed.slideIndex,
      counter: root.querySelector('.opf-nav-counter')?.textContent,
      name: window.ed.getName(),
      accent: getComputedStyle(root.querySelector('.opf-source')).getPropertyValue('--opf-ui-accent').trim(),
      panel: [...root.querySelectorAll('[role=tab]')].filter((tab) => tab.getAttribute('aria-selected') === 'true').map((tab) => tab.textContent.replace(/\s*\(.*$/, '')),
      findOpen: !root.querySelector('[data-opf-slot=find]')?.hidden,
      layout: window.ed.layout,
      errors: window.ed.lastError?.message,
    };
  });
  assert.equal(after.density, 'touch', 'setDensity before mount is the density of the mounted editor');
  assert.equal(after.nav, 'touch', 'the slide navigator is built with it');
  assert.equal(after.source, 'touch');
  assert.equal(after.exportDensity, 'touch');
  assert.equal(after.exportMode, 'sheet', 'setExportMode before mount holds');
  assert.equal(after.readOnly, true);
  assert.equal(after.readOnlyAttribute, true, 'setReadOnly before mount locks the mounted editor');
  assert.equal(after.view, 'outline', 'setView before mount shows that view when mounted');
  assert.equal(after.dataView, 'outline');
  assert.equal(after.counter, '03 / 05', 'setSlide before mount shows that slide');
  assert.equal(after.name, 'early-name');
  assert.equal(after.accent, 'rgb(11, 22, 33)', 'setTheme before mount themes the chrome');
  assert.deepEqual(after.panel, ['Review'], 'showPanel before mount shows the panel');
  assert.equal(after.findOpen, true, 'openFind before mount opens Find once mounted');
  assert.equal(after.layout, 'full', 'setLayout is the Studio\'s only');
  assert.equal(after.errors, undefined, 'nothing was reported as an error');
  mark('layout full: every setter called before ready is applied once mounted (density, export mode, theme, read-only, view, slide, name, panel, Find)');

  // The last call before mount wins, and a setting made before mount beats the option.
  await early({ density: 'touch', view: 'sorter' }, [['setDensity', 'comfortable'], ['setView', 'slide'], ['setDensity', 'touch'], ['setDensity', 'comfortable']]);
  await mountedNow();
  assert.deepEqual(await ev(() => ({ density: window.ed.root.dataset.density, nav: window.ed.root.querySelector('.opf-nav').dataset.density, view: window.ed.view })), { density: 'comfortable', nav: 'comfortable', view: 'slide' });
  mark('the last call before mount wins over the earlier calls and over the option');

  // After mount the same methods work as they always did.
  await ev(() => window.ed.setDensity('touch'));
  assert.equal(await ev(() => window.ed.root.querySelector('.opf-nav').dataset.density), 'touch', 'setDensity after mount still rebuilds the slide row');
  assert.equal(await ev(() => window.ed.destroyed), false);

  // Calls on a destroyed editor do nothing and do not throw.
  const destroyed = await ev(() => {
    window.ed.destroy();
    const threw = [];
    for (const [name, ...args] of [['setDensity', 'touch'], ['setExportMode', 'sheet'], ['setView', 'sorter'], ['setLayout', 'playground'], ['select', 'slides.0.title'], ['present'], ['setZoom', 2], ['showPanel', 'review'], ['openFind'], ['focus']]) {
      try { window.ed[name](...args); } catch (error) { threw.push(`${name}: ${error.message}`); }
    }
    return threw;
  });
  assert.deepEqual(destroyed, [], 'a destroyed editor ignores the calls');
  mark('a destroyed editor ignores the setters');

  // ---- a source-only host: no slide chunk, the same calls ---------------------------------------------------------------------------------------------
  const sourceOnly = await early({ layout: 'source' }, [
    ['setDensity', 'touch'], ['setExportMode', 'sheet'], ['setTheme', { tokens: { accent: 'rgb(1, 2, 3)' } }], ['setReadOnly', true], ['setView', 'slide'], ['setView', 'sorter'],
    ['setSlide', 1], ['setName', 'source-name'], ['status', 'hello'], ['select', 'slides.0.title'], ['focus', 'source'], ['present'], ['openFind'], ['setLayout', 'studio'],
    ['setZoom', 2], ['fit'], ['openLayout'], ['showPanel', 'review'], ['commit'], ['refresh'],
  ]);
  assert.deepEqual(sourceOnly.threw, {});
  assert.equal(sourceOnly.returned.setView === undefined, false);
  await mountedNow();
  const sourceAfter = await ev(() => ({
    density: window.ed.root.dataset.density, source: window.ed.root.querySelector('.opf-source').dataset.density, readOnly: window.ed.readOnly,
    name: window.ed.getName(), canvas: Boolean(window.ed.root.querySelector('.opf-canvas')), lastError: window.ed.lastError?.message, views: window.ed.views,
    accent: getComputedStyle(window.ed.root.querySelector('.opf-source')).getPropertyValue('--opf-ui-accent').trim(),
  }));
  assert.deepEqual({ ...sourceAfter, accent: undefined }, { density: 'touch', source: 'touch', readOnly: true, name: 'source-name', canvas: false, lastError: undefined, views: ['slide'], accent: undefined });
  assert.equal(sourceAfter.accent, 'rgb(1, 2, 3)');
  mark('a source-only host: the same calls before ready do not throw, and density, read-only, name and theme are applied');

  // A host that arranges the page itself with `slots`.
  const slotsHost = await ev(async ({ d }) => {
    window.ed?.destroy();
    const host = window.makeHost();
    host.innerHTML = '<div data-s="navigator"></div><div data-s="thumbnails"></div><div data-s="canvas" style="width:600px;height:340px"></div><div data-s="source" style="height:200px"></div>';
    const slot = (name) => host.querySelector(`[data-s=${name}]`);
    window.ed = window.opfWs.createOpfEditor(host, { document: d, ...window.base(), slots: { navigator: slot('navigator'), thumbnails: slot('thumbnails'), canvas: slot('canvas'), source: slot('source') } });
    const threw = {};
    for (const [name, ...args] of [['setDensity', 'touch'], ['setTheme', { tokens: { accent: 'rgb(4, 5, 6)' } }], ['setSlide', 3], ['setReadOnly', true], ['setName', 'slots-name'], ['setExportMode', 'sheet'], ['select', 'slides.3.title']]) {
      try { window.ed[name](...args); } catch (error) { threw[name] = error.message; }
    }
    return threw;
  }, { d: studioDeck() });
  assert.deepEqual(slotsHost, {});
  await ev(() => window.ed.ready);
  assert.deepEqual(await ev(() => ({ nav: window.ed.slots.navigator.querySelector('.opf-nav').dataset.density, index: window.ed.slideIndex, counter: window.ed.slots.navigator.querySelector('.opf-nav-counter').textContent, readOnly: window.ed.readOnly })), { nav: 'touch', index: 3, counter: '04 / 05', readOnly: true });
  mark('slots: the slide row mounts with the density and the slide chosen before ready');

  // ---- the Studio -------------------------------------------------------------------------------------------------------------------------------------
  const studio = await early({ layout: 'studio' }, [
    ['setDensity', 'touch'], ['setExportMode', 'sheet'], ['setTheme', { tokens: { accent: 'rgb(7, 8, 9)' } }], ['setView', 'slide'], ['setSlide', 1], ['setName', 'studio-name'],
    ['setLayout', 'playground'], ['setZoom', 2], ['fit', 'width'], ['setZoom', 2], ['select', ['slides.1.blocks.0']], ['showPanel', 'review'], ['status', 'early'],
    ['openFind', { query: 'Left' }], ['focus', 'canvas'], ['commit'], ['undo'], ['refresh'],
  ], "ed.commands.register({ id: 'host.early', label: 'Early command', run: () => true });");
  assert.deepEqual(studio.threw, {});
  assert.equal(studio.returned.setLayout, true, 'the layout switch is accepted');
  await mountedNow();
  const studioAfter = await ev(() => ({
    layout: window.ed.layout, density: window.ed.root.dataset.density, nav: window.ed.root.querySelector('.opf-nav')?.dataset.density, slideIndex: window.ed.slideIndex,
    selection: window.ed.selection.map((item) => item.path), zoom: window.ed.zoom, name: window.ed.getName(), error: window.ed.lastError?.message,
    command: window.ed.commands.list().some((command) => command.id === 'host.early'),
    panel: [...window.ed.root.querySelectorAll('[role=tab]')].filter((tab) => tab.getAttribute('aria-selected') === 'true').map((tab) => tab.textContent.replace(/\s*\(.*$/, '')),
  }));
  assert.equal(studioAfter.layout, 'playground', 'setLayout before mount switches the Studio to the Playground');
  assert.equal(studioAfter.density, 'touch');
  assert.equal(studioAfter.nav, 'touch', 'the Playground\'s slide row has the density');
  assert.equal(studioAfter.slideIndex, 1);
  assert.deepEqual(studioAfter.selection, ['/slides/1/blocks/0'], 'select before mount selects once mounted');
  assert.equal(studioAfter.name, 'studio-name');
  assert.equal(studioAfter.command, true, 'a command registered before mount is in the registry once mounted');
  assert.equal(studioAfter.error, undefined);
  mark('layout studio: density, layout, slide, selection, panel, name and a command registered before ready are applied once mounted');

  // The zoom is the Studio's own, so it is checked on a Studio that stays one.
  await early({ layout: 'studio' }, [['setZoom', 2], ['fit', 'width'], ['setZoom', 2], ['openLayout', 'text-and-media'], ['setDensity', 'touch']]);
  await mountedNow();
  assert.equal(await ev(() => window.ed.zoom), 2, 'setZoom before mount zooms once mounted');
  assert.equal(await ev(() => window.ed.view), 'layouts', 'openLayout before mount opens Layout Studio once mounted');
  mark('layout studio: zoom and "Edit layout" requested before ready happen once mounted');

  // The withdrawn command is not registered.
  await early({ layout: 'studio' }, [], "ed.commands.register({ id: 'host.gone', label: 'Gone', run: () => true })();");
  await mountedNow();
  assert.equal(await ev(() => window.ed.commands.list().some((command) => command.id === 'host.gone')), false, 'the function register returns withdraws the command before mount');

  // ---- the Playground ---------------------------------------------------------------------------------------------------------------------------------
  const playground = await early({ layout: 'playground' }, [
    ['setDensity', 'touch'], ['setExportMode', 'sheet'], ['setTheme', { tokens: { accent: 'rgb(9, 8, 7)' } }], ['setSlide', 2], ['setReadOnly', false], ['setName', 'playground-name'],
    ['setLayout', 'studio'], ['setZoom', 1.5], ['select', ['slides.2.title']], ['showPanel', 'design'], ['present', 0], ['setDensity', 'comfortable'], ['setDensity', 'touch'],
  ]);
  assert.deepEqual(playground.threw, {});
  await mountedNow();
  const playgroundAfter = await ev(() => ({
    layout: window.ed.layout, density: window.ed.root.dataset.density, nav: window.ed.root.querySelector('.opf-nav')?.dataset.density, slideIndex: window.ed.slideIndex,
    name: window.ed.getName(), error: window.ed.lastError?.message,
  }));
  assert.equal(playgroundAfter.layout, 'studio', 'setLayout before mount switches the Playground to the Studio');
  assert.equal(playgroundAfter.density, 'touch');
  assert.equal(playgroundAfter.slideIndex, 2);
  assert.equal(playgroundAfter.name, 'playground-name');
  assert.equal(playgroundAfter.error, undefined);
  await page.waitForFunction(() => window.ed.presenter?.isRunning(), undefined, { timeout: 10000 }).catch(() => {});
  assert.equal(await ev(() => window.ed.presenter.isRunning()), true, 'present before mount starts the presentation once mounted');
  await ev(() => window.ed.presenter.stop());
  mark('layout playground: density, layout, slide, name and Present requested before ready are applied once mounted');

  // The Playground on a phone: the density flips to "touch" before the editor has mounted, the repro of the issue.
  const phone = await early({ layout: 'playground', density: 'auto' }, [['setDensity', 'touch']]);
  assert.deepEqual(phone.threw, {});
  await mountedNow();
  assert.equal(await ev(() => window.ed.root.querySelector('.opf-nav').dataset.density), 'touch');
  mark('the issue: setDensity("touch") right after createOpfEditor with the Playground mounts a touch slide row');

  // ---- React: the `density` prop settles before the editor has mounted ------------------------------------------------------------------------------------
  await ev(() => window.ed?.destroy());
  await ev(() => {
    const { React, createRoot } = window.R, h = React.createElement;
    const { OpfEditor } = window.opfWs.react;
    window.reactState = { created: [], calls: [] };
    function App({ layout }) {
      // The density is decided by a media query after the first render, as in the Playground: `onEditor` runs as soon as the editor is created.
      const [density, setDensity] = React.useState(undefined);
      return h(OpfEditor, { id: 'react-early', layout, density, ...window.base(), fonts: () => new Promise((resolve) => setTimeout(() => resolve(window.fonts), 400)), document: window.studioDocument, style: { width: 1200, height: 800 },
        onEditor: (editor) => { if (editor) { window.reactState.created.push(editor); const orig = editor.setDensity; editor.setDensity = (value) => { window.reactState.calls.push({ layout, value, mounted: editor.mounted }); return orig(value); }; setDensity('touch'); } },
        });
    }
    window.studioDocument = { name: 'React early', design: { theme: 'classic', fontScheme: 'roboto' }, slides: [{ id: 'one', title: 'One' }, { id: 'two', title: 'Two' }] };
    for (const layout of ['playground', 'studio', 'full']) {
      const container = document.body.appendChild(Object.assign(document.createElement('div'), { id: `react-${layout}` }));
      createRoot(container).render(h(App, { layout }));
    }
  });
  await page.waitForFunction(() => window.reactState.created.length === 3 && window.reactState.created.every((editor) => editor.mounted && editor.root.dataset.density === 'touch'), undefined, { timeout: 30000 });
  const reactAfter = await ev(() => window.reactState.created.map((editor) => ({ layout: editor.layout, density: editor.root.dataset.density, nav: editor.root.querySelector('.opf-nav')?.dataset.density, error: editor.lastError?.message })));
  assert.deepEqual((await ev(() => window.reactState.calls)).map((call) => call.mounted), [false, false, false], 'the density prop reached each editor while it was not mounted yet');
  for (const entry of reactAfter) {
    assert.equal(entry.density, 'touch', `React ${entry.layout}: the density prop that settled before mount is applied`);
    assert.equal(entry.error, undefined);
    if (entry.nav !== undefined) assert.equal(entry.nav, 'touch');
  }
  mark('React: a density prop that changes before the editor has mounted no longer throws, in the full, studio and playground layouts');

  assert.deepEqual(errors, [], 'no page error: nothing threw');
} finally {
  await app.close();
}

console.log(`handle-before-mount browser checks passed (${checks.length}):\n- ${checks.join('\n- ')}`);
