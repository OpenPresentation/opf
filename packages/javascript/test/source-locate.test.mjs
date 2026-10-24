// `locate` and `pathAt`: a JSON Pointer to a range of text and a caret to a path, tolerant of broken text. YAML and Markdown are
// in source-locate-formats.test.mjs.
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { locate, pathAt } from "../dist/source.js";

const text = '{\n  "name": "Deck",\n  "design": {"theme": "minimal"},\n  "slides": [\n    {"title": "One"},\n    {"title": "Two", "items": ["a", "b"]}\n  ]\n}\n';
const at = (range) => text.slice(range.offset, range.offset + range.length);

describe("locate", () => {
  test("the value is the default part, with line and column in the Finding.location convention", () => {
    const range = locate(text, "json", "/design/theme");
    assert.equal(at(range), '"minimal"');
    assert.deepEqual([range.line, range.column], [3, 23]);
    assert.equal(range.exact, undefined);
    assert.equal(at(locate(text, "json", "/design")), '{"theme": "minimal"}');
    assert.equal(at(locate(text, "json", "/slides/1/items/0")), '"a"');
    assert.equal(at(locate(text, "json", "")), text.trimEnd());
  });
  test("a segment array is the same as a pointer", () => {
    assert.deepEqual(locate(text, "json", ["slides", 1, "title"]), locate(text, "json", "/slides/1/title"));
  });
  test("the parts of a property", () => {
    assert.equal(at(locate(text, "json", "/design/theme", { part: "value" })), '"minimal"');
    assert.equal(at(locate(text, "json", "/design/theme", { part: "key" })), '"theme"');
    assert.equal(at(locate(text, "json", "/design/theme", { part: "colon" })), '"theme":');
    assert.equal(at(locate(text, "json", "/design/theme", { part: "entry" })), '"theme": "minimal"');
    assert.equal(at(locate(text, "json", "/design", { part: "open" })), "{");
    assert.equal(at(locate(text, "json", "/slides", { part: "open" })), "[");
    assert.equal(at(locate(text, "json", "/name", { part: "open" })), '"');
  });
  test("a part the node does not have is its value", () => {
    assert.equal(at(locate(text, "json", "/slides/0", { part: "key" })), '{"title": "One"}');
    assert.equal(at(locate(text, "json", "", { part: "colon" })), text.trimEnd());
  });
  test("a node the text does not have is the nearest ancestor that exists, marked inexact", () => {
    const missing = locate(text, "json", "/design/colorScheme");
    assert.equal(missing.exact, false);
    assert.equal(at(missing), '{"theme": "minimal"}');
    const deeper = locate(text, "json", "/slides/5/title");
    assert.equal(at(deeper), '[\n    {"title": "One"},\n    {"title": "Two", "items": ["a", "b"]}\n  ]');
    assert.equal(deeper.exact, false);
    assert.equal(at(locate(text, "json", "/design/colorScheme", { part: "open" })), "{");
    assert.equal(at(locate(text, "json", "/nope/x/y", { part: "open" })), "{");
  });
  test("tolerates a trailing comma, comments and a BOM", () => {
    const broken = '﻿{\n  // note\n  "a": [1, 2,],\n  "b": 3,\n}';
    const range = locate(broken, "json", "/b");
    assert.equal(broken.slice(range.offset, range.offset + range.length), "3");
    assert.equal(range.line, 4);
    assert.equal(broken.slice(locate(broken, "json", "/a/1").offset).startsWith("2"), true);
  });
  test("a property with no value is located at its key and colon", () => {
    const owner = '{\n  "name": "x",\n  "design":\n  "organization": {"name": "Acme"}\n}';
    const range = locate(owner, "json", "/design", { part: "colon" });
    assert.equal(owner.slice(range.offset, range.offset + range.length), '"design":');
    assert.deepEqual([range.line, range.column], [3, 3]);
  });
  test("CRLF line breaks count once", () => {
    const crlf = text.replaceAll("\n", "\r\n");
    const range = locate(crlf, "json", "/slides/1/title");
    assert.equal(range.line, 6);
    assert.equal(crlf.slice(range.offset, range.offset + range.length), '"Two"');
  });
  test("escaped pointer segments", () => {
    const keys = '{"a/b": {"c~d": 1}}';
    assert.equal(keys.slice(locate(keys, "json", "/a~1b/c~0d").offset).startsWith("1"), true);
    assert.equal(locate(keys, "json", "/a~1b/c~0d").exact, undefined);
  });
  test("an invalid pointer or empty text is undefined, not an exception", () => {
    assert.equal(locate(text, "json", "/a~2"), undefined);
    assert.equal(locate("", "json", "/a"), undefined);
    assert.equal(locate(text, "json", 42), undefined);
  });
  test("a format that is not JSON, YAML or Markdown is not located", () => {
    assert.equal(locate("a,b\n", "csv", "/name"), undefined);
  });
});

