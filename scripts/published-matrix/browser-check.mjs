// FF-10: headless-browser preview re-render of the published packages, on every OS (RR-04).
//
//   node scripts/published-matrix/browser-check.mjs [--consumer dir] [--out dir]
//
// Renders self-contained SVG previews with the published renderer (the registry's own faces embedded as @font-face), loads
// each in headless Chromium and checks, per OS:
//   * every font family the preview draws is a loaded FontFace from the SVG itself, so no host font is involved;
//   * the drawn families are the ones the chosen font scheme resolves to, and switching the scheme A -> B -> A re-renders:
//     different SVG, different drawn families, different pixels, and A again reproduces A's pixels in the same browser;
//   * on Linux a second browser launched with host fonts reduced to one unrelated face draws with the same embedded faces.
// Pixel hashes are recorded for the evidence but never compared across operating systems: Chromium rasterizes text
// differently on each (on macOS only the families and the re-render are asserted, as the FF-10 criteria say).
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const core = path.resolve(here, '..', '..');
const argv = process.argv.slice(2);
const option = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
const consumer = path.resolve(option('--consumer', path.join(core, 'artifacts', 'published-matrix', 'consumer')));
const outDir = path.resolve(option('--out', path.join(core, 'artifacts', 'published-matrix', 'out')));
const {loadFonts, toSvg, createScriptTextMeasurement, resolveScriptFonts, defaultCatalog} = await import(pathToFileURL(path.join(consumer, 'engines-installed.mjs')).href);
const {chromium} = createRequire(path.join(consumer, 'package.json'))('playwright');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const fonts = await loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'all'});
const TEXT = {title: 'Quarterly review', body: 'Revenue grew while costs stayed flat across every region', code: 'const score = urgency * confidence;'};
const deckFor = (scheme) => ({
  name: `browser ${scheme}`,
  language: 'en',
  design: {theme: 'minimal', fontScheme: scheme},
  slides: [
    {id: 'a', title: TEXT.title, text: TEXT.body},
    {id: 'b', layout: 'code-1x', title: TEXT.title, code: {source: TEXT.code, language: 'ts'}, text: TEXT.body}
  ]
});
// Only the faces the three schemes draw with are embedded (the registry holds 33, 12 MB of base64 per slide).
const embedded = fonts.registry.selectEmbeddedFonts((face) => ['Carlito', 'Gelasio', 'Cousine', 'Roboto Mono'].includes(face.family));
assert.ok(embedded.length >= 6, 'the registry holds the faces the schemes draw with');
function render(scheme) {
  const deck = deckFor(scheme);
  // OPF 0.15: the host registers the published default catalog (the deck names the minimal theme and gallery font schemes).
  const catalogs = [defaultCatalog];
  return toSvg(deck, {catalogs, fonts: {embeddedFonts: embedded, textMeasurement: createScriptTextMeasurement(fonts.textMeasurement, resolveScriptFonts(deck, {catalogs}))}});
}
const SCHEMES = ['calibri', 'georgia', 'consolas'];
const svgs = Object.fromEntries(SCHEMES.map((scheme) => [scheme, render(scheme)]));
for (const scheme of SCHEMES) for (const svg of svgs[scheme]) assert.ok(/@font-face/.test(svg), `${scheme}: the preview embeds the faces it draws`);

// Linux without host fonts: a fontconfig whose only font is one face the previews never draw. A fontconfig with no font at all
// breaks Chromium's web font decoding (every embedded face rejects with a NetworkError), so a single unrelated face is the
// emptiest host that still lets the browser run.
const hostFonts = path.join(tmpdir(), `opf-host-fonts-${process.pid}`);
mkdirSync(path.join(hostFonts, 'fonts'), {recursive: true});
copyFileSync(path.join(consumer, 'node_modules', '@expo-google-fonts', 'noto-sans', '400Regular', 'NotoSans_400Regular.ttf'), path.join(hostFonts, 'fonts', 'NotoSans-Regular.ttf'));
writeFileSync(path.join(hostFonts, 'fonts.conf'), `<?xml version="1.0"?><fontconfig><dir>${path.join(hostFonts, 'fonts')}</dir><cachedir>${path.join(hostFonts, 'cache')}</cachedir></fontconfig>\n`);

