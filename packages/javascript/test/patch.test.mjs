import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  PatchError,
  PatchValidationError,
  applyPatch,
  applyPatchWithInverse,
  formatPointer,
  getAtPointer,
  hasPointer,
  invertPatch,
  jsonEqual,
  normalizePatch,
  parsePointer,
  pointerFromPath,
  readPointer,
  splitPointer,
} from "../dist/patch.js";

// RFC 6902 appendix A plus the edge cases an implementation has to get right.
const conformance = [
  ["A.1 add an object member", { foo: "bar" }, [{ op: "add", path: "/baz", value: "qux" }], { baz: "qux", foo: "bar" }],
  ["A.2 add an array element", { foo: ["bar", "baz"] }, [{ op: "add", path: "/foo/1", value: "qux" }], { foo: ["bar", "qux", "baz"] }],
  ["A.3 remove an object member", { baz: "qux", foo: "bar" }, [{ op: "remove", path: "/baz" }], { foo: "bar" }],
  ["A.4 remove an array element", { foo: ["bar", "qux", "baz"] }, [{ op: "remove", path: "/foo/1" }], { foo: ["bar", "baz"] }],
  ["A.5 replace a value", { baz: "qux", foo: "bar" }, [{ op: "replace", path: "/baz", value: "boo" }], { baz: "boo", foo: "bar" }],
  [
    "A.6 move a value",
    { foo: { bar: "baz", waldo: "fred" }, qux: { corge: "grault" } },
    [{ op: "move", from: "/foo/waldo", path: "/qux/thud" }],
    { foo: { bar: "baz" }, qux: { corge: "grault", thud: "fred" } },
  ],
  ["A.7 move an array element", { foo: ["all", "grass", "cows", "eat"] }, [{ op: "move", from: "/foo/1", path: "/foo/3" }], { foo: ["all", "cows", "eat", "grass"] }],
  ["A.8 successful test", { baz: "qux", foo: ["a", 2, "c"] }, [{ op: "test", path: "/baz", value: "qux" }, { op: "test", path: "/foo/1", value: 2 }], { baz: "qux", foo: ["a", 2, "c"] }],
  ["A.10 add a nested member object", { foo: "bar" }, [{ op: "add", path: "/child", value: { grandchild: {} } }], { foo: "bar", child: { grandchild: {} } }],
  ["A.11 ignore unrecognized elements", { foo: "bar" }, [{ op: "add", path: "/baz", value: "qux", xyz: 123 }], { foo: "bar", baz: "qux" }],
  ["A.14 escape ordering", { "/": 9, "~1": 10 }, [{ op: "test", path: "/~01", value: 10 }], { "/": 9, "~1": 10 }],
  ["A.16 add an array value", { foo: ["bar"] }, [{ op: "add", path: "/foo/-", value: ["abc", "def"] }], { foo: ["bar", ["abc", "def"]] }],
  ["add replaces an existing member", { a: 1 }, [{ op: "add", path: "/a", value: 2 }], { a: 2 }],
  ["add at the array end by index", { a: [1] }, [{ op: "add", path: "/a/1", value: 2 }], { a: [1, 2] }],
  ["add at the root replaces the document", { a: 1 }, [{ op: "add", path: "", value: [1] }], [1]],
  ["replace at the root", { a: 1 }, [{ op: "replace", path: "", value: "x" }], "x"],
  ["test the whole document", { a: [1] }, [{ op: "test", path: "", value: { a: [1] } }], { a: [1] }],
  ["test ignores member order", { a: 1, b: 2 }, [{ op: "test", path: "", value: { b: 2, a: 1 } }], { a: 1, b: 2 }],
  ["test null", { a: null }, [{ op: "test", path: "/a", value: null }], { a: null }],
  ["test equates 1 and 1.0 and -0 and 0", { a: 1, b: 0 }, [{ op: "test", path: "/a", value: 1.0 }, { op: "test", path: "/b", value: -0 }], { a: 1, b: 0 }],
  ["move to the end of an array", { a: [1, 2, 3] }, [{ op: "move", from: "/a/0", path: "/a/-" }], { a: [2, 3, 1] }],
  ["move onto itself is a no-op", { a: [1, 2] }, [{ op: "move", from: "/a/0", path: "/a/0" }], { a: [1, 2] }],
  ["move replaces the target member", { a: 1, b: 2 }, [{ op: "move", from: "/a", path: "/b" }], { b: 1 }],
  ["move toward the front of an array", { a: [1, 2, 3, 4] }, [{ op: "move", from: "/a/3", path: "/a/0" }], { a: [4, 1, 2, 3] }],
  ["copy a value", { a: { b: 1 } }, [{ op: "copy", from: "/a", path: "/c" }], { a: { b: 1 }, c: { b: 1 } }],
  ["copy then edit leaves the source alone", { a: { b: 1 } }, [{ op: "copy", from: "/a", path: "/c" }, { op: "replace", path: "/c/b", value: 2 }], { a: { b: 1 }, c: { b: 2 } }],
  ["copy onto an array end", { a: [1, 2] }, [{ op: "copy", from: "/a/0", path: "/a/-" }], { a: [1, 2, 1] }],
  ["an empty patch changes nothing", { a: 1 }, [], { a: 1 }],
  ["keys with slashes and tildes", { "a/b": { "~c": 1 } }, [{ op: "replace", path: "/a~1b/~0c", value: 2 }], { "a/b": { "~c": 2 } }],
  ["the empty-string key", { "": 1 }, [{ op: "replace", path: "/", value: 2 }], { "": 2 }],
];

