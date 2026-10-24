// Addressing inside YAML text for `locate` and `pathAt` (`@openpresentation/opf/source`): the `yaml` library's tolerant parse gives every
// node its source range, so a JSON Pointer becomes a range and an offset becomes a document path, also while the text has syntax errors
// (the library keeps the nodes it could read). Internal module.
import { rememberByText } from "./source-text.js";
import { type Node, type Pair, type ParsedNode, isAlias, isMap, isScalar, isSeq, parseDocument } from "yaml";

/** A half-open range of offsets in the text it was read from. */
export interface Span {
  offset: number;
  length: number;
}

export interface YamlLocateResult extends Span {
  /** False when the pointer names a node the text does not have and the range is the nearest ancestor that exists. */
  exact: boolean;
}

export type YamlPart = "value" | "key" | "entry" | "open" | "colon";

export interface YamlPathResult {
  path: string[];
  part: "key" | "value" | "between" | "none";
  range?: Span;
}

type Read = { text: string; root: ParsedNode | null; shift: number };

// A BOM is dropped before the parse and added back to every offset, so offsets stay the ones of the editor's text.
const read = rememberByText(readText);
function readText(text: string): Read {
  const bom = text.startsWith("﻿") ? 1 : 0;
  const body = bom ? text.slice(1) : text;
  const document = parseDocument(body, { prettyErrors: false, uniqueKeys: false, merge: false, strict: false });
  return { text: body, root: (document.contents as ParsedNode | null) ?? null, shift: bom };
}

const isBlank = (char: string | undefined): boolean => char === " " || char === "\t" || char === "\n" || char === "\r";

/** The end of a node without the line break and spaces that follow its last character. */
function endOf(text: string, node: ParsedNode): number {
  let end = node.range[1];
  const start = node.range[0];
  while (end > start && isBlank(text[end - 1])) end--;
  return end;
}

const startOf = (node: ParsedNode): number => node.range[0];
const keyName = (key: unknown): string | undefined => (isScalar(key) ? String(key.value) : isAlias(key) ? undefined : key !== null && typeof key === "object" && "toString" in key ? String((key as Node).toString()) : undefined);
const hasText = (text: string, node: ParsedNode | null | undefined): node is ParsedNode => !!node && node.range[0] < endOf(text, node);
const pairKey = (pair: Pair): ParsedNode | null => (pair.key as ParsedNode | null) ?? null;
const pairValue = (pair: Pair): ParsedNode | null => (pair.value as ParsedNode | null) ?? null;

/** The offset just after the colon of a pair (a space between key and colon is allowed), or the end of the key when there is none. */
function colonEnd(text: string, key: ParsedNode): number {
  let at = key.range[1];
  while (text[at] === " " || text[at] === "\t") at++;
  return text[at] === ":" ? at + 1 : key.range[1];
}

function member(node: ParsedNode, segment: string): { pair?: Pair; value: ParsedNode | null } | undefined {
  if (isMap(node)) {
    const pair = node.items.find((item) => keyName(item.key) === segment);
    return pair ? { pair, value: pairValue(pair) } : undefined;
  }
  if (isSeq(node)) {
    if (!/^(?:0|[1-9][0-9]*)$/.test(segment)) return undefined;
    const item = node.items[Number(segment)];
    return item === undefined ? undefined : { value: item as ParsedNode | null };
  }
  return undefined;
}

/** The first character of a value: the opening bracket of a flow collection or quote, else the first token of a block collection (its first key or its first item). */
function openOf(text: string, value: ParsedNode): Span {
  const start = startOf(value);
  if (isMap(value) && !value.flow) {
    const first = value.items[0];
    const key = first ? pairKey(first) : null;
    if (key) return { offset: startOf(key), length: key.range[1] - startOf(key) };
  }
  return { offset: start, length: Math.min(1, endOf(text, value) - start) };
}

/** Where a pointer is in YAML text, or undefined when the text holds no document. */
export function locateYaml(text: string, segments: readonly string[], part: YamlPart): YamlLocateResult | undefined {
  const { text: body, root, shift } = read(text);
  if (!root || !hasText(body, root)) return undefined;
  let value: ParsedNode | null = root;
  let pair: Pair | undefined;
  let depth = 0;
  for (const segment of segments) {
    const next: { pair?: Pair; value: ParsedNode | null } | undefined = value ? member(value, segment) : undefined;
    if (!value || !next) break;
    pair = next.pair;
    value = next.value;
    depth++;
  }
  const exact = depth === segments.length;
  const key = pair ? pairKey(pair) : null;
  const keySpan = key ? { offset: startOf(key), length: key.range[1] - startOf(key) } : undefined;
  // A property without a value (`design:` and nothing after the colon) has no text for a value: its key and colon stand in for it.
  const keyAndColon = key ? { offset: startOf(key), length: colonEnd(body, key) - startOf(key) } : undefined;
  const valueSpan = hasText(body, value) ? { offset: startOf(value), length: endOf(body, value) - startOf(value) } : undefined;
  const choose = (wanted: YamlPart): Span | undefined => {
    switch (wanted) {
      case "value":
        return valueSpan ?? keyAndColon;
      case "open":
        return hasText(body, value) ? openOf(body, value) : keyAndColon;
      case "key":
        return keySpan;
      case "colon":
        return keyAndColon;
      case "entry":
        return keySpan ? { offset: keySpan.offset, length: (valueSpan ? valueSpan.offset + valueSpan.length : (keyAndColon?.offset ?? 0) + (keyAndColon?.length ?? 0)) - keySpan.offset } : undefined;
    }
  };
  const found = choose(part) ?? choose("value") ?? (depth === 0 ? { offset: startOf(root), length: endOf(body, root) - startOf(root) } : undefined);
  return found ? { offset: found.offset + shift, length: found.length, exact } : undefined;
}

/** The document path under an offset of YAML text. */
export function pathAtYaml(text: string, offset: number): YamlPathResult {
  const { text: body, root, shift } = read(text);
  const at = offset - shift;
  const none: YamlPathResult = { path: [], part: "none" };
  if (!root || !hasText(body, root) || at < startOf(root) || at > endOf(body, root)) return none;
  const span = (node: ParsedNode): Span => ({ offset: startOf(node) + shift, length: endOf(body, node) - startOf(node) });
  const inside = (node: ParsedNode | null): node is ParsedNode => hasText(body, node) && at >= startOf(node) && at <= endOf(body, node);
  const walk = (node: ParsedNode, path: string[]): YamlPathResult => {
    if (isMap(node)) {
      for (const pair of node.items) {
        const key = pairKey(pair);
        const value = pairValue(pair);
        const name = keyName(pair.key);
        if (name === undefined) continue;
        if (key && at >= startOf(key) && at <= key.range[1]) return { path: [...path, name], part: "key", range: span(key) };
        if (inside(value)) return walk(value, [...path, name]);
        // Between the key and its value (the colon and the spaces after it): the caret is in the pair, on neither token.
        if (key && at > key.range[1] && at <= (hasText(body, value) ? startOf(value) : colonEnd(body, key))) {
          const end = hasText(body, value) ? startOf(value) : colonEnd(body, key);
          return { path: [...path, name], part: "between", range: { offset: startOf(key) + shift, length: end - startOf(key) } };
        }
      }
      return { path, part: "between", range: span(node) };
    }
    if (isSeq(node)) {
      for (const [index, item] of node.items.entries()) if (inside(item as ParsedNode | null)) return walk(item as ParsedNode, [...path, String(index)]);
      return { path, part: "between", range: span(node) };
    }
    return { path, part: "value", range: span(node) };
  };
  return walk(root, []);
}
