// FF-31: the vendored faces (Intos and the open families) are the registry's lazy set. This test covers the model
// (which faces are lazy, why they stay out of the eager getter), registry.addFaces, the browser loader with a fake
// document and fetch, and that loading exactly what a document needs resolves every font scheme as Node does with
// every vendored face loaded (metric/visual tier and family), so a browser never measures with a face it does not paint.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {fontSchemes} from '@openpresentation/opf';
import {BUNDLED_FONT_MANIFEST, loadBundledFontRegistry, prepareNodeFonts} from '../dist/fonts-node.js';
import {createFontRegistry} from '../dist/fonts.js';
import {loadBrowserFontRegistry, lazyFontEntries, lazyFontList, lazyFontsFor, presentationFamilies} from '../dist/fonts-browser.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const decode = face => new Uint8Array(Buffer.from(face.dataUrl.split(',')[1], 'base64'));

// ---- the lazy set ----
const {registry: office, options} = await prepareNodeFonts({pack: 'office', substitutionPolicy: 'visual'});
const vendored = BUNDLED_FONT_MANIFEST.packages.filter(pkg => pkg.vendored && (pkg.pack === 'open' || pkg.embed === 'used'));
const lazyCount = vendored.reduce((sum, pkg) => sum + pkg.faces.length, 0);
assert.ok(vendored.some(pkg => pkg.name === 'intos'));
assert.equal(office.lazyFonts.length, lazyCount, 'the office registry lists every vendored face');
assert.equal(office.embeddedFonts.length, 33, 'the eager list is the npm office and base faces only');
assert.ok(!office.embeddedFonts.some(face => /^Intos/.test(face.family)));
const usedFaces = options.embeddedFonts.filter(face => face.embed === 'used');
assert.equal(usedFaces.filter(face => face.family !== 'Noto Sans').length, lazyCount, 'options.embeddedFonts carries the vendored faces, flagged used');
assert.equal(usedFaces.length, lazyCount + 4, 'plus the four Noto Sans glyph-fallback faces (opf-render#57), which are npm files, not lazy');
assert.equal(office.lazyFonts.filter(face => /^Intos/.test(face.family)).length, 16);
for (const face of office.lazyFonts) {
  assert.ok(!path.isAbsolute(face.file) && !face.file.split('/').includes('..') && face.file.startsWith('fonts/'), face.file);
  assert.equal(hash(await readFile(path.join(root, face.file))), face.sha256, `${face.file} is the pinned file`);
}
assert.deepEqual(lazyFontList().map(face => face.file), office.lazyFonts.map(face => face.file));
assert.equal((await loadBundledFontRegistry()).lazyFonts.length, 0, 'the base pack has no vendored faces');
const entries = lazyFontEntries({baseUrl: 'https://cdn.example/app'});
assert.equal(entries[0].url, `https://cdn.example/app/${office.lazyFonts[0].file}`);
assert.throws(() => lazyFontEntries({}), {code: 'invalid-font-source'});

// ---- registry.addFaces is all or nothing ----
const intosRegular = await readFile(path.join(root, 'fonts/intos/Intos-Regular.ttf'));
const eager = office.embeddedFonts.map(face => ({family: face.family, weight: face.weight, italic: face.italic, data: decode(face)}));
const grown = createFontRegistry(eager, {substitutionPolicy: 'metric'});
const before = grown.describeFaces().length;
assert.equal(grown.addFaces([{data: new Uint8Array(intosRegular), family: 'Intos', weight: 400, italic: false, embed: 'used'}]).length, 1);
assert.equal(grown.describeFaces().length, before + 1);
assert.equal(grown.resolveFont({fontFamily: 'Aptos', fontWeight: 400}).resolvedFamily, 'Intos', 'later resolutions see the new face');
assert.throws(() => grown.addFaces([{data: new Uint8Array(intosRegular), family: 'Intos', weight: 400, italic: false}]), {code: 'duplicate-font-face'});
const intosBold = new Uint8Array(await readFile(path.join(root, 'fonts/intos/Intos-Bold.ttf')));
assert.throws(() => grown.addFaces([{data: intosBold, family: 'Intos', weight: 700}, {data: new Uint8Array([1, 2, 3])}]), {code: 'invalid-font-data'});
assert.equal(grown.describeFaces().length, before + 1, 'a failed batch adds nothing, not even its valid faces');
assert.equal(grown.resolveFont({fontFamily: 'Intos', fontWeight: 700}).resolvedWeight, 400, 'the valid face of the failed batch is not resolvable');
assert.deepEqual(grown.addFaces([]), [], 'an empty batch is a no-op');

