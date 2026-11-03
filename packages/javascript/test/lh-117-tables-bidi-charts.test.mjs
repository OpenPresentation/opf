// LH-117 (table columns align by how their cells read), LH-118 (bidi-safe numbers, the trend word only in English), LH-119 (a labeled line
// drops zero sooner), LH-120 (a bar chart in a row of three takes 40%) and LH-111 (small-chart labels follow fit up to sixteen points).
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CHART_LABELED_ZERO_SHARE, SMALL_CHART_MAX_POINTS, TABLE_NUMERIC_SHARE, composeSlide, isolateNumbers, layoutTable,
  niceScale, numberRanges, numericText, resolveChartData, smallChart,
} from "../dist/composition.js";

const box = { x: 0, y: 0, width: 900, height: 400 };
const alignments = (table, options = {}) => layoutTable(table, box, options).rows.map((row) => row.cells.map((cell) => cell.alignment).join(" "));

describe("LH-117: table columns align by appearance", () => {
  test("numericText reads numbers with a sign, currency, separators, percent, scale or a one-word unit", () => {
    for (const text of ["$42", "+3%", "-2.5%", "14,500", "97%", "0.4%", "50 GB", "1 TB", "$1.2M", "(1,200)", "2027", "3.2x", "+0.7 pts", "USD 5", "€840K", "1.2bn", "12 months", `1${String.fromCharCode(0x202f)}234,5`]) {
      assert.equal(numericText(text), true, text);
    }
    for (const text of ["Hold", "A", "Email", "24/7 chat", "Week 1", "Q3", "Northeast", "3 regions where", "2026-11-02", "10:30", "", "  "]) {
      assert.equal(numericText(text), false, JSON.stringify(text));
    }
  });

  test("a column of numbers written as text right-aligns, header included (m02, m17, m24)", () => {
    const table = { columns: ["Region", "Our price", "Competitor average", "Change"], rows: [["Northeast", "$42", "$41", "Hold"], ["Southeast", "$38", "$44", "+3%"], ["Southwest", "$36", "$41", "+3%"]] };
    // "Change" has two numbers in three cells (67%), under TABLE_NUMERIC_SHARE: it starts at the start edge.
    assert.equal(TABLE_NUMERIC_SHARE, 0.75);
    assert.deepEqual(alignments(table), ["left right right left", "left right right left", "left right right left", "left right right left"]);
    const scorecard = { columns: ["Vendor", "On-time delivery", "Defect rate", "Rating"], rows: [["Northwind Parts", "97%", "0.4%", "A"], ["Delta Fasteners", "91%", "1.2%", "B"]] };
    assert.deepEqual(alignments(scorecard), ["left right right left", "left right right left", "left right right left"]);
  });

  test("a JSON number among words starts at the start edge (m43)", () => {
    const table = { columns: ["Starter plan", "Included"], rows: [["Users", 5], ["Storage", "50 GB"], ["Support", "Email"]] };
    assert.deepEqual(alignments(table), ["left left", "left left", "left left", "left left"]);
    const numbers = { columns: ["Plan", "Seats"], rows: [["Starter", 5], ["Business", 50], ["Enterprise", { value: 0.25, format: "0%" }]] };
    assert.deepEqual(alignments(numbers), ["left right", "left right", "left right", "left right"], "JSON numbers in their format still read as numbers");
  });

  test("three of four is enough; empty cells do not count; a rich cell reads by its text", () => {
    const table = { columns: ["Item", "Value"], rows: [["a", "12"], ["b", "n/a"], ["c", "14%"], ["d", [{ text: "+3", bold: true }, "%"]], ["e", null], ["f", ""]] };
    assert.deepEqual(alignments(table).slice(0, 5), ["left right", "left right", "left right", "left right", "left right"]);
  });

  test("an author's cell alignment wins, then the header's (the column's), then the design's", () => {
    const table = { columns: ["Item", { value: "Share", style: { align: "center" } }, "Count"], rows: [["a", "12%", { value: 3, style: { align: "left" } }], ["b", "14%", 4]] };
    assert.deepEqual(alignments(table), ["left center right", "left center left", "left center right"]);
    assert.deepEqual(alignments({ columns: ["Item", "Count"], rows: [["a", 3]] }, { alignment: "center" }), ["center center", "center center"]);
  });

  test("right to left, a column of numbers resolves to the physical right (logical start), as before", () => {
    const table = { columns: ["المنطقة", "التغير"], rows: [["الخليج", "+3%"], ["مصر", "-2.5%"]] };
    assert.deepEqual(alignments(table, { direction: "rtl" }), ["left left", "left left", "left left"]);
  });
});

