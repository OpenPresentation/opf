// Cross-references inside the document as completion values (artifacts/source-editor/SPEC.md, section 3.4): `asset:<id>` from `assets`, dataset ids
// and column names from `datasets`, `var:<id>` and `{{name}}` from `variables`, `cite` ids from `references`, `beat` ids from the deck's narrative and
// `region` names from the slide's layout. Which field takes which kind of reference is ONE table (`REFERENCE_RULES`) read against the schema: a rule
// names the schema definitions whose fields are references (`Asset`, `DatasetId`, ...) and the property names, with a phrase the property's own
// description must carry (any of `phrases`), for the fields written inline in their parent. test/source-completions-units.mjs checks every entry against the schema,
// so a renamed definition or a reworded description fails the test instead of silently dropping a list. Plain functions, no DOM.
import { parse as parseYaml } from "yaml";
import { describeField } from "@openpresentation/opf/schema";

/**
 * The rules. `definitions`: a field whose own schema is that definition (`$defs` name). `keys` + `phrases`: a string field with one of those property
 * names whose description contains one of the phrases. `item`: the field is a list (or a string or a list) and every entry is a reference.
 */
export const REFERENCE_RULES = Object.freeze([
  { kind: "asset", definitions: ["Asset", "LogoSource", "ImageSource"], keys: ["src", "logo", "watermark"], phrases: ["asset:<id>", "or Asset"] },
  { kind: "dataset", definitions: ["DatasetId"], keys: [], phrases: [] },
  { kind: "datasetColumn", definitions: ["DatasetFields"], keys: ["category", "x", "series", "line", "secondaryAxis"], phrases: ["column"], item: true },
  { kind: "cite", definitions: [], keys: ["cite"], phrases: ["references"], item: true },
  { kind: "beat", definitions: [], keys: ["beat"], phrases: ["narrative"], item: true },
  { kind: "region", definitions: [], keys: ["region"], phrases: ["template layout"] },
  { kind: "color", definitions: ["ColorRef"], keys: ["color"], phrases: ["var:<id>"] },
]);

/** The promoted regions of a slide a block can be pinned to (the lower-case names the `region` pattern accepts). */
export const PROMOTED_REGIONS = Object.freeze(["top", "middle", "bottom", "left", "center", "right"]);

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isIndex = (segment) => typeof segment === "number" || /^(?:0|[1-9]\d*)$/.test(String(segment));

function ruleOf(info, key) {
  if (!info?.known || !(info.types.includes("string") || info.types.includes("array"))) return null;
  for (const rule of REFERENCE_RULES) {
    if (info.definition && rule.definitions.includes(info.definition)) return rule;
    if (key !== undefined && rule.keys.includes(key) && rule.phrases.some((phrase) => (info.fullDescription ?? info.description ?? "").includes(phrase))) return rule;
  }
  return null;
}

/**
 * What the value at `path` of `document` references: `{ kind, path }` (`path` is the field, for a list entry the list's), or null. A list entry
 * (`cite: ["a", |]`, `fields: [|]`) is the entry of the list field the rule names; a field that can only be a list takes its references one by one.
 */
export function referenceSiteAt(path, document) {
  if (!Array.isArray(path) || !path.length) return null;
  const last = path.at(-1);
  const describe = (at) => { try { return describeField(at, document); } catch { return null; } };
  if (!isIndex(last)) {
    const info = describe(path);
    const rule = ruleOf(info, String(last));
    const listOnly = info?.types.length === 1 && info.types[0] === "array";
    return rule && !listOnly ? { kind: rule.kind, path } : null;
  }
  // An entry whose own schema is a reference definition (`chart.colors[i]`: a ColorRef) is a reference whatever the list is called.
  const own = describe(path);
  const byDefinition = own?.known && own.definition ? REFERENCE_RULES.find((rule) => rule.definitions.includes(own.definition)) : undefined;
  if (byDefinition && !own.types.every((type) => type === "array")) return { kind: byDefinition.kind, path };
  const field = path.slice(0, -1);
  while (field.length && isIndex(field.at(-1))) field.pop();
  if (!field.length) return null;
  const rule = ruleOf(describe(field), String(field.at(-1)));
  return rule?.item ? { kind: rule.kind, path: field } : null;
}

