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

export type { TextStyle, FontFamilies, TextMeasurement, MeasureTextWidth, Fonts, LayoutDiagnostic, FontSchemeDiagnostic, ComposeSlideOptions } from "./composition.js";
export { resolveSlideContext } from './slide-context.js';
export type { SlideContext, SlideContextDiagnostic, SlideContextOptions, SlideContextReferenceDiagnostic } from './slide-context.js';
export { stats } from './stats.js';
export type { PresentationStats, StatsOptions, SlideStats, StatsSlideRef, ReferenceFact, SlideSizeFact, HeaderFooterFact, TableFact, DatasetFact } from './stats.js';

export { paginate, paginateSlide, OPFPaginationError } from './pagination.js';
export type { PresentationPaginationOptions, PresentationPaginationResult, PaginationOptions, PaginationResult, PaginatedPage, PaginationMapping } from './pagination.js';

// The verbs of the CLI, at the root so `import * as opf` shows them: each also has its own subpath.
export { applyPatch, OPFPatchError, OPFPatchValidationError } from './patch.js';
export type { ApplyPatchOptions, PatchResult } from './patch.js';
export { diff, merge } from './diff.js';
export type { DiffOptions, MergeConflict, MergeOptions, MergeResult, PresentationDiff } from './diff.js';
export { format, OPFFormatError } from './format.js';
export type { FormatOptions } from './format.js';
export { fromMarkdown, toMarkdown, OPFMarkdownError } from './markdown.js';
export type { FromMarkdownOptions, FromMarkdownResult, ToMarkdownOptions, ToMarkdownResult } from './markdown.js';

export { bundle } from './bundle.js';
export type { BundleReport, BundleResult } from './bundle.js';

export { parseTabularData, importData, OPFDataImportError } from './data.js';
export type { DataCell, TabularData, DataImportOptions, ImportDataOptions } from './data.js';
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
