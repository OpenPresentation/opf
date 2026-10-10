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

// RR-70: the typed errors of the file API and the slide-selection parser are browser-safe; both builds of the root export them.
export { OPFApiError, OPFExportError, OPFImportError } from "./api-errors.js";
export { parseSlideSelection } from "./slide-selection.js";
export type { SlideSelection } from "./slide-selection.js";

// OPF 0.15 (FA-21): the root imports no catalog data. The pinned default catalog is `@openpresentation/opf/catalog`.
// RR-70: this module is what both builds of the root share; ./index.ts (Node) and ./browser.ts add `open`, `save` and `convert`.

export {
  DEFAULT_CHART_PALETTE,
  DEFAULT_VALIDATION_THRESHOLDS,
  OPFValidationError,
  assertValid,
  assertValidCatalogRecord,
  findValidationRule,
  validate,
  validateCatalogRecord,
  validationCategories,
  validationRules,
} from "./validator.js";
export type {
  Contract,
  ValidateFonts,
  ValidateOptions,
  ValidationCategory,
  ValidationChecks,
  ValidationReport,
  ValidationRuleCost,
  ValidationRuleInfo,
  ValidationThresholds,
} from "./validator.js";

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
export { SLIDE_SCOPED_BUILTINS, resolveSlideVariables } from "./slide-variables.js";
export type { SlideScopedBuiltin } from "./slide-variables.js";
// RR-71: logos live on the organization (resolveLogo, the one resolution, is on /composition with the layout engine).
export { LOGO_SHAPES } from "./logos.js";
export type { LogoShape, LogoVariant, ResolvedLogo, ResolveLogoOptions } from "./logos.js";

export {
  specFileEntries,
  specFilePaths,
  specFileKinds,
} from "./spec-files.js";

export type * from "./types.js";
export type {
  SpecFileEntry,
  SpecFilePath,
  SpecFileKind,
} from "./spec-files.js";

export type { TextStyle, FontFamilies, TextMeasurement, MeasureTextWidth, Fonts, LayoutDiagnostic, ComposeSlideOptions } from "./composition.js";

// OPF 0.15 catalogs: references, the one resolution rule, and the authoring helpers (FA-20).
export {
  CATALOG_GROUP_PATTERN,
  CATALOG_REFERENCE_PATTERN,
  OPFCatalogsOptionError,
  OPFUnresolvedReferenceError,
  catalogGroupSource,
  catalogKinds,
  catalogRecords,
  catalogReferenceSites,
  parseReference,
  resolveReference,
  unresolvedReference,
} from "./catalog-refs.js";
export type {
  Catalog,
  CatalogKind,
  CatalogOptions,
  CatalogRecordMap,
  CatalogRecords,
  CatalogReferenceSite,
  RecordProvenance,
  ResolvedReference,
  UnresolvedReferenceDiagnostic,
} from "./catalog-refs.js";
export { catalogDisplayKinds, catalogSchemaNames } from "./catalog-schemas.js";
export type { CatalogDisplayKind, CatalogRecordKind } from "./catalog-schemas.js";
export { copySlides, embed, moveToCustom, OPFMoveToCustomError, sameRecord, updateFromCatalog } from "./catalog-helpers.js";
export type { CatalogPatchOperation, CatalogRecordChange, CatalogRef, CatalogUpdate, CopiedRecordRename, CopySlidesResult, EmbedResult, EmbeddedRecord, MovedRecord, MoveToCustomErrorCode, MoveToCustomPatchOperation, MoveToCustomResult } from "./catalog-helpers.js";
export { resolveDesignRecords, resolveFontScheme } from "./design-records.js";
export type { ResolvedDesignRecords } from "./design-records.js";
export {
  CHART_TYPES,
  ENGINE_DEFAULT_CHART_TYPES,
  ENGINE_DEFAULT_COLOR_SCHEME,
  ENGINE_DEFAULT_FONT_SCHEME,
  ENGINE_DEFAULT_THEME,
  LANGUAGES,
  SOCIAL_PLATFORMS,
} from "./engine-vocabularies.js";
export type { LanguageVocabulary, SocialPlatformVocabulary } from "./engine-vocabularies.js";
export { resolveSlideContext } from './slide-context.js';
export type { SlideContext, SlideContextDiagnostic, SlideContextOptions } from './slide-context.js';
export { stats } from './stats.js';
export type { PresentationStats, StatsOptions, SlideStats, StatsSlideRef, ReferenceFact, SlideSizeFact, HeaderFooterFact, TableFact, DatasetFact } from './stats.js';

