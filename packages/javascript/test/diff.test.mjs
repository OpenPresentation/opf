import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { applyPatch } from "../dist/patch.js";
import { diffPresentations, formatDiffReport, matchArrays, similarity } from "../dist/diff.js";
import { mutate, loadExamples } from "./diff-support.mjs";

const slide = (id, title, extra = {}) => ({ id, title, ...extra });
const deck = (slides, extra = {}) => ({ $schema: "https://openpresentation.org/schema/opf/v1", name: "Deck", slides, ...extra });

describe("diffPresentations basics", () => {
  test("identical documents are equal, whatever the key order", () => {
    const a = deck([slide("a", "A", { text: "x", notes: "n" })]);
    const b = { slides: [{ notes: "n", text: "x", title: "A", id: "a" }], name: "Deck", $schema: a.$schema };
    const diff = diffPresentations(a, b);
    assert.equal(diff.equal, true);
    assert.deepEqual(diff.patch, []);
    assert.deepEqual(diff.changes, []);
    assert.equal(formatDiffReport(diff), "No differences.\n");
  });

  test("categorises metadata, design, field, block and slide changes", () => {
    const a = deck([slide("a", "A", { blocks: [{ text: "one" }, { text: "two" }] }), slide("b", "B")], { design: { theme: "bold" } });
    const b = deck([slide("a", "A2", { blocks: [{ text: "one" }, { text: "two" }, { chart: { type: "bar" } }] }), slide("c", "C")], { name: "Renamed", design: { theme: "minimal" }, tags: ["x"] });
    const diff = diffPresentations(a, b);
    const find = (type, category) => diff.changes.filter(change => change.type === type && change.category === category);
    assert.equal(find("changed", "metadata").length, 1);
    assert.equal(find("added", "metadata")[0].bPath, "/tags");
    assert.equal(find("changed", "design")[0].bPath, "/design/theme");
    assert.equal(find("changed", "field")[0].bPath, "/slides/0/title");
    assert.equal(find("added", "block")[0].bPath, "/slides/0/blocks/2");
    assert.equal(find("removed", "slide").length + find("added", "slide").length, 2);
    assert.deepEqual(applyPatch(a, diff.patch), b);
  });

  test("slide-level design counts as design, and slide context is attached", () => {
    const a = deck([slide("a", "A", { design: { theme: "bold" } })]);
    const b = deck([slide("a", "A", { design: { theme: "minimal" } })]);
    const [change] = diffPresentations(a, b).changes;
    assert.equal(change.category, "design");
    assert.deepEqual(change.slide, { id: "a", title: "A", aIndex: 0, bIndex: 0 });
  });

  test("the root can be replaced when the types differ", () => {
    const diff = diffPresentations({ a: 1 }, [1]);
    assert.deepEqual(diff.patch, [{ op: "replace", path: "", value: [1] }]);
  });

  test("key order and array order of the report are deterministic", () => {
    const a = deck([slide("a", "A"), slide("b", "B"), slide("c", "C")]);
    const b = deck([slide("c", "C"), slide("a", "A2"), slide("d", "D")]);
    const first = JSON.stringify(diffPresentations(a, b)), second = JSON.stringify(diffPresentations(structuredClone(a), structuredClone(b)));
    assert.equal(first, second);
  });
});

