// FF-31: vendored faces (Intos for the default Aptos scheme) load lazily in a real browser, and measurement and painting
// never disagree. A page bundles the browser font loader and the SVG renderer, serves the eager base faces and the
// pinned vendored files from local routes and nothing else, and checks, for an Aptos deck, that
//   - before loading, the registry and the document both hold only Roboto for Aptos (the visual alternate),
//   - ensureLazyFonts fetches exactly the faces the deck draws, Intos Display 700 and Intos 400 (FF-41: two files, about
//     1.5 MB, not the eight files of the two families), hash-verified, and an edit adding an italic run fetches just Intos Italic,
//   - a layout that only the host's catalogs know resolves through the loader's renderOptions (FF-41),
//   - afterwards the registry and the document hold the same faces, the drawn family is Intos, and every drawn run's
//     natural advance equals the registry's accepted (measured) advance within 0.1 px.
// Offline: every other request is aborted.
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {defaultCatalog} from '@openpresentation/opf/catalog';
import {BUNDLED_FONT_MANIFEST, loadFonts} from '../dist/fonts-node.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.resolve(root, process.argv[2] ?? 'artifacts/lazy-fonts');
await mkdir(outputDirectory, {recursive: true});
const bundle = await build({
  stdin: {contents: "import {loadFonts as loadBrowserFonts} from './dist/fonts-browser.js';import {toSvg} from './dist/svg.js';window.opf={loadBrowserFonts,toSvg};", resolveDir: root, sourcefile: 'entry.js', loader: 'js'},
  bundle: true, platform: 'browser', format: 'iife', write: false, minify: true, metafile: true,
});
const script = bundle.outputFiles[0].text;
assert.ok(!Object.keys(bundle.metafile.inputs).some(input => /sharp|raster|resvg|fonts-node/.test(input)), 'the browser bundle must not pull in native raster or Node font modules');

const eager = ((await loadFonts({pack: 'base'})).registry).embeddedFonts.map((face, index) => ({index, family: face.family, weight: face.weight, italic: !!face.italic, bytes: Buffer.from(face.dataUrl.split(',')[1], 'base64')}));
const ORIGIN = 'https://app.test';
const fontRequests = [];
// FF-43: the open replacement families that policy rows route to. Each pair is a font scheme (heading, body); the browser loads the
// replacement family's whole vendored family on demand, from hash-pinned files, and paints exactly what it measured.
const REPLACEMENT_PAIRS = [
  {name: 'segoe-franklin', major: 'Segoe UI Semibold', minor: 'Franklin Gothic Book', families: ['Red Hat Display', 'Barlow']},
  {name: 'trebuchet-century', major: 'Trebuchet MS', minor: 'Century Gothic', families: ['Figtree', 'Work Sans']},
  {name: 'garamond-narrow', major: 'Garamond', minor: 'Arial Narrow', families: ['EB Garamond', 'Archivo Narrow']},
  {name: 'bookman-impact', major: 'Bookman Old Style', minor: 'Impact', families: ['Libre Caslon Text', 'Anton']},
  {name: 'rockwell-tahoma', major: 'Rockwell', minor: 'Tahoma', families: ['Bitter', 'Red Hat Text']},
];
// FF-41: the face a family draws at a weight (upright), the nearest one, ties to the lighter, as the registry picks it.
const nearestFile = (family, weight) => vendoredFaces(family).filter(face => !face.italic).sort((a, b) => Math.abs(a.weight - weight) - Math.abs(b.weight - weight) || a.weight - b.weight)[0].file;
const vendoredFaces = family => BUNDLED_FONT_MANIFEST.packages.filter(pkg => pkg.vendored).flatMap(pkg => pkg.faces.filter(face => face.family === family).map(face => ({file: `${pkg.vendored}/${face.file}`, weight: face.weight, italic: face.italic})));
const pairDeck = pair => ({
  design: {fontScheme: pair.name},
  catalogs: {custom: {fontSchemes: {[pair.name]: {name: pair.name, app: 'powerpoint', languageFamily: 'latin', languages: [], major: pair.major, minor: pair.minor, textSample: 'x', type: 'sans-serif'}}}},
  name: pair.name,
  slides: [{id: 'a', title: 'Quarterly operating review', text: 'Revenue grew in every region, led by the enterprise segment.'}],
});
const decks = {
  ...Object.fromEntries(REPLACEMENT_PAIRS.map(pair => [pair.name, pairDeck(pair)])),
  aptos: {name: 'Aptos deck', slides: [{id: 'a', title: 'Quarterly operating review', text: 'Revenue grew in every region, led by the enterprise segment.'}]},
  aptosItalic: {name: 'Aptos italic deck', slides: [{id: 'a', title: 'Quarterly operating review', text: ['Revenue grew in ', {text: 'every', italic: true}, ' region, led by the enterprise segment.']}]},
  hostLayout: {name: 'Host layout deck', slides: [{id: 'a', layout: 'host-bullets', title: 'Quarterly operating review', items: ['Revenue grew in every region.']}]},
  roboto: {name: 'Roboto deck', design: {fontScheme: 'roboto'}, slides: [{id: 'a', title: 'Quarterly operating review', text: 'Revenue grew in every region.'}]},
};

