// RR-64 phase 2: HarfBuzz shaping for text drawn as outlines. Browsers shape with HarfBuzz, and fontkit differs from it on some
// scripts (Thai tone marks, Bengali and Khmer conjunct forms, Myanmar medials, Telugu offsets, Hebrew points, Japanese combining
// sound marks), so outlines shaped by HarfBuzz are what the browser draws. This drives `harfbuzz.wasm` of the pinned harfbuzzjs
// package (MIT) through HarfBuzz's C API. The module needs only five small host functions, so it is instantiated synchronously
// from its bytes and the renderer stays synchronous. Glyphs come back in the shape `pdf-fonts.js` `shape()` returns: left to
// right, `{gid, codePoints, advance, xOffset, yOffset}` in font units.

const HB_MEMORY_MODE_READONLY = 1;
const HB_DIRECTION = { ltr: 4, rtl: 5 };
const INFO_SIZE = 20, POSITION_SIZE = 20, FEATURE_SIZE = 16;

// The five host functions the module imports, bound to the instance's memory once it exists.
function hostImports() {
  const state = { memory: null };
  const imports = {
    env: {
      // Emscripten grows the heap through the host: grow the memory to the requested size.
      emscripten_resize_heap: (requested) => {
        try {
          const missing = (requested >>> 0) - state.memory.buffer.byteLength;
          if (missing > 0) state.memory.grow(Math.ceil(missing / 65536));
          return 1;
        } catch { return 0; }
      },
      _abort_js: () => { throw new Error("HarfBuzz aborted."); },
      _setitimer_js: () => 0,
      _emscripten_runtime_keepalive_clear: () => {},
    },
    wasi_snapshot_preview1: { proc_exit: (code) => { throw new Error(`HarfBuzz exited (${code}).`); } },
  };
  return { imports, state };
}

/** A synchronous HarfBuzz shaper over `harfbuzz.wasm` (its bytes or a compiled WebAssembly.Module): Node. */
export function createShaper(wasm) {
  const { imports, state } = hostImports();
  return shaperOver(new WebAssembly.Instance(wasm instanceof WebAssembly.Module ? wasm : new WebAssembly.Module(wasm), imports), state);
}

/** The same shaper, instantiated asynchronously (a browser may refuse to compile a large module synchronously). */
export async function instantiateShaper(wasm) {
  const { imports, state } = hostImports();
  const result = await WebAssembly.instantiate(wasm, imports);
  return shaperOver(result instanceof WebAssembly.Instance ? result : result.instance, state);
}

function shaperOver(instance, state) {
  const hb = instance.exports;
  const memory = state.memory = hb.memory;
  hb.__wasm_call_ctors?.();
  const fonts = new Map();
  const utf8 = new TextEncoder();
  const string = (text) => {
    const bytes = utf8.encode(text), pointer = hb.malloc(bytes.length + 1);
    const view = new Uint8Array(memory.buffer, pointer, bytes.length + 1);
    view.set(bytes);
    view[bytes.length] = 0;
    return { pointer, length: bytes.length };
  };
  // One HarfBuzz font per face, kept for the shaper's lifetime (faces are few and shaped again and again).
  const fontFor = (key, data) => {
    let font = fonts.get(key);
    if (font) return font;
    const pointer = hb.malloc(data.length);
    new Uint8Array(memory.buffer, pointer, data.length).set(data);
    const blob = hb.hb_blob_create(pointer, data.length, HB_MEMORY_MODE_READONLY, 0, 0);
    const face = hb.hb_face_create(blob, 0);
    font = hb.hb_font_create(face);
    fonts.set(key, font);
    return font;
  };
  return {
    /** Shape `text` with the face (`key` names it, `data` is its bytes); `features` is an object of OpenType feature booleans. */
    shape(key, data, text, { direction = "ltr", language, features } = {}) {
      const font = fontFor(key, data);
      const buffer = hb.hb_buffer_create();
      const units = text.length, textPointer = hb.malloc(units * 2 + 2);
      const view = new Uint16Array(memory.buffer, textPointer, units);
      for (let index = 0; index < units; index++) view[index] = text.charCodeAt(index);
      const allocated = [textPointer];
      try {
        hb.hb_buffer_add_utf16(buffer, textPointer, units, 0, units);
        hb.hb_buffer_set_direction(buffer, HB_DIRECTION[direction] ?? HB_DIRECTION.ltr);
        if (language) { const tag = string(language); allocated.push(tag.pointer); hb.hb_buffer_set_language(buffer, hb.hb_language_from_string(tag.pointer, tag.length)); }
        hb.hb_buffer_guess_segment_properties(buffer);
        const entries = Object.entries(features ?? {});
        let featurePointer = 0;
        if (entries.length) {
          featurePointer = hb.malloc(entries.length * FEATURE_SIZE);
          allocated.push(featurePointer);
          entries.forEach(([tag, on], index) => { const spec = string(`${on ? "+" : "-"}${tag}`); allocated.push(spec.pointer); hb.hb_feature_from_string(spec.pointer, spec.length, featurePointer + index * FEATURE_SIZE); });
        }
        hb.hb_shape(font, buffer, featurePointer, entries.length);
        const lengthPointer = hb.malloc(4);
        allocated.push(lengthPointer);
        const infos = hb.hb_buffer_get_glyph_infos(buffer, lengthPointer);
        const count = new Uint32Array(memory.buffer, lengthPointer, 1)[0];
        const positions = hb.hb_buffer_get_glyph_positions(buffer, 0);
        const data32 = new DataView(memory.buffer);
        const glyphs = [];
        for (let index = 0; index < count; index++) {
          const info = infos + index * INFO_SIZE, position = positions + index * POSITION_SIZE;
          glyphs.push({ gid: data32.getUint32(info, true), cluster: data32.getUint32(info + 8, true), advance: data32.getInt32(position, true), xOffset: data32.getInt32(position + 8, true), yOffset: data32.getInt32(position + 12, true) });
        }
        // The characters of each cluster go to its first glyph in output order; later glyphs of the cluster carry none.
        const starts = [...new Set(glyphs.map((glyph) => glyph.cluster))].sort((a, b) => a - b);
        const seen = new Set();
        for (const glyph of glyphs) {
          if (seen.has(glyph.cluster)) { glyph.codePoints = []; continue; }
          seen.add(glyph.cluster);
          const end = starts[starts.indexOf(glyph.cluster) + 1] ?? units;
          glyph.codePoints = [...text.slice(glyph.cluster, end)].map((character) => character.codePointAt(0));
        }
        return glyphs.map(({ gid, codePoints, advance, xOffset, yOffset }) => ({ gid, codePoints, advance, xOffset, yOffset }));
      } finally {
        hb.hb_buffer_destroy(buffer);
        for (const pointer of allocated) hb.free(pointer);
      }
    },
  };
}
