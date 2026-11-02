// LH-03 and LH-81: the chart layer (small charts and the header row) that composition decides for both engines.
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { chartEmphasisColors, chartHeader, chartHeaderCaption, chartLayer, chartLayerDataLabels, colorContrast, composeSlide, resolveChartData, smallChart } from "../dist/composition.js";

const measure = (text, size, weight) => text.length * size * (weight === 700 ? 0.6 : 0.55);
const box = { x: 100, y: 100, width: 640, height: 400 };
const geometry = { box, scale: 1, measure };
const layerOf = (chart, extra = {}) => chartLayer(chart, resolveChartData(chart), { ...geometry, ...extra });
const quarters = (series) => ({ columns: ["Quarter", ...series], rows: [["Q1", 12, 9], ["Q2", 18, 11], ["Q3", 24, 15], ["Q4", 27, 16]].map((row) => row.slice(0, series.length + 1)) });

describe("small charts (LH-03)", () => {
  test("one or two series of eight or fewer points take value labels, no value axis and no panel", () => {
    for (const type of ["column", "bar", "line", "line-with-markers"]) {
      for (const series of [["Revenue"], ["Revenue", "Costs"]]) {
        const chart = { type, data: quarters(series) };
        const small = smallChart(chart, resolveChartData(chart));
        assert.ok(small, `${type} ${series.length}`);
        assert.equal(small.labels, true);
        assert.equal(small.valueAxis, false);
      }
    }
  });

  test("the rule is the counts and the type, not the slide", () => {
    const many = { type: "column", data: { columns: ["Month", "Visits"], rows: Array.from({ length: 9 }, (_, index) => [`M${index + 1}`, index * 3]) } };
    assert.equal(smallChart(many, resolveChartData(many)), undefined, "nine points");
    const three = { type: "column", data: { columns: ["Q", "A", "B", "C"], rows: [["Q1", 1, 2, 3]] } };
    assert.equal(smallChart(three, resolveChartData(three)), undefined, "three series");
    for (const type of ["stacked-column", "100pct-stacked-bar", "stacked-line", "area", "combo", "pie", "scatter"]) {
      const chart = { type, data: quarters(["Revenue", "Costs"]) };
      assert.equal(smallChart(chart, resolveChartData(chart)), undefined, type);
    }
    const eight = { type: "bar", data: { columns: ["Stage", "Count"], rows: Array.from({ length: 8 }, (_, index) => [`S${index}`, 100 - index * 10]) } };
    assert.ok(smallChart(eight, resolveChartData(eight)), "eight points");
  });

  test("explicit options win", () => {
    const data = quarters(["Revenue"]);
    assert.equal(smallChart({ type: "column", data, dataLabels: false }, resolveChartData({ type: "column", data })), undefined, "dataLabels false");
    const explicit = smallChart({ type: "column", data, dataLabels: { position: "inside-end" } }, resolveChartData({ type: "column", data }));
    assert.deepEqual([explicit.labels, explicit.valueAxis], [false, false], "explicit labels draw as written");
    assert.equal(smallChart({ type: "column", data, dataLabels: { content: ["category"] } }, resolveChartData({ type: "column", data })).valueAxis, true, "labels without the value keep the axis");
    assert.equal(smallChart({ type: "column", data, axisTitles: { value: "Revenue ($M)" } }, resolveChartData({ type: "column", data })).valueAxis, true, "a value axis title keeps the axis");
    assert.equal(smallChart({ type: "column", data, highlight: { categories: ["Q2"] } }, resolveChartData({ type: "column", data })).emphasis, undefined, "highlight keeps its colours");
    assert.equal(smallChart({ type: "column", data, colors: ["accent2"] }, resolveChartData({ type: "column", data })).emphasis, undefined, "colors keep their colours");
  });

  test("a one-series column or bar chart emphasises its last point with a value", () => {
    const chart = { type: "column", data: { columns: ["Q", "Revenue"], rows: [["Q1", 4], ["Q2", 6], ["Q3", null]] } };
    assert.equal(smallChart(chart, resolveChartData(chart)).emphasis, 1);
    const two = { type: "column", data: quarters(["Revenue", "Costs"]) };
    assert.equal(smallChart(two, resolveChartData(two)).emphasis, undefined);
    const line = { type: "line", data: quarters(["Revenue"]) };
    assert.equal(smallChart(line, resolveChartData(line)).emphasis, undefined);
  });

  test("labels that do not fit beside each other keep the value axis", () => {
    const wide = { type: "column", data: { columns: ["Q", "A", "B"], rows: Array.from({ length: 8 }, (_, index) => [`Q${index}`, 123456789 + index, 987654321]) } };
    assert.equal(smallChart(wide, resolveChartData(wide), geometry), undefined);
    assert.ok(smallChart(wide, resolveChartData(wide)), "without a geometry only the counts decide (import)");
  });

  test("the default labels are the value at the type's default position; explicit labels are kept", () => {
    const layer = { small: { labels: true, valueAxis: false } };
    assert.deepEqual(chartLayerDataLabels({ active: false }, layer, "bar").dataLabels, { content: ["value"], position: "outside-end", separator: ", " });
    assert.equal(chartLayerDataLabels({ active: false }, layer, "line").dataLabels.position, "above");
    assert.equal(chartLayerDataLabels({ active: false }, layer, "line").active, true);
    const own = { active: true, dataLabels: { content: ["category"], position: "center", separator: ", " } };
    assert.equal(chartLayerDataLabels(own, layer, "bar"), own);
    assert.equal(chartLayerDataLabels({ active: false }, undefined, "bar").dataLabels, undefined);
  });

  test("the quieter tint keeps the hue and stays visible against the backdrop", () => {
    for (const surface of ["#FFFFFF", "#011842", "#F2F2F2"]) {
      const { accent, muted } = chartEmphasisColors(surface, "#2E75B6");
      assert.equal(accent, "#2E75B6");
      assert.notEqual(muted, accent);
      assert.ok(colorContrast(muted, surface) >= 1.6 - 1e-9, surface);
    }
  });
});

