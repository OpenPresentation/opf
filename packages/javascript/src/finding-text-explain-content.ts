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
  "opf/data-cell-type": ex(
    "Write the cell as its column declares, or change the column's `type` to what it holds. `opf fix --audits` stores a number written as a strict decimal string (\"12\") as a number, and a number in a text column as text. Nothing is drawn differently.",
    { datasets: { sales: { columns: ["Quarter", { name: "Revenue", type: "number" }], rows: [["Q1", 12], ["Q2", "about 15"]] } }, slides: [{ title: "Revenue", table: { dataset: "sales" } }] },
    { datasets: { sales: { columns: ["Quarter", { name: "Revenue", type: "number" }], rows: [["Q1", 12], ["Q2", 15]] } }, slides: [{ title: "Revenue", table: { dataset: "sales" } }] },
  ),
  "opf/datasource-credentials": ex(
    "Remove the user, password, key or token from the data source and keep the secret in your own store. Name the connection in `connector` or `extensions`; the document never holds a credential.",
    { datasources: { warehouse: { src: "https://analyst:secret@data.example.com/export.csv" } }, slides: [{ title: "Revenue", text: "Revenue grew." }] },
    { datasources: { warehouse: { src: "https://data.example.com/export.csv" } }, slides: [{ title: "Revenue", text: "Revenue grew." }] },
  ),
  "opf/dataset-stale": ex(
    "Take the data from its data source again and update `retrieved`, or change the data source's `refreshEvery` to how often the data really needs taking. Only a validation given a date (`asOf`) reports it.",
    { datasources: { warehouse: { refreshEvery: "P1D" } }, datasets: { sales: { datasource: "warehouse", retrieved: "2026-01-01", columns: ["Quarter", "Revenue"], rows: [["Q1", 12]] } }, slides: [{ title: "Revenue", table: { dataset: "sales" } }] },
    { datasources: { warehouse: { refreshEvery: "P1D" } }, datasets: { sales: { datasource: "warehouse", retrieved: "2026-11-30", columns: ["Quarter", "Revenue"], rows: [["Q1", 12]] } }, slides: [{ title: "Revenue", table: { dataset: "sales" } }] },
  ),
  "opf/metric-data-stale": ex(
    "Write the computed number as the metric's value (apply the fix), or change the data link. A reader that does not compute draws the written number.",
    { datasets: { arr: { columns: ["Month", "ARR"], rows: [["2026-10", 4.2], ["2026-11", 4.4]] } }, slides: [{ title: "ARR", metric: { value: "$4.2M", data: { dataset: "arr", field: "ARR", aggregate: "last" } } }] },
    { datasets: { arr: { columns: ["Month", "ARR"], rows: [["2026-10", 4.2], ["2026-11", 4.4]] } }, slides: [{ title: "ARR", metric: { value: 4.4, data: { dataset: "arr", field: "ARR", aggregate: "last" } } }] },
  ),
  "opf/metric-data-aggregate": ex(
    "Use an aggregate that fits the column (first, last and count work on any column), or link a column typed number. The written value is drawn meanwhile.",
    { datasets: { arr: { columns: [{ name: "Region", type: "text" }, "ARR"], rows: [["EMEA", 4.4]] } }, slides: [{ title: "Regions", metric: { value: 1, data: { dataset: "arr", field: "Region", aggregate: "sum" } } }] },
    { datasets: { arr: { columns: [{ name: "Region", type: "text" }, "ARR"], rows: [["EMEA", 4.4]] } }, slides: [{ title: "Regions", metric: { value: 1, data: { dataset: "arr", field: "Region", aggregate: "count" } } }] },
  ),
  "opf/metric-data-empty": ex(
    "Check the filter and the field: a row has to meet the filter and give a usable cell. The written value is drawn meanwhile.",
    { datasets: { arr: { columns: ["Region", "ARR"], rows: [["EMEA", 4.4]] } }, slides: [{ title: "APAC", metric: { value: 3.1, data: { dataset: "arr", field: "ARR", aggregate: "last", filter: [{ field: "Region", op: "=", value: "APAC" }] } } }] },
    { datasets: { arr: { columns: ["Region", "ARR"], rows: [["EMEA", 4.4]] } }, slides: [{ title: "EMEA", metric: { value: 4.4, data: { dataset: "arr", field: "ARR", aggregate: "last", filter: [{ field: "Region", op: "=", value: "EMEA" }] } } }] },
  ),
  "opf/metric-data-delta": ex(
    "Give the change something to compare with: two rows for previous, a baseline filter that meets a row, a comparison value other than 0 for a percent. No change is drawn until then.",
    { datasets: { arr: { columns: ["Month", "ARR"], rows: [["2026-11", 4.4]] } }, slides: [{ title: "ARR", metric: { value: 4.4, data: { dataset: "arr", field: "ARR", aggregate: "last", delta: { compare: "previous" } } } }] },
    { datasets: { arr: { columns: ["Month", "ARR"], rows: [["2026-10", 4.2], ["2026-11", 4.4]] } }, slides: [{ title: "ARR", metric: { value: 4.4, delta: 0.2, data: { dataset: "arr", field: "ARR", aggregate: "last", delta: { compare: "previous" } } } }] },
  ),
  "opf/metric-unit-repeated": ex(
    "Drop the unit, or take its text out of the number format. The unit is printed after the value.",
    { title: "ARR", metric: { value: 4.4, unit: "M", format: "#,##0.0M" } },
    { title: "ARR", metric: { value: 4.4, format: "#,##0.0M" } },
  ),
  "opf/chart-mapping-adapted": ex(
    "Remove the mapping entry, or name a column the chart type can use. The entry is ignored.",
    { title: "Revenue", chart: { type: "column", alt: "Revenue", data: { columns: COLUMNS, rows: ROWS }, mapping: { x: "Costs" } } },
    { title: "Revenue", chart: { type: "column", alt: "Revenue", data: { columns: COLUMNS, rows: ROWS } } },
  ),
  "opf/chart-series-dropped": ex(
    "Use a chart type that plots every series (column, bar, line), or draw one chart per series. A one-series type draws only the first.",
    { title: "Revenue", chart: { type: "treemap", alt: "Revenue", data: { columns: COLUMNS, rows: ROWS } } },
    { title: "Revenue", chart: { type: "column", alt: "Revenue", data: { columns: COLUMNS, rows: ROWS } } },
  ),
  "opf/embed-credentials": ex(
    "Take the user name, password or secret query parameter out of `src`. Anyone who has the deck can read the address, and every export links to it; the host that shows the page holds the credential.",
    { title: "Dashboard", embed: "https://app.example.com/dashboards/revenue?api_key=abc123" },
    { title: "Dashboard", embed: "https://app.example.com/dashboards/revenue" },
  ),
  "opf/chart-highlight-adapted": ex(
    "Name a series the chart plots in `highlight`, or remove the entry. A column that is the category or X column, or that the mapping leaves out, highlights nothing.",
    { title: "Revenue", chart: { type: "column", alt: "Revenue", data: { columns: COLUMNS, rows: ROWS }, highlight: { series: ["Quarter"] } } },
    { title: "Revenue", chart: { type: "column", alt: "Revenue", data: { columns: COLUMNS, rows: ROWS }, highlight: { series: ["Revenue"] } } },
  ),
  "opf/table-color-scale-no-data": ex(
    "Name columns that hold numbers in `colorScale.columns`, or remove the color scale. A cell is shaded only when its value is a number.",
    { title: "Win rate", table: { columns: ["Region", "Q1"], rows: [["EMEA", "n/a"]], colorScale: { columns: ["Q1"] } } },
    { title: "Win rate", table: { columns: ["Region", "Q1"], rows: [["EMEA", 0.22]], colorScale: { columns: ["Q1"] } } },
  ),
  "opf/table-color-scale-range": ex(
    "Pin `min` below `max` and keep `center` between them, or leave the range to the data.",
    { title: "Win rate", table: { columns: ["Region", "Q1"], rows: [["EMEA", 0.22], ["APAC", 0.3]], colorScale: { columns: ["Q1"], min: 0.5, max: 0.4 } } },
    { title: "Win rate", table: { columns: ["Region", "Q1"], rows: [["EMEA", 0.22], ["APAC", 0.3]], colorScale: { columns: ["Q1"], min: 0, max: 0.4 } } },
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
  "opf/variable-group-omitted": ex(
    "Give one of the group's optional variables a value to draw the group, or move what should always show out of the group. Unfilled, the whole group is left out, its picture and card with it.",
    { template: true, variables: { quote: { type: "text", required: false } }, slides: [{ title: "Customers", blocks: [{ blocks: [{ image: { src: "https://example.com/portrait.jpg", alt: "A customer" } }, { text: "var:quote" }] }] }] },
    { template: true, variables: { quote: { type: "text", required: false, value: "It just works." } }, slides: [{ title: "Customers", blocks: [{ blocks: [{ image: { src: "https://example.com/portrait.jpg", alt: "A customer" } }, { text: "var:quote" }] }] }] },
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
  "opf/chart-dual-axis": ex(
    "Show the secondary series in a chart of its own beside this one, each with its own axis; two scales in one plot make crossings and heights meaningless. Drop `secondaryAxis` when the series share a unit.",
    { title: "Revenue and margin", chart: { type: "combo", alt: "Revenue and margin", data: { columns: ["Quarter", "Revenue", "Margin"], rows: [["Q1", 12, 0.31], ["Q2", 15, 0.34]] }, line: ["Margin"], secondaryAxis: ["Margin"] } },
    { title: "Revenue and margin", blocks: [{ chart: { type: "column", alt: "Revenue", data: { columns: ["Quarter", "Revenue"], rows: [["Q1", 12], ["Q2", 15]] } } }, { chart: { type: "line", alt: "Margin", data: { columns: ["Quarter", { name: "Margin", format: "0%" }], rows: [["Q1", 0.31], ["Q2", 0.34]] } } }] },
  ),
  "opf/chart-pie-many-slices": ex(
    "Show the parts as bars along one axis, which can be compared and ranked, or group the smallest categories into one \"Other\" slice.",
    { title: "Traffic sources", chart: { type: "pie", alt: "Traffic sources", data: { columns: ["Source", "Visits"], rows: [["Search", 48], ["Direct", 22], ["Social", 12], ["Email", 8], ["Referral", 5], ["Ads", 3], ["Other", 2]] } } },
    { title: "Traffic sources", chart: { type: "bar", alt: "Traffic sources", data: { columns: ["Source", "Visits"], rows: [["Search", 48], ["Direct", 22], ["Social", 12], ["Email", 8], ["Referral", 5], ["Ads", 3], ["Other", 2]] } } },
  ),
};