describe("slide matching", () => {
  test("matches by id, even when the content changed completely", () => {
    const a = deck([slide("intro", "Intro", { text: "hello" })]);
    const b = deck([slide("intro", "Totally different", { subtitle: "x" })]);
    const diff = diffPresentations(a, b);
    assert.equal(diff.slides[0].matchedBy, "id");
    assert.equal(diff.summary.slides.modified, 1);
    assert.equal(diff.summary.slides.added + diff.summary.slides.removed, 0);
  });

  test("without ids, identical slides match and a moved slide is one move", () => {
    const slides = ["alpha", "beta", "gamma", "delta"].map(name => ({ title: name, text: `${name} body text` }));
    const a = deck(slides);
    const b = deck([slides[0], slides[2], slides[3], slides[1]]);
    const diff = diffPresentations(a, b);
    assert.deepEqual(diff.patch, [{ op: "move", from: "/slides/1", path: "/slides/3" }]);
    assert.deepEqual(diff.summary.slides, { added: 0, removed: 0, moved: 1, modified: 0, unchanged: 3 });
    assert.equal(diff.changes.length, 1);
    assert.equal(diff.changes[0].type, "moved");
  });

  test("without ids, an edited slide matches by content similarity", () => {
    const a = deck([{ title: "Quarterly revenue review", text: "Revenue grew eleven percent across all regions", layout: "text-1x" }, { title: "Other", text: "Unrelated content here" }]);
    const b = deck([{ title: "Quarterly revenue review", text: "Revenue grew twelve percent across all regions", layout: "text-1x" }, { title: "Other", text: "Unrelated content here" }]);
    const diff = diffPresentations(a, b);
    assert.equal(diff.slides[0].matchedBy, "similar");
    assert.ok(diff.slides[0].similarity >= 0.5);
    assert.deepEqual(diff.patch, [{ op: "replace", path: "/slides/0/text", value: "Revenue grew twelve percent across all regions" }]);
  });

  test("a renamed id with the same content is matched, not removed and re-added", () => {
    const body = { title: "Roadmap", text: "Ship the thing in the third quarter", layout: "text-1x", notes: "note" };
    const diff = diffPresentations(deck([{ id: "old", ...body }]), deck([{ id: "new", ...body }]));
    assert.equal(diff.summary.slides.added + diff.summary.slides.removed, 0);
    assert.deepEqual(diff.patch, [{ op: "replace", path: "/slides/0/id", value: "new" }]);
  });

  test("dissimilar slides with different ids stay separate", () => {
    const diff = diffPresentations(deck([slide("a", "One", { text: "alpha" })]), deck([slide("b", "Two", { text: "omega" })]));
    assert.deepEqual(diff.summary.slides, { added: 1, removed: 1, moved: 0, modified: 0, unchanged: 0 });
  });

  test("moved and modified at once", () => {
    const a = deck([slide("a", "A"), slide("b", "B"), slide("c", "C")]);
    const b = deck([slide("c", "C changed"), slide("a", "A"), slide("b", "B")]);
    const diff = diffPresentations(a, b);
    assert.equal(diff.summary.slides.moved, 1);
    assert.deepEqual(diff.slides[0], { id: "c", title: "C changed", aIndex: 2, bIndex: 0, matchedBy: "id", status: "moved-modified" });
    assert.deepEqual(applyPatch(a, diff.patch), b);
  });

  test("blocks, list items and table rows are matched too", () => {
    const a = deck([slide("a", "A", { blocks: [{ text: "first" }, { text: "second" }, { text: "third" }], bullets: ["x", "y", "z"] })]);
    const b = deck([slide("a", "A", { blocks: [{ text: "third" }, { text: "first" }, { text: "second" }], bullets: ["x", "Y", "z"] })]);
    const diff = diffPresentations(a, b);
    assert.deepEqual(diff.patch, [{ op: "move", from: "/slides/0/blocks/2", path: "/slides/0/blocks/0" }, { op: "replace", path: "/slides/0/bullets/1", value: "Y" }]);
    assert.ok(diff.changes.some(change => change.type === "moved" && change.category === "block"));
  });

  test("matchArrays: ids first, equal next, similar last, deterministic ties", () => {
    const a = [{ id: "x", v: 1 }, { v: 2 }, { k: "same words here", n: 1 }, "q"];
    const b = ["q", { k: "same words here", n: 2 }, { v: 2 }, { id: "x", v: 9 }];
    const match = matchArrays(a, b);
    const by = Object.fromEntries(match.pairs.map(pair => [pair.a, `${pair.b}:${pair.by}`]));
    assert.deepEqual(by, { 0: "3:id", 1: "2:equal", 2: "1:similar", 3: "0:equal" });
    assert.deepEqual(match.removed, []);
    assert.deepEqual(match.added, []);
    const positional = matchArrays(["a", "b", "c"], ["a", "B", "c"]);
    assert.deepEqual(positional.pairs.map(pair => `${pair.a}:${pair.b}:${pair.by}`), ["0:0:equal", "1:1:position", "2:2:equal"]);
    assert.equal(similarity({ a: 1 }, { a: 1 }), 1);
    assert.equal(similarity({ a: 1 }, { b: 2 }), 0);
  });
});

