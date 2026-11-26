// FR-07: bands and the bullet chart in the editor. Bands edit as one validated, undoable patch (add, change, reorder, remove), only scheme colors
// are accepted, the preview redraws; switching to a bullet chart sets its target from a column named like one and switching away removes it;
// the data grid marks the target column; the slide and chart keep their ids through the edits.
import assert from "node:assert/strict";
import { toSvg } from "@openpresentation/opf-render/svg";
import { createEditorSession } from "../dist/index.js";
import { addChartBand, moveChartBand, parseChartPath, prepareChartBands, readChartBands, removeChartBand, setChartBands } from "../dist/chart-bands.js";
import { formatBandEnd, parseBandEnd } from "../dist/chart-bands-panel.js";
import { prepareDimensionSwitch, bulletTargetColumn, compatibleChartTypes } from "../dist/switches.js";
import { chartColumnRoles } from "../dist/grid-model.js";

const C = "slides.0.chart";
const deck = (chart = {}) => ({
  name: "Bands fixture",
  design: { theme: "minimal", fontScheme: "aptos" },
  slides: [{ id: "kpis", title: "KPIs", chart: { type: "column", alt: "KPIs.", data: { columns: ["KPI", { name: "Actual", format: "0%" }, { name: "Target", format: "0%" }], rows: [["Win rate", 0.31, 0.35], ["Retention", 0.92, 0.9]] }, ...chart } }],
});
const session = (chart) => createEditorSession(deck(chart), { rejectInvalid: true });
const bandMarks = (document) => (toSvg(document, 1, { trace: true }).match(/data-opf-path="slides[.]0[.]chart[.]bands[.]\d+"/g) ?? []).length;
let checks = 0;

assert.equal(parseChartPath("slides.0.chart.data.rows.1.2"), C);
assert.equal(parseChartPath("slides.0.title"), undefined);
assert.deepEqual(readChartBands(deck().slides[0].chart), { supported: true, bands: [] });
assert.equal(readChartBands({ type: "pie" }).supported, false);
checks += 4;

// Add, change, reorder and remove: one undo step each, the preview redraws, ids stay.
{
  const editor = session();
  assert.equal(bandMarks(editor.presentation), 0);
  setChartBands(editor, C, [{ to: 0.6, label: "Poor" }, { to: 1, label: "Good", color: "accent3" }]);
  assert.deepEqual(editor.presentation.slides[0].chart.bands, [{ to: 0.6, label: "Poor" }, { to: 1, label: "Good", color: "accent3" }]);
  assert.ok(bandMarks(editor.presentation) >= 2, "the preview draws the bands");
  addChartBand(editor, C);
  assert.deepEqual(editor.presentation.slides[0].chart.bands.map((band) => band.to), [0.6, 1, 1.4]);
  moveChartBand(editor, C, 2, -1);
  assert.deepEqual(editor.presentation.slides[0].chart.bands.map((band) => band.to), [0.6, 1.4, 1]);
  removeChartBand(editor, C, 1);
  assert.deepEqual(editor.presentation.slides[0].chart.bands.map((band) => band.to), [0.6, 1]);
  assert.equal(editor.presentation.slides[0].id, "kpis");
  editor.undo();
  assert.equal(editor.presentation.slides[0].chart.bands.length, 3, "undo restores the removed band");
  setChartBands(editor, C, null);
  assert.equal(editor.presentation.slides[0].chart.bands, undefined, "an empty list removes the key");
  checks += 7;
}

// Only scheme colors, finite ends, at most six bands; nothing is applied on a refusal.
{
  const document = deck();
  assert.throws(() => prepareChartBands(document, C, [{ to: 1, color: "#FF0000" }]), { code: "invalid-band" });
  assert.throws(() => prepareChartBands(document, C, [{ to: Number.NaN }]), { code: "invalid-band" });
  assert.throws(() => prepareChartBands(document, C, Array.from({ length: 7 }, (_, i) => ({ to: i + 1 }))), { code: "invalid-band" });
  assert.equal(document.slides[0].chart.bands, undefined);
  checks += 4;
}

// Ends typed in the value axis's display format.
assert.equal(formatBandEnd(0.6, "0%"), "60%");
assert.equal(formatBandEnd(12, "0"), "12");
assert.equal(parseBandEnd("60%"), 0.6);
assert.equal(parseBandEnd("1,5"), 1.5);
assert.equal(parseBandEnd("abc"), undefined);
checks += 5;

// Switching to a bullet chart sets the target from a column named like one; away, the target goes. The grid marks the target column.
{
  assert.equal(bulletTargetColumn(deck().slides[0].chart), "Target");
  assert.ok(compatibleChartTypes(deck(), { slideIndex: 0 }).some((entry) => entry.id === "bullet"), "Bullet is offered");
  const switched = prepareDimensionSwitch(deck(), "charts", "bullet", { slideIndex: 0 });
  const chart = (switched.presentation ?? switched).slides[0].chart;
  assert.equal(chart.type, "bullet");
  assert.deepEqual(chart.mapping, { target: "Target" });
  assert.deepEqual(chartColumnRoles(3, "bullet", chart.mapping, ["KPI", "Actual", "Target"]), ["category", "series", "target"]);
  const back = prepareDimensionSwitch(switched.presentation ?? switched, "charts", "column", { slideIndex: 0 });
  assert.equal((back.presentation ?? back).slides[0].chart.mapping, undefined, "the target goes with the bullet chart");
  checks += 6;
}
console.log(`FR-07 bands and bullet editor: ${checks} checks`);
