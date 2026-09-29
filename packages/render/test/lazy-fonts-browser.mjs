// FF-31: vendored faces (Intos for the default Aptos scheme) load lazily in a real browser, and measurement and painting
// never disagree. A page bundles the browser font loader and the SVG renderer, serves the eager base faces and the
// pinned vendored files from local routes and nothing else, and checks, for an Aptos deck, that
//   - before loading, the registry and the document both hold only Roboto for Aptos (the visual alternate),
//   - ensureLazyFonts fetches exactly the eight Intos and Intos Display files, hash-verified,
//   - afterwards the registry and the document hold the same faces, the drawn family is Intos, and every drawn run's
//     natural advance equals the registry's accepted (measured) advance within 0.1 px.
// Offline: every other request is aborted.
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {loadBundledFontRegistry} from '../dist/fonts-node.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.resolve(root, process.argv[2] ?? 'artifacts/lazy-fonts');
await mkdir(outputDirectory, {recursive: true});
const bundle = await build({
  stdin: {contents: "import {loadBrowserFontRegistry} from './dist/fonts-browser.js';import {renderSvg} from './dist/svg.js';window.opf={loadBrowserFontRegistry,renderSvg};", resolveDir: root, sourcefile: 'entry.js', loader: 'js'},
  bundle: true, platform: 'browser', format: 'iife', write: false, minify: true, metafile: true,
});
const script = bundle.outputFiles[0].text;
assert.ok(!Object.keys(bundle.metafile.inputs).some(input => /sharp|raster|resvg|fonts-node/.test(input)), 'the browser bundle must not pull in native raster or Node font modules');

const eager = (await loadBundledFontRegistry()).embeddedFonts.map((face, index) => ({index, family: face.family, weight: face.weight, italic: !!face.italic, bytes: Buffer.from(face.dataUrl.split(',')[1], 'base64')}));
const ORIGIN = 'https://app.test';
const fontRequests = [];
const decks = {
  aptos: {name: 'Aptos deck', slides: [{id: 'a', title: 'Quarterly operating review', text: 'Revenue grew in every region, led by the enterprise segment.'}]},
  roboto: {name: 'Roboto deck', design: {fontScheme: 'roboto'}, slides: [{id: 'a', title: 'Quarterly operating review', text: 'Revenue grew in every region.'}]},
};

