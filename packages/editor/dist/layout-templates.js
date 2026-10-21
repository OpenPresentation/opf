// OPF layout authoring (FA-33: a record is one ordered list of regions, nested for 2D). The catalog owns records; this module owns only editor operations.
import { resolveSlideContext } from "@openpresentation/opf";
import { bindRegions, isLayoutTemplate, layoutStructure, layoutTemplate } from "@openpresentation/opf/composition";
import { applyJsonPatch, createValuePatch, opfPathToJsonPointer } from "./index.js";
import { checkedDocument, fail } from "./edit-helpers.js";
import { checkFormat } from "./checks.js";

export const LAYOUT_INTENT_GROUPS = Object.freeze([
  { name: "Openers and closers", ids: ["cover", "section", "agenda", "statement", "closing"] },
  { name: "Text", ids: ["text", "list", "quote", "two-column"] },
  { name: "Groups of items", ids: ["pillars", "comparison", "process", "timeline", "faq"] },
  { name: "Numbers", ids: ["metrics", "scorecard"] },
  { name: "Visuals", ids: ["image", "image-beside", "gallery", "chart", "chart-beside", "table", "table-beside", "code"] },
  { name: "Mixed", ids: ["hero", "dashboard", "team", "logos"] },
]);

export const LAYOUT_REGION_KINDS = Object.freeze(["text", "list", "image", "video", "chart", "table", "code", "metric", "quote", "timeline", "group"]);
export const LAYOUT_REGION_ROLES = Object.freeze(["primary", "secondary", "media", "supporting"]);
export const LAYOUT_REGION_FLOWS = Object.freeze(["none", "grid", "column", "auto"]);
const RESERVED = new Set(["title", "subtitle", "tag", "auto", "left", "center", "right", "top", "middle", "bottom"]);
const NAME = /^[a-z][a-z0-9-]*$/;

/** Group registered layouts by the 28 built-in intents, then any deck or host layouts. */
export function groupLayoutChoices(choices) {
  const byId = new Map(choices.map((choice) => [choice.id, choice]));
  const used = new Set();
  const groups = LAYOUT_INTENT_GROUPS.map(({ name, ids }) => ({
    name, choices: ids.map((id) => byId.get(id)).filter((choice) => { if (!choice || used.has(choice.id)) return false; used.add(choice.id); return true; }),
  })).filter((group) => group.choices.length);
  const custom = choices.filter((choice) => !used.has(choice.id));
  if (custom.length) groups.push({ name: "Custom layouts", choices: custom });
  return groups;
}

/** Region lists nest at most this deep: the record's own list is level 1, a split's list level 2, a split inside it level 3. */
export const LAYOUT_MAX_DEPTH = 3;
/** A list of regions (the record's, or a split's) holds at most this many entries. */
export const LAYOUT_MAX_ENTRIES = 12;
export const LAYOUT_DIRECTIONS = Object.freeze(["row", "column"]);
export const LAYOUT_ANCHORS = Object.freeze(["top", "middle", "bottom"]);
const HEADINGS = new Set(["title", "subtitle"]);

const validSize = (size) => size === "auto" || (typeof size === "number" && Number.isFinite(size) && size > 0 && size <= 100);