const failures = [
  ["A.9 failing test", { baz: "qux" }, [{ op: "test", path: "/baz", value: "bar" }], "patch-test-failed"],
  ["A.12 add to a nonexistent parent", { foo: "bar" }, [{ op: "add", path: "/baz/bat", value: "qux" }], "patch-parent-missing"],
  ["A.15 test compares strings with numbers strictly", { "/": 9, "~1": 10 }, [{ op: "test", path: "/~01", value: "10" }], "patch-test-failed"],
  ["test of a missing path fails", { a: 1 }, [{ op: "test", path: "/b", value: 1 }], "patch-test-failed"],
  ["test distinguishes types", { a: [1] }, [{ op: "test", path: "/a", value: { 0: 1 } }], "patch-test-failed"],
  ["replace a missing member", { a: 1 }, [{ op: "replace", path: "/b", value: 1 }], "patch-path-missing"],
  ["remove a missing member", { a: 1 }, [{ op: "remove", path: "/b" }], "patch-path-missing"],
  ["remove the root", { a: 1 }, [{ op: "remove", path: "" }], "patch-root-remove"],
  ["add past the array end", { a: [1] }, [{ op: "add", path: "/a/2", value: 1 }], "invalid-array-index"],
  ["replace past the array end", { a: [1] }, [{ op: "replace", path: "/a/1", value: 1 }], "invalid-array-index"],
  ["replace at the dash index", { a: [1] }, [{ op: "replace", path: "/a/-", value: 1 }], "invalid-array-index"],
  ["remove at the dash index", { a: [1] }, [{ op: "remove", path: "/a/-" }], "invalid-array-index"],
  ["leading-zero array index", { a: [1, 2] }, [{ op: "remove", path: "/a/01" }], "invalid-array-index"],
  ["negative array index", { a: [1, 2] }, [{ op: "remove", path: "/a/-1" }], "invalid-array-index"],
  ["non-numeric array index", { a: [1, 2] }, [{ op: "remove", path: "/a/x" }], "invalid-array-index"],
  ["move from a missing path", { a: 1 }, [{ op: "move", from: "/b", path: "/c" }], "patch-path-missing"],
  ["copy from a missing path", { a: 1 }, [{ op: "copy", from: "/b", path: "/c" }], "patch-path-missing"],
  ["move into the value's own descendant", { a: { b: 1 } }, [{ op: "move", from: "/a", path: "/a/b" }], "patch-invalid-move"],
  ["unknown operation", {}, [{ op: "bogus", path: "" }], "unsupported-patch-operation"],
  ["missing op", {}, [{ path: "" }], "unsupported-patch-operation"],
  ["not an operation object", {}, [1], "invalid-patch-operation"],
  ["array as an operation", {}, [[]], "invalid-patch-operation"],
  ["missing path", {}, [{ op: "remove" }], "invalid-patch-operation"],
  ["add without a value", {}, [{ op: "add", path: "/a" }], "invalid-patch-operation"],
  ["test without a value", {}, [{ op: "test", path: "/a" }], "invalid-patch-operation"],
  ["move without from", {}, [{ op: "move", path: "/a" }], "invalid-patch-operation"],
  ["pointer without a leading slash", {}, [{ op: "add", path: "a", value: 1 }], "invalid-json-pointer"],
  ["bad escape", {}, [{ op: "add", path: "/a~2", value: 1 }], "invalid-json-pointer"],
  ["bad from pointer", { a: 1 }, [{ op: "copy", from: "a", path: "/b" }], "invalid-json-pointer"],
];

