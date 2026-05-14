// Renders the React/Tailwind layout preview elements from
// pptx-gallery/lib/layout-previews.tsx to static HTML and writes them to
// opf/spec/previews/layouts/<slug>.html. Also writes spec/previews/layouts/index.json.
//
// Usage:
//   node --import tsx scripts/render-layout-previews.mjs
//     [--source <path-to-layout-previews.tsx>] [--out <output-dir>]
//
// React/react-dom are resolved from the source file's nearest node_modules
// (so this script works without adding react as a dep of @openpresentation/opf).

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(packageRoot, "../..");

const args = process.argv.slice(2);
function arg(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : fallback;
}

const sourcePath = path.resolve(
  arg(
    "source",
    path.resolve(repoRoot, "../pptx-gallery/lib/layout-previews.tsx"),
  ),
);
const outDir = path.resolve(
  arg("out", path.join(repoRoot, "spec/previews/layouts")),
);

const require = createRequire(pathToFileURL(sourcePath));
const ReactDOMServer = require("react-dom/server");

const mod = await import(pathToFileURL(sourcePath).href);
const {
  layoutPreviewElements,
  GenericLayoutPreview,
} = mod;

if (!layoutPreviewElements) {
  throw new Error(
    `Source module did not export layoutPreviewElements: ${sourcePath}`,
  );
}

const slugs = Object.keys(layoutPreviewElements).sort();

await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });

const records = [];
for (const slug of slugs) {
  const element = layoutPreviewElements[slug];
  const html = ReactDOMServer.renderToStaticMarkup(element);
  await fs.writeFile(path.join(outDir, `${slug}.html`), `${html}\n`, "utf8");
  records.push({
    id: slug,
    file: `${slug}.html`,
    bytes: Buffer.byteLength(html, "utf8"),
  });
}

const indexPath = path.join(outDir, "index.json");
const index = {
  $schema: "https://openpresentation.org/schema/opf-layout-preview-index/v1",
  version: "1",
  description:
    "Catalog of static HTML previews for slide layouts. Each preview is a self-contained Tailwind-styled snippet sized to fill a 16:9 thumbnail. Consumers should provide the standard pptx.gallery CSS variables (--background, --foreground, --card, --muted, --muted-foreground, --accent, --border) on a parent element.",
  records,
};
await fs.writeFile(indexPath, JSON.stringify(index, null, 2) + "\n", "utf8");

console.log(
  `Rendered ${records.length} layout previews to ${path.relative(repoRoot, outDir)}/`,
);
