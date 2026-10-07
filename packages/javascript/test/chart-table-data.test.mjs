// RR-54: chart and table data (docs/chart-table-data.md): strict numbers, number formats and Excel codes, datasets,
// series mapping, and their validation, findings and core integration.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

import { chartNumber, importData, toExcelNumberFormat, formatDataNumber, formatVariableNumber, inlineDatasets, fromExcelNumberFormat, paginate, presentation, validate, resolveChartData, resolveTableData, resolveVariables, tableCellDisplayValue, suggestChartNumberFix } from "../dist/index.js";
import * as dataEntry from "../dist/data.js";
import { composeSlide, layoutTable } from "../dist/composition.js";
import { convertContent } from "../dist/convert.js";
import { diff } from "../dist/diff.js";
import { format } from "../dist/format.js";
import { applyPatch } from "../dist/patch.js";
import { fromMarkdown, toMarkdown } from "../dist/markdown.js";
import { createRequire } from "node:module";
import { check, errorsOf, warningsOf } from './support/validation.mjs';

const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020.js").default;
const addFormats = require("ajv-formats").default;
// The schema definitions are checked with Ajv directly: core exposes no generic schema validator.
const ajv = new Ajv2020({ allErrors: true, strict: false, allowUnionTypes: true });
addFormats(ajv);
ajv.addSchema(presentation);
const matches = (schema, value) => ajv.validate(schema, value);
// The data findings of a presentation: every format finding, plus the data advisories of the references and content categories.
const DATA_ADVISORIES = ["chart-value-not-numeric", "chart-mapping-adapted"];
const dataReport = (document) => validate(document, { only: ["format", ...DATA_ADVISORIES.map((code) => `opf/${code}`)] });

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const codes = (issues) => issues.map((issue) => issue.params.code).filter(Boolean);
const ruleCodes = (findings) => findings.map((finding) => finding.ruleId.slice(4));
const deck = (extra) => ({ name: "Data", ...extra });

const revenue = () => ({
  title: "Revenue by quarter",
  columns: ["Quarter", { name: "Revenue", format: "$#,##0.0" }, "Costs"],
  rows: [["Q1", 12, 8], ["Q2", 18, 11], ["Q3", 24, 15]],
  source: { src: "./data/revenue.csv", retrieved: "2026-10-05" },
});

describe("chartNumber: one strict rule", () => {
  const cases = [
    [12, 12], [-3.5, -3.5], [0, 0], ["12", 12], [" 12 ", 12], ["-3.5", -3.5], ["1e6", 1e6], ["2.5E-3", 0.0025],
    ["(5)", null], ["1.234,5", null], ["1,234", null], ["Q1", null], ["12%", null], ["$5", null], ["", null], ["  ", null],
    ["+5", null], [".5", null], ["05", null], ["0x10", null], ["Infinity", null], ["NaN", null],
    [true, null], [false, null], [null, null], [undefined, null], [Number.NaN, null], [Number.POSITIVE_INFINITY, null],
    ["9007199254740993", null], ["1e20", 1e20], ["-2.5e300", -2.5e300], ["1e400", null], [{}, null], [[1], null],
  ];
  for (const [input, expected] of cases) {
    test(`${JSON.stringify(input) ?? String(input)} -> ${String(expected)}`, () => {
      assert.equal(chartNumber(input), expected);
    });
  }

  test("data import measures with the same rule", () => {
    const chart = importData("Quarter,Revenue\nQ1,1e6\nQ2, 12 ", { as: "chart", format: "csv" });
    assert.deepEqual(chart.chart.data.rows, [["Q1", 1e6], ["Q2", 12]]);
    for (const bad of ["12%", "(5)", "1.234,5", "$5", ""]) {
      assert.throws(() => importData({ columns: ["Quarter", "Revenue"], rows: [["Q1", bad]] }, { as: "chart" }), /expected a numeric chart value/);
    }
  });

  test("the API is on the package root and on ./data", () => {
    for (const name of ["chartNumber", "formatDataNumber", "toExcelNumberFormat", "fromExcelNumberFormat", "inlineDatasets", "resolveChartData", "resolveTableData", "tableCellDisplayValue"]) {
      assert.equal(typeof dataEntry[name], "function", name);
    }
  });
});

