/**
 * YAML syntax problems in plain words (VALIDATOR-HINTS section 9): what the `yaml` library reports as "Implicit keys need to be on a single line" or
 * "Flow sequence in block collection must be sufficiently indented and end with a ]" becomes the sentence an author needs, at the place that matters
 * (the quote that is never closed, not the end of the file), with the text edits that repair it. One problem per root cause: the damage a mistake
 * does further down is dropped.
 *
 * Internal module for the YAML and Markdown readers (`readYamlDocument`, `readYamlMapping`); `analyzeYamlSyntax` is the public face
 * (`@openpresentation/opf/source`) that editors use for the edits. Browser-safe.
 */
import { type Document, type ParsedNode, type YAMLError, isMap, isScalar, isSeq, parseDocument, visit } from "yaml";
import type { SyntaxFix } from "../json-syntax.js";
import { type TextEdit, type TextRange, createLocator } from "../source-text.js";

/** Why the problem was reported, in kebab-case. */
export type YamlProblemCode =
  | "tab-indent"
  | "unclosed-quote"
  | "unclosed-list"
  | "unclosed-map"
  | "incomplete-key"
  | "list-item-under-value"
  | "colon-in-value"
  | "misaligned"
  | "missing-dash"
  | "trailing-text"
  | "missing-colon"
  | "bad-escape"
  | "reserved-start"
  | "long-key"
  | "duplicate-key"
  | "multiple-documents"
  | "empty-document"
  | "not-a-mapping"
  | "other";

/** One syntax problem: the reader's rule (`syntax`, `duplicate-key`, ...), a range in the analyzed text, the words and the repairs. */
export interface YamlProblem {
  /** The reader rule without its prefix: `syntax`, `duplicate-key`, `multiple-documents`, `empty`, `not-mapping`. */
  rule: string;
  code: YamlProblemCode;
  /** Offsets in the analyzed text; `end` is exclusive and may equal `start`. */
  start: number;
  end: number;
  /** What is wrong. */
  message: string;
  /** What to do, starting in lower case (`describeFinding`'s `next`). */
  next: string;
  /** `next` as a sentence, for a finding's `help`. */
  help: string;
  fixes: SyntaxFix[];
  /** Other places that belong to the problem (the first of two equal keys). */
  related?: { start: number; end: number }[];
}

const sentence = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
const code = (text: string): string => `\`${text}\``;

// ---- text helpers -------------------------------------------------------------------------------------------------------------

/** The line that holds `offset`: where it starts and where its text ends (before the line break). */
function lineAt(text: string, offset: number): { start: number; end: number } {
  const at = Math.max(0, Math.min(offset, text.length));
  let start = at;
  while (start > 0 && text[start - 1] !== "\n" && text[start - 1] !== "\r") start--;
  let end = at;
  while (end < text.length && text[end] !== "\n" && text[end] !== "\r") end++;
  return { start, end };
}

const lineNumber = (text: string, offset: number): number => createLocator(text)(offset, 0).line;

