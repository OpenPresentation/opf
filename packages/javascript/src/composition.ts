import {tableGrid,type TableCellStyle} from './table.js';
import {inlineChartData,inlineTableData,resolveTableData,tableCellDisplayValue,type DataTableCell} from './chart-data.js';
import {intrinsicImageAspect} from './image-aspect.js';
import {resolveDesignHints,type ResolvedDesignHints} from './design-hints.js';
import {visualReadingOrder} from './reading-order.js';
import {layoutLeaves,layoutSlots,type LayoutSlot} from './layout-content.js';
import type {MetricSentiment} from './metric-trend.js';
export {visualReadingOrder,type ReadingBox} from './reading-order.js';
/** The pixel size and aspect (width / height) of an embedded picture (a data URI, or an `asset:<id>` that names one), the reading composeSlide uses, for engines that place host-resolved pictures. */
export {intrinsicImageAspect,intrinsicImageSize} from './image-aspect.js';
import {paragraphDirection,paragraphDirectionAt,physicalAlignment,type PhysicalAlignment,type TextDirection} from './direction.js';
import {resolveSlideDirection} from './script-fonts.js';
import {ENGINE_DEFAULT_FONT_SCHEME,SOCIAL_PLATFORMS} from './engine-vocabularies.js';
export {CHART_TYPES,ENGINE_DEFAULT_CHART_TYPES,ENGINE_DEFAULT_COLOR_SCHEME,ENGINE_DEFAULT_FONT_SCHEME,ENGINE_DEFAULT_THEME,LANGUAGES,SOCIAL_PLATFORMS,type LanguageVocabulary,type SocialPlatformVocabulary} from './engine-vocabularies.js';
export {CATALOG_REFERENCE_PATTERN,OPFCatalogsOptionError,OPFUnresolvedReferenceError,catalogGroupSource,catalogKinds,catalogRecords,catalogReferenceSites,parseReference,resolveReference,unresolvedReference,type Catalog,type CatalogKind,type CatalogOptions,type CatalogRecords,type CatalogReferenceSite,type RecordProvenance,type ResolvedReference,type UnresolvedReferenceDiagnostic} from './catalog-refs.js';
export {paragraphDirection,paragraphDirectionAt,physicalAlignment,type PhysicalAlignment,type TextDirection} from './direction.js';
import {listNumbers,type ListNumber,type NumberingInput} from './numbering.js';
export {NUMBERING_STYLES,NUMBERING_SUFFIXES,MAX_NUMBERING_VALUE,MAX_ROMAN_VALUE,MAX_NUMBERING_LEVELS,formatListNumber,listNumbers,resolveNumbering,numberingAtLevel,numberingStyleDraws,sliceNumberedItems,type Numbering,type NumberingInput,type NumberingStyleName,type NumberingSuffix,type ResolvedNumbering,type ListNumber} from './numbering.js';
import {DEFAULT_FURNITURE_DATE_FORMAT,formatFurnitureDate,parseIsoDate,type FurnitureField} from './furniture-fields.js';
import {substituteSlideTokens,usesSlideBuiltin} from './slide-variables.js';
export {DEFAULT_FURNITURE_DATE_FORMAT,formatFurnitureDate,type FurnitureField} from './furniture-fields.js';
export {tableGrid,tableRowBoundaries,type TableCellStyle,type TableBorder,type TableGrid,type TableGridCell,type TableGridIssue} from './table.js';
export {colorContrast, textColorForFill, chartColorForFill, chartPaletteForFill, chartHighlightColors, normalizeHexColor, resolveColorRef, resolveColorRoles, defaultSlideBackground, isDarkColor, surfaceAltColor, CHART_SERIES_MIN_LIGHTNESS_STEP, CHART_SERIES_MIN_DIFFERENCE, CHART_HIGHLIGHT_MUTED_MIX, CHART_HIGHLIGHT_MUTED_MIN_CONTRAST, DARK_BACKGROUND_LUMINANCE, SURFACE_ALT_MIX, SURFACE_ALT_MIN_CONTRAST} from './color.js';
export type {ResolveColorRefOptions, ResolveColorRefRoles, ResolveColorRolesOptions, ResolvedColorRoles} from './color.js';
export {resolveScriptFonts, resolveSlideDirection, scriptFontRole} from './script-fonts.js';
export type {ResolveScriptFontsOptions, ResolvedScriptFonts, ScriptFontApp, ScriptFontSlots, ScriptFontSource, ScriptFontSupplement, ScriptRole} from './script-fonts.js';
export {CODE_HIGHLIGHT_LANGUAGES, CODE_HIGHLIGHT_MAX_LENGTH, CODE_PANEL_BACKGROUND, CODE_PANEL_FOREGROUND, CODE_SYNTAX_MIN_CONTRAST, codeLineRuns, codeSyntaxPalette, codeSyntaxPaletteForScheme, resolveCodeLanguage, tokenizeCode} from './code-syntax.js';
export type {CodeRun, CodeSyntaxPalette, CodeSyntaxPaletteOptions, CodeSyntaxPaletteTheme, CodeToken, CodeTokenKind} from './code-syntax.js';
export {METRIC_TREND_MIN_CONTRAST, METRIC_TREND_SHAPES, metricTrendColor, metricTrendMark, metricTrendPoints} from './metric-trend.js';
export type {MetricSentiment, MetricTrend, MetricTrendColorOptions, MetricTrendMark} from './metric-trend.js';
export {TIMELINE_OUTLINE_MIN_CONTRAST, TIMELINE_STATUSES, TIMELINE_TEXT_MIN_CONTRAST, timelineMarkerShapes, timelineTextColor} from './timeline-status.js';
export type {TimelineMarkerShape, TimelineStatusColors} from './timeline-status.js';
export {codeHighlightBands, codeHighlightColors, codeHighlightLines, codeLineNumbers} from './code-highlight.js';
export type {CodeHighlightBand, CodeHighlightColors, CodeHighlightEntry, CodeHighlightIssue, CodeHighlightLines} from './code-highlight.js';
export {layoutWatermark} from './watermark.js';
export type {WatermarkTextLayout, WatermarkTextOptions} from './watermark.js';
export {PATTERN_PRESETS, PATTERN_PRESET_ALIASES, PATTERN_TILE_SIZE, patternBitmap, patternRuns, resolvePatternPreset} from './pattern-fills.js';
import {CAPTIONABLE_FIELDS,CITATION_MARKER_RAISE,CITATION_MARKER_SCALE,FOOTNOTE_MAX_RATIO,annotationText,layoutCaption,layoutFootnotes,slideCitations,type ComposedCaption,type ComposedFootnotes,type RichText} from './annotations.js';
export {CAPTIONABLE_FIELDS,CAPTION_FONT_RATIO,CAPTION_MAX_RATIO,CITATION_MARKER_RAISE,CITATION_MARKER_SCALE,FOOTNOTE_MAX_RATIO,annotationText,captionSettings,citationMarkerText,collectCitations,layoutCaption,layoutFootnotes,referencesSlide,slideCitations,walkCitationRuns} from './annotations.js';
export type {AnnotatedRun,AnnotationFitter,AnnotationLayoutOptions,Caption,CaptionAlignment,CaptionObject,CaptionPosition,CaptionSettings,CitationMarker,CitationNote,ComposedCaption,ComposedFootnoteEntry,ComposedFootnotes,DeckCitations,FootnoteLayoutOptions,Reference,ReferencesSlideOptions,RichText,SlideCitations} from './annotations.js';
/** Portable layout geometry. No fonts, DOM, renderer, or network dependencies. */
export interface Composition {
  mode?: "auto" | "grid" | "row" | "column";
  columns?: number;
  gap?: number;
  padding?: number;
  weights?: number[];
  minFontSize?: number;
  overflow?: "warn" | "error";
}
export const MAX_COMPOSITION_DEPTH = 32;
export interface LayoutBox { x: number; y: number; width: number; height: number }
export interface LayoutDiagnostic {
  code: "text-overflow" | "small-cell" | "unresolved-content" | "unsupported-image-treatment" | "numbering-adapted";
  path: string;
  message: string;
}
/** Physical legacy-family selection supplied by a font provider, independently of its numeric weight. */
export interface FontFaceSelection { family: string; bold: boolean; italic: boolean }
export interface TextStyle { fontFamily: string; fontWeight: number; italic?: boolean; path?: string; fontFace?: FontFaceSelection;
  /** BCP-47 tag of a run that overrides the deck language (`TextRun.lang`); absent when the deck language applies. */
  lang?: string }
/** Role families. `accent` is present only when the scheme defines an accent role; the slide tag and quote body use it. */
export interface FontFamilies { heading: string; body: string; code: string; accent?: string }
/** Documented monospace fallback for the code role when a resolved scheme defines no `code`. */
const FALLBACK_CODE_FAMILY = "Roboto Mono";
/** Heading and body families of ENGINE_DEFAULT_FONT_SCHEME (spec/reference/engine-defaults.json), the one last resort
 * every engine shares, so preview matches export (font-fidelity-everywhere owner decision). */
const DEFAULT_FONT_FAMILIES = { heading: String(ENGINE_DEFAULT_FONT_SCHEME.major), body: String(ENGINE_DEFAULT_FONT_SCHEME.minor) } as const;
/** Resolve role families from an already-merged font scheme (the resolved record plus design overrides).
 * A scheme that names no heading or body family gets the engine default families (Aptos Display, Aptos).
 * `code` comes from the scheme's `code` role, which catalog records such as consolas and courier-new
 * carry; otherwise it is Roboto Mono. Heading and body families are never reused for code.
 * `accent` is returned only when the scheme defines an `accent` role (a family name string);
 * the slide tag and the quote body use it in place of the body and heading families. */
export function resolveFontFamilies(input: unknown): FontFamilies {
  const scheme = record(input);
  const family = (value: unknown) => typeof value === "string" && value ? value : undefined;
  const accent = family(scheme.accent);
  return {
    heading: family(scheme.heading) ?? scheme.major ?? scheme.minor ?? DEFAULT_FONT_FAMILIES.heading,
    body: family(scheme.body) ?? scheme.minor ?? scheme.major ?? DEFAULT_FONT_FAMILIES.body,
    code: family(scheme.code) ?? FALLBACK_CODE_FAMILY,
    ...(typeof accent === "string" && accent ? { accent } : {}),
  };
}
export interface TextMeasurement {
  measure: (text: string, fontSize: number, style: TextStyle) => number;
  resolveStyle?: (style: TextStyle) => TextStyle;
  /** Shaped vector ink relative to the left baseline origin (positive y down).
   * Null means no outline. These are not hinted/antialiased raster bounds. */
  outlineBounds?: (text: string, fontSize: number, style: TextStyle) => LayoutBox | null;
}
/**
 * The fonts handle every deck-level verb takes as `{ fonts }`. Core reads only `textMeasurement`: how wide the
 * host's real fonts draw a string. The renderer's `loadFonts()` returns a richer handle (embedded fonts, font
 * files, registry, manifest) that extends this one, so the same object goes to every verb.
 */
export interface Fonts {
  textMeasurement?: TextMeasurement;
}
export type MeasureTextWidth = (text: string, fontSize: number) => number;
export function resolveTextStyle(style: TextStyle, measurement?: TextMeasurement): TextStyle {
  return measurement?.resolveStyle ? measurement.resolveStyle(style) : style;
}
export function textWidthMeasurer(style: TextStyle, measurement?: TextMeasurement): MeasureTextWidth {
  if (!measurement) return measureText;
  return (text, size) => {
    const width = measurement.measure(text, size, style);
    if (!Number.isFinite(width) || width < 0) throw new RangeError('Text measurement must return a finite, nonnegative width.');
    return width;
  };
}
/** Validate an optional host outline measurement without inventing raster coverage. */
export function measureTextOutline(text: string, fontSize: number, style: TextStyle, measurement?: TextMeasurement): LayoutBox | null | undefined {
  if (measurement?.outlineBounds === undefined) return undefined;
  if (typeof measurement.outlineBounds !== 'function') throw new TypeError('Text outline provider must be a function.');
  const bounds = measurement.outlineBounds(text, fontSize, style);
  if (bounds === null) return null;
  if (!bounds || ![bounds.x,bounds.y,bounds.width,bounds.height].every(Number.isFinite) || bounds.width < 0 || bounds.height < 0) {
    throw new RangeError('Text outline measurement must return null or finite bounds with nonnegative dimensions.');
  }
  return {x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height};
}
export interface TextLineInk { width: number; y: number; baseline: number; height: number; outline: LayoutBox | null }
export interface TextPlacementLine {
  x: number; y: number; baseline: number; height: number; width: number; outline: LayoutBox | null;
  /** Physical alignment this line was placed with. Present only in a right-to-left deck, where `left` and `right` are logical start and end. */
  alignment?: PhysicalAlignment;
}
export interface TextPlacement {
  alignment: 'left' | 'center' | 'right';
  /** Reference-pixel clearance around vector outlines; not a universal raster guarantee. */
  rasterPadding: number;
  lines: TextPlacementLine[];
  height: number;
  overflow: boolean;
}
export interface TextFit {
  lines: string[]; fontSize: number; lineHeight: number; overflow: boolean; placement?: TextPlacement;
  /**
   * Base direction of the paragraph each line belongs to, in line order. Present only when the fit was
   * made for a right-to-left deck; every wrapped line shares its paragraph's direction (RR-05).
   */
  directions?: TextDirection[];
}
/** Place complete measured lines, preserving alignment where it leaves room for ink.
 * Move following baselines together when outlines need more vertical separation. */
export function placeTextLines(lines: readonly TextLineInk[], box: LayoutBox, alignment: TextPlacement['alignment']='left', rasterPadding=0, directions?: readonly TextDirection[]): TextPlacement {
  if (!Array.isArray(lines)||!box||![box.x,box.y,box.width,box.height,rasterPadding].every(Number.isFinite)||box.width<=0||box.height<=0||rasterPadding<0||!['left','center','right'].includes(alignment)) throw new RangeError('Text placement requires lines, finite positive dimensions, nonnegative padding and a valid alignment.');
  const placed:TextPlacementLine[]=[];
  let shift=0,bottom=box.y,height=0,overflow=false;
  for(const [lineIndex,line] of lines.entries()) {
    // Logical alignment: a right-to-left line starts at the right edge (RR-05).
    const lineAlignment=physicalAlignment(alignment,directions?.[lineIndex]),factor=lineAlignment==='right'?1:lineAlignment==='center'?.5:0;
    if(!line||![line.width,line.y,line.baseline,line.height].every(Number.isFinite)||line.width<0||line.height<=0||line.y<0||line.baseline<line.y) throw new RangeError('Text lines require finite coordinates, nonnegative advances and a baseline at or below their top.');
    const ink=line.outline;
    if(ink!==null&&(!ink||![ink.x,ink.y,ink.width,ink.height].every(Number.isFinite)||ink.width<0||ink.height<0)) throw new RangeError('Text outlines must be null or finite coordinates with nonnegative dimensions.');
    let x=box.x+(box.width-line.width)*factor;
    if(ink) {
      const low=box.x+rasterPadding-ink.x,high=box.x+box.width-rasterPadding-ink.x-ink.width;
      if(low>high+.01)overflow=true;else x=Math.max(low,Math.min(x,high));
      shift+=Math.max(0,bottom+rasterPadding-(box.y+line.baseline+shift+ink.y));
    }
    const y=box.y+line.y+shift,baseline=box.y+line.baseline+shift;
    const outline=ink?{...ink,x:x+ink.x,y:baseline+ink.y}:null;
    if(outline)bottom=outline.y+outline.height+rasterPadding;
    height=Math.max(height,y+line.height-box.y,outline?bottom-box.y:0);
    if(line.width>box.width+.01||height>box.height+.01)overflow=true;
    placed.push({x,y,baseline,height:line.height,width:line.width,outline,...(directions?{alignment:lineAlignment}:{})});
  }
  return {alignment,rasterPadding,lines:placed,height,overflow};
}
/** Keep accepted line and outline origins aligned when a heading box is recentered. */
function translateTextFit<T extends {placement?: TextPlacement}>(fit: T, dy: number): T {
  if (!dy || !fit.placement) return fit;
  return {
    ...fit,
    placement: {
      ...fit.placement,
      lines: fit.placement.lines.map(line => ({
        ...line,
        y: line.y + dy,
        baseline: line.baseline + dy,
        outline: line.outline ? {...line.outline, y: line.outline.y + dy} : line.outline,
      })),
    },
  };
}
export interface ComposedItem {
  path: string;
  field: string;
  type: string;
  value: unknown;
  payload: Record<string, unknown>;
  box: LayoutBox;
  /** Optional visible card allocation; box and all accepted internals occupy its padded interior. */
  frameBox?: LayoutBox;
  text?: TextFit | RichTextFit | ListFit | CodeTextFit;
  textStyle?: TextStyle;
  /** Complete accepted quote internals; consumers must reuse these fits and styles. */
  quoteLayout?: QuoteLayout;
  /** Complete accepted code internals, including source lines and literal tab positions. */
  codeLayout?: CodeLayout;
  /** Complete shared metric geometry, including its unit, label and metadata. */
  metricLayout?: MetricLayout;
  /** Complete timeline fields, markers and connector accepted by composition. */
  timelineLayout?: TimelineLayout;
  /**
   * Picture bullet for `items`/`bullets` payloads when the effective `design.listBullet` is `image`
   * and the deck's icon logo resolves. Every entry marker in `text.listEntries` carries the same value.
   */
  bulletImage?: ListBulletImage;
  /**
   * Caption band of an image, chart, table or video payload that carries `caption` (RR-34). `box` is
   * the media box after the band is reserved; `caption.box` is the band inside the same region.
   */
  caption?: ComposedCaption;
  /** Picture geometry and treatments of an image item (`field` image); absent on every other item. */
  image?: ComposedImage;
  /** Effective container settings, including inherited readability constraints. */
  composition: Composition;
  /**
   * Resolved horizontal text alignment for this item: titleAlignment for the
   * title, contentAlignment for every other item (slide design, deck design, layout design,
   * then left). Engines anchor native and preview text to this value.
   */
  alignment: 'left' | 'center' | 'right';
}
/** How a picture fills its frame: cover crops around the focus, contain shows all of it, stretch scales it to the frame. */
export type ImageFit = 'cover' | 'contain' | 'stretch';
/** A background also tiles: the picture repeats at its own size from the canvas's top-left corner. */
export type BackgroundImageFit = ImageFit | 'tile';
/** A slide or frame edge, physical (already mirrored in a right-to-left deck). */
export type ImageEdge = 'left' | 'right' | 'top' | 'bottom';
/** A point of a picture as fractions of its width and height from the top-left corner; the default is { x: 0.5, y: 0.5 }. */
export interface ImageFocus { x: number; y: number }
/** A frame mask. path follows the ECMA-376 preset formula for preset/adjust exactly, in reference pixels. */
export interface ImageShape {
  kind: 'rectangle' | 'rounded' | 'circle' | 'hexagon';
  preset: 'rect' | 'roundRect' | 'ellipse' | 'hexagon';
  /** DrawingML avLst guide values (for example adj and vf), in 1/100000 units. */
  adjust: Record<string, number>;
  path: string;
}
/** One overlay, shared by image backgrounds and image blocks: drawn directly above its picture, beneath content. */
export interface ComposedOverlay {
  /** OPF path of the overlay value, for example `slides.3.design.background.overlay` or `slides.3.blocks.0.overlay`. */
  path: string;
  /** ColorRef as authored (hex, eight-digit hex alpha, scheme slot or role, `var:<id>`); engines resolve it. */
  color: unknown;
  /** Fill opacity, 0 to 1, multiplied with any eight-digit hex alpha. */
  opacity: number;
  /** Physical edge of a band overlay; absent when the overlay covers the whole frame. */
  edge?: ImageEdge;
  /** Area covered: the whole frame, or the edge band. */
  box: LayoutBox;
  /** Outline to fill: the frame's shape for a whole-frame overlay, a rectangle for a band. */
  shape: ImageShape;
}
/** Where the whole picture lands for a fit, for a picture whose aspect ratio is known (see `fitImage`). */
export interface ImageFitPlacement {
  /** The whole picture's rectangle in slide coordinates: past the frame for cover, inside it for contain, the frame for stretch. */
  image: LayoutBox;
  /** DrawingML srcRect insets as fractions of the picture (positive crops, negative pads); all 0 for stretch. */
  crop: { left: number; top: number; right: number; bottom: number };
}
/** A placed image block's band (FA-22): the image bleeds to `edge` and the rest of the slide composes beside it. */
export interface ComposedPlacement {
  /** Physical edge: in a right-to-left deck an authored `left` (the start side) is `right` here. */
  edge: ImageEdge;
  /** Share of the slide width (left, right) or height (top, bottom), 0.1 to 0.9. */
  size: number;
  /** True when the frame sits inside the slide padding instead of edge to edge. */
  inset: boolean;
  /** Where the placement is written: `slides.N.blocks.I.placement`, or `layout.placeholders.P.placement` for a layout image placeholder's. */
  path: string;
}
/**
 * Resolved picture geometry of an image item (FA-22): every composed item with `field` 'image' carries one. Engines
 * draw the picture in `box` with `fit` and `focus`, clipped to `shape`, with `recolor` and `opacity` on its pixels
 * only, then the `border` on the shape outline, then the `overlay`. This is the paint order and the treatment code
 * 0.14's slide image used.
 */
export interface ComposedImage {
  /** Allocated region, equal to the item's box: the flow cell (after any card padding and caption band) or the placement band. */
  region: LayoutBox;
  /** Picture frame inside the region: the band inside the slide padding for an inset placement, then the largest centered box with `aspectRatio` (a circle uses 1). */
  box: LayoutBox;
  /** The block's own fit, else the effective design.imageFit, else cover. */
  fit: ImageFit;
  focus: ImageFocus;
  /** Mask on the frame: a DrawingML preset with its guide values, and the same outline as an SVG path. */
  shape: ImageShape;
  /** Line centered on the shape outline; width in reference pixels, already scaled to the canvas. */
  border?: { color: unknown; width: number };
  /** Picture opacity below 1; the border and overlay are not affected. */
  opacity?: number;
  /** Luminance-based recolor (Rec. 601 weights on sRGB values). */
  recolor?: { type: 'grayscale' } | { type: 'duotone'; dark: unknown; light: unknown };
  overlay?: ComposedOverlay;
  /** Present on a placed block: the band along a slide edge that `region` is. */
  placement?: ComposedPlacement;
  /** Present when core reads the picture's aspect ratio (a data URI, or an `asset:` reference to one); otherwise call `fitImage` with the host's. */
  picture?: ImageFitPlacement;
}
/**
 * The slide's picture background (FA-22): the effective `design.background` (the slide's, then the deck's, then
 * `ComposeSlideOptions.themeBackground`) when it is an image, in object form or as an image-source string. It fills
 * the whole canvas behind everything and never moves content. Paint order: the colour scheme's default slide
 * background, the picture (with `recolor` and `opacity` on its pixels), the overlay, then furniture and content.
 */
export interface ComposedBackgroundImage {
  /** Where the background is written: `slides.N.design.background`, `design.background`, or `theme` (ComposeSlideOptions.themeBackground). */
  path: string;
  /** Image source as authored: `asset:<id>`, an https URL, a data URI or a relative path. */
  src: string;
  alt?: string;
  fit: BackgroundImageFit;
  focus: ImageFocus;
  /** The whole canvas. */
  box: LayoutBox;
  /** Picture opacity below 1; the overlay keeps its own. */
  opacity?: number;
  /** Luminance-based recolor of the pixels (Rec. 601 weights on sRGB values), as on an image block. */
  recolor?: { type: 'grayscale' } | { type: 'duotone'; dark: unknown; light: unknown };
  overlay?: ComposedOverlay;
  /** Present when core reads the picture's aspect ratio and the fit is not tile; otherwise call `fitImage` with the host's. */
  picture?: ImageFitPlacement;
}
/** Which logo variant family a consumer asks for: the full lockup, a square mark, or a stacked lockup. */
export type LogoSlot = 'lockup' | 'icon' | 'stacked';
/** A logo asset chosen by resolveLogo, with its source value, OPF path, LogoSet variant key and the slot it serves. */
export interface ResolvedLogo { source: unknown; path: string; variant: string; slot: LogoSlot }
/**
 * The deck logo drawn on a cover or section slide, at the top-left of the free area and above the
 * centered heading group. Consumers fit the image inside `box` preserving its aspect ratio,
 * anchored left and vertically centered; content slides never carry one.
 */
export interface ComposedLogo { box: LayoutBox; slot: 'lockup'; path: string; source: unknown; variant: string; anchor: 'left' | 'right' }
/** Picture bullet source for list markers: the deck's icon logo and the OPF path it was read from. */
export interface ListBulletImage { source: unknown; path: string }
export interface ComposedGroup { path: string; box: LayoutBox; contentBox: LayoutBox; composition: Composition }
/**
 * FA-26: one body placeholder of a layout record that has placeholder groups, as composed: its cell and, for a filled
 * region, the slide content in it. Groups and empty regions are listed too, so an editor can draw every slot. Only
 * slides that compose through a record's placeholder groups carry slots.
 */
export interface ComposedSlot {
  /** The placeholder: `layout.placeholders.2`, or `layout.placeholders.2.placeholders.0` inside a group. */
  path: string;
  /** The region's content kind, or `group`. */
  type: string;
  /** 0 at the record's top level, else the level of the group that holds it (1 to 3). */
  depth: number;
  /** The slot's cell (before any card inset or caption band). */
  box: LayoutBox;
  /** The OPF path of the content that fills a region; absent for a group and for an empty region. */
  content?: string;
}
/** The placeholder kind a slide payload field fills (`items` a list region, `bullets` a text region). */
const FIELD_KINDS: Readonly<Record<string, string>> = { text: 'text', bullets: 'text', items: 'list', image: 'image', video: 'video', chart: 'chart', table: 'table', code: 'code', metric: 'metric', quote: 'quote', timeline: 'timeline' };
/**
 * FA-26: design.chartPrimary is sugar for a placeholder group. The layout record a slide composes as while chartPrimary
 * applies: the primary chart and one automatic placeholder group of the other root content (`kinds`, in source order),
 * in a row (left, right) or a column (top, bottom) weighted 3:2 toward the chart. composeSlide builds exactly this record
 * and fills it like any record with groups, except that the first chart, wherever it is, fills the chart region.
 */
