import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CONTENT_CONVERSIONS,
  CONTENT_KIND_LABELS,
  OPFConversionError,
  contentConversionTargets,
  convertContent,
  convertListForm,
  readContent,
} from "../dist/convert.js";
import * as root from "../dist/convert.js";
import { check } from './support/validation.mjs';


const convert = (payload, to, options) => convertContent(payload, to, options);
const refused = (payload, to, pattern, options) =>
  assert.throws(
    () => convert(payload, to, options),
    (error) => error instanceof OPFConversionError && error.code === "not-convertible" && pattern.test(error.message),
  );
const valid = (block) => check({ slides: [{ blocks: [block] }] }).valid;

describe("contract", () => {
  test("the matrix, labels and readContent describe the supported kinds", () => {
    assert.deepEqual(Object.keys(CONTENT_CONVERSIONS).sort(), ["chart", "code", "group", "list", "metric", "quote", "table", "text", "timeline"]);
    for (const [from, targets] of Object.entries(CONTENT_CONVERSIONS)) {
      assert.ok(CONTENT_KIND_LABELS[from], from);
      for (const target of targets) assert.ok(CONTENT_KIND_LABELS[target], target);
    }
    assert.deepEqual(readContent({ items: ["a"] }), { key: "items", kind: "list", content: ["a"] });
    assert.deepEqual(readContent({ bullets: ["a"] }).kind, "list");
    assert.equal(readContent({ text: "a", items: ["b"] }), undefined);
    assert.equal(readContent({ image: "a.png" }).kind, "image");
    assert.equal(readContent({ blocks: [{ text: "a" }] }).kind, "group");
    assert.equal(readContent(null), undefined);
  });

  test("conversions are pure, deterministic and keep id and extensions", () => {
    const payload = { id: "x", extensions: { a: 1 }, type: "text", text: "One\nTwo" };
    const before = structuredClone(payload);
    const result = convert(payload, "list");
    assert.deepEqual(payload, before);
    assert.deepEqual(result.payload, { id: "x", extensions: { a: 1 }, type: "list", items: ["One", "Two"] });
    assert.deepEqual(convert(payload, "list"), result);
    assert.equal(result.from, "text");
    assert.equal(result.to, "list");
    assert.equal(result.lossless, true);
  });

  test("a slide that holds one content field converts and keeps its slide fields", () => {
    const result = convert({ title: "Plan", notes: "n", text: "a\nb" }, "list");
    assert.deepEqual(result.payload, { title: "Plan", notes: "n", items: ["a", "b"] });
  });

  test("the same kind is a no-op and an unsupported pair is refused with the supported targets", () => {
    const same = convert({ text: "a" }, "text");
    assert.equal(same.changed, false);
    assert.deepEqual(same.payload, { text: "a" });
    refused({ image: "a.png" }, "text", /cannot be converted to text/);
    refused({ quote: "a" }, "list", /converts to: text\./);
    refused({ text: "a", items: ["b"] }, "list", /Choose a payload/);
  });

  test("targets report available, lossless, loss and the reason for a refusal", () => {
    const targets = contentConversionTargets({ items: [{ text: "a", level: 1 }, "b"] });
    assert.deepEqual(
      targets.map((target) => [target.kind, target.available, target.lossless]),
      [
        ["text", true, false],
        ["timeline", true, false],
        ["table", true, false],
      ],
    );
    assert.deepEqual(targets[0].loss, ["list nesting levels (renumbered to follow the previous item)"]);
    const text = contentConversionTargets({ text: "A very long first line that is not a metric value at all\nsecond" });
    const metric = text.find((target) => target.kind === "metric");
    assert.equal(metric.available, false);
    assert.match(metric.reason, /longer than 24 characters/);
    assert.deepEqual(contentConversionTargets({ image: "a.png" }), []);
    assert.deepEqual(contentConversionTargets({ blocks: [{ text: "a" }] }), []);
  });

  test("the module is exported from the package subpath only", async () => {
    const index = await import("../dist/index.js");
    assert.equal(index.convertContent, undefined);
    assert.equal(typeof root.convertContent, "function");
  });
});

