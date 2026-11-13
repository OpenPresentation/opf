// LH-106: the editor's font gate (the path every document-replacing action takes) loads the faces of the digits a slide generates, not only
// those of its authored text. An ar-SA deck titled "T" with the metric 1000 draws ١٬٠٠٠ and ٩٩٩: the gate reports the Arabic package
// pending, loads it, and the deck then renders strictly (`glyphFallback: 'none'`: a missing glyph raises). The same deck tagged
// `ar-SA-u-nu-latn` draws Latin digits and needs no Arabic face. Run with the browser font loader, a fake document and a local fetch.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fontGate } from "../dist/font-gate.js";
import { loadFonts } from "@openpresentation/opf-render/fonts-node";
import * as browserFonts from "@openpresentation/opf-render/fonts-browser";
import { toSvg } from "@openpresentation/opf-render/svg";

const root = fileURLToPath(new URL("../", import.meta.url));
const SCRIPTS_ROOT = path.join(root, "node_modules/@expo-google-fonts");
const eagerFaces = (await loadFonts({ pack: "office" })).registry.embeddedFonts.map((face, index) => ({ index, family: face.family, weight: face.weight, italic: !!face.italic, data: new Uint8Array(Buffer.from(face.dataUrl.split(",")[1], "base64")) }));
class Face { constructor(family, bytes, descriptors) { Object.assign(this, { family, bytes, descriptors }); } async load() { return this; } }
const documentFonts = new Set(); documentFonts.ready = Promise.resolve();
const domDocument = { fonts: documentFonts, defaultView: { FontFace: Face } };
const served = [];
const fetchLocal = async (url) => {
  const file = url.replace("https://fonts.example/pack/", "");
  served.push(file);
  try {
    const bytes = await readFile(path.join(SCRIPTS_ROOT, file));
    return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  } catch { return { ok: false, status: 404 }; }
};
const fonts = await browserFonts.loadFonts({ faces: eagerFaces, document: domDocument, fetch: fetchLocal, substitutionPolicy: "visual", fallbackFamily: "Roboto", scriptBaseUrl: "https://fonts.example/pack/" });
const gate = fontGate(fonts);
const deck = (language) => ({ language, design: { fontScheme: { id: "x-roboto", major: "Roboto", minor: "Roboto" } }, slides: [{ title: "T", metric: { value: 1000, label: "L" } }, { title: "T", metric: { value: 999, label: "L" } }] });
const drawn = (svg) => [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map((match) => match[1].replace(/<[^>]+>/g, "").replace(/[⁦-⁩]/g, ""));

const latin = deck("ar-SA-u-nu-latn");
assert.ok(!gate.pending(latin).some((name) => /arabic/.test(name)), "Latin digits need no Arabic face");
await gate.ensure(latin);
assert.ok(!served.some((file) => /arabic/.test(file)), "no Arabic face was fetched for Latin digits");
const latinSvg = toSvg(latin, { fonts, glyphFallback: "none" });
assert.ok(drawn(latinSvg[0]).includes("1,000") && drawn(latinSvg[1]).includes("999"));

const arabic = deck("ar-SA");
const pending = gate.pending(arabic);
assert.ok(pending.some((name) => /arabic/.test(name)), `the generated Arabic-Indic digits are pending (${pending.join(", ")})`);
await gate.ensure(arabic);
assert.deepEqual(gate.pending(arabic), []);
assert.ok(served.some((file) => /arabic/.test(file)), "an Arabic face was fetched");
const svgs = toSvg(arabic, { fonts, glyphFallback: "none" });
assert.ok(drawn(svgs[0]).includes("١,٠٠٠"), "1000 draws ١,٠٠٠");
assert.ok(drawn(svgs[1]).includes("٩٩٩"), "999 draws ٩٩٩, in the same digits");
console.log("font gate generated numerals: ok");
