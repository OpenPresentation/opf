// Dimension switches (FF-16, font-fidelity-everywhere). One operation per pptx.gallery
// dimension that turns "switch this dimension to X" into a validated JSON Patch, and applies
// it to an editor session as one undoable transaction. The preview recomposes and the PPTX
// export follows from the same document, so no dimension needs a special refresh path.
import { catalogSchemaNames, catalogs as bundledCatalogs, schemas } from "@openpresentation/opf";
import {
  OPFEditorError,
  createValuePatch,
  applyJsonPatch,
  getValueAtPath,
  opfPathToJsonPointer,
  splitOpfPath,
  validateOpfDocument,
} from "./index.js";
import { createContentBlock, prepareBlockReplace } from "./blocks.js";
import { populateLayoutPlaceholders } from "./layout-placeholders.js";

/** The 14 pptx.gallery dimensions (gallery-support.md), in the gallery's order. */
export const SWITCH_DIMENSIONS = Object.freeze([
  "layouts",
  "color-schemes",
  "font-schemes",
  "languages",
  "backgrounds",
  "narratives",
  "charts",
  "themes",
  "audiences",
  "tones",
  "socials",
  "headers-footers",
  "blocks",
  "image-treatments",
]);

// Catalog kind behind each catalog-backed dimension.
const CATALOG_KIND = Object.freeze({
  layouts: "layouts",
  "color-schemes": "colorSchemes",
  "font-schemes": "fontSchemes",
  languages: "languages",
  narratives: "narratives",
  themes: "themes",
  audiences: "audiences",
  tones: "tones",
  socials: "socialPlatforms",
  charts: "chartTypes",
});
// Top-level document field for the simple metadata dimensions.
const ROOT_FIELD = Object.freeze({ languages: "language", narratives: "narrative", tones: "tone", audiences: "audience" });
// `design` keys for the design dimensions. A key set to `null` in the value is removed.
const DESIGN_KEYS = Object.freeze({
  "color-schemes": ["colorScheme"],
  "font-schemes": ["fontScheme"],
  backgrounds: ["background"],
  "headers-footers": ["header", "footer"],
  "image-treatments": ["slideImage", "imageFill"],
});
const REGION = /^(?:(?:top|middle|bottom)(?:\+(?:top|middle|bottom))*(?::(?:left|center|right)(?:\+(?:left|center|right))*)?|(?:left|center|right)(?:\+(?:left|center|right))*)$/;
const BLOCK_KINDS = ["text", "list", "chart", "table", "metric", "quote", "code", "timeline", "group", "image", "video"];

function fail(code, message, details) {
  return new OPFEditorError(code, message, details);
}

