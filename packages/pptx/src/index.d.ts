import type { Catalog, Finding, Fonts, LayoutDiagnostic, UnresolvedReferenceDiagnostic } from "@openpresentation/opf";
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

export interface MediaProvenanceDiagnostic { code: "media-provenance-omitted"; path: string; message: string }
/** The chart data cannot be plotted, so a placeholder frame stands in for the chart. */
export interface ChartDataUnplottableDiagnostic { code: "chart-data-unplottable"; path: string; message: string; reason: "dataset-unknown" | "no-rows" | "no-columns" | "single-column-not-numeric" }
/** Content with no PowerPoint export (an empty table, an unsupported payload) is replaced by a plain-language placeholder frame. */
export interface ContentPlaceholderDiagnostic { code: "content-placeholder"; path: string; message: string; reason: "table-has-no-rows" | "unsupported-payload" }
/**
 * An image that cannot be exported as a picture: the preview's placeholder was exported instead (or no watermark, or the background colour).
 * `reason: "unresolved-source"`: no embedded bytes, declared asset or host resolution was available (remote URLs are never fetched).
 * `reason: "unsupported-format"`: the embedded bytes are no readable PNG, JPEG, GIF, WebP or SVG. For an SVG (a native SVG picture over a PNG fallback):
 * `"svg-malformed"` (not well-formed XML, or no `xmlns` SVG root), `"svg-no-size"` (no width and height and no viewBox), `"svg-too-large"` (over 8 MiB),
 * `"svg-unsafe"` (a DOCTYPE with external or markup entities), `"svg-rasterizer-unavailable"` (no `options.svgRasterizer` and `@openpresentation/opf-render`
 * is not installed; always the case in a browser build without `svgRasterizer`) `"svg-render-failed"` (the rasterizer threw or returned no PNG) or `"svg-unreadable"` (a local `.svg` path that could not be read).
 * `reason: "file-unreadable"`: a local raster path that is not a readable file (Node; a browser build leaves local paths to the engine).
 * `strictAssets` throws `unsupported-image-dimensions` for an unreadable raster, `invalid-svg-image` for the SVG content reasons above (and `svg-unreadable`), `svg-rasterizer-unavailable` for a
 * missing rasterizer, `svg-render-failed` for a failed one and `missing-asset` for an unreadable local file instead.
 * Every picture path reports this (image blocks and region images, quote photos, background pictures, watermarks, logos, header/footer images, picture bullets), once per picture.
 */
export interface UnresolvedAssetDiagnostic { code: "unresolved-asset"; path: string; message: string; reason?: "unresolved-source" | "unsupported-format" | "svg-malformed" | "svg-no-size" | "svg-too-large" | "svg-unsafe" | "svg-rasterizer-unavailable" | "svg-render-failed" | "svg-unreadable" | "file-unreadable" }
/** An SVG picture had scripts, `foreignObject`, event handlers, references outside the file, `@import` rules or a DOCTYPE; they were removed from the embedded SVG (on import too). Nothing in an SVG is run or fetched. */
export interface SvgSanitizedDiagnostic { code: "svg-sanitized"; path: string; message: string }
/** An SVG image block with a duotone recolor or a non-rectangular shape (or an SVG image background with the tile fit) exports as its PNG raster, not as a native SVG picture, so the effect applies as in the preview (PowerPoint applies opacity, grayscale and a border to an SVG picture, and those stay native). */
export interface SvgImageRasterizedDiagnostic { code: "svg-image-rasterized"; path: string; message: string }
/**
 * The chart data was reshaped to export a native chart: a single value column was plotted against row numbers; a one-series construct
 * (pie, doughnut, and with `chartex: "native"` treemap, histogram, pareto, waterfall, funnel, map) kept only its first series; by default
 * a chartex chart type was written as a clustered column chart (`chartex-fallback`) and a one-column histogram was binned into counts
 * (`histogram-binned`).
 */
