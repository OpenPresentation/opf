export {
  presentation,
  audience,
  purpose,
  tone,
  theme,
  layout,
  chartType,
  narrative,
  socialPlatform,
  language,
  colorScheme,
  fontScheme,
  schemas,
  schemaEntries,
  schemaNames,
} from "./schemas.js";
export type { SchemaEntry } from "./schemas.js";

export {
  audiences,
  purposes,
  tones,
  themes,
  layouts,
  chartTypes,
  narratives,
  socialPlatforms,
  languages,
  colorSchemes,
  fontSchemes,
  catalogs,
  catalogEntries,
  catalogIndexes,
  catalogSchemaNames,
  catalogKinds,
} from "./catalogs.js";
export type {
  CatalogEntry,
  CatalogIndex,
  CatalogIndexRecord,
  CatalogRecord,
} from "./catalogs.js";

export {
  OPFValidationError,
  assertValid,
  assertValidCatalogRecord,
  assertValidPresentation,
  validate,
  validateCatalogRecord,
  validatePresentation,
} from "./validator.js";
export type { ValidateOptions } from "./validator.js";

export {
  VARIABLE_KINDS,
  DEFAULT_VARIABLE_DATE_FORMAT,
  OPFVariableError,
  coerceVariableValue,
  formatVariableNumber,
  hasContentVariables,
  isTemplate,
  listBuiltinVariables,
  listVariables,
  resolveVariables,
  variableDeclarations,
} from "./variables.js";
export type {
  ResolveVariablesOptions,
  ResolveVariablesResult,
  VariableDeclaration,
  VariableDiagnostic,
  VariableDiagnosticCode,
  VariableDiagnosticSeverity,
  BuiltinVariableInfo,
  VariableInfo,
  VariableKind,
  VariableUse,
  VariableUseForm,
  VariableValues,
} from "./variables.js";

export {
  specFileEntries,
  specFilePaths,
  specFileKinds,
} from "./spec-files.js";

export {
  layoutPreviews,
  layoutPreviewIndex,
  layoutPreviewSlugs,
  hasLayoutPreview,
  getLayoutPreview,
} from "./previews.js";
export type {
  LayoutPreviewRecord,
  LayoutPreviewIndex,
} from "./previews.js";

export type * from "./types.js";
export {lintPresentation, lintSource} from './lint.js';
export type {LintSeverity, LintLocation, LintSuggestion, LintDiagnostic, LintContract, LintOptions, LintReport} from './lint.js';
export {auditPresentation, auditSource, auditRules, findAuditRule, DEFAULT_AUDIT_THRESHOLDS, DEFAULT_CHART_PALETTE} from './audit.js';
export type {AuditSeverity, AuditCategory, AuditDiagnostic, AuditFix, AuditPatchOperation, AuditOptions, AuditReport, AuditRuleInfo, AuditThresholds} from './audit.js';
export type {
  SpecFileEntry,
  SpecFilePath,
  SpecFileKind,
} from "./spec-files.js";

export { composeSlide, resolveCanvasDimensions, fitText, wrapText, measureText, snapFontSizeDown, snapFontSizeUp, FONT_SIZE_GRID_PER_PX, resolveFontFamilies, resolveFontSchemeReference, DEFAULT_FONT_SCHEME, resolveTextStyle, textWidthMeasurer, layoutQuote, OPFCompositionError, MAX_COMPOSITION_DEPTH } from "./composition.js";
export {layoutFurniture,resolveSocialProfile,type FurnitureSocialLink,type FurnitureTextExtras,type SocialPlatformRecord,type SocialProfile,formatFurnitureDate,formatSlideNumber,DEFAULT_FURNITURE_DATE_FORMAT,DEFAULT_SLIDE_NUMBER_FORMAT,type FurnitureLayout,type FurniturePart,type FurnitureTextPart,type FurnitureImagePart,type FurniturePartBase,type FurnitureField} from './composition.js';
export type { QuoteContent, QuoteTextSource, QuoteTextPart, QuoteLayoutDiagnostic, QuotePhoto, QuoteLayout, QuoteLayoutOptions } from './composition.js';
export {layoutCode} from './composition.js';
export type {CodeContent,CodeLineSegment,CodeLineSource,CodeTextFit,CodeTextPart,CodeLayoutDiagnostic,CodeLayout,CodeLayoutOptions} from './composition.js';
export {layoutMetric} from './composition.js';
export type {MetricContent,MetricTextSource,MetricTextPart,MetricLayoutDiagnostic,MetricLayout,MetricLayoutOptions} from './composition.js';
export {layoutTimeline} from './composition.js';
export type {TimelineStatus,TimelineEvent,TimelineContent,TimelineTextPart,TimelineLayoutDiagnostic,TimelineLayout,TimelineLayoutOptions} from './composition.js';
export type { FontSchemeDiagnostic, ResolvedFontScheme } from "./composition.js";
export type { TextStyle, FontFamilies, TextMeasurement, MeasureTextWidth, Composition, LayoutBox, LayoutDiagnostic, TextFit, ComposedItem, ComposedSlideImage, SlideImageShape, ComposedGroup, ComposedFlow, CompositionTrack, CompositionPenalties, CompositionCandidate, CompositionDecision, CompositionExplanation, SlideComposition, ComposeSlideOptions } from "./composition.js";
export { resolveLogo, PICTURE_BULLET_SCALE } from './composition.js';
export type { LogoSlot, ResolvedLogo, ResolveLogoOptions, ComposedLogo, ListBulletImage, ListFitOptions } from './composition.js';

