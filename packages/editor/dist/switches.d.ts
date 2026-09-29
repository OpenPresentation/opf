import type { EditorChange, EditorSession, JsonPatchOperation } from "./index.js";

/** The 14 pptx.gallery dimensions. */
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
  /** themes: also write the theme's color scheme, font scheme, background and dimensions to the deck design (default true). */
  bundle?: boolean;
  /** Deck-scope design switches: remove slide-level values that would hide the switch. */
  clearSlideOverrides?: boolean;
  /** socials: which document field holds the handle (default "speaker") and, for an array, which entry (default 0). */
  owner?: "speaker" | "organization";
  index?: number;
  /** blocks: media source for the image and video kinds. */
  source?: string;
  /** Session change metadata (switchDimension only). */
  meta?: Record<string, unknown>;
}

export type DimensionSwitchValue =
  | string
  | string[]
  | { platform: string; handle: string }
  | { header?: unknown; footer?: unknown }
  | { slideImage?: unknown; imageFill?: string | null }
  | Record<string, unknown>;

export interface PreparedDimensionSwitch {
  dimension: SwitchDimension;
  scope: "deck" | "slide" | "block";
  slideIndex?: number;
  document: unknown;
  patches: JsonPatchOperation[];
  changed: boolean;
  /** Slides whose own design hides a deck-level switch. */
  shadowed: number[];
}

export interface DimensionSwitchChange extends Omit<EditorChange, "document" | "patches"> {
  document: unknown;
  patches: JsonPatchOperation[];
  dimension: SwitchDimension;
  scope: "deck" | "slide" | "block";
  slideIndex?: number;
  changed: boolean;
  shadowed: number[];
}

/** Compute and validate the patch for one dimension without changing any session. */
export declare function prepareDimensionSwitch(document: unknown, dimension: SwitchDimension, value: DimensionSwitchValue, options?: DimensionSwitchOptions): PreparedDimensionSwitch;
/** Apply one dimension switch to a session as a single undoable transaction. */
export declare function switchDimension(editor: EditorSession, dimension: SwitchDimension, value: DimensionSwitchValue, options?: DimensionSwitchOptions): DimensionSwitchChange;
