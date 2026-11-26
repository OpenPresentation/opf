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

/** The trends a metric can show: `Metric.trend`. */
export declare const METRIC_TRENDS: readonly ["up", "down", "flat"];
export type MetricTrendName = (typeof METRIC_TRENDS)[number];
/** A metric block's trend for a form (LH-123): the metric's own path, its trend (undefined when it has none) and whether the metric is a bare value. */
export interface MetricTrendState { path: string; trend?: MetricTrendName; scalar: boolean }
/** The trend of the metric block at `blockPath`, or undefined when the block is not a metric. */
export declare function readMetricTrend(presentation: unknown, blockPath: string): MetricTrendState | undefined;
/** The patch that sets a metric's trend (`up`, `down`, `flat`) or removes it with `null`; a bare value becomes `{ value, trend }`. Throws `content-action-refused` for a block that is not a metric and `invalid-metric-trend` for another value. */
export declare function prepareMetricTrend(presentation: unknown, blockPath: string, trend: MetricTrendName | null): PreparedContentAction & { trend: MetricTrendName | null };
/** Set or remove a metric's trend as one undoable step. */
export declare function setMetricTrend(editor: EditorSession, blockPath: string, trend: MetricTrendName | null, meta?: Record<string, unknown>): ContentActionChange & { trend: MetricTrendName | null };

/** The aggregates a metric's data link takes: `DataLink.aggregate`. */
export declare const METRIC_AGGREGATES: readonly ["sum", "mean", "min", "max", "count", "first", "last"];
/** The directions of change that can be good news: `Metric.better`. */
export declare const METRIC_BETTER: readonly ["up", "down"];
/** The comparisons of a metric's change: none, the previous row, a baseline filter, a fixed number, a column that holds the change. */
export declare const METRIC_CHANGES: readonly ["none", "previous", "baseline", "value", "column"];
export type MetricChangeKind = (typeof METRIC_CHANGES)[number];
/** One dataset of the deck for a Data section: its columns, the `measure` columns first. */
export interface MetricDatasetOption { id: string; title?: string; columns: { name: string; type?: string; role?: string; format?: string }[] }
/** A metric block's data for a form (FR-06). */
export interface MetricDataState {
  /** The metric's own path. */
  path: string;
  /** Whether the metric is a bare value (linking it makes it `{ value, data }`). */
  scalar: boolean;
  link?: Record<string, unknown>;
  better?: "up" | "down";
  format?: string;
  /** FR-07, part 3: the metric's gauge as written, when it has one. */
  gauge?: { min?: number; max: number; bands?: { to: number; label?: string; color?: string }[]; target?: number };
  /** The number the metric shows (computed or written), when it is one. */
  number?: number;
  datasets: MetricDatasetOption[];
  /** Whether the link computes: the computed numbers are what is drawn. */
  resolved: boolean;
  /** The value and the change as drawn, when the link resolves. */
  value?: { text: string; number?: number; format?: string; isNumber: boolean; computed: boolean };
  delta?: { text: string; number?: number; computed: boolean };
  /** The written numbers that differ from the computed ones, each with the fix that writes the computed number. */
  stale: { field: "value" | "delta"; message: string; fix?: { title: string; patch: JsonPatchOperation[] } }[];
  diagnostics: { code: string; severity: "error" | "warning"; path: string; message: string }[];
}
export interface MetricDataChange { data?: Record<string, unknown> | null; better?: "up" | "down" | null; format?: string | null; gauge?: { min?: number; max: number; bands?: { to: number; label?: string; color?: string }[]; target?: number } | null }
/** FR-07, part 3: the gauge the editor turns on for a value: min 0 and max the next round number above it (1 for a value from 0 to 1). */
export declare function defaultMetricGauge(value: number | undefined): { max: number };
/** The datasets of a deck, for a Data section. */
export declare function metricDatasets(presentation: unknown): MetricDatasetOption[];
/** The kind of change a link computes. */
export declare function metricChangeKind(link: unknown): MetricChangeKind;
/** What the metric block at `blockPath` reads from data, or undefined when the block is not a metric. */
export declare function readMetricData(presentation: unknown, blockPath: string, options?: { language?: string }): MetricDataState | undefined;
/** The patches that set a metric's `data`, `better` and `format` (`null` removes one). Throws `content-action-refused` for a block that is not a metric. */
export declare function prepareMetricData(presentation: unknown, blockPath: string, change: MetricDataChange): PreparedContentAction;
/** Set or remove a metric's `data`, `better` and `format` as one undoable step. */
export declare function setMetricData(editor: EditorSession, blockPath: string, change: MetricDataChange, meta?: Record<string, unknown>): ContentActionChange;
/** The patches that write the computed numbers into the metric's written `value` and `delta`. */
export declare function prepareMetricUpdate(presentation: unknown, blockPath: string): PreparedContentAction;
/** Write the computed numbers into the metric's written `value` and `delta` as one undoable step. */
export declare function updateMetricData(editor: EditorSession, blockPath: string, meta?: Record<string, unknown>): ContentActionChange;

export declare function prepareGroupBlocks(presentation: unknown, containerPath: string, indices: number[], options?: DryRunOptions & { composition?: Record<string, unknown> }): PreparedContentAction;
export declare function prepareUngroupBlock(presentation: unknown, groupPath: string, options?: DryRunOptions): PreparedContentAction;
export declare function prepareBlocksToRegions(presentation: unknown, slideIndex: number, regions: string[], options?: DryRunOptions): PreparedContentAction;
export declare function prepareRegionsToBlocks(presentation: unknown, slideIndex: number, options?: DryRunOptions): PreparedContentAction;
export declare function prepareMoveRegion(presentation: unknown, slideIndex: number, from: string, to: string, options?: DryRunOptions & { swap?: boolean }): PreparedContentAction;
export declare function prepareImageToDesign(presentation: unknown, blockPath: string, target: ImageTarget, options?: DryRunOptions & PromoteImageOptions): PreparedContentAction;
export declare function prepareImageToContent(presentation: unknown, slideIndex: number, source: ImageTarget, options?: DryRunOptions & { index?: number; region?: string }): PreparedContentAction;

/** Wrap the blocks at `indices` of a slide or group in a new group. */
export declare function groupBlocks(editor: EditorSession, containerPath: string, indices: number[], options?: { composition?: Record<string, unknown> }, meta?: Record<string, unknown>): ContentActionChange;
/** Replace a group by its blocks; its composition and id are reported in `loss`. */
export declare function ungroupBlock(editor: EditorSession, groupPath: string, meta?: Record<string, unknown>): ContentActionChange;
export declare function placeBlocksInRegions(editor: EditorSession, slideIndex: number, regions: string[], meta?: Record<string, unknown>): ContentActionChange;
export declare function regionsAsBlocks(editor: EditorSession, slideIndex: number, meta?: Record<string, unknown>): ContentActionChange;
export declare function moveSlideRegion(editor: EditorSession, slideIndex: number, from: string, to: string, options?: { swap?: boolean }, meta?: Record<string, unknown>): ContentActionChange;
/** Move an image block into the slide's design as its background or watermark. */
export declare function moveImageToDesign(editor: EditorSession, blockPath: string, target: ImageTarget, options?: PromoteImageOptions, meta?: Record<string, unknown>): ContentActionChange;
/** Move a slide's own background image or watermark back into its content as an image block. */
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
