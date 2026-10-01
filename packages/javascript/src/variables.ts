import { isRecord, pathFor } from "./content-walk.js";
import { formatFurnitureDate, parseIsoDate } from "./furniture-fields.js";

/**
 * Template variables: typed, named values a deck declares once and uses in many
 * places, and the one deterministic function that turns a deck (or a template,
 * "an incomplete OPF file") plus values into a concrete deck.
 *
 * Pure: no clock, locale, time zone, network, file access or randomness. See
 * docs/templates-and-variables.md for the syntax and the recorded decisions.
 */

export const VARIABLE_KINDS = ["color", "text", "number", "date", "image", "url", "list"] as const;
export type VariableKind = (typeof VARIABLE_KINDS)[number];
export type VariableValues = Record<string, unknown>;

/** Default display pattern of a date variable inserted inline. */
export const DEFAULT_VARIABLE_DATE_FORMAT = "MMMM d, yyyy";

export interface VariableDeclaration {
  id: string;
  kind: VariableKind;
  /** JSON pointer of the declaration. */
  path: string;
  /** False only when the declaration sets `required: false`. */
  required: boolean;
  /** Declared (default or current) value, normalized to the kind. Undefined when unfilled. */
  value?: unknown;
  example?: unknown;
  format?: string;
  label?: string;
  description?: string;
}

export type VariableUseForm = "token" | "reference";
export interface VariableUse {
  id: string;
  /** JSON pointer of the string that carries the token or reference. */
  path: string;
  form: VariableUseForm;
}

export type VariableDiagnosticCode =
  | "variable-unfilled"
  | "variable-example-used"
  | "variable-invalid-value"
  | "variable-unknown"
  | "variable-unknown-value"
  | "variable-unused"
  | "variable-rich-flattened"
  | "variable-format";
export type VariableDiagnosticSeverity = "error" | "warning" | "info";
export interface VariableDiagnostic {
  code: VariableDiagnosticCode;
  severity: VariableDiagnosticSeverity;
  /** JSON pointer into the document (declaration or use). */
  path: string;
  /** The variable id the diagnostic is about. */
  id: string;
  message: string;
}

export interface ResolveVariablesOptions {
  /**
   * Treat the document as a template (overrides the root `template` marker):
   * unfilled required variables are informational and the output stays a
   * template. Default: the root `template` marker.
   */
  template?: boolean;
  /** Use each unfilled variable's `example` (previews of a template). Default false. */
  examples?: boolean;
  /**
   * Allow unfilled required variables (a partial fill): they are informational,
   * their tokens and references stay as written, and their declarations remain
   * in the output so a later pass can fill them. Default false.
   */
  partial?: boolean;
  /** Throw OPFVariableError when any diagnostic has severity "error". Default false. */
  strict?: boolean;
}

export interface ResolveVariablesResult {
  /**
   * The concrete deck. Content variables are substituted and their declarations
   * removed; color variables keep their `var:<id>` references and carry the
   * resolved values; `template` is removed once nothing is unfilled. Unchanged
   * parts of the input are shared, never mutated: treat the result as immutable.
   */
  presentation: Record<string, unknown>;
  diagnostics: VariableDiagnostic[];
  /** Ids of required variables that still have no value, in declaration order. */
  unfilled: string[];
  /** Ids whose `example` was used because the variable was unfilled. */
  examplesUsed: string[];
  /** True when no required variable is unfilled. */
  complete: boolean;
}

export class OPFVariableError extends Error {
  readonly diagnostics: VariableDiagnostic[];
  constructor(diagnostics: VariableDiagnostic[]) {
    const first = diagnostics.find((entry) => entry.severity === "error") ?? diagnostics[0];
    super(first ? `OPF variables: ${first.message}` : "OPF variables failed");
    this.name = "OPFVariableError";
    this.diagnostics = diagnostics;
  }
}

