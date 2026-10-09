// The checked export and import of the Node engine: `convert` and `open` (conversion.ts) chain them with reading and writing
// files. They throw `OPFApiError`; the public functions turn it into `OPFExportError` or `OPFImportError`.
import { type Catalog, type Finding, type Presentation, type ValidateOptions, type ValidationReport, validate } from "../core.js";
import { DEFAULT_CATALOGS } from "./catalogs.js";
import { runImport } from "./pptx-import.js";
import { OPFApiError } from "../api-errors.js";
import { type ExportFile, type ExportFontSummary, type ExportOptions, VERSIONS, resolveExportOptions, runExport } from "./export.js";
import { listFontDirectories } from "./fonts.js";
import { PPTX_PACKAGE, type Peer, type PptxModule, type Renderer, loadPptx, loadRenderer } from "./peers.js";
import { Reporter } from "./reporter.js";

/** The check a presentation passes before it is exported or after it is imported: format and references, so a contrast warning never blocks a write. */
export const checkOptions = (catalogs: readonly Catalog[] | undefined): ValidateOptions => ({ only: ["format", "references"], catalogs: catalogs ?? DEFAULT_CATALOGS });

export const firstError = (findings: readonly Finding[]) => {
	const first = findings.find((found) => found.severity === "error");
	return first ? `${first.message} [${first.ruleId}]` : "see findings.";
};

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

/** An export whose options are checked and whose engines and font files are loaded, before any document is read. */
export interface PreparedExport {
	options: ReturnType<typeof resolveExportOptions>;
	renderer: Renderer;
	pptx?: Peer<PptxModule>;
	userFonts: string[];
	/** Name options as the command's flags (`--slides`, `--font-dir`, `--asset-dir`) in messages. */
	flags: boolean;
}

/** Check the options, then load the engines and list the font directories, so a missing install is reported before the document is looked at. */
export async function prepareExport(options: ExportOptions, flags = false): Promise<PreparedExport> {
	const resolved = resolveExportOptions(options);
	const renderer = await loadRenderer();
	const pptx = resolved.format === "pptx" ? await loadPptx() : undefined;
	const userFonts = resolved.fonts ? [] : await listFontDirectories([...(resolved.fontDirs ?? [])], flags ? "--font-dir" : "fontDirs");
	return { options: resolved, renderer, ...(pptx ? { pptx } : {}), userFonts, flags };
}

/**
 * Draw a presentation. Without `checked` it is checked first (`invalid-presentation` when it fails); with `checked`, the findings
 * of a check already made (located in the text it was read from, or the findings of an import) start the report instead.
 */
export async function runPreparedExport(prepared: PreparedExport, presentation: Presentation, checked?: readonly Finding[]): Promise<ExportResult> {
	let initial = checked;
	if (!initial) {
		const check = validate(presentation, checkOptions(prepared.options.catalogs));
		if (!check.valid) throw new OPFApiError(`The presentation is not valid OPF: ${firstError(check.findings)}`, "invalid-presentation", { findings: check.findings });
		initial = check.findings;
	}
	const reporter = new Reporter(initial);
	const { renderer, pptx, userFonts } = prepared;
	const run = await runExport(presentation, prepared.options, { reporter, renderer, ...(pptx ? { pptx } : {}), userFonts, flags: prepared.flags });
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
}

/** Read a PowerPoint file and check the presentation (`import-failed`, `invalid-presentation`). `check` is the report of that check. */
export async function importPresentation(bytes: Uint8Array, options: ImportOptions, loaded?: Peer<PptxModule>): Promise<{ result: ImportResult; check: ValidationReport }> {
	const pptx = loaded ?? (await loadPptx());
	const reporter = new Reporter();
	const run = await runImport(bytes, { signals: options.signals === true }, reporter, pptx);
	if (run.failure || !run.presentation) throw new OPFApiError(run.failure?.message ?? "The file could not be read.", "import-failed", { details: { reason: run.failure?.code }, findings: reporter.findings });
	// The deck is checked in its JSON form, so a located finding points into the document that would be written.
	const check = validate(run.presentation, checkOptions(options.catalogs));
	for (const found of check.findings) reporter.addFinding(found);
	if (!check.valid) throw new OPFApiError(`The imported presentation is not valid OPF: ${firstError(check.findings)}`, "invalid-presentation", { findings: reporter.findings });
	return { result: { presentation: run.presentation as unknown as Presentation, findings: reporter.findings, ...(run.signals ? { signals: run.signals } : {}), pptx: { package: PPTX_PACKAGE, version: pptx.version } }, check };
}
