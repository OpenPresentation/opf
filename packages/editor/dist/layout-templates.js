// OPF 0.19 layout authoring. The catalog owns records; this module owns only editor operations.
import { resolveSlideContext } from "@openpresentation/opf";
import { bindRegions, layoutStructure, layoutTemplate } from "@openpresentation/opf/composition";
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

/** Build the exact v2 record from a rectangular painted grid. `cells` is a row-major array of names or `.`. */
export function layoutFromGrid({ id, name, summary, cells, regions, columns, rows }) {
  if (!NAME.test(id) || id === "auto") throw fail("layout-id", "Choose a kebab-case layout id other than auto.");
  if (typeof name !== "string" || !name.trim()) throw fail("layout-name", "Name the custom layout.");
  if (!Array.isArray(cells) || cells.length < 1 || cells.length > 12 || !cells.every((row) => Array.isArray(row) && row.length === cells[0].length && row.length >= 1 && row.length <= 12))
    throw fail("layout-grid", "Draw a rectangular grid of at most 12 by 12 cells.");
  const areas = cells.map((row) => row.join(" "));
  const names = new Set(cells.flat().filter((cell) => cell !== "."));
  for (const area of names) if (!NAME.test(area) || (RESERVED.has(area) && area !== "title" && area !== "subtitle")) throw fail("layout-area", `Invalid area name: ${area}.`);
  if (names.has("subtitle") && !names.has("title")) throw fail("layout-area", "A subtitle area needs a title area.");
  const body = [...names].filter((area) => area !== "title" && area !== "subtitle");
  for (const area of body) {
    const points = cells.flatMap((row, y) => row.map((cell, x) => cell === area ? [x, y] : null).filter(Boolean));
    const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
    if (points.length !== (Math.max(...xs) - Math.min(...xs) + 1) * (Math.max(...ys) - Math.min(...ys) + 1))
      throw fail("layout-area", `Area ${area} must fill one rectangle.`);
  }
  if (body.length < 1) throw fail("layout-region", "Draw at least one content region.");
  const selected = {};
  for (const area of body) {
    const input = regions?.[area];
    if (!input || !Array.isArray(input.accepts) || !input.accepts.length || input.accepts.some((kind) => !LAYOUT_REGION_KINDS.includes(kind)))
      throw fail("layout-region", `Choose accepted content kinds for ${area}.`);
    if (input.role && !LAYOUT_REGION_ROLES.includes(input.role)) throw fail("layout-region", `Choose a valid role for ${area}.`);
    if (input.flow && !LAYOUT_REGION_FLOWS.includes(input.flow)) throw fail("layout-region", `Choose a valid flow for ${area}.`);
    selected[area] = { accepts: [...new Set(input.accepts)], ...(input.role ? { role: input.role } : {}), ...(input.flow ? { flow: input.flow } : {}) };
  }
  const record = { name: name.trim(), areas, regions: selected };
  if (summary?.trim()) record.summary = summary.trim();
  if (columns) record.columns = columns;
  if (rows) record.rows = rows;
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
  return editor.applyPatch(prepared.patches, { source: "layout-grid", rejectInvalid: true });
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
  if (!Array.isArray(record?.areas)) return "";
  try { layoutTemplate(record); return layoutStructure(record); } catch { return "Invalid region template"; }
}
