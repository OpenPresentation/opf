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

export interface SourcePaneOptions {
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
  /** The underlying code editor (`mountJsonCodeEditor`). */
  readonly editor: JsonCodeEditor;
  destroy(): void;
}

/** Mount the source pane in `container`: file name, format menu, Format, Copy and Download, the code, and the findings list. */
export declare function createSourcePane(container: HTMLElement, options: SourcePaneOptions): SourcePane;
