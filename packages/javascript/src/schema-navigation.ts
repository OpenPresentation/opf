/**
 * `@openpresentation/opf/schema`: the field model of an OPF document, read from the JSON Schemas.
 *
 * Two layers. The navigation helpers (`resolveSchema`, `schemaVariants`, `activeSchema`, `schemaAtPath`, `createSchemaValue`,
 * `listSchemaFields`, ...) move here from the editor so that the CLI, agents and every editor read the schemas one way. On top of
 * them, `describeField(path, document?)` answers what a source editor needs at any position (the types, enum values,
 * description, required members and ranked children of the node) and `catalogKindAt(path, document?)` names the catalog a
 * reference field points into, from `schemaCatalogKinds`, core-side metadata kept beside the schemas (the published schemas carry
 * no vendor keyword, so they compile under strict Ajv; the metadata never changes validation).
 *
 * Browser-safe: no `node:` imports. Types are deliberately loose (`JsonSchema`), the schemas being plain JSON.
 */
import { type CatalogRecordKind, catalogSchemaNames } from "./catalog-schemas.js";
import { formatPointer, parsePointer } from "./patch.js";
import { schemaCatalogKinds } from "./schema-catalog-kinds.js";
import { schemas } from "./schemas.js";

export { type SchemaNodeKey, schemaCatalogKinds } from "./schema-catalog-kinds.js";

// The schemas are plain JSON of unbounded shape; typing them closely would only restate JSON Schema.
// biome-ignore lint/suspicious/noExplicitAny: JSON Schema documents are untyped data.
export type JsonSchema = { [keyword: string]: any };
/** A path into a document: segments, a JSON Pointer (`/slides/0/title`) or a dotted path (`slides.0.title`). */
export type OpfPath = string | readonly (string | number)[];
export type SchemaRoot = JsonSchema;

const own = (object: unknown, key: string): boolean => object !== null && typeof object === "object" && Object.hasOwn(object, key);
const documents = new Map<string, JsonSchema>(Object.values(schemas).map((schema) => [(schema as JsonSchema).$id as string, schema as JsonSchema]));
const presentationSchema = schemas.presentation as JsonSchema;

// The catalog kind of a schema node is metadata beside the schemas (schemaCatalogKinds), never a keyword in them. It is found by
// the identity of the published node and carried on resolved copies under a symbol, so it survives the spreads that resolve and
// merge schemas, and stays invisible to JSON.stringify, Ajv and every key walk.
const CATALOG_KIND = Symbol.for("@openpresentation/opf:catalog-kind");
const catalogKindOfNode = new WeakMap<object, CatalogRecordKind>();
type Tagged = { [CATALOG_KIND]?: CatalogRecordKind };
const kindOfNode = (node: object): CatalogRecordKind | undefined => catalogKindOfNode.get(node) ?? (node as Tagged)[CATALOG_KIND];

/** The segments of a path: an array of segments, a JSON Pointer (starts with `/`, throws on a bad escape) or a dotted path. */
export function splitOpfPath(path: OpfPath): string[] {
  if (Array.isArray(path)) return path.map((segment) => String(segment));
  if (typeof path !== "string") throw new TypeError("An OPF path must be a string or an array of segments.");
  if (path === "") return [];
  if (path.startsWith("/")) return parsePointer(path);
  return path.split(".").filter(Boolean);
}

function readSchemaPointer(target: JsonSchema, pointer: string): JsonSchema | undefined {
  // biome-ignore lint/suspicious/noExplicitAny: walking untyped schema data.
  let current: any = target;
  for (const token of parsePointer(pointer)) {
    if (current === null || typeof current !== "object" || !own(current, token)) return undefined;
    current = current[token];
  }
  return current;
}

for (const [key, kind] of Object.entries(schemaCatalogKinds)) {
  const [name = "", pointer = ""] = key.split("#");
  const node = readSchemaPointer(schemas[name as keyof typeof schemas] as JsonSchema, pointer);
  if (node === undefined || node === null || typeof node !== "object") throw new Error(`schemaCatalogKinds: ${key} is not a schema node.`);
  catalogKindOfNode.set(node, kind);
}