export interface ChartDataAdaptedDiagnostic { code: "chart-data-adapted"; path: string; message: string; adaptation: "histogram-binned" | "row-numbers" | "series-dropped" | "chartex-fallback" }
/** With `chartex: "native"`, a map chart (`world`) is exported as a chartex regionMap (`Requires="cx4"`) without cached geography: PowerPoint must fetch the region shapes from its online map service and shows "There was a problem getting the information for your map chart" with an empty chart until it does. */
export interface ChartMapGeodataDiagnostic { code: "chart-map-geodata"; path: string; message: string }
/** RR-54: chart values that core `chartNumber` rejects (not a number or a plain decimal string) were exported as gaps; one per chart, with their count. */
export interface ChartValueNotNumericDiagnostic { code: "chart-value-not-numeric"; path: string; message: string; count: number }
/** RR-54: core adapted a `chart.mapping` (an X column on a chart without an X axis, a series that repeats the category or X column); `pointer` is core's JSON Pointer. */
export interface ChartMappingAdaptedDiagnostic { code: "chart-mapping-adapted"; path: string; message: string; pointer: string }
/** RR-54 (`full` provenance): a chart or table data record, or the datasets map (`path: "datasets"`), is over the 16 MiB tag limit and is not stored; the native values still export. */
export interface DataProvenanceOmittedDiagnostic { code: "data-provenance-omitted"; path: string; message: string }

/** A template variable was unfilled and its `example` was used (template export only), or a built-in variable such as `{{speaker.name}}` has no source value in the document (`variable-builtin-missing`; it exports as nothing). */
export interface VariableExampleUsedDiagnostic {
  code: "variable-example-used" | "variable-builtin-missing";
  /** JSON pointer of the variable's declaration. */
  path: string;
  message: string;
  id: string;
}

