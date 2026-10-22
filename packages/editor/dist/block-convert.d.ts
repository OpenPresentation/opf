import type { ConvertOptions } from "@openpresentation/opf/convert";
import type { EditorChange, EditorSession, JsonPatchOperation } from "./index.js";

export type { ConvertOptions } from "@openpresentation/opf/convert";

export type BlockKind = "text" | "list" | "quote" | "metric" | "code" | "timeline" | "chart" | "table" | "image" | "video" | "group" | "metrics";
/** Display label of every content kind. */
export declare const BLOCK_KIND_LABELS: Readonly<Record<BlockKind, string>>;
/** Source kind to the kinds it can convert to (core's `CONTENT_CONVERSIONS`): text to list, quote, metric, code, timeline or table; list to text, timeline or table; quote, metric and code to text; timeline to text, list or table; chart to table; table to chart, list, timeline, text or a set of metric blocks; a group of metric blocks to a table. */
export declare const BLOCK_CONVERSIONS: Readonly<Record<string, readonly BlockKind[]>>;

export interface BlockContent {
  path: string[];
  /** True for a `blocks/N` block, false for a slide or region holding one content field. */
  explicit: boolean;
  owner: Record<string, unknown>;
  /** The content field: text, items, bullets, chart, table, and so on. */
  key: string;
  /** The content kind (`items` and `bullets` are both "list"). */
  kind: BlockKind;
  content: unknown;
}
export interface BlockConversionTarget {
  kind: BlockKind;
  label: string;
  available: boolean;
  /** True when everything in the block carries over. */
  lossless: boolean;
  /** What the target cannot carry, for example "text formatting", "list nesting levels", "chart type". */
  loss: string[];
  /** Why the conversion is unavailable (available is false). */
  reason?: string;
}
export interface PreparedBlockConversion {
  presentation: unknown;
  patches: JsonPatchOperation[];
  path: string;
  changed: boolean;
  lossless: boolean;
  loss: string[];
  from: BlockKind;
  to: BlockKind;
}
export interface BlockConversionChange extends Omit<EditorChange, "presentation" | "patches"> {
  presentation: unknown;
  patches: JsonPatchOperation[];
  lossless: boolean;
  loss: string[];
  from: BlockKind;
  to: BlockKind;
  path: string;
  changed: boolean;
}

/** The single content payload of the block at `path`, or undefined (image-only, groups and blocks with several fields have none to convert). */
export declare function readBlockContent(presentation: unknown, path: string | string[]): BlockContent | undefined;
/** The block that contains a selected path (slides.0.blocks.1.text maps to slides.0.blocks.1), or undefined. */
export declare function blockPathForSelection(presentation: unknown, selectedPath: string): string | undefined;
/** The kinds the block can convert to, each with its loss report or the reason it is unavailable. */
export declare function blockConversionTargets(presentation: unknown, path: string | string[]): BlockConversionTarget[];
/** Compute the conversion patch without touching a session. Throws `block-not-convertible` for an unsupported pair or content that does not fit. */
export declare function prepareBlockConversion(presentation: unknown, path: string | string[], kind: BlockKind, options?: ConvertOptions): PreparedBlockConversion;
/** Convert one block as a single undoable transaction. */
export declare function convertBlock(editor: EditorSession, path: string | string[], kind: BlockKind, meta?: Record<string, unknown>, options?: ConvertOptions): BlockConversionChange;