// A reference that leaves its own document brings that document's relative references along: they are made absolute so that
// they keep resolving after the result is read against another root.
function absolutize(schema: unknown, id: string): unknown {
  if (Array.isArray(schema)) return schema.map((item) => absolutize(item, id));
  if (schema === null || typeof schema !== "object") return schema;
  const copy: JsonSchema = {};
  const kind = kindOfNode(schema);
  if (kind !== undefined) (copy as Tagged)[CATALOG_KIND] = kind;
  for (const [key, value] of Object.entries(schema)) copy[key] = key === "$ref" && typeof value === "string" && value.startsWith("#") ? `${id}${value}` : absolutize(value, id);
  return copy;
}

// An allOf of shaping members (the SlideDesign definition is Design plus a `not` constraint) reads as one schema: members are
// merged, properties included; constraint-only members (`not`, `required`) shape nothing a picker can show and are dropped.
function mergeAllOf(schema: JsonSchema, root: JsonSchema, seen: Set<string>): JsonSchema {
  if (!Array.isArray(schema.allOf)) return schema;
  const { allOf, ...base } = schema;
  let merged: JsonSchema = base;
  for (const member of allOf) {
    const resolved = resolveSchema(member, root, new Set(seen));
    if (!resolved.properties && !resolved.type && !resolved.oneOf && !resolved.anyOf) continue;
    merged = {
      ...resolved,
      ...merged,
      ...(resolved.properties || merged.properties ? { properties: { ...resolved.properties, ...merged.properties } } : {}),
    };
  }
  return merged;
}

/** Follow `$ref` (and merge `allOf`) until the schema is concrete. Siblings of a `$ref` (description, examples, `x-*`) win over the target. */
export function resolveSchema(schema: JsonSchema | undefined, root: SchemaRoot = presentationSchema, seen: Set<string> = new Set()): JsonSchema {
  const resolved = resolveNode(schema, root, seen);
  const kind = schema && typeof schema === "object" ? kindOfNode(schema) : undefined;
  return kind === undefined ? resolved : { ...resolved, [CATALOG_KIND]: kind };
}

function resolveNode(schema: JsonSchema | undefined, root: SchemaRoot, seen: Set<string>): JsonSchema {
  if (!schema || typeof schema !== "object") return {};
  if (!schema.$ref) return mergeAllOf(schema, root, seen);
  const ref = schema.$ref as string;
  if (seen.has(ref)) return {};
  seen.add(ref);
  const [id = "", fragment = ""] = ref.split("#");
  const target = id ? documents.get(id) : root;
  if (!target) throw new Error(`Unresolved OPF schema: ${ref}`);
  let resolved = fragment ? readSchemaPointer(target, fragment) : target;
  if (!resolved) throw new Error(`Unresolved OPF schema: ${ref}`);
  if (id && target !== root) resolved = absolutize(resolved, id) as JsonSchema;
  const { $ref: _ref, ...rest } = schema;
  return mergeAllOf({ ...resolveSchema(resolved, target, seen), ...rest }, target, seen);
}

/**
 * The concrete forms of a schema: `oneOf` / `anyOf` branches and `type` arrays expanded, each branch merged over the shared
 * base (properties and required lists are combined; a branch that only names required fields is labelled by them).
 */
export function schemaVariants(schema: JsonSchema | undefined, root: SchemaRoot = presentationSchema): JsonSchema[] {
  const resolved = resolveSchema(schema, root);
  if (Array.isArray(resolved.type)) return resolved.type.flatMap((type: string) => schemaVariants({ ...resolved, type }, root));
  const variants = resolved.oneOf ?? resolved.anyOf;
  if (!variants) return [resolved];
  const { $ref: _ref, oneOf: _oneOf, anyOf: _anyOf, ...base } = resolved;
  return (variants as JsonSchema[]).flatMap((child) =>
    schemaVariants(child, root).map((variant) => {
      // A branch that only names required fields (Watermark: exactly one of src and text) adds to the base's required list and is
      // labelled by them, so the generic form offers "src" and "text" as two forms of one object.
      const requiredOnly = !variant.type && !variant.properties && !variant.$ref && Array.isArray(variant.required);
      return {
        ...base,
        ...variant,
        properties: base.properties || variant.properties ? { ...base.properties, ...variant.properties } : undefined,
        ...(base.required || variant.required ? { required: [...new Set([...(base.required ?? []), ...(variant.required ?? [])])] } : {}),
        ...(requiredOnly && !variant.title ? { title: variant.required.join(" + ") } : {}),
      };
    }),
  );
}

