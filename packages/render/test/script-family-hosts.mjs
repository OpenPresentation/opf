// RR-17 (FF-44, FF-45): every open script, emoji and math family has its own fixture in the Node host. For each of the 35 families of the
// `scripts` pack (test/script-family-fixture.mjs), a deck that names the family as its Latin, East Asian and complex-script font and
// draws samples of its script (the FF-44 corpus samples its faces cover completely, the FF-45 emoji sequences and math notation) is
// loaded with `scripts: 'auto'`, the way the editor and the gallery load them. The Node registry and the SVG renderer must
//   - load the family's package (and, for the Arabic and Hebrew families, only packages of that script),
//   - resolve each style to the family itself, as `exact` (the weight the family has nearest the request; bold takes the regular face
//     of a family with one weight), never to a substitute,
//   - shape every sample at the advance the face's own file gives (fontkit with the OpenType language system of the sample), within 0.1 px,
//   - draw every run of the deck in the family, strictly (`glyphFallback: 'none'`: a missing glyph raises, and no fallback note is made),
//     with textLength equal to the file's advance of that run within 0.1 px, and
//   - paint through resvg with that file: the same pixels with only the family's file loaded as with every face, different pixels without
//     it. The colour emoji face is the one exception the renderer documents (resvg draws neither COLRv1 nor OT-SVG): the raster path
//     draws its monochrome stand-in Noto Emoji, and the fixture checks that route instead.
// It writes artifacts/script-family-hosts/node.json (per family: package, files, bytes, samples) for the evidence behind the tracker.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import * as core from '@openpresentation/opf/composition';
import {toPng, toSvg} from '../dist/index.js';
import {loadFonts} from '../dist/fonts-node.js';
import {createScriptTextMeasurement} from '../dist/fonts.js';
import {monochromeColorFonts, rasterFontFiles} from '../dist/color-fonts.js';
import {PROBE_SIZE, directAdvance, drawnRuns, expectedWeight, packageBytes, root, scriptDeck, scriptFamilies} from './script-family-fixture.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const slash = file => file.split(String.fromCharCode(92)).join('/');
const families = await scriptFamilies();
assert.equal(families.length, 35, `the fixture covers ${families.length} script families`);
for (const name of ['Noto Sans', 'Noto Sans Hebrew', 'Noto Serif Hebrew', 'Noto Naskh Arabic', 'Noto Sans JP', 'Noto Sans Devanagari', 'Noto Serif Tibetan', 'Noto Color Emoji', 'Noto Emoji', 'STIX Two Math', 'Noto Sans Math']) assert.ok(families.some(entry => entry.family === name), `${name} is in the fixture`);
for (const entry of families) assert.ok(entry.samples.length >= 2, `${entry.family}: ${entry.samples.length} samples that every face covers`);

const rasterOptions = fontFiles => ({ fonts: {fontFiles, useBundledFonts: false}, scale: 0.5});
const report = [];
let styleChecks = 0, runChecks = 0, paintChecks = 0;

