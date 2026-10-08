// RR-06: the picker-side API of the dimension switches: which values a dimension offers, which
// chart types a chart's data can use, and the value a dimension has now.
import assert from "node:assert/strict";
import { CHART_TYPES, LANGUAGES, SOCIAL_PLATFORMS } from "@openpresentation/opf";
import { catalogDisplay, defaultCatalog } from "@openpresentation/opf/catalog";
import { createEditorSession } from "../dist/index.js";
import { SLIDE_SIZE_PRESETS, SWITCH_DIMENSIONS, compatibleChartTypes, currentSwitchValue, listSwitchOptions, switchDimension } from "../dist/switches.js";
import { baseDeck, catalogs } from "./switch-fixture.mjs";

const sorted = (values) => [...values].sort();
// OPF 0.15: a catalog dimension lists the host's registered catalog (core catalogRecords); there are no bundled records.
for (const [dimension, kind] of [
  ["layouts", "layouts"],
  ["color-schemes", "colorSchemes"],
  ["font-schemes", "fontSchemes"],
  ["narratives", "narratives"],
  ["themes", "themes"],
  ["audiences", "audiences"],
  ["tones", "tones"],
  ["purposes", "purposes"],
]) {
  const options = listSwitchOptions({}, dimension, { catalogs });
  assert.deepEqual(sorted(options.map((option) => option.id)), sorted(Object.keys(defaultCatalog[kind])), `${dimension} lists the registered catalog`);
  assert.ok(options.every((option) => typeof option.label === "string" && option.label && option.origin === "host" && option.group === "default"), `${dimension} labels`);
  assert.deepEqual(listSwitchOptions({}, dimension), [], `${dimension}: no catalog registered, nothing to offer`);
}
// Engine vocabularies: core's tables, labelled from the host's display metadata.
assert.deepEqual(listSwitchOptions({}, "languages").map((option) => option.id), LANGUAGES.map((language) => language.tag));
assert.deepEqual(listSwitchOptions({}, "socials").map((option) => option.id), Object.keys(SOCIAL_PLATFORMS));
assert.deepEqual(listSwitchOptions({}, "charts").map((option) => option.id), [...CHART_TYPES]);
assert.equal(listSwitchOptions({}, "languages", { vocabularies: catalogDisplay }).find((option) => option.id === "ja").label, "Japanese");
{
  const caller = { source: "pkg:caller", fontSchemes: { caller: { name: "Caller", major: "Inter", minor: "Inter" } } };
  const presentation = { catalogs: { team: { source: "pkg:caller" }, custom: { fontSchemes: { "team-mono": { name: "Team Mono", major: "Inter", minor: "Inter" }, georgia: { name: "Georgia (team)", major: "Georgia", minor: "Georgia" } } } } };
  const options = listSwitchOptions(presentation, "font-schemes", { catalogs: [defaultCatalog, caller] });
  assert.deepEqual(options.slice(0, 2).map((option) => option.id), ["team-mono", "georgia"], "the document's records come first");
  assert.equal(options[1].label, "Georgia (team)", "a document record shadows the catalog's record with the same reference");
  assert.equal(options.filter((option) => option.id === "georgia").length, 1, "no duplicates");
  assert.ok(options.some((option) => option.id === "team:caller" && option.source === "pkg:caller"), "a named group's registered records use name:id");
  assert.equal(options.length, Object.keys(defaultCatalog.fontSchemes).length + 2);
  assert.deepEqual(listSwitchOptions({}, "blocks").map((option) => option.id), ["text", "list", "chart", "table", "metric", "quote", "code", "timeline", "group", "image", "video"]);
  assert.deepEqual(listSwitchOptions({}, "backgrounds"), [], "free-form dimensions have no catalog");
  // RR-41: the slide sizes are the schema's ten presets, each labelled with its size in inches.
  const sizes = listSwitchOptions({}, "slide-sizes");
  assert.deepEqual(sizes.map((option) => option.id), [...SLIDE_SIZE_PRESETS]);
  assert.deepEqual(sizes.map((option) => option.id), ["16:9", "4:3", "16:10", "1:1", "4:5", "9:16", "letter", "a4", "widescreen", "standard"]);
  assert.equal(sizes.find((option) => option.id === "4:5").label, "4:5 portrait (7.5 x 9.375 in)");
  assert.equal(sizes.find((option) => option.id === "a4").label, "A4 (11.69 x 8.27 in)");
  assert.ok(sizes.every((option) => /\d in\)$/.test(option.label)));
  assert.deepEqual(sorted(Object.keys(defaultCatalog.purposes)), sorted(["inform", "decide", "align", "persuade", "educate", "report", "pitch", "sell", "plan"]));
}

