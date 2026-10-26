import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, test } from "node:test";

import * as root from "../dist/index.js";
import * as browser from "../dist/browser.js";
import * as idsEntry from "../dist/ids.js";
import {
  OPFIdError,
  assignIds,
  documentHash,
  idToken,
  isIdToken,
  resolveIdPatch,
  resolveIdPointer,
  toIdPatch,
  toIdPointer,
  touches,
} from "../dist/ids.js";
import { OPFPatchError, OPFPatchHashError, applyPatch, applyPatchWithInverse, getAtPointer, hasPointer, readPointer } from "../dist/patch.js";
const { edit } = root;
import { validate } from "../dist/validator.js";
import { diff } from "../dist/diff.js";
import { loadExamples } from "./diff-support.mjs";

const deck = () => ({
  $schema: "https://openpresentation.org/schema/opf/v1",
  name: "Deck",
  slides: [
    { id: "intro", title: "Intro", text: "Hello", blocks: [] },
    { id: "kpis", title: "KPIs", blocks: [{ id: "kpi-row", blocks: [{ id: "kpi-a", text: "A" }, { text: "B" }] }, { id: "note", text: "Note" }] },
    { id: "close", title: "Close", blocks: [], left: { id: "left-text", text: "L" }, right: { text: "R" } },
  ],
});

const code = (fn) => { try { fn(); } catch (error) { return error.code; } return undefined; };
const jcs = (value) => JSON.stringify(value, (_key, item) => (item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map((name) => [name, item[name]])) : item));

describe("documentHash", () => {
  test("is sha256: and the SHA-256 of the key-sorted JSON, whatever the length of the text (padding boundaries)", () => {
    for (let length = 0; length < 260; length += 1) {
      const document = { z: "x".repeat(length), a: [1, { y: 2, b: null }] };
      const expected = `sha256:${createHash("sha256").update(jcs(document), "utf8").digest("hex")}`;
      assert.equal(documentHash(document), expected, `length ${length}`);
    }
    const unicode = { name: "Zürich \u{1F600} 東京  ", slides: [] };
    assert.equal(documentHash(unicode), `sha256:${createHash("sha256").update(jcs(unicode), "utf8").digest("hex")}`);
    assert.match(documentHash(deck()), /^sha256:[0-9a-f]{64}$/);
  });

  test("agrees with Node's SHA-256 on the FIPS 180-4 messages and on a multi-block one", () => {
    // A string's canonical text is its JSON text, quotes included.
    for (const text of ["", "abc", "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq", "a".repeat(1000)]) {
      assert.equal(documentHash(text), `sha256:${createHash("sha256").update(JSON.stringify(text), "utf8").digest("hex")}`);
    }
  });

  test("does not depend on key order, and does depend on content and array order", () => {
    const a = deck();
    const reordered = { slides: a.slides.map((slide) => Object.fromEntries(Object.entries(slide).reverse())), name: a.name, $schema: a.$schema };
    assert.equal(documentHash(reordered), documentHash(a));
    const changed = deck();
    changed.slides[0].title = "Intro!";
    assert.notEqual(documentHash(changed), documentHash(a));
    const swapped = deck();
    swapped.slides.reverse();
    assert.notEqual(documentHash(swapped), documentHash(a));
    assert.notEqual(documentHash({ a: 1 }), documentHash({ a: "1" }));
    assert.notEqual(documentHash({ a: null }), documentHash({}));
  });

  test("equal documents (jsonEqual) hash alike across the 129 example decks and a JSON round trip", () => {
    for (const { file, raw } of loadExamples()) {
      const parsed = JSON.parse(raw);
      assert.equal(documentHash(parsed), documentHash(JSON.parse(JSON.stringify(parsed, null, 4))), file);
    }
  });

  test("a document with a cycle is refused", () => {
    const cyclic = {}; cyclic.self = cyclic;
    assert.throws(() => documentHash(cyclic), TypeError);
  });

  test("the browser build and the ids entry export the same function", () => {
    assert.equal(browser.documentHash, root.documentHash);
    assert.equal(idsEntry.documentHash, root.documentHash);
  });
});