for (const entry of families) {
  const decks = entry.samples.map(sample => ({sample, deck: scriptDeck(entry, sample)}));
  const prepared = await loadFonts({pack: 'office', substitutionPolicy: 'visual', fallbackFamily: 'Roboto', scripts: 'auto', presentation: decks[0].deck}), {registry} = prepared;
  const where = entry.family;
  // Loading: the family's package is among the selected script packages (Noto Sans is the office pack's own fallback face).
  const held = registry.describeFaces().filter(face => face.family === entry.family);
  assert.equal(held.length, entry.faces.length, `${where}: the registry holds the ${entry.faces.length} pinned faces`);
  if (entry.family !== 'Noto Sans') assert.ok(registry.scriptSelection.packages.includes(entry.package), `${where}: scripts 'auto' selects ${entry.package} (selected ${registry.scriptSelection.packages.join(', ')})`);
  for (const name of registry.scriptSelection.packages) {
    const pkg = families.find(item => item.package === name);
    assert.ok(pkg ? pkg.scripts.some(script => entry.scripts.includes(script)) : /noto-sans-(symbols|math)|noto-emoji|stix|noto-color/.test(name), `${where}: ${name} serves a script of the family`);
  }
  // Styles: each resolves to the family itself, exactly.
  for (const face of entry.faces) {
    for (const [weight, italic] of [[face.weight, face.italic]]) {
      const resolved = registry.resolveFont({fontFamily: entry.family, fontWeight: weight, italic});
      const label = `${where} ${weight}${italic ? 'i' : ''}`;
      assert.equal(resolved.resolvedFamily, entry.family, `${label}: draws ${entry.family}`);
      assert.deepEqual([resolved.resolvedWeight, resolved.italic], [face.weight, face.italic], `${label}: the face the style resolves to`);
      assert.equal(resolved.compatibility, 'exact', `${label}: the family answers as itself`);
      assert.equal(resolved.substitute, false, `${label}: no substitute`);
      styleChecks += 1;
    }
  }
  for (const bold of [false, true]) {
    const weight = expectedWeight(entry, bold), resolved = registry.resolveFont({fontFamily: entry.family, fontWeight: bold ? 700 : 400, italic: false});
    assert.equal(resolved.resolvedFamily, entry.family, `${where} ${bold ? 'bold' : 'regular'}: draws ${entry.family}`);
    assert.equal(resolved.resolvedWeight, weight, `${where} ${bold ? 'bold' : 'regular'}: the nearest weight`);
    // A weight the family lacks (bold of a one-weight face) takes the nearest face and is reported visual, never as the real weight.
    assert.equal(resolved.compatibility, entry.weights.includes(bold ? 700 : 400) ? 'exact' : 'visual', `${where} ${bold ? 'bold' : 'regular'}: exact, or visual for a missing weight`);
    styleChecks += 1;
  }
  // Samples: advances from the file, and the deck drawn strictly in the family.
  const fontOf = weight => entry.fonts[entry.faces.findIndex(face => face.weight === weight && !face.italic)];
  for (const {sample, deck} of decks) {
    for (const weight of entry.weights) {
      const measured = registry.textMeasurement.measure(sample.text, PROBE_SIZE, {fontFamily: entry.family, fontWeight: weight, italic: false, ...(sample.lang ? {lang: sample.lang} : {})});
      const want = directAdvance(fontOf(weight), sample.text, PROBE_SIZE, sample.lang);
      assert.ok(Math.abs(measured - want) < 0.1, `${where} ${weight} ${sample.id}: measures ${measured}, the face gives ${want}`);
    }
    const notes = [];
    const strict = createScriptTextMeasurement(registry.textMeasurement, core.resolveScriptFonts(deck), {glyphFallback: 'none', onFallback: note => notes.push(note)});
    const svg = toSvg(deck, 1, { fonts: {...prepared, embeddedFonts: [], textMeasurement: strict}, glyphFallback: 'none', onDiagnostic: value => { if (/glyph-fallback|missing-glyph/.test(value.code)) notes.push(value); }});
    assert.deepEqual(notes, [], `${where} ${sample.id}: no glyph fallback`);
    const runs = drawnRuns(svg);
    assert.ok(runs.length >= 3, `${where} ${sample.id}: the deck draws its title and two body runs (${runs.length})`);
    const drawnWeights = new Set();
    for (const run of runs) {
      assert.equal(run.family, entry.family, `${where} ${sample.id}: "${[...run.text].slice(0, 12).join('')}" is drawn in ${entry.family}, not ${run.family}`);
      assert.ok(entry.weights.includes(run.weight), `${where} ${sample.id}: weight ${run.weight} is one of the family's`);
      drawnWeights.add(run.weight);
      const direct = directAdvance(fontOf(run.weight), run.text, run.size, sample.lang);
      assert.ok(Math.abs(run.length - direct) < 0.1, `${where} ${sample.id}: textLength ${run.length} equals the advance of ${path.basename(entry.faces.find(face => face.weight === run.weight).file)} (${direct})`);
      runChecks += 1;
    }
    assert.ok(runs.some(run => run.text.replace(/\s+/g, '') === sample.text.replace(/\s+/g, '')), `${where} ${sample.id}: a run carries the whole sample`);
    for (const bold of [false, true]) assert.ok(drawnWeights.has(expectedWeight(entry, bold)), `${where} ${sample.id}: the ${bold ? 'bold' : 'regular'} weight is drawn`);
  }
  // Paint: resvg draws the family from its file, and not another one.
  const sample = decks[0].sample;
  const colourFace = entry.color !== null;
  for (const face of entry.faces) {
    const target = colourFace ? 'Noto Emoji' : entry.family;
    const text = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="80"><rect width="900" height="80" fill="white"/><text x="8" y="56" font-family="${entry.family}" font-weight="${face.weight}" font-style="${face.italic ? 'italic' : 'normal'}" font-size="40" fill="black"${sample.lang ? ` xml:lang="${sample.lang}"` : ''}>${sample.text}</text></svg>`;
    const drawn = colourFace ? monochromeColorFonts(text) : text;
    if (colourFace) {
      assert.ok(drawn.includes(`font-family="${target}"`), `${where}: the raster path names ${target}`);
      assert.ok(rasterFontFiles(prepared.fontFiles).length === prepared.fontFiles.length - 1, `${where}: the colour file never reaches resvg`);
    }
    const loaded = rasterFontFiles(prepared.fontFiles);
    const own = loaded.find(file => slash(file).endsWith(colourFace ? '/noto-emoji/400Regular/NotoEmoji_400Regular.ttf' : `/${face.served}`));
    assert.ok(own, `${where}: ${colourFace ? 'the Noto Emoji stand-in' : face.served} is among the registry's font files`);
    const everything = sha(await toPng(drawn, rasterOptions(loaded)));
    assert.equal(everything, sha(await toPng(drawn, rasterOptions([own]))), `${where} ${face.weight}: resvg draws ${target} from ${path.basename(own)}`);
    assert.notEqual(everything, sha(await toPng(drawn, rasterOptions(loaded.filter(file => file !== own)))), `${where} ${face.weight}: ${path.basename(own)} is what paints`);
    paintChecks += 1;
  }
  report.push({
    family: entry.family, route: entry.family, package: entry.packageShort, version: entry.version, scripts: entry.scripts, files: entry.files, lazyBytes: await packageBytes(entry),
    samples: decks.map(({sample}) => sample.id), weights: entry.weights, ...(colourFace ? {raster: 'Noto Emoji (resvg draws neither COLRv1 nor OT-SVG; the renderer documents the monochrome stand-in)'} : {}),
  });
}

const outDirectory = path.resolve(root, process.argv[2] ?? 'artifacts/script-family-hosts');
await mkdir(outDirectory, {recursive: true});
await writeFile(path.join(outDirectory, 'node.json'), `${JSON.stringify({node: process.version, families: report.length, styleChecks, runChecks, paintChecks, report}, null, 1)}\n`);
console.log(`Script family hosts (Node): ${report.length} families, ${styleChecks} styles resolved to the family itself, ${runChecks} runs drawn strictly in it at the face's own advances, ${paintChecks} faces painted by resvg as themselves.`);
