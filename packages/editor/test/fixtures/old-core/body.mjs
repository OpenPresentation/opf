import assert from "node:assert/strict";
import * as core from "@openpresentation/opf";
import { createEditorSession } from "../../../dist/index.js";
import * as grid from "../../../dist/data-grid.js";
import * as switches from "../../../dist/switches.js";
import * as findReplace from "../../../dist/find-replace.js";

for (const name of ["chartNumber", "numberFormatError", "inlineChartData", "inlineTableData", "isXYChartType", "formatDataNumber", "resolveChartData"]) assert.equal(typeof core[name], "undefined", `the shim has no ${name}`);
assert.equal(grid.supportsChartTableData, false);

const deck = () => ({
  name: "Plain",
  design: { theme: "minimal", fontScheme: "aptos" },
  slides: [{ id: "s", title: "Plain", blocks: [
    { chart: { type: "scatter", data: { columns: ["Label", "X", "Y"], rows: [["a", 1, 2], ["b", 3, 4]] } } },
    { table: { columns: ["A", "B"], rows: [["x", 1], ["y", 2]] } },
  ] }],
});
const C = "slides.0.blocks.0.chart";
const T = "slides.0.blocks.1.table";
const editor = createEditorSession(deck(), { rejectInvalid: true });

// The number format is explained, not thrown as a TypeError.
assert.equal(typeof grid.columnFormatError("0%"), "string");
assert.equal(grid.columnFormatError(""), undefined);
assert.throws(() => grid.setGridColumnFormat(editor, T, 1, "0%"), (error) => error.code === "number-format-invalid");

// Reading and editing plain data works, and no cell carries display text.
const view = grid.describeDataGrid(editor.document, C);
assert.deepEqual(view.columnRoles, ["label", "x", "series"]);
assert.ok(view.lines.every((line) => line.every((cell) => !("display" in cell))));
grid.setGridCells(editor, C, [{ section: "body", row: 0, column: 2, text: "9" }]);
assert.equal(editor.get(`${C}.data.rows.0.2`), 9);
assert.throws(() => grid.setGridCells(editor, C, [{ section: "body", row: 0, column: 2, text: "12%" }]), (error) => error.code === "invalid-grid-values");
grid.insertGridRows(editor, T, 1);
grid.sortGridRows(editor, T, 1, { direction: "desc" });
grid.setGridHeader(editor, T, false);
assert.equal(grid.describeChartMapping(editor.document, C).xy, true);
assert.throws(() => grid.prepareDetachDataset(editor.document, C), (error) => error.code === "grid-not-dataset");

// A document that names a dataset reports why it cannot be copied instead of throwing a TypeError.
const shared = { ...deck(), datasets: { d: { columns: ["A", "B"], rows: [["x", 1]] } }, slides: [{ id: "s", title: "S", blocks: [{ table: { dataset: "d" } }] }] };
assert.throws(() => grid.prepareDetachDataset(shared, "slides.0.blocks.0.table"), (error) => error.code === "grid-core-too-old");

// Chart switches and search keep working.
assert.ok(switches.compatibleChartTypes(editor.document, { path: "slides.0.blocks.0" }).length > 0);
switches.switchDimension(editor, "charts", "column", { slideIndex: 0, path: "slides.0.blocks.0" });
assert.equal(editor.get(`${C}.type`), "column");
assert.equal(findReplace.findMatches(editor.document, "Label").matches.length, 1);
console.log("old core ok");
