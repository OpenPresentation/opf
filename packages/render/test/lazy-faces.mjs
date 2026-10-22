// FF-41: lazy fonts load faces, not whole families, and resolve documents the way the host renders them.
//   - presentationFaces lists the {family, weight, italic} a preview draws: a plain deck two faces, a rich-text italic run
//     one more, the code role only where code is drawn, per-slide overrides, furniture, tables, script slots,
//   - the list covers every face any of the 126 example decks draws (compared with what a real registry paints),
//   - loading exactly the planned faces resolves every drawn face as Node does with every vendored face loaded (metric and
//     visual policy, all example decks), and a face is never fetched for a weight or style nothing draws,
//   - the plan is incremental: after an edit adds italic or bold, pendingLazyFonts reports only the new face, and a
//     partially loaded family (or a lone Roboto Regular beside a Roboto Bold the host can serve) still loads what is missing,
//   - hosts that resolve layouts and font schemes through renderOptions.catalogs get the same answer from presentationFamilies,
//     presentationFaces, pendingLazyFonts, ensureLazyFonts, pendingScripts and ensureScripts, and a document that does not
//     resolve throws what toSvg throws (it is not reported as needing nothing).
// OPF 0.15: the renderer registers no catalog. Decks that name gallery records (font schemes such as roboto, the example decks'
// themes and layouts) resolve with the gallery catalog the host registers (`catalogs: [defaultCatalog]`), and a host catalog
// is a registered `{source, layouts: {id: record}, ...}` keyed by id.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {examples} from '@openpresentation/opf/examples';
import {catalogs, defaultCatalog, toSvg} from './catalog-harness.mjs';
import {createFontRegistry} from '../dist/font-registry.js';
import {loadFonts, autoScriptSelection, detectPresentationScripts} from '../dist/fonts-node.js';
import {loadFonts as loadBrowserFonts, lazyFacesNeeded, lazyFontsFor, presentationFaces, presentationFamilies} from '../dist/fonts-browser.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const label = faces => faces.map(face => `${face.family} ${face.weight}${face.italic ? 'i' : ''}`);
const lc = value => value.toLowerCase();

// ---- presentationFaces ----
const deck = slides => ({name: 'faces', slides});
assert.deepEqual(label(presentationFaces(deck([{title: 'Hello', text: 'World'}]))), ['Aptos 400', 'Aptos Display 700'], 'a plain deck draws two faces: the heading and body roles');
assert.deepEqual(label(presentationFaces(deck([{title: 'Hello'}]))), ['Aptos Display 700'], 'a title-only slide draws no body face');
assert.deepEqual(label(presentationFaces(deck([{title: 'Hello', text: ['plain ', {text: 'slanted', italic: true}]}]))), ['Aptos 400', 'Aptos 400i', 'Aptos Display 700'], 'an italic run adds the italic face');
assert.deepEqual(label(presentationFaces(deck([{title: 'Hello', text: ['plain ', {text: 'strong', bold: true}]}]))), ['Aptos 400', 'Aptos 700', 'Aptos Display 700'], 'a bold run adds the bold face');
assert.deepEqual(label(presentationFaces(deck([{title: 'Hello', items: ['a', 'b']}]))), ['Aptos 400', 'Aptos Display 700']);
const code = presentationFaces(deck([{title: 'Hello', code: 'const value = 1;'}]));
assert.ok(code.some(face => face.family === 'Roboto Mono'), 'the code role is requested where code is drawn');
assert.ok(!presentationFaces(deck([{title: 'Hello', text: 'World'}])).some(face => face.family === 'Roboto Mono'), 'and only there');
assert.ok(presentationFamilies(deck([{title: 'Hello', text: 'World'}])).has('Roboto Mono'), 'presentationFamilies keeps listing the role families');
assert.deepEqual(label(presentationFaces(deck([{title: 'One', text: 'a'}, {title: 'Two', text: 'b', design: {fontScheme: 'open-sans'}}]), {catalogs})), ['Aptos 400', 'Aptos Display 700', 'Open Sans 400', 'Open Sans 700'], 'a per-slide design override adds its own faces');
assert.deepEqual(label(presentationFaces({name: 'faces', design: {fontScheme: 'roboto'}, slides: [{title: 'Hello', text: 'World'}]}, {catalogs})), ['Roboto 400', 'Roboto 700']);
assert.deepEqual(label(presentationFaces(deck([{title: 'Hello', table: {columns: ['A', 'B'], rows: [['1', '2']]}}]))), ['Aptos 400', 'Aptos 700', 'Aptos Display 700'], 'table headers draw bold');
assert.deepEqual(label(presentationFaces({name: 'faces', design: {footer: {right: {text: '{{slide.number}}'}}}, slides: [{title: 'Hello'}]})), ['Aptos 400', 'Aptos Display 700'], 'furniture draws the body role');
const before = structuredClone(deck([{title: 'Hello', text: 'World'}]));
const probe = structuredClone(before);
presentationFaces(probe, { fonts: {textMeasurement: {measure: () => { throw new Error('the host measurement is not used'); }}}, onDiagnostic: () => { throw new Error('the host callback is not called'); }});
assert.deepEqual(probe, before, 'the document is not modified');
assert.deepEqual(presentationFaces(before), presentationFaces(before), 'deterministic');
// A script run is requested in its script slot's family (Yu Gothic here), and the text of the other scripts draws in the design font.
const yu = presentationFaces({name: 'faces', design: {fontScheme: 'yu-gothic'}, slides: [{title: 'Q3 レビュー', text: '日本語'}]}, {catalogs});
assert.ok(yu.length > 0 && yu.every(face => face.weight > 0));

