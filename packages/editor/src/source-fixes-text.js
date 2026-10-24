// Quick fixes for the findings of a YAML or Markdown source (artifacts/source-editor/VALIDATOR-HINTS.md, section 12): "Change to center", "Rename to
// slides", "Remove property", "Add `id`". The same fixes source-fixes.js writes for JSON, as text edits found with core's `locate`, so each one is a
// change of the text itself (one undoable change) that keeps the author's comments and layout. Pure functions: `{ id, title, safe, edits: [{ from, to, insert }] }`.
import { Document } from "yaml";
import { SLIDE_OPTION_KEYS } from "@openpresentation/opf/source";
import { replacementValues, segmentsOf } from "./source-messages.js";
import { locateText } from "./source-ranges.js";

const yamlScalar = (value) => {
  if (typeof value !== "string") return String(value);
  try { return new Document(value).toString({ lineWidth: 0 }).trimEnd() || '""'; } catch { return JSON.stringify(value); }
};
const yamlKey = (key) => (/^[A-Za-z_$][A-Za-z0-9_.$+-]*(?::[A-Za-z0-9_.$+-]+)*$/.test(key) ? key : yamlScalar(key));
const BARE = /^[A-Za-z0-9_-]+$/;

/** Whether `segments` is an option of a slide's options comment in Markdown (`/slides/0/layout`), whose value is written as `key=value`. */
const isSlideOption = (format, segments) => format === "md" && segments[0] === "slides" && segments.length === 3 && SLIDE_OPTION_KEYS.includes(segments[2]);

/** How `value` is written in place of the token `old`: in the quoting style the author used. */
function written(format, segments, old, value) {
  if (isSlideOption(format, segments)) return typeof value === "string" && BARE.test(value) ? value : JSON.stringify(value);
  if (old.startsWith('"')) return JSON.stringify(value);
  if (old.startsWith("'")) return `'${String(value).replaceAll("'", "''")}'`;
  return yamlScalar(value);
}

// Only YAML written as block text (and the front matter and fences of Markdown, which are block YAML) can have a whole entry removed or added by lines.
const lineStart = (text, offset) => text.lastIndexOf("\n", offset - 1) + 1;
const lineEnd = (text, offset) => { const at = text.indexOf("\n", offset); return at < 0 ? text.length : at; };

/** Remove the entry at `segments` (its lines), when it starts its line and is not the first key after a list dash. */
function removeEntry(format, text, segments) {
  const entry = locateText(format, text, segments, "entry");
  if (!entry?.exact) return null;
  const start = lineStart(text, entry.from);
  if (text.slice(start, entry.from).trim() !== "") return null;
  const end = lineEnd(text, Math.max(entry.from, entry.to - 1));
  return [{ from: start, to: Math.min(text.length, end + 1), insert: "" }];
}

/** Add `key: value` to the mapping at `segments`, after its last line, indented like its first key. */
function addProperty(format, text, segments, key, value) {
  const parent = segments.length ? locateText(format, text, segments, "value") : null;
  const first = parent?.exact ? locateText(format, text, segments, "open") : null;
  let column = 0;
  let at = text.length;
  if (parent?.exact && first) {
    if (/^[[{]/.test(text.slice(parent.from, parent.from + 1))) return null;
    column = first.from - lineStart(text, first.from);
    at = lineEnd(text, Math.max(parent.from, parent.to - 1));
  } else if (segments.length) return null;
  else if (text.trim() !== "") {
    const root = locateText(format, text, [], "value");
    if (!root) return null;
    at = lineEnd(text, Math.max(root.from, root.to - 1));
  }
  const body = new Document({ [key]: value }).toString({ indent: 2, lineWidth: 0 }).trimEnd().split("\n").map((line) => `${" ".repeat(column)}${line}`).join("\n");
  return [{ from: at, to: at, insert: text.trim() === "" ? `${body}\n` : `\n${body}` }];
}

/**
 * The quick fixes of a schema or reference finding in a YAML or Markdown text. `context` is the one source-messages.js takes plus `{ starter(segments,
 * property) }` (the value `Add` inserts). Returns `[]` for what the text cannot express as a plain edit.
 */
export function textFixesForFinding(format, finding, text, context = {}) {
  if (!finding.path && finding.validation?.keyword !== "required") return [];
  const segments = segmentsOf(finding.path);
  const keyword = finding.validation?.keyword;
  const fixes = [];
  const push = (id, title, edits) => { if (edits?.length) fixes.push({ id, title, edits, safe: false }); };
  if (keyword === "enum" || finding.ruleId === "opf/unresolved-reference") {
    const where = locateText(format, text, segments, "value");
    if (!where?.exact) return [];
    const old = text.slice(where.from, where.to);
    for (const value of replacementValues(finding, context)) push(`change-to:${value}`, `Change to ${value}`, [{ from: where.from, to: where.to, insert: written(format, segments, old, value) }]);
  } else if (keyword === "additionalProperties" && !isSlideOption(format, segments)) {
    const key = locateText(format, text, segments, "key");
    if (key?.exact) for (const value of replacementValues(finding, context)) push(`rename-to:${value}`, `Rename to ${value}`, [{ from: key.from, to: key.to, insert: yamlKey(value) }]);
    push("remove-property", "Remove property", removeEntry(format, text, segments));
  } else if (keyword === "required") {
    const property = finding.validation.params?.missingProperty;
    const starter = property ? context.starter?.(segments, property) : undefined;
    // In Markdown only the front matter is a mapping this can add to; a slide's fields are written as Markdown.
    if (property && starter !== undefined && (format === "yaml" || segments[0] !== "slides")) push(`add:${property}`, `Add \`${property}\``, addProperty(format, text, segments, property, starter));
  }
  return fixes;
}