const idPattern = /^[a-z][a-z0-9-]*$/;
const referencePattern = /^var:([a-z][a-z0-9-]*)$/;
const hexPattern = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const urlPattern = /^(?:https?:\/\/|mailto:|tel:)\S+$/;
const datePrefixPattern = /^(\d{4}-\d{2}-\d{2})(?:[T ].*)?$/;
const decimalPattern = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
/** One alternation: the escape `\{{`, or a token `{{id}}` / `{{id|format}}`. */
const tokenPattern = /\\\{\{|\{\{\s*([a-z][a-z0-9-]*)\s*(?:\|([^{}]*))?\}\}/g;

/** Values used to type-check a template whose variable has neither value nor example. */
const SAMPLES: Record<VariableKind, unknown> = {
  color: "#000000",
  text: "Sample text",
  number: 0,
  date: "2000-01-01",
  image: "https://example.invalid/sample.png",
  url: "https://example.invalid/",
  list: ["Sample item"],
};

const hasOwn = (value: object, key: string) => Object.hasOwn(value, key);
const clone = <T>(value: T): T => (value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T));

/** True when the root `template` marker is set. */
export function isTemplate(presentation: unknown): boolean {
  return isRecord(presentation) && presentation.template === true;
}

function isKind(value: unknown): value is VariableKind {
  return typeof value === "string" && (VARIABLE_KINDS as readonly string[]).includes(value);
}

/** Coerce a raw value (from a values file, a form or a declaration) to the kind's canonical value. */
export function coerceVariableValue(kind: VariableKind, raw: unknown): { ok: true; value: unknown } | { ok: false; message: string } {
  const fail = (message: string) => ({ ok: false as const, message });
  switch (kind) {
    case "color":
      return typeof raw === "string" && hexPattern.test(raw.trim()) ? { ok: true, value: raw.trim() } : fail("expected a hex color such as #0F4C81");
    case "text": {
      if (typeof raw === "string") return { ok: true, value: raw };
      if (typeof raw === "number" && Number.isFinite(raw)) return { ok: true, value: String(raw) };
      if (typeof raw === "boolean") return { ok: true, value: String(raw) };
      if (Array.isArray(raw) && raw.every((run) => typeof run === "string" || (isRecord(run) && typeof run.text === "string"))) return { ok: true, value: clone(raw) };
      return fail("expected text: a string or an array of text runs");
    }
    case "number": {
      if (typeof raw === "number" && Number.isFinite(raw)) return { ok: true, value: raw };
      // Strict decimal syntax, as in data import: no currency, grouping or percent signs.
      if (typeof raw === "string" && decimalPattern.test(raw.trim())) {
        const value = Number(raw.trim());
        if (Number.isFinite(value)) return { ok: true, value };
      }
      return fail("expected a finite number");
    }
    case "date": {
      if (typeof raw === "string") {
        const match = datePrefixPattern.exec(raw.trim());
        if (match?.[1] && parseIsoDate(match[1])) return { ok: true, value: match[1] };
      }
      return fail("expected an ISO calendar date (YYYY-MM-DD)");
    }
    case "image": {
      if (typeof raw === "string" && raw.trim()) return { ok: true, value: raw.trim() };
      if (isRecord(raw) && typeof raw.src === "string" && raw.src.trim()) return { ok: true, value: clone(raw) };
      return fail("expected an image source: a string or an object with src");
    }
    case "url":
      return typeof raw === "string" && urlPattern.test(raw.trim()) ? { ok: true, value: raw.trim() } : fail("expected an http, https, mailto or tel link");
    case "list": {
      if (typeof raw === "string") {
        const entries = raw.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);
        return { ok: true, value: entries };
      }
      if (Array.isArray(raw) && raw.every((entry) => typeof entry === "string" || (typeof entry === "number" && Number.isFinite(entry)))) {
        return { ok: true, value: raw.map(String) };
      }
      return fail("expected a list of strings");
    }
  }
}

