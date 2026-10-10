// What every command shares (RR-75): the one report envelope, the --fail-on check, reading a deck with --from, and the one
// output convention for a command that writes a deck:
//
//   opf <command> <input> [output]     an optional positional output; stdout when it is omitted or `-`
//   -i, --in-place                     rewrite the input (refused for stdin; never with an output)
//   --check                            write nothing and exit 1 when the command would change something (format, embed, paginate)
//   --force                            replace an existing output
//
// The report is JSON: `{ command, ok, input, outputs: [{ file, sha256, bytes, mediaType }], findings, counts, ... }`, on stdout,
// or on stderr when stdout carries the document. Errors carry `code`.
import path from "node:path";
import { type Finding, type FindingSeverity, validate } from "@openpresentation/opf";
import { FAIL_ON_MESSAGE, WRITE_CHECK, parseFailOn, reaches } from "./check.js";
import { DECK_MEDIA, type DeckFormat, type DeckSource, commentWarning, decode, fenceWarning, inputFormatOf, namedFormatOf, outputFormatOf, serialize } from "./deck.js";
import { CliError, usage } from "./errors.js";
import { byteLength, checkOutput, json, readText, samePath, saveText, sha256 } from "./io.js";

export type Options = Record<string, string | true>;

/** The versions the reports name. */
export interface Host {
	cliVersion: string;
	opfVersion: string;
}

/** A file a command read: its absolute path (or `-`), digest and size. */
export interface InputFact {
	file: string;
	sha256: string;
	bytes: number;
}

/** A file a command wrote (or would write, with `--check` or a failure: `planned: true`). */
export interface OutputFact {
	file: string;
	sha256: string;
	bytes: number;
	mediaType: string;
	[detail: string]: unknown;
}

export interface Report {
	command: string;
	ok: boolean;
	input: InputFact | InputFact[] | null;
	outputs: OutputFact[];
	findings: Finding[];
	counts: Record<FindingSeverity, number>;
	[field: string]: unknown;
}

export const countsOf = (findings: readonly { severity: FindingSeverity }[]): Record<FindingSeverity, number> => {
	const counts = { error: 0, warning: 0, info: 0 };
	for (const finding of findings) counts[finding.severity] += 1;
	return counts;
};

/** The envelope: the shared fields first, in one order, then the command's own. */
export function envelope(command: string, fields: { ok?: boolean; input?: Report["input"]; outputs?: OutputFact[]; findings?: Finding[] } & Record<string, unknown>): Report {
	const { ok = true, input = null, outputs = [], findings = [], ...rest } = fields;
	return { command, ok, input, outputs, findings, counts: countsOf(findings), ...rest };
}

/** Print a report: on stderr when stdout carries a document. */
export function printReport(report: Report, toStderr = false): void {
	(toStderr ? process.stderr : process.stdout).write(json(report));
}

export const inputFact = (file: string, raw: string | Uint8Array): InputFact => ({ file: file === "-" ? "-" : path.resolve(file), sha256: sha256(raw), bytes: byteLength(raw) });
export const outputFact = (file: string, content: string | Uint8Array, mediaType: string, extra: Record<string, unknown> = {}): OutputFact => ({ file: file === "-" ? "-" : path.resolve(file), sha256: sha256(content), bytes: byteLength(content), mediaType, ...extra });

/** The `--fail-on` level of a command's options: findings at or above it fail the command (default error). */
export function failOnOf(options: Options): FindingSeverity {
	const level = parseFailOn(options["fail-on"]);
	if (!level) throw usage(FAIL_ON_MESSAGE, "invalid-value", { option: "--fail-on" });
	return level;
}

/** The failure of a document that fails its check or has findings at --fail-on: exit 1, the findings in the error report. */
export function documentFailure(command: string, message: string, findings: readonly Finding[], fields: Record<string, unknown> = {}): CliError {
	const invalid = findings.some((finding) => finding.severity === "error");
	return new CliError(message, invalid ? "invalid-document" : "findings-at-fail-on", 1, { command, ...fields, findings, counts: countsOf(findings) });
}

/** The format and references check a command runs on a deck it is about to write. */
export function checked(command: string, document: unknown, failOn: FindingSeverity) {
	const report = validate(document, WRITE_CHECK);
	if (!report.valid || reaches(report.findings, failOn)) throw documentFailure(command, report.valid ? `Findings at or above --fail-on ${failOn}; nothing was written.` : "The document is not valid OPF; nothing was written.", report.findings);
	return report;
}

