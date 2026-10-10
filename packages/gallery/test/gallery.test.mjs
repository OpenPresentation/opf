// RR-78: the built @openpresentation/gallery package: its shape, its integrity against the hashes the sync recorded, and
// that core resolves its records when it is registered with `catalogs: [gallery]`.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { CONTENT_KINDS, DISPLAY_KINDS, readKind } from "../scripts/build.mjs";
import { rendererCore } from "../scripts/stability.mjs";
import { CATALOG_SCHEMA, GALLERY_SOURCE, catalogDisplay, catalogIndexes, catalogManifest, gallery } from "../dist/index.js";
import { getLayoutPreview, hasLayoutPreview, layoutPreviewIndex, layoutPreviewSlugs, layoutPreviews } from "../dist/previews.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8"));
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
};
const strip = (record) => Object.fromEntries(Object.entries(record).filter(([key]) => !key.startsWith("x-")));

test("the package is published from OpenPresentation/opf with no runtime dependency", () => {
  assert.equal(manifest.name, "@openpresentation/gallery");
  assert.deepEqual(manifest.repository, { type: "git", url: "git+https://github.com/OpenPresentation/opf.git", directory: "packages/gallery" });
  assert.equal(manifest.dependencies, undefined, "the gallery has no runtime dependency (core depends on it, never the reverse)");
  assert.equal(manifest.peerDependencies, undefined);
  assert.equal(manifest.opf.catalogSchema, CATALOG_SCHEMA);
  assert.deepEqual(Object.keys(manifest.exports), [".", "./previews", "./package.json"]);
});

test("gallery has the shape core registers: source and the eight content kinds, nothing else", () => {
  assert.equal(GALLERY_SOURCE, "https://www.pptx.gallery");
  assert.deepEqual(Object.keys(gallery), ["source", ...CONTENT_KINDS.map(([key]) => key)]);
  assert.equal(gallery.source, GALLERY_SOURCE);
  assert.deepEqual(Object.keys(catalogDisplay), DISPLAY_KINDS.map(([key]) => key));
  for (const [key] of CONTENT_KINDS) {
    assert.ok(Object.keys(gallery[key]).length > 0, `${key} has records`);
    for (const [id, record] of Object.entries(gallery[key])) {
      for (const member of Object.keys(record)) assert.ok(member !== "$schema" && member !== "id" && !member.startsWith("x-"), `${key}/${id} carries ${member}`);
    }
  }
  assert.ok(Object.isFrozen(gallery) && Object.isFrozen(gallery.layouts) && Object.isFrozen(gallery.layouts["two-column"]));
  assert.equal(catalogManifest.publisher, GALLERY_SOURCE);
});

test("every kind matches the hashes its index and the manifest record", async () => {
  const root = path.join(packageRoot, "catalog");
  for (const [key, dir] of [...CONTENT_KINDS, ...DISPLAY_KINDS]) {
    const { index, records } = await readKind(root, dir);
    const hash = createHash("sha256").update(canonical(records.map(strip)), "utf8").digest("hex");
    assert.equal(index.contentSha256, hash, `${dir}/index.json contentSha256`);
    assert.equal(catalogManifest.kinds[dir].contentSha256, hash, `manifest ${dir}`);
    assert.equal(catalogManifest.kinds[dir].records, records.length);
    assert.equal(catalogIndexes[key].contentSha256, hash);
    const records2 = key in gallery ? gallery[key] : catalogDisplay[key];
    assert.deepEqual(Object.keys(records2), index.records.map((entry) => entry.id), `${key} keeps index order`);
  }
});

test("core resolves gallery records when it is registered", async () => {
  // The core of the pinned renderer: the gallery has no direct core dependency (RR-78).
  const { validate } = (await rendererCore()).module;
  const deck = { name: "t", design: { theme: "minimal" }, narrative: "scqa", slides: [{ layout: "two-column", title: "A", blocks: [{ items: ["x"] }, { items: ["y"] }] }] };
  const unresolved = (report) => report.findings.filter((finding) => finding.ruleId === "opf/unresolved-reference").map((finding) => finding.path);
  assert.ok(unresolved(validate(deck, { only: ["format", "references"], catalogs: [] })).length > 0, "nothing resolves without the gallery");
  assert.deepEqual(unresolved(validate(deck, { only: ["format", "references"], catalogs: [gallery] })), []);
});

test("the layout previews are exported from /previews", () => {
  assert.equal(layoutPreviewSlugs.length, layoutPreviewIndex.records.length);
  assert.deepEqual([...layoutPreviewSlugs], Object.keys(layoutPreviews).sort());
  const slug = layoutPreviewSlugs[0];
  assert.ok(hasLayoutPreview(slug));
  assert.equal(getLayoutPreview(slug), layoutPreviews[slug]);
  assert.equal(getLayoutPreview("no-such-preview"), undefined);
  assert.equal(hasLayoutPreview("toString"), false);
});
