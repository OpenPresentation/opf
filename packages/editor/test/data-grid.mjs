// RR-24: the data grid's model. Chart data and table edits, row and column operations (merged-cell aware), sorting, the header
// row, pasting TSV/CSV and number reading. Every operation is one validated patch and one undo step; none of them ever turns a gap
// into 0 or hides text.
import assert from "node:assert/strict";
import { defaultCatalog } from "@openpresentation/opf/catalog";
import { validate } from "@openpresentation/opf";
import { toSvg } from "@openpresentation/opf-render/svg";
import * as pptx from "@openpresentation/opf-pptx";
import { createEditorSession } from "../dist/index.js";
import * as grid from "../dist/data-grid.js";
import * as text from "../dist/grid-text.js";
import * as chart from "../dist/chart-data.js";
import * as tables from "../dist/table-options.js";

const C = "slides.0.blocks.0.chart";
const T = "slides.0.blocks.1.table";
const deck = () => ({
  name: "Data grid fixture",
  design: { theme: "minimal", fontScheme: "aptos" },
  slides: [
    {
      id: "data",
      title: "Data",
      blocks: [
        { chart: { type: "column", data: { columns: ["Quarter", "Revenue", "Costs"], rows: [["Q1", 12, 5], ["Q2", 18, null], ["Q3", 24, 9]] } } },
        { table: { columns: ["Region", "Q1", "Q2"], rows: [["North", 10, 2], ["South", 3, 4], ["East", 5, 6], ["West", 7, 8]] } },
      ],
    },
  ],
});
const session = (presentation = deck()) => createEditorSession(presentation, { rejectInvalid: true });
const svg = (presentation) => toSvg(presentation, 1);
const body = (row, column) => ({ section: "body", row, column });
const header = (column) => ({ section: "header", column });
const dataOf = (editor) => editor.get(`${C}.data`);
const rowsOf = (editor) => editor.get(`${T}.rows`);

// One operation = one undo step that restores the document exactly, and redo that returns it. The document is left as it was before.
function step(editor, name, action, expectation) {
  const before = editor.presentation;
  const depth = editor.snapshot().undoDepth;
  const change = action();
  assert.equal(change.changed, true, `${name} changed the document`);
  assert.equal(editor.snapshot().undoDepth, depth + 1, `${name} is one undo step`);
  assert.equal(validate(editor.presentation, { only: ["format"] }).valid, true, `${name} leaves valid OPF`);
  expectation?.(change);
  const after = editor.presentation;
  editor.undo();
  assert.deepEqual(editor.presentation, before, `${name} undoes in one step`);
  editor.redo();
  assert.deepEqual(editor.presentation, after, `${name} redoes`);
  editor.undo();
  assert.deepEqual(editor.presentation, before, `${name} undoes again`);
  return change;
}
const refuses = (editor, name, action, code) => {
  const before = editor.presentation;
  const depth = editor.snapshot().undoDepth;
  assert.throws(action, (error) => (code ? error.code === code : true), name);
  assert.deepEqual(editor.presentation, before, `${name} leaves the document alone`);
  assert.equal(editor.snapshot().undoDepth, depth, `${name} records no undo step`);
};

// --- number reading and TSV/CSV ---------------------------------------------------------------

{
  const point = { decimal: "." };
  const comma = { decimal: "," };
  assert.deepEqual(text.parseGridNumber("1,234.56", point), { value: 1234.56 });
  assert.deepEqual(text.parseGridNumber("1.234,56", comma), { value: 1234.56 });
  assert.deepEqual(text.parseGridNumber("1 234,5", comma), { value: 1234.5 });
  assert.deepEqual(text.parseGridNumber("1 234,5", comma), { value: 1234.5 }, "a narrow no-break space groups");
  assert.deepEqual(text.parseGridNumber("1'234.5", point), { value: 1234.5 }, "an apostrophe groups");
  assert.deepEqual(text.parseGridNumber("(1,234)", point), { value: -1234 }, "accounting parentheses are negative");
  assert.deepEqual(text.parseGridNumber("− 5", point), { value: -5 }, "a Unicode minus");
  assert.deepEqual(text.parseGridNumber("$1,200", point), { value: 1200 });
  assert.deepEqual(text.parseGridNumber("1.200,50 €", comma), { value: 1200.5 });
  assert.deepEqual(text.parseGridNumber("-$5", point), { value: -5 });
  assert.deepEqual(text.parseGridNumber("1.5e3", point), { value: 1500 });
  assert.deepEqual(text.parseGridNumber(".5", point), { value: 0.5 });
  assert.deepEqual(text.parseGridNumber("-0", point), { value: 0 }, "no negative zero");
  assert.deepEqual(text.parseGridNumber("   ", point), { empty: true }, "blank is empty, never 0");
  assert.deepEqual(text.parseGridNumber("", comma), { empty: true });
  for (const bad of ["abc", "1,5", "1.234,56", "12%", "NaN", "Infinity", "1e", "1,2,3", "1,234,56", "0x10", "1..2", "9007199254740993", "--5", "true"]) {
    const result = text.parseGridNumber(bad, point);
    assert.ok(result.error, `${bad} is refused in the point format: ${JSON.stringify(result)}`);
  }
  assert.match(text.parseGridNumber("1,5", point).error, /1\.234,56 format/, "the reason names the other format that reads it");
  assert.match(text.parseGridNumber("45%", point).error, /percent/i);
  assert.deepEqual(text.parseGridNumber("1,5", comma), { value: 1.5 });
  assert.deepEqual(text.parseGridNumber("1,234", point), { value: 1234 }, "in the point format a comma groups");
  assert.deepEqual(text.parseGridNumber("1,234", comma), { value: 1.234 }, "in the comma format it is a decimal: the format decides, nothing guesses");
  assert.equal(text.formatGridNumber(1234.5, comma), "1234,5");
  assert.equal(text.formatGridNumber(-0.25, point), "-0.25");
  assert.equal(text.resolveNumberFormat("auto", "de-DE").decimal, ",");
  assert.equal(text.resolveNumberFormat("auto", "en-US").decimal, ".");
  assert.equal(text.resolveNumberFormat("auto", "not a locale").decimal, ".", "an unknown locale falls back to the point");
  assert.equal(text.resolveNumberFormat(",", "en-US").decimal, ",");
  assert.equal(text.isCanonicalNumber("12.5"), true);
  assert.equal(text.isCanonicalNumber("012"), false);
  assert.equal(text.isCanonicalNumber("12,5"), false);
  assert.equal(text.isCanonicalNumber(" 12"), false);
  assert.equal(text.isCanonicalNumber("1e+21"), true);
  assert.equal(text.isCanonicalNumber("1e21"), false);
}

