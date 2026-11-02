// LH-113: shared emphasis across kinds (table.highlight; focus from the slide's texts, list entries, quotes and chart alts applied to
// chart marks and table rows). LH-115: cross-kind row alignment (bars on a table's rows; a timeline under its column chart).
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  alignBarRows, chartPlotInset, chartSlideFocus, colorContrast, composeSlide, layoutTable, resolveChartData, slideFocusSources, tableHighlightColor,
  tableSlideFocus, TABLE_HIGHLIGHT_MIX,
} from "../dist/composition.js";
import { validate } from "../dist/index.js";

const compose = (slide, options = {}) => composeSlide(slide, { width: 1280, height: 720, ...options });
const tableOf = (result) => result.items.find((item) => item.field === "table");
const chartOf = (result) => result.items.find((item) => item.field === "chart");
const shown = (rows) => rows.map((row) => row.map((cell) => String(cell)));
const rowsFocus = (table, slide) => tableSlideFocus(table, table.rows, shown(table.rows), { sources: slideFocusSources(slide) });
const hiring = { columns: ["Function", "Open roles", "Filled"], rows: [["Engineering", 14, 9], ["Support", 11, 7], ["Sales", 8, 5], ["Product", 4, 3]] };
const vendors = { columns: ["Vendor", "On time", "Rating"], rows: [["Northwind Parts", "97%", "A"], ["Delta Fasteners", "91%", "B"], ["Corvid Plastics", "84%", "C"]] };
const pricing = { columns: ["Region", "Our price", "Change"], rows: [["Northeast", "$42", "Hold"], ["Southeast", "$38", "+3%"], ["Southwest", "$36", "+3%"]] };
const energy = { type: "bar", data: { columns: ["Building type", "kWh per sq ft"], rows: [["Office", 18], ["Lab", 42], ["Warehouse", 11], ["Retail", 25]] } };
const focusOf = (chart, slide) => chartSlideFocus(chart, resolveChartData(chart), { sources: slideFocusSources(slide) });

