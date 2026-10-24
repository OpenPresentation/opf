// Go to definition, find references and rename for the ids of an OPF document (artifacts/source-editor/SPEC.md, section 8.3), as plain functions over the
// text. `analyze(text, format, { catalogs })` reads the text once (tolerantly: it may be broken or half typed) and lists every place an id is written as an
// occurrence; everything else (the symbol at an offset, its definition, its references, the edits of a rename) is a lookup in that list.
//
// An occurrence is `{ kind, id, role, scope, from, to, tokenFrom, tokenTo, lead, ... }`: `kind` is what the id names (`asset`, `variable`, `dataset`, `column`,
// `cite`, `slide`, `beat`, `region`, or a catalog kind such as `layouts`), `role` is `def` (where it is declared) or `ref` (where it is used), `scope` tells
// apart ids that are only unique inside something (a column of a dataset, a beat of a narrative, a record of a catalog group), `from`..`to` is the id itself
// (what a rename replaces) and `tokenFrom`..`tokenTo` the whole token a click or the caret has to be in (the quoted string, `asset:logo`, `{{name|upper}}`).
// Plain functions, no DOM.
import { catalogKinds, catalogReferenceSites, resolveReference, schemas } from "@openpresentation/opf";
import { mergeCatalogs } from "./catalogs.js";
import { childOf, nodeAtPath, plainOf, propOf, readDocument, readDocumentInPieces, yieldToBrowser } from "./source-navigation-read.js";
import { columnSourceFor, flatRegions, beatsOf, referenceSiteAt, valueAt } from "./source-references.js";

export const NOUNS = Object.freeze({
  asset: "asset", variable: "variable", dataset: "dataset", column: "dataset column", cite: "reference", slide: "slide", beat: "narrative beat", region: "layout region",
  layouts: "layout", themes: "theme", colorSchemes: "color scheme", fontSchemes: "font scheme", narratives: "narrative", audiences: "audience", purposes: "purpose", tones: "tone",
});

/** The kinds a rename can change (the ids the document itself declares). */
const RENAMABLE = new Set(["asset", "variable", "dataset", "cite", "slide", ...catalogKinds]);

const BUILT_IN = /^(?:speakers$|(?:deck|speaker|organization|slide)\.)/;
const TOKEN = /(?<![\w.:/-])(asset|var):([A-Za-z0-9][A-Za-z0-9._-]*)(?![A-Za-z0-9_\\-])/g;
const MUSTACHE = /\\?\{\{\s*([A-Za-z][A-Za-z0-9._-]*)\s*(?:\|[^{}\n]*)?\}\}/dg;
// Keys that name a column of a dataset (REFERENCE_RULES says which field takes which, and the schema decides: these are only the keys worth asking about).
const COLUMN_KEYS = new Set(["category", "x", "series", "line", "secondaryAxis", "fields"]);
// Subtrees whose strings are declarations or data, not uses.
const SKIP_WALK = new Set(["assets", "datasets", "variables", "catalogs", "extensions"]);

// ---- what an id looks like ----------------------------------------------------------------------------------------------------------
const definitions = schemas?.presentation?.$defs ?? {};
const fromSchema = (...path) => { let node = definitions; for (const step of path) node = node?.[step]; return typeof node === "string" ? new RegExp(node) : null; };
const SAFE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const LOOSE_HINT = "must start with a letter or a digit and use only letters, digits, '.', '_' and '-'";
const KEBAB_HINT = "must be lowercase: start with a letter, then lowercase letters, digits and '-'";
const KEBAB = /^[a-z][a-z0-9-]*$/;
const PATTERNS = {
  asset: { re: fromSchema("Assets", "propertyNames", "pattern") ?? SAFE, hint: LOOSE_HINT },
  dataset: { re: fromSchema("Datasets", "propertyNames", "pattern") ?? SAFE, hint: LOOSE_HINT },
  variable: { re: fromSchema("Variables", "propertyNames", "pattern") ?? KEBAB, hint: KEBAB_HINT },
  catalog: { re: fromSchema("CatalogRecords", "propertyNames", "pattern") ?? KEBAB, hint: KEBAB_HINT },
  // The schema leaves these two free; the editor keeps them to the characters that need no quoting in any of the three formats.
  cite: { re: SAFE, hint: LOOSE_HINT },
  slide: { re: SAFE, hint: LOOSE_HINT },
};
const patternFor = (kind) => PATTERNS[catalogKinds.includes(kind) ? "catalog" : kind];

