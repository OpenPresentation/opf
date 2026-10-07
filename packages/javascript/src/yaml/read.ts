// YAML reading for `@openpresentation/opf/yaml` (RR-56): the strict, JSON-compatible YAML 1.2 core dialect, located
// findings, and the JSON Pointer to source range index that maps OPF validation findings back to the YAML. Internal module.
import { type Alias, type Document, type ParsedNode, type Scalar, type YAMLError, type YAMLMap, type YAMLSeq, Parser, isAlias, isMap, isScalar, isSeq, parseDocument, visit } from "yaml";
import type { Finding, FindingLocation } from "../generated/types/finding.js";
import { Ctx, type Range } from "../markdown/support.js";

/** A finding located in the YAML source: `yaml/<rule>` syntax and dialect errors (category `format`) and the OPF findings of the parsed deck. */
export type YamlFinding = Finding & { location: FindingLocation };

/** The most alias expansions `aliases: true` allows before the YAML is refused (the yaml package's `maxAliasCount`). */
export const MAX_ALIAS_COUNT = 100;

/** The explicit tags the core schema defines. Any other tag (custom, `!!binary`, `!!set`, ...) is an error. */
const CORE_TAGS = new Set(["map", "seq", "str", "int", "float", "bool", "null"].map((name) => `tag:yaml.org,2002:${name}`));

const ALIAS_HELP = "Write each value out instead of using anchors (&name), aliases (*name) and merge keys (<<). Pass aliases: true (CLI: --aliases) to expand them.";
const TAG_HELP = "Custom tags are not accepted. Remove the tag; quote a value to keep it as text.";
const CYCLE_HELP = "An alias must not appear inside its own anchor. Write the nested value out.";

const decode = (part: string): string => part.replaceAll("~1", "/").replaceAll("~0", "~");
const encode = (part: string): string => part.replaceAll("~", "~0").replaceAll("/", "~1");
const pointerOf = (parts: string[]): string => (parts.length ? `/${parts.map(encode).join("/")}` : "");

export interface ParsedYaml {
  /** The decoded value (`{}` when there are errors). */
  value: unknown;
  /** Maps a JSON Pointer to the location of the YAML node it names (the nearest ancestor when the pointer names nothing). */
  locatePointer: (pointer: string) => FindingLocation | undefined;
  findings: YamlFinding[];
  errors: number;
}

/** The source range of the node a JSON Pointer names: the value for a scalar, the key through the value for a collection. */
function rangeOfPointer(doc: Document.Parsed | undefined, pointer: string): Range | undefined {
  const root = doc?.contents as ParsedNode | null | undefined;
  if (!root?.range) return undefined;
  const parts = pointer === "" ? [] : pointer.slice(1).split("/").map(decode);
  let node: ParsedNode = root;
  let key: ParsedNode | undefined;
  for (const part of parts) {
    if (isAlias(node)) break;
    let child: ParsedNode | null | undefined;
    let childKey: ParsedNode | undefined;
    if (isMap(node)) {
      const pairs = (node as YAMLMap.Parsed).items;
      const pair = pairs.find((item) => isScalar(item.key) && String(item.key.value) === part) ?? pairs.find((item) => isMergeKey(item.key) && item.value);
      if (pair) {
        childKey = pair.key as ParsedNode;
        child = (pair.value as ParsedNode | null) ?? childKey;
      }
    } else if (isSeq(node)) child = (node as YAMLSeq.Parsed).items[/^(?:0|[1-9]\d*)$/.test(part) ? Number(part) : -1] as ParsedNode | undefined;
    if (!child?.range) break;
    node = child;
    key = childKey;
  }
  const [start, end] = node.range as [number, number, number];
  if (key?.range && (isMap(node) || isSeq(node) || isAlias(node))) return { start: key.range[0], end };
  return { start, end: Math.max(start, end) };
}

/** A plain `<<` key: the YAML 1.1 merge indicator (the yaml package reads it as a symbol when merging is on). */
function isMergeKey(key: unknown): boolean {
  return isScalar(key) && (typeof key.value === "symbol" || (key.value === "<<" && key.type === "PLAIN"));
}

function describeError(error: YAMLError): { rule: string; message: string; help: string } {
  const text = error.message.split("\n")[0] ?? error.message;
  switch (error.code) {
    case "DUPLICATE_KEY":
      return { rule: "duplicate-key", message: `YAML: ${text}`, help: "Remove or rename one of the repeated keys. JSON-compatible YAML needs every key once in each mapping." };
    case "MULTIPLE_DOCS":
      return { rule: "multiple-documents", message: "The input holds more than one YAML document.", help: "An OPF file is exactly one document: remove the extra --- separators, or put each deck in its own file." };
    case "TAG_RESOLVE_FAILED":
      return { rule: "tag", message: `YAML: ${text}`, help: TAG_HELP };
    case "BAD_ALIAS":
      return { rule: "alias", message: `YAML: ${text}`, help: ALIAS_HELP };
    default:
      return { rule: "syntax", message: `YAML: ${text}`, help: "Fix the YAML syntax at this position. An OPF file holds JSON-compatible YAML 1.2: mappings, sequences and scalars." };
  }
}

