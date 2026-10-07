import type { RenderFonts, ScriptFonts } from "./fonts.js";
import type { Finding } from "@openpresentation/opf";
import type { SlideComposition, LayoutDiagnostic, TextMeasurement } from "@openpresentation/opf/composition";
export declare const packageName = "@openpresentation/opf-render";

export declare const releaseLane: Readonly<{
  githubRepository: "OpenPresentation/opf-render";
  npmPackage: "@openpresentation/opf-render";
  compatibilityPackage: "@openpresentation/opf";
}>;

export declare const runtimePolicy: Readonly<{
  hostedServiceInCriticalPath: false;
  telemetry: false;
  commercialSdkInCriticalPath: false;
  requiredNetworkCalls: false;
  deterministicLocalExecution: true;
}>;

export declare const engineDefaults: Readonly<{
  catalogs: Readonly<Record<string, Readonly<{ source: string }>>>;
  theme: "minimal";
  colorScheme: "cool-horizon";
  language: "english";
  narrative: "classic-story";
  tone: "formal";
  audience: "executives";
  fontScheme: Readonly<{
    pptx: Readonly<{ latin: "aptos"; ea: "microsoft-yahei"; cs: "nirmala-ui" }>;
    google: Readonly<{ latin: "roboto"; ea: "noto-sans-sc"; cs: "noto-sans" }>;
  }>;
  chartTypes: readonly ["stacked-column", "stacked-area", "line-with-markers"];
}>;

export type RenderDiagnostic = LayoutDiagnostic | {
  /** A face lacked glyphs for the text; a bundled fallback face draws them in the preview. A note, not an error. */
  code: "font-glyph-fallback";
  path?: string;
  message: string;
  fontFamily: string;
  fallbackFamily: string;
  scripts: string[];
  characters: string[];
} | {
  code: "unsupported-pattern" | "variable-example-used" | "variable-builtin-missing" | "date-needs-value" | "language-preview-unresolved";
  path: string;
  message: string;
} | {
  /** A font-scheme id matched no record; the default font scheme (`aptos`) was used as the base. */
  code: "unresolved-font-scheme";
  path: string;
  message: string;
  id: string;
  fallback: string;
} | {
  /** A layout, theme or colour-scheme id matched no record: the slide composed with no layout record, the `minimal` theme or the `cool-horizon` colour scheme. Never an error. */
  code: "unresolved-layout" | "unresolved-theme" | "unresolved-color-scheme";
  path: string;
  message: string;
  id: string;
} | {
  code: "unresolved-asset";
  path: string;
  message: string;
  reason: "missing-reference" | "missing-source" | "unsupported-source";
  source?: string;
  assetId?: string;
  description: string;
  placeholder: "label" | "icon";
};

