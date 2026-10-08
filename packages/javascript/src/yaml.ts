/**
 * OPF as YAML (RR-56): read a deck written as YAML and write any valid deck as YAML, with no renderer, fonts, network
 * or model. JSON stays the canonical form; `.opf.yaml` is an authoring serialization of the same data.
 *
 * The reader accepts one dialect, strict by default: JSON-compatible YAML 1.2 (core schema) with exactly one document
 * whose root is a mapping, no duplicate keys, no custom tags, no anchors, aliases or merge keys (opt in with
 * `aliases: true`) and only finite numbers. Errors carry the offset, line and column of the YAML that caused them,
 * including the OPF validation findings mapped back to the YAML of the field they name. The writer emits canonical schema key
 * order, 2-space block style and quoted ambiguous strings, and reads its own output back before returning it.
 *
 * The same input always gives the same output.
 */
import type { Catalog } from "./catalog-refs.js";
import { same } from "./convert/shared.js";
import { sortPresentationKeys } from "./format.js";
import { presentation } from "./schemas.js";
import type { Presentation } from "./types.js";
import { type ValidateOptions, type ValidationChecks, type ValidationReport, validate } from "./validator.js";
import { type YamlFinding, readYamlDocument } from "./yaml/read.js";
import { writeCanonicalYaml } from "./yaml/write.js";

export type { YamlComments, YamlFinding } from "./yaml/read.js";
/** The comments of a YAML text (lost when a tool rewrites the file) and its `# yaml-language-server:` modeline. */
export { scanYamlComments } from "./yaml/read.js";

/** The canonical schema URL (`$id` of the presentation schema), used by `schemaComment`. */
export const YAML_SCHEMA_URL: string = presentation.$id;

export interface FromYamlOptions {
  /**
   * Check the result with `validate` and map its findings to YAML line and column: `true` (the default) checks `format`
   * and `references`; options pick other rules or categories (`{}` runs every rule); `false` skips the check.
   */
  validate?: boolean | ValidateOptions;
  /** Catalogs the host registered, for the references check of `validate: true` (the default). Nothing is fetched. */
  catalogs?: readonly Catalog[];
  /**
   * Expand anchors, aliases and `<<` merge keys (default false: they are an error). The expansion is capped at 100 aliases
   * and an alias inside its own anchor is rejected, so the result is always finite JSON-compatible data.
   */
  aliases?: boolean;
}

/**
 * The converted deck with the `validate` report of it, so a YAML file reports exactly what the same deck as JSON text does
 * (`schemaValid`, `checks`, `template` ...), with every finding located in the YAML. After a YAML syntax or dialect error,
 * or with `validate: false`, no OPF check ran: `schemaValid` is null and `checks` says so.
 */
export interface FromYamlResult extends ValidationReport {
  /** The converted deck. Always an object; when `valid` is false it is a best effort (an empty object after a YAML error). */
  presentation: Presentation;
  /** True when there are no errors (YAML errors and OPF validation errors both count). */
  valid: boolean;
  /** Findings (the shared Finding format), in source order, each with `location` (UTF-16 offset and length, one-based line and column). */
  findings: YamlFinding[];
}

const NOT_CHECKED: ValidationChecks = { syntax: "checked", schema: "not-run", references: "not-run", policy: "not-run", accessibility: "not-run", content: "not-run", layout: "not-run", backgroundPixels: "not-read", imageBytes: "embedded-only", nativeExport: "not-checked" };

/**
 * Convert YAML text to an OPF document. Never throws for malformed content; read `valid` and `findings`. Rule ids
 * starting `yaml/` are syntax and dialect errors (category `format`); ids starting `opf/` are the `validate` findings of the
 * parsed deck, located at the YAML node of the field they name. A syntax or dialect error stops there: no OPF check runs. A leading BOM is accepted (offsets count it, columns do not) and so are CRLF line endings.
 */
