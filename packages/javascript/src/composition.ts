import {tableGrid,type TableCellStyle} from './table.js';
import {inlineChartData,inlineTableData,resolveChartData,resolveTableData,tableCellDisplayValue,tableKeyText,type DataTableCell} from './chart-data.js';
import {chartTextSize,chartValueAxis,shareSiblingChartAxes,type ChartValueAxis} from './chart-axis.js';
import {chartHeader,chartLayer,type ChartLayer} from './chart-layer.js';
import {groupNumber,NUMBER_GROUPING_MIN} from './number-grouping.js';
import {chartPlotInset,shareSiblingPlots} from './chart-plot.js';
import {alignBarRows,besideEachOther,horizontalBarType,sameKeys,tableRowKeys} from './chart-rows.js';
import {chartEndLabels,chartSliceLabels,refreshEndLabels} from './chart-direct-labels.js';
import {chartSlideFocus,slideFocusSources,tableHighlightRows,tableSlideFocus,type FocusSource} from './chart-focus.js';
import {restackForRows,chartStack,chartTitleReferences,chartValueList,chartWaterfall,placeReferences,refreshChartMarks} from './chart-marks.js';
import {chartHistogram} from './chart-histogram.js';
import {chartDrawPlan} from './chart-fallback.js';
import {intrinsicImageAspect,intrinsicImageSize} from './image-aspect.js';
import {resolveDesignHints,type ResolvedDesignHints} from './design-hints.js';
import {visualReadingOrder} from './reading-order.js';
import {isLayoutTemplate,layoutTemplate,withRegionRules,type LayoutTemplate,type LayoutRegion,type RegionAnchor,type RegionFlow,type RegionKind,type RegionRole} from './layout-template.js';
import {bindRegions,rootNodes,type BoundBlock} from './bind-regions.js';
import {featuredCells,type FeaturedCells} from './featured-cards.js';
import {EYEBROW_LABEL_CHARS,EYEBROW_TEXT_KIND,eyebrowLabel,isLabelText,groupBinding,majorityKind,PAIR_LENGTH_RATIO,repeatedPairs,textLength,type GroupedBinding} from './block-grouping.js';
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
import {listNumberLabel,listNumbers,sliceNumberedItems,type ListNumber,type NumberingInput} from './numbering.js';
export {NUMBERING_STYLES,NUMBERING_SUFFIXES,MAX_NUMBERING_VALUE,MAX_ROMAN_VALUE,MAX_NUMBERING_LEVELS,formatListNumber,listNumberLabel,listNumbers,resolveNumbering,numberingAtLevel,numberingStyleDraws,sliceNumberedItems,type Numbering,type NumberingInput,type NumberingStyleName,type NumberingSuffix,type ResolvedNumbering,type ListNumber} from './numbering.js';
import {DEFAULT_FURNITURE_DATE_FORMAT,formatFurnitureDate,parseIsoDate,type FurnitureField} from './furniture-fields.js';
import {substituteSlideTokens,usesSlideBuiltin} from './slide-variables.js';
import {parseLogoName,resolveLogo,resolveOrganizationLogo,type LogoShape,type LogoVariant} from './logos.js';
export {LOGO_SHAPES,resolveLogo} from './logos.js';
export type {LogoShape,LogoVariant,ResolvedLogo,ResolveLogoOptions} from './logos.js';
export {DEFAULT_FURNITURE_DATE_FORMAT,formatFurnitureDate,type FurnitureField} from './furniture-fields.js';
export {tableGrid,tableRowBoundaries,type TableCellStyle,type TableBorder,type TableGrid,type TableGridCell,type TableGridIssue} from './table.js';
import {legible, luminance as legibleLuminance, normalize as legibleHex} from './legible-color.js';
import {applyColorTransform,colorContrast,colorTransform,layoutVariantApplies,resolveColorRoles,type ColorVariant} from './color.js';
import {pictureScrims,SCRIM_MARGIN,SCRIM_TARGET_CONTRAST,type ComposedScrim,type PictureLuminance,type ScrimBox,type ScrimEdge} from './picture-scrim.js';
export {pictureScrims,luminanceGrid,scrimOpacity,scrimGeometry,sampledGrays,sampledWeight,grayOfLuminance,SCRIM_TARGET_CONTRAST,SCRIM_MARGIN,SCRIM_FADE,type ComposedScrim,type PictureLuminance,type PictureWeights,type ScrimEdge} from './picture-scrim.js';
import {choosePictureText,scorePictureText,PICTURE_PANEL_SHARES,PICTURE_TEXT_COLUMNS,PICTURE_TEXT_PLACEMENTS,type PictureText,type PictureTextAlignment,type PictureTextAnchor,type PictureTextCandidate,type PictureTextInput,type PictureTextPlacement} from './picture-text.js';
export {choosePictureText,scorePictureText,CALM_PICTURE_SPREAD,SALIENT_LIMIT,PANEL_SCRIM_LIMIT,PICTURE_PANEL_SHARES,PICTURE_TEXT_COLUMNS,PICTURE_TEXT_PLACEMENTS,type PictureText,type PictureTextAlignment,type PictureTextAnchor,type PictureTextCandidate,type PictureTextInput,type PictureTextPlacement} from './picture-text.js';
import {numericText} from './number-text.js';
import {CYCLE_RING_MARGIN,cycleFrame,cycleLoop,cycleNodes,cycleRing,type ArrangementArrow} from './arrangements.js';
import {ARRANGEMENT_CARDS_MAX,ARRANGEMENT_GROWTH,ARRANGEMENT_LINE_POINTS,ARRANGEMENT_MAX,ARRANGEMENT_TEXT_MARGIN,CARD_TEXT_MARGIN,cardNodes,MATRIX_ENTRIES,matrixNodes,matrixQuadrants,matrixSquare,nodeWidthAt,pyramidFrame,pyramidNodes,pyramidSteps,SMART_ART_DOMAIN,smartArtScript,smartArtUnavailable,SMART_ART_NAMES,type Arrangement,type ArrangementNode} from './arrangements.js';
import {isLinearArrangement,linearDesign,linearMargins,linearNodes,OPF_LINES_MAX} from './linear-arrangements.js';
import type {OpfLayoutRecipe} from './smart-art-layout.js';
export {MM_PER_PX,SMART_ART_OPF_DOMAIN,opfSmartArtUnavailable,type OpfSmartArtCandidate,OPF_LAYOUT_DESIGNS,OPF_LAYOUT_KIND,OPF_LAYOUT_MAX,TEXT_ONLY_LABELS,compositeLayoutDefinition,evaluateLayoutDefinition,layoutArrangement,opfLayoutGeometry,presetTextRect,turnedShapeBox,type LayoutAlgorithm,type LayoutBranch,type LayoutChild,type LayoutChoose,type LayoutConstraint,type LayoutDefinition,type LayoutForEach,type LayoutNodeDefinition,type LayoutPresOf,type LayoutShape,type LayoutShapeType,type LayoutStyle,type LayoutTable,type OpfLayoutDesign,type OpfLayoutRecipe} from './smart-art-layout.js';
export {CYCLE_ARROW,CYCLE_ARROW_ADJUST,CYCLE_ARROW_LIGHTEN,CYCLE_DIAMETER,CYCLE_RADIUS,CYCLE_RING_MARGIN,CYCLE_RING_NODE,CYCLE_TWO,cycleAspect,cycleFrame,cycleLoop,cycleNodes,cycleRing,rightArrowPoints,type ArrangementArrow} from './arrangements.js';
export {ARRANGEMENTS,ARRANGEMENT_CARDS_MAX,CARD_TEXT_MARGIN,MATRIX_ENTRIES,PYRAMID_STEPS_ASPECT,PYRAMID_STEPS_SHARE,cardNodes,matrixQuadrants,pyramidSteps,smartArtScript,ARRANGEMENT_GROWTH,ARRANGEMENT_LINE_POINTS,ARRANGEMENT_MAX,ARRANGEMENT_TEXT_MARGIN,MATRIX_BACKGROUND_LIGHTEN,MATRIX_GAP,MATRIX_INSET,MATRIX_QUADRANT,PYRAMID_MAX_ASPECT,PYRAMID_TEXT_WIDTH,ROUND_RECT_ADJUST,SMART_ART_DOMAIN,SMART_ART_LAYOUTS,arrangementPaint,matrixNodes,matrixSquare,nodeWidthAt,pyramidFrame,pyramidNodes,smartArtUnavailable,SMART_ART_NAMES,type Arrangement,type ArrangementColor,type ArrangementNode,type ArrangementPaint,type SmartArtCandidate} from './arrangements.js';
export {ARROW_ADJUST,CHEVRON_ADJUST,FLOW_ROUND_ADJUST,LINEAR_ARRANGEMENTS,LINEAR_TEXT_MARGINS,SMART_ART_SCALES,chevronNodes,flowNodes,isLinearArrangement,linearDesign,linearMargins,linearNodes,OPF_ARROW_LENGTH,OPF_ARROW_ROOM,OPF_ARROW_THICKNESS,OPF_CHEVRON_DEPTH,OPF_COLUMN_ARROW_LENGTH,OPF_COLUMN_ARROW_THICKNESS,OPF_COLUMN_ROOM,OPF_LINES_MAX,verticalFlowNodes,type LinearArrangement,type LinearGeometry} from './linear-arrangements.js';
export {emphasisSurface, EMPHASIS_TEXT_MIN_CONTRAST, EMPHASIS_SURFACE_MIN_CONTRAST} from './color.js';
export type {EmphasisSurface} from './color.js';
export {BUILT_IN_MASKS, composeShape, ensureShapes, isPresetShape, isShapeBlock, presetAspect, presetMask, shapeIssues, shapesPending, shapeTextColor, stackedText, SHAPE_PRESETS, shapeStyleLook, translatePathData, DEFAULT_SHAPE_STYLE, PICTURE_STROKE_WIDTH, SHAPE_BLOCK_KEYS, SHAPE_EFFECT_KEYS, SHAPE_PADDING, SHAPE_STROKE_WIDTH, SHAPE_STYLES} from './shape-block.js';
export type {ComposedArrowhead, ComposedFill, ComposedGradient, ComposedShape, ComposedShapePath, ComposedStroke, ShapeEnd, ShapeStyleLook, ShapeStyleName} from './shape-block.js';
export {CONNECTOR_ROUTES, CONNECTOR_STANDOFF, CONNECTOR_STROKE_COLOR, CONNECTOR_STROKE_WIDTH, OVERLAY_ANCHOR_SHARE, OVERLAY_EDGES, OVERLAY_LAYERS, chooseConnectorSites, connectorAdjustPreset, connectorRoute, frameToSlide, hasOverlayShapes, isOverlayConnector, overlayIssues, rectSites, shapeSites, slideBlockIds} from './overlay-shapes.js';
export type {ComposedConnector, ComposedOverlayEntry, ComposedOverlayShape, ConnectionSite, ConnectorEnd, ConnectorFrame, ConnectorPreset, ConnectorRoute, ConnectorRouteGeometry, OverlayEdge, OverlayIssue, OverlayLayer} from './overlay-shapes.js';
export {applyLuminance, applyColorTransform, colorTransform, clrMapAttributes, colorMapFor, deckBackgroundIsFixed, isColorVariant, isFixedBackground, layoutColorVariant, layoutVariantApplies, normalizeColorVariant, readableSchemeColor, NEUTRAL_SHARES} from './color.js';
export {colorContrast, textColorForFill, chartColorForFill, chartPaletteForFill, chartSlicePlan, CHART_SLICE_MAX_SHIFT, CHART_SLICE_SEPARATOR_PX, type ChartSlicePlan, chartSchemeSeries, chartSeriesPalette, resolveChartColors, chartHighlightColors, chartEmphasisColors, softenChartPalette, chartSoftColors, applyHslTransforms, type ChartSoftColor, chartSeriesLabelColor, CHART_SERIES_SOFT_MIX, CHART_EMPHASIS_MIN_CONTRAST, CHART_EMPHASIS_MIN_LIGHTNESS_STEP, CHART_SERIES_TINT_MIX, CHART_DARK_SERIES_MIN_CONTRAST, CHART_LEAD_LIGHTNESS_STEP, normalizeHexColor, resolveColorRef, resolveColorRoles, defaultSlideBackground, isDarkColor, surfaceAltColor, tableHighlightColor, TABLE_HIGHLIGHT_MIX, CHART_SERIES_MIN_LIGHTNESS_STEP, CHART_SERIES_MIN_DIFFERENCE, CHART_SERIES_TIER_SIZE, CHART_HIGHLIGHT_MUTED_MIX, CHART_HIGHLIGHT_MUTED_MIN_CONTRAST, DARK_BACKGROUND_LUMINANCE, SURFACE_ALT_MIX, SURFACE_ALT_MIN_CONTRAST, CARD_SURFACE_MIX, CARD_SURFACE_MIN_CONTRAST, CARD_TEXT_MIN_CONTRAST, CARD_BORDER_MIX, CODE_PANEL_DARK_SHADE} from './color.js';
export type {ChartColorContext, ChartPaletteOptions, ColorAccentSlot, ColorBaseSlot, ColorMap, LayoutVariantDeck, LayoutVariantRole, ColorVariant, ColorVariantBackground, ColorVariantInput, SchemeColor, SchemeNeutrals, ResolveColorRefOptions, ResolveColorRefRoles, ResolveColorRolesOptions, ResolvedColorRoles} from './color.js';
export {resolveScriptFonts, resolveSlideDirection, scriptFontRole} from './script-fonts.js';
export {QUOTE_MARKS, ASCII_QUOTE_MARKS, quoteMarksFor, quoteLanguage, unwrapQuoteMarks, isWrappedInQuoteMarks, type QuoteMarks} from './quote-marks.js';
export type {ResolveScriptFontsOptions, ResolvedScriptFonts, ScriptFontApp, ScriptFontSlots, ScriptFontSource, ScriptFontSupplement, ScriptMeasurementProfile, ScriptRole} from './script-fonts.js';
export {CODE_HIGHLIGHT_LANGUAGES, CODE_HIGHLIGHT_MAX_LENGTH, CODE_PANEL_BACKGROUND, CODE_PANEL_FOREGROUND, CODE_SYNTAX_MIN_CONTRAST, codeLineRuns, codeSyntaxPalette, codeSyntaxPaletteForRoles, codeSyntaxPaletteForScheme, resolveCodeLanguage, tokenizeCode} from './code-syntax.js';
export type {CodeRun, CodeSyntaxPalette, CodeSyntaxPaletteOptions, CodeSyntaxPaletteTheme, CodeToken, CodeTokenKind} from './code-syntax.js';
export {METRIC_TREND_ARROW_GAP, METRIC_TREND_ARROW_SIZE, METRIC_TREND_MIN_CONTRAST, METRIC_TREND_SHAPES, METRIC_VALUE_MIN_CONTRAST, metricPillFill, metricTrendColor, metricTrendMark, metricTrendPoints, metricValueColor} from './metric-trend.js';
export type {MetricSentiment, MetricTrend, MetricTrendColorOptions, MetricTrendMark} from './metric-trend.js';
export {TIMELINE_OUTLINE_MIN_CONTRAST, TIMELINE_STATUSES, TIMELINE_TEXT_MIN_CONTRAST, timelineMarkerShapes, timelineTextColor} from './timeline-status.js';
export type {TimelineMarkerShape, TimelineStatusColors} from './timeline-status.js';
export {codeHighlightBands, codeHighlightColors, codeHighlightLines, codeLineNumbers} from './code-highlight.js';
export type {CodeHighlightBand, CodeHighlightColors, CodeHighlightEntry, CodeHighlightIssue, CodeHighlightLines} from './code-highlight.js';
export {layoutWatermark} from './watermark.js';
export type {WatermarkTextLayout, WatermarkTextOptions} from './watermark.js';
export {PATTERN_PRESETS, PATTERN_PRESET_ALIASES, PATTERN_TILE_SIZE, patternBitmap, patternRuns, resolvePatternPreset} from './pattern-fills.js';
import {CAPTIONABLE_FIELDS,CITATION_MARKER_RAISE,CITATION_MARKER_SCALE,FOOTNOTE_MAX_RATIO,annotationText,layoutCaption,runInHeading,layoutFootnotes,slideCitations,type ComposedCaption,type ComposedFootnotes,type RichText} from './annotations.js';
export {CAPTIONABLE_FIELDS,CAPTION_FONT_RATIO,CAPTION_MAX_RATIO,CITATION_MARKER_RAISE,CITATION_MARKER_SCALE,FOOTNOTE_MAX_RATIO,RUN_IN_HEADING_CHARS,annotationText,captionSettings,citationMarkerText,collectCitations,layoutCaption,layoutFootnotes,referencesSlide,runInHeading,slideCitations,walkCitationRuns} from './annotations.js';
import {layoutDiagram,type ComposedDiagram,type DiagramIssue,type DiagramMeasure} from './diagram.js';
import {composeShape,composeStroke,isPresetShape,isShapeBlock,presetAspect,presetMask,sketchStroke,stackedText,PICTURE_STROKE_WIDTH,SHAPE_BLOCK_KEYS,type ComposedShape,type ComposedStroke} from './shape-block.js';
import {composeOverlayShapes,hasOverlayShapes,type ComposedOverlayEntry} from './overlay-shapes.js';
import {ICON_VIEWBOX,documentIcons,iconColors,parseIconReference,placeIconCommands,resolveIcon,type IconPaint,type IconPart,type ResolvedIcon} from './icons.js';
export {ICON_CHIP_TINT,ICON_MIN_CONTRAST,ICON_VIEWBOX,documentIcons,embedIcons,ensureIcons,iconColors,iconFromSvg,iconPathCommands,iconPathData,iconsPending,nearIconNames,parseIconReference,placeIconCommands,resolveIcon,type IconCommand,type IconOptions,type IconPaint,type IconPart,type IconReference,type IconResolution,type IconSetIcon,type IconSetLoader,type IconSetRecord,type ResolvedIcon} from './icons.js';
export {DIAGRAM_BORDER_MIN_CONTRAST,DIAGRAM_LINE_MIN_CONTRAST,DIAGRAM_MAX_EDGES,DIAGRAM_SHAPE_FAMILIES,DIAGRAM_SECONDARY_FLOOR,DIAGRAM_SOURCE_LIMIT,DIAGRAM_SURFACE_ALT_MIX,DIAGRAM_SURFACE_MIX,DIAGRAM_SYNTAXES,checkDiagram,diagramPalette,diagramPayload,diagramsPending,ensureDiagrams,layoutDiagram,paintDiagram,paintDiagramGroup} from './diagram.js';
export type {ComposedDiagram,DiagramIssue,DiagramLayoutOptions,DiagramMeasure,DiagramPalette,DiagramPaletteInput,DiagramPayload,DiagramSyntax} from './diagram.js';
export type {AnnotatedRun,AnnotationFitter,AnnotationLayoutOptions,Caption,CaptionAlignment,CaptionObject,CaptionPosition,CaptionSettings,CitationMarker,CitationNote,ComposedCaption,ComposedFootnoteEntry,ComposedFootnotes,DeckCitations,FootnoteLayoutOptions,Reference,ReferencesSlideOptions,RichText,SlideCitations} from './annotations.js';
/** Portable layout geometry. No fonts, DOM, renderer, or network dependencies. */
export interface Composition {
  mode?: "auto" | "grid" | "row" | "column";
  columns?: number;
  gap?: number;
  padding?: number;
  weights?: number[];
  minFontSize?: number;
  /** LH-144: the largest body text size in reference pixels (paragraphs, lists, quotes, metrics, timelines); `paginate` sets it on continuation pages. */
  maxFontSize?: number;
  overflow?: "warn" | "error";
}
export const MAX_COMPOSITION_DEPTH = 32;
export interface LayoutBox { x: number; y: number; width: number; height: number }
export interface LayoutDiagnostic {
  /**
   * OPF 0.19 adds the content-binding codes of template layouts: `region-unknown`, `region-kind` and `region-full` for an
   * ignored `region` pin, and `layout-unplaced` for a block no region had room for (drawn anyway; `paginate` moves it).
   * LH-14: `icon-dropped` for an icon the slide has no room for without setting text smaller: the text stays, the chip is not drawn.
   * SH-09: `arrangement-adapted` for a pyramid or matrix drawn another way: a matrix of other than four entries as cards, or a list the
   * arrangement's designs cannot hold at the list's size (or of a shape it does not draw) as a list.
   */
  code: "text-overflow" | "small-cell" | "unresolved-content" | "unsupported-image-treatment" | "numbering-adapted" | "region-unknown" | "region-kind" | "region-full" | "layout-unplaced" | "emphasis-ignored" | "icon-dropped" | "arrangement-adapted";
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
/**
 * A diagram item's drawing: the layout `layoutDiagram` chose for the block and where it is drawn. Engines paint `svg` with
 * `paintDiagram` in the slide's `diagramPalette` at `box`, which is the drawing's size contained in the item box and placed by its
 * anchor. An item whose source cannot be drawn has `issue` instead and draws the unavailable-content placeholder.
 */
export interface ComposedDiagramItem extends Partial<ComposedDiagram> {
  box: LayoutBox;
  issue?: DiagramIssue;
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
  /**
   * LH-63: the runs a plain `text` block draws when its first line is a run-in heading (`runInHeading`): the same characters as `value`, the heading
   * bold. Engines draw and export these runs (`text` is their rich fit); absent, the block draws `value`.
   */
  runs?: RichText;
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
  /** SH-02: the drawing of a shape block (`field` shape, shape-block.ts ComposedShape); `text` is its text, fitted in `shape.textBox`. Absent on every other item. */
  shape?: ComposedShape;
  /**
   * RR-92: the value axis of a column, bar, line or area chart (`field` chart), computed from the chart box (`chartValueAxis`). The preview
   * draws it and the PPTX export writes it as `c:min`, `c:max` and `c:majorUnit`, so both show the same axis. Absent for every other chart
   * type (combo, scatter, pie and the rest keep the engines' own axis) and for charts whose data does not resolve.
   */
  chart?: ComposedChart;
  /** The drawing of a diagram item (`field` diagram); absent on every other item. */
  diagram?: ComposedDiagramItem;
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
 * text. `source`: `authored` for `emphasis: true`, else the automatic rule that made it (`foot-band`, `pill`, and LH-131's `featured` card
 * of a pair or a set, a `card` like an authored one).
 */
export interface ComposedEmphasis {
  path: string;
  box: LayoutBox;
  radius: number;
  shape: 'card' | 'band' | 'pill';
  source: 'authored' | 'foot-band' | 'pill' | 'featured';
  /**
   * LH-131: a featured before and after pair of metrics side by side: the arrow from the first card to this one, in the room between them.
   * Engines draw it as LH-07 draws a flow's arrows: an accent (`primary`) block arrow filling `box` and pointing to `direction`, as
   * DrawingML's `rightArrow` (`leftArrow`) preset draws it with its default adjustments.
   */
  arrow?: { box: LayoutBox; direction: 'left' | 'right' };
}
/**
 * LH-07: one drawn sequence of a `sequence` region (layout record): what the engines draw besides its text, in canvas pixels.
 * - `row`: the region's blocks side by side, each under a badge; `connector` runs through the badge centers of the row.
 * - `column`: a list's entries, each beside a badge in the list's marker column; `connector` runs down that column.
 * - `flow`: a short list's entries in `chips` (one per entry; its text is the list column of the same index) with `arrows` between.
 * - `tiles` (LH-137): a dark slide's short summary list as a grid of `chips` (one per entry, its text the list column of the same
 *   index), each with a badge at its start whose `check` mark stands in for the bullet; no connector or arrows.
 * Paint order: chips, connector, badges, arrows, then the text. A badge is an accent (`primary`) circle of `radius` around
 * (`cx`, `cy`) with its `label` centered on it in the bold body face at `fontSize`, its baseline at `baseline`, in the scheme
 * color readable on the accent (`readableSchemeColor`); the connector is a `border` colored line `lineWidth` wide; a chip is a card
 * (`neutrals.card` fill, `cardBorder` line) with corner `radius`; an arrow is an accent block arrow filling its `box` and pointing
 * to `direction`, as DrawingML's `rightArrow` (`leftArrow`) preset draws it with its default adjustments: a shaft half the box's
 * height, a head as long as half the box's smaller side. In a right-to-left deck a row's badges sit at the start (right) of their
 * blocks and a flow runs right to left; a list's badges sit on the side each entry's paragraph starts, as its markers would.
 */
export interface ComposedSteps {
  form: 'row' | 'column' | 'flow' | 'tiles';
  /**
   * The `sequence` region. `tiles` (LH-137's check-mark tiles, LH-165's icon cards, LH-162's text tiles): the list's region, or empty on a
   * slide without a layout. A tile is a chip (one card each, in the card surface); its badges are LH-137's check marks, LH-165's numerals
   * (`numeral`) or LH-162's accent dots (a badge with an empty label).
   */
  region: string;
  /** `row`: the region's first block; `column`, `flow` and `tiles`: the list's payload path (LH-165's groups: the first group's; LH-162: the first paragraph's). */
  path: string;
  badges: ComposedStepBadge[];
  connector?: { x1: number; y1: number; x2: number; y2: number };
  chips?: { path: string; box: LayoutBox; radius: number }[];
  arrows?: { box: LayoutBox; direction: 'right' | 'left' }[];
  lineWidth: number;
}
/**
 * SH-09: one pyramid or matrix of an `arrangement` region (layout record), in canvas pixels: a lone list of one level whose entries are
 * the nodes (arrangements.ts has the geometry, PowerPoint's Basic Pyramid and Basic Matrix). Each entry is a list column
 * (ComposedItem.listColumns) centered in its node's text rectangle at `fontSize`, the list's size or larger. Engines draw, under the
 * text: the matrix's `background` diamond, then every node (a matrix's empty quadrants too) filled in the primary color with a
 * `lineWidth` outline in the background color (arrangementPaint). `smartArt` holds what the PPTX export checks against the domain
 * PowerPoint was compared on (smartArtUnavailable): each entry's line count and whether its line breaks hold when its width changes by
 * SMART_ART_DOMAIN.slack.
 */
export interface ComposedArrangement {
  kind: Arrangement;
  /**
   * `smartart`: PowerPoint's Basic Pyramid or Basic Matrix geometry (the PPTX export may write it as live SmartArt); `opf`: OPF's own design
   * of the arrangement (a stepped pyramid with the entries beside it, or four quadrants filling the region); `cards`: a matrix of other
   * than four entries, as a grid of cards. Only `smartart` has a `background` diamond (a matrix).
   */
  design: 'smartart' | 'opf' | 'cards';
  /** OPF's design (`opf`): why PowerPoint's design was not drawn (its entries do not fit at the list's size, or the SmartArt domain's reason). */
  instead?: string;
  /** The entries' alignment in their text rectangles: centered on their nodes, or at the start edge (beside a level, in a card). */
  align: 'center' | 'start';
  /** The nodes' paint: the primary with a background-colored outline (arrangementPaint), or the card neutral with its border (a card grid). */
  paint: 'primary' | 'card';
  /** The entries' text color: the color that reads on the primary (`node`), or the slide's text color (`slide`: beside a level, on a card). */
  text: 'node' | 'slide';
  region: string;
  /** The list's payload path. */
  path: string;
  frame: LayoutBox;
  /** The matrix's diamond (its square). */
  background?: LayoutBox;
  /** The nodes in order (a matrix always has four); `path` is the entry's text path, absent for an empty quadrant. */
  nodes: (ArrangementNode & { path?: string })[];
  /** SH-18: a cycle's arrows, the one after each node to the next (arrangements.ts cycleNodes, cycleRing), drawn after their node in the primary lightened (arrangementPaint's `arrow`); SH-17: a flow's, the one after each box (linear-arrangements.ts). */
  arrows?: ArrangementArrow[];
  fontSize: number;
  /** The text inset inside each node's text rectangle (ARRANGEMENT_TEXT_MARGIN of the size). */
  textMargin: number;
  /** SH-17: the text insets (left, top, right, bottom) where they differ by side (a chevron's start); absent: `textMargin` on every side. */
  margins?: [number, number, number, number];
  lineWidth: number;
  smartArt: { lines: number[]; stable: boolean[]; fill?: number; ink?: number; widest?: number };
  /**
   * SH-19: OPF's own design (`opf`, `cards`): the inputs that draw it for any count (smart-art-layout.ts opfLayoutGeometry), from which the
   * PPTX export writes OPF's SmartArt layout definition of it.
   */
  layout?: OpfLayoutRecipe;
}
/**
 * LH-07: one numbered circle of a sequence (`ComposedSteps.badges`); `path` is the step's block (`row`) or list entry (`column`).
 * `list` names the list entry whose number the badge draws in place of its marker (its payload path, the entry's index and the
 * number), so an exporter can keep the list's numbering; absent when the badge numbers a block by its position or the list has no
 * `numbering` of its own (a list of a `steps` region is then counted in arabic).
 *
 * LH-134: a badge with a `numeral` is a numeral beside a ruled row (ListFitOptions.numerals), drawn without a circle: its label bold in the
 * body face at `fontSize`, in the accent (the tag's color: the text color where the primary reads under 4.5:1 on the slide), centered
 * on `cx` at `baseline`; `numeral` is its line box (the export's text box) and `radius` half its column's width. Its column has no connector.
 */
/**
 * One badge of a sequence (ComposedSteps). LH-137: a badge with `check` draws a check mark in place of its label (which is empty): the
 * polygon `check` (canvas pixels, checkMarkPoints) filled in the badge's label color.
 */
export interface ComposedStepBadge { path: string; cx: number; cy: number; radius: number; label: string; fontSize: number; baseline: number; list?: { path: string; index: number; number: Pick<ListNumber, 'value' | 'style' | 'suffix'> }; check?: [number, number][];
  /** LH-134: a numeral beside a ruled row: the line box of its text, drawn without a circle. */
  numeral?: LayoutBox }
/**
 * LH-14: one icon the slide draws (`SlideComposition.icons`), on a chip as Claude Design draws one: a circle of `radius` around
 * (`cx`, `cy`) in `colors.chip`, and the glyph in `box` (ICON_GLYPH of the chip's diameter, centered on it). A monochrome icon is
 * `parts`, path commands already placed in canvas pixels (each filled, stroked at `stroke` canvas pixels with its caps and joins, or
 * both) in `colors.glyph`; a multicolor SVG is `picture`, drawn contained in `box` with its own colors. `path` is the `icon` field's
 * path, `owner` the list entry, metric or group it marks. Paint order: after the cards and surfaces, before the text.
 */
export interface ComposedIcon {
  path: string;
  owner: string;
  reference: string;
  chip: { cx: number; cy: number; radius: number };
  box: LayoutBox;
  parts?: IconPart[];
  picture?: { svg: string; width: number; height: number };
  colors: { chip: IconPaint; glyph: IconPaint };
}
/**
 * LH-14: an icon's chip is this many times the size of the text it accompanies across (a list entry's size, the first paragraph of a
 * group, a metric's label role): STEP_BADGE, so an icon list keeps a step list's column. Its glyph is ICON_GLYPH of the chip.
 */
export const ICON_CHIP = 1.75, ICON_GLYPH = .55;
/**
 * LH-14: the compact chip, one line of the text it accompanies (1.22 em), which never makes an entry, a metric's band or a group's band
 * taller than a line: what a slide draws when the full chips (the guarded rule `icon-chips`) would set a block smaller.
 */
export const ICON_CHIP_COMPACT = 1.22;
/** LH-14: the space between a chip of a metric or a group and the text under it, as a share of the chip's diameter. */
export const ICON_CHIP_GAP = .3;
/** LH-14: the text size a metric's chip is sized for, in reference pixels (about its label's): a 42 px chip at 1280 x 720. */
export const METRIC_ICON_TEXT = 24;
/** LH-137: the check-mark tiles of a summary list: the fewest and most entries, and the longest entry in characters. */
export const CHECK_TILE_MIN = 2, CHECK_TILE_MAX = 6, CHECK_TILE_MAX_CHARACTERS = 90;
/** LH-137: the most lines an entry may take in a tile of the grid before the tiles become one column of wide tiles. */
export const CHECK_TILE_MAX_LINES = 2;
/**
 * LH-165: icon cards. A list of ICON_CARD_MIN to ICON_CARD_MAX entries of one level, each with an icon, a label of at most
 * ICON_CARD_LABEL_CHARACTERS and ICON_CARD_LABEL_WORDS words and an optional description of at most ICON_CARD_DESCRIPTION_CHARACTERS.
 */
export const ICON_CARD_MIN = 2, ICON_CARD_MAX = 8, ICON_CARD_LABEL_CHARACTERS = 48, ICON_CARD_LABEL_WORDS = 7, ICON_CARD_DESCRIPTION_CHARACTERS = 160;
/** LH-165: a card's description is this share of its label's size (as a ruled row's, LH-08), never under the floor. */
export const ICON_CARD_DESCRIPTION = .82;
/**
 * LH-165: the share of its card the tallest card's text may take as it grows (LONE_METRIC_TARGET, as a lone metric fills its card), or more
 * while the grid's text still covers at most LONE_TARGET of the body (LH-48's fill): the text fills its cards instead of floating in them, up
 * to COMPACT_GRID_DISPLAY.
 */
export const ICON_CARD_FILL = .8;
/**
 * LH-162: text tiles. TEXT_TILE_MIN to TEXT_TILE_MAX paragraphs at the root of an automatic slide, each of at most TEXT_TILE_CHARACTERS on one
 * line of source, set on at most TEXT_TILE_LINES lines in its tile, beside a dot in the accent TEXT_TILE_MARKER of the text size across.
 */
export const TEXT_TILE_MIN = 4, TEXT_TILE_MAX = 8, TEXT_TILE_CHARACTERS = 90, TEXT_TILE_LINES = 2, TEXT_TILE_MARKER = .45;
/**
 * LH-165, LH-162: the column counts of the balanced grids of `count` equal cards: two to four cards a row, at most four rows, every row
 * full but the last, which is at most one card short and never a lone card under full rows.
 */
export function cardGridColumns(count: number): number[] {
  const shapes: number[] = [];
  for (let columns = 2; columns <= Math.min(4, count); columns++) {
    const rows = Math.ceil(count / columns), last = count - (rows - 1) * columns;
    if (rows <= 4 && last >= columns - 1 && (rows === 1 || last >= 2)) shapes.push(columns);
  }
  return shapes;
}
/**
 * LH-137: a check mark inside a badge of `diameter` centered on (cx, cy): a solid polygon (a short and a long stroke, each about a seventh
 * of the badge thick) in the inner 56% of the badge, the same points for the preview's path and the PPTX export's custom geometry.
 */
export function checkMarkPoints(cx: number, cy: number, diameter: number): [number, number][] {
  const side = .56 * diameter, left = cx - side / 2, top = cy - side / 2;
  const unit: [number, number][] = [[0, .52], [.17, .35], [.38, .56], [.83, .11], [1, .28], [.38, .9]];
  return unit.map(([x, y]) => [Math.round((left + x * side) * 100) / 100, Math.round((top + y * side) * 100) / 100]);
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
/**
 * A frame mask (SH-02: any of the 187 DrawingML presets). `path` is SH-01's evaluated preset outline at the frame, in reference pixels;
 * `kind` and `preset` are the preset name.
 */
export interface ImageShape {
  kind: string;
  preset: string;
  /** DrawingML avLst guide values the block set (for example adj), in 1/100000 units or 60000ths of a degree. */
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
  /** SH-02: the line along the shape outline (`stroke`, renamed from `border`); width in reference pixels, already scaled to the canvas. */
  stroke?: ComposedStroke;
  /** Picture opacity below 1; the stroke and overlay are not affected. */
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
  /** LH-158: the background's `textPlacement`, when the author picked where a heading group goes on the picture (SlideComposition.pictureText). */
  textPlacement?: PictureTextPlacement;
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
   * composition sets them in a column beside it (kpiColumn), the chart's plot at least as tall. LH-165: `cards` when a layout's lone list with
   * icons draws its icon cards across the body under the heading (withCards), its text at least as large as in the layout.
   */
  recomposed?: { layoutSize: number; size: number; chart?: { layoutPlot: number; plot: number }; kpis?: true; table?: true; cards?: true };
  /** LH-06: the slide's emphasis surface (at most one), when a block or group asks for it or an automatic rule gives one. */
  emphasis?: ComposedEmphasis;
  /** LH-07: the step badges, connectors and flows of the slide's `sequence` regions, in reading order; absent when none draws. */
  steps?: ComposedSteps[];
  /** LH-14: the icons the slide draws on chips (list entries, metrics, groups), in reading order; absent when none draws. */
  icons?: ComposedIcon[];
  /** SH-09: the pyramids and matrices of the slide's `arrangement` regions, in reading order; absent when none draws. */
  arrangements?: ComposedArrangement[];
  /**
   * LH-130: the short accent rule above the title that the layout's `title` region asks for (`rule: true`) on a slide with a title and
   * no tag: `box` in canvas pixels (TITLE_RULE_SIZE), at the title's start edge (its alignment, mirrored for a right-to-left title),
   * half a gap above it; `path` is the title's. Engines fill it in the tag's color: the primary, or the text color where the primary
   * is under 4.5:1 on the slide's backdrop. Absent otherwise.
   */
  titleRule?: { path: string; box: LayoutBox };
  /**
   * LH-158: where the heading group of a sized title area (a cover, a section) sits on a picture background, with every candidate
   * placement and its score on the host's measured grid (`pictureLuminance`), so an editor or host can offer the others. Present when
   * the picture was measured or the background names a `textPlacement`; absent otherwise (the group then sits as wave 6 put it).
   */
  pictureText?: PictureText;
  /** LH-164: why the slide is drawn on the accent surface (ComposeSlideOptions.messageSurface), echoed so a host can show the reason; absent on a slide with the deck's own surface. */
  surface?: MessageSurface;
  /**
   * LH-80, LH-49: automatic composition gave the slide's one picture (`picture`) or one chart (`chart`) a full-height track of its own
   * at `edge` (physical), `size` of the slide's width (left, right) or height (top, bottom); `path` is the block's. A picture's track
   * bleeds to the slide edges (its `image.placement` is `automatic`); a chart's is the root's first or last column. Absent otherwise.
   */
  track?: { kind: 'picture' | 'chart'; edge: ImageEdge; size: number; path: string };
  /**
   * SH-04: the slide's overlay (`shapes`), in draw order over everything else: overlay shapes (`kind` shape, a shape block item with
   * `path` slides.N.shapes.I) and connectors (`kind` connector, PowerPoint's connector preset in its frame and the route in slide
   * coordinates). Placed on the final composition, so it never moves content. Absent on a slide without `shapes`.
   */
  overlayShapes?: ComposedOverlayEntry[];
  explanation?: CompositionExplanation;
}
/**
 * LH-164: a slide whose whole body is one display message takes the layout's accent surface (messageSurface in message-surface.ts).
 * `kind` is the LH-09 rule that made the body one message: `statement-message` (a statement record's message) or `display-message` (a
 * lone short text grown to display size); `variant` is the color variant the slide is drawn on (an accent slot, the deck's accent order).
 */
export interface MessageSurface {
  kind: 'statement-message' | 'display-message';
  variant: ColorVariant;
}
export interface ComposeSlideOptions {
  /** Context for inherited furniture, generated organization names, social profiles, logos, layout hints, references and marker numbering. */
  presentation?: { language?: unknown; design?: { header?: unknown; footer?: unknown; background?: unknown; imageFit?: unknown; logo?: unknown; contentDirection?: unknown; chartPrimary?: unknown; listBullet?: unknown; titleAlignment?: unknown; contentAlignment?: unknown; contentBox?: unknown; mirror?: unknown }; organization?: unknown; speaker?: unknown; slides?: unknown; catalogs?: unknown; references?: unknown; datasets?: unknown; icons?: unknown; assets?: unknown };
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
   * LH-164: the accent surface this slide was given because its whole body is one display message (resolveSlideContext's
   * `resolved.messageSurface`, which also drew `roles` and `darkBackground` for it). Composition draws nothing for it and reports it as
   * `SlideComposition.surface`, so an editor or host can say why the slide is not on the deck's plain surface.
   */
  messageSurface?: MessageSurface;
  /**
   * LH-164: resolves a run color the author wrote (a hex, a role, a scheme slot, `var:`, or SH-02's lighter or darker `{ color, lighten|darken }`)
   * to the hex the engines draw, for the slide's roles and variables; `resolveSlideContext` passes it with `messageSurface`, so a color that does
   * not read on the surface can be drawn in one that does.
   */
  resolveRunColor?: (reference: unknown) => string | undefined;
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
// SH-02: `shape` and `path` make a shape block (isShapeBlock); on an image block `shape` is the frame's mask, never a leaf of its own.
const fields = ["text", "items", "bullets", "image", "video", "chart", "table", "code", "metric", "quote", "timeline", "diagram", "shape", "path"];
const leafFields = (host: Record<string, any>) => fields.filter(field => host[field] !== undefined && field !== 'shape' && field !== 'path');
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
const IMAGE_OPTION_KEYS = ['fit', 'focus', 'aspectRatio', 'shape', 'adjust', 'stroke', 'opacity', 'recolor', 'overlay', 'placement', 'portrait'] as const;
const imagePayload = (host: Record<string, any>): Record<string, unknown> => {
  const payload: Record<string, unknown> = { type: host.type ?? 'image', image: host.image };
  for (const key of IMAGE_OPTION_KEYS) if (host[key] !== undefined) payload[key] = host[key];
  return payload;
};
const assetSource = (value: unknown): unknown => typeof value === 'string' ? value : record(value).src;
/** SH-02: the payload a composed shape item reports: the block's shape keys and its text. */
const SHAPE_PAYLOAD_KEYS = ['shape', 'adjust', 'stroke', 'opacity', 'aspectRatio', 'text', ...SHAPE_BLOCK_KEYS] as const;
const shapePayload = (host: Record<string, any>): Record<string, unknown> => {
  const payload: Record<string, unknown> = { type: 'shape' };
  for (const key of SHAPE_PAYLOAD_KEYS) if (host[key] !== undefined) payload[key] = host[key];
  return payload;
};
const finite = (value: unknown, min: number, max: number): number | undefined => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : undefined;
const pathNumber = (value: number) => String(round(value));
const roundBox = (box: LayoutBox): LayoutBox => ({ x: round(box.x), y: round(box.y), width: round(box.width), height: round(box.height) });
/** SH-02: an image frame's mask: any of the 187 presets, with the block's adjust values (OPF units), from SH-01's geometry (shape-block.ts presetMask). */
export function imageShape(preset: string, box: LayoutBox, adjust?: Record<string, number>): ImageShape {
  return presetMask(preset, box, adjust);
}
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
export function imageBackground(value: unknown): { src: string; alt?: string; fit: BackgroundImageFit; focus: ImageFocus; opacity?: number; recolor?: unknown; overlay?: unknown; textPlacement?: PictureTextPlacement } | undefined {
  if (typeof value === 'string') return IMAGE_SOURCE.test(value) ? { src: value, fit: 'cover', focus: { x: 0.5, y: 0.5 } } : undefined;
  const background = record(value);
  if (background.type !== 'image' || typeof background.src !== 'string' || !background.src) return undefined;
  const opacity = finite(background.opacity, 0, 1);
  return {
    src: background.src, ...(typeof background.alt === 'string' ? { alt: background.alt } : {}),
    fit: (BACKGROUND_FITS as readonly unknown[]).includes(background.fit) ? background.fit : 'cover', focus: imageFocus(background.focus),
    ...(opacity !== undefined ? { opacity } : {}), ...(background.recolor !== undefined ? { recolor: background.recolor } : {}), ...(background.overlay !== undefined ? { overlay: background.overlay } : {}),
    ...((PICTURE_TEXT_PLACEMENTS as readonly unknown[]).includes(background.textPlacement) ? { textPlacement: background.textPlacement as PictureTextPlacement } : {}),
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
  if (edge && shape.preset !== 'rect') {
    diagnostics.push({ code: 'unsupported-image-treatment', path: `${path}.edge`, message: 'An edge overlay needs a rectangle frame; a band cannot follow another preset mask as one native shape. Remove edge or use shape rect.' });
    return undefined;
  }
  const part = finite(overlay.size, 0.05, 1) ?? 0.3;
  const box = !edge ? frame : edge === 'top' ? { ...frame, height: round(frame.height * part) }
    : edge === 'bottom' ? { ...frame, y: round(frame.y + frame.height * (1 - part)), height: round(frame.height * part) }
    : edge === 'left' ? { ...frame, width: round(frame.width * part) }
    : { ...frame, x: round(frame.x + frame.width * (1 - part)), width: round(frame.width * part) };
  return { path, color: overlay.color, opacity, ...(edge ? { edge } : {}), box, shape: edge ? imageShape('rect', box) : shape };
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

// One diagram measure per host measurement and family pair, so layoutDiagram's cache (keyed by the measure) holds across the many
// compositions a slide tries.
const diagramMeasures = new WeakMap<object, Map<string, DiagramMeasure>>();
const NO_MEASUREMENT = {};
function diagramMeasure(measurement: TextMeasurement | undefined, body: string, code: string): DiagramMeasure {
  let byFamilies = diagramMeasures.get(measurement ?? NO_MEASUREMENT);
  if (!byFamilies) {
    byFamilies = new Map();
    diagramMeasures.set(measurement ?? NO_MEASUREMENT, byFamilies);
  }
  const key = `${body}\u0000${code}`;
  let measure = byFamilies.get(key);
  if (!measure) {
    const widths = new Map<string, MeasureTextWidth>();
    measure = (text, size, style) => {
      const variant = `${style.bold ? 7 : 4}${style.italic ? 'i' : ''}${style.mono ? 'm' : ''}`;
      let width = widths.get(variant);
      if (!width) {
        width = textWidthMeasurer(resolveTextStyle({ fontFamily: style.mono ? code : body, fontWeight: style.bold ? 700 : 400, italic: style.italic }, measurement), measurement);
        widths.set(variant, width);
      }
      return width(text, size);
    };
    byFamilies.set(key, measure);
  }
  return measure;
}

/**
 * Picture geometry of one image block in its region (FA-22): the frame (the frame area, then the aspect ratio), the mask,
 * the line, opacity, recolor and overlay: the treatments 0.14 drew on the slide picture, applied to image blocks.
 */
function composeImage(host: Record<string, any>, hostPath: string, region: LayoutBox, frameArea: LayoutBox, context: { fit?: ImageFitOption; scale: number; mirrorSide: (side: string) => string; diagnostics: LayoutDiagnostic[]; assets: unknown; placement?: ComposedPlacement; anchor?: RegionAnchor }): ComposedImage {
  const kindName = isPresetShape(host.shape) ? host.shape : 'rect';
  const { scale } = context;
  const requested: ImageFitOption = (IMAGE_FITS as readonly unknown[]).includes(host.fit) ? host.fit : context.fit ?? 'cover';
  // LH-80 with LH-104: an automatic track is a frame the engine chose to crop the picture into, so `auto` covers it there.
  const decided: ImageFitOption = requested === 'auto' && context.placement?.automatic ? 'cover' : requested;
  const size = intrinsicImageSize(host.image, context.assets), pictureAspect = size ? size.width / size.height : undefined;
  let box: LayoutBox = { ...frameArea };
  const aspect = kindName === 'ellipse' ? 1 : finite(host.aspectRatio, Number.MIN_VALUE, 10);
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
  const shape = imageShape(kindName, box, record(host.adjust));
  const result: ComposedImage = { region: roundBox(region), box, fit, ...(requested === 'auto' ? { autoFit: true as const } : {}), focus, shape };
  // SH-02: the picture's line takes the whole stroke vocabulary; a stroke without a color is the slide's neutral line (engines' border color).
  const stroke = host.stroke === undefined ? undefined : composeStroke(host.stroke, scale, { width: PICTURE_STROKE_WIDTH, join: 'miter' });
  if (stroke) {
    sketchStroke(stroke, [{ d: shape?.path ?? `M${box.x} ${box.y}H${box.x + box.width}V${box.y + box.height}H${box.x}Z`, stroke: true }], box, scale);
    result.stroke = stroke;
  }
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
/** LH-158: the picture backgrounds whose authored record has an `overlay` key. */
const OVERLAY_KEYED = new WeakSet<ComposedBackgroundImage>();
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
  const overlay = composeOverlay(background.overlay, box, imageShape('rect', box), `${at}.overlay`, mirrorSide, diagnostics);
  if (overlay) result.overlay = overlay;
  // LH-158: an `overlay` key (an overlay of the author's, or `false`) leaves no automatic scrim and no panel to place text with.
  if (background.overlay !== undefined) OVERLAY_KEYED.add(result);
  if (background.textPlacement) result.textPlacement = background.textPlacement;
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
  // LH-38: the header and the footer sit half a content margin from the slide edge (28.8 px at the default 8% padding of a 720 px short edge), nearer
  // the edge than the content so they read as chrome, and the same distance at the top and the bottom; zones stay on the content inset sideways.
  const edge=Math.min((settings.padding??.08)*Math.min(width,height),width*.25)/2;
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
    const top=kind==='header'?edge:Math.max(edge,height-edge-tallest);
    if(kind==='header')headerBottom=top+tallest;else footerTop=top;
    for(const zone of zones)for(const part of zone){
      part.box.y+=top;
      if(part.type==='text'&&part.fit.placement)for(const line of part.fit.placement.lines){line.y+=top;line.baseline+=top;if(line.outline)line.outline.y+=top;}
      if(part.box.y+part.box.height>height-edge+.01)error(part.path,'Repeated header/footer content extends beyond the usable slide height. Change its content or design before pagination.');
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
/** The largest base size of a diagram's node labels, in reference pixels: a small diagram grows to the size of a list. */
export const DIAGRAM_NOMINAL_SIZE = 32;
/** WI-4: a quote body asks for 40 px and fits down (to 28 px and below); a code body asks for 22 px and fits down to the floor. */
export const QUOTE_NOMINAL_SIZE = 40, CODE_NOMINAL_SIZE = 22;
/**
 * The largest inset between a content card's edge and its payload, in reference pixels: a card insets a sixteenth of its shorter side,
 * at least the former 12 px and at most this. 24 px (36 px at 1080) follows the ~40 px card padding of Claude's Slides type.
 */
export const CARD_INSET = 24;
/** LH-131: the inset of one card around a featured set's cell in a design with cards: the smallest inset of a block's own card. */
export const CELL_CARD_INSET = 12;
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
export interface QuoteContent { text: string | readonly (string | RichTextRun)[]; attribution?: string; role?: string; photo?: unknown; source?: string; /** LH-132: how the photo is drawn; composeSlide decides when absent. */ portrait?: 'avatar' | 'side' }
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
  /** Square frame, in reference pixels (LH-132: a tall one for a portrait beside the quote). */
  box: LayoutBox;
  /** Circle mask: the `ellipse` DrawingML preset and the same outline as an SVG path, as an image block's shape 'circle'. LH-132: a portrait beside the quote is a rounded rectangle (`roundRect`). */
  shape: ImageShape;
  /** LH-132: the point a portrait beside the quote keeps in view as it crops to cover its frame (the upper third); absent, a centered crop. */
  focus?: ImageFocus;
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
  /**
   * LH-78: the decorative quotation mark at the start edge of the top of a quote on a card (`markQuote`), drawn in the deck's primary color (against the
   * card, as a metric's value is) by both engines, in the card's padding above the quote's text: it takes no room from the quote.
   */
  mark?: QuoteMark;
  diagnostics: QuoteLayoutDiagnostic[];
  overflow: boolean;
}
/** LH-78: a quote's decorative mark: one glyph, fitted like any quote part (its box, fit and style are the engines' to draw). */
export interface QuoteMark {
  /** `<quote path>.mark`: generated, with no source field. */
  path: string;
  text: string;
  box: LayoutBox;
  fit: TextFit;
  style: TextStyle;
  requestedStyle: TextStyle;
  /** The quote's own opening mark that is not drawn because this mark stands for it (the body text starts after it); absent when the body kept its own. */
  hidden?: string;
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
/**
 * LH-129: the largest size, in reference pixels, a heading of a slide whose headings are its message (a cover, a section, a closing)
 * grows to: the title to about Claude Design's 78 px display title, the subtitle two steps of the type scale above its role size. The
 * tag is LH-32's eyebrow, already set at its EYEBROW_TAG_SIZE role size (22 px), which is its display size too: it keeps that size
 * (wave 5; LH-129 alone grew a 16 px tag to 21 px).
 */
export const HEADING_DISPLAY_SIZES = { title: 75, subtitle: 37, tag: EYEBROW_TAG_SIZE } as const;
/**
 * LH-130: the short accent rule a layout's `title` region asks for (`rule: true`), in reference pixels: Claude Design's cover draws an
 * 80 by 5 px bar in the accent half a gap above a start-aligned display title. It stands where the eyebrow would, so a slide with a tag
 * draws the tag instead.
 */
export const TITLE_RULE_SIZE = { width: 80, height: 5 } as const;
/**
 * LH-129: `size` (canvas px) grown by `steps` steps of the type scale (the floor `floorPx` times (28/16)^(1/4) to a power, as LH-17's
 * scale), each step the scale's next size above the last, stopping before a step above `display`.
 */
function typeScaleStepsUp(size: number, steps: number, display: number, floorPx: number, scale: number): number {
  const ratio = (PROSE_NOMINAL_SIZE / 16) ** .25;
  let grown = size;
  for (let step = 0; step < steps; step++) {
    let next = Infinity;
    for (let power = 0; power < 64; power++) { const candidate = snapFontSizeDown(Math.round(floorPx * ratio ** power) * scale); if (candidate > grown + 1e-9) { next = candidate; break; } }
    if (next > display + 1e-9) break;
    grown = next;
  }
  return grown;
}
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
  /**
   * LH-132: `side` draws the photo as a tall picture at the start of the quote (QUOTE_PORTRAIT_SHARE of its width) with the text beside
   * it, centered against it, instead of the avatar beside the attribution. Composition sets it for a wide quote or the quote's `portrait`;
   * a box too small for the picture keeps the avatar.
   */
  portrait?: 'side';
  /** LH-132: the share of the quote's width the portrait beside it takes (); QUOTE_PORTRAIT_SHARE when absent. */
  portraitShare?: number;
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
  // LH-132: a portrait beside the quote. The picture takes QUOTE_PORTRAIT_SHARE of the width at the start edge, at most
  // PORTRAIT_TALLEST.side tall for its width and never taller than the box (a box that leaves it flatter than PORTRAIT_WIDEST narrows it);
  // the quote without its photo is laid out in the rest, the shorter of the two is centered against the taller, and both in the box. A picture under
  // PORTRAIT_MIN.side wide, or a text column under PORTRAIT_MIN.text, keeps the avatar.
  if (options.portrait === 'side' && photoValue !== undefined) {
    const between = QUOTE_PORTRAIT_GAP * scale;
    let width = box.width * (options.portraitShare ?? QUOTE_PORTRAIT_SHARE);
    const height = Math.min(box.height, width / PORTRAIT_TALLEST.side);
    if (height * PORTRAIT_WIDEST < width) width = height * PORTRAIT_WIDEST;
    const textWidth = box.width - width - between;
    if (width >= PORTRAIT_MIN.side * scale && textWidth >= PORTRAIT_MIN.text * scale) {
      const rtlSide = options.direction === 'rtl', {portrait: _side, portraitShare: _share, ...rest} = options;
      const text = layoutQuote({...(quote as QuoteContent), photo: undefined}, {x: rtlSide ? box.x : box.x + width + between, y: box.y, width: textWidth, height: box.height}, rest);
      const textHeight = text.bounds.height, content = Math.max(height, textHeight), top = box.y + Math.max(0, (box.height - content) / 2), shift = top - box.y + (content - textHeight) / 2;
      if (shift > .01) for (const part of text.parts) { part.box = {...part.box, y: part.box.y + shift}; if (part.fit) part.fit = translateTextFit(part.fit, shift); }
      const frame = {x: rtlSide ? box.x + box.width - width : box.x, y: top + (content - height) / 2, width, height};
      const photo: QuotePhoto = {path: `${options.path ?? 'quote'}.photo`, value: photoValue, box: frame, shape: imageShape('roundRect', frame, {adj: Math.min(.5, CARD_RADIUS * scale / Math.min(width, height))}), focus: portraitFocus()};
      return {...text, bounds: {x: box.x, y: top, width: box.width, height: content}, photo};
    }
  }
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
      if (selected.photoBox) photo={path:photoPath,value:photoValue,box:selected.photoBox,shape:imageShape('ellipse',selected.photoBox)};
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
      if (photo) { photo.box.y += shift; photo.shape = imageShape('ellipse', photo.box); }
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

/**
 * LH-78: a quote on a card draws a decorative quotation mark at the start edge of the card's top, in the primary color (QuoteLayout.mark), as
 * Claude Design draws one over each quote card: the language's opening mark (a low one, which sits at the baseline, is drawn as the high English
 * mark instead), bold, at most `QUOTE_MARK.sizes[0]` times the body's size. It is drawn in the card's own padding above the quote's text, its ink centered
 * between the card's top edge and the text's top (`card` is the card's box), at the largest of `QUOTE_MARK.sizes` whose ink fills at most
 * `QUOTE_MARK.fill` of that padding. Nothing moves and no size changes: the quote's text, footer and photo stay where they were. A card with
 * less padding than that, a quote that overflows, a pull line and a photo beside the quote draw no mark.
 */
export const QUOTE_MARK = { sizes: [1.5, 1.25, 1], ink: { top: 0.22, bottom: 0.58 }, fill: 0.7 } as const;
export function markQuote(layout: QuoteLayout, card: LayoutBox, options: {scale?: number; fontFamilies?: Partial<FontFamilies>; textMeasurement?: TextMeasurement; direction?: TextDirection; language?: string; path?: string; citationMarker?: (runPath: string) => string | undefined} = {}): QuoteLayout {
  const body = layout.parts.find(part => part.role === 'body'), bodySize = body?.fit?.fontSize;
  if (!body || bodySize === undefined || layout.overflow || layout.rule || layout.mark || layout.photo?.focus || layout.parts.some(part => !part.fit)) return layout;
  const padding = body.box.y - card.y, inkHeight = QUOTE_MARK.ink.bottom - QUOTE_MARK.ink.top;
  const size = QUOTE_MARK.sizes.map(factor => bodySize * factor).find(candidate => inkHeight * candidate <= QUOTE_MARK.fill * padding);
  if (size === undefined) return layout;
  const open = quoteMarksFor(options.language).open, text = open === '„' || open === '‚' ? '“' : open;
  const markPath = `${options.path ?? 'quote'}.mark`, requestedStyle: TextStyle = {fontFamily: body.requestedStyle.fontFamily, fontWeight: 700, italic: false, path: markPath};
  const style = resolveTextStyle({...requestedStyle}, options.textMeasurement);
  // The line box starts so that the ink (QUOTE_MARK.ink of the size, from the line's top) is centered in the padding.
  const box = {x: body.box.x, y: card.y + (padding - inkHeight * size) / 2 - QUOTE_MARK.ink.top * size, width: body.box.width, height: size * 1.3};
  const fit = fitText(text, box, size, size, textWidthMeasurer(style, options.textMeasurement), options.direction);
  if (fit.overflow || !usableBox(box)) return layout;
  // The mark stands for the quote's own opening mark: that mark is not drawn (the document text is unchanged; the closing mark stays). The body is
  // fitted again without it at its size, in room it already had: a body with fewer characters never wraps to more lines. A quote whose text does not
  // begin with its opening mark hides nothing.
  const shown = body.text.startsWith(open) ? body.text.slice(open.length) : undefined;
  if (shown === undefined) return {...layout, mark: {path: markPath, text, box, fit, style, requestedStyle}};
  const room = {...body.box, height: Math.max(body.box.height, 1) * 2 + bodySize * 4};
  const runs = body.runs ? body.runs.map((run, index) => index ? run : typeof run === 'string' ? run.slice(open.length) : {...run, text: run.text.slice(open.length)}) : undefined;
  const refit = runs
    ? fitRichText(runs, room, bodySize, bodySize, {style: body.style, textMeasurement: options.textMeasurement, ...(options.citationMarker ? {citationMarker: options.citationMarker} : {}), ...(options.direction ? {direction: options.direction} : {})})
    : fitText(shown, room, bodySize, bodySize, textWidthMeasurer(body.style, options.textMeasurement), options.direction);
  const count = (value: TextFit | RichTextFit) => 'richLines' in value ? (value as RichTextFit).richLines.length : value.lines.length;
  if (refit.overflow || Math.abs(refit.fontSize - bodySize) > 1e-9 || count(refit) > count(body.fit!)) return layout;
  const sources = body.sources.map(source => ({...source, outputStart: Math.max(0, source.outputStart - open.length), outputEnd: Math.max(0, source.outputEnd - open.length)}));
  const parts = layout.parts.map(part => part === body ? {...part, text: shown, sources, fit: refit, ...(runs ? {runs} : {})} : part);
  return {...layout, parts, mark: {path: markPath, text, box, fit, style, requestedStyle, hidden: open}};
}
const usableBox = (box: LayoutBox): boolean => [box.x, box.y, box.width, box.height].every(Number.isFinite) && box.width > 0 && box.height > 0;

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
  /** LH-135: the label leads the metric as its eyebrow (`MetricLayoutOptions.eyebrow`): drawn in the tag's color. */
  eyebrow?: true;
  /**
   * LH-137: the delta drawn as a pill (`MetricLayoutOptions.deltaPill`): `box` the capsule around the delta's one line and its trend arrow
   * (`trendBox`), with `radius` half its height; `placement` `beside` the value's line (after it in reading order), or `above` the value.
   * Engines fill it with core metricPillFill under the delta and color the delta and arrow against that fill.
   */
  deltaPill?: { box: LayoutBox; radius: number; placement: 'beside' | 'above' };
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
   * LH-135: the label is the metric's eyebrow: it leads the metric above the value, bold at EYEBROW_TAG_SIZE and in capitals with
   * EYEBROW_TRACKING where its script has case (the tag's style); engines draw it in the tag's color (`MetricLayout.eyebrow`). The value
   * and the other fields follow it as in a tile, but the description stays under the value.
   */
  eyebrow?: boolean;
  /**
   * LH-39: a value of one word (a figure such as "$1.24M") never wraps: it is set on one line at the largest size that holds it, not split
   * inside the figure at a larger size. Default true; composition passes false for a slide's composition without its guarded rules.
   */
  figure?: boolean;
  /**
   * LH-137: draw the delta (and its trend arrow) as a pill: beside the value's line when every field keeps the size it has without the
   * pill, else above the value when every field keeps it there, else in its place without a pill. A tile (LH-68) and a band (LH-15) keep
   * their delta in place. The result says where (`MetricLayout.deltaPill`). `above` tries only above (sibling metrics draw one way).
   */
  deltaPill?: boolean | 'above';
}
/** LH-137: layoutMetric places the delta pill this way (its two trials of `deltaPill`). */
const PILL_PLACEMENT = Symbol('opf.pillPlacement');
/** LH-137: a delta pill's inset around its line, as shares of the delta's size: across, and above and below. */
export const METRIC_PILL_PAD_X = .55, METRIC_PILL_PAD_Y = .2;
/** LH-137: the middle of a pill beside the value sits this share of the value's size above the value's baseline (the middle of its figures). */
export const METRIC_PILL_RISE = .36;
/**
 * LH-17: the largest size of the type scale at or under `size` (canvas px), the scale rising from the floor (reference px) by
 * TYPE_SCALE_RATIO, rounded to whole reference pixels (see composeSlide's scaleSizes).
 */
const TYPE_SCALE_RATIO = (PROSE_NOMINAL_SIZE / 16) ** .25;
/**
 * LH-149: with `half`, the half step between each two steps too (the floor times the ratio to a half power, rounded the same way): 16, 17,
 * 18, 20, 21, 23, 24, 26, 28, 30 and 32 px at the default floor. Fitted body text (composeSlide's scaleStep and scaleSizes) uses it.
 */
function typeScaleStep(size: number, floorPx: number, scale: number, half = false): number {
  let step = snapFontSizeUp(floorPx * scale);
  for (let power = 1; ; power++) {
    const next = snapFontSizeDown(Math.round(floorPx * TYPE_SCALE_RATIO ** (half ? power / 2 : power)) * scale);
    if (next > size + 1e-9) return step;
    step = Math.max(step, next);
  }
}
/** LH-39, LH-150: whether a metric value is one figure: one word once the no-break rules bind it ("$1.24M", "4.6 / 5", "26 %"). */
const oneFigure = (text: string): boolean => proseWords(text.trim()).length === 1;
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
 * LH-135: the display size of a pricing tier's price, in reference pixels, by how many tiers share the slide: two start at 96 and grow to
 * 128, three to five start at 80 and grow to 96 (the narrower cards), and each steps down to the one line its card holds. Equal caps keep
 * the prices of a set of tiers at one size wherever they all fit (a word such as "Custom" may need less).
 */
export const TIER_VALUE_SIZES = { few: { start: 96, max: 128 }, many: { start: 80, max: 96 } } as const;
/** LH-135: a slide of pricing tiers has at most this many (more are a grid of cards, not a comparison). */
export const TIER_MAX = 5;
/** LH-136: a set of pillars drawn as display words has at most PILLAR_MAX of them, each title a word of at most PILLAR_WORD_MAX characters. */
export const PILLAR_MAX = 5, PILLAR_WORD_MAX = 14;
/**
 * LH-132: how a person's picture is drawn (the image option and the quote field `portrait`): `avatar`, the small circle (a team's picture
 * over the name, a quote's beside the attribution); `side`, a tall picture beside the text; `top`, the picture across the top of the card.
 */
export const PORTRAIT_MODES = ['avatar', 'side', 'top'] as const;
export type PortraitMode = typeof PORTRAIT_MODES[number];
/**
 * LH-132: a team of 2 to PORTRAIT_TOP_MAX people draws each portrait across the top of its card at the card's width, in one row (Claude
 * Design n22); up to PORTRAIT_SIDE_MAX, beside the text at PORTRAIT_SIDE_SHARE of the card's inner width (n23); more keep the avatar.
 */
export const PORTRAIT_TOP_MAX = 4, PORTRAIT_SIDE_MAX = 6, PORTRAIT_SIDE_SHARE = .4;
/** LH-132 review: the shares of the card a side portrait tries, widest first, down to 30%, so a name fits its column on one line. */
export const PORTRAIT_SIDE_SHARES = [PORTRAIT_SIDE_SHARE, .35, .3] as const;
/**
 * LH-132: a portrait's frame is at most this tall for its width (width / height: 4:5 across a card's top, 0.7 beside the text, Claude
 * Design's 146 x 200) and at least this wide (4:3): a frame flatter than that crops a face to a strip, so the person keeps the avatar.
 */
export const PORTRAIT_TALLEST = { top: .8, side: .7 } as const, PORTRAIT_WIDEST = 4 / 3;
/**
 * LH-132, in reference pixels: the narrowest card a portrait is drawn across the top of, the narrowest portrait beside the text and the
 * narrowest text beside it, and the gap between a portrait and its text.
 */
export const PORTRAIT_MIN = { topCard: 160, side: 72, text: 150 } as const, PORTRAIT_GAP = 16;
/** LH-132: a team's texts keep at least this size (reference px; Claude Design sets a name at 20) before a top portrait gives up its square. */
export const PORTRAIT_TEXT_SIZE = 21;
/**
 * LH-132 review: a portrait beside the text leaves the text a column; an automatic side portrait is drawn only where that column keeps every
 * name on one line and reads at least PORTRAIT_SIDE_CHARS characters a line at the size the team's text takes. Otherwise a top portrait is
 * tried, and the avatar kept.
 */
export const PORTRAIT_SIDE_CHARS = 20;
/**
 * LH-132: a quote with a photo draws it as a tall picture at the start of the quote (Claude Design n24) when the quote is at least
 * QUOTE_PORTRAIT_MIN_WIDTH wide: QUOTE_PORTRAIT_SHARE of its width, at most PORTRAIT_TALLEST.side tall for that width and never taller
 * than the quote, QUOTE_PORTRAIT_GAP from the text, which is centered against it. A narrower quote (three side by side) keeps the avatar.
 */
export const QUOTE_PORTRAIT_SHARE = .26, QUOTE_PORTRAIT_STEP = .02, QUOTE_PORTRAIT_GAP = 40, QUOTE_PORTRAIT_MIN_WIDTH = 640;
/** LH-132: a portrait the author gave no focus keeps the upper third in view, where a face is (LH-84's PORTRAIT_FOCUS_Y). */
const portraitFocus = (): ImageFocus => ({ x: 0.5, y: PORTRAIT_FOCUS_Y });

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
  // LH-137: a delta pill beside the value where every field keeps its size, else above it, else none (the delta in its place).
  const pillPlacement=(options as Record<symbol,unknown>)[PILL_PLACEMENT] as 'beside'|'above'|undefined;
  if (options.deltaPill&&!pillPlacement&&!options.tile&&!options.band&&metric.delta!==undefined&&String(metric.delta).trim()!=='') {
    const plainOptions={...options,deltaPill:false},plainLayout=layoutMetric(value,box,plainOptions);
    const sizes=(layout:MetricLayout)=>new Map(layout.parts.filter(part=>part.visible&&part.fit).map(part=>[part.role,part.fit!.fontSize] as const));
    const before=sizes(plainLayout),keeps=(layout:MetricLayout)=>!layout.overflow&&layout.deltaPill!==undefined&&[...before].every(([role,size])=>(sizes(layout).get(role)??0)>=size-FONT_GRID_EPSILON);
    for (const placement of options.deltaPill==='above'?['above'] as const:['beside','above'] as const) { const pilled=layoutMetric(value,box,{...plainOptions,[PILL_PLACEMENT]:placement} as MetricLayoutOptions); if (keeps(pilled)) return pilled; }
    return plainLayout;
  }
  // LH-15: a band is start-aligned.
  const requestedAlignment=options.band?'left':options.align??'center';
  if (!['left','center','right'].includes(requestedAlignment)) throw new RangeError('Invalid metric alignment.');
  const sourcePath=options.path??'metric',parts:MetricTextPart[]=[],diagnostics:MetricLayoutDiagnostic[]=[];
  for (const role of ['value','unit','label','description','delta','trend'] as const) {
    const sourceValue=metric[role];
    if (sourceValue===undefined) continue;
    // LH-141: a number as the value prints it groups its thousands by the deck language (`language`); a string is the author's own text.
    // Wave 6 (LH-141 with LH-137): so does a number as the delta, which the pill draws beside the grouped value.
    const text=(role==='value'||role==='delta')&&typeof sourceValue==='number'&&Math.abs(sourceValue)>=NUMBER_GROUPING_MIN?groupNumber(sourceValue,options.language):String(sourceValue),path=scalar?sourcePath:`${sourcePath}.${role}`;
    // WI-1: the value asks for its role size (76 px) whatever the box; the box only limits it, and fitValue fits it down on overflow.
    // LH-68: a tile's value asks for METRIC_TILE_VALUE_SHARE of the tile, between its role size and twice it. LH-48: a lone metric grows.
    const valueSize=options.tile?Math.min(152,Math.max(76,box.height*METRIC_TILE_VALUE_SHARE/scale)):76;
    const least=snapFontSizeUp(Math.max(minimum,options.minimumSizes?.[role]??0));
    // LH-135: an eyebrow label is the tag's size and style (bold, capitals and tracking where its script has case, in the accent family).
    const eyebrow=options.eyebrow===true&&role==='label'&&!options.tile,caps=eyebrow&&eyebrowCaps(text);
    const nominal=Math.max(Math.min(grownRoleSize(role==='value'?valueSize:role==='description'?20:role==='trend'?18:eyebrow?EYEBROW_TAG_SIZE:23,eyebrow?undefined:options.growth,LONE_DISPLAY_SIZES[role])*scale,options.roleSizes?.[role]??Infinity),least);
    const requestedStyle:TextStyle={fontFamily:(role==='value'?options.fontFamilies?.heading:eyebrow?options.fontFamilies?.accent??options.fontFamilies?.body:options.fontFamilies?.body)??'sans-serif',fontWeight:role==='value'?800:eyebrow?700:role==='description'?400:500,italic:false,path,...(caps?{caps:true,tracking:EYEBROW_TRACKING}:{})};
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
  // LH-137: the delta drawn in a pill (pillPlacement): above the value as its lead, or beside the value's line (out of the stack).
  const pillPart=pillPlacement?parts.find(part=>part.role==='delta'&&part.visible):undefined,pillAbove=pillPlacement==='above'?pillPart:undefined,pillBeside=pillPlacement==='beside'?pillPart:undefined;
  const pillPadY=(size:number)=>size*METRIC_PILL_PAD_Y,pillWidth=(part:MetricTextPart,fit:CodeTextFit)=>naturalWidth(part,fit)+(part===arrowHost?arrowRoom(fit.fontSize):0)+2*fit.fontSize*METRIC_PILL_PAD_X;
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
    // LH-135: a pricing tier's price gives way to its label and description: it takes at most the height the box leaves over them at their
    // starting sizes (down to its role size), so the box's metadata is not reduced for display headroom.
    if (options.eyebrow&&size!==undefined) {
      const others=metadata.reduce((sum,part)=>sum+occupied(measure(part,part.requestedFontSize,part===arrowHost?Math.max(Number.MIN_VALUE,box.width-arrowRoom(part.requestedFontSize)):box.width)),0)+metadata.length*gap+primaryGap;
      size=Math.min(size,Math.max(role,Math.floor((box.height-others)/(1.22*scale)/4)*4));
    }
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
    // wrapped fit stands, as before. A value of several words ("Q4 2026 plan") may still wrap between words. LH-150: a value the no-break
    // rules bind into one word ("4.6 / 5", "26 %") is a figure too.
    if (options.figure!==false&&!singleLine&&oneFigure(primary.text)) {
      const whole=attempt(true,true);
      if (whole&&!whole.overflow) { if (attempt(false)?.lines.length!==1) FIGURE_FITS.add(whole); return whole; }
    }
    return attempt(singleLine);
  };
  type Allocation={part:MetricTextPart;box:LayoutBox;fit:CodeTextFit|undefined};
  type Candidate={arrangement:MetricLayout['arrangement'];allocations:Allocation[];score:number;overflow:boolean;pillFit?:CodeTextFit};
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
      // LH-135: so does an eyebrow label.
      // LH-137: a pill above the value leads (after an eyebrow label), inset by its padding; a pill beside it leaves the stack and takes
      // room on the value's line.
      const lead=[...(options.tile||options.eyebrow?metadata.filter(part=>part.role==='label'):[]),...(pillAbove?[pillAbove]:[])];
      const tail=metadata.filter(part=>(arrangement!=='inline-unit'||part!==unit)&&!lead.includes(part)&&part!==pillBeside);
      const tailHeight=tail.reduce((sum,part)=>sum+occupied(measured.get(part)!),0)+Math.max(0,tail.length-1)*gap;
      const leadPad=(part:MetricTextPart)=>part===pillAbove?pillPadY(measured.get(part)!.fontSize):0;
      const leadHeight=lead.reduce((sum,part)=>sum+occupied(measured.get(part)!)+gap+2*leadPad(part),0),top=box.y+leadHeight;
      if (!Number.isFinite(tailHeight)||!Number.isFinite(leadHeight)) throw new RangeError('Metric metadata exceeds finite coordinates.');
      const pillFit=pillBeside?measured.get(pillBeside):undefined,pillRoom=pillBeside&&pillFit?pillWidth(pillBeside,pillFit)+Math.max(gap,METRIC_UNIT_GAP*primary.requestedFontSize):0;
      const area={...box,y:top,width:Math.max(Number.MIN_VALUE,(arrangement==='inline-unit'?box.width-unitWidth-gap:box.width)-pillRoom),height:box.height-leadHeight-tailHeight-(tail.length?primaryGap:0)};
      const valueFit=fitValue(area,arrangement==='inline-unit'),valueHeight=valueFit?occupied(valueFit):0;
      const allocations:Allocation[]=[];
      let leadY=box.y;
      for (const part of lead) { const natural=measured.get(part)!,height=occupied(natural),pad=leadPad(part),area=lineBox(part,box,leadY+pad,height,natural.fontSize); allocations.push({part,box:area,fit:{...natural,overflow:!!natural.placement?.overflow||natural.sourceLines.some(line=>line.width>area.width+.01)}}); leadY+=height+gap+2*pad; }
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
      const candidate={arrangement,allocations,score,overflow,...(pillFit?{pillFit}:{})};
      // LH-53: a later candidate (more reduced metadata) must score a whole reference pixel better: on a near tie the metadata keeps its
      // size and the value gives way, as when the trend took a line of its own.
      if (!selected||!overflow&&(selected.overflow||score<selected.score-1)||overflow&&selected.overflow) selected=candidate;
    }
    if (selected&&!selected.overflow&&selected.score===0) break;
  }
  for (const allocation of selected!.allocations) {allocation.part.box=allocation.box;allocation.part.fit=allocation.fit;}
  const figureLine=!!primary.fit&&FIGURE_FITS.has(primary.fit);
  const alignmentFactor=alignment==='center'?.5:alignment==='right'?1:0;
  // LH-137: a pill beside the value: the value's line (with an inline unit) and the pill are one line placed by the alignment, the pill
  // after the value in reading order, its middle METRIC_PILL_RISE of the value's size above the value's baseline. A value on more than
  // one line takes no pill beside it (the pill is then reported outside its cell, and layoutMetric tries it above).
  let pillBox:LayoutBox|undefined,pillMisplaced=false;
  if (pillBeside&&selected!.pillFit&&primary.fit) {
    const fit=selected!.pillFit,size=fit.fontSize,padX=size*METRIC_PILL_PAD_X,padY=pillPadY(size),textWidth=naturalWidth(pillBeside,fit);
    const width=pillWidth(pillBeside,fit),height=occupied(fit)+2*padY,inlineUnit=selected!.arrangement==='inline-unit'&&unit?unit:undefined;
    const ownWidth=Math.min(primary.box.width,naturalWidth(primary,primary.fit)||primary.fit.fontSize);
    const lineWidth=inlineUnit?inlineUnit.box.x+inlineUnit.box.width-primary.box.x:ownWidth,between=Math.max(gap,METRIC_UNIT_GAP*primary.fit.fontSize);
    const start=box.x+Math.max(0,box.width-(lineWidth+between+width))*alignmentFactor,valueX=arrowLeft?start:start+width+between,pillX=arrowLeft?start+lineWidth+between:start;
    const shift=valueX-primary.box.x;
    if (!inlineUnit) { primary.box={...primary.box,width:ownWidth}; primary.fit=place(primary,primary.fit,ownWidth); }
    primary.box={...primary.box,x:primary.box.x+shift};
    if (inlineUnit) inlineUnit.box={...inlineUnit.box,x:inlineUnit.box.x+shift};
    const baseline=primary.fit.placement?.lines[0]?.baseline??primary.fit.fontSize,top=Math.max(box.y,primary.box.y+baseline-METRIC_PILL_RISE*primary.fit.fontSize-height/2);
    pillBeside.box={x:pillX+padX+(arrowLeft&&pillBeside===arrowHost?arrowRoom(size):0),y:top+padY,width:textWidth,height:occupied(fit)};
    pillBeside.fit={...place(pillBeside,fit,textWidth),overflow:false};
    pillBox={x:pillX,y:top,width,height};
    pillMisplaced=primary.fit.lines.length!==1||fit.lines.length!==1||pillX<box.x-.01||pillX+width>box.x+box.width+.01;
  } else if (pillBeside) pillMisplaced=true;
  if (selected!.arrangement==='inline-unit'&&unit&&!pillBox) {
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
  // LH-137: a pill above the value wraps the delta's one line and its arrow, inset by its padding.
  if (pillAbove?.fit&&pillAbove.linePositions.length) {
    const fit=pillAbove.fit,size=fit.fontSize,padX=size*METRIC_PILL_PAD_X,padY=pillPadY(size),origin=pillAbove.linePositions[0]!,lineWidth=fit.sourceLines[0]?.width??0;
    const left=Math.min(origin.x,trendBox&&pillAbove===arrowHost?trendBox.x:Infinity)-padX,right=Math.max(origin.x+lineWidth,trendBox&&pillAbove===arrowHost?trendBox.x+trendBox.width:-Infinity)+padX;
    pillBox={x:left,y:pillAbove.box.y-padY,width:right-left,height:occupied(fit)+2*padY};
    pillMisplaced=fit.lines.length!==1||left<box.x-.01||right>box.x+box.width+.01;
  } else if (pillAbove) pillMisplaced=true;
  if (pillMisplaced&&pillPart) report('part-outside-cell',pillPart,['delta'],'Metric delta pill does not fit beside or above its value; it is drawn without the pill.');
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
  const bottom = Math.max(box.y, trendBottom, ...visible.map(part => part.box.y + occupied(part.fit!)), pillBox ? pillBox.y + pillBox.height : -Infinity);
  const bounds = {x:box.x,y:box.y,width:box.width,height:bottom-box.y};
  // LH-40: a field with no room is set at the floor in what its cell leaves; it overflows, and its finding above stands.
  if (options.floorFallback) for (const part of parts) if (part.visible&&!part.fit) {
    const room=floorRoom(part.box,box),floorFit=measure(part,minimum,room.width);
    part.box={...room,height:occupied(floorFit)};part.fit={...floorFit,overflow:true};position(part);
  }
  const layout:MetricLayout={bounds,algorithm:'metric-flow-v1',alignment,textMeasurement:options.textMeasurement?'provided':'estimated',arrangement:selected!.arrangement,...(metric.sentiment===undefined?{}:{sentiment:metric.sentiment}),...(trendBox?{trendBox}:{}),...(options.display&&!options.tile?{display:true as const}:{}),...(options.eyebrow&&!options.tile&&parts.some(part=>part.role==='label')?{eyebrow:true as const}:{}),...(pillBox&&pillPlacement&&!pillMisplaced?{deltaPill:{box:pillBox,radius:pillBox.height/2,placement:pillPlacement}}:{}),attempts,parts,diagnostics,overflow:diagnostics.length>0};
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
/**
 * LH-129: the growths (reference pixels on every role) a lone timeline tries first, largest first: three and two steps of the type scale
 * above its 18 and 22 px label roles (to 28 and 32, or 24 and 28 px).
 */
const TIMELINE_STEP_GROWTH = [10, 6] as const;
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
  /** A ColorRef string, or SH-02's lighter or darker form ({ color, lighten } or { color, darken }). */
  color?: string | { color: unknown; lighten?: number; darken?: number }; fontSize?: number; fontFamily?: string; link?: string; superscript?: boolean; subscript?: boolean;
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
  /**
   * LH-07: the entry's step badge (`ListFitOptions.badges`): a circle of `diameter` centered at (`cx`, `cy`) in the marker column,
   * with `label` (the number without its suffix) at `fontSize`. The marker itself draws nothing (`none`); `number` is kept.
   * LH-134: a `numeral` (`ListFitOptions.numerals`) draws no circle: its label in the accent, bold, centered on `cx` in the line box `numeral`
   * (`diameter` is its column's width), with its baseline at `cy` + 0.35 of `fontSize`.
   */
  badge?:{cx:number;cy:number;diameter:number;label:string;fontSize:number;numeral?:LayoutBox};
  /**
   * LH-14: the entry's icon chip (`ListFitOptions.icons`): a circle of `diameter` centered at (`cx`, `cy`) in the marker column, centered
   * on the first line's capitals, in place of the bullet. Composition draws the entry's `icon` in it (SlideComposition.icons).
   */
  icon?:{cx:number;cy:number;diameter:number};
  /**
   * LH-133: the entry's label is a term (a ruled row of a glossary, `ListFitOptions.pairs: "term"`): it draws in the accent, the tag's color
   * on its backdrop (the text color where the primary reads under 4.5:1).
   */
  accent?:true;
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
/**
 * LH-08: a hairline between two rows of a list drawn as ruled rows (`design.listStyle: "rows"`): from `x` across `width`, centered on `y`.
 * LH-133: an `accent` rule is the rule over a cell of a grid of questions, LIST_ACCENT_RULE_WIDTH thick in the accent (the tag's color).
 */
export interface ListRule { x:number; y:number; width:number;
  /** LH-136: the rule's thickness in canvas pixels (LIST_RULE_WIDTH of the scale when absent, LIST_ACCENT_RULE_WIDTH for an accent rule). */
  thickness?:number;
  /** LH-133, LH-136: drawn in the accent (the tag's color on its backdrop), not the border neutral: over a question cell or a display heading. */
  accent?:true }
export interface ListFit extends TextFit { listEntries:ListEntryLayout[]; height:number;
  /** LH-08: the hairlines of a list drawn as ruled rows, one between every two first-level entries; engines draw each LIST_RULE_WIDTH thick in the scheme's border neutral. */
  rules?:ListRule[] }
/** LH-08: the space between two rows of a ruled list, in em of the list size; its hairline sits in the middle. */
export const LIST_ROWS_GAP=.8;
/** LH-08: a ruled list sets its labels beside their descriptions when the widest label takes at most this share of the list's width on one line. */
export const LIST_ROWS_LABEL_SHARE=.4;
/** LH-133: the widest gap between two rows of a spread list (ListFitOptions.spread), in em of the list size (Claude Design spreads an agenda's rows about 2.5 to 4 em apart). */
export const LIST_ROWS_SPREAD=3;
/** LH-08: the thickness of a row's hairline, in reference pixels (0.75 pt at 1280 × 720). */
export const LIST_RULE_WIDTH=1;
/** LH-133: the thickness of the accent rule over each cell of a grid of questions, in reference pixels (Claude Design: 3 px at 1280 × 720). */
export const LIST_ACCENT_RULE_WIDTH=3;
/** LH-133: a question beside its answer takes at most this many lines in its column (LIST_ROWS_LABEL_SHARE of the width); longer, the answer goes under it. */
export const LIST_QUESTION_LINES=3;
/**
 * LH-134: a takeaway's display numeral (`ListFitOptions.numerals: "display"`) is this many times the list size when every takeaway has a
 * supporting line, the top of its digits on the label's capitals, so it spans about the takeaway and its line (Claude Design: a numeral
 * about three times the size of the takeaway beside it); beside takeaways of one paragraph it is STEP_BADGE times, a badge's width. A row
 * numeral (`"row"`) is the list size.
 */
export const LIST_NUMERAL_SCALE=2.5;
/** LH-134: the space between a numeral's column and its row's text, in em of the list size. */
export const LIST_NUMERAL_GAP=1.5;
/** LH-134: a lone numbered list of at most this many entries is a few takeaways, drawn beside display numerals. */
export const NUMERAL_TAKEAWAYS=5;
/**
 * LH-133: a region of at least PAIR_GRID_MIN one-question blocks whose questions are at most PAIR_GRID_QUESTION characters and answers at most
 * PAIR_GRID_ANSWER stays a grid, each cell under an accent rule; fewer or longer questions are ruled rows.
 */
export const PAIR_GRID_MIN=6, PAIR_GRID_QUESTION=48, PAIR_GRID_ANSWER=90;
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
   * LH-136: the heading of a one-entry heading list (`heading`) is a display word over an accent rule: the word at LIST_DISPLAY_SCALE times
   * the list size (stepped down to the one line the box holds, never to under LIST_HEADING_SCALE), a rule of LIST_DISPLAY_RULE em across the
   * box above it (`ListFit.rules`, `accent`), then the description at the list size. Ignored unless the list is a heading list.
   */
  display?:boolean;
  /** LH-136: the display word is at most this size in canvas pixels, so sibling pillars read at one word size (composition passes the smallest any of them fitted at). */
  displayMax?:number;
  /** LH-69: the display word's rule is short (LIST_DISPLAY_SCALE em, the display word's own em) at the start edge, as LH-130's title rule, not across the box. */
  displayRule?:'short';
  /**
   * LH-169: the display heading is the figure of a metric row (`display`): its description, the figure's label, is set at this many times
   * the list size (the size the list drew its descriptions at) rather than at the list size, and the figure may step down to the list size
   * (not LIST_HEADING_SCALE of it) to stay on one line: bold, in the accent and over its rule, it still reads above its label.
   */
  labelScale?:number;
  /**
   * LH-08: ruled rows (effective `design.listStyle: "rows"`): each first-level entry is a row, a hairline between two rows (`ListFit.rules`)
   * and LIST_ROWS_GAP em between them; no bullet (numbers stay). When every entry has a description and sits at the first level, the labels
   * are bold and, when the widest fits LIST_ROWS_LABEL_SHARE of the width on one line, sit in a column beside their descriptions (one em
   * apart, the first baselines aligned); otherwise each description sits under its label, as in a stacked list. Ignored for fewer than 2 entries.
   */
  rows?:boolean;
  /**
   * LH-07: draw each entry's number in a step badge (`ListEntryLayout.badge`) instead of a marker: a circle STEP_LIST_BADGE times the
   * list size across in the marker column, its numeral STEP_BADGE_NUMERAL of that and never under the floor, centered on the
   * entry's first line; entries are at least STEP_BADGE_GAP of a badge apart, so the connector between them shows. Needs
   * `numbering` and entries of level 0; ignored otherwise.
   */
  badges?:boolean;
  /**
   * LH-14: the entries that carry an `icon` draw it on a chip ICON_CHIP times the list size across in the marker column, in place of the
   * bullet (`ListEntryLayout.icon`), centered on the entry's first line; every entry keeps that column, so the texts start at one edge.
   * Needs one level and no numbering; ignored otherwise. A ruled list (`rows`) sets the chips at the start of its labels.
   */
  icons?:boolean;
  /** LH-14: the chip's size in em of the list size: ICON_CHIP (the default) or ICON_CHIP_COMPACT. */
  iconScale?:number;
  /**
   * LH-133: the entries of a ruled list (`rows`) pair a question (`question`) or a term (`term`) with its answer or definition. A question's
   * column is LIST_ROWS_LABEL_SHARE of the width, the question wrapping in it (at most LIST_QUESTION_LINES lines, else the answer goes under
   * it); a term draws in the accent (`ListEntryLayout.accent`) in the column of the widest term, as any label does.
   */
  pairs?:'question'|'term';
  /**
   * LH-133: the labels of every block that shares this list's label column (one-entry pairs stacked as ruled rows: a FAQ written as one block
   * per question). The column is measured over all of them, so the answers of every block start at one edge, and a one-entry list is a row
   * whose answer keeps the list size (as the heading list it would otherwise be, LH-77). Needs `rows`.
   */
  rowLabels?:readonly ListText[];
  /**
   * LH-134: with `rows` and `numbering`, each first-level entry's number is a numeral in the accent in a column at the row's start
   * (`ListEntryLayout.badge` with its `numeral` line box; the marker draws nothing, as a badge's): `display` sets it at LIST_NUMERAL_SCALE
   * times the list size (STEP_BADGE times when an entry has no description), the top of its digits on the label's capitals (a few
   * takeaways), `row` at the list size on the label's baseline, in two digits for an arabic number under 10 (an agenda's numbered rows).
   * LIST_NUMERAL_GAP em separate the column from the text.
   */
  numerals?:'display'|'row';
  /**
   * LH-133: with `rows`, the rows fill the box's height (LH-48's fill for a lone ruled list): the gap between two first-level rows grows
   * evenly, to at most LIST_ROWS_SPREAD em, the hairlines in their middles, and the rows sit in the middle of what is still left.
   */
  spread?:boolean;
}
/** LH-77: the heading of a one-entry described list is one size step (a major third) above the list text. */
export const LIST_HEADING_SCALE=1.25;
/** LH-136: a display heading is this many times the list size, over a rule of LIST_DISPLAY_RULE em with LIST_DISPLAY_GAP em under it. */
export const LIST_DISPLAY_SCALE=2.3, LIST_DISPLAY_RULE=.14, LIST_DISPLAY_GAP=.3;
/**
 * LH-07: a step badge is this many times its step's text size across (the list size, or a paragraph's size), and its numeral is set
 * at that text size, so a badge never draws a number smaller than the text it numbers (Claude Design: a 54 to 70 px circle over 20 to
 * 28 px step text).
 */
export const STEP_BADGE=1.75;
/** LH-07: the space between a badge and its step's text, and the least space between two badges of a column, as a share of its diameter. */
export const STEP_BADGE_GAP=.4;
/** LH-07: a flow (chips joined by arrows) is a lone list of this many entries at least and at most, each of one or two words and at most STEP_FLOW_CHARACTERS long. */
export const STEP_FLOW_MIN=3, STEP_FLOW_MAX=6, STEP_FLOW_CHARACTERS=24;
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
  // LH-133: a one-entry list that shares its label column with sibling blocks (`rowLabels`) is a ruled row, not a heading list.
  const heading=options.heading===true&&!numbers&&source.length===1&&source[0]!.descriptionRuns!==undefined&&!(options.rows===true&&options.rowLabels);
  // LH-07: entries drawn beside step badges (numbered, one level).
  const badged=options.badges===true&&numbers!==undefined&&source.every(item=>item.level===0);
  // LH-14: entries drawn beside icon chips (unnumbered, one level, at least one icon).
  const hasIcon=(index:number)=>{const value=input[index];return typeof value==='object'&&!Array.isArray(value)&&value!==null&&(value as {icon?:unknown}).icon!==undefined;};
  const iconed=options.icons===true&&!numbers&&!badged&&source.every(item=>item.level===0)&&source.some(item=>hasIcon(item.index));
  // A native auto-number takes the weight and slant of the paragraph's first run.
  const markerStyleFor=(item:typeof source[number]):TextStyle=>{
    const first=item.runs.map(run=>typeof run==='string'?{text:run} as RichTextRun:run).find(run=>run.text);
    return {...options.style,path:item.textPath,fontWeight:first?.bold===undefined?options.style.fontWeight:first.bold?700:400,italic:first?.italic??options.style.italic};
  };
  // LH-08: ruled rows (ListFitOptions.rows). LH-133: one entry is a row when its label column is shared with sibling blocks (rowLabels).
  const rows=options.rows===true&&!heading&&(source.length>=2||(options.rowLabels!==undefined&&source.length===1)),described=rows&&source.every(item=>item.descriptionRuns!==undefined);
  // LH-134: numbers drawn as numerals in a column at the start of each row (ListFitOptions.numerals).
  const numerals=rows&&numbers!==undefined&&options.numerals!==undefined&&source.every(item=>item.level===0)?options.numerals:undefined;
  const numeralLabels=numerals&&numbers?numbers.map(number=>{const label=listNumberLabel(number);return numerals==='row'&&/^[0-9]$/.test(label)?`0${label}`:label;}):[];
  // LH-133: `extra` widens the gap between two first-level rows (their hairline stays in its middle) and `top` starts the rows lower (spread).
  const rowsLayout=(fontSize:number,extra=0,top=0):ListFit=>{
    let y=box.y+top,overflow=false;const entries:ListEntryLayout[]=[],lines:string[]=[],directions:TextDirection[]=[],rules:ListRule[]=[];
    const markerStyles=numbers?source.map(item=>resolveTextStyle(markerStyleFor(item),options.textMeasurement)):[];
    const markerWidths=numbers?numbers.map((number,index)=>textWidthMeasurer(markerStyles[index]!,options.textMeasurement)(number.text,fontSize)):[];
    // LH-134: the numerals' column is as wide as the widest numeral, bold at its size.
    const numeralSize=numerals==='display'?fontSize*(described?LIST_NUMERAL_SCALE:STEP_BADGE):fontSize,numeralStyle:TextStyle={...options.style,path:undefined,fontWeight:700,italic:false};
    const numeralColumn=numerals?Math.max(...numeralLabels.map(label=>textWidthMeasurer(resolveTextStyle(numeralStyle,options.textMeasurement),options.textMeasurement)(label,numeralSize))):0;
    // Only numbers keep a hanging indent: a row needs no bullet. A nested level steps in by 1.1 em under its row.
    // LH-14: an icon list's chips take a column of their own, a chip and half an em, at the start of every row.
    const chip=iconed?fontSize*(options.iconScale??ICON_CHIP):0;
    const indent=numerals?numeralColumn+fontSize*LIST_NUMERAL_GAP:numbers?Math.max(fontSize*1.1,Math.max(0,...markerWidths)+fontSize*.3):iconed?chip+fontSize*.5:0,nest=fontSize*1.1;
    const labelStyle=(item:typeof source[number]|undefined):TextStyle=>({...options.style,path:item?.textPath,...(described?{fontWeight:700}:{})});
    const labelAt=(item:typeof source[number],area:LayoutBox)=>richTextLayouter(item.runs,area,requestedSize,{...options,style:labelStyle(item)},minFontSize)(fontSize);
    const siblingAt=(label:ListText,area:LayoutBox)=>richTextLayouter(typeof label==='string'?[label]:label,area,requestedSize,{...options,style:labelStyle(undefined)},minFontSize)(fontSize);
    // The label column: the widest label on one line (LH-133: of this list and of the blocks that share its column), when that takes at most
    // LIST_ROWS_LABEL_SHARE of the width. LH-133: questions take that share whatever their length and wrap in it, at most LIST_QUESTION_LINES
    // lines each.
    let column=0;
    if(described&&source.every(item=>item.level===0)){
      const wide={x:0,y:0,width:1e6,height:1e6};
      if(options.pairs==='question'){
        const share=LIST_ROWS_LABEL_SHARE*box.width,area={x:0,y:0,width:Math.max(1,share-indent),height:1e6};
        if(share>indent&&source.every(item=>{const fit=labelAt(item,area);return !fit.overflow&&fit.richLines.length<=LIST_QUESTION_LINES;})&&(options.rowLabels??[]).every(label=>{const fit=siblingAt(label,area);return !fit.overflow&&fit.richLines.length<=LIST_QUESTION_LINES;}))column=share;
      }else{
        const widest=Math.max(...source.map(item=>Math.max(0,...labelAt(item,wide).richLines.map(line=>line.width))),...(options.rowLabels??[]).map(label=>Math.max(0,...siblingAt(label,wide).richLines.map(line=>line.width))));
        const need=indent+widest*1.001+1;
        // LH-14: an icon list's chip column does not count against the labels' share: the share bounds the labels' text.
        if(need<=LIST_ROWS_LABEL_SHARE*box.width+(iconed?indent:0))column=need;
      }
    }
    const between=fontSize,side=column>0;
    for(const item of source){
      const rtl=item.direction==='rtl',first=item.index===0;
      // A hairline in the middle of the gap above every first-level row but the first; a nested entry stays close under its row.
      if(!first){
        const space=item.level===0?fontSize*LIST_ROWS_GAP+extra:fontSize*.28;
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
        // LH-133: the answer of a one-entry row keeps the list size, as the heading list's description it would otherwise be (LH-77).
        const ratio=options.rowLabels?1:.82,dx=side?(rtl?box.x:box.x+column+between):x,dWidth=side?Math.max(1,box.width-column-between):width;
        descriptionBox={x:dx,y:side?y:bottom+fontSize*.12,width:dWidth,height:box.height};
        description=richTextLayouter(item.descriptionRuns,descriptionBox,requestedSize*ratio,{...options,style:{...options.style,path:item.descriptionPath}},minFontSize)(fontSize*ratio);
        // Beside its label, a description's first baseline sits on the label's.
        if(side)descriptionBox.y+=Math.max(0,(text.richLines[0]?.baseline??fontSize)-(description.richLines[0]?.baseline??fontSize*ratio));
        descriptionBox.height=description.height;bottom=Math.max(bottom,descriptionBox.y+description.height);
      }
      // LH-14: the chip is centered on the label's capitals (0.35 em above its first baseline); a row whose first line is shorter than the
      // chip starts lower by the difference, so the chip stays inside the row.
      let iconChip:ListEntryLayout['icon'];
      if(iconed){
        const center=(text.richLines[0]?.baseline??fontSize)-fontSize*.35,pad=Math.max(0,chip/2-center);
        if(pad){textBox.y+=pad;if(descriptionBox)descriptionBox.y+=pad;bottom+=pad;}
        if(hasIcon(item.index))iconChip={cx:rtl?(side?box.x+box.width:box.x+box.width-offset)-chip/2:box.x+offset+chip/2,cy:textBox.y+center,diameter:chip};
        bottom=Math.max(bottom,textBox.y+center+chip/2);
      }
      lines.push(...text.lines);if(options.direction==='rtl')directions.push(...(text.directions??[]));
      if(description){lines.push(...description.lines);if(options.direction==='rtl')directions.push(...(description.directions??[]));}
      overflow||=text.overflow||!!description?.overflow;
      const number=numbers?.[item.index];
      // LH-134: the numeral's baseline is the label's (a row numeral), or the top of its digits (0.7 em, the capitals' height) sits on the
      // label's capitals (a display numeral). It draws centered in its column, at the row's start, and the row reaches its baseline.
      let badge:ListEntryLayout['badge'];
      if(numerals&&number){
        const label=numeralLabels[item.index]!,first=text.richLines[0]?.baseline??fontSize,baseline=textBox.y+(numerals==='row'?first:first-.7*fontSize+.7*numeralSize);
        const line=richTextLayouter([label],{x:0,y:0,width:1e6,height:1e6},numeralSize,{...options,style:numeralStyle},0)(numeralSize).richLines[0];
        const left=rtl?box.x+box.width-numeralColumn:box.x;
        badge={cx:left+numeralColumn/2,cy:baseline-numeralSize*.35,diameter:numeralColumn,label,fontSize:numeralSize,numeral:{x:left,y:baseline-(line?.baseline??numeralSize),width:numeralColumn,height:line?.height??numeralSize*1.22}};
        bottom=Math.max(bottom,baseline);
      }
      const none=!number||badge!==undefined;
      const marker={text:number&&!badge?number.text:'',x:rtl?(side?box.x+box.width:box.x+box.width-offset):box.x+offset,y:textBox.y+(text.richLines[0]?.baseline??fontSize),fontSize,style:number?markerStyles[item.index]!:resolveTextStyle(labelStyle(item),options.textMeasurement),indent,...(number?{number,width:markerWidths[item.index]!}:{}),...(none?{none:true as const}:{}),...(rtl?{anchor:'end' as const}:{})};
      entries.push({index:item.index,level:item.level,value:item.value,descriptionValue:item.descriptionValue,textPath:item.textPath,descriptionPath:item.descriptionPath,text,textBox,description,descriptionBox,marker,...(badge?{badge}:{}),...(iconChip?{icon:iconChip}:{}),...(options.pairs==='term'&&described?{accent:true as const}:{}),...(item.direction?{direction:item.direction}:{})});
      y=bottom;
    }
    const height=y-box.y;
    return {listEntries:entries,lines,fontSize,lineHeight:fontSize*1.22,height,overflow:overflow||height>box.height+.01,rules,...(options.direction==='rtl'?{directions}:{})};
  };
  const layout=(fontSize:number):ListFit=>{
    if(rows){
      // LH-133: a spread list (ListFitOptions.spread) takes its box's height: the leftover height is shared evenly between its first-level
      // rows, each gap at most LIST_ROWS_SPREAD em, and what is still left sits above and below them. A measuring box (no real height) is not spread.
      const fit=rowsLayout(fontSize),count=source.filter(item=>item.level===0).length;
      if(!options.spread||fit.overflow||count<2||box.height>=1e5)return fit;
      const extra=Math.max(0,Math.min((box.height-fit.height)/(count-1),(LIST_ROWS_SPREAD-LIST_ROWS_GAP)*fontSize));
      const spread=rowsLayout(fontSize,extra);
      return spread.overflow?fit:rowsLayout(fontSize,extra,Math.max(0,(box.height-spread.height)/2));
    }
    let y=box.y,overflow=false;const entries:ListEntryLayout[]=[],lines:string[]=[],directions:TextDirection[]=[],accentRules:ListRule[]=[];
    // One hanging indent for the whole list: 1.1 em, or for numbers the widest marker plus 0.3 em.
    const markerStyles=numbers?source.map(item=>resolveTextStyle(markerStyleFor(item),options.textMeasurement)):[];
    const markerWidths=numbers?numbers.map((number,index)=>textWidthMeasurer(markerStyles[index]!,options.textMeasurement)(number.text,fontSize)):[];
    // LH-77: the one described entry of a heading list draws without a marker or an indent, bold and a step up over its description.
    // LH-14: an icon list's chips take the badge column (ICON_CHIP is STEP_BADGE), every entry drawn without a bullet.
    const chipped=badged||iconed,diameter=badged?fontSize*STEP_BADGE:iconed?fontSize*(options.iconScale??ICON_CHIP):0;
    const none=((options.bullet==='none'||heading)&&!numbers)||chipped;
    // LH-07: a badge column is the badge and half an em before the text.
    const hanging=chipped?diameter+fontSize*.5:numbers?Math.max(fontSize*1.1,Math.max(0,...markerWidths)+fontSize*.3):fontSize*1.1;
    for(const item of source){
      const rtl=item.direction==='rtl';
      // No marker: no hanging indent either; a nested level still steps in by one marker width.
      const indent=none&&!chipped?0:hanging,offset=heading?0:Math.min(box.width,item.level*hanging),x=rtl?box.x:box.x+offset+indent,width=Math.max(1,rtl?box.width-offset-indent:box.x+box.width-x);
      if(offset+indent>=box.width)overflow=true;
      const textBox={x,y,width,height:box.height};
      const style={...options.style,path:item.textPath};
      // LH-136: a display heading under an accent rule across the box: the word at LIST_DISPLAY_SCALE times the list size, stepped down to one line.
      const displayed=heading&&options.display===true,labelRatio=displayed&&options.labelScale!==undefined?options.labelScale:1;
      let displayText:RichTextFit|undefined;
      if(displayed){
        const thickness=fontSize*LIST_DISPLAY_RULE;
        const ruleWidth=options.displayRule==='short'?Math.min(box.width,fontSize*LIST_DISPLAY_SCALE):box.width;
        // Wave 7 integration (LH-69 with LH-14): a short rule starts where the word starts, after an icon chip's column (the box's start edge without one).
        const ruleStart=options.displayRule==='short'?{x,width}:box;
        accentRules.push({x:options.direction==='rtl'?ruleStart.x+ruleStart.width-ruleWidth:ruleStart.x,y:y+thickness/2,width:ruleWidth,thickness,accent:true});
        y+=thickness+fontSize*LIST_DISPLAY_GAP;textBox.y=y;
        const wordOptions={...options,style:{...style,fontWeight:700}},target=Math.min(fontSize*LIST_DISPLAY_SCALE,options.displayMax??Infinity),least=Math.min(fontSize*(displayed&&options.labelScale!==undefined?1:LIST_HEADING_SCALE),target);
        const wordAt=(size:number,area:LayoutBox)=>richTextLayouter(item.runs,area,requestedSize*LIST_DISPLAY_SCALE,wordOptions,minFontSize)(size);
        const natural=Math.max(...wordAt(target,{...textBox,width:1e6}).richLines.map(line=>line.width));
        let size=natural>width?Math.max(least,target*width/natural):target;
        displayText=wordAt(size,textBox);
        // The word gives way to the description: it takes at most the height the box leaves over the description at the list size.
        const room=box.height-(y-box.y)-fontSize*.35-(item.descriptionRuns===undefined?0:richTextLayouter(item.descriptionRuns,{x,y:0,width,height:1e6},requestedSize*labelRatio,{...options,style:{...options.style,path:item.descriptionPath}},minFontSize)(fontSize*labelRatio).height);
        for(let step=0;step<48&&(displayText.richLines.length>1||displayText.height>room)&&size>least+1e-6;step++){size=Math.max(least,size*.96);displayText=wordAt(size,textBox);}
      }
      const text=displayText??(heading?richTextLayouter(item.runs,textBox,requestedSize*LIST_HEADING_SCALE,{...options,style:{...style,fontWeight:700}},minFontSize)(fontSize*LIST_HEADING_SCALE)
        :richTextLayouter(item.runs,textBox,requestedSize,{...options,style},minFontSize)(fontSize));
      textBox.height=text.height;lines.push(...text.lines);if(options.direction==='rtl')directions.push(...(text.directions??[]));y+=text.height;
      // LH-07: the badge is centered on the first line's capitals (0.35 em above its baseline); an entry whose line is shorter than the
      // badge starts lower by the difference, so the badge stays inside the entry.
      const center=chipped?(text.richLines[0]?.baseline??fontSize)-fontSize*.35:0,pad=chipped?Math.max(0,diameter/2-center):0;
      if(pad){textBox.y+=pad;y+=pad;}
      let description:RichTextFit|undefined,descriptionBox:LayoutBox|undefined;
      if(item.descriptionRuns!==undefined){
        const ratio=heading?labelRatio:.82;
        y+=fontSize*(displayed?.35:heading?.25:.12);descriptionBox={x,y,width,height:box.height};
        description=richTextLayouter(item.descriptionRuns,descriptionBox,requestedSize*ratio,{...options,style:{...options.style,path:item.descriptionPath}},minFontSize)(fontSize*ratio);
        descriptionBox.height=description.height;lines.push(...description.lines);if(options.direction==='rtl')directions.push(...(description.directions??[]));y+=description.height;
      }
      overflow ||= text.overflow||!!description?.overflow;
      const number=numbers?.[item.index];
      if(chipped)y=Math.max(y,textBox.y+center+diameter/2);
      const marker={text:number&&!badged?number.text:none?'':LIST_MARKERS[item.level%LIST_MARKERS.length]!,x:rtl?box.x+box.width-offset:box.x+offset,y:textBox.y+(text.richLines[0]?.baseline??fontSize),fontSize,style:number?markerStyles[item.index]!:resolveTextStyle(style,options.textMeasurement),indent,...(number?{number,width:markerWidths[item.index]!}:{}),...(none?{none:true as const}:{}),...(rtl?{anchor:'end' as const}:{})},side=fontSize*PICTURE_BULLET_SCALE;
      const badge=badged&&number?{cx:rtl?marker.x-diameter/2:marker.x+diameter/2,cy:textBox.y+center,diameter,label:listNumberLabel(number),fontSize}:undefined;
      const icon=iconed&&hasIcon(item.index)?{cx:rtl?marker.x-diameter/2:marker.x+diameter/2,cy:textBox.y+center,diameter}:undefined;
      entries.push({index:item.index,level:item.level,value:item.value,descriptionValue:item.descriptionValue,textPath:item.textPath,descriptionPath:item.descriptionPath,text,textBox,description,descriptionBox,marker,...(heading?{heading:true as const}:{}),...(badge?{badge}:{}),...(icon?{icon}:{}),
        ...(item.direction?{direction:item.direction}:{}),
        ...(options.bulletImage&&!number&&!none?{bulletImage:options.bulletImage,bulletBox:{x:rtl?marker.x-side:marker.x,y:marker.y-side,width:side,height:side}}:{})});
      if(item.index<source.length-1)y+=chipped?Math.max(fontSize*.28,diameter*STEP_BADGE_GAP):fontSize*.28;
    }
    const height=y-box.y;
    return {listEntries:entries,lines,fontSize,lineHeight:fontSize*1.22,height,overflow:overflow||height>box.height+.01,...(accentRules.length?{rules:accentRules}:{}),...(options.direction==='rtl'?{directions}:{})};
  };
  let minimum=minFontSize;
  for(const item of source) {
    minimum=Math.max(minimum,richMinimum(item.runs,requestedSize,minFontSize));
    if(item.descriptionRuns!==undefined)minimum=Math.max(minimum,heading?richMinimum(item.descriptionRuns,requestedSize,minFontSize):richMinimum(item.descriptionRuns,requestedSize*.82,minFontSize)/.82);
  }
  return fitAtSizes(layout,requestedSize,minimum);
}

/** LH-133: a question ends with a question mark of its script (Latin and fullwidth `?`, Arabic `؟`, the reversed `⸮`), before any closing quote or bracket. */
export function questionText(value: unknown): boolean {
  const text = flatten(value).trim();
  return /\S/u.test(text) && !/[\r\n\u2028\u2029]/u.test(text) && /[?\uff1f\u061f\u2e2e]["'\u2019\u201d\u00bb)\]]*$/u.test(text);
}
/** LH-133: a glossary's term is a label (isLabelText) of at most this many words ("ARR", "CAC payback"); a longer label is a phrase. */
export const TERM_WORDS = 2;
/**
 * LH-133: what a first-level list entry with a description pairs: a question with its answer (`question`), a term with its definition
 * (`term`, a label of at most TERM_WORDS words) or another short label with its description (`label`); undefined for anything else.
 */
export function pairEntry(entry: unknown): 'question' | 'term' | 'label' | undefined {
  const object = record(entry);
  if (object.description === undefined || (object.level ?? 0) !== 0 || object.text === undefined) return undefined;
  if (questionText(object.text)) return 'question';
  return isLabelText(object.text) ? flatten(object.text).trim().split(/\s+/u).length <= TERM_WORDS ? 'term' : 'label' : undefined;
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
  for (const [key, min, max] of [["gap", 0, 0.1], ["padding", 0, 0.2], ["minFontSize", 8, 32], ["maxFontSize", 8, 200], ["columns", 1, 12]] as const) {
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
/** LH-131: compose a before and after pair with its cards this much narrower on these sides, to leave its arrow room (by block path). */
const PAIR_ROOM = Symbol('opf.pairRoom');
/** LH-155 with LH-158: composeLayout composes a closing's stack again at the anchor its picture-text scores chose, with that choice. */
const STACK_PLACE = Symbol('opf.stackPlace');
/** LH-131: a before and after pair's arrow, in reference pixels, and its margin from each card as a share of the slide's gap. */
export const PAIR_ARROW_WIDTH = 40, PAIR_ARROW_HEIGHT = 28, PAIR_ARROW_MARGIN = .75;
/** LH-06: compose the pill at the foot of the body, where it has room, rather than right after the text it follows. */
const PILL_AT_FOOT = Symbol('opf.pillAtFoot');
/** LH-68: each tile metric's fitted sizes as a stack, by item path and role: the floor of its tile's sizes. */
const TILE_FLOORS = Symbol('opf.tileFloors');
/** LH-06: the longest last text that becomes a foot band, and the longest that becomes a pill beside a lone long text, in characters. */
export const EMPHASIS_BAND_MAX_CHARACTERS = 60, EMPHASIS_PILL_MAX_CHARACTERS = 30;
/** LH-06 (widened): a last text of up to this many characters is a foot band when it follows two or more charts or tables (a takeaway). */
export const EMPHASIS_TAKEAWAY_MAX_CHARACTERS = 120;
/**
 * LH-170: a closing note (a `verdict` region's text, or the paragraph after a row of figures) is a foot band when it sets in at most this
 * many lines across the band at its size.
 */
export const EMPHASIS_NOTE_LINES = 3;
/**
 * LH-170 review: a closing note whose length is within this share of the median of the texts of its form above it, or that opens as they
 * do in its first NOTE_PEER_WORDS words, is one of them (a peer), and stays text.
 */
export const NOTE_PEER_RATIO = [.6, 1.6] as const, NOTE_PEER_WORDS = 6;
/** LH-170: the layout regions whose one text is the slide's verdict (the comparison layout's `verdict`). */
const VERDICT_REGIONS: ReadonlySet<string> = new Set(['verdict']);
/** LH-169: a list of FIGURE_ROW_MIN to FIGURE_ROW_MAX entries that each lead with a figure of at most FIGURE_WORDS words is a metric row. */
export const FIGURE_ROW_MIN = 2, FIGURE_ROW_MAX = 4, FIGURE_WORDS = 4;
// LH-169: a figure leads with a number, after an optional sign or comparison and an optional currency symbol ("62 minutes a day",
// "1 in 6 reports", "$3.2M", "+12%", "~40 ms", "٦٢ دقيقة"). Not a step number ("1. Kickoff", "2) Build"), a clock time ("9:00
// Welcome"), a year ("2019 launch", "2024–2026") or a day of a month ("12 May"): those are steps, an agenda and dates, not measures.
const FIGURE_LEAD = /^[+\-−~≈<>≤≥]?\s?[$€£¥₹₩]?\s?\p{Nd}/u;
const NOT_FIGURE = /^(?:\p{Nd}+[.)](?:\s|$)|\p{Nd}{1,2}:\p{Nd}{2}|(?:1[5-9]|20|21)\d{2}(?:$|\s|[-–—/])|\p{Nd}{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:$|\s))/iu;
/** LH-169: whether a list entry's text is a short figure: a number with its unit or comparison, FIGURE_WORDS words or fewer, on one line, not a sentence. */
export function figureText(value: unknown): boolean {
  const text = annotationText(value).trim();
  return text !== '' && !/[\r\n\p{Zl}\p{Zp}]/u.test(text) && FIGURE_LEAD.test(text) && !NOT_FIGURE.test(text) && messageWords(text) <= FIGURE_WORDS && !/[.!?:;。؟۔]$/u.test(text);
}
/**
 * LH-169: whether a list payload is a row of figures: FIGURE_ROW_MIN to FIGURE_ROW_MAX first-level entries, every one a figure (figureText)
 * with a description (its label). A list where only some entries lead with a figure, or whose entries have no descriptions, is a list.
 */
export function figureList(value: unknown): boolean {
  return Array.isArray(value) && value.length >= FIGURE_ROW_MIN && value.length <= FIGURE_ROW_MAX && value.every(entry => {
    const object = record(entry);
    return (object.level ?? 0) === 0 && figureText(object.text) && annotationText(object.description).trim() !== '';
  });
}
/** LH-114: the longest quote (its text, without the marks) drawn as a pull line, in characters. */
export const QUOTE_PULL_MAX_CHARACTERS = 140;
/** LH-48: composeSlide composes an under-filled body again with its paragraphs and lists this many type-scale steps larger (growBody). */
const GROW = Symbol('opf.grow');
/** LH-48: composeSlide composes an under-filled body again in the middle of the space under the headings (growBody). */
const CENTER = Symbol('opf.center');
/** LH-129: composeSlide composes a slide whose headings are its message again with them this many type-scale steps larger (growTemplate). */
const HEADING_STEPS = Symbol('opf.headingSteps');
/**
 * LH-132: composeSlide composes a slide with this flag to draw every quote's photo as the avatar unless the author chose the portrait: the
 * growth passes (growTemplate, growBody) choose their step with the avatar, so a portrait beside the quote never costs it a step, and then
 * draw the portrait at that step where no block reads smaller (withPortraits).
 */
const AVATAR_QUOTES = Symbol('opf.avatarQuotes');
/**
 * LH-132 review: the guard composes a slide whose portraits it refused again with this flag, which turns the rule off, so the slide goes
 * through every other step exactly as a slide without a team or a quote photo does (main's composition, not a rule-by-rule variant of it).
 */
const NO_PORTRAITS = Symbol('opf.noPortraits');
/** LH-132: whether a composition draws a quote's photo as a portrait beside it (QuoteLayout.photo.focus). */
const portraitQuotes = (composed: SlideComposition): boolean => composed.items.some(item => item.quoteLayout?.photo?.focus !== undefined);
/** LH-132: the grown slide (`grown`, composed with AVATAR_QUOTES) with its quotes' portraits again, at the same step (`extra`), where that adds no finding and sets no block smaller. */
function withPortraits(input: unknown, options: ComposeSlideOptions, grown: SlideComposition, extra: Record<symbol, unknown>, before: TrackQuality, floor: number): SlideComposition {
  const portrait = composeVariant(input, { ...options, ...extra } as ComposeSlideOptions, before, floor);
  return portrait && overflowCount(portrait) <= overflowCount(grown) && !shrinks(portrait, grown, options) && !picturesShrink(portrait, grown) ? portrait : grown;
}
/**
 * LH-129: compositions whose headings are the message: they stand free (centered in a sized title area, or in a stacked record) and no
 * primary or secondary region holds a block (a cover, a section, a closing), or the slide has no body and no layout record (a cover by
 * the record rule), so growTemplate may grow them.
 */
const HEADING_MESSAGES = new WeakSet<SlideComposition>();
/** LH-129: compositions with a grown heading that fit only below its step of the type scale (growTemplate does not keep them). */
const HEADINGS_OFF_SCALE = new WeakSet<SlideComposition>();
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
  // LH-149: a paragraph or list that shrank onto a half step counts at the step under it (halfStepFloors): one LH-17 would have set at
  // the floor is at the floor.
  const half = halfStepFloors(result);
  for (const item of result.items) {
    // LH-50: a label drawn as an eyebrow is set at the tag's role size, like the tag: it is no body.
    if (item.field === 'title' || item.field === 'subtitle' || item.field === 'tag' || item.eyebrow) continue;
    const floor = snapFontSizeUp((item.composition.minFontSize ?? 16) * scale);
    const add = (size: number | undefined, key = item.path) => {
      if (size === undefined || !Number.isFinite(size)) return;
      sizes.push({ size, atFloor: Math.min(size, half.get(key) ?? Infinity) <= floor + FONT_GRID_EPSILON });
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
        // LH-135: a label drawn as the metric's eyebrow is set at the tag's role size: it is no body, as LH-50's eyebrow is none.
        if (MAIN_PARTS.has(part.role) && !(part.role === 'label' && item.metricLayout?.eyebrow) && part.requestedFontSize > part.minFontSize + FONT_GRID_EPSILON) add(part.fit === undefined ? undefined : Math.min(part.fit.fontSize, display), `${item.path}:${item.quoteLayout?.rule && part.role === 'body' ? 'pull' : part.role}`);
        split(part.text, part.fit);
        // LH-39: a figure (a value of one word, LH-150: as the no-break rules bind it) on more than one line is split, wherever the break
        // falls ("$1." over "24M").
        if (part.role === 'value' && item.metricLayout && oneFigure(part.text) && ((part.fit as { sourceLines?: unknown[] } | undefined)?.sourceLines?.length ?? 0) > 1) splitValues.add(`${item.path}:value`);
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
 * where it would wrap (`metric-figure`), LH-50's label as the eyebrow of the paragraph after it (`eyebrow`, with LH-152's label of a
 * list or group), and LH-08's ruled rows for
 * a list of short labels with descriptions (`list-rows`), LH-133's questions and terms as ruled rows or a grid under accent rules
 * (`pair-rows`), and LH-07's step badges and flows of a `sequence` region (`step-badges`), whose badges take height the steps' text
 * might need, with LH-134's numerals of a few takeaways and an agenda's numbered rows (`numerals`), LH-149's half steps of the type scale
 * for fitted body text (`half-steps`), LH-135's pricing tiers as one card each (`tier-cards`), LH-136's one-word pillar titles at display
 * size over an accent rule (`pillar-words`), LH-130's accent rule over a title that is the slide's message, held to a body that would lose its size to it (`title-rule`, LH-155),
 * LH-09's statement that sets its title or its block as the message (`statement-message`) and its short message at display size
 * (`display-message`, with LH-69's lone label), LH-05's compact grid (`compact-grid`: the rows of a grid of short texts hug and center
 * instead of spreading over the body), LH-75's table beside its note (`table-note`, an arrangement composeSlide tries, tableNote), LH-132's
 * team portraits and a quote's portrait beside it (`portraits`), LH-18's shared heading track for sibling pillars, questions and cards of a heading over
 * its description (`heading-tracks`, placement only: it adds space under the shorter headings and never changes a size), LH-170's closing note on the emphasis band
 * (`note-band`: a verdict, or the paragraph after a row of figures), LH-169's figure-led list drawn as a metric row (`figure-row`), LH-63's bold run-in heading over its
 * text (`run-in`), and the drawing rules (DRAWING_RULES): LH-131's featured card (`featured-card`), LH-137's delta pill (`delta-pill`) and
 * check-mark tiles (`check-tiles`), LH-14's icons (`icons`, `icon-chips`), LH-165's icon cards (`icon-cards`) and LH-162's text tiles (`text-tiles`). LH-80 and LH-49's tracks are alternatives composeSlide tries afterwards
 * (automaticTracks) under the same guard; LH-52 and LH-71 only place blocks at the sizes they have.
 */
type GuardedRule = 'half-steps' | 'nested-gaps' | 'empty-columns' | 'centered-column' | 'region-measure' | 'mixed-cards' | 'short-row' | 'metric-start' | 'quote-beside' | 'quote-card' | 'emphasis-band' | 'featured-card' | 'pull-quote' | 'timeline-status' | 'metric-tiles' | 'long-text-rows' | 'reading-measure' | 'lead-stack' | 'paragraph-columns' | 'bar-chart-share' | 'metric-figure' | 'metric-display' | 'eyebrow' | 'list-rows' | 'pair-rows' | 'step-badges' | 'numerals' | 'delta-pill' | 'check-tiles' | 'tier-cards' | 'pillar-words' | 'icons' | 'icon-chips' | 'icon-cards' | 'text-tiles' | 'title-rule' | 'statement-message' | 'display-message' | 'table-note' | 'compact-grid' | 'portraits' | 'heading-tracks' | 'note-band' | 'figure-row' | 'run-in';
/**
 * The guarded rules, tried in this order when the full set does not pass the guard: the smallest change first. LH-112's display size is
 * tried last, so it never displaces an arrangement of wave 3 or 4 (a lead plus stack, paragraph columns, a pull line) that reads well
 * without it.
 */
const GUARDED_RULES: readonly GuardedRule[] = ['half-steps', 'nested-gaps', 'empty-columns', 'centered-column', 'region-measure', 'mixed-cards', 'short-row', 'metric-start', 'metric-figure', 'quote-beside', 'quote-card', 'emphasis-band', 'featured-card', 'pull-quote', 'timeline-status', 'metric-tiles', 'long-text-rows', 'reading-measure', 'lead-stack', 'paragraph-columns', 'bar-chart-share', 'metric-display', 'eyebrow', 'list-rows', 'pair-rows', 'step-badges', 'numerals', 'delta-pill', 'check-tiles', 'tier-cards', 'pillar-words', 'icons', 'icon-chips', 'icon-cards', 'text-tiles', 'title-rule', 'statement-message', 'display-message', 'table-note', 'compact-grid', 'portraits', 'heading-tracks', 'note-band', 'figure-row', 'run-in'];
const NO_RULES: ReadonlySet<GuardedRule> = new Set();
/**
 * LH-131, LH-137: the guarded rules that only draw (a featured card, a delta pill, check-mark tiles), held to the slide without them.
 * LH-14: an author's icons too: they are drawing, never worth a text size, so a slide keeps its chips only when every block reads as well:
 * `icons` draws them on compact chips (ICON_CHIP_COMPACT, a line high), `icon-chips` on full ones (ICON_CHIP) where the slide has room.
 * LH-165, LH-162: icon cards and text tiles (CARD_RULES) are no drawing rules: they rearrange the body, so they are tried after these
 * (withCards), and held to the settled slide without them too (composeSlide, NO_STEPS), since a slide without cards may grow its body (LH-48).
 */
const DRAWING_RULES: readonly GuardedRule[] = ['featured-card', 'delta-pill', 'check-tiles', 'icons', 'icon-chips'];
/** LH-131, LH-137: guardedCore composes a slide again with this flag to see it without the drawing rules. */
const NO_DRAWING = Symbol('opf.noDrawing');
/** LH-39: the rules a slide is first composed with: every one but `metric-figure`, which is tried on top of the rules the guard keeps (guardedCompose), and LH-165's CARD_RULES (withCards). */
const CORE_RULES: ReadonlySet<GuardedRule> = new Set(GUARDED_RULES.filter(rule => rule !== 'metric-figure' && rule !== 'icon-cards' && rule !== 'text-tiles'));
/** LH-165, LH-162: icon cards and text tiles, tried on top of the rules the guard keeps (withCards). */
const CARD_RULES: readonly GuardedRule[] = ['icon-cards', 'text-tiles'];
/** LH-39: the rules (and seeds) a guarded composition was kept with, for the figure trial on top of them. */
const KEPT_RULES = new WeakMap<SlideComposition, { rules: ReadonlySet<GuardedRule>; seeds: Record<symbol, unknown> }>();
/**
 * The guarded rules that move blocks and change gaps without changing the size any block asks for. When only these changed something
 * and the composition has no finding, no word split, no prose under the minimum measure and every block at the size it asked for
 * (AT_REQUEST), the slide without them cannot set a block larger, so the guard keeps it without composing that slide.
 */
const PLACEMENT_RULES: ReadonlySet<GuardedRule> = new Set(['compact-grid', 'nested-gaps', 'reading-measure', 'long-text-rows', 'centered-column', 'region-measure', 'mixed-cards', 'short-row', 'metric-start', 'title-rule', 'heading-tracks']);
const AT_REQUEST = new WeakSet<SlideComposition>();
/**
 * LH-132 review: compositions in which an automatic team portrait had no room (placePerson fell back to the avatar inside the portraits'
 * row or grid). The guard never keeps one: the slide keeps its arrangement without the rule, its avatars on the card tops.
 */
const PORTRAIT_FALLBACK = new WeakSet<SlideComposition>();
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
/**
 * LH-05: the compositions whose grid of short texts hugs (`compact-grid`). growBody grows such a body further than other bodies: up to
 * COMPACT_GRID_STEPS steps, past a list's display size (GRID_GROW lifts the cap to COMPACT_GRID_DISPLAY), while every text keeps the line
 * count it has and nothing overflows, since a hugging grid fills little however large its one-line texts get.
 */
const COMPACT_GRIDS = new WeakSet<SlideComposition>(), GRID_GROW = Symbol('opf.gridGrow'), NO_COMPACT_GRID = Symbol('opf.noCompactGrid');
const COMPACT_GRID_STEPS = 8, COMPACT_GRID_DISPLAY = 56;
/** LH-169: the composed lists drawn as a row of figures (figureRows). */
const FIGURE_ROW_ITEMS = new WeakSet<ComposedItem>();
/** LH-165, LH-162: the compositions that draw icon cards or text tiles, whose text grows inside its cards (no LH-48 body growth or centering). */
const CARD_GRIDS = new WeakSet<SlideComposition>();
/**
 * LH-165: an agenda's icon lists and the number each starts from (composeLayout's iconAgendas), by composition, and the option that seeds
 * them into the slide composed across the body (withCards), which has no `numbered` region to find them in.
 */
const ICON_AGENDAS = new WeakMap<SlideComposition, Map<string, number>>(), AGENDA_STARTS = Symbol('opf.agendaStarts');
/** LH-07: composeSlide composes a slide again with this flag to see it without step badges (the rule `step-badges` off). */
const NO_STEPS = Symbol('opf.noSteps');
/** LH-170: composeSlide composes a slide again with this flag to see it without the closing note's band (the rule `note-band` off). */
const NO_NOTE_BAND = Symbol('opf.noNoteBand');
/** LH-170: the compositions that draw a closing note on the band (`note-band`). */
const NOTE_BANDS = new WeakSet<SlideComposition>();
/**
 * LH-132 review: whether any picture of `next` (an image block's frame, a quote's photo) covers less area than the same picture of `base`,
 * so a portrait never ends smaller than the picture the slide draws without the rule.
 */
function picturesShrink(next: SlideComposition, base: SlideComposition): boolean {
  const areas = (composed: SlideComposition) => new Map(composed.items.flatMap(item => [...(item.image ? [[item.path, item.image.box.width * item.image.box.height] as const] : []), ...(item.quoteLayout?.photo ? [[`${item.path}.photo`, item.quoteLayout.photo.box.width * item.quoteLayout.photo.box.height] as const] : [])]));
  const before = areas(base);
  for (const [path, area] of areas(next)) { const was = before.get(path); if (was !== undefined && area < was - 1) return true; }
  return false;
}
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
  // LH-165, LH-162: cards take the body's height and grow their own text (composeLayout's iconCards and textTiles).
  if (LEAD_STACKS.has(result) || CARD_GRIDS.has(result)) return undefined;
  const body = result.items.filter(item => !headings.has(item.field) && !item.eyebrow && !(item.emphasis && result.emphasis !== undefined && result.emphasis.shape !== 'card') && !item.quoteLayout?.rule);
  // A template slide's body is its regions: blocks below the grid (a section's notes) are not a body that should grow.
  // LH-169: a row of figures is a list in columns that grows as its list would (figureRows draws it at the size the list has).
  if (body.length < 2 || !body.every(item => (item.field === 'text' || item.field === 'items' || item.field === 'bullets') && item.text && (!item.listColumns || FIGURE_ROW_ITEMS.has(item)) && !item.caption && (!result.regions || item.region !== undefined))) return undefined;
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
  if (!start) return undefined;
  // LH-168: a row of steps that already fills LONE_FILL keeps its size and is only centered under the heading (as the same steps in columns
  // are when they grow), so the badges do not sit against the title with the space left below the text.
  if (start.fill >= LONE_FILL) {
    if (!result.steps?.some(entry => entry.form === 'row') || bodyReadability(result, options).sizes.some(entry => entry.atFloor)) return undefined;
    const before = trackQuality(result, options), floor = snapFontSizeUp((result.composition.minFontSize ?? 16) * Math.min(result.width, result.height) / 720);
    const centered = composeVariant(input, { ...options, [GROW]: 0, [CENTER]: true } as ComposeSlideOptions, before, floor);
    return centered && overflowCount(centered) === 0 && !shrinks(centered, result, options) && centered.steps?.some(entry => entry.form === 'row') ? centered : undefined;
  }
  // A body set at the readability floor is not short content: LH-83 may recompose it (settle), and growing would keep the floor layout.
  if (bodyReadability(result, options).sizes.some(entry => entry.atFloor)) return undefined;
  if (stackedTemplate(options, result)) return undefined;
  const smallest = (composed: SlideComposition) => Math.min(...composed.items.filter(item => !headings.has(item.field) && !item.eyebrow && !(item.emphasis && composed.emphasis !== undefined && composed.emphasis.shape !== 'card') && !item.quoteLayout?.rule).map(item => item.text!.fontSize));
  const before = trackQuality(result, options), floor = snapFontSizeUp((result.composition.minFontSize ?? 16) * Math.min(result.width, result.height) / 720);
  const avatar = portraitQuotes(result) ? { [AVATAR_QUOTES]: true } : {};
  const attempt = (extra: Record<symbol, unknown>) => composeVariant(input, { ...options, ...avatar, ...extra } as ComposeSlideOptions, before, floor);
  // LH-114: a body with a pull line is one stack with it at the top of the body, so it grows but is not centered.
  const pulled = result.items.some(item => item.quoteLayout?.rule);
  // One climb of LH-48's steps from `from` with `extra` options, then the centered body: the largest step that adds no finding, sets every
  // block larger and fills at most LONE_TARGET, and passes `accept`. LH-132: each step is composed with the avatar (AVATAR_QUOTES), and the
  // step it ends on (stepsOf) draws a quote's portrait again where that sets nothing smaller (withPortraits).
  const stepsOf = new WeakMap<SlideComposition, Record<symbol, unknown>>();
  const climb = (from: SlideComposition, extra: Record<symbol, unknown>, limit: number, accept: (grown: SlideComposition) => boolean): SlideComposition => {
    let best = from, steps = 0;
    for (let next = 1; next <= limit; next++) {
      const grown = attempt({ [GROW]: next, ...extra }), fill = grown && bodyFill(grown);
      if (!grown || !fill || overflowCount(grown) > 0 || fill.fill > LONE_TARGET || smallest(grown) <= smallest(best) + FONT_GRID_EPSILON || shrinks(grown, best, options) || !accept(grown)) break;
      best = grown; steps = next;
    }
    const centered = pulled ? undefined : attempt({ [GROW]: steps, [CENTER]: true, ...extra }), fill = centered && bodyFill(centered);
    if (centered && fill && overflowCount(centered) === 0 && !shrinks(centered, best, options)) { stepsOf.set(centered, { [GROW]: steps, [CENTER]: true, ...extra }); return centered; }
    if (best !== from) stepsOf.set(best, { [GROW]: steps, ...extra });
    return best;
  };
  const done = (grown: SlideComposition | undefined): SlideComposition | undefined => !grown || grown === result ? undefined : portraitQuotes(result) && stepsOf.has(grown) ? withPortraits(input, options, grown, stepsOf.get(grown)!, before, floor) : grown;
  if (!COMPACT_GRIDS.has(result)) return done(climb(result, {}, 3, () => true));
  // LH-05: a hugging grid of short texts grows further than other bodies: past a list's display size, up to COMPACT_GRID_STEPS steps, while
  // every text that was on one line spread over the area (LH-43, what the slide had before) stays on one line. The grid never ends smaller
  // than that spread body: a growth that would end smaller lets the texts wrap more, and one that still ends smaller is the spread body itself.
  const lines = (item: ComposedItem) => item.text ? 'richLines' in item.text ? (item.text as RichTextFit).richLines.length : item.text.lines.length : 0;
  const spread = attempt({ [NO_COMPACT_GRID]: true }), plain = spread ? climb(spread, { [NO_COMPACT_GRID]: true }, 3, () => true) : undefined, reference = plain ?? result;
  if (spread && !stepsOf.has(spread)) stepsOf.set(spread, { [NO_COMPACT_GRID]: true });
  // The lines each text had spread over the area: a text on one line stays on one line, one that wrapped may wrap as it did.
  const keepsLines = (grown: SlideComposition) => grown.items.every(item => { const was = reference.items.find(entry => entry.path === item.path); return !was || lines(item) <= lines(was); });
  const floorSize = plain ? smallest(plain) : smallest(result);
  for (const accept of [keepsLines, () => true]) {
    const grown = climb(result, { [GRID_GROW]: true }, COMPACT_GRID_STEPS, accept);
    if (smallest(grown) >= floorSize - FONT_GRID_EPSILON) return done(grown);
  }
  return plain && plain !== result ? done(plain) : undefined;
}
/**
 * Compose a validated Slide. Layout resolution remains the caller's responsibility.
 *
 * The wave 3 size guard, one for every rule (guardedCompose): no rule of wave 3 sets a block smaller than wave 2 does, unless that
 * removes a finding. Then the slide settles (settle): an under-filled body grows (LH-48), a template slide may be recomposed as the
 * automatic grid (LH-49 for a short plot, LH-83 at the floor), and an automatic slide may give its picture or chart a track (LH-80,
 * LH-49); each of those arrangements is guarded the same way and kept only when it reads as well as the guarded composition.
 */
/** SH-04: composeLayout's overlay pass: compose the slide's `shapes` onto this composition (composeSlide's last step) and return it. */
const OVERLAY_ONTO = Symbol('opf.overlayOnto');
export function composeSlide(input: unknown, options: ComposeSlideOptions = {}): SlideComposition {
  const result = composeSlideBody(input, options);
  if (options.messageSurface) result.surface = options.messageSurface;
  // SH-04: the overlay goes on the slide's final composition (every arrangement, growth and recomposition settled), so it never moves
  // content and follows the blocks it is attached to; its text is fitted by the slide's own fitter (composeLayout's overlay pass).
  if (hasOverlayShapes(input)) composeLayout(input, { ...options, [OVERLAY_ONTO]: result } as ComposeSlideOptions);
  return result;
}
function composeSlideBody(input: unknown, options: ComposeSlideOptions): SlideComposition {
  if ((options as Record<symbol, unknown>)[RULES] !== undefined) return composeArranged(input, options);
  const result = settled(input, options);
  if (!result.steps) return withPictureScrim(input, options, result);
  // LH-07: step badges are drawing and never worth a size. Their band changes how much of the body a slide fills, and so whether LH-48
  // grows it, so the guard alone, which holds each arrangement to the slide's own composition, cannot see a block that the whole slide
  // without badges would have grown: the slide is settled again without them and keeps the badges only when every block reads as well.
  const plainOptions = { ...options, [NO_STEPS]: true } as ComposeSlideOptions, plain = settled(input, plainOptions);
  const floor = snapFontSizeUp((plain.composition.minFontSize ?? 16) * Math.min(plain.width, plain.height) / 720);
  // LH-144: a cap (composition.maxFontSize, a paginated page) sets both at the same size, so it decides on the slide without the cap, as
  // the first page decided: a page does not gain or lose its badges because the cap evened the sizes out.
  const own = record(record(input).composition);
  if (own.maxFontSize !== undefined) {
    const { maxFontSize: _cap, ...rest } = own, free = { ...record(input), composition: rest };
    const freeResult = settled(free, options), freePlain = settled(free, plainOptions);
    return withPictureScrim(input, options, freeResult.steps && stepsRead(freePlain, freeResult, options, floor) ? result : plain);
  }
  return withPictureScrim(input, options, stepsRead(plain, result, options, floor) ? result : plain);
}
/**
 * The guarded composition, settled. LH-170: a closing note on the band (`note-band`) keeps out of LH-48's growth, which may grow the same
 * note in its region on the slide without the band, so the band is held to that slide: its text is set at the size the note has there
 * (EMPHASIS_SIZE), and the band is kept only when, at that size, no block reads smaller than on the slide without it.
 */
function settled(input: unknown, options: ComposeSlideOptions): SlideComposition {
  const result = settle(input, options, guardedCompose(input, options));
  if (!NOTE_BANDS.has(result) || (options as Record<symbol, unknown>)[NO_NOTE_BAND] === true) return result;
  const plainOptions = { ...options, [NO_NOTE_BAND]: true } as ComposeSlideOptions, plain = settle(input, plainOptions, guardedCompose(input, plainOptions));
  const notePath = `${result.emphasis!.path}.text`, sizeOf = (composed: SlideComposition) => composed.items.find(item => item.path === notePath)?.text?.fontSize ?? 0;
  const plainNote = sizeOf(plain), holds = (composed: SlideComposition) => NOTE_BANDS.has(composed) && sizeOf(composed) >= plainNote - FONT_GRID_EPSILON && !shrinks(composed, plain, options);
  if (holds(result)) return result;
  if (sizeOf(result) >= plainNote - FONT_GRID_EPSILON) return plain;
  const sized = { ...options, [EMPHASIS_SIZE]: plainNote } as ComposeSlideOptions, larger = settle(input, sized, guardedCompose(input, sized));
  return holds(larger) ? larger : plain;
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
  // LH-158: the heading group on its panel reads on the panel's solid background color, so it needs no scrim of its own.
  const panel = result.pictureText?.panel, onPanel = (box: LayoutBox) => !!panel && box.x >= panel.box.x - .5 && box.x + box.width <= panel.box.x + panel.box.width + .5;
  for (const item of result.items) {
    if (onPanel(item.box)) continue;
    if (item.caption) body.push(item.caption.box);
    if (item.text && !item.frameBox && !item.emphasis) line = Math.max(line, item.text.lineHeight);
    if (item.frameBox || item.emphasis || item.codeLayout || ['image', 'video', 'code', 'table', 'diagram'].includes(item.field)) continue;
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
  // The panel is drawn first, as an opaque scrim in the slide background color: the same native rectangle in both engines.
  if (panel) {
    const color = roles.background.slice(0, 7).toUpperCase(), reached = colorContrast(roles.text, color) ?? 21;
    scrims.unshift({ path: `${background.path}.textPlacement`, color, opacity: 1, form: 'panel', edge: panel.edge, box: panel.box, axis: 'horizontal', stops: [{ position: 0, opacity: 1 }, { position: 1, opacity: 1 }], text: panel.box, contrast: Math.round(reached * 100) / 100, target: SCRIM_TARGET_CONTRAST, basis: 'worst-case' });
  }
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
/**
 * LH-131, LH-137: the drawing rules (DRAWING_RULES) only draw, so they never change what the other rules give a slide: a slide that draws a
 * featured card, a delta pill or check-mark tiles is also composed under the guard without them (NO_DRAWING), and keeps the drawing only
 * when it reads as well as that (readsAsWell: no block smaller, no more findings); else each drawing rule is tried on its own on top of
 * the rules that slide kept. Slides that draw none of them are composed once.
 *
 * LH-165, LH-162: icon cards and text tiles (CARD_RULES) are tried last, on top of the rules (and seeds) the slide kept, as LH-39's figure
 * is (withCards): they rearrange the whole body, so they are never part of the first composition, whose failure would take every rule
 * that did not fire (an author's icons among them) off the slide.
 */
function guardedCore(input: unknown, options: ComposeSlideOptions): SlideComposition {
  return withCards(input, options, guardedDrawing(input, options));
}
/**
 * LH-165, LH-162: the slide with icon cards or text tiles, composed with the rules `result` was kept with and CARD_RULES, when they draw and
 * it reads as well as `result` (readsAsWell: no block smaller, no more findings, no more prose under the minimum measure) with as much of
 * its body at the floor; else `result`.
 */
function withCards(input: unknown, options: ComposeSlideOptions, result: SlideComposition): SlideComposition {
  if ((options as Record<symbol, unknown>)[NO_DRAWING] === true || (options as Record<symbol, unknown>)[NO_STEPS] === true || (options as Record<symbol, unknown>)[LAYOUT_MASTER] === true) return result;
  // Only a slide that may draw them is composed again: a body of one list whose entries all carry an icon, groups that all carry one, or
  // short paragraphs at the root of an automatic slide.
  const body = result.items.filter(item => !headings.has(item.field) && !item.eyebrow), blocks = record(input).blocks, iconed = (value: unknown) => record(value).icon !== undefined;
  const list = body.length === 1 && body[0]!.field === 'items' && Array.isArray(body[0]!.value) && body[0]!.value.length >= ICON_CARD_MIN && body[0]!.value.length <= ICON_CARD_MAX && body[0]!.value.every(iconed);
  const groups = Array.isArray(blocks) && blocks.length >= ICON_CARD_MIN && blocks.length <= ICON_CARD_MAX && blocks.every(block => iconed(block) && Array.isArray(record(block).blocks));
  const paragraphs = !result.regions && body.length >= TEXT_TILE_MIN && body.length <= TEXT_TILE_MAX && body.every(item => item.field === 'text');
  if (!list && !groups && !paragraphs) return result;
  // Icon cards draw the icons the slide kept off (`icons`, when the guard kept a rule set without it, as for a figure list drawn as LH-169's
  // row, whose columns have no place for a chip), and their rows share label tracks (`heading-tracks`, placement only): the cards are kept
  // only when they read as well as the slide without them (better).
  const used = KEPT_RULES.get(result) ?? { rules: CORE_RULES, seeds: {} }, rules = new Set<GuardedRule>([...used.rules, ...CARD_RULES, 'heading-tracks', ...(list || groups ? ['icons' as const] : [])]);
  const scale = Math.min(result.width, result.height) / 720, floor = snapFontSizeUp((result.composition.minFontSize ?? 16) * scale);
  const atFloor = (composed: SlideComposition) => bodyReadability(composed, options).sizes.some(entry => entry.atFloor);
  const better = (next: SlideComposition | undefined, than: SlideComposition): next is SlideComposition => next !== undefined && CARD_GRIDS.has(next) && readsAsWell(trackQuality(than, options), trackQuality(next, options), floor) && atFloor(next) === atFloor(than);
  let best = result, trial: SlideComposition | undefined;
  try { trial = composeArranged(input, { ...options, [RULES]: rules, ...used.seeds } as ComposeSlideOptions); } catch (error) { if (!(error instanceof OPFCompositionError)) throw error; }
  if (better(trial, result)) { KEPT_RULES.set(trial, { rules, seeds: used.seeds }); best = trial; }
  // A layout's lone list (an agenda's in its half of the slide) may draw its cards across the whole body under the heading instead, as
  // Claude Design draws n05: the slide composed as the automatic grid (LH-83's recomposition, which draws the cards there) is kept when its
  // text reads at least as large as the better of the layout with and without cards (readsAsWell, LH-149's half steps counted at the step
  // under them), and the slide records the recomposition (`recomposed`) as LH-83's does.
  if (list && result.regions && !(options as Record<symbol, unknown>)[RECOMPOSE]) {
    let wide: SlideComposition | undefined;
    const agendas = ICON_AGENDAS.get(trial ?? result) ?? ICON_AGENDAS.get(result);
    try { wide = guardedCompose(input, { ...options, [RECOMPOSE]: true, ...(agendas ? { [AGENDA_STARTS]: agendas } : {}) } as ComposeSlideOptions); } catch (error) { if (!(error instanceof OPFCompositionError)) throw error; }
    if (better(wide, best)) {
      const size = (composed: SlideComposition) => Math.min(...bodyReadability(composed, options).sizes.map(entry => entry.size)) / scale;
      best = { ...wide, recomposed: { layoutSize: size(result), size: size(wide), cards: true } };
      CARD_GRIDS.add(best);
      KEPT_RULES.set(best, KEPT_RULES.get(wide) ?? { rules, seeds: used.seeds });
    }
  }
  return best;
}
function guardedDrawing(input: unknown, options: ComposeSlideOptions): SlideComposition {
  const result = guardedRules(input, options);
  if ((options as Record<symbol, unknown>)[NO_DRAWING] === true || !(result.emphasis?.source === 'featured' || result.items.some(item => item.metricLayout?.deltaPill) || result.steps?.some(step => step.form === 'tiles') || result.icons?.length)) return result;
  const plain = guardedRules(input, { ...options, [NO_DRAWING]: true } as ComposeSlideOptions), used = KEPT_RULES.get(plain);
  const scale = Math.min(plain.width, plain.height) / 720, floor = snapFontSizeUp((plain.composition.minFontSize ?? 16) * scale), before = trackQuality(plain, options);
  // A slide with a body role at the readability floor is recomposed as the automatic grid when that reads better (LH-83, settle); the
  // drawing never decides that, so a drawing that lifts the floor is not taken where the slide without it is at the floor.
  const atFloor = (composed: SlideComposition) => bodyReadability(composed, options).sizes.some(entry => entry.atFloor), plainFloor = atFloor(plain);
  const keeps = (composed: SlideComposition) => readsAsWell(before, trackQuality(composed, options), floor) && atFloor(composed) === plainFloor;
  if (keeps(result)) return result;
  // The slide without the drawing rules keeps its rules without them, so what composes on top of it (LH-39's figure) does not draw either.
  let best = plain, rules: ReadonlySet<GuardedRule> = new Set([...(used?.rules ?? NO_RULES)].filter(rule => !DRAWING_RULES.includes(rule)));
  KEPT_RULES.set(plain, { rules, seeds: used?.seeds ?? {} });
  for (const rule of DRAWING_RULES) {
    const next = new Set([...rules, rule]);
    let trial: SlideComposition;
    try { trial = composeArranged(input, { ...options, [RULES]: next, ...(used?.seeds ?? {}) } as ComposeSlideOptions); } catch (error) { if (error instanceof OPFCompositionError) continue; throw error; }
    if (keeps(trial)) { best = trial; rules = next; KEPT_RULES.set(trial, { rules: next, seeds: used?.seeds ?? {} }); }
  }
  return best;
}
function guardedRules(input: unknown, options: ComposeSlideOptions): SlideComposition {
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
    // LH-132 review: a slide whose portraits fired also keeps every picture at least as large as without the rules (picturesShrink).
    const readsWell = (next: SlideComposition | undefined): next is SlideComposition => next !== undefined && readsAsWell(before, trackQuality(next, options), floor) && !(fired.has('portraits') && (picturesShrink(next, base) || PORTRAIT_FALLBACK.has(next)));
    // LH-68, LH-06: a tile metric starts every role at its stacked size in `base`, and a band or pill text at its block's size there.
    const seeds: Record<symbol, unknown> = {};
    if (fired.has('metric-tiles')) seeds[TILE_FLOORS] = new Map(base.items.filter(item => item.metricLayout).map(item => [item.path, Object.fromEntries(item.metricLayout!.parts.filter(part => part.visible && part.fit).map(part => [part.role, part.fit!.fontSize]))]));
    const surface = result?.emphasis && result.emphasis.shape !== 'card' ? result.emphasis.path : undefined;
    const bandSize = surface !== undefined ? base.items.find(item => item.path === `${surface}.text`)?.text?.fontSize : undefined;
    if (bandSize !== undefined) seeds[EMPHASIS_SIZE] = Math.max(bandSize, Number((options as Record<symbol, unknown>)[EMPHASIS_SIZE] ?? 0));
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
    if (fired.has('portraits') && !keptRules.has('portraits')) return guardedRules(input, { ...options, [NO_PORTRAITS]: true } as ComposeSlideOptions);
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
// LH-129: the text a composition draws, by item path and part (headings by field): its size, its line count, and the height the text
// covers (the union of every text's extent, joined where texts sit side by side). Pictures, charts and other drawings do not count.
// LH-148: `breaks`, the words of each line of a title or subtitle, so growTemplate can tell where a grown heading breaks. LH-130:
// `even`, whether a title's lines read as one balanced block (evenLines).
function textExtent(result: SlideComposition): { sizes: Map<string, number>; lines: Map<string, number>; breaks: Map<string, string>; even: Map<string, boolean>; covered: number; top: number; bottom: number } {
  const sizes = new Map<string, number>(), lines = new Map<string, number>(), breaks = new Map<string, string>(), even = new Map<string, boolean>(), extents: [number, number][] = [];
  const lineCount = (fit: TextFit | RichTextFit) => 'richLines' in fit ? (fit as RichTextFit).richLines.length : fit.lines.length;
  const lineWords = (fit: TextFit | RichTextFit) => ('richLines' in fit ? (fit as RichTextFit).richLines.map(line => line.fragments.map(fragment => fragment.kind === 'tab' ? ' ' : fragment.text).join('')) : fit.lines).map(line => line.trim().replace(/\s+/gu, ' ')).join('\n');
  const textHeight = (fit: TextFit | RichTextFit) => 'height' in fit && typeof fit.height === 'number' ? fit.height : Math.max(fit.lines.length * fit.lineHeight, fit.placement?.height ?? 0);
  for (const item of result.items) {
    const key = headings.has(item.field) ? `${item.path}:${item.field}` : item.path, internal = item.quoteLayout ?? item.codeLayout ?? item.metricLayout ?? item.timelineLayout;
    if (internal) {
      for (const part of internal.parts as readonly { role: string; box: LayoutBox; fit?: { fontSize: number }; visible?: boolean }[]) {
        if (part.visible === false || !part.fit) continue;
        sizes.set(`${key}:${part.role}`, Math.min(sizes.get(`${key}:${part.role}`) ?? Infinity, part.fit.fontSize));
        extents.push([part.box.y, part.box.y + part.box.height]);
      }
    } else if (item.text) {
      sizes.set(key, Math.min(sizes.get(key) ?? Infinity, item.text.fontSize));
      lines.set(key, (lines.get(key) ?? 0) + lineCount(item.text));
      if (item.field === 'title' || item.field === 'subtitle') breaks.set(key, lineWords(item.text));
      if (item.field === 'title') even.set(key, evenLines(item.text, lineWords(item.text).split('\n')));
      extents.push([item.box.y, item.box.y + Math.min(item.box.height, textHeight(item.text))]);
    }
  }
  let covered = 0, reach = -Infinity;
  for (const [from, to] of extents.sort((a, b) => a[0] - b[0])) { if (to > reach) { covered += to - Math.max(from, reach); reach = to; } }
  return { sizes, lines, breaks, even, covered, top: Math.min(...extents.map(entry => entry[0])), bottom: reach };
}
/** LH-130: the shortest line of a display title that wraps is at least this share of its longest (Claude Design's two-line covers). */
const EVEN_LINE_SHARE = .5;
/** LH-130: a one-letter word ("A", "à", "y") or an English article, which no line of a display title but the last ends with. */
const DANGLING_WORD = /(?:^|\s)(?:\p{L}|an|the)$/iu;
// LH-130: whether a title reads as one balanced block: its shortest line at least EVEN_LINE_SHARE of its longest (measured widths where
// the fit has them, characters otherwise) and no line but the last ending in a dangling word ("A smaller pilot. A").
function evenLines(fit: TextFit | RichTextFit, words: readonly string[]): boolean {
  const measured = 'richLines' in fit ? (fit as RichTextFit).richLines.map(line => line.width) : ((fit as Partial<SourceTextFit>).sourceLines?.map(line => line.width) ?? fit.placement?.lines.map(line => line.width));
  const widths = measured && measured.length === words.length ? measured : words.map(line => line.length);
  return Math.min(...widths) >= EVEN_LINE_SHARE * Math.max(...widths) && words.slice(0, -1).every(line => !DANGLING_WORD.test(line));
}
/**
 * The guarded composition (guardedCore), then LH-39's figure on one line: the rules it kept plus `metric-figure`, taken when a figure
 * would wrap otherwise and the slide reads as well (readsAsWellFigure: a split figure may take the next smaller size, and only it).
 */
function guardedCompose(input: unknown, options: ComposeSlideOptions): SlideComposition {
  const plain = guardedCore(input, options), used = KEPT_RULES.get(plain);
  // Wave 5: the rule changes only a metric's layout, so a slide that composes no metric is not composed again for it.
  if (!used || !plain.items.some(item => item.metricLayout)) return plain;
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
/** LH-09: a message of at most this many words (messageWords) is short: it is drawn at display size. LH-69: a text of at most SHORT_TEXT_WORDS is a lone label. */
export const SHORT_MESSAGE_WORDS = 25, SHORT_TEXT_WORDS = 4;
/** LH-09: a short message grows up to this display size; LH-69: a lone short text up to the display title's (HEADING_DISPLAY_SIZES.title). */
export const MESSAGE_DISPLAY_SIZE = 56;
/** LH-09: a message drawn at display size takes at most this many balanced lines. */
export const MESSAGE_DISPLAY_LINES = 4;
// LH-09: the words of a text in any language: its space-separated words, where a script written without spaces (Han, Kana, Thai, Lao,
// Khmer, Myanmar) counts about two characters a word.
const UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/gu;
export function messageWords(value: unknown): number {
  const text = annotationText(value).trim();
  if (!text) return 0;
  const unspaced = text.match(UNSPACED)?.length ?? 0, spaced = text.replace(UNSPACED, ' ').trim();
  return (spaced ? spaced.split(/\s+/u).length : 0) + Math.ceil(unspaced / 2);
}
/** The payload fields a slide's body holds (its own and its blocks'), or undefined when a block nests more blocks. */
function bodyPayloads(slide: Record<string, any>): { field: string; host: Record<string, any> }[] | undefined {
  const empty = (value: unknown) => value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
  const payloads: { field: string; host: Record<string, any> }[] = [];
  for (const host of [slide, ...(Array.isArray(slide.blocks) ? slide.blocks.map(record) : [])]) {
    if (host !== slide && !empty(host.blocks)) return undefined;
    for (const field of fields) if (!empty(host[field])) payloads.push({ field, host });
  }
  return payloads;
}
/** LH-164: the one payload a slide's body holds (its field and the block or slide that carries it), or undefined for no body, several payloads or nested blocks. */
export function lonePayload(slide: Record<string, any>): { field: string; host: Record<string, any> } | undefined {
  const payloads = bodyPayloads(slide);
  return payloads?.length === 1 ? payloads[0] : undefined;
}
/**
 * LH-09: how a stacked record with one primary region (the statement) sets a slide with one block. `title`: the title is the statement
 * (a sentence over a paragraph, n27, n29), drawn at display size under LH-130's accent rule with the paragraph at its size below.
 * `body`: the block is the message (a metric, n28, or a text under a title of at most SHORT_TEXT_WORDS words that only labels it), so
 * the title is the running head at the top of the slide and the block fills the body as a lone block (statementTemplate). Undefined for
 * any other slide: no body (the headings are the message, LH-129), a quote, several blocks, a subtitle. With no title the block is the message.
 */
export function statementMessage(slide: Record<string, any>, plan: LayoutTemplate, fill = true): 'title' | 'body' | undefined {
  if (plan.stack === undefined || plan.subtitle || plan.regions.length !== 1 || plan.regions[0]!.role !== 'primary') return undefined;
  const title = annotationText(slide.title).trim();
  if (annotationText(slide.subtitle).trim()) return undefined;
  const found = bodyPayloads(slide);
  if (found?.length !== 1) return undefined;
  const payloads = found.map(entry => entry.field);
  // A slide with no title has only its block to say: the block is the message.
  const label = !title || messageWords(slide.title) <= SHORT_TEXT_WORDS && !/[.!?\u3002\uff01\uff1f\u2026\u06d4\u0964]$/u.test(title);
  // With fill off nothing grows, so the stack stays as the record sets it.
  return payloads[0] === 'metric' || (payloads[0] === 'text' && label) ? fill ? 'body' : undefined : payloads[0] === 'text' ? 'title' : undefined;
}
/**
 * LH-09: the template a slide is composed with. A statement whose block is the message (statementMessage `body`) is composed as a
 * content slide: the stack gives way, the title takes its auto row at the top and the message's row the rest of the body, where the
 * lone block grows (fillLone), as Claude Design sets n28's runway figure under a small running head.
 */
function statementTemplate(plan: LayoutTemplate): LayoutTemplate {
  const row = plan.areas.find(area => area.name === plan.regions[0]!.name)?.row;
  if (row === undefined) return plan;
  const { stack: _stack, ...rest } = plan;
  return { ...rest, rows: plan.rows.map((size, index) => index === row ? 1 : size) };
}
/** LH-09: compositions whose statement record gave way to a content slide (statementTemplate): LH-48 and LH-102 treat them as one. */
const STATEMENT_BODIES = new WeakSet<SlideComposition>();
/** LH-09: compositions of a statement whose title is the message over its paragraph (statementMessage `title`, growTemplate). */
const STATEMENT_TITLES = new WeakSet<SlideComposition>();
/** Whether `result` was composed from a stacked record (statement, quote, closing) that kept its stack. */
const stackedTemplate = (options: ComposeSlideOptions, result: SlideComposition): boolean => isLayoutTemplate(options.layout) && layoutTemplate(options.layout).stack !== undefined && !STATEMENT_BODIES.has(result);
/**
 * LH-129: LH-48's fill for the layout templates that set their message in the middle of the slide. A stacked record (statement, quote,
 * closing) grows its body: its paragraphs and lists one, two or three steps of the type scale larger (GROW, up to a list's display
 * size), its quotes by the scale's ratio on every role. A slide whose headings are its message (HEADING_MESSAGES: a cover, a section, a
 * closing, a slide with no body and no layout record) grows its title, subtitle and tag the same number of steps (HEADING_STEPS), each up to its display size
 * (HEADING_DISPLAY_SIZES); a title over a primary block (a quote's, a statement's) keeps its size, so it never outshouts the message.
 * The largest step is kept at which nothing overflows, every text is at least as large as at the step before and one is larger, no
 * heading takes more lines than at its role size (a display title may take two balanced lines, LH-130), the slide reads as well under the guard (composeVariant, readsAsWell, shrinks), and
 * the text covers at most LONE_TARGET of the content box (as LH-48 grows a body). The region structure is the record's: the stack
 * or the centered title area places the larger text as it placed the smaller.
 */
/** LH-158: how a slide's heading group reads on its picture: on the panel, on the bare picture, or not (on the scrim, or under the author's overlay). */
const pictureReading = (composed: SlideComposition): string => {
  const placed = composed.pictureText;
  return !placed ? '' : placed.panel ? 'panel' : placed.candidates.find(candidate => candidate.placement === placed.placement)?.reads ? 'reads' : placed.source;
};
function growTemplate(input: unknown, options: ComposeSlideOptions, result: SlideComposition): SlideComposition | undefined {
  if (options.fill === false || overflowCount(result) > 0) return undefined;
  const stacked = stackedTemplate(options, result), message = HEADING_MESSAGES.has(result);
  if (!stacked && !message) return undefined;
  // A body set at the readability floor is not short content.
  if (bodyReadability(result, options).sizes.some(entry => entry.atFloor)) return undefined;
  const scale = Math.min(result.width, result.height) / 720, floor = snapFontSizeUp((result.composition.minFontSize ?? 16) * scale), before = trackQuality(result, options);
  // The frame the text fills: the content box; on a slide with no layout record, whose content box is what the headings leave, the
  // slide inside its padding down to the content box's foot (where the automatic composition centers a cover).
  const start = textExtent(result), frameBottom = result.contentBox.y + result.contentBox.height;
  const frameTop = result.regions ? result.contentBox.y : Math.min(result.contentBox.y, (result.composition.padding ?? .08) * Math.min(result.width, result.height)), height = frameBottom - frameTop;
  if (height <= 0 || start.covered >= LONE_TARGET * height) return undefined;
  let best = result, bestText = start, bestExtra: Record<symbol, number> = {};
  const avatar = portraitQuotes(result) ? { [AVATAR_QUOTES]: true } : {}, grownBy = (steps: number) => ({ ...(stacked ? { [GROW]: steps } : {}), ...(message ? { [HEADING_STEPS]: steps } : {}) });
  const arrangement = (composed: SlideComposition) => (composed.regions ?? []).map(region => `${region.name}:${region.arrangement ?? '-'}:${region.content.join()}`).join(';');
  const proseSizes = (composed: SlideComposition) => new Set(composed.items.filter(item => !headings.has(item.field) && (item.field === 'text' || item.field === 'items' || item.field === 'bullets') && item.text && !(item.emphasis && composed.emphasis !== undefined && composed.emphasis.shape !== 'card')).map(item => item.text!.fontSize));
  // One step: true when it is kept.
  const step = (extra: Record<symbol, number>): boolean => {
    const grown = composeVariant(input, { ...options, ...avatar, ...extra } as ComposeSlideOptions, before, floor);
    if (!grown || overflowCount(grown) > 0 || HEADINGS_OFF_SCALE.has(grown) || !readsAsWell(before, trackQuality(grown, options), floor) || shrinks(grown, best, options)) return false;
    // The record's structure stays: every region keeps its arrangement and blocks, and an emphasis surface (LH-06's band or pill) stays;
    // LH-158: so does how a heading group on a picture reads (on the bare picture, on the scrim or on the panel): a larger group may move to
    // another place that reads, but not from reading to a scrim or off its panel.
    if (arrangement(grown) !== arrangement(result) || grown.emphasis?.path !== result.emphasis?.path || grown.emphasis?.shape !== result.emphasis?.shape || pictureReading(grown) !== pictureReading(result)) return false;
    // Paragraphs and lists that shared one size keep one size (LH-43): a long one that fits only a step lower holds the others there.
    if (proseSizes(result).size <= 1 && proseSizes(grown).size > 1) return false;
    const text = textExtent(grown);
    const kept = [...bestText.sizes].every(([key, size]) => (text.sizes.get(key) ?? 0) >= size - FONT_GRID_EPSILON), larger = [...text.sizes].some(([key, size]) => size > (bestText.sizes.get(key) ?? Infinity) + FONT_GRID_EPSILON);
    // No heading takes more lines than at its role size, except LH-130's display title: a title that is the slide's message and fits one
    // line at its role size may grow onto a second line, as Claude Design sets a long cover title in two lines at display size, when the
    // two lines read as one balanced block (evenLines; WI-4's balancer chose the break).
    const wraps = [...start.lines].some(([key, count]) => {
      if (!(key.endsWith(':title') || key.endsWith(':subtitle') || key.endsWith(':tag'))) return false;
      const now = text.lines.get(key) ?? 0;
      return now > count && !(message && key.endsWith(':title') && count === 1 && now === 2 && text.even.get(key) === true);
    });
    // LH-148: a wrapped title or subtitle keeps the lines WI-4 balanced at its role size. Line widths grow in proportion with the size, so
    // the balancer picks the same breaks at a larger size unless its best line no longer fits the width ("A smaller pilot. / A clearer
    // decision." would turn into "A smaller pilot. A / clearer decision."): that step is not kept, and the heading stays at the largest
    // step that keeps its breaks.
    // A title that LH-130 let take a second line keeps that break at the steps above it in the same way (bestText, not start).
    const rebroken = [...bestText.breaks].some(([key, words]) => words.includes('\n') && text.breaks.get(key) !== words);
    if (!kept || !larger || wraps || rebroken || text.covered > LONE_TARGET * height || text.top < frameTop - 1 || text.bottom > frameBottom + 1) return false;
    best = grown; bestText = text; bestExtra = extra;
    return true;
  };
  // LH-09: a statement whose title is the message over its paragraph (statementMessage `title`) grows its body first, as any stacked record
  // does, and then its title alone at that body step, so a title that stops at an early step (its breaks, LH-148) never holds the body
  // below the size it reaches on its own.
  if (STATEMENT_TITLES.has(result)) {
    let body = 0;
    for (let steps = 1; steps <= 3 && step({ [GROW]: steps }); steps++) body = steps;
    for (let steps = 1; steps <= 3 && step({ [GROW]: body, [HEADING_STEPS]: steps }); steps++);
  } else for (let steps = 1; steps <= 3 && step(grownBy(steps)); steps++);
  // LH-132: the steps are composed with the avatar (AVATAR_QUOTES); the step kept draws a quote's portrait again where that sets nothing smaller.
  return best === result ? undefined : portraitQuotes(result) ? withPortraits(input, options, best, bestExtra, before, floor) : best;
}
/**
 * The slide after its guarded composition (`result`): a message set in the middle of the slide grows (LH-129, growTemplate); an
 * under-filled body of paragraphs and lists grows (LH-48, growBody); a template slide is recomposed as the automatic grid when the
 * layout leaves a chart's plot too short (LH-49, chartRecomposition) or a body role at the readability floor (LH-83, recomposeAtFloor);
 * an automatic slide gives its one picture or chart a track (LH-80, LH-49, automaticTracks). Each arrangement is composed under the
 * guard (guardedCompose, composeVariant).
 */
function settle(input: unknown, options: ComposeSlideOptions, result: SlideComposition): SlideComposition {
  if ((options as Record<symbol, unknown>)[LAYOUT_MASTER] === true) return result;
  const filled = growTemplate(input, options, result);
  if (filled) return filled;
  const grown = growBody(input, options, result);
  if (grown) return grown;
  if (REGION_MEASURED.has(result) && bodyFill(result)) {
    const plain = { ...options, [NO_REGION_MEASURE]: true } as ComposeSlideOptions, wide = growBody(input, plain, guardedCompose(input, plain));
    if (wide) return wide;
  }
  const kpis = kpiColumn(input, options, result);
  if (kpis) return kpis;
  const noted = tableNote(input, options, result);
  if (noted) return noted;
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
  if (options.fill === false || !result.regions || overflowCount(result) > 0 || !isLayoutTemplate(options.layout) || stackedTemplate(options, result)) return undefined;
  // LH-114 with LH-102: a body with a pull line is one stack with its data at the top of the body (as growBody leaves it), never centered.
  if (result.items.some(item => item.quoteLayout?.rule) || CARD_GRIDS.has(result)) return undefined;
  const bled = new Set(result.regions.filter(region => region.bleed).map(region => region.name));
  const bodyOf = (composed: SlideComposition) => composed.items.filter(item => !headings.has(item.field) && !item.eyebrow && !(item.emphasis && composed.emphasis !== undefined && composed.emphasis.shape !== 'card'));
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
  // LH-132 review: an arrangement whose portraits fired keeps every picture at least as large as without the rules and has no portrait
  // fallen back to the avatar (as guardedRules).
  let plain: SlideComposition | undefined | null = null;
  const unruled = (): SlideComposition | undefined => { if (plain === null) plain = compose(NO_RULES); return plain; };
  const portraitsRead = (next: SlideComposition) => { if (!fired.has('portraits')) return true; const base = unruled(); return !PORTRAIT_FALLBACK.has(next) && !(base && picturesShrink(next, base)); };
  const reads = (next: SlideComposition | undefined) => next !== undefined && readsAsWell(before, trackQuality(next, options), floor) && portraitsRead(next);
  const ruled = compose(CORE_RULES, fired);
  // LH-39: the figure on one line is tried on top of the rules this arrangement keeps, as guardedCompose does.
  const figure = (rules: ReadonlySet<GuardedRule>, current: SlideComposition | undefined): SlideComposition | undefined => {
    if (!current?.items.some(item => item.metricLayout)) return current;
    const collect = new Set<GuardedRule>(), next = compose(new Set([...rules, 'metric-figure']), collect);
    return next && collect.has('metric-figure') && readsAsWellFigure(before, trackQuality(next, options), floor) ? next : current;
  };
  if (!fired.size || reads(ruled)) return figure(CORE_RULES, ruled);
  // As guardedCompose: without the rules, then each rule that fired added on its own while the arrangement still reads as well.
  let kept: ReadonlySet<GuardedRule> = NO_RULES, best = unruled();
  for (const rule of GUARDED_RULES) {
    if (!fired.has(rule)) continue;
    const rules = new Set([...kept, rule]), trial = compose(rules);
    if (reads(trial)) { kept = rules; best = trial; }
  }
  if (fired.has('portraits') && !kept.has('portraits')) return composeVariant(input, { ...options, [NO_PORTRAITS]: true } as ComposeSlideOptions, before, floor);
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
/**
 * LH-149: the paragraphs and lists of a composition set on a half step of the type scale (typeScaleStep's `half`), each with LH-17's
 * step under it. Every choice between arrangements (the guard's rule sets, step badges, tracks, LH-83's recomposition, LH-48's growth)
 * counts such a size at that step (trackQuality, wholeStepSmallest), so a gain of half a step alone (16 to 17 px) keeps the arrangement
 * the slide has: the half steps let siblings sized together lose less, and never change which arrangement wins.
 */
function halfStepFloors(result: SlideComposition): Map<string, number> {
  const scale = Math.min(result.width, result.height) / 720, half = new Map<string, number>(), stepped = (result as unknown as Record<symbol, ReadonlySet<string> | undefined>)[HALF_STEPPED];
  // Only the blocks that shrank onto a half step (composeLayout marks them): a list in columns or a block at its start that happens to
  // be 30 px is no half step of the scale.
  if (!stepped) return half;
  for (const item of result.items) {
    if (!item.text || !stepped.has(item.path)) continue;
    half.set(item.path, Math.min(half.get(item.path) ?? Infinity, typeScaleStep(item.text.fontSize + 1e-6, item.composition.minFontSize ?? 16, scale)));
  }
  return half;
}
/** LH-149: the paths of a composition's paragraphs and lists that shrank onto a half step of the type scale (an own symbol, so copies keep it). */
const HALF_STEPPED = Symbol('opf.halfStepped');
/** LH-149: a composition's smallest body size, a half step counted at the step under it (halfStepFloors). */
function wholeStepSmallest(result: SlideComposition, options: ComposeSlideOptions): number {
  const half = halfStepFloors(result), sizes = [...bodyReadability(result, options).byPath].map(([path, size]) => Math.min(size, half.get(path) ?? Infinity));
  return sizes.length ? Math.min(...sizes) : Infinity;
}
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
  // LH-149: larger counting a half step at the step under it (wholeStepSmallest), so the agenda's badges are not traded for 16 to 17 px.
  const larger = size > layoutSize + FONT_GRID_EPSILON && wholeStepSmallest(automatic, options) > wholeStepSmallest(result, options) + FONT_GRID_EPSILON;
  const fitsMore = size >= layoutSize - FONT_GRID_EPSILON && after.overflows < before.overflows;
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
/** LH-75: composeSlide composes a table and its note again side by side, the table taking this share of the width (TABLE_NOTE_SHARES). */
const TABLE_NOTE = Symbol('opf.tableNote');
/**
 * LH-75: the shares of the width the table tries beside its note, widest first (70:30, then 65:35 and 60:40 when the note's column would
 * be under LH-66's minimum measure), the table's height under which it is short (half the body's) and the note's fewest lines.
 */
const TABLE_NOTE_SHARES: readonly number[] = [.7, .65, .6], TABLE_NOTE_SHORT = .5, TABLE_NOTE_LINES = 2;
/**
 * LH-75: a slide whose body is one short table (under half the body's height) and a note of two or more lines (a plain text block), which the
 * layout or the automatic grid sets one above the other, is composed again with the two side by side, about 70:30, the note on one plain
 * card as tall as the row (Claude Design's note panel beside its table), the row in the middle of the body. The table keeps its words whole.
 * The type steps up by LH-48's steps (GROW, the table's rows with it) to the largest at which the row covers at most LONE_TARGET of the
 * body, nothing overflows and no block is smaller, and no cell wraps that did not wrap stacked (LH-44's one-line cells: a table whose natural
 * width does not fit its share keeps the full width, as does a note whose column would be under LH-66's measure at 60:40). Kept
 * (`recomposed.table` on a template slide, composed as the automatic grid with the record's design as LH-61 does) when it reads as
 * well as `result` (readsAsWell); a template that already sets the note beside the table
 * (table-beside), a slide with promoted regions, a block pinned to a region, a note on an emphasis, a layout master and, on a template
 * slide, `recompose: false` keep their composition.
 */
function tableNote(input: unknown, options: ComposeSlideOptions, result: SlideComposition): SlideComposition | undefined {
  if (options.fill === false || (options as Record<symbol, unknown>)[LAYOUT_MASTER] === true || overflowCount(result) > 0 || (result.regions && options.recompose === false)) return undefined;
  const slide = record(input), blocks = slide.blocks, own = record(slide.composition);
  if (!Array.isArray(blocks) || blocks.length !== 2 || Object.keys(slide).some(key => regionParts(key))) return undefined;
  if ((own.mode !== undefined && own.mode !== 'auto') || own.columns !== undefined || (Array.isArray(own.weights) && own.weights.length)) return undefined;
  const hosts = blocks.map(record);
  if (hosts.some(host => host.region !== undefined || host.placement !== undefined || Array.isArray(host.blocks) || host.caption !== undefined || host.emphasis !== undefined)) return undefined;
  const kinds = hosts.map(host => fields.filter(field => host[field] !== undefined).join());
  if (!(kinds[0] === 'table' && kinds[1] === 'text') && !(kinds[0] === 'text' && kinds[1] === 'table')) return undefined;
  const tableOf = (composed: SlideComposition) => composed.items.find(item => item.field === 'table'), noteOf = (composed: SlideComposition) => composed.items.find(item => item.field === 'text');
  const table = tableOf(result), note = noteOf(result);
  if (!table || !note?.text) return undefined;
  const scale = Math.min(result.width, result.height) / 720, lines = 'richLines' in note.text ? (note.text as RichTextFit).richLines.length : note.text.lines.length;
  const beside = (a: LayoutBox, b: LayoutBox) => a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1;
  // A template that sets the note beside the table already (table-beside) keeps its record's arrangement.
  if (lines < TABLE_NOTE_LINES || (result.regions && beside(table.box, note.box))) return undefined;
  const tableHeight = (item: ComposedItem) => {
    try { return layoutTable(item.value, item.box, { scale, minFontSize: item.composition.minFontSize, fontFamily: options.fontFamilies?.body, ...(options.fontFamilies?.code ? { codeFontFamily: options.fontFamilies.code } : {}), textMeasurement: options.textMeasurement, presentation: options.presentation, ...(item.tableGrowth ? { growth: item.tableGrowth } : {}) }).height; } catch { return Infinity; }
  };
  // Short: the table stacked, its cells unwrapped, takes under half the body (beside the note its wrapped cells make it taller).
  if (tableHeight(table) >= TABLE_NOTE_SHORT * bodyHeight(result)) return undefined;
  const before = trackQuality(result, options), floor = snapFontSizeUp((result.composition.minFontSize ?? 16) * scale);
  let best: SlideComposition | undefined;
  for (const share of TABLE_NOTE_SHARES) {
    for (let steps = 0; steps <= 3; steps++) {
      const extra = { [TABLE_NOTE]: { share }, ...(steps ? { [GROW]: steps } : {}), ...(result.regions ? { [RECOMPOSE]: true } : {}) };
      const next = composeVariant(input, { ...options, ...extra } as ComposeSlideOptions, before, floor), placedTable = next && tableOf(next), placedNote = next && noteOf(next);
      if (!next || !placedTable || !placedNote?.frameBox || overflowCount(next) > 0 || !beside(placedTable.box, placedNote.box)) break;
      const read = trackQuality(next, options);
      // LH-44: no cell of the table wraps that did not wrap stacked (a table too wide for its share keeps the full width), and the slide reads as well.
      if (read.wrappedCells > before.wrappedCells || !readsAsWell(before, read, floor)) break;
      // The row (the note's card is as tall as the row) covers at most LONE_TARGET of the body, as LH-48's grown body does; each step is larger.
      if (placedNote.frameBox.height > LONE_TARGET * bodyHeight(next) || (steps > 0 && shrinks(next, best!, options))) break;
      best = next;
    }
    // The widest share at which the note reads as well wins.
    if (best) break;
  }
  if (!best) return undefined;
  const after = trackQuality(best, options);
  return { ...best, ...(result.regions ? { recomposed: { layoutSize: before.size / scale, size: after.size / scale, table: true as const } } : {}) };
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
  // LH-149: a paragraph or list on a half step counts at the step under it (halfStepFloors), here and so in every comparison of arrangements.
  const half = halfStepFloors(result), pulled = PULL_SIZES.get(result);
  const blocks = new Map([...(pulled ? new Map([...read.byPath, ...pulled]) : read.byPath)].map(([path, size]) => [path, Math.min(size, half.get(path) ?? Infinity)] as const));
  const charts = result.items.filter(item => item.field === 'chart' && item.chart), scale = Math.min(result.width, result.height) / 720;
  const shortPlots = charts.length ? charts.filter(item => shortPlot(item, bodyHeight(result), scale, false)).length : 0;
  return { overflows: read.overflows + unplaced, splitWords: read.splitWords, size: read.sizes.length ? Math.min(...read.sizes.map(entry => entry.size), ...[...half].flatMap(([path, size]) => read.byPath.has(path) ? [size] : [])) : Infinity, total: read.sizes.reduce((sum, entry) => sum + entry.size, 0), narrow: narrow.length, measure, blocks, wrappedCells: read.wrappedCells, shortPlots, splitValues: read.splitValues };
}
/**
 * LH-168: trackQuality with every list of entries with descriptions measured by the smallest size it draws. A list's `fontSize` is its base
 * size: for a plain list the label's, with the description at .82 of it (37 label over 30 description), for a heading list
 * (LH-77, a step beside its badge) the description's, with the label LIST_HEADING_SCALE above it (40 over 32). Comparing the base sizes
 * of the two, as every other comparison does, called the second smaller than the first although every line of it is set larger (32 over 30):
 * the step badges lost on every English slide whose descriptions wrap, and won on short Arabic ones. The size a reader reads is the smallest
 * one drawn, so the badges' decision (stepsRead) accepts them when either measure reads as well.
 */
function drawnQuality(result: SlideComposition, options: ComposeSlideOptions): TrackQuality {
  const quality = trackQuality(result, options);
  for (const item of result.items) {
    const entries = item.text && 'listEntries' in item.text ? (item.text as ListFit).listEntries : undefined;
    if (!entries?.length || !entries.some(entry => entry.description)) continue;
    const drawn = Math.min(...entries.flatMap(entry => [entry.text.fontSize, ...(entry.description ? [entry.description.fontSize] : [])]));
    const was = quality.blocks.get(item.path);
    if (was === undefined || drawn >= was) continue;
    quality.blocks.set(item.path, drawn);
    quality.size = Math.min(quality.size, drawn);
  }
  return quality;
}
/** LH-168: the badges' decision (composeSlide): the steps read as well as the slide without them by base size (readsAsWell, as before) or by the smallest size drawn (drawnQuality). */
function stepsRead(plain: SlideComposition, steps: SlideComposition, options: ComposeSlideOptions, floor: number): boolean {
  return readsAsWell(trackQuality(plain, options), trackQuality(steps, options), floor) || readsAsWell(drawnQuality(plain, options), drawnQuality(steps, options), floor);
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
    if (fit === 'contain' || fit === 'stretch' || host.aspectRatio !== undefined || (host.shape !== undefined && host.shape !== 'rect' && host.shape !== 'roundRect')) return base;
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
  const ruleOn = (rule: GuardedRule) => (!ruleSet || ruleSet.has(rule)) && !(rule === 'region-measure' && (options as Record<symbol, unknown>)[NO_REGION_MEASURE] === true) && !(rule === 'compact-grid' && (options as Record<symbol, unknown>)[NO_COMPACT_GRID] === true) && !((rule === 'step-badges' || rule === 'numerals' || rule === 'icon-cards' || rule === 'text-tiles') && (options as Record<symbol, unknown>)[NO_STEPS] === true) && !((options as Record<symbol, unknown>)[NO_DRAWING] === true && DRAWING_RULES.includes(rule)) && !(rule === 'portraits' && (options as Record<symbol, unknown>)[NO_PORTRAITS] === true) && !(rule === 'note-band' && (options as Record<symbol, unknown>)[NO_NOTE_BAND] === true), fire = (rule: GuardedRule) => { firedRules?.add(rule); };
  let regionMeasured = false, compactGrid = false, cardGrid = false;
  const width = options.width ?? 1280, height = options.height ?? 720;
  if (![width, height].every(value => Number.isFinite(value) && value > 0)) throw new RangeError("Canvas dimensions must be finite and positive.");
  const scale = Math.min(width, height) / 720;
  const deckDirection: TextDirection = options.direction ?? resolveSlideDirection(options.presentation, options.slideIndex);
  const rtl = deckDirection === 'rtl', textDirection = rtl ? 'rtl' as const : undefined;
  // OPF 0.19: a template record (areas and regions) composes through its regions; it is checked first, so an invalid
  // template is refused (OPFLayoutTemplateError) as validate reports it (opf/layout-template, opf/layout-region).
  const recordTemplate: LayoutTemplate | undefined = !recomposing && isLayoutTemplate(layout) ? layoutTemplate(layout) : undefined;
  // LH-09: a statement sets its title or its block as the message (statementMessage, the guarded rule `statement-message`).
  const statement = recordTemplate && ruleOn('statement-message') ? statementMessage(slide, recordTemplate, options.fill !== false) : undefined;
  if (statement) fire('statement-message');
  const template = recordTemplate && statement === 'body' ? statementTemplate(recordTemplate) : recordTemplate;
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
  // LH-158: while a heading group is composed at another alignment on a picture (placeHeadings), the group's fields take it.
  let headingAlignment: 'left' | 'center' | 'right' | undefined;
  const alignmentFor = (field: string): 'left' | 'center' | 'right' =>
    headingAlignment && (field === 'title' || field === 'tag' || (subtitleInGroup && field === 'subtitle')) ? headingAlignment : ((field === 'title' || ((field === 'tag' || (subtitleInGroup && field === 'subtitle')) && hints.sources.contentAlignment !== 'slide')
      ? hints.titleAlignment : hints.contentAlignment) ?? (field === 'metric' ? 'center' : 'left'));
  // LH-50: the paths of the text blocks drawn as the eyebrow of the text after them (eyebrowLabel), each with whether it is set in
  // capitals (eyebrowCaps). Filled when the body's blocks are grouped, before any of them is fitted.
  const eyebrowLabels = new Map<string, boolean>();
  // LH-09, LH-69: the paths of the lone short texts drawn as a display message (fillLone) and of placed regions' short texts, their lines
  // balanced; `displayFaces`: the placed regions' short texts, drawn as tile headings, in the heading face and bold.
  const displayTexts = new Set<string>(), displayFaces = new Set<string>();
  const tagCaps = eyebrowCaps(annotationText(slide.tag));
  // The tag (eyebrow) takes the accent family when the font scheme defines one; the quote body does the same in layoutQuote.
  // LH-32: an eyebrow (the tag, LH-50's label) is bold, and in capitals with EYEBROW_TRACKING where its script has case (eyebrowCaps).
  // LH-165: the labels of groups drawn as icon cards (groupCards): bold in the body face, never an eyebrow.
  const boldLabels = new Set<string>();
  const styleFor = (field: string, path: string): TextStyle => {
    const bold = boldLabels.has(path), eyebrow = field === 'tag' || (eyebrowLabels.has(path) && !bold), caps = field === 'tag' ? tagCaps : eyebrow && eyebrowLabels.get(path) === true, display = field === 'text' && displayFaces.has(path);
    return resolveTextStyle({
      fontFamily: (field === "title" || display ? options.fontFamilies?.heading : field === "code" ? options.fontFamilies?.code : eyebrow ? options.fontFamilies?.accent ?? options.fontFamilies?.body : options.fontFamilies?.body) ?? (field === "code" ? "monospace" : "sans-serif"),
      fontWeight: field === "title" || eyebrow || display || bold ? 700 : 400, path, ...(caps ? { caps: true, tracking: EYEBROW_TRACKING } : {}),
    }, options.textMeasurement);
  };
  const listBullet = hints.listBullet !== undefined ? { value: hints.listBullet, path: hints.paths.listBullet! } : undefined;
  const noListBullet = listBullet?.value === 'none';
  // LH-08: ruled rows. `design.listStyle: "rows"` draws every list of the slide as ruled rows, `"stack"` none; without it a list of two or
  // more first-level entries that each pair a short label (isLabelText) with a description is drawn as rows (the guarded rule `list-rows`),
  // as Claude Design rules such a list, and the guard keeps it only where no block reads smaller.
  // LH-133: a list of two or more questions (questionText) that each have an answer is drawn as rows too (the guarded rule `pair-rows`),
  // each question in a column beside its answer (ListFitOptions.pairs). A glossary's terms (termLists, composeTemplate) draw in the accent.
  const termLists = new Set<string>();
  const pairsOf = (value: unknown, path?: string): Pick<ListFitOptions, 'pairs'> => path !== undefined && termLists.has(path) ? { pairs: 'term' }
    : Array.isArray(value) && value.length >= 2 && value.every(entry => pairEntry(entry) === 'question') ? { pairs: 'question' } : {};
  const listRows = (value: unknown, path?: string): Pick<ListFitOptions, 'rows' | 'pairs'> => {
    const pairs = pairsOf(value, path), questions = pairs.pairs === 'question';
    if (hints.listStyle !== undefined) return hints.listStyle === 'rows' ? { rows: true, ...pairs } : {};
    if (questions && ruleOn('pair-rows')) { fire('pair-rows'); return { rows: true, ...pairs }; }
    if (!ruleOn('list-rows') || !Array.isArray(value) || value.length < 2 || !value.every(entry => { const object = record(entry); return object.description !== undefined && (object.level ?? 0) === 0 && isLabelText(object.text); })) return {};
    fire('list-rows');
    return { rows: true, ...pairs };
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
  // LH-09: in a display message (a lone short text) the words the author set bold are its emphasis, drawn in the primary color, as Claude
  // Design colors n29's second sentence, where the primary reads 4.5:1 on the slide; the text is unchanged (the fit's runs carry the
  // color, which both engines draw, and a PowerPoint import restores the authored runs). Nothing is emphasized that the author did not
  // mark. A title keeps its look: PowerPoint's heading import would read the color as authored.
  const slideRoles = options.roles ?? resolveColorRoles({}, { tone: options.darkBackground ? 'dark' : 'light' });
  // LH-163: where the primary does not read on a dark or accent surface (the accent surface of LH-164 is the primary's own color, a navy slide
  // dims a mid blue) the emphasis is a lighter tint of the primary that does: its hue and saturation, its lightness raised in 1% steps until it
  // reads 4.5:1 (legible), as Claude Design draws n29's second sentence in light blue on navy. A light surface keeps its rule (no emphasis color).
  const emphasisReads = (colorContrast(slideRoles.primary, slideRoles.background) ?? 0) >= SCRIM_TARGET_CONTRAST;
  const emphasisColor: string | undefined = emphasisReads ? 'primary' : legibleHex(slideRoles.primary) && legibleHex(slideRoles.background) && legibleLuminance(legibleHex(slideRoles.background)!) < .5 ? (() => {
    const tint = legible(legibleHex(slideRoles.primary)!, legibleHex(slideRoles.background)!, SCRIM_TARGET_CONTRAST);
    return (colorContrast(tint, slideRoles.background) ?? 0) >= SCRIM_TARGET_CONTRAST && tint.toUpperCase() !== legibleHex(slideRoles.text) ? tint : undefined;
  })() : undefined;
  // LH-164: on the accent surface a color the author set for a run of the message (a hex, or the primary, which is the surface itself there)
  // that does not read 4.5:1 draws in the nearest color that does (legible); the document keeps the authored color.
  const onMessageSurface = options.messageSurface !== undefined, surfaceBackground = legibleHex(slideRoles.background);
  const surfaceRun = (run: unknown): unknown => {
    const color = run && typeof run === 'object' ? (run as { color?: unknown }).color : undefined;
    // Any ColorRef the author used (a role, a scheme slot, a variable, a lighter or darker color) is resolved by the slide context; without it a
    // hex, the primary and a lighter or darker form of either are.
    const own = colorTransform(color), base = own ? own.color : color;
    const plain = base === 'primary' ? legibleHex(slideRoles.primary) : legibleHex(base);
    const drawn = color !== undefined && color !== '' && options.resolveRunColor ? legibleHex(options.resolveRunColor(color)) : own && plain ? legibleHex(applyColorTransform(plain, own)) : plain;
    if (!onMessageSurface || !surfaceBackground || !drawn || (colorContrast(drawn, surfaceBackground) ?? 0) >= SCRIM_TARGET_CONTRAST) return run;
    return { ...(run as object), color: legible(drawn, surfaceBackground, SCRIM_TARGET_CONTRAST) };
  };
  const displayEmphasis = (field: string, value: unknown, fitPath: string): unknown => !Array.isArray(value) || !(field === 'text' && displayTexts.has(fitPath)) || (emphasisColor === undefined && !onMessageSurface) ? value
    : value.map(run => run && typeof run === 'object' && (run as { bold?: unknown }).bold === true && ((run as { color?: unknown }).color ?? '') === '' ? (emphasisColor === undefined ? run : { ...run, color: emphasisColor }) : surfaceRun(run));
  const fitPlacedText = (field:string,authored:unknown,text:string,box:LayoutBox,size:number,minimum:number,path:string,explicitAlignment?:'left'|'center'|'right'):TextFit|RichTextFit => {
    const value=displayEmphasis(field,authored,path);
    const style=styleFor(field,path),rich=(field==='text'||headings.has(field))&&Array.isArray(value);
    // WI-4 (P15): a wrapped title or subtitle is balanced (same size, same line count); body text keeps the greedy wrap.
    const balance=field==='title'||field==='subtitle'||(field==='text'&&displayTexts.has(path)),textOptions=balance?{...richOptions(style),balance}:richOptions(style);
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
  // slide's title fits ('step', LH-51; 'split', LH-51 and LH-76); covers, sections and stacked records start at the role size (LH-129
  // may grow them, HEADING_STEPS).
  const headingSteps = Math.max(0, Math.floor(Number((options as Record<symbol, unknown>)[HEADING_STEPS] ?? 0)) || 0);
  let headingOffScale = false, headingMessage = false;
  // LH-130: the accent rule of a heading group (headingGroup's `rule`), by the group's item list: it stands above the title and is part
  // of the group's height (groupHeight), and the template moves it with the group.
  const groupRules = new WeakMap<ComposedItem[], LayoutBox>();
  let titleRule: SlideComposition['titleRule'];
  let pictureText: PictureText | undefined;
  // LH-155 with LH-158: a low stack over a measured picture, placed at the foot and scored after composing (STACK_PLACE).
  let stackPlace: { room: number; alignment: PictureTextAlignment; input: Omit<PictureTextInput, 'places' | 'panel'>; keyed: boolean; explicit?: PictureTextAnchor } | undefined;
  const headingGroup = (fields: string[], x: number, y: number, areaWidth: number, title?: 'step' | 'split', rule = false): ComposedItem[] => {
    const list: ComposedItem[] = [];
    let top = y;
    // LH-130: a rule stands where the eyebrow would: half a gap above the title, at the start edge of its first line.
    if (rule && fields.includes('title') && !fields.includes('tag')) {
      const width = TITLE_RULE_SIZE.width * scale, ruleHeight = TITLE_RULE_SIZE.height * scale;
      const side = physicalAlignment(alignmentFor('title'), paragraphDirection(annotationText(slide.title), deckDirection));
      fire('title-rule');
      groupRules.set(list, { x: side === 'left' ? x : side === 'right' ? x + areaWidth - width : x + (areaWidth - width) / 2, y: top, width, height: ruleHeight });
      top += ruleHeight + gap * 0.5;
    }
    const boxFor = (field: string) => ({ x, y: top, width: areaWidth, height: Math.max(height * (field === 'title' ? 0.26 : field === 'subtitle' ? 0.12 : 0.045), minSize * 1.22 + 2 * rasterPadding) });
    const push = (field: string, value: unknown, itemPath: string, box: LayoutBox, text: TextFit | RichTextFit, titleSplit?: ComposedItem['titleSplit']) => {
      box.height = Math.min(box.height, Math.max('richLines' in text ? (text as RichTextFit).height : text.lines.length * text.lineHeight, text.placement?.height ?? 0));
      list.push({ path: itemPath, field, type: 'text', value, payload: { text: value }, box, text, textStyle: styleFor(field, itemPath), composition, alignment: alignmentFor(field), ...(titleSplit ? { titleSplit } : {}) });
      top += box.height + gap * 0.5;
    };
    for (const field of fields) {
      const value = slide[field], text = annotationText(value), fieldPath = `${path}.${field}`, box = boxFor(field);
      const role = (field === 'title' ? 54 : field === 'tag' ? EYEBROW_TAG_SIZE : PROSE_NOMINAL_SIZE) * scale;
      // LH-129: headings that are the slide's message (growTemplate) grow by its steps of the type scale, each up to its display size.
      const requested = !title && headingSteps > 0 && (field === 'title' || field === 'subtitle' || field === 'tag') ? typeScaleStepsUp(role, headingSteps, HEADING_DISPLAY_SIZES[field] * scale, composition.minFontSize ?? 16, scale) : role;
      if (field !== 'title' || !title) {
        const fit = fitPlacedText(field, value, text, box, requested, minSize, fieldPath);
        // A grown heading that fits only below its step is off the type scale: growTemplate does not keep that step.
        if (requested > role && fit.fontSize < requested - FONT_GRID_EPSILON) headingOffScale = true;
        push(field, value, fieldPath, box, fit); continue;
      }
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
  // LH-14: each `icon` of the slide resolved once (the document's own icons and embedded sets, then the sets ensureIcons loaded). With the
  // guarded rule `icons` off (the guard found a block that reads smaller with them) nothing resolves, so no chip is drawn or measured.
  const iconCache = new Map<string, ResolvedIcon | undefined>();
  // LH-165: an icon card draws its icon whether or not the rule `icons` holds (resolvedIcon): a card has room for its chip, which costs its text nothing.
  const resolvedIcon = (value: unknown): ResolvedIcon | undefined => {
    if (value === undefined || !parseIconReference(value)) return undefined;
    const key = String(value);
    if (!iconCache.has(key)) { const found = resolveIcon(options.presentation ?? {}, value); iconCache.set(key, found.ok ? found.icon : undefined); }
    return iconCache.get(key);
  };
  const iconFor = (value: unknown): ResolvedIcon | undefined => ruleOn('icons') ? resolvedIcon(value) : undefined;
  // LH-14: a list draws icon chips when it is unnumbered, of one level, and one of its entries has an icon that resolves. Such a list is
  // never a badge list, flow or check-mark tiles: its chips take the marker column those draw in.
  const iconList = (value: unknown, numbering: unknown): boolean => numbering === undefined && Array.isArray(value) && value.every(entry => (record(entry).level ?? 0) === 0) && value.some(entry => iconFor(record(entry).icon) !== undefined);
  // LH-169: a list block drawn as a row of figures (figureRows): a figure list (figureList) with no numbering, columns, caption or list style
  // of the author's, on a slide that is not a layout's master. Wave 8: a figure list whose entries carry icons is a row of figures only where
  // LH-165's icon cards are off (the slide's first composition, CORE_RULES); withCards then tries the cards on top, which keep the icons, and
  // keeps them only when no text reads smaller than in the row (readsAsWell): of the two, the one whose text is larger wins, the cards on a tie.
  const figureRowOf = (field: string, value: unknown, payload: Record<string, unknown>, caption: unknown): boolean => ruleOn('figure-row') && (field === 'items' || field === 'bullets') && hints.listStyle === undefined && (options as Record<symbol, unknown>)[LAYOUT_MASTER] !== true
    && payload.numbering === undefined && payload.columns === undefined && caption === undefined && figureList(value) && !(ruleOn('icon-cards') && iconList(value, undefined));
  // LH-14: the chip of a metric (ICON_CHIP, or ICON_CHIP_COMPACT without `icon-chips`, times METRIC_ICON_TEXT reference pixels) and of a group (that times the starting size of its
  // first paragraph or list, as its eyebrow is sized), and the band each takes above its content: the chip and ICON_CHIP_GAP of it.
  const chipScale = ruleOn('icon-chips') ? ICON_CHIP : ICON_CHIP_COMPACT;
  const metricChip = (node: Pending) => node.field === 'metric' && iconFor(record(node.value).icon) ? chipScale * METRIC_ICON_TEXT * scale : 0;
  const groupChip = (node: Pending, width: number): number => {
    if (!node.children || !iconFor(record(node.payload).icon)) return 0;
    const proseOf = (nodes: readonly Pending[]): Pending | undefined => { for (const child of nodes) { const found = child.children ? proseOf(child.children) : child.field === 'text' || child.field === 'items' || child.field === 'bullets' ? child : undefined; if (found) return found; } return undefined; };
    const prose = proseOf(node.children);
    return chipScale * (prose ? proseMeasure(prose, width).size : PROSE_NOMINAL_SIZE * scale);
  };
  // LH-14: the metrics and groups whose chips are drawn over their placed items at the end; `carded`, a group on one card of its own (its
  // chip inside the card).
  // LH-165: `card`, the chip's center on a group drawn as an icon card (groupCards).
  const pendingIcons: { path: string; owner: string; icon: ResolvedIcon; members: ComposedItem[]; diameter: number; carded?: true; metric?: true; card?: { cx: number; cy: number } }[] = [];
  // LH-07: the lists of a `sequence` region (composeTemplate marks them by path). A badge list draws its entries beside step badges,
  // numbered in arabic when the payload has no numbering (from its badgeStarts entry: an agenda's unnumbered lists count on); a step
  // heading is a one-entry numbered list whose number its block's badge draws, so it fits as a heading list (LH-77) without the number.
  const badgeLists = new Set<string>(), stepHeadings = new Set<string>(), badgeStarts = new Map<string, number>();
  // LH-165: the icon lists of an agenda (a `numbered` region), which draw no badges, and the number each starts from: drawn as icon cards,
  // their cards are numbered as the badges would number them.
  const iconAgendas = new Map<string, number>((options as Record<symbol, unknown>)[AGENDA_STARTS] as Map<string, number> | undefined ?? []);
  const badgeNumbering = (path: string, numbering: unknown): NumberingInput => {
    if (numbering !== undefined) return numbering as NumberingInput;
    const start = badgeStarts.get(path) ?? 1;
    return start > 1 ? { start } : 'arabic';
  };
  // Wave 5: a badge list keeps its badges and never takes LH-08's automatic rows (fitList draws rows instead of badges): the sequence
  // region asked for steps. Its other lists, and a slide whose badges the guard refused (NO_STEPS), may still be ruled.
  // LH-136: the lists drawn as display words (fitList's `display`), by path (pillarWords is filled once the slide's blocks are collected).
  const pillarWords = new Set<string>(), wordCaps = new Map<string, number>();
  // LH-69: the display words that are a lone label (their rule is short, at the start edge).
  const loneLabels = new Set<string>();
  // LH-134: the badge lists whose numbers draw as numerals beside ruled rows instead (composeTemplate): `row` for an agenda whose entries
  // all have descriptions, `display` for a lone numbered list of a few takeaways. LH-133: the one-question blocks of a region drawn as
  // ruled rows (pairRowLabels: the questions of the region, so their answers share one column) and those drawn as a grid under accent rules.
  // LH-133: spreadLists are the lone ruled lists that fill their body (fillLone), their rows spread over it (ListFitOptions.spread).
  const numeralLists = new Map<string, 'display' | 'row'>(), pairRowLabels = new Map<string, ListText[]>(), pairGrid = new Set<string>(), spreadLists = new Set<string>();
  const listOptionsFor = (field: string, path: string, numbering: unknown, value?: unknown): ListFitOptions => {
    const listed = listOptionsOf(field, path, numbering, value);
    // LH-14: an icon list (never a badge list, a step heading or numerals) draws its icons on chips in the marker column.
    const own = field === 'items' && !badgeLists.has(path) && !stepHeadings.has(path) && !numeralLists.has(path) && iconList(value, numbering) ? { ...listed, icons: true, iconScale: chipScale } : listed;
    return own.rows && spreadLists.has(path) ? { ...own, spread: true } : own;
  };
  const listOptionsOf = (field: string, path: string, numbering: unknown, value?: unknown): ListFitOptions => stepHeadings.has(path) ? {...richOptions(styleFor(field,path)),heading:true,bullet:'none'}
    : numeralLists.has(path) ? {...richOptions(styleFor(field,path)),numbering:badgeNumbering(path, numbering),rows:true,numerals:numeralLists.get(path)!,...pairsOf(value, path)}
    : badgeLists.has(path) ? {...richOptions(styleFor(field,path)),numbering:badgeNumbering(path, numbering),badges:true}
    : pairRowLabels.has(path) ? {...richOptions(styleFor(field,path)),rows:true,pairs:'question',rowLabels:pairRowLabels.get(path)!,bullet:'none'}
    : {...richOptions(styleFor(field,path)),heading:true,...(pillarWords.has(path)?{display:true,...(wordCaps.has(path)?{displayMax:wordCaps.get(path)!}:{}),...(loneLabels.has(path)?{displayRule:'short' as const}:{})}:{}),...(value!==undefined?listRows(value, path):{}),...(numbering!==undefined?{numbering:numbering as NumberingInput}:bulletImage?{bulletImage}:noListBullet?{bullet:'none' as const}:{})};
  // A numbered list (`numbering` on the payload) draws numbers, never the picture bullet.
  // LH-63: a plain text that opens with a short line the author broke (or a short "Label:"), drawn as a bold run-in heading over its body
  // (runInHeading). The runs hold the text's every character, so only the weight of the first words differs; the authored value is unchanged.
  const runIns = new Map<string, RichText | undefined>();
  const runInOf = (value: unknown): RichText | undefined => {
    if (typeof value !== 'string' || !ruleOn('run-in')) return undefined;
    if (!runIns.has(value)) runIns.set(value, runInHeading(value));
    const runs = runIns.get(value);
    if (runs) fire('run-in');
    return runs;
  };
  const fitContent =(field:string,value:unknown,text:string,box:LayoutBox,size:number,minimum:number,path:string,numbering?:unknown,alignment?:'left'|'center'|'right') => field === 'text'
    ? fitPlacedText(field,runInOf(value) ?? value,text,box,size,minimum,path,alignment)
    : (field==='items'||field==='bullets') ? fitList(value as ListValue[],box,size,minimum,listOptionsFor(field,path,numbering,value))
    : fitText(text,box,size,minimum,widthFor(field,path),field==='code'?undefined:textDirection);
  const path = `slides.${options.slideIndex ?? 0}`;
  // SH-02, SH-04: a shape's text fitted in its text rectangle less the insets by the measured fonts, from the body size down to the
  // readability floor and never below it (a text that does not fit there overflows with a finding in `sink`), and placed at the
  // shape's anchor (`shape.textArea`). Shape blocks (placeShape) and overlay shapes share it.
  const fitShapeText = (shape: ComposedShape, value: unknown, textPath: string, minFontSize: number | undefined, sink: LayoutDiagnostic[]): TextFit | RichTextFit | undefined => {
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) return undefined;
    const drawn = shape.textDirection === 'stacked' ? stackedText(value) : value;
    const floor = snapFontSizeUp((minFontSize ?? 16) * scale), start = Math.max(floor, contentNominalSize('text') * scale);
    let text: TextFit | RichTextFit = fitContent('text', drawn, contentText('text', drawn) ?? '', shape.textBox, start, floor, textPath, undefined, 'center');
    if (text.overflow) sink.push({ code: 'text-overflow', path: textPath, message: 'The text does not fit inside the shape at the readable minimum size; give the shape more room (a larger cell or another aspectRatio), shorten the text or lower its padding.' });
    // The text block sits at the shape's anchor in its box (PowerPoint's a:bodyPr anchor): the preview draws the fit in textArea.
    const area = shape.textBox, height = Math.max('richLines' in text ? (text as RichTextFit).height : text.lines.length * text.lineHeight, text.placement?.height ?? 0);
    const offset = Math.max(0, shape.anchor === 'middle' ? (area.height - height) / 2 : shape.anchor === 'bottom' ? area.height - height : 0);
    text = translateTextFit(text, round(offset));
    shape.textArea = { x: area.x, y: round(area.y + offset), width: area.width, height: round(Math.min(area.height, height)) };
    return text;
  };
  // SH-04: composeSlide's overlay pass: the slide's `shapes` on its final composition, their text fitted as a shape block's.
  const overlayOnto = (options as Record<symbol, unknown>)[OVERLAY_ONTO] as SlideComposition | undefined;
  if (overlayOnto) {
    const overlayShapes = composeOverlayShapes(slide, overlayOnto, { path, scale, rtl, item: (host, shape, itemPath) => {
      const textPath = `${itemPath}.text`, text = fitShapeText(shape, host.text, textPath, composition.minFontSize, overlayOnto.diagnostics);
      return { ...(text ? { text } : {}), textStyle: { ...styleFor('text', textPath), ...(shape.textBold ? { fontWeight: 700 } : {}) }, composition };
    } });
    if (overlayShapes.length) overlayOnto.overlayShapes = overlayShapes;
    return overlayOnto;
  }
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
    // LH-129: a slide with no body (a cover by the record rule) has its headings as its message, as a cover record does.
    if (isCover && headingItems.some(item => item.field === 'title')) headingMessage = true;
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
    const caption = host.caption !== undefined && entry.block !== undefined ? layoutCaption(host.caption, roundBox(frameArea), `${hostPath}.caption`, { ...annotationOptions, nameDetail: true }) : undefined;
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
  // LH-152: the same label before a list or a group, at the root or inside a group, is the eyebrow of that list or group, as Claude Design
  // heads a column with its name, instead of a cell of its own beside it (an equal-width row cell half a slide from its list). A group's
  // first child that is a label, followed by two or more blocks none of which is a label, names the whole group: it is the group's
  // eyebrow. A root label before a root list stays a block on a layout with a `sequence` region, whose lists draw step badges (LH-07).
  // `eyebrowHosts`: the block paths of every label drawn as an eyebrow, which are no block of the body.
  const eyebrowOf = new Map<string, { path: string; value: unknown }>(), eyebrowBlocks = new Set<number>(), eyebrowHosts = new Set<string>();
  if (ruleOn('eyebrow') && (options as Record<symbol, unknown>)[LAYOUT_MASTER] !== true && !regions.length && Array.isArray(slide.blocks) && !slide.blocks.some((block: unknown) => record(block).region !== undefined)) {
    const plainBlock = (host: Record<string, any>) => host.text !== undefined && host.caption === undefined && host.emphasis === undefined && !Array.isArray(host.blocks) && fields.every(field => field === 'text' || host[field] === undefined);
    const listBlock = (host: Record<string, any>) => (host.items !== undefined || host.bullets !== undefined) && host.caption === undefined && host.emphasis === undefined && !Array.isArray(host.blocks) && fields.every(field => field === 'items' || field === 'bullets' || host[field] === undefined);
    const groupBlock = (host: Record<string, any>) => Array.isArray(host.blocks) && host.emphasis === undefined;
    const sequence = template?.regions.some(region => region.sequence !== undefined) === true;
    const label = (host: Record<string, any>) => plainBlock(host) && isLabelText(host.text);
    const mark = (labelBase: string, owner: string, value: unknown) => {
      const labelPath = `${labelBase}.text`;
      eyebrowHosts.add(labelBase);
      eyebrowOf.set(owner, { path: labelPath, value });
      eyebrowLabels.set(labelPath, eyebrowCaps(annotationText(value)));
    };
    // A group's content is no label alone: it holds a block that is not a short label (a list, a paragraph, a metric, any other payload).
    const content = (host: Record<string, any>, depth: number): boolean => Array.isArray(host.blocks) ? depth < MAX_COMPOSITION_DEPTH && host.blocks.some((block: unknown) => content(record(block), depth + 1)) : !emptyHost(host) && !label(host);
    // An explicit arrangement (a `composition` mode, weights or columns of the slide or the group) places its blocks as authored: only
    // LH-50's root paragraphs take eyebrows there, as before.
    const arrangedBy = (composition: unknown) => ['mode', 'weights', 'columns'].some(key => record(composition)[key] !== undefined);
    const scan = (blocks: unknown[], base: string, nested: boolean, depth: number, arranged: boolean): void => {
      const flowed: { host: Record<string, any>; index: number }[] = blocks.flatMap((block: unknown, index: number) => (!nested && placedBlocks.has(index)) || emptyHost(record(block)) ? [] : [{ host: record(block), index }]);
      if (nested && !arranged && flowed.length >= 3 && label(flowed[0]!.host) && !flowed.slice(1).some(entry => label(entry.host))) mark(`${base}.blocks.${flowed[0]!.index}`, base, flowed[0]!.host.text);
      else if (!(nested && arranged)) for (let at = 0; at + 1 < flowed.length; at++) {
        const first = flowed[at]!, next = flowed[at + 1]!;
        if (!plainBlock(first.host)) continue;
        const paragraph = plainBlock(next.host) && eyebrowLabel(first.host.text, next.host.text);
        if (!paragraph && !(!arranged && isLabelText(first.host.text) && (nested || !sequence) && (listBlock(next.host) || (groupBlock(next.host) && content(next.host, depth))))) continue;
        mark(`${base}.blocks.${first.index}`, `${base}.blocks.${next.index}`, first.host.text);
        if (!nested) eyebrowBlocks.add(first.index);
        at++;
      }
      if (depth < MAX_COMPOSITION_DEPTH) for (const entry of flowed) if (groupBlock(entry.host)) scan(entry.host.blocks, `${base}.blocks.${entry.index}`, true, depth + 1, arrangedBy(entry.host.composition));
    };
    scan(slide.blocks, path, false, 0, arrangedBy(slide.composition));
    if (eyebrowHosts.size) fire('eyebrow');
  }
  const authoredEmphasis = (blocks: unknown, depth = 0): boolean => depth <= MAX_COMPOSITION_DEPTH && Array.isArray(blocks) && blocks.some(block => record(block).emphasis === true || authoredEmphasis(record(block).blocks, depth + 1));
  // LH-170: a lone short note that closes the body is the foot band too (`note-band`), at the size it had (EMPHASIS_SIZE) whatever its
  // length, when it sets in at most EMPHASIS_NOTE_LINES lines across the band: the one text a layout binds to its verdict region
  // (VERDICT_REGIONS: "Recommendation: ...", n18), or the last block when every block before it is a figure, two or more in all (metrics,
  // LH-169's figure lists or groups of metrics: a row of figures and what they mean, n15, b04 s44), under them or beside them in a layout.
  // The same exclusions as LH-06's (an authored emphasis or arrangement, `emphasis: false`, a caption, anything but text, an eyebrow).
  const closingNote = (flowed: { block: unknown; index: number }[], last: { block: unknown; index: number }): boolean => {
    const host = record(last.block);
    // One surface a slide: a featured pair or set (LH-131: n17's "after" card) keeps its card, and the note stays text under it.
    if (ruleOn('featured-card')) { const found = featuredCells(slide.blocks, index => placedBlocks.has(index) || eyebrowBlocks.has(index) || emptyHost(record(slide.blocks[index]))); if (found && record(slide.blocks[found.featured]).emphasis !== false) return false; }
    if (host.emphasis === false || host.caption !== undefined || Array.isArray(host.blocks) || fields.some(field => field !== 'text' && host[field] !== undefined) || !contentText('text', host.text)?.trim()) return false;
    const metricOnly = (block: unknown, depth = 0): number => {
      const value = record(block);
      if (Array.isArray(value.blocks)) { const counts = value.blocks.map((child: unknown) => depth < MAX_COMPOSITION_DEPTH ? metricOnly(child, depth + 1) : 0); return value.blocks.length && counts.every((count: number) => count > 0) ? counts.reduce((sum: number, count: number) => sum + count, 0) : 0; }
      if (value.caption !== undefined) return 0;
      if (value.metric !== undefined && fields.every(field => field === 'metric' || value[field] === undefined)) return 1;
      const list = value.items ?? value.bullets;
      return value.numbering === undefined && value.columns === undefined && fields.every(field => field === 'items' || field === 'bullets' || value[field] === undefined) && figureList(list) ? (list as unknown[]).length : 0;
    };
    // A note that is a peer of the plain texts above it is one of a set, not the slide's close: banding it would break the parallel and
    // set one peer apart (01 s10's three "<Name> should focus ..." lines, the third bound to the verdict). Its peers are the texts before
    // it of the same form (plain text with as many paragraphs), two or more of them; it is one of them when its length is NOTE_PEER_RATIO
    // of their median, or when it opens as each of them does (the same first lowercase word in its first words, as "should" after a name;
    // the same first word in a script without case). Even in a `verdict` region it stays text.
    const paragraphs = (value: string) => value.split(/\n+/u).filter(line => line.trim()).length;
    const own = contentText('text', host.text)!.trim(), peers = flowed.slice(0, -1).flatMap(entry => { const text = plainText(entry.block) ?? (() => { const other = record(entry.block); return other.region !== undefined && other.emphasis !== false && other.caption === undefined && !Array.isArray(other.blocks) && fields.every(field => field === 'text' || other[field] === undefined) ? contentText('text', other.text)?.trim() : undefined; })(); return text && paragraphs(text) === paragraphs(own) ? [text] : []; });
    if (peers.length >= 2) {
      const lengths = peers.map(text => [...text].length).sort((a, b) => a - b), middle = lengths.length / 2, median = lengths.length % 2 ? lengths[Math.floor(middle)]! : (lengths[middle - 1]! + lengths[middle]!) / 2, length = [...own].length;
      const opening = (text: string) => { const words = text.split(/\s+/u).slice(0, NOTE_PEER_WORDS).map(word => word.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean); const cased = words.find(word => /^\p{Ll}/u.test(word)); return cased ?? (words.some(word => /\p{Lu}/u.test(word)) ? undefined : words[0]); };
      const lead = opening(own);
      if ((length >= NOTE_PEER_RATIO[0] * median && length <= NOTE_PEER_RATIO[1] * median) || (lead !== undefined && peers.every(text => opening(text) === lead))) return false;
    }
    const figures = flowed.slice(0, -1).map(entry => metricOnly(entry.block));
    if (figures.every(count => count > 0) && figures.reduce((sum, count) => sum + count, 0) >= 2) return true;
    if (!template || !template.regions.some(region => VERDICT_REGIONS.has(region.name))) return false;
    const bound = bindRegions(slide, layout, { slideIndex: options.slideIndex ?? 0 }).regions.find(region => VERDICT_REGIONS.has(region.name) && region.blocks.length);
    return bound?.blocks.length === 1 && bound.blocks[0]!.block === last.index;
  };
  const autoEmphasis = ((): { block: number; shape: 'band' | 'pill'; follows?: number; note?: true } | undefined => {
    if (!(ruleOn('emphasis-band') || ruleOn('note-band')) || (options as Record<symbol, unknown>)[LAYOUT_MASTER] === true || regions.length || !Array.isArray(slide.blocks) || authoredEmphasis(slide.blocks)) return undefined;
    const own = record(slide.composition);
    if ((own.mode !== undefined && own.mode !== 'auto') || own.weights !== undefined || own.columns !== undefined) return undefined;
    const flowed = slide.blocks.flatMap((block: unknown, index: number) => placedBlocks.has(index) || emptyHost(record(block)) || eyebrowBlocks.has(index) ? [] : [{ block, index }]);
    const last = flowed[flowed.length - 1];
    // LH-50: a paragraph with an eyebrow keeps it: it is placed as a block of the body, never as the band or pill.
    if (flowed.length < 2 || !last || eyebrowOf.has(path + '.blocks.' + last.index)) return undefined;
    const note = (): { block: number; shape: 'band'; note: true } | undefined => ruleOn('note-band') && closingNote(flowed, last) ? { block: last.index, shape: 'band', note: true } : undefined;
    const text = ruleOn('emphasis-band') ? plainText(last.block) : undefined;
    if (text === undefined) return note();
    const length = [...text].length, before = flowed.slice(0, -1).map((entry: { block: unknown }) => plainText(entry.block));
    const long = (other: string | undefined) => other === undefined || [...other].length > EMPHASIS_BAND_MAX_CHARACTERS;
    if (before.length === 1 && before[0] !== undefined && long(before[0]) && length <= EMPHASIS_PILL_MAX_CHARACTERS) return { block: last.index, shape: 'pill', follows: flowed[0]!.index };
    // LH-06 (widened): a takeaway of up to EMPHASIS_TAKEAWAY_MAX_CHARACTERS right after two or more charts or tables (a run of them, so a
    // note paired with the chart before it reads as that chart's note, not as the slide's takeaway) is the band too.
    const isData = (entry: { block: unknown }) => { const host = record(entry.block); return !Array.isArray(host.blocks) && (host.chart !== undefined || host.table !== undefined); };
    let data = 0;
    for (let index = flowed.length - 2; index >= 0 && isData(flowed[index]!); index--) data++;
    const limit = data >= 2 ? EMPHASIS_TAKEAWAY_MAX_CHARACTERS : EMPHASIS_BAND_MAX_CHARACTERS;
    return length <= limit && before.every(long) ? { block: last.index, shape: 'band' } : note();
  })();
  // LH-131: the featured card of a pair or a set (featured-cards.ts, from the blocks' content only: "after" of a before and after, the
  // solution of a problem and solution, the tier marked recommended or most popular) is drawn on the emphasis surface, a card like an
  // authored one, and the other cells of the pair or set each on one plain card (`cardCells`), so the set reads as cards with one
  // featured. Never on a slide with an authored `emphasis: true`, LH-06's band or pill, or legacy region keys, nor when the featured
  // block sets `emphasis: false`.
  const featured = ((): FeaturedCells | undefined => {
    if (!ruleOn('featured-card') || (options as Record<symbol, unknown>)[LAYOUT_MASTER] === true || regions.length || !Array.isArray(slide.blocks) || autoEmphasis || authoredEmphasis(slide.blocks)) return undefined;
    const found = featuredCells(slide.blocks, index => placedBlocks.has(index) || eyebrowBlocks.has(index) || emptyHost(record(slide.blocks[index])));
    if (!found || record(slide.blocks[found.featured]).emphasis === false) return undefined;
    fire('featured-card');
    return found;
  })();
  const featuredPath = featured ? `${path}.blocks.${featured.featured}` : undefined;
  const cardCells = new Set(featured ? featured.cells.filter(index => index !== featured.featured).map(index => `${path}.blocks.${index}`) : []);
  const pairRoom = (options as Record<symbol, unknown>)[PAIR_ROOM] as ReadonlyMap<string, { side: 'left' | 'right'; width: number }> | undefined;
  // The band spans the body's width; the pill hugs its one line. Each is drawn at the foot of the body, which ends a gap above it; a
  // surface that would take more than EMPHASIS_BAND_MAX_SHARE of the body is not drawn.
  let autoSurface: { emphasis: ComposedEmphasis; item: ComposedItem } | undefined, noteBand = false;
  if (autoEmphasis) {
    if (!autoEmphasis.note) fire('emphasis-band');
    const blockPath = `${path}.blocks.${autoEmphasis.block}`, textPath = `${blockPath}.text`, value = record(slide.blocks[autoEmphasis.block]).text;
    const text = contentText('text', value)!, pill = autoEmphasis.shape === 'pill';
    const left = area.left + padding, width = area.right - area.left - padding * 2, size = Math.max((pill ? EMPHASIS_PILL_SIZE : PROSE_NOMINAL_SIZE) * scale, Number((options as Record<symbol, unknown>)[EMPHASIS_SIZE] ?? 0));
    const padX = pill ? round(size * .9) : CARD_INSET * scale, padY = round(size * (pill ? .4 : .6));
    const side = alignmentFor('text'), atEnd = rtl ? side === 'left' : side === 'right';
    const inner = pill ? Math.min(width - 2 * padX, widthFor('text', textPath)(text, size) * 1.04 + 2 * rasterPadding + 2 * scale) : width - 2 * padX;
    const outer = inner + 2 * padX, x = round(pill ? side === 'center' ? left + (width - outer) / 2 : atEnd ? left + width - outer : left : left);
    // Wave 8, LH-63 with LH-170: a band's text that opens with a short "Label:" (n18's "Recommendation: ...") or a short line of its own draws
    // that label bold inside the band, as Claude Design draws it (runInOf, under the guarded `run-in`); a pill's one short line stays as written.
    const bandRuns = pill ? undefined : runInOf(value), drawn = bandRuns ?? value;
    const measured = fitPlacedText('text', drawn, text, { x: x + padX, y: 0, width: inner, height: Math.max(scale, bodyBottom - y) }, size, minSize, textPath, pill ? 'center' : undefined);
    const textHeight = 'richLines' in measured ? (measured as RichTextFit).height : measured.placement?.height ?? measured.lines.length * measured.lineHeight;
    const height = round(textHeight + 2 * padY), top = round(bodyBottom - height);
    const lines = 'richLines' in measured ? (measured as RichTextFit).richLines.length : measured.lines.length;
    if (height <= EMPHASIS_BAND_MAX_SHARE * (bodyBottom - y) && !(autoEmphasis.note && (lines > EMPHASIS_NOTE_LINES || measured.overflow))) {
      if (autoEmphasis.note) { fire('note-band'); noteBand = true; }
      const box = { x: x + padX, y: top + padY, width: inner, height: round(textHeight) };
      const fit = fitPlacedText('text', drawn, text, box, size, minSize, textPath, pill ? 'center' : undefined);
      autoSurface = {
        emphasis: { path: blockPath, box: { x, y: top, width: round(outer), height }, radius: pill ? height / 2 : CARD_RADIUS * scale, shape: pill ? 'pill' : 'band', source: pill ? 'pill' : 'foot-band' },
        item: { path: textPath, field: 'text', type: 'text', value, payload: { type: 'text', text: value }, box, text: fit, ...(bandRuns && 'richLines' in fit ? { runs: bandRuns } : {}), textStyle: styleFor('text', textPath), composition, alignment: pill ? 'center' : side, emphasis: true },
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
    /** LH-131: a cell of a featured pair or set other than the featured one: drawn on one plain card (a group's blocks share it). */
    cardCell?: boolean;
    /** LH-50: the label drawn as this paragraph's eyebrow (LH-152: or this list's or group's). */
    eyebrow?: { path: string; value: unknown } };
  const collect = (host: Record<string, any>, basePath: string, depth = 0, ancestors: unknown[] = []): Pending[] => {
    if (Array.isArray(host.blocks)) {
      if (depth >= MAX_COMPOSITION_DEPTH || ancestors.includes(host)) throw new RangeError(`Content groups must be acyclic and nest at most ${MAX_COMPOSITION_DEPTH} levels.`);
      const settings = record(host.composition) as Composition;
      assertComposition(settings);
      // LH-152: a group may carry the eyebrow of its first child; a label drawn as an eyebrow is no child.
      return [{ field: "blocks", type: "group", value: host.blocks, path: basePath, payload: host, composition: settings, ...(host.emphasis === true || basePath === featuredPath ? { emphasis: basePath } : {}), ...(cardCells.has(basePath) ? { cardCell: true } : {}), ...(eyebrowOf.has(basePath) ? { eyebrow: eyebrowOf.get(basePath)! } : {}),
        children: host.blocks.flatMap((block: unknown, index: number) => eyebrowHosts.has(`${basePath}.blocks.${index}`) ? [] : collect(record(block), `${basePath}.blocks.${index}`, depth + 1, [...ancestors, host])) }];
    }
    // SH-02: a shape block is one leaf, its preset (or custom path) with its text inside.
    if (isShapeBlock(host)) {
      const key = host.shape !== undefined || host.path === undefined ? 'shape' : 'path';
      return [{ field: 'shape', type: 'shape', value: host[key], path: `${basePath}.${key}`, payload: shapePayload(host), host, hostPath: basePath, ...(cardCells.has(basePath) ? { cardCell: true } : {}) }];
    }
    // RR-34: a caption belongs to the host's one captionable payload (image, chart, table or video).
    const captioned = host.caption !== undefined ? fields.filter(field => host[field] !== undefined && CAPTIONABLE_FIELDS.includes(field)) : [];
    // RR-54: a dataset-backed chart or table is composed from its inline copy (options.presentation holds the datasets).
    const fieldValue = (field: string): unknown => field === 'table' ? inlineTableData(host[field], options.presentation) : field === 'chart' ? inlineChartData(host[field], options.presentation) : host[field];
    return leafFields(host).map(field => ({ field, type: host.type ?? kind(field), value: fieldValue(field), path: `${basePath}.${field}`, payload: field === 'image' ? imagePayload(host) : { type: host.type ?? kind(field), [field]: fieldValue(field), ...(host.numbering !== undefined && (field === 'items' || field === 'bullets') ? { numbering: host.numbering } : {}), ...(host.columns !== undefined && (field === 'items' || field === 'bullets') ? { columns: host.columns } : {}) },
      ...(field === 'image' ? { host, hostPath: basePath } : {}), ...(host.emphasis === true || basePath === featuredPath ? { emphasis: basePath } : {}), ...(cardCells.has(basePath) ? { cardCell: true } : {}), ...((field === 'text' || field === 'items' || field === 'bullets') && eyebrowOf.has(basePath) ? { eyebrow: eyebrowOf.get(basePath)! } : {}),
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
  // LH-69: a placed region (a slide key such as `top:left`) that holds one short text, at most SHORT_TEXT_WORDS words, holds a tile's
  // heading ("Inputs", "Product", "Teams want fewer exports."): it is drawn as a heading, in the heading face and bold (displayFaces), as
  // Claude Design heads those tiles (b07 s29, b08 s07, s18, s46). Only a plain string: rich text keeps the body face, where the runs its
  // author set bold stay apart from the rest. The guarded rule `display-message`: the wider face never sets it smaller.
  if (regions.length && ruleOn('display-message')) for (const key of regions) {
    const units = pending.filter(node => node.path.startsWith(`${path}.${key}.`) || node.path === `${path}.${key}`);
    if (units.length === 1 && !units[0]!.children && units[0]!.field === 'text' && units[0]!.caption === undefined && typeof units[0]!.value === 'string' && messageWords(units[0]!.value) <= SHORT_TEXT_WORDS) { displayTexts.add(units[0]!.path); displayFaces.add(units[0]!.path); fire('display-message'); }
  }
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
  // LH-135: pricing tiers. A slide whose body is 2 to 5 groups, each a metric with a label (the tier's name and price) followed by a list or
  // text (what the tier includes), draws each group as one equal card: the label as the metric's eyebrow, the price at display size, and
  // the details under it, from the top of the card (placeNode). `tierGroups`: the groups' paths; `tierMetricPaths`: each one's
  // metric with its display sizes; `tierPrices`: the items of those metrics. Each tier keeps the sizes it fits at (the guard holds every block
  // to the size it had as two cards), except that prices which reach their role size share the smallest of them (before sharePeerSizes).
  const tierGroups = new Set<string>(), tierMetricPaths = new Map<string, { start: number; max: number }>(), tierPrices: number[] = [];
  const tierOf = (node: Pending): boolean => {
    const kids = node.children, own = record(node.composition);
    // LH-152 with LH-135: a group headed by a label (its eyebrow) keeps its own drawing; the tier card has no band for that eyebrow.
    if (!kids || node.eyebrow || kids.length < 2 || kids.length > 3 || (own.mode !== undefined && own.mode !== 'column' && own.mode !== 'auto') || own.weights !== undefined || own.columns !== undefined) return false;
    const label = record(kids[0]!.value).label;
    return kids[0]!.field === 'metric' && !kids[0]!.children && kids[0]!.caption === undefined && typeof label === 'string' && label.trim() !== ''
      && kids.slice(1).every(kid => !kid.children && kid.caption === undefined && (kid.field === 'items' || kid.field === 'bullets' || kid.field === 'text'));
  };
  if (ruleOn('tier-cards') && hasCards && pending.length >= 2 && pending.length <= TIER_MAX && pending.every(tierOf)) {
    const sizes = pending.length === 2 ? TIER_VALUE_SIZES.few : TIER_VALUE_SIZES.many;
    for (const node of pending) { tierGroups.add(node.path); tierMetricPaths.set(node.children![0]!.path, sizes); }
  }
  // LH-136: pillars whose titles are one word. A slide whose body is 2 to 5 lists of one entry each, a single word with its description,
  // draws each as the word at display size over an accent rule, with no card (the word says what the card would: the pillar's name).
  // Any other set of pillars, a title of several words included, keeps its cards.
  const wordPillar = (node: Pending): boolean => {
    const entries = node.value, entry = Array.isArray(entries) && entries.length === 1 ? record(entries[0]) : undefined;
    return !node.children && node.caption === undefined && (node.field === 'items' || node.field === 'bullets') && node.payload.numbering === undefined && entry !== undefined
      && typeof entry.text === 'string' && entry.text.trim() !== '' && !/\s/u.test(entry.text.trim()) && [...entry.text.trim()].length <= PILLAR_WORD_MAX && entry.description !== undefined && (entry.level ?? 0) === 0;
  };
  if (ruleOn('pillar-words') && pending.length >= 2 && pending.length <= PILLAR_MAX && pending.every(wordPillar)) {
    for (const node of pending) pillarWords.add(node.path);
    fire('pillar-words');
  }
  // LH-69: a body that is one list of one entry, a short label (at most SHORT_TEXT_WORDS words, isLabelText's length) with its
  // description, is a name and what it says: the name is drawn as a display word over an accent rule (LH-136's drawing), as Claude
  // Design sets "Sam Lee" over "Product lead" (b07 s25) and "Consistent measures" over its line (b07 s23). The guarded rule
  // `display-message`; the word steps down to the one line its box holds, never under the heading size it had (LIST_HEADING_SCALE).
  const loneLabel = (node: Pending): boolean => {
    const entries = node.value, entry = Array.isArray(entries) && entries.length === 1 ? record(entries[0]) : undefined, text = annotationText(entry?.text).trim();
    return !node.children && node.caption === undefined && (node.field === 'items' || node.field === 'bullets') && node.payload.numbering === undefined && entry !== undefined && entry.description !== undefined && (entry.level ?? 0) === 0
      && text !== '' && messageWords(entry.text) <= SHORT_TEXT_WORDS && [...text].length <= EYEBROW_LABEL_CHARS && !/[.!?\u3002\uff01\uff1f\u2026\u06d4\u0964]$/u.test(text);
  };
  if (ruleOn('display-message') && options.fill !== false && pending.length === 1 && loneLabel(pending[0]!) && alignmentFor(pending[0]!.field) !== 'center') { pillarWords.add(pending[0]!.path); loneLabels.add(pending[0]!.path); fire('display-message'); }
  // LH-132: a team. A body whose every block is a person, a group of a picture followed by a name (a list of one entry, whose description
  // holds the role and a line, or a short text), draws each person as one card with a portrait instead of the avatar over the name: 2 to
  // PORTRAIT_TOP_MAX people across the top of their cards in one row, up to PORTRAIT_SIDE_MAX beside the text in a grid, while a card is
  // wide enough for it (PORTRAIT_MIN); more people, or too little room, keep the avatar. The automatic choice is the guarded rule
  // `portraits` (no name, role or line smaller than with the avatar); a person's `portrait` (the image option) overrides it for the
  // whole team, the first one in reading order, so the cards stay equal. `personParts`: each person's picture and text, by group path.
  const personParts = new Map<string, { image: Pending; text: Pending }>();
  // Wave 7 integration (LH-132 with LH-74): the pictures of a team's people, with the rule or without it. A person's picture is a portrait or an
  // avatar beside its name, never a picture alone on a card that LH-74 lets fill it: the portraits are judged against the avatar (picturesShrink).
  const personPictures = new Set<string>();
  let portraitMode: Exclude<PortraitMode, 'avatar'> | undefined, portraitAuthored = false, portraitFallback = false;
  {
    const personOf = (node: Pending): { image: Pending; text: Pending } | undefined => {
      const kids = node.children, own = record(node.composition);
      // Wave 7 integration (LH-132 with LH-14): a person's group icon does not make it less of a person. The portrait marks the person, so a
      // portrait card draws no chip and the icon is reported (icon-dropped); a team kept on avatars draws its groups' chips as any group does.
      if (!kids || kids.length !== 2 || node.eyebrow || node.emphasis !== undefined || node.cardCell || (own.mode !== undefined && own.mode !== 'column' && own.mode !== 'auto') || own.weights !== undefined || own.columns !== undefined) return undefined;
      const [image, text] = kids as [Pending, Pending], entries = Array.isArray(text.value) ? text.value : undefined, entry = entries?.length === 1 ? record(entries[0]) : undefined;
      if (image.field !== 'image' || image.children || image.caption !== undefined || record(image.host).placement !== undefined || text.children || text.caption !== undefined || text.payload.numbering !== undefined) return undefined;
      const named = text.field === 'text' ? typeof text.value === 'string' && text.value.trim() !== '' : (text.field === 'items' || text.field === 'bullets') && entry !== undefined && typeof entry.text === 'string' && entry.text.trim() !== '' && (entry.level ?? 0) === 0;
      return named ? { image, text } : undefined;
    };
    const people = pending.map(personOf);
    if (pending.length > 1 && people.every(Boolean)) for (const person of people) personPictures.add(person!.image.path);
    if (pending.length && people.every(Boolean)) {
      const authored = people.map(person => record(person!.image.host).portrait).find((mode): mode is PortraitMode => (PORTRAIT_MODES as readonly unknown[]).includes(mode));
      // The automatic choice: a card of the content box's row (top) or grid (side) wide enough for its portrait and its text.
      const cardInner = (columns: number) => (contentBox.width - gap * (columns - 1)) / columns - (hasCards ? 2 * CARD_INSET * scale : 0);
      const sideFits = (columns: number) => cardInner(columns) * PORTRAIT_SIDE_SHARE >= PORTRAIT_MIN.side * scale && cardInner(columns) * (1 - PORTRAIT_SIDE_SHARE) - PORTRAIT_GAP * scale >= PORTRAIT_MIN.text * scale;
      const landscape = contentBox.width >= contentBox.height, count = pending.length;
      const automatic = count < 2 || !ruleOn('portraits') ? undefined : count <= PORTRAIT_TOP_MAX && cardInner(count) >= PORTRAIT_MIN.topCard * scale ? 'top' as const
        : count <= PORTRAIT_SIDE_MAX && sideFits(gridFlowShape(count, landscape).columns) ? 'side' as const : undefined;
      const mode = authored ?? automatic;
      if (mode !== undefined && mode !== 'avatar') {
        portraitMode = mode;
        portraitAuthored = authored !== undefined;
        if (!portraitAuthored) fire('portraits');
        for (const [index, node] of pending.entries()) personParts.set(node.path, people[index]!);
      }
    }
  }
  // LH-06: the one block or group drawn on the emphasis surface: the first `emphasis: true` in reading order. Any other is drawn plain,
  // and reported: a slide has one emphasis.
  const emphasisPaths: string[] = [];
  const findEmphasis = (nodes: Pending[]): void => { for (const node of nodes) { if (node.emphasis !== undefined && !emphasisPaths.includes(node.emphasis)) emphasisPaths.push(node.emphasis); if (node.children) findEmphasis(node.children); } };
  findEmphasis(pending);
  const chosenEmphasis = emphasisPaths[0];
  for (const ignored of emphasisPaths.slice(1)) diagnostics.push({ code: 'emphasis-ignored', path: ignored, message: 'A slide draws one emphasis surface: the first block or group with emphasis: true has it, and this one is drawn without it.' });
  let surface: ComposedEmphasis | undefined = autoSurface?.emphasis, insideEmphasis = false, insideTier = false;
  // LH-131: the plain card of the cell of a featured set being placed (placeNode), which every block of the cell shares.
  let insideCard: LayoutBox | undefined;
  // LH-131: a block or group drawn as one card whatever the design's cards: the emphasis surface's, or a cell of a featured set.
  const cardedNode = (node: Pending): boolean => (node.emphasis !== undefined && node.emphasis === chosenEmphasis) || node.cardCell === true;
  // LH-131: a featured set's cell (featured or not) in a design with cards is inset as its blocks' own cards were (the smallest card
  // inset, 12 px), so one card around the cell never leaves a block less room than its own card did; any other carded group, payloadBox's.
  const featuredCell = (node: Pending): boolean => node.cardCell === true || (featuredPath !== undefined && node.emphasis === featuredPath);
  // A pricing tier (LH-135) keeps the card inset its tier card is placed with (payloadBox), featured or not, so the tiers stay equal.
  const cellCardInset = (node: Pending): number | undefined => hasCards && featuredCell(node) && !tierGroups.has(node.path) ? CELL_CARD_INSET * scale : undefined;
  const cellCardPayload = (frame: LayoutBox, node: Pending): LayoutBox => {
    const pad = cellCardInset(node);
    if (pad === undefined) return payloadBox(frame, true);
    const card = acceptedBox(frame);
    return acceptedBox({ x: card.x + pad, y: card.y + pad, width: Math.max(scale, card.width - 2 * pad), height: Math.max(scale, card.height - 2 * pad) });
  };
  const groups: ComposedGroup[] = [], flows: ComposedFlow[] = [];
  // WI-1 (N1), LH-43: indexes into `items` of sibling blocks (the cells of a flow or a region, or regions of one role side
  // by side); after composition the text and lists of each set share the smallest size any of them fitted at.
  const peerSets: number[][] = [];
  // LH-43, LH-17: what refitting a placed item needs: a metric is laid out again in its own box from given role sizes, and a text
  // or list refits from a smaller size than the one it started at (its start, by item index).
  const metricRefits = new Map<number, (roleSizes: MetricLayoutOptions['roleSizes'], pill?: 'above') => MetricLayout>();
  // LH-78: a quote is laid out again in its own box with its body at a given size (px), so sibling quotes share one size.
  const quoteRefits = new Map<number, (bodySize: number) => QuoteLayout>();
  // LH-144: a timeline is laid out again in its own box with every role offset by a number of reference pixels (capSizes).
  const timelineRefits = new Map<number, (offset: number) => TimelineLayout>();
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
  // LH-149: the scale has the half step between each two of LH-17's steps (typeScaleStep's `half`: 16, 17, 18, 20, 21, 23, 24, 26, 28, 30
  // and 32 px at the default floor). Siblings sized jointly take one size for all (a grid's rows, a stack, parallel regions and the block
  // below them), so a whole step under the size they fit cost every one of them a step: six FAQ pairs that fit 24 px drew at 21 (now
  // 23). With the half steps a block or a set loses at most half a step, and sizes stay few and shared.
  // The half steps are a guarded rule (`half-steps`): a joint fit at a half step gives its rows other heights than the full step under it,
  // and a sibling can fit less there, so the guard keeps them only where no block is smaller than without them. It fires when a fit or a
  // joint trial settles on a half step (halfTrial).
  const scaleStep = (size: number, floorPx: number): number => typeScaleStep(size, floorPx, scale, ruleOn('half-steps'));
  const halfTrial = (size: number, floorPx: number): void => {
    if (ruleOn('half-steps') && Math.abs(typeScaleStep(size + 1e-6, floorPx, scale) - size) > 1e-6 && Math.abs(typeScaleStep(size + 1e-6, floorPx, scale, true) - size) < 1e-6) fire('half-steps');
  };
  // The sizes a joint fit tries, largest first: the start, then every step of the scale under it, down to the floor.
  const scaleSizes = (start: number, floorPx: number): number[] => {
    const sizes = [Math.max(start, snapFontSizeUp(floorPx * scale))];
    for (let step = scaleStep(sizes[0]! - 1e-6, floorPx); step < sizes.at(-1)! - 1e-9; step = scaleStep(step - 1e-6, floorPx)) sizes.push(step);
    return sizes;
  };
  // LH-144: the largest body size `composition.maxFontSize` allows, in canvas px (never under the floor); Infinity without one.
  const capOf = (settings: Composition = composition): number => {
    const cap = settings.maxFontSize ?? composition.maxFontSize;
    return cap === undefined ? Infinity : Math.max(snapFontSizeUp((settings.minFontSize ?? 16) * scale), snapFontSizeDown(cap * scale + FONT_GRID_EPSILON));
  };
  const largestPart = (layout: { parts: readonly { fit?: { fontSize: number }; visible?: boolean }[] }): number => Math.max(0, ...layout.parts.flatMap(part => part.visible === false || !part.fit ? [] : [part.fit.fontSize]));
  const range = (from: number, to: number) => Array.from({ length: to - from }, (_, index) => from + index);
  const decisions: CompositionDecision[] | undefined = options.explain ? [] : undefined;
  const inheritedSettings = (parent: Composition, own: Composition = {}): Composition => ({
    minFontSize: parent.minFontSize,
    ...(parent.maxFontSize !== undefined ? { maxFontSize: parent.maxFontSize } : {}),
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
  const measureQuote = (node: Pending, box: LayoutBox, settings: Composition, floorFallback = false, bodySize?: number): QuoteLayout => {
    const lay = (share?: number) => layoutQuote(node.value as string | QuoteContent, acceptedBox(box), {
      fontFamilies:options.fontFamilies,textMeasurement:options.textMeasurement,scale,minFontSize:settings.minFontSize,path:node.path,direction:textDirection,floorFallback,
      ...(citationMarker?{citationMarker}:{}),...(deckLanguage()!==undefined?{language:deckLanguage()!}:{}),...grownOptions(node),
      ...(bodySize !== undefined ? {bodySize:bodySize / scale} : besideQuote(node) && ruleOn('quote-beside') ? {bodySize:LEAD_NOMINAL_SIZE,bodyLines:QUOTE_BESIDE_LINES} : {}),
      ...(share !== undefined ? {portrait:'side' as const,portraitShare:share} : {}),
    });
    const portrait = quotePortrait(node, box);
    if (portrait !== 'automatic') return lay(portrait === 'side' ? QUOTE_PORTRAIT_SHARE : undefined);
    // The automatic portrait takes room the quote's text does not need: the widest share, from QUOTE_PORTRAIT_SHARE down by
    // QUOTE_PORTRAIT_STEP, at which every part keeps the size it has beside the avatar (the body may take more lines in the empty height)
    // and nothing new is found. Where none is (a long quote that fills its box), the quote keeps the avatar.
    const avatar = lay(), size = (layout: QuoteLayout, role: string) => layout.parts.find(part => part.role === role)?.fit;
    for (let share = QUOTE_PORTRAIT_SHARE; share > 1e-6 && box.width * share >= PORTRAIT_MIN.side * scale; share -= QUOTE_PORTRAIT_STEP) {
      const side = lay(share);
      if (!side.photo?.focus) break;
      if (side.diagnostics.length > avatar.diagnostics.length || avatar.parts.some(part => (size(side, part.role)?.fontSize ?? 0) < (part.fit?.fontSize ?? 0) - 1e-9)) continue;
      fire('portraits');
      return side;
    }
    return avatar;
  };
  // LH-132: a quote's photo is a portrait beside it when the author asks (`portrait: "side"`), or automatically (the guarded rule `portraits`) when the quote is at least QUOTE_PORTRAIT_MIN_WIDTH wide and is not a quote
  // beside other blocks (LH-78's lead). `avatar` keeps the circle beside the attribution. While a lone quote chooses its growth (fillLone)
  // it is measured with the avatar (`avatarQuotes`), so the portrait never changes the size the quote grows to, only where it is drawn.
  const avatarQuotes = new WeakSet<Pending>();
  const quotePortrait = (node: Pending, box: LayoutBox): 'side' | 'automatic' | undefined => {
    const value = record(node.value);
    if (value.photo === undefined || value.portrait === 'avatar') return undefined;
    if (value.portrait === 'side') return 'side';
    return value.portrait !== undefined || avatarQuotes.has(node) || (options as Record<symbol, unknown>)[AVATAR_QUOTES] === true || !ruleOn('portraits') || besideQuote(node) || box.width < QUOTE_PORTRAIT_MIN_WIDTH * scale ? undefined : 'automatic';
  };
  // LH-101: the lone code panels fillLone gave their whole cell; their lines sit in the middle of it (layoutCode's `fill`).
  const fullPanels = new WeakSet<Pending>();
  const measureCode = (node: Pending, box: LayoutBox, settings: Composition, floorFallback = false, hug = false) => layoutCode(node.value as string | CodeContent, acceptedBox(box), {
    fontFamilies:options.fontFamilies,textMeasurement:options.textMeasurement,scale,minFontSize:settings.minFontSize,path:node.path,floorFallback,...grownOptions(node),
    ...(fullPanels.has(node)&&!hug?{fill:true}:{}),
  });
  // LH-112: whether a metric beside other blocks is start-aligned (metric-start, or with its display size, metric-display): unless the slide
  // or the deck sets the content alignment (a layout's or theme's centering is the default for short text, as LH-70 reads it).
  const metricStarts = (node: Pending): boolean => tierMetricPaths.has(node.path) || metricDisplay.has(node.path) && (hints.contentAlignment === undefined || hints.sources.contentAlignment === 'layout' || hints.sources.contentAlignment === 'theme') && (ruleOn('metric-start') || ruleOn('metric-display'));
  // The display size grows against the slide's body height (contentBox), so the height a metric needs (naturalHeight) and its placed
  // layout ask for the same value.
  const measureMetric = (node: Pending, box: LayoutBox, settings: Composition, floorFallback = false, roleSizes?: MetricLayoutOptions['roleSizes'], tile = false, pill?: 'above') => {
    const tier = tile ? undefined : tierMetricPaths.get(node.path);
    const starts = !tile && metricStarts(node), display = tile ? undefined : tier ?? (ruleOn('metric-display') ? metricDisplay.get(node.path) : undefined);
    if (!tier && starts && alignmentFor('metric') !== 'left') fire('metric-start');
    if (display && !tier) fire('metric-display');
    const metricOptions: MetricLayoutOptions = {
      fontFamilies:options.fontFamilies,textMeasurement:options.textMeasurement,scale,minFontSize:settings.minFontSize,path:node.path,floorFallback,
      textRasterPadding:options.textRasterPadding,...(roleSizes?{roleSizes}:{}),...grownOptions(node),
      align:tile||starts?'left':alignmentFor('metric'),direction:textDirection,...(tile?{tile,...(tileFloors?.get(node.path)?{minimumSizes:tileFloors.get(node.path)}:{})}:{}),
      ...(display?{display:{...display,height:contentBox.height}}:{}),...(tier?{eyebrow:true}:{}),
      // LH-135: a tier's price is a figure whatever the guard's other rules do (LH-127): "$1,200/mo" never splits.
      figure:ruleOn('metric-figure')||tier!==undefined,
      ...(deckLanguage()!==undefined?{language:deckLanguage()}:{}),
      // LH-137: the delta as a pill beside or above the value (the guarded rule `delta-pill`). Not in LH-83's automatic grid at the floor
      // (RECOMPOSE): the room a pill frees there would decide between the layout and the grid, which the pill, a drawing, never does.
      ...(ruleOn('delta-pill')&&(options as Record<symbol,unknown>)[RECOMPOSE]!==true?{deltaPill:pill??true}:{}),
    };
    // LH-15: a metric at display size in a cell at least METRIC_BAND_RATIO times as wide as it is tall (as the cell gives it, or as the metric
    // stacks when the cell takes its natural height) is a band: the value at the start and its other fields beside it.
    // LH-137: judged without the delta pill, whose shorter stack would make a band of a metric that is none without it.
    const band = display !== undefined && !tier && starts && box.width >= METRIC_BAND_RATIO * Math.min(box.height, layoutMetric(node.value as string | number | MetricContent, acceptedBox({...box,height:1e6}), {...metricOptions,floorFallback:false,deltaPill:false}).bounds.height);
    const laid = layoutMetric(node.value as string | number | MetricContent, acceptedBox(box), {...metricOptions,...(band?{band}:{})});
    if (FIGURE_LINES.has(laid)) fire('metric-figure');
    if (laid.deltaPill) fire('delta-pill');
    return laid;
  };
  // LH-07: the blocks of a `sequence` region set side by side under step badges (composeTemplate marks them): each leaves a band for
  // its badge above its text, in the height it asks for (naturalHeight) and in its cell (placeNode), so the badge never costs a row or
  // a neighbor its room. A flow list (stepFlows, by path) is drawn as chips once placed.
  const stepUnits = new WeakSet<Pending>(), stepPaths = new Set<string>(), stepFlows = new Set<string>();
  const stepBand = (size: number) => STEP_BADGE * size * (1 + STEP_BADGE_GAP);
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
    // LH-129: first by the type scale's steps, as LH-48 grows a lone block: two or three steps of its labels (18 and 22 px roles to
    // 24 and 28, or 28 and 32), when it keeps its arrangement and fits its box; then by LH-41's few pixels.
    // A label that wraps at the larger size reads worse than the smaller one on its line: every label (the name, a date, an event)
    // keeps its line count; descriptions may wrap.
    const lines = (layout: TimelineLayout) => layout.parts.map(part => part.role === 'description' || part.role === 'event-description' ? 0 : part.fit?.lines.length ?? 0).join();
    // LH-144: growth stops at composition.maxFontSize.
    const capped = (layout: TimelineLayout) => largestPart(layout) <= capOf(settings) + FONT_GRID_EPSILON;
    for (const growth of TIMELINE_STEP_GROWTH) {
      const grown = measureTimeline(node, box, settings, 'placed', growth);
      if (!grown.overflow && grown.arrangement === placed.arrangement && lines(grown) === lines(placed) && capped(grown)) return grown;
    }
    for (let growth = TIMELINE_GROWTH; growth > 0; growth--) {
      const grown = measureTimeline(node, box, settings, 'placed', growth);
      if (!grown.overflow && grown.arrangement === placed.arrangement && capped(grown)) return grown;
    }
    return placed;
  };
  // RR-34: a captioned leaf is scored and placed on the media box that remains after its caption band.
  const captionOf = (node: Pending, box: LayoutBox) => node.caption !== undefined && node.captionPath ? layoutCaption(node.caption, box, node.captionPath, node.field === 'image' ? { ...annotationOptions, nameDetail: true } : annotationOptions) : undefined;
  // The proportions of a picture an automatic composition shows whole (fit contain, no frame shape of its own) when core can read them.
  const wholePictureAspect = (node: Pending): number | undefined => {
    const host = node.host;
    if (node.field !== 'image' || !host || !autoComposition() || host.aspectRatio !== undefined || host.shape === 'ellipse') return undefined;
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
  const stackedBoxes = (nodes: Pending[], area: LayoutBox, requestedGap: number, settings: Composition, cards = hasCards && !insideTier, anchor: 'top' | 'middle' | 'bottom' = 'top'): LayoutBox[] => {
    const between = Math.max(0, Math.min(requestedGap, area.width / 2, area.height / (nodes.length * 2)));
    const space = Math.max(0, area.height - between * (nodes.length - 1)), share = space / nodes.length;
    const elastic = nodes.map(node => !measuredNode(node)), stretch = elastic.filter(Boolean).length;
    const needs = nodes.map((node, index) => elastic[index] ? share : naturalHeight(node, area.width, cards, undefined, settings));
    const floors = nodes.map((node, index) => elastic[index] ? share : naturalHeight(node, area.width, cards, undefined, settings, true));
    let heights = shareHeights(needs, floors, space);
    // LH-135: a tier's price takes the height its details leave (between its role size and its display size), so the details keep the
    // size they fit at, and the metric's label and description keep theirs.
    const priceAt = nodes.findIndex(node => tierMetricPaths.has(node.path));
    if (priceAt >= 0 && needs[priceAt]! > floors[priceAt]! + 1e-6) {
      const others = needs.reduce((sum, need, index) => index === priceAt ? sum : sum + need, 0);
      if (floors[priceAt]! + others <= space + 1e-6) heights = needs.map((need, index) => index === priceAt ? Math.min(need, Math.max(floors[priceAt]!, space - others)) : need);
    }
    // WI-4: prose and lists that do not fit at their role sizes shrink together to the largest one size that fits, instead of each
    // block taking the size its share of the column happens to allow (23, 21 and 25 px in one column).
    const textual = nodes.every(node => !node.children && node.caption === undefined && (node.field === 'text' || node.field === 'items' || node.field === 'bullets'));
    if (textual && nodes.length > 1 && needs.reduce((sum, size) => sum + size, 0) > space + 1e-6) {
      // LH-17: the trial sizes are the type scale's, so the stack is sized for the size its blocks are set at.
      for (const trial of scaleSizes(Math.max(...nodes.map(node => proseMeasure(node, area.width).size)), settings.minFontSize ?? 16)) {
        const natural = nodes.map(node => naturalHeight(node, area.width, cards, undefined, settings, false, Math.min(trial, proseMeasure(node, area.width).size)));
        if (natural.reduce((sum, height) => sum + height, 0) <= space + 1e-6) { heights = natural; halfTrial(trial, settings.minFontSize ?? 16); break; }
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
  const COMPACT_GRID_FILL = .45;
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
    if (node.field === 'chart' || node.field === 'diagram') return frame(SPLIT_CHART_SHAPE);
    if (node.field === 'shape') return frame(Number(record(node.host).aspectRatio) > 0 ? Number(record(node.host).aspectRatio) : presetAspect(typeof record(node.host).shape === 'string' ? record(node.host).shape : undefined));
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
    if (node.field === 'image' || node.field === 'video' || node.field === 'diagram' || node.field === 'shape') placeNode(node, cell, settings, hasCards, undefined, undefined, 'middle');
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
    // LH-132: a team's portrait cards in the automatic grid: one row across the top (up to PORTRAIT_TOP_MAX), the grid flow otherwise.
    const team = !hasRegions && count === nodes.length && settings.columns === undefined && !settings.weights?.length && nodes.every(node => personParts.has(node.path));
    if (team) cols = portraitMode === 'top' && count <= PORTRAIT_TOP_MAX ? count : gridFlowShape(count, area.width >= area.height).columns;
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
      && !nodes.every(node => !node.children && (node.field === 'image' || node.field === 'video')) && !team) {
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
      grid.boxes = jointRowBoxes(nodes, grid.boxes, nodes.map((_, index) => Math.floor(index / cols)), area, grid.gap, settings, hasCards, 'top', true, area === contentBox && !pullItem);
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
  // A diagram is laid out for its box in the body family (the code family for code-like labels) at the largest base size from the prose
  // size down at which it fits with every label at or above the readability floor, then drawn at that size, centered across and placed
  // by the anchor down. A source that cannot be drawn reports its issue; a drawing that only fits below the floor overflows.
  const directionName = (direction: string) => ({ LR: 'left to right', RL: 'right to left', TB: 'top to bottom', TD: 'top to bottom', BT: 'bottom to top' } as Record<string, string>)[direction] ?? direction;
  const composeDiagram = (node: Pending, box: LayoutBox, settings: Composition, anchor: RegionAnchor): ComposedDiagramItem => {
    const floor = snapFontSizeUp((settings.minFontSize ?? 16) * scale), nominal = Math.max(floor, DIAGRAM_NOMINAL_SIZE * scale);
    const measure = diagramMeasure(options.textMeasurement, options.fontFamilies?.body ?? 'sans-serif', options.fontFamilies?.code ?? FALLBACK_CODE_FAMILY);
    try {
      const laid = layoutDiagram(node.value, { width: box.width, height: box.height, nominal, floor, measure, idPrefix: `opf-${node.path.replace(/[^\w-]+/g, '-')}`, grid: { down: snapFontSizeDown, up: snapFontSizeUp } });
      const width = laid.width * laid.scale, height = laid.height * laid.scale;
      // LH-185: a flowchart or state diagram that does not fit at the floor is tried in the other main direction first.
      const turn = laid.direction;
      if (turn?.turned) diagnostics.push({ code: 'arrangement-adapted', path: node.path, message: `The ${laid.type === 'state' ? 'state diagram' : 'flowchart'} is drawn ${directionName(turn.to)} because ${directionName(turn.from)} does not fit at the readability floor.` });
      if (laid.overflow) diagnostics.push({ code: 'text-overflow', path: node.path, message: `The diagram does not fit its block at the readability floor${turn ? ` in either direction (${directionName(turn.from)} and ${directionName(turn.to)} were tried)` : ''}, so it is drawn smaller; give it a slide or region of its own, split it into smaller diagrams${turn ? '' : ', or draw it the other way (flowchart LR or TB, direction LR in a state diagram)'}.` });
      // A diagram is a figure: centered in its block unless the region anchors it to the bottom.
      return { ...laid, box: roundBox({ x: box.x + (box.width - width) / 2, y: box.y + anchoredOffset(box.height - height, anchor === 'bottom' ? 'bottom' : 'middle'), width, height }) };
    } catch (error) {
      const issue: DiagramIssue = (error as { diagramIssue?: DiagramIssue }).diagramIssue ?? { code: 'diagram-syntax', message: error instanceof Error ? error.message : String(error) };
      const where = issue.line !== undefined ? ` (line ${issue.line}, column ${issue.column})` : '';
      // A type a browser has not loaded yet is a state of the page, not of the document: the engines draw it as loading.
      if (issue.code !== 'diagram-unloaded') diagnostics.push({ code: 'unresolved-content', path: node.path, message: `The diagram cannot be drawn${where}: ${issue.message}` });
      return { box, issue };
    }
  };
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
      // LH-160: a histogram's bin count, edge decimals and whether its value labels fit (chart-histogram.ts).
      const histogram = chartHistogram(drawn.chart, drawn.data, geometry);
      if (histogram) layer = {...layer, histogram};
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
  // LH-132: one person of a team (personParts) as one card. The portrait goes across the top of the card at its inner width (`top`), or
  // beside the text at the start edge at PORTRAIT_SIDE_SHARE of the width (`side`), each text centered against it. The text comes first:
  // the team's texts take the largest size of the type scale at which the tallest of them fits under a square portrait (top; down to
  // PORTRAIT_TEXT_SIZE, and under a 4:3 one below that) or in the card's height (side), and the portrait grows into the room left, up to
  // PORTRAIT_TALLEST for its width, so it takes empty room, never the text's. Every person reserves that tallest text, so the cards are
  // equal and their portraits align; the card holds the portrait and the text and is centered in its cell. A card too wide for a top
  // portrait (two people in a row) draws it beside the text where that column reads well (PORTRAIT_SIDE_CHARS). The picture keeps its authored fit and focus (cover from the upper third when
  // none is given) in a frame rounded as a card is, unless the author shaped it other than a circle. Returns false, and the person keeps
  // the avatar, when the portrait would be flatter than PORTRAIT_WIDEST or narrower than PORTRAIT_MIN, or the text narrower than
  // PORTRAIT_MIN or too tall for the card at the floor.
  const portraitHosts = new Map<string, Record<string, unknown>>(), teamText = new Map<string, { size: number; need: number } | undefined>();
  const placePerson = (node: Pending, person: { image: Pending; text: Pending }, box: LayoutBox, settings: Composition, cards: boolean, frame?: LayoutBox): boolean => {
    const own = inheritedSettings(settings, { ...node.composition, mode: 'column' });
    const drop = cards && frame ? gap * CARD_FILL_SPACE : 0, cell = acceptedBox(frame ? { ...frame, y: frame.y + drop, height: Math.max(scale, frame.height - drop) } : box);
    const inner = cards ? payloadBox(cell, true) : cell, between = PORTRAIT_GAP * scale, floorPx = own.minFontSize ?? 16, floor = snapFontSizeUp(floorPx * scale);
    // LH-132 review: a text column beside a portrait keeps every name of the team on one line and holds at least PORTRAIT_SIDE_CHARS
    // characters a line of the role and line (their average width measured), as LH-77's heading list draws them: the name bold at
    // LIST_HEADING_SCALE times the list size, the description at the list size. Only an authored `side` is drawn without that.
    const textWidthOf = (weight: 400 | 700) => textWidthMeasurer(resolveTextStyle({ fontFamily: options.fontFamilies?.body ?? 'sans-serif', fontWeight: weight, italic: false, path: node.path }, options.textMeasurement), options.textMeasurement);
    const nameWidth = textWidthOf(700), lineWidth = textWidthOf(400);
    const readable = (width: number, size: number) => portraitAuthored && portraitMode === 'side' || [...personParts.values()].every(entry => {
      const entry0 = entry.text.field === 'text' ? undefined : record((entry.text.value as unknown[])[0]), name = String(entry0 ? entry0.text : entry.text.value).trim();
      const lines = typeof entry0?.description === 'string' ? entry0.description.replace(/\s+/gu, ' ').trim() : '';
      return nameWidth(name, entry0 && lines ? size * LIST_HEADING_SCALE : size) <= width + .5 && (!lines || width * lines.length / Math.max(1e-6, lineWidth(lines, size)) >= PORTRAIT_SIDE_CHARS - 1e-6);
    });
    const plan = (mode: Exclude<PortraitMode, 'avatar'>, share = PORTRAIT_SIDE_SHARE) => {
      const side = mode === 'side', pictureWidth = side ? inner.width * share : inner.width, textWidth = side ? inner.width - pictureWidth - between : inner.width;
      if (pictureWidth < PORTRAIT_MIN.side * scale || textWidth < PORTRAIT_MIN.text * scale) return undefined;
      const needs = (text: Pending, size: number) => naturalHeight(text, textWidth, false, undefined, own, false, size) + 2 * rasterPadding + scale;
      const key = `${mode}:${round(textWidth)}:${round(inner.height)}`;
      if (!teamText.has(key)) {
        const team = [...personParts.values()].map(entry => entry.text), sizes: number[] = [];
        for (let size = proseMeasure(person.text, textWidth).size; ; size = Math.max(floor, scaleStep(size - .01 * scale, floorPx))) { sizes.push(size); if (size <= floor + 1e-9) break; }
        const need = new Map(sizes.map(size => [size, Math.max(...team.map(text => needs(text, size)))]));
        const fits = (room: number, least = floor) => sizes.find(size => size >= least - 1e-9 && need.get(size)! <= room + .01 && (!side || readable(textWidth, size)));
        const size = side ? fits(inner.height) : fits(inner.height - between - pictureWidth, PORTRAIT_TEXT_SIZE * scale) ?? fits(inner.height - between - pictureWidth / PORTRAIT_WIDEST);
        teamText.set(key, size === undefined ? undefined : { size, need: need.get(size)! });
      }
      const text = teamText.get(key);
      if (!text) return undefined;
      const pictureHeight = Math.min(side ? inner.height : inner.height - between - text.need, pictureWidth / PORTRAIT_TALLEST[mode]);
      return pictureHeight * PORTRAIT_WIDEST < pictureWidth - .5 ? undefined : { side, pictureWidth, pictureHeight, textWidth, text, ownNeed: side ? Math.min(text.need, needs(person.text, text.size)) : text.need };
    };
    // An authored mode is kept where it fits (top gives way to side); the automatic top portrait gives way to the side one where the side
    // one sets the text larger.
    // A side portrait takes PORTRAIT_SIDE_SHARE of the card, or less (down to PORTRAIT_SIDE_LEAST) where the wider column sets the team's text
    // larger: the share with the largest text, the widest of equals.
    const sideways = () => PORTRAIT_SIDE_SHARES.map(share => plan('side', share)).reduce<ReturnType<typeof plan>>((best, next) => next && (!best || next.text.size > best.text.size + 1e-9) ? next : best, undefined);
    const wanted = portraitMode === 'side' ? sideways() : plan(portraitMode!), beside = portraitMode === 'top' && (!wanted || !portraitAuthored) ? sideways() : undefined;
    const chosen = wanted && !(beside && !portraitAuthored && beside.text.size > wanted.text.size + 1e-9) ? wanted : beside;
    if (!chosen) { portraitFallback = true; return false; }
    const { side, pictureWidth, pictureHeight, textWidth, text, ownNeed } = chosen;
    const content = side ? Math.max(pictureHeight, text.need) : pictureHeight + between + text.need;
    const insetTop = inner.y - cell.y, insetBottom = cell.y + cell.height - inner.y - inner.height, height = Math.min(cell.height, content + insetTop + insetBottom);
    const card = { ...cell, y: cell.y + (cell.height - height) / 2, height }, start = card.y + insetTop;
    const picture = side ? { x: rtl ? inner.x + inner.width - pictureWidth : inner.x, y: start + (content - pictureHeight) / 2, width: pictureWidth, height: pictureHeight } : { x: inner.x, y: start, width: inner.width, height: pictureHeight };
    const words = side ? { x: rtl ? inner.x : inner.x + pictureWidth + between, y: start + (content - ownNeed) / 2, width: textWidth, height: ownNeed } : { x: inner.x, y: start + pictureHeight + between, width: inner.width, height: text.need };
    const host = record(person.image.host), shape = host.shape === undefined || host.shape === 'ellipse' ? 'roundRect' : host.shape, first = items.length;
    portraitHosts.set(person.image.path, { ...host, shape, fit: host.fit ?? 'cover', focus: host.focus ?? portraitFocus(), ...(shape === 'roundRect' && record(host.adjust).adj === undefined ? { adjust: { ...record(host.adjust), adj: Math.min(.5, CARD_RADIUS * scale / Math.min(picture.width, picture.height)) } } : {}) });
    if (!node.synthetic) groups.push({ path: node.path, box, contentBox: inner, composition: own });
    const wasTier = insideTier;
    insideTier = true;
    try { placeNode(person.image, roundBox(picture), own, false); placeNode(person.text, words, own, false, undefined, undefined, 'top'); }
    finally { insideTier = wasTier; }
    if (cards) for (const item of items.slice(first)) item.frameBox = card;
    fire('portraits');
    return true;
  };
  // SH-02: a shape block in its cell (shape-block.ts composeShape): the frame at the preset's aspect (or the block's aspectRatio), placed by the
  // region's anchor, and its text fitted in the text rectangle less the insets by the measured fonts, from the body size down to the
  // readability floor and never below it (a text that does not fit there overflows with a finding).
  const placeShape = (node: Pending, cell: LayoutBox, settings: Composition, anchor: RegionAnchor): void => {
    const host = node.host ?? {}, hostPath = node.hostPath ?? node.path, textPath = `${hostPath}.text`;
    const shape = composeShape(host, roundBox(cell), { scale, anchorY: anchor === 'bottom' ? 'bottom' : anchor === 'top' ? 'top' : 'middle' });
    const text = fitShapeText(shape, host.text, textPath, settings.minFontSize, diagnostics);
    items.push({ path: node.path, field: 'shape', type: 'shape', value: node.value, payload: node.payload, box: { ...shape.box }, shape, ...(text ? { text } : {}), textStyle: { ...styleFor('text', textPath), ...(shape.textBold ? { fontWeight: 700 } : {}) }, composition: settings, alignment: 'center' });
  };
  const placeNode = (node: Pending, box: LayoutBox, settings: Composition, cards = hasCards, listColumns?: 'auto' | 1, metricReferenceHeight?: number, anchor: RegionAnchor = 'top', frame?: LayoutBox): void => {
    // LH-06: the block or group with the slide's emphasis is drawn on its surface, a card in its cell; nothing drawn on the surface takes
    // a card of its own. A group's children are arranged inside the card's inset.
    const emphasized = !insideEmphasis && node.emphasis !== undefined && node.emphasis === chosenEmphasis;
    // LH-131: a cell of a featured set (not inside another card) is drawn on one plain card, as the featured one is on the surface.
    const ownCard = !insideEmphasis && !insideCard && node.cardCell === true;
    // LH-131: a card of a before and after pair, narrower on its inner side to leave the arrow room (PAIR_ROOM).
    const room = pairRoom?.get(node.path) ?? (node.children ? undefined : pairRoom?.get(node.path.slice(0, node.path.lastIndexOf('.'))));
    if (room) { const trim = (area: LayoutBox): LayoutBox => ({ ...area, x: room.side === 'left' ? area.x + room.width : area.x, width: Math.max(scale, area.width - room.width) }); box = trim(box); if (frame) frame = trim(frame); }
    if (node.children) {
      const person = personParts.get(node.path);
      if (person && !insideEmphasis && placePerson(node, person, box, settings, cards, frame)) return;
      // LH-135: a pricing tier is one card of its cell (the cell's top edge one half gap down, as every filled card's is): its children are
      // placed in the card's insets with no card of their own, from the top, and share the card's frame (one card under the first of them).
      // LH-131 with LH-135: the featured tier ("most popular") or an authored emphasis is the emphasis surface over that same card, so the
      // tiers stay equal cards (one top edge, one height, one inset) and only the featured one is drawn on the surface.
      if (tierGroups.has(node.path) && !insideEmphasis && cards) {
        const drop = frame ? gap * CARD_FILL_SPACE : 0, card = acceptedBox(frame ? { ...frame, y: frame.y + drop, height: Math.max(scale, frame.height - drop) } : box);
        const own = inheritedSettings(settings, { ...node.composition, mode: 'column' }), inner = inset(payloadBox(card, true), own), first = items.length;
        if (!node.synthetic) groups.push({ path: node.path, box, contentBox: inner, composition: own });
        if (emphasized) surface = { path: node.emphasis!, box: card, radius: CARD_RADIUS * scale, shape: 'card', source: node.emphasis === featuredPath ? 'featured' : 'authored' };
        insideTier = true; insideEmphasis ||= emphasized;
        try { arrange(node.children, inner, own, 0, node.gap ?? groupGap(own, box), node.path, !node.synthetic); }
        finally { insideTier = false; if (emphasized) insideEmphasis = false; }
        if (!emphasized) for (const item of items.slice(first)) item.frameBox = card;
        const price = items.findIndex((item, index) => index >= first && item.metricLayout !== undefined);
        if (price >= 0) tierPrices.push(price);
        fire('tier-cards');
        return;
      }
      if (emphasized) surface = { path: node.emphasis!, box: acceptedBox(frame ?? box), radius: CARD_RADIUS * scale, shape: 'card', source: node.emphasis === featuredPath ? 'featured' : 'authored' };
      const own = inheritedSettings(settings, node.orient ? { ...node.composition, mode: pairMode(box) } : node.composition), inner = inset(emphasized || ownCard ? cellCardPayload(frame ?? box, node) : box, own);
      if (!node.synthetic) groups.push({ path: node.path, box, contentBox: inner, composition: own });
      // LH-152: a group's eyebrow takes a band at the top of the group; its children are arranged under it, and it is drawn over them
      // at the end (placeEyebrows), at the size its band was reserved for.
      // LH-14: a group's icon takes a band at the top of the group, above its eyebrow; its chip is placed over the group's items at the end.
      const chipOfGroup = groupChip(node, inner.width), iconBand = chipOfGroup * (1 + ICON_CHIP_GAP), top = iconBand ? { ...inner, y: inner.y + iconBand, height: Math.max(scale, inner.height - iconBand) } : inner;
      const brow = node.eyebrow ? groupEyebrow(node, inner.width) : undefined, first = items.length;
      const under = brow ? { ...top, y: top.y + brow.band, height: Math.max(scale, top.height - brow.band) } : top;
      insideEmphasis ||= emphasized;
      if (ownCard) insideCard = acceptedBox(frame ?? box);
      try { arrange(node.children, under, own, 0, node.gap ?? groupGap(own, box), node.path, !node.synthetic); }
      finally { if (emphasized) insideEmphasis = false; if (ownCard) insideCard = undefined; }
      if (brow && items.length > first) groupEyebrows.push({ members: items.slice(first), eyebrow: node.eyebrow!, size: brow.size, band: brow.band, ...(emphasized || ownCard ? { carded: true } : {}) });
      if (chipOfGroup && items.length > first) pendingIcons.push({ path: `${node.path}.icon`, owner: node.path, icon: iconFor(record(node.payload).icon)!, members: items.slice(first), diameter: chipOfGroup, ...(emphasized || ownCard ? { carded: true as const } : {}) });
      return;
    }
    // LH-48: a lone block that fills too little of its cell grows and moves to the cell's middle, its card hugging it.
    const lone = node.fills ? fillLone(node, frame ?? box, settings, cards) : undefined;
    // Its cell is as tall as its content, so only its width can make it too small (contentSized).
    if (lone) { box = lone; frame = undefined; metricReferenceHeight = undefined; contentSized.add(node); }
    // SH-02: a shape block draws its own fill and outline, so it takes no card; its frame sits in the cell, its text in its text rectangle.
    if (node.field === 'shape') { placeShape(node, box, settings, anchor); return; }
    const onSurface = emphasized || insideEmphasis;
    if (onSurface) cards = emphasized;
    else if (insideTier) cards = false;
    // LH-131: a block of a featured set's cell shares the cell's card; a lone block cell has its own.
    else if (insideCard) cards = false;
    else if (ownCard) cards = true;
    // LH-78: a quote beside other blocks is drawn on a card, unless the card's inset would make it overflow (below). On the emphasis
    // surface (LH-06) the surface is its card.
    const quoteCard = !cards && !onSurface && !insideCard && besideQuote(node);
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
    let frameBox = cards ? acceptedBox(frame ?? box) : insideCard;
    let metricHeight = metricReferenceHeight === undefined ? undefined : payloadBox({...box,height:metricReferenceHeight},cards).height;
    const cell = box;
    box = payloadBox(box, cards);
    let caption = captionOf(node, box);
    if (caption) box = caption.mediaBox;
    // LH-50: a paragraph's eyebrow takes a band at the top of its box; it is placed over the text's final box at the end (placeEyebrows).
    const brow = node.eyebrow ? eyebrowBand(node.eyebrow, box.width, proseMeasure(node, box.width).size) : 0;
    if (brow) box = { ...box, y: box.y + brow, height: Math.max(scale, box.height - brow) };
    // LH-07: a step's badge band, at its starting size, above its text.
    if (stepUnits.has(node)) { const band = stepBand(proseMeasure(node, box.width).size); box = { ...box, y: box.y + band, height: Math.max(scale, box.height - band) }; }
    // LH-14: a metric's icon takes a band at the top of its box, its chip and ICON_CHIP_GAP of it; the chip is placed over the metric's
    // final parts at the end (placeIcons).
    const chipOfMetric = metricChip(node);
    if (chipOfMetric) { const band = chipOfMetric * (1 + ICON_CHIP_GAP); box = { ...box, y: box.y + band, height: Math.max(scale, box.height - band) }; if (metricHeight !== undefined) metricHeight = Math.max(scale, metricHeight - band); }
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
    // LH-74: a picture alone on a card (no caption, no frame, shape or line of its own) that covers its frame fills the card to its edges,
    // clipped to the card's radius, with no inset and no stroke: the picture is the card, so none is drawn under it. A picture shown whole
    // (contain) keeps the card and its inset around it.
    // LH-132: a team portrait's host is its own (portraitHosts: a rounded frame of its own, cropped around the upper third), never this card.
    let imageHost: Record<string, any> = portraitHosts.get(node.path) ?? node.host ?? {};
    if (node.field === 'image' && !portraitHosts.has(node.path) && !personPictures.has(node.path) && cards && frameBox && !onSurface && !caption && !imageHost.aspectRatio && imageHost.adjust === undefined && (imageHost.shape === undefined || imageHost.shape === 'rect') && (imageHost.stroke === undefined || imageHost.stroke === 'none' || record(imageHost.stroke).width === 0)) {
      const radius = Math.min(.5, CARD_RADIUS * scale / Math.max(scale, Math.min(frameBox.width, frameBox.height))), host = { ...imageHost, shape: 'roundRect', adjust: { adj: radius } };
      const context = { ...imageContext(undefined, anchor), ...(coverPictures.has(node) ? { fit: 'cover' as const } : {}) };
      if (composeImage(host, node.hostPath ?? node.path, frameBox, frameBox, { ...context, diagnostics: [] }).fit === 'cover') { imageHost = host; box = frameBox; frameBox = undefined; }
    }
    const image = node.field === 'image' ? composeImage(imageHost, node.hostPath ?? node.path, box, box, { ...imageContext(undefined, anchor), ...(coverPictures.has(node) ? { fit: 'cover' as const } : {}) }) : undefined;
    if (caption) settleCaption(caption, image?.box ?? box, anchor);
    const chart = node.field === 'chart' ? composeChart(node, box, settings) : undefined;
    const diagram = node.field === 'diagram' ? composeDiagram(node, box, settings, anchor) : undefined;
    if (caption && diagram && !diagram.issue) settleCaption(caption, diagram.box, anchor);
    items.push({ path: node.path, field: node.field, type: node.type, value: node.value, payload: node.payload, box:codeLayout&&!codeLayout.overflow?{...acceptedBox(box),height:Math.min(acceptedBox(box).height,round(codeLayout.bounds.height))}:internal?acceptedBox(box):box, ...(image ? {image} : {}), ...(chart ? {chart} : {}), ...(diagram ? {diagram} : {}),
      ...(frameBox && !emphasized ? {frameBox} : {}),
      text, ...(node.field === 'text' && text && 'richLines' in text && runInOf(node.value) ? {runs: runInOf(node.value)!} : {}), textStyle: body?.style ?? styleFor(node.field,node.path), composition: settings, alignment: tile || (metricLayout && metricStarts(node)) ? 'left' : alignment, ...(quoteLayout?{quoteLayout}:{}), ...(codeLayout?{codeLayout}:{}), ...(metricLayout?{metricLayout}:{}), ...(timelineLayout?{timelineLayout}:{}),
      ...(bulletImage && node.payload.numbering === undefined && (node.field === 'items' || node.field === 'bullets') ? {bulletImage} : {}), ...(caption ? {caption} : {}),
      ...(regionTag !== undefined ? {region: regionTag} : {}), ...(columns && columns.length > 1 ? {listColumns: columns} : {}), ...(onSurface ? {emphasis: true as const} : {}), ...(tile ? {metricTile: true as const} : {}), ...(node.field === 'table' && growthOf.has(node) ? {tableGrowth: growthOf.get(node)!} : {}) });
    // LH-06: an emphasized leaf's card is the surface (a block with several payload fields: around all of them).
    if (emphasized && frameBox) {
      const own = surface && surface.path === node.emphasis ? surface.box : undefined;
      const right = Math.max(frameBox.x + frameBox.width, own ? own.x + own.width : -Infinity), bottom = Math.max(frameBox.y + frameBox.height, own ? own.y + own.height : -Infinity);
      const x = Math.min(frameBox.x, own?.x ?? Infinity), y = Math.min(frameBox.y, own?.y ?? Infinity);
      surface = { path: node.emphasis!, box: { x, y, width: right - x, height: bottom - y }, radius: CARD_RADIUS * scale, shape: 'card', source: node.emphasis === featuredPath ? 'featured' : 'authored' };
    }
    if (brow) eyebrowsOf.set(items[items.length - 1]!, node.eyebrow!);
    if (chipOfMetric) pendingIcons.push({ path: `${node.path}.icon`, owner: node.path, icon: iconFor(record(node.value).icon)!, members: [items[items.length - 1]!], diameter: chipOfMetric, metric: true });
    if (metricLayout && !metricLayout.overflow) { const metricBox = {...box,height:metricHeight ?? box.height}; metricRefits.set(items.length - 1, (roleSizes, pill) => measureMetric(node, metricBox, settings, false, roleSizes, tile, pill)); }
    if (timelineLayout) { const timelineBox = box; timelineRefits.set(items.length - 1, offset => measureTimeline(node, timelineBox, settings, 'placed', offset)); }
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
    // LH-07: a badge list is numbered (badgeNumbering when the payload is not), so its columns continue the count.
    const numbering = (badgeLists.has(node.path) ? badgeNumbering(node.path, node.payload.numbering) : node.payload.numbering) as NumberingInput | undefined;
    const listOptions: ListFitOptions = badgeLists.has(node.path) ? listOptionsFor(node.field, node.path, numbering) : { ...richOptions(styleFor(node.field, node.path)), ...listRows(values, node.path), ...(numbering !== undefined ? { numbering } : bulletImage ? { bulletImage } : noListBullet ? { bullet: 'none' as const } : {}) };
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
    // LH-144: the columns the role size chooses, set at composition.maxFontSize when they came out larger (the first page's columns).
    const cap = capOf(settings);
    const at = (columns: ComposedListColumn[], size: number) => columns.map(column => ({ ...column, text: renumber(fitList(chunk(column.start, column.end), column.box, size, size, listOptions), column.start) }));
    const capped = (columns: ComposedListColumn[]) => {
      if (Math.max(...columns.map(column => column.text.fontSize)) <= cap + FONT_GRID_EPSILON) return columns;
      const smaller = at(columns, cap);
      return smaller.some(column => column.text.overflow) ? columns : smaller;
    };
    if (mode === 'auto') {
      // One column first: a list that fits at the starting size stays one column.
      if (!fitList(values, box, start, start, listOptions).overflow) return undefined;
      for (const count of counts) {
        const columns = split(count, start, start);
        if (columns.every(column => !column.text.overflow)) return capped(columns);
      }
    }
    const count = counts.at(-1);
    if (count === undefined) return undefined;
    const shrunk = split(count, start, floor);
    return capped(at(shrunk, Math.min(...shrunk.map(column => column.text.fontSize))));
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
    const display = ((options as Record<symbol, unknown>)[GRID_GROW] === true ? COMPACT_GRID_DISPLAY : LONE_DISPLAY_SIZES.list) * scale;
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
    // LH-131: the emphasis surface's block or group and a featured set's cell are drawn on a card whatever the design's cards.
    if (!cards && cardedNode(node)) cards = true;
    const cellInset = node.children ? cellCardInset(node) : undefined;
    const pad = cellInset !== undefined ? 2 * cellInset : cards ? 2 * Math.min(CARD_INSET * scale, cellWidth / 4) : 0, inner = Math.max(scale, cellWidth - pad);
    // payloadBox's vertical inset, min(inset, height / 10), for a card of `content` plus that inset: content / 8 on each side.
    const verticalPad = (content: number) => cellInset !== undefined ? pad : cards ? 2 * Math.min(pad / 2, content / 8) : 0;
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
    // LH-152: a group's eyebrow band above its children.
    if (node.children) { const width = cards && cardedNode(node) ? inner : cellWidth, content = node.children.reduce((sum, child) => sum + naturalHeight(child, width, false, undefined, naturalSettings, atFloor), 0) + gap * Math.max(0, node.children.length - 1) + (node.eyebrow ? groupEyebrow(node, inner).band : 0) + groupChip(node, inner) * (1 + ICON_CHIP_GAP); return content + verticalPad(content); }
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
      if (stepUnits.has(node)) content += stepBand(fit.fontSize);
    } else if (node.field === 'quote') content = measureQuote(node, {x:0,y:0,width:inner,height:1e6}, naturalSettings).bounds.height + 18;
    else if (node.field === 'code') {
      // WI-1: measured as layoutCode lays it out: the header lines, the source at its starting size and the insets.
      const code = measureCode(node, {x:0,y:0,width:inner,height:1e6}, naturalSettings, false, true), source = code.parts.find(part => part.role === 'body');
      content = source?.fit ? source.box.y + source.fit.lines.length * source.fit.lineHeight + 18 : 1e6;
    }
    // LH-135: a tier's price at the floor of its stack is at its role size, not scaled down: display headroom is the only thing it gives up.
    else if (node.field === 'metric') content = measureMetric(node, {x:0,y:0,width:inner,height:metricReferenceHeight === undefined ? 1e6 : Math.max(scale,metricReferenceHeight-pad)}, naturalSettings, false, atFloor && tierMetricPaths.has(node.path) ? {value: METRIC_ROLE_VALUE_SIZE * scale} : undefined).bounds.height;
    // LH-41: laid out as the region will (a band, compact, at its role sizes or the floor): its name, label bands and markers.
    else if (node.field === 'timeline') content = measureTimeline(node, {x:0,y:0,width:inner,height:1e6}, naturalSettings, atFloor ? 'floor' : 'role').bounds.height + scale;
    else if (node.field === 'table') content = (atFloor ? measureTable(node, inner, naturalSettings, true)?.height : measureTable(node, inner, naturalSettings)?.naturalHeight) ?? ((Array.isArray(record(node.value).rows) ? record(node.value).rows.length : 4) + 1) * 36 * scale * (atFloor ? Math.min(1, floorSize / startSize) : 1);
    else content = inner / 1.6;
    if (atFloor && !tierMetricPaths.has(node.path) && !(node.field === 'text' || node.field === 'items' || node.field === 'bullets' || node.field === 'table' || node.field === 'timeline')) content *= Math.min(1, floorSize / startSize);
    // LH-14: a metric's chip band above it.
    const body = content + (node.caption !== undefined ? 32 * scale : 0) + eyebrowNeed + metricChip(node) * (1 + ICON_CHIP_GAP);
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
  // LH-132: a lone quote whose photo may be drawn beside it grows as it would with the avatar (avatarQuotes); when the photo is then drawn
  // beside it, it takes its whole cell, and its layout centers the photo and the text in it.
  const fillLone = (node: Pending, cell: LayoutBox, settings: Composition, cards: boolean): LayoutBox | undefined => {
    if (!node.fills || node.field !== 'quote' || quotePortrait(node, payloadBox(cell, cards)) === undefined) return fillLoneBlock(node, cell, settings, cards);
    let lone: LayoutBox | undefined;
    avatarQuotes.add(node);
    try { lone = fillLoneBlock(node, cell, settings, cards); } finally { avatarQuotes.delete(node); }
    return measureQuote(node, payloadBox(cell, cards), settings).photo?.focus ? cell : lone;
  };
  const fillLoneBlock = (node: Pending, cell: LayoutBox, settings: Composition, cards: boolean): LayoutBox | undefined => {
    // Decided once: the block is then placed in the cell this returns.
    if (!node.fills || options.fill === false) return undefined;
    node.fills = false;
    if (node.children || node.caption !== undefined || !LONE_FIELDS.has(node.field) || node.payload.columns !== undefined) return undefined;
    const inner = payloadBox(cell, cards), prose = node.field === 'text' || node.field === 'items' || node.field === 'bullets';
    if (inner.width <= 0 || inner.height <= 0) return undefined;
    // A table needs the height it is drawn at (its preferred rows), every other block the height its content takes.
    const slack = 2 * rasterPadding + scale, need = () => (node.field === 'table' ? measureTable(node, inner.width, settings)?.height ?? Infinity : naturalHeight(node, inner.width, false, undefined, settings)) + slack;
    // LH-07: a badge list grows as the plain list would (its badges do not count against the body it fills), as long as it fits with them.
    // LH-134: so does a list drawn beside numerals: its numerals and rules are drawing, as badges are.
    const plainNeed = () => {
      const badged = badgeLists.delete(node.path), numerals = numeralLists.get(node.path);
      numeralLists.delete(node.path);
      try { return need(); } finally { if (badged) badgeLists.add(node.path); if (numerals) numeralLists.set(node.path, numerals); }
    };
    let best = plainNeed();
    // LH-101: a lone code panel grows its code in type-scale steps as the other blocks do (up to LONE_DISPLAY_SIZES.code) and hugs it in
    // the middle of the body. Only code that then fills at least LONE_TARGET of the body takes the whole cell, its lines in the middle of
    // the panel (layoutCode's `fill`): a five-line snippet on a full-body panel left most of a dark panel empty (wave 4 golden review).
    const panel = node.field === 'code', wholePanel = () => { fullPanels.add(node); return cell; };
    const fillsPanel = () => panel && best >= LONE_TARGET * inner.height - 1e-6 && best <= inner.height;
    // A panel's need counts its insets and its filename row, so a panel under LONE_TARGET still grows and centers.
    // LH-133: a lone list drawn as ruled rows takes the whole cell once it has grown (or when it needs no growth): its rows spread over it.
    const ruled = (node.field === 'items' || node.field === 'bullets') && listOptionsOf(node.field, node.path, node.payload.numbering, node.value).rows === true;
    const spreadCell = () => { spreadLists.add(node.path); return cell; };
    if (best >= (panel ? LONE_TARGET : LONE_FILL) * inner.height) return fillsPanel() ? wholePanel() : ruled ? spreadCell() : undefined;
    const floor = snapFontSizeUp((settings.minFontSize ?? 16) * scale);
    if (prose) {
      const start = proseMeasure(node, inner.width).size, display = (node.field === 'text' ? LONE_DISPLAY_SIZES.text : LONE_DISPLAY_SIZES.list) * scale;
      let chosen: number | undefined;
      for (let size = start; ; ) {
        const step = scaleAbove(size, settings.minFontSize ?? 16);
        if (step > display + 1e-9 || step > capOf(settings) + FONT_GRID_EPSILON) break;
        proseGrowth.set(node, step);
        const height = plainNeed(), measure = proseMeasure(node, inner.width);
        const fit = fitContent(node.field, node.value, contentText(node.field, node.value) ?? '', { ...inner, width: measure.width }, step, floor, node.path, node.payload.numbering);
        if (height > LONE_TARGET * inner.height || fit.overflow || fit.fontSize < step - 1e-9) break;
        chosen = step; best = height; size = step;
      }
      if (chosen === undefined) proseGrowth.delete(node); else { proseGrowth.set(node, chosen); loneGrowth = true; }
      // LH-09, LH-69: a lone text of at most SHORT_MESSAGE_WORDS words (messageWords) is the slide's message: it grows on with its lines
      // balanced, up to MESSAGE_DISPLAY_SIZE in at most MESSAGE_DISPLAY_LINES lines, while it fills at most LONE_TARGET of the body, as Claude
      // Design sets a short message (b09 s36, b06 s05); a text of at most SHORT_TEXT_WORDS words ("Ship in March") up to the display title's
      // size. It stays in the body face: the words its author set bold still stand out (displayEmphasis), and a lone short text, which
      // nearly every minimal deck has, loads no other face. It is kept only at a step above the size the plain text reached, so balanced
      // lines never cost it a step (the guarded rule `display-message`).
      // A text that cites or carries a footnote is evidence, set as body text: its markers belong to a paragraph, not a display line.
      const cited = Array.isArray(node.value) && node.value.some(run => run && typeof run === 'object' && ((run as { cite?: unknown }).cite !== undefined || (run as { footnote?: unknown }).footnote !== undefined));
      const words = node.field === 'text' && !cited ? messageWords(node.value) : Infinity;
      if (words <= SHORT_MESSAGE_WORDS && ruleOn('display-message')) {
        const reached = chosen ?? start, cap = (words <= SHORT_TEXT_WORDS ? HEADING_DISPLAY_SIZES.title : MESSAGE_DISPLAY_SIZE) * scale, plain = { growth: proseGrowth.get(node), best };
        displayTexts.add(node.path);
        let shown: number | undefined;
        for (let size = reached; ; ) {
          const step = scaleAbove(size, settings.minFontSize ?? 16);
          if (step > cap + 1e-9 || step > capOf(settings) + FONT_GRID_EPSILON) break;
          proseGrowth.set(node, step);
          const height = need(), measure = proseMeasure(node, inner.width);
          const fit = fitContent(node.field, node.value, contentText(node.field, node.value) ?? '', { ...inner, width: measure.width }, step, floor, node.path, node.payload.numbering);
          const lines = 'richLines' in fit ? (fit as RichTextFit).richLines.length : fit.lines.length;
          if (height > LONE_TARGET * inner.height || fit.overflow || fit.fontSize < step - 1e-9 || lines > MESSAGE_DISPLAY_LINES) break;
          shown = step; best = height; size = step;
        }
        if (shown === undefined) { displayTexts.delete(node.path); if (plain.growth === undefined) proseGrowth.delete(node); else proseGrowth.set(node, plain.growth); best = plain.best; }
        else { proseGrowth.set(node, shown); loneGrowth = true; fire('display-message'); }
      }
      if (badgeLists.has(node.path)) best = need();
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
          // LH-144: growth stops at composition.maxFontSize.
          if (largestPart(layout) > capOf(settings) + FONT_GRID_EPSILON) fits = false;
        }
        if (height > target * inner.height || !fits) break;
        chosen = growth; best = height;
      }
      if (chosen === undefined) growthOf.delete(node); else { growthOf.set(node, chosen); loneGrowth = true; }
    }
    if (fillsPanel()) return wholePanel();
    if (ruled) return spreadCell();
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
  // LH-152: the eyebrow of each placed group, drawn over the items placed in it (`members`) at `size`, in the band of `band` it reserved.
  // `carded`: the group is drawn on one card of its own (LH-131's featured cell or a plain cell card, or the emphasis surface), so its band
  // was left inside that card and the eyebrow goes there, over its blocks' own boxes, on the card's backdrop.
  const groupEyebrows: { members: ComposedItem[]; eyebrow: { path: string; value: unknown }; size: number; band: number; carded?: true }[] = [];
  // LH-152: a group's eyebrow is sized for the first paragraph or list it holds (in reading order), at that block's starting size, or
  // for a paragraph at its role size when it holds none; `band` is its height and EYEBROW_GAP of a gap.
  const groupEyebrow = (node: Pending, width: number): { size: number; band: number } => {
    const proseOf = (nodes: readonly Pending[]): Pending | undefined => { for (const child of nodes) { const found = child.children ? proseOf(child.children) : child.field === 'text' || child.field === 'items' || child.field === 'bullets' ? child : undefined; if (found) return found; } return undefined; };
    const prose = proseOf(node.children ?? []), size = prose ? proseMeasure(prose, width).size : PROSE_NOMINAL_SIZE * scale;
    return { size, band: eyebrowBand(node.eyebrow!, width, size) };
  };
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
  const jointRowBoxes = (units: Pending[], cells: LayoutBox[], rowOf: number[], area: LayoutBox, between: number, settings: Composition, cards: boolean, anchor: RegionAnchor, spread: boolean, compact = false): LayoutBox[] => {
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
      if (needs.reduce((sum, need) => sum + need, 0) <= space + 1e-6) { halfTrial(trial, settings.minFontSize ?? 16); break; }
    }
    const total = needs.reduce((sum, need) => sum + need, 0), spare = Math.max(0, space - total);
    // LH-05: short text cells hug. Rows whose texts need under COMPACT_GRID_FILL of the area (or that LH-48 found under-filled and grows) stay
    // one gap apart and sit in the middle of the area, as growBody's centered body does; spread over the area they left a row of one-line
    // texts at the top and the next two thirds of a body away. Rows that need more keep LH-43's spread, which only trims their slack.
    const hug = compact && ruleOn('compact-grid') && rows > 1 && total <= space + 1e-6 && (bodySteps > 0 || (options as Record<symbol, unknown>)[CENTER] === true || total + between * (rows - 1) < COMPACT_GRID_FILL * area.height);
    if (hug) { fire('compact-grid'); compactGrid = true; for (const unit of units) contentSized.add(unit); }
    const heights = total > space + 1e-6 ? needs.map(need => need * space / total) : spread && !hug ? needs.map(need => need + spare * need / total) : needs;
    const rowY: number[] = [], shift = spread && !hug ? 0 : anchor === 'middle' || hug ? spare / 2 : anchor === 'bottom' ? spare : 0;
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
    if (best) { fire('paragraph-columns'); halfTrial(best.size, settings.minFontSize ?? 16); }
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
      const figures = units.flatMap((unit, index) => unit.field === 'chart' || unit.field === 'image' || unit.field === 'diagram' || unit.field === 'shape' ? [index] : []);
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
      if (fitting !== undefined) { between = fitting; halfTrial(trial, settings.minFontSize ?? 16); break; }
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
  // LH-07: the steps of a `sequence` region. A lone list of a `steps` region whose 3 to 6 entries are one or two words is a flow; any
  // other lone list of two or more entries of one level draws them beside badges; two or more text and list blocks of a `steps` region
  // are steps side by side, a one-entry numbered list giving its number to its badge. Every list of two or more entries of one level in a
  // `numbered` region (an agenda, ordered by nature: it runs in time) draws beside badges, numbered or not; the unnumbered lists of the
  // region count on from one list to the next in reading order (badgeStarts), as one agenda. Those numbers are drawing only: the payload
  // keeps no numbering, and its badges name no list number (ComposedStepBadge.list), so an export gives the list back as written.
  const markSteps = (sequence: 'steps' | 'numbered', units: Pending[]): void => {
    const leaf = (unit: Pending) => !unit.children && unit.caption === undefined, isList = (unit: Pending) => unit.field === 'items' || unit.field === 'bullets';
    const entries = (unit: Pending): unknown[] => Array.isArray(unit.value) ? unit.value : [];
    const flat = (unit: Pending) => entries(unit).every(entry => (record(entry).level ?? 0) === 0), numbered = (unit: Pending) => unit.payload.numbering !== undefined;
    // LH-14: an icon list keeps its chips: it is no badge list or flow.
    const badgeList = (unit: Pending) => leaf(unit) && isList(unit) && flat(unit) && entries(unit).length >= 2 && !(unit.field === 'items' && iconList(unit.value, unit.payload.numbering));
    if (sequence === 'numbered') {
      // The count runs over the whole agenda: when one of its lists cannot take badges (a lone entry, nested entries), the unnumbered
      // ones keep their markers rather than number a part of it.
      const whole = units.every(unit => !isList(unit) || badgeList(unit));
      // LH-134: an agenda whose entries all have a description draws as numbered ruled rows, each description in a second column; one
      // entry without a description anywhere in the region keeps every list's badges, so the agenda is drawn one way.
      const marked = units.filter(unit => badgeList(unit) && (whole || numbered(unit)));
      const rows = ruleOn('numerals') && marked.length > 0 && marked.every(unit => entries(unit).every(entry => record(entry).description !== undefined));
      let next = 1;
      for (const unit of marked) {
        badgeLists.add(unit.path);
        if (rows) { numeralLists.set(unit.path, 'row'); fire('numerals'); }
        if (!numbered(unit)) { badgeStarts.set(unit.path, next); next += entries(unit).length; }
        fire('step-badges');
      }
      let start = 1;
      for (const unit of units) if (leaf(unit) && unit.field === 'items' && flat(unit) && entries(unit).length >= 2 && iconList(unit.value, unit.payload.numbering)) { iconAgendas.set(unit.path, start); start += entries(unit).length; }
      return;
    }
    if (units.length === 1 && badgeList(units[0]!)) {
      const unit = units[0]!, values = entries(unit);
      const short = values.length >= STEP_FLOW_MIN && values.length <= STEP_FLOW_MAX && values.every(value => {
        const object = record(value), text = flatten(typeof value === 'object' && !Array.isArray(value) ? object.text : value).trim();
        return object.description === undefined && text.length > 0 && text.length <= STEP_FLOW_CHARACTERS && text.split(/\s+/u).length <= 2;
      });
      (short ? stepFlows : badgeLists).add(unit.path);
      fire('step-badges');
      return;
    }
    if (units.length < 2 || !units.every(unit => leaf(unit) && (unit.field === 'text' || isList(unit))) || units.some(unit => unit.field === 'items' && iconList(unit.value, unit.payload.numbering))) return;
    for (const unit of units) { stepUnits.add(unit); stepPaths.add(unit.path); if (isList(unit) && numbered(unit) && entries(unit).length === 1) stepHeadings.add(unit.path); }
    fire('step-badges');
  };
  // LH-133: a region whose two or more blocks are each one question with its answer (a one-entry list whose entry is a question with a
  // description: a FAQ written one block per question) draws them as ruled rows (the guarded rule `pair-rows`), one under another across
  // the region, each question in a column beside its answer (LIST_ROWS_LABEL_SHARE of the width, shared by every block: pairRowLabels) and a
  // hairline in the middle of the gap between two blocks (pairRules). PAIR_GRID_MIN or more short ones (a question of at most
  // PAIR_GRID_QUESTION characters and an answer of at most PAIR_GRID_ANSWER), and questions whose rows the guard refused, stay the grid
  // the region draws, each cell under an accent rule (pairGrid): a rule sits in the gap above its cell and changes no size.
  const markPairs = (units: Pending[]): void => {
    const one = (unit: Pending) => !unit.children && unit.caption === undefined && (unit.field === 'items' || unit.field === 'bullets') && unit.payload.numbering === undefined && Array.isArray(unit.value) && unit.value.length === 1 ? record(unit.value[0]) : undefined;
    if (units.length < 2 || !units.every(unit => { const entry = one(unit); return entry !== undefined && pairEntry(entry) === 'question'; })) return;
    const short = units.length >= PAIR_GRID_MIN && units.every(unit => { const entry = one(unit)!; return textLength(entry.text) <= PAIR_GRID_QUESTION && textLength(entry.description) <= PAIR_GRID_ANSWER; });
    if (short || !ruleOn('pair-rows')) { for (const unit of units) pairGrid.add(unit.path); return; }
    fire('pair-rows');
    const labels = units.map(unit => one(unit)!.text as ListText);
    for (const unit of units) pairRowLabels.set(unit.path, labels);
  };
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
      if (region.sequence && ruleOn('step-badges')) markSteps(region.sequence, units);
      else if (!region.sequence) markPairs(units);
    }
    // LH-134 and LH-133: the slide's lone body block (one block in one region, nothing below the grid). A numbered list of 2 to
    // NUMERAL_TAKEAWAYS first-level entries outside a `sequence` region (a few takeaways) draws its numbers as display numerals beside ruled
    // rows; a list of two or more terms with their definitions, most of them one word ("ARR", "Churn"; a glossary, not a list of features
    // named in two words), draws its terms in the accent.
    const body = plan.regions.flatMap(region => (contents.get(region.name) ?? []).filter(unit => !headings.has(unit.field)).map(unit => ({ unit, region })));
    if (body.length === 1 && !binding.belowUnits.length) {
      const { unit, region } = body[0]!, values: unknown[] = Array.isArray(unit.value) ? unit.value : [];
      const list = !unit.children && unit.caption === undefined && (unit.field === 'items' || unit.field === 'bullets') && !badgeLists.has(unit.path) && !stepFlows.has(unit.path);
      if (list && !region.sequence && !region.arrangement && ruleOn('numerals') && unit.payload.numbering !== undefined && values.length >= 2 && values.length <= NUMERAL_TAKEAWAYS && values.every(entry => (record(entry).level ?? 0) === 0)) {
        badgeLists.add(unit.path); numeralLists.set(unit.path, 'display'); fire('numerals');
      }
      if (list && !region.arrangement && values.length >= 2 && values.every(entry => pairEntry(entry) === 'term') && 2 * values.filter(entry => flatten(record(entry).text).trim().split(/\s+/u).length === 1).length > values.length) termLists.add(unit.path);
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
    // LH-129: a stacked record's body grows with the slide (growTemplate, GROW): its paragraphs and lists by the type scale's steps
    // (proseMeasure) and its quotes by the scale's ratio on every role, each up to its display size (LONE_DISPLAY_SIZES).
    if (plan.stack !== undefined && bodySteps) for (const unit of bodyUnits) if (!unit.children && unit.field === 'quote') growthOf.set(unit, TYPE_SCALE_RATIO ** bodySteps);
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
    // LH-129: no primary or secondary region holds a block and nothing sits below the grid, so the headings are the slide's message.
    // LH-130: only then does the title take the rule its region asks for: a display title's mark, which never costs a body its room.
    const headingsAlone = () => plan.regions.every(region => (region.role !== 'primary' && region.role !== 'secondary') || !unitsOf(region.name).length) && !belowUnits.length;
    // Wave 7 integration (LH-09 with LH-155): the empty layout a PowerPoint master holds (LAYOUT_MASTER) has no blocks, so its headings are
    // always alone; a record with a primary or secondary region (the statement) is laid out there as the filled slide draws it, without the rule
    // (a statement's placeholders then sit where its slides put the message). A cover, a section and a closing keep it.
    const masterRule = (options as Record<symbol, unknown>)[LAYOUT_MASTER] === true ? !plan.regions.some(region => region.role === 'primary' || region.role === 'secondary') : undefined;
    const headingItemsAt = (fields: string[], x: number, y: number, areaWidth: number): ComposedItem[] => headingGroup(fields, x, y, areaWidth, fields.includes('title') ? titleMode : undefined, plan.titleRule === true && (masterRule ?? (headingsAlone() || statement === 'title')) && ruleOn('title-rule'));
    const groupHeight = (list: ComposedItem[]) => list.length ? list.at(-1)!.box.y + list.at(-1)!.box.height - (groupRules.get(list)?.y ?? list[0]!.box.y) : 0;
    // The arrangement of a region's blocks: design.contentDirection makes every flowing region one row or one column;
    // otherwise the region's flow (`auto` is a grid unless a block is long; `none` with extra blocks flows as `auto`).
    const arrangementOf = (region: LayoutRegion, units: Pending[], cell: LayoutBox): 'grid' | 'row' | 'column' => {
      if (region.name === longTextRegion) return 'column';
      // LH-135: pricing tiers are compared side by side, in one row of equal cards.
      if (units.length > 1 && units.every(unit => tierGroups.has(unit.path))) return 'row';
      // LH-132: a team's portrait cards: up to PORTRAIT_TOP_MAX across the top in one row, otherwise a grid.
      if (units.length && units.every(unit => personParts.has(unit.path))) return portraitMode === 'top' && units.length <= PORTRAIT_TOP_MAX ? 'row' : 'grid';
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
      // LH-133: one-question blocks drawn as ruled rows are one column.
      if (units.every(unit => pairRowLabels.has(unit.path))) return listGridShape(units.length, 1);
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
    // LH-132: a team's short last row keeps its cards at one width, so every portrait has one size.
    const stretchesLastRow = (units: Pending[]) => !units.every(unit => !unit.children && (unit.field === 'image' || unit.field === 'video')) && !units.every(unit => personParts.has(unit.path));
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
        if ([...joint].every(name => regionNeed(name, spanWidth(rects.get(name)!), false, trial) <= room(rects.get(name)!) + 1e-6)) { heights = tracks; halfTrial(trial, composition.minFontSize ?? 16); break; }
      }
    }
    const rowY: number[] = [];
    // A row with no height sits at the end of the row above it, not after its gap.
    heights.reduce((y, size, row) => { rowY.push(size > 0 || !heights.slice(0, row).some(above => above > 0) ? y : y - gap); return size > 0 ? y + size + gap : y; }, 0);
    // A column of auto rows with an anchor (`template.stack`): the whole stack, headings included, sits in the leftover height.
    const stackUsed = heights.reduce((sum, size) => sum + size, 0) + gap * Math.max(0, heights.filter(size => size > 0).length - 1);
    let stackShift = plan.stack === undefined ? 0 : Math.max(0, frame.height - stackUsed) * (plan.stack === 'middle' ? .5 : 1);
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
    // LH-158 (wave 6's calm-band rule widened): a heading group in a sized area (a cover's, a section's) over a picture background goes
    // where the picture lets it read. Its candidates are the top, middle and bottom of the area, each at the layout's side alignment or
    // centered (the title area only), across the area or, for a title area across the slide, in a narrower column (PICTURE_TEXT_COLUMNS)
    // where the group keeps its sizes; and, for such a title area holding the slide's only text, a panel: the group in a
    // start-side column of PICTURE_PANEL_SHARES of the slide width on the slide's background color, the picture bleeding on the rest, taken
    // only where the group keeps its sizes. Each is scored on the host's measured grid (`pictureLuminance`, with its `busy` and `salient`
    // weights) under the group's ink and the scrim's margin around it, seen through the author's overlay (picture-text.ts: scorePictureText, choosePictureText): the
    // layout's own placement when it reads, else the best that reads, else the one the automatic scrim carries with the least opacity,
    // else the panel. The background's `textPlacement` picks one outright; an `overlay` key leaves no scrim and no panel. Without a
    // measurement a low group is centered, as wave 6 did (an estimated run cannot know the picture).
    // LH-158: what the picture-text scores read (scorePictureText): the host's grid of the background picture, the picture's box, the text
    // color, the automatic scrim's color (none under an `overlay` key), the author's overlay (a literal color, each gray seen through it) and
    // the scrim's margin; undefined when the picture is not measured (an estimated run), recolored or faded, or a color is not literal.
    const pictureInput = (background: ComposedBackgroundImage, keyed: boolean): Omit<PictureTextInput, 'places' | 'panel'> | undefined => {
      const grid = !background.recolor && !(background.opacity !== undefined && background.opacity < 1) ? options.pictureLuminance?.(background.src) : undefined;
      const roles = options.roles ?? resolveColorRoles({}, { tone: options.darkBackground ? 'dark' : 'light' });
      const hex = (value: unknown) => typeof value === 'string' && /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value) ? value.slice(0, 7) : undefined;
      const picture = background.picture?.image ?? { x: 0, y: 0, width, height }, text = hex(roles.text), base = hex(roles.background);
      if (!grid || !text || !base || !(picture.width > 0 && picture.height > 0)) return undefined;
      const overlay = background.overlay, tint = hex(overlay?.color), raw = typeof overlay?.color === 'string' ? overlay.color : '';
      const alpha = tint && overlay ? Math.max(0, Math.min(1, overlay.opacity * (raw.length === 9 ? Number.parseInt(raw.slice(7), 16) / 255 : 1))) : 0;
      return { grid, picture, text, ...(keyed ? {} : { scrim: base }), ...(tint ? { overlay: { color: tint, alpha } } : {}), margin: SCRIM_MARGIN * scale };
    };
    const onPicture = (name: 'title' | 'subtitle', fields: string[], cell: LayoutBox, authored: RegionAnchor): { list: ComposedItem[]; anchor: RegionAnchor; cell: LayoutBox } => {
      const background = backgroundImage!, own = alignmentFor(fields.includes('title') ? 'title' : fields[0]!), titled = name === 'title' && fields.includes('title');
      const preferred: PictureTextAlignment = own === 'center' ? 'center' : 'start', side = own === 'center' ? 'left' : own, left = !flip;
      // A trial composition of the group leaves no trace: its alignment and its off-scale flag (LH-129) are restored.
      type Variant = { alignment: PictureTextAlignment; cell: LayoutBox; list: ComposedItem[]; offScale: boolean };
      const trial = (alignment: PictureTextAlignment, x: number, areaWidth: number): Variant => {
        const before = headingOffScale, kept = headingAlignment;
        headingOffScale = false; headingAlignment = alignment === preferred ? undefined : alignment === 'center' ? 'center' : side;
        try { const list = headingItemsAt(fields, x, cell.y, areaWidth); return { alignment, cell: { ...cell, x, width: areaWidth }, list, offScale: headingOffScale }; } finally { headingOffScale = before; headingAlignment = kept; }
      };
      // A narrower column is a variant only where the group keeps every size it has across the area and still fits its height.
      const keepsSizes = (narrow: ComposedItem[], across: ComposedItem[]) => narrow.length === across.length && groupHeight(narrow) <= cell.height + .01
        && narrow.every((item, index) => (item.text?.fontSize ?? 0) >= (across[index]!.text?.fontSize ?? 0) - FONT_GRID_EPSILON);
      const wide = titled && cell.width >= .75 * frame.width;
      const variants: Variant[] = [];
      for (const alignment of titled ? [preferred, preferred === 'center' ? 'start' as const : 'center' as const] : [preferred]) {
        const across = trial(alignment, cell.x, cell.width);
        variants.push(across);
        if (wide) for (const share of PICTURE_TEXT_COLUMNS) {
          const columnWidth = share * width - 2 * padding;
          if (columnWidth <= 0 || columnWidth >= cell.width - 1) continue;
          const narrow = trial(alignment, alignment === 'center' ? cell.x + (cell.width - columnWidth) / 2 : left ? cell.x : cell.x + cell.width - columnWidth, columnWidth);
          if (keepsSizes(narrow.list, across.list)) variants.push(narrow);
        }
      }
      const full = variants[0]!, keyed = OVERLAY_KEYED.has(background), explicit = titled ? background.textPlacement : undefined;
      const input = pictureInput(background, keyed);
      // The panel stands on the physical start side (mirrored in a right-to-left deck): the group start-aligned in its text column.
      let panel: Variant & { box: LayoutBox; edge: ScrimEdge } | undefined;
      if (wide && !keyed && (input || explicit === 'panel') && headingsAlone()) for (const share of PICTURE_PANEL_SHARES) {
        const column = share * width, textWidth = column - 2 * padding;
        if (textWidth <= 0) break;
        const placed = trial('start', left ? cell.x : cell.x + cell.width - textWidth, textWidth);
        if (keepsSizes(placed.list, full.list)) { panel = { ...placed, box: { x: left ? 0 : width - column, y: 0, width: column, height }, edge: left ? 'left' : 'right' }; break; }
      }
      const factor = { top: 0, middle: .5, bottom: 1 } as const, anchors: PictureTextAnchor[] = ['top', 'middle', 'bottom'];
      const roomOf = (list: ComposedItem[]) => Math.max(0, cell.height - groupHeight(list));
      let candidates: PictureTextCandidate[] | undefined;
      if (input) {
        const inkOf = (list: ComposedItem[], shift: number): ScrimBox => {
          // textInkBox reads the alignment as physical; a right-to-left paragraph's start is its right edge, so its ink is mirrored in the box.
          const boxes = list.filter(item => item.text).map(item => {
            const ink = textInkBox(item, options.textMeasurement), side = physicalAlignment(item.alignment, paragraphDirection(annotationText(item.value), deckDirection));
            const x = side === item.alignment || side === 'center' ? ink.x : item.box.x + item.box.width - (ink.x - item.box.x) - ink.width;
            return { ...ink, x, y: ink.y + shift };
          });
          const x = Math.min(...boxes.map(box => box.x)), y = Math.min(...boxes.map(box => box.y));
          return { x, y, width: Math.max(...boxes.map(box => box.x + box.width)) - x, height: Math.max(...boxes.map(box => box.y + box.height)) - y };
        };
        const places = variants.flatMap(({ alignment, cell: area, list }) => list.some(item => item.text) ? anchors.map(anchor => ({ anchor, alignment, measure: area.width, box: inkOf(list, roomOf(list) * factor[anchor]) })) : []);
        if (places.length) candidates = scorePictureText({ ...input, places, ...(panel ? { panel: { box: panel.box, measure: panel.cell.width } } : {}) });
      }
      const order = [...new Set<PictureTextAnchor>([authored, 'middle', ...anchors])];
      let choice: { placement: PictureTextPlacement; anchor: PictureTextAnchor; alignment: PictureTextAlignment; scrim: boolean; measure?: number } | undefined;
      if (explicit && (explicit !== 'panel' || panel)) {
        const [anchor, alignment] = explicit === 'panel' ? [authored, 'start' as const] : explicit.split('-') as [PictureTextAnchor, PictureTextAlignment];
        const scored = candidates?.find(candidate => candidate.placement === explicit);
        choice = { placement: explicit, anchor, alignment, scrim: !keyed && explicit !== 'panel' && !!scored && !scored.reads && (scored.scrim ?? 0) > 0, ...(scored ? { measure: scored.measure } : {}) };
      } else if (candidates) {
        const pick = choosePictureText(candidates, { anchor: authored, alignment: preferred }, order);
        if (pick) choice = pick.candidate.placement === 'panel' ? { placement: 'panel', anchor: authored, alignment: 'start', scrim: false } : { placement: pick.candidate.placement, anchor: pick.candidate.anchor, alignment: pick.candidate.alignment, scrim: pick.scrim, measure: pick.candidate.measure };
      }
      const drawn = choice?.placement === 'panel' ? panel : choice && (variants.find(variant => variant.alignment === choice.alignment && choice.measure !== undefined && Math.abs(variant.cell.width - choice.measure) < .01) ?? variants.find(variant => variant.alignment === choice.alignment));
      if (!choice || !drawn) {
        if (full.offScale) headingOffScale = true;
        return { list: full.list, anchor: authored === 'bottom' ? 'middle' : authored, cell };
      }
      if (drawn.offScale) headingOffScale = true;
      if (titled) pictureText = {
        placement: choice.placement, anchor: choice.anchor, alignment: choice.alignment, source: explicit === choice.placement ? 'authored' : 'measured',
        ...(choice.scrim ? { scrim: true as const } : {}), ...(panel && choice.placement === 'panel' ? { panel: { box: roundBox(panel.box), edge: panel.edge } } : {}), candidates: candidates ?? [],
      };
      return { list: drawn.list, anchor: choice.anchor, cell: drawn.cell };
    };
    // LH-155 with LH-158: a stack anchored low (the closing: its title, rule and contact lines) is one group over a picture background, and
    // goes where the picture lets it read by the same scores as a cover's heading group: at the top, middle or foot of the content box. The
    // stack is first placed at the foot; its text's ink is then scored there and at the middle and top (stackPlace, after composing), and a
    // stack that reads better elsewhere is composed again there (STACK_PLACE). It keeps its alignment and has no panel (the stack holds more
    // than headings); the background's `textPlacement` picks the anchor outright. Unmeasured, a low stack is centered, as wave 6 centered a
    // low heading group.
    if (plan.stack === 'bottom' && backgroundImage && stackShift > 0) {
      const background = backgroundImage, keyed = OVERLAY_KEYED.has(background), input = pictureInput(background, keyed), room = stackShift;
      const alignment: PictureTextAlignment = alignmentFor('title') === 'center' ? 'center' : 'start', factor = { top: 0, middle: .5, bottom: 1 } as const;
      const explicit = background.textPlacement && background.textPlacement !== 'panel' ? background.textPlacement.split('-')[0] as PictureTextAnchor : undefined;
      const forced = (options as Record<symbol, unknown>)[STACK_PLACE] as { anchor: PictureTextAnchor; pictureText: PictureText } | undefined;
      if (forced) { stackShift = room * factor[forced.anchor]; pictureText = forced.pictureText; }
      else if (input) stackPlace = { room, alignment, input, keyed, ...(explicit ? { explicit } : {}) };
      else {
        const anchor = explicit ?? 'middle';
        stackShift = room * factor[anchor];
        if (explicit) pictureText = { placement: `${anchor}-${alignment}`, anchor, alignment, source: background.textPlacement === `${anchor}-${alignment}` ? 'authored' : 'measured', candidates: [] };
      }
    }
    // Headings: centered vertically in their area unless every row the area spans is auto. LH-130: a heading region's own anchor
    // places the group in a sized area (`bottom` sets a cover's or section's display title low, as Claude Design does).
    const placeHeadings =(name: 'title' | 'subtitle', fields: string[]) => {
      const rect = rects.get(name), original = ownRects.get(name);
      if (!rect) { if (original) headingAreas.push({ name, box: roundBox(physical(logical(original))), collapsed: true }); return; }
      const sized = !rowSizes.slice(rect.row, rect.row + rect.rowSpan).every(size => size === 'auto'), authored = plan.headingAnchors?.[name] ?? 'middle';
      // LH-158: over a picture background the group goes where the picture lets it read (onPicture).
      const area = physical(logical(rect)), placed = sized && backgroundImage ? onPicture(name, fields, area, authored) : undefined;
      const cell = placed?.cell ?? area, list = placed?.list ?? headingItemsAt(fields, cell.x, cell.y, cell.width), anchor = placed?.anchor ?? authored;
      const room = Math.max(0, cell.height - groupHeight(list));
      const shift = sized ? room * (anchor === 'bottom' ? 1 : anchor === 'middle' ? .5 : 0) : 0;
      // LH-129: a title that stands free (in a sized area, or in a stack) over no primary or secondary block is the slide's message.
      if (name === 'title' && list.some(item => item.field === 'title') && (sized || plan.stack !== undefined) && (headingsAlone() || statement === 'title')) headingMessage = true;
      const rule = groupRules.get(list);
      if (rule) titleRule = { path: `${path}.title`, box: roundBox({ ...rule, y: rule.y + shift }) };
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
        // LH-136: a region of pillars drawn as display words has no cards.
        // LH-169: a row of figures is drawn as Claude Design draws a metric row, on no card (its accent rules head the figures).
        const cards = hasCards && !region.bleed && !(units.length > 0 && units.every(unit => pillarWords.has(unit.path) || (!unit.children && figureRowOf(unit.field, unit.value, unit.payload, unit.caption))));
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
      // SH-18 review: a region with an arrangement keeps its whole cell under LH-48's centering, which its diagram fills (arrangedLists, arrangedBlocks).
      let cell = rect && !region.bleed ? (region.arrangement ? physical(logical(rect)) : regionCell(rect)) : physical(logical(rect ?? ownRects.get(region.name)!));
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
    // LH-78: every quote card of the slide draws its mark (markQuote) or none does: the cards of a row read alike. The mark is drawn
    // in the card's padding, so no card takes a size from its quote.
    const carded = [...quoteHugs].filter(index => items[index]!.quoteLayout && items[index]!.frameBox && !items[index]!.quoteLayout!.overflow);
    const marked = carded.map(index => markQuote(items[index]!.quoteLayout!, items[index]!.frameBox!, { scale, fontFamilies: options.fontFamilies, textMeasurement: options.textMeasurement, direction: textDirection, ...(deckLanguage() !== undefined ? { language: deckLanguage()! } : {}), path: items[index]!.path, ...(citationMarker ? { citationMarker } : {}) }));
    if (carded.length && marked.every(layout => layout.mark)) carded.forEach((index, at) => { const item = items[index]!; item.quoteLayout = marked[at]!; item.text = marked[at]!.parts.find(part => part.role === 'body')?.fit ?? item.text; });
    for (const index of quoteHugs) {
      const item = items[index]!, layout = item.quoteLayout, frame = item.frameBox;
      if (!layout || !frame || layout.overflow) continue;
      const bottom = Math.max(layout.bounds.y + layout.bounds.height, ...layout.parts.map(part => part.box.y + part.box.height), ...(layout.photo ? [layout.photo.box.y + layout.photo.box.height] : []));
      item.frameBox = acceptedBox({ ...frame, height: Math.min(frame.height, bottom - frame.y + (item.box.y - frame.y)) });
    }
  };
  // LH-135: the prices of the tiers that reach their role size read at one size, the smallest of them (a word that fits only below it,
  // "Custom", keeps its own). The tiers' other blocks stay as they are: they are no peers of the tiers' prices.
  const shareTierPrices = (): void => {
    const priceOf = (index: number) => items[index]!.metricLayout?.parts.find(part => part.role === 'value');
    const alike = tierPrices.filter(index => (priceOf(index)?.fit?.fontSize ?? 0) >= METRIC_ROLE_VALUE_SIZE * scale - FONT_GRID_EPSILON);
    if (alike.length < 2) return;
    const size = Math.min(...alike.map(index => priceOf(index)!.fit!.fontSize));
    for (const index of alike) {
      if (priceOf(index)!.fit!.fontSize <= size + 1e-9) continue;
      const item = items[index]!, refit = metricRefits.get(index)?.({ value: size });
      const value = refit?.parts.find(part => part.role === 'value');
      if (!refit || refit.overflow || !value?.fit || Math.abs(value.fit.fontSize - size) > 1e-9) continue;
      item.metricLayout = refit;
      item.text = value.fit;
    }
  };
  // LH-136: sibling pillars read their display words at one size, the smallest any of them fitted at (a long word steps down to its one line);
  // each description keeps its own fit, so no size the guard holds falls.
  const shareWords = (): void => {
    const words = items.filter(item => pillarWords.has(item.path) && item.text !== undefined && 'listEntries' in item.text);
    const sizeOf = (item: ComposedItem) => (item.text as ListFit).listEntries[0]?.text.fontSize ?? Infinity;
    if (words.length < 2) return;
    const size = Math.min(...words.map(sizeOf));
    for (const item of words) {
      if (sizeOf(item) <= size + 1e-9) continue;
      wordCaps.set(item.path, size);
      const fit = item.text!, refit = fitContent(item.field, item.value, contentText(item.field, item.value) ?? '', item.box, fit.fontSize, fit.fontSize, item.path, item.payload.numbering, item.alignment);
      if (!refit.overflow && Math.abs(refit.fontSize - fit.fontSize) < 1e-9) item.text = refit; else wordCaps.delete(item.path);
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
      if (!refit.overflow && Math.abs(refit.fontSize - step) < 1e-9) { item.text = refit; halfTrial(step, floorPx); }
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
          // LH-137 with LH-53, LH-157: a metric with an inline unit takes the shared sizes too, its unit (a share of its value's size) following
          // its value rather than the shared unit, so siblings keep one value size (a pill that let it grow is held to the slide by the drawing guard).
          // A value at display size (LH-112) keeps its own, as it does without a pill.
          const follows = (part: MetricTextPart) => part.role === 'unit' && refit.arrangement === 'inline-unit' && !refit.display;
          if (refit.overflow || refit.parts.some(part => part.visible && !follows(part) && (!part.fit || Math.abs(part.fit.fontSize - sizes[part.role]!) > 1e-9))) continue;
          item.metricLayout = refit;
          item.text = refit.parts.find(part => part.role === 'value')?.fit;
        }
        // LH-137: sibling metrics draw their delta pills one way: when one has its pill above its value, a sibling with its pill beside
        // takes it above too, where every field keeps its size (else it keeps the pill beside).
        if (members.some(index => items[index]!.metricLayout!.deltaPill?.placement === 'above')) for (const index of members) {
          const item = items[index]!, layout = item.metricLayout!;
          if (layout.deltaPill?.placement !== 'beside') continue;
          const own = new Map(layout.parts.filter(part => part.visible && part.fit).map(part => [part.role, part.fit!.fontSize] as const));
          const refit = metricRefits.get(index)!(Object.fromEntries(own), 'above');
          if (refit.overflow || refit.deltaPill?.placement !== 'above' || refit.parts.some(part => part.visible && (!part.fit || part.fit.fontSize < (own.get(part.role) ?? 0) - 1e-9))) continue;
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
  // LH-144: `composition.maxFontSize` caps the body. No block grows past it (fillLone, placeTimeline), and a block composed larger is
  // laid out again in its own box at the cap, where it was placed: a paragraph or list, a quote's body, each metric part, and every
  // timeline role offset until its largest label fits under it; a list in columns keeps the columns its role size chose and sets them
  // at the cap (listColumnsFor). The arrangement is the one the slide has without the cap, so a page of a paginated slide is arranged
  // as the first page is (starting a list at the cap would set one page in one column and the next in three). Never under the
  // readability floor (capOf). `paginate` writes the cap on the pages after the first, so the pages of one slide share its sizes (a
  // last page with a lone timeline no longer reads larger than the pages before it). Tables, code and charts keep their sizes.
  const capSizes = (): void => {
    items.forEach((item, index) => {
      if (headings.has(item.field) || item.eyebrow) return;
      const cap = capOf(item.composition);
      if (cap === Infinity) return;
      if (item.quoteLayout) {
        const body = item.quoteLayout.parts.find(part => part.role === 'body')?.fit;
        const refit = body && body.fontSize > cap + FONT_GRID_EPSILON ? quoteRefits.get(index)?.(cap) : undefined;
        if (refit && !refit.overflow) { item.quoteLayout = refit; item.text = refit.parts.find(part => part.role === 'body')?.fit; }
      } else if (item.metricLayout) {
        if (largestPart(item.metricLayout) <= cap + FONT_GRID_EPSILON) return;
        const sizes: Partial<Record<MetricTextRole, number>> = {};
        for (const part of item.metricLayout.parts) if (part.visible && part.fit) sizes[part.role] = Math.min(part.fit.fontSize, cap);
        const refit = metricRefits.get(index)?.(sizes);
        if (refit && !refit.overflow) { item.metricLayout = refit; item.text = refit.parts.find(part => part.role === 'value')?.fit; }
      } else if (item.timelineLayout) {
        if (largestPart(item.timelineLayout) <= cap + FONT_GRID_EPSILON) return;
        const refit = timelineRefits.get(index);
        for (let offset = TIMELINE_STEP_GROWTH[0]; refit && offset >= -TIMELINE_FLOOR_OFFSET; offset--) {
          const layout = refit(offset);
          if (!layout.overflow && largestPart(layout) <= cap + FONT_GRID_EPSILON) { item.timelineLayout = layout; break; }
          if (largestPart(layout) <= snapFontSizeUp((item.composition.minFontSize ?? 16) * scale) + FONT_GRID_EPSILON) break;
        }
      } else if (item.text && !item.codeLayout && !item.listColumns && (item.field === 'text' || item.field === 'items' || item.field === 'bullets') && item.text.fontSize > cap + FONT_GRID_EPSILON) {
        const floor = snapFontSizeUp((item.composition.minFontSize ?? 16) * scale);
        const refit = fitContent(item.field, item.value, contentText(item.field, item.value) ?? '', item.box, cap, floor, item.path, item.payload.numbering, item.alignment);
        if (!refit.overflow) item.text = refit;
      }
    });
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
  // LH-18: sibling heading lists (pillars, the cells of a grid of questions, cards of a heading over its description: one entry with a
  // description each) in one row share their heading track. The row's headings take the height of its tallest (a heading that wraps to
  // three lines in one pillar leaves two lines of space under a one-line heading beside it), so the descriptions start on one line and
  // read as one row, as Claude Design's pillars do. Text keeps its size: only the description moves down, by the difference. Siblings
  // are the lists whose headings start on one line and sit side by side at one heading size and one description size; a row whose
  // aligned tracks would not fit the room its lists were fitted in stays as it was.
  const alignHeadingTracks = (): void => {
    if (!ruleOn('heading-tracks')) return;
    const entryOf = (item: ComposedItem): ListEntryLayout | undefined => {
      const fit = item.text;
      return item.field === 'items' && fit && 'listEntries' in fit && !item.listColumns && !item.caption && (fit as ListFit).listEntries.length === 1 && !(fit as ListFit).rules?.length ? (fit as ListFit).listEntries[0] : undefined;
    };
    const heads = items.filter(item => { const entry = entryOf(item); return entry?.heading && entry.description && entry.descriptionBox; }).sort((a, b) => entryOf(a)!.textBox.y - entryOf(b)!.textBox.y);
    for (let from = 0; from < heads.length;) {
      let to = from + 1;
      while (to < heads.length && Math.abs(entryOf(heads[to]!)!.textBox.y - entryOf(heads[from]!)!.textBox.y) <= 1) to++;
      const row = heads.slice(from, to).sort((a, b) => a.box.x - b.box.x);
      from = to;
      const one = (pick: (entry: ListEntryLayout) => number) => Math.max(...row.map(item => pick(entryOf(item)!))) - Math.min(...row.map(item => pick(entryOf(item)!))) <= .5;
      if (row.length < 2 || !one(entry => entry.text.fontSize) || !one(entry => entry.description!.fontSize) || row.some((item, index) => index && item.box.x < row[index - 1]!.box.x + row[index - 1]!.box.width - 1e-6)) continue;
      const track = Math.max(...row.map(item => entryOf(item)!.textBox.height)), moves = row.map(item => track - entryOf(item)!.textBox.height);
      if (!moves.some(move => move > .5)) continue;
      // The tallest heading's track must leave every list inside the room it was fitted in (its cell; a card's inside, minus its inset).
      const room = (item: ComposedItem) => Math.max(item.box.y + item.box.height, item.frameBox ? item.frameBox.y + item.frameBox.height - cardInsetOf(item.frameBox.width, true) : -Infinity);
      if (row.some((item, index) => entryOf(item)!.textBox.y + (item.text as ListFit).height + moves[index]! > room(item) + .01)) continue;
      row.forEach((item, index) => {
        const fit = item.text as ListFit, entry = entryOf(item)!, move = moves[index]!;
        if (move <= .01) return;
        item.text = { ...fit, height: fit.height + move, listEntries: [{ ...entry, descriptionBox: { ...entry.descriptionBox!, y: entry.descriptionBox!.y + move } }] };
      });
      fire('heading-tracks');
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
  // LH-75: a table and its note side by side (tableNote): the table's share of the width, the note on one plain card as tall as the row.
  const noteSplit = (options as Record<symbol, unknown>)[TABLE_NOTE] as { share: number } | undefined;
  const tableNoteNodes = noteSplit && ruleOn('table-note') && !useTemplate && !regions.length && pending.length === 2 && pending.every(node => !node.children && node.caption === undefined && node.emphasis === undefined && !node.eyebrow && !node.region)
    && pending.filter(node => node.field === 'table').length === 1 && pending.filter(node => node.field === 'text').length === 1 ? { table: pending.find(node => node.field === 'table')!, note: pending.find(node => node.field === 'text')! } : undefined;
  if (useTemplate) composeTemplate();
  else if (noteSplit && tableNoteNodes) {
    const { table, note } = tableNoteNodes, span = Math.max(0, contentBox.width - gap), widths = new Map<Pending, number>([[table, span * noteSplit.share], [note, span * (1 - noteSplit.share)]]);
    note.cardCell = true;
    // LH-48's steps: the table's rows grow with its type (growthOf), the note by the same steps of the scale (proseMeasure).
    if (bodySteps) growthOf.set(table, TYPE_SCALE_RATIO ** bodySteps);
    const tableNeed = naturalHeight(table, widths.get(table)!, hasCards, undefined, rootSettings) + 2 * rasterPadding + scale, noteNeed = naturalHeight(note, widths.get(note)!, true, undefined, rootSettings) + 2 * rasterPadding + scale + gap * CARD_FILL_SPACE;
    // The row is as tall as the taller of the two and sits in the middle of the body (LH-52, LH-102); the table in the middle of the row.
    const rowHeight = Math.min(contentBox.height, Math.max(tableNeed, noteNeed)), top = contentBox.y + (contentBox.height - rowHeight) / 2, tableHeight = Math.min(rowHeight, tableNeed);
    let offset = 0;
    for (const node of pending) {
      const cellWidth = widths.get(node)!, x = rtl ? contentBox.x + contentBox.width - offset - cellWidth : contentBox.x + offset;
      offset += cellWidth + gap;
      contentSized.add(node);
      if (node === table) placeNode(node, { x, y: top + (rowHeight - tableHeight) / 2, width: cellWidth, height: tableHeight }, rootSettings);
      else { const first = items.length; placeNode(node, { x, y: top, width: cellWidth, height: rowHeight }, rootSettings, true); centeredCardText.push(...range(first, items.length)); }
    }
    fire('table-note');
  }
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
  // LH-135: the prices of the tiers that reach their role size read at one size (a word that fits only below it, "Custom", keeps its own).
  shareTierPrices();
  shareWords();
  sharePeerSizes();
  capSizes();
  shareStartAlignment();
  hugQuoteCards();
  centerCardText();
  alignHeadingTracks();
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
  // LH-07: what the `sequence` regions draw besides their text (ComposedSteps): the badges composeTemplate's lists already placed
  // (`column`), a badge over each step set side by side (`row`, in the band placeNode left above its text), and the chips of a flow.
  // A badge is STEP_BADGE times its step's text size across with its numeral at that size; it sits STEP_BADGE_GAP of a badge above
  // its text, at the start of its block (the right in a right-to-left deck) or over its middle when the block is centered.
  const stepSequences = (): ComposedSteps[] => {
    const result: ComposedSteps[] = [], lineWidth = 2 * scale;
    const badgeOf = (path: string, cx: number, cy: number, diameter: number, label: string, fontSize: number, list?: ComposedStepBadge['list'], numeral?: LayoutBox): ComposedStepBadge => ({ path, cx, cy, radius: diameter / 2, label, fontSize, baseline: cy + fontSize * .35, ...(list ? { list } : {}), ...(numeral ? { numeral } : {}) });
    const numberOf = (number: ListNumber) => ({ value: number.value, style: number.style, suffix: number.suffix });
    const connector = (badges: ComposedStepBadge[]) => badges.length > 1 ? { connector: { x1: badges[0]!.cx, y1: badges[0]!.cy, x2: badges.at(-1)!.cx, y2: badges.at(-1)!.cy } } : {};
    for (const region of template!.regions) {
      // LH-134: a region without a sequence draws the numerals of its lone list of takeaways (numeralLists).
      const members = items.filter(item => item.region === region.name && !headings.has(item.field)), drawn: LayoutBox[] = [];
      if (!region.sequence && !members.some(item => numeralLists.has(item.path))) continue;
      for (const item of members) {
        if (stepFlows.has(item.path)) { const flow = stepFlow(item, region.name, lineWidth); if (flow) { result.push(flow); drawn.push(item.box); } continue; }
        const fits = item.listColumns?.length ? item.listColumns.map(column => column.text) : item.text && 'listEntries' in item.text ? [item.text as ListFit] : [];
        for (const fit of fits) {
          const badges = fit.listEntries.flatMap(entry => entry.badge ? [badgeOf(entry.textPath ?? item.path, entry.badge.cx, entry.badge.cy, entry.badge.diameter, entry.badge.label, entry.badge.fontSize, entry.marker.number && item.payload.numbering !== undefined ? { path: item.path, index: entry.index, number: numberOf(entry.marker.number) } : undefined, entry.badge.numeral)] : []);
          // LH-134: numerals beside ruled rows are joined by the rows' hairlines, not by a connector.
          if (badges.length) result.push({ form: 'column', region: region.name, path: item.path, badges, ...(badges.some(badge => badge.numeral) ? {} : connector(badges)), lineWidth });
        }
      }
      const stepped = members.filter(item => stepPaths.has(item.path) && item.text && !item.listColumns);
      if (stepped.length >= 2 && stepped.length === members.length) {
        // Rows: steps whose boxes overlap vertically; each row's badges share one line.
        const rows: ComposedItem[][] = [];
        for (const item of [...stepped].sort((a, b) => a.box.y - b.box.y)) {
          const row = rows.find(entry => entry.some(other => item.box.y < other.box.y + other.box.height && other.box.y < item.box.y + item.box.height));
          if (row) row.push(item); else rows.push([item]);
        }
        const position = new Map(stepped.map((item, index) => [item, index]));
        const top = (item: ComposedItem) => (item.text as ListFit).listEntries?.[0]?.textBox.y ?? item.text!.placement?.lines[0]?.y ?? item.box.y;
        for (const row of rows) {
          const size = Math.max(...row.map(item => item.text!.fontSize)), diameter = STEP_BADGE * size, cy = Math.min(...row.map(top)) - diameter * STEP_BADGE_GAP - diameter / 2;
          const badges = row.map(item => {
            const side = item.alignment === 'center' ? 'center' : rtl ? (item.alignment === 'left' ? 'right' : 'left') : item.alignment;
            const cx = side === 'center' ? item.box.x + item.box.width / 2 : side === 'right' ? item.box.x + item.box.width - diameter / 2 : item.box.x + diameter / 2;
            const own = stepHeadings.has(item.path) ? listNumbers(item.value as unknown[], item.payload.numbering as NumberingInput)[0] : undefined;
            return badgeOf(item.path.replace(/\.(text|items|bullets)$/, ''), cx, cy, diameter, own ? listNumberLabel(own) : String(position.get(item)! + 1), size, own ? { path: item.path, index: 0, number: numberOf(own) } : undefined);
          }).sort((a, b) => rtl ? b.cx - a.cx : a.cx - b.cx);
          result.push({ form: 'row', region: region.name, path: badges[0]!.path, badges, ...connector(badges), lineWidth });
        }
      }
      // The region's cell holds what it draws.
      const composed = templateRegions.find(entry => entry.name === region.name);
      const extents = [...result.filter(entry => entry.region === region.name).flatMap(entry => entry.badges.map(badge => badge.numeral ?? ({ x: badge.cx - badge.radius, y: badge.cy - badge.radius, width: 2 * badge.radius, height: 2 * badge.radius }))), ...drawn];
      if (composed && extents.length) {
        const box = composed.box, x = Math.min(box.x, ...extents.map(extent => extent.x)), y = Math.min(box.y, ...extents.map(extent => extent.y));
        composed.box = roundBox({ x, y, width: Math.max(box.x + box.width, ...extents.map(extent => extent.x + extent.width)) - x, height: Math.max(box.y + box.height, ...extents.map(extent => extent.y + extent.height)) - y });
      }
    }
    return result;
  };
  // LH-07: a flow: the list's entries in a row of chips, in reading order (from the right in a right-to-left deck), with an arrow
  // between each two. The chips share the region's width when the widest entry fits every chip, else each hugs its entry; the entries
  // keep the list's size, so a flow that does not fit on one line at it is not drawn and the list stays as it was. The row is centered
  // on the list's middle. Each entry is a list column (ComposedItem.listColumns) centered in its chip.
  const stepFlow = (item: ComposedItem, region: string, lineWidth: number): ComposedSteps | undefined => {
    const values = item.value as ListValue[], fit = item.text as ListFit, size = fit.fontSize, area = templateRegions.find(entry => entry.name === region)?.box ?? item.box;
    const listOptions: ListFitOptions = { ...richOptions(styleFor(item.field, item.path)), bullet: 'none' };
    const single = (index: number, box: LayoutBox): ListFit => {
      // The entry is fitted alone (as entry 0), so its runs' citation markers are looked up at its own index.
      const own0 = `${item.path}.0`, ownPath = `${item.path}.${index}`, marker = listOptions.citationMarker;
      const entryOptions: ListFitOptions = marker ? { ...listOptions, citationMarker: (run: string) => marker(run === own0 || run.startsWith(`${own0}.`) ? ownPath + run.slice(own0.length) : run) } : listOptions;
      const own = fitList([values[index]!], box, size, size, entryOptions), object = typeof values[index] === 'object' && !Array.isArray(values[index]);
      return { ...own, listEntries: own.listEntries.map(entry => ({ ...entry, index, textPath: `${item.path}.${index}${object ? '.text' : ''}`, descriptionPath: `${item.path}.${index}.description` })) };
    };
    const measured = values.map((_, index) => single(index, { x: 0, y: 0, width: 1e5, height: 1e5 }).listEntries[0]!);
    if (!fit.listEntries.length || measured.some(entry => entry.text.richLines.length !== 1)) return undefined;
    const widths = measured.map(entry => entry.text.richLines[0]!.width), lineHeight = Math.max(...measured.map(entry => entry.text.height));
    const padX = .9 * size, padY = .6 * size, slot = 2.4 * size, count = values.length, room = area.width - slot * (count - 1);
    const equal = count * (Math.max(...widths) + 2 * padX) <= room;
    if (!equal && widths.reduce((sum, width) => sum + width + 2 * padX, 0) > room) return undefined;
    const chipWidths = widths.map(width => equal ? room / count : width + 2 * padX), chipHeight = lineHeight + 2 * padY;
    const middle = fit.listEntries[0]!.textBox.y + fit.height / 2, y = middle - chipHeight / 2;
    const total = chipWidths.reduce((sum, width) => sum + width, 0) + slot * (count - 1);
    let start = area.x + (area.width - total) / 2;
    const chips: NonNullable<ComposedSteps['chips']> = [], columns: ComposedListColumn[] = [];
    for (let index = 0; index < count; index++) {
      const width = chipWidths[index]!, x = rtl ? area.x + area.width - (start - area.x) - width : start;
      start += width + slot;
      const box = { x: x + (width - widths[index]!) / 2 - 1, y: y + padY, width: widths[index]! + 2, height: lineHeight };
      const text = single(index, box);
      if (text.overflow || text.listEntries[0]!.text.richLines.length !== 1) return undefined;
      chips.push({ path: text.listEntries[0]!.textPath!, box: { x, y, width, height: chipHeight }, radius: CARD_RADIUS * scale });
      columns.push({ box, start: index, end: index + 1, text });
    }
    // Arrows point in reading order, from one chip's end edge to the next chip's start edge, half an em clear of both and .6 em tall.
    const arrows = chips.slice(1).map((chip, index) => {
      const previous = chips[index]!, left = rtl ? chip.box.x + chip.box.width : previous.box.x + previous.box.width, right = rtl ? previous.box.x : chip.box.x, tall = .6 * size;
      return { box: { x: left + .5 * size, y: y + (chipHeight - tall) / 2, width: Math.max(scale, right - left - size), height: tall }, direction: rtl ? 'left' as const : 'right' as const };
    });
    item.listColumns = columns;
    item.text = mergeListColumns(columns);
    item.box = { x: Math.min(...chips.map(chip => chip.box.x)), y, width: total, height: chipHeight };
    return { form: 'flow', region, path: item.path, badges: [], chips, arrows, lineWidth };
  };
  // SH-09: an `arrangement` region's lone list of one level (no descriptions, no numbering, no icons) as a pyramid or a matrix in the
  // region's cell (arrangements.ts). Every entry is fitted alone in its node's text rectangle, less the text margin, at one size for all:
  // the largest from ARRANGEMENT_GROWTH times the list's role size (or the list's size, when larger) down to the list's role size (or its
  // fitted size, when smaller) at which every entry fits without breaking a word and, in a shape that holds its text, with the ink of every
  // line inside the outline. The arrangement fills the region, so the LH-48 growth a lone list takes in a roomy region is not the size it
  // keeps; it never draws below that floor. The designs are tried in order:
  // - `smartart`: PowerPoint's own geometry (Basic Pyramid, Basic Matrix of exactly four entries), centered text, which the PPTX export can
  //   write as live SmartArt;
  // - `opf`: OPF's own design of the same arrangement where PowerPoint's does not hold the entries at the floor: a stepped pyramid with
  //   each entry beside its level (start-aligned), or four quadrants filling the region (centered);
  // - `cards`: a matrix of other than four entries is a grid of cards (cardGridColumns), start-aligned, reported `arrangement-adapted`.
  // When none holds the entries at the floor, the list stays as it was and `arrangement-adapted` says so. Each entry is a list column.
  type ArrangementDesign = { design: ComposedArrangement['design']; frame: LayoutBox; nodes: ArrangementNode[]; margin: number; align: 'center' | 'start'; paint: 'primary' | 'card'; text: 'node' | 'slide'; background?: LayoutBox; lineWidth: number; margins?: [number, number, number, number]; arrows?: ArrangementArrow[]; largest?: true; last?: true; refit?: (need: number) => { nodes: ArrangementNode[]; arrows: ArrangementArrow[] } | undefined; layout?: OpfLayoutRecipe };
  const arrangedList = (item: ComposedItem, kind: Arrangement, area: LayoutBox): ComposedArrangement | undefined => {
    const values = item.value as ListValue[], fit = item.text as ListFit, base = fit.fontSize, count = values.length;
    const listOptions: ListFitOptions = { ...richOptions(styleFor(item.field, item.path)), bullet: 'none' };
    const single = (index: number, box: LayoutBox, size: number): ListFit => {
      const own0 = `${item.path}.0`, ownPath = `${item.path}.${index}`, marker = listOptions.citationMarker;
      const entryOptions: ListFitOptions = marker ? { ...listOptions, citationMarker: (run: string) => marker(run === own0 || run.startsWith(`${own0}.`) ? ownPath + run.slice(own0.length) : run) } : listOptions;
      const own = fitList([values[index]!], box, size, size, entryOptions), object = typeof values[index] === 'object' && !Array.isArray(values[index]);
      return { ...own, listEntries: own.listEntries.map(entry => ({ ...entry, index, textPath: `${item.path}.${index}${object ? '.text' : ''}` })) };
    };
    // Where each line starts in the entry's runs: the same breaks at another width give the same string.
    const breaks = (entry: ListEntryLayout | undefined) => entry?.text.richLines.map(line => line.fragments.length ? `${line.fragments[0]!.runIndex}:${line.fragments[0]!.start}` : '-').join(',');
    // A line that ends inside a word (the breaker cut a word too long for the node) rejects the size; Chinese and Japanese break between characters.
    const word = /[\p{L}\p{N}]/u, everywhere = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
    const cutsWord = (entry: ListEntryLayout) => entry.text.richLines.slice(1).some((line, index) => {
      const last = entry.text.richLines[index]!.fragments.filter(fragment => fragment.kind === undefined).at(-1), first = line.fragments.find(fragment => fragment.kind === undefined);
      if (!last || !first || last.runIndex !== first.runIndex || first.start !== last.end) return false;
      const before = [...last.text].at(-1) ?? '', after = [...first.text][0] ?? '';
      return word.test(before) && word.test(after) && !everywhere.test(before) && !everywhere.test(after);
    });
    // SH-19: `check` also fits every entry 4% narrower and wider (SMART_ART_DOMAIN.slack), so the export knows whether PowerPoint, which
    // measures its own fonts, breaks the same lines: always for PowerPoint's design, once for OPF's chosen design (its layout definition).
    const place = (design: ArrangementDesign, size: number, check = design.design === 'smartart') => {
      const margin = design.margin * size, columns: ComposedListColumn[] = [], lines: number[] = [], stable: boolean[] = [];
      // SH-17: a chevron's margin is larger at its start (a design with one margin keeps SH-09's arithmetic, so its text lies exactly where it did).
      const [left, top, right, bottom] = (design.margins ?? [design.margin, design.margin, design.margin, design.margin]).map(share => share * size) as [number, number, number, number];
      const less = (length: number, start: number, end: number) => design.margins ? length - start - end : length - 2 * margin;
      for (let index = 0; index < count; index++) {
        const node = design.nodes[index]!, inner = { x: node.textBox.x + left, y: node.textBox.y + top, width: less(node.textBox.width, left, right), height: less(node.textBox.height, top, bottom) };
        if (inner.width <= 0 || inner.height <= 0) return undefined;
        const probe = single(index, { ...inner, height: 1e5 }, size), entry = probe.listEntries[0];
        if (!entry || probe.overflow || entry.text.height > inner.height + 1e-6) return undefined;
        const box = { x: inner.x, y: inner.y + (inner.height - entry.text.height) / 2, width: inner.width, height: entry.text.height };
        const text = single(index, box, size), placed = text.listEntries[0];
        if (!placed || text.overflow || cutsWord(placed)) return undefined;
        // A centered line is centered without the space it broke at (PowerPoint's wrap drops it): the space is left out of its last
        // fragment and width.
        if (design.align === 'center') placed.text.richLines = placed.text.richLines.map(line => {
          const last = line.fragments.at(-1), trail = last && last.kind === undefined ? /\s+$/u.exec(last.text)?.[0] : undefined;
          if (!trail || trail.length === last!.text.length) return line;
          // A space that hangs (RR-17) is already out of the line's width; the fragments still hold it.
          const cut = textWidthMeasurer(last!.style, listOptions.textMeasurement)(trail, last!.fontSize), drawn = line.fragments.reduce((sum, fragment) => sum + fragment.width, 0);
          return { ...line, width: Math.max(0, Math.min(line.width, drawn - cut)), fragments: [...line.fragments.slice(0, -1), { ...last!, text: last!.text.slice(0, -trail.length), end: last!.end - trail.length, width: Math.max(0, last!.width - cut) }] };
        });
        // The ink of every line (cap height over the baseline to the descenders) stays inside the node's outline, inset by the margin: a
        // pyramid level narrows toward its top, a quadrant at its corners. Text beside its level has no outline to keep to.
        if (!node.beside) for (const line of placed.text.richLines) {
          const baseline = placed.textBox.y + line.baseline, room = less(Math.min(nodeWidthAt(node, baseline - .72 * size), nodeWidthAt(node, baseline + .22 * size)), left, right);
          if (line.width > room + 1e-6) return undefined;
        }
        const own = breaks(placed), widths = !check ? [] : [1 - SMART_ART_DOMAIN.slack, 1 + SMART_ART_DOMAIN.slack].map(share => breaks(single(index, { ...inner, width: inner.width * share, height: 1e5 }, size).listEntries[0]));
        lines.push(placed.text.richLines.length); stable.push(widths.every(other => other === own));
        columns.push({ box, start: index, end: index + 1, text });
      }
      // SH-17: how full the fullest text rectangle is, and the text's share of the frame (SMART_ART_DOMAIN.fill and ink).
      const fill = Math.max(0, ...columns.map((column, index) => { const box = design.nodes[index]!.textBox; return column.box.height / Math.max(1e-6, box.height - top - bottom); }));
      const ink = columns.reduce((sum, column) => sum + column.text.listEntries[0]!.text.richLines.reduce((all, line) => all + line.width * size, 0), 0) / Math.max(1e-6, design.frame.width * design.frame.height);
      // SH-19: the widest line of any entry (SMART_ART_DOMAIN.lineWidth).
      const widest = Math.max(0, ...columns.flatMap(column => column.text.listEntries[0]!.text.richLines.map(line => line.width)));
      return { columns, margin, margins: [left, top, right, bottom] as [number, number, number, number], lines, stable, fill, ink, widest };
    };
    const role = LIST_NOMINAL_SIZE * scale, floor = Math.min(base, role), step = 4 / 3 * scale, top = Math.max(base, snapFontSizeDown(role * ARRANGEMENT_GROWTH));
    // The largest size at which a design holds every entry; for the SmartArt design one whose line breaks all hold (PowerPoint breaks them
    // alike) when there is one.
    const sized = (design: ArrangementDesign) => {
      let fallback: { placed: NonNullable<ReturnType<typeof place>>; size: number } | undefined;
      for (let candidate = top; ; candidate = snapFontSizeDown(candidate - step)) {
        const at = Math.max(candidate, floor), attempt = place(design, at);
        if (attempt && (design.design !== 'smartart' || attempt.stable.every(Boolean))) return { placed: attempt, size: at };
        if (attempt && !fallback) fallback = { placed: attempt, size: at };
        if (at <= floor + 1e-6) return fallback;
      }
    };
    const primaryLine = ARRANGEMENT_LINE_POINTS / .75 * scale, radius = CARD_RADIUS * scale;
    const designs: ArrangementDesign[] = [];
    if (kind === 'pyramid') {
      const frame = pyramidFrame(area);
      designs.push({ design: 'smartart', frame, nodes: pyramidNodes(frame, count), margin: ARRANGEMENT_TEXT_MARGIN.pyramid, align: 'center', paint: 'primary', text: 'node', lineWidth: primaryLine });
      designs.push({ design: 'opf', frame: area, nodes: pyramidSteps(area, count, gap / 2, radius), margin: 0, align: 'start', paint: 'primary', text: 'slide', lineWidth: primaryLine, layout: { design: 'pyramid-steps', area, gap: gap / 2, radius } });
    } else if (kind === 'cycle') {
      // SH-18: PowerPoint's Basic Cycle in a frame of its own proportion (cycleFrame), then OPF's two designs filling the region (rounded
      // rectangles on a ring, and a loop of two rows), of which the one that holds the entries larger is kept (the ring when they tie).
      const frame = cycleFrame(area, count), basic = cycleNodes(frame, count, rtl), own = [cycleRing(area, count, gap, rtl), cycleLoop(area, count, gap, rtl), cycleLoop(area, count, gap, rtl, 3)];
      designs.push({ design: 'smartart', frame, ...basic, margin: ARRANGEMENT_TEXT_MARGIN.cycle, align: 'center', paint: 'primary', text: 'node', lineWidth: primaryLine });
      own.forEach((shapes, at) => { if (shapes) designs.push({ design: 'opf', frame: area, ...shapes, margin: CYCLE_RING_MARGIN, align: 'center', paint: 'primary', text: 'node', lineWidth: primaryLine, layout: { design: (['cycle-ring', 'cycle-loop', 'cycle-loop-3'] as const)[at]!, area, gap, rtl } }); });
    } else if (isLinearArrangement(kind)) {
      // SH-17: PowerPoint's Basic Chevron Process, Basic Process or Vertical Process in the region, then OPF's own design filling it.
      // OPF's in one to four rows (columns, a vertical flow), whichever holds the entries at the largest size (one line on a tie).
      const own = linearNodes(kind, area, count, rtl), margins = linearMargins(kind, rtl);
      designs.push({ design: 'smartart', frame: area, nodes: own.nodes, ...(own.arrows.length ? { arrows: own.arrows } : {}), margin: ARRANGEMENT_TEXT_MARGIN[kind], margins, align: 'center', paint: 'primary', text: 'node', lineWidth: primaryLine });
      // Each is sized in its tallest geometry, then its nodes take the height of the text (refit).
      // The compact designs (closer rooms, smaller arrows) only when none of PowerPoint's proportions holds the entries (`last`).
      for (const compact of [false, true]) for (let lines = 1; lines <= Math.min(OPF_LINES_MAX, count); lines++) {
        const opf = linearDesign(kind, area, count, gap, rtl, lines, undefined, compact);
        if (opf) designs.push({ design: 'opf', frame: area, nodes: opf.nodes, ...(opf.arrows.length ? { arrows: opf.arrows } : {}), margin: ARRANGEMENT_TEXT_MARGIN[kind], margins: linearMargins(kind, rtl, true), align: 'center', paint: 'primary', text: 'node', lineWidth: primaryLine, largest: true,
          refit: need => linearDesign(kind, area, count, gap, rtl, lines, need, compact), ...(compact ? { last: true as const } : {}),
          layout: { design: kind === 'chevrons' ? 'chevron-rows' : kind === 'flow' ? 'flow-rows' : 'vertical-flow-columns', area, gap, rtl, lines, ...(compact ? { compact: true } : {}) } });
      }
    } else if (count === MATRIX_ENTRIES) {
      designs.push({ design: 'smartart', frame: area, nodes: matrixNodes(area), margin: ARRANGEMENT_TEXT_MARGIN.matrix, align: 'center', paint: 'primary', text: 'node', background: matrixSquare(area), lineWidth: primaryLine });
      designs.push({ design: 'opf', frame: area, nodes: matrixQuadrants(area, gap), margin: ARRANGEMENT_TEXT_MARGIN.matrix, align: 'center', paint: 'primary', text: 'node', lineWidth: primaryLine, layout: { design: 'matrix-quadrants', area, gap, radius } });
    } else {
      // The grid's shape is the one whose cards hold the entries at the largest size: one column of wide cards in a narrow region, a balanced
      // grid (cardGridColumns) in a wide one.
      const columns = [...new Set([1, ...(count > 1 ? cardGridColumns(count) : []), Math.min(count, 2)])].filter(column => column <= count);
      for (const column of columns) designs.push({ design: 'cards', frame: area, nodes: cardNodes(area, count, column, gap, radius), margin: CARD_TEXT_MARGIN, align: 'start', paint: 'card', text: 'slide', lineWidth: scale, layout: { design: 'card-grid', area, gap, radius, columns: column } });
      diagnostics.push({ code: 'arrangement-adapted', path: item.path, message: `A matrix needs four entries; its ${count} ${count === 1 ? 'entry is' : 'entries are'} drawn as ${count === 1 ? 'a card' : 'a grid of cards'}.` });
    }
    // PowerPoint's design only where the PPTX export can write it as live SmartArt (SMART_ART_DOMAIN); outside it OPF's own design, and
    // PowerPoint's geometry again (as native shapes) when OPF's does not hold the entries either. Of the card grids, the largest text.
    const script = smartArtScript(values.map(value => flatten(typeof value === 'object' && value !== null && !Array.isArray(value) ? record(value).text : value)));
    let chosen: { design: ArrangementDesign; placed: NonNullable<ReturnType<typeof place>>; size: number } | undefined, outside: typeof chosen, skipped: string | undefined;
    for (const design of designs) {
      if (design.last && chosen) break;
      const result = sized(design);
      if (!result) { if (design.design === 'smartart') skipped = `its entries do not fit PowerPoint's ${SMART_ART_NAMES[kind].layout} at the list's size`; continue; }
      const unavailable = design.design !== 'smartart' ? undefined : smartArtUnavailable({ kind, count, frame: design.frame, rtl: rtl || script.rtl, ...(script.script ? { script: script.script } : {}),
        nodes: result.placed.lines.map((lines, index) => ({ lines, stable: result.placed.stable[index]! })), ...(isLinearArrangement(kind) ? { fill: result.placed.fill, ink: result.placed.ink } : {}), widest: result.placed.widest });
      if (unavailable !== undefined) { outside ??= { design, ...result }; skipped = unavailable; continue; }
      // Of the card grids, of a cycle's designs and of OPF's rows or columns of a linear arrangement (SH-17, `largest`), the one that holds the largest text.
      const largest = design.design === 'cards' || kind === 'cycle' || design.largest === true;
      if (largest && chosen && chosen.design.design === design.design && chosen.size >= result.size) continue;
      chosen = { design, ...result };
      if (design.design === 'smartart' || !largest) break;
    }
    if (!chosen && outside) { chosen = outside; skipped = undefined; }
    if (!chosen) {
      diagnostics.push({ code: 'arrangement-adapted', path: item.path, message: `The entries of the ${kind === 'chevrons' ? 'row of chevrons' : kind.replace('-', ' ')} do not fit its ${SMART_ART_NAMES[kind].nodes} at the list's size, so they are drawn as a list.` });
      fillRegionWithList(item, area, top);
      return undefined;
    }
    let { design, placed } = chosen;
    const { size } = chosen;
    // SH-17: OPF's own row or column, its text sized in the tallest geometry, takes the height that text needs (one height for all
    // nodes, PowerPoint's proportion at least), centered in the region.
    if (design.refit) {
      const need = Math.max(...placed.columns.map(column => column.box.height)) + placed.margins[1] + placed.margins[3], shapes = design.refit(need);
      const next = shapes ? { ...design, nodes: shapes.nodes, ...(shapes.arrows.length ? { arrows: shapes.arrows } : {}), ...(design.layout ? { layout: { ...design.layout, need } } : {}) } : undefined, again = next ? place(next, size) : undefined;
      if (next && again) { design = next; placed = again; }
    }
    if (design.layout) placed = place(design, size, true) ?? placed;
    item.listColumns = placed.columns;
    item.text = mergeListColumns(placed.columns);
    item.alignment = design.align === 'center' ? 'center' : rtl ? 'right' : 'left';
    item.box = { ...design.frame };
    const textPaths = placed.columns.map(column => column.text.listEntries[0]!.textPath!);
    return { kind, design: design.design, region: item.region ?? '', path: item.path, frame: { ...design.frame }, ...(design.background ? { background: design.background } : {}),
      nodes: design.nodes.map((node, index) => ({ ...node, ...(textPaths[index] !== undefined ? { path: textPaths[index] } : {}) })), fontSize: size, textMargin: placed.margin,
      ...(design.margins ? { margins: placed.margins } : {}), ...(design.arrows ? { arrows: design.arrows } : {}),
      align: design.align, paint: design.paint, text: design.text, lineWidth: design.lineWidth, ...(design.layout ? { layout: design.layout } : {}), smartArt: { lines: placed.lines, stable: placed.stable, ...(isLinearArrangement(kind) || design.layout ? { fill: +placed.fill.toFixed(4), ink: +placed.ink.toFixed(4) } : {}), widest: +placed.widest.toFixed(2) }, ...(design.design === 'opf' && skipped ? { instead: skipped } : {}) };
  };
  // SH-18 review: a region whose arrangement holds two or more list blocks (each block an entry of its own, a list inside it) draws the
  // blocks as the arrangement's entries, the same way for every count and for the three arrangements: a cycle's blocks on cards on OPF's
  // ring or a loop (whichever holds them larger) with an arrow from each to the next, a matrix's blocks on a grid of cards, a pyramid's
  // blocks beside the levels of OPF's stepped pyramid. Every block's list keeps its markers, is start-aligned and vertically centered in
  // its card (or beside its level) and is set at one size for all: the largest from ARRANGEMENT_GROWTH times the role size down to the
  // smallest of the lists' own sizes at which every block fits. When none does, the blocks keep the region's own composition and
  // `arrangement-adapted` says why. PowerPoint's SmartArt nodes do not hold a list, so these are always native shapes.
  const blockCutsWord = (entry: ListEntryLayout): boolean => {
    const word = /[\p{L}\p{N}]/u, everywhere = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
    return entry.text.richLines.slice(1).some((line, index) => {
      const last = entry.text.richLines[index]!.fragments.filter(fragment => fragment.kind === undefined).at(-1), first = line.fragments.find(fragment => fragment.kind === undefined);
      if (!last || !first || last.runIndex !== first.runIndex || first.start !== last.end) return false;
      const before = [...last.text].at(-1) ?? '', after = [...first.text][0] ?? '';
      return word.test(before) && word.test(after) && !everywhere.test(before) && !everywhere.test(after);
    });
  };
  const arrangedBlocks = (members: ComposedItem[], kind: Arrangement, area: LayoutBox): ComposedArrangement | undefined => {
    const count = members.length, role = LIST_NOMINAL_SIZE * scale, step = 4 / 3 * scale, primaryLine = ARRANGEMENT_LINE_POINTS / .75 * scale, radius = CARD_RADIUS * scale;
    const bases = members.map(member => (member.text as ListFit).fontSize), floor = Math.min(role, ...bases), top = Math.max(...bases, snapFontSizeDown(role * ARRANGEMENT_GROWTH));
    type BlockDesign = { design: ComposedArrangement['design']; nodes: ArrangementNode[]; arrows?: ArrangementArrow[]; card: boolean; compact?: true; refit?: (need: number) => { nodes: ArrangementNode[]; arrows: ArrangementArrow[] } | undefined };
    const designs: BlockDesign[] = [];
    if (kind === 'cycle') for (const shapes of [cycleRing(area, count, gap, rtl), cycleLoop(area, count, gap, rtl), cycleLoop(area, count, gap, rtl, 3)]) { if (shapes) designs.push({ design: 'opf', ...shapes, card: true }); }
    else if (kind === 'pyramid') designs.push({ design: 'opf', nodes: pyramidSteps(area, count, gap / 2, radius), card: false });
    // SH-17: OPF's chevrons or boxes in one to four rows (columns), each block on a card of that shape with the arrows between; the
    // compact forms only when none of the proportioned ones holds the lists. The cards then take the height of the lists (refit).
    else if (isLinearArrangement(kind)) for (const compact of [false, true]) for (let lines = 1; lines <= Math.min(OPF_LINES_MAX, count); lines++) {
      const shapes = linearDesign(kind, area, count, gap, rtl, lines, undefined, compact);
      if (shapes) designs.push({ design: 'opf', nodes: shapes.nodes, ...(shapes.arrows.length ? { arrows: shapes.arrows } : {}), card: true, ...(compact ? { compact: true as const } : {}),
        refit: need => linearDesign(kind, area, count, gap, rtl, lines, need, compact) });
    }
    // A grid of cards: a matrix's own design, and the fallback of a pyramid or a cycle whose design does not hold the lists.
    const cards: BlockDesign[] = [...new Set([1, ...(count > 1 ? cardGridColumns(count) : []), Math.min(count, 2)])].filter(column => column <= count)
      .map(column => ({ design: 'cards' as const, nodes: cardNodes(area, count, column, gap, radius), card: true }));
    if (kind === 'matrix') designs.push(...cards);
    const optionsOf = members.map(member => listOptionsFor(member.field, member.path, member.payload.numbering, member.value));
    const place = (design: BlockDesign, size: number) => {
      const margin = design.card ? CARD_TEXT_MARGIN * size : 0, fits: { box: LayoutBox; text: ListFit }[] = [];
      for (const [index, member] of members.entries()) {
        const node = design.nodes[index]!, inner = { x: node.textBox.x + margin, y: node.textBox.y + margin, width: node.textBox.width - 2 * margin, height: node.textBox.height - 2 * margin };
        if (inner.width <= 0 || inner.height <= 0) return undefined;
        const values = member.value as ListValue[], probe = fitList(values, { ...inner, height: 1e5 }, size, size, optionsOf[index]!);
        if (probe.overflow || probe.height > inner.height + 1e-6) return undefined;
        const box = { x: inner.x, y: inner.y + (inner.height - probe.height) / 2, width: inner.width, height: probe.height }, text = fitList(values, box, size, size, optionsOf[index]!);
        // Never a word broken across lines (a word wider than the card): Chinese and Japanese break between characters.
        if (text.overflow || text.listEntries.some(entry => blockCutsWord(entry))) return undefined;
        fits.push({ box, text });
      }
      return { fits, margin };
    };
    let chosen: { design: BlockDesign; placed: NonNullable<ReturnType<typeof place>>; size: number } | undefined;
    const trySizes = (design: BlockDesign) => {
      for (let candidate = top; candidate >= floor - 1e-6; candidate = snapFontSizeDown(candidate - step)) {
        const placed = place(design, Math.max(candidate, floor));
        if (placed) { if (!chosen || candidate > chosen.size + 1e-6) chosen = { design, placed, size: Math.max(candidate, floor) }; break; }
        if (candidate <= floor + 1e-6) break;
      }
    };
    for (const design of designs) if (!design.compact) trySizes(design);
    if (!chosen) for (const design of designs) if (design.compact) trySizes(design);
    const noun = kind === 'chevrons' ? 'row of chevrons' : kind.replace('-', ' ');
    if (!chosen && kind !== 'matrix') {
      for (const design of cards) trySizes(design);
      if (chosen) diagnostics.push({ code: 'arrangement-adapted', path: members[0]!.path, message: `The ${count} lists of the ${noun} do not fit its ${SMART_ART_NAMES[kind].nodes} at the lists' size, so they are drawn as a grid of cards.` });
    }
    if (!chosen) {
      diagnostics.push({ code: 'arrangement-adapted', path: members[0]!.path, message: `The ${count} lists of the ${noun} do not fit its ${kind === 'matrix' ? 'cards' : SMART_ART_NAMES[kind].nodes} at the lists' size, so they are drawn as the region's blocks.` });
      return undefined;
    }
    let { design, placed } = chosen;
    const { size } = chosen;
    // SH-17: OPF's cards of a linear arrangement take the height of the tallest list and its margins, centered.
    if (design.refit) {
      const shapes = design.refit(Math.max(...placed.fits.map(fit => fit.box.height)) + 2 * placed.margin);
      const next = shapes ? { ...design, nodes: shapes.nodes, ...(shapes.arrows.length ? { arrows: shapes.arrows } : {}) } : undefined, again = next ? place(next, size) : undefined;
      if (next && again) { design = next; placed = again; }
    }
    for (const [index, member] of members.entries()) {
      const fit = placed.fits[index]!;
      member.text = fit.text; member.box = fit.box; delete member.frameBox;
      member.alignment = rtl ? 'right' : 'left';
    }
    return { kind, design: design.design, region: members[0]!.region ?? '', path: members[0]!.path, frame: { ...area },
      nodes: design.nodes.map((node, index) => ({ ...node, path: members[index]!.path })), ...(design.arrows ? { arrows: design.arrows } : {}), fontSize: size, textMargin: placed.margin,
      align: 'start', paint: design.card ? 'card' : 'primary', text: 'slide', lineWidth: design.card ? scale : primaryLine, smartArt: { lines: [], stable: [] },
      ...(design.design === 'opf' ? { instead: `its entries are lists, which a SmartArt node does not hold` } : {}) };
  };
  // SH-18 review (also SH-09's pyramids and matrices): a list that no design of its region's arrangement holds still fills the region
  // as an arrangement would. Its text takes the largest size, from the arrangement's top size (ARRANGEMENT_GROWTH times the role size)
  // down to the size it has, at which the whole list fits the region, and the list sits in the middle of the region's height. LH-48's
  // body growth leaves a list alone once it covers half the body, which left a fallback list at the role size in the top of the region.
  const fillRegionWithList = (item: ComposedItem, area: LayoutBox, top: number): void => {
    const values = item.value as ListValue[], fit = item.text as ListFit, base = fit.fontSize, step = 4 / 3 * scale;
    const listOptions = listOptionsFor(item.field, item.path, item.payload.numbering, values);
    let size = base, height = fit.overflow ? Infinity : fit.height;
    for (let candidate = top; candidate > base + 1e-6; candidate = snapFontSizeDown(candidate - step)) {
      const probe = fitList(values, area, candidate, candidate, listOptions);
      if (!probe.overflow && probe.height <= area.height + 1e-6) { size = candidate; height = probe.height; break; }
    }
    if (!Number.isFinite(height)) return;
    const box = { x: area.x, y: area.y + Math.max(0, (area.height - height) / 2), width: area.width, height: Math.min(area.height, height) };
    const placed = fitList(values, box, size, size, listOptions);
    if (placed.overflow) return;
    item.text = placed;
    item.box = box;
  };
  const arrangedLists = (): ComposedArrangement[] => {
    const result: ComposedArrangement[] = [];
    for (const region of template!.regions) {
      if (!region.arrangement) continue;
      const members = items.filter(item => item.region === region.name && !headings.has(item.field)), item = members.length === 1 ? members[0]! : undefined;
      // SH-18 review: two or more list blocks are the entries themselves (arrangedBlocks).
      // A region whose lists overflow keeps its composition, which pagination splits (the arrangement never sets them smaller).
      const lists = members.filter(member => (member.field === 'items' || member.field === 'bullets') && !member.listColumns && !member.caption && member.text && 'listEntries' in member.text && !member.text.overflow);
      if (members.length > 1 && lists.length === members.length && members.length <= (region.arrangement === 'matrix' ? ARRANGEMENT_CARDS_MAX : ARRANGEMENT_MAX[region.arrangement])) {
        const arranged = arrangedBlocks(members, region.arrangement, templateRegions.find(entry => entry.name === region.name)?.box ?? members[0]!.box);
        if (arranged) result.push(arranged);
        continue;
      }
      if (!item || (item.field !== 'items' && item.field !== 'bullets') || item.listColumns || item.caption || item.frameBox || !item.text || !('listEntries' in item.text)) continue;
      const values = Array.isArray(item.value) ? item.value as unknown[] : [];
      if (!values.length) continue;
      const reason = item.payload.numbering !== undefined ? 'a numbered list' : values.some(value => (record(value).level ?? 0) !== 0) ? 'nested entries'
        : values.some(value => record(value).description !== undefined) ? 'descriptions' : values.some(value => record(value).icon !== undefined) ? 'icons'
          : region.arrangement !== 'matrix' && values.length > ARRANGEMENT_MAX[region.arrangement] ? `more than ${ARRANGEMENT_MAX[region.arrangement]} ${SMART_ART_NAMES[region.arrangement].nodes}` : values.length > ARRANGEMENT_CARDS_MAX ? `more than ${ARRANGEMENT_CARDS_MAX} entries` : undefined;
      if (reason) { diagnostics.push({ code: 'arrangement-adapted', path: item.path, message: `${region.arrangement === 'chevrons' ? 'A row of chevrons' : `A ${region.arrangement.replace('-', ' ')}`} draws a list of one level of short entries; this list has ${reason}, so it is drawn as a list.` }); continue; }
      const area = templateRegions.find(entry => entry.name === region.name)?.box ?? item.box;
      const arranged = arrangedList(item, region.arrangement, area);
      if (arranged) result.push(arranged);
    }
    return result;
  };
  // LH-133: the rules of a region's questions (markPairs), added to their lists' rules (ListFit.rules) once every block is placed: a
  // hairline in the middle of the gap between two ruled rows, across both, and an accent rule over each cell of a grid, half a gap above
  // its text and never nearer the text above it (a cell of the row above, the headings) than its own.
  // LH-133: a placed list moved down by `dy` (its box, entries, markers, numerals and rules).
  const shiftList = (item: ComposedItem, dy: number): void => {
    if (!dy) return;
    const fit = item.text as ListFit, down = <T extends { y: number }>(box: T): T => ({ ...box, y: box.y + dy });
    item.box = down(item.box);
    item.text = { ...fit, listEntries: fit.listEntries.map(entry => ({ ...entry, textBox: down(entry.textBox), ...(entry.descriptionBox ? { descriptionBox: down(entry.descriptionBox) } : {}), marker: down(entry.marker),
      ...(entry.bulletBox ? { bulletBox: down(entry.bulletBox) } : {}), ...(entry.badge ? { badge: { ...entry.badge, cy: entry.badge.cy + dy, ...(entry.badge.numeral ? { numeral: down(entry.badge.numeral) } : {}) } } : {}),
      ...(entry.icon ? { icon: { ...entry.icon, cy: entry.icon.cy + dy } } : {}) })),
      ...(fit.rules ? { rules: fit.rules.map(down) } : {}) };
  };
  const pairRules = (): void => {
    const listOf = (item: ComposedItem) => item.text && 'listEntries' in item.text && !item.listColumns && (item.text as ListFit).listEntries.length ? item.text as ListFit : undefined;
    const top = (fit: ListFit) => Math.min(...fit.listEntries.map(entry => Math.min(entry.textBox.y, entry.descriptionBox?.y ?? Infinity)));
    const bottom = (fit: ListFit) => Math.max(...fit.listEntries.map(entry => Math.max(entry.textBox.y + entry.textBox.height, entry.descriptionBox ? entry.descriptionBox.y + entry.descriptionBox.height : -Infinity)));
    const add = (item: ComposedItem, fit: ListFit, rule: ListRule) => { item.text = { ...fit, rules: [...(fit.rules ?? []), roundRule(rule)] }; };
    const roundRule = (rule: ListRule): ListRule => ({ ...rule, x: Math.round(rule.x * 100) / 100, y: Math.round(rule.y * 100) / 100, width: Math.round(rule.width * 100) / 100 });
    const rowed = items.filter(item => pairRowLabels.has(item.path) && listOf(item)).sort((a, b) => a.box.y - b.box.y);
    // The rows spread over the body as a lone ruled list does (ListFitOptions.spread): the body (from a gap under the headings above them
    // to the foot of the content box, whatever LH-48's centering did to their region) is shared evenly between the gaps, each at most
    // LIST_ROWS_SPREAD em of the rows' size, and what is still left sits above and below them. Their region's cell follows them.
    const composed = rowed.length > 1 ? templateRegions.find(region => region.name === rowed[0]!.region) : undefined;
    if (composed && options.fill !== false) {
      const first = top(listOf(rowed[0]!)!), heads = items.filter(item => headings.has(item.field) && item.box.y + item.box.height <= first + 1e-6);
      const start = Math.max(contentBox.y, ...heads.map(item => item.box.y + item.box.height + gap)), end = contentBox.y + contentBox.height - scale;
      const size = Math.min(...rowed.map(item => item.text!.fontSize)), gaps = rowed.slice(1).map((item, index) => top(listOf(item)!) - bottom(listOf(rowed[index]!)!));
      const natural = bottom(listOf(rowed.at(-1)!)!) - first, extra = Math.max(0, Math.min((end - start - natural) / (rowed.length - 1), LIST_ROWS_SPREAD * size - Math.max(...gaps)));
      const lead = start + Math.max(0, (end - start - natural - extra * (rowed.length - 1)) / 2) - first;
      if (natural <= end - start + 1e-6 && (lead > 0 || extra > 0)) {
        rowed.forEach((item, index) => { shiftList(item, lead + extra * index); });
        const y = Math.min(composed.box.y, rowed[0]!.box.y), last = rowed.at(-1)!;
        composed.box = roundBox({ ...composed.box, y, height: Math.max(composed.box.y + composed.box.height, last.box.y + last.box.height) - y });
      }
    }
    for (let index = 1; index < rowed.length; index++) {
      const above = rowed[index - 1]!, item = rowed[index]!, fit = listOf(item)!, x = Math.min(above.box.x, item.box.x);
      add(item, fit, { x, y: (bottom(listOf(above)!) + top(fit)) / 2, width: Math.max(above.box.x + above.box.width, item.box.x + item.box.width) - x });
    }
    for (const item of items) {
      const fit = pairGrid.has(item.path) ? listOf(item) : undefined;
      if (!fit) continue;
      const start = top(fit), edges = items.filter(other => other !== item && other.box.x < item.box.x + item.box.width && item.box.x < other.box.x + other.box.width)
        .map(other => { const own = listOf(other); return own ? bottom(own) : other.box.y + other.box.height; }).filter(edge => edge <= start + 1e-6);
      const room = edges.length ? (start - Math.max(...edges)) / 2 : gap / 2;
      add(item, fit, { x: item.box.x, y: start - Math.min(gap / 2, room), width: item.box.width, accent: true });
    }
  };
  if (useTemplate) pairRules();
  const steps = useTemplate ? stepSequences() : [];
  const arrangements = useTemplate ? arrangedLists() : [];
  // LH-137: a dark slide whose whole body is one short bulleted list (CHECK_TILE_MIN to CHECK_TILE_MAX entries of one level, no
  // descriptions, each CHECK_TILE_MAX_CHARACTERS or fewer: a summary of decisions or outcomes) draws each entry as a tile of a grid that
  // fills the body (one row for three or fewer, two columns for four, three for five or six), with a check mark badge at its start (the
  // right in a right-to-left deck) in place of the bullet, as Claude Design draws a closing list of decisions. The entries keep the
  // list's size; when one of them does not fit its tile at it, the list stays as it was. Drawn as LH-07 draws a flow (`steps`, form
  // `tiles`: chips and badges whose `check` is the mark), so both engines draw it with native shapes.
  const checkTiles = (): ComposedSteps | undefined => {
    // The slide is set apart on a dark surface of its own (its `design` sets a variant or background, and the slide is dark), as a summary
    // or closing is; a deck that is dark throughout draws its lists as lists. A design's own list marker (`listBullet`) is the author's
    // choice of what marks an entry: such a list keeps it.
    const own = record(slide.design);
    if (!ruleOn('check-tiles') || options.darkBackground !== true || (own.variant === undefined && own.background === undefined) || listBullet !== undefined || (options as Record<symbol, unknown>)[LAYOUT_MASTER] === true || surface) return undefined;
    const body = items.filter(item => !headings.has(item.field));
    const item = body.length === 1 ? body[0]! : undefined;
    if (!item || (item.field !== 'bullets' && item.field !== 'items') || item.payload.numbering !== undefined || item.listColumns || item.caption || item.frameBox || stepFlows.has(item.path) || badgeLists.has(item.path) || !item.text || !('listEntries' in item.text) || (item.field === 'items' && iconList(item.value, undefined))) return undefined;
    const values = Array.isArray(item.value) ? item.value as ListValue[] : [];
    const texts = values.map(value => { const object = record(value); return object.description !== undefined || (object.level ?? 0) !== 0 ? undefined : flatten(typeof value === 'object' && !Array.isArray(value) ? object.text : value).trim(); });
    if (values.length < CHECK_TILE_MIN || values.length > CHECK_TILE_MAX || texts.some(text => !text || [...text].length > CHECK_TILE_MAX_CHARACTERS)) return undefined;
    const fit = item.text as ListFit, size = fit.fontSize, count = values.length;
    const area = (useTemplate && item.region !== undefined ? templateRegions.find(region => region.name === item.region)?.box : undefined) ?? contentBox;
    const listOptions: ListFitOptions = { ...richOptions(styleFor(item.field, item.path)), bullet: 'none' };
    // The grid: one row of up to three, two columns of four, three columns of five or six; when an entry would take more than
    // CHECK_TILE_MAX_LINES there, one column of wide tiles (the fewest lines wins when neither keeps every entry that short).
    const shapes = [count <= 3 ? count : count === 4 ? 2 : 3, ...(count <= 4 ? [1] : [2])];
    const tryShape = (columns: number) => {
      const rows = Math.ceil(count / columns);
      const tileWidth = (area.width - gap * (columns - 1)) / columns, tileHeight = (area.height - gap * (rows - 1)) / rows;
      const pad = Math.min(CARD_INSET * scale, tileWidth / 8, tileHeight / 4), diameter = STEP_BADGE * size, between = .6 * size;
      const textWidth = tileWidth - 2 * pad - diameter - between;
      if (textWidth < 4 * size || tileHeight < diameter + 2 * pad) return undefined;
      const chips: NonNullable<ComposedSteps['chips']> = [], badges: ComposedStepBadge[] = [], fits: ComposedListColumn[] = [];
      let lines = 0;
      for (let index = 0; index < count; index++) {
        const row = Math.floor(index / columns), column = index % columns, inRow = Math.min(columns, count - row * columns);
        // A short last row is centered under the full rows.
        const offset = (columns - inRow) * (tileWidth + gap) / 2, logicalX = area.x + offset + column * (tileWidth + gap);
        const x = rtl ? area.x + area.width - (logicalX - area.x) - tileWidth : logicalX, y = area.y + row * (tileHeight + gap);
        const object = typeof values[index] === 'object' && !Array.isArray(values[index]), textPath = `${item.path}.${index}${object ? '.text' : ''}`;
        // The entry is fitted alone (as entry 0), so its runs' citation markers are looked up at its own index.
        const own0 = `${item.path}.0`, ownPath = `${item.path}.${index}`, marker = listOptions.citationMarker;
        const entryOptions: ListFitOptions = marker ? { ...listOptions, citationMarker: (run: string) => marker(run === own0 || run.startsWith(`${own0}.`) ? ownPath + run.slice(own0.length) : run) } : listOptions;
        const probe = fitList([values[index]!], { x: 0, y: 0, width: textWidth, height: 1e5 }, size, size, entryOptions);
        const height = probe.height, textX = rtl ? x + pad : x + pad + diameter + between;
        const box = { x: textX, y: y + (tileHeight - height) / 2, width: textWidth, height: Math.min(height + scale, tileHeight - 2 * pad) };
        const own = fitList([values[index]!], box, size, size, entryOptions);
        if (own.overflow || own.fontSize < size - FONT_GRID_EPSILON || height > tileHeight - 2 * pad) return undefined;
        lines = Math.max(lines, ...own.listEntries.map(entry => entry.text.richLines.length));
        const text: ListFit = { ...own, listEntries: own.listEntries.map(entry => ({ ...entry, index, textPath, descriptionPath: `${item.path}.${index}.description` })) };
        chips.push({ path: textPath, box: { x, y, width: tileWidth, height: tileHeight }, radius: CARD_RADIUS * scale });
        fits.push({ box, start: index, end: index + 1, text });
        const cx = rtl ? x + tileWidth - pad - diameter / 2 : x + pad + diameter / 2, cy = y + tileHeight / 2;
        badges.push({ path: textPath, cx, cy, radius: diameter / 2, label: '', fontSize: size, baseline: cy + size * .35, check: checkMarkPoints(cx, cy, diameter) });
      }
      return { chips, badges, fits, lines, height: rows * tileHeight + gap * (rows - 1) };
    };
    let best: NonNullable<ReturnType<typeof tryShape>> | undefined;
    for (const columns of shapes) {
      const next = tryShape(columns);
      if (next && (!best || next.lines < best.lines)) best = next;
      if (best && best.lines <= CHECK_TILE_MAX_LINES) break;
    }
    if (!best) return undefined;
    const { chips, badges, fits } = best;
    fire('check-tiles');
    item.listColumns = fits;
    item.text = mergeListColumns(fits);
    item.box = { x: area.x, y: area.y, width: area.width, height: best.height };
    item.alignment = rtl ? 'right' : 'left';
    return { form: 'tiles', region: item.region ?? '', path: item.path, badges, chips, lineWidth: 2 * scale };
  };
  const tiles = checkTiles();
  if (tiles) steps.push(tiles);
  // LH-169: a figure-led list (figureRowOf: 2 to FIGURE_ROW_MAX entries, each a short figure with its label) is a row of metrics, as
  // Claude Design draws "62 minutes a day / 1 in 6 reports / 9 days" (n15): one column per entry across the list's box, in reading order
  // (from the right in a right-to-left deck), each the figure bold in the accent at display size (LH-136's display heading, at most the
  // metric value size, METRIC_ROLE_VALUE_SIZE) over an accent rule, its label under it at the size the list drew its descriptions
  // at (fitList `labelScale`). The figures share one size, the smallest any of them fits on one line at (LH-157); a figure that would split
  // even at the list size (LH-39) or a label that overflows its column keeps the list as it was. The row is drawn at the size the list has
  // after the guard and LH-48's growth, so no text is smaller than the list would draw it. It starts where the list starts, level with
  // the blocks beside it, or sits in the middle of the body when it is the slide's one body block. Both engines draw it as they draw a list in columns (`listColumns`, native text in
  // PowerPoint), the figures as LH-133's accent entries.
  const figureRows = (): void => {
    const body = items.filter(item => !headings.has(item.field) && !item.eyebrow && !(item.emphasis && surface && surface.shape !== 'card'));
    for (const item of items) {
      if (!figureRowOf(item.field, item.value, item.payload, item.caption) || item.listColumns || stepFlows.has(item.path) || badgeLists.has(item.path) || stepPaths.has(item.path) || pillarWords.has(item.path) || numeralLists.has(item.path) || termLists.has(item.path) || pairRowLabels.has(item.path) || pairGrid.has(item.path) || !item.text || !('listEntries' in item.text)) continue;
      const values = item.value as ListValue[], size = item.text.fontSize, count = values.length, box = item.box;
      const width = (box.width - gap * (count - 1)) / count;
      if (width < 4 * size) continue;
      const labels = item.text.listEntries.flatMap(entry => entry.description ? [entry.description.fontSize] : []);
      const listOptions: ListFitOptions = { ...richOptions(styleFor(item.field, item.path)), heading: true, display: true, labelScale: Math.min(1, (labels.length ? Math.min(...labels) : size * .82) / size) };
      const column = (index: number, cap: number, area: LayoutBox): ListFit => {
        // The entry is fitted alone (as entry 0), so its runs' citation markers are looked up at its own index.
        const own0 = `${item.path}.0`, ownPath = `${item.path}.${index}`, marker = listOptions.citationMarker, object = typeof values[index] === 'object' && !Array.isArray(values[index]);
        const entryOptions: ListFitOptions = { ...listOptions, displayMax: cap, ...(marker ? { citationMarker: (run: string) => marker(run === own0 || run.startsWith(`${own0}.`) ? ownPath + run.slice(own0.length) : run) } : {}) };
        const own = fitList([values[index]!], area, size, size, entryOptions);
        return { ...own, listEntries: own.listEntries.map(entry => ({ ...entry, index, textPath: `${item.path}.${index}${object ? '.text' : ''}`, descriptionPath: `${item.path}.${index}.description`, accent: true as const })) };
      };
      const split = (fits: ListFit[]) => fits.some(own => own.overflow || own.fontSize < size - FONT_GRID_EPSILON || own.listEntries.length !== 1 || own.listEntries[0]!.text.richLines.length !== 1);
      const probe = (cap: number) => values.map((_, index) => column(index, cap, { x: 0, y: 0, width, height: box.height }));
      const first = probe(METRIC_ROLE_VALUE_SIZE * scale);
      if (split(first)) continue;
      const shared = Math.min(...first.map(own => own.listEntries[0]!.text.fontSize)), fits = probe(shared);
      if (split(fits)) continue;
      const height = Math.max(...fits.map(own => own.height));
      const lone = body.length === 1 && body[0] === item, region = useTemplate && item.region !== undefined ? templateRegions.find(entry => entry.name === item.region)?.box : undefined;
      const under = Math.max(contentBox.y, ...items.filter(other => headings.has(other.field)).map(other => other.box.y + other.box.height + gap));
      const area = lone ? region ?? { ...contentBox, y: under, height: contentBox.y + contentBox.height - under } : undefined;
      const top = area ? area.y + Math.max(0, (area.height - height) / 2) : box.y;
      const columns: ComposedListColumn[] = values.map((_, index) => {
        const x = rtl ? box.x + box.width - (index + 1) * width - index * gap : box.x + index * (width + gap), text = column(index, shared, { x, y: top, width, height: box.height });
        return { box: { x, y: top, width, height: text.height }, start: index, end: index + 1, text };
      });
      item.listColumns = columns;
      item.text = mergeListColumns(columns);
      item.box = { x: box.x, y: top, width: box.width, height };
      item.alignment = rtl ? 'right' : 'left';
      FIGURE_ROW_ITEMS.add(item);
      fire('figure-row');
    }
  };
  figureRows();
  // LH-165, LH-162: a grid of equal cards that takes a list's area (a layout region's box, or the body under the headings) a little below its
  // top (CARD_FILL_SPACE of a gap, as a card that fills its cell), in reading order, a short last row centered under the full rows, mirrored
  // in a right-to-left deck; each card insets its content CARD_INSET at most. Both kinds of card grid share it, and draw their cards as
  // LH-137's tiles do (`steps`, form `tiles`): one chip per card in the theme's card surface and border.
  const cardArea = (item: ComposedItem): LayoutBox => {
    const area = (useTemplate && item.region !== undefined ? templateRegions.find(region => region.name === item.region)?.box : undefined) ?? contentBox, top = gap * CARD_FILL_SPACE;
    return { ...area, y: area.y + top, height: Math.max(scale, area.height - top) };
  };
  const cardGridCells = (count: number, columns: number, area: LayoutBox): LayoutBox[] => {
    const rows = Math.ceil(count / columns), width = (area.width - gap * (columns - 1)) / columns, height = (area.height - gap * (rows - 1)) / rows;
    return Array.from({ length: count }, (_, index) => {
      const row = Math.floor(index / columns), column = index % columns, inRow = Math.min(columns, count - row * columns);
      const logical = area.x + (columns - inRow) * (width + gap) / 2 + column * (width + gap);
      return { x: rtl ? area.x + area.width - (logical - area.x) - width : logical, y: area.y + row * (height + gap), width, height };
    });
  };
  const cardInner = (cell: LayoutBox): LayoutBox => { const pad = Math.min(CARD_INSET * scale, cell.width / 8, cell.height / 5); return { x: cell.x + pad, y: cell.y + pad, width: cell.width - 2 * pad, height: cell.height - 2 * pad }; };
  // The sizes a card grid tries: the size its text has, then each step of the type scale above it up to `display`.
  const cardSizes = (from: number, display: number): number[] => {
    const sizes = [from];
    for (let next = typeScaleStepsUp(from, 1, display, composition.minFontSize ?? 16, scale); next > sizes.at(-1)! + 1e-9; next = typeScaleStepsUp(next, 1, display, composition.minFontSize ?? 16, scale)) sizes.push(next);
    return sizes;
  };
  // LH-48's fill of a card grid: the height its text covers (the tallest text of each row) over the grid's area.
  const gridFill = (heights: readonly number[], columns: number, area: LayoutBox): number => {
    let covered = 0;
    for (let row = 0; row * columns < heights.length; row++) covered += Math.max(...heights.slice(row * columns, (row + 1) * columns));
    return covered / area.height;
  };
  // Whether a fit breaks a word across two lines (its lines joined again differ from the text): a split word reads as an overflow.
  const splitsWord = (source: string, lines: readonly string[]): boolean => {
    let joined = '';
    for (const line of lines.map(entry => entry.replace(/\s+/gu, ' ').trim()).filter(Boolean)) joined = !joined ? line : /[-‐–—/]$/u.test(joined) ? joined + line : `${joined} ${line}`;
    return joined !== source.replace(/\s+/gu, ' ').trim();
  };
  // LH-165: icon cards. A slide's lone list (the body's only block, in a layout region or not) of ICON_CARD_MIN to ICON_CARD_MAX entries of
  // one level, every one with an icon that resolves, a short label and at most a short description, draws as a grid of equal cards that
  // take the list's area (cardGridColumns: two to four a row, balanced), as Claude Design draws a set of features or an agenda with icons:
  // in each card the icon's chip (ICON_CHIP times the list size) at the top start (the right in a right-to-left deck), the label bold
  // under it and the description under that at ICON_CARD_DESCRIPTION of the label's size; or, where that lets the text grow more (wide,
  // short cards), the chip beside the label. The cards keep the list's order; a numbered list, or an agenda's list (iconAgendas), draws
  // each number as a numeral at the top end of its card (LH-134's numeral, which a PPTX import gives back to a numbered list). The text
  // starts at the size the list has and grows by steps of the type scale (to LH-05's COMPACT_GRID_DISPLAY) while every card holds its
  // text without a split word and the tallest card's text takes at most ICON_CARD_FILL of its card or the text covers at most LONE_TARGET
  // of the body (LH-48's fill), whichever lets it grow further; the grid
  // and the chip's place are those at which it is largest (then with the fewest lines). The tops of the cards' text line up: the tallest
  // sits in the middle of its card. When no grid holds the list at its size, it stays the list it was; the guard (DRAWING_RULES, and
  // composeSlide without steps) keeps the cards only when no text of the slide is smaller than without them.
  const cardLists = new Set<string>();
  // Wave 8, LH-18 with LH-165: the cards of a row share their label track, as sibling pillars do (alignHeadingTracks): every card of the row
  // reserves the height of its tallest label, so the descriptions start on one line and the row reads as one. Text keeps its size; a row
  // whose shared track would not fit its cards keeps its own labels' heights. Placement only, under `heading-tracks`.
  const sharedLabelTracks = <Card extends { labelHeight: number; height: number; inner: LayoutBox }>(laid: Card[], columns: number, again: (index: number, track: number) => Card | undefined): Card[] => {
    if (!ruleOn('heading-tracks')) return laid;
    let moved = false;
    const tracked = laid.map((card, index) => {
      const row = Math.floor(index / columns), track = Math.max(...laid.slice(row * columns, (row + 1) * columns).map(other => other.labelHeight));
      if (track - card.labelHeight <= .5) return card;
      const next = again(index, track);
      if (!next || next.height > next.inner.height + 1e-6) return card;
      moved = true;
      return next;
    });
    if (moved) fire('heading-tracks');
    return tracked;
  };
  const iconCards = (): ComposedSteps | undefined => {
    if (!ruleOn('icon-cards') || (options as Record<symbol, unknown>)[LAYOUT_MASTER] === true || surface) return undefined;
    const body = items.filter(item => !headings.has(item.field) && !item.eyebrow);
    const item = body.length === 1 ? body[0]! : undefined;
    if (!item || item.field !== 'items' || item.listColumns || item.caption || item.frameBox || item.emphasis || stepFlows.has(item.path) || !item.text || !('listEntries' in item.text)) return undefined;
    const values = Array.isArray(item.value) ? item.value as ListValue[] : [];
    if (values.length < ICON_CARD_MIN || values.length > ICON_CARD_MAX) return undefined;
    const entries = values.map(value => {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
      const object = record(value), label = flatten(object.text).trim(), description = object.description === undefined ? undefined : flatten(object.description).trim();
      const short = !!label && [...label].length <= ICON_CARD_LABEL_CHARACTERS && proseWords(label).length <= ICON_CARD_LABEL_WORDS && !/[\r\n]/u.test(label);
      return (object.level ?? 0) === 0 && resolvedIcon(object.icon) && short && (description === undefined || (!!description && [...description].length <= ICON_CARD_DESCRIPTION_CHARACTERS)) ? { object, label, description } : undefined;
    });
    if (entries.some(entry => !entry)) return undefined;
    const numbers = item.payload.numbering !== undefined ? listNumbers(values, item.payload.numbering as NumberingInput) : undefined, agenda = iconAgendas.get(item.path);
    const numeralOf = (index: number): string | undefined => {
      const label = numbers ? listNumberLabel(numbers[index]!) : agenda !== undefined ? String(agenda + index) : undefined;
      return label !== undefined && /^[0-9]$/u.test(label) ? `0${label}` : label;
    };
    const style = styleFor(item.field, item.path), base = richOptions(style), numeralStyle: TextStyle = { ...style, path: undefined, fontWeight: 700, italic: false };
    const runs = (value: unknown): (string | RichTextRun)[] => typeof value === 'string' ? [value] : value as (string | RichTextRun)[];
    const start = (item.text as ListFit).fontSize, area = cardArea(item), count = values.length;
    // Where a card's chip stands: `top`, above the label, the text across the card; `beside`, in a column before the label and its
    // description; `inline`, before the label, the description under both across the card (a short label in a narrow card).
    // `track`: the label height the card reserves (LH-18's shared heading track: the tallest label of its row), so a row's descriptions start on one line.
    const lay = (index: number, cell: LayoutBox, size: number, placement: 'top' | 'beside' | 'inline', track = 0) => {
      const { object, label, description } = entries[index]!, inner = cardInner(cell), chip = ICON_CHIP * size, numeral = numeralOf(index), top = placement === 'top';
      const numeralLine = numeral !== undefined ? richTextLayouter([numeral], { x: 0, y: 0, width: 1e6, height: 1e6 }, size, { ...base, style: numeralStyle }, 0)(size).richLines[0] : undefined, numeralWidth = numeralLine?.width ?? 0;
      // The label's column: across the card under the chip, or after the chip (and before a numeral at the top end).
      const indent = top ? 0 : chip + .5 * size, width = inner.width - indent - (!top && numeralLine ? numeralWidth + .5 * size : 0);
      if (width < 4 * size || (top && numeralLine && chip + numeralWidth + .5 * size > inner.width)) return undefined;
      const x = rtl ? inner.x + inner.width - indent - width : inner.x + indent, small = Math.max(size * ICON_CARD_DESCRIPTION, minSize);
      const below = placement === 'inline' ? { x: inner.x, width: inner.width } : { x, width };
      const textPath = `${item.path}.${index}.text`, descriptionPath = `${item.path}.${index}.description`, labelStyle: TextStyle = { ...style, path: textPath, fontWeight: 700 };
      const labelAt = (y: number) => richTextLayouter(runs(object.text), { x, y, width, height: inner.height }, size, { ...base, style: labelStyle }, size)(size);
      // The chip's center sits on the label's first line (0.35 em above its baseline) beside it.
      const center = (labelAt(0).richLines[0]?.baseline ?? size) - .35 * size;
      const at = (y: number) => {
        const textBox = { x, y, width, height: inner.height }, text = labelAt(y);
        textBox.height = text.height;
        let descriptionBox: LayoutBox | undefined, descriptionFit: RichTextFit | undefined;
        if (object.description !== undefined) {
          const labelHeight = Math.max(text.height, track);
          descriptionBox = { ...below, y: (placement === 'inline' ? Math.max(y + labelHeight, y + center + chip / 2) : y + labelHeight) + .25 * size, height: inner.height };
          descriptionFit = richTextLayouter(runs(object.description), descriptionBox, small, { ...base, style: { ...style, path: descriptionPath } }, small)(small);
          descriptionBox.height = descriptionFit.height;
        }
        return { text, textBox, description: descriptionFit, descriptionBox, bottom: descriptionBox ? descriptionBox.y + descriptionBox.height : y + text.height };
      };
      const probe = at(0);
      // On top: the chip and ICON_CHIP_GAP of it above the label. Beside it: the chip centered on the label's first line, the text lower by what the chip needs above it.
      const lift = top ? chip * (1 + ICON_CHIP_GAP) : Math.max(0, chip / 2 - center);
      const height = top ? lift + probe.bottom : Math.max(lift + probe.bottom, lift + center + chip / 2);
      const lines = probe.text.richLines.length + (probe.description?.richLines.length ?? 0), labelLines = probe.text.richLines.length, labelWords = proseWords(label).length;
      const bad = probe.text.overflow || !!probe.description?.overflow || splitsWord(label, probe.text.lines) || (description !== undefined && !!probe.description && splitsWord(description, probe.description.lines));
      const place = (start: number): { column: ComposedListColumn; badge?: ComposedStepBadge } => {
        const placed = at(start + lift), cy = top ? start + chip / 2 : start + lift + center, cx = rtl ? inner.x + inner.width - chip / 2 : inner.x + chip / 2;
        const marker = { text: '', x: rtl ? x + width : x, y: placed.textBox.y + (placed.text.richLines[0]?.baseline ?? size), fontSize: size, style: resolveTextStyle(labelStyle, options.textMeasurement), indent: 0, none: true as const, ...(rtl ? { anchor: 'end' as const } : {}) };
        const direction = rtl ? paragraphDirection(label, 'rtl') : undefined;
        const entry: ListEntryLayout = { index, level: 0, value: object.text as ListText, ...(object.description !== undefined ? { descriptionValue: object.description as ListText } : {}), textPath, descriptionPath, text: placed.text, textBox: placed.textBox,
          ...(placed.description && placed.descriptionBox ? { description: placed.description, descriptionBox: placed.descriptionBox } : {}), marker, icon: { cx, cy, diameter: chip }, ...(direction ? { direction } : {}) };
        const directions = [...(placed.text.directions ?? []), ...(placed.description?.directions ?? [])];
        const text: ListFit = { listEntries: [entry], lines: [...placed.text.lines, ...(placed.description?.lines ?? [])], fontSize: size, lineHeight: size * 1.22, height: placed.bottom - placed.textBox.y, overflow: false, ...(rtl ? { directions } : {}) };
        let badge: ComposedStepBadge | undefined;
        if (numeral !== undefined && numeralLine) {
          const left = rtl ? inner.x : inner.x + inner.width - numeralWidth, baseline = cy + .35 * size, number = numbers?.[index];
          badge = { path: textPath, cx: left + numeralWidth / 2, cy, radius: numeralWidth / 2, label: numeral, fontSize: size, baseline, numeral: { x: left, y: baseline - numeralLine.baseline, width: numeralWidth, height: numeralLine.height },
            ...(number ? { list: { path: item.path, index, number: { value: number.value, style: number.style, suffix: number.suffix } } } : {}) };
        }
        return { column: { box: inner, start: index, end: index + 1, text }, ...(badge ? { badge } : {}) };
      };
      return { height, lines, labelLines, labelWords, labelHeight: probe.text.height, bad, inner, place };
    };
    let best: { size: number; lines: number; columns: number; placement: 'top' | 'beside' | 'inline' } | undefined;
    for (const columns of cardGridColumns(count)) {
      const cells = cardGridCells(count, columns, area);
      for (const placement of ['top', 'beside', 'inline'] as const) {
        if (placement === 'inline' && entries.every(entry => entry!.description === undefined)) continue;
        let kept: { size: number; lines: number } | undefined, labelLines: number[] | undefined;
        for (const size of cardSizes(start, Math.max(start, COMPACT_GRID_DISPLAY * scale))) {
          const laid = cells.map((cell, index) => lay(index, cell, size, placement));
          if (laid.some(card => !card || card.bad || card.height > card.inner.height + 1e-6)) break;
          // Growing never breaks a label onto more lines than it has at the size the list had, but a label of three words or more may take
          // two (a two-word label stays on one line, so no line holds a lone word of it).
          if (labelLines && laid.some((card, index) => card!.labelLines > Math.max(labelLines![index]!, card!.labelWords >= 3 ? 2 : 1))) break;
          labelLines ??= laid.map(card => card!.labelLines);
          if (size > start + 1e-9 && Math.max(...laid.map(card => card!.height / card!.inner.height)) > ICON_CARD_FILL + 1e-6 && gridFill(laid.map(card => card!.height), columns, area) > LONE_TARGET + 1e-6) break;
          kept = { size, lines: laid.reduce((sum, card) => sum + card!.lines, 0) };
        }
        if (kept && (!best || kept.size > best.size + 1e-9 || (kept.size > best.size - 1e-9 && kept.lines < best.lines))) best = { ...kept, columns, placement };
      }
    }
    if (!best) return undefined;
    const chosen = best, cells = cardGridCells(count, chosen.columns, area), laid = sharedLabelTracks(cells.map((cell, index) => lay(index, cell, chosen.size, chosen.placement)!), chosen.columns, (index, track) => lay(index, cells[index]!, chosen.size, chosen.placement, track));
    const offset = (laid[0]!.inner.height - Math.max(...laid.map(card => card.height))) / 2;
    const chips: NonNullable<ComposedSteps['chips']> = [], badges: ComposedStepBadge[] = [], fits: ComposedListColumn[] = [];
    laid.forEach((card, index) => {
      const { column, badge } = card.place(card.inner.y + offset);
      fits.push(column);
      if (badge) badges.push(badge);
      chips.push({ path: `${item.path}.${index}.text`, box: cells[index]!, radius: CARD_RADIUS * scale });
    });
    cardGrid = true;
    cardLists.add(item.path);
    item.listColumns = fits;
    item.text = mergeListColumns(fits);
    item.box = { ...area };
    item.alignment = rtl ? 'right' : 'left';
    return { form: 'tiles', region: item.region ?? '', path: item.path, badges, chips, lineWidth: 2 * scale };
  };
  // LH-162: text tiles. TEXT_TILE_MIN to TEXT_TILE_MAX short paragraphs that are the whole body of an automatic slide (blocks at its root:
  // a grid of short texts, which LH-05's compact grid hugs) draw as tiles, as Claude Design draws a set of lessons or principles: one card
  // each in the same grid as LH-165's icon cards, a dot in the accent (TEXT_TILE_MARKER of the text size) at the start of the text's first
  // line, the text beside it in the middle of its tile on at most TEXT_TILE_LINES lines. The texts start at the size they share and grow
  // by steps of the type scale up to LH-05's compact-grid display size (COMPACT_GRID_DISPLAY) while they cover at most LONE_TARGET of the
  // body (gridFill, LH-48's fill: one line of a short text fills little of its tile); the grid is the one where they are largest (then on
  // the fewest lines). Held by the same guard as icon cards.
  const textTiles = (): ComposedSteps | undefined => {
    if (!ruleOn('text-tiles') || useTemplate || (options as Record<symbol, unknown>)[LAYOUT_MASTER] === true || surface) return undefined;
    const body = items.filter(item => !headings.has(item.field));
    if (body.length < TEXT_TILE_MIN || body.length > TEXT_TILE_MAX || body.some(item => item.eyebrow)) return undefined;
    const root = new RegExp(`^${path.replace(/\./gu, '\\.')}\\.blocks\\.\\d+(?:\\.text)?$`, 'u');
    if (!body.every(item => item.field === 'text' && root.test(item.path) && item.text && item.caption === undefined && !item.frameBox && !item.emphasis)) return undefined;
    const texts = body.map(item => flatten(item.value).trim());
    if (texts.some(text => !text || [...text].length > TEXT_TILE_CHARACTERS || /[\r\n]/u.test(text))) return undefined;
    const start = Math.min(...body.map(item => item.text!.fontSize)), area = cardArea(body[0]!), count = body.length, alignment = 'left' as const;
    const heightOf = (fit: TextFit | RichTextFit) => 'height' in fit && typeof fit.height === 'number' ? fit.height : Math.max(fit.lines.length * fit.lineHeight, fit.placement?.height ?? 0);
    const lay = (index: number, cell: LayoutBox, size: number) => {
      const item = body[index]!, inner = cardInner(cell), dot = TEXT_TILE_MARKER * size, indent = dot + .6 * size, width = inner.width - indent;
      if (width < 4 * size) return undefined;
      const x = rtl ? inner.x : inner.x + indent, fitAt = (y: number, height: number) => fitPlacedText('text', item.value, texts[index]!, { x, y, width, height }, size, size, item.path, alignment);
      const probe = fitAt(inner.y, inner.height), height = heightOf(probe), lines = probe.lines.length;
      const bad = probe.overflow || probe.fontSize < size - FONT_GRID_EPSILON || lines > TEXT_TILE_LINES || splitsWord(texts[index]!, probe.lines);
      const place = (): ComposedStepBadge => {
        const top = inner.y + (inner.height - height) / 2, box = { x, y: top, width, height: Math.min(height + scale, inner.height) }, fit = fitAt(box.y, box.height);
        item.box = box;
        item.text = fit;
        item.alignment = alignment;
        const first = 'richLines' in fit ? (fit as RichTextFit).richLines[0]?.baseline : fit.placement?.lines[0]?.baseline;
        const cy = first !== undefined ? first - .35 * size : top + fit.lineHeight / 2, cx = rtl ? inner.x + inner.width - dot / 2 : inner.x + dot / 2;
        return { path: item.path, cx, cy, radius: dot / 2, label: '', fontSize: size, baseline: cy + .35 * size };
      };
      return { height, lines, bad, inner, place };
    };
    let best: { size: number; lines: number; columns: number } | undefined;
    for (const columns of cardGridColumns(count)) {
      const cells = cardGridCells(count, columns, area);
      let kept: { size: number; lines: number } | undefined;
      for (const size of cardSizes(start, Math.max(start, COMPACT_GRID_DISPLAY * scale))) {
        const laid = cells.map((cell, index) => lay(index, cell, size));
        if (laid.some(tile => !tile || tile.bad || tile.height > tile.inner.height + 1e-6)) break;
        if (size > start + 1e-9 && gridFill(laid.map(tile => tile!.height), columns, area) > LONE_TARGET + 1e-6) break;
        kept = { size, lines: laid.reduce((sum, tile) => sum + tile!.lines, 0) };
      }
      if (kept && (!best || kept.size > best.size + 1e-9 || (kept.size > best.size - 1e-9 && kept.lines < best.lines))) best = { ...kept, columns };
    }
    if (!best) return undefined;
    const chosen = best, cells = cardGridCells(count, chosen.columns, area), badges = cells.map((cell, index) => lay(index, cell, chosen.size)!.place());
    cardGrid = true;
    return { form: 'tiles', region: '', path: body[0]!.path, badges, chips: cells.map((box, index) => ({ path: body[index]!.path, box, radius: CARD_RADIUS * scale })), lineWidth: 2 * scale };
  };
  // LH-165: a set of groups as icon cards. ICON_CARD_MIN to ICON_CARD_MAX groups that are the whole body (blocks at the slide's root), each
  // with an icon that resolves and one short label paragraph, optionally followed by one description paragraph (a feature set written as
  // groups), draw as icon cards as a list does (iconCards): the chip at the top start, beside the label or inline with it, the label bold
  // (not the eyebrow LH-152 sets over a group's paragraph) and the description under it, both at the size the description has (the
  // label is not body text as an eyebrow, so it never sets anything smaller), growing as icon cards do.
  const groupCards = (): ComposedSteps | undefined => {
    if (!ruleOn('icon-cards') || (options as Record<symbol, unknown>)[LAYOUT_MASTER] === true || surface || !Array.isArray(slide.blocks)) return undefined;
    const blocks = slide.blocks as unknown[], count = blocks.length;
    if (count < ICON_CARD_MIN || count > ICON_CARD_MAX) return undefined;
    const body = items.filter(item => !headings.has(item.field) && !item.eyebrow);
    const groups = blocks.map((block, index) => {
      const own = record(block), children = Array.isArray(own.blocks) ? own.blocks.map(record) : [], at = `${path}.blocks.${index}`;
      if (!resolvedIcon(own.icon) || own.emphasis !== undefined || children.length < 1 || children.length > 2 || children.some(child => Object.keys(child).some(key => key !== 'text' && key !== 'id') || child.text === undefined)) return undefined;
      const label = flatten(children[0]!.text).trim(), description = children[1] ? flatten(children[1].text).trim() : undefined;
      if (!label || [...label].length > ICON_CARD_LABEL_CHARACTERS || proseWords(label).length > ICON_CARD_LABEL_WORDS || /[\r\n]/u.test(label) || (description !== undefined && (!description || [...description].length > ICON_CARD_DESCRIPTION_CHARACTERS))) return undefined;
      const labelPath = `${at}.blocks.0.text`, descriptionPath = `${at}.blocks.1.text`;
      const labelItem = body.find(item => item.path === labelPath), descriptionItem = body.find(item => item.path === descriptionPath), brow = groupEyebrows.find(entry => entry.eyebrow.path === labelPath);
      // The label may be drawn as the group's eyebrow (LH-152) or as its paragraph's (LH-50).
      const paragraphBrow = descriptionItem && eyebrowsOf.get(descriptionItem)?.path === labelPath;
      if ((!labelItem && !brow && !paragraphBrow) || (description !== undefined && !descriptionItem)) return undefined;
      return { at, icon: resolvedIcon(own.icon)!, label, labelValue: children[0]!.text, labelPath, labelItem, brow, description, descriptionItem };
    });
    if (groups.some(group => !group)) return undefined;
    const members = new Set(groups.flatMap(group => [group!.labelItem, group!.descriptionItem].filter(item => item !== undefined)));
    if (body.length !== members.size || body.some(item => !members.has(item) || item.field !== 'text' || item.caption !== undefined || item.frameBox || item.emphasis)) return undefined;
    const sized = body.filter(item => item.text).map(item => item.text!.fontSize);
    if (!sized.length) return undefined;
    const start = Math.min(...sized), area = cardArea(body[0]!), alignment = 'left' as const;
    for (const group of groups) boldLabels.add(group!.labelPath);
    const heightOf = (fit: TextFit | RichTextFit) => 'height' in fit && typeof fit.height === 'number' ? fit.height : Math.max(fit.lines.length * fit.lineHeight, fit.placement?.height ?? 0);
    const firstBaseline = (fit: TextFit | RichTextFit, top: number, size: number) => ('richLines' in fit ? (fit as RichTextFit).richLines[0]?.baseline : fit.placement?.lines[0]?.baseline) ?? top + .8 * size;
    const lay = (index: number, cell: LayoutBox, size: number, placement: 'top' | 'beside' | 'inline', track = 0) => {
      const group = groups[index]!, inner = cardInner(cell), chip = ICON_CHIP * size, top = placement === 'top', indent = top ? 0 : chip + .5 * size, width = inner.width - indent;
      if (width < 4 * size) return undefined;
      const x = rtl ? inner.x : inner.x + indent, below = placement === 'inline' ? { x: inner.x, width: inner.width } : { x, width };
      const fitLabel = (y: number) => fitPlacedText('text', group.labelValue, group.label, { x, y, width, height: inner.height }, size, size, group.labelPath, alignment);
      const fitDescription = (y: number) => group.descriptionItem ? fitPlacedText('text', group.descriptionItem.value, group.description!, { ...below, y, height: inner.height }, size, size, group.descriptionItem.path, alignment) : undefined;
      const center = firstBaseline(fitLabel(0), 0, size) - .35 * size;
      const at = (y: number) => {
        const label = fitLabel(y), labelHeight = heightOf(label), reserved = Math.max(labelHeight, track), next = (placement === 'inline' ? Math.max(y + reserved, y + center + chip / 2) : y + reserved) + .25 * size, description = fitDescription(next);
        return { label, labelHeight, description, next, bottom: description ? next + heightOf(description) : y + labelHeight };
      };
      const probe = at(0), lift = top ? chip * (1 + ICON_CHIP_GAP) : Math.max(0, chip / 2 - center);
      const height = top ? lift + probe.bottom : Math.max(lift + probe.bottom, lift + center + chip / 2);
      const lines = probe.label.lines.length + (probe.description?.lines.length ?? 0), labelLines = probe.label.lines.length, labelWords = proseWords(group.label).length;
      const bad = probe.label.overflow || probe.label.fontSize < size - FONT_GRID_EPSILON || splitsWord(group.label, probe.label.lines) || !!(probe.description && (probe.description.overflow || probe.description.fontSize < size - FONT_GRID_EPSILON || splitsWord(group.description!, probe.description.lines) || underMeasure('text', group.descriptionItem!.value, below.width, size)));
      const place = (begin: number) => {
        const placed = at(begin + lift), cy = top ? begin + chip / 2 : begin + lift + center, cx = rtl ? inner.x + inner.width - chip / 2 : inner.x + chip / 2;
        const labelBox = { x, y: begin + lift, width, height: placed.labelHeight };
        const descriptionBox = placed.description ? { ...below, y: placed.next, height: heightOf(placed.description) } : undefined;
        return { labelBox, label: fitPlacedText('text', group.labelValue, group.label, { ...labelBox, height: labelBox.height + scale }, size, size, group.labelPath, alignment),
          descriptionBox, description: descriptionBox ? fitDescription(descriptionBox.y) : undefined, cx, cy };
      };
      return { height, lines, labelLines, labelWords, labelHeight: probe.labelHeight, bad, inner, place };
    };
    let best: { size: number; lines: number; columns: number; placement: 'top' | 'beside' | 'inline' } | undefined;
    for (const columns of cardGridColumns(count)) {
      const cells = cardGridCells(count, columns, area);
      for (const placement of ['top', 'beside', 'inline'] as const) {
        if (placement === 'inline' && groups.every(group => group!.description === undefined)) continue;
        let kept: { size: number; lines: number } | undefined, labelLines: number[] | undefined;
        for (const size of cardSizes(start, Math.max(start, COMPACT_GRID_DISPLAY * scale))) {
          const laid = cells.map((cell, index) => lay(index, cell, size, placement));
          if (laid.some(card => !card || card.bad || card.height > card.inner.height + 1e-6)) break;
          // Growing never breaks a label onto more lines than it has at the size the list had, but a label of three words or more may take
          // two (a two-word label stays on one line, so no line holds a lone word of it).
          if (labelLines && laid.some((card, index) => card!.labelLines > Math.max(labelLines![index]!, card!.labelWords >= 3 ? 2 : 1))) break;
          labelLines ??= laid.map(card => card!.labelLines);
          if (size > start + 1e-9 && Math.max(...laid.map(card => card!.height / card!.inner.height)) > ICON_CARD_FILL + 1e-6 && gridFill(laid.map(card => card!.height), columns, area) > LONE_TARGET + 1e-6) break;
          kept = { size, lines: laid.reduce((sum, card) => sum + card!.lines, 0) };
        }
        if (kept && (!best || kept.size > best.size + 1e-9 || (kept.size > best.size - 1e-9 && kept.lines < best.lines))) best = { ...kept, columns, placement };
      }
    }
    if (!best) { for (const group of groups) boldLabels.delete(group!.labelPath); return undefined; }
    const chosen = best, cells = cardGridCells(count, chosen.columns, area), laid = sharedLabelTracks(cells.map((cell, index) => lay(index, cell, chosen.size, chosen.placement)!), chosen.columns, (index, track) => lay(index, cells[index]!, chosen.size, chosen.placement, track));
    const offset = (laid[0]!.inner.height - Math.max(...laid.map(card => card.height))) / 2, chipSize = ICON_CHIP * chosen.size;
    laid.forEach((card, index) => {
      const group = groups[index]!, placed = card.place(card.inner.y + offset), owner = group.descriptionItem ?? group.labelItem!;
      // The label is a paragraph of the card: the eyebrow LH-152 would draw over the group is not drawn, and a label drawn as text takes its new place.
      if (group.brow) groupEyebrows.splice(groupEyebrows.indexOf(group.brow), 1);
      if (group.descriptionItem) eyebrowsOf.delete(group.descriptionItem);
      const label: ComposedItem = group.labelItem ?? { path: group.labelPath, field: 'text', type: 'text', value: group.labelValue, payload: { type: 'text', text: group.labelValue }, box: placed.labelBox, composition: owner.composition, alignment, ...(owner.region !== undefined ? { region: owner.region } : {}) };
      Object.assign(label, { box: placed.labelBox, text: placed.label, textStyle: styleFor('text', group.labelPath), alignment });
      if (!group.labelItem) items.splice(items.indexOf(owner), 0, label);
      if (group.descriptionItem && placed.descriptionBox && placed.description) Object.assign(group.descriptionItem, { box: placed.descriptionBox, text: placed.description, alignment });
      for (let at = pendingIcons.length - 1; at >= 0; at--) if (pendingIcons[at]!.owner === group.at) pendingIcons.splice(at, 1);
      pendingIcons.push({ path: `${group.at}.icon`, owner: group.at, icon: group.icon, members: [label], diameter: chipSize, card: { cx: placed.cx, cy: placed.cy } });
    });
    cardGrid = true;
    return { form: 'tiles', region: '', path: groups[0]!.at, badges: [], chips: cells.map((box, index) => ({ path: groups[index]!.at, box, radius: CARD_RADIUS * scale })), lineWidth: 2 * scale };
  };
  const cardGrids = tiles ? undefined : iconCards() ?? groupCards() ?? textTiles();
  if (cardGrids) steps.push(cardGrids);
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
  // LH-152: each group's eyebrow over the span its items finally cover (their cards included), in the band the group left above them.
  // LH-131 with LH-152: a group drawn on one card of its own takes its eyebrow inside that card, over its blocks' boxes, with the card's
  // frame (or the emphasis surface) as its backdrop, as a paragraph's eyebrow on a card does.
  for (const { members, eyebrow, size, band, carded } of groupEyebrows) {
    const placedMembers = members.filter(item => items.includes(item));
    if (!placedMembers.length) continue;
    const at = Math.min(...placedMembers.map(item => items.indexOf(item))), outer = placedMembers.map(item => carded ? item.box : item.frameBox ?? item.box);
    const x = Math.min(...outer.map(box => box.x)), right = Math.max(...outer.map(box => box.x + box.width)), top = Math.min(...outer.map(box => box.y));
    const box = { x, y: top - band, width: right - x, height: band - gap * EYEBROW_GAP }, alignment = alignmentFor('text'), fit = fitEyebrow(eyebrow, box, size, alignment), lead = items[at]!;
    items.splice(at, 0, { path: eyebrow.path, field: 'text', type: 'text', value: eyebrow.value, payload: { type: 'text', text: eyebrow.value }, box, text: fit, textStyle: styleFor('text', eyebrow.path), composition: lead.composition, alignment,
      eyebrow: true, ...(lead.region !== undefined ? { region: lead.region } : {}), ...(carded && lead.frameBox ? { frameBox: lead.frameBox } : {}), ...(carded && lead.emphasis ? { emphasis: true as const } : {}) });
  }
  // LH-14: the icons, over the items' final boxes. A list entry's chip is the one fitList placed in its marker column; a metric's sits
  // above its visible parts, by the metric's alignment (centered, or at the start of a start-aligned metric); a group's sits at the start
  // edge (the right in a right-to-left deck) above its items' span and its eyebrow band, inside a group drawn on one card of its own. The
  // chip is a light tint of the primary with the glyph in the primary; on a dark slide or the emphasis surface the inverse (iconColors).
  const icons: ComposedIcon[] = [];
  const iconRoles = options.roles ?? resolveColorRoles({}, { tone: options.darkBackground ? 'dark' : 'light' });
  const slideDark = options.darkBackground === true;
  const addIcon = (path: string, owner: string, icon: ResolvedIcon, cx: number, cy: number, diameter: number, onSurface: boolean) => {
    const side = icon.picture ? diameter : diameter * ICON_GLYPH, box = roundBox({ x: cx - side / 2, y: cy - side / 2, width: side, height: side }), unit = side / ICON_VIEWBOX;
    icons.push({ path, owner, reference: icon.reference, chip: { cx: round(cx), cy: round(cy), radius: round(diameter / 2) }, box,
      ...(icon.parts ? { parts: icon.parts.map(part => ({ ...part, commands: placeIconCommands(part.commands, box), ...(part.stroke !== undefined ? { stroke: round(part.stroke * unit) } : {}) })) } : {}),
      ...(icon.picture ? { picture: icon.picture } : {}), colors: iconColors(iconRoles, onSurface ? !slideDark : slideDark) });
  };
  for (const item of items) {
    const fit = item.text as ListFit | undefined;
    if ((item.field !== 'items') || !fit || !('listEntries' in fit)) continue;
    const values = Array.isArray(item.value) ? item.value : [];
    for (const entry of fit.listEntries) {
      if (!entry.icon) continue;
      // LH-165: an icon card's chip is drawn with or without the rule `icons` (resolvedIcon), solid in the primary with the glyph in the color
      // that reads on it (iconColors' dark pair) on light and dark slides alike: a light tint would barely show on the card surface.
      const card = cardLists.has(item.path), icon = (card ? resolvedIcon : iconFor)(record(values[entry.index]).icon);
      if (icon) addIcon(`${item.path}.${entry.index}.icon`, `${item.path}.${entry.index}`, icon, entry.icon.cx, entry.icon.cy, entry.icon.diameter, card ? !slideDark : item.emphasis === true);
    }
  }
  for (const pending of pendingIcons) {
    const placed = pending.members.filter(item => items.includes(item));
    if (!placed.length) continue;
    const r = pending.diameter / 2, lift = pending.diameter * ICON_CHIP_GAP;
    if (pending.card) { addIcon(pending.path, pending.owner, pending.icon, pending.card.cx, pending.card.cy, pending.diameter, !slideDark); continue; }
    if (pending.metric) {
      const item = placed[0]!, parts = (item.metricLayout?.parts ?? []).filter(part => part.visible && part.fit), area = parts.length ? parts.map(part => part.box) : [item.box];
      const left = Math.min(...area.map(box => box.x)), right = Math.max(...area.map(box => box.x + box.width)), top = Math.min(...area.map(box => box.y));
      const align = item.metricLayout?.alignment ?? item.alignment ?? 'center';
      const cx = align === 'left' ? left + r : align === 'right' ? right - r : (left + right) / 2;
      addIcon(pending.path, pending.owner, pending.icon, cx, top - lift - r, pending.diameter, item.emphasis === true);
      continue;
    }
    // The group's items and the eyebrows drawn over them (its own, LH-152, and its paragraphs', LH-50), which sit in the bands above them.
    const under = items.filter(item => placed.includes(item) || (item.eyebrow && item.path.startsWith(`${pending.owner}.`)));
    const outer = under.map(item => pending.carded ? item.box : item.frameBox ?? item.box);
    const left = Math.min(...outer.map(box => box.x)), right = Math.max(...outer.map(box => box.x + box.width)), top = Math.min(...outer.map(box => box.y));
    addIcon(pending.path, pending.owner, pending.icon, rtl ? right - r : left + r, top - lift - r, pending.diameter, placed.some(item => item.emphasis === true));
  }
  // Every icon of the slide that resolves and is not drawn: the guard turned the chips off (no room without setting text smaller), or it
  // marks something icons do not draw on (a nested or numbered entry). The text stays; the finding says why the chip is missing.
  const iconDiagnostics: LayoutDiagnostic[] = [], drawnIcons = new Set(icons.map(icon => icon.path));
  for (const found of documentIcons(slide)) {
    const at = path + found.path.slice('slide'.length), value = found.value;
    if (drawnIcons.has(at) || !resolveIcon(options.presentation ?? {}, value).ok) continue;
    iconDiagnostics.push({ code: 'icon-dropped', path: at, message: ruleOn('icons')
      ? 'The icon is not drawn: icons draw on the first-level entries of an unnumbered list, on metrics and on groups, and this one marks none of them here.'
      : 'The icon is not drawn: the slide has no room for its chip without setting text smaller. The text keeps its size.' });
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
    else if (item.text?.overflow && item.field !== 'shape') diagnostics.push({ code: "text-overflow", path: item.path, message: "Text exceeds its cell at the minimum font size; shorten it, increase its space, or split the slide." });
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
  diagnostics.push(...imageDiagnostics, ...numberingDiagnostics, ...iconDiagnostics);
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
  // LH-131: a before and after pair of metrics, its cards side by side, draws an arrow from the first card to the featured one in the
  // middle of the room between them (PAIR_ARROW_WIDTH by PAIR_ARROW_HEIGHT, PAIR_ARROW_MARGIN of a gap from each card). When the cards
  // stand closer, the slide is composed again with each card that much narrower on its inner side (PAIR_ROOM), kept only when no block
  // reads smaller and nothing more overflows; otherwise the pair has no arrow.
  let pairArrow: ComposedEmphasis['arrow'], pairNeed: Map<string, { side: 'left' | 'right'; width: number }> | undefined;
  if (featured?.kind === 'before-after' && surface?.source === 'featured' && featuredPath !== undefined) {
    const siblingPath = `${path}.blocks.${featured.cells.find(index => index !== featured.featured)}`, under = (prefix: string) => (item: ComposedItem) => item.path.startsWith(`${prefix}.`);
    const card = items.find(item => under(siblingPath)(item) && item.frameBox)?.frameBox, after = surface.box;
    if (card && items.some(item => under(siblingPath)(item) && item.metricLayout) && items.some(item => under(featuredPath)(item) && item.metricLayout)) {
      const top = Math.max(card.y, after.y), bottom = Math.min(card.y + card.height, after.y + after.height), rightward = after.x >= card.x + card.width - .5;
      const separation = rightward ? after.x - (card.x + card.width) : card.x - (after.x + after.width);
      const arrowWidth = PAIR_ARROW_WIDTH * scale, arrowHeight = PAIR_ARROW_HEIGHT * scale, need = arrowWidth + 2 * PAIR_ARROW_MARGIN * gap;
      if (bottom - top >= Math.min(card.height, after.height) / 2 && separation >= -.5 && (rightward || after.x + after.width <= card.x + .5)) {
        if (separation >= need - .5) {
          const left = rightward ? card.x + card.width : after.x + after.width;
          pairArrow = { box: roundBox({ x: left + (separation - arrowWidth) / 2, y: (top + bottom - arrowHeight) / 2, width: arrowWidth, height: arrowHeight }), direction: rightward ? 'right' : 'left' };
        } else if (!pairRoom) {
          const trim = (need - separation) / 2;
          pairNeed = new Map([[siblingPath, { side: rightward ? 'right' : 'left', width: trim }], [featuredPath, { side: rightward ? 'left' : 'right', width: trim }]]);
        }
      }
    }
  }
  if (surface && pairArrow) surface = { ...surface, arrow: pairArrow };
  const composed: SlideComposition = { width, height, contentBox, items, groups, flows, ...(useTemplate ? { regions: templateRegions, headingAreas } : {}), diagnostics, composition, design: hints, ...(furniture?{furniture}:{}), ...(backgroundImage?{backgroundImage}:{}), ...(logo?{logo}:{}), ...(rtl?{direction:'rtl' as const}:{}), ...(footnotes?{footnotes}:{}), ...(surface?{emphasis:surface}:{}), ...(steps.length?{steps}:{}),...(arrangements.length?{arrangements}:{}), ...(icons.length?{icons}:{}), ...(titleRule&&useTemplate?{titleRule}:{}), ...(pictureText&&useTemplate?{pictureText}:{}), ...(explanation?{explanation}:{}) };
  // LH-155 with LH-158: the low stack's text ink scored at the foot (where it is), the middle and the top of the content box; a stack that
  // reads better elsewhere (choosePictureText, the foot first) is composed again there.
  if (stackPlace) {
    const { room, alignment, input: sampling, keyed, explicit } = stackPlace, factor = { top: 0, middle: .5, bottom: 1 } as const;
    const inks = items.filter(item => item.text).map(item => {
      const ink = textInkBox(item, options.textMeasurement), side = physicalAlignment(item.alignment, paragraphDirection(annotationText(item.value), deckDirection));
      return { ...ink, x: side === item.alignment || side === 'center' ? ink.x : item.box.x + item.box.width - (ink.x - item.box.x) - ink.width };
    });
    const candidates = inks.length ? (() => {
      const x = Math.min(...inks.map(box => box.x)), y = Math.min(...inks.map(box => box.y)), ink = { x, y, width: Math.max(...inks.map(box => box.x + box.width)) - x, height: Math.max(...inks.map(box => box.y + box.height)) - y };
      return scorePictureText({ ...sampling, places: (['top', 'middle', 'bottom'] as const).map(anchor => ({ anchor, alignment, measure: contentBox.width, box: { ...ink, y: ink.y - room * (1 - factor[anchor]) } })) });
    })() : undefined;
    const pick = explicit || !candidates ? undefined : choosePictureText(candidates, { anchor: 'bottom', alignment }, ['bottom', 'middle', 'top']);
    const anchor: PictureTextAnchor = explicit ?? pick?.candidate.anchor ?? 'middle', scored = candidates?.find(candidate => candidate.anchor === anchor);
    const placed: PictureText = {
      placement: `${anchor}-${alignment}`, anchor, alignment, source: explicit && backgroundImage?.textPlacement === `${anchor}-${alignment}` ? 'authored' : 'measured',
      ...((explicit || !pick ? !keyed && !!scored && !scored.reads && (scored.scrim ?? 0) > 0 : pick.scrim) ? { scrim: true as const } : {}), candidates: candidates ?? [],
    };
    if (anchor !== 'bottom') return composeLayout(input, { ...options, [STACK_PLACE]: { anchor, pictureText: placed } } as ComposeSlideOptions);
    composed.pictureText = placed;
  }
  if (pairNeed) {
    const roomy = composeLayout(input, { ...options, [PAIR_ROOM]: pairNeed } as ComposeSlideOptions);
    if (roomy.emphasis?.arrow && overflowCount(roomy) <= overflowCount(composed) && !shrinks(roomy, composed, options)) return roomy;
  }
  if (atRequest) AT_REQUEST.add(composed);
  if (portraitFallback) PORTRAIT_FALLBACK.add(composed);
  // LH-149: the paragraphs and lists that shrank onto a half step of the scale, for the comparisons of arrangements (halfStepFloors).
  if (ruleOn('half-steps')) {
    const stepped = new Set<string>();
    let skipped = 0;
    items.forEach((item, position) => {
      if (item.eyebrow) { skipped++; return; }
      const start = bodyStarts.get(position - skipped), floorPx = item.composition.minFontSize ?? 16, size = item.text?.fontSize;
      if (start === undefined || size === undefined || item.listColumns || size >= start - FONT_GRID_EPSILON) return;
      if (Math.abs(typeScaleStep(size + 1e-6, floorPx, scale) - size) > 1e-6 && Math.abs(typeScaleStep(size + 1e-6, floorPx, scale, true) - size) < 1e-6) stepped.add(item.path);
    });
    if (stepped.size) (composed as unknown as Record<symbol, ReadonlySet<string>>)[HALF_STEPPED] = stepped;
  }
  if (leadItems.size) LEAD_STACKS.add(composed);
  if (regionMeasured) REGION_MEASURED.add(composed);
  if (compactGrid) COMPACT_GRIDS.add(composed);
  if (noteBand && surface?.source === 'foot-band') NOTE_BANDS.add(composed);
  if (cardGrid) CARD_GRIDS.add(composed);
  if (iconAgendas.size) ICON_AGENDAS.set(composed, iconAgendas);
  if (headingMessage) HEADING_MESSAGES.add(composed);
  if (template !== recordTemplate) STATEMENT_BODIES.add(composed);
  if (statement === 'title') STATEMENT_TITLES.add(composed);
  if (headingOffScale) HEADINGS_OFF_SCALE.add(composed);
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
export {groupNumber,groupsThousands,groupsAxisTicks,groupsDataRange,NUMBER_GROUPING_MIN,GROUPED_LABEL_CODE} from './number-grouping.js';
export {chartPlotInset,shareSiblingPlots} from './chart-plot.js';
export {horizontalBarPlot} from './chart-marks.js';
export {restackForRows,chartWaterfall,waterfallRoles,waterfallLabelText,waterfallSignedFormat,chartValueList,chartStack,placeStackNames,chartTitleReferences,placeReferences,refreshChartMarks,CHART_VALUE_LIST_MAX_ROWS,CHART_VALUE_LIST_SMALL_SLICE} from './chart-marks.js';
export type {WaterfallRole,ChartLayerWaterfall,ChartValueListRow,ChartValueListHole,ChartLayerValueList,ChartStackName,ChartStackEnd,ChartLayerStack,ChartReferenceLine,ChartReferenceBand,ChartLayerReferences} from './chart-marks.js';
export type {ChartPlotGeometry,SiblingPlotChart} from './chart-plot.js';
export {chartHistogram,histogramBins,scottBinCount,histogramEdgeDecimals,histogramEdgeFormat,HISTOGRAM_LABEL_SLOT,HISTOGRAM_MIN_BINS} from './chart-histogram.js';
export type {ChartLayerHistogram,HistogramBin} from './chart-histogram.js';
export {chartLayer,chartHeader,chartHeaderCaption,chartRingLabels,smallChart,chartLayerDataLabels,SMALL_CHART_MAX_SERIES,SMALL_CHART_MAX_POINTS,CHART_HEADER_MAX_LEGEND,CHART_HEADER_LEGEND_ROWS,chartValueAxisHidden} from './chart-layer.js';
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
export { FEATURED_LABEL_MAX_CHARACTERS, FEATURED_LABEL_MAX_WORDS, FEATURED_MARK_MAX_CHARACTERS, FEATURED_MAX_CELLS, featuredCells, type FeaturedCells, type FeaturedKind } from './featured-cards.js';
