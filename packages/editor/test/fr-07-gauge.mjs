// FR-07, part 3: the gauge in the editor. Turning a metric's gauge on fills min 0 and max from its value (an editor convenience); the range,
// the target and the bands are set as one undoable change each; turning it off removes it; and the metric keeps its gauge through other edits.
import assert from "node:assert/strict";
import { validate } from "@openpresentation/opf";
import { createEditorSession } from "../dist/index.js";
import { defaultMetricGauge, prepareMetricData, readMetricData, setMetricData, setMetricTrend } from "../dist/content-actions.js";

const deck = () => ({
  name: "Gauges",
  language: "en-US",
  datasets: { ops: { columns: ["Week", { name: "Utilization", format: "0%" }], rows: [["W46", 0.68], ["W47", 0.72]] } },
  slides: [{ title: "Gauges", blocks: [
    { metric: { label: "Utilization", value: 0.72, data: { dataset: "ops", field: "Utilization", aggregate: "last" } } },
    { metric: { label: "NPS", value: 41, gauge: { min: -100, max: 100, target: 40 } } },
    { metric: 1284 },
  ] }],
});
const M_LINKED = "slides.0.blocks.0", M_NPS = "slides.0.blocks.1", M_BARE = "slides.0.blocks.2";

// The default range: the next round number above the value, 1 for a share.
assert.deepEqual([0.72, 1, 72, 100, 1284, 0, -5, undefined].map((value) => defaultMetricGauge(value).max), [1, 1, 80, 200, 2000, 1, 1, 1]);

{
  const found = readMetricData(deck(), M_NPS);
  assert.deepEqual(found.gauge, { min: -100, max: 100, target: 40 });
  assert.equal(found.number, 41);
  assert.equal(readMetricData(deck(), M_LINKED).number, 0.72, "a computed value is the number the gauge's default range follows");
  assert.equal(readMetricData(deck(), M_LINKED).gauge, undefined);
}

{
  const editor = createEditorSession(deck());
  setMetricData(editor, M_LINKED, { gauge: defaultMetricGauge(readMetricData(editor.presentation, M_LINKED).number) });
  assert.deepEqual(editor.get(`${M_LINKED}.metric.gauge`), { max: 1 });
  assert.deepEqual(editor.get(`${M_LINKED}.metric.data`), deck().slides[0].blocks[0].metric.data, "the link stays");
  setMetricData(editor, M_LINKED, { gauge: { max: 1, bands: [{ to: 0.6 }, { to: 0.85 }, { to: 1, label: "Overloaded", color: "accent2" }], target: 0.8 } });
  assert.equal(validate(editor.presentation).findings.filter((finding) => finding.severity === "error").length, 0);
  setMetricTrend(editor, M_LINKED, "up");
  assert.equal(editor.get(`${M_LINKED}.metric.gauge`).target, 0.8, "the gauge stays through another edit of the metric");
  editor.undo();
  editor.undo();
  assert.deepEqual(editor.get(`${M_LINKED}.metric.gauge`), { max: 1 }, "each change is one undo");
  setMetricData(editor, M_LINKED, { gauge: null });
  assert.equal(editor.get(`${M_LINKED}.metric.gauge`), undefined, "off removes it");
  // A bare value becomes an object metric with its gauge.
  setMetricData(editor, M_BARE, { gauge: defaultMetricGauge(1284) });
  assert.deepEqual(editor.get(`${M_BARE}.metric`), { value: 1284, gauge: { max: 2000 } });
}

assert.throws(() => prepareMetricData(deck(), M_NPS, { gauge: { min: 0 } }), (error) => error?.code === "invalid-metric-gauge", "a gauge needs a number max");
console.log("fr-07 gauge (editor): ok");
