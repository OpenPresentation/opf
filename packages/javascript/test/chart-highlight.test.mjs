// FA-14: chart.highlight. Schema, validation, the per-type support table, the resolution both engines share and the two colours.
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  chartHighlightColors,
  chartHighlightMarks,
  chartOptionSupport,
  chartOptionTarget,
  colorContrast,
  resolveChartData,
  resolveChartOptions,
  textColorForFill,
  validatePresentation,
} from "../dist/index.js";
import * as composition from "../dist/composition.js";

const data = { columns: ["Quarter", "Revenue", "Costs"], rows: [["Q1", 12, 8], ["Q2", 18, 11], ["Q3", 24, 15], ["Q3", 25, 16]] };
const chart = (type, extra = {}) => ({ type, data, ...extra });
const deck = (extra, type = "column") => ({ slides: [{ title: "Chart", chart: chart(type, extra) }] });
const options = (type, extra) => resolveChartOptions(chart(type, extra), chartOptionTarget(type));

describe("support table", () => {
  test("series and category highlights per chart construct", () => {
    const support = (kind, stacked) => chartOptionSupport({ kind, stacked }).highlight;
    assert.deepEqual(support("bar"), { series: true, categories: true });
    assert.deepEqual(support("bar", true), { series: true, categories: true });
    assert.deepEqual(support("line"), { series: true, categories: true });
    assert.deepEqual(support("area"), { series: true, categories: false });
    assert.deepEqual(support("scatter"), { series: true, categories: false });
    assert.deepEqual(support("radar"), { series: true, categories: false });
    assert.deepEqual(support("pie"), { series: false, categories: true });
    assert.deepEqual(support("doughnut"), { series: false, categories: true });
    for (const kind of ["histogram", "pareto", "waterfall", "funnel", "treemap", "box", "map"]) assert.deepEqual(support(kind), { series: false, categories: false }, kind);
  });
});

describe("resolveChartOptions highlight", () => {
  test("no highlight is no result and leaves active alone", () => {
    const resolved = options("column", {});
    assert.equal(resolved.highlight, undefined);
    assert.equal(resolved.active, false);
    assert.deepEqual(resolved.diagnostics, []);
  });

  test("a supported highlight keeps its names, deduplicated, and never makes the options active", () => {
    const resolved = options("column", { highlight: { series: ["Revenue", "Revenue"], categories: ["Q3"] } });
    assert.deepEqual(resolved.highlight, { series: ["Revenue"], categories: ["Q3"] });
    assert.equal(resolved.active, false, "a highlight changes colours, never geometry");
    assert.deepEqual(resolved.diagnostics, []);
  });

  test("a part the type cannot highlight is dropped with a chart-option-adapted diagnostic", () => {
    const area = options("area", { highlight: { series: ["Revenue"], categories: ["Q3"] } });
    assert.deepEqual(area.highlight, { series: ["Revenue"], categories: [] });
    assert.deepEqual(area.diagnostics.map((d) => [d.code, d.option, d.reason]), [["chart-option-adapted", "highlight.categories", "unsupported-type"]]);
    const pie = options("pie", { highlight: { series: ["Revenue"], categories: ["Q3"] } });
    assert.deepEqual(pie.highlight, { series: [], categories: ["Q3"] });
    assert.equal(pie.diagnostics[0].option, "highlight.series");
    for (const type of ["waterfall", "funnel", "treemap", "histogram", "pareto", "box-and-whisker", "world"]) {
      const resolved = options(type, { highlight: { series: ["Revenue"] } });
      assert.equal(resolved.highlight, undefined, type);
      assert.deepEqual(resolved.diagnostics.map((d) => d.option), ["highlight.series"], type);
    }
  });

  test("a chart type outside the catalog is never adapted", () => {
    const resolved = resolveChartOptions(chart("not-a-chart", { highlight: { series: ["Revenue"] } }), undefined);
    assert.deepEqual(resolved.highlight, { series: ["Revenue"], categories: [] });
    assert.deepEqual(resolved.diagnostics, []);
  });

  test("is on the composition entry too", () => {
    assert.equal(composition.chartHighlightMarks, chartHighlightMarks);
    assert.equal(composition.chartHighlightColors, chartHighlightColors);
  });
});

