/**
 * Helpers shared by the per-rule text tables (`finding-text-format.ts`, `finding-text-audit.ts`). Pure, browser-safe, no state.
 *
 * Most rules put what the text needs in `path`, `validation.params`, `measured`, `suggestions` or `fixes`; a few carry a parameter only in their own
 * `message` sentence. `match` reads those with an anchored expression and returns `undefined` when the sentence is not the expected shape, so a rule
 * text falls back to the finding's own message instead of printing garbage.
 */
import type { Finding } from "./generated/types/finding.js";
import {
  type FindingText,
  type TextHelpers,
  asNext,
  code,
  describeKind,
  distance,
  isIndex,
  isRecord,
  nearest,
  plural,
} from "./finding-text-util.js";

/** Whether a string ends a sentence. */
const ENDS = /[.?!]$/;

/** `text` with exactly one closing period (a question mark is kept). */
export function sentence(text: string): string {
  const trimmed = text.trim();
  return ENDS.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** Core's own words in American spelling (core's sentences say "colour" in a few places). */
export function us(text: string): string {
  return text.replace(/colour/g, "color").replace(/Colour/g, "Color");
}

/** A kept core sentence: American spelling, one closing period. */
export const keep = (text: string): string => sentence(us(text));

/** The match of `regex` in `text`, or `undefined`. */
export function match(text: string, regex: RegExp): RegExpExecArray | undefined {
  return regex.exec(text) ?? undefined;
}

