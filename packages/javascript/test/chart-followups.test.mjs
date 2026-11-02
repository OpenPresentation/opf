// LH-92 and LH-93: ring names on nested-ring doughnuts and one plot height across sibling charts that share a value axis. (LH-95's
// emphasis shade is tested with the chart layer in chart-layer.test.mjs.)
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { chartLayer, chartPlotInset, chartRingLabels, composeSlide, resolveChartData, shareSiblingPlots } from "../dist/composition.js";

const rows = [["Q1", 28, 25], ["Q2", 32, 27], ["Q3", 35, 29], ["Q4", 39, 31]];
const chartOf = (extra = {}, names = ["Current", "Baseline"], shift = 0) => ({ type: "column", data: { columns: ["Quarter", ...names], rows: rows.map((row) => [row[0], row[1] - shift, row[2] - shift]) }, dataLabels: false, ...extra });
const charts = (result) => result.items.filter((item) => item.field === "chart");
const plotOf = (item) => {
  const inset = item.chart.layer?.plot;
  return inset && { top: item.box.y + inset.top, bottom: item.box.y + item.box.height - inset.bottom, height: item.box.height - inset.top - inset.bottom };
};

describe("LH-92: ring names", () => {
  const data = { columns: ["Region", "FY24", "FY25"], rows: [["North", 40, 35], ["South", 25, 45], ["East", 20, 22], ["West", 15, 13]] };

  test("each ring of a doughnut of several series is named on its largest slice", () => {
    const chart = { type: "doughnut", data };
    // The text runs along the ring at the slice's middle: North, the first 40% of FY24, is centered 72 degrees past 12 o'clock; South,
    // 35 to 80 of 115 in FY25, is centered at 6 o'clock, where the ring runs level.
    const rings = chartRingLabels(chart, resolveChartData(chart));
    assert.deepEqual(rings.map(({ series, name, row }) => ({ series, name, row })), [{ series: 0, name: "FY24", row: 0 }, { series: 1, name: "FY25", row: 1 }]);
    assert.deepEqual(rings.map((ring) => ring.rotation), [72, 0]);
    // Equal largest slices: the first of them.
    const tie = { type: "doughnut", data: { columns: ["Region", "A", "B"], rows: [["North", 5, 7], ["South", 5, 7]] } };
    assert.deepEqual(chartRingLabels(tie, resolveChartData(tie)).map((ring) => ring.row), [0, 0]);
  });

  test("one ring, a pie and a ring without a positive value have no names", () => {
    const one = { type: "doughnut", data: { columns: ["Region", "FY24"], rows: data.rows.map((row) => row.slice(0, 2)) } };
    assert.equal(chartRingLabels(one, resolveChartData(one)), undefined);
    assert.equal(chartRingLabels({ type: "pie", data }, resolveChartData({ type: "pie", data })), undefined, "the drawn type is the doughnut");
    const empty = { type: "doughnut", data: { columns: ["Region", "FY24", "FY25"], rows: [["North", 4, 0], ["South", 6, 0]] } };
    assert.equal(chartRingLabels(empty, resolveChartData(empty)), undefined, "one ring left");
  });

  test("composition names the rings of a pie of several series (drawn as nested rings)", () => {
    const result = composeSlide({ title: "Mix", chart: { type: "pie", data } });
    assert.deepEqual(charts(result)[0].chart.layer.rings.map((ring) => ring.name), ["FY24", "FY25"]);
    const layer = chartLayer({ type: "doughnut", data }, resolveChartData({ type: "doughnut", data }), { box: { x: 0, y: 0, width: 600, height: 400 }, scale: 1, measure: (text) => text.length * 10 });
    assert.equal(layer.rings.length, 2);
  });
});

