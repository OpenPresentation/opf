// RR-96: `chart.colors` in the editor. A list of colors by position (a hex color, a scheme slot that keeps following the deck, or a
// `var:` reference) edits as one validated, undoable patch; the positions are named by what the chart type colors; a position left to
// the deck palette is written as the palette color itself, so a later position can still be set.
import assert from "node:assert/strict";
import { chartSeriesPalette } from "@openpresentation/opf/composition";
import { createEditorSession } from "../dist/index.js";
import { CHART_COLORS_MAX, prepareChartOptions, readChartOptions, setChartOptions } from "../dist/chart-options.js";
import { ACCENT_SLOTS, readSchemeSlots } from "../dist/color-slots.js";

const C = "slides.0.blocks.0.chart";
const data = { columns: ["Quarter", "North", "South"], rows: [["Q1", 10, 5], ["Q2", 20, 8], ["Q3", 15, 12]] };
const deck = (type = "column", chart = {}) => ({
  name: "Chart colors fixture",
  design: { theme: "minimal", fontScheme: "aptos" },
  slides: [{ id: "chart", title: "Chart", blocks: [{ chart: { type, data, ...chart } }, { text: "Notes" }] }],
});
const session = (type, chart) => createEditorSession(deck(type, chart), { rejectInvalid: true });
const colorsOf = (editor) => editor.get(C).colors;

// What a position means follows the chart type.
assert.deepEqual(readChartOptions({ type: "column", data }).colors.labels, ["North", "South"], "a series chart colors its series");
assert.deepEqual(readChartOptions({ type: "combo", data }).colors.by, "series");
assert.deepEqual(readChartOptions({ type: "pie", data }).colors, { by: "categories", labels: ["Q1", "Q2", "Q3"], slots: ACCENT_SLOTS }, "a pie colors its slices");
assert.equal(readChartOptions({ type: "treemap", data }).colors.by, "categories");
assert.equal(readChartOptions({ type: "histogram", data }).colors.by, "colors", "a histogram has no series or slices to name");
assert.deepEqual(readChartOptions({ type: "histogram", data }).colors.labels, ["Color 1", "Color 2", "Color 3", "Color 4", "Color 5", "Color 6"]);
assert.deepEqual(readChartOptions({ type: "column", data: { dataset: "x" } }).colors.by, "colors", "unresolved data names no positions");
assert.deepEqual(readChartOptions({ type: "column", data, colors: ["accent3", "#7B241C"] }).state.colors, ["accent3", "#7B241C"]);
assert.deepEqual(readChartOptions({ type: "column", data }).state.colors, [], "absent: the deck palette");

// Setting, replacing and removing: one patch, one undo step.
{
  const editor = session("column");
  const change = setChartOptions(editor, C, { colors: ["accent3", "#7b241c"] });
  assert.equal(change.changed, true);
  assert.deepEqual(change.patches, [{ op: "add", path: "/slides/0/blocks/0/chart/colors", value: ["accent3", "#7B241C"] }], "hex is stored upper case, a slot as its name");
  assert.deepEqual(colorsOf(editor), ["accent3", "#7B241C"]);
  assert.equal(setChartOptions(editor, C, { colors: ["accent3", "#7b241c"] }).changed, false, "the same list is no change");
  setChartOptions(editor, C, { colors: ["accent3", "var:brand"] });
  assert.deepEqual(colorsOf(editor), ["accent3", "var:brand"], "a color variable is kept as written");
  editor.undo();
  assert.deepEqual(colorsOf(editor), ["accent3", "#7B241C"], "undo restores the previous list");
  editor.undo();
  assert.equal(editor.get(C).colors, undefined, "undo removes what was added");
  editor.redo();
  setChartOptions(editor, C, { colors: null });
  assert.equal(editor.get(C).colors, undefined, "null removes the field");
  assert.equal(setChartOptions(editor, C, { colors: null }).changed, false);
}

// A position left to the palette: a gap before a chosen color is the palette color, a trailing gap is dropped.
{
  const editor = session("column");
  setChartOptions(editor, C, { colors: [null, "#112233"] });
  assert.deepEqual(colorsOf(editor), ["accent1", "#112233"]);
  setChartOptions(editor, C, { colors: ["#445566", "", null] });
  assert.deepEqual(colorsOf(editor), ["#445566"], "trailing gaps keep the palette");
  setChartOptions(editor, C, { colors: [null, ""] });
  assert.equal(editor.get(C).colors, undefined, "all gaps is the deck palette: the field goes");
}
{
  // Past the sixth position the palette is a tint, written as the hex the deck draws.
  const editor = session("pie", { data: { columns: ["K", "V"], rows: Array.from({ length: 8 }, (_, i) => [`R${i}`, i + 1]) } });
  const list = [null, null, null, null, null, null, null, "#112233"];
  setChartOptions(editor, C, { colors: list });
  const palette = chartSeriesPalette(readSchemeSlots(editor.presentation));
  const written = colorsOf(editor);
  assert.deepEqual(written.slice(0, 6), ACCENT_SLOTS);
  assert.equal(written[6].toLowerCase(), palette[6].toLowerCase(), "position 7 is the deck's tint of accent1");
  assert.equal(written[7], "#112233");
}

// Refusals explain themselves and leave the document alone.
{
  const editor = session("column");
  const before = JSON.stringify(editor.presentation);
  for (const [colors, pattern] of [
    [["not a color"], /Color 1 must be a hex color/],
    [["accent1", "#12"], /Color 2 must be a hex color/],
    [Array.from({ length: CHART_COLORS_MAX + 1 }, () => "#000000"), /at most 24/],
    ["accent1", /list of colors/],
  ]) assert.throws(() => prepareChartOptions(editor.presentation, C, { colors }), (error) => error.code === "invalid-chart-option" && pattern.test(error.message));
  assert.equal(JSON.stringify(editor.presentation), before);
}

// The swatches are the deck's own slots.
{
  const slots = readSchemeSlots(deck());
  assert.match(slots.accent1, /^#[0-9a-f]{6}$/i);
  assert.ok(slots.light1 && slots.dark1);
  assert.deepEqual(readSchemeSlots(null), {}, "never throws");
}
console.log("chart colors ok");
