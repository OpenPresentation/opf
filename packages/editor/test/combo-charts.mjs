// FA-15: combo charts in the editor. The chart type picker offers combo for data with two or more series; the chart
// options read and edit which series are lines and which lines use the secondary value axis (and that axis's title) as one
// validated, undoable patch; switching to another type removes the combo-only fields. The preview and the PPTX export draw
// the edited chart.
import assert from "node:assert/strict";
import { validatePresentation } from "@openpresentation/opf";
import { renderSvg } from "@openpresentation/opf-render/svg";
import * as pptx from "@openpresentation/opf-pptx";
import { createEditorSession } from "../dist/index.js";
import { prepareChartOptions, readChartOptions, setChartOptions } from "../dist/chart-options.js";
import { compatibleChartTypes, switchDimension } from "../dist/switches.js";

const C = "slides.0.blocks.0.chart";
const data = { columns: ["Quarter", { name: "Revenue", format: "$#,##0.0" }, "Cost", { name: "Margin", format: "0%" }], rows: [["Q1", 12.4, 8, 0.31], ["Q2", 18.1, 11, 0.34]] };
const deck = (chart) => ({ name: "Combo fixture", design: { theme: "minimal", fontScheme: "aptos" }, slides: [{ id: "chart", title: "Revenue and margin", blocks: [{ chart: { type: "combo", data, ...chart } }] }] });
const session = (chart = {}) => createEditorSession(deck(chart), { rejectInvalid: true });
const plan = (editor) => readChartOptions(editor.get(C), editor.document).combo.series.map((entry) => `${entry.name}:${entry.role}/${entry.axis}`);

// 1. The picker offers combo for two or more series, not for one.
{
  const ids = (columns) => compatibleChartTypes({ slides: [{ title: "x", blocks: [{ chart: { type: "column", data: { columns, rows: [["Q1", ...columns.slice(1).map(() => 1)]] } } }] }] }, { slideIndex: 0 }).map((entry) => entry.id);
  assert.ok(ids(["Quarter", "Revenue", "Margin"]).includes("combo"), "two series can be a combo chart");
  assert.ok(ids(["Quarter", "A", "B", "C"]).includes("combo"), "three series too");
  assert.ok(!ids(["Quarter", "Revenue"]).includes("combo"), "one series cannot");
  const editor = createEditorSession({ slides: [{ title: "x", blocks: [{ chart: { type: "column", data } }] }] }, { rejectInvalid: true });
  switchDimension(editor, "charts", "combo", { slideIndex: 0 });
  assert.equal(editor.get(C).type, "combo");
  assert.deepEqual(plan(editor), ["Revenue:bar/primary", "Cost:bar/primary", "Margin:line/primary"], "the default plan: the last series is the line");
}

// 2. Reading: the fields offer a secondary axis title on combo charts; the series come in data order with their plan.
{
  const editor = session({ line: ["Revenue"], secondaryAxis: ["Revenue"], axisTitles: { secondary: "Revenue ($M)" } });
  const read = readChartOptions(editor.get(C), editor.document);
  assert.equal(read.fields.axisTitles.secondary, true);
  assert.equal(read.state.axisTitles.secondary, "Revenue ($M)");
  assert.deepEqual(plan(editor), ["Revenue:line/secondary", "Cost:bar/primary", "Margin:bar/primary"]);
  assert.equal(readChartOptions({ type: "column", data }).combo, undefined, "other types have no combo series");
  assert.equal(readChartOptions({ type: "column", data }).fields.axisTitles.secondary, false);
}

// 3. Editing lines and the secondary axis: one undoable patch each; `line` only when it differs from the default.
{
  const editor = session();
  const svgBefore = renderSvg(editor.document, { trace: true });
  setChartOptions(editor, C, { secondaryAxis: ["Margin"] });
  assert.deepEqual(editor.get(C).secondaryAxis, ["Margin"]);
  assert.equal(editor.get(C).line, undefined, "the default line is not written");
  setChartOptions(editor, C, { axisTitles: { secondary: "Margin" } });
  assert.deepEqual(editor.get(C).axisTitles, { secondary: "Margin" });
  setChartOptions(editor, C, { line: ["Cost", "Margin"] });
  assert.deepEqual(editor.get(C).line, ["Cost", "Margin"]);
  assert.deepEqual(plan(editor), ["Revenue:bar/primary", "Cost:line/primary", "Margin:line/secondary"]);
  assert.equal(validatePresentation(editor.document).warnings.length, 0, JSON.stringify(validatePresentation(editor.document).warnings));
  // A series that stops being a line leaves the secondary axis, and the secondary title goes with the last secondary line.
  setChartOptions(editor, C, { line: ["Cost"] });
  assert.deepEqual(editor.get(C).line, ["Cost"]);
  assert.equal(editor.get(C).secondaryAxis, undefined);
  assert.equal(editor.get(C).axisTitles, undefined, "no secondary axis, no secondary title");
  // Undo walks back each change.
  editor.undo();
  assert.deepEqual(editor.get(C).secondaryAxis, ["Margin"]);
  assert.deepEqual(editor.get(C).axisTitles, { secondary: "Margin" });
  editor.undo(); editor.undo(); editor.undo();
  assert.deepEqual(editor.get(C), deck({}).slides[0].blocks[0].chart);
  assert.equal(renderSvg(editor.document, { trace: true }), svgBefore, "undo restores the preview");
}

// 4. Refusals: at least one line and at least one column series; unknown names.
{
  const editor = session();
  assert.throws(() => prepareChartOptions(editor.document, C, { line: [] }), /at least one series as a line/);
  assert.throws(() => prepareChartOptions(editor.document, C, { line: ["Revenue", "Cost", "Margin"] }), /at least one series as columns/);
  assert.throws(() => prepareChartOptions(editor.document, C, { line: ["Profit"] }), /not a plotted series/);
  // Only a line can use the secondary axis: a column name is dropped.
  const prepared = prepareChartOptions(editor.document, C, { secondaryAxis: ["Revenue", "Margin"] });
  assert.deepEqual(prepared.patches, [{ op: "add", path: "/slides/0/blocks/0/chart/secondaryAxis", value: ["Margin"] }]);
}

// 5. Switching away from combo removes line, secondaryAxis and the secondary title.
{
  const editor = session({ line: ["Cost", "Margin"], secondaryAxis: ["Margin"], axisTitles: { value: "Revenue", secondary: "Margin" } });
  switchDimension(editor, "charts", "line", { slideIndex: 0 });
  const chart = editor.get(C);
  assert.equal(chart.type, "line");
  assert.equal(chart.line, undefined);
  assert.equal(chart.secondaryAxis, undefined);
  assert.deepEqual(chart.axisTitles, { value: "Revenue" });
  assert.equal(validatePresentation(editor.document).warnings.length, 0);
  editor.undo();
  assert.deepEqual(editor.get(C).secondaryAxis, ["Margin"]);
}

// 6. The edited chart exports natively and imports back.
{
  const editor = session();
  setChartOptions(editor, C, { secondaryAxis: ["Margin"], axisTitles: { secondary: "Margin" } });
  const bytes = await pptx.toPptx(editor.document);
  const imported = (await pptx.fromPptx(bytes)).slides[0];
  const chart = imported.chart ?? imported.blocks?.find((block) => block.chart)?.chart;
  assert.equal(chart.type, "combo");
  assert.deepEqual(chart.secondaryAxis, ["Margin"]);
  assert.equal(chart.axisTitles.secondary, "Margin");
}

console.log("Combo charts (editor): picker, series lines and secondary axis, secondary title, refusals, switch-away cleanup, export.");
