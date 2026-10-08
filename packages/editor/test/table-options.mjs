// RR-06: table style and cell merge. One validated patch each, one undo step, the preview
// draws the styled and merged table, text is never hidden by a merge, and the PPTX export carries
// merges and fills.
import assert from "node:assert/strict";
import { validate } from "@openpresentation/opf";
import { renderSlideSvg } from "@openpresentation/opf-render/svg";
import * as pptx from "@openpresentation/opf-pptx";
import { defaultCatalog } from "@openpresentation/opf/catalog";
import { createEditorSession } from "../dist/index.js";
import {
  TABLE_STYLE_PRESETS,
  describeTableCell,
  mergeTableCells,
  parseTableCellPath,
  prepareTableMerge,
  prepareTableStyle,
  readTableStyle,
  setTableCellStyle,
  setTableStyle,
  splitTableCell,
  tableMerges,
} from "../dist/table-options.js";

const T = "slides.0.blocks.0.table";
const deck = () => ({
  name: "Table options fixture",
  design: { theme: "minimal", fontScheme: "aptos" },
  slides: [
    {
      id: "table",
      title: "Table",
      blocks: [
        {
          table: {
            columns: ["Region", "Q1", "Q2", "Q3"],
            rows: [
              ["North", 12, 19, 27],
              ["South", "", "", 8],
              ["East", 4, 5, 6],
              ["West", 7, "", ""],
            ],
          },
        },
      ],
    },
  ],
});
// OPF 0.15: the themes the fixtures name resolve through the registered default catalog.
const catalogs = [defaultCatalog];
const session = (presentation = deck()) => createEditorSession(presentation, { rejectInvalid: true, catalogs });
const svg = (presentation) => renderSlideSvg(presentation, 0, { catalogs });
const body = (row, column) => ({ section: "body", row, column });
const header = (column) => ({ section: "header", column });

// Selection paths map to a table and a cell.
assert.deepEqual(parseTableCellPath("slides.0.blocks.0.table.rows.1.2.value"), { tablePath: "slides.0.blocks.0.table", cell: { section: "body", row: 1, column: 2 } });
assert.deepEqual(parseTableCellPath("slides.3.table.columns.1"), { tablePath: "slides.3.table", cell: { section: "header", row: 0, column: 1 } });
assert.equal(parseTableCellPath("slides.0.title"), undefined);
assert.equal(parseTableCellPath("slides.0.blocks.0.table"), undefined, "the table itself is not a cell");

// Merge: one patch, one undo step, covered positions null, and the preview changes.
{
  const editor = session();
  const before = editor.presentation;
  const beforeSvg = svg(before);
  const change = mergeTableCells(editor, T, body(1, 1), { colSpan: 2 });
  assert.equal(change.changed, true);
  assert.deepEqual(change.patches.map((patch) => patch.op), ["test", "replace"], "guarded by a test of the table");
  assert.deepEqual(editor.get(`${T}.rows.1`), ["South", { value: "", colSpan: 2 }, null, 8]);
  assert.equal(editor.snapshot().undoDepth, 1);
  assert.equal(validate(editor.presentation, { only: ["format"] }).valid, true);
  assert.notEqual(svg(editor.presentation), beforeSvg, "the preview draws the merge");
  assert.deepEqual(tableMerges(editor.get(T)), [{ section: "body", row: 1, column: 1, rowSpan: 1, colSpan: 2 }]);
  const state = describeTableCell(editor.get(T), body(1, 2));
  assert.deepEqual([state.covered, state.anchor, state.merged], [true, false, true]);
  assert.deepEqual(state.anchorCell, { section: "body", row: 1, column: 1 });
  const anchor = describeTableCell(editor.get(T), body(1, 1));
  assert.deepEqual([anchor.anchor, anchor.colSpan, anchor.rowSpan], [true, 2, 1]);
  // The merged table exports and its merge survives a round trip through PowerPoint.
  const bytes = await pptx.toPptx(structuredClone(editor.presentation), { strictAssets: true, catalogs });
  const back = await pptx.fromPptx(bytes);
  assert.ok(JSON.stringify(back.presentation ?? back).includes("colSpan"), "the exported merge reimports with a column span");
  editor.undo();
  assert.deepEqual(editor.presentation, before);
  assert.equal(svg(editor.presentation), beforeSvg);
  editor.redo();
  assert.equal(editor.get(`${T}.rows.1.1.colSpan`), 2);
}

