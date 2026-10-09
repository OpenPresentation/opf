// `opf render` and `opf export`: per-slide SVG and PNG, PDF and PPTX from an OPF document, through the optional
// peers opf-render and opf-pptx. The command reads the document, checks its format and references with `validate` (the
// check of `opf validate`), runs core's one export engine (`@openpresentation/opf/internal/engine`, the engine behind `convert`
// of `@openpresentation/opf`), and prints one JSON report. Nothing is written when the document is invalid, a render
// error occurred or a finding reaches --fail-on.
import path from "node:path";
import { FAIL_ON_MESSAGE, WRITE_CHECK, parseFailOn } from "./check.js";
import { checkText, inputFormatOf } from "./deck.js";
import { EXPORT_FORMATS, type ExportFile, type ExportFormat, type ExportOptions, OPFApiError, Reporter, VERSIONS, checkDate, checkScale, exportFormatOf, finishReport, listFontDirectories, loadPptx, loadRenderer, resolveExportOptions, runExport } from "@openpresentation/opf/internal/engine";
import { FileCommandError, type PlannedFile, arity, commandError, deckStem, json, parseOptions, readBytes, sha256, writeFiles } from "./io.js";

export interface Host {
	cliVersion: string;
	opfVersion: string;
}

type Format = ExportFormat;
const RASTER_FORMATS = ["svg", "png"] as const;
const SPEC = {
	values: ["slides", "format", "scale", "out", "date", "asset-dir", "svg-fonts", "fail-on"],
	repeated: ["font-dir"],
	flags: ["force", "json", "paginate", "include-hidden"],
};
const EXPORT_SPEC = { ...SPEC, values: [...SPEC.values, "pdf-mode", "chartex", "provenance", "image-format"] };

const oneOf = <T extends string>(name: string, value: string | boolean | undefined, allowed: readonly T[], fallback?: T): T | undefined => {
	if (value === undefined) return fallback;
	if (typeof value !== "string" || !allowed.includes(value as T)) throw new FileCommandError(`${name} must be one of: ${allowed.join(", ")}.`);
	return value as T;
};

/** A check of the engine (an option out of range) as the command's usage error, named as the flag. */
function flagged<T>(check: () => T): T {
	try {
		return check();
	} catch (error) {
		throw error instanceof OPFApiError ? commandError(error) : error;
	}
}

export async function runRenderCommand(command: "render" | "export", args: string[], host: Host) {
	try {
		await run(command, args, host);
	} catch (error) {
		const failure = error instanceof FileCommandError ? error : error instanceof OPFApiError ? commandError(error) : new FileCommandError(error instanceof Error ? error.message : String(error));
		process.stderr.write(json({ error: failure.message, ...failure.extra }));
		process.exitCode = failure.code;
	}
}

