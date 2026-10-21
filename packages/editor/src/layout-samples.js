// Sample content for the layout editor's Preview (RR-99): a one-slide deck that uses the layout and fills each region with blocks of the
// kinds it accepts, so the host's renderer can draw the layout as it will look. The blocks are the ones the Gallery draws its layout
// previews with. Pure data; no DOM.
import { clone } from "./layout-tree.js";
import { LAYOUT_REGION_KINDS } from "./layout-templates.js";

const PICTURE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100" width="1600" height="1000"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7aa7e6"/><stop offset="1" stop-color="#cfe0f5"/></linearGradient></defs><rect width="160" height="100" fill="url(#s)"/><path d="M0 62 Q40 40 80 58 T160 50 V100 H0 Z" fill="#3f8a55"/><path d="M0 78 Q50 64 100 76 T160 72 V100 H0 Z" fill="#2f6b42"/></svg>';
const toBase64 = (text) => (typeof globalThis.btoa === "function" ? globalThis.btoa(text) : globalThis.Buffer.from(text).toString("base64"));
/** A landscape picture as an SVG data URI. */
export const SAMPLE_PICTURE = `data:image/svg+xml;base64,${toBase64(PICTURE_SVG)}`;

const pick = (values, index) => values[index % values.length];

/** The `index`-th sample block of a content kind; blocks of one region differ, so a preview reads as real content. */
export function sampleBlock(kind, index = 0) {
  switch (kind) {
    case "text":
      return { text: pick(["Revenue grew 18% on new accounts while churn held flat.", "Two field teams piloted the new workflow for six weeks.", "Support tickets fell by a third after the redesign."], index) };
    case "list":
      return { items: pick([["Close the audit gaps", "Pilot with two teams", "Report every week"], ["Hire two engineers", "Ship the mobile beta", "Retire the old portal"], ["Agree the budget", "Name the owners", "Review in March"]], index) };
    case "image":
      return { image: { src: SAMPLE_PICTURE, alt: pick(["Field team at work", "The new office", "Product in use"], index) } };
    case "video":
      return { video: { src: SAMPLE_PICTURE, alt: pick(["Product walkthrough", "Customer story", "Launch film"], index) } };
    case "chart":
      return { chart: { type: pick(["column", "line", "bar"], index), data: { columns: ["Quarter", "Current", "Baseline"], rows: [["Q1", 26 + index, 23], ["Q2", 30, 25 + index], ["Q3", 33 - index, 27], ["Q4", 37, 29]] } } };
    case "table":
      return { table: { columns: ["Workstream", "Owner", "Status"], rows: [["Compliance", "Program lead", "On track"], ["Reporting", "Analytics", "Watch"], ["Adoption", "Operations", "At risk"]] } };
    case "code":
      return { code: { language: "javascript", source: pick(["const total = items.reduce((sum, item) => sum + item.value, 0);\nconsole.log(total);", "export function share(part, whole) {\n  return whole ? part / whole : 0;\n}"], index) } };
    case "metric":
      return { metric: pick([{ value: "18%", label: "Net revenue growth", trend: "up" }, { value: "3.1M", label: "Active users", trend: "up" }, { value: "42", label: "Net promoter score", trend: "flat" }], index) };
    case "quote":
      return { quote: pick([{ text: "The plan makes the sequence of choices explicit.", attribution: "Program sponsor" }, { text: "We finally see the whole pipeline in one place.", attribution: "Sales lead" }], index) };
    case "timeline":
      return { timeline: { events: [{ when: "Q1", what: "Baseline" }, { when: "Q2", what: "Pilot" }, { when: "Q3", what: "Launch" }, { when: "Q4", what: "Scale" }] } };
    case "group":
      return { blocks: [sampleBlock("image", index), { text: pick(["Ana Ruiz, Chief Executive", "Sam Lee, Head of Product", "Kai Moreau, Engineering Lead"], index) }] };
    default:
      return sampleBlock("text", index);
  }
}

/** The body regions of a record in reading order, as `{ name, region }`. */
export function bodyRegions(record) {
  const out = [];
  const walk = (list) => {
    for (const entry of Array.isArray(list) ? list : []) {
      if (entry && Array.isArray(entry.regions) && entry.name === undefined) walk(entry.regions);
      else if (entry && typeof entry.name === "string" && entry.name !== "title" && entry.name !== "subtitle") out.push({ name: entry.name, region: entry });
    }
  };
  walk(record?.regions);
  return out;
}

/** How many sample blocks a region gets: one for `flow: "none"`, else up to three (never more than its `max`). */
export const regionSampleCount = (region) => (region?.flow === "none" ? 1 : Math.min(3, region?.max ?? 6));
/** The kinds a region's samples cycle through: its `accepts`, or text, list and image when it accepts everything. */
export const regionSampleKinds = (region) => (Array.isArray(region?.accepts) && region.accepts.length ? region.accepts.filter((kind) => LAYOUT_REGION_KINDS.includes(kind)) : ["text", "list", "image"]);

/**
 * A one-slide deck that uses `record` (embedded as a custom layout) with sample content pinned to every body region. The slide has a
 * title and a subtitle, so the heading regions show as well.
 */
export function sampleDeck(record) {
  const { $schema, id, ...layout } = clone(record);
  void $schema;
  const key = typeof id === "string" && /^[a-z][a-z0-9-]*$/.test(id) && id !== "auto" ? id : "layout-preview";
  const blocks = [];
  const used = {};
  for (const { name, region } of bodyRegions(record)) {
    const kinds = regionSampleKinds(region);
    for (let count = 0; count < regionSampleCount(region); count++) {
      const kind = kinds[count % kinds.length] ?? "text";
      const index = used[kind] ?? 0;
      used[kind] = index + 1;
      blocks.push({ region: name, ...sampleBlock(kind, index) });
    }
  }
  const slide = { layout: key, title: "Quarterly operating plan", subtitle: "Review for the leadership team" };
  if (blocks.length) slide.blocks = blocks;
  return { name: "Layout preview", catalogs: { custom: { layouts: { [key]: layout } } }, slides: [slide] };
}
