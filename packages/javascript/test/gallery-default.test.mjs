// RR-78: core's Node defaults register `gallery` of @openpresentation/gallery (core's dependency) when a call names no
// catalogs, and refuse a gallery that targets another catalog record schema than this core reads.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { CATALOG_SCHEMA as GALLERY_CATALOG_SCHEMA, gallery } from "@openpresentation/gallery";
import { CATALOG_SCHEMA, validate } from "../dist/index.js";
import { defaultCatalogs, galleryMismatch } from "../dist/node-engine.js";

const galleryManifest = JSON.parse(readFileSync(new URL("../../gallery/package.json", import.meta.url), "utf8"));

test("the default catalogs are the gallery package's own object", () => {
  assert.equal(defaultCatalogs().length, 1);
  assert.equal(defaultCatalogs()[0], gallery);
  assert.ok(Object.isFrozen(defaultCatalogs()));
  const deck = { name: "t", design: { theme: "minimal" }, slides: [{ layout: "two-column", title: "A" }] };
  const unresolved = (report) => report.findings.filter((finding) => finding.ruleId === "opf/unresolved-reference");
  assert.deepEqual(unresolved(validate(deck, { only: ["references"] })), [], "validate registers the gallery when catalogs is omitted");
  assert.equal(unresolved(validate(deck, { only: ["references"], catalogs: [] })).length, 2, "an explicit empty list registers none");
});

test("core reads the catalog schema the gallery targets", () => {
  assert.equal(CATALOG_SCHEMA, 1);
  assert.equal(GALLERY_CATALOG_SCHEMA, CATALOG_SCHEMA);
  assert.equal(galleryManifest.opf.catalogSchema, CATALOG_SCHEMA, "packages/gallery/package.json opf.catalogSchema");
  assert.equal(galleryMismatch(1), undefined);
});

test("a gallery of another catalog schema is refused with a clear message", () => {
  const message = galleryMismatch(2);
  assert.match(message, /@openpresentation\/gallery targets catalog schema 2, and this @openpresentation\/opf reads catalog schema 1/);
  assert.match(message, /pass catalogs explicitly/);
  assert.match(galleryMismatch(undefined), /targets catalog schema undefined/);
  assert.equal(galleryMismatch(3, 3), undefined);
});
