// RR-17 (FF-44, FF-45): every open script, emoji and math family has its own fixture in the editor host. The font gate (the one path every
// document-replacing action goes through: Source Apply, gallery handoff, import, slide navigation, undo and redo, font-scheme switches)
// is driven with the real renderer registry in a fake document with a local fetch, starting from the 33 eager faces. For each of the 35
// families of the renderer's `scripts` pack, a deck that names the family as its Latin, East Asian and complex-script font and draws the
// samples of its script (test/fixtures/script-family-samples.json: original FF-44 corpus text and the FF-45 emoji and math samples that
// every face of the family covers completely) goes through the gate, which must
//   - report pending only packages of the family's scripts, load them (each fetched file hash-verified by the loader), then report
//     nothing pending, with nothing outside the family's script packages fetched,
//   - leave a registry that holds the family's pinned faces and resolves each style to the family itself, as `exact` (a missing weight
//     takes the nearest face and is reported `visual`), never to a substitute or the generic fallback (Roboto), and
//   - render the deck strictly (`glyphFallback: 'none'`: a missing glyph raises, no fallback note is made) with every run drawn in the
//     family and pinned to a finite advance.
// The expectation is read from the installed renderer's pinned manifest, so it follows the renderer this editor is tested with. It writes
// artifacts/script-family-hosts/editor.json (per family: package, files, bytes, samples) for the evidence behind the tracker.
import assert from "node:assert/strict";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as core from "@openpresentation/opf";
import { createFontGate } from "../dist/font-gate.js";
import { BUNDLED_FONT_MANIFEST, prepareNodeFonts } from "@openpresentation/opf-render/fonts-node";
import { createScriptTextMeasurement } from "@openpresentation/opf-render/fonts";
import * as browserFonts from "@openpresentation/opf-render/fonts-browser";
import { renderSvg } from "@openpresentation/opf-render/svg";

if (typeof browserFonts.presentationFaces !== "function" || typeof createScriptTextMeasurement !== "function") {
  console.log("Font gate script families skipped: the installed renderer predates face-level lazy fonts (0.11.5) or script-aware measurement.");
  process.exit(0);
}
const root = fileURLToPath(new URL("../", import.meta.url));
const packageRoot = path.dirname(fileURLToPath(import.meta.resolve("@openpresentation/opf-render/package.json")));
const outDirectory = path.resolve(process.argv[2] ?? "artifacts/script-family-hosts");
const samples = JSON.parse(await readFile(path.join(root, "test/fixtures/script-family-samples.json"), "utf8"));
const SCRIPTS_ROOT = path.join(root, "node_modules/@expo-google-fonts");
const shortName = (name) => name.replace("@expo-google-fonts/", "");

// The 33 eager office and base faces, as a gallery or playground registry starts.
const eagerFaces = (await prepareNodeFonts({ pack: "office" })).registry.embeddedFonts.map((face, index) => ({ index, family: face.family, weight: face.weight, italic: !!face.italic, data: new Uint8Array(Buffer.from(face.dataUrl.split(",")[1], "base64")) }));
assert.equal(eagerFaces.length, 33, "the eager list is the 33 office and base faces");

class Face { constructor(family, bytes, descriptors) { Object.assign(this, { family, bytes, descriptors }); } async load() { return this; } }
const fonts = new Set(); fonts.ready = Promise.resolve();
const document = { fonts, defaultView: { FontFace: Face } };
const served = [];
const fetchLocal = async (url) => {
  const file = url.replace("https://fonts.example/pack/", "");
  served.push(file);
  try {
    const bytes = await readFile(path.join(SCRIPTS_ROOT, file));
    return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  } catch { return { ok: false, status: 404 }; }
};
const registry = await browserFonts.loadBrowserFontRegistry(eagerFaces.map((face) => ({ ...face })), { document, fetch: fetchLocal, substitutionPolicy: "visual", fallbackFamily: "Roboto", scriptBaseUrl: "https://fonts.example/pack/" });
const gate = createFontGate(registry);