describe("text pairs", () => {
  test("text to list: one item per line, blank lines reported, formatting kept", () => {
    const result = convert({ text: ["Bold ", { text: "line", bold: true }, "\nPlain\n\nLast"] }, "list");
    assert.deepEqual(result.payload.items, [["Bold ", { text: "line", bold: true }], "Plain", "Last"]);
    assert.deepEqual(result.loss, ["blank lines"]);
  });

  test("text to list reads indentation and markers as levels and reports numbering", () => {
    const result = convert({ text: "- Top\n  - Child\n    * Grandchild\n- Next\n1. Numbered" }, "list");
    assert.deepEqual(result.payload.items, ["Top", { text: "Child", level: 1 }, { text: "Grandchild", level: 2 }, "Next", "Numbered"]);
    assert.deepEqual(result.loss, ["list numbering"]);
    const tabs = convert({ text: "a\n\tb\n\t\tc\nd" }, "list");
    assert.deepEqual(tabs.payload.items, ["a", { text: "b", level: 1 }, { text: "c", level: 2 }, "d"]);
    assert.equal(tabs.lossless, true);
    // A line like "-5 degrees" has no marker.
    assert.deepEqual(convert({ text: "-5 degrees\n*bold*" }, "list").payload.items, ["-5 degrees", "*bold*"]);
  });

  test("list to text writes levels as indentation and round trips", () => {
    const list = { items: ["Top", { text: "Child", level: 1 }, { text: "Grandchild", level: 2 }, "Next"] };
    const text = convert(list, "text");
    assert.equal(text.payload.text, "Top\n  Child\n    Grandchild\nNext");
    assert.equal(text.lossless, true);
    assert.deepEqual(convert(text.payload, "list").payload, list);
  });

  test("list to text keeps descriptions as indented lines and says so; gaps in levels are reported", () => {
    const described = convert({ items: [{ text: "A", description: "about A" }] }, "text");
    assert.equal(described.payload.text, "A\n  about A");
    assert.deepEqual(described.loss, ["list item descriptions (kept as indented lines)"]);
    const gap = convert({ items: ["A", { text: "B", level: 3 }] }, "text");
    assert.deepEqual(gap.loss, ["list nesting levels (renumbered to follow the previous item)"]);
  });

  test("text to quote reads a trailing dash line as the attribution, never more", () => {
    assert.deepEqual(convert({ text: "Be brave.\n— Jane Doe, CTO" }, "quote").payload.quote, { text: "Be brave.", attribution: "Jane Doe, CTO" });
    for (const dash of ["–", "--", "~", "-"]) assert.equal(convert({ text: `Line one.\nLine two.\n${dash} Jane Doe` }, "quote").payload.quote.attribution, "Jane Doe", dash);
    // Two trailing dash lines are the attribution and the source.
    assert.deepEqual(convert({ text: "Quote.\n— Jane, CTO\n— Customer interview" }, "quote").payload.quote, { text: "Quote.", attribution: "Jane, CTO", source: "Customer interview" });
    // A closing quote mark followed by a dash on a quote that opens with a quote mark.
    assert.deepEqual(convert({ text: "“Be brave.” — Jane Doe" }, "quote").payload.quote, { text: "“Be brave.”", attribution: "Jane Doe" });
    // Ambiguous: a dashed list, a lone line, a long line, a dash inside a sentence.
    assert.equal(convert({ text: "- one\n- two\n- three" }, "quote").payload.quote.attribution, undefined);
    assert.equal(convert({ text: "— Jane Doe" }, "quote").payload.quote.attribution, undefined);
    assert.equal(convert({ text: `Body.\n— ${"x".repeat(130)}` }, "quote").payload.quote.attribution, undefined);
    assert.equal(convert({ text: "Wait — what?" }, "quote").payload.quote.attribution, undefined);
    assert.equal(convert({ text: "No quote mark here — Jane Doe" }, "quote").payload.quote.attribution, undefined);
  });

  test("quote to text round trips with attribution and source", () => {
    const quote = { quote: { text: "Be brave.\nStay kind.", attribution: "Jane Doe, CTO", source: "Customer interview, March 2026" } };
    const text = convert(quote, "text");
    assert.equal(text.payload.text, "Be brave.\nStay kind.\n— Jane Doe, CTO\n— Customer interview, March 2026");
    assert.equal(text.lossless, true);
    assert.deepEqual(convert(text.payload, "quote").payload, quote);
    assert.equal(convert({ quote: "Just words" }, "text").payload.text, "Just words");
    const flat = convert({ text: ["Some ", { text: "bold", bold: true }, "\n— Name"] }, "quote");
    assert.deepEqual(flat.loss, ["text formatting"]);
  });

  test("text to metric and back keep the value, label and description", () => {
    const metric = convert({ text: "42\nCustomers\nSigned this quarter\nup from 30" }, "metric");
    assert.deepEqual(metric.payload.metric, { value: 42, label: "Customers", description: "Signed this quarter\nup from 30" });
    const text = convert({ metric: { value: "$12.4M", unit: "", label: "Revenue", delta: "+12%", trend: "up" } }, "text");
    assert.equal(text.payload.text, "$12.4M\nRevenue\n+12%");
    assert.deepEqual(text.loss, ["metric trend"]);
    assert.equal(convert({ metric: { value: 3, unit: "ms" } }, "text").payload.text, "3 ms");
    assert.equal(convert({ metric: { value: 3, unit: "%" } }, "text").payload.text, "3%");
    assert.equal(convert({ metric: { value: 3, unit: "ms" } }, "text").lossless, true);
    refused({ text: "A value that is much longer than a metric needs\nLabel" }, "metric", /longer than 24 characters/);
    refused({ text: "\n\n" }, "metric", /needs a value/);
  });

  test("text to code reads one fenced block with its language and file name and nothing else", () => {
    const fenced = convert({ text: '```ts title="app.ts"\nconst a = 1;\nconst b = 2;\n```' }, "code");
    assert.deepEqual(fenced.payload.code, { source: "const a = 1;\nconst b = 2;", language: "ts", filename: "app.ts" });
    assert.deepEqual(convert({ text: "~~~python\nprint(1)\n~~~" }, "code").payload.code, { source: "print(1)", language: "python" });
    assert.deepEqual(convert({ text: "````\n```\ninner\n```\n````" }, "code").payload.code, { source: "```\ninner\n```" });
    // No fence: the whole text is the source and no language is guessed.
    assert.deepEqual(convert({ text: "def f():\n    pass" }, "code").payload.code, { source: "def f():\n    pass" });
    // Text around the fence is not one fenced block: it stays source.
    assert.deepEqual(convert({ text: "Intro\n```js\nx\n```" }, "code").payload.code, { source: "Intro\n```js\nx\n```" });
  });

  test("code to text fences the code when it has a language or file name, so the round trip is lossless", () => {
    const code = { code: { source: "let a = `x`;\nlet b;", language: "js", filename: "a.js" } };
    const text = convert(code, "text");
    assert.equal(text.lossless, true);
    assert.equal(text.payload.text.split("\n")[0], '```js title="a.js"');
    assert.deepEqual(convert(text.payload, "code").payload, code);
    const bare = convert({ code: "plain source" }, "text");
    assert.equal(bare.payload.text, "plain source");
    const never = convert(code, "text", { fences: "never" });
    assert.equal(never.payload.text, "let a = `x`;\nlet b;");
    assert.deepEqual(never.loss, ["code language", "code filename"]);
    // A fence longer than any backtick run in the source.
    const tricky = convert({ code: { source: "```\nx\n```", language: "md" } }, "text");
    assert.equal(tricky.payload.text.split("\n")[0], "````md");
    assert.deepEqual(convert(tricky.payload, "code").payload.code, { source: "```\nx\n```", language: "md" });
  });

  test("text to table reads Markdown pipe tables and tab separated lines", () => {
    const markdown = convert({ text: "| Region | Revenue |\n| --- | ---: |\n| North | 12 |\n| South \\| East | 8 |" }, "table");
    assert.deepEqual(markdown.payload.table, { columns: ["Region", "Revenue"], rows: [["North", "12"], ["South | East", "8"]] });
    const tabs = convert({ text: "a\tb\nc\td" }, "table");
    assert.deepEqual(tabs.payload.table, { rows: [["a", "b"], ["c", "d"]] });
    assert.deepEqual(convert({ text: "a\tb\nc\td" }, "table", { header: true }).payload.table, { columns: ["a", "b"], rows: [["c", "d"]] });
    assert.deepEqual(convert({ text: "a;b\nc;d" }, "table", { delimiter: ";" }).payload.table.rows, [["a", "b"], ["c", "d"]]);
    refused({ text: "just words\nand more words" }, "table", /no table structure/);
    refused({ text: "a\tb\nc" }, "table", /no table structure/);
    refused({ text: "a\tb\nc\td\te" }, "table", /Line 2 has 3 cells/);
  });

  test("table to text round trips through Markdown (headings) and tabs (no headings)", () => {
    const headed = { table: { columns: ["Region", "Revenue"], rows: [["North", "12"], ["South | East", "8"]] } };
    const text = convert(headed, "text");
    assert.equal(text.payload.text, "| Region | Revenue |\n| --- | --- |\n| North | 12 |\n| South \\| East | 8 |");
    assert.deepEqual(convert(text.payload, "table").payload, headed);
    const bare = { table: { rows: [["a", "b"], ["c", "d"]] } };
    assert.equal(convert(bare, "text").payload.text, "a\tb\nc\td");
    assert.deepEqual(convert(convert(bare, "text").payload, "table").payload, bare);
    const styled = convert({ table: { rows: [[{ value: "a", style: { fill: "primary" } }, 1]] } }, "text");
    assert.deepEqual(styled.loss, ["cell styles"]);
    refused({ table: { rows: [["a\tb", "c"]] } }, "text", /tab/);
  });
});

