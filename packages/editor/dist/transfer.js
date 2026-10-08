import { applyJsonPatch, createValuePatch, getValueAtPath } from "./index.js";
import { ENGINE_DEFAULT_COLOR_SCHEME, ENGINE_DEFAULT_FONT_SCHEME, ENGINE_DEFAULT_THEME, copySlides, parseReference, resolveReference } from "@openpresentation/opf";
import { collectReservedPresentationIds, remapSlideTreeIds } from "./presentation-ids.js";
import { checkFormat, firstErrorMessage } from "./checks.js";
import { mergeCatalogs, prepareSave } from "./catalogs.js";
export const MAX_OPF_BYTES = 20 * 1024 * 1024;
const clone = (value) => structuredClone(value);
export function assertOpf(presentation) {
  bounded(presentation);
  const result = checkFormat(presentation);
  if (!result.valid)
    throw new Error(firstErrorMessage(result, "Invalid OPF document."));
  return presentation;
}
function bounded(value, depth = 0, budget = { remaining: 250000 }) {
  if (depth > 64 || --budget.remaining < 0)
    throw new Error("OPF exceeds the supported nesting or item limit.");
  if (value && typeof value === "object")
    for (const [key, child] of Object.entries(value)) {
      if (["__proto__", "prototype", "constructor"].includes(key))
        throw new Error(`Unsupported object key: ${key}`);
      bounded(child, depth + 1, budget);
    }
}
export function unwrapOpf(value, depth = 0) {
  if (depth > 64) throw new Error("OPF exceeds the supported nesting limit.");
  if (value?.slides) return value;
  if (value?.opfSnippet) return unwrapOpf(value.opfSnippet, depth + 1);
  if (Array.isArray(value?.opf)) {
    const snippet =
      value.opf.find((item) => item.name === "default") ?? value.opf[0];
    if (snippet) return unwrapOpf(snippet.value ?? JSON.parse(snippet.source), depth + 1);
  }
  if (value?.opf && typeof value.opf === "object") return unwrapOpf(value.opf, depth + 1);
  if (value?.presentation) return unwrapOpf(value.presentation, depth + 1);
  return value;
}
export function parseOpfTransfer(text) {
  if (
    typeof text !== "string" ||
    new TextEncoder().encode(text).length > MAX_OPF_BYTES
  )
    throw new Error("Choose OPF smaller than 20 MB.");
  let source = text.replace(/^\uFEFF/, "").trim();
  if (source.includes("```")) {
    const fences = [...source.matchAll(/```(?:json|opf)?\s*\n([\s\S]*?)```/gi)];
    if (fences.length !== 1)
      throw new Error("Paste one JSON or OPF code block at a time.");
    source = fences[0][1].trim();
  }
  let value;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error("Paste valid OPF JSON, a slide, or one JSON code block.");
  }
  bounded(value);
  value = unwrapOpf(value);
  bounded(value);
  if (value?.slides) {
    assertOpf(value);
    return { kind: "presentation", value, presentation: clone(value) };
  }
  const presentation = { slides: Array.isArray(value) ? value : [value] };
  if (checkFormat(presentation).valid)
    return { kind: "slides", value, presentation };
  return { kind: "selection", value };
}
/**
 * The OPF text to copy or save. A presentation or a slide is self-contained: core's `embed` adds every catalog record it
 * references (from `catalogs`, the host's registered list), so it renders the same where no catalog is registered.
 */
export function serializeOpfTransfer(
  presentation,
  { scope = "presentation", slideIndex = 0, path, format = "pretty", catalogs } = {},
) {
  let value = presentation;
  if (scope === "slide") {
    if (!presentation.slides?.[slideIndex])
      throw new Error("Select a slide first.");
    value = prepareSave({ ...presentation, slides: [presentation.slides[slideIndex]] }, { catalogs }).document;
  } else if (scope === "presentation") {
    value = prepareSave(presentation, { catalogs }).document;
  } else if (scope === "selection") {
    value = getValueAtPath(presentation, path);
    if (value === undefined) throw new Error("Select some content first.");
  }
  const json = JSON.stringify(value, null, format === "compact" ? 0 : 2);
  return format === "markdown" ? `\`\`\`json\n${json}\n\`\`\`` : json;
}
const RESERVED_GROUPS = new Set(["default", "custom"]);
const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
// A reference read out of a record of `group` keeps naming that group's record when it is written on a slide.
function qualified(value, group) {
  const qualify = (reference) => {
    const parsed = typeof reference === "string" ? parseReference(reference) : undefined;
    return !parsed || parsed.group || RESERVED_GROUPS.has(group) ? reference : `${group}:${parsed.id}`;
  };
  if (typeof value === "string") return qualify(value);
  if (isObject(value) && typeof value.id === "string") return { ...clone(value), id: qualify(value.id) };
  return value === undefined ? undefined : clone(value);
}

/**
 * Freeze the source deck's look on its slides before they move: each slide carries its colour scheme, font scheme, background
 * and header/footer, so the target deck's design does not restyle it. A value the source takes from its theme is written with
 * the theme's catalog group; one it takes from the engine default is written only when the target would not use the engine
 * default too (core's `ENGINE_DEFAULT_*`, never a catalog id).
 */