describe("expectHash", () => {
  test("applies when the hash is the document's, in either spelling", () => {
    const document = deck();
    const hash = documentHash(document);
    const patch = [{ op: "replace", path: "/slides/0/title", value: "New" }];
    assert.equal(applyPatch(document, patch, { expectHash: hash }).slides[0].title, "New");
    assert.equal(applyPatch(document, patch, { expectHash: hash.slice("sha256:".length).toUpperCase() }).slides[0].title, "New");
    assert.equal(applyPatchWithInverse(document, patch, { expectHash: hash }).presentation.slides[0].title, "New");
  });

  test("a stale hash throws OPFPatchHashError and leaves the document unchanged", () => {
    const document = deck();
    const stale = documentHash(document);
    document.slides[0].title = "Edited by someone else";
    const before = structuredClone(document);
    assert.throws(
      () => applyPatch(document, [{ op: "replace", path: "/slides/0/title", value: "Mine" }], { expectHash: stale }),
      (error) => {
        assert.ok(error instanceof OPFPatchHashError);
        assert.ok(error instanceof OPFPatchError);
        assert.equal(error.code, "patch-hash-mismatch");
        assert.equal(error.expected, stale);
        assert.equal(error.actual, documentHash(before));
        return true;
      },
    );
    assert.deepEqual(document, before);
  });

  test("the hash is checked before the patch is read, and a malformed hash is its own error", () => {
    const document = deck();
    assert.equal(code(() => applyPatch(document, "not a patch", { expectHash: documentHash({}) })), "patch-hash-mismatch");
    for (const bad of ["", "sha256:abc", 12, "md5:" + "0".repeat(32), null]) assert.equal(code(() => applyPatch(document, [], { expectHash: bad })), "invalid-expect-hash", String(bad));
  });

  test("edit takes expectHash too", () => {
    const document = deck();
    const hash = documentHash(document);
    assert.equal(edit(document, [{ op: "replace", path: "/name", value: "N" }], { expectHash: hash, validate: false }).presentation.name, "N");
    assert.throws(() => edit(document, [{ op: "replace", path: "/name", value: "N" }], { expectHash: documentHash({}), validate: false }), OPFPatchHashError);
  });
});

