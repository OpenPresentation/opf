// Dimension switches (FF-16, font-fidelity-everywhere). One operation per pptx.gallery
// dimension that turns "switch this dimension to X" into a validated JSON Patch, and applies
// it to an editor session as one undoable transaction. The preview recomposes and the PPTX
// export follows from the same document, so no dimension needs a special refresh path.
//
// OPF 0.15 (FA-23): the catalog-backed dimensions (layouts, themes, colour and font schemes, narratives, audiences, purposes,
// tones) resolve through core with the host's registered catalogs (`options.catalogs`, `Catalog[]`) and write the reference core
// gives (`id` or `name:id`). Languages, chart types and social platforms are engine vocabularies, checked against core's
// tables; their labels come from the host's display metadata (`options.vocabularies`, the shape of `catalogDisplay` from
// `@openpresentation/opf/catalog`), never from data the editor ships.
import { CHART_TYPES, LANGUAGES, SOCIAL_PLATFORMS, isXYChartType, parseReference, resolveChartData, resolveReference } from "@openpresentation/opf";
import { chartOptionTarget } from "@openpresentation/opf/composition";
import { createValuePatch, applyJsonPatch, getValueAtPath, opfPathToJsonPointer, splitOpfPath } from "./index.js";
import { createContentBlock, prepareBlockReplace } from "./blocks.js";
import { checkedDocument, designPatches, fail, same } from "./edit-helpers.js";
import { layoutSlotTypes, populateLayoutPlaceholders } from "./layout-placeholders.js";
import { blockConversionTargets, prepareBlockConversion } from "./block-convert.js";
import { checkFormat } from "./checks.js";
import { listCatalogRecords, mergeCatalogs } from "./catalogs.js";
import { IMAGE_TREATMENT_FIELDS, imageTreatmentPatches, readImageTreatments } from "./image-options.js";

/** The schema's DimensionPreset values (RR-41, FA-13: with the social-feed ratios), the values of the slide-sizes switch. */
export const SLIDE_SIZE_PRESETS = Object.freeze(["16:9", "4:3", "16:10", "1:1", "4:5", "9:16", "letter", "a4", "widescreen", "standard"]);

// Slide size in inches per preset, as core's resolveCanvasDimensions composes it (for picker labels).
const SLIDE_SIZE_LABELS = Object.freeze({
  "16:9": "16:9 (13.33 x 7.5 in)",
  "4:3": "4:3 (10 x 7.5 in)",
  "16:10": "16:10 (10 x 6.25 in)",
  "1:1": "1:1 square (7.5 x 7.5 in)",
  "4:5": "4:5 portrait (7.5 x 9.375 in)",
  "9:16": "9:16 portrait (7.5 x 13.33 in)",
  letter: "Letter (11 x 8.5 in)",
  a4: "A4 (11.69 x 8.27 in)",
  widescreen: "Widescreen (13.33 x 7.5 in)",
  standard: "Standard (10 x 7.5 in)",
});

/**
 * Every switchable dimension, in the gallery's order: the 14 pptx.gallery dimensions (gallery-support.md), then the
 * two document-level ones the gallery does not page yet (RR-41): `slide-sizes` (design.dimensions) and `purposes`
 * (the document's purpose).
 */
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
  "slide-sizes",
  "purposes",
]);

// Catalog kind behind each catalog-backed dimension (core's content kinds).
const CATALOG_KIND = Object.freeze({
  layouts: "layouts",
  "color-schemes": "colorSchemes",
  "font-schemes": "fontSchemes",
  narratives: "narratives",
  themes: "themes",
  audiences: "audiences",
  tones: "tones",
  purposes: "purposes",
});
// Display metadata key (`options.vocabularies`) behind each engine-vocabulary dimension.
const VOCABULARY = Object.freeze({ languages: "languages", charts: "chartTypes", socials: "socialPlatforms" });
// Top-level document field for the simple metadata dimensions.
const ROOT_FIELD = Object.freeze({ languages: "language", narratives: "narrative", tones: "tone", audiences: "audience" });
// `design` keys for the design dimensions. A key set to `null` in the value is removed.
const DESIGN_KEYS = Object.freeze({
  "color-schemes": ["colorScheme"],
  "font-schemes": ["fontScheme"],
  backgrounds: ["background"],
  "headers-footers": ["header", "footer"],
});
const REGION = /^(?:(?:top|middle|bottom)(?:\+(?:top|middle|bottom))*(?::(?:left|center|right)(?:\+(?:left|center|right))*)?|(?:left|center|right)(?:\+(?:left|center|right))*)$/;
const BLOCK_KINDS = ["text", "list", "chart", "table", "metric", "quote", "code", "timeline", "group", "image", "video"];
const RESERVED_GROUPS = new Set(["default", "custom"]);
const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const catalogsOf = (options) => mergeCatalogs(options.catalogs);