// ---- which faces a document needs ----
const deckWith = scheme => ({name: `Lazy ${scheme ?? 'default'}`, ...(scheme ? {design: {fontScheme: scheme}} : {}), slides: [{id: 'a', title: 'Quarterly review', text: 'Revenue grew.'}]});
const held = registry => family => registry.describeFaces().some(face => face.family.toLowerCase() === family.toLowerCase());
const needFor = (registryNow, deck) => lazyFontsFor(presentationFamilies(deck), {lazy: office.lazyFonts, hasFamily: held(registryNow)});
const eagerOnly = () => createFontRegistry(eager, {substitutionPolicy: 'visual'});
const aptosNeeds = needFor(eagerOnly(), deckWith());
assert.deepEqual([...new Set(aptosNeeds.map(face => face.family))].sort(), ['Intos', 'Intos Display'], 'the default (Aptos) scheme needs Intos and Intos Display');
assert.equal(aptosNeeds.length, 8);
assert.deepEqual(needFor(eagerOnly(), deckWith('roboto')), [], 'a Roboto deck needs nothing');
assert.deepEqual(needFor(eagerOnly(), deckWith('calibri')), [], 'Calibri resolves to the eager Carlito');
assert.throws(() => needFor(eagerOnly(), {name: 'invalid', slides: 'not slides'}), {code: 'invalid-opf'}, 'a document that does not resolve throws what renderSvg throws (FF-41: it is no longer reported as needing nothing)');
assert.ok(needFor(eagerOnly(), deckWith('open-sans')).every(face => face.family === 'Open Sans'));

// Nothing is downloaded for a family the substitution policy would not resolve.
const forPolicy = (policy, families, aliases) => lazyFontsFor(families, {lazy: office.lazyFonts, hasFamily: held(eagerOnly()), policy, aliases}).map(face => face.family);
assert.deepEqual([...new Set(forPolicy('none', ['Aptos', 'Aptos Display', 'Segoe UI', 'Montserrat']))].sort(), ['Montserrat'], 'policy none: only a family requested by its own name');
assert.deepEqual([...new Set(forPolicy('metric', ['Aptos', 'Segoe UI']))].sort(), ['Intos'], 'policy metric: the metric replacement, not the visual alternates');
assert.deepEqual([...new Set(forPolicy('visual', ['Segoe UI']))], ['Red Hat Display'], 'policy visual: the declared visual replacement');
assert.deepEqual(forPolicy('metric', ['Segoe UI']), [], 'policy metric: a visual replacement is not used');
assert.deepEqual(forPolicy('none', ['Source Sans Pro'], new Map([['source sans pro', 'Source Sans 3']])).every(family => family === 'Source Sans 3'), true, 'an alias the host passes resolves under any policy');
assert.deepEqual(forPolicy('none', ['Source Sans Pro']), [], 'without the alias there is nothing to load');

// Loading exactly what a document needs resolves like Node with every vendored face loaded.
const lc = value => value.toLowerCase();
let compared = 0;
for (const scheme of fontSchemes) {
  const deck = deckWith(scheme.id), partial = eagerOnly();
  const need = needFor(partial, deck);
  if (need.length) partial.addFaces(await Promise.all(need.map(async face => ({family: face.family, weight: face.weight, italic: face.italic, embed: 'used', data: new Uint8Array(await readFile(path.join(root, face.file)))}))));
  for (const family of presentationFamilies(deck)) for (const [fontWeight, italic] of [[400, false], [700, false], [400, true]]) {
    const expected = (() => { try { return office.resolveFont({fontFamily: family, fontWeight, italic}); } catch (error) { return {error: error.code}; } })();
    if (expected.resolvedFamily === 'Noto Sans') continue; // the glyph-fallback face (opf-render#57) loads through the script loader, not the eager list or the lazy set
    const actual = (() => { try { return partial.resolveFont({fontFamily: family, fontWeight, italic}); } catch (error) { return {error: error.code}; } })();
    assert.deepEqual([actual.error, actual.resolvedFamily && lc(actual.resolvedFamily), actual.compatibility], [expected.error, expected.resolvedFamily && lc(expected.resolvedFamily), expected.compatibility], `${scheme.id}: ${family} ${fontWeight}${italic ? 'i' : ''} resolves as in Node`);
    compared++;
  }
}
assert.ok(compared > 300, `compared ${compared} resolutions across the font-scheme catalog`);

