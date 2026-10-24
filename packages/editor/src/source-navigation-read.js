// A document of any of the three source formats as one tree (artifacts/source-editor/SPEC.md, section 8.3). Go to definition, peek, references and rename
// work on ids written in text that may be broken or half typed, so every reader is tolerant and every node knows where it is written (UTF-16 offsets of
// the text as the code editor holds it). The shapes:
//   object  { t: "object", from, to, props: [{ key, from, to, cFrom, cTo, value }] }   (`from`..`to` is the key token, `cFrom`..`cTo` its text without quotes)
//   array   { t: "array", from, to, items: [node] }
//   string  { t: "string", from, to, cFrom, cTo, value, quoted, block }               (a quoted or plain scalar that reads as text)
//   scalar  { t: "scalar", from, to, value }                                         (a number, a boolean or null)
// JSON reads with jsonc-parser, YAML with the `yaml` library's tolerant parse, Markdown as a deck whose root is the front matter's mapping with a `slides`
// array built from the `<!-- slide: ... -->` and `<!-- block: ... -->` comments and the `opf-slide` and `opf-block` fences, so the code that looks for ids
// is written once. Plain functions, no DOM.
import { parseTree } from "jsonc-parser";
import { isAlias, isMap, isScalar, isSeq, parseDocument } from "yaml";
import { scanMarkdown } from "@openpresentation/opf/source";

const OPTION = /([A-Za-z][A-Za-z0-9_-]*)(?:=("(?:[^"\\\n]|\\.)*"|'[^'\n]*'|[^\s"'][^\s]*))?/g;

// ---- JSON ---------------------------------------------------------------------------------------------------------------------------
function jsonNode(node) {
  const end = node.offset + node.length;
  if (node.type === "object") {
    const props = [];
    for (const property of node.children ?? []) {
      const [key, value] = property.children ?? [];
      if (!key || key.type !== "string") continue;
      const closed = key.length >= 2;
      props.push({ key: String(key.value), from: key.offset, to: key.offset + key.length, cFrom: key.offset + 1, cTo: key.offset + key.length - (closed ? 1 : 0), value: value ? jsonNode(value) : null });
    }
    return { t: "object", from: node.offset, to: end, props };
  }
  if (node.type === "array") return { t: "array", from: node.offset, to: end, items: (node.children ?? []).map(jsonNode) };
  if (node.type === "string") return { t: "string", from: node.offset, to: end, cFrom: node.offset + 1, cTo: node.length >= 2 ? end - 1 : end, value: node.value, quoted: true };
  return { t: "scalar", from: node.offset, to: end, value: node.value ?? null };
}

/** The tree of a JSON text, or null when it has no value. */
export function readJson(text) {
  const root = parseTree(text.startsWith("﻿") ? ` ${text.slice(1)}` : text, [], { allowTrailingComma: true, allowEmptyContent: true, disallowComments: false });
  return root ? jsonNode(root) : null;
}

// ---- YAML ---------------------------------------------------------------------------------------------------------------------------
function trimEnd(text, from, to) {
  let end = to;
  while (end > from && /\s/.test(text[end - 1])) end--;
  return end;
}

function yamlKey(text, node, shift) {
  if (!isScalar(node) || node.value === null || node.value === undefined) return null;
  const start = node.range[0], end = trimEnd(text, start, node.range[1]);
  const quoted = node.type === "QUOTE_DOUBLE" || node.type === "QUOTE_SINGLE" || text[start] === '"' || text[start] === "'";
  return { key: String(node.value), from: start + shift, to: end + shift, cFrom: start + shift + (quoted ? 1 : 0), cTo: end + shift - (quoted ? 1 : 0) };
}

