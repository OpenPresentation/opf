// `opf convert <input> <output>`: one file to another, the formats named by the file names, through `convert` of
// `@openpresentation/opf/node` (its plan, conversion.ts in core). The command adds the flags, --fail-on, the JSON report of
// `opf export` and its exit codes: nothing is written when the document is invalid, a step failed or a finding reaches
// --fail-on, and an existing output needs --force.
import path from "node:path";
import { type ConversionPlan, OPFApiError, Reporter, finishReport, planConversion, writePlanned } from "@openpresentation/opf/node/engine";
import type { ConvertOptions } from "@openpresentation/opf/node";
import { FAIL_ON_MESSAGE, parseFailOn } from "./check.js";
import { FileCommandError, arity, commandError, json, parseOptions, sha256 } from "./io.js";
import type { Host } from "./render.js";

const SPEC = {
	values: ["slides", "format", "scale", "date", "asset-dir", "svg-fonts", "fail-on", "pdf-mode", "chartex", "provenance", "image-format"],
	repeated: ["font-dir"],
	flags: ["force", "json", "paginate", "include-hidden"],
};

/** Codes whose findings describe the document: the command prints its report (exit 1) instead of an error. */
const REPORTED = new Set(["invalid-presentation", "export-failed", "import-failed"]);

export const CONVERT_USAGE = `  opf convert <input> <output> [--slides <1,3-5>] [--format <png|svg>] [--scale <0.1-8>] [--pdf-mode <vector|raster>]
           [--chartex <auto|native|fallback>] [--provenance <full|references-only|none>] [--image-format <compatible|preserve>]
           [--svg-fonts <used|none>] [--paginate] [--include-hidden] [--date <YYYY-MM-DD>] [--font-dir <directory>]...
           [--asset-dir <directory>] [--force] [--fail-on <level>] [--json]`;

export async function runConvertCommand(args: string[], host: Host) {
	try {
		await run(args, host);
	} catch (error) {
		const failure = error instanceof FileCommandError ? error : error instanceof OPFApiError ? commandError(error) : new FileCommandError(error instanceof Error ? error.message : String(error));
		process.stderr.write(json({ error: failure.message, ...failure.extra }));
		process.exitCode = failure.code;
	}
}

async function run(args: string[], host: Host) {
	const { positional, options, repeated } = parseOptions(args, SPEC);
	arity(positional, 2);
	const [input, output] = positional as [string, string];
	if (input === "-" || output === "-") throw new FileCommandError("opf convert reads and writes files named by their extensions; use opf export, opf render or opf import for stdin and stdout.");
	const failOn = parseFailOn(options["fail-on"]);
	if (!failOn) throw new FileCommandError(FAIL_ON_MESSAGE);
	const text = (key: string) => (options[key] === undefined ? undefined : String(options[key]));
	const convertOptions = Object.fromEntries(
		Object.entries({
			slides: text("slides"),
			format: text("format"),
			scale: text("scale") === undefined ? undefined : Number(text("scale")),
			date: text("date"),
			assetDir: text("asset-dir"),
			svgFonts: text("svg-fonts"),
			pdfMode: text("pdf-mode"),
			chartex: text("chartex"),
			provenance: text("provenance"),
			imageFormat: text("image-format"),
			fontDirs: repeated["font-dir"],
			paginate: options.paginate === true ? true : undefined,
			includeHidden: options["include-hidden"] === true ? true : undefined,
		}).filter(([, value]) => value !== undefined),
	) as ConvertOptions;
	if (convertOptions.scale !== undefined && Number.isNaN(convertOptions.scale)) throw new FileCommandError("--scale must be a number from 0.1 to 8 (1 draws the 1280 x 720 reference slide at 1280 x 720 pixels).");

	let plan: ConversionPlan;
	try {
		plan = await planConversion(input, output, convertOptions, true);
	} catch (error) {
		if (error instanceof OPFApiError && REPORTED.has(error.code) && error.findings.length) {
			const reporter = new Reporter(error.findings);
			const finished = finishReport({ valid: !error.findings.some((found) => found.severity === "error"), schemaValid: null, checks: {} as never }, reporter, failOn);
			print({ command: "convert", ok: false, valid: false, schemaValid: finished.schemaValid, written: false, input: { file: path.resolve(input) }, opfVersion: host.opfVersion, cli: host.cliVersion, code: error.code, outputs: [], findings: finished.findings, counts: finished.counts });
			process.exitCode = 1;
			return;
		}
		throw error;
	}

	const reporter = new Reporter(plan.findings);
	const exportTarget = plan.exported !== undefined;
	const outputs = plan.files.map((file) => ({
		file: path.resolve(file.path as string),
		mediaType: file.type,
		...(file.slide === undefined ? {} : { slide: file.slide, id: file.id }),
		...(file.width === undefined || file.height === undefined ? {} : { width: file.width, height: file.height }),
		...(file.pages === undefined ? {} : { pages: file.pages, slides: file.slides }),
		...(file.entries === undefined ? {} : { entries: file.entries }),
		sha256: sha256(file.bytes),
		bytes: file.bytes.length,
	}));
	const inputSha = plan.input ? sha256(plan.input.bytes) : undefined;
	const report = (written: boolean) => {
		const finished = finishReport(plan.check, reporter, failOn);
		const engines = {
			...(plan.exported ? { renderer: plan.exported.renderer, ...(plan.exported.pptx ? { pptx: plan.exported.pptx } : {}) } : {}),
			...(plan.imported && !plan.exported?.pptx ? { pptx: plan.imported.pptx } : {}),
		};
		const tail = plan.exported
			? { fonts: plan.exported.fonts, ...(plan.exported.pagination ? { pagination: plan.exported.pagination } : {}), ...(plan.exported.pdf ? { pdf: plan.exported.pdf } : {}), ...(plan.format === "png" || plan.format === "svg" || plan.format === "pdf" ? { skippedHidden: plan.exported.skippedHidden } : {}) }
			: {};
		const body = {
			command: "convert",
			format: plan.format,
			...(plan.zip ? { zip: true } : {}),
			ok: finished.ok,
			valid: finished.valid,
			schemaValid: finished.schemaValid,
			written,
			input: { file: path.resolve(input), ...(inputSha ? { sha256: inputSha } : {}) },
			...(inputSha ? { sha256: inputSha } : {}),
			opfVersion: host.opfVersion,
			cli: host.cliVersion,
			...engines,
			...tail,
			outputs: written ? outputs : outputs.map((item) => ({ ...item, planned: true })),
			findings: finished.findings,
			counts: finished.counts,
			checks: { ...finished.checks, ...(exportTarget ? { layout: "measured", fonts: "checked" } : {}), nativeExport: plan.format === "pptx" ? "checked" : "not-checked" },
		};
		print(body);
		if (!finished.ok) process.exitCode = 1;
		return finished.ok;
	};

	if (!finishReport(plan.check, reporter, failOn).ok) {
		report(false);
		return;
	}
	// The commands refuse an existing output unless --force, while `convert` of /node replaces by default: pass it explicitly.
	const overwrite = options.force === true;
	await writePlanned(plan.files, overwrite, true);
	report(true);
}

function print(body: unknown) {
	process.stdout.write(json(body));
}
