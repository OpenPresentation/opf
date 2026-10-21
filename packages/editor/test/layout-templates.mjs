import assert from "node:assert/strict";
import { validate } from "@openpresentation/opf";
import { createEditorSession } from "../dist/index.js";
import { prepareDimensionSwitch, switchDimension } from "../dist/switches.js";
import { groupLayoutChoices, layoutFromRegions, pinBlockToRegion, prepareCustomLayout, saveCustomLayout } from "../dist/layout-templates.js";

const groups = groupLayoutChoices([
  { id: "two-column", label: "Two columns" }, { id: "cover", label: "Cover" }, { id: "custom:roadmap", label: "Roadmap" },
]);
assert.deepEqual(groups.map((group) => [group.name, group.choices.map((choice) => choice.id)]), [
  ["Openers and closers", ["cover"]], ["Text", ["two-column"]], ["Custom layouts", ["custom:roadmap"]],
]);

const layout = layoutFromRegions({
  id: "review-grid", name: "Review grid", summary: "Two blocks beside each other",
  regions: [
    { name: "title" },
    { direction: "row", regions: [
      { name: "main", size: 2, accepts: ["text"], role: "primary", flow: "none" },
      { name: "notes", accepts: ["text", "list"], role: "secondary", flow: "column" },
    ] },
  ],
});
assert.deepEqual(layout.record, {
  name: "Review grid", summary: "Two blocks beside each other", direction: "column",
  regions: [
    { name: "title" },
    { direction: "row", regions: [
      { name: "main", size: 2, accepts: ["text"], role: "primary", flow: "none" },
      { name: "notes", accepts: ["text", "list"], role: "secondary", flow: "column" },
    ] },
  ],
});
const brokenRecord = validate({catalogs: {custom: {layouts: {broken: {name: "Not a region list", direction: "column", regions: ["title", "main notes"]}}}}, slides: [{title: "Not a region list"}]});
assert.equal(brokenRecord.valid, false);
assert.ok(brokenRecord.findings.some(finding => finding.path.startsWith("/catalogs/custom/layouts/broken/regions/0")), "a region entry that is not an object is a finding");
const input = { id: layout.id, name: layout.record.name };
const body = { name: "main", accepts: ["text"] };
// Reading order is the list; anchor, an omitted accepts and a column direction are record-level defaults.
const quick = layoutFromRegions({ ...input, direction: "row", anchor: "middle", regions: [{ name: "first" }, { name: "second", size: 3 }] });
assert.deepEqual(quick.record, { name: "Review grid", direction: "row", anchor: "middle", regions: [{ name: "first" }, { name: "second", size: 3 }] });
assert.equal(layoutFromRegions({ ...input, regions: [{ name: "title" }, body] }).record.direction, "column");
assert.deepEqual(layoutFromRegions({ ...input, regions: [{ name: "title", size: 1 }, body, { name: "foot", size: "auto" }] }).record.regions.map((entry) => entry.size), [1, undefined, "auto"]);
assert.throws(() => layoutFromRegions({ ...input, regions: [{ name: "main" }, { name: "main" }] }), /unique/);
assert.throws(() => layoutFromRegions({ ...input, regions: [{ name: "left" }] }), /reserved/);
assert.throws(() => layoutFromRegions({ ...input, regions: [{ name: "Bad Name" }] }), /Invalid region name/);
assert.throws(() => layoutFromRegions({ ...input, regions: [{ name: "subtitle" }, body] }), /needs a title/);
assert.throws(() => layoutFromRegions({ ...input, regions: [{ name: "title" }] }), /at least one content region/);
assert.throws(() => layoutFromRegions({ ...input, regions: [{ name: "title", accepts: ["text"] }, body] }), /takes only a size/);
assert.throws(() => layoutFromRegions({ ...input, regions: [] }), /1 to 12/);
assert.throws(() => layoutFromRegions({ ...input, regions: Array.from({ length: 13 }, (_, n) => ({ name: `r-${n}` })) }), /1 to 12/);
assert.throws(() => layoutFromRegions({ ...input, regions: [{ ...body, size: 0 }] }), /number above 0/);
assert.throws(() => layoutFromRegions({ ...input, regions: [{ ...body, size: 101 }] }), /number above 0/);
assert.throws(() => layoutFromRegions({ ...input, direction: "row", regions: [{ ...body, size: "auto" }] }), /only in a column/);
assert.throws(() => layoutFromRegions({ ...input, regions: [{ direction: "row", regions: [{ ...body, size: "auto" }] }] }), /only in a column/);
assert.throws(() => layoutFromRegions({ ...input, direction: "diagonal", regions: [body] }), /row or column/);
assert.throws(() => layoutFromRegions({ ...input, regions: [{ regions: [body] }] }), /row or column/);
assert.throws(() => layoutFromRegions({ ...input, regions: [{ name: "main", accepts: [] }] }), /accepted content kinds/);
assert.throws(() => layoutFromRegions({ ...input, regions: [{ name: "main", accepts: ["text"], role: "invalid" }] }), /valid role/);
assert.throws(() => layoutFromRegions({ ...input, regions: [{ name: "main", accepts: ["text"], flow: "row" }] }), /valid flow/);
assert.throws(() => layoutFromRegions({ ...input, regions: [body], overflowRegion: "title" }), /not a content region/);
// Splits nest two deep inside the record's own list (three levels of lists); a third split is too deep.
const nest = (levels) => levels === 0 ? [{ name: "leaf", accepts: ["text"] }] : [{ direction: levels % 2 ? "row" : "column", regions: nest(levels - 1) }];
assert.equal(layoutFromRegions({ ...input, regions: nest(2) }).record.regions[0].regions[0].regions[0].name, "leaf");
assert.throws(() => layoutFromRegions({ ...input, regions: nest(3) }), /at most 3 levels/);

