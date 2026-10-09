// `@openpresentation/opf/node/engine`: the engine behind `@openpresentation/opf/node`, exported for the opf CLI, whose
// `convert`, `render`, `export` and `import` commands run it and add their flags, JSON reports and exit codes. It is not an
// application API: use `@openpresentation/opf/node` (`convert`, `open`, `save`). Node-only, like `/node`.
export { readDeckReport } from "./deck-report.js";
export type { DeckReport, DeckReportOptions } from "./deck-report.js";
export { type ConversionPlan, deckFileFormat, exportFormatOf, planConversion, readInput, writePlanned } from "./node/conversion.js";
export { OPFApiError, OPFExportError, OPFImportError, asApiError } from "./node/errors.js";
export { EXPORT_FORMATS, type ExportContext, type ExportFile, type ExportFontSummary, type ExportFormat, type ExportOptions, type ExportRun, VERSIONS, checkDate, checkScale, resolveExportOptions, runExport } from "./node/export.js";
export { type PlannedFile, checkDestinations, deckStem, parseSlideSelection, pointerOf, stemOf, writeFiles } from "./node/files.js";
export { embeddedFor, leaseSharedFonts, listFontDirectories, prepareFonts } from "./node/fonts.js";
export { type ExportResult, type ImportOptions, type ImportResult, type PreparedExport, checkOptions, importPresentation, prepareExport, runPreparedExport } from "./node/pipeline.js";
export { PEER_RANGES, PPTX_PACKAGE, RENDER_PACKAGE, type Diagnostic, type FontsHandle, type Peer, type PptxModule, type Renderer, loadPptx, loadRenderer, missingPeerFrom } from "./node/peers.js";
export { type ImportRun, runImport } from "./node/pptx-import.js";
export { type ReportFinding, Reporter, type Source, finishReport, reaches, reportThrown } from "./node/reporter.js";
export { createZip } from "./node/zip.js";
