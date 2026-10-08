import assert from "node:assert/strict";
import { describe, test } from "node:test";

import * as root from "../dist/index.js";
import { CHART_TYPES, audience, catalogKinds, presentation, socialPlatform, validateCatalogRecord } from "../dist/index.js";
import { catalogDisplay, catalogIndexes, defaultCatalog } from "../dist/catalog.js";
import { audiences, chartTypes, languages, purposes, records, socialPlatforms, tones } from "./support/catalog.mjs";
import { repoReadme } from "../dist/repo-readme.js";

describe("schema $ids", () => {
  test("presentation schema has the canonical $id", () => {
    assert.equal(presentation.$id, "https://openpresentation.org/schema/opf/v1");
  });

  test("audience schema has the canonical $id", () => {
    assert.equal(audience.$id, "https://openpresentation.org/schema/opf-audience/v1");
  });

  test("socialPlatform schema has the canonical $id", () => {
    assert.equal(socialPlatform.$id, "https://openpresentation.org/schema/opf-social-platform/v1");
  });
});

describe("catalog export shapes (@openpresentation/opf/catalog)", () => {
  test("the root carries no catalog data; /catalog exports the default catalog keyed by kind and id", () => {
    for (const name of ["catalogs", "catalogEntries", "catalogIndexes", "audiences", "tones", "themes", "layouts", "chartTypes", "narratives", "socialPlatforms", "languages", "colorSchemes", "fontSchemes", "layoutPreviews"])
      assert.equal(root[name], undefined, name);
    assert.equal(defaultCatalog.source, "https://www.pptx.gallery");
    assert.deepEqual(Object.keys(defaultCatalog).filter((key) => key !== "source").sort(), [...catalogKinds].sort());
    for (const kind of catalogKinds) assert.ok(Object.keys(defaultCatalog[kind]).length > 0, kind);
    assert.deepEqual(Object.keys(catalogDisplay).sort(), ["chartTypes", "languages", "socialPlatforms"]);
    assert.equal(catalogIndexes.audiences.records.length, audiences.length);
  });

  test("records are keyed by id and carry no $schema, id or x-* member", () => {
    for (const kind of catalogKinds)
      for (const [id, record] of Object.entries(defaultCatalog[kind])) {
        assert.equal("$schema" in record || "id" in record, false, `${kind}/${id}`);
        assert.deepEqual(Object.keys(record).filter((key) => key.startsWith("x-")), [], `${kind}/${id}`);
      }
  });

  test("chartTypes display records have one record per chart type: no -3x suffixes and no country maps", () => {
    const ids = chartTypes.map((record) => record.id);
    assert.ok(ids.includes("world"));
    assert.ok(ids.includes("stacked-column"));
    assert.deepEqual(ids.filter((id) => /-[0-9]x$/.test(id)), []);
    for (const removed of ["united-kingdom", "united-states", "canada", "australia"]) assert.equal(ids.includes(removed), false, removed);
    for (const record of chartTypes) {
      assert.equal(record.label, undefined, `${record.id} has no label`);
      assert.match(record.name, /^[A-Z0-9]/, `${record.id} name is the display name`);
      assert.equal(record.name.includes("_"), false, `${record.id} name is not an enum constant`);
    }
    assert.deepEqual([...ids].sort(), [...CHART_TYPES].sort(), "the display records describe exactly the chart.type vocabulary");
  });

  test("the language display records include English (US) and English (GB) with correct bcp47 tags", () => {
    assert.ok(languages.some((record) => record.id === "english-us" && record.bcp47 === "en-US"));
    assert.ok(languages.some((record) => record.id === "english-gb" && record.bcp47 === "en-GB"));
    assert.ok(socialPlatforms.length > 0 && purposes.length > 0 && tones.length > 0);
  });
});

describe("catalog records validate as published files", () => {
  for (const kind of [...catalogKinds, "chartTypes", "languages", "socialPlatforms"]) {
    test(`catalog '${kind}' has records and its first record validates`, () => {
      const list = records(kind);
      assert.ok(list.length > 0, `${kind} should have records`);
      const result = validateCatalogRecord(kind, list[0]);
      assert.equal(result.valid, true, `${kind}: ${JSON.stringify(result.findings, null, 2)}`);
    });
  }
});

describe("catalog records carry no broken soft cross-links", () => {
  // A record that recommends a narrative or tone the catalog does not have is a broken link in the spec, even though
  // documents never resolve these soft links.
  for (const kind of ["audiences", "purposes", "tones"]) {
    for (const record of records(kind)) {
      test(`${kind}/${record.id} has no broken cross-links`, () => {
        for (const id of record.recommendedNarratives ?? []) assert.ok(defaultCatalog.narratives[id], `${kind}/${record.id} recommends unknown narrative ${id}`);
        for (const id of record.recommendedTones ?? []) assert.ok(defaultCatalog.tones[id], `${kind}/${record.id} recommends unknown tone ${id}`);
      });
    }
  }

  test("invalid en-UK language catalog record is rejected with a helpful message", () => {
    const invalidLanguageResult = validateCatalogRecord("languages", {
      $schema: "https://openpresentation.org/schema/opf-language/v1",
      id: "english-uk",
      name: "English (UK)",
      bcp47: "en-UK",
    });
    assert.equal(invalidLanguageResult.valid, false, "expected en-UK language catalog record to be invalid");
    assert.ok(
      invalidLanguageResult.findings.some((error) => error.severity === "error" && error.message.includes("Use 'en-GB' for UK English")),
      JSON.stringify(invalidLanguageResult.findings, null, 2),
    );
  });

  test("soft cross-links in a catalog record are never checked as references", () => {
    const audienceTemplate = audiences.find((record) => record.id === "executive");
    const result = validateCatalogRecord("audiences", { ...audienceTemplate, recommendedNarratives: ["no-such-narrative", "classic-story"] });
    assert.equal(result.valid, true);
    assert.deepEqual(result.findings, []);
  });
});

describe("repo readme export", () => {
  test("repoReadme ships as a non-trivial string mentioning the format name", () => {
    assert.equal(typeof repoReadme, "string");
    assert.ok(repoReadme.length > 100, "expected repo README to ship");
    assert.match(repoReadme, /open presentation format/i);
  });
});
