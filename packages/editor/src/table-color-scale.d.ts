import type { EditorChange, EditorSession, JsonPatchOperation } from "./index.js";

/** The scheme colors a scale end may take (the schema's SchemeColorName). */
export declare const TABLE_SCALE_COLORS: readonly string[];
/** The colors an absent `colors` means. */
export declare const TABLE_SCALE_DEFAULTS: { readonly colors: readonly ["surface", "primary"] };

export interface TableScaleColumn { name: string; index: number; numeric: boolean; shaded: boolean }
export interface TableColorScaleState {
  columns: TableScaleColumn[];
  kind: "none" | "sequential" | "diverging";
  /** Two or three scheme color names, low to high. */
  colors: string[];
  center: number | undefined; min: number | undefined; max: number | undefined;
}
export interface TableColorScaleChange {
  columns?: string[];
  kind?: "sequential" | "diverging";
  colors?: string[] | null;
  center?: number | null; min?: number | null; max?: number | null;
}

/** The table path a selection path points at, or undefined. */
export declare function parseTablePath(path: string): string | undefined;
/** The scale of a table as form state. */
export declare function readTableColorScale(table: unknown, presentation?: unknown): TableColorScaleState;
/** Whether a body cell is shaded by the table's scale (its column is named, it is a number, and it has no fill of its own). */
export declare function scaledCell(table: unknown, presentation: unknown, row: number, column: number): boolean;
export interface PreparedTableColorScale { action: "table-color-scale"; tablePath: string; changed: boolean; patches: JsonPatchOperation[]; presentation: unknown }
/** Prepare a color scale change as patches on the table; nothing is applied. `null` removes the scale. */
export declare function prepareTableColorScale(presentation: unknown, tablePath: string, change: TableColorScaleChange | null): PreparedTableColorScale;
/** Apply a color scale change to an editor session as one undoable edit. */
export declare function setTableColorScale(editor: EditorSession, tablePath: string, change: TableColorScaleChange | null, meta?: Record<string, unknown>): EditorChange & { action: "table-color-scale"; tablePath: string; changed: boolean };
