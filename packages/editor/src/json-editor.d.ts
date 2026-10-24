import type { JsonCatalogContext } from './json-options.js';

/** One text edit of a quick fix, in source offsets of the text as it is when the fix is applied. */
export interface SourceEdit { from: number; to: number; insert: string }
/**
 * A quick fix of a problem: `edits` are applied as one undoable change (`caret`, or `select: [from, to]`, is a position in the text after them),
 * or `run(api, problem)` does something else (the source pane applies a patch through the session).
 */
export interface EditorFix {
  id: string;
  title: string;
  /** Mechanical and unambiguous: offered first. */
  safe?: boolean;
  edits?: SourceEdit[];
  caret?: number;
  select?: [number, number];
  run?(api: JsonEditorApi, problem: EditorProblem): void;
}
/** A problem drawn in the text: a squiggle over `from..to` (source offsets), its message, what could come next and its quick fixes. */
export interface EditorProblem {
  from: number;
  to: number;
  severity: "error" | "warning" | "info";
  message: string;
  /** What to do, without a leading "Next:". */
  next?: string;
  /** The rule id, shown as the source of the problem. */
  rule?: string;
  fixes?: EditorFix[];
}

/** All offsets address the original source in UTF-16, including CRLF pairs. */
export interface JsonEditorApi {
  /** Say `message` in the editor's live region (screen readers). */
  say(message: string): void;
  /** Apply several edits as one undoable change; `caret` or `select` is a position in the text after them. */
  applyEdits(edits: SourceEdit[], options?: { caret?: number; select?: [number, number]; userEvent?: string }): void;
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
   * Live completion list in JSON, YAML and Markdown (default false here; the source pane turns it on): in JSON property names from the schema, ranked with the required and the
   * common ones first, and values (enums, booleans, catalog ids, `{}` and `[]` templates with their required members, snippets for slides and the like)
   * at the cursor's JSON path. Typing a quote, a word, `:` or the space after it opens the list; Ctrl+Space (Cmd+I on macOS) opens it anywhere (with
   * the list open it shows or hides the documentation). Tab and Enter (and Shift+Tab, Shift+Enter) accept the selected item, Escape closes the list,
   * Left, Right and Backspace inside the word keep it open. The field menu is on Alt+Shift+O; with `completions` off it is also on Ctrl+Space. YAML offers the
   * same from a line-and-indent reader (block and flow style, after a list dash); Markdown offers the front matter and fence YAML, slide and block
   * options, fence info lines, metric fences, `Note:` and snippets (see the source pane in the README). Enter, Tab, Backspace, pairs and Cmd/Ctrl+/
   * follow the language: YAML indents the way its text is built, Markdown continues lists and quotes, nests a list item with Tab and comments with `<!-- -->`.
   */
  completions?: boolean;
  /** Enter continues a list the way the text writes it: a new string item after a string in a JSON list, the next `- ` in YAML, the next marker in Markdown. Default true; false keeps only the indentation. */
  smartListEnter?: boolean;
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
  /** Hover documentation over keys and catalog ids in JSON, and Cmd/Ctrl+K Cmd/Ctrl+I (default true). */
  hover?: boolean;
  /** Called with every message the live region says (hosts mirror them into a region of their own). */
  announce?(message: string): void;
  /**
   * JSON syntax errors are underlined by the editor itself, one per cause, 300 ms after the last key (default true). A host that supplies every
   * problem through `setProblems` (the source pane) turns it off.
   */
  syntaxProblems?: boolean;
  /** Cmd/Ctrl+Shift+M: move focus to the host's problems list. Answer true when it did. */
  onFocusProblems?(): boolean;
  onFocus?(): void;
  onHoverField?(path: string | null): void;
  onError?(error: unknown): void;
}
export interface JsonCodeEditor {
  api: JsonEditorApi;
  /** Apply external source without emitting onChange or adding a local undo step. */
  update(code: string, invalid?: boolean, field?: string | null, describedBy?: string): void;
  setCatalogs(catalogs: JsonCatalogContext): void;
  /** Draw the problems in the text (squiggles with their messages and quick fixes). Replaces the ones drawn before. */
  setProblems(problems: readonly EditorProblem[]): void;
  /** The problems drawn now, in position order, at their current source offsets. */
  getProblems(): EditorProblem[];
  /** F8: select the next problem and say what it is; wraps. */
  nextProblem(): boolean;
  /** Shift+F8. */
  previousProblem(): boolean;
  /** Cmd/Ctrl+.: the quick fixes of the problems at the caret. */
  triggerQuickFix(): boolean;
  /** Ctrl+Space: open the suggestion list at the caret. */
  triggerCompletion(): boolean;
  /** Whether a suggestion list is open or being asked for. */
  isCompleting(): boolean;
  /** Perform a quick fix. */
  applyFix(fix: EditorFix, problem?: EditorProblem): void;
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
