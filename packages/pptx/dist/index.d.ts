import type { LayoutDiagnostic, TextMeasurement } from "@openpresentation/opf/composition";
export declare const packageName = "@openpresentation/opf-pptx";

export declare const releaseLane: Readonly<{
  githubRepository: "OpenPresentation/opf-pptx";
  npmPackage: "@openpresentation/opf-pptx";
  compatibilityPackage: "@openpresentation/opf";
  rendererPackage: "@openpresentation/opf-render";
}>;

export declare const runtimePolicy: Readonly<{
  hostedServiceInCriticalPath: false;
  telemetry: false;
  commercialSdkInCriticalPath: false;
  requiredAiDependency: false;
  requiredLibreOfficeDependency: false;
  requiredNetworkCalls: false;
  deterministicLocalExecution: true;
}>;

export type ImageResolverResult =
  | string
  | Uint8Array
  | {
      data?: string | Uint8Array;
      path?: string;
      mediaType?: string;
    };

export interface ImageResolverContext {
  asset: unknown;
  presentation: unknown;
  path: string;
}

export interface FontSchemeDiagnostic { code: "unresolved-font-scheme"; path: string; message: string; id: string; fallback: string }

export interface ToPptxOptions {
  /** Default compatible converts WebP to a static PNG. Preserve embeds original WebP bytes. */
  imageFormat?: "compatible" | "preserve";
  textMeasurement?: TextMeasurement;
  /** Match preview/pagination clearance around supplied vector text outlines; default 1. */
  textRasterPadding?: number;
  /** Layout diagnostics, plus `unresolved-font-scheme` (once per reference path) when a font-scheme id matches no record and the default `aptos` scheme is used as the base. */
  onDiagnostic?: (diagnostic: LayoutDiagnostic | FontSchemeDiagnostic) => void;
  baseDir?: string;
  compressionLevel?: number;
  imageResolver?: (src: string, context: ImageResolverContext) => ImageResolverResult | Promise<ImageResolverResult | null | undefined> | null | undefined;
  seed?: number;
  strictAssets?: boolean;
  timestamp?: string;
  zipDate?: string | number | Date;
}

export interface FromPptxOptions {
  /** Reports native details that import cannot preserve, including code provenance fallback/reflow and grouped text transforms. Table paths identify native frame and row/cell indexes (including headers). */
  onDiagnostic?: (diagnostic: {code: string; path: string; message: string}) => void;
  fallbackName?: string;
  schema?: string;
}

export declare class OPFPptxError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;
  readonly issues?: unknown[];
  readonly path?: string;
  constructor(code: string, message: string, details?: Record<string, unknown>);
}

export declare function toPptx(input: unknown, options?: ToPptxOptions): Promise<Uint8Array>;

export declare function fromPptx(input: Uint8Array | ArrayBuffer, options?: FromPptxOptions): Promise<Record<string, unknown>>;

export interface TypefaceEntry {
  /** Part path; parts of nested packages use "outer.xlsx!/inner/part.xml". */
  part: string;
  kind: "drawingml" | "spreadsheetml";
  /** Local element name, for example latin, ea, cs, sym, buFont, font, name or rFont. */
  element: string;
  typeface: string;
  /** Theme font collection for theme parts. */
  theme?: "major" | "minor";
  /** Script tag of a theme script supplement (`<a:font script="…">`). */
  script?: string;
  pitchFamily?: number;
  /** Theme reference (+mj-lt, +mn-ea, …) resolved against the package theme; null when unresolved. */
  resolved?: string | null;
}

export interface TypefaceInventory {
  typefaces: TypefaceEntry[];
  themes: Record<string, {major: Partial<Record<"latin" | "ea" | "cs", string>>; minor: Partial<Record<"latin" | "ea" | "cs", string>>}>;
  /** docProps/app.xml "Fonts Used", or null when the package has no readable list. */
  fontsUsed: string[] | null;
}

export interface CheckPptxTypefacesOptions {
  /** Family names the document chose (heading, body, code, run fonts). Required. */
  fonts: string[];
  /** Chosen families that are monospace; their pitchFamily must be fixed pitch, and only theirs. */
  monospace?: string[];
  /** Allow empty theme ea/cs slots and references to them (FF-05). Default true. */
  allowEmptyThemeScripts?: boolean;
  /** Allowed theme script supplements; defaults to THEME_SCRIPT_SUPPLEMENTS. */
  scriptSupplements?: Readonly<Record<"major" | "minor", Readonly<Record<string, string>>>>;
}

export type TypefaceViolationReason =
  | "foreign-typeface"
  | "foreign-theme-reference"
  | "unresolved-theme-reference"
  | "empty-theme-reference"
  | "empty-typeface"
  | "foreign-script-supplement"
  | "monospace-not-fixed-pitch"
  | "fixed-pitch-not-monospace"
  | "inconsistent-pitch-family"
  | "missing-fonts-used"
  | "foreign-fonts-used"
  | "fonts-used-mismatch";

export interface TypefaceViolation {
  reason: TypefaceViolationReason;
  part: string;
  element?: string;
  typeface?: string;
  [detail: string]: unknown;
}

export declare const THEME_SCRIPT_SUPPLEMENTS: Readonly<Record<"major" | "minor", Readonly<Record<string, string>>>>;

export declare function inventoryPptxTypefaces(input: Uint8Array | ArrayBuffer | Record<string, Uint8Array>, options?: {nested?: boolean}): TypefaceInventory;

export declare function packageFontsUsed(inventory: TypefaceInventory): string[];

export declare function checkPptxTypefaces(input: Uint8Array | ArrayBuffer | Record<string, Uint8Array>, options: CheckPptxTypefacesOptions): {
  ok: boolean;
  violations: TypefaceViolation[];
  inventory: TypefaceInventory;
  /** The "Fonts Used" list the package's own fonts imply. */
  fontsUsed: string[];
};