describe("number formats", () => {
  test("formatDataNumber wraps the variables syntax", () => {
    assert.equal(formatDataNumber(1234.5, "$#,##0.0"), "$1,234.5");
    assert.equal(formatDataNumber(0.314, "0%"), "31%");
    assert.equal(formatDataNumber(0.314, "0.0%"), "31.4%");
    assert.equal(formatDataNumber(1250000, "#,##0 units"), "1,250,000 units");
    assert.equal(formatDataNumber(-5, "$#,##0"), "-$5");
    assert.equal(formatDataNumber(12.5), "12.5");
    assert.equal(formatDataNumber(12.5, "no digits"), "12.5", "an invalid format prints the General form");
  });

  const patterns = ["#,##0", "0", "0.0", "0.00", "0.#", "0.0#", "#.##", "$#,##0.00", "0%", "0.0%", "0.#%", "#,##0.0M", "#,##0 units", "€#,##0", "£#,##0.00", "0,000", "#,###", "x\"y0", "0 \\ k", "0%%", "~0", "(0)", "##,###,##0.000"];
  const samples = [0, 1, -1, 0.5, 12.345, 1234.5, -9876543.21, 0.0049, 1e9];
  for (const pattern of patterns) {
    test(`'${pattern}' round-trips through its Excel code`, () => {
      const code = toExcelNumberFormat(pattern);
      assert.notEqual(code, "General");
      const back = fromExcelNumberFormat(code);
      assert.equal(typeof back, "string", `${code} did not map back`);
      for (const value of samples) assert.deepEqual(formatVariableNumber(value, back), formatVariableNumber(value, pattern), `${pattern} -> ${code} -> ${back} at ${value}`);
    });
  }

  test("Excel codes: literal text is quoted, $ and % are tokens", () => {
    assert.equal(toExcelNumberFormat(), "General");
    assert.equal(toExcelNumberFormat("not a format"), "General");
    assert.equal(toExcelNumberFormat("#,##0"), "#,##0");
    assert.equal(toExcelNumberFormat("$#,##0.00"), "$#,##0.00");
    assert.equal(toExcelNumberFormat("0.0%"), "0.0%");
    assert.equal(toExcelNumberFormat("#,##0.0M"), '#,##0.0"M"');
    assert.equal(toExcelNumberFormat("#,##0 units"), '#,##0 "units"');
    assert.equal(toExcelNumberFormat("€#,##0"), '"€"#,##0');
    assert.equal(toExcelNumberFormat("0.#0"), "0.0#", "decimals are written zeros first");
    assert.equal(toExcelNumberFormat("0,"), "#,##0", "a trailing grouping comma is not an Excel scale");
  });

  test("Excel codes: a literal run stays in one quoted string, so '/' and Excel's special characters are never bare", () => {
    // Native check opf#387: `0.0 "m"/"s"` leaves '/' bare (Excel's fraction bar) and PowerPoint drops the code to General.
    const cases = [
      ["0.0 m/s", '0.0 "m/s"'], ["km/h 0", '"km/h "0'], ["#,##0 items/day", '#,##0 "items/day"'],
      ["0.0 E+3 m", '0.0 "E+3 m"'], ["#,##0 @HQ", '#,##0 "@HQ"'], ["#,##0 *est", '#,##0 "*est"'],
      ["#,##0 net_rev", '#,##0 "net_rev"'], ["#,##0 ok?", '#,##0 "ok?"'], ["0.0% p.a.", '0.0% "p.a."'],
      ["+0.0 pts", '+0.0 "pts"'], ["$#,##0k", '$#,##0"k"'],
    ];
    // Outside quoted strings and backslash escapes only placeholders and characters Excel shows as themselves may remain.
    const bare = (code) => code.replace(/\\./g, "").replace(/"[^"]*"/g, "");
    for (const [format, code] of cases) {
      assert.equal(toExcelNumberFormat(format), code, format);
      assert.match(bare(code), /^[#0,.%$\-+():!^&'~{}<>= ]*$/, `${code} has no bare special character`);
      assert.equal(fromExcelNumberFormat(code), format, `${code} maps back`);
    }
    // A bare '/' is a fraction bar, so a code that has one has no NumberFormat equivalent.
    assert.equal(fromExcelNumberFormat('0.0 "m"/"s"'), undefined);
  });

  test("fromExcelNumberFormat maps exact equivalents only", () => {
    assert.equal(fromExcelNumberFormat("General"), undefined);
    assert.equal(fromExcelNumberFormat(""), undefined);
    assert.equal(fromExcelNumberFormat("0%"), "0%");
    assert.equal(fromExcelNumberFormat('"$"#,##0.00'), "$#,##0.00");
    assert.equal(fromExcelNumberFormat("[$€-407]#,##0"), "€#,##0");
    assert.equal(fromExcelNumberFormat('#,##0" units"'), "#,##0 units");
    for (const code of ["#,##0;(#,##0)", "0.00E+00", "mm/dd/yyyy", "@", "#,##0_);(#,##0)", "[Red]0", "#,##0,", "0%%", '0"%"', "# ?/?", '"No."0', "General;0"]) {
      assert.equal(fromExcelNumberFormat(code), undefined, code);
    }
  });
});

describe("inlineDatasets", () => {
  const source = () => deck({
    datasets: { revenue: revenue(), unused: { columns: ["A"], rows: [] } },
    slides: [
      { title: "Chart", chart: { type: "column", data: { dataset: "revenue", fields: ["Quarter", "Revenue"] }, mapping: { series: ["Revenue"] } } },
      { title: "Table", blocks: [{ table: { dataset: "revenue" } }, { table: { dataset: "missing" } }] },
      { title: "Regions", left: { chart: { type: "line", data: { dataset: "revenue" } } }, right: { text: "x" } },
    ],
  });

  test("is pure and replaces every reference with inline data", () => {
    const input = source();
    const before = structuredClone(input);
    const out = inlineDatasets(input);
    assert.deepEqual(input, before, "the input is not mutated");
    assert.notEqual(out, input);
    assert.deepEqual(out.slides[0].chart.data, {
      columns: ["Quarter", { name: "Revenue", format: "$#,##0.0" }],
      rows: [["Q1", 12], ["Q2", 18], ["Q3", 24]],
      source: { src: "./data/revenue.csv", retrieved: "2026-10-05" },
    });
    assert.deepEqual(out.slides[0].chart.mapping, { series: ["Revenue"] });
    assert.deepEqual(out.slides[1].blocks[0].table, { columns: ["Quarter", { name: "Revenue", format: "$#,##0.0" }, "Costs"], rows: revenue().rows });
    assert.deepEqual(out.slides[1].blocks[1].table, { dataset: "missing" }, "unknown ids are left as they are");
    assert.equal(out.slides[2].left.chart.data.columns.length, 3);
    assert.deepEqual(out.datasets, input.datasets, "datasets stay in place");
    out.slides[1].blocks[0].table.rows[0][1] = 99;
    assert.equal(input.datasets.revenue.rows[0][1], 12, "rows are copies");
    assert.deepEqual(ruleCodes(errorsOf(check(out))), ["dataset-unknown"], "only the unknown reference remains");
  });

  test("a document without datasets comes back equal", () => {
    const input = deck({ slides: [{ title: "x", chart: { type: "column", data: { columns: ["a", "b"], rows: [["x", 1]] } } }] });
    assert.deepEqual(inlineDatasets(input), input);
  });
});

describe("resolveChartData", () => {
  const chart = (data, extra = {}) => ({ type: "column", data, ...extra });

  test("inline data keeps today's positional table", () => {
    const result = resolveChartData(chart({ columns: ["Quarter", "Revenue", "Costs"], rows: [["Q1", 12, "8"], ["Q2", "12%", null]] }));
    assert.equal(result.ok, true);
    assert.deepEqual(result.columns, ["Quarter", "Revenue", "Costs"]);
    assert.deepEqual(result.formats, [undefined, undefined, undefined]);
    assert.deepEqual(result.rows, [["Q1", 12, 8], ["Q2", null, null]]);
    assert.deepEqual(result.diagnostics.map((entry) => [entry.code, entry.path]), [["chart-value-not-numeric", "/data/rows/1/1"]]);
  });

  test("DataColumn formats, source and the category cell as authored", () => {
    const result = resolveChartData(chart({ columns: [{ name: "Year" }, { name: "Revenue", format: "$#,##0" }], rows: [[2024, 5], [true, 6]], source: { src: "a.csv" } }), undefined, { path: "/slides/0/chart" });
    assert.deepEqual(result.columns, ["Year", "Revenue"]);
    assert.deepEqual(result.formats, [undefined, "$#,##0"]);
    assert.deepEqual(result.rows, [[2024, 5], [true, 6]]);
    assert.deepEqual(result.source, { src: "a.csv" });
    assert.equal(result.diagnostics.length, 0);
  });

  test("a dataset reference with fields", () => {
    const document = deck({ datasets: { revenue: revenue() }, slides: [] });
    const result = resolveChartData(chart({ dataset: "revenue", fields: ["Quarter", "Costs", "Revenue"] }), document);
    assert.equal(result.ok, true);
    assert.equal(result.dataset, "revenue");
    assert.deepEqual(result.columns, ["Quarter", "Costs", "Revenue"]);
    assert.deepEqual(result.formats, [undefined, undefined, "$#,##0.0"]);
    assert.deepEqual(result.rows[0], ["Q1", 8, 12]);
    assert.deepEqual(result.source, revenue().source);
  });

  test("unknown datasets, unknown fields and external sources", () => {
    const missing = resolveChartData(chart({ dataset: "nope" }), deck({ slides: [] }), { path: "/c" });
    assert.equal(missing.ok, false);
    assert.equal(missing.reason, "dataset-unknown");
    assert.deepEqual(missing.diagnostics.map((entry) => [entry.code, entry.severity, entry.path]), [["dataset-unknown", "error", "/c/data/dataset"]]);
    const field = resolveChartData(chart({ dataset: "revenue", fields: ["Quarter", "Profit"] }), deck({ datasets: { revenue: revenue() }, slides: [] }));
    assert.equal(field.ok, true);
    assert.deepEqual(field.columns, ["Quarter"]);
    assert.deepEqual(field.diagnostics.map((entry) => [entry.code, entry.path]), [["dataset-field-unknown", "/data/fields/1"]]);
    // A data source by file or asset is not part of the format (opf#240, descoped): such data has no columns.
    const external = resolveChartData(chart({ src: "asset:revenue" }));
    assert.equal(external.ok, false);
    assert.equal(external.reason, "no-columns");
    assert.deepEqual(external.diagnostics, []);
    assert.equal(resolveChartData(chart({ columns: [], rows: [] })).reason, "no-columns");
    assert.equal(resolveChartData(chart({ columns: ["a"], rows: [] })).reason, "no-rows");
    assert.equal(resolveChartData({ type: "column" }).ok, false);
  });

  test("mapping selects and orders columns by name", () => {
    const data = { columns: ["Quarter", "Revenue", "Costs", "Region"], rows: [["Q1", 12, 8, "EMEA"]] };
    const result = resolveChartData(chart(data, { mapping: { category: "Region", series: ["Costs", "Revenue"] } }));
    assert.deepEqual(result.columns, ["Region", "Costs", "Revenue"]);
    assert.deepEqual(result.rows, [["EMEA", 8, 12]]);
    const defaults = resolveChartData(chart(data, { mapping: { category: "Region" } }));
    assert.deepEqual(defaults.columns, ["Region", "Quarter", "Revenue", "Costs"], "series default to every other column");
    assert.deepEqual(defaults.rows, [["EMEA", null, 12, 8]]);
  });

  test("scatter: the X column (default second, or mapped)", () => {
    const data = { columns: ["Name", "Spend", "Revenue", "Margin"], rows: [["A", 1, 10, 0.1], ["B", "2", 20, 0.2]] };
    const positional = resolveChartData({ type: "scatter", data });
    assert.deepEqual(positional.columns, ["Name", "Spend", "Revenue", "Margin"]);
    assert.deepEqual(positional.rows[1], ["B", 2, 20, 0.2]);
    const mapped = resolveChartData({ type: "scatter", data, mapping: { x: "Margin", series: ["Revenue"] } });
    assert.deepEqual(mapped.columns, ["Name", "Margin", "Revenue"]);
    assert.deepEqual(mapped.rows[0], ["A", 0.1, 10]);
    const categorySecond = resolveChartData({ type: "scatter", data, mapping: { category: "Spend" } });
    assert.deepEqual(categorySecond.columns, ["Spend", "Name", "Revenue", "Margin"], "the X column defaults to the first when the category is the second column");
  });

  test("adapted and unknown mapping entries", () => {
    const data = { columns: ["Quarter", "Revenue", "Costs"], rows: [["Q1", 12, 8]] };
    const result = resolveChartData(chart(data, { mapping: { category: "Quarter", x: "Costs", series: ["Quarter", "Revenue", "Revenue", "Profit"] } }), undefined, { path: "/p" });
    assert.deepEqual(result.columns, ["Quarter", "Revenue"]);
    assert.deepEqual(result.diagnostics.map((entry) => [entry.code, entry.severity, entry.path]), [
      ["chart-mapping-adapted", "warning", "/p/mapping/x"],
      ["chart-mapping-adapted", "warning", "/p/mapping/series/0"],
      ["chart-mapping-adapted", "warning", "/p/mapping/series/2"],
      ["chart-mapping-unknown-column", "error", "/p/mapping/series/3"],
    ]);
    const unknownCategory = resolveChartData(chart(data, { mapping: { category: "Year" } }));
    assert.deepEqual(unknownCategory.columns, ["Quarter", "Revenue", "Costs"], "an unknown category falls back to the first column");
    assert.equal(unknownCategory.diagnostics[0].code, "chart-mapping-unknown-column");
    const scatterSame = resolveChartData({ type: "scatter", data, mapping: { x: "Quarter" } });
    assert.equal(scatterSame.diagnostics[0].code, "chart-mapping-adapted");
    assert.deepEqual(scatterSame.columns, ["Quarter", "Revenue", "Costs"]);
    const duplicate = resolveChartData(chart({ columns: ["Q", "A", "A"], rows: [["x", 1, 2]] }, { mapping: { series: ["A"] } }));
    assert.deepEqual(codes(duplicate.diagnostics.map((entry) => ({ params: entry }))), ["data-column-duplicate"]);
  });

  test("a 'var:' cell of a number variable is a gap without a warning before filling", () => {
    const document = deck({ template: true, variables: { revenue: { type: "number", example: 5 }, label: { type: "text", example: "x" } }, slides: [] });
    const result = resolveChartData(chart({ columns: ["a", "b"], rows: [["x", "var:revenue"], ["y", "var:label"]] }), document);
    assert.deepEqual(result.rows, [["x", null], ["y", null]]);
    assert.deepEqual(result.diagnostics.map((entry) => entry.path), ["/data/rows/1/1"]);
  });

  test("a lone column is the chart's values: strict numbers and a warning per non-numeric cell", () => {
    const result = resolveChartData({ type: "histogram", data: { columns: ["Score"], rows: [[4], ["5"], ["12%"], [""], [null]] } });
    assert.deepEqual(result.rows, [[4], [5], [null], [null], [null]]);
    assert.deepEqual(result.diagnostics.map((entry) => [entry.code, entry.path]), [["chart-value-not-numeric", "/data/rows/2/0"]]);
  });
});

describe("resolveTableData and display values", () => {
  test("inline tables: header formats (DataColumn and StyledTableCell)", () => {
    const table = {
      columns: ["Region", { name: "Revenue", format: "$#,##0.0" }, { value: "Growth", style: { align: "right" }, format: "0%" }],
      rows: [["EMEA", 8.2, 0.4], ["APAC", 6.1, { value: 0.52, format: "0.0%" }]],
    };
    const result = resolveTableData(table);
    assert.deepEqual(result.formats, [undefined, "$#,##0.0", "0%"]);
    assert.equal(result.columns, table.columns);
    assert.equal(result.diagnostics.length, 0);
    assert.equal(tableCellDisplayValue(8.2, result.formats[1]), "$8.2");
    assert.equal(tableCellDisplayValue(0.4, result.formats[2]), "40%");
    assert.deepEqual(tableCellDisplayValue(table.rows[1][2], result.formats[2]), { value: "52.0%", format: "0.0%" }, "a cell's own format wins");
    assert.equal(tableCellDisplayValue("EMEA", "$#,##0"), "EMEA");
    assert.equal(tableCellDisplayValue(null, "$#,##0"), null);
    assert.equal(tableCellDisplayValue(true, "$#,##0"), true);
    assert.equal(tableCellDisplayValue(12), 12);
    const rich = [{ text: "12", bold: true }];
    assert.equal(tableCellDisplayValue(rich, "0%"), rich);
    assert.equal(tableCellDisplayValue(12, "bad"), 12, "an invalid format leaves the value unchanged");
  });

  test("dataset tables take headers, rows and formats from the dataset", () => {
    const document = deck({ datasets: { revenue: revenue() }, slides: [] });
    const result = resolveTableData({ dataset: "revenue", fields: ["Revenue", "Quarter"] }, document);
    assert.equal(result.dataset, "revenue");
    assert.deepEqual(result.columns, [{ name: "Revenue", format: "$#,##0.0" }, "Quarter"]);
    assert.deepEqual(result.rows[2], [24, "Q3"]);
    assert.deepEqual(result.formats, ["$#,##0.0", undefined]);
    const missing = resolveTableData({ dataset: "nope" }, document, { path: "/t" });
    assert.deepEqual(missing.diagnostics.map((entry) => [entry.code, entry.path]), [["dataset-unknown", "/t/dataset"]]);
    assert.deepEqual(missing.rows, []);
  });
});

describe("validation findings", () => {
  const issues = (document) => {
    const result = dataReport(document);
    const pairs = (list) => list.map((finding) => [finding.ruleId.slice(4), finding.path]);
    return { valid: result.valid, errors: pairs(errorsOf(result)), warnings: pairs(warningsOf(result)) };
  };

  test("a deck using every new field validates cleanly", () => {
    const document = deck({
      datasets: { revenue: revenue() },
      slides: [
        { title: "Chart", chart: { type: "column", data: { dataset: "revenue", fields: ["Quarter", "Revenue", "Costs"] }, mapping: { category: "Quarter", series: ["Costs", "Revenue"] } } },
        { title: "Inline", chart: { type: "line", data: { columns: ["Quarter", { name: "Margin", format: "0%" }], rows: [["Q1", 0.31], ["Q2", "0.34"]], source: { src: "./margin.csv", sheet: "Sheet1", range: "A1:B3", fields: ["Quarter", "Margin"], retrieved: "2026-10-05T09:30:00Z", description: "Finance export" } } } },
        { title: "Table", table: { dataset: "revenue", fields: ["Quarter", "Revenue"] } },
        { title: "Formats", table: { columns: ["Region", { name: "Revenue", format: "$#,##0.0" }, { value: "Growth", style: { align: "right" }, format: "0%" }], rows: [["EMEA", 8.2, 0.4], ["APAC", 6.1, { value: 0.52, format: "0.0%" }]] } },
      ],
    });
    assert.deepEqual(issues(document), { valid: true, errors: [], warnings: [] });
    const full = validate(document, { only: ["format", "references", "content"] });
    assert.equal(full.valid, true);
    assert.deepEqual(full.findings, []);
  });

  test("the new schema definitions' examples validate", () => {
    const defs = presentation.$defs;
    let checked = 0;
    for (const name of ["NumberFormat", "DataColumn", "DataSourceRef", "DatasetId", "DatasetFields", "Datasets", "Dataset", "DatasetRef", "ChartMapping"]) {
      const schema = { $ref: `${presentation.$id}#/$defs/${name}` };
      const examples = [...(defs[name].examples ?? []), ...Object.values(defs[name].properties ?? {}).flatMap((property) => property.$ref ? [] : (property.examples ?? []).map((example) => ({ property, example })))];
      for (const entry of defs[name].examples ?? []) {
        assert.equal(matches(schema, entry), true, `${name}: ${JSON.stringify(entry)}`);
        checked++;
      }
      assert.ok(examples.length > 0, `${name} has examples`);
    }
    for (const [name, property] of [["ChartData", "columns"], ["Dataset", "columns"], ["Dataset", "rows"]]) {
      for (const entry of defs[name].properties[property].examples) {
        assert.equal(matches({ $ref: `${presentation.$id}#/$defs/${name}/properties/${property}` }, entry), true, `${name}.${property}`);
        checked++;
      }
    }
    assert.ok(checked >= 20);
  });

  test("schema: inline and dataset-backed tables are exclusive", () => {
    assert.equal(check(deck({ datasets: { r: revenue() }, slides: [{ table: { dataset: "r", rows: [["x"]] } }] })).valid, false);
    assert.equal(check(deck({ datasets: { r: revenue() }, slides: [{ table: { dataset: "r", columns: ["x"] } }] })).valid, false);
    assert.equal(check(deck({ slides: [{ table: { rows: [["x"]], fields: ["x"] } }] })).valid, false);
    assert.equal(check(deck({ slides: [{ table: { columns: ["x"] } }] })).valid, false, "an inline table still needs rows");
    assert.equal(check(deck({ datasets: { "bad id": revenue() }, slides: [{ title: "x" }] })).valid, false);
    assert.equal(check(deck({ slides: [{ chart: { type: "column", data: { dataset: "r", rows: [] } } }] })).valid, false);
    assert.equal(check(deck({ slides: [{ chart: { type: "column", data: { columns: ["a"], rows: [["x"]], source: { src: "a", retrieved: "yesterday" } } } }] })).valid, false);
  });

  test("every error code", () => {
    const document = deck({
      datasets: {
        dup: { columns: ["A", "A", { name: "B", format: "bad" }], rows: [] },
        ok: revenue(),
      },
      slides: [
        { title: "unknown dataset", chart: { type: "column", data: { dataset: "nope" } } },
        { title: "unknown field", table: { dataset: "ok", fields: ["Quarter", "Profit"] } },
        { title: "mapping", chart: { type: "column", data: { columns: ["Q", "R", "R"], rows: [["x", 1, 2]] }, mapping: { series: ["Profit"] } } },
        { title: "cell format", table: { columns: [{ name: "a", format: "%" }], rows: [[{ value: 1, format: "units" }]] } },
        { title: "uses dup", chart: { type: "column", data: { dataset: "dup" } } },
      ],
    });
    const result = issues(document);
    assert.equal(result.valid, false);
    assert.deepEqual(result.errors.sort(), [
      ["chart-mapping-unknown-column", "/slides/2/chart/mapping/series/0"],
      ["data-column-duplicate", "/datasets/dup/columns/1"],
      ["data-column-duplicate", "/slides/2/chart/data/columns/2"],
      ["dataset-field-unknown", "/slides/1/table/fields/1"],
      ["dataset-unknown", "/slides/0/chart/data/dataset"],
      ["number-format-invalid", "/datasets/dup/columns/2/format"],
      ["number-format-invalid", "/slides/3/table/columns/0/format"],
      ["number-format-invalid", "/slides/3/table/rows/0/0/format"],
    ].sort());
    const full = validate(document, { only: ["format", "references"] });
    const ruleIds = new Set(full.findings.map((entry) => entry.ruleId));
    for (const code of ["dataset-unknown", "dataset-field-unknown", "data-column-duplicate", "chart-mapping-unknown-column", "number-format-invalid"]) {
      assert.ok(ruleIds.has(`opf/${code}`), code);
      assert.ok(full.findings.filter((entry) => entry.ruleId === `opf/${code}`).every((entry) => entry.severity === "error" && entry.category === "format"), code);
    }
  });

  test("every warning code, and opf/unused-dataset", () => {
    const document = deck({
      datasets: { spare: { columns: ["A"], rows: [] }, used: revenue() },
      slides: [
        { title: "numbers", chart: { type: "column", data: { columns: ["Q", "R"], rows: [["Q1", "12%"], ["Q2", null], ["Q3", ""], ["Q4", "1e3"]] } } },
        { title: "adapted", chart: { type: "column", data: { dataset: "used" }, mapping: { x: "Costs", series: ["Quarter"] } } },
      ],
      assets: { revenue: { src: "./revenue.csv", mediaType: "text/csv" } },
    });
    const result = issues(document);
    assert.equal(result.valid, true);
    assert.deepEqual(result.warnings, [
      ["chart-value-not-numeric", "/slides/0/chart/data/rows/0/1"],
      ["chart-mapping-adapted", "/slides/1/chart/mapping/x"],
      ["chart-mapping-adapted", "/slides/1/chart/mapping/series/0"],
    ]);
    const full = validate(document, { only: ["format", "references", "content"] });
    // Findings are ordered by slide (document-level ones first), then category, then rule.
    assert.deepEqual(full.findings.map((entry) => [entry.ruleId, entry.severity, entry.category, entry.path]), [
      ["opf/unused-dataset", "warning", "references", "/datasets/spare"],
      ["opf/chart-value-not-numeric", "warning", "content", "/slides/0/chart/data/rows/0/1"],
      ["opf/chart-mapping-adapted", "warning", "content", "/slides/1/chart/mapping/x"],
      ["opf/chart-mapping-adapted", "warning", "content", "/slides/1/chart/mapping/series/0"],
    ]);
  });

  test("a template's number variable in a chart cell does not warn", () => {
    const template = JSON.parse(readFileSync(path.join(repoRoot, "docs/fixtures/template-quarterly-review.opf.json"), "utf8"));
    const result = dataReport(template);
    assert.equal(result.valid, true);
    assert.deepEqual(ruleCodes(warningsOf(result)).filter((code) => code === "chart-value-not-numeric"), []);
    const filled = resolveVariables(template, { client: "Acme", revenue: 1500000, kickoff: "2026-10-01", wins: ["A"], headline: "x" });
    const chart = filled.presentation.slides.find((slide) => slide.id === "revenue").chart;
    assert.deepEqual(resolveChartData(chart).rows, [["Previous", 1100000], ["This quarter", 1500000]]);
  });

  test("variables fill dataset rows", () => {
    const document = deck({
      variables: { q4: { type: "number", value: 31 }, unit: { type: "text", value: "USD" } },
      datasets: { r: { title: "Revenue ({{unit}})", columns: ["Q", "R"], rows: [["Q3", 24], ["Q4", "var:q4"]] } },
      slides: [{ title: "x", chart: { type: "column", data: { dataset: "r" } } }],
    });
    assert.deepEqual(ruleCodes(warningsOf(dataReport(document))), []);
    const filled = resolveVariables(document).presentation;
    assert.deepEqual(filled.datasets.r.rows[1], ["Q4", 31]);
    assert.equal(filled.datasets.r.title, "Revenue (USD)");
    assert.deepEqual(resolveChartData(filled.slides[0].chart, filled).rows[1], ["Q4", 31]);
  });

  test("every existing example and fixture gains no data error", () => {
    const files = [];
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const file = path.join(dir, name);
        if (statSync(file).isDirectory()) walk(file);
        else if (name.endsWith(".opf.json")) files.push(file);
      }
    };
    walk(path.join(repoRoot, "examples"));
    walk(path.join(repoRoot, "docs/fixtures"));
    assert.ok(files.length > 50);
    const dataCodes = new Set(["dataset-unknown", "dataset-field-unknown", "data-column-duplicate", "chart-mapping-unknown-column", "number-format-invalid", "chart-value-not-numeric", "chart-mapping-adapted"]);
    for (const file of files) {
      const result = dataReport(JSON.parse(readFileSync(file, "utf8")));
      assert.deepEqual(result.findings.filter((entry) => dataCodes.has(entry.ruleId.slice(4))).filter((entry) => entry.severity !== "info"), [], path.relative(repoRoot, file));
    }
  });
});