/**
 * Read a deck (or a JSON or YAML patch) from a file or stdin: `from` (`--from`), else the name, else sniffed. `rewrite` warns
 * on stderr when the command will rewrite a YAML file and its comments would be lost.
 */
export async function readDeck(file: string, options: { from?: DeckFormat; rewrite?: boolean; kind?: "deck" | "patch" } = {}): Promise<DeckSource> {
	const raw = await readText(file);
	const kind = options.kind ?? "deck";
	// A patch is JSON or YAML: a name that says neither is JSON when it starts with { or [, else YAML.
	const format = kind === "patch" ? (options.from ?? namedFormatOf(file) ?? (/^[\s\uFEFF]*[[{]/.test(raw) ? "json" : "yaml")) : inputFormatOf(file, raw, options.from);
	const source = decode(raw, file, format, kind);
	const warning = options.rewrite ? commentWarning(source, file) : undefined;
	if (warning) process.stderr.write(warning);
	return source;
}

/** Where a command that writes a deck writes it. */
export interface Destination {
	/** `-` for stdout, else the file. */
	file: string;
	inPlace: boolean;
	/** `--check`: nothing is written. */
	check: boolean;
	/** Replace an existing file: `--force`, or `-i`. */
	overwrite: boolean;
}

/**
 * The output convention: `output` (the optional trailing positional), `-i`/`--in-place` (rewrite `input`), `--check` (where the
 * command has it), `--force`. Usage errors state which combination is refused.
 */
export function destinationOf(command: string, input: string, output: string | undefined, options: Options): Destination {
	const inPlace = options["in-place"] === true;
	const check = options.check === true;
	if (inPlace && check) throw usage("Use -i or --check, not both.");
	if (inPlace && output !== undefined) throw usage(`-i rewrites ${input}; it takes no output (${output}).`);
	if (inPlace && input === "-") throw usage("stdin cannot be rewritten in place: give a file, or omit -i to print the result.");
	if (inPlace && options.force) throw usage("-i replaces the input already; drop --force.");
	if (check && output !== undefined) throw usage(`--check writes nothing; it takes no output (${output}).`);
	if (check && options.force) throw usage("--check writes nothing; drop --force.");
	const file = inPlace ? input : (output ?? "-");
	if (file === "-" && options.force) throw usage("--force replaces an output file; stdout needs none.");
	return { file, inPlace, check, overwrite: inPlace || options.force === true };
}

export interface WriteDeckOptions {
	/** The deck that was read: its form is the default output form, and its raw text guards an in-place rewrite. */
	source?: DeckSource;
	/** The input file (`-` for stdin), for the in-place guard and the report. */
	inputFile?: string;
	/** `--to`. */
	to?: DeckFormat;
	schemaComment?: boolean;
	failOn: FindingSeverity;
	/** The report's `input`. */
	input?: Report["input"];
	/** More fields of the report. */
	extra?: Record<string, unknown>;
	/** Findings of the command itself (pagination, an import), added to the check's. */
	findings?: Finding[];
}

/**
 * Check a deck (format and references, --fail-on), then write it where `destination` says, in the form `--to`, the output name
 * or the source names, and print the report. An existing output is refused before anything is printed.
 */
export async function writeDeck(command: string, document: unknown, destination: Destination, options: WriteDeckOptions): Promise<void> {
	const check = checked(command, document, options.failOn);
	const findings = [...(options.findings ?? []), ...check.findings];
	const format = outputFormatOf(destination.file, options.to, options.source);
	if (destination.file !== "-") await checkOutput(destination.file, destination.overwrite);
	const text = serialize(document, format, { schemaComment: options.schemaComment === true, modeline: format === "yaml" ? options.source?.yaml?.modeline : undefined });
	const toStdout = destination.file === "-";
	const fences = format === "markdown" ? fenceWarning(text, options.source, toStdout ? "the output" : destination.file) : undefined;
	if (fences) process.stderr.write(fences);
	const sameFile = options.inputFile !== undefined && options.inputFile !== "-" && !toStdout && samePath(options.inputFile, destination.file);
	if (toStdout) process.stdout.write(text);
	else await saveText(destination.file, text, destination.overwrite, sameFile && options.source ? { file: options.inputFile as string, raw: options.source.raw } : undefined);
	printReport(envelope(command, { input: options.input ?? null, outputs: [outputFact(destination.file, text, DECK_MEDIA[format])], findings, ...options.extra }), toStdout);
}
