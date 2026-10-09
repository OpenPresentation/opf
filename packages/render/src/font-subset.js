// RR-65: glyph subsets for the faces an SVG embeds as @font-face data. HarfBuzz's own subsetter (hb-subset, the
// `harfbuzz-subset.wasm` of the pinned harfbuzzjs package, MIT) keeps the glyphs a slide's characters reach through the
// font's layout tables (every GSUB and GPOS feature is kept, so the browser shapes the subset exactly as the whole face),
// renumbers them and trims cmap, hmtx, GPOS and the rest to them. The module has no imports, so it is instantiated
// synchronously from its bytes and `renderSvg` stays synchronous; the same input always gives the same bytes.
//
// Only a face whose license allows it is subset: a bundled face (matched by the sha256 of its bytes against the pinned
// manifest) under an allowed license, whose family and file names do not contain one of its package's Reserved Font Names
// (a subset is a modified version, owner decision 2026-09-29), and whose OS/2 fsType allows subsetting. Every other face
// (a host's own faces, Carlito, Raleway, ...) is embedded whole, as before.

import { BUNDLED_FONT_MANIFEST } from "./font-manifest.js";
import { sha256Bytes } from "./sha256.js";
import { fsTypeOf, subsettingAllowed } from "./font-fstype.js";

const SUBSET_LICENSES = new Set(["OFL-1.1", "Apache-2.0", "MIT", "UFL-1.0"]);
const HB_MEMORY_MODE_READONLY = 1;
const HB_SUBSET_SETS_LAYOUT_FEATURE_TAG = 6;
const CACHE_LIMIT = 256;

/** The manifest faces that may be subset, by sha256: permissive license, no Reserved Font Name in the family or file name. */
const SUBSETTABLE = (() => {
  const hashes = new Set();
  for (const pkg of BUNDLED_FONT_MANIFEST.packages) {
    if (!SUBSET_LICENSES.has(pkg.license)) continue;
    const reserved = (pkg.reservedFontNames ?? []).map((name) => name.toLowerCase());
    for (const face of pkg.faces) {
      const names = `${face.family} ${face.file}`.toLowerCase();
      if (!reserved.some((name) => names.includes(name)) && /^[0-9a-f]{64}$/.test(face.sha256 ?? "")) hashes.add(face.sha256);
    }
  }
  return hashes;
})();

/** Whether a face may be subset: a permitted bundled face whose OS/2 fsType allows subsetting (and embedding). */
export function subsetPermitted(data) {
  return SUBSETTABLE.has(hexDigest(data)) && fsTypeAllowsSubset(data);
}

/** Whether the OS/2 fsType allows embedding a subset: not restricted (0x0002), not "no subsetting" (0x0100), not bitmap-only (0x0200). */
export function fsTypeAllowsSubset(data) {
  return subsettingAllowed(fsTypeOf(data));
}

