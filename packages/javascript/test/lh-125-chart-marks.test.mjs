// LH-125: the chart marks follow-ups (core chart-marks.ts): horizontal stacked bars with values inside their segments and their series named
// in a row above the plot, a stacked area that runs edge to edge and labels its end points, and a doughnut that prints the value of the
// slice the title names in its hole.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { composeSlide } from "../dist/composition.js";

const chartOf = (slide, options = {}) => composeSlide(slide, { width: 1280, height: 720, ...options }).items.find((item) => item.field === "chart");
const layerOf = (slide, options) => chartOf(slide, options)?.chart?.layer ?? {};
const regions = [["North America", 5400, 2100, 900], ["Europe", 4600, 2300, 1300], ["Asia Pacific", 3900, 2800, 1100], ["Latin America", 2200, 1900, 1400], ["Middle East", 1500, 1200, 1100]];
const bars = (type = "stacked-bar", extra = {}, rows = regions) => ({ type, data: { columns: ["Region", "Self-service", "Chat", "Phone"], rows }, ...extra });
const area = (type = "stacked-area", extra = {}) => ({ type, data: { columns: ["Month", "Mobile", "Desktop"], rows: [["Jan", 310, 290], ["Feb", 342, 284], ["Mar", 381, 279], ["Apr", 420, 271], ["May", 462, 266], ["Jun", 503, 258]] }, ...extra });
const doughnut = (extra = {}) => ({ type: "doughnut", data: { columns: ["Outcome", "Tickets"], rows: [["Resolved", 6240], ["Follow-up", 2180], ["Escalated", 890], ["Unresolved", 310]] }, ...extra });

describe("LH-125: horizontal stacked bars", () => {
  test("values sit inside the segments that hold them, and the series are named in a row above the plot at their first segments", () => {
    const item = chartOf({ title: "Self-service carries most requests in every region", chart: bars() });
    const layer = item.chart.layer, box = item.box;
    assert.ok(layer.stack.values.every((row) => row.some(Boolean)), "every series has values inside");
    assert.equal(layer.stack.values[0][0], true, "5400 fits its long segment");
    const names = layer.stack.names;
    assert.equal(names.above, true);
    assert.equal(layer.header?.legend, undefined, "no legend");
    assert.deepEqual(names.entries.map((entry) => entry.name), ["Self-service", "Chat", "Phone"]);
    const xs = names.entries.map((entry) => entry.box.x);
    assert.ok(xs[0] < xs[1] && xs[1] < xs[2], "the names follow the segments of the first bar, left to right");
    const plotTop = box.y + layer.plot.top;
    for (const entry of names.entries) assert.ok(entry.box.y + entry.box.height <= plotTop, "the names are above the plot");
    // The first segment of the first bar starts at the plot's start, the next where 5400 ends on the axis.
    const axis = item.chart.valueAxis, plotWidth = box.width - layer.plot.left - layer.plot.right;
    assert.ok(Math.abs(xs[1] - (box.x + layer.plot.left + 5400 / (axis.max - axis.min) * plotWidth)) < 1, "Chat starts where Self-service ends");
  });

  test("the chart's plot is pinned for both engines, and a 100% chart has names but no raw values", () => {
    const layer = layerOf({ title: "Channels", chart: bars("100pct-stacked-bar") });
    assert.ok(layer.plot && layer.plot.left > 0 && layer.plot.top > 0);
    assert.ok(layer.stack.values.every((row) => row.every((fits) => !fits)), "raw values would contradict a share axis");
    assert.equal(layer.stack.names.above, true);
  });

  test("names that would meet keep the header legend; options keep the chart as authored", () => {
    // Chat and Phone are hairlines in the first bar: their names would sit on each other.
    const tight = layerOf({ title: "Channels", chart: bars("stacked-bar", {}, [["North America", 5400, 20, 30], ["Europe", 4600, 2300, 1300]]) });
    assert.equal(tight.stack.names, undefined, "no names row");
    assert.ok(tight.header?.legend, "the legend stays");
    assert.ok(tight.plot, "the plot is pinned either way");
    for (const extra of [{ dataLabels: true }, { legend: "right" }]) assert.equal(layerOf({ title: "Channels", chart: bars("stacked-bar", extra) }).stack, undefined, JSON.stringify(extra));
  });
});