/** The range of the mapping key that starts at `start`. */
function keyRangeAt(doc: Document.Parsed, start: number): Range | undefined {
  let found: Range | undefined;
  visit(doc, {
    Pair(_key, pair) {
      const key = pair.key as ParsedNode | null;
      if (!found && key?.range && key.range[0] === start) found = { start, end: key.range[1] };
    },
  });
  return found;
}

type Add = (rule: string, message: string, help: string, range: Range, path?: string) => void;

/** Parse one OPF YAML document in the strict dialect. Never throws; the findings carry what is wrong. */
export function readYamlDocument(source: string, aliases: boolean, rootKind: "mapping" | "any" = "mapping"): ParsedYaml {
  const bom = source.startsWith("﻿") ? 1 : 0;
  const text = source.slice(bom);
  const ctx = new Ctx(text);
  const findings: YamlFinding[] = [];
  const locate = (range: Range): FindingLocation => {
    const location = ctx.location(range);
    return { ...location, offset: location.offset + bom };
  };
  const add: Add = (rule, message, help, range, path = "") => {
    findings.push({ ruleId: `yaml/${rule}`, severity: "error", category: "format", scope: "document", path, message, help, location: locate(range) });
  };
  const doc = parseDocument(text, { schema: "core", uniqueKeys: true, merge: aliases, prettyErrors: false });
  const finish = (value: unknown): ParsedYaml => ({
    value,
    locatePointer: (pointer) => {
      const range = rangeOfPointer(doc, pointer);
      return range ? locate(range) : undefined;
    },
    findings,
    errors: findings.length,
  });

  for (const error of [...doc.errors, ...doc.warnings.filter((warning) => warning.code === "TAG_RESOLVE_FAILED")]) {
    const described = describeError(error);
    const [start, end] = error.pos;
    add(described.rule, described.message, described.help, (error.code === "DUPLICATE_KEY" ? keyRangeAt(doc, start) : undefined) ?? { start, end: Math.max(start, end) });
  }
  if (findings.length) return finish({});

  const root = doc.contents as ParsedNode | null;
  if (root === null || !root.range) {
    add("empty", "The input holds no YAML document.", "An OPF file is one YAML mapping: write the deck properties (name, slides, ...) as key: value lines.", { start: 0, end: Math.min(1, text.length) });
    return finish({});
  }
  const rootRange = { start: root.range[0], end: root.range[1] };
  if (rootKind === "mapping" && !isMap(root)) {
    add("not-mapping", "The document is not a mapping.", "An OPF deck is a YAML mapping of keys and values (name:, slides:, ...), not a list or a single value.", rootRange);
    return finish({});
  }
  checkTree({ doc, text, aliases, add }, root, [], []);
  if (findings.length) return finish({});

  let value: unknown;
  try {
    value = doc.toJS({ maxAliasCount: aliases ? MAX_ALIAS_COUNT : 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/excessive alias/i.test(message)) add("alias-limit", `The anchors and aliases expand beyond the limit of ${MAX_ALIAS_COUNT} aliases.`, "Aliases that contain aliases grow exponentially. Write the repeated values out, or reduce the aliasing.", rootRange);
    else add("alias", `YAML: ${message}`, ALIAS_HELP, rootRange);
    return finish({});
  }
  if (isCircular(value)) {
    add("alias-cycle", "An alias refers to the value that contains it, so the document is infinitely deep.", CYCLE_HELP, rootRange);
    return finish({});
  }
  const bad = nonJson(value);
  if (bad) {
    add("number", `The YAML holds ${bad}, which JSON cannot carry.`, "Quote it to keep it as text, or write a finite number.", rootRange);
    return finish({});
  }
  return finish(value);
}

interface Env {
  doc: Document.Parsed;
  text: string;
  aliases: boolean;
  add: Add;
}

/** The range of a node property (`&anchor`, `!tag`) written before the node, found by searching back from the node. */
function propertyRange(text: string, nodeStart: number, token: string, fallback: Range): Range {
  const found = text.lastIndexOf(token, nodeStart);
  return found >= 0 && found < nodeStart ? { start: found, end: found + token.length } : fallback;
}

function checkTree(env: Env, node: ParsedNode, trail: string[], ancestors: ParsedNode[]): void {
  const { doc, text, aliases, add } = env;
  const path = pointerOf(trail);
  const range = (target: ParsedNode): Range => ({ start: target.range?.[0] ?? 0, end: Math.max(target.range?.[0] ?? 0, target.range?.[1] ?? 0) });
  if (isAlias(node)) {
    const name = (node as Alias).source;
    if (!aliases) add("alias", `The alias *${name} is not allowed.`, ALIAS_HELP, range(node), path);
    else {
      const target = (node as Alias.Parsed).resolve(doc) as ParsedNode | undefined;
      if (target && ancestors.includes(target)) add("alias-cycle", `The alias *${name} refers to a value that contains it.`, CYCLE_HELP, range(node), path);
    }
    return;
  }
  const anchor = (node as { anchor?: string }).anchor;
  if (anchor !== undefined && !aliases) add("alias", `The anchor &${anchor} is not allowed.`, ALIAS_HELP, propertyRange(text, node.range?.[0] ?? 0, `&${anchor}`, range(node)), path);
  const tag = (node as { tag?: string }).tag;
  if (tag !== undefined && !CORE_TAGS.has(tag)) {
    let start = text.lastIndexOf("!", node.range?.[0] ?? 0);
    while (start > 0 && text[start - 1] === "!") start--;
    const written = start >= 0 ? /^!\S*/.exec(text.slice(start))?.[0] : undefined;
    add("tag", `The tag ${written ?? tag} is not allowed.`, TAG_HELP, written && start < (node.range?.[0] ?? 0) ? { start, end: start + written.length } : range(node), path);
  }
  if (isScalar(node)) {
    const value = (node as Scalar).value;
    if (typeof value === "number" && !Number.isFinite(value)) add("number", `${String((node as Scalar).source ?? value)} is not a finite number, and JSON cannot carry it.`, "Quote it (\".inf\", \".nan\") to keep it as text, or write a finite number.", range(node), path);
    return;
  }
  const inside = [...ancestors, node];
  if (isMap(node)) {
    for (const pair of (node as YAMLMap.Parsed).items) {
      const key = pair.key as ParsedNode | null;
      if (key && isMergeKey(key)) {
        if (!aliases) add("alias", "The merge key << is not allowed.", ALIAS_HELP, range(key), path);
        else {
          const source = pair.value as ParsedNode | null;
          if (source && isSeq(source)) for (const item of (source as YAMLSeq.Parsed).items) checkTree(env, item as ParsedNode, [...trail, "<<"], inside);
          else if (source) checkTree(env, source, [...trail, "<<"], inside);
        }
        continue;
      }
      const resolved = key && isAlias(key) ? ((key as Alias.Parsed).resolve(doc) as ParsedNode | undefined) : key;
      const name = resolved && isScalar(resolved) && typeof resolved.value === "string" ? resolved.value : undefined;
      if (key) checkTree(env, key, trail, inside);
      if (name === undefined) {
        add("key", "A mapping key is not a string.", "JSON keys are always strings. Quote the key, for example \"1\": value.", key ? range(key) : range(node), path);
        continue;
      }
      if (pair.value) checkTree(env, pair.value as ParsedNode, [...trail, name], inside);
    }
    return;
  }
  if (isSeq(node)) {
    const items = (node as YAMLSeq.Parsed).items;
    for (let index = 0; index < items.length; index++) checkTree(env, items[index] as ParsedNode, [...trail, String(index)], inside);
  }
}

function nonJson(value: unknown): string | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? undefined : "a number that is not finite";
  if (value === null || typeof value === "string" || typeof value === "boolean") return undefined;
  if (Array.isArray(value)) return value.map(nonJson).find(Boolean);
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return `a ${(value as object).constructor?.name ?? "non-JSON"} value`;
    return Object.values(value as object).map(nonJson).find(Boolean);
  }
  return `a ${typeof value}`;
}