const browser = await chromium.launch({channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined});
const errors = [], unexpected = [];
try {
  const page = await browser.newPage({viewport: {width: 1300, height: 760}});
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route(/^https?:/, async route => {
    const url = route.request().url();
    if (url === `${ORIGIN}/`) return route.fulfill({status: 200, contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><main></main>'});
    const eagerMatch = /^https:\/\/app\.test\/eager\/(\d+)\.ttf$/.exec(url);
    if (eagerMatch) return route.fulfill({status: 200, contentType: 'font/ttf', body: eager[Number(eagerMatch[1])].bytes});
    if (url.startsWith(`${ORIGIN}/fonts/`)) {
      fontRequests.push(url.slice(ORIGIN.length + 1));
      try { return await route.fulfill({status: 200, contentType: 'font/ttf', body: await readFile(path.join(root, url.slice(ORIGIN.length + 1))) }); } catch { return route.fulfill({status: 404}); }
    }
    unexpected.push(url); return route.abort();
  });
  await page.goto(`${ORIGIN}/`);
  await page.addScriptTag({content: script});
  await page.evaluate(async ({eager, decks}) => {
    const {loadBrowserFontRegistry} = window.opf;
    window.decks = decks;
    window.registry = await loadBrowserFontRegistry(eager.map(face => ({url: `/eager/${face.index}.ttf`, family: face.family, weight: face.weight, italic: face.italic})), {substitutionPolicy: 'visual', lazyFontsBaseUrl: `${location.origin}/`});
  }, {eager: eager.map(({bytes, ...rest}) => rest), decks});

  const observe = async name => page.evaluate(async name => {
    const registry = window.registry, {renderSvg} = window.opf;
    const svg = renderSvg(window.decks[name], {textMeasurement: registry.textMeasurement});
    const host = document.querySelector('main'); host.innerHTML = svg;
    await document.fonts.ready;
    const family = value => value.split(',')[0].trim().replace(/^"|"$/g, '');
    const runs = [...host.querySelectorAll('text[textLength], tspan[textLength]')].map(element => {
      const owner = element.closest('text');
      const fontFamily = family(element.getAttribute('font-family') ?? owner.getAttribute('font-family'));
      return {text: element.textContent, family: fontFamily, accepted: Number(element.getAttribute('textLength')), natural: element.getComputedTextLength(), painted: [...document.fonts].some(face => face.family.replace(/^"|"$/g, '') === fontFamily && face.status === 'loaded')};
    });
    const key = face => `${face.family.replace(/^"|"$/g, '')}|${Number(face.weight ?? face.descriptors?.weight)}|${face.italic ?? face.style === 'italic'}`;
    return {
      pending: registry.pendingLazyFonts(window.decks[name]).map(face => face.file),
      registryFaces: registry.describeFaces().map(face => `${face.family}|${face.weight}|${face.italic}`).sort(),
      documentFaces: [...document.fonts].map(face => `${face.family.replace(/^"|"$/g, '')}|${Number(face.weight)}|${face.style === 'italic'}`).sort(),
      drawn: [...new Set(runs.map(run => run.family))], runs,
      resolved: registry.resolveFont({fontFamily: 'Aptos', fontWeight: 400}).resolvedFamily,
    };
  }, name);

  const before = await observe('aptos');
  assert.equal(before.pending.length, 8, 'the default Aptos scheme needs Intos and Intos Display');
  assert.deepEqual(before.drawn.filter(family => /^Intos/.test(family)), [], 'nothing paints with Intos before it is loaded');
  assert.equal(before.resolved, 'Roboto');
  assert.deepEqual(before.registryFaces, before.documentFaces, 'before loading, the registry and the document hold the same faces');
  for (const run of before.runs) { assert.ok(run.painted, `${run.family} is loaded before loading Intos`); assert.ok(Math.abs(run.natural - run.accepted) < 0.1, `before: ${run.family} ${run.natural} vs ${run.accepted}`); }
  assert.deepEqual(fontRequests, [], 'nothing vendored is fetched until it is needed');

  const roboto = await observe('roboto');
  assert.deepEqual(roboto.pending, []);
  assert.deepEqual(fontRequests, []);

  const added = await page.evaluate(async () => (await window.registry.ensureLazyFonts(window.decks.aptos)).map(face => face.file));
  assert.equal(added.length, 8);
  assert.deepEqual([...fontRequests].sort(), [...added].sort(), 'exactly the Intos and Intos Display files are fetched');
  assert.ok(added.every(file => /^fonts\/intos\/Intos(Display)?-/.test(file)));

  const after = await observe('aptos');
  assert.deepEqual(after.pending, []);
  assert.equal(after.resolved, 'Intos');
  assert.deepEqual(after.registryFaces, after.documentFaces, 'after loading, the registry and the document hold the same faces');
  assert.ok(after.drawn.includes('Intos') && after.drawn.includes('Intos Display'), `the deck is drawn in Intos, got ${after.drawn}`);
  assert.ok(after.runs.length > 0);
  for (const run of after.runs) { assert.ok(run.painted, `${run.family} is loaded`); assert.ok(Math.abs(run.natural - run.accepted) < 0.1, `after: ${run.family} advance ${run.natural} differs from accepted ${run.accepted}`); }
  const count = fontRequests.length;
  await page.evaluate(async () => window.registry.ensureLazyFonts(window.decks.aptos));
  assert.equal(fontRequests.length, count, 'a second call fetches nothing');
  await page.locator('main svg').screenshot({path: path.join(outputDirectory, 'aptos-intos.png')});
  assert.deepEqual(unexpected, [], 'no request may leave the local routes');
  assert.deepEqual(errors, []);

  let bytes = 0;
  for (const file of added) bytes += (await readFile(path.join(root, file))).length;
  await writeFile(path.join(outputDirectory, 'report.json'), JSON.stringify({node: process.version, browser: browser.version(), bundleBytes: script.length, lazyFiles: added, lazyBytes: bytes, runsBefore: before.runs.length, runsAfter: after.runs.length, drawnAfter: after.drawn, unexpected, errors}, null, 2) + '\n');
  console.log(`Lazy fonts browser: an Aptos deck fetched ${added.length} files (${bytes} bytes) on demand; registry and document hold the same faces; ${after.runs.length} runs drawn in ${after.drawn.join(', ')} within 0.1 px of the measured advances.`);
} finally { await browser.close(); }
