// RR-06: safe content-type conversion. A conversion keeps the block's text, never adds content,
// reports what it cannot carry, refuses pairs with no meaning, and is one undoable patch.
import assert from "node:assert/strict";
import { validatePresentation } from "@openpresentation/opf";
import { renderSvg } from "@openpresentation/opf-render/svg";
import { createEditorSession } from "../dist/index.js";
import { BLOCK_CONVERSIONS, BLOCK_KIND_LABELS, blockConversionTargets, blockPathForSelection, convertBlock, prepareBlockConversion, readBlockContent } from "../dist/block-convert.js";
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
  const document = deck();
  document.assets = { none: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP0cAAAAASUVORK5CYII=" };
  return document;
};
const session = () => createEditorSession(withImage(), { rejectInvalid: true });
const at = (index) => `slides.0.blocks.${index}`;
const kinds = ["plain", "list", "metric", "quote", "code", "timeline", "chart", "table", "image"];

// The matrix: documented pairs, nothing else.
assert.deepEqual(BLOCK_CONVERSIONS.text, ["list", "quote", "metric", "code", "timeline"]);
assert.deepEqual(BLOCK_CONVERSIONS.chart, ["table"]);
assert.equal(BLOCK_KIND_LABELS.list, "List");

// Targets: what each block can convert to, with its loss report.
{
  const document = withImage();
  const targets = (index) => Object.fromEntries(blockConversionTargets(document, at(index)).map((entry) => [entry.kind, entry]));
  assert.deepEqual(Object.keys(targets(0)), ["list", "quote", "metric", "code", "timeline"]);
  assert.equal(targets(0).quote.lossless, true);
  assert.deepEqual(targets(1).text, { kind: "text", label: "Text", available: true, lossless: true, loss: [] });
  assert.deepEqual(blockConversionTargets(document, at(8)), [], "an image has no text to convert");
  assert.deepEqual(blockConversionTargets(document, "slides.0"), [], "a slide with blocks is a group, not one block");
  assert.deepEqual(Object.keys(targets(6)), ["table"]);
  assert.deepEqual(targets(6).table.loss, ["chart type"]);
  assert.equal(readBlockContent(document, at(1)).kind, "list");
  assert.equal(readBlockContent(document, "slides.1").kind, "text", "a slide holding one payload inline");
}

// text -> list -> text keeps every line.
{
  const editor = session();
  const before = editor.document;
  const toList = convertBlock(editor, at(0), "list");
  assert.deepEqual(editor.get(`${at(0)}`), { id: "plain", items: ["One", "Two", "Three"] });
  assert.deepEqual([toList.from, toList.to, toList.lossless], ["text", "list", true]);
  assert.equal(toList.patches[0].op, "test", "guarded against a concurrent edit");
  assert.equal(editor.snapshot().undoDepth, 1, "one undo step");
  const back = convertBlock(editor, at(0), "text");
  assert.equal(editor.get(`${at(0)}.text`), "One\nTwo\nThree");
  assert.equal(back.lossless, true);
  assert.equal(editor.get(`${at(0)}.id`), "plain", "the block id survives");
  assert.deepEqual(editor.document, before, "text to list to text returns the same document");
  editor.undo();
  editor.undo();
  assert.deepEqual(editor.document, before);
  assert.equal(validatePresentation(editor.document).valid, true);
}

// Rich text keeps its runs per line; plain lines stay plain strings.
{
  const document = withImage();
  document.slides[0].blocks[0] = { text: ["Bold ", { text: "start", bold: true }, "\nsecond line"] };
  const editor = createEditorSession(document, { rejectInvalid: true });
  convertBlock(editor, at(0), "list");
  assert.deepEqual(editor.get(`${at(0)}.items`), [["Bold ", { text: "start", bold: true }], "second line"]);
  convertBlock(editor, at(0), "text");
  assert.deepEqual(editor.get(`${at(0)}.text`), ["Bold ", { text: "start", bold: true }, "\nsecond line"]);
  const toQuote = prepareBlockConversion(editor.document, at(0), "quote");
  assert.deepEqual(toQuote.loss, ["text formatting"], "a quote is plain text, so formatting is reported");
  assert.equal(readValue(toQuote.document, at(0)).quote.text, "Bold start\nsecond line");
}
function readValue(document, path) {
  return path.split(".").reduce((value, key) => value[key], document);
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

  const code = convertBlock(editor, at(4), "text");
  assert.equal(editor.get(`${at(4)}.text`), "const a = 1;\n\nconst b = 2;");
  assert.deepEqual(code.loss, ["code language", "code filename"], "what text cannot carry is named");
  convertBlock(editor, at(4), "code");
  assert.deepEqual(editor.get(`${at(4)}.code`), { source: "const a = 1;\n\nconst b = 2;" });
}

// Refusals: nothing is invented and nothing is hidden.
{
  const document = withImage();
  const fails = (path, kind, pattern) => assert.throws(() => prepareBlockConversion(document, path, kind), (error) => error.code === "block-not-convertible" && pattern.test(error.message), `${path} -> ${kind}`);
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
  const document = withImage();
  document.slides[0].blocks[0] = { text: "$12.4M\nRevenue\nRecognized in Q4" };
  const result = prepareBlockConversion(document, at(0), "metric");
  assert.deepEqual(result.document.slides[0].blocks[0], { metric: { value: "$12.4M", label: "Revenue", description: "Recognized in Q4" } });
  document.slides[0].blocks[0] = { text: "007" };
  assert.equal(prepareBlockConversion(document, at(0), "metric").document.slides[0].blocks[0].metric.value, "007", "text that is not a canonical number is kept verbatim");
}

// Blank lines are dropped for structured targets and reported.
{
  const document = withImage();
  document.slides[0].blocks[0] = { text: "A\n\nB" };
  const result = prepareBlockConversion(document, at(0), "list");
  assert.deepEqual(result.loss, ["blank lines"]);
  assert.deepEqual(result.document.slides[0].blocks[0].items, ["A", "B"]);
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
  assert.equal(validatePresentation(editor.document).valid, true);
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
  const document = withImage();
  assert.equal(blockPathForSelection(document, "slides.0.blocks.6.chart.data.rows.0.0"), "slides.0.blocks.6");
  assert.equal(blockPathForSelection(document, "slides.0.blocks.0.text"), "slides.0.blocks.0");
  assert.equal(blockPathForSelection(document, "slides.1.text"), "slides.1");
  assert.equal(blockPathForSelection(document, "slides.1.title"), undefined, "the title of a one-payload slide is not its payload");
  assert.equal(blockPathForSelection(document, "slides.0.title"), undefined);
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
  const before = renderSvg(editor.document, { slideIndex: 0 });
  convertBlock(editor, at(0), "list");
  const after = renderSvg(editor.document, { slideIndex: 0 });
  assert.notEqual(after, before, "the preview redraws the converted block");
  for (const word of ["One", "Two", "Three"]) assert.ok(after.includes(word), `${word} survives in the preview`);
}

// Stale guard: converting a block that changed since it was read is rejected by the patch itself.
{
  const editor = session();
  const prepared = prepareBlockConversion(editor.document, at(0), "list");
  editor.set(`${at(0)}.text`, "Changed elsewhere");
  assert.throws(() => editor.applyPatch(prepared.patches), (error) => error.code === "patch-test-failed");
}

console.log(`Block conversion: ${Object.keys(BLOCK_CONVERSIONS).length} source kinds, ${kinds.length} fixtures, text/list/quote/metric/code/timeline/chart/table pairs, loss reports, refusals, one undo step each, ${"preview"} refresh.`);
