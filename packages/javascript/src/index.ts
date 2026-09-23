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
export type {
  SpecFileEntry,
  SpecFilePath,
  SpecFileKind,
} from "./spec-files.js";

export { composeSlide, resolveCanvasDimensions, fitText, wrapText, measureText, resolveFontFamilies, resolveFontSchemeReference, DEFAULT_FONT_SCHEME, resolveTextStyle, textWidthMeasurer, layoutQuote, OPFCompositionError, MAX_COMPOSITION_DEPTH } from "./composition.js";
export {layoutFurniture,formatFurnitureDate,formatSlideNumber,DEFAULT_FURNITURE_DATE_FORMAT,DEFAULT_SLIDE_NUMBER_FORMAT,type FurnitureLayout,type FurniturePart,type FurnitureTextPart,type FurnitureImagePart,type FurniturePartBase,type FurnitureField} from './composition.js';
export type { QuoteContent, QuoteTextSource, QuoteTextPart, QuoteLayoutDiagnostic, QuoteLayout, QuoteLayoutOptions } from './composition.js';
export {layoutCode} from './composition.js';
export type {CodeContent,CodeLineSegment,CodeLineSource,CodeTextFit,CodeTextPart,CodeLayoutDiagnostic,CodeLayout,CodeLayoutOptions} from './composition.js';
export {layoutMetric} from './composition.js';
export type {MetricContent,MetricTextSource,MetricTextPart,MetricLayoutDiagnostic,MetricLayout,MetricLayoutOptions} from './composition.js';
export {layoutTimeline} from './composition.js';
export type {TimelineEvent,TimelineContent,TimelineTextPart,TimelineLayoutDiagnostic,TimelineLayout,TimelineLayoutOptions} from './composition.js';
export type { FontSchemeDiagnostic, ResolvedFontScheme } from "./composition.js";
export type { TextStyle, FontFamilies, TextMeasurement, MeasureTextWidth, Composition, LayoutBox, LayoutDiagnostic, TextFit, ComposedItem, ComposedSlideImage, ComposedGroup, ComposedFlow, CompositionTrack, CompositionPenalties, CompositionCandidate, CompositionDecision, CompositionExplanation, SlideComposition, ComposeSlideOptions } from "./composition.js";

export { paginatePresentation, paginateSlide, OPFPaginationError } from './pagination.js';
export type { PresentationPaginationOptions, PresentationPaginationResult, PaginationOptions, PaginationResult, PaginatedPage, PaginationMapping } from './pagination.js';

export { bundlePresentation } from './bundle.js';
export type { BundleReport, BundleResult } from './bundle.js';

export { parseTabularData, createDataContent, OPFDataImportError } from './data.js';
export type { DataCell, TabularData, DataImportOptions, DataContentOptions } from './data.js';

export { fitRichText } from './composition.js';
export type { RichTextRun, RichTextFragment, RichTextLine, RichTextFit, RichTextOptions } from './composition.js';

export {fitList} from './composition.js';
export type {ListText,ListValue,ListEntryLayout,ListFit} from './composition.js';
export {
  chartColorForFill,
  colorContrast,
  normalizeHexColor,
  resolveColorRef,
  textColorForFill,
} from './color.js';
export type { ResolveColorRefOptions, ResolveColorRefRoles } from './color.js';
export { paragraphDirection, resolveScriptFonts, scriptFontRole } from './script-fonts.js';
export type {
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
export type {TextLineInk,TextPlacementLine,TextPlacement} from './composition.js';