export { paginate, paginateSlide, OPFPaginationError } from './pagination.js';
export type { PresentationPaginationOptions, PresentationPaginationResult, PaginationOptions, PaginationResult, PaginatedPage, PaginationMapping } from './pagination.js';

// The verbs of the CLI, at the root so `import * as opf` shows them: each also has its own subpath.
export { applyPatch, OPFPatchError, OPFPatchValidationError } from './patch.js';
export type { ApplyPatchOptions, PatchResult } from './patch.js';
export { diff, merge } from './diff.js';
export type { DiffOptions, MergeConflict, MergeOptions, MergeResult, PresentationDiff } from './diff.js';
// RR-75: `opf edit` and `opf fill` as functions. The Node build registers the default catalog for edit's check, as the CLI does.
export { edit } from './edit.js';
export type { EditOptions, EditResult } from './edit.js';
export { fill, fillRecords } from './fill.js';
export type { FillOptions, FillRecord, FillResult, FilledDeck } from './fill.js';
export { format, OPFFormatError } from './format.js';
export type { FormatOptions } from './format.js';
export { fromMarkdown, toMarkdown, OPFMarkdownError } from './markdown.js';
export type { FromMarkdownOptions, FromMarkdownResult, ToMarkdownOptions, ToMarkdownResult } from './markdown.js';
// RR-60: one reader and one writer for a deck in JSON, YAML or Markdown, chosen by option or file name.
export { parse, stringify, deckFormatOf, DECK_FORMATS } from './deck.js';
export type { DeckFormat, ParseOptions, StringifyOptions } from './deck.js';


export { parseTabularData, ingest, OPFDataImportError } from './data.js';
export type { DataCell, TabularData, ImportedChartData, ImportedChartType, ImportedTable, ImportedChart, DataImportOptions, IngestOptions } from './data.js';
// RR-54: chart and table data: strict numbers, number formats and Excel codes, datasets, series mapping.
export { chartNumber, formatDataNumber, numberFormatError, toExcelNumberFormat, fromExcelNumberFormat, inlineDatasets, inlineTableData, inlineChartData, isDatasetRef, isXYChartType, resolveChartData, resolveTableData, tableCellDisplayValue, datasetDiagnostics, unusedDatasets, suggestChartNumberFix } from './chart-data.js';
export type { DataCellValue, DataColumn, DataSourceRef, Dataset, DatasetRef, ChartMapping, ChartComboSeries, DataTextRun, DataTableValue, DataStyledCell, DataTableCell, DataTableHeader, DataDiagnostic, DataDiagnosticCode, DataResolveOptions, ResolvedChartData, ResolvedTableData, ChartNumberFix, ChartNumberFixOperation, ChartNumberFixOptions } from './chart-data.js';

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
// A font scheme's `languageFamily` catalog value, read as one of the three OOXML script slots.
export { normalizeLanguageFamily } from './script-fonts.js';
export type { LanguageFamilyName } from './script-fonts.js';
// OPF 0.19: the layout ids the 0.18 default catalog had and 0.19 removed, and the deck migration (opf convert --migrate).
export { LAYOUT_MIGRATION, convertLayoutRecord, layoutMigrationRow, migrate, migrateSlide, removedLayoutRow } from './layout-migration.js';
export type { ConvertedLayout, LayoutMigrationChange, LayoutMigrationRow, MigrateOptions, MigrateResult } from './layout-migration.js';