describe("id-addressed paths", () => {
  test("the token is @id, and only a string longer than the prefix is one", () => {
    assert.equal(idToken("intro"), "@intro");
    assert.equal(isIdToken("@intro"), true);
    assert.equal(isIdToken("@"), false);
    assert.equal(isIdToken("intro"), false);
    assert.equal(isIdToken("0"), false);
  });

  test("resolveIdPointer maps ids to indexes at any depth and leaves other pointers alone", () => {
    const document = deck();
    assert.equal(resolveIdPointer(document, "/slides/@kpis/blocks/@kpi-row/blocks/@kpi-a/text"), "/slides/1/blocks/0/blocks/0/text");
    assert.equal(resolveIdPointer(document, "/slides/@close/right"), "/slides/2/right");
    assert.equal(resolveIdPointer(document, "/slides/2/title"), "/slides/2/title");
    assert.equal(resolveIdPointer(document, ""), "");
  });

  const resolveIdPointerSafe = (document, pointer) => {
    try { return resolveIdPointer(document, pointer); } catch (error) { return error.code; }
  };

  test("an id no element has is patch-id-not-found, a shared id is patch-id-ambiguous", () => {
    const document = deck();
    assert.equal(resolveIdPointerSafe(document, "/slides/@nothing/title"), "patch-id-not-found");
    document.slides.push({ id: "intro", title: "Twin" });
    assert.equal(resolveIdPointerSafe(document, "/slides/@intro/title"), "patch-id-ambiguous");
    assert.equal(readPointer(document, "/slides/@intro/title").found, false);
  });

  test("a token starting with @ is a plain key in an object", () => {
    const document = { extensions: { "@context": "c", list: [{ id: "a", v: 1 }] } };
    assert.equal(getAtPointer(document, "/extensions/@context"), "c");
    assert.equal(getAtPointer(document, "/extensions/list/@a/v"), 1);
    assert.equal(resolveIdPointer(document, "/extensions/@context"), "/extensions/@context");
    assert.equal(applyPatch(document, [{ op: "replace", path: "/extensions/@context", value: "d" }]).extensions["@context"], "d");
  });

  test("ids with /, ~ and a leading @ round-trip through the pointer escapes", () => {
    const document = { slides: [{ id: "a/b~c", t: 1 }, { id: "@weird", t: 2 }] };
    assert.equal(toIdPointer(document, "/slides/0/t"), "/slides/@a~1b~0c/t");
    assert.equal(resolveIdPointer(document, "/slides/@a~1b~0c/t"), "/slides/0/t");
    assert.equal(toIdPointer(document, "/slides/1/t"), "/slides/@@weird/t");
    assert.equal(resolveIdPointer(document, "/slides/@@weird/t"), "/slides/1/t");
  });

  test("toIdPointer names elements with a unique id and keeps the other indexes", () => {
    const document = deck();
    assert.equal(toIdPointer(document, "/slides/1/blocks/0/blocks/1/text"), "/slides/@kpis/blocks/@kpi-row/blocks/1/text");
    assert.equal(toIdPointer(document, "/slides/1/blocks/0"), "/slides/@kpis/blocks/@kpi-row");
    assert.equal(toIdPointer(document, "/slides/1/blocks/0", { keepLast: true }), "/slides/@kpis/blocks/0");
    assert.equal(toIdPointer(document, "/slides/@intro/title"), "/slides/@intro/title");
    assert.equal(toIdPointer(document, "/slides/5/title"), "/slides/5/title");
    document.slides[2].id = "intro";
    assert.equal(toIdPointer(document, "/slides/0/title"), "/slides/0/title", "a shared id names nothing");
  });

  test("readPointer, getAtPointer and hasPointer follow id tokens", () => {
    const document = deck();
    assert.equal(getAtPointer(document, "/slides/@kpis/blocks/@note/text"), "Note");
    assert.equal(hasPointer(document, "/slides/@kpis/blocks/@missing"), false);
    assert.deepEqual(readPointer(document, ["slides", "@close", "left"]), { found: true, value: { id: "left-text", text: "L" } });
  });

  test("applyPatch addresses every operation by id", () => {
    const document = deck();
    const patched = applyPatch(document, [
      { op: "replace", path: "/slides/@intro/title", value: "Welcome" },
      { op: "add", path: "/slides/@kpis/blocks/-", value: { id: "extra", text: "X" } },
      { op: "add", path: "/slides/@kpis/blocks/@note", value: { id: "before-note", text: "BN" } },
      { op: "remove", path: "/slides/@close/left" },
      { op: "test", path: "/slides/@kpis/blocks/@kpi-row/blocks/@kpi-a/text", value: "A" },
      { op: "copy", from: "/slides/@intro/title", path: "/slides/@close/subtitle" },
    ]);
    assert.equal(patched.slides[0].title, "Welcome");
    assert.deepEqual(patched.slides[1].blocks.map((block) => block.id), ["kpi-row", "before-note", "note", "extra"]);
    assert.equal(patched.slides[2].left, undefined);
    assert.equal(patched.slides[2].subtitle, "Welcome");
    assert.equal(document.slides[0].title, "Intro", "the input is not changed");
  });

  test("a move reads its destination after the value has left, and ids are not confused by earlier operations", () => {
    const document = deck();
    // Move the first slide before "close": after the removal "close" is at index 1.
    const moved = applyPatch(document, [{ op: "move", from: "/slides/@intro", path: "/slides/@close" }]);
    assert.deepEqual(moved.slides.map((slide) => slide.id), ["kpis", "intro", "close"]);
    // A block into another slide, then an edit to it by id, in one patch.
    const patched = applyPatch(document, [
      { op: "move", from: "/slides/@kpis/blocks/@note", path: "/slides/@intro/blocks/-" },
      { op: "replace", path: "/slides/@intro/blocks/@note/text", value: "Moved" },
    ]);
    assert.deepEqual(patched.slides[0].blocks, [{ id: "note", text: "Moved" }]);
    assert.equal(code(() => applyPatch(document, [{ op: "move", from: "/slides/@kpis", path: "/slides/@kpis/blocks/@note/x" }])), "patch-invalid-move");
  });

  test("the inverse is in index form and undoes an id-addressed patch", () => {
    const document = deck();
    const patch = [
      { op: "replace", path: "/slides/@intro/title", value: "Welcome" },
      { op: "move", from: "/slides/@kpis/blocks/@note", path: "/slides/@close/blocks/-" },
      { op: "remove", path: "/slides/@kpis/blocks/@kpi-row/blocks/@kpi-a" },
    ];
    const { presentation, inverse, patch: applied } = applyPatchWithInverse(document, patch);
    for (const operation of inverse) assert.equal([operation.path, operation.from].filter(Boolean).some((pointer) => pointer.includes("/@")), false, JSON.stringify(operation));
    assert.deepEqual(applyPatch(presentation, inverse), document);
    assert.deepEqual(applied.map((operation) => operation.path), patch.map((operation) => operation.path), "the normalized patch keeps the paths as written");
  });

  test("errors name the operation and the path", () => {
    const document = deck();
    assert.throws(() => applyPatch(document, [{ op: "replace", path: "/slides/@intro/title", value: "x" }, { op: "remove", path: "/slides/@gone/title" }]), (error) => {
      assert.equal(error.code, "patch-id-not-found");
      assert.equal(error.index, 1);
      assert.equal(error.path, "/slides/@gone/title");
      return true;
    });
  });

  test("resolveIdPatch resolves operation by operation, against the document each runs on", () => {
    const document = deck();
    const resolved = resolveIdPatch(document, [
      { op: "move", from: "/slides/@close", path: "/slides/0" },
      { op: "replace", path: "/slides/@close/title", value: "First" },
      { op: "replace", path: "/slides/@intro/title", value: "Second" },
      { op: "add", path: "/slides/@kpis/blocks/-", value: { text: "t" } },
    ]);
    assert.deepEqual(resolved.map((operation) => operation.path), ["/slides/0", "/slides/0/title", "/slides/1/title", "/slides/2/blocks/2"]);
    assert.equal(resolved[0].from, "/slides/2");
    assert.deepEqual(applyPatch(document, resolved), applyPatch(document, [
      { op: "move", from: "/slides/@close", path: "/slides/0" },
      { op: "replace", path: "/slides/@close/title", value: "First" },
      { op: "replace", path: "/slides/@intro/title", value: "Second" },
      { op: "add", path: "/slides/@kpis/blocks/-", value: { text: "t" } },
    ]));
  });

  test("toIdPatch writes ids where elements have them and the result applies to the same effect", () => {
    const document = deck();
    const patch = [
      { op: "replace", path: "/slides/0/title", value: "Welcome" },
      { op: "move", from: "/slides/2", path: "/slides/0" },
      { op: "add", path: "/slides/1/blocks/-", value: { id: "n", text: "n" } },
      { op: "remove", path: "/slides/2/blocks/0/blocks/1" },
      { op: "copy", from: "/slides/0/left", path: "/slides/1/left" },
      { op: "test", path: "/slides/1/title", value: "Welcome" },
    ];
    const withIds = toIdPatch(document, patch);
    assert.deepEqual(withIds.map((operation) => operation.path), [
      "/slides/@intro/title",
      "/slides/0",
      "/slides/@intro/blocks/-",
      "/slides/@kpis/blocks/@kpi-row/blocks/1",
      "/slides/@intro/left",
      "/slides/@intro/title",
    ]);
    assert.deepEqual(applyPatch(document, withIds), applyPatch(document, patch));
  });

  test("toIdPatch names an insertion's ancestors by the ids they have before it, so assigning an id is replayable", () => {
    const { patch } = assignIds({ slides: [{ title: "One", blocks: [{ text: "a" }] }, { id: "two" }] });
    assert.deepEqual(toIdPatch({ slides: [{ title: "One", blocks: [{ text: "a" }] }, { id: "two" }] }, patch).map((operation) => operation.path), ["/slides/0/id", "/slides/@slide-1/blocks/0/id"]);
    const document = deck();
    // The second operation comes after the first has given slide 0 its id, so it may name the slide by it.
    const [inserted] = toIdPatch(document, [{ op: "add", path: "/slides/1/blocks/0", value: { text: "first" } }]);
    assert.equal(inserted.path, "/slides/@kpis/blocks/0", "the insertion point is an index: the element at it is not the one that is added");
  });

  test("an id-addressed patch survives a reorder that moves the indexes under it", () => {
    const base = deck();
    const edit1 = toIdPatch(base, [{ op: "replace", path: "/slides/1/blocks/1/text", value: "Edited note" }]);
    const reordered = applyPatch(base, [{ op: "move", from: "/slides/1", path: "/slides/0" }, { op: "remove", path: "/slides/1/title" }]);
    const result = applyPatch(reordered, edit1);
    assert.equal(result.slides[0].blocks[1].text, "Edited note");
  });
});

