#!/usr/bin/env node
// Renders the layout previews of @openpresentation/gallery/previews: one SVG per layout of catalog/layouts/, the first
// slide of the layout's stability fixture (scripts/fixtures.mjs: sample content in every region), drawn by the
// @openpresentation/opf-render (and its @openpresentation/opf) this repository pins in devDependencies.
//
//   node scripts/render-previews.mjs            write previews/layouts/<id>.svg and previews/layouts/index.json
//   node scripts/render-previews.mjs --check    fail when a committed preview is not what the pinned renderer draws
//
// The drawing uses core's portable text measurement and no font files, so it is the same on every OS. Regenerate the
// previews whenever a layout record or the renderer pin changes.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readCatalog } from "./build.mjs";
import { templateDeck } from "./fixtures.mjs";
import { loadEngines } from "./stability.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const previewsRoot = path.join(packageRoot, "previews", "layouts");

export const PREVIEW_INDEX_SCHEMA = "https://openpresentation.org/schema/opf-layout-preview-index/v1";

/** The preview of every layout of the catalog, in catalog order: { id, file, svg }. */
export async function renderPreviews() {
  const { gallery } = await readCatalog();
  const { toSvg, versions } = await loadEngines();
  const previews = [];
  for (const [id, record] of Object.entries(gallery.layouts)) {
    const deck = templateDeck(id, record);
    const [svg] = toSvg({ ...deck, slides: deck.slides.slice(0, 1) }, { catalogs: [gallery] });
    previews.push({ id, file: `${id}.svg`, svg: `${svg.trimEnd()}\n` });
  }
  return { previews, versions };
}

export function previewIndex(previews) {
  return {
    $schema: PREVIEW_INDEX_SCHEMA,
    version: "2",
    description: "One SVG preview per layout of the catalog, keyed by the layout id, in catalog order: the layout's first fixture slide (sample content in every region, scripts/fixtures.mjs) drawn by the @openpresentation/opf-render this package pins, with the engine's default design. Each preview is a self-contained <svg> element with a 16:9 viewBox; scale it to any thumbnail. Written by scripts/render-previews.mjs; never edit by hand.",
    records: previews.map(({ id, file, svg }) => ({ id, file, bytes: Buffer.byteLength(svg, "utf8") })),
  };
}

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

export async function main(argv = process.argv.slice(2)) {
  const { previews, versions } = await renderPreviews();
  const index = previewIndex(previews);
  const expected = new Map([...previews.map(({ file, svg }) => [file, svg]), ["index.json", json(index)]]);
  if (argv.includes("--check")) {
    const problems = [];
    for (const [file, text] of expected) {
      const target = path.join(previewsRoot, file);
      if (!existsSync(target)) problems.push(`${file}: missing`);
      else if (readFileSync(target, "utf8") !== text) problems.push(`${file}: differs from what opf-render ${versions.render} draws`);
    }
    for (const name of existsSync(previewsRoot) ? readdirSync(previewsRoot) : []) if (!expected.has(name)) problems.push(`${name}: no layout has this preview`);
    if (problems.length) throw new Error(`The layout previews are stale; run \`npm run previews\`:\n${problems.join("\n")}`);
    process.stdout.write(`${previews.length} layout previews match opf-render ${versions.render} with core ${versions.core}.\n`);
    return;
  }
  mkdirSync(previewsRoot, { recursive: true });
  for (const name of readdirSync(previewsRoot)) if (!expected.has(name)) rmSync(path.join(previewsRoot, name), { recursive: true, force: true });
  for (const [file, text] of expected) writeFileSync(path.join(previewsRoot, file), text);
  process.stdout.write(`Wrote ${previews.length} layout previews (opf-render ${versions.render}, core ${versions.core}).\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error}\n`);
    process.exitCode = 1;
  });
}