export function chartPrimaryLayout(side: 'left' | 'right' | 'top' | 'bottom', kinds: readonly string[]): { composition: Composition; placeholders: Record<string, unknown>[] } {
  const first = side === 'left' || side === 'top';
  const group = { type: 'group', composition: {}, placeholders: kinds.map(type => ({ type })) };
  return { composition: { mode: side === 'left' || side === 'right' ? 'row' : 'column', weights: first ? [3, 2] : [2, 3] }, placeholders: first ? [{ type: 'chart' }, group] : [group, { type: 'chart' }] };
}
export interface CompositionTrack { offset: number; size: number }
/** Resolved flow geometry, including empty reserved slots. Promoted regions are not flows. */
export interface ComposedFlow {
  path: string;
  box: LayoutBox;
  composition: Composition;
  columns: CompositionTrack[];
  rows: CompositionTrack[];
  gap: number;
  itemCount: number;
  slotCount: number;
}
/** Additive penalties in grid-score-v9; lower is preferred. These are not quality percentages. */
export interface CompositionPenalties {
  cellProportions: number;
  fontReduction: number;
  textOverflow: number;
  tableOverflow: number;
  smallCells: number;
  emptySlots: number;
}
export interface CompositionCandidate {
  columns: number;
  rows: number;
  score: number;
  penalties: CompositionPenalties;
}
export interface CompositionDecision {
  path: string;
  mode: NonNullable<Composition['mode']> | 'regions';
  /** `chart-primary`: the root split a primary chart from a synthetic container of the other nodes (design.chartPrimary). */
  reason: 'lowest-score' | 'configured-mode' | 'promoted-regions' | 'chart-primary';
  selectedColumns?: number;
  /** Only candidates actually evaluated by automatic selection, in tie-break order. */
  candidates: CompositionCandidate[];
}
export interface CompositionExplanation {
  algorithm: 'grid-score-v9';
  /** Provided widths do not establish shaping, glyph coverage or native fidelity. */
  textMeasurement: 'estimated' | 'provided';
  /** Optional vector coverage for headings and scalar/rich text, not every payload. */
  textOutlines: 'provided' | 'unavailable';
  /** Effective body-text reference pixels; furniture reports its own placement padding. Not a universal raster tolerance. */
  textRasterPadding: number;
  decisions: CompositionDecision[];
  /** Payloads whose complete internal fit is not covered by this scoring model. */
  unmeasuredPayloads: string[];
}
export interface SlideComposition {
  width: number;
  height: number;
  contentBox: LayoutBox;
  items: ComposedItem[];
  groups: ComposedGroup[];
  flows: ComposedFlow[];
  /** FA-26: the layout record's body placeholders with their cells, when the slide composes through placeholder groups. */
  slots?: ComposedSlot[];
  diagnostics: LayoutDiagnostic[];
  composition: Composition;
  /** Repeated furniture is measured separately from body pagination leaves. */
  furniture?: FurnitureLayout;
  /**
   * Effective shared design hints of this slide: slide design, then deck design, then the layout record's design,
   * per key. Renderers and exporters read titleAlignment, contentAlignment, contentBox and
   * listBullet here instead of re-deriving them from the document; image items carry their resolved fit in `image.fit`.
   */
  design: ResolvedDesignHints;
  /** Picture background of this slide; absent when the effective background is not an image. */
  backgroundImage?: ComposedBackgroundImage;
  /** Deck logo on a cover or section slide; absent on content slides and when no logo resolves. */
  logo?: ComposedLogo;
  /**
   * Footnote area of a slide whose runs cite references or carry footnotes (RR-34): directly above the
   * footer band, the content area is shrunk by exactly its height. Absent on slides without markers.
   */
  footnotes?: ComposedFootnotes;
  /** `rtl` when the slide was composed for a right-to-left deck (mirrored arrangement); absent for left-to-right decks. */
  direction?: 'rtl';
  explanation?: CompositionExplanation;
}
export interface ComposeSlideOptions {
  /** Context for inherited furniture, generated organization names, social profiles, logos, layout hints, references and marker numbering. */
  presentation?: { language?: unknown; design?: { header?: unknown; footer?: unknown; background?: unknown; imageFit?: unknown; logo?: unknown; contentDirection?: unknown; chartPrimary?: unknown; listBullet?: unknown; titleAlignment?: unknown; contentAlignment?: unknown; contentBox?: unknown }; organization?: unknown; speaker?: unknown; slides?: unknown; catalogs?: unknown; references?: unknown; datasets?: unknown };
  /**
   * Whether the slide background is dark, by the host's own luminance test. Selects the light logo
   * variants (cover logo, furniture `logo: true`, picture bullets). Core never inspects colors.
   */
  darkBackground?: boolean;
  /**
   * The resolved theme's `background`, the lowest level of the background chain (the slide's design.background, then
   * the deck's, then this). Only an image background produces geometry (`SlideComposition.backgroundImage`).
   * `resolveSlideContext` passes it.
   */
  themeBackground?: unknown;
  /** One-based displayed number for `{{slide.number}}` in header/footer text; source paths still use slideIndex. */
  slideNumber?: number;
  /** Displayed slide count for `{{deck.slideCount}}` in header/footer text. Defaults to `presentation.slides.length`. */
  slideCount?: number;
  /**
   * Host-supplied current calendar date (ISO YYYY-MM-DD) for `date: true` furniture. Core never
   * consults a clock; without this option a current date is reported as unresolved content.
   */
  date?: string;
  fontFamilies?: Partial<FontFamilies>;
  /**
   * Deck base direction (RR-05). Defaults to the direction of the presentation language's script. In a right-to-left deck
   * composition mirrors the arrangement (the first column or `left` region is drawn at the right, slide images, logos and
   * header/footer zones swap sides, tables run right to left), lists put their markers at the right, and every text fit
   * reports each paragraph's direction. Alignment stays logical: `left` is the start edge.
   */
  direction?: TextDirection;
  /** Deck-level alignment a host resolved itself. It ranks with `presentation.design`, above the layout record's design and below the slide's own design; hosts normally omit it because composition reads `presentation.design` and the layout. */
  contentAlignment?: 'left' | 'center' | 'right';
  titleAlignment?: 'left' | 'center' | 'right';
  /** Unscaled reference pixels around provided vector outlines; defaults to 1 for body text and 2 for furniture. Explicit values apply to both. */
  textRasterPadding?: number;
  /** Deck-level body cards a host resolved itself, ranked like contentAlignment. A slide's explicit design.contentBox overrides this value. */
  contentBox?: boolean;
  textMeasurement?: TextMeasurement;
  width?: number;
  height?: number;
  slideIndex?: number;
  layout?: Record<string, unknown>;
  /** Return candidate scores and coverage without changing the selected geometry. */
  explain?: boolean;
}
export class OPFCompositionError extends Error {
  readonly code = "layout-overflow";
  readonly explanation?: CompositionExplanation;
  constructor(public readonly diagnostics: LayoutDiagnostic[], explanation?: CompositionExplanation) {
    super("Slide content does not fit its composition.");
    this.name = "OPFCompositionError";
    if (explanation) this.explanation = explanation;
  }
}
const fields = ["text", "items", "bullets", "image", "video", "chart", "table", "code", "metric", "quote", "timeline"];
const headings = new Set(["title", "subtitle", "tag"]);
const rows = ["top", "middle", "bottom"];
const columns = ["left", "center", "right"];
const record = (value: unknown): Record<string, any> => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const kind = (field: string) => field === "items" ? "list" : field === "bullets" ? "text" : field;
const round = (value: number) => Math.round(value * 1e6) / 1e6 || value;
/** Default share of the slide width (left/right) or height (top/bottom) given to a placed image's band. */
const PLACEMENT_BAND = 0.5;
const IMAGE_EDGES = ['left', 'right', 'top', 'bottom'] as const;
const IMAGE_FITS = ['cover', 'contain', 'stretch'] as const;
const BACKGROUND_FITS = ['cover', 'contain', 'stretch', 'tile'] as const;
/** Image sources the background string shorthand accepts (opf.schema.json ImageSource). */
const IMAGE_SOURCE = /^(asset:|https:\/\/|data:|\.\/|\.\.\/)/;
/** Image block keys a composed image item reports in its payload, beside `type` and `image`. */
const IMAGE_OPTION_KEYS = ['fit', 'focus', 'aspectRatio', 'shape', 'cornerRadius', 'border', 'opacity', 'recolor', 'overlay', 'placement'] as const;
const imagePayload = (host: Record<string, any>): Record<string, unknown> => {
  const payload: Record<string, unknown> = { type: host.type ?? 'image', image: host.image };
  for (const key of IMAGE_OPTION_KEYS) if (host[key] !== undefined) payload[key] = host[key];
  return payload;
};
const assetSource = (value: unknown): unknown => typeof value === 'string' ? value : record(value).src;
const finite = (value: unknown, min: number, max: number): number | undefined => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : undefined;
const pathNumber = (value: number) => String(round(value));
const IMAGE_SHAPES = { rectangle: 'rect', rounded: 'roundRect', circle: 'ellipse', hexagon: 'hexagon' } as const;
const roundBox = (box: LayoutBox): LayoutBox => ({ x: round(box.x), y: round(box.y), width: round(box.width), height: round(box.height) });
/** A valid focus point, else the center. */
const imageFocus = (value: unknown): ImageFocus => {
  const focus = record(value), x = finite(focus.x, 0, 1), y = finite(focus.y, 0, 1);
  return x !== undefined && y !== undefined ? { x, y } : { x: 0.5, y: 0.5 };
};

/**
 * Outline of a DrawingML preset in a box, following the ECMA-376 presetShapeDefinitions formulas:
 * roundRect (adj; ss = min(w,h), radius = ss*adj/100000), ellipse, and hexagon (adj, vf).
 */
export function imageShape(kind: ImageShape['kind'], box: LayoutBox, cornerRadius = 1 / 6): ImageShape {
  const { x, y, width: w, height: h } = box, r = x + w, b = y + h, ss = Math.min(w, h), n = pathNumber;
  const rect = `M${n(x)} ${n(y)}H${n(r)}V${n(b)}H${n(x)}Z`;
  if (kind === 'rounded') {
    const adj = Math.round(Math.min(0.5, Math.max(0, cornerRadius)) * 100000), radius = ss * adj / 100000;
    const path = radius <= 0 ? rect : `M${n(x)} ${n(y + radius)}A${n(radius)} ${n(radius)} 0 0 1 ${n(x + radius)} ${n(y)}H${n(r - radius)}A${n(radius)} ${n(radius)} 0 0 1 ${n(r)} ${n(y + radius)}V${n(b - radius)}A${n(radius)} ${n(radius)} 0 0 1 ${n(r - radius)} ${n(b)}H${n(x + radius)}A${n(radius)} ${n(radius)} 0 0 1 ${n(x)} ${n(b - radius)}Z`;
    return { kind, preset: 'roundRect', adjust: { adj }, path };
  }
  if (kind === 'circle') {
    const cy = y + h / 2;
    return { kind, preset: 'ellipse', adjust: {}, path: `M${n(x)} ${n(cy)}A${n(w / 2)} ${n(h / 2)} 0 1 1 ${n(r)} ${n(cy)}A${n(w / 2)} ${n(h / 2)} 0 1 1 ${n(x)} ${n(cy)}Z` };
  }
  if (kind === 'hexagon') {
    const adj = 25000, vf = 115470, a = Math.min(Math.max(adj, 0), 50000 * w / ss);
    const x1 = ss * a / 100000, x2 = r - x1, vc = y + h / 2, dy1 = h / 2 * vf / 100000 * Math.sin(Math.PI / 3);
    return { kind, preset: 'hexagon', adjust: { adj, vf }, path: `M${n(x)} ${n(vc)}L${n(x + x1)} ${n(vc - dy1)}L${n(x2)} ${n(vc - dy1)}L${n(r)} ${n(vc)}L${n(x2)} ${n(vc + dy1)}L${n(x + x1)} ${n(vc + dy1)}Z` };
  }
  return { kind: 'rectangle', preset: 'rect', adjust: {}, path: rect };
}

/**
 * The shared fit math every engine uses (FA-22). `aspect` is the picture's width / height. cover scales the picture
 * to cover the frame and centers the focus point in the frame as far as the picture still covers it, so the focus
 * point always stays in view ({0.5, 0.5} is a center crop, {0, 0} keeps the top-left corner). contain scales it to
 * fit and centers it; stretch fills the frame exactly. Focus applies to cover only. `crop` holds the DrawingML
 * srcRect insets as fractions of the picture: positive insets crop, negative insets pad.
 */
export function fitImage(frame: LayoutBox, fit: ImageFit, aspect: number, focus: ImageFocus = { x: 0.5, y: 0.5 }): ImageFitPlacement {
  if (![frame.x, frame.y, frame.width, frame.height].every(Number.isFinite) || frame.width <= 0 || frame.height <= 0) throw new RangeError('An image frame needs finite coordinates and a positive size.');
  if (fit === 'stretch' || !Number.isFinite(aspect) || aspect <= 0) return { image: roundBox(frame), crop: { left: 0, top: 0, right: 0, bottom: 0 } };
  const wide = aspect > frame.width / frame.height, cover = fit === 'cover';
  const width = wide === cover ? frame.height * aspect : frame.width, height = wide === cover ? frame.height : frame.width / aspect;
  const point = imageFocus(focus);
  const place = (start: number, span: number, size: number, at: number) => cover
    ? Math.min(start, Math.max(start + span - size, start + span / 2 - at * size))
    : start + (span - size) / 2;
  const image = { x: place(frame.x, frame.width, width, point.x), y: place(frame.y, frame.height, height, point.y), width, height };
  const crop = {
    left: round((frame.x - image.x) / width), top: round((frame.y - image.y) / height),
    right: round((image.x + width - frame.x - frame.width) / width), bottom: round((image.y + height - frame.y - frame.height) / height),
  };
  for (const key of ['left', 'top', 'right', 'bottom'] as const) if (Object.is(crop[key], -0)) crop[key] = 0;
  return { image: roundBox(image), crop };
}

/** The background a value describes when it is an image: the object form, or an image-source string (a cover image). */
export function imageBackground(value: unknown): { src: string; alt?: string; fit: BackgroundImageFit; focus: ImageFocus; opacity?: number; recolor?: unknown; overlay?: unknown } | undefined {
  if (typeof value === 'string') return IMAGE_SOURCE.test(value) ? { src: value, fit: 'cover', focus: { x: 0.5, y: 0.5 } } : undefined;
  const background = record(value);
  if (background.type !== 'image' || typeof background.src !== 'string' || !background.src) return undefined;
  const opacity = finite(background.opacity, 0, 1);
  return {
    src: background.src, ...(typeof background.alt === 'string' ? { alt: background.alt } : {}),
    fit: (BACKGROUND_FITS as readonly unknown[]).includes(background.fit) ? background.fit : 'cover', focus: imageFocus(background.focus),
    ...(opacity !== undefined ? { opacity } : {}), ...(background.recolor !== undefined ? { recolor: background.recolor } : {}), ...(background.overlay !== undefined ? { overlay: background.overlay } : {}),
  };
}

/** Grayscale, or duotone from dark to light; anything else is no recolor. */
function composeRecolor(value: unknown): ComposedImage['recolor'] {
  if (value === 'grayscale') return { type: 'grayscale' };
  const duotone = record(value);
  return duotone.dark !== undefined && duotone.light !== undefined ? { type: 'duotone', dark: duotone.dark, light: duotone.light } : undefined;
}

/** Overlay geometry on a frame: the frame's shape, or an edge band of a rectangle frame (any other shape reports and draws none). */
function composeOverlay(value: unknown, frame: LayoutBox, shape: ImageShape, path: string, mirrorSide: (side: string) => string, diagnostics: LayoutDiagnostic[]): ComposedOverlay | undefined {
  const overlay = record(value), opacity = finite(overlay.opacity, 0, 1);
  if (overlay.color === undefined || opacity === undefined) return undefined;
  const edge = (IMAGE_EDGES as readonly unknown[]).includes(overlay.edge) ? mirrorSide(overlay.edge as string) as ImageEdge : undefined;
  if (edge && shape.kind !== 'rectangle') {
    diagnostics.push({ code: 'unsupported-image-treatment', path: `${path}.edge`, message: 'An edge overlay needs a rectangle frame; a band cannot follow a rounded, circular or hexagonal mask as one native shape. Remove edge or use shape rectangle.' });
    return undefined;
  }
  const part = finite(overlay.size, 0.05, 1) ?? 0.3;
  const box = !edge ? frame : edge === 'top' ? { ...frame, height: round(frame.height * part) }
    : edge === 'bottom' ? { ...frame, y: round(frame.y + frame.height * (1 - part)), height: round(frame.height * part) }
    : edge === 'left' ? { ...frame, width: round(frame.width * part) }
    : { ...frame, x: round(frame.x + frame.width * (1 - part)), width: round(frame.width * part) };
  return { path, color: overlay.color, opacity, ...(edge ? { edge } : {}), box, shape: edge ? imageShape('rectangle', box) : shape };
}

/**
 * Picture geometry of one image block in its region (FA-22): the frame (the frame area, then the aspect ratio), the mask,
 * the line, opacity, recolor and overlay: the treatments 0.14 drew on the slide picture, applied to image blocks.
 */
function composeImage(host: Record<string, any>, hostPath: string, region: LayoutBox, frameArea: LayoutBox, context: { fit?: ImageFit; scale: number; mirrorSide: (side: string) => string; diagnostics: LayoutDiagnostic[]; assets: unknown; placement?: ComposedPlacement }): ComposedImage {
  const kindName: ImageShape['kind'] = Object.hasOwn(IMAGE_SHAPES, host.shape) ? host.shape : 'rectangle';
  const { scale } = context;
  let box: LayoutBox = { ...frameArea };
  const aspect = kindName === 'circle' ? 1 : finite(host.aspectRatio, Number.MIN_VALUE, 10);
  if (aspect) {
    const frameWidth = Math.min(box.width, box.height * aspect), frameHeight = frameWidth / aspect;
    box = { x: box.x + (box.width - frameWidth) / 2, y: box.y + (box.height - frameHeight) / 2, width: frameWidth, height: frameHeight };
  }
  box = roundBox(box);
  const fit: ImageFit = (IMAGE_FITS as readonly unknown[]).includes(host.fit) ? host.fit : context.fit ?? 'cover';
  const focus = imageFocus(host.focus);
  const shape = imageShape(kindName, box, finite(host.cornerRadius, 0, 0.5));
  const result: ComposedImage = { region: roundBox(region), box, fit, focus, shape };
  const border = record(host.border), borderWidth = finite(border.width, 0, 64);
  if (border.color !== undefined && borderWidth) result.border = { color: border.color, width: round(borderWidth * scale) };
  const opacity = finite(host.opacity, 0, 1);
  if (opacity !== undefined && opacity < 1) result.opacity = opacity;
  const recolor = composeRecolor(host.recolor);
  if (recolor) result.recolor = recolor;
  const overlay = composeOverlay(host.overlay, box, shape, `${hostPath}.overlay`, context.mirrorSide, context.diagnostics);
  if (overlay) result.overlay = overlay;
  if (context.placement) result.placement = context.placement;
  const pictureAspect = intrinsicImageAspect(host.image, context.assets);
  if (pictureAspect) result.picture = fitImage(box, fit, pictureAspect, focus);
  return result;
}

/** The effective background (slide, deck, theme) when it is a picture; it fills the canvas and moves nothing. */
function resolveBackgroundImage(slide: Record<string, any>, presentation: unknown, themeBackground: unknown, width: number, height: number, path: string, mirrorSide: (side: string) => string, diagnostics: LayoutDiagnostic[]): ComposedBackgroundImage | undefined {
  const own = record(slide.design), deck = record(record(presentation).design);
  const [value, at] = own.background !== undefined ? [own.background, `${path}.design.background`]
    : deck.background !== undefined ? [deck.background, 'design.background'] : [themeBackground, 'theme'];
  const background = imageBackground(value);
  if (!background) return undefined;
  const box: LayoutBox = { x: 0, y: 0, width, height };
  const result: ComposedBackgroundImage = { path: at, src: background.src, ...(background.alt !== undefined ? { alt: background.alt } : {}), fit: background.fit, focus: background.focus, box };
  if (background.opacity !== undefined && background.opacity < 1) result.opacity = background.opacity;
  const recolor = composeRecolor(background.recolor);
  if (recolor) result.recolor = recolor;
  const overlay = composeOverlay(background.overlay, box, imageShape('rectangle', box), `${at}.overlay`, mirrorSide, diagnostics);
  if (overlay) result.overlay = overlay;
  const aspect = background.fit === 'tile' ? undefined : intrinsicImageAspect(background.src, record(presentation).assets);
  if (aspect) result.picture = fitImage(box, background.fit as ImageFit, aspect, background.focus);
  return result;
}

/** LogoSet keys in preference order per slot and tone: same-tone variants first, neutral next, the opposite tone last. */
const LOGO_LOCKUP_CHAINS = {
  dark: ['light', 'default', 'stackedLight', 'stacked', 'wordmarkLight', 'wordmark', 'iconLight', 'icon', 'dark', 'stackedDark', 'wordmarkDark', 'iconDark'],
  light: ['dark', 'default', 'stackedDark', 'stacked', 'wordmarkDark', 'wordmark', 'iconDark', 'icon', 'light', 'stackedLight', 'wordmarkLight', 'iconLight'],
} as const;
const LOGO_SET_KEYS = new Set<string>(LOGO_LOCKUP_CHAINS.dark);
export interface ResolveLogoOptions {
  /** Variant family to prefer; defaults to the full lockup. */
  slot?: LogoSlot;
  /** True on a dark background (host luminance test): light variants are preferred, dark ones come last. */
  onDark?: boolean;
  /** Index used in the `slides.N.design.logo` path of a slide-level logo; defaults to 0. */
  slideIndex?: number;
}
/**
 * Resolve the logo a slide should draw, the same way in every engine. Source precedence:
 * `slides[i].design.logo`, then `design.logo`, then the primary organization's `logo` (`role: 'primary'`,
 * else the first organization; `organization` may be an object or an array). Absence inherits; a source
 * that yields no usable asset falls through to the next. A string or Asset object is the `default`
 * variant. A LogoSet picks by slot and tone: `icon` tries iconLight/iconDark (tone), then icon, then the
 * lockup chain; `stacked` tries stackedLight/stackedDark (tone), then stacked, then the lockup chain; the
 * lockup chain prefers same-tone variants, then neutral ones, then the opposite tone. `path` is the OPF
 * path of the chosen value (`design.logo`, `design.logo.light`, `organization.2.logo`,
 * `slides.3.design.logo.icon`) and `variant` the LogoSet key or `default`. Returns null without a logo.
 */
export function resolveLogo(presentation: unknown, slide: unknown, options: ResolveLogoOptions = {}): ResolvedLogo | null {
  const slot: LogoSlot = options.slot === 'icon' || options.slot === 'stacked' ? options.slot : 'lockup';
  if (options.slot !== undefined && slot !== options.slot) throw new RangeError('Logo slot must be lockup, icon or stacked.');
  const tone = options.onDark === true ? 'dark' : 'light';
  const lockup = LOGO_LOCKUP_CHAINS[tone];
  const chain = slot === 'icon' ? [tone === 'dark' ? 'iconLight' : 'iconDark', 'icon', ...lockup]
    : slot === 'stacked' ? [tone === 'dark' ? 'stackedLight' : 'stackedDark', 'stacked', ...lockup] : lockup;
  const usable = (value: unknown) => { const source = assetSource(value); return typeof source === 'string' && source.length > 0; };
  const pick = (value: unknown, path: string): ResolvedLogo | null => {
    if (value === undefined || value === null || value === false) return null;
    if (typeof value === 'string' || (typeof value === 'object' && !Array.isArray(value) && 'src' in record(value))) {
      return usable(value) ? { source: value, path, variant: 'default', slot } : null;
    }
    const set = record(value);
    if (!Object.keys(set).some(key => LOGO_SET_KEYS.has(key))) return null;
    for (const key of chain) {
      const variant = set[key];
      if (variant !== undefined && usable(variant)) return { source: variant, path: `${path}.${key}`, variant: key, slot };
    }
    return null;
  };
  const deck = record(presentation), slideIndex = Number.isSafeInteger(options.slideIndex) && options.slideIndex! >= 0 ? options.slideIndex! : 0;
  const own = pick(record(record(slide).design).logo, `slides.${slideIndex}.design.logo`);
  if (own) return own;
  const shared = pick(record(deck.design).logo, 'design.logo');
  if (shared) return shared;
  const organizations: unknown[] = Array.isArray(deck.organization) ? deck.organization : [deck.organization];
  const primaryIndex = organizations.findIndex(item => record(item).role === 'primary');
  const index = primaryIndex >= 0 ? primaryIndex : organizations.findIndex(Boolean);
  if (index < 0) return null;
  return pick(record(organizations[index]).logo, Array.isArray(deck.organization) ? `organization.${index}.logo` : 'organization.logo');
}

export interface FurniturePartBase {
  kind: 'header' | 'footer';
  zone: 'left' | 'center' | 'right';
  field: 'text' | 'image' | 'logo' | 'socials' | 'date';
  /** Literal field or controlling flag, with the actual inherited/local path. */
  path: string;
  /** String/asset source, when different from a generated field's flag. */
  sourcePath?: string;
  generated: boolean;
  box: LayoutBox;
  alignment: 'left' | 'center' | 'right';
}
export interface FurnitureTextPart extends FurniturePartBase {
  type: 'text'; text: string; style: TextStyle;
  requestedFontSize: number; minFontSize: number; fit: SourceTextFit;
  /**
   * Live values inside `text`: every substituted `{{slide.number}}` of a `text` part (type
   * `slideNumber`), and a whole current (`date: true`) date (type `date`), as half-open UTF-16
   * offsets into `text`. Hosts such as PPTX may emit them as native fields; all other text,
   * including `{{deck.slideCount}}`, `{{slide.section}}` and formatted fixed dates, is fixed.
   */
  fields?: FurnitureField[];
  /**
   * Generated `socials` only: one entry per explicit source line of `text`, in
   * order. A part may carry both `fields` and `links`; hosts apply each link to
   * its whole source line and each field range within it.
   */
  links?: FurnitureSocialLink[];
}
/** Optional generated metadata for one furniture text part (live fields and/or social links). */
export interface FurnitureTextExtras { fields?: FurnitureField[]; links?: FurnitureSocialLink[] }
export interface SocialProfile {
  /** Single-line display text: the profile URL without an `https://` scheme, or the raw value. */
  text: string;
  /** Full http(s) URL when the value is one or its platform record formats one. */
  href?: string;
  /** Whether the platform's URL pattern formatted a handle. */
  resolved: boolean;
}
export interface FurnitureSocialLink extends SocialProfile {
  /** Socials key (platform id). */
  platform: string;
  /** Authored value path, such as `organization.socials.x`. */
  sourcePath: string;
}