/** Where the content of `[from, end)` ends: before trailing spaces and before a ` # comment` (quote-aware). */
function contentEnd(text: string, from: number, end: number): number {
  let quote = "";
  let stop = end;
  for (let index = from; index < end; index++) {
    const char = text[index] as string;
    if (quote) {
      if (char === "\\" && quote === '"') index++;
      else if (char === quote) quote = "";
      continue;
    }
    if ((char === '"' || char === "'") && (index === from || /[\s:,[{-]/.test(text[index - 1] as string))) quote = char;
    else if (char === "#" && (index === from || /\s/.test(text[index - 1] as string))) {
      stop = index;
      break;
    }
  }
  while (stop > from && /\s/.test(text[stop - 1] as string)) stop--;
  return stop;
}

interface Scan {
  /** The offset and quote character of a quoted scalar that never closes. */
  openQuote?: { offset: number; char: string };
  /** Flow collections never closed, outermost first. */
  openers: { offset: number; char: string }[];
}

/** A tolerant pass over the text that finds the quote and the flow brackets nobody closed. */
function scan(text: string): Scan {
  const openers: Scan["openers"] = [];
  let quote: { offset: number; char: string } | undefined;
  let block: number | undefined;
  let atLineStart = true;
  let index = 0;
  const startsValue = (at: number): boolean => {
    let back = at - 1;
    while (back >= 0 && (text[back] === " " || text[back] === "\t")) back--;
    if (back < 0) return true;
    const previous = text[back] as string;
    if (previous === "\n" || previous === "\r" || previous === "," || previous === "[" || previous === "{") return true;
    if (previous === "-") return back === 0 || /\s/.test(text[back - 1] as string) || text[back - 1] === "\n";
    if (previous === ":") return at > back + 1 || at === back + 1;
    return false;
  };
  while (index < text.length) {
    const char = text[index] as string;
    if (quote) {
      if (quote.char === '"' && char === "\\") index += 2;
      else if (quote.char === "'" && char === "'" && text[index + 1] === "'") index += 2;
      else {
        if (char === quote.char) quote = undefined;
        index++;
      }
      continue;
    }
    if (char === "\n" || char === "\r") {
      index++;
      atLineStart = true;
      continue;
    }
    if (atLineStart) {
      atLineStart = false;
      const line = lineAt(text, index);
      const indent = /^[ ]*/.exec(text.slice(line.start, line.end))?.[0].length ?? 0;
      const blank = text.slice(line.start, line.end).trim() === "";
      if (block !== undefined) {
        if (blank || indent > block) {
          index = line.end;
          continue;
        }
        block = undefined;
      }
      const body = contentEnd(text, line.start, line.end);
      if (/(^|[:-]\s+|^\s*)[|>][+-]?\d?[+-]?$/.test(text.slice(line.start, body))) block = indent;
    }
    if (char === "#" && (index === 0 || /\s/.test(text[index - 1] as string))) {
      index = lineAt(text, index).end;
      continue;
    }
    if ((char === '"' || char === "'") && startsValue(index)) {
      quote = { offset: index, char };
      index++;
      continue;
    }
    if ((char === "[" || char === "{") && startsValue(index)) openers.push({ offset: index, char });
    else if ((char === "]" || char === "}") && openers.length) {
      const last = openers[openers.length - 1] as { char: string };
      if ((last.char === "[" && char === "]") || (last.char === "{" && char === "}")) openers.pop();
    }
    index++;
  }
  return { ...(quote ? { openQuote: quote } : {}), openers };
}

/** The indentation of the line that holds `offset`. */
const indentOf = (text: string, offset: number): number => {
  const line = lineAt(text, offset);
  return /^[ \t]*/.exec(text.slice(line.start, line.end))?.[0].length ?? 0;
};

/** The nearest earlier line with content (not blank, not a comment), or undefined. */
function previousContentLine(text: string, offset: number): { start: number; end: number } | undefined {
  let line = lineAt(text, offset);
  while (line.start > 0) {
    line = lineAt(text, line.start - 1);
    const body = text.slice(line.start, line.end).trim();
    if (body && !body.startsWith("#")) return line;
  }
  return undefined;
}

/** The column of the first key of a line (after any `- ` markers). */
function keyColumn(text: string, line: { start: number; end: number }): number {
  const raw = text.slice(line.start, line.end);
  const match = /^([ \t]*(?:-[ \t]+)*)/.exec(raw);
  return match?.[0].length ?? 0;
}

const fix = (id: string, title: string, edits: TextEdit[], extra: Partial<SyntaxFix> = {}): SyntaxFix => ({ id, title, safe: false, edits, ...extra });

// ---- the readings of single errors ------------------------------------------------------------------------------------------------

interface Reading {
  rule?: string;
  /** The finding's `help`, when it is not `next` as a sentence. */
  help?: string;
  code: YamlProblemCode;
  start: number;
  end: number;
  message: string;
  next: string;
  fixes?: SyntaxFix[];
  related?: { start: number; end: number }[];
}

function readTab(text: string, error: YAMLError): Reading {
  const line = lineAt(text, error.pos[0]);
  let end = line.start;
  while (end < line.end && (text[end] === " " || text[end] === "\t")) end++;
  const number = lineNumber(text, line.start);
  const tabLines: { start: number; end: number }[] = [];
  let cursor = 0;
  while (cursor <= text.length) {
    const current = lineAt(text, cursor);
    let stop = current.start;
    while (stop < current.end && (text[stop] === " " || text[stop] === "\t")) stop++;
    if (text.slice(current.start, stop).includes("\t") && text.slice(stop, current.end).trim() !== "") tabLines.push({ start: current.start, end: stop });
    if (current.end >= text.length) break;
    cursor = current.end + 1;
    if (text[current.end] === "\r" && text[current.end + 1] === "\n") cursor++;
  }
  const edit = (range: { start: number; end: number }): TextEdit => ({ offset: range.start, length: range.end - range.start, insert: text.slice(range.start, range.end).replaceAll("\t", "  ") });
  const fixes: SyntaxFix[] = [];
  const here = { start: line.start, end };
  if (tabLines.length > 1) {
    fixes.push(fix("tabs-to-spaces-line", "Convert tabs to spaces on this line", [edit(here)], { safe: true }));
    fixes.push(fix("tabs-to-spaces", "Convert tabs to spaces in the file", tabLines.map(edit), { safe: true }));
  } else fixes.push(fix("tabs-to-spaces", "Convert tabs to spaces", [edit(here)], { safe: true }));
  return { code: "tab-indent", start: line.start, end, message: `Line ${number} is indented with a tab. YAML needs spaces.`, next: "replace the tab with spaces (two for each level of indentation).", fixes };
}

function readQuote(text: string, error: YAMLError, scanned: Scan): Reading | undefined {
  const char = /'/.test(error.message.slice(0, 20)) ? "'" : '"';
  const open = scanned.openQuote && scanned.openQuote.char === char ? scanned.openQuote : scanned.openQuote;
  if (!open) return undefined;
  const line = lineAt(text, open.offset);
  const number = lineNumber(text, open.offset);
  const insertAt = line.end;
  let at = insertAt;
  while (at > open.offset && /\s/.test(text[at - 1] as string)) at--;
  return {
    code: "unclosed-quote",
    start: open.offset,
    end: Math.max(open.offset + 1, line.end),
    message: `The ${open.char === '"' ? "double " : "single "}quote opened on line ${number} is never closed.`,
    next: `end the text with a matching ${open.char} (a quoted value can continue on the next lines, but it must close).`,
    fixes: [fix("close-quote", "Insert closing quote", [{ offset: at, length: 0, insert: open.char }], { caret: at + 1 })],
  };
}

function readFlow(text: string, error: YAMLError, scanned: Scan): Reading | undefined {
  const wantsList = /Flow sequence/.test(error.message);
  const opener = [...scanned.openers].reverse().find((entry) => entry.char === (wantsList ? "[" : "{")) ?? scanned.openers[scanned.openers.length - 1];
  if (!opener) return undefined;
  const closer = opener.char === "[" ? "]" : "}";
  const line = lineAt(text, opener.offset);
  const number = lineNumber(text, opener.offset);
  // The closer goes after the last item: the end of the last content line before the place the parser gave up.
  let last = previousContentLine(text, error.pos[0]) ?? line;
  if (last.start < line.start) last = line;
  const at = contentEnd(text, last.start, last.end);
  return {
    code: opener.char === "[" ? "unclosed-list" : "unclosed-map",
    start: opener.offset,
    end: Math.max(opener.offset + 1, contentEnd(text, line.start, line.end)),
    message: `The ${opener.char === "[" ? "list" : "map"} that starts with ${code(opener.char)} on line ${number} is never closed.`,
    next: `add ${code(closer)} after the last ${opener.char === "[" ? "item" : "entry"}.`,
    fixes: [fix("insert-closer", `Insert ${closer}`, [{ offset: at, length: 0, insert: closer }], { caret: at + 1 })],
  };
}

function readImplicit(text: string, error: YAMLError): Reading {
  const line = lineAt(text, error.pos[0]);
  const body = text.slice(error.pos[0], line.end);
  const end = error.pos[0] + contentEnd(body, 0, body.length);
  const key = text.slice(error.pos[0], end).trim();
  if (key.startsWith("- ") || key === "-") {
    return {
      code: "list-item-under-value",
      start: error.pos[0],
      end: Math.max(end, error.pos[0] + 1),
      message: "This list item sits under a value that isn't a list.",
      next: "put the item under a key such as `items:`, or indent it under the key above.",
    };
  }
  return {
    code: "incomplete-key",
    start: error.pos[0],
    end: Math.max(end, error.pos[0] + 1),
    message: `${code(key.length > 40 ? `${key.slice(0, 39)}…` : key)} isn't a complete ${code("key: value")} line.`,
    next: "add a colon and a value, or remove the line.",
    fixes: [
      fix("add-colon", "Add a colon", [{ offset: end, length: 0, insert: ": " }], { caret: end + 2 }),
      fix("remove-line", "Remove the line", [{ offset: line.start, length: Math.min(text.length, nextLineStart(text, line.end)) - line.start, insert: "" }]),
    ],
  };
}

/** The offset where the line after the one that ends at `end` starts. */
function nextLineStart(text: string, end: number): number {
  if (text[end] === "\r" && text[end + 1] === "\n") return end + 2;
  return end < text.length ? end + 1 : end;
}

function readColonInValue(text: string, error: YAMLError): Reading {
  const line = lineAt(text, error.pos[0]);
  const end = contentEnd(text, error.pos[0], line.end);
  const value = text.slice(error.pos[0], end);
  return {
    code: "colon-in-value",
    start: error.pos[0],
    end: Math.max(end, error.pos[0] + 1),
    message: `A value can't contain ${code(": ")} unless it is quoted.`,
    next: "wrap the value in quotes.",
    fixes: [fix("quote-value", "Quote the value", [{ offset: error.pos[0], length: end - error.pos[0], insert: JSON.stringify(value) }])],
  };
}

function readAlignment(text: string, error: YAMLError, missingDash: boolean): Reading {
  const line = lineAt(text, error.pos[0]);
  const number = lineNumber(text, line.start);
  const indent = indentOf(text, line.start);
  const previous = previousContentLine(text, line.start);
  const fixes: SyntaxFix[] = [];
  const reindent = (id: string, title: string, column: number): void => {
    if (column === indent || column < 0) return;
    fixes.push(fix(id, title, [{ offset: line.start, length: indent, insert: " ".repeat(column) }]));
  };
  if (previous) {
    reindent("align-with-line-above", "Align with the line above", keyColumn(text, previous));
    // The key of the parent mapping, for a line that should have been outdented.
    let parent = previousContentLine(text, previous.start);
    while (parent && keyColumn(text, parent) >= keyColumn(text, previous)) parent = previousContentLine(text, parent.start);
    if (parent && !missingDash) reindent("align-with-parent", "Align with the parent key", keyColumn(text, parent));
  }
  const end = contentEnd(text, line.start, line.end);
  return {
    code: missingDash ? "missing-dash" : "misaligned",
    start: line.start,
    end: Math.max(end, line.start + 1),
    message: missingDash ? `Line ${number} does not line up with the list item above.` : `Line ${number} is indented differently from the keys above it.`,
    next: missingDash ? "align it with the item's first key, or start a new item with `- `." : "align it with the other keys of this mapping.",
    fixes: fixes.slice(0, 2),
  };
}

function readTrailing(text: string, error: YAMLError): Reading {
  const line = lineAt(text, error.pos[0]);
  const end = Math.max(error.pos[0] + 1, contentEnd(text, error.pos[0], line.end));
  const snippet = text.slice(error.pos[0], end);
  let from = error.pos[0];
  while (from > line.start && /[ \t]/.test(text[from - 1] as string)) from--;
  return {
    code: "trailing-text",
    start: error.pos[0],
    end,
    message: `Unexpected text ${code(snippet.length > 30 ? `${snippet.slice(0, 29)}…` : snippet)} after the value ends.`,
    next: "remove it, or put the whole value in quotes if it belongs to the value.",
    fixes: [fix("remove-text", "Remove the text", [{ offset: from, length: end - from, insert: "" }])],
  };
}

function readMissingColon(text: string, error: YAMLError): Reading {
  const line = lineAt(text, error.pos[0]);
  const end = contentEnd(text, line.start, line.end);
  const key = text.slice(line.start, end).trim();
  return {
    code: "missing-colon",
    start: Math.min(line.start + (text.slice(line.start, line.end).length - text.slice(line.start, line.end).trimStart().length), end),
    end: Math.max(end, line.start + 1),
    message: `${code(key.length > 40 ? `${key.slice(0, 39)}…` : key)} needs a colon and a value.`,
    next: `write ${code(`${key}: `)} and a value.`,
    fixes: [fix("add-colon", "Add a colon", [{ offset: end, length: 0, insert: ": " }], { caret: end + 2 })],
  };
}

function readEscape(text: string, error: YAMLError): Reading {
  const written = text.slice(error.pos[0], error.pos[0] + 2);
  return {
    code: "bad-escape",
    start: error.pos[0],
    end: Math.min(text.length, error.pos[0] + 2),
    message: `${code(written)} is not an escape YAML knows.`,
    next: "write a backslash as `\\\\` (the escapes are `\\n`, `\\t`, `\\\"`, `\\\\`, `\\/`, `\\xNN` and `\\uNNNN`), or use single quotes, where a backslash is just a backslash.",
    fixes: [fix("double-backslash", "Double the backslash", [{ offset: error.pos[0], length: 0, insert: "\\" }])],
  };
}

function readReservedStart(text: string, error: YAMLError): Reading {
  const line = lineAt(text, error.pos[0]);
  const end = contentEnd(text, error.pos[0], line.end);
  const value = text.slice(error.pos[0], end);
  return {
    code: "reserved-start",
    start: error.pos[0],
    end: Math.max(end, error.pos[0] + 1),
    message: `A plain value can't start with ${code(text[error.pos[0]] ?? "")}.`,
    next: "put the value in quotes.",
    fixes: [fix("quote-value", "Quote the value", [{ offset: error.pos[0], length: end - error.pos[0], insert: JSON.stringify(value) }])],
  };
}

/** The first occurrence of an equal key in the map that holds the repeat at `start`. */
function firstEqualKey(doc: Document.Parsed, start: number): { key: ParsedNode; pair: { key: unknown; value: unknown } } | undefined {
  let found: { key: ParsedNode; pair: { key: unknown; value: unknown } } | undefined;
  visit(doc, {
    Map(_key, map) {
      const items = (map as { items: { key: unknown; value: unknown }[] }).items;
      const at = items.findIndex((item) => isScalar(item.key) && (item.key as ParsedNode).range?.[0] === start);
      if (at < 0) return undefined;
      const repeat = items[at]?.key;
      const earlier = items.slice(0, at).find((item) => isScalar(item.key) && String((item.key as { value: unknown }).value) === String((repeat as { value: unknown }).value));
      if (earlier) found = { key: earlier.key as ParsedNode, pair: earlier };
      return visit.BREAK;
    },
  });
  return found;
}

/** The edit that removes the whole lines of the entry `key: value` that starts a line, or undefined for anything else (inline, flow, after `- `). */
function removeEntryEdit(text: string, key: ParsedNode, value: ParsedNode | null | undefined): TextEdit | undefined {
  const start = lineAt(text, key.range[0]).start;
  if (text.slice(start, key.range[0]).trim() !== "") return undefined;
  const finish = Math.max(key.range[1], value?.range ? Math.max(value.range[0], value.range[1] - 1) : key.range[1]);
  const lineEnd = lineAt(text, finish).end;
  return { offset: start, length: nextLineStart(text, lineEnd) - start, insert: "" };
}

function readDuplicate(text: string, error: YAMLError, doc: Document.Parsed): Reading {
  const start = error.pos[0];
  const lineOfRepeat = lineNumber(text, start);
  const earlier = firstEqualKey(doc, start);
  let repeatPair: { key: ParsedNode; value: ParsedNode | null } | undefined;
  visit(doc, {
    Pair(_key, pair) {
      const key = pair.key as ParsedNode | null;
      if (key?.range && key.range[0] === start) {
        repeatPair = { key, value: pair.value as ParsedNode | null };
        return visit.BREAK;
      }
      return undefined;
    },
  });
  const repeatKey = repeatPair?.key;
  const name = repeatKey ? text.slice(repeatKey.range[0], repeatKey.range[1]).trim() : String((earlier?.key as { value?: unknown } | undefined)?.value ?? "key");
  const firstLine = earlier ? lineNumber(text, earlier.key.range[0]) : undefined;
  const fixes: SyntaxFix[] = [];
  if (earlier) {
    const first = removeEntryEdit(text, earlier.key, (earlier.pair as { value: ParsedNode | null }).value);
    const second = repeatPair ? removeEntryEdit(text, repeatPair.key, repeatPair.value) : undefined;
    if (first) fixes.push(fix("remove-first", "Remove the first", [first]));
    if (second) fixes.push(fix("remove-second", "Remove the second", [second]));
  }
  return {
    rule: "duplicate-key",
    code: "duplicate-key",
    start,
    end: Math.max(start + 1, repeatKey ? repeatKey.range[1] : error.pos[1]),
    message: `${code(name)} appears twice at this level${firstLine ? ` (lines ${firstLine} and ${lineOfRepeat})` : ""}. The first value is ignored.`,
    next: "keep one of them, or rename the one you meant as another key.",
    fixes,
    ...(earlier ? { related: [{ start: earlier.key.range[0], end: Math.max(earlier.key.range[0] + 1, earlier.key.range[1]) }] } : {}),
  };
}

function readMultipleDocuments(text: string, error: YAMLError): Reading {
  const start = error.pos[0];
  const line = lineAt(text, start);
  const marker = /^---\s*$/.test(text.slice(line.start, line.end).trimEnd()) ? line : undefined;
  return {
    rule: "multiple-documents",
    code: "multiple-documents",
    start,
    end: Math.max(error.pos[1], start + 1),
    message: "The input holds more than one YAML document.",
    next: "remove the extra `---` separators, or put each deck in its own file.",
    help: "An OPF file is exactly one document: remove the extra --- separators, or put each deck in its own file.",
    fixes: marker ? [fix("remove-separator", "Remove the extra `---`", [{ offset: marker.start, length: nextLineStart(text, marker.end) - marker.start, insert: "" }])] : [],
  };
}

/** What the `yaml` library's text says when nothing above recognizes the error: its sentence, without the prefix noise. */
function readOther(error: YAMLError): Reading {
  const text = error.message.split("\n")[0] ?? error.message;
  return { code: "other", start: error.pos[0], end: Math.max(error.pos[0], error.pos[1]), message: `YAML: ${text}`, next: "fix the YAML at this position. An OPF file holds JSON-compatible YAML 1.2: mappings, lists and plain values." };
}

/** How `describeYamlError` writes one error of the `yaml` library. */
function readError(text: string, error: YAMLError, doc: Document.Parsed, scanned: Scan): Reading {
  const message = error.message;
  switch (error.code) {
    case "TAB_AS_INDENT":
      return readTab(text, error);
    case "DUPLICATE_KEY":
      return readDuplicate(text, error, doc);
    case "MULTIPLE_DOCS":
      return readMultipleDocuments(text, error);
    case "BAD_DQ_ESCAPE":
      return readEscape(text, error);
    case "BAD_SCALAR_START":
      return readReservedStart(text, error);
    case "KEY_OVER_1024_CHARS":
      return { code: "long-key", start: error.pos[0], end: Math.max(error.pos[0] + 1, Math.min(text.length, error.pos[0] + 60)), message: "This key is longer than 1024 characters.", next: "shorten the key, or check for a missing colon before the end of the line." };
    case "MULTILINE_IMPLICIT_KEY":
      return readImplicit(text, error);
    case "BLOCK_AS_IMPLICIT_KEY":
      return readColonInValue(text, error);
    case "UNEXPECTED_TOKEN":
      return readTrailing(text, error);
    case "MISSING_CHAR":
      if (/Missing closing/.test(message)) return readQuote(text, error, scanned) ?? readOther(error);
      if (/Sequence item without - indicator/.test(message)) return readAlignment(text, error, true);
      if (/Implicit map keys need to be followed/.test(message)) return readMissingColon(text, error);
      return readOther(error);
    case "BAD_INDENT":
      if (/Flow (sequence|map)/.test(message)) return readFlow(text, error, scanned) ?? readOther(error);
      if (/same column/.test(message)) return readAlignment(text, error, false);
      return readOther(error);
    default:
      return readOther(error);
  }
}

/** The errors that are damage from an earlier mistake, not a mistake of their own. */
const CASCADE = new Set(["UNEXPECTED_TOKEN", "MISSING_CHAR", "MULTILINE_IMPLICIT_KEY", "BAD_INDENT", "BLOCK_AS_IMPLICIT_KEY"]);

/**
 * The problems behind the errors of a parsed YAML document: one reading per root cause (an error that only follows the one before it on the same or
 * the next line is dropped), at most `limit`. `text` is the text that was parsed (without a byte-order mark).
 */
export function describeYamlErrors(text: string, doc: Document.Parsed, errors: readonly YAMLError[], limit = 5): YamlProblem[] {
  if (!errors.length) return [];
  const scanned = scan(text);
  const out: YamlProblem[] = [];
  let lastLine = -10;
  let lastCode = "";
  for (const error of errors) {
    const line = lineNumber(text, error.pos[0]);
    if (out.length && CASCADE.has(error.code) && CASCADE.has(lastCode) && line - lastLine <= 2 && error.code !== "DUPLICATE_KEY") continue;
    const reading = readError(text, error, doc, scanned);
    const next = reading.next;
    out.push({
      rule: reading.rule ?? "syntax",
      code: reading.code,
      start: reading.start,
      end: reading.end,
      message: reading.message,
      next,
      help: reading.help ?? sentence(next),
      fixes: reading.fixes ?? [],
      ...(reading.related ? { related: reading.related } : {}),
    });
    lastLine = line;
    lastCode = error.code;
    if (out.length >= limit) break;
  }
  return out;
}

// ---- the public analyzer ------------------------------------------------------------------------------------------------------------

/** What `analyzeYamlSyntax` returns: a problem with its reader rule, a located range and the text edits that repair it. */
export interface YamlSyntaxProblem {
  /** The finding id the YAML reader reports it under: `yaml/syntax`, `yaml/duplicate-key`, `yaml/empty`, ... */
  ruleId: string;
  code: YamlProblemCode;
  severity: "error";
  range: TextRange;
  message: string;
  /** What to do, starting in lower case. */
  next: string;
  fixes: SyntaxFix[];
  /** Other places that belong to the problem. */
  related?: TextRange[];
}

export interface AnalyzeYamlOptions {
  /** The most problems returned (default 5). */
  limit?: number;
  /** `"any"` accepts a list or a plain value at the top (the YAML of a Markdown fence is checked by its own rules). Default `"mapping"`. */
  rootKind?: "mapping" | "any";
}

const SLIDE_KEYS = new Set(["title", "subtitle", "items", "text", "layout", "blocks", "image", "chart", "table", "quote", "code", "metric", "timeline", "notes"]);

/**
 * The syntax problems of a YAML text, one per root cause, in position order: the `yaml` library's errors in plain words (a tab for indentation, a quote
 * or bracket never closed, a line that is not `key: value`, a repeated key), an empty text, and a top level that is not a mapping, each with the edits
 * that repair it. Empty for text the reader accepts as YAML (the OPF schema is another check). The offsets are the ones of `text`.
 */
export function analyzeYamlSyntax(text: string, options: AnalyzeYamlOptions = {}): YamlSyntaxProblem[] {
  const bom = text.startsWith("﻿") ? 1 : 0;
  const body = text.slice(bom);
  const locate = createLocator(text);
  const range = (start: number, end: number): TextRange => locate(start + bom, Math.max(0, end - start));
  const shift = (edit: TextEdit): TextEdit => ({ ...edit, offset: edit.offset + bom });
  const doc = parseDocument(body, { schema: "core", uniqueKeys: true, merge: false, prettyErrors: false });
  const wrap = (problem: YamlProblem): YamlSyntaxProblem => ({
    ruleId: `yaml/${problem.rule}`,
    code: problem.code,
    severity: "error",
    range: range(problem.start, problem.end),
    message: problem.message,
    next: problem.next,
    fixes: problem.fixes.map((entry) => ({ ...entry, edits: entry.edits.map(shift), ...(entry.caret !== undefined ? { caret: entry.caret + bom } : {}) })),
    ...(problem.related ? { related: problem.related.map((entry) => range(entry.start, entry.end)) } : {}),
  });
  if (doc.errors.length) return describeYamlErrors(body, doc, doc.errors, options.limit ?? 5).map(wrap);
  const root = doc.contents as ParsedNode | null;
  if (root === null || !root.range) {
    const hasText = body.length > 0;
    const prefix = hasText && !/\n$/.test(body) ? "\n" : "";
    return [
      wrap({
        rule: "empty",
        code: "empty-document",
        start: 0,
        end: Math.min(1, body.length),
        message: "The document is empty (or everything in it is a comment).",
        next: "write `slides:` and at least one `- title:` line.",
        help: "Write `slides:` and at least one `- title:` line.",
        fixes: [fix("insert-minimal-deck", "Insert minimal deck", [{ offset: body.length, length: 0, insert: `${prefix}slides:\n  - title: Title\n` }], { safe: true })],
      }),
    ];
  }
  if ((options.rootKind ?? "mapping") === "mapping" && !isMap(root)) {
    const list = isSeq(root);
    const slideLike = list && (root.items as unknown[]).length > 0 && (root.items as unknown[]).every((item) => isMap(item) && (item.items as { key: unknown }[]).some((pair) => isScalar(pair.key) && SLIDE_KEYS.has(String(pair.key.value))));
    const fixes: SyntaxFix[] = [];
    if (slideLike) {
      const first = lineAt(body, root.range[0]).start;
      const edits: TextEdit[] = [{ offset: first, length: 0, insert: "slides:\n" }];
      for (let cursor = first; cursor < body.length; ) {
        const line = lineAt(body, cursor);
        if (body.slice(line.start, line.end).trim() !== "") edits.push({ offset: line.start, length: 0, insert: "  " });
        const following = nextLineStart(body, line.end);
        if (following <= cursor) break;
        cursor = following;
      }
      fixes.push(fix("wrap-in-slides", "Wrap as `slides:`", edits));
    }
    return [
      wrap({
        rule: "not-mapping",
        code: "not-a-mapping",
        start: root.range[0],
        end: Math.max(root.range[0] + 1, root.range[1]),
        message: `The top level must be ${code("key: value")} lines, but this is ${list ? "a list" : "plain text"}.`,
        next: slideLike ? "put the list under `slides:`." : "start with `name:` and `slides:` lines.",
        help: slideLike ? "Put the list under `slides:`." : "Start with `name:` and `slides:` lines.",
        fixes,
      }),
    ];
  }
  return [];
}
