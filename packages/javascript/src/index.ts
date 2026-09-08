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
export type {
  SpecFileEntry,
  SpecFilePath,
  SpecFileKind,
} from "./spec-files.js";

export { composeSlide, resolveCanvasDimensions, fitText, wrapText, measureText, resolveFontFamilies, resolveTextStyle, textWidthMeasurer, OPFCompositionError, MAX_COMPOSITION_DEPTH } from "./composition.js";
export type { TextStyle, FontFamilies, TextMeasurement, MeasureTextWidth, Composition, LayoutBox, LayoutDiagnostic, TextFit, ComposedItem, ComposedGroup, ComposedFlow, CompositionTrack, SlideComposition, ComposeSlideOptions } from "./composition.js";

export { paginatePresentation, paginateSlide, OPFPaginationError } from './pagination.js';
export type { PresentationPaginationOptions, PresentationPaginationResult, PaginationOptions, PaginationResult, PaginatedPage, PaginationMapping } from './pagination.js';

export { parseTabularData, createDataContent, OPFDataImportError } from './data.js';
export type { DataCell, TabularData, DataImportOptions, DataContentOptions } from './data.js';

export { fitRichText } from './composition.js';
export type { RichTextRun, RichTextFragment, RichTextLine, RichTextFit, RichTextOptions } from './composition.js';

export {fitList} from './composition.js';
export type {ListText,ListValue,ListEntryLayout,ListFit} from './composition.js';