{
  assert.deepEqual(text.parseDelimited("a\tb\nc\td\n").rows, [["a", "b"], ["c", "d"]], "the final line break is not a row");
  assert.deepEqual(text.parseDelimited("a\tb\r\nc\td").rows, [["a", "b"], ["c", "d"]], "CRLF");
  assert.deepEqual(text.parseDelimited("﻿a,b\n1,2").rows, [["a", "b"], ["1", "2"]], "a BOM is dropped; commas detected");
  assert.equal(text.parseDelimited("a,b\n1,2").delimiter, ",");
  assert.equal(text.parseDelimited("a;b\n1,5;2,5").delimiter, ";", "semicolon CSV with decimal commas");
  assert.deepEqual(text.parseDelimited("a;b\n1,5;2,5").rows, [["a", "b"], ["1,5", "2,5"]]);
  assert.equal(text.parseDelimited("just text").delimiter, "\t");
  assert.deepEqual(text.parseDelimited("just text").rows, [["just text"]]);
  assert.deepEqual(text.parseDelimited('"a\nb"\t"say ""hi"""\tplain').rows, [["a\nb", 'say "hi"', "plain"]], "Excel quoting: line breaks and doubled quotes");
  assert.deepEqual(text.parseDelimited("a\t\tb\n\t\t").rows, [["a", "", "b"], ["", "", ""]], "empty cells stay empty");
  assert.deepEqual(text.parseDelimited('5" pipe\tx').rows, [['5" pipe', "x"]], "a quote inside an unquoted field is text");
  assert.deepEqual(text.parseDelimited("a\n\nb").rows, [["a"], [""], ["b"]], "a blank line is a row");
  assert.deepEqual(text.parseDelimited("").rows, []);
  assert.throws(() => text.parseDelimited('"open\tb'), (error) => error.code === "unclosed-quote");
  assert.throws(() => text.parseDelimited("a|b", { delimiter: "|" }), (error) => error.code === "invalid-delimiter");
  const rows = [["a\tb", 'c"d'], ["line\nbreak", "plain"], ["", "x"]];
  assert.deepEqual(text.parseDelimited(text.toDelimited(rows)).rows, rows, "TSV out and back in is the same cells");
  assert.deepEqual(text.rectangular([["a"], ["b", "c"]]), { rows: [["a", ""], ["b", "c"]], width: 2 });
}

// --- locating and describing ---------------------------------------------------------------------

{
  const presentation = deck();
  assert.deepEqual(grid.resolveDataGridTarget(presentation, "slides.0.blocks.0.chart"), { kind: "chart", path: "slides.0.blocks.0.chart" });
  assert.deepEqual(grid.resolveDataGridTarget(presentation, "slides.0.blocks.0.chart.data.columns.1"), { kind: "chart", path: "slides.0.blocks.0.chart" });
  assert.deepEqual(grid.resolveDataGridTarget(presentation, "slides.0.blocks.1.table.rows.2.1.value"), { kind: "table", path: "slides.0.blocks.1.table" });
  assert.deepEqual(grid.resolveDataGridTarget(presentation, "/slides/0/blocks/1/table/rows/0/0"), { kind: "table", path: "slides.0.blocks.1.table" });
  assert.equal(grid.resolveDataGridTarget(presentation, "slides.0.title"), undefined);
  assert.equal(grid.resolveDataGridTarget(presentation, "slides.0.blocks.0"), undefined);
  // A chart that shows a dataset the document does not hold has no grid; a data source by file or asset is not part of the format.
  const missing = deck();
  missing.slides[0].blocks[0] = { chart: { type: "column", data: { dataset: "gone" } } };
  const target = grid.resolveDataGridTarget(missing, "slides.0.blocks.0.chart");
  assert.equal(target.editable, false);
  assert.match(target.reason, /which the document does not hold/);
  assert.throws(() => grid.describeDataGrid(missing, "slides.0.blocks.0.chart"), (error) => error.code === "dataset-unavailable");
  const loose = deck();
  loose.slides[0].blocks[0] = { chart: { type: "column", data: { src: "asset:rev" } } };
  assert.throws(() => grid.describeDataGrid(loose, "slides.0.blocks.0.chart"), (error) => error.code === "grid-target-not-found" && /no inline columns and rows/.test(error.message));
  assert.throws(() => grid.describeDataGrid(presentation, "slides.0.title"), (error) => error.code === "grid-target-not-found");

  const model = grid.describeDataGrid(presentation, C);
  assert.deepEqual([model.kind, model.hasHeader, model.rowCount, model.columnCount], ["chart", true, 3, 3]);
  assert.deepEqual(model.columnRoles, ["category", "series", "series"]);
  assert.deepEqual(model.lines.map((line) => line.map((cell) => cell.text)), [["Quarter", "Revenue", "Costs"], ["Q1", "12", "5"], ["Q2", "18", ""], ["Q3", "24", "9"]]);
  assert.equal(model.lines[2][2].text, "", "a gap shows as empty, not 0");
  assert.deepEqual(model.warnings, []);
  assert.equal(grid.describeDataGrid(presentation, C, { decimal: "," }).lines[1][1].text, "12");
  assert.equal(grid.describeDataGrid(presentation, C, { numberFormat: "auto", locale: "de" }).kind, "chart");
  const decimals = deck();
  decimals.slides[0].blocks[0].chart.data.rows[0][1] = 12.5;
  assert.equal(grid.describeDataGrid(decimals, C, { decimal: "," }).lines[1][1].text, "12,5", "numbers show in the chosen format");
  assert.equal(grid.describeDataGrid(decimals, C).lines[1][1].text, "12.5");

  // Data the document already has that the chart cannot draw is reported, not hidden.
  const messy = deck();
  messy.slides[0].blocks[0].chart.data = { columns: ["Quarter", "", "Costs", "Costs"], rows: [["Q1", "n/a", 5, 6], [null, true, "7", 8]] };
  const warnings = grid.describeDataGrid(messy, C).warnings.map((warning) => warning.message);
  assert.ok(warnings.some((message) => /no name/.test(message)), "an unnamed series");
  assert.ok(warnings.some((message) => /also named "Costs"/.test(message)), "a repeated series name");
  assert.ok(warnings.some((message) => /not a number/.test(message)), "text in a series column");
  assert.ok(warnings.some((message) => /yes\/no/.test(message)), "true in a series column");
  assert.ok(warnings.some((message) => /no category/.test(message)), "a missing category");
  assert.ok(!warnings.some((message) => /Row 2, column D/.test(message)), "a numeric string is fine");

  // Scatter charts read x values from the second column.
  assert.deepEqual(grid.chartColumnRoles(3, "scatter"), ["label", "x", "series"]);
  assert.deepEqual(grid.chartColumnRoles(2, "scatter"), ["category", "series"]);
  assert.deepEqual(grid.chartColumnRoles(1, "histogram"), ["series"]);
}

// --- chart cells --------------------------------------------------------------------------------------