/** A value counts as "not provided" when it is null, undefined, or a blank string for a kind other than text. */
function isProvided(kind: VariableKind, raw: unknown): boolean {
  if (raw === undefined || raw === null) return false;
  if (typeof raw === "string" && raw.trim() === "" && kind !== "text") return false;
  return true;
}

/** The declarations of the document's `variables` map, in declaration order. Entries the schema rejects are skipped. */
export function variableDeclarations(presentation: unknown): VariableDeclaration[] {
  if (!isRecord(presentation) || !isRecord(presentation.variables)) return [];
  const out: VariableDeclaration[] = [];
  for (const [id, entry] of Object.entries(presentation.variables)) {
    if (!idPattern.test(id)) continue;
    const path = pathFor("/variables", id);
    if (typeof entry === "string") {
      if (hexPattern.test(entry)) out.push({ id, kind: "color", path, required: true, value: entry });
      continue;
    }
    if (!isRecord(entry) || !isKind(entry.type)) continue;
    const kind = entry.type;
    const declaration: VariableDeclaration = { id, kind, path, required: entry.required !== false };
    const value = entry.value !== undefined ? coerceVariableValue(kind, entry.value) : undefined;
    if (value?.ok) declaration.value = value.value;
    const example = entry.example !== undefined ? coerceVariableValue(kind, entry.example) : undefined;
    if (example?.ok) declaration.example = example.value;
    if (typeof entry.format === "string") declaration.format = entry.format;
    if (typeof entry.label === "string") declaration.label = entry.label;
    if (typeof entry.description === "string") declaration.description = entry.description;
    out.push(declaration);
  }
  return out;
}

/** True when the document declares a non-color variable or is marked as a template. */
export function hasContentVariables(presentation: unknown): boolean {
  return isTemplate(presentation) || variableDeclarations(presentation).some((declaration) => declaration.kind !== "color");
}

const POSITIVE_ZERO = "0";

