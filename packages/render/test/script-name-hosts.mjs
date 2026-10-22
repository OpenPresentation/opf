// FF-46 (opf#362): every proprietary script, emoji, math and code-table name commissioned in opf#362 (native visual acceptance remains separate) has its own
// fixture in the Node host. The script-family fixtures (test/script-family-hosts.mjs) are keyed by the open route faces, so a name such as
// Microsoft YaHei never matched them; this one is keyed by the proprietary name. For each name of test/fixtures/script-name-families.json,
// decks that name it (as the Latin, East Asian and complex-script font; a code-table name as the run font, the way symbol fonts are used)
// and draw its samples are loaded with `scripts: 'auto'`, and the Node registry and the SVG renderer must
//   - resolve the name to its policy route (core fontPolicyFor(name).replacement.family; for a code table, the first face of its chain),
//     as a visual substitute, with the policy sizeAdjust where the row has one, and load that route's package;
//   - draw every run of every sample in the face of its script: the policy route when it covers the script, otherwise the designated
//     script face (Sylfaen's Armenian and Georgian), which is then the only fallback allowed and must cover the whole sample; strictly
//     otherwise (`glyphFallback: 'none'`, no fallback note), with textLength equal to the route file's advance within 0.1 px and, for a
//     sizeAdjust row, at the adjusted size;
//   - for a code table, draw every code core's symbol-font encodings map with the chain face the fixture names for it (no placeholder);
//   - draw the route from its pinned file: the registry's file has the manifest SHA-256, and resvg paints the same pixels with only that
//     file loaded as with every face, different pixels without it (the colour emoji face draws through its documented monochrome stand-in).
// The exhaustive per-code checks of the symbol fonts stay in test/symbol-fonts.mjs. It writes artifacts/script-name-hosts/node.json.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import * as core from '@openpresentation/opf/composition';
import * as coreSymbols from '@openpresentation/opf/symbol-font-encodings';
import {toPng, toSvg} from '../dist/index.js';
import {BUNDLED_FONT_MANIFEST, loadFonts} from '../dist/fonts-node.js';
import {SCRIPT_FONT_FAMILIES, SYMBOL_PREVIEW_FACES, adjustedFontSize, createScriptTextMeasurement, fontPolicyFor} from '../dist/fonts.js';
import {monochromeColorFonts, rasterFontFiles} from '../dist/color-fonts.js';
import {loadCorpora} from '../scripts/script-corpora.mjs';
import {covers, directAdvance, drawnRuns, expectedWeight, root, scriptFamilies, shortName} from './script-family-fixture.mjs';