async function run(command: "render" | "export", args: string[], host: Host) {
	const { positional, options, repeated } = parseOptions(args, command === "render" ? SPEC : EXPORT_SPEC);
	arity(positional, 1);
	const input = positional[0] as string;
	const out = options.out === undefined ? undefined : String(options.out);

	// Format. `render` is svg or png; `export` also pdf and pptx, and infers the format from --out when it can.
	const allowed: readonly Format[] = command === "render" ? RASTER_FORMATS : EXPORT_FORMATS;
	let format = oneOf<Format>("--format", options.format, allowed);
	// --out names the format by its extension, with the rule `convert` uses (`exportFormatOf`): `--out deck.png` is PNG. A name
	// with another file extension is refused rather than becoming a directory of that name.
	if (out !== undefined && out !== "-") {
		const extension = path.extname(out).toLowerCase();
		const named = exportFormatOf(out);
		if (named && !(allowed as readonly string[]).includes(named)) throw new FileCommandError(`opf render writes svg or png; --out ${out} names a ${named} file. Use opf export (or opf convert) for ${named}.`);
		if (!named && extension !== ".zip" && /^\.[a-z][a-z0-9]{0,4}$/.test(extension))
			throw new FileCommandError(`--out ${out} has an extension opf ${command} does not write. Give a directory, a file ending ${allowed.map((item) => `.${item}`).join(", ")} or .zip, or -.`);
		if (format && named && format !== named) throw new FileCommandError(`--format ${format} does not match --out ${out}, which names a ${named} file.`);
		if (!format && named) format = named;
	}
	if (!format && command === "render") format = "svg";
	if (!format) throw new FileCommandError("opf export needs --format pptx|pdf|png|svg (or an --out file ending in .pptx, .pdf, .png or .svg).");
	if (options["pdf-mode"] !== undefined && format !== "pdf") throw new FileCommandError("--pdf-mode applies to --format pdf.");
	if ((options.chartex !== undefined || options.provenance !== undefined || options["image-format"] !== undefined) && format !== "pptx")
		throw new FileCommandError("--chartex, --provenance and --image-format apply to --format pptx.");
	if (options.scale !== undefined && format !== "png" && format !== "pdf") throw new FileCommandError("--scale applies to --format png (and raster PDF).");
	if (options["include-hidden"] && format === "pptx") throw new FileCommandError("--include-hidden applies to per-slide image and PDF output; the PPTX keeps a hidden slide as a hidden slide.");
	if (options.slides !== undefined && format === "pptx") throw new FileCommandError("--slides is not available for pptx: the whole presentation is exported.");
	if (options["svg-fonts"] !== undefined && format !== "svg") throw new FileCommandError("--svg-fonts applies to --format svg.");
	const pdfMode = oneOf("--pdf-mode", options["pdf-mode"], ["vector", "raster"] as const);
	const chartex = oneOf("--chartex", options.chartex, ["auto", "native", "fallback"] as const);
	const provenance = oneOf("--provenance", options.provenance, ["full", "references-only", "none"] as const);
	const imageFormat = oneOf("--image-format", options["image-format"], ["compatible", "preserve"] as const);
	const svgFonts = oneOf("--svg-fonts", options["svg-fonts"], ["used", "none"] as const);
	const scale = flagged(() => checkScale(options.scale, "--scale"));
	const date = flagged(() => checkDate(options.date, "--date"));
	const failOn = parseFailOn(options["fail-on"]);
	if (!failOn) throw new FileCommandError(FAIL_ON_MESSAGE);

	// Peers load before the document is read, so a missing install is reported at once.
	const renderer = await loadRenderer();
	const pptx = format === "pptx" ? await loadPptx() : undefined;
	const userFonts = await listFontDirectories(repeated["font-dir"] ?? []);

	const { bytes } = await readBytes(input);
	const raw = Buffer.from(bytes).toString("utf8"); // keeps a BOM, like opf validate, so hashes and offsets agree
	const { report: check, deck: checkedDeck } = checkText(raw, inputFormatOf(input), WRITE_CHECK);
	const reporter = new Reporter(check.findings);
	const inputSha = sha256(raw);
	const assetRoot = path.resolve(options["asset-dir"] === undefined ? (input === "-" ? "." : path.dirname(input)) : String(options["asset-dir"]));
	const identity = {
		input: { file: input === "-" ? "-" : path.resolve(input), sha256: inputSha },
		sha256: inputSha,
		opfVersion: host.opfVersion,
		cli: host.cliVersion,
		...VERSIONS(renderer, pptx),
	};
	const toStdout = out === "-";
	const report = (extra: Record<string, unknown>, outputs: unknown[], written: boolean) => {
		const finished = finishReport(check, reporter, failOn);
		const body = { command, format, ok: finished.ok, valid: finished.valid, schemaValid: finished.schemaValid, written, ...identity, ...extra, outputs, findings: finished.findings, counts: finished.counts, checks: { ...finished.checks, layout: "measured", fonts: "checked", nativeExport: format === "pptx" ? "checked" : "not-checked" } };
		(toStdout && written ? process.stderr : process.stdout).write(json(body));
		if (!finished.ok) process.exitCode = 1;
		return finished.ok;
	};

	if (!check.valid) {
		report({}, [], false);
		return;
	}

	// Where svg and png go: one file (--out names a file of the format, or -), one zip (--out ends .zip) or a directory.
	const toFile = out !== undefined && (format === "svg" || format === "png") && (out === "-" || path.extname(out).toLowerCase() === `.${format}`);
	const toZip = out !== undefined && !toFile && (format === "svg" || format === "png") && path.extname(out).toLowerCase() === ".zip";
	const exportOptions: ExportOptions = {
		format,
		assetDir: assetRoot,
		filename: input,
		...(options.scale !== undefined ? { scale } : {}),
		...(svgFonts ? { svgFonts } : {}),
		...(options.slides !== undefined ? { slides: String(options.slides) } : {}),
		...(options["include-hidden"] ? { includeHidden: true } : {}),
		...(options.paginate ? { paginate: true } : {}),
		...(pdfMode ? { pdfMode } : {}),
		...(chartex ? { chartex } : {}),
		...(provenance ? { provenance } : {}),
		...(imageFormat ? { imageFormat } : {}),
		...(date ? { date } : {}),
		...(toZip ? { zip: true } : {}),
	};
	const result = await runExport(checkedDeck, resolveExportOptions(exportOptions), { reporter, renderer, ...(pptx ? { pptx } : {}), userFonts, flags: true });
	const extra = (more: Record<string, unknown> = {}) => ({ fonts: result.fonts, ...(result.pagination ? { pagination: result.pagination } : {}), ...more });
	if (result.failure) {
		report(extra(), [], false);
		return;
	}

	const planned: { file: string; bytes: Uint8Array; entry: Record<string, unknown> }[] = [];
	let tail: Record<string, unknown> = {};
	if (format === "pptx") {
		const file = result.files[0] as ExportFile;
		planned.push({ file: out ?? file.name, bytes: file.bytes, entry: { mediaType: file.type } });
	} else if (format === "pdf") {
		const file = result.files[0] as ExportFile;
		planned.push({ file: out ?? file.name, bytes: file.bytes, entry: { mediaType: file.type, pages: file.pages, slides: file.slides } });
		tail = { pdf: result.pdf, skippedHidden: result.skippedHidden };
	} else if (toZip) {
		const file = result.files[0] as ExportFile;
		planned.push({ file: out as string, bytes: file.bytes, entry: { mediaType: file.type, entries: file.entries } });
		tail = { skippedHidden: result.skippedHidden };
	} else {
		const entryOf = (file: ExportFile) => ({ slide: file.slide, id: file.id, mediaType: file.type, ...(file.width === undefined || file.height === undefined ? {} : { width: file.width, height: file.height }) });
		if (toFile) {
			if (result.files.length !== 1) throw new FileCommandError(`--out ${out} names one file but ${result.files.length} slides were selected. Choose one slide with --slides, or give a directory or a .zip.`);
			const only = result.files[0] as ExportFile;
			planned.push({ file: out as string, bytes: only.bytes, entry: entryOf(only) });
		} else {
			const directory = out ?? `${deckStem(checkedDeck, input)}-slides`;
			for (const file of result.files) planned.push({ file: path.join(directory, file.name), bytes: file.bytes, entry: entryOf(file) });
		}
		tail = { skippedHidden: result.skippedHidden };
	}

	const outputs = planned.map((item) => ({ file: item.file === "-" ? "-" : path.resolve(item.file), ...item.entry, sha256: sha256(item.bytes), bytes: item.bytes.length }));
	const finished = finishReport(check, reporter, failOn);
	if (!finished.ok) {
		report(extra(tail), outputs.map((item) => ({ ...item, planned: true })), false);
		return;
	}
	if (toStdout) {
		if (planned.length !== 1) throw new FileCommandError("--out - needs exactly one output; choose one slide with --slides or a file format.");
		process.stdout.write(planned[0]?.bytes as Uint8Array);
		report(extra(tail), outputs, true);
		return;
	}
	await writeFiles(planned.map((item) => ({ file: item.file, bytes: item.bytes }) as PlannedFile), !!options.force);
	report(extra(tail), outputs, true);
}