function hexDigest(data) {
  return [...sha256Bytes(data)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * A synchronous subsetter over hb-subset: `subset(data, codePoints)` returns the subset font bytes, or null when HarfBuzz
 * cannot subset the face. `wasm` is the `harfbuzz-subset.wasm` bytes, a compiled WebAssembly.Module or an Instance.
 */
export function createSubsetter(wasm) {
  // A browser instantiates asynchronously (large modules may not compile synchronously on the main thread) and passes the instance.
  const instance = wasm instanceof WebAssembly.Instance ? wasm : new WebAssembly.Instance(wasm instanceof WebAssembly.Module ? wasm : new WebAssembly.Module(wasm), {});
  const exports = instance.exports;
  const required = ["memory", "malloc", "free", "hb_blob_create", "hb_blob_destroy", "hb_blob_get_length", "hb_blob_get_data", "hb_face_create", "hb_face_destroy",
    "hb_face_reference_blob", "hb_set_add", "hb_set_clear", "hb_set_invert", "hb_subset_input_create_or_fail", "hb_subset_input_destroy", "hb_subset_input_unicode_set",
    "hb_subset_input_set", "hb_subset_or_fail"];
  for (const name of required) if (!(name in exports)) throw new Error(`harfbuzz-subset.wasm has no export ${name}.`);
  return {
    subset(data, codePoints) {
      const pointer = exports.malloc(data.length);
      if (!pointer) return null;
      new Uint8Array(exports.memory.buffer, pointer, data.length).set(data);
      const blob = exports.hb_blob_create(pointer, data.length, HB_MEMORY_MODE_READONLY, 0, 0);
      const face = exports.hb_face_create(blob, 0);
      const input = exports.hb_subset_input_create_or_fail();
      let result = 0, output = null;
      try {
        if (!input) return null;
        const unicodes = exports.hb_subset_input_unicode_set(input);
        for (const codePoint of codePoints) exports.hb_set_add(unicodes, codePoint);
        // Every layout feature, not only HarfBuzz's default list: the browser shapes the subset like the whole face whatever
        // font-feature-settings the SVG asks for.
        const features = exports.hb_subset_input_set(input, HB_SUBSET_SETS_LAYOUT_FEATURE_TAG);
        exports.hb_set_clear(features);
        exports.hb_set_invert(features);
        result = exports.hb_subset_or_fail(face, input);
        if (!result) return null;
        const subsetBlob = exports.hb_face_reference_blob(result);
        const length = exports.hb_blob_get_length(subsetBlob), at = exports.hb_blob_get_data(subsetBlob, 0);
        output = length && at ? new Uint8Array(exports.memory.buffer, at, length).slice() : null;
        exports.hb_blob_destroy(subsetBlob);
        return output && glyfBeforeLastTable(output);
      } finally {
        if (result) exports.hb_face_destroy(result);
        if (input) exports.hb_subset_input_destroy(input);
        exports.hb_face_destroy(face);
        exports.hb_blob_destroy(blob);
        exports.free(pointer);
      }
    },
  };
}

// hb-subset writes glyf as the last table. fontkit reads a 10-byte glyph header even for an empty glyph (a space), so when
// the last glyph is empty it reads past the end of the file, and the vector PDF and the outline engine (which parse SVG
// @font-face data with fontkit) would fail. Table order in the file is free: glyf moves before the other tables, every table
// keeps its bytes and checksum, and head.checkSumAdjustment is recomputed for the new file.
function glyfBeforeLastTable(font) {
  const view = new DataView(font.buffer, font.byteOffset, font.byteLength);
  const count = view.getUint16(4);
  const tables = [];
  for (let index = 0; index < count; index++) {
    const at = 12 + index * 16;
    tables.push({ entry: at, tag: String.fromCharCode(font[at], font[at + 1], font[at + 2], font[at + 3]), offset: view.getUint32(at + 8), length: view.getUint32(at + 12) });
  }
  const byOffset = [...tables].sort((a, b) => a.offset - b.offset);
  if (byOffset.at(-1)?.tag !== "glyf" || byOffset.length < 2) return font;
  const order = [byOffset.at(-1), ...byOffset.slice(0, -1)];
  const padded = (length) => (length + 3) & ~3;
  const start = 12 + count * 16;
  const out = new Uint8Array(start + order.reduce((sum, table) => sum + padded(table.length), 0));
  out.set(font.subarray(0, start));
  const outView = new DataView(out.buffer);
  let offset = start;
  for (const table of order) {
    out.set(font.subarray(table.offset, table.offset + table.length), offset);
    outView.setUint32(table.entry + 8, offset);
    offset += padded(table.length);
  }
  const head = tables.find((table) => table.tag === "head");
  if (head) {
    const at = outView.getUint32(head.entry + 8) + 8;
    outView.setUint32(at, 0);
    let sum = 0;
    for (let index = 0; index < out.length; index += 4) sum = (sum + outView.getUint32(index)) >>> 0;
    outView.setUint32(at, (0xB1B0AFBA - sum) >>> 0);
  }
  return out;
}

/**
 * The subset engine a fonts handle carries as `subsets` (RR-65): `subsetDataUrl(font, codePoints)` returns the data URL of
 * the embedded face `font` cut to the code points, or its own data URL when the face may not be subset (license, Reserved
 * Font Name, fsType), HarfBuzz cannot subset it, or the subset is not smaller. Faces are found in the registry by family,
 * weight and style; results are cached per face and code point set.
 */
export function fontSubsets(registry, subsetter) {
  const permitted = new Map();
  const cache = new Map();
  const bytesOf = (font) => {
    const faces = registry.exportFaces(), described = registry.describeFaces();
    const index = described.findIndex((face) => face.family === font.family && face.weight === font.weight && Boolean(face.italic) === Boolean(font.italic));
    return index >= 0 ? faces[index].data : null;
  };
  return Object.freeze({
    subsetDataUrl(font, codePoints) {
      const points = [...new Set(codePoints)].sort((a, b) => a - b);
      const key = `${font.family}|${font.weight}|${font.italic ? 1 : 0}|${font.dataUrl.length}|${points.join(",")}`;
      if (cache.has(key)) return cache.get(key);
      const data = bytesOf(font);
      let url = font.dataUrl;
      if (data) {
        let allowed = permitted.get(data);
        if (allowed === undefined) { allowed = subsetPermitted(data); permitted.set(data, allowed); }
        const subset = allowed ? subsetter.subset(data, points) : null;
        if (subset && subset.length < data.length) url = `${font.dataUrl.slice(0, font.dataUrl.indexOf(",") + 1)}${base64(subset)}`;
      }
      if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
      cache.set(key, url);
      return url;
    },
  });
}

function base64(bytes) {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}