/** A YAML plain scalar that would read as something other than text (`true`, `no`, `12`, `1e3`, `null`). */
const readsAsOther = (name) => /^(?:true|false|yes|no|on|off|y|n|null|~)$/i.test(name) || /^[-+]?(?:\.[0-9]|[0-9])[0-9_.eE+-]*$/.test(name) || /^0[xob][0-9a-f]+$/i.test(name);

// ---- lines --------------------------------------------------------------------------------------------------------------------------
function lineStarts(text) {
  const starts = [0];
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code === 13) { if (text.charCodeAt(index + 1) === 10) index++; starts.push(index + 1); } else if (code === 10) starts.push(index + 1);
  }
  return starts;
}

/** `{ number, from, to, text }` for the line (one-based) that holds `offset`. */
export function lineAt(analysis, offset) {
  const starts = analysis.lines ??= lineStarts(analysis.text);
  let low = 0, high = starts.length;
  while (low + 1 < high) {
    const middle = (low + high) >> 1;
    if (starts[middle] <= offset) low = middle; else high = middle;
  }
  const from = starts[low];
  let to = low + 1 < starts.length ? starts[low + 1] : analysis.text.length;
  while (to > from && (analysis.text[to - 1] === "\n" || analysis.text[to - 1] === "\r")) to--;
  return { number: low + 1, from, to, text: analysis.text.slice(from, to) };
}

/** The line (one-based `number`) as `lineAt` gives it, and how many lines the text has. */
export function lineByNumber(analysis, number) {
  const starts = analysis.lines ??= lineStarts(analysis.text);
  return lineAt(analysis, starts[Math.max(0, Math.min(starts.length - 1, number - 1))]);
}
export const lineCount = (analysis) => (analysis.lines ??= lineStarts(analysis.text)).length;

// ---- reading the occurrences --------------------------------------------------------------------------------------------------------
const stringValue = (node) => (node?.t === "string" ? node.value : undefined);

/**
 * Read `text` (`format`: "json", "yaml" or "md") once: `{ text, format, occurrences, root, catalogs }`. `catalogs` are the registered catalogs of the host.
 */
export function analyze(text, format, options = {}) {
  return analysisOf(text, format, readDocument(text, format), options);
}

/** `analyze` for the code editor: a big YAML text is read in pieces, with the main thread given back between them, so no task is as long as the text is big. */
export async function analyzeInPieces(text, format, options = {}) {
  const read = await readDocumentInPieces(text, format);
  await yieldToBrowser();
  return analysisOf(text, format, read, options);
}

function analysisOf(text, format, read, { catalogs = [] } = {}) {
  let registered = [];
  try { registered = mergeCatalogs(catalogs); } catch { registered = []; }
  const analysis = { text, format, root: read.root, scan: read.scan, catalogs: registered, occurrences: [], resolved: new Map() };
  if (read.root) collect(analysis);
  collectTokens(analysis);
  analysis.occurrences.sort((a, b) => a.from - b.from || a.tokenFrom - b.tokenFrom);
  return analysis;
}

function add(analysis, kind, id, role, from, to, extra = {}) {
  const occurrence = { kind, id, role, scope: "", from, to, tokenFrom: from, tokenTo: to, lead: "", ...extra };
  analysis.occurrences.push(occurrence);
  return occurrence;
}

// A declaration or a use written as a whole key or string: the token is the quoted text, the id its content.
function keyOccurrence(analysis, kind, prop, extra) {
  return add(analysis, kind, prop.key, "def", prop.cFrom, prop.cTo, { tokenFrom: prop.from, tokenTo: prop.to, blockTo: Math.max(prop.to, prop.value?.to ?? 0), bare: analysis.format !== "json" && prop.cFrom === prop.from, ...extra });
}

function stringOccurrence(analysis, kind, node, role, extra) {
  return add(analysis, kind, node.value, role, node.cFrom, node.cTo, { tokenFrom: node.from, tokenTo: node.to, bare: analysis.format !== "json" && !node.quoted && !node.block, ...extra });
}

