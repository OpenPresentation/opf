// SH-25: format/reference identity checks stay lazy; geometry remains a separate requested audit.
import assert from "node:assert/strict";
import { test } from "node:test";
import { validate } from "../dist/index.js";
const chart = {
  type: "column",
  alt: "Costs",
  data: {
    columns: ["Country", "Cost"],
    rows: [
      ["US", 20],
      ["FR", 8],
    ],
  },
};
const anchored = (point) => ({
  language: "en-US",
  slides: [
    {
      title: "Cost comparison",
      blocks: [{ id: "costs", chart }],
      shapes: [{ shape: "ellipse", fill: "none", at: { block: "costs", edge: "end", point, width: 60, height: 60 } }],
    },
  ],
});
const plain = {
  language: "en-US",
  slides: [{ title: "T", blocks: [{ text: "word ".repeat(300) }, { text: "Keep all text" }] }],
};
const recorder = () => {
  let calls = 0;
  return { measurement: { measure: (text, size) => (calls++, text.length * size * 0.5) }, count: () => calls };
};
for (const only of [["format"], ["format", "references"], ["opf/shape-anchor-missing"]]) {
  test(`${only.join("+")} never measures a deck without overlays`, () => {
    const r = recorder(),
      report = validate(plain, { only, fonts: { textMeasurement: r.measurement } });
    assert.equal(r.count(), 0);
    assert.equal(report.checks.layout, "not-run");
  });
  test(`${only.join("+")} checks a valid chart identity without layout/font loading`, () => {
    let requests = 0;
    const report = validate(anchored("FR"), {
      only,
      fonts: {
        textMeasurement: () => {
          requests++;
          throw new Error("A format/reference check must not load fonts");
        },
      },
    });
    assert.equal(report.schemaValid, true);
    assert.equal(requests, 0);
    assert.equal(report.checks.layout, "not-run");
    assert.equal(
      report.findings.some((f) => f.ruleId === "opf/shape-anchor-missing"),
      false,
    );
  });
}
test("format-only retains located missing selector errors without measuring even invalid anchors", () => {
  const r = recorder(),
    report = validate(anchored("missing"), { only: ["format"], fonts: { textMeasurement: r.measurement } });
  assert.equal(r.count(), 0);
  assert.equal(report.checks.layout, "not-run");
  const finding = report.findings.find((f) => f.ruleId === "opf/shape-anchor-missing");
  assert.ok(finding);
  assert.equal(finding.path, "/slides/0/shapes/0/at/point");
  assert.equal(finding.severity, "error");
});
test("ignoring geometry rules remains lazy with a valid anchor present", () => {
  const r = recorder(),
    report = validate(anchored("FR"), {
      ignore: ["layout", "opf/text-contrast", "opf/text-on-image", "opf/reading-order"],
      fonts: { textMeasurement: r.measurement },
    });
  assert.equal(r.count(), 0);
  assert.equal(report.checks.layout, "not-run");
});
test("default validation still measures requested geometry and keeps anchor failures", () => {
  const valid = recorder(),
    report = validate(anchored("FR"), { fonts: { textMeasurement: valid.measurement } });
  assert.ok(valid.count() > 0);
  assert.equal(report.checks.layout, "measured");
  assert.equal(
    report.findings.some((f) => f.ruleId === "opf/shape-anchor-missing"),
    false,
  );
  const invalid = recorder(),
    missing = validate(anchored("missing"), { fonts: { textMeasurement: invalid.measurement } });
  assert.equal(
    missing.findings.find((f) => f.ruleId === "opf/shape-anchor-missing").path,
    "/slides/0/shapes/0/at/point",
  );
});