// ---- examples: what a real registry paints is what the plan says it draws, and loading the plan is enough ----
const policyOf = policy => loadFonts({pack: 'office', substitutionPolicy: policy});
const full = {};
for (const policy of ['metric', 'visual']) full[policy] = await policyOf(policy);
const eager = full.metric.registry.embeddedFonts.map(face => ({family: face.family, weight: face.weight, italic: face.italic, data: new Uint8Array(Buffer.from(face.dataUrl.split(',')[1], 'base64'))}));
const lazyList = full.metric.registry.lazyFonts;
const lazyFiles = new Map(lazyList.map(face => [face.file, face]));
const key = face => `${face.family}|${face.weight}|${!!face.italic}`;
const bytesOf = async file => new Uint8Array(await readFile(path.join(root, file)));
const paintedFaces = svg => {
  const faces = new Set();
  for (const [, attributes] of svg.matchAll(/<(?:text|tspan)([^>]*)>/g)) {
    const family = /font-family="([^"]*)"/.exec(attributes)?.[1];
    if (!family) continue;
    faces.add(`${family.replaceAll('&quot;', '"').split(',')[0].replace(/^["']|["']$/g, '').trim()}|${/font-weight="([^"]*)"/.exec(attributes)?.[1] ?? '400'}|${/font-style="italic"/.test(attributes)}`);
  }
  return faces;
};

