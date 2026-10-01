import type { EditorSession } from "./index.js";
import type { DimensionSwitchChange, DimensionSwitchOptions, PreparedDimensionSwitch } from "./switches.js";

export declare const BACKGROUND_TYPES: readonly ["theme", "solid", "gradient", "image", "pattern"];
export declare const THEME_BACKGROUND_SLOTS: readonly ["light1", "light2", "dark1", "dark2"];
export declare const IMAGE_BACKGROUND_FITS: readonly ["cover", "contain", "tile"];
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
  | { type: "image"; image: { src: string; fit?: (typeof IMAGE_BACKGROUND_FITS)[number] }; opacity?: number }
  | { type: "pattern"; pattern: { preset: string; foregroundColor?: string; backgroundColor?: string }; opacity?: number };

/** Whether `value` is a ColorRef: a hex color, a scheme slot or role name, or `var:<id>`. */
export declare function isColorRef(value: unknown): boolean;
/** Validate a background description and return the value to store (a theme slot or plain hex stays the shorthand string). Throws `invalid-background`. */
export declare function normalizeBackground(spec: BackgroundSpec): string | Record<string, unknown>;
export declare function prepareBackground(document: unknown, spec: BackgroundSpec | null, options?: DimensionSwitchOptions): PreparedDimensionSwitch;
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
  fit?: string;
  preset?: string;
  foregroundColor?: string;
  backgroundColor?: string;
  scope: "deck" | "slide";
  value?: unknown;
}
/** The background that applies at a scope, flattened for a form. */
export declare function readBackground(document: unknown, options?: { slideIndex?: number }): BackgroundState;
