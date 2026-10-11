// FF-46 (opf#362): every proprietary script, emoji, math and code-table name that passed the native visual comparison has its own
// fixture in the editor host. The script-family fixture (test/font-gate-script-families.mjs) is keyed by the open route faces, so a name
// such as Microsoft YaHei never matched it; this one is keyed by the proprietary name. The font gate (the one path every document-replacing
// action goes through) is driven with the real renderer registry in a fake document with a local fetch, starting from the 33 eager faces.
// For each name of test/fixtures/script-name-families.json (the table opf-render's test/script-name-hosts.mjs checks against core's
// policy, the FF-44 corpus and the pinned faces), decks that name it (as every font-scheme slot; a code-table name as the run font) and
// draw its samples go through the gate, which must
//   - report pending only script packages, load them (each fetched file hash-verified by the loader), then report nothing pending, with
//     nothing but the pending packages' files fetched, and leave a registry that holds the faces that draw the name;
//   - resolve the name to its policy route (a code table: the first face of its chain), as a visual substitute with the policy sizeAdjust;
//   - render every sample with every run drawn in the face of its script: the policy route when it covers the script, otherwise the
//     designated script face (Sylfaen's Armenian and Georgian), which is then the only fallback allowed; strictly otherwise
//     (`glyphFallback: 'none'`, no fallback note), pinned to a finite advance, at the adjusted size for a sizeAdjust row; for a code
//     table, every code core's encodings map drawn in the chain face the fixture names for it, never a placeholder.
// The expectation is read from the installed renderer, so it follows the renderer this editor is tested with. It writes
// artifacts/script-name-hosts/editor.json for the evidence behind the font tracker.
import assert from "node:assert/strict";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveScriptFonts } from "@openpresentation/opf/composition";
import * as coreSymbols from "@openpresentation/opf/symbol-font-encodings";
import { fontGate } from "../dist/font-gate.js";
import { BUNDLED_FONT_MANIFEST, loadFonts } from "@openpresentation/opf-render/fonts-node";
import { SYMBOL_PREVIEW_FACES, adjustedFontSize, createScriptTextMeasurement, fontPolicyFor } from "@openpresentation/opf-render/fonts";
import * as browserFonts from "@openpresentation/opf-render/fonts-browser";
import { toSvg } from "@openpresentation/opf-render/svg";

const root = fileURLToPath(new URL("../", import.meta.url));
const packageRoot = path.dirname(fileURLToPath(import.meta.resolve("@openpresentation/opf-render/package.json")));
const outDirectory = path.resolve(process.argv[2] ?? "artifacts/script-name-hosts");
const table = JSON.parse(await readFile(path.join(root, "test/fixtures/script-name-families.json"), "utf8"));
const SCRIPTS_ROOT = path.join(root, "node_modules/@expo-google-fonts");
const shortName = (name) => name.replace("@expo-google-fonts/", "");
const names = Object.keys(table.families).sort();
assert.equal(names.length, 22, `the fixture covers ${names.length} names`);

// The 33 eager office and base faces, as a gallery or playground registry starts.
const eagerFaces = (await loadFonts({ pack: "office" })).registry.embeddedFonts.map((face, index) => ({ index, family: face.family, weight: face.weight, italic: !!face.italic, data: new Uint8Array(Buffer.from(face.dataUrl.split(",")[1], "base64")) }));
assert.equal(eagerFaces.length, 33, "the eager list is the 33 office and base faces");

class Face { constructor(family, bytes, descriptors) { Object.assign(this, { family, bytes, descriptors }); } async load() { return this; } }
const documentFonts = new Set(); documentFonts.ready = Promise.resolve();
const domDocument = { fonts: documentFonts, defaultView: { FontFace: Face } };
const served = [], vendored = [];
const fetchLocal = async (url) => {
  // Script packages from the pack route; the renderer's vendored faces (lazyFontsBaseUrl) from its package directory.
  const isVendored = url.startsWith("https://fonts.example/vendored/");
  const file = url.replace(isVendored ? "https://fonts.example/vendored/" : "https://fonts.example/pack/", "");
  (isVendored ? vendored : served).push(file);
  try {
    const bytes = await readFile(path.join(isVendored ? packageRoot : SCRIPTS_ROOT, file));
    return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  } catch { return { ok: false, status: 404 }; }
};
const fonts = await browserFonts.loadFonts({ faces: eagerFaces.map((face) => ({ ...face })), document: domDocument, fetch: fetchLocal, substitutionPolicy: "visual", fallbackFamily: "Roboto", scriptBaseUrl: "https://fonts.example/pack/", lazyFontsBaseUrl: "https://fonts.example/vendored/" });
const registry = fonts.registry;
const gate = fontGate(fonts);