function same(a, b) {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

function recordList(source) {
  const records = Array.isArray(source) ? source : source?.records;
  return Array.isArray(records) ? records.filter((record) => record && typeof record.id === "string") : [];
}

// Inline document records first (they override), then caller-loaded records, then the
// bundled catalog. Unlike getCatalogRecords, an inline catalog never hides bundled ids.
function findCatalogRecord(document, kind, id, options) {
  return (
    recordList(document.catalogs?.[kind]).find((record) => record.id === id) ??
    recordList(options.catalogs?.[kind] ?? options.catalogSources?.[kind]).find((record) => record.id === id) ??
    (options.record?.id === id ? options.record : undefined) ??
    bundledCatalogs[kind]?.find((record) => record.id === id)
  );
}

function requireCatalogId(document, dimension, id, options) {
  const kind = CATALOG_KIND[dimension];
  if (typeof id !== "string" || id.length === 0)
    throw fail("invalid-catalog-id", `Switch ${dimension} to a non-empty catalog id.`, { dimension, id });
  const record = findCatalogRecord(document, kind, id, options);
  if (!record) throw fail("unknown-catalog-id", `Unknown ${kind} catalog ID: ${id}.`, { dimension, catalogKind: kind, id });
  return record;
}

// A gallery item supplies its own record; add it inline in the same transaction when the
// document and the bundled catalog do not already define the id.
function catalogRecordPatches(document, dimension, options) {
  const record = options.record;
  if (!record) return [];
  const kind = CATALOG_KIND[dimension];
  if (recordList(document.catalogs?.[kind]).some((entry) => entry.id === record.id) || bundledCatalogs[kind]?.some((entry) => entry.id === record.id)) return [];
  const value = { $schema: schemas[catalogSchemaNames[kind]].$id, ...record };
  if (!document.catalogs || typeof document.catalogs !== "object") return [{ op: "add", path: "/catalogs", value: { [kind]: { records: [value] } } }];
  if (!document.catalogs[kind] || typeof document.catalogs[kind] !== "object")
    return [{ op: "add", path: `/catalogs/${kind}`, value: { records: [value] } }];
  if (!Array.isArray(document.catalogs[kind].records)) return [{ op: "add", path: `/catalogs/${kind}/records`, value: [value] }];
  return [{ op: "add", path: `/catalogs/${kind}/records/-`, value }];
}

function slideAt(document, slideIndex, what = "this switch") {
  if (!Number.isInteger(slideIndex) || !document.slides?.[slideIndex])
    throw fail("slide-index-out-of-range", `Choose an existing slide for ${what}.`, { slideIndex });
  return document.slides[slideIndex];
}

function rootPatch(document, field, value) {
  return same(document[field], value) ? [] : createValuePatch(document, [field], value);
}

// Set (value) or remove (null) design keys at deck or slide scope.
function designPatches(document, base, entries) {
  const design = getValueAtPath(document, base.length ? [...base, "design"] : ["design"]);
  const at = (key) => opfPathToJsonPointer([...base, "design", key]);
  const set = Object.entries(entries).filter(([, value]) => value !== undefined && value !== null);
  if (!design || typeof design !== "object" || Array.isArray(design))
    return set.length ? [{ op: "add", path: opfPathToJsonPointer([...base, "design"]), value: structuredClone(Object.fromEntries(set)) }] : [];
  const patches = [];
  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined) continue;
    const present = Object.hasOwn(design, key);
    if (value === null) {
      if (present) patches.push({ op: "remove", path: at(key) });
    } else if (!present) patches.push({ op: "add", path: at(key), value: structuredClone(value) });
    else if (!same(design[key], value)) patches.push({ op: "replace", path: at(key), value: structuredClone(value) });
  }
  return patches;
}

// A deck-level switch does nothing for a slide that carries its own value for that key.
function shadowedSlides(document, keys) {
  return (document.slides ?? []).flatMap((slide, index) => (keys.some((key) => slide?.design?.[key] !== undefined) ? [index] : []));
}

function findChartOwner(document, slideIndex) {
  const visit = (node, path, depth) => {
    if (!node || typeof node !== "object" || Array.isArray(node) || depth > 32) return undefined;
    if (node.chart && typeof node.chart === "object") return path;
    if (Array.isArray(node.blocks))
      for (const [index, block] of node.blocks.entries()) {
        const found = visit(block, [...path, "blocks", String(index)], depth + 1);
        if (found) return found;
      }
    for (const [key, value] of Object.entries(node)) {
      if (!REGION.test(key)) continue;
      const found = visit(value, [...path, key], depth + 1);
      if (found) return found;
    }
    return undefined;
  };
  return visit(document.slides[slideIndex], ["slides", String(slideIndex)], 0);
}

function socialsPatches(document, value, options) {
  const owner = options.owner ?? "speaker";
  if (!["speaker", "organization"].includes(owner)) throw fail("invalid-switch-value", "Socials owner must be 'speaker' or 'organization'.", { owner });
  if (!value || typeof value !== "object" || typeof value.platform !== "string" || typeof value.handle !== "string" || !value.handle)
    throw fail("invalid-switch-value", "Switch socials to { platform, handle } with a non-empty handle.", { value });
  requireCatalogId(document, "socials", value.platform, options);
  const host = document[owner];
  const index = Array.isArray(host) ? (options.index ?? 0) : undefined;
  const target = Array.isArray(host) ? host[index] : host;
  if (!target || typeof target !== "object")
    throw fail("missing-owner", `Add the ${owner} to the document before setting their socials.`, { owner });
  const base = Array.isArray(host) ? [owner, String(index)] : [owner];
  const socials = target.socials;
  const patches = catalogRecordPatches(document, "socials", options);
  if (!socials || typeof socials !== "object") return [...patches, { op: "add", path: opfPathToJsonPointer([...base, "socials"]), value: { [value.platform]: value.handle } }];
  if (socials[value.platform] === value.handle) return patches;
  return [...patches, { op: Object.hasOwn(socials, value.platform) ? "replace" : "add", path: opfPathToJsonPointer([...base, "socials", value.platform]), value: value.handle }];
}

