// FR-05: the editor sets, clears and keeps the type, role and unit of a chart's or a shared dataset's column, each edit as one undoable patch.
import assert from "node:assert/strict";
import { validate } from "@openpresentation/opf";
import { createEditorSession } from "../dist/index.js";
import * as grid from "../dist/data-grid.js";

const deck = () => ({
  name: "Typed columns",
  datasets: { revenue: { columns: ["Month", { name: "Revenue", format: "$#,##0", type: "number", role: "measure", unit: "USD" }, "Notes"], rows: [["2026-09", 1, "a"], ["2026-10", "two", "b"]] } },
  slides: [{ id: "s", title: "S", blocks: [
    { chart: { type: "column", data: { dataset: "revenue", fields: ["Month", "Revenue"] } } },
    { chart: { type: "column", data: { columns: ["Month", "Margin"], rows: [["2026-09", 0.3]] } } },
    { table: { columns: ["Region", "Share"], rows: [["EMEA", 1]] } },
  ] }],
});
const D = "slides.0.blocks.0.chart", I = "slides.0.blocks.1.chart", T = "slides.0.blocks.2.table";
const session = () => createEditorSession(deck(), { rejectInvalid: true });

{
  const editor = session();
  // Set a type and role on a plain string column of a shared dataset: one undoable patch, the column becomes an object.
  const before = editor.presentation;
  const change = grid.setGridColumnDeclaration(editor, D, 0, { type: "date", role: "dimension" });
  assert.equal(change.changed, true);
  assert.deepEqual(editor.get("datasets.revenue.columns.0"), { name: "Month", type: "date", role: "dimension" });
  assert.equal(validate(editor.presentation, { only: ["format"] }).valid, true);
  editor.undo();
  assert.deepEqual(editor.presentation, before);
  editor.redo();
  // The summary says what each column declares.
  const summary = grid.describeDataGrid(editor.presentation, D);
  assert.equal(summary.declarable, true);
  assert.deepEqual(summary.columnDeclarations, [{ type: "date", role: "dimension" }, { type: "number", role: "measure", unit: "USD" }]);
  // Clearing every key returns a string column; a column that has a format stays an object.
  grid.setGridColumnDeclaration(editor, D, 0, { type: null, role: "" });
  assert.equal(editor.get("datasets.revenue.columns.0"), "Month");
  grid.setGridColumnDeclaration(editor, D, 1, { type: null, role: null, unit: null });
  assert.deepEqual(editor.get("datasets.revenue.columns.1"), { name: "Revenue", format: "$#,##0" });
}

{
  // The declarations survive a rename, a move, and the insert and delete of another column.
  const editor = session();
  grid.setGridCells(editor, D, [{ section: "header", column: 1, text: "Sales" }]);
  assert.deepEqual(editor.get("datasets.revenue.columns.1"), { name: "Sales", format: "$#,##0", type: "number", role: "measure", unit: "USD" });
  grid.moveGridColumns(editor, D, 1, 0);
  assert.equal(editor.get("datasets.revenue.columns").find((column) => column.name === "Sales").type, "number");
  grid.insertGridColumns(editor, I, 2);
  grid.deleteGridColumns(editor, I, [2]);
  assert.equal(editor.get("datasets.revenue.columns").find((column) => column.name === "Sales").unit, "USD");
}

{
  // Inline chart data declares too; the cells of another kind are marked on the grid.
  const editor = session();
  grid.setGridColumnDeclaration(editor, I, 1, { type: "text", unit: "ratio" });
  assert.deepEqual(editor.get(`${I}.data.columns.1`), { name: "Margin", type: "text", unit: "ratio" });
  const summary = grid.describeDataGrid(editor.presentation, I);
  assert.ok(summary.warnings.some((warning) => /typed text/.test(warning.message)), JSON.stringify(summary.warnings));
  const dataset = grid.describeDataGrid(editor.presentation, D);
  assert.ok(dataset.warnings.some((warning) => /typed number/.test(warning.message)), "the dataset's \"two\" is marked in a number column");
}

{
  // Refusals: an invalid value, an inline table (its headings are DataColumns) and a column out of range.
  const editor = session();
  const depth = editor.snapshot().undoDepth;
  for (const [path, column, declaration, code] of [[D, 0, { type: "currency" }, "column-declaration-invalid"], [D, 0, { role: "temporal" }, "column-declaration-invalid"], [D, 0, { size: 1 }, "column-declaration-invalid"], [T, 0, { type: "text" }, "column-declaration-unavailable"], [D, 9, { type: "text" }, "grid-column-out-of-range"]]) {
    assert.throws(() => grid.setGridColumnDeclaration(editor, path, column, declaration), (error) => error.code === code, `${path} ${JSON.stringify(declaration)}`);
  }
  assert.equal(editor.snapshot().undoDepth, depth);
  assert.equal(grid.describeDataGrid(editor.presentation, T).declarable, false);
}

{
  // A paste that adds columns declares them from their cells; a column that existed keeps what it declares.
  const editor = session();
  grid.pasteGridText(editor, I, { section: "body", row: 0, column: 1 }, "0.3\t1\t2");
  const columns = editor.get(`${I}.data.columns`);
  assert.equal(columns[1], "Margin", "the existing column keeps its declaration (none)");
  assert.deepEqual(columns.slice(2).map((column) => [column.type, column.role]), [["number", "measure"], ["number", "measure"]]);
}

console.log("FR-05 editor column declarations: ok");
