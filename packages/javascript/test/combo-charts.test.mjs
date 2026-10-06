// FA-15: combo charts (clustered columns with line series, optionally on a secondary value axis).
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { chartOptionSupport, chartOptionTarget, resolveChartData, resolveChartOptions, validatePresentation } from "../dist/index.js";
import { resolveChartData as fromComposition } from "../dist/composition.js";
import { chartTypes } from "../dist/catalogs.js";

const columns = ["Quarter", { name: "Revenue", format: "$#,##0.0" }, "Cost", { name: "Margin", format: "0%" }];
const rows = [["Q1", 12.4, 8.1, 0.31], ["Q2", 18.1, 11.9, 0.34]];
const combo = (extra = {}) => ({ type: "combo", data: { columns, rows }, ...extra });
const deck = (chart) => ({ slides: [{ title: "Revenue and margin", chart }] });
const codes = (diagnostics) => diagnostics.map((entry) => `${entry.code} ${entry.path}`);

describe("combo chart type", () => {
  test("the catalog record is a mixed bar and line composition", () => {
    const record = chartTypes.find((entry) => entry.id === "combo");
    assert.ok(record, "combo is a bundled chart type");
    assert.equal(record.mappings.openxml.composition, "mixed");
    assert.deepEqual(record.mappings.openxml.series.map((entry) => entry.element), ["barChart", "lineChart"]);
    assert.equal(record.series, 2);
    assert.equal(chartOptionTarget("combo")?.kind, "combo");
  });

  test("support: category, value and secondary axis titles, a legend, column and line label positions", () => {
    const support = chartOptionSupport({ kind: "combo" });
    assert.deepEqual(support.axisTitles, { category: true, value: true, secondary: true });
    assert.equal(support.legend, true);
    assert.deepEqual(support.dataLabels.content, ["category", "value"]);
    assert.deepEqual(support.dataLabels.positions, ["center", "inside-end", "inside-base", "outside-end", "above", "below", "left", "right"]);
  });
});

describe("combo plan (resolveChartData)", () => {
  test("default: the last series is the line, on the primary axis", () => {
    const resolved = resolveChartData(combo());
    assert.deepEqual(resolved.columns, ["Quarter", "Revenue", "Cost", "Margin"]);
    assert.deepEqual(resolved.combo, [{ role: "bar", axis: "primary" }, { role: "bar", axis: "primary" }, { role: "line", axis: "primary" }]);
    assert.deepEqual(resolved.diagnostics, []);
    assert.equal(fromComposition, resolveChartData);
  });

  test("line and secondaryAxis pick the series; column series come first, then lines, with their formats", () => {
    const resolved = resolveChartData(combo({ line: ["Revenue"], secondaryAxis: ["Revenue"] }));
    assert.deepEqual(resolved.columns, ["Quarter", "Cost", "Margin", "Revenue"]);
    assert.deepEqual(resolved.formats, [undefined, undefined, "0%", "$#,##0.0"]);
    assert.deepEqual(resolved.rows[0], ["Q1", 8.1, 0.31, 12.4]);
    assert.deepEqual(resolved.combo, [{ role: "bar", axis: "primary" }, { role: "bar", axis: "primary" }, { role: "line", axis: "secondary" }]);
  });

  test("two lines, one on each axis", () => {
    const resolved = resolveChartData(combo({ line: ["Margin", "Cost"], secondaryAxis: ["Margin"] }));
    assert.deepEqual(resolved.columns, ["Quarter", "Revenue", "Cost", "Margin"]);
    assert.deepEqual(resolved.combo.map((entry) => `${entry.role}/${entry.axis}`), ["bar/primary", "line/primary", "line/secondary"]);
  });

  test("a primary-axis line comes before a secondary-axis line, whatever the data order", () => {
    const resolved = resolveChartData(combo({ line: ["Cost", "Margin"], secondaryAxis: ["Cost"] }));
    assert.deepEqual(resolved.columns, ["Quarter", "Revenue", "Margin", "Cost"]);
    assert.deepEqual(resolved.combo.map((entry) => `${entry.role}/${entry.axis}`), ["bar/primary", "line/primary", "line/secondary"]);
  });

  test("the mapping picks the plotted series first", () => {
    const resolved = resolveChartData(combo({ mapping: { series: ["Margin", "Revenue"] }, line: ["Margin"] }));
    assert.deepEqual(resolved.columns, ["Quarter", "Revenue", "Margin"]);
    assert.deepEqual(resolved.combo.map((entry) => entry.role), ["bar", "line"]);
  });

  test("unknown names are errors; names that cannot apply are adapted with a warning", () => {
    const unknown = resolveChartData(combo({ line: ["Profit"], secondaryAxis: ["Loss"] }), undefined, { path: "/slides/0/chart" });
    assert.deepEqual(codes(unknown.diagnostics), ["chart-mapping-unknown-column /slides/0/chart/line/0", "chart-mapping-unknown-column /slides/0/chart/secondaryAxis/0"]);
    assert.equal(unknown.diagnostics[0].severity, "error");
    // An explicit line list that names nothing usable leaves every series a column.
    assert.deepEqual(unknown.combo.map((entry) => entry.role), ["bar", "bar", "bar"]);

    const notLine = resolveChartData(combo({ line: ["Margin"], secondaryAxis: ["Revenue"] }));
    assert.deepEqual(codes(notLine.diagnostics), ["chart-mapping-adapted /secondaryAxis/0"]);
    assert.equal(notLine.combo[0].axis, "primary");

    const notPlotted = resolveChartData(combo({ mapping: { series: ["Revenue", "Cost"] }, line: ["Margin"] }));
    assert.deepEqual(codes(notPlotted.diagnostics), ["chart-mapping-adapted /line/0"]);
    assert.match(notPlotted.diagnostics[0].message, /not a plotted series/);
  });

  test("at least one column series: a line list naming every series keeps the first as columns", () => {
    const resolved = resolveChartData(combo({ line: ["Revenue", "Cost", "Margin"] }));
    assert.deepEqual(resolved.combo.map((entry) => entry.role), ["bar", "line", "line"]);
    assert.deepEqual(codes(resolved.diagnostics), ["chart-mapping-adapted /line"]);
  });

  test("one series is drawn as columns with a warning", () => {
    const resolved = resolveChartData({ type: "combo", data: { columns: ["Quarter", "Revenue"], rows: [["Q1", 1]] } });
    assert.deepEqual(resolved.combo, [{ role: "bar", axis: "primary" }]);
    assert.deepEqual(codes(resolved.diagnostics), ["chart-mapping-adapted /type"]);
  });

  test("a dataset-backed combo chart resolves the same plan", () => {
    const document = { datasets: { quarters: { columns, rows } }, slides: [] };
    const resolved = resolveChartData({ type: "combo", data: { dataset: "quarters" }, secondaryAxis: ["Margin"] }, document);
    assert.deepEqual(resolved.combo.map((entry) => `${entry.role}/${entry.axis}`), ["bar/primary", "bar/primary", "line/secondary"]);
  });

  test("other chart types carry no plan", () => {
    assert.equal(resolveChartData({ ...combo({ line: ["Margin"] }), type: "column" }).combo, undefined);
  });
});

