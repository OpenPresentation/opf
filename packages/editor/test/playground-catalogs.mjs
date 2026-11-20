import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { playgroundCatalogs } from '../examples/playground-catalogs.js';
import { createEditorSession } from '../src/index.js';
import { loadIconSets, searchIcons, setIcon } from '../src/icon-options.js';

// RR-63: the playground's catalogs, without a browser. In f0b92fcec the page registered `galleryIconSets` (by then a function) as a catalog,
// so createEditorSession threw `invalid-catalogs` and the page never started; only the browser suites would have shown it, and they had not
// run on that branch (they run in CI's playground shards, and Smart App Control blocks Playwright's browsers on the Windows workstation). This
// test runs in every `pnpm test` of the editor: the session starts with the page's catalogs, and with only the files build-playground.mjs copies
// into opf-icons/ (each set's index, whole set and keywords), the picker's search finds icons and the deck draws a set icon.
const icons = path.join(path.dirname(createRequire(import.meta.url).resolve('@openpresentation/gallery/package.json')), 'dist', 'icons');
const base = 'https://playground.test/editor/';
const requested = [];
globalThis.fetch = async (url) => {
  const href = String(url);
  requested.push(href);
  const file = href.startsWith(`${base}opf-icons/`) ? href.slice(`${base}opf-icons/`.length) : undefined;
  // The page's static host: the set-level files only; anything else is a 404.
  if (!file || file.includes('/')) return new Response('Not found', { status: 404 });
  try {
    return new Response(await readFile(path.join(icons, file)), { headers: { 'content-type': 'application/json' } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
};

const catalogs = playgroundCatalogs(`${base}index.html`);
const editor = createEditorSession({ name: 'Icons', slides: [{ title: 'Why', items: ['Fast', 'Safe'] }] }, { catalogs });
assert.deepEqual(editor.catalogs.map((catalog) => catalog.source), ['https://www.pptx.gallery', 'https://www.pptx.gallery'], 'the session starts with the gallery and its icon sets');

const found = await searchIcons(editor, 'truck', { limit: 5 });
assert.equal(found.icons[0].icon, 'lucide:truck', 'the picker searches the served keywords');
assert.equal(found.unavailable, undefined);

const change = setIcon(editor, 'slides.0.items.0', 'lucide:truck');
await change.ready;
assert.equal(editor.composeSlide(0).icons.length, 1, 'the deck draws the set icon from the served whole set');
setIcon(editor, 'slides.0.items.1', 'tabler:rocket');
await loadIconSets(editor);
assert.equal(editor.composeSlide(0).icons.length, 2);
assert.deepEqual(requested.filter((url) => url.endsWith('.icons.json')).sort(), [`${base}opf-icons/lucide.icons.json`, `${base}opf-icons/tabler.icons.json`], 'each whole set is read once');
console.log('RR-63 playground catalogs: the session starts, search and drawing work over the set-level icon files.');
