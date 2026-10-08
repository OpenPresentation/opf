// `@openpresentation/cli/api`: the format-oriented library API of the CLI package. Core reads and writes the text formats
// (`readDeck`, `writeDeck`, `validate`, re-exported here from the one core this package depends on); this entry reads and
// writes files (`exportDeck`: PDF, PNG, SVG and PPTX; `importDeck`: PPTX to a presentation). The two engines behind them,
// `@openpresentation/opf-render` and `@openpresentation/opf-pptx`, are optional peers, loaded the first time a function needs
// them; a missing one throws a typed error that carries the install command. The `opf render`, `opf export` and
// `opf import` commands run the same code (export.ts, convert.ts).
//
// Output is deterministic: no network, no system fonts, no clock unless `date` is passed.
import { type Catalog, type Finding, type Presentation, type ValidateOptions, validate } from "@openpresentation/opf";
import { CLI_CATALOGS } from "./catalogs.js";
import { runImport } from "./convert.js";
import { OPFApiError, OPFExportError, OPFImportError, asApiError } from "./errors.js";
import { type ExportFile, type ExportFontSummary, type ExportOptions, VERSIONS, resolveExportOptions, runExport } from "./export.js";
import { listFontDirectories } from "./fonts.js";
import { PPTX_PACKAGE, loadPptx, loadRenderer } from "./peers.js";
import { Reporter } from "./reporter.js";

export { OPFValidationError, assertValid, readDeck, validate, writeDeck } from "@openpresentation/opf";
export type { DeckFormat, Finding, Presentation, ReadDeckOptions, ReadDeckResult, ValidateOptions, ValidationReport, WriteDeckOptions } from "@openpresentation/opf";
export { defaultCatalog } from "@openpresentation/opf/catalog";
export type { Catalog } from "@openpresentation/opf";
export { OPFApiError, OPFExportError, OPFImportError } from "./errors.js";
export type { ExportFile, ExportFontSummary, ExportFormat, ExportOptions } from "./export.js";
export type { FontsHandle } from "./peers.js";

/** The check a presentation passes before it is exported or after it is imported: format and references, so a contrast warning never blocks a write. */
const checkOptions = (catalogs: readonly Catalog[]): ValidateOptions => ({ only: ["format", "references"], catalogs });

export interface ExportResult {
	/** The files, in slide order: one per slide for `svg` and `png`, otherwise one. */
	files: ExportFile[];
	/** The findings of the format and references check (warnings and notes; errors throw) and the diagnostics of the engines: fonts, layout, SVG, PDF and PPTX, each with a `render/`, `pptx/`, `pdf/`, `fonts/` or `cli/` rule prefix. */
	findings: Finding[];
	/** The bundled fonts and font files used, and the substitutions made. */
	fonts: ExportFontSummary;
	/** Slide numbers left out because they are hidden (`svg`, `png`, `pdf` without `includeHidden` or `slides`). */
	skippedHidden: number[];
	/** With `paginate`: the pages the slides were split into. */
	pagination?: { pages: unknown };
	/** `pdf`: the mode used. */
	pdf?: { mode: "vector" | "raster" };
	/** The engines that drew the files. */
	renderer: { package: string; version: string };
	pptx?: { package: string; version: string };
}

/**
 * Draw a presentation as PDF, PNG, SVG or PPTX with the bundled open fonts. Throws `OPFExportError`: `peer-not-installed`,
 * `peer-too-old` or `peer-load-failed` for the engines, `invalid-option`, `invalid-presentation` (its `findings` are the
 * errors of the check), `no-slides`, `all-slides-hidden`, `export-failed` (a drawing error; `findings` hold it) or a font code.
 */
