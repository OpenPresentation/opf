// FF-19: glyph fallback for lazy vendored faces in a real browser. The default Aptos scheme previews with Intos, a
// vendored family fetched on demand (ensureLazyFonts), and Intos has no CJK or Arabic glyphs. A page bundles the
// browser font loader and the SVG renderer, serves the eager base faces, the pinned vendored files and the pinned
// Noto script files from local routes and nothing else, and checks, for Aptos decks (and Open Sans, the other lazy
// vendored family, and a Yu Gothic deck whose scheme itself names a script font), that
//   - before the script face loads, the preview raises `missing-glyph` naming the loaded Intos face (the reported
//     "Preview unavailable") and `pendingScripts` says which package to load,
//   - after ensureLazyFonts and ensureScripts, in either order, the preview renders, Latin stays in Intos (Intos
//     Display for the heading) and Japanese, Chinese or Arabic draws with the Noto script face,
//   - every drawn run is painted by a loaded document face and its natural advance equals the registry's accepted
//     (measured) advance within 0.1 px, and the registry and the document hold the same faces.
// Offline: every other request is aborted.
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {loadFonts} from '../dist/fonts-node.js';
import {defaultCatalog} from '@openpresentation/opf/catalog';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.resolve(root, process.argv[2] ?? 'artifacts/lazy-face-fallback');
await mkdir(outputDirectory, {recursive: true});
const bundle = await build({
  stdin: {contents: "import {loadFonts as loadBrowserFonts} from './dist/fonts-browser.js';import {toSvg} from './dist/svg.js';window.opf={loadBrowserFonts,toSvg};", resolveDir: root, sourcefile: 'entry.js', loader: 'js'},
  bundle: true, platform: 'browser', format: 'iife', write: false, minify: true, metafile: true,
});
const script = bundle.outputFiles[0].text;
assert.ok(!Object.keys(bundle.metafile.inputs).some(input => /sharp|raster|resvg|fonts-node/.test(input)), 'the browser bundle must not pull in native raster or Node font modules');

const eager = ((await loadFonts({pack: 'base'})).registry).embeddedFonts.map((face, index) => ({index, family: face.family, weight: face.weight, italic: !!face.italic, bytes: Buffer.from(face.dataUrl.split(',')[1], 'base64')}));
const ORIGIN = 'https://app.test', PACK = `${ORIGIN}/pack/`;
const packRoot = path.join(root, 'node_modules/@expo-google-fonts');
const requests = {lazy: [], pack: []}, unexpected = [];

const deck = (name, {title, text = title, scheme, language}) => ({$schema: 'https://openpresentation.org/schema/opf/v1', name, ...(language ? {language} : {}), ...(scheme ? {design: {fontScheme: scheme}} : {}), slides: [{id: 'a', title, text}]});
// [name, deck, expected families drawn (subset), expected script packages]
const cases = [
  ['aptos-japanese', deck('Aptos japanese', {title: 'Q3 レビュー', text: 'Revenue grew 12% 日本語です', language: 'ja'}), ['Intos Display', 'Intos', 'Noto Sans JP'], ['noto-sans-jp']],
  ['aptos-han', deck('Aptos han', {title: '日本語', text: 'Body 日本語'}), ['Intos', 'Noto Sans SC'], ['noto-sans-sc']],
  ['aptos-arabic', deck('Aptos arabic', {title: 'مراجعة ربع سنوية', text: 'ارتفعت المبيعات by 12%', language: 'ar'}), ['Intos', 'Noto Naskh Arabic'], ['noto-sans-arabic', 'noto-naskh-arabic', 'noto-nastaliq-urdu']],
  ['aptos-greek-cyrillic', deck('Aptos greek', {title: 'Τριμηνιαία ανασκόπηση', text: 'Квартальный обзор Выручка выросла'}), ['Intos Display', 'Intos'], []],
  ['open-sans-japanese', deck('Open Sans japanese', {title: 'Q3 レビュー', text: 'Revenue grew 日本語です', scheme: 'open-sans', language: 'ja'}), ['Open Sans', 'Noto Sans JP'], ['noto-sans-jp']],
  ['yu-gothic-latin', deck('Yu Gothic latin', {title: 'Quarterly review', text: 'Revenue grew 12%', scheme: 'yu-gothic'}), ['Noto Sans JP'], ['noto-sans-jp']],
];

// FA-23: two decks name gallery font schemes; the page registers them, the way a host does (only the records the decks use).
const catalog = {source: defaultCatalog.source, fontSchemes: {'open-sans': defaultCatalog.fontSchemes['open-sans'], 'yu-gothic': defaultCatalog.fontSchemes['yu-gothic']}};

