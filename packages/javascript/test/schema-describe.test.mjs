// `describeField`: what the schema says about a position in a document, for completion, hover and templates of a source editor.
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { schemas } from "../dist/index.js";
import { COMMON_KEYS, UNRANKED_PRIORITY, describeField, isPromotedRegionKey, schemaVariants } from "../dist/schema.js";

const slideSchema = schemas.presentation.$defs.Slide;
const regionKeys = Object.keys(slideSchema.properties).filter(isPromotedRegionKey);
const child = (info, key) => info.children.find((entry) => entry.key === key);

describe("the root", () => {
  const info = describeField([]);
  test("is known, an object, with slides required and ranked first", () => {
    assert.equal(info.known, true);
    assert.deepEqual(info.types, ["object"]);
    assert.equal(info.pointer, "");
    assert.equal(info.key, undefined);
    assert.deepEqual(info.requiredChildren, ["slides"]);
    assert.equal(info.children[0].key, "slides");
    assert.equal(info.children[0].required, true);
    assert.equal(info.children[0].typeLabel, "array of Slide");
  });
  test("ranks the common deck keys in the curated order after the required ones", () => {
    const keys = info.children.map((entry) => entry.key);
    const common = COMMON_KEYS.deck.filter((key) => keys.includes(key));
    assert.deepEqual(common, ["name", "slides", "design", "language", "audience", "purpose", "tone", "narrative", "organization", "speaker"]);
    assert.deepEqual(keys.slice(0, 10), ["slides", "name", "design", "language", "audience", "purpose", "tone", "narrative", "organization", "speaker"]);
    assert.equal(child(info, "name").priority, 0);
    assert.equal(child(info, "assets").priority, UNRANKED_PRIORITY);
  });
  test("the rest is alphabetical and $schema and extensions are advanced", () => {
    const rest = info.children.filter((entry) => entry.priority === UNRANKED_PRIORITY && !entry.advanced).map((entry) => entry.key);
    assert.deepEqual(rest, [...rest].sort());
    assert.deepEqual(info.children.filter((entry) => entry.advanced).map((entry) => entry.key).sort(), ["$schema", "extensions"]);
    assert.equal(info.children.at(-1).advanced, true, "advanced keys sort last");
  });
  test("accepts a pointer, a dotted path and the empty string alike", () => {
    assert.deepEqual(describeField("").children.map((entry) => entry.key), info.children.map((entry) => entry.key));
  });
});

describe("objects", () => {
  test("design: a $defs object with ranked children", () => {
    const info = describeField(["design"]);
    assert.equal(info.definition, "Design");
    assert.deepEqual(info.types, ["object"]);
    assert.equal(info.key, "design");
    assert.equal(info.required, false);
    assert.ok(info.description && !info.description.includes("\n\n"));
    assert.deepEqual(info.children.slice(0, 7).map((entry) => entry.key), COMMON_KEYS.design);
    assert.equal(child(info, "theme").catalogKind, "themes");
    assert.equal(child(info, "colorScheme").catalogKind, "colorSchemes");
    assert.equal(child(info, "fontScheme").catalogKind, "fontSchemes");
    assert.equal(child(info, "titleAlignment").hasEnum, true);
    assert.equal(child(info, "titleAlignment").typeLabel, "enum");
    assert.equal(child(info, "colorScheme").typeLabel, "choice");
  });
  test("a slide's design ranks like the deck's and has no dimensions requirement", () => {
    const info = describeField("/slides/0/design");
    assert.equal(info.definition, "SlideDesign");
    assert.deepEqual(info.children.slice(0, 3).map((entry) => entry.key), ["theme", "colorScheme", "fontScheme"]);
  });
  test("organization: id and name are required, first, and the array form is an item", () => {
    const info = describeField(["organization"]);
    assert.deepEqual(info.requiredChildren, ["id", "name"]);
    assert.deepEqual(info.children.slice(0, 2).map((entry) => entry.key), ["id", "name"]);
    assert.equal(child(info, "id").required, true);
    assert.deepEqual(info.types, ["object", "array"]);
    assert.equal(info.primary, 0, "the object form over the list");
    assert.equal(info.itemInfo.definition, "Organization");
    assert.deepEqual(info.itemInfo.path, ["organization", 0]);
  });
  test("a field knows whether its parent requires it", () => {
    assert.equal(describeField(["organization", "id"]).required, true);
    assert.equal(describeField(["organization", "domain"]).required, false);
    assert.equal(describeField(["slides"]).required, true);
  });
});

