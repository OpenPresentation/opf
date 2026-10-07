import type { EmbeddedFont, ScriptFonts } from "./fonts.js";
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
  code: "unsupported-pattern" | "variable-example-used" | "variable-builtin-missing" | "date-needs-value" | "language-preview-unavailable" | "language-preview-unresolved" | "paragraph-direction-unavailable";
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
  code: "unresolved-asset";
  path: string;
  message: string;
  reason: "missing-reference" | "missing-source" | "unsupported-source";
  source?: string;
  assetId?: string;
  description: string;
  placeholder: "label" | "icon";
};

export interface RenderSvgDeckOptions {
  /** Leave out slides marked `hidden: true`, as the player does. Default false: one SVG per slide. With true the result holds only the visible slides, in order. */
  skipHidden?: boolean;
}

export interface RenderSvgOptions {
  textMeasurement?: TextMeasurement;
  /** `"chain"` (default): a character the resolved face lacks is drawn with the first bundled face that has it, and reported as `font-glyph-fallback`. `"none"`: exact faces, a missing glyph raises `missing-glyph`. */
  glyphFallback?: "chain" | "none";
  /** Unscaled reference-pixel clearance around supplied vector text outlines; default 1. */
  textRasterPadding?: number;
  embeddedFonts?: EmbeddedFont[];
  strictAssets?: boolean;
  imageResolver?: (src: string | undefined, context: { asset: unknown; path: string }) => string | null | undefined;
  onDiagnostic?: (diagnostic: RenderDiagnostic) => void;
  validate?: boolean;
  /**
   * Values for the deck's template variables, keyed by variable id (core `resolveVariables`). A deck that uses
   * content variables, or is marked `template: true`, is resolved to a concrete deck first. A template previews with
   * each unfilled variable's example (reported as `variable-example-used`; a built-in such as `{{speaker.name}}` with no source value is reported as `variable-builtin-missing`); a normal deck with an unfilled required
   * variable throws `unfilled-variables`. `false` draws the document as authored, with `{{id}}` tokens and
   * `var:id` references visible and nothing resolved: the view an editor uses while the template itself is edited.
   */
  variables?: Record<string, unknown> | false;
  slideIndex?: number;
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
  scale?: number;
  background?: string;
  dpi?: number;
  useBundledFonts?: boolean;
  loadSystemFonts?: boolean;
  fontFiles?: string[];
  fontDirs?: string[];
  defaultFontFamily?: string;
  sansSerifFamily?: string;
  monospaceFamily?: string;
}

/** A note, warning or (under `strict`) error from the vector PDF export. Every code starts with `pdf-`. */
export type PdfDiagnostic = {
  /** One per embedded font face: what was embedded, how, and under which embedding permissions. */
  code: "pdf-font-embedded";
  family: string; postscriptName: string; weight: number; italic: boolean;
  /** Distinct glyphs kept, and the size of the embedded font program in bytes. */
  glyphs: number; bytes: number;
  /** `subset` unless the font forbids subsetting (OS/2 fsType bit 8), then `full`. */
  embedding: "subset" | "full";
  /** OS/2 fsType bits of the face. */
  fsType: number;
  /** `preview-and-print` when fsType allows only that. Fonts whose fsType forbids embedding are never embedded. */
  embeddingRestriction?: "preview-and-print";
  /** The face's own license description (name table), when it has one. */
  license?: string;
  /** The file name or `svg @font-face` the face came from. */
  origin?: string;
} | {
  /** The first requested family has no embeddable face; the named face is used instead (like the PNG preview does). */
  code: "pdf-font-substituted";
  message: string; requestedFamily: string; resolvedFamily: string; weight: number; italic: boolean;
} | {
  /** A character the selected face lacks is drawn with another supplied face. */
  code: "pdf-font-fallback";
  message: string; fontFamily: string; fallbackFamily: string; codePoint: number;
} | {
  code: "pdf-font-embedding-restricted" | "pdf-font-unsupported-format" | "pdf-font-unreadable";
  message: string; family?: string; origin?: string;
} | {
  /** An element with an effect that has no PDF equivalent (filter, mask, nested SVG picture); that element alone is drawn as an image. */
  code: "pdf-raster-fallback";
  message: string; path?: string; element: string; reason: string;
} | {
  /** No supplied font has the character: the font's missing-glyph box is drawn. */
  code: "pdf-glyph-missing";
  message: string; fontFamily: string; codePoint: number;
} | {
  /** An attribute with no PDF form here (`rotate`, `dominant-baseline`, `text-transform`, `paint-order`, `mix-blend-mode`, markers, ...). */
  code: "pdf-unsupported-feature";
  message: string; path?: string; element: string; attribute: string;
} | {
  /** Too much content (more than 50,000 elements on a page, `<use>` expansions included, or groups nested over 256 deep): the rest of the page is not drawn. */
  code: "pdf-expansion-limit";
  message: string; path?: string;
} | {
  code: "pdf-unsupported-element" | "pdf-unsupported-clip" | "pdf-unsupported-paint" | "pdf-unsupported-css" | "pdf-image-skipped" | "pdf-link-skipped";
  message: string; path?: string; element?: string; kind?: string;
};

