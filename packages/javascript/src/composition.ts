import {tableGrid,type TableCellStyle} from './table.js';
import {inlineChartData,inlineTableData,resolveChartData,resolveTableData,tableCellDisplayValue,tableKeyText,type DataTableCell} from './chart-data.js';
import {chartTextSize,chartValueAxis,shareSiblingChartAxes,type ChartValueAxis} from './chart-axis.js';
import {chartHeader,chartLayer,type ChartLayer} from './chart-layer.js';
import {chartPlotInset,shareSiblingPlots} from './chart-plot.js';
import {alignBarRows,besideEachOther,horizontalBarType,sameKeys,tableRowKeys} from './chart-rows.js';
import {chartEndLabels,chartSliceLabels,refreshEndLabels} from './chart-direct-labels.js';
import {chartSlideFocus,slideFocusSources,tableHighlightRows,tableSlideFocus,type FocusSource} from './chart-focus.js';
import {restackForRows,chartStack,chartTitleReferences,chartValueList,chartWaterfall,placeReferences,refreshChartMarks} from './chart-marks.js';
import {chartDrawPlan} from './chart-fallback.js';
import {intrinsicImageAspect,intrinsicImageSize} from './image-aspect.js';
import {resolveDesignHints,type ResolvedDesignHints} from './design-hints.js';
import {visualReadingOrder} from './reading-order.js';
import {isLayoutTemplate,layoutTemplate,withRegionRules,type LayoutTemplate,type LayoutRegion,type RegionAnchor,type RegionFlow,type RegionKind,type RegionRole} from './layout-template.js';
import {bindRegions,rootNodes,type BoundBlock} from './bind-regions.js';
import {EYEBROW_TEXT_KIND,eyebrowLabel,isLabelText,groupBinding,majorityKind,PAIR_LENGTH_RATIO,repeatedPairs,textLength,type GroupedBinding} from './block-grouping.js';
import {allocateRows,areaRects,collapseAreas,columnWidths,flowCells,flowShape,gridFlowShape,LIST_WHOLE_ENTRIES,listColumnBreaks,listGridShape,shareHeights,type CellRect,type FlowShape,type RowDemand} from './template-geometry.js';
import {METRIC_TREND_ARROW_GAP,METRIC_TREND_ARROW_SIZE,type MetricSentiment} from './metric-trend.js';
export {visualReadingOrder,type ReadingBox} from './reading-order.js';
/** The pixel size and aspect (width / height) of an embedded picture (a data URI, or an `asset:<id>` that names one), the reading composeSlide uses, for engines that place host-resolved pictures. */
export {intrinsicImageAspect,intrinsicImageSize} from './image-aspect.js';
import {paragraphDirection,paragraphDirectionAt,physicalAlignment,type PhysicalAlignment,type TextDirection} from './direction.js';
import {resolveSlideDirection,type ScriptMeasurementProfile} from './script-fonts.js';
import {quoteLanguage,quoteMarksFor,type QuoteMarks} from './quote-marks.js';
import {allowedBreak,proseTokens,proseWords} from './line-break.js';
/** LH-11: where a line may not break (a number and its unit, a closing mark), and the same rule written as no-break spaces for a PowerPoint that wraps the text itself. */
export {bindNoBreak,unbindNoBreak,lineMayStartAt} from './line-break.js';
import {ENGINE_DEFAULT_FONT_SCHEME,SOCIAL_PLATFORMS} from './engine-vocabularies.js';
export {CHART_TYPES,ENGINE_DEFAULT_CHART_TYPES,ENGINE_DEFAULT_COLOR_SCHEME,ENGINE_DEFAULT_FONT_SCHEME,ENGINE_DEFAULT_THEME,LANGUAGES,SOCIAL_PLATFORMS,type LanguageVocabulary,type SocialPlatformVocabulary} from './engine-vocabularies.js';
export {CATALOG_REFERENCE_PATTERN,OPFCatalogsOptionError,OPFUnresolvedReferenceError,catalogGroupSource,catalogKinds,catalogRecords,catalogReferenceSites,parseReference,resolveReference,unresolvedReference,type Catalog,type CatalogKind,type CatalogOptions,type CatalogRecords,type CatalogReferenceSite,type RecordProvenance,type ResolvedReference,type UnresolvedReferenceDiagnostic} from './catalog-refs.js';
export {paragraphDirection,paragraphDirectionAt,physicalAlignment,type PhysicalAlignment,type TextDirection} from './direction.js';
export {isolateNumbers,numberRanges,numericText} from './number-text.js';
import {listNumbers,sliceNumberedItems,type ListNumber,type NumberingInput} from './numbering.js';
export {NUMBERING_STYLES,NUMBERING_SUFFIXES,MAX_NUMBERING_VALUE,MAX_ROMAN_VALUE,MAX_NUMBERING_LEVELS,formatListNumber,listNumbers,resolveNumbering,numberingAtLevel,numberingStyleDraws,sliceNumberedItems,type Numbering,type NumberingInput,type NumberingStyleName,type NumberingSuffix,type ResolvedNumbering,type ListNumber} from './numbering.js';
import {DEFAULT_FURNITURE_DATE_FORMAT,formatFurnitureDate,parseIsoDate,type FurnitureField} from './furniture-fields.js';
import {substituteSlideTokens,usesSlideBuiltin} from './slide-variables.js';
import {parseLogoName,resolveLogo,resolveOrganizationLogo,type LogoShape,type LogoVariant} from './logos.js';
export {LOGO_SHAPES,resolveLogo} from './logos.js';
export type {LogoShape,LogoVariant,ResolvedLogo,ResolveLogoOptions} from './logos.js';
export {DEFAULT_FURNITURE_DATE_FORMAT,formatFurnitureDate,type FurnitureField} from './furniture-fields.js';
export {tableGrid,tableRowBoundaries,type TableCellStyle,type TableBorder,type TableGrid,type TableGridCell,type TableGridIssue} from './table.js';
import {layoutVariantApplies,resolveColorRoles} from './color.js';
import {pictureScrims,type ComposedScrim,type PictureLuminance} from './picture-scrim.js';
export {pictureScrims,luminanceGrid,scrimOpacity,scrimGeometry,sampledGrays,grayOfLuminance,SCRIM_TARGET_CONTRAST,SCRIM_MARGIN,SCRIM_FADE,type ComposedScrim,type PictureLuminance,type ScrimEdge} from './picture-scrim.js';
import {numericText} from './number-text.js';
export {emphasisSurface, EMPHASIS_TEXT_MIN_CONTRAST, EMPHASIS_SURFACE_MIN_CONTRAST} from './color.js';
export type {EmphasisSurface} from './color.js';
export {applyLuminance, clrMapAttributes, colorMapFor, deckBackgroundIsFixed, isColorVariant, isFixedBackground, layoutColorVariant, layoutVariantApplies, normalizeColorVariant, readableSchemeColor, NEUTRAL_SHARES} from './color.js';
export {colorContrast, textColorForFill, chartColorForFill, chartPaletteForFill, chartSchemeSeries, chartSeriesPalette, resolveChartColors, chartHighlightColors, chartEmphasisColors, softenChartPalette, chartSoftColors, applyHslTransforms, type ChartSoftColor, chartSeriesLabelColor, CHART_SERIES_SOFT_MIX, CHART_EMPHASIS_MIN_CONTRAST, CHART_EMPHASIS_MIN_LIGHTNESS_STEP, CHART_SERIES_TINT_MIX, CHART_DARK_SERIES_MIN_CONTRAST, CHART_LEAD_LIGHTNESS_STEP, normalizeHexColor, resolveColorRef, resolveColorRoles, defaultSlideBackground, isDarkColor, surfaceAltColor, tableHighlightColor, TABLE_HIGHLIGHT_MIX, CHART_SERIES_MIN_LIGHTNESS_STEP, CHART_SERIES_MIN_DIFFERENCE, CHART_SERIES_TIER_SIZE, CHART_HIGHLIGHT_MUTED_MIX, CHART_HIGHLIGHT_MUTED_MIN_CONTRAST, DARK_BACKGROUND_LUMINANCE, SURFACE_ALT_MIX, SURFACE_ALT_MIN_CONTRAST, CARD_SURFACE_MIX, CARD_SURFACE_MIN_CONTRAST, CARD_BORDER_MIX, CODE_PANEL_DARK_SHADE} from './color.js';
export type {ChartColorContext, ChartPaletteOptions, ColorAccentSlot, ColorBaseSlot, ColorMap, LayoutVariantDeck, LayoutVariantRole, ColorVariant, ColorVariantBackground, ColorVariantInput, SchemeColor, SchemeNeutrals, ResolveColorRefOptions, ResolveColorRefRoles, ResolveColorRolesOptions, ResolvedColorRoles} from './color.js';
export {resolveScriptFonts, resolveSlideDirection, scriptFontRole} from './script-fonts.js';
export {QUOTE_MARKS, ASCII_QUOTE_MARKS, quoteMarksFor, quoteLanguage, unwrapQuoteMarks, isWrappedInQuoteMarks, type QuoteMarks} from './quote-marks.js';
export type {ResolveScriptFontsOptions, ResolvedScriptFonts, ScriptFontApp, ScriptFontSlots, ScriptFontSource, ScriptFontSupplement, ScriptMeasurementProfile, ScriptRole} from './script-fonts.js';
export {CODE_HIGHLIGHT_LANGUAGES, CODE_HIGHLIGHT_MAX_LENGTH, CODE_PANEL_BACKGROUND, CODE_PANEL_FOREGROUND, CODE_SYNTAX_MIN_CONTRAST, codeLineRuns, codeSyntaxPalette, codeSyntaxPaletteForRoles, codeSyntaxPaletteForScheme, resolveCodeLanguage, tokenizeCode} from './code-syntax.js';
export type {CodeRun, CodeSyntaxPalette, CodeSyntaxPaletteOptions, CodeSyntaxPaletteTheme, CodeToken, CodeTokenKind} from './code-syntax.js';
export {METRIC_TREND_ARROW_GAP, METRIC_TREND_ARROW_SIZE, METRIC_TREND_MIN_CONTRAST, METRIC_TREND_SHAPES, METRIC_VALUE_MIN_CONTRAST, metricTrendColor, metricTrendMark, metricTrendPoints, metricValueColor} from './metric-trend.js';
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
  /**
   * OPF 0.19 adds the content-binding codes of template layouts: `region-unknown`, `region-kind` and `region-full` for an
   * ignored `region` pin, and `layout-unplaced` for a block no region had room for (drawn anyway; `paginate` moves it).
   */
  code: "text-overflow" | "small-cell" | "unresolved-content" | "unsupported-image-treatment" | "numbering-adapted" | "region-unknown" | "region-kind" | "region-full" | "layout-unplaced" | "emphasis-ignored";
  path: string;
  message: string;
  /**
   * OPF 0.19, `layout-unplaced`: the overflow region the block was drawn in beyond its `max` (`paginate` moves it to a
   * continuation slide). Absent when the layout has no overflow region and the block is drawn below the grid, which a
   * continuation cannot change. The pin codes name the pinned region.
   */
  region?: string;
}
/** Physical legacy-family selection supplied by a font provider, independently of its numeric weight. */
export interface FontFaceSelection { family: string; bold: boolean; italic: boolean }
export interface TextStyle { fontFamily: string; fontWeight: number; italic?: boolean; path?: string; fontFace?: FontFaceSelection;
  /** BCP-47 tag of a run that overrides the deck language (`TextRun.lang`); absent when the deck language applies. */
  lang?: string;
  /**
   * LH-32: drawn in capitals (an eyebrow). The text stays as authored: it is measured and drawn upper-cased (`toUpperCase`), and
   * PowerPoint draws it with `cap="all"`. Set only where capitals keep the text's UTF-16 length (eyebrowCaps), so offsets hold.
   */
  caps?: boolean;
  /** LH-32: letter spacing in em between characters (SVG `letter-spacing` with none after the last, PowerPoint `spc`). */
  tracking?: number }
/** LH-32: the letter spacing of an eyebrow (the slide tag, LH-50's label), in em; Claude Design tracks its eyebrows by about 0.08 to 0.12 em. */
export const EYEBROW_TRACKING = 0.08;
/**
 * LH-32: the size of the slide tag drawn as an eyebrow, in reference pixels: 0.4 of the title's 54 px role size, so a cover or section tag
 * reads at about 8 to 9 pt projected from a 1920 px slide (the 16 px of the floor read as about 6 pt).
 */
export const EYEBROW_TAG_SIZE = 22;
/**
 * LH-50: a label drawn as an eyebrow is EYEBROW_SHARE of the size of the paragraph it labels, from EYEBROW_MIN_SIZE to EYEBROW_MAX_SIZE
 * reference pixels (Claude Design's smallest text in these decks is about 24 px at 1920), and always under the paragraph's size (eyebrowSize).
 */
export const EYEBROW_SHARE = 0.6, EYEBROW_MIN_SIZE = 20, EYEBROW_MAX_SIZE = 24;
/**
 * LH-50: the size of the eyebrow over a paragraph set at `paragraph` canvas pixels: EYEBROW_SHARE of it, clamped to EYEBROW_MIN_SIZE to
 * EYEBROW_MAX_SIZE times `scale`; when that is not under the paragraph's size (a paragraph at 20 px or less), one step of the type scale
 * under it, never under `floor` (the readability floor, in canvas pixels).
 */
export function eyebrowSize(paragraph: number, scale: number, floor: number): number {
  const target = Math.min(EYEBROW_MAX_SIZE * scale, Math.max(EYEBROW_MIN_SIZE * scale, EYEBROW_SHARE * paragraph));
  return Math.max(floor, snapFontSizeDown(target < paragraph - FONT_GRID_EPSILON ? target : paragraph / (PROSE_NOMINAL_SIZE / 16) ** .25));
}
/** LH-50: the space between a label drawn as an eyebrow and the text under it, as a share of the composition gap. */
export const EYEBROW_GAP = 0.5;
/**
 * LH-32: whether `text` draws as an eyebrow in capitals with tracking: it has a letter, every letter has case (Latin, Greek, Cyrillic,
 * Armenian and the like) and capitals keep its UTF-16 length. A script without case (Arabic, Hebrew, CJK, Devanagari) keeps its letters
 * and its spacing, since tracking breaks the joining of a cursive script; such an eyebrow is set bold in the accent only.
 */
export function eyebrowCaps(text: string): boolean {
  return /\p{L}/u.test(text) && !/[\p{Lo}\p{Lm}]/u.test(text) && text.toUpperCase().length === text.length;
}
/** LH-32: what a style draws for `text`: its capitals when the style sets `caps`. */
export function styledText(text: string, style: Pick<TextStyle, 'caps'>): string { return style.caps ? text.toUpperCase() : text; }
/**
 * LH-32: the advance a style's tracking adds to `text` at `fontSize`: the tracking between every two characters. None after the last one, so
 * a centered or right-aligned eyebrow ends on its last letter (the preview draws the last character with no spacing after it).
 */
export function trackingWidth(text: string, fontSize: number, style: Pick<TextStyle, 'tracking'>): number {
  if (!style.tracking) return 0;
  let count = 0;
  for (const _ of text) count++;
  return style.tracking * fontSize * Math.max(0, count - 1);
}
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
  /**
   * Script planning: a measurement that measures each script run of a string with the face of its script slot in
   * `profile` (and the host's glyph fallback), as the host's engines draw it. The renderer's `loadFonts()` measurement
   * provides it with its script planner. `validate` and `paginate` call it with each slide's profile, and with a run language's own
   * profile for a run that names one, so they measure script text the way preview and export do.
   */
  forScripts?: (profile: ScriptMeasurementProfile) => TextMeasurement;
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
  if (!measurement?.resolveStyle) return style;
  // LH-32: a host that rebuilds the style keeps its capitals and tracking.
  const resolved = measurement.resolveStyle(style);
  return style.caps || style.tracking ? { ...resolved, ...(style.caps ? { caps: true } : {}), ...(style.tracking ? { tracking: style.tracking } : {}) } : resolved;
}
export function textWidthMeasurer(style: TextStyle, measurement?: TextMeasurement): MeasureTextWidth {
  // Without a host measurement a monospace family is measured on its 0.6 em cells: the proportional estimate is about
  // 15% short for code, so a code line it accepted ran past its panel once drawn in the bundled Roboto Mono.
  const base: MeasureTextWidth = !measurement ? isMonospaceFamily(style.fontFamily) ? measureMonospaceText : measureText : (text, size) => {
    const width = measurement.measure(text, size, style);
    if (!Number.isFinite(width) || width < 0) throw new RangeError('Text measurement must return a finite, nonnegative width.');
    return width;
  };
  // LH-32: an eyebrow is measured as drawn: its capitals, plus its tracking between characters.
  if (!style.caps && !style.tracking) return base;
  return (text, size) => base(styledText(text, style), size) + trackingWidth(text, size, style);
}
/** Validate an optional host outline measurement without inventing raster coverage. */
export function measureTextOutline(text: string, fontSize: number, style: TextStyle, measurement?: TextMeasurement): LayoutBox | null | undefined {
  if (measurement?.outlineBounds === undefined) return undefined;
  if (typeof measurement.outlineBounds !== 'function') throw new TypeError('Text outline provider must be a function.');
  const bounds = measurement.outlineBounds(styledText(text, style), fontSize, style);
  if (bounds === null) return null;
  if (!bounds || ![bounds.x,bounds.y,bounds.width,bounds.height].every(Number.isFinite) || bounds.width < 0 || bounds.height < 0) {
    throw new RangeError('Text outline measurement must return null or finite bounds with nonnegative dimensions.');
  }
  // LH-32: tracking moves every glyph after the first by the spacing before it.
  const spread = trackingWidth(text, fontSize, style);
  return {x:bounds.x,y:bounds.y,width:bounds.width+spread,height:bounds.height};
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
/** RR-92: what composition computes for a chart item beyond its box. */
export interface ComposedChart {
  valueAxis?: ChartValueAxis;
  /** LH-03, LH-81, LH-92, LH-93: the small-chart treatment, the header row, the ring names and a shared plot box (chart-layer.ts, chart-plot.ts). */
  layer?: ChartLayer;
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
  /**
   * RR-92: the value axis of a column, bar, line or area chart (`field` chart), computed from the chart box (`chartValueAxis`). The preview
   * draws it and the PPTX export writes it as `c:min`, `c:max` and `c:majorUnit`, so both show the same axis. Absent for every other chart
   * type (combo, scatter, pie and the rest keep the engines' own axis) and for charts whose data does not resolve.
   */
  chart?: ComposedChart;
  /** Effective container settings, including inherited readability constraints. */
  composition: Composition;
  /**
   * Resolved horizontal text alignment for this item: titleAlignment for the title, the tag and a subtitle that sits in
   * the title area (not a layout's own 'subtitle' region), contentAlignment for every other item (slide design, deck design
   * or host, theme design, layout design, then center for metrics or left for other items). Engines anchor native and preview text to this value.
   */
  alignment: 'left' | 'center' | 'right';
  /**
   * OPF 0.19: the layout template region the item was drawn in (`SlideComposition.regions[].name`); absent on headings,
   * placed images and slides without a template layout. The PPTX exporter tags the shape with it.
   */
  region?: string;
  /**
   * OPF 0.19: a list laid out in columns (a lone list in a region with `listColumns: "auto"`, or a list payload with
   * `columns`): one entry per column, in reading order, each with its cell, the half-open range of the payload's items it
   * holds and its own fit at the shared font size. Numbering continues across columns. The item's `text` is the whole list:
   * every entry of every column at its column's position (one ListFit, `overflow` when any column overflows), so a consumer
   * that ignores `listColumns` still draws every item; `box` is the whole list's cell.
   */
  listColumns?: ComposedListColumn[];
  /**
   * LH-76: this heading draws one part of a "Topic: qualifier" title that would wrap, split at its first colon followed by a
   * space: the topic as the title (`part` topic, `field` title) and the qualifier below it as a subtitle (`part` qualifier,
   * `field` subtitle). Both items carry the title's path; `value` is the drawn part, `start` and `end` its UTF-16 range in the
   * authored title, which the document keeps whole. Absent on every other item.
   */
  titleSplit?: { part: 'topic' | 'qualifier'; start: number; end: number };
  /**
   * LH-06: this item is drawn on the slide's emphasis surface (`SlideComposition.emphasis`): engines color it with the surface's roles
   * (core `emphasisSurface`), not the slide's. Absent on every other item.
   */
  emphasis?: true;
  /** LH-68: this metric is laid out as a tile of its card (a `metrics: "tile"` region). Absent on every other item. */
  metricTile?: true;
  /**
   * LH-50: this text block is a label drawn as the eyebrow of the paragraph after it (the next item): at eyebrowSize of it, bold, in
   * capitals with EYEBROW_TRACKING where its script has case (its `textStyle`). Engines draw it in the tag's color: the primary, or the
   * text color where the primary is under 4.5:1 on its backdrop. On a card it carries its paragraph's `frameBox`: the two share one card,
   * which engines draw once, under the eyebrow. Absent on every other item.
   */
  eyebrow?: true;
  /** LH-48: the growth (`TableLayoutOptions.growth`) of a lone table that filled too little of the body; engines lay the table out with it. */
  tableGrowth?: number;
  /**
   * LH-113: the body rows (0-based, after the header) a table draws on its highlight tint: the rows `table.highlight` names, else the
   * rows the slide's texts name (chart-focus.ts `tableSlideFocus`). Engines pass it to `layoutTable` (`TableLayoutOptions.highlight`).
   */
  tableHighlight?: number[];
}
/**
 * LH-06: the one contrasting surface of a slide. `path` is the block or group drawn on it (every item under that path carries
 * `emphasis`); `box` the surface, drawn under those items with the fill of core `emphasisSurface` and corner `radius`, in canvas pixels.
 * `shape`: `card` for a block or group's cell, `band` for a full-width band at the foot of the body, `pill` for a capsule around one short
 * text. `source`: `authored` for `emphasis: true`, else the automatic rule that made it (`foot-band`, `pill`).
 */
export interface ComposedEmphasis {
  path: string;
  box: LayoutBox;
  radius: number;
  shape: 'card' | 'band' | 'pill';
  source: 'authored' | 'foot-band' | 'pill';
}
/** One column of a list laid out in columns (`ComposedItem.listColumns`). */
export interface ComposedListColumn {
  box: LayoutBox;
  /** First item of the payload in this column. */
  start: number;
  /** One past the last item. */
  end: number;
  text: ListFit;
}
/**
 * OPF 0.19: one body region of the slide's layout template, as composed for this slide (`SlideComposition.regions`), so
 * editors can draw drop targets and exporters can place layout placeholders and tag shapes. Every region of the template
 * is listed, in reading order, filled or not.
 */
export interface ComposedRegion {
  /** The region's name (its key in the record's `regions`). */
  name: string;
  /**
   * The region's cell on this slide, after mirroring and bleed: a bled region's outer edges that lie on the content box
   * reach the slide edge. A collapsed region keeps the cell of its own area (possibly zero high), which another area
   * has taken over.
   */
  box: LayoutBox;
  accepts: RegionKind[];
  role: RegionRole;
  /** The record's `flow`. */
  flow: RegionFlow;
  max: number;
  anchor: RegionAnchor;
  /**
   * How the blocks were arranged: `grid` (the grid sequence by count), `row`, `column`, or `composition` when the
   * slide's own `composition.mode`, `columns` or `weights` arranged its first primary flowing region. Absent when empty.
   */
  arrangement?: 'grid' | 'row' | 'column' | 'composition';
  /** OPF paths of the content bound to the region within `max`, in source order: root blocks (`slides.N.blocks.I`) or root payload fields (`slides.N.text`). */
  content: string[];
  /** Content no region had room for, drawn here beyond `max` (`opf/layout-unplaced`; `paginate` moves it to a continuation slide). */
  overflow?: string[];
  /** The region received no content and its cells joined a neighbour on this slide. */
  collapsed?: true;
  bleed?: true;
  /** A bled region's cell inside the content box, before bleed. */
  areaBox?: LayoutBox;
}
/** OPF 0.19: a heading area of the slide's layout template (`title`, or `subtitle` when the template has one). */
export interface ComposedHeadingArea {
  name: 'title' | 'subtitle';
  box: LayoutBox;
  /** The slide has no heading for it and its cells joined a neighbour. */
  collapsed?: true;
  /** The template has no `title` area: an `auto` row on top that holds the slide's headings. */
  implicit?: true;
  /**
   * The title area of a template without a `subtitle` area, split where the stacked heading group puts the subtitle: `title`
   * runs from the area's top to the bottom of the title (with the tag above it), `subtitle` from the subtitle's top (where it
   * would start, half a gap under the title, when the slide has none) to the area's bottom. PowerPoint's ctrTitle and
   * subTitle placeholders use these boxes. Absent when the slide has no headings in the area.
   */
  parts?: { title: LayoutBox; subtitle: LayoutBox };
}
/** How a picture fills its frame: cover crops around the focus, contain shows all of it, stretch scales it to the frame. */
export type ImageFit = 'cover' | 'contain' | 'stretch';
/** A fit as authored (block `fit`, `design.imageFit`): one of ImageFit, or `auto` (LH-104), which core resolves per frame (autoImageFit). */
export type ImageFitOption = ImageFit | 'auto';
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
  /** Where the placement is written: `slides.N.blocks.I.placement`. */
  path: string;
  /** LH-80: automatic composition chose this band (the picture's side track); nothing is written at `path`. */
  automatic?: true;
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
  /** The effective fit: the block's own fit, else the effective design.imageFit, else cover, with `auto` resolved for this frame (autoImageFit). */
  fit: ImageFit;
  /** LH-104: present when the fit asked for was `auto`; `fit` is what it resolved to (cover or contain), for example to show "Auto (cover)". */
  autoFit?: true;
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
  /**
   * LH-02: the automatic scrims behind the text on this picture (picture-scrim.ts), in paint order, drawn directly above the picture and
   * beneath furniture and content: one for the body and headings, one for the header and one for the footer, merged where they meet.
   * Present when text sits on the picture and the background has no `overlay` key: an overlay of the author's replaces them and
   * `overlay: false` turns them off.
   */
  scrims?: ComposedScrim[];
  /** Present when core reads the picture's aspect ratio and the fit is not tile; otherwise call `fitImage` with the host's. */
  picture?: ImageFitPlacement;
}
/**
 * The deck logo drawn on a cover or section slide, at the top-left of the free area and above the
 * centered heading group: the primary organization's full logo, or the `design.logo` override. Consumers fit the
 * image inside `box` preserving its aspect ratio, anchored left and vertically centered; content slides never carry one.
 * `shape`, `variant` and `reference` are those of `resolveLogo`.
 */
export interface ComposedLogo { box: LayoutBox; shape: LogoShape; path: string; source: unknown; variant: LogoVariant; reference: string; anchor: 'left' | 'right' }
/** Picture bullet source for list markers: the deck's icon logo and the OPF path it was read from. */
export interface ListBulletImage { source: unknown; path: string }
export interface ComposedGroup { path: string; box: LayoutBox; contentBox: LayoutBox; composition: Composition }
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
  /** LH-66: 20 per paragraph that runs four lines or more on a measure under 28 average characters of its fitted size. */
  narrowMeasure: number;
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
  /**
   * `chart-primary`: the root split a primary chart from a synthetic container of the other nodes (design.chartPrimary).
   * `table-width` (LH-44): the grid of `selectedColumns` gave a table less than its words need, so the table took its natural width
   * beside a column of the other blocks, or the whole width between rows of them.
   * `paragraph-columns` (LH-70): similar paragraphs set as a grid of columns at a reading measure.
   * `lead-stack` (LH-67): one block much longer than its siblings (or a chart or picture beside two compact blocks) leads beside a
   * stack of the others.
   * `split-fill` (LH-71): two or three blocks of an automatic body took one row or one column instead of the scored grid, because it
   * fills more of the body; `candidates` are the scored ones.
   */
  reason: 'lowest-score' | 'configured-mode' | 'promoted-regions' | 'chart-primary' | 'table-width' | 'paragraph-columns' | 'lead-stack' | 'split-fill';
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
  /**
   * The body's frame: the canvas minus padding, header and footer bands, the footnote area and placed-image bands, below
   * the headings on an automatic slide. For a template layout (OPF 0.19) it is the whole template frame, the title area
   * included (`headingAreas` and `regions` lie inside it, except where a bled region reaches the slide edge).
   */
  contentBox: LayoutBox;
  items: ComposedItem[];
  groups: ComposedGroup[];
  flows: ComposedFlow[];
  /** OPF 0.19: every body region of the slide's layout template, in reading order; present only for a template layout. */
  regions?: ComposedRegion[];
  /** OPF 0.19: the template's heading areas (`title`, `subtitle`) with their boxes; present only for a template layout. */
  headingAreas?: ComposedHeadingArea[];
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
  /**
   * LH-83: the layout's composition set a body role at the readability floor, so the body was composed again as the automatic grid,
   * which set every body role larger and overflows no more; this composition is that one. `layoutSize` is the smallest body size
   * the layout fitted and `size` the smallest of this composition, in reference pixels (canvas pixels over the canvas scale).
   * The headings sit above the body as on an automatic slide; `regions` and `headingAreas` are absent. Absent on every other slide.
   * LH-49: the same when the layout left a chart's plot shorter than its minimum and the automatic grid draws it taller and reads as
   * well (no block smaller unless the layout overflows): `chart` holds the shortest plot height (chartPlotBox) of the layout's
   * composition and of this one, in reference pixels. LH-61: `kpis` when the layout stacked one or two metrics over a chart and this
   * composition sets them in a column beside it (kpiColumn), the chart's plot at least as tall.
   */
  recomposed?: { layoutSize: number; size: number; chart?: { layoutPlot: number; plot: number }; kpis?: true };
  /** LH-06: the slide's emphasis surface (at most one), when a block or group asks for it or an automatic rule gives one. */
  emphasis?: ComposedEmphasis;
  /**
   * LH-80, LH-49: automatic composition gave the slide's one picture (`picture`) or one chart (`chart`) a full-height track of its own
   * at `edge` (physical), `size` of the slide's width (left, right) or height (top, bottom); `path` is the block's. A picture's track
   * bleeds to the slide edges (its `image.placement` is `automatic`); a chart's is the root's first or last column. Absent otherwise.
   */
  track?: { kind: 'picture' | 'chart'; edge: ImageEdge; size: number; path: string };
  explanation?: CompositionExplanation;
}
export interface ComposeSlideOptions {
  /** Context for inherited furniture, generated organization names, social profiles, logos, layout hints, references and marker numbering. */
  presentation?: { language?: unknown; design?: { header?: unknown; footer?: unknown; background?: unknown; imageFit?: unknown; logo?: unknown; contentDirection?: unknown; chartPrimary?: unknown; listBullet?: unknown; titleAlignment?: unknown; contentAlignment?: unknown; contentBox?: unknown; mirror?: unknown }; organization?: unknown; speaker?: unknown; slides?: unknown; catalogs?: unknown; references?: unknown; datasets?: unknown };
  /**
   * OPF 0.19: the resolved theme record's `design` (titleAlignment, contentAlignment, contentBox, contentDirection,
   * imageFit, listBullet). It ranks below the deck's design and above the layout record's. `resolveSlideContext` passes it.
   */
  themeDesign?: unknown;
  /**
   * Whether the slide background is dark, by the host's own luminance test. Selects each logo's
   * `onDark` value (cover logo, `var:organization.logo.*` in zone images, picture bullets). Core never inspects colors.
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
  /**
   * LH-83: `false` keeps a layout template's composition even when it sets a body role at the readability floor (by default
   * the body is then composed again as the automatic grid when that sets it larger; `SlideComposition.recomposed`).
   */
  recompose?: boolean;
  /**
   * LH-48: `false` keeps a body that fills too little of its height at its role sizes and in its place (by default a lone block, or a body
   * of paragraphs and lists, under half full steps up the type scale to about 60% and moves to the middle of the body).
   */
  fill?: boolean;
  /** Return candidate scores and coverage without changing the selected geometry. */
  explain?: boolean;
  /**
   * LH-02: the slide's resolved color roles the automatic scrim of a picture background reads (the text colors and the scrim's,
   * the slide background). `resolveSlideContext` passes them; without them the default scheme's roles for `darkBackground` apply.
   */
  roles?: { text: string; textSecondary: string; primary: string; background: string };
  /**
   * LH-02: a host that can read a picture's pixels returns its luminance grid (WCAG relative luminance per cell, row order), and the
   * automatic scrim is then sized for the picture under the text instead of for any picture. Engines that draw the same slide must be
   * given the same function, or none (then every scrim is sized for the worst case, black to white).
   */
  pictureLuminance?: (src: string) => PictureLuminance | undefined;
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
const IMAGE_FITS = ['cover', 'contain', 'stretch', 'auto'] as const;
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
/** A valid focus point the author gave, else undefined. */
const authoredFocus = (value: unknown): ImageFocus | undefined => {
  const focus = record(value), x = finite(focus.x, 0, 1), y = finite(focus.y, 0, 1);
  return x !== undefined && y !== undefined ? { x, y } : undefined;
};
/** A valid focus point, else the center. */
const imageFocus = (value: unknown): ImageFocus => authoredFocus(value) ?? { x: 0.5, y: 0.5 };
/**
 * LH-84: how far down a portrait picture's crop is kept in view when the author gave no focus. A cover crop of a picture taller than
 * wide into a wider frame trims the top and bottom; a centered crop trims the head of a portrait as much as the legs, so the focus
 * defaults to 30% of the picture's height (heads stay in frame). Any other crop is centered; an authored focus always wins.
 */
export const PORTRAIT_FOCUS_Y = 0.3;
/** The focus a picture of `aspect` (width / height) uses in `frame` with `fit` when the author gave none (see PORTRAIT_FOCUS_Y). */
export function defaultImageFocus(frame: LayoutBox, fit: ImageFit, aspect: number): ImageFocus {
  const portrait = Number.isFinite(aspect) && aspect > 0 && aspect < 1;
  return fit === 'cover' && portrait && frame.width > 0 && frame.height > 0 && aspect < frame.width / frame.height ? { x: 0.5, y: PORTRAIT_FOCUS_Y } : { x: 0.5, y: 0.5 };
}

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
 * LH-104: `fit: "auto"` crops a picture only when the crop is small. A cover crop keeps coverKept of the picture along the dimension it
 * crops; at 0.85 at most 7.5% goes off each edge, which a photo loses without losing its subject, while a 16:9 photo in a 2:1 band
 * (0.89) still fills it and a 3:2 photo in a square frame (0.67) would lose a sixth of each side and is shown whole. Tuned on the
 * LH-27, chart and mixed corpora and the examples (596 pictures of known size): 0.80 crops 18 more of them, 0.90 28 fewer.
 */
export const AUTO_FIT_MIN_KEPT = 0.85;
/** The share of a picture of `aspect` (width / height, EXIF-corrected) a cover crop into `frame` keeps along the cropped dimension; 1 when either is unknown. */
export function coverKept(frame: { width: number; height: number }, aspect: number | undefined): number {
  const frameAspect = frame.width / frame.height;
  return aspect === undefined || !(aspect > 0) || !Number.isFinite(aspect) || !(frameAspect > 0) || !Number.isFinite(frameAspect) ? 1 : Math.min(frameAspect / aspect, aspect / frameAspect);
}
/**
 * LH-104: what `fit: "auto"` draws in `frame`: cover when the crop keeps at least AUTO_FIT_MIN_KEPT of the picture (coverKept), else
 * contain. An SVG (a diagram or a logo, whose crop cuts content) and a picture whose size core cannot read are always contained.
 */
export function autoImageFit(frame: { width: number; height: number }, aspect: number | undefined, options: { svg?: boolean } = {}): 'cover' | 'contain' {
  if (options.svg || aspect === undefined || !(aspect > 0) || !Number.isFinite(aspect)) return 'contain';
  return coverKept(frame, aspect) >= AUTO_FIT_MIN_KEPT - 1e-9 ? 'cover' : 'contain';
}

/**
 * The shared fit math every engine uses (FA-22). `aspect` is the picture's width / height. cover scales the picture
 * to cover the frame and centers the focus point in the frame as far as the picture still covers it, so the focus
 * point always stays in view ({0.5, 0.5} is a center crop, {0, 0} keeps the top-left corner). contain scales it to
 * fit and centers it; stretch fills the frame exactly. Focus applies to cover only; without one, a portrait picture cropped
 * into a wider frame keeps its heads (defaultImageFocus), every other crop is centered. `crop` holds the DrawingML
 * srcRect insets as fractions of the picture: positive insets crop, negative insets pad. `auto` (LH-104) is resolved by autoImageFit
 * for a raster picture; an SVG is always contained, so pass its fit resolved (composeImage does).
 */
export function fitImage(frame: LayoutBox, requested: ImageFitOption, aspect: number, focus?: ImageFocus): ImageFitPlacement {
  if (![frame.x, frame.y, frame.width, frame.height].every(Number.isFinite) || frame.width <= 0 || frame.height <= 0) throw new RangeError('An image frame needs finite coordinates and a positive size.');
  const fit: ImageFit = requested === 'auto' ? autoImageFit(frame, aspect) : requested;
  if (fit === 'stretch' || !Number.isFinite(aspect) || aspect <= 0) return { image: roundBox(frame), crop: { left: 0, top: 0, right: 0, bottom: 0 } };
  const wide = aspect > frame.width / frame.height, cover = fit === 'cover';
  const width = wide === cover ? frame.height * aspect : frame.width, height = wide === cover ? frame.height : frame.width / aspect;
  const point = focus === undefined ? defaultImageFocus(frame, fit, aspect) : imageFocus(focus);
  const place = (start: number, span: number, size: number, at: number) => cover
    ? Math.min(start, Math.max(start + span - size, start + span / 2 - at * size))
    : start + (span - size) / 2;
  const image = { x: place(frame.x, frame.width, width, point.x), y: place(frame.y, frame.height, height, point.y), width, height };
  const crop = {
    left: round((frame.x - image.x) / width), top: round((frame.y - image.y) / height),
    right: round((image.x + width - frame.x - frame.width) / width), bottom: round((image.y + height - frame.y - frame.height) / height),
  };
  for (const key of ['left', 'top', 'right', 'bottom'] as const) if (Math.abs(crop[key]) < 1e-9) crop[key] = 0;
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

/** The offset of a block shorter than its cell by `spare`: 0 at the top, half at the middle, all of it at the bottom. */
function anchoredOffset(spare: number, anchor: RegionAnchor): number {
  return Math.max(0, anchor === 'middle' ? spare / 2 : anchor === 'bottom' ? spare : 0);
}

/** The largest box of `aspect` (width / height) that fits `cell`, centered across and placed by `anchor` along the height. */
function containedBox(cell: LayoutBox, aspect: number, anchor: RegionAnchor): LayoutBox {
  const width = Math.min(cell.width, cell.height * aspect), height = width / aspect;
  return { x: cell.x + (cell.width - width) / 2, y: cell.y + anchoredOffset(cell.height - height, anchor), width, height };
}

/**
 * Picture geometry of one image block in its region (FA-22): the frame (the frame area, then the aspect ratio), the mask,
 * the line, opacity, recolor and overlay: the treatments 0.14 drew on the slide picture, applied to image blocks.
 */
function composeImage(host: Record<string, any>, hostPath: string, region: LayoutBox, frameArea: LayoutBox, context: { fit?: ImageFitOption; scale: number; mirrorSide: (side: string) => string; diagnostics: LayoutDiagnostic[]; assets: unknown; placement?: ComposedPlacement; anchor?: RegionAnchor }): ComposedImage {
  const kindName: ImageShape['kind'] = Object.hasOwn(IMAGE_SHAPES, host.shape) ? host.shape : 'rectangle';
  const { scale } = context;
  const requested: ImageFitOption = (IMAGE_FITS as readonly unknown[]).includes(host.fit) ? host.fit : context.fit ?? 'cover';
  // LH-80 with LH-104: an automatic track is a frame the engine chose to crop the picture into, so `auto` covers it there.
  const decided: ImageFitOption = requested === 'auto' && context.placement?.automatic ? 'cover' : requested;
  const size = intrinsicImageSize(host.image, context.assets), pictureAspect = size ? size.width / size.height : undefined;
  let box: LayoutBox = { ...frameArea };
  const aspect = kindName === 'circle' ? 1 : finite(host.aspectRatio, Number.MIN_VALUE, 10);
  if (aspect) {
    const frameWidth = Math.min(box.width, box.height * aspect), frameHeight = frameWidth / aspect;
    box = { x: box.x + (box.width - frameWidth) / 2, y: box.y + (box.height - frameHeight) / 2, width: frameWidth, height: frameHeight };
  }
  // LH-104: `auto` is decided on the frame the picture would fill (the cell, or the frame the block shapes), before a contained
  // picture's frame takes the picture's own proportions; preview and export both draw the composed fit.
  const fit: ImageFit = decided === 'auto' ? autoImageFit(box, pictureAspect, { svg: size?.svg }) : decided;
  if (!aspect && context.anchor && fit === 'contain' && pictureAspect) {
    // WI-3 (P12): a contained picture is the whole picture, so its frame is the picture's own shape inside the cell.
    const frameWidth = Math.min(box.width, box.height * pictureAspect);
    box = { x: box.x + (box.width - frameWidth) / 2, y: box.y, width: frameWidth, height: frameWidth / pictureAspect };
  }
  // ... and it sits at the region's anchor (top, middle or bottom of the cell) instead of always centered. A frame the block sets
  // with aspectRatio or a circle shape stays centered, as the schema says.
  if (context.anchor && fit === 'contain' && !aspect && box.height < frameArea.height) box.y = frameArea.y + anchoredOffset(frameArea.height - box.height, context.anchor);
  box = roundBox(box);
  const focus = authoredFocus(host.focus) ?? (pictureAspect ? defaultImageFocus(box, fit, pictureAspect) : imageFocus(undefined));
  const shape = imageShape(kindName, box, finite(host.cornerRadius, 0, 0.5));
  const result: ComposedImage = { region: roundBox(region), box, fit, ...(requested === 'auto' ? { autoFit: true as const } : {}), focus, shape };
  const border = record(host.border), borderWidth = finite(border.width, 0, 64);
  if (border.color !== undefined && borderWidth) result.border = { color: border.color, width: round(borderWidth * scale) };
  const opacity = finite(host.opacity, 0, 1);
  if (opacity !== undefined && opacity < 1) result.opacity = opacity;
  const recolor = composeRecolor(host.recolor);
  if (recolor) result.recolor = recolor;
  const overlay = composeOverlay(host.overlay, box, shape, `${hostPath}.overlay`, context.mirrorSide, context.diagnostics);
  if (overlay) result.overlay = overlay;
  if (context.placement) result.placement = context.placement;
  if (pictureAspect) result.picture = fitImage(box, fit, pictureAspect, focus);
  return result;
}

/** The effective background (slide, deck, theme) when it is a picture; it fills the canvas and moves nothing. A layout variant hides a scheme-based background of the deck and the theme (LH-01), never a picture (LH-103). */
function resolveBackgroundImage(slide: Record<string, any>, presentation: unknown, themeBackground: unknown, layout: unknown, width: number, height: number, path: string, mirrorSide: (side: string) => string, diagnostics: LayoutDiagnostic[]): ComposedBackgroundImage | undefined {
  const own = record(slide.design), deck = record(record(presentation).design);
  if (layoutVariantApplies(own, layout, deck, themeBackground)) return undefined;
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
  if (aspect) {
    // LH-84: a portrait picture the author gave no focus keeps its heads (defaultImageFocus).
    if (authoredFocus(record(value).focus) === undefined) result.focus = defaultImageFocus(box, background.fit as ImageFit, aspect);
    result.picture = fitImage(box, background.fit as ImageFit, aspect, result.focus);
  }
  return result;
}

export interface FurniturePartBase {
  kind: 'header' | 'footer';
  zone: 'left' | 'center' | 'right';
  field: 'text' | 'image' | 'socials' | 'date';
  /** Literal field or controlling flag, with the actual inherited/local path. */
  path: string;
  /** String/asset source, when different from a generated field's flag; for a logo reference, the organization logo value drawn. */
  sourcePath?: string;
  generated: boolean;
  /**
   * The part's own box. A zone lays its parts out in one row, in the order image, text, socials, date (mirrored in a
   * right-to-left deck), aligned to the zone's edge with FURNITURE_GAP between parts and each part vertically centered
   * in the row. A zone with one part keeps the full zone width for text. The zones sit on the content inset
   * (`composition.padding`); a zone beside empty zones takes their width (FURNITURE_ZONE_GUTTER between occupied zones).
   */
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
export interface FurnitureImagePart extends FurniturePartBase {
  type: 'image';
  /** The asset to draw: the zone `image` as written, or the organization logo a logo reference resolved to for this slide. */
  image: unknown;
  /** The slide-scoped logo reference the zone wrote (`var:organization.logo.icon`), when `image` came from one. */
  reference?: string;
}
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

/** Gap between the parts of one header/footer zone row, in reference pixels (scaled with the canvas's short edge). */
export const FURNITURE_GAP = 12;
/** Gap between the three header/footer zones, as a share of the canvas width. An empty zone's column is lent to its occupied neighbours. */
export const FURNITURE_ZONE_GUTTER = .02;
/** In a zone with other parts, an image is at most this share of the zone's width, so a wide logo cannot starve the text. */
export const FURNITURE_IMAGE_SHARE = .4;
/** Letters and digits of scripts written with spaces between words: a soft line break between two of them splits a word. */
const SPACED_WORD_CHARACTER = /^[\p{L}\p{N}\p{M}]$/u;
const UNSPACED_SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}\p{Script=Tibetan}]/u;
/** True when a soft line break of the fit falls inside a word of a space-separated script (the grapheme fallback of a word wider than the line). */
function breaksInsideWord(text: string, fit: SourceTextFit): boolean {
  return fit.sourceLines.some(line => {
    if (line.boundary !== 'soft' || line.nextStart <= 0 || line.nextStart >= text.length) return false;
    const before = [...text.slice(0, line.nextStart)].at(-1) ?? '', after = [...text.slice(line.nextStart, line.nextStart + 2)][0] ?? '';
    return SPACED_WORD_CHARACTER.test(before) && SPACED_WORD_CHARACTER.test(after) && !UNSPACED_SCRIPT.test(before) && !UNSPACED_SCRIPT.test(after);
  });
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
    // The three zones are columns on the content inset (the same left edge as the body), separated by a gutter. A zone
    // with nothing in it lends its column to the occupied neighbours, so a lone `left` footer spans the content width
    // and a footer with a left and a right zone shares the free centre. A centre zone stays centred on the slide.
    const inset=Math.min((settings.padding??.08)*Math.min(width,height),width*.25),gutter=width*FURNITURE_ZONE_GUTTER,column=(width-2*inset-2*gutter)/3;
    const slotOf=(index:number)=>furnitureRtl&&index!==1?2-index:index;
    const hasContent=(zone:'left'|'center'|'right')=>{
      const item=record(record(value)[zone]);
      return item.image!==undefined||(typeof item.text==='string'?item.text.trim()!=='':item.text!==undefined)||item.socials===true||item.date===true||typeof item.date==='string';
    };
    const slots=(['left','center','right'] as const).map((zone,index)=>({slot:slotOf(index),occupied:hasContent(zone)})).sort((a,b)=>a.slot-b.slot);
    const first=slots.findIndex(entry=>entry.occupied);
    const interval=(slot:number):{x:number;width:number}=>{
      const start=inset+slot*(column+gutter),end=start+column;
      if(!slots[slot]!.occupied||first<0)return {x:start,width:column};
      const before=slots.slice(0,slot).map(entry=>entry.occupied).lastIndexOf(true),after=slots.findIndex((entry,i)=>i>slot&&entry.occupied);
      // Room taken from the empty slots on each side: all of them at the slide edge, half of the free gap between two zones.
      const left=before<0?start-inset:(start-(inset+before*(column+gutter)+column)-gutter)/2,right=after<0?width-inset-end:(inset+after*(column+gutter)-end-gutter)/2;
      const lend=slot===1?Math.min(left,right):undefined;
      return {x:start-(lend??left),width:column+(lend??left)+(lend??right)};
    };
    for(const [index,zone]of (['left','center','right'] as const).entries()){
      // Right to left: the authored `left` zone is drawn at the right and `right` at the left; `zone` keeps the authored name.
      // `alignment` is the physical edge the zone's text sits on (never flipped again by line direction).
      const side=furnitureRtl&&zone!=='center'?(zone==='left'?'right':'left'):zone;
      const content=record(record(value)[zone]),path=`${root}.${zone}`,{x,width:zoneWidth}=interval(slotOf(index));
      type PendingText={type:'text';field:FurniturePartBase['field'];text:string;generated:boolean;sourcePath:string|undefined;extras:FurnitureTextExtras;partPath:string;style:TextStyle};
      type PendingImage={type:'image';sourcePath:string;image:unknown;reference?:string;width:number;height:number};
      const pending:(PendingText|PendingImage)[]=[];
      const add=(field:FurniturePartBase['field'],text:unknown,generated=false,sourcePath?:string,extras:FurnitureTextExtras={})=>{
        if(text===undefined)return;
        if(typeof text!=='string')throw new TypeError(`Furniture field ${path}.${field} requires string content.`);
        const partPath=`${path}.${field}`;
        pending.push({type:'text',field,text,generated,sourcePath:sourcePath??(!generated?partPath:undefined),extras,partPath,style:resolveTextStyle({fontFamily,fontWeight:400,italic:false,path:partPath},options.textMeasurement)});
      };
      // An image part is as wide as its own aspect ratio makes it at the band height (a square when the source's
      // dimensions are not readable), capped at the zone. Consumers fit the image inside this box.
      const addImage=(source:unknown,sourcePath:string,reference?:string)=>{
        const imageHeight=Math.max(32*scale,Math.min(height*.05,72*scale)),imageWidth=Math.min(zoneWidth,imageHeight*(intrinsicImageAspect(source,record(options.presentation).assets)??1));
        pending.push({type:'image',sourcePath,image:source,...(reference!==undefined?{reference}:{}),width:imageWidth,height:imageHeight});
      };
      if(content.image!==undefined){
        // A logo reference (`var:organization.logo.icon`) is slide-scoped: it resolves here, for this slide's background.
        const logo=typeof content.image==='string'&&content.image.startsWith('var:organization.')?parseLogoName(content.image,options.presentation):null;
        if(!logo)addImage(content.image,`${path}.image`);
        else if('error' in logo)error(`${path}.image`,logo.error,'unresolved-content');
        else{
          const resolved=resolveOrganizationLogo(options.presentation,logo,{onDark:options.darkBackground===true});
          if(resolved.ok)addImage(resolved.logo.source,resolved.logo.path,content.image as string);
          else error(`${path}.image`,`${resolved.message} Give the organization a logo, or change the zone image.`,'unresolved-content');
        }
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
      // Text fitted at a box width, with each source line's ink when outlines are provided.
      const fitPart=(part:PendingText,boxWidth:number)=>{
        const fit=fitText(part.text,{x:0,y:0,width:Math.max(Number.MIN_VALUE,boxWidth-(outlines?2*padding:0)),height:Number.MAX_VALUE},size,size,textWidthMeasurer(part.style,options.textMeasurement));
        const ink:TextLineInk[]=fit.sourceLines.map((line,index)=>{
          let outline:LayoutBox|null=null;
          if(outlines)for(const segment of line.segments)if(segment.kind==='text'){
            const bounds=measureTextOutline(part.text.slice(segment.start,segment.end),size,part.style,options.textMeasurement);
            if(bounds){const next={...bounds,x:bounds.x+segment.x};if(!outline)outline=next;else{const right=Math.max(outline.x+outline.width,next.x+next.width),bottom=Math.max(outline.y+outline.height,next.y+next.height);outline.x=Math.min(outline.x,next.x);outline.y=Math.min(outline.y,next.y);outline.width=right-outline.x;outline.height=bottom-outline.y;}}
          }
          return {width:line.width,y:index*fit.lineHeight,baseline:size+index*fit.lineHeight,height:fit.lineHeight,outline};
        });
        const natural=outlines?placeTextLines(ink,{x:0,y:0,width:boxWidth,height:Number.MAX_VALUE},side,padding):undefined;
        const partHeight=natural?.height??fit.sourceLines.length*fit.lineHeight;
        if(!Number.isFinite(partHeight))throw new RangeError('Furniture exceeds finite layout coordinates.');
        return {fit,ink,height:Math.max(scale,partHeight)};
      };
      // The zone's parts sit in one row. A lone text part keeps the whole zone width (it wraps there); with other
      // parts each text part is as wide as its longest line, and when the row is wider than the zone the text parts
      // share what the images and gaps leave (narrow parts keep their width, the rest wrap at an equal share).
      const gap=FURNITURE_GAP*scale,gaps=gap*Math.max(0,pending.length-1);
      // With other parts an image is at most FURNITURE_IMAGE_SHARE of the zone (consumers fit it inside its box); alone it keeps its width.
      const widths=pending.map(part=>part.type==='image'?(pending.length>1?Math.min(part.width,zoneWidth*FURNITURE_IMAGE_SHARE):part.width):pending.length===1?zoneWidth:Math.max(scale,...fitPart(part,1e7).ink.map(line=>Math.max(line.width+(outlines?2*padding:0),line.outline?line.outline.width+2*padding:0))));
      if(pending.length>1&&widths.reduce((sum,entry)=>sum+entry,0)+gaps>zoneWidth+.01){
        const texts=pending.map((_,index)=>index).filter(index=>pending[index]!.type==='text').sort((a,b)=>widths[a]!-widths[b]!);
        let remaining=zoneWidth-gaps-pending.reduce((sum,part,index)=>sum+(part.type==='image'?widths[index]!:0),0),count=texts.length;
        if(remaining<scale*Math.max(1,count))error(path,`The parts of this zone (${pending.map(part=>part.type==='image'?'image':part.field).join(', ')}) are wider side by side than the zone; remove a part or move one to another zone.`);
        for(const index of texts){const share=Math.max(scale,remaining/count);widths[index]=Math.min(widths[index]!,share);remaining-=widths[index]!;count--;}
      }
      const measured=pending.map((part,index)=>part.type==='image'?{part,width:widths[index]!,height:part.height}:{part,width:widths[index]!,...fitPart(part,widths[index]!)});
      const row=Math.max(0,...measured.map(entry=>entry.height));
      const total=measured.reduce((sum,entry)=>sum+entry.width,0)+gaps;
      // The row aligns to the zone's edge; a right-to-left deck runs it from the right (the image is at the start edge).
      let cursor=side==='left'||total>zoneWidth+.01?x:side==='center'?x+(zoneWidth-total)/2:x+zoneWidth-total;
      const placed=new Map<number,number>();
      for(const index of (furnitureRtl?[...measured.keys()].reverse():[...measured.keys()])){placed.set(index,cursor);cursor+=measured[index]!.width+gap;}
      const zoneParts:FurniturePart[]=measured.map((entry,index)=>{
        const box={x:placed.get(index)!,y:(row-entry.height)/2,width:entry.width,height:entry.height};
        if(entry.part.type==='image'){
          const part=entry.part;
          return {type:'image',kind,zone,field:'image',path:`${path}.image`,sourcePath:part.sourcePath,generated:false,image:part.image,...(part.reference!==undefined?{reference:part.reference}:{}),box,alignment:side};
        }
        const part=entry.part,{fit,ink}=entry as unknown as {fit:SourceTextFit;ink:TextLineInk[]};
        const placement=outlines?placeTextLines(ink,box,side,padding):undefined;
        const accepted={...fit,...(placement?{placement}:{}),overflow:fit.overflow||!!placement?.overflow};
        if(accepted.overflow)error(part.partPath,'Repeated text exceeds its zone at the selected readability floor; change the furniture or slide design.');
        // Beside other parts a word wider than its share would be split mid-word: that is overflow too, never a silent break.
        else if(pending.length>1&&breaksInsideWord(part.text,fit))error(part.partPath,'A word of this repeated text is wider than its share of the zone row at the selected readability floor and would break inside the word; shorten the text, move a part to another zone, or widen the canvas.');
        return {type:'text',kind,zone,field:part.field,path:part.partPath,...(part.sourcePath!==undefined?{sourcePath:part.sourcePath}:{}),generated:part.generated,text:part.text,style:part.style,requestedFontSize:size,minFontSize:minimum,box,alignment:side,fit:accepted,...(part.extras.fields?.length?{fields:part.extras.fields}:{}),...(part.extras.links?.length?{links:part.extras.links}:{})};
      });
      zones.push(zoneParts);
    }
    const tallest=Math.max(0,...zones.flat().map(part=>part.box.y+part.box.height));
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
/**
 * WI-4: the type roles of the content scale, in reference pixels (a 13.333 x 7.5 in slide is 1280 x 720). Prose and a subtitle ask for 28 px
 * (21 pt) and a list item for 32 px; a lone short block uses the 32 px lead size. Each fits down to the readability floor
 * (`composition.minFontSize`, 16 px by default) and an explicit run size wins.
 */
export const PROSE_NOMINAL_SIZE = 28, LIST_NOMINAL_SIZE = 32, LEAD_NOMINAL_SIZE = 32, TABLE_NOMINAL_SIZE = 25;
/** WI-4: a quote body asks for 40 px and fits down (to 28 px and below); a code body asks for 22 px and fits down to the floor. */
export const QUOTE_NOMINAL_SIZE = 40, CODE_NOMINAL_SIZE = 22;
/**
 * The largest inset between a content card's edge and its payload, in reference pixels: a card insets a sixteenth of its shorter side,
 * at least the former 12 px and at most this. 24 px (36 px at 1080) follows the ~40 px card padding of Claude's Slides type.
 */
export const CARD_INSET = 24;
/**
 * A card that fills its cell starts this fraction of a gap below the cell's top (12 px at 720), so a row of full-height cards stands
 * clear of the heading above it (1.5 gaps in all, near the 56 px at 1080 of Claude's Slides type).
 */
export const CARD_FILL_SPACE = 0.5;
/** The corner radius of a content card and of the emphasis card and band, in reference pixels (the engines draw cards with it). */
export const CARD_RADIUS = 8;
/** LH-06: the text size of an automatic pill (a label), in reference pixels; the foot band asks for the prose size. */
export const EMPHASIS_PILL_SIZE = 20;
/** LH-06: the largest share of the body's height an automatic foot band or pill takes; a taller one is not drawn. */
export const EMPHASIS_BAND_MAX_SHARE = 0.3;
/** The code body size before WI-4: the size taken when the 22 px request would wrap lines it keeps whole. */
const LEGACY_CODE_NOMINAL_SIZE = 18;
/** Joins a quote's attribution and source (an en dash with a space on each side); import reads the older ' - ' too. */
export const QUOTE_SOURCE_SEPARATOR = ' \u2013 ';
/** A prose cell is no wider than this many average characters of its body size in auto mode (WI-4, P34). */
const PROSE_MEASURE_CHARS = 70, AVERAGE_CHARACTER_EM = .5;
/** LH-70, LH-72: the measure of a paragraph column and of start-aligned text in a centered layout, in average characters. */
const PARAGRAPH_MEASURE_MIN = 45, PARAGRAPH_MEASURE_MAX = 65;
/**
 * LH-66: the narrowest reading measure of prose in automatic composition, in average characters of its size. A paragraph or list that
 * wraps in a cell narrower than this reads as a ragged strip of two or three words a line.
 */
export const MIN_MEASURE_CHARS = 28;
/** LH-66: a paragraph shorter than this many lines is a label, which keeps any measure. */
const MEASURE_MIN_LINES = 4;
/** LH-66: what one prose cell under the minimum measure adds to an automatic candidate's score (below an overflow and a small cell). */
const NARROW_MEASURE_PENALTY = 20;
/** A line may exceed its box by this much (reference pixels) before it wraps: the overflow tests already allow it, and an exact fit (a monospace line of 0.6 em cells filling the box) must not wrap one word early on a rounding error. */
const WRAP_TOLERANCE = .01;
/** A line of a greedy wrap, as the balancer reads it: its source range and whether a paragraph (a hard break or the end) follows it. */
interface WrappedLine { start: number; end: number; hard: boolean }
/** A sentence or clause end (with closing marks): a break after it reads better than one in the middle of a phrase. */
const SENTENCE_END = /[.!?\u2026\u3002\uff01\uff1f]["'\u201d\u2019)\]\u00bb]*$/u, CLAUSE_END = /[,;:\u2013\u2014\u060c\u061b\uff0c\u3001\uff1b\uff1a]["'\u201d\u2019)\]\u00bb]*$/u;
/** The balancer reads at most this many words per paragraph; a longer heading keeps its greedy wrap. */
const BALANCE_MAX_WORDS = 48;
/**
 * WI-4 (P15), the `text-wrap: balance` rule for headings. Each wrapped paragraph of a greedy wrap keeps its line count (and so its
 * size); the balancer picks the break set of that many lines that minimizes the variance of the line widths, with a small credit
 * for a line that ends a sentence or a clause, so "A smaller pilot. A clearer decision." breaks after "pilot." and not after "A".
 * Every line stays within `boxWidth`. Returns the word-start offsets that begin a new line, `undefined` when nothing wraps.
 */
function balancedBreaks(text:string,lines:readonly WrappedLine[],widthOf:(start:number,end:number)=>number,boxWidth:number):Set<number>|undefined {
  const forced=new Set<number>();
  const paragraph=(group:readonly WrappedLine[])=>{
    const count=group.length;
    if (count<2) return;
    const from=group[0]!.start,to=group.at(-1)!.end;
    const words=proseWords(text.slice(from,to)).map(word=>({start:from+word.start,end:from+word.end,text:word.text}));
    const total=words.length;
    if (total<count||total>BALANCE_MAX_WORDS) return;
    const cache=new Map<number,number>(),span=(first:number,last:number)=>{
      const key=first*(BALANCE_MAX_WORDS+1)+last;
      let value=cache.get(key);
      if (value===undefined) {value=widthOf(words[first]!.start,words[last-1]!.end);cache.set(key,value);}
      return value;
    };
    const target=span(0,total)/count;
    if (!(target>0)) return;
    const credit=(last:number)=>last>=total?0:SENTENCE_END.test(words[last-1]!.text)?.02:CLAUSE_END.test(words[last-1]!.text)?.01:0;
    // best[line][last]: the least cost of setting words[0, last) in `line` lines.
    const best:number[][]=Array.from({length:count+1},()=>Array<number>(total+1).fill(Infinity)),from_:number[][]=Array.from({length:count+1},()=>Array<number>(total+1).fill(-1));
    best[0]![0]=0;
    for (let line=1;line<=count;line++) for (let last=line;last<=total-(count-line);last++) for (let first=line-1;first<last;first++) {
      const before=best[line-1]![first]!;
      if (before===Infinity) continue;
      const width=span(first,last);
      if (width>boxWidth+WRAP_TOLERANCE) continue;
      const cost=before+((width-target)/target)**2-credit(last);
      if (cost<best[line]![last]!) {best[line]![last]=cost;from_[line]![last]=first;}
    }
    if (best[count]![total]===Infinity) return;
    for (let line=count,last=total;line>1;line--) {const first=from_[line]![last]!;forced.add(words[first]!.start);last=first;}
  };
  let group:WrappedLine[]=[];
  for (const line of lines) {group.push(line);if(line.hard){paragraph(group);group=[];}}
  paragraph(group);
  return forced.size?forced:undefined;
}
/** Whitespace that can hang at a soft line break: every space except the no-break spaces and the zero-width no-break space. */
const HANGING_SPACE = /[^\S\r\n\u00a0\u202f\ufeff]/u;

/** Corpus-calibrated robust advances; see docs/evidence/script-width-estimates/README.md.
 * Shared punctuation and Latin/CJK retain their original widths. These are estimates, not font metrics. */
const SCRIPT_WIDTH_FACTORS: readonly (readonly [RegExp, number])[] = [
  [/\p{Script=Tamil}/u, 1.53], [/\p{Script=Malayalam}/u, 1.76],
  [/\p{Script=Sinhala}/u, 1.44], [/\p{Script=Myanmar}/u, 1.18],
  [/\p{Script=Ethiopic}/u, 1.13], [/\p{Script=Georgian}/u, 1.28],
];

const ZERO_WIDTH_MARK = /\p{Mn}|\p{Me}|\u200d|\ufe0f/u, SPACING_MARK = /\p{Mc}/u;
const LATIN_CJK = /\p{Script=Latin}|\p{Script=Han}|\p{Script=Hangul}|\p{Script=Hiragana}|\p{Script=Katakana}/u;
/** One character's advance in em, or NaN for a mark that takes no space. */
function characterUnits(character: string): number {
  if (ZERO_WIDTH_MARK.test(character)) return Number.NaN;
  // Preserve the pre-0.19 Latin/CJK estimate, including their spacing tone/reading marks.
  if (SPACING_MARK.test(character) && LATIN_CJK.test(character)) return Number.NaN;
  // A no-break space (LH-11: the exporter writes one where a line may not break) is as wide as the space it stands for.
  const base = character === " " || character === "\u00a0" ? 0.32 : /[A-Z0-9]/.test(character) ? 0.62 : character.codePointAt(0)! > 0x2e80 ? 1 : 0.54;
  const factor = SCRIPT_WIDTH_FACTORS.find(([script]) => script.test(character))?.[1] ?? 1;
  return base * factor;
}
// Each character is classified once (the property regexes above used to run for every character of every measured string, and
// the default measurement measures each string many times while text is fitted): ASCII from a table, the rest from a bounded cache.
const ASCII_UNITS = Array.from({ length: 128 }, (_, code) => characterUnits(String.fromCharCode(code)));
const characterUnitCache = new Map<string, number>();
const CHARACTER_UNIT_CACHE_LIMIT = 65536;

/** Deterministic estimate, not a font shaping engine. Spacing marks outside Latin/CJK contribute; nonspacing/enclosing marks do not. */
export function measureText(text: string, fontSize: number): number {
  let units = 0;
  for (const character of text) {
    const code = character.charCodeAt(0);
    let advance = code < 128 ? ASCII_UNITS[code] : characterUnitCache.get(character);
    if (advance === undefined) {
      advance = characterUnits(character);
      if (characterUnitCache.size < CHARACTER_UNIT_CACHE_LIMIT) characterUnitCache.set(character, advance);
    }
    if (!Number.isNaN(advance)) units += advance;
  }
  return units * fontSize;
}
const MONOSPACE_FAMILY = /\bmono\b|monospace|\bcourier\b|\bconsolas\b|\bmenlo\b/i;
/** Whether the first family of a font stack is a monospace face (the generic `monospace`, or a family named as one). */
function isMonospaceFamily(family: string | undefined): boolean {
  const first = family?.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '');
  return first !== undefined && MONOSPACE_FAMILY.test(first);
}
/** The default estimate for a monospace face: 0.6 em per ASCII character, the proportional estimate for the rest. */
export function measureMonospaceText(text: string, fontSize: number): number {
  let width = 0;
  for (const character of text) width += character.charCodeAt(0) < 128 ? 0.6 * fontSize : measureText(character, fontSize);
  return width;
}
export function wrapText(text: string, width: number, fontSize: number, measure: MeasureTextWidth = measureText): string[] {
  return fitSourceText(text,{x:0,y:0,width,height:Number.MAX_VALUE},fontSize,fontSize,1,measure,true,false).lines;
}
export function fitText(text: string, box: LayoutBox, requestedSize = PROSE_NOMINAL_SIZE, minFontSize = 16, measure: MeasureTextWidth = measureText, direction?: TextDirection, balance = false): SourceTextFit {
  if (![box.width, box.height, requestedSize, minFontSize].every(Number.isFinite) || box.width <= 0 || box.height <= 0 || requestedSize <= 0 || minFontSize <= 0) {
    throw new RangeError("Text dimensions and font sizes must be finite and positive.");
  }
  return fitSourceText(text,box,Math.max(requestedSize,minFontSize),minFontSize,1,measure,true,true,direction,balance);
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
  /** Measured vertical content envelope at the allocated width, including the photo. */
  bounds: LayoutBox;
  algorithm: 'quote-flow-v1';
  textMeasurement: 'estimated' | 'provided';
  parts: QuoteTextPart[];
  /** Present when the quote has a photo; absent otherwise, and then the layout is the footer-only layout. */
  photo?: QuotePhoto;
  /**
   * LH-114: the accent rule over a pull line (`pull`): QUOTE_PULL_RULE reference pixels at the start edge, drawn in the deck's primary
   * color by both engines. Absent for every other quote.
   */
  rule?: LayoutBox;
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
  /** BCP-47 tag of the deck language: it picks the quotation marks (`quoteMarksFor`). Without one the marks are English (“…”). */
  language?: string;
  /**
   * LH-40: lay out a part that has no usable space at the readability floor in the room its cell leaves (`floorRoom`), so engines draw
   * it, overflowing, instead of failing the export. Its `invalid-part-box` finding, the other diagnostics and `bounds` stay those of the
   * layout without it, and a strict (`overflow: 'error'`) layout still throws first. composeSlide sets it on the layout it accepts only:
   * candidates are scored, and a card's inset is given up, by the parts that found no room.
   */
  floorFallback?: boolean;
  /**
   * LH-48: a factor of at least 1 on the role sizes of a lone block that fills too little of the body (composeSlide picks it on the type
   * scale's ratio). Each role grows by it up to its display size (`LONE_DISPLAY_SIZES`) and never shrinks; absent or 1, the role sizes.
   */
  growth?: number;
}
/**
 * LH-48: the largest size, in reference pixels, a role of a lone block grows to (`growth`): text one and a half times its role size,
 * still under the title's 54; a list, a quote, code and a metric's parts by about as much. LH-101: a lone metric's value grows to its
 * display size, about three times its role size (Claude Design draws a lone figure at about 230 px).
 */
export const LONE_DISPLAY_SIZES = { text: 43, list: 37, table: 32, quote: 56, quoteFooter: 24, code: 32, codeHeader: 18, value: 232, unit: 28, label: 28, delta: 28, description: 22, trend: 20 } as const;
/**
 * LH-48: a body under LONE_FILL of its height at its role sizes grows, to at most LONE_TARGET of it. LH-101: a lone metric, whose value is
 * one short line, grows to at most LONE_METRIC_TARGET.
 */
export const LONE_FILL = .5, LONE_TARGET = .6, LONE_METRIC_TARGET = .8;
/** LH-48: a role size grown by `growth` (at least 1), capped at its display size; a role already larger keeps its size. */
function grownRoleSize(size: number, growth: number | undefined, display: number): number {
  const factor = growth !== undefined && Number.isFinite(growth) && growth > 1 ? growth : 1;
  return Math.max(size, Math.min(size * factor, display));
}
/**
 * LH-78: how large a quote's body starts. Composition sets them; the default is the display size (QUOTE_NOMINAL_SIZE) with no line
 * limit, as before.
 */
export interface QuoteBodyOptions extends QuoteLayoutOptions {
  /** The body's starting size in reference pixels, before canvas scaling (LEAD_NOMINAL_SIZE for a quote beside other blocks). */
  bodySize?: number;
  /**
   * The most lines the body may take across the quote's width: its starting size steps down until it does, but never below the body
   * text size (PROSE_NOMINAL_SIZE) or the readability floor, so a long quote is never set smaller than the text beside it; the body
   * then fits its box from there as usual.
   */
  bodyLines?: number;
  /**
   * LH-114: lay the quote out as a pull line across its box: an accent rule (`rule`), the body under it with no card inset, and one
   * caption line "— Name, Role" (the source after an en dash) under the body. The body is set in the regular weight, as a lead.
   * Composition sets it for a short quote under or over data.
   */
  pull?: boolean;
}
/** LH-78: a quote beside other blocks starts at the lead size and fits in this many lines. */
const QUOTE_BESIDE_LINES = 4;
/** LH-114: a pull line's accent rule (width and height) and its gaps under the rule and under the body, in reference pixels. */
export const QUOTE_PULL_RULE = { width: 80, height: 6 } as const;
const QUOTE_PULL_GAPS = { rule: 16, body: 10 } as const;
/** LH-114: what opens a pull line's caption, and what joins the role to the name there (the source still follows an en dash). */
export const QUOTE_PULL_PREFIX = '— ', QUOTE_PULL_ROLE_SEPARATOR = ', ';
/** LH-114: a pull line's body takes at most this many lines; composition keeps the card for a quote that needs more. */
export const QUOTE_PULL_LINES = 2;
/**
 * LH-40: the room a part that found no usable space is drawn in at the readability floor: its own box moved into the cell, down to the
 * cell's foot, with the cell's width when it has none of its own. Its text overflows this room; the finding says so.
 */
function floorRoom(area: LayoutBox, cell: LayoutBox): LayoutBox {
  const wide = Number.isFinite(area.x) && Number.isFinite(area.width) && area.width > 0;
  const y = Number.isFinite(area.y) ? Math.min(Math.max(area.y, cell.y), cell.y + cell.height) : cell.y;
  return { x: wide ? area.x : cell.x, y, width: wide ? area.width : cell.width, height: cell.y + cell.height - y };
}
/** The displayed runs of a rich quote body: the quotation marks join the first and last run. */
function quoteBodyRuns(runs: readonly (string | RichTextRun)[], marks: QuoteMarks): (string | RichTextRun)[] {
  if (!runs.length) return [marks.open + marks.close];
  const last = runs.length - 1;
  return runs.map((run, index) => {
    const before = index === 0 ? marks.open : '', after = index === last ? marks.close : '';
    return typeof run === 'string' ? before + run + after : {...run, text: before + run.text + after};
  });
}
/**
 * Allocate and measure quote body/footer space for composition, rendering and export. Callers must
 * check overflow before accepting the parts. Line boxes are not shaped glyph or native raster bounds.
 */
export function layoutQuote(value: string | QuoteContent, box: LayoutBox, options: QuoteBodyOptions = {}): QuoteLayout {
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
  // Footer lines: the attribution, the role on its own line below it, and the source after an en dash on the last line. A pull line
  // (LH-114) sets them as one caption: "— Name, Role – Source".
  const pull = options.pull === true && quote.photo === undefined;
  let footer = '';
  const footerSources:QuoteTextSource[] = [];
  for (const field of ['attribution','role','source'] as const) {
    const text = quote[field];
    if (!text) continue;
    if (footer) footer += field === 'role' ? pull ? QUOTE_PULL_ROLE_SEPARATOR : '\n' : QUOTE_SOURCE_SEPARATOR;
    else if (pull) footer = QUOTE_PULL_PREFIX;
    footerSources.push(source(`${path}.${field}`,text,footer.length));
    footer += text;
  }
  const hasPhoto = photoValue !== undefined, hasFooter = footer !== '', hasBlock = hasPhoto || hasFooter;
  const photoPath = `${path}.photo`, rtl = options.direction === 'rtl';
  const bodyPath = shorthand ? path : `${path}.text`;
  // WI-4 (P17): the body asks for the quote role size and fits down; the marks are the deck language's typographic pair.
  const marks = quoteMarksFor(options.language);
  const body = add('body',`${marks.open}${quoteText}${marks.close}`,[source(bodyPath,quoteText,marks.open.length)],
    {x:box.x+18,y:box.y+18,width:box.width-36,height:box.height-(hasBlock?94:36)},
    options.bodySize ?? grownRoleSize(QUOTE_NOMINAL_SIZE,options.growth,LONE_DISPLAY_SIZES.quote),options.fontFamilies?.accent??options.fontFamilies?.heading??'sans-serif',pull?400:600,bodyPath,richBody?quoteBodyRuns(richBody,marks):undefined);
  const footerSize = grownRoleSize(17,options.growth,LONE_DISPLAY_SIZES.quoteFooter);
  const attribution = hasFooter ? add('footer',footer,footerSources,
    {x:box.x+18,y:box.y+box.height-58,width:box.width-36,height:40},
    footerSize,options.fontFamilies?.body??'sans-serif',500,path) : undefined;
  // A photo with no footer text still sizes from the nominal footer size.
  const footerRequested = attribution?.requestedFontSize ?? gridFontSize(footerSize * scale, minimum);
  const usable = (area:LayoutBox) => [area.x,area.y,area.width,area.height].every(Number.isFinite) && area.width>0 && area.height>0;
  // A rich body fits through the rich-text layouter (the one body text uses); every other part keeps the plain fitter.
  const fit = (part:QuoteTextPart,area:LayoutBox,size=part.requestedFontSize,floor=minimum):TextFit|RichTextFit|undefined => !usable(area) ? undefined
    : part.runs ? fitRichText(part.runs,area,size,floor,{style:part.style,textMeasurement:options.textMeasurement,...(options.citationMarker?{citationMarker:options.citationMarker}:{}),...(options.direction?{direction:options.direction}:{})})
    : fitText(part.text,area,size,floor,textWidthMeasurer(part.style,options.textMeasurement),options.direction);
  const heightOf = (fit:TextFit|RichTextFit) => 'richLines' in fit ? (fit as RichTextFit).height : fit.lines.length*fit.lineHeight;
  // LH-114: a pull line has no card inset; its body runs under the rule across the whole box.
  const ruleHeight = QUOTE_PULL_RULE.height * scale, ruleGap = QUOTE_PULL_GAPS.rule * scale;
  const inner = pull ? {x:box.x,y:box.y+ruleHeight+ruleGap,width:box.width,height:box.height-ruleHeight-ruleGap} : {x:box.x+18,y:box.y+18,width:box.width-36,height:box.height-36};
  // LH-78: the body's starting size steps down, one reference pixel at a time, until it takes at most `bodyLines` lines across the
  // quote's width, down to the body text size; a body that needs more there starts there.
  if (options.bodyLines !== undefined && usable({...inner,height:1e6})) {
    const lowest = Math.min(body.requestedFontSize, gridFontSize(PROSE_NOMINAL_SIZE * scale, minimum));
    const linesAt = (size:number) => { const trial = fit(body,{...inner,height:1e6},size,size)!; return 'richLines' in trial ? (trial as RichTextFit).richLines.length : trial.lines.length; };
    while (body.requestedFontSize > lowest && linesAt(body.requestedFontSize) > options.bodyLines) body.requestedFontSize = gridFontSize(Math.max(lowest, body.requestedFontSize - scale), minimum);
  }
  let photo: QuotePhoto | undefined, photoFits = true, rule: LayoutBox | undefined;
  if (pull) {
    // LH-114: the rule at the start edge, the body under it, and the caption one gap under the body's last line. Each part fits its own
    // room in the box; a box too short for them overflows with the usual findings below.
    rule = {x:rtl?box.x+box.width-QUOTE_PULL_RULE.width*scale:box.x,y:box.y,width:QUOTE_PULL_RULE.width*scale,height:ruleHeight};
    const caption = attribution ? fit(attribution,{...inner,height:1e6},attribution.requestedFontSize,attribution.requestedFontSize) : undefined;
    const captionHeight = caption ? heightOf(caption) : 0, bodyGap = attribution ? QUOTE_PULL_GAPS.body * scale : 0;
    body.box = {...inner,height:Math.max(0,inner.height-captionHeight-bodyGap)};
    body.fit = fit(body,body.box);
    if (body.fit && attribution) {
      const bodyBottom = body.box.y + (body.fit.placement?.height ?? heightOf(body.fit));
      attribution.box = {...inner,y:bodyBottom+bodyGap,height:Math.max(0,inner.y+inner.height-bodyBottom-bodyGap)};
      attribution.fit = fit(attribution,attribution.box);
    }
    if (body.fit && !body.fit.overflow) body.box.height = body.fit.placement?.height ?? heightOf(body.fit);
  } else if (!hasBlock) body.fit=fit(body,body.box);
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
  // A successful quote is one compact editorial unit, not a body at the top and attribution at the bottom.
  // Keep failed allocations intact so readability-floor/overlap diagnostics retain their original evidence.
  // A pull line (LH-114) already placed its caption one gap under the body.
  if (!pull && body.fit && !body.fit.overflow && photoFits && (!attribution || attribution.fit && !attribution.fit.overflow)) {
    body.box.height = body.fit.placement?.height ?? heightOf(body.fit);
    const footerTop = body.box.y + body.box.height + 18;
    const previousTop = Math.min(attribution?.box.y ?? Infinity, photo?.box.y ?? Infinity);
    if (Number.isFinite(previousTop)) {
      const shift = footerTop - previousTop;
      if (attribution) { attribution.box.y += shift; attribution.fit = translateTextFit(attribution.fit!, shift); }
      if (photo) { photo.box.y += shift; photo.shape = imageShape('circle', photo.box); }
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
  const occupiedParts = parts.filter(part => part.fit).map(part => ({...part.box, height:part.fit!.placement?.height ?? heightOf(part.fit!)}));
  if (photo) occupiedParts.push(photo.box);
  if (rule) occupiedParts.push(rule);
  const bottom = Math.max(box.y, ...occupiedParts.map(area => area.y + area.height));
  const bounds = {x:box.x,y:box.y,width:box.width,height:bottom-box.y};
  // LH-40: a part with no room is set at the floor in what its cell leaves; it overflows, and its finding above stands.
  if (options.floorFallback) for (const part of parts) if (!part.fit) {
    const room = floorRoom(part.box, box), floorFit = fit(part, {...room, height:Math.max(room.height, minimum*1.22)}, minimum, minimum);
    if (floorFit) { part.box = room; part.fit = {...floorFit, overflow:true}; }
  }
  return {bounds,algorithm:'quote-flow-v1',textMeasurement:options.textMeasurement?'provided':'estimated',parts,...(photo?{photo}:{}),...(rule?{rule}:{}),diagnostics,overflow:diagnostics.length>0};
}

export interface MetricContent {
  value: string | number;
  label?: string;
  description?: string;
  unit?: string;
  delta?: string | number;
  trend?: 'up' | 'down' | 'flat';
  /** Whether the change is good news; colors the trend arrow and the delta text (see metricTrendColor). */
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
  /** Measured vertical value/metadata envelope at the allocated width. */
  bounds: LayoutBox;
  algorithm: 'metric-flow-v1';
  alignment: 'left' | 'center' | 'right';
  textMeasurement: 'estimated' | 'provided';
  /** `band` (LH-15): the value at the start edge and the other fields in a column beside it, for a wide, short cell. */
  arrangement: 'inline-unit' | 'stacked' | 'band';
  /** The metric's `sentiment`, passed through for metricTrendMark; omitted when the content has none. */
  sentiment?: MetricSentiment;
  /**
   * LH-53: the box of the trend arrow, square and on the baseline of its line: before the first line of the delta (at the reading start: the
   * left, or the right in a right-to-left metric), or of the label, then the description, when the metric has no delta; on a line of its own
   * when it has none of them. The trend word is not drawn (its part is not `visible`); it stays the arrow's text alternative
   * (metricTrendMark). Absent without a trend.
   */
  trendBox?: LayoutBox;
  /** LH-112: the value asked for a display size (`display`), not its role size. */
  display?: true;
  /** At most 48 arrangements; value fitting is bounded by 77 reference-size trials per arrangement. */
  attempts: number;
  parts: MetricTextPart[];
  diagnostics: MetricLayoutDiagnostic[];
  overflow: boolean;
}
export interface MetricLayoutOptions extends QuoteLayoutOptions {
  /** Horizontal alignment of the complete metric; defaults to center. */
  align?: 'left' | 'center' | 'right';
  /** Unscaled clearance around available vector outlines; defaults to one reference pixel. */
  textRasterPadding?: number;
  /**
   * LH-43: starting sizes in canvas pixels by role, used where smaller than the role size, so sibling metrics can share the smallest
   * sizes any of them fitted at. Each role still fits down from its start to the readability floor.
   */
  roleSizes?: Partial<Record<MetricTextRole, number>>;
  /**
   * LH-68: lay the metric out as a tile of its whole box (a scorecard card): the label first as an eyebrow, the value under it asking for
   * METRIC_TILE_VALUE_SHARE of the box's height (between its role size and twice it), a stacked unit under the value, and the description,
   * delta and trend at the foot of the box. Pass the start alignment (`align: 'left'`).
   */
  tile?: boolean;
  /**
   * LH-68: the smallest size of each role in canvas pixels (composition passes a tile the sizes its metric fitted at as a stack): a role starts
   * at least there and fits down no further; a part that does not fit at it overflows.
   */
  minimumSizes?: Partial<Record<MetricTextRole, number>>;
  /**
   * LH-112: the value's display size, in reference pixels, for a metric that shares the body with other blocks: it starts at `start` and
   * grows toward `max` while its one line stays within METRIC_DISPLAY_WIDTH of the box's width and its line height within
   * METRIC_DISPLAY_HEIGHT of `height` (canvas pixels: the cell or body it shares; the box's height when absent). It replaces the value's
   * role size and still fits down to the readability floor.
   */
  display?: { start: number; max: number; height?: number };
  /** LH-15: lay the metric out as a band (the value at the start, the other fields in a column beside it) when that fits; start-aligned. */
  band?: boolean;
  /**
   * LH-39: a value of one word (a figure such as "$1.24M") never wraps: it is set on one line at the largest size that holds it, not split
   * inside the figure at a larger size. Default true; composition passes false for a slide's composition without its guarded rules.
   */
  figure?: boolean;
}
/**
 * LH-17: the largest size of the type scale at or under `size` (canvas px), the scale rising from the floor (reference px) by
 * TYPE_SCALE_RATIO, rounded to whole reference pixels (see composeSlide's scaleSizes).
 */
const TYPE_SCALE_RATIO = (PROSE_NOMINAL_SIZE / 16) ** .25;
function typeScaleStep(size: number, floorPx: number, scale: number): number {
  let step = snapFontSizeUp(floorPx * scale);
  for (let power = 1; ; power++) {
    const next = snapFontSizeDown(Math.round(floorPx * TYPE_SCALE_RATIO ** power) * scale);
    if (next > size + 1e-9) return step;
    step = Math.max(step, next);
  }
}
/** LH-39: the metric layouts that set a figure on one line where it would have wrapped (the guarded rule `metric-figure`). */
const FIGURE_LINES = new WeakSet<MetricLayout>(), FIGURE_FITS = new WeakSet<CodeTextFit>();
/** LH-68: the share of a tile's height its value asks for (Claude Design's scorecard values are about a quarter of the card). */
export const METRIC_TILE_VALUE_SHARE = 0.25;
/**
 * LH-112: a value at display size keeps its one line within this share of its box's width, and its line height within this share of the
 * box's height (Claude Design draws a metric beside a chart or a paragraph at 120 to 160 px, about a third of its cell tall).
 */
export const METRIC_DISPLAY_WIDTH = .9, METRIC_DISPLAY_HEIGHT = .4;
/** A metric value's role size in reference pixels (WI-1). */
export const METRIC_ROLE_VALUE_SIZE = 76;
/** LH-15: a band's value takes at most this share of the width, and the column beside it at least METRIC_BAND_MIN_COLUMN reference px. */
export const METRIC_BAND_VALUE_SHARE = .6, METRIC_BAND_MIN_COLUMN = 200;
/** LH-15: composition draws a metric at display size as a band in a cell at least this many times as wide as it is tall. */
export const METRIC_BAND_RATIO = 3;
/** LH-53: a unit on its value's line is drawn at this share of the value's size (Claude Design sets "18%" as one figure). */
export const METRIC_UNIT_SHARE = .6;
/** LH-127: the gap between an inline unit and its value, as a share of the value's size (a figure and its unit read as one, not touching). */
export const METRIC_UNIT_GAP = .12;
/**
 * LH-127: the advance in em of the characters a figure is written in, in a heavy sans face: the widest of Roboto, Arial and Calibri at
 * weight 800, which is narrower than core's portable estimate for a digit (.62) and much narrower for a separator (.54). Without a host
 * measurement an inline unit is placed after the figure by this table, so it does not float in the estimate's slack. A character of
 * another kind (a letter, a percent sign, a script) is not in the table and keeps the estimate.
 */
const FIGURE_ADVANCES: Readonly<Record<string, number>> = {
  ...Object.fromEntries([...'0123456789$€£¥+−'].map(character => [character, .58])), '.': .3, ',': .3, '-': .42, ' ': .32,
};
function figureWidth(text: string, size: number): number | undefined {
  let units = 0;
  for (const character of text) { const advance = FIGURE_ADVANCES[character]; if (advance === undefined) return undefined; units += advance; }
  return units * size;
}
/**
 * LH-112: the display size of a metric beside other blocks, in reference pixels: one metric starts at 120 and grows to 160, two start at 90
 * and grow to 120 (layoutMetric's `display`).
 */
export const METRIC_DISPLAY_SIZES = { one: { start: 120, max: 160 }, two: { start: 90, max: 120 } } as const;

/**
 * Measure every metric field before accepting geometry. Short single-line values and units can
 * share a baseline; longer values or units stack. No locale formatting or rewritten source text is
 * invented here. LH-53: the trend is drawn as an arrow, not as its word (an English word, which also
 * showed on right-to-left slides): the arrow sits before the delta on one line ("↑ +7 pts"), or on a
 * line of its own without a delta (`trendBox`), and the trend part keeps its source text as the
 * arrow's text alternative (metricTrendMark). Consumers must reuse these accepted parts and source ranges.
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
  // LH-15: a band is start-aligned.
  const requestedAlignment=options.band?'left':options.align??'center';
  if (!['left','center','right'].includes(requestedAlignment)) throw new RangeError('Invalid metric alignment.');
  const sourcePath=options.path??'metric',parts:MetricTextPart[]=[],diagnostics:MetricLayoutDiagnostic[]=[];
  for (const role of ['value','unit','label','description','delta','trend'] as const) {
    const sourceValue=metric[role];
    if (sourceValue===undefined) continue;
    const text=String(sourceValue),path=scalar?sourcePath:`${sourcePath}.${role}`;
    // WI-1: the value asks for its role size (76 px) whatever the box; the box only limits it, and fitValue fits it down on overflow.
    // LH-68: a tile's value asks for METRIC_TILE_VALUE_SHARE of the tile, between its role size and twice it. LH-48: a lone metric grows.
    const valueSize=options.tile?Math.min(152,Math.max(76,box.height*METRIC_TILE_VALUE_SHARE/scale)):76;
    const least=snapFontSizeUp(Math.max(minimum,options.minimumSizes?.[role]??0));
    const nominal=Math.max(Math.min(grownRoleSize(role==='value'?valueSize:role==='description'?20:role==='trend'?18:23,options.growth,LONE_DISPLAY_SIZES[role])*scale,options.roleSizes?.[role]??Infinity),least);
    const requestedStyle:TextStyle={fontFamily:(role==='value'?options.fontFamilies?.heading:options.fontFamilies?.body)??'sans-serif',fontWeight:role==='value'?800:role==='description'?400:500,italic:false,path};
    const part:MetricTextPart={role,path,text,sources:[{path,value:sourceValue,start:0,end:text.length}],visible:role==='value'||text.length>0,linePositions:[],
      box:{...box,height:0},requestedFontSize:gridFontSize(nominal,least),minFontSize:least,requestedStyle,style:resolveTextStyle({...requestedStyle},options.textMeasurement)};
    if (!part.visible) part.fit={lines:[],sourceLines:[],fontSize:part.requestedFontSize,lineHeight:part.requestedFontSize*1.22,tabSize:4,tabWidth:0,overflow:false};
    parts.push(part);
  }
  // LH-53: the trend takes no line of its own: its arrow sits before the delta, else the label, else the description (the host), which is
  // measured that much narrower (arrowRoom).
  const trendPart=parts.find(part=>part.role==='trend'),arrowHost=trendPart?(['delta','label','description'] as const).map(role=>parts.find(part=>part.role===role&&part.visible)).find(Boolean):undefined;
  const primary=parts[0]!,metadata=parts.filter(part=>part!==primary&&part.visible&&!(part===trendPart&&arrowHost)),unit=metadata.find(part=>part.role==='unit');
  // Logical alignment (RR-05): in a right-to-left deck a metric whose own text is right-to-left starts at the right edge.
  const metricDirection:TextDirection|undefined=options.direction==='rtl'?paragraphDirection((['label','description','unit'] as const).map(role=>parts.find(part=>part.role===role)?.text).find(Boolean)??primary.text,'rtl'):undefined;
  const alignment=physicalAlignment(requestedAlignment,metricDirection);
  // The arrow goes before the delta in reading order: on its left, or on its right in a right-to-left metric.
  const arrowLeft=metricDirection!=='rtl',arrowRoom=(size:number)=>size*(METRIC_TREND_ARROW_SIZE+METRIC_TREND_ARROW_GAP);
  const lineBox=(part:MetricTextPart,area:LayoutBox,y:number,height:number,size:number):LayoutBox=>part===arrowHost
    ?{x:arrowLeft?area.x+arrowRoom(size):area.x,y,width:Math.max(Number.MIN_VALUE,area.width-arrowRoom(size)),height}:{...area,y,height};
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
  // LH-112: a value at display size grows from display.start toward display.max, in 4 px steps, while its line height keeps within
  // METRIC_DISPLAY_HEIGHT of the reference height (display.height, else the box's) and its one line within METRIC_DISPLAY_WIDTH of the
  // box's width. At or under its start it keeps one line: the largest size down to the role size at which it does (a figure does not wrap).
  if (options.display&&!options.tile) {
    const start=Math.min(options.display.start,options.display.max),reference=options.display.height??box.height,role=METRIC_ROLE_VALUE_SIZE;
    const oneLine=(size:number)=>{
      const fit=measure(primary,gridFontSize(size*scale,primary.minFontSize),box.width);
      return fit.lines.length===1&&naturalWidth(primary,fit)<=METRIC_DISPLAY_WIDTH*box.width+.01;
    };
    let size:number|undefined;
    for (let next=options.display.max;next>start+1e-9&&size===undefined;next-=4) if (next*scale*1.22<=METRIC_DISPLAY_HEIGHT*reference+.01&&oneLine(next)) size=next;
    for (let next=start;next>role+1e-9&&size===undefined;next-=4) if (oneLine(next)) size=next;
    primary.requestedFontSize=gridFontSize(Math.max(Math.min((size??role)*scale,options.roleSizes?.value??Infinity),primary.minFontSize),primary.minFontSize);
  }
  const fitValue=(area:LayoutBox,singleLine:boolean)=>{
    if (!usable(area)) return undefined;
    const attempt=(strict:boolean,scaled=false)=>{
      // Derive sizes from the requested size: repeated subtraction accumulates rounding
      // error and can add an extra trial at very small floors. LH-39: a figure set on one line steps down the type scale instead.
      const sizes:number[]=[];
      if (scaled) for (let size=primary.requestedFontSize;;size=typeScaleStep(size-1e-6,primary.minFontSize/scale,scale)) { sizes.push(size); if (size<=primary.minFontSize+1e-9) break; }
      else for (let step=0,steps=Math.max(76,Math.ceil((primary.requestedFontSize-primary.minFontSize)/scale));step<=steps;step++) sizes.push(gridFontSize(primary.requestedFontSize-step*scale,primary.minFontSize));
      for (const size of sizes) {
        const natural=measure(primary,size,area.width);
        const fit={...natural,overflow:!!natural.placement?.overflow||strict&&natural.lines.length!==1||occupied(natural)>area.height+.01||natural.sourceLines.some(line=>line.width>area.width+.01)};
        if (!fit.overflow||size===sizes[sizes.length-1]) return fit;
      }
    };
    // LH-39: a figure (a value of one word, "$1.24M") never wraps: it is set on one line at the largest size of the type scale that holds it, which a split
    // inside the figure ("$1.24" over "M") would otherwise beat by a larger size. When no size down to the floor holds it on one line, the
    // wrapped fit stands, as before. A value of several words ("Q4 2026 plan") may still wrap between words.
    if (options.figure!==false&&!singleLine&&!/\s/u.test(primary.text.trim())) {
      const whole=attempt(true,true);
      if (whole&&!whole.overflow) { if (attempt(false)?.lines.length!==1) FIGURE_FITS.add(whole); return whole; }
    }
    return attempt(singleLine);
  };
  type Allocation={part:MetricTextPart;box:LayoutBox;fit:CodeTextFit|undefined};
  type Candidate={arrangement:MetricLayout['arrangement'];allocations:Allocation[];score:number;overflow:boolean};
  let selected:Candidate|undefined,attempts=0;
  const reductions=Math.min(23,Math.ceil(Math.max(0,...metadata.map(part=>(part.requestedFontSize-part.minFontSize)/scale))));
  for (let reduction=0;reduction<=reductions;reduction++) {
    const measureAt=(width:number)=>new Map(metadata.map(part=>{
      const size=gridFontSize(part.requestedFontSize-reduction*scale,part.minFontSize);
      return [part,measure(part,size,part===arrowHost?Math.max(Number.MIN_VALUE,width-arrowRoom(size)):width)] as const;
    }));
    const measured=measureAt(box.width);
    const measuredUnit=unit?measured.get(unit):undefined;
    const unitWidth=unit&&measuredUnit?naturalWidth(unit,measuredUnit):0;
    const unitFit=unit&&measuredUnit&&unitWidth>0?place(unit,measuredUnit,unitWidth):measuredUnit;
    const inline=unitFit?.lines.length===1&&unitWidth>0&&unitWidth<=box.width*.35&&unitWidth+gap<box.width;
    for (const arrangement of [...(options.band?['band']:[]),...(inline?['inline-unit','stacked']:['stacked'])] as MetricLayout['arrangement'][]) {
      // LH-15: a band that fits is kept.
      if (arrangement!=='band'&&selected?.arrangement==='band'&&!selected.overflow) continue;
      attempts++;
      if (arrangement==='band') {
        // LH-15: the value at the start edge, at most METRIC_BAND_VALUE_SHARE of the width, and the other fields in a column beside it, the
        // two centered on the band's height.
        const share={...box,width:box.width*METRIC_BAND_VALUE_SHARE},valueFit=fitValue(share,true);
        const valueWidth=valueFit?Math.min(share.width,naturalWidth(primary,valueFit)||valueFit.fontSize):0,columnWidth=box.width-valueWidth-2*primaryGap;
        if (!valueFit||columnWidth<METRIC_BAND_MIN_COLUMN*scale) continue;
        const column=measureAt(columnWidth),valueHeight=occupied(valueFit),startLeft=alignment!=='right';
        const columnHeight=metadata.reduce((sum,part)=>sum+occupied(column.get(part)!),0)+Math.max(0,metadata.length-1)*gap,height=Math.max(valueHeight,columnHeight);
        if (!Number.isFinite(columnHeight)) throw new RangeError('Metric metadata exceeds finite coordinates.');
        const columnArea={...box,x:startLeft?box.x+valueWidth+2*primaryGap:box.x,width:columnWidth};
        const allocations:Allocation[]=[{part:primary,box:{x:startLeft?box.x:box.x+box.width-valueWidth,y:box.y+(height-valueHeight)/2,width:valueWidth,height:valueHeight},fit:place(primary,valueFit,valueWidth)}];
        let y=box.y+(height-columnHeight)/2;
        for (const part of metadata) {
          const natural=column.get(part)!,lineHeight=occupied(natural),area=lineBox(part,columnArea,y,lineHeight,natural.fontSize);
          allocations.push({part,box:area,fit:{...natural,overflow:!!natural.placement?.overflow||natural.sourceLines.some(line=>line.width>area.width+.01)}});
          y+=lineHeight+gap;
        }
        const overflow=valueFit.overflow||height>box.height+.01||allocations.some(({box:area,fit})=>!fit||fit.overflow||!usable(area));
        const score=allocations.reduce((sum,{part,fit})=>sum+Math.max(0,part.requestedFontSize-(fit?.fontSize??minimum))/scale,0);
        if (!overflow||!selected) selected={arrangement,allocations,score,overflow};
        continue;
      }
      // LH-68: a tile leads with its label (the eyebrow), each lead part a gap above the next.
      const lead=options.tile?metadata.filter(part=>part.role==='label'):[];
      const tail=metadata.filter(part=>(arrangement!=='inline-unit'||part!==unit)&&!lead.includes(part));
      const tailHeight=tail.reduce((sum,part)=>sum+occupied(measured.get(part)!),0)+Math.max(0,tail.length-1)*gap;
      const leadHeight=lead.reduce((sum,part)=>sum+occupied(measured.get(part)!)+gap,0),top=box.y+leadHeight;
      if (!Number.isFinite(tailHeight)||!Number.isFinite(leadHeight)) throw new RangeError('Metric metadata exceeds finite coordinates.');
      const area={...box,y:top,width:arrangement==='inline-unit'?box.width-unitWidth-gap:box.width,height:box.height-leadHeight-tailHeight-(tail.length?primaryGap:0)};
      const valueFit=fitValue(area,arrangement==='inline-unit'),valueHeight=valueFit?occupied(valueFit):0;
      const allocations:Allocation[]=[];
      let leadY=box.y;
      for (const part of lead) { const natural=measured.get(part)!,height=occupied(natural),area=lineBox(part,box,leadY,height,natural.fontSize); allocations.push({part,box:area,fit:{...natural,overflow:!!natural.placement?.overflow||natural.sourceLines.some(line=>line.width>area.width+.01)}}); leadY+=height+gap; }
      let primaryHeight=valueHeight;
      if (arrangement==='inline-unit'&&unit&&unitFit&&valueFit) {
        // LH-127: the unit follows the value line as it is drawn. With a host measurement that is the measured line (its ink, with an
        // outline measure). Without one the portable estimate is slack for a figure (about a fifth too wide for "2.4"), which left the unit
        // floating a few characters away at display size: a figure is then measured by FIGURE_ADVANCES, and its line takes that width, so
        // an engine that centers or ends the line on its accepted width draws it where the unit expects it.
        let figureFit=valueFit;
        if (!options.textMeasurement&&valueFit.lines.length===1) {
          const width=figureWidth(primary.text,valueFit.fontSize);
          if (width!==undefined&&width<naturalWidth(primary,valueFit)) figureFit={...valueFit,sourceLines:valueFit.sourceLines.map(line=>({...line,width,segments:line.segments.map(segment=>({...segment,width:segment.kind==='text'?width:segment.width}))}))};
        }
        const measuredWidth=naturalWidth(primary,figureFit);
        const valueWidth=Math.min(area.width,measuredWidth||valueFit.fontSize);
        // LH-53: a unit beside its value is drawn at METRIC_UNIT_SHARE of the value's size on its baseline, so "18 %" reads as one figure,
        // when it still fits on the line; otherwise at its own size.
        let inlineFit=unitFit,inlineWidth=unitWidth;
        // In whole points of the reference size, so the size is on the font grid at every canvas scale.
        const unitSize=gridFontSize(Math.round(METRIC_UNIT_SHARE*valueFit.fontSize/scale*.75)/.75*scale,unit.minFontSize);
        if (unitSize>unitFit.fontSize+1e-9) {
          const natural=measure(unit,unitSize,box.width),width=naturalWidth(unit,natural);
          if (natural.lines.length===1&&width>0&&valueWidth+gap+width<=box.width+.01) { inlineFit=place(unit,natural,width); inlineWidth=width; }
        }
        // LH-127: the gap before the unit is METRIC_UNIT_GAP of the value's size, at least the metadata gap, and no more than the line has
        // left (the fit above reserved only the metadata gap, so the value keeps the size it had).
        const unitGap=Math.max(gap,Math.min(METRIC_UNIT_GAP*valueFit.fontSize,box.width-valueWidth-inlineWidth));
        const valueBaseline=valueFit.placement?.lines.at(-1)?.baseline??valueHeight-valueFit.lineHeight+valueFit.fontSize;
        const unitBaseline=inlineFit.placement?.lines.at(-1)?.baseline??occupied(inlineFit)-inlineFit.lineHeight+inlineFit.fontSize;
        const valueY=top+Math.max(0,unitBaseline-valueBaseline),unitY=top+Math.max(0,valueBaseline-unitBaseline);
        allocations.push({part:primary,box:{...area,y:valueY,width:valueWidth,height:valueHeight},fit:place(primary,figureFit,valueWidth)});
        allocations.push({part:unit,box:{x:box.x+valueWidth+unitGap,y:unitY,width:inlineWidth,height:occupied(inlineFit)},fit:{...inlineFit,overflow:!!inlineFit.placement?.overflow}});
        primaryHeight=Math.max(valueY-top+valueHeight,unitY-top+occupied(inlineFit));
      } else allocations.push({part:primary,box:valueFit?{...area,height:valueHeight}:area,fit:valueFit});
      // Keep related fields together. An arbitrary percentage gap disconnects a stacked unit
      // from its value on tall cells and wastes space needed by longer labels.
      let y=top+primaryHeight+(tail.length?primaryGap:0);
      for (const part of tail) {
        const natural=measured.get(part)!,height=occupied(natural);
        const area=lineBox(part,box,y,height,natural.fontSize);
        allocations.push({part,box:area,fit:{...natural,overflow:!!natural.placement?.overflow||natural.sourceLines.some(line=>line.width>area.width+.01)}});
        y+=height+gap;
      }
      // LH-68: a tile sets its description, delta and trend at its foot (a stacked unit stays under the value).
      const foot=options.tile?allocations.filter(entry=>tail.includes(entry.part)&&entry.part!==unit):[];
      const drop=foot.length?box.y+box.height-Math.max(...foot.map(entry=>entry.box.y+entry.box.height)):0;
      if (drop>0) for (const entry of foot) entry.box={...entry.box,y:entry.box.y+drop};
      const overflow=!valueFit||valueFit.overflow||arrangement==='inline-unit'&&valueFit.lines.length!==1||primaryHeight>area.height+.01||allocations.some(({box:area,fit})=>!fit||fit.overflow||!usable(area)||area.y+area.height>box.y+box.height+.01);
      // LH-53: a unit drawn larger than it asked for (METRIC_UNIT_SHARE) is no gain that offsets smaller metadata.
      const score=allocations.reduce((sum,{part,fit})=>sum+Math.max(0,part.requestedFontSize-(fit?.fontSize??minimum))/scale,0);
      const candidate={arrangement,allocations,score,overflow};
      // LH-53: a later candidate (more reduced metadata) must score a whole reference pixel better: on a near tie the metadata keeps its
      // size and the value gives way, as when the trend took a line of its own.
      if (!selected||!overflow&&(selected.overflow||score<selected.score-1)||overflow&&selected.overflow) selected=candidate;
    }
    if (selected&&!selected.overflow&&selected.score===0) break;
  }
  for (const allocation of selected!.allocations) {allocation.part.box=allocation.box;allocation.part.fit=allocation.fit;}
  const figureLine=!!primary.fit&&FIGURE_FITS.has(primary.fit);
  const alignmentFactor=alignment==='center'?.5:alignment==='right'?1:0;
  if (selected!.arrangement==='inline-unit'&&unit) {
    const offset=(box.width-(unit.box.x+unit.box.width-box.x))*alignmentFactor;
    primary.box.x+=offset;unit.box.x+=offset;
  }
  const position=(part:MetricTextPart)=>{
    if(!part.fit)return;
    if(part.fit.placement) {
      part.fit={...part.fit,placement:{...part.fit.placement,lines:part.fit.placement.lines.map(line=>({...line,x:line.x+part.box.x,y:line.y+part.box.y,baseline:line.baseline+part.box.y,outline:line.outline?{...line.outline,x:line.outline.x+part.box.x,y:line.outline.y+part.box.y}:null}))}};
      part.linePositions=part.fit.placement!.lines.map(({x,baseline})=>({x,baseline}));
    } else part.linePositions=part.fit.sourceLines.map((line,index)=>({
      x:part.box.x+(part.box.width-line.width)*alignmentFactor,baseline:part.box.y+part.fit!.fontSize+index*part.fit!.lineHeight,
    }));
  };
  for (const part of parts) position(part);
  // LH-53: the trend arrow, METRIC_TREND_ARROW_SIZE of its line's size and on that line's baseline: before the host's first line, or on
  // the trend's own line (placed by the alignment) without a host. The trend part then draws nothing; its source text stays the arrow's
  // text alternative.
  let trendBox:LayoutBox|undefined,trendBottom=box.y;
  if (trendPart) {
    const host=arrowHost?.fit&&arrowHost.linePositions.length?arrowHost:!arrowHost&&trendPart.fit&&trendPart.linePositions.length?trendPart:undefined;
    if (host) {
      const line=host.fit!.sourceLines[0]!,origin=host.linePositions[0]!,size=host.fit!.fontSize*METRIC_TREND_ARROW_SIZE,arrowGap=host.fit!.fontSize*METRIC_TREND_ARROW_GAP;
      const x=host===arrowHost?(arrowLeft?origin.x-arrowGap-size:origin.x+line.width+arrowGap):alignment==='left'?host.box.x:alignment==='right'?host.box.x+host.box.width-size:host.box.x+(host.box.width-size)/2;
      trendBox={x,y:origin.baseline-size,width:size,height:size};
      if (host===trendPart) trendBottom=trendPart.box.y+occupied(trendPart.fit!);
    }
    const size=trendPart.fit?.fontSize??trendPart.requestedFontSize;
    trendPart.visible=false;trendPart.linePositions=[];trendPart.box=trendBox??{...box,height:0};
    trendPart.fit={lines:[],sourceLines:[],fontSize:size,lineHeight:size*1.22,tabSize:4,tabWidth:0,overflow:false};
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
  const bottom = Math.max(box.y, trendBottom, ...visible.map(part => part.box.y + occupied(part.fit!)));
  const bounds = {x:box.x,y:box.y,width:box.width,height:bottom-box.y};
  // LH-40: a field with no room is set at the floor in what its cell leaves; it overflows, and its finding above stands.
  if (options.floorFallback) for (const part of parts) if (part.visible&&!part.fit) {
    const room=floorRoom(part.box,box),floorFit=measure(part,minimum,room.width);
    part.box={...room,height:occupied(floorFit)};part.fit={...floorFit,overflow:true};position(part);
  }
  const layout:MetricLayout={bounds,algorithm:'metric-flow-v1',alignment,textMeasurement:options.textMeasurement?'provided':'estimated',arrangement:selected!.arrangement,...(metric.sentiment===undefined?{}:{sentiment:metric.sentiment}),...(trendBox?{trendBox}:{}),...(options.display&&!options.tile?{display:true as const}:{}),attempts,parts,diagnostics,overflow:diagnostics.length>0};
  if (figureLine) FIGURE_LINES.add(layout);
  return layout;
}

/** Progress of a timeline event (FA-11). Engines draw it from the deck's colors; see `timelineMarkerShapes`. */
export type TimelineStatus = 'done' | 'current' | 'planned';
const TIMELINE_STATUS_VALUES: readonly string[] = ['done', 'current', 'planned'];
/** WI-5 (P22): an event narrower than this many ems of the label size is composed vertically instead. */
const TIMELINE_NARROW_EM = 8;
/** WI-5 (P22): the vertical arrangement of a narrow timeline may reduce its text by up to this many reference pixels before the usual search. */
const TIMELINE_NARROW_REDUCTIONS = 4;
/** The 'current' ring is this multiple of the marker radius. */
const TIMELINE_RING_RATIO = 1.6;
/**
 * Role sizes in reference pixels. LH-41: a compact band (one of several timelines stacked in a region) uses the smaller set,
 * as Claude Design's compact bands do, so four to nine bands read at one modest size.
 */
const TIMELINE_ROLE_SIZES = {name:24,description:18,when:18,what:22,'event-description':18,status:16} as const;
const TIMELINE_COMPACT_SIZES = {name:18,description:16,when:16,what:18,'event-description':16,status:16} as const;
/**
 * LH-121: the word drawn under an event's label for its status (`statusWords`). English only: a deck in another language keeps the
 * status in its markers and connector, until the catalog carries localized words.
 */
export const TIMELINE_STATUS_WORDS: Readonly<Record<TimelineStatus, string>> = { done: 'Done', current: 'Current', planned: 'Planned' };
/** LH-41: a lone timeline in its region may grow its type by up to this many reference pixels when it still fits. */
const TIMELINE_GROWTH = 4;
/** LH-41: a size offset that takes every timeline part to the readability floor (to measure how far a timeline can shrink). */
const TIMELINE_FLOOR_OFFSET = 1000;
/** LH-41: several timelines in one region stack in one column of bands while each band is at least this tall (reference pixels). */
const TIMELINE_BAND_MIN_HEIGHT = 56;
export interface TimelineEvent { when?: string; what: string; description?: string; status?: TimelineStatus }
export interface TimelineContent { name?: string; description?: string; events: TimelineEvent[] }
export interface TimelineTextPart {
  /** `status` (LH-121) is a generated word under the label, never a source field: such parts are in `statusLabels`, not `parts`. */
  role: 'name' | 'description' | 'when' | 'what' | 'event-description' | 'status';
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
  /**
   * `band` (LH-41): one horizontal connector with each event's `when` above its marker and its `what` and description below,
   * every label within its event spacing. `alternating`: labels alternate above and below the connector, each up to two event
   * spacings wide, for labels wider than one spacing. `vertical`: a marker rail down the start edge with the labels beside it.
   */
  arrangement: 'band' | 'alternating' | 'vertical';
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
  /**
   * LH-121: the part of the connector drawn in the primary color, from the first event to the current one (to the last `done` one when
   * no event is current). The rest of the connector stays in the border color. Absent when no event is done or current.
   */
  progress?: {x1:number;y1:number;x2:number;y2:number};
  /**
   * LH-121: the status word under each label of an event with a status (TIMELINE_STATUS_WORDS), with `statusWords`. Generated text,
   * not source: its `sources` are empty, and import reads the status from the markers.
   */
  statusLabels?: TimelineTextPart[];
  /** LH-41: what the drawn timeline covers (its parts, markers and rings). Its height is the height the timeline needs. */
  bounds: LayoutBox;
  diagnostics: TimelineLayoutDiagnostic[];
  overflow: boolean;
}
export interface TimelineLayoutOptions extends QuoteLayoutOptions {
  textRasterPadding?: number;
  /** LH-41: one band of several timelines in a region: only the horizontal arrangements are tried (never the vertical rail), and the band sits at the top of its box. */
  horizontal?: boolean;
  /** LH-41: the compact role sizes: name and what 18, the rest 16 reference pixels; a band then sets each `when` and `what` on one row when every pair fits. */
  compact?: boolean;
  /** LH-41: in a band, the description beside the name when both fit on one row (the bands of one stack decide this together). */
  inlineHeader?: boolean;
  /**
   * LH-41: reference pixels added to every role size before the search. Negative starts smaller (the bands of one region at one
   * size; a large negative value measures at the readability floor); positive lets a lone timeline grow when it still fits.
   * No part goes below `minFontSize`.
   */
  sizeOffset?: number;
  /** LH-121: draw a status word under the label of each event with a status (English decks only; see TIMELINE_STATUS_WORDS). */
  statusWords?: boolean;
}

/** Preserve event order and field boundaries while trying at most 100 readable arrangements. */
export function layoutTimeline(value: readonly TimelineEvent[] | TimelineContent, box: LayoutBox, options: TimelineLayoutOptions = {}): TimelineLayout {
  const shorthand=Array.isArray(value),timeline=(shorthand?{events:value}:value) as TimelineContent;
  if(!timeline||!Array.isArray(timeline.events)||!timeline.events.length||
    [timeline.name,timeline.description].some(field=>field!==undefined&&typeof field!=='string')||
    timeline.events.some(event=>!event||typeof event.what!=='string'||[event.when,event.description].some(field=>field!==undefined&&typeof field!=='string'))) {
    throw new TypeError('Timeline content requires ordered events with string labels and optional string metadata.');
  }
  if(timeline.events.some(event=>event.status!==undefined&&!TIMELINE_STATUS_VALUES.includes(event.status)))throw new TypeError("Timeline event status must be 'done', 'current' or 'planned'.");
  const scale=options.scale??1,minimum=snapFontSizeUp((options.minFontSize??16)*scale),padding=(options.textRasterPadding??1)*scale,offset=options.sizeOffset??0;
  if(![box.x,box.y,box.width,box.height,scale,minimum,padding,offset].every(Number.isFinite)||box.width<=0||box.height<=0||scale<=0||minimum<=0||padding<0)throw new RangeError('Timeline dimensions, scale and minimum must be positive, with finite nonnegative raster padding and a finite size offset.');
  if(options.overflow!==undefined&&!['warn','error'].includes(options.overflow))throw new RangeError('Invalid timeline overflow policy.');
  const outlines=options.textMeasurement?.outlineBounds!==undefined,rtl=options.direction==='rtl';
  if(outlines&&typeof options.textMeasurement?.outlineBounds!=='function')throw new TypeError('Text outline provider must be a function.');
  const path=options.path??'timeline',eventPath=(index:number)=>shorthand?`${path}.${index}`:`${path}.events.${index}`;
  const fonts=resolveFontFamilies(options.fontFamilies),source:TimelineTextPart[]=[],roles=options.compact?TIMELINE_COMPACT_SIZES:TIMELINE_ROLE_SIZES;
  const add=(role:TimelineTextPart['role'],text:string|undefined,partPath:string,weight:number,eventIndex?:number)=>{
    if(text===undefined)return;
    // A current event's label is bold ("we are here"); every other part keeps its weight.
    const status=eventIndex===undefined?undefined:timeline.events[eventIndex]!.status;
    const requestedStyle:TextStyle={fontFamily:fonts.body,fontWeight:status==='current'&&role==='what'?700:weight,italic:false,path:partPath};
    source.push({role,eventIndex,...(status?{status}:{}),path:partPath,text,sources:[{path:partPath,start:0,end:text.length}],box:{...box},alignment:'center',requestedFontSize:gridFontSize(roles[role]*scale,minimum),minFontSize:minimum,requestedStyle,style:resolveTextStyle({...requestedStyle},options.textMeasurement)});
  };
  add('name',timeline.name,`${path}.name`,700);add('description',timeline.description,`${path}.description`,400);
  // LH-121: the status word sits right under the label, before the event's description.
  const words=options.statusWords===true&&(options.language===undefined||/^en(-|$)/i.test(options.language));
  timeline.events.forEach((event,index)=>{
    add('when',event.when,`${eventPath(index)}.when`,500,index);add('what',event.what,`${eventPath(index)}.what`,600,index);
    if(words&&event.status){const before=source.length;add('status',TIMELINE_STATUS_WORDS[event.status],`${eventPath(index)}.status`,500,index);source[before]!.sources=[];}
    add('event-description',event.description,`${eventPath(index)}.description`,400,index);
  });
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
  type Candidate={arrangement:TimelineLayout['arrangement'];parts:TimelineTextPart[];markers:TimelineLayout['markers'];connector:TimelineLayout['connector'];progress?:TimelineLayout['progress'];diagnostics:TimelineLayoutDiagnostic[];score:number};
  let selected:Candidate|undefined,attempts=0;
  // The search starts `sizeOffset` from the role sizes and steps down one reference pixel at a time to the floor.
  const sizeAt=(part:TimelineTextPart,reduction:number)=>gridFontSize(part.requestedFontSize+(offset-reduction)*scale,minimum);
  let reductionLimit=0;
  for(const part of source)reductionLimit=Math.max(reductionLimit,(part.requestedFontSize+offset*scale-minimum)/scale);
  const reductions=Math.min(24+Math.max(0,Math.ceil(offset)),Math.ceil(reductionLimit));
  // WI-5 (P22): a horizontal timeline gives each event `box.width / events` of width. Below 8 ems of the label size the labels wrap one word per
  // line, so the timeline is composed vertically (events stacked down the cell, the same markers, statuses and order). The full-width
  // timeline keeps a horizontal arrangement. A band of a stack (`horizontal`) never turns vertical. The test is at the role sizes, whatever
  // the size offset, so a timeline measured at the floor has the arrangement it is placed in.
  const count=events.length,labelSize=source.find(part=>part.role==='what')?.requestedFontSize??gridFontSize(roles.what*scale,minimum);
  const narrow=!options.horizontal&&count>1&&box.width/Math.max(2,count)<TIMELINE_NARROW_EM*labelSize;
  // LH-41: a band gives each event one spacing (`box.width / events`) less a gutter, so neighbouring labels never touch.
  const bandStep=box.width/count,bandWidth=count>1?Math.max(scale,bandStep-Math.min(16*scale,bandStep/4)):box.width;
  const lineWidth=(part:TimelineTextPart,reduction:number)=>{const measured=measure(part,sizeAt(part,reduction),1e6,'left');return measured.fit.sourceLines.length===1?measured.fit.sourceLines[0]!.width+(outlines?2*padding:0):Infinity;};
  // LH-41: labels alternate above and below only when a `when` or `what` label is wider than its event spacing; otherwise they all
  // sit in one band.
  const wideAt=(reduction:number)=>count>1&&events.some(fields=>fields.some(part=>(part.role==='when'||part.role==='what')&&lineWidth(part,reduction)>bandWidth+.01));
  const tryArrangement=(arrangement:TimelineLayout['arrangement'],reduction:number):TimelineLayoutDiagnostic[]=>{
      attempts++;
      const parts:TimelineTextPart[]=[],markers:TimelineLayout['markers']=[],diagnostics:TimelineLayoutDiagnostic[]=[];
      let score=0;
      const report=(part:TimelineTextPart,reason:TimelineLayoutDiagnostic['reason'],message:string,excess=1)=>{diagnostics.push({code:'text-overflow',reason,path:part.path,message});score+=Math.max(1,excess);};
      const place=(part:TimelineTextPart,x:number,y:number,width:number,alignment:TimelineTextPart['alignment'])=>{
        const measured=measure(part,sizeAt(part,reduction),Math.max(scale,width),alignment);
        const area={x,y,width:Math.max(scale,width),height:Math.max(scale,measured.height)},placement=outlines?placeTextLines(measured.ink,area,alignment,padding,measured.fit.directions):undefined;
        const fit={...measured.fit,...(placement?{placement}:{}),overflow:measured.fit.overflow||!!placement?.overflow};
        const accepted={...part,box:area,alignment,fit};parts.push(accepted);
        if(fit.overflow)report(accepted,'text-fit','Timeline field exceeds its readable width; increase its space or split the timeline.');
        if(breaksInsideWord(part.text,fit))report(accepted,'text-fit','Timeline field would split a word; use a wider vertical arrangement or paginate events.');
        if(area.x<box.x-.01||area.y<box.y-.01||area.x+area.width>box.x+box.width+.01||area.y+area.height>box.y+box.height+.01)report(accepted,'part-outside-cell','Timeline field extends outside its cell; increase the cell or paginate events.',Math.max(area.x+area.width-box.x-box.width,area.y+area.height-box.y-box.height));
        return accepted;
      };
      const heightOf=(part:TimelineTextPart,width:number,alignment:TimelineTextPart['alignment'])=>measure(part,sizeAt(part,reduction),Math.max(scale,width),alignment).height;
      // The name and description, planned first so that a horizontal timeline can centre the whole block in its box. A band of a stack
      // sets them at its start edge, as a heading over the band; a lone timeline centres them.
      const metaAlignment:TimelineTextPart['alignment']=arrangement==='band'&&options.horizontal?'left':'center',metaGap=(options.compact?6:8)*scale,inlineGap=12*scale;
      const header:{part:TimelineTextPart;x:number;dy:number;width:number}[]=[];let headerHeight=0;
      const [name,description]=metadata.length===2?metadata:[];
      const nameWidth=name&&options.inlineHeader&&arrangement==='band'?lineWidth(name,reduction)+scale:Infinity,descriptionWidth=Number.isFinite(nameWidth)?lineWidth(description!,reduction)+scale:Infinity;
      if(nameWidth+inlineGap+descriptionWidth<=box.width+.01){
        // LH-41: the description beside the name, bottom-aligned so the two single lines share a baseline (a compact band).
        const nameHeight=heightOf(name!,nameWidth,'left'),descriptionHeight=heightOf(description!,descriptionWidth,'left'),row=Math.max(nameHeight,descriptionHeight);
        header.push({part:name!,x:rtl?box.x+box.width-nameWidth:box.x,dy:row-nameHeight,width:nameWidth},{part:description!,x:rtl?box.x+box.width-nameWidth-inlineGap-descriptionWidth:box.x+nameWidth+inlineGap,dy:row-descriptionHeight,width:descriptionWidth});
        headerHeight=row+metaGap;
      }else for(const part of metadata){header.push({part,x:box.x,dy:headerHeight,width:box.width});headerHeight+=heightOf(part,box.width,metaAlignment)+metaGap;}
      const placeHeader=(top:number)=>{for(const entry of header)place(entry.part,entry.x,top+entry.dy,entry.width,metaAlignment);return top+headerHeight;};
      // Status geometry (FA-11): only a 'current' event gets a ring, and only a 'current' or 'planned' marker has an outline.
      const statusOf=(index:number)=>timeline.events[index]!.status,hasRing=timeline.events.some(event=>event.status==='current');
      const outlined=timeline.events.some(event=>event.status==='planned');
      let radius=0,ringRadius=0,strokeWidth=0;
      const setRadius=(value:number)=>{radius=value;ringRadius=radius*TIMELINE_RING_RATIO;strokeWidth=Math.min(2*scale,radius/2);};
      const marker=(index:number,x:number,y:number):TimelineLayout['markers'][number]=>{
        const status=statusOf(index);
        return {path:eventPath(index),eventIndex:index,x,y,radius,...(status?{status}:{}),...(status==='current'?{ring:{radius:ringRadius}}:{}),...(status==='current'||status==='planned'?{strokeWidth}:{})};
      };
      if(arrangement==='band'){
        // LH-41: a band, every label one event spacing wide. Each `when` is an eyebrow above its marker (bottom-aligned, so the eyebrows
        // end on one line) and each `what` and description sit below it. A compact band (four or more timelines in a region) sets
        // each event's `when` and `what` on one row below the marker when every pair fits, as Claude Design's compact bands do. A
        // lone band centres the block (header and band) in its box; a band of a stack sits at the top of its box, so the bands of one
        // row share their lines.
        // A compact band draws smaller markers and tighter gaps (Claude Design's compact bands).
        setRadius(Math.min((options.compact?7:9)*scale,bandStep/5));
        const lift=(options.compact?5:6)*scale,fieldGap=(options.compact?2:4)*scale,pairGap=6*scale,extent=hasRing?ringRadius+strokeWidth/2:radius+(outlined?strokeWidth/2:0);
        const whenOf=(fields:TimelineTextPart[])=>fields.find(part=>part.role==='when'),whatOf=(fields:TimelineTextPart[])=>fields.find(part=>part.role==='what')!;
        const pair=(fields:TimelineTextPart[])=>{const when=whenOf(fields);return when?{when:lineWidth(when,reduction)+scale,what:lineWidth(whatOf(fields),reduction)+scale}:undefined;};
        const inline=!!options.compact&&events.every(fields=>{const widths=pair(fields);return !widths||widths.when+pairGap+widths.what<=bandWidth+.01;});
        const below=(fields:TimelineTextPart[])=>fields.filter(part=>inline?part.role==='event-description'||part.role==='status':part.role!=='when');
        const rowHeight=(fields:TimelineTextPart[])=>{const widths=pair(fields);return widths?Math.max(heightOf(whenOf(fields)!,widths.when,'left'),heightOf(whatOf(fields),widths.what,'left')):heightOf(whatOf(fields),bandWidth,'center');};
        const whenHeights=events.map(fields=>{const when=whenOf(fields);return when&&!inline?heightOf(when,bandWidth,'center'):0;});
        const belowHeights=events.map(fields=>(inline?rowHeight(fields)+(below(fields).length?fieldGap:0):0)+below(fields).reduce((height,part)=>height+heightOf(part,bandWidth,'center'),0)+Math.max(0,below(fields).length-1)*fieldGap);
        const eyebrow=Math.max(0,...whenHeights),envelope=(eyebrow?eyebrow+lift:0)+2*extent+lift+Math.max(0,...belowHeights);
        const top=placeHeader(box.y+(options.horizontal?0:Math.max(0,(box.height-headerHeight-envelope)/2))),lineY=top+(eyebrow?eyebrow+lift:0)+extent;
        events.forEach((fields,index)=>{
          const x=box.x+bandStep/2+(rtl?count-1-index:index)*bandStep;
          markers.push(marker(index,x,lineY));
          let cursor=lineY+extent+lift;
          const when=whenOf(fields),widths=inline?pair(fields):undefined;
          if(widths&&when){
            // `when` then `what`, centred under the marker as one row (in reading order: a right-to-left row starts at the right) and
            // bottom-aligned so the two single lines share a baseline.
            const row=rowHeight(fields),start=x-(widths.when+pairGap+widths.what)/2,whenX=rtl?start+widths.what+pairGap:start,whatX=rtl?start:start+widths.when+pairGap;
            place(when,whenX,cursor+row-heightOf(when,widths.when,'left'),widths.when,'left');
            place(whatOf(fields),whatX,cursor+row-heightOf(whatOf(fields),widths.what,'left'),widths.what,'left');
            cursor+=row+fieldGap;
          }else if(when)place(when,x-bandWidth/2,lineY-extent-lift-whenHeights[index]!,bandWidth,'center');
          for(const [fieldIndex,part] of below(fields).entries()){const placed=place(part,x-bandWidth/2,cursor,bandWidth,'center');cursor+=placed.box.height;if(fieldIndex<below(fields).length-1)cursor+=fieldGap;}
        });
      }else if(arrangement==='alternating'){
        // Labels wider than one spacing: each is two spacings wide less a gutter, and alternates above and below, so labels on one
        // side are two spacings apart. Upper labels end beside their marker; lower labels begin beside theirs. The measured block
        // (header and both label bands) is centred in the box.
        const gutter=count>1?Math.min(16*scale,box.width/(count+1)/4):0,step=count>1?(box.width+gutter)/(count+1):0,width=count>1?2*step-gutter:box.width;
        const start=count===1?box.x+box.width/2:box.x+width/2;
        setRadius(Math.min(9*scale,box.width/Math.max(2,count)/5,Math.max(scale,box.height-headerHeight)*.04));
        const fieldGap=4*scale,clearance=24*scale;
        const heights=events.map(fields=>fields.reduce((height,part)=>height+heightOf(part,width,'center'),0)+Math.max(0,fields.length-1)*fieldGap);
        const markerExtent=hasRing?ringRadius+strokeWidth/2:radius;
        const upper=Math.max(markerExtent,...heights.filter((_,index)=>index%2===0).map(height=>height+clearance));
        const lower=Math.max(markerExtent,...heights.filter((_,index)=>index%2===1).map(height=>height+clearance));
        const top=placeHeader(box.y+Math.max(0,(box.height-headerHeight-upper-lower)/2)),lineY=top+upper;
        events.forEach((fields,index)=>{
          const x=start+(rtl?count-1-index:index)*step,top=index%2===0?lineY-clearance-heights[index]!:lineY+clearance,bottom=index%2===0?lineY-clearance:box.y+box.height;
          markers.push(marker(index,x,lineY));let cursor=top;
          for(const [fieldIndex,part] of fields.entries()){const placed=place(part,x-width/2,cursor,width,'center');cursor+=placed.box.height;if(cursor>bottom+.01)report(placed,'event-space','Timeline event labels exceed their side of the connector; change the arrangement or paginate events.',cursor-bottom);if(fieldIndex<fields.length-1)cursor+=fieldGap;}
        });
      }else{
        // Right to left: the marker rail runs down the right edge and the text, aligned to its start, sits to its left.
        // Reserve the entire marker/ring diameter plus twelve pixels of clear space before text.
        let y=placeHeader(box.y);
        setRadius(Math.min(9*scale,box.width/Math.max(2,count)/5,Math.max(scale,box.y+box.height-y)*.04));
        const lead=hasRing?ringRadius+strokeWidth/2:radius+(outlined?strokeWidth/2:0),gap=2*lead+12*scale;
        const x=rtl?box.x+box.width-lead:box.x+lead,textX=rtl?box.x:box.x+gap,width=box.width-gap;
        events.forEach((fields,index)=>{
          const top=y;let first:TimelineTextPart|undefined;
          for(const [fieldIndex,part] of fields.entries()){const placed=place(part,textX,y,width,'left');first??=placed;y+=placed.box.height;if(fieldIndex<fields.length-1)y+=4*scale;}
          markers.push(marker(index,x,top+Math.min(first?.box.height??2*radius,2*radius)/2));
          y+=16*scale;
        });
      }
      for(const marker of markers){const extent=(marker.ring?.radius??marker.radius)+(marker.strokeWidth??0)/2;if(marker.x-extent<box.x-.01||marker.y-extent<box.y-.01||marker.x+extent>box.x+box.width+.01||marker.y+extent>box.y+box.height+.01){diagnostics.push({code:'text-overflow',reason:'event-space',path:marker.path,message:'Timeline marker has no usable space; increase the cell or paginate events.'});score+=1;}}
      const firstMarker=markers[0]!,last=markers.at(-1)!,connector=rtl?{x1:Math.min(firstMarker.x,last.x),y1:firstMarker.y,x2:Math.max(firstMarker.x,last.x),y2:last.y}:{x1:firstMarker.x,y1:firstMarker.y,x2:last.x,y2:last.y};
      // LH-121: progress runs from the first event to the current one, or to the last done one when none is current.
      const current=markers.findIndex(entry=>entry.status==='current'),reached=current>=0?current:markers.map(entry=>entry.status).lastIndexOf('done');
      const end=reached>0?markers[reached]!:undefined,progress=end?rtl?{x1:Math.min(firstMarker.x,end.x),y1:firstMarker.y,x2:Math.max(firstMarker.x,end.x),y2:end.y}:{x1:firstMarker.x,y1:firstMarker.y,x2:end.x,y2:end.y}:undefined;
      const candidate={arrangement,parts,markers,connector,...(progress?{progress}:{}),diagnostics,score};
      if(!selected||score<selected.score)selected=candidate;
      return diagnostics;
  };
  let settled=false;
  // A narrow cell tries the vertical arrangement first, with up to a few pixels of size reduction, before the usual search.
  if(narrow)for(let reduction=0;reduction<=Math.min(reductions,TIMELINE_NARROW_REDUCTIONS)&&!settled;reduction++)settled=!tryArrangement('vertical',reduction).length;
  // Then, per size: the horizontal arrangement the labels call for, the other one when a band's labels do not fit its spacing, and
  // the vertical rail (except in a band of a stack).
  for(let reduction=0;reduction<=Math.max(0,reductions)&&!settled;reduction++){
    const primary=wideAt(reduction)?'alternating':'band',found=tryArrangement(primary,reduction);
    if(!found.length){settled=true;break;}
    if(primary==='band'&&found.some(entry=>entry.reason==='text-fit')&&!tryArrangement('alternating',reduction).length){settled=true;break;}
    if(!options.horizontal&&!tryArrangement('vertical',reduction).length)settled=true;
  }
  const {score,...result}=selected!;
  if(result.diagnostics.length&&options.overflow==='error')throw new OPFCompositionError(result.diagnostics);
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  const cover=(x:number,y:number,width:number,height:number)=>{left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+width);bottom=Math.max(bottom,y+height);};
  for(const part of result.parts)cover(part.box.x,part.box.y,part.box.width,part.box.height);
  for(const marker of result.markers){const extent=(marker.ring?.radius??marker.radius)+(marker.strokeWidth??0)/2;cover(marker.x-extent,marker.y-extent,2*extent,2*extent);}
  // LH-121: the status words are drawn, measured and covered like the other parts, but they are not source fields.
  const statusLabels=result.parts.filter(part=>part.role==='status'),parts=result.parts.filter(part=>part.role!=='status');
  return {algorithm:'timeline-flow-v1',attempts,textMeasurement:options.textMeasurement?'provided':'estimated',textOutlines:outlines?'provided':'unavailable',...result,parts,...(statusLabels.length?{statusLabels}:{}),bounds:{x:left,y:top,width:right-left,height:bottom-top},overflow:result.diagnostics.length>0};
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
  /** The panel the code needs at the allocated width: the cell's width and as much height as the insets, metadata and source lines take (at most the cell). */
  bounds: LayoutBox;
  algorithm: 'code-flow-v1';
  textMeasurement: 'estimated' | 'provided';
  parts: CodeTextPart[];
  diagnostics: CodeLayoutDiagnostic[];
  overflow: boolean;
}
export interface CodeLayoutOptions extends QuoteLayoutOptions {
  /**
   * LH-101: the panel is the whole box (`bounds`), with the source lines in its middle (below the filename and language when the
   * middle would reach them), as a lone code panel fills the body. Default: the panel hugs its lines from the top.
   */
  fill?: boolean;
}

/** Fit code without using prose whitespace normalization. The source remains reconstructable. */
function fitCodeText(text:string,box:LayoutBox,size:number,minimum:number,step:number,measure:MeasureTextWidth,direction?:TextDirection):CodeTextFit {
  return fitSourceText(text,box,size,minimum,step,measure,false,true,direction);
}

/**
 * The line breaks of a text depend only on the text, the width measure, the size, the box width and the prose and direction flags, and
 * composition asks for the same ones many times (every arrangement a slide is compared in, every trial size of a grid). Those of core's own
 * estimates (measureText, measureMonospaceText, pure functions of the text) are kept, up to LINE_BREAK_CACHE_LIMIT per measure; a host
 * measurement is never cached, since its widths change as its fonts load. A hit returns copies, so a caller may change what it gets.
 */
const lineBreakCache = new WeakMap<MeasureTextWidth, Map<string, CodeTextFit>>();
const LINE_BREAK_CACHE_LIMIT = 10000;
const copyTextFit = (fit: CodeTextFit, width: number, height: number): CodeTextFit => ({ ...fit, lines: [...fit.lines], sourceLines: fit.sourceLines.map(line => ({ ...line, segments: line.segments.map(segment => ({ ...segment })) })), ...(fit.directions ? { directions: [...fit.directions] } : {}),
  overflow: fit.sourceLines.length * fit.lineHeight > height + .01 || fit.sourceLines.some(line => line.width > width + .01) });
/** Retain exact source ranges and position tabs without passing control characters to a font shaper. */
function fitSourceText(text:string,box:LayoutBox,size:number,minimum:number,step:number,measure:MeasureTextWidth,prose=false,snap=true,direction?:TextDirection,balance=false):SourceTextFit {
  const directionAt=direction==='rtl'?paragraphDirectionAt(text,'rtl'):undefined;
  let cache = lineBreakCache.get(measure);
  if (!cache && (measure === measureText || measure === measureMonospaceText)) { cache = new Map(); lineBreakCache.set(measure, cache); }
  const layout=(fontSize:number,forced?:ReadonlySet<number>):CodeTextFit=>{
    if (forced || !cache) return breakLines(fontSize,forced);
    const key=`${prose?1:0}${direction==='rtl'?'r':'l'}${fontSize}|${box.width}|${text}`, known=cache!.get(key);
    if (known) return copyTextFit(known,box.width,box.height);
    const fit=breakLines(fontSize);
    if (cache!.size>=LINE_BREAK_CACHE_LIMIT) cache!.clear();
    cache!.set(key,copyTextFit(fit,box.width,Infinity));
    return fit;
  };
  const breakLines=(fontSize:number,forced?:ReadonlySet<number>):CodeTextFit=>{
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
    for (const token of prose?proseTokens(text):text.matchAll(tokens)) {
      if (token.index===undefined) throw new Error('Missing code token source offset.');
      const a=token.index,b=a+token[0].length;
      if (/^[\r\n]/.test(token[0])) {push(a,b,'hard');continue;}
      // A break the balancer chose (headings): the line ends before this word.
      if (forced?.has(a) && end>start && /\S/u.test(text.slice(start,end))) push(a,a,'soft');
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
      // Inside an over-long word the break moves back off a figure, its unit and a closing mark (LH-11) when the line has room for it.
      const cuts=prose?[...textSegments.segment(token[0])].map(segment=>a+segment.index):undefined;
      for (const [k,segment] of [...textSegments.segment(token[0])].entries()) {
        const next=a+segment.index+segment.segment.length;
        if (end>start && width(start,next)>box.width+.01) {const at=cuts?allowedBreak(text,cuts,k,start):a+segment.index;push(at,at,'soft');}
        end=next;
      }
    }
    push(end,end,'end');
    const lineHeight=fontSize*1.22;
    return {lines:sourceLines.map(line=>text.slice(line.start,line.end)),sourceLines,fontSize,lineHeight,tabSize:4,tabWidth,
      ...(directionAt?{directions:sourceLines.map(line=>directionAt(line.start))}:{}),
      overflow:sourceLines.length*lineHeight>box.height+.01||sourceLines.some(line=>line.width>box.width+.01)};
  };
  // WI-4 (P15): a heading keeps the line count and the size of its greedy wrap and balances the breaks (balancedBreaks).
  const balanced=(fontSize:number):CodeTextFit=>{
    const greedy=layout(fontSize);
    if (!balance||greedy.overflow||greedy.sourceLines.length<2) return greedy;
    const widthOf=(start:number,end:number)=>{let x=0;for (const [index,segment] of text.slice(start,end).split('\t').entries()) {if(index)x=(Math.floor(x/(measure(' ',fontSize)*4)+1e-9)+1)*measure(' ',fontSize)*4;if(segment)x+=measure(segment,fontSize);}return x;};
    const forced=balancedBreaks(text,greedy.sourceLines.map(line=>({start:line.start,end:line.end,hard:line.boundary!=='soft'})),widthOf,box.width);
    const result=forced?layout(fontSize,forced):greedy;
    return result.sourceLines.length===greedy.sourceLines.length&&!result.overflow?result:greedy;
  };
  return fitAtSizes(balance?balanced:layout,size,minimum,step,snap);
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
      requestedFontSize:gridFontSize((role==='body'?grownRoleSize(CODE_NOMINAL_SIZE,options.growth,LONE_DISPLAY_SIZES.code):grownRoleSize(14,options.growth,LONE_DISPLAY_SIZES.codeHeader))*scale,minimum),minFontSize:minimum,requestedStyle,
      style:resolveTextStyle({...requestedStyle},options.textMeasurement)};
    parts.push(part);return part;
  };
  if (code.filename) add('filename',code.filename,`${path}.filename`);
  if (code.language) add('language',code.language,`${path}.language`);
  if (!parts.length) add('language','code',path,true);
  const body=add('body',code.source,shorthand?path:`${path}.source`),headers=parts.filter(part=>part!==body);
  const usable=(area:LayoutBox)=>[area.x,area.y,area.width,area.height].every(Number.isFinite)&&area.width>0&&area.height>0;
  const measureCode=textWidthMeasurer(body.style,options.textMeasurement);
  const fit=(part:CodeTextPart,area:LayoutBox,size=part.requestedFontSize,floor=minimum)=>{
    if (!usable(area)) return undefined;
    const wanted=fitCodeText(part.text,area,size,floor,scale,textWidthMeasurer(part.style,options.textMeasurement));
    // WI-4 (P21): a code body asks for 22 px, but not at the price of wrapping lines that the former 18 px kept whole (a narrow column
    // would break `function` from its name): the earlier size is taken when it wraps fewer lines and fits.
    const wraps=(value:CodeTextFit)=>value.sourceLines.filter(line=>line.boundary==='soft').length;
    const legacy=gridFontSize(LEGACY_CODE_NOMINAL_SIZE*scale,minimum);
    if (part.role!=='body'||part.requestedFontSize<=legacy||!wraps(wanted)) return wanted;
    const earlier=fitCodeText(part.text,area,legacy,floor,scale,measureCode);
    return !earlier.overflow&&wraps(earlier)<wraps(wanted)?earlier:wanted;
  };
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
    // WI-4 (P21): a body that needs less than its space takes only what its lines need; the panel hugs it (`bounds`).
    if (selected&&!selected.overflow&&body.fit) {
      const lines=Math.min(body.box.height,body.fit.lines.length*body.fit.lineHeight);
      // LH-101: a filling panel sets its lines in its middle, never above the space the metadata leaves them.
      const top=options.fill?Math.min(body.box.y+body.box.height-lines,Math.max(body.box.y,inner.y+(inner.height-lines)/2)):body.box.y;
      body.box={...body.box,y:top,height:lines};
    }
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
  // The panel a code body needs: the insets around the metadata and the source lines (the whole cell when the layout failed).
  const bottom=body.fit&&!body.fit.overflow&&!options.fill?body.box.y+body.box.height+18:box.y+box.height;
  const bounds={x:box.x,y:box.y,width:box.width,height:Math.min(box.height,Math.max(bottom-box.y,0))};
  // LH-40: a part with no room is set at the floor in what the panel leaves; it overflows, and its finding above stands.
  if (options.floorFallback) for (const part of parts) if (!part.fit) {
    const room=floorRoom(part.box,usable(inner)?inner:box);
    part.box=room;part.fit={...fitCodeText(part.text,room,minimum,minimum,scale,textWidthMeasurer(part.style,options.textMeasurement)),overflow:true};
  }
  return {bounds,algorithm:'code-flow-v1',textMeasurement:options.textMeasurement?'provided':'estimated',parts,diagnostics,overflow:diagnostics.length>0};
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
  /**
   * WI-4: balance the wrapped lines of a heading: after the greedy wrap, keep its size and line count and choose the break set that
   * minimizes the variance of the line widths (a line that ends a sentence or clause is favored), so the last line is not a
   * stranded word. Explicit line breaks stay; a size is never reduced to balance, and a heading that would need another line stays greedy.
   */
  balance?: boolean;
}

/** Fit mixed styles without flattening font metrics. Run fontSize is in points. */
export function fitRichText(input: readonly (string | RichTextRun)[], box: LayoutBox, requestedSize = PROSE_NOMINAL_SIZE, minFontSize = 16, options: RichTextOptions = {style:{fontFamily:'sans-serif',fontWeight:400}}): RichTextFit {
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
  let offset=0,lastWidth:(start:number,end:number)=>number=()=>0,lastRanges:{start:number;end:number}[]=[];
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
  const build=(rawFontSize:number,forced?:ReadonlySet<number>):RichTextFit=>{
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
    for(const match of proseTokens(whole)){
      const start=match.index,end=start+match[0].length;
      if(/^[\r\n]/.test(match[0])){push(start);lineStart=end;lineEnd=end;continue;}
      // A break the balancer chose (headings): the line ends before this word.
      if(forced?.has(start)&&lineEnd>lineStart&&/\S/u.test(whole.slice(lineStart,lineEnd)))push(start);
      if(width(lineStart,end)<=box.width+WRAP_TOLERANCE){lineEnd=end;continue;}
      // Wrap at word boundaries; retain whitespace in the source ranges. RR-17: whitespace that does not fit hangs at the end of the line
      // (the source stays lossless and the next line never starts with a space); hanging whitespace is not part of the line's width.
      if(HANGING_SPACE.test(match[0][0]!)&&lineEnd>lineStart&&/\S/u.test(whole.slice(lineStart,lineEnd))){if(hangFrom<0)hangFrom=lineEnd;lineEnd=end;continue;}
      if(lineEnd>lineStart)push(start);
      if(width(start,end)<=box.width+WRAP_TOLERANCE){lineEnd=end;continue;}
      // Match plain prose: protected tokens stay whole and report overflow at the readability floor.
      if(/[\u00a0\u202f\u2060\ufeff]/u.test(match[0])){lineEnd=end;continue;}
      const cuts=[...textSegments.segment(match[0])];
      for(const [k,{segment,index}]of cuts.entries()){
        const next=start+index+segment.length;
        if(lineEnd>lineStart&&width(lineStart,next)>box.width+WRAP_TOLERANCE)push(allowedBreak(whole,cuts.map(cut=>start+cut.index),k,lineStart));
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
    const fit:RichTextFit={lines:ranges.map(range=>whole.slice(range.start,range.end)),fontSize,lineHeight:Math.max(fontSize*1.22,...richLines.map(line=>line.height)),richLines,height:y,overflow:y>box.height+.01||richLines.some(line=>line.width>box.width+.01),
      ...(directionAt?{directions:ranges.map(range=>directionAt(range.start))}:{})};
    lastWidth=width;lastRanges=ranges;
    return fit;
  };
  // WI-4 (P15): a heading keeps the line count and the size of its greedy wrap and balances the breaks (balancedBreaks).
  const layout=(rawFontSize:number):RichTextFit=>{
    const greedy=build(rawFontSize);
    if(!options.balance||greedy.overflow||greedy.richLines.length<2)return greedy;
    const forced=balancedBreaks(whole,lastRanges.map(range=>({start:range.start,end:range.end,hard:/^[\r\n]/.test(whole.slice(range.end,range.end+1))||range.end>=whole.length})),lastWidth,box.width);
    const result=forced?build(rawFontSize,forced):greedy;
    return result.richLines.length===greedy.richLines.length&&!result.overflow?result:greedy;
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
   * With `design.listBullet: "none"` (and no numbering), and for the entry of a heading list (`ListFitOptions.heading`), the marker draws nothing: `none` is true, `text` is empty and `indent` is 0;
   * `x`, `y` and `style` still say where the entry's first baseline and font are.
   */
  marker:{text:string;x:number;y:number;fontSize:number;style:TextStyle;indent:number;number?:ListNumber;width?:number;anchor?:'end';none?:true};
  /** LH-77: the entry of a heading list (`ListFitOptions.heading`): bold at LIST_HEADING_SCALE times the list size, with no marker. */
  heading?:true;
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
/** LH-08: a hairline between two rows of a list drawn as ruled rows (`design.listStyle: "rows"`): from `x` across `width`, centered on `y`. */
export interface ListRule { x:number; y:number; width:number }
export interface ListFit extends TextFit { listEntries:ListEntryLayout[]; height:number;
  /** LH-08: the hairlines of a list drawn as ruled rows, one between every two first-level entries; engines draw each LIST_RULE_WIDTH thick in the scheme's border neutral. */
  rules?:ListRule[] }
/** LH-08: the space between two rows of a ruled list, in em of the list size; its hairline sits in the middle. */
export const LIST_ROWS_GAP=.8;
/** LH-08: a ruled list sets its labels beside their descriptions when the widest label takes at most this share of the list's width on one line. */
export const LIST_ROWS_LABEL_SHARE=.4;
/** LH-08: the thickness of a row's hairline, in reference pixels (0.75 pt at 1280 × 720). */
export const LIST_RULE_WIDTH=1;
export interface ListFitOptions extends RichTextOptions {
  /**
   * Number the entries instead of bulleting them (the payload's `numbering` field). The hanging indent becomes the larger of
   * 1.1 em and the widest marker plus 0.3 em, so wide markers never touch their text; unnumbered lists are unchanged.
   */
  numbering?:NumberingInput;
  /** Picture bullet for every entry (effective `design.listBullet: "image"` with a resolved icon logo). */
  bulletImage?:ListBulletImage;
  /**
   * `'none'` (effective `design.listBullet: "none"`): no marker and no hanging indent, so each entry starts at the left edge of
   * the list box and the marker of every entry is `{ none: true, text: '', indent: 0 }`. Nested levels still step in by 1.1 em.
   * A numbered list ignores it and keeps its numbers.
   */
  bullet?:'none';
  /**
   * LH-77: a list of one entry with a description draws as a heading over its text: the entry bold at LIST_HEADING_SCALE times the
   * list size, the description at the list size, no marker and no indent. Ignored unless the list has exactly that one entry and
   * no numbering. composeSlide sets it for a list block whose only entry has a description.
   */
  heading?:boolean;
  /**
   * LH-08: ruled rows (effective `design.listStyle: "rows"`): each first-level entry is a row, a hairline between two rows (`ListFit.rules`)
   * and LIST_ROWS_GAP em between them; no bullet (numbers stay). When every entry has a description and sits at the first level, the labels
   * are bold and, when the widest fits LIST_ROWS_LABEL_SHARE of the width on one line, sit in a column beside their descriptions (one em
   * apart, the first baselines aligned); otherwise each description sits under its label, as in a stacked list. Ignored for fewer than 2 entries.
   */
  rows?:boolean;
}
/** LH-77: the heading of a one-entry described list is one size step (a major third) above the list text. */
export const LIST_HEADING_SCALE=1.25;
/**
 * LH-85: the bullet of each nesting level, by `level % LIST_MARKERS.length`, drawn at the entry's size. Every bundled text face has
 * • (U+2022) and the en dash (U+2013); ◦ (U+25E6) and ▪ (U+25AA), the former level 1 and 2 bullets, are missing from most of them
 * (Roboto, Open Sans, Montserrat, Lora, Poppins and others) and drew a missing-glyph box in the preview. The levels alternate
 * bullet and dash, as PowerPoint's own default levels do. A smaller bullet would fall below the readability floor at the floor size.
 */
export const LIST_MARKERS:readonly string[]=['•','–'];

/** Reference-pixel starting size; explicit rich runs retain their authored sizes. */
function contentNominalSize(field:string):number { return field==='items'||field==='bullets'?LIST_NOMINAL_SIZE:field==='table'?TABLE_NOMINAL_SIZE:PROSE_NOMINAL_SIZE; }

/** Shared hanging indents, mixed-run fitting and description spacing for list payloads. */
export function fitList(input:readonly ListValue[],box:LayoutBox,requestedSize=contentNominalSize('items'),minFontSize=16,options:ListFitOptions={style:{fontFamily:'sans-serif',fontWeight:400}}):ListFit {
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
  const heading=options.heading===true&&!numbers&&source.length===1&&source[0]!.descriptionRuns!==undefined;
  // A native auto-number takes the weight and slant of the paragraph's first run.
  const markerStyleFor=(item:typeof source[number]):TextStyle=>{
    const first=item.runs.map(run=>typeof run==='string'?{text:run} as RichTextRun:run).find(run=>run.text);
    return {...options.style,path:item.textPath,fontWeight:first?.bold===undefined?options.style.fontWeight:first.bold?700:400,italic:first?.italic??options.style.italic};
  };
  // LH-08: ruled rows (ListFitOptions.rows).
  const rows=options.rows===true&&!heading&&source.length>=2,described=rows&&source.every(item=>item.descriptionRuns!==undefined);
  const rowsLayout=(fontSize:number):ListFit=>{
    let y=box.y,overflow=false;const entries:ListEntryLayout[]=[],lines:string[]=[],directions:TextDirection[]=[],rules:ListRule[]=[];
    const markerStyles=numbers?source.map(item=>resolveTextStyle(markerStyleFor(item),options.textMeasurement)):[];
    const markerWidths=numbers?numbers.map((number,index)=>textWidthMeasurer(markerStyles[index]!,options.textMeasurement)(number.text,fontSize)):[];
    // Only numbers keep a hanging indent: a row needs no bullet. A nested level steps in by 1.1 em under its row.
    const indent=numbers?Math.max(fontSize*1.1,Math.max(0,...markerWidths)+fontSize*.3):0,nest=fontSize*1.1;
    const labelStyle=(item:typeof source[number]):TextStyle=>({...options.style,path:item.textPath,...(described?{fontWeight:700}:{})});
    const labelAt=(item:typeof source[number],area:LayoutBox)=>richTextLayouter(item.runs,area,requestedSize,{...options,style:labelStyle(item)},minFontSize)(fontSize);
    // The label column: the widest label on one line, when that takes at most LIST_ROWS_LABEL_SHARE of the width.
    let column=0;
    if(described&&source.every(item=>item.level===0)){
      const widest=Math.max(...source.map(item=>Math.max(0,...labelAt(item,{x:0,y:0,width:1e6,height:1e6}).richLines.map(line=>line.width))));
      const need=indent+widest*1.001+1;
      if(need<=LIST_ROWS_LABEL_SHARE*box.width)column=need;
    }
    const between=fontSize,side=column>0;
    for(const item of source){
      const rtl=item.direction==='rtl',first=item.index===0;
      // A hairline in the middle of the gap above every first-level row but the first; a nested entry stays close under its row.
      if(!first){
        const space=fontSize*(item.level===0?LIST_ROWS_GAP:.28);
        if(item.level===0)rules.push({x:box.x,y:y+space/2,width:box.width});
        y+=space;
      }
      const offset=side?0:Math.min(box.width,item.level*nest),width=Math.max(1,side?column-indent:box.width-offset-indent);
      if(offset+indent>=box.width)overflow=true;
      const x=rtl?box.x+(side?box.width-column:0):box.x+offset+indent;
      const textBox={x,y,width,height:box.height},text=labelAt(item,textBox);
      textBox.height=text.height;
      let description:RichTextFit|undefined,descriptionBox:LayoutBox|undefined,bottom=y+text.height;
      if(item.descriptionRuns!==undefined){
        const ratio=.82,dx=side?(rtl?box.x:box.x+column+between):x,dWidth=side?Math.max(1,box.width-column-between):width;
        descriptionBox={x:dx,y:side?y:bottom+fontSize*.12,width:dWidth,height:box.height};
        description=richTextLayouter(item.descriptionRuns,descriptionBox,requestedSize*ratio,{...options,style:{...options.style,path:item.descriptionPath}},minFontSize)(fontSize*ratio);
        // Beside its label, a description's first baseline sits on the label's.
        if(side)descriptionBox.y+=Math.max(0,(text.richLines[0]?.baseline??fontSize)-(description.richLines[0]?.baseline??fontSize*ratio));
        descriptionBox.height=description.height;bottom=Math.max(bottom,descriptionBox.y+description.height);
      }
      lines.push(...text.lines);if(options.direction==='rtl')directions.push(...(text.directions??[]));
      if(description){lines.push(...description.lines);if(options.direction==='rtl')directions.push(...(description.directions??[]));}
      overflow||=text.overflow||!!description?.overflow;
      const number=numbers?.[item.index];
      const marker={text:number?number.text:'',x:rtl?(side?box.x+box.width:box.x+box.width-offset):box.x+offset,y:textBox.y+(text.richLines[0]?.baseline??fontSize),fontSize,style:number?markerStyles[item.index]!:resolveTextStyle(labelStyle(item),options.textMeasurement),indent,...(number?{number,width:markerWidths[item.index]!}:{none:true as const}),...(rtl?{anchor:'end' as const}:{})};
      entries.push({index:item.index,level:item.level,value:item.value,descriptionValue:item.descriptionValue,textPath:item.textPath,descriptionPath:item.descriptionPath,text,textBox,description,descriptionBox,marker,...(item.direction?{direction:item.direction}:{})});
      y=bottom;
    }
    const height=y-box.y;
    return {listEntries:entries,lines,fontSize,lineHeight:fontSize*1.22,height,overflow:overflow||height>box.height+.01,rules,...(options.direction==='rtl'?{directions}:{})};
  };
  const layout=(fontSize:number):ListFit=>{
    if(rows)return rowsLayout(fontSize);
    let y=box.y,overflow=false;const entries:ListEntryLayout[]=[],lines:string[]=[],directions:TextDirection[]=[];
    // One hanging indent for the whole list: 1.1 em, or for numbers the widest marker plus 0.3 em.
    const markerStyles=numbers?source.map(item=>resolveTextStyle(markerStyleFor(item),options.textMeasurement)):[];
    const markerWidths=numbers?numbers.map((number,index)=>textWidthMeasurer(markerStyles[index]!,options.textMeasurement)(number.text,fontSize)):[];
    // LH-77: the one described entry of a heading list draws without a marker or an indent, bold and a step up over its description.
    const none=(options.bullet==='none'||heading)&&!numbers;
    const hanging=numbers?Math.max(fontSize*1.1,Math.max(0,...markerWidths)+fontSize*.3):fontSize*1.1;
    for(const item of source){
      const rtl=item.direction==='rtl';
      // No marker: no hanging indent either; a nested level still steps in by one marker width.
      const indent=none?0:hanging,offset=heading?0:Math.min(box.width,item.level*hanging),x=rtl?box.x:box.x+offset+indent,width=Math.max(1,rtl?box.width-offset-indent:box.x+box.width-x);
      if(offset+indent>=box.width)overflow=true;
      const textBox={x,y,width,height:box.height};
      const style={...options.style,path:item.textPath};
      const text=heading?richTextLayouter(item.runs,textBox,requestedSize*LIST_HEADING_SCALE,{...options,style:{...style,fontWeight:700}},minFontSize)(fontSize*LIST_HEADING_SCALE)
        :richTextLayouter(item.runs,textBox,requestedSize,{...options,style},minFontSize)(fontSize);
      textBox.height=text.height;lines.push(...text.lines);if(options.direction==='rtl')directions.push(...(text.directions??[]));y+=text.height;
      let description:RichTextFit|undefined,descriptionBox:LayoutBox|undefined;
      if(item.descriptionRuns!==undefined){
        const ratio=heading?1:.82;
        y+=fontSize*(heading?.25:.12);descriptionBox={x,y,width,height:box.height};
        description=richTextLayouter(item.descriptionRuns,descriptionBox,requestedSize*ratio,{...options,style:{...options.style,path:item.descriptionPath}},minFontSize)(fontSize*ratio);
        descriptionBox.height=description.height;lines.push(...description.lines);if(options.direction==='rtl')directions.push(...(description.directions??[]));y+=description.height;
      }
      overflow ||= text.overflow||!!description?.overflow;
      const number=numbers?.[item.index];
      const marker={text:number?number.text:none?'':LIST_MARKERS[item.level%LIST_MARKERS.length]!,x:rtl?box.x+box.width-offset:box.x+offset,y:textBox.y+(text.richLines[0]?.baseline??fontSize),fontSize,style:number?markerStyles[item.index]!:resolveTextStyle(style,options.textMeasurement),indent,...(number?{number,width:markerWidths[item.index]!}:{}),...(none?{none:true as const}:{}),...(rtl?{anchor:'end' as const}:{})},side=fontSize*PICTURE_BULLET_SCALE;
      entries.push({index:item.index,level:item.level,value:item.value,descriptionValue:item.descriptionValue,textPath:item.textPath,descriptionPath:item.descriptionPath,text,textBox,description,descriptionBox,marker,...(heading?{heading:true as const}:{}),
        ...(item.direction?{direction:item.direction}:{}),
        ...(options.bulletImage&&!number&&!none?{bulletImage:options.bulletImage,bulletBox:{x:rtl?marker.x-side:marker.x,y:marker.y-side,width:side,height:side}}:{})});
      if(item.index<source.length-1)y+=fontSize*.28;
    }
    const height=y-box.y;
    return {listEntries:entries,lines,fontSize,lineHeight:fontSize*1.22,height,overflow:overflow||height>box.height+.01,...(options.direction==='rtl'?{directions}:{})};
  };
  let minimum=minFontSize;
  for(const item of source) {
    minimum=Math.max(minimum,richMinimum(item.runs,requestedSize,minFontSize));
    if(item.descriptionRuns!==undefined)minimum=Math.max(minimum,heading?richMinimum(item.descriptionRuns,requestedSize,minFontSize):richMinimum(item.descriptionRuns,requestedSize*.82,minFontSize)/.82);
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
/** LH-117: the share of a column's body cells that must read as numbers (numericText) for the column to align as numbers. */
export const TABLE_NUMERIC_SHARE = 0.75;
export interface TableLayoutOptions {
  /** Explicit resolved design alignment; absent, a column of numbers (LH-117) aligns at the end and every other at the start. A cell's style.align wins, then its header's. */
  alignment?: 'left' | 'center' | 'right';
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
  /**
   * LH-48: a lone table that fills too little of the body grows (`ComposedItem.tableGrowth`): its type by this factor up to
   * `LONE_DISPLAY_SIZES.table`, and its preferred row height with it. Engines pass the item's value so they lay it out as composition did.
   */
  growth?: number;
  /** LH-113: the body rows (0-based, after the header) drawn on the highlight tint (`ComposedItem.tableHighlight`); their cells are `highlighted`. */
  highlight?: readonly number[];
}
export interface TableCellLayout {
  /** Logical alignment, shared by preview and native export. A column of numbers (LH-117) resolves to the physical right even in RTL. */
  alignment: 'left' | 'center' | 'right';
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
  /** LH-113: a body cell of a highlighted row: without a fill of its own it takes the highlight tint (core `tableHighlightColor`). */
  highlighted?: true;
}
export interface TableRowLayout { box: LayoutBox; cells: TableCellLayout[] }
export interface TableLayout {
  rows: TableRowLayout[]; columnCount: number; height: number; overflow: boolean;
  /**
   * WI-5 (P20): the width of each grid column in canvas pixels, in logical column order (the first column is the rightmost in a right-to-left
   * deck). They sum to the table's width. Each column is as wide as its content asks, but never narrower than its longest unbreakable
   * word at the table's type size, and the preview and the PPTX export draw the same widths.
   */
  columnWidths: number[];
  /** WI-5: true when a word is wider than its cell at the type size the table settled on (the last resort of a table that cannot fit), so a line breaks inside the word. LH-44: the table then reports `overflow`. */
  splitsWords: boolean;
  /** LH-44: the sum of the columns' unwrapped widths (every cell on one line) at the settled type size: the width the table asks for. */
  naturalWidth: number;
  /** LH-44: the sum of the columns' minimum widths (each its longest word plus its padding) at the settled type size: below it a word breaks. */
  minimumWidth: number;
  /** LH-44: the height the rows' text and insets take at the settled type size, before the preferred 54 px row: the height the table needs. */
  naturalHeight: number;
}

/** Shared cell geometry and font fitting for SVG, native PPTX and pagination.
 * Short rows retain their 54px preferred height. Multiline rows use the space
 * their text needs; constrained tables consume row padding before readable text.
 * All dimensions are canvas pixels; minFontSize is an unscaled canvas size.
 */
export function layoutTable(value: unknown, box: LayoutBox, options: TableLayoutOptions = {}): TableLayout {
  const scale = options.scale ?? 1, minimum = snapFontSizeUp((options.minFontSize ?? 16) * scale), requested = gridFontSize(grownRoleSize(contentNominalSize('table'), options.growth, LONE_DISPLAY_SIZES.table) * scale,minimum);
  // LH-48: a grown table's rows grow with its type.
  const preferredRow = 54 * scale * Math.max(1, requested / gridFontSize(contentNominalSize('table') * scale, minimum));
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
  // LH-117: a column aligns by how its cells read, not by their JSON type. It is a column of numbers when at least
  // TABLE_NUMERIC_SHARE of its body cells (one column wide, not empty) read as numbers as shown (numericText: "$42", "+3%", "14,500",
  // "50 GB", a JSON number in its format; a rich cell by its text). Every cell of it, the header too, then aligns at the end; every
  // cell of any other column starts at the start edge, a JSON number among words included (5 beside "50 GB" and "Email"). A cell's own
  // align wins, then its column's (its header's align), then the design's.
  const numericColumns = new Set(Array.from({length: grid.columnCount}, (_, column) => column).filter(column => {
    const body = grid.rows.flat().filter(cell => !cell.header && cell.column === column && cell.colSpan === 1 && cell.value !== null && cell.value !== undefined && flatten(cell.value).trim() !== '');
    return body.length > 0 && body.filter(cell => numericText(flatten(cell.value))).length >= TABLE_NUMERIC_SHARE * body.length;
  }));
  const columnAlign = new Map(grid.rows.flat().flatMap(cell => cell.header && cell.colSpan === 1 && cell.style.align ? [[cell.column, cell.style.align] as const] : []));
  const columnCount=grid.columnCount;
  // LH-113: the highlighted body rows, counted after the header rows.
  const headerRows=Number(grid.hasHeaders),highlighted=new Set(options.highlight??[]);
  const cells=grid.rows.flat().map(cell=>{
    const padding={top:8,right:10,bottom:4,left:10,...cell.style.padding};
    const width=0;
    const style={fontFamily:options.fontFamily??'sans-serif',fontWeight:cell.header||cell.style.bold?700:400,italic:false,path:cell.valuePath};
    const numericDefault = cell.colSpan === 1 && numericColumns.has(cell.column);
    const alignment = cell.style.align ?? (cell.header ? undefined : columnAlign.get(cell.column)) ?? options.alignment ?? (numericDefault ? (options.direction === 'rtl' ? 'left' : 'right') : 'left');
    return {...cell,padding,width,textStyle:style,alignment};
  });
  const columnWidths=Array<number>(columnCount).fill(box.width/columnCount);
  const cellMinimum=(cell:typeof cells[number])=>Array.isArray(cell.value)?richMinimum(cell.value,requested,minimum):minimum;
  // RR-90: every cell is set at one trial size (the table shrinks together toward the floor, see the loop below). A run's own
  // fontSize stays relative to the nominal size, so `requested` is the reference and `trial` the size the cells are drawn at.
  let trial=requested;
  const cellSize=(cell:typeof cells[number])=>{const floor=cellMinimum(cell);return gridFontSize(Math.max(trial,floor),floor);};
  const fitCell=(cell:typeof cells[number],height:number):TextFit|RichTextFit=>{
    const textBox={x:0,y:0,width:Math.max(scale,cell.width),height:Math.max(scale,height)},size=cellSize(cell);
    return Array.isArray(cell.value)
      ? richTextLayouter(cell.value,textBox,requested,{style:cell.textStyle,...(options.codeFontFamily?{codeFontFamily:options.codeFontFamily}:{}),textMeasurement:options.textMeasurement,uniformLineHeight:true,direction:options.direction},minimum)(size)
      : fitText(flatten(cell.value),textBox,size,size,textWidthMeasurer(resolveTextStyle(cell.textStyle,options.textMeasurement),options.textMeasurement),options.direction);
  };
  // WI-5 (P20): column widths from content. A column's minimum is its longest unbreakable word (a run of non-space characters) at the trial size,
  // plus the cell padding; its maximum is its longest line on one line. Every column gets its maximum when they all fit, else its minimum plus a
  // share of the rest by how much more it asks for. When even the minimums do not fit the table, the trial size shrinks (see the loop below).
  const horizontalPadding=(cell:typeof cells[number])=>(cell.padding.left+cell.padding.right)*scale;
  const measureText=(cell:typeof cells[number])=>textWidthMeasurer(resolveTextStyle(cell.textStyle,options.textMeasurement),options.textMeasurement);
  const demand=(cell:typeof cells[number])=>{
    const measure=measureText(cell),size=cellSize(cell);
    let widest=0,longest=0;
    for(const line of flatten(cell.value).split(/\r\n|\r|\n/)){
      longest=Math.max(longest,measure(line.replace(/\t/g,'    '),size));
      for(const word of proseWords(line).map(entry=>entry.text)){
        if(!word)continue;
        // Text without word spaces (Han, kana, Thai ...) breaks between characters: its smallest piece is one character.
        widest=Math.max(widest,UNSPACED_SCRIPT.test(word)?Math.max(...[...word].map(character=>measure(character,size))):measure(word,size));
      }
    }
    const padding=horizontalPadding(cell),slack=.5*scale;
    return {min:widest>0?widest+padding+slack:padding,max:Math.max(longest+padding+slack,padding)};
  };
  let naturalWidth=0,minimumWidth=0;
  const sizeColumns=()=>{
    const min=Array<number>(columnCount).fill(0),max=Array<number>(columnCount).fill(0),demands=cells.map(demand);
    cells.forEach((cell,index)=>{if(cell.colSpan===1){min[cell.column]=Math.max(min[cell.column]!,demands[index]!.min);max[cell.column]=Math.max(max[cell.column]!,demands[index]!.max);}});
    // A spanning cell asks its columns, together, for its own minimum and maximum: any shortfall is shared equally.
    cells.forEach((cell,index)=>{if(cell.colSpan>1)for(const [need,target] of [[demands[index]!.min,min],[demands[index]!.max,max]] as const){
      const columns=Array.from({length:cell.colSpan},(_,offset)=>cell.column+offset),have=columns.reduce((sum,column)=>sum+target[column]!,0);
      if(need>have)for(const column of columns)target[column]!+=(need-have)/cell.colSpan;
    }});
    const total=box.width,sum=(values:number[])=>values.reduce((a,b)=>a+b,0);
    for(let column=0;column<columnCount;column++)max[column]=Math.max(max[column]!,min[column]!,1);
    const minTotal=sum(min),maxTotal=sum(max);
    let widths:number[];
    if(maxTotal<=total)widths=max.map(value=>value+(total-maxTotal)*value/maxTotal);
    else if(minTotal<=total){
      // Short columns keep what they ask for and the long ones share the rest evenly: one level, clamped to each column's [minimum, maximum].
      let low=0,high=total;
      for(let step=0;step<60;step++){const level=(low+high)/2;if(sum(min.map((value,column)=>Math.min(max[column]!,Math.max(value,level))))>total)high=level;else low=level;}
      widths=min.map((value,column)=>Math.min(max[column]!,Math.max(value,low)));
      const rest=total-sum(widths),open=widths.map((value,column)=>value>min[column]!+1e-9&&value<max[column]!-1e-9);
      const target=open.indexOf(true);
      if(target>=0)widths[target]!+=rest;else widths[widths.indexOf(Math.max(...widths))]!+=rest;
    }
    else widths=min.map(value=>value*total/Math.max(minTotal,Number.EPSILON));
    columnWidths.splice(0,columnCount,...widths);
    for(const cell of cells)cell.width=sum(columnWidths.slice(cell.column,cell.column+cell.colSpan))-horizontalPadding(cell);
    naturalWidth=maxTotal;minimumWidth=minTotal;
    return min;
  };
  // Whether some word is wider than its cell at the current trial size: the text would break inside the word.
  const splitsWords=()=>cells.some(cell=>demand(cell).min-.5*scale>cell.width+horizontalPadding(cell)+.01);
  const textHeight=(fit:TextFit|RichTextFit)=>'height' in fit?fit.height:fit.lines.length*fit.lineHeight;
  const required=(cell:typeof cells[number],natural:boolean)=>{
    const floor=cellMinimum(cell),size=gridFontSize(natural?Math.max(trial,floor):floor,floor);
    const textBox={x:0,y:0,width:Math.max(scale,cell.width),height:scale};
    const fit=Array.isArray(cell.value)
      ?richTextLayouter(cell.value,textBox,requested,{style:cell.textStyle,...(options.codeFontFamily?{codeFontFamily:options.codeFontFamily}:{}),textMeasurement:options.textMeasurement,uniformLineHeight:true},minimum)(size)
      :fitText(flatten(cell.value),textBox,size,size,textWidthMeasurer(resolveTextStyle(cell.textStyle,options.textMeasurement),options.textMeasurement));
    return textHeight(fit)+(cell.padding.top+cell.padding.bottom)*scale;
  };
  const place=():TableLayout=>{
  const natural=Array(grid.rowCount).fill(0) as number[],needed=Array(grid.rowCount).fill(0) as number[];
  for(const cell of cells)if(cell.rowSpan===1){natural[cell.row]=Math.max(natural[cell.row]!,required(cell,true));needed[cell.row]=Math.max(needed[cell.row]!,required(cell,false));}
  // Satisfy every spanning cell over its full rectangle. Added height can only
  // help previously processed constraints; no text is duplicated into covered rows.
  for(const cell of cells)if(cell.rowSpan>1)for(const [heights,preferredSize] of [[natural,true],[needed,false]] as const){
    const current=heights.slice(cell.row,cell.row+cell.rowSpan).reduce((a,b)=>a+b,0);
    const extra=Math.max(0,required(cell,preferredSize)-current)/cell.rowSpan;
    for(let r=cell.row;r<cell.row+cell.rowSpan;r++)heights[r]!+=extra;
  }
  const preferred=natural.map(height=>Math.max(preferredRow,height));
  for(let r=0;r<needed.length;r++)needed[r]=Math.min(preferred[r]!,needed[r]!);
  const sum=(values:number[])=>values.reduce((a,b)=>a+b,0);
  const preferredTotal=sum(preferred),naturalTotal=sum(natural),neededTotal=sum(needed);
  // LH-44: a row is never shorter than its text at the floor plus its insets (`needed`). Rows that do not fit at that height are
  // not squeezed over their text: the table keeps them, runs past its box and reports overflow.
  const heights=preferred.map((height,r)=>preferredTotal<=box.height?height:naturalTotal<=box.height
    ? natural[r]!+(height-natural[r]!)*(box.height-naturalTotal)/Math.max(Number.EPSILON,preferredTotal-naturalTotal)
    : neededTotal<=box.height
    ? needed[r]!+(natural[r]!-needed[r]!)*(box.height-neededTotal)/Math.max(Number.EPSILON,naturalTotal-neededTotal)
    : needed[r]!);
  const ys=[box.y];for(const height of heights)ys.push(ys.at(-1)!+height);
  let overflow=false;
  const rows:TableRowLayout[]=heights.map((height,r)=>({box:{x:box.x,y:ys[r]!,width:box.width,height},cells:[]}));
  for(const cell of cells){
    // Physical position: a right-to-left table starts at the right edge, so the columns after the cell's span come first.
    const before=options.direction==='rtl'?columnWidths.slice(cell.column+cell.colSpan):columnWidths.slice(0,cell.column);
    const cellBox={x:box.x+before.reduce((a,b)=>a+b,0),y:ys[cell.row]!,width:columnWidths.slice(cell.column,cell.column+cell.colSpan).reduce((a,b)=>a+b,0),height:ys[cell.row+cell.rowSpan]!-ys[cell.row]!};
    const available=cellBox.height-(cell.padding.top+cell.padding.bottom)*scale;
    const fit=fitCell(cell,available),height=textHeight(fit);
    const offset=cell.style.verticalAlign==='bottom'?Math.max(0,available-height):cell.style.verticalAlign==='middle'?Math.max(0,(available-height)/2):0;
    const textBox={x:cellBox.x+cell.padding.left*scale,y:cellBox.y+cell.padding.top*scale+offset,width:Math.max(scale,cell.width),height:Math.max(scale,available-offset)};
    overflow ||= cell.width<=0||available<=0||fit.overflow;
    rows[cell.row]!.cells.push({value:cell.value,input:cell.input,path:cell.valuePath,sourcePath:cell.path,style:cell.style,alignment:cell.alignment,row:cell.row,column:cell.column,rowSpan:cell.rowSpan,colSpan:cell.colSpan,header:cell.header,rich:Array.isArray(cell.value),box:cellBox,textBox,textStyle:resolveTextStyle(cell.textStyle,options.textMeasurement),fit,...(fit.directions?{direction:fit.directions[0]}:{}),...(!cell.header&&highlighted.has(cell.row-headerRows)?{highlighted:true as const}:{})});
  }
  overflow ||= sum(heights)>box.height+.01;
  return {rows,columnCount,height:sum(heights),overflow,columnWidths:[...columnWidths],splitsWords:false,naturalWidth,minimumWidth,naturalHeight:naturalTotal};
  };
  // Largest size first, one reference pixel at a time: the first size at which the text and rows fit the box is the table's size.
  for(let step=0;;step++){
    const raw=requested-step*scale,last=step===64||raw<=minimum;
    trial=last?snapFontSizeUp(minimum):gridFontSize(raw,minimum);
    sizeColumns();
    const layout=place(),splits=splitsWords();
    // A word that does not fit its column shrinks the table, within the fit rules, before any line breaks inside it. LH-44: a word
    // still too wide at the floor is overflow, so automatic composition gives the table another cell and a fixed cell reports it.
    if(last||(!layout.overflow&&!splits))return {...layout,overflow:layout.overflow||splits,splitsWords:splits};
  }
}
function tableOverflows(value: unknown, box: LayoutBox, scale: number, settings: Composition, options: ComposeSlideOptions, path?: string, growth?: number): boolean {
  return box.width <= 0 || box.height <= 0 || layoutTable(value,box,{scale,minFontSize:settings.minFontSize,fontFamily:options.fontFamilies?.body,...(options.fontFamilies?.code?{codeFontFamily:options.fontFamilies.code}:{}),textMeasurement:options.textMeasurement,path,presentation:options.presentation,...(growth?{growth}:{})}).overflow;
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
/** composeLayoutAreas composes the empty layout through composeSlide with this flag: a layout master has no cover logo. */
const LAYOUT_MASTER = Symbol('opf.layoutMaster');
/** One ListFit of every entry of a list laid out in columns, each at its column's position (ComposedItem.text). */
function mergeListColumns(columns: readonly ComposedListColumn[]): ListFit {
  const fits = columns.map(column => column.text), first = fits[0]!;
  const directions = fits.flatMap(fit => fit.directions ?? []);
  return { ...first, listEntries: fits.flatMap(fit => fit.listEntries), lines: fits.flatMap(fit => fit.lines), height: Math.max(...fits.map(fit => fit.height)), overflow: fits.some(fit => fit.overflow), ...(first.directions ? { directions } : {}), ...(fits.some(fit => fit.rules) ? { rules: fits.flatMap(fit => fit.rules ?? []) } : {}) };
}
/** Options of `composeLayoutAreas`: those of composeSlide (canvas, deck, theme, direction, ...) plus the layout's own. */
export interface LayoutAreasOptions extends Omit<ComposeSlideOptions, 'layout' | 'explain'> {
  /** Draw the layout mirrored (design.mirror). Default: the deck's design.mirror, then the layout's. */
  mirror?: boolean;
  /** A bled region reaches the slide edge, as on a composed slide. Default true; false gives its cell inside the content box. */
  bleed?: boolean;
  /** Placed-image bands the slide layout reserves, as image blocks with these placements would. */
  placements?: readonly { edge: ImageEdge; size?: number; inset?: boolean }[];
}
/** One area of a template on the empty layout. */
export interface ComposedLayoutArea {
  name: string;
  /** `title` or `subtitle`. */
  heading: boolean;
  box: LayoutBox;
  /** On the `title` area of a template without a `subtitle` area: the ctrTitle and subTitle sub-boxes (ComposedHeadingArea.parts). */
  parts?: { title: LayoutBox; subtitle: LayoutBox };
}
/**
 * The areas of a template composed for an empty slide, nothing collapsed: where a PowerPoint slide layout puts a
 * placeholder per area (design section 8). It is composeSlide's own geometry for a slide with a one-line title and
 * subtitle and every region kept (`empty: "keep"`, so an empty auto row holds two lines of body text), with the deck's
 * header and footer (`presentation`), the given placed-image bands and bleed, so the placeholders land on the boxes a
 * slide composes to wherever its content does not resize an auto row.
 */
export function composeLayoutAreas(layout: unknown, options: LayoutAreasOptions = {}): { contentBox: LayoutBox; areas: ComposedLayoutArea[] } {
  const template = layoutTemplate(layout), source = record(layout);
  const kept = withRegionRules(source, { empty: 'keep' });
  const { mirror, bleed = true, placements = [], ...compose } = options;
  const slide: Record<string, unknown> = {
    ...(template.title ? { title: 'Title', subtitle: 'Subtitle' } : {}),
    ...(placements.length ? { blocks: placements.map(placement => ({ image: 'https://example.invalid/placeholder.png', placement: { ...placement } })) } : {}),
    ...(mirror !== undefined ? { design: { mirror } } : {}),
  };
  const result = composeSlide(slide, { ...compose, layout: kept, [LAYOUT_MASTER]: true } as ComposeSlideOptions);
  const areas = template.areas.map((area): ComposedLayoutArea => {
    if (area.heading) {
      const found = result.headingAreas?.find(entry => entry.name === area.name);
      return { name: area.name, heading: true, box: found ? { ...found.box } : { x: 0, y: 0, width: 0, height: 0 }, ...(found?.parts ? { parts: found.parts } : {}) };
    }
    const region = result.regions!.find(entry => entry.name === area.name)!;
    return { name: area.name, heading: false, box: { ...(!bleed && region.areaBox ? region.areaBox : region.box) } };
  });
  return { contentBox: { ...result.contentBox }, areas };
}
/** composeSlide composes a template slide's body again with this flag: the automatic grid, keeping the record's design and composition. */
const RECOMPOSE = Symbol('opf.recompose');
/** composeSlide composes a template slide again with this flag: grouping leaves the blocks below the grid in place (no LH-46 join). */
const UNJOINED = Symbol('opf.unjoined');
/** LH-06: the size (canvas px) the automatic band or pill text starts at, when larger than its own: what the block fitted at without it. */
const EMPHASIS_SIZE = Symbol('opf.emphasisSize');
/** LH-06: compose the pill at the foot of the body, where it has room, rather than right after the text it follows. */
const PILL_AT_FOOT = Symbol('opf.pillAtFoot');
/** LH-68: each tile metric's fitted sizes as a stack, by item path and role: the floor of its tile's sizes. */
const TILE_FLOORS = Symbol('opf.tileFloors');
/** LH-06: the longest last text that becomes a foot band, and the longest that becomes a pill beside a lone long text, in characters. */
export const EMPHASIS_BAND_MAX_CHARACTERS = 60, EMPHASIS_PILL_MAX_CHARACTERS = 30;
/** LH-06 (widened): a last text of up to this many characters is a foot band when it follows two or more charts or tables (a takeaway). */
export const EMPHASIS_TAKEAWAY_MAX_CHARACTERS = 120;
/** LH-114: the longest quote (its text, without the marks) drawn as a pull line, in characters. */
export const QUOTE_PULL_MAX_CHARACTERS = 140;
/** LH-48: composeSlide composes an under-filled body again with its paragraphs and lists this many type-scale steps larger (growBody). */
const GROW = Symbol('opf.grow');
/** LH-48: composeSlide composes an under-filled body again in the middle of the space under the headings (growBody). */
const CENTER = Symbol('opf.center');
const overflowCount = (result: SlideComposition): number => result.diagnostics.filter(entry => entry.code === 'text-overflow' || entry.code === 'small-cell').length;
// LH-83: the parts that carry the reading text of a quote, code panel, metric or timeline. The others (attribution, filename,
// language, unit, delta, description, trend, a timeline's name, dates and notes) ask for 14 to 20 px, near the floor by design,
// so reaching it is no squeeze.
const MAIN_PARTS: ReadonlySet<string> = new Set(['body', 'value', 'label', 'what']);
// LH-83: how readable a composition's body is. `sizes`: the body sizes it settled on, in canvas pixels, each with whether it is at
// its readability floor: every text and list fit, every table's cell size, and each main part (MAIN_PARTS) of a quote, code panel,
// metric or timeline whose role asks for more than the floor. `overflows`: its text-overflow and small-cell diagnostics.
// `splitWords`: the plain fits (text, and the parts of a quote, code panel, metric or timeline) with a line break inside a word, as a
// grid too narrow for its content draws them. Headings are not body.
// `byPath` (wave 3): the smallest of those sizes per item or part path, which the wave 3 guard compares block by block.
// `wrappedCells` (LH-80 widened): the table cells set on more than one line.
function bodyReadability(result: SlideComposition, options: ComposeSlideOptions): { sizes: { size: number; atFloor: boolean }[]; overflows: number; splitWords: number; byPath: Map<string, number>; wrappedCells: number; splitValues: Set<string> } {
  const scale = Math.min(result.width, result.height) / 720, sizes: { size: number; atFloor: boolean }[] = [], byPath = new Map<string, number>();
  let splitWords = 0, wrappedCells = 0;
  const splitValues = new Set<string>();
  const split = (text: unknown, fit: unknown) => { if (typeof text === 'string' && Array.isArray(record(fit).sourceLines) && breaksInsideWord(text, fit as SourceTextFit)) splitWords++; };
  for (const item of result.items) {
    // LH-50: a label drawn as an eyebrow is set at the tag's role size, like the tag: it is no body.
    if (item.field === 'title' || item.field === 'subtitle' || item.field === 'tag' || item.eyebrow) continue;
    const floor = snapFontSizeUp((item.composition.minFontSize ?? 16) * scale);
    const add = (size: number | undefined, key = item.path) => {
      if (size === undefined || !Number.isFinite(size)) return;
      sizes.push({ size, atFloor: size <= floor + FONT_GRID_EPSILON });
      byPath.set(key, Math.min(byPath.get(key) ?? Infinity, size));
    };
    const internal = item.quoteLayout ?? item.codeLayout ?? item.metricLayout ?? item.timelineLayout;
    if (internal) {
      for (const part of internal.parts as readonly { role: string; text: string; requestedFontSize: number; minFontSize: number; fit?: { fontSize: number }; visible?: boolean }[]) {
        if (part.visible === false) continue;
        // LH-112: a value at display size reads at its role size (METRIC_ROLE_VALUE_SIZE); what it has above that is display headroom, which
        // an arrangement may spend (a KPI column, a picture track) like the free space around it.
        const display = part.role === 'value' && item.metricLayout?.display ? METRIC_ROLE_VALUE_SIZE * scale : Infinity;
        // LH-114: a pull line's body is a lead, not the quote's display size on a card: it keeps a key of its own, so the guard holds it to
        // the slide's smallest body size (every other block still keeps its own size), not to the card's larger quote.
        if (MAIN_PARTS.has(part.role) && part.requestedFontSize > part.minFontSize + FONT_GRID_EPSILON) add(part.fit === undefined ? undefined : Math.min(part.fit.fontSize, display), `${item.path}:${item.quoteLayout?.rule && part.role === 'body' ? 'pull' : part.role}`);
        split(part.text, part.fit);
        // LH-39: a figure (a value of one word) on more than one line is split, wherever the break falls ("$1." over "24M").
        if (part.role === 'value' && item.metricLayout && !/\s/u.test(part.text.trim()) && ((part.fit as { sourceLines?: unknown[] } | undefined)?.sourceLines?.length ?? 0) > 1) splitValues.add(`${item.path}:value`);
      }
    } else if (item.field === 'table') {
      let table: TableLayout | undefined;
      try { table = layoutTable(item.value, item.box, { scale, minFontSize: item.composition.minFontSize, fontFamily: options.fontFamilies?.body, ...(options.fontFamilies?.code ? { codeFontFamily: options.fontFamilies.code } : {}), textMeasurement: options.textMeasurement, presentation: options.presentation, ...(item.tableGrowth ? { growth: item.tableGrowth } : {}) }); } catch { table = undefined; }
      for (const row of table?.rows ?? []) for (const cell of row.cells) { add(cell.fit.fontSize); if (('richLines' in cell.fit ? (cell.fit as RichTextFit).richLines.length : cell.fit.lines.length) > 1) wrappedCells++; }
    } else { add(item.text?.fontSize); split(item.value, item.text); }
  }
  return { sizes, overflows: result.diagnostics.filter(entry => entry.code === 'text-overflow' || entry.code === 'small-cell').length, splitWords, byPath, wrappedCells, splitValues };
}
/**
 * Wave 3: composeLayout applies a guarded rule only when it is in RULES (every one when RULES is absent), and records in FIRED the
 * rules that changed something on the slide.
 */
const RULES = Symbol('opf.rules'), FIRED = Symbol('opf.fired');
/**
 * The wave 3 rules that rearrange or resize a slide's blocks, each of which must leave every block at least the size the slide has
 * without them: LH-89's nested gaps from the slide's gap (`nested-gaps`), LH-65's empty columns giving way (`empty-columns`), LH-72's measure column (`centered-column`), LH-78's lead size and card for a quote beside other blocks (`quote-beside`)
 * and the card alone (`quote-card`), LH-06's automatic foot band or pill (`emphasis-band`), LH-114's pull line (`pull-quote`), LH-121's
 * status words under a timeline's labels (`timeline-status`), LH-68's scorecard tiles (`metric-tiles`),
 * LH-86's long texts as full-width rows (`long-text-rows`), LH-66's minimum measure in the automatic grid (`reading-measure`), LH-67's
 * lead plus stack (`lead-stack`), LH-70's paragraph columns (`paragraph-columns`), LH-10's reading measure in a layout's regions
 * (`region-measure`), LH-64's one start for a row of cards of mixed kinds (`mixed-cards`), LH-47's stretched short last row of the
 * automatic grid (`short-row`), LH-120's 40% share of a bar chart in a row of three (`bar-chart-share`), and LH-112's start alignment
 * (`metric-start`) and display size, with LH-15's band, (`metric-display`) of a metric beside other blocks, LH-39's figure on one line
 * where it would wrap (`metric-figure`), LH-50's label as the eyebrow of the paragraph after it (`eyebrow`), and LH-08's ruled rows for
 * a list of short labels with descriptions (`list-rows`). LH-80 and LH-49's tracks are
 * alternatives composeSlide tries afterwards (automaticTracks) under the same guard; LH-52 and LH-71 only place blocks at the sizes they have.
 */
type GuardedRule = 'nested-gaps' | 'empty-columns' | 'centered-column' | 'region-measure' | 'mixed-cards' | 'short-row' | 'metric-start' | 'quote-beside' | 'quote-card' | 'emphasis-band' | 'pull-quote' | 'timeline-status' | 'metric-tiles' | 'long-text-rows' | 'reading-measure' | 'lead-stack' | 'paragraph-columns' | 'bar-chart-share' | 'metric-figure' | 'metric-display' | 'eyebrow' | 'list-rows';
/**
 * The guarded rules, tried in this order when the full set does not pass the guard: the smallest change first. LH-112's display size is
 * tried last, so it never displaces an arrangement of wave 3 or 4 (a lead plus stack, paragraph columns, a pull line) that reads well
 * without it.
 */
const GUARDED_RULES: readonly GuardedRule[] = ['nested-gaps', 'empty-columns', 'centered-column', 'region-measure', 'mixed-cards', 'short-row', 'metric-start', 'metric-figure', 'quote-beside', 'quote-card', 'emphasis-band', 'pull-quote', 'timeline-status', 'metric-tiles', 'long-text-rows', 'reading-measure', 'lead-stack', 'paragraph-columns', 'bar-chart-share', 'metric-display', 'eyebrow', 'list-rows'];
const NO_RULES: ReadonlySet<GuardedRule> = new Set();
/** LH-39: the rules a slide is first composed with: every one but `metric-figure`, which is tried on top of the rules the guard keeps (guardedCompose). */
const CORE_RULES: ReadonlySet<GuardedRule> = new Set(GUARDED_RULES.filter(rule => rule !== 'metric-figure'));
/** LH-39: the rules (and seeds) a guarded composition was kept with, for the figure trial on top of them. */
const KEPT_RULES = new WeakMap<SlideComposition, { rules: ReadonlySet<GuardedRule>; seeds: Record<symbol, unknown> }>();
/**
 * The guarded rules that move blocks and change gaps without changing the size any block asks for. When only these changed something
 * and the composition has no finding, no word split, no prose under the minimum measure and every block at the size it asked for
 * (AT_REQUEST), the slide without them cannot set a block larger, so the guard keeps it without composing that slide.
 */
const PLACEMENT_RULES: ReadonlySet<GuardedRule> = new Set(['nested-gaps', 'reading-measure', 'long-text-rows', 'centered-column', 'region-measure', 'mixed-cards', 'short-row', 'metric-start']);
const AT_REQUEST = new WeakSet<SlideComposition>();
/** LH-114: for a composition with a pull line, the size each pulled quote's body has without the guarded rules (trackQuality). */
const PULL_SIZES = new WeakMap<SlideComposition, Map<string, number>>();
/** LH-67 with LH-48: compositions with a lead plus stack, whose hierarchy (a larger lead) LH-48's body growth would flatten. */
const LEAD_STACKS = new WeakSet<SlideComposition>();
/**
 * LH-10 with LH-48: compositions where a paragraph of a layout region took the reading measure, and the flag that composes a slide
 * without it. A measured body is taller, so it may no longer be under-filled; settle then grows the body without the measure, since a
 * readable size outranks the measure.
 */
const REGION_MEASURED = new WeakSet<SlideComposition>(), NO_REGION_MEASURE = Symbol('opf.noRegionMeasure');
/** Wave 3: whether any block of `next` reads smaller than the same block of `base`. */
function shrinks(next: SlideComposition, base: SlideComposition, options: ComposeSlideOptions): boolean {
  const before = bodyReadability(base, options).byPath;
  for (const [path, size] of bodyReadability(next, options).byPath) { const was = before.get(path); if (was !== undefined && size < was - FONT_GRID_EPSILON) return true; }
  return false;
}
// LH-48: how much of the body's height its content takes, for a body of two or more paragraphs and lists (a lone block grows in
// composeLayout, fillLone): the height the blocks' text covers (their extents joined where they overlap, as side by side), over the body
// (the content box below the headings). `spare`: the height left under the content. Undefined for any other body.
function bodyFill(result: SlideComposition): { fill: number; spare: number } | undefined {
  // LH-06's band or pill and LH-114's pull line keep their own size and place; the blocks above (or below) them are the body that grows.
  if (LEAD_STACKS.has(result)) return undefined;
  const body = result.items.filter(item => !headings.has(item.field) && !item.eyebrow && !(item.emphasis && result.emphasis?.source !== 'authored') && !item.quoteLayout?.rule);
  // A template slide's body is its regions: blocks below the grid (a section's notes) are not a body that should grow.
  if (body.length < 2 || !body.every(item => (item.field === 'text' || item.field === 'items' || item.field === 'bullets') && item.text && !item.listColumns && !item.caption && (!result.regions || item.region !== undefined))) return undefined;
  const height = (fit: TextFit) => 'height' in fit && typeof fit.height === 'number' ? fit.height : Math.max(fit.lines.length * fit.lineHeight, fit.placement?.height ?? 0);
  const top = Math.min(...body.map(item => item.box.y)), bottom = Math.max(...body.map(item => item.box.y + height(item.text!)));
  const above = result.items.filter(item => headings.has(item.field) && item.box.y + item.box.height <= top + 1e-6);
  const bodyTop = Math.max(result.contentBox.y, ...above.map(item => item.box.y + item.box.height)), bodyBottom = result.contentBox.y + result.contentBox.height;
  if (bodyBottom - bodyTop <= 0) return undefined;
  // Wave 3 (LH-48 with LH-86 and LH-64): the height the text covers, the union of the blocks' text extents, not the span from the first to
  // the last: cards that share the body (LH-86's rows) or blocks a gap apart leave that space empty, so it does not count as filled.
  const extents = body.map(item => [item.box.y, item.box.y + height(item.text!)] as const).sort((a, b) => a[0] - b[0]);
  let covered = 0, reach = -Infinity;
  for (const [from, to] of extents) { if (to > reach) { covered += to - Math.max(from, reach); reach = to; } }
  return { fill: covered / (bodyBottom - bodyTop), spare: Math.max(0, bodyBottom - bottom) };
}
// LH-48: a body of two or more paragraphs and lists that fills under LONE_FILL of its height, with nothing overflowing, is composed again
// with all of them one, two or three steps of the type scale larger (GROW; each up to its display size), and the largest step that adds
// no finding, sets every block larger and fills at most LONE_TARGET is kept. The body then sits in the middle of the space under the
// headings where its rows hug their content (CENTER). Siblings keep one size (LH-43). A stacked record (statement, quote, closing)
// already centers its message.
function growBody(input: unknown, options: ComposeSlideOptions, result: SlideComposition): SlideComposition | undefined {
  if (options.fill === false || (options as Record<symbol, unknown>)[LAYOUT_MASTER] === true || overflowCount(result) > 0) return undefined;
  const start = bodyFill(result);
  if (!start || start.fill >= LONE_FILL) return undefined;
  // A body set at the readability floor is not short content: LH-83 may recompose it (settle), and growing would keep the floor layout.
  if (bodyReadability(result, options).sizes.some(entry => entry.atFloor)) return undefined;
  if (isLayoutTemplate(options.layout) && layoutTemplate(options.layout).stack !== undefined) return undefined;
  const smallest = (composed: SlideComposition) => Math.min(...composed.items.filter(item => !headings.has(item.field) && !item.eyebrow && !(item.emphasis && composed.emphasis?.source !== 'authored') && !item.quoteLayout?.rule).map(item => item.text!.fontSize));
  const before = trackQuality(result, options), floor = snapFontSizeUp((result.composition.minFontSize ?? 16) * Math.min(result.width, result.height) / 720);
  const attempt = (extra: Record<symbol, unknown>) => composeVariant(input, { ...options, ...extra } as ComposeSlideOptions, before, floor);
  let best = result, steps = 0;
  for (let next = 1; next <= 3; next++) {
    const grown = attempt({ [GROW]: next }), fill = grown && bodyFill(grown);
    if (!grown || !fill || overflowCount(grown) > 0 || fill.fill > LONE_TARGET || smallest(grown) <= smallest(best) + FONT_GRID_EPSILON || shrinks(grown, best, options)) break;
    best = grown; steps = next;
  }
  // LH-114: a body with a pull line is one stack with it at the top of the body, so it grows but is not centered.
  const centered = result.items.some(item => item.quoteLayout?.rule) ? undefined : attempt({ [GROW]: steps, [CENTER]: true }), fill = centered && bodyFill(centered);
  if (centered && fill && overflowCount(centered) === 0 && !shrinks(centered, best, options)) best = centered;
  return best === result ? undefined : best;
}
/**
 * Compose a validated Slide. Layout resolution remains the caller's responsibility.
 *
 * The wave 3 size guard, one for every rule (guardedCompose): no rule of wave 3 sets a block smaller than wave 2 does, unless that
 * removes a finding. Then the slide settles (settle): an under-filled body grows (LH-48), a template slide may be recomposed as the
 * automatic grid (LH-49 for a short plot, LH-83 at the floor), and an automatic slide may give its picture or chart a track (LH-80,
 * LH-49); each of those arrangements is guarded the same way and kept only when it reads as well as the guarded composition.
 */
export function composeSlide(input: unknown, options: ComposeSlideOptions = {}): SlideComposition {
  if ((options as Record<symbol, unknown>)[RULES] !== undefined) return composeArranged(input, options);
  return withPictureScrim(input, options, settle(input, options, guardedCompose(input, options)));
}
/**
 * The part of a text item's box its lines cover (alignment respected), so a backdrop is judged under the ink, not the empty box: the
 * contrast rules sample there and the automatic scrim (LH-02) covers it. Quote, metric and timeline items, and items without lines, keep their box.
 */
export function textInkBox(item: ComposedItem, measurement: TextMeasurement | undefined): LayoutBox {
  const fit = item.text;
  if (!fit || !Array.isArray(fit.lines) || !fit.lines.length || !item.textStyle || item.quoteLayout || item.metricLayout || item.timelineLayout) return item.box;
  try {
    const measure = textWidthMeasurer(item.textStyle, measurement);
    const width = Math.min(item.box.width, Math.max(...fit.lines.map((line) => measure(line, fit.fontSize))));
    const height = Math.min(item.box.height, fit.lines.length * fit.lineHeight);
    const x = item.alignment === 'center' ? item.box.x + (item.box.width - width) / 2 : item.alignment === 'right' ? item.box.x + item.box.width - width : item.box.x;
    return { x, y: item.box.y, width, height };
  } catch {
    return item.box;
  }
}
/**
 * LH-02: the automatic scrims of a picture background (picture-scrim.ts) over the slide's final geometry; they change no box or size. They
 * cover every item drawn straight on the picture (not a picture, video, code panel or table, which draw on fills of their own, nor an
 * item on a card or the emphasis surface), every caption and the header and footer text; a right-to-left slide covers whole boxes. The
 * slide's text color reaches 4.5:1 there, the muted color of header and footer text and of a quote, metric or timeline's footer too,
 * and the primary color of a metric value or timeline 3:1 (display sizes). An `overlay` key on the background (an overlay of the author's, or `false`) means no scrim.
 */
function withPictureScrim(input: unknown, options: ComposeSlideOptions, result: SlideComposition): SlideComposition {
  const background = result.backgroundImage;
  if (!background) return result;
  const authored = background.path === 'theme' ? options.themeBackground : background.path === 'design.background' ? record(record(options.presentation).design).background : record(record(input).design).background;
  if (background.overlay || record(authored).overlay !== undefined) return result;
  // The body and headings, the header and the footer each get a scrim of their own, so header and footer text at the slide's edges
  // does not stretch the body's scrim over the whole picture.
  const body: LayoutBox[] = [], header: LayoutBox[] = [], footer: LayoutBox[] = [];
  let accent = false, muted = false, line = 0;
  for (const item of result.items) {
    if (item.caption) body.push(item.caption.box);
    if (item.text && !item.frameBox && !item.emphasis) line = Math.max(line, item.text.lineHeight);
    if (item.frameBox || item.emphasis || item.codeLayout || ['image', 'video', 'code', 'table'].includes(item.field)) continue;
    body.push(result.direction === 'rtl' ? item.box : textInkBox(item, options.textMeasurement));
    if (item.quoteLayout || item.metricLayout || item.timelineLayout) muted = true;
    if (item.metricLayout || item.timelineLayout) accent = true;
  }
  for (const part of result.furniture?.parts ?? []) if (part.type === 'text') { (part.kind === 'header' ? header : footer).push(part.box); muted = true; }
  const roles = options.roles ?? resolveColorRoles({}, { tone: options.darkBackground ? 'dark' : 'light' });
  const texts = [{ color: roles.text, target: 4.5 }, ...(muted ? [{ color: roles.textSecondary, target: 4.5 }] : []), ...(accent ? [{ color: roles.primary, target: 3 }] : [])];
  // A recolored picture's pixels are not the ones measured, so it is bounded by the worst case.
  const luminance = background.recolor ? undefined : options.pictureLuminance?.(background.src);
  const scrims = pictureScrims({
    path: background.path, width: result.width, height: result.height, groups: [body, header, footer], texts, color: roles.background, bases: [roles.background, '#FFFFFF'],
    ...(background.opacity !== undefined ? { opacity: background.opacity } : {}), ...(background.picture ? { picture: background.picture.image } : {}),
    ...(luminance ? { luminance } : {}), scale: Math.min(result.width, result.height) / 720, ...(line ? { line } : {}),
  });
  if (scrims.length) result.backgroundImage = { ...background, scrims };
  return result;
}

/**
 * The wave 3 guard over one arrangement of the slide (`options` may ask for a recomposition): the slide is composed with every guarded
 * rule (GuardedRule), recording which changed something. When none did, that is the result: one composition, as before wave 3. When
 * only placement rules did (PLACEMENT_RULES) and every block got the size it asked for with no finding, it is kept as well. Otherwise
 * the slide is also composed without the rules (wave 2's composition, `base`), which seeds the two rules that start from a size there
 * (LH-68's tiles start each metric role at its stacked size, LH-06's band or pill starts its text at the size the block had), and the
 * result with the rules is kept when it reads as well as `base` (readsAsWell: no block's body size smaller, and no more findings, split
 * words or prose under the minimum measure; fewer findings may trade size, never below the floor). When it does not, each rule that
 * fired is added on its own, in GUARDED_RULES order, and kept when the slide still reads as well as `base`. Readable size wins over the
 * ideal measure, card or arrangement. Throws the strict composition's error when nothing composes.
 */
function guardedCore(input: unknown, options: ComposeSlideOptions): SlideComposition {
  const fired = new Set<GuardedRule>(), ruled = (rules: ReadonlySet<GuardedRule>, extra: Record<symbol, unknown> = {}) => ({ ...options, [RULES]: rules, ...extra } as ComposeSlideOptions);
  const attempt = (settings: ComposeSlideOptions): SlideComposition | undefined => {
    try { return composeArranged(input, settings); } catch (error) { if (error instanceof OPFCompositionError) return undefined; throw error; }
  };
  let failure: unknown, result: SlideComposition | undefined;
  try { result = composeArranged(input, ruled(CORE_RULES, { [FIRED]: fired })); } catch (error) { if (!(error instanceof OPFCompositionError)) throw error; failure = error; }
  if (fired.size && result && AT_REQUEST.has(result) && [...fired].every(rule => PLACEMENT_RULES.has(rule))) {
    const read = trackQuality(result, options);
    if (read.overflows === 0 && read.splitWords === 0 && read.narrow === 0) { KEPT_RULES.set(result, { rules: CORE_RULES, seeds: {} }); return result; }
  }
  if (fired.size) {
    let base: SlideComposition;
    try { base = composeArranged(input, ruled(NO_RULES)); } catch (error) { if (!(error instanceof OPFCompositionError) || !result) throw error; KEPT_RULES.set(result, { rules: CORE_RULES, seeds: {} }); return result; }
    const scale = Math.min(base.width, base.height) / 720, floor = snapFontSizeUp((base.composition.minFontSize ?? 16) * scale), before = trackQuality(base, options);
    const readsWell = (next: SlideComposition | undefined): next is SlideComposition => next !== undefined && readsAsWell(before, trackQuality(next, options), floor);
    // LH-68, LH-06: a tile metric starts every role at its stacked size in `base`, and a band or pill text at its block's size there.
    const seeds: Record<symbol, unknown> = {};
    if (fired.has('metric-tiles')) seeds[TILE_FLOORS] = new Map(base.items.filter(item => item.metricLayout).map(item => [item.path, Object.fromEntries(item.metricLayout!.parts.filter(part => part.visible && part.fit).map(part => [part.role, part.fit!.fontSize]))]));
    const surface = result?.emphasis && result.emphasis.source !== 'authored' ? result.emphasis.path : undefined;
    const bandSize = surface !== undefined ? base.items.find(item => item.path === `${surface}.text`)?.text?.fontSize : undefined;
    if (bandSize !== undefined) seeds[EMPHASIS_SIZE] = bandSize;
    if (Object.getOwnPropertySymbols(seeds).length) result = attempt(ruled(CORE_RULES, seeds));
    let keptRules: ReadonlySet<GuardedRule> = CORE_RULES;
    if (!readsWell(result)) {
      let kept: ReadonlySet<GuardedRule> = NO_RULES;
      result = base;
      keptRules = NO_RULES;
      for (const rule of GUARDED_RULES) {
        if (!fired.has(rule)) continue;
        const rules = new Set([...kept, rule]), trial = attempt(ruled(rules, seeds));
        if (readsWell(trial)) { kept = rules; result = trial; keptRules = rules; }
      }
    }
    KEPT_RULES.set(result!, { rules: keptRules, seeds });
    // LH-114: a pull line's quote is set at the lead size, which the guard does not hold against the card. Another arrangement of the
    // slide (a track, LH-48's growth) is compared with this one, so for that comparison its quote counts at the size it has without the
    // rules: an arrangement that draws the quote on a card again keeps that size; one that keeps the pull line is held to the lead.
    const pulled = result!.items.filter(item => item.quoteLayout?.rule).map(item => `${item.path}:body`), sizes = bodyReadability(base, options).byPath;
    if (pulled.some(key => sizes.has(key))) PULL_SIZES.set(result!, new Map(pulled.flatMap(key => sizes.has(key) ? [[key, sizes.get(key)!] as const] : [])));
  } else if (!result) throw failure;
  else KEPT_RULES.set(result, { rules: CORE_RULES, seeds: {} });
  return result!;
}
/**
 * The guarded composition (guardedCore), then LH-39's figure on one line: the rules it kept plus `metric-figure`, taken when a figure
 * would wrap otherwise and the slide reads as well (readsAsWellFigure: a split figure may take the next smaller size, and only it).
 */
function guardedCompose(input: unknown, options: ComposeSlideOptions): SlideComposition {
  const plain = guardedCore(input, options), used = KEPT_RULES.get(plain);
  if (!used) return plain;
  const fired = new Set<GuardedRule>();
  let figured: SlideComposition;
  try { figured = composeArranged(input, { ...options, [RULES]: new Set([...used.rules, 'metric-figure']), [FIRED]: fired, ...used.seeds } as ComposeSlideOptions); } catch (error) { if (error instanceof OPFCompositionError) return plain; throw error; }
  const scale = Math.min(plain.width, plain.height) / 720, floor = snapFontSizeUp((plain.composition.minFontSize ?? 16) * scale);
  if (!fired.has('metric-figure') || !readsAsWellFigure(trackQuality(plain, options), trackQuality(figured, options), floor)) return plain;
  const pulled = PULL_SIZES.get(plain);
  if (pulled) PULL_SIZES.set(figured, pulled);
  KEPT_RULES.set(figured, { rules: new Set([...used.rules, 'metric-figure']), seeds: used.seeds });
  return figured;
}
/**
 * The slide after its guarded composition (`result`): an under-filled body of paragraphs and lists grows (LH-48, growBody); a template
 * slide is recomposed as the automatic grid when the layout leaves a chart's plot too short (LH-49, chartRecomposition) or a body role
 * at the readability floor (LH-83, recomposeAtFloor); an automatic slide gives its one picture or chart a track (LH-80, LH-49,
 * automaticTracks). Each arrangement is composed under the guard (guardedCompose, composeVariant).
 */
function settle(input: unknown, options: ComposeSlideOptions, result: SlideComposition): SlideComposition {
  if ((options as Record<symbol, unknown>)[LAYOUT_MASTER] === true) return result;
  const grown = growBody(input, options, result);
  if (grown) return grown;
  if (REGION_MEASURED.has(result) && bodyFill(result)) {
    const plain = { ...options, [NO_REGION_MEASURE]: true } as ComposeSlideOptions, wide = growBody(input, plain, guardedCompose(input, plain));
    if (wide) return wide;
  }
  const kpis = kpiColumn(input, options, result);
  if (kpis) return kpis;
  if (!result.regions) return timelineUnderChart(input, options, result) ?? automaticTracks(input, options, result);
  const blocks = record(input).blocks;
  const recomposed = options.recompose === false || (Array.isArray(blocks) && blocks.some(block => record(block).region !== undefined)) ? result
    : chartRecomposition(input, options, result) ?? recomposeAtFloor(input, options, result);
  return recomposed !== result ? recomposed : centerTemplate(input, options, result) ?? result;
}
/** LH-102: the blocks whose need a layout measures (naturalHeight), so its regions can take their need in the middle of their cells. */
const CENTERED_FIELDS: ReadonlySet<string> = new Set(['text', 'items', 'bullets', 'quote', 'metric', 'code', 'table', 'timeline']);
/**
 * LH-102: a layout template's body that fills too little of its height sits in the middle of the space under the headings, as growBody
 * centers a body of paragraphs and lists (LH-48) and as Claude Design sets a short table, metric or comparison: composed again with
 * CENTER (its auto rows move down, its regions take their need in the middle of their cells, its cards hug), and kept when that body
 * covers under LONE_TARGET of the body height (LH-48 grows a body to at most that), moves as one (as much space above it as below)
 * and reads as well (readsAsWell, no block smaller). Only bodies of measured blocks: a picture,
 * chart or video outside a bled region keeps the layout's cell, since its need is an estimate. A stacked record already centers its
 * message, and blocks below the grid (a section's notes) are not a body.
 */
function centerTemplate(input: unknown, options: ComposeSlideOptions, result: SlideComposition): SlideComposition | undefined {
  if (options.fill === false || !result.regions || overflowCount(result) > 0 || !isLayoutTemplate(options.layout) || layoutTemplate(options.layout).stack !== undefined) return undefined;
  // LH-114 with LH-102: a body with a pull line is one stack with its data at the top of the body (as growBody leaves it), never centered.
  if (result.items.some(item => item.quoteLayout?.rule)) return undefined;
  const bled = new Set(result.regions.filter(region => region.bleed).map(region => region.name));
  const bodyOf = (composed: SlideComposition) => composed.items.filter(item => !headings.has(item.field) && !item.eyebrow && !(item.emphasis && composed.emphasis?.source !== 'authored'));
  const body = bodyOf(result);
  if (!body.length || !body.every(item => item.region !== undefined && (bled.has(item.region) || CENTERED_FIELDS.has(item.field))) || body.every(item => bled.has(item.region!))) return undefined;
  // A body of one region's one block is LH-48's lone block, which fillLone already grew and set in the middle of the body.
  if (result.regions.filter(region => region.content.length).length === 1 && result.regions.every(region => region.content.length <= 1)) return undefined;
  // First what the body's content covers as the layout placed it (each block's lines, parts or rows, not its cell): a body that already
  // covers LONE_TARGET is not composed again.
  const scale = Math.min(result.width, result.height) / 720, extentOf = (item: ComposedItem): readonly [number, number] => {
    const internal = item.quoteLayout ?? item.codeLayout ?? item.metricLayout ?? item.timelineLayout;
    if (internal) { const parts = (internal.parts as readonly { box: LayoutBox }[]); return [Math.min(item.box.y, ...parts.map(part => part.box.y)), Math.max(...parts.map(part => part.box.y + part.box.height), item.box.y)]; }
    if (item.field === 'table') {
      let table: TableLayout | undefined;
      try { table = layoutTable(item.value, item.box, { scale, minFontSize: item.composition.minFontSize, fontFamily: options.fontFamilies?.body, ...(options.fontFamilies?.code ? { codeFontFamily: options.fontFamilies.code } : {}), textMeasurement: options.textMeasurement, presentation: options.presentation, ...(item.tableGrowth ? { growth: item.tableGrowth } : {}) }); } catch { table = undefined; }
      return [item.box.y, item.box.y + Math.min(item.box.height, table?.height ?? item.box.height)];
    }
    const fit = item.text;
    return [item.box.y, item.box.y + (fit ? Math.min(item.box.height, 'height' in fit && typeof fit.height === 'number' ? fit.height : Math.max(fit.lines.length * fit.lineHeight, fit.placement?.height ?? 0)) : item.box.height)];
  };
  const coverage = (extents: (readonly [number, number])[]) => {
    let covered = 0, reach = -Infinity;
    for (const [from, to] of [...extents].sort((a, b) => a[0] - b[0])) { if (to > reach) { covered += to - Math.max(from, reach); reach = to; } }
    return { covered, reach };
  };
  if (coverage(body.filter(item => !bled.has(item.region!)).map(extentOf)).covered >= LONE_TARGET * bodyHeight(result)) return undefined;
  const before = trackQuality(result, options), floor = snapFontSizeUp((result.composition.minFontSize ?? 16) * scale);
  const centered = composeVariant(input, { ...options, [CENTER]: true } as ComposeSlideOptions, before, floor);
  if (!centered || overflowCount(centered) > 0 || !readsAsWell(before, trackQuality(centered, options), floor) || shrinks(centered, result, options)) return undefined;
  // What the centered body covers (its blocks hug their need there), joined where blocks sit side by side, over the body's height.
  const { covered, reach } = coverage(bodyOf(centered).filter(item => !bled.has(item.region!)).map(item => [item.box.y, item.box.y + item.box.height] as const));
  const height = bodyHeight(centered), top = (composed: SlideComposition) => Math.min(...bodyOf(composed).filter(item => !bled.has(item.region!)).map(item => item.box.y));
  // The body moves as one: a region the layout holds at the foot (a note under a table) would leave the rest floating between them.
  const end = centered.contentBox.y + centered.contentBox.height, above = top(centered) - (end - height), below = end - reach;
  return height > 0 && covered < LONE_TARGET * height && top(centered) > top(result) + 1 && Math.abs(above - below) <= .1 * height ? centered : undefined;
}
/**
 * Wave 2 (LH-46 with LH-44 and LH-41): extra blocks that join a fixed region share its cells. Measured blocks (tables, timelines, code)
 * that need more room than those cells give overflow there, where below the grid they read whole (three tables in table-beside's narrow
 * region broke their words). The joined composition is kept unless leaving the extra blocks below the grid overflows less.
 */
function composeArranged(input: unknown, options: ComposeSlideOptions): SlideComposition {
  const joined = composeLayout(input, options);
  if (!joined.regions || (options as Record<symbol, unknown>)[LAYOUT_MASTER] === true || overflowCount(joined) === 0) return joined;
  const unjoined = composeLayout(input, { ...options, [UNJOINED]: true } as ComposeSlideOptions);
  return overflowCount(unjoined) < overflowCount(joined) ? unjoined : joined;
}
/**
 * Wave 3: one more arrangement of a slide that composeSlide already composed under the guard (a track, LH-80 and LH-49, or a larger body,
 * LH-48), composed with the guarded rules (GuardedRule) and, when one of them changed something and that reads less well than `before`
 * (the slide's own guarded composition), without them and then with each rule that fired added on its own while it reads as well as
 * `before`. The caller keeps it only when it reads as well as `before`, so neither the arrangement nor a rule leaves a block smaller
 * than wave 2 did, and each arrangement keeps the rules that read well in it.
 */
function composeVariant(input: unknown, options: ComposeSlideOptions, before: TrackQuality, floor: number): SlideComposition | undefined {
  const fired = new Set<GuardedRule>(), compose = (rules: ReadonlySet<GuardedRule>, collect?: Set<GuardedRule>) => {
    try { return composeLayout(input, { ...options, [RULES]: rules, ...(collect ? { [FIRED]: collect } : {}) } as ComposeSlideOptions); }
    catch (error) { if (error instanceof OPFCompositionError) return undefined; throw error; }
  };
  const reads = (next: SlideComposition | undefined) => next !== undefined && readsAsWell(before, trackQuality(next, options), floor);
  const ruled = compose(CORE_RULES, fired);
  // LH-39: the figure on one line is tried on top of the rules this arrangement keeps, as guardedCompose does.
  const figure = (rules: ReadonlySet<GuardedRule>, current: SlideComposition | undefined): SlideComposition | undefined => {
    const collect = new Set<GuardedRule>(), next = compose(new Set([...rules, 'metric-figure']), collect);
    return next && collect.has('metric-figure') && readsAsWellFigure(before, trackQuality(next, options), floor) ? next : current;
  };
  if (!fired.size || reads(ruled)) return figure(CORE_RULES, ruled);
  // As guardedCompose: without the rules, then each rule that fired added on its own while the arrangement still reads as well.
  let kept: ReadonlySet<GuardedRule> = NO_RULES, best = compose(NO_RULES);
  for (const rule of GUARDED_RULES) {
    if (!fired.has(rule)) continue;
    const rules = new Set([...kept, rule]), trial = compose(rules);
    if (reads(trial)) { kept = rules; best = trial; }
  }
  return figure(kept, best);
}
/**
 * LH-83: a layout template that sets a body role at the readability floor gave its content too little room. The same blocks are
 * then composed as the automatic grid (dynamic composition) with the layout record's design and composition, and that result is
 * kept when its smallest body size is larger (or as large with less overflow) and it neither overflows nor splits words more
 * (`recomposed`); otherwise the layout's result stands. A slide the layout fits above the floor, a cover, a slide with promoted
 * regions or a block pinned to a region (`region`), a layout master and `recompose: false` keep the layout's composition unchanged.
 * Both passes are pure, so the choice is deterministic.
 */
function recomposeAtFloor(input: unknown, options: ComposeSlideOptions, result: SlideComposition): SlideComposition {
  const before = bodyReadability(result, options);
  if (!before.sizes.some(entry => entry.atFloor)) return result;
  let automatic: SlideComposition;
  // A strict automatic grid that does not fit is no better than the layout: the layout's result stands.
  try { automatic = guardedCompose(input, { ...options, [RECOMPOSE]: true } as ComposeSlideOptions); }
  catch (error) { if (error instanceof OPFCompositionError) return result; throw error; }
  const after = bodyReadability(automatic, options);
  const scale = Math.min(result.width, result.height) / 720, layoutSize = Math.min(...before.sizes.map(entry => entry.size)), size = Math.min(...after.sizes.map(entry => entry.size));
  // Wave 2 (LH-83 with LH-43): sibling sets share one size, so an automatic grid that fits everything at the floor no longer shows a
  // larger smallest size than the overfull layout; it is kept too, since it draws what the layout overflows.
  const larger = size > layoutSize + FONT_GRID_EPSILON, fitsMore = size >= layoutSize - FONT_GRID_EPSILON && after.overflows < before.overflows;
  if (!after.sizes.length || !(larger || fitsMore) || after.overflows > before.overflows || after.splitWords > before.splitWords) return result;
  return { ...automatic, recomposed: { layoutSize: layoutSize / scale, size: size / scale } };
}
/**
 * LH-115, automatic composition (no layout record, no composition mode, columns or weights of the slide's own): a slide of two blocks, a
 * timeline and a column chart, whose events' `when` values are the chart's categories in the same order, is composed again with the
 * chart above and the timeline below it, laid out as one band under the plot so that each event's marker and label sit under its
 * column (Claude Design's "ramp with milestones"). Kept only when it reads as well as the slide without it (readsAsWell) and the
 * timeline did take the band under the plot; otherwise undefined and the slide stands.
 */
function timelineUnderChart(input: unknown, options: ComposeSlideOptions, base: SlideComposition): SlideComposition | undefined {
  const slide = record(input), blocks = slide.blocks, own = record(slide.composition);
  if (!Array.isArray(blocks) || blocks.length !== 2 || (options.layout !== null && typeof options.layout === 'object') || Object.keys(slide).some(key => regionParts(key))) return undefined;
  if (own.mode !== undefined || own.columns !== undefined || (Array.isArray(own.weights) && own.weights.length)) return undefined;
  const hosts = blocks.map(record);
  if (hosts.some(host => host.placement !== undefined || host.region !== undefined || Array.isArray(host.blocks))) return undefined;
  const chart = hosts.find(host => record(host.chart).type !== undefined)?.chart, timeline = hosts.find(host => host.timeline !== undefined)?.timeline;
  const type = typeof record(chart).type === 'string' ? String(record(chart).type).trim().toLowerCase() : '';
  if (!chart || timeline === undefined || !['column', 'stacked-column', '100pct-stacked-column'].includes(type)) return undefined;
  const events: unknown[] = Array.isArray(timeline) ? timeline : Array.isArray(record(timeline).events) ? record(timeline).events as unknown[] : [];
  const whens = events.map(event => record(event).when);
  const data = resolveChartData(chart, options.presentation);
  if (!data.ok || data.combo || data.hasX || !whens.every((when): when is string => typeof when === 'string')) return undefined;
  const categories = data.rows.map(row => row[0] === null || row[0] === undefined ? '' : String(row[0]));
  if (!sameKeys(whens, categories, quoteLanguage(options.presentation, options.slideIndex) ?? 'en')) return undefined;
  const scale = Math.min(base.width, base.height) / 720, before = trackQuality(base, options), floor = snapFontSizeUp((base.composition.minFontSize ?? 16) * scale);
  const result = composeVariant(input, { ...options, [TIMELINE_UNDER_CHART]: true } as ComposeSlideOptions, before, floor);
  if (!result || !readsAsWell(before, trackQuality(result, options), floor)) return undefined;
  const chartItem = result.items.find(item => item.field === 'chart'), timelineItem = result.items.find(item => item.timelineLayout);
  if (!chartItem || !timelineItem || timelineItem.timelineLayout!.arrangement !== 'band' || timelineItem.box.y < chartItem.box.y + chartItem.box.height - .5) return undefined;
  if (shortPlot(chartItem, bodyHeight(result), scale, false)) return undefined;
  return result;
}
/** LH-61: the shares of the content width a chart beside its KPI column tries, widest first (the column takes the rest, about a third). */
const KPI_CHART_SHARES: readonly number[] = [.67, .6];
/**
 * LH-61: a slide whose body is one or two metrics and one chart, and at most one table, with the metrics composed above the chart (a
 * dashboard stacks its KPI row over its charts), is composed again with the metrics and the table in a column about a third of the width
 * (KPI_CHART_SHARES) and the chart in a full-height track beside it: the automatic grid for a layout template (as LH-49 recomposes it, with
 * the record's design), the chart track for an automatic slide. The chart keeps its side of the metrics (after them, at the end). Kept
 * (`track`; on a template slide also `recomposed`) when its plot is at least as tall and it reads as well as `result` (readsAsWell);
 * otherwise undefined. A slide with promoted regions, a block pinned to a region or placed, a layout master and, on a template slide,
 * `recompose: false` keep their composition.
 */
function kpiColumn(input: unknown, options: ComposeSlideOptions, result: SlideComposition): SlideComposition | undefined {
  const slide = record(input), blocks = slide.blocks;
  if (!Array.isArray(blocks) || Object.keys(slide).some(key => regionParts(key)) || (result.regions && options.recompose === false)) return undefined;
  if (blocks.some(block => record(block).region !== undefined || record(block).placement !== undefined || Array.isArray(record(block).blocks))) return undefined;
  const kinds = blocks.map(block => ['metric', 'chart', 'table'].find(field => record(block)[field] !== undefined) ?? 'other');
  const count = (kind: string) => kinds.filter(entry => entry === kind).length;
  if (count('other') || count('chart') !== 1 || count('metric') < 1 || count('metric') > 2 || count('table') > 1) return undefined;
  const chart = result.items.find(item => item.field === 'chart'), metrics = result.items.filter(item => item.field === 'metric');
  if (!chart || metrics.length !== count('metric') || !metrics.every(item => item.box.y + item.box.height <= chart.box.y + 1)) return undefined;
  const scale = Math.min(result.width, result.height) / 720, landscape = result.width >= result.height;
  if (!landscape) return undefined;
  const before = trackQuality(result, options), floor = snapFontSizeUp((result.composition.minFontSize ?? 16) * scale), plot = chartPlotBox(chart, scale);
  const chartIndex = kinds.indexOf('chart'), edge: ImageEdge = chartIndex === 0 ? 'left' : 'right';
  for (const share of KPI_CHART_SHARES) {
    const extra = { [CHART_TRACK]: { edge, share, mode: 'column' }, ...(result.regions ? { [RECOMPOSE]: true } : {}) };
    const next = composeVariant(input, { ...options, ...extra } as ComposeSlideOptions, before, floor), placed = next?.items.find(item => item.field === 'chart');
    if (!next || !placed || overflowCount(next) > overflowCount(result) || !readsAsWell(before, trackQuality(next, options), floor)) continue;
    const nextPlot = chartPlotBox(placed, scale);
    if (nextPlot.height < plot.height - .5) continue;
    const after = trackQuality(next, options), physical: ImageEdge = result.direction === 'rtl' ? (edge === 'left' ? 'right' : 'left') : edge;
    const track = { kind: 'chart' as const, edge: physical, size: round(placed.box.width / result.width), path: `slides.${options.slideIndex ?? 0}.blocks.${chartIndex}` };
    return { ...next, track, ...(result.regions ? { recomposed: { layoutSize: before.size / scale, size: after.size / scale, chart: { layoutPlot: round(plot.height / scale), plot: round(nextPlot.height / scale) }, kpis: true as const } } : {}) };
  }
  return undefined;
}
/** composeSlide composes an automatic slide again with one of these: its one picture as a side band (LH-80), its one chart as the root's first or last track (LH-49). */
const MEDIA_TRACK = Symbol('opf.mediaTrack');
const CHART_TRACK = Symbol('opf.chartTrack');
/** LH-115: composeSlide composes a slide of a timeline and a column chart of the same keys again with the timeline under the plot. */
const TIMELINE_UNDER_CHART = Symbol('opf.timelineUnderChart');
/** LH-80: the shares of the slide's width (height on a portrait canvas) a picture's track tries, widest first. */
const MEDIA_TRACK_SHARES: readonly number[] = [.5, .45, .4, .35];
/** LH-80: a picture's track keeps at least this share of the picture's width (or height) in its cover crop; a narrower track is not tried. */
const MEDIA_TRACK_MIN_KEPT = .5;
/** LH-49: the shares of the slide's width (height on a portrait canvas) a chart's track tries, widest first (3:2 is design.chartPrimary's). */
const CHART_TRACK_SHARES: readonly number[] = [.6, .55, .5];
/**
 * LH-49: the smallest plot a chart draws in automatic composition: at least CHART_MIN_PLOT_PX reference pixels and CHART_MIN_PLOT_SHARE
 * of the body's height tall, and at most CHART_MAX_PLOT_ASPECT times as wide as tall.
 */
export const CHART_MIN_PLOT_PX = 120, CHART_MIN_PLOT_SHARE = .22, CHART_MAX_PLOT_ASPECT = 3;
/**
 * LH-66: whether a paragraph (a text block) runs on a measure under MIN_MEASURE_CHARS at `width` and `size`: it wraps there and reads
 * as running text, MEASURE_MIN_LINES lines or more (core's estimate). A label that takes a line or two keeps any measure, and a list keeps
 * its own rules (LH-42): its entries are short lines that read in a narrow column.
 */
function underMeasure(field: string, value: unknown, width: number, size: number): boolean {
  if (field !== 'text' || !(size > 0) || width >= MIN_MEASURE_CHARS * AVERAGE_CHARACTER_EM * size - .5) return false;
  const lines = flatten(value).split('\n').map(line => wrapText(line, Math.max(1, width), size).length);
  return lines.some(count => count > 1) && lines.reduce((sum, count) => sum + Math.max(1, count), 0) >= MEASURE_MIN_LINES;
}
/**
 * LH-49: the box a composed chart's plot is drawn in, as the engines lay it out: the chart box less the chart layer's header row, the
 * chart's padding (10 reference px a side), a row of category labels and half a row above the plot (a whole one for a small chart's value
 * labels), and the value axis labels (three ems) beside it. The rows are 1.5 lines of the chart text size (chartTextSize).
 */
export function chartPlotBox(item: Pick<ComposedItem, 'box' | 'chart' | 'composition'>, scale: number): LayoutBox {
  const { box } = item, text = chartTextSize({ width: box.width, height: box.height, scale, minFontSize: item.composition?.minFontSize }) * scale;
  const pad = 10 * scale, row = 1.5 * text, header = item.chart?.layer?.header?.height ?? 0, labels = item.chart?.layer?.small?.labels ? row : row / 2;
  const axis = item.chart?.layer?.small?.valueAxis === false ? 0 : 3 * text;
  const top = box.y + header + pad + labels, height = Math.max(0, box.height - header - 2 * pad - labels - row);
  return { x: box.x + pad + axis, y: top, width: Math.max(0, box.width - 2 * pad - axis), height };
}
/**
 * Wave 3: how well a composition reads, for comparing it with the same slide composed another way (the one measure of the wave 3 guard).
 * `overflows`: its findings (text-overflow, small-cell, layout-unplaced); `blocks`: the body size of every text, list and table and of
 * each main part of a quote, code panel, metric or timeline (bodyReadability's `byPath`); `narrow` and `measure`: the paragraphs under
 * the minimum measure (LH-66) and the shortest of their measures; `shortPlots`: the charts whose plot is under LH-49's minimum height.
 */
interface TrackQuality { overflows: number; splitWords: number; size: number; total: number; narrow: number; measure: number; blocks: Map<string, number>; wrappedCells: number; shortPlots: number; splitValues: Set<string> }
function trackQuality(result: SlideComposition, options: ComposeSlideOptions): TrackQuality {
  const read = bodyReadability(result, options), unplaced = result.diagnostics.filter(entry => entry.code === 'layout-unplaced').length;
  const narrow = result.items.filter(item => item.text && underMeasure(item.field, item.value, item.box.width, item.text.fontSize));
  const measure = Math.min(Infinity, ...narrow.map(item => item.box.width / (AVERAGE_CHARACTER_EM * item.text!.fontSize)));
  const pulled = PULL_SIZES.get(result), blocks = pulled ? new Map([...read.byPath, ...pulled]) : read.byPath;
  const charts = result.items.filter(item => item.field === 'chart' && item.chart), scale = Math.min(result.width, result.height) / 720;
  const shortPlots = charts.length ? charts.filter(item => shortPlot(item, bodyHeight(result), scale, false)).length : 0;
  return { overflows: read.overflows + unplaced, splitWords: read.splitWords, size: read.sizes.length ? Math.min(...read.sizes.map(entry => entry.size)) : Infinity, total: read.sizes.reduce((sum, entry) => sum + entry.size, 0), narrow: narrow.length, measure, blocks, wrappedCells: read.wrappedCells, shortPlots, splitValues: read.splitValues };
}
/**
 * Wave 3: `after` reads as well as `before`: no more findings, no more words split (LH-39: nor figures split across lines), no more prose under the minimum measure and none
 * on a shorter measure than before, and no block's body size smaller (nor the smallest body size). A rule or arrangement never costs
 * the text its size: only to leave fewer findings may `after` be smaller, and never below the readability floor. Wave 4: nor does it
 * leave more charts with a plot under LH-49's minimum height (a pull line took the quote out of a 2 x 2 grid of a metric, a chart, a
 * table and a quote, and the three left in a row squeezed the chart's plot to a strip: b02 s29, b12 s19, b15 s44).
 */
function readsAsWell(before: TrackQuality, after: TrackQuality, floor: number): boolean {
  if (after.overflows > before.overflows || after.splitWords > before.splitWords || after.splitValues.size > before.splitValues.size || after.narrow > before.narrow || after.measure < before.measure - .01 || after.shortPlots > before.shortPlots) return false;
  const kept = after.size >= before.size - FONT_GRID_EPSILON && [...before.blocks].every(([path, size]) => (after.blocks.get(path) ?? Infinity) >= size - FONT_GRID_EPSILON);
  return kept || (after.overflows < before.overflows && after.size >= floor - FONT_GRID_EPSILON);
}
/**
 * LH-39: readsAsWell, or a figure set on one line at a smaller size. A figure split across lines ("$1." over "24M") reads as badly as an
 * overflow, so `after` may take a smaller size for a metric value that was split in `before` (and only for one), when it splits fewer
 * words, nothing else reads worse and no size falls under the floor.
 */
function readsAsWellFigure(before: TrackQuality, after: TrackQuality, floor: number): boolean {
  if (readsAsWell(before, after, floor)) return true;
  if (after.overflows > before.overflows || after.splitWords > before.splitWords || after.splitValues.size >= before.splitValues.size || after.narrow > before.narrow || after.measure < before.measure - .01 || after.shortPlots > before.shortPlots) return false;
  for (const [path, size] of before.blocks) if ((after.blocks.get(path) ?? Infinity) < size - FONT_GRID_EPSILON && !before.splitValues.has(path)) return false;
  return after.size >= floor - FONT_GRID_EPSILON;
}
/**
 * LH-49: whether a composed chart's plot (chartPlotBox) is under the minimum of a body `bodyHeight` tall: too short or, with `aspect`,
 * more than CHART_MAX_PLOT_ASPECT times as wide as tall.
 */
function shortPlot(item: ComposedItem, bodyHeight: number, scale: number, aspect = true): boolean {
  const plot = chartPlotBox(item, scale);
  return plot.height < Math.max(CHART_MIN_PLOT_PX * scale, CHART_MIN_PLOT_SHARE * bodyHeight) - .5 || (aspect && plot.width > CHART_MAX_PLOT_ASPECT * plot.height + .5);
}
/** The height of a composition's body: its content box, below the template's heading areas when it has them. */
function bodyHeight(result: SlideComposition): number {
  const box = result.contentBox, top = Math.max(box.y, ...(result.headingAreas ?? []).filter(area => !area.collapsed).map(area => area.box.y + area.box.height));
  return Math.max(0, box.y + box.height - top);
}
/**
 * LH-49, a layout template: a chart the layout leaves a plot shorter than its minimum (shortPlot; a wide chart region the layout draws on
 * purpose keeps its proportions) has too little room there, so the blocks are composed as the automatic grid (as LH-83 does at the readability floor). That composition is kept (`recomposed`) when its shortest
 * plot is taller and it reads as well (readsAsWell); otherwise undefined and the layout stands.
 */
function chartRecomposition(input: unknown, options: ComposeSlideOptions, result: SlideComposition): SlideComposition | undefined {
  const scale = Math.min(result.width, result.height) / 720, charts = result.items.filter(item => item.field === 'chart');
  if (!charts.some(item => shortPlot(item, bodyHeight(result), scale, false))) return undefined;
  let automatic: SlideComposition;
  try { automatic = guardedCompose(input, { ...options, [RECOMPOSE]: true } as ComposeSlideOptions); }
  catch (error) { if (error instanceof OPFCompositionError) return undefined; throw error; }
  const shortest = (composed: SlideComposition) => Math.min(...composed.items.filter(item => item.field === 'chart').map(item => chartPlotBox(item, scale).height));
  const before = trackQuality(result, options), after = trackQuality(automatic, options), floor = snapFontSizeUp((result.composition.minFontSize ?? 16) * scale);
  const layoutPlot = shortest(result), plot = shortest(automatic);
  if (plot <= layoutPlot + .5 || !readsAsWell(before, after, floor) || !Number.isFinite(before.size) || !Number.isFinite(after.size)) return undefined;
  return { ...automatic, recomposed: { layoutSize: before.size / scale, size: after.size / scale, chart: { layoutPlot: round(layoutPlot / scale), plot: round(plot / scale) } } };
}
/**
 * LH-80, LH-49, automatic composition (no layout record, no promoted regions, no column count or weights of the slide's own):
 *  - LH-80: the slide's one picture block among other blocks (no placement of its own, no `contain` or `stretch` fit by the block or the
 *    design, no frame shape) takes a full-height track at the slide edge, cover-cropped (LH-84 focus) and bled: the start side when it is
 *    the first block, the end side otherwise (the top or bottom of a portrait canvas). The headings and the other blocks compose beside it
 *    in the slide's own mode. The track is 50, 45, 40 or 35% of the slide, of those whose crop keeps at least half of the picture's
 *    width or height (MEDIA_TRACK_MIN_KEPT): a wide picture takes a wide track or none. A track is a frame the engine chooses for the
 *    picture and crops it by design: a `fit: "auto"` (LH-104) takes it as no fit would, and the picture is cover-cropped in it.
 *  - LH-49: the slide's one chart block among other blocks (no picture, no design.chartPrimary) whose plot is under its minimum
 *    (CHART_MIN_PLOT_PX, CHART_MIN_PLOT_SHARE of the body, CHART_MAX_PLOT_ASPECT) takes the filling track: the root's first column
 *    (it is the first block) or last, 60, 55 or 50% of the content width (the first that reads as well) against a column of the others
 *    in the slide's own mode, as design.chartPrimary splits it, when that plot is taller.
 * Each is kept only when it reads as well as the slide without it (readsAsWell); otherwise the slide is composed as before. Of the
 * picture tracks that read as well, the one with the largest smallest body size is taken; on a tie, the one with the larger body sizes
 * in all (by more than a pixel), then the one that crops the picture least (a portrait picture takes a narrower track than a landscape
 * one), then the widest. Right to left, the start side is the right.
 */
function automaticTracks(input: unknown, options: ComposeSlideOptions, base: SlideComposition): SlideComposition {
  const slide = record(input), blocks = slide.blocks, own = record(slide.composition);
  if (!Array.isArray(blocks) || blocks.length < 2 || (options.layout !== null && typeof options.layout === 'object') || Object.keys(slide).some(key => regionParts(key))) return base;
  if (own.columns !== undefined || (Array.isArray(own.weights) && own.weights.length) || blocks.some(block => record(block).placement !== undefined || record(block).region !== undefined)) return base;
  const leaf = (field: string) => blocks.flatMap((block: unknown, index: number) => !Array.isArray(record(block).blocks) && record(block)[field] !== undefined ? [index] : []);
  const pictures = leaf('image'), charts = leaf('chart'), landscape = base.width >= base.height, scale = Math.min(base.width, base.height) / 720;
  const quality = (result: SlideComposition) => trackQuality(result, options);
  const before = quality(base), floor = snapFontSizeUp((base.composition.minFontSize ?? 16) * scale);
  const attempt = (flag: symbol, value: unknown) => composeVariant(input, { ...options, [flag]: value } as ComposeSlideOptions, before, floor);
  const physical = (edge: ImageEdge): ImageEdge => base.direction === 'rtl' && (edge === 'left' || edge === 'right') ? (edge === 'left' ? 'right' : 'left') : edge;
  if (pictures.length === 1 && !leaf('video').length) {
    const index = pictures[0]!, host = record(blocks[index]), fit = (IMAGE_FITS as readonly unknown[]).includes(host.fit) ? host.fit : base.design.imageFit;
    if (fit === 'contain' || fit === 'stretch' || host.aspectRatio !== undefined || (host.shape !== undefined && host.shape !== 'rectangle' && host.shape !== 'rounded')) return base;
    const edge: ImageEdge = landscape ? (index === 0 ? 'left' : 'right') : (index === 0 ? 'top' : 'bottom');
    const aspect = intrinsicImageAspect(host.image, record(options.presentation).assets);
    const kept = (size: number) => { const frame = landscape ? size * base.width / base.height : base.width / (size * base.height); return aspect ? Math.min(frame / aspect, aspect / frame) : 1; };
    let best: { result: SlideComposition; size: number; read: TrackQuality } | undefined;
    for (const size of MEDIA_TRACK_SHARES.filter(share => kept(share) >= MEDIA_TRACK_MIN_KEPT - 1e-9)) {
      const result = attempt(MEDIA_TRACK, { block: index, edge, size }), read = result && quality(result);
      // LH-80 widened: a track never costs a table its one-line cells (a table beside a picture track wrapped its names).
      if (!result || !read || !readsAsWell(before, read, floor) || read.wrappedCells > before.wrappedCells) continue;
      const tie = best && read.size > best.read.size - FONT_GRID_EPSILON;
      if (!best || read.size > best.read.size + FONT_GRID_EPSILON || (tie && read.total > best.read.total + scale) || (tie && read.total > best.read.total - scale && kept(size) > kept(best.size) + 1e-9)) best = { result, size, read };
    }
    if (!best) return base;
    // A placed picture is listed before the flowed body; a track keeps the blocks' reading order, so the picture of a later block is
    // listed after the blocks before it (the order the preview, the PPTX export and `opf/reading-order` read).
    const blockPath = `slides.${options.slideIndex ?? 0}.blocks.${index}`, blockOf = (item: ComposedItem) => { const parts = item.path.split('.'); return parts[2] === 'blocks' ? Number(parts[3]) : -1; };
    const items = [...best.result.items], at = items.findIndex(item => item.path === blockPath || item.path.startsWith(`${blockPath}.`));
    if (at >= 0 && index > 0) {
      const [picture] = items.splice(at, 1);
      let to = 0;
      items.forEach((item, position) => { if (headings.has(item.field) || (blockOf(item) >= 0 && blockOf(item) < index)) to = position + 1; });
      items.splice(to, 0, picture!);
    }
    return { ...best.result, items, track: { kind: 'picture', edge: physical(edge), size: best.size, path: blockPath } };
  }
  if (pictures.length || leaf('video').length || charts.length !== 1 || base.design.chartPrimary !== undefined) return base;
  const chartOf = (result: SlideComposition) => result.items.find(item => item.field === 'chart');
  const chart = chartOf(base);
  if (!chart || !shortPlot(chart, bodyHeight(base), scale)) return base;
  const plot = chartPlotBox(chart, scale);
  const edge: ImageEdge = landscape ? (charts[0] === 0 ? 'left' : 'right') : (charts[0] === 0 ? 'top' : 'bottom');
  for (const share of CHART_TRACK_SHARES) {
    const result = attempt(CHART_TRACK, { edge, share }), placed = result && chartOf(result);
    if (!result || !placed || chartPlotBox(placed, scale).height <= plot.height + .5 || !readsAsWell(before, quality(result), floor)) continue;
    return { ...result, track: { kind: 'chart', edge: physical(edge), size: round((landscape ? placed.box.width : placed.box.height) / (landscape ? base.width : base.height)), path: `slides.${options.slideIndex ?? 0}.blocks.${charts[0]}` } };
  }
  return base;
}
function composeLayout(input: unknown, options: ComposeSlideOptions = {}): SlideComposition {
  const slide = record(input), layout = record(options.layout);
  // LH-83: the recomposition reads the record's design and composition and composes the body as if no layout were given; the
  // record's contentDirection asks its regions to flow one way, so the automatic grid does not take it.
  const recomposing = (options as Record<symbol, unknown>)[RECOMPOSE] === true;
  // Wave 3: the guarded rules composeSlide asks for (all when unset), and the ones that changed something (composeSlide's guard).
  const ruleSet = (options as Record<symbol, unknown>)[RULES] as ReadonlySet<GuardedRule> | undefined, firedRules = (options as Record<symbol, unknown>)[FIRED] as Set<GuardedRule> | undefined;
  const ruleOn = (rule: GuardedRule) => (!ruleSet || ruleSet.has(rule)) && !(rule === 'region-measure' && (options as Record<symbol, unknown>)[NO_REGION_MEASURE] === true), fire = (rule: GuardedRule) => { firedRules?.add(rule); };
  let regionMeasured = false;
  const width = options.width ?? 1280, height = options.height ?? 720;
  if (![width, height].every(value => Number.isFinite(value) && value > 0)) throw new RangeError("Canvas dimensions must be finite and positive.");
  const scale = Math.min(width, height) / 720;
  const deckDirection: TextDirection = options.direction ?? resolveSlideDirection(options.presentation, options.slideIndex);
  const rtl = deckDirection === 'rtl', textDirection = rtl ? 'rtl' as const : undefined;
  // OPF 0.19: a template record (areas and regions) composes through its regions; it is checked first, so an invalid
  // template is refused (OPFLayoutTemplateError) as validate reports it (opf/layout-template, opf/layout-region).
  const template: LayoutTemplate | undefined = !recomposing && isLayoutTemplate(layout) ? layoutTemplate(layout) : undefined;
  // One merge for every shared design key: slide design, then deck design (or the host's resolved deck values), then the theme's design, then the layout record's design.
  const hints = resolveDesignHints({ slide, layout, theme: { design: options.themeDesign }, presentation: options.presentation, slideIndex: options.slideIndex, deck: { titleAlignment: options.titleAlignment, contentAlignment: options.contentAlignment, contentBox: options.contentBox } });
  const hasCards = hints.contentBox ?? false;
  const composition: Composition = { ...record(layout.composition), ...record(slide.composition) };
  assertComposition(composition);
  const padding = (composition.padding ?? 0.08) * Math.min(width, height);
  const gap = (composition.gap ?? 1 / 30) * Math.min(width, height);
  const minSize = snapFontSizeUp((composition.minFontSize ?? 16) * scale);
  const rasterPadding=(options.textRasterPadding??1)*scale;
  if(!Number.isFinite(rasterPadding)||rasterPadding<0)throw new RangeError('Text raster padding must be finite and nonnegative.');
  // One alignment resolution for placement, internal payload layouts and consumers.
  // The tag (eyebrow) sits over the title, so it follows titleAlignment on every slide (left when none is resolved,
  // like the title). The subtitle is part of the same heading group whenever it sits in the title area (a cover, or any slide
  // whose layout has no 'subtitle' region of its own), so it follows titleAlignment too: one alignment axis for the group.
  // Only a slide's own design.contentAlignment keeps them apart. Set once the template is known.
  let subtitleInGroup = true;
  const alignmentFor = (field: string): 'left' | 'center' | 'right' =>
    (field === 'title' || ((field === 'tag' || (subtitleInGroup && field === 'subtitle')) && hints.sources.contentAlignment !== 'slide')
      ? hints.titleAlignment : hints.contentAlignment) ?? (field === 'metric' ? 'center' : 'left');
  // LH-50: the paths of the text blocks drawn as the eyebrow of the text after them (eyebrowLabel), each with whether it is set in
  // capitals (eyebrowCaps). Filled when the body's blocks are grouped, before any of them is fitted.
  const eyebrowLabels = new Map<string, boolean>();
  const tagCaps = eyebrowCaps(annotationText(slide.tag));
  // The tag (eyebrow) takes the accent family when the font scheme defines one; the quote body does the same in layoutQuote.
  // LH-32: an eyebrow (the tag, LH-50's label) is bold, and in capitals with EYEBROW_TRACKING where its script has case (eyebrowCaps).
  const styleFor = (field: string, path: string): TextStyle => {
    const eyebrow = field === 'tag' || eyebrowLabels.has(path), caps = field === 'tag' ? tagCaps : eyebrowLabels.get(path) === true;
    return resolveTextStyle({
      fontFamily: (field === "title" ? options.fontFamilies?.heading : field === "code" ? options.fontFamilies?.code : eyebrow ? options.fontFamilies?.accent ?? options.fontFamilies?.body : options.fontFamilies?.body) ?? (field === "code" ? "monospace" : "sans-serif"),
      fontWeight: field === "title" || eyebrow ? 700 : 400, path, ...(caps ? { caps: true, tracking: EYEBROW_TRACKING } : {}),
    }, options.textMeasurement);
  };
  const listBullet = hints.listBullet !== undefined ? { value: hints.listBullet, path: hints.paths.listBullet! } : undefined;
  const noListBullet = listBullet?.value === 'none';
  // LH-08: ruled rows. `design.listStyle: "rows"` draws every list of the slide as ruled rows, `"stack"` none; without it a list of two or
  // more first-level entries that each pair a short label (isLabelText) with a description is drawn as rows (the guarded rule `list-rows`),
  // as Claude Design rules such a list, and the guard keeps it only where no block reads smaller.
  const listRows = (value: unknown): boolean => {
    if (hints.listStyle !== undefined) return hints.listStyle === 'rows';
    if (!ruleOn('list-rows') || !Array.isArray(value) || value.length < 2 || !value.every(entry => { const object = record(entry); return object.description !== undefined && (object.level ?? 0) === 0 && isLabelText(object.text); })) return false;
    fire('list-rows');
    return true;
  };
  const bulletImage: ListBulletImage | undefined = listBullet?.value === 'image' ? (() => {
    const resolved = resolveLogo(options.presentation, slide, { shape: 'icon', onDark: options.darkBackground, slideIndex: options.slideIndex });
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
    // WI-4 (P15): a wrapped title or subtitle is balanced (same size, same line count); body text keeps the greedy wrap.
    const balance=field==='title'||field==='subtitle',textOptions=balance?{...richOptions(style),balance}:richOptions(style);
    if(!options.textMeasurement?.outlineBounds)return rich?fitRichText(value,box,size,minimum,textOptions):fitText(text,box,size,minimum,textWidthMeasurer(style,options.textMeasurement),textDirection,balance);
    const alignment=explicitAlignment??alignmentFor(field);
    const richLayout=rich?richTextLayouter(value,box,size,textOptions,minimum):undefined;
    const measure=textWidthMeasurer(style,options.textMeasurement),floor=snapFontSizeUp(rich?richMinimum(value,size,minimum):minimum),start=Math.max(size,floor);
    // The nominal heading/body range fits within 64 reference-pixel steps; the
    // last trial always evaluates the explicit floor even with unusual callers.
    for(let trial=0;trial<=64;trial++) {
      const raw=start-trial*scale,last=trial===64||raw<=floor,fontSize=last?floor:gridFontSize(raw,floor);
      const fit=richLayout?richLayout(fontSize):fitText(text,box,fontSize,fontSize,measure,textDirection,balance);
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
  // LH-51: the title of a content slide steps down from its role size, in three equal steps to at most a quarter smaller, to
  // the largest step that sets it on one line: a second title line costs about 60 px of body, and Claude Design's titles are
  // about 35-43 px at 1280 and do not wrap. Discrete steps keep a deck to at most four title sizes. A title that needs two
  // lines even at the smallest step wraps at its role size and balances (WI-4), as before. Per slide: a deck-wide size would
  // need every slide's layout resolved first, which is the caller's work, not composition's.
  const TITLE_STEPS = [1, 11 / 12, 10 / 12, 9 / 12];
  const oneLine = (fit: TextFit | RichTextFit, text: string) => !fit.overflow && ('richLines' in fit ? (fit as RichTextFit).richLines.length : fit.lines.length) <= text.split(/\r\n|[\r\n\u2028\u2029]/).length;
  const fitTitle = (value: unknown, text: string, box: LayoutBox, requested: number, fitPath: string): { fit: TextFit | RichTextFit; single: boolean } => {
    const whole = fitPlacedText('title', value, text, box, requested, minSize, fitPath);
    if (oneLine(whole, text)) return { fit: whole, single: true };
    for (const step of TITLE_STEPS.slice(1)) {
      const fit = fitPlacedText('title', value, text, box, requested * step, minSize, fitPath);
      if (oneLine(fit, text)) return { fit, single: true };
    }
    return { fit: whole, single: false };
  };
  // LH-76: "Topic: qualifier", the first colon followed by a space (a space before it, as in French, stays with the colon).
  const titleColon = (value: string): { topicEnd: number; start: number } | undefined => {
    const match = /[ \u00a0\u202f]*:[ \u00a0\u202f]+/.exec(value);
    if (!match || /[\r\n\u2028\u2029]/.test(value)) return undefined;
    const start = match.index + match[0].length;
    return match.index > 0 && value.slice(start).trim() ? { topicEnd: match.index, start } : undefined;
  };
  // The heading group (tag, title, subtitle) stacked from `y` at an area's width, half a gap apart. `title`: how a content
  // slide's title fits ('step', LH-51; 'split', LH-51 and LH-76); covers, sections and stacked records keep the role size.
  const headingGroup = (fields: string[], x: number, y: number, areaWidth: number, title?: 'step' | 'split'): ComposedItem[] => {
    const list: ComposedItem[] = [];
    let top = y;
    const boxFor = (field: string) => ({ x, y: top, width: areaWidth, height: Math.max(height * (field === 'title' ? 0.26 : field === 'subtitle' ? 0.12 : 0.045), minSize * 1.22 + 2 * rasterPadding) });
    const push = (field: string, value: unknown, itemPath: string, box: LayoutBox, text: TextFit | RichTextFit, titleSplit?: ComposedItem['titleSplit']) => {
      box.height = Math.min(box.height, Math.max('richLines' in text ? (text as RichTextFit).height : text.lines.length * text.lineHeight, text.placement?.height ?? 0));
      list.push({ path: itemPath, field, type: 'text', value, payload: { text: value }, box, text, textStyle: styleFor(field, itemPath), composition, alignment: alignmentFor(field), ...(titleSplit ? { titleSplit } : {}) });
      top += box.height + gap * 0.5;
    };
    for (const field of fields) {
      const value = slide[field], text = annotationText(value), fieldPath = `${path}.${field}`, box = boxFor(field);
      const requested = (field === 'title' ? 54 : field === 'tag' ? EYEBROW_TAG_SIZE : PROSE_NOMINAL_SIZE) * scale;
      if (field !== 'title' || !title) { push(field, value, fieldPath, box, fitPlacedText(field, value, text, box, requested, minSize, fieldPath)); continue; }
      const fitted = fitTitle(value, text, box, requested, fieldPath);
      // LH-76: a "Topic: qualifier" title that still wraps sets the topic as the title on one line and the qualifier below it at
      // the subtitle size, when the slide has no subtitle and the topic fits one line. The document is unchanged: both items
      // carry the title's path and their range of it (`titleSplit`); the PPTX export tags them as the one title.
      const colon = !fitted.single && title === 'split' && typeof value === 'string' && !annotationText(slide.subtitle) ? titleColon(value) : undefined;
      const topic = colon ? fitTitle(value.slice(0, colon.topicEnd), value.slice(0, colon.topicEnd), box, requested, fieldPath) : undefined;
      if (!colon || !topic?.single) { push(field, value, fieldPath, box, fitted.fit); continue; }
      push('title', value.slice(0, colon.topicEnd), fieldPath, box, topic.fit, { part: 'topic', start: 0, end: colon.topicEnd });
      const qualifier = value.slice(colon.start), below = boxFor('subtitle');
      push('subtitle', qualifier, fieldPath, below, fitPlacedText('subtitle', qualifier, qualifier, below, PROSE_NOMINAL_SIZE * scale, minSize, fieldPath), { part: 'qualifier', start: colon.start, end: value.length });
    }
    return list;
  };
  // A numbered list (`numbering` on the payload) draws numbers, never the picture bullet.
  const fitContent =(field:string,value:unknown,text:string,box:LayoutBox,size:number,minimum:number,path:string,numbering?:unknown,alignment?:'left'|'center'|'right') => field === 'text'
    ? fitPlacedText(field,value,text,box,size,minimum,path,alignment)
    : (field==='items'||field==='bullets') ? fitList(value as ListValue[],box,size,minimum,{...richOptions(styleFor(field,path)),heading:true,...(listRows(value)?{rows:true}:{}),...(numbering!==undefined?{numbering:numbering as NumberingInput}:bulletImage?{bulletImage}:noListBullet?{bullet:'none' as const}:{})})
    : fitText(text,box,size,minimum,widthFor(field,path),field==='code'?undefined:textDirection);
  const path = `slides.${options.slideIndex ?? 0}`;
  // LH-50: a label's eyebrow fit in `box` over a paragraph set at `paragraph` px (eyebrowSize), and the band it takes over its text: its
  // height and EYEBROW_GAP of a gap. A paragraph's band is reserved at its starting size, and its eyebrow drawn at its final size, which is
  // never larger, so the eyebrow always fits its band.
  const fitEyebrow = (eyebrow: { path: string; value: unknown }, box: LayoutBox, paragraph: number, alignment?: 'left' | 'center' | 'right') =>
    fitPlacedText('text', eyebrow.value, annotationText(eyebrow.value), box, eyebrowSize(paragraph, scale, minSize), minSize, eyebrow.path, alignment);
  const eyebrowBand = (eyebrow: { path: string; value: unknown }, width: number, paragraph: number): number => {
    const fit = fitEyebrow(eyebrow, { x: 0, y: 0, width: Math.max(scale, width), height: 1e6 }, paragraph);
    return ('richLines' in fit ? (fit as RichTextFit).height : Math.max(fit.lines.length * fit.lineHeight, fit.placement?.height ?? 0)) + gap * EYEBROW_GAP;
  };
  // RR-34: captions and footnotes fit through the same placed fitter as body text (outline placement included).
  const annotationFit = (value: RichText, box: LayoutBox, requestedSize: number, minFontSize: number, fitPath: string, alignment: 'left'|'center'|'right') =>
    fitPlacedText('text', value, annotationText(value), box, requestedSize, minFontSize, fitPath, alignment);
  const annotationOptions = { scale, minFontSize: minSize, fit: annotationFit, textStyle: (fitPath: string) => styleFor('text', fitPath) };
  const imageDiagnostics: LayoutDiagnostic[] = [];
  // A right-to-left deck mirrors placements and edge overlays: `left` is the start side, drawn at the right.
  const mirrorSide = (side: string): string => !rtl ? side : side === 'left' ? 'right' : side === 'right' ? 'left' : side;
  const backgroundImage = resolveBackgroundImage(slide, options.presentation, options.themeBackground, options.layout, width, height, path, mirrorSide, imageDiagnostics);
  const regions = Object.keys(slide).filter(key => regionParts(key)).sort();
  const assets = record(options.presentation).assets;
  // WI-3 (P33): a slide composed with no layout shows its pictures whole unless a design or the block sets a fit: the default
  // fit of automatic composition is `contain`, a placed (edge) picture and every layout keep the engine default `cover`.
  const imageContext = (placement?: ComposedPlacement, anchor?: RegionAnchor) => ({ fit: hints.imageFit ?? (!placement && autoComposition() ? 'contain' as const : undefined), scale, mirrorSide, diagnostics: imageDiagnostics, assets, ...(placement ? { placement } : {}), ...(anchor ? { anchor } : {}) });
  // FA-22 placement. The top-level image nodes are the image blocks of `blocks` (not groups) or the root image; promoted
  // regions have none. The n-th takes its own placement, else the n-th layout image placeholder's (FA-26: image regions are
  // counted in reading order through placeholder groups, and only a top-level one carries a placement). Each band takes its
  // share of the slide along its axis and the free area across it, in block order, at most one per edge (a second
  // block on a used edge flows). Headings and the body compose in the free area that remains.
  const area = { left: 0, top: 0, right: width, bottom: height };
  const topImages: { host: Record<string, any>; hostPath: string; block?: number }[] = regions.length ? []
    : Array.isArray(slide.blocks) ? slide.blocks.flatMap((block: unknown, index: number) => !Array.isArray(record(block).blocks) && record(block).image !== undefined ? [{ host: record(block), hostPath: `${path}.blocks.${index}`, block: index }] : [])
    : slide.image !== undefined ? [{ host: { type: 'image', image: slide.image }, hostPath: path }] : [];
  type Placed = { host: Record<string, any>; hostPath: string; block?: number; placement: ComposedPlacement; region: LayoutBox };
  const placed: Placed[] = [], usedEdges = new Set<string>();
  // LH-80: the side track automaticTracks chose for the slide's one picture is placed as an authored band would be.
  const autoTrack = (options as Record<symbol, unknown>)[MEDIA_TRACK] as { block: number; edge: ImageEdge; size: number } | undefined;
  // LH-116: a side track spans the title band only when the title fits one line beside it (LH-51's steps). A title that wraps there
  // keeps the full width (`headingSpan`), with its tag and subtitle, and the track bleeds from the body top (`underHeadings`), as
  // Claude Design sets a long title across the slide over a picture column instead of squeezing it into two lines beside it.
  let headingSpan: { left: number; right: number } | undefined;
  const underHeadings: Placed[] = [];
  const titleBeside = (left: number, right: number): boolean => {
    const value = slide.title, text = annotationText(value);
    if (!text) return true;
    const box = { x: left + padding, y: 0, width: Math.max(scale, right - left - 2 * padding), height: height * .26 };
    return fitTitle(value, text, box, 54 * scale, `${path}.title`).single;
  };
  topImages.forEach((node) => {
    const own = node.block !== undefined && node.host.placement !== undefined ? record(node.host.placement) : undefined;
    const automatic = !own && autoTrack !== undefined && node.block === autoTrack.block;
    const value = automatic ? autoTrack : own;
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
    const spans = !automatic || (edge !== 'left' && edge !== 'right') || titleBeside(edge === 'left' ? area.left + band : area.left, edge === 'left' ? area.right : region.x);
    if (!spans) headingSpan ??= { left: area.left, right: area.right };
    if (edge === 'left') area.left += band; else if (edge === 'right') area.right = region.x; else if (edge === 'top') area.top += band; else area.bottom = region.y;
    const placement: ComposedPlacement = { edge, size, inset: !automatic && record(value).inset === true, path: `${node.hostPath}.placement`, ...(automatic ? { automatic: true as const } : {}) };
    placed.push({ ...node, placement, region });
    if (!spans) underHeadings.push(placed[placed.length - 1]!);
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
  const hasLayoutRecord = !recomposing && options.layout !== undefined && options.layout !== null && typeof options.layout === "object";
  // Empty payloads (`blocks: []`, `text: ""`, empty lists, regions with nothing in them) draw nothing, so they are not body.
  // Whitespace-only text stays body: callers that infer a layout from it (the renderer picks a text layout) must agree with callers that do not (the editor).
  const emptyPayload = (value: unknown) => value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
  const emptyHost = (host: Record<string, any>) => emptyPayload(host.blocks) && fields.every(field => emptyPayload(host[field]));
  // Placed images are not body: a slide whose only body is placed images centers its headings in the free area like a cover.
  const flowBlocks = Array.isArray(slide.blocks) ? slide.blocks.filter((_: unknown, index: number) => !placedBlocks.has(index)) : slide.blocks;
  const hasBodyPayload = regions.some(key => !emptyHost(record(slide[key]))) || !emptyPayload(flowBlocks) || fields.some(field => !(placedRoot && field === 'image') && !emptyPayload(slide[field]));
  // OPF 0.19: a template slide with promoted regions composes them as in 0.18 (headings on top, regions below); the
  // template's body regions are not used. Any other template slide composes through its regions.
  const useTemplate = template !== undefined && !regions.length;
  const autoComposition = (): boolean => !hasLayoutRecord && !regions.length;
  // A template slide with no body content is a cover: its regions collapse and the template places the headings.
  const isCover = !hasBodyPayload && (useTemplate || !hasLayoutRecord);
  subtitleInGroup = !(useTemplate && template?.subtitle === true);
  // Cover and section slides draw the primary organization's full logo (or the design.logo override) at the top-left of the free area, below any header
  // furniture; the heading group then centers in the remaining span. Content slides never get one.
  let logo: ComposedLogo | undefined;
  if (isCover && (options as Record<symbol, unknown>)[LAYOUT_MASTER] !== true) {
    const resolved = resolveLogo(options.presentation, slide, { shape: 'full', onDark: options.darkBackground, slideIndex: options.slideIndex });
    if (resolved) {
      const logoHeight = 56 * scale;
      const logoWidth = Math.max(scale, Math.min(4 * logoHeight, area.right - area.left - 2 * padding));
      const box = { x: round(rtl ? area.right - padding - logoWidth : area.left + padding), y: round(headingTop), width: round(logoWidth), height: round(logoHeight) };
      logo = { box, shape: resolved.shape, path: resolved.path, source: resolved.source, variant: resolved.variant, reference: resolved.reference, anchor: rtl ? 'right' : 'left' };
    }
  }
  let y = logo ? logo.box.y + logo.box.height + gap : headingTop;
  // A template places its headings in its title (and subtitle) area: composeTemplate below. A TextRun[] heading wraps and fits
  // like rich body text (richTextLayouter); a string keeps the plain fitter. A slide with body content has a content title (LH-51).
  const headingArea = headingSpan ?? area;
  const headingItems: ComposedItem[] = useTemplate ? [] : headingGroup(["tag", "title", "subtitle"].filter(field => slide[field] && !(Array.isArray(slide[field]) && !annotationText(slide[field]))),
    headingArea.left + padding, y, headingArea.right - headingArea.left - padding * 2, hasBodyPayload ? 'split' : undefined);
  for (const item of headingItems) {
    if(furniture&&item.box.y+item.box.height>bodyBottom+.01)diagnostics.push({code:'text-overflow',path:item.path,message:'Repeated furniture leaves too little room for this heading. Change the header/footer or slide design.'});
    items.push(item);
    y = item.box.y + item.box.height + gap * 0.5;
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
  // LH-116: a track under full-width headings starts at the body top and still bleeds to its side and the foot.
  for (const entry of underHeadings) entry.region = { ...entry.region, y: round(y), height: Math.max(scale, entry.region.y + entry.region.height - round(y)) };
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
  // LH-06: the automatic emphasis surface of a slide's root blocks, read from their content only. A short last text
  // (EMPHASIS_BAND_MAX_CHARACTERS or fewer) after blocks that are all longer (any other kind, or a longer text) becomes a full-width band
  // at the foot of the body; one of EMPHASIS_PILL_MAX_CHARACTERS or fewer after a lone long text becomes a pill there, at the start of the
  // content alignment. The body above composes in what is left, with a layout or without. Never on a slide with an authored
  // `emphasis: true` (one surface per slide) or an arrangement of its own (a `composition` mode other than auto, weights or columns), nor
  // for a last block that sets `emphasis: false`, pins a region, has a caption or holds anything but text; composeSlide drops it when the
  // body overflows less without it.
  const plainText = (block: unknown): string | undefined => {
    const host = record(block);
    if (host.emphasis === false || host.region !== undefined || host.caption !== undefined || Array.isArray(host.blocks) || fields.some(field => field !== 'text' && host[field] !== undefined)) return undefined;
    const text = host.text === undefined ? undefined : contentText('text', host.text)?.trim();
    return text ? text : undefined;
  };
  // LH-50: a short label (isLabelText: 3 words or fewer, no full stop) right before a longer paragraph is that paragraph's eyebrow, as
  // Claude Design draws "Signal" over the text it names: the two are one block of the body, the label drawn as an eyebrow (bold, in the
  // accent, in capitals with tracking where the script has case) EYEBROW_GAP of a gap over the text, in its cell. Only root blocks of plain
  // text with no caption or emphasis of their own, on a slide that pins no block to a region. `eyebrowOf`: the eyebrow of each paragraph
  // (by its block path); `eyebrowBlocks`: the label blocks, which are no block of the body.
  const eyebrowOf = new Map<string, { path: string; value: unknown }>(), eyebrowBlocks = new Set<number>();
  if (ruleOn('eyebrow') && (options as Record<symbol, unknown>)[LAYOUT_MASTER] !== true && !regions.length && Array.isArray(slide.blocks) && !slide.blocks.some((block: unknown) => record(block).region !== undefined)) {
    const plainBlock = (host: Record<string, any>) => host.text !== undefined && host.caption === undefined && host.emphasis === undefined && !Array.isArray(host.blocks) && fields.every(field => field === 'text' || host[field] === undefined);
    const flowed: { host: Record<string, any>; index: number }[] = slide.blocks.flatMap((block: unknown, index: number) => placedBlocks.has(index) || emptyHost(record(block)) ? [] : [{ host: record(block), index }]);
    for (let at = 0; at + 1 < flowed.length; at++) {
      const label = flowed[at]!, text = flowed[at + 1]!;
      if (!plainBlock(label.host) || !plainBlock(text.host) || !eyebrowLabel(label.host.text, text.host.text)) continue;
      const labelPath = `${path}.blocks.${label.index}.text`;
      eyebrowBlocks.add(label.index);
      eyebrowOf.set(`${path}.blocks.${text.index}`, { path: labelPath, value: label.host.text });
      eyebrowLabels.set(labelPath, eyebrowCaps(annotationText(label.host.text)));
      at++;
    }
    if (eyebrowBlocks.size) fire('eyebrow');
  }
  const authoredEmphasis = (blocks: unknown, depth = 0): boolean => depth <= MAX_COMPOSITION_DEPTH && Array.isArray(blocks) && blocks.some(block => record(block).emphasis === true || authoredEmphasis(record(block).blocks, depth + 1));
  const autoEmphasis = ((): { block: number; shape: 'band' | 'pill'; follows?: number } | undefined => {
    if (!ruleOn('emphasis-band') || (options as Record<symbol, unknown>)[LAYOUT_MASTER] === true || regions.length || !Array.isArray(slide.blocks) || authoredEmphasis(slide.blocks)) return undefined;
    const own = record(slide.composition);
    if ((own.mode !== undefined && own.mode !== 'auto') || own.weights !== undefined || own.columns !== undefined) return undefined;
    const flowed = slide.blocks.flatMap((block: unknown, index: number) => placedBlocks.has(index) || emptyHost(record(block)) || eyebrowBlocks.has(index) ? [] : [{ block, index }]);
    const last = flowed[flowed.length - 1], text = flowed.length >= 2 && last ? plainText(last.block) : undefined;
    if (text === undefined || !last) return undefined;
    // LH-50: a paragraph with an eyebrow keeps it: it is placed as a block of the body, never as the band or pill.
    if (eyebrowOf.has(path + '.blocks.' + last.index)) return undefined;
    const length = [...text].length, before = flowed.slice(0, -1).map((entry: { block: unknown }) => plainText(entry.block));
    const long = (other: string | undefined) => other === undefined || [...other].length > EMPHASIS_BAND_MAX_CHARACTERS;
    if (before.length === 1 && before[0] !== undefined && long(before[0]) && length <= EMPHASIS_PILL_MAX_CHARACTERS) return { block: last.index, shape: 'pill', follows: flowed[0]!.index };
    // LH-06 (widened): a takeaway of up to EMPHASIS_TAKEAWAY_MAX_CHARACTERS right after two or more charts or tables (a run of them, so a
    // note paired with the chart before it reads as that chart's note, not as the slide's takeaway) is the band too.
    const isData = (entry: { block: unknown }) => { const host = record(entry.block); return !Array.isArray(host.blocks) && (host.chart !== undefined || host.table !== undefined); };
    let data = 0;
    for (let index = flowed.length - 2; index >= 0 && isData(flowed[index]!); index--) data++;
    const limit = data >= 2 ? EMPHASIS_TAKEAWAY_MAX_CHARACTERS : EMPHASIS_BAND_MAX_CHARACTERS;
    return length <= limit && before.every(long) ? { block: last.index, shape: 'band' } : undefined;
  })();
  // The band spans the body's width; the pill hugs its one line. Each is drawn at the foot of the body, which ends a gap above it; a
  // surface that would take more than EMPHASIS_BAND_MAX_SHARE of the body is not drawn.
  let autoSurface: { emphasis: ComposedEmphasis; item: ComposedItem } | undefined;
  if (autoEmphasis) {
    fire('emphasis-band');
    const blockPath = `${path}.blocks.${autoEmphasis.block}`, textPath = `${blockPath}.text`, value = record(slide.blocks[autoEmphasis.block]).text;
    const text = contentText('text', value)!, pill = autoEmphasis.shape === 'pill';
    const left = area.left + padding, width = area.right - area.left - padding * 2, size = Math.max((pill ? EMPHASIS_PILL_SIZE : PROSE_NOMINAL_SIZE) * scale, Number((options as Record<symbol, unknown>)[EMPHASIS_SIZE] ?? 0));
    const padX = pill ? round(size * .9) : CARD_INSET * scale, padY = round(size * (pill ? .4 : .6));
    const side = alignmentFor('text'), atEnd = rtl ? side === 'left' : side === 'right';
    const inner = pill ? Math.min(width - 2 * padX, widthFor('text', textPath)(text, size) * 1.04 + 2 * rasterPadding + 2 * scale) : width - 2 * padX;
    const outer = inner + 2 * padX, x = round(pill ? side === 'center' ? left + (width - outer) / 2 : atEnd ? left + width - outer : left : left);
    const measured = fitPlacedText('text', value, text, { x: x + padX, y: 0, width: inner, height: Math.max(scale, bodyBottom - y) }, size, minSize, textPath, pill ? 'center' : undefined);
    const textHeight = 'richLines' in measured ? (measured as RichTextFit).height : measured.placement?.height ?? measured.lines.length * measured.lineHeight;
    const height = round(textHeight + 2 * padY), top = round(bodyBottom - height);
    if (height <= EMPHASIS_BAND_MAX_SHARE * (bodyBottom - y)) {
      const box = { x: x + padX, y: top + padY, width: inner, height: round(textHeight) };
      const fit = fitPlacedText('text', value, text, box, size, minSize, textPath, pill ? 'center' : undefined);
      autoSurface = {
        emphasis: { path: blockPath, box: { x, y: top, width: round(outer), height }, radius: pill ? height / 2 : CARD_RADIUS * scale, shape: pill ? 'pill' : 'band', source: pill ? 'pill' : 'foot-band' },
        item: { path: textPath, field: 'text', type: 'text', value, payload: { type: 'text', text: value }, box, text: fit, textStyle: styleFor('text', textPath), composition, alignment: pill ? 'center' : side, emphasis: true },
      };
      if (!pill || (options as Record<symbol, unknown>)[PILL_AT_FOOT] === true) bodyBottom = top - gap;
    }
  }
  // LH-114: a pull line. A quote of QUOTE_PULL_MAX_CHARACTERS or fewer that shares the body with data (a table, a list of three or more
  // entries, or two or more other blocks) is drawn across the body as its own row: an accent rule, the quote at the lead size in at most
  // QUOTE_PULL_LINES lines and one caption line. It is the last row when the quote is the last block, and the first row (under the
  // headings) when it is the first block of an automatic slide (a layout's headings sit in its own title area). The data takes the full
  // width beside it. A quote beside one compact block keeps its card (LH-78), as does a quote with a photo, a region, a caption or an
  // emphasis of its own, a quote in the middle, one of several quotes, and a slide with its own arrangement (as the band above).
  const pullQuote = ((): { block: number; position: 'foot' | 'top' } | undefined => {
    if (!ruleOn('pull-quote') || (options as Record<symbol, unknown>)[LAYOUT_MASTER] === true || regions.length || !Array.isArray(slide.blocks)) return undefined;
    const own = record(slide.composition);
    if ((own.mode !== undefined && own.mode !== 'auto') || own.weights !== undefined || own.columns !== undefined) return undefined;
    const flowed = slide.blocks.flatMap((block: unknown, index: number) => placedBlocks.has(index) || emptyHost(record(block)) || eyebrowBlocks.has(index) || (autoSurface && index === autoEmphasis?.block) ? [] : [{ host: record(block), index }]);
    const quotes = flowed.filter((entry: { host: Record<string, any> }) => entry.host.quote !== undefined);
    if (flowed.length < 2 || quotes.length !== 1) return undefined;
    const entry = quotes[0]!, at = flowed.indexOf(entry), host = entry.host, quote = typeof host.quote === 'string' ? { text: host.quote } : record(host.quote);
    const position = at === flowed.length - 1 ? 'foot' : at === 0 && !useTemplate ? 'top' : undefined;
    if (!position || host.emphasis === true || host.region !== undefined || host.caption !== undefined || quote.photo !== undefined || fields.some(field => field !== 'quote' && host[field] !== undefined)) return undefined;
    const text = contentText('quote', quote)?.trim();
    if (!text || [...text].length > QUOTE_PULL_MAX_CHARACTERS) return undefined;
    const others = flowed.filter((other: { host: Record<string, any> }) => other !== entry), entries = (other: Record<string, any>) => Array.isArray(other.items) ? other.items.length : Array.isArray(other.bullets) ? other.bullets.length : 0;
    const data = (other: Record<string, any>) => !Array.isArray(other.blocks) && (other.table !== undefined || entries(other) >= 3);
    return others.length >= 2 || data(others[0]!.host) ? { block: entry.index, position } : undefined;
  })();
  // The pull line is laid out across the body's width from the top of a tall box, which measures its height; it is drawn at the foot
  // (the body ends a gap above it) or under the headings (the body starts a gap below it). A body under twice its height, or a quote
  // that needs more than QUOTE_PULL_LINES lines at the body text size, keeps the card.
  let pullItem: ComposedItem | undefined, placePull: ((top: number) => ComposedItem) | undefined;
  if (pullQuote) {
    const blockPath = `${path}.blocks.${pullQuote.block}`, quotePath = `${blockPath}.quote`, value = record(slide.blocks[pullQuote.block]).quote as string | QuoteContent;
    const x = area.left + padding, width = area.right - area.left - padding * 2, language = quoteLanguage(options.presentation, options.slideIndex);
    const lay = (top: number, room: number) => layoutQuote(value, { x, y: top, width, height: room }, {
      fontFamilies: options.fontFamilies, textMeasurement: options.textMeasurement, scale, minFontSize: composition.minFontSize, path: quotePath, direction: textDirection,
      ...(citationMarker ? { citationMarker } : {}), ...(language !== undefined ? { language } : {}), pull: true, bodySize: LEAD_NOMINAL_SIZE, bodyLines: QUOTE_PULL_LINES });
    const measured = lay(y, Math.max(scale, bodyBottom - y)), bodyPart = measured.parts.find(part => part.role === 'body');
    const lines = bodyPart?.fit ? 'richLines' in bodyPart.fit ? (bodyPart.fit as RichTextFit).richLines.length : bodyPart.fit.lines.length : Infinity;
    const height = round(measured.bounds.height);
    if (!measured.overflow && lines <= QUOTE_PULL_LINES && 2 * (height + gap) <= bodyBottom - y) {
      fire('pull-quote');
      const top = pullQuote.position === 'foot' ? round(bodyBottom - height) : round(y);
      // The pull line is laid out again where it finally sits (pullStack, after the body), so its parts are measured in place.
      placePull = (at: number): ComposedItem => {
        const quoteLayout = lay(at, height), body = quoteLayout.parts.find(part => part.role === 'body')!;
        return { path: quotePath, field: 'quote', type: 'quote', value, payload: { type: 'quote', quote: value }, box: { x, y: at, width, height }, text: body.fit,
          textStyle: body.style, composition, alignment: alignmentFor('quote'), quoteLayout };
      };
      pullItem = placePull(top);
      if (pullQuote.position === 'foot') bodyBottom = top - gap; else { y = top + height + gap; items.push(pullItem); }
    }
  }
  const contentBox ={ x: area.left + padding, y, width: area.right - area.left - padding * 2, height: Math.max(scale, bodyBottom - y) };
  // Automatic chartPrimary uses a synthetic content group without its own OPF path; it records no group, flow or decision.
  // LH-06: `emphasis` is the path of the block or group whose `emphasis: true` the node carries.
  type Pending = { field: string; type: string; value: unknown; path: string; payload: Record<string, unknown>; children?: Pending[]; composition?: Composition; region?: [number[], number[]]; synthetic?: boolean; caption?: unknown; captionPath?: string; host?: Record<string, any>; hostPath?: string; auto?: boolean; measure?: boolean; lone?: boolean; gap?: number; orient?: boolean; emphasis?: string; fills?: boolean;
    /** LH-50: the label drawn as this paragraph's eyebrow. */
    eyebrow?: { path: string; value: unknown } };
  const collect = (host: Record<string, any>, basePath: string, depth = 0, ancestors: unknown[] = []): Pending[] => {
    if (Array.isArray(host.blocks)) {
      if (depth >= MAX_COMPOSITION_DEPTH || ancestors.includes(host)) throw new RangeError(`Content groups must be acyclic and nest at most ${MAX_COMPOSITION_DEPTH} levels.`);
      const settings = record(host.composition) as Composition;
      assertComposition(settings);
      return [{ field: "blocks", type: "group", value: host.blocks, path: basePath, payload: host, composition: settings, ...(host.emphasis === true ? { emphasis: basePath } : {}),
        children: host.blocks.flatMap((block: unknown, index: number) => collect(record(block), `${basePath}.blocks.${index}`, depth + 1, [...ancestors, host])) }];
    }
    // RR-34: a caption belongs to the host's one captionable payload (image, chart, table or video).
    const captioned = host.caption !== undefined ? fields.filter(field => host[field] !== undefined && CAPTIONABLE_FIELDS.includes(field)) : [];
    // RR-54: a dataset-backed chart or table is composed from its inline copy (options.presentation holds the datasets).
    const fieldValue = (field: string): unknown => field === 'table' ? inlineTableData(host[field], options.presentation) : field === 'chart' ? inlineChartData(host[field], options.presentation) : host[field];
    return fields.filter(field => host[field] !== undefined).map(field => ({ field, type: host.type ?? kind(field), value: fieldValue(field), path: `${basePath}.${field}`, payload: field === 'image' ? imagePayload(host) : { type: host.type ?? kind(field), [field]: fieldValue(field), ...(host.numbering !== undefined && (field === 'items' || field === 'bullets') ? { numbering: host.numbering } : {}), ...(host.columns !== undefined && (field === 'items' || field === 'bullets') ? { columns: host.columns } : {}) },
      ...(field === 'image' ? { host, hostPath: basePath } : {}), ...(host.emphasis === true ? { emphasis: basePath } : {}), ...(field === 'text' && eyebrowOf.has(basePath) ? { eyebrow: eyebrowOf.get(basePath)! } : {}),
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
    : Array.isArray(slide.blocks) ? slide.blocks.flatMap((block: unknown, index: number) => placedBlocks.has(index) || eyebrowBlocks.has(index) || (autoSurface && index === autoEmphasis?.block) || (pullItem && index === pullQuote?.block) ? [] : collect(record(block), `${path}.blocks.${index}`))
    : collect(placedRoot ? { ...slide, image: undefined } : slide, path);
  // LH-112: one or two metrics that share the body with one or two blocks of other kinds are drawn at display size (METRIC_DISPLAY_SIZES),
  // start-aligned with their column, as Claude Design draws a figure beside a chart, table, paragraph or picture. A lone metric (LH-48,
  // LH-101) and a grid of metrics alone keep their centered sizes; a scorecard tile keeps LH-68's.
  const metricDisplay = new Map<string, { start: number; max: number }>();
  {
    const leaves: Pending[] = [], walk = (nodes: Pending[]): void => { for (const node of nodes) if (node.children) walk(node.children); else leaves.push(node); };
    walk(pending);
    const metrics = leaves.filter(node => node.field === 'metric'), others = leaves.length - metrics.length;
    const sizes = metrics.length === 1 ? METRIC_DISPLAY_SIZES.one : METRIC_DISPLAY_SIZES.two;
    if (metrics.length >= 1 && metrics.length <= 2 && others >= 1 && others <= 2) for (const node of metrics) metricDisplay.set(node.path, sizes);
  }
  // LH-06: the one block or group drawn on the emphasis surface: the first `emphasis: true` in reading order. Any other is drawn plain,
  // and reported: a slide has one emphasis.
  const emphasisPaths: string[] = [];
  const findEmphasis = (nodes: Pending[]): void => { for (const node of nodes) { if (node.emphasis !== undefined && !emphasisPaths.includes(node.emphasis)) emphasisPaths.push(node.emphasis); if (node.children) findEmphasis(node.children); } };
  findEmphasis(pending);
  const chosenEmphasis = emphasisPaths[0];
  for (const ignored of emphasisPaths.slice(1)) diagnostics.push({ code: 'emphasis-ignored', path: ignored, message: 'A slide draws one emphasis surface: the first block or group with emphasis: true has it, and this one is drawn without it.' });
  let surface: ComposedEmphasis | undefined = autoSurface?.emphasis, insideEmphasis = false;
  const groups: ComposedGroup[] = [], flows: ComposedFlow[] = [];
  // WI-1 (N1), LH-43: indexes into `items` of sibling blocks (the cells of a flow or a region, or regions of one role side
  // by side); after composition the text and lists of each set share the smallest size any of them fitted at.
  const peerSets: number[][] = [];
  // LH-43, LH-17: what refitting a placed item needs: a metric is laid out again in its own box from given role sizes, and a text
  // or list refits from a smaller size than the one it started at (its start, by item index).
  const metricRefits = new Map<number, (roleSizes: MetricLayoutOptions['roleSizes']) => MetricLayout>();
  // LH-78: a quote is laid out again in its own box with its body at a given size (px), so sibling quotes share one size.
  const quoteRefits = new Map<number, (bodySize: number) => QuoteLayout>();
  // LH-67: the items of the leads of lead plus stack arrangements, which keep their own size.
  const leadItems = new Set<number>();
  // LH-78: the items whose card a quote beside other blocks got; hugQuoteCards fits each card to its quote.
  const quoteHugs = new Set<number>();
  // LH-72: the items startAlignedCenter start-aligned; their siblings follow them (shareStartAlignment).
  const startAligned = new Set<number>();
  const bodyStarts = new Map<number, number>();
  // LH-17: the type scale fitted body text steps down. From the readability floor up by TYPE_SCALE_RATIO, rounded to whole reference
  // pixels: 16, 18, 21, 24, 28 and 32 px at the default floor, so prose has five sizes from its 28 px start to the floor, and a list or
  // lead six from 32. A block that shrinks takes the largest size of the scale its fit allows, instead of any size between, so a deck's
  // fitted body sizes are a few, and siblings of different kinds land on the same ones. A block keeps its starting size when it fits
  // there, on the scale or not (a raised floor). Per slide and deterministic: the scale depends only on the floor and the canvas.
  const scaleStep = (size: number, floorPx: number): number => typeScaleStep(size, floorPx, scale);
  // The sizes a joint fit tries, largest first: the start, then every step of the scale under it, down to the floor.
  const scaleSizes = (start: number, floorPx: number): number[] => {
    const sizes = [Math.max(start, snapFontSizeUp(floorPx * scale))];
    for (let step = scaleStep(sizes[0]! - 1e-6, floorPx); step < sizes.at(-1)! - 1e-9; step = scaleStep(step - 1e-6, floorPx)) sizes.push(step);
    return sizes;
  };
  const range = (from: number, to: number) => Array.from({ length: to - from }, (_, index) => from + index);
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
  const payloadBox = (box: LayoutBox, cards = hasCards): LayoutBox => {
    if (!cards) return box;
    // The inset is a sixteenth of the card's shorter side, between the former 12 px and CARD_INSET, so a small card (a KPI tile) keeps
    // the room its payload needs; down, it is at most a tenth of the card's height.
    const frame = acceptedBox(box), side = Math.max(12 * scale, Math.min(frame.width, frame.height) / 16);
    const padding = Math.min(CARD_INSET * scale, side, frame.width / 4, frame.height / 4), vertical = Math.min(padding, frame.height / 10);
    return acceptedBox({x:frame.x+padding,y:frame.y+vertical,width:frame.width-2*padding,height:frame.height-2*vertical});
  };
  // The deck language tag the quote marks follow, resolved on first use.
  let languageTag: string | undefined | null = null;
  const deckLanguage = (): string | undefined => {
    if (languageTag === null) languageTag = quoteLanguage(options.presentation, options.slideIndex);
    return languageTag;
  };
  // LH-113: the slide's texts that may name the focus of its charts and tables (chart-focus.ts), collected on first use.
  let focusTexts: FocusSource[] | undefined;
  const focusSources = (): FocusSource[] => focusTexts ??= slideFocusSources(slide);
  // LH-48: the growth a lone block was given (placeNode), read by every measure of it so its needs and its layout agree.
  const growthOf = new WeakMap<Pending, number>(), proseGrowth = new WeakMap<Pending, number>();
  let loneGrowth = false;
  const grownOptions = (node: Pending): { growth?: number } => { const growth = growthOf.get(node); return growth !== undefined && growth > 1 ? { growth } : {}; };
  // LH-78: a quote beside other blocks starts at the lead size and fits in QUOTE_BESIDE_LINES lines (besideQuote); `bodySize` (px) refits
  // one at the size its sibling quotes share.
  const measureQuote = (node: Pending, box: LayoutBox, settings: Composition, floorFallback = false, bodySize?: number) => layoutQuote(node.value as string | QuoteContent, acceptedBox(box), {
    fontFamilies:options.fontFamilies,textMeasurement:options.textMeasurement,scale,minFontSize:settings.minFontSize,path:node.path,direction:textDirection,floorFallback,
    ...(citationMarker?{citationMarker}:{}),...(deckLanguage()!==undefined?{language:deckLanguage()!}:{}),...grownOptions(node),
    ...(bodySize !== undefined ? {bodySize:bodySize / scale} : besideQuote(node) && ruleOn('quote-beside') ? {bodySize:LEAD_NOMINAL_SIZE,bodyLines:QUOTE_BESIDE_LINES} : {}),
  });
  // LH-101: the lone code panels fillLone gave their whole cell; their lines sit in the middle of it (layoutCode's `fill`).
  const fullPanels = new WeakSet<Pending>();
  const measureCode = (node: Pending, box: LayoutBox, settings: Composition, floorFallback = false, hug = false) => layoutCode(node.value as string | CodeContent, acceptedBox(box), {
    fontFamilies:options.fontFamilies,textMeasurement:options.textMeasurement,scale,minFontSize:settings.minFontSize,path:node.path,floorFallback,...grownOptions(node),
    ...(fullPanels.has(node)&&!hug?{fill:true}:{}),
  });
  // LH-112: whether a metric beside other blocks is start-aligned (metric-start, or with its display size, metric-display): unless the slide
  // or the deck sets the content alignment (a layout's or theme's centering is the default for short text, as LH-70 reads it).
  const metricStarts = (node: Pending): boolean => metricDisplay.has(node.path) && (hints.contentAlignment === undefined || hints.sources.contentAlignment === 'layout' || hints.sources.contentAlignment === 'theme') && (ruleOn('metric-start') || ruleOn('metric-display'));
  // The display size grows against the slide's body height (contentBox), so the height a metric needs (naturalHeight) and its placed
  // layout ask for the same value.
  const measureMetric = (node: Pending, box: LayoutBox, settings: Composition, floorFallback = false, roleSizes?: MetricLayoutOptions['roleSizes'], tile = false) => {
    const starts = !tile && metricStarts(node), display = !tile && ruleOn('metric-display') ? metricDisplay.get(node.path) : undefined;
    if (starts && alignmentFor('metric') !== 'left') fire('metric-start');
    if (display) fire('metric-display');
    const metricOptions: MetricLayoutOptions = {
      fontFamilies:options.fontFamilies,textMeasurement:options.textMeasurement,scale,minFontSize:settings.minFontSize,path:node.path,floorFallback,
      textRasterPadding:options.textRasterPadding,...(roleSizes?{roleSizes}:{}),...grownOptions(node),
      align:tile||starts?'left':alignmentFor('metric'),direction:textDirection,...(tile?{tile,...(tileFloors?.get(node.path)?{minimumSizes:tileFloors.get(node.path)}:{})}:{}),
      ...(display?{display:{...display,height:contentBox.height}}:{}),
      figure:ruleOn('metric-figure'),
    };
    // LH-15: a metric at display size in a cell at least METRIC_BAND_RATIO times as wide as it is tall (as the cell gives it, or as the metric
    // stacks when the cell takes its natural height) is a band: the value at the start and its other fields beside it.
    const band = display !== undefined && starts && box.width >= METRIC_BAND_RATIO * Math.min(box.height, layoutMetric(node.value as string | number | MetricContent, acceptedBox({...box,height:1e6}), {...metricOptions,floorFallback:false}).bounds.height);
    const laid = layoutMetric(node.value as string | number | MetricContent, acceptedBox(box), {...metricOptions,...(band?{band}:{})});
    if (FIGURE_LINES.has(laid)) fire('metric-figure');
    return laid;
  };
  // LH-68: the metrics of a `metrics: "tile"` region (composeTemplate marks them); placeNode lays each out as a tile of its whole card.
  const metricTiles = new WeakSet<Pending>(), tileFloors = (options as Record<symbol, unknown>)[TILE_FLOORS] as Map<string, MetricLayoutOptions['minimumSizes']> | undefined;
  // LH-41: how a template region's timeline is laid out (composeTemplate sets it before rows are sized): a band of several in one
  // region (horizontal only, compact at four or more, all at one size) or a lone timeline that may grow. `sizes` is `role` for
  // the role sizes, `floor` for the readability floor and `placed` for the size the region chose.
  const timelineHints = new WeakMap<Pending, { horizontal?: true; compact?: true; inlineHeader?: boolean; sizeOffset?: number; grow?: true }>();
  const measureTimeline = (node: Pending, box: LayoutBox, settings: Composition, sizes: 'role' | 'floor' | 'placed' = 'role', sizeOffset?: number) => {
    const hint = timelineHints.get(node);
    // LH-121: status words under the labels, a guarded rule (they take height the timeline's text might need).
    const events = Array.isArray(node.value) ? node.value : record(node.value).events, statusWords = ruleOn('timeline-status') && Array.isArray(events) && events.some((event: unknown) => record(event).status !== undefined) && (deckLanguage() === undefined || /^en(-|$)/i.test(deckLanguage()!));
    if (statusWords) fire('timeline-status');
    return layoutTimeline(node.value as TimelineContent, acceptedBox(box), {
      ...(statusWords ? {statusWords:true} : {}),...(deckLanguage() !== undefined ? {language:deckLanguage()!} : {}),
      fontFamilies:options.fontFamilies,textMeasurement:options.textMeasurement,scale,minFontSize:settings.minFontSize,path:node.path,textRasterPadding:options.textRasterPadding,direction:textDirection,
      ...(hint?.horizontal ? {horizontal:true} : {}),...(hint?.compact ? {compact:true} : {}),...(hint?.inlineHeader ? {inlineHeader:true} : {}),
      sizeOffset: sizeOffset ?? (sizes === 'floor' ? -TIMELINE_FLOOR_OFFSET : sizes === 'placed' ? hint?.sizeOffset ?? 0 : 0),
    });
  };
  // LH-41: a lone timeline grows its type by up to TIMELINE_GROWTH reference pixels when it still fits its box in the arrangement
  // it has at its role sizes (modest: LH-48 owns filling the body).
  const placeTimeline = (node: Pending, box: LayoutBox, settings: Composition): TimelineLayout => {
    const placed = measureTimeline(node, box, settings, 'placed');
    if (!timelineHints.get(node)?.grow && !node.lone || placed.overflow) return placed;
    for (let growth = TIMELINE_GROWTH; growth > 0; growth--) {
      const grown = measureTimeline(node, box, settings, 'placed', growth);
      if (!grown.overflow && grown.arrangement === placed.arrangement) return grown;
    }
    return placed;
  };
  // RR-34: a captioned leaf is scored and placed on the media box that remains after its caption band.
  const captionOf = (node: Pending, box: LayoutBox) => node.caption !== undefined && node.captionPath ? layoutCaption(node.caption, box, node.captionPath, annotationOptions) : undefined;
  // The proportions of a picture an automatic composition shows whole (fit contain, no frame shape of its own) when core can read them.
  const wholePictureAspect = (node: Pending): number | undefined => {
    const host = node.host;
    if (node.field !== 'image' || !host || !autoComposition() || host.aspectRatio !== undefined || host.shape === 'circle') return undefined;
    const fit = (IMAGE_FITS as readonly unknown[]).includes(host.fit) ? host.fit : hints.imageFit ?? 'contain';
    return fit === 'contain' ? intrinsicImageAspect(host.image, assets) : undefined;
  };
  const leafScore = (node: Pending, box: LayoutBox, settings: Composition, penalties?: CompositionPenalties): number => {
    box = payloadBox(box);
    const captioned = captionOf(node, box);
    if (captioned) box = captioned.mediaBox;
    const text = contentText(node.field, node.value);
    // WI-3 (P32): a picture shown whole is best in a cell of its own proportions; every other block is scored against 16:10.
    const proportions = Math.abs(Math.log(box.width / box.height / (wholePictureAspect(node) ?? 1.6)));
    let score = proportions + (captioned?.overflow ? 1000 : 0);
    if (penalties) { penalties.cellProportions += proportions; if (captioned?.overflow) penalties.textOverflow += 1000; }
    if (node.field === 'quote' || node.field === 'code' || node.field === 'metric' || node.field === 'timeline') {
      const internal = node.field === 'quote' ? measureQuote(node,box,settings) : node.field === 'code' ? measureCode(node,box,settings) : node.field === 'metric' ? measureMetric(node,box,settings) : measureTimeline(node,box,settings);
      const reduction = internal.parts.reduce((sum,part)=>sum+(part.fit ? (part.requestedFontSize-part.fit.fontSize)/scale : 0),0);
      score += reduction + (internal.overflow ? 1000 : 0);
      if (penalties) { penalties.fontReduction += reduction; penalties.textOverflow += internal.overflow ? 1000 : 0; }
    } else if (text) {
      const prose = proseMeasure(node, box.width);
      const fit = fitContent(node.field,node.value,text,{...box,width:prose.width},prose.size,snapFontSizeUp((settings.minFontSize??16)*scale),node.path,node.payload.numbering);
      const reduction = Math.max(0,snapFontSizeDown(prose.size) - fit.fontSize) / scale;
      score += reduction + (fit.overflow ? 1000 : 0);
      if (penalties) { penalties.fontReduction += reduction; penalties.textOverflow += fit.overflow ? 1000 : 0; }
      if (narrowMeasure(node, box.width, fit.fontSize)) { score += NARROW_MEASURE_PENALTY; if (penalties) penalties.narrowMeasure += NARROW_MEASURE_PENALTY; }
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
  // LH-89: a group's own `gap` is a fraction of its own shorter edge; without one it takes the slide's gap (0.25 in at 16:9), not 1/30
  // of its own side, so siblings in a short nested row no longer nearly touch. gridGeometry and stackedBoxes clamp it to fit a small group.
  const groupGap = (own: Composition, box: LayoutBox): number => {
    if (own.gap !== undefined || !ruleOn('nested-gaps')) return (own.gap ?? 1 / 30) * Math.min(box.width, box.height);
    fire('nested-gaps');
    return gap;
  };
  const defaultColumns = (count: number, area: LayoutBox, settings: Composition) => {
    const mode = modeFor(settings);
    return mode === "column" ? 1 : mode === "row" ? Math.max(1, count) : settings.columns ?? Math.max(1, Math.min(count, Math.ceil(Math.sqrt(count * area.width / area.height / 1.6))));
  };
  // LH-66, automatic composition only: a paragraph of four lines or more in a cell narrower than MIN_MEASURE_CHARS average characters of
  // `size` has too short a measure (underMeasure). Lines are core's own estimate, as `flow: auto` counts them, so every engine decides alike.
  const narrowMeasure = (node: Pending, width: number, size: number): boolean => {
    if (!ruleOn('reading-measure') || !autoComposition() || !proseLeaf(node) || !underMeasure(node.field, node.value, width, size)) return false;
    fire('reading-measure');
    return true;
  };
  // LH-66: a `grid` with no column count of its own takes fewer columns while one of its paragraphs is under the minimum measure at the
  // size it would be set at there (at least one column). The scored `auto` grid weighs the same rule as a penalty (leafScore).
  const measuredGridColumns = (nodes: Pending[], area: LayoutBox, cols: number, between: number, settings: Composition): number => {
    const narrowAt = (columns: number) => gridBoxes(nodes.length, area, columns, between, [], false).some((cell, index) => {
      const node = nodes[index]!, text = proseLeaf(node) ? contentText(node.field, node.value) : undefined;
      if (text === undefined) return false;
      const box = payloadBox(cell), prose = proseMeasure(node, box.width);
      const fit = fitContent(node.field, node.value, text, { ...box, width: prose.width }, prose.size, snapFontSizeUp((settings.minFontSize ?? 16) * scale), node.path, node.payload.numbering);
      return narrowMeasure(node, box.width, fit.fontSize);
    });
    while (cols > 1 && narrowAt(cols)) cols--;
    return cols;
  };
  // Candidate scoring walks descendants using their explicit tracks or geometric auto
  // seed. Only the selected candidate optimizes child autos. This bounds work by
  // O(nodes * nesting depth * candidate columns), rather than exponential search.
  const scoreNode = (node: Pending, box: LayoutBox, settings: Composition, penalties?: CompositionPenalties): number => {
    if (!node.children) return leafScore(node, box, settings, penalties);
    const own = inheritedSettings(settings, node.composition), area = inset(box, own), slotCount = Math.max(node.children.length, 0);
    const cols = defaultColumns(slotCount, area, own);
    const boxes = gridBoxes(slotCount, area, cols, node.gap ?? groupGap(own, box), own.weights ?? [], modeFor(own) === "column");
    return node.children.reduce((score, child, index) => score + scoreNode(child, boxes[index]!, own, penalties), 0);
  };
  // WI-1: blocks stacked in one column of `area` at the heights they need, one gap apart, from the top (anchor `top`,
  // `middle` or `bottom` places a stack that fits). Text, lists, quotes, metrics, code and (LH-44) tables are measured; charts, pictures,
  // timelines and videos keep at least an equal share and take whatever the measured blocks leave. When the needs do not
  // fit, every block gives up the same fraction of what it can give up above its height at the minimum font size
  // (shareHeights), so a short block keeps nearly its need and none overflows while the floors fit.
  // The leaves stackedBoxes gave the whole height they need at their role size. Like a template's auto row, such a cell is as tall
  // as its content, so a one-line paragraph's short cell is not "too small" (small-cell made paginate split a slide that fits). A
  // block the stack had to squeeze below its need is not one of them.
  const contentSized = new WeakSet<Pending>();
  const stackedBoxes = (nodes: Pending[], area: LayoutBox, requestedGap: number, settings: Composition, cards = hasCards, anchor: 'top' | 'middle' | 'bottom' = 'top'): LayoutBox[] => {
    const between = Math.max(0, Math.min(requestedGap, area.width / 2, area.height / (nodes.length * 2)));
    const space = Math.max(0, area.height - between * (nodes.length - 1)), share = space / nodes.length;
    const elastic = nodes.map(node => !measuredNode(node)), stretch = elastic.filter(Boolean).length;
    const needs = nodes.map((node, index) => elastic[index] ? share : naturalHeight(node, area.width, cards, undefined, settings));
    const floors = nodes.map((node, index) => elastic[index] ? share : naturalHeight(node, area.width, cards, undefined, settings, true));
    let heights = shareHeights(needs, floors, space);
    // WI-4: prose and lists that do not fit at their role sizes shrink together to the largest one size that fits, instead of each
    // block taking the size its share of the column happens to allow (23, 21 and 25 px in one column).
    const textual = nodes.every(node => !node.children && node.caption === undefined && (node.field === 'text' || node.field === 'items' || node.field === 'bullets'));
    if (textual && nodes.length > 1 && needs.reduce((sum, size) => sum + size, 0) > space + 1e-6) {
      // LH-17: the trial sizes are the type scale's, so the stack is sized for the size its blocks are set at.
      for (const trial of scaleSizes(Math.max(...nodes.map(node => proseMeasure(node, area.width).size)), settings.minFontSize ?? 16)) {
        const natural = nodes.map(node => naturalHeight(node, area.width, cards, undefined, settings, false, Math.min(trial, proseMeasure(node, area.width).size)));
        if (natural.reduce((sum, height) => sum + height, 0) <= space + 1e-6) { heights = natural; break; }
      }
    }
    // A chart or picture never gets less than the equal share it had before WI-1, even when the measured blocks cannot fit at
    // the minimum size: the text overflows either way, and the drawing stays legible.
    if (stretch && heights.some((size, index) => elastic[index] && size < share - 1e-9)) {
      const measured = nodes.flatMap((_, index) => elastic[index] ? [] : [index]);
      const rest = shareHeights(measured.map(index => needs[index]!), measured.map(index => floors[index]!), space - stretch * share);
      heights = nodes.map((_, index) => elastic[index] ? share : rest[measured.indexOf(index)]!);
    }
    const spare = space - heights.reduce((sum, size) => sum + size, 0);
    // LH-44: a table is measured (it gets at least its rows at the floor) and still takes its share of the spare height, as before.
    const grows = nodes.map((node, index) => elastic[index] || (!node.children && node.field === 'table')), growing = grows.filter(Boolean).length;
    if (growing && spare > 0) heights = heights.map((size, index) => grows[index] ? size + spare / growing : size);
    const used = heights.reduce((sum, size) => sum + size, 0) + between * (nodes.length - 1);
    nodes.forEach((node, index) => { if (!node.children && !elastic[index] && heights[index]! >= needs[index]! - 1e-6) contentSized.add(node); });
    let y = area.y + Math.max(0, anchor === 'middle' ? (area.height - used) / 2 : anchor === 'bottom' ? area.height - used : 0);
    return heights.map(size => { const box = { x: area.x, y, width: area.width, height: size }; y += size + between; return box; });
  };
  // WI-3, automatic composition only: the widths of a single row of two or three blocks follow what the blocks need.
  //  - P32: a picture shown whole in a cell wider than its proportions allow takes only the width its frame needs; the width it
  //    does not use goes to the blocks beside it (a portrait picture no longer leaves a band).
  //  - P29: two text blocks whose measured demand differs by at least 2.5x split the row 55:45 to 70:30 in favor of the longer one,
  //    when that shortens the longer block and adds the shorter at most one line; peers keep equal widths.
  // Explicit weights, a layout and every other row keep the equal tracks.
  const WEIGHTED_DEMAND_RATIO = 2.5, WEIGHTED_SHARES = [.55, .6, .65, .7];
  // LH-120: the share of a row of three blocks a horizontal bar chart takes (its category labels share its width with the bars).
  const BAR_CHART_MIN_SHARE = .4, HORIZONTAL_BAR_CHARTS = new Set(['bar', 'stacked-bar', '100pct-stacked-bar']);
  // LH-44: the widest share of a row or area a table asks for, and the type its neighbours may give up for it (reference px, summed).
  const TABLE_MAX_SHARE = .65, TABLE_NEIGHBOUR_REDUCTION = 4;
  const tableCardInset = () => hasCards ? 2 * CARD_INSET * scale : 0;
  // LH-44: in one row of blocks a table asks for its natural width (every cell on one line, plus a card's insets), up to
  // TABLE_MAX_SHARE of the row; the blocks beside it share the rest. A table its equal cell holds keeps that cell. The table widens
  // as far as the blocks beside it keep their fit (no new overflow, at most TABLE_NEIGHBOUR_REDUCTION px of type given up in all), and
  // to the width its words need (its minimum) as long as they do not overflow.
  const tableRowWeights = (nodes: Pending[], count: number, cols: number, area: LayoutBox, rowGap: number, settings: Composition): number[] | undefined => {
    if (!autoComposition() || settings.weights?.length || count < 2 || cols !== count || nodes.length !== count) return undefined;
    const tables = nodes.flatMap((node, index) => !node.children && node.field === 'table' ? [index] : []);
    if (tables.length !== 1) return undefined;
    const equal = gridGeometry(count, area, cols, rowGap, [], false).boxes;
    const index = tables[0]!, total = equal.reduce((sum, box) => sum + box.width, 0), cardInset = tableCardInset();
    const measured = measureTable(nodes[index]!, total, settings);
    if (!measured) return undefined;
    const want = Math.min(TABLE_MAX_SHARE * total, measured.naturalWidth + cardInset), least = Math.min(want, measured.minimumWidth + cardInset);
    if (want <= equal[index]!.width + scale) return undefined;
    const others = nodes.flatMap((_, other) => other === index ? [] : [other]);
    const weightsAt = (width: number) => nodes.map((_, other) => other === index ? width : (total - width) / others.length);
    const neighbours = (width: number) => others.reduce((sum, other) => sum + scoreNode(nodes[other]!, gridGeometry(count, area, cols, rowGap, weightsAt(width), false).boxes[other]!, settings), 0);
    const baseline = neighbours(equal[index]!.width), from = Math.max(least, equal[index]!.width), step = (want - from) / 4;
    for (let width = want; width > from + scale; width -= step) if (neighbours(width) <= baseline + TABLE_NEIGHBOUR_REDUCTION) return weightsAt(width);
    // Words before type: the minimum width when the neighbours keep their fit, if at a smaller size.
    return least > equal[index]!.width + scale && neighbours(least) < baseline + 1000 ? weightsAt(least) : undefined;
  };
  const autoRowWeights = (nodes: Pending[], count: number, cols: number, area: LayoutBox, rowGap: number, settings: Composition): number[] | undefined => {
    if (!autoComposition() || settings.weights?.length || count < 2 || count > 3 || cols !== count || nodes.length !== count) return undefined;
    const equal = gridGeometry(count, area, cols, rowGap, [], false).boxes;
    const wholeWidths = nodes.map((node, index) => {
      const aspect = node.caption === undefined ? wholePictureAspect(node) : undefined;
      return aspect === undefined ? undefined : Math.min(equal[index]!.width, equal[index]!.height * aspect);
    });
    const media = wholeWidths.flatMap((width, index) => width !== undefined && width < equal[index]!.width - scale ? [index] : []);
    const others = nodes.flatMap((_, index) => wholeWidths[index] === undefined ? [index] : []);
    if (media.length && others.length) {
      const freed = media.reduce((sum, index) => sum + equal[index]!.width - wholeWidths[index]!, 0);
      return nodes.map((_, index) => media.includes(index) ? wholeWidths[index]! : equal[index]!.width + freed / others.length);
    }
    const table = tableRowWeights(nodes, count, cols, area, rowGap, settings);
    if (table) return table;
    // LH-120: a bar chart's category labels sit beside its bars and take their width from it, so a bar chart in a row of three takes
    // BAR_CHART_MIN_SHARE of the row (its labels fit or wrap instead of being cut) and the other two share the rest (guarded rule
    // 'bar-chart-share': kept only when no block reads smaller).
    const bars = nodes.flatMap((node, index) => !node.children && node.field === 'chart' && HORIZONTAL_BAR_CHARTS.has(String(record(node.value).type ?? '').trim().toLowerCase()) ? [index] : []);
    if (count === 3 && bars.length === 1 && ruleOn('bar-chart-share')) {
      fire('bar-chart-share');
      const total = equal.reduce((sum, box) => sum + box.width, 0);
      return nodes.map((_, index) => index === bars[0] ? BAR_CHART_MIN_SHARE * total : (1 - BAR_CHART_MIN_SHARE) * total / 2);
    }
    const prose = (node: Pending) => !node.children && node.caption === undefined && (node.field === 'text' || node.field === 'items' || node.field === 'bullets');
    if (count !== 2 || !nodes.every(prose)) return undefined;
    const need = (node: Pending, width: number) => naturalHeight(node, width, hasCards, undefined, settings);
    const heights = nodes.map((node, index) => need(node, equal[index]!.width));
    const long = heights[0]! >= heights[1]! ? 0 : 1, short = 1 - long;
    if (heights[long]! < WEIGHTED_DEMAND_RATIO * heights[short]!) return undefined;
    const total = equal[0]!.width + equal[1]!.width, line = contentNominalSize(nodes[short]!.field) * scale * 1.3;
    let best: { share: number; height: number } | undefined;
    for (const share of WEIGHTED_SHARES) {
      const longHeight = need(nodes[long]!, total * share), shortHeight = need(nodes[short]!, total * (1 - share));
      if (shortHeight > heights[short]! + line || longHeight > heights[long]! - line * .5) continue;
      if (!best || longHeight < best.height - 1e-6) best = { share, height: longHeight };
    }
    return best ? (long === 0 ? [best.share, 1 - best.share] : [1 - best.share, best.share]) : undefined;
  };
  // LH-44: when the grid the scores chose gives a table a cell narrower than its words (the sum of its columns' minimum widths at the
  // starting size, plus a card's insets), the arrangement changes. Two candidates are scored against that grid and the lowest wins:
  //  - beside: the table at its natural width (at least its minimum, at most TABLE_MAX_SHARE of the area) and the other blocks
  //    stacked in one column beside it, on the side the table's place in the reading order gives it;
  //  - across: the table across the whole width, the blocks before it in a row above and the blocks after it in a row below.
  // Only a slide with no layout and one table changes (an `auto` container, or a `grid` one with no column count), and the blocks
  // keep their reading order.
  let spannedContainer = false;
  const tableArrangement = (nodes: Pending[], area: LayoutBox, settings: Composition, between: number, cols: number, gridScore: number): { nodes: Pending[]; settings: Composition } | undefined => {
    if (!autoComposition() || settings.weights?.length) return undefined;
    const tables = nodes.flatMap((node, index) => !node.children && node.field === 'table' ? [index] : []);
    if (tables.length !== 1) return undefined;
    const index = tables[0]!, table = nodes[index]!, cardInset = tableCardInset();
    const measured = measureTable(table, Math.max(scale, area.width - cardInset), settings);
    if (!measured) return undefined;
    const offered = gridGeometry(nodes.length, area, cols, between, (modeFor(settings) === 'auto' ? autoRowWeights(nodes, nodes.length, cols, area, between, settings) : undefined) ?? [], false).boxes[index]!;
    if (offered.width - cardInset >= measured.minimumWidth - .5) return undefined;
    const band = (members: Pending[], mode: Composition['mode']): Pending => members.length === 1 ? members[0]! : { field: 'blocks', type: 'group', value: members.map(member => member.payload), path, payload: {}, children: members, composition: mode ? { mode } : {}, synthetic: true, gap: between };
    const scored = (members: Pending[], own: Composition, boxes: LayoutBox[]) => members.reduce((sum, member, i) => sum + scoreNode(member, boxes[i]!, own), 0);
    const options: { nodes: Pending[]; settings: Composition; score: number }[] = [];
    const others = nodes.filter((_, other) => other !== index), track = Math.max(scale, area.width - between);
    if (measured.minimumWidth + cardInset <= TABLE_MAX_SHARE * track) {
      const share = Math.min(TABLE_MAX_SHARE, (measured.naturalWidth + cardInset) / track), first = index < nodes.length / 2;
      const members = first ? [table, band(others, 'column')] : [band(others, 'column'), table];
      const own: Composition = { ...settings, mode: 'row', weights: first ? [share, 1 - share] : [1 - share, share] };
      options.push({ nodes: members, settings: own, score: scored(members, own, gridBoxes(2, area, 2, between, own.weights!, false)) });
    }
    const before = nodes.slice(0, index), after = nodes.slice(index + 1);
    const rows = [...before.length ? [band(before, before.length <= 3 ? 'row' : undefined)] : [], table, ...after.length ? [band(after, after.length <= 3 ? 'row' : undefined)] : []];
    const column: Composition = { ...settings, mode: 'column' };
    options.push({ nodes: rows, settings: column, score: scored(rows, column, stackedBoxes(rows, area, between, column)) });
    const chosen = options.reduce((a, b) => b.score < a.score ? b : a);
    return chosen.score < gridScore ? chosen : undefined;
  };
  // LH-52, LH-71: a split is two or three blocks (no group, no caption) side by side or stacked at the root of the body. Its fill is
  // the share of the body its blocks draw: text, lists, quotes, metrics and code their ink (each line's width by its height, measured
  // at their starting size, so rewrapping them changes nothing), a table at most its natural width by the height of its rows at that
  // width (wrapped cells add height, not content), a timeline its cell's width by the height it needs, a picture shown whole and a
  // video their frame, a chart the largest 4:3 box of its cell (drawn wider, its marks spread but fill no more), anything else its
  // cell. `stretch`: the code panels of a row that fills under SPLIT_FILL take their whole cell, as LH-52 draws them.
  const SPLIT_FILL = .55, SPLIT_MIN_BLOCK = 120, SPLIT_MARGIN = .02, SPLIT_CHART_SHAPE = 4 / 3;
  const splitBlocks = (nodes: Pending[]) => nodes.length >= 2 && nodes.length <= 3 && nodes.every(node => !node.children && node.caption === undefined);
  const inkArea = (fit: unknown): number => {
    const value = record(fit);
    if (Array.isArray(value.listEntries)) return (value.listEntries as ListEntryLayout[]).reduce((sum, entry) => sum + inkArea(entry.text) + inkArea(entry.description), 0);
    if (Array.isArray(value.richLines)) return (value.richLines as RichTextLine[]).reduce((sum, line) => sum + line.width * line.height, 0);
    if (Array.isArray(value.sourceLines)) return (value.sourceLines as { width: number }[]).reduce((sum, line) => sum + line.width * (value.lineHeight as number), 0);
    return 0;
  };
  const drawnArea = (node: Pending, cell: LayoutBox, settings: Composition, stretch: boolean): number => {
    const frame = (aspect: number) => { const box = containedBox(cell, aspect, 'top'); return box.width * box.height; };
    if (node.field === 'image') { const aspect = wholePictureAspect(node); return aspect ? frame(aspect) : cell.width * cell.height; }
    if (node.field === 'video') return frame(VIDEO_ASPECT);
    if (node.field === 'chart') return frame(SPLIT_CHART_SHAPE);
    if (!MEASURED_FIELDS.has(node.field)) return cell.width * cell.height;
    if (stretch && node.field === 'code') return cell.width * cell.height;
    const open = { x: 0, y: 0, width: Math.max(scale, cell.width), height: 1e6 }, floorSize = snapFontSizeUp((settings.minFontSize ?? 16) * scale);
    if (node.field === 'text' || node.field === 'items' || node.field === 'bullets') {
      const prose = proseMeasure(node, open.width);
      return inkArea(fitContent(node.field, node.value, contentText(node.field, node.value) ?? '', { ...open, width: prose.width }, prose.size, floorSize, node.path, node.payload.numbering));
    }
    if (node.field === 'quote' || node.field === 'metric' || node.field === 'code') return (node.field === 'quote' ? measureQuote(node, open, settings) : node.field === 'code' ? measureCode(node, open, settings) : measureMetric(node, open, settings)).parts.reduce((sum, part) => sum + ((part as { visible?: boolean }).visible === false ? 0 : inkArea(part.fit)), 0);
    if (node.field === 'table') {
      // A table fills what it shows with one line per cell: at most its natural width by the height of its rows at that width.
      const natural = measureTable(node, Math.max(scale, cell.width), settings), whole = natural && measureTable(node, Math.max(cell.width, natural.naturalWidth), settings);
      if (natural && whole) return Math.min(cell.width, natural.naturalWidth) * Math.min(cell.height, whole.naturalHeight);
    }
    return cell.width * Math.min(cell.height, naturalHeight(node, cell.width, hasCards, undefined, settings));
  };
  const splitFill = (nodes: Pending[], boxes: LayoutBox[], area: LayoutBox, settings: Composition, stretch = false): number =>
    nodes.reduce((sum, node, index) => sum + drawnArea(node, boxes[index]!, settings, stretch), 0) / Math.max(1, area.width * area.height);
  // LH-71: two or three blocks of an automatic body try one row and one column (stacked at the heights they need, as arrange draws
  // it) besides the grid the scores chose, and keep the one that fills the body most (a row that fills under SPLIT_FILL counted
  // with its panels stretched, as LH-52 draws it). A row gives every block at least SPLIT_MIN_BLOCK px of width, and a column every
  // picture, chart and video at least that height; neither may overflow more than the scored grid. A fill within SPLIT_MARGIN of the
  // body keeps the scored grid, so a row of texts stays a row: their ink is the same either way but for the spaces at line breaks,
  // and only panels, tables, timelines and frames tip the choice.
  const rowOrColumn = (nodes: Pending[], area: LayoutBox, settings: Composition, between: number, scored: number): number => {
    const count = nodes.length;
    const option = (cols: number) => {
      let boxes: LayoutBox[];
      if (cols === 1) {
        // stackedBoxes marks the blocks it gives their whole need; this is a trial, so the marks are undone.
        const sized = nodes.map(node => contentSized.has(node));
        boxes = stackedBoxes(nodes, area, between, settings);
        nodes.forEach((node, index) => { if (!sized[index]) contentSized.delete(node); });
      } else boxes = gridGeometry(count, area, cols, between, (cols === count ? autoRowWeights(nodes, count, cols, area, between, settings) : undefined) ?? [], false).boxes;
      const plain = splitFill(nodes, boxes, area, settings), fill = cols === count && plain < SPLIT_FILL ? splitFill(nodes, boxes, area, settings, true) : plain;
      const penalties: CompositionPenalties = { cellProportions: 0, fontReduction: 0, textOverflow: 0, tableOverflow: 0, smallCells: 0, emptySlots: 0, narrowMeasure: 0 };
      nodes.forEach((node, index) => { scoreNode(node, boxes[index]!, settings, penalties); });
      const small = cols === count ? boxes.some(box => box.width < SPLIT_MIN_BLOCK * scale) : cols === 1 && boxes.some((box, index) => !measuredNode(nodes[index]!) && box.height < SPLIT_MIN_BLOCK * scale);
      return { cols, fill, overflow: penalties.textOverflow + penalties.tableOverflow, reduction: penalties.fontReduction, small };
    };
    const current = option(scored);
    let best = current;
    for (const cols of [count, 1]) {
      if (cols === scored) continue;
      const other = option(cols);
      // Wave 3: a new arrangement never sets its blocks smaller than the scored grid does, unless it removes an overflow.
      const smaller = other.reduction > current.reduction + 1e-6 && other.overflow >= current.overflow;
      if (!other.small && !smaller && other.overflow <= current.overflow && other.fill > best.fill + SPLIT_MARGIN) best = other;
    }
    return best.cols;
  };
  // LH-52: a row of two or three blocks at the root of the body that fills under SPLIT_FILL of it reads as a strip along the top with
  // the rest empty. Its panels stretch instead and its text centers: a code panel takes its whole cell with its code in the middle,
  // text, lists, quotes, metrics, tables and timelines sit at the height they need in the middle of their cell (a card still fills
  // the cell), a picture shown whole and a video sit in the middle of their cell, and a chart's box is centered. Every block keeps
  // the size it had at the top, so nothing shrinks; the row's arrangement and widths are unchanged.
  // LH-52, a column: the stack of a split that fills under SPLIT_FILL keeps every measured block at the height it needs (a table no
  // longer takes the spare height, which left the next block at the foot of the body) and sits in the middle of the body. Pictures,
  // charts and videos keep the height the stack gave them.
  const centeredSplitStack = (nodes: Pending[], boxes: LayoutBox[], area: LayoutBox, settings: Composition): LayoutBox[] => {
    const between = boxes.length > 1 ? Math.max(0, boxes[1]!.y - boxes[0]!.y - boxes[0]!.height) : 0;
    const heights = boxes.map((box, index) => {
      const node = nodes[index]!;
      if (!measuredNode(node)) return box.height;
      const need = naturalHeight(node, box.width, hasCards, undefined, settings) + 2 * rasterPadding + scale;
      if (need > box.height) return box.height;
      contentSized.add(node);
      return need;
    });
    let y = area.y + Math.max(0, (area.height - heights.reduce((sum, size) => sum + size, 0) - between * (boxes.length - 1)) / 2);
    return boxes.map((box, index) => { const next = { ...box, y, height: heights[index]! }; y += heights[index]! + between; return next; });
  };
  // LH-114: with a pull line the data and the pull line are one stack at the top of the body (pullStack), so the split is not centered.
  const fillsSplit = (nodes: Pending[], boxes: LayoutBox[], area: LayoutBox, settings: Composition, cols: number): boolean =>
    !pullItem && area === contentBox && cols === nodes.length && splitBlocks(nodes) && splitFill(nodes, boxes, area, settings) < SPLIT_FILL;
  const placeSplitBlock = (node: Pending, cell: LayoutBox, settings: Composition): void => {
    const first = items.length;
    // A card fills its cell; what it holds is centered inside the card's own insets (those of the whole card, not of a card as short
    // as the payload), so it is placed without a card of its own and given the cell as its frame.
    const inner = hasCards ? payloadBox(cell) : cell;
    // LH-78 with LH-52: a quote beside other blocks takes its own card (placeNode), measured with the card's insets, in the middle of its cell.
    if (!hasCards && besideQuote(node)) {
      const need = naturalHeight(node, cell.width, true, undefined, settings) + 2 * rasterPadding + scale;
      if (need >= cell.height) { placeNode(node, cell, settings); return; }
      contentSized.add(node);
      placeNode(node, { ...cell, y: cell.y + (cell.height - need) / 2, height: need }, settings);
      return;
    }
    if (node.field === 'image' || node.field === 'video') placeNode(node, cell, settings, hasCards, undefined, undefined, 'middle');
    else if (node.field === 'chart') {
      const height = modeFor(settings) === 'auto' && inner.height > inner.width * CHART_MAX_ASPECT_RATIO ? inner.width * CHART_MAX_ASPECT_RATIO : inner.height;
      placeNode(node, { ...inner, y: inner.y + (inner.height - height) / 2, height }, settings, false);
    } else if (MEASURED_FIELDS.has(node.field)) {
      const need = naturalHeight(node, inner.width, false, undefined, settings) + 2 * rasterPadding + scale;
      if (need >= inner.height) { placeNode(node, cell, settings); return; }
      contentSized.add(node);
      placeNode(node, { ...inner, y: inner.y + (inner.height - need) / 2, height: need }, settings, false);
      const item = items[first];
      if (item && node.field === 'code' && item.codeLayout && !item.codeLayout.overflow) item.box = acceptedBox(inner);
    } else { placeNode(node, cell, settings); return; }
    const item = items[first];
    if (item && hasCards) item.frameBox = acceptedBox(cell);
  };
  const arrange = (nodes: Pending[], area: LayoutBox, settings: Composition, reserved = 0, gapOverride?: number, containerPath = path, recorded = true): void => {
    const count = Math.max(nodes.length, reserved);
    if (!count) return;
    const mode = modeFor(settings), localGap = groupGap(settings, area);
    // Root gap retains the canvas-based contract; group gaps use their container.
    const actualGap = gapOverride ?? (settings === rootSettings ? gap : localGap);
    let cols = defaultColumns(count, area, settings);
    const hasRegions = nodes.some(node => node.region);
    if (mode === 'grid' && settings.columns === undefined && !hasRegions && count === nodes.length && count > 1) cols = measuredGridColumns(nodes, area, cols, actualGap, settings);
    // WI-4 (P34): auto mode keeps a reading measure for prose, and a lone short block asks for the lead size (proseMeasure).
    if (!hasRegions && (mode === 'auto' || nodes.length === 1)) for (const node of nodes) { node.auto = true; node.lone = nodes.length === 1 && reserved === 0; }
    const candidates: CompositionCandidate[] | undefined = decisions && recorded ? [] : undefined;
    // WI-1: one column of blocks is placed stacked at the heights they need (stackedBoxes), never smaller per block than the
    // equal rows the candidates are scored on; weights on a column win.
    const stacks = !hasRegions && count === nodes.length && count > 1 && !(mode === 'column' && settings.weights?.length);
    // LH-70, LH-67, automatic composition: similar paragraphs as columns, or a lead beside a stack of its siblings.
    const ownFlow = mode === 'auto' && !hasRegions && count === nodes.length && autoComposition() && settings.columns === undefined && !settings.weights?.length;
    const paragraphs = ownFlow ? paragraphColumns(nodes, area, hasCards, settings) : undefined;
    const lead = ownFlow && !paragraphs ? leadStack(nodes) : undefined;
    let best = Infinity;
    if (mode === "auto" && !hasRegions) {
      for (let candidate = 1; candidate <= Math.min(count, settings.columns ?? 6); candidate++) {
        const boxes = gridBoxes(count, area, candidate, actualGap, settings.weights ?? [], false);
        const emptySlots = (Math.ceil(count / candidate) * candidate - count) * 2;
        const penalties: CompositionPenalties | undefined = candidates ? {cellProportions:0,fontReduction:0,textOverflow:0,tableOverflow:0,smallCells:0,emptySlots,narrowMeasure:0} : undefined;
        const score = nodes.reduce((sum, node, i) => sum + scoreNode(node, boxes[i]!, settings, penalties), 0) + emptySlots;
        if (penalties && candidates) candidates.push({columns:candidate,rows:Math.ceil(count/candidate),score,penalties});
        if (score < best) { best = score; cols = candidate; }
      }
    }
    // LH-71: two or three blocks of an automatic body keep a row or a column when it fills more than the scored grid.
    let splitChoice = false;
    if (mode === 'auto' && !hasRegions && area === contentBox && settings.columns === undefined && !settings.weights?.length && count === nodes.length && splitBlocks(nodes)) {
      const chosen = rowOrColumn(nodes, area, settings, actualGap, cols);
      splitChoice = chosen !== cols;
      cols = chosen;
    }
    // LH-44: an automatic or a `grid` arrangement whose column count is not set gives way when it leaves a table too narrow for its
    // words (a grid's own columns are not scored, so either table candidate is better than its split words).
    const spanning = (mode === 'auto' || mode === 'grid') && !hasRegions && count === nodes.length && count > 1 && settings.columns === undefined ? tableArrangement(nodes, area, settings, actualGap, cols, best) : undefined;
    if (spanning) {
      if (recorded) decisions?.push({path:containerPath,mode,reason:'table-width',selectedColumns:cols,candidates:candidates ?? []});
      spannedContainer = recorded;
      arrange(spanning.nodes, area, spanning.settings, 0, actualGap, containerPath, recorded);
      return;
    }
    // LH-44: the arrangement tableArrangement chose records its decision above, and its flow here.
    const decided = spannedContainer;
    spannedContainer = false;
    if (paragraphs) cols = paragraphs.shape.columns; else if (lead) cols = 2;
    if (recorded && !decided) decisions?.push({path:containerPath,mode:hasRegions?'regions':mode,
      reason:hasRegions?'promoted-regions':settings === rootSettings && chartPrimary ? 'chart-primary' : paragraphs ? 'paragraph-columns' : lead ? 'lead-stack' : splitChoice ? 'split-fill' : mode==='auto'?'lowest-score':'configured-mode',
      ...(hasRegions?{}:{selectedColumns:cols}),candidates:candidates ?? []});
    const grid = gridGeometry(count, area, cols, actualGap, (mode === 'auto' && !hasRegions ? autoRowWeights(nodes, count, cols, area, actualGap, settings) : mode === 'row' && !hasRegions ? tableRowWeights(nodes, count, cols, area, actualGap, settings) : undefined) ?? settings.weights ?? [], mode === "column");
    // LH-47 widened: the cells of the scored grid's short last row stretch to the full width, as a region's grid does (flowCells'
    // `stretch`), so two pictures and a text draw a row of pictures over a full-width text, not a 2 x 2 grid with an empty cell. A grid
    // of pictures and videos only keeps one cell width, as LH-47 keeps a gallery's.
    if (!paragraphs && !lead && mode === 'auto' && !hasRegions && count === nodes.length && cols > 1 && count % cols !== 0 && !settings.weights?.length && ruleOn('short-row')
      && !nodes.every(node => !node.children && (node.field === 'image' || node.field === 'video'))) {
      const first = count - count % cols, short = count - first, cell = (area.width - grid.gap * (short - 1)) / short;
      for (let k = 0; k < short; k++) grid.boxes[first + k] = { ...grid.boxes[first + k]!, x: area.x + k * (cell + grid.gap), width: cell };
      fire('short-row');
    }
    if (paragraphs) {
      for (const node of nodes) paragraphStarts.set(node, paragraphs.size);
      const cells = flowCells(paragraphs.shape, area, actualGap, true), rowOf = paragraphs.shape.perRow.flatMap((width, row) => Array.from({ length: width }, () => row));
      grid.boxes = jointRowBoxes(nodes, cells.cells, rowOf, area, cells.gap, settings, hasCards, 'top', true);
      grid.columns = grid.boxes.slice(0, paragraphs.shape.columns).map(box => ({ offset: box.x - area.x, size: box.width }));
      grid.rows = paragraphs.shape.perRow.map((_, row) => { const box = grid.boxes[rowOf.indexOf(row)]!; return { offset: box.y - area.y, size: box.height }; });
      grid.gap = cells.gap;
    } else if (lead) {
      if (nodes[lead.lead]!.field === 'text') paragraphStarts.set(nodes[lead.lead]!, LEAD_NOMINAL_SIZE * scale);
      grid.boxes = leadStackBoxes(nodes, lead, area, actualGap, settings, hasCards);
      const leadBox = grid.boxes[lead.lead]!, column = grid.boxes.find((_, index) => index !== lead.lead)!;
      grid.columns = [leadBox, column].sort((a, b) => a.x - b.x).map(box => ({ offset: box.x - area.x, size: box.width }));
      grid.rows = [{ offset: 0, size: area.height }];
      grid.gap = actualGap;
    } else if (cols === 1 && stacks) {
      grid.boxes = stackedBoxes(nodes, area, actualGap, settings);
      // LH-52 with LH-48: a stack of paragraphs and lists keeps its top, as LH-48's grown stack does (the editor resizes its tracks from
      // the top); a stack with a panel, table, timeline or media block sits in the middle of the body.
      if (!pullItem && area === contentBox && splitBlocks(nodes) && !nodes.every(proseLeaf) && splitFill(nodes, grid.boxes, area, settings) < SPLIT_FILL) grid.boxes = centeredSplitStack(nodes, grid.boxes, area, settings);
      grid.rows = grid.boxes.map(box => ({ offset: box.y - area.y, size: box.height }));
    } else if (stacks && cols > 1 && count > cols && nodes.every(proseLeaf)) {
      // LH-43: the rows of a grid of text and lists share one size, so they are sized jointly and fill the area (jointRowBoxes).
      grid.boxes = jointRowBoxes(nodes, grid.boxes, nodes.map((_, index) => Math.floor(index / cols)), area, grid.gap, settings, hasCards, 'top', true);
      grid.rows = grid.rows.map((_, row) => { const box = grid.boxes[row * cols]!; return { offset: box.y - area.y, size: box.height }; });
    }
    // Right to left: the first column and the `left` region sit at the right of their container (RR-05). Track sizes,
    // weights and the scoring above are unchanged; only each box moves to its mirrored place within the container.
    const mirrored = (box: LayoutBox): LayoutBox => rtl ? { ...box, x: area.x + area.width - (box.x - area.x) - box.width } : box;
    const boxes = grid.boxes.map(mirrored);
    if (recorded && !hasRegions) flows.push({path: containerPath, box: {...area}, composition: {...settings}, columns: rtl ? grid.columns.map(track => ({offset: area.width - track.offset - track.size, size: track.size})) : grid.columns, rows: grid.rows, gap: grid.gap, itemCount: nodes.length, slotCount: count});
    // LH-43: the cells of a grid are one set across its rows, as the blocks of a stacked column are.
    const stack: number[] = [];
    // LH-52 with LH-70 and LH-67: paragraph columns and a lead plus stack keep their own cells; LH-52 centers the scored grid or LH-71's row.
    const filled = !hasRegions && !paragraphs && !lead && count === nodes.length && fillsSplit(nodes, grid.boxes, area, settings, cols);
    nodes.forEach((node, index) => {
      const box = node.region ? mirrored(regionBox(node.region, area, actualGap)) : boxes[index]!;
      const first = items.length;
      if (filled) placeSplitBlock(node, box, settings); else placeNode(node, box, settings);
      if (!hasRegions && (cols > 1 || stacks) && !node.children) stack.push(...range(first, items.length));
    });
    if (stack.length > 1) peerSets.push(stack);
  };
  // OPF 0.19: the template region the next items are drawn in (ComposedItem.region), set while a region is composed.
  let regionTag: string | undefined, templateCell = false;
  // One node in its cell: a group arranges its children (0.18 content-group semantics), a leaf is fitted. `cards` is
  // false in a bled region, which is never drawn as a card; `listColumns` is a region's listColumns for a lone list.
  // RR-92: the value axis the preview draws and the PPTX export writes (column, bar, line and area charts; see chartValueAxis).
  const composeChart = (node: Pending, box: LayoutBox, settings: Composition): ComposedChart | undefined => {
    const resolved = resolveChartData(node.value, options.presentation, {path: node.path});
    const language = deckLanguage();
    // LH-03, LH-81: the chart layer, measured in the body font (the caption at weight 700) as the preview draws it. The value axis
    // is sized for the plot under the header row.
    const measurers = new Map<number, MeasureTextWidth>();
    const measure = (text: string, size: number, weight: 400 | 700): number => {
      let measurer = measurers.get(weight);
      if (!measurer) {
        measurer = textWidthMeasurer(resolveTextStyle({fontFamily: options.fontFamilies?.body ?? 'sans-serif', fontWeight: weight, italic: false, path: node.path}, options.textMeasurement), options.textMeasurement);
        measurers.set(weight, measurer);
      }
      return measurer(text, size);
    };
    // LH-60 with LH-03: the layer is decided for the construct the engines draw (chartDrawPlan), so a map drawn as columns takes a column
    // chart's header row and small-chart labels, and nested rings their ring names (LH-92); boxes and a scatter take none.
    const plan = resolved.ok ? chartDrawPlan(node.value, resolved, {language}) : undefined;
    const drawn = plan?.fallback && resolved.ok ? {chart: {...(node.value as Record<string, unknown>), type: plan.type}, data: {...resolved, columns: plan.columns, rows: plan.rows, formats: plan.formats}} : {chart: node.value, data: resolved};
    const geometry = {box, scale, minFontSize: settings.minFontSize, measure, direction: rtl ? 'rtl' as const : 'ltr' as const, ...(language !== undefined ? {language} : {}), captioned: node.caption !== undefined};
    let layer = drawn.data.ok ? chartLayer(drawn.chart, drawn.data, geometry) : undefined;
    const titleText = [annotationText(slide.title), annotationText(slide.subtitle)].filter(Boolean).join('. ');
    // LH-110: the reference values the title names; the value axis holds them.
    const references = drawn.data.ok ? chartTitleReferences(drawn.chart, drawn.data, {text: titleText, ...(language !== undefined ? {language} : {})}) : undefined;
    const include = references?.lines.map(line => line.value);
    // LH-119: a small chart without its value axis labels every point with its value, so a line's scale drops zero sooner (niceScale).
    const hiddenAxis = layer?.small?.valueAxis === false;
    const axisFor = (headerHeight: number) => chartValueAxis(node.value, resolved, {width: box.width, height: Math.max(1, box.height - headerHeight), scale, minFontSize: settings.minFontSize, language, ...(hiddenAxis ? {labeled: true} : {}), ...(include?.length ? {include} : {})});
    let valueAxis = axisFor(layer?.header?.height ?? 0);
    // LH-105, LH-113: the series or categories the slide names are the chart's focus (chart-focus.ts): the title's, else what its other
    // texts, list entries, quotes and chart alts name together; a focus replaces the small chart's last-point emphasis.
    const focus = drawn.data.ok ? chartSlideFocus(drawn.chart, drawn.data, {sources: focusSources(), ...(language !== undefined ? {language} : {})}) : undefined;
    if (focus) {
      const small = layer?.small ? (({emphasis: _emphasis, ...rest}) => rest)(layer.small) : undefined;
      layer = {...layer, ...(small ? {small} : {}), focus};
    }
    // LH-105: direct labels instead of a legend: the series names at the line ends, the category names on the slices (chart-direct-labels.ts).
    const ends = drawn.data.ok ? chartEndLabels(drawn.chart, drawn.data, layer, geometry, axisFor) : undefined;
    if (ends) ({layer, valueAxis} = ends);
    const slices = drawn.data.ok ? chartSliceLabels(drawn.chart, drawn.data, geometry) : undefined;
    if (slices) layer = {...layer, slices};
    if (drawn.data.ok) {
      // LH-107: a waterfall's roles, signed labels and caption (chart-marks.ts).
      const waterfall = chartWaterfall(drawn.chart, drawn.data, geometry);
      if (waterfall) layer = {...layer, waterfall: waterfall.waterfall, ...(waterfall.header ? {header: waterfall.header} : {})};
      // LH-107 with LH-113: one emphasis per chart. A waterfall in its role colors (totals strong, gains in the accent, losses gray) has
      // that as its emphasis, so it takes no focus from the slide's texts (neither engine would draw one on its bars).
      if (waterfall?.waterfall.colors && layer?.focus) { const {focus: _focus, ...rest} = layer; layer = rest; }
      // LH-108: a value list beside a pie in place of its slice names.
      const list = chartValueList(drawn.chart, drawn.data, geometry, {...(layer?.focus ? {focus: layer.focus} : {}), ...(slices ? {slices} : {})});
      if (list) { const {slices: _slices, ...rest} = layer ?? {}; layer = {...rest, valueList: list}; }
      // LH-109: values inside stacked segments and the series names beside the last column.
      const data = drawn.data;
      const stack = chartStack(drawn.chart, data, layer, geometry, axisFor, legend => chartHeader(drawn.chart, data, geometry, {legend}));
      if (stack) ({layer, valueAxis} = stack);
      // LH-110: the reference line and band, placed against the chart's plot (pinned here when nothing else pinned it).
      if (references && valueAxis) {
        const plotGeometry = {scale, minFontSize: settings.minFontSize, measure: (text: string, size: number) => measure(text, size, 400), direction: rtl ? 'rtl' as const : 'ltr' as const, ...(language !== undefined ? {language} : {})};
        const plot = layer?.plot ?? chartPlotInset(drawn.chart, data, {valueAxis, ...(layer ? {layer} : {})}, {...plotGeometry, box});
        const placed = plot ? placeReferences({lines: references.lines, rows: references.rows}, data, valueAxis, box, plot, {...plotGeometry, bold: (text, size) => measure(text, size, 700)}) : undefined;
        if (placed && plot) layer = {...layer, plot, references: placed};
      }
    }
    // LH-105: the context of a focus may be a light neutral when every context mark carries its text (value labels, names at the line
    // ends, names on the slices); an unlabeled context is read against the axis and keeps 3:1.
    if (layer?.focus) {
      const record = node.value as Record<string, unknown>;
      const labeled = Boolean(layer.small?.labels || layer.endLabels || layer.slices || layer.valueList || layer.stack?.names || (record?.dataLabels !== undefined && record.dataLabels !== false));
      layer = {...layer, focus: {...layer.focus, ...(labeled ? {labeled} : {})}};
    }
    return valueAxis || layer ? {...(valueAxis ? {valueAxis} : {}), ...(layer ? {layer} : {})} : undefined;
  };
  // WI-3: a contained picture and a video frame sit at the region's anchor inside the cell the flow gave them (top by default),
  // and the caption band closes up under a top-anchored frame.
  const VIDEO_ASPECT = 16 / 9, CHART_MAX_ASPECT_RATIO = 3 / 4;
  const settleCaption = (caption: ComposedCaption, frame: LayoutBox, anchor: RegionAnchor): void => {
    if (caption.position === 'above' || anchor !== 'top') return;
    const target = round(frame.y + frame.height + caption.fontSize * .4), dy = target - caption.box.y;
    if (dy >= -.01) return;
    caption.box = { ...caption.box, y: target };
    caption.fit = translateTextFit(caption.fit, dy);
  };
  const placeNode = (node: Pending, box: LayoutBox, settings: Composition, cards = hasCards, listColumns?: 'auto' | 1, metricReferenceHeight?: number, anchor: RegionAnchor = 'top', frame?: LayoutBox): void => {
    // LH-06: the block or group with the slide's emphasis is drawn on its surface, a card in its cell; nothing drawn on the surface takes
    // a card of its own. A group's children are arranged inside the card's inset.
    const emphasized = !insideEmphasis && node.emphasis !== undefined && node.emphasis === chosenEmphasis;
    if (node.children) {
      if (emphasized) surface = { path: node.emphasis!, box: acceptedBox(frame ?? box), radius: CARD_RADIUS * scale, shape: 'card', source: 'authored' };
      const own = inheritedSettings(settings, node.orient ? { ...node.composition, mode: pairMode(box) } : node.composition), inner = inset(emphasized ? payloadBox(frame ?? box, true) : box, own);
      if (!node.synthetic) groups.push({ path: node.path, box, contentBox: inner, composition: own });
      insideEmphasis ||= emphasized;
      try { arrange(node.children, inner, own, 0, node.gap ?? groupGap(own, box), node.path, !node.synthetic); }
      finally { if (emphasized) insideEmphasis = false; }
      return;
    }
    // LH-48: a lone block that fills too little of its cell grows and moves to the cell's middle, its card hugging it.
    const lone = node.fills ? fillLone(node, frame ?? box, settings, cards) : undefined;
    // Its cell is as tall as its content, so only its width can make it too small (contentSized).
    if (lone) { box = lone; frame = undefined; metricReferenceHeight = undefined; contentSized.add(node); }
    const onSurface = emphasized || insideEmphasis;
    if (onSurface) cards = emphasized;
    // LH-78: a quote beside other blocks is drawn on a card, unless the card's inset would make it overflow (below). On the emphasis
    // surface (LH-06) the surface is its card.
    const quoteCard = !cards && !onSurface && besideQuote(node);
    if (quoteCard) cards = true;
    // LH-68: a metric in a `metrics: "tile"` region is laid out in its whole card: label, value from the top, the rest at the foot.
    const tile = node.field === 'metric' && metricTiles.has(node);
    if (tile) metricReferenceHeight = undefined;
    // A card fills its whole cell (`frame`) even when the region's anchor places a shorter payload inside it. Every filled card starts
    // CARD_FILL_SPACE of a gap down, so cards side by side keep one top edge; a payload that reached higher is trimmed to the card.
    if (frame) {
      const top = frame.y + gap * CARD_FILL_SPACE;
      frame = { ...frame, y: top, height: Math.max(scale, frame.y + frame.height - top) };
      if (box.y < top) box = { ...box, y: top, height: Math.max(scale, box.y + box.height - top) };
    }
    let frameBox = cards ? acceptedBox(frame ?? box) : undefined;
    let metricHeight = metricReferenceHeight === undefined ? undefined : payloadBox({...box,height:metricReferenceHeight},cards).height;
    const cell = box;
    box = payloadBox(box, cards);
    let caption = captionOf(node, box);
    if (caption) box = caption.mediaBox;
    // LH-50: a paragraph's eyebrow takes a band at the top of its box; it is placed over the text's final box at the end (placeEyebrows).
    const brow = node.eyebrow ? eyebrowBand(node.eyebrow, box.width, proseMeasure(node, box.width).size) : 0;
    if (brow) box = { ...box, y: box.y + brow, height: Math.max(scale, box.height - brow) };
    const textValue = contentText(node.field, node.value);
    const measureInternal = (floorFallback = false) => [
      node.field === 'quote' ? measureQuote(node,box,settings,floorFallback) : undefined,
      node.field === 'code' ? measureCode(node,box,settings,floorFallback) : undefined,
      node.field === 'metric' ? measureMetric(node, {...box,height:metricHeight ?? box.height}, settings, floorFallback, undefined, tile) : undefined,
    ] as const;
    let [quoteLayout, codeLayout, metricLayout] = measureInternal();
    // A quote, code or metric that has no room inside its card's inset takes the whole card: content before padding.
    const unfit = (layout?: {parts: readonly {fit?: unknown}[]}) => layout?.parts.some(part => !part.fit) === true;
    // LH-78: a card the slide does not draw is a decoration, so a quote that overflows inside its inset is drawn without it.
    if (quoteCard && quoteLayout && (quoteLayout.overflow || unfit(quoteLayout))) {
      box = cell;
      frameBox = undefined;
      quoteLayout = measureQuote(node, box, settings);
    } else if (cards && (unfit(quoteLayout) || unfit(codeLayout) || unfit(metricLayout))) {
      box = cell;
      metricHeight = metricReferenceHeight;
      caption = captionOf(node, box);
      if (caption) box = caption.mediaBox;
      [quoteLayout, codeLayout, metricLayout] = measureInternal();
    }
    // LH-40: a part that still has no room is drawn at the readability floor, overflowing, with its finding: the export never fails on it
    // (a strict composition still does, on the finding).
    if (unfit(quoteLayout) || unfit(codeLayout) || unfit(metricLayout)) [quoteLayout, codeLayout, metricLayout] = measureInternal(true);
    // LH-78: the card a quote beside other blocks gets hugs it once sibling sizes are shared (hugQuoteCards).
    if (quoteCard && frameBox) quoteHugs.add(items.length);
    if (caption) diagnostics.push(...caption.diagnostics);
    const timelineLayout = node.field === 'timeline' ? placeTimeline(node,box,settings) : undefined;
    const internal = quoteLayout ?? codeLayout ?? metricLayout ?? timelineLayout, body = internal?.parts.find(part=>part.role==='body'||part.role==='value');
    const columns = textValue !== undefined && !internal ? listColumnsFor(node, box, settings, listColumns) : undefined;
    // WI-4 (P34): a prose block in auto mode keeps a reading measure, placed by the content alignment. The measure never costs
    // size: a block that fits less well in it than across its whole cell takes the cell.
    const floorSize = snapFontSizeUp((settings.minFontSize??16)*scale);
    const prose = textValue !== undefined && !internal ? proseMeasure(node, box.width) : undefined, wholeBox = box;
    if (prose && prose.width < box.width - .5) {
      const side = alignmentFor(node.field), atEnd = rtl ? side === 'left' : side === 'right';
      box = { ...box, x: side === 'center' ? box.x + (box.width - prose.width) / 2 : atEnd ? box.x + box.width - prose.width : box.x, width: prose.width };
    }
    let text = internal ? body?.fit : columns ? (columns.length > 1 ? mergeListColumns(columns) : columns[0]!.text) : textValue !== undefined ? fitContent(node.field,node.value,textValue,box,prose?.size ?? contentNominalSize(node.field)*scale,floorSize,node.path,node.payload.numbering) : undefined;
    if (prose && box !== wholeBox && text && textValue !== undefined) {
      const wide = fitContent(node.field,node.value,textValue,wholeBox,prose.size,floorSize,node.path,node.payload.numbering);
      if (wide.fontSize > text.fontSize + 1e-9 || (text.overflow && !wide.overflow)) { text = wide; box = wholeBox; }
    }
    let alignment = alignmentFor(node.field);
    const centered = text && textValue !== undefined && !internal && !columns ? startAlignedCenter(node, text, textValue, box) : undefined;
    if (centered) { alignment = 'left'; text = centered.text; box = centered.box; startAligned.add(items.length); }
    // WI-3 (P23): a video draws in a 16:9 frame, the largest that fits its cell, placed by the region's anchor. In automatic
    // composition (no layout) a chart is at most 4:3, so a tall cell does not stretch it (P32).
    if (node.field === 'video') box = roundBox(containedBox(box, VIDEO_ASPECT, anchor));
    else if (node.field === 'chart' && !templateCell && modeFor(settings) === 'auto' && box.height > box.width * CHART_MAX_ASPECT_RATIO) box = roundBox({ ...box, height: box.width * CHART_MAX_ASPECT_RATIO });
    const image = node.field === 'image' ? composeImage(node.host ?? {}, node.hostPath ?? node.path, box, box, { ...imageContext(undefined, anchor), ...(coverPictures.has(node) ? { fit: 'cover' as const } : {}) }) : undefined;
    if (caption) settleCaption(caption, image?.box ?? box, anchor);
    const chart = node.field === 'chart' ? composeChart(node, box, settings) : undefined;
    items.push({ path: node.path, field: node.field, type: node.type, value: node.value, payload: node.payload, box:codeLayout&&!codeLayout.overflow?{...acceptedBox(box),height:Math.min(acceptedBox(box).height,round(codeLayout.bounds.height))}:internal?acceptedBox(box):box, ...(image ? {image} : {}), ...(chart ? {chart} : {}),
      ...(frameBox && !emphasized ? {frameBox} : {}),
      text, textStyle: body?.style ?? styleFor(node.field,node.path), composition: settings, alignment: tile || (metricLayout && metricStarts(node)) ? 'left' : alignment, ...(quoteLayout?{quoteLayout}:{}), ...(codeLayout?{codeLayout}:{}), ...(metricLayout?{metricLayout}:{}), ...(timelineLayout?{timelineLayout}:{}),
      ...(bulletImage && node.payload.numbering === undefined && (node.field === 'items' || node.field === 'bullets') ? {bulletImage} : {}), ...(caption ? {caption} : {}),
      ...(regionTag !== undefined ? {region: regionTag} : {}), ...(columns && columns.length > 1 ? {listColumns: columns} : {}), ...(onSurface ? {emphasis: true as const} : {}), ...(tile ? {metricTile: true as const} : {}), ...(node.field === 'table' && growthOf.has(node) ? {tableGrowth: growthOf.get(node)!} : {}) });
    // LH-06: an emphasized leaf's card is the surface (a block with several payload fields: around all of them).
    if (emphasized && frameBox) {
      const own = surface && surface.path === node.emphasis ? surface.box : undefined;
      const right = Math.max(frameBox.x + frameBox.width, own ? own.x + own.width : -Infinity), bottom = Math.max(frameBox.y + frameBox.height, own ? own.y + own.height : -Infinity);
      const x = Math.min(frameBox.x, own?.x ?? Infinity), y = Math.min(frameBox.y, own?.y ?? Infinity);
      surface = { path: node.emphasis!, box: { x, y, width: right - x, height: bottom - y }, radius: CARD_RADIUS * scale, shape: 'card', source: 'authored' };
    }
    if (brow) eyebrowsOf.set(items[items.length - 1]!, node.eyebrow!);
    if (metricLayout && !metricLayout.overflow) { const metricBox = {...box,height:metricHeight ?? box.height}; metricRefits.set(items.length - 1, roleSizes => measureMetric(node, metricBox, settings, false, roleSizes, tile)); }
    // LH-67: the lead of a lead plus stack keeps its larger size; it is neither stepped nor shared.
    if (stackLeads.has(node)) leadItems.add(items.length - 1);
    else if (quoteLayout && !quoteLayout.overflow) { const quoteBox = box; quoteRefits.set(items.length - 1, size => measureQuote(node, quoteBox, settings, false, size)); }
    else if (text && !internal && !columns) bodyStarts.set(items.length - 1, prose?.size ?? contentNominalSize(node.field)*scale);
    // A template's auto row, and a block a stacked column gave its whole need, is as tall as its content, so only its width can make the cell too small.
    if (box.width < 100 * scale || (!templateCell && !contentSized.has(node) && box.height < 60 * scale)) diagnostics.push({ code: "small-cell", path: node.path, message: "Content cell is too small for comfortable reading; use fewer blocks or a different composition." });
  };
  // OPF 0.19, one long list: 1, 2 then 3 equal columns at the starting size, and the first count at which it fits, as
  // long as a column stays a quarter of the slide wide. Breaks fall between items (a nested item stays with its parent)
  // and keep the columns as even as possible; numbering continues across them. A payload's fixed `columns` count is
  // used as written. When the largest allowed count does not fit, every column shrinks to one shared size. Undefined:
  // one column, fitted as any list.
  const listColumnsFor = (node: Pending, box: LayoutBox, settings: Composition, regionMode?: 'auto' | 1): ComposedListColumn[] | undefined => {
    if (node.field !== 'items' && node.field !== 'bullets') return undefined;
    const values = node.value as ListValue[];
    if (!Array.isArray(values) || values.length < 2) return undefined;
    const own = node.payload.columns;
    const mode = own === 'auto' || own === 1 || own === 2 || own === 3 ? own : regionMode;
    if (mode === undefined || mode === 1) return undefined;
    // LH-42: `auto` never deals a short list across columns: entries of 6 or fewer split into columns read as rows of a table
    // ("Queue | Route | Resolve"), so such a list shrinks in its one column instead. A fixed count is used as written.
    if (mode === 'auto' && values.length <= LIST_WHOLE_ENTRIES) return undefined;
    const start = contentNominalSize(node.field) * scale, floor = snapFontSizeUp((settings.minFontSize ?? 16) * scale);
    const numbering = node.payload.numbering as NumberingInput | undefined;
    const listOptions: ListFitOptions = { ...richOptions(styleFor(node.field, node.path)), ...(listRows(values) ? { rows: true } : {}), ...(numbering !== undefined ? { numbering } : bulletImage ? { bulletImage } : noListBullet ? { bullet: 'none' as const } : {}) };
    const columnGap = (count: number) => Math.min(gap, box.width / (count * 2));
    const columnBoxes = (count: number): LayoutBox[] => {
      const between = columnGap(count), columnWidth = (box.width - between * (count - 1)) / count;
      const ordered = Array.from({ length: count }, (_, index) => ({ x: box.x + index * (columnWidth + between), y: box.y, width: columnWidth, height: box.height }));
      return rtl ? ordered.map(cell => ({ ...cell, x: box.x + box.width - (cell.x - box.x) - cell.width })) : ordered;
    };
    const chunk = (from: number, to: number): ListValue[] => numbering !== undefined ? sliceNumberedItems(values, numbering, from, to) : values.slice(from, to);
    // A column's entries keep the indexes and the source paths of the whole payload: a column's first item can be a string
    // that sliceNumberedItems turned into { text, start } to carry its number, and its path is still `<list>.<n>`.
    // The paths are those fitList gives a one-column list: `<list>.<n>` for a string, `<list>.<n>.text` for an object.
    const sourcePaths = (index: number) => {
      const source = values[index], object = source !== null && typeof source === 'object' && !Array.isArray(source);
      return { textPath: `${node.path}.${index}${object ? '.text' : ''}`, descriptionPath: `${node.path}.${index}.description` };
    };
    const renumber = (fit: ListFit, from: number): ListFit => ({ ...fit, listEntries: fit.listEntries.map(entry => ({ ...entry, index: entry.index + from, ...sourcePaths(entry.index + from) })) });
    const split = (count: number, size: number, minimum: number): ComposedListColumn[] => {
      const boxes = columnBoxes(count);
      const whole = fitList(values, { ...boxes[0]!, height: 1e6 }, start, start, listOptions);
      const first = whole.listEntries[0]!.textBox.y;
      const heights = whole.listEntries.map((entry, index) => (whole.listEntries[index + 1]?.textBox.y ?? first + whole.height) - entry.textBox.y);
      const breaks = [0, ...listColumnBreaks(heights, whole.listEntries.map(entry => entry.level), count), values.length];
      return boxes.slice(0, breaks.length - 1).map((cell, index) => ({ box: cell, start: breaks[index]!, end: breaks[index + 1]!, text: renumber(fitList(chunk(breaks[index]!, breaks[index + 1]!), cell, size, minimum, listOptions), breaks[index]!) }));
    };
    const quarter = width / 4;
    const counts = typeof mode === 'number' ? [mode] : [2, 3].filter(count => (box.width - columnGap(count) * (count - 1)) / count >= quarter);
    if (mode === 'auto') {
      // One column first: a list that fits at the starting size stays one column.
      if (!fitList(values, box, start, start, listOptions).overflow) return undefined;
      for (const count of counts) {
        const columns = split(count, start, start);
        if (columns.every(column => !column.text.overflow)) return columns;
      }
    }
    const count = counts.at(-1);
    if (count === undefined) return undefined;
    const shrunk = split(count, start, floor);
    const size = Math.min(...shrunk.map(column => column.text.fontSize));
    return shrunk.map(column => ({ ...column, text: renumber(fitList(chunk(column.start, column.end), column.box, size, size, listOptions), column.start) }));
  };
  // OPF 0.19, "long" for `flow: auto`: more than 6 lines at the starting body size in the cell the grid would give the
  // block, counted with core's own estimate (never the host's measurement), so every engine picks the same arrangement.
  const LONG_LINES = 6, LONG_CODE_LINES = 12, startSize = PROSE_NOMINAL_SIZE * scale;
  const estimatedLines = (value: unknown, cellWidth: number, size: number): number =>
    flatten(value).split('\n').reduce((sum, paragraph) => sum + Math.max(1, wrapText(paragraph, Math.max(1, cellWidth), size).length), 0);
  const isLong = (node: Pending, cellWidth: number): boolean => {
    if (node.children) return node.children.some(child => isLong(child, cellWidth));
    if (node.field === 'text') return estimatedLines(node.value, cellWidth, startSize) > LONG_LINES;
    if (node.field === 'items' || node.field === 'bullets') {
      const listSize=contentNominalSize(node.field)*scale;
      let lines = 0;
      const entries = Array.isArray(node.value) ? node.value : [];
      for (const entry of entries) {
        const object = entry !== null && typeof entry === 'object' && !Array.isArray(entry) ? entry as Record<string, unknown> : undefined;
        // LH-77: a one-entry described list is a heading over its description (fitList `heading`), with no indent.
        const heading = entries.length === 1 && object?.description !== undefined && node.payload.numbering === undefined;
        const indent = heading ? 0 : listSize * 1.1 * (1 + (typeof object?.level === 'number' ? object.level : 0));
        lines += estimatedLines(object ? object.text : entry, cellWidth - indent, heading ? listSize * LIST_HEADING_SCALE : listSize);
        if (object?.description !== undefined) lines += estimatedLines(object.description, cellWidth - indent, heading ? listSize : listSize * .82);
      }
      return lines > LONG_LINES;
    }
    if (node.field === 'quote') return estimatedLines(typeof node.value === 'string' ? node.value : record(node.value).text, cellWidth, startSize) > LONG_LINES;
    if (node.field === 'table') {
      const value = record(node.value);
      return (Array.isArray(value.rows) ? value.rows.length + (Array.isArray(value.columns) ? 1 : 0) : 0) > LONG_LINES;
    }
    if (node.field === 'code') return String(typeof node.value === 'string' ? node.value : record(node.value).source ?? '').split('\n').length > LONG_CODE_LINES;
    return false;
  };
  // WI-4 (P34): in auto mode a prose block is no wider than about 70 average characters of its size, and a lone block that stays within
  // two lines at the lead size asks for that size. Everything else keeps its role size and the width its cell gives it.
  const baseProseMeasure = (node: Pending, cellWidth: number): { size: number; width: number } => {
    const measured = readingMeasure(node, cellWidth);
    if (node.measure && !node.auto && measured.width < cellWidth - .5) { fire('region-measure'); regionMeasured = true; }
    return measured;
  };
  const readingMeasure = (node: Pending, cellWidth: number): { size: number; width: number } => {
    const role = contentNominalSize(node.field) * scale;
    if (node.field !== 'text' || node.children || !(node.auto || node.measure)) return { size: proseGrowth.get(node) ?? role, width: cellWidth };
    // Core's own estimate, never the host's measurement (as `flow: auto` does): every engine picks the same width and size, and no
    // face is asked for just to decide this.
    const linesAt = (width: number, size: number) => estimatedLines(node.value, width, size);
    const measureAt = (size: number) => Math.min(cellWidth, PROSE_MEASURE_CHARS * AVERAGE_CHARACTER_EM * size);
    const lead = LEAD_NOMINAL_SIZE * scale;
    // LH-48: a lone block that grew (fillLone) keeps the reading measure at its grown size.
    const grown = proseGrowth.get(node);
    if (grown !== undefined) return { size: grown, width: linesAt(cellWidth, grown) <= 1 ? cellWidth : measureAt(grown) };
    if (node.lone && lead > role && linesAt(measureAt(lead), lead) <= 2) return { size: lead, width: linesAt(cellWidth, lead) <= 1 ? cellWidth : measureAt(lead) };
    // A block that is one line across its whole cell keeps that line; only text that wraps takes the reading measure.
    return { size: role, width: linesAt(cellWidth, role) <= 1 ? cellWidth : measureAt(role) };
  };
  // LH-48: a body of paragraphs and lists that fills too little of its height is composed again with every one of them a few steps of the
  // type scale larger (composeSlide, growBody), up to a list's display size; a paragraph in auto mode keeps the reading measure there.
  const bodySteps = Math.max(0, Math.floor(Number((options as Record<symbol, unknown>)[GROW] ?? 0)) || 0);
  const proseMeasure = (node: Pending, cellWidth: number): { size: number; width: number } => {
    // LH-70, LH-67: a paragraph of a paragraph grid starts at the size its columns were chosen for, and the lead of a lead plus stack at
    // the lead size; both keep at most a PARAGRAPH_MEASURE_MAX measure, and neither grows with the body (LH-48).
    const set = paragraphStarts.get(node);
    if (set !== undefined) return { size: set, width: Math.min(cellWidth, PARAGRAPH_MEASURE_MAX * AVERAGE_CHARACTER_EM * set) };
    const base = baseProseMeasure(node, cellWidth);
    if (!bodySteps || node.children || proseGrowth.has(node) || (node.field !== 'text' && node.field !== 'items' && node.field !== 'bullets')) return base;
    // Siblings stop a step under a lone message's display size, so a body of several blocks never reads louder than one statement.
    const display = LONE_DISPLAY_SIZES.list * scale;
    let size = base.size;
    for (let step = 0; step < bodySteps; step++) { const next = scaleAbove(size, composition.minFontSize ?? 16); if (next > display + 1e-9) break; size = next; }
    if (size === base.size || node.field !== 'text' || !(node.auto || node.measure)) return { size, width: base.width };
    return { size, width: estimatedLines(node.value, cellWidth, size) <= 1 ? cellWidth : Math.min(cellWidth, PROSE_MEASURE_CHARS * AVERAGE_CHARACTER_EM * size) };
  };
  // The height a node needs at `cellWidth` at the starting size: sizes the `auto` rows of a template and the stack of an
  // anchored region. Text is measured; other payloads use a fixed estimate (pictures and charts at 16:10).
  // Blocks whose height is measured from their content (a group when all its blocks are); the others take any height.
  // LH-41: a timeline is measured too (its label bands included), so a stack never squeezes it under its labels.
  const MEASURED_FIELDS = new Set(['text', 'items', 'bullets', 'quote', 'metric', 'code', 'table', 'timeline']);
  const measuredNode = (node: Pending): boolean => node.children ? node.children.length > 0 && node.children.every(measuredNode) : MEASURED_FIELDS.has(node.field);
  // LH-44: a table measured as layoutTable lays it out at `width`: in a box taller than it asks for (its rows at the starting size,
  // `naturalHeight`, are its need; the widths it asks for), or, `atFloor`, in a box too short for it, which steps its type to the floor
  // and keeps every row at its floor (its line height plus its insets). Undefined for a table layoutTable rejects; the caller keeps its estimate.
  const tableMeasures = new WeakMap<Pending, Map<string, TableLayout | undefined>>();
  const measureTable = (node: Pending, width: number, settings: Composition, atFloor = false): TableLayout | undefined => {
    const cache = tableMeasures.get(node) ?? new Map<string, TableLayout | undefined>(), key = `${round(width)}:${settings.minFontSize ?? 16}:${atFloor}:${growthOf.get(node) ?? 1}`;
    tableMeasures.set(node, cache);
    if (!cache.has(key)) {
      let measured: TableLayout | undefined;
      try { measured = width > 0 ? layoutTable(node.value, { x: 0, y: 0, width, height: atFloor ? scale : 1e6 }, { scale, minFontSize: settings.minFontSize, fontFamily: options.fontFamilies?.body, ...(options.fontFamilies?.code ? { codeFontFamily: options.fontFamilies.code } : {}), textMeasurement: options.textMeasurement, path: node.path, presentation: options.presentation, ...grownOptions(node) }) : undefined; }
      catch { measured = undefined; }
      cache.set(key, measured);
    }
    return cache.get(key);
  };
  // `atFloor` (WI-1): the height at the minimum font size instead, which says how far the block can shrink; text and lists
  // are measured there, other payloads scale their need by the minimum over the starting size.
  const naturalHeight = (node: Pending, cellWidth: number, cards: boolean, metricReferenceHeight?: number, naturalSettings: Composition = composition, atFloor = false, sizeOverride?: number): number => {
    const pad = cards ? 2 * Math.min(CARD_INSET * scale, cellWidth / 4) : 0, inner = Math.max(scale, cellWidth - pad);
    // payloadBox's vertical inset, min(inset, height / 10), for a card of `content` plus that inset: content / 8 on each side.
    const verticalPad = (content: number) => cards ? 2 * Math.min(pad / 2, content / 8) : 0;
    // LH-44: a synthetic row of blocks (tableArrangement's band) is as tall as its tallest block in its share of the width.
    if (node.children && node.synthetic && node.composition?.mode === 'row') {
      const between = node.gap ?? gap, share = Math.max(scale, (cellWidth - between * (node.children.length - 1)) / node.children.length);
      return Math.max(0, ...node.children.map(child => naturalHeight(child, share, cards, undefined, naturalSettings, atFloor)));
    }
    // LH-58 with LH-47: a synthetic automatic band (groupRoot's majority grid) is measured as the balanced grid it is drawn as, each row
    // as tall as its tallest block in its cell, not as a stack of its blocks, which asked for every block's height and left the row of
    // the other blocks under it at its floor.
    if (node.children && node.synthetic && !node.orient && node.children.length > 1 && (node.composition?.mode ?? 'auto') === 'auto') {
      const between = node.gap ?? gap, perRow = gridFlowShape(node.children.length, true).perRow;
      let from = 0;
      return perRow.reduce((sum, count, row) => {
        const share = Math.max(scale, (cellWidth - between * (count - 1)) / count), members = node.children!.slice(from, from + count);
        from += count;
        return sum + (row ? between : 0) + Math.max(0, ...members.map(child => naturalHeight(child, share, cards, undefined, naturalSettings, atFloor)));
      }, 0);
    }
    if (node.children) { const content = node.children.reduce((sum, child) => sum + naturalHeight(child, cellWidth, false, undefined, naturalSettings, atFloor), 0) + gap * Math.max(0, node.children.length - 1); return content + verticalPad(content); }
    const floorSize = snapFontSizeUp((naturalSettings.minFontSize ?? 16) * scale);
    let content: number, eyebrowNeed = 0;
    if (node.field === 'text' || node.field === 'items' || node.field === 'bullets') {
      const prose = proseMeasure(node, inner), size=sizeOverride ?? (atFloor ? floorSize : prose.size);
      // LH-50: a paragraph's eyebrow over it, at the size it takes over the paragraph at `size`.
      if (node.eyebrow) eyebrowNeed = eyebrowBand(node.eyebrow, inner, size);
      // LH-42: the floor is the one the placed fit uses, not the trial size: a list's descriptions (0.82 of its size) may reach the
      // floor, so a floor of `size` measured a described list one size step above `size` (24.4 px for a trial of 20).
      const value = contentText(node.field, node.value) ?? '', measured = (width: number) => fitContent(node.field, node.value, value, { x: 0, y: 0, width, height: 1e6 }, size, Math.min(size, floorSize), node.path, node.payload.numbering);
      const width = paragraphStarts.has(node) ? Math.min(inner, PARAGRAPH_MEASURE_MAX * AVERAGE_CHARACTER_EM * size) : atFloor || sizeOverride !== undefined ? inner : prose.width;
      let fit = measured(width);
      // LH-72: a long text a centered layout start-aligns is set in its measure column, so the row it asks for holds it there.
      if (ruleOn('centered-column') && centeredLong(node, fit, value) && PARAGRAPH_MEASURE_MAX * AVERAGE_CHARACTER_EM * fit.fontSize < width - .5) fit = measured(PARAGRAPH_MEASURE_MAX * AVERAGE_CHARACTER_EM * fit.fontSize);
      // WI-1: the height the placed text takes (its outlines and raster padding included), the same measure the fit that
      // places it checks, so a box of this height holds the text at the starting size instead of one grid step smaller.
      content = Math.max('height' in fit && typeof fit.height === 'number' ? fit.height : fit.lines.length * fit.lineHeight, fit.placement?.height ?? 0);
    } else if (node.field === 'quote') content = measureQuote(node, {x:0,y:0,width:inner,height:1e6}, naturalSettings).bounds.height + 18;
    else if (node.field === 'code') {
      // WI-1: measured as layoutCode lays it out: the header lines, the source at its starting size and the insets.
      const code = measureCode(node, {x:0,y:0,width:inner,height:1e6}, naturalSettings, false, true), source = code.parts.find(part => part.role === 'body');
      content = source?.fit ? source.box.y + source.fit.lines.length * source.fit.lineHeight + 18 : 1e6;
    }
    else if (node.field === 'metric') content = measureMetric(node, {x:0,y:0,width:inner,height:metricReferenceHeight === undefined ? 1e6 : Math.max(scale,metricReferenceHeight-pad)}, naturalSettings).bounds.height;
    // LH-41: laid out as the region will (a band, compact, at its role sizes or the floor): its name, label bands and markers.
    else if (node.field === 'timeline') content = measureTimeline(node, {x:0,y:0,width:inner,height:1e6}, naturalSettings, atFloor ? 'floor' : 'role').bounds.height + scale;
    else if (node.field === 'table') content = (atFloor ? measureTable(node, inner, naturalSettings, true)?.height : measureTable(node, inner, naturalSettings)?.naturalHeight) ?? ((Array.isArray(record(node.value).rows) ? record(node.value).rows.length : 4) + 1) * 36 * scale * (atFloor ? Math.min(1, floorSize / startSize) : 1);
    else content = inner / 1.6;
    if (atFloor && !(node.field === 'text' || node.field === 'items' || node.field === 'bullets' || node.field === 'table' || node.field === 'timeline')) content *= Math.min(1, floorSize / startSize);
    const body = content + (node.caption !== undefined ? 32 * scale : 0) + eyebrowNeed;
    return body + verticalPad(body);
  };
  // LH-48: the one block of a slide body (fills: the only root block, or a template's only block) that fills under LONE_FILL of its cell's
  // height at its role sizes steps up: a paragraph or a list by the steps of the type scale (scaleStep) above its size, a quote, code panel
  // or metric by the scale's ratio on every role (each up to its display size, LONE_DISPLAY_SIZES), to the largest step at which it fills
  // at most LONE_TARGET of the cell and every part keeps the size it asks for. It then sits in the middle of the cell, its card hugging it,
  // as Claude Design sets a short message. A block that fills half its cell or more keeps its sizes and its place. Returns the cell to
  // place it in, or undefined.
  const LONE_FIELDS: ReadonlySet<string> = new Set(['text', 'items', 'bullets', 'quote', 'code', 'metric', 'table']);
  // The smallest step of the type scale above `size`.
  const scaleAbove = (size: number, floorPx: number): number => {
    for (let power = 0; ; power++) { const step = snapFontSizeDown(Math.round(floorPx * TYPE_SCALE_RATIO ** power) * scale); if (step > size + 1e-9) return step; }
  };
  const fillLone = (node: Pending, cell: LayoutBox, settings: Composition, cards: boolean): LayoutBox | undefined => {
    // Decided once: the block is then placed in the cell this returns.
    if (!node.fills || options.fill === false) return undefined;
    node.fills = false;
    if (node.children || node.caption !== undefined || !LONE_FIELDS.has(node.field) || node.payload.columns !== undefined) return undefined;
    const inner = payloadBox(cell, cards), prose = node.field === 'text' || node.field === 'items' || node.field === 'bullets';
    if (inner.width <= 0 || inner.height <= 0) return undefined;
    // A table needs the height it is drawn at (its preferred rows), every other block the height its content takes.
    const slack = 2 * rasterPadding + scale, need = () => (node.field === 'table' ? measureTable(node, inner.width, settings)?.height ?? Infinity : naturalHeight(node, inner.width, false, undefined, settings)) + slack;
    let best = need();
    // LH-101: a lone code panel grows its code in type-scale steps as the other blocks do (up to LONE_DISPLAY_SIZES.code) and hugs it in
    // the middle of the body. Only code that then fills at least LONE_TARGET of the body takes the whole cell, its lines in the middle of
    // the panel (layoutCode's `fill`): a five-line snippet on a full-body panel left most of a dark panel empty (wave 4 golden review).
    const panel = node.field === 'code', wholePanel = () => { fullPanels.add(node); return cell; };
    const fillsPanel = () => panel && best >= LONE_TARGET * inner.height - 1e-6 && best <= inner.height;
    // A panel's need counts its insets and its filename row, so a panel under LONE_TARGET still grows and centers.
    if (best >= (panel ? LONE_TARGET : LONE_FILL) * inner.height) return fillsPanel() ? wholePanel() : undefined;
    const floor = snapFontSizeUp((settings.minFontSize ?? 16) * scale);
    if (prose) {
      const start = proseMeasure(node, inner.width).size, display = (node.field === 'text' ? LONE_DISPLAY_SIZES.text : LONE_DISPLAY_SIZES.list) * scale;
      let chosen: number | undefined;
      for (let size = start; ; ) {
        const step = scaleAbove(size, settings.minFontSize ?? 16);
        if (step > display + 1e-9) break;
        proseGrowth.set(node, step);
        const height = need(), measure = proseMeasure(node, inner.width);
        const fit = fitContent(node.field, node.value, contentText(node.field, node.value) ?? '', { ...inner, width: measure.width }, step, floor, node.path, node.payload.numbering);
        if (height > LONE_TARGET * inner.height || fit.overflow || fit.fontSize < step - 1e-9) break;
        chosen = step; best = height; size = step;
      }
      if (chosen === undefined) proseGrowth.delete(node); else { proseGrowth.set(node, chosen); loneGrowth = true; }
    } else {
      let chosen: number | undefined;
      // LH-101: a metric's value has room to grow to LONE_DISPLAY_SIZES.value (nine steps); the other blocks reach their displays in five.
      const target = node.field === 'metric' ? LONE_METRIC_TARGET : LONE_TARGET;
      for (let power = 1; power <= (node.field === 'metric' ? 9 : 5); power++) {
        const growth = TYPE_SCALE_RATIO ** power;
        growthOf.set(node, growth);
        const height = need();
        let fits: boolean;
        if (node.field === 'table') {
          // A table keeps its words whole and every cell at the grown size.
          const table = measureTable(node, inner.width, settings), size = gridFontSize(grownRoleSize(TABLE_NOMINAL_SIZE, growth, LONE_DISPLAY_SIZES.table) * scale, floor);
          fits = !!table && !table.overflow && !table.splitsWords && table.rows.every(row => row.cells.every(cell => cell.fit.fontSize >= size - 1e-9 || Array.isArray(cell.value)));
        } else {
          const layout = node.field === 'quote' ? measureQuote(node, inner, settings) : node.field === 'code' ? measureCode(node, inner, settings) : measureMetric(node, inner, settings);
          fits = !layout.overflow && (layout.parts as readonly { fit?: { fontSize: number }; requestedFontSize: number; visible?: boolean }[]).every(part => part.visible === false || (part.fit !== undefined && part.fit.fontSize >= part.requestedFontSize - 1e-9));
        }
        if (height > target * inner.height || !fits) break;
        chosen = growth; best = height;
      }
      if (chosen === undefined) growthOf.delete(node); else { growthOf.set(node, chosen); loneGrowth = true; }
    }
    if (fillsPanel()) return wholePanel();
    // The cell the block is placed in: its need, plus a card's vertical insets as payloadBox gives a card that tall, in the middle.
    let height = best;
    if (cards) for (let pass = 0; pass < 3; pass++) { const frame = acceptedBox({ ...cell, height: Math.min(cell.height, height) }), room = payloadBox(frame, true).height; if (room >= best - 1e-6) break; height += best - room; }
    height = Math.min(cell.height, height);
    // LH-114: with a pull line the block and the pull line are one stack at the top of the body (pullStack).
    return { ...cell, y: pullItem ? cell.y : cell.y + (cell.height - height) / 2, height };
  };
  // LH-58: a pair is one cell of its two blocks, half a gap apart: side by side when each half is at least PAIR_ROW_RATIO of the
  // cell's height wide (a metric beside its note in a wide cell), else the figure above its text. One rule for every pair of a
  // grid, whose cells share one size, so the pairs match.
  const PAIR_ROW_RATIO = .8;
  const pairMode = (box: LayoutBox): 'row' | 'column' => (box.width - gap / 2) / 2 >= PAIR_ROW_RATIO * box.height ? 'row' : 'column';
  const pairUnit = (members: Pending[]): Pending => ({ field: 'blocks', type: 'group', value: members.map(member => member.payload), path: members[0]!.path, payload: {}, children: members, composition: { mode: 'column' }, synthetic: true, gap: gap / 2, orient: true });
  // LH-46: the pictures of a mosaic, drawn cover-cropped.
  const coverPictures = new WeakSet<Pending>();
  // LH-50: the eyebrow of each placed paragraph, drawn over its final box once every pass has moved it (placeEyebrows).
  const eyebrowsOf = new Map<ComposedItem, { path: string; value: unknown }>();
  // LH-58, LH-82, automatic composition only (a template groups its binding, groupBinding): the root blocks, one node each, of a
  // slide with no composition of its own, as repeated pairs (one cell per pair) or, for interleaved blocks of two kinds with
  // unequal counts, a grid of the majority kind above a row of the others (one column of the two). Undefined: as authored.
  const groupRoot = (nodes: Pending[]): { nodes: Pending[]; settings?: Composition } | undefined => {
    if (useTemplate || regions.length || !Array.isArray(slide.blocks) || chartPrimary || modeFor(rootSettings) !== 'auto' || rootSettings.columns !== undefined || rootSettings.weights?.length) return undefined;
    const blockOf = (node: Pending) => node.children ? node.path : node.path.slice(0, node.path.lastIndexOf('.'));
    if (new Set(nodes.map(blockOf)).size !== nodes.length || slide.blocks.some((block: unknown) => record(block).region !== undefined)) return undefined;
    // LH-50: a paragraph with an eyebrow pairs with nothing.
    const grouping = nodes.map(node => node.children ? { kind: 'group', group: true } : node.eyebrow ? { kind: EYEBROW_TEXT_KIND } : { kind: kind(node.field), ...(node.field === 'text' ? { length: textLength(node.value) } : {}) });
    const pairs = repeatedPairs(grouping);
    if (pairs) return { nodes: Array.from({ length: pairs.count }, (_, pair) => pairUnit([nodes[2 * pair]!, nodes[2 * pair + 1]!])) };
    const split = majorityKind(grouping);
    if (!split) return undefined;
    const band = (members: Pending[], composition: Composition): Pending => members.length === 1 ? members[0]! : { field: 'blocks', type: 'group', value: members.map(member => member.payload), path, payload: {}, children: members, composition, synthetic: true, gap };
    const others = split.others.map(index => nodes[index]!);
    return { nodes: [band(split.majority.map(index => nodes[index]!), {}), band(others, others.length <= 3 ? { mode: 'row' } : {})], settings: { ...rootSettings, mode: 'column' } };
  };
  // LH-43: a block whose size its siblings share: a paragraph or a list, with no caption and no children.
  const proseLeaf = (node: Pending): boolean => !node.children && node.caption === undefined && (node.field === 'text' || node.field === 'items' || node.field === 'bullets');
  // LH-43 (LH-42 did it for a list grid): the rows of a grid whose cells share one size (sharePeerSizes) are sized jointly, not fixed in
  // advance. At a trial size every row is as tall as its tallest cell needs, a card's insets included, and the trial is the largest
  // size of the type scale (scaleSizes) at which the rows fit the area, so a long sibling no longer forces a small size on cells whose
  // rows keep equal heights. With `spread` (cards, an automatic grid) the height left over goes to the rows in proportion to their
  // needs, so they fill the area and a row of short texts stays a short row; otherwise the rows keep their needs and the anchor places
  // them. The cells of one row keep its height, so cards line up, and columns keep their widths. Rows that do not fit at the floor get
  // heights in proportion to their needs and overflow them, so the overflow is reported.
  const jointRowBoxes = (units: Pending[], cells: LayoutBox[], rowOf: number[], area: LayoutBox, between: number, settings: Composition, cards: boolean, anchor: RegionAnchor, spread: boolean): LayoutBox[] => {
    const rows = Math.max(0, ...rowOf) + 1, space = Math.max(0, area.height - between * (rows - 1));
    // A filled card starts CARD_FILL_SPACE of a gap down (placeNode), and the placed text keeps its raster padding. A card's text is
    // measured inside payloadBox's inset for a card at least as tall as wide, its largest, so the need is never short.
    const slack = 2 * rasterPadding + scale + (cards ? gap * CARD_FILL_SPACE : 0);
    const inset = (width: number) => cards ? Math.min(CARD_INSET * scale, Math.max(12 * scale, width / 16), width / 4) : 0;
    const starts = units.map((unit, index) => proseMeasure(unit, cells[index]!.width - 2 * inset(cells[index]!.width)).size);
    let needs: number[] = [];
    for (const trial of scaleSizes(Math.max(...starts), settings.minFontSize ?? 16)) {
      needs = Array.from({ length: rows }, () => 0);
      units.forEach((unit, index) => {
        const width = cells[index]!.width, pad = inset(width), row = rowOf[index]!;
        needs[row] = Math.max(needs[row]!, naturalHeight(unit, width - 2 * pad, false, undefined, settings, false, Math.min(trial, starts[index]!)) + 2 * pad + slack);
      });
      if (needs.reduce((sum, need) => sum + need, 0) <= space + 1e-6) break;
    }
    const total = needs.reduce((sum, need) => sum + need, 0), spare = Math.max(0, space - total);
    const heights = total > space + 1e-6 ? needs.map(need => need * space / total) : spread ? needs.map(need => need + spare * need / total) : needs;
    const rowY: number[] = [], shift = spread ? 0 : anchor === 'middle' ? spare / 2 : anchor === 'bottom' ? spare : 0;
    heights.reduce((y, height) => { rowY.push(y); return y + height + between; }, area.y + shift);
    return cells.map((box, index) => ({ ...box, y: rowY[rowOf[index]!]!, height: heights[rowOf[index]!]! }));
  };
  // LH-72: a centered layout (the alignment comes from the layout record or the theme, not the author's slide or deck) centers only
  // short text. A paragraph or list over CENTERED_MAX_LINES lines or CENTERED_MAX_CHARS characters is start-aligned (`left` is the start
  // edge, so a right-to-left deck aligns it at the right) in a column of at most PARAGRAPH_MEASURE_MAX characters, centered in its cell,
  // so the block still sits on the slide's axis. The column never costs size: a text that would overflow it keeps its cell's width.
  const CENTERED_MAX_LINES = 2, CENTERED_MAX_CHARS = 120;
  const centeredLong = (node: Pending, text: TextFit | RichTextFit, value: string): boolean => {
    const source = hints.sources.contentAlignment;
    if (!['text', 'items', 'bullets'].includes(node.field) || alignmentFor(node.field) !== 'center' || (source !== 'layout' && source !== 'theme')) return false;
    return ('richLines' in text ? (text as RichTextFit).richLines.length : text.lines.length) > CENTERED_MAX_LINES || value.length > CENTERED_MAX_CHARS;
  };
  const startAlignedCenter = (node: Pending, text: TextFit | RichTextFit, value: string, box: LayoutBox): { text: TextFit | RichTextFit; box: LayoutBox } | undefined => {
    if (!centeredLong(node, text, value)) return undefined;
    const size = text.fontSize, width = Math.min(box.width, PARAGRAPH_MEASURE_MAX * AVERAGE_CHARACTER_EM * size);
    const refit = (cell: LayoutBox) => fitContent(node.field, node.value, value, cell, size, size, node.path, node.payload.numbering, 'left');
    if (width < box.width - .5 && ruleOn('centered-column')) {
      const column = { ...box, x: box.x + (box.width - width) / 2, width }, narrow = refit(column);
      if (!narrow.overflow) { fire('centered-column'); return { text: narrow, box: column }; }
    }
    return { text: refit(box), box };
  };
  // LH-70: sibling paragraphs of similar length (PARAGRAPH_GRID_MIN to PARAGRAPH_GRID_MAX texts of PARAGRAPH_MIN_CHARS to
  // PARAGRAPH_MAX_CHARS characters, the longest less than PAIR_LENGTH_RATIO times the shortest) are parallel items, so they read as a
  // grid of columns, each PARAGRAPH_MEASURE_MIN to PARAGRAPH_MEASURE_MAX characters wide, not as a stack of long lines or a lead.
  // The shapes are 2 to PARAGRAPH_GRID_COLUMNS full columns (3: 2 + 1 or one row; 4: 2 x 2, 3 + 1 or a row; 6: 2 x 3 or 3 x 2); the cells
  // of a short row stretch (LH-47) and their text keeps the measure. Each shape takes the largest size of the type scale at which its
  // narrowest column is at least PARAGRAPH_MEASURE_MIN characters and its rows, sized jointly at the measure, fit the area; the shape
  // with the largest size wins, one with no row of a single cell on a tie, then the fewer columns. Undefined (the region's own flow) when
  // no shape fits. composeSlide keeps the columns only when they are no smaller than the region's own arrangement (readsAsWell).
  const PARAGRAPH_GRID_MIN = 3, PARAGRAPH_GRID_MAX = 6, PARAGRAPH_MIN_CHARS = 100, PARAGRAPH_MAX_CHARS = 240, PARAGRAPH_GRID_COLUMNS = 4;
  const paragraphStarts = new WeakMap<Pending, number>();
  const cardInsetOf = (width: number, cards: boolean) => cards ? Math.min(CARD_INSET * scale, Math.max(12 * scale, width / 16), width / 4) : 0;
  const similarParagraphs = (units: Pending[]): boolean => {
    if (units.length < PARAGRAPH_GRID_MIN || units.length > PARAGRAPH_GRID_MAX || !units.every(unit => proseLeaf(unit) && unit.field === 'text')) return false;
    const lengths = units.map(unit => textLength(unit.value));
    return lengths.every(length => length >= PARAGRAPH_MIN_CHARS && length <= PARAGRAPH_MAX_CHARS) && Math.max(...lengths) < PAIR_LENGTH_RATIO * Math.min(...lengths);
  };
  const paragraphShapes = (count: number): FlowShape[] => {
    const shapes = new Map<string, FlowShape>();
    for (let columns = 2; columns <= Math.min(count, PARAGRAPH_GRID_COLUMNS); columns++) {
      const rows = Math.ceil(count / columns), perRow = Array.from({ length: rows }, (_, row) => Math.min(columns, count - row * columns));
      shapes.set(perRow.join(), { columns, rows, perRow });
    }
    return [...shapes.values()];
  };
  // What each row of a paragraph grid needs at `size`: its tallest paragraph at the measure its cell allows, a card's insets included.
  const paragraphRowNeeds = (units: Pending[], shape: FlowShape, cells: LayoutBox[], cards: boolean, size: number, settings: Composition): number[] => {
    const slack = 2 * rasterPadding + scale + (cards ? gap * CARD_FILL_SPACE : 0), needs = shape.perRow.map(() => 0);
    let index = 0;
    shape.perRow.forEach((count, row) => {
      for (let k = 0; k < count; k++, index++) {
        const pad = cardInsetOf(cells[index]!.width, cards), width = Math.min(cells[index]!.width - 2 * pad, PARAGRAPH_MEASURE_MAX * AVERAGE_CHARACTER_EM * size);
        needs[row] = Math.max(needs[row]!, naturalHeight(units[index]!, width, false, undefined, settings, false, size) + 2 * pad + slack);
      }
    });
    return needs;
  };
  const paragraphColumns = (units: Pending[], area: LayoutBox, cards: boolean, settings: Composition): { shape: FlowShape; size: number } | undefined => {
    if (!ruleOn('paragraph-columns') || !similarParagraphs(units)) return undefined;
    const lone = (shape: FlowShape) => shape.rows > 1 && Math.min(...shape.perRow) === 1;
    let best: { shape: FlowShape; size: number } | undefined;
    for (const shape of paragraphShapes(units.length)) {
      const { cells, gap: between } = flowCells(shape, area, gap, true);
      const narrowest = Math.min(...cells.map(cell => cell.width - 2 * cardInsetOf(cell.width, cards)));
      for (const size of scaleSizes(PROSE_NOMINAL_SIZE * scale, settings.minFontSize ?? 16)) {
        if (narrowest < PARAGRAPH_MEASURE_MIN * AVERAGE_CHARACTER_EM * size) continue;
        const needs = paragraphRowNeeds(units, shape, cells, cards, size, settings);
        if (needs.reduce((sum, need) => sum + need, 0) + between * (shape.rows - 1) > area.height + 1e-6) continue;
        if (!best || size > best.size + 1e-9 || (Math.abs(size - best.size) < 1e-9 && lone(best.shape) && !lone(shape))) best = { shape, size };
        break;
      }
    }
    if (best) fire('paragraph-columns');
    return best;
  };
  // The height a paragraph grid needs at an area's width (an `auto` row): its rows at the size it chooses for a body-tall area, or at the floor.
  const paragraphNeed = (units: Pending[], plan: { shape: FlowShape; size: number }, width: number, cards: boolean, settings: Composition, atFloor: boolean): number => {
    const { cells, gap: between } = flowCells(plan.shape, { x: 0, y: 0, width, height: 1e6 }, gap, true);
    const size = atFloor ? snapFontSizeUp((settings.minFontSize ?? 16) * scale) : plan.size;
    return paragraphRowNeeds(units, plan.shape, cells, cards, size, settings).reduce((sum, need) => sum + need, 0) + between * (plan.shape.rows - 1);
  };
  // LH-67: lead plus stack. Of LEAD_STACK_MIN to LEAD_STACK_MAX sibling texts or quotes, a paragraph (at least PARAGRAPH_MIN_CHARS) at
  // least LEAD_MEDIAN_RATIO times the median length of the others and PAIR_LENGTH_RATIO times the next longest leads: a cell LEAD_SHARE of the width at full height, starting one
  // role step larger (the lead size for a text, the display size for a quote), and the others stack in the column beside it. A chart or
  // picture with two compact siblings (metrics, or texts and quotes of at most COMPACT_CHARS) leads the same way at FIGURE_LEAD_SHARE.
  // The lead sits at the start unless it is the last block (then at the end), so the reading order holds; right to left mirrors it.
  const LEAD_STACK_MIN = 3, LEAD_STACK_MAX = 5, LEAD_MEDIAN_RATIO = 2.5, LEAD_SHARE = .55, FIGURE_LEAD_SHARE = .58, COMPACT_CHARS = CENTERED_MAX_CHARS;
  type LeadStack = { lead: number; share: number };
  const stackLeads = new WeakSet<Pending>();
  const leadLength = (node: Pending): number => textLength(node.field === 'quote' ? typeof node.value === 'string' ? node.value : record(node.value).text : node.value);
  const leadStack = (units: Pending[]): LeadStack | undefined => {
    if (!ruleOn('lead-stack') || units.length < LEAD_STACK_MIN || units.length > LEAD_STACK_MAX || units.some(unit => unit.children)) return undefined;
    let plan: LeadStack | undefined;
    if (units.every(unit => unit.caption === undefined && (unit.field === 'text' || unit.field === 'quote'))) {
      const lengths = units.map(leadLength), lead = lengths.indexOf(Math.max(...lengths));
      const others = lengths.filter((_, index) => index !== lead).sort((a, b) => a - b), half = others.length >> 1;
      const median = others.length % 2 ? others[half]! : (others[half - 1]! + others[half]!) / 2;
      if (lengths[lead]! >= PARAGRAPH_MIN_CHARS && lengths[lead]! >= LEAD_MEDIAN_RATIO * median && lengths[lead]! >= PAIR_LENGTH_RATIO * others.at(-1)!) plan = { lead, share: LEAD_SHARE };
    } else if (units.length === 3) {
      const figures = units.flatMap((unit, index) => unit.field === 'chart' || unit.field === 'image' ? [index] : []);
      const compact = (unit: Pending) => unit.caption === undefined && (unit.field === 'metric' || ((unit.field === 'text' || unit.field === 'quote') && leadLength(unit) <= COMPACT_CHARS));
      if (figures.length === 1 && units.every((unit, index) => index === figures[0] || compact(unit))) plan = { lead: figures[0]!, share: FIGURE_LEAD_SHARE };
    }
    if (plan) { stackLeads.add(units[plan.lead]!); fire('lead-stack'); }
    return plan;
  };
  // The lead's cell and the stack's column (logical, left to right). The stack is measured (stackedBoxes) and the height it leaves goes to
  // its blocks evenly, so both columns run the full height.
  const leadStackBoxes = (units: Pending[], plan: LeadStack, area: LayoutBox, between: number, settings: Composition, cards: boolean): LayoutBox[] => {
    const span = Math.max(0, area.width - between), leadWidth = span * plan.share, stackWidth = span - leadWidth, atEnd = plan.lead === units.length - 1;
    const lead = { x: atEnd ? area.x + stackWidth + between : area.x, y: area.y, width: leadWidth, height: area.height };
    const others = units.filter((_, index) => index !== plan.lead), column = { x: atEnd ? area.x : area.x + leadWidth + between, y: area.y, width: stackWidth, height: area.height };
    const stacked = stackedBoxes(others, column, between, settings, cards);
    const used = stacked.reduce((sum, box) => sum + box.height, 0) + between * (others.length - 1), spare = Math.max(0, area.height - used) / others.length;
    let y = area.y;
    const filled = stacked.map(box => { const next = { ...box, y, height: box.height + spare }; y += next.height + between; return next; });
    return units.map((_, index) => index === plan.lead ? lead : filled[index < plan.lead ? index : index - 1]!);
  };
  // What a lead plus stack needs in an `auto` row: the taller of the lead in its cell and the stack in its column.
  const leadStackNeed = (units: Pending[], plan: LeadStack, width: number, cards: boolean, settings: Composition, atFloor: boolean): number => {
    const span = Math.max(0, width - gap), others = units.filter((_, index) => index !== plan.lead);
    return Math.max(naturalHeight(units[plan.lead]!, span * plan.share, cards, undefined, settings, atFloor),
      others.reduce((sum, unit) => sum + naturalHeight(unit, span * (1 - plan.share), cards, undefined, settings, atFloor), 0) + gap * (others.length - 1));
  };
  // LH-78: a quote beside other blocks (any block on the slide that is not a quote, or three or more quotes) starts at the lead size on a
  // card and fits in QUOTE_BESIDE_LINES lines; a lone quote, and one or two quotes alone on the slide, keep the display size. The lead
  // of a lead plus stack keeps the display size.
  const bodyLeaves = (nodes: Pending[]): Pending[] => nodes.flatMap(node => node.children ? bodyLeaves(node.children) : [node]);
  const quotesBeside = (() => {
    const leaves = bodyLeaves(pending), quotes = leaves.filter(leaf => leaf.field === 'quote');
    if (!(ruleOn('quote-beside') || ruleOn('quote-card')) || !quotes.length || leaves.length === 1 || (quotes.length === leaves.length && quotes.length <= 2)) return new Set<string>();
    for (const rule of ['quote-beside', 'quote-card'] as const) if (ruleOn(rule)) fire(rule);
    return new Set(quotes.map(quote => quote.path));
  })();
  const besideQuote = (node: Pending) => node.field === 'quote' && !node.children && quotesBeside.has(node.path) && !stackLeads.has(node);
  // LH-86: long texts as full-width rows. Two or three paragraphs of at least LONG_TEXT_CHARS characters each, drawn as cards side by
  // side (in regions of one row of the grid, or in one region's grid), read as narrow columns of long lines beside one another, and a
  // short one in a wide card beside a long one in a narrow card (an empty region collapsed into it). They are drawn one card per row
  // instead, across the whole row: every block moves to the first region of the row in reading order, the others are left empty and
  // collapse into it, and that region stacks them (arrangementOf). Only a slide that draws cards, with no contentDirection and no
  // composition of its own, whose row holds nothing else, nothing beyond a region's room and nothing below the grid.
  const LONG_TEXT_CHARS = 80, LONG_TEXT_ROWS = 3, LONG_TEXT_HUG = .45;
  const longTextUnit = (unit: Pending): boolean => !unit.children && unit.caption === undefined && unit.field === 'text' && textLength(unit.value) >= LONG_TEXT_CHARS;
  const longTextRows = (grouped: GroupedBinding, plan: LayoutTemplate): { binding: GroupedBinding; region?: string } => {
    const own = record(slide.composition);
    if (!hasCards || direction !== undefined || grouped.belowUnits.length || ['mode', 'columns', 'weights'].some(key => own[key] !== undefined)) return { binding: grouped };
    const longBlock = (unit: BoundBlock[]): boolean => {
      const host = unit.length === 1 && unit[0]!.block !== undefined ? record(slide.blocks?.[unit[0]!.block]) : undefined;
      return !!host && host.caption === undefined && typeof host.text !== 'undefined' && fields.every(field => field === 'text' || host[field] === undefined) && textLength(host.text) >= LONG_TEXT_CHARS;
    };
    const rects = areaRects(plan.grid), band = (name: string) => { const rect = rects.get(name); return rect ? `${rect.row}:${rect.rowSpan}` : undefined; };
    const filled = plan.regions.filter(region => grouped.units.get(region.name)?.length);
    const key = filled.length ? band(filled[0]!.name) : undefined;
    if (key === undefined || filled.some(region => band(region.name) !== key)) return { binding: grouped };
    const row = plan.regions.filter(region => band(region.name) === key).sort((a, b) => rects.get(a.name)!.column - rects.get(b.name)!.column);
    const units = row.flatMap(region => grouped.units.get(region.name) ?? []);
    const side = filled.length > 1 || filled[0]!.flow !== 'column';
    if (!side || units.length < 2 || units.length > LONG_TEXT_ROWS || !units.every(longBlock)) return { binding: grouped };
    if (row.some(region => region.bleed || (region !== row[0] && region.empty === 'keep') || grouped.regions.find(entry => entry.name === region.name)?.overflow.length)) return { binding: grouped };
    const target = row[0]!.name, names = new Set(row.map(region => region.name));
    fire('long-text-rows');
    const moved = new Map(grouped.units);
    for (const region of row) moved.set(region.name, region.name === target ? units : []);
    return { binding: { ...grouped, units: moved, regions: grouped.regions.map(entry => entry.name === target ? { ...entry, blocks: units.flat() } : names.has(entry.name) ? { ...entry, blocks: [] } : entry) }, region: target };
  };
  // LH-86 (and wave 2's b04 s17): a stacked column of long-text cards shares the region's height row by row, so the cards fill the
  // region instead of leaving a band of it empty, and their text is set at the largest size of the type scale (scaleSizes) at which
  // every row fits: each card as tall as its text at that size plus the insets payloadBox gives a card of that height (a wide, short
  // card keeps a tenth of its height above and below its text, not the inset of a tall one), and the height left over shared in
  // proportion to the needs. The gap between the cards closes to half a gap when that sets the text larger (content before padding,
  // as LH-41's bands do). Rows that do not fit at the floor share the region in proportion to their needs and overflow, with their
  // finding. Each card's text is centered in it afterwards (centerCardText).
  const centeredCardText: number[] = [];
  const longTextRowBoxes = (units: Pending[], cell: LayoutBox, settings: Composition, gapSize: number): LayoutBox[] => {
    const cardNeed = (unit: Pending, size: number): number => {
      let height = 0, inner = cell.width;
      for (let pass = 0; pass < 3; pass++) {
        const text = naturalHeight(unit, inner, false, undefined, settings, false, size) + 2 * rasterPadding + scale;
        const frame = acceptedBox({ x: 0, y: 0, width: cell.width, height: Math.max(height, text) }), box = payloadBox(frame, true);
        height = text + frame.height - box.height;
        inner = box.width;
      }
      return height;
    };
    const starts = units.map(unit => proseMeasure(unit, cell.width).size);
    let needs: number[] = [], between = gapSize / 2;
    for (const trial of scaleSizes(Math.max(...starts), settings.minFontSize ?? 16)) {
      needs = units.map((unit, index) => cardNeed(unit, Math.min(trial, starts[index]!)));
      const total = needs.reduce((sum, need) => sum + need, 0);
      const fitting = [gapSize, gapSize / 2].find(size => total + size * (units.length - 1) <= cell.height + 1e-6);
      if (fitting !== undefined) { between = fitting; break; }
    }
    const total = needs.reduce((sum, need) => sum + need, 0), space = Math.max(0, cell.height - between * (units.length - 1));
    // As LH-64's cards: rows whose text would fill under LONG_TEXT_HUG of their shared height (a few short paragraphs) hug their
    // text instead, and the stack sits in the middle of the region, since a large card around two lines reads as an empty card.
    const hug = total > 0 && total < LONG_TEXT_HUG * space;
    let y = cell.y + (hug ? (space - total) / 2 : 0);
    return needs.map(need => { const height = hug ? need : total > 0 ? need * space / total : space / units.length, box = { ...cell, y, height }; y += height + between; return box; });
  };
  const templateRegions: ComposedRegion[] = [], headingAreas: ComposedHeadingArea[] = [];
  // OPF 0.19: compose the body and headings through the template's areas (design sections 3 and 4).
  const requestedTemplateGap = gap;
  const composeTemplate = (): void => {
    const plan = template!, frame = contentBox;
    // LH-58, LH-82, LH-73, LH-46: blocks are grouped (pairs, kinds, extra blocks of fixed regions) before any cell is placed.
    // LH-06, LH-114: the block drawn as the automatic foot band or pill, and the quote drawn as a pull line, are bound to no region (an
    // empty block in its place keeps every index).
    const unbound = (index: number) => eyebrowBlocks.has(index) || (autoSurface && index === autoEmphasis?.block) || (pullItem && index === pullQuote?.block);
    const bound = autoSurface || pullItem || eyebrowBlocks.size ? { ...slide, blocks: slide.blocks.map((block: unknown, index: number) => unbound(index) ? {} : block) } : slide;
    // LH-86: long texts side by side become full-width rows of the row's first region (longTextRows), unless composeSlide leaves the rule out (its guard).
    const { binding, region: longTextRegion } = (!ruleOn('long-text-rows') ? (grouped: GroupedBinding) => ({ binding: grouped, region: undefined }) : longTextRows)(groupBinding(bindRegions(bound, layout, { slideIndex: options.slideIndex ?? 0 }), plan, rootNodes(bound, options.slideIndex ?? 0), { join: (options as Record<symbol, unknown>)[UNJOINED] !== true, labeled: new Set(eyebrowOf.keys()) }), plan);
    for (const entry of binding.diagnostics) diagnostics.push({ code: entry.code, path: entry.path, message: entry.message, ...(entry.region !== undefined ? { region: entry.region } : {}) });
    // A bound root node as composition reads it; a block with several payload fields stacks them in its cell.
    const blockUnit = (bound: BoundBlock): Pending => {
      const host = bound.block !== undefined ? record(slide.blocks[bound.block])
        : { ...Object.fromEntries((bound.fields ?? []).map(field => [field, slide[field]])), ...Object.fromEntries(['type', 'caption', 'numbering'].filter(key => slide[key] !== undefined).map(key => [key, slide[key]])) };
      const parts = collect(host, bound.block !== undefined ? `${path}.blocks.${bound.block}` : path);
      return parts.length === 1 ? parts[0]! : { field: 'blocks', type: 'group', value: parts.map(part => part.payload), path: bound.path, payload: {}, children: parts, composition: { mode: 'column' }, synthetic: true };
    };
    // A pair (LH-58) is one cell of its two blocks, half a gap apart, side by side or stacked as its cell's shape allows (pairMode).
    const unitOf = (bound: BoundBlock[]): Pending => bound.length === 1 ? blockUnit(bound[0]!) : pairUnit(bound.map(blockUnit));
    const contents = new Map<string, Pending[]>(binding.regions.map(entry => [entry.name, (binding.units.get(entry.name) ?? []).map(unitOf)]));
    // LH-46: the first block of a lead arrangement is a lone block (the lead size when it is short).
    for (const [name, arrangement] of binding.arrangements) if (arrangement === 'lead') { const lead = contents.get(name)?.[0]; if (lead) { lead.auto = true; lead.lone = true; } }
    // WI-4 (P34): the blocks of a `flow: auto` region are in auto mode; a region with one block makes it the lone block.
    for (const region of plan.regions) {
      const units = contents.get(region.name) ?? [];
      if (region.flow === 'auto') for (const unit of units) { unit.auto = true; unit.lone = units.length === 1; }
      // LH-10: a paragraph in any other region keeps the reading measure too (proseMeasure): a full-width note or verdict at the foot of a
      // layout ran 95 to 100 characters a line, where Claude Design keeps about 70.
      else if (ruleOn('region-measure')) for (const unit of units) if (!unit.children && unit.field === 'text') unit.measure = true;
      // LH-68: a metric of a `metrics: "tile"` region is a tile: it fills its cell (no hugging, no natural height) and is laid out in it.
      if (region.metrics === 'tile' && ruleOn('metric-tiles')) for (const unit of units) if (!unit.children && unit.field === 'metric') { metricTiles.add(unit); fire('metric-tiles'); }
    }
    // Content of a layout with no overflow region: an implicit auto row below the grid. Not an area name, so it never meets one.
    const BELOW = '(below)';
    const belowUnits = binding.belowUnits.map(unitOf);
    const belowRegion: LayoutRegion = { name: BELOW, accepts: [], role: 'supporting', flow: 'auto', max: belowUnits.length, bleed: false, listColumns: 1, anchor: 'top', empty: 'collapse' };
    const unitsOf = (name: string): Pending[] => name === BELOW ? belowUnits : contents.get(name) ?? [];
    // LH-48: a slide whose body is one block (one region holds it and nothing is below the grid) gives that block the body: its region's
    // cell reaches the foot of the content box when every other region is empty, and the block grows and moves to its middle (fillLone).
    // A stacked record (statement, quote, closing) already sets its message in the middle of the slide.
    const bodyUnits = [...contents.values()].flat().concat(belowUnits);
    const loneUnit = options.fill !== false && plan.stack === undefined && bodyUnits.length === 1 && !bodyUnits[0]!.children ? bodyUnits[0] : undefined;
    if (loneUnit) loneUnit.fills = true;
    // LH-41: several timelines in one region are the bands of one stack (horizontal only; compact at four or more), so that every
    // measure of the region (row needs, floors, placement) sees them as drawn. A lone timeline may grow when it fits (placeTimeline).
    const timelineBands = (units: Pending[]) => units.length > 1 && units.every(unit => !unit.children && unit.field === 'timeline' && unit.caption === undefined);
    for (const units of [...contents.values(), belowUnits]) {
      if (timelineBands(units)) for (const unit of units) timelineHints.set(unit, { horizontal: true, ...(units.length >= 4 ? { compact: true as const, inlineHeader: true } : {}) });
      else if (units.length === 1 && !units[0]!.children && units[0]!.field === 'timeline') timelineHints.set(units[0]!, { grow: true });
    }
    // LH-41: the bands of a stack, row by row in `columns` columns (reading order), each row as tall as its taller band, at the role
    // sizes or the floor.
    // In two columns an odd last band spans both, as Claude Design sets it: wider, it needs less height.
    const bandSpans = (index: number, count: number, columns: number) => columns === 2 && count % 2 === 1 && index === count - 1;
    const bandWidthOf = (index: number, count: number, columns: number, width: number) => bandSpans(index, count, columns) ? width : (width - gap * (columns - 1)) / columns;
    const bandRows = (units: Pending[], width: number, columns: number, cards: boolean, atFloor: boolean): number[] => {
      const rows: number[] = [];
      units.forEach((unit, index) => { const row = Math.floor(index / columns); rows[row] = Math.max(rows[row] ?? 0, naturalHeight(unit, bandWidthOf(index, units.length, columns, width), cards, undefined, composition, atFloor)); });
      return rows;
    };
    const stackHeight = (rows: number[]) => rows.reduce((sum, size) => sum + size, 0) + gap * Math.max(0, rows.length - 1);
    // One column while it fits at the floor with every band at least TIMELINE_BAND_MIN_HEIGHT tall; otherwise two columns when they
    // overflow less (Claude Design's compact bands, two up).
    const bandColumns = (units: Pending[], cell: LayoutBox, cards: boolean): 1 | 2 => {
      const one = stackHeight(bandRows(units, cell.width, 1, cards, true)) - cell.height;
      if (one <= 1e-6 && (cell.height - gap * (units.length - 1)) / units.length >= TIMELINE_BAND_MIN_HEIGHT * scale) return 1;
      return stackHeight(bandRows(units, cell.width, 2, cards, true)) - cell.height < one ? 2 : 1;
    };
    // The band boxes: each row its need while the rows fit, else the gaps close to half a gap (content before padding) and then the
    // rows share the cell (shareHeights); placed by the region's anchor. Every band is then set at the size the most squeezed one
    // fits at, so the stack reads at one size.
    const bandBoxes = (units: Pending[], cell: LayoutBox, columns: number, cards: boolean, anchor: RegionAnchor): LayoutBox[] => {
      // A compact stack sets each description beside its name only when every band's pair fits on one row, so the bands match.
      const inline = units.every((unit, index) => {
        const width = bandWidthOf(index, units.length, columns, cell.width), inner = width - (cards ? 2 * Math.min(CARD_INSET * scale, width / 4) : 0);
        const parts = measureTimeline(unit, { x: 0, y: 0, width: Math.max(scale, inner), height: 1e6 }, composition).parts, name = parts.find(part => part.role === 'name'), description = parts.find(part => part.role === 'description');
        return !name || !description || description.box.y < name.box.y + name.box.height;
      });
      if (!inline) for (const unit of units) if (timelineHints.get(unit)?.inlineHeader) timelineHints.set(unit, { ...timelineHints.get(unit), inlineHeader: false });
      const needs = bandRows(units, cell.width, columns, cards, false), floors = bandRows(units, cell.width, columns, cards, true);
      const total = needs.reduce((sum, size) => sum + size, 0), full = Math.max(0, Math.min(gap, cell.height / (needs.length * 2)));
      const between = needs.length > 1 && total + full * (needs.length - 1) > cell.height ? Math.max(full / 2, Math.min(full, (cell.height - total) / (needs.length - 1))) : full;
      const heights = shareHeights(needs, floors, cell.height - between * (needs.length - 1));
      const used = heights.reduce((sum, size) => sum + size, 0) + between * (heights.length - 1);
      let y = cell.y + Math.max(0, anchor === 'middle' ? (cell.height - used) / 2 : anchor === 'bottom' ? cell.height - used : 0);
      const tops = heights.map(size => { const top = y; y += size + between; return top; });
      const boxes = units.map((_, index) => {
        const row = Math.floor(index / columns), width = bandWidthOf(index, units.length, columns, cell.width);
        return { x: bandSpans(index, units.length, columns) ? cell.x : cell.x + (index % columns) * (width + gap), y: tops[row]!, width, height: heights[row]! };
      });
      const reduction = Math.max(0, ...units.map((unit, index) => {
        const layout = measureTimeline(unit, payloadBox(boxes[index]!, cards), composition);
        return Math.max(0, ...layout.parts.map(part => (part.requestedFontSize - part.fit!.fontSize) / scale));
      }));
      for (const unit of units) timelineHints.set(unit, { ...timelineHints.get(unit), sizeOffset: -reduction });
      units.forEach((unit, index) => { if (boxes[index]!.height >= naturalHeight(unit, boxes[index]!.width, cards, undefined, composition) - 1e-6) contentSized.add(unit); });
      return boxes;
    };
    const shown = (field: string) => !!slide[field] && !(Array.isArray(slide[field]) && !annotationText(slide[field]));
    const titleFields = ['tag', 'title', ...(plan.subtitle ? [] : ['subtitle'])].filter(shown);
    const subtitleFields = plan.subtitle && shown('subtitle') ? ['subtitle'] : [];
    const columnCount = plan.columns.length;
    const cells = plan.grid.map(row => [...row]);
    const rowSizes: (number | 'auto')[] = [...plan.rows];
    // A layout with no title area gets an implicit auto row on top for a slide that has headings.
    const implicitTitle = !plan.title && titleFields.length > 0;
    if (implicitTitle) { cells.unshift(Array.from({ length: columnCount }, () => 'title')); rowSizes.unshift('auto'); }
    if (belowUnits.length) { cells.push(Array.from({ length: columnCount }, () => BELOW)); rowSizes.push('auto'); }
    // A valid 12 x 12 grid may request more gaps than fit. Keep the same physical gap on both axes and
    // reserve at least half the frame for tracks, as flowCells does for a region's internal grid.
    const gap = Math.max(0, Math.min(requestedTemplateGap, frame.width / (columnCount * 2), frame.height / (rowSizes.length * 2)));
    const regionOf = new Map<string, LayoutRegion>(plan.regions.map(region => [region.name, region]));
    // Empty areas collapse into a neighbour, per slide; the record never changes.
    const empty = new Set<string>();
    for (const region of plan.regions) if (!unitsOf(region.name).length && region.empty !== 'keep') empty.add(region.name);
    if (plan.title && !titleFields.length) empty.add('title');
    if (plan.subtitle && !subtitleFields.length) empty.add('subtitle');
    // LH-122: an empty region alone in an auto row above another body region (the timeline layout's lead) takes no height either way;
    // joining the region below would hand that region its row and the gap under the headings, so it stays, zero high.
    const ownRows = areaRects(cells), bodyName = (name: string) => regionOf.has(name);
    const stays = (name: string) => { const rect = ownRows.get(name); return !!rect && rect.rowSpan === 1 && rowSizes[rect.row] === 'auto' && cells[rect.row]!.every(cell => cell === name || cell === '.') && cells.slice(rect.row + 1).some(row => row.some(bodyName)); };
    // The implicit row below the grid holds what no region took; nothing collapses into it.
    const collapsed = collapseAreas(cells, new Set([...empty].filter(name => !bodyName(name) || !stays(name))), name => name === 'title' || name === 'subtitle', name => name !== BELOW);
    const rects = areaRects(collapsed.grid), ownRects = areaRects(cells);
    // LH-65: a column that holds only empty regions (and heading or below-the-grid areas that span other columns too) gives way: it
    // takes no width and no gap, and the columns left share the width by their own sizes, so 2 blocks in three columns draw 1:1, not
    // one column beside a neighbor that took the empty one's width too. A column with content, or a kept (`empty: keep`) region, stays;
    // its region reports a zero-wide cell where the column was.
    const spansOthers = (name: string, column: number) => cells.some(row => row.some((cell, other) => other !== column && cell === name));
    const headingOrBelow = (name: string) => name === 'title' || name === 'subtitle' || name === BELOW;
    const vacated = plan.columns.map((_, column) => cells.every(row => { const name = row[column]!; return name === '.' || (empty.has(name) && !headingOrBelow(name)) || (headingOrBelow(name) && spansOthers(name, column)); }));
    // With one column of content left, a column gives way only when its empty region found no neighbor to collapse into (a hero's
    // media column beside a stack of rows); otherwise the column left takes the others' width by collapsing them, as before.
    const filledColumns = plan.columns.filter((_, column) => !vacated[column] && cells.some(row => plan.regions.some(region => row[column] === region.name && unitsOf(region.name).length > 0))).length;
    if (!ruleOn('empty-columns') || !filledColumns) vacated.fill(false);
    else if (filledColumns < 2) vacated.forEach((gone, column) => { if (gone && cells.every(row => row[column] === '.' || !empty.has(row[column]!) || collapsed.joined.has(row[column]!))) vacated[column] = false; });
    if (vacated.some(Boolean)) fire('empty-columns');
    // The regions whose every cell lies in a column that gave way report `collapsed`.
    const gaveWay = new Set(plan.regions.filter(region => cells.some(row => row.includes(region.name)) && cells.every(row => row.every((name, column) => name !== region.name || vacated[column]))).map(region => region.name));
    const keptWidths = columnWidths(plan.columns.filter((_, column) => !vacated[column]), frame.width, gap);
    const widths = plan.columns.map((_, column) => vacated[column] ? 0 : keptWidths[vacated.slice(0, column).filter(gone => !gone).length]!);
    const columnX: number[] = [];
    widths.reduce((x, size, column) => { const kept = !vacated[column], start = kept && widths.slice(0, column).some((_, before) => !vacated[before]) ? x + gap : x; columnX.push(start); return kept ? start + size : x; }, 0);
    const spanWidth = (rect: CellRect) => columnX[rect.column + rect.columnSpan - 1]! + widths[rect.column + rect.columnSpan - 1]! - columnX[rect.column]!;
    // LH-51: a content slide's title sits in a title area of auto rows above the body; a cover, a section (a title area in a
    // sized row, centred) and a stacked record (statement, quote, closing) keep the role size. LH-76 splits a title only into
    // the title area's own heading group, not into a layout's separate subtitle area.
    const titleRect = rects.get('title');
    const titleMode = hasBodyPayload && plan.stack === undefined && titleRect && rowSizes.slice(titleRect.row, titleRect.row + titleRect.rowSpan).every(size => size === 'auto') ? plan.subtitle ? 'step' as const : 'split' as const : undefined;
    // The heading group (tag, title, subtitle stacked as in 0.18), measured at an area's width.
    const headingItemsAt = (fields: string[], x: number, y: number, areaWidth: number): ComposedItem[] => headingGroup(fields, x, y, areaWidth, fields.includes('title') ? titleMode : undefined);
    const groupHeight = (list: ComposedItem[]) => list.length ? list.at(-1)!.box.y + list.at(-1)!.box.height - list[0]!.box.y : 0;
    // The arrangement of a region's blocks: design.contentDirection makes every flowing region one row or one column;
    // otherwise the region's flow (`auto` is a grid unless a block is long; `none` with extra blocks flows as `auto`).
    const arrangementOf = (region: LayoutRegion, units: Pending[], cell: LayoutBox): 'grid' | 'row' | 'column' => {
      if (region.name === longTextRegion) return 'column';
      if (direction !== undefined && region.flow !== 'none') return direction === 'horizontal' ? 'row' : 'column';
      const flow = region.flow === 'none' && units.length > 1 ? 'auto' : region.flow;
      if (flow === 'none' || flow === 'column') return 'column';
      if (flow === 'grid') return 'grid';
      const shape = gridFlowShape(units.length, cell.width >= cell.height);
      const cards = hasCards && !region.bleed;
      const cellWidth = (cell.width - gap * (shape.columns - 1)) / shape.columns - (cards ? 2 * Math.min(CARD_INSET * scale, cell.width / 4) : 0);
      return units.some(unit => isLong(unit, cellWidth)) ? 'column' : 'grid';
    };
    // LH-42: a region that receives 2 or more lists, and nothing else, lays them out one list per cell (a card when the slide draws
    // cards) in listGridShape's grid, so that sibling lists never read as one table and none is dealt across columns. A column stays
    // at least LIST_GRID_COLUMN_EMS list ems wide, and a region taller than wide stacks up to 3 lists and takes at most 2 columns, as
    // the portrait grid flow does. design.contentDirection keeps its one row or column.
    const LIST_GRID_COLUMN_EMS = 7.5;
    const listGridOf = (region: LayoutRegion, units: Pending[], areaWidth: number, landscape = true): FlowShape | undefined => {
      if (units.length < 2 || direction !== undefined) return undefined;
      if (!units.every(unit => !unit.children && unit.caption === undefined && (unit.field === 'items' || unit.field === 'bullets'))) return undefined;
      let columns = landscape ? 4 : units.length <= 3 ? 1 : 2;
      while (columns > 1 && (areaWidth - gap * (columns - 1)) / columns < LIST_GRID_COLUMN_EMS * LIST_NOMINAL_SIZE * scale) columns--;
      return listGridShape(units.length, columns);
    };
    // LH-42, LH-43: the rows of a list grid, or of any grid of text and lists, sized jointly (jointRowBoxes). The rows of cards, and of a
    // grid of paragraphs, fill the region; lists without cards keep their rows and the region's anchor places them (LH-42).
    const gridRowBoxes = (units: Pending[], shape: FlowShape, cell: LayoutBox, settings: Composition, cards: boolean, anchor: RegionAnchor, lists: boolean, stretch = false): LayoutBox[] => {
      const { cells, gap: between } = flowCells(shape, cell, gap, stretch);
      return jointRowBoxes(units, cells, shape.perRow.flatMap((count, row) => Array.from({ length: count }, () => row)), cell, between, settings, cards, anchor, cards || !lists);
    };
    // LH-47: the cells of a short last row stretch to the full width, except in a grid of pictures and videos, whose cells keep
    // one size (one aspect) and centre.
    const stretchesLastRow = (units: Pending[]) => !units.every(unit => !unit.children && (unit.field === 'image' || unit.field === 'video'));
    // LH-82: blocks of another kind taken out of a grid sit in one row under it, or stacked when that is shorter, and ask for at
    // most MOVED_SHARE of the content box (down to their height at the floor), so the grid keeps about 60-65% of the body.
    const MOVED_SHARE = .3;
    const movedHeights = (units: Pending[], width: number, cards: boolean, atFloor = false) => {
      const share = (width - gap * (units.length - 1)) / units.length;
      return { across: Math.max(...units.map(unit => naturalHeight(unit, share, cards, undefined, composition, atFloor))), stacked: units.reduce((sum, unit) => sum + naturalHeight(unit, width, cards, undefined, composition, atFloor), 0) + gap * (units.length - 1) };
    };
    const movedAcross = (units: Pending[], width: number, cards: boolean) => { const heights = movedHeights(units, width, cards); return heights.across <= heights.stacked; };
    const movedNeed = (units: Pending[], width: number, cards: boolean, atFloor = false) => { const heights = movedHeights(units, width, cards, atFloor), across = movedAcross(units, width, cards); return across ? heights.across : heights.stacked; };
    // LH-46: a lead plus cards is the first block across the region, then the others in the balanced grid below it.
    const leadRows = (count: number, landscape: boolean) => [1, ...gridFlowShape(count - 1, landscape).perRow];
    const leadNeeds = (units: Pending[], width: number, cards: boolean, atFloor = false): number[] => {
      const rows = leadRows(units.length, true);
      return rows.map((count, row) => {
        const cellWidth = (width - gap * (count - 1)) / count, from = rows.slice(0, row).reduce((sum, size) => sum + size, 0);
        return Math.max(...units.slice(from, from + count).map(unit => naturalHeight(unit, cellWidth, cards, undefined, composition, atFloor)));
      });
    };
    // LH-46, LH-82: the cells of a region grouping gave blocks (groupBinding), or undefined for the region's own flow.
    //  - row: the blocks of another kind taken out of a grid, side by side in one row under it.
    //  - mosaic: 2 or 3 pictures in a row; 4 to 6 a lead picture at full height beside a mosaic of the others in two rows (the
    //    lead as wide as two mosaic columns), cover-cropped unless the block, slide, deck or theme sets a fit. A region taller
    //    than wide stacks 2 and sets a lead picture across the top of 3 to 6.
    //  - lead: the lead's row and the card rows at the heights they need, sharing the region when they do not fit (shareHeights),
    //    placed by the region's anchor.
    const joinedLayout = (region: LayoutRegion, units: Pending[], cell: LayoutBox, cards: boolean): { shape: FlowShape; boxes: LayoutBox[] } | undefined => {
      const hint = binding.arrangements.get(region.name), landscape = cell.width >= cell.height;
      if (!hint || units.length < 2 || direction !== undefined) return undefined;
      if (hint === 'row') {
        const across = movedAcross(units, cell.width, cards), shape = flowShape(across ? 'row' : 'column', units.length, true);
        return { shape, boxes: across ? flowCells(shape, cell, gap).cells : stackedBoxes(units, cell, gap, composition, cards, region.anchor) };
      }
      if (hint === 'mosaic') {
        if (hints.sources.imageFit === undefined || hints.sources.imageFit === 'layout') for (const unit of units) coverPictures.add(unit);
        if (landscape && units.length <= 3) { const shape = flowShape('row', units.length, true); return { shape, boxes: flowCells(shape, cell, gap).cells }; }
        if (!landscape) {
          // Taller than wide: two pictures stacked; more, a lead picture across the top over the others in balanced rows of two or three.
          if (units.length === 2) { const shape = flowShape('column', 2, true); return { shape, boxes: flowCells(shape, cell, gap).cells }; }
          const below = gridFlowShape(units.length - 1, true).perRow, between = Math.max(0, Math.min(gap, cell.height / ((below.length + 1) * 2)));
          const leadHeight = (cell.height - between) * 2 / (below.length + 2);
          const mosaic = flowCells({ columns: below[0]!, rows: below.length, perRow: below }, { x: cell.x, y: cell.y + leadHeight + between, width: cell.width, height: cell.height - leadHeight - between }, between, true).cells;
          return { shape: { columns: below[0]!, rows: below.length + 1, perRow: [1, ...below] }, boxes: [{ x: cell.x, y: cell.y, width: cell.width, height: leadHeight }, ...mosaic] };
        }
        const rest = units.length - 1, perRow = [Math.ceil(rest / 2), Math.floor(rest / 2)], columns = perRow[0]!;
        const between = Math.max(0, Math.min(gap, cell.width / ((columns + 1) * 2), cell.height / 4));
        const leadWidth = (cell.width - between) * 2 / (columns + 2);
        const mosaic = flowCells({ columns, rows: 2, perRow }, { x: cell.x + leadWidth + between, y: cell.y, width: cell.width - leadWidth - between, height: cell.height }, between, true).cells;
        return { shape: { columns: columns + 1, rows: 2, perRow: [perRow[0]! + 1, perRow[1]!] }, boxes: [{ x: cell.x, y: cell.y, width: leadWidth, height: cell.height }, ...mosaic] };
      }
      const rows = leadRows(units.length, landscape);
      const between = Math.max(0, Math.min(gap, cell.height / (rows.length * 2)));
      const needs = leadNeeds(units, cell.width, cards), floors = leadNeeds(units, cell.width, cards, true);
      const heights = shareHeights(needs, floors, cell.height - between * (rows.length - 1));
      const spare = Math.max(0, cell.height - heights.reduce((sum, size) => sum + size, 0) - between * (rows.length - 1));
      let y = cell.y + (region.anchor === 'middle' ? spare / 2 : region.anchor === 'bottom' ? spare : 0);
      const boxes = rows.flatMap((count, row) => {
        const line = flowCells({ columns: count, rows: 1, perRow: [count] }, { x: cell.x, y, width: cell.width, height: heights[row]! }, gap).cells;
        y += heights[row]! + between;
        return line;
      });
      return { shape: { columns: Math.max(...rows), rows: rows.length, perRow: rows }, boxes };
    };
    // What a region needs in an auto row: its arrangement at the area's width, each row as tall as its tallest block.
    const regionNeed = (name: string, areaWidth: number, atFloor = false, size?: number): number => {
      const units = unitsOf(name), region = name === BELOW ? belowRegion : regionOf.get(name)!;
      // A kept empty region holds its place: two lines of body text (WI-4: at the lead size in a `flow: auto` region, where a lone block uses it) in an auto row, inside a card's insets when the slide
      // draws cards, as a filled region's text would be (naturalHeight). It gives way first (its floor is 0).
      if (!units.length) {
        if (region.empty !== 'keep' || atFloor) return 0;
        // Two body lines, plus the card's vertical inset as a filled card of that height takes it (payloadBox, naturalHeight).
        const lines = 2 * (region.flow === 'auto' ? LEAD_NOMINAL_SIZE * scale : startSize) * 1.22;
        return lines + (hasCards && !region.bleed ? 2 * Math.min(CARD_INSET * scale, areaWidth / 4, lines / 8) : 0);
      }
      // LH-41: a stack of timeline bands needs its one-column height.
      if (timelineBands(units)) return stackHeight(bandRows(units, areaWidth, 1, hasCards && !region.bleed, atFloor));
      // LH-70, LH-67: as placeRegion arranges them (a body-tall area decides the paragraph grid).
      const fixed = direction !== undefined || name === longTextRegion || listGridOf(region, units, areaWidth) !== undefined || binding.arrangements.get(name) === 'mosaic' || binding.arrangements.get(name) === 'row';
      const paragraphs = fixed ? undefined : paragraphColumns(units, { x: 0, y: 0, width: areaWidth, height: frame.height }, hasCards && !region.bleed, composition);
      if (paragraphs) return paragraphNeed(units, paragraphs, areaWidth, hasCards && !region.bleed, composition, atFloor);
      const leading = fixed || region.flow === 'grid' ? undefined : leadStack(units);
      if (leading) return leadStackNeed(units, leading, areaWidth, hasCards && !region.bleed, composition, atFloor);
      if (binding.arrangements.get(name) === 'row') {
        const cards = hasCards && !region.bleed, floor = movedNeed(units, areaWidth, cards, true);
        return atFloor ? floor : Math.max(floor, Math.min(movedNeed(units, areaWidth, cards), MOVED_SHARE * frame.height));
      }
      if (binding.arrangements.get(name) === 'lead') return leadNeeds(units, areaWidth, hasCards && !region.bleed, atFloor).reduce((sum, need) => sum + need, 0) + gap * Math.max(0, leadRows(units.length, true).length - 1);
      const shape = listGridOf(region, units, areaWidth) ?? flowShape(arrangementOf(region, units, { x: 0, y: 0, width: areaWidth, height: areaWidth / 4 }), units.length, true);
      const cellWidth = (areaWidth - gap * (shape.columns - 1)) / shape.columns, cards = hasCards && !region.bleed;
      let total = 0, index = 0;
      for (const count of shape.perRow) {
        let row = 0;
        for (let k = 0; k < count; k++) { const unit = units[index++]!; row = Math.max(row, naturalHeight(unit, cellWidth, cards, undefined, composition, atFloor, size === undefined ? undefined : Math.min(size, proseMeasure(unit, cellWidth).size))); }
        total += row;
      }
      return total + gap * Math.max(0, shape.rows - 1);
    };
    // Tracks: an auto row is as tall as the areas that lie in it alone need (at most half the content box); areas that
    // span several rows do not size it, and an auto row whose areas are all empty has no height and no gap.
    // A numeric row needs what its areas need (an area spanning several numeric rows, its share), so that auto rows below
    // or above it never squeeze it to nothing (allocateRows).
    const areaNeed = (name: string, rect: CellRect, size?: number) => name === 'title' ? groupHeight(headingItemsAt(titleFields, 0, 0, spanWidth(rect))) : name === 'subtitle' ? groupHeight(headingItemsAt(subtitleFields, 0, 0, spanWidth(rect))) : regionNeed(name, spanWidth(rect), false, size);
    // `joint` and `size`: the regions sized at a trial size instead of their role sizes (LH-43, below).
    const demandsAt = (joint?: ReadonlySet<string>, trial?: number) => rowSizes.map((size, row): RowDemand => {
      let need = 0, floor = 0, heading = false, below = false;
      for (const [name, rect] of rects) {
        // An empty neighbour that collapsed into an area can leave it spanning auto rows only (every row of a column of auto
        // entries): the area's first row then holds all of its height. An area that spans a numeric row keeps its sizes.
        const autoSpan = size === 'auto' && rect.rowSpan > 1 && rect.row === row && rowSizes.slice(rect.row, rect.row + rect.rowSpan).every(entry => entry === 'auto');
        if (size === 'auto' ? rect.row !== row || (rect.rowSpan !== 1 && !autoSpan) : row < rect.row || row >= rect.row + rect.rowSpan) continue;
        if (size !== 'auto' && rect.rowSpan > 1 && rowSizes.slice(rect.row, rect.row + rect.rowSpan).some(entry => entry === 'auto')) continue;
        const value = areaNeed(name, rect, joint?.has(name) ? trial : undefined) / (autoSpan ? 1 : rect.rowSpan);
        // WI-1: how far a body auto row can shrink, its content at the minimum font size (allocateRows, shareHeights).
        if (size === 'auto' && name !== 'title' && name !== 'subtitle') floor = Math.max(floor, regionNeed(name, spanWidth(rect), true));
        if (value > need) { need = value; heading = name === 'title' || name === 'subtitle'; below = name === BELOW; }
      }
      return { size, need, ...(size === 'auto' && !heading ? { floor } : {}), kind: heading ? 'heading' : below ? 'below' : 'body' };
    });
    let heights = allocateRows(demandsAt(), frame.height, gap);
    // LH-43: blocks below the grid share one size with the parallel primary regions they continue (composeTemplate's peer sets), so
    // when all of them are text and lists the rows are sized jointly too: at a trial size of the type scale every row of these regions
    // asks for what they need at that size, and the largest trial at which every one of them gets its need is kept. A short region
    // below then takes only what its blocks need at the shared size, and the columns above keep the rest, instead of each fitting in
    // the height its role size asked for. When no trial fits, the rows stay as allocated at the role sizes.
    const parallelPrimary = new Map<string, string[]>();
    for (const region of plan.regions) {
      const rect = rects.get(region.name);
      if (region.role === 'primary' && rect && unitsOf(region.name).length) parallelPrimary.set(`${rect.row}:${rect.rowSpan}`, [...parallelPrimary.get(`${rect.row}:${rect.rowSpan}`) ?? [], region.name]);
    }
    const joint = new Set([...parallelPrimary.values()].filter(names => names.length > 1).flat());
    if (belowUnits.length && joint.size && [...joint, BELOW].every(name => unitsOf(name).every(proseLeaf))) {
      joint.add(BELOW);
      const start = Math.max(...[...joint].flatMap(name => unitsOf(name).map(unit => proseMeasure(unit, spanWidth(rects.get(name)!)).size)));
      for (const trial of scaleSizes(start, composition.minFontSize ?? 16)) {
        const tracks = allocateRows(demandsAt(joint, trial), frame.height, gap);
        const room = (rect: CellRect) => tracks.slice(rect.row, rect.row + rect.rowSpan).reduce((sum, size) => sum + size, 0) + gap * (rect.rowSpan - 1);
        if ([...joint].every(name => regionNeed(name, spanWidth(rects.get(name)!), false, trial) <= room(rects.get(name)!) + 1e-6)) { heights = tracks; break; }
      }
    }
    const rowY: number[] = [];
    // A row with no height sits at the end of the row above it, not after its gap.
    heights.reduce((y, size, row) => { rowY.push(size > 0 || !heights.slice(0, row).some(above => above > 0) ? y : y - gap); return size > 0 ? y + size + gap : y; }, 0);
    // A column of auto rows with an anchor (`template.stack`): the whole stack, headings included, sits in the leftover height.
    const stackUsed = heights.reduce((sum, size) => sum + size, 0) + gap * Math.max(0, heights.filter(size => size > 0).length - 1);
    const stackShift = plan.stack === undefined ? 0 : Math.max(0, frame.height - stackUsed) * (plan.stack === 'middle' ? .5 : 1);
    // LH-48 (growBody, CENTER): a body under the headings whose rows all hug their content (auto rows) sits in the middle of the height
    // the headings leave, instead of at its top with the space below it empty.
    const firstBodyRow = Math.max(0, ...[...rects].filter(([name]) => name === 'title' || name === 'subtitle').map(([, rect]) => rect.row + rect.rowSpan));
    const centered = (options as Record<symbol, unknown>)[CENTER] === true && plan.stack === undefined && [...rects].every(([name, rect]) => name === 'title' || name === 'subtitle' || rect.row >= firstBodyRow) && rowSizes.slice(firstBodyRow).every(size => size === 'auto');
    const bodyShift = centered ? Math.max(0, frame.height - stackUsed) / 2 : 0;
    const logical = (rect: CellRect): LayoutBox => {
      const last = rect.row + rect.rowSpan - 1, shift = stackShift + (rect.row >= firstBodyRow ? bodyShift : 0), y = frame.y + shift + rowY[rect.row]!;
      return { x: frame.x + columnX[rect.column]!, y, width: spanWidth(rect), height: Math.max(0, frame.y + shift + rowY[last]! + heights[last]! - y) };
    };
    // design.mirror reverses each row's cells and the column sizes; a right-to-left deck mirrors the drawing on top.
    const flip = (hints.mirror === true) !== rtl;
    const physical = (cell: LayoutBox): LayoutBox => flip ? { ...cell, x: frame.x + frame.width - (cell.x - frame.x) - cell.width } : cell;
    // A bled region's outer edges that lie on the content box's edge reach the slide edge (the free area beside placed images).
    const bleed = (cell: LayoutBox): LayoutBox => {
      const near = (a: number, b: number) => Math.abs(a - b) < .01;
      const left = near(cell.x, frame.x) ? area.left : cell.x, top = near(cell.y, frame.y) ? area.top : cell.y;
      const right = near(cell.x + cell.width, frame.x + frame.width) ? area.right : cell.x + cell.width;
      const bottom = near(cell.y + cell.height, frame.y + frame.height) ? area.bottom : cell.y + cell.height;
      return { x: left, y: top, width: right - left, height: bottom - top };
    };
    // Headings: centred vertically in their area unless every row the area spans is auto.
    const placeHeadings = (name: 'title' | 'subtitle', fields: string[]) => {
      const rect = rects.get(name), original = ownRects.get(name);
      if (!rect) { if (original) headingAreas.push({ name, box: roundBox(physical(logical(original))), collapsed: true }); return; }
      const cell = physical(logical(rect));
      const list = headingItemsAt(fields, cell.x, cell.y, cell.width);
      const centred = !rowSizes.slice(rect.row, rect.row + rect.rowSpan).every(size => size === 'auto');
      const shift = centred ? Math.max(0, (cell.height - groupHeight(list)) / 2) : 0;
      for (const item of list) {
        if (shift) { item.box.y += shift; if (item.text) item.text = translateTextFit(item.text, shift); }
        if (furniture && item.box.y + item.box.height > bodyBottom + .01) diagnostics.push({ code: 'text-overflow', path: item.path, message: 'Repeated furniture leaves too little room for this heading. Change the header/footer or slide design.' });
        items.push(item);
      }
      // A template without a subtitle area: the title area split where the group puts the subtitle (RR-81 review).
      let parts: ComposedHeadingArea['parts'];
      const upper = list.filter(item => item.field !== 'subtitle'), lower = list.find(item => item.field === 'subtitle');
      if (name === 'title' && !plan.subtitle && list.length) {
        const bottom = cell.y + cell.height, last = upper.at(-1);
        const split = Math.min(bottom, lower ? lower.box.y : last!.box.y + last!.box.height + gap * 0.5);
        const titleBottom = Math.max(cell.y, last ? last.box.y + last.box.height : split - gap * 0.5);
        parts = { title: roundBox({ x: cell.x, y: cell.y, width: cell.width, height: titleBottom - cell.y }), subtitle: roundBox({ x: cell.x, y: split, width: cell.width, height: Math.max(0, bottom - split) }) };
      }
      headingAreas.push({ name, box: roundBox(cell), ...(name === 'title' && implicitTitle ? { implicit: true as const } : {}), ...(parts ? { parts } : {}) });
    };
    placeHeadings('title', titleFields);
    if (plan.subtitle) placeHeadings('subtitle', subtitleFields);
    // A slide's own composition.mode, columns or weights arrange its first primary flowing region (the 0.18 modes).
    const slideComposition = record(slide.composition);
    const overridden = ['mode', 'columns', 'weights'].some(key => slideComposition[key] !== undefined) ? plan.regions.find(region => region.role === 'primary' && region.flow !== 'none')?.name : undefined;
    const settings: Composition = { ...composition };
    // LH-64, LH-04: a row of cards (one row of a region's grid, or the lone blocks of card regions side by side) and how its cards
    // stand in their cells; undefined keeps the region's rule (LH-22: filled cards, the payload at the anchor).
    //  - LH-04, top anchor: cards of measured blocks hug the tallest one, so a short row leaves no empty card below its text.
    //  - LH-64, middle or bottom anchor, every card body text only (a paragraph, or a list without labelled items; a picture, a
    //    metric or a heading line keeps the anchor): when the tallest text fills under 45% of a filled card, the cards hug it and
    //    the row centres, since text set at the foot of a tall card reads as an empty card; otherwise, when the payloads are more
    //    than 1.5x apart, they start at the card's top, so a short text does not sit alone at the foot beside long ones.
    // A hugging card is as tall as the tallest payload of its row, insets included, so the cards keep one height. naturalHeight
    // estimates the insets of a tall card (up to CARD_INSET); the height is refined once with the insets payloadBox gives a card
    // that tall (a sixteenth of its shorter side), which are no larger, so every payload still fits and the margin under the
    // text matches the one above it.
    const HUG_FILL = .45, UNEQUAL_PAYLOADS = 1.5, fillSpace = requestedTemplateGap * CARD_FILL_SPACE, underFilled = bodySteps > 0 || (options as Record<symbol, unknown>)[CENTER] === true;
    const hugHeight = (units: Pending[], cells: LayoutBox[], estimate: number): number => Math.min(estimate, Math.max(...units.map((unit, index) => {
      const frame = acceptedBox({ ...cells[index]!, height: estimate }), inner = payloadBox(frame, true);
      return naturalHeight(unit, inner.width, false, undefined, settings) + 2 * rasterPadding + scale + 2 * (inner.y - frame.y);
    })));
    const hugsContent = (unit: Pending) => !unit.children && unit.caption === undefined && ['text', 'items', 'bullets', 'quote', 'metric'].includes(unit.field) && !metricTiles.has(unit);
    const bodyOnly = (unit: Pending) => !unit.children && unit.caption === undefined && (unit.field === 'text'
      || ((unit.field === 'items' || unit.field === 'bullets') && Array.isArray(unit.value) && !(unit.value as ListValue[]).some(entry => !!entry && typeof entry === 'object' && !Array.isArray(entry) && (entry as {description?: unknown}).description !== undefined)));
    type CardRowRule = {mode: 'hug' | 'top'; height: number};
    const cardRowRule = (units: Pending[], cells: LayoutBox[], anchor: RegionAnchor, references?: number[]): CardRowRule | undefined => {
      // LH-64 widened: a row of middle- or bottom-anchored cards with a table, code panel or timeline among other measured kinds (no
      // metric, which keeps its anchor) stood at three anchors (a list at the foot, a table at the top, a quote in the middle). They start
      // together at the card top, or hug and center when the body is under-filled, as unequal texts do. Rows of body text, quotes and
      // metrics keep LH-64's rule below.
      const mixable = (unit: Pending) => !unit.children && unit.caption === undefined && MEASURED_FIELDS.has(unit.field) && unit.field !== 'metric';
      if (anchor !== 'top' && units.length > 1 && ruleOn('mixed-cards') && units.every(mixable) && !units.every(hugsContent) && new Set(units.map(unit => kind(unit.field))).size > 1) {
        fire('mixed-cards');
        const cellHeight = Math.min(...cells.map(cell => cell.height)), tallest = Math.max(...units.map((unit, index) => naturalHeight(unit, cells[index]!.width, true, undefined, settings) + 2 * rasterPadding + scale));
        return underFilled ? { mode: 'hug', height: hugHeight(units, cells, Math.min(cellHeight, tallest)) } : { mode: 'top', height: Math.min(cellHeight - fillSpace, tallest) };
      }
      if (!units.length || !units.every(hugsContent)) return undefined;
      const cellHeight = Math.min(...cells.map(cell => cell.height));
      const naturals = units.map((unit, index) => naturalHeight(unit, cells[index]!.width, true, anchor === 'top' ? undefined : references?.[index], settings) + 2 * rasterPadding + scale);
      const tallest = Math.max(...naturals);
      if (anchor === 'top') return { mode: 'hug', height: hugHeight(units, cells, Math.min(cellHeight, tallest)) };
      if (!units.every(bodyOnly)) return undefined;
      const card = cellHeight - fillSpace;
      const text = Math.max(...units.map((unit, index) => naturalHeight(unit, cells[index]!.width - 2 * Math.min(CARD_INSET * scale, cells[index]!.width / 4), false, undefined, settings)));
      // LH-48: the cards of a body growBody found under-filled hug their text and center, whatever it fills of a card.
      if (text < HUG_FILL * card || underFilled) return { mode: 'hug', height: hugHeight(units, cells, Math.min(cellHeight, tallest)) };
      return tallest > UNEQUAL_PAYLOADS * Math.min(...naturals) ? { mode: 'top', height: Math.min(card, tallest) } : undefined;
    };
    // The rows of cards of one area, each with its rule: every card's box and its frame (the cell, for a card that fills it), or
    // undefined for a row that keeps the region's rule. Rows that all hug stack one gap apart, from the top under a top anchor and
    // centred otherwise; another hugging row sits in its own cell the same way.
    type CardPlacement = {box: LayoutBox; frame?: LayoutBox};
    const placeCardRows = (rows: {cells: LayoutBox[]; rule?: CardRowRule}[], area: LayoutBox, anchor: RegionAnchor): (CardPlacement[] | undefined)[] => {
      const stack = rows.length > 1 && rows.every(row => row.rule?.mode === 'hug');
      const total = rows.reduce((sum, row) => sum + (row.rule?.height ?? 0), 0) + gap * (rows.length - 1);
      let y = area.y + (anchor === 'top' ? Math.max(0, Math.min(fillSpace, area.height - total)) : Math.max(0, (area.height - total) / 2));
      return rows.map(({cells, rule}) => {
        if (!rule) return undefined;
        const cell = cells[0]!, height = rule.height;
        const top = stack ? y : rule.mode === 'top' ? cell.y + fillSpace : cell.y + (anchor === 'top' ? Math.max(0, Math.min(fillSpace, cell.height - height)) : Math.max(0, (cell.height - height) / 2));
        y += height + gap;
        return cells.map(entry => ({ box: { x: entry.x, y: top, width: entry.width, height }, ...(rule.mode === 'top' ? { frame: entry } : {}) }));
      });
    };
    const placeRegion = (region: LayoutRegion, units: Pending[], area: LayoutBox, lone?: CardPlacement): NonNullable<ComposedRegion['arrangement']> => {
      regionTag = region.name === BELOW ? undefined : region.name;
      // A region squeezed to nothing (auto rows took the content box) still gets a drawable cell; its content overflows.
      const cell = { ...area, width: Math.max(scale, area.width), height: Math.max(scale, area.height) };
      templateCell = true;
      try {
        const cards = hasCards && !region.bleed;
        if (region.name === overridden) {
          arrange(units, cell, { ...settings, mode: (slideComposition.mode as Composition['mode']) ?? 'auto' }, 0, gap, path, true);
          return 'composition';
        }
        // LH-48: the body's one block takes the whole cell and places itself (fillLone), whatever the region's anchor or card row.
        const filled = units.length === 1 && !region.bleed ? fillLone(units[0]!, cell, settings, cards) : undefined;
        if (filled) {
          const first = items.length;
          placeNode(units[0]!, filled, settings, cards, region.listColumns, undefined, region.anchor);
          leafItems.push(...range(first, items.length));
          return arrangementOf(region, units, cell);
        }
        // LH-41: several timelines are one stack of horizontal bands (bandBoxes), in one column or two, whatever the region's flow
        // or the design's contentDirection. The stack sits in the middle of the region, as a lone timeline is centred in its cell,
        // unless the region is anchored at the bottom.
        const bands = timelineBands(units), bandColumnCount = bands ? bandColumns(units, cell, cards) : 1;
        const listGrid = bands ? undefined : listGridOf(region, units, cell.width, cell.width >= cell.height);
        // LH-70, LH-67: similar paragraphs as columns, or a lead beside a stack, in a region whose arrangement the design does not fix
        // (contentDirection) and that grouping gave no picture mosaic or moved row; a statement's lead plus cards gives way to either. A
        // lead plus stack is not a grid, so a `flow: grid` region keeps its grid. Long texts LH-86 moved into one region keep their rows.
        const own = bands || listGrid || direction !== undefined || region.name === longTextRegion || binding.arrangements.get(region.name) === 'mosaic' || binding.arrangements.get(region.name) === 'row' ? undefined : region;
        const paragraphs = own ? paragraphColumns(units, cell, cards, settings) : undefined;
        const lead = own && !paragraphs && region.flow !== 'grid' ? leadStack(units) : undefined;
        const joined = bands || listGrid || paragraphs || lead ? undefined : joinedLayout(region, units, cell, cards);
        const arrangement = bands ? bandColumnCount === 1 ? 'column' : 'grid' : listGrid ? 'grid' : paragraphs ? paragraphs.shape.rows === 1 ? 'row' : 'grid' : lead ? 'row' : joined ? joined.shape.rows === 1 ? 'row' : 'grid' : arrangementOf(region, units, cell);
        if (paragraphs) for (const unit of units) paragraphStarts.set(unit, paragraphs.size);
        if (lead && units[lead.lead]!.field === 'text') paragraphStarts.set(units[lead.lead]!, LEAD_NOMINAL_SIZE * scale);
        const shape = paragraphs?.shape ?? (lead ? { columns: 2, rows: 1, perRow: [2] } : undefined) ?? listGrid ?? joined?.shape ?? flowShape(arrangement, units.length, cell.width >= cell.height);
        // LH-43: a grid of text and lists over several rows shares one size, so its rows are sized jointly, as a list grid's are. With
        // LH-47 the grid's rows are balanced and a short last row stretches to the full width before the rows are sized; a joined
        // layout (LH-46, LH-82) keeps its own cells.
        const jointGrid = !bands && !joined && !lead && arrangement === 'grid' && shape.rows > 1 && units.every(proseLeaf);
        let boxes = bands ? bandBoxes(units, cell, bandColumnCount, cards, region.anchor === 'bottom' ? 'bottom' : 'middle') : lead ? leadStackBoxes(units, lead, cell, gap, settings, cards)
          : listGrid || jointGrid || paragraphs ? gridRowBoxes(units, shape, cell, settings, cards, region.anchor, !!listGrid, !listGrid && stretchesLastRow(units)) : joined ? joined.boxes : flowCells(shape, cell, gap, stretchesLastRow(units)).cells;
        const referenceHeights = boxes.map(box => box.height);
        let cellBoxes = boxes;
        // WI-1: a column stacks its blocks at the heights they need and the region's anchor places the stack (stackedBoxes),
        // instead of giving every block an equal share. A lone block at the top keeps the whole cell, as before.
        const stacked = !bands && arrangement === 'column' && !(units.length === 1 && region.anchor === 'top');
        // LH-86: a stack of long-text cards shares the region's height (longTextRowBoxes).
        const longRows = stacked && cards && units.length > 1 && units.every(longTextUnit);
        if (stacked) boxes = longRows ? longTextRowBoxes(units, cell, settings, gap) : stackedBoxes(units, cell, gap, settings, cards, region.anchor);
        if (!bands && !lead && (arrangement === 'grid' || arrangement === 'row') && region.anchor !== 'top') {
          const naturals = boxes.map((box,index) => {
            const unit = units[index]!;
            return unit.children || unit.caption || !['text','items','bullets','quote','metric'].includes(unit.field) || metricTiles.has(unit) ? undefined
              : naturalHeight(unit,box.width,cards,referenceHeights[index],settings)+2*rasterPadding+scale;
          });
          // One vertical origin per grid row keeps related metric value/label baselines aligned,
          // even when descriptions have different line counts. Individual bounds remain compact, except that cards in a row
          // share the row's height, so their bottom edges line up too.
          boxes = boxes.map((box,index) => {
            const height = naturals[index];
            if (height === undefined || height >= box.height) return box;
            const rowHeight = Math.min(box.height,Math.max(...boxes.flatMap((peer,peerIndex) => peer.y === box.y && naturals[peerIndex] !== undefined ? [naturals[peerIndex]!] : [])));
            const spare = Math.max(0,box.height-rowHeight);
            return {...box,y:box.y+(region.anchor==='middle'?spare/2:spare),height:cards?rowHeight:height};
          });
        }
        // LH-64, LH-04: the rows of cards of a grid (a lone block's card was planned with its neighbours' regions, `lone`).
        const planned: (CardPlacement | undefined)[] = lone ? [lone] : [];
        if (!lone && cards && !bands && !lead && (arrangement === 'grid' || arrangement === 'row')) {
          const rows = shape.perRow.map((count, row) => range(0, count).map(offset => shape.perRow.slice(0, row).reduce((sum, size) => sum + size, 0) + offset));
          const placed = placeCardRows(rows.map(indexes => {
            const cells = indexes.map(index => cellBoxes[index]!);
            return { cells, rule: cardRowRule(indexes.map(index => units[index]!), cells, region.anchor, indexes.map(index => referenceHeights[index]!)) };
          }), cell, region.anchor);
          rows.forEach((indexes, row) => { placed[row]?.forEach((placement, offset) => { planned[indexes[offset]!] = placement; }); });
        }
        boxes = boxes.map((box, index) => planned[index]?.box ?? box);
        let frames = planned.map(placement => placement?.frame);
        // Right to left: the flow inside a region runs from the right (RR-05).
        const mirrored = (list: LayoutBox[]) => list.map(box => ({ ...box, x: cell.x + cell.width - (box.x - cell.x) - box.width }));
        if (rtl) { boxes = mirrored(boxes); cellBoxes = mirrored(cellBoxes); frames = frames.map(frame => frame && mirrored([frame])[0]); }
        // listColumns: "auto" lays a lone list out in columns; with several blocks, a list that does not fit its own cell at
        // the starting size tries columns before it shrinks (RR-81 review: the region's tools before overflow).
        const stack: number[] = [];
        units.forEach((unit, index) => {
          const first = items.length;
          placeNode(unit, boxes[index]!, settings, cards, listGrid ? 1 : region.listColumns, region.anchor === 'top' || stacked || planned[index] ? undefined : referenceHeights[index], region.anchor, !cards || bands ? undefined : planned[index] ? frames[index] : !stacked ? cellBoxes[index] : units.length === 1 ? cell : undefined);
          if (!unit.children) { leafItems.push(...range(first, items.length)); stack.push(...range(first, items.length)); }
          if (longRows) centeredCardText.push(...range(first, items.length));
        });
        // LH-43: the blocks of one kind in a region read at one size whatever their arrangement: across the rows of a grid (LH-42 did
        // it for a list grid), along a row and down a stacked column (WI-4; stackedBoxes sizes the stack for it). Uneven content no
        // longer draws a short card at its role size beside a long one at the floor.
        if (stack.length > 1) peerSets.push(stack);
        return arrangement;
      } finally { regionTag = undefined; templateCell = false; }
    };
    // WI-1 (N1): regions of one role side by side (the same rows of the grid) are peers: their text shares one size.
    const bands = new Map<string, number[][]>();
    let leafItems: number[] = [];
    // LH-48 (growBody, CENTER): the regions of an under-filled body sit in the middle of their cells, the regions side by side (one band
    // of rows) as tall as the tallest of them needs (regionNeed, with each block's placement slack), so a short grid in a tall region no
    // longer starts at its top above an empty foot. A bled region keeps its cell.
    const centerNeeds = new Map<string, number>();
    if ((options as Record<symbol, unknown>)[CENTER] === true && plan.stack === undefined) for (const region of plan.regions) {
      const units = unitsOf(region.name), rect = rects.get(region.name);
      if (!units.length || !rect || region.bleed) continue;
      const key = `${rect.row}:${rect.rowSpan}`, need = regionNeed(region.name, spanWidth(rect)) + units.length * (2 * rasterPadding + scale + (hasCards ? gap * CARD_FILL_SPACE : 0));
      centerNeeds.set(key, Math.max(centerNeeds.get(key) ?? 0, need));
    }
    const regionCell = (rect: CellRect): LayoutBox => {
      const cell = physical(logical(rect)), need = centerNeeds.get(`${rect.row}:${rect.rowSpan}`);
      return need !== undefined && need < cell.height - 1e-6 ? { ...cell, y: cell.y + (cell.height - need) / 2, height: need } : cell;
    };
    // LH-64, LH-04: the lone blocks of card regions in the same rows of the grid, with the same anchor, are one row of cards.
    const loneCards = new Map<string, CardPlacement>();
    if (hasCards) {
      const loneRows = new Map<string, {name: string; unit: Pending; cell: LayoutBox; anchor: RegionAnchor}[]>();
      for (const region of plan.regions) {
        const units = unitsOf(region.name), rect = rects.get(region.name);
        if (units.length !== 1 || !rect || region.bleed || region.name === overridden) continue;
        const key = `${rect.row}:${rect.rowSpan}:${region.anchor}`, area = regionCell(rect);
        loneRows.set(key, [...loneRows.get(key) ?? [], { name: region.name, unit: units[0]!, cell: { ...area, width: Math.max(scale, area.width), height: Math.max(scale, area.height) }, anchor: region.anchor }]);
      }
      for (const row of loneRows.values()) {
        const cells = row.map(entry => entry.cell), anchor = row[0]!.anchor;
        placeCardRows([{ cells, rule: cardRowRule(row.map(entry => entry.unit), cells, anchor) }], cells[0]!, anchor)[0]?.forEach((placement, index) => { loneCards.set(row[index]!.name, placement); });
      }
    }
    for (const region of plan.regions) {
      const units = unitsOf(region.name), bound = binding.regions.find(entry => entry.name === region.name)!;
      const rect = rects.get(region.name);
      let cell = rect && !region.bleed ? regionCell(rect) : physical(logical(rect ?? ownRects.get(region.name)!));
      const areaBox = region.bleed && rect ? roundBox(cell) : undefined;
      if (region.bleed && rect && cell.width > 0) cell = bleed(cell);
      else if (rect && loneUnit && units[0] === loneUnit && plan.regions.every(other => other === region || empty.has(other.name))) cell = { ...cell, height: Math.max(cell.height, frame.y + frame.height - cell.y) };
      leafItems = [];
      const arrangement = units.length && rect ? placeRegion(region, units, cell, loneCards.get(region.name)) : undefined;
      if (arrangement && rect) {
        const band = `${rect.row}:${rect.rowSpan}:${region.role}`;
        bands.set(band, [...bands.get(band) ?? [], leafItems]);
      }
      templateRegions.push({
        name: region.name, box: roundBox(cell), accepts: [...region.accepts], role: region.role, flow: region.flow, max: region.max, anchor: region.anchor,
        ...(arrangement ? { arrangement } : {}), content: bound.blocks.map(block => block.path),
        ...(bound.overflow.length ? { overflow: bound.overflow.map(block => block.path) } : {}),
        ...(collapsed.joined.has(region.name) || gaveWay.has(region.name) ? { collapsed: true as const } : {}), ...(region.bleed ? { bleed: true as const } : {}),
        ...(areaBox ? { areaBox } : {}),
      });
    }
    for (const members of bands.values()) if (members.length > 1) peerSets.push(members.flat());
    // LH-43: blocks no region took, drawn below the grid, continue the parallel primary regions (columns side by side) and read at
    // their size. A lone primary region (a statement's message) keeps its own size over them.
    const parallel = [...bands].flatMap(([band, members]) => band.endsWith(':primary') && members.length > 1 ? members.flat() : []);
    leafItems = [];
    if (belowUnits.length) placeRegion(belowRegion, belowUnits, physical(logical(rects.get(BELOW)!)));
    if (leafItems.length && parallel.length) peerSets.push([...parallel, ...leafItems]);
  };
  // WI-1 (N1): peers share one fitted size per kind (prose, lists): every member is refitted at the smallest size a member
  // of its kind fitted at, so columns side by side read as one design. A refit that would overflow keeps its own fit.
  // LH-43: metrics share too, role by role (value, label, description and the rest), each at the smallest size a sibling fitted it.
  // LH-72: siblings read with one alignment, so when any text or list of a sibling set was start-aligned (startAlignedCenter), its centered
  // siblings are start-aligned too, at their size and in their cells.
  // LH-78: a card the slide does not otherwise draw hugs its quote (the inset above it repeated below its lowest part), so a tall cell
  // draws no empty card.
  const hugQuoteCards = (): void => {
    for (const index of quoteHugs) {
      const item = items[index]!, layout = item.quoteLayout, frame = item.frameBox;
      if (!layout || !frame || layout.overflow) continue;
      const bottom = Math.max(layout.bounds.y + layout.bounds.height, ...layout.parts.map(part => part.box.y + part.box.height), ...(layout.photo ? [layout.photo.box.y + layout.photo.box.height] : []));
      item.frameBox = acceptedBox({ ...frame, height: Math.min(frame.height, bottom - frame.y + (item.box.y - frame.y)) });
    }
  };
  const shareStartAlignment = (): void => {
    if (!startAligned.size) return;
    for (const set of peerSets) {
      if (!set.some(index => startAligned.has(index))) continue;
      for (const index of set) {
        const item = items[index]!, value = contentText(item.field, item.value);
        if (item.alignment !== 'center' || !item.text || value === undefined || item.listColumns || !['text', 'items', 'bullets'].includes(item.field)) continue;
        item.text = fitContent(item.field, item.value, value, item.box, item.text.fontSize, item.text.fontSize, item.path, item.payload.numbering, 'left');
        item.alignment = 'left';
      }
    }
  };
  const sharePeerSizes = (): void => {
    for (const [index, start] of bodyStarts) {
      const item = items[index]!, size = item.text!.fontSize, floorPx = item.composition.minFontSize ?? 16, step = scaleStep(size, floorPx);
      if (size >= start - 1e-9 || step >= size - 1e-9) continue;
      const refit = fitContent(item.field, item.value, contentText(item.field, item.value) ?? '', item.box, step, snapFontSizeUp(floorPx * scale), item.path, item.payload.numbering, item.alignment);
      if (!refit.overflow && Math.abs(refit.fontSize - step) < 1e-9) item.text = refit;
    }
    const parent = new Map<number, number>();
    const find = (index: number): number => { let root = index; while (parent.has(root) && parent.get(root) !== root) root = parent.get(root)!; parent.set(index, root); return root; };
    for (const set of peerSets) for (const index of set) parent.set(find(index), find(set[0]!));
    const kindOf = (item: ComposedItem, index: number) => leadItems.has(index) ? undefined : item.metricLayout ? (metricRefits.has(index) ? 'metric' : undefined)
      : item.quoteLayout ? (quoteRefits.has(index) ? 'quote' : undefined)
      : !item.text || item.codeLayout || item.timelineLayout || item.listColumns ? undefined
      : item.field === 'text' ? 'text' : item.field === 'items' || item.field === 'bullets' ? 'list' : undefined;
    const sets = new Map<string, number[]>();
    for (const index of parent.keys()) {
      const item = items[index], kind = item && kindOf(item, index);
      if (kind) sets.set(`${find(index)}:${kind}`, [...sets.get(`${find(index)}:${kind}`) ?? [], index]);
    }
    for (const [key, members] of sets) {
      if (members.length < 2) continue;
      if (key.endsWith(':metric')) {
        const sizes: Partial<Record<MetricTextRole, number>> = {};
        for (const index of members) for (const part of items[index]!.metricLayout!.parts) if (part.visible && part.fit) sizes[part.role] = Math.min(sizes[part.role] ?? Infinity, part.fit.fontSize);
        for (const index of members) {
          const item = items[index]!;
          if (item.metricLayout!.parts.every(part => !part.visible || !part.fit || part.fit.fontSize <= sizes[part.role]! + 1e-9)) continue;
          const refit = metricRefits.get(index)!(sizes);
          if (refit.overflow || refit.parts.some(part => part.visible && (!part.fit || Math.abs(part.fit.fontSize - sizes[part.role]!) > 1e-9))) continue;
          item.metricLayout = refit;
          item.text = refit.parts.find(part => part.role === 'value')?.fit;
        }
        continue;
      }
      // LH-78: sibling quotes of one row share one body size: each larger one is laid out again in its own box at the row's smallest
      // body size. A row is the quotes whose cells overlap vertically, so a row of wider cells under a row of narrow ones keeps its own,
      // larger size.
      if (key.endsWith(':quote')) {
        const bodyOf = (layout: QuoteLayout) => layout.parts.find(part => part.role === 'body')?.fit;
        const cellOf = (index: number) => items[index]!.frameBox ?? items[index]!.box;
        const rows: number[][] = [];
        for (const index of members) {
          const cell = cellOf(index), row = rows.find(list => list.some(other => { const peer = cellOf(other); return Math.max(cell.y, peer.y) < Math.min(cell.y + cell.height, peer.y + peer.height) - 1e-6; }));
          if (row) row.push(index); else rows.push([index]);
        }
        for (const row of rows) {
          if (row.length < 2) continue;
          const size = Math.min(...row.map(index => bodyOf(items[index]!.quoteLayout!)?.fontSize ?? Infinity));
          for (const index of row) {
            const item = items[index]!;
            if ((bodyOf(item.quoteLayout!)?.fontSize ?? 0) <= size + 1e-9) continue;
            const refit = quoteRefits.get(index)!(size), body = bodyOf(refit);
            if (refit.overflow || !body || Math.abs(body.fontSize - size) > 1e-9) continue;
            item.quoteLayout = refit;
            item.text = body;
          }
        }
        continue;
      }
      const size = Math.min(...members.map(index => items[index]!.text!.fontSize));
      for (const index of members) {
        const item = items[index]!;
        if (item.text!.fontSize <= size + 1e-9) continue;
        const text = contentText(item.field, item.value) ?? '';
        const refit = fitContent(item.field, item.value, text, item.box, size, snapFontSizeUp((item.composition.minFontSize ?? 16) * scale), item.path, item.payload.numbering, item.alignment);
        if (!refit.overflow && Math.abs(refit.fontSize - size) < 1e-9) item.text = refit;
      }
    }
  };
  // LH-86: the text of a card in a stack of long-text rows sits in the middle of its card, at the size the rows share (after
  // sharePeerSizes), so a row taller than its text keeps its spare height above and below the text, not under it.
  const centerCardText = (): void => {
    for (const index of centeredCardText) {
      const item = items[index]!, fit = item.text;
      if (!fit || fit.overflow) continue;
      const used = Math.max('height' in fit && typeof fit.height === 'number' ? fit.height : fit.lines.length * fit.lineHeight, fit.placement?.height ?? 0);
      const dy = (item.box.height - used) / 2;
      if (dy < scale) continue;
      item.box = { ...item.box, y: item.box.y + dy, height: item.box.height - dy };
      item.text = translateTextFit(fit, dy);
    }
  };
  const ownMode = record(slide.composition).mode as Composition['mode'] | undefined;
  const direction = recomposing && hints.sources.contentDirection === 'layout' ? undefined : hints.contentDirection;
  const directionMode: Composition['mode'] = direction === 'vertical' ? 'column' : direction === 'horizontal' ? 'row' : 'auto';
  // The effective design.chartPrimary (slide, deck, then the layout's own) splits the root into a
  // primary chart track and one synthetic container of the other nodes when the slide has no regions
  // and no composition.mode of its own, and the root nodes mix at least one chart leaf with other nodes.
  // This automatic hint preserves its 3:2 track geometry; a template remains authoritative.
  // LH-49: the chart track automaticTracks chose splits the root the same way, whatever the slide's own mode; the other blocks keep that
  // mode in their column.
  // LH-61: a KPI column (kpiColumn) stacks the other blocks in a column whatever the slide's own mode.
  const chartTrack = (options as Record<symbol, unknown>)[CHART_TRACK] as { edge: ImageEdge; share: number; mode?: Composition['mode'] } | undefined;
  const chartHint = chartTrack?.edge ?? hints.chartPrimary;
  const chartSide = chartHint === 'left' || chartHint === 'right' || chartHint === 'top' || chartHint === 'bottom' ? chartHint : undefined;
  const chartIndex = pending.findIndex(node => !node.children && node.field === 'chart');
  const chartPrimary = chartSide !== undefined && !useTemplate && (chartTrack !== undefined || !ownMode) && !regions.length && chartIndex >= 0 && pending.some(node => node.children || node.field !== 'chart') ? chartSide : undefined;
  const firstChart = chartPrimary === 'left' || chartPrimary === 'top';
  const rootSettings: Composition = chartPrimary
    ? { ...composition, mode: chartPrimary === 'left' || chartPrimary === 'right' ? 'row' : 'column', weights: chartTrack ? (firstChart ? [chartTrack.share, 1 - chartTrack.share] : [1 - chartTrack.share, chartTrack.share]) : firstChart ? [3, 2] : [2, 3], columns: undefined }
    : { ...composition, mode: composition.mode ?? directionMode };
  // LH-115: a timeline whose `when` values are a column chart's categories draws under the plot (settle, timelineUnderChart): the chart
  // above, the timeline in a band of its own height below, laid out again under the plot after the chart is composed (below).
  const underChart = (options as Record<symbol, unknown>)[TIMELINE_UNDER_CHART] === true && !useTemplate && !regions.length && pending.length === 2 && pending.every(node => !node.children)
    ? { chart: pending.find(node => node.field === 'chart'), timeline: pending.find(node => node.field === 'timeline') } : undefined;
  if (useTemplate) composeTemplate();
  else if (underChart?.chart && underChart.timeline) {
    timelineHints.set(underChart.timeline, { horizontal: true });
    const band = measureTimeline(underChart.timeline, { x: 0, y: 0, width: contentBox.width, height: 1e6 }, composition).bounds.height + scale;
    arrange([underChart.chart, underChart.timeline], contentBox, { ...composition, mode: 'column', weights: [Math.max(scale, contentBox.height - gap - band), band], columns: undefined }, 0);
  }
  else if (chartPrimary) {
    const primary = pending[chartIndex]!, rest = pending.filter((_, index) => index !== chartIndex);
    const support: Pending = { field: 'blocks', type: 'group', value: rest.map(node => node.payload), path, payload: {}, children: rest, composition: chartTrack?.mode ? { mode: chartTrack.mode } : chartTrack && ownMode ? { mode: ownMode } : {}, synthetic: true };
    arrange(firstChart ? [primary, support] : [support, primary], contentBox, rootSettings, 0);
  } else {
    const grouped = groupRoot(pending), roots = grouped?.nodes ?? pending;
    // LH-48: the one root block is the whole body (fillLone).
    if (roots.length === 1 && !roots[0]!.children) roots[0]!.fills = true;
    if (grouped?.settings) arrange(grouped.nodes, contentBox, grouped.settings, 0, gap); else arrange(grouped?.nodes ?? pending, contentBox, rootSettings, 0);
  }
  sharePeerSizes();
  shareStartAlignment();
  hugQuoteCards();
  centerCardText();
  // LH-06: the automatic foot band or pill is the last block, so its text is the last body item (reading order).
  // LH-06: a pill follows its long text, one gap under the text's last line, at the start of the text's own box (its column and
  // alignment); with no room there it is composed at the foot of the body instead (PILL_AT_FOOT).
  if (autoSurface && autoEmphasis?.follows !== undefined && (options as Record<symbol, unknown>)[PILL_AT_FOOT] !== true) {
    const prefix = `${path}.blocks.${autoEmphasis.follows}.`, owner = items.filter(item => item.path.startsWith(prefix) && item.text);
    // A text drawn on a card (LH-64, LH-48) ends at its card: the pill follows the card, not the text inside it.
    const textBottom = Math.max(...owner.map(item => Math.max(item.box.y + ('richLines' in item.text! ? (item.text as RichTextFit).height : (item.text as TextFit).placement?.height ?? item.text!.lines.length * item.text!.lineHeight), item.frameBox ? item.frameBox.y + item.frameBox.height : -Infinity)));
    const column = owner[0]?.box, surfaceBox = autoSurface.emphasis.box, top = round(textBottom + gap);
    if (!column || !Number.isFinite(textBottom) || top + surfaceBox.height > bodyBottom + .01) return composeLayout(input, { ...options, [PILL_AT_FOOT]: true } as ComposeSlideOptions);
    const side = alignmentFor('text'), atEnd = rtl ? side === 'left' : side === 'right', width = surfaceBox.width;
    const x = round(side === 'center' ? column.x + (column.width - width) / 2 : atEnd ? column.x + column.width - width : column.x);
    const item = autoSurface.item, dx = x - surfaceBox.x, dy = top - surfaceBox.y, box = { ...item.box, x: item.box.x + dx, y: item.box.y + dy };
    autoSurface.emphasis.box = { ...surfaceBox, x, y: top };
    item.box = box;
    item.text = fitPlacedText('text', item.value, contentText('text', item.value)!, box, item.text!.fontSize, item.text!.fontSize, item.path, 'center');
  }
  if (autoSurface) items.push(autoSurface.item);
  // LH-114: the data and the pull line are one stack. A pull line reserved at the foot moves up to one gap under the lowest content of
  // the body (a table's last row, a text's last line, a card's edge, a chart's box), and one reserved under the headings moves down
  // to one gap above the highest, so a body that hugs its content does not leave the pull line a block away from its data. The body
  // never moves; with the pull line it is not centered (LH-52, LH-48's CENTER), so the stack sits at the top of the body.
  if (pullItem && placePull) {
    const pulled = pullItem, own = new Set([pulled.path, autoSurface?.item.path]), placedPaths = new Set(placed.map(entry => `${entry.hostPath}.image`));
    const body = items.filter(item => !headings.has(item.field) && !own.has(item.path) && !placedPaths.has(item.path));
    const textHeight = (fit: TextFit | RichTextFit) => 'richLines' in fit ? (fit as RichTextFit).height : fit.placement?.height ?? fit.lines.length * fit.lineHeight;
    const extent = (item: ComposedItem): [number, number] => {
      if (item.frameBox) return [item.frameBox.y, item.frameBox.y + item.frameBox.height];
      const internal = (item.quoteLayout ?? item.codeLayout ?? item.metricLayout ?? item.timelineLayout) as { bounds?: LayoutBox } | undefined;
      if (internal?.bounds) return [internal.bounds.y, internal.bounds.y + internal.bounds.height];
      if (item.field === 'table') {
        try {
          const rows = layoutTable(item.value, item.box, { scale, minFontSize: item.composition.minFontSize, fontFamily: options.fontFamilies?.body, ...(options.fontFamilies?.code ? { codeFontFamily: options.fontFamilies.code } : {}), textMeasurement: options.textMeasurement, presentation: options.presentation, ...(item.tableGrowth ? { growth: item.tableGrowth } : {}) }).rows.flatMap(row => row.cells.map(cell => cell.box));
          if (rows.length) return [Math.min(...rows.map(box => box.y)), Math.max(...rows.map(box => box.y + box.height))];
        } catch { /* the item's box below */ }
      }
      if (item.text && (item.field === 'text' || item.field === 'items' || item.field === 'bullets')) {
        const lines = 'richLines' in item.text ? undefined : (item.text as TextFit).placement?.lines;
        return lines?.length ? [Math.min(...lines.map(line => line.y)), Math.max(...lines.map(line => line.y + line.height))] : [item.box.y, item.box.y + textHeight(item.text)];
      }
      const box = item.image?.box ?? item.box;
      return [box.y, box.y + box.height];
    };
    if (body.length) {
      const extents = body.map(extent), top = Math.min(...extents.map(([from]) => from)), bottom = Math.max(...extents.map(([, to]) => to));
      const at = pullQuote?.position === 'foot' ? round(Math.min(pulled.box.y, bottom + gap)) : round(Math.max(pulled.box.y, top - gap - pulled.box.height));
      if (Math.abs(at - pulled.box.y) > .5) { const moved = placePull(at); if (items.includes(pulled)) items[items.indexOf(pulled)] = moved; pullItem = moved; }
    }
  }
  if (pullItem && pullQuote?.position === 'foot') items.push(pullItem);
  // LH-33: sibling charts of one unit share their value axis (chart-axis.ts); LH-93: and one plot height (chart-plot.ts).
  const chartMeasure = textWidthMeasurer(resolveTextStyle({fontFamily: options.fontFamilies?.body ?? 'sans-serif', fontWeight: 400, italic: false, path}, options.textMeasurement), options.textMeasurement);
  const plotGeometry = (item: unknown) => ({scale, minFontSize: (item as ComposedItem).composition.minFontSize, measure: chartMeasure, direction: rtl ? 'rtl' as const : 'ltr' as const, language: deckLanguage()});
  shareSiblingPlots(shareSiblingChartAxes(items, options.presentation), plotGeometry, options.presentation);
  // LH-105: a shared plot moves the line ends, so their names are placed again.
  refreshEndLabels(items.filter(item => item.chart?.layer?.endLabels), plotGeometry, options.presentation);
  // LH-109, LH-110: and so do a stacked chart's names and the reference marks. The bold face is resolved only for a slide that has them
  // (a deck without a bold body face must not fail on a slide that never draws one).
  const marked = items.filter(item => item.chart?.layer?.stack?.names || item.chart?.layer?.stack?.ends || item.chart?.layer?.references);
  if (marked.length) {
    const chartBold = textWidthMeasurer(resolveTextStyle({fontFamily: options.fontFamilies?.body ?? 'sans-serif', fontWeight: 700, italic: false, path}, options.textMeasurement), options.textMeasurement);
    refreshChartMarks(marked, item => ({...plotGeometry(item), bold: chartBold}), options.presentation);
  }
  // LH-113: a table draws the rows its `highlight` names, else the rows the slide's texts name (chart-focus.ts), on the highlight tint.
  for (const item of items) {
    if (item.field !== 'table') continue;
    const resolved = resolveTableData(item.value, options.presentation), table = record(item.value), language = deckLanguage();
    const highlight = table.highlight !== undefined ? tableHighlightRows(table.highlight, resolved.rows) : tableSlideFocus(item.value, resolved.rows,
      resolved.rows.map(row => row.map((cell, column) => tableKeyText(tableCellDisplayValue(cell, resolved.formats[column])))), {sources: focusSources(), ...(language !== undefined ? {language} : {})});
    if (highlight?.length) item.tableHighlight = highlight;
  }
  // LH-115: a horizontal bar chart beside a table of the same keys in the same order draws each bar on its table row (chart-rows.ts).
  const rounded = (box: LayoutBox): LayoutBox => ({ x: round(box.x), y: round(box.y), width: round(box.width), height: round(box.height) });
  for (const chart of items) {
    if (chart.field !== 'chart' || !chart.chart?.layer || chart.chart.layer.rows) continue;
    const data = resolveChartData(chart.value, options.presentation);
    if (!data.ok || data.combo || data.hasX) continue;
    const plan = chartDrawPlan(chart.value, data, { language: deckLanguage() });
    if (plan.fallback || !horizontalBarType(plan.type)) continue;
    const categories = data.rows.map(row => row[0] === null || row[0] === undefined ? '' : String(row[0]));
    for (const table of items) {
      if (table.field !== 'table' || !besideEachOther(chart.box, table.box)) continue;
      const resolved = resolveTableData(table.value, options.presentation);
      if (!sameKeys(categories, tableRowKeys(resolved.rows), deckLanguage())) continue;
      let layout: TableLayout;
      try { layout = layoutTable(table.value, rounded(table.box), { scale, minFontSize: table.composition.minFontSize, fontFamily: options.fontFamilies?.body, ...(options.fontFamilies?.code ? { codeFontFamily: options.fontFamilies.code } : {}), textMeasurement: options.textMeasurement, presentation: options.presentation, ...(rtl ? { direction: 'rtl' as const } : {}), ...(table.tableGrowth ? { growth: table.tableGrowth } : {}) }); } catch { continue; }
      const body = layout.rows.filter(row => !row.cells.some(cell => cell.header));
      if (body.some(row => row.cells.some(cell => cell.rowSpan > 1))) continue;
      const layer = chart.chart.layer, authored = record(chart.value);
      // Each bar beside its key: the middle of the key cell's text (cells set their text at the top of the row).
      const centers = body.map(row => { const key = row.cells.find(cell => cell.column === 0) ?? row.cells[0]!; const fit = key.fit; return key.textBox.y + ('height' in fit ? fit.height : fit.lines.length * fit.lineHeight) / 2; });
      const rows = alignBarRows(data, rounded(chart.box), body.map(row => row.box), centers, { scale, minFontSize: chart.composition.minFontSize, header: (layer.stack?.legend ?? layer.header)?.height ?? 0, hiddenAxis: layer.small?.valueAxis === false, labels: Boolean(layer.small?.labels || (authored.dataLabels !== undefined && authored.dataLabels !== false)), measure: chartMeasure });
      // LH-125: a horizontal stacked bar chart gives up its pinned plot and names row for the table's rows, keeping its legend (restackForRows).
      if (rows) { chart.chart.layer = restackForRows(chart.value, data, layer, rows, chart.box, chart.chart.valueAxis, plotGeometry(chart)); break; }
    }
  }
  // LH-115: the timeline under its column chart spans the plot, so each event sits under its column; it is listed before the chart when
  // it was written first (reading order).
  if (underChart?.chart && underChart.timeline) {
    const chartItem = items.find(item => item.path === underChart.chart!.path), timelineItem = items.find(item => item.path === underChart.timeline!.path && item.timelineLayout);
    const resolved = chartItem?.chart ? resolveChartData(chartItem.value, options.presentation) : undefined;
    const inset = chartItem?.chart && resolved?.ok ? chartPlotInset(chartItem.value, resolved, chartItem.chart, { ...plotGeometry(chartItem), box: chartItem.box }) : undefined;
    if (chartItem && timelineItem && inset && !timelineItem.frameBox) {
      const box = { x: chartItem.box.x + inset.left, y: timelineItem.box.y, width: Math.max(scale, chartItem.box.width - inset.left - inset.right), height: timelineItem.box.height };
      const layout = placeTimeline(underChart.timeline, box, timelineItem.composition);
      if (!layout.overflow && layout.arrangement === 'band') { timelineItem.box = box; timelineItem.timelineLayout = layout; }
    }
    if (chartItem && timelineItem && pending.indexOf(underChart.timeline) < pending.indexOf(underChart.chart)) {
      const from = items.indexOf(timelineItem), to = items.indexOf(chartItem);
      if (from > to) { items.splice(from, 1); items.splice(to, 0, timelineItem); }
    }
  }
  if (listBullet?.value === 'image' && !bulletImage && items.some(item => (item.field === 'items' || item.field === 'bullets') && item.payload.numbering === undefined)) {
    diagnostics.push({ code: 'unresolved-content', path: listBullet.path, message: 'Picture bullets (listBullet: image) need an organization logo (the primary organization, or the one design.logo names); the marker glyph is drawn instead.' });
  }

  // LH-50: each eyebrow over its paragraph's final box (passes above may have centered, shared or moved it), in the band the paragraph left
  // for it, at the paragraph's alignment and width; it is listed before its paragraph (reading order) and carries `eyebrow`.
  for (const [owner, eyebrow] of eyebrowsOf) {
    const at = items.indexOf(owner);
    if (at < 0) continue;
    const paragraph = owner.text?.fontSize ?? PROSE_NOMINAL_SIZE * scale, band = eyebrowBand(eyebrow, owner.box.width, paragraph), height = band - gap * EYEBROW_GAP;
    const box = { x: owner.box.x, y: owner.box.y - band, width: owner.box.width, height }, fit = fitEyebrow(eyebrow, box, paragraph, owner.alignment);
    items.splice(at, 0, { path: eyebrow.path, field: 'text', type: 'text', value: eyebrow.value, payload: { type: 'text', text: eyebrow.value }, box, text: fit, textStyle: styleFor('text', eyebrow.path), composition: owner.composition, alignment: owner.alignment ?? alignmentFor('text'),
      eyebrow: true, ...(owner.frameBox ? { frameBox: owner.frameBox } : {}), ...(owner.region !== undefined ? { region: owner.region } : {}), ...(owner.emphasis ? { emphasis: true as const } : {}) });
  }
  // Notices that never fail a strict composition: the drawn number is still the one PowerPoint draws.
  const numberingDiagnostics: LayoutDiagnostic[] = [];
  for (const item of items) {
    for (const key of ["x", "y", "width", "height"] as const) item.box[key] = round(item.box[key]);
    if (item.field === "table" && tableOverflows(item.value,item.box,scale,item.composition,options,item.path,item.tableGrowth)) diagnostics.push({ code: "text-overflow", path: item.path, message: "Table cells do not fit; use fewer rows, fewer columns, or split the table across slides." });
    if (item.quoteLayout) diagnostics.push(...item.quoteLayout.diagnostics);
    else if (item.codeLayout) diagnostics.push(...item.codeLayout.diagnostics);
    else if (item.metricLayout) diagnostics.push(...item.metricLayout.diagnostics);
    else if (item.timelineLayout) diagnostics.push(...item.timelineLayout.diagnostics);
    else if (item.text?.overflow) diagnostics.push({ code: "text-overflow", path: item.path, message: "Text exceeds its cell at the minimum font size; shorten it, increase its space, or split the slide." });
    // LH-45: nothing draws past its cell (its card, when it has one) without a finding. A layout checks its parts against the box it was
    // given, and a metric is given its row's shared height, which can be taller than its own cell: the accepted parts are checked here.
    const internal = item.quoteLayout ?? item.codeLayout ?? item.metricLayout ?? item.timelineLayout;
    if (internal && !internal.diagnostics.length) {
      const cell = item.frameBox ?? item.box;
      for (const part of internal.parts as readonly { path: string; role: string; box: LayoutBox; visible?: boolean }[]) {
        const area = part.box;
        if (part.visible === false || area.x >= cell.x - .01 && area.y >= cell.y - .01 && area.x + area.width <= cell.x + cell.width + .01 && area.y + area.height <= cell.y + cell.height + .01) continue;
        diagnostics.push({ code: "text-overflow", path: part.path, message: `The ${item.field} ${part.role} extends outside its cell; give the block more space, shorten it, or split the slide.` });
      }
    }
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
  // Wave 3: every body block fitted at the size it asked for (a paragraph or list at its starting size, each visible part of a quote, code
  // panel, metric or timeline at its role size), so no arrangement of the same requests could set one larger (composeSlide's guard).
  // LH-50: an eyebrow, inserted before its paragraph at the end, is set at its role size; the others keep the index they were placed at.
  let eyebrowsBefore = 0;
  const atRequest = !loneGrowth && items.every((item, position) => {
    if (item.eyebrow) { eyebrowsBefore++; return true; }
    const index = position - eyebrowsBefore;
    if (headings.has(item.field) || item.emphasis) return true;
    const internal = item.quoteLayout ?? item.codeLayout ?? item.metricLayout ?? item.timelineLayout;
    if (internal && (internal.parts as readonly { requestedFontSize: number; fit?: { fontSize: number } }[]).some(part => part.fit && part.fit.fontSize > part.requestedFontSize + FONT_GRID_EPSILON)) return false;
    if (internal) return (internal.parts as readonly { requestedFontSize: number; fit?: { fontSize: number }; visible?: boolean }[]).every(part => part.visible === false || !part.fit || part.fit.fontSize >= part.requestedFontSize - FONT_GRID_EPSILON);
    if (item.field === 'table') return false;
    if (!item.text) return true;
    const start = bodyStarts.get(index);
    return start !== undefined && item.text.fontSize >= snapFontSizeDown(start) - FONT_GRID_EPSILON;
  });
  const composed: SlideComposition = { width, height, contentBox, items, groups, flows, ...(useTemplate ? { regions: templateRegions, headingAreas } : {}), diagnostics, composition, design: hints, ...(furniture?{furniture}:{}), ...(backgroundImage?{backgroundImage}:{}), ...(logo?{logo}:{}), ...(rtl?{direction:'rtl' as const}:{}), ...(footnotes?{footnotes}:{}), ...(surface?{emphasis:surface}:{}), ...(explanation?{explanation}:{}) };
  if (atRequest) AT_REQUEST.add(composed);
  if (leadItems.size) LEAD_STACKS.add(composed);
  if (regionMeasured) REGION_MEASURED.add(composed);
  return composed;
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
// RR-92: the value axis (scale, intervals and the axis of a category chart), shared by the preview and the PPTX export.
export {niceScale,maxIntervalsFor,stackCategoryValues,waterfallSteps,CHART_AXIS_MAX_OVERSHOOT,CHART_LABELED_ZERO_SHARE,chartValueAxis,shareSiblingChartAxes,chartTextSize,chartIntervalsFor,CHART_TEXT_PX,CHART_TEXT_FLOOR_PX,CHART_MIN_TICK_SPACING_PX,CHART_MAX_INTERVALS} from './chart-axis.js';
export type {ChartScale,ChartValueAxis,ChartAxisGeometry,WaterfallStep} from './chart-axis.js';
export {chartOptionSupport,chartOptionTarget,resolveChartOptions,chartHighlightMarks,formatChartLabelNumber,formatChartLabelPercent,chartLabelText,DEFAULT_CHART_LABEL_SEPARATOR} from './chart-options.js';
export {chartPlotInset,shareSiblingPlots} from './chart-plot.js';
export {restackForRows,chartWaterfall,waterfallRoles,waterfallLabelText,waterfallSignedFormat,chartValueList,chartStack,placeStackNames,chartTitleReferences,placeReferences,refreshChartMarks,CHART_VALUE_LIST_MAX_ROWS,CHART_VALUE_LIST_SMALL_SLICE} from './chart-marks.js';
export type {WaterfallRole,ChartLayerWaterfall,ChartValueListRow,ChartValueListHole,ChartLayerValueList,ChartStackName,ChartStackEnd,ChartLayerStack,ChartReferenceLine,ChartReferenceBand,ChartLayerReferences} from './chart-marks.js';
export type {ChartPlotGeometry,SiblingPlotChart} from './chart-plot.js';
export {chartLayer,chartHeader,chartHeaderCaption,chartRingLabels,smallChart,chartLayerDataLabels,SMALL_CHART_MAX_SERIES,SMALL_CHART_MAX_POINTS,CHART_HEADER_MAX_LEGEND} from './chart-layer.js';
export type {ChartLayer,ChartLayerSmall,ChartLayerHeader,ChartLayerRing,ChartPlotInset,ChartHeaderLegendEntry,ChartLayerGeometry,ChartEndLabel,ChartLayerEndLabels,ChartSliceLabel,ChartLayerSlices} from './chart-layer.js';
export {chartEndLabels,chartSliceLabels,endLabelText,placeEndLabels,refreshEndLabels,CHART_SLICE_LABEL_MIN_RADIUS} from './chart-direct-labels.js';
export {chartCategoriesInTime,isTimeFieldTitle,monthOf} from './chart-time-order.js';
export {chartTitleFocus,chartSlideFocus,slideFocusSources,tableSlideFocus,tableHighlightRows,focusHits,type ChartLayerFocus,type FocusSource} from './chart-focus.js';
export {alignBarRows,type ChartLayerRows} from './chart-rows.js';
export {chartWaterfallColors,chartBandColor,CHART_BAND_MIX,chartContextColor,chartContextColors,CHART_CONTEXT_MIN_CONTRAST,CHART_CONTEXT_LABELED_MIN_CONTRAST,CHART_CONTEXT_FOCUS_DIFFERENCE} from './color.js';
export type {ChartOptionKind,ChartOptionTarget,ChartOptionSupport,ChartOptionDiagnostic,ChartLegendPosition,ChartLabelContent,ChartLabelPosition,ResolvedChartDataLabels,ResolvedChartHighlight,ChartHighlightMarks,ResolvedChartOptions} from './chart-options.js';
// RR-54: chart and table data resolution, for engines that import the composition entry.
export {chartNumber,formatDataNumber,numberFormatError,toExcelNumberFormat,fromExcelNumberFormat,inlineDatasets,inlineTableData,inlineChartData,isDatasetRef,isXYChartType,resolveChartData,resolveTableData,tableCellDisplayValue,tableKeyText} from './chart-data.js';
export type {DataCellValue,DataColumn,DataSourceRef,Dataset,DatasetRef,ChartMapping,ChartComboSeries,DataTableCell,DataTableHeader,DataDiagnostic,ResolvedChartData,ResolvedTableData} from './chart-data.js';
export {chartDrawPlan,chartDrawDiagnostics,isPlaceLabel,markLabelColor} from './chart-fallback.js';
export type {ChartDrawPlan,ChartFallback} from './chart-fallback.js';

export { resolveDesignHints, DESIGN_HINT_KEYS, type DesignHints, type DesignHintKey, type DesignHintSource, type ResolvedDesignHints, type ResolveDesignHintsOptions } from './design-hints.js';
export { layoutContent, layoutStructure, LAYOUT_BODY_KINDS, type LayoutContent, type LayoutBodyKind } from './layout-content.js';
// OPF 0.19 layout templates: the record's grid and regions, content binding and the pure geometry composeSlide uses.
export { AUTO_LAYOUT, HEADING_AREAS, MAX_REGION_BLOCKS, MAX_REGION_DEPTH, MAX_REGION_ENTRIES, MAX_TEMPLATE_TRACKS, OPFLayoutTemplateError, REGION_ANCHORS, REGION_FLOWS, REGION_KINDS, REGION_ROLES, RESERVED_REGION_NAMES, isLayoutTemplate, layoutEntries, layoutRegion, layoutTemplate, layoutTemplateIssues, type LayoutArea, type LayoutEntry, type LayoutRegion, type LayoutTemplate, type LayoutTemplateIssue, type RegionAnchor, type RegionFlow, type RegionKind, type RegionRole } from './layout-template.js';
export { EYEBROW_LABEL_CHARS, EYEBROW_LABEL_WORDS, EYEBROW_TEXT_KIND, eyebrowLabel, isLabelText, groupBinding, groupingNode, JOINED_FIXED_MAX, majorityKind, MOVED_ROW_MAX, PAIR_FIGURE_KINDS, PAIR_LENGTH_RATIO, repeatedPairs, textLength, type GroupedBinding, type GroupingNode, type JoinedArrangement } from './block-grouping.js';
export { bindRegions, blockKind, placedImageBlocks, regionAccepts, regionRoleRank, rootNodes, type BindRegionsOptions, type BoundBlock, type RegionBinding, type RegionBindingDiagnostic, type RegionBindingResult } from './bind-regions.js';
export { allocateRows, gridFlowShape, LIST_WHOLE_ENTRIES, listColumnBreaks, listGridShape, shareHeights, type FlowShape, type RowDemand } from './template-geometry.js';
export { THEME_DESIGN_KEYS } from './design-hints.js';
