// Reading and writing decks in the two serializations OPF has (RR-56): JSON, the canonical and interchange form, and
// YAML (`.opf.yaml`), the authoring form of the same data. Every command that reads or writes a deck goes through
// here, so a file ending `.yaml` or `.yml` works everywhere and `--input-format` / `--format` pick the form for stdin,
// stdout and other names. The YAML dialect itself lives in core, `@openpresentation/opf/yaml`.
import { type ValidateOptions, type ValidationReport, validate } from "@openpresentation/opf";
import { type YamlFinding, toYaml, parseYamlData, scanYamlComments, fromYaml } from "@openpresentation/opf/yaml";

export type DeckFormat = "json" | "yaml";

/** A deck or patch read from a file or stdin. `raw` is the text as read; `value` the decoded data. */
export interface DeckSource {
  raw: string;
  value: unknown;
  format: DeckFormat;
  /** YAML only: the number of comments (a rewrite loses them) and the `# yaml-language-server:` modeline, which a rewrite keeps. */
  yaml?: { comments: number; modeline?: string };
}

/** An input that is not valid JSON or YAML. `details` is the located findings, for the JSON error report. */
export class DeckReadError extends Error {
  constructor(
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

let forcedInput: DeckFormat | undefined;

/** Set by the global `--input-format` option: the format of stdin and of files whose name does not end `.yaml`/`.yml`. */
export function setInputFormat(value: string | undefined): void {
  if (value !== undefined && value !== "json" && value !== "yaml") throw new DeckReadError("--input-format takes json or yaml.");
  forcedInput = value;
}

const YAML_NAME = /\.ya?ml$/i;
export const isYamlName = (file: string): boolean => file !== "-" && YAML_NAME.test(file);

/** A file ending `.yaml` or `.yml` is YAML; stdin and other names follow `--input-format`, with JSON as the default. */
export function inputFormatOf(file: string): DeckFormat {
  return isYamlName(file) ? "yaml" : (forcedInput ?? "json");
}

export const nameOf = (file: string): string => (file === "-" ? "stdin" : file);

function yamlFailure(name: string, findings: readonly YamlFinding[]): DeckReadError {
  const first = findings[0]!;
  const more = findings.length > 1 ? ` (and ${findings.length - 1} more)` : "";
  return new DeckReadError(`Invalid YAML in ${name} at line ${first.location.line}, column ${first.location.column}: ${first.message.replace(/^YAML: /, "")} [${first.ruleId}]${more}`, { file: name, findings });
}

/** Decode a deck (`kind: "deck"`: one mapping) or a patch (any JSON-compatible root) from text in `format`. Throws `DeckReadError`. */
export function decode(raw: string, file: string, format: DeckFormat, kind: "deck" | "patch" = "deck"): DeckSource {
  const name = nameOf(file);
  if (format === "json") {
    try {
      return { raw, value: JSON.parse(raw.replace(/^﻿/, "")) as unknown, format };
    } catch {
      throw new DeckReadError(`Invalid JSON in ${name}.`);
    }
  }
  const parsed = kind === "deck" ? fromYaml(raw, { validate: false }) : parseYamlData(raw);
  const errors = parsed.findings.filter((d) => d.severity === "error");
  if (errors.length) throw yamlFailure(name, errors);
  const value = kind === "deck" ? (parsed as ReturnType<typeof fromYaml>).presentation : (parsed as ReturnType<typeof parseYamlData>).value;
  const comments = scanYamlComments(raw);
  return { raw, value, format, yaml: { comments: comments.count, ...(comments.modeline === undefined ? {} : { modeline: comments.modeline }) } };
}

/** The line printed on stderr when a command that rewrites a YAML file would lose its comments. */
export function commentWarning(source: DeckSource, file: string): string | undefined {
  const count = source.yaml?.comments ?? 0;
  return count > 0 ? `warning: ${nameOf(file)} has ${count} comment${count === 1 ? "" : "s"}; comments are not preserved when OPF rewrites a YAML file.\n` : undefined;
}

/** The output format: an explicit `--format`, else the output file name (`.yaml`, `.yml`, `.json`), else the format of the deck that was read, else JSON. */
export function outputFormatOf(output: string, flag: string | boolean | undefined, source?: DeckSource): DeckFormat {
  if (flag !== undefined) {
    if (flag !== "json" && flag !== "yaml") throw new DeckReadError("--format takes json or yaml.");
    return flag;
  }
  if (output !== "-" && isYamlName(output)) return "yaml";
  if (output !== "-" && /\.json$/i.test(output)) return "json";
  return source?.format ?? "json";
}

export interface SerializeOptions {
  /** YAML: start with a generated `# yaml-language-server: $schema=...` line. */
  schemaComment?: boolean;
  /** YAML: the first-line modeline of the file being rewritten, kept verbatim (it wins over `schemaComment`). */
  modeline?: string;
}

/** The text of a deck in `format`: JSON as the other commands write it, YAML in canonical form. */
export function serialize(document: unknown, format: DeckFormat, options: SerializeOptions = {}): string {
  if (format === "yaml" && options.modeline !== undefined) return `${options.modeline}
${toYaml(document).yaml}`;
  return format === "yaml" ? toYaml(document, { schemaComment: !!options.schemaComment }).yaml : `${JSON.stringify(document, null, 2)}\n`;
}

/**
 * Check deck text as `opf validate` does: JSON text through `validate` (syntax errors and duplicate keys located), YAML
 * through `fromYaml` (every finding located in the YAML). `deck` is the decoded deck, undefined when the text does not parse.
 */
export function checkText(raw: string, format: DeckFormat, options: ValidateOptions = {}): { report: ValidationReport; deck: Record<string, unknown> | undefined } {
  if (format === "yaml") {
    const { presentation, ...report } = fromYaml(raw, { validate: options });
    return { report, deck: report.findings.some((found) => found.ruleId.startsWith("yaml/")) ? undefined : (presentation as unknown as Record<string, unknown>) };
  }
  const report = validate(raw, options);
  return { report, deck: report.schemaValid === null ? undefined : (JSON.parse(raw.replace(/^﻿/, "")) as Record<string, unknown>) };
}
