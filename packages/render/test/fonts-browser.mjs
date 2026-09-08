import assert from "node:assert/strict";
import { loadBrowserFontRegistry } from "../dist/fonts-browser.js";
import { loadBundledFontRegistry } from "../dist/fonts-node.js";
const bundled = await loadBundledFontRegistry();
const source = bundled.embeddedFonts[0];
const data = new Uint8Array(
  Buffer.from(source.dataUrl.split(",")[1], "base64"),
);
class Face {
  constructor(family, bytes, descriptors) {
    this.family = family;
    this.bytes = bytes;
    this.descriptors = descriptors;
  }
  async load() {
    return this;
  }
}
const fonts = new Set();
fonts.ready = Promise.resolve();
const document = { fonts, defaultView: { FontFace: Face } };
const registry = await loadBrowserFontRegistry([{ data }], { document });
assert.equal(fonts.size, 1);
assert.equal([...fonts][0].family, registry.embeddedFonts[0].family);
assert.deepEqual(new Uint8Array([...fonts][0].bytes), data);
assert.ok(
  registry.textMeasurement.measure("Hello", 20, {
    fontFamily: source.family,
    fontWeight: source.weight,
  }) > 0,
);
registry.dispose();
registry.dispose();
assert.equal(fonts.size, 0);
await assert.rejects(
  loadBrowserFontRegistry([{ url: "https://fonts.example/test.ttf" }], {
    document,
    fetch: async () => ({ ok: false, status: 404 }),
  }),
  { code: "font-fetch-failed" },
);
await assert.rejects(loadBrowserFontRegistry([{}], { document }), {
  code: "invalid-font-source",
});
class FailedFace extends Face {
  async load() {
    throw new Error("Rejected font");
  }
}
await assert.rejects(
  loadBrowserFontRegistry([{ data }], {
    document: { fonts, defaultView: { FontFace: FailedFace } },
  }),
  { code: "font-load-failed" },
);
assert.equal(fonts.size, 0);
const controller = new AbortController();
controller.abort();
await assert.rejects(
  loadBrowserFontRegistry([{ url: "https://fonts.example/test.ttf" }], {
    document,
    signal: controller.signal,
    fetch: async (url, { signal }) => {
      signal.throwIfAborted();
    },
  }),
  { name: "AbortError" },
);
console.log(
  "Browser fonts: identical bytes, measurement, owned cleanup, network failure and abort passed.",
);
