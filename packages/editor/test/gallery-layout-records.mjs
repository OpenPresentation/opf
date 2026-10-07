// FA-01: a gallery layout applied to a deck is inlined as a layout record in the new shape: its own placeholders
// (one content-kind vocabulary), its design hints and its composition, not a guess from removed metadata fields.
import assert from "node:assert/strict";
import { validate, validateCatalogRecord } from "@openpresentation/opf";
import { loadOpfGalleryItem } from "../dist/galleries.js";

const apply = (source) =>
  loadOpfGalleryItem({
    raw: {
      opf: { name: "Gallery layout", slides: [{ id: "one", layout: source.id, title: "Title" }] },
      metadata: { category: "layouts", source },
    },
  });

const source = {
  id: "fa-01-photo-pair",
  name: "Photo pair",
  placeholders: [{ type: "title" }, { type: "image" }, { type: "image" }, { type: "text" }],
  design: { titleAlignment: "left", contentBox: false, imageFill: "crop" },
  composition: { mode: "row", weights: [2, 2, 1] },
};
const document = await apply(source);
const [record] = document.catalogs.layouts.records;
assert.deepEqual(record, {
  $schema: "https://openpresentation.org/schema/opf-layout/v1",
  id: "fa-01-photo-pair",
  name: "Photo pair",
  design: source.design,
  placeholders: source.placeholders,
  composition: source.composition,
});
assert.equal(validateCatalogRecord("layouts", record).valid, true);
assert.equal(validate(document, { only: ["format"] }).valid, true);

// Without placeholders the record falls back to a title and a text region.
const bare = (await apply({ id: "fa-01-bare", name: "Bare" })).catalogs.layouts.records[0];
assert.deepEqual(bare.placeholders, [{ type: "title" }, { type: "text" }]);
for (const key of ["contentType", "contentMultiple", "slideTitle", "slideImage"]) assert.equal(key in record, false);
console.log("Gallery layout records use the layout schema shape.");