function resolveCached(analysis, kind, reference, group) {
  const key = `${kind}\0${reference}\0${group ?? ""}`;
  if (analysis.resolved.has(key)) return analysis.resolved.get(key);
  let found;
  try { found = resolveReference({ catalogs: analysis.catalogsPlain ??= plainOf(childOf(analysis.root, "catalogs")) }, kind, reference, { catalogs: analysis.catalogs, ...(group ? { group } : {}) }); } catch { found = undefined; }
  analysis.resolved.set(key, found);
  return found;
}

const identityOf = (resolved) => (resolved ? `${resolved.group}:${resolved.id}` : null);

function collect(analysis) {
  const { root } = analysis;
  const prop = (key) => propOf(root, key);

  // Declarations -----------------------------------------------------------------------------------------------------------------------
  for (const [key, kind] of [["assets", "asset"], ["variables", "variable"]]) {
    const map = prop(key)?.value;
    if (map?.t === "object") for (const entry of map.props) keyOccurrence(analysis, kind, entry);
  }
  const datasets = prop("datasets")?.value;
  if (datasets?.t === "object") {
    for (const entry of datasets.props) {
      keyOccurrence(analysis, "dataset", entry);
      const columns = childOf(entry.value, "columns");
      if (columns?.t !== "array") continue;
      for (const column of columns.items) {
        const name = column.t === "string" ? column : childOf(column, "name");
        if (name?.t === "string" && name.value) stringOccurrence(analysis, "column", name, "def", { scope: entry.key });
      }
    }
  }
  const references = prop("references")?.value;
  if (references?.t === "array") for (const entry of references.items) { const id = childOf(entry, "id"); if (id?.t === "string" && id.value) stringOccurrence(analysis, "cite", id, "def"); }
  const groups = prop("catalogs")?.value;
  if (groups?.t === "object") {
    for (const group of groups.props) {
      if (group.value?.t !== "object") continue;
      for (const kind of catalogKinds) {
        const records = childOf(group.value, kind);
        if (records?.t !== "object") continue;
        for (const record of records.props) {
          keyOccurrence(analysis, kind, record, { scope: group.key });
          const identity = `${group.key}:${record.key}`;
          if (kind === "layouts") declareRegions(analysis, childOf(record.value, "regions"), identity);
          if (kind === "narratives") {
            const beats = childOf(record.value, "beats");
            if (beats?.t === "array") for (const beat of beats.items) { const id = childOf(beat, "id"); if (id?.t === "string" && id.value) stringOccurrence(analysis, "beat", id, "def", { scope: identity }); }
          }
        }
      }
    }
  }
  const slides = prop("slides")?.value;
  if (slides?.t === "array") {
    for (const slide of slides.items) { const id = childOf(slide, "id"); if (id?.t === "string" && id.value) stringOccurrence(analysis, "slide", id, "def"); }
  }

  // Uses of catalog ids (core lists every place the schema reads one) -------------------------------------------------------------------
  const narrativeNode = prop("narrative")?.value;
  const narrative = stringValue(narrativeNode) ? resolveCached(analysis, "narratives", narrativeNode.value) : undefined;
  const trimmed = {};
  for (const key of ["narrative", "audience", "purpose", "tone", "language", "design", "catalogs"]) if (prop(key)) trimmed[key] = plainOf(prop(key).value);
  trimmed.slides = (slides?.t === "array" ? slides.items : []).map((slide) => ({ layout: plainOf(childOf(slide, "layout")), design: plainOf(childOf(slide, "design")) }));
  let sites = [];
  try { sites = catalogReferenceSites(trimmed); } catch { sites = []; }
  for (const site of sites) {
    const node = nodeAtPath(root, site.path);
    if (node?.t !== "string" || !node.value) continue;
    const colon = node.value.indexOf(":");
    const resolved = resolveCached(analysis, site.kind, node.value, site.group);
    const group = resolved?.group ?? (colon > 0 ? node.value.slice(0, colon) : "default");
    const id = colon > 0 ? node.value.slice(colon + 1) : node.value;
    const raw = analysis.text.slice(node.cFrom, node.cTo);
    const exact = raw === node.value;
    const occurrence = stringOccurrence(analysis, site.kind, node, "ref", { scope: group, ref: node.value });
    occurrence.id = id;
    if (exact && colon > 0) { occurrence.from = node.cFrom + colon + 1; occurrence.bare = false; } else if (colon > 0) occurrence.lead = node.value.slice(0, colon + 1);
  }

  // Uses found by the name of the key ------------------------------------------------------------------------------------------------
  const layoutOf = (slide) => {
    const layout = stringValue(childOf(slide, "layout"));
    if (!layout || layout === "auto") return null;
    return { reference: layout, identity: identityOf(resolveCached(analysis, "layouts", layout)) };
  };
  const columns = [];
  const walk = (node, path, slide, layout) => {
    if (node.t === "array") { node.items.forEach((item, index) => { path.push(index); walk(item, path, slide, layout); path.pop(); }); return; }
    if (node.t !== "object") return;
    for (const entry of node.props) {
      const value = entry.value;
      if (!value || entry.key === "extensions" || (SKIP_WALK.has(entry.key) && path.length === 0)) continue;
      const strings = value.t === "string" ? [value] : value.t === "array" ? value.items.filter((item) => item.t === "string") : [];
      if (entry.key === "dataset" && value.t === "string" && value.value) stringOccurrence(analysis, "dataset", value, "ref");
      else if (entry.key === "cite") for (const item of strings) { if (item.value) stringOccurrence(analysis, "cite", item, "ref"); }
      else if (entry.key === "beat" && slide && path.length === 2) {
        for (const item of strings) if (item.value) stringOccurrence(analysis, "beat", item, "ref", { scope: identityOf(narrative) ?? "", ref: narrativeNode?.value });
      } else if (entry.key === "region" && slide && layout && value.t === "string") regionTokens(analysis, value, layout);
      else if (COLUMN_KEYS.has(entry.key)) {
        if (value.t === "string") columns.push({ path: [...path, entry.key], node: value });
        else if (value.t === "array") value.items.forEach((item, index) => { if (item.t === "string") columns.push({ path: [...path, entry.key, index], node: item }); });
      }
      if (value.t === "object" || value.t === "array") {
        path.push(entry.key);
        walk(value, path, slide, layout);
        path.pop();
      }
    }
  };
  for (const entry of root.props) {
    if (SKIP_WALK.has(entry.key) || !entry.value) continue;
    if (entry.key === "slides" && entry.value.t === "array") {
      entry.value.items.forEach((slide, index) => walk(slide, ["slides", index], true, layoutOf(slide)));
      continue;
    }
    walk({ t: "object", props: [entry] }, [], false, null);
  }
  if (columns.length) columnUses(analysis, columns);
}

