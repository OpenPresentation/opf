// opf#1492: the plot core lays out for a horizontal bar chart with chart options is the plot the preview draws. A small bar chart (no
// value axis; the values are on the marks) whose labels come from the `dataLabels` option keeps the widest label's room beyond the longest
// bar, and stacked and 100% stacked horizontal bars with chart options have a plot (they had none, so the PPTX export left an outer plot
// area that Keynote reads as the inner plot).
import assert from "node:assert/strict";
import { test } from "node:test";

import { chartPlotInset, chartTextSize, composeSlide, resolveChartData } from "../dist/composition.js";

const rows = [["Cranes", 14, 9], ["Software", 22, 12], ["Leasing", 6, 8], ["Repairs", 3, 5]];
const chartOf = (chart) => composeSlide({ title: "Charts", chart }, { width: 1280, height: 720 }).items.find((item) => item.field === "chart");
const measure = (text, size) => text.length * size * 0.5;
const insetOf = (item) => chartPlotInset(item.value, resolveChartData(item.value, undefined), item.chart, { box: item.box, scale: 1, measure });
const one = (extra = {}) => ({ type: "bar", data: { columns: ["Product", "Margin"], rows: rows.map((row) => row.slice(0, 2)) }, ...extra });

test("a small bar chart's data labels keep the room of the widest label beyond the longest bar", () => {
  const labeled = chartOf(one({ dataLabels: true }));
  assert.equal(labeled.chart.layer.small.valueAxis, false, "a small chart draws no value axis");
  const inset = insetOf(labeled);
  assert.ok(inset, "the labeled chart has a plot");
  // The widest label ("22") and the padding and text size every plot keeps: the plot ends before the chart's edge by more than those.
  const fontPx = chartTextSize({ width: labeled.box.width, height: labeled.box.height, scale: 1 });
  assert.ok(inset.right > 10 + fontPx + measure("22", fontPx), `room for the label: ${inset.right}`);
  const content = chartOf(one({ dataLabels: { content: ["category", "value"] } }));
  assert.ok(insetOf(content).right > inset.right, "a label with the category name needs more room");
});

test("a stacked horizontal bar chart with chart options has a plot laid out as a clustered one", () => {
  for (const type of ["stacked-bar", "100pct-stacked-bar"]) {
    const item = chartOf({ type, dataLabels: true, data: { columns: ["Product", "Margin", "Cost"], rows } });
    const inset = insetOf(item);
    assert.ok(inset, `${type}: a plot`);
    assert.ok(inset.left > 0 && inset.top > 0 && inset.right > 0 && inset.bottom > 0, `${type}: insets on every side`);
    assert.ok(inset.left + inset.right < item.box.width && inset.top + inset.bottom < item.box.height, `${type}: the plot is inside the box`);
  }
});