function isCircular(value: unknown, stack: Set<object> = new Set()): boolean {
  if (typeof value !== "object" || value === null) return false;
  if (stack.has(value)) return true;
  stack.add(value);
  const found = Object.values(value).some((child) => isCircular(child, stack));
  stack.delete(value);
  return found;
}

export interface YamlComments {
  /** How many comments the text holds, not counting the `# yaml-language-server:` modeline. */
  count: number;
  /** The `# yaml-language-server: $schema=...` first-line modeline, when there is one. */
  modeline?: string;
}

/** Find the comments of a YAML text (they are lost when a command rewrites the file) and its editor modeline. */
export function scanYamlComments(source: string): YamlComments {
  const text = source.startsWith("﻿") ? source.slice(1) : source;
  let count = 0;
  let modeline: string | undefined;
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") {
      const token = value as { type?: unknown; source?: unknown; offset?: unknown };
      if (token.type === "comment" && typeof token.source === "string") {
        if (modeline === undefined && token.offset === 0 && /^#\s*yaml-language-server:/.test(token.source)) modeline = token.source;
        else count++;
      } else for (const child of Object.values(value)) visit(child);
    }
  };
  for (const token of new Parser().parse(text)) visit(token);
  return { count, ...(modeline === undefined ? {} : { modeline }) };
}