describe("RFC 6902 conformance", () => {
  for (const [name, document, patch, expected] of conformance) {
    test(name, () => {
      const before = structuredClone(document);
      const result = applyPatch(document, patch);
      assert.deepEqual(result, expected);
      assert.deepEqual(document, before, "the input document is never mutated");
      const { inverse } = applyPatchWithInverse(document, patch);
      assert.deepEqual(applyPatch(result, inverse), document, "the inverse restores the input");
    });
  }
  for (const [name, document, patch, code] of failures) {
    test(`rejects: ${name}`, () => {
      const before = structuredClone(document);
      assert.throws(() => applyPatch(document, patch), error => error instanceof PatchError && error.code === code, `expected ${code}`);
      assert.deepEqual(document, before);
    });
  }
  test("a patch must be an array", () => {
    for (const patch of [{}, "x", null, undefined]) assert.throws(() => applyPatch({}, patch), error => error.code === "invalid-patch");
  });
});

describe("atomicity and errors", () => {
  test("a failing operation leaves nothing applied and names the operation", () => {
    const document = { a: [1, 2], b: 1 };
    const patch = [{ op: "replace", path: "/b", value: 2 }, { op: "test", path: "/a/0", value: 99 }];
    assert.throws(() => applyPatch(document, patch), error => {
      assert.equal(error.code, "patch-test-failed");
      assert.equal(error.index, 1);
      assert.equal(error.path, "/a/0");
      assert.match(error.message, /^Operation 1: /);
      return true;
    });
    assert.deepEqual(document, { a: [1, 2], b: 1 });
  });
  test("shape errors name the operation index", () => {
    assert.throws(() => applyPatch({}, [{ op: "add", path: "/a", value: 1 }, { op: "oops", path: "/a" }]), error => error.index === 1 && /Operation 1/.test(error.message));
  });
  test("intermediate values need not be valid OPF", () => {
    assert.deepEqual(applyPatch({}, [{ op: "add", path: "/x", value: { not: "opf" } }, { op: "remove", path: "/x" }]), {});
  });
});

describe("object safety", () => {
  test("__proto__ is an ordinary key and never pollutes", () => {
    const result = applyPatch({}, [{ op: "add", path: "/__proto__", value: { polluted: true } }]);
    assert.equal(Object.getPrototypeOf(result), Object.prototype);
    assert.equal({}.polluted, undefined);
    assert.deepEqual(Object.keys(result), ["__proto__"]);
    assert.equal(applyPatch(result, [{ op: "test", path: "/__proto__/polluted", value: true }]) !== undefined, true);
    assert.throws(() => applyPatch({}, [{ op: "add", path: "/__proto__/polluted", value: true }]), error => error.code === "patch-parent-missing");
    assert.throws(() => applyPatch({}, [{ op: "copy", from: "/constructor", path: "/x" }]), error => error.code === "patch-path-missing");
  });
  test("values are cloned, not aliased", () => {
    const value = { inner: [1] };
    const result = applyPatch({}, [{ op: "add", path: "/v", value }]);
    value.inner.push(2);
    assert.deepEqual(result.v.inner, [1]);
    const patch = [{ op: "add", path: "/v", value: { x: 1 } }];
    const applied = applyPatchWithInverse({}, patch);
    patch[0].value.x = 2;
    assert.deepEqual(applied.document.v, { x: 1 });
    assert.deepEqual(applied.patch[0].value, { x: 1 });
  });
});

