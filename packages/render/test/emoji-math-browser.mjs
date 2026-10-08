// FF-45 in an offline browser (Chromium; Edge on Windows): the pinned Noto Color Emoji draws emoji in colour from its COLRv1
// table, every emoji sequence (ZWJ family, flag, skin tone, keycap, tag sequence, VS16) is one glyph whose natural advance
// equals the fontkit advance the SVG pins with textLength, and STIX Two Math runs of a Cambria Math deck advance as measured.
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import * as core from '@openpresentation/opf/composition';
import {renderSlideSvg, catalogs} from './catalog-harness.mjs'; // FA-23: registers the gallery snapshot (the documents name gallery records)
import {loadFonts} from '../dist/fonts-node.js';
import {createScriptTextMeasurement} from '../dist/fonts.js';

const EMOJI = {
  rocket: '\u{1F680}', family: '\u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F466}', flag: '\u{1F1E9}\u{1F1EA}', thumbsMedium: '\u{1F44D}\u{1F3FD}',
  keycap: '1️⃣', heartVS16: '❤️', scotland: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}', womanTechnologist: '\u{1F469}\u{1F3FE}‍\u{1F4BB}',
};
const NOTO_COLOR_EMOJI_ADVANCE = 1.2451;
const prepared = await loadFonts({pack: 'office', scripts: ['Zsye', 'Zmth']}), {registry} = prepared;
const deck = (id, title, design) => ({$schema: 'https://openpresentation.org/schema/opf/v1', name: `FF-45 ${id}`, slides: [{title, text: 'Body'}], ...(design ? {design} : {})});
const render = document => renderSlideSvg(document, 0, { fonts: {...prepared, textMeasurement: createScriptTextMeasurement(registry.textMeasurement, core.resolveScriptFonts(document, {catalogs}))}});
const cases = [
  {id: 'emoji-latin', document: deck('emoji-latin', `Launch ${EMOJI.rocket} ${EMOJI.family} ${EMOJI.flag} ${EMOJI.thumbsMedium}`)},
  {id: 'emoji-sequences', document: deck('emoji-sequences', `${EMOJI.keycap} ${EMOJI.heartVS16} ${EMOJI.scotland} ${EMOJI.womanTechnologist}`)},
  {id: 'segoe-ui-emoji', document: deck('segoe-ui-emoji', `Score 42 ${EMOJI.rocket}${EMOJI.family}`, {fontScheme: {id: 'aptos', heading: 'Segoe UI Emoji', body: 'Segoe UI Emoji'}})},
  {id: 'cambria-math', document: deck('cambria-math', '∑ ∫ √ \u{1D44E}\u{1D44F} ℝ ≤ ∞ αβ', {fontScheme: {id: 'aptos', heading: 'Cambria Math', body: 'Cambria Math'}})},
].map(item => ({...item, svg: render(item.document)}));