describe("timeline pairs", () => {
  test("text to timeline reads dates in the unambiguous patterns and descriptions from indented lines", () => {
    const result = convert(
      { text: ["2024 — Launch", "Q1 2026: Pilot", "Jan - Kickoff", "2026-03-15 Review: skipped", "Q2 2026 – Rollout", "  to every region", "Week 3: Training", "No date here"].join("\n") },
      "timeline",
    );
    assert.deepEqual(result.payload.timeline, [
      { when: "2024", what: "Launch" },
      { when: "Q1 2026", what: "Pilot" },
      { when: "Jan", what: "Kickoff" },
      { what: "2026-03-15 Review: skipped" },
      { when: "Q2 2026", what: "Rollout", description: "to every region" },
      { when: "Week 3", what: "Training" },
      { what: "No date here" },
    ]);
    assert.equal(result.lossless, true);
    // An ordinary label before a colon is not a date, unless asked.
    assert.deepEqual(convert({ text: "Note: be careful" }, "timeline").payload.timeline, [{ what: "Note: be careful" }]);
    assert.deepEqual(convert({ text: "Launch week: pilot" }, "timeline", { looseWhen: true }).payload.timeline, [{ when: "Launch week", what: "pilot" }]);
    refused({ text: "   \n" }, "timeline", /needs at least one event/);
  });

  test("timeline to text and back keeps dates and descriptions, and reports the metadata a text cannot hold", () => {
    const timeline = { timeline: [{ when: "2024", what: "Launch", description: "Soft launch" }, { when: "Q1 2026", what: "Pilot" }, { what: "Later" }] };
    const text = convert(timeline, "text");
    assert.equal(text.payload.text, "2024: Launch\n  Soft launch\nQ1 2026: Pilot\nLater");
    assert.equal(text.lossless, true);
    assert.deepEqual(convert(text.payload, "timeline").payload, timeline);
    const named = convert({ timeline: { name: "Plan", description: "d", events: [{ what: "A" }] } }, "text");
    assert.deepEqual(named.loss, ["timeline name", "timeline description"]);
  });

  test("list to timeline and timeline to list carry text and descriptions directly", () => {
    const toTimeline = convert({ items: ["2024 — Launch", { text: "Q1: Pilot", description: "Small", level: 1 }, "Later"] }, "timeline");
    assert.deepEqual(toTimeline.payload.timeline, [{ when: "2024", what: "Launch" }, { when: "Q1", what: "Pilot", description: "Small" }, { what: "Later" }]);
    assert.deepEqual(toTimeline.loss, ["list nesting levels"]);
    const toList = convert({ timeline: [{ when: "2024", what: "Launch", description: "Soft" }, { what: "Later" }] }, "list");
    assert.deepEqual(toList.payload.items, [{ text: "2024: Launch", description: "Soft" }, "Later"]);
    assert.equal(toList.lossless, true);
    assert.deepEqual(convert(toList.payload, "timeline").payload.timeline, [{ when: "2024", what: "Launch", description: "Soft" }, { what: "Later" }]);
    assert.deepEqual(convert({ items: [["Rich ", { text: "item", bold: true }]] }, "timeline").loss, ["text formatting"]);
  });

  test("timeline to table and back is lossless", () => {
    const timeline = { timeline: [{ when: "Q1", what: "Pilot", description: "Small" }, { what: "Rollout" }] };
    const table = convert(timeline, "table");
    assert.deepEqual(table.payload.table, { columns: ["When", "What", "Description"], rows: [["Q1", "Pilot", "Small"], [null, "Rollout", null]] });
    assert.equal(table.lossless, true);
    assert.deepEqual(convert(table.payload, "timeline").payload, timeline);
    assert.deepEqual(convert({ timeline: [{ what: "A" }, { what: "B" }] }, "table").payload.table, { columns: ["What"], rows: [["A"], ["B"]] });
    assert.deepEqual(convert(timeline, "table", { headings: false }).payload.table.columns, undefined);
    assert.deepEqual(convert({ timeline: { name: "Plan", events: [{ what: "A" }] } }, "table").loss, ["timeline name"]);
  });

  test("table to timeline reads columns by heading, reports extra columns and refuses guesses", () => {
    const table = { table: { columns: ["Date", "Milestone", "Owner", "Notes"], rows: [["2026", "Pilot", "Ana", "small"], ["2027", "Scale", "Bo", null]] } };
    const result = convert(table, "timeline");
    assert.deepEqual(result.payload.timeline, [{ when: "2026", what: "Pilot", description: "small" }, { when: "2027", what: "Scale" }]);
    assert.deepEqual(result.loss, ['column "Owner"']);
    // One unnamed column next to a date column is the event.
    assert.deepEqual(convert({ table: { columns: ["When", "Step"], rows: [["Q1", "Plan"]] } }, "timeline").payload.timeline, [{ when: "Q1", what: "Plan" }]);
    assert.deepEqual(convert({ table: { columns: ["x", "y"], rows: [["Q1", "Plan"]] } }, "timeline", { columns: { when: 0, what: 1 } }).payload.timeline, [{ when: "Q1", what: "Plan" }]);
    refused({ table: { rows: [["Q1", "Plan"]] } }, "timeline", /Add a heading row/);
    refused({ table: { columns: ["Alpha", "Beta", "Gamma"], rows: [["a", "b", "c"]] } }, "timeline", /No column holds the event text/);
    refused({ table: { columns: ["When", "What"], rows: [[{ value: "a", colSpan: 2 }, null]] } }, "timeline", /merged cells/);
  });
});

