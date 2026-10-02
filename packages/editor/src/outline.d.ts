import type { EditorChange, EditorSession, JsonPatchOperation } from "./index.js";
import type { PreparedSlideChange } from "./slides.js";

export type OutlineRowKind = "slide" | "subtitle" | "text" | "item" | "other";
export interface OutlineRow {
  /** Stable for a row across edits that do not move it (`kind:path`), for focus and keys. */
  key: string;
  kind: OutlineRowKind;
  slideIndex: number;
  /** 0 for a slide title; 1 for its text; 1 plus the nesting level for a list item. */
  level: number;
  /** The plain text (formatted text is flattened for display). */
  text: string;
  /** The document path of the text value (an `other` row: of the content). */
  path: string;
  /** False for formatted text and for content that is not text. */
  editable: boolean;
  /** item: the list (`slides.0.items`) and the item's index in it. */
  listPath?: string;
  itemIndex?: number;
  /** other: the content kind ("Chart", "Table", ...). */
  label?: string;
  /** slide: whether the slide is hidden, its section and id. */
  hidden?: boolean;
  section?: string;
  id?: string;
}
export interface Outline { rows: OutlineRow[] }

/** An outline change: the slide patch report plus the key of the row to focus afterwards. */
export interface PreparedOutlineChange extends Omit<PreparedSlideChange, "selection"> {
  selection: number[];
  /** The `key` of the row to focus after the change. */
  focus?: string;
  reason?: string;
  newSlideIndex?: number;
}
export type OutlineChange = Omit<EditorChange, "document" | "patches"> & Omit<PreparedOutlineChange, "document" | "patches"> & { document: unknown; patches: JsonPatchOperation[] };

export declare function readOutline(document: unknown): Outline;
export declare function prepareSetOutlineText(document: unknown, row: OutlineRow, text: string): PreparedOutlineChange;
export declare function setOutlineText(editor: EditorSession, row: OutlineRow, text: string, meta?: Record<string, unknown>): OutlineChange;
/** Nest (`delta` 1) or un-nest (-1) a list item with the items under it. A top-level item reports `changed: false` and a `reason`. */
export declare function prepareShiftOutlineItem(document: unknown, row: OutlineRow, delta: 1 | -1): PreparedOutlineChange;
export declare function prepareMoveOutlineItem(document: unknown, row: OutlineRow, delta: 1 | -1): PreparedOutlineChange;
export declare function prepareInsertOutlineItem(document: unknown, row: OutlineRow, text?: string): PreparedOutlineChange;
export declare function prepareAddOutlineBullet(document: unknown, slideIndex: number, text?: string): PreparedOutlineChange;
export declare function prepareRemoveOutlineItem(document: unknown, row: OutlineRow): PreparedOutlineChange;
/** A top-level list item becomes the title of a new slide that takes the items after it. */
export declare function prepareOutlinePromote(document: unknown, row: OutlineRow): PreparedOutlineChange;
/** A plain slide becomes a bullet (with its text nested) of the slide before it. Throws `outline-row-not-supported` rather than dropping content. */
export declare function prepareOutlineDemoteSlide(document: unknown, slideIndex: number): PreparedOutlineChange;
export declare function prepareMoveOutlineSlide(document: unknown, slideIndex: number, delta: number): PreparedOutlineChange;
export declare function prepareInsertOutlineSlide(document: unknown, slideIndex: number): PreparedOutlineChange;
/** Apply any prepared outline change as one undoable step. */
export declare function applyOutlineChange(editor: EditorSession, prepared: PreparedOutlineChange | PreparedSlideChange, meta?: Record<string, unknown>): OutlineChange;
