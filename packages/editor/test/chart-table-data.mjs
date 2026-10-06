// RR-54: chart and table data in the editor. The data grid edits charts and tables whose columns are DataColumn objects
// ({ name, format }), a chart or table that shows a shared top-level dataset (through its `fields` selection), a column's
// number format and a chart's series mapping, each as one undoable patch. Documents without the new fields behave as before.
import assert from "node:assert/strict";
import * as core from "@openpresentation/opf";
import { validatePresentation } from "@openpresentation/opf";
import { createEditorSession } from "../dist/index.js";
import * as grid from "../dist/data-grid.js";
import * as chart from "../dist/chart-data.js";
import * as tables from "../dist/table-options.js";
import * as findReplace from "../dist/find-replace.js";
import * as switches from "../dist/switches.js";
import { DATASET_ID_PATTERN, createDataContent, prepareDatasetImport } from "../dist/data.js";
import { prepareOpfImport } from "../dist/transfer.js";

const C_INLINE = "slides.0.blocks.0.chart";
const C_FIELDS = "slides.0.blocks.1.chart";
const T_DATASET = "slides.0.blocks.2.table";
const T_INLINE = "slides.0.blocks.3.table";
const C_SCATTER = "slides.0.blocks.4.chart";
const C_ALL = "slides.0.blocks.5.chart";

const deck = () => ({
  name: "Chart and table data",
  design: { theme: "minimal", fontScheme: "aptos" },
  datasets: {
    revenue: {
      title: "Revenue by quarter",
      columns: ["Quarter", { name: "Revenue", format: "$#,##0.0" }, "Costs", "Notes"],
      rows: [["Q1", 12.4, 5, "first"], ["Q2", 18.1, 8, "second"], ["Q3", 24, 9, "third"]],
      source: { src: "./data/revenue.csv", retrieved: "2026-10-05" },
    },
  },
  slides: [
    {
      id: "data",
      title: "Data",
      blocks: [
        { chart: { type: "column", data: { columns: ["Quarter", { name: "Revenue", format: "$#,##0.0" }, "Costs"], rows: [["Q1", 12.4, 5], ["Q2", 18.1, 8]] } } },
        { chart: { type: "column", data: { dataset: "revenue", fields: ["Quarter", "Costs"] } } },
        { table: { dataset: "revenue", fields: ["Quarter", "Revenue"] } },
        { table: { columns: ["Region", { name: "Share", format: "0%" }, { value: "Growth", style: { align: "right" }, format: "0.0%" }], rows: [["EMEA", 0.4, 0.1], ["APAC", 0.6, { value: 0.2, format: "0%" }]] } },
        { chart: { type: "scatter", data: { columns: ["Label", "Spend", "Revenue", "Margin"], rows: [["A", 1, 10, 0.1], ["B", 2, 14, 0.2]] } } },
        { chart: { type: "column", data: { dataset: "revenue" }, mapping: { series: ["Costs"] } } },
      ],
    },
  ],
});
const session = (document = deck()) => createEditorSession(document, { rejectInvalid: true });
const body = (row, column) => ({ section: "body", row, column });
const header = (column) => ({ section: "header", column });

function step(editor, name, action, expectation) {
  const before = editor.document;
  const depth = editor.snapshot().undoDepth;
  const change = action();
  assert.equal(change.changed, true, `${name} changed the document`);
  assert.equal(editor.snapshot().undoDepth, depth + 1, `${name} is one undo step`);
  assert.equal(validatePresentation(editor.document).valid, true, `${name} leaves valid OPF`);
  expectation?.(change);
  const after = editor.document;
  editor.undo();
  assert.deepEqual(editor.document, before, `${name} undoes in one step`);
  editor.redo();
  assert.deepEqual(editor.document, after, `${name} redoes`);
  editor.undo();
  assert.deepEqual(editor.document, before, `${name} undoes again`);
  return change;
}
const refuses = (editor, name, action, code) => {
  const before = editor.document;
  const depth = editor.snapshot().undoDepth;
  assert.throws(action, (error) => (code ? error.code === code : true), name);
  assert.deepEqual(editor.document, before, `${name} leaves the document alone`);
  assert.equal(editor.snapshot().undoDepth, depth, `${name} records no undo step`);
};

assert.equal(validatePresentation(deck()).valid, true, "the fixture is valid OPF");
assert.equal(typeof core.chartNumber, "function", "core exports chartNumber (RR-54)");

// --- documents without the new fields behave exactly as before ---------------------------------------------
{
  const editor = session({
    name: "Plain",
    design: { theme: "minimal", fontScheme: "aptos" },
    slides: [{ id: "p", title: "P", blocks: [{ chart: { type: "column", data: { columns: ["Quarter", "Revenue"], rows: [["Q1", 12], ["Q2", 18]] } } }, { table: { columns: ["A", "B"], rows: [["x", 1]] } }] }],
  });
  const grid0 = grid.describeDataGrid(editor.document, "slides.0.blocks.0.chart");
  assert.deepEqual(grid0.columnRoles, ["category", "series"]);
  assert.equal(grid0.dataset, undefined);
  assert.equal(grid0.mapping, undefined);
  assert.deepEqual(grid0.columnFormats, [undefined, undefined]);
  const change = grid.setGridCells(editor, "slides.0.blocks.0.chart", [{ ...body(1, 1), text: "20" }]);
  assert.deepEqual(change.patches, [{ op: "test", path: "/slides/0/blocks/0/chart/data/rows/1/1", value: 18 }, { op: "replace", path: "/slides/0/blocks/0/chart/data/rows/1/1", value: 20 }]);
  assert.equal(change.dataset, undefined);
  assert.deepEqual(grid.resolveDataGridTarget(editor.document, "slides.0.blocks.0.chart"), { kind: "chart", path: "slides.0.blocks.0.chart" });
  grid.insertGridColumns(editor, "slides.0.blocks.0.chart", 2, 1);
  assert.deepEqual(editor.get("slides.0.blocks.0.chart.data.columns"), ["Quarter", "Revenue", ""], "a new series of an ordinary chart is unnamed, as before");
  assert.equal(editor.get("slides.0.blocks.0.chart.mapping"), undefined);
}