describe("list and table pairs", () => {
  test("list to table: one column, or item and description, without invented headings", () => {
    assert.deepEqual(convert({ items: ["a", ["Rich ", { text: "b", bold: true }]] }, "table").payload.table, { rows: [["a"], [["Rich ", { text: "b", bold: true }]]] });
    assert.deepEqual(convert({ items: ["a", { text: "b", description: "bd" }] }, "table").payload.table, { rows: [["a", null], ["b", "bd"]] });
    refused({ items: [] }, "table", /needs at least one row/);
  });

  test("list to table and back is lossless without nesting", () => {
    for (const list of [{ items: ["a", "b", ["Rich ", { text: "c", bold: true }]] }, { items: ["a", { text: "b", description: "bd" }, { text: "c", description: ["Rich ", { text: "d", italic: true }] }] }]) {
      const table = convert(list, "table");
      assert.equal(table.lossless, true);
      assert.deepEqual(convert(table.payload, "list").payload, list);
    }
    assert.deepEqual(convert({ items: ["a", { text: "b", level: 1 }] }, "table").loss, ["list nesting levels"]);
  });

  test("table to list: first column is the item, other columns the description, with the loss reported", () => {
    const wide = convert({ table: { columns: ["Name", "Role", "Team"], rows: [["Ana", "Lead", "Core"], ["Bo", "Dev", null], ["Cy", null, null]] } }, "list");
    assert.deepEqual(wide.payload.items, [{ text: "Ana", description: "Lead, Core" }, { text: "Bo", description: "Dev" }, "Cy"]);
    assert.deepEqual(wide.loss, ["column headings", "table columns beyond the second (joined into the description)"]);
    assert.deepEqual(convert({ table: { rows: [[1, true], ["x", ""]] } }, "list").payload.items, [{ text: "1", description: "true" }, "x"]);
    assert.deepEqual(convert({ table: { rows: [[{ value: "a", style: { fill: "primary" } }]] } }, "list").loss, ["cell styles"]);
    refused({ table: { rows: [[{ value: "a", rowSpan: 2 }], [null]] } }, "list", /merged cells/);
    refused({ table: { rows: [] } }, "list", /no rows/);
  });
});

