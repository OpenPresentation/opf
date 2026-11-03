// LH-107 to LH-110: the chart follow-ups from the Claude Design chart comparison (core chart-marks.ts): waterfall roles and signed labels,
// a value list beside a pie, values inside stacked segments with the series named beside the last column, and the reference line and
// period band the slide title names.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { chartWaterfallColors, colorContrast, composeSlide, waterfallLabelText, waterfallRoles, waterfallSignedFormat } from "../dist/composition.js";

const chartOf = (slide, options = {}) => composeSlide(slide, { width: 1280, height: 720, ...options }).items.find((item) => item.field === "chart");
const layerOf = (slide, options) => chartOf(slide, options)?.chart?.layer ?? {};
const waterfall = (extra = {}) => ({ type: "waterfall", data: { columns: ["Step", "Operating profit ($M)"], rows: [["2024 profit", 42], ["Volume", 9.3], ["Price", 6.1], ["Materials", -7.4], ["Labor", -5.2], ["Currency", -2.1], ["2025 profit", 42.7]] }, ...extra });
const pie = (rows, type = "pie", extra = {}) => ({ type, data: { columns: ["Segment", "Revenue ($M)"], rows }, ...extra });
const stacked = (type = "stacked-column", extra = {}) => ({ type, data: { columns: ["Quarter", "Subscriptions ($M)", "Services ($M)", "Hardware ($M)"], rows: [["Q1", 12.1, 8.3, 3.7], ["Q2", 14, 8.6, 4.2], ["Q3", 16.2, 8.9, 4.3], ["Q4", 19.4, 9.1, 4.7]] }, ...extra });
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const delivery = { type: "line", data: { columns: ["Month", { name: "On-time delivery", format: "0.0%" }], rows: months.map((month, i) => [month, [0.934, 0.941, 0.928, 0.952, 0.961, 0.957, 0.944, 0.936, 0.949, 0.968, 0.972, 0.979][i]]) } };
const spend = { type: "line", data: { columns: ["Year", "Cloud ($B)", "On-premises ($B)"], rows: [["2020", 3.1, 8.4], ["2021", 4.2, 7.9], ["2022", 5.6, 7.3], ["2023", 7.3, 6.5], ["2024", 9.4, 5.6], ["2025", 11.8, 4.8]] } };

describe("LH-107: waterfall roles", () => {
  test("the last value equal to the sum before it is a total, and so is the first bar it runs from", () => {
    assert.deepEqual(waterfallRoles([42, 9.3, 6.1, -7.4, -5.2, -2.1, 42.7]), ["total", "increase", "increase", "decrease", "decrease", "decrease", "total"]);
    assert.deepEqual(waterfallRoles([100, 24, -8, 50]), ["increase", "increase", "decrease", "increase"], "no total: every bar is a step");
    assert.deepEqual(waterfallRoles([5, null, -2]), ["increase", null, "decrease"]);
  });

  test("labels are signed with a real minus; totals unsigned; the native format says the same", () => {
    assert.equal(waterfallLabelText(9.3, undefined, "increase"), "+9.3");
    assert.equal(waterfallLabelText(-7.4, undefined, "decrease"), "−7.4");
    assert.equal(waterfallLabelText(42.7, undefined, "total"), "42.7");
    assert.equal(waterfallLabelText(-1234.5, "$#,##0.0", "decrease"), "−$1,234.5");
    assert.equal(waterfallSignedFormat("$#,##0.0"), '"+"$#,##0.0;"−"$#,##0.0;$#,##0.0');
    assert.equal(waterfallSignedFormat(undefined), '"+"General;"−"General;General');
  });

  test("role colors: dark2 for totals when it reads on the backdrop, else the text color; losses a light gray", () => {
    const light = chartWaterfallColors("#FFFFFF", "#2874A6", "#000000", "#011842", { labeled: true });
    assert.equal(light.total, "#011842");
    assert.equal(light.increase, "#2874A6");
    assert.ok(colorContrast(light.decrease, "#FFFFFF") >= 1.6 && colorContrast(light.decrease, "#FFFFFF") < 3, `labeled losses are a light gray (${light.decrease})`);
    const dark = chartWaterfallColors("#011842", "#5DA9DD", "#FFFFFF", "#011842", { labeled: true });
    assert.equal(dark.total, "#FFFFFF", "dark2 on a dark slide: the text colour");
    assert.ok(colorContrast(chartWaterfallColors("#FFFFFF", "#2874A6", "#000000", "#011842").decrease, "#FFFFFF") >= 3, "unlabeled losses keep 3:1");
  });

  test("composition: default signed labels drop the value axis, and the column name becomes the caption", () => {
    const layer = layerOf({ title: "Price and volume more than offset cost increases", chart: waterfall() });
    assert.deepEqual(layer.waterfall, { roles: ["total", "increase", "increase", "decrease", "decrease", "decrease", "total"], labels: true, valueAxis: false, colors: true });
    assert.equal(layer.header.caption.text, "Operating profit ($M)");
    const plain = layerOf({ title: "Bridge", chart: waterfall({ dataLabels: false }) });
    assert.equal(plain.waterfall.labels, false);
    assert.equal(plain.waterfall.valueAxis, true, "no labels: the axis stays");
    assert.equal(plain.header, undefined);
    assert.equal(layerOf({ title: "Bridge", chart: waterfall({ axisTitles: { value: "$M" } }) }).waterfall.valueAxis, true, "a value axis title keeps the axis");
    assert.equal(layerOf({ title: "Bridge", chart: waterfall({ colors: ["accent2"] }) }).waterfall.colors, false, "authored colors keep their positions");
  });
});