{
  const editor = session();
  const before = svg(editor.presentation);
  const change = step(editor, "edit a chart value", () => chart.setChartCells(editor, C, [{ ...body(0, 1), text: "15.5" }]), () => {
    assert.equal(dataOf(editor).rows[0][1], 15.5);
    assert.notEqual(svg(editor.presentation), before, "the preview draws the new value");
  });
  assert.deepEqual(change.patches.map((patch) => patch.op), ["test", "replace"], "one cell is one guarded replace");
  assert.equal(change.patches[1].path, "/slides/0/blocks/0/chart/data/rows/0/1");
}
{
  const editor = session();
  // A blank cell is a gap (null), never 0, and a gap can be filled.
  chart.setChartCells(editor, C, [{ ...body(0, 1), text: "" }]);
  assert.equal(dataOf(editor).rows[0][1], null);
  chart.setChartCells(editor, C, [{ ...body(1, 2), text: " 4,5 " }], { decimal: "," });
  assert.equal(dataOf(editor).rows[1][2], 4.5, "a decimal comma in the comma format");
  // Text that is not a number is refused with a reason; nothing is applied and nothing is 0.
  refuses(editor, "text in a series cell", () => chart.setChartCells(editor, C, [{ ...body(0, 2), text: "five" }]), "invalid-grid-values");
  refuses(editor, "the other number format", () => chart.setChartCells(editor, C, [{ ...body(0, 2), text: "1,5" }]), "invalid-grid-values");
  refuses(editor, "a percent sign", () => chart.setChartCells(editor, C, [{ ...body(0, 2), text: "45%" }]), "invalid-grid-values");
  try {
    chart.setChartCells(editor, C, [{ ...body(0, 1), text: "1" }, { ...body(1, 1), text: "x" }, { ...body(2, 1), text: "y" }]);
    assert.fail("should refuse");
  } catch (error) {
    assert.equal(error.issues.length, 2, "every problem is listed");
    assert.deepEqual([error.issues[0].section, error.issues[0].row, error.issues[0].column], ["body", 1, 1]);
    assert.match(error.message, /Row 2, column B/);
    assert.match(error.message, /1 more/);
  }
  assert.equal(dataOf(editor).rows[0][1], null, "the valid cell of a refused batch is not applied either");
  // Unchanged text is a no-op, even over data the chart cannot read.
  assert.equal(chart.setChartCells(editor, C, [{ ...body(2, 1), text: "24" }]).changed, false);
  assert.equal(editor.snapshot().undoDepth, 2);
  // Names and categories are text.
  chart.setChartCells(editor, C, [{ ...header(1), text: "Sales" }, { ...body(0, 0), text: "2024" }]);
  assert.equal(dataOf(editor).columns[1], "Sales");
  assert.equal(dataOf(editor).rows[0][0], "2024", "a category typed as digits stays text");
  chart.setChartCells(editor, C, [{ ...body(2, 0), text: "" }]);
  assert.equal(dataOf(editor).rows[2][0], null, "a cleared category is blank");
  assert.deepEqual(grid.describeDataGrid(editor.presentation, C).warnings.map((warning) => warning.message), ["Row 3, column A: This row has no category label."]);
  // Typed values.
  chart.setChartCells(editor, C, [{ ...body(0, 2), value: 7 }]);
  assert.equal(dataOf(editor).rows[0][2], 7);
  refuses(editor, "an object value", () => chart.setChartCells(editor, C, [{ ...body(0, 2), value: { a: 1 } }]), "invalid-grid-values");
  refuses(editor, "NaN", () => chart.setChartCells(editor, C, [{ ...body(0, 2), value: Number.NaN }]), "invalid-grid-values");
  refuses(editor, "a cell that does not exist", () => chart.setChartCells(editor, C, [{ ...body(9, 1), text: "1" }]), "invalid-grid-values");
  refuses(editor, "no edits", () => chart.setChartCells(editor, C, []), "invalid-grid-value");
  // Rename series and categories.
  step(editor, "rename a series", () => chart.renameChartSeries(editor, C, 2, "Spend"), () => assert.equal(dataOf(editor).columns[2], "Spend"));
  step(editor, "rename a category", () => chart.renameChartCategory(editor, C, 1, "Second quarter"), () => assert.equal(dataOf(editor).rows[1][0], "Second quarter"));
  assert.throws(() => chart.renameChartSeries(editor, C, 0, "x"), TypeError);
}
{
  // Wrong kind and unusable paths.
  const editor = session();
  assert.throws(() => chart.setChartCells(editor, T, [{ ...body(0, 0), text: "x" }]), (error) => error.code === "grid-wrong-kind");
  assert.throws(() => tables.setTableCells(editor, C, [{ ...body(0, 0), text: "x" }]), (error) => error.code === "grid-wrong-kind");
  assert.throws(() => chart.setChartCells(editor, "slides.0.title", [{ ...body(0, 0), text: "x" }]), (error) => error.code === "grid-target-not-found");
  assert.throws(() => chart.setChartCells({}, C, []), (error) => error.code === "invalid-editor");
}

// --- chart rows and columns -------------------------------------------------------------------------

{
  const editor = session();
  step(editor, "insert a chart row", () => chart.insertChartRows(editor, C, 1), () => assert.deepEqual(dataOf(editor).rows[1], [null, null, null]));
  step(editor, "append chart rows", () => chart.insertChartRows(editor, C, 3, 2), () => assert.equal(dataOf(editor).rows.length, 5));
  step(editor, "delete a chart row", () => chart.deleteChartRows(editor, C, [1]), () => assert.deepEqual(dataOf(editor).rows.map((row) => row[0]), ["Q1", "Q3"]));
  step(editor, "delete chart rows", () => chart.deleteChartRows(editor, C, [0, 2]), () => assert.deepEqual(dataOf(editor).rows.map((row) => row[0]), ["Q2"]));
  step(editor, "move a chart row", () => chart.moveChartRows(editor, C, 0, 2), () => assert.deepEqual(dataOf(editor).rows.map((row) => row[0]), ["Q2", "Q3", "Q1"]));
  step(editor, "move chart rows as a block", () => chart.moveChartRows(editor, C, 1, 0, 2), () => assert.deepEqual(dataOf(editor).rows.map((row) => row[0]), ["Q2", "Q3", "Q1"]));
  step(editor, "insert a series", () => chart.insertChartColumns(editor, C, 2), () => {
    assert.deepEqual(dataOf(editor).columns, ["Quarter", "Revenue", "", "Costs"], "a new series is unnamed, not invented");
    assert.deepEqual(dataOf(editor).rows[0], ["Q1", 12, null, 5], "its values are gaps");
  });
  step(editor, "delete a series", () => chart.deleteChartColumns(editor, C, [1]), () => assert.deepEqual(dataOf(editor).columns, ["Quarter", "Costs"]));
  step(editor, "move a series", () => chart.moveChartColumns(editor, C, 1, 2), () => {
    assert.deepEqual(dataOf(editor).columns, ["Quarter", "Costs", "Revenue"]);
    assert.deepEqual(dataOf(editor).rows[0], ["Q1", 5, 12]);
  });
  refuses(editor, "deleting every row", () => chart.deleteChartRows(editor, C, [0, 1, 2]), "grid-last-row");
  refuses(editor, "deleting every column", () => chart.deleteChartColumns(editor, C, [0, 1, 2]), "grid-last-column");
  refuses(editor, "a row out of range", () => chart.deleteChartRows(editor, C, [3]), "grid-row-out-of-range");
  refuses(editor, "inserting beyond the end", () => chart.insertChartRows(editor, C, 9), "grid-row-out-of-range");
  refuses(editor, "moving off the end", () => chart.moveChartRows(editor, C, 2, 3), "grid-row-out-of-range");
  refuses(editor, "a column out of range", () => chart.moveChartColumns(editor, C, 0, 5), "grid-column-out-of-range");
  refuses(editor, "inserting nothing", () => chart.insertChartRows(editor, C, 0, 0), "invalid-count");
  assert.equal(chart.moveChartRows(editor, C, 1, 1).changed, false, "moving a row onto itself is a no-op");
  // The chart still draws after every operation.
  assert.ok(svg(editor.presentation).includes("<svg"));
}