/** Format a number with a display pattern (see the schema `NumberVariable.format`). */
export function formatVariableNumber(value: number, pattern?: string): { text: string } | { error: string } {
  if (!Number.isFinite(value)) return { error: `'${String(value)}' is not a finite number.` };
  if (pattern === undefined || pattern === "") return { text: String(value) };
  const match = /^([^#0,.]*)((?:[#0,]*)(?:\.[#0]+)?)([\s\S]*)$/.exec(pattern);
  const numeric = match?.[2] ?? "";
  if (!match || !/[#0]/.test(numeric)) return { error: `Number format '${pattern}' needs a numeric part of '#' and '0' characters.` };
  const prefix = match[1] ?? "";
  const suffix = match[3] ?? "";
  const [integerPattern = "", decimalPattern = ""] = numeric.split(".");
  const grouping = integerPattern.includes(",");
  const minInteger = [...integerPattern].filter((char) => char === "0").length;
  const minDecimals = [...decimalPattern].filter((char) => char === "0").length;
  const maxDecimals = decimalPattern.length;
  const scaled = prefix.includes("%") || suffix.includes("%") ? value * 100 : value;
  const absolute = Math.abs(scaled);
  // Round half away from zero in decimal, not binary, so 1.005 with two decimals is 1.01.
  let fixed: string;
  const shifted = Number(`${absolute}e${maxDecimals}`);
  if (absolute >= 1e21) fixed = `${BigInt(absolute).toString()}${maxDecimals ? `.${"0".repeat(maxDecimals)}` : ""}`;
  else if (/e/i.test(String(absolute)) || !Number.isSafeInteger(Math.round(shifted))) fixed = absolute.toFixed(maxDecimals);
  else {
    const digits = String(Math.round(shifted)).padStart(maxDecimals + 1, "0");
    fixed = maxDecimals ? `${digits.slice(0, -maxDecimals)}.${digits.slice(-maxDecimals)}` : digits;
  }
  let [integer = POSITIVE_ZERO, decimals = ""] = fixed.split(".");
  while (decimals.length > minDecimals && decimals.endsWith("0")) decimals = decimals.slice(0, -1);
  integer = integer.replace(/^0+(?=\d)/, "");
  if (integer === POSITIVE_ZERO && minInteger === 0 && decimals) integer = "";
  integer = integer.padStart(minInteger, "0");
  if (grouping) integer = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const body = `${integer}${decimals ? `.${decimals}` : ""}` || POSITIVE_ZERO;
  const negative = scaled < 0 && /[1-9]/.test(body);
  return { text: `${negative ? "-" : ""}${prefix}${body}${suffix}` };
}

type Status = "filled" | "example" | "unfilled";
interface Effective {
  declaration: VariableDeclaration;
  status: Status;
  value?: unknown;
  /** Value as provided by the caller (not the declaration), for color rewriting. */
  provided: boolean;
}

interface Context {
  effective: Map<string, Effective>;
  diagnostics: VariableDiagnostic[];
  uses: VariableUse[];
  unescape: boolean;
  /** Validation view: samples fill every unfilled variable; lists do not splice; nothing is omitted. */
  shape: boolean;
  content: boolean;
  seen: Set<string>;
}

function diag(context: Context, entry: VariableDiagnostic, dedupeKey?: string): void {
  if (dedupeKey) {
    if (context.seen.has(dedupeKey)) return;
    context.seen.add(dedupeKey);
  }
  context.diagnostics.push(entry);
}

function sampleValue(declaration: VariableDeclaration): unknown {
  return declaration.example !== undefined ? declaration.example : declaration.value !== undefined ? declaration.value : SAMPLES[declaration.kind];
}

function plainText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((run) => (typeof run === "string" ? run : isRecord(run) && typeof run.text === "string" ? run.text : "")).join("");
  return "";
}

/** The inline text of a variable value, or undefined when it cannot be formatted. */
function inlineText(effective: Effective, format: string | undefined, path: string, context: Context): string | undefined {
  const { declaration } = effective;
  const value = effective.status === "unfilled" ? sampleValue(declaration) : effective.value;
  switch (declaration.kind) {
    case "color":
    case "url":
      return String(value);
    case "text":
      if (Array.isArray(value)) {
        diag(context, { code: "variable-rich-flattened", severity: "info", path, id: declaration.id, message: `Rich text variable '${declaration.id}' is inserted as plain text inside a string; reference it whole as 'var:${declaration.id}' to keep its formatting.` }, `flat:${declaration.id}:${path}`);
      }
      return plainText(value);
    case "number": {
      const pattern = (format ?? declaration.format)?.trim();
      const formatted = formatVariableNumber(value as number, pattern === "" ? undefined : pattern);
      if ("error" in formatted) {
        diag(context, { code: "variable-format", severity: "error", path, id: declaration.id, message: formatted.error }, `fmt:${declaration.id}:${format ?? ""}`);
        return String(value);
      }
      return formatted.text;
    }
    case "date": {
      const pattern = (format ?? declaration.format)?.trim() || DEFAULT_VARIABLE_DATE_FORMAT;
      const formatted = formatFurnitureDate(String(value), pattern);
      if ("error" in formatted) {
        diag(context, { code: "variable-format", severity: "error", path, id: declaration.id, message: formatted.error }, `fmt:${declaration.id}:${format ?? ""}`);
        return String(value);
      }
      return formatted.text;
    }
    case "image":
      return isRecord(value) ? String(value.src) : String(value);
    case "list":
      return (value as string[]).join(format ?? ", ");
  }
}

function interpolate(text: string, path: string, context: Context): { value: string; changed: boolean } {
  let changed = false;
  const value = text.replace(tokenPattern, (match, id: string | undefined, format: string | undefined) => {
    if (id === undefined) {
      // The escape `\{{`.
      if (context.unescape) {
        changed = true;
        return "{{";
      }
      return match;
    }
    context.uses.push({ id, path, form: "token" });
    const effective = context.effective.get(id);
    if (!effective) {
      diag(context, { code: "variable-unknown", severity: "warning", path, id, message: `'{{${id}}}' names no declared variable; declare '${id}' in the top-level variables map, or write '\\{{' for literal braces.` }, `unk:${id}:${path}`);
      return match;
    }
    if (effective.status === "unfilled" && !context.shape) {
      if (!effective.declaration.required) {
        changed = true;
        return "";
      }
      return match;
    }
    const result = inlineText(effective, effective.declaration.kind === "list" ? format : format?.trim(), path, context);
    if (result === undefined) return match;
    changed = true;
    return result;
  });
  return { value, changed };
}

const OMIT = Symbol("omit");
/** Entries of a list variable spliced into the array that referenced it. */
class Splice {
  constructor(readonly values: unknown[]) {}
}

type Reduced = { kind: "keep" } | { kind: "replace"; value: unknown } | { kind: "omit" } | { kind: "splice"; values: unknown[] };

function reduceString(text: string, path: string, parentIsArray: boolean, context: Context): Reduced {
  const reference = referencePattern.exec(text);
  if (reference) {
    const id = reference[1] as string;
    const effective = context.effective.get(id);
    if (effective && effective.declaration.kind !== "color") {
      context.uses.push({ id, path, form: "reference" });
      if (effective.status === "unfilled" && !context.shape) {
        return effective.declaration.required ? { kind: "keep" } : { kind: "omit" };
      }
      const value = effective.status === "unfilled" ? sampleValue(effective.declaration) : effective.value;
      if (effective.declaration.kind === "list" && parentIsArray) {
        return context.shape ? { kind: "replace", value: (value as unknown[])[0] ?? "" } : { kind: "splice", values: clone(value as unknown[]) };
      }
      return { kind: "replace", value: clone(value) };
    }
    if (effective) {
      // A color variable referenced as a whole string stays a reference for the color path.
      context.uses.push({ id, path, form: "reference" });
      return { kind: "keep" };
    }
    return { kind: "keep" };
  }
  if (!text.includes("{{")) return { kind: "keep" };
  const result = interpolate(text, path, context);
  return result.changed ? { kind: "replace", value: result.value } : { kind: "keep" };
}

const skippedKeys = new Set(["extensions"]);
const skippedRootKeys = new Set(["variables", "catalogs", "$schema", "template"]);

function walk(value: unknown, path: string, parentIsArray: boolean, context: Context): unknown {
  if (typeof value === "string") {
    const reduced = reduceString(value, path, parentIsArray, context);
    if (reduced.kind === "keep") return value;
    if (reduced.kind === "omit") return OMIT;
    if (reduced.kind === "splice") return new Splice(reduced.values);
    return reduced.value;
  }
  if (Array.isArray(value)) {
    let changed = false;
    const out: unknown[] = [];
    value.forEach((entry, index) => {
      const next = walk(entry, `${path}/${index}`, true, context);
      if (next === OMIT) {
        changed = true;
        return;
      }
      if (next instanceof Splice) {
        changed = true;
        out.push(...next.values);
        return;
      }
      if (next !== entry) changed = true;
      out.push(next);
    });
    return changed ? out : value;
  }
  if (isRecord(value)) {
    let changed = false;
    const entries: [string, unknown][] = [];
    for (const [key, entry] of Object.entries(value)) {
      if (skippedKeys.has(key) || (path === "" && skippedRootKeys.has(key))) {
        entries.push([key, entry]);
        continue;
      }
      const next = walk(entry, pathFor(path || "/", key), false, context);
      if (next === OMIT) {
        changed = true;
        continue;
      }
      if (next !== entry) changed = true;
      entries.push([key, next]);
    }
    return changed ? Object.fromEntries(entries) : value;
  }
  return value;
}

interface Plan {
  context: Context;
  declarations: VariableDeclaration[];
  unfilled: string[];
  examplesUsed: string[];
  providedColors: Map<string, string>;
}

function plan(presentation: Record<string, unknown>, values: VariableValues, options: ResolveVariablesOptions & { shape?: boolean }): Plan {
  const declarations = variableDeclarations(presentation);
  const template = options.template ?? isTemplate(presentation);
  const lenient = template || options.partial === true;
  const context: Context = {
    effective: new Map(),
    diagnostics: [],
    uses: [],
    unescape: false,
    shape: options.shape === true,
    content: hasContentVariables(presentation) || template,
    seen: new Set(),
  };
  const unfilled: string[] = [];
  const examplesUsed: string[] = [];
  const providedColors = new Map<string, string>();
  const declared = new Set(declarations.map((declaration) => declaration.id));
  for (const key of Object.keys(values)) {
    if (!declared.has(key)) {
      context.diagnostics.push({ code: "variable-unknown-value", severity: "warning", path: "/variables", id: key, message: `A value was supplied for '${key}', which no variable declares.` });
    }
  }
  for (const declaration of declarations) {
    const raw = hasOwn(values, declaration.id) ? values[declaration.id] : undefined;
    let effective: Effective | undefined;
    if (isProvided(declaration.kind, raw)) {
      const coerced = coerceVariableValue(declaration.kind, raw);
      if (coerced.ok) {
        effective = { declaration, status: "filled", value: coerced.value, provided: true };
        if (declaration.kind === "color") providedColors.set(declaration.id, coerced.value as string);
      } else {
        context.diagnostics.push({ code: "variable-invalid-value", severity: "error", path: declaration.path, id: declaration.id, message: `Value for '${declaration.id}' (${declaration.kind}): ${coerced.message}.` });
      }
    }
    if (!effective && declaration.value !== undefined) effective = { declaration, status: "filled", value: declaration.value, provided: false };
    if (!effective && options.examples && declaration.example !== undefined) {
      effective = { declaration, status: "example", value: declaration.example, provided: false };
      examplesUsed.push(declaration.id);
      context.diagnostics.push({ code: "variable-example-used", severity: "info", path: declaration.path, id: declaration.id, message: `'${declaration.id}' is unfilled; its example is used.` });
      if (declaration.kind === "color") providedColors.set(declaration.id, declaration.example as string);
    }
    if (!effective) {
      effective = { declaration, status: "unfilled", provided: false };
      if (declaration.required) {
        unfilled.push(declaration.id);
        context.diagnostics.push({
          code: "variable-unfilled",
          severity: lenient ? "info" : "error",
          path: declaration.path,
          id: declaration.id,
          message: lenient
            ? `'${declaration.id}' (${declaration.kind}) is not filled yet.`
            : `Required variable '${declaration.id}' (${declaration.kind}) has no value. Provide one, or mark the document as a template ("template": true).`,
        });
      }
    }
    context.effective.set(declaration.id, effective);
  }
  return { context, declarations, unfilled, examplesUsed, providedColors };
}

function rebuildVariables(presentation: Record<string, unknown>, built: Plan, keepAll: boolean): Record<string, unknown> | undefined {
  const source = presentation.variables;
  if (!isRecord(source)) return undefined;
  const out: [string, unknown][] = [];
  for (const [id, entry] of Object.entries(source)) {
    const effective = built.context.effective.get(id);
    if (!effective) {
      out.push([id, entry]);
      continue;
    }
    const { declaration } = effective;
    if (declaration.kind !== "color") {
      // Content variables are consumed; an unfilled one stays so a later pass can fill it.
      if (keepAll || (effective.status === "unfilled" && declaration.required)) out.push([id, entry]);
      continue;
    }
    const color = built.providedColors.get(id);
    if (color === undefined) {
      out.push([id, entry]);
      continue;
    }
    const base = isRecord(entry) ? entry : {};
    const { example: _example, required: _required, label: _label, ...rest } = base;
    out.push([id, { ...rest, type: "color", value: color }]);
  }
  return out.length ? Object.fromEntries(out) : undefined;
}

function finish(presentation: Record<string, unknown>, built: Plan, options: ResolveVariablesOptions & { shape?: boolean }): ResolveVariablesResult {
  const { context } = built;
  const complete = built.unfilled.length === 0;
  // Escapes are consumed only when the pass completes the deck, so a partial fill can be filled again.
  context.unescape = complete && context.content && !context.shape;
  const walked = context.content ? (walk(presentation, "", false, context) as Record<string, unknown>) : presentation;
  const result: Record<string, unknown> = { ...walked };
  const variables = rebuildVariables(presentation, built, context.shape);
  if (variables) result.variables = variables;
  else delete result.variables;
  if (!context.shape && complete && hasOwn(result, "template")) delete result.template;
  if (context.content) {
    const used = new Set(context.uses.map((use) => use.id));
    for (const declaration of built.declarations) {
      if (declaration.kind !== "color" && !used.has(declaration.id)) {
        context.diagnostics.push({ code: "variable-unused", severity: "warning", path: declaration.path, id: declaration.id, message: `Variable '${declaration.id}' is declared but never used; reference it as '{{${declaration.id}}}' or 'var:${declaration.id}'.` });
      }
    }
  }
  const diagnostics = context.diagnostics;
  if (options.strict && diagnostics.some((entry) => entry.severity === "error")) throw new OPFVariableError(diagnostics);
  return { presentation: result, diagnostics, unfilled: built.unfilled, examplesUsed: built.examplesUsed, complete };
}

/**
 * Resolve a presentation's variables against caller-supplied values and return
 * the concrete deck. Pure and deterministic; never invents content: a value
 * comes from the caller, the declaration's `value`, or (only when
 * `options.examples` is set) the declaration's `example`. See
 * docs/templates-and-variables.md.
 */
export function resolveVariables(presentation: unknown, values: VariableValues = {}, options: ResolveVariablesOptions = {}): ResolveVariablesResult {
  if (!isRecord(presentation)) throw new TypeError("resolveVariables expects a presentation object.");
  if (!isRecord(values)) throw new TypeError("resolveVariables values must be an object keyed by variable id.");
  const built = plan(presentation, values, options);
  // Nothing to substitute: share the input untouched.
  if (!built.context.content && built.providedColors.size === 0 && built.context.diagnostics.length === 0) {
    return { presentation, diagnostics: [], unfilled: built.unfilled, examplesUsed: [], complete: built.unfilled.length === 0 };
  }
  return finish(presentation, built, options);
}

/**
 * The document as validation sees it: every variable replaced by its value,
 * example or a type sample, with the declarations kept, so a template is
 * schema-checked as the deck it would become and paths still match the source.
 * Internal to validation.
 */
export function instantiateForValidation(presentation: Record<string, unknown>, values: VariableValues = {}, template?: boolean): ResolveVariablesResult {
  // Unfilled variables take their example or a type sample here; the validator reports them under its own rules.
  const options = { template, shape: true, partial: true };
  return finish(presentation, plan(presentation, values, options), options);
}

export interface VariableInfo extends VariableDeclaration {
  /** True when the declaration (or the supplied values) gives the variable a value. */
  filled: boolean;
  /** Every place the variable is referenced. */
  uses: VariableUse[];
}

/**
 * The variables a deck or template declares, for fill forms and agents: kind,
 * label, requirement, example, current value and every place each is used.
 */
export function listVariables(presentation: unknown, values: VariableValues = {}): VariableInfo[] {
  if (!isRecord(presentation)) return [];
  const built = plan(presentation, isRecord(values) ? values : {}, { examples: false, partial: true });
  built.context.shape = true;
  built.context.content = true;
  walk(presentation, "", false, built.context);
  return built.declarations.map((declaration) => {
    const effective = built.context.effective.get(declaration.id);
    return {
      ...declaration,
      ...(effective?.status === "filled" && effective.provided ? { value: effective.value } : {}),
      filled: effective?.status === "filled",
      uses: built.context.uses.filter((use) => use.id === declaration.id),
    };
  });
}
