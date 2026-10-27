// CE-20: the Studio harness, `createOpfEditor(el, { layout: "studio" })` with the page's fonts and the default catalog. Query options:
// ?mode=playground starts in the Playground preset (the File menu and "Open in Studio" switch in place, and the URL follows), ?dark=1 the dark
// scheme, ?readonly=1 read-only, ?source=right|bottom opens the source split, ?density=touch 44px controls. `window.studio` is the editor.
import { createOpfEditor } from '../src/workspace.js';
import { gallery } from '@openpresentation/gallery';
import * as browserFonts from '@openpresentation/opf-render/fonts-browser';

const query = new URLSearchParams(location.search);
if (query.get('dark') === '1') document.documentElement.setAttribute('data-theme', 'dark');
const faces = await fetch('./fonts.json').then((response) => {
  if (!response.ok) throw new Error('Bundled fonts are unavailable. Rebuild the editor demo.');
  return response.json();
});
const fonts = await browserFonts.loadFonts({
  faces: faces.map((face) => ({ family: face.family, weight: face.weight, italic: face.italic, license: face.license, data: Uint8Array.from(atob(face.dataUrl.split(',')[1]), (character) => character.charCodeAt(0)) })),
  substitutionPolicy: 'visual', fallbackFamily: 'Roboto', scriptBaseUrl: './script-fonts/', lazyFontsBaseUrl: new URL('./', document.baseURI).href,
});

const deck = {
  name: 'Quarterly review',
  language: 'en-US',
  design: { theme: 'classic', fontScheme: 'roboto' },
  slides: [
    { id: 'intro', title: 'Revenue grew 34% this quarter', subtitle: 'Every region beat its plan', composition: { mode: 'row', weights: [3, 2] }, blocks: [
      { id: 'story', text: 'Enterprise led the growth, and the new self-serve plan brought in a third of the new accounts.' },
      { id: 'kpi', metric: { value: '34%', label: 'Year over year' } },
    ] },
    { id: 'evidence', title: 'Where the growth came from', composition: { mode: 'row' }, blocks: [
      { id: 'chart', chart: { type: 'column', data: { columns: ['Region', 'Revenue'], rows: [['North', 42], ['South', 31], ['West', 27]] } } },
      { id: 'notes', composition: { mode: 'column' }, blocks: [
        { id: 'north', text: 'North: two large renewals.' },
        { id: 'south', items: ['Partner channel doubled', 'Churn under 2%'] },
      ] },
    ] },
    { id: 'plan', title: 'Next quarter', layout: 'two-column', blocks: [
      { id: 'hire', text: 'Hire two account executives for the West.' },
      { id: 'ship', items: ['Ship the analytics add-on', 'Open the Berlin office'] },
    ] },
  ],
};
const host = document.getElementById('studio');
const mode = query.get('mode') === 'playground' ? 'playground' : 'studio';
const editor = createOpfEditor(host, {
  document: deck,
  catalogs: [gallery],
  fonts,
  layout: mode,
  readOnly: query.get('readonly') === '1',
  ...(query.get('density') ? { density: query.get('density') } : {}),
  studio: {
    ...(query.get('source') ? { panels: { source: `split-${query.get('source')}` } } : {}),
    sizes: { key: 'opf-studio-harness', storage: { get: (key) => { try { return localStorage.getItem(key); } catch { return null; } }, set: (key, value) => { try { localStorage.setItem(key, value); } catch { /* not kept */ } } } },
  },
});
// The preset is kept in the address, so a reload returns to it.
editor.on('layout', ({ layout }) => {
  const url = new URL(location.href);
  if (layout === 'playground') url.searchParams.set('mode', 'playground'); else url.searchParams.delete('mode');
  history.replaceState(null, '', url);
});
await editor.ready;
window.studio = editor;
