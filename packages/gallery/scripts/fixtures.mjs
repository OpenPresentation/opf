// The fixture decks of the pixel-stability check (scripts/stability.mjs) and of the layout previews
// (scripts/render-previews.mjs): one deck per record a minor release must draw the same. A theme, colour scheme or font
// scheme gets the sample deck below with that record as its design. A layout (an OPF 0.19 grid template,
// opf-layout/v2) gets two slides: one with sample content in every region (three blocks in a flowing region, one in a
// `none` region, each pinned to its region) and one with every region empty, which exercises collapse. A layout's
// fixture is built from the PREVIOUS release's record, so both releases draw the same content and only the record
// differs.

/** A 2 x 2 picture: the payload of the 1.x layout fixtures (opf-layout/v1 records, drawn only against a 1.x release). */
const IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGNkYPjPwMDAxMDAwMDAAAAOxAEBu2mUigAAAABJRU5ErkJggg==";

/** A landscape (sky over two green ridges), as an SVG picture: the picture of the template fixtures and the previews. */
const PICTURE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100" width="1600" height="1000"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7aa7e6"/><stop offset="1" stop-color="#cfe0f5"/></linearGradient></defs><rect width="160" height="100" fill="url(#s)"/><path d="M0 62 Q40 40 80 58 T160 50 V100 H0 Z" fill="#3f8a55"/><path d="M0 78 Q50 64 100 76 T160 72 V100 H0 Z" fill="#2f6b42"/></svg>';
export const PICTURE = `data:image/svg+xml;base64,${Buffer.from(PICTURE_SVG).toString("base64")}`;

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

const pick = (values, index) => values[index % values.length];

/** The `index`-th sample block of a content kind (blocks of one region differ, so a preview reads as real content). */
export function sampleBlock(kind, index = 0) {
  switch (kind) {
    case "text":
      return { text: pick(["Revenue grew 18% on new accounts while churn held flat.", "Two field teams piloted the new workflow for six weeks.", "Support tickets fell by a third after the redesign.", "Every region now reports on one weekly cadence."], index) };
    case "list":
      return { items: pick([["Close the audit gaps", "Pilot with two teams", "Report every week"], ["Hire two engineers", "Ship the mobile beta", "Retire the old portal"], ["Agree the budget", "Name the owners", "Review in March"]], index) };
    case "image":
      return { image: { src: PICTURE, alt: pick(["Field team at work", "The new office", "Product in use"], index) } };
    case "video":
      return { video: { src: PICTURE, alt: pick(["Product walkthrough", "Customer story", "Launch film"], index) } };
    case "chart":
      return { chart: { type: pick(["column", "line", "bar"], index), data: { columns: ["Quarter", "Current", "Baseline"], rows: [["Q1", 26 + index, 23], ["Q2", 30, 25 + index], ["Q3", 33 - index, 27], ["Q4", 37, 29]] } } };
    case "table":
      return { table: { columns: ["Workstream", "Owner", "Status"], rows: [["Compliance", "Program lead", "On track"], ["Reporting", "Analytics", "Watch"], ["Adoption", "Operations", "At risk"]] } };
    case "code":
      return { code: { language: "javascript", source: pick(["const total = items.reduce((sum, item) => sum + item.value, 0);\nconsole.log(total);", "export function share(part, whole) {\n  return whole ? part / whole : 0;\n}"], index) } };
    case "metric":
      return { metric: pick([{ value: "18%", label: "Net revenue growth", trend: "up" }, { value: "3.1M", label: "Active users", trend: "up" }, { value: "42", label: "Net promoter score", trend: "flat" }], index) };
    case "quote":
      return { quote: pick([{ text: "The plan makes the sequence of choices explicit.", attribution: "Program sponsor" }, { text: "We finally see the whole pipeline in one place.", attribution: "Sales lead" }, { text: "Onboarding now takes minutes, not days.", attribution: "Customer" }], index) };
    case "timeline":
      return { timeline: { events: [{ when: "Q1", what: "Baseline" }, { when: "Q2", what: "Pilot" }, { when: "Q3", what: "Launch" }, { when: "Q4", what: "Scale" }] } };
    case "group":
      return { blocks: [sampleBlock("image", index), { text: pick(["Ana Ruiz, Chief Executive", "Sam Lee, Head of Product", "Kai Moreau, Engineering Lead"], index) }] };
    default:
      return sampleBlock("text", index);
  }
}

