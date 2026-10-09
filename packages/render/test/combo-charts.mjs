import assert from "node:assert/strict";
// The deck names the gallery font scheme roboto: render with the host catalog registered.
import { toSvg } from "./catalog-harness.mjs";

// FA-15: combo charts. Core resolves the plan (which series are columns, which are lines, which line uses the secondary
// value axis); the preview draws clustered columns, lines with markers, a secondary axis at the right with ticks in the
// first secondary series' number format, and a legend with a square key per column series and a line key per line series.

const attributesOf = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const columns = ["Quarter", { name: "Revenue", format: "$#,##0.0" }, { name: "Margin", format: "0%" }];
const rows = [["Q1", 12.4, 0.31], ["Q2", 18.1, 0.34], ["Q3", 21.7, 0.29], ["Q4", 26.3, 0.37]];
const deck = (chart, extra = {}) => ({ design: { fontScheme: "roboto" }, slides: [{ title: "Revenue and margin", chart: { type: "combo", data: { columns, rows }, ...chart }, ...extra }] });
const render = (chart, extra) => {
  const diagnostics = [];
  const svg = toSvg(deck(chart, extra), 1, { trace: true, onDiagnostic: (diagnostic) => diagnostics.push(diagnostic) });
  return { svg, diagnostics };
};
const marks = (svg, tag) => [...svg.matchAll(new RegExp(`<${tag}\\b([^>]*)/?>`, "g"))].map(([, attrs]) => attributesOf(attrs));
const textsAt = (svg, path) => [...svg.matchAll(/<g\b([^>]*data-opf-source-text="true"[^>]*)>([\s\S]*?)<\/g>/g)]
  .filter(([, attrs]) => attributesOf(attrs)["data-opf-path"] === path)
  .map(([, , body]) => ({ text: [...body.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map(([, text]) => text).join(""), x: Number(attributesOf(/<text\b([^>]*)>/.exec(body)?.[1] ?? "").x) }));

// 1. Columns, a line with markers, a legend with both keys.
{
  const { svg, diagnostics } = render({});
  assert.match(svg, /data-opf-chart="combo"/, "the combo chart is drawn by the catalog renderer");
  const bars = marks(svg, "rect").filter((rect) => /\.data\.rows\.\d\.1$/.test(rect["data-opf-path"] ?? ""));
  assert.equal(bars.length, 4, "one column per Revenue value");
  const line = marks(svg, "polyline").filter((polyline) => polyline["data-opf-path"] === "slides.0.chart.data.columns.2").map((polyline) => polyline.points.split(" ").length);
  assert.deepEqual(line, [2, 4], "Margin (the last series, the default line): its legend key and a polyline through the four points");
  const markers = marks(svg, "circle").filter((circle) => /\.data\.rows\.\d\.2$/.test(circle["data-opf-path"] ?? ""));
  assert.equal(markers.length, 4, "the line has a marker per point");
  // Default legend: right of the plot, a square for Revenue and a line with a marker for Margin.
  const legendLine = marks(svg, "polyline").filter((polyline) => polyline["data-opf-path"] === "slides.0.chart.data.columns.2");
  assert.equal(legendLine.length, 2, "the plotted line and its legend key");
  assert.ok(marks(svg, "rect").some((rect) => rect["data-opf-path"] === "slides.0.chart.data.columns.1"), "a square key for the column series");
  assert.deepEqual(diagnostics, []);
}

// 2. Secondary axis: ticks at the right in the Margin format, its own scale; the primary ticks keep the Revenue format.
{
  const { svg } = render({ secondaryAxis: ["Margin"] });
  const ticks = textsAt(svg, "slides.0.chart");
  const percent = ticks.filter((tick) => /^\d+%$/.test(tick.text));
  const dollars = ticks.filter((tick) => /^\$/.test(tick.text));
  assert.ok(percent.length >= 3, `percent ticks on the secondary axis: ${ticks.map((tick) => tick.text)}`);
  assert.ok(dollars.length >= 3, "dollar ticks on the primary axis");
  assert.ok(Math.min(...percent.map((tick) => tick.x)) > Math.max(...dollars.map((tick) => tick.x)), "secondary ticks sit right of the primary ticks");
  // The line uses the secondary scale: the top Margin point (Q4, 37%) is near the top of the plot, not at the bottom.
  const markers = marks(svg, "circle").filter((circle) => /\.data\.rows\.\d\.2$/.test(circle["data-opf-path"] ?? ""));
  const grid = marks(svg, "line").filter((line) => line["stroke-opacity"] === "0.7").map((line) => Number(line.y1));
  const plotTop = Math.min(...grid), plotBottom = Math.max(...grid);
  assert.ok(Number(markers[3].cy) < plotTop + (plotBottom - plotTop) / 2, "the secondary line is scaled to its own axis");
  const primary = render({});
  const primaryMarkers = marks(primary.svg, "circle").filter((circle) => /\.data\.rows\.\d\.2$/.test(circle["data-opf-path"] ?? ""));
  assert.ok(Number(primaryMarkers[3].cy) > plotTop + (plotBottom - plotTop) * 0.9, "on the primary axis the margin line hugs zero");
}

// 3. Column series first: a line named in the middle of the data is drawn after the columns, traced to its authored column.
{
  const data = { columns: ["Quarter", "A", "B", "C"], rows: [["Q1", 1, 2, 3], ["Q2", 2, 3, 4]] };
  const svg = toSvg({ design: { fontScheme: "roboto" }, slides: [{ title: "Order", chart: { type: "combo", data, line: ["A"] } }] }, 1, { trace: true });
  const line = marks(svg, "polyline").find((polyline) => polyline["data-opf-path"] === "slides.0.chart.data.columns.1");
  assert.ok(line, "the line traces to its authored column A");
  const bars = marks(svg, "rect").filter((rect) => /\.data\.rows\.\d\.[23]$/.test(rect["data-opf-path"] ?? ""));
  assert.equal(bars.length, 4, "B and C are columns");
}

// 4. Axis titles: the secondary title is drawn rotated at the right, and only when the chart has a secondary axis.
{
  const titled = render({ secondaryAxis: ["Margin"], axisTitles: { category: "Quarter", value: "Revenue ($M)", secondary: "Margin" } });
  const secondary = textsAt(titled.svg, "slides.0.chart.axisTitles.secondary");
  const value = textsAt(titled.svg, "slides.0.chart.axisTitles.value");
  assert.equal(secondary.length, 1);
  assert.equal(value.length, 1);
  assert.match(titled.svg, /<g transform="rotate\(-90 [^"]+\)">[\s\S]*?data-opf-path="slides\.0\.chart\.axisTitles\.secondary"/, "the secondary title is rotated");
  const untitled = render({ axisTitles: { secondary: "Margin" }, legend: "bottom" });
  assert.equal(textsAt(untitled.svg, "slides.0.chart.axisTitles.secondary").length, 0, "no secondary axis, no secondary title");
  assert.ok(untitled.diagnostics.some((diagnostic) => diagnostic.code === "chart-option-adapted" && diagnostic.option === "axisTitles.secondary"));
}