describe("focus sources (LH-113)", () => {
  test("the title and subtitle, then every text, list entry, quote and chart alt of the blocks", () => {
    const sources = slideFocusSources({ title: "T", subtitle: "S", blocks: [{ text: "A" }, { items: ["one", { text: "two", description: "more" }] }, { blocks: [{ quote: { text: "Q", attribution: "X" } }] }, { chart: { ...energy, alt: "Alt" } }] });
    assert.deepEqual(sources.map((source) => [source.kind, source.text]), [["title", "T. S"], ["text", "A"], ["entry", "one"], ["entry", "two. more"], ["quote", "Q"], ["alt", "Alt"]]);
  });

  test("a list entry, a quote and a percent a sentence prints name table rows", () => {
    assert.deepEqual(rowsFocus(hiring, { title: "Hiring plan", blocks: [{ items: ["Engineering and support carry 70% of the new roles", "All offers close by September 15"] }, { table: hiring }] }), [0, 1], "coordinated keys");
    assert.deepEqual(rowsFocus(vendors, { title: "Vendor scorecard", blocks: [{ table: vendors }, { quote: { text: "We re-sourced the three top Corvid parts right after this review." } }] }), [2], "a proper name by its first word");
    assert.deepEqual(rowsFocus(pricing, { title: "Regional pricing review", blocks: [{ text: "Prices rise 3% in the two regions where we trail competitors by more than 10%." }, { table: pricing }] }), [1, 2], "a printed percent");
    assert.deepEqual(rowsFocus(hiring, { title: "Support is the bottleneck", blocks: [{ table: hiring }] }), [1], "the title alone");
  });

  test("conservative: ranges, enumerating lists, long paragraphs naming several keys, stop words and decimals name nothing", () => {
    assert.equal(rowsFocus(hiring, { title: "Plan", blocks: [{ text: "Open roles range from 4 in Product to 14 in Engineering." }, { table: hiring }] }), undefined, "a range");
    assert.equal(rowsFocus(hiring, { title: "Plan", blocks: [{ items: ["Engineering hires first", "Support follows", "Sales last"] }, { table: hiring }] }), undefined, "a list enumerating the rows");
    const long = "Engineering carries most of the plan this quarter, and the recruiting team has agreed to staff it first, ahead of every other function we hire for.";
    assert.ok(long.length > 140);
    assert.deepEqual(rowsFocus(hiring, { title: "Plan", blocks: [{ text: long }, { table: hiring }] }), [0], "a long paragraph naming one key");
    assert.equal(rowsFocus(hiring, { title: "Plan", blocks: [{ text: `${long} Sales follows.` }, { table: hiring }] }), undefined, "a long paragraph naming two keys");
    const other = { columns: ["Group", "Count"], rows: [["Other", 3], ["Core", 9]] };
    assert.equal(rowsFocus(other, { title: "Every other group", blocks: [{ table: other }] }), undefined, "a key that is a stop word");
    const weeks = { type: "line", data: { columns: ["Week", "Conversion"], rows: [["Week 1", 3.1], ["Week 2", 3.2], ["Week 3", 3.5]] }, alt: "Conversion climbed to 3.1% and then 3.5%." };
    assert.equal(focusOf(weeks, { title: "Checkout", blocks: [{ chart: weeks }] }), undefined, "the digits of a decimal are not a key");
    assert.deepEqual(rowsFocus(hiring, { title: "Plan", blocks: [{ text: "Engineering leads." }, { text: "Sales leads." }, { table: hiring }] }), undefined, "sources that disagree");
    const plans = { columns: ["Plan", "Seats"], rows: [["Plan 1", 10], ["Plan 2", 20], ["Plan 3", 30]] };
    assert.equal(rowsFocus(plans, { title: "Table", blocks: [{ table: plans }, { text: "Point 2" }] }), undefined, "a number is not a key's own word");
    assert.deepEqual(rowsFocus(plans, { title: "Table", blocks: [{ table: plans }, { text: "Plan 2 sells best" }] }), [1], "the whole key still names it");
  });

  test("a chart takes its alt's or a sibling's focus, the key named first as the subject, unless its title names one", () => {
    const chart = { ...energy, alt: "The lab building uses 42 kWh per square foot, more than twice the office level." };
    const slide = { title: "Energy use by building type", blocks: [{ chart }, { text: "The lab holds 9% of our floor area." }] };
    assert.deepEqual(focusOf(chart, slide), { categories: [1] });
    assert.deepEqual(focusOf(chart, { ...slide, title: "Retail energy use" }), { categories: [3] }, "the title comes first (LH-105)");
    assert.equal(focusOf({ ...chart, highlight: { categories: ["Office"] } }, slide), undefined, "an authored highlight wins");
    assert.equal(focusOf({ ...chart, colors: ["#336699"] }, slide), undefined, "authored colors win");
  });

  test("right to left: Arabic keys and texts", () => {
    const chart = { type: "column", data: { columns: ["المنطقة", "المبيعات"], rows: [["الخليج", 42], ["مصر", 31], ["المغرب العربي", 24]] }, alt: "تتصدر منطقة الخليج المبيعات بقيمة 42 مليون ريال." };
    assert.deepEqual(chartSlideFocus(chart, resolveChartData(chart), { sources: slideFocusSources({ title: "أداء المبيعات", blocks: [{ chart }] }), language: "ar" }), { categories: [0] });
  });
});

