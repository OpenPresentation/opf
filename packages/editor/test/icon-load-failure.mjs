// RR-63: an icon that cannot be loaded never blocks drawing. The renderer's browser fonts handle lists a registered set whose icons are not
// loaded as pending (`icons:<set>`, from core's iconsPending) and loads them in `ensure` (core's ensureIcons); the editor's font gate and the
// canvas wait on that. In f0b92fcec a failed load left the icons pending for ever, so the gate threw "icons:lucide did not finish loading."
// and the canvas never drew the slide. Now a failed icon is settled: nothing is pending, the slide draws without it, its finding says which
// icon and why, and only an explicit `ensureIcons(deck, { retry: true })` asks again.
import assert from 'node:assert/strict';
import { gallery } from '@openpresentation/gallery';
import { ensureIcons, iconsPending, validate } from '@openpresentation/opf';
import { loadFonts } from '@openpresentation/opf-render/fonts-node';
import { galleryIconSets } from '@openpresentation/gallery/icon-sets';
import { convert } from '../src/export.js';
import { fontGate, whenFontsReady } from '../src/font-gate.js';
import { createEditorSession } from '../src/index.js';
import { listIconSets, searchIcons } from '../src/icon-options.js';

const nodeFonts = await loadFonts();
/** The renderer's browser handle as the canvas sees it, over the Node faces: icon sets pending and loaded as fonts-browser.js does. */
const handle = {
  textMeasurement: nodeFonts.textMeasurement,
  get embeddedFonts() { return nodeFonts.embeddedFonts; },
  pending: (presentation, renderOptions) => [...iconsPending(presentation, { catalogs: renderOptions?.catalogs }).sets.map((set) => `icons:${set}`), ...nodeFonts.pending(presentation, renderOptions)],
  async ensure(presentation, options = {}) {
    await ensureIcons(presentation, { catalogs: options.catalogs });
    return nodeFonts.ensure(presentation, options);
  },
};

let calls = 0;
const offline = { source: 'https://www.pptx.gallery', iconSets: { lucide: async () => { calls += 1; throw new Error('https://example.test/opf-icons/lucide.json could not be fetched: offline'); } } };
const catalogs = [gallery, offline];
const deck = { name: 'Offline', language: 'en', design: { theme: 'classic', fontScheme: 'roboto' }, slides: [{ title: 'What we ship', items: [{ text: 'Fast', icon: 'lucide:truck' }, { text: 'Safe', icon: 'lucide:shield' }] }] };

// The gate loads once, the load fails, and nothing is left pending: no "did not finish loading".
const gate = fontGate(handle);
assert.deepEqual(gate.pending(deck, { catalogs }), ['icons:lucide']);
await gate.ensure(deck, { renderOptions: { catalogs } });
assert.deepEqual(gate.pending(deck, { catalogs }), [], 'a failed icon is settled, not pending');
assert.equal(calls, 1);

// The canvas path: whenFontsReady runs `ready`, never `failed`, and a second document state asks the loader nothing.
let readyRan = false, failedWith;
await whenFontsReady(handle, structuredClone(deck), { renderOptions: { catalogs }, ready: () => { readyRan = true; }, failed: (error) => { failedWith = error; } });
assert.equal(readyRan, true, 'the slide draws');
assert.equal(failedWith, undefined);
assert.equal(calls, 1, 'nothing retries in a draw loop');

// The slide draws without the icons (the export through the gate too), and the finding says which icon could not be loaded and why.
const exported = await convert(deck, { format: 'svg', fonts: handle, renderOptions: { catalogs } });
const svg = new TextDecoder().decode(exported.files[0].bytes);
assert.match(svg, /What we ship/);
assert.doesNotMatch(svg, /<circle/, 'no icon chip is drawn (a drawn icon is a circle chip with its glyph)');
const findings = validate(deck, { catalogs }).findings.filter((finding) => finding.ruleId === 'opf/icon-unknown');
assert.deepEqual(findings.map((finding) => [finding.path, finding.message]), [
  ['/slides/0/items/0/icon', 'The icon lucide:truck could not be loaded: https://example.test/opf-icons/lucide.json could not be fetched: offline'],
  ['/slides/0/items/1/icon', 'The icon lucide:shield could not be loaded: https://example.test/opf-icons/lucide.json could not be fetched: offline'],
]);

// A set that loaded once and then fails for a later icon: that icon is settled with its finding too (it was silent in f0b92fcec).
let failing = false;
const real = galleryIconSets().iconSets.tabler;
const flaky = { source: 'https://www.pptx.gallery', iconSets: { tabler: async (request) => { if (failing) throw new Error('offline'); return real(request); } } };
const editor = createEditorSession({ name: 'Flaky', slides: [{ title: 'x', items: [{ text: 'a', icon: 'tabler:rocket' }, 'b'] }] }, { catalogs: [gallery, flaky] });
await ensureIcons(editor.presentation, { catalogs: editor.catalogs });
assert.equal(editor.composeSlide(0).icons.length, 1);
failing = true;
editor.applyPatch([{ op: 'replace', path: '/slides/0/items/1', value: { text: 'b', icon: 'tabler:bell' } }]);
await fontGate(handle).ensure(editor.presentation, { renderOptions: { catalogs: editor.catalogs } });
assert.deepEqual(iconsPending(editor.presentation, { catalogs: editor.catalogs }).sets, []);
assert.equal(editor.composeSlide(0).icons.length, 1, 'the loaded icon draws, the failed one does not');
assert.deepEqual(validate(editor.presentation, { catalogs: editor.catalogs }).findings.filter((finding) => finding.ruleId === 'opf/icon-unknown').map((finding) => finding.message), ['The icon tabler:bell could not be loaded: offline']);

// An explicit retry asks again, and draws once the files are back.
failing = false;
await ensureIcons(editor.presentation, { catalogs: editor.catalogs, retry: true });
assert.equal(editor.composeSlide(0).icons.length, 2);
assert.deepEqual(validate(editor.presentation, { catalogs: editor.catalogs }).findings.filter((finding) => /icon/.test(finding.ruleId)), []);
// The picker's search says why instead of "no matches" (the stub reader of a browser with no files served, here as a loader).
const unserved = createEditorSession({ slides: [{ title: 'x' }] }, { catalogs: [gallery, galleryIconSets(async () => { throw new Error('The gallery icon files cannot be read in this runtime: serve them.'); })] });
await assert.rejects(searchIcons(unserved, 'truck'), (error) => error.code === 'icon-sets-unavailable' && error.message === 'The icon sets could not be loaded: The gallery icon files cannot be read in this runtime: serve them.' && error.details.unavailable.length === 2);
assert.match(listIconSets(unserved)[0].error, /cannot be read in this runtime/);
console.log('RR-63 icon load failures: settled, the slide draws without them, the finding names the icon and the reason; a retry draws them.');