function yamlNode(text, node, shift) {
  if (node === null || node === undefined || isAlias(node)) return null;
  const start = node.range?.[0] ?? 0, end = trimEnd(text, start, node.range?.[1] ?? start);
  if (isMap(node)) {
    const props = [];
    for (const pair of node.items) {
      const key = yamlKey(text, pair.key, shift);
      if (key) props.push({ ...key, value: yamlNode(text, pair.value, shift) });
    }
    return { t: "object", from: start + shift, to: end + shift, props };
  }
  if (isSeq(node)) return { t: "array", from: start + shift, to: end + shift, items: node.items.map((item) => yamlNode(text, item, shift) ?? { t: "scalar", from: start + shift, to: start + shift, value: null }) };
  if (isScalar(node)) {
    if (typeof node.value !== "string") return { t: "scalar", from: start + shift, to: end + shift, value: node.value };
    const quoted = node.type === "QUOTE_DOUBLE" || node.type === "QUOTE_SINGLE";
    const block = node.type === "BLOCK_LITERAL" || node.type === "BLOCK_FOLDED";
    return { t: "string", from: start + shift, to: end + shift, cFrom: start + shift + (quoted ? 1 : 0), cTo: end + shift - (quoted ? 1 : 0), value: node.value, quoted, block };
  }
  return null;
}

/** The tree of a YAML text; `shift` is where the text starts in the document it was cut from. Null when it holds no value. */
export function readYaml(text, shift = 0) {
  const bom = text.startsWith("﻿") ? 1 : 0;
  const body = bom ? text.slice(1) : text;
  let document;
  try { document = parseDocument(body, { prettyErrors: false, uniqueKeys: false, merge: false, strict: false }); } catch { return null; }
  const root = yamlNode(body, document.contents, shift + bom);
  return root;
}

/** Give the main thread back to the browser (a message to ourselves: a task of its own, with no timer clamp). */
export const yieldToBrowser = () => new Promise((resolve) => { const channel = new MessageChannel(); channel.port1.onmessage = () => { channel.port1.close(); resolve(); }; channel.port2.postMessage(0); });

const SEGMENT = 24_000, SLICE = 12_000;

/**
 * A big YAML text read in pieces, with the main thread given back between them, so that a thousand slides never make one task of fifty milliseconds:
 * the text is cut where a top-level key starts, and the `slides` list where one of its items starts; each piece is read on its own and the nodes
 * are put together. Null when the text is not shaped like that (a list at the top, several documents, flow style): the caller reads it whole.
 */