describe("report", () => {
  test("renders a stable plain-text report", () => {
    const a = deck([slide("intro", "Intro", { text: "hello" }), slide("old", "Old"), slide("end", "End", { blocks: [{ text: "keep" }] })], { design: { theme: "bold" } });
    const b = deck([slide("end", "End", { blocks: [{ text: "keep" }, { chart: { type: "bar" } }] }), slide("intro", "Welcome", { text: "hello" }), slide("new", "New")], { name: "Renamed", design: { theme: "minimal" } });
    const report = formatDiffReport(diffPresentations(a, b));
    assert.equal(report, [
      "7 changes (slides: 1 added, 1 removed, 1 moved, 2 modified; metadata: 1; design: 1)",
      "",
      "Metadata",
      '  ~ name  "Deck" -> "Renamed"',
      "",
      "Design",
      '  ~ design.theme  "bold" -> "minimal"',
      "",
      "Slides",
      '  ~ slide #1 "End" (id end)',
      "      + blocks[1]  chart",
      '  ~ slide #2 "Welcome" (id intro) (moved from #1)',
      '      ~ title  "Intro" -> "Welcome"',
      '  + slide #3 "New" (id new)',
      '  - slide #2 "Old" (id old)',
      "",
    
    ].join("\n"));
  });
});

describe("patch correctness over the example decks", () => {
  const examples = loadExamples();
  test("127 example decks are covered", () => assert.equal(examples.length, 127));
  for (const { file, raw } of examples) {
    test(file, () => {
      const deckA = JSON.parse(raw);
      assert.equal(diffPresentations(deckA, JSON.parse(raw)).equal, true);
      for (const [seed, strip] of [[1, false], [2, false], [3, true]]) {
        const deckB = mutate(deckA, seed * 7919 + file.length, { strip });
        const diff = diffPresentations(deckA, deckB);
        const input = structuredClone(deckA);
        assert.deepEqual(applyPatch(input, diff.patch), deckB, `${file} seed ${seed}`);
        assert.deepEqual(input, deckA);
        // The reverse direction also produces a correct patch.
        assert.deepEqual(applyPatch(deckB, diffPresentations(deckB, deckA).patch), deckA);
        assert.equal(diff.equal, diff.patch.length === 0);
      }
    });
  }
});

describe("diff fuzz: the patch always turns A into B", () => {
  const generate = (rand, depth = 0) => {
    const kind = rand(depth > 3 ? 4 : 7);
    if (kind === 0) return rand(5);
    if (kind === 1) return ["a", "b", "c", "dup", "dup"][rand(5)];
    if (kind === 2) return rand(2) === 0;
    if (kind === 3) return null;
    if (kind === 4 || kind === 5) return Array.from({ length: rand(6) }, () => generate(rand, depth + 1));
    const object = {};
    for (let i = rand(5); i > 0; i--) object[["id", "title", "x", "y", "z"][rand(5)]] = rand(3) === 0 ? `s${rand(4)}` : generate(rand, depth + 1);
    return object;
  };
  const edit = (rand, value, depth = 0) => {
    if (rand(4) === 0) return generate(rand, depth + 1);
    if (Array.isArray(value)) {
      const next = value.map(item => edit(rand, item, depth + 1));
      for (let i = rand(3); i > 0; i--) {
        const op = rand(3);
        if (op === 0 && next.length) next.splice(rand(next.length), 1);
        else if (op === 1) next.splice(rand(next.length + 1), 0, generate(rand, depth + 1));
        else if (next.length > 1) { const [item] = next.splice(rand(next.length), 1); next.splice(rand(next.length + 1), 0, item); }
      }
      return next;
    }
    if (value && typeof value === "object") {
      const next = {};
      for (const key of Object.keys(value)) if (rand(6) !== 0) next[key] = rand(2) ? edit(rand, value[key], depth + 1) : value[key];
      if (rand(3) === 0) next[["id", "title", "x", "y", "z", "w"][rand(6)]] = generate(rand, depth + 1);
      return next;
    }
    return rand(3) === 0 ? generate(rand, depth + 1) : value;
  };
  test("2000 random documents", () => {
    let seed = 7;
    const rand = n => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed % n; };
    for (let round = 0; round < 2000; round++) {
      const a = { slides: Array.from({ length: 1 + rand(6) }, () => generate(rand)), meta: generate(rand) };
      const b = edit(rand, a);
      const diff = diffPresentations(a, b);
      assert.deepEqual(applyPatch(a, diff.patch), b, `round ${round}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
      assert.equal(diffPresentations(b, b).equal, true);
    }
  });
});
