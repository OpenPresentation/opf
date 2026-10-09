// Reading and writing decks in the three serializations OPF has: JSON, the canonical and interchange form, YAML
// (`.opf.yaml`, RR-56) and Markdown (`.opf.md`, RR-60), the authoring forms of the same data. Every command that reads or
// writes a deck goes through here, so a file ending `.yaml`, `.yml` or `.opf.md` works everywhere and `--input-format` /
// `--format` pick the form for stdin, stdout and other names. The dialects live in core, which also has the one reader and
// the one writer used here (`parse`'s reader that reports instead of throwing, `stringify`); this file adds what a command needs on top:
// the CLI's catalogs, the error messages with their positions, the YAML modeline and comment count, and the rewrite warnings.
import { type DeckFormat, type Finding, type ValidateOptions, type ValidationReport, deckFormatOf, stringify } from "@openpresentation/opf";
import { readDeckReport } from "@openpresentation/opf/node/engine";
import { CLI_CATALOGS } from "./catalogs.js";
import { parseYamlData, scanYamlComments } from "@openpresentation/opf/yaml";

export type { DeckFormat };

/** A deck or patch read from a file or stdin. `raw` is the text as read; `value` the decoded data. */
export interface DeckSource {
  raw: string;
  value: unknown;
  format: DeckFormat;
  /** YAML only: the number of comments (a rewrite loses them) and the `# yaml-language-server:` modeline, which a rewrite keeps. */
  yaml?: { comments: number; modeline?: string };
}

/** An input that is not valid JSON, YAML or Markdown. `details` is the located findings, for the JSON error report under `key`. */
export class DeckReadError extends Error {
  constructor(
    message: string,
    readonly details?: Record<string, unknown>,
    readonly key: "json" | "yaml" | "markdown" = "yaml",
  ) {
    super(message);
  }
}

/** The names a format goes by in `--input-format` and `--format`: `md` is `markdown`. */
export function formatNamed(value: unknown): DeckFormat | undefined {
  return value === "json" || value === "yaml" ? value : value === "markdown" || value === "md" ? "markdown" : undefined;
}

/** True when `--format` names an output deck format that is not JSON (`fill` and `import-data` use `--format csv|tsv|json` for their data). */
export const isDeckFormatFlag = (value: unknown): boolean => value === "yaml" || value === "markdown" || value === "md";

const FORMAT_MESSAGE = "takes json, yaml or markdown (md).";
let forcedInput: DeckFormat | undefined;

/** Set by the global `--input-format` option: the format of stdin and of files whose name does not say one (`.yaml`, `.yml`, `.opf.md`). */
export function setInputFormat(value: string | undefined): void {
  if (value === undefined) forcedInput = undefined;
  else {
    const format = formatNamed(value);
    if (!format) throw new DeckReadError(`--input-format ${FORMAT_MESSAGE}`);
    forcedInput = format;
  }
}

/** The format a file name stands for besides JSON: `.yaml`/`.yml` and `.opf.md`. A plain `.md` file is never a deck. */
const nameFormatOf = (file: string): DeckFormat | undefined => (file === "-" ? undefined : deckFormatOf(file) === "json" ? undefined : deckFormatOf(file));
export const isYamlName = (file: string): boolean => nameFormatOf(file) === "yaml";
export const isMarkdownName = (file: string): boolean => nameFormatOf(file) === "markdown";

/** A file ending `.yaml`, `.yml` or `.opf.md` has that format; stdin and other names follow `--input-format`, with JSON as the default. */
export function inputFormatOf(file: string): DeckFormat {
  return nameFormatOf(file) ?? forcedInput ?? "json";
}

export const nameOf = (file: string): string => (file === "-" ? "stdin" : file);

const LABEL: Record<DeckFormat, string> = { json: "JSON", yaml: "YAML", markdown: "Markdown" };

function failure(name: string, format: DeckFormat, findings: readonly Finding[]): DeckReadError {
  const first = findings[0] as Finding & { location?: { line: number; column: number } };
  const more = findings.length > 1 ? ` (and ${findings.length - 1} more)` : "";
  const where = first.location ? ` at line ${first.location.line}, column ${first.location.column}` : "";
  return new DeckReadError(`Invalid ${LABEL[format]} in ${name}${where}: ${first.message.replace(/^YAML: /, "")} [${first.ruleId}]${more}`, { file: name, findings }, format);
}

/**
 * Decode a deck (`kind: "deck"`: one mapping) or a patch (any JSON-compatible root, JSON or YAML) from text in `format`,
 * through core's deck reader. The syntax is checked here and nothing else: the commands check the OPF. Throws `DeckReadError`.
 */
export function decode(raw: string, file: string, format: DeckFormat, kind: "deck" | "patch" = "deck"): DeckSource {
  const name = nameOf(file);
  if (kind === "patch") {
    if (format === "markdown") throw new DeckReadError(`A JSON Patch is JSON or YAML, not Markdown (${name}).`);
    if (format === "json") {
      try {
        return { raw, value: JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw) as unknown, format };
      } catch {
        throw new DeckReadError(`Invalid JSON in ${name}.`, undefined, "json");
      }
    }
    const parsed = parseYamlData(raw);
    if (parsed.findings.length) throw failure(name, "yaml", parsed.findings);
    return { raw, value: parsed.value, format, yaml: yamlFacts(raw) };
  }
  const read = readDeckReport(raw, { format, validate: false, catalogs: CLI_CATALOGS });
  const errors = read.findings.filter((found) => found.severity === "error");
  if (errors.length) throw failure(name, format, errors);
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
export function fenceWarning(text: string, source: DeckSource | undefined, file: string): string | undefined {
  const added = fencesIn(text) - (source?.format === "markdown" ? fencesIn(source.raw) : 0);
  return added > 0 ? `warning: ${nameOf(file)} has ${added} more opf-slide/opf-block fence${added === 1 ? "" : "s"} than before: the Markdown dialect has no syntax for that content, so it is written as YAML in a fence (nothing is lost).\n` : undefined;
}

/**
 * The output format: an explicit `--format`, else the output file name (`.opf.md`, `.yaml`, `.yml`, `.json`), else the format of
 * the deck that was read, else JSON.
 */
export function outputFormatOf(output: string, flag: string | boolean | undefined, source?: DeckSource): DeckFormat {
  if (flag !== undefined) {
    const format = formatNamed(flag);
    if (!format) throw new DeckReadError(`--format ${FORMAT_MESSAGE}`);
    return format;
  }
  if (output !== "-" && nameFormatOf(output)) return nameFormatOf(output) as DeckFormat;
  if (output !== "-" && /\.json$/i.test(output)) return "json";
  return source?.format ?? "json";
}

/** The extension of a deck written in `format`: `deck.opf.json`, `deck.opf.yaml`, `deck.opf.md`. */
export const deckExtension = (format: DeckFormat): string => `opf.${format === "markdown" ? "md" : format}`;

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
