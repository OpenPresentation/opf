import './build-gallery-snapshot.mjs';
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, copyFile, writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(
  new URL("../packages/javascript/package.json", import.meta.url),
);
const { build } = createRequire(require.resolve("tsup"))("esbuild");
const out = path.join(root, "artifacts/editor");
const { loadOfficeFontRegistry } =
  await import("../../opf-render/dist/fonts-node.js");
const fontRegistry = await loadOfficeFontRegistry();
await mkdir(out, { recursive: true });
await writeFile(
  path.join(out, "fonts.json"),
  JSON.stringify(fontRegistry.embeddedFonts),
);
await build({
  entryPoints: [path.resolve(root, "../opf-editor/examples/playground.js")],
  outfile: path.join(out, "playground.js"),
  bundle: true,
  platform: "browser",
  format: "esm",
  alias: {
    "@openpresentation/opf/data": path.join(root, "packages/javascript/dist/data.js"),
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
