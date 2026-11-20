// LH-153, LH-154, LH-94 in core: thousands grouping for the chartex constructs, combo and scatter axes (the data rule `groupsDataRange` and the
// waterfall label text); a horizontal stacked bar chart's axis titles get their own bands, so no title overlaps the tick labels or the row
// names; every series from the scheme stands 11 L* from the series before it in every gallery color scheme.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { composeSlide, groupsDataRange, waterfallLabelText, waterfallRoles, chartPaletteForFill, chartSeriesPalette, chartSchemeSeries, CHART_SERIES_MIN_LIGHTNESS_STEP } from "../dist/composition.js";
import { colorSchemes } from "./support/catalog.mjs";

const compose = (slide, options = {}) => composeSlide(slide, { width: 1280, height: 720, ...options });
const chartOf = (slide, options) => compose(slide, options).items.find((item) => item.field === "chart");

describe("LH-153: thousands grouping decided from the data", () => {
  test("groupsDataRange groups whole numbers of four digits over a span of 100 or more", () => {
    assert.equal(groupsDataRange([12400, 15050], { zeroBased: true }), true);
    assert.equal(groupsDataRange([5000, 41000, null]), true);
    assert.equal(groupsDataRange([120, 999], { zeroBased: true }), false, "three digits");
    assert.equal(groupsDataRange([1240.5, 3000], { zeroBased: true }), false, "a fraction keeps the General form");
    assert.equal(groupsDataRange([1000, 1040]), false, "a span under 100 may have ticks that are not whole numbers");
    assert.equal(groupsDataRange([1000, 1040], { zeroBased: true }), true, "a zero-based axis spans from zero");
    assert.equal(groupsDataRange([]), false);
  });

  test("a column of years never groups on a scatter X axis (a span of 1000)", () => {
    const years = [1900, 1950, 2000, 2020];
    assert.equal(groupsDataRange(years, { minRange: 1000 }), false);
    assert.equal(groupsDataRange([1990, 1995, 2000, 2020], { minRange: 1000 }), false);
    assert.equal(groupsDataRange([5000, 12000, 41000], { minRange: 1000 }), true);
  });

  test("a waterfall's labels group by the language, the sign stays outside the grouped number", () => {
    const group = { language: "en" };
    assert.equal(waterfallLabelText(3200, undefined, "increase", group), "+3,200");
    assert.equal(waterfallLabelText(-1450, undefined, "decrease", group), "−1,450");
    assert.equal(waterfallLabelText(15050, undefined, "total", group), "15,050");
    assert.equal(waterfallLabelText(15050, undefined, "total", { language: "de" }), "15.050");
    assert.equal(waterfallLabelText(3200, undefined, "increase"), "+3200", "without a group the General form stays");
    assert.equal(waterfallLabelText(3200, "0", "increase", group), "+3200", "an author's format is never regrouped");
  });

  test("a waterfall that groups keeps its labels when the grouped widest still fits", () => {
    const chart = { type: "waterfall", data: { columns: ["Step", "Revenue"], rows: [["2023", 12400], ["New", 3200], ["Churn", -1450], ["2024", 14150]] } };
    const layer = chartOf({ title: "Revenue grew", chart }).chart.layer;
    assert.deepEqual(layer.waterfall.roles, waterfallRoles([12400, 3200, -1450, 14150]));
    assert.equal(layer.waterfall.labels, true);
  });
});

describe("LH-154: axis titles of a horizontal stacked bar chart get their own bands", () => {
  const data = { columns: ["Region", "Self-service", "Chat", "Phone"], rows: [["North America", 5400, 2100, 90], ["Europe", 4600, 2300, 130], ["Asia Pacific", 3900, 2800, 110]] };
  const plotOf = (extra) => {
    const item = chartOf({ title: "Self-service carries most requests", chart: { type: "stacked-bar", data, ...extra } });
    return { item, plot: item.chart.layer.plot };
  };

  test("a value axis title takes a band under the tick row, a category axis title one at the start", () => {
    const value = plotOf({ axisTitles: { value: "Requests" } }).plot, category = plotOf({ axisTitles: { category: "Region" } }).plot, both = plotOf({ axisTitles: { value: "Requests", category: "Region" } }).plot;
    assert.ok(value && category && both, "the plots are pinned");
    assert.ok(value.bottom - category.bottom > 10, `the value title leaves a text line more under the plot (${value.bottom} vs ${category.bottom})`);
    assert.ok(category.left - value.left > 10, `the category title leaves a text line more before the plot (${category.left} vs ${value.left})`);
    assert.equal(both.bottom, value.bottom);
    assert.equal(both.left, category.left);
    assert.equal(both.top, value.top);
  });
});

describe("LH-94: neighboring series stand 11 L* apart in every gallery color scheme", () => {
  const lin = (c) => { const n = c / 255; return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4; };
  const lightness = (hex) => {
    const n = Number.parseInt(hex.slice(1, 7), 16), y = 0.2126729 * lin(n >> 16) + 0.7151522 * lin((n >> 8) & 255) + 0.072175 * lin(n & 255);
    return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y;
  };
  const surfaces = (scheme) => [scheme.light1, scheme.dark1, "#FFFFFF", "#F4F4F4", "#011842", "#000000"];

  test("every series of the twelve-color ramp, strong and softened, on light and dark surfaces", () => {
    assert.equal(CHART_SERIES_MIN_LIGHTNESS_STEP, 11);
    assert.ok(colorSchemes.length >= 14);
    for (const scheme of colorSchemes) for (const surface of surfaces(scheme)) {
      const palette = chartSeriesPalette(scheme), legible = chartSchemeSeries(undefined, scheme);
      for (const soften of [false, true]) {
        const placed = chartPaletteForFill(surface, palette, { legible, soften });
        for (let index = 1; index < placed.length; index++) {
          const step = Math.abs(lightness(placed[index]) - lightness(placed[index - 1]));
          assert.ok(step >= CHART_SERIES_MIN_LIGHTNESS_STEP - 1e-9, `${scheme.id} on ${surface}${soften ? " (soft)" : ""}: series ${index}/${index + 1} are ${step.toFixed(2)} L* apart`);
        }
      }
    }
  });

  test("an authored pair is never moved: opf/chart-color-only still reports it", () => {
    const authored = chartSeriesPalette({}, ["#2874A6", "#2975A7"]);
    const placed = chartPaletteForFill("#FFFFFF", authored, { legible: chartSchemeSeries(["#2874A6", "#2975A7"], {}) });
    assert.equal(placed[0], "#2874A6");
    assert.equal(placed[1], "#2975A7");
    assert.deepEqual(chartPaletteForFill("#FFFFFF", ["#2874A6", "#2975A7"]), ["#2874A6", "#2975A7"], "a host palette (no legible list) is untouched");
  });

  test("a scheme whose accents were already apart keeps its colors", () => {
    const palette = ["#1F618D", "#B9770E", "#145A32"], placed = chartPaletteForFill("#FFFFFF", palette, { legible: [true, true, true] });
    assert.deepEqual(placed, palette);
  });
});
