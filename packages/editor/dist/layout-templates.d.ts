import type { EditorSession, EditorChange, JsonPatchOperation } from "./index.js";

export interface LayoutChoice { id: string; label: string; record?: Record<string, unknown> }
export interface LayoutIntentGroup { name: string; ids: readonly string[] }
export declare const LAYOUT_INTENT_GROUPS: readonly LayoutIntentGroup[];
export declare const LAYOUT_REGION_KINDS: readonly string[];
export declare const LAYOUT_REGION_ROLES: readonly string[];
export declare const LAYOUT_REGION_FLOWS: readonly string[];
export declare function groupLayoutChoices<T extends LayoutChoice>(choices: T[]): { name: string; choices: T[] }[];
export declare const LAYOUT_DIRECTIONS: readonly ("row" | "column")[];
export declare const LAYOUT_ANCHORS: readonly ("top" | "middle" | "bottom")[];
/** Region lists nest at most this deep: the record's own list is level 1, a split's list level 2, a split inside it level 3. */
export declare const LAYOUT_MAX_DEPTH: number;
/** A list of regions (the record's, or a split's) holds at most this many entries. */
export declare const LAYOUT_MAX_ENTRIES: number;
export type LayoutSize = number | "auto";
/** The rules of a body region; every one is optional (omitted `accepts`: every body content kind and `group`). */
export interface LayoutRegionRules {
  accepts?: string[];
  role?: string;
  flow?: string;
  max?: number;
  bleed?: boolean;
  listColumns?: "auto" | 1;
  anchor?: "top" | "middle" | "bottom";
  empty?: "collapse" | "keep";
}
/** A region (`name`, `size`, rules); `title` and `subtitle` are heading regions that take only a size. */
export interface LayoutRegionEntry extends LayoutRegionRules { name: string; size?: LayoutSize }
/** A split: its own `regions`, laid out in `direction`. */
export interface LayoutSplitEntry { direction: "row" | "column"; regions: (LayoutRegionEntry | LayoutSplitEntry)[]; size?: LayoutSize; anchor?: "top" | "middle" | "bottom" }
export interface RegionLayoutInput {
  id: string;
  name: string;
  summary?: string;
  /** How the record's `regions` are placed: side by side (`row`) or stacked (`column`, the default). */
  direction?: "row" | "column";
  /** Applies to every region under the record unless a split or a region sets its own. */
  anchor?: "top" | "middle" | "bottom";
  regions: (LayoutRegionEntry | LayoutSplitEntry)[];
  overflowRegion?: string;
}
export declare function layoutFromRegions(input: RegionLayoutInput): { id: string; record: Record<string, unknown> };
export declare function prepareCustomLayout(presentation: any, layout: { id: string; record: Record<string, unknown> }): { presentation: any; patches: JsonPatchOperation[]; id: string };
export declare function saveCustomLayout(editor: EditorSession, layout: { id: string; record: Record<string, unknown> }): EditorChange;
export declare function pinBlockToRegion(editor: EditorSession, slideIndex: number, blockIndex: number, region: string): EditorChange;

export declare function layoutRegionSummary(record: unknown): string;