// ---- the route faces, from the renderer's own manifest and core's policy ----
const packageOf = (family) => BUNDLED_FONT_MANIFEST.packages.find((pkg) => pkg.faces.some((face) => face.family === family));
const weightsOf = (family) => [...new Set(packageOf(family).faces.filter((face) => face.family === family && !face.italic).map((face) => face.weight))].sort((a, b) => a - b);
const expectedWeight = (family, bold) => [...weightsOf(family)].sort((a, b) => Math.abs(a - (bold ? 700 : 400)) - Math.abs(b - (bold ? 700 : 400)) || a - b)[0];
for (const name of names) {
  const entry = table.families[name];
  if (entry.kind === "code-table") assert.deepEqual(entry.chain, SYMBOL_PREVIEW_FACES[name], `${name}: the chain is the renderer's code-table route`);
  else {
    assert.equal(entry.route, fontPolicyFor(name).replacement.family, `${name}: the route is core's policy replacement`);
    assert.equal(entry.sizeAdjust, fontPolicyFor(name).replacement.sizeAdjust, `${name}: the policy sizeAdjust`);
  }
}
const symbolTables = new Map(coreSymbols.SYMBOL_FONT_ENCODINGS.families.map((entry) => [entry.family, entry]));
const decodeUnicode = (value) => String.fromCodePoint(...value.split("+").map((part) => parseInt(part, 16)));
const mappedText = (name, codes) => codes.split(" ").map((code) => decodeUnicode(symbolTables.get(name).codes.find((item) => item.code === parseInt(code, 16)).unicode)).join("");
const squash = (text) => text.replace(/[\s︎️]+/g, "");

const nameDeck = (name, sample) => ({
  $schema: "https://openpresentation.org/schema/opf/v1",
  name: `Script name fixture ${name} ${sample.id}`,
  ...(sample.language ? { language: sample.language } : {}),
  design: { fontScheme: { id: "x-script-name-fixture", name, major: name, minor: name, eastAsian: { major: name, minor: name }, complexScript: { major: name, minor: name } } },
  slides: [{ id: "a", title: sample.text, text: [{ text: sample.text }, { text: sample.text, bold: true }] }],
});
const codeDeck = (name, sample) => {
  const text = sample.codes.split(" ").map((code) => String.fromCharCode(0xf000 + parseInt(code, 16))).join("");
  return { $schema: "https://openpresentation.org/schema/opf/v1", name: `Script name fixture ${name} ${sample.id}`, slides: [{ id: "a", text: [{ text, fontFamily: name }, { text, fontFamily: name, bold: true }] }] };
};
/** Every drawn run of an SVG: family, weight, size, pinned length and text (bidirectional isolate marks removed). */
function drawnRuns(svg) {
  const runs = [];
  const attributeOf = (attributes, name) => new RegExp(`\\s${name}="([^"]*)"`).exec(attributes)?.[1];
  const unquote = (value) => value?.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
  const decode = (value) => value.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16))).replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number))).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  for (const match of svg.matchAll(/<text\b([^>]*)>(.*?)<\/text>/gs)) {
    const [, attributes, content] = match;
    const owner = { family: unquote(attributeOf(attributes, "font-family")), weight: Number(attributeOf(attributes, "font-weight") ?? 400), size: Number(attributeOf(attributes, "font-size")), length: attributeOf(attributes, "textLength") };
    if (!content.includes("<tspan")) { runs.push({ ...owner, length: Number(owner.length), text: decode(content) }); continue; }
    for (const span of content.matchAll(/<tspan\b([^>]*)>([^<]*)<\/tspan>/g)) {
      const [, own, text] = span;
      runs.push({ family: unquote(attributeOf(own, "font-family")) ?? owner.family, weight: Number(attributeOf(own, "font-weight") ?? owner.weight), size: Number(attributeOf(own, "font-size") ?? owner.size), length: Number(attributeOf(own, "textLength")), text: decode(text) });
    }
  }
  return runs.map((run) => ({ ...run, text: run.text.replace(/[⁦-⁩‎‏‪-‮]/g, "") })).filter((run) => run.text.trim());
}

