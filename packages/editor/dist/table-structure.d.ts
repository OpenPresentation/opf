import type { EditorSession } from "./index.js";
import type { GridAddress, GridCellEdit, GridChange, GridOptions, GridSortOptions, PreparedGridChange } from "./grid-model.js";

/** Set cell text (or typed values) in a table. Rich cells keep their runs' formatting and styled cells their style and spans. One patch; every problem is in `error.issues`. */
export declare function prepareTableCells(presentation: unknown, tablePath: string, edits: GridCellEdit[], options?: GridOptions): PreparedGridChange;
export declare function setTableCells(editor: EditorSession, tablePath: string, edits: GridCellEdit[], options?: GridOptions): GridChange;
/** Paste TSV/CSV text or rows at a cell, growing the table as needed. Covered (merged) positions refuse the paste. One patch. */
export declare function prepareTablePaste(presentation: unknown, tablePath: string, anchor: GridAddress, source: string | string[][], options?: GridOptions): PreparedGridChange;
export declare function pasteTableText(editor: EditorSession, tablePath: string, anchor: GridAddress, source: string | string[][], options?: GridOptions): GridChange;
/** Insert `count` rows so the first is body row `at`. A merged cell spanning that position grows. */
export declare function prepareTableInsertRows(presentation: unknown, tablePath: string, at: number, count?: number, options?: GridOptions): PreparedGridChange;
export declare function insertTableRows(editor: EditorSession, tablePath: string, at: number, count?: number, options?: GridOptions): GridChange;
/** Delete body rows. A merged cell spanning a deleted row shrinks and keeps its text. The last row cannot be deleted. */
export declare function prepareTableDeleteRows(presentation: unknown, tablePath: string, indices: number[], options?: GridOptions): PreparedGridChange;
export declare function deleteTableRows(editor: EditorSession, tablePath: string, indices: number[], options?: GridOptions): GridChange;
/** Move `count` rows from `from` so the first is at `to`. Refused when it would split a merged cell. */
export declare function prepareTableMoveRows(presentation: unknown, tablePath: string, from: number, to: number, count?: number, options?: GridOptions): PreparedGridChange;
export declare function moveTableRows(editor: EditorSession, tablePath: string, from: number, to: number, count?: number, options?: GridOptions): GridChange;
export declare function prepareTableInsertColumns(presentation: unknown, tablePath: string, at: number, count?: number, options?: GridOptions): PreparedGridChange;
export declare function insertTableColumns(editor: EditorSession, tablePath: string, at: number, count?: number, options?: GridOptions): GridChange;
export declare function prepareTableDeleteColumns(presentation: unknown, tablePath: string, indices: number[], options?: GridOptions): PreparedGridChange;
export declare function deleteTableColumns(editor: EditorSession, tablePath: string, indices: number[], options?: GridOptions): GridChange;
export declare function prepareTableMoveColumns(presentation: unknown, tablePath: string, from: number, to: number, count?: number, options?: GridOptions): PreparedGridChange;
export declare function moveTableColumns(editor: EditorSession, tablePath: string, from: number, to: number, count?: number, options?: GridOptions): GridChange;
/** Sort the body rows by a column, stably and by type (numbers, ISO dates, text; empty cells last). Rows joined by a row-spanning merge move as a block. */
export declare function prepareTableSort(presentation: unknown, tablePath: string, column: number, options?: GridSortOptions): PreparedGridChange;
export declare function sortTableRows(editor: EditorSession, tablePath: string, column: number, options?: GridSortOptions): GridChange;
/** Turn the header row on (the first row becomes the header, or `{ use: "new" }` adds an empty one) or off. */
export declare function prepareTableHeader(presentation: unknown, tablePath: string, enabled: boolean, options?: { use?: "first-row" | "new" }): PreparedGridChange;
export declare function setTableHeader(editor: EditorSession, tablePath: string, enabled: boolean, options?: { use?: "first-row" | "new"; meta?: Record<string, unknown> }): GridChange;
