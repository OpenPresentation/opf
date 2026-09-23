import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { loadBrowserFontRegistry, scriptFontEntries } from "../dist/fonts-browser.js";
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
// FF-19: script-pack entries carry reviewed hashes; the loader verifies them.
const digest = createHash("sha256").update(data).digest("hex");
const verified = await loadBrowserFontRegistry([{ data, sha256: digest }], { document });
verified.dispose();
await assert.rejects(
  loadBrowserFontRegistry([{ data, sha256: "0".repeat(64) }], { document }),
  { code: "font-integrity-mismatch" },
);
const entries = scriptFontEntries(["Jpan"], { baseUrl: "/fonts" });
assert.deepEqual(entries.map((entry) => [entry.url, entry.family, entry.weight]), [
  ["/fonts/noto-sans-jp/400Regular/NotoSansJP_400Regular.ttf", "Noto Sans JP", 400],
  ["/fonts/noto-sans-jp/700Bold/NotoSansJP_700Bold.ttf", "Noto Sans JP", 700],
]);
assert.ok(entries.every((entry) => /^[0-9a-f]{64}$/.test(entry.sha256) && entry.scripts.includes("Jpan")));
assert.throws(() => scriptFontEntries(["Jpan"], {}), { code: "invalid-font-source" });
console.log(
  "Browser fonts: identical bytes, measurement, owned cleanup, network failure, abort and script-pack hash verification passed.",
);