/** The JSON type of a schema, inferred from its members when `type` is absent (and from `value` for an open schema). */
export function schemaType(schema: JsonSchema, value?: unknown): string {
  return (
    schema.type ??
    (schema.properties || schema.additionalProperties
      ? "object"
      : schema.items
        ? "array"
        : schema.const !== undefined
          ? typeof schema.const
          : value === null
            ? "null"
            : Array.isArray(value)
              ? "array"
              : typeof value === "undefined"
                ? "string"
                : typeof value)
  );
}

function score(schema: JsonSchema, value: unknown): number {
  const type = schemaType(schema, value);
  if (type === "integer" ? !Number.isInteger(value) : type === "array" ? !Array.isArray(value) : type === "null" ? value !== null : typeof value !== type || (type === "object" && (value === null || Array.isArray(value)))) return -100;
  if (own(schema, "const")) return JSON.stringify(schema.const) === JSON.stringify(value) ? 100 : -100;
  if (schema.enum && !schema.enum.includes(value)) return -100;
  let result = 1;
  const record = value as Record<string, unknown> | null | undefined;
  for (const [key, child] of Object.entries((schema.properties ?? {}) as Record<string, JsonSchema>)) {
    if (!record || !own(record, key)) continue;
    if (own(child, "const")) result += record[key] === child.const ? 100 : -1000;
    else result += 1;
  }
  for (const key of (schema.required ?? []) as string[]) if (!record || !own(record, key)) result -= 2;
  return result;
}

/** The variant of a schema that best fits a value (the first one when the value does not decide). */
export function activeSchema(schema: JsonSchema | undefined, value?: unknown, root: SchemaRoot = presentationSchema): JsonSchema {
  return schemaVariants(schema, root).sort((a, b) => score(b, value) - score(a, value))[0] ?? {};
}

const INDEX = /^(?:0|[1-9][0-9]*|-)$/;

function patternChild(schema: JsonSchema, key: string): JsonSchema | undefined {
  for (const [pattern, child] of Object.entries((schema.patternProperties ?? {}) as Record<string, JsonSchema>)) {
    try {
      if (new RegExp(pattern).test(key)) return child;
    } catch {
      // A pattern the engine cannot read describes nothing.
    }
  }
  return undefined;
}

/** The schema of the member `key` of a (resolved, single-variant) schema, or undefined when the schema declares no such member. */
function childSchema(schema: JsonSchema, key: string, value: unknown): JsonSchema | undefined {
  if (Array.isArray(value) || schema.type === "array") return schema.items ?? undefined;
  return schema.properties?.[key] ?? patternChild(schema, key) ?? (typeof schema.additionalProperties === "object" ? schema.additionalProperties : undefined);
}

// Which variant a path step goes through. The value decides when there is one (activeSchema); with none, the first variant is
// taken as before, unless it has no such member: `audience` is a string, an object or a list, and `audience/0` is the list.
function stepSchema(schema: JsonSchema, value: unknown, key: string, root: SchemaRoot): JsonSchema {
  const variants = schemaVariants(schema, root).sort((a, b) => score(b, value) - score(a, value));
  const first = variants[0] ?? {};
  if (value !== undefined || variants.length < 2 || childSchema(first, key, value) !== undefined) return first;
  return variants.find((variant) => (variant.type === "array" ? INDEX.test(key) && childSchema(variant, key, value) !== undefined : childSchema(variant, key, value) !== undefined)) ?? first;
}

interface Walk {
  /** The schema node at the path as written (a `$ref` stays one), `{}` when the path leaves the schema. */
  raw: JsonSchema;
  /** `raw`, resolved. */
  schema: JsonSchema;
  /** The root `$ref`s inside `schema` are relative to. */
  root: SchemaRoot;
  /** The single variant of the parent the last step went through. */
  parent: JsonSchema | undefined;
  /** The document value at the path. */
  value: unknown;
  known: boolean;
}

