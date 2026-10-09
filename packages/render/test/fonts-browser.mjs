import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { loadFonts as loadBrowserFonts, scriptFontEntries } from "../dist/fonts-browser.js";
import { loadFonts } from "../dist/fonts-node.js";
const bundled = (await loadFonts({pack: 'base'})).registry;
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
const handle = await loadBrowserFonts({ faces: [{ data }], document }), registry = handle.registry;
assert.equal(fonts.size, 1);
assert.equal([...fonts][0].family, registry.embeddedFonts[0].family);
assert.deepEqual(new Uint8Array([...fonts][0].bytes), data);
assert.ok(
  registry.textMeasurement.measure("Hello", 20, {
    fontFamily: source.family,
    fontWeight: source.weight,
  }) > 0,
);
// The handle: measurement and faces of the registry, ensure and pending, and dispose that removes the faces it added.
assert.equal(handle.textMeasurement, registry.textMeasurement);
assert.deepEqual(handle.embeddedFonts, registry.embeddedFonts);
assert.equal(handle.embeddedFonts, handle.embeddedFonts, 'the embedded list is computed once');
assert.deepEqual(handle.substitutions, registry.substitutions);
assert.equal(handle.fontFiles, undefined, 'a browser handle has no files');
assert.deepEqual(handle.registry.exportFaces().map((face) => face.family), [registry.embeddedFonts[0].family]);
// RR-64: the browser handle carries the outline engine `textAsPaths` draws with, over the same face bytes.
{
  const { content, defs } = handle.outlines.outlineSlideText([`<text x="1" y="20" font-family="${source.family}" font-size="20">Hi</text>`], { fail: (code, message) => new Error(message) });
  assert.ok(/<use href="#opf-g-/.test(content[0]) && /<path id="opf-g-/.test(defs), "the browser handle outlines text");
  assert.match(content[0], /<text [^>]*fill="none"[^>]*>Hi<\/text>/, "the only text left is the invisible readable line");
}
const empty = { slides: [{}] };
assert.deepEqual(handle.pending(empty), []);
assert.deepEqual(await handle.ensure(empty), { scripts: [], lazy: [], uncovered: [] });
handle.dispose();
assert.equal(fonts.size, 0);
await assert.rejects(handle.ensure({ slides: [{ title: '日本語' }] }), { code: 'font-registry-disposed' });
registry.dispose();
assert.equal(fonts.size, 0);
await assert.rejects(
  loadBrowserFonts({faces: [{ url: "https://fonts.example/test.ttf" }], document,
    fetch: async () => ({ ok: false, status: 404 }),}),
  { code: "font-fetch-failed" },
);
await assert.rejects(loadBrowserFonts({faces: [{}], document}), {
  code: "invalid-font-source",
});
class FailedFace extends Face {
  async load() {
    throw new Error("Rejected font");
  }
}
await assert.rejects(
  loadBrowserFonts({faces: [{ data }], document: { fonts, defaultView: { FontFace: FailedFace } },}),
  { code: "font-load-failed" },
);
assert.equal(fonts.size, 0);
const controller = new AbortController();
controller.abort();
await assert.rejects(
  loadBrowserFonts({faces: [{ url: "https://fonts.example/test.ttf" }], document,
    signal: controller.signal,
    fetch: async (url, { signal }) => {
      signal.throwIfAborted();
    },}),
  { name: "AbortError" },
);
// FF-19: script-pack entries carry reviewed hashes; the loader verifies them.
const digest = createHash("sha256").update(data).digest("hex");
const verified = (await loadBrowserFonts({faces: [{ data, sha256: digest }], document})).registry;
verified.dispose();
await assert.rejects(
  loadBrowserFonts({faces: [{ data, sha256: "0".repeat(64) }], document}),
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