describe("core integration", () => {
  const datasetDeck = (rows = revenue().rows) => deck({
    datasets: { revenue: { ...revenue(), rows } },
    slides: [{ title: "Revenue", table: { dataset: "revenue" } }, { title: "Chart", chart: { type: "column", data: { dataset: "revenue" } } }],
  });

  test("layoutTable measures dataset tables and formatted text", () => {
    const document = datasetDeck();
    const layout = layoutTable({ dataset: "revenue" }, { x: 0, y: 0, width: 900, height: 400 }, { presentation: document });
    assert.equal(layout.rows.length, 4);
    assert.equal(layout.columnCount, 3);
    assert.equal(layout.rows[0].cells[1].value, "Revenue");
    assert.equal(layout.rows[0].cells[1].path, "table.columns.1.name");
    assert.equal(layout.rows[1].cells[1].value, "$12.0");
    assert.equal(layout.rows[1].cells[1].input, 12);
    assert.equal(layout.rows[1].cells[2].value, 8, "a column without a format keeps its value");
    const styled = layoutTable({ columns: ["a", { value: "b", format: "0%" }], rows: [[1, 0.5], [2, { value: 0.25, format: "0.0%", style: { align: "right" } }]] }, { x: 0, y: 0, width: 600, height: 300 });
    assert.equal(styled.rows[1].cells[1].value, "50%");
    assert.equal(styled.rows[2].cells[1].value, "25.0%");
    assert.equal(styled.rows[2].cells[1].style.align, "right");
    assert.equal(styled.rows[0].cells[1].value, "b");
  });

  test("composeSlide composes dataset charts and tables from their inline copy", () => {
    const document = datasetDeck();
    const table = composeSlide(document.slides[0], { presentation: document }).items.find((item) => item.field === "table");
    assert.deepEqual(table.value.rows, revenue().rows);
    const chart = composeSlide(document.slides[1], { presentation: document }).items.find((item) => item.field === "chart");
    assert.equal(chart.value.data.columns.length, 3);
  });

  test("pagination splits a long dataset table", () => {
    const rows = Array.from({ length: 40 }, (_, index) => [`Q${index + 1}`, index * 1000.5, index]);
    const result = paginate(datasetDeck(rows));
    const tables = result.presentation.slides.filter((slide) => slide.table).map((slide) => slide.table);
    assert.ok(tables.length > 1, "the table is split");
    assert.deepEqual(tables.flatMap((table) => table.rows), rows);
    assert.ok(tables.every((table) => table.columns[1].format === "$#,##0.0"));
    assert.equal(check(result.presentation).valid, true);
  });

  test("markdown keeps datasets, formats, mapping and source", () => {
    const document = deck({
      datasets: { revenue: revenue() },
      slides: [
        { title: "Chart", chart: { type: "column", data: { dataset: "revenue" }, mapping: { series: ["Costs"] } } },
        { title: "Inline", chart: { type: "line", data: { columns: ["Quarter", { name: "Margin", format: "0%" }], rows: [["Q1", 0.31]], source: { src: "./m.csv" } } } },
        { title: "Table", table: { columns: ["Region", { name: "Revenue", format: "$#,##0" }], rows: [["EMEA", { value: "8", format: "0" }]] } },
        { title: "Data table", table: { dataset: "revenue", fields: ["Quarter"] } },
      ],
    });
    const { markdown, report } = toMarkdown(document);
    assert.equal(report.lossless, true);
    const back = fromMarkdown(markdown);
    assert.equal(back.valid, true, JSON.stringify(back.diagnostics));
    assert.deepEqual(back.presentation, document);
  });

  test("conversions keep dataset references and formats", () => {
    const document = datasetDeck();
    const toTable = convertContent({ chart: { type: "column", data: { dataset: "revenue", fields: ["Quarter", "Revenue"] }, mapping: { series: ["Revenue"] } } }, "table", { presentation: document });
    assert.deepEqual(toTable.payload.table, { dataset: "revenue", fields: ["Quarter", "Revenue"] });
    assert.ok(toTable.loss.some((entry) => /mapping/.test(entry)));
    const toChart = convertContent({ table: { dataset: "revenue" } }, "chart", { presentation: document });
    assert.deepEqual(toChart.payload.chart, { type: "column", data: { dataset: "revenue" } });
    const inline = convertContent({ table: { columns: ["Quarter", { name: "Revenue", format: "$#,##0" }], rows: [["Q1", "1e3"], ["Q2", 5]] } }, "chart");
    assert.deepEqual(inline.payload.chart.data, { columns: ["Quarter", { name: "Revenue", format: "$#,##0" }], rows: [["Q1", 1000], ["Q2", 5]] });
    const back = convertContent({ chart: { type: "column", data: { columns: ["Q", { name: "R", format: "0%" }], rows: [["Q1", 0.5]], source: { src: "x.csv" } } } }, "table");
    assert.deepEqual(back.payload.table, { columns: ["Q", { name: "R", format: "0%" }], rows: [["Q1", 0.5]] });
    assert.ok(back.loss.some((entry) => /source/.test(entry)));
    const list = convertContent({ table: { dataset: "revenue", fields: ["Quarter"] } }, "list", { presentation: document });
    assert.deepEqual(list.payload.items, ["Q1", "Q2", "Q3"]);
    assert.throws(() => convertContent({ table: { dataset: "revenue" } }, "list"), /options\.presentation/);
    const formatted = convertContent({ table: { columns: [{ name: "Region" }, { name: "Revenue", format: "$#,##0" }], rows: [["EMEA", 8]] } }, "list");
    assert.ok(formatted.loss.some((entry) => /number formats/.test(entry)));
    assert.throws(() => convertContent({ table: { columns: ["Q", "R"], rows: [["Q1", "12%"]] } }, "chart"), /not a number/);
  });

  test("format orders the new keys by the schema", () => {
    const text = format({ slides: [{ chart: { mapping: { series: ["R"] }, data: { source: { src: "a" }, rows: [["x", 1]], columns: ["Q", { format: "0", name: "R" }] }, type: "column" } }], datasets: { r: { rows: [], columns: ["a"], title: "t" } }, name: "x" });
    const parsed = JSON.parse(text);
    assert.deepEqual(Object.keys(parsed), ["name", "slides", "datasets"]);
    assert.deepEqual(Object.keys(parsed.slides[0].chart), ["type", "data", "mapping"]);
    assert.deepEqual(Object.keys(parsed.slides[0].chart.data), ["columns", "rows", "source"]);
    assert.deepEqual(Object.keys(parsed.slides[0].chart.data.columns[1]), ["name", "format"]);
    assert.deepEqual(Object.keys(parsed.datasets.r), ["title", "columns", "rows"]);
  });

  test("the chart colour rule reads DataColumn names and dataset charts", () => {
    const columns = ["Quarter", ...Array.from({ length: 12 }, (_, index) => ({ name: `Series ${index + 1}`, format: "0" }))];
    const document = deck({
      datasets: { wide: { columns, rows: [["Q1", ...Array(12).fill(1)]] } },
      slides: [
        { title: "Inline", chart: { type: "column", data: { columns, rows: [["Q1", ...Array(12).fill(1)]] } } },
        { title: "Dataset", chart: { type: "column", data: { dataset: "wide" } } },
        { title: "Table", table: { columns: [{ name: "Region" }, "Value"], rows: [["EMEA", 1]] } },
      ],
    });
    const report = validate(document, { only: ["opf/chart-color-only"] });
    const colour = report.findings.filter((entry) => entry.ruleId === "opf/chart-color-only");
    assert.ok(colour.some((entry) => entry.path === "/slides/0/chart" && entry.message.includes('"Series 2"')), JSON.stringify(report.findings.map((entry) => entry.ruleId)));
    assert.ok(colour.some((entry) => entry.path === "/slides/1/chart"));
    assert.ok(!report.findings.some((entry) => /object Object/.test(entry.message)));
  });

  test("diff reports dataset changes in their own category", () => {
    const a = datasetDeck();
    const b = structuredClone(a);
    b.datasets.revenue.rows[0][1] = 13;
    const result = diff(a, b);
    assert.equal(result.summary.byCategory.datasets, 1);
    assert.ok(result.changes.every((change) => change.category === "datasets"));
  });
});