// --- chart transpose ---------------------------------------------------------------------------------

{
  const editor = session();
  const change = step(editor, "transpose a chart", () => chart.transposeChart(editor, C), () => {
    assert.deepEqual(dataOf(editor).columns, ["Quarter", "Q1", "Q2", "Q3"]);
    assert.deepEqual(dataOf(editor).rows, [["Revenue", 12, 18, 24], ["Costs", 5, null, 9]], "gaps stay gaps");
  });
  assert.equal(change.relabelled, 0);
  chart.transposeChart(editor, C);
  chart.transposeChart(editor, C);
  assert.deepEqual(dataOf(editor), deck().slides[0].blocks[0].chart.data, "transposing twice is the identity for text categories");
  // Numeric categories become text, and the change says so.
  const numeric = session();
  chart.setChartCells(numeric, C, [{ ...body(0, 0), value: 2020 }, { ...body(1, 0), value: null }]);
  const result = chart.transposeChart(numeric, C);
  assert.equal(result.relabelled, 1);
  assert.deepEqual(dataOf(numeric).columns, ["Quarter", "2020", "", "Q3"]);
  const single = session();
  single.set(`${C}.data`, { columns: ["Value"], rows: [[1], [2]] });
  assert.throws(() => chart.transposeChart(single, C), (error) => error.code === "chart-transpose-empty");
  assert.throws(() => tables.setTableHeader(editor, C, false), (error) => error.code === "grid-wrong-kind");
}

// --- sorting ------------------------------------------------------------------------------------------

{
  const presentation = deck();
  presentation.slides[0].blocks[1].table = {
    columns: ["Item", "Qty", "Due"],
    rows: [["Item 10", "10", "2026-03-01"], ["item 2", 2, "2026-01-15"], ["Item 1", "1,000", ""], ["", 7, "2025-12-31"], ["Item 2", "n/a", "2026-02-01"], ["Item 2b", 2, "2026-01-15"]],
  };
  const editor = session(presentation);
  // Numbers (number strings in the number format too) sort as numbers, then text; empty last either way.
  tables.sortTableRows(editor, T, 1);
  assert.deepEqual(rowsOf(editor).map((row) => row[1]), [2, 2, 7, "10", "1,000", "n/a"], "numeric order, then text; equal keys keep their order");
  assert.deepEqual(rowsOf(editor).map((row) => row[0]).slice(0, 2), ["item 2", "Item 2b"], "stable");
  editor.undo();
  tables.sortTableRows(editor, T, 1, { direction: "desc" });
  assert.deepEqual(rowsOf(editor).map((row) => row[1]), ["n/a", "1,000", "10", 7, 2, 2], "descending reverses the order of the types too");
  assert.deepEqual(rowsOf(editor).map((row) => row[0]).slice(4), ["item 2", "Item 2b"], "descending keeps equal keys in their original order");
  editor.undo();
  // Text sorts naturally and ignores case; the empty cell sorts last in both directions.
  tables.sortTableRows(editor, T, 0);
  assert.deepEqual(rowsOf(editor).map((row) => row[0]), ["Item 1", "item 2", "Item 2", "Item 2b", "Item 10", ""]);
  editor.undo();
  tables.sortTableRows(editor, T, 0, { direction: "desc" });
  assert.deepEqual(rowsOf(editor).map((row) => row[0]), ["Item 10", "Item 2b", "item 2", "Item 2", "Item 1", ""], "empty stays last when descending");
  assert.equal(rowsOf(editor).at(-1)[0], "");
  editor.undo();
  // ISO dates sort by time; a blank date is last.
  tables.sortTableRows(editor, T, 2);
  assert.deepEqual(rowsOf(editor).map((row) => row[2]), ["2025-12-31", "2026-01-15", "2026-01-15", "2026-02-01", "2026-03-01", ""]);
  editor.undo();
  // Forcing text compares "1,000" and "10" as text with numeric chunks.
  tables.sortTableRows(editor, T, 1, { type: "text" });
  assert.deepEqual(rowsOf(editor).map((row) => String(row[1])), ["1,000", "2", "2", "7", "10", "n/a"]);
  editor.undo();
  // Sorting a column that is already in order records nothing.
  tables.sortTableRows(editor, T, 0);
  const again = tables.sortTableRows(editor, T, 0);
  assert.equal(again.changed, false);
  assert.equal(editor.snapshot().undoDepth, 1);
  // The comma format reads "1,000" as one, not a thousand.
  const euro = session(presentation);
  tables.sortTableRows(euro, T, 1, { decimal: "," });
  assert.deepEqual(rowsOf(euro).map((row) => row[1]).slice(0, 3), ["1,000", 2, 2], "1,000 is 1.0 in the comma format");
  assert.throws(() => tables.sortTableRows(euro, T, 9), (error) => error.code === "grid-column-out-of-range");
  assert.throws(() => tables.sortTableRows(euro, T, 0, { direction: "up" }), (error) => error.code === "invalid-sort");
  assert.throws(() => tables.sortTableRows(euro, T, 0, { type: "money" }), (error) => error.code === "invalid-sort");
  // The same sort orders a chart's categories.
  const charted = session();
  step(charted, "sort a chart by a series", () => chart.sortChartRows(charted, C, 1, { direction: "desc" }), () => assert.deepEqual(dataOf(charted).rows.map((row) => row[0]), ["Q3", "Q2", "Q1"]));
  chart.sortChartRows(charted, C, 2);
  assert.deepEqual(dataOf(charted).rows.map((row) => row[2]), [5, 9, null], "a gap sorts last");
}

// --- table cells ----------------------------------------------------------------------------------------