// A reference resolved the one way every engine resolves it (core's `resolveReference`, with the registered catalogs).
function resolveRecord(presentation, kind, reference, options) {
  if (typeof reference !== "string" || !reference) return undefined;
  return resolveReference(presentation, kind, reference, { catalogs: catalogsOf(options) });
}

/**
 * A record the caller supplies with the switch (a gallery item carries its own): it is embedded in the same transaction, in
 * the group whose `source` is `options.recordSource` (`default` when the document has no default group yet), else under `custom`,
 * with no `$schema`, `id` or `x-*` display fields. Returns the patches and the reference to write.
 */
function suppliedRecord(presentation, kind, options) {
  const record = options.record;
  if (!record) return undefined;
  const id = record.id;
  const groups = isObject(presentation.catalogs) ? presentation.catalogs : undefined;
  let group = "custom";
  if (typeof options.recordSource === "string" && options.recordSource) {
    const named = groups && Object.entries(groups).find(([, value]) => isObject(value) && value.source === options.recordSource);
    if (named) group = named[0];
    else if (!groups || groups.default === undefined) group = "default";
  }
  const reference = RESERVED_GROUPS.has(group) ? id : `${group}:${id}`;
  const { $schema: _schema, id: _id, ...fields } = record;
  const value = Object.fromEntries(Object.entries(structuredClone(fields)).filter(([key]) => !key.startsWith("x-")));
  if (isObject(groups?.[group]?.[kind]) && Object.hasOwn(groups[group][kind], id)) return { patches: [], reference, record: groups[group][kind][id], group };
  const path = ["catalogs", group, kind, id];
  let patches;
  if (!groups) patches = [{ op: "add", path: "/catalogs", value: { [group]: { ...(group === "default" ? { source: options.recordSource } : {}), [kind]: { [id]: value } } } }];
  else if (!isObject(groups[group])) patches = [{ op: "add", path: opfPathToJsonPointer(path.slice(0, 2)), value: { ...(group === "default" ? { source: options.recordSource } : {}), [kind]: { [id]: value } } }];
  else if (!isObject(groups[group][kind])) patches = [{ op: "add", path: opfPathToJsonPointer(path.slice(0, 3)), value: { [id]: value } }];
  else patches = [{ op: "add", path: opfPathToJsonPointer(path), value }];
  return { patches, reference, record: value, group };
}

// The record a switched reference names: a supplied record, else core's resolution. Unknown references are refused.
function requireRecord(presentation, dimension, reference, options) {
  const kind = CATALOG_KIND[dimension];
  if (typeof reference !== "string" || reference.length === 0)
    throw fail("invalid-catalog-id", `Switch ${dimension} to a non-empty catalog reference.`, { dimension, id: reference });
  const resolved = resolveRecord(presentation, kind, reference, options);
  if (!resolved) throw fail("unknown-catalog-id", `Unknown ${kind} catalog reference: ${reference}. Register the catalog that holds it, or add the record to the document.`, { dimension, catalogKind: kind, id: reference });
  return resolved;
}

// A switch to a supplied record writes the reference it was embedded under; otherwise the reference must resolve.
function catalogChoice(presentation, dimension, reference, options) {
  const supplied = options.record && parseReference(reference)?.id === options.record.id ? suppliedRecord(presentation, CATALOG_KIND[dimension], options) : undefined;
  if (supplied) return { patches: supplied.patches, reference: supplied.reference, record: supplied.record, group: supplied.group };
  const resolved = requireRecord(presentation, dimension, reference, options);
  return { patches: [], reference, record: resolved.record, group: resolved.group };
}

// A reference copied out of a record of group `group` into the document's design keeps naming that group's record.
function qualify(reference, group) {
  if (typeof reference !== "string") return reference;
  const parsed = parseReference(reference);
  if (!parsed || parsed.group || RESERVED_GROUPS.has(group)) return reference;
  return `${group}:${parsed.id}`;
}
function qualifiedValue(key, value, group) {
  if (key === "colorScheme" || key === "fontScheme") {
    if (typeof value === "string") return qualify(value, group);
    if (isObject(value) && typeof value.id === "string") return { ...structuredClone(value), id: qualify(value.id, group) };
  }
  return structuredClone(value);
}