function frozenSlides(incoming, current, catalogs) {
  const target = isObject(current.design) ? current.design : {};
  const targetDefault = (key) => target[key] === undefined && target.theme === undefined;
  return incoming.slides.map((slide) => {
    // A slide's design cannot set dimensions (a PPTX has one slide size): the inserted slide takes the host deck's.
    const { dimensions: _deckSize, ...design } = { ...incoming.design, ...slide.design };
    const theme = typeof design.theme === "string" ? resolveReference(incoming, "themes", design.theme, { catalogs }) : undefined;
    const record = isObject(theme?.record) ? theme.record : {};
    const next = { ...design };
    const freeze = (key, engineDefault) => {
      if (design[key] !== undefined) return;
      if (record[key] !== undefined) next[key] = qualified(record[key], theme.group);
      else if (!targetDefault(key)) next[key] = clone(engineDefault);
    };
    freeze("colorScheme", ENGINE_DEFAULT_COLOR_SCHEME);
    freeze("fontScheme", ENGINE_DEFAULT_FONT_SCHEME);
    freeze("background", ENGINE_DEFAULT_THEME.background);
    next.header = design.header ?? false;
    next.footer = design.footer ?? false;
    return { ...slide, design: next };
  });
}

/**
 * Apply a parsed transfer to the current document. `mode` "selection" replaces the selected value, "replace" opens the transfer
 * as the presentation, and "insert" copies its slides in after `slideIndex` with core's `copySlides`: catalog groups match by
 * `source`, identical records are reused, a differing record is renamed, and `renamed` / `addedGroups` say what changed so the
 * host can tell the user. Assets and shared datasets come along under free ids. `catalogs` are the host's registered catalogs.
 * Returns `{ presentation, slideIndex, renamed, addedGroups }`.
 */
export function prepareOpfImport(
  current,
  transfer,
  { mode = "insert", slideIndex = 0, path, catalogs } = {},
) {
  if (mode === "selection") {
    const presentation = applyJsonPatch(
      current,
      createValuePatch(current, path, transfer.value),
    );
    assertOpf(presentation);
    return { presentation, slideIndex, renamed: [], addedGroups: [] };
  }
  if (!transfer.presentation)
    throw new Error(
      "This is a content fragment. Choose Replace selected content.",
    );
  if (mode === "replace")
    return { presentation: assertOpf(clone(transfer.presentation)), slideIndex: 0, renamed: [], addedGroups: [] };
  if (mode !== "insert") throw new Error("Unknown import action.");
  const list = mergeCatalogs(catalogs);
  const incoming = clone(transfer.presentation),
    target = clone(current);
  incoming.slides = frozenSlides(incoming, current, list);
  const assetMap = new Map();
  const assetIds = new Set(Object.keys(target.assets ?? {}));
  for (const id of Object.keys(incoming.assets ?? {})) {
    let next = id,
      n = 2;
    while (assetIds.has(next)) next = `${id}-${n++}`;
    assetIds.add(next);
    assetMap.set(id, next);
  }
  // RR-54: a chart or table that shows a shared dataset (`{ dataset: id }`) brings that dataset along. A dataset the deck already holds
  // with the same content is shared; one with the same id and other content is stored under a free id and the references follow it.
  const datasetMap = new Map();
  const usedDatasets = new Set();
  const collectDatasets = (value, key = "") => {
    if (Array.isArray(value)) value.forEach((child) => collectDatasets(child, key));
    else if (value && typeof value === "object") for (const [childKey, child] of Object.entries(value)) collectDatasets(child, childKey);
    else if (key === "dataset" && typeof value === "string") usedDatasets.add(value);
  };
  collectDatasets(incoming.slides);
  const datasetIds = new Set(Object.keys(target.datasets ?? {}));
  for (const id of usedDatasets) {
    const mine = incoming.datasets && Object.hasOwn(incoming.datasets, id) ? incoming.datasets[id] : undefined;
    if (mine === undefined) continue;
    if (datasetIds.has(id) && JSON.stringify(target.datasets[id]) === JSON.stringify(mine)) {
      datasetMap.set(id, id);
      continue;
    }
    let next = id,
      n = 2;
    while (datasetIds.has(next)) next = `${id}-${n++}`;
    datasetIds.add(next);
    datasetMap.set(id, next);
  }
  const rewrite = (value, key = "") => {
    if (Array.isArray(value)) return value.map((child) => rewrite(child, key));
    if (value && typeof value === "object")
      return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, rewrite(child, childKey)]));
    if (typeof value === "string") {
      if (key === "dataset" && datasetMap.has(value)) return datasetMap.get(value);
      if (["src", "image", "video", "poster", "background"].includes(key) && value.startsWith("asset:") && assetMap.has(value.slice(6)))
        return `asset:${assetMap.get(value.slice(6))}`;
    }
    return value;
  };
  incoming.slides = rewrite(incoming.slides);
  if (incoming.assets) {
    target.assets ??= {};
    for (const [id, asset] of Object.entries(rewrite(incoming.assets)))
      target.assets[assetMap.get(id)] =
        typeof asset === "string" && asset.startsWith("asset:") && assetMap.has(asset.slice(6)) ? `asset:${assetMap.get(asset.slice(6))}` : asset;
  }
  for (const [id, next] of datasetMap) {
    if (target.datasets && Object.hasOwn(target.datasets, next)) continue;
    target.datasets ??= {};
    target.datasets[next] = clone(incoming.datasets[id]);
  }
  const index = Math.max(0, Math.min(target.slides.length, slideIndex + 1));
  // Core copies the catalog records the slides use and rewrites their references (FA-20).
  const copied = copySlides(incoming, target, incoming.slides.map((_, at) => at), { catalogs: list, at: index });
  const presentation = clone(copied.document);
  const ids = new Set(collectReservedPresentationIds({ ...presentation, slides: presentation.slides.filter((_, at) => !copied.slides.includes(at)) }));
  for (const at of copied.slides) remapSlideTreeIds(presentation.slides[at], ids);
  assertOpf(presentation);
  return { presentation, slideIndex: copied.slides[0] ?? index, renamed: copied.renamed ?? [], addedGroups: copied.addedGroups ?? [] };
}