describe("optional schema validation", () => {
  const deck = { $schema: "https://openpresentation.org/schema/opf/v1", name: "Deck", slides: [{ id: "a", title: "A" }] };
  test("accepts a valid result and reports it", () => {
    const result = applyPatchWithInverse(deck, [{ op: "replace", path: "/slides/0/title", value: "B" }], { validate: true });
    assert.equal(result.validation.valid, true);
    assert.equal(result.document.slides[0].title, "B");
  });
  test("rejects an invalid result without returning a document", () => {
    assert.throws(() => applyPatch(deck, [{ op: "replace", path: "/slides", value: "bad" }], { validate: true }), error => error instanceof PatchValidationError && error.code === "patch-invalid-document" && error.validation.valid === false);
    assert.deepEqual(deck.slides, [{ id: "a", title: "A" }]);
  });
  test("a custom validator and strict mode", () => {
    const warning = { ruleId: "test/warning", severity: "warning", category: "format", path: "", message: "w" };
    assert.throws(() => applyPatch(deck, [], { validate: () => ({ valid: true, findings: [warning] }), strict: true }), error => error instanceof PatchValidationError);
    assert.doesNotThrow(() => applyPatch(deck, [], { validate: () => ({ valid: true, findings: [warning] }) }));
  });
  test("the built-in check is validate: the format rules, plus the references rules in strict mode", () => {
    const unknownTheme = { ...deck, design: { theme: "no-such-theme" } };
    assert.equal(applyPatchWithInverse(unknownTheme, [], { validate: true }).validation.valid, true);
    assert.equal(applyPatchWithInverse(unknownTheme, [], { validate: true }).validation.findings.length, 0, "a catalog warning is not part of the format check");
    assert.throws(() => applyPatch(unknownTheme, [], { validate: true, strict: true }), error => error instanceof PatchValidationError && error.validation.findings.some(entry => entry.ruleId === "opf/catalog-reference"));
  });
  test("intermediate invalid states are allowed when the result is valid", () => {
    const patch = [{ op: "replace", path: "/slides", value: "bad" }, { op: "replace", path: "/slides", value: [{ id: "z" }] }];
    assert.equal(applyPatch(deck, patch, { validate: true }).slides[0].id, "z");
  });
});

describe("pointers", () => {
  test("parse and format round-trip with escapes", () => {
    for (const tokens of [[], ["a"], ["a/b", "~c", ""], ["0", "-"], ["~0", "~1"]]) assert.deepEqual(parsePointer(formatPointer(tokens)), tokens);
    assert.equal(formatPointer(["a/b", "~c"]), "/a~1b/~0c");
    assert.equal(formatPointer(["slides", 0, "title"]), "/slides/0/title");
  });
  test("strict parsing", () => {
    for (const bad of ["a", "/a~", "/a~2", 1, null, undefined]) assert.throws(() => parsePointer(bad), error => error.code === "invalid-json-pointer");
  });
  test("pointerFromPath accepts pointers, dotted paths and segment arrays", () => {
    assert.equal(pointerFromPath("slides.0.title"), "/slides/0/title");
    assert.equal(pointerFromPath("/slides/0/title"), "/slides/0/title");
    assert.equal(pointerFromPath(["a.b", "c/d"]), "/a.b/c~1d");
    assert.equal(pointerFromPath(""), "");
    assert.throws(() => pointerFromPath("/bad~2"), error => error.code === "invalid-json-pointer");
  });
  test("splitPointer, readPointer, getAtPointer, hasPointer", () => {
    assert.deepEqual(splitPointer("/a/b~1c"), { parent: "/a", token: "b/c" });
    assert.throws(() => splitPointer(""));
    const doc = { a: [{ b: 1 }], c: undefined };
    assert.deepEqual(readPointer(doc, "/a/0/b"), { found: true, value: 1 });
    assert.deepEqual(readPointer(doc, "/a/1"), { found: false });
    assert.deepEqual(readPointer(doc, "/a/-"), { found: false });
    assert.deepEqual(readPointer(doc, "/a/00"), { found: false });
    assert.equal(hasPointer(doc, "/a/0"), true);
    assert.equal(hasPointer(doc, "/constructor"), false);
    assert.equal(getAtPointer(doc, ""), doc);
    assert.throws(() => getAtPointer(doc, "/nope"), error => error.code === "patch-path-missing");
  });
  test("normalizePatch validates shape and drops unknown members", () => {
    assert.deepEqual(normalizePatch([{ op: "remove", path: "/a", extra: 1 }, { op: "copy", from: "/a", path: "/b", junk: true }]), [{ op: "remove", path: "/a" }, { op: "copy", from: "/a", path: "/b" }]);
  });
  test("jsonEqual", () => {
    assert.equal(jsonEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }), true);
    assert.equal(jsonEqual([1, 2], [2, 1]), false);
    assert.equal(jsonEqual({}, []), false);
    assert.equal(jsonEqual(0, -0), true);
  });
});