function slideAt(presentation, slideIndex, what = "this switch") {
  if (!Number.isInteger(slideIndex) || !presentation.slides?.[slideIndex])
    throw fail("slide-index-out-of-range", `Choose an existing slide for ${what}.`, { slideIndex });
  return presentation.slides[slideIndex];
}

function rootPatch(presentation, field, value) {
  return same(presentation[field], value) ? [] : createValuePatch(presentation, [field], value);
}

// A deck-level switch does nothing for a slide that carries its own value for that key.
function shadowedSlides(presentation, keys) {
  return (presentation.slides ?? []).flatMap((slide, index) => (keys.some((key) => slide?.design?.[key] !== undefined) ? [index] : []));
}

function findChartOwner(presentation, slideIndex) {
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
  return visit(presentation.slides[slideIndex], ["slides", String(slideIndex)], 0);
}

function socialsPatches(presentation, value, options) {
  const owner = options.owner ?? "speaker";
  if (!["speaker", "organization"].includes(owner)) throw fail("invalid-switch-value", "Socials owner must be 'speaker' or 'organization'.", { owner });
  if (!value || typeof value !== "object" || typeof value.platform !== "string" || typeof value.handle !== "string" || !value.handle)
    throw fail("invalid-switch-value", "Switch socials to { platform, handle } with a non-empty handle.", { value });
  if (!Object.hasOwn(SOCIAL_PLATFORMS, value.platform))
    throw fail("unknown-catalog-id", `Unknown social platform: ${value.platform}. Use one of ${Object.keys(SOCIAL_PLATFORMS).join(", ")}.`, { dimension: "socials", id: value.platform });
  const host = presentation[owner];
  const index = Array.isArray(host) ? (options.index ?? 0) : undefined;
  const target = Array.isArray(host) ? host[index] : host;
  if (!target || typeof target !== "object")
    throw fail("missing-owner", `Add the ${owner} to the document before setting their socials.`, { owner });
  const base = Array.isArray(host) ? [owner, String(index)] : [owner];
  const socials = target.socials;
  const patches = [];
  if (!socials || typeof socials !== "object") return [...patches, { op: "add", path: opfPathToJsonPointer([...base, "socials"]), value: { [value.platform]: value.handle } }];
  if (socials[value.platform] === value.handle) return patches;
  return [...patches, { op: Object.hasOwn(socials, value.platform) ? "replace" : "add", path: opfPathToJsonPointer([...base, "socials", value.platform]), value: value.handle }];
}

