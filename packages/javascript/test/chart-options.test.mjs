import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { chartLabelText, chartOptionSupport, chartOptionTarget, formatChartLabelNumber, formatChartLabelPercent, resolveChartOptions } from "../dist/composition.js";
import { resolveChartOptions as fromComposition } from "../dist/composition.js";
import { chartTypes } from "./support/catalog.mjs";
import { check, errorsOf } from './support/validation.mjs';

const adapted = (document) => check(document, { only: ['opf/chart-option-adapted'] });

const data = { columns: ["Quarter", "A", "B"], rows: [["Q1", 1, 2], ["Q2", 3, 4]] };
const deck = (chart) => ({ slides: [{ title: "Chart", chart: { type: "column", data, ...chart } }] });

describe("chart option targets", () => {
  test("every bundled chart type id resolves to a target or is outside the catalog", () => {
    for (const record of chartTypes) {
      const target = chartOptionTarget(record.id);
      assert.ok(target === undefined || typeof target.kind === "string", record.id);
    }
    assert.equal(chartOptionTarget("column")?.kind, "bar");
    assert.equal(chartOptionTarget("stacked-bar")?.stacked, true);
    assert.equal(chartOptionTarget("donut")?.kind, "doughnut");
    assert.equal(chartOptionTarget("pareto")?.kind, "pareto");
    assert.equal(chartOptionTarget("not-a-chart"), undefined);
    assert.equal(chartOptionTarget(undefined), undefined);
  });

  test("a kept id for every previewable type is covered", () => {
    for (const id of ["column", "bar", "line", "area", "pie", "doughnut", "scatter", "radar", "treemap", "histogram", "pareto", "box-and-whisker", "waterfall", "funnel", "world"]) {
      assert.ok(chartOptionTarget(id), id);
    }
  });
});

describe("chart option support table", () => {
  test("axis titles exist only where the construct has the axis", () => {
    assert.deepEqual(chartOptionSupport({ kind: "bar" }).axisTitles, { category: true, value: true, secondary: false });
    assert.deepEqual(chartOptionSupport({ kind: "funnel" }).axisTitles, { category: true, value: false, secondary: false });
    for (const kind of ["pie", "doughnut", "radar", "treemap", "map"]) assert.deepEqual(chartOptionSupport({ kind }).axisTitles, { category: false, value: false, secondary: false }, kind);
    assert.deepEqual(chartOptionSupport({ kind: "combo" }).axisTitles, { category: true, value: true, secondary: true });
  });

  test("label positions follow the OOXML position sets", () => {
    assert.deepEqual(chartOptionSupport({ kind: "bar" }).dataLabels.positions, ["center", "inside-end", "inside-base", "outside-end"]);
    assert.deepEqual(chartOptionSupport({ kind: "bar", stacked: true }).dataLabels.positions, ["center", "inside-end", "inside-base"]);
    assert.equal(chartOptionSupport({ kind: "bar", stacked: true }).dataLabels.defaultPosition, "center");
    assert.deepEqual(chartOptionSupport({ kind: "line" }).dataLabels.positions, ["above", "below", "left", "right", "center"]);
    assert.deepEqual(chartOptionSupport({ kind: "pie" }).dataLabels.positions, ["center", "inside-end", "outside-end"]);
    for (const kind of ["area", "doughnut", "radar", "treemap", "funnel"]) assert.deepEqual(chartOptionSupport({ kind }).dataLabels.positions, [], kind);
    assert.equal(chartOptionSupport({ kind: "map" }).dataLabels.supported, false);
    assert.equal(chartOptionSupport({ kind: "box" }).dataLabels.supported, false);
  });

  test("percent labels exist only on pie and doughnut charts", () => {
    for (const kind of ["pie", "doughnut"]) assert.ok(chartOptionSupport({ kind }).dataLabels.content.includes("percent"), kind);
    for (const kind of ["bar", "line", "area", "scatter", "radar", "waterfall", "funnel", "histogram", "treemap"]) assert.ok(!chartOptionSupport({ kind }).dataLabels.content.includes("percent"), kind);
  });
});

