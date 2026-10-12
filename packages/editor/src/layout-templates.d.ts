import type { EditorSession, EditorChange, JsonPatchOperation } from "./index.js";

export interface LayoutChoice { id: string; label: string; record?: Record<string, unknown> }
export interface LayoutIntentGroup { name: string; ids: readonly string[] }
export declare const LAYOUT_INTENT_GROUPS: readonly LayoutIntentGroup[];
export declare const LAYOUT_REGION_KINDS: readonly string[];
export declare const LAYOUT_REGION_ROLES: readonly string[];
export declare const LAYOUT_REGION_FLOWS: readonly string[];
export declare function groupLayoutChoices<T extends LayoutChoice>(choices: T[]): { name: string; choices: T[] }[];
export interface GridLayoutInput {
  id: string;
  name: string;
  summary?: string;
  cells: string[][];
  regions: Record<string, { accepts: string[]; role?: string; flow?: string }>;
  columns?: number[];
  rows?: (number | "auto")[];
}
export declare function layoutFromGrid(input: GridLayoutInput): { id: string; record: Record<string, unknown> };
export declare function prepareCustomLayout(presentation: any, layout: { id: string; record: Record<string, unknown> }): { presentation: any; patches: JsonPatchOperation[]; id: string };
export declare function saveCustomLayout(editor: EditorSession, layout: { id: string; record: Record<string, unknown> }): EditorChange;
export declare function pinBlockToRegion(editor: EditorSession, slideIndex: number, blockIndex: number, region: string): EditorChange;

export declare function layoutRegionSummary(record: unknown): string;