describe("combo options (resolveChartOptions)", () => {
  test("the secondary axis title needs a secondary axis", () => {
    const titled = resolveChartOptions(combo({ secondaryAxis: ["Margin"], axisTitles: { value: "Revenue ($M)", secondary: "Margin" } }), chartOptionTarget("combo"));
    assert.deepEqual(titled.axisTitles, { value: "Revenue ($M)", secondary: "Margin" });
    assert.equal(titled.active, true);
    const untitled = resolveChartOptions(combo({ axisTitles: { secondary: "Margin" } }), chartOptionTarget("combo"));
    assert.deepEqual(untitled.axisTitles, {});
    assert.deepEqual(untitled.diagnostics.map((entry) => entry.option), ["axisTitles.secondary"]);
  });

  test("labels: columns default to outside-end and lines to above; a one-part position applies to that part", () => {
    assert.deepEqual(resolveChartOptions(combo({ dataLabels: true }), chartOptionTarget("combo")).dataLabels, { content: ["value"], position: "outside-end", separator: ", ", linePosition: "above" });
    const center = resolveChartOptions(combo({ dataLabels: { position: "center" } }), chartOptionTarget("combo"));
    assert.equal(center.dataLabels.position, "center");
    assert.equal(center.dataLabels.linePosition, "center");
    assert.deepEqual(center.diagnostics, []);
    const below = resolveChartOptions(combo({ dataLabels: { position: "below" } }), chartOptionTarget("combo"));
    assert.equal(below.dataLabels.position, "outside-end");
    assert.equal(below.dataLabels.linePosition, "below");
    assert.deepEqual(below.diagnostics.map((entry) => entry.option), ["dataLabels.position"]);
    const insideEnd = resolveChartOptions(combo({ dataLabels: { position: "inside-end" } }), chartOptionTarget("combo"));
    assert.equal(insideEnd.dataLabels.position, "inside-end");
    assert.equal(insideEnd.dataLabels.linePosition, "above");
  });

  test("line, secondaryAxis and the secondary title are adapted on other chart types", () => {
    const resolved = resolveChartOptions({ ...combo({ line: ["Margin"], secondaryAxis: ["Margin"], axisTitles: { secondary: "Margin" } }), type: "line" }, chartOptionTarget("line"));
    assert.deepEqual(resolved.diagnostics.map((entry) => entry.option), ["line", "secondaryAxis", "axisTitles.secondary"]);
    assert.equal(resolved.active, false);
  });
});

describe("combo validation", () => {
  test("a valid combo chart validates without issues", () => {
    const result = validatePresentation(deck(combo({ line: ["Margin"], secondaryAxis: ["Margin"], axisTitles: { category: "Quarter", value: "Revenue ($M)", secondary: "Margin" }, legend: "bottom" })));
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    assert.deepEqual(result.warnings, []);
  });

  test("an unknown series name is an error; line on another type is a warning", () => {
    const unknown = validatePresentation(deck(combo({ line: ["Profit"] })));
    assert.equal(unknown.valid, false);
    assert.deepEqual(unknown.errors.map((entry) => entry.path), ["/slides/0/chart/line/0"]);
    const other = validatePresentation(deck({ ...combo({ line: ["Margin"] }), type: "column" }));
    assert.equal(other.valid, true);
    assert.deepEqual(other.warnings.map((entry) => `${entry.params.code} ${entry.path}`), ["chart-option-adapted /slides/0/chart/line"]);
  });

  test("the schema rejects an empty or repeated list", () => {
    assert.equal(validatePresentation(deck(combo({ line: [] }))).valid, false);
    assert.equal(validatePresentation(deck(combo({ secondaryAxis: ["Margin", "Margin"] }))).valid, false);
  });
});