describe("slides", () => {
  const info = describeField(["slides", 0]);
  test("an item of the slides list is a Slide", () => {
    assert.equal(info.known, true);
    assert.equal(info.definition, "Slide");
    assert.equal(info.key, undefined, "an index is not a key");
    assert.deepEqual(info.path, ["slides", 0]);
    assert.equal(info.pointer, "/slides/0");
    assert.equal(info.children.length, Object.keys(slideSchema.properties).length);
  });
  test("the path ending in the next index or in - describes the item an array would take", () => {
    const list = describeField(["slides"], { slides: [{ title: "a" }, { title: "b" }] });
    assert.equal(list.itemInfo.definition, "Slide");
    assert.deepEqual(list.itemInfo.path, ["slides", 2]);
    for (const path of [["slides", 2], ["slides", "-"], "/slides/-", "/slides/2", "slides.2"]) assert.equal(describeField(path, { slides: [{}, {}] }).definition, "Slide", String(path));
  });
  test("common slide keys come first in the curated order", () => {
    const common = info.children.slice(0, COMMON_KEYS.slide.length).map((entry) => entry.key);
    assert.deepEqual(common, COMMON_KEYS.slide.filter((key) => key in slideSchema.properties));
    assert.deepEqual(common.slice(0, 4), ["title", "subtitle", "layout", "items"]);
  });
  test("every priority list key exists in its schema, so none is skipped silently by mistake", () => {
    for (const key of COMMON_KEYS.slide) assert.ok(key in slideSchema.properties, `slide.${key}`);
    for (const key of COMMON_KEYS.design) assert.ok(key in schemas.presentation.$defs.Design.properties, `design.${key}`);
    for (const key of COMMON_KEYS.deck) assert.ok(key in schemas.presentation.properties, `deck.${key}`);
  });
  test("promoted regions and extensions are advanced; nothing else is", () => {
    const advanced = info.children.filter((entry) => entry.advanced).map((entry) => entry.key);
    assert.equal(regionKeys.length, 48);
    assert.equal(regionKeys.filter((key) => key.includes(":")).length, 36);
    assert.deepEqual(advanced.sort(), [...regionKeys, "extensions"].sort());
    assert.equal(info.children.slice(-49).every((entry) => entry.advanced), true, "advanced keys sort last");
    assert.equal(isPromotedRegionKey("top+middle:left+center"), true);
    assert.equal(isPromotedRegionKey("left"), true);
    assert.equal(isPromotedRegionKey("title"), false);
    assert.equal(isPromotedRegionKey("tag"), false);
    assert.equal(isPromotedRegionKey(""), false);
  });
  test("slide title is text or rich text: the string form is primary and free text", () => {
    const title = describeField(["slides", 0, "title"]);
    assert.deepEqual(title.types, ["string", "array"]);
    assert.equal(title.primary, 0);
    assert.equal(title.variants[title.primary].type, "string");
    assert.equal(title.freeText, true);
    assert.equal(title.itemInfo.definition, "TextRun");
    assert.equal(title.variants[1].itemsDefinition, "TextRun");
    assert.ok(title.examples.includes("Quarterly Review"));
    const notes = describeField(["slides", 0, "notes"]);
    assert.equal(notes.freeText, true);
    assert.equal(notes.itemInfo, undefined);
  });
  test("layout is a catalog reference, not free text", () => {
    const layout = describeField(["slides", 0, "layout"]);
    assert.equal(layout.catalogKind, "layouts");
    assert.equal(layout.freeText, false);
    assert.equal(child(info, "layout").catalogKind, "layouts");
    assert.equal(child(info, "layout").typeLabel, "string");
    assert.equal(child(info, "items").typeLabel, "array of ListItem");
  });
  test("a promoted region key is described like any property", () => {
    const region = describeField(["slides", 0, "top+middle:left+center"]);
    assert.equal(region.known, true);
    assert.equal(region.definition, "ContentPayload");
  });
});

