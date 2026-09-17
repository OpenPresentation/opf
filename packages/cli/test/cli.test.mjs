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
      assert.equal(match.count, entry.records.length);
    }
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
