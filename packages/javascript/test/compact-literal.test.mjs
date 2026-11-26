import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { describe, test } from "node:test";

import { compactExpression, compactModuleExpression } from "../scripts/compact-literal.mjs";

// The generator writes large reference tables (the font policy, the DrawingML preset geometry, the JSON Schemas) as a
// compact expression that names each repeated string once and builds each repeated object shape with a function. The value
// it builds must be the plain literal's: the same JSON text, keys in the same order, and no object or array shared.
const build = (value) => new Function(`return ${compactExpression(value, { typed: false })};`)();
const spec = (file) => JSON.parse(readFileSync(new URL(`../../../spec/${file}`, import.meta.url), "utf8"));

describe("compact literal", () => {
  test("builds the same value for every kind of JSON value", () => {
    const row = (index) => ({ name: `row ${index}`, source: "https://example.com/a-source-every-row-names", size: index / 3, open: index % 2 === 0, note: null });
    const value = {
      rows: Array.from({ length: 12 }, (_, index) => row(index)),
      tricky: { "10": "ten", "2": "two", "$ref": "#/$defs/x", "with space": "a \"quoted\" 'text' \\ back\nslash ", "": "", "é": "ü" },
      nested: [[], {}, [{}], [[1, -2.5e-7, 0]], { a: { a: { a: "deep" } } }],
      repeated: Array.from({ length: 6 }, () => ({ "$ref": "#/$defs/SomeLongDefinitionName", description: "A description that repeats." })),
    };
    const built = build(value);
    assert.equal(JSON.stringify(built), JSON.stringify(value));
    assert.deepEqual(Object.keys(built.tricky), Object.keys(value.tricky));
    // The repeated string and the repeated shape were named once.
    const code = compactExpression(value, { typed: false });
    assert.equal(code.split("https://example.com/a-source-every-row-names").length, 2);
    assert.match(code, /^\/\* @__PURE__ \*\/ \(\(\)=>\{/);
  });

  test("shares no object or array between rows", () => {
    const value = Array.from({ length: 5 }, () => ({ kind: "same", tags: ["a", "b"], inner: { kind: "same" } }));
    const built = build(value);
    assert.notEqual(built[0], built[1]);
    assert.notEqual(built[0].tags, built[1].tags);
    assert.notEqual(built[0].inner, built[1].inner);
    built[0].tags.push("c");
    assert.deepEqual(built[1].tags, ["a", "b"]);
    assert.equal(Object.getPrototypeOf(built[0]), Object.prototype);
  });

  test("a value with nothing repeated stays a plain literal", () => {
    assert.equal(compactExpression({ a: 1, b: ["x"] }), '{"a":1,"b":["x"]}');
    assert.equal(compactExpression("text"), '"text"');
  });

  test("refuses a key an object literal cannot write and a value JSON does not have", () => {
    assert.throws(() => compactExpression(JSON.parse('{"__proto__":{"a":1}}')), /__proto__/);
    assert.throws(() => compactExpression({ a: undefined }), /not a JSON value/);
  });

  test("the typed form declares its parameters", () => {
    const value = Array.from({ length: 4 }, (_, index) => ({ family: `f${index}`, licenseClass: "open-license-class" }));
    assert.match(compactExpression(value), /\(p0: unknown,p1: unknown\)=>/);
  });

  test("the generated tables build the spec files exactly", () => {
    const tables = [
      ["reference/font-policy.json", spec("reference/font-policy.json")],
      ["reference/preset-geometry.json", { shapes: spec("reference/preset-geometry.json").shapes }],
      ...readdirSync(new URL("../../../spec/schemas/", import.meta.url)).filter((file) => file.endsWith(".schema.json")).map((file) => [`schemas/${file}`, spec(`schemas/${file}`)]),
    ];
    for (const [label, value] of tables) {
      assert.equal(JSON.stringify(build(value)), JSON.stringify(value), label);
      assert.doesNotThrow(() => compactModuleExpression(value, label), label);
    }
  });
});
