import type { EditorChange, EditorSession } from "./index.js";
import type { JsonCatalogContext } from "./json-options.js";
import type { EditorProblem, JsonCodeEditor } from "./json-editor.js";

/** The source formats of the pane: `json` is canonical; `yaml` and `md` are core's `@openpresentation/opf/yaml` and `/markdown`. */
export type SourceFormat = "json" | "yaml" | "md";
export type SourcePaneDensity = "comfortable" | "touch";
export type SourceFindingSeverity = "error" | "warning" | "info";

/** One finding under the code. Core validator `Finding` objects fit: they carry `path`, `message` and `severity`. */
export interface SourceFinding {
  /** A JSON Pointer into the document (`/slides/0/title`); "" is the document or a position-only finding. */
  path: string;
  message: string;
  severity: SourceFindingSeverity;
  /** A one-based line in the pane's current text. Used when the pane cannot place `path` itself and for syntax errors. */
  line?: number;
  /** `schema` (the default count label), `syntax`, `format` (a note about what the format cannot hold) or `rejected` (the session refused the edit). */
  kind?: string;
  ruleId?: string;
  /** A one-based column, with `line`. */
  column?: number;
  /**
   * What core's findings carry beyond the sentence, kept and used: `validation` (the schema keyword and its parameters) and `suggestions` write the
   * plain-words message and its "Next" hint and offer "Change to ..." fixes; `location` ranges the squiggle; `fixes` of kind `patch` and `focus` become
   * quick fixes; `help` is the hint when nothing better is known.
   */
  help?: string;
  location?: { offset: number; length: number; line?: number; column?: number };
  validation?: { keyword?: string; params?: Record<string, unknown>; alternatives?: string[] };
  suggestions?: { value: unknown; label?: string }[];
  fixes?: { id: string; title: string; kind: "patch" | "focus"; safe?: boolean; patch?: unknown[]; focus?: { path?: string; field?: string } }[];
}

/** What a host receives when the pane copies or downloads. */
export interface SourceFile {
  /** The name without the extension, spaces and slashes already replaced by `-`. */
  name: string;
  /** `<name>.opf.<json|yaml|md>` */
  filename: string;
  text: string;
  format: SourceFormat;
  mime: string;
}

export type ShortcutPlatform = "mac" | "win" | "linux";
/** One row of the keyboard shortcuts list. */
export interface Shortcut {
  id: string;
  title: string;
  group: string;
  /** The keys as words: `Cmd+Shift+O` on macOS, `Ctrl+Shift+O` elsewhere; a chord is two strokes separated by a space (`Cmd+K Cmd+0`). */
  keys: string[];
  /** The same keys with the macOS symbols (`⌘⇧O`) on macOS, else the words. */
  symbols: string[];
  /** The keys in CodeMirror's notation (`Mod-Shift-o`). */
  strokes: string[];
  /** What has to be true for the keys to apply (`the list is open`). */
  when?: string;
}

/** One entry of the outline of a document (the symbol picker and the outline panel). Offsets are source offsets. */
export interface OutlineSymbol {
  id: string;
  kind: "slide" | "section" | "asset" | "dataset" | "variable" | "reference" | "record";
  /** `3. Highlights` for a slide, the id for an asset, `layout hero` for an embedded catalog record. */
  label: string;
  /** `layout cover` for a slide with a layout, the title of a dataset, the catalog group of a record. */
  detail: string;
  /** 1 for the entries under a section (assets, datasets, variables, references). */
  depth: number;
  from: number;
  to: number;
  line: number;
}

/**
 * Where the caret is in the text (CE-17), in any of the three formats. Offsets are source offsets: UTF-16 positions in the text as `getText()` returns it.
 */
export interface SourceCursor {
  /** The JSON Pointer of the field under the caret (`/slides/0/title`; `""` outside the document's content). On a property name or value it is that property; between members it is the container. */
  pointer: string;
  /** The same place addressed by id (`/slides/@intro/title`), read from the session's document; the pointer itself where an element has no id, or while the text does not read as a document. */
  idPath: string;
  /** The start and end of the main selection (equal for a plain caret). */
  from: number;
  to: number;
  /** The end of the selection the caret is at; `pointer` is read here. */
  head: number;
  /** What the caret is on: a property name (`key`), a value, whitespace or punctuation inside a container (`between`), or outside the document (`none`). */
  part: "key" | "value" | "between" | "none";
  format: SourceFormat;
}

