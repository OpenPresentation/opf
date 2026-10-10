// Reading and writing decks in the three serializations OPF has: JSON, the canonical and interchange form, YAML
// (`.opf.yaml`, RR-56) and Markdown (`.opf.md`, RR-60), the authoring forms of the same data. Every command that reads or
// writes a deck goes through here, so a file ending `.yaml`, `.yml` or `.opf.md` works everywhere and `--from` / `--to` (RR-75)
// pick the form for stdin, stdout and other names. Without `--from`, text whose name says no form is sniffed: `{` or `[` is
// JSON, and anything else asks for `--from`. The dialects live in core, which also has the one reader and the one writer used
// here (`readDeckReport`, `stringify`); this file adds what a command needs on top: the CLI's catalogs, the error messages with
// their positions, the YAML modeline and comment count, and the rewrite warnings.
import { type DeckFormat, type Finding, type ValidateOptions, type ValidationReport, deckFormatOf, stringify } from "@openpresentation/opf";
import { readDeckReport } from "@openpresentation/opf/internal/engine";
import { parseYamlData, scanYamlComments } from "@openpresentation/opf/yaml";
import { CLI_CATALOGS } from "./catalogs.js";
import { CliError, usage } from "./errors.js";

export type { DeckFormat };

/** A deck or patch read from a file or stdin. `raw` is the text as read; `value` the decoded data. */
export interface DeckSource {
	raw: string;
	value: unknown;
	format: DeckFormat;
	/** YAML only: the number of comments (a rewrite loses them) and the `# yaml-language-server:` modeline, which a rewrite keeps. */
	yaml?: { comments: number; modeline?: string };
}

/** The names a format goes by in `--from` and `--to`: `md` is `markdown`. */
export function formatNamed(value: unknown): DeckFormat | undefined {
	return value === "json" || value === "yaml" ? value : value === "markdown" || value === "md" ? "markdown" : undefined;
}

/** The value of `--from` or `--to` as a deck form, or a usage error. */
export function deckFormatFlag(flag: "--from" | "--to", value: string | true | undefined): DeckFormat | undefined {
	if (value === undefined) return undefined;
	const format = formatNamed(value);
	if (!format) throw usage(`${flag} takes json, yaml or md.`, "invalid-value", { option: flag });
	return format;
}

export const nameOf = (file: string): string => (file === "-" ? "stdin" : file);

/** The form a deck file's name says: `.opf.md`, `.yaml`, `.yml` or `.json`, and a plain `.md` when `plainMarkdown` (as `opf convert` reads one). */
export function namedFormatOf(file: string, plainMarkdown = false): DeckFormat | undefined {
	if (file === "-") return undefined;
	const named = deckFormatOf(file);
	if (named !== "json") return named;
	if (/\.json$/i.test(file)) return "json";
	return plainMarkdown && /\.md$/i.test(file) ? "markdown" : undefined;
}

/**
 * The form of deck text: `from` (`--from`), else the file's name, else sniffed: text that starts with `{` or `[` is JSON. Anything
 * else is a usage error that asks for `--from`.
 */
