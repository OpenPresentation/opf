import type { JsonCatalogContext } from './json-options.js';

/** All offsets address the original source in UTF-16, including CRLF pairs. */
export interface JsonEditorApi {
  getValue(): string;
  getSelection(): [number, number];
  hasFocus(): boolean;
  focus(): void;
  setSelection(from: number, to?: number): void;
  /** Replace one source range atomically; boundaries inside CRLF are rejected. */
  replace(from: number, to: number, text: string): void;
  coordinates(): { left: number; top: number };
  /** Explicit, undoable whitespace formatting; returns false for invalid JSON. */
  format(): boolean;
}
export interface JsonCodeEditorOptions {
  code: string;
  label: string;
  onChange(source: string): void;
  invalid?: boolean;
  describedBy?: string;
  lineNumbers?: boolean;
  /** Highlighting and behavior: "json" (default) adds the parse linter, field highlights and the option menu. */
  language?: "json" | "yaml" | "markdown";
  readOnly?: boolean;
  /** Live completion popup in JSON: property names and enum, boolean and catalog values at the cursor's JSON path, from the same data as the field menu (default false here; the source pane turns it on). Ctrl+Space still opens the field menu. */
  completions?: boolean;
  catalogs?: JsonCatalogContext;
  /** Overrides the built-in menu, allowing an existing host UI to keep its appearance. */
  onOptions?(left?: number, top?: number): void;
  onFocus?(): void;
  onHoverField?(path: string | null): void;
  onError?(error: unknown): void;
}
export interface JsonCodeEditor {
  api: JsonEditorApi;
  /** Apply external source without emitting onChange or adding a local undo step. */
  update(code: string, invalid?: boolean, field?: string | null, describedBy?: string): void;
  setCatalogs(catalogs: JsonCatalogContext): void;
  setLanguage(language: "json" | "yaml" | "markdown"): void;
  setReadOnly(readOnly: boolean): void;
  /** The CodeMirror `EditorView`. */
  readonly view: import("@codemirror/view").EditorView;
  openOptions(left?: number, top?: number): Promise<void>;
  destroy(): void;
}
/** Mount after the host DOM exists. Importing this module does not require a DOM. */
export declare function mountJsonCodeEditor(parent: HTMLElement, options: JsonCodeEditorOptions): JsonCodeEditor;
