// CE-06: a bare page for the embeddable editor (src/workspace.js): the package's own stylesheet, the renderer's browser fonts handle (Roboto
// only, which the fixtures use) and the gallery catalog, bundled the way a host's bundler would. No playground involved.
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { loadFonts } from '@openpresentation/opf-render/fonts-node';
import { buildStyles } from '../../scripts/build-styles.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

export const deck = (slides = 3, extra = {}) => ({
  name: 'Workspace fixture',
  language: 'en-US',
  design: { theme: 'classic', fontScheme: 'roboto' },
  slides: Array.from({ length: slides }, (_, index) => ({ id: `s${index + 1}`, title: `Slide ${index + 1}`, text: `Words on slide ${index + 1}` })),
  ...extra,
});

const bundles = new Map();
// The page bundle: the workspace, the React bindings and the renderer's browser fonts. `alias` swaps a package for another (the React 18 run
// maps react and react-dom to react-18 and react-dom-18); `extraEntry` adds code to the page script.
export async function bundleWorkspace({ extraEntry = '', alias } = {}) {
  const result = await build({ alias, stdin: { resolveDir: root, contents: `
    import * as workspace from './src/workspace.js';
    import * as react from './src/react.js';
    import { createEditorSession } from './src/index.js';
    import { gallery } from '@openpresentation/gallery';
    import { loadFonts } from '@openpresentation/opf-render/fonts-browser';
    window.opfWs = { ...workspace, createEditorSession, gallery, loadFonts, react };
    ${extraEntry}
  ` }, bundle: true, platform: 'browser', format: 'iife', write: false, minify: !process.env.OPF_TEST_UNMINIFIED, conditions: ['browser'], logLevel: 'error',
    // The development build of React: StrictMode double-invokes effects there (and only there), which is what the tests exercise.
    define: { 'process.env.NODE_ENV': '"development"' } });
  return result.outputFiles[0].text;
}

export async function startWorkspacePage({ viewport = { width: 1280, height: 860 }, body = '<div id="host" style="width:1200px;height:800px"></div>', colorScheme, bundle: bundleOptions = {}, context = {}, args = [] } = {}) {
  const key = JSON.stringify(bundleOptions);
  if (!bundles.has(key)) bundles.set(key, await bundleWorkspace(bundleOptions));
  const bundle = bundles.get(key);
  const faces = (await loadFonts({ pack: 'office' })).registry.embeddedFonts.filter((face) => face.family === 'Roboto' && [400, 700].includes(face.weight) && !face.italic);
  const css = (await buildStyles(new URL('../../src/styles/', import.meta.url))).css;
  const browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined, args });
  // `context` adds page options (CE-20: `hasTouch` and `isMobile` for a coarse pointer); `args` adds browser flags (`--js-flags=--expose-gc`).
  const page = await browser.newPage({ viewport, ...(colorScheme ? { colorScheme } : {}), ...context });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  page.on('console', (message) => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text()); });
  await page.setContent(`<!doctype html><meta charset="utf-8"><body style="margin:0">${body}</body>`);
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: bundle });
  // One fonts handle for the page, as a host has.
  await page.evaluate(async (fontFaces) => {
    window.fonts = await window.opfWs.loadFonts({ faces: fontFaces.map((face) => ({ ...face, data: Uint8Array.from(atob(face.dataUrl.split(',')[1]), (c) => c.charCodeAt(0)) })), substitutionPolicy: 'visual', fallbackFamily: 'Roboto' });
  }, faces);
  return { page, browser, errors, faces, async close() { await browser.close(); } };
}
