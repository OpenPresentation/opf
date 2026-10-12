// FF-46 (opf#362): every proprietary script, emoji, math and code-table name that passed the native visual comparison has its own
// fixture in the browser host. A page bundles the browser font loader and the SVG renderer, starts from the 33 eager office and base faces
// (the registry a browser host or the gallery editor starts with) and serves the pinned @expo-google-fonts files from local routes and
// nothing else. For each name of test/fixtures/script-name-families.json, with decks that name it (as every font-scheme slot; a code-table
// name as the run font) and draw its samples, it checks:
//   - pendingScripts names only packages the deck needs, ensureScripts fetches exactly their files (each hash-verified by the loader),
//     nothing else leaves the local routes, and afterwards the route faces are held and nothing is uncovered or pending;
//   - the name resolves to its policy route (a code table: the first face of its chain), as a visual substitute with the policy sizeAdjust;
//   - every run is drawn in the face of its script (the policy route, or the designated script face where the route lacks the script, as
//     for Sylfaen's Armenian and Georgian; for a code table, the chain face the fixture names for each code), a loaded FontFace backs it,
//     and its natural advance in the browser (the pin removed) equals the registry's accepted advance within 0.1 px (code tables are pinned
//     to the real font's advances, which test/symbol-fonts-browser.mjs checks per code);
//   - right-to-left samples display right to left, the glyphs paint ink, and the colour emoji face paints saturated pixels.
// It writes artifacts/script-name-hosts/browser.json. Offline: every other request is aborted.
import assert from 'node:assert/strict';
import {mkdir, readFile, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import sharp from 'sharp';
import * as coreSymbols from '@openpresentation/opf/symbol-font-encodings';
import {BUNDLED_FONT_MANIFEST, loadFonts} from '../dist/fonts-node.js';
import {loadCorpora} from '../scripts/script-corpora.mjs';
import {FULLWIDTH, expectedWeight, root, scriptFamilies, shortName} from './script-family-fixture.mjs';

const outputDirectory = path.resolve(root, process.argv[2] ?? 'artifacts/script-name-hosts');
await mkdir(outputDirectory, {recursive: true});
const table = JSON.parse(await readFile(path.join(root, 'test/fixtures/script-name-families.json'), 'utf8'));
const names = Object.keys(table.families).sort();
assert.equal(names.length, 22, `the fixture covers ${names.length} names`);
const rows = await scriptFamilies();
const rowOf = family => rows.find(row => row.family === family);
const symbolTables = new Map(coreSymbols.SYMBOL_FONT_ENCODINGS.families.map(entry => [entry.family, entry]));
const decodeUnicode = value => String.fromCodePoint(...value.split('+').map(part => parseInt(part, 16)));
const mappedText = (name, codes) => codes.split(' ').map(code => decodeUnicode(symbolTables.get(name).codes.find(item => item.code === parseInt(code, 16)).unicode)).join('');
const squash = text => text.replace(/[\s︎️⁦-⁩]+/g, '');
const packageOf = family => BUNDLED_FONT_MANIFEST.packages.find(pkg => pkg.faces.some(face => face.family === family));
const nameDeck = (name, sample) => ({
  $schema: 'https://openpresentation.org/schema/opf/v1', name: `Script name fixture ${name} ${sample.id}`, ...(sample.language ? {language: sample.language} : {}),
  design: {fontScheme: {name, major: name, minor: name, eastAsian: {major: name, minor: name}, complexScript: {major: name, minor: name}}},
  slides: [{id: 'a', title: sample.text, text: [{text: sample.text}, {text: sample.text, bold: true}]}],
});
const codeDeck = (name, sample) => {
  const text = sample.codes.split(' ').map(code => String.fromCharCode(0xF000 + parseInt(code, 16))).join('');
  return {$schema: 'https://openpresentation.org/schema/opf/v1', name: `Script name fixture ${name} ${sample.id}`, slides: [{id: 'a', text: [{text, fontFamily: name}, {text, fontFamily: name, bold: true}]}]};
};

const bundle = await build({
  stdin: {contents: "import {loadFonts as loadBrowserFonts} from './dist/fonts-browser.js';import {toSvg} from './dist/svg.js';window.opf={loadBrowserFonts,toSvg};", resolveDir: root, sourcefile: 'entry.js', loader: 'js'},
  bundle: true, platform: 'browser', format: 'iife', write: false, minify: true,
});
const script = bundle.outputFiles[0].text;
const eager = (await loadFonts({pack: 'office'})).registry.embeddedFonts.map((face, index) => ({index, family: face.family, weight: face.weight, italic: !!face.italic, bytes: Buffer.from(face.dataUrl.split(',')[1], 'base64')}));
assert.equal(eager.length, 33, 'the eager list is the 33 office and base faces');
const corpora = await loadCorpora();
const limits = new Map(corpora.fontkitFallbackLimits.flatMap(limit => Object.entries(limit.samples).map(([id, bound]) => [`${limit.family}|${id}`, bound])));
const ORIGIN = 'https://app.test', PACK = `${ORIGIN}/pack/`;
const packRequests = [], unexpected = [], errors = [], notGatedOnLinux = [];

const browser = await chromium.launch({channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined});
const report = [];
let runChecks = 0;
try {
  const page = await browser.newPage({viewport: {width: 1300, height: 760}});
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route(/^https?:/, async route => {
    const url = route.request().url();
    if (url === `${ORIGIN}/`) return route.fulfill({status: 200, contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><main style="margin:0"></main>'});
    const eagerMatch = /^https:\/\/app\.test\/eager\/(\d+)\.ttf$/.exec(url);
    if (eagerMatch) return route.fulfill({status: 200, contentType: 'font/ttf', body: eager[Number(eagerMatch[1])].bytes});
    if (url.startsWith(PACK)) {
      const file = url.slice(PACK.length);
      packRequests.push(file);
      try { return await route.fulfill({status: 200, contentType: 'font/ttf', body: await readFile(path.join(root, 'node_modules/@expo-google-fonts', file))}); } catch { return route.fulfill({status: 404}); }
    }
    unexpected.push(url); return route.abort();
  });
  await page.goto(`${ORIGIN}/`);
  await page.addScriptTag({content: script});
  await page.evaluate(async ({eager}) => {
    window.registry = (await window.opf.loadBrowserFonts({faces: eager.map(face => ({url: `/eager/${face.index}.ttf`, family: face.family, weight: face.weight, italic: face.italic})), substitutionPolicy: 'visual', fallbackFamily: 'Roboto', scriptBaseUrl: `${location.origin}/pack/`})).registry;
  }, {eager: eager.map(({bytes, ...rest}) => rest)});

  const loaded = new Set();
  for (const name of names) {
    const entry = table.families[name];
    const codeTable = entry.kind === 'code-table';
    const row = {family: name, kind: entry.kind, route: entry.route, ...(entry.sizeAdjust ? {sizeAdjust: entry.sizeAdjust} : {}), scripts: [], files: [], samples: [], fetched: [], runs: 0};
    for (const script of entry.scripts) {
      const faces = codeTable ? Object.keys(script.faces) : [script.route];
      const faceOf = new Map();
      if (codeTable) for (const [face, codes] of Object.entries(script.faces)) for (const code of codes.split(' ')) for (const character of mappedText(name, code)) faceOf.set(character, [...(faceOf.get(character) ?? []), face]);
      for (const sample of script.samples) {
        const where = `${name} ${sample.id}`;
        const deck = codeTable ? codeDeck(name, sample) : nameDeck(name, sample);
        const pending = await page.evaluate(deck => window.registry.pendingScripts(deck), deck);
        const before = packRequests.length;
        const ensured = await page.evaluate(async deck => { const result = await window.registry.ensureScripts(deck); return {loaded: result.loaded, uncovered: result.uncovered}; }, deck);
        const fetched = packRequests.slice(before);
        assert.deepEqual([...ensured.loaded].sort(), [...pending].sort(), `${where}: ensureScripts loads the packages pendingScripts named`);
        assert.ok(pending.every(item => !loaded.has(item)), `${where}: nothing already loaded is pending`);
        for (const item of ensured.loaded) loaded.add(item);
        assert.ok(fetched.every(file => ensured.loaded.some(item => file.startsWith(`${shortName(item)}/`))), `${where}: only the files of the loaded packages are fetched (${fetched.join(', ')})`);
        assert.deepEqual(await page.evaluate(deck => window.registry.pendingScripts(deck), deck), [], `${where}: nothing is pending after loading`);
        assert.deepEqual(ensured.uncovered ?? [], [], `${where}: the loaded faces cover the drawn characters`);
        row.fetched.push(...fetched);
        const observed = await page.evaluate(async ({deck, name, faces}) => {
          const registry = window.registry, {toSvg} = window.opf;
          const resolved = [400, 700].map(weight => { const r = registry.resolveFont({fontFamily: name, fontWeight: weight, italic: false}); return {weight, family: r.resolvedFamily, resolvedWeight: r.resolvedWeight, compatibility: r.compatibility, substitute: r.substitute, sizeAdjust: r.sizeAdjust ?? null, symbolEncoding: r.symbolEncoding ?? null}; });
          const held = faces.filter(family => registry.describeFaces().some(face => face.family === family));
          const host = document.querySelector('main');
          host.innerHTML = toSvg(deck, 1, {fonts: {textMeasurement: registry.textMeasurement}});
          await document.fonts.ready;
          const clean = value => value.split(',')[0].trim().replace(/^["']|["']$/g, '');
          const documentFaces = [...document.fonts].map(face => ({family: clean(face.family), weight: Number(face.weight), status: face.status}));
          const svgElement = host.querySelector('svg'), svgBox = svgElement.getBoundingClientRect(), scale = svgBox.width / svgElement.viewBox.baseVal.width;
          const runs = [...host.querySelectorAll('text, tspan')].filter(element => !element.querySelector('tspan') && element.textContent.trim()).map(element => {
            const owner = element.closest('text'), get = attribute => element.getAttribute(attribute) ?? element.parentElement?.closest('[font-family]')?.getAttribute(attribute) ?? owner.getAttribute(attribute);
            const runFamily = clean(get('font-family') ?? ''), weight = Number(get('font-weight') ?? 400), size = Number(get('font-size'));
            const accepted = element.hasAttribute('textLength') ? Number(element.getAttribute('textLength')) : null;
            const box = element.getBBox();
            const letters = [...element.textContent].map((character, index) => [character, index]).filter(([character]) => !/[⁦-⁩]/.test(character));
            const order = letters.length > 1 ? [element.getStartPositionOfChar(letters[0][1]).x, element.getStartPositionOfChar(letters.at(-1)[1]).x] : null;
            if (accepted !== null) element.removeAttribute('textLength');
            const natural = element.getComputedTextLength();
            const loadedFace = documentFaces.some(face => face.family === runFamily && face.status === 'loaded');
            return {text: element.textContent, family: runFamily, weight, size, accepted, natural, faceLoaded: loadedFace, order, box: {x: svgBox.left + box.x * scale, y: svgBox.top + box.y * scale, width: box.width * scale, height: box.height * scale}};
          });
          host.innerHTML = toSvg(deck, 1, {fonts: {textMeasurement: registry.textMeasurement}});
          await document.fonts.ready;
          return {resolved, held, runs, pendingAfter: registry.pendingScripts(deck)};
        }, {deck, name, faces});
        assert.deepEqual(observed.pendingAfter, [], `${where}: nothing is pending after drawing`);
        assert.deepEqual(observed.held, faces, `${where}: the registry holds ${faces.join(', ')}`);
        for (const got of observed.resolved) {
          assert.equal(got.family, entry.route, `${where} ${got.weight}: resolves to ${entry.route}, not ${got.family}`);
          assert.equal(got.substitute, true, `${where}: a substitute`);
          assert.equal(got.compatibility, 'visual', `${where}: visual`);
          if (codeTable) assert.equal(got.symbolEncoding, name, `${where}: carries the encoding`);
          else {
            assert.equal(got.resolvedWeight, expectedWeight(rowOf(entry.route), got.weight >= 600), `${where} ${got.weight}: the route's nearest weight`);
            assert.equal(got.sizeAdjust, entry.sizeAdjust ?? null, `${where}: the policy sizeAdjust`);
          }
        }
        const runs = observed.runs;
        assert.ok(runs.length >= (codeTable ? 2 : 3), `${where}: the deck draws its runs (${runs.length})`);
        const bound = limits.get(`${script.route}|${sample.id}`);
        for (const run of runs) {
          const label = `${where}: "${[...run.text].slice(0, 12).join('')}"`;
          if (codeTable) for (const character of squash(run.text)) assert.ok(faceOf.get(character)?.includes(run.family), `${label}: ${character} is drawn in ${faceOf.get(character)?.join(' or ')}, not ${run.family}`);
          else assert.equal(run.family, script.route, `${label} is drawn in ${script.route}, not ${run.family}`);
          assert.ok(run.faceLoaded, `${label}: a loaded FontFace backs ${run.family}`);
          if (!codeTable) {
            assert.ok(run.accepted !== null, `${label}: pinned to an accepted advance`);
            const delta = Math.abs(run.natural - run.accepted);
            // Linux Chromium (the pinned Playwright image) paints fullwidth punctuation lines differently from Edge and macOS Chromium: recorded, not gated there.
            if (process.platform === 'linux' && FULLWIDTH.test(run.text)) notGatedOnLinux.push({family: name, sample: sample.id, delta: Number(delta.toFixed(3))});
            else if (bound === undefined) assert.ok(delta < 0.1, `${label}: advance ${run.natural} differs from accepted ${run.accepted}`);
            else assert.ok(delta <= bound * run.size / 100 + 0.1, `${label}: the recorded limit ${bound} (at 100 px) no longer bounds ${delta.toFixed(3)} px at ${run.size} px`);
            if (sample.rtl && run.order) assert.ok(run.order[0] > run.order[1], `${label}: a right-to-left run displays right to left`);
          }
          runChecks += 1;
        }
        if (codeTable) { const mapped = squash(mappedText(name, sample.codes)); assert.equal(squash(runs.map(run => run.text).join('')), mapped + mapped, `${where}: every code is drawn, regular and bold`); }
        else assert.ok(runs.some(run => squash(run.text) === squash(sample.text)), `${where}: a run carries the whole sample`);
        // Paint: the first drawn line has ink, and the colour emoji face paints saturated pixels.
        const first = codeTable ? runs.reduce((box, run) => ({x: Math.min(box.x, run.box.x), y: Math.min(box.y, run.box.y), right: Math.max(box.right, run.box.x + run.box.width), bottom: Math.max(box.bottom, run.box.y + run.box.height)}), {x: Infinity, y: Infinity, right: 0, bottom: 0}) : null;
        const target = first ? {x: first.x, y: first.y, width: first.right - first.x, height: first.bottom - first.y} : (runs.find(run => run.size === Math.max(...runs.map(item => item.size))) ?? runs[0]).box;
        const clip = {x: Math.max(0, Math.floor(target.x)), y: Math.max(0, Math.floor(target.y)), width: Math.max(1, Math.ceil(target.width)), height: Math.max(1, Math.ceil(target.height))};
        const {data, info} = await sharp(await page.screenshot({clip})).raw().toBuffer({resolveWithObject: true});
        const counts = new Map();
        for (let i = 0; i < data.length; i += info.channels) { const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]; counts.set(key, (counts.get(key) ?? 0) + 1); }
        const background = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0], bg = [background >> 16 & 255, background >> 8 & 255, background & 255];
        let ink = 0, saturated = 0;
        for (let i = 0; i < data.length; i += info.channels) {
          if (Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) < 60) continue;
          ink++;
          if (Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]) > 60) saturated++;
        }
        assert.ok(ink > 100, `${where}: the drawn text paints ink (${ink} px)`);
        if (script.route === 'Noto Color Emoji') assert.ok(saturated > 50, `${where}: drawn in colour (${saturated} saturated px)`);
        if (process.env.SCRIPT_SCREENSHOTS) await page.locator('main svg').screenshot({path: path.join(outputDirectory, `${name.replace(/[^A-Za-z0-9]+/g, '-')}-${sample.id}.png`)});
        row.samples.push(sample.id);
        row.runs += runs.length;
      }
      for (const family of faces) for (const face of packageOf(family).faces) if (face.family === family) { const file = `${shortName(packageOf(family).name)}/${face.file}`; if (!row.files.includes(file) && (family !== 'Noto Sans' || face.weight === 400 && !face.italic)) row.files.push(file); }
      row.scripts.push({script: script.script, route: script.route, via: script.via, samples: script.samples.map(sample => sample.id)});
    }
    row.fetchedNow = [...new Set(row.fetched)].length;
    row.lazyBytes = (await Promise.all(row.files.map(async file => { try { return (await stat(path.join(root, 'node_modules/@expo-google-fonts', file))).size; } catch { return 0; } }))).reduce((a, b) => a + b, 0);
    report.push(row);
  }
  assert.deepEqual(unexpected, [], 'no request may leave the local routes');
  assert.deepEqual(errors, []);
  const total = new Set(packRequests);
  assert.equal(total.size, packRequests.length, 'no file is fetched twice');
  const bytes = (await Promise.all([...total].map(async file => (await stat(path.join(root, 'node_modules/@expo-google-fonts', file))).size))).reduce((a, b) => a + b, 0);
  await writeFile(path.join(outputDirectory, 'browser.json'), `${JSON.stringify({node: process.version, browser: browser.version(), bundleBytes: script.length, families: report.length, platform: process.platform, runsNotGatedOnLinux: notGatedOnLinux, findings: [], filesFetchedInTotal: total.size, bytesFetchedInTotal: bytes, runChecks, report}, null, 1)}\n`);
  console.log(`Script name hosts (browser): ${report.length} proprietary names drawn in their route faces; the registry fetched ${total.size} pinned files (${(bytes / 1048576).toFixed(1)} MiB) on demand; ${runChecks} runs checked.`);
} finally { await browser.close(); }
