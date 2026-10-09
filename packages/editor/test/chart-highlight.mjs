// FA-14: the chart highlight in the editor. Series and categories edit as one validated, undoable patch; only what the chart type can
// highlight is offered or written; the choices come from the chart's resolved data (a dataset chart offers its dataset's columns and
// rows); the preview draws the change and the PPTX export carries it.
import assert from "node:assert/strict";
import { defaultCatalog } from "@openpresentation/opf/catalog";
import { validate } from "@openpresentation/opf";
import { chartOptionSupport, chartOptionTarget } from "@openpresentation/opf/composition";

// The rules that report an option or highlight the chart type cannot show (content and layout warnings, so `only: ["format"]` never sees them).
const ADAPTED_RULES = ["opf/chart-option-adapted", "opf/chart-highlight-adapted", "opf/chart-mapping-adapted"];
import { toSvg } from "@openpresentation/opf-render/svg";
import * as pptx from "@openpresentation/opf-pptx";
import { createEditorSession } from "../dist/index.js";
import { prepareChartOptions, readChartOptions, setChartOptions } from "../dist/chart-options.js";

const C = "slides.0.blocks.0.chart";
const data = { columns: ["Quarter", "North", "South"], rows: [["Q1", 10, 5], ["Q2", 20, 8], ["Q3", 15, 12]] };
const deck = (type = "column", chart = {}) => ({
  name: "Chart highlight fixture",
  design: { theme: "minimal", fontScheme: "aptos" },
  slides: [{ id: "chart", title: "Chart", blocks: [{ chart: { type, data, ...chart } }, { text: "Notes" }] }],
});
const session = (type, chart) => createEditorSession(deck(type, chart), { rejectInvalid: true });
const svg = (document) => toSvg(document, 1, { trace: true });

// What each chart type offers follows core's support table.
for (const type of ["column", "bar", "stacked-column", "line", "area", "pie", "doughnut", "scatter", "radar", "histogram", "waterfall", "funnel", "treemap", "box-and-whisker", "world"]) {
  assert.deepEqual(readChartOptions({ type, data }).fields.highlight, chartOptionSupport(chartOptionTarget(type)).highlight, `${type}: the highlight fields are core's support table`);
}
assert.deepEqual(readChartOptions({ type: "mystery", data }).fields.highlight, { series: true, categories: true }, "a type outside the catalog offers both");

// The choices: plotted series and distinct row labels, from the resolved data.
assert.deepEqual(readChartOptions({ type: "column", data }).choices, { series: ["North", "South"], categories: ["Q1", "Q2", "Q3"] });
assert.deepEqual(readChartOptions({ type: "column", data, mapping: { series: ["South"] } }).choices.series, ["South"], "a mapping narrows the series");
assert.deepEqual(readChartOptions({ type: "scatter", data: { columns: ["Pt", "Spend", "Revenue"], rows: [["a", 1, 2]] } }).choices.series, ["Revenue"], "the X column is not a series");
assert.deepEqual(readChartOptions({ type: "column", data: { columns: ["Year", "V"], rows: [[2023, 1], [2024, 2], [2024, 3], [null, 4]] } }).choices.categories, ["2023", "2024"], "distinct, text, non-empty");
{
  const document = { datasets: { rev: data }, slides: [{ title: "D", chart: { type: "column", data: { dataset: "rev" } } }] };
  assert.deepEqual(readChartOptions(document.slides[0].chart, document).choices, { series: ["North", "South"], categories: ["Q1", "Q2", "Q3"] }, "a dataset chart needs the document");
  assert.deepEqual(readChartOptions(document.slides[0].chart).choices, { series: [], categories: [] }, "without the document it resolves nothing");
}
assert.deepEqual(readChartOptions({ type: "column", data: { src: "asset:missing" } }).choices, { series: [], categories: [] });

