import { applyEdits, findNodeAtLocation, modify, parseTree } from "jsonc-parser";

// Exact-source memory. Editing a slide rewrites only the tokens whose values changed, but a
// value that later returns (Escape, Undo, Redo) would otherwise be re-serialized with
// JSON.stringify, which turns an authored `"Café \/ Q1"` into `"Café / Q1"`. The memory
// keeps the exact source bytes of documents that were seen, keyed by the parsed value.
//
// Limits: a source longer than MAX_EXACT_SOURCE_LENGTH characters is not remembered, and the
// memory holds at most 64 sources and 8 MB in total (oldest evicted first). Edits keep working
// beyond those limits, but restoring an edited value then uses normalized JSON spelling; the
// memory reports this through `memory.limited` so a host can tell the author.
export const MAX_EXACT_SOURCE_LENGTH = 2_000_000;
const DEFAULT_LIMIT = 64;
const DEFAULT_MAX_BYTES = 8_000_000;

/**
 * `last` is the last generated document and, when it came from typing into one existing string
 * value, that value's path. A further edit of the same value replaces that transient state
 * instead of crowding out older ones, so a long draft cannot evict the authored spelling.
 * Discrete edits (add, remove, move) never coalesce.
 */
export function createSourceMemory(limit = DEFAULT_LIMIT, maxBytes = DEFAULT_MAX_BYTES) {
  return { entries: new Map(), bytes: 0, last: null, limit, maxBytes, limited: false };
}

const sharedMemory = createSourceMemory();

function forget(memory, key) {
  const source = memory.entries.get(key);
  if (source === undefined) return;
  memory.bytes -= source.length;
  memory.entries.delete(key);
}

function remember(memory, key, source) {
  forget(memory, key);
  if (source.length > MAX_EXACT_SOURCE_LENGTH) return;
  memory.entries.set(key, source);
  memory.bytes += source.length;
  while ((memory.entries.size > memory.limit || memory.bytes > memory.maxBytes) && memory.entries.size > 1) {
    forget(memory, memory.entries.keys().next().value);
  }
}

function recall(memory, key) {
  const source = memory.entries.get(key);
  if (source === undefined) return undefined;
  try {
    if (JSON.stringify(JSON.parse(source)) === key) {
      memory.entries.delete(key);
      memory.entries.set(key, source);
      return source;
    }
  } catch { /* An entry that no longer parses to this value is discarded. */ }
  forget(memory, key);
  return undefined;
}

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const canonical = (value) => JSON.stringify(value, (_name, item) => isObject(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => compare(a, b))) : item);

/** The first duplicate object key in JSON source, as `{ key, path }`, or null. */
export function findDuplicateKey(source) {
  const tree = parseTree(source);
  function walk(node, path) {
    if (node.type === "object") {
      const seen = new Set();
      for (const property of node.children ?? []) {
        const name = property.children?.[0]?.value;
        if (seen.has(name)) return { key: name, path: [...path] };
        seen.add(name);
        const found = property.children?.[1] && walk(property.children[1], [...path, name]);
        if (found) return found;
      }
    } else if (node.type === "array") {
      for (const [index, child] of (node.children ?? []).entries()) {
        const found = walk(child, [...path, index]);
        if (found) return found;
      }
    }
    return null;
  }
  return tree ? walk(tree, []) : null;
}

const own = (object, name) => (Object.hasOwn(object, name) ? object[name] : undefined);
const text = (value) => JSON.stringify(value);

// Value differences as edit operations, all in the coordinates of the source being edited:
//   replace  a leaf or subtree gets a new token
//   copy     a slot of a same-length array takes the exact token of an equal element (a move)
//   remove   an array element or object key is removed
//   insert   an array element or object key is added
// Reading goes through own properties only, so keys such as "__proto__" or "constructor" are
// ordinary keys.
function diff(before, after, path, ops) {
  if (text(before) === text(after)) return;
  if (Array.isArray(before) && Array.isArray(after)) {
    const beforeKeys = before.map(text), afterKeys = after.map(text);
    if (before.length === after.length) {
      const holders = new Map();
      beforeKeys.forEach((key, index) => { if (!holders.has(key)) holders.set(key, index); });
      after.forEach((value, index) => {
        if (beforeKeys[index] === afterKeys[index]) return;
        const from = holders.get(afterKeys[index]);
        if (from !== undefined) ops.push({ kind: "copy", path: [...path, index], from: [...path, from] });
        else diff(before[index], value, [...path, index], ops);
      });
      return;
    }
    let head = 0;
    while (head < before.length && head < after.length && beforeKeys[head] === afterKeys[head]) head++;
    let tail = 0;
    while (tail < before.length - head && tail < after.length - head && beforeKeys[before.length - 1 - tail] === afterKeys[after.length - 1 - tail]) tail++;
    const removed = before.length - head - tail, inserted = after.length - head - tail, paired = Math.min(removed, inserted);
    for (let offset = 0; offset < paired; offset++) diff(before[head + offset], after[head + offset], [...path, head + offset], ops);
    for (let offset = removed - 1; offset >= paired; offset--) ops.push({ kind: "remove", path: [...path, head + offset] });
    for (let offset = paired; offset < inserted; offset++) ops.push({ kind: "insert", path: [...path, head + offset], value: after[head + offset] });
  } else if (isObject(before) && isObject(after)) {
    for (const name of new Set([...Object.keys(before), ...Object.keys(after)])) {
      const a = own(before, name), b = own(after, name);
      if (a !== undefined && b !== undefined) diff(a, b, [...path, name], ops);
      else if (a !== undefined) ops.push({ kind: "remove", path: [...path, name] });
      else if (b !== undefined) ops.push({ kind: "insert", path: [...path, name], value: b });
    }
  } else ops.push({ kind: "replace", path, value: after });
}

