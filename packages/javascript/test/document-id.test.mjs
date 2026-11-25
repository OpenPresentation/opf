// CR 7: the document `id`. An optional root string that says "this is the same deck". Opaque (any non-empty string), kept by every
// form and edit, never made by core, and a claim rather than a credential.
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { diff, merge } from "../dist/diff.js";
import { fill } from "../dist/index.js";
import { parse, stringify } from "../dist/deck.js";
import { validate } from "../dist/index.js";
import { applyPatch } from "../dist/patch.js";

const UUID = "0192f4c8-6b1e-7c3a-9d42-5e8f1a7b3c90";
const deck = (extra = {}) => ({ $schema: "https://openpresentation.org/schema/opf/v1", name: "Q3 business review", slides: [{ id: "summary", title: "Summary" }], ...extra });
const errors = (document) => validate(document, { only: ["format"] }).findings.filter((entry) => entry.severity === "error");

describe("the root id in the schema", () => {
  test("any non-empty string is valid: a UUID, a host's own prefixed id, text with spaces", () => {
    for (const id of [UUID, "dk_5e8f1a7b3c909d426b1e7c3a", "dck_01J9", "https://example.com/decks/7", "a b", "x"]) assert.deepEqual(errors(deck({ id })), [], id);
  });

  test("an empty string and a non-string are errors at /id", () => {
    for (const id of ["", 7, null, [], {}, true]) {
      const found = errors(deck({ id }));
      assert.ok(found.length > 0, JSON.stringify(id));
      assert.ok(found.some((entry) => (entry.path ?? entry.pointer ?? "").startsWith("/id")), JSON.stringify(found));
    }
  });

  test("the document id is not an element id: a slide may use the same string", () => {
    assert.deepEqual(errors(deck({ id: "summary" })), []);
    assert.deepEqual(errors({ ...deck({ id: UUID }), slides: [{ id: UUID, title: "A" }] }), []);
  });

  test("a deck without an id stays valid", () => assert.deepEqual(errors(deck()), []));
});

describe("the id survives every form", () => {
  const source = deck({ id: UUID, description: "A review." });

  for (const format of ["json", "yaml", "markdown"]) {
    test(`${format}: stringify and parse give back the same id`, () => {
      const text = stringify(source, { format });
      assert.match(text, new RegExp(UUID));
      assert.equal(parse(text, { format }).id, UUID);
    });
  }

  test("an opaque id that looks like other YAML or Markdown values stays a string", () => {
    for (const id of ["12345", "true", "null", "2026-11-25", "0x1F", "1e3", "a: b", "# not a heading", "---", "'quoted'", " padded ", "ünïcode"]) {
      const withId = deck({ id });
      for (const format of ["json", "yaml", "markdown"]) assert.equal(parse(stringify(withId, { format }), { format }).id, id, `${format} ${JSON.stringify(id)}`);
    }
  });

  test("the three forms agree: YAML and Markdown give the JSON deck back", () => {
    const text = stringify(source, { format: "json" });
    assert.deepEqual(parse(stringify(parse(text), { format: "yaml" }), { format: "yaml" }).id, UUID);
    assert.deepEqual(parse(stringify(parse(text), { format: "markdown" }), { format: "markdown" }).id, UUID);
  });
});

describe("diff, patch and merge", () => {
  const withId = (id) => deck({ id });

  test("a changed id is a metadata change at /id and the patch applies it", () => {
    const result = diff(withId("a"), withId("b"));
    assert.equal(result.equal, false);
    assert.ok(result.changes.some((change) => change.aPath === "/id" && change.category === "metadata"), JSON.stringify(result.changes));
    assert.equal(applyPatch(withId("a"), result.patch).id, "b");
    assert.equal(diff(withId("a"), withId("a")).equal, true);
  });

  test("an edit elsewhere keeps the id", () => {
    const edited = applyPatch(withId(UUID), [{ op: "replace", path: "/slides/0/title", value: "Changed" }]);
    assert.equal(edited.id, UUID);
  });

  test("one side adding or changing the id applies cleanly", () => {
    const base = deck();
    const ours = deck({ id: UUID });
    const result = merge(base, ours, deck({ name: "Renamed" }));
    assert.equal(result.clean, true);
    assert.equal(result.merged.id, UUID);
    assert.equal(result.merged.name, "Renamed");
    const changed = merge(withId("a"), withId("a"), withId("b"));
    assert.equal(changed.clean, true);
    assert.equal(changed.merged.id, "b");
  });

  test("two different ids are a conflict at /id: ours is kept, theirs with prefer theirs", () => {
    const base = withId("base");
    const ours = merge(base, withId("ours"), withId("theirs"));
    assert.equal(ours.clean, false);
    assert.equal(ours.merged.id, "ours");
    assert.deepEqual(ours.conflicts.map((entry) => [entry.kind, entry.path]), [["modify-modify", "/id"]]);
    assert.equal(merge(base, withId("ours"), withId("theirs"), { prefer: "theirs" }).merged.id, "theirs");
    const added = merge(deck(), withId("ours"), withId("theirs"));
    assert.deepEqual(added.conflicts.map((entry) => [entry.kind, entry.path]), [["add-add", "/id"]]);
  });

  test("the same id on both sides is not a conflict", () => assert.equal(merge(deck(), withId(UUID), withId(UUID)).clean, true));
});

describe("fill: a filled deck is a new deck", () => {
  const template = { $schema: "https://openpresentation.org/schema/opf/v1", id: UUID, name: "Review for {{client}}", variables: { client: { type: "text", example: "Acme" } }, slides: [{ id: "cover", title: "{{client}}" }] };

  test("core drops the template's id, because core never mints one", () => {
    const result = fill(template, [{ client: "Northwind" }, { client: "Contoso" }], { combine: true });
    for (const filled of result.decks) assert.equal(Object.hasOwn(filled.presentation, "id"), false);
    assert.equal(Object.hasOwn(result.presentation, "id"), false);
    assert.equal(result.decks[0].presentation.name, "Review for Northwind");
  });

  test("a template without an id fills as before", () => {
    const { id: _id, ...plain } = template;
    assert.equal(Object.hasOwn(fill(plain, { client: "Northwind" }).decks[0].presentation, "id"), false);
  });
});