describe("LH-93: one plot height across siblings", () => {
  test("a category axis title on one sibling no longer makes its plot shorter than the other's", () => {
    const result = composeSlide({ title: "Two", blocks: [{ chart: chartOf({ axisTitles: { category: "Fiscal quarter" } }) }, { chart: chartOf({}, ["Current", "Baseline"], 10) }] });
    const [a, b] = charts(result).map(plotOf);
    assert.ok(a && b, "both get a plot");
    assert.ok(Math.abs(a.height - b.height) < 1e-6, "one height");
    assert.ok(Math.abs(a.top - b.top) < 1e-6 && Math.abs(a.bottom - b.bottom) < 1e-6, "side by side: one top and one baseline");
    // The shorter plot is the one with the title: its plot is its own; the other is shortened to it.
    const [first] = charts(result);
    const own = chartPlotInset(first.value, resolveChartData(first.value), first.chart, { box: first.box, scale: 1, measure: (text, size) => text.length * size * 0.5 });
    assert.ok(own.bottom > first.box.height * 0.1, "the title and labels sit under the plot");
  });

  test("a header row (LH-81) on one sibling and an explicit legend on the other give one top", () => {
    const result = composeSlide({ title: "Two", blocks: [{ chart: chartOf() }, { chart: chartOf({ legend: "bottom" }, ["Current", "Baseline"], 10) }] });
    const [a, b] = charts(result).map(plotOf);
    assert.ok(Math.abs(a.top - b.top) < 1e-6 && Math.abs(a.height - b.height) < 1e-6);
  });

  test("charts that do not share an axis, horizontal bars and a lone chart keep the plot the engines lay out", () => {
    const apart = composeSlide({ title: "Two", blocks: [{ chart: chartOf() }, { chart: chartOf({}, ["Now", "Before"]) }] });
    assert.ok(charts(apart).every((item) => item.chart.layer?.plot === undefined), "another unit");
    const bars = composeSlide({ title: "Two", blocks: [{ chart: chartOf({ type: "bar" }) }, { chart: chartOf({ type: "bar" }, ["Current", "Baseline"], 10) }] });
    assert.ok(charts(bars).every((item) => item.chart.layer?.plot === undefined), "horizontal bars");
    const lone = composeSlide({ title: "One", chart: chartOf() });
    assert.equal(charts(lone)[0].chart.layer?.plot, undefined);
  });

  test("right to left, the plots mirror and keep one height", () => {
    const result = composeSlide({ title: "Two", blocks: [{ chart: chartOf({ axisTitles: { value: "Revenue ($M)" } }) }, { chart: chartOf({}, ["Current", "Baseline"], 10) }] }, { direction: "rtl" });
    const plots = charts(result).map(plotOf);
    assert.ok(plots.every(Boolean) && Math.abs(plots[0].height - plots[1].height) < 1e-6);
    // The value tick labels sit at the right of a right-to-left plot: the right inset is the wider one.
    const second = charts(result)[1].chart.layer.plot;
    assert.ok(second.right > second.left);
  });

  test("siblings in different rows take the shortest plot's height on their own baseline", () => {
    const box = (y, height) => ({ x: 0, y, width: 600, height });
    const measure = (text, size) => text.length * size * 0.5;
    const items = [
      { value: chartOf({ axisTitles: { category: "Fiscal quarter" } }), box: box(0, 300), chart: { valueAxis: { min: 0, max: 50, majorUnit: 10 } } },
      { value: chartOf(), box: box(320, 400), chart: { valueAxis: { min: 0, max: 50, majorUnit: 10 } } },
    ];
    shareSiblingPlots([items], () => ({ scale: 1, measure }));
    const [a, b] = items.map(plotOf);
    assert.ok(Math.abs(a.height - b.height) < 1e-6);
    const own = chartPlotInset(items[1].value, resolveChartData(items[1].value), { valueAxis: items[1].chart.valueAxis }, { box: items[1].box, scale: 1, measure });
    assert.ok(Math.abs(b.bottom - (items[1].box.y + items[1].box.height - own.bottom)) < 1e-6, "on its own baseline");
  });
});