let compared = 0, plannedFiles = 0, wholeFamilyFiles = 0, rendered = 0, oddWeights = 0;
for (const {file, deck: example} of examples) {
  const asNamed = presentationFaces(example, {catalogs});
  assert.ok(asNamed.length > 0, `${file}: draws text`);
  for (const policy of ['metric', 'visual']) {
    const handle = full[policy], real = handle.registry;
    // What Node paints with every vendored face loaded is the plan's resolution against those faces.
    const drawn = presentationFaces(example, {catalogs}, {faces: real.describeFaces(), policy});
    const drawnKeys = new Set(drawn.map(key));
    // A metric registry cannot draw a deck that names a family with only a visual replacement (Consolas); the plan still covers it.
    let svg;
    try { svg = toSvg(example, 1, {fonts: handle}); } catch (error) { assert.equal(error.code, 'font-unavailable', `${file} (${policy}): ${error.message}`); }
    if (svg !== undefined) {
      for (const painted of paintedFaces(svg)) {
        const [family, weight, italic] = painted.split('|');
        if (family === 'Noto Sans') continue; // the glyph-fallback face (opf-render#57)
        assert.ok(drawnKeys.has(`${family}|${weight === 'bold' ? 700 : weight}|${italic}`), `${file} (${policy}): painted ${painted} is not among the planned faces ${label(drawn)}`);
      }
      rendered++;
    }
    // A registry holding the eager faces plus exactly the planned vendored ones draws the same faces.
    const partial = createFontRegistry(eager.map(face => ({...face})), {substitutionPolicy: policy});
    const need = lazyFacesNeeded(example, {catalogs}, {lazy: lazyList, held: partial.describeFaces(), policy});
    partial.addFaces(await Promise.all(need.map(async face => ({family: face.family, weight: face.weight, italic: face.italic, embed: 'used', data: await bytesOf(face.file)}))));
    assert.deepEqual(presentationFaces(example, {catalogs}, {faces: partial.describeFaces(), policy}).map(key), drawn.map(key), `${file} (${policy}): the planned faces draw as Node does with everything loaded`);
    compared += drawn.length;
    // Nothing else is loaded: every planned file is drawn.
    for (const face of need) assert.ok(drawnKeys.has(key(face)), `${file} (${policy}): ${face.file} is loaded for no drawn face`);
    plannedFiles += need.length;
    // The single-step call agrees for the resolved faces.
    assert.deepEqual(lazyFontsFor(drawn, {lazy: lazyList, held: eager, policy}).map(face => face.file).sort(), need.map(face => face.file).sort(), `${file} (${policy}): lazyFontsFor and lazyFacesNeeded agree`);
  }
  oddWeights += asNamed.some(face => face.weight !== 400 && face.weight !== 700) ? 1 : 0;
  wholeFamilyFiles += lazyFontsFor(presentationFamilies(example, {catalogs}), {lazy: lazyList, hasFamily: family => eager.some(held => lc(held.family) === lc(family)), policy: 'visual'}).length;
}
assert.ok(compared > examples.length && rendered > examples.length, 'every example deck was checked');
assert.ok(plannedFiles > 0 && plannedFiles < wholeFamilyFiles * 2 * 0.75, `the plans load fewer files than whole families (${plannedFiles} planned over two policies, ${wholeFamilyFiles} whole-family files per policy)`);
assert.ok(oddWeights > 0, 'the corpus has decks with weights other than 400 and 700');
// A label of weight 600 in an Aptos deck under metric policy: Aptos 600 has no metric face, its role family Intos resolves it to Intos 700.
const labelDeck = examples.find(entry => entry.file.endsWith('technical/asset-source-forms.opf.json')).deck;
assert.ok(presentationFaces(labelDeck, {catalogs}).some(face => face.family === 'Aptos' && face.weight === 600));
assert.ok(lazyFacesNeeded(labelDeck, {catalogs}, {lazy: lazyList, held: eager, policy: 'metric'}).some(face => face.family === 'Intos' && face.weight === 700), 'the bold face is planned although Aptos 600 itself has no metric replacement');