describe("chartHighlightMarks", () => {
  const resolved = resolveChartData(chart("column"));

  test("a mark is highlighted when its series OR its category is named, and a label shared by rows marks each", () => {
    assert.equal(resolved.ok, true);
    const marks = chartHighlightMarks({ series: ["Costs"], categories: ["Q3"] }, resolved);
    assert.deepEqual(marks.series, [false, true]);
    assert.deepEqual(marks.categories, [false, false, true, true]);
  });

  test("series only and categories only", () => {
    assert.deepEqual(chartHighlightMarks({ series: ["Revenue"], categories: [] }, resolved), { series: [true, false], categories: [false, false, false, false] });
    assert.deepEqual(chartHighlightMarks({ series: [], categories: ["Q1"] }, resolved), { series: [false, false], categories: [true, false, false, false] });
  });

  test("a highlight that names nothing the chart plots is no highlight", () => {
    assert.equal(chartHighlightMarks(undefined, resolved), undefined);
    assert.equal(chartHighlightMarks({ series: ["Quarter"], categories: [] }, resolved), undefined);
    assert.equal(chartHighlightMarks({ series: ["Nope"], categories: ["Q9"] }, resolved), undefined);
  });

  test("series follow the scatter X column and a mapping", () => {
    const scatter = resolveChartData({ type: "scatter", data: { columns: ["Label", "Spend", "Revenue"], rows: [["A", 1, 2], ["B", 2, 3]] } });
    assert.deepEqual(chartHighlightMarks({ series: ["Revenue"], categories: [] }, scatter).series, [true]);
    assert.equal(chartHighlightMarks({ series: ["Spend"], categories: [] }, scatter), undefined, "the X column is not a series");
    const mapped = resolveChartData(chart("column", { mapping: { series: ["Costs", "Revenue"] } }));
    assert.deepEqual(chartHighlightMarks({ series: ["Revenue"], categories: [] }, mapped).series, [false, true]);
  });

  test("number labels match as text and an empty label matches the empty string", () => {
    const years = resolveChartData(chart("column", { data: { columns: ["Year", "V"], rows: [[2023, 1], [2024, 2], [null, 3]] } }));
    assert.deepEqual(chartHighlightMarks({ series: [], categories: ["2024", ""] }, years).categories, [false, true, true]);
  });
});