// The widest list: twelve rows of twelve regions (a 12 by 12 grid compiled).
const largest = layoutFromRegions({ id: "largest-grid", name: "Largest", regions: Array.from({ length: 12 }, (_, y) => ({ direction: "row", regions: Array.from({ length: 12 }, (_, x) => ({ name: `cell-${y}-${x}`, accepts: ["text"], role: "primary", flow: "grid" })) })) });
assert.equal(largest.record.regions.length, 12);
assert.equal(largest.record.regions[0].regions.length, 12);

const original = { name: "Layout test", slides: [{ id: "s1", title: "Review", blocks: [{ text: "First" }, { text: "Second" }] }] };
const snapshot = structuredClone(original);
const editor = createEditorSession(original, { rejectInvalid: true });
const prepared = prepareCustomLayout(original, layout);
assert.deepEqual(original, snapshot, "prepare does not mutate the input");
assert.equal(prepared.presentation.catalogs.custom.layouts[layout.id].name, "Review grid");
assert.equal(validate(prepareCustomLayout(original, largest).presentation, { only: ["format"] }).valid, true);
saveCustomLayout(editor, layout);
assert.equal(validate(editor.presentation, { only: ["format"] }).valid, true);
assert.throws(() => saveCustomLayout(editor, layout), /already exists/);
switchDimension(editor, "layouts", "review-grid", { slideIndex: 0 });
assert.equal(editor.presentation.slides[0].layout, "review-grid");
assert.equal(editor.presentation.slides[0].blocks.length, 2, "layout switch preserves content");
pinBlockToRegion(editor, 0, 1, "notes");
assert.equal(editor.presentation.slides[0].blocks[1].region, "notes");
const fullEditor = createEditorSession(original, { rejectInvalid: true });
saveCustomLayout(fullEditor, layout);
switchDimension(fullEditor, "layouts", "review-grid", { slideIndex: 0 });
pinBlockToRegion(fullEditor, 0, 0, "main");
assert.throws(() => pinBlockToRegion(fullEditor, 0, 1, "main"), /full/);
assert.equal(fullEditor.presentation.slides[0].blocks[1].region, undefined, "rejected drop leaves the document alone");
const geometry = editor.composeSlide(0);
assert.equal(geometry.regions.find((region) => region.name === "notes").content[0], "slides.0.blocks.1");
editor.undo();
assert.equal(editor.presentation.slides[0].blocks[1].region, undefined);
editor.undo();
assert.equal(editor.presentation.slides[0].layout, undefined);
editor.undo();
assert.equal(editor.presentation.catalogs, undefined);
assert.deepEqual(editor.presentation, original);

assert.equal(prepareDimensionSwitch(prepared.presentation, "layouts", "review-grid", { slideIndex: 0 }).presentation.slides[0].layout, "review-grid");
console.log("layout template editor operations: passed");
