// `@openpresentation/opf/schema`: the schema navigation helpers (moved from the editor, same behavior) and the catalog kind of a
// field, read from `schemaCatalogKinds` (core-side metadata; the published schemas carry no vendor keyword).
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { catalogSchemaNames, schemas, validate } from "../dist/index.js";
import {
  activeSchema,
  catalogKindAt,
  createSchemaValue,
  listSchemaFields,
  resolveSchema,
  schemaAtPath,
  schemaCatalogKinds,
  schemaLabel,
  schemaType,
  schemaVariants,
  splitOpfPath,
} from "../dist/schema.js";

const deck = { slides: [{ title: "Hello", text: [{ text: "bold", bold: true }], blocks: [{ composition: { mode: "row" }, blocks: [{ text: "Nested" }] }] }] };

describe("splitOpfPath", () => {
  test("accepts segments, JSON Pointers and dotted paths", () => {
    assert.deepEqual(splitOpfPath(["slides", 0, "title"]), ["slides", "0", "title"]);
    assert.deepEqual(splitOpfPath("/slides/0/title"), ["slides", "0", "title"]);
    assert.deepEqual(splitOpfPath("slides.0.title"), ["slides", "0", "title"]);
    assert.deepEqual(splitOpfPath("/a~1b/c~0d"), ["a/b", "c~d"]);
    assert.deepEqual(splitOpfPath(""), []);
  });
  test("rejects a bad pointer escape and a non-path", () => {
    assert.throws(() => splitOpfPath("/a~2"));
    assert.throws(() => splitOpfPath(42));
  });
});

describe("schemaAtPath", () => {
  test("finds the schema of nested members, array items and promoted regions", () => {
    assert.equal(schemaAtPath(deck, "/slides/0/text/0/bold").type, "boolean");
    assert.equal(schemaAtPath(deck, "/slides/0/blocks/0/blocks/0/text").oneOf.length, 2);
    assert.equal(schemaAtPath(deck, "/slides/0/top:left").$ref, undefined);
  });
  test("takes segments, pointers and dotted paths alike", () => {
    const pointer = schemaAtPath(deck, "/slides/0/title");
    assert.deepEqual(schemaAtPath(deck, ["slides", 0, "title"]), pointer);
    assert.deepEqual(schemaAtPath(deck, "slides.0.title"), pointer);
  });
  test("an embedded record is described by the companion schema of its kind", () => {
    assert.ok(schemaAtPath(deck, "/catalogs/custom/layouts/mine").properties.regions, "an embedded layout record");
    assert.ok(schemaAtPath(deck, "/catalogs/acme/themes/brand").properties.colorScheme, "an embedded theme record");
    // Deeper inside the record, references stay relative to the record's own schema.
    assert.ok(schemaAtPath(deck, "/catalogs/acme/themes/brand/background"));
    assert.equal(schemaAtPath(deck, "/catalogs/acme/themes/brand/colorScheme").type, "string");
  });
  test("a union is entered through the form that has the member (audience is a string, an object or a list)", () => {
    assert.equal(schemaVariants(schemaAtPath({}, ["audience", 0])).filter((variant) => variant.type === "object").length >= 1, true);
    assert.equal(schemaAtPath({}, ["audience", 0, "id"]).type, "string");
  });
  test("a path the schema does not describe is an empty schema", () => {
    assert.deepEqual(schemaAtPath(deck, "/slides/0/nope"), {});
    assert.deepEqual(schemaAtPath(deck, "/nope/deeper"), {});
  });
  test("the SlideDesign allOf reads as one schema", () => {
    const design = schemaAtPath(deck, "/slides/0/design");
    assert.ok(design.properties.theme);
    assert.ok(design.properties.titleAlignment);
  });
});

