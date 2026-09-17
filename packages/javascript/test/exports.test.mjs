import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  audience,
  audiences,
  catalogEntries,
  catalogs,
  languages,
  presentation,
  purposes,
  socialPlatform,
  socialPlatforms,
  validateCatalogRecord,
} from "../dist/index.js";
import { tones } from "../dist/catalogs.js";
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

describe("catalog export shapes", () => {
  test("audiences catalog is non-empty", () => {
    assert.ok(audiences.length > 0);
  });

  test("tones catalog is non-empty", () => {
    assert.ok(tones.length > 0);
  });

  test("socialPlatforms catalog is non-empty", () => {
    assert.ok(socialPlatforms.length > 0);
  });

  test("catalogs.audiences matches the audiences export length", () => {
    assert.equal(catalogs.audiences.length, audiences.length);
  });

  test("catalogs.socialPlatforms matches the socialPlatforms export length", () => {
    assert.equal(catalogs.socialPlatforms.length, socialPlatforms.length);
  });

  test("catalogs.chartTypes is non-empty", () => {
    assert.ok(catalogs.chartTypes.length > 0);
  });

  test("chartTypes catalog keeps 'united-kingdom' and drops the removed typo id", () => {
    const removedUnitedKingdomChartId = ["united", "kindom"].join("-");
    assert.ok(catalogs.chartTypes.some((record) => record.id === "united-kingdom"));
    assert.equal(catalogs.chartTypes.some((record) => record.id === removedUnitedKingdomChartId), false);
  });

  test("chartTypes catalogEntries entry has the expected schemaName and files", () => {
    const removedUnitedKingdomChartId = ["united", "kindom"].join("-");
    const entry = catalogEntries.find((candidate) => candidate.kind === "chartTypes");
    assert.equal(entry?.schemaName, "chartType");
    assert.ok(entry?.files.includes("united-kingdom.json"));
    assert.equal(entry?.files.includes(`${removedUnitedKingdomChartId}.json`), false);
  });

  test("socialPlatforms catalogEntries entry has the expected schemaName", () => {
    assert.equal(catalogEntries.find((entry) => entry.kind === "socialPlatforms")?.schemaName, "socialPlatform");
  });

  test("purposes catalog is non-empty", () => {
    assert.ok(purposes.length > 0);
  });

  test("languages catalog includes English (US) and English (GB) with correct bcp47 tags", () => {
    assert.ok(languages.some((record) => record.id === "english-us" && record.bcp47 === "en-US"));
    assert.ok(languages.some((record) => record.id === "english-gb" && record.bcp47 === "en-GB"));
  });
});

describe("catalog entries validate", () => {
  for (const entry of catalogEntries) {
    test(`catalog '${entry.kind}' has records and its first record validates`, () => {
      assert.ok(entry.records.length > 0, `${entry.kind} should have records`);
      const result = validateCatalogRecord(entry.kind, entry.records[0]);
      assert.equal(result.valid, true, `${entry.kind}: ${JSON.stringify(result.errors, null, 2)}`);
    });
  }
});

describe("catalog cross-links resolve", () => {
  // Cross-links inside the bundled catalogs must resolve: a bundled record that
  // recommends an unknown narrative or tone id is a broken link in the spec.
  for (const kind of ["audiences", "purposes", "tones"]) {
    const entry = catalogEntries.find((candidate) => candidate.kind === kind);
    for (const record of entry.records) {
      test(`${kind}/${record.id} has no broken cross-links`, () => {
        const result = validateCatalogRecord(kind, record);
        assert.equal(
          result.warnings.length,
          0,
          `${kind}/${record.id} has broken cross-links: ${JSON.stringify(result.warnings, null, 2)}`,
        );
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
      invalidLanguageResult.errors.some((error) => error.message.includes("Use 'en-GB' for UK English")),
      JSON.stringify(invalidLanguageResult.errors, null, 2),
    );
  });

  test("broken cross-links in a catalog record warn, never error", () => {
    const audienceTemplate = audiences.find((record) => record.id === "executives");
    const brokenAudienceResult = validateCatalogRecord("audiences", {
      ...audienceTemplate,
      recommendedNarratives: ["no-such-narrative", "classic-story"],
    });
    assert.equal(brokenAudienceResult.valid, true, "broken cross-links must warn, never error");
    assert.equal(brokenAudienceResult.warnings.length, 1, JSON.stringify(brokenAudienceResult.warnings, null, 2));
    assert.equal(brokenAudienceResult.warnings[0].path, "/recommendedNarratives/0");
  });
});

describe("repo readme export", () => {
  test("repoReadme ships as a non-trivial string mentioning the format name", () => {
    assert.equal(typeof repoReadme, "string");
    assert.ok(repoReadme.length > 100, "expected repo README to ship");
    assert.match(repoReadme, /open presentation format/i);
  });
});
