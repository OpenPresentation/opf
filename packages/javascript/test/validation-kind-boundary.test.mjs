// Untrusted content-kind strings must report format findings, including names inherited by plain object maps.
import assert from "node:assert/strict";
import { test } from "node:test";
import { validate, validateCatalogRecord } from "../dist/index.js";

const kinds = ["constructor", "toString", "__proto__", "not-a-kind"];
const locations = [
  { path: "/slides/0/type", deck: (type) => ({ slides: [{ type, text: "Text" }] }) },
  { path: "/slides/0/blocks/0/type", deck: (type) => ({ slides: [{ blocks: [{ type, text: "Text" }] }] }) },
  { path: "/slides/0/left/type", deck: (type) => ({ slides: [{ left: { type, text: "Text" } }] }) },
];

for (const { path, deck } of locations) {
  test(`unknown kinds return located schema errors at ${path}, from objects and JSON text`, () => {
    for (const kind of kinds) {
      for (const input of [deck(kind), JSON.stringify(deck(kind))]) {
        const report = validate(input, { only: ["format"] });
        assert.equal(report.valid, false, kind);
        assert.equal(report.schemaValid, false, kind);
        assert.equal(report.checks.schema, "checked");
        assert.ok(report.findings.some((finding) => finding.ruleId === "opf/schema" && finding.severity === "error" && finding.path === path), kind);
      }
    }
  });
}

test("valid concrete and inferred kinds still return valid reports without changing the presentation", () => {
  for (const payload of [{ type: "text", text: "Text" }, { type: "list", items: ["One"] }, { text: "Text" }, { type: "group", blocks: [{ type: "text", text: "Text" }] }]) {
    const deck = { slides: [{ blocks: [payload] }] };
    const original = structuredClone(deck);
    const report = validate(deck, { only: ["format"] });
    assert.equal(report.valid, true, JSON.stringify(report.findings));
    assert.equal(report.schemaValid, true);
    assert.deepEqual(report.findings, []);
    assert.deepEqual(deck, original);
  }
});

test("invalid catalog kind options remain TypeErrors rather than prototype-selected schemas", () => {
  for (const kind of kinds) assert.throws(() => validateCatalogRecord(kind, {}), { name: "TypeError", message: /Unknown catalog kind/ });
});
