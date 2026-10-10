// `convert`, `open` and `save` of `@openpresentation/opf` in Node (RR-62, RR-70), and the plan `opf convert` runs: files in, files out, the
// formats named by the file names. A conversion is planned first (every option checked, the input read, checked and drawn or
// serialized, every byte produced), then written atomically, so an error writes nothing. The command applies --fail-on to the
// plan and writes it; `convert` writes it at once, or returns the bytes when no output path is given.
//
//   input                                         output
//   .pptx, PPTX bytes    imported (opf-pptx)       .pdf .pptx .png .svg        exported (opf-render, opf-pptx)
//   .opf.md .yaml .yml   read as a deck            .zip                        one archive of png (or svg) slides
//   .json, a deck object                           .opf.md .yaml .yml .json    written as a deck
import { readFile } from "node:fs/promises";
import path from "node:path";
import { type DeckFormat, type DeckReport, deckFormatOf, readDeckReport } from "../deck-report.js";
import { stringify } from "../deck.js";
import type { Finding, Presentation, ValidationReport } from "../core.js";
import { OPFValidationError, validate } from "../validator.js";
import { DEFAULT_CATALOGS } from "./catalogs.js";
import { OPFApiError, OPFExportError, OPFImportError, asApiError } from "../api-errors.js";
import { type ExportFile, type ExportFormat, type ExportOptions, checkDate, checkRenamedOptions, checkScale } from "./export.js";
import { checkOutputPattern, deckStem, expandOutputPattern, padNumber, writeFiles } from "./files.js";
import { type Peer, type PptxModule, loadPptx } from "./peers.js";
import { type ExportResult, type ImportResult, type PreparedExport, checkOptions, firstError, importPresentation, prepareExport, runPreparedExport } from "./pipeline.js";
import { createZip } from "./zip.js";

/** What `convert` makes: an export format, or a deck form. */
export type ConvertFormat = ExportFormat | DeckFormat;

/** What `convert` reads: a file path (`.pptx`, `.opf.md`, `.yaml`/`.yml`, `.json`), a deck, or the bytes of a `.pptx` file. */
export type ConvertInput = string | Presentation | Uint8Array | ArrayBuffer;

export interface ConvertOptions extends Omit<ExportOptions, "format"> {
	/**
	 * What to make. With an output path the path's extension names it, and `format` is needed only for a `.zip` (the slides in
	 * it: `png`, the default, or `svg`); a `format` that disagrees with the extension is refused. Without an output path it is
	 * required: `pdf`, `pptx`, `png`, `svg`, `json`, `yaml` or `markdown`.
	 */
	format?: ConvertFormat;
	/** Without an output path: one archive of the slides (`png`, `svg`) instead of one file per slide. With an output path, a `.zip` path makes the archive and this option is refused. */
	zip?: boolean;
	/** Without an output path: the base name of the returned files (`name-1.png`, `name.pdf`; the number is padded to the largest slide number written). Omitted: the deck's `filename`, else its `name`, else the input file's stem. With an output path, the path names the file and this option is refused. */
	name?: string;
	/** A `.pptx` input: also return the raw per-shape layout and style signals of the file (`signals` in the result). */
	signals?: boolean;
	/**
	 * Replace outputs that exist (the default, as `save` and `fs.writeFile` do), atomically. `false` refuses: an existing output
	 * rejects with `output-exists` before anything is written, the rule the opf commands apply without `--force`. A symlink, a
	 * directory or another non-regular file is never replaced (`output-not-file`).
	 */
	overwrite?: boolean;
}

export interface ConvertedFile {
	/** The file name: the output's base name, or without an output path the deck's `filename`, else its slugified `name`, else the input file's stem, then `-1.png` for slide 1 and so on, padded to the largest slide number written (`-01.png` from ten slides). */
	name: string;
	/** With an output path, the file written: the path itself, or for one file per slide the path's folder and stem plus the slide number (`slides/deck-1.png`), or the path with `{n}` replaced by the slide number (`slides/slide-{n}.png`). */
	path?: string;
	/** The media type. */
	type: string;
	bytes: Uint8Array;
	/** `png` and `svg`: the slide number (one-based), its id and the picture's size in pixels. */
	slide?: number;
	id?: string;
	width?: number;
	height?: number;
	/** `pdf`: the number of pages and the slide numbers they show. */
	pages?: number;
	slides?: number[];
	/** `zip`: the names of the entries. */
	entries?: string[];
}

