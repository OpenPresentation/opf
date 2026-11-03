// LH-100: the chart options read the value labels a small chart (LH-03) draws by default, so "Data labels" is checked when core draws
// them and unchecked when it does not; switching them off writes `dataLabels: false`, on again writes `true`. The effective default
// comes from core's chart layer (the composed `item.chart.layer`), or without one from core's small-chart rule on the data.
// LH-104: `fit: "auto"` is an image fit and a design.imageFit choice.
import assert from "node:assert/strict";
import { createEditorSession } from "../dist/index.js";
import { readChartOptions, setChartOptions } from "../dist/chart-options.js";
import { IMAGE_FITS, setImageTreatment } from "../dist/image-options.js";
import { DESIGN_OPTIONS } from "../dist/design-options.js";

const small = { type: "column", data: { columns: ["Quarter", "Revenue"], rows: [["Q1", 10], ["Q2", 12], ["Q3", 15], ["Q4", 18]] } };
const many = { type: "column", data: { columns: ["Month", "Revenue"], rows: Array.from({ length: 20 }, (_, index) => [`M${index + 1}`, 10 + index]) } };
const deck = (chart) => ({ name: "LH-100", language: "en-US", slides: [{ id: "c", title: "Revenue by quarter", blocks: [{ chart }] }] });
const C = "slides.0.blocks.0.chart";
const layerOf = (editor) => editor.composeSlide(0).items.find((item) => item.field === "chart" && item.path === C)?.chart?.layer;

// 1. A small chart: the composed layer draws its value labels, and the panel state says so.
{
  const editor = createEditorSession(deck(small), { rejectInvalid: true });
  const layer = layerOf(editor);
  assert.equal(layer?.small?.labels, true, "core draws the small chart's value labels");
  const read = readChartOptions(small, editor.presentation, { layer });
  assert.equal(read.state.dataLabels.on, true);
  assert.equal(read.state.dataLabels.explicit, false);
  assert.deepEqual(read.state.dataLabels.content, ["value"]);
  assert.equal(read.fields.dataLabels.defaultOn, true);
  // Without a layer, core's rule on the data alone gives the same answer for this chart.
  assert.equal(readChartOptions(small, editor.presentation).state.dataLabels.on, true);
  // A layer without the small-chart treatment (the labels did not fit the chart's box) reads as no labels.
  assert.equal(readChartOptions(small, editor.presentation, { layer: undefined }).state.dataLabels.on, false);
  // Switching the labels off writes false (absence would draw them again); on again writes true.
  setChartOptions(editor, C, { dataLabels: false }, { layer });
  assert.equal(editor.get(C).dataLabels, false);
  assert.equal(layerOf(editor)?.small, undefined, "core draws no labels now");
  assert.equal(readChartOptions(editor.get(C), editor.presentation, { layer: layerOf(editor) }).state.dataLabels.on, false);
  // Asking for false again keeps the explicit false: the default is still labeled.
  setChartOptions(editor, C, { dataLabels: false }, { layer: layerOf(editor) });
  assert.equal(editor.get(C).dataLabels, false);
  setChartOptions(editor, C, { dataLabels: true }, { layer: layerOf(editor) });
  assert.equal(editor.get(C).dataLabels, true);
}

// 2. A chart with more points than a small chart: no default labels; off removes the field instead of writing false.
{
  const editor = createEditorSession(deck(many), { rejectInvalid: true });
  const layer = layerOf(editor);
  assert.equal(layer?.small, undefined);
  const read = readChartOptions(many, editor.presentation, { layer });
  assert.equal(read.state.dataLabels.on, false);
  assert.equal(read.fields.dataLabels.defaultOn, false);
  setChartOptions(editor, C, { dataLabels: true }, { layer });
  assert.equal(editor.get(C).dataLabels, true);
  setChartOptions(editor, C, { dataLabels: false }, { layer: layerOf(editor) });
  assert.equal(editor.get(C).dataLabels, undefined);
}

// 3. LH-104: auto is a block fit and a design default.
{
  assert.ok(IMAGE_FITS.includes("auto"));
  assert.ok(DESIGN_OPTIONS.find((option) => option.id === "imageFit").values.includes("auto"));
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9V3iWggAAAAASUVORK5CYII=";
  const editor = createEditorSession({ name: "LH-104", language: "en-US", slides: [{ id: "p", title: "Picture", blocks: [{ image: { src: png, alt: "A dot" } }] }] }, { rejectInvalid: true });
  setImageTreatment(editor, "slides.0.blocks.0", { fit: "auto" });
  assert.equal(editor.get("slides.0.blocks.0.fit"), "auto");
  const image = editor.composeSlide(0).items.find((item) => item.field === "image").image;
  assert.equal(image.autoFit, true);
  assert.ok(image.fit === "cover" || image.fit === "contain");
}

console.log("LH-100: the chart options read a small chart's default value labels; LH-104: auto is an image fit in the editor.");