describe("RR-54 review", () => {
  test("Excel placeholders: '#' before '0' on export; ambiguous orders are not imported", () => {
    // NumberFormat counts zeros; Excel reads placeholders by position, so '0#' is written as '#0'.
    assert.equal(toExcelNumberFormat("0#"), "#0");
    assert.equal(toExcelNumberFormat("0#0"), "#00");
    assert.equal(formatDataNumber(5, "0#"), formatDataNumber(5, "#0"));
    assert.equal(fromExcelNumberFormat(toExcelNumberFormat("0#")), "#0");
    for (const code of ["0#", "#0#", "0.#0", "0,0#", "#,##0.0#0"]) assert.equal(fromExcelNumberFormat(code), undefined, code);
    for (const code of ["#,##0", "0", "#", "0.##", "#,##0.00", "0.0%", "###0", ".00"]) assert.equal(fromExcelNumberFormat(code), code, code);
  });

  test("schema errors name the one form the value chose", () => {
    // The raw schema path: a finding's own path also names the offending property.
    const errors = (document) => errorsOf(check(document)).map((issue) => [issue.validation.path, issue.message]);
    const datasets = { r: revenue() };
    // chart.data: a 'dataset' key selects DatasetRef, 'rows' ChartData ('columns' alone is either).
    assert.deepEqual(errors(deck({ datasets, slides: [{ chart: { type: "column", data: { dataset: "r", fields: [] } } }] })), [
      ["/slides/0/chart/data/fields", "must NOT have fewer than 1 items"],
    ]);
    assert.deepEqual(errors(deck({ datasets, slides: [{ chart: { type: "column", data: { dataset: "r", columns: ["a"] } } }] })), [
      ["/slides/0/chart/data", "must NOT have additional properties"],
    ]);
    assert.deepEqual(errors(deck({ slides: [{ chart: { type: "column", data: { columns: ["a", "b"], rows: [["x", 1]], source: { src: "a", retrieved: "yesterday" } } } }] })).map(([path]) => path), [
      "/slides/0/chart/data/source/retrieved", "/slides/0/chart/data/source/retrieved", "/slides/0/chart/data/source/retrieved",
    ]);
    // ChartDataSource is gone: a data source by asset or file is an unknown key on inline data, and 'rows' picks the inline form.
    assert.deepEqual(errors(deck({ slides: [{ chart: { type: "column", data: { src: "asset:x", rows: [["a"]] } } }] })), [
      ["/slides/0/chart/data", "must have required property 'columns'"],
      ["/slides/0/chart/data", "must NOT have additional properties"],
    ]);
    assert.equal(check(deck({ slides: [{ chart: { type: "column", data: { src: "asset:x", columns: ["a"] } } }] })).valid, false);
    // A table header object: 'value' selects StyledTableCell, 'name' DataColumn.
    assert.deepEqual(errors(deck({ slides: [{ table: { columns: [{ name: "R", style: { align: "right" } }], rows: [[1]] } }] })), [
      ["/slides/0/table/columns/0", "must NOT have additional properties"],
    ]);
    // Dataset-backed and inline tables: the exclusive fields are named.
    const table = (value) => errors(deck({ datasets, slides: [{ table: value }] }));
    assert.deepEqual(table({ dataset: "r", rows: [] }), [["/slides/0/table/rows", "'rows' is not allowed on a dataset-backed table: it takes its headers, rows and column formats from the dataset"]]);
    assert.deepEqual(table({ dataset: "r", columns: ["a"] }), [["/slides/0/table/columns", "'columns' is not allowed on a dataset-backed table: it takes its headers, rows and column formats from the dataset"]]);
    assert.deepEqual(table({ rows: [["a"]], fields: ["a"] }), [["/slides/0/table/fields", "'fields' applies only to a dataset-backed table; add 'dataset' or remove 'fields'"]]);
    // A malformed value with no form key keeps every alternative.
    assert.ok(errors(deck({ slides: [{ chart: { type: "column", data: { values: [] } } }] })).some(([, message]) => message === "must match exactly one schema in oneOf"));
  });

  test("fields name each dataset column at most once", () => {
    const datasets = { r: revenue() };
    const fields = (document) => errorsOf(check(document)).map((issue) => [issue.validation.path, issue.message]);
    assert.deepEqual(fields(deck({ datasets, slides: [{ table: { dataset: "r", fields: ["Quarter", "Quarter"] } }] })), [
      ["/slides/0/table/fields", "must NOT have duplicate items (items ## 1 and 0 are identical)"],
    ]);
    assert.deepEqual(fields(deck({ datasets, slides: [{ chart: { type: "column", data: { dataset: "r", fields: ["Quarter", "Revenue", "Revenue"] } } }] })), [
      ["/slides/0/chart/data/fields", "must NOT have duplicate items (items ## 2 and 1 are identical)"],
    ]);
  });
});

