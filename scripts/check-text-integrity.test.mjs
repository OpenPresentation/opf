import assert from "node:assert/strict";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { activeScanTargets, importedPackageTargets, inspectTextBytes } from "./check-text-integrity.mjs";

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

// MR-11: the imported packages carry JPEG, GIF and WebP fixtures and gzip evidence archives. A .tgz read as text produced
// 130 mojibake false positives in the import rehearsal (packages/render/docs/evidence/*/predecessor-core-snapshot.tgz).
test("MR-11: other raster images and gzip archives are binary by signature, never by name", () => {
  assert.equal(inspectTextBytes("photo.jpg", Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16])).kind, "binaryImages");
  assert.equal(inspectTextBytes("wide.gif", Buffer.from("GIF89a\u0000\u0000", "latin1")).kind, "binaryImages");
  assert.equal(inspectTextBytes("pic.webp", Buffer.concat([Buffer.from("RIFF"), Buffer.from([1, 2, 3, 4]), Buffer.from("WEBPVP8 ")])).kind, "binaryImages");
  const archive = gzipSync(Buffer.from("Bad \u00c2 marker inside an archive\n"));
  assert.equal(inspectTextBytes("predecessor-core-snapshot.tgz", archive).kind, "binaryArchives");
  assert.equal(inspectTextBytes("snapshot.bin.gz", archive).kind, "binaryArchives");
  // Names alone cannot bypass the scan: text under an image or archive name is still text.
  assert.equal(inspectTextBytes("photo.jpg", Buffer.from("Bad \u00c2 marker")).failures.length, 1);
  assert.equal(inspectTextBytes("snapshot.tgz", Buffer.from("Bad \u00c2 marker")).failures.length, 1);
  // A compressed text report keeps being decompressed and scanned.
  const report = inspectTextBytes("report.json.gz", gzipSync(Buffer.from("Bad \u00c2 marker\n")));
  assert.equal(report.kind, "text");
  assert.equal(report.failures.length, 1);
});

test("MR-11: an imported package is scanned once its package.json exists, and not before", () => {
  const root = path.join("repo");
  const present = new Set();
  const exists = (file) => present.has(file);
  const base = activeScanTargets(root, exists);
  assert.deepEqual(base, ["spec", "docs", "examples", "README.md", "PRODUCT.md", "packages/javascript"], "today's targets, exactly");
  assert.deepEqual(importedPackageTargets, ["packages/render", "packages/pptx", "packages/editor", "packages/gallery"]);
  // The generated, untracked gallery snapshot has no package.json and stays out.
  assert.deepEqual(activeScanTargets(root, (file) => file === path.join(root, "packages/gallery/catalog")), base);
  for (const target of importedPackageTargets) present.add(path.join(root, target, "package.json"));
  assert.deepEqual(activeScanTargets(root, exists), [...base, ...importedPackageTargets]);
});