// Purposes take free goal text, so only a supplied record is embedded; any other string is written as it is.
function catalogChoiceIfSupplied(presentation, dimension, value, options) {
  return options.record ? catalogChoice(presentation, dimension, value, options) : undefined;
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
export function prepareDimensionSwitch(presentation, dimension, value, options = {}) {
  if (!SWITCH_DIMENSIONS.includes(dimension))
    throw fail("unknown-dimension", `Unknown dimension: ${dimension}. Use one of ${SWITCH_DIMENSIONS.join(", ")}.`, { dimension });
  if (!presentation || typeof presentation !== "object") throw fail("invalid-input", "Switch requires an OPF document object.");
  if (options.record) {
    const ids = (dimension === "audiences" ? [value].flat() : [value]).map((entry) => (typeof entry === "string" ? parseReference(entry)?.id : undefined));
    if (!CATALOG_KIND[dimension] || typeof options.record?.id !== "string" || !ids.includes(options.record.id))
      throw fail("record-id-mismatch", `The supplied record id must equal a switched ${dimension} id.`, { dimension, id: options.record?.id });
  }
  const before = checkFormat(presentation);
  const scopeIndex = options.slideIndex;
  let patches = [];
  let scope = "deck";
  let shadowed = [];
  let slideIndex;
  let conversionLoss;

  if (dimension === "slide-sizes") {
    // A preset string; a custom size (design.dimensions as an object with inches) is replaced by it.
    if (!SLIDE_SIZE_PRESETS.includes(value)) throw fail("invalid-switch-value", `Switch slide-sizes to one of ${SLIDE_SIZE_PRESETS.join(", ")}.`, { value });
    if (scopeIndex !== undefined) throw fail("deck-scope-only", "A presentation has one slide size: switch slide-sizes for the deck, without slideIndex.", { slideIndex: scopeIndex });
    const own = presentation.design?.dimensions;
    // {preset} alone is the same size as the bare preset string.
    const sameSize = own && typeof own === "object" && !Array.isArray(own) && own.preset === value && Object.keys(own).length === 1;
    // A slide's design cannot set dimensions (FA-07), so no slide can shadow the deck's size.
    patches = sameSize ? [] : designPatches(presentation, [], { dimensions: value });
  } else if (dimension === "purposes") {
    // A catalog reference, free-form goal text (no reference check: any goal is valid) or an inline Purpose object; the schema validates it.
    if (typeof value !== "string" && !(value && typeof value === "object" && !Array.isArray(value)))
      throw fail("invalid-switch-value", "Switch purposes to a catalog reference, a goal string or a purpose object.", { value });
    if (typeof value === "string" && value.length === 0) throw fail("invalid-switch-value", "Switch purposes to a non-empty goal.", { value });
    const supplied = typeof value === "string" ? catalogChoiceIfSupplied(presentation, dimension, value, options) : undefined;
    patches = [...(supplied?.patches ?? []), ...rootPatch(presentation, "purpose", supplied?.reference ?? value)];
  } else if (dimension === "layouts") {
    slideIndex = scopeIndex;
    slideAt(presentation, slideIndex, "a layout switch");
    scope = "slide";
    const choice = catalogChoice(presentation, dimension, value, options);
    const record = choice.record;
    patches = choice.patches;
    const withRecord = patches.length ? applyJsonPatch(presentation, patches) : presentation;
    if (withRecord.slides[slideIndex].layout !== choice.reference) {
      const layoutOps = createValuePatch(withRecord, ["slides", String(slideIndex), "layout"], choice.reference);
      const swapped = applyJsonPatch(withRecord, layoutOps);
      // FA-26: a record's placeholder groups contribute their leaf regions, in reading order.
      const types = layoutSlotTypes(record);
      // Add the blank payloads the layout declares, as the JSON editor's layout choice does.
      const populated = types ? populateLayoutPlaceholders(swapped, slideIndex, types) : swapped;
      patches = same(populated.slides[slideIndex], swapped.slides[slideIndex])
        ? [...patches, ...layoutOps]
        : [...patches, { op: "replace", path: `/slides/${slideIndex}`, value: populated.slides[slideIndex] }];
    }
  } else if (dimension === "charts") {
    slideIndex = scopeIndex;
    slideAt(presentation, slideIndex, "a chart switch");
    scope = "slide";
    if (typeof value !== "string" || !CHART_TYPES.includes(value)) throw fail("unknown-catalog-id", `Unknown chart type: ${value}. Use one of ${CHART_TYPES.join(", ")}.`, { dimension, id: value });
    const owner = options.path ? splitOpfPath(options.path) : findChartOwner(presentation, slideIndex);
    if (options.path && (owner[0] !== "slides" || owner[1] !== String(slideIndex)))
      throw fail("path-slide-mismatch", "options.path is not on the slide named by options.slideIndex.", { slideIndex, path: options.path });
    const chart = owner && getValueAtPath(presentation, [...owner, "chart"]);
    if (!chart || typeof chart !== "object") throw fail("chart-not-found", "This slide has no chart to switch. Insert a chart block first.", { slideIndex, path: options.path });
    patches = chart.type === value ? [] : [...createValuePatch(presentation, [...owner, "chart", "type"], value), ...staleMappingPatches(presentation, owner, chart, value), ...staleComboPatches(presentation, owner, chart, value)];
  } else if (dimension === "blocks") {
    if (options.path === undefined) throw fail("missing-path", "Choose the block to replace with options.path.");
    // convert: true moves the block's own text into the new kind (block-convert.js) instead of replacing it.
    if (options.convert) {
      if (typeof value !== "string") throw fail("invalid-switch-value", "Convert a block to a content kind name.", { value });
      const conversion = prepareBlockConversion(presentation, options.path, value, options.conversion);
      patches = conversion.changed ? conversion.patches : [];
      conversionLoss = conversion.loss;
    } else {
      const block = blockValue(value, options);
      const change = prepareBlockReplace(presentation, options.path, block);
      patches = change.changed ? change.patches : [];
    }
    const parts = splitOpfPath(options.path);
    if (parts[0] === "slides") slideIndex = Number(parts[1]);
    scope = "block";
  } else if (dimension === "socials") {
    patches = socialsPatches(presentation, value, options);
  } else if (dimension === "image-treatments") {
    // The treatments of one image block (FA-22): fit, focus, shape, corner radius, border, opacity, recolor, overlay, aspect ratio, placement.
    if (options.path === undefined) throw fail("missing-path", "Choose the image block to treat with options.path.");
    patches = imageTreatmentPatches(presentation, options.path, value);
    const parts = splitOpfPath(options.path);
    if (parts[0] === "slides") slideIndex = Number(parts[1]);
    scope = "block";
  } else if (dimension === "languages") {
    // A BCP-47 tag (en-US) or a language object ({ bcp47, ... }); the schema checks the tag. Language catalog ids are gone.
    if (!(typeof value === "string" && value) && !(isObject(value) && typeof value.bcp47 === "string"))
      throw fail("invalid-switch-value", "Switch languages to a BCP-47 tag such as en-US, or a language object with bcp47.", { value });
    patches = rootPatch(presentation, "language", value);
  } else if (ROOT_FIELD[dimension]) {
    const field = ROOT_FIELD[dimension];
    let next;
    if (dimension === "audiences") {
      const list = Array.isArray(value) ? value : [value];
      if (!list.length) throw fail("invalid-catalog-id", "Switch audiences to at least one catalog reference.", { value });
      next = [];
      for (const reference of list) {
        const choice = catalogChoice(applyJsonPatch(presentation, patches), dimension, reference, options);
        patches = [...patches, ...choice.patches];
        next.push(choice.reference);
      }
    } else {
      const choice = catalogChoice(presentation, dimension, value, options);
      patches = choice.patches;
      next = choice.reference;
    }
    patches = [...patches, ...rootPatch(presentation, field, next)];
  } else {
    // Design dimensions: deck scope by default, or one slide with options.slideIndex.
    let entries;
    if (dimension === "themes") {
      const choice = catalogChoice(presentation, dimension, value, options);
      const record = choice.record ?? {};
      entries = { theme: choice.reference };
      if (options.bundle !== false) {
        // An explicit theme choice brings the theme's own colour scheme, font scheme and background (and, for the deck, its
        // slide size): an override of those at the same scope is removed so the theme's applies. Nothing is copied out of the
        // record, except on a slide whose deck sets the key: there the theme's value is written on the slide (its references
        // qualified with the theme's catalog group), because the deck's design would otherwise win over the slide's theme.
        // A slide's design cannot set dimensions (a PPTX has one slide size), so only a deck-scope switch touches them.
        for (const key of ["colorScheme", "fontScheme", "background", ...(scopeIndex === undefined ? ["dimensions"] : [])]) {
          if (record[key] === undefined) continue;
          entries[key] = scopeIndex !== undefined && presentation.design?.[key] !== undefined ? qualifiedValue(key, record[key], choice.group) : null;
        }
      }
      patches = choice.patches;
    } else if (dimension === "color-schemes" || dimension === "font-schemes") {
      const choice = catalogChoice(presentation, dimension, value, options);
      value = choice.reference;
      entries = { [DESIGN_KEYS[dimension][0]]: value };
      if (dimension === "font-schemes") {
        // An accent font is its own choice, not part of the scheme being left: it stays (in the object form).
        const scopeBase = scopeIndex !== undefined && presentation.slides?.[scopeIndex] ? ["slides", String(scopeIndex)] : [];
        const own = getValueAtPath(presentation, [...scopeBase, "design", "fontScheme"]);
        if (own && typeof own === "object" && own.accent !== undefined) entries.fontScheme = { id: value, accent: structuredClone(own.accent) };
      }
      patches = choice.patches;
    } else {
      // A background is an object or a shorthand string (theme slot or hex color); the schema
      // validates the candidate document, so a string that is neither is rejected below.
      // null removes the background so the theme's (or, on a slide, the deck's) shows again.
      const valid = dimension === "backgrounds" ? value === null || typeof value === "string" || (Boolean(value) && typeof value === "object" && !Array.isArray(value)) : Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
      slideAt(presentation, scopeIndex, `a ${dimension} switch`);
      base = ["slides", String(scopeIndex)];
      scope = "slide";
      slideIndex = scopeIndex;
    }
    patches = [...patches, ...designPatches(presentation, base, entries)];
    if (scope === "deck") {
      const keys = Object.entries(entries).filter(([, entry]) => entry !== undefined).map(([key]) => key);
      shadowed = shadowedSlides(presentation, keys);
      if (options.clearSlideOverrides)
        for (const index of shadowed)
          for (const key of keys)
            if (presentation.slides[index].design?.[key] !== undefined) patches.push({ op: "remove", path: opfPathToJsonPointer(["slides", String(index), "design", key]) });
      if (options.clearSlideOverrides) shadowed = [];
    }
  }

  const next = checkedDocument(presentation, patches, before);
  return {
    dimension,
    scope,
    ...(slideIndex !== undefined ? { slideIndex } : {}),
    presentation: structuredClone(next),
    patches,
    changed: patches.length > 0,
    shadowed,
    ...(conversionLoss ? { loss: conversionLoss } : {}),
  };
}

/**
 * Switch one dimension of the session's document as a single undoable transaction, resolving references with the session's
 * registered catalogs (and `options.catalogs`). Returns the
 * editor change plus `dimension`, `scope`, `changed` and `shadowed` (slides whose own design
 * hides a deck-level switch). Switching to the current value commits nothing.
 */
export function switchDimension(editor, dimension, value, options = {}) {
  if (!editor || typeof editor.applyPatch !== "function" || typeof editor.subscribe !== "function")
    throw fail("invalid-editor", "Expected an editor session created by createEditorSession.");
  const { meta, ...switchOptions } = options;
  // The session's registered catalogs first, then any the caller adds for this switch: the one list core resolves with.
  const prepared = prepareDimensionSwitch(editor.presentation, dimension, value, { ...switchOptions, catalogs: mergeCatalogs(editor.catalogs, options.catalogs) });
  const { presentation, patches, ...summary } = prepared;
  void presentation;
  if (!prepared.changed) return { ...summary, presentation: editor.presentation, patches: [], inversePatches: [], validation: editor.validation };
  const change = editor.applyPatch(patches, { ...meta, source: meta?.source ?? "dimension-switch", dimension, scope: prepared.scope });
  return { ...change, ...summary };
}

// --- options for pickers and current values ---------------------------------------------------

// Host display metadata for an engine vocabulary (`options.vocabularies[key]`, the shape of `catalogDisplay`): a list of records
// with `id` (or `bcp47` for a language), or an object keyed by id. Returns a Map id -> record.
function displayRecords(options, key) {
  const source = options.vocabularies?.[key];
  const out = new Map();
  if (Array.isArray(source)) {
    for (const record of source) if (isObject(record) && typeof (record.id ?? record.bcp47) === "string") out.set(record.id ?? record.bcp47, record);
  } else if (isObject(source)) {
    for (const [id, record] of Object.entries(source)) out.set(isObject(record) && typeof record.bcp47 === "string" ? record.bcp47 : id, isObject(record) ? record : {});
  }
  return out;
}
const displayLabel = (record, id) => (typeof record?.name === "string" && record.name ? record.name : typeof record?.label === "string" && record.label ? record.label : id);

/**
 * The values a picker can offer for a dimension. A catalog-backed dimension lists core's `catalogRecords` (the document's embedded
 * records first, then `options.catalogs`'), each `{ id, label, record, reference, group, source, origin }` with `id` the reference
 * to write. `charts` lists core's `CHART_TYPES` and `socials` core's `SOCIAL_PLATFORMS`, labelled from `options.vocabularies`;
 * `languages` lists core's `LANGUAGES` tags. `blocks` lists the content
 * kinds. Use `compatibleChartTypes` to narrow `charts` to the types the chart's data can use.
 */
export function listSwitchOptions(presentation, dimension, options = {}) {
  if (dimension === "blocks") return BLOCK_KINDS.map((kind) => ({ id: kind, label: kind[0].toUpperCase() + kind.slice(1) }));
  if (dimension === "slide-sizes") return SLIDE_SIZE_PRESETS.map((preset) => ({ id: preset, label: SLIDE_SIZE_LABELS[preset] }));
  if (dimension === "charts") {
    const display = displayRecords(options, VOCABULARY.charts);
    return CHART_TYPES.map((id) => ({ id, label: displayLabel(display.get(id), id), record: display.get(id) ?? {} }));
  }
  if (dimension === "socials") {
    const display = displayRecords(options, VOCABULARY.socials);
    return Object.keys(SOCIAL_PLATFORMS).map((id) => ({ id, label: displayLabel(display.get(id), id), record: { ...SOCIAL_PLATFORMS[id], ...display.get(id) } }));
  }
  if (dimension === "languages") {
    // Core's language table (the tags engines know the script, direction and default fonts of), labelled from the host's display metadata.
    const display = displayRecords(options, VOCABULARY.languages);
    return LANGUAGES.map((language) => ({ id: language.tag, label: displayLabel(display.get(language.tag), language.tag), record: { ...language, ...display.get(language.tag) } }));
  }
  const kind = CATALOG_KIND[dimension];
  if (!kind) return [];
  return listCatalogRecords(presentation ?? {}, kind, { catalogs: catalogsOf(options) });
}

const SINGLE_SERIES_ONLY = new Set(["pieChart", "doughnutChart", "funnelChart", "treemapChart", "waterfallChart"]);
const MULTI_SERIES_CAPABLE = new Set(["barChart", "lineChart", "areaChart", "radarChart"]);
const STACKED_GROUPINGS = new Set(["stacked", "percentStacked"]);
const DISTRIBUTION_ELEMENTS = new Set(["histogramChart", "boxWhiskerChart", "mapChart"]);

// RR-54: `mapping.x` names the X column of an XY chart; a type without an X axis ignores it (core warns chart-mapping-adapted). Switching to such a
// type removes it, and the whole mapping when nothing else is left, so the document does not keep a warning it cannot act on.
function staleMappingPatches(presentation, owner, chart, type) {
  const mapping = chart.mapping;
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping) || mapping.x === undefined) return [];
  if (isXYChartType(type)) return [];
  const { x: _x, ...rest } = mapping;
  const parts = [...owner, "chart", "mapping"];
  return Object.keys(rest).length ? createValuePatch(presentation, parts, rest) : [{ op: "remove", path: opfPathToJsonPointer(parts) }];
}

