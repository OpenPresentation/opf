import type { EditorChange, EditorSession } from "./index.js";
import type { LayoutPath, LayoutRecord } from "./layout-tree.js";

export type { LayoutRecord, LayoutPath } from "./layout-tree.js";
export type LayoutEditorDensity = "comfortable" | "touch";
export type LayoutTool = "select" | "split-row" | "split-column" | "insert" | "heading" | "hand";

/** One finding of core's layout validation (`opf/layout-template`, `opf/layout-region`, or a schema finding). */
export interface LayoutFinding {
  ruleId: string;
  severity: "error" | "warning" | "info";
  message: string;
  /** The JSON Pointer inside the record, `/regions/1/regions/0/size`. */
  path: string;
  /** The region or split it points at (`[]`: the layout itself). */
  node: LayoutPath;
  /** The property it points at (`size`, `name`, `direction`, ...), or null. */
  field: string | null;
  /** Other nodes that are part of the problem: the earlier regions that share a name with the one it points at. */
  also?: LayoutPath[];
}

export interface LayoutModelEvent { type: "record" | "selection" | "tool" | "view" | "load" | "notice" | "rename"; source?: string; message?: string; model: LayoutModel }
export interface LayoutModelOptions {
  /** The record to edit (default: a title and one content region). */
  record?: LayoutRecord;
  density?: LayoutEditorDensity;
  readOnly?: boolean;
  /** Called with a copy of the record after each edit, undo and redo (not after `setRecord`). */
  onChange?(record: LayoutRecord): void;
  /** Undo steps kept (default 200). */
  historyLimit?: number;
}

/** The state the parts share: the record, the selection, the tool, validation, and the editor's own undo history. Every edit is a command. */
export interface LayoutModel {
  readonly record: LayoutRecord;
  readonly selection: LayoutPath[];
  readonly primary: LayoutPath | null;
  readonly tool: LayoutTool;
  readonly preview: boolean;
  readonly density: LayoutEditorDensity;
  readonly readOnly: boolean;
  readonly findings: LayoutFinding[];
  readonly notice: { message: string; kind: "info" | "error" } | null;
  subscribe(listener: (event: LayoutModelEvent) => void): () => void;
  setOnChange(callback: ((record: LayoutRecord) => void) | undefined): void;
  getRecord(): LayoutRecord;
  setRecord(record: LayoutRecord, options?: { keepHistory?: boolean }): void;
  select(paths: LayoutPath[]): boolean;
  selectAdd(path: LayoutPath): boolean;
  selectParent(): boolean;
  selectChild(): boolean;
  selectSibling(delta: number): boolean;
  setTool(tool: LayoutTool): boolean;
  setPreview(on: boolean): boolean;
  setDensity(density: LayoutEditorDensity): void;
  setReadOnly(on: boolean): void;
  notify(message: string, kind?: "info" | "error"): void;
  requestRename(path: LayoutPath | null, surface?: "canvas" | "layers"): void;
  splitRegion(path: LayoutPath, axis: "row" | "column"): boolean;
  insertRegion(listPath: LayoutPath, index: number, entry?: Record<string, unknown>): boolean;
  toggleHeading(name: "title" | "subtitle"): boolean;
  wrap(paths: LayoutPath[], axis: "row" | "column"): boolean;
  unwrap(path: LayoutPath): boolean;
  duplicate(paths: LayoutPath[]): boolean;
  remove(paths: LayoutPath[]): boolean;
  move(paths: LayoutPath[], listPath: LayoutPath, index: number): boolean;
  reorder(path: LayoutPath, delta: -1 | 1): boolean;
  moveInto(path: LayoutPath, delta: -1 | 1): boolean;
  setProperty(path: LayoutPath, key: string, value: unknown, options?: { coalesce?: string | null }): boolean;
  setLayoutProperty(key: string, value: unknown, options?: { coalesce?: string | null }): boolean;
  removeDesignHint(key: string): boolean;
  equalize(listPath: LayoutPath, index: number): boolean;
  nudge(listPath: LayoutPath, index: number, steps: number, big?: boolean): boolean;
  beginGesture(label: string): boolean;
  updateGesture(record: LayoutRecord, message?: string): void;
  endGesture(message?: string): boolean;
  cancelGesture(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): boolean;
  redo(): boolean;
  findingsFor(path: LayoutPath, field?: string): LayoutFinding[];
  findingsWithin(path: LayoutPath): LayoutFinding[];
  describe(path: LayoutPath): string;
  destroy(): void;
}
export declare function createLayoutModel(options?: LayoutModelOptions): LayoutModel;
export declare function blankLayoutRecord(): LayoutRecord;
/** The `$schema` of a layout record. */
export declare const LAYOUT_SCHEMA: string;
export declare const LAYOUT_TOOLS: readonly LayoutTool[];
/** Core's validation of a layout record (`opf/layout-template`, `opf/layout-region` and the schema). */
export declare function validateLayoutRecord(record: LayoutRecord): LayoutFinding[];
/** Where a finding's JSON Pointer points: the node path and the property. */
export declare function findingLocation(pointer: string): { node: LayoutPath; field: string | null };
/** `{ id, record }` for `saveCustomLayout`: the record without `$schema` and `id`. */
export declare function layoutForCatalog(record: LayoutRecord): { id: string; record: Record<string, unknown> };
/** A one-slide deck that uses the layout (embedded as a custom layout) with sample blocks pinned to every body region. */
export declare function sampleDeck(record: LayoutRecord): Record<string, unknown>;

export interface LayoutToolDef { id: string; label: string; key: string; icon: string; help: string }
export declare const LAYOUT_TOOL_DEFS: readonly LayoutToolDef[];
export declare const LAYOUT_PREVIEW_DEF: LayoutToolDef;

