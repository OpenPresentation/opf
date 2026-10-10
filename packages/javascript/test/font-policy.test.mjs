import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, test } from "node:test";

import { ENGINE_DEFAULT_FONT_SCHEME, FONT_POLICY, applyFontPolicyDecisions, fontAvailabilityDiagnostics, fontPolicyFor } from "../dist/index.js"; import { resolveFontFamilies } from "../dist/composition.js"; import { defaultCatalog } from "../dist/catalog.js";
const fontSchemes = Object.entries(defaultCatalog.fontSchemes).map(([id, scheme]) => ({ id, ...scheme }));
import * as subpath from "../dist/font-policy.js";

// FF-31: one machine-readable font policy table. Renderers take replacements from it; exporters
// never write a replacement and never embed a proprietary family.
const source = JSON.parse(readFileSync(new URL("../../../spec/reference/font-policy.json", import.meta.url), "utf8"));
const schema = JSON.parse(readFileSync(new URL("../../../spec/reference/font-policy.schema.json", import.meta.url), "utf8"));
const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020.js").default;
const addFormats = require("ajv-formats").default;
const rows = FONT_POLICY.families;
const AVAILABILITY = new Set(["windows", "windows-optional", "macos", "office", "office-cloud"]);
const NO_TEXT_REPLACEMENT = new Set(["wingdings", "webdings", "symbol"]);