// ---- lazyFontsFor at face level ----
const intos = family => lazyList.filter(face => face.family === family);
const roboto = [400, 700].map(weight => ({family: 'Roboto', weight, italic: false, file: `fonts/roboto/Roboto-${weight}.ttf`}));
const heldOf = (...faces) => faces.map(face => ({family: face.family, weight: face.weight, italic: !!face.italic}));
const request = (family, weight = 400, italic = false) => ({family, weight, italic});
const fileNames = faces => faces.map(face => face.file.split('/').pop()).sort();
assert.deepEqual(fileNames(lazyFontsFor([request('Aptos Display', 700), request('Aptos')], {lazy: lazyList, held: []})), ['IntosDisplay-Bold.ttf', 'Intos-Regular.ttf'].sort(), 'the drawn faces of the two Intos families, not all 16');
assert.deepEqual(fileNames(lazyFontsFor([request('Aptos', 400, true)], {lazy: lazyList, held: []})), ['Intos-Italic.ttf'], 'italic asks for the italic face');
assert.deepEqual(fileNames(lazyFontsFor([request('Aptos', 500)], {lazy: lazyList, held: [], policy: 'visual'})), ['Intos-Regular.ttf'], 'a weight maps to the nearest vendored face, ties to the lighter');
assert.deepEqual(fileNames(lazyFontsFor([request('Aptos', 800)], {lazy: lazyList, held: [], policy: 'visual'})), ['Intos-Bold.ttf']);
const regular = intos('Intos').find(face => face.weight === 400 && !face.italic);
assert.deepEqual(fileNames(lazyFontsFor([request('Aptos'), request('Aptos', 700)], {lazy: lazyList, held: heldOf(regular), policy: 'visual'})), ['Intos-Bold.ttf'], 'a partially loaded family loads its missing face');
assert.deepEqual(lazyFontsFor([request('Aptos')], {lazy: lazyList, held: heldOf(regular), policy: 'visual'}), [], 'a face that is held needs nothing');
assert.deepEqual(lazyFontsFor([request('Aptos')], {lazy: lazyList, held: [], loaded: new Set([regular.file]), policy: 'visual'}), [], 'nor one already loaded');
assert.deepEqual(lazyFontsFor([request('Aptos')], {lazy: lazyList, held: [], policy: 'none'}), [], 'policy none: Aptos would not resolve, nothing is fetched');
assert.deepEqual(lazyFontsFor([request('No Such Family', 700)], {lazy: lazyList, held: []}), [], 'an unknown family needs nothing');
assert.deepEqual(fileNames(lazyFontsFor([request('Segoe UI Semibold', 700), request('Segoe UI', 400)], {lazy: lazyList, held: [], policy: 'visual'})), ['RedHatDisplay_400Regular.ttf', 'RedHatDisplay_700Bold.ttf'], 'a policy replacement resolves per weight');
// A lone Roboto Regular must not suppress Roboto Bold when the host can serve it (any face list works as `lazy`).
assert.deepEqual(lazyFontsFor([request('Roboto', 700)], {lazy: roboto, held: heldOf(roboto[0])}).map(face => face.file), [roboto[1].file], 'Roboto Regular held does not suppress Roboto Bold');
assert.deepEqual(lazyFontsFor([request('Roboto', 400)], {lazy: roboto, held: heldOf(roboto[0])}), []);
assert.deepEqual(lazyFontsFor(['Roboto'], {lazy: roboto, held: heldOf(roboto[0])}).map(face => face.file), [roboto[1].file], 'a family name loads the family\'s missing faces');
// An alias whose target the registry holds but the lazy list does not know (Roboto, an eager face) needs nothing, and must not crash (Bugbot, opf-render#71).
const aliasHeld = {lazy: lazyList, held: heldOf(roboto[0]), policy: 'none', aliases: new Map([['heading font', 'roboto'], ['other font', 'intos']])};
assert.deepEqual(lazyFontsFor(['Heading Font'], aliasHeld), [], 'family name: held alias target outside the lazy list');
assert.deepEqual(lazyFontsFor([request('Heading Font', 700)], aliasHeld), [], 'face request: held alias target outside the lazy list');
assert.deepEqual(lazyFontsFor(['Heading Font'], {...aliasHeld, held: []}), [], 'alias target neither held nor lazy');
assert.equal(lazyFontsFor(['Other Font'], {...aliasHeld, held: []}).length, 4, 'an alias to a lazy family loads the family');
assert.deepEqual(fileNames(lazyFontsFor(['Other Font'], {...aliasHeld, held: heldOf(regular)})), ['Intos-Bold.ttf', 'Intos-BoldItalic.ttf', 'Intos-Italic.ttf'], 'an alias to a partially held lazy family loads its missing faces');
assert.deepEqual(lazyFontsFor(['Roboto Medium'], {lazy: lazyList, held: heldOf(roboto[0]), policy: 'visual'}), [], 'a held replacement candidate outside the lazy list');
// The family-level call of earlier releases still works.
assert.equal(lazyFontsFor(['Aptos'], {lazy: lazyList, hasFamily: () => false, policy: 'visual'}).length, 4, 'a family name means the whole family (Intos: four faces)');
assert.equal(lazyFontsFor([request('Aptos')], {lazy: lazyList, hasFamily: () => false, policy: 'visual'}).length, 4, 'without the registry\'s faces a face request falls back to family level');

