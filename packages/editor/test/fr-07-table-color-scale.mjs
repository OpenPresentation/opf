// FR-07: the table color scale in the editor. The columns, the kind, the scheme colors and the range edit as one validated, undoable patch;
// only number columns are offered and only scheme colors are accepted; the preview re-shades and a row id stays through the edit.
import assert from "node:assert/strict";
import { toSvg } from "@openpresentation/opf-render/svg";
import { createEditorSession } from "../dist/index.js";
import { parseTablePath, prepareTableColorScale, readTableColorScale, scaledCell, setTableColorScale, TABLE_SCALE_COLORS } from "../dist/table-color-scale.js";

const T = "slides.0.table";
const deck = (table = {}) => ({
  name: "Color scale fixture",
  design: { theme: "minimal", fontScheme: "aptos" },
  slides: [{ id: "scores", title: "Scores", table: { columns: ["Region", "Q1", "Q2", "Note"], rows: [{ id: "r-1", cells: ["EMEA", 10, 20, "a"] }, ["APAC", 30, { value: 40, style: { fill: "#FF00FF" } }, "b"]], ...table } }],
});
const session = (table) => createEditorSession(deck(table), { rejectInvalid: true });
const fills = (document) => Object.fromEntries([...toSvg(document, 1, { trace: true }).matchAll(/<rect [^>]*data-opf-path="(slides[.]0[.]table[.]rows[.][^"]*)"[^>]*fill="([^"]*)"/g)].map(([, path, fill]) => [path.replace("slides.0.table.rows.", "").replace(".cells", ""), fill]));

assert.equal(parseTablePath("slides.0.table.rows.1.2"), T);
assert.equal(parseTablePath("slides.0.title"), undefined);

// The state: only columns that hold a number are offered.
{
  const state = readTableColorScale(deck().slides[0].table);
  assert.equal(state.kind, "none");
  assert.deepEqual(state.columns.map((column) => [column.name, column.numeric, column.shaded]), [["Region", false, false], ["Q1", true, false], ["Q2", true, false], ["Note", false, false]]);
  assert.deepEqual([state.from, state.to], ["surface", "primary"]);
}

// Add a scale, change it, remove it: one undo step each.
{
  const editor = session();
  const before = fills(editor.presentation);
  const added = setTableColorScale(editor, T, { columns: ["Q1", "Q2"] });
  assert.equal(added.changed, true);
  assert.deepEqual(editor.presentation.slides[0].table.colorScale, { columns: ["Q1", "Q2"] });
  assert.equal(editor.presentation.slides[0].table.rows[0].id, "r-1", "the row id stays");
  const after = fills(editor.presentation);
  assert.notEqual(after["1.1"], before["1.1"], "the preview re-shades");
  assert.equal(after["1.2"], "#FF00FF", "a cell with its own fill keeps it");
  assert.equal(scaledCell(editor.presentation.slides[0].table, editor.presentation, 0, 1), true);
  assert.equal(scaledCell(editor.presentation.slides[0].table, editor.presentation, 1, 2), false, "a cell fill of its own: not shaded by the scale");
  assert.equal(scaledCell(editor.presentation.slides[0].table, editor.presentation, 0, 3), false, "a column the scale does not name");

  setTableColorScale(editor, T, { kind: "diverging", colors: ["accent2", "surface", "accent1"], center: 15 });
  assert.deepEqual(editor.presentation.slides[0].table.colorScale, { columns: ["Q1", "Q2"], colors: ["accent2", "surface", "accent1"], center: 15 });
  setTableColorScale(editor, T, { min: 0, max: 50 });
  assert.deepEqual(editor.presentation.slides[0].table.colorScale.min, 0);
  setTableColorScale(editor, T, { kind: "sequential" });
  assert.deepEqual(editor.presentation.slides[0].table.colorScale.colors, ["accent2", "accent1"], "sequential drops the middle color");
  assert.equal(editor.presentation.slides[0].table.colorScale.center, undefined, "center goes with the middle color");
  setTableColorScale(editor, T, { colors: ["surface", "primary"] });
  assert.equal(editor.presentation.slides[0].table.colorScale.colors, undefined, "the default is not written");
  // Removing the last column removes the scale.
  setTableColorScale(editor, T, { columns: ["Q1"] });
  setTableColorScale(editor, T, { columns: [] });
  assert.equal(editor.presentation.slides[0].table.colorScale, undefined);
  while (editor.snapshot().undoDepth) editor.undo();
  assert.equal(editor.presentation.slides[0].table.colorScale, undefined, "undo restores the table");
  assert.deepEqual(fills(editor.presentation), before);
  editor.redo();
  assert.deepEqual(editor.presentation.slides[0].table.colorScale, { columns: ["Q1", "Q2"] });
}

// Only number columns and scheme colors are accepted.
{
  const document = deck().slides ? deck() : undefined;
  assert.throws(() => prepareTableColorScale(document, T, { columns: ["Note"] }), /not a column that holds numbers/);
  assert.throws(() => prepareTableColorScale(document, T, { columns: ["Q1"], colors: ["#FF0000", "primary"] }), /scheme/);
  assert.throws(() => prepareTableColorScale(document, T, { columns: ["Q1"], colors: ["surface", "hyperlink"] }), /scheme/);
  assert.throws(() => prepareTableColorScale(document, T, { columns: ["Q1"], min: Number.NaN }), /number/);
  assert.throws(() => prepareTableColorScale(document, T, { columns: ["Q1"], colors: ["surface"] }), /two colors/);
  assert.equal(TABLE_SCALE_COLORS.includes("hyperlink"), false);
  assert.equal(prepareTableColorScale(document, T, null).changed, false, "removing a scale that is not there changes nothing");
}

// A dataset-backed table offers the dataset's columns after `fields`.
{
  const document = { name: "D", datasets: { sales: { columns: ["Region", "Q1", "Q2"], rows: [["EMEA", 1, 2]] } }, slides: [{ title: "T", table: { dataset: "sales", fields: ["Region", "Q2"] } }] };
  assert.deepEqual(readTableColorScale(document.slides[0].table, document).columns.map((column) => column.name), ["Region", "Q2"]);
  const editor = createEditorSession(document, { rejectInvalid: true });
  setTableColorScale(editor, T, { columns: ["Q2"] });
  assert.deepEqual(editor.presentation.slides[0].table.colorScale, { columns: ["Q2"] });
  assert.throws(() => prepareTableColorScale(editor.presentation, T, { columns: ["Q1"] }), /not a column that holds numbers/, "Q1 is left out by fields");
}

console.log("Table color scale (editor): columns, kind, scheme colors and the range edit as one undoable patch; number columns and scheme names only.");