// ---- browser loader with a fake document and fetch ----
class Face { constructor(family, bytes, descriptors) { Object.assign(this, {family, bytes, descriptors}); } async load() { return this; } }
const fonts = new Set(); fonts.ready = Promise.resolve();
const document = {fonts, defaultView: {FontFace: Face}};
const served = [], corrupt = new Set();
const fetchLazy = async (url) => {
  served.push(url);
  const file = url.replace('https://fonts.example/', '');
  if (!office.lazyFonts.some(face => face.file === file)) return {ok: false, status: 404};
  const bytes = Buffer.from(await readFile(path.join(root, file)));
  if (corrupt.has(file)) bytes[bytes.length - 1] ^= 1;
  return {ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)};
};
const browser = await loadBrowserFontRegistry(eager.map(face => ({...face})), {document, fetch: fetchLazy, substitutionPolicy: 'visual', lazyFontsBaseUrl: 'https://fonts.example/'});
const eagerFaces = fonts.size;
assert.equal(browser.lazyFonts.length, lazyCount);
const aptosDeck = deckWith();
assert.equal(browser.pendingLazyFonts(aptosDeck).length, 2, 'FF-41: the title (Intos Display 700) and the text (Intos 400), not the eight Intos faces of the two families');
const none = await loadBrowserFontRegistry(eager.map(face => ({...face})), {document, fetch: fetchLazy, lazyFontsBaseUrl: 'https://fonts.example/'});
assert.deepEqual(none.pendingLazyFonts(aptosDeck), [], 'the default policy (none) would not resolve Aptos, so Intos is not downloaded');
served.length = 0;
assert.deepEqual(await none.ensureLazyFonts(aptosDeck), []);
assert.equal(served.length, 0);
none.dispose();
assert.equal(browser.resolveFont({fontFamily: 'Aptos', fontWeight: 400}).resolvedFamily, 'Roboto', 'before loading, Aptos previews with its visual alternate, in measurement and painting alike');
// A failed hash leaves the document and registry untouched and can be retried.
corrupt.add('fonts/intos/IntosDisplay-Bold.ttf');
await assert.rejects(browser.ensureLazyFonts(aptosDeck), {code: 'font-integrity-mismatch'});
assert.equal(fonts.size, eagerFaces);
assert.equal(browser.describeFaces().some(face => /^Intos/.test(face.family)), false);
assert.equal(browser.pendingLazyFonts(aptosDeck).length, 2);
corrupt.clear();
served.length = 0;
const added = await browser.ensureLazyFonts(aptosDeck);
assert.equal(added.length, 2);
assert.equal(served.length, 2);
assert.equal(fonts.size, eagerFaces + 2, 'the document gained exactly the registry faces');
for (const face of browser.describeFaces().filter(face => /^Intos/.test(face.family))) assert.ok([...fonts].some(item => item.family === face.family && item.descriptors.weight === String(face.weight) && item.descriptors.style === (face.italic ? 'italic' : 'normal')), `${face.family} is registered with the document`);
assert.equal(browser.resolveFont({fontFamily: 'Aptos', fontWeight: 400}).resolvedFamily, 'Intos');
assert.equal(browser.resolveFont({fontFamily: 'Aptos Display', fontWeight: 700}).resolvedFamily, 'Intos Display');
const nodeMeasure = office.textMeasurement.measure('Quarterly review', 40, {fontFamily: 'Aptos', fontWeight: 400});
assert.equal(browser.textMeasurement.measure('Quarterly review', 40, {fontFamily: 'Aptos', fontWeight: 400}), nodeMeasure, 'the browser registry measures as Node does');
served.length = 0;
assert.deepEqual(await browser.ensureLazyFonts(aptosDeck), [], 'nothing is fetched twice');
assert.equal(served.length, 0);
// Options: the base URL is required, an aborted call fetches nothing, a disposed registry rejects.
const noBase = await loadBrowserFontRegistry(eager.map(face => ({...face})), {document, fetch: fetchLazy, substitutionPolicy: 'visual'});
await assert.rejects(noBase.ensureLazyFonts(aptosDeck), {code: 'invalid-font-source'});
noBase.dispose();
const controller = new AbortController(); controller.abort();
served.length = 0;
const second = await loadBrowserFontRegistry(eager.map(face => ({...face})), {document, fetch: fetchLazy, substitutionPolicy: 'visual', lazyFontsBaseUrl: 'https://fonts.example/'});
await assert.rejects(second.ensureLazyFonts(aptosDeck, {signal: controller.signal}));
assert.equal(served.length, 0);
second.dispose();
browser.dispose();
assert.equal(fonts.size, 0, 'dispose removes every face, lazy ones included');
await assert.rejects(browser.ensureLazyFonts(aptosDeck), {code: 'font-registry-disposed'});

const sizes = await Promise.all(aptosNeeds.map(async face => (await readFile(path.join(root, face.file))).length));
console.log(JSON.stringify({test: 'lazy-fonts', lazyFaces: lazyCount, eagerFaces: office.embeddedFonts.length, resolutionsCompared: compared, aptosDeckFiles: aptosNeeds.length, aptosDeckBytes: sizes.reduce((a, b) => a + b, 0)}));