export async function exportDeck(presentation: Presentation, options: ExportOptions): Promise<ExportResult> {
	try {
		const resolved = resolveExportOptions(options);
		if (!presentation || typeof presentation !== "object" || Array.isArray(presentation)) throw new OPFApiError("exportDeck takes a presentation object; read JSON, YAML or Markdown text with readDeck first.", "invalid-option");
		// Engines and font directories first, so a missing install is reported before the document is looked at.
		const renderer = await loadRenderer();
		const pptx = resolved.format === "pptx" ? await loadPptx() : undefined;
		const userFonts = resolved.fonts ? [] : await listFontDirectories([...(resolved.fontDirs ?? [])], "fontDirs");
		const check = validate(presentation, checkOptions(resolved.catalogs ?? CLI_CATALOGS));
		if (!check.valid) throw new OPFApiError(`The presentation is not valid OPF: ${firstError(check.findings)}`, "invalid-presentation", { findings: check.findings });
		const reporter = new Reporter(check.findings);
		const run = await runExport(presentation, resolved, { reporter, renderer, ...(pptx ? { pptx } : {}), userFonts });
		if (run.failure) throw new OPFApiError(run.failure.message, "export-failed", { details: { reason: run.failure.code }, findings: reporter.findings });
		return {
			files: run.files,
			findings: reporter.findings,
			fonts: run.fonts as ExportFontSummary,
			skippedHidden: run.skippedHidden,
			...(run.pagination ? { pagination: run.pagination } : {}),
			...(run.pdf ? { pdf: run.pdf } : {}),
			...VERSIONS(renderer, pptx),
		};
	} catch (error) {
		throw asApiError(OPFExportError, error, "export-failed");
	}
}

export interface ImportOptions {
	/** The catalogs the imported presentation's references resolve in. Omitted: core's default catalog. */
	catalogs?: readonly Catalog[];
	/** Also return the raw per-shape layout and style signals of the file (`signals`). */
	signals?: boolean;
}

export interface ImportResult {
	/** The presentation. It passed the format and references check. */
	presentation: Presentation;
	/** What the conversion could not keep or had to change, and the findings of the check. */
	findings: Finding[];
	/** With `signals: true`. */
	signals?: { version?: number };
	/** The importer that read the file. */
	pptx: { package: string; version: string };
}

/**
 * Read a PowerPoint file into an OPF presentation. Import is a conversion, not a lossless round trip for arbitrary decks:
 * what it cannot keep is reported in `findings`. Throws `OPFImportError`: `peer-not-installed`, `peer-too-old`,
 * `peer-load-failed`, `import-failed` (opf-pptx could not read the file; `findings` hold the error) or `invalid-presentation`.
 */
export async function importDeck(input: Uint8Array | ArrayBuffer, options: ImportOptions = {}): Promise<ImportResult> {
	try {
		if (!(input instanceof Uint8Array) && !(input instanceof ArrayBuffer)) throw new OPFApiError("importDeck takes the bytes of a .pptx file (a Uint8Array, a Buffer or an ArrayBuffer).", "invalid-option");
		const pptx = await loadPptx();
		const reporter = new Reporter();
		const run = await runImport(input instanceof Uint8Array ? input : new Uint8Array(input), { signals: options.signals === true }, reporter, pptx);
		if (run.failure || !run.presentation) throw new OPFApiError(run.failure?.message ?? "The file could not be read.", "import-failed", { details: { reason: run.failure?.code }, findings: reporter.findings });
		// The deck is checked in its JSON form, so a located finding points into the document that would be written.
		const check = validate(run.presentation, checkOptions(options.catalogs ?? CLI_CATALOGS));
		for (const found of check.findings) reporter.addFinding(found);
		if (!check.valid) throw new OPFApiError(`The imported presentation is not valid OPF: ${firstError(check.findings)}`, "invalid-presentation", { findings: reporter.findings });
		return { presentation: run.presentation as unknown as Presentation, findings: reporter.findings, ...(run.signals ? { signals: run.signals } : {}), pptx: { package: PPTX_PACKAGE, version: pptx.version } };
	} catch (error) {
		throw asApiError(OPFImportError, error, "import-failed");
	}
}

const firstError = (findings: readonly Finding[]) => {
	const first = findings.find((found) => found.severity === "error");
	return first ? `${first.message} [${first.ruleId}]` : "see findings.";
};
