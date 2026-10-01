import type { EditorChange, EditorSession, JsonPatchOperation } from "./index.js";
import type { GridDelimiter } from "./grid-text.js";

/** A cell of a chart's data or of a table: the header line is `{ section: "header", column }`; a body row is `{ section: "body", row, column }` (rows count from 0). */
export interface GridAddress {
  section: "header" | "body";
  /** Body row; ignored for the header section. */
  row?: number;
  column: number;
}
/** One cell edit: the new `text` (read by the cell's rules: a chart series cell is a number in the number format, blank is a gap) or a typed `value`. */
export type GridCellEdit = GridAddress & ({ text: string; value?: never } | { value: unknown; text?: never });
export interface GridOptions {
  /** "." or ",": how chart numbers are written and read (default "."). */
  decimal?: "." | ",";
  /** Alternative to `decimal`: "auto" (from `locale`), "." or ",". */
  numberFormat?: "auto" | "." | ",";
  locale?: string;
  /** Metadata recorded with the session event. */
  meta?: Record<string, unknown>;
  /** Refuse unless the path is this kind of content. */
  kind?: "chart" | "table";
  delimiter?: GridDelimiter;
}
export interface GridSortOptions extends GridOptions {
  direction?: "asc" | "desc";
  /** "auto" (numbers, then ISO dates, then text), "text", "number" or "date". */
  type?: "auto" | "text" | "number" | "date";
}
export interface PreparedGridChange {
  action: string;
  kind: "chart" | "table";
  /** The chart or table path. */
  path: string;
  document: unknown;
  patches: JsonPatchOperation[];
  changed: boolean;
  [key: string]: unknown;
}
export interface GridChange extends Omit<EditorChange, "document" | "patches"> {
  action: string;
  kind: "chart" | "table";
  path: string;
  document: unknown;
  patches: JsonPatchOperation[];
  changed: boolean;
  [key: string]: unknown;
}
export interface GridIssue extends GridAddress {
  message: string;
}
export interface GridCell {
  /** Index in `lines` (the header line first when the grid has one). */
  line: number;
  column: number;
  section: "header" | "body";
  row: number;
  /** What the cell shows. A table cell shows what the slide draws; a chart number shows in the number format. "" for a gap or a covered cell. */
  text: string;
  rich: boolean;
  runs?: unknown[];
  rowSpan: number;
  colSpan: number;
  /** Covered by a merged cell: not a cell of its own. */
  covered: boolean;
  owner?: { line: number; column: number };
  style?: Record<string, unknown>;
  warning?: string;
}
export interface DataGridDescription {
  kind: "chart" | "table";
  path: string;
  chartType?: string;
  hasHeader: boolean;
  /** Body rows. */
  rowCount: number;
  columnCount: number;
  /** For a chart: "category", "series", and for scatter "label" and "x". Empty for a table. */
  columnRoles: string[];
  lines: GridCell[][];
  warnings: Array<GridAddress & { message: string }>;
  merges: Array<GridAddress & { rowSpan: number; colSpan: number }>;
}
export interface DataGridTarget {
  kind: "chart" | "table";
  path: string;
  /** false for a chart whose data comes from a source. */
  editable?: false;
  reason?: string;
}

