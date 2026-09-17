import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { validatePresentation } from "../dist/index.js";

const deck = (overrides = {}) => ({ name: "Reference Layer", slides: [{ title: "Base" }], ...overrides });

const run = (color) => ({ title: "Run", items: [["Lead ", { text: "emphasis", color }]] });

describe("content color references", () => {
  test("TextRun.color accepts hex, slot names, role names, and var references", () => {
    for (const color of ["#0F172A", "#0f172aff", "accent2", "dark1", "followedHyperlink", "primary", "textSecondary"]) {
      const result = validatePresentation(deck({ slides: [run(color)] }));
      assert.equal(result.valid, true, `${color}: ${JSON.stringify(result.errors)}`);
    }
    const withVar = validatePresentation(deck({ variables: { risk: "#B42318" }, slides: [run("var:risk")] }));
    assert.equal(withVar.valid, true, JSON.stringify(withVar.errors));
  });

  test("TextRun.color rejects strings that are neither hex, name, nor var reference", () => {
    for (const color of ["reddish", "rgb(1,2,3)", "var:Bad_Id", "accent7", "#12345"]) {
      const result = validatePresentation(deck({ slides: [run(color)] }));
      assert.equal(result.valid, false, `${color} should be rejected`);
    }
  });

  test("styled table cells and borders accept color references", () => {
    const result = validatePresentation(deck({
      variables: { risk: { type: "color", value: "#B42318", description: "Risk emphasis." } },
      slides: [{
        table: {
          columns: ["Stage", "Status"],
          rows: [[
            "Rollout",
            {
              value: "At risk",
              style: {
                fill: "surface",
                color: "var:risk",
                borders: { bottom: { color: "accent1", width: 1 } },
              },
            },
          ]],
        },
      }],
    }));
    assert.equal(result.valid, true, JSON.stringify(result.errors));
  });

  test("unknown var references warn without invalidating the document", () => {
    const result = validatePresentation(deck({ slides: [run("var:missing")] }));
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    assert.ok(
      result.warnings.some((warning) => warning.message.includes("unknown variable 'missing'")),
      JSON.stringify(result.warnings),
    );
  });

  test("declared var references do not warn", () => {
    const result = validatePresentation(deck({ variables: { risk: "#B42318" }, slides: [run("var:risk")] }));
    assert.equal(result.warnings.filter((warning) => warning.message.includes("variable")).length, 0);
  });

  test("var references inside groups and regions are checked", () => {
    const result = validatePresentation(deck({
      slides: [{
        left: { table: { rows: [[{ value: "x", style: { fill: "var:ghost" } }]] } },
        "center+right": {
          type: "group",
          blocks: [{ text: [{ text: "deep", color: "var:ghost" }] }],
        },
      }],
    }));
    assert.equal(result.valid, true);
    assert.equal(result.warnings.filter((warning) => warning.message.includes("unknown variable 'ghost'")).length, 2);
  });
});

describe("variables map", () => {
  test("accepts hex shorthand and explicit color objects", () => {
    const result = validatePresentation(deck({
      variables: {
        risk: "#B42318",
        highlight: { type: "color", value: "#0F4C81", description: "Brand highlight." },
      },
    }));
    assert.equal(result.valid, true, JSON.stringify(result.errors));
  });

  test("rejects non-kebab-case ids and non-hex values", () => {
    assert.equal(validatePresentation(deck({ variables: { Bad_Key: "#fff" } })).valid, false);
    assert.equal(validatePresentation(deck({ variables: { risk: "crimson" } })).valid, false);
    assert.equal(validatePresentation(deck({ variables: { risk: { type: "color", value: "crimson" } } })).valid, false);
  });
});

describe("ids and extensions below slide level", () => {
  test("payloads, groups, and slides carry ids and extensions", () => {
    const result = validatePresentation(deck({
      slides: [{
        id: "headline",
        title: "Adoption Doubled",
        extensions: { review: { status: "legal-approved", locked: true } },
        blocks: [
          { id: "kpi-1", metric: { value: "2.1x", label: "Adoption" }, extensions: { gen: { source: "q3.csv" } } },
          { id: "kpi-group", type: "group", blocks: [{ id: "kpi-2", metric: { value: "68%", label: "Margin" } }] },
        ],
      }],
    }));
    assert.equal(result.valid, true, JSON.stringify(result.errors));
  });

  test("region payloads carry ids", () => {
    const result = validatePresentation(deck({
      slides: [{ left: { id: "sidebar", text: "x" }, "center+right": { id: "main", text: "y" } }],
    }));
    assert.equal(result.valid, true, JSON.stringify(result.errors));
  });

  test("duplicate payload ids are an error", () => {
    const result = validatePresentation(deck({
      slides: [{ blocks: [{ id: "dup", text: "a" }, { type: "group", blocks: [{ id: "dup", text: "b" }] }] }],
    }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.message.includes("content payload ids must be unique")));
  });

  test("payload ids share the namespace with slide ids", () => {
    const result = validatePresentation(deck({
      slides: [{ id: "ask", title: "The Ask" }, { title: "Detail", left: { id: "ask", text: "x" } }],
    }));
    assert.equal(result.valid, false);
  });

  test("distinct ids across slides and payloads stay valid", () => {
    const result = validatePresentation(deck({
      slides: [{ id: "one", title: "A" }, { id: "two", left: { id: "three", text: "x" } }],
    }));
    assert.equal(result.valid, true, JSON.stringify(result.errors));
  });
});