describe("validation", () => {
  test("a highlight is valid and silent on a type that supports it", () => {
    const result = validatePresentation(deck({ highlight: { series: ["Revenue"], categories: ["Q3"] } }));
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    assert.deepEqual(result.warnings, []);
    assert.equal(validatePresentation(deck({ highlight: { categories: ["Q1"] } }, "pie")).valid, true);
  });

  test("the schema rejects an empty or malformed highlight", () => {
    assert.equal(validatePresentation(deck({ highlight: {} })).valid, false);
    assert.equal(validatePresentation(deck({ highlight: { series: [] } })).valid, false);
    assert.equal(validatePresentation(deck({ highlight: { series: ["Revenue", "Revenue"] } })).valid, false);
    assert.equal(validatePresentation(deck({ highlight: { series: "Revenue" } })).valid, false);
    assert.equal(validatePresentation(deck({ highlight: { color: "#FF0000" } })).valid, false, "there is no color field");
    assert.equal(validatePresentation(deck({ highlight: { series: [3] } })).valid, false);
  });

  test("an unknown series or category is a chart-highlight-unknown-name error naming the path", () => {
    const result = validatePresentation(deck({ highlight: { series: ["Revenue", "Profit"], categories: ["Q1", "Q9"] } }));
    assert.equal(result.valid, false);
    const found = result.errors.filter((error) => error.params.code === "chart-highlight-unknown-name");
    assert.deepEqual(found.map((error) => error.path), ["/slides/0/chart/highlight/series/1", "/slides/0/chart/highlight/categories/1"]);
    assert.match(found[0].message, /"Profit"/);
    assert.match(found[1].message, /"Q9"/);
  });

  test("also inside a block and for a dataset-backed chart", () => {
    const blocks = validatePresentation({ slides: [{ title: "B", blocks: [{ chart: chart("column", { highlight: { series: ["Profit"] } }) }, { text: "x" }] }] });
    assert.deepEqual(blocks.errors.map((error) => error.path), ["/slides/0/blocks/0/chart/highlight/series/0"]);
    const dataset = validatePresentation({ datasets: { rev: data }, slides: [{ title: "D", chart: { type: "column", data: { dataset: "rev" }, highlight: { categories: ["Q2", "Q7"] } } }] });
    assert.deepEqual(dataset.errors.map((error) => error.path), ["/slides/0/chart/highlight/categories/1"]);
  });

  test("a column that is not plotted as a series is a chart-highlight-adapted warning", () => {
    const result = validatePresentation(deck({ highlight: { series: ["Quarter", "Costs"] }, mapping: { series: ["Revenue"] } }));
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    assert.deepEqual(result.warnings.map((warning) => [warning.params.code, warning.path]), [
      ["chart-highlight-adapted", "/slides/0/chart/highlight/series/0"],
      ["chart-highlight-adapted", "/slides/0/chart/highlight/series/1"],
    ]);
  });

  test("a part the chart type cannot highlight is a chart-option-adapted warning naming the option path", () => {
    const result = validatePresentation(deck({ highlight: { series: ["Revenue"] } }, "pie"));
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    assert.deepEqual(result.warnings.map((warning) => [warning.params.code, warning.path]), [["chart-option-adapted", "/slides/0/chart/highlight/series"]]);
  });

  test("a deck without a highlight validates exactly as before", () => {
    const result = validatePresentation(deck({}));
    assert.deepEqual(result.warnings, []);
    assert.equal(result.valid, true);
  });
});

describe("chartHighlightColors", () => {
  const cases = [
    ["light panel", "#F8FAFC", "#2874A6", "#1E293B"],
    ["white panel", "#FFFFFF", "#C0392B", "#111111"],
    ["dark panel", "#1E293B", "#7BDBB2", "#F8FAFC"],
    ["black panel", "#000000", "#2874A6", "#FFFFFF"],
    ["mid-tone panel", "#808080", "#2874A6", "#FFFFFF"],
  ];
  for (const [name, surface, primary, text] of cases) {
    test(`${name}: accent keeps 3:1, muted is a visible neutral between surface and text`, () => {
      const { accent, muted } = chartHighlightColors(surface, primary, text);
      assert.match(accent, /^#[0-9A-F]{6}$/);
      assert.match(muted, /^#[0-9A-F]{6}$/);
      assert.ok(colorContrast(accent, surface) >= 3, `accent ${accent}`);
      assert.ok(colorContrast(muted, surface) >= 1.6 - 1e-9, `muted ${muted} on ${surface}`);
      assert.ok(colorContrast(muted, surface) < colorContrast(text, surface), "muted is quieter than the text colour");
      assert.notEqual(accent, muted);
    });
  }

  test("a primary that already has 3:1 is the accent unchanged; the muted colour is the surface mixed 30% towards the text", () => {
    assert.deepEqual(chartHighlightColors("#FFFFFF", "#2874A6", "#000000"), { accent: "#2874A6", muted: "#B3B3B3" });
  });

  test("close surface and text still give a visible muted colour; unresolved colours fall back deterministically", () => {
    const { muted } = chartHighlightColors("#FFFFFF", "#2874A6", "#F0F0F0");
    assert.ok(muted === "#F0F0F0" || colorContrast(muted, "#FFFFFF") >= 1.6 - 1e-9);
    assert.deepEqual(chartHighlightColors("nope", "nope", "nope"), chartHighlightColors("#FFFFFF", "#000000", textColorForFill("#FFFFFF", "#000000")));
    assert.deepEqual(chartHighlightColors("#FFFFFF", "#2874A6", "#000000"), chartHighlightColors("#ffffff", "#2874a6", "#000"));
  });
});
