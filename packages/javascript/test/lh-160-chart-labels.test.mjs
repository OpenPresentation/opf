// LH-160: a histogram of many bins draws only bins whose labels fit (core decides the count, the edge decimals and the value labels);
// LH-161: a pie's or doughnut's last slice stands 11 L* from the first, so `opf/chart-color-only` finds no wrap pair on any gallery scheme.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { chartHistogram, chartPaletteForFill, chartSchemeSeries, chartSeriesPalette, chartSlicePalette, composeSlide, histogramBins, histogramEdgeDecimals, histogramEdgeFormat, resolveChartData, scottBinCount, CHART_SERIES_MIN_LIGHTNESS_STEP, HISTOGRAM_MIN_BINS } from "../dist/composition.js";
import { validate } from "../dist/index.js";
import { colorSchemes } from "./support/catalog.mjs";

const compose = (slide, options = {}) => composeSlide(slide, { width: 1280, height: 720, ...options });
const chartOf = (slide, options) => compose(slide, options).items.find((item) => item.field === "chart");

// A deterministic bell-shaped sample (the sum of three uniforms), so Scott's rule gives many bins.
let seed = 11;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
const sample = (n, mean, spread) => Array.from({ length: n }, () => [Math.round(mean + spread * (rand() + rand() + rand() - 1.5))]);
const histogram = (rows, extra = {}) => ({ type: "histogram", data: { columns: ["Salary"], rows }, ...extra });

describe("LH-160: bin edges", () => {
  test("the decimals follow the bin width: a tenth of a bin at most", () => {
    assert.equal(histogramEdgeDecimals(1320), 0);
    assert.equal(histogramEdgeDecimals(6), 0);
    assert.equal(histogramEdgeDecimals(3.7), 1);
    assert.equal(histogramEdgeDecimals(0.37), 2);
    assert.equal(histogramEdgeDecimals(0), 0);
    assert.equal(histogramEdgeDecimals(4, [1, 5, 9]), 0, "edges that are whole numbers need no decimals");
    assert.equal(histogramEdgeDecimals(4, [1, 4.5, 8]), 1, "an edge half a unit off a whole number is over a tenth of the bin");
    assert.equal(histogramEdgeFormat(0), "0");
    assert.equal(histogramEdgeFormat(2), "0.00");
  });

  test("labels carry the decimals when given and six significant digits otherwise", () => {
    const values = [3, 5, 8, 13];
    assert.deepEqual(histogramBins(values).map((bin) => bin.label), ["[3, 8]", "(8, 13]"]);
    assert.deepEqual(histogramBins(values, { decimals: 1 }).map((bin) => [bin.label, bin.count]), [["[3.0, 8.0]", 3], ["(8.0, 13.0]", 1]]);
    assert.equal(histogramBins(values, { count: 5 }).length, 5, "a count asked for is the count drawn");
    assert.equal(histogramBins(values, { count: 2 }).reduce((sum, bin) => sum + bin.count, 0), 4);
    assert.equal(scottBinCount(values), 2);
  });
});

describe("LH-160: a histogram draws the bins it can label", () => {
  const rows = sample(30000, 20000, 60000);
  const wide = (extra) => chartOf({ title: "Salaries", chart: histogram(rows, extra) }).chart.layer.histogram;
  const scott = scottBinCount(rows.map((row) => row[0]));

  test("a chart with more bins than its plot can label draws fewer, with edges rounded to the bin width", () => {
    assert.ok(scott > 40, `Scott's rule gives ${scott} bins`);
    const layer = wide();
    assert.ok(layer.bins >= HISTOGRAM_MIN_BINS && layer.bins < scott, `${layer.bins} bins of ${scott}`);
    assert.ok(Number.isInteger(layer.decimals) && layer.decimals >= 0);
    // The bins keep their labels one beside another: each gets at least HISTOGRAM_LABEL_SLOT text sizes of plot.
    const narrow = chartOf({ title: "Salaries", chart: histogram(rows) }, { width: 640, height: 360 }).chart.layer.histogram;
    assert.ok(narrow.bins <= layer.bins, "a smaller slide draws no more bins than a larger one");
  });

  test("a chart with room keeps Scott's count", () => {
    const few = sample(60, 50, 40);
    const layer = chartOf({ title: "Delivery", chart: histogram(few) }).chart.layer?.histogram;
    assert.equal(layer?.bins, scottBinCount(few.map((row) => row[0])));
  });

  test("data labels the author asked for are dropped where they do not fit beside each other, and kept where they do", () => {
    const labeled = { dataLabels: { content: ["value"] } };
    assert.equal(wide(labeled).valueLabels, false);
    assert.equal(wide().valueLabels, undefined, "no data labels, nothing to drop");
    const few = chartOf({ title: "Delivery", chart: histogram(sample(60, 50, 40), labeled) }).chart.layer.histogram;
    assert.equal(few.valueLabels, undefined, "a handful of wide bars keep their counts");
  });

  test("a category histogram keeps its rows; only its value labels follow the fit rule", () => {
    const hours = Array.from({ length: 48 }, (_, index) => [`${index}:00`, 1000 + index * 37]);
    const chart = { type: "histogram", dataLabels: { content: ["value"] }, data: { columns: ["Hour", "Tickets"], rows: hours } };
    const layer = chartOf({ title: "Tickets", chart }).chart.layer.histogram;
    assert.equal(layer.bins, undefined);
    assert.equal(layer.valueLabels, false);
  });

  test("only histogram and Pareto charts get the layer", () => {
    const column = { type: "column", data: { columns: ["Q", "A"], rows: [["Q1", 1], ["Q2", 2]] } };
    assert.equal(chartOf({ title: "T", chart: column }).chart.layer?.histogram, undefined);
    const resolved = resolveChartData(histogram(sample(40, 5, 4)));
    assert.equal(chartHistogram({ type: "column", data: {} }, resolved, { box: { x: 0, y: 0, width: 800, height: 400 }, scale: 1, measure: () => 10 }), undefined);
  });
});