// ---- the facts of a document -------------------------------------------------------------------------------------------------------
const stringOf = (value) => (typeof value === "string" ? value : undefined);
const columnName = (column) => (typeof column === "string" ? column : isObject(column) && typeof column.name === "string" ? column.name : undefined);

/**
 * The parts of a deck the references read, from the plain value of the top level (`assets`, `datasets`, `variables`, `references`, `narrative`):
 * `{ assets: [{ id, detail }], datasets: [{ id, title, columns }], variables: [{ id, type }], references: [{ id, text }], narrative }`.
 * Anything else the value holds, and anything malformed, is ignored: the text being edited is a draft.
 */
export function factsOf(deck) {
  const out = { assets: [], datasets: [], variables: [], references: [], narrative: undefined };
  if (!isObject(deck)) return out;
  if (isObject(deck.assets)) {
    for (const [id, asset] of Object.entries(deck.assets)) out.assets.push({ id, detail: stringOf(asset) ?? stringOf(asset?.src) ?? stringOf(asset?.title) ?? "" });
  }
  if (isObject(deck.datasets)) {
    for (const [id, dataset] of Object.entries(deck.datasets)) {
      const columns = Array.isArray(dataset?.columns) ? dataset.columns.map(columnName).filter(Boolean) : [];
      out.datasets.push({ id, title: stringOf(dataset?.title) ?? "", columns });
    }
  }
  if (isObject(deck.variables)) {
    for (const [id, variable] of Object.entries(deck.variables)) {
      // A hex string is shorthand for a color variable.
      const type = typeof variable === "string" ? "color" : stringOf(variable?.type) ?? "color";
      out.variables.push({ id, type });
    }
  }
  if (Array.isArray(deck.references)) {
    for (const reference of deck.references) if (isObject(reference) && typeof reference.id === "string" && reference.id) out.references.push({ id: reference.id, text: stringOf(reference.text) ?? "" });
  }
  out.narrative = stringOf(deck.narrative);
  return out;
}

/** The top-level parts of a JSON draft the references read (`root` is a jsonc-parser tree), as a plain value for `factsOf`. */
export function jsonDeckParts(root, getNodeValue) {
  const deck = {};
  if (root?.type !== "object") return deck;
  for (const property of root.children ?? []) {
    const key = property.children?.[0]?.value, value = property.children?.[1];
    if (!value || !["assets", "datasets", "variables", "references", "narrative"].includes(key)) continue;
    if (key === "datasets" && value.type === "object") {
      // Only the names and the columns: the rows can be the bulk of a deck.
      deck.datasets = {};
      for (const entry of value.children ?? []) {
        const id = entry.children?.[0]?.value, body = entry.children?.[1];
        if (typeof id !== "string" || body?.type !== "object") continue;
        const columns = (body.children ?? []).find((child) => child.children?.[0]?.value === "columns")?.children?.[1];
        const title = (body.children ?? []).find((child) => child.children?.[0]?.value === "title")?.children?.[1];
        deck.datasets[id] = { columns: columns ? getNodeValue(columns) : [], title: title?.type === "string" ? title.value : undefined };
      }
    } else deck[key] = getNodeValue(value);
  }
  return deck;
}

const TOP_LEVEL = ["assets", "datasets", "variables", "references", "narrative"];

/** The text of the top-level blocks of a YAML text that hold the keys the references read, parsed (tolerant: a broken block gives nothing). */
export function yamlDeckParts(text) {
  const lines = text.split(/\r\n|\r|\n/);
  const deck = {};
  for (let number = 0; number < lines.length; number++) {
    const match = /^([A-Za-z]+)\s*:/.exec(lines[number]);
    if (!match || !TOP_LEVEL.includes(match[1])) continue;
    let end = number + 1;
    while (end < lines.length && (lines[end].trim() === "" || /^[ \t]/.test(lines[end]) || lines[end].startsWith("- "))) end++;
    try {
      const value = parseYaml(lines.slice(number, end).join("\n"), { strict: false, uniqueKeys: false });
      if (isObject(value) && match[1] in value) deck[match[1]] = value[match[1]];
    } catch { /* A block that does not parse offers nothing. */ }
  }
  return deck;
}

