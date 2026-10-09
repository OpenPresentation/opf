// RR-35: chart options in the editor. Axis titles, legend position and data labels edit as one validated, undoable
// patch; only what the chart type can show is offered or written; the preview draws the change and the PPTX export carries it.
import assert from "node:assert/strict";
import { defaultCatalog } from "@openpresentation/opf/catalog";
import { validate } from "@openpresentation/opf";
import { chartOptionSupport, chartOptionTarget } from "@openpresentation/opf/composition";
import { toSvg } from "@openpresentation/opf-render/svg";
import * as pptx from "@openpresentation/opf-pptx";
import { createEditorSession } from "../dist/index.js";
import { parseChartPath, prepareChartOptions, readChartOptions, setChartOptions } from "../dist/chart-options.js";

const C = "slides.0.blocks.0.chart";
const data = { columns: ["Quarter", "North", "South"], rows: [["Q1", 10, 5], ["Q2", 20, 8], ["Q3", 15, 12]] };
const deck = (type = "column") => ({
  name: "Chart options fixture",
  design: { theme: "minimal", fontScheme: "aptos" },
  slides: [{ id: "chart", title: "Chart", blocks: [{ chart: { type, data } }, { text: "Notes" }] }],
});
const session = (type) => createEditorSession(deck(type), { rejectInvalid: true });
const svg = (presentation) => toSvg(presentation, 1, { trace: true });

// Selection paths.
assert.equal(parseChartPath(C), C);
assert.equal(parseChartPath(`${C}.data.rows.1.2`), C);
assert.equal(parseChartPath("slides.0.chart"), "slides.0.chart");
assert.equal(parseChartPath("slides.0.blocks.1.text"), undefined);
assert.equal(parseChartPath("not a path ["), undefined);

// The offered fields follow core's support table for every chart type.
for (const type of ["column", "bar", "stacked-column", "line", "area", "pie", "doughnut", "scatter", "radar", "histogram", "pareto", "waterfall", "funnel", "treemap", "box-and-whisker", "world"]) {
  const { fields } = readChartOptions({ type, data });
  assert.deepEqual(fields, (({ axisTitles, legend, dataLabels, highlight }) => ({ axisTitles, legend, dataLabels, highlight }))(chartOptionSupport(chartOptionTarget(type))), `${type}: the fields are core's support table`);
}
assert.deepEqual(readChartOptions({ type: "column", data }).state, {
  alt: "", decorative: false,
  axisTitles: { category: "", value: "", secondary: "" }, legend: "default",
  dataLabels: { on: false, explicit: false, content: ["value"], position: "auto", separator: ", " },
  highlight: { series: [], categories: [] },
});
// A chart type outside the catalog offers everything.
assert.equal(readChartOptions({ type: "mystery", data }).fields.dataLabels.positions.includes("outside-end"), true);
// The funnel and treemap label their marks by default.
assert.equal(readChartOptions({ type: "funnel", data }).state.dataLabels.on, true);
assert.equal(readChartOptions({ type: "treemap", data }).state.dataLabels.content[0], "category");
assert.equal(readChartOptions({ type: "treemap", data, dataLabels: false }).state.dataLabels.on, false);

// Axis titles: one patch, one undo step, the preview draws them, the PPTX carries them.
{
  const editor = session();
  const before = editor.presentation;
  const beforeSvg = svg(before);
  const change = setChartOptions(editor, C, { axisTitles: { category: "Quarter", value: "Revenue ($M)" } });
  assert.equal(change.changed, true);
  assert.deepEqual(editor.get(`${C}.axisTitles`), { category: "Quarter", value: "Revenue ($M)" });
  assert.equal(editor.snapshot().undoDepth, 1);
  assert.equal(validate(editor.presentation, { only: ["format"] }).valid, true);
  assert.notEqual(svg(editor.presentation), beforeSvg, "the preview draws the titles");
  assert.match(svg(editor.presentation), /data-opf-path="slides\.0\.blocks\.0\.chart\.axisTitles\.value"/);
  const bytes = await pptx.toPptx(structuredClone(editor.presentation), { strictAssets: true, catalogs: [defaultCatalog] });
  const back = await pptx.fromPptx(bytes);
  const block = (back.slides?.[0]?.blocks ?? []).find((entry) => entry.chart) ?? back.slides?.[0];
  assert.deepEqual(block.chart.axisTitles, { category: "Quarter", value: "Revenue ($M)" }, "the titles survive the PPTX round trip");
  // Editing one title keeps the other; an empty title removes it; removing the last removes the field.
  setChartOptions(editor, C, { axisTitles: { category: "Period" } });
  assert.deepEqual(editor.get(`${C}.axisTitles`), { category: "Period", value: "Revenue ($M)" });
  setChartOptions(editor, C, { axisTitles: { value: "  " } });
  assert.deepEqual(editor.get(`${C}.axisTitles`), { category: "Period" });
  setChartOptions(editor, C, { axisTitles: { category: "" } });
  assert.equal(editor.get(`${C}.axisTitles`), undefined);
  assert.equal(setChartOptions(editor, C, { axisTitles: { category: "" } }).changed, false, "removing nothing is a no-op");
  while (editor.snapshot().undoDepth) editor.undo();
  assert.deepEqual(editor.presentation, before);
  assert.equal(svg(editor.presentation), beforeSvg);
}

// A chart type without the axis never gets the title.
{
  const editor = session("pie");
  const change = setChartOptions(editor, C, { axisTitles: { category: "x", value: "y" } });
  assert.equal(change.changed, false);
  assert.equal(editor.get(`${C}.axisTitles`), undefined);
}

