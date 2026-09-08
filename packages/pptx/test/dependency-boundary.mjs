import assert from "node:assert/strict";
import Module, { register } from "node:module";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// Both ESM and CommonJS loading must work without PptxGenJS's unused,
// unpatched image-size dependency. This is a release regression gate;
// it does not remove the dependency or declare its advisory resolved.
const blocked = /(^|[/\\])image-size([/\\]|$)/;
const originalLoad = Module._load;
Module._load = function (request, ...args) {
  if (blocked.test(request)) throw new Error("Unexpected image-size runtime dependency: " + request);
  return originalLoad.call(this, request, ...args);
};
register("data:text/javascript," + encodeURIComponent(`
  const blocked = ${blocked};
  export async function resolve(specifier, context, nextResolve) {
    if (blocked.test(specifier)) throw new Error("Unexpected image-size import: " + specifier);
    const result = await nextResolve(specifier, context);
    if (blocked.test(result.url)) throw new Error("Unexpected image-size resolution: " + result.url);
    return result;
  }
`), import.meta.url);

await import("./smoke.mjs");
await import("./background.mjs");
await import("./table-layout.mjs");
await import("./table-import.mjs");
await import("./object-ids.mjs");
await import("./image-fit.mjs");
await import("./image-orientation.mjs");
await import("./image-media-type.mjs");
await import("./webp-fallback.mjs");
await import("./image-fallback-boundary.mjs");
await import("./export-corpus.mjs");
const { toPptx } = await import("../dist/index.js");
const { unzipSync } = await import("fflate");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO8sAAAAASUVORK5CYII=", "base64");
const directory = await mkdtemp(path.join(tmpdir(), "opf-pptx-images-"));
try {
  const filename = path.join(directory, "pixel.png");
  await writeFile(filename, png);
  for (const [source, options] of [
    ["data:image/png;base64," + png.toString("base64"), {}],
    [filename, {}],
    ["https://example.invalid/host-owned.png", { imageResolver: async () => new Uint8Array(png) }],
  ]) {
    const bytes = await toPptx({ slides: [{ image: source }] }, { strictAssets: true, ...options });
    const entries = unzipSync(bytes);
    const media = Object.entries(entries).filter(([name]) => name.startsWith("ppt/media/") && name.endsWith(".png"));
    assert.ok(media.length > 0, "Expected an embedded PNG");
    assert.ok(media.some(([, bytes]) => Buffer.from(bytes).equals(png)), "Image bytes must survive export");
  }
} finally {
  await rm(directory, { recursive: true, force: true });
  Module._load = originalLoad;
}
console.log("PPTX dependency boundary passed: model suite and data/local/resolved images work without image-size.");
