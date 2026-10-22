import type { ConvertOptions } from "@openpresentation/opf/convert";
import type { Catalog } from "@openpresentation/opf";
import type { EditorChange, EditorSession, JsonPatchOperation } from "./index.js";

/** Display metadata for the engine vocabularies, in the shape of `catalogDisplay` (`@openpresentation/gallery`): records by id, or a list of records with `id` (`bcp47` for a language). */
export interface SwitchVocabularies {
  languages?: unknown;
  chartTypes?: unknown;
  socialPlatforms?: unknown;
}

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
  /** blocks: the complete block (`slides.0.blocks.1`) or one-payload slide/region to replace. charts: the block holding the chart (default: the slide's first chart). image-treatments: the image block. */
  path?: string | string[];
  /** A gallery item's catalog record, embedded in the same transaction (under the group of `recordSource`, else `custom`) when it is not embedded yet. */
  record?: Record<string, unknown> & { id: string };
  /** The catalog source of `record` (for example "https://www.pptx.gallery"). */
  recordSource?: string;
  /** Host catalogs (`Catalog[]`): references resolve in the document, then in these. */
  catalogs?: readonly Catalog[];
  /** Display metadata for languages, chart types and social platforms (labels in pickers). */
  vocabularies?: SwitchVocabularies;
  /** themes: the theme's own color scheme, font scheme and background (and, for the deck, dimensions) apply: overrides of those at the switched scope are removed; on a slide whose deck sets one, the theme's value is written on the slide (default true). */
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
  | string /* slide-sizes: a SlideSizePreset. purposes: a catalog reference or free-form goal text. languages: a BCP-47 tag. Catalog dimensions: a reference, `id` or `name:id`. */
  | string[] /* audiences: catalog references */
  | { platform: string; handle: string }
  | { header?: unknown; footer?: unknown }
  | Record<string, unknown> /* image-treatments: fit, focus, aspectRatio, shape, cornerRadius, border, opacity, recolor, overlay, placement (null removes) */;

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
  /** The value to switch to: for a catalog dimension the reference, `id` or `name:id`. */
  id: string;
  label: string;
  record?: Record<string, unknown>;
  reference?: string;
  group?: string;
  source?: string;
  origin?: "document" | "host";
}
export interface CompatibleChartType extends SwitchOption {
  /** True for the chart's present type, which is always listed. */
  current: boolean;
}
/** Values a picker can offer: a catalog dimension lists core's `catalogRecords` (embedded records, then `catalogs`); `charts` and `socials` list core's vocabularies, `languages` core's `LANGUAGES` tags; `blocks` lists the content kinds and `slide-sizes` the presets. `purposes` lists the catalogs; any other goal text is also a valid switch value. */
export declare function listSwitchOptions(presentation: unknown, dimension: SwitchDimension, options?: Pick<DimensionSwitchOptions, "catalogs" | "vocabularies">): SwitchOption[];
/** Chart types the chart's inline data can use as it is (data-shape compatibility from `vocabularies.chartTypes`, not an engine-support claim). `path` or `slideIndex` picks the chart. */
export declare function compatibleChartTypes(presentation: unknown, options?: Pick<DimensionSwitchOptions, "slideIndex" | "path" | "catalogs" | "vocabularies">): CompatibleChartType[];
/** The value a dimension currently has: `{ value, scope }`, with the reference (`id` or `name:id`) for catalog dimensions. `slide-sizes` reads the deck's design.dimensions, else its theme's (a preset string, or the object for a custom size); `purposes` reads the goal text or Purpose id. */
export declare function currentSwitchValue(presentation: unknown, dimension: SwitchDimension, options?: Pick<DimensionSwitchOptions, "slideIndex" | "path" | "owner" | "index" | "catalogs">): { value: unknown; scope: "deck" | "slide" | "block" };
export { blockConversionTargets } from "./block-convert.js";