describe("resolveChartOptions", () => {
  test("a chart with no option fields is inactive and adapts nothing", () => {
    const resolved = resolveChartOptions({ type: "column", data }, chartOptionTarget("column"));
    assert.deepEqual(resolved, { active: false, axisTitles: {}, diagnostics: [] });
    assert.deepEqual(resolveChartOptions(undefined), { active: false, axisTitles: {}, diagnostics: [] });
    assert.equal(fromComposition, resolveChartOptions, "the composition entry exports the same function");
  });

  test("dataLabels: true shows values at the type default position; false and absent show none", () => {
    const column = resolveChartOptions({ dataLabels: true }, chartOptionTarget("column"));
    assert.deepEqual(column.dataLabels, { content: ["value"], position: "outside-end", separator: ", " });
    assert.equal(resolveChartOptions({ dataLabels: true }, chartOptionTarget("stacked-column")).dataLabels.position, "center");
    assert.equal(resolveChartOptions({ dataLabels: true }, chartOptionTarget("line")).dataLabels.position, "above");
    assert.equal(resolveChartOptions({ dataLabels: true }, chartOptionTarget("area")).dataLabels.position, null);
    assert.equal(resolveChartOptions({ dataLabels: false }, chartOptionTarget("column")).dataLabels, undefined);
    assert.equal(resolveChartOptions({ dataLabels: false }, chartOptionTarget("column")).active, false);
  });

  test("content keeps the canonical order, drops what the type cannot show and never ends empty", () => {
    const pie = resolveChartOptions({ dataLabels: { content: ["percent", "category"], position: "center", separator: "; " } }, chartOptionTarget("pie"));
    assert.deepEqual(pie.dataLabels, { content: ["category", "percent"], position: "center", separator: "; " });
    const bar = resolveChartOptions({ dataLabels: { content: ["percent", "category"] } }, chartOptionTarget("bar"));
    assert.deepEqual(bar.dataLabels.content, ["category"]);
    assert.equal(bar.diagnostics.length, 1);
    assert.equal(bar.diagnostics[0].option, "dataLabels.content");
    assert.equal(bar.diagnostics[0].code, "chart-option-adapted");
    const only = resolveChartOptions({ dataLabels: { content: ["percent"] } }, chartOptionTarget("bar"));
    assert.deepEqual(only.dataLabels.content, ["value"], "a label never ends up with no content");
  });

  test("dataLabels: false removes the labels a construct draws by default, and only those", () => {
    for (const id of ["funnel", "treemap"]) {
      const resolved = resolveChartOptions({ dataLabels: false }, chartOptionTarget(id));
      assert.equal(resolved.dataLabelsOff, true, id);
      assert.equal(resolved.active, true, id);
      assert.equal(resolved.dataLabels, undefined, id);
      assert.equal(chartOptionSupport(chartOptionTarget(id)).dataLabels.defaultOn, true, id);
    }
    for (const id of ["column", "pie", "waterfall", "line"]) assert.equal(resolveChartOptions({ dataLabels: false }, chartOptionTarget(id)).dataLabelsOff, undefined, id);
    assert.equal(resolveChartOptions({ dataLabels: true }, chartOptionTarget("funnel")).dataLabelsOff, undefined);
  });

  test("an unsupported position falls back to the default and is reported", () => {
    const stacked = resolveChartOptions({ dataLabels: { position: "outside-end" } }, chartOptionTarget("stacked-column"));
    assert.equal(stacked.dataLabels.position, "center");
    assert.deepEqual(stacked.diagnostics.map((d) => [d.option, d.reason]), [["dataLabels.position", "unsupported-position"]]);
    const line = resolveChartOptions({ dataLabels: { position: "inside-base" } }, chartOptionTarget("line"));
    assert.equal(line.dataLabels.position, "above");
    const ok = resolveChartOptions({ dataLabels: { position: "below" } }, chartOptionTarget("line"));
    assert.equal(ok.dataLabels.position, "below");
    assert.deepEqual(ok.diagnostics, []);
    const doughnut = resolveChartOptions({ dataLabels: { position: "center" } }, chartOptionTarget("doughnut"));
    assert.equal(doughnut.dataLabels.position, null);
    assert.equal(doughnut.diagnostics.length, 1);
  });

  test("a construct without the feature drops the option and reports it", () => {
    const pie = resolveChartOptions({ axisTitles: { category: "Region", value: "Revenue" }, legend: "bottom" }, chartOptionTarget("pie"));
    assert.deepEqual(pie.axisTitles, {});
    assert.equal(pie.legend, "bottom");
    assert.deepEqual(pie.diagnostics.map((d) => d.option), ["axisTitles.category", "axisTitles.value"]);
    assert.equal(pie.active, true, "the legend still applies");
    const map = resolveChartOptions({ dataLabels: true, legend: "left" }, chartOptionTarget("world"));
    assert.equal(map.active, false);
    assert.deepEqual(map.diagnostics.map((d) => d.option), ["legend", "dataLabels"]);
    const funnel = resolveChartOptions({ axisTitles: { category: "Stage", value: "Count" } }, chartOptionTarget("funnel"));
    assert.deepEqual(funnel.axisTitles, { category: "Stage" });
    assert.deepEqual(funnel.diagnostics.map((d) => d.option), ["axisTitles.value"]);
  });

  test("a separator never carries a line break", () => {
    const resolved = resolveChartOptions({ dataLabels: { content: ["category", "value"], separator: "\n" } }, chartOptionTarget("column"));
    assert.equal(resolved.dataLabels.separator, " ");
    assert.deepEqual(resolved.diagnostics.map((d) => d.option), ["dataLabels.separator"]);
  });

  test("axis titles are trimmed and empty titles are ignored without a diagnostic", () => {
    const resolved = resolveChartOptions({ axisTitles: { category: "  Quarter ", value: "   " } }, chartOptionTarget("column"));
    assert.deepEqual(resolved.axisTitles, { category: "Quarter" });
    assert.deepEqual(resolved.diagnostics, []);
  });

  test("a chart type outside the catalog is never adapted", () => {
    const resolved = resolveChartOptions({ legend: "top", dataLabels: { content: ["percent"], position: "above" }, axisTitles: { value: "v" } }, undefined);
    assert.equal(resolved.legend, "top");
    assert.equal(resolved.dataLabels.position, "above");
    assert.deepEqual(resolved.diagnostics, []);
  });

  test("label text helpers", () => {
    assert.equal(formatChartLabelNumber(12.5), "12.5");
    assert.equal(formatChartLabelNumber(0.1 + 0.2), "0.3");
    assert.equal(formatChartLabelPercent(0.285), "29%");
    assert.equal(formatChartLabelPercent(1 / 3), "33%");
    assert.equal(chartLabelText({ category: "Q1", value: "10", percent: "40%" }, ["percent", "category", "value"], "; "), "Q1; 10; 40%");
    assert.equal(chartLabelText({ category: "Q1", value: "10" }, ["value"]), "10");
  });
});

