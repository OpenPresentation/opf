/**
 * The hand-written `fix` and example of the format, references and policy rules, for `explain` (`finding-text-explain.ts`). Internal module.
 * Examples are slide-level objects unless they carry `slides` (a whole deck) or are listed as deck-level in the test; the test checks that each
 * `problem` triggers its rule and each `fixed` does not.
 */
import { CHART, type ExplainDetail, ex } from "./finding-text-explain-util.js";

const IMG = (name: string) => ({ src: `https://example.com/${name}.png`, alt: "Team at the offsite" });

export const FORMAT_EXPLAIN: Readonly<Record<string, ExplainDetail>> = {
  "opf/json-syntax": ex(
    "Fix the error at the marked position; the message names the root cause (a missing comma, a quote, a bracket that is never closed), and later errors usually disappear with it.",
    '{\n  "name": "Q3 review"\n  "slides": [{ "title": "Revenue" }]\n}',
    '{\n  "name": "Q3 review",\n  "slides": [{ "title": "Revenue" }]\n}',
  ),
  "opf/duplicate-key": ex(
    "Keep one of the two keys, or merge their values into one. JSON keeps only the last value, so the earlier one is ignored.",
    '{\n  "name": "Q3 review",\n  "slides": [{ "title": "Revenue" }],\n  "name": "Q4 review"\n}',
    '{\n  "name": "Q4 review",\n  "slides": [{ "title": "Revenue" }]\n}',
  ),
  "opf/schema": ex(
    "Change the value to the form the message names (its type, one of the allowed values, or the missing field). The message says which field and what it should be.",
    { title: "Revenue", items: "Grew 12%" },
    { title: "Revenue", items: ["Grew 12%"] },
  ),
  "opf/reference-id-duplicate": ex(
    "Give each reference its own id. Runs cite a reference by its id, so two with the same id cannot be told apart.",
    { references: [{ id: "gartner", text: "Gartner, 2026" }, { id: "gartner", text: "IDC, 2026" }], slides: [{ title: "Market", text: [{ text: "Up 12%", cite: "gartner" }] }] },
    { references: [{ id: "gartner", text: "Gartner, 2026" }, { id: "idc", text: "IDC, 2026" }], slides: [{ title: "Market", text: [{ text: "Up 12%", cite: "gartner" }] }] },
  ),
  "opf/cite-unknown-reference": ex(
    "Change `cite` to the id of a reference under `references`, or add the reference it names.",
    { references: [{ id: "gartner", text: "Gartner, 2026" }], slides: [{ title: "Market", text: [{ text: "Up 12%", cite: "gartnr" }] }] },
    { references: [{ id: "gartner", text: "Gartner, 2026" }], slides: [{ title: "Market", text: [{ text: "Up 12%", cite: "gartner" }] }] },
  ),
  "opf/cite-unsupported-location": ex(
    "Move the cited run into a text block, bullets or a list item (titles and quotes work too). Table cells, captions and reference text do not draw citation markers.",
    { references: [{ id: "gartner", text: "Gartner, 2026" }], slides: [{ title: "Market", table: { columns: ["Region", "Growth"], rows: [["EMEA", [{ text: "12%", cite: "gartner" }]]] } }] },
    { references: [{ id: "gartner", text: "Gartner, 2026" }], slides: [{ title: "Market", text: [{ text: "EMEA grew 12%", cite: "gartner" }], table: { columns: ["Region", "Growth"], rows: [["EMEA", "12%"]] } }] },
  ),
  "opf/caption-unsupported-payload": ex(
    "Put the `caption` on the image, chart, table or video it describes, or remove it.",
    { title: "Revenue", blocks: [{ text: "Revenue grew", caption: "Source: finance" }] },
    { title: "Revenue", blocks: [{ chart: CHART, caption: "Source: finance" }] },
  ),
  "opf/image-option-unsupported-payload": ex(
    "Remove the image option, or move it onto an image block. Options such as `fit`, `shape` and `overlay` describe how a picture is drawn.",
    { title: "Revenue", chart: CHART, fit: "cover" },
    { title: "Revenue", image: IMG("team"), fit: "cover" },
  ),
  "opf/image-placement-invalid": ex(
    "Use `placement` on a top-level block of the slide, with one placed image per slide edge.",
    { title: "Team", blocks: [{ image: IMG("a"), placement: { edge: "left" } }, { image: IMG("b"), placement: { edge: "left" } }] },
    { title: "Team", blocks: [{ image: IMG("a"), placement: { edge: "left" } }, { image: IMG("b"), placement: { edge: "right" } }] },
  ),
  "opf/layout-placeholder-group": ex(
    "Flatten the group so it nests at most three levels, and keep the headings (title, subtitle, tag) at the record's top level. Layout records written for current versions use `regions`, where the same limits apply to splits.",
    { placeholders: [{ type: "group", placeholders: [{ type: "title" }, { type: "text" }] }] },
    { placeholders: [{ type: "title" }, { type: "group", placeholders: [{ type: "text" }, { type: "chart" }] }] },
  ),
  "opf/dataset-unknown": ex(
    "Name a dataset that exists under `datasets`, or add the one the chart or table asks for.",
    { datasets: { sales: { columns: ["Quarter", "Revenue"], rows: [["Q1", 12]] } }, slides: [{ title: "Revenue", chart: { type: "column", data: { dataset: "sale" } } }] },
    { datasets: { sales: { columns: ["Quarter", "Revenue"], rows: [["Q1", 12]] } }, slides: [{ title: "Revenue", chart: { type: "column", data: { dataset: "sales" } } }] },
  ),
  "opf/dataset-field-unknown": ex(
    "Name only columns the dataset has. The message lists them.",
    { datasets: { sales: { columns: ["Region", "Revenue"], rows: [["EMEA", 12]] } }, slides: [{ title: "Revenue", table: { dataset: "sales", fields: ["Regon"] } }] },
    { datasets: { sales: { columns: ["Region", "Revenue"], rows: [["EMEA", 12]] } }, slides: [{ title: "Revenue", table: { dataset: "sales", fields: ["Region"] } }] },
  ),
  "opf/data-column-duplicate": ex(
    "Rename one of the columns so every name is unique. Series, mappings and fields address columns by name.",
    { datasets: { sales: { columns: ["Region", "Region"], rows: [["EMEA", 12]] } }, slides: [{ title: "Revenue", table: { dataset: "sales" } }] },
    { datasets: { sales: { columns: ["Region", "Region-2"], rows: [["EMEA", 12]] } }, slides: [{ title: "Revenue", table: { dataset: "sales" } }] },
  ),
  "opf/chart-mapping-unknown-column": ex(
    "Name a column the chart data has in `mapping`. The message lists them.",
    { title: "Revenue", chart: { type: "column", data: { columns: ["Quarter", "Revenue"], rows: [["Q1", 12]] }, mapping: { series: ["Profit"] } } },
    { title: "Revenue", chart: { type: "column", data: { columns: ["Quarter", "Revenue"], rows: [["Q1", 12]] }, mapping: { series: ["Revenue"] } } },
  ),
  "opf/number-format-invalid": ex(
    "Write the format as an Excel-style pattern with a numeric part, such as `0.0`, `#,##0`, `0%` or `$#,##0.00`.",
    { title: "Revenue", table: { columns: [{ name: "Revenue", format: "units" }], rows: [[12]] } },
    { title: "Revenue", table: { columns: [{ name: "Revenue", format: "$#,##0" }], rows: [[12]] } },
  ),
  "opf/variable-invalid-value": ex(
    "Give the variable a value of its declared type: a plain number for `number`, a date for `date`, a hex color for `color`. The values are what a host passes when it fills the deck (`validate` option `values`, `opf fill`); a declared `value` of the wrong type is reported by the schema.",
    { values: { seats: "many" } },
    { values: { seats: 40 } },
  ),
  "opf/variable-unknown-builtin": ex(
    "Use a built-in that exists (`deck.name`, `deck.description`, `deck.author`, `speaker.name`, `organization.name`, `slide.number`, ...), or declare your own variable under `variables`.",
    { slides: [{ title: "{{deck.nmae}}" }] },
    { name: "Q3 review", slides: [{ title: "{{deck.name}}" }] },
  ),
  "opf/chart-highlight-unknown-name": ex(
    "Name a series or category the chart data has in `highlight`; a name that matches nothing highlights nothing.",
    { title: "Revenue", chart: { type: "column", data: { columns: ["Quarter", "Revenue"], rows: [["Q1", 12], ["Q2", 15]] }, highlight: { categories: ["Q9"] } } },
    { title: "Revenue", chart: { type: "column", data: { columns: ["Quarter", "Revenue"], rows: [["Q1", 12], ["Q2", 15]] }, highlight: { categories: ["Q2"] } } },
  ),
  "opf/variable-format": ex(
    "Give the variable a `format` that fits its type and its values: `#,##0.0` for a number, a date pattern for a date.",
    { variables: { amount: { type: "number", value: 1e308, format: "0%" } }, slides: [{ title: "Value {{amount}}" }] },
    { variables: { amount: { type: "number", value: 12.5, format: "#,##0.0" } }, slides: [{ title: "Value {{amount}}" }] },
  ),
  "opf/variable-unfilled": ex(
    "Give the variable a `value`, fill the deck before use, or mark the deck as a template with `template: true`. Otherwise the `{{token}}` would show as typed.",
    { variables: { client: { type: "text", label: "Client" } }, slides: [{ title: "Proposal for {{client}}" }] },
    { variables: { client: { type: "text", label: "Client", value: "Acme" } }, slides: [{ title: "Proposal for {{client}}" }] },
  ),
};
