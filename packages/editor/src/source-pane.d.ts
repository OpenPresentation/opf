import type { EditorChange, EditorSession } from "./index.js";
import type { JsonCatalogContext } from "./json-options.js";
import type { JsonCodeEditor } from "./json-editor.js";

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
  /** Live completions while typing JSON: property names and values (enums, booleans, catalog references) at the cursor's JSON path, from the same data as the field menu. YAML and Markdown keep the menu only. Default true. */
  completions?: boolean;
  onError?(error: unknown): void;
}

export interface ReplaceDocumentOptions {
  /** The JSON text the document was read from. Used when it parses to the document, so its spelling is kept. */
  source?: string;
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
   * `document` is a parsed document or JSON text. The pane shows `options.source` (the JSON text the document was read from, kept byte for
   * byte; `document` itself when it is text) in JSON and the document written in YAML or Markdown. Undo and Redo bring back each
   * document's text exactly, in the format that is shown. A document the session refuses throws (`invalid-opf-edit` with `issues`) and
   * changes nothing. Works in a read-only pane.
   */
  replaceDocument(document: unknown, options?: ReplaceDocumentOptions): EditorChange;
  /** Re-read the document from the session. */
  refresh(): void;
  /** Replace the host findings; `null` returns to the session's own validation. */
  setFindings(findings: readonly (SourceFinding | Record<string, unknown>)[] | null): void;
  /** Switch format. Returns false, and says why in the findings, when the document cannot be written in it. Does not call `onFormatChange`. */
  setFormat(format: SourceFormat): boolean;
  getFormat(): SourceFormat;
  /** Move the cursor to the line of a JSON Pointer (or dotted OPF path) in the current format; best effort for YAML and Markdown. Returns the line. */
  focusPath(path: string): number;
  /** The text as shown, with any pending edit applied first. */
  getText(): string;
  getName(): string;
  setName(name: string): void;
  setDensity(density: SourcePaneDensity): void;
  setReadOnly(readOnly: boolean): void;
  /** The underlying code editor (`mountJsonCodeEditor`). */
  readonly editor: JsonCodeEditor;
  destroy(): void;
}

/** Mount the source pane in `container`: file name, format menu, Format, Copy and Download, the code, and the findings list. */
export declare function createSourcePane(container: HTMLElement, options: SourcePaneOptions): SourcePane;