function walk(presentation: unknown, parts: readonly string[], rootSchema: SchemaRoot): Walk {
  let current: JsonSchema = rootSchema;
  let root = rootSchema;
  let value: unknown = presentation;
  let parent: JsonSchema | undefined;
  let known = true;
  for (let index = 0; index < parts.length; index++) {
    const key = parts[index] as string;
    const resolved = stepSchema(current, value, key, root);
    parent = resolved;
    let next: JsonSchema | undefined;
    // An embedded record (catalogs.<group>.<kind>.<id>) is described by the companion schema of its kind.
    const recordSchema = parts[0] === "catalogs" && index === 3 ? catalogSchemaNames[parts[2] as CatalogRecordKind] : undefined;
    if (recordSchema) {
      next = (schemas[recordSchema] as JsonSchema | undefined) ?? {};
      root = next;
    } else next = childSchema(resolved, key, value);
    if (next === undefined) {
      known = false;
      next = {};
    }
    current = next;
    value = value !== null && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
  }
  return { raw: current, schema: resolveSchema(current, root), root, parent, value, known };
}

/** The schema at a path of a document, resolved (`{}` for a path the schema does not describe). `path`: segments, a JSON Pointer or a dotted path. */
export function schemaAtPath(presentation: unknown, path: OpfPath, root: SchemaRoot = presentationSchema): JsonSchema {
  return walk(presentation, splitOpfPath(path), root).schema;
}

/** A short label for one variant of a union: its title, its `type` constant, its constant, or its type and first members. */
export function schemaLabel(schema: JsonSchema, index = 0): string {
  const type = schemaType(schema);
  return (
    schema.title ??
    schema.properties?.type?.const ??
    (schema.const !== undefined ? String(schema.const) : `${type}${schema.properties ? ` · ${Object.keys(schema.properties).slice(0, 3).join(", ")}` : ""}`) ??
    `Option ${index + 1}`
  );
}

/** A minimal valid starting value for a schema: constants, defaults, the first enum value, required members, minimum items. */
export function createSchemaValue(schema: JsonSchema | undefined, root: SchemaRoot = presentationSchema, depth = 0): unknown {
  if (depth > 20) throw new Error("Choose a shallower initial value for this recursive structure.");
  const variants = schemaVariants(schema, root);
  const s = variants[0] ?? {};
  if (own(s, "const")) return structuredClone(s.const);
  if (own(s, "default")) return structuredClone(s.default);
  if (s.enum?.length) return structuredClone(s.enum[0]);
  const type = schemaType(s);
  if (type === "object") {
    const value: Record<string, unknown> = {};
    const properties = (s.properties ?? {}) as Record<string, JsonSchema>;
    for (const key of new Set<string>([...(s.required ?? []), ...Object.keys(properties).filter((name) => own(properties[name], "const"))])) value[key] = createSchemaValue(properties[key] ?? {}, root, depth + 1);
    return value;
  }
  if (type === "array") return Array.from({ length: Math.min(s.minItems ?? 0, 100) }, () => createSchemaValue(s.items ?? {}, root, depth + 1));
  if (type === "boolean") return false;
  if (type === "null") return null;
  if (type === "number" || type === "integer") return s.minimum ?? (s.exclusiveMinimum !== undefined ? s.exclusiveMinimum + 1 : 0);
  if (s.examples?.length && typeof s.examples[0] === "string" && !s.examples[0].includes("...")) return s.examples[0];
  if (s.format === "uri") return "https://example.com";
  if (s.pattern?.includes("a-z")) return "example";
  return s.minLength ? "Text" : "";
}

export interface SchemaField {
  /** The schema name in `schemas` (`presentation`, `theme`, ...). */
  schema: string;
  /** JSON Pointer of the property inside the schema document. */
  path: string;
  name: string;
  description: string;
  reference: string | null;
  type: string | string[] | null;
  values: unknown[] | null;
}

/** Every documented property of every schema, flattened (for search and documentation). */
export function listSchemaFields(): SchemaField[] {
  const result: SchemaField[] = [];
  for (const [name, root] of Object.entries(schemas)) {
    const visit = (schema: JsonSchema | undefined, path: string[]): void => {
      if (!schema || typeof schema !== "object") return;
      for (const [key, child] of Object.entries((schema.properties ?? {}) as Record<string, JsonSchema>)) {
        result.push({
          schema: name,
          path: formatPointer([...path, "properties", key]),
          name: key,
          description: child.description ?? "",
          reference: child.$ref ?? null,
          type: child.type ?? null,
          values: child.enum ?? (own(child, "const") ? [child.const] : null),
        });
        visit(child, [...path, "properties", key]);
      }
      for (const [key, child] of Object.entries((schema.$defs ?? {}) as Record<string, JsonSchema>)) visit(child, [...path, "$defs", key]);
      for (const keyword of ["oneOf", "anyOf", "allOf"]) {
        const members = (schema[keyword] ?? []) as JsonSchema[];
        for (let index = 0; index < members.length; index++) visit(members[index], [...path, keyword, String(index)]);
      }
      if (schema.items) visit(schema.items, [...path, "items"]);
      if (typeof schema.additionalProperties === "object") visit(schema.additionalProperties, [...path, "additionalProperties"]);
      for (const [key, child] of Object.entries((schema.patternProperties ?? {}) as Record<string, JsonSchema>)) visit(child, [...path, "patternProperties", key]);
    };
    visit(root as JsonSchema, []);
  }
  return result;
}