// ---- the families and their packages, from the renderer's own manifest ----
const SYMBOL_ONLY = ["Zsym"];
const families = BUNDLED_FONT_MANIFEST.packages
  .filter((pkg) => pkg.pack === "scripts" && !pkg.scripts.every((script) => SYMBOL_ONLY.includes(script)))
  .map((pkg) => {
    const faces = pkg.faces.map((face) => ({ ...face, served: `${shortName(pkg.name)}/${face.file}` }));
    return { family: pkg.faces[0].family, package: pkg.name, scripts: pkg.scripts.filter((script) => !SYMBOL_ONLY.includes(script)), faces, weights: [...new Set(faces.filter((face) => !face.italic).map((face) => face.weight))].sort((a, b) => a - b) };
  });
assert.equal(families.length, 35, `the fixture covers ${families.length} script families`);
assert.deepEqual(Object.keys(samples.families).sort(), families.map((entry) => entry.family).sort(), "the sample file names exactly the renderer's script families");
const expectedWeight = (entry, bold) => [...entry.weights].sort((a, b) => Math.abs(a - (bold ? 700 : 400)) - Math.abs(b - (bold ? 700 : 400)) || a - b)[0];

const deckFor = (entry, sample) => ({
  $schema: "https://openpresentation.org/schema/opf/v1",
  name: `Script fixture ${entry.family} ${sample.id}`,
  ...(sample.language ? { language: sample.language } : {}),
  design: { fontScheme: { id: "x-script-fixture", name: entry.family, major: entry.family, minor: entry.family, eastAsian: { major: entry.family, minor: entry.family }, complexScript: { major: entry.family, minor: entry.family } } },
  slides: [{ id: "a", title: sample.text, text: [{ text: sample.text }, { text: sample.text, bold: true }] }],
});
/** Every drawn run of an SVG: family, weight, pinned length and text (bidirectional isolate marks removed). */
function drawnRuns(svg) {
  const runs = [];
  const attributeOf = (attributes, name) => new RegExp(`\\s${name}="([^"]*)"`).exec(attributes)?.[1];
  const unquote = (value) => value?.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
  const decode = (value) => value.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16))).replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number))).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  for (const match of svg.matchAll(/<text\b([^>]*)>(.*?)<\/text>/gs)) {
    const [, attributes, content] = match;
    const owner = { family: unquote(attributeOf(attributes, "font-family")), weight: Number(attributeOf(attributes, "font-weight") ?? 400), length: attributeOf(attributes, "textLength") };
    if (!content.includes("<tspan")) { runs.push({ ...owner, length: Number(owner.length), text: decode(content) }); continue; }
    for (const span of content.matchAll(/<tspan\b([^>]*)>([^<]*)<\/tspan>/g)) {
      const [, own, text] = span;
      runs.push({ family: unquote(attributeOf(own, "font-family")) ?? owner.family, weight: Number(attributeOf(own, "font-weight") ?? owner.weight), length: Number(attributeOf(own, "textLength")), text: decode(text) });
    }
  }
  return runs.map((run) => ({ ...run, text: run.text.replace(/[⁦-⁩‎‏‪-‮]/g, "") })).filter((run) => run.text.trim());
}
const size = async (entry) => (await Promise.all(entry.faces.map(async (face) => (await stat(path.join(SCRIPTS_ROOT, face.served))).size))).reduce((a, b) => a + b, 0);

