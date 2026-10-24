// Quick fixes for the findings of the source pane (artifacts/source-editor/VALIDATOR-HINTS.md, section 12): the text edits behind "Change to center",
// "Rename to slides", "Remove property", "Add `slides`" and the like, for a JSON text that parses. Pure functions over the source text:
// each returns `{ id, title, safe, edits: [{ from, to, insert }], caret? }`, source offsets in, so the editor applies it as one undoable change.
import { findNodeAtLocation, modify, parseTree } from "jsonc-parser";
import { replacementValues, segmentsOf } from "./source-messages.js";

const toPath = (segments) => segments.map((segment) => (/^\d+$/.test(segment) ? Number(segment) : segment));

/** jsonc-parser's edits as `{ from, to, insert }`. */
const asEdits = (edits) => edits.map((edit) => ({ from: edit.offset, to: edit.offset + edit.length, insert: edit.content }));

function formatting(unit, text) {
  return { insertSpaces: unit !== "\t", tabSize: unit === "\t" ? 4 : unit.length, eol: /\r\n/.test(text) ? "\r\n" : "\n" };
}
/** The text after `edits` (source offsets, not overlapping; edits at one offset keep their order). */
export function applySourceEdits(text, edits) {
  const ordered = edits.map((edit, index) => ({ edit, index })).sort((a, b) => a.edit.from - b.edit.from || a.index - b.index);
  let next = text;
  for (const { edit } of ordered.reverse()) next = next.slice(0, edit.from) + edit.insert + next.slice(edit.to);
  return next;
}

/** The node at `segments`: `{ node, parent }` or null. */
function nodeAt(text, segments) {
  const root = parseTree(text, [], { allowTrailingComma: true });
  if (!root) return null;
  const node = findNodeAtLocation(root, toPath(segments));
  return node ? { root, node } : null;
}
/** The property node (`"key": value`) whose value sits at `segments`, and its key node. */
function propertyAt(text, segments) {
  const found = nodeAt(text, segments);
  const property = found?.node.parent;
  if (!property || property.type !== "property") return null;
  return { property, key: property.children[0], value: property.children[1] };
}

/** Replace the value at `segments` with `value` (any JSON value). */
export function changeValue(text, segments, value) {
  const found = nodeAt(text, segments);
  if (!found) return null;
  return [{ from: found.node.offset, to: found.node.offset + found.node.length, insert: JSON.stringify(value) }];
}
/** Rename the property whose value is at `segments`. */
export function renameKey(text, segments, name) {
  const found = propertyAt(text, segments);
  if (!found) return null;
  return [{ from: found.key.offset, to: found.key.offset + found.key.length, insert: JSON.stringify(name) }];
}
/** Remove the property (or list item) at `segments`, with the comma that belonged to it. */
export function removeAt(text, segments, unit = "  ") {
  const edits = modify(text, toPath(segments), undefined, { formattingOptions: formatting(unit, text) });
  return edits.length ? asEdits(edits) : null;
}
/** Add `key: value` to the object at `segments`, after its last property. */
export function addProperty(text, segments, key, value, unit = "  ") {
  const edits = modify(text, [...toPath(segments), key], value, { formattingOptions: formatting(unit, text) });
  return edits.length ? asEdits(edits) : null;
}
/** Add `value` at the end of the list at `segments`. */
export function addItem(text, segments, value, unit = "  ") {
  const found = nodeAt(text, segments);
  const length = found?.node.type === "array" ? (found.node.children?.length ?? 0) : 0;
  const edits = modify(text, [...toPath(segments), length], value, { formattingOptions: formatting(unit, text), isArrayInsertion: true });
  return edits.length ? asEdits(edits) : null;
}
/** Wrap the value at `segments` in a one-item list. */
export function wrapInList(text, segments) {
  const found = nodeAt(text, segments);
  if (!found) return null;
  const { offset, length } = found.node;
  return [{ from: offset, to: offset, insert: "[" }, { from: offset + length, to: offset + length, insert: "]" }];
}

/**
 * The quick fixes of a schema or reference finding in a JSON text that parses. `context` is the one source-messages.js takes plus
 * `{ unit, starter(segments, property) }` (the value `Add` inserts).
 */
export function fixesForFinding(finding, text, context = {}) {
  if (!finding.path && finding.validation?.keyword !== "required") return [];
  const segments = segmentsOf(finding.path);
  const keyword = finding.validation?.keyword;
  const unit = context.unit ?? "  ";
  const fixes = [];
  const push = (id, title, edits, extra = {}) => { if (edits?.length) fixes.push({ id, title, edits, safe: false, ...extra }); };
  if (keyword === "enum" || finding.ruleId === "opf/unresolved-reference") {
    for (const value of replacementValues(finding, context)) push(`change-to:${value}`, `Change to ${value}`, changeValue(text, segments, value));
  } else if (keyword === "additionalProperties") {
    const name = finding.validation.params?.additionalProperty ?? segments.at(-1);
    for (const value of replacementValues(finding, context)) push(`rename-to:${value}`, `Rename to ${value}`, renameKey(text, segments, value));
    push("remove-property", "Remove property", removeAt(text, segments, unit));
    void name;
  } else if (keyword === "required") {
    const property = finding.validation.params?.missingProperty;
    const starter = context.starter?.(segments, property);
    if (property && starter !== undefined) push(`add:${property}`, `Add \`${property}\``, addProperty(text, segments, property, starter, unit));
  } else if (keyword === "type" && finding.validation.params?.type === "array") {
    push("wrap-in-list", "Wrap in a list", wrapInList(text, segments));
  } else if (keyword === "minItems" && finding.path === "/slides") {
    push("add-slide", "Add a slide", addItem(text, segments, { title: "Slide title" }, unit));
  } else if (finding.ruleId === "opf/duplicate-key") {
    // The pane marks the second key; removing either one leaves the other.
    push("remove-duplicate", "Remove the second", removeAt(text, segments, unit));
  }
  return fixes;
}
