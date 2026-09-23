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
    assert.equal(report.unresolved.colorSchemes, undefined, "a custom source owns its own ids");
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

  test("chases the references of a record the document already inlines", () => {
    const { presentation, report } = bundlePresentation({
      name: "Inline Theme",
      design: { theme: "my-theme" },
      catalogs: {
        themes: { records: [{ id: "my-theme", name: "Mine", colorScheme: "cool-horizon", fontScheme: "tenorite" }] },
      },
      slides: [{ title: "x" }],
    });
    assert.deepEqual(report.alreadyInline.themes, ["my-theme"]);
    assert.deepEqual(report.added.colorSchemes, ["cool-horizon"]);
    assert.deepEqual(report.added.fontSchemes, ["tenorite"]);
    assert.ok(presentation.catalogs.colorSchemes.records.some((record) => record.id === "cool-horizon"));
    assert.ok(presentation.catalogs.fontSchemes.records.some((record) => record.id === "tenorite"));
  });

  test("chases cross-kind references of an inline record under a custom-source kind", () => {
    const { report } = bundlePresentation({
      name: "Inline Under Source",
      design: { theme: "acme-theme" },
      catalogs: {
        themes: {
          source: "https://catalogs.example.com/themes",
          records: [{ id: "acme-theme", name: "Acme", colorScheme: "cool-horizon", fontScheme: "tenorite" }],
        },
      },
      slides: [{ title: "x" }],
    });
    assert.deepEqual(report.keptSources, ["themes"]);
    assert.deepEqual(report.alreadyInline.themes, ["acme-theme"]);
    assert.deepEqual(report.added.colorSchemes, ["cool-horizon"]);
    assert.deepEqual(report.added.fontSchemes, ["tenorite"]);
  });

  test("resolves transitive layout hints an inline narrative record carries", () => {
    const { report } = bundlePresentation({
      name: "Inline Narrative Record",
      narrative: "my-arc",
      catalogs: { narratives: { records: [{ id: "my-arc", name: "My Arc", beats: [{ layoutHint: "title" }] }] } },
      slides: [{ title: "x" }],
    });
    assert.deepEqual(report.alreadyInline.narratives, ["my-arc"]);
    assert.deepEqual(report.added.layouts, ["title"]);
  });

  test("collects the font schemes a document-level language object names", () => {
    const { presentation, report } = bundlePresentation({
      name: "Inline Language",
      language: { bcp47: "de-DE", fontScheme: "aptos" },
      slides: [{ title: "x" }],
    });
    assert.deepEqual(report.added.fontSchemes, ["aptos"]);
    assert.equal(report.added.languages, undefined, "an id-less language object resolves nothing of its own");
    assert.ok(presentation.catalogs.fontSchemes.records.some((record) => record.id === "aptos"));
  });

  test("resolves a language override alongside the base record's own schemes", () => {
    const { report } = bundlePresentation({
      name: "Language Override",
      language: { id: "japanese", fontScheme: "aptos" },
      slides: [{ title: "x" }],
    });
    assert.deepEqual(report.added.languages, ["japanese"]);
    // 'aptos' from the override, 'meiryo'/'noto-sans-jp' from the base record.
    assert.deepEqual(report.added.fontSchemes, ["aptos", "meiryo", "noto-sans-jp"]);
  });

  test("never reports a fully custom narrative object", () => {
    const { report } = bundlePresentation({
      name: "Custom Narrative",
      narrative: { id: "my-own-arc", name: "My Own Arc", beats: [{ name: "Opening", purpose: "Set the scene" }] },
      slides: [{ title: "x" }],
    });
    assert.equal(report.unresolved.narratives, undefined);
    assert.deepEqual(report.unresolved, {});
  });

  test("never reports schema-blessed non-catalog shorthands", () => {
    const { report } = bundlePresentation({
      name: "Shorthands",
      language: "fr",
      tone: "upbeat",
      purpose: "celebrate",
      audience: ["Channel partners"],
      slides: [{ layout: "custom-grid", title: "x" }],
    });
    assert.deepEqual(report.unresolved, {});
    assert.deepEqual(report.added, {});
  });

  test("reports design and chart-type references the validator would warn about", () => {
    const { report } = bundlePresentation({
      name: "Reportable",
      narrative: "no-such-arc",
      design: { colorScheme: "no-such-scheme", theme: { id: "no-such-theme", fontScheme: "no-such-font" } },
      slides: [
        { design: { colorScheme: "no-such-slide-scheme" }, title: "x" },
        { title: "y", chart: { type: "no-such-chart", data: { columns: ["a"], rows: [["b"]] } } },
      ],
    });
    assert.deepEqual(report.unresolved.narratives, ["no-such-arc"]);
    assert.deepEqual(report.unresolved.themes, ["no-such-theme"]);
    assert.deepEqual(report.unresolved.colorSchemes, ["no-such-scheme", "no-such-slide-scheme"]);
    assert.deepEqual(report.unresolved.fontSchemes, ["no-such-font"]);
    assert.deepEqual(report.unresolved.chartTypes, ["no-such-chart"]);
  });

  test("reports bare-id audiences the validator would warn about and inlines known ones", () => {
    const { report } = bundlePresentation({
      name: "Audiences",
      audience: ["executive", "no-such-audience", { id: "no-such-override", attentionBudgetMinutes: 20 }, "Channel partners"],
      slides: [{ title: "x" }],
    });
    assert.deepEqual(report.unresolved.audiences, ["no-such-audience", "no-such-override"]);
    assert.deepEqual(report.added.audiences, ["executive"]);
  });

  test("reports a chart type nested in blocks and promoted regions", () => {
    const { report } = bundlePresentation({
      name: "Nested Charts",
      slides: [
        { left: { chart: { type: "no-such-left", data: { columns: ["a"], rows: [["b"]] } } }, title: "x" },
        { blocks: [{ blocks: [{ chart: { type: "no-such-nested", data: { columns: ["a"], rows: [["b"]] } } }] }] },
      ],
    });
    assert.deepEqual(report.unresolved.chartTypes, ["no-such-left", "no-such-nested"]);
  });

  test("inlines resolved stock narrative layout hints without reporting them as unresolved", () => {
    const { report } = bundlePresentation(deck());
    assert.equal(report.unresolved.layouts, undefined, JSON.stringify(report.unresolved));
    assert.deepEqual(report.unresolved, {});
    // Slide layout plus narrative beat hints from classic-story resolve and inline.
    assert.deepEqual(report.added.layouts, ["chart-1x", "text-1x", "title"]);
    const reported = JSON.stringify(report);
    for (const stale of ["text-1x-left", "title-left", "title-center"]) {
      assert.ok(!reported.includes(stale), `pre-collapse layout hint ${stale} should not surface in the report`);
    }
  });

  test("bundles nothing when 'catalogs' is not an object", () => {
    const input = { name: "Broken Catalogs", narrative: "classic-story", catalogs: ["junk"], slides: [{ title: "x" }] };
    const { presentation, report } = bundlePresentation(input);
    assert.deepEqual(presentation, input);
    assert.deepEqual(report, { added: {}, alreadyInline: {}, keptSources: [], unresolved: {} });
    assert.deepEqual(input.catalogs, ["junk"]);
  });

  test("returns non-objects untouched", () => {
    const { presentation, report } = bundlePresentation("not a deck");
    assert.equal(presentation, "not a deck");
    assert.deepEqual(report, { added: {}, alreadyInline: {}, keptSources: [], unresolved: {} });
  });

  test("reports exactly the ids the validator warns about", () => {
    const cases = {
      "stock deck": deck(),
      "custom narrative object": {
        name: "D",
        narrative: { id: "my-own-arc", name: "Mine", beats: [{ name: "Open", purpose: "Set the scene" }] },
        slides: [{ title: "x" }],
      },
      shorthands: { name: "D", language: "fr", tone: "upbeat", slides: [{ layout: "custom-grid", title: "x" }] },
      audiences: {
        name: "D",
        audience: ["executive", "no-such-audience", { id: "no-such-override" }, "Series B investors"],
        slides: [{ title: "x" }],
      },
      "single audience id": { name: "D", audience: "no-such-audience", slides: [{ title: "x" }] },
      "unknown design and chart": {
        name: "D",
        narrative: "no-such-arc",
        design: { colorScheme: "no-such-scheme", theme: { id: "no-such-theme", fontScheme: "no-such-font" } },
        slides: [{ title: "x", chart: { type: "no-such-chart", data: { columns: ["a"], rows: [["b"]] } } }],
      },
      "custom source": {
        name: "D",
        design: { colorScheme: "acme-brand" },
        catalogs: { colorSchemes: { source: "https://catalogs.example.com/color-schemes" } },
        slides: [{ title: "x" }],
      },
      // An empty search path is no source at all, to the validator and here alike.
      "empty search path": {
        name: "D",
        design: { colorScheme: "acme-brand" },
        catalogs: { colorSchemes: { source: [] } },
        slides: [{ title: "x" }],
      },
    };

    for (const [label, presentation] of Object.entries(cases)) {
      const warned = {};
      for (const warning of validatePresentation(presentation).warnings) {
        const { kind, id } = warning.params ?? {};
        if (!warning.message.includes(" catalog id ") || !kind || !id) continue;
        if (!warned[kind]) warned[kind] = [];
        if (!warned[kind].includes(id)) warned[kind].push(id);
      }
      for (const ids of Object.values(warned)) ids.sort();
      assert.deepEqual(bundlePresentation(presentation).report.unresolved, warned, label);
    }
  });
});