describe("table.highlight (LH-113)", () => {
  test("named rows, derived rows, and an empty list that turns the derived focus off", () => {
    assert.deepEqual(tableOf(compose({ title: "Pricing", blocks: [{ table: { ...pricing, highlight: { rows: ["Northeast"] } } }] })).tableHighlight, [0]);
    assert.deepEqual(tableOf(compose({ title: "Pricing", blocks: [{ text: "Prices rise 3% in two regions." }, { table: pricing }] })).tableHighlight, [1, 2]);
    assert.equal(tableOf(compose({ title: "Pricing", blocks: [{ text: "Prices rise 3% in two regions." }, { table: { ...pricing, highlight: { rows: [] } } }] })).tableHighlight, undefined);
    const filled = { ...pricing, rows: [[{ value: "Northeast", style: { fill: "#FFEEAA" } }, "$42", "Hold"], ...pricing.rows.slice(1)] };
    assert.equal(tableOf(compose({ title: "Pricing", blocks: [{ text: "Prices rise 3% in two regions." }, { table: filled }] })).tableHighlight, undefined, "an authored fill");
  });

  test("layoutTable marks the cells of the highlighted body rows, never the header", () => {
    const layout = layoutTable(pricing, { x: 0, y: 0, width: 600, height: 300 }, { highlight: [1] });
    assert.deepEqual(layout.rows.map((row) => row.cells.every((cell) => cell.highlighted === true)), [false, false, true, false]);
  });

  test("the tint is 15% of the accent over the surface, mixed less to keep the text at 4.5:1", () => {
    assert.equal(TABLE_HIGHLIGHT_MIX, 0.15);
    for (const [surface, accent, text] of [["#FFFFFF", "#2E75B6", "#000000"], ["#F0F0F0", "#2E75B6", "#1A1A1A"], ["#1E1E1E", "#4A9FE0", "#FFFFFF"], ["#FFFFFF", "#000000", "#595959"]]) {
      const tint = tableHighlightColor(surface, accent, text);
      assert.notEqual(tint.toUpperCase(), surface, `${surface} ${accent}`);
      assert.ok(colorContrast(text, tint) >= 4.5 || colorContrast(text, tint) >= colorContrast(text, surface), `${surface} ${accent} ${text}: ${tint}`);
    }
    assert.equal(tableHighlightColor("#FFFFFF", "#2E75B6", "#000000").toUpperCase(), "#E0EAF4");
  });

  test("validate: a name no row has is table-highlight-unknown-name", () => {
    const deck = (highlight) => ({ $schema: "https://openpresentation.org/schema/opf/v1", slides: [{ title: "T", table: { ...pricing, highlight } }] });
    assert.ok(validate(deck({ rows: ["Southeast"] })).valid);
    const result = validate(deck({ rows: ["South"] }));
    assert.equal(result.valid, false);
    assert.ok(result.findings.some((finding) => finding.ruleId === "opf/table-highlight-unknown-name" && finding.path === "/slides/0/table/highlight/rows/0"), JSON.stringify(result.findings));
  });
});

describe("bars on a table's rows (LH-115)", () => {
  const warranty = { columns: ["Product line", "Claims per 1,000", "Main cause"], rows: [["Controllers", 24, "Firmware faults"], ["Pumps", 18, "Seal wear"], ["Valves", 11, "Corrosion"], ["Sensors", 7, "Calibration drift"]] };
  const bars = { type: "bar", data: { columns: ["Product line", "Cost ($K)"], rows: [["Controllers", 7.4], ["Pumps", 3.3], ["Valves", 1.3], ["Sensors", 0.7]] } };
  for (const language of ["en", "ar"]) test(`each bar is centered on its key's row (${language})`, () => {
    const result = compose({ title: "Warranty claims by product line", layout: undefined, blocks: [{ chart: bars }, { table: warranty }] }, { presentation: { language, slides: [] } });
    const chart = chartOf(result), table = tableOf(result), rows = chart.chart?.layer?.rows;
    assert.ok(rows, "aligned");
    const layout = layoutTable(table.value, table.box, { scale: 1, minFontSize: table.composition.minFontSize, ...(language === "ar" ? { direction: "rtl" } : {}), ...(table.tableGrowth ? { growth: table.tableGrowth } : {}) });
    const body = layout.rows.slice(1);
    body.forEach((row, index) => {
      const key = row.cells.find((cell) => cell.column === 0), middle = key.textBox.y + key.fit.lines.length * key.fit.lineHeight / 2;
      assert.ok(Math.abs(chart.box.y + rows.centers[index] - middle) < 1, `row ${index}`);
    });
    assert.ok(Math.abs(chart.box.y + rows.top - body[0].box.y) < 1 && Math.abs(chart.box.y + rows.bottom - (body.at(-1).box.y + body.at(-1).box.height)) < 1);
  });

  test("only for the same keys in the same order, a horizontal bar chart, side by side", () => {
    const reordered = { ...warranty, rows: [warranty.rows[1], warranty.rows[0], ...warranty.rows.slice(2)] };
    assert.equal(chartOf(compose({ title: "Warranty", blocks: [{ chart: bars }, { table: reordered }] })).chart?.layer?.rows, undefined, "another order");
    assert.equal(chartOf(compose({ title: "Warranty", blocks: [{ chart: { ...bars, type: "column" } }, { table: warranty }] })).chart?.layer?.rows, undefined, "columns");
    assert.equal(chartOf(compose({ title: "Warranty", blocks: [{ chart: bars }, { table: { ...warranty, rows: [...warranty.rows, ["Hoses", 3, "Cracks"]] } }] })).chart?.layer?.rows, undefined, "another row count");
  });

  test("alignBarRows refuses rows outside the chart's plot band", () => {
    const data = resolveChartData(bars), box = { x: 0, y: 100, width: 500, height: 300 }, measure = (text, size) => text.length * size * 0.55;
    const rows = [0, 1, 2, 3].map((index) => ({ x: 520, y: 150 + index * 50, width: 400, height: 50 }));
    assert.ok(alignBarRows(data, box, rows, rows.map((row) => row.y + 25), { scale: 1, hiddenAxis: true, measure }));
    assert.equal(alignBarRows(data, box, rows, rows.map((row) => row.y + 25), { scale: 1, header: 80, hiddenAxis: true, measure }), undefined, "above the plot, under the header row");
    const low = rows.map((row) => ({ ...row, y: row.y + 60 }));
    assert.equal(alignBarRows(data, box, low, low.map((row) => row.y + 25), { scale: 1, hiddenAxis: false, measure }), undefined, "over the value labels");
  });
});

