import assert from "node:assert/strict";
import { catalogs } from "@openpresentation/opf";
import { CHART_TYPES, resolveChartType } from "../dist/charts.js";

// The renderer carries its own chart table (catalog ids and their construct). It must agree
// with the installed core chart type catalog, so a catalog change fails here instead of drifting silently.
const catalog = catalogs.chartTypes;
assert.ok(Array.isArray(catalog) && catalog.length > 0, "core exposes catalogs.chartTypes");
const byId = new Map(catalog.map((record) => [record.id, record]));
const kept = catalog;
assert.deepEqual(catalog.filter((record) => record.deprecation), [], "the bundled catalog holds no deprecated record");

// Same id sets.
assert.deepEqual([...Object.keys(CHART_TYPES)].sort(), kept.map((record) => record.id).sort(), "kept ids match the catalog");

// Every kept id resolves to itself and its renderer construct matches the OOXML mapping.
const kindByElement = {
  barChart: "bar", lineChart: "line", areaChart: "area", pieChart: "pie", doughnutChart: "doughnut",
  scatterChart: "scatter", radarChart: "radar", treemapChart: "treemap", histogramChart: "histogram",
  boxWhiskerChart: "box", waterfallChart: "waterfall", funnelChart: "funnel", mapChart: "map"
};
const grouping = { standard: "standard", clustered: "clustered", stacked: "stacked", percentStacked: "percentStacked" };
for (const record of kept) {
  const id = record.id;
  const openxml = record.mappings?.openxml;
  const spec = CHART_TYPES[id];
  assert.equal(resolveChartType(id), id, `${id}: resolves to itself`);
  assert.ok(openxml?.element, `${id}: catalog carries mappings.openxml.element`);
  // Pareto is a chartex histogram with an owned cumulative line; the catalog says so through `extension`. A mixed composition
  // (combo, FA-15) is its own construct: clustered columns (its primary element) with line series.
  const expectedKind = id === "pareto" ? "pareto" : openxml.composition === "mixed" ? "combo" : kindByElement[openxml.element];
  assert.equal(spec.kind, expectedKind, `${id}: kind follows ${openxml.element}`);
  if (spec.kind === "combo") {
    assert.deepEqual(openxml.series.map((entry) => entry.element), ["barChart", "lineChart"], `${id}: a bar and a line chart`);
    assert.equal(spec.dir, openxml.barDir, `${id}: barDir`);
    assert.equal(spec.grouping, openxml.grouping, `${id}: grouping`);
    assert.equal(spec.markers, openxml.series[1].marker === true, `${id}: line markers`);
  } else if (spec.kind === "bar") {
    assert.equal(spec.dir, openxml.barDir, `${id}: barDir`);
    assert.equal(spec.grouping, grouping[openxml.grouping ?? "clustered"], `${id}: grouping`);
  } else if (spec.kind === "line") {
    assert.equal(spec.grouping, openxml.grouping ?? "standard", `${id}: grouping`);
    assert.equal(spec.markers, openxml.marker === true, `${id}: marker`);
  } else if (spec.kind === "area") {
    assert.equal(spec.grouping, openxml.grouping ?? "standard", `${id}: grouping`);
  } else if (spec.kind === "radar") {
    assert.equal(spec.style, openxml.radarStyle, `${id}: radarStyle`);
    assert.equal(spec.markers, openxml.radarStyle === "marker", `${id}: radar markers`);
  }
}

// Ids outside the catalog stay outside (the retired aliases and -3x ids among them); the one preview-only alias is not a catalog id.
assert.equal(byId.has("donut"), false, "donut is a renderer alias, not a catalog id");
assert.equal(resolveChartType("donut"), "doughnut");
assert.equal(resolveChartType("no-such-chart"), null);
for (const retired of ["stacked-column-3x", "clustered-column", "sparkline", "dot-plot", "australia"]) assert.equal(resolveChartType(retired), null, retired + " is not a chart type");

console.log(`Chart catalog passed: ${kept.length} ids agree with core catalogs.chartTypes (barDir, grouping, marker, radarStyle).`);