// --- DataColumn headers: names edit, formats stay ------------------------------------------------------------
{
  const editor = session();
  const view = grid.describeDataGrid(editor.document, C_INLINE);
  assert.deepEqual(view.columnNames, ["Quarter", "Revenue", "Costs"]);
  assert.equal(view.lines[0][1].text, "Revenue", "a DataColumn header shows its name");
  assert.equal(view.lines[0][1].format, "$#,##0.0");
  assert.deepEqual(view.columnFormats, [undefined, "$#,##0.0", undefined]);

  step(editor, "rename a DataColumn", () => grid.setGridCells(editor, C_INLINE, [{ ...header(1), text: "Sales" }]), () => {
    assert.deepEqual(editor.get(`${C_INLINE}.data.columns.1`), { name: "Sales", format: "$#,##0.0" }, "renaming keeps the format");
  });
  step(editor, "rename a string header next to a DataColumn", () => grid.setGridCells(editor, C_INLINE, [{ ...header(2), text: "Expenses" }]), () => {
    assert.equal(editor.get(`${C_INLINE}.data.columns.2`), "Expenses");
    assert.deepEqual(editor.get(`${C_INLINE}.data.columns.1`), { name: "Revenue", format: "$#,##0.0" });
  });
  step(editor, "renameChartSeries keeps the format", () => chart.renameChartSeries(editor, C_INLINE, 1, "Sales"), () => {
    assert.deepEqual(editor.get(`${C_INLINE}.data.columns.1`), { name: "Sales", format: "$#,##0.0" });
  });

  const original = editor.get(`${C_INLINE}.data.columns`);
  step(editor, "insert a column keeps the other columns' objects", () => grid.insertGridColumns(editor, C_INLINE, 1, 1), () => {
    const columns = editor.get(`${C_INLINE}.data.columns`);
    assert.deepEqual(columns, ["Quarter", "", { name: "Revenue", format: "$#,##0.0" }, "Costs"]);
    assert.deepEqual(columns[2], original[1]);
  });
  step(editor, "delete a column keeps the other columns' objects", () => grid.deleteGridColumns(editor, C_INLINE, [2]), () => {
    assert.deepEqual(editor.get(`${C_INLINE}.data.columns`), ["Quarter", { name: "Revenue", format: "$#,##0.0" }]);
  });
  step(editor, "move a DataColumn", () => grid.moveGridColumns(editor, C_INLINE, 1, 2), () => {
    assert.deepEqual(editor.get(`${C_INLINE}.data.columns`), ["Quarter", "Costs", { name: "Revenue", format: "$#,##0.0" }]);
    assert.deepEqual(editor.get(`${C_INLINE}.data.rows.0`), ["Q1", 5, 12.4]);
  });
  step(editor, "paste over a DataColumn header keeps its format", () => grid.pasteGridText(editor, C_INLINE, header(1), "Sales\n7", { decimal: "." }), () => {
    assert.deepEqual(editor.get(`${C_INLINE}.data.columns.1`), { name: "Sales", format: "$#,##0.0" });
  });
  step(editor, "transpose turns names into labels and drops formats", () => chart.transposeChart(editor, C_INLINE), () => {
    assert.deepEqual(editor.get(`${C_INLINE}.data.columns`), ["Quarter", "Q1", "Q2"]);
    assert.deepEqual(editor.get(`${C_INLINE}.data.rows.0`), ["Revenue", 12.4, 18.1]);
  });
}

// --- chart numbers follow core chartNumber: nothing is silently coerced -------------------------------------
{
  const editor = session();
  refuses(editor, "text in a series cell", () => grid.setGridCells(editor, C_INLINE, [{ ...body(0, 1), text: "twelve" }]), "invalid-grid-values");
  refuses(editor, "a percent sign in a series cell", () => grid.setGridCells(editor, C_INLINE, [{ ...body(0, 1), text: "12%" }]), "invalid-grid-values");
  refuses(editor, "a hex number", () => grid.setGridCells(editor, C_INLINE, [{ ...body(0, 1), text: "0x10" }]), "invalid-grid-values");
  step(editor, "a decimal comma is read as input", () => grid.setGridCells(editor, C_INLINE, [{ ...body(0, 1), text: "1.234,5" }], { decimal: "," }), () => {
    assert.equal(editor.get(`${C_INLINE}.data.rows.0.1`), 1234.5);
  });
  step(editor, "a blank cell is a gap, never zero", () => grid.setGridCells(editor, C_INLINE, [{ ...body(0, 1), text: "" }]), () => {
    assert.equal(editor.get(`${C_INLINE}.data.rows.0.1`), null);
  });
  // A document that already holds text the strict rule reads as a gap: the grid says so, by core's rule.
  const odd = session({
    name: "Odd",
    design: { theme: "minimal", fontScheme: "aptos" },
    slides: [{ id: "o", title: "O", chart: { type: "column", data: { columns: ["Q", "V"], rows: [["a", "12%"], ["b", "1e3"], ["c", "0x10"], ["d", " 7 "], ["e", "(5)"]] } } }],
  });
  const warned = grid.describeDataGrid(odd.document, "slides.0.chart").warnings.map((entry) => entry.row);
  assert.deepEqual(warned, [0, 2, 4], '"12%", "0x10" and "(5)" are gaps under chartNumber; "1e3" and " 7 " are numbers');
  assert.equal(core.chartNumber("1e3"), 1000);
}

