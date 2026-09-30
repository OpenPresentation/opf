// FF-41: the font gate with the real renderer registry (@openpresentation/opf-render 0.11.5+, in a fake document with a local fetch).
//   - a deck whose layout id exists only in the host's catalogs loads its faces when the gate is given those catalogs,
//   - loading is face level: a plain Aptos deck fetches the two faces it draws, not all eight,
//   - an edit that adds an italic run loads just that face,
//   - a document the lazy loader cannot resolve still reports (and loads) its script faces.
// Skipped with a renderer that lacks the options (older than 0.11.5).
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { layouts } from "@openpresentation/opf/catalogs";
import { createFontGate } from "../dist/font-gate.js";
import { loadBundledFontRegistry } from "@openpresentation/opf-render/fonts-node";
import * as browserFonts from "@openpresentation/opf-render/fonts-browser";

if (typeof browserFonts.presentationFaces !== "function") {
  console.log("Font gate registry skipped: the installed renderer predates face-level lazy fonts (0.11.5).");
  process.exit(0);
}
const packageRoot = path.dirname(fileURLToPath(import.meta.resolve("@openpresentation/opf-render/package.json")));
const eager = (await loadBundledFontRegistry()).embeddedFonts.map((face, index) => ({ index, family: face.family, weight: face.weight, italic: !!face.italic, data: new Uint8Array(Buffer.from(face.dataUrl.split(",")[1], "base64")) }));

class Face { constructor(family, bytes, descriptors) { Object.assign(this, { family, bytes, descriptors }); } async load() { return this; } }
const fonts = new Set(); fonts.ready = Promise.resolve();
const document = { fonts, defaultView: { FontFace: Face } };
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
const newRegistry = () => browserFonts.loadBrowserFontRegistry(eager.map((face) => ({ ...face })), { document, fetch: fetchLocal, substitutionPolicy: "visual", fallbackFamily: "Roboto", lazyFontsBaseUrl: "https://fonts.example/", scriptBaseUrl: "https://fonts.example/scripts/" });
const names = (files) => files.map((file) => file.split("/").pop()).sort();

// A layout id only the host's catalogs have: `list-1x` under the host's own id.
const catalogs = { layouts: [{ ...layouts.find((entry) => entry.id === "list-1x"), id: "host-bullets", name: "Host bullets" }] };
const hostDeck = { name: "Host layout", slides: [{ layout: "host-bullets", title: "Quarterly review", items: ["Revenue grew in every region."] }] };
{
  const registry = await newRegistry();
  const gate = createFontGate(registry);
  // Without the catalogs the renderer cannot resolve the document: nothing is reported (the render reports it), nothing is fetched.
  assert.deepEqual(gate.pending(hostDeck), []);
  await gate.ensure(hostDeck);
  assert.deepEqual(served, []);
  // With them the gate gates the Aptos deck: the two faces it draws.
  assert.deepEqual(names(gate.pending(hostDeck, { catalogs })), ["Intos-Regular.ttf", "IntosDisplay-Bold.ttf"].sort(), "the catalog-only layout resolves and needs its two faces");
  await gate.ensure(hostDeck, { renderOptions: { catalogs } });
  assert.deepEqual(names(served), ["Intos-Regular.ttf", "IntosDisplay-Bold.ttf"].sort(), "face level: two files, not the eight of Intos and Intos Display");
  assert.deepEqual(gate.pending(hostDeck, { catalogs }), []);

  // An edit that adds an italic run needs one more face; only it is fetched.
  const edited = { name: "Host layout", slides: [{ layout: "host-bullets", title: "Quarterly review", text: ["Revenue grew in ", { text: "every", italic: true }, " region."] }] };
  assert.deepEqual(names(gate.pending(edited, { catalogs })), ["Intos-Italic.ttf"], "the italic edit reports just the new face");
  served.length = 0;
  await gate.ensure(edited, { renderOptions: { catalogs } });
  assert.deepEqual(served, ["fonts/intos/Intos-Italic.ttf"]);
  // A gate created with the host's options as a getter needs no per-call options.
  const bold = { name: "Host layout", slides: [{ layout: "host-bullets", title: "Quarterly review", text: ["Revenue ", { text: "grew", bold: true }, "."] }] };
  const hostGate = createFontGate(registry, { renderOptions: () => ({ catalogs }) });
  assert.deepEqual(names(hostGate.pending(bold)), ["Intos-Bold.ttf"]);
  served.length = 0;
  await hostGate.ensure(bold);
  assert.deepEqual(served, ["fonts/intos/Intos-Bold.ttf"]);
  registry.dispose();
}

// A document the lazy loader cannot resolve still reports its script faces (Japanese text under an unknown layout).
{
  served.length = 0;
  const registry = await newRegistry();
  const gate = createFontGate(registry);
  const japanese = { name: "ja", language: "ja", slides: [{ layout: "host-bullets", title: "こんにちは", items: ["日本語"] }] };
  assert.deepEqual(gate.pending(japanese), ["@expo-google-fonts/noto-sans-jp"], "the script package is still pending although the layout does not resolve");
  await gate.ensure(japanese);
  assert.deepEqual(served.map((file) => file.split("/")[1]), ["noto-sans-jp", "noto-sans-jp"], "only the Japanese faces are fetched, no vendored face");
  assert.deepEqual(gate.pending(japanese), []);
  registry.dispose();
}
assert.equal(fonts.size, 0, "dispose removes every face");
console.log("Font gate registry: catalog-only layouts resolve, loading is face level, an italic edit loads one face, script faces load for a document lazy fonts cannot resolve.");
