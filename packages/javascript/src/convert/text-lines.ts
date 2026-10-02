// Plain-text line model shared by the text conversions: parsing of list indentation and markers,
// quote attributions, timeline dates and code fences. Every parse is conservative: it only fires on
// an unambiguous pattern, and what it cannot carry is reported by the caller. Internal module.
import { type Run, runText } from "./shared.js";

// --- list indentation and markers --------------------------------------------------------------

const LIST_PREFIX = /^([ \t]*)(?:([-*•+]|\d{1,3}[.)])[ \t]+)?/;
const indentWidth = (space: string): number => [...space].reduce((width, char) => width + (char === "\t" ? 4 : 1), 0);

export interface ParsedListLine {
  /** The line without its indentation and bullet or number marker. */
  line: Run[];
  indent: number;
  /** True when a numeric marker such as `1.` was removed (a list has no numbering to carry it). */
  numbered: boolean;
  marked: boolean;
}

/** Strip the indentation and the leading marker (`-`, `*`, `•`, `+`, `1.`, `1)`) from the first run of a line. */
export function parseListLine(line: Run[]): ParsedListLine {
  const first = line[0];
  if (first === undefined) return { line, indent: 0, numbered: false, marked: false };
  const text = runText(first);
  const match = LIST_PREFIX.exec(text)!;
  const rest = text.slice(match[0].length);
  const next: Run[] = [...line];
  if (rest === "") next.shift();
  else next[0] = typeof first === "string" ? rest : { ...first, text: rest };
  return { line: next, indent: indentWidth(match[1] ?? ""), numbered: /^\d/.test(match[2] ?? ""), marked: match[2] !== undefined };
}

/** Nesting levels from indentation widths, the way Markdown nests: a deeper indent opens one level, a shallower one closes back to the matching level. */
export function levelsFromIndents(indents: number[]): number[] {
  const stack: number[] = [];
  return indents.map((width) => {
    while (stack.length && stack.at(-1)! > width) stack.pop();
    if (!stack.length || stack.at(-1)! < width) stack.push(width);
    return stack.length - 1;
  });
}

// --- quote attribution -------------------------------------------------------------------------