// --- number format per column ------------------------------------------------------------------------------
{
  const editor = session();
  step(editor, "set a format on a string chart header", () => grid.setGridColumnFormat(editor, C_INLINE, 2, "#,##0"), () => {
    assert.deepEqual(editor.get(`${C_INLINE}.data.columns.2`), { name: "Costs", format: "#,##0" }, "the string header became a DataColumn");
  });
  step(editor, "change a DataColumn format", () => grid.setGridColumnFormat(editor, C_INLINE, 1, "0.0"), () => {
    assert.deepEqual(editor.get(`${C_INLINE}.data.columns.1`), { name: "Revenue", format: "0.0" });
  });
  step(editor, "clear a DataColumn format", () => grid.setGridColumnFormat(editor, C_INLINE, 1, null), () => {
    assert.equal(editor.get(`${C_INLINE}.data.columns.1`), "Revenue", "clearing the format returns the header to a string");
  });
  step(editor, "an empty string clears too", () => grid.setGridColumnFormat(editor, C_INLINE, 1, ""), () => {
    assert.equal(editor.get(`${C_INLINE}.data.columns.1`), "Revenue");
  });
  assert.equal(grid.setGridColumnFormat(editor, C_INLINE, 2, null).changed, false, "clearing no format changes nothing");
  assert.equal(editor.snapshot().undoDepth, 0);
  refuses(editor, "an invalid format", () => grid.setGridColumnFormat(editor, C_INLINE, 2, "abc"), "number-format-invalid");
  try {
    grid.setGridColumnFormat(editor, C_INLINE, 2, "abc");
  } catch (error) {
    assert.equal(error.message, core.numberFormatError("abc"), "the reason is core's");
  }
  assert.equal(grid.columnFormatError("abc"), core.numberFormatError("abc"));
  assert.equal(grid.columnFormatError("#,##0.0"), undefined);
  assert.equal(grid.columnFormatError(""), undefined, "an empty format clears");
  refuses(editor, "a column that does not exist", () => grid.setGridColumnFormat(editor, C_INLINE, 9, "0"), "grid-column-out-of-range");

  // A table: a string header becomes a DataColumn, a styled header keeps its style, and a header-less table has nowhere for a format.
  step(editor, "set a format on a string table header", () => grid.setGridColumnFormat(editor, T_INLINE, 0, "0"), () => {
    assert.deepEqual(editor.get(`${T_INLINE}.columns.0`), { name: "Region", format: "0" });
  });
  step(editor, "set a format on a styled table header", () => grid.setGridColumnFormat(editor, T_INLINE, 2, "0%"), () => {
    assert.deepEqual(editor.get(`${T_INLINE}.columns.2`), { value: "Growth", style: { align: "right" }, format: "0%" });
  });
  step(editor, "clear a styled header's format", () => grid.setGridColumnFormat(editor, T_INLINE, 2, null), () => {
    assert.deepEqual(editor.get(`${T_INLINE}.columns.2`), { value: "Growth", style: { align: "right" } });
  });
  const noHeader = session({ name: "NH", design: { theme: "minimal", fontScheme: "aptos" }, slides: [{ id: "n", title: "N", table: { rows: [["a", 1]] } }] });
  refuses(noHeader, "a table without a header", () => grid.setGridColumnFormat(noHeader, "slides.0.table", 1, "0"), "grid-no-header");

  // A dataset column's format is the dataset's.
  step(editor, "set a format on a dataset column", () => grid.setGridColumnFormat(editor, C_FIELDS, 1, "0.00"), () => {
    assert.deepEqual(editor.get("datasets.revenue.columns.2"), { name: "Costs", format: "0.00" });
    assert.deepEqual(editor.get(`${C_FIELDS}.data`), { dataset: "revenue", fields: ["Quarter", "Costs"] });
  });
}

// --- a chart that shows a shared dataset --------------------------------------------------------------------
{
  const editor = session();
  const target = grid.resolveDataGridTarget(editor.document, `${C_FIELDS}.data.dataset`);
  assert.equal(target.kind, "chart");
  assert.equal(target.path, C_FIELDS);
  assert.deepEqual(target.dataset, { id: "revenue", fields: ["Quarter", "Costs"], count: 3, items: [C_FIELDS, T_DATASET, C_ALL] }, "the dataset is shared by three items");

  const view = grid.describeDataGrid(editor.document, C_FIELDS);
  assert.deepEqual(view.columnNames, ["Quarter", "Costs"], "fields select and order the columns");
  assert.deepEqual(view.lines.map((line) => line.map((cell) => cell.text)), [["Quarter", "Costs"], ["Q1", "5"], ["Q2", "8"], ["Q3", "9"]]);
  assert.deepEqual(view.dataset, { id: "revenue", fields: ["Quarter", "Costs"], items: [C_FIELDS, T_DATASET, C_ALL] });

  // A cell edit maps back to the dataset's own column index.
  const edit = step(editor, "edit a cell through fields", () => grid.setGridCells(editor, C_FIELDS, [{ ...body(1, 1), text: "80" }]), () => {
    assert.equal(editor.get("datasets.revenue.rows.1.2"), 80, "Costs is the dataset's column 2");
    assert.deepEqual(editor.get("datasets.revenue.rows.1"), ["Q2", 18.1, 80, "second"], "the hidden columns keep their data");
  });
  assert.equal(edit.dataset, "revenue");
  assert.deepEqual(edit.patches, [{ op: "test", path: "/datasets/revenue/rows/1/2", value: 8 }, { op: "replace", path: "/datasets/revenue/rows/1/2", value: 80 }]);
  assert.deepEqual(editor.get(`${C_FIELDS}.data`), { dataset: "revenue", fields: ["Quarter", "Costs"] }, "the chart itself is untouched");
  refuses(editor, "text in a dataset series cell", () => grid.setGridCells(editor, C_FIELDS, [{ ...body(0, 1), text: "lots" }]), "invalid-grid-values");

  step(editor, "rename a selected column updates fields, mapping and the other items", () => grid.setGridCells(editor, C_FIELDS, [{ ...header(1), text: "Spend" }]), () => {
    assert.deepEqual(editor.get("datasets.revenue.columns"), ["Quarter", { name: "Revenue", format: "$#,##0.0" }, "Spend", "Notes"]);
    assert.deepEqual(editor.get(`${C_FIELDS}.data.fields`), ["Quarter", "Spend"]);
    assert.deepEqual(editor.get(`${C_ALL}.mapping`), { series: ["Spend"] }, "another chart's mapping follows the rename");
    assert.equal(editor.get(`${T_DATASET}.fields`).includes("Spend"), false, "a table that does not select the column is untouched");
  });
  step(editor, "rename a hidden column", () => grid.setGridCells(editor, T_DATASET, [{ ...header(1), text: "Sales" }]), () => {
    assert.deepEqual(editor.get(`${T_DATASET}.fields`), ["Quarter", "Sales"]);
    assert.deepEqual(editor.get("datasets.revenue.columns.1"), { name: "Sales", format: "$#,##0.0" }, "the format stays");
  });

  step(editor, "insert a row keeps hidden columns", () => grid.insertGridRows(editor, C_FIELDS, 1, 1), () => {
    assert.deepEqual(editor.get("datasets.revenue.rows"), [["Q1", 12.4, 5, "first"], [null, null, null, null], ["Q2", 18.1, 8, "second"], ["Q3", 24, 9, "third"]]);
  });
  step(editor, "delete a row", () => grid.deleteGridRows(editor, C_FIELDS, [0]), () => {
    assert.deepEqual(editor.get("datasets.revenue.rows"), [["Q2", 18.1, 8, "second"], ["Q3", 24, 9, "third"]]);
  });
  step(editor, "sort rows keeps each row's hidden cells with it", () => grid.sortGridRows(editor, C_FIELDS, 1, { direction: "desc" }), () => {
    assert.deepEqual(editor.get("datasets.revenue.rows"), [["Q3", 24, 9, "third"], ["Q2", 18.1, 8, "second"], ["Q1", 12.4, 5, "first"]]);
  });
  step(editor, "move rows", () => grid.moveGridRows(editor, C_FIELDS, 0, 2), () => {
    assert.deepEqual(editor.get("datasets.revenue.rows").map((row) => row[3]), ["second", "third", "first"]);
  });
  step(editor, "paste adds rows to the dataset", () => grid.pasteGridText(editor, C_FIELDS, body(2, 0), "Q3\t9\nQ4\t11"), () => {
    assert.deepEqual(editor.get("datasets.revenue.rows.3"), ["Q4", null, 11, null]);
    assert.deepEqual(editor.get("datasets.revenue.rows.2"), ["Q3", 24, 9, "third"]);
  });

  // Adding a column while fields is set adds it to the dataset and to fields.
  step(editor, "insert a column adds it to the dataset and to fields", () => grid.insertGridColumns(editor, C_FIELDS, 1, 1), () => {
    assert.deepEqual(editor.get("datasets.revenue.columns"), ["Quarter", { name: "Revenue", format: "$#,##0.0" }, "Costs", "Notes", "New column"]);
    assert.deepEqual(editor.get(`${C_FIELDS}.data.fields`), ["Quarter", "New column", "Costs"]);
    assert.deepEqual(editor.get("datasets.revenue.rows.0"), ["Q1", 12.4, 5, "first", null]);
    assert.deepEqual(editor.get(`${T_DATASET}.fields`), ["Quarter", "Revenue"], "other items are untouched");
  });
  step(editor, "two new columns get distinct names", () => grid.insertGridColumns(editor, C_FIELDS, 2, 2), () => {
    assert.deepEqual(editor.get(`${C_FIELDS}.data.fields`), ["Quarter", "Costs", "New column", "New column 2"]);
  });
  step(editor, "delete a selected column leaves the dataset alone", () => grid.deleteGridColumns(editor, C_FIELDS, [1]), () => {
    assert.deepEqual(editor.get(`${C_FIELDS}.data.fields`), ["Quarter"]);
    assert.equal(editor.get("datasets.revenue.columns").length, 4, "the dataset keeps the column");
    assert.deepEqual(editor.get("datasets.revenue.rows.0"), ["Q1", 12.4, 5, "first"]);
  });
  step(editor, "move a column reorders fields only", () => grid.moveGridColumns(editor, C_FIELDS, 0, 1), () => {
    assert.deepEqual(editor.get(`${C_FIELDS}.data.fields`), ["Costs", "Quarter"]);
    assert.deepEqual(editor.get("datasets.revenue.columns.0"), "Quarter", "the dataset's own order is unchanged");
  });
  refuses(editor, "swap rows and columns of a shared dataset", () => chart.transposeChart(editor, C_FIELDS), "grid-dataset-shared");

  // Without fields the dataset itself changes, which another item's fields forbid.
  const T_ALL = "slides.0.blocks.2.table";
  refuses(editor, "delete a column another item's fields select", () => grid.deleteGridColumns(editor, C_ALL, [1]), "dataset-column-in-use");
  step(editor, "delete an unused dataset column", () => grid.deleteGridColumns(editor, C_ALL, [3]), () => {
    assert.deepEqual(editor.get("datasets.revenue.columns"), ["Quarter", { name: "Revenue", format: "$#,##0.0" }, "Costs"]);
    assert.deepEqual(editor.get("datasets.revenue.rows.0"), ["Q1", 12.4, 5]);
    assert.deepEqual(editor.get(`${T_ALL}.fields`), ["Quarter", "Revenue"]);
  });
  step(editor, "insert a column into a whole dataset", () => grid.insertGridColumns(editor, C_ALL, 4, 1), () => {
    assert.equal(editor.get("datasets.revenue.columns.4"), "New column");
    assert.equal(editor.get(`${C_ALL}.data.fields`), undefined, "no fields appear");
  });
}

