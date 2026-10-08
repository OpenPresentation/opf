// FF-41: a browser registry loads faces the host serves itself (`extraLazyFonts`) on demand, like the vendored ones:
//   - splitStartupFaces keeps Roboto Regular at start (or the faces the host picks) and returns the rest, in order,
//   - extra faces are validated (sha256 mandatory, plain family, unique url) and listed in registry.lazyFonts as package "host",
//   - one ensureLazyFonts pass loads a vendored face (from lazyFontsBaseUrl) and the extra faces (from their urls) a document draws,
//     face by face: a plain deck needs Roboto Bold only, an italic run adds one face, code adds Roboto Mono only where it is drawn,
//   - a tampered file, a missing file and an abort leave the registry and the document unchanged and can be retried,
//   - dispose removes every face the registry added, extra ones included,
//   - over all 126 example decks and both policies: a registry that starts with Roboto Regular and loads exactly the planned
//     extra and vendored faces draws the same faces as Node with everything loaded.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {examples} from '@openpresentation/opf/examples';
import {createFontRegistry} from '../dist/font-registry.js';
import {renderSlideSvg, catalogs} from './catalog-harness.mjs'; // FA-23: registers the gallery snapshot (the documents name gallery records)
import {loadFonts} from '../dist/fonts-node.js';
import {lazyFacesNeeded, loadFonts as loadBrowserFonts, presentationFaces, splitStartupFaces} from '../dist/fonts-browser.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const decode = face => new Uint8Array(Buffer.from(face.dataUrl.split(',')[1], 'base64'));
const short = url => url.split('/').pop().replace(/\.ttf$/, '');

// ---- splitStartupFaces ----
const sample = [{family: 'Roboto', weight: 700, italic: false}, {family: 'Roboto', weight: 400, italic: false}, {family: 'Roboto', weight: 400, italic: true}, {family: 'Arimo', weight: 400, italic: false}];
assert.deepEqual(splitStartupFaces(sample), {startup: [sample[1]], rest: [sample[0], sample[2], sample[3]]}, 'Roboto Regular starts, the rest keeps its order');
assert.deepEqual(splitStartupFaces(sample, {startup: face => face.family === 'Arimo'}).startup, [sample[3]], 'the host can pick its own startup faces');
assert.deepEqual(splitStartupFaces([]), {startup: [], rest: []});
assert.throws(() => splitStartupFaces(sample, {startup: 'Roboto'}), {code: 'invalid-font-source'});

// ---- the fake browser ----
const {registry: node} = await loadFonts({pack: 'office', substitutionPolicy: 'visual'});
const eager = node.embeddedFonts.map(face => ({family: face.family, weight: face.weight, italic: !!face.italic, license: face.license, data: decode(face)}));
const {startup, rest} = splitStartupFaces(eager);
assert.equal(startup.length, 1);
const extraUrl = face => `https://host.test/base/${face.family.replace(/[^a-z0-9]+/gi, '-')}-${face.weight}${face.italic ? 'i' : ''}.ttf`;
const extras = rest.map(face => ({family: face.family, weight: face.weight, italic: face.italic, license: face.license, url: extraUrl(face), sha256: sha(face.data)}));
const bytesByUrl = new Map(rest.map(face => [extraUrl(face), face.data]));

class Face { constructor(family, bytes, descriptors) { Object.assign(this, {family, bytes, descriptors}); } async load() { return this; } }
function fake() {
  const fonts = new Set(); fonts.ready = Promise.resolve();
  const served = [], tampered = new Set(), missing = new Set();
  const fetcher = async (url, {signal} = {}) => {
    signal?.throwIfAborted?.();
    served.push(url);
    if (url.startsWith('https://fonts.example/')) {
      const file = url.replace('https://fonts.example/', '');
      return {ok: true, arrayBuffer: async () => { const bytes = await readFile(path.join(root, file)); return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); }};
    }
    const data = bytesByUrl.get(url);
    if (!data || missing.has(url)) return {ok: false, status: 404};
    const body = tampered.has(url) ? Uint8Array.from(data, (byte, index) => index === 0 ? byte ^ 1 : byte) : data;
    return {ok: true, arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength)};
  };
  return {fonts, served, tampered, missing, document: {fonts, defaultView: {FontFace: Face}}, fetch: fetcher};
}
const load = (host, options = {}) => loadBrowserFonts({faces: startup.map(face => ({...face, data: face.data.slice()})), document: host.document, fetch: host.fetch, substitutionPolicy: 'visual', fallbackFamily: 'Roboto', lazyFontsBaseUrl: 'https://fonts.example/', extraLazyFonts: extras, renderOptions: {catalogs}, ...options}).then(fonts => fonts.registry);
const deck = (slides, design = {fontScheme: 'roboto'}) => ({name: 'extra faces', design, slides: slides.map((slide, index) => ({id: `s${index}`, ...slide}))});
const faceNames = registry => registry.describeFaces().map(face => `${face.family} ${face.weight}${face.italic ? 'i' : ''}`).sort();

