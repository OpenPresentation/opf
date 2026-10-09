// RR-17 (FF-41): every Latin family has its own fixture in the editor host. The font gate (the one path every document-replacing
// action goes through: Source Apply, gallery handoff, import, slide navigation, undo and redo, font-scheme switches) is driven with
// the real renderer registry in a fake document with a local fetch, starting from the 33 eager faces. For every family the renderer's
// policy names (proprietary Latin families that route to a bundled open face, open Latin families, and the renamed or twin aliases), a
// deck draws the family as heading and body in the four styles, and the gate must
//   - report pending exactly the vendored files the deck draws (face level: no whole families, nothing for a face already loaded),
//   - load them hash-verified, then report nothing pending, with nothing else fetched,
//   - leave a registry in which each of the four styles resolves to the family's route (the policy replacement, the alias target or the
//     family itself) and never to the generic fallback (Roboto),
//   - hold every face the renderer says the deck draws (`presentationFaces`), and
//   - render the deck strictly (a style the route lacks draws its upright face and says visual; the deck is never refused).
// The expectation is read from the installed renderer's policy table and pinned manifest, so it follows the renderer this editor is
// tested with; a renderer without a row (older than the rows RR-17 adds) simply has fewer families. It writes
// artifacts/latin-family-hosts/editor.json (per family: files fetched, bytes) for the evidence behind the tracker.
import assert from "node:assert/strict";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fontGate } from "../dist/font-gate.js";
import { BUNDLED_FONT_MANIFEST, loadFonts } from "@openpresentation/opf-render/fonts-node";
import { FONT_POLICY, fontPolicyFor } from "@openpresentation/opf-render/fonts";
import * as browserFonts from "@openpresentation/opf-render/fonts-browser";
import { toSvg } from "@openpresentation/opf-render/svg";

const packageRoot = path.dirname(fileURLToPath(import.meta.resolve("@openpresentation/opf-render/package.json")));
const outDirectory = path.resolve(process.argv[2] ?? "artifacts/latin-family-hosts");
// The 33 eager office and base faces, as a gallery or playground registry starts.
const eagerFaces = (await loadFonts({ pack: "office" })).registry.embeddedFonts.map((face, index) => ({ index, family: face.family, weight: face.weight, italic: !!face.italic, data: new Uint8Array(Buffer.from(face.dataUrl.split(",")[1], "base64")) }));
assert.equal(eagerFaces.length, 33, "the eager list is the 33 office and base faces");

class Face { constructor(family, bytes, descriptors) { Object.assign(this, { family, bytes, descriptors }); } async load() { return this; } }
const documentFonts = new Set(); documentFonts.ready = Promise.resolve();
const domDocument = { fonts: documentFonts, defaultView: { FontFace: Face } };
const served = [];
const fetchLocal = async (url) => {
  const file = url.replace("https://fonts.example/", "");
  served.push(file);
  try {
    const bytes = await readFile(path.join(packageRoot, file));
    return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  } catch { return { ok: false, status: 404 }; }
};
const fonts = await browserFonts.loadFonts({ faces: eagerFaces.map((face) => ({ ...face })), document: domDocument, fetch: fetchLocal, substitutionPolicy: "visual", fallbackFamily: "Roboto", lazyFontsBaseUrl: "https://fonts.example/" });
const registry = fonts.registry;
const gate = fontGate(fonts);

// ---- the families and their routes, from the renderer's own policy and manifest ----
const LATIN_PACKS = new Set(["base", "office", "open"]);
const manifest = BUNDLED_FONT_MANIFEST.packages;
const lazyPackage = (pkg) => Boolean(pkg.vendored) && (pkg.pack === "open" || pkg.embed === "used");
const facesOf = (family) => manifest.flatMap((pkg) => pkg.faces.filter((face) => face.family.toLowerCase() === family.toLowerCase()).map((face) => ({ ...face, pack: pkg.pack, lazy: lazyPackage(pkg), file: pkg.vendored ? `${pkg.vendored}/${face.file}` : null })));
const aliases = Object.fromEntries(manifest.filter((pkg) => pkg.pack === "open" && pkg.renamedFrom).map((pkg) => [pkg.renamedFrom.toLowerCase(), pkg.faces[0].family]));
const families = [];
for (const row of FONT_POLICY.families) {
  let route, tier;
  if (row.replacement) { route = row.replacement.family; tier = row.replacement.compatibility; } else if (facesOf(row.family).length) { route = row.family; tier = "exact"; } else continue;
  if (aliases[row.family.toLowerCase()]) { route = aliases[row.family.toLowerCase()]; tier = "visual"; }
  const faces = facesOf(route);
  if (!faces.length || !faces.every((face) => LATIN_PACKS.has(face.pack))) continue; // script and special families belong to the script fixtures
  families.push({ family: row.family, route, tier, faces });
}
assert.ok(families.length >= 60, `the fixture covers ${families.length} Latin families`);
for (const name of ["Aptos", "Aptos Narrow", "Arial", "Calibri", "Garamond", "Segoe UI", "Impact", "Raleway", "Playfair Display"]) assert.ok(families.some((entry) => entry.family === name), `${name} is in the fixture`);