{
  const editor = session();
  step(editor, "edit a table cell", () => tables.setTableCells(editor, T, [{ ...body(0, 1), text: "11" }]), () => assert.equal(rowsOf(editor)[0][1], 11, "a canonical number is stored as a number"));
  tables.setTableCells(editor, T, [{ ...body(0, 1), text: "011" }, { ...body(0, 2), text: "12,5" }, { ...body(1, 0), text: "" }]);
  assert.deepEqual(rowsOf(editor)[0].slice(1), ["011", "12,5"], "text that is not a canonical number stays text: the slide shows what was typed");
  assert.equal(rowsOf(editor)[1][0], "");
  assert.equal(tables.setTableCells(editor, T, [{ ...body(0, 1), text: "011" }]).changed, false);
  // The header row holds text.
  tables.setTableCells(editor, T, [{ ...header(1), text: "2025" }]);
  assert.equal(editor.get(`${T}.columns.1`), "2025", "a header label stays text");
  refuses(editor, "a header on a headerless table", () => tables.setTableCells(session({ ...deck(), slides: [{ id: "x", title: "x", blocks: [{ table: { rows: [["a"]] } }] }] }), "slides.0.blocks.0.table", [{ ...header(0), text: "z" }]), "invalid-grid-values");
  // Rich cells keep their formatting, styled cells keep their style and spans.
  const rich = session();
  rich.set(`${T}.rows.0.0`, ["Bold ", { text: "North", bold: true }]);
  tables.setTableCells(rich, T, [{ ...body(0, 0), text: "Bold South" }]);
  assert.deepEqual(rich.get(`${T}.rows.0.0`), ["Bold ", { text: "South", bold: true }], "the run's formatting stays");
  rich.set(`${T}.rows.1.1`, null);
  rich.set(`${T}.rows.1.0`, { value: "South", style: { fill: "accent" }, colSpan: 2 });
  tables.setTableCells(rich, T, [{ ...body(1, 0), text: "Southeast" }]);
  assert.deepEqual(rich.get(`${T}.rows.1.0`), { value: "Southeast", style: { fill: "accent" }, colSpan: 2 });
  refuses(rich, "a covered cell", () => tables.setTableCells(rich, T, [{ ...body(1, 1), text: "x" }]), "invalid-grid-values");
  assert.match(grid.gridCellIssues(rich.presentation, T, [{ ...body(1, 1), text: "x" }])[0].message, /covered by a merged cell/);
  assert.deepEqual(grid.gridCellIssues(rich.presentation, T, [{ ...body(0, 1), text: "x" }]), [], "the live check is clean for a good edit");
  assert.equal(grid.describeDataGrid(rich.presentation, T).lines[1][0].rich, true);
  // The grid shows what the slide draws.
  assert.equal(grid.describeDataGrid(deck(), T, { decimal: "," }).lines[1][1].text, "10");
  const decimals = deck();
  decimals.slides[0].blocks[1].table.rows[0][1] = 12.5;
  assert.equal(grid.describeDataGrid(decimals, T, { decimal: "," }).lines[1][1].text, "12.5", "a table cell shows its value as the slide draws it");
}

// --- table rows and columns, merged cells ------------------------------------------------------------

const withMerges = () => {
  const presentation = deck();
  // North/South merged down (rows 0-1, column 0); a 2 x 2 block at rows 2-3, columns 1-2.
  presentation.slides[0].blocks[1].table = {
    columns: [{ value: "Region", style: { color: "accent" } }, { value: "Q1 and Q2", colSpan: 2 }, null],
    rows: [
      [{ value: "North", rowSpan: 2 }, 1, 2],
      [null, 3, 4],
      ["East", { value: "block", rowSpan: 2, colSpan: 2 }, null],
      ["West", null, null],
      ["Total", 9, 10],
    ],
  };
  return presentation;
};
{
  const editor = session(withMerges());
  const merges = () => grid.describeDataGrid(editor.presentation, T).merges.map((merge) => `${merge.section}:${merge.row}:${merge.column}:${merge.rowSpan}x${merge.colSpan}`);
  assert.deepEqual(merges(), ["header:0:1:1x2", "body:0:0:2x1", "body:2:1:2x2"]);
  const model = grid.describeDataGrid(editor.presentation, T);
  assert.deepEqual([model.lines[2][0].covered, model.lines[2][0].owner], [true, { line: 1, column: 0 }]);
  assert.equal(model.lines[2][0].text, "", "a covered cell has no text of its own");

  // A row inserted inside a vertical merge grows it; at its edge it does not.
  step(editor, "insert a row inside a merge", () => tables.insertTableRows(editor, T, 1), () => {
    assert.deepEqual(rowsOf(editor)[0][0], { value: "North", rowSpan: 3 });
    assert.deepEqual(rowsOf(editor)[1], [null, "", ""], "the new row is empty and its cell in the merge is covered");
  });
  step(editor, "insert a row above a merge", () => tables.insertTableRows(editor, T, 0), () => {
    assert.deepEqual(rowsOf(editor)[1][0], { value: "North", rowSpan: 2 });
    assert.deepEqual(rowsOf(editor)[0], ["", "", ""]);
  });
  step(editor, "insert a row below a merge", () => tables.insertTableRows(editor, T, 2), () => assert.deepEqual(rowsOf(editor)[0][0], { value: "North", rowSpan: 2 }));
  step(editor, "insert a row inside a 2 x 2 merge", () => tables.insertTableRows(editor, T, 3), () => {
    assert.deepEqual(rowsOf(editor)[2][1], { value: "block", rowSpan: 3, colSpan: 2 });
    assert.deepEqual(rowsOf(editor)[3], ["", null, null]);
  });
  // Deleting rows shrinks the merge and keeps its text.
  step(editor, "delete the second row of a merge", () => tables.deleteTableRows(editor, T, [1]), () => assert.deepEqual(rowsOf(editor)[0], ["North", 1, 2], "the merge shrank to one row and collapsed"));
  step(editor, "delete the first row of a merge", () => tables.deleteTableRows(editor, T, [0]), () => {
    assert.deepEqual(rowsOf(editor)[0], ["North", 3, 4], "the merged cell keeps its text and moves to the next row");
  });
  step(editor, "delete both rows of a merge", () => tables.deleteTableRows(editor, T, [0, 1]), () => assert.equal(rowsOf(editor)[0][0], "East"));
  step(editor, "delete the first row of a 2 x 2 merge", () => tables.deleteTableRows(editor, T, [2]), () => {
    assert.deepEqual(rowsOf(editor)[2], ["West", { value: "block", colSpan: 2 }, null], "the 2 x 2 merge keeps its column span");
  });
  step(editor, "delete a merge's last row", () => tables.deleteTableRows(editor, T, [3]), () => assert.deepEqual(rowsOf(editor)[2], ["East", { value: "block", colSpan: 2 }, null]));
  refuses(editor, "deleting every row", () => tables.deleteTableRows(editor, T, [0, 1, 2, 3, 4]), "grid-last-row");

  // Moving: a whole block moves, a merge is never split.
  refuses(editor, "moving a row of a vertical merge away from its partner", () => tables.moveTableRows(editor, T, 0, 3), "table-merge-conflict");
  step(editor, "move both rows of a merge together", () => tables.moveTableRows(editor, T, 0, 2, 2), () => {
    assert.deepEqual(rowsOf(editor)[2][0], { value: "North", rowSpan: 2 });
    assert.equal(rowsOf(editor)[0][0], "East");
  });
  step(editor, "move a row past a whole merge", () => tables.moveTableRows(editor, T, 4, 0), () => assert.equal(rowsOf(editor)[0][0], "Total"));
  refuses(editor, "moving a row into the middle of a merge", () => tables.moveTableRows(editor, T, 4, 1), "table-merge-conflict");
  assert.match((() => { try { tables.moveTableRows(editor, T, 4, 1); } catch (error) { return error.message; } return ""; })(), /Split the merged cells first/);

  // Columns.
  step(editor, "insert a column inside a column merge", () => tables.insertTableColumns(editor, T, 2), () => {
    assert.equal(editor.get(`${T}.columns.1`).colSpan, 3, "the merge grew");
    assert.equal(editor.get(`${T}.columns`).length, 4);
    assert.deepEqual(rowsOf(editor)[2].slice(1), [{ value: "block", rowSpan: 2, colSpan: 3 }, null, null], "the 2 x 2 merge grew too");
  });
  step(editor, "insert a column before a merge", () => tables.insertTableColumns(editor, T, 1), () => {
    assert.equal(editor.get(`${T}.columns.2`).colSpan, 2, "the merge moved right and stayed 2 wide");
    assert.equal(editor.get(`${T}.columns.1`), "", "the new header cell is empty");
  });
  step(editor, "delete a column of a merge", () => tables.deleteTableColumns(editor, T, [2]), () => {
    assert.equal(editor.get(`${T}.columns.1`), "Q1 and Q2", "the header merge shrank to one column and collapsed");
    assert.deepEqual(rowsOf(editor)[2][1], { value: "block", rowSpan: 2 }, "a 2 x 2 merge keeps its rows");
  });
  step(editor, "delete the first column of a merge", () => tables.deleteTableColumns(editor, T, [1]), () => {
    assert.equal(editor.get(`${T}.columns.1`), "Q1 and Q2", "the merged header cell keeps its text and moves right");
  });
  refuses(editor, "deleting every column", () => tables.deleteTableColumns(editor, T, [0, 1, 2]), "grid-last-column");
  refuses(editor, "moving a column out of a column merge", () => tables.moveTableColumns(editor, T, 1, 0), "table-merge-conflict");
  step(editor, "move a column", () => tables.moveTableColumns(editor, T, 0, 2), () => assert.equal(editor.get(`${T}.columns.2`).value, "Region"));
  // The table still validates, previews and exports after everything above.
  assert.equal(validate(editor.presentation, { only: ["format"] }).valid, true);
  assert.ok(svg(editor.presentation).includes("<svg"));
}
{
  // A merge that holds the whole of a moved block moves with it; a column move keeps a column merge whole.
  const editor = session(withMerges());
  step(editor, "move columns that hold a whole merge", () => tables.moveTableColumns(editor, T, 1, 0, 2), () => {
    assert.deepEqual(editor.get(`${T}.columns`).map((cell) => (cell === null ? null : (cell.value ?? cell))), ["Q1 and Q2", null, "Region"]);
    assert.equal(editor.get(`${T}.columns.0.colSpan`), 2);
  });
}