// ---- the browser loader: incremental, face level ----
class Face { constructor(family, bytes, descriptors) { Object.assign(this, {family, bytes, descriptors}); } async load() { return this; } }
const fonts = new Set(); fonts.ready = Promise.resolve();
const document = {fonts, defaultView: {FontFace: Face}};
const served = [];
const fetchLazy = async url => {
  served.push(url.replace('https://fonts.example/', ''));
  const file = url.replace('https://fonts.example/', '');
  if (!lazyFiles.has(file)) return {ok: false, status: 404};
  const bytes = Buffer.from(await readFile(path.join(root, file)));
  return {ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)};
};
const load = options => loadBrowserFonts({faces: eager.map(face => ({...face})), document, fetch: fetchLazy, substitutionPolicy: 'visual', lazyFontsBaseUrl: 'https://fonts.example/', ...options}).then(fonts => fonts.registry);
const registry = await load();
const homepage = deck([{title: 'Open Presentation', text: 'A deck format for people and agents.'}]);
assert.deepEqual(fileNames(registry.pendingLazyFonts(homepage)), ['IntosDisplay-Bold.ttf', 'Intos-Regular.ttf'].sort(), 'a homepage-like deck needs two of the sixteen Intos files');
const files = registry.pendingLazyFonts(homepage).map(face => face.file);
const bytes = (await Promise.all(files.map(bytesOf))).reduce((sum, item) => sum + item.length, 0);
assert.ok(bytes < 2_000_000, `about 1.5 MB, not 6.1 MB: ${bytes}`);
assert.ok(!registry.pendingLazyFonts(homepage).some(face => /Mono/.test(face.family)), 'no code face is fetched without a code block');
served.length = 0;
assert.equal((await registry.ensureLazyFonts(homepage)).length, 2);
assert.deepEqual([...served].sort(), [...files].sort(), 'only the drawn faces are fetched');
assert.deepEqual(registry.pendingLazyFonts(homepage), []);
// An edit that adds an italic run: pendingLazyFonts reports just the new face, and ensureLazyFonts fetches just it.
const edited = deck([{title: 'Open Presentation', text: ['A deck format for ', {text: 'people', italic: true}, ' and agents.']}]);
assert.deepEqual(fileNames(registry.pendingLazyFonts(edited)), ['Intos-Italic.ttf'], 'the edit adds only the italic face');
served.length = 0;
assert.deepEqual(fileNames(await registry.ensureLazyFonts(edited)), ['Intos-Italic.ttf']);
assert.deepEqual(served, ['fonts/intos/Intos-Italic.ttf']);
// ... and bold.
const bolder = deck([{title: 'Open Presentation', text: ['A deck format for ', {text: 'people', bold: true}, ' and agents.']}]);
assert.deepEqual(fileNames(registry.pendingLazyFonts(bolder)), ['Intos-Bold.ttf'], 'the bold edit adds only the bold face');
served.length = 0;
await registry.ensureLazyFonts(bolder);
assert.deepEqual(served, ['fonts/intos/Intos-Bold.ttf']);
assert.deepEqual(registry.pendingLazyFonts(edited), []);
// A code block adds the code role's face only then (Roboto Mono is an eager face of the base pack in this registry).
assert.deepEqual(registry.pendingLazyFonts(deck([{title: 'Code', code: 'const value = 1;'}])), []);
registry.dispose();