// FA-23: the host registers one catalog (core Catalog), the default for bare ids: a layout only it has, and the font scheme the Roboto deck names.
const hostCatalogs = [{source: 'https://host.test/opf', layouts: {'host-bullets': {...defaultCatalog.layouts['list-1x'], name: 'Host bullets'}}, fontSchemes: {roboto: defaultCatalog.fontSchemes.roboto}}];
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
  await page.evaluate(async ({eager, decks, catalogs}) => {
    const {loadBrowserFonts} = window.opf;
    window.decks = decks;
    // The host's catalogs (a layout id the bundled catalogs do not have) reach the loader as its default render options.
    window.registry = (await loadBrowserFonts({faces: eager.map(face => ({url: `/eager/${face.index}.ttf`, family: face.family, weight: face.weight, italic: face.italic})), substitutionPolicy: 'visual', lazyFontsBaseUrl: `${location.origin}/`, renderOptions: {catalogs}})).registry;
    window.catalogs = catalogs;
  }, {eager: eager.map(({bytes, ...rest}) => rest), decks, catalogs: hostCatalogs});

  const observe = async name => page.evaluate(async name => {
    const registry = window.registry, {toSvg} = window.opf;
    const svg = toSvg(window.decks[name], 1, { fonts: {textMeasurement: registry.textMeasurement}, catalogs: window.catalogs});
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
      ...(window.decks[name].catalogs ? (() => { const record = Object.values(window.decks[name].catalogs.custom.fontSchemes)[0]; return {resolvedMajor: registry.resolveFont({fontFamily: record.major, fontWeight: 400}).resolvedFamily, resolvedMinor: registry.resolveFont({fontFamily: record.minor, fontWeight: 400}).resolvedFamily}; })() : {}),
    };
  }, name);

  const before = await observe('aptos');
  assert.deepEqual([...before.pending].sort(), ['fonts/intos/Intos-Regular.ttf', 'fonts/intos/IntosDisplay-Bold.ttf'], 'the default Aptos deck draws Intos Display 700 and Intos 400, and needs those two files (FF-41), not all eight of the two families');
  assert.deepEqual(before.drawn.filter(family => /^Intos/.test(family)), [], 'nothing paints with Intos before it is loaded');
  assert.equal(before.resolved, 'Roboto');
  assert.deepEqual(before.registryFaces, before.documentFaces, 'before loading, the registry and the document hold the same faces');
  for (const run of before.runs) { assert.ok(run.painted, `${run.family} is loaded before loading Intos`); assert.ok(Math.abs(run.natural - run.accepted) < 0.1, `before: ${run.family} ${run.natural} vs ${run.accepted}`); }
  assert.deepEqual(fontRequests, [], 'nothing vendored is fetched until it is needed');

  const roboto = await observe('roboto');
  assert.deepEqual(roboto.pending, []);
  assert.deepEqual(fontRequests, []);

  const added = await page.evaluate(async () => (await window.registry.ensureLazyFonts(window.decks.aptos)).map(face => face.file));
  assert.deepEqual([...added].sort(), ['fonts/intos/Intos-Regular.ttf', 'fonts/intos/IntosDisplay-Bold.ttf']);
  assert.deepEqual([...fontRequests].sort(), [...added].sort(), 'exactly the drawn Intos Display 700 and Intos 400 files are fetched');
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
  // FF-41: an edit that adds an italic run needs one more face, and only that one is fetched.
  const italicPending = await page.evaluate(name => window.registry.pendingLazyFonts(window.decks[name]).map(face => face.file), 'aptosItalic');
  assert.deepEqual(italicPending, ['fonts/intos/Intos-Italic.ttf'], 'pendingLazyFonts reports just the new italic face');
  const beforeItalic = fontRequests.length;
  await page.evaluate(async name => window.registry.ensureLazyFonts(window.decks[name]), 'aptosItalic');
  assert.deepEqual(fontRequests.slice(beforeItalic), ['fonts/intos/Intos-Italic.ttf'], 'exactly the italic face is fetched');
  const italic = await observe('aptosItalic');
  assert.deepEqual(italic.pending, []);
  assert.deepEqual(italic.registryFaces, italic.documentFaces, 'the registry and the document hold the same faces after the edit');
  for (const run of italic.runs) { assert.ok(run.painted, `${run.family} is loaded`); assert.ok(Math.abs(run.natural - run.accepted) < 0.1, `italic: ${run.family} advance ${run.natural} differs from accepted ${run.accepted}`); }
  // FF-41: a layout id that only the host's catalogs know resolves through renderOptions; without them the slide composes with no layout and the same faces are needed.
  assert.deepEqual(await page.evaluate(name => window.registry.pendingLazyFonts(window.decks[name]).map(face => face.file), 'hostLayout'), [], 'the Intos faces the host-layout deck draws are already loaded');
  const withoutCatalogs = await page.evaluate(name => { try { return window.registry.pendingLazyFonts(window.decks[name], {catalogs: []}).map(face => face.file); } catch (error) { return error.code; } }, 'hostLayout');
  assert.deepEqual(withoutCatalogs, [], 'without the host catalogs the slide composes with no layout and nothing more is pending');
  // FF-43: each replacement pair loads exactly its vendored families' files, and the document paints what the registry measured.
  const pairReport = [];
  for (const pair of REPLACEMENT_PAIRS) {
    // Face level (FF-41): the heading family at 700 and the body family at 400, the two faces the deck draws.
    const expected = [nearestFile(pair.families[0], 700), nearestFile(pair.families[1], 400)].sort();
    // The base-only registry of this page cannot draw these families before loading (their alternates are office-pack faces), so
    // only what is pending is checked here; painting is checked once the vendored family is loaded.
    const pending = await page.evaluate(name => window.registry.pendingLazyFonts(window.decks[name]).map(face => face.file), pair.name);
    assert.deepEqual([...pending].sort(), expected, `${pair.name}: pending files are exactly the drawn faces of ${pair.families.join(' and ')}`);
    const before = fontRequests.length;
    const loaded = await page.evaluate(async name => (await window.registry.ensureLazyFonts(window.decks[name])).map(face => face.file), pair.name);
    assert.deepEqual([...loaded].sort(), expected, `${pair.name}: ensureLazyFonts loads those files`);
    assert.deepEqual(fontRequests.slice(before).sort(), expected, `${pair.name}: exactly those files are fetched`);
    const drawn = await observe(pair.name);
    assert.deepEqual(drawn.pending, [], pair.name);
    assert.deepEqual(drawn.registryFaces, drawn.documentFaces, `${pair.name}: the registry and the document hold the same faces`);
    for (const family of pair.families) assert.ok(drawn.drawn.includes(family), `${pair.name}: drawn in ${family}, got ${drawn.drawn}`);
    for (const file of expected) { const face = pair.families.flatMap(vendoredFaces).find(item => item.file === file); const family = pair.families.find(name => vendoredFaces(name).some(item => item.file === file)); assert.ok(drawn.documentFaces.includes(`${family}|${face.weight}|${face.italic}`), `${file} is a loaded document face`); }
    assert.ok(drawn.runs.length > 0);
    for (const run of drawn.runs) { assert.ok(run.painted, `${pair.name}: ${run.family} is loaded`); assert.ok(Math.abs(run.natural - run.accepted) < 0.1, `${pair.name}: ${run.family} advance ${run.natural} differs from accepted ${run.accepted}`); }
    assert.equal(drawn.resolvedMajor, pair.families[0], `${pair.name}: ${pair.major} resolves to ${pair.families[0]}`);
    assert.equal(drawn.resolvedMinor, pair.families[1], `${pair.name}: ${pair.minor} resolves to ${pair.families[1]}`);
    pairReport.push({pair: pair.name, files: loaded.length, drawn: drawn.drawn, runs: drawn.runs.length});
    await page.locator('main svg').screenshot({path: path.join(outputDirectory, `${pair.name}.png`)});
  }
  assert.deepEqual(unexpected, [], 'no request may leave the local routes');
  assert.deepEqual(errors, []);

  let bytes = 0;
  for (const file of added) bytes += (await readFile(path.join(root, file))).length;
  await writeFile(path.join(outputDirectory, 'report.json'), JSON.stringify({node: process.version, browser: browser.version(), bundleBytes: script.length, lazyFiles: added, lazyBytes: bytes, replacementPairs: pairReport, runsBefore: before.runs.length, runsAfter: after.runs.length, drawnAfter: after.drawn, unexpected, errors}, null, 2) + '\n');
  console.log(`Lazy fonts browser: an Aptos deck fetched ${added.length} files (${bytes} bytes) on demand; registry and document hold the same faces; ${after.runs.length} runs drawn in ${after.drawn.join(', ')} within 0.1 px of the measured advances. Replacement pairs: ${pairReport.map(item => `${item.pair} ${item.files} files`).join(', ')}.`);
} finally { await browser.close(); }