describe("metric sets and tables", () => {
  const metrics = {
    blocks: [
      { metric: { value: 42, label: "Customers", unit: "k", delta: "+12%", trend: "up", description: "Signed" } },
      { metric: { value: "$1.2M", label: "Revenue", delta: -3, trend: "down" } },
      { metric: { value: 9, label: "Churn", trend: "flat" } },
    ],
  };

  test("a group of metrics becomes a table with only the columns it uses, and back", () => {
    const table = convert(metrics, "table");
    assert.deepEqual(table.payload.table.columns, ["Label", "Value", "Unit", "Delta", "Trend", "Description"]);
    assert.deepEqual(table.payload.table.rows[1], ["Revenue", "$1.2M", null, -3, "down", null]);
    assert.equal(table.lossless, true);
    const back = convert(table.payload, "metrics");
    assert.deepEqual(back.payload, metrics);
    assert.equal(back.lossless, true);
    assert.deepEqual(convert({ blocks: [{ metric: 1 }, { metric: "2" }] }, "table").payload.table, { columns: ["Value"], rows: [[1], ["2"]] });
  });

  test("a group's arrangement and block ids cannot be kept and are reported; a slide keeps its composition", () => {
    const grouped = convert({ id: "g", composition: { mode: "row" }, blocks: [{ id: "m1", metric: 1 }, { metric: 2 }] }, "table");
    assert.deepEqual(grouped.loss, ["block ids and extensions", "group arrangement (composition)"]);
    assert.equal(grouped.payload.id, "g");
    const slide = convert({ title: "KPIs", composition: { mode: "row" }, blocks: [{ metric: 1 }, { metric: 2 }] }, "table");
    assert.equal(slide.payload.composition.mode, "row");
    assert.deepEqual(slide.loss, []);
  });

  test("only groups of metrics convert; a mixed group is refused with the block", () => {
    assert.deepEqual(contentConversionTargets({ blocks: [{ metric: 1 }, { text: "x" }] }), []);
    refused({ blocks: [{ metric: 1 }, { text: "x" }] }, "table", /cannot be converted|Block 2 is not a metric/);
  });

  test("table to metrics needs headings and a value, and reports what it drops", () => {
    refused({ table: { rows: [["A", 1]] } }, "metrics", /Add a heading row/);
    refused({ table: { columns: ["A", "B"], rows: [["x", "y"]] } }, "metrics", /No column holds the metric value/);
    refused({ table: { columns: ["Label", "Value"], rows: [["x", null]] } }, "metrics", /Row 1 has no value/);
    const result = convert({ table: { columns: ["Metric", "Amount", "Owner", "Trend"], rows: [["Users", 5, "Ana", "sideways"]] } }, "metrics");
    assert.deepEqual(result.payload.blocks, [{ metric: { value: 5, label: "Users" } }]);
    assert.deepEqual(result.loss, ['column "Owner"', "trend values other than up, down or flat"]);
  });
});

