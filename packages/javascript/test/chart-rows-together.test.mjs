// LH-115 follow-up (0.35.1): a bar chart drawn on a short table's rows keeps its parts together. Its header row starts on the table's top
// line, a centered short table grows (LH-48 growth) with the bars on its rows, the rows and the table are centered as one group with the chart's parts, and the chart box and its text size stay as they were.
import assert from "node:assert/strict";
import { test } from "node:test";

import { chartPlotInset, chartTextSize, composeSlide, layoutTable, resolveChartData } from "../dist/composition.js";

const compose = (slide, options = {}) => composeSlide(slide, { width: 1280, height: 720, ...options });
const tableOf = (result) => result.items.find((item) => item.field === "table");
const chartOf = (result) => result.items.find((item) => item.field === "chart");
const names = ["Prototype A", "Prototype B", "Prototype C", "Prototype D", "Prototype E", "Prototype F", "Prototype G", "Prototype H"];
const values = [5.8, 6.7, 4.9, 7.3, 6.1, 5.2, 6.9, 4.4];
const presentation = (count) => ({ slides: [], datasets: { taskTimes: { columns: ["Prototype", "Minutes"], rows: names.slice(0, count).map((name, index) => [name, values[index]]) } } });
const lesson = (chart = {}) => ({
  title: "Compare the two prototypes",
  subtitle: "Illustrative data · median task time, minutes",
  chart: { type: "bar", data: { dataset: "taskTimes" }, axisTitles: { category: "Prototype", value: "Median task time (min)" }, dataLabels: { content: ["value"] }, ...chart },
  table: { dataset: "taskTimes" },
});
const tableRows = (table, document) => layoutTable(table.value, table.box, { scale: 1, minFontSizePx: table.composition.minFontSizePx, presentation: document, ...(table.tableGrowth ? { growth: table.tableGrowth } : {}) }).rows;

for (const count of [2, 4]) test(`a bar chart on the rows of a short table keeps its parts together (${count} categories)`, () => {
  const document = presentation(count), result = compose(lesson(), { presentation: document });
  const chart = chartOf(result), table = tableOf(result), layer = chart.chart.layer, rows = layer.rows;
  assert.ok(rows, "the bars are on the table's rows");
  const laid = tableRows(table, document), tableTop = laid[0].box.y, tableBottom = laid.at(-1).box.y + laid.at(-1).box.height;
  // The header row starts on the table's top line: its caption one padding below it, as in a box whose top is that line.
  assert.ok(Math.abs(layer.header.caption.box.y - (tableTop + 10)) < 1, `caption ${layer.header.caption.box.y} vs table top ${tableTop}`);
  assert.ok(layer.header.caption.box.y + layer.header.caption.box.height <= chart.box.y + rows.top + 1, "the caption stands above the first row");
  // Each bar is still on its row.
  for (const [index, row] of laid.slice(1).entries()) assert.ok(Math.abs(chart.box.y + rows.centers[index] - (row.box.y + row.box.height / 2)) < row.box.height / 2, `row ${index}`);
  // The chart box keeps its size (the largest 4:3 box of its cell), so its text size is unchanged.
  assert.ok(Math.abs(chart.box.width / chart.box.height - 4 / 3) < 0.01, "a 4:3 box");
  assert.ok(chartTextSize({ width: chart.box.width, height: chart.box.height, scale: 1 }) >= 18, "the chart text is not set smaller");
  // The group (the table and the chart's parts: header to value axis title) is centered in the chart box when LH-52 centered the row (two
  // rows fill little of the body; four rows measured with the estimate fill enough that the row keeps its top).
  const inset = chartPlotInset(chart.value, resolveChartData(chart.value, document), chart.chart, { box: chart.box, scale: 1, measure: (text, size) => text.length * size * 0.5 });
  const groupTop = Math.min(tableTop, layer.header.caption.box.y - 10), groupBottom = Math.max(tableBottom, chart.box.y + rows.bottom + inset.bottom);
  if (count === 2) assert.ok(Math.abs((groupTop + groupBottom) / 2 - (chart.box.y + chart.box.height / 2)) < 2, `group ${groupTop}-${groupBottom} in box ${chart.box.y}+${chart.box.height}`);
  assert.ok(groupTop >= chart.box.y - 0.5 && groupBottom <= chart.box.y + chart.box.height + 0.5, "inside the chart box");
});

test("a chart with an explicit legend, or rows that do not fit its plot, keeps its layout", () => {
  const legend = compose(lesson({ legend: "bottom" }), { presentation: presentation(2) });
  const chart = chartOf(legend), table = tableOf(legend);
  assert.ok(chart.chart.layer.rows, "aligned");
  assert.ok(Math.abs(chart.box.y + chart.box.height / 2 - (table.box.y + table.box.height / 2)) < 1, "the table stays in the middle of the row");
  // Eight rows are taller than the chart's plot band: no alignment, nothing moves.
  const eight = chartOf(compose(lesson(), { presentation: presentation(8) }));
  assert.equal(eight.chart.layer.rows, undefined);
  assert.ok(Math.abs(eight.chart.layer.header.caption.box.y - (eight.box.y + 10)) < 1, "the caption at the top of the box");
});

test("the short table grows (LH-48 growth, up to its display size) and the bars follow its rows", () => {
  const document = presentation(2), result = compose(lesson(), { presentation: document });
  const chart = chartOf(result), table = tableOf(result), rows = chart.chart.layer.rows;
  assert.ok(table.tableGrowth > 1, "the table grew");
  const laid = layoutTable(table.value, table.box, { scale: 1, minFontSizePx: table.composition.minFontSizePx, presentation: document, growth: table.tableGrowth }).rows;
  const sizes = laid.flatMap((row) => row.cells.map((cell) => cell.fit.fontSize));
  assert.ok(Math.min(...sizes) > 25 && Math.max(...sizes) <= 32 + 1e-9, `grown cells between the nominal 25 px and the 32 px display size: ${sizes}`);
  for (const [index, row] of laid.slice(1).entries()) assert.ok(Math.abs(chart.box.y + rows.centers[index] - (row.box.y + row.box.height / 2)) < row.box.height / 2, `row ${index} carries its bar`);
  const layer = chart.chart.layer;
  assert.ok(Math.abs(layer.header.caption.box.y - (laid[0].box.y + 10)) < 1, "the caption on the grown table's top line");
  assert.ok(laid[0].box.y >= chart.box.y - 0.5 && laid.at(-1).box.y + laid.at(-1).box.height <= chart.box.y + chart.box.height + 0.5, "the grown table stays inside the chart box's height");
});