// --- a table that shows a shared dataset --------------------------------------------------------------------
{
  const editor = session();
  const view = grid.describeDataGrid(editor.document, T_DATASET);
  assert.equal(view.kind, "table");
  assert.equal(view.hasHeader, true, "a dataset table always has the dataset's column names as its header");
  assert.deepEqual(view.lines.map((line) => line.map((cell) => cell.text)), [["Quarter", "Revenue"], ["Q1", "12.4"], ["Q2", "18.1"], ["Q3", "24"]]);
  assert.deepEqual(view.columnFormats, [undefined, "$#,##0.0"]);
  step(editor, "edit a dataset table cell", () => grid.setGridCells(editor, T_DATASET, [{ ...body(0, 1), text: "13" }]), () => {
    assert.equal(editor.get("datasets.revenue.rows.0.1"), 13, "a number-looking cell stays a number");
  });
  step(editor, "edit text in a dataset table", () => grid.setGridCells(editor, T_DATASET, [{ ...body(0, 0), text: "Q1 2026" }]), () => {
    assert.equal(editor.get("datasets.revenue.rows.0.0"), "Q1 2026");
  });
  step(editor, "clear a dataset table cell", () => grid.setGridCells(editor, T_DATASET, [{ ...body(0, 1), text: "" }]), () => {
    assert.equal(editor.get("datasets.revenue.rows.0.1"), "", "a table cell cleared is empty text");
  });
  step(editor, "insert a row into a dataset table", () => grid.insertGridRows(editor, T_DATASET, 3, 1), () => {
    assert.deepEqual(editor.get("datasets.revenue.rows.3"), [null, null, null, null], "a new dataset row is empty (null), so charts see a gap");
  });
  step(editor, "sort a dataset table", () => grid.sortGridRows(editor, T_DATASET, 1, { direction: "desc" }), () => {
    assert.deepEqual(editor.get("datasets.revenue.rows").map((row) => row[0]), ["Q3", "Q2", "Q1"]);
  });
  refuses(editor, "a header row toggle on a dataset table", () => grid.setGridHeader(editor, T_DATASET, false), "grid-dataset-shared");
  refuses(editor, "table cell styles on a dataset table", () => tables.setTableStyle(editor, T_DATASET, "banded"), "table-dataset-backed");
  refuses(editor, "merging cells of a dataset table", () => tables.mergeTableCells(editor, T_DATASET, { section: "body", row: 0, column: 0 }, { colSpan: 2 }), "table-dataset-backed");

  // A missing dataset is reported, not thrown through the UI.
  const broken = deck();
  broken.slides[0].blocks[2].table.dataset = "missing";
  const target = grid.resolveDataGridTarget(broken, T_DATASET);
  assert.equal(target.editable, false);
  assert.match(target.reason, /dataset 'missing'/);
  const unknownField = deck();
  unknownField.slides[0].blocks[1].chart.data.fields = ["Quarter", "Nope"];
  assert.equal(grid.resolveDataGridTarget(unknownField, C_FIELDS).editable, false);
  assert.match(grid.resolveDataGridTarget(unknownField, C_FIELDS).reason, /"Nope"/);
}