/** Options of every part: the shared `model`, or the model options to create one. */
interface LayoutPartOptions extends LayoutModelOptions {
  /** The shared model, so several parts edit the same record. */
  model?: LayoutModel;
}
export interface LayoutPartHandle {
  element: HTMLElement;
  model: LayoutModel;
  refresh(): void;
  destroy(): void;
}

export interface LayoutToolPaletteOptions extends LayoutPartOptions {
  orientation?: "vertical" | "horizontal";
  /** Accessible name of the toolbar (default "Layout tools"). */
  label?: string;
}
/** The tool palette: Select (V), Split into a row (R), Split into a column (C), Insert region (I), Heading regions (T), Hand (H) and Preview (P). */
export declare function createLayoutToolPalette(container: HTMLElement, options?: LayoutToolPaletteOptions): LayoutPartHandle;

export interface LayoutRenderOptions {
  /** The host's renderer: `toSvg` from `@openpresentation/opf-render/svg`. Preview draws a wireframe without it. */
  toSvg?(deck: Record<string, unknown>, slide: number, options?: Record<string, unknown>): string | Promise<string>;
  /** The renderer's fonts handle (`loadFonts()`), the same one the host's canvas and export use. */
  fonts?: unknown;
  /** Extra render options (`catalogs`, ...), or a function that returns them when Preview draws. */
  renderOptions?: Record<string, unknown> | (() => Record<string, unknown>);
}
export interface LayoutCanvasOptions extends LayoutPartOptions, LayoutRenderOptions {
  label?: string;
}
export interface LayoutCanvas extends LayoutPartHandle {
  setZoom(zoom: number): void;
  getZoom(): number;
  focus(): void;
}
/** The canvas: a 16:9 slide frame with the region tree as labeled boxes, dividers to resize, drag to reorder, a context menu and the keyboard. */
export declare function createLayoutCanvas(container: HTMLElement, options?: LayoutCanvasOptions): LayoutCanvas;

export interface LayoutTreeOptions extends LayoutPartOptions {
  label?: string;
  onFindingSelect?(finding: LayoutFinding): void;
}
export interface LayoutTree extends LayoutPartHandle {
  focus(): void;
  beginRename(path: LayoutPath): void;
}
/** The layers: the outline of splits and regions (role="tree") with the findings under it. */
export declare function createLayoutTree(container: HTMLElement, options?: LayoutTreeOptions): LayoutTree;

export interface LayoutInspector extends LayoutPartHandle {
  focus(): void;
}
/** The inspector: the layout, a split or a region as form fields. */
export declare function createLayoutInspector(container: HTMLElement, options?: LayoutPartOptions & { label?: string }): LayoutInspector;

export interface LayoutEditorOptions extends LayoutPartOptions, LayoutRenderOptions {
  label?: string;
  onFindingSelect?(finding: LayoutFinding): void;
}
export interface LayoutEditor {
  element: HTMLElement;
  model: LayoutModel;
  palette: LayoutPartHandle;
  canvas: LayoutCanvas;
  layers: LayoutTree;
  inspector: LayoutInspector;
  refresh(): void;
  destroy(): void;
  getRecord(): LayoutRecord;
  /** Replace the record (a layout the host loaded). Clears the selection and, unless `keepHistory`, the history. Does not call `onChange`. */
  setRecord(record: LayoutRecord, options?: { keepHistory?: boolean }): void;
  getFindings(): LayoutFinding[];
  getSelection(): LayoutPath[];
  select(path: LayoutPath | null): boolean;
  getTool(): LayoutTool;
  setTool(tool: LayoutTool): boolean;
  getPreview(): boolean;
  setPreview(on: boolean): boolean;
  setDensity(density: LayoutEditorDensity): void;
  setReadOnly(on: boolean): void;
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  subscribe(listener: (event: LayoutModelEvent) => void): () => void;
  /**
   * Write the record into `catalogs.custom.layouts` through `saveCustomLayout`, as one undoable edit. Refused while an error finding is open,
   * and for an id the deck already has unless `replace` is true.
   */
  saveToDeck(editor: EditorSession, options?: { replace?: boolean }): EditorChange & { layoutId: string };
  /** Save the layout (replacing the deck's copy of the same id) and make it the layout of slide `slideIndex`, in one undoable edit. */
  applyToSlide(editor: EditorSession, slideIndex: number, options?: { replace?: boolean; catalogs?: unknown }): EditorChange & { layoutId: string; slideIndex: number };
}
/**
 * The layout editor: the tool palette, canvas, layers and inspector around one shared model. Edits a layout record (`direction` plus an
 * ordered `regions` list of regions and splits), validates it live with core, and keeps its own undo history.
 */
export declare function createLayoutEditor(container: HTMLElement, options?: LayoutEditorOptions): LayoutEditor;

/** What a layout save returns: the editor change and the id of the saved layout. */
export type LayoutSaveChange = EditorChange & { layoutId: string };
/** Save the model's record into `catalogs.custom.layouts` as one undoable edit. For a host that arranges the parts itself; the composed editor's `saveToDeck` calls it. */
export declare function saveLayoutToDeck(editor: EditorSession, model: LayoutModel, options?: { replace?: boolean }): LayoutSaveChange;
/** Save the layout and make it the layout of a slide, in one undoable edit. The composed editor's `applyToSlide` calls it. */
export declare function applyLayoutToSlide(editor: EditorSession, model: LayoutModel, slideIndex: number, options?: { replace?: boolean; catalogs?: unknown }): LayoutSaveChange & { slideIndex: number };
