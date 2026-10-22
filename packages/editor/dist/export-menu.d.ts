import type { Catalog } from "@openpresentation/opf";
import type { ToSvgOptions } from "@openpresentation/opf-render";
import type { AgentHandoffTarget } from "./agent-handoff.js";
import type { EditorFonts } from "./canvas.js";
import type { ConvertOptions } from "./export.js";

/** The slide formats, in menu order. `pptx` shows only when `exportPptx` is given (or you list it, and then it is disabled). */
export type ExportSlideFormat = "pptx" | "pdf" | "svg" | "png";
/** The OPF source formats: `json` is the document as "Save OPF" writes it, `yaml` and `markdown` are core's `toYaml` and `toMarkdown`. */
export type ExportSourceFormat = "json" | "yaml" | "markdown";
/** What `onDownload` is told: a slide or source format, or `"handoff"` for the agent prompt's "Download .md". */
export type ExportedFormat = ExportSlideFormat | ExportSourceFormat | "handoff";

export interface ExportDownload {
  blob: Blob;
  fileName: string;
  format: ExportedFormat;
}

/** A note about an export: a plain sentence, or a finding / diagnostic (`slide` is zero-based, as core's Finding defines it). */
export type ExportNote = string | { message?: string; ruleId?: string; slide?: number; path?: string; severity?: string };

export interface ExportPptxOptions {
  /** Aborted by Cancel (or `destroy()`). The menu stops waiting at once even if the exporter ignores it. */
  signal: AbortSignal;
  /** Tell the menu how far along the export is; `message` is shown in the status line. */
  onProgress(progress: { stage?: string; done?: number; total?: number; message?: string }): void;
}
export type ExportPptxResult = Uint8Array | ArrayBuffer | Blob | { bytes: Uint8Array | ArrayBuffer | Blob; fileName?: string; warnings?: ExportNote[] };

export interface ExportMenuItems {
  /** The slide formats to show, in this order (default all four; `pptx` only when `exportPptx` is set). `false` hides the group. */
  slides?: readonly ExportSlideFormat[] | false;
  /** Default `["json", "yaml", "markdown"]`. `false` hides the group. */
  source?: readonly ExportSourceFormat[] | false;
  /** `false` hides "For an agent". */
  agent?: boolean;
}

export interface ExportStatus {
  state: "busy" | "success" | "error" | "cancelled";
  message: string;
  notes: string[];
}

export interface ExportMenuOptions {
  /** The document to export. Called on every export; the menu exports a `structuredClone` of what it returns. */
  getDeck(): unknown;
  /**
   * Called before an export or the handoff reads the document, for example to commit an open canvas edit. Return `false` to stop.
   */
  beforeExport?(kind: "slides" | "source" | "agent", format: string): boolean | void;
  /** PDF, PNG and SVG: the renderer's fonts handle (`loadFonts()`), as for the canvas, so preview and export share one set of fonts. */
  fonts?: EditorFonts;
  /** Host catalogs for references and for embedding, or a function that returns them (for example `() => editor.catalogs`). */
  catalogs?: readonly Catalog[] | (() => readonly Catalog[] | undefined);
  /** The options the host's preview renders with. */
  renderOptions?: ToSvgOptions;
  /** More options for `convert` (`export.js`): `scale`, `includeHidden`, `converters`, `text`, ... Not `format`, `signal` or `onProgress`. */
  convertOptions?: Partial<Omit<ConvertOptions, "format" | "signal" | "onProgress">>;
  /**
   * PowerPoint lives in @openpresentation/opf-pptx, which the editor does not import: the host runs `toPptx` here and returns the bytes.
   * Load the fonts the deck needs first, as the host's preview does. Reject to report a failure.
   */
  exportPptx?(deck: any, options: ExportPptxOptions): Promise<ExportPptxResult> | ExportPptxResult;
  /** Take the file instead of the default Blob-link download. May return a promise; a rejection is reported as a failure. */
  onDownload?(download: ExportDownload): void | Promise<void>;
  /** Called after a file was handed on, with its notes. */
  onExport?(done: ExportDownload & { notes: string[] }): void;
  /** Every change of the status line (busy, success, error, cancelled). Also announced in the menu's `aria-live` region. */
  onStatus?(status: ExportStatus): void;
  /** "Agent handoff": handle it yourself. Default: open the agent handoff dialog. */
  onAgentHandoff?(handoff: { document: unknown; target: AgentHandoffTarget }): void;
  /** The target the handoff dialog starts on (default `"pptx"`). */
  handoffTarget?: AgentHandoffTarget;
  /** Where the default handoff dialog mounts (default `document.body`). */
  handoffContainer?: HTMLElement;
  /** The name the handoff prompt tells the agent to save the deck as (default `deck.opf.json`). */
  handoffFileName?: string;
  specUrl?: string;
  agentGuideUrl?: string;
  /** Hide groups or formats. */
  items?: ExportMenuItems;
  /** `"menu"` (default) is a popover under the trigger; `"sheet"` is the mobile bottom sheet with a scrim, a drag handle and Close. */
  mode?: "menu" | "sheet";
  /** `"touch"` makes controls 40px (sheet rows 44px). Default `"comfortable"` (32px). */
  density?: "comfortable" | "touch";
  /**
   * Disable the slide exports, for example while the JSON is invalid. `true` gives the default reason; a string is your own. The reason is the
   * items' title. Source exports and the handoff stay available.
   */
  disabled?: boolean | string;
  /** The trigger's text (default "Export"). */
  label?: string;
}

export interface ExportMenu {
  /** The root element, mounted in the container. */
  element: HTMLElement;
  /** The trigger button. */
  trigger: HTMLButtonElement;
  /** Re-read the document for the menu's hints ("ZIP" or one file). Called on every open as well. */
  refresh(): void;
  open(which?: "first" | "last"): void;
  close(options?: { restoreFocus?: boolean }): void;
  /** `true` disables the slide exports with the default reason, a string with your own, `false`/`undefined` enables them. */
  setDisabled(reason?: boolean | string): void;
  /** Switch between the popover and the bottom sheet, for example at a media query. */
  setMode(mode: "menu" | "sheet"): void;
  setDensity(density: "comfortable" | "touch"): void;
  /** Cancel the export that is running, if any. */
  cancel(): void;
  /** Cancel a running export and remove the menu and any handoff dialog it opened. */
  destroy(): void;
}

/** The reason `setDisabled(true)` gives. */
export declare const EXPORT_DISABLED_REASON: string;

/**
 * The Export menu: a trigger button and a grouped `role="menu"` (Slides, OPF source, For an agent). Slides use this package's headless
 * `convert`; PowerPoint comes from `exportPptx`; source formats use core's `toYaml` and `toMarkdown`. Progress, Cancel and a success or
 * failure line show under the trigger and are announced through `aria-live`. CSS: `src/styles/export-menu.css`, classes `opf-export-*`.
 */
export declare function createExportMenu(container: HTMLElement, options: ExportMenuOptions): ExportMenu;
