/**
 * Small helpers for writing a finding in plain words (`describeFinding`, `finding-text.ts`). Pure, browser-safe, no state.
 * Internal module: `finding-text-rules.ts` and `finding-text.ts` share them.
 */
import type { Finding } from "./generated/types/finding.js";

/** What a finding is turned into: a sentence that says what is wrong, and (almost always) what could come next. */
export interface FindingText {
  /** What is wrong, one or two sentences, American spelling, fields in backticks. */
  message: string;
  /** What could come next, without a leading "Next:" and starting in lower case. */
  next?: string;
}

/** What the text of a finding may read besides the finding itself. Every member is optional. */
export interface FindingTextContext {
  /** The checked document: lets a sentence quote the value that is there and read the schema and the ids of the document. */
  document?: unknown;
  /** The text format the finding was found in: examples are written for it (`"slides": [ ... ]` or `slides:`). Default `"json"`. */
  format?: "json" | "yaml" | "md";
  /** How many records of a catalog kind (`layouts`, `themes`, ...) can be chosen, for "press Ctrl+Space for the 28 layouts". */
  catalogCount?: (kind: string) => number;
  /** The chord that opens the list of choices in the editor the text is shown in. Default `Ctrl+Space`. */
  chord?: string;
  /** Overrides for what is otherwise read from `document`. */
  valueAt?: (segments: string[]) => unknown;
  schemaAt?: (segments: string[]) => Record<string, any> | undefined;
  keysOf?: (segments: string[]) => string[];
  catalogKind?: (segments: string[]) => string | undefined;
  starter?: (segments: string[], property: string) => unknown;
}

/** A function that writes the text of one rule's findings. Returns `undefined` to leave the finding to the default. */
export type RuleText = (finding: Finding, context: FindingTextContext, helpers: TextHelpers) => FindingText | undefined;

/** What the context gives a rule's text: the document, read safely. */
export interface TextHelpers {
  /** The segments of the finding's `path`. */
  segments: string[];
  /** The value of the document at `segments` (`undefined` when there is no document or no such value). */
  valueAt(segments: readonly string[]): unknown;
  /** Property `key` of a record in the document, or `undefined`. */
  get(path: readonly string[]): unknown;
  /** The chord that opens the list. */
  chord: string;
  /** The format of the text being edited (`json` unless told otherwise). */
  format: "json" | "yaml" | "md";
}

export const WORDS: Record<string, string> = { object: "an object", array: "a list", string: "text", number: "a number", integer: "a whole number", boolean: "true or false", null: "null" };
export const KIND_WORDS: Record<string, string> = { layouts: "layout", themes: "theme", colorSchemes: "color scheme", fontSchemes: "font scheme", narratives: "narrative", audiences: "audience", purposes: "purpose", tones: "tone", languages: "language" };
export const KIND_EXAMPLES: Record<string, string> = { layouts: "`pillars` or `acme:hero`", themes: "`minimal` or `acme:bold`", colorSchemes: "`boost` or `acme:night`", fontSchemes: "`aptos` or `acme:brand`", narratives: "`classic-story`", audiences: "`board`", purposes: "`inform`", tones: "`formal`" };
const ALIASES: Record<string, string> = { middle: "center", centre: "center", centered: "center", centred: "center", justify: "left", col: "column", cols: "column", pic: "image", picture: "image", photo: "image", paragraph: "text", bullets: "list", bullet: "list" };

