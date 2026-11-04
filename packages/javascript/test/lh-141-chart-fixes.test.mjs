// LH-141, LH-142, LH-143 in core: default value labels, the doughnut hole, the pie value list, line end labels and a metric's numeric value
// group their thousands by the deck language; a horizontal stacked bar chart whose every segment carries its value drops its value axis;
// a header legend wider than its row wraps onto a second row instead of moving to the side (so a font that measures it narrower or wider
// makes the same decision).
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { composeSlide, chartHeader, resolveChartData, groupNumber, groupsThousands, groupsAxisTicks, layoutMetric, CHART_HEADER_LEGEND_ROWS } from "../dist/composition.js";

const compose = (slide, options = {}) => composeSlide(slide, { width: 1280, height: 720, ...options });
const chartOf = (slide, options) => compose(slide, options).items.find((item) => item.field === "chart");
const layerOf = (slide, options) => chartOf(slide, options)?.chart?.layer ?? {};
const deckOf = (language) => ({ language, slides: [] });
const regions = [["North America", 5400, 2100, 900], ["Europe", 4600, 2300, 1300], ["Asia Pacific", 3900, 2800, 1100]];
const bars = (extra = {}, rows = regions, type = "stacked-bar") => ({ type, data: { columns: ["Region", "Self-service", "Chat", "Phone"], rows }, ...extra });
const outcomes = [["Resolved on first contact", 6240], ["Resolved after follow-up", 2180], ["Escalated", 890], ["Unresolved", 310]];
const doughnut = (extra = {}) => ({ type: "doughnut", data: { columns: ["Outcome", "Tickets"], rows: outcomes }, ...extra });