export interface ToPptxOptions {
  /** Default compatible converts WebP to a static PNG. Preserve embeds original WebP bytes. */
  imageFormat?: "compatible" | "preserve";
  /**
   * How the chartex chart types (treemap, histogram, pareto, box-and-whisker, waterfall, funnel, world) are exported.
   * "auto" (default) writes Office 2016 chartex parts (`cx:chartSpace`, style parts, an `mc:AlternateContent` frame with the
   * clustered column chart as fallback) for the constructs desktop PowerPoint confirmed natively on 2026-09-30 (treemap,
   * histogram, pareto, box-and-whisker, waterfall, funnel) and keeps `world` on the clustered column chart with
   * `chart-data-adapted` (`chartex-fallback`) because the regionMap part, though accepted with `Requires="cx4"`, draws
   * nothing until PowerPoint fetches map data online. "native" writes every chartex part, the map included (reports
   * `chart-map-geodata`). "fallback" writes clustered columns only
   * (`chartex-fallback`, `histogram-binned`), as releases before FF-22b did. Import of chartex parts is always on.
   */
  chartex?: "auto" | "native" | "fallback";
  /**
   * OPF_DOCUMENT_V1 / OPF_SLIDE_V1 customer-data tags that let fromPptx restore
   * catalog references, layout ids, authoring metadata (`filename` and `extensions`
   * included), `design.logo`, the asset registry, slide `section`/`extensions` and
   * the slide content structure: nested groups, promoted regions, the root payload
   * form, block ids and extensions, group composition (docs/document-roundtrip.md).
   * Tags are not shown in PowerPoint's UI. Default "full"; "references-only"
   * stores catalog references without organization, speaker, free text, slide ids,
   * assets or content structure; false writes no tags. Slide `section` labels are
   * also written as PowerPoint's native section list whatever this option says.
   */
  provenance?: "full" | "references-only" | false;
  /**
   * Values for the deck's template variables, keyed by variable id (core `resolveVariables`). A deck that uses content
   * variables, or is marked `template: true`, is resolved to a concrete deck first; the PPTX holds the resolved text.
   * A template exports with each unfilled variable's example (diagnostic `variable-example-used`); a normal deck with an
   * unfilled required variable throws `unfilled-variables`, and a value of the wrong kind throws `invalid-variables`.
   */
  variables?: Record<string, unknown>;
  /**
   * The fonts handle: what the renderer's `loadFonts()` returns (`@openpresentation/opf-render/fonts-node`), or any object with a
   * `textMeasurement` (core's `Fonts`). The exporter lays text out with `fonts.textMeasurement` and always names the chosen
   * families, never a substitute face. Without it, layout uses core's portable estimate. This is the only way to pass a measurement:
   * a top-level `textMeasurement` option is not read. When the optional renderer is installed, resolved slide/run script
   * slots use its shared script-aware measurement planner; custom providers remain usable without the renderer.
   */
  fonts?: Fonts;
  /** Match preview/pagination clearance around supplied vector text outlines; default 1. */
  textRasterPadding?: number;
  /** Layout diagnostics, `media-provenance-omitted` when video data cannot be stored, and, from core's slide context, `unresolved-reference` (once per reference path) when a layout, theme, colour-scheme or font-scheme reference resolves nowhere (not embedded in the document's `catalogs` and not in a registered catalog): core's engine defaults are drawn instead, and a slide whose layout resolves nowhere, like one with no layout, composes automatically. None of them refuses the export unless `strictReferences` is set. */
  onDiagnostic?: (diagnostic: LayoutDiagnostic | UnresolvedReferenceDiagnostic | MediaProvenanceDiagnostic | ChartDataUnplottableDiagnostic | ChartDataAdaptedDiagnostic | ChartMapGeodataDiagnostic | ChartValueNotNumericDiagnostic | ChartMappingAdaptedDiagnostic | DataProvenanceOmittedDiagnostic | ContentPlaceholderDiagnostic | UnresolvedAssetDiagnostic | SvgSanitizedDiagnostic | SvgImageRasterizedDiagnostic | VariableExampleUsedDiagnostic) => void;
  baseDir?: string;
  compressionLevel?: number;
  imageResolver?: (src: string, context: ImageResolverContext) => ImageResolverResult | Promise<ImageResolverResult | null | undefined> | null | undefined;
  /**
   * Draws the PNG fallback of an SVG picture (the raster older viewers show; PowerPoint 2016 and Microsoft 365 draw the SVG itself). It receives the
   * sanitized SVG text and the pixel size to draw (the SVG's own aspect, about 192 dpi of the displayed size) and returns PNG bytes with a transparent
   * background. It must be deterministic for the export to be. Default in Node: opf-render's `svgToPng` (resvg with the bundled fonts), loaded only when an
   * SVG is exported (optional peer `@openpresentation/opf-render`). Without it, and without opf-render, an SVG picture exports as the "Image unavailable"
   * placeholder with an `unresolved-asset` diagnostic (`reason: "svg-rasterizer-unavailable"`); a browser build has no default.
   */
  svgRasterizer?: (svg: string, size: { width: number; height: number; scale: number; text: boolean }) => Uint8Array | Promise<Uint8Array>;
  seed?: number;
  strictAssets?: boolean;
  /**
   * Strict reference policy (OPF 0.15). When true, a layout, theme, colour-scheme or font-scheme reference that resolves
   * nowhere throws `OPFPptxError` with code `unresolved-reference` (its `path` is the first reference's, its `diagnostics`
   * core's `unresolved-reference` diagnostics) instead of composing automatically or drawing with the engine default.
   * Default: the value of `strictAssets`.
   */
  strictReferences?: boolean;
  timestamp?: string;
  /**
   * ZIP calendar timestamps, including embedded workbooks, use UTC fields at
   * two-second resolution. Omitted/undefined retains the fixed 1980 default.
   * Accepts a valid Date, finite epoch milliseconds, YYYY-MM-DD (UTC midnight),
   * or YYYY-MM-DDTHH:mm[:ss[.fraction]] with Z or ±HH:mm. UTC years 1980–2099 only.
   * Ambiguous/legacy strings and invalid/out-of-range values throw OPFPptxError
   * at options.zipDate; null, empty string and zero no longer choose the default.
   */
  zipDate?: string | number | Date;
  /**
   * Today's calendar date (ISO YYYY-MM-DD) for `date: true` header/footer fields. The exporter never
   * reads a clock: it lays out this date as the cached text of a native PowerPoint date field, which
   * PowerPoint updates on open. Without it a current date is reported as unresolved content.
   */
  date?: string;
  /**
   * The catalogs the host registered (core `Catalog[]`, as for opf-render and core's `resolveSlideContext`): each is matched
   * against a document group's `catalogs.<group>.source`, and the first is the host default that bare ids use when the document
   * omits `catalogs.default`. Never fetched. Every reference (slide layouts, themes, colour and font schemes) resolves in the
   * document's embedded records first, then here; omitted or `[]`, only embedded records resolve. Register the gallery snapshot
   * explicitly with `catalogs: [defaultCatalog]` from `@openpresentation/opf/catalog`.
   */
  catalogs?: readonly Catalog[];
}

