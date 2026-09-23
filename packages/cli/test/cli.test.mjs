import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, test } from "node:test";

import { catalogEntries, schemaEntries } from "@openpresentation/opf";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_BIN = path.resolve(__dirname, "../dist/index.js");
const VALID_DECK = path.resolve(__dirname, "fixtures/valid-deck.json");
const INVALID_DECK = path.resolve(__dirname, "fixtures/invalid-deck.json");
const NONEXISTENT_DECK = path.resolve(__dirname, "fixtures/does-not-exist.json");

function runCli(args) {
  const result = spawnSync(process.execPath, [CLI_BIN, ...args], {
    encoding: "utf8",
  });
  return result;
}

describe("opf validate", () => {
  test("validates a well-formed deck with exit code 0 and reports valid: true", () => {
    const result = runCli(["validate", VALID_DECK]);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.valid, true);
    assert.deepEqual(parsed.errors, []);
    assert.match(parsed.sha256, /^[a-f0-9]{64}$/);
    assert.equal(result.stderr, "");
  });

  test("rejects an invalid deck with a non-zero exit code and reports errors", () => {
    const result = runCli(["validate", INVALID_DECK]);
    assert.equal(result.status, 1);
    // Validation reports remain on stdout, including invalid documents.
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.valid, false);
    assert.ok(Array.isArray(parsed.errors) && parsed.errors.length > 0, JSON.stringify(parsed, null, 2));
    assert.ok(
      parsed.errors.some((error) => error.message.includes("must NOT have additional properties")),
      JSON.stringify(parsed.errors, null, 2),
    );
  });

  test("reports a read/parse error and exits 2 for a nonexistent file", () => {
    const result = runCli(["validate", NONEXISTENT_DECK]);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /ENOENT/);
  });

  test("prints usage and exits 2 when 'validate' is called without a file argument", () => {
    const result = runCli(["validate"]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /opf /);
  });
});

describe("opf usage", () => {
  test("prints help and exits 0 with no arguments", () => {
    const result = runCli([]);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /opf validate <file\|->/);
    assert.match(result.stdout, /opf catalogs/);
    assert.match(result.stdout, /opf schemas/);
  });

  test("prints usage and exits 2 for an unknown command", () => {
    const result = runCli(["definitely-not-a-real-command"]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /opf /);
  });
});

describe("opf catalogs", () => {
  test("lists every bundled catalog kind with its record count", () => {
    const result = runCli(["catalogs"]);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.ok(Array.isArray(parsed));
    assert.equal(parsed.length, catalogEntries.length);
    const expectedKinds = catalogEntries.map((entry) => entry.kind).sort();
    const actualKinds = parsed.map((entry) => entry.kind).sort();
    assert.deepEqual(actualKinds, expectedKinds);
    for (const entry of catalogEntries) {
      const match = parsed.find((candidate) => candidate.kind === entry.kind);
      assert.ok(match, `expected catalogs output to include kind ${entry.kind}`);
      const deprecated = entry.records.filter((record) => record.deprecation).length;
      assert.equal(match.count, entry.records.length - deprecated);
      assert.equal(match.deprecated, deprecated || undefined);
    }
  });
});

describe("opf catalog", () => {
  const chartTypes = catalogEntries.find((entry) => entry.kind === "chartTypes").records;
  const deprecated = chartTypes.filter((record) => record.deprecation);

  test("leaves deprecated chart types out of the default listing", () => {
    assert.ok(deprecated.length > 0);
    const result = runCli(["catalog", "chartTypes"]);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const ids = JSON.parse(result.stdout).map((record) => record.id);
    assert.equal(ids.length, chartTypes.length - deprecated.length);
    assert.ok(ids.includes("column"));
    assert.equal(ids.includes("bullet-column"), false);
  });

  test("--all includes deprecated records and exact ids still resolve", () => {
    const all = JSON.parse(runCli(["catalog", "chartTypes", "--all"]).stdout);
    assert.equal(all.length, chartTypes.length);
    const record = JSON.parse(runCli(["catalog", "chartTypes", "bullet-column"]).stdout);
    assert.equal(record.deprecation.replacedBy, "column");
  });
});

describe("opf schemas", () => {
  test("lists every bundled schema name, file, and $id", () => {
    const result = runCli(["schemas"]);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.ok(Array.isArray(parsed));
    assert.equal(parsed.length, schemaEntries.length);
    const expectedNames = schemaEntries.map((entry) => entry.name).sort();
    const actualNames = parsed.map((entry) => entry.name).sort();
    assert.deepEqual(actualNames, expectedNames);
    for (const entry of schemaEntries) {
      const match = parsed.find((candidate) => candidate.name === entry.name);
      assert.ok(match, `expected schemas output to include ${entry.name}`);
      assert.equal(match.file, entry.file);
      assert.equal(match.id, entry.schema.$id);
    }
  });
});

describe("opf bundle", () => {
  const BUNDLE_DECK = path.resolve(__dirname, "fixtures/bundle-deck.json");

  test("inlines referenced catalog records and reports what was added", () => {
    const result = runCli(["bundle", BUNDLE_DECK, "-"]);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const document = JSON.parse(result.stdout);
    const report = JSON.parse(result.stderr);
    assert.equal(report.valid, true);
    for (const kind of ["narratives", "tones", "themes", "layouts", "chartTypes", "colorSchemes", "fontSchemes"]) {
      assert.ok(report.bundle.added[kind]?.length, `expected ${kind} in bundle report: ${JSON.stringify(report.bundle.added)}`);
      assert.ok(document.catalogs[kind].records.length > 0, `expected inlined ${kind} records`);
    }
  });

  test("bundling a deck without catalog references is a no-op", () => {
    const result = runCli(["bundle", VALID_DECK, "-"]);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const document = JSON.parse(result.stdout);
    const report = JSON.parse(result.stderr);
    assert.deepEqual(report.bundle.added, {});
    assert.equal(document.catalogs, undefined);
  });

  test("rejects an invalid document before bundling", () => {
    const result = runCli(["bundle", INVALID_DECK, "-"]);
    assert.equal(result.status, 1);
  });
});