// --- chart mapping ----------------------------------------------------------------------------------------------
{
  const editor = session();
  const view = grid.describeChartMapping(editor.document, C_INLINE);
  assert.deepEqual({ xy: view.xy, category: view.category, series: view.series, authored: view.authored }, { xy: false, category: "Quarter", series: ["Revenue", "Costs"], authored: undefined });
  assert.deepEqual(view.columns.map((column) => column.role), ["category", "series", "series"]);
  assert.equal(view.columns[1].format, "$#,##0.0");

  step(editor, "choose the series", () => grid.setChartMapping(editor, C_INLINE, { series: ["Costs"] }), () => {
    assert.deepEqual(editor.get(`${C_INLINE}.mapping`), { series: ["Costs"] });
    assert.deepEqual(grid.describeDataGrid(editor.document, C_INLINE).columnRoles, ["category", "other", "series"], "a column the mapping leaves out is not plotted");
  });
  step(editor, "series in another order", () => grid.setChartMapping(editor, C_INLINE, { series: ["Costs", "Revenue"] }), () => {
    assert.deepEqual(editor.get(`${C_INLINE}.mapping`), { series: ["Costs", "Revenue"] });
  });
  step(editor, "choose another category", () => grid.setChartMapping(editor, C_INLINE, { category: "Costs" }), () => {
    assert.deepEqual(editor.get(`${C_INLINE}.mapping`), { category: "Costs" }, "the other columns are series by default, so no series field is written");
    assert.deepEqual(grid.describeChartMapping(editor.document, C_INLINE).series, ["Quarter", "Revenue"]);
  });
  // Setting the default removes the field; setting everything to the default removes the mapping.
  const withMapping = session();
  grid.setChartMapping(withMapping, C_INLINE, { series: ["Costs"] });
  grid.setChartMapping(withMapping, C_INLINE, { series: ["Revenue", "Costs"] });
  assert.equal(withMapping.get(`${C_INLINE}.mapping`), undefined, "the default mapping is not written");
  assert.deepEqual(withMapping.document, deck(), "the document is back to how it was");
  assert.equal(grid.setChartMapping(withMapping, C_INLINE, { category: "Quarter" }).changed, false, "the default again changes nothing");
  refuses(editor, "an unknown column", () => grid.setChartMapping(editor, C_INLINE, { category: "Profit" }), "chart-mapping-unknown-column");
  refuses(editor, "an X column on a column chart", () => grid.setChartMapping(editor, C_INLINE, { x: "Revenue" }), "chart-mapping-x-unsupported");
  refuses(editor, "no series", () => grid.setChartMapping(editor, C_INLINE, { series: [] }), "chart-mapping-no-series");
  refuses(editor, "mapping a table", () => grid.setChartMapping(editor, T_INLINE, { category: "Region" }), "grid-wrong-kind");

  // A scatter chart: the X column.
  const xy = grid.describeChartMapping(editor.document, C_SCATTER);
  assert.equal(xy.xy, true);
  assert.equal(xy.x, "Spend");
  assert.deepEqual(xy.series, ["Revenue", "Margin"]);
  step(editor, "choose the X column", () => grid.setChartMapping(editor, C_SCATTER, { x: "Revenue" }), () => {
    assert.deepEqual(editor.get(`${C_SCATTER}.mapping`), { x: "Revenue" });
    assert.deepEqual(grid.describeChartMapping(editor.document, C_SCATTER).series, ["Spend", "Margin"]);
    assert.deepEqual(grid.describeDataGrid(editor.document, C_SCATTER).columnRoles, ["label", "series", "x", "series"]);
  });
  refuses(editor, "X equal to the category", () => grid.setChartMapping(editor, C_SCATTER, { x: "Label" }), "chart-mapping-conflict");

  // A mapping on a dataset chart is the chart's own; the names are those of the fields.
  step(editor, "map a dataset chart", () => grid.setChartMapping(editor, C_FIELDS, { category: "Costs" }), () => {
    assert.deepEqual(editor.get(`${C_FIELDS}.mapping`), { category: "Costs" });
  });
  assert.deepEqual(grid.describeChartMapping(editor.document, C_ALL), {
    path: C_ALL,
    xy: false,
    columns: [{ name: "Quarter", role: "category" }, { name: "Revenue", format: "$#,##0.0", role: "other" }, { name: "Costs", role: "series" }, { name: "Notes", role: "other" }],
    category: "Quarter",
    series: ["Costs"],
    authored: { series: ["Costs"] },
  });
}

// --- renames and deletions follow the chart's mapping ------------------------------------------------------------
{
  const editor = session();
  grid.setChartMapping(editor, C_INLINE, { series: ["Costs"] });
  step(editor, "rename a mapped series", () => grid.setGridCells(editor, C_INLINE, [{ ...header(2), text: "Expenses" }]), () => {
    assert.deepEqual(editor.get(`${C_INLINE}.mapping`), { series: ["Expenses"] });
  });
  step(editor, "delete the mapped series", () => grid.deleteGridColumns(editor, C_INLINE, [2]), () => {
    assert.equal(editor.get(`${C_INLINE}.mapping`), undefined, "an emptied mapping is removed");
  });
  step(editor, "move a column keeps the mapping", () => grid.moveGridColumns(editor, C_INLINE, 2, 1), () => {
    assert.deepEqual(editor.get(`${C_INLINE}.mapping`), { series: ["Costs"] });
  });
  step(editor, "a new column of a mapped chart is named", () => grid.insertGridColumns(editor, C_INLINE, 3, 1), () => {
    assert.equal(editor.get(`${C_INLINE}.data.columns.3`), "New column", "names stay unique where a mapping addresses them");
  });
  step(editor, "transpose drops a mapping that no longer names columns", () => chart.transposeChart(editor, C_INLINE), () => {
    assert.equal(editor.get(`${C_INLINE}.mapping`), undefined);
  });
  // A column the mapping does not plot may hold text.
  step(editor, "text in a column the chart does not plot", () => grid.setGridCells(editor, C_ALL, [{ ...body(0, 3), text: "note" }, { ...body(1, 1), text: "7" }]), () => {
    assert.equal(editor.get("datasets.revenue.rows.0.3"), "note");
    assert.equal(editor.get("datasets.revenue.rows.1.1"), 7, "a number typed into an unplotted column stays a number");
  });
  refuses(editor, "text in the plotted column", () => grid.setGridCells(editor, C_ALL, [{ ...body(0, 2), text: "note" }]), "invalid-grid-values");
}

