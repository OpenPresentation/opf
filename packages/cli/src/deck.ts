// Reading and writing decks in the two serializations OPF has (RR-56): JSON, the canonical and interchange form, and
// YAML (`.opf.yaml`), the authoring form of the same data. Every command that reads or writes a deck goes through
// here, so a file ending `.yaml` or `.yml` works everywhere and `--input-format` / `--format` pick the form for stdin,
// stdout and other names. The YAML dialect itself lives in core, `@openpresentation/opf/yaml`.
import { type LintOptions, type LintReport, lintSource } from "@openpresentation/opf";
import { auditPresentation, auditSource, type AuditOptions, type AuditReport } from "@openpresentation/opf/audit";
import { type YamlDiagnostic, lintYamlSource, toYaml, parseYamlData, scanYamlComments, yamlLocator, fromYaml } from "@openpresentation/opf/yaml";

export type DeckFormat = "json" | "yaml";

/** A deck or patch read from a file or stdin. `raw` is the text as read; `value` the decoded data. */
export interface DeckSource {
  raw: string;
  value: unknown;
  format: DeckFormat;
  /** YAML only: the number of comments (a rewrite loses them) and the `# yaml-language-server:` modeline, which a rewrite keeps. */
  yaml?: { comments: number; modeline?: string };
}

/** An input that is not valid JSON or YAML. `details` is the located diagnostics, for the JSON error report. */
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

function yamlFailure(name: string, diagnostics: readonly YamlDiagnostic[]): DeckReadError {
  const first = diagnostics[0]!;
  const more = diagnostics.length > 1 ? ` (and ${diagnostics.length - 1} more)` : "";
  return new DeckReadError(`Invalid YAML in ${name} at line ${first.location.line}, column ${first.location.column}: ${first.message.replace(/^YAML: /, "")} [${first.ruleId}]${more}`, { file: name, diagnostics });
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
  const errors = parsed.diagnostics.filter((d) => d.severity === "error");
  if (errors.length) throw yamlFailure(name, errors);
  const value = kind === "deck" ? (parsed as ReturnType<typeof fromYaml>).document : (parsed as ReturnType<typeof parseYamlData>).value;
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

/** Lint text as `opf lint` does: JSON through `lintSource`, YAML through `lintYamlSource` (locations point into the YAML). */
export function lintText(raw: string, format: DeckFormat, options: LintOptions = {}): LintReport {
  return format === "yaml" ? lintYamlSource(raw, options) : lintSource(raw, options);
}

/** The deck decoded from text that `lintText` accepted (no validation here; the lint report carries that). */
export function deckOf(raw: string, format: DeckFormat): Record<string, unknown> {
  return (format === "yaml" ? fromYaml(raw, { validate: false }).document : JSON.parse(raw.replace(/^﻿/, ""))) as unknown as Record<string, unknown>;
}

/** Audit text as `opf audit` does: JSON through `auditSource`, YAML through the same rules with findings located in the YAML. */
export function auditText(raw: string, format: DeckFormat, options: AuditOptions): AuditReport {
  if (format === "json") return auditSource(raw, options);
  const parsed = fromYaml(raw, { validate: false });
  const errors = parsed.diagnostics.filter((d) => d.severity === "error");
  if (errors.length) {
    const report = auditSource("{", options);
    report.diagnostics = errors.map((d) => ({
      ruleId: "audit/invalid-document",
      severity: "error" as const,
      category: "content" as const,
      scope: "document" as const,
      path: d.path,
      message: `The source is not valid YAML, so it was not audited: ${d.message}`,
      help: d.help,
      location: d.location,
    }));
    report.counts = { error: report.diagnostics.length, warning: 0, info: 0 };
    return report;
  }
  const report = auditPresentation(parsed.document, options);
  const locate = yamlLocator(raw);
  for (const diagnostic of report.diagnostics) if (!diagnostic.location) diagnostic.location = locate(diagnostic.path);
  return report;
}
