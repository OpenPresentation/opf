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

  test("styled cell fills, text colors, and border colors reject non-ColorRef strings", () => {
    const styled = (style) => deck({ slides: [{ table: { rows: [[{ value: "At risk", style }]] } }] });
    for (const style of [
      { fill: "acent2" },
      { fill: "#12345" },
      { color: "reddish" },
      { color: "var:Bad_Id" },
      { borders: { top: { color: "rgb(1,2,3)", width: 1 } } },
      { borders: { bottom: { color: "accent7", width: 1 } } },
    ]) {
      assert.equal(validatePresentation(styled(style)).valid, false, JSON.stringify(style));
    }
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

const colorRefSlide = {
  blocks: [
    { text: ["Lead ", { text: "run", color: "var:text-run" }] },
    {
      items: [
        ["Lead ", { text: "run", color: "var:item-run" }],
        {
          text: [{ text: "wrapped", color: "var:item-text" }],
          description: [{ text: "detail", color: "var:item-description" }],
        },
      ],
    },
    {
      bullets: [
        ["Lead ", { text: "run", color: "var:bullet-run" }],
        { text: [{ text: "wrapped", color: "var:bullet-text" }] },
      ],
    },
    {
      table: {
        columns: [
          ["Stage ", { text: "label", color: "var:column-run" }],
          { value: "Status", style: { fill: "var:header-fill" } },
        ],
        rows: [[
          {
            value: [{ text: "At risk", color: "var:cell-run" }],
            style: {
              color: "var:cell-color",
              borders: { bottom: { color: "var:border-color", width: 1 } },
            },
          },
          "Shipped",
        ]],
      },
    },
  ],
};

// Every ColorRef position the schema defines, in traversal order.
const colorRefPositions = [
  ["/slides/0/blocks/0/text/1/color", "text-run"],
  ["/slides/0/blocks/1/items/0/1/color", "item-run"],
  ["/slides/0/blocks/1/items/1/text/0/color", "item-text"],
  ["/slides/0/blocks/1/items/1/description/0/color", "item-description"],
  ["/slides/0/blocks/2/bullets/0/1/color", "bullet-run"],
  ["/slides/0/blocks/2/bullets/1/text/0/color", "bullet-text"],
  ["/slides/0/blocks/3/table/columns/0/1/color", "column-run"],
  ["/slides/0/blocks/3/table/columns/1/style/fill", "header-fill"],
  ["/slides/0/blocks/3/table/rows/0/0/value/0/color", "cell-run"],
  ["/slides/0/blocks/3/table/rows/0/0/style/color", "cell-color"],
  ["/slides/0/blocks/3/table/rows/0/0/style/borders/bottom/color", "border-color"],
];

const variableWarnings = (result) =>
  result.warnings.filter((warning) => warning.message.includes("variable"));

describe("color reference positions", () => {
  test("unknown var references warn once per ColorRef position, with an exact path", () => {
    const result = validatePresentation(deck({ slides: [colorRefSlide] }));
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    assert.deepEqual(
      variableWarnings(result).map((warning) => [warning.path, warning.params.id]),
      colorRefPositions,
    );
  });

  test("declared variables silence every ColorRef position", () => {
    const variables = Object.fromEntries(colorRefPositions.map(([, id]) => [id, "#B42318"]));
    const result = validatePresentation(deck({ variables, slides: [colorRefSlide] }));
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    assert.deepEqual(variableWarnings(result), []);
  });

  test("a var reference the schema rejects warns about nothing", () => {
    // The id could not be declared in the variables map either, so the schema
    // error is the whole story; a warning would only dead-end.
    for (const color of ["var:Risk", "var:", "var:risk_id", "var:-risk"]) {
      const result = validatePresentation(deck({ slides: [{ text: [{ text: "x", color }] }] }));
      assert.equal(result.valid, false, color);
      assert.deepEqual(variableWarnings(result), [], color);
    }
  });

  test("slide root payloads are checked like any other payload", () => {
    const result = validatePresentation(deck({
      slides: [{ text: [{ text: "root", color: "var:ghost" }] }],
    }));
    assert.deepEqual(
      variableWarnings(result).map((warning) => warning.path),
      ["/slides/0/text/0/color"],
    );
  });

  test("extensions passthrough is never read as a color reference", () => {
    const result = validatePresentation(deck({
      slides: [{
        title: "Passthrough",
        extensions: { review: { color: "var:ghost", palette: [{ fill: "var:x" }] } },
        left: { text: "Body", extensions: { gen: { fill: "var:x", nested: { color: "var:ghost" } } } },
      }],
    }));
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    assert.deepEqual(variableWarnings(result), []);
  });

  test("deeply nested extensions data never exhausts the stack", () => {
    let nested = { color: "var:ghost" };
    for (let depth = 0; depth < 50_000; depth += 1) nested = { child: [nested] };
    const result = validatePresentation(deck({
      slides: [{ title: "Deep", extensions: { data: nested } }],
    }));
    assert.equal(result.valid, true, JSON.stringify(result.errors.slice(0, 1)));
    assert.deepEqual(variableWarnings(result), []);
  });

  test("background and gradient colors are not color reference positions", () => {
    const result = validatePresentation(deck({
      design: {
        background: {
          type: "gradient",
          gradient: { angle: 90, stops: [{ color: "var:brand", position: 0 }, { color: "#0F172A", position: 1 }] },
        },
      },
      slides: [{ title: "Backdrop", design: { background: { type: "solid", color: "var:brand" } } }],
    }));
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    assert.deepEqual(variableWarnings(result), []);
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

  test("each duplicate id names the collision it actually found", () => {
    const cases = [
      {
        label: "slide vs slide",
        slides: [{ id: "ask", title: "a" }, { id: "ask", title: "b" }],
        path: "/slides/1/id",
        message: "slide ids must be unique within a presentation",
      },
      {
        label: "payload vs payload",
        slides: [{ left: { id: "ask", text: "a" } }, { left: { id: "ask", text: "b" } }],
        path: "/slides/1/left/id",
        message: "content payload ids must be unique among slide and payload ids within a presentation",
      },
      {
        label: "payload vs earlier slide",
        slides: [{ id: "ask", title: "a" }, { title: "b", blocks: [{ id: "ask", text: "x" }] }],
        path: "/slides/1/blocks/0/id",
        message: "content payload ids must be unique among slide and payload ids within a presentation",
      },
      {
        label: "slide vs earlier payload",
        slides: [{ title: "a", left: { id: "ask", text: "x" } }, { id: "ask", title: "b" }],
        path: "/slides/1/id",
        message: "slide id duplicates a content payload id; ids must be unique among slide and payload ids within a presentation",
      },
    ];

    for (const { label, slides, path, message } of cases) {
      const result = validatePresentation(deck({ slides }));
      assert.equal(result.valid, false, label);
      assert.deepEqual(
        result.errors.map((error) => [error.path, error.message, error.params.id]),
        [[path, message, "ask"]],
        label,
      );
    }
  });
});

describe("catalog sources", () => {
  test("a custom source suppresses unknown-id warnings as a string or a search path", () => {
    const unknownId = "house-narrative-arc";
    const bare = validatePresentation(deck({ narrative: unknownId }));
    assert.ok(
      bare.warnings.some((warning) => warning.message.includes(`unknown narratives catalog id '${unknownId}'`)),
      JSON.stringify(bare.warnings),
    );

    for (const source of ["https://a.example/x", ["https://a.example/x"], ["https://a.example/x", "pkg:@acme/decks"]]) {
      const result = validatePresentation(deck({
        catalogs: { narratives: { source } },
        narrative: unknownId,
      }));
      assert.equal(result.valid, true, JSON.stringify(result.errors));
      assert.deepEqual(
        result.warnings.filter((warning) => warning.message.includes("narratives catalog id")),
        [],
        JSON.stringify(source),
      );
    }
  });
});
