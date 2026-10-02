// Shared plumbing of the Markdown converter: source lines and locations, diagnostics in the lint report shape,
// YAML reading and writing for front matter and embedded blocks, CSV for chart data. Internal module.
import { type ParsedNode, Scalar, YAMLMap, parseDocument, stringify } from "yaml";
import type { LintDiagnostic, LintLocation, LintSeverity } from "../lint.js";
import { type Obj, isRecord, same } from "../convert/shared.js";

/** A half-open range of UTF-16 offsets in the Markdown source. */
export interface Range {
  start: number;
  end: number;
}

export interface Line {
  /** The text of the line without its line ending. */
  text: string;
  start: number;
  end: number;
  /** One-based line number. */
  no: number;
}

/** Split a source into lines (LF, CRLF or CR), keeping UTF-16 offsets into the original text. */
export function splitLines(source: string): Line[] {
  const lines: Line[] = [];
  let start = 0;
  let no = 1;
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    if (c === "\n" || c === "\r") {
      lines.push({ text: source.slice(start, i), start, end: i, no: no++ });
      if (c === "\r" && source[i + 1] === "\n") i++;
      i++;
      start = i;
    } else i++;
  }
  if (start < source.length) lines.push({ text: source.slice(start), start, end: source.length, no });
  return lines;
}

/** A diagnostic in the shape of `@openpresentation/opf/lint`, with the source range always present. */
export type MarkdownDiagnostic = LintDiagnostic & { location: LintLocation };

export class Ctx {
  readonly diagnostics: MarkdownDiagnostic[] = [];
  /** JSON Pointer in the converted document to the source range that produced it. */
  readonly ranges = new Map<string, Range>();
  private readonly lineStarts: number[] = [0];

  constructor(readonly source: string) {
    for (let i = 0; i < source.length; i++) {
      if (source[i] === "\r") {
        if (source[i + 1] === "\n") i++;
        this.lineStarts.push(i + 1);
      } else if (source[i] === "\n") this.lineStarts.push(i + 1);
    }
  }

  location(range: Range): LintLocation {
    let lo = 0;
    let hi = this.lineStarts.length;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if ((this.lineStarts[mid] ?? 0) <= range.start) lo = mid;
      else hi = mid;
    }
    return { offset: range.start, length: Math.max(0, range.end - range.start), line: lo + 1, column: range.start - (this.lineStarts[lo] ?? 0) + 1 };
  }

  report(ruleId: string, severity: LintSeverity, message: string, help: string, range: Range, path = ""): void {
    this.diagnostics.push({ ruleId, severity, scope: "document", path, message, help, location: this.location(range) });
  }
  error(rule: string, message: string, help: string, range: Range, path = ""): void {
    this.report(`markdown/${rule}`, "error", message, help, range, path);
  }
  warn(rule: string, message: string, help: string, range: Range, path = ""): void {
    this.report(`markdown/${rule}`, "warning", message, help, range, path);
  }
  get errors(): number {
    return this.diagnostics.filter((d) => d.severity === "error").length;
  }

  /** The source range of a JSON Pointer, falling back to the nearest ancestor that has one. */
  rangeOf(pointer: string): Range | undefined {
    for (let path = pointer; ; path = path.slice(0, path.lastIndexOf("/"))) {
      const found = this.ranges.get(path);
      if (found) return found;
      if (!path) return undefined;
    }
  }
}

export const lineRange = (first: Line, last: Line = first): Range => ({ start: first.start, end: last.end });

// --- YAML --------------------------------------------------------------------------------------

export interface YamlResult {
  value: Obj;
  /** Source range of each top-level key (the key through its value), by key. */
  keys: Map<string, Range>;
  ok: boolean;
}

/** Read a YAML mapping (JSON-compatible data only: no anchors, no tags, no duplicate keys). Offsets are relative to `base`. */
export function readYamlMapping(text: string, base: number, ctx: Ctx, rule: string, context: Range): YamlResult {
  const keys = new Map<string, Range>();
  const doc = parseDocument(text, { schema: "core", uniqueKeys: true, merge: false, prettyErrors: false });
  let ok = true;
  for (const error of doc.errors) {
    ok = false;
    const [start, end] = error.pos;
    ctx.error(rule, `YAML: ${error.message.split("\n")[0]}`, "Fix the YAML syntax. Front matter and embedded blocks hold JSON-compatible YAML: mappings, sequences and scalars, no anchors or tags.", { start: base + start, end: base + Math.max(end, start) });
  }
  if (!ok) return { value: {}, keys, ok };
  if (doc.contents === null) return { value: {}, keys, ok };
  if (!(doc.contents instanceof YAMLMap)) {
    ctx.error(`${rule}-not-mapping`, "Expected a YAML mapping of keys and values.", "Write `key: value` lines; a list or a bare value is not accepted here.", context);
    return { value: {}, keys, ok: false };
  }
  for (const pair of doc.contents.items) {
    const key = pair.key as ParsedNode | null;
    const name = key instanceof Scalar ? String(key.value) : undefined;
    if (name !== undefined && key?.range) keys.set(name, { start: base + key.range[0], end: base + ((pair.value as ParsedNode | null)?.range?.[1] ?? key.range[1]) });
  }
  let value: unknown;
  try {
    value = doc.toJS({ maxAliasCount: 0 });
  } catch (error) {
    ctx.error(rule, `YAML: ${(error as Error).message}`, "Anchors and aliases are not accepted; write each value out.", context);
    return { value: {}, keys, ok: false };
  }
  const bad = nonJson(value);
  if (bad) {
    ctx.error(rule, `YAML value is not JSON-compatible (${bad}).`, "Quote special numbers such as .inf or .nan to keep them as strings.", context);
    return { value: {}, keys, ok: false };
  }
  return { value: value as Obj, keys, ok };
}

