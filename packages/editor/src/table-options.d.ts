import type { EditorChange, EditorSession, JsonPatchOperation } from "./index.js";

export interface TableCellAddress {
  section: "header" | "body";
  /** Body row; ignored for the header section. */
  row?: number;
  column: number;
}
export interface TableStyle {
  /** "theme": the renderer default (primary fill). "plain": the header looks like the body. "accent": accent fill. */
  header: "theme" | "plain" | "accent";
  /** Alternating body-row fill. */
  banding: boolean;
  /** "theme" keeps the default thin borders; "none" removes them; "horizontal" keeps row rules; "grid" draws every edge. */
  borders: "theme" | "none" | "horizontal" | "grid";
}
export declare const TABLE_STYLE_PRESETS: Readonly<Record<"theme" | "banded" | "grid" | "minimal" | "open", Readonly<TableStyle>>>;
export declare const TABLE_HEADER_STYLES: readonly ["theme", "plain", "accent"];
export declare const TABLE_BORDER_STYLES: readonly ["theme", "none", "horizontal", "grid"];
export interface TableMerge {
  section: "header" | "body";
  row: number;
  column: number;
  rowSpan: number;
  colSpan: number;
}
export interface TableCellState extends TableCellAddress {
  value: unknown;
  style: Record<string, unknown>;
  colSpan: number;
  rowSpan: number;
  merged: boolean;
  anchor: boolean;
  covered: boolean;
  anchorCell?: TableCellAddress;
  columns: number;
  rows: number;
}
export interface PreparedTableChange {
  action: "merge" | "split" | "style" | "table-style" | "table-alt";
  tablePath: string;
  presentation: unknown;
  patches: JsonPatchOperation[];
  changed: boolean;
  [key: string]: unknown;
}
export interface TableChange extends Omit<EditorChange, "presentation" | "patches"> {
  action: PreparedTableChange["action"];
  tablePath: string;
  presentation: unknown;
  patches: JsonPatchOperation[];
  changed: boolean;
  [key: string]: unknown;
}

/** The table path and cell a selection path points at, or undefined. */
export declare function parseTableCellPath(path: string): { tablePath: string; cell: Required<TableCellAddress> } | undefined;
/** Merge rectangles of the table. */
export declare function tableMerges(table: unknown): TableMerge[];
/** The state of one cell, including merge anchor/covered status. */
export declare function describeTableCell(table: unknown, cell: TableCellAddress): TableCellState;
/** Merge `span.colSpan` x `span.rowSpan` cells from `cell`. `join` keeps the text of covered cells by joining it into the anchor; without it, covered text refuses with `merge-would-lose-content`. */
export declare function prepareTableMerge(presentation: unknown, tablePath: string, cell: TableCellAddress, span: { colSpan?: number; rowSpan?: number }, options?: { join?: boolean }): PreparedTableChange;
export declare function prepareTableSplit(presentation: unknown, tablePath: string, cell: TableCellAddress): PreparedTableChange;
/** Merge style fields into the cells' styles (null removes a field, `style: null` clears). */
export declare function prepareTableCellStyle(presentation: unknown, tablePath: string, cells: TableCellAddress | TableCellAddress[], style: Record<string, unknown> | null): PreparedTableChange;
/** Apply `{ header, banding, borders }` (missing fields mean theme/false) or a named preset: sets the header fill, banded-row fill and borders of every cell and clears them elsewhere; `theme` removes a previous style. */
export declare function prepareTableStyle(presentation: unknown, tablePath: string, preset: keyof typeof TABLE_STYLE_PRESETS | Partial<TableStyle>): PreparedTableChange;
/** The current style per axis, or "custom" in every field when the fills and borders are not one this module writes. */
export declare function readTableStyle(presentation: unknown, tablePath: string): (TableStyle | { header: "custom"; banding: "custom"; borders: "custom" }) & { preset: keyof typeof TABLE_STYLE_PRESETS | "custom" };
export declare function mergeTableCells(editor: EditorSession, tablePath: string, cell: TableCellAddress, span: { colSpan?: number; rowSpan?: number }, options?: { join?: boolean; meta?: Record<string, unknown> }): TableChange;
export declare function splitTableCell(editor: EditorSession, tablePath: string, cell: TableCellAddress, meta?: Record<string, unknown>): TableChange;
export declare function setTableCellStyle(editor: EditorSession, tablePath: string, cells: TableCellAddress | TableCellAddress[], style: Record<string, unknown> | null, meta?: Record<string, unknown>): TableChange;
export declare function setTableStyle(editor: EditorSession, tablePath: string, preset: keyof typeof TABLE_STYLE_PRESETS | Partial<TableStyle>, meta?: Record<string, unknown>): TableChange;
/** FA-27: the table's text alternative as form state: `alt` (empty when absent or decorative) and `decorative` (the empty alt). */
export declare function readTableAlt(table: unknown): { alt: string; decorative: boolean };
/** FA-27: change the table's text alternative. `alt` is trimmed and an empty string or null removes it; `decorative: true` writes the empty alt and wins over `alt`; `decorative: false` removes an empty alt. Works on inline and dataset-backed tables. */
export declare function prepareTableAlt(presentation: unknown, tablePath: string, change: { alt?: string | null; decorative?: boolean }): PreparedTableChange;
export declare function setTableAlt(editor: EditorSession, tablePath: string, change: { alt?: string | null; decorative?: boolean }, meta?: Record<string, unknown>): TableChange;
/** {@link readTableStyle} for a table object. */
export declare function readTableStyleOfTable(table: unknown): (TableStyle | { header: "custom"; banding: "custom"; borders: "custom" }) & { preset: keyof typeof TABLE_STYLE_PRESETS | "custom" };
/** Apply a table style to a table object in place (the structure operations use it to keep banding, header fill and borders correct). */
export declare function applyTableStyleToTable(table: unknown, preset: keyof typeof TABLE_STYLE_PRESETS | Partial<TableStyle>): TableStyle;
// Rows, columns, header row and cell values (RR-24).
export * from "./table-structure.js";
