// `opf import deck.pptx`: a PowerPoint file to an OPF document through opf-pptx `fromPptx`. Import is a conversion,
// not a lossless round trip for arbitrary decks: what it cannot keep is reported as diagnostics. With --signals it also
// writes the raw per-shape layout and style signals of the deck (`fromPptx(bytes, { signals: true })`), deterministic and local.
import { type FindingSeverity, type ValidationReport, validate } from "@openpresentation/opf";
import path from "node:path";
import { FAIL_ON_MESSAGE, WRITE_CHECK, parseFailOn, reaches } from "./check.js";
import { DeckReadError, checkText, deckExtension, fenceWarning, formatNamed, outputFormatOf, serialize, type DeckFormat } from "./deck.js";
import { FileCommandError, arity, json, parseOptions, readBytes, sha256, stemOf, writeFiles } from "./io.js";
import { type Diagnostic, PPTX_PACKAGE, loadPptx } from "./peers.js";
import { Reporter, finishReport, reportThrown } from "./reporter.js";
import type { Host } from "./render.js";

export async function runImportCommand(args: string[], host: Host) {
	try {
		await run(args, host);
	} catch (error) {
		const failure = error instanceof FileCommandError ? error : new FileCommandError(error instanceof Error ? error.message : String(error));
		process.stderr.write(json({ error: failure.message, ...failure.extra }));
		process.exitCode = failure.code;
	}
}

async function run(args: string[], host: Host) {
	const { positional, options } = parseOptions(args, { values: ["out", "signals", "format", "fail-on"], flags: ["force", "json"] });
	arity(positional, 1);
	const input = positional[0] as string;
	if (options.format !== undefined && !formatNamed(options.format)) throw new FileCommandError("--format takes json, yaml or markdown (md).");
	const out = options.out === undefined ? (input === "-" ? "-" : `${stemOf(input)}.${deckExtension(formatNamed(options.format) ?? "json")}`) : String(options.out);
	let outFormat: DeckFormat;
	try {
		outFormat = outputFormatOf(out, options.format);
	} catch (error) {
		throw new FileCommandError(error instanceof DeckReadError ? error.message : String(error));
	}
	const signalsFile = options.signals === undefined ? undefined : String(options.signals);
	const failOn = parseFailOn(options["fail-on"]);
	if (!failOn) throw new FileCommandError(FAIL_ON_MESSAGE);
	if (signalsFile === "-" || (signalsFile !== undefined && out === "-")) throw new FileCommandError("--signals needs a file path and cannot be combined with --out - (stdout carries only the document).");
	if (signalsFile !== undefined && path.resolve(signalsFile) === path.resolve(out)) throw new FileCommandError("--signals and --out name the same file.");

	const pptx = await loadPptx();

	const source = await readBytes(input);
	const reporter = new Reporter();
	let imported: Record<string, unknown>;
	let signals: { version?: number } | undefined;
	try {
		const onDiagnostic = (diagnostic: Diagnostic) => reporter.add("import", diagnostic);
		if (signalsFile !== undefined) {
			const result = (await pptx.module.fromPptx(source.bytes, { onDiagnostic, signals: true })) as unknown as { presentation: Record<string, unknown>; signals: { version?: number } };
			imported = result.presentation;
			signals = result.signals;
		} else imported = await pptx.module.fromPptx(source.bytes, { onDiagnostic });
	} catch (error) {
		reportThrown(reporter, "import", error);
		finishAndPrint(host, pptx.version, input, source.bytes, reporter, undefined, undefined, undefined, failOn, false);
		return;
	}

	// An invalid deck is never written; its report is located in the JSON form, which every deck has.
	const written: DeckFormat = outFormat !== "json" && validate(imported, { only: ["format"] }).valid ? outFormat : "json";
	const text = serialize(imported, written);
	// The check of `opf validate` (format and references), over the document that would be written, so locations point into the output file.
	const { report: check } = checkText(text, written, WRITE_CHECK);
	for (const item of check.findings) reporter.findings.push(item as never);
	if (!check.valid || reporter.failed || reaches(reporter.findings, failOn)) {
		finishAndPrint(host, pptx.version, input, source.bytes, reporter, { check, text }, undefined, undefined, failOn, false);
		return;
	}
	const toStdout = out === "-";
	const planned = [{ file: out, bytes: new TextEncoder().encode(text) }];
	const signalsText = signalsFile !== undefined ? json(signals) : undefined;
	if (signalsFile !== undefined && signalsText !== undefined) planned.push({ file: signalsFile, bytes: new TextEncoder().encode(signalsText) });
	const fences = written === "markdown" ? fenceWarning(text, undefined, toStdout ? "the output" : out) : undefined;
	if (fences) process.stderr.write(fences);
	if (toStdout) process.stdout.write(text);
	else await writeFiles(planned, !!options.force);
	finishAndPrint(host, pptx.version, input, source.bytes, reporter, { check, text }, toStdout ? "-" : path.resolve(out), signalsFile === undefined || signalsText === undefined ? undefined : { file: path.resolve(signalsFile), sha256: sha256(signalsText), version: signals?.version }, failOn, true, toStdout);
}

function finishAndPrint(
	host: Host,
	version: string,
	input: string,
	bytes: Uint8Array,
	reporter: Reporter,
	result: { check: ValidationReport; text: string } | undefined,
	output: string | undefined,
	signals: Record<string, unknown> | undefined,
	failOn: FindingSeverity,
	written: boolean,
	toStdout = false,
) {
	const finished = finishReport(result?.check ?? { valid: true, schemaValid: null, checks: validate("{}", { only: [] }).checks }, reporter, failOn);
	const body = {
		command: "import",
		ok: finished.ok,
		valid: finished.valid,
		schemaValid: result ? finished.schemaValid : null,
		written,
		input: { file: input === "-" ? "-" : path.resolve(input), sha256: sha256(bytes), bytes: bytes.length },
		...(output ? { output, sha256: sha256(result?.text ?? "") } : {}),
		...(signals ? { signals } : {}),
		opfVersion: host.opfVersion,
		cli: host.cliVersion,
		pptx: { package: PPTX_PACKAGE, version },
		findings: finished.findings,
		counts: finished.counts,
		checks: { ...finished.checks, nativeExport: "not-checked" },
	};
	(toStdout ? process.stderr : process.stdout).write(json(body));
	if (!finished.ok) process.exitCode = 1;
}