/** A JSON string literal as core prints it (`"a b"`), read back; anything else is returned as it is, without surrounding quotes. */
export function unquote(text: string | undefined): string {
  if (text === undefined) return "";
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value === "string") return value;
  } catch {
    // not a JSON literal: fall through
  }
  return text.replace(/^['"]|['"]$/g, "");
}

/** The comma-separated JSON string literals of a core sentence (`"a", "b"`), or the plain names when they are not literals. */
export function unquoteList(text: string | undefined): string[] {
  if (text === undefined) return [];
  try {
    const value: unknown = JSON.parse(`[${text}]`);
    if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) return value as string[];
  } catch {
    // not JSON: fall through
  }
  return text
    .split(/,\s*/)
    .map((entry) => entry.replace(/^['"]|['"]$/g, "").trim())
    .filter((entry) => entry && entry !== "...");
}

/** The one-based slide number of a finding, from `slide` or its path. */
export function slideNumber(finding: Finding): number | undefined {
  if (finding.slide !== undefined) return finding.slide + 1;
  const found = /^\/slides\/(\d+)(?:\/|$)/.exec(finding.path);
  return found ? Number(found[1]) + 1 : undefined;
}

/** "slide 3" for a slide-scoped finding, `undefined` otherwise. */
export const slideWord = (finding: Finding): string | undefined => {
  const number = slideNumber(finding);
  return number === undefined ? undefined : `slide ${number}`;
};

/** " on slide 3" (or ""), for a sentence that ends with its subject. */
export const onSlide = (finding: Finding): string => {
  const word = slideWord(finding);
  return word ? ` on ${word}` : "";
};

/** "Slide 3", with the slide's id (`intro`) or layout (layout `pillars`) when the document says one: "Slide 3 (`intro`)". */
export function slideRef(finding: Finding, helpers: TextHelpers): string {
  const number = slideNumber(finding);
  if (number === undefined) return "The deck";
  const id = finding.slideId ?? helpers.valueAt(["slides", String(number - 1), "id"]);
  if (typeof id === "string" && id) return `Slide ${number} (${code(id)})`;
  const layout = helpers.valueAt(["slides", String(number - 1), "layout"]);
  if (typeof layout === "string" && layout) return `Slide ${number} (layout ${code(layout)})`;
  return `Slide ${number}`;
}

/** The last segment of a path that is a name, not a list index. */
export const lastName = (segments: readonly string[]): string | undefined => [...segments].reverse().find((segment) => !isIndex(segment));

/** A path as an author writes it: `regions[1].size`, `slides[2].chart.mapping`. */
export function dotted(segments: readonly string[]): string {
  return segments.reduce((out, segment) => (isIndex(segment) ? `${out}[${segment}]` : out ? `${out}.${segment}` : segment), "");
}

/** "1st", "2nd", "3rd", "4th". */
export function ordinal(index: number): string {
  const rest = index % 100;
  const suffix = rest >= 11 && rest <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[index % 10] ?? "th";
  return `${index}${suffix}`;
}

/** The ids (keys) of a record in the document, or an empty list. */
export function keysAt(helpers: TextHelpers, path: readonly string[]): string[] {
  const value = helpers.valueAt(path);
  return isRecord(value) ? Object.keys(value) : [];
}

/** The `id` of every entry of a list in the document. */
export function idsAt(helpers: TextHelpers, path: readonly string[]): string[] {
  const value = helpers.valueAt(path);
  return Array.isArray(value) ? value.flatMap((entry) => (isRecord(entry) && typeof entry.id === "string" ? [entry.id] : [])) : [];
}

/** Code-formatted names joined for a sentence: "`a`, `b` and `c`". */
export function codeList(names: readonly unknown[], max = 5, joiner = "and"): string {
  const shown = names.slice(0, max).map(code);
  const rest = names.length - shown.length;
  if (rest > 0) return `${shown.join(", ")} and ${rest} more`;
  return shown.length > 1 ? `${shown.slice(0, -1).join(", ")} ${joiner} ${shown.at(-1)}` : shown.join("");
}

/** Plain names joined for a list in a sentence: "a, b, c" (no backticks, for lists that read as data); above `max`, "a, b and 3 more". */
export function plainList(names: readonly string[], max = 6): string {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return rest > 0 ? `${shown.join(", ")} and ${rest} more` : shown.join(", ");
}

/** Plain names joined as prose: "a, b and c". */
export function andList(names: readonly string[], max = 6): string {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  if (rest > 0) return `${shown.join(", ")} and ${rest} more`;
  return shown.length > 1 ? `${shown.slice(0, -1).join(", ")} and ${shown.at(-1)}` : shown.join("");
}

/**
 * The "did you mean" continuation for a value that should have been one of `candidates`, for the `next` line: `did you mean \`x\`?` when one is close
 * (then "Or `alternative`." when there is another way out), `use \`x\`.` for a single candidate, else `pick one of \`a\`, \`b\`, \`c\`` in the order
 * given, with `alternative` (what else could be done, a phrase such as "add `assets.logo`") after it.
 */
export function chooseNext(value: unknown, candidates: readonly unknown[], alternative = "", max = 3): string {
  const { close } = nearest(value, candidates);
  const or = alternative ? ` Or ${alternative}.` : "";
  if (close.length) return `did you mean ${code(close[0])}?${or}`;
  if (candidates.length === 1) return `use ${code(candidates[0])}${alternative ? `, or ${alternative}` : ""}.`;
  if (candidates.length) return `pick one of ${codeList(candidates, max, "or")}${alternative ? `, or ${alternative}` : ""}.`;
  return alternative ? sentence(alternative) : "choose a different value.";
}

/** How a block kind reads after "this block is": "a chart", "text", "an image". */
export function kindPhrase(kind: string): string {
  const phrases: Record<string, string> = { text: "text", code: "code", list: "a list", chart: "a chart", table: "a table", image: "an image", video: "a video", metric: "a metric", quote: "a quote", timeline: "a timeline", group: "a group" };
  return phrases[kind] ?? `${/^[aeiou]/i.test(kind) ? "an" : "a"} ${kind}`;
}

/** A name that is not taken: `base`-2, or `base` 2 for a name with spaces. */
export function freshName(base: string, taken: readonly string[] = []): string {
  const space = /\s/.test(base);
  for (let n = 2; n < 100; n++) {
    const candidate = space ? `${base} ${n}` : `${base}-${n}`;
    if (!taken.includes(candidate)) return candidate;
  }
  return `${base}-2`;
}

/** The kind of block a document node holds: `text`, `chart`, `image`, ... from its keys. */
const BLOCK_KINDS = ["chart", "image", "video", "table", "code", "metric", "quote", "timeline", "items", "bullets", "text"];
export function blockKind(node: unknown): string | undefined {
  if (!isRecord(node)) return undefined;
  if (typeof node.type === "string" && node.type !== "group") return node.type;
  const found = BLOCK_KINDS.find((key) => node[key] !== undefined);
  if (found === "items" || found === "bullets") return "list";
  return found;
}

/** A finding's text when the rule's own sentence cannot be taken apart: core's message kept, with a `next` from `fallback` (or its help). */
export function keepMessage(finding: Finding, fallbackNext: string): FindingText {
  return { message: keep(finding.message), next: fallbackNext };
}

/** The `help` of a finding as a `next` line: lower-case first letter, whole text kept, closing period. `fallback` when there is no help. */
export function helpAsNext(finding: Finding, fallback: string): string {
  const help = finding.help?.trim();
  return help ? sentence(asNext(us(help))) : fallback;
}

/** Whether `value` is a non-empty string. */
export const isText = (value: unknown): value is string => typeof value === "string" && value !== "";

/** Short text for a message: the first `max` characters. */
export function brief(text: string, max = 40): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/** A value in a sentence as the author wrote it: `light1`, a number, `true`; objects and lists by kind. */
export function show(value: unknown): string {
  if (typeof value === "string") return value === "" ? "empty text" : code(brief(value, 30));
  if (typeof value === "number" || typeof value === "boolean") return code(String(value));
  return describeKind(value);
}

export { distance, plural };