export interface ConvertResult {
	/** The files, in slide order: written when an output path was given, otherwise only returned. */
	files: ConvertedFile[];
	/** The findings of every step: the import (`import/` rules), the format and references check, and the export engines (`render/`, `pptx/`, `pdf/`, `fonts/`, `cli/`). Errors throw instead. */
	findings: Finding[];
	/** With `signals: true` and a `.pptx` input. */
	signals?: { version?: number };
}

export interface OpenOptions {
	/** The catalogs the deck's references resolve in. Omitted: the default catalog. */
	catalogs?: ExportOptions["catalogs"];
}

export interface SaveOptions {
	/** Check format and references first and refuse an invalid deck (`OPFValidationError`). Default true; `false` writes work in progress, as an editor's autosave does. */
	validate?: boolean;
	/** The catalogs the deck's references resolve in. Omitted: the default catalog. */
	catalogs?: ExportOptions["catalogs"];
	/** YAML: start with a `# yaml-language-server: $schema=...` line so editors validate the file. */
	schemaComment?: boolean;
}

export interface SaveResult {
	/** The file, as it was given. */
	path: string;
	/** The form written, from the file name. */
	format: DeckFormat;
}

/** A planned conversion: everything `convert` would write, and what `opf convert` reports about it. */
export interface ConversionPlan {
	files: ConvertedFile[];
	findings: Finding[];
	/** The format and references check of the deck that was drawn or written. */
	check: Pick<ValidationReport, "valid" | "schemaValid" | "checks">;
	format: ConvertFormat;
	zip: boolean;
	input?: { file: string; bytes: Uint8Array };
	exported?: ExportResult;
	imported?: ImportResult;
}

const EXPORT_EXTENSIONS: Record<string, ExportFormat> = { ".pdf": "pdf", ".pptx": "pptx", ".png": "png", ".svg": "svg" };
const FORMATS: readonly ConvertFormat[] = ["pdf", "pptx", "png", "svg", "json", "yaml", "markdown"];
const DECK_MEDIA: Record<DeckFormat, string> = { json: "application/json", yaml: "application/yaml", markdown: "text/markdown" };
const ZIP_MEDIA = "application/zip";
const INPUTS = ".pptx, .opf.md, .yaml, .yml or .json";
const OUTPUTS = ".pdf, .pptx, .png, .svg, .zip, .opf.md, .yaml, .yml or .json";
const DECKS = ".opf.md, .yaml, .yml or .json";

const invalid = (message: string, details?: Record<string, unknown>) => new OPFApiError(message, "invalid-option", details ? { details } : {});

/** The deck form a file name stands for (core's `deckFormatOf`: `.opf.md`, `.yaml`, `.yml`), or JSON for `.json`; undefined for any other name. A plain `.md` file is not a deck. */
export function deckFileFormat(file: string): DeckFormat | undefined {
	const format = deckFormatOf(file);
	return format !== "json" ? format : /\.json$/i.test(file) ? "json" : undefined;
}

/** The export format a file name stands for (`.pdf`, `.pptx`, `.png`, `.svg`, any case), else undefined. `opf convert` reads its output name with this rule. */
export function exportFormatOf(file: string): ExportFormat | undefined {
	return EXPORT_EXTENSIONS[path.extname(file).toLowerCase()];
}

/** The base name of a deck file without its deck or PowerPoint extension: `deck.opf.md` and `deck.pptx` both give `deck`. */
function fileStem(file: string): string {
	return (
		path
			.basename(file)
			.replace(/\.opf\.(md|json|ya?ml)$/i, "")
			.replace(/\.(json|ya?ml|pptx)$/i, "") || "deck"
	);
}

type Source = { kind: "pptx"; bytes?: Uint8Array } | { kind: "deck"; format: DeckFormat } | { kind: "presentation" };
type Target = { kind: "export"; format: ExportFormat; zip: boolean } | { kind: "deck"; format: DeckFormat };