// --- give an item its own copy of a dataset ------------------------------------------------------------------------
{
  const editor = session();
  const change = step(editor, "use a copy of the data (chart with fields)", () => grid.detachGridDataset(editor, C_FIELDS), () => {
    assert.deepEqual(editor.get(`${C_FIELDS}.data`), { columns: ["Quarter", "Costs"], rows: [["Q1", 5], ["Q2", 8], ["Q3", 9]], source: { src: "./data/revenue.csv", retrieved: "2026-10-05" } });
    assert.ok(editor.get("datasets.revenue"), "the dataset stays for the others");
    assert.equal(grid.resolveDataGridTarget(editor.document, C_FIELDS).dataset, undefined);
    assert.equal(grid.resolveDataGridTarget(editor.document, C_ALL).dataset.count, 2);
  });
  assert.equal(change.dataset, "revenue");
  step(editor, "use a copy of the data (table)", () => grid.detachGridDataset(editor, T_DATASET), () => {
    assert.deepEqual(editor.get(T_DATASET), { columns: ["Quarter", { name: "Revenue", format: "$#,##0.0" }], rows: [["Q1", 12.4], ["Q2", 18.1], ["Q3", 24]] });
  });
  refuses(editor, "a copy of inline data", () => grid.detachGridDataset(editor, C_INLINE), "grid-not-dataset");
}

// --- import as a shared dataset ------------------------------------------------------------------------------------
{
  const csv = "Quarter,Revenue,Costs\nQ1,12,8\nQ2,18,11\n";
  const content = createDataContent(csv, { as: "chart", chartType: "column" });
  const editor = session({ name: "Import", design: { theme: "minimal", fontScheme: "aptos" }, slides: [{ id: "a", title: "A", text: "Hello" }] });
  const stored = prepareDatasetImport(editor.document, content, { id: "revenue", source: { src: "./revenue.csv", retrieved: "2026-10-05" } });
  assert.deepEqual(stored.content, { chart: { type: "column", data: { dataset: "revenue" } } });
  assert.equal(stored.replaced, false);
  assert.deepEqual(stored.patches.map((patch) => patch.op), ["add"]);
  editor.applyPatch([...stored.patches, { op: "add", path: "/slides/1", value: { id: "data", title: "Data", ...stored.content } }], { label: "Import data" });
  assert.equal(editor.snapshot().undoDepth, 1, "the dataset and the slide are one undo step");
  assert.deepEqual(editor.get("datasets.revenue"), { columns: ["Quarter", "Revenue", "Costs"], rows: [["Q1", 12, 8], ["Q2", 18, 11]], source: { src: "./revenue.csv", retrieved: "2026-10-05" } });
  assert.equal(validatePresentation(editor.document).valid, true);
  assert.equal(grid.resolveDataGridTarget(editor.document, "slides.1.chart").dataset.count, 1);
  assert.equal(core.unusedDatasets(editor.document).length, 0);
  editor.undo();
  assert.equal(editor.document.datasets, undefined, "undo removes the dataset again");
  editor.redo();

  // Importing into an existing id replaces its columns and rows and keeps its title and source.
  const again = prepareDatasetImport(editor.document, createDataContent("Quarter,Revenue,Costs\nQ1,1,2\n", { as: "table" }), { id: "revenue" });
  assert.equal(again.replaced, true);
  assert.deepEqual(again.content, { table: { dataset: "revenue" } });
  editor.applyPatch([...again.patches, { op: "add", path: "/slides/2", value: { id: "t", title: "T", ...again.content } }]);
  assert.deepEqual(editor.get("datasets.revenue.rows"), [["Q1", "1", "2"]], "a CSV table keeps its cells as text");
  assert.deepEqual(editor.get("datasets.revenue.source"), { src: "./revenue.csv", retrieved: "2026-10-05" });
  assert.equal(validatePresentation(editor.document).valid, true);

  for (const bad of ["", "-x", "a b", "a/b", undefined]) assert.throws(() => prepareDatasetImport(editor.document, content, { id: bad }), (error) => error.code === "dataset-id-invalid", `id ${JSON.stringify(bad)}`);
  assert.ok(DATASET_ID_PATTERN.test("pipeline-2026"));
}

// --- nothing else crashes on the new shapes -----------------------------------------------------------------------
{
  const editor = session();
  // find and replace reads dataset text and DataColumn names, and leaves names that mapping and fields address alone.
  const fields = findReplace.collectSearchFields(editor.document);
  assert.ok(fields.some((field) => field.path === "datasets.revenue.rows.0.3" && field.text === "first"), "dataset text cells are searchable");
  assert.ok(fields.some((field) => field.path === `${C_INLINE}.data.columns.1.name` && field.text === "Revenue"), "a DataColumn name is searchable");
  assert.ok(!fields.some((field) => field.path.startsWith(`${C_ALL}.data.columns`)), "a chart with a mapping keeps its column names");
  assert.ok(fields.some((field) => field.path === `${T_INLINE}.columns.1.name`), "a table DataColumn header is searchable");
  const matches = findReplace.findMatches(editor.document, "first");
  assert.equal(matches.matches.length, 1);
  findReplace.replaceAll(editor, "first", "opening");
  assert.equal(editor.get("datasets.revenue.rows.0.3"), "opening");
  assert.equal(validatePresentation(editor.document).valid, true);

  // chart type compatibility reads the resolved data (dataset, fields and mapping).
  const ids = (path) => switches.compatibleChartTypes(editor.document, { path }).map((entry) => entry.id);
  assert.ok(ids("slides.0.blocks.1").includes("pie"), "a dataset chart with fields that select one series suits a pie");
  assert.ok(ids("slides.0.blocks.5").includes("pie") && !ids("slides.0.blocks.5").includes("stacked-column-3x"), "a mapping that plots one series suits a pie");
  assert.ok(ids("slides.0.blocks.0").includes("clustered-column"), "inline DataColumn data suits two series");

  // Table style reads of a dataset table are refused with a reason; the panel treats that as "no inline table".
  assert.throws(() => tables.readTableStyle(editor.document, T_DATASET), (error) => error.code === "table-dataset-backed");
  assert.equal(tables.parseTableCellPath(`${T_DATASET}.fields`), undefined);

  // Block conversion of a dataset chart keeps the reference; a dataset table converts with the document.
  assert.doesNotThrow(() => tables.describeTableCell(editor.get(T_INLINE), { section: "header", row: 0, column: 1 }), "a DataColumn header describes without throwing");
}

