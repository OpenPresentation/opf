// FR-06: a metric computed from data in the editor. The Data section reads a metric's link and what it computes, sets the link, the
// direction that is good and the number format as one undoable change, applies the safe fix that writes the computed numbers, and the
// link stays through a rename of the dataset's column and refuses a delete of a column it reads.
import assert from "node:assert/strict";
import { validate } from "@openpresentation/opf";
import { createEditorSession } from "../dist/index.js";
import * as grid from "../dist/data-grid.js";
import { METRIC_CHANGES, metricChangeKind, metricDatasets, prepareMetricData, prepareMetricUpdate, readMetricData, setMetricData, updateMetricData } from "../dist/content-actions.js";
import { filterText, parseFilterText } from "../dist/metric-data-controls.js";
import { walkMetricLinks, linkFields, renameLinkFields } from "../dist/dataset-refs.js";

const M_LINKED = "slides.0.blocks.0";
const M_STALE = "slides.0.blocks.1";
const M_BARE = "slides.0.blocks.2";
const TABLE = "slides.0.blocks.3.table";

const deck = () => ({
  name: "Metric data",
  language: "en-US",
  design: { theme: "minimal", fontScheme: "aptos" },
  datasets: {
    arr: {
      title: "ARR by month",
      columns: ["Month", "Region", { name: "ARR", format: "$#,##0.0M" }, { name: "Churn", format: "0.0%" }],
      rows: [["2026-09", "EMEA", 3.9, 0.041], ["2026-10", "EMEA", 4.2, 0.036], ["2026-11", "EMEA", 4.4, 0.044]],
    },
  },
  slides: [
    {
      id: "arr",
      title: "ARR",
      blocks: [
        { metric: { label: "EMEA ARR", value: 4.4, delta: 0.2, data: { dataset: "arr", field: "ARR", aggregate: "last", filter: [{ field: "Region", op: "=", value: "EMEA" }], delta: { compare: "previous" } } } },
        { metric: { label: "Stale", value: "$4.2M", data: { dataset: "arr", field: "ARR", aggregate: "last", delta: { compare: "previous" } } } },
        { metric: "$1.2M" },
        { table: { dataset: "arr" } },
      ],
    },
  ],
});
const session = () => createEditorSession(deck());
const refuses = (label, action, code) => assert.throws(action, (error) => (code ? error?.code === code : true), label);

// --- reading -------------------------------------------------------------------------------------

{
  const found = readMetricData(deck(), M_LINKED);
  assert.equal(found.path, `${M_LINKED}.metric`);
  assert.equal(found.scalar, false);
  assert.equal(found.resolved, true);
  assert.equal(found.value.text, "$4.4M", "the computed value is what the field shows");
  assert.equal(found.delta.text, "+$0.2M");
  assert.deepEqual(found.stale, [], "the written numbers match the computed ones");
  assert.equal(found.datasets[0].id, "arr");
  assert.deepEqual(found.datasets[0].columns.map((column) => column.name), ["Month", "Region", "ARR", "Churn"]);
  assert.equal(metricChangeKind(found.link), "previous");
  assert.deepEqual([...METRIC_CHANGES], ["none", "previous", "baseline", "value", "column"]);
  assert.equal(metricChangeKind({ delta: { compare: { filter: [] } } }), "baseline");
  assert.equal(metricChangeKind({ delta: { compare: { value: 3 } } }), "value");
  assert.equal(metricChangeKind({ delta: { field: "x" } }), "column");
  assert.equal(metricChangeKind({}), "none");
  assert.equal(readMetricData(deck(), "slides.0.blocks.3"), undefined, "a table block is not a metric");
  const bare = readMetricData(deck(), M_BARE);
  assert.equal(bare.scalar, true);
  assert.equal(bare.link, undefined);
  assert.equal(bare.resolved, false);
  assert.deepEqual(metricDatasets(deck())[0].columns.map((column) => column.name), ["Month", "Region", "ARR", "Churn"]);
}

// --- a measure column is offered first -------------------------------------------------------------

{
  const typed = deck();
  typed.datasets.arr.columns = ["Month", { name: "ARR", format: "$#,##0.0M", role: "measure" }, "Region", { name: "Churn", role: "measure" }];
  assert.deepEqual(metricDatasets(typed)[0].columns.map((column) => column.name), ["ARR", "Churn", "Month", "Region"]);
}

// --- the stale numbers and Update ---------------------------------------------------------------------

{
  const found = readMetricData(deck(), M_STALE);
  assert.deepEqual(found.stale.map((entry) => entry.field), ["value", "delta"]);
  const prepared = prepareMetricUpdate(deck(), M_STALE);
  assert.equal(prepared.changed, true);
  const editor = session();
  const change = updateMetricData(editor, M_STALE);
  assert.equal(change.changed, true);
  assert.equal(editor.get(`${M_STALE}.metric.value`), 4.4);
  assert.equal(editor.get(`${M_STALE}.metric.delta`), 0.2);
  assert.deepEqual(editor.get(`${M_STALE}.metric.data`), deck().slides[0].blocks[1].metric.data, "the link is untouched");
  assert.equal(readMetricData(editor.presentation, M_STALE).stale.length, 0);
  editor.undo();
  assert.equal(editor.get(`${M_STALE}.metric.value`), "$4.2M", "one undo restores the written numbers");
  assert.equal(updateMetricData(session(), M_LINKED).changed, false, "nothing to update when the numbers match");
}

// --- setting the link, the direction and the format ----------------------------------------------------