// ---- Field model -----------------------------------------------------------------------------------------------------------------

/**
 * The common keys of the objects an author writes most, in the order a source editor offers them (SPEC 4.4). A key's `priority`
 * is its index here; every other key sorts after them, alphabetically. Keys that the schema does not have are skipped. This is
 * the one place the order lives: change it here, not in an editor.
 */
export const COMMON_KEYS: Readonly<{ deck: readonly string[]; slide: readonly string[]; design: readonly string[] }> = Object.freeze({
  /** The root of a document. */
  deck: Object.freeze(["name", "slides", "design", "language", "audience", "purpose", "tone", "narrative", "organization", "speaker"]),
  /** A slide (`slides[n]`). */
  slide: Object.freeze(["title", "subtitle", "layout", "items", "text", "notes", "image", "chart", "table", "quote", "code", "metric", "timeline", "blocks", "design", "id", "section", "tag", "hidden", "beat"]),
  /** `design`, on the deck and on a slide. */
  design: Object.freeze(["theme", "colorScheme", "fontScheme", "dimensions", "background", "header", "footer"]),
});

/** The sort position of a key that is in no `COMMON_KEYS` list. */
export const UNRANKED_PRIORITY = 1e6;

const DEFINITION_LISTS: Readonly<Record<string, readonly string[]>> = { Slide: COMMON_KEYS.slide, Design: COMMON_KEYS.design, SlideDesign: COMMON_KEYS.design };
const ADVANCED_KEYS: ReadonlySet<string> = new Set(["extensions", "$schema"]);
// A promoted region of a slide: one or more of top/middle/bottom, a colon, one or more of left/center/right (`top+middle:left+center`),
// or either half alone (`left`, `top+middle`).
const REGION_KEY = /^(?:(?:top|middle|bottom)(?:\+(?:top|middle|bottom))*)?(?::)?(?:(?:left|center|right)(?:\+(?:left|center|right))*)?$/;

/** Whether a slide key is a promoted region (`left`, `top+middle`, `top+middle:left+center`, ...): 48 keys of the slide schema, all `advanced`. */
export function isPromotedRegionKey(key: string): boolean {
  return key !== "" && key !== ":" && REGION_KEY.test(key);
}

export type { CatalogRecordKind };

export interface EnumValue {
  value: string | number | boolean | null;
  description?: string;
}

export interface VariantInfo {
  type: string;
  title?: string;
  enum?: EnumValue[];
  const?: unknown;
  /** Required members of this variant. */
  requiredChildren: string[];
  /** Names of this variant's properties, in schema order. */
  properties: string[];
  /** For an array: the types of its items joined with " | " (`string`, `object`, `string | object`). */
  itemsType?: string;
  /** For an array whose items are one `$defs` entry: that name (`Slide`). */
  itemsDefinition?: string;
}

export interface FieldChild {
  key: string;
  types: string[];
  /** `string`, `number`, `enum`, `Design` (a single `$defs` object), `array of Slide`, `array of string`, `choice` (several forms), ... */
  typeLabel: string;
  required: boolean;
  /** Hidden until the typed prefix matches: promoted regions, `extensions`, `$schema`. */
  advanced: boolean;
  /** Lower sorts first: the index in `COMMON_KEYS` for the object, `UNRANKED_PRIORITY` (1e6) otherwise. */
  priority: number;
  description?: string;
  catalogKind?: CatalogRecordKind;
  deprecated?: boolean;
  hasEnum: boolean;
}