// A 2 x 2 block merge, then a split that restores single cells.
{
  const editor = session();
  mergeTableCells(editor, T, body(1, 1), { colSpan: 2, rowSpan: 2 }, { join: true });
  assert.deepEqual(editor.get(`${T}.rows.1`), ["South", { value: "4 5", colSpan: 2, rowSpan: 2 }, null, 8], "text from the covered cells joins the anchor");
  assert.deepEqual(editor.get(`${T}.rows.2`), ["East", null, null, 6]);
}
{
  const editor = session();
  const before = editor.presentation;
  mergeTableCells(editor, T, body(1, 1), { colSpan: 2 });
  const split = splitTableCell(editor, T, body(1, 1));
  assert.equal(split.changed, true);
  assert.deepEqual(editor.get(`${T}.rows.1`), ["South", "", "", 8], "the cells are single and empty again");
  assert.equal(splitTableCell(editor, T, body(1, 1)).changed, false, "splitting a single cell is a no-op");
  assert.equal(editor.snapshot().undoDepth, 2);
  editor.undo();
  editor.undo();
  assert.deepEqual(editor.presentation, before);
}

// Merging never hides text: refused without `join`, joined with it (formatting kept).
{
  const editor = session();
  assert.throws(() => mergeTableCells(editor, T, body(0, 0), { colSpan: 2 }), (error) => error.code === "merge-would-lose-content");
  assert.equal(editor.snapshot().undoDepth, 0);
  mergeTableCells(editor, T, body(0, 0), { colSpan: 3 }, { join: true });
  assert.deepEqual(editor.get(`${T}.rows.0.0`), { value: "North 12 19", colSpan: 3 });
  assert.deepEqual(editor.get(`${T}.rows.0`).slice(1), [null, null, 27]);
  const rich = session();
  rich.set(`${T}.rows.0.0`, ["Bold ", { text: "North", bold: true }]);
  mergeTableCells(rich, T, body(0, 0), { colSpan: 2 }, { join: true });
  assert.deepEqual(rich.get(`${T}.rows.0.0.value`), ["Bold ", { text: "North", bold: true }, " ", "12"]);
}

// Refusals: overlap, out of range, header into the body, covered anchors.
{
  const editor = session();
  mergeTableCells(editor, T, body(1, 1), { colSpan: 2 });
  assert.throws(() => mergeTableCells(editor, T, body(0, 1), { colSpan: 2, rowSpan: 2 }), (error) => error.code === "merge-overlap");
  assert.throws(() => mergeTableCells(editor, T, body(1, 2), { colSpan: 1, rowSpan: 2 }), (error) => error.code === "merge-overlap", "a covered position cannot anchor a merge");
  assert.throws(() => mergeTableCells(editor, T, body(3, 3), { colSpan: 2 }), (error) => error.code === "invalid-table-span");
  assert.throws(() => mergeTableCells(editor, T, body(3, 0), { rowSpan: 2 }), (error) => error.code === "invalid-table-span");
  assert.throws(() => mergeTableCells(editor, T, header(0), { rowSpan: 2 }), (error) => error.code === "invalid-table-span");
  assert.throws(() => mergeTableCells(editor, T, body(0, 0), { colSpan: 0 }), (error) => error.code === "invalid-table-span");
  assert.throws(() => splitTableCell(editor, T, body(1, 2)), (error) => error.code === "table-cell-covered");
  assert.throws(() => mergeTableCells(editor, "slides.0.title", body(0, 0), { colSpan: 2 }), (error) => error.code === "table-not-found");
  assert.throws(() => mergeTableCells(editor, T, body(9, 0), { colSpan: 1 }), (error) => error.code === "table-cell-not-found");
  assert.equal(editor.snapshot().undoDepth, 1, "refused edits leave no history");
  // Re-merging an anchor first undoes its old merge, so a smaller span is valid.
  mergeTableCells(editor, T, body(1, 1), { colSpan: 3 }, { join: true });
  assert.deepEqual(editor.get(`${T}.rows.1`), ["South", { value: 8, colSpan: 3 }, null, null]);
  // A header merge works across the header and only there.
  const header_ = session();
  header_.set(`${T}.columns.2`, "");
  mergeTableCells(header_, T, header(1), { colSpan: 2 });
  assert.deepEqual(header_.get(`${T}.columns`), ["Region", { value: "Q1", colSpan: 2 }, null, "Q3"]);
}

