// LH-105: chart defaults that follow Stephen Few (no panel, soft series colours, emphasis only in time, direct labels, fewer ticks, and the
// info findings for dual axes and many-slice pies).
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CHART_EMPHASIS_MIN_CONTRAST, CHART_EMPHASIS_MIN_LIGHTNESS_STEP, CHART_MAX_INTERVALS, CHART_SERIES_MIN_LIGHTNESS_STEP, CHART_SERIES_SOFT_MIX,
  chartCategoriesInTime, chartEmphasisColors, chartEndLabels, chartLayer, chartPaletteForFill, chartSchemeSeries, chartSeriesLabelColor, chartSeriesPalette,
  chartSliceLabels, chartValueAxis, colorContrast, composeSlide, isTimeFieldTitle, maxIntervalsFor, niceScale, resolveChartData, smallChart,
  chartTitleFocus, chartContextColor, chartContextColors, CHART_CONTEXT_MIN_CONTRAST, CHART_CONTEXT_LABELED_MIN_CONTRAST,
} from "../dist/composition.js";
import { validate } from "../dist/index.js";
import { colorSchemes } from "./support/catalog.mjs";

const lightness = (hex) => {
  const linear = (channel) => { const n = channel / 255; return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = [1, 3, 5].map((offset) => linear(Number.parseInt(hex.slice(offset, offset + 2), 16)));
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : 24389 / 27 * y;
};
const measure = (text, size, weight) => String(text).length * size * (weight === 700 ? 0.6 : 0.55);
const box = { x: 100, y: 100, width: 800, height: 420 };
const geometry = { box, scale: 1, measure };
const chartItems = (slide, options = {}) => composeSlide(slide, { width: 1280, height: 720, ...options }).items.filter((item) => item.field === "chart");

describe("time order (emphasis only where the order means something)", () => {
  test("periods, years, months, weeks, dates and numeric sequences run in time", () => {
    for (const labels of [["Q1", "Q2", "Q3", "Q4"], ["Q3", "Q4", "Q1", "Q2"], ["2022", "2023", "2024"], [2022, 2023, 2024], ["FY24", "FY25"], ["Q1 2025", "Q2 2025", "Q1 2026"],
      ["1Q24", "2Q24"], ["H1", "H2"], ["Jan", "Feb", "Mar"], ["Nov", "Dec", "Jan"], ["Jan 2024", "Feb 2024"], ["W1", "W2", "W3"], ["Week 1", "Week 2"], ["Sprint 1", "Sprint 2"],
      ["2024-01", "2024-02"], ["2024-03-15", "2024-04-01"], ["1", "2", "3"], ["30", "60", "90"]])
      assert.equal(chartCategoriesInTime(labels), true, JSON.stringify(labels));
  });

  test("nominal categories, reversed runs and English tiers or priorities do not", () => {
    for (const labels of [["Lead", "Qualified", "Won"], ["North", "South"], ["Product A", "Product B"], ["2026", "2025", "2024"], ["Q3", "Q1", "Q4"], ["P1", "P2", "P3"], ["T1", "T2", "T3"], ["3", "2", "1"], ["Only"]])
      assert.equal(chartCategoriesInTime(labels), false, JSON.stringify(labels));
    // A title that names a time field makes distinct labels time ordered, but never a reversed run of one family.
    assert.equal(chartCategoriesInTime(["Baseline", "Pilot", "Rollout"], { title: "Period" }), true);
    assert.equal(chartCategoriesInTime(["Lead", "Won"], { title: "Stage" }), false);
    assert.equal(chartCategoriesInTime(["2026", "2025"], { title: "Year" }), false);
  });

  test("the deck language's month names, time words and digits count (Intl)", () => {
    assert.equal(chartCategoriesInTime(["يناير", "فبراير", "مارس"], { language: "ar" }), true);
    assert.equal(chartCategoriesInTime(["٢٠٢٢", "٢٠٢٣"], { language: "ar" }), true);
    assert.equal(chartCategoriesInTime(["janv.", "févr."], { language: "fr" }), true);
    assert.equal(chartCategoriesInTime(["T1", "T2", "T3"], { language: "fr" }), true, "trimestre outside English");
    assert.equal(chartCategoriesInTime(["März", "April"], { language: "de" }), true);
    assert.equal(isTimeFieldTitle("Quartal", "de"), true);
    assert.equal(isTimeFieldTitle("Region", "en"), false);
  });

  test("a small one-series chart emphasises its last point only over time", () => {
    const of = (rows, column = "Quarter") => { const chart = { type: "column", data: { columns: [column, "Count"], rows } }; return smallChart(chart, resolveChartData(chart), geometry); };
    assert.equal(of([["Q1", 4], ["Q2", 6], ["Q3", 8]]).emphasis, 2);
    assert.equal(of([["Lead", 42], ["Qualified", 30], ["Won", 9]], "Stage").emphasis, undefined, "pipeline stages");
    assert.equal(of([["North", 4], ["East", 6]], "Region").emphasis, undefined, "regions");
    assert.equal(of([["Baseline", 4], ["Pilot", 6]], "Period").emphasis, 1, "the column name says time");
    const titled = { type: "column", data: { columns: ["Stage", "Count"], rows: [["Before", 4], ["After", 6]] }, axisTitles: { category: "Period" } };
    assert.equal(smallChart(titled, resolveChartData(titled), geometry).emphasis, 1, "the category axis title says time");
  });
});

describe("title-driven focus (what the slide title names)", () => {
  const focus = (type, columns, rows, text, extra = {}) => { const chart = { type, data: { columns, rows }, ...extra }; return chartTitleFocus(chart, resolveChartData(chart), { text, language: extra.language }); };
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  test("one series: the categories the title names, by name, month or printed value", () => {
    const regions = [["North America", 48.2], ["Europe", 31.5], ["Asia Pacific", 27.9], ["Latin America", 12.4]];
    assert.deepEqual(focus("column", ["Region", "Bookings ($M)"], regions, "North America still leads on bookings"), { categories: [0] });
    assert.deepEqual(focus("column", ["Month", "Tickets"], months.map((month, i) => [month, 1000 + i]), "Support tickets peaked in November"), { categories: [10] });
    assert.deepEqual(focus("bar", ["Stage", "Deals"], [["Qualified", 186], ["Discovery", 142], ["Proposal", 91], ["Closed won", 31]], "Only 31 of 186 qualified deals close"), { categories: [0, 3] });
    assert.deepEqual(focus("pie", ["Segment", "Revenue"], [["Enterprise", 62.4], ["Mid-market", 25.1], ["Small business", 12.5]], "Enterprise accounts bring 62% of revenue"), { categories: [0] });
    assert.deepEqual(focus("column", ["Month", "Visits"], [["Jan", 1790], ["Feb", 1200]], "Visits peaked at 1,790"), { categories: [0] });
    assert.deepEqual(focus("column", ["Month", { name: "Rate", format: "0%" }], [["Jan", 0.12], ["Feb", 0.2]], "The rate reached 20% in February"), { categories: [1] });
  });

  test("several series: the series the title names, else its categories, else (all named) the first named", () => {
    const quarters = (series) => ["Q1", "Q2", "Q3"].map((q, i) => [q, ...series.map((_, j) => 10 + i + j)]);
    assert.deepEqual(focus("line", ["Quarter", "Enterprise NPS", "Mid-market NPS"], quarters([0, 1]), "Enterprise satisfaction pulled ahead of mid-market"), { series: [0] });
    assert.deepEqual(focus("line", ["Year", "Cloud ($B)", "On-premises ($B)", "Hybrid ($B)", "Edge ($B)"], [["2022", 1, 2, 3, 4], ["2023", 2, 3, 4, 5]], "Cloud spend overtook on-premises in 2023"), { series: [0, 1] });
    assert.deepEqual(focus("column", ["Month", "Organic search", "Paid search", "Referral"], quarters([0, 1, 2]), "Organic search is the fastest-growing traffic source"), { series: [0] });
    assert.deepEqual(focus("bar", ["Team", "Shipped", "Planned"], [["Platform", 42, 36], ["Mobile", 27, 30], ["Data", 19, 20]], "Platform shipped more than it planned"), { categories: [0] });
  });

  test("no focus without a match, for everything named, with explicit options, and in other scripts by collation", () => {
    assert.equal(focus("column", ["Quarter", "Revenue"], [["Q1", 24.1], ["Q2", 26.8]], "Revenue grew every quarter of 2025"), undefined);
    assert.equal(focus("column", ["Region", "Sales"], [["North", 4], ["South", 5]], "North and south both grew"), undefined, "every category named");
    assert.equal(focus("column", ["Region", "Sales"], [["North", 4], ["South", 5]], "North leads", { highlight: { categories: ["South"] } }), undefined);
    assert.equal(focus("column", ["Region", "Sales"], [["North", 4], ["South", 5]], "North leads", { colors: ["accent2"] }), undefined);
    assert.equal(focus("combo", ["Quarter", "Revenue", "Target"], [["Q1", 1, 2], ["Q2", 2, 3]], "Revenue beat the target"), undefined, "combo charts keep their colours");
    assert.deepEqual(focus("column", ["المنطقة", "المبيعات"], [["الشمال", 4], ["الجنوب", 3], ["الشرق", 2]], "الشمال يتصدر المبيعات", { language: "ar" }), { categories: [0] });
    assert.deepEqual(focus("column", ["Région", "Ventes"], [["Île-de-France", 4], ["Bretagne", 3], ["Occitanie", 2]], "L'ile-de-France reste en tête", { language: "fr" }), { categories: [0] });
  });

  test("composition puts the focus on the layer and drops the last-point emphasis; context marks take a 3:1 neutral", () => {
    const slide = { title: "North America still leads", chart: { type: "column", data: { columns: ["Region", "Bookings"], rows: [["North America", 48], ["Europe", 31], ["Asia", 27]] } } };
    const [item] = chartItems(slide);
    // A small chart labels every bar, so its context may be light (`labeled`).
    assert.deepEqual(item.chart.layer.focus, { categories: [0], labeled: true });
    const quarter = chartItems({ title: "Revenue peaked in Q2", chart: { type: "column", data: { columns: ["Quarter", "Revenue"], rows: [["Q1", 4], ["Q2", 9], ["Q3", 6]] } } })[0];
    assert.deepEqual(quarter.chart.layer.focus, { categories: [1], labeled: true });
    const unlabeled = chartItems({ title: "Revenue peaked in Q2", chart: { type: "column", dataLabels: false, data: { columns: ["Quarter", "Revenue"], rows: [["Q1", 4], ["Q2", 9], ["Q3", 6]] } } })[0];
    assert.deepEqual(unlabeled.chart.layer.focus, { categories: [1] });
    assert.equal(quarter.chart.layer.small.emphasis, undefined, "the title wins over the last point");
    for (const backdrop of ["#FFFFFF", "#011842", "#F4F4F4"]) assert.ok(colorContrast(chartContextColor(backdrop, lightness(backdrop) > 50 ? "#000000" : "#FFFFFF"), backdrop) >= CHART_CONTEXT_MIN_CONTRAST - 1e-6, backdrop);
  });

  test("several context series take distinct grays, 11 L* apart, the first the strongest; labeled context may be light", () => {
    for (const [backdrop, text] of [["#FFFFFF", "#000000"], ["#011842", "#FFFFFF"], ["#F4F4F4", "#1F2937"]]) for (const labeled of [false, true]) {
      const focus = "#2874A6";
      const grays = chartContextColors(backdrop, text, 3, { labeled, avoid: [focus] });
      assert.equal(new Set(grays).size, 3, `${backdrop} ${labeled}: ${grays}`);
      const floor = labeled ? CHART_CONTEXT_LABELED_MIN_CONTRAST : CHART_CONTEXT_MIN_CONTRAST;
      for (const gray of grays) assert.ok(colorContrast(gray, backdrop) >= floor - 1e-6, `${gray} on ${backdrop}`);
      for (let index = 1; index < grays.length; index++) assert.ok(Math.abs(lightness(grays[index]) - lightness(grays[index - 1])) >= 11 - 1e-6);
      assert.ok(colorContrast(grays[0], backdrop) > colorContrast(grays[2], backdrop), "the first context series is the strongest");
    }
    // Labeled, the lightest context is light: about 1.6:1 on white (it is 3:1 unlabeled).
    const light = chartContextColors("#FFFFFF", "#000000", 1, { labeled: true })[0], solid = chartContextColors("#FFFFFF", "#000000", 1)[0];
    assert.ok(colorContrast(light, "#FFFFFF") < 2 && colorContrast(solid, "#FFFFFF") >= 3);
  });
});

describe("soft series colours, strong only for emphasis", () => {
  test("scheme series are softened towards the backdrop and keep 3:1 (4.5:1 dark) and their lightness steps", () => {
    let softened = 0;
    for (const scheme of colorSchemes) for (const backdrop of ["#FFFFFF", "#F4F4F4", "#011842", "#000000", "#1E1E1E"]) {
      const palette = chartSeriesPalette(scheme), legible = chartSchemeSeries(undefined, scheme);
      const strong = chartPaletteForFill(backdrop, palette, { legible }), soft = chartPaletteForFill(backdrop, palette, { legible, soften: true });
      const floor = lightness(backdrop) < 50 ? 4.5 : 3;
      soft.forEach((color, index) => {
        assert.ok(colorContrast(color, backdrop) >= floor - 1e-6, `${scheme.id} ${backdrop} series ${index + 1}: ${color}`);
        if (color !== strong[index]) softened++;
        if (index) {
          const before = Math.abs(lightness(strong[index]) - lightness(strong[index - 1])), after = Math.abs(lightness(color) - lightness(soft[index - 1]));
          assert.ok(after >= Math.min(before, CHART_SERIES_MIN_LIGHTNESS_STEP) - 0.6, `${scheme.id} ${backdrop} series ${index}/${index + 1}: ${after} from ${before}`);
        }
      });
    }
    assert.ok(softened > 0);
    assert.equal(CHART_SERIES_SOFT_MIX, 0.25);
  });

  test("the default accent on white is a quarter of the way to white in lightness; an authored colour is never softened", () => {
    const [soft] = chartPaletteForFill("#FFFFFF", ["#2874A6"], { legible: [true], soften: true });
    assert.equal(soft, "#5998C1", "accent1 a quarter of the way to white in HSL lightness, its saturation at 75% (satMod 75000, lumMod 75000, lumOff 25000)");
    assert.deepEqual(chartPaletteForFill("#FFFFFF", ["#2874A6"], { legible: [false], soften: true }), ["#2874A6"]);
  });

  test("the emphasised point takes the full-strength colour (or a shade of it), the others the soft one", () => {
    const colors = chartEmphasisColors("#FFFFFF", "#5E97BC", "#2874A6");
    assert.equal(colors.muted, "#5E97BC");
    assert.ok(Math.abs(lightness(colors.accent) - lightness(colors.muted)) >= CHART_EMPHASIS_MIN_LIGHTNESS_STEP - 1e-6);
    assert.ok(colorContrast(colors.accent, "#FFFFFF") >= CHART_EMPHASIS_MIN_CONTRAST);
    assert.ok(lightness(colors.accent) <= lightness("#2874A6") + 1e-6, "full strength or darker on a light backdrop");
  });

  test("a series name is its colour made legible as text", () => {
    assert.ok(colorContrast(chartSeriesLabelColor("#FFFFFF", "#5E97BC"), "#FFFFFF") >= 4.5);
    assert.equal(chartSeriesLabelColor("#FFFFFF", "#1F4E79"), "#1F4E79");
  });
});

describe("fewer value-axis intervals", () => {
  test("at most six intervals of 1, 2 or 5", () => {
    assert.equal(CHART_MAX_INTERVALS, 6);
    assert.equal(maxIntervalsFor(10000, 1), 6);
    assert.deepEqual(niceScale(0, 760, CHART_MAX_INTERVALS).ticks, [0, 200, 400, 600, 800]);
  });

  test("an axis with room for three intervals is not cut down to one", () => {
    // Stacked areas peaking at 116: 0 to 140 in one interval before; now ticks every 50, ending near the data.
    const scale = niceScale(0, 116, 6);
    assert.ok(scale.ticks.length >= 3, JSON.stringify(scale));
    assert.ok(scale.max <= 116 * 1.25 + 1e-9);
  });
});

describe("no chart panel", () => {
  test("composition carries no panel; the engines judge colours against the backdrop", () => {
    // The layer has no panel field: every chart stands on its card or the slide background (render and pptx tests check the drawing).
    const [item] = chartItems({ title: "T", chart: { type: "column", data: { columns: ["Month", "A", "B", "C"], rows: Array.from({ length: 10 }, (_, index) => [`M${index}`, index, index + 1, index + 2]) } } });
    assert.ok(item.chart.valueAxis);
    // LH-176: two series of ten wider columns now fit their labels; three series are never a small chart (SMALL_CHART_MAX_SERIES).
    assert.equal(item.chart.layer?.small, undefined, "three series: not small");
  });
});

describe("direct labels on line charts", () => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const lines = (series, values) => ({ columns: ["Month", ...series], rows: months.map((month, row) => [month, ...series.map((_, index) => values(index, row))]) });
  const end = (chart, extra = {}) => {
    const data = resolveChartData(chart), g = { ...geometry, ...extra }, layer = chartLayer(chart, data, g);
    return chartEndLabels(chart, data, layer, g, (headerHeight) => chartValueAxis(chart, data, { width: g.box.width, height: g.box.height - headerHeight, scale: 1 }));
  };

  test("two to four series are named at their line ends, in series order, and the header keeps only its caption", () => {
    const chart = { type: "line", data: lines(["Plan", "Actual", "Forecast"], (index, row) => 100 + row * (8 + index * 4)), axisTitles: { value: "Revenue ($M)" } };
    const result = end(chart);
    assert.ok(result);
    const { layer } = result;
    assert.deepEqual(layer.endLabels.entries.map((entry) => entry.name), ["Plan", "Actual", "Forecast"]);
    // Each label carries the last value, then the name.
    assert.deepEqual(layer.endLabels.entries.map((entry) => entry.text), ["188 Plan", "232 Actual", "276 Forecast"]);
    assert.equal(layer.header.legend, undefined, "no header legend");
    assert.equal(layer.header.caption.text, "Revenue ($M) by month");
    assert.ok(layer.plot && layer.endLabels.gutter > 0);
    const right = box.x + box.width - layer.plot.right;
    for (const entry of layer.endLabels.entries) {
      assert.equal(entry.row, 11);
      assert.ok(entry.box.x >= right - 1e-6 - (box.width - layer.plot.left - layer.plot.right) / 24, "past the last point");
      assert.ok(entry.box.x + entry.box.width <= box.x + box.width + 1e-6, "inside the chart box");
    }
  });

  test("names that would touch move apart, no more than a line from their point", () => {
    const chart = { type: "line", data: lines(["A", "B", "C"], (index, row) => 100 + row * 10 + index * 12) };
    const { layer } = end(chart);
    const sorted = [...layer.endLabels.entries].sort((a, b) => a.box.y - b.box.y);
    const text = 20 * 1.22;
    for (let index = 1; index < sorted.length; index++) assert.ok(sorted[index].box.y - sorted[index - 1].box.y >= text - 1e-6);
    for (const entry of sorted) assert.ok(Math.abs(entry.box.y + entry.box.height / 2 - entry.point.y) <= text + 1e-6);
  });

  test("names that cannot be placed fall back to the header legend", () => {
    const close = { type: "line", data: lines(["A", "B", "C", "D"], (index, row) => 50 + row * 2 + [0, 2, -1, 1][index]) };
    assert.equal(end(close), undefined);
    const item = chartItems({ title: "T", chart: close })[0];
    assert.equal(item.chart.layer.endLabels, undefined);
    assert.ok(item.chart.layer.header.legend, "the header legend stays");
  });

  test("a small two-series line chart gives its value labels up for the end labels; a named series' label is bold", () => {
    const slide = { title: "Enterprise satisfaction pulled ahead of mid-market", chart: { type: "line", data: { columns: ["Quarter", "Enterprise NPS", "Mid-market NPS"], rows: ["Q1", "Q2", "Q3", "Q4"].map((q, i) => [q, 40 + i * 7, 40 + i]) } } };
    const [item] = chartItems(slide);
    assert.equal(item.chart.layer.small, undefined, "no small-chart labels, the value axis is back");
    assert.deepEqual(item.chart.layer.endLabels.entries.map((entry) => [entry.text, entry.bold === true]), [["61 Enterprise NPS", true], ["43 Mid-market NPS", false]]);
  });

  test("explicit options, data labels, one series, five series, areas and a series that stops early keep the legend", () => {
    const base = (extra) => ({ type: "line", data: lines(["A", "B"], (index, row) => 10 + row * (2 + index * 3)), ...extra });
    assert.ok(end(base({})));
    for (const chart of [base({ legend: "bottom" }), base({ legend: "none" }), base({ dataLabels: true }), { ...base({}), type: "area" }, { ...base({}), type: "stacked-area" },
      { type: "line", data: lines(["A"], (_, row) => row) }, { type: "line", data: lines(["A", "B", "C", "D", "E"], (index, row) => row * (index + 1) * 10) }])
      assert.equal(end(chart), undefined, JSON.stringify({ type: chart.type, legend: chart.legend, dataLabels: chart.dataLabels, series: chart.data.columns.length - 1 }));
    const early = { type: "line", data: { columns: ["Month", "A", "B"], rows: months.map((month, row) => [month, row, row < 11 ? row * 2 : null]) } };
    assert.equal(end(early), undefined);
  });

  test("right to left the names stand before the leftmost (last) point", () => {
    const chart = { type: "line", data: lines(["Plan", "Actual"], (index, row) => 100 + row * (8 + index * 6)) };
    const { layer } = end(chart, { direction: "rtl" });
    const plotLeft = box.x + layer.plot.left;
    for (const entry of layer.endLabels.entries) assert.ok(entry.box.x + entry.box.width <= entry.point.x + 1e-6 && entry.point.x < plotLeft + 60, JSON.stringify(entry));
  });
});