export { paginatePresentation, paginateSlide, OPFPaginationError } from './pagination.js';
export type { PresentationPaginationOptions, PresentationPaginationResult, PaginationOptions, PaginationResult, PaginatedPage, PaginationMapping } from './pagination.js';

export { bundlePresentation } from './bundle.js';
export type { BundleReport, BundleResult } from './bundle.js';

export { parseTabularData, createDataContent, OPFDataImportError } from './data.js';
export type { DataCell, TabularData, DataImportOptions, DataContentOptions } from './data.js';
// RR-54: chart and table data: strict numbers, number formats and Excel codes, datasets, series mapping.
export { chartNumber, formatDataNumber, numberFormatError, excelNumberFormat, numberFormatFromExcel, inlineDatasets, inlineTableData, inlineChartData, isDatasetRef, isXYChartType, resolveChartData, resolveTableData, tableCellDisplayValue, datasetDiagnostics, unusedDatasets, suggestChartNumberFix } from './chart-data.js';
export type { DataCellValue, DataColumn, DataSourceRef, Dataset, DatasetRef, ChartMapping, ChartComboSeries, DataTextRun, DataTableValue, DataStyledCell, DataTableCell, DataTableHeader, DataDiagnostic, DataDiagnosticCode, DataResolveOptions, ResolvedChartData, ResolvedTableData, ChartNumberFix, ChartNumberFixOperation, ChartNumberFixOptions } from './chart-data.js';

export { fitRichText } from './composition.js';
export type { RichTextRun, RichTextFragment, RichTextLine, RichTextFit, RichTextOptions } from './composition.js';

export {fitList} from './composition.js';
export {NUMBERING_STYLES,NUMBERING_SUFFIXES,MAX_NUMBERING_VALUE,MAX_ROMAN_VALUE,MAX_NUMBERING_LEVELS,formatListNumber,listNumbers,resolveNumbering,numberingAtLevel,numberingStyleDraws,sliceNumberedItems,type Numbering,type NumberingInput,type NumberingStyleName,type NumberingSuffix,type ResolvedNumbering,type ListNumber} from './numbering.js';
export type {ListText,ListValue,ListEntryLayout,ListFit} from './composition.js';
export {resolveDesignHints,DESIGN_HINT_KEYS,type DesignHints,type DesignHintKey,type DesignHintSource,type ResolvedDesignHints,type ResolveDesignHintsOptions} from './design-hints.js';
export {layoutContent,LAYOUT_BODY_KINDS,type LayoutContent,type LayoutBodyKind} from './layout-content.js';

// RR-34: footnotes, citations and captions (annotations.ts; also on the composition entry).
export {CAPTIONABLE_FIELDS,CAPTION_FONT_RATIO,CAPTION_MAX_RATIO,CITATION_MARKER_RAISE,CITATION_MARKER_SCALE,FOOTNOTE_MAX_RATIO,annotationText,captionSettings,citationMarkerText,collectCitations,layoutCaption,layoutFootnotes,referencesSlide,slideCitations,walkCitationRuns} from './annotations.js';
export type {AnnotatedRun,AnnotationFitter,AnnotationLayoutOptions,Caption,CaptionAlignment,CaptionObject,CaptionPosition,CaptionSettings,CitationMarker,CitationNote,ComposedCaption,ComposedFootnoteEntry,ComposedFootnotes,DeckCitations,FootnoteLayoutOptions,Reference,ReferencesSlideOptions,RichText,SlideCitations} from './annotations.js';
export {
  chartColorForFill,
  chartPaletteForFill,
  chartHighlightColors,
  CHART_HIGHLIGHT_MUTED_MIX,
  CHART_HIGHLIGHT_MUTED_MIN_CONTRAST,
  CHART_SERIES_MIN_LIGHTNESS_STEP,
  CHART_SERIES_MIN_DIFFERENCE,
  colorContrast,
  DARK_BACKGROUND_LUMINANCE,
  defaultSlideBackground,
  isDarkColor,
  normalizeHexColor,
  resolveColorRef,
  resolveColorRoles,
  SURFACE_ALT_MIN_CONTRAST,
  SURFACE_ALT_MIX,
  surfaceAltColor,
  textColorForFill,
} from './color.js';
export type { ResolveColorRefOptions, ResolveColorRefRoles, ResolveColorRolesOptions, ResolvedColorRoles } from './color.js';
export { normalizeLanguageFamily, paragraphDirection, resolveScriptFonts, resolveSlideDirection, scriptFontRole } from './script-fonts.js';
export { paragraphDirectionAt, physicalAlignment, type PhysicalAlignment } from './direction.js';
export type {
  LanguageFamilyName,
  ResolveScriptFontsOptions,
  ResolvedScriptFonts,
  ScriptFontApp,
  ScriptFontSlots,
  ScriptFontSource,
  ScriptFontSupplement,
  ScriptRole,
  TextDirection,
} from './script-fonts.js';
export {measureTextOutline,placeTextLines} from './composition.js';
export { FONT_POLICY, applyFontPolicyDecisions, fontPolicyFor, fontAvailabilityDiagnostics } from './font-policy.js';
export type {
  FontAvailability,
  FontAvailabilityCode,
  FontAvailabilityDiagnostic,
  FontLicenseClass,
  FontPolicyDecision,
  FontPolicyEntry,
  FontPolicyTable,
  FontReplacement,
  FontReplacementCompatibility,
  FontReplacementMeasurement,
} from './font-policy.js';
export type {TextLineInk,TextPlacementLine,TextPlacement} from './composition.js';

