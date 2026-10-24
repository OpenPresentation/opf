// The JSON text adapter of the source editor (artifacts/source-editor/SPEC.md, section 3.1): what a position in a JSON draft means. Everything the
// completion list, the hover and the hints know about the caret comes from `contextAt`: the token being typed, whether it sits where a key, a value
// or a list item belongs, the path of the node in the document, the keys already there, and what the text around needs when something is inserted
// (a colon, a comma). It reads drafts that do not parse: the token under the caret is swapped for a placeholder string and the rest is read with
// the tolerant parser.
import { findNodeAtOffset, getNodePath, getNodeValue, parseTree } from "jsonc-parser";

const PLACEHOLDER = "__opf_completion__";
const WORD = /[A-Za-z0-9_.-]/;

/**
 * The token being typed at `position`: inside a string (a quote opened earlier on this line), or a bare word, or nothing yet where a value or key
 * would go. JSON strings never span lines. Returns `{ quoted, closed, start, end, from, to }` (`start..end` is the whole token with its quotes,
 * `from..to` the text between them), or null when no token can be completed here. `explicit` (Ctrl+Space) also takes the empty place after `{`,
 * `,`, `:` and `[`, the string just closed, and a blank document; typing `:` or the space after it takes the empty place after the colon.
 */
export function tokenAt(text, position, explicit) {
  const lineStart = Math.max(text.lastIndexOf("\n", position - 1), text.lastIndexOf("\r", position - 1)) + 1;
  let open = -1, last = null;
  for (let index = lineStart; index < position; index++) {
    if (open >= 0) { if (text[index] === "\\") index++; else if (text[index] === '"') { last = { start: open, end: index }; open = -1; } }
    else if (text[index] === '"') open = index;
  }
  // Asked for explicitly (Ctrl+Space) right after a closing quote: the string just ended is the token, as in VS Code.
  if (open < 0 && explicit && last?.end === position - 1) return { quoted: true, closed: true, start: last.start, end: position, from: last.start + 1, to: position - 1 };
  if (open >= 0) {
    let close = -1;
    for (let index = position; index < text.length && text[index] !== "\n" && text[index] !== "\r"; index++) {
      if (text[index] === "\\") index++;
      else if (text[index] === '"') { close = index; break; }
    }
    return { quoted: true, closed: close >= 0, start: open, end: close >= 0 ? close + 1 : position, from: open + 1, to: close >= 0 ? close : position };
  }
  let start = position, end = position;
  while (start > lineStart && WORD.test(text[start - 1])) start--;
  while (end < text.length && WORD.test(text[end])) end++;
  if (start === position && !explicit && !/:[ \t]?$/.test(text.slice(lineStart, position))) return null;
  let before = start - 1;
  while (before >= lineStart && /\s/.test(text[before])) before--;
  // A bare word starts a key or a value only after `{`, `,`, `:` or `[` (or at the start of an empty line).
  const previous = before >= lineStart ? text[before] : (text.slice(0, lineStart).trimEnd().at(-1) ?? "");
  const blank = previous === "" && text.slice(0, start).trim() === "" && text.slice(end).trim() === "";
  if (!["{", ",", ":", "["].includes(previous) && !blank) return null;
  return { quoted: false, closed: false, start, end, from: start, to: end };
}

/** The first non-blank character after `offset` (skipping whitespace and line breaks), or "". */
export function nextSignificant(text, offset) {
  for (let index = offset; index < text.length; index++) if (!/\s/.test(text[index])) return text[index];
  return "";
}

/**
 * A copy of the document with only what choosing the schema form along `path` needs: the nodes on the path in full, every other value cut to its
 * type (an object to `{}`, a list to an empty list as long as it is), so the cost does not grow with the deck. `catalogs` is kept in full because
 * embedded records are offered as values.
 */
