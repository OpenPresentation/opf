import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import {
  getLayoutPreview,
  hasLayoutPreview,
  layoutPreviewIndex,
  layoutPreviews,
} from "../dist/previews.js";

describe("layoutPreviews export", () => {
  test("is a non-empty record of HTML strings", () => {
    const keys = Object.keys(layoutPreviews);
    assert.ok(keys.length > 0, "expected at least one layout preview");
    for (const key of keys) {
      assert.equal(typeof layoutPreviews[key], "string", `preview ${key} should be a string`);
      assert.ok(layoutPreviews[key].length > 0, `preview ${key} should not be empty`);
    }
  });
});

describe("layoutPreviewIndex export", () => {
  test("records match Object.keys(layoutPreviews) exactly", () => {
    const previewKeys = Object.keys(layoutPreviews).sort();
    const indexIds = layoutPreviewIndex.records.map((record) => record.id).sort();
    assert.deepEqual(indexIds, previewKeys);
  });

  for (const record of layoutPreviewIndex.records) {
    // record.bytes is the byte length of the source file shipped at
    // dist/spec/previews/layouts/<file> (see scripts/generate-previews.mjs).
    // The bundler strips exactly one trailing newline from that source file
    // before embedding it as the in-memory layoutPreviews[id] string, so the
    // HTML string is expected to be one byte shorter than record.bytes
    // whenever the source file ends with a trailing newline.
    test(`preview record '${record.id}' bytes match its source file's UTF-8 byte length`, () => {
      const html = layoutPreviews[record.id];
      assert.equal(typeof html, "string", `expected an HTML preview for ${record.id}`);
      const rawFile = readFileSync(
        new URL(`../dist/spec/previews/layouts/${record.file}`, import.meta.url),
        "utf8",
      );
      assert.equal(record.bytes, Buffer.byteLength(rawFile, "utf8"));
      assert.equal(html, rawFile.replace(/\n$/, ""));
    });
  }
});

describe("getLayoutPreview", () => {
  test("returns the HTML for a known slug", () => {
    const [knownSlug] = Object.keys(layoutPreviews);
    assert.equal(getLayoutPreview(knownSlug), layoutPreviews[knownSlug]);
  });

  test("returns undefined for a bogus slug", () => {
    assert.equal(getLayoutPreview("definitely-not-a-real-layout-slug"), undefined);
  });
});

describe("hasLayoutPreview", () => {
  test("returns true for a known slug", () => {
    const [knownSlug] = Object.keys(layoutPreviews);
    assert.equal(hasLayoutPreview(knownSlug), true);
  });

  test("returns false for a bogus slug", () => {
    assert.equal(hasLayoutPreview("definitely-not-a-real-layout-slug"), false);
  });
});
