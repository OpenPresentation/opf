import type { RenderFonts, ScriptFonts } from "./fonts.js";
import type { Catalog, Finding, UnresolvedReferenceDiagnostic } from "@openpresentation/opf";
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

/** What draws when nothing resolves: core's engine defaults (OPF 0.15 ships no catalog records), and the chart type a chart without `type` previews as. */
export declare const engineDefaults: Readonly<{
  theme: typeof import("@openpresentation/opf/composition").ENGINE_DEFAULT_THEME;
  colorScheme: typeof import("@openpresentation/opf/composition").ENGINE_DEFAULT_COLOR_SCHEME;
  fontScheme: typeof import("@openpresentation/opf/composition").ENGINE_DEFAULT_FONT_SCHEME;
  chartType: string;
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
} | UnresolvedReferenceDiagnostic | {
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
   * `/fonts-browser`), or any object with a `textMeasurement` and, to embed faces, an `embeddedFonts` list (each SVG carries only the faces its text draws). Without it layout uses
   * core's portable width estimate and the SVG names the design fonts without embedding them.
   */
  fonts?: RenderFonts;
  /** `false` writes no `@font-face` data into the SVG (RR-61): the fonts handle still measures and the SVG still names the families, for a host whose page already has the faces (a browser `loadFonts` handle adds them to the document). Default true: each SVG embeds the faces of `fonts.embeddedFonts` its own text draws. */
  embedFonts?: boolean;
  /**
   * `true` draws every `<text>` as glyph outlines (RR-64): `<use>` of outlines kept once per slide in `<defs>`, so the SVG needs
   * no font and looks the same in every viewer (about 40 KB a slide over the core example decks, against 0.5 to 4 MB of embedded
   * faces). Needs the fonts handle `loadFonts()` returns (`text-as-paths-needs-fonts` otherwise). The text is no longer text: it
   * cannot be selected, searched or edited in place, and each outlined element is a `role="img"` group labelled with its text for
   * assistive technology. Each element keeps its `data-opf-*` trace. Text in a colour or bitmap font stays text
   * (`text-as-paths-kept-text`). Use it for thumbnails, previews and portable SVG files, not for an editing surface or the
   * vector PDF (which keeps real text from `<text>` SVG). Default false.
   */
  textAsPaths?: boolean;
  /** `"chain"` (default): a character the resolved face lacks is drawn with the first bundled face that has it, and reported as `font-glyph-fallback`. `"none"`: exact faces, a missing glyph raises `missing-glyph`. */
  glyphFallback?: "chain" | "none";
  /** Unscaled reference-pixel clearance around supplied vector text outlines; default 1. */
  textRasterPadding?: number;
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
  /**
   * Today's calendar date (ISO YYYY-MM-DD) for `date: true` header/footer furniture. The renderer
   * never reads a clock; without it a current date is reported as unresolved content.
   */
  date?: string;
  trace?: boolean;
  /**
   * Catalogs the host registered (core `Catalog[]`), passed unchanged to core resolution: a reference the document does not
   * embed resolves against the catalog whose `source` its group names, and the first entry is the default catalog for bare ids
   * when the document omits `catalogs.default`. The renderer bundles and fetches no catalog; register the gallery snapshot with
   * `import { defaultCatalog } from "@openpresentation/opf/catalog"` and `catalogs: [defaultCatalog]`. Omitted: only embedded
   * records resolve, and anything else draws with core's engine defaults (reported as `unresolved-reference`).
   * A malformed value throws core's `OPFCatalogsOptionError` (`code: "invalid-catalogs"`); a reference with an undeclared prefix
   * (`foo:id` without `catalogs.foo`) fails the boundary check (`invalid-opf`, finding `opf/undeclared-catalog`).
   */
  catalogs?: readonly Catalog[];
  /** Fail with `unresolved-reference` (an OPFRenderError whose `details.diagnostics` list the references) instead of falling back when a reference resolves nowhere. Default false. */
  strictReferences?: boolean;
}

export interface SvgToPngOptions {
  /**
   * The fonts the conversion draws with: the handle `loadFonts()` returns from `/fonts-node` (its `fontFiles`; `useBundledFonts` and
   * `loadSystemFonts` say whether the bundled base faces are added, default true, and whether system fonts load, default false). Without
   * it the bundled base faces draw. The same handle goes to `renderSvg`, so the preview and the PNG use the same faces.
   */
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
   * with embedded font subsets (selectable, searchable, correct copy and paste); the fonts are the bundled files, the `fonts` handle's
   * `fontFiles` and the `fontDirs` you supply, never system fonts. `"raster"`: each slide an image, as before.
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
  /** The layout record the slide names; absent when it names none or a reference that resolves nowhere (the slide then composes automatically). */
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

export declare function svgToPng(svg: string | Uint8Array, options?: SvgToPngOptions): Promise<Uint8Array>;

export declare function svgToPdf(svgs: string | Uint8Array | Array<string | Uint8Array>, options?: SvgToPdfOptions): Promise<Uint8Array>;
