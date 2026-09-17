import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { bundlePresentation, validatePresentation } from "../dist/index.js";

const deck = () => ({
  name: "Bundle Fixture",
  narrative: "classic-story",
  tone: "formal",
  audience: ["executives"],
  design: { theme: "classic" },
  organization: { id: "acme", name: "Acme Corp", socials: { linkedin: "acme" } },
  slides: [
    {
      layout: "chart-1x",
      title: "Trend",
      chart: { type: "line", data: { columns: ["Month", "Value"], rows: [["Jan", 1]] } },
    },
  ],
});

describe("bundlePresentation", () => {
  test("inlines every referenced bundled record and stays schema-valid", () => {
    const { presentation, report } = bundlePresentation(deck());
    for (const kind of ["narratives", "tones", "audiences", "themes", "layouts", "chartTypes", "socialPlatforms"]) {
      assert.ok(report.added[kind]?.length, `expected ${kind} to be inlined: ${JSON.stringify(report.added)}`);
    }
    const validation = validatePresentation(presentation);
    assert.equal(validation.valid, true, JSON.stringify(validation.errors));
    const catalogs = presentation.catalogs;
    assert.ok(catalogs.themes.records.some((record) => record.id === "classic"));
    assert.ok(catalogs.themes.records.every((record) => record.$schema === undefined));
  });

  test("resolves transitive references from inlined records", () => {
    const { report } = bundlePresentation(deck());
    assert.ok(report.added.colorSchemes?.length, "theme should pull its color scheme");
    assert.ok(report.added.fontSchemes?.length, "theme should pull its font scheme");
  });

  test("is idempotent", () => {
    const first = bundlePresentation(deck());
    const second = bundlePresentation(first.presentation);
    assert.deepEqual(second.report.added, {});
    assert.deepEqual(second.presentation, first.presentation);
  });

  test("does not mutate the input document", () => {
    const input = deck();
    bundlePresentation(input);
    assert.equal(input.catalogs, undefined);
  });

  test("keeps kinds with a custom source untouched", () => {
    const { presentation, report } = bundlePresentation({
      name: "Custom Source",
      design: { colorScheme: "acme-brand" },
      catalogs: { colorSchemes: { source: "https://catalogs.example.com/color-schemes" } },
      slides: [{ title: "x" }],
    });
    assert.deepEqual(report.keptSources, ["colorSchemes"]);
    assert.equal(report.added.colorSchemes, undefined);
    assert.equal(presentation.catalogs.colorSchemes.records, undefined);
  });

  test("keeps records the document already inlines and reports them", () => {
    const inline = { id: "acme-brand", accent1: "#0F4C81", light1: "#FFFFFF", dark1: "#0B1B2B" };
    const { presentation, report } = bundlePresentation({
      name: "Inline Records",
      design: { colorScheme: "acme-brand" },
      catalogs: { colorSchemes: { records: [inline] } },
      slides: [{ title: "x" }],
    });
    assert.deepEqual(report.alreadyInline.colorSchemes, ["acme-brand"]);
    assert.equal(report.added.colorSchemes, undefined);
    assert.deepEqual(presentation.catalogs.colorSchemes.records, [inline]);
  });

  test("reports bare ids that resolve nowhere locally", () => {
    const { report } = bundlePresentation({
      name: "Unresolved",
      design: { colorScheme: "no-such-scheme" },
      slides: [{ title: "x" }],
    });
    assert.deepEqual(report.unresolved.colorSchemes, ["no-such-scheme"]);
  });

  test("leaves URL and pkg references alone", () => {
    const { presentation, report } = bundlePresentation({
      name: "Direct References",
      narrative: "https://acme.com/decks/narratives/founder-pitch.json",
      design: { colorScheme: "pkg:@acme/decks/color-schemes/brand" },
      slides: [{ title: "x" }],
    });
    assert.deepEqual(report.added, {});
    assert.equal(presentation.catalogs, undefined);
  });
});
