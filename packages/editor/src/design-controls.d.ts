import type { EditorSession } from "./index.js";

export type DesignControlSection = "look" | "background" | "slide-image" | "header-footer" | "brand" | "layout-options" | "info" | "selection" | "table" | "slide-content";
/** Every section, in panel order. `selection` and `table` follow the host's current selection; `slide-content` (RR-26: blocks and regions, images between content and design) follows the current slide. */
export declare const DESIGN_CONTROL_SECTIONS: readonly DesignControlSection[];

export interface DesignControlsOptions {
  editor: EditorSession;
  /** The slide the host is showing (default 0). Call `refresh()` when it changes. */
  getSlideIndex?: () => number;
  /** The host's selected OPF path, for the selection and table sections. Call `refresh()` when it changes. */
  getSelectedPath?: () => string | undefined;
  /** Sections to show (default: all). Mount `selection` and `table` apart from the others to put them beside the content inspector. */
  sections?: readonly DesignControlSection[];
  /** Initial "Applies to" choice. */
  scope?: "deck" | "slide";
  /** Caller-loaded catalog records by kind (layouts, font schemes, themes, ...) for options the bundled catalogs do not have. */
  catalogs?: Record<string, unknown>;
  catalogSources?: Record<string, unknown>;
  /** Called after every committed change (never for a refused one). */
  onChange?: (change: unknown) => void;
  /** Called after a content conversion or replacement with the path to keep selected (the block, or the inline payload field), since the old selection path may no longer exist. */
  onSelectPath?: (path: string) => void;
  /** Largest image the upload controls accept, in bytes (default 2 MiB). */
  maxImageBytes?: number;
  /**
   * For hosts that store images themselves: receives the validated bytes of an uploaded image and returns its reference (a web address or an `asset:` id
   * the host added). When set, nothing is added to the document's `assets`.
   */
  onAddAsset?: (image: { name: string; mediaType: string; bytes: Uint8Array; size: number; alt?: string; file: unknown }) => string | { src: string } | Promise<string | { src: string }>;
  /** Called with every status or error message the panel shows in its live regions. */
  onStatus?: (message: string, info: { error: boolean }) => void;
}
export interface DesignControls {
  element: HTMLElement;
  /** Re-read the session, slide and selection. */
  refresh(): void;
  readonly scope: "deck" | "slide";
  setScope(scope: "deck" | "slide"): void;
  destroy(): void;
}
/** Mount the dimension, design-option, content-type, chart-type and table controls. Each control commits one undoable change through the session. */
export declare function createDesignControls(container: HTMLElement, options: DesignControlsOptions): DesignControls;