export async function readYamlInPieces(text) {
  if (/^(?:---|\.\.\.)/m.test(text) || text.includes("\t") && /^\t/m.test(text)) return null;
  const starts = [];
  const key = /^[^\s#\-\[{%&*!?|>'"][^\r\n]*|^["'][^\r\n]*/gm;
  for (let match = key.exec(text); match; match = key.exec(text)) starts.push(match.index);
  if (!starts.length || /\S/.test(text.slice(0, starts[0]).replace(/^\s*#[^\n]*$/gm, ""))) return null;
  const props = [];
  for (let at = 0; at < starts.length; at++) {
    const from = starts[at], to = at + 1 < starts.length ? starts[at + 1] : text.length;
    const piece = text.slice(from, to);
    let tree = null;
    if (piece.length > SEGMENT && /^slides\s*:[ \t]*(?:#[^\n]*)?\r?\n/.test(piece)) tree = await readSlidesInPieces(text, from, to);
    else tree = readYaml(piece, from);
    if (tree?.t !== "object" || tree.props.length !== 1) return null;
    props.push(tree.props[0]);
    if (piece.length > SEGMENT / 4) await yieldToBrowser();
  }
  return { t: "object", from: props[0].from, to: props.at(-1).value?.to ?? props.at(-1).to, props };
}

// `slides:` and then the items of the list, cut where an item starts (a line with the list marker at the indentation of the first item).
async function readSlidesInPieces(text, from, to) {
  const head = /^[^\n]*\n/.exec(text.slice(from, to))[0];
  const headTree = readYaml(head.replace(/\s+$/, ""), from);
  const first = /^([ \t]*)- /m.exec(text.slice(from + head.length, to));
  if (headTree?.t !== "object" || headTree.props.length !== 1 || (headTree.props[0].value && !(headTree.props[0].value.t === "scalar" && headTree.props[0].value.value === null)) || !first) return null;
  const indent = first[1];
  const marker = new RegExp(`^${indent}- `, "gm");
  const itemStarts = [];
  const body = text.slice(from + head.length, to);
  for (let match = marker.exec(body); match; match = marker.exec(body)) itemStarts.push(from + head.length + match.index);
  // Anything between the header and the first item must be blank or a comment.
  if (/\S/.test(body.slice(0, itemStarts[0] - from - head.length).replace(/^\s*#[^\n]*$/gm, ""))) return null;
  const items = [];
  let begin = 0;
  while (begin < itemStarts.length) {
    let end = begin + 1;
    while (end < itemStarts.length && itemStarts[end] - itemStarts[begin] < SLICE) end++;
    const sliceFrom = itemStarts[begin], sliceTo = end < itemStarts.length ? itemStarts[end] : to;
    const tree = readYaml(text.slice(sliceFrom, sliceTo), sliceFrom);
    if (tree?.t !== "array" || tree.items.length !== end - begin) return null;
    items.push(...tree.items);
    begin = end;
    await yieldToBrowser();
  }
  const prop = headTree.props[0];
  return { t: "object", from: prop.from, to: items.at(-1).to, props: [{ ...prop, value: { t: "array", from: items[0].from, to: items.at(-1).to, items } }] };
}

// ---- Markdown -----------------------------------------------------------------------------------------------------------------------
/** The `key=value` options of the text between `<!--` and `-->` after the `slide:` or `block:` word: `[{ key, from, to, value, cFrom, cTo, quoted }]`. */
export function readOptions(text, innerFrom, innerTo) {
  const inner = text.slice(innerFrom, innerTo);
  const head = /^\s*(?:slide|block)\s*:/.exec(inner);
  if (!head) return [];
  const options = [];
  const body = inner.slice(head[0].length);
  const base = innerFrom + head[0].length;
  OPTION.lastIndex = 0;
  for (let match = OPTION.exec(body); match; match = OPTION.exec(body)) {
    const raw = match[2];
    const from = base + match.index, keyTo = from + match[1].length;
    if (raw === undefined) { options.push({ key: match[1], from, to: keyTo, value: null }); continue; }
    const valueFrom = base + match.index + match[0].length - raw.length, valueTo = valueFrom + raw.length;
    const quoted = raw[0] === '"' || raw[0] === "'";
    let value = raw;
    if (quoted) { try { value = raw[0] === '"' ? JSON.parse(raw) : raw.slice(1, -1); } catch { value = raw.slice(1, -1); } }
    options.push({ key: match[1], from, to: keyTo, value, cFrom: valueFrom + (quoted ? 1 : 0), cTo: valueTo - (quoted ? 1 : 0), quoted });
  }
  return options;
}

const optionProps = (options) => {
  const props = [];
  const byKey = new Map();
  for (const option of options) {
    if (option.value === null) continue;
    const node = { t: "string", from: option.cFrom - (option.quoted ? 1 : 0), to: option.cTo + (option.quoted ? 1 : 0), cFrom: option.cFrom, cTo: option.cTo, value: String(option.value), quoted: option.quoted };
    const known = byKey.get(option.key);
    if (known) { known.values.push(node); continue; }
    const prop = { key: option.key, from: option.from, to: option.to, cFrom: option.from, cTo: option.to, values: [node], value: node };
    byKey.set(option.key, prop);
    props.push(prop);
  }
  // A repeated option (`beat=a beat=b`) is a list.
  for (const prop of props) {
    if (prop.values.length > 1) prop.value = { t: "array", from: prop.values[0].from, to: prop.values.at(-1).to, items: prop.values };
    delete prop.values;
  }
  return props;
};

/** The deck of a Markdown text: the front matter's mapping with a `slides` array (see the header). Also returns the scan for the regions of the text. */
export function readMarkdown(text) {
  const scan = scanMarkdown(text);
  const root = { t: "object", from: 0, to: text.length, props: [] };
  if (scan.frontMatter) {
    const tree = readYaml(text.slice(scan.frontMatter.yamlFrom, scan.frontMatter.yamlTo), scan.frontMatter.yamlFrom);
    if (tree?.t === "object") root.props.push(...tree.props);
  }
  const slides = scan.slides.map((slide) => ({ t: "object", from: slide.from, to: slide.to, props: [], blocks: [] }));
  const slideOf = (index) => slides[scan.slides.findIndex((slide) => slide.index === index)] ?? null;
  for (const comment of scan.comments) {
    if (comment.kind !== "slide" && comment.kind !== "block") continue;
    const slide = slideOf(comment.slide);
    if (!slide) continue;
    const props = optionProps(readOptions(text, comment.innerFrom, comment.innerTo));
    if (comment.kind === "slide") slide.props.push(...props);
    else slide.blocks.push({ t: "object", from: comment.from, to: comment.to, props });
  }
  for (const fence of scan.fences) {
    if (fence.kind !== "opf-slide" && fence.kind !== "opf-block") continue;
    const slide = slideOf(fence.slide);
    if (!slide) continue;
    const tree = readYaml(text.slice(fence.bodyFrom, fence.bodyTo), fence.bodyFrom);
    if (tree?.t !== "object") continue;
    if (fence.kind === "opf-slide") slide.props.push(...tree.props);
    else slide.blocks.push(tree);
  }
  for (const slide of slides) {
    if (slide.blocks.length) slide.props.push({ key: "blocks", from: slide.from, to: slide.from, cFrom: slide.from, cTo: slide.from, value: { t: "array", from: slide.from, to: slide.to, items: slide.blocks } });
    delete slide.blocks;
  }
  root.props.push({ key: "slides", from: 0, to: 0, cFrom: 0, cTo: 0, value: { t: "array", from: 0, to: text.length, items: slides } });
  return { root, scan };
}

/** `readDocument`, reading a big YAML text in pieces (see `readYamlInPieces`) with the main thread given back between them. */
export async function readDocumentInPieces(text, format) {
  if (format === "yaml" && text.length > SEGMENT) {
    const root = await readYamlInPieces(text);
    if (root) return { root };
  }
  return readDocument(text, format);
}

/** The tree of `text` in `format` ("json", "yaml" or "md"): `{ root, scan? }` with `root` an object node or null. */
export function readDocument(text, format) {
  if (format === "md") return readMarkdown(text);
  const root = format === "yaml" ? readYaml(text) : readJson(text);
  return { root: root?.t === "object" ? root : null };
}

// ---- helpers ------------------------------------------------------------------------------------------------------------------------
/** The property `key` of an object node, or undefined. */
export const propOf = (node, key) => (node?.t === "object" ? node.props.find((prop) => prop.key === key) : undefined);
/** The value node of the property `key`. */
export const childOf = (node, key) => propOf(node, key)?.value ?? null;
/** The node at `path` (keys and indexes) below `node`, or null. */
export function nodeAtPath(node, path) {
  let current = node;
  for (const step of path) {
    if (!current) return null;
    if (current.t === "object") current = propOf(current, String(step))?.value ?? null;
    else if (current.t === "array") current = current.items[Number(step)] ?? null;
    else return null;
  }
  return current;
}

/** The plain value of a node (what `JSON.parse` would give), skipping what `skip(key, depth)` says. */
export function plainOf(node, skip, depth = 0) {
  if (!node) return undefined;
  if (node.t === "object") {
    const out = {};
    for (const prop of node.props) {
      if (prop.key === "__proto__" || skip?.(prop.key, depth)) continue;
      out[prop.key] = prop.value ? plainOf(prop.value, skip, depth + 1) : null;
    }
    return out;
  }
  if (node.t === "array") return node.items.map((item) => plainOf(item, skip, depth + 1));
  return node.value;
}