const report = [];
let resolutionChecks = 0, runChecks = 0;
const loaded = new Set();
for (const name of names) {
  const entry = table.families[name];
  const codeTable = entry.kind === "code-table";
  const row = { family: name, kind: entry.kind, route: entry.route, ...(entry.sizeAdjust ? { sizeAdjust: entry.sizeAdjust } : {}), scripts: [], files: [], samples: [], fetchedAfterEarlierFamilies: 0 };
  for (const script of entry.scripts) {
    const faces = codeTable ? Object.keys(script.faces) : [script.route];
    const faceOf = new Map();
    if (codeTable) for (const [face, codes] of Object.entries(script.faces)) for (const code of codes.split(" ")) for (const character of mappedText(name, code)) faceOf.set(character, [...(faceOf.get(character) ?? []), face]);
    for (const sample of script.samples) {
      const where = `${name} ${sample.id}`;
      const deck = codeTable ? codeDeck(name, sample) : nameDeck(name, sample);
      const pending = gate.pending(deck);
      const before = served.length;
      await gate.ensure(deck);
      const fetched = served.slice(before);
      assert.ok(pending.every((item) => item.startsWith("@expo-google-fonts/")), `${where}: pending names script packages (${pending.join(", ")})`);
      assert.ok(pending.every((item) => !loaded.has(item)), `${where}: nothing already loaded is pending`);
      assert.ok(fetched.every((file) => pending.some((item) => file.startsWith(`${shortName(item)}/`))), `${where}: only the pending packages' files are fetched (${fetched.join(", ")})`);
      assert.equal(new Set(fetched).size, fetched.length, `${where}: no file is fetched twice`);
      for (const item of pending) loaded.add(item);
      assert.deepEqual(gate.pending(deck), [], `${where}: nothing is pending after ensure`);
      row.fetchedAfterEarlierFamilies += fetched.length;
      for (const family of faces) assert.ok(registry.describeFaces().some((face) => face.family === family), `${where}: the registry holds ${family}`);
      // The name resolves to its policy route.
      for (const bold of [false, true]) {
        const resolved = registry.resolveFont({ fontFamily: name, fontWeight: bold ? 700 : 400, italic: false });
        assert.equal(resolved.resolvedFamily, entry.route, `${where} ${bold ? "bold" : "regular"}: resolves to ${entry.route}, not ${resolved.resolvedFamily}`);
        assert.equal(resolved.substitute, true, `${where}: a substitute`);
        assert.equal(resolved.compatibility, "visual", `${where}: visual`);
        assert.notEqual(resolved.resolvedFamily, "Roboto", `${where}: no generic fallback`);
        if (codeTable) assert.equal(resolved.symbolEncoding, name, `${where}: carries the encoding`);
        else {
          assert.equal(resolved.resolvedWeight, expectedWeight(entry.route, bold), `${where} ${bold ? "bold" : "regular"}: the route's nearest weight`);
          assert.equal(resolved.sizeAdjust, entry.sizeAdjust, `${where}: the policy sizeAdjust`);
        }
        resolutionChecks += 1;
      }
      // Render: strictly for a script, emoji or math name; through the code map for a code table.
      const notes = [], diagnostics = [];
      let svg;
      if (codeTable) svg = toSvg(deck, 1, { fonts: { textMeasurement: registry.textMeasurement }, onDiagnostic: (value) => diagnostics.push(value) });
      else {
        const strict = createScriptTextMeasurement(registry.textMeasurement, resolveScriptFonts(deck), { glyphFallback: "none", onFallback: (note) => notes.push(note) });
        svg = toSvg(deck, 1, { fonts: { textMeasurement: strict }, glyphFallback: "none", onDiagnostic: (value) => diagnostics.push(value) });
      }
      const fallbacks = diagnostics.filter((value) => /glyph-fallback|missing-glyph/.test(value.code));
      assert.ok(!fallbacks.some((value) => value.code === "missing-glyph"), `${where}: no missing glyph`);
      if (codeTable) {
        for (const value of fallbacks) {
          assert.deepEqual([value.fontFamily, value.scripts], [name, ["Zsym"]], `${where}: only the code map (${value.message})`);
          assert.ok(entry.chain.includes(value.fallbackFamily) && !value.placeholder, `${where}: mapped to ${value.fallbackFamily}, no placeholder`);
        }
      } else if (script.via === "policy") assert.deepEqual([...notes, ...fallbacks], [], `${where}: no glyph fallback`);
      else {
        for (const value of [...notes, ...fallbacks]) assert.ok([name, entry.route].includes(value.fontFamily) && value.fallbackFamily === script.route && JSON.stringify(value.scripts) === JSON.stringify([script.script]), `${where}: the only fallback is ${entry.route} to ${script.route} for ${script.script}`);
      }
      const runs = drawnRuns(svg);
      assert.ok(runs.length >= (codeTable ? 2 : 3), `${where}: the deck draws its runs (${runs.length})`);
      if (codeTable) {
        for (const run of runs) {
          for (const character of squash(run.text)) assert.ok(faceOf.get(character)?.includes(run.family), `${where}: ${character} is drawn in ${faceOf.get(character)?.join(" or ")}, not ${run.family}`);
          runChecks += 1;
        }
        const mapped = squash(mappedText(name, sample.codes));
        assert.equal(squash(runs.map((run) => run.text).join("")), mapped + mapped, `${where}: every code is drawn, regular and bold`);
      } else {
        if (entry.sizeAdjust) {
          const plain = drawnRuns(toSvg(nameDeck(entry.route, sample), 1, { fonts: { textMeasurement: registry.textMeasurement } }));
          assert.deepEqual(runs.map((run) => run.size), plain.map((run) => adjustedFontSize(run.size, entry.sizeAdjust)), `${where}: drawn at the route's sizes times ${entry.sizeAdjust}`);
        }
        const weights = new Set();
        for (const run of runs) {
          assert.equal(run.family, script.route, `${where}: "${[...run.text].slice(0, 12).join("")}" is drawn in ${script.route}, not ${run.family}`);
          assert.ok(weightsOf(script.route).includes(run.weight), `${where}: weight ${run.weight} is one of ${script.route}'s`);
          assert.ok(Number.isFinite(run.length) && run.length > 0, `${where}: the run is pinned to an advance (${run.length})`);
          weights.add(run.weight);
          runChecks += 1;
        }
        assert.ok(runs.some((run) => squash(run.text) === squash(sample.text)), `${where}: a run carries the whole sample`);
        for (const bold of [false, true]) assert.ok(weights.has(expectedWeight(script.route, bold)), `${where}: the ${bold ? "bold" : "regular"} weight of ${script.route} is drawn`);
      }
      row.samples.push(sample.id);
    }
    for (const family of faces) {
      const pkg = packageOf(family);
      for (const face of pkg.faces) if (face.family === family && !face.italic) { const file = `${shortName(pkg.name)}/${face.file}`; if (!row.files.includes(file)) row.files.push(file); }
    }
    row.scripts.push({ script: script.script, route: script.route, via: script.via, samples: script.samples.map((sample) => sample.id) });
  }
  row.lazyBytes = (await Promise.all(row.files.map(async (file) => { try { return (await stat(path.join(SCRIPTS_ROOT, file))).size; } catch { return 0; } }))).reduce((a, b) => a + b, 0);
  report.push(row);
}
assert.equal(domDocument.fonts.size, registry.describeFaces().length, "the document holds the registry's faces");
fonts.dispose();
assert.equal(documentFonts.size, 0, "dispose removes every face");
assert.deepEqual(vendored, [], "no vendored face is fetched: the decks draw only their route faces");
const total = new Set(served);
await mkdir(outDirectory, { recursive: true });
await writeFile(path.join(outDirectory, "editor.json"), `${JSON.stringify({ node: process.version, renderer: JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8")).version, families: report.length, resolutionChecks, runChecks, filesFetchedInTotal: total.size, findings: [], report }, null, 1)}\n`);
console.log(`Font gate script names: ${report.length} proprietary names through the editor's gate, ${resolutionChecks} resolutions to their policy routes, ${runChecks} runs drawn in their route faces, ${total.size} pinned files fetched in total.`);