describe("pie and doughnut: names on the slices", () => {
  const pie = (rows, type = "pie") => ({ type, data: { columns: ["Team", "Budget"], rows } });
  const slices = (chart) => chartSliceLabels(chart, resolveChartData(chart), geometry);

  test("names that fit sit inside their slices; a small slice's name sits outside a pie", () => {
    assert.deepEqual(slices(pie([["Engineering", 45], ["Sales", 25], ["Marketing", 18], ["Support", 12]])).labels.map((entry) => entry.position), ["inside", "inside", "inside", "inside"]);
    const small = slices(pie([["Engineering", 80], ["Sales", 17], ["Legal and compliance", 3]]));
    assert.deepEqual(small.labels.map((entry) => entry.position), ["inside", "inside", "outside"]);
  });

  test("a doughnut names its slices in the ring, or keeps its legend", () => {
    assert.deepEqual(slices(pie([["Chat", 40], ["Email", 30], ["Phone", 20], ["Forum", 10]], "doughnut")).labels.map((entry) => entry.position), ["inside", "inside", "inside", "inside"]);
    assert.equal(slices(pie([["Chat", 97], ["A very long channel name", 3]], "doughnut")), undefined);
  });

  test("outside names that would collide keep the legend; explicit options win", () => {
    assert.equal(slices(pie([["Search", 90], ["Referral partners", 2], ["Paid social", 2], ["Newsletter", 2], ["Other sources", 2], ["Events", 2]])), undefined);
    const four = [["A", 4], ["B", 3], ["C", 2], ["D", 1]];
    for (const extra of [{ legend: "right" }, { legend: "none" }, { dataLabels: true }, { dataLabels: false }]) assert.equal(slices({ ...pie(four), ...extra }), undefined, JSON.stringify(extra));
    assert.equal(slices({ type: "doughnut", data: { columns: ["Team", "FY24", "FY25"], rows: four.map(([name, value]) => [name, value, value + 1]) } }), undefined, "nested rings keep their legend");
  });

  test("composition puts the slice labels on the chart layer", () => {
    // LH-108: in the whole body a pie lists its values beside it instead; beside a text block its names stay on the slices.
    const [item] = chartItems({ title: "Budget", composition: { mode: "row" }, chart: pie([["Engineering", 45], ["Sales", 25], ["Marketing", 18], ["Support", 12]]), text: "Engineering takes almost half of the budget this year." });
    assert.equal(item.chart.layer.slices.labels.length, 4);
    assert.equal(item.chart.valueAxis, undefined);
  });
});