// Legend.
{
  const editor = session();
  const before = editor.presentation;
  for (const position of ["top", "bottom", "left", "right", "none"]) {
    assert.equal(setChartOptions(editor, C, { legend: position }).changed, true);
    assert.equal(editor.get(`${C}.legend`), position);
    assert.equal(validate(editor.presentation, { only: ["format"] }).valid, true);
  }
  assert.equal(setChartOptions(editor, C, { legend: "default" }).changed, true);
  assert.equal(editor.get(`${C}.legend`), undefined, "default removes the field");
  assert.throws(() => setChartOptions(editor, C, { legend: "middle" }), /not a legend position/);
  while (editor.snapshot().undoDepth) editor.undo();
  assert.deepEqual(editor.presentation, before);
  const radar = session("radar");
  assert.equal(setChartOptions(radar, C, { legend: "bottom" }).changed, true);
  const world = session("world");
  assert.equal(setChartOptions(world, C, { legend: "bottom" }).changed, false, "a type with no legend option is left alone");
}

// Data labels: on/off, content, position, separator; unsupported values are never written.
{
  const editor = session();
  const before = editor.presentation;
  assert.equal(setChartOptions(editor, C, { dataLabels: true }).changed, true);
  assert.equal(editor.get(`${C}.dataLabels`), true);
  assert.match(svg(editor.presentation), /data-opf-path="slides\.0\.blocks\.0\.chart\.data\.rows\.0\.1"/);
  setChartOptions(editor, C, { dataLabels: { position: "inside-end" } });
  assert.deepEqual(editor.get(`${C}.dataLabels`), { position: "inside-end" });
  setChartOptions(editor, C, { dataLabels: { content: ["value", "category"], separator: " | " } });
  assert.deepEqual(editor.get(`${C}.dataLabels`), { content: ["category", "value"], position: "inside-end", separator: " | " });
  assert.equal(setChartOptions(editor, C, { dataLabels: { position: "outside-end" } }).changed, true);
  assert.deepEqual(editor.get(`${C}.dataLabels`), { content: ["category", "value"], position: "outside-end", separator: " | " }, "a chosen position is kept");
  assert.equal(setChartOptions(editor, C, { dataLabels: { position: "auto" } }).changed, true);
  assert.deepEqual(editor.get(`${C}.dataLabels`), { content: ["category", "value"], separator: " | " }, "automatic removes the position");
  // Percent exists only on pie and doughnut: dropped on a column.
  setChartOptions(editor, C, { dataLabels: { content: ["percent", "value"] } });
  assert.deepEqual(editor.get(`${C}.dataLabels.content`), undefined);
  // A position the type does not offer is ignored.
  setChartOptions(editor, C, { dataLabels: { position: "above" } });
  assert.equal(editor.get(`${C}.dataLabels.position`), undefined);
  // A separator never holds a line break.
  setChartOptions(editor, C, { dataLabels: { content: ["category", "value"], separator: "a\nb" } });
  assert.equal(editor.get(`${C}.dataLabels.separator`), "a b");
  // Off removes the field on a chart that has no default labels.
  assert.equal(setChartOptions(editor, C, { dataLabels: false }).changed, true);
  assert.equal(editor.get(`${C}.dataLabels`), undefined);
  while (editor.snapshot().undoDepth) editor.undo();
  assert.deepEqual(editor.presentation, before);

  const pie = session("pie");
  setChartOptions(pie, C, { dataLabels: { content: ["category", "percent"], position: "center" } });
  assert.deepEqual(pie.get(`${C}.dataLabels`), { content: ["category", "percent"], position: "center" });
  const doughnut = session("doughnut");
  setChartOptions(doughnut, C, { dataLabels: { content: ["percent"], position: "center" } });
  assert.deepEqual(doughnut.get(`${C}.dataLabels`), { content: ["percent"] }, "a doughnut has no label position choice");
  const stacked = session("stacked-column");
  setChartOptions(stacked, C, { dataLabels: { position: "outside-end" } });
  assert.equal(stacked.get(`${C}.dataLabels`), true, "a stacked column has no outside-end");
  const line = session("line");
  setChartOptions(line, C, { dataLabels: { position: "below" } });
  assert.deepEqual(line.get(`${C}.dataLabels`), { position: "below" });
}

// The funnel and treemap: false is what removes the default labels.
for (const type of ["funnel", "treemap"]) {
  const editor = session(type);
  assert.equal(setChartOptions(editor, C, { dataLabels: false }).changed, true);
  assert.equal(editor.get(`${C}.dataLabels`), false);
  assert.equal(readChartOptions(editor.get(C)).state.dataLabels.on, false);
  setChartOptions(editor, C, { dataLabels: true });
  assert.equal(editor.get(`${C}.dataLabels`), true);
  setChartOptions(editor, C, { dataLabels: null });
  assert.equal(editor.get(`${C}.dataLabels`), undefined, "null removes the field and restores the default labels");
}

// prepareChartOptions never mutates its input and reports a no-op.
{
  const presentation = deck();
  const frozen = JSON.stringify(presentation);
  const prepared = prepareChartOptions(presentation, C, { legend: "top", axisTitles: { value: "Revenue" } });
  assert.equal(JSON.stringify(presentation), frozen, "the document is not modified");
  assert.equal(prepared.changed, true);
  assert.deepEqual(prepared.patches.map((patch) => patch.op), ["add", "add"]);
  assert.equal(prepared.presentation.slides[0].blocks[0].chart.legend, "top");
  assert.equal(prepareChartOptions(presentation, C, {}).changed, false);
  assert.throws(() => prepareChartOptions(presentation, "slides.0.blocks.1.text", { legend: "top" }), /Choose a chart/);
}

console.log("Chart options (editor): axis titles, legend position and data labels edit as one undoable patch, follow core's support table, redraw in the preview and survive the PPTX round trip.");
