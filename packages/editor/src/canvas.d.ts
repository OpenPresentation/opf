import type { EditorSession } from "./index.js";
import type { ToSvgOptions } from "@openpresentation/opf-render";
import type { BrowserFontsHandle } from "@openpresentation/opf-render/fonts-browser";
import type { SlideComposition } from "@openpresentation/opf/composition";
import type { Catalog } from "@openpresentation/opf";
/**
 * The fonts the canvas, the export and `whenFontsReady` take: the renderer's handle from `loadFonts()` (`@openpresentation/opf-render/fonts-browser`).
 * Only `textMeasurement` is required to measure; `pending` and `ensure` make the canvas load script and vendored faces before it draws.
 */
export type EditorFonts = Pick<BrowserFontsHandle, "textMeasurement"> & Partial<Pick<BrowserFontsHandle, "embeddedFonts" | "pending" | "ensure" | "registry">>;
export interface FontsReadyHandlers {
  /** Return false once the document was superseded; the late result is then dropped. */
  isCurrent?: () => boolean;
  loading?: (pending: string[]) => void;
  ready?: () => void;
  failed?: (error: Error) => void;
  /** The options the host renders with (`catalogs`, ...), passed to the fonts handle. */
  renderOptions?: ToSvgOptions;
}
export declare const FONTS_PENDING: "fonts-pending";
export declare const FONTS_UNAVAILABLE: "fonts-unavailable";
/**
 * Ensure fonts for a presentation, then run `ready` (synchronously when nothing is pending). The one
 * "ensure fonts, then render" helper: load failures and exceptions from `ready` go to `failed`. `fonts` is the renderer's fonts handle.
 */
export declare function whenFontsReady(
  fonts: Pick<EditorFonts, "pending" | "ensure"> | undefined,
  presentation: unknown,
  handlers?: FontsReadyHandlers,
): Promise<void>;
export interface CanvasEditorOptions {
  editor?: EditorSession;
  presentation?: unknown;
  /**
   * The host's catalogs (core `Catalog[]`, for example `[defaultCatalog]` from `@openpresentation/opf/catalog`) for the session the
   * canvas creates from `presentation`. With `editor`, register them on that session instead (`createEditorSession(doc, { catalogs })`);
   * `renderOptions.catalogs` adds catalogs for drawing only, merged after the session's.
   */
  catalogs?: readonly Catalog[];
  slideIndex?: number;
  /** Show keyboard-accessible dividers for resizing composition tracks. */
  layoutEditing?: boolean;
  /** Render options. The canvas draws the document as authored (`variables: false`: a template's `{{tokens}}` stay visible, so inline edits never overwrite them); pass `variables` to draw resolved values instead. */
  renderOptions?: ToSvgOptions;
  /**
   * The renderer's fonts handle (`loadFonts()` from `@openpresentation/opf-render/fonts-browser`). Its `textMeasurement` lays the slide out and
   * its faces draw it. With its `pending` and `ensure` the canvas never renders a document whose faces are still loading: it shows
   * "Loading fonts…", loads them and then renders, on every path (editor changes, undo/redo, imports, dimension switches, slide
   * changes, drafts). Without a handle every document renders at once, laid out with core's portable text estimate.
   */
  fonts?: EditorFonts;
  /**
   * How a pointer enters text editing. "click" (default): a single press on editable text starts editing with the caret at the
   * pressed character, and a press-drag selects a range. "dblclick": a click selects, a double-click enters with the caret at the
   * pointer. Keyboard entry (Enter, Space, F2) and `beginEdit(path)` always select all text. Non-text targets always open
   * their properties on double-click.
   */
  textEntry?: "click" | "dblclick";
  /** Picture tools (default true): a selected picture shows a "Crop picture" button that opens the crop and focal point layer. */
  imageTools?: boolean;
  /** Optional empty host for property forms; defaults to a floating canvas panel. */
  propertiesContainer?: HTMLElement;
  onSelect?: (selection: {
    path: string;
    value: unknown;
    element: Element | undefined;
    editor: EditorSession;
  }) => void;
  onDraft?: (draft: {
    presentation: unknown;
    path: string;
    value: unknown;
  }) => void;
  onCommit?: (event: { path: string; editor: EditorSession }) => void;
  onCancel?: (event: { path?: string }) => void;
  onError?: (error: Error) => void;
  /** Font loading progress of the canvas: `loading`, `error` (a face could not be loaded; the canvas offers a retry) and `ready`. */
  onFonts?: (event: { state: "loading"; pending: string[] } | { state: "error"; error: Error } | { state: "ready" }) => void;
  onRender?: (event: {
    presentation: unknown;
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
  /** True while the crop layer is open. */
  readonly cropping: boolean;
  /**
   * Open the crop layer for the picture at `path` (an image block or a slide's `image`); `tool: "focus"`
   * starts with the focal point. Apply writes one undoable change (see `@openpresentation/opf-editor/image-crop`). Resolves to whether it opened.
   */
  cropImage(path: string, options?: { tool?: "crop" | "focus" }): Promise<boolean>;
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
  render(presentation?: unknown): void;
  setSlide(index: number): boolean;
  /**
   * Select the content at `path`, or the closest enclosing content the canvas can select (a list item selects its list),
   * after showing the slide the path is on. Returns the selected path, or null when nothing is selectable there (speaker
   * notes, deck fields) or the slide is not drawn yet (fonts loading). Moves keyboard focus only with `focus: true`.
   */
  reveal(path: string, options?: { focus?: boolean }): string | null;
  setRenderOptions(options: ToSvgOptions): boolean;
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