describe("schema and validator", () => {
  test("the three fields are valid on a chart", () => {
    const result = check(deck({
      axisTitles: { category: "Quarter", value: "Revenue ($M)" },
      legend: "bottom",
      dataLabels: { content: ["category", "value"], position: "outside-end", separator: "; " },
    }));
    assert.equal(result.valid, true, JSON.stringify(errorsOf(result)));
    assert.deepEqual(adapted(deck({
      axisTitles: { category: "Quarter", value: "Revenue ($M)" },
      legend: "bottom",
      dataLabels: { content: ["category", "value"], position: "outside-end", separator: "; " },
    })).findings, []);
    assert.equal(check(deck({ dataLabels: true })).valid, true);
    assert.equal(check(deck({ dataLabels: false })).valid, true);
    assert.equal(check(deck({ legend: "none" })).valid, true);
  });

  test("invalid values are schema errors", () => {
    assert.equal(check(deck({ legend: "middle" })).valid, false);
    assert.equal(check(deck({ axisTitles: { category: 3 } })).valid, false);
    assert.equal(check(deck({ axisTitles: { x: "a" } })).valid, false);
    assert.equal(check(deck({ dataLabels: { position: "sideways" } })).valid, false);
    assert.equal(check(deck({ dataLabels: { content: [] } })).valid, false);
    assert.equal(check(deck({ dataLabels: { content: ["value", "value"] } })).valid, false);
    assert.equal(check(deck({ dataLabels: { show: true } })).valid, false);
  });

  test("an option the chart type cannot show is a warning naming the option path", () => {
    const result = check({ slides: [{ title: "Pie", chart: { type: "pie", data, axisTitles: { value: "Revenue" }, dataLabels: { position: "above" } } }] });
    assert.equal(result.valid, true);
    const found = adapted({ slides: [{ title: "Pie", chart: { type: "pie", data, axisTitles: { value: "Revenue" }, dataLabels: { position: "above" } } }] });
    const paths = found.findings.map((warning) => warning.path);
    assert.ok(paths.includes("/slides/0/chart/axisTitles/value"), paths.join());
    assert.ok(paths.includes("/slides/0/chart/dataLabels/position"), paths.join());
    assert.ok(found.findings.every((warning) => warning.ruleId === "opf/chart-option-adapted" && warning.severity === "warning" && warning.category === "layout"));
  });

  test("the warning also covers a chart inside a block", () => {
    const result = check({ slides: [{ title: "Blocks", blocks: [{ chart: { type: "radar", data, dataLabels: { position: "above" } } }, { text: "x" }] }] });
    assert.equal(result.valid, true, JSON.stringify(errorsOf(result)));
    const found = adapted({ slides: [{ title: "Blocks", blocks: [{ chart: { type: "radar", data, dataLabels: { position: "above" } } }, { text: "x" }] }] });
    assert.ok(found.findings.some((warning) => warning.path === "/slides/0/blocks/0/chart/dataLabels/position"), JSON.stringify(found.findings));
  });

  test("a deck without the fields validates with the same warnings as before", () => {
    assert.deepEqual(adapted(deck({})).findings, []);
  });
});