// The smallest nodes that contain every edit: a changed value, or the object or array that gains
// or loses a child.
const maskPaths = (ops) => ops.map((op) => (op.kind === "remove" || op.kind === "insert" ? op.path.slice(0, -1) : op.path));

function masked(source, paths) {
  const tree = parseTree(source);
  if (!tree) return null;
  const ranges = [];
  for (const path of paths) {
    const node = findNodeAtLocation(tree, path);
    if (!node) return null;
    ranges.push([node.offset, node.offset + node.length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  let output = "", cursor = 0;
  for (const [start, end] of ranges) {
    if (start < cursor) { cursor = Math.max(cursor, end); continue; }
    output += source.slice(cursor, start) + "\u0000";
    cursor = end;
  }
  return output + source.slice(cursor);
}

// A remembered source may replace the current one only when both are byte-equal outside the
// edited nodes: manual respellings elsewhere are never reverted.
function equalOutside(current, remembered, paths) {
  const a = masked(current, paths);
  return a !== null && a === masked(remembered, paths);
}

function rememberedToken(remembered, tree, path, value) {
  if (!tree) return undefined;
  const node = findNodeAtLocation(tree, path);
  if (!node) return undefined;
  const token = remembered.slice(node.offset, node.offset + node.length);
  try { if (canonical(JSON.parse(token)) === canonical(value)) return token; } catch { /* Not the same value. */ }
  return undefined;
}

function layout(source) {
  const indent = source.match(/^[\t ]+(?=\S)/m)?.[0] ?? "  ";
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  return { indent, eol, formattingOptions: { insertSpaces: !indent.includes("\t"), tabSize: indent.length, eol } };
}

// Insert a child (array element or object property) next to its siblings without reformatting
// them: copy a representative separator, indentation included, from between two siblings.
function insertChild(source, container, index, render) {
  const children = container.children ?? [];
  if (!children.length) return null;
  const end = (node) => node.offset + node.length;
  let separator;
  if (children.length > 1) {
    const at = Math.min(Math.max(index - 1, 0), children.length - 2);
    separator = source.slice(end(children[at]), children[at + 1].offset);
  } else {
    const gap = source.slice(container.offset + 1, children[0].offset);
    separator = gap.includes("\n") ? "," + gap : ", ";
  }
  if (!/^[\s,]*$/.test(separator) || !separator.includes(",")) return null;
  const multiline = separator.includes("\n");
  const indent = multiline ? separator.slice(separator.lastIndexOf("\n") + 1) : "";
  const item = render(indent, multiline);
  if (index < children.length) return source.slice(0, children[index].offset) + item + separator + source.slice(children[index].offset);
  const last = end(children[children.length - 1]);
  return source.slice(0, last) + separator + item + source.slice(last);
}

// Remove a child by its tree range, so the siblings keep their bytes: a last child goes with the
// separator before it, any other child with the separator after it, and an only child empties the
// container (`[]`, `{}`) instead of leaving a blank body.
function removeChild(source, path) {
  const node = findNodeAtLocation(parseTree(source), path);
  if (!node) throw new Error("Missing node");
  const child = node.parent?.type === "property" ? node.parent : node;
  const parent = child.parent;
  const siblings = parent.children;
  const index = siblings.indexOf(child);
  const end = (item) => item.offset + item.length;
  let from, to;
  if (siblings.length === 1) { from = parent.offset + 1; to = end(parent) - 1; }
  else if (index < siblings.length - 1) { from = child.offset; to = siblings[index + 1].offset; }
  else { from = end(siblings[index - 1]); to = end(child); }
  return source.slice(0, from) + source.slice(to);
}

// Typing into one existing string value is the only edit whose intermediate states are worth
// forgetting. Every discrete edit (add, remove, move) stays exactly restorable.
function typingSignature(previous, ops) {
  if (ops.length !== 1 || ops[0].kind !== "replace" || typeof ops[0].value !== "string") return null;
  let value = previous;
  for (const step of ops[0].path) {
    if (value === null || typeof value !== "object" || !Object.hasOwn(value, step)) return null;
    value = value[step];
  }
  return typeof value === "string" ? JSON.stringify(ops[0].path) : null;
}

/**
 * Change only the affected values. Keeps authored indentation, escaping and all unrelated
 * metadata/content byte-for-byte, including across canvas Escape, Undo and Redo.
 * Throws when `source` is not valid JSON. The result always parses to `document`; if an
 * in-place edit cannot achieve that (for example the source repeats an object key), the whole
 * document is written as indented JSON instead.
 */
export function updateJsonSource(source, document, memory = sharedMemory) {
  const previous = JSON.parse(source);
  const previousKey = JSON.stringify(previous);
  memory.limited = source.length > MAX_EXACT_SOURCE_LENGTH;
  if (memory.entries.get(previousKey) !== source) {
    // The current bytes were not produced here (initial source, typing, paste): they are the
    // spelling to restore.
    remember(memory, previousKey, source);
    memory.last = null;
  }
  const ops = [];
  diff(previous, document, [], ops);
  if (!ops.length) return source;
  const key = JSON.stringify(document);
  const remembered = recall(memory, key);
  if (remembered !== undefined && equalOutside(source, remembered, maskPaths(ops))) {
    memory.last = null;
    return remembered;
  }
  const rememberedTree = remembered === undefined ? null : parseTree(remembered);

  const { indent, eol, formattingOptions } = layout(source);
  const unit = indent.includes("\t") ? "\t" : indent;
  const pretty = (value, lineIndent) => JSON.stringify(value, null, unit).split("\n").join(eol + lineIndent);
  let result = source;
  // Insertion copies the neighbours' separator; an empty container is written in the document's style.
  function insert(path, value) {
    const parentPath = path.slice(0, -1), last = path[path.length - 1];
    const parent = findNodeAtLocation(parseTree(result), parentPath);
    const isArray = typeof last === "number";
    const container = parent && (parent.type === "array" || parent.type === "object");
    const spliced = container
      ? insertChild(result, parent, isArray ? last : parent.children?.length ?? 0, (lineIndent, multiline) => isArray
        ? (multiline ? pretty(value, lineIndent) : text(value))
        : `${text(last)}${multiline ? ": " : ":"}${multiline ? pretty(value, lineIndent) : text(value)}`)
      : null;
    if (spliced !== null) result = spliced;
    else if (container && !parent.children?.length) {
      const written = isArray ? [value] : Object.defineProperty({}, last, { value, enumerable: true, writable: true, configurable: true });
      const lineIndent = result.slice(result.lastIndexOf("\n", parent.offset) + 1, parent.offset).match(/^[\t ]*/)[0];
      const content = result.includes("\n") ? pretty(written, lineIndent) : text(written);
      result = result.slice(0, parent.offset) + content + result.slice(parent.offset + parent.length);
    } else result = applyEdits(result, modify(result, path, value, { formattingOptions, isArrayInsertion: isArray }));
  }
  try {
    // Replacements and moves are position-independent: parse once and apply them back to front.
    const tree = parseTree(source);
    const edits = [];
    for (const op of ops) {
      if (op.kind !== "replace" && op.kind !== "copy") continue;
      const node = findNodeAtLocation(tree, op.path);
      if (!node) throw new Error("Missing node");
      let token;
      if (op.kind === "copy") {
        const from = findNodeAtLocation(tree, op.from);
        if (!from) throw new Error("Missing node");
        token = source.slice(from.offset, from.offset + from.length);
      } else token = rememberedToken(remembered, rememberedTree, op.path, op.value) ?? text(op.value);
      edits.push({ from: node.offset, to: node.offset + node.length, token });
    }
    edits.sort((a, b) => b.from - a.from);
    for (const edit of edits) result = result.slice(0, edit.from) + edit.token + result.slice(edit.to);
    // Structural edits follow, in the order they were produced.
    for (const op of ops) {
      if (op.kind === "remove") result = removeChild(result, op.path);
      else if (op.kind === "insert") insert(op.path, op.value);
    }
  } catch { result = ""; }
  let valid = false;
  try {
    const parsed = JSON.parse(result);
    valid = JSON.stringify(parsed) === key || canonical(parsed) === canonical(JSON.parse(key));
  } catch { /* Fall back below. */ }
  if (!valid) {
    result = JSON.stringify(document, null, indent).replaceAll("\n", eol);
    if (/\n$/.test(source)) result += eol;
  }

  const signature = typingSignature(previous, ops);
  if (signature !== null && memory.last && memory.last.key === previousKey && memory.last.signature === signature) forget(memory, previousKey);
  remember(memory, key, result);
  memory.last = { key, signature };
  return result;
}
