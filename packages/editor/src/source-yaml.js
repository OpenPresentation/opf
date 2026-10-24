// The YAML text adapter of the source editor (artifacts/source-editor/SPEC.md, section 3.2): what a position in a YAML draft means. A line-and-indent
// reader, not a parser, so it works while the text is half typed: it walks the lines once, keeping the stack of mappings and lists the lines open
// (the column their entries start at), and answers for the caret the same things the JSON adapter does: the token being typed, whether a key, a value
// or a list item belongs there, the path of the node in the document, the keys already there and a skeleton of the document that the schema reads.
// It handles block style, flow collections on one line, quoted keys and values, block scalars and comments; whatever it cannot place (a flow collection
// over several lines, text in a block scalar, a comment) gives null, so no list opens there. Plain functions, no DOM.
import { parse as parseYaml } from "yaml";

const KEY_WORD = /[A-Za-z0-9_.$+-]/;
const BLOCK_HEADER = /^[|>][+-]?\d*[+-]?\s*(?:#.*)?$/;
const isSpace = (character) => character === " " || character === "\t";

// ---- one line ----------------------------------------------------------------------------------------------------------------------
/** The `- ` markers a line starts with (their columns) and the text after them: `{ indent, markers, rest, restStart }`. */
export function readMarkers(line) {
  let index = 0;
  while (isSpace(line[index])) index++;
  const indent = index;
  const markers = [];
  while (line[index] === "-" && (index + 1 === line.length || isSpace(line[index + 1]))) {
    markers.push(index);
    index++;
    while (isSpace(line[index])) index++;
  }
  return { indent, markers, rest: line.slice(index), restStart: index };
}

/**
 * The `key:` a text starts with, or null: `{ key, keyStart, keyEnd, colon, valueStart }` (columns in `rest`). A plain key runs to the first colon that
 * is followed by a space or the end (so `top+middle:left` is one key); a quoted key to its closing quote.
 */
export function readEntry(rest) {
  if (rest === "" || /^[[{|>&*!%@`#]/.test(rest)) return null;
  let keyEnd;
  let key;
  let keyStart = 0;
  if (rest[0] === '"' || rest[0] === "'") {
    const quote = rest[0];
    let index = 1;
    for (; index < rest.length; index++) {
      if (quote === '"' && rest[index] === "\\") { index++; continue; }
      if (rest[index] === quote) {
        if (quote === "'" && rest[index + 1] === "'") { index++; continue; }
        break;
      }
    }
    if (index >= rest.length) return null;
    keyEnd = index + 1;
    key = quote === '"' ? safeJson(rest.slice(0, keyEnd)) : rest.slice(1, index).replaceAll("''", "'");
    keyStart = 0;
    let after = keyEnd;
    while (isSpace(rest[after])) after++;
    if (rest[after] !== ":" || !(after + 1 === rest.length || isSpace(rest[after + 1]))) return null;
    return { key, keyStart, keyEnd, colon: after, valueStart: after + 1, quoted: true };
  }
  for (let index = 0; index < rest.length; index++) {
    if (rest[index] === "#" && index > 0 && isSpace(rest[index - 1])) return null;
    if (rest[index] === ":" && (index + 1 === rest.length || isSpace(rest[index + 1]))) {
      key = rest.slice(0, index).trimEnd();
      if (key === "") return null;
      return { key, keyStart, keyEnd: key.length, colon: index, valueStart: index + 1, quoted: false };
    }
  }
  return null;
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return text.slice(1, -1); }
}

/** A plain or quoted scalar as the value it stands for, for the skeleton the schema reads. */
export function scalarValue(text) {
  const value = text.trim();
  if (value === "" || value === "~" || value === "null") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return Number(value);
  if (value[0] === '"') return safeJson(value.length > 1 && value.endsWith('"') ? value : `${value}"`);
  if (value[0] === "'") return value.slice(1, value.endsWith("'") && value.length > 1 ? -1 : undefined).replaceAll("''", "'");
  return value.replace(/\s+#.*$/, "");
}

/** The change in flow-collection depth over a text (brackets outside quotes and comments), and the depth the text ends at, starting from `depth`. */
export function flowDepth(text, depth = 0) {
  let quote = null;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quote) {
      if (quote === '"' && character === "\\") index++;
      else if (character === quote) quote = null;
    } else if (character === '"' || character === "'") quote = character;
    else if (character === "#" && (index === 0 || isSpace(text[index - 1]))) break;
    else if (character === "[" || character === "{") depth++;
    else if ((character === "]" || character === "}") && depth > 0) depth--;
  }
  return depth;
}

// ---- the stack of open collections -------------------------------------------------------------------------------------------------
class Frame {
  constructor(kind, col, parent, via) {
    this.kind = kind;
    this.col = col;
    this.parent = parent;
    this.via = via;
    this.keys = new Map();
    this.lastKey = undefined;
    this.count = 0;
    this.items = [];
  }
  get path() {
    const path = [];
    for (let frame = this; frame?.parent; frame = frame.parent) path.unshift(frame.via);
    return path;
  }
  get open() { return this.kind === "map" && this.lastKey !== undefined && this.keys.get(this.lastKey)?.open === true; }
}

class Stack {
  constructor() { this.frames = []; }
  get top() { return this.frames.at(-1); }
  pop() { return this.frames.pop(); }
  popAbove(col) { while (this.top && this.top.col > col) this.pop(); }
  push(kind, col) {
    const parent = this.top;
    const via = !parent ? null : parent.kind === "map" ? parent.lastKey : parent.count - 1;
    const frame = new Frame(kind, col, parent ?? null, via);
    this.frames.push(frame);
    return frame;
  }
  /** The mapping whose keys start at `col`: the open one, or a new one under the key or list item that opened it. */
  mapAt(col) {
    this.popAbove(col);
    while (this.top?.kind === "seq" && this.top.col === col) this.pop();
    if (this.top?.kind === "map" && this.top.col === col) return this.top;
    return this.push("map", col);
  }
  /** The list whose dashes are at `col`, with a new item counted. */
  seqAt(col) {
    this.popAbove(col);
    if (this.top?.kind === "seq" && this.top.col === col) {
      this.top.count++;
      return this.top;
    }
    const frame = this.push("seq", col);
    frame.count++;
    return frame;
  }
}

function shapeOfValue(value) {
  const text = value.trim();
  if (text === "" || text.startsWith("#")) return { open: true };
  if (BLOCK_HEADER.test(text)) return { block: true };
  if (text[0] === "[") return { flow: "seq" };
  if (text[0] === "{") return { flow: "map" };
  if (text[0] === "&" || text[0] === "*" || text[0] === "!") return { open: true };
  return { scalar: scalarValue(text) };
}

/** Apply the entries of one line to the stack: its dashes, then its key (when it has one). Returns `{ seq, map }`: the list and the mapping the line is in. */
function enter(stack, parsed, entry, shape) {
  let frame = null;
  for (const col of parsed.markers) {
    frame = stack.seqAt(col);
    frame.items[frame.count - 1] = { open: true };
  }
  let mapFrame = null;
  if (entry) {
    mapFrame = stack.mapAt(parsed.restStart + entry.keyStart);
    mapFrame.keys.set(entry.key, shape);
    mapFrame.lastKey = entry.key;
    if (frame?.kind === "seq") frame.items[frame.count - 1] = { map: mapFrame };
  } else if (frame && shape && "scalar" in shape) frame.items[frame.count - 1] = shape;
  return { seq: frame, map: mapFrame };
}

// ---- the lines ---------------------------------------------------------------------------------------------------------------------
let lastLines = null;

/** The lines of a text, `[{ start, end, text }]` (a line break is `\n`, `\r\n` or `\r`), remembered for the last text asked about. */
export function linesOf(text) {
  if (lastLines?.text === text) return lastLines.lines;
  const lines = [];
  let start = 0;
  for (let index = 0; index <= text.length; index++) {
    const code = index < text.length ? text.charCodeAt(index) : -1;
    if (index === text.length || code === 10 || code === 13) {
      lines.push({ start, end: index, text: text.slice(start, index) });
      if (code === 13 && text.charCodeAt(index + 1) === 10) index++;
      start = index + 1;
    }
  }
  lastLines = { text, lines };
  return lines;
}

const lineIndex = (lines, position) => {
  let low = 0, high = lines.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (lines[middle].start <= position) low = middle; else high = middle - 1;
  }
  return low;
};

/** Whether `column` of `line` is inside a comment (a `#` at the start or after a space, outside quotes). */
function inComment(line, column) {
  let quote = null;
  for (let index = 0; index < column && index < line.length; index++) {
    const character = line[index];
    if (quote) {
      if (quote === '"' && character === "\\") index++;
      else if (character === quote) quote = null;
    } else if (character === '"' || character === "'") {
      // A quote opens a string only where a value or key can start.
      if (index === 0 || /[\s[{,:-]/.test(line[index - 1])) quote = character;
    } else if (character === "#" && (index === 0 || isSpace(line[index - 1]))) return true;
  }
  return false;
}

/** The quote character of a quoted scalar that `value` opens and does not close, or null (a quoted scalar may run over several lines). */
export function openQuote(value) {
  const text = value.trimStart();
  const quote = text[0];
  if (quote !== '"' && quote !== "'") return null;
  return closesQuote(text.slice(1), quote) ? null : quote;
}

/** Whether `text` (the rest of a quoted scalar) holds its closing quote. */
function closesQuote(text, quote) {
  for (let index = 0; index < text.length; index++) {
    if (quote === '"' && text[index] === "\\") { index++; continue; }
    if (text[index] === quote) {
      if (quote === "'" && text[index + 1] === "'") { index++; continue; }
      return true;
    }
  }
  return false;
}

/**
 * Walk the lines before `stop` (a line index), applying each to `stack`. Lines inside a block scalar, a flow collection or a quoted scalar that span
 * lines, blank lines, comments and document markers change nothing. Returns `{ block, flow, quote, open }`: the column a block scalar's text must be
 * indented past (or -1), the depth of an unclosed flow collection (0 when none), the quote of an unclosed quoted scalar (or null) at line `stop`, so
 * the caller knows whether that line is inside any of them, and for a flow collection `open`: the line it began on and where it sits in the stack.
 */
function walk(lines, stop, stack) {
  let block = -1;
  let flow = 0;
  let quote = null;
  let open = null;
  for (let number = 0; number < stop; number++) {
    const text = lines[number].text;
    if (quote) { if (closesQuote(text, quote)) quote = null; continue; }
    if (text.trim() === "") continue;
    const indent = text.length - text.trimStart().length;
    if (block >= 0) {
      if (indent > block) continue;
      block = -1;
    }
    if (flow > 0) { flow = flowDepth(text, flow); continue; }
    const trimmed = text.trimStart();
    if (trimmed.startsWith("#") || trimmed === "---" || trimmed === "..." || trimmed.startsWith("%")) continue;
    const parsed = readMarkers(text);
    const entry = readEntry(parsed.rest);
    const value = entry ? parsed.rest.slice(entry.valueStart) : parsed.rest;
    const shape = entry ? shapeOfValue(value) : (parsed.markers.length ? shapeOfValue(value) : undefined);
    if (!entry && !parsed.markers.length) continue;
    const placed = enter(stack, parsed, entry, shape);
    if (shape?.block) block = entry ? parsed.restStart + entry.keyStart : parsed.markers.at(-1);
    else if (shape?.flow) {
      flow = flowDepth(value, 0);
      open = flow > 0 ? { number, parsed, entry, value, placed } : null;
    } else if (shape && "scalar" in shape) quote = openQuote(value);
  }
  return { block, flow, quote, open };
}

// ---- flow collections on one line --------------------------------------------------------------------------------------------------
/**
 * The place of the caret inside flow collections that began on this line: the containers open at `column` (outermost first), each with the keys and
 * the number of items before the caret. `null` when the caret is not in a flow collection.
 */
function flowAt(rest, column) {
  const containers = [];
  let quote = null;
  for (let index = 0; index < column; index++) {
    const character = rest[index];
    if (quote) {
      if (quote === '"' && character === "\\") { index++; continue; }
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") { quote = character; continue; }
    if (character === "[" || character === "{") {
      containers.push({ kind: character === "[" ? "seq" : "map", count: 0, keys: [], key: undefined, expect: character === "[" ? "item" : "key", start: index });
    } else if ((character === "]" || character === "}") && containers.length) {
      containers.pop();
      const parent = containers.at(-1);
      if (parent) { parent.expect = parent.kind === "seq" ? "item" : "after"; }
    } else if (character === ",") {
      const top = containers.at(-1);
      if (top) { top.count++; top.expect = top.kind === "seq" ? "item" : "key"; top.key = undefined; }
    } else if (character === ":" && containers.at(-1)?.kind === "map" && (index + 1 >= rest.length || /[\s,}\]]/.test(rest[index + 1]) || containers.at(-1).expect === "key")) {
      const top = containers.at(-1);
      if (top.expect === "key") {
        const before = rest.slice(top.start + 1, index);
        const word = before.slice(before.lastIndexOf(",") + 1).trim().replace(/^["']|["']$/g, "");
        top.key = word;
        top.keys.push(word);
        top.expect = "value";
      }
    }
  }
  return containers.length ? containers : null;
}

// ---- the context at a caret --------------------------------------------------------------------------------------------------------
// The document the schema reads: every collection on the path to the caret in full (with the scalar values of its other keys), the others cut to
// their type. `catalogs` is parsed in full so embedded records are offered as values.
function skeletonOf(frame, lines) {
  const chain = [];
  for (let current = frame; current; current = current.parent) chain.unshift(current);
  const shallow = (shape) => {
    if (!shape) return {};
    if ("scalar" in shape) return shape.scalar;
    if (shape.flow === "seq") return [];
    if (shape.flow === "map") return {};
    if (shape.block) return "";
    return {};
  };
  const build = (index) => {
    const current = chain[index];
    const next = chain[index + 1];
    const onPath = (via) => next !== undefined && next.parent === current && next.via === via;
    if (current.kind === "map") {
      const out = {};
      for (const [key, shape] of current.keys) out[key] = onPath(key) ? build(index + 1) : shallow(shape);
      if (next && next.parent === current && typeof next.via === "string" && !(next.via in out)) out[next.via] = build(index + 1);
      return out;
    }
    const out = new Array(current.count);
    for (let position = 0; position < current.count; position++) {
      const item = current.items[position];
      out[position] = onPath(position) ? build(index + 1) : item && "scalar" in item ? item.scalar : {};
    }
    return out;
  };
  const root = chain.length ? build(0) : {};
  const catalogs = catalogsBlock(lines);
  if (catalogs !== undefined && root && typeof root === "object" && !Array.isArray(root)) {
    try { const value = parseYaml(catalogs); if (value?.catalogs) root.catalogs = value.catalogs; } catch { /* A broken catalogs block offers no embedded records. */ }
  }
  return root;
}

// The text of the top-level `catalogs:` block (the key and the lines indented under it).
function catalogsBlock(lines) {
  for (let number = 0; number < lines.length; number++) {
    if (!/^catalogs\s*:/.test(lines[number].text)) continue;
    let end = number + 1;
    while (end < lines.length && (lines[end].text.trim() === "" || /^\s/.test(lines[end].text) || lines[end].text.startsWith("- "))) end++;
    return lines.slice(number, end).map((line) => line.text).join("\n");
  }
  return undefined;
}

// Wrap the skeleton in the path the text is the body of (YAML in a fence of a Markdown slide).
function wrapped(document, prefix) {
  let root = document;
  for (let index = prefix.length - 1; index >= 0; index--) {
    const wrapper = typeof prefix[index] === "number" ? [] : {};
    wrapper[prefix[index]] = root;
    root = wrapper;
  }
  return root;
}

/** Where the scalar value that begins at `from` ends, on a line ending at `lineEnd`: `{ quoted, closed, start, end, from, to }` (a quoted token has its quotes in `start..end`). */
function valueToken(text, from, position, lineEnd, flow) {
  const first = text[from];
  if (first === '"' || first === "'") {
    let close = -1;
    for (let index = from + 1; index < lineEnd; index++) {
      if (first === '"' && text[index] === "\\") { index++; continue; }
      if (text[index] === first) {
        if (first === "'" && text[index + 1] === "'") { index++; continue; }
        close = index;
        break;
      }
    }
    if (close >= 0 && position > close) return null;
    const to = close >= 0 ? close : Math.max(position, from + 1);
    return { quoted: true, closed: close >= 0, start: from, end: close >= 0 ? close + 1 : to, from: from + 1, to };
  }
  let end = from;
  while (end < lineEnd) {
    if (flow ? /[,\]}]/.test(text[end]) : isSpace(text[end]) && text[end + 1] === "#") break;
    end++;
  }
  while (end > from && isSpace(text[end - 1])) end--;
  end = Math.max(end, position);
  return { quoted: false, closed: false, start: from, end, from, to: end };
}

/** The word (or quoted key) around the caret where a key goes: `{ quoted, closed, start, end, from, to }`. */
function keyToken(text, line, restStart, position) {
  const start = line.start + restStart;
  const first = text[start];
  if ((first === '"' || first === "'") && start < position) {
    let close = -1;
    for (let index = position; index < line.end; index++) if (text[index] === first) { close = index; break; }
    return { quoted: true, closed: close >= 0, start, end: close >= 0 ? close + 1 : position, from: start + 1, to: close >= 0 ? close : position };
  }
  let end = position;
  while (end < line.end && (KEY_WORD.test(text[end]) || (text[end] === ":" && end + 1 < line.end && KEY_WORD.test(text[end + 1])))) end++;
  return { quoted: false, closed: false, start, end, from: start, to: end };
}

/**
 * What the draft means at `position`, or null: `{ format: "yaml", mode, token, path, key, existing, document, ... }`.
 * `mode` is "key" (a property name goes here; `path` is the mapping), "value" (the value of the property at `path`; `key` is its name) or "item" (an
 * entry of a flow list, which ends with the entry's index). `existing` holds the other property names of the mapping. `document` is the skeleton that
 * `describeField` reads. A key after a list dash has `seq`: `{ path, index }` of the list item, `itemStart` when nothing else is on the item yet.
 * `column` is the column of the entry (where a key goes), `indent` the indentation of its line, `needsSpace` that a value place has no space after the
 * colon yet. Options: `explicit` (Ctrl+Space also takes an empty place), `prefix` (the path of the node the text is the body of, for YAML in a fence of
 * a Markdown slide), `exclude` (keys never offered, the `slides` of front matter).
 */
export function yamlContextAt(text, position, options = {}) {
  const context = readContext(text, position, options);
  // The text the context was read from, and the path it is the body of: the references the value lists offer are looked up in it.
  return context ? { ...context, sourceText: text, prefix: options.prefix ?? [] } : null;
}

function readContext(text, position, { explicit = false, prefix = [], exclude = [] }) {
  const lines = linesOf(text);
  const number = lineIndex(lines, position);
  const line = lines[number];
  const column = position - line.start;
  const lineText = line.text;
  if (inComment(lineText, column)) return null;
  const trimmedLine = lineText.trim();
  if (trimmedLine === "---" || trimmedLine === "...") return null;
  const stack = new Stack();
  const state = walk(lines, number, stack);
  const lineIndent = lineText.length - lineText.trimStart().length;
  if (state.block >= 0 && (trimmedLine === "" ? column > state.block : lineIndent > state.block)) return null;
  const before = lineText.slice(0, column);
  // A line inside a quoted scalar that began above: text, in which only `{{` of a variable is completed.
  if (state.quote) return continuationContext({ text, line, position, before, explicit });
  if (state.flow > 0) return flowContinuation({ text, lines, number, line, position, column, explicit, prefix, exclude, open: state.open });
  const parsed = readMarkers(before);
  // The key is read from the whole line: a colon after the caret that ends the key (`top:le|ft: x`) is not the colon before it.
  const whole = readMarkers(lineText);
  const found = readEntry(whole.rest);
  const entry = found && column > whole.restStart + found.colon ? readEntry(parsed.rest) : null;
  const shared = { text, lines, number, line, position, parsed, explicit, exclude, prefix, stack, lineIndent };
  return entry ? valueContext({ ...shared, entry }) : keyOrItemContext(shared);
}

const VARIABLE_OPEN = /\{\{[A-Za-z0-9._-]*$/;

/**
 * A line of text that continues a scalar begun on a line above (a quoted scalar left open, or a sentence that runs on): nothing to complete in it
 * except the name of a variable after `{{`. The context is a value in the text sense (`multiline`), with no path.
 */
function continuationContext({ text, line, position, before, explicit }) {
  if (!VARIABLE_OPEN.test(before)) return null;
  let end = position;
  while (end < line.end && /[A-Za-z0-9._-]/.test(text[end])) end++;
  const start = line.start + (line.text.length - line.text.trimStart().length);
  return { format: "yaml", mode: "value", multiline: true, token: { quoted: true, closed: false, start, end, from: start, to: end }, path: [], key: undefined, existing: new Set(), document: {}, itemStart: false, flow: false, needsSpace: false, column: 0, indent: 0, explicit };
}

// The text of a line without its comment (a `#` after a space, outside quotes).
function withoutComment(text) {
  let quote = null;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quote) {
      if (quote === '"' && character === "\\") index++;
      else if (character === quote) quote = null;
    } else if (character === '"' || character === "'") {
      if (index === 0 || /[\s[{,:-]/.test(text[index - 1])) quote = character;
    } else if (character === "#" && (index === 0 || isSpace(text[index - 1]))) return text.slice(0, index);
  }
  return text;
}

/**
 * A caret on a line inside a flow collection that began on an earlier line (`tags: [a,` / `  b, |]`, `{theme: minimal,` / `  |}`): the lines from
 * the opening one to the caret are read as one text, so the containers open at the caret and the keys and items before it are known as on one line.
 */
function flowContinuation({ text, lines, number, line, position, column, explicit, prefix, exclude, open }) {
  if (!open) return null;
  const first = lines[open.number].text;
  const start = open.entry ? open.parsed.restStart + open.entry.valueStart : open.parsed.restStart;
  const middle = lines.slice(open.number + 1, number).map((item) => withoutComment(item.text).trim());
  const joined = [withoutComment(first.slice(start)).trimStart(), ...middle, line.text.slice(0, column).trimStart()].join(" ");
  const flow = flowAt(joined, joined.length);
  if (!flow) return null;
  const { map, seq } = open.placed;
  const frame = open.entry ? map : seq;
  const base = open.entry ? [...map.path, open.entry.key] : [...seq.path, seq.count - 1];
  return flowContext({ text, line, position, flow, base, frame, lines, explicit, prefix, exclude });
}

function valueContext({ text, lines, line, position, parsed, entry, explicit, prefix, stack, lineIndent, exclude }) {
  const lineText = line.text;
  let valueFrom = line.start + parsed.restStart + entry.valueStart;
  let spaces = 0;
  while (valueFrom + spaces < position && isSpace(text[valueFrom + spaces])) spaces++;
  const needsSpace = spaces === 0;
  valueFrom += spaces;
  if (position < valueFrom) return null;
  const valueText = lineText.slice(valueFrom - line.start);
  // A block scalar header, an anchor, an alias or a tag: no suggestions.
  if (/^[|>&*!]/.test(valueText)) return null;
  const place = enter(stack, parsed, entry, shapeOfValue(valueText));
  const map = place.map;
  const base = [...map.path, entry.key];
  const rest = lineText.slice(parsed.restStart);
  const flow = valueText[0] === "[" || valueText[0] === "{" ? flowAt(rest, position - line.start - parsed.restStart) : null;
  if (flow) return flowContext({ text, line, position, flow, base, frame: map, lines, explicit, prefix, exclude });
  const token = valueToken(text, valueFrom, position, line.end, false);
  if (!token) return null;
  // Right after the colon (no space typed) a value place opens only when asked for.
  if (token.from === position && needsSpace && !explicit) return null;
  return {
    format: "yaml", mode: "value", token, path: [...prefix, ...base], key: entry.key, existing: new Set(), document: wrapped(skeletonOf(map, lines), prefix),
    itemStart: false, flow: false, needsSpace, column: parsed.restStart + entry.keyStart, indent: lineIndent,
  };
}

function keyOrItemContext({ text, lines, number, line, position, parsed, explicit, exclude, prefix, stack, lineIndent }) {
  const lineText = line.text;
  const rest = parsed.rest;
  // A flow collection that starts after a dash: a list item of its own.
  if (rest[0] === "[" || rest[0] === "{") {
    const flow = flowAt(rest, rest.length);
    if (!flow || !parsed.markers.length) return null;
    let seq = null;
    for (const col of parsed.markers) { seq = stack.seqAt(col); seq.items[seq.count - 1] = { open: true }; }
    return flowContext({ text, line, position, flow, base: [...seq.path, seq.count - 1], frame: seq, lines, explicit, prefix, exclude });
  }
  const quoteOpen = rest[0] === '"' || rest[0] === "'";
  // The word before the caret is a plain key (or the start of a scalar item) or an unfinished quoted key; anything else (a sentence) is prose.
  if (!quoteOpen && rest !== "" && !/^[A-Za-z0-9_.$+:-]+$/.test(rest)) {
    // A sentence that runs on from a scalar above: only a variable (`{{`) is completed in it.
    return parsed.markers.length ? null : continuationContext({ text, line, position, before: lineText.slice(0, position - line.start), explicit });
  }
  let seq = null;
  for (const col of parsed.markers) { seq = stack.seqAt(col); seq.items[seq.count - 1] = { open: true }; }
  const frame = stack.mapAt(parsed.restStart);
  const token = keyToken(text, line, parsed.restStart, position);
  // An empty place after nothing is not worth a list unless asked for; after a dash it is.
  if (token.from === position && token.to === position && !explicit && !parsed.markers.length && rest === "") return null;
  const full = readMarkers(lineText);
  const fullEntry = readEntry(full.rest);
  const inKey = fullEntry && position - line.start >= full.restStart && position - line.start <= full.restStart + fullEntry.keyEnd;
  const path = frame.path;
  const seqInfo = seq ? { path: [...prefix, ...seq.path], index: seq.count - 1 } : null;
  // The other keys of this mapping: the ones above are in the frame, the ones below the caret's line are read now.
  collectSiblings(lines, number, frame, stack, new Set());
  const existing = new Set(frame.keys.keys());
  if (inKey) existing.delete(fullEntry.key);
  for (const key of exclude) existing.add(key);
  const itemStart = parsed.markers.length > 0 && [...frame.keys.keys()].every((key) => key === fullEntry?.key) ;
  return {
    format: "yaml", mode: "key", token, path: [...prefix, ...path], key: undefined, existing, document: wrapped(skeletonOf(frame, lines), prefix),
    itemStart, flow: false, needsSpace: false, column: parsed.restStart, indent: lineIndent, seq: seqInfo,
  };
}

// The keys of `frame` on the lines after line `number`, until the mapping ends; they are added to the frame (and to `into`).
function collectSiblings(lines, number, frame, stack, into) {
  let block = -1;
  let flow = 0;
  for (let index = number + 1; index < lines.length; index++) {
    const text = lines[index].text;
    if (text.trim() === "") continue;
    const indent = text.length - text.trimStart().length;
    if (block >= 0) { if (indent > block) continue; block = -1; }
    if (flow > 0) { flow = flowDepth(text, flow); continue; }
    const trimmed = text.trimStart();
    if (trimmed.startsWith("#") || trimmed === "---" || trimmed === "...") continue;
    const parsed = readMarkers(text);
    const entry = readEntry(parsed.rest);
    if (!entry && !parsed.markers.length) continue;
    const value = entry ? parsed.rest.slice(entry.valueStart) : parsed.rest;
    const shape = shapeOfValue(value);
    const placed = enter(stack, parsed, entry, shape);
    if (!stack.frames.includes(frame)) return;
    if (entry && placed.map === frame) into.add(entry.key);
    if (shape.block) block = entry ? parsed.restStart + entry.keyStart : parsed.markers.at(-1);
    else if (shape.flow) flow = flowDepth(value, 0);
  }
}

// A caret inside a flow collection written on one line (`audience: [a, |]`, `{ theme: x, | }`).
function flowContext({ text, line, position, flow, base, frame, lines, explicit, prefix, exclude }) {
  // The outer containers lead to the innermost: a list item is its position, a mapping value its key.
  let path = base;
  for (let level = 0; level < flow.length - 1; level++) {
    const container = flow[level];
    if (container.kind === "seq") path = [...path, container.count];
    else if (container.expect === "value" && container.key !== undefined) path = [...path, container.key];
    else return null;
  }
  const inner = flow.at(-1);
  let start = position, end = position;
  while (start > line.start && /[A-Za-z0-9_.$+:-]/.test(text[start - 1])) start--;
  while (end < line.end && /[A-Za-z0-9_.$+:-]/.test(text[end])) end++;
  const token = { quoted: false, closed: false, start, end, from: start, to: end };
  if (token.from === position && token.to === position && !explicit) return null;
  const common = { format: "yaml", token, document: wrapped(skeletonOf(frame, lines), prefix), itemStart: false, flow: true, needsSpace: false, column: 0, indent: 0 };
  if (inner.kind === "seq") return { ...common, mode: "item", path: [...prefix, ...path, inner.count], key: undefined, existing: new Set() };
  if (inner.expect === "key") return { ...common, mode: "key", path: [...prefix, ...path], key: undefined, existing: new Set([...inner.keys, ...exclude]) };
  if (inner.expect === "value" && inner.key !== undefined) return { ...common, mode: "value", path: [...prefix, ...path, inner.key], key: inner.key, existing: new Set() };
  return null;
}
