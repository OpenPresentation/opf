import type { EditorSession } from "./index.js";
import type { ImageFocus, ImageOverlay } from "./image-options.js";
import type { DimensionSwitchChange, DimensionSwitchOptions, PreparedDimensionSwitch } from "./switches.js";

export declare const BACKGROUND_TYPES: readonly ["theme", "solid", "gradient", "image", "pattern"];
export declare const THEME_BACKGROUND_SLOTS: readonly ["light1", "light2", "dark1", "dark2"];
export declare const IMAGE_BACKGROUND_FITS: readonly ["cover", "contain", "stretch", "tile"];
/** LH-158: where a cover's or section's heading group goes on a picture background. */
export declare const TEXT_PLACEMENTS: readonly ["top-start", "top-center", "middle-start", "middle-center", "bottom-start", "bottom-center", "panel"];
/** Image sources the background string shorthand accepts: `asset:`, `https://`, `data:`, `./`, `../`. */
export declare const IMAGE_SOURCE: RegExp;
/** Scheme slots and roles a ColorRef may name. */
export declare const COLOR_NAMES: readonly string[];
/** The 54 DrawingML preset patterns by family. */
export declare const PATTERN_GROUPS: Readonly<Record<string, readonly string[]>>;
export declare const PATTERN_PRESETS: readonly string[];

export interface GradientStop {
  color: string;
  position: number;
}
export type BackgroundSpec =
  | string
  | { type: "theme"; slot: (typeof THEME_BACKGROUND_SLOTS)[number] }
  | { type: "solid"; color: string; opacity?: number }
  | { type: "gradient"; gradient: { angle?: number; stops: GradientStop[] }; opacity?: number }
  | { type: "image"; src: string; alt?: string; fit?: (typeof IMAGE_BACKGROUND_FITS)[number]; focus?: ImageFocus; opacity?: number; recolor?: "grayscale" | { dark: string; light: string }; overlay?: ImageOverlay | false; textPlacement?: (typeof TEXT_PLACEMENTS)[number] }
  | { type: "pattern"; pattern: { preset: string; foregroundColor?: string; backgroundColor?: string }; opacity?: number };

/** Whether `value` is a ColorRef: a hex color, a scheme slot or role name, or `var:<id>`. */
export declare function isColorRef(value: unknown): boolean;
/** Validate a background description and return the value to store (a theme slot, a plain hex color or a plain cover image stays the shorthand string). Throws `invalid-background`. */
export declare function normalizeBackground(spec: BackgroundSpec): string | Record<string, unknown>;
export declare function prepareBackground(presentation: unknown, spec: BackgroundSpec | null, options?: DimensionSwitchOptions): PreparedDimensionSwitch;
/** Set the background as one undoable transaction; `null` removes it. */
export declare function setBackground(editor: EditorSession, spec: BackgroundSpec | null, options?: DimensionSwitchOptions): DimensionSwitchChange;
export interface BackgroundState {
  type?: "theme" | "solid" | "gradient" | "image" | "pattern";
  slot?: string;
  color?: string;
  opacity?: number;
  angle?: number;
  stops?: GradientStop[];
  src?: string;
  alt?: string;
  fit?: string;
  focus?: ImageFocus;
  recolor?: "grayscale" | { dark: string; light: string };
  /** LH-02: `false` when the automatic scrim is turned off. */
  overlay?: ImageOverlay | false;
  /** LH-158: the picture's text placement, when the author picked one. */
  textPlacement?: (typeof TEXT_PLACEMENTS)[number];
  preset?: string;
  foregroundColor?: string;
  backgroundColor?: string;
  scope: "deck" | "slide";
  value?: unknown;
}
/** The background that applies at a scope, flattened for a form. */
export declare function readBackground(presentation: unknown, options?: { slideIndex?: number }): BackgroundState;
