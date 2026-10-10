// `opf convert <input> <output>` (RR-75): every change of format, the formats named by the file names or by --from and --to.
// It absorbed render, export, import, from-md, to-md, from-yaml and to-yaml. Input: a deck (.json, .opf.yaml, .yml, .opf.md, and a
// plain .md, read as OPF Markdown), a PowerPoint file (.pptx), or stdin (`-`, with --from or sniffed). Output: a deck form, a PDF,
// a PPTX, one PNG or SVG per slide beside the output, a .zip of the slides, or stdout (`-`, with --to). A flag applies only when its
// format is involved; any other use is a usage error (exit 2). Drawing and PowerPoint run core's export engine
// (`@openpresentation/opf/internal/engine`, the engine of `convert` of `@openpresentation/opf`) through the optional peers.
import path from "node:path";
import { type ConvertOptions, type ConvertedFile, type Finding, type FindingSeverity, type Presentation } from "@openpresentation/opf";
import { fromYaml } from "@openpresentation/opf/yaml";
import { type ConversionPlan, OPFApiError, exportFormatOf, importPresentation, loadPptx, planConversion, writePlanned } from "@openpresentation/opf/internal/engine";
import { fromMarkdown, toMarkdown } from "@openpresentation/opf/markdown";
import { type CommandSpec, oneOf, parseArgs, printHelp } from "./args.js";
import { CLI_CATALOGS } from "./catalogs.js";
import { WRITE_CHECK, reaches } from "./check.js";
import { DECK_MEDIA, type DeckFormat, checkText, fenceWarning, formatNamed, nameOf, namedFormatOf, readFailure, serialize } from "./deck.js";
import { CliError, fromApiError, usage } from "./errors.js";
import { type DoctorFormat, hasPictures, installHint } from "./install.js";
import { checkOutput, json, readBytes, samePath, saveText } from "./io.js";
import { type Host, type OutputFact, documentFailure, envelope, failOnOf, inputFact, outputFact, printReport } from "./runtime.js";

type ExportTarget = "pdf" | "pptx" | "png" | "svg";
type Target = { kind: "deck"; format: DeckFormat } | { kind: "export"; format: ExportTarget; zip: boolean };

