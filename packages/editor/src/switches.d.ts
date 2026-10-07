import type { ConvertOptions } from "@openpresentation/opf/convert";
import type { EditorChange, EditorSession, JsonPatchOperation } from "./index.js";

/** The schema's DimensionPreset values: the values of the slide-sizes switch. */
export declare const SLIDE_SIZE_PRESETS: readonly ["16:9", "4:3", "16:10", "1:1", "4:5", "9:16", "letter", "a4", "widescreen", "standard"];
export type SlideSizePreset = (typeof SLIDE_SIZE_PRESETS)[number];

/** Every switchable dimension: the 14 pptx.gallery dimensions, then `slide-sizes` and `purposes`. */
export declare const SWITCH_DIMENSIONS: readonly [
  "layouts",
  "color-schemes",
  "font-schemes",
  "languages",
  "backgrounds",
  "narratives",
  "charts",
  "themes",
  "audiences",
  "tones",
  "socials",
  "headers-footers",
  "blocks",
  "image-treatments",
  "slide-sizes",
  "purposes",
];
export type SwitchDimension = (typeof SWITCH_DIMENSIONS)[number];

export interface DimensionSwitchOptions {
  /** Required for layouts and charts; for design dimensions it scopes the switch to one slide (default: the deck). */
  slideIndex?: number;
  /** blocks: the complete block (`slides.0.blocks.1`) or one-payload slide/region to replace. charts: the block holding the chart (default: the slide's first chart). */
  path?: string | string[];
  /** A gallery item's catalog record, added inline in the same transaction when the id is not already defined. */
  record?: Record<string, unknown> & { id: string };
  /** Extra caller-loaded catalog records by kind. */
  catalogs?: Record<string, unknown>;
  catalogSources?: Record<string, unknown>;
  /** themes: also write the theme's color scheme, font scheme and background (and, for the deck, dimensions) to the design (default true). A slide's design cannot set dimensions. */
  bundle?: boolean;
  /** Deck-scope design switches: remove slide-level values that would hide the switch. */
  clearSlideOverrides?: boolean;
  /** socials: which document field holds the handle (default "speaker") and, for an array, which entry (default 0). */
  owner?: "speaker" | "organization";
  index?: number;
  /** blocks: media source for the image and video kinds. */
  source?: string;
  /** blocks: convert the block's own content to the new kind (text, list, quote, metric, code, timeline, chart, table and a group of metrics; see block-convert) instead of replacing it. */
  convert?: boolean;
  /** blocks with `convert`: core's conversion options (`looseWhen`, `fences`, `headings`, `columns`, `delimiter`, `header`). */
  conversion?: ConvertOptions;
  /** Session change metadata (switchDimension only). */
  meta?: Record<string, unknown>;
}

export type DimensionSwitchValue =
  | null /* backgrounds: remove it */
  | string /* slide-sizes: a SlideSizePreset. purposes: a catalog id or free-form goal text. */
  | string[] /* audiences: catalog ids */
  | { platform: string; handle: string }
  | { header?: unknown; footer?: unknown }
  | { slideImage?: unknown; imageFill?: string | null }
  | Record<string, unknown>;

export interface PreparedDimensionSwitch {
  dimension: SwitchDimension;
  scope: "deck" | "slide" | "block";
  slideIndex?: number;
  presentation: unknown;
  patches: JsonPatchOperation[];
  changed: boolean;
  /** Slides whose own design hides a deck-level switch. */
  shadowed: number[];
  /** blocks with `convert`: what the new kind cannot carry. */
  loss?: string[];
}

export interface DimensionSwitchChange extends Omit<EditorChange, "presentation" | "patches"> {
  presentation: unknown;
  patches: JsonPatchOperation[];
  dimension: SwitchDimension;
  scope: "deck" | "slide" | "block";
  slideIndex?: number;
  changed: boolean;
  shadowed: number[];
  loss?: string[];
}

/** Compute and validate the patch for one dimension without changing any session. */
export declare function prepareDimensionSwitch(presentation: unknown, dimension: SwitchDimension, value: DimensionSwitchValue, options?: DimensionSwitchOptions): PreparedDimensionSwitch;
/** Apply one dimension switch to a session as a single undoable transaction. */
export declare function switchDimension(editor: EditorSession, dimension: SwitchDimension, value: DimensionSwitchValue, options?: DimensionSwitchOptions): DimensionSwitchChange;

export interface SwitchOption {
  id: string;
  label: string;
  record?: Record<string, unknown>;
}
export interface CompatibleChartType extends SwitchOption {
  /** True for the chart's present type, which is always listed. */
  current: boolean;
}
/** Values a picker can offer for a catalog-backed dimension (document inline records, caller catalogs, then the bundled catalog, without duplicates); `blocks` lists the content kinds and `slide-sizes` the presets (labelled with their inches). `purposes` lists the catalog; any other goal text is also a valid switch value. */
export declare function listSwitchOptions(presentation: unknown, dimension: SwitchDimension, options?: Pick<DimensionSwitchOptions, "catalogs" | "catalogSources">): SwitchOption[];
/** Chart types the chart's inline data can use as it is (data-shape compatibility, not an engine-support claim). `path` or `slideIndex` picks the chart. */
export declare function compatibleChartTypes(presentation: unknown, options?: Pick<DimensionSwitchOptions, "slideIndex" | "path" | "catalogs" | "catalogSources">): CompatibleChartType[];
/** The value a dimension currently has: `{ value, scope }`, with the catalog id for catalog dimensions. `slide-sizes` reads the deck's design.dimensions, else its theme's (a preset string, or the object for a custom size); `purposes` reads the goal text or Purpose id. */
export declare function currentSwitchValue(presentation: unknown, dimension: SwitchDimension, options?: Pick<DimensionSwitchOptions, "slideIndex" | "path" | "owner" | "index">): { value: unknown; scope: "deck" | "slide" | "block" };
export { blockConversionTargets } from "./block-convert.js";
