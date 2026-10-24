/**
 * The hand-written `fix` and example of the accessibility and layout rules, for `explain` (`finding-text-explain.ts`). Internal module.
 */
import { CHART, type ExplainDetail, ex } from "./finding-text-explain-util.js";

const WHITE = { background: { type: "solid", color: "#FFFFFF" } };
const ROADMAP = { name: "Roadmap", regions: [{ name: "title" }, { direction: "row", regions: [{ name: "timeline", accepts: ["timeline"], max: 1 }, { name: "notes", accepts: ["text", "list"], flow: "column" }] }] };
const TIMELINE = { timeline: { events: [{ when: "Q1", what: "Pilot" }, { when: "Q2", what: "Launch" }] } };
const SERIES = (count: number) => ({ columns: ["Quarter", ...Array.from({ length: count }, (_, i) => `S${i + 1}`)], rows: [["Q1", ...Array.from({ length: count }, (_, i) => i + 1)]] });

export const AUDIT_EXPLAIN: Readonly<Record<string, ExplainDetail>> = {
  "opf/text-contrast": ex(
    "Pick a text color with enough contrast against the background (3:1 for large text, 4.5:1 for normal text), or remove the color override so the theme chooses a readable one.",
    { design: WHITE, slides: [{ title: "Results", text: [{ text: "Faint note", color: "#CCCCCC" }] }] },
    { design: WHITE, slides: [{ title: "Results", text: [{ text: "Readable note", color: "text" }] }] },
  ),
  "opf/text-on-image": ex(
    "Add a full-frame overlay to the background image, or put the text on a solid or gradient background or a card, so contrast does not depend on the picture.",
    { title: "Welcome", design: { background: { type: "image", src: "https://example.com/hero.jpg" } } },
    { title: "Welcome", design: { background: { type: "image", src: "https://example.com/hero.jpg", overlay: { color: "#FFFFFF", opacity: 1 } } } },
  ),
  "opf/missing-alt-text": ex(
    "Describe the picture in `alt`, or write `alt: \"\"` when it is only decoration.",
    { title: "Team", image: "https://example.com/team.png" },
    { title: "Team", image: { src: "https://example.com/team.png", alt: "The team at the 2026 offsite" } },
  ),
  "opf/poor-alt-text": ex(
    "Write what a person who cannot see the picture needs to know, in plain words and without a leading \"image of\".",
    { title: "Team", image: { src: "https://example.com/team.png", alt: "IMG_2041.png" } },
    { title: "Team", image: { src: "https://example.com/team.png", alt: "Five people around a whiteboard" } },
  ),
  "opf/missing-slide-title": ex(
    "Give the slide a `title`. Screen reader users find slides by title, and PowerPoint's outline uses it.",
    { text: "Revenue grew in every quarter." },
    { title: "Revenue grew", text: "Revenue grew in every quarter." },
  ),
  "opf/duplicate-slide-title": ex(
    "Give each slide a title that tells it apart, for example by adding the part of the story it covers.",
    { slides: [{ title: "Results", text: "Q1" }, { title: "Results", text: "Q2" }] },
    { slides: [{ title: "Results: Q1", text: "Q1" }, { title: "Results: Q2", text: "Q2" }] },
  ),
  "opf/reading-order": ex(
    "Reorder the blocks so the order they are read in follows the order they appear in, or choose a layout that puts the title first.",
    { title: "Plan", blocks: [{ text: "Second thing to read", region: "right" }, { text: "First thing to read", region: "left" }] },
    { title: "Plan", blocks: [{ text: "First thing to read", region: "left" }, { text: "Second thing to read", region: "right" }] },
  ),
  "opf/link-text": ex(
    "Make the link text say where the link goes, for example the name of the page or file.",
    { title: "Report", text: ["Read the report: ", { text: "click here", link: "https://example.com/report" }] },
    { title: "Report", text: ["Read ", { text: "the 2026 annual report (PDF)", link: "https://example.com/report" }] },
  ),
  "opf/chart-color-only": ex(
    "Show fewer series, choose more distinct colors, or add data labels or a direct legend so the chart does not depend on telling colors apart.",
    { title: "Trend", chart: { type: "line", alt: "Fourteen series", data: SERIES(14) } },
    { title: "Trend", chart: { type: "line", alt: "Two series", data: SERIES(2) } },
  ),
  "opf/chart-colors-adjusted": ex(
    "Use a color that resolves (a hex color, a scheme color or a declared `var:`) and has at least 3:1 contrast against the chart panel, or remove `colors` to use the palette.",
    { title: "Revenue", chart: { ...CHART, colors: ["var:missing"] } },
    { title: "Revenue", chart: { ...CHART, colors: ["accent1"] } },
  ),
  "opf/chart-text-alternative": ex(
    "Write the message the chart carries in `alt`, or add a subtitle, text or table beside it that states what it shows.",
    { title: "Revenue", chart: { type: "column", data: CHART.data } },
    { title: "Revenue", chart: { type: "column", alt: "Revenue rose from 12 to 15 million between Q1 and Q2.", data: CHART.data } },
  ),
  "opf/missing-language": ex(
    "Set the deck's `language` to a BCP 47 tag such as `en-US`. It chooses fonts, text direction and the proofing language, and screen readers pronounce the text with it.",
    { slides: [{ title: "Welcome" }] },
    { language: "en-US", slides: [{ title: "Welcome" }] },
  ),
  "opf/chart-option-adapted": ex(
    "Remove the option, or choose a chart type that can show it. Every engine draws the adapted result.",
    { title: "Share", chart: { type: "pie", alt: "Share by region", data: { columns: ["Region", "Share"], rows: [["EMEA", 60], ["APAC", 40]] }, axisTitles: { value: "Share" } } },
    { title: "Share", chart: { type: "pie", alt: "Share by region", data: { columns: ["Region", "Share"], rows: [["EMEA", 60], ["APAC", 40]] } } },
  ),
  "opf/text-overflow": ex(
    "Shorten the text, give it more space (fewer blocks, a different composition) or split the slide. Raising the readable minimum makes it worse.",
    { title: "Notes", composition: { minFontSize: 16 }, blocks: [{ text: "word ".repeat(600).trim() }, { text: "More" }] },
    { title: "Notes", blocks: [{ text: "The three points that matter." }, { text: "More" }] },
  ),
  "opf/unresolved-content": ex(
    "Supply what the message asks for (for example the organization logo a picture bullet needs), or remove the setting that cannot be honored.",
    { design: { listBullet: "image" }, slides: [{ title: "Steps", items: ["One", "Two"] }] },
    { slides: [{ title: "Steps", items: ["One", "Two"] }] },
  ),
  "opf/layout-failed": ex(
    "Fix the composition setting or the content structure the message names. The checks that need the layout are skipped for that slide until it can be laid out.",
    { catalogs: { custom: { layouts: { broken: { name: "Broken", regions: [{ name: "title" }], composition: { padding: 5 } } } } }, slides: [{ title: "Welcome", layout: "broken" }] },
    { catalogs: { custom: { layouts: { broken: { name: "Broken", regions: [{ name: "title" }] } } } }, slides: [{ title: "Welcome", layout: "broken" }] },
  ),
  "opf/min-font-size": ex(
    "Raise the font size to the readable minimum or more, or shorten the text so it can be drawn larger.",
    { title: "Notes", text: [{ text: "Tiny print", fontSize: 8 }] },
    { title: "Notes", text: [{ text: "Readable print", fontSize: 14 }] },
  ),
  "opf/region-unknown": ex(
    "Pin the block to a region the layout has, or remove `region` so the block is placed by its kind.",
    { catalogs: { custom: { layouts: { roadmap: ROADMAP } } }, slides: [{ layout: "roadmap", blocks: [{ region: "timelin", ...TIMELINE }] }] },
    { catalogs: { custom: { layouts: { roadmap: ROADMAP } } }, slides: [{ layout: "roadmap", blocks: [{ region: "timeline", ...TIMELINE }] }] },
  ),
  "opf/region-kind": ex(
    "Pin the block to a region that accepts its kind, or remove `region`.",
    { catalogs: { custom: { layouts: { roadmap: ROADMAP } } }, slides: [{ layout: "roadmap", blocks: [{ region: "timeline", text: "Note" }] }] },
    { catalogs: { custom: { layouts: { roadmap: ROADMAP } } }, slides: [{ layout: "roadmap", blocks: [{ region: "notes", text: "Note" }] }] },
  ),
  "opf/region-full": ex(
    "Pin the block to another region with room, or remove `region` so it is placed by its kind.",
    { catalogs: { custom: { layouts: { roadmap: ROADMAP } } }, slides: [{ layout: "roadmap", blocks: [{ region: "timeline", ...TIMELINE }, { region: "timeline", ...TIMELINE }] }] },
    { catalogs: { custom: { layouts: { roadmap: ROADMAP } } }, slides: [{ layout: "roadmap", blocks: [{ region: "timeline", ...TIMELINE }] }] },
  ),
  "opf/layout-unplaced": ex(
    "Paginate the slide, choose a layout with more room, pin the block to a region with room, or remove a block.",
    { catalogs: { custom: { layouts: { roadmap: ROADMAP } } }, slides: [{ layout: "roadmap", blocks: [{ ...TIMELINE }, { ...TIMELINE }] }] },
    { catalogs: { custom: { layouts: { roadmap: ROADMAP } } }, slides: [{ layout: "roadmap", blocks: [{ ...TIMELINE }] }] },
  ),
  "opf/furniture-wraps": ex(
    "Shorten the header or footer text, or move part of it to another zone. Headers and footers should fit on two lines.",
    { design: { footer: { left: { text: "A footer that keeps going and going and going and going and going and going and going and going and going and going" } } }, slides: [{ title: "Welcome" }] },
    { design: { footer: { left: { text: "Acme, confidential" }, right: { text: "{{slide.number}}" } } }, slides: [{ title: "Welcome" }] },
  ),
  "opf/font-outside-scheme": ex(
    "Remove `fontFamily` so the text uses the scheme font, or add the family to the deck's font scheme so it follows scheme changes.",
    { design: { fontScheme: "aptos" }, slides: [{ title: "Notes", text: [{ text: "Hand-set", fontFamily: "Comic Sans MS" }] }] },
    { design: { fontScheme: "aptos" }, slides: [{ title: "Notes", text: [{ text: "Hand-set" }] }] },
  ),
  "opf/image-resolution": ex(
    "Use an image with more pixels for the size it is shown at (about 96 per inch), or show it smaller.",
    { title: "Team", image: { src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkAAAAAAAAAAAA", alt: "Team" } },
    { title: "Team", image: { src: "https://example.com/team-2400x1350.png", alt: "Team" } },
  ),
};