export interface FromPptxOptions {
  /** Reports native details that import cannot preserve, including code provenance fallback/reflow and grouped text transforms. Table paths identify native frame and row/cell indexes (including headers). Stored catalog references that no longer match the package report `design-reference-changed` / `layout-reference-changed` at the reference path; a stored slide layout reference that resolves neither in the stored document catalogs, nor in the slide's own stored record, nor in `catalogs` reports `unresolved-reference`; a slide whose imported blocks no longer fit the stored content structure reports `content-structure-changed` at `slides.N`, a block id repeated by a duplicated slide `duplicate-block-id` (docs/document-roundtrip.md). */
  onDiagnostic?: (diagnostic: {code: string; path: string; message: string}) => void;
  fallbackName?: string;
  schema?: string;
  /**
   * The catalogs the host registered (core `Catalog[]`, as in ToPptxOptions; never fetched). Theme and colour-scheme recovery
   * (FF-24) matches the package's theme against the first one, the host default: an exact colour-scheme match imports as its
   * bare id and a corroborated theme name as `design.theme`. Without catalogs the colour scheme imports as an inline object and
   * no theme id is recovered. A stored slide layout reference also resolves here.
   */
  catalogs?: readonly Catalog[];
  /**
   * Opt in to raw per-shape signals (see PptxSignals). `true` uses the default limits; an object lowers or raises them.
   * With it, `fromPptx` resolves to `{presentation, signals}`; without it (the default, also `false`/`null`) it resolves
   * to the presentation alone. The presentation is the same either way.
   */
  signals?: boolean | PptxSignalOptions | null;
}

export declare class OPFPptxError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;
  /** The `error` findings of the `format` check that refused the input or the imported presentation (`invalid-opf`, `invalid-import-opf`), or the variable errors (`unfilled-variables`, `invalid-variables`). */
  readonly findings?: Finding[];
  /** The layout diagnostics behind a `layout-overflow` error, or core's `unresolved-reference` diagnostics behind a strict-export `unresolved-reference` error. */
  readonly diagnostics?: LayoutDiagnostic[] | UnresolvedReferenceDiagnostic[];
  readonly path?: string;
  constructor(code: string, message: string, details?: Record<string, unknown>);
}

export declare function toPptx(input: unknown, options?: ToPptxOptions): Promise<Uint8Array>;

export declare function fromPptx(input: Uint8Array | ArrayBuffer, options?: Omit<FromPptxOptions, "signals"> & { signals?: false | null }): Promise<Record<string, unknown>>;
export declare function fromPptx(input: Uint8Array | ArrayBuffer, options: Omit<FromPptxOptions, "signals"> & { signals: true | PptxSignalOptions }): Promise<PptxImportWithSignals>;
export declare function fromPptx(input: Uint8Array | ArrayBuffer, options?: FromPptxOptions): Promise<Record<string, unknown> | PptxImportWithSignals>;

// ---------------------------------------------------------------------------
// Import signals: `fromPptx(bytes, {signals: true})`.
//
// Raw, deterministic facts about every shape of a deck, for hosts that classify or restructure imported
// decks (a model, a rules engine, a person). Nothing here is inferred from meaning: it is read from the package
// with PowerPoint's inheritance applied (shape, layout, master, presentation defaults, theme). It is plain
// JSON and bounded by PptxSignalOptions. Omitted fields mean "not stated"; defaults are omitted too
// (`bold`, `italic`, `monospace` absent = false, `weight` absent = 400, `level` absent = 0, `align` absent = "left",
// `bullet` absent = none).

/** Bounds on the signals. Each is an integer from 1 up to the cap in parentheses; the defaults are DEFAULT_SIGNAL_LIMITS. */
export interface PptxSignalOptions {
  /** Slides reported (5000). The presentation always has every slide. Default 300. */
  maxSlides?: number;
  /** Shapes reported per slide, groups and their members each counting one (5000). Default 300. */
  maxShapesPerSlide?: number;
  /** Shapes reported over the whole deck (100000). Default 5000. */
  maxTotalShapes?: number;
  /** Paragraphs reported per shape (5000). Default 200. */
  maxParagraphsPerShape?: number;
  /** Characters of text reported per shape (200000). Default 8000. */
  maxTextCharsPerShape?: number;
  /** Characters of shape and table text reported over the whole deck (5000000). Default 400000. */
  maxTextCharsTotal?: number;
  /** Table cells reported per table (10000). Default 400. */
  maxTableCells?: number;
  /** Characters reported per table cell (5000). Default 200. */
  maxTableCellChars?: number;
  /** Group nesting levels walked (32). Default 12. */
  maxGroupDepth?: number;
}
export declare const DEFAULT_SIGNAL_LIMITS: Readonly<Required<PptxSignalOptions>>;
/** The `version` of the PptxSignals format; it changes only when a field is removed or its meaning changes. */
export declare const SIGNALS_VERSION: 1;
/** True for a family known to be fixed-width: the list the `monospace` flag uses. */
export declare function isMonospaceFamily(family: string | undefined): boolean;