// Sorting rows joined by a vertical merge moves them as a block, in their own order.
{
  const editor = session(withMerges());
  editor.set(`${T}.rows.4`, ["Aardvark", 99, 100]);
  step(editor, "sort a table with merged rows", () => tables.sortTableRows(editor, T, 0), () => {
    assert.deepEqual(rowsOf(editor).map((row) => (row[0] === null ? null : (row[0].value ?? row[0]))), ["Aardvark", "East", "West", "North", null], "the North/South block stays together and the 2 x 2 block's rows stay together");
  });
}

// A merged header keeps its span when the header row is turned off, and a column merge in the sort column sorts by the merged cell's text.
{
  const editor = session(withMerges());
  step(editor, "turn off a header with a merged cell", () => tables.setTableHeader(editor, T, false), () => {
    assert.equal(editor.get(`${T}.columns`), undefined);
    assert.deepEqual(rowsOf(editor)[0][1], { value: "Q1 and Q2", colSpan: 2 }, "the header's column merge is a body merge now");
    assert.equal(grid.describeDataGrid(editor.presentation, T).hasHeader, false);
    assert.equal(grid.describeDataGrid(editor.presentation, T).rowCount, 6);
  });
  const presentation = deck();
  presentation.slides[0].blocks[1].table = {
    columns: ["Name", "Score", "Note"],
    rows: [["c", { value: "30", colSpan: 2 }, null], ["a", 5, "x"], ["b", { value: "12", colSpan: 2 }, null]],
  };
  const sorted = session(presentation);
  tables.sortTableRows(sorted, T, 2, { decimal: "." });
  assert.deepEqual(rowsOf(sorted).map((row) => row[0]), ["b", "c", "a"], "a covered cell in the sort column sorts as the merged cell's text: 12 and 30 are numbers and come before the text x");
}

// Insert and delete keep a table style this package wrote; custom styles are copied from the neighbour.
{
  const editor = session();
  tables.setTableStyle(editor, T, "banded");
  tables.insertTableRows(editor, T, 1);
  assert.equal(tables.readTableStyle(editor.presentation, T).preset, "banded", "the banded style is still intact after an insert");
  tables.deleteTableRows(editor, T, [0]);
  assert.equal(tables.readTableStyle(editor.presentation, T).preset, "banded");
  tables.sortTableRows(editor, T, 1, { direction: "desc" });
  assert.equal(tables.readTableStyle(editor.presentation, T).preset, "banded", "and after a sort");
  const custom = session();
  custom.set(`${T}.rows.0.1`, { value: 10, style: { align: "right", fill: "#ffeecc" } });
  tables.insertTableRows(custom, T, 1);
  assert.deepEqual(custom.get(`${T}.rows.1.1`), { value: "", style: { align: "right", fill: "#ffeecc" } }, "a new cell takes the style of the row above it");
  tables.insertTableColumns(custom, T, 2);
  assert.deepEqual(custom.get(`${T}.rows.0.2`), { value: "", style: { align: "right", fill: "#ffeecc" } }, "and of the column to its left");
}

// --- the header row -------------------------------------------------------------------------------------