describe("suggestChartNumberFix: migration help for the strict number rule", () => {
  const chart = (rows, columns = ["Q", "V"]) => ({ type: "column", data: { columns, rows } });
  const fixOf = (rows, columns) => suggestChartNumberFix(chart(rows, columns));
  const values = (fix) => fix.patches.slice(0, -1).map((patch) => patch.value);

  test("one display style becomes numbers and the column format that shows the same text", () => {
    const percent = fixOf([["Q1", "12%"], ["Q2", "8.5%"], ["Q3", null], ["Q4", ""], ["Q5", " -3% "]]);
    assert.equal(percent.format, "0.#%");
    assert.equal(percent.column, 1);
    assert.equal(percent.name, "V");
    assert.deepEqual(values(percent), [0.12, 0.085, -0.03]);
    assert.deepEqual(percent.patches.map((patch) => patch.path), ["/data/rows/0/1", "/data/rows/1/1", "/data/rows/4/1", "/data/columns/1"]);
    assert.deepEqual(percent.patches.at(-1), { op: "replace", path: "/data/columns/1", value: { name: "V", format: "0.#%" } });
    const currency = fixOf([["Q1", "$1,234"], ["Q2", "$56"], ["Q3", "-$7,000"]]);
    assert.equal(currency.format, "$#,##0");
    assert.deepEqual(values(currency), [1234, 56, -7000]);
    const grouped = fixOf([["Q1", "1,234.5"], ["Q2", "999"], ["Q3", 12.25]]);
    assert.equal(grouped.format, "#,##0.##");
    assert.deepEqual(values(grouped), [1234.5], "number cells and strict decimal strings are kept");
    assert.equal(fixOf([["Q1", "€5.50"], ["Q2", "€7.25"]]).format, "€0.00");
    assert.equal(fixOf([["Q1", "£1,000,000"]]).format, "£#,##0");
    // Applying the fix leaves no warning and displays every value as it was written.
    const fixed = chart([["Q1", "12%"], ["Q2", "8.5%"]]);
    const applied = applyPatch(fixed, fixOf(fixed.data.rows).patches);
    const resolved = resolveChartData(applied);
    assert.deepEqual(resolved.diagnostics, []);
    assert.deepEqual(resolved.rows.map((row) => formatDataNumber(row[1], resolved.formats[1])), ["12%", "8.5%"]);
  });

  test("never a guess", () => {
    const none = [
      [["Q1", "12%"], ["Q2", "$5"]], // mixed styles
      [["Q1", "12%"], ["Q2", 0.5]], // a number beside percent text: 0.5 or 50%?
      [["Q1", "(5)"], ["Q2", "(7)"]], // accounting negatives
      [["Q1", "1.234,5"]], // decimal comma
      [["Q1", "1,234"], ["Q2", "5678"]], // mixed grouping
      [["Q1", "$5"], ["Q2", "$5.50"]], // 5 and 5.50 need different decimals
      [["Q1", "$-5"]], // the format writes -$5
      [["Q1", "12 %"]], [["Q1", "5 units"]], [["Q1", ".5%"]], [["Q1", "007%"]], [["Q1", "1,23"]], [["Q1", "Q1"]], [["Q1", true]],
      [["Q1", 12], ["Q2", "18"]], // nothing to fix
    ];
    for (const rows of none) assert.equal(fixOf(rows), undefined, JSON.stringify(rows));
    assert.equal(suggestChartNumberFix(chart([["Q1", "12%"]], ["Q", { name: "V", format: "0%" }])), undefined, "a column that already has a format");
    assert.equal(suggestChartNumberFix({ type: "column", data: { src: "x.csv" } }), undefined);
  });

  test("columns, mapping, datasets and findings", () => {
    const two = chart([["Q1", "5%", "$1"], ["Q2", "6%", "$2"]], ["Q", "A", "B"]);
    assert.equal(suggestChartNumberFix(two).name, "A");
    assert.equal(suggestChartNumberFix(two, undefined, { column: "B" }).format, "$0");
    assert.equal(suggestChartNumberFix(two, undefined, { column: 2 }).name, "B");
    assert.equal(suggestChartNumberFix({ ...two, mapping: { category: "A" } }).name, "B", "the category column is never a value column");
    const document = deck({
      datasets: { r: { columns: ["Quarter", { name: "Margin" }], rows: [["Q1", "31%"], ["Q2", "34.5%"]] } },
      slides: [{ title: "Margin", blocks: [{ chart: { type: "line", data: { dataset: "r" } } }] }, { title: "Table", table: { dataset: "r" } }],
    });
    const fix = suggestChartNumberFix(document.slides[0].blocks[0].chart, document, { path: "/slides/0/blocks/0/chart" });
    assert.deepEqual(fix.patches, [
      { op: "replace", path: "/datasets/r/rows/0/1", value: 0.31 },
      { op: "replace", path: "/datasets/r/rows/1/1", value: 0.345 },
      { op: "replace", path: "/datasets/r/columns/1", value: { name: "Margin", format: "0.#%" } },
    ]);
    const before = layoutTable(document.slides[1].table, { x: 0, y: 0, width: 800, height: 400 }, { presentation: document }).rows.map((row) => row.cells.map((cell) => cell.value));
    const after = applyPatch(document, fix.patches);
    assert.deepEqual(layoutTable(after.slides[1].table, { x: 0, y: 0, width: 800, height: 400 }, { presentation: after }).rows.map((row) => row.cells.map((cell) => cell.value)), before, "a table of the same dataset shows the same text");
    // validate carries the fix on every cell of the column, and none where there is no exact fix.
    const lintDocument = deck({ slides: [{ title: "x", chart: chart([["Q1", "12%"], ["Q2", "8.5%"], ["Q3", "n/a"]]) }, { title: "y", chart: chart([["Q1", "12%"], ["Q2", "8.5%"]]) }] });
    const fixed = validate(lintDocument, { only: ["opf/chart-value-not-numeric"] });
    const warnings = fixed.findings.filter((entry) => entry.ruleId === "opf/chart-value-not-numeric");
    assert.deepEqual(warnings.map((entry) => [entry.path, entry.fixes?.[0]?.id]), [
      ["/slides/0/chart/data/rows/0/1", undefined],
      ["/slides/0/chart/data/rows/1/1", undefined],
      ["/slides/0/chart/data/rows/2/1", undefined],
      ["/slides/1/chart/data/rows/0/1", "store-chart-numbers"],
      ["/slides/1/chart/data/rows/1/1", "store-chart-numbers"],
    ]);
    const [lintFix] = warnings[3].fixes;
    assert.equal(lintFix.kind, "patch");
    assert.ok(lintFix.title.length > 0);
    assert.equal(lintFix.safe, false);
    assert.match(warnings[3].help, /"0\.#%"/);
    const repaired = applyPatch(lintDocument, lintFix.patch);
    assert.deepEqual(validate(repaired, { only: ["opf/chart-value-not-numeric"] }).findings.map((entry) => entry.path), warnings.slice(0, 3).map((entry) => entry.path));
    assert.equal(dataEntry.suggestChartNumberFix, suggestChartNumberFix);
  });
});