// A layout's regions, nested ones included.
function declareRegions(analysis, regions, scope) {
  if (regions?.t !== "array") return;
  for (const region of regions.items) {
    const name = childOf(region, "name");
    if (name?.t === "string" && name.value) stringOccurrence(analysis, "region", name, "def", { scope });
    declareRegions(analysis, childOf(region, "regions"), scope);
  }
}

// `region` is a name or names joined by `+` and `:` (`left`, `top:left`, `middle+bottom`): each name is a use.
function regionTokens(analysis, node, layout) {
  if (!layout.identity) return;
  const raw = analysis.text.slice(node.cFrom, node.cTo);
  if (raw !== node.value) return;
  const re = /[A-Za-z0-9_-]+/g;
  for (let match = re.exec(raw); match; match = re.exec(raw)) {
    add(analysis, "region", match[0], "ref", node.cFrom + match.index, node.cFrom + match.index + match[0].length, { scope: layout.identity, ref: layout.reference });
  }
}

// Dataset columns named by chart and table fields: only where the schema says the field names columns (`referenceSiteAt`) and the dataset is known.
function columnUses(analysis, candidates) {
  const plain = plainOf(analysis.root, (key, depth) => depth === 0 && (key === "catalogs" || key === "assets"));
  const read = (path) => valueAt(plain, path);
  // The schema answers for the shape of a path, not for its indexes: one answer per shape.
  const shapes = new Map();
  for (const candidate of candidates) {
    if (!candidate.node.value) continue;
    const shape = candidate.path.map((step) => (typeof step === "number" ? "#" : step)).join("/");
    if (!shapes.has(shape)) { const site = referenceSiteAt(candidate.path, plain); shapes.set(shape, site?.kind === "datasetColumn" ? candidate.path.length - site.path.length : null); }
    const trim = shapes.get(shape);
    if (trim === null) continue;
    const source = columnSourceFor({ kind: "datasetColumn", path: candidate.path.slice(0, candidate.path.length - trim) }, read);
    if (source?.dataset !== undefined) stringOccurrence(analysis, "column", candidate.node, "ref", { scope: source.dataset });
  }
}