describe("values", () => {
  test("design.titleAlignment is an enum of left, center and right", () => {
    const info = describeField(["design", "titleAlignment"]);
    assert.deepEqual(info.types, ["string"]);
    assert.deepEqual(info.enum, [{ value: "left" }, { value: "center" }, { value: "right" }]);
    assert.deepEqual(info.variants[0].enum.map((entry) => entry.value), ["left", "center", "right"]);
    assert.equal(info.freeText, false);
    assert.equal(info.catalogKind, undefined);
  });
  test("template is a boolean with a default", () => {
    const info = describeField(["template"]);
    assert.deepEqual(info.types, ["boolean"]);
    assert.equal(info.default, false);
    assert.equal(info.freeText, false);
  });
  test("duration is a whole number of minutes", () => {
    const info = describeField(["duration"]);
    assert.deepEqual(info.types, ["integer"]);
    assert.equal(info.freeText, false);
    assert.equal(info.children.length, 0);
  });
  test("audience: a string, an object or a list, all pointing into the audiences catalog", () => {
    const info = describeField(["audience"]);
    assert.deepEqual(info.types, ["string", "object", "array"]);
    assert.equal(info.catalogKind, "audiences");
    assert.equal(info.primary, 0);
    assert.equal(info.freeText, false, "a reference or a free-form string: a list may open");
    assert.equal(info.itemInfo.catalogKind, "audiences");
    assert.deepEqual(info.itemInfo.types, ["string", "object"]);
    assert.equal(describeField(["audience", "id"]).catalogKind, "audiences");
    assert.equal(describeField(["audience", 1, "id"], { audience: ["a", { id: "b" }] }).catalogKind, "audiences");
  });
  test("a document picks the active form of a union", () => {
    const document = { design: { background: { type: "solid", color: "#112233" } } };
    const solid = describeField(["design", "background"], document);
    assert.ok(child(solid, "type") && child(solid, "color"));
    assert.equal(child(solid, "gradient"), undefined, "the gradient's members are not offered for a solid background");
    const merged = describeField(["design", "background"]);
    assert.ok(child(merged, "gradient"), "with no value every object form contributes");
    assert.ok(child(merged, "color"));
  });
  test("a union without a value offers the members every form requires as required", () => {
    const merged = describeField(["audience"]);
    assert.equal(child(merged, "id").required, false);
    assert.equal(child(merged, "name").required, false);
    assert.deepEqual(describeField(["audience"], { audience: { id: "board" } }).requiredChildren, ["id"]);
    assert.equal(child(describeField(["audience"], { audience: { name: "x" } }), "name").required, true);
  });
  test("language is a tag or an object and is not a catalog reference", () => {
    const info = describeField(["language"]);
    assert.equal(info.catalogKind, undefined);
    assert.deepEqual(info.types, ["string", "object"]);
  });
});

describe("maps and records", () => {
  for (const [path, definition] of [[["datasets"], "Datasets"], [["assets"], "Assets"], [["variables"], "Variables"]])
    test(`${path[0]} is a map whose entries are described`, () => {
      const info = describeField(path);
      assert.equal(info.known, true);
      assert.deepEqual(info.types, ["object"]);
      assert.equal(info.definition, definition);
      assert.equal(info.children.length, 0, "a map has no fixed members");
      assert.ok(info.entryInfo?.known, "entry schema");
      assert.deepEqual(info.entryInfo.path, [...path, "*"]);
    });
  test("a dataset entry has its own members and required columns and rows", () => {
    const entry = describeField(["datasets", "revenue"]);
    assert.equal(entry.definition, "Dataset");
    assert.equal(entry.key, "revenue");
    assert.deepEqual(entry.requiredChildren, ["columns", "rows"]);
    assert.deepEqual(entry.children.slice(0, 2).map((item) => item.key), ["columns", "rows"]);
  });
  test("catalogs.<group>.layouts is a map of layout records", () => {
    const records = describeField(["catalogs", "custom", "layouts"]);
    assert.equal(records.known, true);
    assert.equal(records.definition, "CatalogRecords");
    const record = describeField(["catalogs", "custom", "layouts", "mine"]);
    assert.equal(record.known, true);
    assert.ok(child(record, "regions"));
    assert.equal(describeField(["catalogs", "custom", "layouts", "mine", "regions"]).types[0], "array");
    assert.equal(records.entryInfo.known, true);
    assert.ok(child(records.entryInfo, "regions"));
  });
  test("an embedded theme's color scheme is a reference", () => {
    const info = describeField(["catalogs", "acme", "themes", "brand", "colorScheme"]);
    assert.equal(info.catalogKind, "colorSchemes");
    assert.equal(child(describeField(["catalogs", "acme", "themes", "brand"]), "colorScheme").catalogKind, "colorSchemes");
  });
});