export interface FieldInfo {
  known: boolean;
  path: (string | number)[];
  pointer: string;
  /** The last segment when it names a property (not an array index). */
  key?: string;
  types: string[];
  /** First paragraph of the description, plain text. */
  description?: string;
  fullDescription?: string;
  /** The `$defs` name when the schema is a `$ref` (`Design`). */
  definition?: string;
  required: boolean;
  deprecated?: boolean;
  examples: unknown[];
  default?: unknown;
  /** The union of all variants' enum values and constants. */
  enum?: EnumValue[];
  catalogKind?: CatalogRecordKind;
  variants: VariantInfo[];
  /** Index in `variants` of the form a template uses: a string, enum, boolean or number over an object over an array; else 0. */
  primary: number;
  /** Properties of the active object variant (all object variants merged when the document does not decide), ranked. */
  children: FieldChild[];
  /** For an array: the item schema described at `path + [next index]`. */
  itemInfo?: FieldInfo;
  /** For a map (`datasets`, `assets`, `variables`, `catalogs.<group>.layouts`, ...): the entry schema described at `path + ["*"]`. */
  entryInfo?: FieldInfo;
  /** Required members of the object form (those every candidate object variant requires). */
  requiredChildren: string[];
  /** A free-text string: no pattern, enum, format or catalog. An editor never opens a value list there. */
  freeText: boolean;
}

const uniq = <T>(items: readonly T[]): T[] => [...new Set(items)];

function variantType(variant: JsonSchema): string {
  if (typeof variant.type === "string") return variant.type;
  if (variant.properties || variant.additionalProperties) return "object";
  if (variant.items) return "array";
  if (variant.const !== undefined) return variant.const === null ? "null" : typeof variant.const;
  if (Array.isArray(variant.enum) && variant.enum.length) return variant.enum[0] === null ? "null" : typeof variant.enum[0];
  return "any";
}