describe("LH-161: a pie's last slice stands 11 L* from its first", () => {
  const lin = (c) => { const n = c / 255; return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4; };
  const lightness = (hex) => {
    const n = Number.parseInt(hex.slice(1, 7), 16), y = 0.2126729 * lin(n >> 16) + 0.7151522 * lin((n >> 8) & 255) + 0.072175 * lin(n & 255);
    return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y;
  };
  const surfaces = (scheme) => [scheme.light1, scheme.dark1, "#FFFFFF", "#011842"];

  test("chartSlicePalette clears the wrap pair for every slice count on every gallery scheme and surface", () => {
    for (const scheme of colorSchemes) for (const surface of surfaces(scheme)) {
      const palette = chartSeriesPalette(scheme), legible = chartSchemeSeries(undefined, scheme);
      const placed = chartPaletteForFill(surface, palette, { legible, soften: true });
      for (let count = 3; count <= placed.length; count++) {
        const slices = chartSlicePalette(surface, placed, count, { legible });
        const wrap = Math.abs(lightness(slices[0]) - lightness(slices[count - 1]));
        assert.ok(wrap >= CHART_SERIES_MIN_LIGHTNESS_STEP - 1e-9, `${scheme.id} on ${surface}, ${count} slices: first and last are ${wrap.toFixed(2)} L* apart`);
        for (let index = 1; index < count; index++) assert.ok(Math.abs(lightness(slices[index]) - lightness(slices[index - 1])) >= CHART_SERIES_MIN_LIGHTNESS_STEP - 1e-9, `${scheme.id} on ${surface}, ${count} slices: slices ${index}/${index + 1}`);
        // Only the last slice moves; every other color is the palette's.
        slices.forEach((color, index) => { if (index !== count - 1) assert.equal(color, placed[index]); });
      }
    }
  });

  test("a color already clear of the first, an authored color, fewer than three slices and a repeating palette stay as they are", () => {
    const placed = chartPaletteForFill("#FFFFFF", chartSeriesPalette({}), { legible: chartSchemeSeries(undefined, {}), soften: true });
    const legible = chartSchemeSeries(undefined, {});
    assert.deepEqual(chartSlicePalette("#FFFFFF", placed, 2, { legible }), placed);
    assert.deepEqual(chartSlicePalette("#FFFFFF", placed, 13, { legible }), placed);
    const close = ["#2874A6", "#B9770E", "#2975A7"];
    assert.deepEqual(chartSlicePalette("#FFFFFF", close, 3, { legible: [true, true, false] }), close, "an authored last slice is never moved");
    assert.notEqual(chartSlicePalette("#FFFFFF", close, 3, { legible: [true, true, true] })[2], close[2], "a scheme slice that reads as the first is");
    assert.deepEqual(chartSlicePalette("#FFFFFF", close, 3), close, "a host palette (no legible list) is untouched");
  });

  test("opf/chart-color-only finds no wrap pair on a pie of any size in any gallery scheme", () => {
    for (const scheme of colorSchemes) for (const count of [3, 4, 5, 6, 7, 8, 10, 12]) {
      const rows = Array.from({ length: count }, (_, index) => [`Slice ${index + 1}`, 100 - index * 5]);
      for (const type of ["pie", "doughnut"]) {
        const document = { name: "Pie", language: "en-US", design: { background: scheme.light1, colorScheme: scheme }, slides: [{ title: "T", chart: { type, data: { columns: ["Slice", "Share"], rows } } }] };
        const lightnessPairs = validate(document, { only: ["chart-color-only"] }).findings.filter((finding) => /lightness/.test(finding.message));
        assert.deepEqual(lightnessPairs.map((finding) => finding.message), [], `${scheme.id} ${type} of ${count}`);
      }
    }
  });
});