// ---- validation ----
// A bad list is refused before any startup face is fetched or added to the document (nothing to dispose afterwards).
const invalid = async (options, pattern) => {
  const host = fake();
  await assert.rejects(load(host, options), error => error.code === 'invalid-font-source' && pattern.test(error.message));
  assert.equal(host.fonts.size, 0, 'no face is left in the document');
  assert.deepEqual(host.served, [], 'and nothing was fetched');
};
await invalid({extraLazyFonts: 'nope'}, /array/);
await invalid({extraLazyFonts: [{...extras[0], sha256: undefined}]}, /SHA-256/);
await invalid({extraLazyFonts: [{...extras[0], sha256: 'abc'}]}, /SHA-256/);
await invalid({extraLazyFonts: [{...extras[0], url: ''}]}, /url/);
await invalid({extraLazyFonts: [{...extras[0], family: 'Bad"Name'}]}, /family/);
await invalid({extraLazyFonts: [{...extras[0], weight: 0}]}, /weight/);
await invalid({extraLazyFonts: [extras[0], extras[0]]}, /repeats url/);

// ---- a registry with extra faces ----
{
  const host = fake();
  const registry = await load(host);
  assert.deepEqual(faceNames(registry), ['Roboto 400'], 'the registry starts with Roboto Regular only');
  assert.equal(registry.lazyFonts.length, node.lazyFonts.length + extras.length, 'lazyFonts lists the vendored and the extra faces');
  const listed = registry.lazyFonts.filter(face => face.package === 'host');
  assert.equal(listed.length, extras.length);
  assert.ok(listed.every(face => face.url === face.file && /^[0-9a-f]{64}$/.test(face.sha256)));
  assert.ok(Object.isFrozen(registry.lazyFonts));

  const plain = deck([{title: 'Quarterly review', text: 'Revenue grew.'}]);
  assert.deepEqual(registry.pendingLazyFonts(plain).map(face => short(face.file)), ['Roboto-700'], 'a plain Roboto deck needs Roboto Bold only');
  assert.deepEqual((await registry.ensureLazyFonts(plain)).map(face => face.family + face.weight), ['Roboto700']);
  assert.deepEqual(host.served, [extraUrl(rest.find(face => face.family === 'Roboto' && face.weight === 700 && !face.italic))], 'only that file is fetched, from its own url');
  assert.deepEqual(registry.pendingLazyFonts(plain), []);
  assert.deepEqual(faceNames(registry), ['Roboto 400', 'Roboto 700']);
  assert.equal(host.fonts.size, 2, 'the document holds the startup face and the loaded one');
  assert.equal(registry.resolveFont({fontFamily: 'Roboto', fontWeight: 700}).resolvedWeight, 700);
  host.served.length = 0;
  assert.deepEqual(await registry.ensureLazyFonts(plain), [], 'nothing is fetched twice');
  assert.deepEqual(host.served, []);

  const italic = deck([{title: 'Quarterly review', text: ['Revenue ', {text: 'grew', italic: true}, '.']}]);
  assert.deepEqual(registry.pendingLazyFonts(italic).map(face => short(face.file)), ['Roboto-400i'], 'an italic run adds one face');
  const code = deck([{title: 'Code', code: 'const a = 1;'}]);
  assert.deepEqual(registry.pendingLazyFonts(code).map(face => short(face.file)), ['Roboto-Mono-400', 'Roboto-Mono-700'], 'code loads Roboto Mono where it is drawn');
  assert.deepEqual(registry.pendingLazyFonts(plain), [], 'and only there');

  // One pass over vendored and extra faces: slide one draws Intos (vendored, from lazyFontsBaseUrl), slide two draws Roboto Mono (extra).
  const both = deck([{title: 'Aptos', text: 'one'}, {title: 'Code', code: 'x', design: {fontScheme: 'roboto'}}], {fontScheme: 'aptos'});
  const needed = registry.pendingLazyFonts(both);
  assert.ok(needed.some(face => face.package === 'intos') && needed.some(face => face.package === 'host'), `one pass covers both kinds: ${needed.map(face => short(face.file))}`);
  host.served.length = 0;
  await registry.ensureLazyFonts(both);
  assert.ok(host.served.some(url => url.startsWith('https://fonts.example/fonts/intos/')) && host.served.some(url => url.startsWith('https://host.test/')));
  assert.deepEqual(registry.pendingLazyFonts(both), []);
  assert.ok(registry.describeFaces().some(face => /^Intos/.test(face.family)) && registry.describeFaces().some(face => face.family === 'Roboto Mono'));

  // Host faces are embed "used" like the vendored ones: registry.embeddedFonts holds the startup face only, and an SVG embeds a host face
  // only when it is passed explicitly and the slide's text uses its family.
  assert.deepEqual(registry.embeddedFonts.map(face => `${face.family} ${face.weight}`), ['Roboto 400']);
  const svg = renderSlideSvg(plain, 0, { fonts: {textMeasurement: registry.textMeasurement, embeddedFonts: registry.selectEmbeddedFonts(() => true)}});
  assert.deepEqual([...svg.matchAll(/@font-face\{font-family:"([^"]+)";font-weight:(\d+)/g)].map(match => `${match[1]} ${match[2]}`).sort(), ['Roboto 400', 'Roboto 700'], 'Roboto Bold embeds because the title uses it; the other loaded faces do not exist yet');

  // The vendored loader still needs lazyFontsBaseUrl, the host's faces do not.
  const noBase = await load(fake(), {lazyFontsBaseUrl: undefined});
  await noBase.ensureLazyFonts(plain);
  assert.deepEqual(faceNames(noBase), ['Roboto 400', 'Roboto 700'], 'extra faces load without lazyFontsBaseUrl');
  await assert.rejects(noBase.ensureLazyFonts(deck([{title: 'Aptos', text: 'one'}], {fontScheme: 'aptos'})), {code: 'invalid-font-source'});
  noBase.dispose();

  // dispose removes every face the registry added, extra ones included.
  registry.dispose();
  assert.equal(host.fonts.size, 0, 'dispose removes the startup, vendored and extra faces from the document');
  await assert.rejects(registry.ensureLazyFonts(plain), {code: 'font-registry-disposed'});
}

// ---- tamper, missing file, abort ----
{
  const host = fake();
  const registry = await load(host);
  const plain = deck([{title: 'Quarterly review', text: 'Revenue grew.'}]);
  const boldUrl = extraUrl(rest.find(face => face.family === 'Roboto' && face.weight === 700 && !face.italic));
  host.tampered.add(boldUrl);
  await assert.rejects(registry.ensureLazyFonts(plain), {code: 'font-integrity-mismatch'});
  assert.deepEqual(faceNames(registry), ['Roboto 400'], 'a tampered face is not registered');
  assert.equal(host.fonts.size, 1, 'nor added to the document');
  assert.equal(registry.pendingLazyFonts(plain).length, 1, 'it stays pending');
  host.tampered.clear();
  host.missing.add(boldUrl);
  await assert.rejects(registry.ensureLazyFonts(plain), {code: 'font-fetch-failed'});
  assert.equal(host.fonts.size, 1);
  host.missing.clear();
  // All or nothing: one good and one tampered face in the same call add neither.
  const code = deck([{title: 'Code', code: 'const a = 1;'}]);
  const monoUrls = registry.pendingLazyFonts(code).filter(face => face.package === 'host').map(face => face.url);
  assert.ok(monoUrls.length >= 2);
  host.tampered.add(monoUrls[1]);
  await assert.rejects(registry.ensureLazyFonts(code), {code: 'font-integrity-mismatch'});
  assert.deepEqual(faceNames(registry), ['Roboto 400'], 'the good face of a failed call is not kept');
  host.tampered.clear();
  assert.ok((await registry.ensureLazyFonts(plain)).length === 1, 'a later call retries');
  const controller = new AbortController(); controller.abort();
  host.served.length = 0;
  await assert.rejects(registry.ensureLazyFonts(code, {signal: controller.signal}));
  assert.deepEqual(host.served, [], 'an aborted call fetches nothing');
  registry.dispose();
  assert.equal(host.fonts.size, 0);
}

// ---- oracle: startup Roboto Regular + planned faces draw what Node draws with everything loaded ----
const vendored = node.lazyFonts;
const hostList = extras.map(face => ({...face, package: 'host', file: face.url}));
let decks = 0, planned = 0;
for (const policy of ['metric', 'visual']) {
  const {registry: real} = await loadFonts({pack: 'office', substitutionPolicy: policy});
  for (const {file, deck: example} of examples) {
    const drawn = presentationFaces(example, {catalogs}, {faces: real.describeFaces(), policy});
    const partial = createFontRegistry(startup.map(face => ({...face, data: face.data.slice()})), {substitutionPolicy: policy});
    const need = lazyFacesNeeded(example, {catalogs}, {lazy: [...vendored, ...hostList], held: partial.describeFaces(), policy});
    partial.addFaces(await Promise.all(need.map(async face => face.package === 'host'
      ? {family: face.family, weight: face.weight, italic: face.italic, data: bytesByUrl.get(face.url)}
      : {family: face.family, weight: face.weight, italic: face.italic, embed: 'used', data: new Uint8Array(await readFile(path.join(root, face.file)))})));
    assert.deepEqual(presentationFaces(example, {catalogs}, {faces: partial.describeFaces(), policy}).map(face => `${face.family}|${face.weight}|${face.italic}`), drawn.map(face => `${face.family}|${face.weight}|${face.italic}`), `${file} (${policy}): startup + planned faces draw as Node does with everything loaded`);
    planned += need.length;
  }
  decks += examples.length;
}
assert.ok(decks === 2 * examples.length && planned > 0);
console.log(JSON.stringify({test: 'extra-lazy-fonts', extraFaces: extras.length, decks, plannedFiles: planned}));