const NAMES = ['Aparajita', 'Arabic Typesetting', 'Cambria Math', 'David', 'FangSong', 'Gautami', 'Gisha', 'Kalinga', 'Microsoft JhengHei', 'Microsoft YaHei', 'MingLiU', 'Miriam', 'Nyala', 'PMingLiU', 'Segoe UI Emoji', 'SimHei', 'SimSun', 'Sylfaen', 'Symbol', 'Tunga', 'Webdings', 'Wingdings', 'Yu Gothic'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const slash = file => file.split(String.fromCharCode(92)).join('/');
const table = JSON.parse(await readFile(path.join(root, 'test/fixtures/script-name-families.json'), 'utf8'));
const rows = await scriptFamilies();
const rowOf = family => rows.find(row => row.family === family);
const corpora = await loadCorpora();
const symbolTables = new Map(coreSymbols.SYMBOL_FONT_ENCODINGS.families.map(entry => [entry.family, entry]));
const decodeUnicode = value => String.fromCodePoint(...value.split('+').map(part => parseInt(part, 16)));
const symbolText = codes => codes.split(' ').map(code => String.fromCharCode(0xF000 + parseInt(code, 16))).join('');
const mappedText = (name, codes) => codes.split(' ').map(code => decodeUnicode(symbolTables.get(name).codes.find(item => item.code === parseInt(code, 16)).unicode)).join('');
const escapeXml = text => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const squash = text => text.replace(/[\s︎️]+/g, '');

/** A deck that names `name` as every slot of its font scheme and draws the sample as the title, then regular and bold as the body. */
function nameDeck(name, sample) {
  return {
    $schema: 'https://openpresentation.org/schema/opf/v1', name: `Script name fixture ${name} ${sample.id}`, ...(sample.language ? {language: sample.language} : {}),
    design: {fontScheme: {name, major: name, minor: name, eastAsian: {major: name, minor: name}, complexScript: {major: name, minor: name}}},
    slides: [{id: 'a', title: sample.text, text: [{text: sample.text}, {text: sample.text, bold: true}]}],
  };
}
/** A symbol-encoded name is a run font: the codes of the sample (private-use form), regular then bold, with no title (the deck draws nothing else). */
function codeDeck(name, sample) {
  const text = symbolText(sample.codes);
  return {$schema: 'https://openpresentation.org/schema/opf/v1', name: `Script name fixture ${name} ${sample.id}`, slides: [{id: 'a', text: [{text, fontFamily: name}, {text, fontFamily: name, bold: true}]}]};
}

// ---- the table: names, routes and samples agree with core's policy, the corpus and the pinned faces ----
assert.equal(table.schema, 'opf-script-name-families/v1');
assert.deepEqual(Object.keys(table.families).sort(), NAMES, 'the fixture covers the 23 commissioned names with native visual findings kept separate from host loading/drawing');
const fontkit = await import('fontkit');
const regularFont = async family => {
  const pkg = BUNDLED_FONT_MANIFEST.packages.find(item => item.faces.some(face => face.family === family && face.weight === 400 && !face.italic));
  const face = pkg.faces.find(item => item.family === family && item.weight === 400 && !item.italic);
  return fontkit.create(new Uint8Array(await readFile(path.join(root, 'node_modules', pkg.name, face.file))));
};
for (const [name, entry] of Object.entries(table.families)) {
  if (entry.kind === 'code-table') {
    assert.deepEqual(entry.chain, SYMBOL_PREVIEW_FACES[name], `${name}: the chain is the renderer's code-table route`);
    assert.equal(entry.route, entry.chain[0]);
    const [only] = entry.scripts;
    const mapped = symbolTables.get(name).codes.filter(code => code.unicode !== null && code.code > 0x20).map(code => code.code.toString(16).toUpperCase());
    assert.deepEqual(only.samples.flatMap(sample => sample.codes.split(' ')), mapped, `${name}: the samples hold every mapped code once`);
    const fonts = await Promise.all(entry.chain.map(regularFont));
    const assigned = new Map(Object.entries(only.faces).flatMap(([face, codes]) => codes.split(' ').map(code => [code, face])));
    assert.equal(assigned.size, mapped.length, `${name}: every code names its face`);
    for (const code of mapped) {
      const points = [...decodeUnicode(symbolTables.get(name).codes.find(item => item.code === parseInt(code, 16)).unicode)].map(character => character.codePointAt(0));
      assert.equal(assigned.get(code), entry.chain[fonts.findIndex(font => points.every(point => font.hasGlyphForCodePoint(point)))], `${name} ${code}: the first chain face with the glyph`);
    }
    continue;
  }
  const policy = fontPolicyFor(name);
  assert.equal(entry.route, policy.replacement.family, `${name}: the route is core's policy replacement`);
  assert.equal(entry.sizeAdjust, policy.replacement.sizeAdjust, `${name}: the policy sizeAdjust`);
  for (const script of entry.scripts) {
    const routeRow = rowOf(entry.route), faceRow = rowOf(script.route);
    assert.ok(faceRow, `${name} ${script.script}: ${script.route} is a face of the scripts pack`);
    if (script.via === 'policy') assert.ok(script.route === entry.route && routeRow.scripts.includes(script.script), `${name} ${script.script}: the policy route serves the script`);
    else {
      assert.equal(script.via, 'script');
      assert.ok(!routeRow.scripts.includes(script.script), `${name} ${script.script}: the policy route does not serve the script`);
      assert.equal(script.route, SCRIPT_FONT_FAMILIES[script.script].sans ?? SCRIPT_FONT_FAMILIES[script.script].serif, `${name} ${script.script}: the designated script face`);
    }
    assert.ok(script.samples.length >= 1);
    for (const sample of script.samples) {
      const original = corpora.groups.find(group => group.script === sample.script)?.samples.find(item => item.id === sample.id) ?? faceRow.samples.find(item => item.id === sample.id);
      assert.ok(original, `${name} ${sample.id}: a corpus or FF-45 sample`);
      assert.equal(sample.text, original.text, `${name} ${sample.id}: the original text`);
      assert.ok(covers(faceRow.fonts, sample.text), `${name} ${sample.id}: every face of ${script.route} covers the sample completely`);
    }
  }
}

// ---- the hosts ----
const rasterOptions = fontFiles => ({fonts: {fontFiles, useBundledFonts: false}, scale: 0.5});
const manifestFace = (family, weight) => {
  for (const pkg of BUNDLED_FONT_MANIFEST.packages) for (const face of pkg.faces) if (face.family === family && face.weight === weight && !face.italic) return {...face, package: pkg.name, served: `${shortName(pkg.name)}/${face.file}`};
  return null;
};
const report = [];
let resolutionChecks = 0, runChecks = 0, paintChecks = 0, scriptChecks = 0;

for (const name of NAMES) {
  const entry = table.families[name];
  const codeTable = entry.kind === 'code-table';
  const decks = entry.scripts.flatMap(script => script.samples.map(sample => ({script, sample, deck: codeTable ? codeDeck(name, sample) : nameDeck(name, sample)})));
  const presentation = {...decks[0].deck, slides: decks.flatMap(({deck}, index) => deck.slides.map(slide => ({...slide, id: `s${index}`})))};
  const prepared = await loadFonts({pack: 'office', substitutionPolicy: 'visual', fallbackFamily: 'Roboto', scripts: 'auto', presentation}), {registry} = prepared;
  const where = name;
  // Resolution: the name answers as its route, a visual substitute, with the policy sizeAdjust.
  for (const bold of [false, true]) {
    const resolved = registry.resolveFont({fontFamily: name, fontWeight: bold ? 700 : 400, italic: false});
    assert.equal(resolved.resolvedFamily, entry.route, `${where} ${bold ? 'bold' : 'regular'}: resolves to ${entry.route}, not ${resolved.resolvedFamily}`);
    assert.equal(resolved.substitute, true, `${where}: a substitute`);
    assert.equal(resolved.compatibility, 'visual', `${where}: visual`);
    if (codeTable) assert.equal(resolved.symbolEncoding, name, `${where}: carries the encoding`);
    else {
      assert.equal(resolved.resolvedWeight, expectedWeight(rowOf(entry.route), bold), `${where} ${bold ? 'bold' : 'regular'}: the route's nearest weight`);
      assert.equal(resolved.sizeAdjust, entry.sizeAdjust, `${where}: the policy sizeAdjust`);
    }
    resolutionChecks += 1;
  }
  // Loading: every face that draws is held, and its package is selected for the deck (Noto Sans is the office pack's own face).
  const drawingFaces = codeTable ? Object.keys(entry.scripts[0].faces) : [...new Set(entry.scripts.map(script => script.route))];
  for (const family of drawingFaces) {
    const face = manifestFace(family, 400);
    assert.ok(registry.describeFaces().some(item => item.family === family), `${where}: the registry holds ${family}`);
    if (family !== 'Noto Sans') assert.ok(registry.scriptSelection.packages.includes(face.package), `${where}: scripts 'auto' selects ${face.package} (selected ${registry.scriptSelection.packages.join(', ')})`);
  }
  const row = {family: name, kind: entry.kind, route: entry.route, ...(entry.sizeAdjust ? {sizeAdjust: entry.sizeAdjust} : {}), scripts: [], files: [], samples: [], runs: 0};
  for (const script of entry.scripts) {
    const routes = codeTable ? Object.keys(script.faces) : [script.route];
    const scriptRow = {script: script.script, route: codeTable ? script.route : script.route, via: script.via, samples: script.samples.map(sample => sample.id)};
    for (const {sample, deck} of decks.filter(item => item.script === script)) {
      const notes = [], diagnostics = [];
      let svg;
      if (codeTable) svg = toSvg(deck, 1, {fonts: prepared, onDiagnostic: value => diagnostics.push(value)});
      else {
        const strict = createScriptTextMeasurement(registry.textMeasurement, core.resolveScriptFonts(deck), {glyphFallback: 'none', onFallback: note => notes.push(note)});
        svg = toSvg(deck, 1, {fonts: {...prepared, embeddedFonts: [], textMeasurement: strict}, glyphFallback: 'none', onDiagnostic: value => diagnostics.push(value)});
      }
      const fallbacks = diagnostics.filter(value => /glyph-fallback|missing-glyph/.test(value.code));
      assert.ok(!fallbacks.some(value => value.code === 'missing-glyph'), `${where} ${sample.id}: no missing glyph`);
      if (codeTable) {
        // The code map is the only substitution: from the name to a chain face, for the symbol script, never a placeholder.
        for (const value of fallbacks) {
          assert.deepEqual([value.fontFamily, value.scripts], [name, ['Zsym']], `${where} ${sample.id}: only the code map (${value.message})`);
          assert.ok(entry.chain.includes(value.fallbackFamily) && !value.placeholder, `${where} ${sample.id}: mapped to ${value.fallbackFamily}, no placeholder`);
        }
      } else if (script.via === 'policy') {
        assert.deepEqual([...notes, ...fallbacks], [], `${where} ${sample.id}: no glyph fallback`);
      } else {
        // The designated script face is the route of this script: it is the only fallback, from the policy route, for this script alone.
        for (const value of [...notes, ...fallbacks]) {
          assert.ok([name, entry.route].includes(value.fontFamily) && value.fallbackFamily === script.route && JSON.stringify(value.scripts) === JSON.stringify([script.script]), `${where} ${sample.id}: the only fallback is ${entry.route} to ${script.route} for ${script.script} (${JSON.stringify(value).slice(0, 200)})`);
        }
      }
      const runs = drawnRuns(svg);
      assert.ok(runs.length >= (codeTable ? 2 : 3), `${where} ${sample.id}: the deck draws its runs (${runs.length})`);
      if (codeTable) {
        // Every drawn code is in the chain face the fixture names for it.
        const faceOf = new Map();
        for (const [face, codes] of Object.entries(script.faces)) for (const code of codes.split(' ')) for (const character of mappedText(name, code)) faceOf.set(character, [...(faceOf.get(character) ?? []), face]);
        for (const run of runs) {
          for (const character of squash(run.text)) assert.ok(faceOf.get(character)?.includes(run.family), `${where} ${sample.id}: ${character} U+${character.codePointAt(0).toString(16).toUpperCase()} is drawn in ${faceOf.get(character)?.join(' or ')}, not ${run.family}`);
          runChecks += 1;
        }
        const mapped = squash(mappedText(name, sample.codes));
        assert.equal(squash(runs.map(run => run.text).join('')), mapped + mapped, `${where} ${sample.id}: every code is drawn, regular and bold`);
      } else {
        const faceRow = rowOf(script.route);
        const fontOf = weight => faceRow.fonts[faceRow.faces.findIndex(face => face.weight === weight && !face.italic)];
        let sizes = null;
        if (entry.sizeAdjust) {
          // The same deck in the route face itself: the name's runs are the same runs at the adjusted size.
          const plain = drawnRuns(toSvg(nameDeck(entry.route, sample), 1, {fonts: {...prepared, embeddedFonts: []}}));
          sizes = plain.map(run => adjustedFontSize(run.size, entry.sizeAdjust));
          assert.deepEqual(runs.map(run => run.size), sizes, `${where} ${sample.id}: drawn at the route's sizes times ${entry.sizeAdjust}`);
        }
        const weights = new Set();
        for (const run of runs) {
          assert.equal(run.family, script.route, `${where} ${sample.id}: "${[...run.text].slice(0, 12).join('')}" is drawn in ${script.route}, not ${run.family}`);
          assert.ok(faceRow.weights.includes(run.weight), `${where} ${sample.id}: weight ${run.weight} is one of ${script.route}'s`);
          weights.add(run.weight);
          const direct = directAdvance(fontOf(run.weight), run.text, run.size, sample.lang);
          assert.ok(Math.abs(run.length - direct) < 0.1, `${where} ${sample.id}: textLength ${run.length} equals the ${script.route} ${run.weight} advance (${direct})`);
          runChecks += 1;
        }
        assert.ok(runs.some(run => squash(run.text) === squash(sample.text)), `${where} ${sample.id}: a run carries the whole sample`);
        for (const bold of [false, true]) assert.ok(weights.has(expectedWeight(faceRow, bold)), `${where} ${sample.id}: the ${bold ? 'bold' : 'regular'} weight of ${script.route} is drawn`);
      }
      row.runs += runs.length;
      row.samples.push(sample.id);
    }
    // The drawn faces come from their pinned files, and resvg paints them as themselves.
    for (const family of routes) {
      const face = manifestFace(family, 400);
      const own = prepared.fontFiles.find(file => slash(file).endsWith(`/${face.served}`));
      assert.ok(own, `${where}: ${face.served} is among the registry's font files`);
      assert.equal(sha(await readFile(own)), face.sha256, `${where}: ${face.served} is the pinned file`);
      if (!row.files.includes(face.served)) row.files.push(face.served);
      const colourFace = family === 'Noto Color Emoji';
      const text = codeTable ? mappedText(name, script.faces[family].split(" ").slice(0, 8).join(" ")) : script.samples[0].text;
      const lang = codeTable ? null : script.samples[0].lang;
      const probe = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="80"><rect width="900" height="80" fill="white"/><text x="8" y="56" font-family="${family}" font-size="40" fill="black"${lang ? ` xml:lang="${lang}"` : ''}>${escapeXml(text)}</text></svg>`;
      const drawn = colourFace ? monochromeColorFonts(probe) : probe;
      const loaded = rasterFontFiles(prepared.fontFiles);
      const painter = colourFace ? loaded.find(file => slash(file).endsWith('/noto-emoji/400Regular/NotoEmoji_400Regular.ttf')) : own;
      assert.ok(painter && loaded.includes(painter), `${where}: ${path.basename(painter ?? own)} reaches resvg`);
      const everything = sha(await toPng(drawn, rasterOptions(loaded)));
      assert.equal(everything, sha(await toPng(drawn, rasterOptions([painter]))), `${where} ${family}: resvg draws it from ${path.basename(painter)}`);
      assert.notEqual(everything, sha(await toPng(drawn, rasterOptions(loaded.filter(file => file !== painter)))), `${where} ${family}: ${path.basename(painter)} is what paints`);
      paintChecks += 1;
    }
    row.scripts.push(scriptRow);
    scriptChecks += 1;
  }
  report.push(row);
}

const outDirectory = path.resolve(root, process.argv[2] ?? 'artifacts/script-name-hosts');
await mkdir(outDirectory, {recursive: true});
await writeFile(path.join(outDirectory, 'node.json'), `${JSON.stringify({node: process.version, families: report.length, resolutionChecks, scriptChecks, runChecks, paintChecks, findings: [], report}, null, 1)}\n`);
console.log(`Script name hosts (Node): ${report.length} proprietary names resolved to their policy routes (${resolutionChecks} resolutions), ${scriptChecks} scripts drawn in their route faces with ${runChecks} run checks, ${paintChecks} route faces painted by resvg from their pinned files.`);
