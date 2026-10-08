import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, test } from "node:test";

import { catalogDisplayKinds, catalogKinds, schemaEntries } from "@openpresentation/opf";
import { defaultCatalog } from "@openpresentation/opf/catalog";

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
    assert.equal(parsed.schemaValid, true);
    assert.equal(parsed.counts.error, 0);
    assert.match(parsed.sha256, /^[a-f0-9]{64}$/);
    assert.equal(result.stderr, "");
  });

  test("rejects an invalid deck with a non-zero exit code and reports errors", () => {
    const result = runCli(["validate", INVALID_DECK]);
    assert.equal(result.status, 1);
    // Validation reports remain on stdout, including invalid documents.
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.valid, false);
    assert.ok(Array.isArray(parsed.findings) && parsed.counts.error > 0, JSON.stringify(parsed, null, 2));
    assert.ok(
      parsed.findings.some((finding) => finding.severity === "error" && finding.category === "format" && finding.message.includes("must NOT have additional properties")),
      JSON.stringify(parsed.findings, null, 2),
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
  test("lists every kind of the default catalog the CLI registers, and the display kinds", () => {
    const result = runCli(["catalogs"]);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.ok(Array.isArray(parsed));
    assert.deepEqual(parsed.map((entry) => entry.kind), [...catalogKinds, ...catalogDisplayKinds]);
    for (const kind of catalogKinds) {
      const match = parsed.find((candidate) => candidate.kind === kind);
      assert.equal(match.count, Object.keys(defaultCatalog[kind] ?? {}).length, kind);
      assert.equal(match.source, defaultCatalog.source);
    }
    for (const kind of catalogDisplayKinds) assert.equal(parsed.find((candidate) => candidate.kind === kind).display, true, kind);
  });
});

describe("opf catalog", () => {
  test("lists a kind's records with their ids, and an exact id resolves", () => {
    const result = runCli(["catalog", "layouts"]);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const ids = JSON.parse(result.stdout).map((record) => record.id);
    assert.equal(ids.length, Object.keys(defaultCatalog.layouts).length);
    assert.ok(ids.includes("title-subtitle"));
    const record = JSON.parse(runCli(["catalog", "chartTypes", "stacked-column"]).stdout);
    assert.equal(record.id, "stacked-column");
    assert.equal(record.name, "Stacked Column");
    assert.equal(runCli(["catalog", "layouts", "no-such-layout"]).status, 2);
    assert.equal(runCli(["catalog", "layouts", "--all"]).status, 2, "--all is gone: the catalog has no deprecated records");
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

describe("opf embed", () => {
  const BUNDLE_DECK = path.resolve(__dirname, "fixtures/bundle-deck.json");

  test("embeds the records a deck references, under catalogs.default, and reports what was added", () => {
    const result = runCli(["embed", BUNDLE_DECK, "-"]);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const document = JSON.parse(result.stdout);
    const report = JSON.parse(result.stderr);
    assert.equal(report.valid, true);
    assert.equal(document.catalogs.default.source, defaultCatalog.source);
    for (const kind of ["narratives", "tones", "themes", "layouts", "colorSchemes", "fontSchemes"]) {
      assert.ok(report.embed.added.some((entry) => entry.kind === kind), `expected ${kind} in the embed report: ${JSON.stringify(report.embed.added)}`);
      assert.ok(Object.keys(document.catalogs.default[kind]).length > 0, `expected embedded ${kind} records`);
    }
    assert.deepEqual(report.embed.unresolved, []);
  });

  test("embedding a deck without catalog references is a no-op", () => {
    const result = runCli(["embed", VALID_DECK, "-"]);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const document = JSON.parse(result.stdout);
    const report = JSON.parse(result.stderr);
    assert.deepEqual(report.embed.added, []);
    assert.equal(document.catalogs, undefined);
  });

  test("rejects an invalid document before embedding", () => {
    const result = runCli(["embed", INVALID_DECK, "-"]);
    assert.equal(result.status, 1);
  });
});
