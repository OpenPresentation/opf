import assert from "node:assert/strict";
import { test } from "node:test";

import { validate } from "../dist/index.js";
import { fromMarkdown, toMarkdown } from "../dist/markdown.js";
import { check, errorsOf } from "./support/validation.mjs";

// FA-27: Table.alt is the table's text alternative, the counterpart of Chart.alt (FA-09). It is optional, validate never asks for it,
// and the Markdown dialect round trips it (a pipe table has no syntax for it, so it rides in an opf-block).

const table = { columns: ["Region", "Q4"], rows: [["North America", 18.1], ["EMEA", 11.5]] };
const deck = (extra) => ({ name: "Table alt", language: "en-US", slides: [{ title: "Revenue", table: { ...table, ...extra } }] });

test("the schema accepts a string alt on an inline and a dataset table, and rejects anything else", () => {
  assert.deepEqual(errorsOf(check(deck({ alt: "North America leads EMEA, $18.1M against $11.5M in Q4." }))), []);
  assert.deepEqual(errorsOf(check(deck({ alt: "" }))), []);
  const dataset = { name: "Table alt", datasets: { revenue: { columns: ["Region", "Q4"], rows: [["North America", 18.1]] } }, slides: [{ title: "Revenue", table: { dataset: "revenue", alt: "Q4 revenue by region." } }] };
  assert.deepEqual(errorsOf(check(dataset)), []);
  assert.ok(errorsOf(check(deck({ alt: 5 }))).length > 0);
});

test("validate neither asks for a table alt nor reports an empty one", () => {
  const plain = validate(deck({}));
  for (const alt of [undefined, "Q4 revenue by region.", ""]) {
    const report = validate(deck(alt === undefined ? {} : { alt }));
    assert.deepEqual(report.findings.map((finding) => finding.ruleId), plain.findings.map((finding) => finding.ruleId), JSON.stringify(alt));
  }
  assert.ok(!plain.findings.some((finding) => /alt|text-alternative/.test(finding.ruleId)), "a table without alt raises no alt finding");
});

test("a table still satisfies a chart's text alternative, with or without its own alt", () => {
  const chart = { type: "column", data: { columns: ["Q", "V"], rows: [["Q1", 1]] } };
  for (const alt of [undefined, "Q1 value."]) {
    const document = { name: "x", language: "en-US", slides: [{ title: "T", blocks: [{ chart }, { table: { ...table, ...(alt === undefined ? {} : { alt }) } }] }] };
    assert.deepEqual(validate(document, { only: ["opf/chart-text-alternative"] }).findings, []);
  }
});

test("Markdown round trips a table alt, and a table without one stays a pipe table", () => {
  for (const alt of ["North America leads EMEA in Q4.", "", 'Says "up", 5 | 6']) {
    const document = { slides: [{ title: "Revenue", table: { ...table, alt } }] };
    const { markdown, report } = toMarkdown(document);
    assert.equal(report.lossless, true);
    assert.deepEqual(fromMarkdown(markdown).presentation, document, markdown);
  }
  const plain = toMarkdown({ slides: [{ title: "Revenue", table: { columns: ["A", "B"], rows: [["x", "y"]] } }] });
  assert.equal(plain.report.native, true);
  assert.match(plain.markdown, /\| A \| B \|/);
});