function sourceOf(input: unknown, flags: boolean): Source {
	if (typeof input === "string") {
		if (/\.pptx$/i.test(input)) return { kind: "pptx" };
		const format = deckFileFormat(input);
		if (format) return { kind: "deck", format };
		throw invalid(`${flags ? "opf convert" : "convert"} reads ${INPUTS} files; ${input} is none of them.`, { path: input });
	}
	if (input instanceof Uint8Array) return { kind: "pptx", bytes: input };
	if (input instanceof ArrayBuffer) return { kind: "pptx", bytes: new Uint8Array(input) };
	if (input && typeof input === "object" && !Array.isArray(input)) return { kind: "presentation" };
	throw invalid("convert takes a file path, a presentation object or the bytes of a .pptx file.");
}

function targetOf(output: string | undefined, options: ConvertOptions, flags: boolean): Target {
	const format = options.format;
	const formatLabel = flags ? "--format" : "format";
	if (format !== undefined && !FORMATS.includes(format)) throw invalid(`${formatLabel} must be one of: ${FORMATS.join(", ")}.`);
	if (output === undefined) {
		if (format === undefined) throw invalid(`convert without an output path needs ${formatLabel}: ${FORMATS.join(", ")}.`);
		if (options.zip && format !== "png" && format !== "svg") throw invalid("zip applies to format png and svg.");
		return format === "json" || format === "yaml" || format === "markdown" ? { kind: "deck", format } : { kind: "export", format, zip: options.zip === true };
	}
	if (typeof output !== "string" || !output) throw invalid(`${flags ? "opf convert" : "convert"} needs an output file path ending ${OUTPUTS}.`);
	if (options.zip) throw invalid(`${flags ? "--zip" : "zip"} is for output without a path; a .zip output path makes the archive.`);
	if (options.name !== undefined) throw invalid(`${flags ? "--name" : "name"} is for output without a path; the output path names the file.`);
	if (path.extname(output).toLowerCase() === ".zip") {
		if (format !== undefined && format !== "png" && format !== "svg") throw invalid(`A .zip output holds png or svg slides; ${formatLabel} ${format} is neither.`);
		checkOutputPattern(output, false);
		return { kind: "export", format: format ?? "png", zip: true };
	}
	const exported = exportFormatOf(output);
	const deck = exported ? undefined : deckFileFormat(output);
	const named: ConvertFormat | undefined = exported ?? deck;
	if (!named) throw invalid(`${flags ? "opf convert" : "convert"} writes ${OUTPUTS} files; ${output} is none of them.`, { path: output });
	if (format !== undefined && format !== named) throw invalid(`${formatLabel} ${format} does not match the output ${output}, which is ${named}.`);
	// `{n}` in a .png or .svg path numbers the files by slide; every other output is one file and takes no placeholder.
	checkOutputPattern(output, exported === "png" || exported === "svg");
	return exported ? { kind: "export", format: exported, zip: false } : { kind: "deck", format: deck as DeckFormat };
}

/** The options of an export output. A deck output takes none of them. */
const EXPORT_ONLY = ["slides", "includeHidden", "paginate", "scale", "raster", "text", "charts", "provenance", "images", "date", "fonts", "assetDir"] as const;
const given = (value: unknown) => value !== undefined && value !== false && !(Array.isArray(value) && value.length === 0);

/** Which option applies to which format (`opf convert`'s rule), with each option named as the command's flag when `flags` is set. */
function checkApplicable(source: Source, target: Target, options: ConvertOptions, flags: boolean) {
	const name = (key: string) => (flags ? `--${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}` : key);
	const names = (...keys: string[]) =>
		keys
			.map(name)
			.join(", ")
			.replace(/, ([^,]*)$/, " and $1");
	if (given(options.signals) && source.kind !== "pptx") throw invalid(`${name("signals")} applies to a .pptx input.`);
	if (target.kind === "deck") {
		const extra = EXPORT_ONLY.filter((key) => given(options[key]));
		if (extra.length) throw invalid(`${names(...extra)} ${extra.length === 1 ? "applies" : "apply"} to export outputs (pdf, pptx, png, svg), not to a deck written as ${target.format}.`);
		return;
	}
	const format = target.format;
	if (given(options.raster) && format !== "pdf") throw invalid(`${name("raster")} applies to pdf output.`);
	if ((options.charts !== undefined || options.provenance !== undefined || options.images !== undefined) && format !== "pptx") throw invalid(`${names("charts", "provenance", "images")} apply to pptx output.`);
	if (options.scale !== undefined && format !== "png" && format !== "pdf") throw invalid(`${name("scale")} applies to png output (and raster pdf).`);
	if (given(options.includeHidden) && format === "pptx") throw invalid(`${name("includeHidden")} applies to per-slide image and PDF output; the PPTX keeps a hidden slide as a hidden slide.`);
	if (options.slides !== undefined && format === "pptx") throw invalid(`${name("slides")} is not available for pptx output: the whole presentation is exported.`);
	if (options.text !== undefined && format !== "svg") throw invalid(`${name("text")} applies to svg output.`);
	checkScale(options.scale, name("scale"));
	checkDate(options.date, name("date"));
}

