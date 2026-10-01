// Chart data (RR-24): edit the inline data of a chart, `{ type, data: { columns, rows } }`. The first column holds the categories
// and every further column is a series named by its column label (a scatter chart with three or more columns reads x values from the
// second). Cells are text for names and categories and numbers for values; a gap is null and stays a gap, never 0. Each operation is
// one validated, undoable patch (grid-model.js has the implementation; grid-text.js documents number reading).
//
// `prepare*` computes `{ document, patches, changed }` without touching a session; the session forms apply it as one undo step.
import {
  prepareGridCells,
  preparePaste,
  prepareInsertRows,
  prepareDeleteRows,
  prepareMoveRows,
  prepareInsertColumns,
  prepareDeleteColumns,
  prepareMoveColumns,
  prepareSortRows,
  setGridCells,
  pasteGridText,
  insertGridRows,
  deleteGridRows,
  moveGridRows,
  insertGridColumns,
  deleteGridColumns,
  moveGridColumns,
  sortGridRows,
  prepareTranspose,
  transposeGridData,
} from "./grid-model.js";
export function prepareChartCells(document, chartPath, edits, options = {}) {
  return prepareGridCells(document, chartPath, edits, { ...options, kind: "chart" });
}
export function setChartCells(editor, chartPath, edits, options = {}) {
  return setGridCells(editor, chartPath, edits, { ...options, kind: "chart" });
}
export function prepareChartPaste(document, chartPath, anchor, source, options = {}) {
  return preparePaste(document, chartPath, anchor, source, { ...options, kind: "chart" });
}
export function pasteChartText(editor, chartPath, anchor, source, options = {}) {
  return pasteGridText(editor, chartPath, anchor, source, { ...options, kind: "chart" });
}
export function prepareChartInsertRows(document, chartPath, at, count = 1, options = {}) {
  return prepareInsertRows(document, chartPath, at, count, { ...options, kind: "chart" });
}
export function insertChartRows(editor, chartPath, at, count = 1, options = {}) {
  return insertGridRows(editor, chartPath, at, count, { ...options, kind: "chart" });
}
export function prepareChartDeleteRows(document, chartPath, indices, options = {}) {
  return prepareDeleteRows(document, chartPath, indices, { ...options, kind: "chart" });
}
export function deleteChartRows(editor, chartPath, indices, options = {}) {
  return deleteGridRows(editor, chartPath, indices, { ...options, kind: "chart" });
}
export function prepareChartMoveRows(document, chartPath, from, to, count = 1, options = {}) {
  return prepareMoveRows(document, chartPath, from, to, count, { ...options, kind: "chart" });
}
export function moveChartRows(editor, chartPath, from, to, count = 1, options = {}) {
  return moveGridRows(editor, chartPath, from, to, count, { ...options, kind: "chart" });
}
export function prepareChartInsertColumns(document, chartPath, at, count = 1, options = {}) {
  return prepareInsertColumns(document, chartPath, at, count, { ...options, kind: "chart" });
}
export function insertChartColumns(editor, chartPath, at, count = 1, options = {}) {
  return insertGridColumns(editor, chartPath, at, count, { ...options, kind: "chart" });
}
export function prepareChartDeleteColumns(document, chartPath, indices, options = {}) {
  return prepareDeleteColumns(document, chartPath, indices, { ...options, kind: "chart" });
}
export function deleteChartColumns(editor, chartPath, indices, options = {}) {
  return deleteGridColumns(editor, chartPath, indices, { ...options, kind: "chart" });
}
export function prepareChartMoveColumns(document, chartPath, from, to, count = 1, options = {}) {
  return prepareMoveColumns(document, chartPath, from, to, count, { ...options, kind: "chart" });
}
export function moveChartColumns(editor, chartPath, from, to, count = 1, options = {}) {
  return moveGridColumns(editor, chartPath, from, to, count, { ...options, kind: "chart" });
}
export function prepareChartSort(document, chartPath, column, options = {}) {
  return prepareSortRows(document, chartPath, column, { ...options, kind: "chart" });
}
export function sortChartRows(editor, chartPath, column, options = {}) {
  return sortGridRows(editor, chartPath, column, { ...options, kind: "chart" });
}

/** Swap categories and series: the first column's values become the series names and each series becomes a row. See {@link prepareTranspose}. */
export function prepareChartTranspose(document, chartPath) {
  return prepareTranspose(document, chartPath);
}
export function transposeChart(editor, chartPath, options = {}) {
  return transposeGridData(editor, chartPath, options);
}

/** Rename a series: the label of data column `column` (1 or more). */
export function renameChartSeries(editor, chartPath, column, name, options = {}) {
  if (!Number.isInteger(column) || column < 1) throw new TypeError("A series is a column after the first.");
  return setGridCells(editor, chartPath, [{ section: "header", column, value: String(name) }], { ...options, kind: "chart" });
}

/** Rename a category: the first-column label of body row `row`. An empty name leaves the category blank. */
export function renameChartCategory(editor, chartPath, row, name, options = {}) {
  return setGridCells(editor, chartPath, [{ section: "body", row, column: 0, value: name === "" || name === null ? null : String(name) }], { ...options, kind: "chart" });
}
