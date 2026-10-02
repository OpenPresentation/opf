// Shared helpers for the pure content conversions (`@openpresentation/opf/convert`). Internal module.
import { validatePresentation } from "../validator.js";

/** Content fields a payload can hold; a block with exactly one of them is a convertible leaf. */
export const CONTENT_KEYS = ["text", "items", "bullets", "image", "video", "chart", "table", "code", "metric", "quote", "timeline"] as const;
export type ContentKey = (typeof CONTENT_KEYS)[number];
/** Slide-only fields: a payload that has any of them is a slide, not a block. */
export const SLIDE_ONLY_KEYS = ["title", "subtitle", "tag", "layout", "design", "notes", "section", "hidden", "beat"] as const;

export type Json = any;
export type Obj = Record<string, any>;

/**
 * Raised when a conversion is refused. `code` is `not-convertible` when the pair or the content has no
 * safe mapping (the message says why and what to change) and `invalid-output` when the result would not
 * validate as OPF (a bug in a converter or an input outside the supported shapes).
 */
export class OPFConversionError extends Error {
  readonly code: "not-convertible" | "invalid-output";
  readonly details: Record<string, unknown>;
  constructor(code: "not-convertible" | "invalid-output", message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "OPFConversionError";
    this.code = code;
    this.details = details;
  }
}

export const refuse = (message: string, details: Record<string, unknown> = {}): OPFConversionError => new OPFConversionError("not-convertible", message, details);

/** What every conversion reports: nothing is lost when `lossless` is true, otherwise `loss` names what is not carried over. */
export interface ConversionReport {
  /** True when everything in the source is carried over (formatting, structure and metadata included). */
  lossless: boolean;
  /** Human-readable names of what the result cannot carry, for example `text formatting` or `list nesting levels`. Empty when lossless. */
  loss: string[];
}

export class Loss {
  readonly list: string[] = [];
  note(message: string): void {
    if (!this.list.includes(message)) this.list.push(message);
  }
  merge(other: readonly string[]): void {
    for (const message of other) this.note(message);
  }
}
export const report = (loss: readonly string[]): ConversionReport => ({ lossless: loss.length === 0, loss: [...loss] });

export const isRecord = (value: unknown): value is Obj => !!value && typeof value === "object" && !Array.isArray(value);
export const clone = <T>(value: T): T => structuredClone(value);
export const own = (value: object, key: string): boolean => Object.hasOwn(value, key);
export const same = (a: unknown, b: unknown): boolean => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (isRecord(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

/** True when the object holds slide-level fields, so it must validate as a slide rather than a block. */
export const isSlideLike = (payload: Obj): boolean => SLIDE_ONLY_KEYS.some((key) => own(payload, key));

/** The content keys a payload holds, in key order. */
export const contentKeysOf = (payload: Obj): ContentKey[] => CONTENT_KEYS.filter((key) => payload[key] !== undefined);

/**
 * Validate a candidate payload, slide or run of slides as OPF. A block is validated inside a one-block
 * slide; a payload with slide-level fields is validated as the slide itself. Throws `invalid-output`.
 */
export function assertValidOutput(value: Obj | Obj[], as: "block" | "slide" | "slides" = "block"): void {
  const slides = as === "slides" ? (value as Obj[]) : as === "slide" ? [value as Obj] : [{ blocks: [value] }];
  const result = validatePresentation({ slides });
  if (!result.valid) {
    const first = result.errors[0];
    throw new OPFConversionError("invalid-output", `The converted content is not valid OPF: ${first?.message ?? "unknown error"}${first?.path ? ` (${first.path})` : ""}.`, { issues: result.errors });
  }
}
/** Validate an owner payload as a block, or as a slide when it carries slide fields. */
export const assertValidOwner = (owner: Obj): void => assertValidOutput(owner, isSlideLike(owner) ? "slide" : "block");

// --- text runs --------------------------------------------------------------------------------

export const FORMATTING = ["bold", "italic", "underline", "strikethrough", "color", "fontSize", "fontFamily", "link", "superscript", "subscript"] as const;
export type Run = string | Obj;
export const isPlainRun = (run: Run): boolean => typeof run === "string" || (isRecord(run) && !FORMATTING.some((key) => run[key] !== undefined));
export const runText = (run: Run): string => (typeof run === "string" ? run : (run.text ?? ""));
export const runsOf = (value: unknown): Run[] => (typeof value === "string" ? [value] : Array.isArray(value) ? (value as Run[]) : []);
export const plainOf = (value: unknown): string => runsOf(value).map(runText).join("");
export const hasFormatting = (value: unknown): boolean => runsOf(value).some((run) => !isPlainRun(run));
const NEWLINE = /\r\n|\r|\n/;

/** TextRun[] split at line breaks, keeping each run's formatting. Empty lines are kept. */
export function splitRuns(runs: Run[]): Run[][] {
  const lines: Run[][] = [[]];
  for (const run of runs) {
    const parts = runText(run).split(NEWLINE);
    parts.forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (part === "") return;
      lines[lines.length - 1]!.push(typeof run === "string" ? part : { ...run, text: part });
    });
  }
  return lines;
}
export function mergeRuns(runs: Run[]): Run[] {
  const merged: Run[] = [];
  for (const run of runs) {
    if (typeof run === "string" && typeof merged.at(-1) === "string") merged[merged.length - 1] += run;
    else merged.push(run);
  }
  return merged;
}
export const linePlain = (line: Run[]): string => line.map(runText).join("");
export const lineIsPlain = (line: Run[]): boolean => line.every(isPlainRun);
/** A line as a ListItem/TextRun value: a string when plain, otherwise the runs. */
export const lineValue = (line: Run[]): string | Run[] => (lineIsPlain(line) ? linePlain(line) : mergeRuns(line));
/** Lines joined with newlines: a string when plain, otherwise TextRun[]. */
export function joinLines(lines: Run[][]): string | Run[] {
  if (lines.every(lineIsPlain)) return lines.map(linePlain).join("\n");
  const runs: Run[] = [];
  lines.forEach((line, index) => {
    if (index > 0) runs.push("\n");
    runs.push(...line);
  });
  return mergeRuns(runs);
}
/** Concatenate two rich text values (string or TextRun[]) without adding anything between them. */
export function concatText(a: unknown, b: unknown): string | Run[] {
  if (typeof a === "string" && typeof b === "string") return a + b;
  return mergeRuns([...runsOf(a), ...runsOf(b)]);
}
