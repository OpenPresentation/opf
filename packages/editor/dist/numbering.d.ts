import type { EditorSession } from "./index.js";

export type NumberingStyleName = "arabic" | "roman-upper" | "roman-lower" | "alpha-upper" | "alpha-lower";
export type NumberingSuffixName = "period" | "paren" | "paren-both";
/** One list level's numbering with every default applied. */
export interface NumberingLevel { style: NumberingStyleName; start: number; suffix: NumberingSuffixName }
/** The `numbering` field: a style name, an object (every level) or an array with one entry per level. */
export type NumberingValue = NumberingStyleName | Partial<NumberingLevel> | readonly (NumberingStyleName | Partial<NumberingLevel>)[];

export declare const NUMBERING_STYLE_OPTIONS: readonly { value: NumberingStyleName; label: string; sample: string }[];
export declare const NUMBERING_SUFFIX_OPTIONS: readonly { value: NumberingSuffixName; label: string; sample: string }[];
export declare const MAX_NUMBERING_LEVELS: 9;
export declare const MAX_NUMBERING_START: 32767;

/** True when the core this editor runs on composes numbered lists. */
export declare function numberingAvailable(): boolean;

export interface ListPayloadLocation {
  /** The payload that owns the list ("" for a document-level path is not possible; a slide, region or block). */
  payloadPath: string;
  field: "items" | "bullets";
  /** Path of the list array itself. */
  path: string;
  payload: Record<string, unknown>;
  /** The entry index when the path points at or into an entry. */
  entry?: number;
}
/** Where a list lives for a path that points at it or into it (`slides.0.items`, `slides.0.items.2`, `slides.0.left.items.1.text`). */
export declare function listPayloadAt(document: unknown, path: string): ListPayloadLocation | undefined;

export interface NumberableList { path: string; payloadPath: string; field: "items" | "bullets"; label: string; count: number; numbered: boolean }
/** Every list of a slide: path, label, entry count and whether it is numbered. */
export declare function findNumberableLists(document: unknown, slideIndex: number): NumberableList[];

/** The shortest `numbering` value for per-level settings (a style name, an object of the non-default fields, or an array). */
export declare function numberingValue(levels: readonly Partial<NumberingLevel>[]): NumberingValue;

export interface NumberingMarker { index: number; level: number; text: string; value: number; adapted?: "roman-range" }
export interface NumberingState {
  path: string;
  payloadPath: string;
  field: "items" | "bullets";
  count: number;
  numbered: boolean;
  /** True when the levels differ (an array in the document). */
  perLevel: boolean;
  /** One entry when the numbering applies to every level, else one per authored level. */
  levels: NumberingLevel[];
  /** Levels the list uses (deepest entry level + 1, at most 9). */
  depth: number;
  value?: NumberingValue;
  /** The markers the list draws, one per entry (empty when not numbered). */
  markers: NumberingMarker[];
  /** The entry the path selects, with its own `start` and the marker it draws. */
  entry?: { index: number; start?: number; marker?: string };
}
export declare function numberingState(document: unknown, path: string): NumberingState | undefined;

/** Number a list, change its numbering, or (with `undefined` or `null`) turn it off, as one undoable validated edit. Turning it off also removes the entry `start` values. */
export declare function setNumbering(editor: EditorSession, path: string, value: NumberingValue | undefined | null, meta?: Record<string, unknown>): unknown;
/** Restart the numbering at an entry (`undefined` or `null` removes the restart), as one undoable validated edit. */
export declare function setEntryStart(editor: EditorSession, itemPath: string, start: number | undefined | null, meta?: Record<string, unknown>): unknown;
