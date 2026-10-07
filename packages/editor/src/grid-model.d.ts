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
  /** The id of the shared dataset the edit changes, when the chart or table shows one (RR-54). */
  dataset?: string;
  document: unknown;
  patches: JsonPatchOperation[];
  changed: boolean;
  [key: string]: unknown;
}
export interface GridChange extends Omit<EditorChange, "document" | "patches"> {
  action: string;
  kind: "chart" | "table";
  path: string;
  /** The id of the shared dataset the edit changed, when the chart or table shows one. */
  dataset?: string;
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
  /** A number as the slide draws it (the column's format, or a table cell's own), when a valid format changes how it reads. `text` stays the raw value: editing and copying use it. */
  display?: string;
  rich: boolean;
  runs?: unknown[];
  rowSpan: number;
  colSpan: number;
  /** Covered by a merged cell: not a cell of its own. */
  covered: boolean;
  owner?: { line: number; column: number };
  style?: Record<string, unknown>;
  /** The number format of a header cell (a DataColumn `format`, or a styled header's `format`). */
  format?: string;
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
  /** For a chart: "category", "series", for scatter "label" and "x", and "other" for a column a `mapping` leaves out. Empty for a table. */
  columnRoles: string[];
  /** The number format of each column (from its header), or undefined. */
  columnFormats: Array<string | undefined>;
  /** The header texts (DataColumn names included), when the grid has a header line. */
  columnNames?: string[];
  /** Set when the chart or table shows a shared dataset: its id, `fields` and the paths of every item that uses it. */
  dataset?: { id: string; fields?: string[]; items: string[] };
  /** The chart's own `mapping`, when it has one. */
  mapping?: ChartMappingColumns;
  lines: GridCell[][];
  warnings: Array<GridAddress & { message: string }>;
  merges: Array<GridAddress & { rowSpan: number; colSpan: number }>;
}
export interface DataGridTarget {
  kind: "chart" | "table";
  path: string;
  /** false for a chart whose data comes from a source, or from a dataset the document lacks. */
  editable?: false;
  reason?: string;
  /** Set when the chart or table shows a shared dataset (RR-54): the grid edits the dataset. `count` items use it. */
  dataset?: { id: string; fields?: string[]; count: number; items: string[] };
}
/** A chart's `mapping`: the category, X and series columns by name. */
export interface ChartMappingColumns {
  category?: string;
  x?: string;
  series?: string[];
}
export interface ChartMappingDescription {
  path: string;
  /** True for a chart with an X axis (scatter). */
  xy: boolean;
  columns: Array<{ name: string; format?: string; role: "category" | "label" | "x" | "series" | "other" }>;
  /** The label column's name (the mapping's, or the first column). */
  category: string;
  /** The X column's name, for an XY chart. */
  x?: string;
  /** The plotted columns, in order. */
  series: string[];
  /** The chart's own `mapping`, when it has one. */
  authored?: ChartMappingColumns;
}

/** Spreadsheet column letters: 0 is A, 26 is AA. */
export declare function columnLabel(index: number): string;
/** "Header, column B" or "Row 3, column A". */
export declare function describeAddress(address: GridAddress): string;
/** What each chart column is for. With a `mapping` and the column `names` it addresses, the roles follow it ("other" is a column nothing plots). */
export declare function chartColumnRoles(columnCount: number, chartType?: string, mapping?: ChartMappingColumns, names?: string[]): string[];
/** The text a cell shows. */
export declare function cellText(raw: unknown, kind: "chart" | "table", decimal?: "." | ","): string;
/**
 * Find the data a path points at (`…chart`, `…chart.data`, `…table`). Throws `grid-target-not-found`, `table-not-found` or
 * `dataset-unavailable`. For a chart or table that shows a shared dataset, `data` is the dataset, `dataParts` is `["datasets", id]` and `dataset`
 * says which columns `fields` selects (`indices`, into the dataset's own columns) and where the reference is (`refParts`).
 */
export declare function locateGridData(document: unknown, path: string | string[]): {
  kind: "chart" | "table";
  parts: string[];
  dataParts: string[];
  data: Record<string, unknown>;
  chartType?: string;
  owner: Record<string, unknown>;
  dataset?: { id: string; fields?: string[]; indices: number[]; refParts: string[]; ref: Record<string, unknown> };
};
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
/** Why `format` is not a valid number format ("#,##0", "0.0%", "$#,##0.00"), or undefined when it is valid or empty (empty clears the format). */
export declare function columnFormatError(format: unknown): string | undefined;
/** Whether the installed core has the RR-54 chart and table data contract (number formats, datasets, strict chart numbers). An older core edits documents that use none of it. */
export declare const supportsChartTableData: boolean;
/**
 * Set or clear (`null` or "") the number format of column `column` (its header cell). A string header becomes `{ name, format }` and returns to a string
 * when the format is cleared. Throws `number-format-invalid` with the reason, or `grid-no-header` for a table without a header row.
 */
export declare function prepareGridColumnFormat(document: unknown, path: string, column: number, format: string | null | undefined, options?: GridOptions): PreparedGridChange;
/** The columns a chart plots and how they got that role (the chart's `mapping`, or core's positional default). */
export declare function describeChartMapping(document: unknown, path: string): ChartMappingDescription;
/**
 * Set a chart's category, X and series columns by name; what `wanted` leaves out keeps its current value. A field that equals the default is not
 * written, and `chart.mapping` is removed when nothing is left. One patch. Throws `chart-mapping-unknown-column`, `chart-mapping-x-unsupported`,
 * `chart-mapping-conflict` or `chart-mapping-no-series`.
 */
export declare function prepareChartMapping(document: unknown, path: string, wanted?: ChartMappingColumns): PreparedGridChange;
/** Replace the chart's or table's dataset reference with its own inline copy of the data. The dataset stays for the other items. One patch. */
export declare function prepareDetachDataset(document: unknown, path: string): PreparedGridChange;
/** The charts and tables that use dataset `id`, in document order. */
export declare function datasetUsage(document: unknown, id: string): Array<{ kind: "chart" | "table"; path: string; parts: string[] }>;

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
/** Set (or clear, with `null` or "") a column's number format as one undoable transaction. Throws `number-format-invalid` with the reason. */
export declare function setGridColumnFormat(editor: EditorSession, path: string, column: number, format: string | null | undefined, options?: GridOptions): GridChange;
/** Set a chart's category, X and series columns as one undoable transaction. */
export declare function setChartMapping(editor: EditorSession, path: string, wanted: ChartMappingColumns, options?: GridOptions): GridChange;
/** Give a chart or table its own copy of a shared dataset's data, as one undoable transaction. */
export declare function detachGridDataset(editor: EditorSession, path: string, options?: { meta?: Record<string, unknown> }): GridChange;