/** Read an input file: `input-not-found` when there is none, `input-unreadable` for any other failure. */
export async function readInput(file: string): Promise<Uint8Array> {
	try {
		return new Uint8Array(await readFile(file));
	} catch (error) {
		const reason = (error as NodeJS.ErrnoException).code ?? (error as Error).message;
		const missing = reason === "ENOENT" || reason === "ENOTDIR";
		throw new OPFApiError(`Cannot read ${file}: ${missing ? "no such file" : reason}.`, missing ? "input-not-found" : "input-unreadable", { details: { path: file, reason }, cause: error });
	}
}

const inStep = async <T>(Class: typeof OPFExportError | typeof OPFImportError, fallback: string, step: () => Promise<T>): Promise<T> => {
	try {
		return await step();
	} catch (error) {
		throw asApiError(Class, error, fallback);
	}
};

/** The text of a deck in `format`. A document the YAML or Markdown writer refuses is `invalid-presentation`. */
function deckText(presentation: unknown, format: DeckFormat, schemaComment = false): string {
	try {
		return stringify(presentation, { format, schemaComment });
	} catch (error) {
		const failure = error as { message?: string; findings?: unknown; report?: { findings?: unknown } };
		const findings = Array.isArray(failure.report?.findings) ? failure.report.findings : Array.isArray(failure.findings) ? failure.findings : [];
		throw new OPFApiError(failure.message ?? String(error), "invalid-presentation", { findings: findings as Finding[], cause: error });
	}
}

/** The base name of a deck written without an input file: its `filename` or slugified `name`, else `deck`. */
function stemOfDeck(presentation: Presentation): string {
	const root = presentation as { filename?: unknown; name?: unknown };
	const text = typeof root.filename === "string" ? root.filename.replace(/\.(opf\.)?(json|ya?ml|md)$/i, "") : typeof root.name === "string" ? root.name : "";
	return (
		text
			.replace(/[^\p{L}\p{N}_.-]+/gu, "-")
			.replace(/-{2,}/g, "-")
			.replace(/^[-.]+|[-.]+$/g, "") || "deck"
	);
}

/**
 * Plan a conversion: check the request, read the input, then import, check, export or serialize. Nothing is written. Throws
 * `OPFApiError` for the request and the files (`invalid-option`, `input-not-found`, `input-unreadable`, and
 * `invalid-presentation` for a deck written as a deck), `OPFImportError` for the import step and `OPFExportError` for the export
 * step (`invalid-presentation` included). `flags` names options as the command's flags in messages.
 */