describe("chart and table", () => {
  test("chart to table keeps the data and reports the chart type; table to chart needs plain numbers", () => {
    const chart = { chart: { type: "bar", data: { columns: ["Q", "Sales"], rows: [["Q1", 5], ["Q2", 7]] } } };
    const table = convert(chart, "table");
    assert.deepEqual(table.payload.table, { columns: ["Q", "Sales"], rows: [["Q1", 5], ["Q2", 7]] });
    assert.deepEqual(table.loss, ["chart type"]);
    const back = convert(table.payload, "chart");
    assert.deepEqual(back.payload.chart, { type: "column", data: chart.chart.data });
    assert.equal(back.lossless, true);
    assert.deepEqual(convert({ table: { columns: ["Q", "Sales"], rows: [["Q1", "5"], ["Q2", ""]] } }, "chart").payload.chart.data.rows, [["Q1", 5], ["Q2", null]]);
    refused({ chart: { type: "bar", data: { columns: ["A"] } } }, "table", /no inline columns and rows/);
    refused({ table: { rows: [["a", 1]] } }, "chart", /plain text label/);
    refused({ table: { columns: ["A", "B"], rows: [["x", "many"]] } }, "chart", /not a number/);
    refused({ table: { columns: ["A", "B"], rows: [["x"]] } }, "chart", /does not have 2 cells/);
    refused({ table: { columns: ["A", "B"], rows: [[{ value: "x", style: {} }, 1]] } }, "chart", /styled, merged/);
  });
});