export function inputFormatOf(file: string, raw: string, from?: DeckFormat, plainMarkdown = false): DeckFormat {
	const format = from ?? namedFormatOf(file, plainMarkdown);
	if (format) return format;
	if (/^[\s\uFEFF]*[[{]/.test(raw)) return "json";
	throw usage(`Cannot tell the form of ${nameOf(file)}: JSON starts with { or [. Pass --from yaml|md (or --from json).`, "unknown-input-format", { file: nameOf(file) });
}

const LABEL: Record<DeckFormat, string> = { json: "JSON", yaml: "YAML", markdown: "Markdown" };
const KEY: Record<DeckFormat, string> = { json: "invalid-json", yaml: "invalid-yaml", markdown: "invalid-markdown" };

/** The syntax error of deck text, located. */
export function readFailure(name: string, format: DeckFormat, findings: readonly Finding[]): CliError {
	const first = findings[0] as Finding & { location?: { line: number; column: number } };
	const more = findings.length > 1 ? ` (and ${findings.length - 1} more)` : "";
	const where = first.location ? ` at line ${first.location.line}, column ${first.location.column}` : "";
	return new CliError(`Invalid ${LABEL[format]} in ${name}${where}: ${first.message.replace(/^YAML: /, "")} [${first.ruleId}]${more}`, KEY[format], 2, { file: name, findings });
}

/**
 * Decode a deck (`kind: "deck"`: one mapping) or a patch (any JSON-compatible root, JSON or YAML) from text in `format`,
 * through core's deck reader. The syntax is checked here and nothing else: the commands check the OPF. Throws a `CliError`
 * (`invalid-json`, `invalid-yaml`, `invalid-markdown`, exit 2).
 */
export function decode(raw: string, file: string, format: DeckFormat, kind: "deck" | "patch" = "deck"): DeckSource {
	const name = nameOf(file);
	if (kind === "patch") {
		if (format === "markdown") throw usage(`A JSON Patch is JSON or YAML, not Markdown (${name}).`);
		if (format === "json") {
			try {
				return { raw, value: JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw) as unknown, format };
			} catch {
				throw new CliError(`Invalid JSON in ${name}.`, "invalid-json", 2, { file: name });
			}
		}
		const parsed = parseYamlData(raw);
		if (parsed.findings.length) throw readFailure(name, "yaml", parsed.findings);
		return { raw, value: parsed.value, format, yaml: yamlFacts(raw) };
	}
	const read = readDeckReport(raw, { format, validate: false, catalogs: CLI_CATALOGS });
	const errors = read.findings.filter((found) => found.severity === "error");
	if (errors.length) throw readFailure(name, format, errors);
	return { raw, value: read.presentation, format, ...(format === "yaml" ? { yaml: yamlFacts(raw) } : {}) };
}

function yamlFacts(raw: string): { comments: number; modeline?: string } {
	const comments = scanYamlComments(raw);
	return { comments: comments.count, ...(comments.modeline === undefined ? {} : { modeline: comments.modeline }) };
}

/** The line printed on stderr when a command that rewrites a YAML file would lose its comments. */
export function commentWarning(source: DeckSource, file: string): string | undefined {
	const count = source.yaml?.comments ?? 0;
	return count > 0 ? `warning: ${nameOf(file)} has ${count} comment${count === 1 ? "" : "s"}; comments are not preserved when OPF rewrites a YAML file.\n` : undefined;
}

const FENCE = /^[ \t]*(?:`{3,}|~{3,})[ \t]*opf-(?:slide|block)\b/gm;
const fencesIn = (text: string): number => text.match(FENCE)?.length ?? 0;

/**
 * The line printed on stderr when Markdown written for a deck holds more `opf-slide` and `opf-block` fences than the Markdown
 * that was read (none, when the deck came from JSON or YAML): the dialect has no syntax for that content, so the writer
 * carries it as YAML in a fence, which reads back losslessly but is less plain than the hand-written text.
 */
export function fenceWarning(text: string, source: { format: DeckFormat; raw: string } | undefined, file: string): string | undefined {
	const added = fencesIn(text) - (source?.format === "markdown" ? fencesIn(source.raw) : 0);
	return added > 0 ? `warning: ${nameOf(file)} has ${added} more opf-slide/opf-block fence${added === 1 ? "" : "s"} than before: the Markdown dialect has no syntax for that content, so it is written as YAML in a fence (nothing is lost).\n` : undefined;
}

/**
 * The output format: `--to`, else the output file name (`.opf.md`, `.yaml`, `.yml`, `.json`), else the format of the deck that
 * was read, else JSON. A `--to` that disagrees with the name is a usage error.
 */
export function outputFormatOf(output: string, to: DeckFormat | undefined, source?: { format: DeckFormat }): DeckFormat {
	const named = namedFormatOf(output);
	if (to !== undefined && named !== undefined && to !== named) throw usage(`--to ${to === "markdown" ? "md" : to} does not match the output ${output}, which names a ${LABEL[named]} deck.`, "invalid-value", { option: "--to" });
	return to ?? named ?? source?.format ?? "json";
}

/** The extension of a deck written in `format`: `deck.opf.json`, `deck.opf.yaml`, `deck.opf.md`. */
export const deckExtension = (format: DeckFormat): string => `opf.${format === "markdown" ? "md" : format}`;

/** The media type of a deck form. */
export const DECK_MEDIA: Record<DeckFormat, string> = { json: "application/json", yaml: "application/yaml", markdown: "text/markdown" };

export interface SerializeOptions {
	/** YAML: start with a generated `# yaml-language-server: $schema=...` line. */
	schemaComment?: boolean;
	/** YAML: the first-line modeline of the file being rewritten, kept verbatim (it wins over `schemaComment`). */
	modeline?: string;
}

/** The text of a deck in `format`, through core's `stringify`: JSON as the other commands write it, YAML and Markdown in canonical form. */
export function serialize(document: unknown, format: DeckFormat, options: SerializeOptions = {}): string {
	if (format === "yaml" && options.modeline !== undefined) return `${options.modeline}\n${stringify(document, { format })}`;
	return stringify(document, { format, schemaComment: !!options.schemaComment });
}

/**
 * Check deck text as `opf validate` does, through core's deck reader: JSON text through `validate` (syntax errors and duplicate keys
 * located), YAML and Markdown through their readers (every finding located in the text). `deck` is the decoded deck, undefined
 * when the text does not parse.
 */
export function checkText(raw: string, format: DeckFormat, options: ValidateOptions = {}): { report: ValidationReport; deck: Record<string, unknown> | undefined } {
	const { presentation, format: _format, ...report } = readDeckReport(raw, { format, validate: options });
	const broken = format === "json" ? report.schemaValid === null : report.findings.some((found) => found.ruleId.startsWith(format === "yaml" ? "yaml/" : "markdown/") && found.severity === "error");
	return { report, deck: broken ? undefined : (presentation as unknown as Record<string, unknown>) };
}