/** One mark or line class a host draws in the text (CE-17), by path or by range. */
export interface SourceDecoration {
  /** A JSON Pointer (or dotted OPF path). The decoration follows the field when slides move, and is not drawn while the text has no such field. */
  path?: string;
  /** Which part of the field a `path` marks: the value (default), its `key`, the whole `entry` (key through value), the `open` bracket or the `colon`. */
  part?: "value" | "key" | "entry" | "open" | "colon";
  /** Source offsets, instead of a path. They follow the text as it is edited, as text positions, and are not placed again when the format changes. */
  range?: { from: number; to?: number };
  /** The class `opf-source-decoration-<kind>`; the built-in looks are `highlight` (default), `error`, `warning`, `info`, `added` and `changed`. Any other kind is styled by the host. */
  kind?: string;
  /** The browser tooltip of a mark. */
  label?: string;
  /** Put the class on every line the range touches (a `.cm-line`) instead of marking the text. */
  line?: boolean;
}

/** A host decoration as drawn now (`getDecorations`). */
export interface SourceDecorationInfo {
  group: string;
  kind: string;
  label?: string;
  path?: string;
  /** The current source offsets; a line decoration spans from the first line's start to the last line's end. */
  from: number;
  to: number;
  line: boolean;
}

export interface RevealOptions {
  /** Also focus the code editor (default false: the page's focus stays where it is). */
  focus?: boolean;
  /** Also select the range (default false: the caret stays; this also emits a `cursor` event). */
  select?: boolean;
  /** Where the start of the range lands: `center` (default), `start` (the top) or `nearest` (the least scrolling). */
  align?: "center" | "start" | "nearest";
  /** Mark the first line for a moment. */
  flash?: boolean;
  /** Which part of the field a path means (default `entry`: the key through the end of its value). */
  part?: SourceDecoration["part"];
}

export interface SourcePaneOptions {
  /**
   * The caret or selection moved (also while the pane has no focus), or the text under it changed: the path under the caret. Called after `cursorDelay` of
   * quiet and not at all for a position it already reported; while a typed edit waits to be applied it waits too, so `idPath` is read from the document
   * the text reads as. `getCursor()` reads the position at once.
   */
  onCursor?(cursor: SourceCursor): void;
  /** Milliseconds of quiet before `onCursor` is called (default 50; 0 is the next tick). */
  cursorDelay?: number;
  /** Add an Outline button to the bar and a panel listing the slides and other symbols of the document (`"open"` shows the panel at the start). The symbol picker (Cmd/Ctrl+Shift+O) is always there. */
  outline?: boolean | "open";
  /** Called with `getShortcuts()` when the shortcuts dialog is about to open; returning `true` means the host shows its own and the editor's dialog stays closed. */
  onShowShortcuts?(shortcuts: Shortcut[]): boolean | void;
  /** The editor session. Every edit in any format reaches it as a patch (`applyPatch`), so it is validated and undoable. */
  editor: EditorSession;
  /** File name without extension (default `deck`). Spaces and slashes become `-`. */
  name?: string;
  onRename?(name: string): void;
  /** The starting format (default `json`). */
  format?: SourceFormat;
  onFormatChange?(format: SourceFormat, previous: SourceFormat): void;
  /** The JSON text as the author wrote it. Used when it parses to the session's document, so its spelling is kept. */
  source?: string;
  /** Findings to list. Without `findings` and `getFindings` the pane lists the session's own validation. */
  findings?: readonly (SourceFinding | Record<string, unknown>)[];
  /** Called whenever the list is rebuilt, so a host can pass core validator output without pushing it. */
  getFindings?(context: { editor: EditorSession; format: SourceFormat; text: string }): readonly (SourceFinding | Record<string, unknown>)[];
  /** A row was clicked (after the cursor moved). `line` is the line it moved to. */
  onFindingSelect?(finding: SourceFinding, line: number): void;
  /** Replace the default (`navigator.clipboard.writeText`). */
  onCopy?(file: SourceFile): void | Promise<void>;
  /** Replace the default (a Blob link named `<name>.opf.<ext>`). */
  onDownload?(file: SourceFile): void | Promise<void>;
  density?: SourcePaneDensity;
  readOnly?: boolean;
  /** Milliseconds a typed edit waits before it is applied to the session (default 250; 0 applies each change). */
  applyDelay?: number;
  /** Accessible name of the code editor (default `OPF source`). */
  label?: string;
  catalogs?: JsonCatalogContext;
  /** Live completions while typing JSON: property names from the schema and values (enums, booleans, catalog ids, templates, snippets) at the cursor's JSON path. Tab and Enter accept the selected item, Escape closes the list, Ctrl+Space (Cmd+I on macOS) opens it; the field menu is on Alt+Shift+O. Hover documentation, squiggles with quick fixes (Cmd/Ctrl+.) and F8 come with it. The same for YAML and Markdown (front matter, slide and block options, fences, `Note:` and snippets). Default true. */
  completions?: boolean;
  /** Enter continues a list: a new string item after a string in a JSON list, the next `- ` in YAML, the next marker (or `> `) in Markdown; an empty one ends it. Default true. */
  smartListEnter?: boolean;
  /**
   * Run the pane's text checks (reading YAML or Markdown, the syntax pass of JSON and the document validation) in a Web Worker, so typing in a deck
   * of a thousand slides never blocks the main thread. A function returns the Worker (`() => new Worker(new URL("@openpresentation/opf-editor/source-worker", import.meta.url), { type: "module" })`
   * with a bundler that supports that form); a Worker is used as given; `true` starts `source-worker.js` beside the package's own module, which works
   * when a bundler follows `new URL(..., import.meta.url)`. Only the typing delay uses the worker: every explicit action (`getText`, switching the format,
   * `replaceDocument`, Format, Undo) is applied on the main thread at once. When the worker cannot start, fails or stops answering, the pane checks on the
   * main thread from then on and `onError` is called once; no edit is lost. Default `false` (everything on the main thread).
   */
  worker?: boolean | Worker | (() => Worker);
  /** A preview for the card F12 and Alt+F12 open on a catalog record only the app provides (see `JsonCodeEditorOptions.resolvePreview`). */
  resolvePreview?: (kind: string, id: string) => HTMLElement | string | undefined | Promise<HTMLElement | string | undefined>;
  onError?(error: unknown): void;
}

