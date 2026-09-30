import type { EditorSession } from "./index.js";
import type { RenderSvgOptions } from "@openpresentation/opf-render";
import type { SlideComposition } from "@openpresentation/opf/composition";
/** Faces a document needs (script packages and vendored files) that are not loaded yet, and the way to load them. */
export interface FontGate {
  /** Synchronous. Empty means the document can render now. Never throws. */
  pending(document: unknown): string[];
  /** Load every pending face (vendored faces first, then script faces). Rejects with a `fonts-unavailable` error; never retries by itself. */
  ensure(document: unknown, options?: { signal?: AbortSignal }): Promise<void>;
  /** `whenFontsReady` on this gate. */
  run(document: unknown, handlers?: FontGateHandlers): Promise<void>;
}
export interface FontGateHandlers {
  /** Return false once the document was superseded; the late result is then dropped. */
  isCurrent?: () => boolean;
  loading?: (pending: string[]) => void;
  ready?: () => void;
  failed?: (error: Error) => void;
}
export declare const FONTS_PENDING: "fonts-pending";
export declare const FONTS_UNAVAILABLE: "fonts-unavailable";
/** Wrap a browser font registry (`loadBrowserFontRegistry`). Registries without the lazy loaders gate nothing. */
export declare function createFontGate(registry: object): FontGate;
/**
 * Ensure fonts for a document, then run `ready` (synchronously when nothing is pending). The one
 * "ensure fonts, then render" helper: load failures and exceptions from `ready` go to `failed`.
 */
export declare function whenFontsReady(
  gate: Pick<FontGate, "pending" | "ensure"> | undefined,
  document: unknown,
  handlers?: FontGateHandlers,
): Promise<void>;
export interface CanvasEditorOptions {
  editor?: EditorSession;
  document?: unknown;
  slideIndex?: number;
  /** Show keyboard-accessible dividers for resizing composition tracks. */
  layoutEditing?: boolean;
  renderOptions?: RenderSvgOptions;
  /**
   * A font gate (`createFontGate(registry)`). With one, the canvas never renders a document whose faces are still
   * loading: it shows "Loading fonts…", loads them and then renders, on every path (editor changes, undo/redo,
   * imports, dimension switches, slide changes, drafts). Without one every document renders at once.
   */
  fonts?: Pick<FontGate, "pending" | "ensure">;
  /**
   * How a pointer enters text editing. "click" (default): a single press on editable text starts editing with the caret at the
   * pressed character, and a press-drag selects a range. "dblclick": a click selects, a double-click enters with the caret at the
   * pointer. Keyboard entry (Enter, Space, F2) and `beginEdit(path)` always select all text. Non-text targets always open
   * their properties on double-click.
   */
  textEntry?: "click" | "dblclick";
  /** Optional empty host for property forms; defaults to a floating canvas panel. */
  propertiesContainer?: HTMLElement;
  onSelect?: (selection: {
    path: string;
    value: unknown;
    element: Element | undefined;
    editor: EditorSession;
  }) => void;
  onDraft?: (draft: {
    document: unknown;
    path: string;
    value: unknown;
  }) => void;
  onCommit?: (event: { path: string; editor: EditorSession }) => void;
  onCancel?: (event: { path?: string }) => void;
  onError?: (error: Error) => void;
  /** Font loading progress of the canvas: `loading`, `error` (a face could not be loaded; the canvas offers a retry) and `ready`. */
  onFonts?: (event: { state: "loading"; pending: string[] } | { state: "error"; error: Error } | { state: "ready" }) => void;
  onRender?: (event: {
    document: unknown;
    slideIndex: number;
    svg: SVGSVGElement;
    geometry: SlideComposition;
    draft: boolean;
  }) => void;
}
export interface CanvasEditor {
  editor: EditorSession;
  ready: Promise<void>;
  readonly slideIndex: number;
  readonly editingPath: string | null;
  readonly layoutEditing: boolean;
  setLayoutEditing(enabled: boolean): boolean;
  /** Open reorder and move-to-group controls for a complete block path. */
  openBlockMenu(path: string): void;
  /** Add starter content to a slide/group/region, converting implicit content when needed. */
  openInsertMenu(containerPath?: string,index?: number): void;
  select(path: string): void;
  /** Start editing with all text selected (keyboard entry). Pointer entry places the caret at the pointer instead. */
  beginEdit(path: string): void;
  /** Open structured controls, including rich run fields. */
  editProperties(path: string): boolean;
  commit(): boolean;
  cancel(): void;
  render(document?: unknown): void;
  setSlide(index: number): boolean;
  setRenderOptions(options: RenderSvgOptions): boolean;
  destroy(): void;
}
export declare function allocatedSelectionBox(
  node: {
    dataset?: DOMStringMap | Record<string, string>;
    hasAttribute?(name: string): boolean;
    getAttribute?(name: string): string | null;
    getBBox?(): { x: number; y: number; width: number; height: number };
  },
  item?: { box?: { x: number; y: number; width: number; height: number } },
): { x: number; y: number; width: number; height: number };
export declare function createCanvasEditor(
  container: HTMLElement,
  options: CanvasEditorOptions,
): CanvasEditor;
export declare function getEditableFields(
  value: unknown,
  path: string,
): {
  fields: { path: string; label: string; type: string; value: unknown }[];
  arrays: { path: string; label: string; length: number }[];
};