export async function planConversion(input: ConvertInput, output: string | undefined, options: ConvertOptions = {}, flags = false): Promise<ConversionPlan> {
	if (!options || typeof options !== "object") throw invalid("convert takes options as an object.");
	checkRenamedOptions(options);
	const source = sourceOf(input, flags);
	const target = targetOf(output, options, flags);
	checkApplicable(source, target, options, flags);
	const catalogs = options.catalogs ?? DEFAULT_CATALOGS;
	const ExportClass = target.kind === "export" ? OPFExportError : OPFApiError;
	const inputFile = typeof input === "string" ? input : undefined;

	// Engines first, so a missing install is reported before any file is read (as the commands do).
	let prepared: PreparedExport | undefined;
	if (target.kind === "export") {
		const { format: _format, zip: _zip, name: _name, signals: _signals, overwrite: _overwrite, ...rest } = options;
		const assetDir = options.assetDir ?? (inputFile === undefined ? undefined : path.dirname(path.resolve(inputFile)));
		const exportOptions: ExportOptions = {
			...rest,
			format: target.format,
			...(assetDir === undefined ? {} : { assetDir }),
			...(output === undefined && target.zip ? { zip: true } : {}),
		};
		prepared = await inStep(OPFExportError, "export-failed", () => prepareExport(exportOptions, flags));
	}
	let pptx: Peer<PptxModule> | undefined;
	if (source.kind === "pptx") pptx = await inStep(OPFImportError, "import-failed", () => loadPptx());

	// The deck, checked.
	let presentation: Presentation;
	let check: ConversionPlan["check"];
	let findings: Finding[];
	let imported: ImportResult | undefined;
	const read = inputFile === undefined ? undefined : { file: inputFile, bytes: await readInput(inputFile) };
	if (source.kind === "pptx") {
		const bytes = (source.bytes ?? read?.bytes) as Uint8Array;
		const result = await inStep(OPFImportError, "import-failed", () => importPresentation(bytes, { catalogs, signals: options.signals === true }, pptx));
		imported = result.result;
		presentation = result.result.presentation;
		check = result.check;
		findings = result.result.findings;
	} else {
		const report: ValidationReport & { presentation?: Presentation } =
			source.kind === "deck" ? readDeckReport(Buffer.from((read as NonNullable<typeof read>).bytes).toString("utf8"), { format: source.format, validate: checkOptions(catalogs) }, "convert") : validate(input, checkOptions(catalogs));
		if (!report.valid) throw new ExportClass(`${inputFile ?? "The presentation"} is not valid OPF: ${firstError(report.findings)}`, "invalid-presentation", { findings: report.findings });
		presentation = source.kind === "deck" ? (report.presentation as Presentation) : (input as Presentation);
		check = report;
		findings = report.findings;
	}
	const base = { check, format: target.format, zip: target.kind === "export" && target.zip, ...(read ? { input: read } : {}), ...(imported ? { imported } : {}) };

	if (target.kind === "deck") {
		const bytes = new TextEncoder().encode(deckText(presentation, target.format));
		const extension = `opf.${target.format === "markdown" ? "md" : target.format}`;
		const name = output === undefined ? `${options.name ?? (inputFile === undefined ? stemOfDeck(presentation) : fileStem(inputFile))}.${extension}` : path.basename(output);
		return { ...base, files: [{ name, ...(output === undefined ? {} : { path: output }), type: DECK_MEDIA[target.format], bytes }], findings };
	}

	// Without an output path the files are named as the commands name them: by `name`, else the deck, else the input file.
	if (output === undefined && prepared) prepared.options = { ...prepared.options, name: options.name ?? deckStem(presentation, inputFile === undefined ? "-" : fileStem(inputFile)) };
	const exported = await inStep(OPFExportError, "export-failed", () => runPreparedExport(prepared as PreparedExport, presentation, findings));
	const drawn = exported.files;
	const facts = (file: ExportFile) => ({
		...(file.slide === undefined ? {} : { slide: file.slide }),
		...(file.id === undefined ? {} : { id: file.id }),
		...(file.width === undefined || file.height === undefined ? {} : { width: file.width, height: file.height }),
		...(file.pages === undefined ? {} : { pages: file.pages }),
		...(file.slides === undefined ? {} : { slides: file.slides }),
		...(file.entries === undefined ? {} : { entries: file.entries }),
	});
	const done = (files: ConvertedFile[]): ConversionPlan => ({ ...base, exported, findings: exported.findings, files });
	if (output === undefined) return done(drawn.map((file) => ({ name: file.name, type: file.type, bytes: file.bytes, ...facts(file) })));

	const single = (file: ExportFile) => done([{ name: path.basename(output), path: output, type: file.type, bytes: file.bytes, ...facts(file) }]);
	if (target.format === "pdf" || target.format === "pptx") return single(drawn[0] as ExportFile);
	// One file per slide, numbered to the width of the largest slide number written (`1` to `9`, `01` to `99`, `001`...).
	const largest = Math.max(...drawn.map((file) => file.slide ?? 0));
	const stem = path.basename(output, path.extname(output));
	const numbered = (file: ExportFile) => `${stem}-${padNumber(file.slide as number, largest)}.${target.format}`;
	if (target.zip) {
		const entries = drawn.map((file) => ({ name: numbered(file), bytes: file.bytes }));
		return done([{ name: path.basename(output), path: output, type: ZIP_MEDIA, bytes: createZip(entries), entries: entries.map((entry) => entry.name).sort() }]);
	}
	// A pattern (`slides/slide-{n}.png`) always numbers the files, one slide or many: {n} is the deck's slide number.
	if (checkOutputPattern(output, true)) {
		return done(
			drawn.map((file) => {
				const written = expandOutputPattern(output, file.slide as number, largest);
				return { name: path.basename(written), path: written, type: file.type, bytes: file.bytes, ...facts(file) };
			}),
		);
	}
	// Without a pattern one slide is written to the output name itself (`opf convert deck.opf.json slide.png --slides 2`); more are numbered beside it.
	if (drawn.length === 1) return single(drawn[0] as ExportFile);
	const folder = path.dirname(output);
	return done(drawn.map((file) => ({ name: numbered(file), path: path.join(folder, numbered(file)), type: file.type, bytes: file.bytes, ...facts(file) })));
}

