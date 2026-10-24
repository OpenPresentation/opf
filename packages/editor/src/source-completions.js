// The completion engine of the source editor (artifacts/source-editor/SPEC.md, section 4): what the list offers at a position of a JSON draft, how it is
// ranked, and what accepting an item writes. Keys come from the schema (`describeField` of core), values from the schema's enums, booleans and the
// catalogs, templates for objects and lists, snippets for slides and the like. Loaded lazily by the code editor with the schema and the catalogs.
import { hasNextSnippetField, hasPrevSnippetField, pickedCompletion, snippet, startCompletion } from "@codemirror/autocomplete";
import { isolateHistory } from "@codemirror/commands";
import { EditorSelection } from "@codemirror/state";
import { describeField } from "@openpresentation/opf/schema";
import { listCatalogRecords, mergeCatalogs } from "./catalogs.js";
import { LAYOUT_INTENT_GROUPS, layoutRegionSummary } from "./layout-templates.js";
import { Document, parse as parseYamlDocument, parseDocument } from "yaml";
import { pathAt, scanMarkdown } from "@openpresentation/opf/source";
import { findNodeAtLocation, getNodeValue } from "jsonc-parser";
import { contextAt, nextSignificant, nodeAt, skeleton, tokenAt } from "./source-json.js";
import { PROMOTED_REGIONS, beatsOf, columnSourceFor, factsOf, jsonDeckParts, layoutKeys, referenceSiteAt, regionNames, slidePath, valueAt, variableNames, yamlDeckParts } from "./source-references.js";
import { beginUndoGroup, finishUndoGroup, takeUndoGroup } from "./source-undo-groups.js";
import { scalarValue, yamlContextAt } from "./source-yaml.js";
import { markdownContextAt, markdownOptions, markdownPlan, markdownHoverAt } from "./source-markdown.js";
import { childDoc, docNode, docText, fieldDoc } from "./source-docs.js";
import { keySnippetsFor, snippetJson, snippetYaml, snippetsFor } from "./source-snippets.js";

export { contextAt, tokenAt };

/** The context of the caret in a text of `format` ("json", "yaml" or "md"), or null: what the list offers, and the token it replaces. */
export function contextFor(format, text, position, explicit) {
  if (format === "yaml") {
    const context = yamlContextAt(text, position, { explicit });
    // A blank document starts with a deck.
    return context && context.mode === "key" && context.path.length === 0 && text.trim() === "" ? { ...context, blank: true } : context;
  }
  if (format === "md") return markdownContextAt(text, position, { explicit });
  return contextAt(text, position, { explicit });
}

/** The token being typed at `position` in a text of `format`, or null. */
export function tokenFor(format, text, position) {
  if (format === "json") return tokenAt(text, position, false);
  const context = contextFor(format, text, position, false);
  return context?.token ?? null;
}