// Series and categories: one patch, one undo step, the preview and the export follow.
{
  const editor = session();
  const before = editor.presentation;
  const beforeSvg = svg(before);
  assert.equal(setChartOptions(editor, C, { highlight: { series: ["North"] } }).changed, true);
  assert.deepEqual(editor.get(`${C}.highlight`), { series: ["North"] });
  assert.equal(editor.snapshot().undoDepth, 1);
  assert.equal(validate(editor.presentation, { only: ["format"] }).valid, true);
  assert.notEqual(svg(editor.presentation), beforeSvg, "the preview draws the highlight");
  assert.deepEqual(readChartOptions(editor.get(C)).state.highlight, { series: ["North"], categories: [] });
  // The other part is kept; a list replaces its part; an empty list removes it; the last removal removes the field.
  setChartOptions(editor, C, { highlight: { categories: ["Q2", "Q3"] } });
  assert.deepEqual(editor.get(`${C}.highlight`), { series: ["North"], categories: ["Q2", "Q3"] });
  setChartOptions(editor, C, { highlight: { categories: ["Q1"] } });
  assert.deepEqual(editor.get(`${C}.highlight`), { series: ["North"], categories: ["Q1"] });
  setChartOptions(editor, C, { highlight: { series: [] } });
  assert.deepEqual(editor.get(`${C}.highlight`), { categories: ["Q1"] });
  setChartOptions(editor, C, { highlight: { categories: [] } });
  assert.equal(editor.get(`${C}.highlight`), undefined);
  assert.equal(setChartOptions(editor, C, { highlight: { categories: [] } }).changed, false, "removing nothing is a no-op");
  setChartOptions(editor, C, { highlight: { series: ["South", "South"], categories: ["Q3"] } });
  assert.deepEqual(editor.get(`${C}.highlight`), { series: ["South"], categories: ["Q3"] }, "duplicates collapse");
  const bytes = await pptx.toPptx(structuredClone(editor.presentation), { strictAssets: true, catalogs: [defaultCatalog] });
  const back = await pptx.fromPptx(bytes);
  const block = (back.slides?.[0]?.blocks ?? []).find((entry) => entry.chart) ?? back.slides?.[0];
  assert.deepEqual(block.chart.highlight, { series: ["South"], categories: ["Q3"] }, "the highlight survives the PPTX round trip");
  assert.equal(setChartOptions(editor, C, { highlight: null }).changed, true);
  assert.equal(editor.get(`${C}.highlight`), undefined, "null removes the field");
  while (editor.snapshot().undoDepth) editor.undo();
  assert.deepEqual(editor.presentation, before);
  assert.equal(svg(editor.presentation), beforeSvg);
}

// A name the chart does not have is refused with a message; the document is untouched.
{
  const editor = session();
  assert.throws(() => setChartOptions(editor, C, { highlight: { series: ["Profit"] } }), /'Profit' is not a plotted series/);
  assert.throws(() => setChartOptions(editor, C, { highlight: { categories: ["Q9"] } }), /'Q9' is not a category label/);
  assert.throws(() => setChartOptions(editor, C, { highlight: { series: "North" } }), /must be a list of names/);
  assert.equal(editor.get(`${C}.highlight`), undefined);
  assert.equal(editor.snapshot().undoDepth, 0);
}

// A part the chart type cannot highlight is never written: a pie takes slices only, an area series only.
{
  const pie = session("pie");
  setChartOptions(pie, C, { highlight: { series: ["North"], categories: ["Q2"] } });
  assert.deepEqual(pie.get(`${C}.highlight`), { categories: ["Q2"] });
  assert.equal(validate(pie.presentation, { only: ADAPTED_RULES }).counts.warning, 0, "no chart-option-adapted warning is left behind");
  const area = session("area");
  setChartOptions(area, C, { highlight: { series: ["South"], categories: ["Q2"] } });
  assert.deepEqual(area.get(`${C}.highlight`), { series: ["South"] });
  const waterfall = session("waterfall");
  assert.equal(setChartOptions(waterfall, C, { highlight: { series: ["North"] } }).changed, false, "a construct that cannot highlight is left alone");
  assert.equal(waterfall.get(`${C}.highlight`), undefined);
  const line = session("line");
  setChartOptions(line, C, { highlight: { series: ["North"], categories: ["Q3"] } });
  assert.deepEqual(line.get(`${C}.highlight`), { series: ["North"], categories: ["Q3"] });
}

// A dataset-backed chart: the names come from the dataset, so the patch is validated against it.
{
  const document = { name: "Dataset", datasets: { rev: data }, slides: [{ id: "d", title: "D", blocks: [{ chart: { type: "column", data: { dataset: "rev" } } }] }] };
  const editor = createEditorSession(document, { rejectInvalid: true });
  setChartOptions(editor, C, { highlight: { categories: ["Q3"] } });
  assert.deepEqual(editor.get(`${C}.highlight`), { categories: ["Q3"] });
  assert.throws(() => setChartOptions(editor, C, { highlight: { categories: ["Q9"] } }), /'Q9' is not a category label/);
}

// prepareChartOptions never mutates its input.
{
  const document = deck();
  const frozen = JSON.stringify(document);
  const prepared = prepareChartOptions(document, C, { highlight: { series: ["North"] } });
  assert.equal(JSON.stringify(document), frozen);
  assert.deepEqual(prepared.patches.map((patch) => patch.op), ["add"]);
  assert.deepEqual(prepared.presentation.slides[0].blocks[0].chart.highlight, { series: ["North"] });
  assert.equal(prepareChartOptions(document, C, { highlight: null }).changed, false);
}

console.log("Chart highlight (editor): series and categories edit as one undoable patch, follow core's support table and the chart's own names, redraw in the preview and survive the PPTX round trip.");
