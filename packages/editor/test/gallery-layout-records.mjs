// FA-01: a gallery layout applied to a deck is inlined as a layout record in the new shape: its own placeholders
// (one content-kind vocabulary), its design hints and its composition, not a guess from removed metadata fields.
// FA-23 (OPF 0.15): it is embedded by id under a catalog group (`custom` for an item with no gallery URL; `default`
// with the gallery's origin as its source otherwise), with no `$schema` or `id`.
import assert from "node:assert/strict";
import { validate } from "@openpresentation/opf";
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
  design: { titleAlignment: "left", contentBox: false, imageFit: "cover" },
  composition: { mode: "row", weights: [2, 2, 1] },
};
const document = await apply(source);
const record = document.catalogs.custom.layouts["fa-01-photo-pair"];
assert.deepEqual(record, {
  name: "Photo pair",
  design: source.design,
  placeholders: source.placeholders,
  composition: source.composition,
});
assert.equal(validate(document, { only: ["format"] }).valid, true);

// Without placeholders the record falls back to a title and a text region.
const bare = (await apply({ id: "fa-01-bare", name: "Bare" })).catalogs.custom.layouts["fa-01-bare"];
assert.deepEqual(bare.placeholders, [{ type: "title" }, { type: "text" }]);
for (const key of ["contentType", "contentMultiple", "slideTitle", "$schema", "id"]) assert.equal(key in record, false);
console.log("Gallery layout records use the layout schema shape.");