describe("pathAt", () => {
  const offsetOf = (needle, extra = 0) => text.indexOf(needle) + extra;
  test("on a property name", () => {
    const found = pathAt(text, "json", offsetOf('"theme"', 2));
    assert.deepEqual([found.path, found.part], [["design", "theme"], "key"]);
    assert.equal(at(found.range), '"theme"');
  });
  test("on a value", () => {
    const found = pathAt(text, "json", offsetOf('"minimal"', 3));
    assert.deepEqual([found.path, found.part], [["design", "theme"], "value"]);
    assert.equal(at(found.range), '"minimal"');
    assert.deepEqual(pathAt(text, "json", offsetOf('"b"', 1)).path, ["slides", 1, "items", 1]);
  });
  test("on the edges of a value", () => {
    assert.equal(pathAt(text, "json", offsetOf('"minimal"')).part, "value");
    assert.equal(pathAt(text, "json", offsetOf('"minimal"', 9)).part, "value");
  });
  test("between the members of a container", () => {
    const inObject = pathAt(text, "json", offsetOf('"design"') - 1);
    assert.deepEqual([inObject.path, inObject.part], [[], "between"]);
    const afterOpen = pathAt('{ "a": 1 }', "json", 1);
    assert.deepEqual([afterOpen.path, afterOpen.part], [[], "between"]);
    const beforeClose = pathAt('{ "a": 1 }', "json", 9);
    assert.deepEqual([beforeClose.path, beforeClose.part], [[], "between"]);
    const inArray = pathAt(text, "json", offsetOf('{"title": "One"},') + '{"title": "One"},'.length);
    assert.deepEqual([inArray.path, inArray.part], [["slides"], "between"]);
  });
  test("between a key and its value", () => {
    const found = pathAt(text, "json", offsetOf('"name":') + 7);
    assert.deepEqual([found.path, found.part], [["name"], "between"]);
  });
  test("on a bracket is the container's own value", () => {
    const found = pathAt(text, "json", offsetOf('{"theme"'));
    assert.deepEqual([found.path, found.part], [["design"], "value"]);
  });
  test("outside the root value", () => {
    assert.deepEqual(pathAt("  {}", "json", 0), { path: [], part: "none" });
    assert.deepEqual(pathAt("", "json", 0), { path: [], part: "none" });
    assert.equal(pathAt(text, "json", text.length).part, "none");
  });
  test("tolerates broken text (it reads what the tolerant parser makes of it)", () => {
    const owner = '{\n  "name": "x",\n  "design":\n  "organization": {"name": "Acme"}\n}';
    const found = pathAt(owner, "json", owner.indexOf('"name": "x"') + 3);
    assert.deepEqual([found.path, found.part], [["name"], "key"]);
    for (let offset = 0; offset <= owner.length; offset++) assert.doesNotThrow(() => pathAt(owner, "json", offset));
    assert.doesNotThrow(() => pathAt("{ [ } ] ,,", "json", 4));
  });
  test("a format that is not JSON, YAML or Markdown has no paths", () => {
    assert.equal(pathAt("a,b\n", "csv", 1), undefined);
  });
});