describe("assignIds", () => {
  const bare = () => ({
    $schema: "https://openpresentation.org/schema/opf/v1",
    name: "Bare",
    slides: [
      { title: "One", text: "t" },
      { id: "slide-1", title: "Taken", blocks: [{ text: "a" }, { blocks: [{ text: "b" }, { id: "block-1", text: "c" }] }] },
      { title: "Three", left: { text: "L" }, right: { text: "R" } },
    ],
  });

  test("fills the missing ids deterministically and never changes an existing one", () => {
    const input = bare();
    const frozen = structuredClone(input);
    const { document, patch, assigned } = assignIds(input);
    assert.deepEqual(input, frozen, "the input is not changed");
    assert.deepEqual(assigned.map((entry) => [entry.pointer, entry.id]), [
      ["/slides/0", "slide-2"],
      ["/slides/1/blocks/0", "block-2"],
      ["/slides/1/blocks/1", "block-3"],
      ["/slides/1/blocks/1/blocks/0", "block-4"],
      ["/slides/2", "slide-3"],
      ["/slides/2/left", "block-5"],
      ["/slides/2/right", "block-6"],
    ]);
    assert.equal(document.slides[1].id, "slide-1");
    assert.equal(document.slides[1].blocks[1].blocks[1].id, "block-1");
    assert.deepEqual(assignIds(input), { document, patch, assigned }, "the same input gives the same result");
    assert.deepEqual(applyPatch(input, patch), document, "the patch is the same change");
    assert.equal(patch.every((operation) => operation.op === "add" && operation.path.endsWith("/id")), true);
  });

  test("is idempotent and its output is valid against the schema", () => {
    const { document } = assignIds(bare());
    const again = assignIds(document);
    assert.deepEqual(again.patch, []);
    assert.deepEqual(again.document, document);
    const report = validate(document, { only: ["format"] });
    assert.equal(report.valid, true, JSON.stringify(report.findings.filter((finding) => finding.severity === "error")));
    const ids = [];
    const collect = (node) => { if (node && typeof node === "object") { if (typeof node.id === "string") ids.push(node.id); for (const value of Object.values(node)) collect(value); } };
    collect(document.slides);
    assert.equal(new Set(ids).size, ids.length, "slide and payload ids are unique");
  });

  test("every example deck gets ids, stays valid, and keeps the ids it had", () => {
    for (const { file, raw } of loadExamples()) {
      const input = JSON.parse(raw);
      if (!Array.isArray(input.slides)) continue;
      const before = validate(input, { only: ["format"] }).valid;
      const { document, assigned } = assignIds(input);
      const result = validate(document, { only: ["format"] });
      assert.equal(result.valid, before, file);
      for (const [index, slide] of input.slides.entries()) if (slide.id !== undefined) assert.equal(document.slides[index].id, slide.id, file);
      assert.equal(assignIds(document).assigned.length, 0, file);
      assert.equal(new Set(assigned.map((entry) => entry.id)).size, assigned.length, file);
    }
  });

  test("assigned ids make diff match the slides without similarity guessing", () => {
    const { document } = assignIds(bare());
    const reordered = structuredClone(document);
    reordered.slides.reverse();
    assert.equal(diff(document, reordered).changes.some((change) => change.type === "moved"), true);
  });

  test("generate chooses the ids and hears the kind, the pointer, the node and the parent id", () => {
    const calls = [];
    const { document } = assignIds(bare(), {
      generate: ({ kind, pointer, node, parentId }) => {
        calls.push({ kind, pointer, parentId, title: node.title });
        return `${kind[0]}:${pointer.slice(1).replaceAll("/", ".")}`;
      },
    });
    assert.equal(document.slides[0].id, "s:slides.0");
    assert.equal(document.slides[1].blocks[1].blocks[0].id, "b:slides.1.blocks.1.blocks.0");
    assert.deepEqual(calls.find((call) => call.pointer === "/slides/1/blocks/1"), { kind: "block", pointer: "/slides/1/blocks/1", parentId: "slide-1", title: undefined });
    assert.deepEqual(calls.find((call) => call.pointer === "/slides/1/blocks/1/blocks/0").parentId, "b:slides.1.blocks.1");
    assert.equal(calls.find((call) => call.pointer === "/slides/0").parentId, undefined);
  });

  test("a generate that returns an unusable id throws OPFIdError", () => {
    for (const [value, expected] of [["", "invalid-id"], [7, "invalid-id"], ["slide-1", "duplicate-id"]]) {
      assert.throws(() => assignIds(bare(), { generate: () => value }), (error) => error instanceof OPFIdError && error.code === expected && error.path === "/slides/0");
    }
    assert.throws(() => assignIds(bare(), { generate: () => "same" }), (error) => error.code === "duplicate-id" && error.path === "/slides/1/blocks/0", "a repeated id is caught across nodes");
    assert.equal(code(() => assignIds("no")), "invalid-document");
    assert.equal(code(() => assignIds([])), "invalid-document");
  });

  test("a document without slides is returned as a copy", () => {
    const result = assignIds({ name: "Empty" });
    assert.deepEqual(result, { document: { name: "Empty" }, patch: [], assigned: [] });
  });

  test("the editor and a patch can use the assigned ids at once", () => {
    const { document } = assignIds(bare());
    const patched = applyPatch(document, [{ op: "replace", path: "/slides/@slide-2/title", value: "Renamed" }]);
    assert.equal(patched.slides[0].title, "Renamed");
  });
});

