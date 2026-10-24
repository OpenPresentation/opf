import { type Node, findNodeAtOffset, getNodePath, parseTree } from "jsonc-parser";
import { parsePointer } from "./patch.js";
import { type SourceFormat, type TextRange, createLocator } from "./source-text.js";

/** Which part of a node `locate` returns. */
export type LocatePart =
  /** The value node (the default). */
  | "value"
  /** The property-name string token. */
  | "key"
  /** The key through the end of its value. */
  | "entry"
  /** The first character of the value (`{`, `[`, a quote, ...): where a "missing property" finding points. */
  | "open"
  /** The key through the colon. */
  | "colon";

export interface LocateOptions {
  part?: LocatePart;
}

export interface PathAtResult {
  /** The document path of the node under the offset: a property's path at its key, the container's path between its members. */
  path: (string | number)[];
  /** `key`: on a property name. `value`: on a value (or a container's own bracket). `between`: whitespace, a comma or a colon inside a container. `none`: outside the root value. */
  part: "key" | "value" | "between" | "none";
  /** The range of the key or value token, or of the container for `between`. */
  range?: TextRange;
}

const isJson = (format: SourceFormat): boolean => format === "json";

// A BOM is replaced by a space so that offsets stay the ones of the editor's text.
const parseText = (text: string) => parseTree(text.startsWith("﻿") ? ` ${text.slice(1)}` : text, [], { allowTrailingComma: true, allowEmptyContent: true, disallowComments: false });

function segmentsOf(pointer: string | readonly (string | number)[]): string[] | undefined {
  if (Array.isArray(pointer)) return pointer.map(String);
  if (typeof pointer !== "string") return undefined;
  try {
    return parsePointer(pointer);
  } catch {
    return undefined;
  }
}

function member(node: Node, segment: string): Node | undefined {
  if (node.type === "array") return /^(?:0|[1-9][0-9]*)$/.test(segment) ? node.children?.[Number(segment)] : undefined;
  if (node.type === "object") return node.children?.find((property) => property.children?.[0]?.value === segment);
  return undefined;
}

function partOf(value: Node | undefined, property: Node | undefined, part: LocatePart): { offset: number; length: number } | undefined {
  const key = property?.children?.[0];
  // A property without a value (`"design":` and nothing after the colon) has no value node: its key (and colon) stand in for it.
  const keyAndColon = key ? { offset: key.offset, length: (property?.colonOffset !== undefined ? property.colonOffset + 1 : key.offset + key.length) - key.offset } : undefined;
  switch (part) {
    case "value":
      return value ? { offset: value.offset, length: value.length } : keyAndColon;
    case "open":
      return value ? { offset: value.offset, length: Math.min(1, value.length) } : keyAndColon;
    case "key":
      return key ? { offset: key.offset, length: key.length } : undefined;
    case "colon":
      return keyAndColon;
    case "entry":
      return key ? { offset: key.offset, length: (value ? value.offset + value.length : keyAndColon ? keyAndColon.offset + keyAndColon.length : key.offset + key.length) - key.offset } : undefined;
  }
}

/**
 * The text range of the node a JSON Pointer (or a segment array) addresses, so that a finding about `/slides/2/design` can be
 * underlined in the source. Tolerant: it reads text with syntax errors, comments and trailing commas as far as it can be read.
 * When the node does not exist, the range is that of the nearest ancestor that does, with `exact: false`.
 *
 * Phase 1 reads JSON. YAML and Markdown return `undefined` (phase 2): no range is guessed.
 */
export function locate(text: string, format: SourceFormat, pointer: string | readonly (string | number)[], options: LocateOptions = {}): TextRange | undefined {
  if (!isJson(format)) return undefined;
  const segments = segmentsOf(pointer);
  const root = segments ? parseText(text) : undefined;
  if (!segments || !root) return undefined;
  const part = options.part ?? "value";
  const place = createLocator(text);
  let value: Node | undefined = root;
  let property: Node | undefined;
  let depth = 0;
  for (const segment of segments) {
    const next: Node | undefined = value ? member(value, segment) : undefined;
    if (!value || !next) break;
    // On an object the member found is the property node and the value is its second child; on an array it is the item itself.
    if (value.type === "object") {
      property = next;
      value = next.children?.[1];
    } else {
      property = undefined;
      value = next;
    }
    depth++;
  }
  const exact = depth === segments.length;
  // A part the node does not have (the key of the root, the colon of an array item) is the value instead.
  const found = partOf(value, property, part) ?? partOf(value, property, "value");
  if (!found) return undefined;
  return { ...place(found.offset, found.length), ...(exact ? {} : { exact: false }) };
}

/**
 * The document path and the kind of position at a character offset (a caret between characters). JSON only (phase 1); YAML and
 * Markdown return `undefined`. Tolerant of broken text.
 */
export function pathAt(text: string, format: SourceFormat, offset: number): PathAtResult | undefined {
  if (!isJson(format)) return undefined;
  const root = parseText(text);
  const place = createLocator(text);
  const none: PathAtResult = { path: [], part: "none" };
  if (!root || offset < root.offset || offset > root.offset + root.length) return none;
  const node = findNodeAtOffset(root, offset, true);
  if (!node) return none;
  const range = (target: Node): TextRange => place(target.offset, target.length);
  const parent = node.parent;
  if (node.type === "string" && parent?.type === "property" && parent.children?.[0] === node) return { path: getNodePath(node), part: "key", range: range(node) };
  if (node.type === "property") {
    // Between the key and the value (the colon, the spaces after it): the caret is in the property, on neither token.
    const key = node.children?.[0];
    return { path: key ? [...getNodePath(node), String(key.value)] : getNodePath(node), part: "between", range: range(node) };
  }
  if (node.type === "object" || node.type === "array") {
    // On a bracket is at its outer edge: the caret just before `{` or just after `}`. Just inside is between the members.
    const onOpen = offset <= node.offset;
    const onClose = offset >= node.offset + node.length && /[}\]]$/.test(text.slice(node.offset, node.offset + node.length));
    const path = getNodePath(node);
    return onOpen || onClose ? { path, part: "value", range: range(node) } : { path, part: "between", range: range(node) };
  }
  return { path: getNodePath(node), part: "value", range: range(node) };
}