describe("variants and backgrounds", () => {
  test("OPF 0.15: three shorthand strings and five background objects", () => {
    assert.equal(schemaVariants(schemaAtPath(deck, "/slides/0/design/background")).length, 8);
    for (const type of ["theme", "solid", "gradient", "image", "pattern"]) {
      const schema = schemaVariants(schemaAtPath(deck, "/design/background")).find((variant) => variant.properties?.type?.const === type);
      const value = createSchemaValue(schema);
      assert.equal(value.type, type);
      assert.equal(activeSchema(schemaAtPath(deck, "/design/background"), value).properties.type.const, type);
      assert.equal(validate({ slides: [{ title: "Background" }], design: { background: value } }, { only: ["format"] }).valid, true, JSON.stringify(value));
    }
  });
  test("a type array expands into one variant per type", () => {
    assert.deepEqual(schemaVariants({ type: ["string", "number"] }).map((variant) => variant.type), ["string", "number"]);
  });
  test("a branch that only names required fields labels the object by them", () => {
    assert.deepEqual(schemaVariants(schemaAtPath({}, "/audience")).filter((variant) => variant.type === "object").map((variant) => schemaLabel(variant)), ["id", "name"]);
  });
  test("resolveSchema keeps the siblings of a $ref over the target", () => {
    const resolved = resolveSchema({ $ref: "#/$defs/CatalogReference", description: "mine" });
    assert.equal(resolved.description, "mine");
    assert.equal(resolved.type, "string");
    assert.throws(() => resolveSchema({ $ref: "#/$defs/DoesNotExist" }), /Unresolved/);
  });
  test("schemaType infers the type of an untyped schema", () => {
    assert.equal(schemaType({ properties: {} }), "object");
    assert.equal(schemaType({ items: {} }), "array");
    assert.equal(schemaType({ const: 3 }), "number");
    assert.equal(schemaType({}, null), "null");
  });
});

describe("createSchemaValue", () => {
  test("required members, constants, defaults and minimums", () => {
    assert.deepEqual(createSchemaValue(schemaAtPath({}, "/organization")), { id: "acme", name: "Acme Corp" });
    assert.equal(createSchemaValue(schemaAtPath({}, "/template")), false);
    assert.equal(createSchemaValue(schemaAtPath({}, "/duration")), 1);
    assert.deepEqual(createSchemaValue(schemaAtPath({}, "/slides")).length, 1);
  });
  test("a timeline event status offers done, current and planned", () => {
    const event = schemaAtPath({ slides: [{ timeline: [{ when: "Q1", what: "Pilot" }] }] }, "/slides/0/timeline/0");
    assert.deepEqual(event.properties.status.enum, ["done", "current", "planned"]);
    assert.equal(event.required.includes("status"), false);
    assert.equal(createSchemaValue(event.properties.status), "done");
  });
});

describe("listSchemaFields", () => {
  test("lists every documented property of every schema once", () => {
    const fields = listSchemaFields();
    assert.ok(fields.length > 600);
    for (const [name, schema] of Object.entries(schemas)) for (const key of Object.keys(schema.properties ?? {})) assert.ok(fields.some((field) => field.schema === name && field.path === `/properties/${key.replace(/~/g, "~0").replace(/\//g, "~1")}`), `${name}/${key}`);
    for (const [name, schema] of Object.entries(schemas.presentation.$defs)) for (const key of Object.keys(schema.properties ?? {})) assert.ok(fields.some((field) => field.schema === "presentation" && field.path === `/$defs/${name}/properties/${key}`));
    assert.equal(new Set(fields.map((field) => `${field.schema}:${field.path}`)).size, fields.length);
    assert.ok(fields.some((field) => field.name === "status" && field.values?.join() === "done,current,planned"));
  });
});

