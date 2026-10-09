// RR-17 (FF-41, FF-43): every Latin family has its own fixture in the browser host. A page bundles the browser font loader and the
// SVG renderer, starts from the 33 eager office and base faces (the registry a browser host or the gallery editor starts with), and
// serves the pinned vendored files from local routes and nothing else. For every family the policy names (the same list as the Node
// fixture) it checks, with a deck that draws the family as heading and body in all four styles:
//   - pendingLazyFonts names exactly the vendored route faces the deck draws that are not loaded yet (face level: no whole families),
//   - ensureLazyFonts fetches exactly those files, hash-verified, and nothing else leaves the local routes,
//   - every style resolves to the route family and the face the fixture model says (no fallback to Roboto),
//   - the document holds the faces the registry holds, a loaded FontFace exists for every drawn run, and every run's natural advance in
//     the browser equals the registry's accepted (measured) advance within 0.1 px.
// It writes artifacts/latin-family-hosts/browser.json (per family: files fetched, bytes, runs) and one screenshot per family.
// Offline: every other request is aborted.
import assert from 'node:assert/strict';
import {mkdir, readFile, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {loadFonts} from '../dist/fonts-node.js';
import {STYLES, expectedFace, familyDeck, label, latinFamilies, neededFaces} from './latin-family-fixture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.resolve(root, process.argv[2] ?? 'artifacts/latin-family-hosts');
await mkdir(outputDirectory, {recursive: true});
const bundle = await build({
  stdin: {contents: "import {loadFonts as loadBrowserFonts} from './dist/fonts-browser.js';import {toSvg} from './dist/svg.js';window.opf={loadBrowserFonts,toSvg};", resolveDir: root, sourcefile: 'entry.js', loader: 'js'},
  bundle: true, platform: 'browser', format: 'iife', write: false, minify: true,
});
const script = bundle.outputFiles[0].text;
const eager = (await loadFonts({pack: 'office'})).registry.embeddedFonts.map((face, index) => ({index, family: face.family, weight: face.weight, italic: !!face.italic, bytes: Buffer.from(face.dataUrl.split(',')[1], 'base64')}));
assert.equal(eager.length, 33, 'the eager list is the 33 office and base faces');
const ORIGIN = 'https://app.test';
const fontRequests = [];
const families = latinFamilies().map(entry => ({
  family: entry.family, route: entry.route, deck: familyDeck(entry.family),
  styles: STYLES.map(([weight, italic]) => { const found = expectedFace(entry, weight, italic); return {weight, italic, label: label(weight, italic), face: {family: entry.route, weight: found.face.weight, italic: found.face.italic}, styleGap: found.styleGap}; }),
  files: neededFaces(entry).filter(found => found.lazy).map(found => found.file),
}));

const browser = await chromium.launch({channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined});
const errors = [], unexpected = [];
const report = [];
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
      try { return await route.fulfill({status: 200, contentType: 'font/ttf', body: await readFile(path.join(root, url.slice(ORIGIN.length + 1)))}); } catch { return route.fulfill({status: 404}); }
    }
    unexpected.push(url); return route.abort();
  });
  await page.goto(`${ORIGIN}/`);
  await page.addScriptTag({content: script});
  await page.evaluate(async ({eager}) => {
    window.registry = (await window.opf.loadBrowserFonts({faces: eager.map(face => ({url: `/eager/${face.index}.ttf`, family: face.family, weight: face.weight, italic: face.italic})), substitutionPolicy: 'visual', fallbackFamily: 'Roboto', lazyFontsBaseUrl: `${location.origin}/`})).registry;
  }, {eager: eager.map(({bytes, ...rest}) => rest)});

  const loaded = new Set();
  for (const entry of families) {
    const where = entry.family;
    const expectedPending = entry.files.filter(file => !loaded.has(file)).sort();
    const pending = (await page.evaluate(deck => window.registry.pendingLazyFonts(deck).map(face => face.file), entry.deck)).sort();
    assert.deepEqual(pending, expectedPending, `${where}: pending files are exactly the vendored faces the deck draws`);
    const before = fontRequests.length;
    const ensured = (await page.evaluate(async deck => (await window.registry.ensureLazyFonts(deck)).map(face => face.file), entry.deck)).sort();
    assert.deepEqual(ensured, expectedPending, `${where}: ensureLazyFonts loads those files`);
    assert.deepEqual(fontRequests.slice(before).sort(), expectedPending, `${where}: exactly those files are fetched`);
    for (const file of ensured) loaded.add(file);
    const observed = await page.evaluate(async ({deck, styles, family}) => {
      const registry = window.registry, {toSvg} = window.opf;
      const resolved = styles.map(style => { const r = registry.resolveFont({fontFamily: family, fontWeight: style.weight, italic: style.italic}); return {label: style.label, family: r.resolvedFamily, weight: r.resolvedWeight, italic: r.italic, compatibility: r.compatibility}; });
      const host = document.querySelector('main');
      host.innerHTML = toSvg(deck, 1, { fonts: {textMeasurement: registry.textMeasurement}});
      await document.fonts.ready;
      const clean = value => value.split(',')[0].trim().replace(/^["']|["']$/g, '');
      const faces = [...document.fonts].map(face => ({family: clean(face.family), weight: Number(face.weight), style: face.style, status: face.status}));
      const runs = [...host.querySelectorAll('text[textLength], tspan[textLength]')].filter(element => element.textContent.trim()).map(element => {
        const owner = element.closest('text'), get = name => element.getAttribute(name) ?? owner.getAttribute(name);
        const runFamily = clean(get('font-family')), weight = Number(get('font-weight') ?? 400), italic = get('font-style') === 'italic';
        return {text: element.textContent, family: runFamily, weight, italic, accepted: Number(element.getAttribute('textLength')), natural: element.getComputedTextLength(), faceLoaded: faces.some(face => face.family === runFamily && face.weight === weight && face.status === 'loaded')};
      });
      return {resolved, runs, registryFaces: registry.describeFaces().map(face => `${face.family}|${face.weight}|${face.italic}`).sort(), documentFaces: faces.map(face => `${face.family}|${face.weight}|${face.style === 'italic'}`).sort(), pendingAfter: registry.pendingLazyFonts(deck).map(face => face.file)};
    }, {deck: entry.deck, styles: entry.styles, family: entry.family});
    assert.deepEqual(observed.pendingAfter, [], `${where}: nothing is pending after loading`);
    assert.deepEqual(observed.registryFaces, observed.documentFaces, `${where}: the registry and the document hold the same faces`);
    for (const [index, style] of entry.styles.entries()) {
      const got = observed.resolved[index];
      assert.equal(got.family, entry.route, `${where} ${style.label}: draws ${entry.route}`);
      assert.deepEqual([got.weight, got.italic], [style.face.weight, style.face.italic], `${where} ${style.label}: the face the style resolves to`);
    }
    assert.ok(observed.runs.length >= 4, `${where}: the deck draws its runs`);
    for (const run of observed.runs) {
      assert.equal(run.family, entry.route, `${where}: "${run.text}" is drawn in ${entry.route}`);
      assert.ok(run.faceLoaded, `${where}: a loaded FontFace backs "${run.text}" (${run.family} ${run.weight})`);
      assert.ok(Math.abs(run.natural - run.accepted) < 0.1, `${where}: "${run.text}" advance ${run.natural} differs from accepted ${run.accepted}`);
    }
    const bytes = (await Promise.all(entry.files.map(async file => (await stat(path.join(root, file))).size))).reduce((a, b) => a + b, 0);
    report.push({family: entry.family, route: entry.route, files: entry.files, lazyBytes: bytes, fetchedNow: ensured.length, runs: observed.runs.length, gaps: entry.styles.filter(style => style.styleGap).map(style => style.label)});
    if (process.env.LATIN_SCREENSHOTS) await page.locator('main svg').screenshot({path: path.join(outputDirectory, `${entry.family.replace(/[^A-Za-z0-9]+/g, '-')}.png`)});
  }
  assert.deepEqual(unexpected, [], 'no request may leave the local routes');
  assert.deepEqual(errors, []);
  const total = new Set(fontRequests);
  assert.equal(total.size, fontRequests.length, 'no file is fetched twice');
  const bytes = (await Promise.all([...total].map(async file => (await stat(path.join(root, file))).size))).reduce((a, b) => a + b, 0);
  await writeFile(path.join(outputDirectory, 'browser.json'), `${JSON.stringify({node: process.version, browser: browser.version(), bundleBytes: script.length, families: report.length, filesFetchedInTotal: total.size, bytesFetchedInTotal: bytes, report}, null, 1)}\n`);
  console.log(`Latin family hosts (browser): ${report.length} families; the registry fetched ${total.size} vendored files (${(bytes / 1048576).toFixed(1)} MiB) on demand, each exactly when a family needed it; every run drawn in its route face within 0.1 px of the measured advance.`);
} finally { await browser.close(); }