export interface PptxImportWithSignals {
  /** The same presentation `fromPptx` returns without the option. */
  presentation: Record<string, unknown>;
  signals: PptxSignals;
}

export interface PptxSignals {
  version: 1;
  deck: {
    slideCount: number;
    /** Slide size in EMU and in reference px (96 per inch, 9525 EMU per px). */
    dimensions?: {widthEmu: number; heightEmu: number; widthPx: number; heightPx: number};
    referencePxPerInch: 96;
    theme: {
      colorSchemeName?: string;
      fontSchemeName?: string;
      majorFont?: string;
      minorFont?: string;
      /** The twelve theme slots (dark1, light1, dark2, light2, accent1-6, hyperlink, followedHyperlink) as #RRGGBB. */
      colors: Record<string, string>;
    };
    /** Whether the deck carries OPF provenance tags (an OPF export): structure then also round-trips exactly. */
    provenance: {opf: boolean; opfTaggedSlides: number};
  };
  /** The limits in force, so a consumer knows what a missing shape or truncated text means. */
  limits: Required<PptxSignalOptions>;
  slides: PptxSlideSignals[];
  /** Present when a bound dropped content: `slides` = slides not reported, `text` = the deck-wide text budget ran out. */
  truncated?: {slides?: number; text?: true};
}

export interface PptxSlideSignals {
  /** Slide position, the same index as `presentation.slides`. */
  index: number;
  /** Package part, for example "ppt/slides/slide1.xml". */
  part: string;
  name?: string;
  hidden?: true;
  layout: {part: string | null; name: string | null; type?: string};
  /** `theme` is the master's theme name. */
  master: {part: string | null; name: string | null; theme: string | null};
  /** "match" / "changed" for a slide that carries an OPF slide tag, "untagged" otherwise. */
  provenance: "match" | "changed" | "untagged";
  /** Every shape in z-order (document order, back to front), groups followed by their members. */
  shapes: PptxShapeSignal[];
  stats: {shapes: number; text: number; pictures: number; tables: number; charts: number; groups: number};
  /** Counts of what a bound dropped on this slide: shapes, depth (group members below maxGroupDepth), paragraphs, text, table. */
  truncated?: Partial<Record<"shapes" | "depth" | "paragraphs" | "text" | "table", number>>;
}

export type PptxShapeKind = "text" | "shape" | "placeholder" | "picture" | "media" | "table" | "chart" | "smartart" | "ole" | "group" | "connector" | "line" | "unknown";

export interface PptxBox {
  /** Reference px (96 per inch), two decimals, in slide coordinates (group transforms applied). */
  px: {x: number; y: number; w: number; h: number};
  /** The same box in EMU, rounded. */
  emu: {x: number; y: number; w: number; h: number};
  /** "own" the shape's xfrm; "layout" / "master" an inherited placeholder box. */
  source: "own" | "layout" | "master";
  /** True when an enclosing group is rotated or flipped: the box ignores that rotation. */
  approximate?: true;
}

export interface PptxColor {
  /** #RRGGBB after theme and colour-map resolution (luminance and alpha modifiers applied). Absent when it cannot be resolved. */
  color?: string;
  /** The theme slot the colour was named by (for example "accent1", "tx1"). */
  colorRef?: string;
  /** Opacity below 1. */
  alpha?: number;
}