{
  const editor = session();
  const link = { dataset: "arr", field: "Churn", aggregate: "max" };
  const change = setMetricData(editor, M_BARE, { data: link, better: "down", format: "0.0%" });
  assert.equal(change.changed, true);
  assert.deepEqual(editor.get(`${M_BARE}.metric`), { value: "$1.2M", data: link, better: "down", format: "0.0%" }, "a bare value becomes an object that keeps its value");
  assert.equal(readMetricData(editor.presentation, M_BARE).value.text, "4.4%");
  editor.undo();
  assert.equal(editor.get(`${M_BARE}.metric`), "$1.2M", "the whole link is one undo step");
  const keep = createEditorSession(deck());
  setMetricData(keep, M_LINKED, { better: "down" });
  assert.equal(keep.get(`${M_LINKED}.metric.better`), "down");
  assert.equal(keep.get(`${M_LINKED}.metric.data.dataset`), "arr", "setting better keeps the link");
  setMetricData(keep, M_LINKED, { better: null, data: null, format: "0.0" });
  assert.equal(keep.get(`${M_LINKED}.metric.better`), undefined);
  assert.equal(keep.get(`${M_LINKED}.metric.data`), undefined);
  assert.equal(keep.get(`${M_LINKED}.metric.format`), "0.0");
  assert.equal(keep.get(`${M_LINKED}.metric.value`), 4.4, "unlinking keeps the written value");
  assert.equal(prepareMetricData(deck(), M_LINKED, { better: undefined }).changed, false);
  refuses("a direction that is neither", () => prepareMetricData(deck(), M_LINKED, { better: "sideways" }), "invalid-metric-better");
  refuses("a block that is not a metric", () => prepareMetricData(deck(), "slides.0.blocks.3", { better: "up" }), "content-action-refused");
}

// --- the editor keeps the link through the other edits of the metric ---------------------------------------

{
  const editor = session();
  editor.applyPatch([{ op: "replace", path: "/slides/0/blocks/0/metric/label", value: "EMEA recurring revenue" }]);
  assert.deepEqual(editor.get(`${M_LINKED}.metric.data`), deck().slides[0].blocks[0].metric.data);
  const report = validate(editor.presentation, { only: ["format"] });
  assert.equal(report.valid, true, JSON.stringify(report.findings));
}

// --- a rename of a dataset column updates the links; a delete of a column a link reads is refused -------------

{
  const editor = session();
  const change = grid.setGridCells(editor, TABLE, [{ section: "header", column: 2, text: "Recurring revenue" }]);
  assert.equal(change.changed, true);
  assert.equal(editor.get(`${M_LINKED}.metric.data.field`), "Recurring revenue", "the link follows the renamed column");
  assert.equal(editor.get(`${M_STALE}.metric.data.field`), "Recurring revenue");
  assert.equal(readMetricData(editor.presentation, M_LINKED).resolved, true);
  editor.undo();
  assert.equal(editor.get(`${M_LINKED}.metric.data.field`), "ARR", "one undo restores the table and the links");
  const second = grid.setGridCells(createEditorSession(deck()), TABLE, [{ section: "header", column: 1, text: "Area" }]);
  assert.equal(second.changed, true);
  const filtered = session();
  grid.setGridCells(filtered, TABLE, [{ section: "header", column: 1, text: "Area" }]);
  assert.equal(filtered.get(`${M_LINKED}.metric.data.filter.0.field`), "Area", "a filter's field follows too");
  refuses("delete a column a metric link reads", () => grid.deleteGridColumns(session(), TABLE, [2]), "dataset-column-in-use");
  refuses("delete the column a filter reads", () => grid.deleteGridColumns(session(), TABLE, [1]), "dataset-column-in-use");
}

// --- the helpers ---------------------------------------------------------------------------------------------

{
  const found = [];
  walkMetricLinks(deck(), (entry) => found.push([entry.id, entry.parts.join(".")]));
  assert.deepEqual(found, [["arr", `${M_LINKED}.metric`], ["arr", `${M_STALE}.metric`]]);
  const link = deck().slides[0].blocks[0].metric.data;
  assert.deepEqual(linkFields(link), ["ARR", "Region"]);
  assert.deepEqual(linkFields({ field: "A", filter: [{ field: "B" }], delta: { compare: { filter: [{ field: "C" }] } } }), ["A", "B", "C"]);
  assert.deepEqual(linkFields({ field: "A", delta: { field: "D" } }), ["A", "D"]);
  assert.equal(renameLinkFields(link, (name) => name), link, "nothing renamed returns the same link");
  assert.equal(renameLinkFields(link, (name) => (name === "Region" ? "Area" : name)).filter[0].field, "Area");
}

// --- the rows text of the Data section -------------------------------------------------------------------------

{
  const filter = parseFilterText("Region = EMEA; Month >= 2026-09; Month in 2026-10, 2026-11; Seats > 10; Active = true; Note != null");
  assert.deepEqual(filter, [
    { field: "Region", op: "=", value: "EMEA" },
    { field: "Month", op: ">=", value: "2026-09" },
    { field: "Month", op: "in", value: ["2026-10", "2026-11"] },
    { field: "Seats", op: ">", value: 10 },
    { field: "Active", op: "=", value: true },
    { field: "Note", op: "!=", value: null },
  ]);
  assert.equal(parseFilterText("   "), undefined);
  assert.deepEqual(parseFilterText('Code = "10"'), [{ field: "Code", op: "=", value: "10" }], "a quoted text stays text");
  assert.deepEqual(parseFilterText(filterText(filter)), filter, "the text round-trips");
  assert.deepEqual(parseFilterText(filterText([{ field: "Code", op: "=", value: "10" }])), [{ field: "Code", op: "=", value: "10" }]);
  assert.throws(() => parseFilterText("Region"), TypeError);
}

console.log("fr-06-metric-data: ok");