describe("LH-108: the value list beside a pie", () => {
  const three = [["Enterprise", 62.4], ["Mid-market", 25.1], ["Small business", 12.5]];
  test("a pie in the whole body lists its categories and values; the title's focus is bold", () => {
    const layer = layerOf({ title: "Enterprise accounts bring 62% of revenue", chart: pie(three) });
    assert.equal(layer.slices, undefined, "the list replaces the slice names");
    const list = layer.valueList;
    assert.deepEqual(list.rows.map((row) => [row.name, row.value, row.bold === true]), [["Enterprise", "62.4", true], ["Mid-market", "25.1", false], ["Small business", "12.5", false]]);
    assert.equal(list.header.text, "Revenue ($M)");
    assert.equal(list.pie.width, list.pie.height, "the pie fills a square");
    assert.ok(list.pie.x + list.pie.width < list.rows[0].box.x, "the pie is at the start, the list at the end");
    for (const [index, row] of list.rows.entries()) if (index) assert.ok(Math.abs(row.box.y - list.rows[index - 1].box.y - row.box.height) < 0.01, "rows follow each other");
  });

  test("right to left, the list is at the start and the pie at the end", () => {
    const list = layerOf({ title: "Revenue", chart: pie(three) }, { direction: "rtl" }).valueList;
    assert.ok(list.rows[0].box.x + list.rows[0].box.width < list.pie.x + 1, "mirrored");
  });

  test("a narrow box keeps the slice names; options and many categories keep the chart as it was", () => {
    const narrow = layerOf({ title: "Budget", composition: { mode: "row" }, chart: pie([["Engineering", 45], ["Sales", 25], ["Marketing", 18], ["Support", 12]]), text: "Engineering takes almost half of the budget this year." });
    assert.equal(narrow.valueList, undefined);
    assert.ok(narrow.slices);
    for (const extra of [{ legend: "right" }, { dataLabels: true }]) assert.equal(layerOf({ title: "Revenue", chart: pie(three, "pie", extra) }).valueList, undefined, JSON.stringify(extra));
    const nine = Array.from({ length: 9 }, (_, i) => [`Item ${i + 1}`, 10 + i]);
    assert.equal(layerOf({ title: "Revenue", chart: pie(nine) }).valueList, undefined, "nine categories");
    assert.ok(layerOf({ title: "Tickets", chart: pie([["Resolved on first contact", 6240], ["Resolved after follow-up", 2180], ["Escalated", 890], ["Unresolved", 310]], "doughnut") }).valueList, "a one-series doughnut lists too");
  });
});

