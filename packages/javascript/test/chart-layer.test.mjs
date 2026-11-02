// LH-03 and LH-81: the chart layer (small charts and the header row) that composition decides for both engines.
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { chartEmphasisColors, chartHeader, chartHeaderCaption, chartLayer, chartLayerDataLabels, chartPaletteForFill, chartSchemeSeries, chartSeriesPalette, colorContrast, composeSlide, resolveChartData, smallChart } from "../dist/composition.js";
import { colorSchemes } from "./support/catalog.mjs";

// CIE L* of an sRGB hex color.
const lightness = (hex) => {
  const linear = (channel) => { const n = channel / 255; return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = [1, 3, 5].map((offset) => linear(Number.parseInt(hex.slice(offset, offset + 2), 16)));
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : 24389 / 27 * y;
};

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
    assert.equal(smallChart({ type: "column", data, highlight: { categories: ["Q2"] } }, resolveChartData({ type: "column", data })).emphasis, undefined, "highlight keeps its colors");
    assert.equal(smallChart({ type: "column", data, colors: ["accent2"] }, resolveChartData({ type: "column", data })).emphasis, undefined, "colors keep their colors");
  });

  test("a one-series column or bar chart emphasizes its last point with a value", () => {
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

  test("LH-95: the emphasized point is a stronger shade of the series color on every backdrop", () => {
    // Every gallery color scheme, on its light and dark backdrops (light1, light2, dark1, dark2), for the series color the engines draw:
    // the other points keep the series color, the emphasized one stands 15 L* from it, and both reach 3:1 against the backdrop.
    let emphasized = 0;
    for (const scheme of colorSchemes) {
      for (const backdrop of [scheme.light1, scheme.light2, scheme.dark1, scheme.dark2].filter(Boolean)) {
        const series = chartPaletteForFill(backdrop, chartSeriesPalette(scheme), { legible: chartSchemeSeries(undefined, scheme) })[0];
        const colors = chartEmphasisColors(backdrop, series);
        assert.ok(colors, `${scheme.id} on ${backdrop}: an emphasis`);
        emphasized++;
        assert.equal(colors.muted, series.slice(0, 7).toUpperCase(), "the other points keep the series color");
        for (const color of [colors.accent, colors.muted]) assert.ok(colorContrast(color, backdrop) >= 3 - 1e-9, `${scheme.id} on ${backdrop}: ${color} at 3:1`);
        assert.ok(Math.abs(lightness(colors.accent) - lightness(colors.muted)) >= 15 - 1e-9, `${scheme.id} on ${backdrop}: 15 L* apart`);
        // Away from the backdrop: darker on a light one, lighter on a dark one.
        assert.equal(lightness(colors.accent) < lightness(colors.muted), lightness(backdrop) > lightness(colors.muted), `${scheme.id} on ${backdrop}: away from the backdrop`);
      }
    }
    assert.ok(emphasized >= colorSchemes.length * 2);
    // The case LH-03's tint could not emphasize: a mid blue on the default navy now takes a lighter blue.
    const navy = chartEmphasisColors("#011842", "#308BC7");
    assert.equal(navy.muted, "#308BC7");
    assert.ok(lightness(navy.accent) - lightness("#308BC7") >= 15 - 1e-9 && colorContrast(navy.accent, "#011842") >= 3);
    const light = chartEmphasisColors("#FFFFFF", "#1F4E79");
    assert.ok(lightness("#1F4E79") - lightness(light.accent) >= 15 - 1e-9, "darker on white");
    // A series color too dark to go 15 L* darker is shaded the other way, still at 3:1.
    const black = chartEmphasisColors("#FFFFFF", "#101010");
    assert.ok(lightness(black.accent) - lightness("#101010") >= 15 - 1e-9 && colorContrast(black.accent, "#FFFFFF") >= 3);
  });
});

describe("the header row (LH-81)", () => {
  test("a caption is generated only when it adds to the legend, with the category in sentence case", () => {
    assert.equal(chartHeaderCaption({ type: "bar" }, ["Stage", "Count"]), "Count by stage", "one series: <series> by <category>");
    assert.equal(chartHeaderCaption({ type: "column" }, ["Quarter", "Current", "Baseline"]), undefined, "two series: the legend names them");
    assert.equal(chartHeaderCaption({ type: "column" }, ["Quarter", "A", "B", "C"]), undefined);
    assert.equal(chartHeaderCaption({ type: "column", axisTitles: { value: "Revenue ($M)" } }, ["Quarter", "North", "South"]), "Revenue ($M) by quarter", "a value axis title captions several series");
    assert.equal(chartHeaderCaption({ type: "column", axisTitles: { value: "Task completion", category: "Week" } }, ["W", "Rate"]), "Task completion by week");
    assert.equal(chartHeaderCaption({ type: "column" }, ["Quarter", "Current"], "en-GB"), "Current by quarter");
    assert.equal(chartHeaderCaption({ type: "column" }, ["Quarter", "Current"], "ar"), "Current", "no English connective outside English");
    assert.equal(chartHeaderCaption({ type: "column" }, ["Quarter", "Current"]), "Current by quarter");
    // Acronyms and proper-looking tokens stay as written.
    for (const [category, expected] of [["FY27", "FY27"], ["Q1 Region", "Q1 region"], ["ARR Tier", "ARR tier"], ["iPhone Model", "iPhone model"], ["Sales Region", "sales region"], ["月", "月"]]) {
      assert.equal(chartHeaderCaption({ type: "column" }, [category, "Revenue"]), `Revenue by ${expected}`, category);
    }
    assert.equal(chartHeaderCaption({ type: "column" }, ["", "Revenue"]), "Revenue", "no category name");
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

  test("without a caption the legend starts the row", () => {
    const chart = { type: "column", data: quarters(["Current", "Baseline"]) };
    const header = chartHeader(chart, resolveChartData(chart), geometry);
    assert.equal(header.caption, undefined);
    assert.equal(header.legend.box.x, box.x + 10);
  });

  test("the legend shares the caption's row when both fit, and takes the next row otherwise", () => {
    const chart = { type: "column", axisTitles: { value: "Signal" }, data: quarters(["Current", "Baseline"]) };
    const wide = chartHeader(chart, resolveChartData(chart), geometry);
    assert.equal(wide.legend.box.y, wide.caption.box.y);
    assert.ok(wide.legend.box.x + wide.legend.box.width <= box.x + box.width - 10 + 1e-6, "the legend ends the row");
    const narrow = chartHeader(chart, resolveChartData(chart), { ...geometry, box: { ...box, width: 420 } });
    assert.ok(narrow.legend.box.y > narrow.caption.box.y);
    assert.equal(narrow.legend.box.x, box.x + 10);
    assert.ok(narrow.height > wide.height);
  });

  test("right to left, the caption starts at the right edge", () => {
    const chart = { type: "column", axisTitles: { value: "Signal" }, data: quarters(["Current", "Baseline"]) };
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
    assert.equal(item.chart.layer.header.caption, undefined, "two series: no generated caption");
    assert.deepEqual(item.chart.layer.header.legend.entries.map((entry) => entry.name), ["Current", "Baseline"]);
    assert.ok(item.chart.layer.small, "two series of four points");
    assert.ok(item.chart.valueAxis);
    const plain = composeSlide({ title: "Signal", chart: { type: "scatter", data: quarters(["Current"]) } }, { dimensions: { width: 1280, height: 720 } }).items.find((entry) => entry.field === "chart");
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