{
  const editor = session();
  step(editor, "turn the header row off", () => tables.setTableHeader(editor, T, false), () => {
    assert.equal(editor.get(`${T}.columns`), undefined);
    assert.deepEqual(rowsOf(editor)[0], ["Region", "Q1", "Q2"], "the old header is the first row");
    assert.equal(rowsOf(editor).length, 5);
  });
  tables.setTableHeader(editor, T, false);
  step(editor, "turn the header row on from the first row", () => tables.setTableHeader(editor, T, true), (change) => {
    assert.deepEqual(editor.get(`${T}.columns`), ["Region", "Q1", "Q2"]);
    assert.equal(change.use, "first-row");
  });
  tables.setTableHeader(editor, T, true);
  assert.deepEqual(editor.presentation, deck(), "off and on again is the identity");
  assert.equal(tables.setTableHeader(editor, T, true).changed, false, "already on");
  tables.setTableHeader(editor, T, false);
  tables.setTableCells(editor, T, [{ ...body(0, 1), value: 5 }, { ...body(0, 2), value: true }]);
  tables.setTableHeader(editor, T, true);
  assert.deepEqual(editor.get(`${T}.columns`), ["Region", "5", "true"], "header labels are text, so numbers and yes/no become text");
  const added = session();
  tables.setTableHeader(added, T, false);
  step(added, "add an empty header row", () => tables.setTableHeader(added, T, true, { use: "new" }), () => {
    assert.deepEqual(added.get(`${T}.columns`), ["", "", ""]);
    assert.equal(rowsOf(added).length, 5, "the body keeps every row");
  });
  // A first row with a row-spanning merge cannot become a header.
  const merged = session(withMerges());
  tables.setTableHeader(merged, T, false);
  tables.deleteTableRows(merged, T, [0]);
  assert.throws(() => tables.setTableHeader(merged, T, true), (error) => error.code === "table-header-merge");
  tables.setTableHeader(merged, T, true, { use: "new" });
  assert.equal(merged.get(`${T}.columns`).length, 3);
  // A single row becomes the header only by adding one.
  const one = session({ ...deck(), slides: [{ id: "x", title: "x", blocks: [{ table: { rows: [["only", "row"]] } }] }] });
  assert.throws(() => tables.setTableHeader(one, "slides.0.blocks.0.table", true, { use: "first-row" }), (error) => error.code === "table-header-needs-rows");
  const added2 = tables.setTableHeader(one, "slides.0.blocks.0.table", true);
  assert.equal(added2.use, "new", "with one row the default adds an empty header instead");
  assert.deepEqual(one.get("slides.0.blocks.0.table"), { columns: ["", ""], rows: [["only", "row"]] });
  const headerless = { ...deck(), slides: [{ id: "x", title: "x", blocks: [{ table: { rows: [["a", "b"]] } }] }] };
  assert.throws(() => grid.gridRangeText(headerless, "slides.0.blocks.0.table", { from: header(0), to: body(0, 0) }), (error) => error.code === "grid-cell-not-found");
  assert.throws(() => tables.setTableHeader(session(headerless), "slides.0.blocks.0.table", true, { use: "elsewhere" }), (error) => error.code === "invalid-header-source");
  // A header toggle keeps a recognised style current.
  const styled = session();
  tables.setTableStyle(styled, T, "banded");
  tables.setTableHeader(styled, T, false);
  assert.equal(tables.readTableStyle(styled.presentation, T).preset, "banded");
}

// --- paste ------------------------------------------------------------------------------------------------

{
  const editor = session();
  // Excel puts tab-separated text on the clipboard: rows end in line breaks, a cell with a line break is quoted.
  const change = step(editor, "paste into a chart", () => chart.pasteChartText(editor, C, body(1, 1), "20\t6\n30\t7\n"), () => {
    assert.deepEqual(dataOf(editor).rows, [["Q1", 12, 5], ["Q2", 20, 6], ["Q3", 30, 7]]);
  });
  assert.equal(change.cells, 4);
  // The grid grows to take the block; new rows and columns are named by what was pasted.
  step(editor, "paste past the end of a chart", () => chart.pasteChartText(editor, C, body(2, 0), "Q3b\t31\t8\t1\nQ4\t40\t10\t2"), () => {
    assert.equal(dataOf(editor).rows.length, 4);
    assert.deepEqual(dataOf(editor).columns, ["Quarter", "Revenue", "Costs", ""], "a new column is unnamed");
    assert.deepEqual(dataOf(editor).rows[0], ["Q1", 12, 5, null], "its other cells are gaps");
    assert.deepEqual(dataOf(editor).rows[3], ["Q4", 40, 10, 2]);
  });
  // Pasting a header row names the series.
  chart.pasteChartText(editor, C, header(0), "Period\tSales\tSpend\nQ1\t1\t2");
  assert.deepEqual(dataOf(editor).columns.slice(0, 3), ["Period", "Sales", "Spend"]);
  assert.deepEqual(dataOf(editor).rows[0].slice(0, 3), ["Q1", 1, 2], "a paste that starts in the header continues into the body");
  // Empty pasted cells clear existing values to gaps; a ragged row leaves its missing cells alone.
  chart.setChartCells(editor, C, [{ ...body(1, 2), text: "6" }]);
  chart.pasteChartText(editor, C, body(0, 1), "\t\n9");
  assert.deepEqual(dataOf(editor).rows[0].slice(0, 3), ["Q1", null, null]);
  assert.equal(dataOf(editor).rows[1][1], 9);
  assert.equal(dataOf(editor).rows[1][2], 6, "the missing cell of a short row is left as it was");
  // Numbers pasted in the other format are read that way when the current one fails: no number is guessed.
  const eu = session();
  const read = chart.pasteChartText(eu, C, body(0, 1), "1,5\t2,5\n3,25\t4,75");
  assert.equal(read.decimal, ",", "the paste was read as decimal commas");
  assert.deepEqual(dataOf(eu).rows.slice(0, 2), [["Q1", 1.5, 2.5], ["Q2", 3.25, 4.75]]);
  const eu2 = session();
  assert.equal(chart.pasteChartText(eu2, C, body(0, 1), "1,5\t2,5", { decimal: "," }).decimal, ",");
  // A grouped number that reads the same in the current format is not switched.
  const grouped = session();
  assert.equal(chart.pasteChartText(grouped, C, body(0, 1), "1,234\t2,345").decimal, ".");
  assert.deepEqual(dataOf(grouped).rows[0], ["Q1", 1234, 2345]);
  // Mixed pastes that fit neither format are refused whole, every cell listed.
  refuses(editor, "a paste with text in a series", () => chart.pasteChartText(editor, C, body(0, 1), "1\tabc\n2\tdef"), "invalid-grid-values");
  try {
    chart.pasteChartText(editor, C, body(0, 1), "1\tabc\n2\tdef");
  } catch (error) {
    assert.equal(error.issues.length, 2);
    assert.deepEqual([error.issues[0].row, error.issues[0].column], [0, 2]);
  }
  // CSV text and quoted line breaks.
  const csv = session();
  tables.pasteTableText(csv, T, body(0, 0), 'a,b\n"x\ny","say ""hi"""\n');
  assert.deepEqual(rowsOf(csv).slice(0, 2), [["a", "b", 2], ["x\ny", 'say "hi"', 4]]);
  tables.pasteTableText(csv, T, body(0, 0), "a;b\n1;2", { delimiter: ";" });
  assert.deepEqual(rowsOf(csv)[1].slice(0, 2), [1, 2], "canonical numbers pasted into a table become numbers");
  refuses(csv, "pasting nothing", () => tables.pasteTableText(csv, T, body(0, 0), ""), "invalid-grid-value");
  refuses(csv, "pasting an unclosed quote", () => tables.pasteTableText(csv, T, body(0, 0), '"oops\tx'), "unclosed-quote");
  // A table grows to take the paste and keeps its style.
  tables.setTableStyle(csv, T, "banded");
  tables.pasteTableText(csv, T, body(3, 1), "p\tq\tr\ns\tt\tu");
  assert.equal(rowsOf(csv).length, 5);
  assert.deepEqual(csv.get(`${T}.columns`).length, 4, "a table column is added when the paste is wider");
  assert.equal(tables.readTableStyle(csv.presentation, T).preset, "banded");
  // Pasting over merged cells: onto the merge's own cell is fine, across its covered positions is refused, never hiding text.
  const merged = session(withMerges());
  refuses(merged, "pasting across covered cells", () => tables.pasteTableText(merged, T, body(0, 0), "a\nb"), "invalid-grid-values");
  assert.match((() => { try { tables.pasteTableText(merged, T, body(0, 0), "a\nb"); } catch (error) { return error.message; } return ""; })(), /covered by a merged cell/);
  tables.pasteTableText(merged, T, body(0, 0), "North pole");
  assert.deepEqual(rowsOf(merged)[0][0], { value: "North pole", rowSpan: 2 }, "the merged cell keeps its span");
  // A header paste where the table has no header.
  const noHeader = session({ ...deck(), slides: [{ id: "x", title: "x", blocks: [{ table: { rows: [["a", "b"]] } }] }] });
  refuses(noHeader, "pasting into a header that is not there", () => tables.pasteTableText(noHeader, "slides.0.blocks.0.table", header(0), "x"), undefined);
  // The paste is also a plain rows array.
  const arrays = session();
  chart.pasteChartText(arrays, C, body(0, 1), [["1", "2"], ["3"]]);
  assert.deepEqual(dataOf(arrays).rows.slice(0, 2), [["Q1", 1, 2], ["Q2", 3, null]]);
}

