// Where a finding is in the text (artifacts/source-editor/VALIDATOR-HINTS.md, section 4, rule 4): the smallest thing the message is about. A JSON
// Pointer becomes a range of the key, the value, the whole entry or the opening bracket of the container. Ranges are original-source offsets.
import { locate } from "@openpresentation/opf/source";

/** One-based line and column of a source offset (a CRLF pair is one line break). */
export function lineColumn(text, offset) {
  let line = 1, start = 0;
  const end = Math.min(offset, text.length);
  for (let i = 0; i < end; i++) {
    const code = text.charCodeAt(i);
    if (code === 10 || (code === 13 && text.charCodeAt(i + 1) !== 10)) { line++; start = i + 1; }
  }
  return { line, column: offset - start + 1 };
}

/**
 * The range of `segments` in the JSON `text`, or null (core's `locate`, which reads text that does not parse). `part`: "value" (default), "key" (the
 * property name), "entry" (key to the end of the value), "colon" (the key and its colon) or "open" (the first character of the value, the `{` of an
 * object). A path that is not there gives the range of its nearest container, with `exact: false`.
 */
export function locateJson(text, segments, part = "value") {
  const range = locate(text, "json", segments.map(String), { part });
  return range ? { from: range.offset, to: range.offset + range.length, exact: range.exact !== false } : null;
}

/** The part of the text a finding is about, by what it says (VALIDATOR-HINTS section 4). */
export function partOf(finding) {
  const keyword = finding.validation?.keyword;
  if (keyword === "additionalProperties" || finding.ruleId === "opf/duplicate-key") return "key";
  if (keyword === "required") return "open";
  return "value";
}
