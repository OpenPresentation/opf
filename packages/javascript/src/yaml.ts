/**
 * OPF as YAML (RR-56): read a deck written as YAML and write any valid deck as YAML, with no renderer, fonts, network
 * or model. JSON stays the canonical form; `.opf.yaml` is an authoring serialization of the same data.
 *
 * The reader accepts one dialect, strict by default: JSON-compatible YAML 1.2 (core schema) with exactly one document
 * whose root is a mapping, no duplicate keys, no custom tags, no anchors, aliases or merge keys (opt in with
 * `aliases: true`) and only finite numbers. Errors carry the offset, line and column of the YAML that caused them,
 * including OPF lint findings mapped back to the YAML of the field they name. The writer emits canonical schema key
 * order, 2-space block style and quoted ambiguous strings, and reads its own output back before returning it.
 *
 * The same input always gives the same output.
 */
import { same } from "./convert/shared.js";
import { sortPresentationKeys } from "./format.js";
import { lintPresentation } from "./lint.js";
import type { LintDiagnostic, LintOptions, LintReport, LintSeverity } from "./lint.js";
import { presentation } from "./schemas.js";
import type { Presentation } from "./types.js";
import { validatePresentation } from "./validator.js";
import { type YamlDiagnostic, readYamlDocument } from "./yaml/read.js";
import { writeCanonicalYaml } from "./yaml/write.js";

export type { YamlComments, YamlDiagnostic } from "./yaml/read.js";
/** The comments of a YAML text (lost when a tool rewrites the file) and its `# yaml-language-server:` modeline. */
export { scanYamlComments } from "./yaml/read.js";

/** The canonical schema URL (`$id` of the presentation schema), used by `schemaComment`. */
export const YAML_SCHEMA_URL: string = presentation.$id;

export interface FromYamlOptions {
  /** Run the OPF lint over the result and map its findings to YAML line and column (default true). */
  validate?: boolean;
  /**
   * Expand anchors, aliases and `<<` merge keys (default false: they are an error). The expansion is capped at 100 aliases
   * and an alias inside its own anchor is rejected, so the result is always finite JSON-compatible data.
   */
  aliases?: boolean;
  /** Lint options (catalogs and contracts already loaded by the host) passed to the OPF lint. */
  lint?: LintOptions;
}

export interface FromYamlResult {
  /** The converted deck. Always an object; when `valid` is false it is a best effort (an empty object after a YAML error). */
  document: Presentation;
  /** True when there are no errors (YAML errors and OPF validation errors both count). */
  valid: boolean;
  /** Lint-shaped diagnostics, in source order, each with `location` (UTF-16 offset and length, one-based line and column). */
  diagnostics: YamlDiagnostic[];
  counts: Record<LintSeverity, number>;
}

/**
 * Convert YAML text to an OPF document. Never throws for malformed content; read `valid` and `diagnostics`. Rule ids
 * starting `yaml/` are syntax and dialect errors; ids starting `opf/` are the OPF lint findings of the parsed deck, located at
 * the YAML node of the field they name. A leading BOM is accepted (offsets count it, columns do not) and so are CRLF line endings.
 */