describe("validator info findings", () => {
  const deck = (chart) => ({ slides: [{ title: "Chart", chart: { alt: "A chart", ...chart } }] });
  const found = (document, rule) => validate(document, { only: [rule] }).findings;

  test("opf/chart-dual-axis reports a combo chart with a secondary axis, as info", () => {
    const data = { columns: ["Quarter", "Revenue", "Margin"], rows: [["Q1", 12, 0.31], ["Q2", 15, 0.34]] };
    const [finding] = found(deck({ type: "combo", data, line: ["Margin"], secondaryAxis: ["Margin"] }), "chart-dual-axis");
    assert.equal(finding.severity, "info");
    assert.equal(finding.category, "content");
    assert.match(finding.message, /"Margin" on a second value axis/);
    assert.equal(found(deck({ type: "combo", data, line: ["Margin"] }), "chart-dual-axis").length, 0);
  });

  test("opf/chart-pie-many-slices reports more than five slices, as info", () => {
    const rows = (count) => Array.from({ length: count }, (_, index) => [`S${index}`, count - index]);
    assert.equal(found(deck({ type: "pie", data: { columns: ["Source", "Visits"], rows: rows(5) } }), "chart-pie-many-slices").length, 0);
    const [finding] = found(deck({ type: "doughnut", data: { columns: ["Source", "Visits"], rows: rows(7) } }), "chart-pie-many-slices");
    assert.equal(finding.severity, "info");
    assert.equal(finding.measured.slices, 7);
    assert.equal(found(deck({ type: "bar", data: { columns: ["Source", "Visits"], rows: rows(9) } }), "chart-pie-many-slices").length, 0);
  });
});
