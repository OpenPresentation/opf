// FF-41: a browser registry that starts with Roboto Regular and loads the host's own faces (`extraLazyFonts`) on demand, in a real
// browser. A page bundles the browser font loader and the SVG renderer, serves Roboto Regular, the other eager faces (as the host's
// extra faces, at /extra/<n>.ttf) and the vendored Intos files from local routes and nothing else, and checks that
//   - the registry and the document start with Roboto Regular only,
//   - a plain Roboto deck fetches exactly Roboto Bold from /extra/, hash-verified, and the registry and the document then hold the
//     same faces and every drawn run's natural advance equals the registry's measured advance within 0.1 px,
//   - a deck that draws a vendored face and an extra face (an Aptos deck with code) fetches both in one ensureLazyFonts call,
//   - a tampered extra file is refused: nothing is added to the registry or the document, and a retry succeeds,
//   - dispose removes every face from the document.
// Offline: every other request is aborted.
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {loadFonts} from '../dist/fonts-node.js';
import {splitStartupFaces} from '../dist/fonts-browser.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.resolve(root, process.argv[2] ?? 'artifacts/extra-lazy-fonts');
await mkdir(outputDirectory, {recursive: true});
const bundle = await build({
  stdin: {contents: "import {loadFonts as loadBrowserFonts} from './dist/fonts-browser.js';import {renderSlideSvg} from './dist/svg.js';window.opf={loadBrowserFonts,renderSlideSvg};", resolveDir: root, sourcefile: 'entry.js', loader: 'js'},
  bundle: true, platform: 'browser', format: 'iife', write: false, minify: true,
});
const script = bundle.outputFiles[0].text;

const {registry: node} = await loadFonts({pack: 'office', substitutionPolicy: 'visual'});
const eager = node.embeddedFonts.map(face => ({family: face.family, weight: face.weight, italic: !!face.italic, license: face.license, bytes: Buffer.from(face.dataUrl.split(',')[1], 'base64')}));
const {startup, rest} = splitStartupFaces(eager);
assert.equal(startup.length, 1);
const ORIGIN = 'https://app.test';
const extras = rest.map((face, index) => ({family: face.family, weight: face.weight, italic: face.italic, license: face.license, url: `${ORIGIN}/extra/${index}.ttf`, sha256: createHash('sha256').update(face.bytes).digest('hex')}));
const indexOf = (family, weight, italic = false) => rest.findIndex(face => face.family === family && face.weight === weight && face.italic === italic);
const extraRequests = [], vendoredRequests = [], unexpected = [], tampered = new Set();
const decks = {
  plain: {name: 'Roboto deck', design: {fontScheme: 'roboto'}, slides: [{id: 'a', title: 'Quarterly operating review', text: 'Revenue grew in every region.'}]},
  mixed: {name: 'Aptos with code', design: {fontScheme: 'aptos'}, slides: [{id: 'a', title: 'Code review', code: 'const total = 12 + 34;'}]},
};