async function observe(browser, scheme, slide) {
  const page = await browser.newPage({viewport: {width: 1280, height: 720}});
  await page.setContent(`<!doctype html><body style="margin:0;background:#fff">${svgs[scheme][slide]}</body>`);
  const state = await page.evaluate(async () => {
    // Faces load lazily, when text first needs them: load the faces of every family the text draws in, then wait for the font set.
    const drawn = [...new Set([...document.querySelectorAll('svg text')].map((node) => getComputedStyle(node).fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '')))].sort();
    const failures = [];
    for (const face of document.fonts) {
      if (!drawn.includes(face.family.replace(/^["']|["']$/g, ''))) continue;
      try {
        await face.load();
      } catch (error) {
        failures.push(`${face.family} ${face.weight} ${face.style}: ${error.name} ${error.message}`);
      }
    }
    await document.fonts.ready;
    const loaded = [...document.fonts].filter((face) => face.status === 'loaded').map((face) => face.family.replace(/^["']|["']$/g, ''));
    return {loaded: [...new Set(loaded)].sort(), drawn, text: document.querySelectorAll('svg text').length, statuses: [...document.fonts].map((face) => `${face.family}:${face.weight}:${face.style}:${face.status}`), failures};
  });
  const png = await page.screenshot({type: 'png'});
  await page.close();
  return {...state, png: sha256(png)};
}
async function pass(label, env) {
  const browser = await chromium.launch({env: {...process.env, ...env}});
  try {
    const version = browser.version();
    const states = {};
    for (const [scheme, slide] of [['calibri', 0], ['georgia', 0], ['calibri', 0], ['consolas', 1], ['calibri', 1]]) {
      const key = `${scheme}#${slide}`;
      const first = states[key] === undefined;
      const state = await observe(browser, scheme, slide);
      if (first) states[key] = state;
      else assert.equal(state.png, states[key].png, `${label}: ${key} drew the same pixels on a second render`);
    }
    // The preview draws the family its scheme resolves to, and only loaded embedded faces.
    for (const [key, state] of Object.entries(states)) {
      assert.ok(state.text > 0, `${label}: ${key} has text`);
      assert.deepEqual(state.failures, [], `${label}: ${key} embedded faces failed to load`);
      for (const family of state.drawn) assert.ok(state.loaded.includes(family), `${label}: ${key} draws ${family}, which is not an embedded face (loaded: ${state.loaded}; all faces: ${state.statuses})`);
    }
    assert.ok(states['calibri#0'].drawn.includes('Carlito'), `${label}: Calibri previews with Carlito`);
    assert.ok(states['georgia#0'].drawn.includes('Gelasio'), `${label}: Georgia previews with Gelasio`);
    assert.ok(states['consolas#1'].drawn.includes('Cousine'), `${label}: Consolas previews with Cousine`);
    // Switching A -> B re-rendered: other SVG, other families, other pixels.
    assert.notEqual(svgs.calibri[0], svgs.georgia[0], `${label}: the SVG changed with the scheme`);
    assert.notDeepEqual(states['calibri#0'].drawn, states['georgia#0'].drawn, `${label}: the drawn families changed`);
    assert.notEqual(states['calibri#0'].png, states['georgia#0'].png, `${label}: the pixels changed`);
    return {label, browser: version, states};
  } finally {
    await browser.close();
  }
}

const runs = [await pass('default host fonts', {})];
if (process.platform === 'linux') {
  // Host fonts reduced to one unrelated face: anything not embedded would draw with it or not at all.
  const bare = await pass('minimal host fonts (fontconfig with one unrelated face)', {FONTCONFIG_FILE: path.join(hostFonts, 'fonts.conf'), FONTCONFIG_PATH: hostFonts, XDG_DATA_DIRS: hostFonts, XDG_DATA_HOME: hostFonts});
  // The same faces draw in both browsers. Pixels are recorded, not asserted: Chromium takes hinting and anti-aliasing from the host
  // fontconfig, and this reduced one does not carry the distribution's rendering settings.
  for (const [key, state] of Object.entries(runs[0].states)) {
    assert.deepEqual(bare.states[key].drawn, state.drawn, `${key}: the same families draw with minimal host fonts`);
    assert.deepEqual(bare.states[key].loaded, state.loaded, `${key}: the same embedded faces load with minimal host fonts`);
    bare.states[key].pixelsEqualToDefaultHost = bare.states[key].png === state.png;
  }
  runs.push(bare);
}
mkdirSync(outDir, {recursive: true});
writeFileSync(path.join(outDir, 'browser.json'), `${JSON.stringify({test: 'published-browser', platform: process.platform, arch: process.arch, runs}, null, 1)}\n`);
console.log(JSON.stringify({test: 'published-browser', platform: process.platform, runs: runs.map((run) => ({label: run.label, browser: run.browser, states: Object.keys(run.states).length}))}));
