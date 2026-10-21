import type { LayoutRegionEntry, LayoutSplitEntry } from "./layout-templates.js";

/** A layout record as the editor edits it: `id`, `name`, `direction`, `anchor`, the ordered `regions` list, and whatever else the record carries. */
export interface LayoutRecord {
  $schema?: string;
  id?: string;
  name?: string;
  summary?: string;
  direction?: "row" | "column";
  anchor?: "top" | "middle" | "bottom";
  regions: (LayoutRegionEntry | LayoutSplitEntry)[];
  overflowRegion?: string;
  design?: Record<string, unknown>;
  composition?: Record<string, unknown>;
  [key: string]: unknown;
}
/** A region or split. */
export type LayoutNode = LayoutRegionEntry | LayoutSplitEntry;
/** Indexes from the record's own list down: `[]` is the record, `[1, 0]` is `regions[1].regions[0]`. */
export type LayoutPath = number[];
/** The result of an operation: a new record, and the paths to select afterwards (`null`: keep the selection). */
export interface LayoutEdit { record: LayoutRecord; selection: LayoutPath[] | null }

/** Thrown by an operation that refuses an edit; `message` says why. The record is never changed. */
export declare class LayoutOperationError extends Error { code: string }
export declare const HEADING_NAMES: readonly ["title", "subtitle"];
export declare const REGION_KEYS: readonly string[];

export declare const isSplit: (entry: unknown) => entry is LayoutSplitEntry;
export declare const isRegion: (entry: unknown) => entry is LayoutRegionEntry;
export declare const isHeading: (entry: unknown) => boolean;
export declare function clone<T>(value: T): T;
export declare function samePath(a: readonly number[], b: readonly number[]): boolean;
export declare function isPrefix(prefix: readonly number[], path: readonly number[]): boolean;
export declare function pathKey(path: readonly number[]): string;
export declare function listAt(record: LayoutRecord, path: readonly number[]): LayoutNode[] | undefined;
export declare function nodeAt(record: LayoutRecord, path: readonly number[]): LayoutNode | undefined;
/** How the list that holds the node at `path` lays its entries out. */
export declare function parentDirection(record: LayoutRecord, path: readonly number[]): "row" | "column";
export declare function listDirection(record: LayoutRecord, listPath: readonly number[]): "row" | "column";
/** The levels a node adds below its own list: 0 for a region, 1 plus the deepest child for a split. */
export declare function height(entry: LayoutNode): number;
export declare function nodes(record: LayoutRecord): { entry: LayoutNode; path: LayoutPath; listPath: LayoutPath; index: number; depth: number }[];
export declare function regionNames(record: LayoutRecord): string[];
export declare function pathOfName(record: LayoutRecord, name: string): LayoutPath | undefined;
/** The size an entry has: its own, else `auto` for a heading in a column, else 1. */
export declare function effectiveSize(entry: LayoutNode, direction: "row" | "column"): number | "auto";
export declare function parseSize(value: unknown): number | "auto" | undefined;
/** The anchor a node inherits from a split above it or the record (never its own). */
export declare function inheritedAnchor(record: LayoutRecord, path: readonly number[]): { value: "top" | "middle" | "bottom" | undefined; from: "split" | "layout" | "default" };

/** Split the region at `path` along `axis`; the original keeps its name and rules, the new region is `region-N`. */
export declare function splitRegion(record: LayoutRecord, path: readonly number[], axis: "row" | "column"): LayoutEdit;
/** Insert a new region into the list at `listPath`, before `index`. */
export declare function insertRegion(record: LayoutRecord, listPath: readonly number[], index: number, entry?: LayoutNode): LayoutEdit;
/** Add or remove the `title` or `subtitle` heading region. Removing a title removes the subtitle too. */
export declare function toggleHeading(record: LayoutRecord, name: "title" | "subtitle"): LayoutEdit;
/** Wrap sibling nodes in one new split. */
export declare function wrapNodes(record: LayoutRecord, paths: readonly (readonly number[])[], axis: "row" | "column"): LayoutEdit;
/** Replace a split with its children. */
export declare function unwrapNode(record: LayoutRecord, path: readonly number[]): LayoutEdit;
/** Remove nodes; a split left with one child collapses into it. */
export declare function deleteNodes(record: LayoutRecord, paths: readonly (readonly number[])[]): LayoutEdit;
export declare function duplicateNodes(record: LayoutRecord, paths: readonly (readonly number[])[]): LayoutEdit;
/** Move nodes into the list at `targetListPath`, to position `index` of that list. */
export declare function moveNodes(record: LayoutRecord, paths: readonly (readonly number[])[], targetListPath: readonly number[], index: number): LayoutEdit;
/** Move a node one place earlier (-1) or later (1); at the end of a split it leaves the split. */
export declare function reorderNode(record: LayoutRecord, path: readonly number[], delta: -1 | 1): LayoutEdit;
/** Move a node into the neighboring split. */
export declare function moveIntoSibling(record: LayoutRecord, path: readonly number[], delta: -1 | 1): LayoutEdit;
/** Set or (with `undefined`) remove a property of the region or split at `path`. */
export declare function setProperty(record: LayoutRecord, path: readonly number[], key: string, value: unknown): LayoutEdit;
export declare function setLayoutProperty(record: LayoutRecord, key: "id" | "name" | "summary" | "direction" | "anchor" | "overflowRegion" | "design", value: unknown): LayoutEdit;
export declare function removeDesignHint(record: LayoutRecord, key: string): LayoutEdit;
/** The sizes of siblings `index` and `index + 1` when their divider sits at `fraction` of their joint length. Null for a pair with an `auto` side. */
export declare function resizeSizes(record: LayoutRecord, listPath: readonly number[], index: number, fraction: number, options?: { free?: boolean }): { a: number; b: number; label: string } | null;
export declare function setPairSizes(record: LayoutRecord, listPath: readonly number[], index: number, a: number, b: number): LayoutEdit;
export declare function equalizePair(record: LayoutRecord, listPath: readonly number[], index: number): LayoutEdit;
export declare function nudgePair(record: LayoutRecord, listPath: readonly number[], index: number, steps: number, big?: boolean): LayoutEdit;
export declare function ratioLabel(a: number, b: number): string;

export interface LayoutBox { x: number; y: number; w: number; h: number }
export interface LayoutNodeBox extends LayoutBox { path: LayoutPath; entry: LayoutNode; kind: "region" | "split"; depth: number; direction: "row" | "column" }
export interface LayoutDividerBox extends LayoutBox { listPath: LayoutPath; index: number; direction: "row" | "column"; draggable: boolean; depth: number; pairStart: number; pairLength: number; a: number | "auto"; b: number | "auto" }
export interface LayoutSlotBox extends LayoutBox { listPath: LayoutPath; index: number; direction: "row" | "column"; depth: number }
/** Place the tree in a unit box: a box per region and split, the dividers between siblings, the places a region can be inserted, and the band of the implicit title. */
export declare function layoutBoxes(record: LayoutRecord, options?: { aspect?: number; gap?: number; autoShare?: number }): { nodes: LayoutNodeBox[]; dividers: LayoutDividerBox[]; slots: LayoutSlotBox[]; implicitTitle: LayoutBox | null };
