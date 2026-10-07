// FF-44 (RR-17): every corpus sample as a slide title, through the real pipeline (core composition, script itemization, SVG with pinned textLength)
// in Chromium. test/script-corpora-browser.mjs holds each face to HarfBuzz; this holds the renderer's PLAN to the browser: a sample that mixes scripts
// (Latin beside Thai, Arabic beside digits, kanji beside Hangul) is split into runs by the renderer, each run is pinned to its measured advance
// with textLength, and the browser's natural advance of every run (the pin removed) must equal that pin within 0.1 px. A run drawn in a face that
// differs from the one measured, a missing glyph fallen to a system font, or a mis-split cluster shows here. Right-to-left titles must display
// right to left. Usage: node test/script-corpora-slides-browser.mjs [report.json]
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {renderSlideSvg} from '../dist/index.js';
import {loadFonts} from '../dist/fonts-node.js';
import {loadCorpora} from '../scripts/script-corpora.mjs';

const corpora = await loadCorpora();
// The pinned faces are served to the page by route below, so the SVGs carry no embedded font data (embeddedFonts: []).
const prepared = await loadFonts({pack: 'office', scripts: 'all'}), {registry} = prepared;
const faces = registry.describeFaces(), files = prepared.fontFiles;
// fontkit limits recorded in the fixture (Myanmar, one Syriac word, Nastaliq): the deviation they bound at 100 px scales with the font size.
const limits = new Map(corpora.knownShapingLimits.flatMap(limit => Object.entries(limit.samples).map(([id, bound]) => [`${limit.family}|${id}`, bound])));
const cases = [];
for (const group of corpora.groups) {
  for (const sample of group.samples) {
    const language = group.languages.find(tag => tag.split('-')[0] === sample.lang.split('-')[0]) ?? group.languages[0] ?? sample.lang;
    const deck = {$schema: 'https://openpresentation.org/schema/opf/v1', name: `FF-44 ${sample.id}`, language, slides: [{title: sample.text, text: 'Body'}]};
    cases.push({id: sample.id, group: group.script, rtl: group.direction === 'rtl', language, svg: renderSlideSvg(deck, 0, { fonts: {...prepared, embeddedFonts: []}})});
  }
}
const served = new Map(faces.map((face, index) => [`https://fonts.test/${index}.ttf`, {...face, file: files[index]}]));
const browser = await chromium.launch({channel: process.platform === 'win32' ? 'msedge' : undefined}), errors = [], requests = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message)); page.on('crash', () => console.error('PAGE CRASH')); page.on('console', message => { if (message.type() === 'error') console.error('console error', message.text().slice(0, 200)); });
  await page.route(/^https?:/, async route => {
    const face = served.get(route.request().url());
    if (!face) { requests.push(route.request().url()); return route.abort(); }
    return route.fulfill({status: 200, contentType: 'font/ttf', body: await readFile(face.file)});
  });
  await page.setContent('<main></main>');
  await page.evaluate(async list => {
    for (const [url, face] of list) document.fonts.add(await new FontFace(face.family, `url(${url})`, {weight: String(face.weight), style: face.italic ? 'italic' : 'normal'}).load());
    await document.fonts.ready;
  }, [...served].map(([url, face]) => [url, {family: face.family, weight: face.weight, italic: face.italic}]));
  const observed = await page.evaluate(list => list.map(item => {
    const host = document.querySelector('main');
    host.innerHTML = item.svg;
    const runs = [];
    for (const text of host.querySelectorAll('text')) {
      // the title lines (RR-38: an Arabic Typesetting title is drawn at 0.64 of its 54 px composed size)
      if (!['54', '34.5'].includes(text.getAttribute('font-size'))) continue;
      const spans = [...text.querySelectorAll('tspan[textLength]')];
      const pinned = text.hasAttribute('textLength') ? [text] : spans;
      for (const element of pinned) {
        const accepted = Number(element.getAttribute('textLength'));
        const family = (element.getAttribute('font-family') ?? text.getAttribute('font-family')).split(',')[0].trim();
        element.removeAttribute('textLength');
        const natural = element === text ? text.getComputedTextLength() : element.getComputedTextLength();
        runs.push({text: element.textContent, family, accepted, natural, size: parseFloat(getComputedStyle(element).fontSize), loaded: [...document.fonts].some(face => face.family.replace(/^"|"$/g, '') === family && face.status === 'loaded')});
      }
    }
    // Painted order of each title line: the first letter against the last (the isolate marks of right-to-left lines are skipped).
    const orders = [];
    for (const text of host.querySelectorAll('text')) {
      if (!['54', '34.5'].includes(text.getAttribute('font-size'))) continue;
      const content = text.textContent, letters = [...content].map((character, index) => [character, index]).filter(([character]) => !/[⁦-⁩s]/.test(character));
      if (letters.length < 2) continue;
      const first = letters[0][1], last = letters.at(-1)[1];
      orders.push({first: text.getStartPositionOfChar(first).x, last: text.getStartPositionOfChar(last).x});
    }
    return {id: item.id, runs, orders};
  }), cases.map(({id, svg}) => ({id, svg})));
  let worst = 0, runCount = 0, limited = 0, rtlLines = 0, punctuationLinux = 0;
  const rows = [];
  for (const [index, value] of observed.entries()) {
    assert.ok(value.runs.length > 0, `${value.id}: the title draws at least one pinned run`);
    if (cases[index].rtl) for (const order of value.orders) { rtlLines++; assert.ok(order.first > order.last, `${value.id}: a right-to-left title line paints its first letter right of its last (${order.first} against ${order.last})`); }
    for (const run of value.runs) {
      runCount++;
      assert.ok(run.loaded, `${value.id}: ${run.family} is a loaded pinned face for ${JSON.stringify(run.text)}`);
      const delta = Math.abs(run.natural - run.accepted);
      rows.push({id: value.id, family: run.family, accepted: run.accepted, natural: run.natural});
      // Linux Chromium (the pinned Playwright image) paints fullwidth punctuation lines differently from Edge (see script-corpora-browser.mjs): recorded, not gated there.
      if (process.platform === 'linux' && /[　-〿＀-￯‘-”]/.test(run.text)) { punctuationLinux++; continue; }
      const bound = limits.get(`${run.family}|${value.id}`);
      if (bound !== undefined) { limited++; assert.ok(delta <= bound * run.size / 100 + 0.1, `${value.id}: the recorded limit ${bound} (at 100 px) no longer bounds ${delta.toFixed(3)} px at ${run.size} px`); continue; }
      worst = Math.max(worst, delta);
      assert.ok(delta < 0.1, `${value.id}: ${run.family} draws ${run.natural.toFixed(3)} px, accepted ${run.accepted.toFixed(3)} for ${JSON.stringify(run.text.slice(0, 40))}`);
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  const output = path.resolve(process.argv[2] ?? 'artifacts/script-corpora-slides-browser.json');
  await mkdir(path.dirname(output), {recursive: true});
  await writeFile(output, `${JSON.stringify({node: process.version, browser: browser.version(), slides: cases.length, runs: runCount, worst, punctuationRunsNotGatedOnLinux: punctuationLinux, rows}, null, 2)}\n`);
  console.log(`Script corpora slides browser: ${cases.length} corpus titles, ${runCount} pinned runs, every run's browser advance within 0.1 px of its accepted advance (max ${worst.toFixed(4)} px) except ${limited} runs of the recorded fontkit limits, bounded; ${rtlLines} right-to-left title lines paint right to left.`);
} finally { await browser.close(); }