describe("LH-109: stacked values and names", () => {
  test("values sit inside the segments that hold them; the series are named beside the last column instead of a legend", () => {
    const layer = layerOf({ title: "Subscriptions drive the growth in revenue", chart: stacked() });
    assert.deepEqual(layer.stack.values, [[true, true, true, true], [true, true, true, true], [true, true, true, true]]);
    const names = layer.stack.names;
    assert.deepEqual(names.entries.map((entry) => [entry.name, entry.bold === true]), [["Subscriptions ($M)", true], ["Services ($M)", false], ["Hardware ($M)", false]]);
    assert.equal(layer.header?.legend, undefined, "no legend");
    assert.ok(layer.plot.right >= names.gutter, "the plot leaves a gutter for the names");
    const ys = names.entries.map((entry) => entry.box.y);
    assert.ok(ys[0] > ys[1] && ys[1] > ys[2], "names stack as the segments do (the first series at the bottom)");
  });

  test("an area's first and last points carry no value; a 100% chart none; options keep the chart as authored", () => {
    const area = layerOf({ title: "Traffic", chart: stacked("stacked-area") }).stack;
    for (const row of area.values) assert.equal(row[0] || row[row.length - 1], false);
    assert.ok(area.values.some((row) => row.some(Boolean)));
    const percent = layerOf({ title: "Mix", chart: stacked("100pct-stacked-column") }).stack;
    assert.ok(percent.values.every((row) => row.every((fits) => !fits)), "raw values would contradict a share axis");
    for (const extra of [{ dataLabels: true }, { legend: "right" }]) assert.equal(layerOf({ title: "Revenue", chart: stacked("stacked-column", extra) }).stack, undefined, JSON.stringify(extra));
  });
});

describe("LH-110: reference marks the title names", () => {
  test("a compared number the data does not hold draws a labeled line, and the axis holds it", () => {
    const item = chartOf({ title: "On-time delivery stayed above 92% all year", chart: delivery });
    const [line] = item.chart.layer.references.lines;
    assert.equal(line.value, 0.92);
    assert.equal(line.text, "92%");
    assert.ok(item.chart.valueAxis.min <= 0.92, "the axis reaches the line");
    assert.ok(line.label.y > line.y, "the label sits under the line: the data are above it");
  });

  test("conservative matching: a data value, a number without a comparison, another language or a percent on a plain column draw nothing", () => {
    assert.equal(layerOf({ title: "On-time delivery peaked at 97.9%", chart: delivery }).references, undefined, "a value the data holds");
    assert.equal(layerOf({ title: "On-time delivery was 92% or better", chart: delivery }).references, undefined, "no comparison word");
    assert.equal(layerOf({ title: "La ponctualité est restée au-dessus de 92 %", chart: delivery }, { language: "fr" }).references, undefined);
    assert.equal(layerOf({ title: "Tickets stayed below 9000", chart: delivery }).references, undefined, "far outside the data and not a percent");
  });

  test("a line chart in time shades the one period the title names after a time preposition", () => {
    const layer = layerOf({ title: "Cloud spend overtook on-premises in 2023", chart: spend });
    assert.deepEqual(layer.references.bands.map((band) => band.row), [3]);
    assert.ok(layer.references.bands[0].box.height > 100);
    assert.equal(layerOf({ title: "Cloud spend grew every year of 2026", chart: spend }).references, undefined, "a year that is not a category");
    assert.equal(layerOf({ title: "Cloud spend overtook on-premises in 2023", chart: { ...spend, type: "column" } }).references, undefined, "columns: the focus emphasis names the period");
  });
});

describe("LH-109 and LH-110 with LH-93's shared plots", () => {
  test("sibling stacked charts share one plot; their names and lines are placed against it", () => {
    const left = stacked(), right = { ...stacked(), data: { ...stacked().data, rows: stacked().data.rows.map(([q, a, b, c]) => [q, a / 2, b, c]) } };
    const items = composeSlide({ title: "Subscriptions by region", blocks: [{ chart: left }, { chart: right }] }, { width: 1280, height: 720 }).items.filter((item) => item.field === "chart");
    assert.equal(items.length, 2);
    const plots = items.map((item) => item.chart.layer.plot);
    assert.ok(plots.every(Boolean));
    const heights = items.map((item, index) => item.box.height - plots[index].top - plots[index].bottom);
    assert.ok(Math.abs(heights[0] - heights[1]) < 0.5, "one plot height");
    for (const item of items) for (const entry of item.chart.layer.stack.names?.entries ?? []) {
      assert.ok(entry.box.x >= item.box.x - 0.5 && entry.box.x + entry.box.width <= item.box.x + item.box.width + 0.5, "names inside their chart");
      assert.ok(entry.box.y >= item.box.y - 0.5 && entry.box.y + entry.box.height <= item.box.y + item.box.height + 0.5);
    }
  });
});
