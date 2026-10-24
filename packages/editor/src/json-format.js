import { applyEdits, format } from "jsonc-parser";
import { preferredLineEnding } from "./text-input.js";

/**
 * The indentation unit of a JSON text: a tab when an indented line starts with one, else the smallest indentation found (at most 8
 * spaces); null when no line is indented.
 */
export function detectIndent(source) {
  const spaces = source.match(/^[\t ]+(?=\S)/gm) ?? [];
  if (!spaces.length) return null;
  return spaces.some((value) => value.includes("\t")) ? "\t" : " ".repeat(Math.min(8, ...spaces.map((value) => value.length)));
}

/**
 * The whitespace edits that lay JSON text out with `unit` (a tab or spaces) as the indentation (`{ offset, length, content }`, offsets in
 * `source`): whitespace only, so values and numeric lexemes stay as written, the first line ending is kept and a final newline stays if there
 * is one. jsonc-parser formats tokens, so a draft that does not parse is laid out too.
 */
export function jsonFormatEdits(source, unit = "  ") {
  return format(source, undefined, {
    insertSpaces: unit !== "\t",
    tabSize: unit === "\t" ? 4 : unit.length,
    eol: preferredLineEnding(source),
    insertFinalNewline: /[\r\n]\s*$/.test(source),
  });
}

/** `source` laid out by `jsonFormatEdits`. */
export const formatJsonSource = (source, unit = "  ") => applyEdits(source, jsonFormatEdits(source, unit));

const isSpace = (char) => char === " " || char === "\t" || char === "\n" || char === "\r";
/**
 * The edits (`{ from, to, insert }`, offsets in `source`) that turn `source` into `formatted` when the two differ in whitespace only, one per run
 * of whitespace that changed, so a cursor between two tokens stays between them. Null when something other than whitespace differs.
 */
export function whitespaceEdits(source, formatted) {
  const edits = [];
  let i = 0, j = 0;
  while (i < source.length || j < formatted.length) {
    if (isSpace(source[i]) || isSpace(formatted[j])) {
      let endSource = i, endFormatted = j;
      while (isSpace(source[endSource])) endSource++;
      while (isSpace(formatted[endFormatted])) endFormatted++;
      const before = source.slice(i, endSource), after = formatted.slice(j, endFormatted);
      if (before !== after) edits.push({ from: i, to: endSource, insert: after });
      i = endSource;
      j = endFormatted;
    } else if (source[i] === formatted[j] && i < source.length) {
      i++;
      j++;
    } else return null;
  }
  return edits;
}
