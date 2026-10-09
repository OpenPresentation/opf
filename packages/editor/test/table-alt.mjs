// FA-27: Table.alt in the editor. The table panel's alt field and "Decorative" box edit it as one validated, undoable patch (inline and
// dataset-backed tables alike); find and replace reaches it; the preview names the table with it and the PPTX export carries it.
import assert from "node:assert/strict";
import { defaultCatalog } from "@openpresentation/opf/catalog";
import { toSvg } from "@openpresentation/opf-render/svg";
import * as pptx from "@openpresentation/opf-pptx";
import { createEditorSession } from "../dist/index.js";
import { prepareTableAlt, readTableAlt, setTableAlt, setTableStyle } from "../dist/table-options.js";
import { findMatches, replaceAll } from "../dist/find-replace.js";

const T = "slides.0.table";
const table = { columns: ["Region", "Q4"], rows: [["North America", 18.1], ["EMEA", 11.5]] };
const deck = (extra = {}) => ({ name: "Table alt fixture", language: "en-US", design: { theme: "minimal", fontScheme: "aptos" }, slides: [{ id: "t", title: "Revenue", table: { ...table, ...extra } }] });
const session = (extra) => createEditorSession(deck(extra), { rejectInvalid: true });

// Form state: absent, text and decorative are three different states.
assert.deepEqual(readTableAlt(table), { alt: "", decorative: false });
assert.deepEqual(readTableAlt({ ...table, alt: "Up" }), { alt: "Up", decorative: false });
assert.deepEqual(readTableAlt({ ...table, alt: "" }), { alt: "", decorative: true });

// Typing alt text is one undo step, the text is trimmed, an unchanged value is no change.
{
  const editor = session();
  const change = setTableAlt(editor, T, { alt: "  North America leads EMEA in Q4, $18.1M to $11.5M.  " });
  assert.equal(change.changed, true);
  assert.equal(editor.get(`${T}.alt`), "North America leads EMEA in Q4, $18.1M to $11.5M.");
  assert.equal(editor.snapshot().undoDepth, 1);
  assert.equal(setTableAlt(editor, T, { alt: "North America leads EMEA in Q4, $18.1M to $11.5M." }).changed, false);
  // The renderer labels the table's group with its alt (role="img" before opf-render's FA-30, role="group" since, so the
  // cells stay readable); either way the alt text is the accessible name.
  assert.match(toSvg(editor.presentation, 1), /aria-label="North America leads EMEA in Q4, \$18\.1M to \$11\.5M\." role="(?:img|group)"|role="(?:img|group)"[^>]*aria-label="North America leads EMEA in Q4/, "the preview names the table");
  const bytes = await pptx.toPptx(structuredClone(editor.presentation), { strictAssets: true, catalogs: [defaultCatalog] });
  const back = await pptx.fromPptx(bytes);
  assert.equal((back.slides[0].table ?? back.slides[0].blocks.find((block) => block.table).table).alt, "North America leads EMEA in Q4, $18.1M to $11.5M.", "alt survives the PPTX round trip");
  // Emptying the field removes alt; it does not mark the table decorative.
  setTableAlt(editor, T, { alt: "" });
  assert.equal(Object.hasOwn(editor.get(T), "alt"), false);
  editor.undo();
  assert.equal(editor.get(`${T}.alt`), "North America leads EMEA in Q4, $18.1M to $11.5M.");
  setTableAlt(editor, T, { alt: null });
  assert.equal(Object.hasOwn(editor.get(T), "alt"), false);
}

// Decorative writes the empty alt and wins over typed text; unticking removes an empty alt but keeps real text.
{
  const editor = session();
  setTableAlt(editor, T, { decorative: true });
  assert.equal(editor.get(`${T}.alt`), "");
  assert.match(toSvg(editor.presentation, 1), /aria-hidden="true"/);
  setTableAlt(editor, T, { decorative: false });
  assert.equal(Object.hasOwn(editor.get(T), "alt"), false);
  const text = session({ alt: "Kept" });
  assert.equal(setTableAlt(text, T, { decorative: false }).changed, false);
  assert.equal(text.get(`${T}.alt`), "Kept");
  assert.equal(prepareTableAlt(deck({ alt: "x" }), T, { alt: "y", decorative: true }).presentation.slides[0].table.alt, "");
}

// The alt survives restyling the table, and styling survives an alt edit: they are separate patches.
{
  const editor = session({ alt: "Kept" });
  setTableStyle(editor, T, "banded");
  assert.equal(editor.get(`${T}.alt`), "Kept");
  setTableAlt(editor, T, { alt: "Changed" });
  assert.equal(JSON.stringify(editor.get(T)).includes("surfaceAlt"), true);
}

// A table that shows a shared dataset takes an alt too (it is the table's, not the data's); a non-table path is refused.
{
  const document = { name: "Dataset", language: "en-US", datasets: { revenue: { columns: ["Region", "Q4"], rows: [["North America", 18.1]] } }, slides: [{ id: "t", title: "Revenue", table: { dataset: "revenue" } }] };
  const editor = createEditorSession(document, { rejectInvalid: true });
  setTableAlt(editor, T, { alt: "Q4 by region." });
  assert.equal(editor.get(`${T}.alt`), "Q4 by region.");
  assert.equal(Object.hasOwn(editor.get("datasets.revenue"), "alt"), false);
  assert.throws(() => setTableAlt(editor, "slides.0.title", { alt: "x" }), (error) => error.code === "table-not-found");
  assert.throws(() => prepareTableAlt(deck(), T, "x"), (error) => error.code === "invalid-table-option");
}

// Find and replace reaches table alt text, as it does chart and image alt text.
{
  const editor = session({ alt: "Revenue doubled in Q2" });
  const matches = findMatches(editor.presentation, "Q2").matches;
  assert.ok(matches.some((match) => match.label?.includes("Table alt text")), "found in the table alt text");
  replaceAll(editor, "Q2", "Q3");
  assert.equal(editor.get(`${T}.alt`), "Revenue doubled in Q3");
}

console.log("table alt: editor field, undo, dataset table, find and replace");