describe("list form", () => {
  test("items and bullets convert with descriptions reported", () => {
    const toBullets = convertListForm({ items: ["a", { text: "b", level: 1 }, { text: "c", description: "cd", level: 1 }] }, "bullets");
    assert.deepEqual(toBullets.payload, { bullets: ["a", { text: "b", level: 1 }, { text: "c", level: 1 }] });
    assert.deepEqual(toBullets.loss, ["list item descriptions"]);
    const back = convertListForm({ bullets: ["a", { text: "b", level: 1 }] }, "items");
    assert.deepEqual(back.payload, { items: ["a", { text: "b", level: 1 }] });
    assert.equal(back.lossless, true);
    assert.equal(convertListForm({ items: ["a"] }, "items").changed, false);
    assert.throws(() => convertListForm({ text: "a" }, "items"), OPFConversionError);
  });
});

describe("every conversion in the matrix", () => {
  const samples = {
    text: { text: "One\nTwo" },
    list: { items: ["One", "Two"] },
    quote: { quote: { text: "Quote", attribution: "Name" } },
    metric: { metric: { value: 5, label: "Users" } },
    code: { code: { source: "a = 1", language: "py" } },
    timeline: { timeline: [{ when: "2026", what: "Go" }] },
    chart: { chart: { type: "column", data: { columns: ["A", "B"], rows: [["x", 1]] } } },
    table: { table: { columns: ["When", "What", "Label", "Value"], rows: [["2026", "Go", "Users", 5]] } },
    group: { blocks: [{ metric: 1 }, { metric: 2 }] },
  };
  const overrides = { "text:table": { text: "a\tb\nc\td" }, "table:chart": { table: { columns: ["A", "B"], rows: [["x", 1]] } } };
  for (const [from, targets] of Object.entries(CONTENT_CONVERSIONS)) {
    for (const to of targets) {
      test(`${from} to ${to} is valid OPF, reports its loss and does not throw a raw error`, () => {
        const result = convert(overrides[`${from}:${to}`] ?? samples[from], to);
        assert.equal(result.changed, true);
        assert.equal(result.lossless, result.loss.length === 0);
        const payload = result.payload;
        assert.ok(valid(payload) || to === "metrics", JSON.stringify(payload));
        assert.deepEqual(readContent(payload)?.kind, to === "metrics" ? "group" : to);
      });
    }
  }
});