/**
 * Write planned files atomically (temporary sibling, then rename), creating folders. `overwrite` false refuses an existing output
 * (`output-exists`): the opf commands pass it unless `--force`; `convert` passes its `overwrite` option, true by default.
 */
export async function writePlanned(files: readonly ConvertedFile[], overwrite: boolean, flags = false): Promise<void> {
	try {
		await writeFiles(
			files.map((file) => ({ file: file.path as string, bytes: file.bytes })),
			overwrite,
			flags,
		);
	} catch (error) {
		if (error instanceof OPFApiError) throw error;
		const reason = (error as NodeJS.ErrnoException).code ?? (error as Error).message;
		throw new OPFApiError(`Cannot write the output: ${(error as Error).message ?? reason}`, "output-unwritable", { details: { reason }, cause: error });
	}
}

/** `convert`: plan, then write (with an output path) or return the bytes (without one). */
export async function convertFiles(input: ConvertInput, output: string | undefined, options: ConvertOptions = {}): Promise<ConvertResult> {
	const plan = await planConversion(input, output, options);
	if (output !== undefined) await writePlanned(plan.files, options.overwrite !== false);
	return { files: plan.files, findings: plan.findings, ...(plan.imported?.signals ? { signals: plan.imported.signals } : {}) };
}

/** `open`: a deck file read and checked, or a PowerPoint file (a path or its bytes) imported. */
export async function openDeck(input: string | Uint8Array | ArrayBuffer, options: OpenOptions = {}): Promise<Presentation> {
	const catalogs = options.catalogs ?? DEFAULT_CATALOGS;
	if (input instanceof Uint8Array || input instanceof ArrayBuffer || (typeof input === "string" && /\.pptx$/i.test(input))) {
		const bytes = typeof input === "string" ? await readInput(input) : input instanceof Uint8Array ? input : new Uint8Array(input);
		return (await inStep(OPFImportError, "import-failed", () => importPresentation(bytes, { catalogs }))).result.presentation;
	}
	if (typeof input !== "string" || !input) throw invalid("open takes a file path or the bytes of a .pptx file.");
	const format = deckFileFormat(input);
	if (!format) throw invalid(`open reads ${DECKS} and .pptx files; ${input} is none of them.`, { path: input });
	const text = Buffer.from(await readInput(input)).toString("utf8");
	const { presentation, format: _format, ...report }: DeckReport = readDeckReport(text, { format, catalogs, validate: checkOptions(catalogs) }, "open");
	if (!report.valid) throw new OPFValidationError(report);
	return presentation;
}

/** `save`: a deck checked (unless `validate: false`) and written in the form its file name names. */
export async function saveDeck(presentation: Presentation, file: string, options: SaveOptions = {}): Promise<SaveResult> {
	if (!presentation || typeof presentation !== "object" || Array.isArray(presentation)) throw invalid("save takes a presentation object.");
	if (typeof file !== "string" || !file) throw invalid("save takes a file path.");
	const format = deckFileFormat(file);
	if (!format) throw invalid(`save writes ${DECKS} files; ${file} is none of them.${exportFormatOf(file) || /\.zip$/i.test(file) ? ` Export with convert(deck, "${file}").` : ""}`, { path: file });
	if (options.validate !== false) {
		const report = validate(presentation, checkOptions(options.catalogs ?? DEFAULT_CATALOGS));
		if (!report.valid) throw new OPFValidationError(report);
	}
	const bytes = new TextEncoder().encode(deckText(presentation, format, options.schemaComment === true));
	// A save replaces the file it names (atomically); a symlink or a non-regular file is never replaced.
	await writePlanned([{ name: path.basename(file), path: file, type: DECK_MEDIA[format], bytes }], true);
	return { path: file, format };
}
