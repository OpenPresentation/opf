import assert from "node:assert/strict";
import { validate } from "@openpresentation/opf";
import { createEditorSession } from "../dist/index.js";
import { prepareDimensionSwitch, switchDimension } from "../dist/switches.js";
import { groupLayoutChoices, layoutFromGrid, pinBlockToRegion, prepareCustomLayout, saveCustomLayout } from "../dist/layout-templates.js";

const groups = groupLayoutChoices([
  { id: "two-column", label: "Two columns" }, { id: "cover", label: "Cover" }, { id: "custom:roadmap", label: "Roadmap" },
]);
assert.deepEqual(groups.map((group) => [group.name, group.choices.map((choice) => choice.id)]), [
  ["Openers and closers", ["cover"]], ["Text", ["two-column"]], ["Custom layouts", ["custom:roadmap"]],
]);

const layout = layoutFromGrid({
  id: "review-grid", name: "Review grid", summary: "Two blocks beside each other",
  cells: [["title", "title"], ["main", "notes"]],
  regions: {
    main: { accepts: ["text"], role: "primary", flow: "none" },
    notes: { accepts: ["text", "list"], role: "secondary", flow: "column" },
  },
  columns: [2, 1], rows: ["auto", 1],
});
assert.deepEqual(layout.record.areas, [["title", "title"], ["main", "notes"]]);
const oldRows = validate({catalogs: {custom: {layouts: {old: {name: "Old row spelling", areas: ["title title", "main notes"], regions: layout.record.regions}}}}, slides: [{title: "Old row spelling"}]});
assert.equal(oldRows.valid, false);
assert.ok(oldRows.findings.some(finding => finding.path === "/catalogs/custom/layouts/old/areas/0" && finding.validation?.params?.type === "array"));
const input = { id: layout.id, name: layout.record.name, regions: layout.record.regions };
assert.throws(() => layoutFromGrid({ ...input, cells: [["title", "main"], ["main", "title"]] }), /rectangle/);
assert.throws(() => layoutFromGrid({ ...input, cells: Array.from({ length: 13 }, () => ["main"]) }), /12 by 12/);

const largest = layoutFromGrid({ id: "largest-grid", name: "Largest", cells: Array.from({ length: 12 }, () => Array(12).fill("main")), regions: { main: { accepts: ["text"], role: "primary", flow: "grid" } } });
assert.equal(largest.record.areas.length, 12);
assert.equal(largest.record.areas[0].length, 12);
assert.throws(() => layoutFromGrid({ ...input, cells: [["main", "main"], ["main"]] }), /rectangular grid/);
assert.throws(() => layoutFromGrid({ ...input, cells: [["main"]], regions: { main: { accepts: [] } } }), /accepted content kinds/);
assert.throws(() => layoutFromGrid({ ...input, cells: [["main"]], regions: { main: { accepts: ["text"], role: "invalid" } } }), /valid role/);
assert.throws(() => layoutFromGrid({ ...input, cells: [["main"]], regions: { main: { accepts: ["text"], flow: "row" } } }), /valid flow/);

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
