// render#213: the loaded handle measures the same glyph advances/ink it outlines; bare registries keep fontkit.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createFontRegistry } from '../dist/font-registry.js';
import { loadFonts } from '../dist/fonts-node.js';
import { textOutlines } from '../dist/text-paths.js';
import { createShaper } from '../dist/hb-shape.js';
import { loadCorpora, loadFaces } from '../scripts/script-corpora.mjs';
import * as hb from 'harfbuzzjs';
import { wrapText } from '@openpresentation/opf/composition';

const fonts = await loadFonts({ pack: 'office', scripts: 'all' });
const { faces } = await loadFaces();
const corpora = await loadCorpora();
const bytes = await readFile(new URL('../node_modules/harfbuzzjs/dist/harfbuzz.wasm', import.meta.url));
const SIZE = 25;
const report = { baseCommit: '6615ad5', issue: 'OpenPresentation/opf-render#213', node: process.version, harfbuzz: '1.6.3', wasmSha256: createHash('sha256').update(bytes).digest('hex'), sourceSha256: Object.fromEntries(await Promise.all(['font-registry.js', 'text-paths.js', 'script-fonts.js'].map(async file => [file, createHash('sha256').update(await readFile(new URL(`../src/${file}`, import.meta.url))).digest('hex')]))), size: SIZE, samples: [] };
let compared = 0, changed = 0;
for (const group of corpora.groups) {
  for (const sample of group.samples) {
    const face = faces.find(face => face.weight === 400 && face.scripts.includes(group.script));
    if (!face || [...sample.text].some(character => !/\p{Default_Ignorable_Code_Point}/u.test(character) && !face.font.hasGlyphForCodePoint(character.codePointAt(0)))) continue;
    const data = new Uint8Array(await readFile(face.file));
    const style = { fontFamily: face.family, fontWeight: face.weight, lang: sample.lang, direction: group.direction };
    const fallback = createFontRegistry([{ family: face.family, weight: face.weight, data }]);
    const before = fallback.textMeasurement.measure(sample.text, SIZE, style);
    const buffer = new hb.Buffer();
    buffer.addText(sample.text); buffer.setDirection(group.direction ?? 'ltr'); buffer.guessSegmentProperties();
    if (sample.lang) buffer.setLanguage(sample.lang);
    hb.shape(face.hbFont, buffer);
    const positions = buffer.getGlyphPositions(), infos = buffer.getGlyphInfos();
    const reference = positions.reduce((total, glyph) => total + glyph.xAdvance, 0) / face.hbFace.upem * SIZE;
    const ink = infos.flatMap((info, index) => {
      const box = face.font.getGlyph(info.codepoint).bbox;
      const pen = positions.slice(0, index).reduce((sum, position) => sum + position.xAdvance, 0);
      return box.width > 0 && box.height > 0 ? [{left: pen + positions[index].xOffset + box.minX, right: pen + positions[index].xOffset + box.maxX, top: positions[index].yOffset + box.maxY, bottom: positions[index].yOffset + box.minY}] : [];
    });
    if (ink.length) {
      const bounds = fonts.textMeasurement.outlineBounds(sample.text, SIZE, style);
      const left = Math.min(...ink.map(box => box.left)), right = Math.max(...ink.map(box => box.right)), top = Math.max(...ink.map(box => box.top)), bottom = Math.min(...ink.map(box => box.bottom));
      for (const [key, expected] of Object.entries({x: left, y: -top, width: right-left, height: top-bottom})) assert.ok(Math.abs(bounds[key] - expected / face.font.unitsPerEm * SIZE) < 1e-8, `${sample.id}: ink ${key}`);
    }
    const measured = fonts.textMeasurement.measure(sample.text, SIZE, style);
    assert.ok(Math.abs(measured - reference) < 1e-8, `${sample.id}: ${measured} != ${reference}`);
    // Cached fontkit measurements must be discarded when the handle's outline shaper attaches.
    const outlines = textOutlines({ registry: fallback, shaper: createShaper(bytes) });
    const after = fallback.textMeasurement.measure(sample.text, SIZE, style);
    assert.equal(after, measured, `${sample.id}: stale pre-shaper cache`);
    // Direction and language are part of the cache and are passed to the actual outline shaper.
    const exported = {data, hash: data};
    for (const direction of ['ltr', 'rtl']) {
      const glyphs = outlines.shape(exported, sample.text, {direction, lang: sample.lang});
      const expected = glyphs.reduce((total, glyph) => total + glyph.advance, 0) / face.font.unitsPerEm * SIZE;
      assert.equal(fallback.textMeasurement.measure(sample.text, SIZE, {...style, direction}), expected, `${sample.id}: ${direction}`);
    }
    fallback.setShaper(undefined);
    assert.equal(fallback.textMeasurement.measure(sample.text, SIZE, style), before, `${sample.id}: no-shaper fontkit fallback`);
    compared++;
    const delta = measured - before;
    if (Math.abs(delta) > 0.001) {
      changed++;
      const threshold = (before + measured) / 2;
      const oldLines = wrapText(sample.text, threshold, SIZE, (text, size) => fallback.textMeasurement.measure(text, size, style));
      const newLines = wrapText(sample.text, threshold, SIZE, (text, size) => fonts.textMeasurement.measure(text, size, style));
      assert.notDeepEqual(oldLines, newLines, `${sample.id}: line wrapping uses the new shaped advance`);
    }
    report.samples.push({id: sample.id, family: face.family, fontFile: path.basename(face.file), fontSha256: createHash('sha256').update(data).digest('hex'), direction: group.direction, language: sample.lang, fontkit: before, harfbuzz: measured, delta});
  }
}
assert.ok(compared >= 100, `${compared} corpus samples`);
for (const id of ['mymr-words', 'mymr-medials', 'syrc-marks']) {
  const row = report.samples.find(sample => sample.id === id);
  assert.ok(row && Math.abs(row.delta) > 0.1, `${id}: reviewed shaping difference remains exercised`);
}
// Shared WASM fonts are identified by immutable content, while measurement caches belong to each handle.
const source = fonts.registry.exportFaces().find(face => face.family === 'Roboto');
const rawKeys = [];
const rawShaper = {shape(key) { rawKeys.push(key); return [{gid: 0, codePoints: [], advance: 100, xOffset: 0, yOffset: 0}]; }};
const handles = [0, 1].map(() => createFontRegistry([{family: 'Roboto', data: new Uint8Array(source.data)}]));
for (const registry of handles) { textOutlines({registry, shaper: rawShaper}); registry.textMeasurement.measure('abc', SIZE, {fontFamily: 'Roboto'}); }
assert.equal(rawKeys[0], rawKeys[1]);
assert.match(rawKeys[0], /^[A-F0-9]{64}$/);
handles[0].setShaper(undefined);
const cached = handles[1].textMeasurement.measure('abc', SIZE, {fontFamily: 'Roboto'});
assert.equal(rawKeys.length, 2, 'changing another handle does not invalidate this cache');
assert.ok(cached > 0);
// COLRv1 colour emoji has no usable fontkit glyph bbox; HarfBuzz traversal must preserve the em-box fallback.
const colorBounds = fonts.textMeasurement.outlineBounds('😀', SIZE, {fontFamily: 'Noto Color Emoji'});
assert.ok(colorBounds && Object.values(colorBounds).every(Number.isFinite));
assert.equal(colorBounds.x, 0);
assert.equal(colorBounds.width, fonts.textMeasurement.measure('😀', SIZE, {fontFamily: 'Noto Color Emoji'}));
assert.ok(colorBounds.height > 0);
assert.throws(() => fonts.textMeasurement.measure('\u{10FFFF}', SIZE, {fontFamily: 'Roboto'}), {code: 'missing-glyph'});
// Plain Latin output stays at the existing advances, with policy features and substitution scale still applied.
for (const family of ['Roboto', 'Carlito', 'Gelasio']) {
  const described = fonts.registry.describeFaces();
  const entries = fonts.registry.exportFaces().flatMap((face, index) => face.family === family ? [{...face, weight: described[index].weight, italic: described[index].italic}] : []);
  const fallback = createFontRegistry(entries);
  const style = {fontFamily: family};
  assert.equal(fonts.textMeasurement.measure('The quick brown fox 123', SIZE, style), fallback.textMeasurement.measure('The quick brown fox 123', SIZE, style));
}
if (process.argv.includes('--examples')) {
  const {examples} = await import('@openpresentation/opf/examples');
  const {toSvg} = await import('./catalog-harness.mjs');
  const office = await loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'all'});
  const unchanged = {decks: examples.length, slides: 0, changed: []};
  for (const example of examples) {
    office.registry.setShaper(undefined);
    const before = toSvg(example.deck, {fonts: office});
    office.registry.setShaper({shape: office.outlines.shape});
    const after = toSvg(example.deck, {fonts: office});
    assert.equal(before.length, after.length, example.file);
    unchanged.slides += after.length;
    for (let index = 0; index < after.length; index++) if (before[index] !== after[index]) unchanged.changed.push({file: example.file, slide: index + 1});
  }
  assert.deepEqual(unchanged.changed, []);
  report.examples = unchanged;
}
const reportPath = process.argv.slice(2).find(argument => !argument.startsWith('--'));
if (reportPath) { await mkdir(path.dirname(reportPath), {recursive: true}); await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n'); }
console.log(`HarfBuzz layout measurement: ${compared} independently shaped samples; ${changed} widths changed from fontkit; direction/cache/fallback and Latin advances pass.`);
