import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { FormatError, formatPresentation, isFormatted, sortPresentationKeys } from "../dist/format.js";
import { validatePresentation } from "../dist/validator.js";
import { loadExamples } from "./diff-support.mjs";

const examples = loadExamples();

describe("formatPresentation over the example decks", () => {
  test("126 example decks are covered", () => assert.equal(examples.length, 126));
  for (const { file, raw } of examples) {
    test(file, () => {
      const once = formatPresentation(raw);
      // Idempotent, text and value level.
      assert.equal(formatPresentation(once), once);
      assert.equal(isFormatted(once), true);
      assert.equal(formatPresentation(JSON.parse(raw)), once, "text and parsed input agree");
      // Only the order of object members changes: every value and array order is preserved.
      assert.deepEqual(JSON.parse(once), JSON.parse(raw));
      assert.equal(JSON.stringify(sortPresentationKeys(JSON.parse(raw)).slides?.map(slide => slide.id)), JSON.stringify(JSON.parse(raw).slides?.map(slide => slide.id)));
      // Formatting never changes validity.
      assert.equal(validatePresentation(JSON.parse(once)).valid, validatePresentation(JSON.parse(raw)).valid);
      // Layout: two-space indent, LF only, exactly one trailing newline, no BOM.
      assert.ok(once.endsWith("}\n") && !once.endsWith("\n\n"));
      assert.equal(once.includes("\r"), false);
      assert.equal(once.charCodeAt(0), 123);
    });
  }
});

describe("canonical key order", () => {
  test("root keys follow the schema", () => {
    const messy = { slides: [{ title: "T", id: "a" }], extensions: { b: 1, a: 2 }, name: "N", design: { theme: "bold" }, $schema: "https://openpresentation.org/schema/opf/v1", assets: [], custom: 1 };
    assert.deepEqual(Object.keys(sortPresentationKeys(messy)), ["$schema", "name", "design", "slides", "assets", "extensions", "custom"]);
  });

  test("nested keys follow the schema at every depth, through $ref and oneOf", () => {
    const deck = {
      slides: [{
        notes: "n", title: "T", layout: "text-1x", id: "s",
        blocks: [{ chart: { data: { rows: [] }, type: "bar" } }, { text: [{ bold: true, text: "x" }] }],
        design: { theme: "bold", dimensions: "widescreen" },
      }],
      design: { fontScheme: "x", theme: "bold" },
      name: "N",
    };
    const sorted = sortPresentationKeys(deck);
    assert.deepEqual(Object.keys(sorted.slides[0]), ["id", "layout", "title", "blocks", "design", "notes"]);
    assert.deepEqual(Object.keys(sorted.slides[0].design), ["theme", "dimensions"]);
    assert.deepEqual(Object.keys(sorted.slides[0].blocks[0].chart), ["type", "data"]);
    assert.deepEqual(Object.keys(sorted.slides[0].blocks[1].text[0]), ["text", "bold"]);
    assert.deepEqual(Object.keys(sorted.design), ["theme", "fontScheme"]);
  });

  test("undeclared keys keep their relative order and follow the declared keys", () => {
    const sorted = sortPresentationKeys({ zeta: 1, name: "N", alpha: 2, $schema: "s", extensions: { z: 1, a: 2, m: { y: 1, b: 2 } } });
    assert.deepEqual(Object.keys(sorted), ["$schema", "name", "extensions", "zeta", "alpha"]);
    assert.deepEqual(Object.keys(sorted.extensions), ["z", "a", "m"]);
    assert.deepEqual(Object.keys(sorted.extensions.m), ["y", "b"]);
  });

  test("array order and values are untouched", () => {
    const deck = { slides: [{ title: "b", id: "2" }, { title: "a", id: "1" }], name: "N" };
    assert.deepEqual(sortPresentationKeys(deck).slides.map(slide => slide.id), ["2", "1"]);
  });

  test("the input is not mutated and __proto__ stays data", () => {
    const parsed = JSON.parse('{"slides":[],"__proto__":{"x":1},"name":"N"}');
    const before = JSON.stringify(parsed);
    const sorted = sortPresentationKeys(parsed);
    assert.equal(JSON.stringify(parsed), before);
    assert.equal(Object.getPrototypeOf(sorted), Object.prototype);
    assert.deepEqual(Object.keys(sorted), ["name", "slides", "__proto__"]);
  });
});

describe("text layout", () => {
  const messy = '﻿{\r\n  "slides": [ {"title":"T","id":"a"} ],\r\n  "name": "N"\r\n}\r\n';
  test("normalises BOM, line endings and whitespace", () => {
    assert.equal(formatPresentation(messy), '{\n  "name": "N",\n  "slides": [\n    {\n      "id": "a",\n      "title": "T"\n    }\n  ]\n}\n');
  });
  test("indent and eol options", () => {
    assert.equal(formatPresentation('{"name":"N"}', { indent: 4 }), '{\n    "name": "N"\n}\n');
    assert.equal(formatPresentation('{"name":"N"}', { indent: 0 }), '{"name":"N"}\n');
    assert.equal(formatPresentation('{"name":"N","slides":[]}', { eol: "crlf" }), '{\r\n  "name": "N",\r\n  "slides": []\r\n}\r\n');
    assert.throws(() => formatPresentation("{}", { indent: 9 }), FormatError);
    assert.throws(() => formatPresentation("{}", { eol: "cr" }), FormatError);
  });
  test("non-ASCII text stays literal", () => {
    assert.equal(formatPresentation({ name: "Café ☃ \u{1F600}" }), '{\n  "name": "Café ☃ \u{1F600}"\n}\n');
  });
  test("invalid JSON is a FormatError", () => {
    assert.throws(() => formatPresentation("{not json"), FormatError);
    assert.equal(isFormatted("{not json"), false);
  });
  test("isFormatted detects drift", () => {
    assert.equal(isFormatted('{\n  "name": "N"\n}\n'), true);
    assert.equal(isFormatted('{\n  "name": "N"\n}'), false);
    assert.equal(isFormatted('{"name":"N"}\n'), false);
  });
  test("idempotent on arbitrary key orders", () => {
    let seed = 5;
    const rand = n => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed % n; };
    const keys = ["$schema", "name", "slides", "design", "assets", "extensions", "zzz", "id", "title", "text", "blocks", "chart", "type"];
    const build = depth => {
      const object = {};
      for (let i = rand(6); i > 0; i--) object[keys[rand(keys.length)]] = depth > 2 || rand(3) === 0 ? rand(10) : rand(2) ? [build(depth + 1), build(depth + 1)] : build(depth + 1);
      return object;
    };
    for (let i = 0; i < 300; i++) {
      const text = formatPresentation(build(0));
      assert.equal(formatPresentation(text), text);
    }
  });
});
