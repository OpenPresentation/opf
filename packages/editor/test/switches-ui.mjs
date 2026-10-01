// RR-06: the picker-side API of the dimension switches: which values a dimension offers, which
// chart types a chart's data can use, and the value a dimension has now.
import assert from "node:assert/strict";
import { catalogs } from "@openpresentation/opf";
import { createEditorSession } from "../dist/index.js";
import { SWITCH_DIMENSIONS, compatibleChartTypes, currentSwitchValue, listSwitchOptions, switchDimension } from "../dist/switches.js";
import { baseDeck } from "./switch-fixture.mjs";

// Every catalog dimension lists exactly the bundled ids; document records come first and override.
for (const [dimension, kind] of [
  ["layouts", "layouts"],
  ["color-schemes", "colorSchemes"],
  ["font-schemes", "fontSchemes"],
  ["languages", "languages"],
  ["narratives", "narratives"],
  ["themes", "themes"],
  ["audiences", "audiences"],
  ["tones", "tones"],
  ["socials", "socialPlatforms"],
  ["charts", "chartTypes"],
]) {
  const options = listSwitchOptions({}, dimension);
  assert.deepEqual(options.map((option) => option.id), catalogs[kind].map((record) => record.id), `${dimension} lists the bundled catalog`);
  assert.ok(options.every((option) => typeof option.label === "string" && option.label), `${dimension} labels`);
}
{
  const document = { catalogs: { fontSchemes: { records: [{ id: "team-mono", name: "Team Mono", major: "Inter", minor: "Inter" }, { id: "georgia", name: "Georgia (team)", major: "Georgia", minor: "Georgia" }] } } };
  const options = listSwitchOptions(document, "font-schemes", { catalogs: { fontSchemes: { records: [{ id: "caller", name: "Caller" }] } } });
  assert.deepEqual(options.slice(0, 3).map((option) => option.id), ["team-mono", "georgia", "caller"]);
  assert.equal(options[1].label, "Georgia (team)", "a document record overrides the bundled one");
  assert.equal(options.filter((option) => option.id === "georgia").length, 1, "no duplicates");
  assert.equal(options.length, catalogs.fontSchemes.length + 2);
  assert.deepEqual(listSwitchOptions({}, "blocks").map((option) => option.id), ["text", "list", "chart", "table", "metric", "quote", "code", "timeline", "group", "image", "video"]);
  assert.deepEqual(listSwitchOptions({}, "backgrounds"), [], "free-form dimensions have no catalog");
}

// Compatible chart types follow the data shape: the first column labels the categories and each
// further column is a series (how the renderers read inline chart data).
{
  const data = (...series) => ({ columns: ["Quarter", ...series], rows: [["Q1", ...series.map(() => 1)], ["Q2", ...series.map(() => 2)]] });
  const chart = (shape, type = "column") => ({ slides: [{ title: "x", blocks: [{ chart: { type, data: shape } }] }] });
  const ids = (document, options) => compatibleChartTypes(document, { slideIndex: 0, ...options }).map((entry) => entry.id);
  const one = ids(chart(data("Revenue")));
  for (const expected of ["column", "bar", "line", "area", "pie", "doughnut", "radar", "funnel", "treemap", "waterfall"]) assert.ok(one.includes(expected), `${expected} suits one series`);
  for (const rejected of ["stacked-column-3x", "scatter", "dot-plot", "sparkline", "histogram", "world", "box-and-whisker", "bullet-bar"]) assert.ok(!one.includes(rejected), `${rejected} does not suit one series`);
  const two = ids(chart(data("Revenue", "Cost")));
  assert.ok(two.includes("line") && two.includes("column") && two.includes("clustered-column") && two.includes("stacked-column-2x") && two.includes("scatter"));
  assert.ok(!two.includes("pie") && !two.includes("doughnut") && !two.includes("stacked-column-3x"), "single-series types and other series counts are excluded");
  const three = ids(chart(data("A", "B", "C")));
  assert.ok(three.includes("stacked-column-3x") && three.includes("line-3x") && !three.includes("stacked-column-2x"));
  // The current type is always listed and flagged, even when the data would not suit it.
  const current = compatibleChartTypes(chart(data("Revenue"), "stacked-column-3x"), { slideIndex: 0 });
  assert.deepEqual(current.filter((entry) => entry.current).map((entry) => entry.id), ["stacked-column-3x"]);
  // Every offered type is a valid switch for that chart.
  for (const id of one) {
    const editor = createEditorSession(chart(data("Revenue")), { rejectInvalid: true });
    switchDimension(editor, "charts", id, { slideIndex: 0 });
    assert.equal(editor.get("slides.0.blocks.0.chart.type"), id);
  }
  // External data: every simple type; no chart: nothing.
  const external = chart(data("Revenue"));
  external.slides[0].blocks[0].chart.data = { source: "https://example.com/data.csv", format: "csv" };
  assert.ok(ids(external).length > one.length - 1);
  assert.deepEqual(ids({ slides: [{ title: "x", text: "y" }] }), []);
  assert.deepEqual(ids(chart(data("Revenue")), { path: "slides.0.blocks.0" }), one, "an explicit path works");
}