describe("XY charts with two columns", () => {
  test("the second column is the one series against row numbers; X needs three or more columns", () => {
    const two = resolveChartData({ type: "scatter", data: { columns: ["Point", "Revenue"], rows: [["A", 10], ["B", "20"]] } });
    assert.deepEqual([two.columns, two.hasX, two.rows], [["Point", "Revenue"], false, [["A", 10], ["B", 20]]]);
    assert.deepEqual(two.diagnostics, []);
    const three = resolveChartData({ type: "scatter", data: { columns: ["Point", "Spend", "Revenue"], rows: [["A", 1, 10]] } });
    assert.deepEqual([three.columns, three.hasX], [["Point", "Spend", "Revenue"], true]);
    assert.equal(resolveChartData({ type: "column", data: { columns: ["Q", "A", "B"], rows: [["Q1", 1, 2]] } }).hasX, false);
    // An explicit X that leaves no series is plotted as the series, with a warning.
    const mapped = resolveChartData({ type: "scatter", data: { columns: ["Point", "Revenue"], rows: [["A", 10]] }, mapping: { x: "Revenue" } });
    assert.deepEqual([mapped.columns, mapped.hasX], [["Point", "Revenue"], false]);
    assert.deepEqual(mapped.diagnostics.map((entry) => [entry.code, entry.path]), [["chart-mapping-adapted", "/mapping/x"]]);
    const onlyX = resolveChartData({ type: "scatter", data: { columns: ["Point", "Spend", "Revenue"], rows: [["A", 1, 10]] }, mapping: { x: "Spend", series: ["Spend"] } });
    assert.deepEqual([onlyX.columns, onlyX.hasX], [["Point", "Spend"], false]);
  });
});