/** One region's rules, checked and in the record's key order; `accepts` is optional (omitted: every body kind and group). */
function regionRules(entry, name) {
  const out = {};
  if (entry.accepts !== undefined) {
    if (!Array.isArray(entry.accepts) || !entry.accepts.length || entry.accepts.some((kind) => !LAYOUT_REGION_KINDS.includes(kind)))
      throw fail("layout-region", `Choose accepted content kinds for ${name}.`);
    out.accepts = [...new Set(entry.accepts)];
  }
  if (entry.role !== undefined) { if (!LAYOUT_REGION_ROLES.includes(entry.role)) throw fail("layout-region", `Choose a valid role for ${name}.`); out.role = entry.role; }
  if (entry.flow !== undefined) { if (!LAYOUT_REGION_FLOWS.includes(entry.flow)) throw fail("layout-region", `Choose a valid flow for ${name}.`); out.flow = entry.flow; }
  if (entry.max !== undefined) {
    if (!Number.isInteger(entry.max) || entry.max < 1 || entry.max > 12) throw fail("layout-region", `The most blocks ${name} holds is a whole number from 1 to 12.`);
    out.max = entry.max;
  }
  if (entry.bleed !== undefined) { if (typeof entry.bleed !== "boolean") throw fail("layout-region", `Bleed for ${name} is true or false.`); out.bleed = entry.bleed; }
  if (entry.listColumns !== undefined) { if (entry.listColumns !== "auto" && entry.listColumns !== 1) throw fail("layout-region", `List columns for ${name} is auto or 1.`); out.listColumns = entry.listColumns; }
  if (entry.anchor !== undefined) { if (!LAYOUT_ANCHORS.includes(entry.anchor)) throw fail("layout-region", `Choose a valid anchor for ${name}.`); out.anchor = entry.anchor; }
  if (entry.empty !== undefined) { if (entry.empty !== "collapse" && entry.empty !== "keep") throw fail("layout-region", `Empty for ${name} is collapse or keep.`); out.empty = entry.empty; }
  return out;
}

/**
 * Build the exact record from one ordered list of regions (OPF layout list form). `direction` ("row" or "column", default
 * "column") lays the record's `regions` out; an entry is a region (`{ name, size?, ...rules }`) or a split (`{ direction,
 * regions, size?, anchor? }`) that lays its own regions out in its own direction. Names are unique across the tree, `title`
 * and `subtitle` are heading regions that take only a size, and `size` is a number above 0 up to 100 or `"auto"` (a child
 * of a column only). The list is the reading order.
 */
export function layoutFromRegions({ id, name, summary, direction = "column", anchor, regions, overflowRegion }) {
  if (!NAME.test(id) || id === "auto") throw fail("layout-id", "Choose a kebab-case layout id other than auto.");
  if (typeof name !== "string" || !name.trim()) throw fail("layout-name", "Name the custom layout.");
  if (!LAYOUT_DIRECTIONS.includes(direction)) throw fail("layout-direction", "Choose row or column for the direction.");
  if (anchor !== undefined && !LAYOUT_ANCHORS.includes(anchor)) throw fail("layout-anchor", "Choose top, middle or bottom for the anchor.");
  const names = new Set();
  let body = 0;
  const walk = (list, parent, depth) => {
    if (!Array.isArray(list) || list.length < 1 || list.length > LAYOUT_MAX_ENTRIES)
      throw fail("layout-regions", `A list holds 1 to ${LAYOUT_MAX_ENTRIES} regions and splits.`);
    return list.map((entry) => {
      if (entry === null || typeof entry !== "object" || Array.isArray(entry)) throw fail("layout-regions", "Each entry is a region or a split.");
      const split = entry.name === undefined;
      if (entry.size !== undefined && !validSize(entry.size)) throw fail("layout-size", `A size is a number above 0 up to 100, or auto${entry.name ? ` (${entry.name})` : ""}.`);
      if (entry.size === "auto" && parent !== "column") throw fail("layout-size", `A size of auto is allowed only in a column${entry.name ? ` (${entry.name})` : ""}.`);
      const size = entry.size === undefined ? {} : { size: entry.size };
      if (split) {
        if (!LAYOUT_DIRECTIONS.includes(entry.direction)) throw fail("layout-direction", "Choose row or column for each split.");
        if (entry.anchor !== undefined && !LAYOUT_ANCHORS.includes(entry.anchor)) throw fail("layout-anchor", "Choose top, middle or bottom for the anchor.");
        if (depth >= LAYOUT_MAX_DEPTH) throw fail("layout-depth", `Regions nest at most ${LAYOUT_MAX_DEPTH} levels deep.`);
        return { direction: entry.direction, ...size, ...(entry.anchor ? { anchor: entry.anchor } : {}), regions: walk(entry.regions, entry.direction, depth + 1) };
      }
      if (typeof entry.name !== "string" || !NAME.test(entry.name)) throw fail("layout-area", `Invalid region name: ${entry.name}.`);
      if (RESERVED.has(entry.name) && !HEADINGS.has(entry.name)) throw fail("layout-area", `Invalid region name: ${entry.name} is reserved.`);
      if (names.has(entry.name)) throw fail("layout-area", `Region names are unique; ${entry.name} is used twice.`);
      names.add(entry.name);
      if (HEADINGS.has(entry.name)) {
        const extra = Object.keys(entry).find((key) => key !== "name" && key !== "size");
        if (extra) throw fail("layout-region", `${entry.name} is a heading region and takes only a size.`);
        return { name: entry.name, ...size };
      }
      body++;
      return { name: entry.name, ...size, ...regionRules(entry, entry.name) };
    });
  };
  const list = walk(regions, direction, 1);
  if (names.has("subtitle") && !names.has("title")) throw fail("layout-area", "A subtitle region needs a title region.");
  if (body < 1) throw fail("layout-region", "Add at least one content region.");
  if (overflowRegion !== undefined && (!names.has(overflowRegion) || HEADINGS.has(overflowRegion))) throw fail("layout-region", `${overflowRegion} is not a content region of this layout.`);
  const record = { name: name.trim() };
  if (summary?.trim()) record.summary = summary.trim();
  record.direction = direction;
  if (anchor) record.anchor = anchor;
  record.regions = list;
  if (overflowRegion !== undefined) record.overflowRegion = overflowRegion;
  return { id, record };
}