/**
 * The body regions of a layout record, in reading order: `[name, region]` pairs for every named region of the record's
 * `regions` tree except the `title` and `subtitle` headings. A region inherits `anchor` from the nearest split or the
 * record that sets one, as core's compile does; nothing else inherits.
 */
export function bodyRegions(record) {
  const out = [];
  const walk = (list, anchor) => {
    for (const entry of Array.isArray(list) ? list : []) {
      const inherited = entry.anchor ?? anchor;
      if (Array.isArray(entry.regions)) walk(entry.regions, inherited);
      else if (entry.name !== "title" && entry.name !== "subtitle") {
        const { name, size, ...rules } = entry;
        out.push([name, inherited !== undefined && rules.anchor === undefined ? { ...rules, anchor: inherited } : rules]);
      }
    }
  };
  walk(record?.regions, record?.anchor);
  return out;
}

/** The sample kind of a region: its first accepted kind (a `group` region gets a picture-and-text group). */
export function regionKind(region) {
  return region?.accepts?.[0] ?? "text";
}

/** How many sample blocks a region gets: one in a `none` region, else three (never more than its `max`). */
export function regionCount(region) {
  if ((region?.flow ?? "auto") === "none") return 1;
  return Math.min(3, region?.max ?? 6);
}

const TITLE = "Quarterly operating plan";
const SUBTITLE = "Review for the leadership team";

/** The two slides of a template's fixture: every region filled (blocks pinned to their region), then every region empty. */
export function templateDeck(id, record) {
  const blocks = [];
  const used = {};
  for (const [name, region] of bodyRegions(record)) {
    const kind = regionKind(region);
    for (let count = 0; count < regionCount(region); count += 1) {
      // Counted per kind across the slide, so two regions of one kind show different samples.
      const index = used[kind] ?? 0;
      used[kind] = index + 1;
      blocks.push({ region: name, ...sampleBlock(kind, index) });
    }
  }
  const filled = { layout: id, title: TITLE, subtitle: SUBTITLE };
  if (blocks.length) filled.blocks = blocks;
  return { name: `Layout fixture ${id}`, slides: [filled, { layout: id, title: TITLE, subtitle: SUBTITLE }] };
}

const HEADINGS = new Set(["title", "subtitle", "tag"]);

/** The leaf placeholder kinds of a 1.x layout record (opf-layout/v1) in reading order (groups flattened). */
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

/** The fixture deck of a 1.x layout record (opf-layout/v1): its headings and a sample block per body placeholder. */
export function legacyLayoutDeck(id, record) {
  const kinds = leafKinds(record?.placeholders);
  const slide = { layout: id, title: TITLE };
  if (kinds.includes("subtitle")) slide.subtitle = SUBTITLE;
  if (kinds.includes("tag")) slide.tag = "Plan";
  const body = kinds.filter((kind) => !HEADINGS.has(kind)).map((kind) => SAMPLE_BLOCKS[kind] ?? SAMPLE_BLOCKS.text);
  if (body.length) slide.blocks = body.map((block) => structuredClone(block));
  return { name: `Layout fixture ${id}`, slides: [slide] };
}

/** Whether a layout record is an OPF region-list template (it has a `regions` array), not a 1.x placeholder record. */
export const isTemplate = (record) => Array.isArray(record?.regions);

/** The fixture deck of one layout record: a template's two slides, or a 1.x record's one slide. */
export function layoutDeck(id, record) {
  return isTemplate(record) ? templateDeck(id, record) : legacyLayoutDeck(id, record);
}

/** The sample deck a design record is drawn on: a cover, a list, a chart, a table, a quote and a metric slide. */
export function designDeck(designKey, id) {
  return {
    name: `Design fixture ${designKey} ${id}`,
    design: { [designKey]: id },
    slides: [
      { title: TITLE, subtitle: SUBTITLE, tag: "Plan" },
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