// FA-15: `line`, `secondaryAxis` and the secondary axis title belong to combo charts; any other type ignores them (core warns
// chart-option-adapted). Switching away from combo removes them, and an `axisTitles` left empty.
function staleComboPatches(presentation, owner, chart, type) {
  if (chartOptionTarget(type)?.kind === "combo") return [];
  const parts = [...owner, "chart"];
  const patches = ["line", "secondaryAxis"].filter((key) => chart[key] !== undefined).map((key) => ({ op: "remove", path: opfPathToJsonPointer([...parts, key]) }));
  const titles = chart.axisTitles;
  if (titles && typeof titles === "object" && !Array.isArray(titles) && titles.secondary !== undefined) {
    const { secondary: _secondary, ...rest } = titles;
    patches.push(Object.keys(rest).length ? { op: "remove", path: opfPathToJsonPointer([...parts, "axisTitles", "secondary"]) } : { op: "remove", path: opfPathToJsonPointer([...parts, "axisTitles"]) });
  }
  return patches;
}

function chartDataShape(chart, presentation) {
  // RR-54: inline data, a dataset reference and a series mapping all resolve to the columns the renderers read: the first column labels
  // the categories and every further column is a series.
  const resolved = resolveChartData(chart, presentation);
  if (!resolved.ok) return undefined;
  return { series: Math.max(0, resolved.columns.length - 1), categories: resolved.rows.length };
}