describe("touches", () => {
  const writesOf = (scope) => scope.writes.map((touch) => [touch.op, touch.pointer, touch.idPointer, touch.kind]);

  test("without a document, reports the pointers as written, the id tokens and the inserted ids", () => {
    const scope = touches([
      { op: "replace", path: "/slides/@intro/title", value: "x" },
      { op: "add", path: "/slides/@kpis/blocks/-", value: { id: "new", text: "n" } },
      { op: "test", path: "/name", value: "Deck" },
      { op: "remove", path: "/slides/@close/left" },
    ]);
    assert.deepEqual(scope.reads.map((touch) => [touch.pointer, touch.kind]), [["/name", "metadata"]]);
    assert.deepEqual(writesOf(scope), [
      ["replace", "/slides/@intro/title", "/slides/@intro/title", "slide"],
      ["add", "/slides/@kpis/blocks/-", "/slides/@kpis/blocks/-", "block"],
      ["remove", "/slides/@close/left", "/slides/@close/left", "block"],
    ]);
    assert.deepEqual(scope.ids, ["intro", "kpis", "new", "close"]);
    assert.deepEqual(scope.slideIds, ["intro", "kpis", "close"]);
    assert.deepEqual(scope.kinds, ["slide", "block", "metadata"]);
  });

  test("with a document, resolves each location as it is when its operation runs, in index and id form", () => {
    const document = deck();
    const scope = touches([
      { op: "move", from: "/slides/2", path: "/slides/0" },
      { op: "replace", path: "/slides/0/title", value: "Closing" },
      { op: "replace", path: "/slides/@intro/title", value: "Opening" },
      { op: "add", path: "/slides/@kpis/blocks/-", value: { id: "added", text: "a" } },
    ], document);
    assert.deepEqual(writesOf(scope), [
      ["move", "/slides/2", "/slides/@close", "slide-order"],
      ["move", "/slides/0", "/slides/@close", "slide-order"],
      ["replace", "/slides/0/title", "/slides/@close/title", "slide"],
      ["replace", "/slides/1/title", "/slides/@intro/title", "slide"],
      ["add", "/slides/2/blocks/2", "/slides/@kpis/blocks/@added", "block"],
    ]);
    assert.deepEqual(scope.slideIds, ["close", "intro", "kpis"]);
    assert.ok(scope.ids.includes("left-text") && scope.ids.includes("added"));
    assert.deepEqual(document, deck(), "the document is not changed");
  });

  test("removing, replacing or moving a slide or a group lists everything inside it", () => {
    const document = deck();
    const removed = touches([{ op: "remove", path: "/slides/@kpis" }], document);
    assert.deepEqual(removed.writes[0].ids, ["kpis", "kpi-row", "kpi-a", "note"]);
    assert.deepEqual(removed.writes[0].slideIds, ["kpis"]);
    const replaced = touches([{ op: "replace", path: "/slides/1/blocks/0", value: { id: "other", text: "o" } }], document);
    assert.deepEqual(replaced.writes[0].ids, ["kpis", "kpi-row", "kpi-a", "other"]);
    const whole = touches([{ op: "replace", path: "", value: { slides: [{ id: "only", title: "x" }] } }], document);
    assert.deepEqual(whole.kinds, ["document"]);
    assert.deepEqual(whole.writes[0].slideIds, ["intro", "kpis", "close", "only"]);
    const regions = touches([{ op: "remove", path: "/slides/2/left" }], document);
    assert.deepEqual(regions.writes[0].ids, ["close", "left-text"]);
    assert.equal(regions.writes[0].kind, "block");
  });

  test("copy reads its source and writes its destination; test only reads", () => {
    const document = deck();
    const scope = touches([
      { op: "copy", from: "/slides/@intro/text", path: "/slides/@close/text" },
      { op: "test", path: "/slides/@kpis/title", value: "KPIs" },
      { op: "copy", from: "/slides/@kpis/blocks/@note", path: "/slides/@intro/blocks/-" },
    ], document);
    assert.deepEqual(scope.reads.map((touch) => touch.idPointer), ["/slides/@intro/text", "/slides/@kpis/title", "/slides/@kpis/blocks/@note"]);
    assert.deepEqual(scope.writes.map((touch) => touch.idPointer), ["/slides/@close/text", "/slides/@intro/blocks/@note"]);
    const assigning = touches([{ op: "add", path: "/slides/0/id", value: "fresh" }], { slides: [{ title: "No id" }] });
    assert.equal(assigning.writes[0].idPointer, "/slides/0/id", "an id the patch itself adds does not name the slide it is added to");
    assert.equal(scope.reads[2].ids.includes("note"), true);
    assert.equal(scope.writes[1].ids.includes("note"), true, "the copy carries the block id");
    assert.deepEqual(scope.reads.map((touch) => touch.operation), [0, 1, 2]);
  });

  test("classifies the parts of the document", () => {
    const document = { ...deck(), design: { theme: "x" }, assets: {}, catalogs: {}, language: "en" };
    document.slides[0].design = { theme: "y" };
    const kind = (path) => touches([{ op: "test", path, value: null }].map((operation) => ({ ...operation })), undefined).reads[0].kind;
    assert.equal(kind("/design/theme"), "design");
    assert.equal(kind("/slides/0/design/theme"), "design");
    assert.equal(kind("/assets/a"), "assets");
    assert.equal(kind("/catalogs/custom"), "catalogs");
    assert.equal(kind("/language"), "metadata");
    assert.equal(kind("/extensions/x"), "metadata");
    assert.equal(kind("/slides"), "slide-order");
    assert.equal(kind("/slides/0"), "slide");
    assert.equal(kind("/slides/0/title"), "slide");
    assert.equal(kind("/slides/0/blocks"), "block");
    assert.equal(kind("/slides/0/blocks/1/blocks/0/text"), "block");
    assert.equal(kind("/slides/0/left"), "block");
    assert.equal(kind(""), "document");
    const order = touches([{ op: "add", path: "/slides/-", value: { title: "n" } }, { op: "remove", path: "/slides/0" }, { op: "add", path: "/slides", value: [] }], document);
    assert.deepEqual(order.writes.map((touch) => touch.kind), ["slide-order", "slide-order", "slide-order"]);
    assert.deepEqual(order.writes[0].pointer, "/slides/3");
  });

  test("a patch that does not apply throws what applyPatch throws; an invalid patch throws without a document too", () => {
    const document = deck();
    assert.equal(code(() => touches([{ op: "replace", path: "/slides/@gone/title", value: "x" }], document)), "patch-id-not-found");
    assert.equal(code(() => touches([{ op: "remove", path: "/slides/9" }], document)), "invalid-array-index");
    assert.equal(code(() => touches([{ op: "test", path: "/name", value: "Other" }], document)), "patch-test-failed");
    assert.equal(code(() => touches({ not: "a patch" })), "invalid-patch");
    assert.equal(code(() => touches([{ op: "nope", path: "/x" }])), "unsupported-patch-operation");
  });

  test("two patches conflict when their id pointers or ids meet", () => {
    const document = deck();
    // A write conflicts with a touch of the same place, or one inside or above it; a move changes where an element sits, not what is inside it.
    const meets = (x, y) => x.idPointer === y.idPointer || (x.op !== "move" && y.idPointer.startsWith(`${x.idPointer}/`)) || (y.op !== "move" && x.idPointer.startsWith(`${y.idPointer}/`));
    const conflicts = (a, b) => {
      const left = touches(a, document), right = touches(b, document);
      return left.writes.some((w) => [...right.writes, ...right.reads].some((o) => meets(w, o)));
    };
    const editText = [{ op: "replace", path: "/slides/1/blocks/1/text", value: "x" }];
    const reorder = [{ op: "move", from: "/slides/1", path: "/slides/0" }];
    const removeSlide = [{ op: "remove", path: "/slides/1" }];
    assert.equal(conflicts(editText, reorder), false, "a reorder does not touch the text inside a block");
    assert.equal(conflicts(editText, removeSlide), true, "removing the slide destroys the block");
    assert.equal(conflicts(editText, [{ op: "replace", path: "/slides/0/title", value: "y" }]), false);
    assert.deepEqual(touches(removeSlide, document).writes[0].ids.filter((id) => touches(editText, document).ids.includes(id)).sort(), ["kpis", "note"]);
  });

  test("the root and the ids entry export the verbs, and the browser build agrees", () => {
    for (const name of ["assignIds", "documentHash", "touches", "resolveIdPointer", "toIdPointer", "resolveIdPatch", "toIdPatch", "idToken", "isIdToken", "OPFIdError", "OPFPatchHashError"]) {
      assert.equal(typeof root[name], "function", name);
      assert.equal(browser[name], root[name], name);
      assert.equal(idsEntry[name], root[name], name);
    }
  });
});