describe("catalogKindAt", () => {
  const cases = [
    [["slides", 0, "layout"], "layouts"],
    [["slides", 7, "layout"], "layouts"],
    [["narrative"], "narratives"],
    [["audience"], "audiences"],
    [["audience", "id"], "audiences"],
    [["audience", 0], "audiences"],
    [["audience", 2, "id"], "audiences"],
    [["purpose"], "purposes"],
    [["purpose", "id"], "purposes"],
    [["tone"], "tones"],
    [["tone", "id"], "tones"],
    [["design", "theme"], "themes"],
    [["design", "colorScheme"], "colorSchemes"],
    [["design", "colorScheme", "id"], "colorSchemes"],
    [["design", "fontScheme"], "fontSchemes"],
    [["design", "fontScheme", "id"], "fontSchemes"],
    [["slides", 1, "design", "theme"], "themes"],
    [["slides", 1, "design", "colorScheme"], "colorSchemes"],
    [["slides", 1, "design", "fontScheme"], "fontSchemes"],
    [["catalogs", "acme", "themes", "brand", "colorScheme"], "colorSchemes"],
    [["catalogs", "custom", "themes", "mine", "fontScheme"], "fontSchemes"],
    // A language's script font scheme is a font scheme reference.
    [["language", "fontScheme"], "fontSchemes"],
    [["language", "googleFontScheme"], "fontSchemes"],
  ];
  for (const [path, kind] of cases)
    test(`${path.join(".")} -> ${kind}`, () => {
      assert.equal(catalogKindAt(path), kind);
      assert.equal(catalogKindAt(`/${path.join("/")}`), kind, "as a JSON Pointer");
    });

  test("everything else is not a catalog reference", () => {
    for (const path of [[], ["name"], ["language"], ["slides"], ["slides", 0], ["slides", 0, "title"], ["slides", 0, "beat"], ["slides", 0, "section"], ["design"], ["design", "background"], ["catalogs", "acme", "themes", "brand", "name"], ["nope"], ["slides", 0, "nope"]])
      assert.equal(catalogKindAt(path), undefined, path.join("."));
  });

  test("a document does not change the kind of a reference field", () => {
    const document = { audience: [{ id: "executive" }, "board"], design: { colorScheme: { id: "boost", accent1: "#112233" } }, slides: [{ layout: "pillars" }] };
    assert.equal(catalogKindAt(["audience", 0, "id"], document), "audiences");
    assert.equal(catalogKindAt(["audience", 1], document), "audiences");
    assert.equal(catalogKindAt(["design", "colorScheme", "id"], document), "colorSchemes");
    assert.equal(catalogKindAt(["slides", 0, "layout"], document), "layouts");
  });

  test("a path that is not valid does not throw", () => {
    assert.equal(catalogKindAt("/a~2"), undefined);
  });

  test("every entry of schemaCatalogKinds is a node of its schema and names a kind that has a record schema", () => {
    for (const [key, kind] of Object.entries(schemaCatalogKinds)) {
      const [name, pointer] = key.split("#");
      let node = schemas[name];
      for (const token of splitOpfPath(pointer)) node = node?.[token];
      assert.ok(node && typeof node === "object", `${key} is a schema node`);
      assert.ok(Object.hasOwn(catalogSchemaNames, kind), `${key}: ${kind} has a record schema`);
    }
    assert.deepEqual([...new Set(Object.values(schemaCatalogKinds))].sort(), ["audiences", "colorSchemes", "fontSchemes", "layouts", "narratives", "purposes", "themes", "tones"]);
  });

  test("the published schemas carry no vendor keyword, and resolved copies show none to JSON or key walks", () => {
    const keys = new Set();
    const visit = (node) => {
      if (Array.isArray(node)) return node.forEach(visit);
      if (node === null || typeof node !== "object") return;
      for (const key of Object.keys(node)) if (key.startsWith("x-")) keys.add(key);
      Object.values(node).forEach(visit);
    };
    Object.values(schemas).forEach(visit);
    assert.deepEqual([...keys], []);
    const resolved = resolveSchema(schemas.presentation.$defs.Slide.properties.layout);
    assert.deepEqual(Object.keys(resolved).filter((key) => key.startsWith("x-")), []);
    assert.equal(JSON.stringify(resolved).includes("layouts\""), false);
  });
});

describe("the annotation is not a validation keyword", () => {
  test("a layout reference that is not a string, or has a bad pattern, fails as before", () => {
    assert.equal(validate({ slides: [{ title: "a", layout: "Two Column" }] }, { only: ["format"] }).valid, false);
    assert.equal(validate({ slides: [{ title: "a", layout: "two-column" }] }, { only: ["format"] }).valid, true);
    assert.equal(validate({ slides: [{ title: "a" }], audience: ["executive", { id: "board" }] }, { only: ["format"] }).valid, true);
  });
});
