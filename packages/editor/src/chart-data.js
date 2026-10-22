// Chart data (RR-24): edit the inline data of a chart, `{ type, data: { columns, rows } }`. The first column holds the categories
// and every further column is a series named by its column label (a scatter chart with three or more columns reads x values from the
// second). Cells are text for names and categories and numbers for values; a gap is null and stays a gap, never 0. Each operation is
// one validated, undoable patch (grid-model.js has the implementation; grid-text.js documents number reading).
//
// `prepare*` computes `{ presentation, patches, changed }` without touching a session; the session forms apply it as one undo step.
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
export function prepareChartCells(presentation, chartPath, edits, options = {}) {
  return prepareGridCells(presentation, chartPath, edits, { ...options, kind: "chart" });
}
export function setChartCells(editor, chartPath, edits, options = {}) {
  return setGridCells(editor, chartPath, edits, { ...options, kind: "chart" });
}
export function prepareChartPaste(presentation, chartPath, anchor, source, options = {}) {
  return preparePaste(presentation, chartPath, anchor, source, { ...options, kind: "chart" });
}
export function pasteChartText(editor, chartPath, anchor, source, options = {}) {
  return pasteGridText(editor, chartPath, anchor, source, { ...options, kind: "chart" });
}
export function prepareChartInsertRows(presentation, chartPath, at, count = 1, options = {}) {
  return prepareInsertRows(presentation, chartPath, at, count, { ...options, kind: "chart" });
}
export function insertChartRows(editor, chartPath, at, count = 1, options = {}) {
  return insertGridRows(editor, chartPath, at, count, { ...options, kind: "chart" });
}
export function prepareChartDeleteRows(presentation, chartPath, indices, options = {}) {
  return prepareDeleteRows(presentation, chartPath, indices, { ...options, kind: "chart" });
}
export function deleteChartRows(editor, chartPath, indices, options = {}) {
  return deleteGridRows(editor, chartPath, indices, { ...options, kind: "chart" });
}
export function prepareChartMoveRows(presentation, chartPath, from, to, count = 1, options = {}) {
  return prepareMoveRows(presentation, chartPath, from, to, count, { ...options, kind: "chart" });
}
export function moveChartRows(editor, chartPath, from, to, count = 1, options = {}) {
  return moveGridRows(editor, chartPath, from, to, count, { ...options, kind: "chart" });
}
export function prepareChartInsertColumns(presentation, chartPath, at, count = 1, options = {}) {
  return prepareInsertColumns(presentation, chartPath, at, count, { ...options, kind: "chart" });
}
export function insertChartColumns(editor, chartPath, at, count = 1, options = {}) {
  return insertGridColumns(editor, chartPath, at, count, { ...options, kind: "chart" });
}
export function prepareChartDeleteColumns(presentation, chartPath, indices, options = {}) {
  return prepareDeleteColumns(presentation, chartPath, indices, { ...options, kind: "chart" });
}
export function deleteChartColumns(editor, chartPath, indices, options = {}) {
  return deleteGridColumns(editor, chartPath, indices, { ...options, kind: "chart" });
}
export function prepareChartMoveColumns(presentation, chartPath, from, to, count = 1, options = {}) {
  return prepareMoveColumns(presentation, chartPath, from, to, count, { ...options, kind: "chart" });
}
export function moveChartColumns(editor, chartPath, from, to, count = 1, options = {}) {
  return moveGridColumns(editor, chartPath, from, to, count, { ...options, kind: "chart" });
}
export function prepareChartSort(presentation, chartPath, column, options = {}) {
  return prepareSortRows(presentation, chartPath, column, { ...options, kind: "chart" });
}
export function sortChartRows(editor, chartPath, column, options = {}) {
  return sortGridRows(editor, chartPath, column, { ...options, kind: "chart" });
}

/** Swap categories and series: the first column's values become the series names and each series becomes a row. See {@link prepareTranspose}. */
export function prepareChartTranspose(presentation, chartPath) {
  return prepareTranspose(presentation, chartPath);
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
export { describeChartMapping, prepareChartMapping, setChartMapping, prepareDetachDataset, detachGridDataset } from "./grid-model.js";