export interface ReplaceDocumentOptions {
  /**
   * The text the document was read from: JSON, YAML or Markdown. When it reads as exactly the document, the pane keeps its spelling (JSON
   * formatting, YAML comments, Markdown prose layout), shows it while the pane is in that format and brings it back on Undo, Redo and
   * when the format is switched to it. Text that does not read as the document is ignored.
   */
  source?: string;
  /** The format of `source`. Default: inferred, the first of JSON, the pane's format, YAML and Markdown that reads as the document. */
  format?: SourceFormat;
  /** The file name without extension, as `setName` (the document's own name is not used). */
  name?: string;
  /** Extra `meta` for the session change (`source` defaults to `"replace-document"`). */
  meta?: Record<string, unknown>;
}

export interface SourcePane {
  element: HTMLElement;
  /**
   * Open a different document in the session and the pane (a host's example menu, File > Open): `editor.replaceDocument`, so it is one
   * undoable change and no catalog record is forked into `catalogs.custom` (a diff typed or pasted into the pane is an edit; this is not).
   * `document` is a parsed document or JSON text. The pane shows `options.source` (the text the document was read from in JSON, YAML or
   * Markdown, kept byte for byte, comments included; `document` itself when it is JSON text) in the format it is in, and the document
   * written by core's converter when no original text fits. Undo and Redo bring back each document's text exactly, in the format that is
   * shown, and so do Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z once the text typed since the load is undone. A document the session refuses throws
   * (`invalid-opf-edit` with `issues`) and changes nothing. Works in a read-only pane.
   */
  replaceDocument(document: unknown, options?: ReplaceDocumentOptions): EditorChange;
  /** Re-read the document from the session. */
  refresh(): void;
  /** Replace the host findings; `null` returns to the session's own validation. */
  setFindings(findings: readonly (SourceFinding | Record<string, unknown>)[] | null): void;
  /** Switch format. Returns false, and says why in the findings, when the document cannot be written in it. Does not call `onFormatChange`. */
  setFormat(format: SourceFormat): boolean;
  getFormat(): SourceFormat;
  /** Move the cursor to the line of a JSON Pointer (or dotted OPF path) in the current format (core's `locate` finds it in JSON, YAML and Markdown). Returns the line. */
  focusPath(path: string): number;
  /** The path under the caret now (see `SourceCursor`), read at once and also while the pane has no focus. */
  getCursor(): SourceCursor;
  /**
   * Scroll a JSON Pointer (or dotted path) or a range `{ from, to }` (source offsets) into view without moving the caret or the focus, which
   * `focusPath` does. Folded text around the start is opened. Returns the range revealed, its one-based line, and whether the path is exactly in the
   * text (`false`: the nearest container was revealed); `null` when the path cannot be placed at all.
   */
  revealPath(target: string | { from: number; to?: number }, options?: RevealOptions): { from: number; to: number; line: number; exact: boolean } | null;
  /**
   * Draw marks or line classes of your own, by path or range, kept apart from the editor's own decorations (squiggles, field highlights, the outline's
   * marker). `group` (default `default`) names a set; a call replaces the whole set, so validation issues and the paths an agent touched can be
   * two groups. `[]` or `null` clears the set. A decoration with neither a path nor a range throws a `TypeError`.
   */
  setDecorations(decorations: readonly SourceDecoration[] | null, options?: { group?: string }): void;
  /** Clear the decorations of `group`, or all of the host's without an argument. */
  clearDecorations(group?: string): void;
  /** The host decorations drawn now, at their current offsets, in position order; of `group`, or all. */
  getDecorations(group?: string): SourceDecorationInfo[];
  /** The text as shown, with any pending edit applied first. */
  getText(): string;
  /**
   * Canonicalize with OPF: rewrite the YAML or Markdown text from the document with core's writer (the old behavior of Format). It drops comments, so it
   * asks first when there are any (an inline confirmation naming how many); `confirmed: true` has asked already. Returns "applied", "unchanged",
   * "confirm" (waiting for the answer) or "refused" (JSON, read-only, or text that does not read as a document).
   */
  canonicalize(options?: { confirmed?: boolean }): "applied" | "unchanged" | "confirm" | "refused";
  getName(): string;
  setName(name: string): void;
  setDensity(density: SourcePaneDensity): void;
  setReadOnly(readOnly: boolean): void;
  /** The problems drawn in the text now, in position order, at source offsets. */
  getProblems(): EditorProblem[];
  /** Select the next problem in the text (F8) and say what it is; wraps. */
  nextProblem(): boolean;
  /** Select the previous problem (Shift+F8). */
  previousProblem(): boolean;
  /** Select problem number `index` (zero-based, position order) and say what it is. Returns false when there is none. */
  showProblem(index: number): boolean;
  /** Open the suggestion list at the caret, as Ctrl+Space does. */
  triggerCompletion(): boolean;
  /**
   * Every key binding the editor installed, for `platform` (default: the page's), grouped and titled as the shortcuts dialog shows them. The list is produced from the
   * table that installs the keymap, so it cannot drift from the keys.
   */
  getShortcuts(platform?: ShortcutPlatform): Shortcut[];
  /** Open the keyboard shortcuts dialog (the `?` button, F1, Cmd/Ctrl+K then Cmd/Ctrl+S). `onShowShortcuts` returning true replaces it with the host's own. */
  showShortcuts(): boolean;
  /** Open the symbol picker (Cmd/Ctrl+Shift+O). */
  showSymbols(): boolean;
  /** The outline of the text as it is now, in document order. Works on text that does not parse. */
  getOutline(): OutlineSymbol[];
  /** Show or hide the outline panel (needs the `outline` option); without an argument it toggles. Returns whether the panel is open. */
  toggleOutline(open?: boolean): boolean;
  /** The underlying code editor (`mountJsonCodeEditor`). */
  readonly editor: JsonCodeEditor;
  /** Resolves when no typed edit waits for its apply delay and no check (a worker's included) is running: the text on screen has been read and applied. */
  whenIdle(): Promise<void>;
  /** How the applied edits were checked: how many by the worker and how many on the main thread, and whether the worker can still be used. */
  checkerStats(): { worker: number; inline: number; available: boolean };
  destroy(): void;
}

/** Mount the source pane in `container`: file name, format menu, Format, Copy and Download, the code, and the findings list. */
export declare function createSourcePane(container: HTMLElement, options: SourcePaneOptions): SourcePane;
