import assert from "node:assert/strict";
import { createRequire } from "node:module";

import {
  audience,
  audiences,
  catalogEntries,
  catalogs,
  presentation,
  validateCatalogRecord,
  validatePresentation,
} from "../dist/index.js";
import { tones } from "../dist/catalogs.js";
import { validate, assertValid } from "../dist/validator.js";

assert.equal(presentation.$id, "https://pptx.dev/schema/opf/v1");
assert.equal(audience.$id, "https://pptx.dev/schema/opf-audience/v1");
assert.ok(audiences.length > 0);
assert.ok(tones.length > 0);
assert.equal(catalogs.audiences.length, audiences.length);

const doc = {
  $schema: "https://pptx.dev/schema/opf/v1",
  meta: { title: "Smoke Test" },
  design: {},
  slides: [{ id: "slide-1", layout: "title-left", elements: [] }],
};

const docResult = validatePresentation(doc);
assert.equal(docResult.valid, true, JSON.stringify(docResult.errors, null, 2));
assert.equal(validate(doc, "presentation").valid, true);
assert.doesNotThrow(() => assertValid(doc));

for (const entry of catalogEntries) {
  assert.ok(entry.records.length > 0, `${entry.kind} should have records`);
  const result = validateCatalogRecord(entry.kind, entry.records[0]);
  assert.equal(result.valid, true, `${entry.kind}: ${JSON.stringify(result.errors, null, 2)}`);
}

const require = createRequire(import.meta.url);
const rawPresentation = require("../dist/spec/presentation.schema.json");
assert.equal(rawPresentation.$id, presentation.$id);
