// The syntax problems of a JSON text, as findings (artifacts/source-editor/VALIDATOR-HINTS.md, sections 5 and 6): one per cause, each with the range
// the squiggle covers, a plain-words message, what could come next and the quick fixes. Duplicate keys are found here too.
import { parse as parseJsonc, parseTree, printParseErrorCode } from "jsonc-parser";
import { analyzeJsonSyntax } from "@openpresentation/opf/source";
import { normalizeFinding } from "./source-findings.js";
import { lineColumn } from "./source-ranges.js";

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const ERRORS = { InvalidSymbol: "Invalid symbol", InvalidNumberFormat: "Invalid number", PropertyNameExpected: "Property name expected", ValueExpected: "Value expected", ColonExpected: "Colon expected", CommaExpected: "Comma expected", CloseBraceExpected: "Closing brace expected", CloseBracketExpected: "Closing bracket expected", EndOfFileExpected: "End of file expected", InvalidCommentToken: "Comments are not allowed in JSON", UnexpectedEndOfComment: "Unexpected end of comment", UnexpectedEndOfString: "Unexpected end of string", UnexpectedEndOfNumber: "Unexpected end of number", InvalidUnicode: "Invalid unicode escape", InvalidEscapeCharacter: "Invalid escape character", InvalidCharacter: "Invalid character" };

/**
 * The syntax problems of `text` (empty when it is a JSON object): one finding per root cause, `{ ruleId, message, next, range: { from, to },
 * line, column, editFixes }`, by core's recovery analyzer (`@openpresentation/opf/source`).
 */
export function analyzeSyntax(text) {
  // A valid object is the common case on every keystroke: the engine's parser answers that at once.
  try { if (isObject(JSON.parse(text))) return []; } catch { /* Analyze. */ }
  const found = analyzeJsonSyntax(text).map((problem) => ({
    ruleId: "opf/json-syntax",
    message: problem.message,
    next: problem.next,
    range: { from: problem.range.offset, to: problem.range.offset + problem.range.length },
    line: problem.range.line,
    column: problem.range.column,
    ...(problem.path ? { problemPath: problem.path } : {}),
    editFixes: problem.fixes.map((fix) => ({
      id: fix.id, title: fix.title, safe: fix.safe,
      edits: fix.edits.map((edit) => ({ from: edit.offset, to: edit.offset + edit.length, insert: edit.insert })),
      ...(fix.caret !== undefined ? { caret: fix.caret } : {}),
      ...(fix.action ? { action: fix.action, format: fix.format } : {}),
    })),
  }));
  if (found.length) return found;
  const errors = [];
  parseJsonc(text, errors, { allowTrailingComma: false, disallowComments: true });
  if (!errors.length) return [];
  const first = errors[0];
  return [{ ruleId: "opf/json-syntax", message: `${ERRORS[printParseErrorCode(first.error)] ?? printParseErrorCode(first.error)}.`, range: { from: first.offset, to: first.offset + Math.max(1, first.length) }, line: lineColumn(text, first.offset).line }];
}

/** The edit that removes property `property` of `object`: it and the comma that joined it to its neighbor. */
function removeProperty(object, property) {
  const list = object.children ?? [], at = list.indexOf(property);
  if (at < list.length - 1) return [{ from: property.offset, to: list[at + 1].offset, insert: "" }];
  if (at > 0) { const before = list[at - 1]; return [{ from: before.offset + before.length, to: property.offset + property.length, insert: "" }]; }
  return [{ from: property.offset, to: property.offset + property.length, insert: "" }];
}

/** Every duplicate object key of a JSON text that parses, as findings that mark the later occurrence (`related` is the earlier one). */
export function findDuplicateKeys(text) {
  const root = parseTree(text);
  const out = [];
  const walk = (node, path) => {
    if (node.type === "object") {
      const seen = new Map();
      for (const property of node.children ?? []) {
        const key = property.children?.[0];
        if (!key) continue;
        if (seen.has(key.value)) {
          const first = seen.get(key.value);
          const firstKey = first.children[0];
          out.push(normalizeFinding({
            path: `/${[...path, key.value].map((part) => String(part).replaceAll("~", "~0").replaceAll("/", "~1")).join("/")}`,
            message: `Duplicate key "${key.value}". Remove the repeated key.`,
            ruleId: "opf/duplicate-key",
            range: { from: key.offset, to: key.offset + key.length },
            related: [{ from: firstKey.offset, to: firstKey.offset + firstKey.length }],
            editFixes: [
              { id: "remove-first", title: "Remove the first", edits: removeProperty(node, first) },
              { id: "remove-second", title: "Remove the second", edits: removeProperty(node, property) },
            ],
            line: lineColumn(text, key.offset).line,
          }, "syntax"));
        } else seen.set(key.value, property);
        if (property.children?.[1]) walk(property.children[1], [...path, key.value]);
      }
    } else if (node.type === "array") (node.children ?? []).forEach((child, index) => walk(child, [...path, index]));
  };
  if (root) walk(root, []);
  return out;
}