/** The segments of a JSON Pointer (`/slides/0/title`); `""` is the document. */
export function segmentsOf(path: unknown): string[] {
  if (Array.isArray(path)) return path.map(String);
  if (typeof path !== "string" || path === "" || path === "/") return [];
  return path
    .replace(/^\//, "")
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
}

/** A JSON Pointer from segments. */
export function pointerOf(segments: readonly (string | number)[]): string {
  return segments.map((part) => `/${String(part).replaceAll("~", "~0").replaceAll("/", "~1")}`).join("");
}

/** Text in backticks. */
export const code = (value: unknown): string => `\`${String(value)}\``;
export const isIndex = (segment: unknown): boolean => /^\d+$/.test(String(segment));

/** Capitalize a sentence start; a backticked name is left alone. */
export function cap(text: string): string {
  return text.startsWith("`") ? text : text.charAt(0).toUpperCase() + text.slice(1);
}

/** What a field is called in a sentence: its name, or "slide 3" / "items entry 2" for a list entry. */
export function fieldLabel(segments: readonly string[]): string {
  if (!segments.length) return "the deck";
  const last = segments[segments.length - 1] as string;
  if (isIndex(last)) {
    const owner = [...segments].reverse().find((segment) => !isIndex(segment));
    return owner === "slides" ? `slide ${Number(last) + 1}` : owner ? `${owner} entry ${Number(last) + 1}` : `entry ${Number(last) + 1}`;
  }
  return code(last);
}

/**
 * Where an object is, in plain words, for "appears twice ...": "at the top level", "in slide 1", "in `design`", "in `design` of slide 2". A list index is
 * never shown as a name (`0` is not a place): it becomes "slide 1" or "`items` entry 1".
 */
export function placeWords(segments: readonly string[]): string {
  if (!segments.length) return "at the top level";
  const slide = segments[0] === "slides" && segments.length >= 2 && isIndex(segments[1]) ? Number(segments[1]) + 1 : undefined;
  if (slide !== undefined && segments.length === 2) return `in slide ${slide}`;
  const last = segments[segments.length - 1] as string;
  const inner = isIndex(last) ? fieldLabel(segments) : code(last);
  return slide !== undefined ? `in ${inner} of slide ${slide}` : `in ${inner}`;
}

/** What an object is called in a sentence ("the deck", "a slide", "`design`"). */
export function containerName(segments: readonly string[]): string {
  if (!segments.length) return "the deck";
  if (segments.length === 2 && segments[0] === "slides" && isIndex(segments[1])) return "a slide";
  const last = segments[segments.length - 1] as string;
  return isIndex(last) ? fieldLabel(segments) : code(last);
}

/** A value in a sentence: "`Hello`", "a number (`42`)", "a list of 3". */
export function describeValue(value: unknown): string {
  if (value === undefined) return "missing";
  if (value === null) return "null";
  if (Array.isArray(value)) return value.length ? `a list of ${value.length}` : "an empty list";
  if (typeof value === "object") return "an object";
  if (typeof value === "string") return value === "" ? "empty" : code(value.length > 30 ? `${value.slice(0, 29)}…` : value);
  return `${typeof value === "number" ? "a number" : "true or false"} (${code(String(value))})`;
}

/** What a value is, with its text: "text (`Hello`)", "a number (`42`)", "empty text", "a list". */
export function describeKind(value: unknown): string {
  if (typeof value === "string") return value === "" ? "empty text" : `text (${describeValue(value)})`;
  return describeValue(value);
}

/** Types in words: "text or a list". */
export function typeWords(type: unknown): string {
  const list = (Array.isArray(type) ? type : [type]).filter(Boolean).map((entry) => WORDS[String(entry)] ?? String(entry));
  return [...new Set(list)].join(" or ") || "a different kind of value";
}

/** Edit distance between two short strings (case-insensitive; enough for "did you mean"). */
export function distance(a: string, b: string): number {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (x === y) return 0;
  const row = Array.from({ length: y.length + 1 }, (_, index) => index);
  for (let i = 1; i <= x.length; i++) {
    let previous = row[0] as number;
    row[0] = i;
    for (let j = 1; j <= y.length; j++) {
      const keep = row[j] as number;
      row[j] = Math.min((row[j] as number) + 1, (row[j - 1] as number) + 1, previous + (x[i - 1] === y[j - 1] ? 0 : 1));
      previous = keep;
    }
  }
  return row[y.length] as number;
}

/** The candidates ordered by closeness to `value`; `close` holds those within an edit distance of 2 (or a known alias) and `all` every candidate. */
export function nearest(value: unknown, candidates: readonly unknown[], limit = 5): { close: unknown[]; all: unknown[] } {
  const text = String(value ?? "");
  const alias = ALIASES[text.toLowerCase()];
  const ranked = candidates.map((candidate) => ({ candidate, score: String(candidate).toLowerCase() === alias ? 0 : distance(text, String(candidate)) }));
  ranked.sort((a, b) => a.score - b.score);
  const close = ranked.filter((entry) => entry.score <= Math.max(2, Math.floor(text.length / 4))).map((entry) => entry.candidate);
  return { close: close.slice(0, limit), all: ranked.map((entry) => entry.candidate) };
}

/** Values joined for a sentence: "left, center or right"; above five, the count and the first three. */
export function valueList(values: readonly unknown[], max = 5): string {
  const list = values.map((value) => (typeof value === "string" ? value : JSON.stringify(value)));
  if (list.length <= max) return list.length > 1 ? `${list.slice(0, -1).join(", ")} or ${list.at(-1)}` : list.join("");
  return `one of ${list.length} values (${list.slice(0, 3).join(", ")}, …)`;
}

/** Items joined for a sentence: "a, b and c"; above `max` the first ones and "N more". */
export function itemList(items: readonly string[], max = 6): string {
  if (items.length <= max) return items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items.at(-1)}` : items.join("");
  return `${items.slice(0, max).join(", ")} and ${items.length - max} more`;
}

/** The first sentence of a text. */
export const firstSentence = (text: unknown): string => /^.*?[.!?](?=\s|$)/.exec(String(text ?? "").replace(/\s+/g, " ").trim())?.[0] ?? "";

/** A sentence made to continue after "Next:" (lower-case first letter, no trailing space). */
export function asNext(text: string): string {
  const trimmed = text.trim();
  // "Write the title" becomes "write the title"; "CSV", "JSON" and "YAML" keep their capitals.
  return /^[A-Z][a-z]/.test(trimmed) ? trimmed.charAt(0).toLowerCase() + trimmed.slice(1) : trimmed;
}

/** Plural: `plural(2, "slide")` is "2 slides". */
export const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? "" : "s"}`;

/** A JSON string literal of a short text, cut at `max` characters. */
export function shorten(text: string, max = 40): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Whether `value` is a plain object. */
export const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

/** The value of `document` at `segments`, or `undefined`. */
export function readAt(document: unknown, segments: readonly string[]): unknown {
  let value: unknown = document;
  for (const segment of segments) {
    if (Array.isArray(value)) value = value[Number(segment)];
    else if (isRecord(value)) value = value[segment];
    else return undefined;
  }
  return value;
}

/** What `explain(ruleId)` returns: what a rule checks, why it matters and a before/after example. */
export interface RuleExplanation {
  /** The finding's `ruleId`: `opf/text-contrast`, `yaml/syntax`, `markdown/fence-unterminated`. */
  id: string;
  /** The short name: `text-contrast`. */
  name: string;
  category: string;
  /** The default severity (host policy can change it). */
  severity: "error" | "warning" | "info";
  /** One sentence: what the rule finds. */
  summary: string;
  /** Why it matters to the person who reads or presents the deck, or to the tools that read the file. */
  rationale: string;
  /** What to do, in a sentence or two (the general advice behind a finding's `Next:` line). */
  fix: string;
  /** A small example of the problem and of the repair, as the author would write it (JSON for `opf/*`, the reader's own format for `yaml/*` and `markdown/*`). */
  example?: { problem: string; fixed: string; language?: "json" | "yaml" | "markdown" };
  /** Where the rule is documented. */
  docs: string;
}

/** An entry of a table that `explain` reads for rules that are not in the `validationRules` registry (`yaml/*`, `markdown/*`). */
export type ExplainEntry = Omit<RuleExplanation, "id" | "name" | "docs">;
