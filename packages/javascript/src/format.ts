// Canonical OPF formatting: one key order and one text layout for every file.
//
// Key order follows the declaration order in the bundled OPF schema
// (`$schema`, `name`, ..., `slides`, `assets`, `catalogs`, `extensions` at the
// root; the same rule at every depth, through `$ref`, `oneOf`, `anyOf`,
// `allOf` and `then`/`else`). Keys the schema does not declare (extensions,
// catalog records, custom colours, unknown fields) follow the declared ones
// in their original relative order, so formatting never reorders user data
// that has no canonical order. Array order and every value are untouched.
// Text layout is two-space indentation, LF line endings, no BOM, one trailing
// newline. Formatting is idempotent: formatting formatted text changes nothing.
import { presentation } from "./schemas.js";

type Schema = Node | boolean;
interface Node {
  properties?: Record<string, Schema>;
  items?: Schema;
  additionalProperties?: Schema;
  $ref?: string;
  oneOf?: Schema[];
  anyOf?: Schema[];
  allOf?: Schema[];
  then?: Schema;
  else?: Schema;
  $defs?: Record<string, Schema>;
}

export class OPFFormatError extends Error {
  constructor(message: string) { super(message); this.name = "OPFFormatError"; }
}

export interface FormatOptions {
  /** Spaces per indentation level. Default 2. */
  indent?: number;
  /** Line endings: "lf" (default, canonical) or "crlf" (for Windows checkouts with autocrlf). */
  eol?: "lf" | "crlf";
}

const root = presentation as unknown as Node;
const flattenCache = new WeakMap<object, Node[]>();

function collect(schema: Schema | undefined, seen: Set<object>): Node[] {
  if (!schema || typeof schema !== "object" || seen.has(schema)) return [];
  seen.add(schema);
  const node = schema as Node;
  const out: Node[] = [node];
  if (typeof node.$ref === "string" && node.$ref.startsWith("#/$defs/")) out.push(...collect(root.$defs?.[node.$ref.slice("#/$defs/".length)], seen));
  for (const list of [node.oneOf, node.anyOf, node.allOf]) for (const branch of list ?? []) out.push(...collect(branch, seen));
  out.push(...collect(node.then, seen), ...collect(node.else, seen));
  return out;
}

/** The schema nodes that can describe a value at `schema`: itself plus every branch it references. */
function flatten(schema: Schema | undefined): Node[] {
  if (!schema || typeof schema !== "object") return [];
  const cached = flattenCache.get(schema);
  if (cached) return cached;
  const nodes = collect(schema, new Set());
  flattenCache.set(schema, nodes);
  return nodes;
}

const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

function arrange(value: unknown, schemas: Node[]): unknown {
  if (Array.isArray(value)) {
    const itemSchemas = schemas.flatMap(node => (node.items && typeof node.items === "object" ? flatten(node.items) : []));
    return value.map(item => arrange(item, itemSchemas));
  }
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const declared: string[] = [];
  const seen = new Set<string>();
  for (const node of schemas) for (const key of Object.keys(node.properties ?? {})) if (!seen.has(key)) { seen.add(key); declared.push(key); }
  const present = Object.keys(record);
  const ordered = [...declared.filter(key => own(record, key)), ...present.filter(key => !seen.has(key))];
  const out: Record<string, unknown> = {};
  for (const key of ordered) {
    let children = schemas.flatMap(node => (node.properties && own(node.properties, key) ? flatten(node.properties[key]) : []));
    if (!children.length && !seen.has(key)) children = schemas.flatMap(node => (node.additionalProperties && typeof node.additionalProperties === "object" ? flatten(node.additionalProperties) : []));
    // Define own data properties, including __proto__, without invoking prototype setters.
    Object.defineProperty(out, key, { value: arrange(record[key], children), enumerable: true, configurable: true, writable: true });
  }
  return out;
}

/** A copy of `document` with canonical key order at every depth. Values and array order are unchanged. */
export function sortPresentationKeys<T>(document: T): T {
  return arrange(document, flatten(root)) as T;
}

/**
 * Canonical text for an OPF document. `input` is either JSON source text or
 * a parsed document. Throws `OPFFormatError` for text that is not JSON.
 */
export function format(input: unknown, options: FormatOptions = {}): string {
  let document = input;
  if (typeof input === "string") {
    try { document = JSON.parse(input.replace(/^﻿/u, "")); }
    catch (error) { throw new OPFFormatError(`Invalid JSON: ${(error as Error).message}`); }
  }
  const indent = options.indent ?? 2;
  if (!Number.isInteger(indent) || indent < 0 || indent > 8) throw new OPFFormatError("indent must be an integer from 0 to 8.");
  if (options.eol !== undefined && options.eol !== "lf" && options.eol !== "crlf") throw new OPFFormatError("eol must be lf or crlf.");
  const text = JSON.stringify(sortPresentationKeys(document), null, indent);
  if (text === undefined) throw new OPFFormatError("Nothing to format.");
  return options.eol === "crlf" ? `${text.replaceAll("\n", "\r\n")}\r\n` : `${text}\n`;
}

/** True when `source` is already exactly the canonical text. */
export function isFormatted(source: string, options: FormatOptions = {}): boolean {
  try { return format(source, options) === source; } catch { return false; }
}