// ---- host catalogs (FF-41 issue 2) ----
// The host registers its own catalog: the gallery records plus a `bullets` layout (the gallery's list-1x under another id).
const bullets = [{...defaultCatalog, source: 'https://catalog.example/host', layouts: {...defaultCatalog.layouts, bullets: {...defaultCatalog.layouts['list-1x'], name: 'Bullets'}}}];
const catalogDeck = {name: 'x', design: {fontScheme: 'aptos'}, slides: [{layout: 'bullets', title: 'A', items: ['b']}]};
// A layout id no registered catalog has never throws: the slide composes with no layout and the render reports one
// `unresolved-reference` for the layout.
const unresolvedLayout = [];
assert.ok(toSvg(catalogDeck, 1, {onDiagnostic: item => unresolvedLayout.push(item)}).startsWith('<svg'));
assert.deepEqual(unresolvedLayout.map(item => [item.code, item.kind, item.reference]), [['unresolved-reference', 'layouts', 'bullets']]);
const resolvedLayout = [];
assert.ok(toSvg(catalogDeck, 1, {catalogs: bullets, onDiagnostic: item => resolvedLayout.push(item)}).startsWith('<svg'));
assert.deepEqual(resolvedLayout.filter(item => item.code === 'unresolved-reference'), [], 'the host catalog resolves the layout');
assert.deepEqual([...presentationFamilies(catalogDeck, {catalogs})].sort(), ['Aptos', 'Aptos Display', 'Roboto Mono'], 'an unknown layout id does not change the families the deck draws');
assert.deepEqual([...presentationFamilies(catalogDeck, {catalogs: bullets})].sort(), ['Aptos', 'Aptos Display', 'Roboto Mono']);
assert.deepEqual(label(presentationFaces(catalogDeck, {catalogs: bullets})), ['Aptos 400', 'Aptos Display 700']);
const hosted = await load({renderOptions: {catalogs}});
assert.equal(hosted.pendingLazyFonts(catalogDeck).length, 2, 'an unknown layout id still names the faces the deck draws');
assert.deepEqual(fileNames(hosted.pendingLazyFonts(catalogDeck, {catalogs: bullets})), ['IntosDisplay-Bold.ttf', 'Intos-Regular.ttf'].sort(), 'the catalogs a host passes resolve the document');
served.length = 0;
assert.equal((await hosted.ensureLazyFonts(catalogDeck, {catalogs: bullets})).length, 2);
assert.equal(served.length, 2);
hosted.dispose();
// Default render options of the loader apply to every call; a call's own options win.
const withDefaults = await load({renderOptions: {catalogs: bullets}});
assert.equal(withDefaults.pendingLazyFonts(catalogDeck).length, 2);
assert.equal(withDefaults.pendingLazyFonts(catalogDeck, {catalogs: bullets}).length, 2);
assert.equal((await withDefaults.ensureLazyFonts(catalogDeck, {signal: new AbortController().signal})).length, 2);
withDefaults.dispose();
// A font scheme that exists only in the host's catalogs and names a script font selects that font's script package.
const yuCatalog = [{source: 'https://catalog.example/yu', fontSchemes: {'host-yu': {name: 'Host Yu', app: 'powerpoint', languageFamily: 'latin', languages: [], major: 'Yu Gothic', minor: 'Yu Gothic', textSample: 'x', type: 'sans-serif'}}}];
const yuDeck = {name: 'yu', design: {fontScheme: 'host-yu'}, slides: [{title: 'Review', text: 'Text'}]};
const scriptRegistry = await load({scriptBaseUrl: 'https://fonts.example/scripts/'});
assert.deepEqual(scriptRegistry.pendingScripts(yuDeck, {catalogs}), [], 'the gallery catalog does not have the host scheme, so with it alone no script face is named');
assert.deepEqual(scriptRegistry.pendingScripts(yuDeck, {catalogs: yuCatalog}), ['@expo-google-fonts/noto-sans-jp'], 'with the host catalogs the scheme names Yu Gothic, which needs Noto Sans JP');
assert.deepEqual(autoScriptSelection(yuDeck, {catalogs: yuCatalog}).scripts, ['Jpan']);
assert.deepEqual(autoScriptSelection(yuDeck, {catalogs}).scripts, []);
assert.deepEqual(detectPresentationScripts(yuDeck, {catalogs: yuCatalog}), []);
// Text-driven detection does not need the document to resolve.
assert.deepEqual(scriptRegistry.pendingScripts({name: 'jp', language: 'ja', slides: [{layout: 'bullets', title: 'こんにちは', items: ['日本語']}]}), ['@expo-google-fonts/noto-sans-jp']);
scriptRegistry.dispose();
const scriptDefaults = await load({scriptBaseUrl: 'https://fonts.example/scripts/', renderOptions: {catalogs: yuCatalog}});
assert.deepEqual(scriptDefaults.pendingScripts(yuDeck), ['@expo-google-fonts/noto-sans-jp'], 'loader-level renderOptions reach the script analysis');
scriptDefaults.dispose();
assert.equal(fonts.size, 0, 'dispose removes every face');

console.log(JSON.stringify({test: 'lazy-faces', decks: examples.length, facesCompared: compared, plannedFiles, wholeFamilyFilesPerPolicy: wholeFamilyFiles}));
