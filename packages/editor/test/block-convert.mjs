// RR-06: safe content-type conversion. A conversion keeps the block's text, never adds content,
// reports what it cannot carry, refuses pairs with no meaning, and is one undoable patch.
import assert from "node:assert/strict";
import { validate } from "@openpresentation/opf";
import { renderSlideSvg } from "@openpresentation/opf-render/svg";
import { createEditorSession } from "../dist/index.js";
import { BLOCK_CONVERSIONS, BLOCK_KIND_LABELS, blockConversionTargets, blockPathForSelection, convertBlock, metricGroupForSelection, prepareBlockConversion, readBlockContent } from "../dist/block-convert.js";
import { switchDimension } from "../dist/switches.js";

const deck = () => ({
  name: "Conversion fixture",
  design: { theme: "minimal", fontScheme: "aptos" },
  slides: [
    {
      id: "blocks",
      title: "Blocks",
      blocks: [
        { id: "plain", text: "One\nTwo\nThree" },
        { id: "list", items: ["First", "Second"] },
        { id: "metric", metric: { value: 42, unit: "%", label: "Retention", description: "Quarter over quarter" } },
        { id: "quote", quote: { text: "Make the next step clear.", attribution: "Design team" } },
        { id: "code", code: { source: "const a = 1;\n\nconst b = 2;", language: "ts", filename: "a.ts" } },
        { id: "timeline", timeline: [{ when: "Now", what: "Prototype" }, { what: "Review" }] },
        { id: "chart", chart: { type: "column", data: { columns: ["Quarter", "Revenue"], rows: [["Q1", 12], ["Q2", 18]] } } },
        { id: "table", table: { columns: ["Quarter", "Revenue"], rows: [["Q1", "12"], ["Q2", 18]] } },
        { id: "image", image: "asset:none" },
      ],
    },
    { id: "inline", title: "Implicit", text: "Only text" },
    { id: "typed", title: "Typed", blocks: [{ type: "text", text: "Typed text" }] },
  ],
});
const withImage = () => {
  const presentation = deck();
  presentation.assets = { none: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP0cAAAAASUVORK5CYII=" };
  return presentation;
};
const session = () => createEditorSession(withImage(), { rejectInvalid: true });
const at = (index) => `slides.0.blocks.${index}`;
const kinds = ["plain", "list", "metric", "quote", "code", "timeline", "chart", "table", "image"];

// The matrix: documented pairs, nothing else.
assert.deepEqual(BLOCK_CONVERSIONS.text, ["list", "quote", "metric", "code", "timeline", "table"]);
assert.deepEqual(BLOCK_CONVERSIONS.list, ["text", "timeline", "table"]);
assert.deepEqual(BLOCK_CONVERSIONS.timeline, ["text", "list", "table"]);
assert.deepEqual(BLOCK_CONVERSIONS.table, ["chart", "list", "timeline", "text", "metrics"]);
assert.deepEqual(BLOCK_CONVERSIONS.group, ["table"]);
assert.deepEqual(BLOCK_CONVERSIONS.chart, ["table"]);
assert.equal(BLOCK_KIND_LABELS.list, "List");

// Targets: what each block can convert to, with its loss report.
{
  const presentation = withImage();
  const targets = (index) => Object.fromEntries(blockConversionTargets(presentation, at(index)).map((entry) => [entry.kind, entry]));
  assert.deepEqual(Object.keys(targets(0)), ["list", "quote", "metric", "code", "timeline", "table"]);
  assert.equal(targets(0).quote.lossless, true);
  assert.equal(targets(0).table.available, false, "plain lines are not a table");
  assert.match(targets(0).table.reason, /no table structure/);
  assert.deepEqual(targets(1).text, { kind: "text", label: "Text", available: true, lossless: true, loss: [] });
  assert.deepEqual(blockConversionTargets(presentation, at(8)), [], "an image has no text to convert");
  assert.deepEqual(blockConversionTargets(presentation, "slides.0"), [], "a slide with blocks is a group, not one block");
  assert.deepEqual(Object.keys(targets(6)), ["table"]);
  assert.deepEqual(targets(6).table.loss, ["chart type"]);
  assert.equal(readBlockContent(presentation, at(1)).kind, "list");
  assert.equal(readBlockContent(presentation, "slides.1").kind, "text", "a slide holding one payload inline");
}

// text -> list -> text keeps every line.
{
  const editor = session();
  const before = editor.presentation;
  const toList = convertBlock(editor, at(0), "list");
  assert.deepEqual(editor.get(`${at(0)}`), { id: "plain", items: ["One", "Two", "Three"] });
  assert.deepEqual([toList.from, toList.to, toList.lossless], ["text", "list", true]);
  assert.equal(toList.patches[0].op, "test", "guarded against a concurrent edit");
  assert.equal(editor.snapshot().undoDepth, 1, "one undo step");
  const back = convertBlock(editor, at(0), "text");
  assert.equal(editor.get(`${at(0)}.text`), "One\nTwo\nThree");
  assert.equal(back.lossless, true);
  assert.equal(editor.get(`${at(0)}.id`), "plain", "the block id survives");
  assert.deepEqual(editor.presentation, before, "text to list to text returns the same document");
  editor.undo();
  editor.undo();
  assert.deepEqual(editor.presentation, before);
  assert.equal(validate(editor.presentation, { only: ["format"] }).valid, true);
}

// Rich text keeps its runs per line; plain lines stay plain strings.
{
  const presentation = withImage();
  presentation.slides[0].blocks[0] = { text: ["Bold ", { text: "start", bold: true }, "\nsecond line"] };
  const editor = createEditorSession(presentation, { rejectInvalid: true });
  convertBlock(editor, at(0), "list");
  assert.deepEqual(editor.get(`${at(0)}.items`), [["Bold ", { text: "start", bold: true }], "second line"]);
  convertBlock(editor, at(0), "text");
  assert.deepEqual(editor.get(`${at(0)}.text`), ["Bold ", { text: "start", bold: true }, "\nsecond line"]);
  const toQuote = prepareBlockConversion(editor.presentation, at(0), "quote");
  assert.deepEqual(toQuote.loss, ["text formatting"], "a quote is plain text, so formatting is reported");
  assert.equal(readValue(toQuote.presentation, at(0)).quote.text, "Bold start\nsecond line");
}
function readValue(presentation, path) {
  return path.split(".").reduce((value, key) => value[key], presentation);
}

// list <-> timeline, text <-> timeline: events keep only `what` (nothing is invented for `when`).
{
  const editor = session();
  convertBlock(editor, at(1), "timeline");
  assert.deepEqual(editor.get(`${at(1)}.timeline`), [{ what: "First" }, { what: "Second" }]);
  convertBlock(editor, at(5), "list");
  assert.deepEqual(editor.get(`${at(5)}.items`), ["Now: Prototype", "Review"], "a dated event reads as 'when: what'");
  convertBlock(editor, at(5), "text");
  assert.equal(editor.get(`${at(5)}.text`), "Now: Prototype\nReview");
}

// metric, quote and code to text; and back where it is meaningful.
{
  const editor = session();
  const metric = convertBlock(editor, at(2), "text");
  assert.equal(editor.get(`${at(2)}.text`), "42%\nRetention\nQuarter over quarter");
  assert.equal(metric.lossless, true);
  const back = convertBlock(editor, at(2), "metric");
  assert.deepEqual(editor.get(`${at(2)}.metric`), { value: "42%", label: "Retention", description: "Quarter over quarter" }, "the unit travels inside the value text; no separate unit is guessed");
  assert.equal(back.lossless, true);

  convertBlock(editor, at(3), "text");
  assert.equal(editor.get(`${at(3)}.text`), "Make the next step clear.\n— Design team");
  convertBlock(editor, at(3), "quote");
  assert.deepEqual(editor.get(`${at(3)}.quote`), { text: "Make the next step clear.", attribution: "Design team" });

  // Core keeps the language and file name in a fenced block, so the text carries everything and the round trip is lossless.
  const code = convertBlock(editor, at(4), "text");
  assert.equal(editor.get(`${at(4)}.text`), '```ts title="a.ts"\nconst a = 1;\n\nconst b = 2;\n```');
  assert.equal(code.lossless, true);
  convertBlock(editor, at(4), "code");
  assert.deepEqual(editor.get(`${at(4)}.code`), { source: "const a = 1;\n\nconst b = 2;", language: "ts", filename: "a.ts" });
  // Without fences the bare source is written and what text cannot carry is named.
  const bare = convertBlock(createEditorSession(withImage(), { rejectInvalid: true }), at(4), "text", {}, { fences: "never" });
  assert.deepEqual(bare.loss, ["code language", "code filename"], "what text cannot carry is named");
}

// Refusals: nothing is invented and nothing is hidden.
{
  const presentation = withImage();
  const fails = (path, kind, pattern) => assert.throws(() => prepareBlockConversion(presentation, path, kind), (error) => error.code === "block-not-convertible" && pattern.test(error.message), `${path} -> ${kind}`);
  fails(at(2), "list", /cannot be converted/);
  fails(at(3), "metric", /cannot be converted/);
  fails(at(8), "text", /Image content cannot be converted to text/);
  fails(at(7), "quote", /Table content cannot be converted to quote. It converts to: chart/);
  fails("slides.0", "text", /Choose a block/);
  // A long first line is not a metric value.
  const long = withImage();
  long.slides[0].blocks[0] = { text: "This sentence is much too long to be a number on a slide" };
  assert.throws(() => prepareBlockConversion(long, at(0), "metric"), (error) => error.code === "block-not-convertible" && /too long to be a metric value/.test(error.message));
  assert.equal(blockConversionTargets(long, at(0)).find((entry) => entry.kind === "metric").available, false);
  // Empty text cannot become a metric or a timeline event.
  const empty = withImage();
  empty.slides[0].blocks[0] = { text: "" };
  assert.throws(() => prepareBlockConversion(empty, at(0), "timeline"), (error) => error.code === "block-not-convertible");
  assert.equal(prepareBlockConversion(empty, at(0), "list").patches[1].value.items.length, 0);
}

// Metric values: a numeric first line becomes a number, other text stays text; label and description follow.
{
  const presentation = withImage();
  presentation.slides[0].blocks[0] = { text: "$12.4M\nRevenue\nRecognized in Q4" };
  const result = prepareBlockConversion(presentation, at(0), "metric");
  assert.deepEqual(result.presentation.slides[0].blocks[0], { metric: { value: "$12.4M", label: "Revenue", description: "Recognized in Q4" } });
  presentation.slides[0].blocks[0] = { text: "007" };
  assert.equal(prepareBlockConversion(presentation, at(0), "metric").presentation.slides[0].blocks[0].metric.value, "007", "text that is not a canonical number is kept verbatim");
}

// Blank lines are dropped for structured targets and reported.
{
  const presentation = withImage();
  presentation.slides[0].blocks[0] = { text: "A\n\nB" };
  const result = prepareBlockConversion(presentation, at(0), "list");
  assert.deepEqual(result.loss, ["blank lines"]);
  assert.deepEqual(result.presentation.slides[0].blocks[0].items, ["A", "B"]);
}

// Chart <-> table with inline data; external data and styled cells are refused.
{
  const editor = session();
  const table = convertBlock(editor, at(6), "table");
  assert.deepEqual(editor.get(`${at(6)}.table`), { columns: ["Quarter", "Revenue"], rows: [["Q1", 12], ["Q2", 18]] });
  assert.deepEqual(table.loss, ["chart type"]);
  const chart = convertBlock(editor, at(6), "chart");
  assert.deepEqual(editor.get(`${at(6)}.chart`), { type: "column", data: { columns: ["Quarter", "Revenue"], rows: [["Q1", 12], ["Q2", 18]] } });
  assert.equal(chart.lossless, true);
  // The table with numeric text converts, with the text turned into the number it spells.
  convertBlock(editor, at(7), "chart");
  assert.deepEqual(editor.get(`${at(7)}.chart.data.rows`), [["Q1", 12], ["Q2", 18]]);
  const bad = withImage();
  bad.slides[0].blocks[7].table.rows[0][1] = "twelve";
  assert.throws(() => prepareBlockConversion(bad, at(7), "chart"), (error) => /not a number/.test(error.message));
  bad.slides[0].blocks[7].table.rows[0][1] = { value: "12", style: { fill: "primary" } };
  assert.throws(() => prepareBlockConversion(bad, at(7), "chart"), (error) => /styled, merged or formatted/.test(error.message));
  const external = withImage();
  external.slides[0].blocks[6].chart.data = { source: "https://example.com/data.csv", format: "csv" };
  const ext = blockConversionTargets(external, at(6));
  assert.ok(ext[0] === undefined || ext[0].available === false, "external data does not convert");
}

// Implicit slide payloads and typed blocks convert in place and keep their other slide fields.
{
  const editor = session();
  convertBlock(editor, "slides.1", "list");
  assert.deepEqual(editor.get("slides.1"), { id: "inline", title: "Implicit", items: ["Only text"] });
  convertBlock(editor, "slides.2.blocks.0", "list");
  assert.deepEqual(editor.get("slides.2.blocks.0"), { type: "list", items: ["Typed text"] }, "an explicit type follows the new kind");
  assert.equal(validate(editor.presentation, { only: ["format"] }).valid, true);
}

// Converting to the current kind commits nothing; an unchanged repeat is no history entry.
{
  const editor = session();
  const same = convertBlock(editor, at(1), "list");
  assert.equal(same.changed, false);
  assert.equal(editor.snapshot().undoDepth, 0);
}

// Selection mapping: a selection inside a block maps to the block; inline slide payloads only for their own field.
{
  const presentation = withImage();
  assert.equal(blockPathForSelection(presentation, "slides.0.blocks.6.chart.data.rows.0.0"), "slides.0.blocks.6");
  assert.equal(blockPathForSelection(presentation, "slides.0.blocks.0.text"), "slides.0.blocks.0");
  assert.equal(blockPathForSelection(presentation, "slides.1.text"), "slides.1");
  assert.equal(blockPathForSelection(presentation, "slides.1.title"), undefined, "the title of a one-payload slide is not its payload");
  assert.equal(blockPathForSelection(presentation, "slides.0.title"), undefined);
}

// Through the dimension switch: convert is opt-in, replacement stays the default.
{
  const editor = session();
  const converted = switchDimension(editor, "blocks", "list", { path: at(0), convert: true });
  assert.deepEqual(converted.loss, []);
  assert.deepEqual(editor.get(at(0)), { id: "plain", items: ["One", "Two", "Three"] });
  assert.equal(converted.patches[0].op, "test");
  assert.equal(editor.snapshot().undoDepth, 1);
  const replaced = switchDimension(editor, "blocks", "quote", { path: at(1) });
  assert.equal(replaced.loss, undefined);
  assert.deepEqual(editor.get(`${at(1)}.quote`), { text: "Add a quotation", attribution: "Source" }, "replacement still discards the old content");
  assert.throws(() => switchDimension(editor, "blocks", { text: "x" }, { path: at(0), convert: true }), (error) => error.code === "invalid-switch-value");
  assert.throws(() => switchDimension(editor, "blocks", "list", { path: at(2), convert: true }), (error) => error.code === "block-not-convertible");
}

// The preview follows: the converted list renders its items.
{
  const editor = session();
  const before = renderSlideSvg(editor.presentation, 0);
  convertBlock(editor, at(0), "list");
  const after = renderSlideSvg(editor.presentation, 0);
  assert.notEqual(after, before, "the preview redraws the converted block");
  for (const word of ["One", "Two", "Three"]) assert.ok(after.includes(word), `${word} survives in the preview`);
}

// Stale guard: converting a block that changed since it was read is rejected by the patch itself.
{
  const editor = session();
  const prepared = prepareBlockConversion(editor.presentation, at(0), "list");
  editor.set(`${at(0)}.text`, "Changed elsewhere");
  assert.throws(() => editor.applyPatch(prepared.patches), (error) => error.code === "patch-test-failed");
}

// RR-26: the conversions core added are reachable through the same transaction (one undo step, loss reported).
{
  const editor = session();
  const before = editor.presentation;
  // list <-> table
  const listToTable = convertBlock(editor, at(1), "table");
  assert.deepEqual(editor.get(`${at(1)}.table`), { rows: [["First"], ["Second"]] });
  assert.equal(listToTable.lossless, true);
  assert.equal(editor.snapshot().undoDepth, 1);
  const tableToList = convertBlock(editor, at(1), "list");
  assert.deepEqual(editor.get(`${at(1)}.items`), ["First", "Second"]);
  assert.equal(tableToList.lossless, true);
  // timeline <-> table
  const timelineToTable = convertBlock(editor, at(5), "table");
  assert.deepEqual(editor.get(`${at(5)}.table`), { columns: ["When", "What"], rows: [["Now", "Prototype"], [null, "Review"]] });
  assert.equal(timelineToTable.lossless, true);
  convertBlock(editor, at(5), "timeline");
  assert.deepEqual(editor.get(`${at(5)}.timeline`), [{ when: "Now", what: "Prototype" }, { what: "Review" }]);
  // table to a list names what the list cannot keep.
  const tableList = prepareBlockConversion(editor.presentation, at(7), "list");
  assert.deepEqual(tableList.loss, ["column headings"]);
  assert.deepEqual(tableList.presentation.slides[0].blocks[7].items, [{ text: "Q1", description: "12" }, { text: "Q2", description: "18" }]);
  // text parsing: a timeline with dates, a quote with its attribution, a fenced code block.
  const presentation = withImage();
  presentation.slides[0].blocks[0] = { text: "2024 — Launch\nQ1 2026: Pilot" };
  assert.deepEqual(prepareBlockConversion(presentation, at(0), "timeline").presentation.slides[0].blocks[0].timeline, [{ when: "2024", what: "Launch" }, { when: "Q1 2026", what: "Pilot" }]);
  presentation.slides[0].blocks[0] = { text: "Be brave.\n— Jane Doe, CTO" };
  assert.deepEqual(prepareBlockConversion(presentation, at(0), "quote").presentation.slides[0].blocks[0].quote, { text: "Be brave.", attribution: "Jane Doe, CTO" });
  presentation.slides[0].blocks[0] = { text: "```py\nprint(1)\n```" };
  assert.deepEqual(prepareBlockConversion(presentation, at(0), "code").presentation.slides[0].blocks[0].code, { source: "print(1)", language: "py" });
  // Everything above is undoable back to the start.
  while (editor.snapshot().canUndo) editor.undo();
  assert.deepEqual(editor.presentation, before);
}

// A group of metric blocks converts to a table as a whole (on a slide, a region or a group) and back.
{
  const presentation = withImage();
  presentation.slides.push({ id: "kpis", title: "KPIs", blocks: [{ metric: { value: 42, label: "Customers", unit: "k" } }, { metric: { value: "$1.2M", label: "Revenue" } }] });
  presentation.slides.push({ id: "mixed", title: "Mixed", blocks: [{ blocks: [{ metric: 1 }, { metric: 2 }] }, { text: "Context" }] });
  const editor = createEditorSession(presentation, { rejectInvalid: true });
  const group = "slides.3";
  assert.equal(readBlockContent(editor.presentation, group).kind, "group");
  assert.deepEqual(blockConversionTargets(editor.presentation, group).map((target) => [target.kind, target.available, target.lossless]), [["table", true, true]]);
  assert.equal(readBlockContent(editor.presentation, "slides.0"), undefined, "a group of mixed blocks has no conversion");
  assert.equal(metricGroupForSelection(editor.presentation, "slides.3.blocks.1.metric"), group);
  assert.equal(metricGroupForSelection(editor.presentation, "slides.4.blocks.0.blocks.1.metric"), "slides.4.blocks.0");
  assert.equal(metricGroupForSelection(editor.presentation, "slides.0.blocks.0.text"), undefined);
  const change = convertBlock(editor, group, "table");
  assert.deepEqual(editor.get(`${group}.table`), { columns: ["Label", "Value", "Unit"], rows: [["Customers", 42, "k"], ["Revenue", "$1.2M", null]] });
  assert.equal(editor.get(`${group}.title`), "KPIs", "the slide's own fields stay");
  assert.equal(editor.get(`${group}.blocks`), undefined);
  assert.equal(change.lossless, true);
  assert.equal(editor.snapshot().undoDepth, 1);
  convertBlock(editor, group, "metrics");
  assert.deepEqual(editor.get(`${group}.blocks`), presentation.slides[3].blocks);
  // A nested group converts in place; its composition cannot sit on a table and is reported.
  const nested = convertBlock(editor, "slides.4.blocks.0", "table");
  assert.deepEqual(editor.get("slides.4.blocks.0"), { table: { columns: ["Value"], rows: [[1], [2]] } });
  assert.equal(nested.lossless, true);
  assert.equal(validate(editor.presentation, { only: ["format"] }).valid, true);
}

// Conversion options reach core: a delimiter reads comma separated text as a table.
{
  const presentation = withImage();
  presentation.slides[0].blocks[0] = { text: "a,b\nc,d" };
  assert.deepEqual(blockConversionTargets(presentation, at(0)).find((target) => target.kind === "table").available, false);
  const result = prepareBlockConversion(presentation, at(0), "table", { delimiter: ",", header: true });
  assert.deepEqual(result.presentation.slides[0].blocks[0].table, { columns: ["a", "b"], rows: [["c", "d"]] });
  const editor = createEditorSession(presentation, { rejectInvalid: true });
  switchDimension(editor, "blocks", "table", { path: at(0), convert: true, conversion: { delimiter: "," } });
  assert.deepEqual(editor.get(`${at(0)}.table`), { rows: [["a", "b"], ["c", "d"]] });
}

console.log(`Block conversion: ${Object.keys(BLOCK_CONVERSIONS).length} source kinds, ${kinds.length} fixtures, text/list/quote/metric/code/timeline/chart/table pairs, loss reports, refusals, one undo step each, ${"preview"} refresh.`);