// Serve every loaded face from a local route; nothing else may load.
const faces = registry.describeFaces(), files = prepared.fontFiles;
assert.equal(faces.length, files.length);
const served = new Map(faces.map((face, index) => [`https://fonts.test/${index}.ttf`, {...face, file: files[index]}]));
const browser = await chromium.launch({channel: process.platform === 'win32' ? 'msedge' : undefined}), errors = [], requests = [];
try {
  const page = await browser.newPage({viewport: {width: 1280, height: 720}, deviceScaleFactor: 1});
  page.on('pageerror', error => errors.push(error.message));
  await page.route(/^https?:/, async route => {
    const face = served.get(route.request().url());
    if (!face) { requests.push(route.request().url()); return route.abort(); }
    return route.fulfill({status: 200, contentType: 'font/ttf', body: await readFile(face.file)});
  });
  await page.setContent('<main style="margin:0"></main>');
  await page.evaluate(async faces => {
    for (const [url, face] of faces) document.fonts.add(await new FontFace(face.family, `url(${url})`, {weight: String(face.weight), style: face.italic ? 'italic' : 'normal'}).load());
    await document.fonts.ready;
  }, [...served].map(([url, face]) => [url, {family: face.family, weight: face.weight, italic: face.italic}]));
  const observed = [];
  for (const value of cases) {
    const runs = await page.evaluate(svg => {
      const host = document.querySelector('main'); host.innerHTML = svg;
      const title = [...host.querySelectorAll('text')].find(text => text.getAttribute('font-size') === '54');
      const spans = [...title.querySelectorAll('tspan[textLength]')];
      const elements = spans.length ? spans : [title];
      return elements.map(element => {
        const accepted = Number(element.getAttribute('textLength'));
        const family = (element.getAttribute('font-family') ?? title.getAttribute('font-family')).split(',')[0].trim();
        element.removeAttribute('textLength');
        const natural = element.getComputedTextLength ? element.getComputedTextLength() : title.getComputedTextLength();
        const loaded = [...document.fonts].some(face => face.family.replace(/^"|"$/g, '') === family && face.status === 'loaded');
        const box = element.getBBox();
        const svgBox = host.querySelector('svg').getBoundingClientRect();
        const scale = svgBox.width / host.querySelector('svg').viewBox.baseVal.width;
        return {text: element.textContent, family, accepted, natural, loaded, chars: element.getNumberOfChars(), box: {x: svgBox.left + box.x * scale, y: svgBox.top + box.y * scale, width: box.width * scale, height: box.height * scale}};
      });
    }, value.svg);
    // Colour: pixels of each emoji run's box, with the SVG as painted (textLength restored by re-setting the content).
    await page.evaluate(svg => { document.querySelector('main').innerHTML = svg; }, value.svg);
    await page.evaluate(() => document.fonts.ready);
    const colour = [];
    for (const run of runs.filter(run => run.family === 'Noto Color Emoji')) {
      const clip = {x: Math.max(0, Math.floor(run.box.x)), y: Math.max(0, Math.floor(run.box.y)), width: Math.max(1, Math.ceil(run.box.width)), height: Math.max(1, Math.ceil(run.box.height))};
      const shot = await page.screenshot({clip});
      const {default: sharp} = await import('sharp');
      const {data, info} = await sharp(shot).raw().toBuffer({resolveWithObject: true});
      // The clip's most frequent colour is the slide background; ink differs from it, and "saturated" ink has real chroma (a skin tone,
      // the red of a heart, the blue of a keycap), which grey anti-aliasing of a silhouette never has.
      const counts = new Map();
      for (let i = 0; i < data.length; i += info.channels) { const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]; counts.set(key, (counts.get(key) ?? 0) + 1); }
      const background = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0], bg = [background >> 16 & 255, background >> 8 & 255, background & 255];
      let ink = 0, saturated = 0;
      for (let i = 0; i < data.length; i += info.channels) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) < 60) continue;
        ink++;
        if (Math.max(r, g, b) - Math.min(r, g, b) > 60) saturated++;
      }
      colour.push({text: run.text, ink, saturated, pixels: info.width * info.height});
    }
    observed.push({id: value.id, runs, colour});
  }
  const output = path.resolve(process.argv[2] ?? 'artifacts/emoji-math-browser.json');
  await mkdir(path.dirname(output), {recursive: true});
  await writeFile(output, JSON.stringify({node: process.version, browser: browser.version(), observed, errors, requests, scope: 'Offline browser colour and advances of the pinned Noto Color Emoji and STIX Two Math against accepted fontkit advances. Native PowerPoint rendering is a separate check.'}, null, 2) + '\n');
  const residuals = [];
  for (const value of observed) {
    for (const run of value.runs) {
      assert.ok(run.loaded, `${value.id}: ${run.family} is loaded for ${run.text}`);
      residuals.push(Math.abs(run.natural - run.accepted));
      assert.ok(Math.abs(run.natural - run.accepted) < 0.1, `${value.id}: ${run.family} advance ${run.natural} differs from accepted ${run.accepted} for ${JSON.stringify(run.text)}`);
    }
    const emojiRuns = value.runs.filter(run => run.family === 'Noto Color Emoji');
    for (const run of emojiRuns) {
      // One glyph per sequence: the run's natural advance is a whole number of emoji advances (54 px font).
      const perEmoji = run.natural / (NOTO_COLOR_EMOJI_ADVANCE * 54);
      assert.ok(Math.abs(perEmoji - Math.round(perEmoji)) < 0.01, `${value.id}: ${JSON.stringify(run.text)} is ${perEmoji} emoji advances`);
    }
    // Noto Color Emoji draws the family ZWJ sequences as grey silhouettes by design (since 2.042); every other sequence here is coloured.
    for (const sample of value.colour) {
      if (sample.text === EMOJI.family) { assert.ok(sample.ink > 100, `${value.id}: the family silhouette is drawn`); continue; }
      assert.ok(sample.saturated > 50, `${value.id}: ${JSON.stringify(sample.text)} is drawn in colour (${sample.saturated} saturated of ${sample.pixels} px)`);
    }
    if (value.id === 'emoji-latin') assert.deepEqual(emojiRuns.map(run => run.text), [EMOJI.rocket, EMOJI.family, EMOJI.flag, EMOJI.thumbsMedium]);
    if (value.id === 'emoji-sequences') assert.deepEqual(emojiRuns.map(run => run.text), [EMOJI.keycap, EMOJI.heartVS16, EMOJI.scotland, EMOJI.womanTechnologist]);
    if (value.id === 'segoe-ui-emoji') {
      assert.ok(value.runs.some(run => run.text.includes('Score') && run.family !== 'Noto Color Emoji'), 'Latin text of a Segoe UI Emoji deck draws in a text face');
      assert.deepEqual(emojiRuns.map(run => run.text), [`${EMOJI.rocket}${EMOJI.family}`]);
    }
    if (value.id === 'cambria-math') assert.ok(value.runs.length >= 1 && value.runs.every(run => run.family === 'STIX Two Math'), `Cambria Math title draws in STIX Two Math: ${value.runs.map(run => run.family)}`);
  }
  assert.deepEqual(errors, []); assert.deepEqual(requests, []);
  console.log(`Emoji and math browser: ${observed.length} decks, ${residuals.length} runs within 0.1 px of accepted advances (max ${Math.max(...residuals).toFixed(4)} px); ${observed.flatMap(value => value.colour).length} emoji runs drawn in colour.`);
} finally { await browser.close(); }