function blockValue(value, options) {
  if (typeof value === "string") {
    if (!BLOCK_KINDS.includes(value)) throw fail("invalid-switch-value", `Unknown content block kind: ${value}.`, { value });
    return createContentBlock(value, { source: options.source });
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw fail("invalid-switch-value", "Switch blocks to a content kind or a block object.", { value });
  return value;
}

/**
 * Compute the patch that switches one dimension, without touching any session. The candidate
 * document is validated; an invalid result throws unless the input was already invalid.
 */
export function prepareDimensionSwitch(document, dimension, value, options = {}) {
  if (!SWITCH_DIMENSIONS.includes(dimension))
    throw fail("unknown-dimension", `Unknown dimension: ${dimension}. Use one of ${SWITCH_DIMENSIONS.join(", ")}.`, { dimension });
  if (!document || typeof document !== "object") throw fail("invalid-input", "Switch requires an OPF document object.");
  if (options.record) {
    const ids = dimension === "audiences" ? [value].flat() : dimension === "socials" ? [value?.platform] : [value];
    if (!CATALOG_KIND[dimension] || !ids.includes(options.record.id))
      throw fail("record-id-mismatch", `The supplied record id must equal a switched ${dimension} id.`, { dimension, id: options.record.id });
  }
  const before = validateOpfDocument(document);
  const scopeIndex = options.slideIndex;
  let patches = [];
  let scope = "deck";
  let shadowed = [];
  let slideIndex;

  if (dimension === "layouts") {
    slideIndex = scopeIndex;
    slideAt(document, slideIndex, "a layout switch");
    scope = "slide";
    const record = requireCatalogId(document, dimension, value, options);
    patches = catalogRecordPatches(document, dimension, options);
    const withRecord = patches.length ? applyJsonPatch(document, patches) : document;
    if (withRecord.slides[slideIndex].layout !== value) {
      const layoutOps = createValuePatch(withRecord, ["slides", String(slideIndex), "layout"], value);
      const swapped = applyJsonPatch(withRecord, layoutOps);
      const types = Array.isArray(record.placeholders) ? record.placeholders.map((placeholder) => placeholder.type) : undefined;
      // Add the blank payloads the layout declares, as the JSON editor's layout choice does.
      const populated = types ? populateLayoutPlaceholders(swapped, slideIndex, types) : swapped;
      patches = same(populated.slides[slideIndex], swapped.slides[slideIndex])
        ? [...patches, ...layoutOps]
        : [...patches, { op: "replace", path: `/slides/${slideIndex}`, value: populated.slides[slideIndex] }];
    }
  } else if (dimension === "charts") {
    slideIndex = scopeIndex;
    slideAt(document, slideIndex, "a chart switch");
    scope = "slide";
    requireCatalogId(document, dimension, value, options);
    const owner = options.path ? splitOpfPath(options.path) : findChartOwner(document, slideIndex);
    if (options.path && (owner[0] !== "slides" || owner[1] !== String(slideIndex)))
      throw fail("path-slide-mismatch", "options.path is not on the slide named by options.slideIndex.", { slideIndex, path: options.path });
    const chart = owner && getValueAtPath(document, [...owner, "chart"]);
    if (!chart || typeof chart !== "object") throw fail("chart-not-found", "This slide has no chart to switch. Insert a chart block first.", { slideIndex, path: options.path });
    patches = [...catalogRecordPatches(document, dimension, options), ...(chart.type === value ? [] : createValuePatch(document, [...owner, "chart", "type"], value))];
  } else if (dimension === "blocks") {
    if (options.path === undefined) throw fail("missing-path", "Choose the block to replace with options.path.");
    const block = blockValue(value, options);
    const change = prepareBlockReplace(document, options.path, block);
    patches = change.changed ? change.patches : [];
    const parts = splitOpfPath(options.path);
    if (parts[0] === "slides") slideIndex = Number(parts[1]);
    scope = "block";
  } else if (dimension === "socials") {
    patches = socialsPatches(document, value, options);
  } else if (ROOT_FIELD[dimension]) {
    const field = ROOT_FIELD[dimension];
    let next = value;
    if (dimension === "audiences") {
      next = Array.isArray(value) ? value : [value];
      if (!next.length) throw fail("invalid-catalog-id", "Switch audiences to at least one catalog id.", { value });
      for (const id of next) requireCatalogId(document, dimension, id, options);
    } else requireCatalogId(document, dimension, value, options);
    patches = [...catalogRecordPatches(document, dimension, options), ...rootPatch(document, field, next)];
  } else {
    // Design dimensions: deck scope by default, or one slide with options.slideIndex.
    let entries;
    if (dimension === "themes") {
      const record = requireCatalogId(document, dimension, value, options);
      entries = { theme: value };
      if (options.bundle !== false) {
        // The gallery's theme snippet writes the whole bundle, so an explicit deck choice
        // does not keep the previous theme's fonts, colors or background.
        for (const key of ["colorScheme", "fontScheme", "background", "dimensions"]) if (record[key] !== undefined) entries[key] = record[key];
      }
      patches = catalogRecordPatches(document, dimension, options);
    } else if (dimension === "color-schemes" || dimension === "font-schemes") {
      requireCatalogId(document, dimension, value, options);
      entries = { [DESIGN_KEYS[dimension][0]]: value };
      patches = catalogRecordPatches(document, dimension, options);
    } else {
      // A background is an object or a shorthand string (theme slot or hex color); the schema
      // validates the candidate document, so a string that is neither is rejected below.
      const valid = dimension === "backgrounds" ? typeof value === "string" || (Boolean(value) && typeof value === "object" && !Array.isArray(value)) : Boolean(value) && typeof value === "object" && !Array.isArray(value);
      if (!valid)
        throw fail("invalid-switch-value", `Switch ${dimension} to ${dimension === "backgrounds" ? "a background object or shorthand string" : "an object with " + DESIGN_KEYS[dimension].join(" and ")}.`, { value });
      if (dimension === "backgrounds") entries = { background: value };
      else {
        const unknown = Object.keys(value).filter((key) => !DESIGN_KEYS[dimension].includes(key));
        if (unknown.length) throw fail("invalid-switch-value", `Unknown ${dimension} field: ${unknown[0]}.`, { value });
        entries = Object.fromEntries(DESIGN_KEYS[dimension].filter((key) => value[key] !== undefined).map((key) => [key, value[key]]));
      }
    }
    let base = [];
    if (scopeIndex !== undefined) {
      slideAt(document, scopeIndex, `a ${dimension} switch`);
      base = ["slides", String(scopeIndex)];
      scope = "slide";
      slideIndex = scopeIndex;
    }
    patches = [...patches, ...designPatches(document, base, entries)];
    if (scope === "deck") {
      const keys = Object.entries(entries).filter(([, entry]) => entry !== undefined).map(([key]) => key);
      shadowed = shadowedSlides(document, keys);
      if (options.clearSlideOverrides)
        for (const index of shadowed)
          for (const key of keys)
            if (document.slides[index].design?.[key] !== undefined) patches.push({ op: "remove", path: opfPathToJsonPointer(["slides", String(index), "design", key]) });
      if (options.clearSlideOverrides) shadowed = [];
    }
  }

  const next = patches.length ? applyJsonPatch(document, patches) : document;
  if (patches.length) {
    const validation = validateOpfDocument(next);
    if (!validation.valid && before.valid)
      throw fail("invalid-opf-edit", validation.errors[0]?.message ?? "This switch produces an invalid document.", { issues: validation.errors, patches });
  }
  return {
    dimension,
    scope,
    ...(slideIndex !== undefined ? { slideIndex } : {}),
    document: structuredClone(next),
    patches,
    changed: patches.length > 0,
    shadowed,
  };
}

/**
 * Switch one dimension of the session's document as a single undoable transaction. Returns the
 * editor change plus `dimension`, `scope`, `changed` and `shadowed` (slides whose own design
 * hides a deck-level switch). Switching to the current value commits nothing.
 */
export function switchDimension(editor, dimension, value, options = {}) {
  if (!editor || typeof editor.applyPatch !== "function" || typeof editor.subscribe !== "function")
    throw fail("invalid-editor", "Expected an editor session created by createEditorSession.");
  const { meta, ...switchOptions } = options;
  const prepared = prepareDimensionSwitch(editor.document, dimension, value, switchOptions);
  const { document, patches, ...summary } = prepared;
  void document;
  if (!prepared.changed) return { ...summary, document: editor.document, patches: [], inversePatches: [], validation: editor.validation };
  const change = editor.applyPatch(patches, { ...meta, source: meta?.source ?? "dimension-switch", dimension, scope: prepared.scope });
  return { ...change, ...summary };
}