/** Prepare one validated catalog edit. Existing custom ids are never silently overwritten. */
export function prepareCustomLayout(presentation, layout) {
  const { id, record } = layout;
  if (!NAME.test(id) || id === "auto") throw fail("layout-id", "Choose a kebab-case layout id other than auto.");
  if (presentation.catalogs?.custom?.layouts?.[id]) throw fail("layout-exists", `A custom layout named ${id} already exists.`);
  const custom = presentation.catalogs?.custom ?? {};
  const next = { ...presentation, catalogs: { ...presentation.catalogs, custom: { ...custom, layouts: { ...custom.layouts, [id]: record } } } };
  const patches = [{ op: "replace", path: "", value: next }];
  checkedDocument(presentation, patches, checkFormat(presentation));
  return { presentation: next, patches, id };
}

export function saveCustomLayout(editor, layout) {
  const prepared = prepareCustomLayout(editor.presentation, layout);
  return editor.applyPatch(prepared.patches, { source: "layout-regions", rejectInvalid: true });
}

/** Pin a top-level block to a template region; the session validates the complete document. */
export function pinBlockToRegion(editor, slideIndex, blockIndex, region) {
  const slide = editor.presentation.slides?.[slideIndex];
  if (!slide || !Array.isArray(slide.blocks) || !slide.blocks[blockIndex]) throw fail("layout-block", "Choose a top-level content block.");
  if (typeof region !== "string" || !region) throw fail("layout-region", "Choose a region.");
  const path = ["slides", String(slideIndex), "blocks", String(blockIndex), "region"];
  const patches = createValuePatch(editor.presentation, opfPathToJsonPointer(path), region);
  const candidate = applyJsonPatch(editor.presentation, patches);
  const context = resolveSlideContext(candidate, slideIndex, { catalogs: editor.catalogs });
  const binding = bindRegions(candidate.slides[slideIndex], context.options.layout, { slideIndex });
  const expected = `slides.${slideIndex}.blocks.${blockIndex}`;
  if (!binding.regions.some((entry) => entry.name === region && entry.blocks.some((block) => block.path === expected && block.pinned)))
    throw fail("layout-region", `The ${region} region cannot accept this block or is full.`);
  return editor.applyPatch(patches, { source: "layout-region", rejectInvalid: true });
}

/** Region structure of a supported v2 template. */
export function layoutRegionSummary(record) {
  if (!isLayoutTemplate(record)) return "";
  try { layoutTemplate(record); return layoutStructure(record); } catch { return "Invalid region template"; }
}
