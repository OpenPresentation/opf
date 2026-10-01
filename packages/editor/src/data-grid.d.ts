import type { EditorSession } from "./index.js";
import type { DataGridTarget } from "./grid-model.js";

export * from "./grid-model.js";

export interface DataGridOptions {
  editor: EditorSession;
  /** Bind to one chart or table path. */
  path?: string;
  /** Or follow the host's selection into a chart or table (call `refresh()` when it changes). */
  getSelectedPath?: () => string | undefined;
  /** How chart numbers are read and shown: "auto" (the locale's decimal separator, the default), "." or ",". */
  numberFormat?: "auto" | "." | ",";
  /** A BCP 47 tag for "auto" (default: the page's `lang`, then the browser's language). */
  locale?: string;
  /** CSS length of the scrolling area (default "320px"). */
  maxHeight?: string;
  /** Called after every committed change. */
  onChange?: (change: unknown) => void;
  /** Called with every status or error message the grid shows. */
  onStatus?: (message: string, info: { error: boolean }) => void;
  /** Called when the grid starts or stops showing a chart or table. */
  onTargetChange?: (target: DataGridTarget | undefined) => void;
}
export interface DataGrid {
  element: HTMLElement;
  refresh(): void;
  focus(): void;
  readonly target: DataGridTarget | undefined;
  readonly numberFormat: "auto" | "." | ",";
  setNumberFormat(format: "auto" | "." | ","): void;
  /** Paste TSV or CSV text at the selected cell, as Ctrl+V does. Returns whether it applied. */
  paste(text: string): boolean;
  destroy(): void;
}
/** Mount a spreadsheet-like grid for a chart's inline data or a table. Every edit is one undoable session patch. */
export declare function createDataGrid(container: HTMLElement, options: DataGridOptions): DataGrid;