export function skeleton(root, path, skip) {
  const shallow = (node) => {
    if (node.type === "object") return {};
    if (node.type === "array") return new Array((node.children ?? []).length);
    return node.value;
  };
  const build = (node, rest, skip) => {
    if (node.type === "object") {
      const out = {};
      for (const property of node.children ?? []) {
        const key = property.children?.[0]?.value, value = property.children?.[1];
        if (typeof key !== "string" || !value) continue;
        if (rest.length && String(key) === String(rest[0])) {
          if (rest.length === 1 && skip) continue;
          out[key] = build(value, rest.slice(1), skip);
        } else out[key] = key === "catalogs" && rest.length === 0 ? getNodeValue(value) : shallow(value);
      }
      return out;
    }
    if (node.type === "array") {
      const out = new Array((node.children ?? []).length);
      (node.children ?? []).forEach((child, index) => {
        if (rest.length && String(index) === String(rest[0])) { if (!(rest.length === 1 && skip)) out[index] = build(child, rest.slice(1), skip); }
        else out[index] = shallow(child);
      });
      return out;
    }
    return node.value;
  };
  const document = build(root, path, skip);
  // The embedded catalogs, whole, whatever the path (their records are offered as values).
  const catalogs = (root.children ?? []).find((property) => property.children?.[0]?.value === "catalogs")?.children?.[1];
  if (catalogs && root.type === "object" && path[0] !== "catalogs") document.catalogs = getNodeValue(catalogs);
  return document;
}

/**
 * What the draft means at `position`, or null: `{ mode, token, path, key, existing, siblingsAfter, document, node }`.
 * `mode` is "key" (a property name goes here; `path` is the object), "value" (the value of the property at `path`; `key` is its name) or "item" (an
 * entry of the list at `path`, which ends with the entry's index). `existing` holds the other property names of the object. `document` is the
 * skeleton that `describeField` reads. `node` is the placeholder node of the draft.
 */
export function contextAt(text, position, { explicit = false } = {}) {
  const token = tokenAt(text, position, explicit);
  if (!token) return null;
  const draft = text.slice(0, token.start) + JSON.stringify(PLACEHOLDER) + text.slice(token.end);
  const root = parseTree(draft, [], { allowTrailingComma: true });
  if (!root) return null;
  const node = findNodeAtOffset(root, token.start + 1, true);
  if (node?.type !== "string" || node.value !== PLACEHOLDER) return null;
  const parent = node.parent;
  if (!parent) return { mode: "value", token, path: [], key: undefined, existing: new Set(), document: {}, node, root };
  if (parent.type === "property" && parent.children?.[0] === node) {
    const object = parent.parent;
    if (!object || object.type !== "object") return null;
    const path = getNodePath(object);
    const existing = new Set((object.children ?? []).filter((property) => property !== parent).map((property) => property.children?.[0]?.value));
    return { mode: "key", token, path, key: undefined, existing, document: skeleton(root, path, false), node, root, object };
  }
  const path = getNodePath(node);
  if (parent.type === "property") return { mode: "value", token, path, key: String(path.at(-1)), existing: new Set(), document: skeleton(root, path, true), node, root };
  if (parent.type === "array") return { mode: "item", token, path, key: undefined, existing: new Set(), document: skeleton(root, path, true), node, root };
  return null;
}

/**
 * The node under `position` in a JSON text for hover: `{ kind: "key" | "value", path, from, to, value }` (offsets of the key or value token), or
 * null. Works on text that does not parse.
 */
export function nodeAt(text, position) {
  const root = parseTree(text, [], { allowTrailingComma: true, disallowComments: false });
  if (!root) return null;
  const node = findNodeAtOffset(root, position, true);
  if (!node) return null;
  const parent = node.parent;
  if (node.type === "string" && parent?.type === "property" && parent.children?.[0] === node) {
    return { kind: "key", path: [...getNodePath(parent), node.value], from: node.offset, to: node.offset + node.length, value: node.value, root, node };
  }
  if (node.type === "property") return null;
  if (!["string", "number", "boolean", "object", "array", "null"].includes(node.type)) return null;
  return { kind: "value", path: getNodePath(node), from: node.offset, to: node.offset + node.length, value: node.type === "object" || node.type === "array" ? undefined : node.value, nodeType: node.type, root, node };
}