export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string | string[];
  /** BCP 47 document language; default: the first SVG's `lang`. */
  language?: string;
  /** Default: the package name. */
  creator?: string;
  /** Omitted from the PDF unless supplied: the export never reads a clock. A date-time without a zone designator is read as UTC. */
  creationDate?: Date | string;
  modificationDate?: Date | string;
}

export interface SvgToPdfOptions extends SvgToPngOptions {
  /**
   * `"vector"` (default): shapes, gradients and patterns as PDF vector graphics, pictures as images, text as real text
   * with embedded font subsets (selectable, searchable, correct copy and paste); the fonts are the bundled files and
   * `fontFiles` / `fontDirs` you supply, never system fonts. `"raster"`: each slide an image, as before.
   */
  mode?: "vector" | "raster";
  /** Vector mode paints the page this colour first (default white, as raster mode composites on white); `"none"` leaves it unpainted. */
  background?: string;
  /** Vector only. Family drawn for the generic `serif`; default `defaultFontFamily`. */
  serifFamily?: string;
  /** Vector only. Document title, author, language and dates. */
  metadata?: PdfMetadata;
  /** Vector only. Write the structure tree (reading order, headings, links, figures) and mark decoration as artifacts; default true. */
  tagged?: boolean;
  /** Vector only. `false` leaves streams uncompressed, for inspection; default true. */
  compress?: boolean;
  /** Vector only. Throw (`OPFRenderError`, the diagnostic's code) instead of rasterizing an element or skipping an unsupported feature. */
  strict?: boolean;
  /** Vector only. Pixel density of the rare element rasterized because it has no vector form; default 2. */
  rasterFallbackScale?: number;
  /** Vector only. Receives font embedding reports, substitutions, fallbacks and unsupported features. */
  onDiagnostic?: (diagnostic: PdfDiagnostic) => void;
  /** Vector only. Checked between pages; an abort rejects with the signal's reason. */
  signal?: AbortSignal;
  /** Vector only. Called after each page is written. */
  onProgress?: (progress: { page: number; pages: number }) => void;
}

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
  layout: unknown;
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
  readonly issues?: unknown[];
  readonly path?: string;
  constructor(code: string, message: string, details?: Record<string, unknown>);
}

export declare function resolvePresentation(input: unknown, options?: RenderSvgOptions): ResolvedPresentation;

export declare function renderSvg(input: unknown, options?: RenderSvgOptions): string;

export declare function renderSvgDeck(input: unknown, options?: RenderSvgOptions & RenderSvgDeckOptions): string[];

export declare function svgToPng(svg: string | Uint8Array, options?: SvgToPngOptions): Promise<Uint8Array>;

export declare function svgToPdf(svgs: string | Uint8Array | Array<string | Uint8Array>, options?: SvgToPdfOptions): Promise<Uint8Array>;
