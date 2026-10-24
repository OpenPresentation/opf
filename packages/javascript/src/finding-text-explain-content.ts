/**
 * The hand-written `fix` and example of the content rules, for `explain` (`finding-text-explain.ts`). Internal module.
 */
import { type ExplainDetail, ex } from "./finding-text-explain-util.js";

const COLUMNS = ["Quarter", "Revenue", "Costs"];
const ROWS = [["Q1", 12, 8], ["Q2", 15, 9]];
const ARC = (duration: Record<string, number>) => ({ name: "Arc", duration, beats: [{ id: "hook", name: "Hook" }, { id: "proof", name: "Proof" }, { id: "ask", name: "Ask" }] });

export const CONTENT_EXPLAIN: Readonly<Record<string, ExplainDetail>> = {
  "opf/chart-value-not-numeric": ex(
    "Store the value as a number and put units, currency or percent in the column `format`. A text value is plotted as a gap.",
    { title: "Revenue", chart: { type: "column", alt: "Revenue", data: { columns: ["Quarter", "Revenue"], rows: [["Q1", "about 12"]] } } },
    { title: "Revenue", chart: { type: "column", alt: "Revenue", data: { columns: ["Quarter", { name: "Revenue", format: "$#,##0" }], rows: [["Q1", 12]] } } },
  ),
  "opf/chart-mapping-adapted": ex(
    "Remove the mapping entry, or name a column the chart type can use. The entry is ignored.",
    { title: "Revenue", chart: { type: "column", alt: "Revenue", data: { columns: COLUMNS, rows: ROWS }, mapping: { x: "Costs" } } },
    { title: "Revenue", chart: { type: "column", alt: "Revenue", data: { columns: COLUMNS, rows: ROWS } } },
  ),
  "opf/chart-highlight-adapted": ex(
    "Name a series the chart plots in `highlight`, or remove the entry. A column that is the category or X column, or that the mapping leaves out, highlights nothing.",
    { title: "Revenue", chart: { type: "column", alt: "Revenue", data: { columns: COLUMNS, rows: ROWS }, highlight: { series: ["Quarter"] } } },
    { title: "Revenue", chart: { type: "column", alt: "Revenue", data: { columns: COLUMNS, rows: ROWS }, highlight: { series: ["Revenue"] } } },
  ),
  "opf/code-highlight-out-of-range": ex(
    "Change the entry to a line the code has (counted from 1), or remove it.",
    { title: "Code", code: { source: "a\nb\nc", highlight: [7] } },
    { title: "Code", code: { source: "a\nb\nc", highlight: [3] } },
  ),
  "opf/code-highlight-range-reversed": ex(
    "Write the range with the smaller line number first, or remove it.",
    { title: "Code", code: { source: "a\nb\nc", highlight: [[3, 1]] } },
    { title: "Code", code: { source: "a\nb\nc", highlight: [[1, 3]] } },
  ),
  "opf/variable-builtin-missing": ex(
    "Add the field the built-in reads (for example `speaker.name`, `organization.tagline` or the deck's `name`), or remove the token.",
    { slides: [{ title: "{{speaker.name}}" }] },
    { speaker: { name: "Ada Lovelace" }, slides: [{ title: "{{speaker.name}}" }] },
  ),
  "opf/duration-outside-narrative": ex(
    "Change `duration`, or choose a narrative that suits it. The range describes the narrative, so nothing is drawn differently.",
    { duration: 5, narrative: "arc", catalogs: { custom: { narratives: { arc: ARC({ min: 10, max: 20 }) } } }, slides: [{ title: "Intro", beat: "hook" }] },
    { duration: 15, narrative: "arc", catalogs: { custom: { narratives: { arc: ARC({ min: 10, max: 20 }) } } }, slides: [{ title: "Intro", beat: "hook" }] },
  ),
  "opf/narrative-duration-range": ex(
    "Swap the bounds so `min` is the shortest and `max` the longest talk length, in minutes.",
    { catalogs: { custom: { narratives: { arc: ARC({ min: 30, max: 10 }) } } }, slides: [{ title: "Intro" }] },
    { catalogs: { custom: { narratives: { arc: ARC({ min: 10, max: 30 }) } } }, slides: [{ title: "Intro" }] },
  ),
  "opf/placeholder-text": ex(
    "Replace the placeholder (lorem ipsum, \"Click to add title\", TBD, [Insert ...]) with the real text.",
    { title: "Overview", text: "Lorem ipsum dolor sit amet" },
    { title: "Overview", text: "Revenue grew in every quarter." },
  ),
  "opf/empty-text": ex(
    "Write the text, or remove the empty field or item.",
    { title: "Next steps", items: ["Hire two engineers", ""] },
    { title: "Next steps", items: ["Hire two engineers", "Ship the beta"] },
  ),
  "opf/unused-beat": ex(
    "Link a slide to the beat with `beat`, or ignore this when the beat is optional for your talk.",
    { duration: 15, narrative: "arc", catalogs: { custom: { narratives: { arc: ARC({ min: 10, max: 20 }) } } }, slides: [{ title: "One", beat: "hook" }, { title: "Two", beat: "proof" }] },
    { duration: 15, narrative: "arc", catalogs: { custom: { narratives: { arc: ARC({ min: 10, max: 20 }) } } }, slides: [{ title: "One", beat: "hook" }, { title: "Two", beat: "proof" }, { title: "Three", beat: "ask" }] },
  ),
  "opf/empty-slide": ex(
    "Add content or a title, remove the slide, or give it the `blank` layout if it is meant to be empty.",
    { slides: [{ title: "Intro", text: "Welcome" }, { id: "spare" }] },
    { slides: [{ title: "Intro", text: "Welcome" }, { id: "spare", title: "Questions", text: "Ask away" }] },
  ),
  "opf/language-tag": ex(
    "Write a well-formed BCP 47 tag with an assigned region, such as `en-GB` (the United Kingdom is `GB`, not `UK`), `pt-BR` or `es-419`.",
    { language: { bcp47: "fr-UK" }, slides: [{ title: "Bienvenue" }] },
    { language: { bcp47: "fr-GB" }, slides: [{ title: "Bienvenue" }] },
  ),
};