// Table styles: presets set header fill, banding and borders; Theme removes them; values and merges stay.
{
  const editor = session();
  const before = editor.presentation;
  const beforeSvg = svg(before);
  assert.deepEqual(readTableStyle(before, T), { header: "theme", banding: false, borders: "theme", preset: "theme" });
  for (const preset of Object.keys(TABLE_STYLE_PRESETS).filter((id) => id !== "theme")) {
    const change = setTableStyle(editor, T, preset);
    assert.equal(change.changed, true, preset);
    assert.equal(readTableStyle(editor.presentation, T).preset, preset, `${preset} reads back`);
    assert.notEqual(svg(editor.presentation), beforeSvg, `${preset}: the preview draws the style`);
    assert.equal(validate(editor.presentation, { only: ["format"] }).valid, true);
    const bytes = await pptx.toPptx(structuredClone(editor.presentation), { strictAssets: true, catalogs });
    assert.ok(bytes.byteLength > 0, `${preset} exports`);
  }
  const banded = prepareTableStyle(before, T, "banded").presentation.slides[0].blocks[0].table;
  assert.equal(banded.columns[0], "Region", "the theme header is left alone");
  assert.equal(banded.rows[0][0], "North", "an even body row stays plain");
  assert.deepEqual(banded.rows[1][0], { value: "South", style: { fill: "surfaceAlt" } }, "an odd body row alternates");
  // The band is visible on a dark theme (minimal) and a light one (classic): alternate rows draw a different fill.
  for (const theme of ["minimal", "classic"]) {
    const themed = structuredClone(before);
    themed.design.theme = theme;
    const drawn = svg(prepareTableStyle(themed, T, "banded").presentation);
    const cells = [...drawn.matchAll(/<rect fill="(#[0-9A-Fa-f]{6})"[^>]*height="54"/g)].map((match) => match[1]);
    const bodyFills = cells.slice(themed.slides[0].blocks[0].table.columns.length); // drop the header row
    assert.ok(new Set(bodyFills).size >= 2, `${theme}: banded rows draw two different fills (${[...new Set(bodyFills)].join(", ")})`);
  }
  const minimal = prepareTableStyle(before, T, "minimal").presentation.slides[0].blocks[0].table;
  assert.deepEqual(minimal.columns[1], {
    value: "Q1",
    style: { fill: "surface", borders: { top: { color: "textSecondary", width: 1 }, right: { color: "textSecondary", width: 0 }, bottom: { color: "textSecondary", width: 1 }, left: { color: "textSecondary", width: 0 } } },
  }, "a plain header takes the body fill; horizontal rules zero the vertical edges");
  // An explicit object sets each axis; the three axes read back.
  const mixed = setTableStyle(editor, T, { header: "accent", banding: true, borders: "grid" });
  assert.equal(mixed.changed, true);
  assert.deepEqual(readTableStyle(editor.presentation, T), { header: "accent", banding: true, borders: "grid", preset: "custom" });
  assert.equal(editor.get(`${T}.columns.0.style.fill`), "accent");
  const theme = setTableStyle(editor, T, "theme");
  assert.equal(theme.changed, true);
  assert.deepEqual(editor.presentation, before, "Theme removes every style it added and returns plain values");
  assert.equal(setTableStyle(editor, T, "theme").changed, false);
  assert.equal(editor.snapshot().undoDepth, Object.keys(TABLE_STYLE_PRESETS).length - 1 + 2, "one step per style change");
  assert.throws(() => setTableStyle(editor, T, "fancy"), (error) => error.code === "invalid-table-style");
  assert.throws(() => setTableStyle(editor, T, { header: "huge" }), (error) => error.code === "invalid-table-style");
  assert.throws(() => setTableStyle(editor, T, { borders: "double" }), (error) => error.code === "invalid-table-style");
  // Hand-set fills read as custom.
  setTableCellStyle(editor, T, body(0, 0), { fill: "#FFEEEE" });
  assert.equal(readTableStyle(editor.presentation, T).preset, "custom");
  assert.equal(readTableStyle(editor.presentation, T).header, "custom");
}

