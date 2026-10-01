// Table structure (RR-24): insert, delete, move and sort rows and columns, turn the header row on and off, and set cell text
// or paste spreadsheet text, each as one validated, undoable patch. These are the table-shaped forms of the data grid's operations
// (grid-model.js); merged cells stay whole (a merge that spans an inserted row grows, a deleted row shrinks it, a move that would
// split one is refused with the reason), and a table style this package wrote (banding, header fill, borders) is kept
// correct. A table cell is a plain value, rich runs or a styled cell; editing keeps runs' formatting and a cell's style and spans.
// Rows are addressed from 0 in the body; the header row is addressed as `{ section: "header", column }`.
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
  prepareSetHeader,
  setGridHeader,
} from "./grid-model.js";
export function prepareTableCells(document, tablePath, edits, options = {}) {
  return prepareGridCells(document, tablePath, edits, { ...options, kind: "table" });
}
export function setTableCells(editor, tablePath, edits, options = {}) {
  return setGridCells(editor, tablePath, edits, { ...options, kind: "table" });
}
export function prepareTablePaste(document, tablePath, anchor, source, options = {}) {
  return preparePaste(document, tablePath, anchor, source, { ...options, kind: "table" });
}
export function pasteTableText(editor, tablePath, anchor, source, options = {}) {
  return pasteGridText(editor, tablePath, anchor, source, { ...options, kind: "table" });
}
export function prepareTableInsertRows(document, tablePath, at, count = 1, options = {}) {
  return prepareInsertRows(document, tablePath, at, count, { ...options, kind: "table" });
}
export function insertTableRows(editor, tablePath, at, count = 1, options = {}) {
  return insertGridRows(editor, tablePath, at, count, { ...options, kind: "table" });
}
export function prepareTableDeleteRows(document, tablePath, indices, options = {}) {
  return prepareDeleteRows(document, tablePath, indices, { ...options, kind: "table" });
}
export function deleteTableRows(editor, tablePath, indices, options = {}) {
  return deleteGridRows(editor, tablePath, indices, { ...options, kind: "table" });
}
export function prepareTableMoveRows(document, tablePath, from, to, count = 1, options = {}) {
  return prepareMoveRows(document, tablePath, from, to, count, { ...options, kind: "table" });
}
export function moveTableRows(editor, tablePath, from, to, count = 1, options = {}) {
  return moveGridRows(editor, tablePath, from, to, count, { ...options, kind: "table" });
}
export function prepareTableInsertColumns(document, tablePath, at, count = 1, options = {}) {
  return prepareInsertColumns(document, tablePath, at, count, { ...options, kind: "table" });
}
export function insertTableColumns(editor, tablePath, at, count = 1, options = {}) {
  return insertGridColumns(editor, tablePath, at, count, { ...options, kind: "table" });
}
export function prepareTableDeleteColumns(document, tablePath, indices, options = {}) {
  return prepareDeleteColumns(document, tablePath, indices, { ...options, kind: "table" });
}
export function deleteTableColumns(editor, tablePath, indices, options = {}) {
  return deleteGridColumns(editor, tablePath, indices, { ...options, kind: "table" });
}
export function prepareTableMoveColumns(document, tablePath, from, to, count = 1, options = {}) {
  return prepareMoveColumns(document, tablePath, from, to, count, { ...options, kind: "table" });
}
export function moveTableColumns(editor, tablePath, from, to, count = 1, options = {}) {
  return moveGridColumns(editor, tablePath, from, to, count, { ...options, kind: "table" });
}
export function prepareTableSort(document, tablePath, column, options = {}) {
  return prepareSortRows(document, tablePath, column, { ...options, kind: "table" });
}
export function sortTableRows(editor, tablePath, column, options = {}) {
  return sortGridRows(editor, tablePath, column, { ...options, kind: "table" });
}

/** Turn the header row on or off. On uses the first row as the header, or adds an empty one with `{ use: "new" }`. See {@link prepareSetHeader}. */
export function prepareTableHeader(document, tablePath, enabled, options = {}) {
  return prepareSetHeader(document, tablePath, enabled, options);
}
export function setTableHeader(editor, tablePath, enabled, options = {}) {
  return setGridHeader(editor, tablePath, enabled, options);
}