/** `value` at `path` of a plain document, or undefined. */
export function valueAt(value, path) {
  let current = value;
  for (const step of path) {
    if (current === null || typeof current !== "object") return undefined;
    current = current[step];
  }
  return current;
}

/**
 * What a column field reads its names from: `{ dataset }` (the id of the dataset: a `dataset` beside the field, or the chart's `data.dataset`) or
 * `{ inline }` (the `columns` of the chart's own `data`), looking outward from the field; null when the draft says neither. `read(path)` gives a
 * value of the document.
 */
export function columnSourceFor(site, read) {
  for (let depth = site.path.length - 1; depth >= 0; depth--) {
    const owner = site.path.slice(0, depth);
    const direct = read([...owner, "dataset"]);
    if (typeof direct === "string") return { dataset: direct };
    const via = read([...owner, "data", "dataset"]);
    if (typeof via === "string") return { dataset: via };
    const inline = read([...owner, "data", "columns"]);
    if (Array.isArray(inline)) return { inline: inline.map(columnName).filter(Boolean) };
  }
  return null;
}

/** The names of the regions of a layout record a block can be pinned to (the title and the subtitle are not regions of the body). */
export function regionNames(record) {
  const names = [];
  const walk = (regions) => {
    for (const region of Array.isArray(regions) ? regions : []) {
      if (typeof region?.name === "string" && region.name !== "title" && region.name !== "subtitle") names.push(region.name);
      if (region?.regions) walk(region.regions);
    }
  };
  walk(record?.regions);
  return names;
}

/** The regions of a layout record in reading order (nested ones included) as `{ name, accepts }`. */
export function flatRegions(record) {
  const out = [];
  const walk = (regions) => {
    for (const region of Array.isArray(regions) ? regions : []) {
      if (typeof region?.name === "string") out.push({ name: region.name, accepts: Array.isArray(region.accepts) ? region.accepts : [] });
      if (region?.regions) walk(region.regions);
    }
  };
  walk(record?.regions);
  return out;
}

// The slide key that holds content of a kind a region accepts.
const PAYLOAD_KEYS = { text: "text", list: "items", image: "image", video: "video", chart: "chart", table: "table", quote: "quote", code: "code", metric: "metric", timeline: "timeline" };

/**
 * The slide keys a layout's regions call for, in region order: a region named like a slide key (`title`, `items`) calls for that key; any other region
 * that accepts one or two kinds of content (`media`: image, video) for the keys of those kinds. `keys` are the slide keys that exist.
 */
export function layoutKeys(record, keys) {
  const wanted = [];
  const add = (key) => { if (keys.includes(key) && !wanted.includes(key)) wanted.push(key); };
  for (const region of flatRegions(record)) {
    if (keys.includes(region.name)) add(region.name);
    else if (region.accepts.length > 0 && region.accepts.length <= 2) for (const kind of region.accepts) add(PAYLOAD_KEYS[kind]);
  }
  return wanted;
}

/** The ids of the beats of a narrative record. */
export function beatsOf(record) {
  return (Array.isArray(record?.beats) ? record.beats : []).filter((beat) => isObject(beat) && typeof beat.id === "string").map((beat) => ({ id: beat.id, name: stringOf(beat.name) ?? "", description: stringOf(beat.description) ?? "" }));
}

/**
 * The names of the variables a `{{` in text can reference: the document's own, with their type. (The built-in `organization.*`, `speaker.*` and
 * `deck.*` variables are not offered: they are not declared in the document.)
 */
export function variableNames(facts) {
  return facts.variables.map((variable) => ({ id: variable.id, type: variable.type }));
}

/** The slide a path of a deck sits in: `["slides", n]`, or null. */
export function slidePath(path) {
  return path[0] === "slides" && isIndex(path[1]) ? [path[0], Number(path[1])] : null;
}