/**
 * Chart types the chart's inline data can use as it is, from core's chart types and the host's chart display metadata: simple,
 * non-geographic, non-distribution types whose series count fits the data (the first column labels
 * the categories and each further column is a series; a type with N series needs exactly N value
 * columns, except that a stacked or percent-stacked type and a combination such as combo take N or more;
 * column, bar, line, area and radar take any number). Data that is read from
 * an external source returns every simple type. This is data-shape compatibility, not a claim that
 * an engine draws the type. `path` or `slideIndex` picks the chart (default: the slide's first).
 * Each entry has `current: true` for the chart's present type, which is always listed.
 */
export function compatibleChartTypes(presentation, options = {}) {
  const slideIndex = options.slideIndex ?? 0;
  const owner = options.path ? splitOpfPath(options.path) : presentation.slides?.[slideIndex] ? findChartOwner(presentation, slideIndex) : undefined;
  const chart = owner && getValueAtPath(presentation, [...owner, "chart"]);
  if (!chart || typeof chart !== "object") return [];
  const shape = chartDataShape(chart, presentation);
  const result = [];
  for (const option of listSwitchOptions(presentation, "charts", options)) {
    const record = option.record;
    const element = record.mappings?.openxml?.element;
    const current = option.id === chart.type;
    // Without the host's display metadata for a type (complexity, series, mappings) it is offered: compatibility is unknown, not refused.
    const simple = record.complexity === undefined ? !DISTRIBUTION_ELEMENTS.has(element) : record.complexity === "simple" && !DISTRIBUTION_ELEMENTS.has(element);
    // A combination (composition "mixed", the FA-15 combo chart) needs at least its series count, like a stacked type.
    const atLeast = STACKED_GROUPINGS.has(record.mappings?.openxml?.grouping) || record.mappings?.openxml?.composition === "mixed";
    const seriesOk =
      !shape ||
      !record.series ||
      (record.series > 1
        ? atLeast
          ? shape.series >= record.series
          : record.series === shape.series
        : shape.series === 1 || (MULTI_SERIES_CAPABLE.has(element) && !SINGLE_SERIES_ONLY.has(element)));
    if (current || (simple && seriesOk)) result.push({ id: option.id, label: option.label, current, record });
  }
  return result;
}

