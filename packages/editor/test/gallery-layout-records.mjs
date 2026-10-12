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

const source={id:'photo-pair',name:'Photo pair',areas:['title title','first second','note note'],columns:[1,1],rows:['auto',1,'auto'],regions:{first:{accepts:['image'],flow:'none'},second:{accepts:['image'],flow:'none'},note:{accepts:['text'],flow:'auto'}},design:{imageFit:'contain'}};
const document=await apply(source);
const record=document.catalogs.custom.layouts['photo-pair'];
const {id,...expected}=source;
assert.deepEqual(record,expected);
assert.equal(validate(document,{only:['format']}).valid,true);
const bare=await apply({id:'unsupported',name:'No template'});
assert.equal(bare.catalogs.custom.layouts.unsupported,undefined,'no v1 fallback or invented template');
assert.ok(!Object.hasOwn(record,'placeholders'));
console.log('Gallery definitions preserve exact v2 region/grid/design records without migration fallback.');