describe("a timeline under its column chart (LH-115)", () => {
  const ramp = { type: "column", data: { columns: ["Quarter", "Headcount"], rows: [["Q1", 12], ["Q2", 52], ["Q3", 104], ["Q4", 150]] } };
  const events = [{ when: "Q1", what: "Site lease signed" }, { when: "Q2", what: "First 40 hires start" }, { when: "Q3", what: "Training center opens" }, { when: "Q4", what: "Full staffing reached" }];
  for (const language of ["en", "ar"]) test(`one event under each column, the timeline listed first as written (${language})`, () => {
    const presentation = { language, slides: [] };
    const result = compose({ title: "Hiring ramp", blocks: [{ timeline: events }, { chart: ramp }] }, { presentation });
    const chart = chartOf(result), timeline = result.items.find((item) => item.timelineLayout);
    assert.equal(timeline.timelineLayout.arrangement, "band");
    assert.ok(timeline.box.y >= chart.box.y + chart.box.height - 0.5, "below the chart");
    assert.ok(result.items.indexOf(timeline) < result.items.indexOf(chart), "reading order");
    const inset = chartPlotInset(chart.value, resolveChartData(chart.value), chart.chart, { box: chart.box, scale: 1, minFontSize: chart.composition.minFontSize, measure: (text, size) => text.length * size * 0.5, direction: language === "ar" ? "rtl" : "ltr", language });
    const left = chart.box.x + inset.left, width = chart.box.width - inset.left - inset.right, band = width / 4;
    const columns = [0, 1, 2, 3].map((index) => left + ((language === "ar" ? 3 - index : index) + 0.5) * band);
    timeline.timelineLayout.markers.forEach((marker, index) => assert.ok(Math.abs(marker.x - columns[index]) < 1.5, `event ${index}: ${marker.x} vs ${columns[index]}`));
    const before = compose({ title: "Hiring ramp", blocks: [{ timeline: events.map((event) => ({ ...event, when: `${event.when} 2026` })) }, { chart: ramp }] }, { presentation });
    const what = (composed) => Math.min(...composed.items.find((item) => item.timelineLayout).timelineLayout.parts.filter((part) => part.role === "what").map((part) => part.fit.fontSize));
    assert.ok(what(result) >= what(before) - 0.01, "no smaller than the arrangement without the rule");
  });

  test("other keys, another order or a bar chart keep the slide's own arrangement", () => {
    for (const blocks of [[{ timeline: events.slice().reverse() }, { chart: ramp }], [{ timeline: events }, { chart: { ...ramp, type: "bar" } }], [{ timeline: events }, { chart: ramp }, { text: "More" }]]) {
      const result = compose({ title: "Hiring ramp", blocks }), chart = chartOf(result), timeline = result.items.find((item) => item.timelineLayout);
      assert.ok(!(timeline.box.y >= chart.box.y + chart.box.height - 0.5 && timeline.timelineLayout.arrangement === "band" && timeline.box.width < chart.box.width), JSON.stringify(blocks.map(Object.keys)));
    }
  });
});