describe("LH-141: thousands grouped by the deck language", () => {
  test("groupNumber groups by the locale and falls back to English", () => {
    assert.equal(groupNumber(6240, "en"), "6,240");
    assert.equal(groupNumber(6240, "de"), "6.240");
    assert.equal(groupNumber(1250000, "de"), "1.250.000");
    assert.equal(groupNumber(1250000), "1,250,000");
    assert.equal(groupNumber(1250000, "not a tag"), "1,250,000", "an unusable tag is English");
    assert.equal(groupNumber(6240.5, "en"), "6,240.5");
    assert.equal(groupNumber(-12345, "en"), "-12,345");
    assert.equal(groupNumber(Number.NaN), "NaN");
  });

  test("a series groups only when its values are whole numbers and one has four digits", () => {
    assert.equal(groupsThousands([4120, 6240, null]), true);
    assert.equal(groupsThousands([-1500, 3]), true);
    assert.equal(groupsThousands([120, 999]), false, "three digits stay as they are");
    assert.equal(groupsThousands([1200.5, 3000]), false, "a fraction keeps the General form");
    assert.equal(groupsThousands([]), false);
  });

  test("a value axis groups its ticks when they are whole numbers of four digits", () => {
    assert.equal(groupsAxisTicks({ min: 0, max: 8000, majorUnit: 2000 }), true);
    assert.equal(groupsAxisTicks({ min: 0, max: 800, majorUnit: 200 }), false, "three digits");
    assert.equal(groupsAxisTicks({ min: 0, max: 2500, majorUnit: 500 }), true);
    assert.equal(groupsAxisTicks({ min: 0, max: 2, majorUnit: 0.5 }), false, "fractional ticks");
    assert.equal(groupsAxisTicks({ min: 0, max: 0, majorUnit: 0 }), false);
    const line = chartOf({ title: "Orders", chart: { type: "line", data: { columns: ["Month", "Orders"], rows: [["Jan", 4120], ["Feb", 6240]] } } });
    assert.equal(groupsAxisTicks(line.chart.valueAxis), true, "the composed axis of a line chart of thousands");
  });

  test("the pie value list and the doughnut hole print grouped values; an author's format and fractions do not", () => {
    const title = "Two in three tickets are resolved on first contact";
    for (const [language, expected] of [["en", "6,240"], ["de", "6.240"], [undefined, "6,240"]]) {
      const list = layerOf({ title, chart: doughnut() }, { presentation: deckOf(language) }).valueList;
      assert.ok(list, `${language}: a list`);
      assert.equal(list.rows[0].value, expected, `${language}: the list value`);
      assert.equal(list.hole?.value.text, expected, `${language}: the hole value`);
    }
    const written = layerOf({ title, chart: { type: "doughnut", data: { columns: ["Outcome", { name: "Tickets", format: "0" }], rows: outcomes } } }).valueList;
    assert.equal(written.rows[0].value, "6240", "a number format the author wrote is kept");
    const fractions = layerOf({ title, chart: { type: "doughnut", data: { columns: ["Outcome", "Tickets"], rows: outcomes.map(([name, value], i) => [name, i ? value : value + 0.5]) } } }).valueList;
    assert.equal(fractions.rows[0].value, "6240.5", "a series of fractions keeps the General form");
  });

  test("a line's end labels print the last value grouped", () => {
    const chart = { type: "line", data: { columns: ["Month", "Orders", "Returns"], rows: [["Jan", 4120, 310], ["Feb", 4380, 290], ["Mar", 5240, 330], ["Apr", 6240, 360]] } };
    const labels = layerOf({ title: "Orders grew while returns held steady", chart }, { presentation: deckOf("de") }).endLabels;
    assert.deepEqual(labels.entries.map((entry) => entry.text), ["6.240 Orders", "360 Returns"]);
  });

  test("a metric's numeric value is grouped; a string value is the author's text", () => {
    const box = { x: 0, y: 0, width: 600, height: 300 };
    const text = (value, language) => layoutMetric({ value, label: "Tickets" }, box, language ? { language } : {}).parts.find((part) => part.role === "value").text;
    assert.equal(text(6240), "6,240");
    assert.equal(text(6240, "de"), "6.240");
    assert.equal(text(1250000, "en"), "1,250,000");
    assert.equal(text(999), "999");
    assert.equal(text("6240"), "6240", "a string is not rewritten");
    assert.equal(text("64,000", "de"), "64,000");
    const slide = { title: "Four digits", metric: { value: 6240, label: "Tickets" } };
    const laid = compose(slide, { presentation: deckOf("de") }).items.find((item) => item.field === "metric");
    assert.equal(laid.metricLayout.parts.find((part) => part.role === "value").text, "6.240");
  });
});

describe("LH-142: labels or an axis, not both", () => {
  test("a horizontal stacked bar chart whose every segment is labeled drops its value axis", () => {
    const item = chartOf({ title: "Self-service carries most requests", chart: bars() });
    const layer = item.chart.layer;
    assert.ok(layer.stack.values.every((row) => row.every(Boolean)), "every segment holds its value");
    assert.equal(layer.stack.valueAxis, false);
    // The plot reaches the chart's padding at the bottom: no tick row under it.
    const kept = chartOf({ title: "Self-service carries most requests", chart: bars({}, [["North America", 5400, 2100, 90], ["Europe", 4600, 2300, 130], ["Asia Pacific", 3900, 2800, 110]]) }).chart.layer;
    assert.ok(layer.plot.bottom < kept.plot.bottom, `the plot grows by the tick row (${layer.plot.bottom} < ${kept.plot.bottom})`);
  });

  test("a segment that does not hold its value, a titled axis, a 100% chart and a column chart keep the axis", () => {
    const tight = layerOf({ title: "Tight", chart: bars({}, [["North America", 5400, 2100, 90], ["Europe", 4600, 2300, 130]]) });
    assert.ok(tight.stack.values.some((row) => row.some((fits) => !fits)), "a hairline segment has no label");
    assert.equal(tight.stack.valueAxis, undefined);
    assert.equal(layerOf({ title: "Titled", chart: bars({ axisTitles: { value: "Requests" } }) }).stack.valueAxis, undefined, "a value axis title keeps the axis");
    assert.equal(layerOf({ title: "Share", chart: bars({}, regions, "100pct-stacked-bar") }).stack.valueAxis, undefined, "a share axis stays");
    assert.equal(layerOf({ title: "Columns", chart: bars({}, regions, "stacked-column") }).stack?.valueAxis, undefined, "columns are not changed");
    assert.equal(layerOf({ title: "Own labels", chart: bars({ dataLabels: false }) }).stack, undefined, "an explicit option keeps the chart as authored");
  });

  test("a small chart keeps dropping its axis through the same answer", () => {
    const small = layerOf({ title: "Orders", chart: { type: "column", data: { columns: ["Month", "Orders"], rows: [["Jan", 1], ["Feb", 2]] } } });
    assert.equal(small.small.valueAxis, false);
  });
});

