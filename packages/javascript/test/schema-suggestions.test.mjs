// Did-you-mean for an unknown property: opf/schema findings of keyword additionalProperties carry the nearest property names.
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { validate } from "../dist/index.js";

const additional = (document) => validate(document, { only: ["format"] }).findings.filter((found) => found.validation?.keyword === "additionalProperties");
const names = (found) => (found.suggestions ?? []).map((suggestion) => suggestion.value);

describe("unknown property suggestions", () => {
  test("a near name at the root, in a slide and in a composition", () => {
    const [root] = additional({ slids: [] });
    assert.equal(root.path, "/slids");
    assert.deepEqual(names(root), ["slides"]);
    const [slide] = additional({ slides: [{ title: "a", tilte: "b" }] });
    assert.equal(slide.path, "/slides/0/tilte");
    assert.deepEqual(names(slide), ["title"]);
    const [composition] = additional({ slides: [{ title: "a", composition: { gapp: 1 } }] });
    assert.equal(composition.path, "/slides/0/composition/gapp");
    assert.deepEqual(names(composition), ["gap"]);
  });
  test("the shape is the one the enum suggestions have, with the schema location of the property", () => {
    const [found] = additional({ slids: [] });
    assert.deepEqual(found.suggestions, [{ value: "slides", label: "slides", origin: "schema", definition: "https://openpresentation.org/schema/opf/v1#/properties/slides" }]);
    const [slide] = additional({ slides: [{ tilte: "b" }] });
    assert.equal(slide.suggestions[0].definition, "https://openpresentation.org/schema/opf/v1#/$defs/Slide/properties/title");
  });
  test("case does not count; at most three, nearest first", () => {
    assert.equal(names(additional({ slides: [{ Title: "a" }] })[0])[0], "title");
    const many = additional({ slides: [{ title: "a", itemz: ["x"] }] })[0];
    assert.ok(names(many).length <= 3 && names(many)[0] === "items", names(many).join());
  });
  test("a name of three characters or fewer matches within one edit only", () => {
    assert.deepEqual(names(additional({ slides: [{ title: "a", ids: "x" }] })[0]), ["id"]);
    assert.equal(additional({ slides: [{ title: "a", zzz: 1 }] })[0].suggestions, undefined);
  });
  test("a name nothing is near has no suggestions, and the help still points at extensions", () => {
    const [found] = additional({ slides: [{ title: "a" }], completelyUnrelatedName: 1 });
    assert.equal(found.suggestions, undefined);
    assert.match(found.help, /extensions/);
  });
  test("an embedded record is checked against its own schema", () => {
    const found = validate({ slides: [{ title: "a" }], catalogs: { custom: { layouts: { mine: { regions: [{ name: "title" }], nmae: "x" } } } } }).findings.filter((entry) => entry.validation?.keyword === "additionalProperties");
    assert.equal(found[0].path, "/catalogs/custom/layouts/mine/nmae");
    assert.deepEqual(names(found[0]), ["name"]);
  });
  test("an enum finding keeps its allowed values, all of them in the params", () => {
    const found = validate({ slides: [{ title: "a" }], design: { titleAlignment: "middle" } }, { only: ["format"] }).findings.find((entry) => entry.validation?.keyword === "enum");
    assert.deepEqual(found.validation.params.allowedValues, ["start", "center", "end"]);
    assert.deepEqual(names(found), ["start", "center", "end"]);
  });
});

describe("the help of an unknown property names the nearest declared one", () => {
  const help = (document) => additional(document)[0].help;
  test("a one-letter slip in a design key", () => {
    const [found] = additional({ slides: [{ title: "a" }], design: { contentAligment: "start" } });
    assert.deepEqual(names(found), ["contentAlignment"]);
    assert.match(found.help, /Did you mean "contentAlignment"\?/);
    assert.equal(found.fixes?.[0]?.id, "rename-to:contentAlignment");
  });
  test("every near name in the object a person might slip in says it", () => {
    assert.match(help({ slides: [{ title: "a", tilte: "b" }] }), /Did you mean "title"\?/);
    assert.match(help({ slids: [] }), /Did you mean "slides"\?/);
  });
  test("an abbreviation keeps its own sentence and ranks before the other near names", () => {
    const [found] = additional({ slides: [{ blocks: [{ type: "text", text: [{ text: "hi", lang: "en" }] }] }] });
    assert.deepEqual(names(found).slice(0, 1), ["language"]);
    assert.match(found.help, /^Write "language" instead/);
    assert.equal(found.fixes?.[0]?.id, "rename-to:language");
  });
  test("a name with no near declared one names the validator and keeps the generic help", () => {
    assert.match(help({ slides: [{ title: "a" }], zzzzzzzz: 1 }), /^Review "zzzzzzzz" against this object.*This validator is OPF [0-9][^;]*; a later OPF release may define "zzzzzzzz".$/);
  });
});