/**
 * The value a dimension currently has, for pickers: `{ value, scope }` where scope is "slide" when
 * `slideIndex` names a slide whose own design sets it, else "deck". `value` is undefined when the
 * dimension is unset. Catalog dimensions return the reference (`id` or `name:id`) even when the document holds an
 * object form with overrides. `options.catalogs` resolves the theme's slide size.
 */
export function currentSwitchValue(presentation, dimension, options = {}) {
  const idOf = (reference) => (reference && typeof reference === "object" && !Array.isArray(reference) ? reference.id : reference);
  const design = (key) => {
    const slide = options.slideIndex !== undefined ? presentation.slides?.[options.slideIndex]?.design?.[key] : undefined;
    if (slide !== undefined) return { value: slide, scope: "slide" };
    return presentation.design?.[key] === undefined ? { scope: "deck" } : { value: presentation.design[key], scope: "deck" };
  };
  if (dimension === "layouts") return { value: presentation.slides?.[options.slideIndex]?.layout, scope: "slide" };
  if (dimension === "charts") {
    const owner = options.path ? splitOpfPath(options.path) : findChartOwner(presentation, options.slideIndex ?? 0);
    return { value: owner ? getValueAtPath(presentation, [...owner, "chart", "type"]) : undefined, scope: "slide" };
  }
  if (dimension === "blocks") return { value: undefined, scope: "block" };
  if (dimension === "image-treatments") {
    // The treatments of the image block at `options.path` (FA-22); without a path there is nothing to read.
    if (options.path === undefined) return { value: undefined, scope: "block" };
    const state = readImageTreatments(presentation, options.path);
    return { value: Object.fromEntries(IMAGE_TREATMENT_FIELDS.map((key) => [key, state[key]])), scope: "block" };
  }
  if (dimension === "slide-sizes") {
    // The size the deck composes at: its own design.dimensions, else the theme's; a {preset} object reads as its preset.
    // A custom size (inches without a preset) reads as the object itself. Unset reads as undefined (composed as widescreen).
    let size = presentation.design?.dimensions;
    if (size === undefined) {
      const theme = presentation.design?.theme;
      size = typeof theme === "string" ? resolveRecord(presentation, "themes", theme, options)?.record?.dimensions : undefined;
    }
    return { value: size && typeof size === "object" && !Array.isArray(size) && Object.keys(size).length === 1 && size.preset ? size.preset : size, scope: "deck" };
  }
  if (dimension === "purposes") {
    // A catalog reference or goal text reads as itself, a Purpose object as its id (else the object).
    const purpose = presentation.purpose;
    return { value: purpose && typeof purpose === "object" && !Array.isArray(purpose) ? (purpose.id ?? purpose) : purpose, scope: "deck" };
  }
  if (dimension === "socials") {
    const host = presentation[options.owner ?? "speaker"];
    const target = Array.isArray(host) ? host[options.index ?? 0] : host;
    return { value: target?.socials, scope: "deck" };
  }
  if (ROOT_FIELD[dimension]) return { value: presentation[ROOT_FIELD[dimension]], scope: "deck" };
  if (dimension === "color-schemes") return { ...design("colorScheme"), value: idOf(design("colorScheme").value) };
  if (dimension === "font-schemes") return { ...design("fontScheme"), value: idOf(design("fontScheme").value) };
  if (dimension === "themes") return { ...design("theme"), value: idOf(design("theme").value) };
  if (dimension === "backgrounds") return design("background");
  const keys = DESIGN_KEYS[dimension];
  if (keys) {
    const found = keys.map((key) => design(key));
    return { value: Object.fromEntries(keys.map((key, index) => [key, found[index].value])), scope: found.some((entry) => entry.scope === "slide") ? "slide" : "deck" };
  }
  return { scope: "deck" };
}

export { blockConversionTargets };
