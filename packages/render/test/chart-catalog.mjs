import assert from "node:assert/strict";
import { catalogDisplay } from "@openpresentation/gallery";
import { CHART_TYPES as CORE_CHART_TYPES, ENGINE_DEFAULT_CHART_TYPES } from "@openpresentation/opf/composition";
import { CHART_TYPES, resolveChartType } from "../dist/charts.js";
import { engineDefaults } from "../dist/index.js";

// OPF 0.15: chart.type is an engine vocabulary, core's CHART_TYPES (the schema enum), not a catalog kind. The renderer carries
// its own chart table (each type and the construct it previews). It must agree with core's CHART_TYPES ids and with the
// OOXML construct the gallery's display metadata names for each type (catalogDisplay.chartTypes[id].mappings.openxml, the
// construct opf-pptx exports), so a vocabulary or mapping change fails here instead of drifting silently.
assert.ok(Array.isArray(CORE_CHART_TYPES) && CORE_CHART_TYPES.length > 0, "core exports CHART_TYPES");
const display = catalogDisplay.chartTypes;
assert.ok(display && typeof display === "object", "catalogDisplay.chartTypes is keyed by id");

// Same id sets: the renderer table, core's vocabulary and the display metadata.
assert.deepEqual(Object.keys(CHART_TYPES).sort(), [...CORE_CHART_TYPES].sort(), "renderer ids match core CHART_TYPES");
assert.deepEqual(Object.keys(display).sort(), [...CORE_CHART_TYPES].sort(), "catalogDisplay.chartTypes covers exactly CHART_TYPES");
for (const id of ENGINE_DEFAULT_CHART_TYPES) assert.ok(CORE_CHART_TYPES.includes(id), `${id}: engine default chart type is in CHART_TYPES`);
assert.equal(engineDefaults.chartType, ENGINE_DEFAULT_CHART_TYPES[0], "the renderer's engine default chart type is core's first engine default");

// Every id resolves to itself and its renderer construct matches the OOXML mapping.
const kindByElement = {
  barChart: "bar", lineChart: "line", areaChart: "area", pieChart: "pie", doughnutChart: "doughnut",
  scatterChart: "scatter", radarChart: "radar", treemapChart: "treemap", histogramChart: "histogram",
  boxWhiskerChart: "box", waterfallChart: "waterfall", funnelChart: "funnel", mapChart: "map"
};
const grouping = { standard: "standard", clustered: "clustered", stacked: "stacked", percentStacked: "percentStacked" };
for (const id of CORE_CHART_TYPES) {
  const openxml = display[id]?.mappings?.openxml;
  const spec = CHART_TYPES[id];
  assert.equal(resolveChartType(id), id, `${id}: resolves to itself`);
  assert.ok(openxml?.element, `${id}: catalogDisplay carries mappings.openxml.element`);
  // Pareto is a chartex histogram with an owned cumulative line; the mapping says so through `extension`. A mixed composition
  // (combo, FA-15) is its own construct: clustered columns (its primary element) with line series.
  const expectedKind = id === "pareto" ? "pareto" : openxml.composition === "mixed" ? "combo" : kindByElement[openxml.element];
  assert.equal(spec.kind, expectedKind, `${id}: kind follows ${openxml.element}`);
  if (spec.kind === "pareto") assert.equal(openxml.extension, "cx:paretoLine", `${id}: the owned Pareto line`);
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

// Values outside the vocabulary stay outside: the removed donut alias, the retired -3x ids and other names.
assert.equal(CORE_CHART_TYPES.includes("donut"), false, "donut is not a chart type");
assert.equal(resolveChartType("donut"), null, "the renderer no longer maps the removed donut alias");
assert.equal(resolveChartType("no-such-chart"), null);
for (const retired of ["stacked-column-3x", "clustered-column", "sparkline", "dot-plot", "australia"]) assert.equal(resolveChartType(retired), null, retired + " is not a chart type");

console.log(`Chart types table passed: ${CORE_CHART_TYPES.length} ids agree with core CHART_TYPES and catalogDisplay.chartTypes mappings (barDir, grouping, marker, radarStyle).`);