describe("LH-143: a wide header legend wraps instead of moving to the side", () => {
  const data = (names) => resolveChartData({ type: "stacked-bar", data: { columns: ["Plant", ...names], rows: [["Fresno", ...names.map(() => 1)]] } });
  const chart = { type: "stacked-bar" };
  const geometry = (measure, width = 400) => ({ box: { x: 0, y: 0, width, height: 300 }, scale: 1, measure, direction: "ltr" });
  const names = ["Parts ($K per 1,000 units)", "Labor ($K per 1,000 units)"];

  test("two rows hold what one row cannot, in any font that measures the entries each within a row", () => {
    for (const factor of [0.8, 1, 1.2, 1.4]) {
      const header = chartHeader(chart, data(names), geometry((text, size) => text.length * size * 0.5 * factor));
      assert.ok(header?.legend, `factor ${factor}: the header legend stands`);
      const rows = new Set(header.legend.entries.map((entry) => entry.box.y)).size;
      assert.ok(rows >= 1 && rows <= CHART_HEADER_LEGEND_ROWS, `factor ${factor}: ${rows} rows`);
      for (const entry of header.legend.entries) assert.ok(entry.box.x + entry.box.width <= 400 - 10 + 0.01, `factor ${factor}: ${entry.name} stays in the chart`);
      assert.ok(Math.abs(header.legend.box.height - rows * header.legend.entries[0].box.height) < 1e-6, "the legend box holds its rows");
    }
  });

  test("a legend that fits keeps one row; an entry wider than the row or more than two rows keep the side legend", () => {
    const one = chartHeader(chart, data(names), geometry((text, size) => text.length * size * 0.3, 900));
    assert.equal(new Set(one.legend.entries.map((entry) => entry.box.y)).size, 1);
    assert.equal(chartHeader(chart, data(names), geometry((text, size) => text.length * size * 5))?.legend, undefined, "one entry wider than the chart");
    const four = ["Planned maintenance hours", "Unplanned maintenance hours", "Contractor hours", "Warranty hours"];
    assert.equal(chartHeader(chart, data(four), geometry((text, size) => text.length * size * 0.6, 420))?.legend, undefined, "four long names need three rows");
  });

  test("the plot keeps the chart's whole width and its legend stands on top", () => {
    const slide = (columns) => ({ title: "Warranty claims", chart: { type: "stacked-bar", data: { columns: ["Product line", ...columns], rows: [["Controllers", 4.9, 2.5], ["Pumps", 2.1, 1.2], ["Valves", 0.8, 0.5], ["Sensors", 0.4, 0.3]] } } });
    const wide = layerOf(slide(["Parts ($K per 1,000 units)", "Labor ($K per 1,000 units)"]), { width: 400, height: 300 });
    const short = layerOf(slide(["Parts", "Labor"]), { width: 400, height: 300 });
    assert.ok(wide.header?.legend, "the wide legend is in the header");
    assert.ok(Math.abs(wide.plot.right - short.plot.right) < 1, "no side legend takes the plot's width");
  });
});
