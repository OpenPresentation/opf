// RR-98: a bare host page for the presenter and Present button suites. It bundles the real modules with esbuild, serves the real stylesheet
// (the whole dist/styles.css built from src/styles) and gives the renderer's browser fonts handle (Roboto) to every presenter. The renderer's
// `toSvg` is wrapped so a test can see which slides were drawn and when; nothing else is mocked. No request leaves the page: any http(s) request is
// recorded and aborted, and the suite asserts the list is empty.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { loadFonts } from '@openpresentation/opf-render/fonts-node';
import { buildStyles } from '../../scripts/build-styles.mjs';

const root = new URL('../../', import.meta.url);
const realSvg = fileURLToPath(import.meta.resolve('@openpresentation/opf-render/svg'));

export async function startPresenterPage({ viewport = { width: 1000, height: 600 }, hasTouch = false, body = '' } = {}) {
  const faces = (await loadFonts({ pack: 'office' })).registry.embeddedFonts.filter((face) => face.family === 'Roboto' && [400, 700].includes(face.weight) && !face.italic);
  const countSvg = {
    name: 'count-svg',
    setup(b) {
      b.onResolve({ filter: /^@openpresentation\/opf-render\/svg$/ }, (args) => (args.importer.endsWith('presenter.js') ? { path: 'counted-svg', namespace: 'counted' } : undefined));
      b.onLoad({ filter: /.*/, namespace: 'counted' }, () => ({
        contents: `import { toSvg as real } from ${JSON.stringify(realSvg)};
          export function toSvg(deck, slides, options) { (window.svgCalls ??= []).push({ slides: [].concat(slides), at: performance.now() }); return real(deck, slides, options); }`,
        resolveDir: fileURLToPath(root), loader: 'js',
      }));
    },
  };
  const bundled = await build({
    stdin: { resolveDir: fileURLToPath(root), loader: 'js', contents: `
      import { createEditorSession } from './src/index.js';
      import { createPresenter, createPresentButton, bindPresentShortcut } from './src/presenter.js';
      import { createExportMenu } from './src/export-menu.js';
      import { loadFonts } from '@openpresentation/opf-render/fonts-browser';
      import { gallery } from '@openpresentation/gallery';
      window.opfPresent = { createEditorSession, createPresenter, createPresentButton, bindPresentShortcut, createExportMenu, gallery, loadFonts };
    ` },
    bundle: true, platform: 'browser', format: 'iife', write: false, minify: true, plugins: [countSvg],
  });
  const css = (await buildStyles(new URL('src/styles/', root))).css;
  const browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
  const context = await browser.newContext({ viewport, hasTouch });
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  page.on('console', (message) => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text()); });
  await page.route(/^https?:/, (route) => { requests.push(route.request().url()); route.abort(); });
  page.on('request', (request) => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  await page.setContent(`<!doctype html><html lang="en"><meta charset="utf-8"><body class="opf-ui" style="margin:0;padding:12px"><button id="opener">Open the deck</button><input id="field" aria-label="Field"><textarea id="area" aria-label="Area"></textarea><div id="editable" contenteditable="true">editable</div><div id="cm" class="cm-editor"><div tabindex="0" id="cm-line">code</div></div><div id="host"></div><div id="menu-host"></div>${body}</body></html>`);
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: bundled.outputFiles[0].text });
  await page.evaluate(async (fontFaces) => {
    const { createEditorSession, gallery, loadFonts } = window.opfPresent;
    window.fonts = await loadFonts({ faces: fontFaces.map((face) => ({ ...face, data: Uint8Array.from(atob(face.dataUrl.split(',')[1]), (c) => c.charCodeAt(0)) })), substitutionPolicy: 'visual', fallbackFamily: 'Roboto' });
    window.makeDeck = (count, hidden = [], name = 'Presenter fixture') => ({ name, design: { theme: 'classic', fontScheme: 'roboto' }, slides: Array.from({ length: count }, (_, index) => ({ id: `s${index + 1}`, title: `Slide ${index + 1}`, text: `Words on slide ${index + 1}`, ...(hidden.includes(index) ? { hidden: true } : {}) })) });
    window.makeEditor = (count, hidden) => createEditorSession(window.makeDeck(count, hidden), { rejectInvalid: true, catalogs: [gallery] });
  }, faces);
  return { page, context, browser, errors, requests, async close() { await browser.close(); } };
}