/** Spreadsheet column letters: 0 is A, 26 is AA. */
export declare function columnLabel(index: number): string;
/** "Header, column B" or "Row 3, column A". */
export declare function describeAddress(address: GridAddress): string;
/** What each chart column is for. */
export declare function chartColumnRoles(columnCount: number, chartType?: string): string[];
/** The text a cell shows. */
export declare function cellText(raw: unknown, kind: "chart" | "table", decimal?: "." | ","): string;
/** Find the data a path points at (`…chart`, `…chart.data`, `…table`). Throws `grid-target-not-found`, `table-not-found` or `chart-data-source`. */
export declare function locateGridData(document: unknown, path: string | string[]): { kind: "chart" | "table"; parts: string[]; dataParts: string[]; data: Record<string, unknown>; chartType?: string };
/** The chart or table a selection path belongs to, or undefined. */
export declare function resolveDataGridTarget(document: unknown, selectedPath: string): DataGridTarget | undefined;
/** The grid view of a chart or table: lines of cells with spans, covered positions, text, warnings. */
export declare function describeDataGrid(document: unknown, path: string, options?: GridOptions): DataGridDescription;
/** The smallest guarded patch from `before` to `after` at `parts`. */
export declare function gridPatches(parts: string[], before: unknown, after: unknown): JsonPatchOperation[];
/** The problems the edits would have, without applying them or validating the document. */
export declare function gridCellIssues(document: unknown, path: string, edits: GridCellEdit[], options?: GridOptions): GridIssue[];
/** The text of a range (`{ from, to }` addresses; the whole grid when omitted) as TSV, or another delimiter. */
export declare function gridRangeText(document: unknown, path: string, range?: { from: GridAddress; to: GridAddress }, options?: GridOptions): string;

export declare function prepareGridCells(document: unknown, path: string, edits: GridCellEdit[], options?: GridOptions): PreparedGridChange;
export declare function preparePaste(document: unknown, path: string, anchor: GridAddress, source: string | string[][], options?: GridOptions): PreparedGridChange;
export declare function prepareInsertRows(document: unknown, path: string, at: number, count?: number, options?: GridOptions): PreparedGridChange;
export declare function prepareDeleteRows(document: unknown, path: string, indices: number[], options?: GridOptions): PreparedGridChange;
export declare function prepareMoveRows(document: unknown, path: string, from: number, to: number, count?: number, options?: GridOptions): PreparedGridChange;
export declare function prepareInsertColumns(document: unknown, path: string, at: number, count?: number, options?: GridOptions): PreparedGridChange;
export declare function prepareDeleteColumns(document: unknown, path: string, indices: number[], options?: GridOptions): PreparedGridChange;
export declare function prepareMoveColumns(document: unknown, path: string, from: number, to: number, count?: number, options?: GridOptions): PreparedGridChange;
export declare function prepareSortRows(document: unknown, path: string, column: number, options?: GridSortOptions): PreparedGridChange;
export declare function prepareSetHeader(document: unknown, path: string, enabled: boolean, options?: { use?: "first-row" | "new" }): PreparedGridChange;
export declare function prepareTranspose(document: unknown, path: string): PreparedGridChange;

export declare function setGridCells(editor: EditorSession, path: string, edits: GridCellEdit[], options?: GridOptions): GridChange;
export declare function pasteGridText(editor: EditorSession, path: string, anchor: GridAddress, source: string | string[][], options?: GridOptions): GridChange;
export declare function insertGridRows(editor: EditorSession, path: string, at: number, count?: number, options?: GridOptions): GridChange;
export declare function deleteGridRows(editor: EditorSession, path: string, indices: number[], options?: GridOptions): GridChange;
export declare function moveGridRows(editor: EditorSession, path: string, from: number, to: number, count?: number, options?: GridOptions): GridChange;
export declare function insertGridColumns(editor: EditorSession, path: string, at: number, count?: number, options?: GridOptions): GridChange;
export declare function deleteGridColumns(editor: EditorSession, path: string, indices: number[], options?: GridOptions): GridChange;
export declare function moveGridColumns(editor: EditorSession, path: string, from: number, to: number, count?: number, options?: GridOptions): GridChange;
export declare function sortGridRows(editor: EditorSession, path: string, column: number, options?: GridSortOptions): GridChange;
export declare function setGridHeader(editor: EditorSession, path: string, enabled: boolean, options?: { use?: "first-row" | "new"; meta?: Record<string, unknown> }): GridChange;
export declare function transposeGridData(editor: EditorSession, path: string, options?: { meta?: Record<string, unknown> }): GridChange;
