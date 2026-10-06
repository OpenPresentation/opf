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

export type { TextStyle, FontFamilies, TextMeasurement, MeasureTextWidth, Fonts, LayoutDiagnostic, FontSchemeDiagnostic, ComposeSlideOptions } from "./composition.js";
export { resolveSlideContext } from './slide-context.js';
export type { SlideContext, SlideContextDiagnostic, SlideContextOptions, SlideContextReferenceDiagnostic } from './slide-context.js';
export { stats } from './stats.js';
export type { PresentationStats, StatsOptions, SlideStats, StatsSlideRef, ReferenceFact, SlideSizeFact, HeaderFooterFact, TableFact, DatasetFact } from './stats.js';

export { paginatePresentation, paginateSlide, OPFPaginationError } from './pagination.js';
export type { PresentationPaginationOptions, PresentationPaginationResult, PaginationOptions, PaginationResult, PaginatedPage, PaginationMapping } from './pagination.js';

export { bundlePresentation } from './bundle.js';
export type { BundleReport, BundleResult } from './bundle.js';

export { parseTabularData, createDataContent, OPFDataImportError } from './data.js';
export type { DataCell, TabularData, DataImportOptions, DataContentOptions } from './data.js';
// RR-54: chart and table data: strict numbers, number formats and Excel codes, datasets, series mapping.
export { chartNumber, formatDataNumber, numberFormatError, excelNumberFormat, numberFormatFromExcel, inlineDatasets, inlineTableData, inlineChartData, isDatasetRef, isXYChartType, resolveChartData, resolveTableData, tableCellDisplayValue, datasetDiagnostics, unusedDatasets, suggestChartNumberFix } from './chart-data.js';
export type { DataCellValue, DataColumn, DataSourceRef, Dataset, DatasetRef, ChartMapping, DataTextRun, DataTableValue, DataStyledCell, DataTableCell, DataTableHeader, DataDiagnostic, DataDiagnosticCode, DataResolveOptions, ResolvedChartData, ResolvedTableData, ChartNumberFix, ChartNumberFixOperation, ChartNumberFixOptions } from './chart-data.js';

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