export function fromYaml(yaml: string, options: FromYamlOptions = {}): FromYamlResult {
  if (typeof yaml !== "string") throw new TypeError("fromYaml expects a string.");
  const parsed = readYamlDocument(yaml, options.aliases === true);
  const diagnostics: YamlDiagnostic[] = [...parsed.diagnostics];
  if (!parsed.errors && options.validate !== false) {
    for (const found of lintPresentation(parsed.value, options.lint).diagnostics) {
      const location = parsed.locatePointer(found.path) ?? parsed.locatePointer("") ?? { offset: 0, length: 0, line: 1, column: 1 };
      diagnostics.push({ ...found, location });
    }
  }
  diagnostics.sort((a, b) => a.location.offset - b.location.offset);
  const counts: Record<LintSeverity, number> = { error: 0, warning: 0, info: 0 };
  for (const diagnostic of diagnostics) counts[diagnostic.severity]++;
  return { document: parsed.value as Presentation, valid: counts.error === 0, diagnostics, counts };
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
 * `fromYaml(toYaml(doc).yaml).document` deep-equals `doc` (key order aside) and the output converts back to itself byte for byte.
 * Throws `OPFYamlError` (`invalid-document`) when the input is not valid OPF.
 */
export function toYaml(document: unknown, options: ToYamlOptions = {}): ToYamlResult {
  const checked = validatePresentation(document);
  if (!checked.valid) {
    const first = checked.errors[0];
    throw new OPFYamlError("invalid-document", `The document is not valid OPF: ${first?.message ?? "unknown error"}${first?.path ? ` (${first.path})` : ""}.`, { issues: checked.errors });
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
 * Lint YAML source text, as `lintSource` lints JSON: a `LintReport` whose diagnostics all carry `location`. A syntax or dialect error is a
 * `yaml/...` finding and no OPF lint runs (`schemaValid` is null); otherwise the OPF lint findings are located at the YAML of the field they name.
 * Accepts the lint options of `lintPresentation` (`catalogs`, `contracts`) and `aliases`.
 */
export function lintYamlSource(yaml: string, options: LintOptions & { aliases?: boolean } = {}): LintReport {
  if (typeof yaml !== "string") throw new TypeError("lintYamlSource expects a string.");
  const { aliases, ...lintOptions } = options;
  const parsed = readYamlDocument(yaml, aliases === true);
  const count = (diagnostics: LintDiagnostic[]): Record<LintSeverity, number> => {
    const counts: Record<LintSeverity, number> = { error: 0, warning: 0, info: 0 };
    for (const diagnostic of diagnostics) counts[diagnostic.severity]++;
    return counts;
  };
  if (parsed.errors) {
    const counts = count(parsed.diagnostics);
    return {
      valid: counts.error === 0,
      schemaValid: null,
      diagnostics: parsed.diagnostics,
      counts,
      checks: { syntax: "checked", schema: "not-run", catalogReferences: "not-run", assetReferences: "not-run", contracts: "not-run", layout: "not-checked", fonts: "not-checked", nativeExport: "not-checked" },
    };
  }
  const result = lintPresentation(parsed.value, lintOptions);
  const diagnostics = result.diagnostics.map((found) => ({ ...found, location: parsed.locatePointer(found.path) ?? parsed.locatePointer("") }));
  return { ...result, diagnostics: diagnostics.sort((a, b) => (a.location?.offset ?? 0) - (b.location?.offset ?? 0)), checks: { ...result.checks, syntax: "checked" } };
}

/**
 * Parse YAML text that is not an OPF deck (a JSON Patch, a settings file) in the same strict dialect: any JSON-compatible root,
 * one document, no tags, anchors (unless `aliases`), duplicate keys or non-finite numbers. Never throws; `value` is `null` when `valid` is false.
 */
export function parseYamlData(yaml: string, options: { aliases?: boolean } = {}): { value: unknown; valid: boolean; diagnostics: YamlDiagnostic[] } {
  if (typeof yaml !== "string") throw new TypeError("parseYamlData expects a string.");
  const parsed = readYamlDocument(yaml, options.aliases === true, "any");
  return { value: parsed.errors ? null : parsed.value, valid: parsed.errors === 0, diagnostics: parsed.diagnostics };
}

/**
 * The location of each JSON Pointer in a YAML text, for tools that report findings of their own (the CLI audit uses it).
 * Returns the location of the node the pointer names, the nearest ancestor that exists, or undefined when the text does not parse.
 */
export function yamlLocator(yaml: string, options: { aliases?: boolean } = {}): (pointer: string) => YamlDiagnostic["location"] | undefined {
  const parsed = readYamlDocument(yaml, options.aliases === true);
  return parsed.errors ? () => undefined : parsed.locatePointer;
}

