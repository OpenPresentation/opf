import type { ImageTarget, PromoteImageOptions } from "@openpresentation/opf/convert";
import type { PresentationPaginationOptions, PaginatedPage } from "@openpresentation/opf/pagination";
import type { EditorChange, EditorSession, JsonPatchOperation } from "./index.js";

export type { ImageTarget, PromoteImageOptions } from "@openpresentation/opf/convert";
export type SlidePages = readonly (PaginatedPage & { sourceSlideIndex: number })[];

/** What every prepare function returns without touching a session. A refusal throws `content-action-refused`. */
export interface PreparedContentAction {
  presentation: unknown;
  /** A `test` of what was read, then `replace`, or per-slide `remove` and `add`. Empty when nothing changed. */
  patches: JsonPatchOperation[];
  /** The path of the block or slide the change touched: select it again after applying. */
  path: string;
  changed: boolean;
  /** True when nothing is lost; otherwise `loss` names what the result cannot carry. */
  lossless: boolean;
  loss: string[];
  /** Why nothing changed (`changed` is false), when core can say. */
  reason?: string;
  /** List shifts: the nesting level of every item after the change. */
  levels?: number[];
  /** Slide edits: the old slides replaced (`deleteCount` from `start`) and how many slides replace them. */
  range?: { start: number; deleteCount: number };
  slideCount?: number;
  /** Split on overflow: the pagination mapping of the new slides, for `unpaginateSlides`. */
  pages?: (PaginatedPage & { sourceSlideIndex: number })[];
}
/** The session change of an applied action, with the same report fields. One undo step. */
export interface ContentActionChange extends Omit<EditorChange, "presentation" | "patches"> {
  presentation: unknown;
  patches: JsonPatchOperation[];
  changed: boolean;
  lossless: boolean;
  loss: string[];
  path: string;
  levels?: number[];
  reason?: string;
  range?: { start: number; deleteCount: number };
  slideCount?: number;
  pages?: (PaginatedPage & { sourceSlideIndex: number })[];
}

/** Every prepare function takes `validate: false` in its options for a dry run that skips the whole-document validation (the converted slide is still validated). Applying always validates. */
export interface DryRunOptions {
  validate?: boolean;
}

export interface ListShiftOptions extends DryRunOptions {
  /** Move the items nested under each selected item with it (default true). */
  withChildren?: boolean;
}

/** The index of the list item a selection points at (`slides.0.blocks.1.items.2.text` gives 2), or undefined. */
export declare function listItemIndexForSelection(selectedPath: string, blockPath: string): number | undefined;
export declare function prepareListShift(presentation: unknown, blockPath: string, indices: number[], delta: number, options?: ListShiftOptions): PreparedContentAction;
/** Nest (`delta` 1) or un-nest (`delta` -1) list items as one undoable step. */
export declare function shiftListItems(editor: EditorSession, blockPath: string, indices: number[], delta: number, options?: ListShiftOptions, meta?: Record<string, unknown>): ContentActionChange;

export declare function prepareGroupBlocks(presentation: unknown, containerPath: string, indices: number[], options?: DryRunOptions & { composition?: Record<string, unknown> }): PreparedContentAction;
export declare function prepareUngroupBlock(presentation: unknown, groupPath: string, options?: DryRunOptions): PreparedContentAction;
export declare function prepareBlocksToRegions(presentation: unknown, slideIndex: number, regions: string[], options?: DryRunOptions): PreparedContentAction;
export declare function prepareRegionsToBlocks(presentation: unknown, slideIndex: number, options?: DryRunOptions): PreparedContentAction;
export declare function prepareMoveRegion(presentation: unknown, slideIndex: number, from: string, to: string, options?: DryRunOptions & { swap?: boolean }): PreparedContentAction;
export declare function prepareImageToDesign(presentation: unknown, blockPath: string, target: ImageTarget, options?: DryRunOptions & PromoteImageOptions): PreparedContentAction;
export declare function prepareImageToContent(presentation: unknown, slideIndex: number, source: ImageTarget, options?: DryRunOptions & { index?: number; region?: string }): PreparedContentAction;

/** Wrap the blocks at `indices` of a slide, group or region group in a new group. */
export declare function groupBlocks(editor: EditorSession, containerPath: string, indices: number[], options?: { composition?: Record<string, unknown> }, meta?: Record<string, unknown>): ContentActionChange;
/** Replace a group by its blocks; its composition and id are reported in `loss`. */
export declare function ungroupBlock(editor: EditorSession, groupPath: string, meta?: Record<string, unknown>): ContentActionChange;
export declare function placeBlocksInRegions(editor: EditorSession, slideIndex: number, regions: string[], meta?: Record<string, unknown>): ContentActionChange;
export declare function regionsAsBlocks(editor: EditorSession, slideIndex: number, meta?: Record<string, unknown>): ContentActionChange;
export declare function moveSlideRegion(editor: EditorSession, slideIndex: number, from: string, to: string, options?: { swap?: boolean }, meta?: Record<string, unknown>): ContentActionChange;
/** Move an image block into the slide's design as its slide image, background or watermark. */
export declare function moveImageToDesign(editor: EditorSession, blockPath: string, target: ImageTarget, options?: PromoteImageOptions, meta?: Record<string, unknown>): ContentActionChange;
/** Move a slide's own slide image, background image or watermark back into its content as an image block. */
export declare function moveImageToContent(editor: EditorSession, slideIndex: number, source: ImageTarget, options?: { index?: number; region?: string }, meta?: Record<string, unknown>): ContentActionChange;

export declare function prepareSplitSlide(presentation: unknown, slideIndex: number, options?: { at?: number[]; each?: boolean; repeatHeadings?: boolean }): PreparedContentAction;
export declare function prepareSplitSlideOnOverflow(presentation: unknown, slideIndex: number, options?: PresentationPaginationOptions): PreparedContentAction;
export declare function prepareMergeSlides(presentation: unknown, start: number, count?: number): PreparedContentAction;
export declare function prepareUnpaginate(presentation: unknown, pages: SlidePages, options?: { sourceSlideIndex?: number }): PreparedContentAction;
/** Split a slide by its blocks into several slides, as one undoable step. */
export declare function splitSlideByBlocks(editor: EditorSession, slideIndex: number, options?: { at?: number[]; each?: boolean; repeatHeadings?: boolean }, meta?: Record<string, unknown>): ContentActionChange;
/** Split a slide that overflows with the existing pagination; the change carries `pages` for `unpaginateSlides`. */
export declare function splitSlideOnOverflow(editor: EditorSession, slideIndex: number, options?: PresentationPaginationOptions, meta?: Record<string, unknown>): ContentActionChange;
/** Merge consecutive slides into one. The first slide's id, headings and design win; what is dropped is reported in `loss`. */
export declare function mergeSlides(editor: EditorSession, start: number, count?: number, meta?: Record<string, unknown>): ContentActionChange;
/** Put paginated continuation slides back together, given the `pages` mapping of the pagination. */
export declare function unpaginateSlides(editor: EditorSession, pages: SlidePages, options?: { sourceSlideIndex?: number }, meta?: Record<string, unknown>): ContentActionChange;