const deckFor = (family) => ({
  name: `Latin fixture ${family}`,
  design: { fontScheme: "x-latin-fixture" },
  catalogs: { custom: { fontSchemes: { "x-latin-fixture": { name: family, app: "powerpoint", languageFamily: "latin", languages: [], major: family, minor: family, textSample: "x", type: "sans-serif" } } } },
  slides: [{ id: "a", title: "Quarterly review", text: [{ text: "Regular" }, " ", { text: "Bold", bold: true }, " ", { text: "Italic", italic: true }, " ", { text: "BoldItalic", bold: true, italic: true }] }],
});
const key = (face) => `${face.family.toLowerCase()}|${face.weight}|${face.italic ? "i" : ""}`;
const lazyFiles = new Map(manifest.filter(lazyPackage).flatMap((pkg) => pkg.faces.map((face) => [`${pkg.vendored}/${face.file}`, key(face)])));
const fileOfKey = new Map([...lazyFiles].map(([file, faceKey]) => [faceKey, file]));
const size = async (file) => (await stat(path.join(packageRoot, file))).size;

const report = [];
let styleChecks = 0;
for (const entry of families) {
  const deck = deckFor(entry.family);
  const pending = gate.pending(deck);
  const before = served.length;
  await gate.ensure(deck);
  const fetched = served.slice(before);
  // Face level: what is pending is what is fetched, each once, and only vendored files of the route family.
  assert.deepEqual([...fetched].sort(), [...pending].sort(), `${entry.family}: the gate loads exactly what it reported pending`);
  assert.ok(fetched.every((file) => lazyFiles.has(file) && lazyFiles.get(file).startsWith(`${entry.route.toLowerCase()}|`)), `${entry.family}: only ${entry.route} files are fetched (${fetched.join(", ")})`);
  assert.deepEqual(gate.pending(deck), [], `${entry.family}: nothing is pending after ensure`);
  // The styles resolve to the route, never to the generic fallback.
  for (const [fontWeight, italic] of [[400, false], [700, false], [400, true], [700, true]]) {
    const resolved = registry.resolveFont({ fontFamily: entry.family, fontWeight, italic });
    assert.equal(resolved.resolvedFamily, entry.route, `${entry.family} ${fontWeight}${italic ? "i" : ""}: draws ${entry.route}`);
    if (entry.route !== "Roboto") assert.notEqual(resolved.compatibility, "generic", `${entry.family}: no generic fallback`);
    styleChecks += 1;
  }
  // Every face the deck draws is held, and it is the route family's.
  const held = new Set(registry.describeFaces().map(key));
  const drawn = browserFonts.presentationFaces(deck, {}, { faces: registry.describeFaces(), policy: "visual", aliases: new Map(Object.entries(aliases)), fallbackFamily: "Roboto" });
  assert.ok(drawn.length >= 1, `${entry.family}: the deck draws faces`);
  for (const face of drawn) {
    assert.equal(face.family.toLowerCase(), entry.route.toLowerCase(), `${entry.family}: the deck draws ${face.family}, not ${entry.route}`);
    assert.ok(held.has(key(face)), `${entry.family}: ${face.family} ${face.weight}${face.italic ? "i" : ""} is loaded`);
  }
  // Strict render with the registry's measurement: a style gap never refuses the deck.
  const svg = toSvg(deck, 1, { fonts });
  assert.ok(svg.includes("Regular") && svg.includes("BoldItalic"), `${entry.family}: the deck renders`);
  // What a deck of this family needs (face level), independent of what earlier families already loaded in this session.
  const needed = [...new Set(drawn.map((face) => fileOfKey.get(key(face))).filter(Boolean))].sort();
  report.push({ family: entry.family, route: entry.route, files: needed, lazyBytes: (await Promise.all(needed.map(size))).reduce((a, b) => a + b, 0), fetchedAfterEarlierFamilies: fetched.length, faces: drawn.length });
}
assert.deepEqual(domDocument.fonts.size, registry.describeFaces().length, "the document holds the registry's faces");
fonts.dispose();
assert.equal(documentFonts.size, 0, "dispose removes every face");
const total = new Set(served);
await mkdir(outDirectory, { recursive: true });
await writeFile(path.join(outDirectory, "editor.json"), `${JSON.stringify({ node: process.version, renderer: JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8")).version, families: report.length, styleChecks, filesFetchedInTotal: total.size, report }, null, 1)}\n`);
console.log(`Font gate Latin families: ${report.length} families through the editor's gate, ${styleChecks} family-styles resolved to their route, ${total.size} vendored files fetched in total, each only when a family needed it.`);