// Compatible chart types follow the data shape: the first column labels the categories and each
// further column is a series (how the renderers read inline chart data).
{
  const data = (...series) => ({ columns: ["Quarter", ...series], rows: [["Q1", ...series.map(() => 1)], ["Q2", ...series.map(() => 2)]] });
  const chart = (shape, type = "column") => ({ slides: [{ title: "x", blocks: [{ chart: { type, data: shape } }] }] });
  // The chart display metadata (complexity, series, OOXML mapping) is the host's: catalogDisplay.chartTypes.
  const ids = (presentation, options) => compatibleChartTypes(presentation, { slideIndex: 0, vocabularies: catalogDisplay, ...options }).map((entry) => entry.id);
  const one = ids(chart(data("Revenue")));
  for (const expected of ["column", "bar", "line", "area", "pie", "doughnut", "radar", "funnel", "treemap", "waterfall"]) assert.ok(one.includes(expected), `${expected} suits one series`);
  for (const rejected of ["stacked-column", "scatter", "histogram", "world", "box-and-whisker"]) assert.ok(!one.includes(rejected), `${rejected} does not suit one series`);
  const two = ids(chart(data("Revenue", "Cost")));
  assert.ok(two.includes("line") && two.includes("column") && two.includes("stacked-column") && two.includes("stacked-line") && two.includes("scatter"));
  assert.ok(!two.includes("pie") && !two.includes("doughnut"), "single-series types are excluded");
  const three = ids(chart(data("A", "B", "C")));
  assert.ok(three.includes("stacked-column") && three.includes("100pct-stacked-area") && !three.includes("scatter"), "a stacked type takes any series count from two up; scatter needs exactly two");
  const five = ids(chart(data("A", "B", "C", "D", "E")));
  assert.ok(five.includes("stacked-bar") && !five.includes("scatter"));
  // The current type is always listed and flagged, even when the data would not suit it.
  const current = compatibleChartTypes(chart(data("Revenue"), "stacked-column"), { slideIndex: 0, vocabularies: catalogDisplay });
  assert.deepEqual(current.filter((entry) => entry.current).map((entry) => entry.id), ["stacked-column"]);
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
  const presentation = baseDeck();
  presentation.speaker = { id: "alice", name: "Alice", socials: { linkedin: "alice" } };
  presentation.slides[1].design = { fontScheme: { id: "georgia", major: "X" }, background: "light1", header: { left: { text: "H" } } };
  const at = (dimension, options) => currentSwitchValue(presentation, dimension, { catalogs, ...options });
  assert.deepEqual(at("layouts", { slideIndex: 1 }), { value: "chart-1x", scope: "slide" });
  assert.deepEqual(at("color-schemes"), { value: "cool-horizon", scope: "deck" });
  assert.deepEqual(at("font-schemes"), { value: "aptos", scope: "deck" });
  assert.deepEqual(at("font-schemes", { slideIndex: 1 }), { value: "georgia", scope: "slide" }, "an object reads as its id");
  assert.deepEqual(at("font-schemes", { slideIndex: 0 }), { value: "aptos", scope: "deck" });
  assert.deepEqual(at("themes"), { value: "minimal", scope: "deck" });
  assert.deepEqual(at("languages"), { value: "en-US", scope: "deck" });
  assert.deepEqual(at("narratives"), { value: "problem-solution", scope: "deck" });
  assert.deepEqual(at("tones"), { value: "formal", scope: "deck" });
  assert.deepEqual(at("audiences"), { value: ["executive"], scope: "deck" });
  assert.deepEqual(at("backgrounds"), { scope: "deck" });
  assert.deepEqual(at("backgrounds", { slideIndex: 1 }), { value: "light1", scope: "slide" });
  assert.deepEqual(at("charts", { slideIndex: 1 }), { value: "column", scope: "slide" });
  assert.deepEqual(at("socials"), { value: { linkedin: "alice" }, scope: "deck" });
  assert.deepEqual(at("headers-footers", { slideIndex: 1 }), { value: { header: { left: { text: "H" } }, footer: undefined }, scope: "slide" });
  assert.equal(at("headers-footers", { slideIndex: 0 }).scope, "deck", "a slide with no value of its own reads the deck's");
  assert.deepEqual(at("image-treatments"), { value: undefined, scope: "block" }, "image treatments belong to one image block");
  assert.deepEqual(at("image-treatments", { path: "slides.2.blocks.2" }).value.fit, undefined);
  assert.equal(at("blocks").scope, "block");
  // RR-41: slide sizes read the deck's design.dimensions, else the theme's; purposes read the goal text or Purpose id.
  assert.deepEqual(at("slide-sizes"), { value: "widescreen", scope: "deck" }, "no design.dimensions: the theme's size");
  assert.deepEqual(at("slide-sizes", { slideIndex: 1 }), { value: "widescreen", scope: "deck" });
  const sized = (dimensions, extra = {}) => ({ ...presentation, design: { ...presentation.design, dimensions }, ...extra });
  assert.deepEqual(currentSwitchValue(sized("a4"), "slide-sizes"), { value: "a4", scope: "deck" });
  assert.deepEqual(currentSwitchValue(presentation, "slide-sizes"), { value: undefined, scope: "deck" }, "no catalog registered: the theme's size is unknown");
  assert.deepEqual(currentSwitchValue(sized({ preset: "letter" }), "slide-sizes"), { value: "letter", scope: "deck" }, "{preset} reads as the preset");
  assert.deepEqual(currentSwitchValue(sized({ preset: "a4", widthInches: 12 }), "slide-sizes").value, { preset: "a4", widthInches: 12 }, "a custom size reads as the object");
  // A slide cannot set its own size (FA-07): a slideIndex reads the deck's size.
  assert.deepEqual(currentSwitchValue(sized("4:3"), "slide-sizes", { slideIndex: 1 }), { value: "4:3", scope: "deck" });
  assert.deepEqual(currentSwitchValue({ slides: [] }, "slide-sizes"), { value: undefined, scope: "deck" }, "unset");
  assert.deepEqual(at("purposes"), { value: undefined, scope: "deck" });
  assert.deepEqual(currentSwitchValue({ ...presentation, purpose: "decide" }, "purposes"), { value: "decide", scope: "deck" });
  assert.deepEqual(currentSwitchValue({ ...presentation, purpose: "Raise a Series B round" }, "purposes"), { value: "Raise a Series B round", scope: "deck" });
  assert.deepEqual(currentSwitchValue({ ...presentation, purpose: { id: "decide", outcome: "Approve it" } }, "purposes"), { value: "decide", scope: "deck" }, "an object reads as its id");
  for (const dimension of SWITCH_DIMENSIONS) assert.ok(at(dimension, { slideIndex: 1 }), `${dimension} has a reader`);
}

console.log("Switch pickers: options for every catalog dimension, chart types by data shape, and current values at deck and slide scope.");
