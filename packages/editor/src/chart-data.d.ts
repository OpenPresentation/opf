import type { EditorSession } from "./index.js";
import type { GridAddress, GridCellEdit, GridChange, GridOptions, GridSortOptions, PreparedGridChange } from "./grid-model.js";

/** Set chart cells from text or typed values: names and categories are text, series cells are numbers read in the number format (blank is a gap, never 0). One patch; every problem is in `error.issues`. */
export declare function prepareChartCells(document: unknown, chartPath: string, edits: GridCellEdit[], options?: GridOptions): PreparedGridChange;
export declare function setChartCells(editor: EditorSession, chartPath: string, edits: GridCellEdit[], options?: GridOptions): GridChange;
export declare function prepareChartPaste(document: unknown, chartPath: string, anchor: GridAddress, source: string | string[][], options?: GridOptions): PreparedGridChange;
export declare function pasteChartText(editor: EditorSession, chartPath: string, anchor: GridAddress, source: string | string[][], options?: GridOptions): GridChange;
/** Insert `count` empty rows (categories) so the first is row `at`. */
export declare function prepareChartInsertRows(document: unknown, chartPath: string, at: number, count?: number, options?: GridOptions): PreparedGridChange;
export declare function insertChartRows(editor: EditorSession, chartPath: string, at: number, count?: number, options?: GridOptions): GridChange;
export declare function prepareChartDeleteRows(document: unknown, chartPath: string, indices: number[], options?: GridOptions): PreparedGridChange;
export declare function deleteChartRows(editor: EditorSession, chartPath: string, indices: number[], options?: GridOptions): GridChange;
export declare function prepareChartMoveRows(document: unknown, chartPath: string, from: number, to: number, count?: number, options?: GridOptions): PreparedGridChange;
export declare function moveChartRows(editor: EditorSession, chartPath: string, from: number, to: number, count?: number, options?: GridOptions): GridChange;
/** Insert `count` unnamed series so the first is column `at`. */
export declare function prepareChartInsertColumns(document: unknown, chartPath: string, at: number, count?: number, options?: GridOptions): PreparedGridChange;
export declare function insertChartColumns(editor: EditorSession, chartPath: string, at: number, count?: number, options?: GridOptions): GridChange;
export declare function prepareChartDeleteColumns(document: unknown, chartPath: string, indices: number[], options?: GridOptions): PreparedGridChange;
export declare function deleteChartColumns(editor: EditorSession, chartPath: string, indices: number[], options?: GridOptions): GridChange;
export declare function prepareChartMoveColumns(document: unknown, chartPath: string, from: number, to: number, count?: number, options?: GridOptions): PreparedGridChange;
export declare function moveChartColumns(editor: EditorSession, chartPath: string, from: number, to: number, count?: number, options?: GridOptions): GridChange;
/** Sort the rows (categories) by a column, stably and by type. */
export declare function prepareChartSort(document: unknown, chartPath: string, column: number, options?: GridSortOptions): PreparedGridChange;
export declare function sortChartRows(editor: EditorSession, chartPath: string, column: number, options?: GridSortOptions): GridChange;
/** Swap categories and series: the first column's values become the series names and each series becomes a row. Numeric categories become text. */
export declare function prepareChartTranspose(document: unknown, chartPath: string): PreparedGridChange;
export declare function transposeChart(editor: EditorSession, chartPath: string, options?: { meta?: Record<string, unknown> }): GridChange;
/** Rename a series: the label of data column `column` (1 or more). */
export declare function renameChartSeries(editor: EditorSession, chartPath: string, column: number, name: string, options?: { meta?: Record<string, unknown> }): GridChange;
/** Rename a category: the first-column label of body row `row`. An empty name leaves it blank. */
export declare function renameChartCategory(editor: EditorSession, chartPath: string, row: number, name: string, options?: { meta?: Record<string, unknown> }): GridChange;
export { describeChartMapping, prepareChartMapping, setChartMapping, prepareDetachDataset, detachGridDataset } from "./grid-model.js";
export type { ChartMappingColumns, ChartMappingDescription } from "./grid-model.js";