// --- review fixes: names, headers, style, mapping after a type switch ---------------------------------------------------
{
  // A new column of a dataset is named distinctly from every column of the dataset, also the ones `fields` hides.
  const hidden = () => ({
    name: "Hidden names",
    design: { theme: "minimal", fontScheme: "aptos" },
    datasets: { ds: { columns: ["A", "New column", "B"], rows: [["a", "x", 1], ["b", "y", 2]] } },
    slides: [{ id: "d", title: "D", blocks: [
      { chart: { type: "column", data: { dataset: "ds", fields: ["A", "B"] } } },
      { chart: { type: "column", data: { dataset: "ds", fields: ["B", "A"] } } },
    ] }],
  });
  const H0 = "slides.0.blocks.0.chart";
  const editor = session(hidden());
  step(editor, "insert a column beside a hidden 'New column'", () => grid.insertGridColumns(editor, H0, 2), () => {
    assert.deepEqual(editor.get("datasets.ds.columns"), ["A", "New column", "B", "New column 2"]);
    assert.deepEqual(editor.get(`${H0}.data.fields`), ["A", "B", "New column 2"]);
  });
  step(editor, "paste that grows the grid beside a hidden 'New column'", () => grid.pasteGridText(editor, H0, body(0, 1), "1\t2\t3"), () => {
    assert.deepEqual(editor.get("datasets.ds.columns").slice(3), ["New column 2", "New column 3"]);
  });
  // A column name of a shared dataset (or of a chart with a mapping) is never blank.
  refuses(editor, "a blank dataset column name", () => grid.setGridCells(editor, H0, [{ section: "header", column: 1, text: "  " }]), "invalid-grid-values");
  refuses(editor, "a duplicate dataset column name", () => grid.setGridCells(editor, H0, [{ section: "header", column: 1, text: "A" }]));
}

{
  // A header that holds DataColumn objects: turning the header off, styling and merging keep the document valid.
  const withHeader = () => ({
    name: "Header", design: { theme: "minimal", fontScheme: "aptos" },
    slides: [{ id: "d", title: "D", blocks: [{ table: { columns: ["Region", { name: "Share", format: "0%" }], rows: [["EMEA", 0.4], ["APAC", 0.6]] } }] }],
  });
  const T = "slides.0.blocks.0.table";
  const editor = session(withHeader());
  step(editor, "header off over DataColumn headers", () => grid.setGridHeader(editor, T, false), () => {
    assert.deepEqual(editor.get(`${T}.rows`)[0], ["Region", "Share"], "the names become the first body row");
    assert.equal(editor.get(`${T}.columns`), undefined);
  });
  step(editor, "style a DataColumn header cell", () => tables.setTableCellStyle(editor, T, [{ section: "header", column: 1 }], { align: "right" }), () => {
    assert.deepEqual(editor.get(`${T}.columns.1`), { value: "Share", format: "0%", style: { align: "right" } }, "the column keeps its format as a styled header");
  });
  step(editor, "a table style over DataColumn headers", () => tables.setTableStyle(editor, T, "minimal"));
  step(editor, "merge a DataColumn header, joining the text", () => tables.mergeTableCells(editor, T, { section: "header", row: 0, column: 0 }, { colSpan: 2 }, { join: true }), () => {
    assert.equal(editor.get(`${T}.columns.0.value`), "Region Share", "the joined text is the names, not objects");
  });
}

{
  // Switching a scatter chart to a type without an X axis drops the `mapping.x` the type cannot use.
  const scatter = () => ({
    name: "Scatter", design: { theme: "minimal", fontScheme: "aptos" },
    slides: [{ id: "d", title: "D", blocks: [{ chart: { type: "scatter", data: { columns: ["L", "X", "Y", "Z"], rows: [["a", 1, 2, 3]] }, mapping: { x: "Z", series: ["Y"] } } }] }],
  });
  const editor = session(scatter());
  const warnings = () => (validatePresentation(editor.document).warnings ?? []).map((entry) => entry.params?.code ?? entry.code);
  step(editor, "switch a scatter chart with mapping.x to column", () => switches.switchDimension(editor, "charts", "column", { slideIndex: 0, path: "slides.0.blocks.0" }), () => {
    assert.deepEqual(editor.get("slides.0.blocks.0.chart.mapping"), { series: ["Y"] }, "x leaves the mapping");
    assert.ok(!warnings().includes("chart-mapping-adapted"), "no chart-mapping-adapted warning is left behind");
  });
  const only = session({ ...scatter(), slides: [{ id: "d", title: "D", blocks: [{ chart: { type: "scatter", data: { columns: ["L", "X", "Y"], rows: [["a", 1, 2]] }, mapping: { x: "Y" } } }] }] });
  switches.switchDimension(only, "charts", "column", { slideIndex: 0, path: "slides.0.blocks.0" });
  assert.equal(only.get("slides.0.blocks.0.chart.mapping"), undefined, "a mapping left empty is removed");
  switches.switchDimension(only, "charts", "scatter", { slideIndex: 0, path: "slides.0.blocks.0" });
  assert.equal(only.get("slides.0.blocks.0.chart.type"), "scatter", "switching back keeps working");
}

