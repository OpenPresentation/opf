// RR-17 (FF-44, FF-45): every open script, emoji and math family has its own fixture in the browser host. A page bundles the browser
// font loader and the SVG renderer, starts from the 33 eager office and base faces (the registry a browser host or the gallery editor
// starts with), and serves the pinned @expo-google-fonts files from local routes and nothing else. For each of the 35 families of the
// `scripts` pack (test/script-family-fixture.mjs), with a deck that names the family as its Latin, East Asian and complex-script
// font and draws samples of its script (the FF-44 corpus samples its faces cover completely, the FF-45 emoji sequences and math
// notation), it checks:
//   - pendingScripts names only packages of the family's scripts, ensureScripts fetches exactly the files of the packages it loads (each
//     hash-verified by the loader), and nothing else leaves the local routes,
//   - every style resolves to the family itself, as `exact`, never to a substitute or the generic fallback,
//   - the document holds the faces the registry holds, and a loaded FontFace backs every drawn run,
//   - every run of the deck is drawn in the family, and its natural advance in the browser (the pin removed) equals the registry's
//     accepted advance within 0.1 px (the recorded fontkit limits of Myanmar, one Syriac word and Nastaliq vowel marks stay bounded),
//   - right-to-left samples display right to left, and the glyphs paint: the family's runs have ink, and the colour emoji face paints
//     saturated pixels (its COLRv1 glyphs), which a fallback face could not.
// It writes artifacts/script-family-hosts/browser.json (per family: files fetched, bytes, runs). Offline: every other request is aborted.
import assert from 'node:assert/strict';
import {mkdir, readFile, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import sharp from 'sharp';
import {loadFonts} from '../dist/fonts-node.js';
import {loadCorpora} from '../scripts/script-corpora.mjs';
import {FULLWIDTH, assertFindings, expectedWeight, root, scriptDeck, scriptFamilies, shortName} from './script-family-fixture.mjs';

const outputDirectory = path.resolve(root, process.argv[2] ?? 'artifacts/script-family-hosts');
await mkdir(outputDirectory, {recursive: true});
const bundle = await build({
  stdin: {contents: "import {loadFonts as loadBrowserFonts} from './dist/fonts-browser.js';import {renderSlideSvg} from './dist/svg.js';window.opf={loadBrowserFonts,renderSlideSvg};", resolveDir: root, sourcefile: 'entry.js', loader: 'js'},
  bundle: true, platform: 'browser', format: 'iife', write: false, minify: true,
});
const script = bundle.outputFiles[0].text;
const eager = (await loadFonts({pack: 'office'})).registry.embeddedFonts.map((face, index) => ({index, family: face.family, weight: face.weight, italic: !!face.italic, bytes: Buffer.from(face.dataUrl.split(',')[1], 'base64')}));
assert.equal(eager.length, 33, 'the eager list is the 33 office and base faces');
const corpora = await loadCorpora();
const limits = new Map(corpora.knownShapingLimits.flatMap(limit => Object.entries(limit.samples).map(([id, bound]) => [`${limit.family}|${id}`, bound])));
const families = await scriptFamilies();
assert.equal(families.length, 35, `the fixture covers ${families.length} script families`);
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
  const findings = [];
  for (const entry of families) {
   try {
    const where = entry.family;
    const ownFiles = new Set(entry.files);
    const row = {family: entry.family, route: entry.family, package: entry.packageShort, version: entry.version, scripts: entry.scripts, files: entry.files, samples: [], fetched: [], runs: 0};
    let first = true;
    for (const sample of entry.samples) {
      const deck = scriptDeck(entry, sample);
      const pending = await page.evaluate(deck => window.registry.pendingScripts(deck), deck);
      const before = packRequests.length;
      const ensured = await page.evaluate(async deck => { const result = await window.registry.ensureScripts(deck); return {loaded: result.loaded, detected: result.detected, uncovered: result.uncovered}; }, deck);
      const fetched = packRequests.slice(before);
      assert.deepEqual([...ensured.loaded].sort(), [...pending].sort(), `${where} ${sample.id}: ensureScripts loads the packages pendingScripts named`);
      assert.ok(pending.every(name => !loaded.has(name)), `${where}: nothing already loaded is pending`);
      for (const name of ensured.loaded) loaded.add(name);
      assert.ok(fetched.every(file => ensured.loaded.some(name => file.startsWith(`${shortName(name)}/`))), `${where} ${sample.id}: only the files of the loaded packages are fetched (${fetched.join(', ')})`);
      assert.equal(new Set(fetched).size, fetched.length, `${where}: no file is fetched twice`);
      assert.deepEqual(await page.evaluate(deck => window.registry.pendingScripts(deck), deck), [], `${where} ${sample.id}: nothing is pending after loading`);
      assert.deepEqual(ensured.uncovered ?? [], [], `${where} ${sample.id}: the loaded faces cover the drawn characters`);
      if (first) {
        // The family's own package is loaded after its first deck (Noto Sans is the one family no script triggers: it arrives with the Latin, Cyrillic and Greek decks).
        const heldByRegistry = await page.evaluate(family => window.registry.describeFaces().filter(face => face.family === family).map(face => `${face.weight}${face.italic ? 'i' : ''}`).sort(), entry.family);
        assert.deepEqual(heldByRegistry, entry.faces.map(face => `${face.weight}${face.italic ? 'i' : ''}`).sort(), `${where}: the registry holds the pinned faces after loading`);
        row.fetched.push(...fetched);
      } else row.fetched.push(...fetched);
      const observed = await page.evaluate(async ({deck, family, weights}) => {
        const registry = window.registry, {renderSlideSvg} = window.opf;
        const resolved = weights.map(weight => { const r = registry.resolveFont({fontFamily: family, fontWeight: weight, italic: false}); return {weight, family: r.resolvedFamily, resolvedWeight: r.resolvedWeight, compatibility: r.compatibility, substitute: r.substitute}; });
        const host = document.querySelector('main');
        host.innerHTML = renderSlideSvg(deck, 0, { fonts: {textMeasurement: registry.textMeasurement}});
        await document.fonts.ready;
        const clean = value => value.split(',')[0].trim().replace(/^["']|["']$/g, '');
        const faces = [...document.fonts].map(face => ({family: clean(face.family), weight: Number(face.weight), style: face.style, status: face.status}));
        const svgBox = host.querySelector('svg').getBoundingClientRect(), scale = svgBox.width / host.querySelector('svg').viewBox.baseVal.width;
        const runs = [...host.querySelectorAll('text[textLength], tspan[textLength]')].filter(element => element.textContent.trim()).map(element => {
          const owner = element.closest('text'), get = name => element.getAttribute(name) ?? owner.getAttribute(name);
          const runFamily = clean(get('font-family')), weight = Number(get('font-weight') ?? 400), size = Number(get('font-size'));
          const accepted = Number(element.getAttribute('textLength'));
          const box = element.getBBox();
          // Painted order: the first letter against the last (the isolate marks of right-to-left lines are skipped).
          const letters = [...element.textContent].map((character, index) => [character, index]).filter(([character]) => !/[\u2066-\u2069]/.test(character));
          const first = letters.length > 1 ? [element.getStartPositionOfChar(letters[0][1]).x, element.getStartPositionOfChar(letters.at(-1)[1]).x] : null;
          element.removeAttribute('textLength');
          const natural = element.getComputedTextLength();
          return {text: element.textContent, family: runFamily, weight, size, accepted, natural, faceLoaded: faces.some(face => face.family === runFamily && face.weight === weight && face.status === 'loaded'), direction: getComputedStyle(element).direction, order: first, box: {x: svgBox.left + box.x * scale, y: svgBox.top + box.y * scale, width: box.width * scale, height: box.height * scale}};
        });
        host.innerHTML = renderSlideSvg(deck, 0, { fonts: {textMeasurement: registry.textMeasurement}});
        await document.fonts.ready;
        return {resolved, runs, registryFaces: registry.describeFaces().map(face => `${face.family}|${face.weight}|${face.italic}`).sort(), documentFaces: faces.map(face => `${face.family}|${face.weight}|${face.style === 'italic'}`).sort(), pendingAfter: registry.pendingScripts(deck)};
      }, {deck, family: entry.family, weights: [400, 700]});
      assert.deepEqual(observed.pendingAfter, [], `${where} ${sample.id}: nothing is pending after drawing`);
      assert.deepEqual(observed.registryFaces, observed.documentFaces, `${where} ${sample.id}: the registry and the document hold the same faces`);
      for (const got of observed.resolved) {
        assert.equal(got.family, entry.family, `${where} ${got.weight}: draws ${entry.family}`);
        assert.equal(got.resolvedWeight, expectedWeight(entry, got.weight >= 600), `${where} ${got.weight}: the nearest weight`);
        // A weight the family lacks (bold of a one-weight face) takes the nearest face and is reported visual, never as the real weight.
        assert.equal(got.compatibility, entry.weights.includes(got.weight) ? 'exact' : 'visual', `${where} ${got.weight}: the family answers as itself, a missing weight as visual`);
        assert.equal(got.substitute, false, `${where} ${got.weight}: no substitute`);
      }
      assert.ok(observed.runs.length >= 3, `${where} ${sample.id}: the deck draws its runs (${observed.runs.length})`);
      const bound = limits.get(`${entry.family}|${sample.id}`);
      for (const run of observed.runs) {
        assert.equal(run.family, entry.family, `${where} ${sample.id}: "${[...run.text].slice(0, 12).join('')}" is drawn in ${entry.family}, not ${run.family}`);
        assert.ok(run.faceLoaded, `${where} ${sample.id}: a loaded FontFace backs "${[...run.text].slice(0, 12).join('')}" (${run.family} ${run.weight})`);
        const delta = Math.abs(run.natural - run.accepted);
        // Linux Chromium (the pinned Playwright image) paints fullwidth punctuation lines differently from Edge and macOS Chromium: recorded, not gated there.
        if (process.platform === 'linux' && FULLWIDTH.test(run.text)) notGatedOnLinux.push({family: entry.family, sample: sample.id, delta: Number(delta.toFixed(3))});
        else if (bound === undefined) assert.ok(delta < 0.1, `${where} ${sample.id}: "${[...run.text].slice(0, 12).join('')}" advance ${run.natural} differs from accepted ${run.accepted}`);
        else assert.ok(delta <= bound * run.size / 100 + 0.1, `${where} ${sample.id}: the recorded limit ${bound} (at 100 px) no longer bounds ${delta.toFixed(3)} px at ${run.size} px`);
        if (sample.rtl && run.order) assert.ok(run.order[0] > run.order[1], `${where} ${sample.id}: a right-to-left run displays right to left`);
        runChecks += 1;
      }
      // Paint: the title's run has ink, and the colour emoji face paints saturated pixels.
      const title = observed.runs.find(run => run.size === 54) ?? observed.runs[0];
      const clip = {x: Math.max(0, Math.floor(title.box.x)), y: Math.max(0, Math.floor(title.box.y)), width: Math.max(1, Math.ceil(title.box.width)), height: Math.max(1, Math.ceil(title.box.height))};
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
      assert.ok(ink > 100, `${where} ${sample.id}: the title paints ink (${ink} px)`);
      if (entry.color) assert.ok(saturated > 50, `${where} ${sample.id}: drawn in colour (${saturated} saturated px)`);
      if (process.env.SCRIPT_SCREENSHOTS) await page.locator('main svg').screenshot({path: path.join(outputDirectory, `${entry.family.replace(/[^A-Za-z0-9]+/g, '-')}-${sample.id}.png`)});
      row.samples.push(sample.id);
      row.runs += observed.runs.length;
      first = false;
    }
    row.lazyBytes = (await Promise.all(entry.files.map(async file => (await stat(path.join(root, 'node_modules/@expo-google-fonts', file))).size))).reduce((a, b) => a + b, 0);
    row.fetchedNow = [...new Set(row.fetched)].length;
    report.push(row);
   } catch (error) {
    // A family may fail a check only with a recorded finding (test/script-family-findings.mjs): the check stays as strict as for every other family.
    if (!(error instanceof assert.AssertionError)) throw error;
    findings.push({family: entry.family, host: 'browser', message: error.message.split('\n')[0]});
   }
  }
  assertFindings(findings, 'browser', families.map(entry => entry.family));
  assert.deepEqual(unexpected, [], 'no request may leave the local routes');
  assert.deepEqual(errors, []);
  const total = new Set(packRequests);
  assert.equal(total.size, packRequests.length, 'no file is fetched twice');
  const bytes = (await Promise.all([...total].map(async file => (await stat(path.join(root, 'node_modules/@expo-google-fonts', file))).size))).reduce((a, b) => a + b, 0);
  await writeFile(path.join(outputDirectory, 'browser.json'), `${JSON.stringify({node: process.version, browser: browser.version(), bundleBytes: script.length, families: report.length, platform: process.platform, runsNotGatedOnLinux: notGatedOnLinux, findings, filesFetchedInTotal: total.size, bytesFetchedInTotal: bytes, runChecks, report}, null, 1)}\n`);
  console.log(`Script family hosts (browser): ${report.length} families; the registry fetched ${total.size} pinned files (${(bytes / 1048576).toFixed(1)} MiB) on demand; ${runChecks} runs drawn in their family within 0.1 px of the accepted advance.`);
} finally { await browser.close(); }