// `asset:id`, `var:id` and `{{name}}` are found in the text itself, wherever they are written (a title, a front matter value, a Markdown image).
function collectTokens(analysis) {
  const { text } = analysis;
  const skip = [];
  for (const fence of analysis.scan?.fences ?? []) if (fence.kind === "code") skip.push([fence.from, fence.to]);
  for (const comment of analysis.scan?.comments ?? []) if (comment.kind === "comment") skip.push([comment.from, comment.to]);
  const skipped = (index) => skip.some(([from, to]) => index >= from && index < to);
  const variables = new Set(analysis.occurrences.filter((o) => o.kind === "variable" && o.role === "def").map((o) => o.id));
  TOKEN.lastIndex = 0;
  for (let match = TOKEN.exec(text); match; match = TOKEN.exec(text)) {
    let id = match[2];
    while (id.endsWith(".")) id = id.slice(0, -1);
    if (!id || (skip.length && skipped(match.index))) continue;
    const from = match.index + match[1].length + 1;
    let tokenFrom = match.index, tokenTo = from + id.length;
    const quote = text[tokenFrom - 1];
    if ((quote === '"' || quote === "'") && text[tokenTo] === quote) { tokenFrom--; tokenTo++; }
    if (match[1] === "asset") add(analysis, "asset", id, "ref", from, from + id.length, { tokenFrom, tokenTo });
    else add(analysis, "variable", id, "ref", from, from + id.length, { tokenFrom, tokenTo, builtin: BUILT_IN.test(id) && !variables.has(id) });
  }
  MUSTACHE.lastIndex = 0;
  for (let match = MUSTACHE.exec(text); match; match = MUSTACHE.exec(text)) {
    if (match[0][0] === "\\" || (skip.length && skipped(match.index))) continue;
    const [from, to] = match.indices[1];
    add(analysis, "variable", match[1], "ref", from, to, { tokenFrom: match.index, tokenTo: match.index + match[0].length, builtin: BUILT_IN.test(match[1]) && !variables.has(match[1]), mustache: true });
  }
}

// ---- lookups ------------------------------------------------------------------------------------------------------------------------
/** The key two occurrences share when they are the same symbol. */
export const symbolKey = (occurrence) => `${occurrence.kind}\0${occurrence.scope}\0${occurrence.id}`;

/** The symbol under (or just before) `offset`: the occurrence whose token holds it, the smallest when several do. */
export function symbolAt(analysis, offset) {
  let best = null;
  for (const occurrence of analysis.occurrences) {
    if (occurrence.tokenFrom > offset || offset > occurrence.tokenTo) continue;
    // The id itself wins over the rest of its token (`asset:` of `asset:logo`), and a smaller token over a larger one.
    const inside = offset >= occurrence.from && offset <= occurrence.to;
    const span = occurrence.tokenTo - occurrence.tokenFrom;
    if (!best || (inside && !best.inside) || (inside === best.inside && span < best.span)) best = { occurrence, inside, span };
  }
  return best?.occurrence ?? null;
}

/** Every occurrence of the symbol of `occurrence`, in text order. */
export function occurrencesOf(analysis, occurrence) {
  const key = symbolKey(occurrence);
  return analysis.occurrences.filter((other) => symbolKey(other) === key);
}

/** The declarations of the symbol, in text order. */
export const declarationsOf = (analysis, occurrence) => occurrencesOf(analysis, occurrence).filter((other) => other.role === "def");

/**
 * Where the symbol is defined: `{ where: "document", occurrence }` (a declaration in the text), `{ where: "app", record, group, source, region?, beat? }` (a
 * record only a registered catalog has), `{ where: "built-in" }` or null (nothing defines it).
 */