describe("LH-125: a stacked area runs edge to edge", () => {
  test("it stands on its tick marks, with the first and last values inside the band at the plot's edges", () => {
    const layer = layerOf({ title: "Mobile now carries most of the traffic", chart: area() });
    assert.equal(layer.stack.edge, true);
    const ends = layer.stack.ends;
    assert.ok(ends.length >= 2);
    assert.deepEqual(ends.filter((end) => end.series === 0).map((end) => [end.row, end.text, end.align]), [[0, "310", "left"], [5, "503", "right"]]);
    // The centered values keep the first and last points free, and the ends are the only values there.
    for (const row of layer.stack.values) assert.equal(row[0] || row[row.length - 1], false);
    const plotLeft = layer.plot.left;
    for (const end of ends) if (end.align === "left") assert.ok(end.box.x >= plotLeft, "inside the plot");
  });

  test("a 100% area runs edge to edge too, with no values; a single point has no edges", () => {
    const percent = layerOf({ title: "Mix", chart: area("100pct-stacked-area") }).stack;
    assert.equal(percent.edge, true);
    assert.equal(percent.ends, undefined);
    const one = layerOf({ title: "Traffic", chart: { type: "stacked-area", data: { columns: ["Month", "Mobile", "Desktop"], rows: [["Jan", 310, 290]] } } }).stack;
    assert.notEqual(one?.edge, true);
  });

  test("the plot keeps half of the end labels' width beyond its edges", () => {
    const wide = { type: "stacked-area", data: { columns: ["Quarter", "Mobile", "Desktop"], rows: [["Fiscal first quarter", 310, 290], ["Second", 342, 284], ["Fiscal last quarter", 503, 258]] } };
    const layer = layerOf({ title: "Traffic", chart: wide }), box = chartOf({ title: "Traffic", chart: wide }).box;
    assert.ok(layer.plot.left >= 20 && layer.plot.right >= 20, `room for the labels (${layer.plot.left}, ${layer.plot.right})`);
    assert.ok(box.width > layer.plot.left + layer.plot.right);
  });
});

describe("LH-125: a doughnut's hole", () => {
  test("the value of the one slice the title names is printed in the hole, with its category under it when that fits", () => {
    const list = layerOf({ title: "Two in three tickets are resolved on first contact", chart: doughnut() }).valueList;
    const hole = list.hole;
    assert.equal(hole.row, 0);
    assert.equal(hole.value.text, "6240");
    assert.ok(hole.value.size > 20, "larger than the chart text");
    const cx = list.pie.x + list.pie.width / 2, cy = list.pie.y + list.pie.height / 2, radius = list.pie.width / 4;
    for (const part of [hole.value, hole.name].filter(Boolean)) {
      assert.ok(Math.abs(part.box.x + part.box.width / 2 - cx) < 0.5, "centered");
      assert.ok(part.box.y > cy - radius && part.box.y + part.box.height < cy + radius, "inside the hole vertically");
      assert.ok(part.box.width < 2 * radius, "inside the hole horizontally");
    }
  });

  test("no focus, two focused slices, a pie or an unfitting value print nothing in the hole", () => {
    assert.equal(layerOf({ title: "Tickets by outcome", chart: doughnut() }).valueList?.hole, undefined, "nothing named");
    assert.equal(layerOf({ title: "Resolved and Escalated tickets", chart: doughnut() }).valueList?.hole, undefined, "two named");
    const pie = layerOf({ title: "Two in three tickets are resolved on first contact", chart: { ...doughnut(), type: "pie" } }).valueList;
    assert.equal(pie?.hole, undefined, "a pie has no hole");
    const big = doughnut({ data: { columns: ["Outcome", { name: "Tickets", format: "#,##0,,,\" billion tickets in total\"" }], rows: [["Resolved", 6240000000], ["Follow-up", 2180000000], ["Escalated", 890000000]] } });
    assert.equal(layerOf({ title: "Resolved tickets lead", chart: big }).valueList?.hole, undefined, "a value wider than the hole");
  });
});