const webUrl = /^https?:\/\/\S+$/i;
/**
 * Format one Socials value through the engine's social-platform vocabulary (SOCIAL_PLATFORMS), deterministically and
 * without network access. `owner` selects companyUrlPattern for organizations.
 * URLs pass through; unknown platforms and unformattable values stay raw.
 */
export function resolveSocialProfile(platform: string, value: string, owner: 'organization' | 'speaker' = 'organization'): SocialProfile {
  const raw = String(value).trim().replace(/\s+/gu, ' ');
  const display = (url: string) => url.replace(/^https:\/\//i, '');
  if (webUrl.test(raw)) return {text: display(raw), href: raw, resolved: false};
  const platformRecord = Object.hasOwn(SOCIAL_PLATFORMS, platform) ? SOCIAL_PLATFORMS[platform] : undefined;
  const base = typeof platformRecord?.baseUrl === 'string' && webUrl.test(platformRecord.baseUrl) ? `${platformRecord.baseUrl.replace(/\/+$/u, '')}/{handle}` : undefined;
  const pattern = (owner === 'organization' ? platformRecord?.companyUrlPattern : undefined) ?? platformRecord?.profileUrlPattern ?? base;
  const prefix = platformRecord?.handlePrefix ?? '';
  const handle = prefix && raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
  if (!handle || typeof pattern !== 'string' || !pattern.includes('{handle}')) return {text: raw, resolved: false};
  const url = pattern.split('{handle}').join(handle);
  if (!webUrl.test(url)) return {text: raw, resolved: false};
  return {text: display(url), href: encodeURI(url), resolved: true};
}
export interface FurnitureImagePart extends FurniturePartBase { type: 'image'; image: unknown }
export type FurniturePart = FurnitureTextPart | FurnitureImagePart;
export interface FurnitureLayout {
  algorithm: 'furniture-flow-v2';
  /** Includes explicitly empty definitions, which override inherited furniture. */
  configured: boolean;
  textMeasurement: 'estimated' | 'provided';
  textOutlines: 'provided' | 'unavailable';
  parts: FurniturePart[];
  /** Outer occupied edges; composeSlide adds its normal content gap. */
  headerBottom: number; footerTop: number;
  diagnostics: LayoutDiagnostic[]; overflow: boolean;
}

/** Resolve and measure repeated fields without mutating metadata or consulting a clock. */
export function layoutFurniture(input: unknown, options: ComposeSlideOptions = {}): FurnitureLayout {
  const slide=record(input),width=options.width??1280,height=options.height??720,scale=Math.min(width,height)/720;
  const settings:Composition={...record(record(options.layout).composition),...record(slide.composition)};
  assertComposition(settings);
  const furnitureRtl=(options.direction??resolveSlideDirection(options.presentation,options.slideIndex))==='rtl';
  // Standalone furniture can sit directly at a field edge. One reference pixel
  // did not contain actual Linux SVG paint for Roboto's rasterized `t`; reserve two
  // in the shared geometry so SVG and PPTX consume the same accepted clearance.
  // Explicit host padding (including zero) remains authoritative.
  const minimum=snapFontSizeUp((settings.minFontSize??16)*scale),size=gridFontSize(13*scale,minimum),padding=(options.textRasterPadding??2)*scale;
  if(![width,height,scale,minimum,padding].every(Number.isFinite)||width<=0||height<=0||minimum<=0||padding<0)throw new RangeError('Furniture requires finite positive dimensions and nonnegative raster padding.');
  const number=options.slideNumber??(options.slideIndex??0)+1;
  if(!Number.isSafeInteger(number)||number<1)throw new RangeError('Displayed slide number must be a positive safe integer.');
  const presentationSlides=options.presentation?.slides,slideCount=options.slideCount??(Array.isArray(presentationSlides)&&presentationSlides.length?presentationSlides.length:undefined);
  if(slideCount!==undefined&&(!Number.isSafeInteger(slideCount)||slideCount<1))throw new RangeError('Displayed slide count must be a positive safe integer.');
  if(options.date!==undefined&&(typeof options.date!=='string'||!parseIsoDate(options.date)))throw new RangeError('The furniture date option must be an ISO YYYY-MM-DD calendar date.');
  const outlines=options.textMeasurement?.outlineBounds!==undefined,parts:FurniturePart[]=[],diagnostics:LayoutDiagnostic[]=[];
  const sourceRoot=`slides.${options.slideIndex??0}`,organizations=Array.isArray(options.presentation?.organization)?options.presentation.organization:[options.presentation?.organization];
  const primaryIndex=organizations.findIndex(item=>record(item).role==='primary'),organizationIndex=primaryIndex>=0?primaryIndex:organizations.findIndex(Boolean);
  const organization=record(organizations[organizationIndex]),organizationRoot=Array.isArray(options.presentation?.organization)?`organization.${organizationIndex}`:'organization';
  const fontFamily=options.fontFamilies?.body??'sans-serif';let headerBottom=0,footerTop=height,configured=false;
  const error=(path:string,message:string,code:LayoutDiagnostic['code']='text-overflow')=>diagnostics.push({code,path,message});
  for(const kind of ['header','footer'] as const){
    const local=record(slide.design)[kind]!==undefined,value=local?record(slide.design)[kind]:options.presentation?.design?.[kind];
    if(value===undefined||value===false)continue;
    const root=local?`${sourceRoot}.design.${kind}`:`design.${kind}`;
    if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError('Header/footer content must be an object or false.');
    configured=true;
    const zones:FurniturePart[][]=[];
    for(const [index,zone]of (['left','center','right'] as const).entries()){
      // Right to left: the authored `left` zone is drawn at the right and `right` at the left; `zone` keeps the authored name.
      // `alignment` is the physical edge the zone's text sits on (never flipped again by line direction).
      const side=furnitureRtl&&zone!=='center'?(zone==='left'?'right':'left'):zone;
      const content=record(record(value)[zone]),path=`${root}.${zone}`,x=width*(.07+(furnitureRtl?2-index:index)*.3),zoneWidth=width*.26,zoneParts:FurniturePart[]=[];let y=0;
      const add=(field:FurniturePartBase['field'],text:unknown,generated=false,sourcePath?:string,extras:FurnitureTextExtras={})=>{
        if(text===undefined)return;
        if(typeof text!=='string')throw new TypeError(`Furniture field ${path}.${field} requires string content.`);
        const partPath=`${path}.${field}`,style=resolveTextStyle({fontFamily,fontWeight:400,italic:false,path:partPath},options.textMeasurement);
        const fit=fitText(text,{x:0,y:0,width:Math.max(Number.MIN_VALUE,zoneWidth-(outlines?2*padding:0)),height:Number.MAX_VALUE},size,size,textWidthMeasurer(style,options.textMeasurement));
        const ink=fit.sourceLines.map((line,index)=>{
          let outline:LayoutBox|null=null;
          if(outlines)for(const segment of line.segments)if(segment.kind==='text'){
            const bounds=measureTextOutline(text.slice(segment.start,segment.end),size,style,options.textMeasurement);
            if(bounds){const next={...bounds,x:bounds.x+segment.x};if(!outline)outline=next;else{const right=Math.max(outline.x+outline.width,next.x+next.width),bottom=Math.max(outline.y+outline.height,next.y+next.height);outline.x=Math.min(outline.x,next.x);outline.y=Math.min(outline.y,next.y);outline.width=right-outline.x;outline.height=bottom-outline.y;}}
          }
          return {width:line.width,y:index*fit.lineHeight,baseline:size+index*fit.lineHeight,height:fit.lineHeight,outline};
        });
        const natural=outlines?placeTextLines(ink,{x,y,width:zoneWidth,height:Number.MAX_VALUE},side,padding):undefined;
        const partHeight=natural?.height??fit.sourceLines.length*fit.lineHeight;
        if(!Number.isFinite(partHeight))throw new RangeError('Furniture exceeds finite layout coordinates.');
        const box={x,y,width:zoneWidth,height:Math.max(scale,partHeight)},placement=outlines?placeTextLines(ink,box,side,padding):undefined;
        const accepted={...fit,...(placement?{placement}:{}),overflow:fit.overflow||!!placement?.overflow};
        zoneParts.push({type:'text',kind,zone,field,path:partPath,sourcePath:sourcePath??(!generated?partPath:undefined),generated,text,style,requestedFontSize:size,minFontSize:minimum,box,alignment:side,fit:accepted,...(extras.fields?.length?{fields:extras.fields}:{}),...(extras.links?.length?{links:extras.links}:{})});
        if(accepted.overflow)error(partPath,'Repeated text exceeds its zone at the selected readability floor; change the furniture or slide design.');
        y+=box.height;
      };
      // An image or logo part is as wide as its own aspect ratio makes it at the band height (a square when
      // the source's dimensions are not readable), capped at the zone, and aligns like the zone's text: left zone to
      // its left edge, center zone centered, right zone to its right edge. Consumers fit the image inside this box.
      const imageBox=(source:unknown)=>{
        const imageHeight=Math.max(32*scale,Math.min(height*.05,72*scale)),imageWidth=Math.min(zoneWidth,imageHeight*(intrinsicImageAspect(source,record(options.presentation).assets)??1));
        return {x:side==='left'?x:side==='center'?x+(zoneWidth-imageWidth)/2:x+zoneWidth-imageWidth,y,width:imageWidth,height:imageHeight};
      };
      if(content.logo===true){
        // The deck's icon logo (slide design, deck design, then the primary organization), as a generated image part.
        const resolved=resolveLogo(options.presentation,slide,{slot:'icon',onDark:options.darkBackground,slideIndex:options.slideIndex});
        if(resolved){const box=imageBox(resolved.source);zoneParts.push({type:'image',kind,zone,field:'logo',path:`${path}.logo`,sourcePath:resolved.path,generated:true,image:resolved.source,box,alignment:side});y+=box.height;}
        else error(`${path}.logo`,'Generated logo needs design.logo or a primary organization logo.','unresolved-content');
      }
      if(content.image!==undefined){
        const box=imageBox(content.image);
        zoneParts.push({type:'image',kind,zone,field:'image',path:`${path}.image`,sourcePath:`${path}.image`,generated:false,image:content.image,box,alignment:side});y+=box.height;
      }
      if(typeof content.text==='string'){
        // The slide-scoped built-ins resolve here, per slide; each {{slide.number}} becomes a live slide-number field.
        const resolved=substituteSlideTokens(content.text,{slideNumber:number,...(slideCount!==undefined?{slideCount}:{}),section:slide.section});
        if(slideCount===undefined&&usesSlideBuiltin(content.text,'deck.slideCount'))error(`${path}.text`,'{{deck.slideCount}} needs the rendered slide count (the slideCount option or the presentation slides).','unresolved-content');
        add('text',resolved.text,false,undefined,{fields:resolved.fields});
      }
      else add('text',content.text);
      if(content.socials===true){
        const links:FurnitureSocialLink[]=Object.entries(record(organization.socials)).filter(([,value])=>typeof value==='string'&&value.trim()).map(([platform,value])=>({platform,sourcePath:`${organizationRoot}.socials.${platform}`,...resolveSocialProfile(platform,value as string,'organization')}));
        if(links.length)add('socials',links.map(link=>link.text).join('\n'),true,`${organizationRoot}.socials`,{links});else error(`${path}.socials`,'Generated social profiles need a primary organization with socials.','unresolved-content');
      }
      if(content.dateFormat!==undefined&&typeof content.dateFormat!=='string')throw new TypeError(`Furniture setting ${path}.dateFormat requires a string.`);
      if(content.date===true){
        // A current date is a live field: the host supplies today's calendar date.
        const format=content.dateFormat??DEFAULT_FURNITURE_DATE_FORMAT;
        if(options.date===undefined)error(`${path}.date`,'A current date needs a host-supplied ISO date option. For fixed content use a literal date, or an ISO date with dateFormat.','unresolved-content');
        else{const resolved=formatFurnitureDate(options.date,format);if('error' in resolved)error(`${path}.dateFormat`,resolved.error,'unresolved-content');else add('date',resolved.text,true,undefined,{fields:[{type:'date',start:0,end:resolved.text.length,format}]});}
      }
      else if(typeof content.date==='string'){
        // Without dateFormat a date string stays literal, editable source text.
        if(content.dateFormat===undefined)add('date',content.date);
        else{const resolved=formatFurnitureDate(content.date,content.dateFormat);if('error' in resolved)error(`${path}.${parseIsoDate(content.date)?'dateFormat':'date'}`,resolved.error,'unresolved-content');else add('date',resolved.text,true,`${path}.date`);}
      }
      zones.push(zoneParts);
    }
    const tallest=Math.max(0,...zones.map(zone=>zone.reduce((sum,part)=>sum+part.box.height,0)));
    if(!tallest)continue;
    const top=kind==='header'?height*.025:Math.max(height*.025,height-height*.04-tallest);
    if(kind==='header')headerBottom=top+tallest;else footerTop=top;
    for(const zone of zones)for(const part of zone){
      part.box.y+=top;
      if(part.type==='text'&&part.fit.placement)for(const line of part.fit.placement.lines){line.y+=top;line.baseline+=top;if(line.outline)line.outline.y+=top;}
      if(part.box.y+part.box.height>height-height*.04+.01)error(part.path,'Repeated header/footer content extends beyond the usable slide height. Change its content or design before pagination.');
      parts.push(part);
    }
  }
  if(headerBottom>footerTop+.01)error(parts.find(part=>part.kind==='footer')?.path??sourceRoot,'Header and footer content overlap; repeated content cannot be repaired by splitting body content.');
  return {algorithm:'furniture-flow-v2',configured,textMeasurement:options.textMeasurement?'provided':'estimated',textOutlines:outlines?'provided':'unavailable',parts,headerBottom,footerTop,diagnostics,overflow:diagnostics.length>0};
}

const textSegments = new Intl.Segmenter("und", { granularity: "grapheme" });
/** A line may exceed its box by this much (reference pixels) before it wraps: the overflow tests already allow it, and an exact fit (a monospace line of 0.6 em cells filling the box) must not wrap one word early on a rounding error. */
const WRAP_TOLERANCE = .01;
/** Whitespace that can hang at a soft line break: every space except the no-break spaces and the zero-width no-break space. */
const HANGING_SPACE = /[^\S\r\n\u00a0\u202f\ufeff]/u;

/** Deterministic estimate, not a font shaping engine. Preserves explicit line breaks. */
export function measureText(text: string, fontSize: number): number {
  let units = 0;
  for (const character of text) {
    if (/\p{Mark}|\u200d|\ufe0f/u.test(character)) continue;
    units += character === " " ? 0.32 : /[A-Z0-9]/.test(character) ? 0.62 : character.codePointAt(0)! > 0x2e80 ? 1 : 0.54;
  }
  return units * fontSize;
}
export function wrapText(text: string, width: number, fontSize: number, measure: MeasureTextWidth = measureText): string[] {
  return fitSourceText(text,{x:0,y:0,width,height:Number.MAX_VALUE},fontSize,fontSize,1,measure,true,false).lines;
}
export function fitText(text: string, box: LayoutBox, requestedSize = 25, minFontSize = 16, measure: MeasureTextWidth = measureText, direction?: TextDirection): SourceTextFit {
  if (![box.width, box.height, requestedSize, minFontSize].every(Number.isFinite) || box.width <= 0 || box.height <= 0 || requestedSize <= 0 || minFontSize <= 0) {
    throw new RangeError("Text dimensions and font sizes must be finite and positive.");
  }
  return fitSourceText(text,box,Math.max(requestedSize,minFontSize),minFontSize,1,measure,true,true,direction);
}

/**
 * PowerPoint stores a run size (`sz`) in hundredths of a point, and composition pixels are CSS pixels (96 per
 * inch, so a point is 4/3 px). Every composed font size is therefore a whole multiple of 0.01 pt, which is
 * 1/75 px: the preview then measures, breaks and draws exactly the size the export writes (RR-16).
 * The tolerance absorbs binary rounding noise (a size already on the grid must not drop a step).
 */
export const FONT_SIZE_GRID_PER_PX=75;
const FONT_GRID_EPSILON=1e-6;
/** Largest grid size not above `px`. Rounding down keeps a size that fit before snapping fitting. */
export function snapFontSizeDown(px:number):number { return Math.max(px>0?1:-Infinity,Math.floor(px*FONT_SIZE_GRID_PER_PX+FONT_GRID_EPSILON))/FONT_SIZE_GRID_PER_PX; }
/** Smallest grid size not below `px`. Used for readability floors, so a floor is never undercut. */
export function snapFontSizeUp(px:number):number { return Math.max(px>0?1:-Infinity,Math.ceil(px*FONT_SIZE_GRID_PER_PX-FONT_GRID_EPSILON))/FONT_SIZE_GRID_PER_PX; }
/** The composed size for an unsnapped request: on the 0.01 pt grid and never below the (grid-rounded) floor. */
function gridFontSize(raw:number,minimum:number):number { return Math.max(snapFontSizeUp(minimum),snapFontSizeDown(raw)); }
/** At most 65 layout trials, including the floor even for unusually large requests. Trial sizes stay anchored to
 * the unsnapped request (no accumulated drift), are snapped down to the 0.01 pt grid and are clamped to the floor. */
function fitAtSizes<T extends {overflow:boolean}>(layout:(size:number)=>T,requested:number,minimum:number,step=1,snap=true):T {
  const start=Math.max(requested,minimum);
  if(![start,minimum,step].every(value=>Number.isFinite(value)&&value>0))throw new RangeError('Readable font sizes and fitting steps must be finite and positive.');
  for(let trial=0;trial<=64;trial++) {
    const raw=start-trial*step,last=trial===64||raw<=minimum;
    const size=!snap?(last?minimum:Math.max(minimum,raw)):last?snapFontSizeUp(minimum):gridFontSize(raw,minimum),result=layout(size);
    if(!result.overflow||last)return result;
  }
  throw new Error('Text fitting did not evaluate its bounded floor trial.');
}
/** Photo diameter as a multiple of the footer font size, and the gap beside it as a multiple of that size (FA-12). */
const PHOTO_RATIO = 3, PHOTO_GAP = .75;
/** `text` is a string or TextRun[] (FA-10); attribution, role and source stay plain strings. */
export interface QuoteContent { text: string | readonly (string | RichTextRun)[]; attribution?: string; role?: string; photo?: unknown; source?: string }
/** Source and displayed-text ranges are half-open UTF-16 offsets. Added punctuation has no source range. */
export interface QuoteTextSource {
  path: string;
  start: number;
  end: number;
  outputStart: number;
  outputEnd: number;
}
export interface QuoteTextPart {
  role: 'body' | 'footer';
  path: string;
  text: string;
  sources: QuoteTextSource[];
  /** Available space, before fitting. Invalid dimensions remain visible in failed results. */
  box: LayoutBox;
  requestedFontSize: number;
  minFontSize: number;
  requestedStyle: TextStyle;
  style: TextStyle;
  /**
   * The displayed runs of a rich quote body (FA-10): the quote's TextRun[] with the quotation marks joined to its first and
   * last run, so a run's index and a citation marker's position never shift. Absent for a string body and for the footer.
   */
  runs?: (string | RichTextRun)[];
  /** Absent when the available box is invalid; never fit against an invented one-pixel box. A rich body reports a RichTextFit. */
  fit?: TextFit | RichTextFit;
}
export interface QuoteLayoutDiagnostic extends LayoutDiagnostic {
  reason: 'invalid-part-box' | 'part-outside-cell' | 'text-fit' | 'part-overlap' | 'photo-fit';
  parts: QuoteTextPart['role'][];
}
/**
 * The attributed person's headshot (FA-12): a circle at the start edge of the footer row, beside the
 * attribution and role lines (the left in a left-to-right deck, the right in a right-to-left one). Its diameter is
 * three times the footer font size, so it follows the text when the footer shrinks toward the readability floor.
 */
export interface QuotePhoto {
  /** Path of the photo value, `<quote path>.photo`. */
  path: string;
  /** Asset value (string or Asset object) that engines resolve like any other image; crop to cover the frame. */
  value: unknown;
  /** Square frame, in reference pixels. */
  box: LayoutBox;
  /** Circle mask: the `ellipse` DrawingML preset and the same outline as an SVG path, as an image block's shape 'circle'. */
  shape: ImageShape;
}
export interface QuoteLayout {
  algorithm: 'quote-flow-v1';
  textMeasurement: 'estimated' | 'provided';
  parts: QuoteTextPart[];
  /** Present when the quote has a photo; absent otherwise, and then the layout is the footer-only layout. */
  photo?: QuotePhoto;
  diagnostics: QuoteLayoutDiagnostic[];
  overflow: boolean;
}
export interface QuoteLayoutOptions {
  /** Canvas short edge divided by 720. Insets retain the current 18 reference-pixel contract. */
  scale?: number;
  fontFamilies?: Partial<FontFamilies>;
  /** Readability floor in reference pixels, before canvas scaling. */
  minFontSize?: number;
  overflow?: Composition['overflow'];
  path?: string;
  textMeasurement?: TextMeasurement;
  /** Deck direction; in a right-to-left deck every part fit reports its paragraphs' directions (RR-05). */
  direction?: TextDirection;
  /** Marker text for a rich body run by its dotted path (`<path>.text.<runIndex>`); composeSlide supplies the deck numbering. */
  citationMarker?: (runPath: string) => string | undefined;
}
/** The displayed runs of a rich quote body: the quotation marks join the first and last run. */
function quoteBodyRuns(runs: readonly (string | RichTextRun)[]): (string | RichTextRun)[] {
  if (!runs.length) return ['""'];
  const last = runs.length - 1;
  return runs.map((run, index) => {
    const before = index === 0 ? '"' : '', after = index === last ? '"' : '';
    return typeof run === 'string' ? before + run + after : {...run, text: before + run.text + after};
  });
}
/**
 * Allocate and measure quote body/footer space for composition, rendering and export. Callers must
 * check overflow before accepting the parts. Line boxes are not shaped glyph or native raster bounds.
 */
export function layoutQuote(value: string | QuoteContent, box: LayoutBox, options: QuoteLayoutOptions = {}): QuoteLayout {
  const shorthand = typeof value === 'string';
  const quote = shorthand ? {text:value} : value;
  const photoValue = (quote as QuoteContent | null)?.photo;
  if (!quote || Array.isArray(quote) || (typeof quote.text !== 'string' && !Array.isArray(quote.text)) ||
    [quote.attribution, quote.role, quote.source].some(field => field !== undefined && typeof field !== 'string') ||
    photoValue !== undefined && typeof photoValue !== 'string' && !(typeof photoValue === 'object' && photoValue !== null && typeof (photoValue as {src?:unknown}).src === 'string')) {
    throw new TypeError('Quote content must be a string or a text object (text a string or TextRun[]) with optional string attribution/role/source and an asset photo.');
  }
  const richBody = Array.isArray(quote.text) ? quote.text as readonly (string | RichTextRun)[] : undefined;
  const quoteText = richBody ? annotationText(richBody) : quote.text as string;
  const scale = options.scale ?? 1, minimum = snapFontSizeUp((options.minFontSize ?? 16) * scale);
  if (![box.x,box.y,box.width,box.height,scale,minimum].every(Number.isFinite) ||
    box.width <= 0 || box.height <= 0 || scale <= 0 || minimum <= 0) {
    throw new RangeError('Quote dimensions, scale and minimum font size must be finite and positive.');
  }
  if (options.overflow !== undefined && !['warn','error'].includes(options.overflow)) throw new RangeError('Invalid quote overflow policy.');
  const path = options.path ?? 'quote';
  const diagnostics: QuoteLayoutDiagnostic[] = [], parts: QuoteTextPart[] = [];
  const report = (reason: QuoteLayoutDiagnostic['reason'], diagnosticPath: string, roles: QuoteTextPart['role'][], message: string) =>
    diagnostics.push({code:'text-overflow',reason,path:diagnosticPath,parts:roles,message});
  const source = (sourcePath:string, text:string, outputStart:number):QuoteTextSource =>
    ({path:sourcePath,start:0,end:text.length,outputStart,outputEnd:outputStart+text.length});
  const add = (role:QuoteTextPart['role'], text:string, sources:QuoteTextSource[], area:LayoutBox, fontSize:number, fontFamily:string, fontWeight:number, partPath:string, runs?:(string|RichTextRun)[]) => {
    const requestedStyle:TextStyle = {fontFamily,fontWeight,italic:false,path:partPath};
    const style = resolveTextStyle({...requestedStyle}, options.textMeasurement);
    // An explicit readability floor can raise the nominal size.
    const requestedFontSize = gridFontSize(fontSize * scale, minimum);
    const part:QuoteTextPart = {role,path:partPath,text,sources,box:area,requestedFontSize,minFontSize:minimum,requestedStyle,style,...(runs?{runs}:{})};
    parts.push(part);
    return part;
  };
  // Footer lines: the attribution, the role on its own line below it, and the source after ' - ' on the last line.
  let footer = '';
  const footerSources:QuoteTextSource[] = [];
  for (const field of ['attribution','role','source'] as const) {
    const text = quote[field];
    if (!text) continue;
    if (footer) footer += field === 'role' ? '\n' : ' - ';
    footerSources.push(source(`${path}.${field}`,text,footer.length));
    footer += text;
  }
  const hasPhoto = photoValue !== undefined, hasFooter = footer !== '', hasBlock = hasPhoto || hasFooter;
  const photoPath = `${path}.photo`, rtl = options.direction === 'rtl';
  const bodyPath = shorthand ? path : `${path}.text`;
  const body = add('body',`"${quoteText}"`,[source(bodyPath,quoteText,1)],
    {x:box.x+18,y:box.y+18,width:box.width-36,height:box.height-(hasBlock?94:36)},
    28,options.fontFamilies?.accent??options.fontFamilies?.heading??'sans-serif',600,bodyPath,richBody?quoteBodyRuns(richBody):undefined);
  const attribution = hasFooter ? add('footer',footer,footerSources,
    {x:box.x+18,y:box.y+box.height-58,width:box.width-36,height:40},
    17,options.fontFamilies?.body??'sans-serif',500,path) : undefined;
  // A photo with no footer text still sizes from the nominal footer size.
  const footerRequested = attribution?.requestedFontSize ?? gridFontSize(17 * scale, minimum);
  const usable = (area:LayoutBox) => [area.x,area.y,area.width,area.height].every(Number.isFinite) && area.width>0 && area.height>0;
  // A rich body fits through the rich-text layouter (the one body text uses); every other part keeps the plain fitter.
  const fit = (part:QuoteTextPart,area:LayoutBox,size=part.requestedFontSize,floor=minimum):TextFit|RichTextFit|undefined => !usable(area) ? undefined
    : part.runs ? fitRichText(part.runs,area,size,floor,{style:part.style,textMeasurement:options.textMeasurement,...(options.citationMarker?{citationMarker:options.citationMarker}:{}),...(options.direction?{direction:options.direction}:{})})
    : fitText(part.text,area,size,floor,textWidthMeasurer(part.style,options.textMeasurement),options.direction);
  const heightOf = (fit:TextFit|RichTextFit) => 'richLines' in fit ? (fit as RichTextFit).height : fit.lines.length*fit.lineHeight;
  const inner = {x:box.x+18,y:box.y+18,width:box.width-36,height:box.height-36};
  let photo: QuotePhoto | undefined, photoFits = true;
  if (!hasBlock) body.fit=fit(body,body.box);
  else if (usable(inner) && inner.height>18) {
    const available=inner.height-18;
    const preferredBody=fit(body,inner,body.requestedFontSize,body.requestedFontSize)!;
    const minimumBody=body.requestedFontSize===minimum ? preferredBody : fit(body,inner,minimum,minimum)!;
    const preferredBodyHeight=heightOf(preferredBody);
    const minimumBodyHeight=heightOf(minimumBody);
    interface Selection {bodyBox:LayoutBox;footerBox:LayoutBox;textBox?:LayoutBox;photoBox?:LayoutBox;bodyFit?:TextFit|RichTextFit;footerFit?:TextFit;score:number;overflow:boolean;photoFits:boolean}
    let selected:Selection|undefined;
    // At most two footer sizes: its nominal request and the readability floor. Retain
    // the fitting pair with the least total font reduction. A 40px footer is only a
    // whitespace preference; it must not cause unnecessary shrinking or grid movement.
    // A photo is three times the footer font size and sits beside the text, which takes the remaining width.
    for (const size of new Set([footerRequested,minimum])) {
      const diameter=hasPhoto ? PHOTO_RATIO*size : 0, gap=hasPhoto ? PHOTO_GAP*size : 0;
      const textArea={...inner,width:inner.width-diameter-gap,x:rtl?inner.x:inner.x+diameter+gap};
      const natural=attribution ? fit(attribution,textArea,size,size) : undefined;
      const naturalHeight=natural ? natural.lines.length*natural.lineHeight : 0;
      const blockHeight=Math.max(naturalHeight,diameter);
      const lineHeight=natural?.lineHeight ?? size*1.22;
      const preferredHeight=Math.max(40,blockHeight);
      const bodyReservation=Math.min(minimumBodyHeight,Math.max(minimumBody.lineHeight,available-lineHeight));
      const footerHeight=preferredBodyHeight+preferredHeight<=available+.01 ? preferredHeight
        : Math.min(blockHeight,Math.max(0,available-bodyReservation));
      const bodyBox={...inner,height:available-footerHeight};
      const footerBox={...inner,y:inner.y+inner.height-footerHeight,height:footerHeight};
      const bodyFit=fit(body,bodyBox);
      const photoBox=hasPhoto ? {x:rtl?inner.x+inner.width-diameter:inner.x,y:footerBox.y+(footerHeight-diameter)/2,width:diameter,height:diameter} : undefined;
      // Beside a photo the text block is centered against it; alone, it starts at the top of the footer.
      const textBox=attribution ? hasPhoto ? {...textArea,y:footerBox.y+Math.max(0,footerHeight-naturalHeight)/2,height:Math.min(naturalHeight,footerHeight)} : footerBox : undefined;
      const footerFit=attribution && natural && usable(footerBox) ? {...natural,overflow:natural.overflow||naturalHeight>footerHeight+.01} : undefined;
      const fitsPhoto=!hasPhoto || diameter<=footerHeight+.01 && (!attribution || usable(textArea));
      const overflow=!bodyFit||bodyFit.overflow||(attribution?!footerFit||footerFit.overflow:false)||!fitsPhoto;
      const score=(body.requestedFontSize-(bodyFit?.fontSize??minimum)+footerRequested-size)/scale;
      // When neither size fits, retain the floor-size trial so failure diagnostics
      // describe the irreducible result, not a rejected larger-font attempt.
      if (!selected || !overflow && (selected.overflow||score<selected.score) || overflow && selected.overflow) {
        selected={bodyBox,footerBox,textBox,photoBox,bodyFit,footerFit,score,overflow,photoFits:fitsPhoto};
      }
    }
    if (selected) {
      body.box=selected.bodyBox;body.fit=selected.bodyFit;
      if (attribution) {attribution.box=selected.textBox ?? selected.footerBox;attribution.fit=selected.footerFit;}
      if (selected.photoBox) photo={path:photoPath,value:photoValue,box:selected.photoBox,shape:imageShape('circle',selected.photoBox)};
      photoFits=selected.photoFits;
    }
  }
  if (hasPhoto && !photo) photoFits=false;
  for (const part of parts) {
    const area=part.box;
    if (!part.fit) {
      report('invalid-part-box',part.path,[part.role],`Quote ${part.role} has no usable space after its insets; increase the cell size or change the arrangement.`);
    } else if (part.fit.overflow) {
      report('text-fit',part.path,[part.role],`Quote ${part.role} exceeds its available space at the readability floor; increase its space or change the arrangement.`);
    }
    if (usable(area) && (area.x<box.x || area.y<box.y || area.x+area.width>box.x+box.width+.01 || area.y+area.height>box.y+box.height+.01)) {
      report('part-outside-cell',part.path,[part.role],`Quote ${part.role} extends outside its cell; increase the cell size or change the arrangement.`);
    }
  }
  if (hasPhoto && !photoFits) report('photo-fit',photoPath,['footer'],'Quote photo does not fit beside the attribution at the readability floor; increase the cell size, shorten the text or remove the photo.');
  // Conservative occupied line rectangles, not actual glyph outlines. Reserved boxes alone
  // are insufficient: an overflowing body's rendered lines can reach an otherwise fitting footer.
  if (body?.fit && attribution?.fit && body.box.y+heightOf(body.fit) > attribution.box.y+.01 &&
    attribution.box.y+attribution.fit.lines.length*attribution.fit.lineHeight > body.box.y+.01) {
    report('part-overlap',path,['body','footer'],'Quote body and footer line boxes overlap; do not accept this layout without more space.');
  } else if (body?.fit && photo && body.box.y+heightOf(body.fit) > photo.box.y+.01) {
    report('part-overlap',path,['body','footer'],'Quote body and photo overlap; do not accept this layout without more space.');
  }
  if (diagnostics.length && options.overflow === 'error') throw new OPFCompositionError(diagnostics);
  return {algorithm:'quote-flow-v1',textMeasurement:options.textMeasurement?'provided':'estimated',parts,...(photo?{photo}:{}),diagnostics,overflow:diagnostics.length>0};
}

export interface MetricContent {
  value: string | number;
  label?: string;
  description?: string;
  unit?: string;
  delta?: string | number;
  trend?: 'up' | 'down' | 'flat';
  /** Whether the change is good news; colours the trend arrow, trend word and delta text (see metricTrendColor). */
  sentiment?: MetricSentiment;
}
/** The text fields of a metric, each laid out as its own part. `sentiment` is metadata, not text. */
type MetricTextRole = Exclude<keyof MetricContent, 'sentiment'>;
/** Ranges address String(sourceValue), not the numeric token spelling in serialized JSON. */
export interface MetricTextSource { path: string; value: string | number; start: number; end: number }
export interface MetricTextPart {
  role: MetricTextRole;
  path: string;
  text: string;
  sources: MetricTextSource[];
  /** Empty optional fields retain their source mapping but occupy no visible space. */
  visible: boolean;
  /** Accepted absolute origin/baseline for each fit.sourceLines entry, including blank lines. */
  linePositions: {x:number;baseline:number}[];
  box: LayoutBox;
  requestedFontSize: number;
  minFontSize: number;
  requestedStyle: TextStyle;
  style: TextStyle;
  /** Source-preserving line/segment representation shared with code, with proportional fonts. */
  fit?: CodeTextFit;
}
export interface MetricLayoutDiagnostic extends LayoutDiagnostic {
  reason: 'invalid-part-box' | 'part-outside-cell' | 'text-fit' | 'part-overlap';
  parts: MetricTextPart['role'][];
}
export interface MetricLayout {
  algorithm: 'metric-flow-v1';
  alignment: 'left' | 'center' | 'right';
  textMeasurement: 'estimated' | 'provided';
  arrangement: 'inline-unit' | 'stacked';
  /** The metric's `sentiment`, passed through for metricTrendMark; omitted when the content has none. */
  sentiment?: MetricSentiment;
  /** At most 48 arrangements; value fitting is bounded by 77 reference-size trials per arrangement. */
  attempts: number;
  parts: MetricTextPart[];
  diagnostics: MetricLayoutDiagnostic[];
  overflow: boolean;
}
export interface MetricLayoutOptions extends QuoteLayoutOptions {
  align?: 'left' | 'center' | 'right';
  /** Unscaled clearance around available vector outlines; defaults to one reference pixel. */
  textRasterPadding?: number;
}

/**
 * Measure every metric field before accepting geometry. Short single-line values and units can
 * share a baseline; longer values or units stack. No locale formatting, trend icons or rewritten
 * source text are invented here: the trend stays its word, and metricTrendMark derives the arrow
 * beside it from these accepted parts. Consumers must reuse these accepted parts and source ranges.
 */
export function layoutMetric(value: string | number | MetricContent, box: LayoutBox, options: MetricLayoutOptions = {}): MetricLayout {
  const scalar = typeof value === 'string' || typeof value === 'number';
  const metric = scalar ? {value} : value;
  const isValue = (input: unknown) => typeof input === 'string' || typeof input === 'number' && Number.isFinite(input);
  if (!metric || Array.isArray(metric) || !isValue(metric.value) ||
      [metric.label,metric.description,metric.unit].some(field=>field!==undefined&&typeof field!=='string') ||
      metric.delta!==undefined&&!isValue(metric.delta) ||
      metric.trend!==undefined&&!['up','down','flat'].includes(metric.trend)||
      metric.sentiment!==undefined&&!['positive','negative','neutral'].includes(metric.sentiment)) {
    throw new TypeError('Metric content requires a finite numeric or string value and schema-valid display metadata.');
  }
  const scale=options.scale??1,minimum=snapFontSizeUp((options.minFontSize??16)*scale);
  const rasterPadding=(options.textRasterPadding??1)*scale,hasOutlines=options.textMeasurement?.outlineBounds!==undefined;
  if (![box.x,box.y,box.width,box.height,box.x+box.width,box.y+box.height,scale,minimum,Math.max(76*scale,minimum)*1.22].every(Number.isFinite) ||
      box.width<=0||box.height<=0||scale<=0||minimum<=0) {
    throw new RangeError('Metric dimensions, scale and minimum font size must be finite and positive.');
  }
  if(!Number.isFinite(rasterPadding)||rasterPadding<0)throw new RangeError('Metric raster padding must be finite and nonnegative.');
  if (options.overflow!==undefined&&!['warn','error'].includes(options.overflow)) throw new RangeError('Invalid metric overflow policy.');
  const requestedAlignment=options.align??'left';
  if (!['left','center','right'].includes(requestedAlignment)) throw new RangeError('Invalid metric alignment.');
  const sourcePath=options.path??'metric',parts:MetricTextPart[]=[],diagnostics:MetricLayoutDiagnostic[]=[];
  for (const role of ['value','unit','label','description','delta','trend'] as const) {
    const sourceValue=metric[role];
    if (sourceValue===undefined) continue;
    const text=String(sourceValue),path=scalar?sourcePath:`${sourcePath}.${role}`;
    const nominal=role==='value'?Math.min(76*scale,box.height*.28):(role==='description'?20:role==='trend'?18:23)*scale;
    const requestedStyle:TextStyle={fontFamily:(role==='value'?options.fontFamilies?.heading:options.fontFamilies?.body)??'sans-serif',fontWeight:role==='value'?800:role==='description'?400:500,italic:false,path};
    const part:MetricTextPart={role,path,text,sources:[{path,value:sourceValue,start:0,end:text.length}],visible:role==='value'||text.length>0,linePositions:[],
      box:{...box,height:0},requestedFontSize:gridFontSize(nominal,minimum),minFontSize:minimum,requestedStyle,style:resolveTextStyle({...requestedStyle},options.textMeasurement)};
    if (!part.visible) part.fit={lines:[],sourceLines:[],fontSize:part.requestedFontSize,lineHeight:part.requestedFontSize*1.22,tabSize:4,tabWidth:0,overflow:false};
    parts.push(part);
  }
  const primary=parts[0]!,metadata=parts.filter(part=>part!==primary&&part.visible),unit=metadata.find(part=>part.role==='unit');
  // Logical alignment (RR-05): in a right-to-left deck a metric whose own text is right-to-left starts at the right edge.
  const metricDirection:TextDirection|undefined=options.direction==='rtl'?paragraphDirection((['label','description','unit'] as const).map(role=>parts.find(part=>part.role===role)?.text).find(Boolean)??primary.text,'rtl'):undefined;
  const alignment=physicalAlignment(requestedAlignment,metricDirection);
  const usable=(area:LayoutBox)=>[area.x,area.y,area.width,area.height,area.x+area.width,area.y+area.height].every(Number.isFinite)&&area.width>0&&area.height>0;
  const occupied=(fit:CodeTextFit)=>fit.placement?.height??fit.lines.length*fit.lineHeight;
  const gap=8*scale,primaryGap=12*scale;
  const lineInk=(part:MetricTextPart,fit:CodeTextFit):TextLineInk[]=>fit.sourceLines.map((line,index)=>{
    let outline:LayoutBox|null=null;
    for(const segment of line.segments) {
      if(segment.kind!=='text')continue;
      const bounds=measureTextOutline(part.text.slice(segment.start,segment.end),fit.fontSize,part.style,options.textMeasurement);
      if(!bounds)continue;
      const next={...bounds,x:segment.x+bounds.x};
      if(!outline)outline=next;else{
        const right=Math.max(outline.x+outline.width,next.x+next.width),bottom=Math.max(outline.y+outline.height,next.y+next.height);
        outline.x=Math.min(outline.x,next.x);outline.y=Math.min(outline.y,next.y);outline.width=right-outline.x;outline.height=bottom-outline.y;
      }
    }
    return {width:line.width,y:index*fit.lineHeight,baseline:fit.fontSize+index*fit.lineHeight,height:fit.lineHeight,outline};
  });
  const place=(part:MetricTextPart,fit:CodeTextFit,width:number):CodeTextFit=>{
    if(!hasOutlines)return fit;
    const placement=placeTextLines(lineInk(part,fit),{x:0,y:0,width,height:Number.MAX_VALUE},alignment,rasterPadding);
    return {...fit,placement,overflow:placement.overflow};
  };
  const naturalWidth=(part:MetricTextPart,fit:CodeTextFit)=>{
    if(!hasOutlines)return Math.max(...fit.sourceLines.map(line=>line.width));
    const width=Math.max(...lineInk(part,fit).map(line=>Math.max(line.width,line.outline?line.outline.x+line.outline.width:0)-Math.min(0,line.outline?.x??0)));
    // An empty primary value retains its nominal editor target, not a padding-only sliver.
    return width>0?width+2*rasterPadding:0;
  };
  const cache=new Map<string,CodeTextFit>();
  const measure=(part:MetricTextPart,size:number,width:number)=>{
    const key=JSON.stringify([part.role,size,width]);
    let fit=cache.get(key);
    if (!fit) {
      fit=fitCodeText(part.text,{...box,width:hasOutlines?Math.max(Number.MIN_VALUE,width-2*rasterPadding):width},size,size,scale,textWidthMeasurer(part.style,options.textMeasurement),options.direction);
      fit=place(part,fit,width);
      if (!Number.isFinite(occupied(fit))) throw new RangeError('Metric text layout exceeds finite coordinates.');
      cache.set(key,fit);
    }
    return fit;
  };
  const fitValue=(area:LayoutBox,singleLine:boolean)=>{
    if (!usable(area)) return undefined;
    // Derive sizes from the requested size: repeated subtraction accumulates rounding
    // error and can add an extra trial at very small floors.
    for (let step=0;step<=76;step++) {
      const size=gridFontSize(primary.requestedFontSize-step*scale,minimum);
      const natural=measure(primary,size,area.width);
      const fit={...natural,overflow:!!natural.placement?.overflow||singleLine&&natural.lines.length!==1||occupied(natural)>area.height+.01||natural.sourceLines.some(line=>line.width>area.width+.01)};
      if (!fit.overflow||size===minimum) return fit;
    }
  };
  type Allocation={part:MetricTextPart;box:LayoutBox;fit:CodeTextFit|undefined};
  type Candidate={arrangement:MetricLayout['arrangement'];allocations:Allocation[];score:number;overflow:boolean};
  let selected:Candidate|undefined,attempts=0;
  const reductions=Math.min(23,Math.ceil(Math.max(0,...metadata.map(part=>(part.requestedFontSize-minimum)/scale))));
  for (let reduction=0;reduction<=reductions;reduction++) {
    const measured=new Map(metadata.map(part=>[part,measure(part,gridFontSize(part.requestedFontSize-reduction*scale,minimum),box.width)]));
    const measuredUnit=unit?measured.get(unit):undefined;
    const unitWidth=unit&&measuredUnit?naturalWidth(unit,measuredUnit):0;
    const unitFit=unit&&measuredUnit&&unitWidth>0?place(unit,measuredUnit,unitWidth):measuredUnit;
    const inline=unitFit?.lines.length===1&&unitWidth>0&&unitWidth<=box.width*.35&&unitWidth+gap<box.width;
    for (const arrangement of (inline?['inline-unit','stacked']:['stacked']) as MetricLayout['arrangement'][]) {
      attempts++;
      const tail=metadata.filter(part=>arrangement!=='inline-unit'||part!==unit);
      const tailHeight=tail.reduce((sum,part)=>sum+occupied(measured.get(part)!),0)+Math.max(0,tail.length-1)*gap;
      if (!Number.isFinite(tailHeight)) throw new RangeError('Metric metadata exceeds finite coordinates.');
      const area={...box,width:arrangement==='inline-unit'?box.width-unitWidth-gap:box.width,height:box.height-tailHeight-(tail.length?primaryGap:0)};
      const valueFit=fitValue(area,arrangement==='inline-unit'),valueHeight=valueFit?occupied(valueFit):0;
      const allocations:Allocation[]=[];
      let primaryHeight=valueHeight;
      if (arrangement==='inline-unit'&&unit&&unitFit&&valueFit) {
        const valueBaseline=valueFit.placement?.lines.at(-1)?.baseline??valueHeight-valueFit.lineHeight+valueFit.fontSize;
        const unitBaseline=unitFit.placement?.lines.at(-1)?.baseline??occupied(unitFit)-unitFit.lineHeight+unitFit.fontSize;
        const valueY=box.y+Math.max(0,unitBaseline-valueBaseline),unitY=box.y+Math.max(0,valueBaseline-unitBaseline);
        const measuredWidth=naturalWidth(primary,valueFit);
        const valueWidth=Math.min(area.width,measuredWidth||valueFit.fontSize);
        allocations.push({part:primary,box:{...area,y:valueY,width:valueWidth,height:valueHeight},fit:place(primary,valueFit,valueWidth)});
        allocations.push({part:unit,box:{x:box.x+valueWidth+gap,y:unitY,width:unitWidth,height:occupied(unitFit)},fit:{...unitFit,overflow:!!unitFit.placement?.overflow}});
        primaryHeight=Math.max(valueY-box.y+valueHeight,unitY-box.y+occupied(unitFit));
      } else allocations.push({part:primary,box:valueFit?{...area,height:valueHeight}:area,fit:valueFit});
      // Keep related fields together. An arbitrary percentage gap disconnects a stacked unit
      // from its value on tall cells and wastes space needed by longer labels.
      let y=box.y+primaryHeight+(tail.length?primaryGap:0);
      for (const part of tail) {
        const natural=measured.get(part)!,height=occupied(natural);
        allocations.push({part,box:{...box,y,height},fit:{...natural,overflow:!!natural.placement?.overflow||natural.sourceLines.some(line=>line.width>box.width+.01)}});
        y+=height+gap;
      }
      const overflow=!valueFit||valueFit.overflow||arrangement==='inline-unit'&&valueFit.lines.length!==1||primaryHeight>area.height+.01||allocations.some(({box:area,fit})=>!fit||fit.overflow||!usable(area)||area.y+area.height>box.y+box.height+.01);
      const score=allocations.reduce((sum,{part,fit})=>sum+(part.requestedFontSize-(fit?.fontSize??minimum))/scale,0);
      const candidate={arrangement,allocations,score,overflow};
      if (!selected||!overflow&&(selected.overflow||score<selected.score)||overflow&&selected.overflow) selected=candidate;
    }
    if (selected&&!selected.overflow&&selected.score===0) break;
  }
  for (const allocation of selected!.allocations) {allocation.part.box=allocation.box;allocation.part.fit=allocation.fit;}
  const alignmentFactor=alignment==='center'?.5:alignment==='right'?1:0;
  if (selected!.arrangement==='inline-unit'&&unit) {
    const offset=(box.width-(unit.box.x+unit.box.width-box.x))*alignmentFactor;
    primary.box.x+=offset;unit.box.x+=offset;
  }
  for (const part of parts) if (part.fit) {
    if(part.fit.placement) {
      part.fit={...part.fit,placement:{...part.fit.placement,lines:part.fit.placement.lines.map(line=>({...line,x:line.x+part.box.x,y:line.y+part.box.y,baseline:line.baseline+part.box.y,outline:line.outline?{...line.outline,x:line.outline.x+part.box.x,y:line.outline.y+part.box.y}:null}))}};
      part.linePositions=part.fit.placement!.lines.map(({x,baseline})=>({x,baseline}));
    } else part.linePositions=part.fit.sourceLines.map((line,index)=>({
      x:part.box.x+(part.box.width-line.width)*alignmentFactor,baseline:part.box.y+part.fit!.fontSize+index*part.fit!.lineHeight,
    }));
  }
  const report=(reason:MetricLayoutDiagnostic['reason'],part:MetricTextPart,roles:MetricTextPart['role'][],message:string)=>
    diagnostics.push({code:'text-overflow',reason,path:part.path,parts:roles,message});
  for (const part of parts.filter(part=>part.visible)) {
    if (!part.fit||!usable(part.box)) report('invalid-part-box',part,[part.role],`Metric ${part.role} has no usable space after metadata; increase the cell or change the arrangement.`);
    else if (part.fit.overflow) report('text-fit',part,[part.role],`Metric ${part.role} exceeds its space at the readability floor; increase the cell or change the arrangement.`);
    if (usable(part.box)&&(part.box.x<box.x||part.box.y<box.y||part.box.x+part.box.width>box.x+box.width+.01||part.box.y+part.box.height>box.y+box.height+.01)) {
      report('part-outside-cell',part,[part.role],`Metric ${part.role} extends outside its cell; increase the cell or change the arrangement.`);
    }
  }
  const visible=parts.filter(part=>part.visible&&part.fit);
  for (const [index,first] of visible.entries()) for (const second of visible.slice(index+1)) {
    if (first.box.x<second.box.x+second.box.width-.01&&second.box.x<first.box.x+first.box.width-.01&&
        first.box.y<second.box.y+occupied(second.fit!)-.01&&second.box.y<first.box.y+occupied(first.fit!)-.01) {
      report('part-overlap',first,[first.role,second.role],'Metric part line boxes overlap; do not accept this layout without more space.');
    }
  }
  if (diagnostics.length&&options.overflow==='error') throw new OPFCompositionError(diagnostics);
  return {algorithm:'metric-flow-v1',alignment,textMeasurement:options.textMeasurement?'provided':'estimated',arrangement:selected!.arrangement,...(metric.sentiment===undefined?{}:{sentiment:metric.sentiment}),attempts,parts,diagnostics,overflow:diagnostics.length>0};
}

/** Progress of a timeline event (FA-11). Engines draw it from the deck's colors; see `timelineMarkerShapes`. */
export type TimelineStatus = 'done' | 'current' | 'planned';
const TIMELINE_STATUS_VALUES: readonly string[] = ['done', 'current', 'planned'];
/** The 'current' ring is this multiple of the marker radius. */
const TIMELINE_RING_RATIO = 1.6;
export interface TimelineEvent { when?: string; what: string; description?: string; status?: TimelineStatus }
export interface TimelineContent { name?: string; description?: string; events: TimelineEvent[] }
export interface TimelineTextPart {
  role: 'name' | 'description' | 'when' | 'what' | 'event-description';
  eventIndex?: number;
  /** The event's status; absent for metadata parts and for events without a status. */
  status?: TimelineStatus;
  path: string;
  text: string;
  sources: {path:string;start:number;end:number}[];
  box: LayoutBox;
  /** Logical alignment: `left` is the start edge, which a right-to-left line draws at the right (see `fit.directions`). */
  alignment: 'left' | 'center';
  requestedFontSize: number;
  minFontSize: number;
  requestedStyle: TextStyle;
  style: TextStyle;
  fit?: SourceTextFit;
}
export interface TimelineLayoutDiagnostic extends LayoutDiagnostic {
  reason: 'text-fit' | 'part-outside-cell' | 'event-space';
}
export interface TimelineLayout {
  algorithm: 'timeline-flow-v1';
  arrangement: 'alternating' | 'vertical';
  attempts: number;
  textMeasurement: 'provided' | 'estimated';
  textOutlines: 'provided' | 'unavailable';
  parts: TimelineTextPart[];
  /**
   * One marker per event. `radius` is the marker's own radius; `status` repeats the event's status
   * (absent without one). A 'current' marker also has `ring.radius`, 1.6 times `radius`, and a
   * 'current' or 'planned' marker has the `strokeWidth` of its outline and ring. Every radius is that
   * of the drawn ellipse; an outline is centered on the ellipse edge, so it reaches half a stroke beyond.
   */
  markers: {path:string;eventIndex:number;x:number;y:number;radius:number;status?:TimelineStatus;ring?:{radius:number};strokeWidth?:number}[];
  connector: {x1:number;y1:number;x2:number;y2:number};
  diagnostics: TimelineLayoutDiagnostic[];
  overflow: boolean;
}
export interface TimelineLayoutOptions extends QuoteLayoutOptions { textRasterPadding?: number }

/** Preserve event order and field boundaries while trying at most 50 readable arrangements. */
export function layoutTimeline(value: readonly TimelineEvent[] | TimelineContent, box: LayoutBox, options: TimelineLayoutOptions = {}): TimelineLayout {
  const shorthand=Array.isArray(value),timeline=(shorthand?{events:value}:value) as TimelineContent;
  if(!timeline||!Array.isArray(timeline.events)||!timeline.events.length||
    [timeline.name,timeline.description].some(field=>field!==undefined&&typeof field!=='string')||
    timeline.events.some(event=>!event||typeof event.what!=='string'||[event.when,event.description].some(field=>field!==undefined&&typeof field!=='string'))) {
    throw new TypeError('Timeline content requires ordered events with string labels and optional string metadata.');
  }
  if(timeline.events.some(event=>event.status!==undefined&&!TIMELINE_STATUS_VALUES.includes(event.status)))throw new TypeError("Timeline event status must be 'done', 'current' or 'planned'.");
  const scale=options.scale??1,minimum=snapFontSizeUp((options.minFontSize??16)*scale),padding=(options.textRasterPadding??1)*scale;
  if(![box.x,box.y,box.width,box.height,scale,minimum,padding].every(Number.isFinite)||box.width<=0||box.height<=0||scale<=0||minimum<=0||padding<0)throw new RangeError('Timeline dimensions, scale and minimum must be positive, with finite nonnegative raster padding.');
  if(options.overflow!==undefined&&!['warn','error'].includes(options.overflow))throw new RangeError('Invalid timeline overflow policy.');
  const outlines=options.textMeasurement?.outlineBounds!==undefined,rtl=options.direction==='rtl';
  if(outlines&&typeof options.textMeasurement?.outlineBounds!=='function')throw new TypeError('Text outline provider must be a function.');
  const path=options.path??'timeline',eventPath=(index:number)=>shorthand?`${path}.${index}`:`${path}.events.${index}`;
  const fonts=resolveFontFamilies(options.fontFamilies),source:TimelineTextPart[]=[];
  const add=(role:TimelineTextPart['role'],text:string|undefined,partPath:string,size:number,weight:number,eventIndex?:number)=>{
    if(text===undefined)return;
    // A current event's label is bold ("we are here"); every other part keeps its weight.
    const status=eventIndex===undefined?undefined:timeline.events[eventIndex]!.status;
    const requestedStyle:TextStyle={fontFamily:fonts.body,fontWeight:status==='current'&&role==='what'?700:weight,italic:false,path:partPath};
    source.push({role,eventIndex,...(status?{status}:{}),path:partPath,text,sources:[{path:partPath,start:0,end:text.length}],box:{...box},alignment:'center',requestedFontSize:gridFontSize(size*scale,minimum),minFontSize:minimum,requestedStyle,style:resolveTextStyle({...requestedStyle},options.textMeasurement)});
  };
  add('name',timeline.name,`${path}.name`,24,700);add('description',timeline.description,`${path}.description`,18,400);
  timeline.events.forEach((event,index)=>{add('when',event.when,`${eventPath(index)}.when`,16,500,index);add('what',event.what,`${eventPath(index)}.what`,16,500,index);add('event-description',event.description,`${eventPath(index)}.description`,16,500,index);});
  const metadata:TimelineTextPart[]=[],events:TimelineTextPart[][]=timeline.events.map(()=>[]);
  for(const part of source)if(part.eventIndex===undefined)metadata.push(part);else events[part.eventIndex]!.push(part);
  const cache=new Map<string,{fit:SourceTextFit;ink:TextLineInk[];height:number}>();
  const measure=(part:TimelineTextPart,size:number,width:number,alignment:TimelineTextPart['alignment'])=>{
    const key=JSON.stringify([part.path,size,width,alignment]);let measured=cache.get(key);
    if(measured)return measured;
    const fit=fitText(part.text,{x:0,y:0,width:Math.max(Number.MIN_VALUE,width-(outlines?2*padding:0)),height:Number.MAX_VALUE},size,size,textWidthMeasurer(part.style,options.textMeasurement),options.direction);
    const ink:TextLineInk[]=fit.sourceLines.map((line,index)=>{
      let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity,hasInk=false;
      if(outlines)for(const segment of line.segments)if(segment.kind==='text'){
        const outline=measureTextOutline(part.text.slice(segment.start,segment.end),size,part.style,options.textMeasurement);
        if(outline){hasInk=true;left=Math.min(left,outline.x+segment.x);top=Math.min(top,outline.y);right=Math.max(right,outline.x+segment.x+outline.width);bottom=Math.max(bottom,outline.y+outline.height);}
      }
      return {width:line.width,y:index*fit.lineHeight,baseline:size+index*fit.lineHeight,height:fit.lineHeight,outline:hasInk?{x:left,y:top,width:right-left,height:bottom-top}:null};
    });
    const placement=outlines?placeTextLines(ink,{x:0,y:0,width,height:Number.MAX_VALUE},alignment,padding,fit.directions):undefined;
    const height=placement?.height??fit.sourceLines.length*fit.lineHeight;
    if(!Number.isFinite(height))throw new RangeError('Timeline text exceeds finite layout coordinates.');
    measured={fit,ink,height};cache.set(key,measured);return measured;
  };
  type Candidate={arrangement:TimelineLayout['arrangement'];parts:TimelineTextPart[];markers:TimelineLayout['markers'];connector:TimelineLayout['connector'];diagnostics:TimelineLayoutDiagnostic[];score:number};
  let selected:Candidate|undefined,attempts=0;
  let reductionLimit=0;
  for(const part of source)reductionLimit=Math.max(reductionLimit,(part.requestedFontSize-minimum)/scale);
  const reductions=Math.min(24,Math.ceil(reductionLimit));
  for(let reduction=0;reduction<=reductions;reduction++){
    for(const arrangement of ['alternating','vertical'] as const){
      attempts++;
      const parts:TimelineTextPart[]=[],markers:TimelineLayout['markers']=[],diagnostics:TimelineLayoutDiagnostic[]=[];
      let score=0;
      const report=(part:TimelineTextPart,reason:TimelineLayoutDiagnostic['reason'],message:string,excess=1)=>{diagnostics.push({code:'text-overflow',reason,path:part.path,message});score+=Math.max(1,excess);};
      const place=(part:TimelineTextPart,x:number,y:number,width:number,alignment:TimelineTextPart['alignment'])=>{
        const measured=measure(part,gridFontSize(part.requestedFontSize-reduction*scale,minimum),Math.max(scale,width),alignment);
        const area={x,y,width:Math.max(scale,width),height:Math.max(scale,measured.height)},placement=outlines?placeTextLines(measured.ink,area,alignment,padding,measured.fit.directions):undefined;
        const fit={...measured.fit,...(placement?{placement}:{}),overflow:measured.fit.overflow||!!placement?.overflow};
        const accepted={...part,box:area,alignment,fit};parts.push(accepted);
        if(fit.overflow)report(accepted,'text-fit','Timeline field exceeds its readable width; increase its space or split the timeline.');
        if(area.x<box.x-.01||area.y<box.y-.01||area.x+area.width>box.x+box.width+.01||area.y+area.height>box.y+box.height+.01)report(accepted,'part-outside-cell','Timeline field extends outside its cell; increase the cell or paginate events.',Math.max(area.x+area.width-box.x-box.width,area.y+area.height-box.y-box.height));
        return accepted;
      };
      let y=box.y;
      for(const part of metadata){const placed=place(part,box.x,y,box.width,'center');y+=placed.box.height+8*scale;}
      const available=box.y+box.height-y,count=events.length,radius=Math.min(9*scale,box.width/Math.max(2,count)/5,Math.max(scale,available)*.04);
      // Status geometry (FA-11): only a 'current' event gets a ring, and only a 'current' or 'planned' marker has an outline.
      const statusOf=(index:number)=>timeline.events[index]!.status,ringRadius=radius*TIMELINE_RING_RATIO,strokeWidth=Math.min(2*scale,radius/2);
      const hasRing=timeline.events.some(event=>event.status==='current');
      const marker=(index:number,x:number,y:number):TimelineLayout['markers'][number]=>{
        const status=statusOf(index);
        return {path:eventPath(index),eventIndex:index,x,y,radius,...(status?{status}:{}),...(status==='current'?{ring:{radius:ringRadius}}:{}),...(status==='current'||status==='planned'?{strokeWidth}:{})};
      };
      if(arrangement==='alternating'){
        const width=box.width/Math.max(2,count),step=(box.width-width)/Math.max(1,count-1),start=count===1?box.x+box.width/2:box.x+width/2;
        const lineY=y+Math.max(scale,available)*.46;
        events.forEach((fields,index)=>{
          const x=start+(rtl?count-1-index:index)*step,top=index%2===0?y:lineY+24*scale,bottom=index%2===0?lineY-24*scale:box.y+box.height;
          markers.push(marker(index,x,lineY));let cursor=top;
          for(const part of fields){const placed=place(part,x-width/2,cursor,width,'center');cursor+=placed.box.height;if(cursor>bottom+.01)report(placed,'event-space','Timeline event labels exceed their side of the connector; change the arrangement or paginate events.',cursor-bottom);}
        });
      }else{
        // Right to left: the marker rail runs down the right edge and the text, aligned to its start, sits to its left.
        // A ring widens the rail, and the text keeps its usual distance from the marker's edge.
        const lead=hasRing?ringRadius+strokeWidth/2:radius,gap=24*scale+(lead-radius);
        const x=rtl?box.x+box.width-lead:box.x+lead,textX=rtl?box.x:box.x+gap,width=box.width-gap;
        events.forEach((fields,index)=>{
          const top=y;let first:TimelineTextPart|undefined;
          for(const part of fields){const placed=place(part,textX,y,width,'left');first??=placed;y+=placed.box.height;}
          markers.push(marker(index,x,top+Math.min(first?.box.height??2*radius,2*radius)/2));
          y+=16*scale;
        });
      }
      for(const marker of markers){const extent=(marker.ring?.radius??marker.radius)+(marker.strokeWidth??0)/2;if(marker.x-extent<box.x-.01||marker.y-extent<box.y-.01||marker.x+extent>box.x+box.width+.01||marker.y+extent>box.y+box.height+.01){diagnostics.push({code:'text-overflow',reason:'event-space',path:marker.path,message:'Timeline marker has no usable space; increase the cell or paginate events.'});score+=1;}}
      const first=markers[0]!,last=markers.at(-1)!,connector=rtl?{x1:Math.min(first.x,last.x),y1:first.y,x2:Math.max(first.x,last.x),y2:last.y}:{x1:first.x,y1:first.y,x2:last.x,y2:last.y};
      const candidate={arrangement,parts,markers,connector,diagnostics,score};
      if(!selected||score<selected.score)selected=candidate;
      if(!diagnostics.length)break;
    }
    if(!selected!.diagnostics.length)break;
  }
  const {score,...result}=selected!;
  if(result.diagnostics.length&&options.overflow==='error')throw new OPFCompositionError(result.diagnostics);
  return {algorithm:'timeline-flow-v1',attempts,textMeasurement:options.textMeasurement?'provided':'estimated',textOutlines:outlines?'provided':'unavailable',...result,overflow:result.diagnostics.length>0};
}

export interface CodeContent { source: string; language?: string; filename?: string }
export interface TextLineSegment {
  kind: 'text' | 'tab';
  start: number;
  end: number;
  /** Measured position relative to this displayed line's origin, in reference pixels. */
  x: number;
  width: number;
}
/** Exact half-open UTF-16 offsets into the part text, including consumed hard line breaks. */
export interface TextLineSource {
  start: number;
  end: number;
  nextStart: number;
  boundary: 'soft' | 'hard' | 'end';
  width: number;
  /** Explicit tab placement is required in SVG; CSS tab-size alone does not implement it. */
  segments: TextLineSegment[];
}
export interface SourceTextFit extends TextFit {
  sourceLines: TextLineSource[];
  /** Tabs advance to the next multiple of four measured spaces from each displayed line's origin. */
  tabSize: 4;
  tabWidth: number;
}
/** Compatibility names for the shared source-preserving line contract. */
export type CodeLineSegment = TextLineSegment;
export type CodeLineSource = TextLineSource;
export interface CodeTextFit extends SourceTextFit {}
export interface CodeTextPart {
  role: 'filename' | 'language' | 'body';
  path: string;
  /** Original text, without case conversion, whitespace normalization or discarded newlines. */
  text: string;
  sources: {path:string;start:number;end:number}[];
  generated: boolean;
  box: LayoutBox;
  requestedFontSize: number;
  minFontSize: number;
  requestedStyle: TextStyle;
  style: TextStyle;
  fit?: CodeTextFit;
}
export interface CodeLayoutDiagnostic extends LayoutDiagnostic {
  reason: 'invalid-part-box' | 'part-outside-cell' | 'text-fit' | 'part-overlap';
  parts: CodeTextPart['role'][];
}
export interface CodeLayout {
  algorithm: 'code-flow-v1';
  textMeasurement: 'estimated' | 'provided';
  parts: CodeTextPart[];
  diagnostics: CodeLayoutDiagnostic[];
  overflow: boolean;
}
export interface CodeLayoutOptions extends QuoteLayoutOptions {}

/** Fit code without using prose whitespace normalization. The source remains reconstructable. */
function fitCodeText(text:string,box:LayoutBox,size:number,minimum:number,step:number,measure:MeasureTextWidth,direction?:TextDirection):CodeTextFit {
  return fitSourceText(text,box,size,minimum,step,measure,false,true,direction);
}

/** Retain exact source ranges and position tabs without passing control characters to a font shaper. */
function fitSourceText(text:string,box:LayoutBox,size:number,minimum:number,step:number,measure:MeasureTextWidth,prose=false,snap=true,direction?:TextDirection):SourceTextFit {
  const directionAt=direction==='rtl'?paragraphDirectionAt(text,'rtl'):undefined;
  const layout=(fontSize:number):CodeTextFit=>{
    const tabWidth=measure(' ',fontSize)*4;
    if (!Number.isFinite(tabWidth)||text.includes('\t')&&tabWidth<=0) throw new RangeError('Text tabs require a positive finite measured space advance.');
    const measureLine=(start:number,end:number,record=false)=>{
      let x=0,offset=start;
      const segments:CodeLineSegment[]=[];
      for (const [index,segment] of text.slice(start,end).split('\t').entries()) {
        if (index) {
          const next=(Math.floor(x/tabWidth+1e-9)+1)*tabWidth;
          if (record) segments.push({kind:'tab',start:offset,end:offset+1,x,width:next-x});
          x=next;offset++;
        }
        if (segment) {
          const advance=measure(segment,fontSize);
          if (record) segments.push({kind:'text',start:offset,end:offset+segment.length,x,width:advance});
          x+=advance;offset+=segment.length;
        }
      }
      return {width:x,segments};
    };
    const width=(start:number,end:number)=>measureLine(start,end).width;
    const sourceLines:CodeLineSource[]=[];
    let start=0,end=0,hangFrom=-1;
    const push=(last:number,nextStart:number,boundary:CodeLineSource['boundary'])=>{
      const measured=measureLine(start,last,true);
      // RR-17: a space that did not fit hangs at the end of its line: it stays in the line's source range but not in its width.
      if(hangFrom>=0&&hangFrom<last)measured.width=measureLine(start,hangFrom).width;
      hangFrom=-1;
      sourceLines.push({start,end:last,nextStart,boundary,...measured});
      start=nextStart;end=nextStart;
    };
    const tokens=prose?/\r\n|\r|\n|[^\S\r\n\u00a0\u202f\ufeff]+|(?:[^\s]|\u00a0|\u202f|\ufeff)+/gu:/\r\n|\r|\n|[^\S\r\n]+|[^\s]+/gu;
    for (const token of text.matchAll(tokens)) {
      if (token.index===undefined) throw new Error('Missing code token source offset.');
      const a=token.index,b=a+token[0].length;
      if (/^[\r\n]/.test(token[0])) {push(a,b,'hard');continue;}
      if (width(start,b)<=box.width+WRAP_TOLERANCE) {end=b;continue;}
      // A space that does not fit hangs at the end of the line instead of starting the next one.
      if (prose && end>start && /\S/u.test(text.slice(start,end)) && HANGING_SPACE.test(token[0][0]!)) {if(hangFrom<0)hangFrom=end;end=b;continue;}
      // Prefer a word boundary. Keep indentation with a following token's
      // fitting prefix instead of eagerly placing it on a separate line.
      if (end>start && /\S/u.test(text.slice(start,end))) push(a,a,'soft');
      if (width(start,b)<=box.width+WRAP_TOLERANCE) {end=b;continue;}
      // Nonbreaking spaces and word joiners carry an explicit author constraint.
      // Keep the protected token intact and report overflow at the chosen floor.
      if (prose&&/[\u00a0\u202f\u2060\ufeff]/u.test(token[0])) {end=b;continue;}
      for (const segment of textSegments.segment(token[0])) {
        const next=a+segment.index+segment.segment.length;
        if (end>start && width(start,next)>box.width+.01) push(a+segment.index,a+segment.index,'soft');
        end=next;
      }
    }
    push(end,end,'end');
    const lineHeight=fontSize*1.22;
    return {lines:sourceLines.map(line=>text.slice(line.start,line.end)),sourceLines,fontSize,lineHeight,tabSize:4,tabWidth,
      ...(directionAt?{directions:sourceLines.map(line=>directionAt(line.start))}:{}),
      overflow:sourceLines.length*lineHeight>box.height+.01||sourceLines.some(line=>line.width>box.width+.01)};
  };
  return fitAtSizes(layout,size,minimum,step,snap);
}

/** Shared filename/language/body allocation. Consumers must reuse the accepted fits and styles. */
export function layoutCode(value:string|CodeContent,box:LayoutBox,options:CodeLayoutOptions={}):CodeLayout {
  const shorthand=typeof value==='string',code=shorthand?{source:value}:value;
  if (!code||Array.isArray(code)||typeof code.source!=='string'||[code.language,code.filename].some(field=>field!==undefined&&typeof field!=='string')) {
    throw new TypeError('Code content must be a string or source object with optional string language/filename.');
  }
  const scale=options.scale??1,minimum=snapFontSizeUp((options.minFontSize??16)*scale);
  if (![box.x,box.y,box.width,box.height,box.x+box.width,box.y+box.height,scale,minimum,Math.max(18*scale,minimum)*1.22].every(Number.isFinite)||box.width<=0||box.height<=0||scale<=0||minimum<=0) {
    throw new RangeError('Code dimensions, scale and minimum font size must be finite and positive.');
  }
  if (options.overflow!==undefined&&!['warn','error'].includes(options.overflow)) throw new RangeError('Invalid code overflow policy.');
  const path=options.path??'code',inner={x:box.x+18,y:box.y+18,width:box.width-36,height:box.height-36};
  const parts:CodeTextPart[]=[],diagnostics:CodeLayoutDiagnostic[]=[];
  const add=(role:CodeTextPart['role'],text:string,partPath:string,generated=false)=>{
    const requestedStyle:TextStyle={fontFamily:options.fontFamilies?.code??'monospace',fontWeight:role==='body'?400:700,italic:false,path:partPath};
    const part:CodeTextPart={role,path:partPath,text,sources:generated?[]:[{path:partPath,start:0,end:text.length}],generated,box:{...inner},
      requestedFontSize:gridFontSize((role==='body'?18:14)*scale,minimum),minFontSize:minimum,requestedStyle,
      style:resolveTextStyle({...requestedStyle},options.textMeasurement)};
    parts.push(part);return part;
  };
  if (code.filename) add('filename',code.filename,`${path}.filename`);
  if (code.language) add('language',code.language,`${path}.language`);
  if (!parts.length) add('language','code',path,true);
  const body=add('body',code.source,shorthand?path:`${path}.source`),headers=parts.filter(part=>part!==body);
  const usable=(area:LayoutBox)=>[area.x,area.y,area.width,area.height].every(Number.isFinite)&&area.width>0&&area.height>0;
  const fit=(part:CodeTextPart,area:LayoutBox,size=part.requestedFontSize,floor=minimum)=>usable(area)
    ?fitCodeText(part.text,area,size,floor,scale,textWidthMeasurer(part.style,options.textMeasurement)):undefined;
  if (usable(inner)) {
    // There are at most two metadata parts and four nominal/floor combinations.
    const combinations=headers.reduce<{part:CodeTextPart;size:number}[][]>((choices,part)=>
      choices.flatMap(choice=>[...new Set([part.requestedFontSize,minimum])].map(size=>[...choice,{part,size}])),[[]]);
    type Allocation={part:CodeTextPart;box:LayoutBox;fit:CodeTextFit|undefined};
    let selected:{allocations:Allocation[];score:number;overflow:boolean}|undefined;
    for (const combination of combinations) {
      let y=inner.y;
      const allocations:Allocation[]=[];
      for (const [index,{part,size}] of combination.entries()) {
        const measured=fitCodeText(part.text,inner,size,size,scale,textWidthMeasurer(part.style,options.textMeasurement));
        const area={...inner,y,height:measured.lines.length*measured.lineHeight};
        allocations.push({part,box:area,fit:usable(area)?{...measured,overflow:measured.sourceLines.some(line=>line.width>area.width+.01)}:undefined});
        y+=area.height+(index<headers.length-1?8:12);
      }
      const area={...inner,y,height:inner.y+inner.height-y};
      allocations.push({part:body,box:area,fit:fit(body,area)});
      const overflow=allocations.some(({box,fit})=>!fit||fit.overflow||!usable(box)||box.y+box.height>inner.y+inner.height+.01);
      const score=allocations.reduce((sum,{part,fit})=>sum+(part.requestedFontSize-(fit?.fontSize??minimum))/scale,0);
      if (!selected||!overflow&&(selected.overflow||score<selected.score)||overflow&&selected.overflow) selected={allocations,score,overflow};
    }
    if (selected) for (const {part,box,fit} of selected.allocations) {part.box=box;part.fit=fit;}
  }
  const report=(reason:CodeLayoutDiagnostic['reason'],part:CodeTextPart,roles:CodeTextPart['role'][],message:string)=>
    diagnostics.push({code:'text-overflow',reason,path:part.path,parts:roles,message});
  for (const part of parts) {
    if (!part.fit) report('invalid-part-box',part,[part.role],`Code ${part.role} has no usable space after metadata and insets; increase the cell or change the arrangement.`);
    else if (part.fit.overflow) report('text-fit',part,[part.role],`Code ${part.role} exceeds its space at the readability floor; increase its space or change the arrangement.`);
    const area=part.box;
    if (usable(area)&&(area.x<box.x||area.y<box.y||area.x+area.width>box.x+box.width+.01||area.y+area.height>box.y+box.height+.01)) {
      report('part-outside-cell',part,[part.role],`Code ${part.role} extends outside its cell; increase the cell or change the arrangement.`);
    }
  }
  for (const [index,first] of parts.entries()) {
    const second=parts[index+1];
    if (first.fit&&second?.fit&&first.box.y+first.fit.lines.length*first.fit.lineHeight>second.box.y+.01) {
      report('part-overlap',first,[first.role,second.role],'Code part line boxes overlap; do not accept this layout without more space.');
    }
  }
  if (diagnostics.length&&options.overflow==='error') throw new OPFCompositionError(diagnostics);
  return {algorithm:'code-flow-v1',textMeasurement:options.textMeasurement?'provided':'estimated',parts,diagnostics,overflow:diagnostics.length>0};
}

export interface RichTextRun {
  text: string; bold?: boolean; italic?: boolean; underline?: boolean; strikethrough?: boolean;
  color?: string; fontSize?: number; fontFamily?: string; link?: string; superscript?: boolean; subscript?: boolean;
  /** Inline code: the run takes the design's code font (`RichTextOptions.codeFontFamily`) unless it names its own `fontFamily`. */
  code?: boolean;
  /** BCP-47 tag that overrides the deck language for this run; it reaches the fragment style as `style.lang`. */
  lang?: string;
  /** RR-34: reference ids this run cites (a marker follows the run; the deck's `references` list resolves them). */
  cite?: string | string[];
  /** RR-34: an inline footnote for this run (a marker follows the run; the note is listed in the slide's footnote area). */
  footnote?: string | (string | RichTextRun)[];
}
export interface RichTextFragment {
  /**
   * Tabs are source-preserving layout controls with a fixed advance, not glyph text. A marker is the
   * superscript citation/footnote number drawn after a run that cites or carries a footnote (RR-34): it
   * has no source range (`start === end === run.text.length`), so run indexes and offsets never shift.
   */
  kind?: 'tab' | 'marker';
  text: string; runIndex: number; start: number; end: number;
  x: number; width: number; fontSize: number; baselineShift: number;
  /** A marker only: the size the exporter writes (the marked run's size); `fontSize` is the glyph PowerPoint draws for it (2/3). */
  nominalSize?: number;
  style: TextStyle; run: RichTextRun;
}
export interface RichTextLine { fragments: RichTextFragment[]; width: number; y: number; baseline: number; height: number }
export interface RichTextFit extends TextFit { richLines: RichTextLine[]; height: number }
export interface RichTextOptions {
  style: TextStyle;
  /** The design's code family for runs with `code: true`; `monospace` when absent. */
  codeFontFamily?: string;
  textMeasurement?: TextMeasurement;
  /** Use one measured line advance for every line, as native table cells do. */
  uniformLineHeight?: boolean;
  /** Deck direction. In a right-to-left deck every line reports its paragraph's direction in `directions`. */
  direction?: TextDirection;
  /**
   * Marker text (`1`, `1,2`) for a run by its dotted path (`${style.path}.${runIndex}`), or undefined.
   * composeSlide supplies the deck numbering from `slideCitations`; a marker fragment is emitted after the run.
   */
  citationMarker?: (runPath: string) => string | undefined;
}

/** Fit mixed styles without flattening font metrics. Run fontSize is in points. */
export function fitRichText(input: readonly (string | RichTextRun)[], box: LayoutBox, requestedSize = 25, minFontSize = 16, options: RichTextOptions = {style:{fontFamily:'sans-serif',fontWeight:400}}): RichTextFit {
  if (![box.width,box.height,requestedSize,minFontSize].every(value=>Number.isFinite(value)&&value>0)) throw new RangeError('Rich text dimensions and font sizes must be finite and positive.');
  const layout=richTextLayouter(input,box,requestedSize,options,minFontSize);
  return fitAtSizes(layout,requestedSize,richMinimum(input,requestedSize,minFontSize));
}
/** Retain the existing relative shrink limit and enforce the floor on painted glyph sizes. */
function richMinimum(input:readonly (string|RichTextRun)[],requested:number,minimum:number):number {
  let floor=Math.min(requested,minimum),visible=false;
  for(const value of input) {
    const run=typeof value==='string'?{text:value}:value;
    if(!run.text)continue;
    const ratio=(run.fontSize===undefined?1:run.fontSize*4/3/requested)*(run.superscript||run.subscript?0.7:1);
    floor=Math.max(floor,minimum/ratio);visible=true;
  }
  return visible?floor:minimum;
}
function richTextLayouter(input: readonly (string | RichTextRun)[], box: LayoutBox, requestedSize: number, options: RichTextOptions, minimum=0): (fontSize:number)=>RichTextFit {
  let offset=0;
  const source=input.map((value,runIndex)=>{
    const run:RichTextRun=typeof value==='string'?{text:value}:value;
    if(typeof run?.text!=='string'||(run.fontSize!==undefined&&(!Number.isFinite(run.fontSize)||run.fontSize<=0))) throw new RangeError('Rich text runs need text and a positive finite font size.');
    const start=offset;offset+=run.text.length;
    const resolvedStyle=resolveTextStyle({...options.style,fontFamily:run.fontFamily??(run.code===true?options.codeFontFamily??'monospace':options.style.fontFamily),fontWeight:run.bold===undefined?options.style.fontWeight:run.bold?700:400,italic:run.italic??options.style.italic,path:options.style.path?`${options.style.path}.${runIndex}`:undefined},options.textMeasurement);
    // A run language reaches the measurement and the engines as `style.lang`, after the host resolved the family (it may rebuild the style).
    const style:TextStyle=typeof run.lang==='string'&&run.lang?{...resolvedStyle,lang:run.lang}:resolvedStyle;
    // RR-34: a citation/footnote marker belongs to the run end; it needs a path and text to attach to.
    const marker=options.citationMarker&&options.style.path&&run.text?options.citationMarker(`${options.style.path}.${runIndex}`):undefined;
    return {run,runIndex,start,end:offset,style,...(marker?{marker}:{})};
  });
  const whole=source.map(entry=>entry.run.text).join('');
  // Every painted size (the base size and each run's, scripts included) is on the 0.01 pt grid; a size at or above the floor never drops below it.
  const paint=(raw:number)=>raw>=minimum-1e-6?gridFontSize(raw,minimum):snapFontSizeDown(raw);
  const directionAt=options.direction==='rtl'?paragraphDirectionAt(whole,'rtl'):undefined;
  const layout=(rawFontSize:number):RichTextFit=>{
    // The authored size ratios follow the unsnapped request; only the painted result is snapped.
    const fontSize=paint(rawFontSize),ratio=rawFontSize/requestedSize;
    const fragments=(start:number,end:number):RichTextFragment[]=>{
      let x=0;const result:RichTextFragment[]=[];
      for(const entry of source){
        const a=Math.max(start,entry.start),b=Math.min(end,entry.end);if(b<=a)continue;
        const text=whole.slice(a,b),normalSize=entry.run.fontSize!==undefined?entry.run.fontSize*4/3*ratio:fontSize;
        const script=entry.run.superscript||entry.run.subscript;
        const size=script?paint(normalSize*0.7):paint(normalSize),baselineShift=entry.run.superscript?-normalSize*.35:entry.run.subscript?normalSize*.2:0;
        const measure=textWidthMeasurer(entry.style,options.textMeasurement);
        let cursor=0;
        for(const [index,segment] of text.split('\t').entries()) {
          if(index) {
            const tabStart=a+cursor,tabWidth=measure(' ',size)*4;
            if(!Number.isFinite(tabWidth)||tabWidth<=0)throw new RangeError('Rich text tabs require a positive finite measured space advance.');
            const next=(Math.floor(x/tabWidth+1e-9)+1)*tabWidth;
            result.push({kind:'tab',text:'\t',runIndex:entry.runIndex,start:tabStart-entry.start,end:tabStart-entry.start+1,x,width:next-x,fontSize:size,baselineShift,style:entry.style,run:entry.run});
            x=next;cursor++;
          }
          if(segment) {
            const width=measure(segment,size),segmentStart=a+cursor;
            result.push({text:segment,runIndex:entry.runIndex,start:segmentStart-entry.start,end:segmentStart-entry.start+segment.length,x,width,fontSize:size,baselineShift,style:entry.style,run:entry.run});
            x+=width;cursor+=segment.length;
          }
        }
        // RR-34: the marker follows the run's last character, raised like a superscript (its own
        // baseline shift is written natively as baseline="30000"). Zero source length.
        if(entry.marker&&b===entry.end) {
          const markerSize=Math.round(normalSize*CITATION_MARKER_SCALE*FONT_SIZE_GRID_PER_PX)/FONT_SIZE_GRID_PER_PX,width=measure(entry.marker,markerSize);
          result.push({kind:'marker',text:entry.marker,runIndex:entry.runIndex,start:entry.run.text.length,end:entry.run.text.length,x,width,fontSize:markerSize,nominalSize:normalSize,baselineShift:-normalSize*CITATION_MARKER_RAISE,style:entry.style,run:entry.run});
          x+=width;
        }
      }return result;
    };
    const width=(start:number,end:number)=>fragments(start,end).reduce((sum,fragment)=>sum+fragment.width,0);
    const ranges:{start:number;end:number}[]=[],hung=new Map<number,number>();
    let lineStart=0,lineEnd=0,hangFrom=-1;
    const push=(end:number)=>{if(hangFrom>=0)hung.set(ranges.length,hangFrom);hangFrom=-1;ranges.push({start:lineStart,end});lineStart=end;lineEnd=end;};
    for(const match of whole.matchAll(/\r\n|\r|\n|[^\S\r\n]+|[^\s]+/gu)){
      const start=match.index!,end=start+match[0].length;
      if(/^[\r\n]/.test(match[0])){push(start);lineStart=end;lineEnd=end;continue;}
      if(width(lineStart,end)<=box.width+WRAP_TOLERANCE){lineEnd=end;continue;}
      // Wrap at word boundaries; retain whitespace in the source ranges. RR-17: whitespace that does not fit hangs at the end of the line
      // (the source stays lossless and the next line never starts with a space); hanging whitespace is not part of the line's width.
      if(HANGING_SPACE.test(match[0][0]!)&&lineEnd>lineStart&&/\S/u.test(whole.slice(lineStart,lineEnd))){if(hangFrom<0)hangFrom=lineEnd;lineEnd=end;continue;}
      if(lineEnd>lineStart)push(start);
      if(width(start,end)<=box.width+WRAP_TOLERANCE){lineEnd=end;continue;}
      for(const {segment,index}of textSegments.segment(match[0])){
        const next=start+index+segment.length;
        if(lineEnd>lineStart&&width(lineStart,next)>box.width+WRAP_TOLERANCE)push(start+index);
        lineEnd=next;
      }
    }
    if(hangFrom>=0)hung.set(ranges.length,hangFrom);
    ranges.push({start:lineStart,end:lineEnd});
    let y=0;
    const richLines=ranges.map((range,rangeIndex)=>{
      const parts=fragments(range.start,range.end),shown=hung.get(rangeIndex)??range.end,ascent=Math.max(fontSize,...parts.map(part=>part.fontSize-part.baselineShift)),descent=Math.max(fontSize*.22,...parts.map(part=>part.fontSize*.22+part.baselineShift));
      const height=ascent+descent,line={fragments:parts,width:shown===range.end?parts.reduce((sum,p)=>sum+p.width,0):width(range.start,shown),y,baseline:y+ascent,height};y+=height;return line;
    });
    if (options.uniformLineHeight) {
      const height = Math.max(...richLines.map(line => line.height));
      y = 0;
      for (const line of richLines) {
        line.baseline += y - line.y;
        line.y = y;
        line.height = height;
        y += height;
      }
    }
    return {lines:ranges.map(range=>whole.slice(range.start,range.end)),fontSize,lineHeight:Math.max(fontSize*1.22,...richLines.map(line=>line.height)),richLines,height:y,overflow:y>box.height+.01||richLines.some(line=>line.width>box.width+.01),
      ...(directionAt?{directions:ranges.map(range=>directionAt(range.start))}:{})};
  };
  return layout;
}

export type ListText = string | readonly (string | RichTextRun)[];
export type ListValue = ListText | {text:ListText; description?:ListText; level?:number; start?:number};
export interface ListEntryLayout {
  index:number; level:number; textPath?:string; descriptionPath?:string;
  value:ListText; descriptionValue?:ListText;
  text:RichTextFit; description?:RichTextFit;
  textBox:LayoutBox; descriptionBox?:LayoutBox;
  /**
   * `x` is the marker's left edge, or its right edge when `anchor` is `end` (a right-to-left entry, whose marker sits at the right and
   * whose text box is the column to its left).
   * The entry marker: the bullet glyph, or for a numbered list (`numbering`) the formatted number such as `iv.`.
   * A numbered marker also carries `number` and its measured `width`; its `style` is the list style with the weight and
   * slant of the entry's first run, as PowerPoint draws an auto-number in the first run's character formatting.
   */
  marker:{text:string;x:number;y:number;fontSize:number;style:TextStyle;indent:number;number?:ListNumber;width?:number;anchor?:'end'};
  /** Paragraph direction of this entry. Present only when the list was fitted for a right-to-left deck. */
  direction?:TextDirection;
  /** Picture bullet replacing the marker glyph; drawn in `bulletBox`. Marker geometry is unchanged. */
  bulletImage?:ListBulletImage;
  /**
   * Where the picture bullet draws: a square of side `marker.fontSize * PICTURE_BULLET_SCALE` whose
   * bottom sits on the marker baseline (`marker.y`) and whose left edge is `marker.x` (right edge when `marker.anchor` is `end`).
   * Present with `bulletImage`.
   */
  bulletBox?:LayoutBox;
}
/**
 * Side of a picture bullet as a fraction of the list font size. Desktop PowerPoint sizes an `a:buBlip` at
 * `a:buSzPct 100000` (what opf-pptx writes) as a square about 0.65 times the run's font size, bottom on the
 * text baseline and left at the bullet position, in every typeface: measured widths of 10, 15, 16, 20 and 31
 * pixels at font sizes of 16, 24, 25, 32 and 48 pixels (0.625 to 0.646; heights run about a pixel more from
 * anti-aliasing, so the true side is about 0.65). The export needs no size: PowerPoint sizes the bullet itself.
 */
export const PICTURE_BULLET_SCALE=0.65;
export interface ListFit extends TextFit { listEntries:ListEntryLayout[]; height:number }
export interface ListFitOptions extends RichTextOptions {
  /**
   * Number the entries instead of bulleting them (the payload's `numbering` field). The hanging indent becomes the larger of
   * 1.1 em and the widest marker plus 0.3 em, so wide markers never touch their text; unnumbered lists are unchanged.
   */
  numbering?:NumberingInput;
  /** Picture bullet for every entry (effective `design.listBullet: "image"` with a resolved icon logo). */
  bulletImage?:ListBulletImage;
}

/** Shared hanging indents, mixed-run fitting and description spacing for list payloads. */
export function fitList(input:readonly ListValue[],box:LayoutBox,requestedSize=25,minFontSize=16,options:ListFitOptions={style:{fontFamily:'sans-serif',fontWeight:400}}):ListFit {
  if(!Array.isArray(input)||![box.width,box.height,requestedSize,minFontSize].every(value=>Number.isFinite(value)&&value>0))throw new RangeError('List content, dimensions and font sizes must be valid.');
  const source=input.map((value,index)=>{
    const object=typeof value==='object'&&!Array.isArray(value)?value as {text:ListText;description?:ListText;level?:number}:undefined;
    const text=object?object.text:value as ListText,description=object?.description,level=object?.level??0;
    if(!Number.isInteger(level)||level<0)throw new RangeError('List levels must be nonnegative integers.');
    const runs=(value:ListText)=>typeof value==='string'?[value]:value;
    if(!Array.isArray(runs(text))||(description!==undefined&&!Array.isArray(runs(description))))throw new TypeError('List text and descriptions must be strings or text runs.');
    const base=options.style.path?`${options.style.path}.${index}`:undefined;
    const plain=(value:ListText)=>typeof value==='string'?value:value.map(run=>typeof run==='string'?run:run.text).join('');
    // A right-to-left deck mirrors the entries whose own paragraph is right-to-left (RR-05).
    const direction:TextDirection|undefined=options.direction==='rtl'?paragraphDirection(plain(text),'rtl'):undefined;
    return {index,level,direction,value:text,descriptionValue:description,textPath:base?base+(object?'.text':''):undefined,descriptionPath:base?base+'.description':undefined,runs:runs(text),descriptionRuns:description===undefined?undefined:runs(description)};
  });
  const numbers=options.numbering===undefined?undefined:listNumbers(input,options.numbering);
  // A native auto-number takes the weight and slant of the paragraph's first run.
  const markerStyleFor=(item:typeof source[number]):TextStyle=>{
    const first=item.runs.map(run=>typeof run==='string'?{text:run} as RichTextRun:run).find(run=>run.text);
    return {...options.style,path:item.textPath,fontWeight:first?.bold===undefined?options.style.fontWeight:first.bold?700:400,italic:first?.italic??options.style.italic};
  };
  const layout=(fontSize:number):ListFit=>{
    let y=box.y,overflow=false;const entries:ListEntryLayout[]=[],lines:string[]=[],directions:TextDirection[]=[];
    // One hanging indent for the whole list: 1.1 em, or for numbers the widest marker plus 0.3 em.
    const markerStyles=numbers?source.map(item=>resolveTextStyle(markerStyleFor(item),options.textMeasurement)):[];
    const markerWidths=numbers?numbers.map((number,index)=>textWidthMeasurer(markerStyles[index]!,options.textMeasurement)(number.text,fontSize)):[];
    const hanging=numbers?Math.max(fontSize*1.1,Math.max(0,...markerWidths)+fontSize*.3):fontSize*1.1;
    for(const item of source){
      const rtl=item.direction==='rtl';
      const indent=hanging,offset=Math.min(box.width,item.level*indent),x=rtl?box.x:box.x+offset+indent,width=Math.max(1,rtl?box.width-offset-indent:box.x+box.width-x);
      if(offset+indent>=box.width)overflow=true;
      const textBox={x,y,width,height:box.height};
      const style={...options.style,path:item.textPath};
      const text=richTextLayouter(item.runs,textBox,requestedSize,{...options,style},minFontSize)(fontSize);
      textBox.height=text.height;lines.push(...text.lines);if(options.direction==='rtl')directions.push(...(text.directions??[]));y+=text.height;
      let description:RichTextFit|undefined,descriptionBox:LayoutBox|undefined;
      if(item.descriptionRuns!==undefined){
        y+=fontSize*.12;descriptionBox={x,y,width,height:box.height};
        description=richTextLayouter(item.descriptionRuns,descriptionBox,requestedSize*.82,{...options,style:{...options.style,path:item.descriptionPath}},minFontSize)(fontSize*.82);
        descriptionBox.height=description.height;lines.push(...description.lines);if(options.direction==='rtl')directions.push(...(description.directions??[]));y+=description.height;
      }
      overflow ||= text.overflow||!!description?.overflow;
      const number=numbers?.[item.index];
      const marker={text:number?number.text:['•','◦','▪'][item.level%3]!,x:rtl?box.x+box.width-offset:box.x+offset,y:textBox.y+(text.richLines[0]?.baseline??fontSize),fontSize,style:number?markerStyles[item.index]!:resolveTextStyle(style,options.textMeasurement),indent,...(number?{number,width:markerWidths[item.index]!}:{}),...(rtl?{anchor:'end' as const}:{})},side=fontSize*PICTURE_BULLET_SCALE;
      entries.push({index:item.index,level:item.level,value:item.value,descriptionValue:item.descriptionValue,textPath:item.textPath,descriptionPath:item.descriptionPath,text,textBox,description,descriptionBox,marker,
        ...(item.direction?{direction:item.direction}:{}),
        ...(options.bulletImage&&!number?{bulletImage:options.bulletImage,bulletBox:{x:rtl?marker.x-side:marker.x,y:marker.y-side,width:side,height:side}}:{})});
      if(item.index<source.length-1)y+=fontSize*.28;
    }
    const height=y-box.y;
    return {listEntries:entries,lines,fontSize,lineHeight:fontSize*1.22,height,overflow:overflow||height>box.height+.01,...(options.direction==='rtl'?{directions}:{})};
  };
  let minimum=minFontSize;
  for(const item of source) {
    minimum=Math.max(minimum,richMinimum(item.runs,requestedSize,minFontSize));
    if(item.descriptionRuns!==undefined)minimum=Math.max(minimum,richMinimum(item.descriptionRuns,requestedSize*.82,minFontSize)/.82);
  }
  return fitAtSizes(layout,requestedSize,minimum);
}

function contentText(field: string, value: unknown): string | undefined {
  if (field === "text" || headings.has(field)) return flatten(value);
  if (field === "items" || field === "bullets") return (Array.isArray(value) ? value : [value]).map(item => {
    const entry = record(item);
    return `• ${flatten(item)}${entry.description ? `\n${flatten(entry.description)}` : ""}`;
  }).join("\n");
  if (field === "code") return flatten(record(value).source ?? value);
  if (field === "quote") return flatten(record(value).text ?? value);
  return undefined;
}
export interface TableLayoutOptions {
  scale?: number;
  minFontSize?: number;
  fontFamily?: string;
  /** The design's code family for cell runs with `code: true`. */
  codeFontFamily?: string;
  textMeasurement?: TextMeasurement;
  path?: string;
  /** RR-54: the document, for a dataset-backed table (`{ dataset }`): its headers, rows and column formats come from `datasets`. */
  presentation?: { datasets?: unknown };
  /**
   * Deck direction. A right-to-left deck lays the columns out right to left: the first column is the rightmost
   * and each cell's text reports its paragraph direction (RR-05).
   */
  direction?: TextDirection;
}
export interface TableCellLayout {
  value: unknown;
  input: unknown;
  sourcePath: string;
  style: TableCellStyle;
  row: number; column: number; rowSpan: number; colSpan: number;
  path: string;
  header: boolean;
  rich: boolean;
  box: LayoutBox;
  textBox: LayoutBox;
  textStyle: TextStyle;
  fit: TextFit | RichTextFit;
  /** Paragraph direction of the cell text; present only in a right-to-left deck. */
  direction?: TextDirection;
}
export interface TableRowLayout { box: LayoutBox; cells: TableCellLayout[] }
export interface TableLayout { rows: TableRowLayout[]; columnCount: number; height: number; overflow: boolean }

/** Shared cell geometry and font fitting for SVG, native PPTX and pagination.
 * Short rows retain their 54px preferred height. Multiline rows use the space
 * their text needs; constrained tables consume row padding before readable text.
 * All dimensions are canvas pixels; minFontSize is an unscaled canvas size.
 */
export function layoutTable(value: unknown, box: LayoutBox, options: TableLayoutOptions = {}): TableLayout {
  const scale = options.scale ?? 1, minimum = snapFontSizeUp((options.minFontSize ?? 16) * scale), requested = gridFontSize(15 * scale,minimum);
  if (![box.x,box.y,box.width,box.height,scale,minimum].every(Number.isFinite) || box.width <= 0 || box.height <= 0 || scale <= 0 || minimum <= 0) throw new RangeError('Table dimensions, scale and font sizes must be finite and positive.');
  // RR-54: dataset tables are laid out from their inline copy, and a body cell measures its formatted number text.
  const inline = inlineTableData(value, options.presentation);
  const grid = tableGrid(inline,options.path ?? 'table');
  if(grid.issues.length) throw new RangeError(`${grid.issues[0]!.path}: ${grid.issues[0]!.message}`);
  const formats = resolveTableData(inline).formats;
  for (const row of grid.rows) for (const cell of row) {
    if (cell.header) continue;
    const shown = tableCellDisplayValue(cell.input as DataTableCell, formats[cell.column]);
    if (shown !== cell.input) cell.value = typeof shown === 'object' && shown !== null && !Array.isArray(shown) ? shown.value : shown;
  }
  const columnCount=grid.columnCount,cellWidth=box.width/columnCount;
  const cells=grid.rows.flat().map(cell=>{
    const padding={top:8,right:10,bottom:4,left:10,...cell.style.padding};
    const width=cellWidth*cell.colSpan-(padding.left+padding.right)*scale;
    const style={fontFamily:options.fontFamily??'sans-serif',fontWeight:cell.header?700:400,italic:false,path:cell.valuePath};
    return {...cell,padding,width,textStyle:style};
  });
  const cellMinimum=(cell:typeof cells[number])=>Array.isArray(cell.value)?richMinimum(cell.value,requested,minimum):minimum;
  const fitCell=(cell:typeof cells[number],height:number,min:number):TextFit|RichTextFit=>{
    const textBox={x:0,y:0,width:Math.max(scale,cell.width),height:Math.max(scale,height)};
    return Array.isArray(cell.value)
      ? fitRichText(cell.value,textBox,requested,min,{style:cell.textStyle,...(options.codeFontFamily?{codeFontFamily:options.codeFontFamily}:{}),textMeasurement:options.textMeasurement,uniformLineHeight:true,direction:options.direction})
      : fitText(flatten(cell.value),textBox,requested,min,textWidthMeasurer(resolveTextStyle(cell.textStyle,options.textMeasurement),options.textMeasurement),options.direction);
  };
  const textHeight=(fit:TextFit|RichTextFit)=>'height' in fit?fit.height:fit.lines.length*fit.lineHeight;
  const required=(cell:typeof cells[number],natural:boolean)=>{
    const floor=cellMinimum(cell),size=gridFontSize(natural?Math.max(requested,floor):floor,floor);
    const textBox={x:0,y:0,width:Math.max(scale,cell.width),height:scale};
    const fit=Array.isArray(cell.value)
      ?richTextLayouter(cell.value,textBox,requested,{style:cell.textStyle,...(options.codeFontFamily?{codeFontFamily:options.codeFontFamily}:{}),textMeasurement:options.textMeasurement,uniformLineHeight:true},minimum)(size)
      :fitText(flatten(cell.value),textBox,size,size,textWidthMeasurer(resolveTextStyle(cell.textStyle,options.textMeasurement),options.textMeasurement));
    return textHeight(fit)+(cell.padding.top+cell.padding.bottom)*scale;
  };
  const natural=Array(grid.rowCount).fill(0) as number[],needed=Array(grid.rowCount).fill(0) as number[];
  for(const cell of cells)if(cell.rowSpan===1){natural[cell.row]=Math.max(natural[cell.row]!,required(cell,true));needed[cell.row]=Math.max(needed[cell.row]!,required(cell,false));}
  // Satisfy every spanning cell over its full rectangle. Added height can only
  // help previously processed constraints; no text is duplicated into covered rows.
  for(const cell of cells)if(cell.rowSpan>1)for(const [heights,preferredSize] of [[natural,true],[needed,false]] as const){
    const current=heights.slice(cell.row,cell.row+cell.rowSpan).reduce((a,b)=>a+b,0);
    const extra=Math.max(0,required(cell,preferredSize)-current)/cell.rowSpan;
    for(let r=cell.row;r<cell.row+cell.rowSpan;r++)heights[r]!+=extra;
  }
  const preferred=natural.map(height=>Math.max(54*scale,height));
  for(let r=0;r<needed.length;r++)needed[r]=Math.min(preferred[r]!,needed[r]!);
  const sum=(values:number[])=>values.reduce((a,b)=>a+b,0);
  const preferredTotal=sum(preferred),naturalTotal=sum(natural),neededTotal=sum(needed);
  const heights=preferred.map((height,r)=>preferredTotal<=box.height?height:naturalTotal<=box.height
    ? natural[r]!+(height-natural[r]!)*(box.height-naturalTotal)/Math.max(Number.EPSILON,preferredTotal-naturalTotal)
    : neededTotal<=box.height
    ? needed[r]!+(natural[r]!-needed[r]!)*(box.height-neededTotal)/Math.max(Number.EPSILON,naturalTotal-neededTotal)
    : needed[r]!*box.height/neededTotal);
  const ys=[box.y];for(const height of heights)ys.push(ys.at(-1)!+height);
  let overflow=false;
  const rows:TableRowLayout[]=heights.map((height,r)=>({box:{x:box.x,y:ys[r]!,width:box.width,height},cells:[]}));
  for(const cell of cells){
    const cellBox={x:box.x+(options.direction==='rtl'?columnCount-cell.column-cell.colSpan:cell.column)*cellWidth,y:ys[cell.row]!,width:cell.colSpan*cellWidth,height:ys[cell.row+cell.rowSpan]!-ys[cell.row]!};
    const available=cellBox.height-(cell.padding.top+cell.padding.bottom)*scale;
    const fit=fitCell(cell,available,minimum),height=textHeight(fit);
    const offset=cell.style.verticalAlign==='bottom'?Math.max(0,available-height):cell.style.verticalAlign==='middle'?Math.max(0,(available-height)/2):0;
    const textBox={x:cellBox.x+cell.padding.left*scale,y:cellBox.y+cell.padding.top*scale+offset,width:Math.max(scale,cell.width),height:Math.max(scale,available-offset)};
    overflow ||= cell.width<=0||available<=0||fit.overflow;
    rows[cell.row]!.cells.push({value:cell.value,input:cell.input,path:cell.valuePath,sourcePath:cell.path,style:cell.style,row:cell.row,column:cell.column,rowSpan:cell.rowSpan,colSpan:cell.colSpan,header:cell.header,rich:Array.isArray(cell.value),box:cellBox,textBox,textStyle:resolveTextStyle(cell.textStyle,options.textMeasurement),fit,...(fit.directions?{direction:fit.directions[0]}:{})});
  }
  return {rows,columnCount,height:sum(heights),overflow};
}
function tableOverflows(value: unknown, box: LayoutBox, scale: number, settings: Composition, options: ComposeSlideOptions, path?: string): boolean {
  return box.width <= 0 || box.height <= 0 || layoutTable(value,box,{scale,minFontSize:settings.minFontSize,fontFamily:options.fontFamilies?.body,...(options.fontFamilies?.code?{codeFontFamily:options.fontFamilies.code}:{}),textMeasurement:options.textMeasurement,path,presentation:options.presentation}).overflow;
}
function flatten(value: unknown): string {
  if (value == null) return "";
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return value.map(flatten).join("");
  const item = record(value);
  return flatten(item.text ?? item.value ?? item.source ?? JSON.stringify(value));
}
function regionParts(key: string): [number[], number[]] | undefined {
  const span = (part: string, order: string[]) => {
    const indices = part.split("+").map(value => order.indexOf(value));
    return indices.every(index => index >= 0) ? indices : undefined;
  };
  const parts = key.split(":");
  if (parts.length === 2) {
    const r = span(parts[0]!, rows), c = span(parts[1]!, columns);
    if (r && c) return [r, c];
  } else if (parts.length === 1) {
    const r = span(key, rows), c = span(key, columns);
    if (r) return [r, [0, 1, 2]];
    if (c) return [[0, 1, 2], c];
  }
  return undefined;
}
function regionBox(parts: [number[], number[]], area: LayoutBox, requestedGap: number): LayoutBox {
  const gap = Math.min(requestedGap, area.width / 6, area.height / 6);
  const cw = (area.width - gap * 2) / 3, ch = (area.height - gap * 2) / 3;
  const [r, c] = parts;
  return { x: area.x + Math.min(...c) * (cw + gap), y: area.y + Math.min(...r) * (ch + gap), width: (Math.max(...c) - Math.min(...c) + 1) * (cw + gap) - gap, height: (Math.max(...r) - Math.min(...r) + 1) * (ch + gap) - gap };
}
function gridGeometry(count: number, area: LayoutBox, cols: number, gap: number, weights: number[], vertical: boolean) {
  const rowCount = Math.ceil(count / cols);
  gap = Math.min(gap, area.width / (cols * 2), area.height / (rowCount * 2));
  const tracks = (length: number, total: number, weighted: boolean) => {
    const values = Array.from({ length }, (_, i) => weighted ? weights[i] ?? 1 : 1);
    const sum = values.reduce((a, b) => a + b, 0);
    let cursor = 0;
    return values.map(weight => { const size = (total - gap * (length - 1)) * weight / sum; const track = { offset: cursor, size }; cursor += size + gap; return track; });
  };
  const xs = tracks(cols, area.width, !vertical), ys = tracks(rowCount, area.height, vertical);
  const boxes = Array.from({ length: count }, (_, i) => ({ x: area.x + xs[i % cols]!.offset, y: area.y + ys[Math.floor(i / cols)]!.offset, width: xs[i % cols]!.size, height: ys[Math.floor(i / cols)]!.size }));
  return {boxes, columns: xs, rows: ys, gap};
}
function gridBoxes(count: number, area: LayoutBox, cols: number, gap: number, weights: number[], vertical: boolean): LayoutBox[] {
  return gridGeometry(count, area, cols, gap, weights, vertical).boxes;
}
function assertComposition(value: Composition) {
  if (value.mode !== undefined && !["auto", "grid", "row", "column"].includes(value.mode)) throw new RangeError("Unknown composition mode.");
  for (const [key, min, max] of [["gap", 0, 0.1], ["padding", 0, 0.2], ["minFontSize", 8, 32], ["columns", 1, 12]] as const) {
    const number = value[key];
    if (number !== undefined && (!Number.isFinite(number) || number < min || number > max || key === "columns" && !Number.isInteger(number))) throw new RangeError(`Invalid composition.${key}.`);
  }
  if (value.weights !== undefined && (!Array.isArray(value.weights) || !value.weights.length || value.weights.length > 12 || value.weights.some(weight => !Number.isFinite(weight) || weight <= 0 || weight > 100))) throw new RangeError("Invalid composition.weights.");
  if (value.overflow !== undefined && !["warn", "error"].includes(value.overflow)) throw new RangeError("Invalid composition.overflow.");
}
/** Compose a validated Slide. Layout resolution remains the caller's responsibility. */
export function composeSlide(input: unknown, options: ComposeSlideOptions = {}): SlideComposition {
  const slide = record(input), layout = record(options.layout);
  const width = options.width ?? 1280, height = options.height ?? 720;
  if (![width, height].every(value => Number.isFinite(value) && value > 0)) throw new RangeError("Canvas dimensions must be finite and positive.");
  const scale = Math.min(width, height) / 720;
  const deckDirection: TextDirection = options.direction ?? resolveSlideDirection(options.presentation, options.slideIndex);
  const rtl = deckDirection === 'rtl', textDirection = rtl ? 'rtl' as const : undefined;
  // One merge for every shared design key: slide design, then deck design (or the host's resolved deck values), then the layout record's design.
  const hints = resolveDesignHints({ slide, layout, presentation: options.presentation, slideIndex: options.slideIndex, deck: { titleAlignment: options.titleAlignment, contentAlignment: options.contentAlignment, contentBox: options.contentBox } });
  const hasCards = hints.contentBox ?? false;
  const composition: Composition = { ...record(layout.composition), ...record(slide.composition) };
  assertComposition(composition);
  const padding = (composition.padding ?? 0.08) * Math.min(width, height);
  const gap = (composition.gap ?? 1 / 30) * Math.min(width, height);
  const minSize = snapFontSizeUp((composition.minFontSize ?? 16) * scale);
  const rasterPadding=(options.textRasterPadding??1)*scale;
  if(!Number.isFinite(rasterPadding)||rasterPadding<0)throw new RangeError('Text raster padding must be finite and nonnegative.');
  // One alignment resolution for placement, internal payload layouts and consumers.
  // A cover (no body payload) has no content region, so its tag and subtitle belong to the heading group and
  // follow titleAlignment; only a slide's own design.contentAlignment keeps them apart. Set once cover detection has run.
  let coverGroup = false;
  const alignmentFor = (field: string): 'left' | 'center' | 'right' =>
    (field === 'title' || (coverGroup && (field === 'tag' || field === 'subtitle') && hints.sources.contentAlignment !== 'slide')
      ? hints.titleAlignment : hints.contentAlignment) ?? 'left';
  // The tag (eyebrow) takes the accent family when the font scheme defines one; the quote body does the same in layoutQuote.
  const styleFor = (field: string, path: string): TextStyle => resolveTextStyle({
    fontFamily: (field === "title" ? options.fontFamilies?.heading : field === "code" ? options.fontFamilies?.code : field === "tag" ? options.fontFamilies?.accent ?? options.fontFamilies?.body : options.fontFamilies?.body) ?? (field === "code" ? "monospace" : "sans-serif"),
    fontWeight: field === "title" ? 700 : 400, path,
  }, options.textMeasurement);
  const listBullet = hints.listBullet !== undefined ? { value: hints.listBullet, path: hints.paths.listBullet! } : undefined;
  const bulletImage: ListBulletImage | undefined = listBullet?.value === 'image' ? (() => {
    const resolved = resolveLogo(options.presentation, slide, { slot: 'icon', onDark: options.darkBackground, slideIndex: options.slideIndex });
    return resolved ? { source: resolved.source, path: resolved.path } : undefined;
  })() : undefined;
  const widthFor = (field: string, path: string) => textWidthMeasurer(styleFor(field,path),options.textMeasurement);
  // RR-34: citation/footnote markers of this slide, numbered with the deck (annotations.ts). Only slides
  // whose runs cite or carry footnotes get a marker resolver and a footnote area; others are unchanged.
  const citations = slideCitations(slide, options.slideIndex ?? 0, options.presentation);
  const citationMarker = citations ? (runPath: string) => citations.markers.get(runPath) : undefined;
  const richOptions = (style: TextStyle): RichTextOptions => ({style,textMeasurement:options.textMeasurement,...(options.fontFamilies?.code?{codeFontFamily:options.fontFamilies.code}:{}),...(citationMarker?{citationMarker}:{}),...(rtl?{direction:'rtl' as const}:{})});
  const fitPlacedText = (field:string,value:unknown,text:string,box:LayoutBox,size:number,minimum:number,path:string,explicitAlignment?:'left'|'center'|'right'):TextFit|RichTextFit => {
    const style=styleFor(field,path),rich=(field==='text'||headings.has(field))&&Array.isArray(value);
    if(!options.textMeasurement?.outlineBounds)return rich?fitRichText(value,box,size,minimum,richOptions(style)):fitText(text,box,size,minimum,textWidthMeasurer(style,options.textMeasurement),textDirection);
    const alignment=explicitAlignment??alignmentFor(field);
    const richLayout=rich?richTextLayouter(value,box,size,richOptions(style),minimum):undefined;
    const measure=textWidthMeasurer(style,options.textMeasurement),floor=snapFontSizeUp(rich?richMinimum(value,size,minimum):minimum),start=Math.max(size,floor);
    // The nominal heading/body range fits within 64 reference-pixel steps; the
    // last trial always evaluates the explicit floor even with unusual callers.
    for(let trial=0;trial<=64;trial++) {
      const raw=start-trial*scale,last=trial===64||raw<=floor,fontSize=last?floor:gridFontSize(raw,floor);
      const fit=richLayout?richLayout(fontSize):fitText(text,box,fontSize,fontSize,measure,textDirection);
      const richLines='richLines' in fit?(fit as RichTextFit).richLines:undefined;
      const lines:TextLineInk[]=richLines?richLines.map(line=>{
        let outline:LayoutBox|null=null;
        for(const fragment of line.fragments) {
          if(fragment.kind==='tab')continue;
          const bounds=measureTextOutline(fragment.text,fragment.fontSize,fragment.style,options.textMeasurement);
          if(!bounds)continue;
          const next={...bounds,x:fragment.x+bounds.x,y:fragment.baselineShift+bounds.y};
          if(!outline)outline=next;else{const right=Math.max(outline.x+outline.width,next.x+next.width),bottom=Math.max(outline.y+outline.height,next.y+next.height);outline.x=Math.min(outline.x,next.x);outline.y=Math.min(outline.y,next.y);outline.width=right-outline.x;outline.height=bottom-outline.y;}
        }
        return {width:line.width,y:line.y,baseline:line.baseline,height:line.height,outline};
      }):(fit as SourceTextFit).sourceLines.map((line,index)=>{
        let outline:LayoutBox|null=null;
        for(const segment of line.segments) {
          if(segment.kind==='tab')continue;
          const bounds=measureTextOutline(text.slice(segment.start,segment.end),fontSize,style,options.textMeasurement);
          if(!bounds)continue;
          const next={...bounds,x:segment.x+bounds.x};
          if(!outline)outline=next;else{const right=Math.max(outline.x+outline.width,next.x+next.width),bottom=Math.max(outline.y+outline.height,next.y+next.height);outline.x=Math.min(outline.x,next.x);outline.y=Math.min(outline.y,next.y);outline.width=right-outline.x;outline.height=bottom-outline.y;}
        }
        return {width:line.width,y:index*fit.lineHeight,baseline:fontSize+index*fit.lineHeight,height:fit.lineHeight,outline};
      });
      const placement=placeTextLines(lines,box,alignment,rasterPadding,fit.directions),result={...fit,placement,overflow:fit.overflow||placement.overflow};
      if(!result.overflow||last)return result;
    }
    throw new Error('Text placement did not evaluate its bounded floor trial.');
  };
  // A numbered list (`numbering` on the payload) draws numbers, never the picture bullet.
  const fitContent = (field:string,value:unknown,text:string,box:LayoutBox,size:number,minimum:number,path:string,numbering?:unknown) => field === 'text'
    ? fitPlacedText(field,value,text,box,size,minimum,path)
    : (field==='items'||field==='bullets') ? fitList(value as ListValue[],box,size,minimum,{...richOptions(styleFor(field,path)),...(numbering!==undefined?{numbering:numbering as NumberingInput}:bulletImage?{bulletImage}:{})})
    : fitText(text,box,size,minimum,widthFor(field,path),field==='code'?undefined:textDirection);
  const path = `slides.${options.slideIndex ?? 0}`;
  // RR-34: captions and footnotes fit through the same placed fitter as body text (outline placement included).
  const annotationFit = (value: RichText, box: LayoutBox, requestedSize: number, minFontSize: number, fitPath: string, alignment: 'left'|'center'|'right') =>
    fitPlacedText('text', value, annotationText(value), box, requestedSize, minFontSize, fitPath, alignment);
  const annotationOptions = { scale, minFontSize: minSize, fit: annotationFit, textStyle: (fitPath: string) => styleFor('text', fitPath) };
  const imageDiagnostics: LayoutDiagnostic[] = [];
  // A right-to-left deck mirrors placements and edge overlays: `left` is the start side, drawn at the right.
  const mirrorSide = (side: string): string => !rtl ? side : side === 'left' ? 'right' : side === 'right' ? 'left' : side;
  const backgroundImage = resolveBackgroundImage(slide, options.presentation, options.themeBackground, width, height, path, mirrorSide, imageDiagnostics);
  const regions = Object.keys(slide).filter(key => regionParts(key)).sort();
  const assets = record(options.presentation).assets;
  const imageContext = (placement?: ComposedPlacement) => ({ fit: hints.imageFit, scale, mirrorSide, diagnostics: imageDiagnostics, assets, ...(placement ? { placement } : {}) });
  // FA-22 placement. The top-level image nodes are the image blocks of `blocks` (not groups) or the root image; promoted
  // regions have none. The n-th takes its own placement, else the n-th layout image placeholder's (FA-26: image regions are
  // counted in reading order through placeholder groups, and only a top-level one carries a placement). Each band takes its
  // share of the slide along its axis and the free area across it, in block order, at most one per edge (a second
  // block on a used edge flows). Headings and the body compose in the free area that remains.
  const area = { left: 0, top: 0, right: width, bottom: height };
  const imagePlaceholders = layoutLeaves(layout).flatMap(leaf => leaf.type === 'image' ? [{ placeholder: leaf.placeholder, path: leaf.path, depth: leaf.depth }] : []);
  const topImages: { host: Record<string, any>; hostPath: string; block?: number }[] = regions.length ? []
    : Array.isArray(slide.blocks) ? slide.blocks.flatMap((block: unknown, index: number) => !Array.isArray(record(block).blocks) && record(block).image !== undefined ? [{ host: record(block), hostPath: `${path}.blocks.${index}`, block: index }] : [])
    : slide.image !== undefined ? [{ host: { type: 'image', image: slide.image }, hostPath: path }] : [];
  type Placed = { host: Record<string, any>; hostPath: string; block?: number; placement: ComposedPlacement; region: LayoutBox; slot: number };
  const placed: Placed[] = [], usedEdges = new Set<string>();
  topImages.forEach((node, order) => {
    const slot = imagePlaceholders[order];
    const own = node.block !== undefined && node.host.placement !== undefined ? record(node.host.placement) : undefined;
    const value = own ?? (slot?.depth === 0 && slot.placeholder.placement !== undefined ? record(slot.placeholder.placement) : undefined);
    if (!value || !(IMAGE_EDGES as readonly unknown[]).includes(value.edge)) return;
    const edge = mirrorSide(value.edge) as ImageEdge;
    if (usedEdges.has(edge)) return;
    usedEdges.add(edge);
    const size = finite(value.size, 0.1, 0.9) ?? PLACEMENT_BAND;
    const across = edge === 'left' || edge === 'right' ? area.right - area.left : area.bottom - area.top;
    const band = Math.max(0, Math.min(across, round((edge === 'left' || edge === 'right' ? width : height) * size)));
    const region: LayoutBox = edge === 'left' ? { x: area.left, y: area.top, width: band, height: area.bottom - area.top }
      : edge === 'right' ? { x: round(area.right - band), y: area.top, width: band, height: area.bottom - area.top }
      : edge === 'top' ? { x: area.left, y: area.top, width: area.right - area.left, height: band }
      : { x: area.left, y: round(area.bottom - band), width: area.right - area.left, height: band };
    if (edge === 'left') area.left += band; else if (edge === 'right') area.right = region.x; else if (edge === 'top') area.top += band; else area.bottom = region.y;
    const placement: ComposedPlacement = { edge, size, inset: value.inset === true, path: own ? `${node.hostPath}.placement` : `${slot!.path}.placement` };
    placed.push({ ...node, placement, region, slot: order });
  });
  const placedBlocks = new Set(placed.flatMap(entry => entry.block !== undefined ? [entry.block] : []));
  const placedRoot = placed.some(entry => entry.block === undefined);
  const items: ComposedItem[] = [], diagnostics: LayoutDiagnostic[] = [];
  const measuredFurniture=layoutFurniture(slide,options);
  const furniture=measuredFurniture.configured||measuredFurniture.diagnostics.length?measuredFurniture:undefined;
  if(furniture)diagnostics.push(...furniture.diagnostics);
  let bodyBottom=Math.min(area.bottom-padding,furniture&&furniture.footerTop<height?furniture.footerTop-gap*.5:height-padding);
  const headingTop = Math.max(area.top+padding,furniture?.headerBottom?furniture.headerBottom+gap*.5:padding);
  // RR-34: the footnote area sits directly above the footer band (or the bottom padding) and takes its
  // height from the content area, honouring the same side margins. Slides without markers skip this.
  let footnotes: ComposedFootnotes | undefined;
  if (citations) {
    footnotes = layoutFootnotes(citations, { ...annotationOptions, x: area.left + padding, width: area.right - area.left - padding * 2, bottom: bodyBottom, maxHeight: Math.max(minSize * 1.22 + 2 * scale, (bodyBottom - headingTop) * FOOTNOTE_MAX_RATIO), path });
    diagnostics.push(...footnotes.diagnostics);
    bodyBottom = footnotes.box.y - gap * .5;
  }
  // Cover detection reads the layout's raw placeholders and the slide payload only, so it is
  // independent of the picture-slot removal applied to the content placeholders below.
  const layoutPlaceholders: {type?: string}[] = Array.isArray(layout.placeholders) ? layout.placeholders : [];
  // The cover rule is a record rule, never a list of ids: a layout whose placeholders are all headings (title,
  // subtitle, tag) or placed images (an image placeholder with a placement takes no flow space) is a heading-only
  // layout, and a slide without a layout record has no placeholders at all.
  const hasLayoutRecord = options.layout !== undefined && options.layout !== null && typeof options.layout === "object";
  const headingOnlyLayout = layoutPlaceholders.length > 0
    && layoutPlaceholders.every(placeholder => headings.has(placeholder.type ?? "") || (placeholder.type === "image" && typeof (placeholder as {placement?: unknown}).placement === "object" && (placeholder as {placement?: unknown}).placement !== null));
  // Empty payloads (`blocks: []`, `text: ""`, empty lists, regions with nothing in them) draw nothing, so they are not body.
  // Whitespace-only text stays body: callers that infer a layout from it (the renderer picks a text layout) must agree with callers that do not (the editor).
  const emptyPayload = (value: unknown) => value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
  const emptyHost = (host: Record<string, any>) => emptyPayload(host.blocks) && fields.every(field => emptyPayload(host[field]));
  // Placed images are not body: a slide whose only body is placed images centers its headings in the free area like a cover.
  const flowBlocks = Array.isArray(slide.blocks) ? slide.blocks.filter((_: unknown, index: number) => !placedBlocks.has(index)) : slide.blocks;
  const hasBodyPayload = regions.some(key => !emptyHost(record(slide[key]))) || !emptyPayload(flowBlocks) || fields.some(field => !(placedRoot && field === 'image') && !emptyPayload(slide[field]));
  const isCover = !hasBodyPayload && (headingOnlyLayout || !hasLayoutRecord);
  coverGroup = isCover;
  // Cover and section slides draw the lockup logo at the top-left of the free area, below any header
  // furniture; the heading group then centers in the remaining span. Content slides never get one.
  let logo: ComposedLogo | undefined;
  if (isCover) {
    const resolved = resolveLogo(options.presentation, slide, { slot: 'lockup', onDark: options.darkBackground, slideIndex: options.slideIndex });
    if (resolved) {
      const logoHeight = 56 * scale;
      const logoWidth = Math.max(scale, Math.min(4 * logoHeight, area.right - area.left - 2 * padding));
      const box = { x: round(rtl ? area.right - padding - logoWidth : area.left + padding), y: round(headingTop), width: round(logoWidth), height: round(logoHeight) };
      logo = { box, slot: 'lockup', path: resolved.path, source: resolved.source, variant: resolved.variant, anchor: rtl ? 'right' : 'left' };
    }
  }
  let y = logo ? logo.box.y + logo.box.height + gap : headingTop;
  const headingItems: ComposedItem[] = [];
  for (const field of ["tag", "title", "subtitle"]) {
    if (!slide[field] || (Array.isArray(slide[field]) && !annotationText(slide[field]))) continue;
    const requested = (field === "title" ? 54 : field === "tag" ? 16 : 25) * scale;
    const maxHeight = Math.max(height * (field === "title" ? 0.26 : field === "subtitle" ? 0.12 : 0.045),minSize*1.22+2*rasterPadding);
    const box = { x: area.left + padding, y, width: area.right - area.left - padding * 2, height: maxHeight };
    // A TextRun[] heading wraps and fits like rich body text (richTextLayouter); a string keeps the plain fitter.
    const text = fitPlacedText(field,slide[field],annotationText(slide[field]),box,requested,minSize,`${path}.${field}`);
    box.height = Math.min(maxHeight, Math.max('richLines' in text ? (text as RichTextFit).height : text.lines.length * text.lineHeight,text.placement?.height??0));
    if(furniture&&box.y+box.height>bodyBottom+.01)diagnostics.push({code:'text-overflow',path:`${path}.${field}`,message:'Repeated furniture leaves too little room for this heading. Change the header/footer or slide design.'});
    const item: ComposedItem = { path: `${path}.${field}`, field, type: "text", value: slide[field], payload: { text: slide[field] }, box, text, textStyle: styleFor(field,`${path}.${field}`), composition, alignment: alignmentFor(field) };
    headingItems.push(item);
    items.push(item);
    y += box.height + gap * 0.5;
  }
  if (headingItems.length) {
    if (isCover) {
      // Center the tag/title/subtitle group between the image-safe top (or header furniture)
      // and the bottom (or footer furniture); a group taller than that span is not moved.
      const last = headingItems[headingItems.length - 1]!;
      const shift = Math.max(0, (bodyBottom - (last.box.y + last.box.height)) / 2);
      if (shift) for (const item of headingItems) {
        item.box.y += shift;
        if (item.text) item.text = translateTextFit(item.text, shift);
      }
      y = last.box.y + last.box.height + gap;
    } else y += gap * 0.5;
  }
  // Placed images follow the headings and precede the flowed body. A caption sits inside the band (inside the slide
  // padding for an inset placement), and the frame takes the rest of it.
  for (const entry of placed) {
    const { host, hostPath, region, placement } = entry;
    let frameArea: LayoutBox = placement.inset ? { x: region.x + padding, y: region.y + padding, width: Math.max(scale, region.width - 2 * padding), height: Math.max(scale, region.height - 2 * padding) } : { ...region };
    const caption = host.caption !== undefined && entry.block !== undefined ? layoutCaption(host.caption, roundBox(frameArea), `${hostPath}.caption`, annotationOptions) : undefined;
    if (caption) { frameArea = caption.mediaBox; diagnostics.push(...caption.diagnostics); }
    const image = composeImage(host, hostPath, region, frameArea, imageContext(placement));
    const type = host.type ?? 'image';
    items.push({ path: `${hostPath}.image`, field: 'image', type, value: host.image, payload: imagePayload(host), box: { ...region }, image,
      textStyle: styleFor('image', `${hostPath}.image`), composition, alignment: alignmentFor('image'), ...(caption ? { caption } : {}) });
  }
  const contentBox ={ x: area.left + padding, y, width: area.right - area.left - padding * 2, height: Math.max(scale, bodyBottom - y) };
  // A synthetic container (a layout record's placeholder group, or the group design.chartPrimary stands for) holds slide
  // content without an OPF path of its own: it records no group, flow or decision. `reserved` keeps its unfilled regions'
  // cells, `slot` is the record placeholder a node fills and `slots` the placeholders of a record group (FA-26).
  type Pending = { field: string; type: string; value: unknown; path: string; payload: Record<string, unknown>; children?: Pending[]; composition?: Composition; region?: [number[], number[]]; synthetic?: boolean; reserved?: number; slot?: LayoutSlot; slots?: LayoutSlot[]; caption?: unknown; captionPath?: string; host?: Record<string, any>; hostPath?: string };
  const collect = (host: Record<string, any>, basePath: string, depth = 0, ancestors: unknown[] = []): Pending[] => {
    if (Array.isArray(host.blocks)) {
      if (depth >= MAX_COMPOSITION_DEPTH || ancestors.includes(host)) throw new RangeError(`Content groups must be acyclic and nest at most ${MAX_COMPOSITION_DEPTH} levels.`);
      const settings = record(host.composition) as Composition;
      assertComposition(settings);
      return [{ field: "blocks", type: "group", value: host.blocks, path: basePath, payload: host, composition: settings,
        children: host.blocks.flatMap((block: unknown, index: number) => collect(record(block), `${basePath}.blocks.${index}`, depth + 1, [...ancestors, host])) }];
    }
    // RR-34: a caption belongs to the host's one captionable payload (image, chart, table or video).
    const captioned = host.caption !== undefined ? fields.filter(field => host[field] !== undefined && CAPTIONABLE_FIELDS.includes(field)) : [];
    // RR-54: a dataset-backed chart or table is composed from its inline copy (options.presentation holds the datasets).
    const fieldValue = (field: string): unknown => field === 'table' ? inlineTableData(host[field], options.presentation) : field === 'chart' ? inlineChartData(host[field], options.presentation) : host[field];
    return fields.filter(field => host[field] !== undefined).map(field => ({ field, type: host.type ?? kind(field), value: fieldValue(field), path: `${basePath}.${field}`, payload: field === 'image' ? imagePayload(host) : { type: host.type ?? kind(field), [field]: fieldValue(field), ...(host.numbering !== undefined && (field === 'items' || field === 'bullets') ? { numbering: host.numbering } : {}) },
      ...(field === 'image' ? { host, hostPath: basePath } : {}),
      ...(captioned.length === 1 && captioned[0] === field ? { caption: host.caption, captionPath: `${basePath}.caption` } : {}) }));
  };
  // Valid documents choose exactly one of regions, blocks, or root payloads.
  // Promoted regions are composed in visual reading order (rows top to bottom, then along the row), not in key order,
  // so the composed item order, the SVG draw order, the PPTX shape order and the accessibility reading order agree.
  // The order comes from the logical region cells before any mirroring, so a right-to-left deck (which draws `left`
  // at the right and reads from the right) keeps the same logical order.
  const regionsInReadingOrder = visualReadingOrder(regions.map(key => ({ key, box: regionBox(regionParts(key)!, contentBox, gap) }))).map(entry => entry.key);
  const pending: Pending[] = regions.length
    ? regionsInReadingOrder.flatMap(key => collect(record(slide[key]), `${path}.${key}`).map(item => ({ ...item, region: regionParts(key) })))
    : Array.isArray(slide.blocks) ? slide.blocks.flatMap((block: unknown, index: number) => placedBlocks.has(index) ? [] : collect(record(block), `${path}.blocks.${index}`))
    : collect(placedRoot ? { ...slide, image: undefined } : slide, path);
  const groups: ComposedGroup[] = [], flows: ComposedFlow[] = [];
  const decisions: CompositionDecision[] | undefined = options.explain ? [] : undefined;
  const inheritedSettings = (parent: Composition, own: Composition = {}): Composition => ({
    minFontSize: parent.minFontSize,
    ...own,
    overflow: parent.overflow === "error" ? "error" : own.overflow ?? parent.overflow,
  });
  const inset = (box: LayoutBox, settings: Composition): LayoutBox => {
    const amount = (settings.padding ?? 0) * Math.min(box.width, box.height);
    return { x: box.x + amount, y: box.y + amount, width: box.width - amount * 2, height: box.height - amount * 2 };
  };
  const acceptedBox = (box: LayoutBox): LayoutBox => ({x:round(box.x),y:round(box.y),width:round(box.width),height:round(box.height)});
  // Keep the allocation/explicit region intact. All scoring and final measurement
  // use the same rounded interior, including strict overflow and pagination.
  const payloadBox = (box: LayoutBox): LayoutBox => {
    if (!hasCards) return box;
    const frame = acceptedBox(box), padding = Math.min(12 * scale, frame.width / 4, frame.height / 4);
    return acceptedBox({x:frame.x+padding,y:frame.y+padding,width:frame.width-2*padding,height:frame.height-2*padding});
  };
  const measureQuote = (node: Pending, box: LayoutBox, settings: Composition) => layoutQuote(node.value as string | QuoteContent, acceptedBox(box), {
    fontFamilies:options.fontFamilies,textMeasurement:options.textMeasurement,scale,minFontSize:settings.minFontSize,path:node.path,direction:textDirection,
    ...(citationMarker?{citationMarker}:{}),
  });
  const measureCode = (node: Pending, box: LayoutBox, settings: Composition) => layoutCode(node.value as string | CodeContent, acceptedBox(box), {
    fontFamilies:options.fontFamilies,textMeasurement:options.textMeasurement,scale,minFontSize:settings.minFontSize,path:node.path,
  });
  const measureMetric = (node: Pending, box: LayoutBox, settings: Composition) => layoutMetric(node.value as string | number | MetricContent, acceptedBox(box), {
    fontFamilies:options.fontFamilies,textMeasurement:options.textMeasurement,scale,minFontSize:settings.minFontSize,path:node.path,
    textRasterPadding:options.textRasterPadding,
    align:alignmentFor('metric'),direction:textDirection,
  });
  const measureTimeline = (node: Pending, box: LayoutBox, settings: Composition) => layoutTimeline(node.value as TimelineContent, acceptedBox(box), {
    fontFamilies:options.fontFamilies,textMeasurement:options.textMeasurement,scale,minFontSize:settings.minFontSize,path:node.path,textRasterPadding:options.textRasterPadding,direction:textDirection,
  });
  // RR-34: a captioned leaf is scored and placed on the media box that remains after its caption band.
  const captionOf = (node: Pending, box: LayoutBox) => node.caption !== undefined && node.captionPath ? layoutCaption(node.caption, box, node.captionPath, annotationOptions) : undefined;
  const leafScore = (node: Pending, box: LayoutBox, settings: Composition, penalties?: CompositionPenalties): number => {
    box = payloadBox(box);
    const captioned = captionOf(node, box);
    if (captioned) box = captioned.mediaBox;
    const text = contentText(node.field, node.value);
    let score = Math.abs(Math.log(box.width / box.height / 1.6)) + (captioned?.overflow ? 1000 : 0);
    if (penalties) { penalties.cellProportions += Math.abs(Math.log(box.width / box.height / 1.6)); if (captioned?.overflow) penalties.textOverflow += 1000; }
    if (node.field === 'quote' || node.field === 'code' || node.field === 'metric' || node.field === 'timeline') {
      const internal = node.field === 'quote' ? measureQuote(node,box,settings) : node.field === 'code' ? measureCode(node,box,settings) : node.field === 'metric' ? measureMetric(node,box,settings) : measureTimeline(node,box,settings);
      const reduction = internal.parts.reduce((sum,part)=>sum+(part.fit ? (part.requestedFontSize-part.fit.fontSize)/scale : 0),0);
      score += reduction + (internal.overflow ? 1000 : 0);
      if (penalties) { penalties.fontReduction += reduction; penalties.textOverflow += internal.overflow ? 1000 : 0; }
    } else if (text) {
      const fit = fitContent(node.field,node.value,text,box,25*scale,snapFontSizeUp((settings.minFontSize??16)*scale),node.path,node.payload.numbering);
      const reduction = Math.max(0,snapFontSizeDown(25 * scale) - fit.fontSize) / scale;
      score += reduction + (fit.overflow ? 1000 : 0);
      if (penalties) { penalties.fontReduction += reduction; penalties.textOverflow += fit.overflow ? 1000 : 0; }
    }
    if (node.field === "table" && tableOverflows(node.value, box, scale, settings, options, node.path)) {
      score += 1000;
      if (penalties) penalties.tableOverflow += 1000;
    }
    if (box.width < 100 * scale || box.height < 60 * scale) {
      score += 100;
      if (penalties) penalties.smallCells += 100;
    }
    return score;
  };
  const modeFor = (settings: Composition) => settings.mode ?? "auto";
  const defaultColumns = (count: number, area: LayoutBox, settings: Composition) => {
    const mode = modeFor(settings);
    return mode === "column" ? 1 : mode === "row" ? Math.max(1, count) : settings.columns ?? Math.max(1, Math.min(count, Math.ceil(Math.sqrt(count * area.width / area.height / 1.6))));
  };
  // Candidate scoring walks descendants using their explicit tracks or geometric auto
  // seed. Only the selected candidate optimizes child autos. This bounds work by
  // O(nodes * nesting depth * candidate columns), rather than exponential search.
  const scoreNode = (node: Pending, box: LayoutBox, settings: Composition, penalties?: CompositionPenalties): number => {
    if (!node.children) return leafScore(node, box, settings, penalties);
    const own = inheritedSettings(settings, node.composition), area = inset(box, own), slotCount = Math.max(node.children.length, node.reserved ?? 0);
    const cols = defaultColumns(slotCount, area, own);
    const boxes = gridBoxes(slotCount, area, cols, (own.gap ?? 1 / 30) * Math.min(box.width, box.height), own.weights ?? [], modeFor(own) === "column");
    return node.children.reduce((score, child, index) => score + scoreNode(child, boxes[index]!, own, penalties), 0);
  };
  const slots: ComposedSlot[] = [];
  // FA-26: the cells of a record's placeholders that no content fills. A group lays its regions out as if each were
  // reserved, so an editor can show every empty slot; a region beyond the cells its container reserves has no box.
  const emptySlots = (entries: LayoutSlot[], boxes: LayoutBox[], settings: Composition) => entries.forEach((entry, index) => {
    const box = boxes[index];
    if (!box) return;
    slots.push({ path: entry.path, type: entry.type, depth: entry.depth, box: acceptedBox(box) });
    if (!entry.children) return;
    const own = inheritedSettings(settings, record(entry.placeholder.composition) as Composition), inner = inset(box, own);
    const cols = defaultColumns(entry.children.length, inner, own);
    const mirror = (cell: LayoutBox): LayoutBox => rtl ? { ...cell, x: inner.x + inner.width - (cell.x - inner.x) - cell.width } : cell;
    emptySlots(entry.children, gridBoxes(entry.children.length, inner, cols, (own.gap ?? 1 / 30) * Math.min(box.width, box.height), own.weights ?? [], modeFor(own) === 'column').map(mirror), own);
  });
  const arrange = (nodes: Pending[], area: LayoutBox, settings: Composition, reserved = 0, gapOverride?: number, containerPath = path, recorded = true, template?: LayoutSlot[]): void => {
    const count = Math.max(nodes.length, reserved);
    if (!count) return;
    const mode = modeFor(settings), localGap = (settings.gap ?? 1 / 30) * Math.min(area.width, area.height);
    // Root gap retains the canvas-based contract; group gaps use their container.
    const actualGap = gapOverride ?? (settings === rootSettings ? gap : localGap);
    let cols = defaultColumns(count, area, settings);
    const hasRegions = nodes.some(node => node.region);
    const candidates: CompositionCandidate[] | undefined = decisions && recorded ? [] : undefined;
    if (mode === "auto" && !hasRegions) {
      let best = Infinity;
      for (let candidate = 1; candidate <= Math.min(count, settings.columns ?? 6); candidate++) {
        const boxes = gridBoxes(count, area, candidate, actualGap, settings.weights ?? [], false);
        const emptySlots = (Math.ceil(count / candidate) * candidate - count) * 2;
        const penalties: CompositionPenalties | undefined = candidates ? {cellProportions:0,fontReduction:0,textOverflow:0,tableOverflow:0,smallCells:0,emptySlots} : undefined;
        const score = nodes.reduce((sum, node, i) => sum + scoreNode(node, boxes[i]!, settings, penalties), 0) + emptySlots;
        if (penalties && candidates) candidates.push({columns:candidate,rows:Math.ceil(count/candidate),score,penalties});
        if (score < best) { best = score; cols = candidate; }
      }
    }
    if (recorded) decisions?.push({path:containerPath,mode:hasRegions?'regions':mode,
      reason:hasRegions?'promoted-regions':settings === rootSettings && chartPrimary ? 'chart-primary' : mode==='auto'?'lowest-score':'configured-mode',
      ...(hasRegions?{}:{selectedColumns:cols}),candidates:candidates ?? []});
    const grid = gridGeometry(count, area, cols, actualGap, settings.weights ?? [], mode === "column");
    // Right to left: the first column and the `left` region sit at the right of their container (RR-05). Track sizes,
    // weights and the scoring above are unchanged; only each box moves to its mirrored place within the container.
    const mirrored = (box: LayoutBox): LayoutBox => rtl ? { ...box, x: area.x + area.width - (box.x - area.x) - box.width } : box;
    const boxes = grid.boxes.map(mirrored);
    if (template) emptySlots(template.slice(nodes.length), boxes.slice(nodes.length), settings);
    if (recorded && !hasRegions) flows.push({path: containerPath, box: {...area}, composition: {...settings}, columns: rtl ? grid.columns.map(track => ({offset: area.width - track.offset - track.size, size: track.size})) : grid.columns, rows: grid.rows, gap: grid.gap, itemCount: nodes.length, slotCount: count});
    nodes.forEach((node, index) => {
      let box = node.region ? mirrored(regionBox(node.region, area, actualGap)) : boxes[index]!;
      if (node.slot) slots.push({ path: node.slot.path, type: node.slot.type, depth: node.slot.depth, box: acceptedBox(box), ...(node.slot.children ? {} : { content: node.path }) });
      if (node.children) {
        const own = inheritedSettings(settings, node.composition), inner = inset(box, own);
        if (!node.synthetic) groups.push({ path: node.path, box, contentBox: inner, composition: own });
        arrange(node.children, inner, own, node.reserved ?? 0, (own.gap ?? 1 / 30) * Math.min(box.width, box.height), node.path, !node.synthetic, node.slots);
      } else {
        const frameBox = hasCards ? acceptedBox(box) : undefined;
        box = payloadBox(box);
        const caption = captionOf(node, box);
        if (caption) { box = caption.mediaBox; diagnostics.push(...caption.diagnostics); }
        const textValue = contentText(node.field, node.value);
        const quoteLayout = node.field === 'quote' ? measureQuote(node,box,settings) : undefined;
        const codeLayout = node.field === 'code' ? measureCode(node,box,settings) : undefined;
        const metricLayout = node.field === 'metric' ? measureMetric(node,box,settings) : undefined;
        const timelineLayout = node.field === 'timeline' ? measureTimeline(node,box,settings) : undefined;
        const internal = quoteLayout ?? codeLayout ?? metricLayout ?? timelineLayout, body = internal?.parts.find(part=>part.role==='body'||part.role==='value');
        const text = internal ? body?.fit : textValue !== undefined ? fitContent(node.field,node.value,textValue,box,25*scale,snapFontSizeUp((settings.minFontSize??16)*scale),node.path,node.payload.numbering) : undefined;
        const image = node.field === 'image' ? composeImage(node.host ?? {}, node.hostPath ?? node.path, box, box, imageContext()) : undefined;
        items.push({ path: node.path, field: node.field, type: node.type, value: node.value, payload: node.payload, box:internal?acceptedBox(box):box, ...(image ? {image} : {}),
          ...(frameBox ? {frameBox} : {}),
          text, textStyle: body?.style ?? styleFor(node.field,node.path), composition: settings, alignment: alignmentFor(node.field), ...(quoteLayout?{quoteLayout}:{}), ...(codeLayout?{codeLayout}:{}), ...(metricLayout?{metricLayout}:{}), ...(timelineLayout?{timelineLayout}:{}),
          ...(bulletImage && node.payload.numbering === undefined && (node.field === 'items' || node.field === 'bullets') ? {bulletImage} : {}), ...(caption ? {caption} : {}) });
        if (box.width < 100 * scale || box.height < 60 * scale) diagnostics.push({ code: "small-cell", path: node.path, message: "Content cell is too small for comfortable reading; use fewer blocks or a different composition." });
      }
    });
  };
  const placeholders = Array.isArray(layout.placeholders) ? layout.placeholders.filter((p: any) => !headings.has(p.type)) : [];
  // A placed image no longer needs its content slot: the image placeholder it corresponds to is not reserved in the flow.
  const placedSlots = new Set(placed.flatMap(entry => imagePlaceholders[entry.slot] ? [imagePlaceholders[entry.slot]!.placeholder] : []));
  if (placedSlots.size) for (let index = placeholders.length - 1; index >= 0; index--) if (placedSlots.has(placeholders[index])) placeholders.splice(index, 1);
  // Root arrangement mode: the explicit composition.mode (the slide's own, else the layout record's
  // geometry contract), then the effective design.contentDirection (slide, then deck, then the layout record's
  // own), then auto. The hint ranks with the layout's own direction, so it never flattens a layout's own grid.
  const ownMode = record(slide.composition).mode as Composition['mode'] | undefined;
  const direction = hints.contentDirection;
  const directionMode: Composition['mode'] = direction === 'vertical' ? 'column' : direction === 'horizontal' ? 'row' : 'auto';
  // The effective design.chartPrimary (slide, deck, then the layout's own) splits the root into a
  // primary chart track and one synthetic container of the other nodes when the slide has no regions
  // and no composition.mode of its own, and the root nodes mix at least one chart leaf with other nodes.
  // Unlike contentDirection it is an author opt-in, so it overrides the layout record's composition, including its
  // columns, weights and placeholder groups. It is sugar for a placeholder group (FA-26): chartPrimaryLayout() states the
  // record it stands for, and the slide composes through that record's group like any other.
  const chartHint = hints.chartPrimary;
  const chartSide = chartHint === 'left' || chartHint === 'right' || chartHint === 'top' || chartHint === 'bottom' ? chartHint : undefined;
  const chartIndex = pending.findIndex(node => !node.children && node.field === 'chart');
  const chartPrimary = chartSide !== undefined && !ownMode && !regions.length && chartIndex >= 0 && pending.some(node => node.children || node.field !== 'chart') ? chartSide : undefined;
  const kindOf = (node: Pending): string => node.children ? (node.children[0] ? kindOf(node.children[0]) : 'text') : FIELD_KINDS[node.field] ?? 'text';
  const sugar = chartPrimary ? chartPrimaryLayout(chartPrimary, pending.filter((_, index) => index !== chartIndex).map(kindOf)) : undefined;
  const rootSettings: Composition = sugar
    ? { ...composition, ...sugar.composition, columns: undefined }
    : { ...composition, mode: composition.mode ?? directionMode };
  // FA-26: a record's placeholder groups. Slide content stays flat: its root nodes fill the record's leaf regions in reading
  // order (depth first), each group arranges the content that fills it by its own composition, and content beyond the
  // last leaf flows at the root. Promoted regions keep their positions, and a slide that brings its own content groups
  // keeps its own structure (the record's root composition still applies). A group keeps the cells of its unfilled regions
  // unless its composition sets a mode, as the root does with the record's top-level placeholders.
  const recordSlots = sugar ? [] : layoutSlots(layout).filter(slot => !headings.has(slot.type) && !placedSlots.has(slot.placeholder));
  const templated = !sugar && !regions.length && recordSlots.some(slot => slot.children) && pending.every(node => !node.children);
  const fillSlots = (entries: LayoutSlot[], queue: Pending[], cursor: { next: number }, recordSlot: boolean): Pending[] => {
    const nodes: Pending[] = [];
    for (const entry of entries) {
      if (cursor.next >= queue.length) break;
      if (!entry.children) { nodes.push({ ...queue[cursor.next++]!, ...(recordSlot ? { slot: entry } : {}) }); continue; }
      const own = record(entry.placeholder.composition) as Composition;
      assertComposition(own);
      const children = fillSlots(entry.children, queue, cursor, recordSlot);
      nodes.push({ field: 'blocks', type: 'group', value: children.map(child => child.payload), path, payload: {}, children, composition: own, synthetic: true,
        reserved: own.mode ? 0 : entry.children.length, ...(recordSlot ? { slot: entry, slots: entry.children } : {}) });
    }
    return nodes;
  };
  if (sugar) {
    const primary = pending[chartIndex]!, rest = pending.filter((_, index) => index !== chartIndex);
    const queue = chartPrimary === 'left' || chartPrimary === 'top' ? [primary, ...rest] : [...rest, primary];
    arrange(fillSlots(layoutSlots(sugar, 'design.chartPrimary'), queue, { next: 0 }, false), contentBox, rootSettings, 0);
  } else if (templated) {
    const cursor = { next: 0 };
    const nodes = fillSlots(recordSlots, pending, cursor, true);
    arrange([...nodes, ...pending.slice(cursor.next)], contentBox, rootSettings, composition.mode ? 0 : placeholders.length, undefined, path, true, recordSlots);
    // Slots are listed in the record's reading order (depth first), whatever order the cells were laid out in.
    const order = new Map<string, number>();
    const number = (entries: LayoutSlot[]): void => entries.forEach(entry => { order.set(entry.path, order.size); if (entry.children) number(entry.children); });
    number(recordSlots);
    slots.sort((a, b) => order.get(a.path)! - order.get(b.path)!);
  } else arrange(pending, contentBox, rootSettings, composition.mode ? 0 : placeholders.length);
  if (listBullet?.value === 'image' && !bulletImage && items.some(item => (item.field === 'items' || item.field === 'bullets') && item.payload.numbering === undefined)) {
    diagnostics.push({ code: 'unresolved-content', path: listBullet.path, message: 'Picture bullets (listBullet: image) need design.logo or a primary organization logo; the marker glyph is drawn instead.' });
  }

  // Notices that never fail a strict composition: the drawn number is still the one PowerPoint draws.
  const numberingDiagnostics: LayoutDiagnostic[] = [];
  for (const item of items) {
    for (const key of ["x", "y", "width", "height"] as const) item.box[key] = round(item.box[key]);
    if (item.field === "table" && tableOverflows(item.value,item.box,scale,item.composition,options,item.path)) diagnostics.push({ code: "text-overflow", path: item.path, message: "Table cells do not fit; use fewer rows, fewer columns, or split the table across slides." });
    if (item.quoteLayout) diagnostics.push(...item.quoteLayout.diagnostics);
    else if (item.codeLayout) diagnostics.push(...item.codeLayout.diagnostics);
    else if (item.metricLayout) diagnostics.push(...item.metricLayout.diagnostics);
    else if (item.timelineLayout) diagnostics.push(...item.timelineLayout.diagnostics);
    else if (item.text?.overflow) diagnostics.push({ code: "text-overflow", path: item.path, message: "Text exceeds its cell at the minimum font size; shorten it, increase its space, or split the slide." });
    for (const entry of (item.text as ListFit | undefined)?.listEntries ?? []) {
      if (entry.marker.number?.adapted) numberingDiagnostics.push({ code: "numbering-adapted", path: entry.textPath ?? item.path, message: `Roman numerals stop at 3999; this entry is numbered ${entry.marker.number.value} in arabic, as PowerPoint draws it.` });
    }
  }
  for (const group of groups) for (const box of [group.box, group.contentBox]) for (const key of ["x", "y", "width", "height"] as const) box[key] = round(box[key]);
  const strictPaths = new Set(items.filter(item => item.composition.overflow === "error").map(item => item.path));
  const failures = diagnostics.filter(diagnostic => {
    if(composition.overflow==='error')return true;
    let path = diagnostic.path;
    while (path) {
      if (strictPaths.has(path)) return true;
      const boundary = path.lastIndexOf('.');
      if (boundary < 0) break;
      path = path.slice(0,boundary);
    }
    return false;
  });
  const explanation: CompositionExplanation | undefined = decisions ? {
    algorithm:'grid-score-v9',textMeasurement:options.textMeasurement?'provided':'estimated',textOutlines:options.textMeasurement?.outlineBounds?'provided':'unavailable',textRasterPadding:rasterPadding,decisions,
    unmeasuredPayloads:items.filter(item=>!headings.has(item.field)&&!item.quoteLayout&&!item.codeLayout&&!item.metricLayout&&!item.timelineLayout&&!['text','items','bullets','table'].includes(item.field)).map(item=>item.path),
  } : undefined;
  if (failures.length) throw new OPFCompositionError(failures, explanation);
  diagnostics.push(...imageDiagnostics, ...numberingDiagnostics);
  for (const slot of slots) for (const key of ["x", "y", "width", "height"] as const) slot.box[key] = round(slot.box[key]);
  return { width, height, contentBox, items, groups, flows, ...(slots.length ? { slots } : {}), diagnostics, composition, design: hints, ...(furniture?{furniture}:{}), ...(backgroundImage?{backgroundImage}:{}), ...(logo?{logo}:{}), ...(rtl?{direction:'rtl' as const}:{}), ...(footnotes?{footnotes}:{}), ...(explanation?{explanation}:{}) };
}

/** Canonical physical slide size, converted to reference pixels at 96 pixels/inch. */
export function resolveCanvasDimensions(input: unknown): { width: number; height: number } {
  const presets: Record<string, [number, number]> = {
    widescreen: [40 / 3, 7.5], '16:9': [40 / 3, 7.5], standard: [10, 7.5],
    '4:3': [10, 7.5], '16:10': [10, 6.25], '1:1': [7.5, 7.5], '4:5': [7.5, 9.375], '9:16': [7.5, 40 / 3], letter: [11, 8.5], a4: [11.69, 8.27],
  };
  const value = record(input);
  const preset = presets[typeof input === 'string' ? input : value.preset] ?? presets.widescreen!;
  const width = (value.widthInches ?? preset[0]) * 96;
  const height = (value.heightInches ?? preset[1]) * 96;
  if (![width, height].every(n => Number.isFinite(n) && n > 0)) throw new RangeError('Canvas dimensions must be finite and positive.');
  return { width, height };
}
export {chartOptionSupport,chartOptionTarget,resolveChartOptions,chartHighlightMarks,formatChartLabelNumber,formatChartLabelPercent,chartLabelText,DEFAULT_CHART_LABEL_SEPARATOR} from './chart-options.js';
export type {ChartOptionKind,ChartOptionTarget,ChartOptionSupport,ChartOptionDiagnostic,ChartLegendPosition,ChartLabelContent,ChartLabelPosition,ResolvedChartDataLabels,ResolvedChartHighlight,ChartHighlightMarks,ResolvedChartOptions} from './chart-options.js';
// RR-54: chart and table data resolution, for engines that import the composition entry.
export {chartNumber,formatDataNumber,numberFormatError,toExcelNumberFormat,fromExcelNumberFormat,inlineDatasets,inlineTableData,inlineChartData,isDatasetRef,isXYChartType,resolveChartData,resolveTableData,tableCellDisplayValue} from './chart-data.js';
export type {DataCellValue,DataColumn,DataSourceRef,Dataset,DatasetRef,ChartMapping,ChartComboSeries,DataTableCell,DataTableHeader,DataDiagnostic,ResolvedChartData,ResolvedTableData} from './chart-data.js';

export { resolveDesignHints, DESIGN_HINT_KEYS, type DesignHints, type DesignHintKey, type DesignHintSource, type ResolvedDesignHints, type ResolveDesignHintsOptions } from './design-hints.js';
export { layoutContent, layoutLeaves, layoutSlots, layoutStructure, hasPlaceholderGroups, isPlaceholderGroup, LAYOUT_BODY_KINDS, MAX_PLACEHOLDER_GROUP_DEPTH, type LayoutContent, type LayoutBodyKind, type LayoutLeaf, type LayoutSlot } from './layout-content.js';
