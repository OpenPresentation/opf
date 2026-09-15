import assert from "node:assert/strict";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { inspectTextBytes } from "./check-text-integrity.mjs";

test("compressed reports retain the same text checks and original line/column", () => {
  const source = Buffer.from("First line\nBad \u00c2 marker\n");
  const raw = inspectTextBytes("report.json", source);
  const compressed = inspectTextBytes("report.json.gz", gzipSync(source));
  assert.equal(compressed.compressed, true);
  assert.deepEqual(compressed.failures, raw.failures.map(item => ({ ...item, file: "report.json.gz" })));
  assert.deepEqual(compressed.failures, [{ file: "report.json.gz", line: 2, column: 5, pattern: "mojibake C2 marker" }]);
});

test("real compressed evidence is scanned as its text, preserving input bytes", async () => {
  const bytes = await readFile(new URL("../docs/evidence/rich-input-and-platform-ci-20260915/painting-Linux.json.gz", import.meta.url));
  const copy = Buffer.from(bytes);
  assert.ok(bytes.toString("utf8").includes("\u00c2"), "Fixture reproduces the previous compressed-byte false match");
  const result = inspectTextBytes("painting-Linux.json.gz", bytes);
  assert.equal(result.compressed, true); assert.deepEqual(result.failures, []); assert.deepEqual(bytes, copy);
});

test("names alone cannot bypass checks and broken/oversized compressed text fails", () => {
  assert.throws(() => inspectTextBytes("report.json.gz", Buffer.from("\u00c3")), /Expected a gzip text report/);
  assert.equal(inspectTextBytes("font.ttf", Buffer.from("\u00c2")).failures.length, 1);
  const bytes = gzipSync(Buffer.from("x".repeat(1024)));
  assert.throws(() => inspectTextBytes("report.log.gz", bytes.subarray(0, bytes.length - 8)));
  assert.throws(() => inspectTextBytes("report.log.gz", bytes, { maxOutputLength: 128 }));
  assert.throws(() => inspectTextBytes("report.txt.gz", gzipSync(Buffer.from([255]))));
});

test("existing recognized binary evidence remains distinct from text", () => {
  assert.equal(inspectTextBytes("image.png", Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])).kind, "binaryImages");
  assert.equal(inspectTextBytes("deck.pptx", Buffer.from([80, 75, 3, 4])).kind, "binaryDocuments");
  assert.equal(inspectTextBytes("font.ttf", Buffer.from([0, 1, 0, 0])).kind, "binaryFonts");
});
