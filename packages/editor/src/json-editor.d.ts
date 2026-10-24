import type { JsonCatalogContext } from './json-options.js';

/** All offsets address the original source in UTF-16, including CRLF pairs. */
export interface JsonEditorApi {
  getValue(): string;
  getSelection(): [number, number];
  hasFocus(): boolean;
  focus(): void;
  setSelection(from: number, to?: number): void;
  /**
   * Replace one source range atomically; boundaries inside CRLF are rejected. The cursor moves to the end of the inserted text unless
   * `keepSelection` is set. `userEvent` names the edit (default `"input.replace"`; a paste uses `"input.paste"`): it must not be
   * `"input.type"` or `"input.complete"`, which re-indent the inserted lines.
   */
  replace(from: number, to: number, text: string, options?: { keepSelection?: boolean; userEvent?: string }): void;
  /** Replace the whole text with `text` as one undoable edit; only what differs changes, and a whitespace-only difference (a format) is one change per run of whitespace, so the cursor stays on its token. */
  replaceDiff(text: string): void;
  /** The indentation unit now in effect: a tab character or some spaces (JSON: read once when a document is opened; YAML and Markdown: two spaces). */
  indentUnit(): string;
  coordinates(): { left: number; top: number };
  /** Explicit, undoable whitespace formatting of JSON, also while it does not parse; returns false in YAML and Markdown (the source pane formats those). */
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
  /**
   * Live completion list in JSON: property names and enum, boolean and catalog values at the cursor's JSON path, from the same data as the field
   * menu (default false here; the source pane turns it on). Tab and Enter accept the selected item, Escape closes the list, and Ctrl+Space (Cmd+I on
   * macOS) opens it. The field menu is on Alt+Shift+O; with `completions` off it is also on Ctrl+Space.
   */
  completions?: boolean;
  catalogs?: JsonCatalogContext;
  /** Overrides the built-in menu, allowing an existing host UI to keep its appearance. */
  onOptions?(left?: number, top?: number): void;
  /**
   * Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z (Ctrl+Y) run CodeMirror's history first. When it has nothing left to undo or redo, the fallback runs
   * and answers true when it did something (false lets the key pass on). The source pane uses it to step the session back over a
   * whole-document replace.
   */
  historyFallback?: { undo?(): boolean; redo?(): boolean };
  /**
   * Format document (Shift+Alt+F and Cmd/Ctrl+Shift+F). The source pane passes one that formats JSON, YAML and Markdown; without it the keys
   * format JSON only.
   */
  onFormat?(): void;
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
  /** Forget the typed edits CodeMirror can undo, for when the text they were typed against was replaced. The text is unchanged. */
  resetHistory(): void;
  /** How many typed edit groups CodeMirror can still undo. */
  undoDepth(): number;
  /** The CodeMirror `EditorView`. */
  readonly view: import("@codemirror/view").EditorView;
  openOptions(left?: number, top?: number): Promise<void>;
  destroy(): void;
}
/** Mount after the host DOM exists. Importing this module does not require a DOM. */
export declare function mountJsonCodeEditor(parent: HTMLElement, options: JsonCodeEditorOptions): JsonCodeEditor;