const MD_INPUT = ["split", "title"] as const;
const YAML_INPUT = ["aliases"] as const;
const PPTX_INPUT = ["signals"] as const;
const EXPORT_ONLY = ["slides", "include-hidden", "paginate", "scale", "raster", "text", "charts", "provenance", "images", "date", "asset-dir", "fonts"] as const;
const MEDIA: Record<string, string> = { svg: "image/svg+xml", png: "image/png", pdf: "application/pdf", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", zip: "application/zip" };

export const spec: CommandSpec = {
	name: "convert",
	usage: ["opf convert <input|-> <output|-> [--from <format>] [--to <format>] [--force] [--fail-on <level>] [format flags]"],
	summary: "Convert a deck or a .pptx to another form: a deck form, PDF, PPTX, PNG or SVG per slide, a .zip of slides, or stdout.",
	operands: ["<input> (a deck, a .pptx, or - for stdin)", "<output> (a file whose extension names the format, or - for stdout with --to)"],
	positional: [2, 2],
	values: ["from", "to", "fail-on", "split", "title", "signals", "slides", "scale", "text", "charts", "provenance", "images", "date", "asset-dir"],
	repeated: ["fonts"],
	flags: ["force", "aliases", "schema-comment", "drop-unsupported", "include-hidden", "paginate", "raster"],
	help: `Formats. Input: .json, .opf.yaml/.yaml/.yml, .opf.md and a plain .md (OPF Markdown, an outline included), .pptx, or -
(stdin: --from json|yaml|md|pptx, else text starting with { or [ is JSON). Output: .json, .opf.yaml/.yml, .opf.md, .pdf, .pptx,
.png and .svg (one file per slide beside the output: slides/deck.png gives slides/deck-001.png; one selected slide is written
to the output itself), .zip (the slides as png, or svg with --to svg), or - (stdout: --to json|yaml|md|pdf|pptx|png|svg|zip;
png and svg need exactly one slide). --to that disagrees with the output's extension is refused.

Flags, each only where its format is involved (otherwise exit 2):
  Markdown input   --split <auto|rules|headings>  slides at --- lines, and in an outline with none at # headings (auto, the default)
                   --title <text>                 the deck name unless the front matter sets one
  YAML input       --aliases                      expand anchors, aliases and merge keys (at most 100)
  .pptx input      --signals <file>               also write the per-shape layout and style signals as JSON
  YAML output      --schema-comment               start with the yaml-language-server $schema line
  Markdown output  --drop-unsupported             leave out what the dialect has no syntax for (listed as loss) instead of
                                                  embedding it as YAML in a fence
  pdf, png, svg    --slides <1,3-5>  --include-hidden
  pdf, png, svg,   --paginate  --date <YYYY-MM-DD>  --fonts <dir>... (.ttf and .otf files)  --asset-dir <dir>
  and pptx
  pptx             --charts <auto|native|picture>  --images <compatible|preserve>  --provenance <full|references-only|none>
  png, raster pdf  --scale <0.1-8>                1 draws the 1280 x 720 reference slide at 1280 x 720 pixels
  pdf              --raster                       each page a picture instead of selectable vector text
  svg              --text <fonts|system|paths>    embed the faces the slide uses (fonts), none (system), or draw outlines (paths)

The deck is checked (format and references) first; findings at or above --fail-on (default error) write nothing (exit 1). An
existing output needs --force. Drawing never loads system fonts and never fetches URLs; images resolve next to the input unless
--asset-dir. PDF, PNG, SVG and PPTX need the optional @openpresentation/opf-render (and opf-pptx for .pptx); a missing one is
exit 2 with the one command that installs it (see opf doctor). The report: { command, ok, input, outputs: [{ file, sha256,
bytes, mediaType }], findings, counts, format, ... }, on stderr when the output is stdout.

Examples:
  opf convert deck.opf.md slides/deck.png --slides 1,3-5 --scale 2
  opf convert deck.pptx deck.opf.md --signals signals.json
  opf convert outline.md deck.opf.yaml
  opf convert deck.opf.json deck.opf.yaml --schema-comment
  opf convert deck.opf.md - --to pdf > deck.pdf`,
};

const SOURCE_FORMATS = ["json", "yaml", "md", "markdown", "pptx"] as const;
const TARGET_FORMATS = ["json", "yaml", "md", "markdown", "pdf", "pptx", "png", "svg", "zip"] as const;

/** The flags of `names` that were given. */
const given = (options: Record<string, string | true>, repeated: Record<string, string[]>, names: readonly string[]) => names.filter((name) => options[name] !== undefined || repeated[name]?.length);
const flagList = (names: string[]) => names.map((name) => `--${name}`).join(", ");

function targetOf(output: string, to: (typeof TARGET_FORMATS)[number] | undefined): Target {
	const deckTo = formatNamed(to);
	if (output === "-") {
		if (to === undefined) throw usage("Writing to stdout needs --to: json, yaml, md, pdf, pptx, png, svg or zip.", "missing-value", { option: "--to" });
		if (deckTo) return { kind: "deck", format: deckTo };
		return to === "zip" ? { kind: "export", format: "png", zip: true } : { kind: "export", format: to as ExportTarget, zip: false };
	}
	if (path.extname(output).toLowerCase() === ".zip") {
		if (to !== undefined && to !== "png" && to !== "svg") throw usage(`A .zip output holds png or svg slides; --to ${to} is neither.`, "invalid-value", { option: "--to" });
		return { kind: "export", format: (to ?? "png") as "png" | "svg", zip: true };
	}
	const exported = exportFormatOf(output);
	const deck = exported ? undefined : namedFormatOf(output);
	if (!exported && !deck) {
		if (/\.md$/i.test(output)) throw usage(`Name a Markdown deck output .opf.md (${output} is a plain .md, which only an input may be).`, "invalid-output-name", { file: output });
		throw usage(`opf convert writes .json, .opf.yaml, .yml, .opf.md, .pdf, .pptx, .png, .svg or .zip files, or - with --to; ${output} is none of them.`, "invalid-output-name", { file: output });
	}
	const named = (exported ?? deck) as string;
	if (to !== undefined && (deckTo ?? to) !== named) throw usage(`--to ${to} does not match the output ${output}, which is ${named === "markdown" ? "md" : named}.`, "invalid-value", { option: "--to" });
	return exported ? { kind: "export", format: exported, zip: false } : { kind: "deck", format: deck as DeckFormat };
}

/** The format the install hint is for. */
const hintFormat = (target: Extract<Target, { kind: "export" }>, raster: boolean): DoctorFormat => (target.format === "pdf" && raster ? "pdf-raster" : target.format);

function sourceOf(input: string, raw: string, from: (typeof SOURCE_FORMATS)[number] | undefined): DeckFormat | "pptx" {
	if (from === "pptx" || (from === undefined && input !== "-" && /\.pptx$/i.test(input))) return "pptx";
	const format = formatNamed(from) ?? namedFormatOf(input, true);
	if (format) return format;
	if (/^[\s\uFEFF]*[[{]/.test(raw)) return "json";
	throw usage(`Cannot tell the form of ${nameOf(input)}: JSON starts with { or [. Pass --from yaml|md|pptx (or --from json).`, "unknown-input-format", { file: nameOf(input) });
}

export async function run(args: string[], host: Host): Promise<void> {
	const parsed = parseArgs(spec, args);
	if (parsed === "help") return printHelp(spec);
	const { positional, options, repeated } = parsed;
	const [input, output] = positional as [string, string];
	const from = oneOf("--from", options.from, SOURCE_FORMATS);
	const to = oneOf("--to", options.to, TARGET_FORMATS);
	const failOn = failOnOf(options);
	const target = targetOf(output, to);
	oneOf("--charts", options.charts, ["auto", "native", "picture"] as const);
	oneOf("--provenance", options.provenance, ["full", "references-only", "none"] as const);
	oneOf("--images", options.images, ["compatible", "preserve"] as const);
	oneOf("--text", options.text, ["fonts", "system", "paths"] as const);

	// Output-side scope, before anything is read.
	const exportFlags = given(options, repeated, EXPORT_ONLY);
	if (target.kind === "deck" && exportFlags.length) throw usage(`${flagList(exportFlags)} ${exportFlags.length === 1 ? "applies" : "apply"} to pdf, pptx, png and svg outputs, not to a deck written as ${target.format === "markdown" ? "md" : target.format}.`, "option-not-applicable", { options: exportFlags.map((name) => `--${name}`) });
	if (options["schema-comment"] && !(target.kind === "deck" && target.format === "yaml")) throw usage("--schema-comment applies to a YAML output.", "option-not-applicable", { option: "--schema-comment" });
	if (options["drop-unsupported"] && !(target.kind === "deck" && target.format === "markdown")) throw usage("--drop-unsupported applies to a Markdown (.opf.md) output.", "option-not-applicable", { option: "--drop-unsupported" });
	const split = oneOf("--split", options.split, ["auto", "rules", "headings"] as const);
	const signalsFile = options.signals === undefined ? undefined : String(options.signals);
	if (signalsFile !== undefined && (signalsFile === "-" || (output !== "-" && samePath(signalsFile, output)))) throw usage("--signals needs a file of its own: not -, and not the output.", "invalid-value", { option: "--signals" });
	if (input !== "-" && output !== "-" && samePath(input, output)) throw usage(`The input and the output are the same file (${output}).`);

	// The input and its form.
	const bytes = await readBytes(input);
	const raw = Buffer.from(bytes).toString("utf8");
	const sourceFormat = sourceOf(input, raw, from);
	const scoped = (names: readonly string[], applies: boolean, what: string) => {
		const used = given(options, repeated, names);
		if (used.length && !applies) throw usage(`${flagList(used)} ${used.length === 1 ? "applies" : "apply"} to ${what}.`, "option-not-applicable", { options: used.map((name) => `--${name}`) });
	};
	scoped(MD_INPUT, sourceFormat === "markdown", "a Markdown input (.md, .opf.md or --from md)");
	scoped(YAML_INPUT, sourceFormat === "yaml", "a YAML input");
	scoped(PPTX_INPUT, sourceFormat === "pptx", "a .pptx input");
	const inputReport = inputFact(input, bytes);
	const context = { input: inputReport, opfVersion: host.opfVersion, cli: host.cliVersion };

	try {
		if (sourceFormat === "pptx" && target.kind === "export") return await exportDeck(bytes, input, output, target, options, repeated, failOn, context, undefined);
		// The deck, read and checked, every finding located in its text.
		let presentation: Presentation;
		let findings: Finding[];
		let signals: { version?: number } | undefined;
		let importer: { package: string; version: string } | undefined;
		if (sourceFormat === "pptx") {
			const imported = await importPresentation(bytes, { catalogs: CLI_CATALOGS, signals: signalsFile !== undefined }, await loadPptx());
			presentation = imported.result.presentation;
			findings = imported.result.findings;
			signals = imported.result.signals;
			importer = imported.result.pptx;
		} else {
			const report =
				sourceFormat === "markdown"
					? fromMarkdown(raw, { catalogs: CLI_CATALOGS, validate: WRITE_CHECK, ...(split ? { split } : {}), ...(options.title !== undefined ? { defaults: { name: String(options.title) } } : {}) })
					: sourceFormat === "yaml"
						? fromYaml(raw, { catalogs: CLI_CATALOGS, validate: WRITE_CHECK, aliases: options.aliases === true })
						: (() => {
								const checked = checkText(raw, "json", WRITE_CHECK);
								return { ...checked.report, presentation: checked.deck as unknown as Presentation };
							})();
			if (sourceFormat === "json" ? report.schemaValid === null : report.findings.some((found) => found.severity === "error" && /^(yaml|markdown)\//.test(found.ruleId)))
				throw readFailure(nameOf(input), sourceFormat, report.findings.filter((found) => found.severity === "error" && (sourceFormat === "json" || /^(yaml|markdown)\//.test(found.ruleId))));
			if (!report.valid) throw documentFailure("convert", `${nameOf(input)} is not valid OPF; nothing was written.`, report.findings, { input: inputReport });
			presentation = report.presentation as Presentation;
			findings = report.findings;
		}
		if (target.kind === "export") return await exportDeck(presentation, input, output, target, options, repeated, failOn, context, findings);

		// A deck written as a deck.
		let text: string;
		let markdown: Record<string, unknown> | undefined;
		if (target.format === "markdown") {
			const written = toMarkdown(presentation, { unsupported: options["drop-unsupported"] ? "drop" : "embed" });
			text = written.markdown;
			markdown = { lossless: written.report.lossless, native: written.report.native, embedded: written.report.embedded, loss: written.report.loss };
			// A part the dialect has no syntax for is a warning, not an error: the Markdown is complete (embedded) or says what it left out.
			if (!written.report.native) {
				const dropped = options["drop-unsupported"] === true;
				const count = dropped ? written.report.loss.length : written.report.embedded.length;
				findings = [
					...findings,
					{
						ruleId: dropped ? "markdown/dropped" : "markdown/embedded",
						severity: "warning",
						category: "format",
						path: "",
						scope: "document",
						message: dropped ? `${count} part(s) have no Markdown syntax and were left out.` : `${count} part(s) have no Markdown syntax and are embedded as YAML in opf-slide or opf-block fences (nothing is lost).`,
						help: dropped ? "See markdown.loss in the report." : "See markdown.embedded in the report; --drop-unsupported leaves them out.",
					} as Finding,
				];
			}
		} else text = serialize(presentation, target.format, { schemaComment: options["schema-comment"] === true });
		const planned = [outputFact(output, text, DECK_MEDIA[target.format])];
		const extra = { format: target.format, ...(markdown ? { markdown } : {}), ...(importer ? { pptx: importer } : {}), opfVersion: host.opfVersion, cli: host.cliVersion };
		if (reaches(findings, failOn)) throw documentFailure("convert", `Findings at or above --fail-on ${failOn}; nothing was written.`, findings, { input: inputReport, outputs: planned.map((item) => ({ ...item, planned: true })) });
		const toStdout = output === "-";
		if (!toStdout) await checkOutput(output, options.force === true);
		if (signalsFile !== undefined) await checkOutput(signalsFile, options.force === true);
		const fences = target.format === "markdown" ? fenceWarning(text, sourceFormat === "pptx" ? undefined : { format: sourceFormat, raw }, toStdout ? "the output" : output) : undefined;
		if (fences) process.stderr.write(fences);
		const outputs: OutputFact[] = [...planned];
		if (toStdout) process.stdout.write(text);
		else await saveText(output, text, options.force === true);
		if (signalsFile !== undefined && signals) {
			const signalsText = json(signals);
			await saveText(signalsFile, signalsText, options.force === true);
			outputs.push(outputFact(signalsFile, signalsText, "application/json", { signals: signals.version ?? null }));
		}
		printReport(envelope("convert", { input: inputReport, outputs, findings, ...extra, written: true }), toStdout);
	} catch (error) {
		throw explainPeer(error, target, options.raster === true, sourceFormat === "pptx" ? undefined : raw, sourceFormat);
	}
}

/** A missing or old peer, with the one command that installs what this conversion needs. */
function explainPeer(error: unknown, target: Target, raster: boolean, raw: string | undefined, sourceFormat: DeckFormat | "pptx"): unknown {
	if (!(error instanceof OPFApiError) || (error.code !== "peer-not-installed" && error.code !== "peer-too-old")) return error;
	let pictures = false;
	try {
		pictures = raw !== undefined && (sourceFormat === "json" ? hasPictures(JSON.parse(raw.replace(/^\uFEFF/, ""))) : /\.(png|jpe?g|gif|webp)\b/i.test(raw));
	} catch {
		// not JSON: no pictures known
	}
	const formats: DoctorFormat[] = [...(sourceFormat === "pptx" ? (["pptx-import"] as const) : []), ...(target.kind === "export" ? [hintFormat(target, raster)] : [])];
	const missing = [...new Set(formats.flatMap((format) => installHint(format, { pictures })?.missing ?? []))];
	if (!missing.length) return fromApiError(error);
	const install = installHint(formats.at(-1) as DoctorFormat, { pictures })?.install ?? "";
	const all = formats.length > 1 ? (installHint(formats[0] as DoctorFormat, { pictures })?.install ?? "") : "";
	const command = all && all !== install ? `${all} && ${install}` : install;
	return new CliError(`${error.message.split("\n")[0]}\nInstall what this conversion needs with:\n  ${command}`, error.code, 2, { ...error.details, missing, install: command });
}

/** Draw or export through core's engine, then write the files (or stdout). */
async function exportDeck(
	input: Presentation | Uint8Array,
	inputFile: string,
	output: string,
	target: Extract<Target, { kind: "export" }>,
	options: Record<string, string | true>,
	repeated: Record<string, string[]>,
	failOn: FindingSeverity,
	context: { input: ReturnType<typeof inputFact>; opfVersion: string; cli: string },
	located: Finding[] | undefined,
): Promise<void> {
	const text = (key: string) => (options[key] === undefined ? undefined : String(options[key]));
	const toStdout = output === "-";
	const scale = text("scale");
	if (scale !== undefined && (scale.trim() === "" || Number.isNaN(Number(scale)))) throw usage("--scale must be a number from 0.1 to 8 (1 draws the 1280 x 720 reference slide at 1280 x 720 pixels).", "invalid-value", { option: "--scale" });
	const convertOptions = Object.fromEntries(
		Object.entries({
			format: toStdout || target.zip ? target.format : undefined,
			zip: toStdout && target.zip ? true : undefined,
			slides: text("slides"),
			scale: scale === undefined ? undefined : Number(scale),
			date: text("date"),
			assetDir: text("asset-dir") ?? (inputFile === "-" ? process.cwd() : path.dirname(path.resolve(inputFile))),
			text: text("text"),
			raster: options.raster === true ? true : undefined,
			charts: text("charts"),
			provenance: text("provenance"),
			images: text("images"),
			fonts: repeated.fonts,
			paginate: options.paginate === true ? true : undefined,
			includeHidden: options["include-hidden"] === true ? true : undefined,
			// Files are named by the deck, else the input file (`deck` for stdin), as the commands always named them.
			...(toStdout ? { name: inputFile === "-" ? undefined : path.basename(inputFile).replace(/\.(opf\.)?(json|ya?ml|md)$|\.pptx$/i, "") } : {}),
		}).filter(([, value]) => value !== undefined),
	) as ConvertOptions;
	let plan: ConversionPlan;
	try {
		plan = await planConversion(input, toStdout ? undefined : output, convertOptions, true);
	} catch (error) {
		if (error instanceof OPFApiError && error.findings.length && ["invalid-presentation", "export-failed", "import-failed"].includes(error.code)) throw documentFailure("convert", error.message, error.findings, { input: context.input, reason: error.code });
		throw error;
	}
	// The class of bug where `opf render --out deck.png` wrote SVG files: every file must be the format its name and --to say.
	const wanted = MEDIA[target.zip ? "zip" : target.format];
	for (const file of plan.files) if (file.type !== wanted) throw new CliError(`Internal error: ${file.path ?? file.name} would be written as ${file.type}, not ${wanted}. Nothing was written.`, "format-mismatch", 2);
	// The located findings of the check replace the engine's unlocated copy of them; the engines' own findings follow.
	const findings = located ? [...located, ...plan.findings.filter((found) => !/^(opf|yaml|markdown)\//.test(found.ruleId))] : plan.findings;
	const factsOf = (file: ConvertedFile) => ({
		...(file.slide === undefined ? {} : { slide: file.slide, id: file.id }),
		...(file.width === undefined || file.height === undefined ? {} : { width: file.width, height: file.height }),
		...(file.pages === undefined ? {} : { pages: file.pages, slides: file.slides }),
		...(file.entries === undefined ? {} : { entries: file.entries }),
	});
	if (toStdout && plan.files.length !== 1) throw usage(`stdout takes one file, but ${plan.files.length} slides were selected. Choose one slide with --slides, or --to zip, pdf or pptx.`);
	const outputs = plan.files.map((file) => outputFact(toStdout ? "-" : (file.path as string), file.bytes, file.type, factsOf(file)));
	const exported = plan.exported;
	const extra = {
		format: target.format,
		...(target.zip ? { zip: true } : {}),
		opfVersion: context.opfVersion,
		cli: context.cli,
		...(exported ? { renderer: exported.renderer, ...(exported.pptx ? { pptx: exported.pptx } : {}) } : {}),
		...(plan.imported && !exported?.pptx ? { pptx: plan.imported.pptx } : {}),
		...(exported ? { fonts: exported.fonts, ...(exported.pagination ? { pagination: exported.pagination } : {}), ...(exported.pdf ? { pdf: exported.pdf } : {}), ...(target.format !== "pptx" ? { skippedHidden: exported.skippedHidden } : {}) } : {}),
		checks: { ...plan.check.checks, layout: "measured", fonts: "checked", nativeExport: target.format === "pptx" ? "checked" : "not-checked" },
	};
	if (reaches(findings, failOn)) throw documentFailure("convert", `Findings at or above --fail-on ${failOn}; nothing was written.`, findings, { input: context.input, outputs: outputs.map((item) => ({ ...item, planned: true })) });
	if (toStdout) process.stdout.write((plan.files[0] as ConvertedFile).bytes);
	else await writePlanned(plan.files, options.force === true, true);
	printReport(envelope("convert", { input: context.input, outputs, findings, ...extra, written: true }), toStdout);
}