export function definitionOf(analysis, occurrence) {
  if (occurrence.builtin) return { where: "built-in" };
  const declared = declarationsOf(analysis, occurrence)[0];
  if (declared) return { where: "document", occurrence: declared };
  if (catalogKinds.includes(occurrence.kind)) {
    const reference = occurrence.ref ?? occurrence.id;
    const resolved = resolveCached(analysis, occurrence.kind, reference);
    if (resolved?.origin === "host") return { where: "app", kind: occurrence.kind, reference, id: resolved.id, group: resolved.group, source: resolved.source, record: resolved.record };
    return null;
  }
  if (occurrence.kind === "region" || occurrence.kind === "beat") {
    const owner = occurrence.kind === "region" ? "layouts" : "narratives";
    const resolved = occurrence.ref ? resolveCached(analysis, owner, occurrence.ref) : undefined;
    if (resolved?.origin !== "host") return null;
    const found = occurrence.kind === "region" ? flatRegions(resolved.record).find((region) => region.name === occurrence.id) : beatsOf(resolved.record).find((beat) => beat.id === occurrence.id);
    return found ? { where: "app", kind: occurrence.kind, reference: occurrence.ref, id: occurrence.id, group: resolved.group, source: resolved.source, record: resolved.record, member: found } : null;
  }
  return null;
}

/** Why a rename cannot happen for this symbol, or "". */
export function renameBlocker(analysis, occurrence, { readOnly = false } = {}) {
  const label = `${NOUNS[occurrence.kind] ?? occurrence.kind} ${occurrence.id}`;
  if (readOnly) return "Cannot rename: the editor is read-only";
  if (occurrence.builtin) return `Cannot rename: ${occurrence.id} is a built-in variable`;
  if (!RENAMABLE.has(occurrence.kind)) return `Cannot rename: a ${NOUNS[occurrence.kind]} is named where it is declared, in the ${occurrence.kind === "column" ? "dataset" : occurrence.kind === "region" ? "layout" : "narrative"} record`;
  if (!declarationsOf(analysis, occurrence).length) {
    if (catalogKinds.includes(occurrence.kind) && definitionOf(analysis, occurrence)?.where === "app") return `Cannot rename: ${label} is provided by the app`;
    return `Cannot rename: ${label} is not declared in this document`;
  }
  return "";
}

/** The message for a name the symbol cannot take, or "". */
export function validateName(analysis, occurrence, name) {
  if (!name || !name.trim()) return "The name cannot be empty";
  if (name === occurrence.id) return "";
  const pattern = patternFor(occurrence.kind);
  if (pattern && !pattern.re.test(name)) return `A ${NOUNS[occurrence.kind]} id ${pattern.hint}`;
  const taken = analysis.occurrences.some((other) => other.role === "def" && other.kind === occurrence.kind && other.scope === occurrence.scope && other.id === name);
  if (taken) return `${NOUNS[occurrence.kind][0].toUpperCase()}${NOUNS[occurrence.kind].slice(1)} ${name} already exists`;
  return "";
}

/**
 * The edits that rename the symbol to `name`: `{ edits: [{ from, to, insert }], caret: [from, to] }` (`caret` is the renamed symbol at the occurrence given,
 * as offsets of the text after the edits), or null when the name is the same. The edits are in offsets of the current text and do not overlap.
 */
export function renameEdits(analysis, occurrence, name) {
  if (name === occurrence.id) return null;
  const all = occurrencesOf(analysis, occurrence);
  const edits = [];
  for (const other of all) {
    const quote = analysis.format !== "json" && other.bare && readsAsOther(name);
    edits.push({ from: other.from, to: other.to, insert: quote ? `"${name}"` : `${other.lead}${name}`, other });
  }
  edits.sort((a, b) => a.from - b.from);
  let shift = 0, caret = [occurrence.from, occurrence.to];
  for (const edit of edits) {
    if (edit.other === occurrence) {
      const quoted = edit.insert.startsWith('"') && edit.other.bare;
      caret = [edit.from + shift + (quoted ? 1 : edit.other.lead.length), edit.from + shift + edit.insert.length - (quoted ? 1 : 0)];
    }
    shift += edit.insert.length - (edit.to - edit.from);
  }
  return { edits: edits.map(({ from, to, insert }) => ({ from, to, insert })), caret };
}

/** The one-based number of the slide that holds `offset`, or null. */
export function slideNumberAt(analysis, offset) {
  const slides = childOf(analysis.root, "slides");
  if (slides?.t !== "array") return null;
  let low = 0, high = slides.items.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1, slide = slides.items[middle];
    if (offset < slide.from) high = middle - 1; else if (offset > slide.to) low = middle + 1; else return middle + 1;
  }
  return null;
}

/** The references of the symbol for a list: the declarations first, then the uses in text order. */
export function referenceList(analysis, occurrence) {
  const all = occurrencesOf(analysis, occurrence);
  return [...all.filter((other) => other.role === "def"), ...all.filter((other) => other.role !== "def")];
}