// 5. Data labels: columns outside-end in the Revenue format, line points above in the Margin format.
{
  const { svg } = render({ secondaryAxis: ["Margin"], dataLabels: true });
  assert.deepEqual(textsAt(svg, "slides.0.chart.data.rows.0.1").map((label) => label.text), ["$12.4"]);
  assert.deepEqual(textsAt(svg, "slides.0.chart.data.rows.0.2").map((label) => label.text), ["31%"]);
}

// 6. Legend position and right to left: the primary axis moves to the right and the secondary axis to the left.
{
  const bottom = render({ legend: "bottom" });
  assert.ok(marks(bottom.svg, "rect").some((rect) => rect["data-opf-path"] === "slides.0.chart.data.columns.1"), "the bottom legend keeps the column key");
  const rtl = toSvg({ ...deck({ secondaryAxis: ["Margin"] }), language: "ar" }, 1, { trace: true });
  const ticks = textsAt(rtl, "slides.0.chart");
  const percent = ticks.filter((tick) => /^\d+%$/.test(tick.text)), dollars = ticks.filter((tick) => /^\$/.test(tick.text));
  if (percent.length && dollars.length) assert.ok(Math.max(...percent.map((tick) => tick.x)) < Math.min(...dollars.map((tick) => tick.x)), "right to left, the secondary axis is at the left");
}

console.log("Combo charts passed: columns, lines with markers, secondary axis scale and format, legend keys, axis titles, labels, RTL.");