// --- inserting slides that use a shared dataset ---------------------------------------------------------------------
{
  const incoming = (rows) => ({
    name: "Other", design: { theme: "minimal", fontScheme: "aptos" },
    datasets: { revenue: { columns: ["Quarter", "Revenue"], rows }, spare: { columns: ["X"], rows: [[1]] } },
    slides: [{ id: "in", title: "In", blocks: [{ chart: { type: "column", data: { dataset: "revenue" }, mapping: { series: ["Revenue"] } } }, { table: { dataset: "revenue", fields: ["Quarter"] } }] }],
  });
  const current = deck();
  // Different rows under a name the deck already uses: the incoming dataset is stored under a new id and the slide follows it.
  const merged = prepareOpfImport(current, { document: incoming([["Q1", 1]]) }, { mode: "insert", slideIndex: 0 });
  assert.equal(validatePresentation(merged.document).valid, true, "the merged deck is valid OPF");
  assert.deepEqual(merged.document.datasets.revenue, current.datasets.revenue, "the deck's own dataset is untouched");
  assert.deepEqual(merged.document.datasets["revenue-2"].rows, [["Q1", 1]], "the incoming dataset is kept under a free id");
  assert.equal(merged.document.datasets.spare, undefined, "a dataset no inserted slide uses is not copied");
  const inserted = merged.document.slides[1].blocks;
  assert.deepEqual([inserted[0].chart.data, inserted[1].table.dataset], [{ dataset: "revenue-2" }, "revenue-2"], "every reference follows the new id");
  // The same dataset under the same id is shared, not copied.
  const same = prepareOpfImport(current, { document: { ...incoming(current.datasets.revenue.rows), datasets: { revenue: current.datasets.revenue } } }, { mode: "insert", slideIndex: 0 });
  assert.deepEqual(Object.keys(same.document.datasets), ["revenue"], "an identical dataset is reused");
  assert.equal(same.document.slides[1].blocks[0].chart.data.dataset, "revenue");
  // A deck with no datasets takes the incoming ones as they are.
  const bare = prepareOpfImport({ name: "Bare", design: { theme: "minimal", fontScheme: "aptos" }, slides: [{ id: "b", title: "B", blocks: [{ text: "x" }] }] }, { document: incoming([["Q1", 1]]) }, { mode: "insert", slideIndex: 0 });
  assert.deepEqual(Object.keys(bare.document.datasets), ["revenue"]);
  assert.equal(validatePresentation(bare.document).valid, true);
}

// --- numbers show formatted in the grid; the raw value is what editing and copying use ------------------------------------
{
  const editor = session();
  const texts = (path, column) => grid.describeDataGrid(editor.document, path).lines.slice(1).map((line) => line[column]);
  // A chart column with a format shows it; the stored value is the cell's text.
  const revenue = texts(C_INLINE, 1);
  assert.deepEqual(revenue.map((cell) => cell.display), ["$12.4", "$18.1"], "a formatted chart column shows its format");
  assert.deepEqual(revenue.map((cell) => cell.text), ["12.4", "18.1"], "the raw value stays as the cell text");
  assert.equal(texts(C_INLINE, 2)[0].display, undefined, "a column without a format shows the value as before");
  assert.equal(texts(C_INLINE, 0)[0].display, undefined, "a category column is never formatted");
  // A dataset column's format shows in every item that shows the column (the `fields` order does not matter).
  assert.deepEqual(texts(T_DATASET, 1).map((cell) => cell.display), ["$12.4", "$18.1", "$24.0"]);
  // A table body cell's own format wins over its column's; text and rich cells are left alone.
  const table = grid.describeDataGrid(editor.document, T_INLINE);
  assert.deepEqual(table.lines.slice(1).map((line) => line.map((cell) => cell.display)), [[undefined, "40%", "10.0%"], [undefined, "60%", "20%"]]);
  assert.deepEqual(table.lines.slice(1).map((line) => line[2].text), ["0.1", "0.2"], "a table cell's text is the raw value");
  // A format that does not apply leaves the number as it was, in the grid's own number format.
  const comma = grid.describeDataGrid(editor.document, C_INLINE, { decimal: "," });
  assert.equal(comma.lines[1][2].text, "5");
  const plain = session({ ...deck(), slides: [{ id: "p", title: "P", blocks: [{ chart: { type: "column", data: { columns: ["Q", "Revenue"], rows: [["Q1", 12.5]] } } }, { table: { columns: ["A", "B"], rows: [[1.5, 2]] } }] }] });
  const noFormats = [grid.describeDataGrid(plain.document, "slides.0.blocks.0.chart", { decimal: "," }), grid.describeDataGrid(plain.document, "slides.0.blocks.1.table")];
  assert.ok(noFormats.every((view) => view.lines.every((line) => line.every((cell) => !("display" in cell)))), "a document without formats has no display text");
  assert.equal(noFormats[0].lines[1][1].text, "12,5", "unformatted numbers follow the locale's decimal separator as before");
  // A table without a header has no column formats: its first body row is not a header.
  const headerless = session({ ...deck(), slides: [{ id: "h", title: "H", blocks: [{ table: { rows: [[{ value: 0.5, format: "0%" }, 2], [0.25, 3]] } }] }] });
  const headlessView = grid.describeDataGrid(headerless.document, "slides.0.blocks.0.table");
  assert.deepEqual(headlessView.columnFormats, [undefined, undefined], "a body cell's format is not a column format");
  assert.deepEqual(headlessView.lines.map((line) => line[0].display), ["50%", undefined]);
  // Copy writes the raw values; editing a formatted cell sees the raw text and a no-op edit changes nothing.
  assert.equal(grid.gridRangeText(editor.document, C_INLINE), "Quarter\tRevenue\tCosts\nQ1\t12.4\t5\nQ2\t18.1\t8");
  assert.equal(grid.prepareGridCells(editor.document, C_INLINE, [{ section: "body", row: 0, column: 1, text: "12.4" }]).changed, false);
  assert.equal(grid.describeDataGrid(editor.document, C_INLINE, { decimal: "," }).lines[1][1].display, "$12.4", "the format decides the formatted text; the decimal separator is for the raw text");
  assert.equal(grid.describeDataGrid(editor.document, C_INLINE, { decimal: "," }).lines[1][1].text, "12,4");
}

{
  // A two-column XY chart has no X column (core's rule since opf#376): the second column is its one series, plotted against row
  // numbers, so the Chart columns panel lists it as a series and a mapping can be written without an X.
  assert.deepEqual(grid.chartColumnRoles(2, "scatter", { category: "Point" }, ["Point", "Revenue"]), ["label", "series"]);
  assert.deepEqual(grid.chartColumnRoles(3, "scatter", { category: "Point" }, ["Point", "Spend", "Revenue"]), ["label", "x", "series"]);
  const narrow = { slides: [{ title: "Two columns", chart: { type: "scatter", data: { columns: ["Point", "Revenue"], rows: [["a", 1], ["b", 2]] } } }] };
  const unchanged = grid.prepareChartMapping(narrow, "slides.0.chart", { series: ["Revenue"] });
  assert.equal(unchanged.changed, false, "the default mapping of a two-column scatter is its one series: nothing to write");
}

console.log("Chart and table data (editor): DataColumn headers, shared datasets through fields, column number formats, chart mapping and import as a dataset, each one undoable patch; documents without the new fields behave as before.");
