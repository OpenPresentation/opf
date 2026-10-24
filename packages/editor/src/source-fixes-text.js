// Quick fixes for the findings of a YAML or Markdown source (artifacts/source-editor/VALIDATOR-HINTS.md, section 12): "Change to center", "Rename to
// slides", "Remove property", "Add `id`". The same fixes source-fixes.js writes for JSON, as text edits found with core's `locate`, so each one is a
// change of the text itself (one undoable change) that keeps the author's comments and layout. Pure functions: `{ id, title, safe, edits: [{ from, to, insert }] }`.
import { Document } from "yaml";
import { SLIDE_OPTION_KEYS, scanMarkdown } from "@openpresentation/opf/source";
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

/** Replace the value at `segments` by `make(old)`, when the text has it exactly. */
function replaceValue(format, text, segments, make) {
  const where = locateText(format, text, segments, "value");
  if (!where?.exact || where.from === where.to) return null;
  const insert = make(text.slice(where.from, where.to));
  return insert === null ? null : [{ from: where.from, to: where.to, insert }];
}

/** A scalar as the one item of a flow list: quotes stay, a plain scalar that flow syntax would misread is quoted. */
function inList(old, value) {
  if (/^[|>&*!%@`]/.test(old) || /^[[{]/.test(old)) return null;
  if (old.startsWith('"') || old.startsWith("'")) return `[${old}]`;
  return /[,[\]{}#:]/.test(old) || typeof value !== "string" ? `[${JSON.stringify(value)}]` : `[${old}]`;
}

/** `slides: []` (or `slides:` with nothing) becomes a block list with one slide. */
function addSlide(format, text) {
  if (format !== "yaml") return null;
  const key = locateText(format, text, ["slides"], "colon");
  const value = locateText(format, text, ["slides"], "value");
  if (!key?.exact) return null;
  const empty = !value?.exact || text.slice(value.from, value.to).trim() === "" || /^\[\s*\]$/.test(text.slice(value.from, value.to));
  if (!empty) return null;
  const indent = " ".repeat(key.from - lineStart(text, key.from));
  const end = value?.exact ? Math.max(value.to, key.to) : key.to;
  return [{ from: key.to, to: end, insert: `\n${indent}  - title: Slide title` }];
}

/** The indentation of the first key of the block mapping at `segments` ("" for none), and where its last line ends. */
function blockMapping(format, text, segments) {
  // The root of a Markdown deck is its front matter, which ends where the closing `---` line starts.
  if (format === "md" && segments.length === 0) {
    const matter = scanMarkdown(text).frontMatter;
    return matter?.closed ? { column: 0, end: matter.yamlTo } : null;
  }
  const value = segments.length ? locateText(format, text, segments, "value") : locateText(format, text, [], "value");
  const open = locateText(format, text, segments, "open");
  if (!value?.exact || !open?.exact || /^[[{]/.test(text[value.from] ?? "")) return null;
  return { column: open.from - lineStart(text, open.from), end: nextLine(text, Math.max(value.from, value.to - 1)) };
}
const nextLine = (text, offset) => { const end = lineEnd(text, offset); return end < text.length ? end + 1 : end; };

/** Move the entry at `segments` into the `extensions` mapping of its parent, creating it at the end of the parent when there is none. */
function moveIntoExtensions(format, text, segments) {
  if (segments.length === 0 || (format === "md" && segments[0] === "slides")) return null;
  const entry = locateText(format, text, segments, "entry");
  if (!entry?.exact) return null;
  const start = lineStart(text, entry.from);
  if (text.slice(start, entry.from).trim() !== "") return null;
  const end = nextLine(text, Math.max(entry.from, entry.to - 1));
  const parent = segments.slice(0, -1);
  const base = entry.from - start;
  const reindent = (column) => text.slice(start, end).replace(/\n$/, "").split("\n").map((line) => `${" ".repeat(column)}${line.slice(Math.min(base, line.length - line.trimStart().length))}`).join("\n");
  const owner = blockMapping(format, text, parent);
  if (!owner) return null;
  const existing = blockMapping(format, text, [...parent, "extensions"]);
  const prefix = (at) => (at === text.length && !text.endsWith("\n") ? "\n" : "");
  const edits = [{ from: start, to: end, insert: "" }];
  if (existing) edits.push({ from: existing.end, to: existing.end, insert: `${prefix(existing.end)}${reindent(existing.column)}\n` });
  else if (locateText(format, text, [...parent, "extensions"], "key")?.exact) return null;
  else edits.push({ from: owner.end, to: owner.end, insert: `${prefix(owner.end)}${" ".repeat(owner.column)}extensions:\n${reindent(owner.column + 2)}\n` });
  return edits;
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
    if (segments.at(-1) !== "extensions" && context.keysOf?.(segments.slice(0, -1))?.includes("extensions")) push("move-to-extensions", "Move into extensions", moveIntoExtensions(format, text, segments));
    push("remove-property", "Remove property", removeEntry(format, text, segments));
  } else if (keyword === "type" && finding.validation.params?.type === "array") {
    const value = context.valueAt?.(segments);
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") push("wrap-in-list", "Wrap in a list", replaceValue(format, text, segments, (old) => inList(old, value)));
  } else if ((keyword === "type" && finding.validation.params?.type === "string") || ((keyword === "oneOf" || keyword === "anyOf") && (finding.validation.alternatives ?? []).some((entry) => String(entry).startsWith("string")))) {
    const value = context.valueAt?.(segments);
    if (typeof value === "number" || typeof value === "boolean") fixes.push({ id: "convert-to-string", title: "Convert to string", safe: true, edits: replaceValue(format, text, segments, () => JSON.stringify(String(value))) ?? [] });
  } else if (keyword === "minItems" && finding.path === "/slides") {
    push("add-slide", "Add a slide", addSlide(format, text));
  } else if (keyword === "required") {
    const property = finding.validation.params?.missingProperty;
    const starter = property ? context.starter?.(segments, property) : undefined;
    // In Markdown only the front matter is a mapping this can add to; a slide's fields are written as Markdown.
    if (property && starter !== undefined && (format === "yaml" || segments[0] !== "slides")) push(`add:${property}`, `Add \`${property}\``, addProperty(format, text, segments, property, starter));
  }
  return fixes.filter((fix) => fix.edits.length);
}