describe("font policy table", () => {
  test("font-policy.json is valid against its JSON Schema", () => {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);
    assert.equal(source.$schema, "./font-policy.schema.json");
    assert.equal(validate(source), true, JSON.stringify(validate.errors, null, 2));
    // The schema rejects a row that names both a decision and its own family.
    const broken = structuredClone(source);
    const aptos = broken.families.find((row) => row.family === "Aptos");
    aptos.replacement.family = "Carlito";
    assert.equal(validate(broken), false);
  });

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
    const defaults = resolveFontFamilies(ENGINE_DEFAULT_FONT_SCHEME);
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
      // A metric claim needs an upstream statement and a measured match on every corpus string of
      // every style: mean < 0.1% and no single string more than 0.3% off (docs/font-fidelity.md).
      if (row.replacement.compatibility === "metric") {
        assert.ok(row.replacement.source, `${row.family}: metric claim needs a source`);
        assert.ok(measured, `${row.family}: metric claim needs a measurement`);
        assert.ok(measured.meanAbsWidthDelta < 0.001, `${row.family}: mean width delta ${measured.meanAbsWidthDelta}`);
        assert.ok(measured.maxAbsWidthDelta <= 0.003, `${row.family}: max width delta ${measured.maxAbsWidthDelta} exceeds 0.3%`);
        assert.equal(measured.styles, 4, `${row.family}: metric claims cover regular, bold, italic and bold italic`);
      }
      // A metric-mode fallback never turns a visual replacement into a metric one.
      if (row.replacement.metricModeFallback) assert.equal(row.replacement.compatibility, "visual", row.family);
    }
  });

  test("disabledFeatures are OpenType tags on rows that need them, and only Georgia needs them", () => {
    for (const row of rows) {
      const tags = row.replacement?.disabledFeatures;
      if (tags === undefined) continue;
      assert.ok(tags.length > 0 && new Set(tags).size === tags.length && tags.every((tag) => /^[A-Za-z0-9 ]{4}$/.test(tag)), row.family);
    }
    assert.deepEqual(rows.filter((row) => row.replacement?.disabledFeatures).map((row) => row.family), ["Georgia"]);
  });

  test("the documented metric replacements", () => {
    const metric = rows.filter((row) => row.replacement?.compatibility === "metric").map((row) => `${row.family}->${row.replacement.family}`);
    assert.deepEqual(metric.sort(), ["Arial->Arimo", "Aptos Display->Intos Display", "Aptos Narrow->Intos Narrow", "Aptos Serif->Intos Serif", "Aptos->Intos", "Calibri->Carlito", "Courier New->Cousine", "Georgia->Gelasio", "Liberation Mono->Cousine", "Liberation Sans->Arimo", "Liberation Serif->Tinos", "Times New Roman->Tinos"].sort());
    // RR-17: Liberation 2 is built from the Croscore faces, so its three families preview with Arimo, Tinos and Cousine (0.0000% in four styles against Liberation 2.1.5); opf-render does not ship the Liberation files.
    for (const family of ["Liberation Sans", "Liberation Serif", "Liberation Mono"]) {
      const row = fontPolicyFor(family);
      assert.equal(row.licenseClass, "open", family);
      assert.equal(row.replacement.measured.maxAbsWidthDelta, 0, family);
      assert.equal(row.replacement.measured.styles, 4, family);
      assert.equal(row.replacement.measured.reference, `${family} 2.1.5`, family);
    }
    // Owner policy 2026-09-29: the Aptos family previews with Intos, which measures identical to Aptos 2.01.
    for (const family of ["Aptos", "Aptos Display", "Aptos Narrow", "Aptos Serif"]) {
      const row = fontPolicyFor(family);
      assert.match(row.replacement.source, /^https:\/\/github\.com\/muglug\/intos\/tree\/[0-9a-f]{40}$/, family);
      assert.equal(row.replacement.measured.maxAbsWidthDelta, 0, family);
      assert.ok(row.alternates.every((alternate) => ["Roboto", "Carlito", "Tinos"].includes(alternate)), family);
    }
    // Selawik was measured for Segoe UI and rejected; Segoe UI stays visual.
    assert.equal(fontPolicyFor("Segoe UI").replacement.compatibility, "visual");
    // Georgia: Gelasio matches every basic-Latin advance. Its default fi/fl ligatures moved runs by up to 1.02%,
    // so the row is metric only because renderers shape Gelasio with liga and clig off (measured that way).
    const georgia = fontPolicyFor("Georgia").replacement;
    assert.equal(georgia.compatibility, "metric");
    assert.deepEqual(georgia.disabledFeatures, ["liga", "clig"]);
    assert.ok(georgia.measured.maxAbsWidthDelta <= 0.003);
    // Consolas keeps Cousine, which has all four styles; Roboto Mono is an alternate.
    assert.equal(fontPolicyFor("Consolas").replacement.family, "Cousine");
    assert.equal(fontPolicyFor("Aptos Mono").replacement.family, "Cousine");
    assert.equal(fontPolicyFor("Aptos").replacement.family, "Intos");
    assert.equal(fontPolicyFor("Aptos").replacement.compatibility, "metric");
    assert.equal(fontPolicyFor("Cambria").replacement.compatibility, "visual", "Caladea advances differ from Cambria 6.99");
  });

  // RR-38: a visual replacement whose glyphs and advances are far from the real font's carries a preview size multiplier.
  test("sizeAdjust is a preview-only multiplier on visual rows, with its basis, on the measured rows only", () => {
    const adjusted = rows.filter((row) => row.replacement?.sizeAdjust !== undefined);
    // RR-38 (Arabic Typesetting) and opf#361 (the rule factors of five more script families, measured natively).
    assert.deepEqual(adjusted.map((row) => `${row.family}->${row.replacement.family}`).sort(), [
      "Angsana New->Noto Sans Thai", "Arabic Typesetting->Noto Naskh Arabic", "DilleniaUPC->Noto Sans Thai",
      "Malgun Gothic->Noto Sans KR", "Nirmala UI->Noto Sans Devanagari", "Sakkal Majalla->Noto Naskh Arabic",
    ]);
    // opf#361 rule: the smallest factor with no line over 3 percent natively (precomposed Hangul for Malgun Gothic).
    assert.deepEqual(Object.fromEntries(adjusted.map((row) => [row.family, row.replacement.sizeAdjust])), {
      "Angsana New": 0.75, "Arabic Typesetting": 0.64, DilleniaUPC: 0.68, "Malgun Gothic": 1.07, "Nirmala UI": 1.07, "Sakkal Majalla": 0.89,
    });
    for (const row of adjusted.filter((r) => r.family !== "Arabic Typesetting")) assert.match(row.replacement.sizeAdjustBasis, /opf#361 rule/, row.family);
    // Traditional Arabic, Ebrima and MS Gothic stay without a multiplier (opf#361 decision).
    for (const family of ["Traditional Arabic", "Ebrima", "MS Gothic"]) assert.equal(fontPolicyFor(family).replacement.sizeAdjust, undefined, family);
    for (const row of adjusted) {
      const { sizeAdjust, sizeAdjustBasis, compatibility } = row.replacement;
      assert.equal(compatibility, "visual", row.family);
      assert.ok(sizeAdjust >= 0.25 && sizeAdjust <= 2 && sizeAdjust !== 1, row.family);
      assert.match(sizeAdjustBasis, /advances/, row.family);
    }
    // A row with a multiplier must say how it was measured; a basis without the multiplier is meaningless.
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);
    for (const drop of ["sizeAdjustBasis"]) {
      const broken = structuredClone(source);
      delete broken.families.find((row) => row.family === "Arabic Typesetting").replacement[drop];
      assert.equal(validate(broken), false, `dropping ${drop}`);
    }
    const tooSmall = structuredClone(source);
    tooSmall.families.find((row) => row.family === "Arabic Typesetting").replacement.sizeAdjust = 0.1;
    assert.equal(validate(tooSmall), false);
    // Arabic Typesetting measured against the installed font, in place: 0.643 of Noto Naskh Arabic's advances, rounded to 0.64.
    assert.equal(fontPolicyFor("Arabic Typesetting").replacement.sizeAdjust, 0.64);
    // opf#361 native probe (corrects RR-38's 0.70 / 0.78): the baseline of an Arabic Typesetting line sits 0.74 em below the box top,
    // 0.80 em with a Latin run.
    const arabic = fontPolicyFor("Arabic Typesetting").replacement;
    assert.deepEqual([arabic.lineAscent, arabic.lineAscentMixed], [0.74, 0.8]);
    const ascents = Object.fromEntries(adjusted.filter((row) => row.replacement.lineAscent !== undefined).map((row) => [row.family, [row.replacement.lineAscent, row.replacement.lineAscentMixed]]));
    assert.deepEqual(ascents, {
      "Angsana New": [0.83, 0.86], "Arabic Typesetting": [0.74, 0.8], DilleniaUPC: [0.82, 0.85], "Nirmala UI": [0.97, 0.94], "Sakkal Majalla": [0.76, 0.81],
    });
    // Malgun Gothic's native baseline (1.06 em) sits below core's 1.0, which a renderer that only moves runs up cannot apply: no lineAscent.
    assert.equal(fontPolicyFor("Malgun Gothic").replacement.lineAscent, undefined);
    for (const row of adjusted.filter((r) => r.replacement.lineAscent !== undefined)) {
      const { lineAscent, lineAscentMixed, lineAscentBasis } = row.replacement;
      assert.ok(lineAscent >= 0.3 && lineAscent <= 1.2 && lineAscentMixed >= 0.3 && lineAscentMixed <= 1.2, row.family);
      assert.match(lineAscentBasis, /native/, row.family);
    }
    for (const mutate of [(r) => delete r.lineAscentBasis, (r) => delete r.sizeAdjust, (r) => { delete r.lineAscent; }, (r) => { r.lineAscent = 2; }]) {
      const broken = structuredClone(source);
      mutate(broken.families.find((row) => row.family === "Arabic Typesetting").replacement);
      assert.equal(validate(broken), false);
    }
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
    assert.equal(fontPolicyFor("Aptos").replacement.family, "Intos");
    assert.equal(fontPolicyFor("Aptos").replacement.decision, "aptos-preview");
    for (const family of ["Segoe UI", "Segoe UI Semibold", "Segoe UI Light", "Segoe UI Semilight"]) assert.equal(fontPolicyFor(family).replacement.family, "Red Hat Display");
    assert.deepEqual([fontPolicyFor("Cambria").replacement.family, fontPolicyFor("Cambria").replacement.compatibility], ["Caladea", "visual"]);
    assert.equal(fontPolicyFor("Cambria").replacement.metricModeFallback, true, "metric-mode registries keep previewing Cambria with Caladea");
    assert.equal(fontPolicyFor("Aptos").replacement.metricModeFallback, undefined);
  });

  test("changing one decision line re-points every row and drops the stale measurement", () => {
    const edited = structuredClone(source);
    edited.provisionalDecisions.decisions["aptos-preview"].replacement = "Carlito";
    const applied = applyFontPolicyDecisions(edited);
    const aptos = applied.families.find((row) => row.family === "Aptos");
    assert.equal(aptos.replacement.family, "Carlito");
    assert.equal(aptos.replacement.measured, null, "the Intos measurement no longer applies");
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