function nonJson(value: unknown): string | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? undefined : "a number that is not finite";
  if (value === null || typeof value === "string" || typeof value === "boolean") return undefined;
  if (Array.isArray(value)) return value.map(nonJson).find(Boolean);
  if (isRecord(value)) return Object.values(value).map(nonJson).find(Boolean);
  return `a ${typeof value}`;
}

/** Write JSON data as YAML that reads back to exactly the same data (one retry in all-quoted style), or undefined. */
export function writeYaml(value: Obj): string | undefined {
  for (const blockQuote of [true, false] as const) {
    const text = stringify(value, { indent: 2, lineWidth: 0, minContentWidth: 0, blockQuote, defaultStringType: "PLAIN", defaultKeyType: "PLAIN" });
    const doc = parseDocument(text, { schema: "core", uniqueKeys: true, merge: false });
    if (!doc.errors.length && same(doc.toJS({ maxAliasCount: 0 }), value)) return text.endsWith("\n") ? text : `${text}\n`;
  }
  return undefined;
}

export const DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

/** A value of a metric block: plain text when that reads back as the same string, otherwise a JSON string. */
export function scalarText(value: string | number): string {
  if (typeof value === "number") return DECIMAL.test(String(value)) ? String(value) : JSON.stringify(String(value));
  const plain = value !== "" && value === value.trim() && !value.startsWith('"') && !/[\r\n]/.test(value) && !DECIMAL.test(value);
  return plain ? value : JSON.stringify(value);
}

// --- CSV (chart data) --------------------------------------------------------------------------

export interface CsvField {
  value: string;
  quoted: boolean;
}

/** RFC 4180 records; a quoted field may hold commas, quotes (doubled) and line breaks. Returns undefined text on a syntax error. */
export function readCsv(text: string): { rows: CsvField[][]; error?: string } {
  const rows: CsvField[][] = [];
  let row: CsvField[] = [];
  let i = 0;
  const n = text.length;
  const endRecord = () => {
    rows.push(row);
    row = [];
  };
  while (i < n) {
    while (text[i] === " " || text[i] === "\t") i++;
    if (text[i] === '"') {
      let value = "";
      i++;
      for (;;) {
        if (i >= n) return { rows, error: "A quoted field is not closed." };
        if (text[i] === '"') {
          if (text[i + 1] === '"') {
            value += '"';
            i += 2;
            continue;
          }
          i++;
          break;
        }
        value += text[i++];
      }
      while (text[i] === " " || text[i] === "\t") i++;
      if (i < n && text[i] !== "," && text[i] !== "\n" && text[i] !== "\r") return { rows, error: "Text follows a closing quote." };
      row.push({ value, quoted: true });
    } else {
      let j = i;
      while (j < n && text[j] !== "," && text[j] !== "\n" && text[j] !== "\r") j++;
      row.push({ value: text.slice(i, j).trim(), quoted: false });
      i = j;
    }
    if (text[i] === ",") {
      i++;
      if (i >= n || text[i] === "\n" || text[i] === "\r") row.push({ value: "", quoted: false });
      continue;
    }
    if (text[i] === "\r" && text[i + 1] === "\n") i++;
    i++;
    endRecord();
  }
  if (row.length) endRecord();
  return { rows };
}

const needsQuotes = (value: string): boolean => /[",\r\n]/.test(value) || value !== value.trim() || value === "";

/** One CSV field for a cell: typed values stay bare, text that would read back as another type or break the record is quoted. */
export function csvField(cell: unknown, header = false): string {
  if (cell === null) return "";
  if (typeof cell === "number") return String(cell);
  if (typeof cell === "boolean") return String(cell);
  const text = String(cell);
  const ambiguous = !header && (DECIMAL.test(text) || /^(?:true|false)$/.test(text));
  return needsQuotes(text) || ambiguous ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Raised by `opfToMarkdown` for a document it cannot convert: `invalid-document` (does not validate as OPF) or `not-representable` (a value that no Markdown or YAML form can carry exactly). */
export class OPFMarkdownError extends Error {
  readonly code: "invalid-document" | "not-representable";
  readonly details: Record<string, unknown>;
  constructor(code: "invalid-document" | "not-representable", message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "OPFMarkdownError";
    this.code = code;
    this.details = details;
  }
}