// A quoted token keeps its list for any text between the quotes; a bare word for word characters only.
const QUOTED_TEXT = /^[^"\\\n\r]*$/;
const WORD_TEXT = /^[A-Za-z0-9_.-]*$/;
const MIN_ADVANCED_PREFIX = 3;

const KIND_LABELS = { layouts: "layout", themes: "theme", colorSchemes: "color scheme", fontSchemes: "font scheme", narratives: "narrative", audiences: "audience", purposes: "purpose", tones: "tone" };
const SOURCE_LABELS = { document: "In this document", registered: "Provided by app" };

const brief = (text) => {
  if (typeof text !== "string" || !text.trim()) return undefined;
  const flat = text.replace(/\s+/g, " ").trim();
  return /^.*?[.!?](?=\s|$)/.exec(flat)?.[0] ?? flat;
};

// ---- ranking ---------------------------------------------------------------------------------------------------------------------------
// CodeMirror adds `boost` (-99 to 99) to the match score. Prefix matches differ by hundreds from other matches, so the boost orders the items that
// match equally: the position in the list below, from 99 down.
const boostAt = (index) => Math.max(-99, 99 - index);

// ---- templates -------------------------------------------------------------------------------------------------------------------------
const primaryVariant = (info) => info.variants[info.primary] ?? info.variants[0];
const variantKind = (info) => {
  const variant = primaryVariant(info);
  if (!variant) return "any";
  if (variant.enum?.length || info.catalogKind) return "choice";
  return variant.type;
};

/**
 * The text inserted for a value of the field `info` describes, as a snippet template: `{ template, fields, chain }`. `first` is the number of the first
 * tab stop. A string with a closed set of values (an enum, a catalog id) is an empty string between quotes with the list of values opened inside;
 * a boolean leaves the place for `true` or `false` and opens that list; an object with required members writes them, one per line, each a tab stop.
 */
export function valueTemplate(info, first = 1) {
  const kind = variantKind(info);
  const variant = primaryVariant(info);
  if (kind === "choice") return { template: `"\${${first}}"`, fields: 1, chain: true };
  if (kind === "boolean") return { template: "", fields: 0, chain: true };
  if (kind === "number" || kind === "integer") return { template: `\${${first}}`, fields: 1, chain: false };
  if (kind === "array") return { template: `[\${${first}}]`, fields: 1, chain: false };
  if (kind === "object") {
    const required = variant?.requiredChildren?.length ? variant.requiredChildren : info.requiredChildren;
    if (!required.length) return { template: `{\${${first}}}`, fields: 1, chain: false };
    let next = first;
    const lines = required.map((key) => {
      const child = info.children.find((entry) => entry.key === key);
      const type = child?.types[0] ?? "string";
      const stop = next++;
      const value = type === "boolean" ? "false" : type === "array" ? "[]" : type === "object" ? "{}" : type === "number" || type === "integer" ? `\${${stop}:0}` : `"\${${stop}}"`;
      return `\t${JSON.stringify(key)}: ${value}`;
    });
    return { template: `{\n${lines.join(",\n")}\n}`, fields: next - first, chain: false };
  }
  return { template: `"\${${first}}"`, fields: 1, chain: false };
}

/** A snippet template as plain text, and where its first tab stop is (offset), for inserting at several cursors at once. */
function plainOf(template) {
  let first = -1, output = "";
  for (let index = 0; index < template.length;) {
    if (template[index] === "\\" && /[{}\\]/.test(template[index + 1] ?? "")) { output += template[index + 1]; index += 2; continue; }
    const match = /^[#$]\{(\d+)(?::((?:\\[{}\\]|[^{}\\])*))?\}/.exec(template.slice(index));
    if (match) {
      if (first < 0 && match[1] !== "0") first = output.length;
      output += (match[2] ?? "").replace(/\\([{}\\])/g, "$1");
      index += match[0].length;
      continue;
    }
    output += template[index++];
  }
  return { text: output, first: first < 0 ? output.length : first };
}

// ---- the options -----------------------------------------------------------------------------------------------------------------------
function advancedShown(children, typed, explicit) {
  if (!typed || typed.length < (explicit ? 1 : MIN_ADVANCED_PREFIX)) return false;
  return children.some((child) => child.advanced && child.key.toLowerCase().startsWith(typed));
}

/**
 * The keys of an object in the order the list shows them (SPEC 4.4): the required ones first, then, for a slide with a layout, the keys the layout's
 * regions call for that are not set yet, then the common order the schema gives (`children` arrives in that order and keeps it).
 */
function rankKeys(context, shown, catalogs) {
  const slide = context.path.length === 2 && context.path[0] === "slides" ? valueAt(context.document, context.path) : undefined;
  const layout = typeof slide?.layout === "string" ? slide.layout : undefined;
  let wanted = [];
  if (layout) {
    try {
      const record = listCatalogRecords(context.document, "layouts", { catalogs }).find((entry) => entry.id === layout)?.record;
      wanted = layoutKeys(record, shown.map((child) => child.key));
    } catch { wanted = []; }
  }
  const rank = (child) => (child.required ? 0 : wanted.includes(child.key) ? 1 : 2);
  return shown.map((child, index) => ({ child, index })).sort((a, b) => rank(a.child) - rank(b.child) || (rank(a.child) === 1 ? wanted.indexOf(a.child.key) - wanted.indexOf(b.child.key) : a.index - b.index)).map((entry) => entry.child);
}

function keyOptions(context, text, caret, explicit, catalogs) {
  const info = describeField(context.path, context.document);
  const typed = text.slice(context.token.from, caret).toLowerCase();
  const options = [];
  if (info.known) {
    const free = info.children.filter((child) => !context.existing.has(child.key));
    const withAdvanced = advancedShown(free, typed, explicit);
    const shown = rankKeys(context, free.filter((child) => !child.advanced || (withAdvanced && child.key.toLowerCase().startsWith(typed))), catalogs);
    // A blank document starts with a deck: its snippet comes first.
    if (context.blank) for (const entry of snippetsFor("value", [])) options.push(snippetOption(entry, 99));
    // A key a snippet is written for (the deck's `design`, `organization`, `speaker`) is accepted as that snippet, as VS Code does for a property
    // with default snippets: its members come with it, each a tab stop.
    const keySnippets = snippetsFor("key", context.path);
    const forKey = (key) => (context.flow ? undefined : keySnippetsFor(context.path).find((entry) => entry.key === key));
    shown.forEach((child, index) => options.push({
      label: child.key,
      type: "property",
      detail: child.required ? `${child.typeLabel} · required` : child.typeLabel,
      boost: boostAt(index + (context.blank ? 1 : 0)),
      opfRequired: child.required,
      opfDoc: child.description ?? "",
      opf: { kind: "key", key: child.key, ...(forKey(child.key) ? { snippet: child.key } : {}) },
      info: () => docNode(describeChild(context, child)),
    }));
    for (const entry of keySnippets) options.push(snippetOption(entry, boostAt(options.length)));
    // A key right after a list dash is also the start of the item: the item snippets (a slide, a reference) fit there.
    if (context.itemStart) for (const entry of snippetsFor("item", context.path)) options.push(snippetOption(entry, boostAt(options.length)));
    return { options, advanced: withAdvanced };
  }
  return { options, advanced: false };
}

function describeChild(context, child) {
  try {
    const info = describeField([...context.path, child.key], context.document);
    if (info.known) return { ...fieldDoc(info, child.key), description: child.description ?? info.description };
  } catch {
    // The card still shows what the list knows.
  }
  return childDoc(child);
}

function snippetOption(entry, boost) {
  return { label: entry.prefix, type: "snippet", detail: "snippet", boost, opfDoc: entry.description, opf: { kind: "snippet", prefix: entry.prefix }, info: () => docNode({ title: entry.prefix, type: "snippet", description: entry.description }) };
}

function literalOption(label, literal, extra) {
  return { label, type: extra.type ?? "enum", boost: extra.boost, detail: extra.detail, opfDoc: extra.doc ?? "", opf: { kind: "literal", literal, value: extra.value }, info: extra.info };
}

function catalogOptions(kind, context, catalogs) {
  let records = [];
  try { records = listCatalogRecords(context.document, kind, { catalogs }); } catch { records = []; }
  const order = (record) => {
    if (record.origin === "document") return -1;
    if (kind !== "layouts") return 0;
    const id = record.id.replace(/^default:/, "");
    const group = LAYOUT_INTENT_GROUPS.findIndex((entry) => entry.ids.includes(id));
    return group < 0 ? LAYOUT_INTENT_GROUPS.length * 100 : group * 100 + LAYOUT_INTENT_GROUPS[group].ids.indexOf(id);
  };
  records.sort((a, b) => order(a) - order(b) || a.label.localeCompare(b.label, "en", { numeric: true }) || a.id.localeCompare(b.id, "en"));
  const intent = kind === "layouts";
  return records.map((record, index) => {
    const regions = kind === "layouts" ? layoutRegionSummary(record.record) : "";
    const notes = [regions && `Regions: ${regions}`, SOURCE_LABELS[record.origin === "document" ? "document" : "registered"]].filter(Boolean);
    const model = { title: record.id, type: KIND_LABELS[kind], description: record.description ?? undefined, notes: [record.label !== record.id ? record.label : "", ...notes].filter(Boolean) };
    return literalOption(record.id, JSON.stringify(record.id), {
      value: record.id, type: "catalog", boost: intent || record.origin === "document" ? boostAt(index) : 0, detail: record.label !== record.id ? record.label : SOURCE_LABELS[record.origin === "document" ? "document" : "registered"],
      doc: [brief(record.description), regions].filter(Boolean).join(" "), info: () => docNode(model),
    });
  });
}

// ---- cross references (SPEC 3.4) --------------------------------------------------------------------------------------------------------
/**
 * Where the references of the document are read from, for the context: `facts()` the assets, datasets, variables, references and the narrative
 * (once), `read(path)` a value of the text being edited (a draft: undefined when the text does not say). `format` is the editor's: "json", "yaml"
 * or "md" (the deck of a Markdown text is its front matter).
 */
export function referenceScope(context, text, format) {
  let facts, parsed;
  const deckParts = () => {
    if (format === "json") return context.root ? jsonDeckParts(context.root, getNodeValue) : {};
    if (format === "md") {
      const front = scanMarkdown(text).frontMatter;
      return front ? yamlDeckParts(text.slice(front.yamlFrom, front.yamlTo)) : {};
    }
    return yamlDeckParts(text);
  };
  return {
    facts: () => (facts ??= factsOf(deckParts())),
    read(path) {
      if (format === "json") {
        const node = context.root ? findNodeAtLocation(context.root, path) : undefined;
        return node ? getNodeValue(node) : undefined;
      }
      if (parsed === undefined) {
        try { parsed = parseDocument(context.sourceText ?? text, { strict: false, uniqueKeys: false }).toJS({ maxAliasCount: -1 }); } catch { parsed = null; }
      }
      return valueAt(parsed, path.slice(context.prefix?.length ?? 0));
    },
  };
}

const REFERENCE_LABELS = { asset: "asset", dataset: "dataset", datasetColumn: "dataset column", cite: "reference", beat: "narrative beat", region: "layout region", color: "color variable" };
const referenceOption = (id, value, extra) => literalOption(id, JSON.stringify(value), { type: "reference", value, ...extra });

function referenceOptions(site, context, catalogs, scope) {
  const facts = scope.facts();
  const options = [];
  const add = (id, value, extra = {}) => options.push(referenceOption(id, value, { boost: boostAt(options.length), info: () => docNode({ title: id, type: REFERENCE_LABELS[site.kind], description: extra.doc || undefined, notes: [extra.detail].filter(Boolean) }), ...extra }));
  switch (site.kind) {
    case "asset":
      for (const asset of facts.assets) add(`asset:${asset.id}`, `asset:${asset.id}`, { detail: asset.detail || "asset", doc: asset.detail });
      for (const variable of facts.variables) if (variable.type === "image") add(`var:${variable.id}`, `var:${variable.id}`, { detail: "image variable" });
      break;
    case "dataset":
      for (const dataset of facts.datasets) add(dataset.id, dataset.id, { detail: dataset.title || `${dataset.columns.length} columns`, doc: dataset.columns.join(", ") });
      break;
    case "datasetColumn": {
      const source = columnSourceFor(site, (path) => scope.read(path));
      const columns = source?.dataset !== undefined ? facts.datasets.find((entry) => entry.id === source.dataset)?.columns : source?.inline;
      for (const column of columns ?? []) add(column, column, { detail: source.dataset !== undefined ? `column of ${source.dataset}` : "column" });
      break;
    }
    case "cite":
      for (const reference of facts.references) add(reference.id, reference.id, { detail: brief(reference.text) ?? "reference", doc: reference.text });
      break;
    case "beat": {
      let record;
      if (facts.narrative) {
        try { record = listCatalogRecords(context.document, "narratives", { catalogs }).find((entry) => entry.id === facts.narrative)?.record; } catch { record = undefined; }
      }
      for (const beat of beatsOf(record)) add(beat.id, beat.id, { detail: beat.name || "beat", doc: brief(beat.description) });
      break;
    }
    case "region": {
      const slide = slidePath(context.path);
      const layout = slide ? valueAt(context.document, slide)?.layout : undefined;
      let names = [];
      if (typeof layout === "string") {
        try { names = regionNames(listCatalogRecords(context.document, "layouts", { catalogs }).find((entry) => entry.id === layout)?.record); } catch { names = []; }
      }
      for (const name of names) add(name, name, { detail: `region of ${layout}` });
      for (const name of PROMOTED_REGIONS) if (!names.includes(name)) add(name, name, { detail: "promoted region" });
      break;
    }
    case "color":
      for (const variable of facts.variables) if (variable.type === "color") add(`var:${variable.id}`, `var:${variable.id}`, { detail: "color variable" });
      break;
    default:
  }
  return options;
}

// `{{name}}` in a text: the variables the document declares, offered once `{{` is typed. `before` is the text of the value before the caret.
const VARIABLE_OPEN = /\{\{([A-Za-z0-9._-]*)$/;
function variableOptions(scope) {
  const options = [];
  variableNames(scope.facts()).forEach((variable, index) => options.push({ label: variable.id, type: "reference", detail: `${variable.type} variable`, boost: boostAt(index), opfDoc: `The variable ${variable.id}`, opf: { kind: "variable", name: variable.id } }));
  return options;
}

/** The result for a caret right after `{{` in a text value, or null: the variable names, replacing what is typed after the braces. */
function variableResult(context, text, position, scope) {
  const token = context.token;
  if (!token || context.mode === "key") return null;
  const open = VARIABLE_OPEN.exec(text.slice(token.from, Math.min(position, token.to)));
  return open ? variableList(scope, position - open[1].length, position) : null;
}

function variableList(scope, from, position) {
  const options = variableOptions(scope);
  return options.length ? { from, to: position, filter: true, options, validFor: (typed) => /^[A-Za-z0-9._-]*$/.test(typed) } : null;
}

/**
 * The line under a list of catalog records when a group of the document names a source no registered catalog matches (SPEC 4.5): its records
 * beyond the embedded ones are not available here. Empty when every source is registered.
 */
export function unloadedFooter(document, catalogs) {
  const groups = document && typeof document === "object" ? document.catalogs : undefined;
  if (!groups || typeof groups !== "object") return "";
  let registered = [];
  try { registered = mergeCatalogs(catalogs).map((entry) => entry.source); } catch { registered = []; }
  const names = Object.entries(groups).filter(([name, group]) => name !== "custom" && group && typeof group === "object" && typeof group.source === "string" && !registered.includes(group.source)).map(([name]) => name);
  return names.length ? `Records from catalog ${names.join(", ")} are not loaded` : "";
}

function valueOptions(context, catalogs, scope) {
  const info = describeField(context.path, context.document);
  const options = [];
  if (!info.known) return { options };
  const variant = primaryVariant(info);
  const site = scope ? referenceSiteAt(context.path, context.document) : null;
  if (info.catalogKind) {
    const footer = unloadedFooter(context.document, catalogs);
    for (const option of catalogOptions(info.catalogKind, context, catalogs)) options.push(footer ? { ...option, opfFooter: footer } : option);
  }
  else if (info.enum?.length) {
    // In the order VS Code lists them: by label.
    info.enum.forEach((entry) => options.push(literalOption(String(entry.value), JSON.stringify(entry.value), {
      value: entry.value, doc: entry.description ?? "", info: entry.description ? () => docNode({ title: String(entry.value), type: "value", description: entry.description }) : undefined,
    })));
  } else if (info.types.includes("boolean")) {
    for (const value of ["true", "false"]) options.push(literalOption(value, value, { type: "boolean", value: value === "true" }));
  } else if (variant && !info.freeText && (variant.type === "object" || variant.type === "array") && context.format !== "yaml") {
    // An object or a list goes in as a template: `{}` with its required members, or `[]`.
    const label = variant.type === "object" ? "{}" : "[]";
    options.push({ label, type: "keyword", detail: variant.type === "object" ? "object" : "list", boost: 99, opfDoc: info.description ?? "", opf: { kind: "template" }, info: () => docNode(fieldDoc(info, context.key ?? label)) });
  }
  if (site) options.push(...referenceOptions(site, context, catalogs, scope));
  for (const entry of snippetsFor(context.mode, context.path)) options.push(snippetOption(entry, boostAt(options.length)));
  return { options };
}

// A word of a key, a value or an id: what the list stays valid for while the author types within the same token.
const YAML_KEY_TEXT = /^[A-Za-z0-9_.+-]*$/;
const YAML_VALUE_TEXT = /^[A-Za-z0-9_.:+-]*$/;

// In a YAML list the dash may start a mapping (a slide) or hold a scalar (an id, a line of text): the schema of the item tells.
function settleYamlContext(context, text) {
  if (context.mode === "key" && context.seq) {
    let info;
    try { info = describeField(context.path, context.document); } catch { info = null; }
    const primary = info?.known ? info.variants[info.primary] : undefined;
    if (!info?.known || !primary) return null;
    if (primary.type !== "object") {
      // The item is a scalar, not the mapping the line reader pictured: the schema reads the document with an empty string there.
      let parent = context.document;
      for (const step of context.path.slice(0, -1)) parent = parent?.[step];
      if (parent && typeof parent === "object") parent[context.path.at(-1)] = "";
      return { ...context, mode: "item", key: undefined, itemStart: false };
    }
  }
  return context;
}

/**
 * The completion result at `position` for CodeMirror, or null. `catalogs` are the host's; `format` is "json" (the default), "yaml" or "md".
 */
export function completionResult(state, position, { explicit, catalogs, format = "json" }) {
  const text = state.doc.toString();
  let context = contextFor(format, text, position, explicit);
  if (!context) return null;
  const scope = referenceScope(context, text, format);
  if (context.format === "md") return context.region === "variable" ? variableList(scope, context.token.from, position) : markdownResult(context, text, position, { explicit, catalogs, scope });
  if (context.format === "yaml") {
    context = settleYamlContext(context, text);
    if (!context) return null;
  }
  const variables = context.mode !== "key" ? variableResult(context, text, position, scope) : null;
  if (variables || context.multiline) return variables;
  const { options, advanced } = context.mode === "key" ? keyOptions(context, text, position, explicit, catalogs) : valueOptions(context, catalogs, scope);
  if (!options.length) return null;
  return listResult(context, options, advanced, { position, explicit });
}

function listResult(context, options, advanced, { position, explicit }) {
  const { token } = context;
  const quoted = token.quoted;
  const plainText = context.format !== "yaml" ? WORD_TEXT : context.mode === "value" || context.mode === "item" ? YAML_VALUE_TEXT : YAML_KEY_TEXT;
  // The result stays valid while the author types within the same token and the set of keys it shows does not change (advanced keys come and go
  // with the prefix).
  const sameSet = context.mode !== "key" ? () => true : (typed) => advancedShown(options.length ? infoChildren(context) : [], typed.toLowerCase(), explicit) === Boolean(advanced);
  return {
    from: token.from,
    // Filtered by the text before the caret, as VS Code does.
    to: Math.max(token.from, Math.min(position, token.to)),
    filter: true,
    options,
    validFor: (typed) => (quoted ? QUOTED_TEXT : plainText).test(typed) && sameSet(typed),
  };
}

function markdownResult(context, text, position, { explicit, catalogs, scope }) {
  const built = markdownOptions(context, { catalogs, explicit, text, position, scope, makers: { snippetOption, literalOption, boostAt, docNode, valueOptions, listCatalogRecords } });
  if (!built?.options.length) return null;
  const { token } = context;
  return {
    from: token.from,
    to: Math.max(token.from, Math.min(position, token.to)),
    filter: true,
    options: built.options,
    validFor: (typed) => (token.quoted ? QUOTED_TEXT : built.validFor ?? YAML_VALUE_TEXT).test(typed),
  };
}
function infoChildren(context) {
  try { return describeField(context.path, context.document).children.filter((child) => !context.existing.has(child.key)); } catch { return []; }
}

// ---- accepting -------------------------------------------------------------------------------------------------------------------------
const snippetRuns = new WeakMap();

// A YAML value as text: a plain scalar when it reads back as the same value, else quoted (the `yaml` library knows the cases: `true`, `1`, `a: b`).
function yamlScalar(value) {
  if (typeof value !== "string") return String(value);
  try { return new Document(value).toString({ lineWidth: 0 }).trimEnd() || '""'; } catch { return JSON.stringify(value); }
}
const yamlKey = (key) => (/^[A-Za-z_$][A-Za-z0-9_.$+-]*(?::[A-Za-z0-9_.$+-]+)*$/.test(key) ? key : yamlScalar(key));
const escapeTemplate = (text) => text.replace(/[\\{}]/g, (character) => `\\${character}`);

/** What accepting a key writes in YAML: `key: ` for a scalar, `key:` and a new line for a mapping or a list. */
function yamlKeyPlan(context, key, text, end, snippetKey) {
  const written = yamlKey(key);
  if (/^[ \t]*:/.test(text.slice(end))) return { template: escapeTemplate(written), fields: 0, chain: false };
  const entry = snippetKey ? keySnippetsFor(context.path).find((candidate) => candidate.key === snippetKey) : undefined;
  if (entry && !context.flow) {
    const rendered = snippetYaml(entry, { dash: 0 });
    return { template: rendered.text, fields: rendered.fields.length, chain: false, choices: rendered.fields };
  }
  let info;
  try { info = describeField([...context.path, key], context.document); } catch { info = null; }
  const kind = info?.known ? variantKind(info) : "string";
  if (context.flow || kind === "choice" || kind === "boolean" || !["array", "object"].includes(kind)) {
    return { template: `${escapeTemplate(written)}: `, fields: 0, chain: kind === "choice" || kind === "boolean" };
  }
  // A mapping or a list goes on the next line, one level in; after a dash the line's content starts two columns in, so the new lines do too.
  const dash = " ".repeat(Math.max(0, context.column - context.indent));
  const unit = "  ";
  const lead = `\n${dash}${unit}`;
  if (kind === "array") return { template: `${escapeTemplate(written)}:${lead}- \${0}`, fields: 1, chain: false };
  const variant = primaryVariant(info);
  const required = variant?.requiredChildren?.length ? variant.requiredChildren : info.requiredChildren;
  if (!required.length) return { template: `${escapeTemplate(written)}:${lead}\${0}`, fields: 1, chain: false };
  const lines = required.map((name, index) => `${yamlKey(name)}: \${${index + 1}}`);
  return { template: `${escapeTemplate(written)}:${lead}${lines.join(lead)}\${0}`, fields: required.length + 1, chain: false };
}

/** What accepting `completion` writes in YAML: `{ start, end, template, fields, chain, choices }`. */
function planYaml(context, completion, text, end) {
  const kind = completion.opf?.kind;
  if (kind === "key") return yamlKeyPlan(context, completion.opf.key, text, end, completion.opf.snippet);
  if (kind === "literal") {
    const value = completion.opf.value;
    const prefix = context.needsSpace ? " " : "";
    if (context.token.quoted) {
      const inner = typeof value === "string" ? value.replace(/\\/g, "\\\\").replace(/"/g, '\\"') : String(value);
      return { template: escapeTemplate(inner), fields: 0, chain: false, inner: true };
    }
    return { template: `${prefix}${escapeTemplate(yamlScalar(value))}`, fields: 0, chain: false };
  }
  if (kind === "snippet") {
    const mode = context.itemStart ? "item" : context.blank ? "value" : context.mode;
    const entry = snippetsFor(mode, context.path).find((candidate) => candidate.prefix === completion.opf.prefix);
    if (!entry) return null;
    const dash = " ".repeat(Math.max(0, context.column - context.indent));
    const rendered = snippetYaml(entry, { dash: context.seq ? dash.length : 0, blank: context.blank });
    return { template: rendered.text, fields: rendered.fields.length, chain: false, choices: rendered.fields };
  }
  return null;
}

/** What accepting `completion` writes: `{ template, fields, chain, choices }` for the context of the caret. */
export function planCompletion(context, completion, text, end) {
  if (context.format === "yaml") return planYaml(context, completion, text, end);
  if (context.format === "md") return markdownPlan(context, completion, text, end);
  const next = nextSignificant(text, end);
  const needsComma = next !== "" && !",}]".includes(next);
  const kind = completion.opf?.kind;
  if (kind === "key") {
    const key = completion.opf.key;
    const quoted = JSON.stringify(key);
    if (/^\s*:/.test(text.slice(end))) return { template: quoted, fields: 0, chain: false };
    const entry = completion.opf.snippet ? keySnippetsFor(context.path).find((candidate) => candidate.key === completion.opf.snippet) : undefined;
    if (entry) {
      const rendered = snippetJson(entry, { comma: needsComma });
      return { template: rendered.text, fields: rendered.fields.length, chain: false, choices: rendered.fields };
    }
    let info;
    try { info = describeField([...context.path, key], context.document); } catch { info = null; }
    const value = info?.known ? valueTemplate(info) : { template: '"${1}"', fields: 1, chain: false };
    const body = `${quoted}: ${value.template}${needsComma ? "," : ""}`;
    // The last stop is after the value: Tab leaves the string, the braces or the list.
    return { template: value.fields ? `${body}\${0}` : body, fields: value.fields, chain: value.chain };
  }
  if (kind === "literal") return { template: `${completion.opf.literal.replace(/[\\{}]/g, (character) => `\\${character}`)}${needsComma ? "," : ""}`, fields: 0, chain: false };
  if (kind === "template") {
    let info;
    try { info = describeField(context.path, context.document); } catch { info = null; }
    const value = info?.known ? valueTemplate(info) : { template: "{${1}}", fields: 1, chain: false };
    const template = value.template || "";
    return { template: `${template}${needsComma ? "," : ""}${value.fields ? "\${0}" : ""}`, fields: value.fields, chain: false };
  }
  if (kind === "snippet") {
    const entry = snippetsFor(context.mode, context.path).find((candidate) => candidate.prefix === completion.opf.prefix);
    if (!entry) return null;
    const rendered = snippetJson(entry, { comma: needsComma && !/^\s*:/.test(text.slice(end)) });
    return { template: rendered.text, fields: rendered.fields.length, chain: false, choices: rendered.fields };
  }
  return null;
}

/** Accept `completion`: write its text over the token under the caret (quotes included) and, if it has tab stops, start the snippet. */
export function applyCompletion(view, completion, fallbackFrom, fallbackTo, say, format = "json") {
  const { state } = view;
  const text = state.doc.toString();
  const main = state.selection.main;
  if (completion.opf?.kind === "variable") {
    // `{{na|` becomes `{{name}}`: the name replaces what was typed after the braces and the closing braces are written unless they are there.
    const to = text.startsWith("}}", fallbackTo) ? fallbackTo + 2 : fallbackTo;
    const insert = `${completion.opf.name}}}`;
    view.dispatch({ changes: { from: fallbackFrom, to, insert }, selection: { anchor: fallbackFrom + insert.length }, annotations: [pickedCompletion.of(completion), isolateHistory.of("full")], userEvent: "input.complete", scrollIntoView: true });
    return;
  }
  // A value accepted right after the key that opened its list is one undo step with that key (R-CMP-14).
  const group = takeUndoGroup(view);
  const context = contextFor(format, text, main.head, true);
  const token = context?.token;
  const start = token ? token.start : fallbackFrom, end = token ? token.end : fallbackTo;
  const plan = context ? planCompletion(context, completion, text, end) : null;
  // Accepting is one undo step: what is typed next starts another.
  const finish = (chain) => {
    view.dispatch({ annotations: isolateHistory.of("full") });
    if (group) finishUndoGroup(view, group);
    // A key whose value is one of a closed set opens that list at once.
    if (chain) { beginUndoGroup(view, state.doc); startCompletion(view); }
  };
  if (!plan) {
    view.dispatch({ changes: { from: fallbackFrom, to: fallbackTo, insert: completion.label }, selection: { anchor: fallbackFrom + completion.label.length }, annotations: [pickedCompletion.of(completion)], userEvent: "input.complete" });
    return;
  }
  if (state.selection.ranges.length > 1) { applyAtEveryCursor(view, completion, plan, format); return; }
  // A string between quotes that are already there keeps them: only what is inside is replaced. In the stop of a snippet the caret stays inside
  // the quotes, so Tab goes on to the next stop; elsewhere it ends after the closing quote.
  if (format === "json" && completion.opf?.kind === "literal" && token?.quoted && token.closed && completion.opf.literal.startsWith('"')) {
    const inner = completion.opf.literal.slice(1, -1);
    const inSnippet = snippetRuns.has(view) && (hasNextSnippetField(state) || hasPrevSnippetField(state));
    const next = nextSignificant(text, token.end);
    const changes = [{ from: token.from, to: token.to, insert: inner }];
    if (next !== "" && !",}]".includes(next)) changes.push({ from: token.end, insert: "," });
    const caret = inSnippet ? token.from + inner.length : token.end + inner.length - (token.to - token.from);
    view.dispatch({ changes, selection: { anchor: caret }, annotations: [pickedCompletion.of(completion)], userEvent: "input.complete", scrollIntoView: true });
    finish(false);
    return;
  }
  // YAML and Markdown values inside quotes: only the inside changes, and the caret ends after the closing quote.
  if (plan.inner && token) {
    const insert = plan.template.replace(/\\([{}\\])/g, "$1");
    const caret = token.closed ? token.end + insert.length - (token.to - token.from) : token.from + insert.length;
    view.dispatch({ changes: { from: token.from, to: token.to, insert }, selection: { anchor: caret }, annotations: [pickedCompletion.of(completion)], userEvent: "input.complete", scrollIntoView: true });
    finish(false);
    return;
  }
  const from = plan.replaceFrom ?? start, to = plan.replaceTo ?? end;
  if (plan.fields > 0 || plan.template.includes("${")) {
    snippet(plan.template)(view, completion, from, to);
    if (plan.choices) snippetRuns.set(view, { fields: plan.choices, index: -1 });
    else snippetRuns.delete(view);
    if (plan.choices) snippetStep(view, true, { start: true, say: say && ((message) => say(`Inserted ${completion.label}. ${message}`)) });
  } else {
    const insert = plan.template.replace(/\\([{}\\])/g, "$1");
    view.dispatch({ changes: { from, to, insert }, selection: { anchor: from + insert.length }, annotations: [pickedCompletion.of(completion)], userEvent: "input.complete", scrollIntoView: true });
    snippetRuns.delete(view);
  }
  finish(plan.chain);
}

// With several cursors the item goes in at each of them as plain text (no tab stops), each over its own token.
function applyAtEveryCursor(view, completion, plan, format) {
  const { state } = view;
  const text = state.doc.toString();
  const plain = plainOf(plan.template);
  const changes = [], carets = [];
  let shift = 0;
  for (const range of [...state.selection.ranges].sort((a, b) => a.from - b.from)) {
    const context = contextFor(format, text, range.head, true);
    const token = context?.token ?? { start: range.from, end: range.to };
    changes.push({ from: token.start, to: token.end, insert: plain.text });
    carets.push(token.start + shift + plain.first);
    shift += plain.text.length - (token.end - token.start);
  }
  view.dispatch({ changes, selection: EditorSelection.create(carets.map((position) => EditorSelection.cursor(position)), 0), annotations: [pickedCompletion.of(completion)], userEvent: "input.complete", scrollIntoView: true });
}

/**
 * A tab stop of the snippet just accepted was reached (`forward`: Tab, else Shift+Tab). Says which one, and opens the list of values at a stop
 * the snippet marks as a choice. `start` is the first stop. Returns whether a snippet is being walked.
 */
export function snippetStep(view, forward, { start = false, say } = {}) {
  const run = snippetRuns.get(view);
  if (!run) return false;
  run.index = start ? 0 : run.index + (forward ? 1 : -1);
  const total = run.fields.length;
  const announce = say;
  if (run.index >= total) {
    snippetRuns.delete(view);
    announce?.("End of snippet");
    return true;
  }
  if (run.index < 0) { run.index = 0; return true; }
  const stop = run.fields[run.index];
  announce?.(`Tab stop ${run.index + 1} of ${total}${stop.text ? `: ${stop.text}` : ""}`);
  if (stop.choice) startCompletion(view);
  return true;
}
export const snippetActive = (view) => snippetRuns.has(view);
export const forgetSnippet = (view) => snippetRuns.delete(view);

/** The plain description of an option for the live region. */
export const describeOption = (completion) => completion.opfDoc ?? "";
export { docText };

// ---- hover -----------------------------------------------------------------------------------------------------------------------------
// The key or value under a position of a YAML text, from core's `pathAt` (which reads text with errors as far as it can): the same shape
// as source-json.js's `nodeAt`, with the whole document read for the schema (hover waits 300 ms, so the cost does not matter).
function yamlNodeAt(text, position) {
  const found = pathAt(text, "yaml", position);
  if (!found?.range || (found.part !== "key" && found.part !== "value")) return null;
  const { offset, length } = found.range;
  const source = text.slice(offset, offset + length);
  const base = { path: found.path, from: offset, to: offset + length };
  let document = {};
  try { document = parseYamlDocument(text) ?? {}; } catch { document = {}; }
  if (found.part === "key") return { ...base, kind: "key", value: source, document };
  const collection = /^[[{]/.test(source);
  return { ...base, kind: "value", value: collection ? undefined : scalarValue(source), nodeType: collection ? (source[0] === "[" ? "array" : "object") : "scalar", document };
}

/**
 * What the schema and the catalogs say about the key or the value under `position`: `{ from, to, model }` (offsets of the token; `model` is a
 * source-docs.js card), or null over free text, punctuation and whitespace. `format` is "json", "yaml" or "md".
 */
export function hoverModelAt(state, position, { catalogs, format = "json" }) {
  const text = state.doc.toString();
  if (format === "md") return markdownHoverAt(text, position, { catalogs, describeFound });
  let found, document;
  if (format === "yaml") {
    found = yamlNodeAt(text, position);
    document = found?.document;
  } else {
    found = nodeAt(text, position);
    document = found ? skeleton(found.root, found.path, false) : undefined;
  }
  return found ? describeFound(found, document, catalogs) : null;
}

/** The card for a found node `{ kind, path, from, to, value, nodeType }` of a document (shared by the three formats). */
export function describeFound(found, document, catalogs) {
  let info;
  try { info = describeField(found.path, document); } catch { return null; }
  if (!info.known) return null;
  const name = String(found.path.at(-1));
  if (found.kind === "key") return { from: found.from, to: found.to, model: fieldDoc(info, name) };
  if (typeof found.value === "string" && info.catalogKind) {
    let record;
    try { record = listCatalogRecords(document, info.catalogKind, { catalogs }).find((entry) => entry.id === found.value); } catch { record = undefined; }
    if (!record) return { from: found.from, to: found.to, model: { title: found.value, type: `${KIND_LABELS[info.catalogKind]} id`, description: `No ${KIND_LABELS[info.catalogKind]} named ${found.value} is available here.` } };
    const regions = info.catalogKind === "layouts" ? layoutRegionSummary(record.record) : "";
    return { from: found.from, to: found.to, model: { title: record.id, type: KIND_LABELS[info.catalogKind], description: record.description, notes: [record.label !== record.id ? record.label : "", regions && `Regions: ${regions}`, SOURCE_LABELS[record.origin === "document" ? "document" : "registered"]].filter(Boolean) } };
  }
  if (info.enum?.length && ["string", "number", "boolean"].includes(typeof found.value)) {
    const entry = info.enum.find((candidate) => candidate.value === found.value);
    return { from: found.from, to: found.to, model: { ...fieldDoc(info, name), description: entry?.description ?? info.description } };
  }
  if (info.freeText || found.nodeType === "object" || found.nodeType === "array") return null;
  return { from: found.from, to: found.to, model: fieldDoc(info, name) };
}

/** A CodeMirror tooltip for `hoverModelAt`, or null. */
export function hoverAt(state, position, options) {
  const found = hoverModelAt(state, position, options);
  if (!found) return null;
  return { pos: found.from, end: found.to, above: true, create: () => ({ dom: docNode(found.model) }) };
}