export function fromYaml(yaml: string, options: FromYamlOptions = {}): FromYamlResult {
  if (typeof yaml !== "string") throw new TypeError("fromYaml expects a string.");
  const parsed = readYamlDocument(yaml, options.aliases === true);
  const findings: YamlFinding[] = [...parsed.findings];
  let report: Omit<ValidationReport, "findings" | "counts" | "valid"> = { schemaValid: null, checks: NOT_CHECKED };
  if (!parsed.errors && options.validate !== false) {
    const checked = validate(parsed.value, options.validate === true || options.validate === undefined ? { only: ["format", "references"], ...(options.catalogs ? { catalogs: options.catalogs } : {}) } : options.validate);
    report = {
      schemaValid: checked.schemaValid,
      checks: { ...checked.checks, syntax: "checked" },
      ...(checked.template === undefined ? {} : { template: checked.template }),
      ...(checked.unfilledVariables === undefined ? {} : { unfilledVariables: checked.unfilledVariables }),
    };
    for (const found of checked.findings) {
      const location = parsed.locatePointer(found.path) ?? parsed.locatePointer("") ?? { offset: 0, length: 0, line: 1, column: 1 };
      findings.push({ ...found, location });
    }
  }
  findings.sort((a, b) => a.location.offset - b.location.offset);
  const counts: ValidationReport["counts"] = { error: 0, warning: 0, info: 0 };
  for (const found of findings) counts[found.severity]++;
  return { presentation: parsed.value as Presentation, valid: counts.error === 0, findings, counts, ...report };
}

export interface ToYamlOptions {
  /** Start the file with `# yaml-language-server: $schema=<url>` so editors validate and complete it (default false). The URL is the deck's own `$schema`, else the canonical schema. */
  schemaComment?: boolean;
}

export interface ToYamlResult {
  yaml: string;
}

/** Raised by `toYaml`: `invalid-document` (does not validate as OPF) or `not-representable` (a value YAML cannot carry exactly; a bug). */
export class OPFYamlError extends Error {
  readonly code: "invalid-document" | "not-representable";
  readonly details: Record<string, unknown>;
  constructor(code: "invalid-document" | "not-representable", message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "OPFYamlError";
    this.code = code;
    this.details = details;
  }
}

/**
 * Convert an OPF document to canonical YAML: schema key order, 2-space block style, no line folding, strings that would
 * read as another type or in another YAML version quoted. The text is read back and compared before it is returned, so
 * `fromYaml(toYaml(doc).yaml).presentation` deep-equals `doc` (key order aside) and the output converts back to itself byte for byte.
 * Throws `OPFYamlError` (`invalid-document`) when the input is not valid OPF.
 */
export function toYaml(document: unknown, options: ToYamlOptions = {}): ToYamlResult {
  const checked = validate(document, { only: ["format"] });
  if (!checked.valid) {
    const errors = checked.findings.filter((found) => found.severity === "error");
    const first = errors[0];
    throw new OPFYamlError("invalid-document", `The document is not valid OPF: ${first?.message ?? "unknown error"}${first?.path ? ` (${first.path})` : ""}.`, { findings: errors });
  }
  const sorted = sortPresentationKeys(document) as Record<string, unknown>;
  const text = writeCanonicalYaml(sorted, (out) => {
    const back = readYamlDocument(out, false);
    if (back.errors) throw new Error("The YAML does not read back.");
    return back.value;
  });
  if (text === undefined) throw new OPFYamlError("not-representable", "The document holds a value that YAML cannot carry exactly.");
  if (!same(JSON.parse(JSON.stringify(sorted)), readYamlDocument(text, false).value)) throw new OPFYamlError("not-representable", "The document does not read back from its YAML.");
  const schema = typeof sorted.$schema === "string" && !/[\r\n]/.test(sorted.$schema) ? sorted.$schema : YAML_SCHEMA_URL;
  return { yaml: options.schemaComment ? `# yaml-language-server: $schema=${schema}\n${text}` : text };
}

/**
 * Parse YAML text that is not an OPF deck (a JSON Patch, a settings file) in the same strict dialect: any JSON-compatible root,
 * one document, no tags, anchors (unless `aliases`), duplicate keys or non-finite numbers. Never throws; `value` is `null` when `valid` is false.
 */
export function parseYamlData(yaml: string, options: { aliases?: boolean } = {}): { value: unknown; valid: boolean; findings: YamlFinding[] } {
  if (typeof yaml !== "string") throw new TypeError("parseYamlData expects a string.");
  const parsed = readYamlDocument(yaml, options.aliases === true, "any");
  return { value: parsed.errors ? null : parsed.value, valid: parsed.errors === 0, findings: parsed.findings };
}