const firstParagraph = (text: unknown): string | undefined => (typeof text === "string" && text.trim() ? (text.trim().split(/\n[ \t]*\n/)[0] ?? "").trim() : undefined);
const definitionOf = (raw: JsonSchema): string | undefined => (typeof raw.$ref === "string" ? /#\/\$defs\/([^/]+)$/.exec(raw.$ref)?.[1] : undefined);

function enumValues(variants: readonly JsonSchema[], inherited: unknown): EnumValue[] {
  const seen = new Map<string, EnumValue>();
  const add = (value: unknown, description?: string): void => {
    if (!(value === null || ["string", "number", "boolean"].includes(typeof value))) return;
    const id = JSON.stringify(value);
    if (!seen.has(id)) seen.set(id, { value: value as EnumValue["value"], ...(description ? { description } : {}) });
  };
  for (const variant of variants) {
    // A branch's own description labels its constant; one inherited from the shared base labels nothing in particular.
    const own = typeof variant.description === "string" && variant.description !== inherited ? firstParagraph(variant.description) : undefined;
    if (Array.isArray(variant.enum)) for (const value of variant.enum) add(value);
    else if (variant.const !== undefined) add(variant.const, own);
  }
  return [...seen.values()];
}

function catalogKindOf(schema: JsonSchema, variants: readonly JsonSchema[] = []): CatalogRecordKind | undefined {
  for (const candidate of [schema, ...variants]) {
    const kind = kindOfNode(candidate);
    if (kind !== undefined && own(catalogSchemaNames, kind)) return kind;
  }
  return undefined;
}

// The rank of a form for a template: simple values first, then an object, then a list.
const formRank = (variant: JsonSchema): number => {
  if (Array.isArray(variant.enum) || variant.const !== undefined) return 0;
  const type = variantType(variant);
  return type === "string" || type === "boolean" || type === "number" || type === "integer" ? 0 : type === "object" ? 1 : type === "array" ? 2 : 3;
};
function primaryIndex(variants: readonly JsonSchema[]): number {
  let best = 0;
  for (let index = 1; index < variants.length; index++) if (formRank(variants[index] as JsonSchema) < formRank(variants[best] as JsonSchema)) best = index;
  return best;
}

function typeLabelOf(raw: JsonSchema, variants: readonly JsonSchema[], root: SchemaRoot): string {
  if (variants.length > 1) return "choice";
  const variant = variants[0] ?? {};
  if (Array.isArray(variant.enum) && variant.enum.length > 1) return "enum";
  const type = variantType(variant);
  if (type === "array") {
    const items = (variant.items ?? {}) as JsonSchema;
    const name = definitionOf(items);
    if (name) return `array of ${name}`;
    const forms = uniq(schemaVariants(items, root).map(variantType));
    return `array of ${forms.length === 1 ? forms[0] : forms.length ? "choice" : "any"}`;
  }
  if (type === "object") return definitionOf(raw) ?? "object";
  return type;
}

function priorityOf(list: readonly string[] | undefined, key: string): number {
  const index = list ? list.indexOf(key) : -1;
  return index < 0 ? UNRANKED_PRIORITY : index;
}

interface ObjectForm {
  properties: Map<string, JsonSchema>;
  required: string[];
}

// The object variants that can describe the node: the one the document's value fits, or every one when it does not decide.
function objectForm(variants: readonly JsonSchema[], value: unknown): ObjectForm {
  const objects = variants.filter((variant) => variantType(variant) === "object");
  let used = objects;
  if (objects.length > 1 && value !== null && typeof value === "object" && !Array.isArray(value)) {
    const best = [...objects].sort((a, b) => score(b, value) - score(a, value))[0];
    if (best) used = [best];
  }
  const properties = new Map<string, JsonSchema>();
  for (const variant of used) for (const [key, child] of Object.entries((variant.properties ?? {}) as Record<string, JsonSchema>)) if (!properties.has(key)) properties.set(key, child);
  // A member is required when every candidate form requires it.
  const required = used.length ? ((used[0]?.required ?? []) as string[]).filter((key) => used.every((variant) => ((variant.required ?? []) as string[]).includes(key))) : [];
  return { properties, required };
}

function childrenOf(form: ObjectForm, list: readonly string[] | undefined, isSlide: boolean, root: SchemaRoot): FieldChild[] {
  const children: FieldChild[] = [];
  for (const [key, raw] of form.properties) {
    const resolved = resolveSchema(raw, root);
    const variants = schemaVariants(raw, root);
    const description = firstParagraph(resolved.description);
    const catalogKind = catalogKindOf(resolved, variants);
    children.push({
      key,
      types: uniq(variants.map(variantType)),
      typeLabel: typeLabelOf(raw, variants, root),
      required: form.required.includes(key),
      advanced: ADVANCED_KEYS.has(key) || (isSlide && isPromotedRegionKey(key)),
      priority: priorityOf(list, key),
      ...(description ? { description } : {}),
      ...(catalogKind ? { catalogKind } : {}),
      ...(resolved.deprecated === true ? { deprecated: true } : {}),
      hasEnum: variants.some((variant) => Array.isArray(variant.enum) || variant.const !== undefined),
    });
  }
  return children.sort(
    (a, b) =>
      Number(b.required) - Number(a.required) || Number(a.advanced) - Number(b.advanced) || a.priority - b.priority || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
}

function nodeSegments(path: OpfPath): { parts: string[]; shown: (string | number)[] } {
  const parts = splitOpfPath(path);
  const shown = Array.isArray(path) ? [...(path as (string | number)[])] : parts.map((part) => (/^(?:0|[1-9][0-9]*)$/.test(part) ? Number(part) : part));
  return { parts, shown };
}

const MAX_ITEM_DEPTH = 3;

function describeAt(presentation: unknown, path: OpfPath, depth: number): FieldInfo {
  let parts: string[];
  let shown: (string | number)[];
  try {
    ({ parts, shown } = nodeSegments(path));
  } catch {
    return unknownField(Array.isArray(path) ? [...path] : [], "");
  }
  const pointer = formatPointer(parts);
  const found = walk(presentation, parts, presentationSchema);
  if (!found.known) return unknownField(shown, pointer);
  const { raw, schema, root, parent, value } = found;
  const variants = schemaVariants(raw, root);
  const inherited = schema.description;
  const last = parts.at(-1);
  const parentIsArray = parent !== undefined && variantType(parent) === "array";
  const key = last !== undefined && !parentIsArray ? last : undefined;
  const definition = definitionOf(raw);
  const description = firstParagraph(schema.description);
  const enumList = enumValues(variants, inherited);
  const primary = primaryIndex(variants);
  const catalogKind = catalogKindOf(schema, variants);
  const form = objectForm(variants, value);
  const isRoot = parts.length === 0;
  const list = isRoot ? COMMON_KEYS.deck : definition ? DEFINITION_LISTS[definition] : undefined;
  const infos: VariantInfo[] = variants.map((variant) => {
    const type = variantType(variant);
    const items = type === "array" ? ((variant.items ?? {}) as JsonSchema) : undefined;
    const variantEnum = enumValues([variant], inherited);
    return {
      type,
      ...(typeof variant.title === "string" ? { title: variant.title } : {}),
      ...(variantEnum.length ? { enum: variantEnum } : {}),
      ...(variant.const !== undefined ? { const: variant.const } : {}),
      requiredChildren: [...((variant.required ?? []) as string[])],
      properties: Object.keys(variant.properties ?? {}),
      ...(items ? { itemsType: uniq(schemaVariants(items, root).map(variantType)).join(" | ") || "any" } : {}),
      ...(items && definitionOf(items) ? { itemsDefinition: definitionOf(items) } : {}),
    };
  });
  const primaryVariant = variants[primary] ?? {};
  const freeText =
    variantType(primaryVariant) === "string" &&
    primaryVariant.enum === undefined &&
    primaryVariant.const === undefined &&
    primaryVariant.pattern === undefined &&
    primaryVariant.format === undefined &&
    catalogKind === undefined;
  const info: FieldInfo = {
    known: true,
    path: shown,
    pointer,
    ...(key !== undefined ? { key } : {}),
    types: uniq(infos.map((variant) => variant.type)),
    ...(description ? { description } : {}),
    ...(typeof schema.description === "string" && schema.description.trim() ? { fullDescription: schema.description.trim() } : {}),
    ...(definition ? { definition } : {}),
    required: key !== undefined && Array.isArray(parent?.required) && parent.required.includes(key),
    ...(schema.deprecated === true ? { deprecated: true } : {}),
    examples: Array.isArray(schema.examples) ? [...schema.examples] : [],
    ...(own(schema, "default") ? { default: schema.default } : {}),
    ...(enumList.length ? { enum: enumList } : {}),
    ...(catalogKind ? { catalogKind } : {}),
    variants: infos,
    primary,
    children: childrenOf(form, list, definition === "Slide", root),
    requiredChildren: form.required,
    freeText,
  };
  const arrayVariant = variants.find((variant) => variantType(variant) === "array") ?? undefined;
  if (arrayVariant && depth < MAX_ITEM_DEPTH) {
    const next = Array.isArray(value) ? value.length : 0;
    info.itemInfo = describeAt(presentation, [...parts, String(next)], depth + 1);
    info.itemInfo.path = [...shown, next];
  }
  const mapVariant = variants.find((variant) => variantType(variant) === "object" && typeof variant.additionalProperties === "object");
  if (mapVariant && depth < MAX_ITEM_DEPTH) info.entryInfo = describeAt(presentation, [...parts, "*"], depth + 1);
  if (info.entryInfo) info.entryInfo.path = [...shown, "*"];
  return info;
}

function unknownField(path: (string | number)[], pointer: string): FieldInfo {
  return { known: false, path, pointer, types: [], required: false, examples: [], variants: [], primary: 0, children: [], requiredChildren: [], freeText: false };
}

/**
 * What the schema says about the node at `path`, for completion, hover and templates. `document` (optional) picks the active
 * `oneOf` variant by the value that is already there (otherwise the first form is taken) and sizes the next array index. A path
 * the schema does not describe returns `{ known: false, ... }`. Paths: segments, a JSON Pointer, or a dotted path; a trailing
 * `-` or the next index describes the item an array would take.
 */
export function describeField(path: OpfPath, document?: unknown): FieldInfo {
  return describeAt(document, path, 0);
}

/**
 * The catalog kind a field references (`layouts`, `themes`, `colorSchemes`, `fontSchemes`, `narratives`, `audiences`,
 * `purposes`, `tones`), read from `schemaCatalogKinds` for the schema node at `path`; undefined for every other field.
 * Languages are an engine vocabulary, not a catalog: `language` is not a reference.
 */
export function catalogKindAt(path: OpfPath, document?: unknown): CatalogRecordKind | undefined {
  let parts: string[];
  try {
    parts = splitOpfPath(path);
  } catch {
    return undefined;
  }
  const found = walk(document, parts, presentationSchema);
  return found.known ? catalogKindOf(found.schema, schemaVariants(found.raw, found.root)) : undefined;
}
