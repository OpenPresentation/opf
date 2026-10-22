// FF-41, RR-55: the font gate over the real renderer fonts handle (in a fake document with a local fetch).
//   - a deck whose font scheme exists only in the host's catalogs loads its faces when the gate is given those catalogs (per call, or as the
//     handle's own `renderOptions`); without them the scheme falls back to the default and the deck needs the default scheme's faces,
//   - a layout id nobody knows composes with no layout record and never makes the gate fail,
//   - loading is face level: a plain Aptos deck fetches the two faces it draws, not all eight,
//   - an edit that adds an italic run loads just that face,
//   - a script face loads for a document whose other ids do not resolve.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fontGate } from "../dist/font-gate.js";
import { loadFonts } from "@openpresentation/opf-render/fonts-node";
import * as browserFonts from "@openpresentation/opf-render/fonts-browser";

const packageRoot = path.dirname(fileURLToPath(import.meta.resolve("@openpresentation/opf-render/package.json")));
const eager = (await loadFonts()).registry.embeddedFonts.map((face, index) => ({ index, family: face.family, weight: face.weight, italic: !!face.italic, data: new Uint8Array(Buffer.from(face.dataUrl.split(",")[1], "base64")) }));

class Face { constructor(family, bytes, descriptors) { Object.assign(this, { family, bytes, descriptors }); } async load() { return this; } }
const documentFonts = new Set(); documentFonts.ready = Promise.resolve();
const domDocument = { fonts: documentFonts, defaultView: { FontFace: Face } };
const served = [];
const fetchLocal = async (url) => {
  const file = url.replace("https://fonts.example/", "");
  served.push(file);
  try {
    // Script faces come from the installed @expo-google-fonts packages, vendored faces from the renderer package.
    const script = file.startsWith("scripts/") ? file.split("/") : undefined;
    const bytes = await readFile(script ? path.join(path.dirname(fileURLToPath(import.meta.resolve(`@expo-google-fonts/${script[1]}/package.json`))), ...script.slice(2)) : path.join(packageRoot, file));
    return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  } catch { return { ok: false, status: 404 }; }
};
const newFonts = (extra = {}) => browserFonts.loadFonts({ faces: eager.map((face) => ({ ...face })), ...extra, document: domDocument, fetch: fetchLocal, substitutionPolicy: "visual", fallbackFamily: "Roboto", lazyFontsBaseUrl: "https://fonts.example/", scriptBaseUrl: "https://fonts.example/scripts/" });
const names = (files) => files.map((file) => file.split("/").pop()).sort();

// A font scheme only the host's catalogs have: Lora, a vendored open family, under the host's own id. OPF 0.15: the host registers a
// Catalog[]; the first is the host default, so the bare id resolves in it.
const catalogs = [{ source: "pkg:host", fontSchemes: { "host-lora": { name: "Host Lora", major: "Lora", minor: "Lora" } } }];
const hostDeck = { name: "Host scheme", design: { fontScheme: "host-lora" }, slides: [{ title: "Quarterly review", items: ["Revenue grew in every region."] }] };
{
  const fonts = await newFonts();
  const gate = fontGate(fonts);
  // Without the catalogs the scheme id is unknown: core falls back to the engine default (Aptos) and the gate reports the faces it draws.
  assert.deepEqual(names(gate.pending(hostDeck)), ["Intos-Regular.ttf", "IntosDisplay-Bold.ttf"].sort(), "an unknown scheme id falls back to the default scheme's two faces");
  // With them the deck draws Lora: its regular and bold faces.
  assert.deepEqual(names(gate.pending(hostDeck, { catalogs })), ["Lora-Bold.ttf", "Lora-Regular.ttf"], "the catalog-only scheme resolves and needs its two faces");
  await gate.ensure(hostDeck, { renderOptions: { catalogs } });
  assert.deepEqual(names(served), ["Lora-Bold.ttf", "Lora-Regular.ttf"], "face level: two files, not the four of Lora");
  assert.deepEqual(gate.pending(hostDeck, { catalogs }), []);

  // An edit that adds an italic run needs one more face; only it is fetched.
  const edited = { ...hostDeck, slides: [{ title: "Quarterly review", text: ["Revenue grew in ", { text: "every", italic: true }, " region."] }] };
  assert.deepEqual(names(gate.pending(edited, { catalogs })), ["Lora-Italic.ttf"], "the italic edit reports just the new face");
  served.length = 0;
  await gate.ensure(edited, { renderOptions: { catalogs } });
  assert.deepEqual(served, ["fonts/lora/Lora-Italic.ttf"]);
  fonts.dispose();
}

// The handle's own `renderOptions` (loadFonts({ renderOptions: { catalogs } })) are the default for every call: no per-call options needed.
{
  served.length = 0;
  const fonts = await newFonts({ renderOptions: { catalogs } });
  const gate = fontGate(fonts);
  const bold = { ...hostDeck, slides: [{ title: "Quarterly review", text: ["Revenue ", { text: "grew", bold: true }, "."] }] };
  assert.deepEqual(names(gate.pending(bold)), ["Lora-Bold.ttf", "Lora-Regular.ttf"]);
  await gate.ensure(bold);
  assert.deepEqual(names(served), ["Lora-Bold.ttf", "Lora-Regular.ttf"]);
  fonts.dispose();
}

// A layout id nobody knows composes with no layout record (never an error), and the gate reports the faces of what is drawn.
{
  served.length = 0;
  const fonts = await newFonts();
  const gate = fontGate(fonts);
  const unknownLayout = { name: "Unknown layout", slides: [{ layout: "no-such-layout", title: "Quarterly review", items: ["Revenue grew in every region."] }] };
  assert.deepEqual(names(gate.pending(unknownLayout)), ["Intos-Regular.ttf", "IntosDisplay-Bold.ttf"].sort());
  await gate.ensure(unknownLayout);
  assert.deepEqual(gate.pending(unknownLayout), []);
  fonts.dispose();
}

// A script face loads for a Japanese document under an unknown layout.
{
  served.length = 0;
  const fonts = await newFonts();
  const gate = fontGate(fonts);
  const japanese = { name: "ja", language: "ja", slides: [{ layout: "host-bullets", title: "こんにちは", items: ["日本語"] }] };
  assert.ok(gate.pending(japanese).includes("@expo-google-fonts/noto-sans-jp"), "the script package is pending");
  await gate.ensure(japanese);
  assert.ok(served.some((file) => file.split("/")[1] === "noto-sans-jp"), "the Japanese faces are fetched");
  assert.deepEqual(gate.pending(japanese), []);
  fonts.dispose();
}
assert.equal(documentFonts.size, 0, "dispose removes every face");
console.log("Font gate registry: a catalog-only font scheme resolves, loading is face level, an italic edit loads one face, an unknown layout never fails the gate, script faces load.");