export {
  CODE_HIGHLIGHT_LANGUAGES, CODE_HIGHLIGHT_MAX_LENGTH, CODE_PANEL_BACKGROUND, CODE_PANEL_FOREGROUND, CODE_SYNTAX_MIN_CONTRAST,
  codeLineRuns, codeSyntaxPalette, codeSyntaxPaletteForScheme, resolveCodeLanguage, tokenizeCode,
} from './code-syntax.js';
export type { CodeRun, CodeSyntaxPalette, CodeSyntaxPaletteOptions, CodeSyntaxPaletteTheme, CodeToken, CodeTokenKind } from './code-syntax.js';
export {
  CODE_HIGHLIGHT_BAND_TINT, CODE_HIGHLIGHT_DIM, codeHighlightBands, codeHighlightColors, codeHighlightContrast, codeHighlightLines, codeHighlightList,
  codeHighlightSlice, codeLineCount, codeLineNumbers,
} from './code-highlight.js';
export type { CodeHighlightBand, CodeHighlightColors, CodeHighlightEntry, CodeHighlightIssue, CodeHighlightLines } from './code-highlight.js';
export { WATERMARK_TEXT_MAX_HEIGHT, WATERMARK_TEXT_MAX_WIDTH, WATERMARK_TEXT_ROTATION, layoutWatermark } from './watermark.js';
export type { WatermarkTextLayout, WatermarkTextOptions } from './watermark.js';
export { METRIC_TREND_MIN_CONTRAST, METRIC_TREND_SHAPES, metricTrendColor, metricTrendMark, metricTrendPoints } from './metric-trend.js';
export type { MetricSentiment, MetricTrend, MetricTrendColorOptions, MetricTrendMark } from './metric-trend.js';
export { TIMELINE_OUTLINE_MIN_CONTRAST, TIMELINE_STATUSES, TIMELINE_TEXT_MIN_CONTRAST, timelineMarkerShapes, timelineTextColor } from './timeline-status.js';
export type { TimelineMarkerShape, TimelineStatusColors } from './timeline-status.js';
export { PATTERN_PRESETS, PATTERN_PRESET_ALIASES, PATTERN_TILE_SIZE, patternBitmap, patternRuns, resolvePatternPreset } from './pattern-fills.js';

export { SYMBOL_FONT_ENCODINGS, SYMBOL_FONT_FAMILIES, symbolFontEncodingFor, isSymbolEncodedFamily, symbolCodeOf, symbolUnicodeFor, symbolCodeForUnicode, mapSymbolText } from './symbol-font-encodings.js';
export type { SymbolFontEncoding, SymbolFontEncodingTable, SymbolFontCode, SymbolFontFamily, SymbolTextCharacter } from './symbol-font-encodings.js';
export {chartOptionSupport,chartOptionTarget,resolveChartOptions,chartHighlightMarks,formatChartLabelNumber,formatChartLabelPercent,chartLabelText,DEFAULT_CHART_LABEL_SEPARATOR} from './chart-options.js';
export type {ChartOptionKind,ChartOptionTarget,ChartOptionSupport,ChartOptionDiagnostic,ChartLegendPosition,ChartLabelContent,ChartLabelPosition,ResolvedChartDataLabels,ResolvedChartHighlight,ChartHighlightMarks,ResolvedChartOptions} from './chart-options.js';