const browser = await chromium.launch({channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined});
const errors = [];
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
      requests.lazy.push(url.slice(ORIGIN.length + 1));
      try { return await route.fulfill({status: 200, contentType: 'font/ttf', body: await readFile(path.join(root, url.slice(ORIGIN.length + 1)))}); } catch { return route.fulfill({status: 404}); }
    }
    if (url.startsWith(PACK)) {
      requests.pack.push(url.slice(PACK.length));
      try { return await route.fulfill({status: 200, contentType: 'font/ttf', body: await readFile(path.join(packRoot, url.slice(PACK.length)))}); } catch { return route.fulfill({status: 404}); }
    }
    unexpected.push(url); return route.abort();
  });
  await page.goto(`${ORIGIN}/`);
  await page.addScriptTag({content: script});
  await page.evaluate(catalog => { window.catalogs = [catalog]; }, catalog);

  const run = async (name, document) => {
    const before = {lazy: requests.lazy.length, pack: requests.pack.length};
    const result = await page.evaluate(async ({document, eager, origin}) => {
      const {loadBrowserFonts, toSvg} = window.opf;
      const registry = (await loadBrowserFonts({faces: eager.map(face => ({url: `/eager/${face.index}.ttf`, family: face.family, weight: face.weight, italic: face.italic})), substitutionPolicy: 'visual', lazyFontsBaseUrl: `${origin}/`, scriptBaseUrl: `${origin}/pack/`, renderOptions: {catalogs: window.catalogs}})).registry;
      const draw = () => { const svg = toSvg(document, 1, { fonts: {textMeasurement: registry.textMeasurement}, catalogs: window.catalogs}); window.document.querySelector('main').innerHTML = svg; return svg; };
      // The registry as a host has it after loading only the vendored faces: the script face is still pending.
      await registry.ensureLazyFonts(document);
      const pendingScripts = registry.pendingScripts(document).map(item => item.replace('@expo-google-fonts/', ''));
      let unloaded = null;
      try { draw(); } catch (error) { unloaded = {code: error.code, message: error.message, details: error.details}; }
      await registry.ensureScripts(document);
      const pendingAfter = registry.pendingScripts(document), lazyAfter = registry.pendingLazyFonts(document).length;
      const svg = draw();
      await window.document.fonts.ready;
      const family = value => value.split(',')[0].trim().replace(/^"|"$/g, '');
      const host = window.document.querySelector('main');
      const runs = [...host.querySelectorAll('text[textLength], tspan[textLength]')].map(element => {
        const owner = element.closest('text');
        const fontFamily = family(element.getAttribute('font-family') ?? owner.getAttribute('font-family'));
        return {text: element.textContent, family: fontFamily, accepted: Number(element.getAttribute('textLength')), natural: element.getComputedTextLength(), painted: [...window.document.fonts].some(face => face.family.replace(/^"|"$/g, '') === fontFamily && face.status === 'loaded')};
      });
      const registryFaces = registry.describeFaces().map(face => `${face.family}|${face.weight}|${face.italic}`).sort();
      const documentFaces = [...window.document.fonts].map(face => `${face.family.replace(/^"|"$/g, '')}|${Number(face.weight)}|${face.style === 'italic'}`).sort();
      const packages = registry.loadedScriptPackages.map(item => item.replace('@expo-google-fonts/', ''));
      registry.dispose();
      return {unloaded, pendingScripts, pendingAfter, lazyAfter, runs, drawn: [...new Set(runs.map(item => item.family))], registryFaces, documentFaces, packages, bytes: svg.length};
    }, {document, eager: eager.map(({bytes, ...rest}) => rest), origin: ORIGIN});
    result.fetched = {lazy: requests.lazy.length - before.lazy, pack: requests.pack.length - before.pack};
    return result;
  };

  const report = {};
  for (const [name, document, expectedFamilies, expectedPackages] of cases) {
    const result = await run(name, document);
    const scriptScheme = name === 'yu-gothic-latin';
    report[name] = {drawn: result.drawn, packages: result.packages, runs: result.runs.length, fetched: result.fetched};
    // Before the script face loads, only the script-less cases render; the rest raise the reported error.
    if (expectedPackages.length) {
      assert.ok(result.unloaded, `${name}: the preview cannot draw the text before its script face loads`);
      // A scheme that names a script font has no face at all before it loads; the other decks have a primary face that lacks the glyphs.
      assert.equal(result.unloaded.code, scriptScheme ? 'font-unavailable' : 'missing-glyph', `${name}: ${result.unloaded.message}`);
      if (name.startsWith('aptos')) assert.match(result.unloaded.message, /Font 'Intos( Display)?' cannot display U\+[0-9A-F]+\./, `${name}: the lazy vendored primary is named`);
      if (!scriptScheme) assert.match(result.unloaded.message, /fonts\.ensure/, `${name}: the error says what to load`);
      assert.ok(result.pendingScripts.length > 0, `${name}: pendingScripts names the package to load`);
      assert.deepEqual([...result.pendingScripts].sort(), [...expectedPackages].sort(), `${name}: pendingScripts`);
    } else {
      assert.equal(result.unloaded, null, `${name}: Intos covers the text once it is loaded: ${result.unloaded?.message}`);
      assert.deepEqual(result.pendingScripts, [], `${name}: nothing pending`);
    }
    assert.deepEqual([...result.packages].sort(), [...expectedPackages].sort(), `${name}: loaded script packages`);
    assert.deepEqual(result.pendingAfter, [], `${name}: nothing pending after ensureScripts`);
    assert.equal(result.lazyAfter, 0, `${name}: no vendored face pending`);
    for (const family of expectedFamilies) assert.ok(result.drawn.includes(family), `${name}: drawn in ${family}, got ${result.drawn}`);
    assert.ok(result.runs.length > 0, name);
    for (const item of result.runs) {
      assert.ok(item.painted, `${name}: ${item.family} is loaded for ${JSON.stringify(item.text)}`);
      assert.ok(Math.abs(item.natural - item.accepted) < 0.1, `${name}: ${item.family} advance ${item.natural} differs from accepted ${item.accepted} for ${JSON.stringify(item.text)}`);
    }
    assert.deepEqual(result.registryFaces, result.documentFaces, `${name}: the registry and the document hold the same faces`);
  }
  // Loading the script face before the vendored one (an editor that detects scripts first) reaches the same preview.
  const swapped = await page.evaluate(async ({document, eager, origin}) => {
    const {loadBrowserFonts, toSvg} = window.opf;
    const registry = (await loadBrowserFonts({faces: eager.map(face => ({url: `/eager/${face.index}.ttf`, family: face.family, weight: face.weight, italic: face.italic})), substitutionPolicy: 'visual', lazyFontsBaseUrl: `${origin}/`, scriptBaseUrl: `${origin}/pack/`, renderOptions: {catalogs: window.catalogs}})).registry;
    await registry.ensureScripts(document);
    await registry.ensureLazyFonts(document);
    const svg = toSvg(document, 1, { fonts: {textMeasurement: registry.textMeasurement}, catalogs: window.catalogs});
    const drawn = [...new Set([...svg.matchAll(/font-family="([^",]*)/g)].map(match => match[1]))];
    registry.dispose();
    return drawn;
  }, {document: cases[0][1], eager: eager.map(({bytes, ...rest}) => rest), origin: ORIGIN});
  assert.deepEqual(swapped.sort(), ['Intos', 'Intos Display', 'Noto Sans JP'], 'scripts first, vendored faces second');
  await page.evaluate(async ({document, eager, origin}) => {
    const {loadBrowserFonts, toSvg} = window.opf;
    const registry = (await loadBrowserFonts({faces: eager.map(face => ({url: `/eager/${face.index}.ttf`, family: face.family, weight: face.weight, italic: face.italic})), substitutionPolicy: 'visual', lazyFontsBaseUrl: `${origin}/`, scriptBaseUrl: `${origin}/pack/`, renderOptions: {catalogs: window.catalogs}, scripts: 'auto', presentation: document})).registry;
    await registry.ensureLazyFonts(document);
    window.document.querySelector('main').innerHTML = toSvg(document, 1, { fonts: {textMeasurement: registry.textMeasurement}, catalogs: window.catalogs});
    await window.document.fonts.ready;
  }, {document: cases[0][1], eager: eager.map(({bytes, ...rest}) => rest), origin: ORIGIN});
  await page.locator('main svg').screenshot({path: path.join(outputDirectory, 'aptos-japanese.png')});

  assert.deepEqual(unexpected, [], 'no request may leave the local routes');
  assert.deepEqual(errors, []);
  await writeFile(path.join(outputDirectory, 'report.json'), JSON.stringify({node: process.version, browser: browser.version(), bundleBytes: script.length, cases: report, unexpected}, null, 2) + '\n');
  console.log(`Lazy face fallback browser: ${cases.length} decks (Aptos with Japanese, Han, Arabic, Greek and Cyrillic; Open Sans with Japanese; Yu Gothic Latin) raise missing-glyph until their script face loads, then draw Latin in the vendored face and the rest in Noto within 0.1 px of the measured advances.`);
} finally { await browser.close(); }
