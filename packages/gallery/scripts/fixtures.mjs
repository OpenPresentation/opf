// The fixture decks of the pixel-stability check (scripts/stability.mjs, RR-78): one deck per record a minor release must
// draw the same. A layout gets one slide with representative content in every region it declares; a theme, colour scheme
// or font scheme gets the sample deck below with that record as its design. A layout's fixture is built from the
// PREVIOUS release's record, so both releases draw the same content and only the record differs.

const IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGNkYPjPwMDAxMDAwMDAAAAOxAEBu2mUigAAAABJRU5ErkJggg==";

/** One representative payload per body placeholder kind. */
export const SAMPLE_BLOCKS = Object.freeze({
  text: { text: "Revenue grew 18% on new accounts while churn held flat across every region." },
  list: { items: ["Close the audit evidence gaps", "Pilot with two field teams", "Report progress every week"] },
  image: { image: { src: IMAGE, alt: "Field team at work" } },
  video: { video: { src: IMAGE, alt: "Product walkthrough" } },
  chart: { chart: { type: "column", data: { columns: ["Quarter", "Current", "Baseline"], rows: [["Q1", 26, 23], ["Q2", 30, 25], ["Q3", 33, 27], ["Q4", 37, 29]] } } },
  table: { table: { columns: ["Workstream", "Owner", "Status"], rows: [["Compliance", "Program lead", "On track"], ["Reporting", "Analytics", "Watch"], ["Adoption", "Operations", "At risk"]] } },
  code: { code: { language: "javascript", source: "const total = items.reduce((sum, item) => sum + item.value, 0);" } },
  metric: { metric: { value: "18%", label: "Net revenue growth", trend: "up" } },
  quote: { quote: { text: "The plan makes the sequence of choices explicit.", attribution: "Program sponsor" } },
  timeline: { timeline: { events: [{ when: "May", what: "Baseline" }, { when: "Jun", what: "Pilot" }, { when: "Jul", what: "Launch" }] } },
});

const HEADINGS = new Set(["title", "subtitle", "tag"]);

/** The leaf placeholder kinds of a layout record in reading order (groups flattened, as composition fills them). */
export function leafKinds(placeholders) {
  const out = [];
  const visit = (entries) => {
    for (const entry of Array.isArray(entries) ? entries : []) {
      if (entry && entry.type === "group") visit(entry.placeholders);
      else if (entry && typeof entry.type === "string") out.push(entry.type);
    }
  };
  visit(placeholders);
  return out;
}

/** The fixture deck of one layout: its headings and a sample block per body region. */
export function layoutDeck(id, record) {
  const kinds = leafKinds(record?.placeholders);
  const slide = { layout: id, title: "Quarterly operating plan" };
  if (kinds.includes("subtitle")) slide.subtitle = "Review for the leadership team";
  if (kinds.includes("tag")) slide.tag = "Plan";
  const body = kinds.filter((kind) => !HEADINGS.has(kind)).map((kind) => SAMPLE_BLOCKS[kind] ?? SAMPLE_BLOCKS.text);
  if (body.length) slide.blocks = body.map((block) => structuredClone(block));
  return { name: `Layout fixture ${id}`, slides: [slide] };
}

/** The sample deck a design record is drawn on: a cover, a list, a chart, a table, a quote and a metric slide. */
export function designDeck(designKey, id) {
  return {
    name: `Design fixture ${designKey} ${id}`,
    design: { [designKey]: id },
    slides: [
      { title: "Quarterly operating plan", subtitle: "Review for the leadership team", tag: "Plan" },
      { title: "Priorities", ...structuredClone(SAMPLE_BLOCKS.list) },
      { title: "Signal trend", ...structuredClone(SAMPLE_BLOCKS.chart) },
      { title: "Decision options", ...structuredClone(SAMPLE_BLOCKS.table) },
      { title: "What we heard", ...structuredClone(SAMPLE_BLOCKS.quote) },
      { title: "Headline number", ...structuredClone(SAMPLE_BLOCKS.metric) },
    ],
  };
}

/** The record kinds a release must draw the same, with the deck each record is drawn on. */
export const VISUAL_KINDS = Object.freeze([
  { kind: "layouts", deck: (id, previous) => layoutDeck(id, previous) },
  { kind: "themes", deck: (id) => designDeck("theme", id) },
  { kind: "colorSchemes", deck: (id) => designDeck("colorScheme", id) },
  { kind: "fontSchemes", deck: (id) => designDeck("fontScheme", id) },
]);

/** The kinds with no drawing of their own; a minor release may still not remove one of their ids. */
export const OTHER_KINDS = Object.freeze(["narratives", "audiences", "purposes", "tones"]);