const STRONG_DASH = /^\s*(?:—|–|―|--|~)\s*(\S.*?)\s*$/;
const WEAK_DASH = /^\s*-\s+(\S.*?)\s*$/;
const MAX_ATTRIBUTION = 120;
const OPEN_QUOTE = /^\s*[“"‘«„]/;
const INLINE_ATTRIBUTION = /^(.*[”"’»“])\s+[—–]\s+(\S.*?)\s*$/;

export interface ParsedQuote {
  text: string[];
  attribution?: string;
  source?: string;
}

/**
 * Split plain lines into a quote body and an attribution. Recognised, and only at the end of the text:
 * one or two trailing lines that start with a dash (`— Name, Title`, `– Name`, `-- Name`, `~ Name`, and
 * `- Name` unless the body is itself a dashed list), the second one being the source, or a last line that
 * ends with a closing quote mark followed by ` — Name` when the quote opens with a quote mark. A dash line
 * needs a body line before it and must be one short line. Anything else is left as the quote text.
 */
export function parseQuoteLines(lines: string[]): ParsedQuote {
  const attributionOf = (line: string, body: string[]): string | undefined => {
    const strong = STRONG_DASH.exec(line);
    const weak = strong ? undefined : WEAK_DASH.exec(line);
    const text = (strong ?? weak)?.[1];
    if (!text || text.length > MAX_ATTRIBUTION) return undefined;
    // A leading ASCII hyphen is also a list marker: it is an attribution only if the body is not a dashed list.
    if (weak && body.length && body.every((entry) => /^\s*-\s+/.test(entry))) return undefined;
    return text;
  };
  if (lines.length >= 2) {
    const last = attributionOf(lines.at(-1)!, lines.slice(0, -1));
    if (last !== undefined) {
      if (lines.length >= 3) {
        const middle = attributionOf(lines.at(-2)!, lines.slice(0, -2));
        if (middle !== undefined) return { text: lines.slice(0, -2), attribution: middle, source: last };
      }
      return { text: lines.slice(0, -1), attribution: last };
    }
  }
  const final = lines.at(-1);
  if (final !== undefined) {
    const inline = INLINE_ATTRIBUTION.exec(final);
    if (inline && OPEN_QUOTE.test(lines[0]!) && inline[2]!.length <= MAX_ATTRIBUTION && !/[—–]/.test(inline[2]!)) return { text: [...lines.slice(0, -1), inline[1]!], attribution: inline[2]! };
  }
  return { text: lines };
}

// --- timeline dates ----------------------------------------------------------------------------

const MONTH = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?";
const YEAR = "(?:1[5-9]\\d\\d|2[01]\\d\\d)";
const WHEN = new RegExp(
  `^(?:${[
    `${YEAR}(?:-\\d{2}(?:-\\d{2})?)?`,
    `${YEAR}[–-]${YEAR}`,
    `Q[1-4](?:\\s*(?:'\\d{2}|${YEAR}))?`,
    `${YEAR}\\s*Q[1-4]`,
    `H[12](?:\\s*${YEAR})?`,
    `${YEAR}\\s*H[12]`,
    `${MONTH}(?:\\s+\\d{1,2}(?:st|nd|rd|th)?)?(?:,?\\s+${YEAR})?`,
    `\\d{1,2}\\s+${MONTH}(?:\\s+${YEAR})?`,
    "(?:Week|Wk|Day|Month|Sprint|Phase|Step|Stage)\\s+\\d{1,3}",
  ].join("|")})$`,
  "i",
);
const WHEN_SEPARATOR = /\s*:\s+|\s+[–—-]\s+|\s*[—–]\s*/g;

/** Whether a whole string reads as a date, quarter, month, year, week or numbered period. */
export const looksLikeWhen = (text: string): boolean => text.length <= 24 && WHEN.test(text.trim());

/**
 * Split `2024 — Launch`, `Q1 2026: Pilot` or `Jan - Kickoff` into the date label and the event text.
 * The label must read as a date or a numbered period; with `loose` any label of at most 24 characters
 * before a `: ` also counts. Returns undefined when the line does not match.
 */
export function splitWhen(text: string, loose = false): { when: string; what: string } | undefined {
  for (const match of text.matchAll(WHEN_SEPARATOR)) {
    const when = text.slice(0, match.index).trim();
    const what = text.slice(match.index + match[0].length).trim();
    if (!when || !what) continue;
    if (looksLikeWhen(when) || (loose && match[0].trim() === ":" && when.length <= 24)) return { when, what };
  }
  return undefined;
}

// --- code fences -------------------------------------------------------------------------------

const FENCE_OPEN = /^\s*(`{3,}|~{3,})[ \t]*([^`\r\n]*?)[ \t]*$/;

export interface ParsedFence {
  source: string;
  language?: string;
  filename?: string;
}

const fenceLine = (char: string, length: number): RegExp => new RegExp(`^\\s*${char === "`" ? "`" : "~"}{${length},}\\s*$`);

/**
 * Read a text that is one fenced code block (``` or ~~~, optional info string, closing fence of at least the
 * same length, nothing else). The language is the first word of the info string and the file name comes
 * from a `title="..."`, `filename=...` or `file=...` attribute; nothing is guessed from the code.
 */
export function parseCodeFence(lines: string[]): ParsedFence | undefined {
  if (lines.length < 2) return undefined;
  const open = FENCE_OPEN.exec(lines[0]!);
  if (!open) return undefined;
  const fence = open[1]!;
  const closing = fenceLine(fence[0]!, fence.length);
  if (!closing.test(lines.at(-1)!)) return undefined;
  const body = lines.slice(1, -1);
  // An inner line that is itself a closing fence would end the block early: this is not one block.
  if (body.some((line) => closing.test(line))) return undefined;
  const info = open[2] ?? "";
  const result: ParsedFence = { source: body.join("\n") };
  const attribute = /(?:^|\s)(?:title|filename|file)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/.exec(info);
  const filename = attribute ? (attribute[1] ?? attribute[2] ?? attribute[3]) : undefined;
  const language = /^(?:title|filename|file)\s*=/.test(info) ? undefined : /^\{?\.?([A-Za-z0-9_+#.-]+)/.exec(info)?.[1];
  if (language) result.language = language;
  if (filename) result.filename = filename;
  return result;
}

/** A fenced block for code with a language or a file name; the fence is longer than any run of backticks inside. */
export function fenceCode(source: string, language?: string, filename?: string): string[] {
  const longest = Math.max(2, ...[...source.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = "`".repeat(longest + 1);
  const info = [language, filename ? `title="${filename.replaceAll('"', "'")}"` : undefined].filter(Boolean).join(" ");
  return [`${fence}${info}`, ...source.split(/\r\n|\r|\n/), fence];
}