describe("LH-118: numbers in right-to-left text", () => {
  test("numberRanges finds signed, currency and percent numbers, not bare digits or operators", () => {
    assert.deepEqual(numberRanges("+16%"), [[0, 4]]);
    assert.deepEqual(numberRanges("+8 نقاط"), [[0, 2]]);
    assert.deepEqual(numberRanges("ارتفاع من 79% في"), [[10, 13]]);
    assert.deepEqual(numberRanges("$1,200.50 و -2.5%"), [[0, 9], [12, 17]]);
    assert.deepEqual(numberRanges("2026 و 1,200 و 10:30 و 3-5"), [], "bare digits read the same in either direction");
    assert.deepEqual(numberRanges("x+1"), [], "a sign after a letter is an operator");
  });

  test("isolateNumbers wraps each in a left-to-right isolate", () => {
    assert.equal(isolateNumbers("+16%"), "⁦+16%⁩");
    assert.equal(isolateNumbers("+8 نقاط"), "⁦+8⁩ نقاط");
    assert.equal(isolateNumbers("نص"), "نص");
  });
});

describe("LH-119: a labeled line drops zero sooner", () => {
  test("niceScale drops zero at 0.75 of the maximum when labeled", () => {
    assert.equal(CHART_LABELED_ZERO_SHARE, 0.75);
    assert.equal(niceScale(3.1, 3.8, 6).min, 0, "unlabeled: 3.1 is not in the top sixth");
    assert.ok(niceScale(3.1, 3.8, 6, { labeled: true }).min > 0, "labeled: 3.1 >= 0.75 x 3.8");
    assert.equal(niceScale(2, 3.8, 6, { labeled: true }).min, 0, "below 0.75 keeps zero");
    assert.ok(niceScale(-3.8, -3.1, 6, { labeled: true }).max < 0, "negative data mirror");
  });

  test("a small line chart composes its axis without zero (m11); a column chart keeps it", () => {
    const rows = [["Week 1", 3.1], ["Week 2", 3.2], ["Week 3", 3.5], ["Week 4", 3.7], ["Week 5", 3.8], ["Week 6", 3.8]];
    const axis = (type) => composeSlide({ title: "Conversion", chart: { type, data: { columns: ["Week", "Conversion (%)"], rows } } }, { width: 1280, height: 720 }).items.find((item) => item.field === "chart").chart;
    const line = axis("line");
    assert.equal(line.layer?.small?.valueAxis, false);
    assert.ok(line.valueAxis.min > 0, `line axis starts at ${line.valueAxis.min}`);
    assert.equal(axis("column").valueAxis.min, 0, "a column's length reads from zero");
  });
});

describe("LH-111: small-chart labels follow fit", () => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const chart = { type: "column", data: { columns: ["Month", "Tickets opened"], rows: months.map((month, index) => [month, 1100 + index * 40]) } };
  const measure = (text, size) => text.length * size * 0.55;
  test("twelve monthly columns are labeled when their labels fit (s05), not when they do not", () => {
    assert.equal(SMALL_CHART_MAX_POINTS, 16);
    const wide = smallChart(chart, resolveChartData(chart), { box: { x: 0, y: 0, width: 1160, height: 500 }, scale: 1, minFontSize: 16, measure });
    assert.equal(wide?.labels, true);
    assert.equal(smallChart(chart, resolveChartData(chart), { box: { x: 0, y: 0, width: 360, height: 500 }, scale: 1, minFontSize: 16, measure }), undefined);
  });
});

describe("LH-120: a bar chart in a row of three takes 40%", () => {
  test("the bar chart's cell is 40% of the row and its neighbors share the rest (m28)", () => {
    const slide = {
      title: "Why mid-market customers churn",
      blocks: [
        { items: ["Low usage", "Slow support", "Price increase"] },
        { chart: { type: "bar", data: { columns: ["Driver", "Share (%)"], rows: [["Low usage", 34], ["Support delays", 24], ["Price", 19], ["Integrations", 14], ["Champion left", 9]] } } },
        { quote: { text: "Nobody called.", attribution: "Exit interview" } },
      ],
    };
    const items = composeSlide(slide, { width: 1280, height: 720 }).items.filter((item) => item.path.startsWith("slides.0.blocks"));
    const chart = items.find((item) => item.field === "chart"), list = items.find((item) => item.field === "items");
    const total = items.reduce((sum, item) => sum + item.box.width, 0);
    assert.ok(chart.box.width / total > 0.38, `chart share ${chart.box.width / total}`);
    assert.ok(chart.box.width > list.box.width);
  });
});
