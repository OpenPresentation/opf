import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import { FONT_POLICY, applyFontPolicyDecisions, fontAvailabilityDiagnostics, fontPolicyFor, fontSchemes, resolveFontFamilies, DEFAULT_FONT_SCHEME } from "../dist/index.js";
import * as subpath from "../dist/font-policy.js";

// FF-31: one machine-readable font policy table. Renderers take replacements from it; exporters
// never write a replacement and never embed a proprietary family.
const source = JSON.parse(readFileSync(new URL("../../../spec/reference/font-policy.json", import.meta.url), "utf8"));
const rows = FONT_POLICY.families;
const AVAILABILITY = new Set(["windows", "windows-optional", "macos", "office", "office-cloud"]);
const NO_TEXT_REPLACEMENT = new Set(["cambria math", "wingdings", "webdings", "symbol", "segoe ui emoji"]);

describe("font policy table", () => {
  test("the exported table is the spec reference file with decisions applied, frozen", () => {
    assert.deepEqual(JSON.parse(JSON.stringify(FONT_POLICY)), JSON.parse(JSON.stringify(applyFontPolicyDecisions(source))));
    assert.ok(Object.isFrozen(FONT_POLICY) && Object.isFrozen(rows) && Object.isFrozen(rows[0]));
    assert.equal(subpath.FONT_POLICY, FONT_POLICY);
  });

  test("family names are unique and case-insensitively addressable", () => {
    assert.equal(new Set(rows.map((row) => row.family.toLowerCase())).size, rows.length);
    for (const row of rows) assert.equal(fontPolicyFor(row.family.toUpperCase()), row);
    assert.equal(fontPolicyFor("Not A Real Font"), undefined);
  });

  test("every font-scheme catalog family, code role and the shared default has a row", () => {
    const families = new Set();
    for (const scheme of fontSchemes) {
      const roles = resolveFontFamilies(scheme);
      for (const family of [scheme.major, scheme.minor, roles.heading, roles.body, roles.code]) if (family) families.add(family);
    }
    const defaults = resolveFontFamilies(fontSchemes.find((scheme) => scheme.id === DEFAULT_FONT_SCHEME));
    for (const family of Object.values(defaults)) families.add(family);
    const missing = [...families].filter((family) => !fontPolicyFor(family));
    assert.deepEqual(missing, []);
  });

  test("license classes, availability and embeddability are consistent", () => {
    for (const row of rows) {
      assert.ok(["open", "proprietary-standard", "proprietary-nonstandard"].includes(row.licenseClass), row.family);
      assert.ok(row.availability.every((value) => AVAILABILITY.has(value)), row.family);
      assert.ok(row.sources.length > 0 && row.sources.every((url) => /^https:\/\//.test(url)), row.family);
      if (row.licenseClass === "open") {
        assert.match(row.license, /^(OFL-1\.1|Apache-2\.0)$/, row.family);
        assert.equal(row.embeddableByOpf, true, row.family);
      } else {
        assert.equal(row.embeddableByOpf, false, `${row.family}: OPF never embeds a proprietary family`);
        assert.doesNotMatch(row.license, /^(OFL|Apache)/, row.family);
      }
      if (row.licenseClass === "proprietary-standard") assert.ok(row.availability.length > 0, `${row.family}: standard fonts name where viewers get them`);
    }
  });

  test("every proprietary text family has an openly licensed, listed replacement", () => {
    for (const row of rows) {
      if (row.licenseClass === "open" && !row.replacement) continue;
      if (NO_TEXT_REPLACEMENT.has(row.family.toLowerCase())) {
        assert.equal(row.replacement, null, row.family);
        continue;
      }
      assert.ok(row.replacement, `${row.family} needs a replacement`);
      const target = fontPolicyFor(row.replacement.family);
      assert.ok(target, `${row.family}: replacement ${row.replacement.family} has its own row`);
      assert.equal(target.licenseClass, "open", `${row.family}: replacement ${row.replacement.family} is openly licensed`);
      assert.equal(target.replacement, null, `${row.family}: replacement ${row.replacement.family} renders as itself`);
      assert.ok(["metric", "visual"].includes(row.replacement.compatibility), row.family);
      for (const family of row.alternates ?? []) assert.equal(fontPolicyFor(family)?.licenseClass, "open", `${row.family}: alternate ${family}`);
      if (row.replacement.weight !== undefined) assert.ok(Number.isInteger(row.replacement.weight) && row.replacement.weight >= 100 && row.replacement.weight <= 900);
      const measured = row.replacement.measured;
      if (measured) {
        for (const key of ["meanAbsWidthDelta", "maxAbsWidthDelta"]) assert.ok(measured[key] >= 0 && measured[key] < 1, `${row.family} ${key}`);
        assert.ok(Math.abs(measured.meanWidthDelta) <= measured.meanAbsWidthDelta + 1e-9, row.family);
        assert.ok(measured.maxAbsWidthDelta + 1e-9 >= measured.meanAbsWidthDelta, row.family);
        assert.ok(measured.styles >= 1 && measured.styles <= 4 && measured.reference.startsWith(row.family), row.family);
      }
      // A metric claim must be backed by an upstream statement and a near-zero measurement.
      if (row.replacement.compatibility === "metric") {
        assert.ok(row.replacement.source, `${row.family}: metric claim needs a source`);
        assert.ok(measured && measured.meanAbsWidthDelta < 0.001, `${row.family}: metric claim needs a measured match`);
      }
    }
  });

  test("the documented metric replacements", () => {
    const metric = rows.filter((row) => row.replacement?.compatibility === "metric").map((row) => `${row.family}->${row.replacement.family}`);
    assert.deepEqual(metric.sort(), ["Arial->Arimo", "Calibri->Carlito", "Courier New->Cousine", "Georgia->Gelasio", "Times New Roman->Tinos"]);
    assert.equal(fontPolicyFor("Aptos").replacement.family, "Roboto");
    assert.equal(fontPolicyFor("Aptos").replacement.compatibility, "visual");
    assert.equal(fontPolicyFor("Cambria").replacement.compatibility, "visual", "Caladea advances differ from Cambria 6.99");
  });
});

describe("provisional owner decisions", () => {
  test("live in one block, marked provisional, and every decision is used", () => {
    const { status, decisions } = source.provisionalDecisions;
    assert.match(status, /provisional, owner may revise/);
    assert.deepEqual(Object.keys(decisions).sort(), ["aptos-preview", "cambria-tier", "segoe-ui-preview"]);
    const used = new Set(source.families.map((row) => row.replacement?.decision).filter(Boolean));
    assert.deepEqual([...used].sort(), Object.keys(decisions).sort());
    // Rows that follow a decision carry no family of their own, so the block is the only place to edit.
    for (const row of source.families) if (row.replacement?.decision) assert.equal(row.replacement.family, undefined, row.family);
  });

  test("the recommended defaults are applied", () => {
    assert.equal(fontPolicyFor("Aptos").replacement.family, "Roboto");
    assert.equal(fontPolicyFor("Aptos").replacement.decision, "aptos-preview");
    for (const family of ["Segoe UI", "Segoe UI Semibold", "Segoe UI Light", "Segoe UI Semilight"]) assert.equal(fontPolicyFor(family).replacement.family, "Red Hat Display");
    assert.deepEqual([fontPolicyFor("Cambria").replacement.family, fontPolicyFor("Cambria").replacement.compatibility], ["Caladea", "visual"]);
  });

  test("changing one decision line re-points every row and drops the stale measurement", () => {
    const edited = structuredClone(source);
    edited.provisionalDecisions.decisions["aptos-preview"].replacement = "Carlito";
    const applied = applyFontPolicyDecisions(edited);
    const aptos = applied.families.find((row) => row.family === "Aptos");
    assert.equal(aptos.replacement.family, "Carlito");
    assert.equal(aptos.replacement.measured, null, "the Roboto measurement no longer applies");
    assert.throws(() => applyFontPolicyDecisions({ ...edited, provisionalDecisions: { ...edited.provisionalDecisions, decisions: {} } }), /unknown decision/);
  });

  test("every recorded measurement names the family it measured", () => {
    for (const row of FONT_POLICY.families) if (row.replacement?.measured) assert.equal(row.replacement.measured.replacement, row.replacement.family, row.family);
  });
});

describe("fontAvailabilityDiagnostics", () => {
  test("open and default-installed families produce nothing", () => {
    assert.deepEqual(fontAvailabilityDiagnostics(["Roboto", "Arial", "Calibri", "Georgia", "+mn-lt", ""]), []);
  });

  test("cloud-only, optional-feature and unknown families are reported once", () => {
    const report = fontAvailabilityDiagnostics(["Aptos", "aptos", "Mangal", "Brand Sans"]);
    assert.deepEqual(report.map(({ code, family, severity }) => [code, family, severity]), [
      ["font-viewer-cloud-only", "Aptos", "info"],
      ["font-viewer-optional-feature", "Mangal", "info"],
      ["font-policy-unknown", "Brand Sans", "info"],
    ]);
    assert.match(report[2].message, /The PPTX still names 'Brand Sans'/);
  });
});
