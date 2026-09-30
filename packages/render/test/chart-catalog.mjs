import assert from "node:assert/strict";
import { catalogs } from "@openpresentation/opf";
import { CHART_TYPES, DEPRECATED_CHART_TYPES, resolveChartType } from "../dist/charts.js";

// The renderer carries its own chart tables (kept ids and their construct,
// deprecated id -> replacement). They must agree with the installed core chart
// type catalog, so a catalog change fails here instead of drifting silently.
const catalog = catalogs.chartTypes;
assert.ok(Array.isArray(catalog) && catalog.length > 0, "core exposes catalogs.chartTypes");
const byId = new Map(catalog.map((record) => [record.id, record]));
const kept = catalog.filter((record) => !record.deprecation);
const deprecated = catalog.filter((record) => record.deprecation);

// Same id sets.
assert.deepEqual([...Object.keys(CHART_TYPES)].sort(), kept.map((record) => record.id).sort(), "kept ids match the catalog");
assert.deepEqual([...Object.keys(DEPRECATED_CHART_TYPES)].sort(), deprecated.map((record) => record.id).sort(), "deprecated ids match the catalog");

// Deprecated ids map to the catalog's replacement, which is itself kept.
for (const record of deprecated) {
  const replacement = record.deprecation.replacedBy;
  assert.equal(typeof replacement, "string", `${record.id}: catalog names a replacement`);
  assert.equal(DEPRECATED_CHART_TYPES[record.id], replacement, `${record.id}: replacedBy`);
  assert.ok(Object.hasOwn(CHART_TYPES, replacement) && !byId.get(replacement).deprecation, `${record.id}: replacement ${replacement} is kept`);
  assert.equal(resolveChartType(record.id), replacement, `${record.id}: resolves to its replacement`);
}

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
  // Pareto is a chartex histogram with an owned cumulative line; the catalog says so through `extension`.
  const expectedKind = id === "pareto" ? "pareto" : kindByElement[openxml.element];
  assert.equal(spec.kind, expectedKind, `${id}: kind follows ${openxml.element}`);
  if (spec.kind === "bar") {
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

// Ids outside the catalog stay outside; the one preview-only alias is not a catalog id.
assert.equal(byId.has("donut"), false, "donut is a renderer alias, not a catalog id");
assert.equal(resolveChartType("donut"), "doughnut");
assert.equal(resolveChartType("no-such-chart"), null);

console.log(`Chart catalog passed: ${kept.length} kept and ${deprecated.length} deprecated ids agree with core catalogs.chartTypes (replacedBy, barDir, grouping, marker, radarStyle).`);