describe("unknown paths", () => {
  for (const path of [["nope"], ["slides", 0, "nope"], ["slides", 0, "title", "deeper", "still"], "/design/nope/x", ["design", "titleAlignment", "x"]])
    test(`${JSON.stringify(path)} is not known and does not throw`, () => {
      const info = describeField(path);
      assert.equal(info.known, false);
      assert.deepEqual(info.types, []);
      assert.deepEqual(info.children, []);
      assert.deepEqual(info.variants, []);
      assert.equal(info.required, false);
      assert.equal(info.freeText, false);
      assert.ok(typeof info.pointer === "string");
    });
  test("a malformed pointer is unknown, not an exception", () => {
    assert.equal(describeField("/a~2").known, false);
  });
  test("free-form objects have no members to offer", () => {
    const extensions = describeField(["extensions"]);
    assert.equal(extensions.known, true);
    assert.deepEqual(extensions.children, []);
    assert.equal(describeField(["extensions", "vendor"]).known, false);
  });
});

describe("every property yields a child", () => {
  for (const [name, schema] of [["root", schemas.presentation], ["Slide", slideSchema], ["Design", schemas.presentation.$defs.Design], ["SlideDesign", schemas.presentation.$defs.SlideDesign]])
    test(`${name}`, () => {
      const properties = Object.keys(schemaVariants(schema)[0].properties);
      const path = name === "root" ? [] : name === "Slide" ? ["slides", 0] : name === "Design" ? ["design"] : ["slides", 0, "design"];
      const info = describeField(path);
      assert.deepEqual(info.children.map((entry) => entry.key).sort(), [...properties].sort());
      for (const entry of info.children) {
        assert.ok(entry.types.length > 0, entry.key);
        assert.ok(entry.typeLabel, entry.key);
        assert.equal(typeof entry.required, "boolean");
        assert.equal(typeof entry.advanced, "boolean");
        assert.equal(typeof entry.hasEnum, "boolean");
        assert.ok(entry.priority >= 0);
        // Each child can in turn be described at its own path without throwing.
        assert.equal(describeField([...path, entry.key]).known, true, entry.key);
      }
    });
  test("every field of every schema in the package can be described from the root", () => {
    for (const key of Object.keys(schemas.presentation.properties)) assert.doesNotThrow(() => describeField([key]), key);
  });
});

describe("sorting", () => {
  test("required, then not advanced, then curated priority, then alphabetical", () => {
    const info = describeField(["organization"]);
    const keys = info.children.map((entry) => entry.key);
    assert.deepEqual(keys.slice(0, 2), ["id", "name"]);
    const rest = keys.slice(2);
    assert.deepEqual(rest, [...rest].sort());
  });
  test("is stable: the same input gives the same order", () => {
    const first = describeField(["slides", 0]).children.map((entry) => entry.key);
    const second = describeField(["slides", 0], { slides: [{ title: "x", layout: "text" }] }).children.map((entry) => entry.key);
    assert.deepEqual(first, second);
  });
});

describe("cost", () => {
  test("describing a slide takes well under a frame", () => {
    describeField(["slides", 0]);
    const start = performance.now();
    for (let index = 0; index < 50; index++) describeField(["slides", 0]);
    assert.ok((performance.now() - start) / 50 < 8, "under 8 ms per call");
  });
});