// currentSwitchValue for every dimension, at deck and slide scope.
{
  const document = baseDeck();
  document.speaker = { id: "alice", name: "Alice", socials: { linkedin: "alice" } };
  document.slides[1].design = { fontScheme: { id: "georgia", major: "X" }, background: "light1", header: { left: { text: "H" } } };
  const at = (dimension, options) => currentSwitchValue(document, dimension, options);
  assert.deepEqual(at("layouts", { slideIndex: 1 }), { value: "chart-1x", scope: "slide" });
  assert.deepEqual(at("color-schemes"), { value: "cool-horizon", scope: "deck" });
  assert.deepEqual(at("font-schemes"), { value: "aptos", scope: "deck" });
  assert.deepEqual(at("font-schemes", { slideIndex: 1 }), { value: "georgia", scope: "slide" }, "an object reads as its id");
  assert.deepEqual(at("font-schemes", { slideIndex: 0 }), { value: "aptos", scope: "deck" });
  assert.deepEqual(at("themes"), { value: "minimal", scope: "deck" });
  assert.deepEqual(at("languages"), { value: "english", scope: "deck" });
  assert.deepEqual(at("narratives"), { value: "problem-solution", scope: "deck" });
  assert.deepEqual(at("tones"), { value: "formal", scope: "deck" });
  assert.deepEqual(at("audiences"), { value: ["executives"], scope: "deck" });
  assert.deepEqual(at("backgrounds"), { scope: "deck" });
  assert.deepEqual(at("backgrounds", { slideIndex: 1 }), { value: "light1", scope: "slide" });
  assert.deepEqual(at("charts", { slideIndex: 1 }), { value: "column", scope: "slide" });
  assert.deepEqual(at("socials"), { value: { linkedin: "alice" }, scope: "deck" });
  assert.deepEqual(at("headers-footers", { slideIndex: 1 }), { value: { header: { left: { text: "H" } }, footer: undefined }, scope: "slide" });
  assert.equal(at("headers-footers", { slideIndex: 0 }).scope, "deck", "a slide with no value of its own reads the deck's");
  assert.equal(at("image-treatments", { slideIndex: 1 }).scope, "deck");
  assert.deepEqual(at("image-treatments").value, { slideImage: undefined, imageFill: undefined });
  assert.equal(at("blocks").scope, "block");
  for (const dimension of SWITCH_DIMENSIONS) assert.ok(at(dimension, { slideIndex: 1 }), `${dimension} has a reader`);
}

console.log("Switch pickers: options for every catalog dimension, chart types by data shape, and current values at deck and slide scope.");