const browser = await chromium.launch({channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined});
const errors = [];
try {
  const page = await browser.newPage({viewport: {width: 1300, height: 760}});
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !/status of 404|Failed to load resource/.test(message.text())) errors.push(message.text()); });
  await page.route(/^https?:/, async route => {
    const url = route.request().url();
    if (url === `${ORIGIN}/`) return route.fulfill({status: 200, contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><main></main>'});
    if (url === `${ORIGIN}/start.ttf`) return route.fulfill({status: 200, contentType: 'font/ttf', body: startup[0].bytes});
    const extra = /^https:\/\/app\.test\/extra\/(\d+)\.ttf$/.exec(url);
    if (extra) {
      extraRequests.push(Number(extra[1]));
      const bytes = Buffer.from(rest[Number(extra[1])].bytes);
      if (tampered.has(Number(extra[1]))) bytes[0] ^= 1;
      return route.fulfill({status: 200, contentType: 'font/ttf', body: bytes});
    }
    if (url.startsWith(`${ORIGIN}/fonts/`)) {
      vendoredRequests.push(url.slice(ORIGIN.length + 1));
      try { return await route.fulfill({status: 200, contentType: 'font/ttf', body: await readFile(path.join(root, url.slice(ORIGIN.length + 1)))}); } catch { return route.fulfill({status: 404}); }
    }
    unexpected.push(url); return route.abort();
  });
  await page.goto(`${ORIGIN}/`);
  await page.addScriptTag({content: script});
  await page.evaluate(async ({startup, extras, decks}) => {
    const {loadBrowserFonts} = window.opf;
    window.decks = decks;
    window.registry = (await loadBrowserFonts({faces: [{url: '/start.ttf', family: startup.family, weight: startup.weight, italic: startup.italic}], substitutionPolicy: 'visual', fallbackFamily: 'Roboto', lazyFontsBaseUrl: `${location.origin}/`, extraLazyFonts: extras,})).registry;
  }, {startup: {family: startup[0].family, weight: startup[0].weight, italic: startup[0].italic}, extras, decks});

  const state = deckName => page.evaluate(async deckName => {
    const registry = window.registry, {renderSlideSvg} = window.opf;
    const host = document.querySelector('main'); host.innerHTML = renderSlideSvg(window.decks[deckName], 0, { fonts: {textMeasurement: registry.textMeasurement}});
    await document.fonts.ready;
    const family = value => value.split(',')[0].trim().replace(/^"|"$/g, '');
    const runs = [...host.querySelectorAll('text[textLength], tspan[textLength]')].map(element => {
      const fontFamily = family(element.getAttribute('font-family') ?? element.closest('text').getAttribute('font-family'));
      return {family: fontFamily, accepted: Number(element.getAttribute('textLength')), natural: element.getComputedTextLength(), painted: [...document.fonts].some(face => face.family.replace(/^"|"$/g, '') === fontFamily && face.status === 'loaded')};
    });
    return {
      registryFaces: registry.describeFaces().map(face => `${face.family}|${face.weight}|${face.italic}`).sort(),
      documentFaces: [...document.fonts].map(face => `${face.family.replace(/^"|"$/g, '')}|${Number(face.weight)}|${face.style === 'italic'}`).sort(),
      pending: registry.pendingLazyFonts(window.decks[deckName]).map(face => face.file), runs,
    };
  }, deckName);
  const checkRuns = (label, now) => { assert.ok(now.runs.length > 0, label); for (const run of now.runs) { assert.ok(run.painted, `${label}: ${run.family} is loaded`); assert.ok(Math.abs(run.natural - run.accepted) < 0.1, `${label}: ${run.family} advance ${run.natural} differs from accepted ${run.accepted}`); } };

  const start = await page.evaluate(() => ({registry: window.registry.describeFaces().map(face => `${face.family}|${face.weight}|${face.italic}`), document: [...document.fonts].map(face => `${face.family.replace(/^"|"$/g, '')}|${Number(face.weight)}`), lazy: window.registry.lazyFonts.filter(face => face.package === 'host').length}));
  assert.deepEqual(start.registry, ['Roboto|400|false'], 'the registry starts with Roboto Regular only');
  assert.deepEqual(start.document, ['Roboto|400'], 'and so does the document');
  assert.equal(start.lazy, extras.length);
  assert.deepEqual(extraRequests, [], 'nothing is fetched until a document needs it');

  // A tampered file is refused: nothing is added, and the retry succeeds.
  const bold = indexOf('Roboto', 700);
  tampered.add(bold);
  const refusal = await page.evaluate(async () => { try { await window.registry.ensureLazyFonts(window.decks.plain); return 'loaded'; } catch (error) { return error.code; } });
  assert.equal(refusal, 'font-integrity-mismatch');
  const refused = await page.evaluate(() => ({registry: window.registry.describeFaces().length, document: document.fonts.size}));
  assert.deepEqual(refused, {registry: 1, document: 1}, 'a tampered face is neither registered nor added to the document');
  tampered.delete(bold);

  extraRequests.length = 0;
  const added = await page.evaluate(async () => (await window.registry.ensureLazyFonts(window.decks.plain)).map(face => `${face.family}|${face.weight}`));
  assert.deepEqual(added, ['Roboto|700']);
  assert.deepEqual(extraRequests, [bold], 'exactly Roboto Bold is fetched from the host');
  const plain = await state('plain');
  assert.deepEqual(plain.pending, []);
  assert.deepEqual(plain.registryFaces, plain.documentFaces, 'the registry and the document hold the same faces');
  assert.deepEqual(plain.registryFaces, ['Roboto|400|false', 'Roboto|700|false']);
  checkRuns('plain', plain);

  // One call loads a vendored face and the host's faces.
  extraRequests.length = 0;
  const before = await page.evaluate(() => window.registry.pendingLazyFonts(window.decks.mixed).map(face => face.package).sort());
  assert.ok(before.includes('host') && before.some(name => name !== 'host'), `the mixed deck needs a vendored and a host face: ${before}`);
  await page.evaluate(async () => window.registry.ensureLazyFonts(window.decks.mixed));
  assert.ok(extraRequests.includes(indexOf('Roboto Mono', 400)) && vendoredRequests.some(url => /^fonts\/intos\//.test(url)), 'both kinds are fetched by the one call');
  const mixed = await state('mixed');
  assert.deepEqual(mixed.pending, []);
  assert.deepEqual(mixed.registryFaces, mixed.documentFaces);
  checkRuns('mixed', mixed);
  await page.locator('main svg').screenshot({path: path.join(outputDirectory, 'mixed.png')});

  const count = extraRequests.length;
  await page.evaluate(async () => window.registry.ensureLazyFonts(window.decks.mixed));
  assert.equal(extraRequests.length, count, 'a second call fetches nothing');
  await page.evaluate(() => window.registry.dispose());
  assert.equal(await page.evaluate(() => document.fonts.size), 0, 'dispose removes every face, extra ones included');
  assert.deepEqual(unexpected, [], 'no request may leave the local routes');
  assert.deepEqual(errors, []);
  await writeFile(path.join(outputDirectory, 'report.json'), JSON.stringify({node: process.version, browser: browser.version(), extraFaces: extras.length, plainExtra: [bold], mixedVendored: vendoredRequests, runsPlain: plain.runs.length, runsMixed: mixed.runs.length, unexpected, errors}, null, 2) + '\n');
  console.log(`Extra lazy fonts browser: started with Roboto Regular; ${extras.length} host faces on demand; Roboto Bold alone for a plain deck, vendored and host faces in one call for an Aptos deck with code; tampered face refused; ${plain.runs.length + mixed.runs.length} runs within 0.1 px of the measured advances.`);
} finally { await browser.close(); }