export interface PptxRunSignal extends PptxColor {
  text: string;
  /** Effective Latin family; theme font tokens resolved. */
  font?: string;
  /** Points. */
  size?: number;
  bold?: true;
  italic?: true;
  /** CSS weight: 700 for bold, or the weight a family name states ("Segoe UI Semibold" = 600). Absent for 400. */
  weight?: number;
  underline?: true;
  strike?: true;
  baseline?: "superscript" | "subscript";
  caps?: "all" | "small";
  /** True when the font is a known fixed-width family. */
  monospace?: true;
  /** External hyperlink target. */
  link?: string;
  /** A hyperlink with a PowerPoint action rather than a URL. */
  linkAction?: string;
  /** Field type (slidenum, datetime1, ...); `text` is its cached value. */
  field?: string;
  /** A soft line break; `text` is a newline. */
  lineBreak?: true;
}

export interface PptxParagraphSignal {
  text: string;
  /** Indent level, 0-8; absent = 0. */
  level?: number;
  /** Absent = left. */
  align?: "center" | "right" | "justify" | "distributed";
  /** Effective bullet (inherited from the list style when the paragraph states none); absent = none. */
  bullet?: {kind: "char"; char?: string} | {kind: "number"; scheme: string; startAt?: number} | {kind: "picture"};
  marginLeftPx?: number;
  indentPx?: number;
  lineSpacingPct?: number;
  lineSpacingPt?: number;
  spaceBeforePt?: number;
  spaceBeforePct?: number;
  spaceAfterPt?: number;
  spaceAfterPct?: number;
  /** Adjacent runs with the same effective style are merged. */
  runs: PptxRunSignal[];
  /** True when a bound cut `text` and `runs`. */
  truncated?: true;
}

export interface PptxTextSignal {
  paragraphs: PptxParagraphSignal[];
  /** Paragraph count before any bound. */
  paragraphCount: number;
  /** Characters before any bound. */
  chars: number;
  maxFontSize?: number;
  dominantFont?: string;
  dominantSize?: number;
  /** Share (0-1) of non-space characters set in monospace families; absent when none are. */
  monospaceShare?: number;
  bulletedParagraphs?: number;
  anchor?: "top" | "middle" | "bottom";
  autofit?: "shrink" | "resize" | "none";
  wrap?: "none";
  vertical?: string;
  columns?: number;
}

export interface PptxFillSignal extends PptxColor {
  /** "style" is a theme fill style reference (`styleIndex`) with the shape's colour. */
  kind: "none" | "solid" | "gradient" | "picture" | "pattern" | "group" | "style";
  source?: "placeholder" | "style";
  styleIndex?: number;
  stops?: Array<PptxColor & {position: number}>;
  angle?: number;
  pattern?: string;
}

export interface PptxOutlineSignal extends PptxColor {
  kind: "none" | "solid" | "gradient" | "pattern" | "inherited" | "style";
  source?: "placeholder" | "style";
  styleIndex?: number;
  widthPt?: number;
  dash?: string;
  headArrow?: string;
  tailArrow?: string;
}

/** Where a shape went in the presentation `fromPptx` returned. */
export interface PptxOpfLink {
  /**
   * "block" fed a block (`path`, `blockType`); "title", "subtitle" and "tag" fed that slide field. Other roles name a shape the
   * importer consumed without a block of its own: "furniture" (footer, date, number, section), "background" (the picture of an image background),
   * "image-overlay" (the overlay shape of an image background or image block), "watermark", "logo",
   * and the members of an OPF-tagged group ("code", "metric", "quote", "timeline", "media", "card-frame").
   */
  role: string;
  /** Path in the presentation, for example "slides.2.blocks.1", "slides.0.title", or "slides.1.left" after a tagged round trip. */
  path?: string;
  blockType?: string;
}