// Styles keep merges, alignment and text color; only the fill and border fields belong to a table style.
{
  const editor = session();
  mergeTableCells(editor, T, body(1, 1), { colSpan: 2 });
  setTableCellStyle(editor, T, body(1, 1), { align: "center", color: "accent", fill: "accent" });
  setTableStyle(editor, T, "banded");
  assert.deepEqual(editor.get(`${T}.rows.1.1`), { value: "", colSpan: 2, style: { align: "center", color: "accent", fill: "surfaceAlt" } }, "a table style replaces the fill but keeps alignment, color and the merge");
  assert.equal(editor.get(`${T}.rows.1.2`), null, "covered positions stay null");
  setTableStyle(editor, T, "theme");
  assert.deepEqual(editor.get(`${T}.rows.1.1`), { value: "", colSpan: 2, style: { align: "center", color: "accent" } });
  assert.equal(readTableStyle(editor.presentation, T).preset, "theme");
}

// Single-cell style: merge fields, null removes a field, null style clears, covered cells are skipped.
{
  const editor = session();
  const change = setTableCellStyle(editor, T, [body(0, 0), header(1)], { fill: "#FFEEEE", align: "right" });
  assert.equal(change.skipped, 0);
  assert.deepEqual(editor.get(`${T}.rows.0.0`), { value: "North", style: { fill: "#FFEEEE", align: "right" } });
  assert.deepEqual(editor.get(`${T}.columns.1`), { value: "Q1", style: { fill: "#FFEEEE", align: "right" } });
  setTableCellStyle(editor, T, body(0, 0), { align: null });
  assert.deepEqual(editor.get(`${T}.rows.0.0`), { value: "North", style: { fill: "#FFEEEE" } });
  setTableCellStyle(editor, T, body(0, 0), null);
  assert.equal(editor.get(`${T}.rows.0.0`), "North", "clearing the style returns the plain value");
  mergeTableCells(editor, T, body(1, 1), { colSpan: 2 });
  assert.equal(setTableCellStyle(editor, T, [body(1, 1), body(1, 2)], { fill: "primary" }).skipped, 1, "a covered position cannot be styled");
  assert.throws(() => setTableCellStyle(editor, T, body(0, 0), "red"), (error) => error.code === "invalid-table-style");
  assert.throws(() => setTableCellStyle(editor, T, body(0, 0), { fill: "not-a-color" }), (error) => error.code === "invalid-opf-edit");
  assert.throws(() => setTableCellStyle(editor, T, [], { fill: "primary" }), (error) => error.code === "table-cell-not-found");
}

// prepareTableMerge is the same patch without a session and does not touch its input.
{
  const presentation = deck();
  const prepared = prepareTableMerge(presentation, T, body(1, 1), { colSpan: 2 });
  assert.deepEqual(presentation, deck());
  assert.deepEqual(prepared.presentation.slides[0].blocks[0].table.rows[1][1], { value: "", colSpan: 2 });
  const editor = session();
  assert.deepEqual(mergeTableCells(editor, T, body(1, 1), { colSpan: 2 }).patches, prepared.patches);
}

// A table on a slide with the table inline (no blocks) works the same.
{
  const presentation = { slides: [{ title: "Inline", table: { columns: ["A", "B"], rows: [["1", ""]] } }] };
  const editor = createEditorSession(presentation, { rejectInvalid: true });
  mergeTableCells(editor, "slides.0.table", body(0, 0), { colSpan: 2 }, { join: true });
  assert.deepEqual(editor.get("slides.0.table.rows.0"), [{ value: "1", colSpan: 2 }, null]);
  setTableStyle(editor, "slides.0.table", "minimal");
  assert.equal(readTableStyle(editor.presentation, "slides.0.table").preset, "minimal");
}

console.log("Table options: merge, join, split, refusals, 5 style presets plus per-axis styles and Theme reset, cell styles, preview and PPTX export/reimport, one undo step each.");
