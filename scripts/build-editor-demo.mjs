import './build-gallery-snapshot.mjs';
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, copyFile, writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { emitLazyFonts } from "./emit-lazy-fonts.mjs";
import { galleryLazyFontManifest } from "./gallery-lazy-fonts.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(
  new URL("../packages/javascript/package.json", import.meta.url),
);
const { build } = createRequire(require.resolve("tsup"))("esbuild");
const out = path.join(root, "artifacts/editor");
const { loadFonts } =
  await import("../../opf-render/dist/fonts-node.js");
const fontRegistry = await loadFonts({ pack: "office" });
await mkdir(out, { recursive: true });
await writeFile(
  path.join(out, "fonts.json"),
  JSON.stringify(fontRegistry.embeddedFonts),
);
// The local demo keeps every eager face in fonts.json; an empty base-fonts.json tells the playground (FF-41) there is nothing to load on demand.
await writeFile(path.join(out, "base-fonts.json"), "[]");
// Vendored faces (Intos for the default Aptos scheme, the open families) stay out of fonts.json and load on demand.
const lazy = await emitLazyFonts({ registry: fontRegistry.registry, packageRoot: path.resolve(root, "../opf-render"), out });
// The same pinned manifest the gallery commits (contract opf-gallery-editor-lazy-fonts/v1), for the renderer built beside this checkout.
const rendererFonts = await import("../../opf-render/dist/fonts-node.js");
const rendererVersion = JSON.parse(await readFile(path.resolve(root, "../opf-render/package.json"), "utf8")).version;
const lazyManifest = galleryLazyFontManifest(rendererFonts, rendererVersion);
if (lazyManifest) await writeFile(path.join(out, "lazy-fonts.json"), `${JSON.stringify(lazyManifest, null, 2)}\n`);
console.log(`Editor fonts: ${fontRegistry.embeddedFonts.length} eager faces in fonts.json; ${lazy.faces} lazy faces (${lazy.bytes} bytes) as separate hash-pinned files.`);
await build({
  entryPoints: [path.resolve(root, "../opf-editor/examples/playground.js")],
  outfile: path.join(out, "playground.js"),
  bundle: true,
  platform: "browser",
  format: "esm",
  alias: {
    "@openpresentation/opf/data": path.join(root, "packages/javascript/dist/data.js"),
    // Editor 0.11 loads PDF and PNG export lazily from this subpath; without its own entry the bare-package alias below treats it as a child of svg.js.
    "@openpresentation/opf-render/export-browser": path.resolve(
      root,
      "../opf-render/src/export-browser.js",
    ),
    "@openpresentation/opf-render/fonts-browser": path.resolve(
      root,
      "../opf-render/src/fonts-browser.js",
    ),
    "@openpresentation/opf-render/fonts": path.resolve(
      root,
      "../opf-render/src/fonts.js",
    ),
    "@openpresentation/opf-render/svg": path.resolve(
      root,
      "../opf-render/src/svg.js",
    ),
    "@openpresentation/opf-render": path.resolve(
      root,
      "../opf-render/src/svg.js",
    ),
  },
  minify: true,
});
await build({
  entryPoints: [path.resolve(root, "../opf-editor/test/browser-canvas.mjs")],
  outfile: path.join(out, "canvas-tests.js"),
  bundle: true,
  platform: "browser",
  format: "esm",
  alias: {
    "@openpresentation/opf/data": path.join(root, "packages/javascript/dist/data.js"),
    // Editor 0.11 loads PDF and PNG export lazily from this subpath; without its own entry the bare-package alias below treats it as a child of svg.js.
    "@openpresentation/opf-render/export-browser": path.resolve(
      root,
      "../opf-render/src/export-browser.js",
    ),
    "@openpresentation/opf-render/fonts-browser": path.resolve(
      root,
      "../opf-render/src/fonts-browser.js",
    ),
    "@openpresentation/opf-render/svg": path.resolve(
      root,
      "../opf-render/src/svg.js",
    ),
    "@openpresentation/opf-render": path.resolve(
      root,
      "../opf-render/src/svg.js",
    ),
  },
});
await writeFile(
  path.join(out, "canvas-tests.html"),
  '<!doctype html><title>Canvas checks</title><h1>Canvas browser regression checks</h1><pre id="results"></pre><div id="canvas" style="width:1280px"></div><script type="module" src="./canvas-tests.js"></script>',
);
await copyFile(
  path.resolve(root, "../opf-editor/examples/playground.html"),
  path.join(out, "index.html"),
);
await copyFile(
  path.resolve(root, "../opf-editor/examples/playground.css"),
  path.join(out, "playground.css"),
);
console.log(
  `Editor playground built: ${out}\nServe with: python3 -m http.server 3102 --directory artifacts/editor`,
);

await copyFile(path.resolve(root, '../opf-editor/examples/galleries.json'), path.join(out, 'galleries.json'));
await build({entryPoints:[path.resolve(root,'../opf-editor/test/browser-schema.mjs')],outfile:path.join(out,'schema-tests.js'),bundle:true,platform:'browser',format:'esm'});
await writeFile(path.join(out,'schema-tests.html'),'<!doctype html><title>Schema checks</title><h1>OPF schema inspector browser checks</h1><pre id="results"></pre><div id="inspector"></div><script type="module" src="./schema-tests.js"></script>');

// Refresh browser assets when a local or gallery build changes.
const revision = createHash('sha256').update(await readFile(path.join(out,'playground.js'))).update(await readFile(path.join(out,'playground.css'))).digest('hex').slice(0,12);
await writeFile(path.join(out,'index.html'),(await readFile(path.join(out,'index.html'),'utf8')).replace('src="playground.js"',`src="playground.js?v=${revision}"`).replace('href="playground.css"',`href="playground.css?v=${revision}"`));

await build({entryPoints:[path.join(root,'scripts/test-data-browser.mjs')],outfile:path.join(out,'data-tests.js'),bundle:true,platform:'browser',format:'esm',alias:{'@openpresentation/opf/data':path.join(root,'packages/javascript/dist/data.js'),'@openpresentation/opf-render/svg':path.resolve(root,'../opf-render/src/svg.js')}});
await writeFile(path.join(out,'data-tests.html'),'<!doctype html><title>Data import checks</title><div class="header-actions"></div><pre id="results">Running…</pre><script type="module" src="./data-tests.js"></script>');

await import("./build-rich-text-browser.mjs");

await import("./build-layout-browser.mjs");

await import("./build-block-browser.mjs");

await import("./build-list-browser.mjs");

await import("./build-create-browser.mjs");