const report = [];
let styleChecks = 0, runChecks = 0;
const loaded = new Set();
for (const entry of families) {
  const where = entry.family;
  const row = { family: entry.family, route: entry.family, package: shortName(entry.package), scripts: entry.scripts, files: entry.faces.map((face) => face.served), weights: entry.weights, samples: [], fetchedAfterEarlierFamilies: 0 };
  for (const sample of samples.families[entry.family].samples) {
    const deck = deckFor(entry, sample);
    const pending = gate.pending(deck);
    const before = served.length;
    await gate.ensure(deck);
    const fetched = served.slice(before);
    // Only script packages are pending (no vendored face), the gate loads exactly those, and only files of those packages are fetched.
    assert.ok(pending.every((name) => name.startsWith("@expo-google-fonts/")), `${where} ${sample.id}: pending names script packages (${pending.join(", ")})`);
    assert.ok(pending.every((name) => !loaded.has(name)), `${where} ${sample.id}: nothing already loaded is pending`);
    assert.ok(fetched.every((file) => pending.some((name) => file.startsWith(`${shortName(name)}/`))), `${where} ${sample.id}: only the pending packages' files are fetched (${fetched.join(", ")})`);
    assert.equal(new Set(fetched).size, fetched.length, `${where}: no file is fetched twice`);
    for (const name of pending) loaded.add(name);
    assert.deepEqual(gate.pending(deck), [], `${where} ${sample.id}: nothing is pending after ensure`);
    row.fetchedAfterEarlierFamilies += fetched.length;
    // The registry holds the family's pinned faces and resolves the styles to the family itself.
    const held = registry.describeFaces().filter((face) => face.family === entry.family).map((face) => `${face.weight}${face.italic ? "i" : ""}`).sort();
    assert.deepEqual(held, entry.faces.map((face) => `${face.weight}${face.italic ? "i" : ""}`).sort(), `${where} ${sample.id}: the registry holds the pinned faces`);
    for (const bold of [false, true]) {
      const resolved = registry.resolveFont({ fontFamily: entry.family, fontWeight: bold ? 700 : 400, italic: false });
      assert.equal(resolved.resolvedFamily, entry.family, `${where} ${bold ? "bold" : "regular"}: draws ${entry.family}`);
      assert.equal(resolved.resolvedWeight, expectedWeight(entry, bold), `${where} ${bold ? "bold" : "regular"}: the nearest weight`);
      assert.equal(resolved.compatibility, entry.weights.includes(bold ? 700 : 400) ? "exact" : "visual", `${where} ${bold ? "bold" : "regular"}: exact, or visual for a missing weight`);
      assert.equal(resolved.substitute, false, `${where} ${bold ? "bold" : "regular"}: no substitute`);
      assert.notEqual(resolved.resolvedFamily, "Roboto", `${where}: no generic fallback`);
      styleChecks += 1;
    }
    // Strict render with the registry's measurement: every run is drawn in the family.
    const notes = [];
    const strict = createScriptTextMeasurement(registry.textMeasurement, core.resolveScriptFonts(deck), { glyphFallback: "none", onFallback: (note) => notes.push(note) });
    const svg = renderSvg(deck, { textMeasurement: strict, glyphFallback: "none", onDiagnostic: (value) => { if (/glyph-fallback|missing-glyph/.test(value.code)) notes.push(value); } });
    assert.deepEqual(notes, [], `${where} ${sample.id}: no glyph fallback`);
    const runs = drawnRuns(svg);
    assert.ok(runs.length >= 3, `${where} ${sample.id}: the deck draws its title and two body runs (${runs.length})`);
    const weights = new Set();
    for (const run of runs) {
      assert.equal(run.family, entry.family, `${where} ${sample.id}: "${[...run.text].slice(0, 12).join("")}" is drawn in ${entry.family}, not ${run.family}`);
      assert.ok(entry.weights.includes(run.weight), `${where} ${sample.id}: weight ${run.weight} is one of the family's`);
      assert.ok(Number.isFinite(run.length) && run.length > 0, `${where} ${sample.id}: the run is pinned to an advance (${run.length})`);
      weights.add(run.weight);
      runChecks += 1;
    }
    assert.ok(runs.some((run) => run.text.replace(/\s+/g, "") === sample.text.replace(/\s+/g, "")), `${where} ${sample.id}: a run carries the whole sample`);
    for (const bold of [false, true]) assert.ok(weights.has(expectedWeight(entry, bold)), `${where} ${sample.id}: the ${bold ? "bold" : "regular"} weight is drawn`);
    row.samples.push(sample.id);
  }
  row.lazyBytes = await size(entry);
  report.push(row);
}
assert.equal(document.fonts.size, registry.describeFaces().length, "the document holds the registry's faces");
registry.dispose();
assert.equal(fonts.size, 0, "dispose removes every face");
const total = new Set(served);
await mkdir(outDirectory, { recursive: true });
await writeFile(path.join(outDirectory, "editor.json"), `${JSON.stringify({ node: process.version, renderer: JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8")).version, families: report.length, styleChecks, runChecks, filesFetchedInTotal: total.size, report }, null, 1)}\n`);
console.log(`Font gate script families: ${report.length} families through the editor's gate, ${styleChecks} styles resolved to the family itself, ${runChecks} runs drawn strictly in it, ${total.size} pinned files fetched in total, each only when a document needed it.`);