// --- copy -----------------------------------------------------------------------------------------------------

{
  const presentation = deck();
  assert.equal(grid.gridRangeText(presentation, C), "Quarter\tRevenue\tCosts\nQ1\t12\t5\nQ2\t18\t\nQ3\t24\t9", "a gap copies as an empty cell");
  assert.equal(grid.gridRangeText(presentation, C, { from: body(0, 1), to: body(1, 2) }), "12\t5\n18\t");
  assert.equal(grid.gridRangeText(presentation, C, { from: body(1, 2), to: body(0, 1) }), "12\t5\n18\t", "a range may run backwards");
  assert.equal(grid.gridRangeText(presentation, C, undefined, { delimiter: ";" }), "Quarter;Revenue;Costs\nQ1;12;5\nQ2;18;\nQ3;24;9");
  const decimals = deck();
  decimals.slides[0].blocks[0].chart.data.rows[0][1] = 12.5;
  assert.ok(grid.gridRangeText(decimals, C, { from: body(0, 1), to: body(0, 1) }, { decimal: "," }) === "12,5", "numbers copy in the grid's number format");
  assert.deepEqual(text.parseDelimited(grid.gridRangeText(presentation, C)).rows[2], ["Q2", "18", ""], "what is copied reads back cell for cell");
  const merged = withMerges();
  assert.equal(grid.gridRangeText(merged, T).split("\n")[1], "North\t1\t2", "a merged cell copies as its text and empty covered cells");
  assert.equal(grid.gridRangeText(merged, T).split("\n")[2], "\t3\t4");
  assert.throws(() => grid.gridRangeText(presentation, C, { from: body(0, 0), to: body(9, 0) }), (error) => error.code === "grid-cell-not-found");
}

// --- a patch is the smallest guarded change; large ones are one guarded replacement --------------------------

{
  const patches = grid.gridPatches(["a", "b"], { x: [1, 2, 3], y: "same" }, { x: [1, 5, 3], y: "same" });
  assert.deepEqual(patches, [{ op: "test", path: "/a/b/x/1", value: 2 }, { op: "replace", path: "/a/b/x/1", value: 5 }]);
  assert.deepEqual(grid.gridPatches(["a"], { x: 1 }, { x: 1 }), []);
  assert.deepEqual(grid.gridPatches(["a"], [1, 2], [1, 2, 3]).map((patch) => patch.op), ["test", "replace"], "a different length replaces the array");
  const many = Array.from({ length: 100 }, (_, index) => index);
  const changed = many.map((value) => value + 1);
  const whole = grid.gridPatches(["v"], many, changed);
  assert.deepEqual(whole.map((patch) => patch.op), ["test", "replace"], "more than 48 changes become one guarded replacement");
  assert.deepEqual(grid.gridPatches(["v"], { a: 1 }, { a: 1, b: 2 }).map((patch) => patch.op), ["test", "replace"], "an added key is one guarded replacement, so Undo keeps the key order");
  assert.deepEqual(grid.gridPatches(["v"], { a: 1, b: 2 }, { a: 1 }).map((patch) => patch.op), ["test", "replace"]);
  // Keys with a slash or tilde are escaped.
  assert.equal(grid.gridPatches(["a/b"], { "c~d": 1 }, { "c~d": 2 })[0].path, "/a~1b/c~0d");
}

// --- the preview and PowerPoint follow every operation ---------------------------------------------------------

{
  const editor = session();
  const seen = new Set();
  const sig = () => svg(editor.presentation);
  seen.add(sig());
  chart.setChartCells(editor, C, [{ ...body(0, 1), text: "40" }]);
  seen.add(sig());
  chart.insertChartColumns(editor, C, 3);
  chart.setChartCells(editor, C, [{ ...header(3), text: "Margin" }, { ...body(0, 3), text: "3" }]);
  seen.add(sig());
  chart.transposeChart(editor, C);
  seen.add(sig());
  assert.equal(seen.size, 4, "each change redraws the chart");
  const events = [];
  editor.subscribe((event) => events.push(event.type));
  chart.setChartCells(editor, C, [{ ...body(0, 1), text: "1" }]);
  editor.undo();
  editor.redo();
  assert.deepEqual(events, ["patch", "undo", "redo"], "the session announces every change, undo and redo, so a host redraws");
  const out = session(withMerges());
  tables.insertTableRows(out, T, 1);
  tables.sortTableRows(out, T, 0, { direction: "desc" });
  const bytes = await pptx.toPptx(structuredClone(out.presentation), { strictAssets: true, catalogs: [defaultCatalog] });
  const back = await pptx.fromPptx(bytes);
  assert.ok(JSON.stringify(back.presentation ?? back).includes("rowSpan"), "a table after row operations exports with its merges");
  const chartBytes = await pptx.toPptx(structuredClone(editor.presentation), { strictAssets: true, catalogs: [defaultCatalog] });
  assert.ok(chartBytes.byteLength > 1000, "a chart after grid edits exports");
}

console.log("data grid model tests passed");