export interface PptxShapeSignal {
  /** "s" plus the z-order index; stable under lower limits. */
  id: string;
  /** 0 = back. */
  zOrder: number;
  /** The shape's `id` in the slide XML. */
  nativeId?: number;
  name: string;
  kind: PptxShapeKind;
  /** The id of the enclosing group, or null. */
  parent: string | null;
  /** Group nesting depth, 0 at the slide. */
  depth: number;
  /** Member ids, for a group. */
  children?: string[];
  /** Alt text and title. */
  alt?: string;
  title?: string;
  hidden?: true;
  /** The shape carries OPF tags (an OPF export, edited or not). */
  opfTagged?: true;
  /** Placeholder type ("title", "body", "obj", "sldNum", ...), idx and size. */
  placeholder?: {type: string; idx?: number; size?: string; orientation?: string};
  /** Null when no box is stated or inherited. The frame before rotation. */
  box: PptxBox | null;
  /** Degrees clockwise. */
  rotation?: number;
  flipH?: true;
  flipV?: true;
  geometry?: string;
  fill?: PptxFillSignal;
  outline?: PptxOutlineSignal;
  text?: PptxTextSignal;
  picture?: {part?: string; mediaType?: string; bytes?: number; naturalPx?: {w: number; h: number}; /** Percent cropped per side. */ crop?: {l: number; t: number; r: number; b: number}; tiled?: true; unresolved?: true};
  mediaKind?: "video" | "audio";
  table?: {rows: number; columns: number; columnWidthsPx?: number[]; firstRow: boolean; firstColumn: boolean; bandedRows: boolean; merged?: true; cells: string[][]; truncated?: true};
  chart?: {extended: boolean; part?: string; chartTypes?: string[]; seriesCount?: number; pointCount?: number; barDirection?: string; grouping?: string; title?: string; unreadable?: true};
  graphicType?: string;
  /** The link to the imported OPF; null when the importer made nothing of this shape (a connector, a member of an unsupported frame). */
  opf: PptxOpfLink | null;
  /** Set when this shape's XML could not be read; the rest of the deck is unaffected. */
  unreadable?: string;
}


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
  /** Every theme part's fonts by part path (several themes: one slide master per script profile, opf-pptx#168, and the notes master's). */
  themeParts: Record<string, {major: Partial<Record<"latin" | "ea" | "cs", string>>; minor: Partial<Record<"latin" | "ea" | "cs", string>>}>;
  /** docProps/app.xml "Fonts Used", or null when the package has no readable list. */
  fontsUsed: string[] | null;
}

export interface CheckTypefacesOptions {
  /** Family names the presentation chose (heading, body, code, run fonts). Required. */
  families: string[];
  /** Chosen families that are monospace; their pitchFamily must be fixed pitch, and only theirs. */
  monospace?: string[];
  /** Allow empty theme ea/cs slots and references to them (FF-05). Default true. */
  allowEmptyThemeScripts?: boolean;
  /** Allowed theme script supplements; defaults to THEME_SCRIPT_SUPPLEMENTS. */
  scriptSupplements?: Readonly<Record<"major" | "minor", Readonly<Record<string, string>>>>;
  /** FF-49: the East Asian / complex-script families selected for the theme slots; a selected slot that is empty or different is a `theme-script-slot` violation. */
  themeScripts?: ThemeScriptSelection;
  /** opf-pptx#168: per theme part path (for example `ppt/theme/theme3.xml`), overriding `themeScripts` for that part. */
  themeScriptsByPart?: Record<string, ThemeScriptSelection>;
}

export type ThemeScriptSelection = Partial<Record<"major" | "minor", Partial<Record<"ea" | "cs", string>>>>;

export type TypefaceViolationReason =
  | "foreign-typeface"
  | "foreign-theme-reference"
  | "theme-reference-unresolved"
  | "empty-theme-reference"
  | "empty-typeface"
  | "foreign-script-supplement"
  | "monospace-not-fixed-pitch"
  | "fixed-pitch-not-monospace"
  | "inconsistent-pitch-family"
  | "missing-fonts-used"
  | "foreign-fonts-used"
  | "fonts-used-mismatch"
  | "theme-script-slot";

export interface TypefaceViolation {
  reason: TypefaceViolationReason;
  part: string;
  element?: string;
  typeface?: string;
  [detail: string]: unknown;
}

export declare const THEME_SCRIPT_SUPPLEMENTS: Readonly<Record<"major" | "minor", Readonly<Record<string, string>>>>;

export declare function inventoryTypefaces(input: Uint8Array | ArrayBuffer | Record<string, Uint8Array>, options?: {nested?: boolean}): TypefaceInventory;

export declare function packageFontsUsed(inventory: TypefaceInventory): string[];

export declare function checkTypefaces(input: Uint8Array | ArrayBuffer | Record<string, Uint8Array>, options: CheckTypefacesOptions): {
  ok: boolean;
  violations: TypefaceViolation[];
  inventory: TypefaceInventory;
  /** The "Fonts Used" list the package's own fonts imply. */
  fontsUsed: string[];
};