describe("the header row (LH-81)", () => {
  test("the caption reads <series> by <category> from the data or the axis titles", () => {
    assert.equal(chartHeaderCaption({ type: "column" }, ["Quarter", "Current", "Baseline"]), "Current, Baseline by Quarter");
    assert.equal(chartHeaderCaption({ type: "bar" }, ["Stage", "Count"]), "Count by Stage");
    assert.equal(chartHeaderCaption({ type: "column", axisTitles: { value: "Task completion", category: "Week" } }, ["W", "Rate"]), "Task completion by Week");
    assert.equal(chartHeaderCaption({ type: "column" }, ["Quarter", "A", "B", "C"]), "By Quarter", "three names are the legend's job");
    assert.equal(chartHeaderCaption({ type: "column" }, ["Quarter", "Current", "Baseline"], "ar"), "Current, Baseline", "no English connective outside English");
    assert.equal(chartHeaderCaption({ type: "column" }, ["Quarter", "Current"], "en-GB"), "Current by Quarter");
  });

  test("two to four series put their legend in the header row, one series none, five keep the side legend", () => {
    const legendOf = (count) => {
      const data = { columns: ["Q", ...Array.from({ length: count }, (_, index) => `S${index + 1}`)], rows: [["Q1", ...Array.from({ length: count }, () => 1)]] };
      return chartHeader({ type: "column", data }, resolveChartData({ type: "column", data }), geometry)?.legend;
    };
    assert.equal(legendOf(1), undefined);
    for (const count of [2, 3, 4]) assert.equal(legendOf(count).entries.length, count);
    assert.equal(legendOf(5), undefined);
  });

  test("the legend shares the caption's row when both fit, and takes the next row otherwise", () => {
    const chart = { type: "column", data: quarters(["Current", "Baseline"]) };
    const wide = chartHeader(chart, resolveChartData(chart), geometry);
    assert.equal(wide.legend.box.y, wide.caption.box.y);
    assert.ok(wide.legend.box.x + wide.legend.box.width <= box.x + box.width - 10 + 1e-6, "the legend ends the row");
    const narrow = chartHeader(chart, resolveChartData(chart), { ...geometry, box: { ...box, width: 420 } });
    assert.ok(narrow.legend.box.y > narrow.caption.box.y);
    assert.equal(narrow.legend.box.x, box.x + 10);
    assert.ok(narrow.height > wide.height);
  });

  test("right to left, the caption starts at the right edge", () => {
    const chart = { type: "column", data: quarters(["Current", "Baseline"]) };
    const header = chartHeader(chart, resolveChartData(chart), { ...geometry, direction: "rtl" });
    assert.ok(Math.abs(header.caption.box.x + header.caption.box.width - (box.x + box.width - 10)) < 1e-6);
    assert.ok(header.legend.box.x < header.caption.box.x);
  });

  test("a legend option or a payload caption are explicit", () => {
    const chart = { type: "line", data: quarters(["Current", "Baseline"]) };
    assert.equal(chartHeader({ ...chart, legend: "right" }, resolveChartData(chart), geometry), undefined);
    const captioned = chartHeader(chart, resolveChartData(chart), { ...geometry, captioned: true });
    assert.equal(captioned.caption, undefined);
    assert.equal(captioned.legend.entries[0].key, "line");
    for (const type of ["pie", "scatter", "radar", "waterfall", "treemap"]) assert.equal(chartHeader({ type, data: quarters(["A", "B"]) }, resolveChartData({ type, data: quarters(["A", "B"]) }), geometry), undefined, type);
  });

  test("composition puts the layer on the composed chart and sizes the value axis below the header", () => {
    const slide = { title: "Signal", chart: { type: "column", data: quarters(["Current", "Baseline"]) } };
    const item = composeSlide(slide, { dimensions: { width: 1280, height: 720 } }).items.find((entry) => entry.field === "chart");
    assert.ok(item.chart.layer.header.caption.text.startsWith("Current, Baseline"));
    assert.ok(item.chart.layer.small, "two series of four points");
    assert.ok(item.chart.valueAxis);
    const plain = composeSlide({ title: "Signal", chart: { type: "pie", data: quarters(["Current"]) } }, { dimensions: { width: 1280, height: 720 } }).items.find((entry) => entry.field === "chart");
    assert.equal(plain.chart, undefined);
  });

  test("every series column name and every count is handled", () => {
    for (let series = 1; series <= 6; series++) {
      for (let points = 1; points <= 10; points++) {
        const data = { columns: ["C", ...Array.from({ length: series }, (_, index) => `Series ${index + 1}`)], rows: Array.from({ length: points }, (_, row) => [`P${row}`, ...Array.from({ length: series }, () => row + 1)]) };
        for (const type of ["column", "bar", "line", "area", "stacked-column", "combo"]) {
          const layer = layerOf({ type, data });
          if (layer?.small) assert.ok(series <= 2 && points <= 8, `${type} ${series}x${points}`);
          if (layer?.header?.legend) assert.ok(series >= 2 && series <= 4, `${type} ${series}x${points}`);
        }
      }
    }
  });
});