describe("inverse patches", () => {
  test("add/remove/replace/move/copy produce exact inverses", () => {
    const document = { a: [1, 2, 3], o: { x: 1, y: [{ z: 1 }] }, s: "t" };
    const patches = [
      [{ op: "add", path: "/a/1", value: 9 }],
      [{ op: "add", path: "/a/-", value: 9 }],
      [{ op: "add", path: "/o/x", value: 5 }],
      [{ op: "add", path: "/o/new", value: 5 }],
      [{ op: "remove", path: "/a/0" }],
      [{ op: "remove", path: "/o/y" }],
      [{ op: "replace", path: "/s", value: "u" }],
      [{ op: "replace", path: "", value: [1] }],
      [{ op: "move", from: "/a/0", path: "/a/2" }],
      [{ op: "move", from: "/a/2", path: "/a/0" }],
      [{ op: "move", from: "/a/1", path: "/o/moved" }],
      [{ op: "move", from: "/s", path: "/o/x" }],
      [{ op: "copy", from: "/o", path: "/a/-" }],
      [{ op: "add", path: "/a/-", value: 1 }, { op: "add", path: "/a/-", value: 2 }, { op: "remove", path: "/a/0" }, { op: "move", from: "/a/3", path: "/a/0" }],
      [{ op: "test", path: "/s", value: "t" }],
    ];
    for (const patch of patches) {
      const after = applyPatch(document, patch);
      assert.deepEqual(applyPatch(after, invertPatch(document, patch)), document, JSON.stringify(patch));
    }
  });
  test("the inverse of a dash add addresses the concrete index", () => {
    assert.deepEqual(invertPatch({ a: [1, 2] }, [{ op: "add", path: "/a/-", value: 3 }]), [{ op: "remove", path: "/a/2" }]);
  });
  test("test operations have no inverse", () => {
    assert.deepEqual(invertPatch({ a: 1 }, [{ op: "test", path: "/a", value: 1 }]), []);
  });
  test("fuzz: random valid patches always invert", () => {
    let seed = 20261001;
    const rand = n => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed % n; };
    const walk = (value, path, out) => {
      out.push(path);
      if (Array.isArray(value)) { for (const [i, item] of value.entries()) walk(item, `${path}/${i}`, out); }
      else if (value && typeof value === "object") for (const key of Object.keys(value)) walk(value[key], `${path}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`, out);
    };
    for (let round = 0; round < 300; round++) {
      let doc = { a: [1, [2, 3], { k: "v" }], b: { c: [4, 5, 6], d: null }, e: "s" };
      const original = structuredClone(doc);
      const applied = [];
      for (let step = 0; step < 6; step++) {
        const paths = [];
        walk(doc, "", paths);
        const pick = () => paths[rand(paths.length)];
        const target = pick(), from = pick();
        const parent = target.slice(0, target.lastIndexOf("/"));
        const parentValue = parent === "" ? doc : readPointer(doc, parent).value;
        const candidates = [
          { op: "replace", path: target, value: { n: rand(9) } },
          target ? { op: "remove", path: target } : { op: "replace", path: "", value: doc },
          { op: "copy", from, path: Array.isArray(parentValue) ? `${parent}/-` : `${parent}/copy${rand(3)}` },
          { op: "move", from, path: Array.isArray(parentValue) ? `${parent}/${rand(parentValue.length + 1)}` : `${parent}/m${rand(3)}` },
          { op: "add", path: Array.isArray(parentValue) ? `${parent}/${rand(parentValue.length + 1)}` : `${parent}/n${rand(3)}`, value: rand(9) },
        ];
        const operation = candidates[rand(candidates.length)];
        try { doc = applyPatch(doc, [operation]); applied.push(operation); } catch { /* an invalid random operation is skipped */ }
      }
      const { document: after, inverse } = applyPatchWithInverse(original, applied);
      assert.deepEqual(after, doc);
      assert.deepEqual(applyPatch(after, inverse), original, JSON.stringify(applied));
    }
  });
});