export interface RenderSvgOptions {
  /** Leave out slides marked `hidden: true`, as the player does. Default false: one SVG per slide. With true the result holds only the visible slides, in order, so an index no longer names the slide at that index. Read by the deck-level `renderSvg`; `renderSlideSvg` draws the slide it is given. */
  skipHidden?: boolean;
  /**
   * The fonts the deck is laid out and drawn with: the handle `loadFonts()` returns (from `@openpresentation/opf-render/fonts-node` or
   * `/fonts-browser`), or any object with a `textMeasurement` and, to embed faces in each SVG, an `embeddedFonts` list. Without it layout uses
   * core's portable width estimate and the SVG names the design fonts without embedding them.
   */
  fonts?: RenderFonts;
  /** `"chain"` (default): a character the resolved face lacks is drawn with the first bundled face that has it, and reported as `font-glyph-fallback`. `"none"`: exact faces, a missing glyph raises `missing-glyph`. */
  glyphFallback?: "chain" | "none";
  /** Unscaled reference-pixel clearance around supplied vector text outlines; default 1. */
  textRasterPadding?: number;
  strictAssets?: boolean;
  imageResolver?: (src: string | undefined, context: { asset: unknown; path: string }) => string | null | undefined;
  onDiagnostic?: (diagnostic: RenderDiagnostic) => void;
  /** When false, skip AJV boundary validation. Default true. */
  validate?: boolean;
  /**
   * Values for the deck's template variables, keyed by variable id (core `resolveVariables`). A deck that uses
   * content variables, or is marked `template: true`, is resolved to a concrete deck first. A template previews with
   * each unfilled variable's example (reported as `variable-example-used`; a built-in such as `{{speaker.name}}` with no source value is reported as `variable-builtin-missing`); a normal deck with an unfilled required
   * variable throws `unfilled-variables`. `false` draws the document as authored, with `{{id}}` tokens and
   * `var:id` references visible and nothing resolved: the view an editor uses while the template itself is edited.
   */
  variables?: Record<string, unknown> | false;
  /**
   * Today's calendar date (ISO YYYY-MM-DD) for `date: true` header/footer furniture. The renderer
   * never reads a clock; without it a current date is reported as unresolved content.
   */
  date?: string;
  trace?: boolean;
  catalogs?: Record<string, { records?: unknown[] } | unknown[]>;
  /**
   * Records for catalog sources the host has already fetched, keyed by the source string a document's
   * `catalogs.<kind>.source` names (a single source or an ordered array; first match wins, the bundled
   * default catalog is appended). The renderer never fetches a source itself.
   */
  catalogSources?: Record<string, { records?: unknown[] } | unknown[]>;
}

export interface SvgToPngOptions {
  /** The fonts the conversion draws with (Node): see `SvgToPngOptions` in the main entry. */
  fonts?: RenderFonts;
  scale?: number;
  background?: string;
  dpi?: number;
  /** Extra directories of font files to draw with. */
  fontDirs?: string[];
  defaultFontFamily?: string;
  sansSerifFamily?: string;
  monospaceFamily?: string;
}

export interface SvgToPdfOptions extends SvgToPngOptions {}

export interface ResolvedPresentation {
  presentation: unknown;
  engineDefaults: typeof engineDefaults;
  slides: ResolvedSlide[];
}

export interface ResolvedSlide {
  geometry: SlideComposition;
  /** Script font plan for this slide (FF-19): slots, language tags and direction. */
  scriptFonts: ScriptFonts;
  /** The script-aware measurement composition used; undefined for estimated layout. */
  textMeasurement?: TextMeasurement;
  index: number;
  path: string;
  slide: unknown;
  /** The layout record the slide names; absent when it names none or an id no catalog has (the slide then composes with no layout). */
  layout?: unknown;
  design: {
    theme: unknown;
    colorScheme: unknown;
    fontScheme: unknown;
    dimensions: { width: number; height: number };
    background: unknown;
    backgroundColor: string | null;
    colors: Record<string, string>;
    fonts: Record<"heading" | "body" | "code", string>;
  };
  titleBindings: RenderBinding[];
  contentItems: RenderBinding[];
  blocks: RenderBinding[];
}

export interface RenderBinding {
  type: string;
  field?: string;
  slot?: string;
  value: unknown;
  path: string;
  placeholderIndex?: number;
  regionKey?: string;
}

export declare class OPFRenderError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;
  /** `invalid-opf`: the error findings of core `validate(presentation, { only: ["format"] })` (also `details.findings`; `details.report` is the whole report). */
  readonly findings?: Finding[];
  readonly path?: string;
  constructor(code: string, message: string, details?: Record<string, unknown>);
}

export declare function resolvePresentation(input: unknown, options?: RenderSvgOptions): ResolvedPresentation;

/** The SVG of every slide of the deck, in order. */
export declare function renderSvg(input: unknown, options?: RenderSvgOptions): string[];

/** The SVG of one slide of the deck (`index` is zero-based; out of range throws `slide-index-out-of-range`). */
export declare function renderSlideSvg(input: unknown, index: number, options?: RenderSvgOptions): string;


