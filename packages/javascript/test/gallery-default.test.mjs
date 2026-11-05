// RR-78: core's Node defaults register `gallery` of @openpresentation/gallery (core's dependency) when a call names no
// catalogs. MR-62: there is no runtime schema refusal; core and the gallery release in lockstep and `pnpm check:catalog-schema`
// holds the two CATALOG_SCHEMA constants equal, which the test below also asserts on the built packages.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { CATALOG_SCHEMA as GALLERY_CATALOG_SCHEMA, gallery } from "@openpresentation/gallery";
import { galleryIconSets } from "@openpresentation/gallery/icon-sets";
import { CATALOG_SCHEMA, validate } from "../dist/index.js";
import { defaultCatalogs } from "../dist/node-engine.js";

const galleryManifest = JSON.parse(readFileSync(new URL(import.meta.resolve("@openpresentation/gallery/package.json")), "utf8"));

test("the default catalogs are the gallery package's own objects: the catalog and its icon sets (LH-14)", () => {
  assert.equal(defaultCatalogs().length, 2);
  assert.equal(defaultCatalogs()[0], gallery);
  assert.equal(defaultCatalogs()[1], galleryIconSets);
  assert.ok(Object.isFrozen(defaultCatalogs()));
  const deck = { name: "t", design: { theme: "minimal" }, slides: [{ layout: "two-column", title: "A" }] };
  const unresolved = (report) => report.findings.filter((finding) => finding.ruleId === "opf/unresolved-reference");
  assert.deepEqual(unresolved(validate(deck, { only: ["references"] })), [], "validate registers the gallery when catalogs is omitted");
  assert.equal(unresolved(validate(deck, { only: ["references"], catalogs: [] })).length, 2, "an explicit empty list registers none");
});

test("core reads the catalog schema the gallery targets", () => {
  assert.equal(CATALOG_SCHEMA, 4);
  assert.equal(GALLERY_CATALOG_SCHEMA, CATALOG_SCHEMA);
  assert.equal(galleryManifest.opf.catalogSchema, CATALOG_SCHEMA, "published gallery package opf.catalogSchema");
});

test("the removed gallery-schema-mismatch refusal stays removed", async () => {
  assert.equal("galleryMismatch" in (await import("../dist/node-engine.js")), false);
});
