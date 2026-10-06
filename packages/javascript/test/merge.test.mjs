import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { mergePresentations } from "../dist/diff.js";

import { loadExamples, mutate } from "./diff-support.mjs";
import { check } from './support/validation.mjs';

const slide = (id, title, extra = {}) => ({ id, title, ...extra });
const deck = (slides, extra = {}) => ({ $schema: "https://openpresentation.org/schema/opf/v1", name: "Deck", slides, ...extra });
const ids = document => document.slides.map(item => item.id);

const base = () => deck([slide("a", "A", { notes: "na" }), slide("b", "B"), slide("c", "C"), slide("d", "D")], { design: { theme: "bold" }, description: "d" });

describe("clean merges", () => {
  test("changes to different places merge automatically from both sides", () => {
    const ours = base();
    ours.slides[0].title = "A by us";
    ours.design = { theme: "bold", dimensions: "widescreen" };
    const theirs = base();
    theirs.slides[2].notes = "added by them";
    theirs.name = "Renamed by them";
    delete theirs.description;
    const result = mergePresentations(base(), ours, theirs);
    assert.equal(result.clean, true);
    assert.deepEqual(result.conflicts, []);
    const expected = base();
    expected.slides[0].title = "A by us";
    expected.design = { theme: "bold", dimensions: "widescreen" };
    expected.slides[2].notes = "added by them";
    expected.name = "Renamed by them";
    delete expected.description;
    assert.deepEqual(result.merged, expected);
    assert.equal(result.applied.ours, 2);
    assert.equal(result.applied.theirs, 3);
  });

  test("the same edit on both sides is not a conflict", () => {
    const ours = base(), theirs = base();
    ours.slides[1].title = theirs.slides[1].title = "B2";
    const result = mergePresentations(base(), ours, theirs);
    assert.equal(result.clean, true);
    assert.equal(result.merged.slides[1].title, "B2");
    assert.equal(result.applied.both, 1);
  });

  test("identical inputs and one-sided changes", () => {
    const b = base();
    assert.deepEqual(mergePresentations(b, b, b).merged, b);
    const edited = mutate(b, 11);
    assert.deepEqual(mergePresentations(b, edited, b).merged, edited);
    assert.deepEqual(mergePresentations(b, b, edited).merged, edited);
    assert.deepEqual(mergePresentations(b, edited, edited).merged, edited);
  });

  test("slides added on both sides are all kept, ours first at the same position", () => {
    const ours = base(), theirs = base();
    ours.slides.splice(1, 0, slide("o1", "Ours one"));
    theirs.slides.splice(1, 0, slide("t1", "Theirs one"));
    theirs.slides.push(slide("t2", "Theirs end"));
    const { merged, clean } = mergePresentations(base(), ours, theirs);
    assert.equal(clean, true);
    assert.deepEqual(ids(merged), ["a", "o1", "t1", "b", "c", "d", "t2"]);
  });

  test("the same slide added on both sides appears once", () => {
    const ours = base(), theirs = base();
    ours.slides.push(slide("n", "New"));
    theirs.slides.push(slide("n", "New"));
    const { merged, clean } = mergePresentations(base(), ours, theirs);
    assert.equal(clean, true);
    assert.deepEqual(ids(merged), ["a", "b", "c", "d", "n"]);
  });

  test("a slide moved by one side and edited by the other keeps both", () => {
    const ours = base(), theirs = base();
    ours.slides.push(ours.slides.shift());
    theirs.slides[0].title = "A edited";
    const { merged, clean } = mergePresentations(base(), ours, theirs);
    assert.equal(clean, true);
    assert.deepEqual(ids(merged), ["b", "c", "d", "a"]);
    assert.equal(merged.slides[3].title, "A edited");
  });

  test("a slide moved by them is applied on top of our edits", () => {
    const ours = base(), theirs = base();
    ours.slides[1].title = "B edited";
    theirs.slides.unshift(theirs.slides.splice(2, 1)[0]);
    const { merged, clean } = mergePresentations(base(), ours, theirs);
    assert.equal(clean, true);
    assert.deepEqual(ids(merged), ["c", "a", "b", "d"]);
    assert.equal(merged.slides[2].title, "B edited");
  });

  test("both sides making the same move agree", () => {
    const ours = base(), theirs = base();
    for (const side of [ours, theirs]) side.slides.splice(3, 0, side.slides.splice(0, 1)[0]);
    const result = mergePresentations(base(), ours, theirs);
    assert.equal(result.clean, true);
    assert.deepEqual(ids(result.merged), ["b", "c", "d", "a"]);
  });

  test("an untouched slide deleted by one side is deleted", () => {
    const ours = base(), theirs = base();
    ours.slides.splice(1, 1);
    theirs.slides[3].title = "D edited";
    const { merged, clean } = mergePresentations(base(), ours, theirs);
    assert.equal(clean, true);
    assert.deepEqual(ids(merged), ["a", "c", "d"]);
    assert.equal(merged.slides[2].title, "D edited");
  });

  test("list items and blocks merge element-wise", () => {
    const start = deck([slide("a", "A", { bullets: ["x", "y", "z"], blocks: [{ text: "one" }, { text: "two" }] })]);
    const ours = structuredClone(start), theirs = structuredClone(start);
    ours.slides[0].bullets[0] = "X";
    ours.slides[0].blocks.push({ text: "three" });
    theirs.slides[0].bullets.push("w");
    theirs.slides[0].blocks[1] = { text: "two!" };
    const { merged, clean } = mergePresentations(start, ours, theirs);
    assert.equal(clean, true);
    assert.deepEqual(merged.slides[0].bullets, ["X", "y", "z", "w"]);
    assert.deepEqual(merged.slides[0].blocks, [{ text: "one" }, { text: "two!" }, { text: "three" }]);
  });

  test("inputs are never mutated", () => {
    const b = base(), o = mutate(b, 3), t = mutate(b, 4);
    const copies = [structuredClone(b), structuredClone(o), structuredClone(t)];
    mergePresentations(b, o, t);
    assert.deepEqual([b, o, t], copies);
  });
});

describe("conflicts", () => {
  test("both sides change the same field differently", () => {
    const ours = base(), theirs = base();
    ours.slides[1].title = "B ours";
    theirs.slides[1].title = "B theirs";
    ours.slides[3].title = "D ours";
    const result = mergePresentations(base(), ours, theirs);
    assert.equal(result.clean, false);
    assert.equal(result.conflicts.length, 1);
    assert.deepEqual(result.conflicts[0], {
      kind: "modify-modify",
      path: "/slides/1/title",
      base: "B",
      ours: "B ours",
      theirs: "B theirs",
      resolution: "ours",
      slide: { index: 1, id: "b", title: "B ours" },
      message: "Both sides changed this value differently.",
    });
    assert.equal(result.merged.slides[1].title, "B ours", "ours is kept by default");
    assert.equal(result.merged.slides[3].title, "D ours", "non-conflicting edits still merge");
  });

  test("prefer theirs takes their value and still reports the conflict", () => {
    const ours = base(), theirs = base();
    ours.name = "ours";
    theirs.name = "theirs";
    const result = mergePresentations(base(), ours, theirs, { prefer: "theirs" });
    assert.equal(result.merged.name, "theirs");
    assert.equal(result.conflicts[0].resolution, "theirs");
    assert.equal(result.conflicts[0].ours, "ours");
    assert.equal(result.conflicts[0].theirs, "theirs");
  });

  test("never silently drops a side: every conflict carries both values", () => {
    const ours = base(), theirs = base();
    ours.design = { theme: "minimal" };
    theirs.design = { theme: "editorial" };
    ours.slides[0].notes = "ours";
    theirs.slides.splice(0, 1);
    const result = mergePresentations(base(), ours, theirs);
    assert.deepEqual(result.conflicts.map(conflict => conflict.kind).sort(), ["modify-delete", "modify-modify"]);
    const design = result.conflicts.find(conflict => conflict.path === "/design/theme");
    assert.deepEqual([design.base, design.ours, design.theirs], ["bold", "minimal", "editorial"]);
    const deleted = result.conflicts.find(conflict => conflict.kind === "modify-delete");
    assert.equal(deleted.deletedBy, "theirs");
    assert.equal(deleted.ours.notes, "ours");
    assert.equal(deleted.theirs, undefined);
    assert.equal("theirs" in deleted, false);
    // Ours is kept, so the edited slide survives.
    assert.deepEqual(ids(result.merged), ["a", "b", "c", "d"]);
    // Taking theirs removes the slide, and the conflict still shows what was lost.
    const taken = mergePresentations(base(), ours, theirs, { prefer: "theirs" });
    assert.deepEqual(ids(taken.merged), ["b", "c", "d"]);
    assert.equal(taken.conflicts.find(conflict => conflict.kind === "modify-delete").ours.notes, "ours");
  });

  test("delete-modify when we deleted what they edited", () => {
    const ours = base(), theirs = base();
    ours.slides.splice(2, 1);
    theirs.slides[2].title = "C edited";
    const result = mergePresentations(base(), ours, theirs);
    assert.equal(result.conflicts.length, 1);
    assert.equal(result.conflicts[0].kind, "delete-modify");
    assert.equal(result.conflicts[0].deletedBy, "ours");
    assert.equal(result.conflicts[0].theirs.title, "C edited");
    assert.deepEqual(ids(result.merged), ["a", "b", "d"]);
    assert.deepEqual(ids(mergePresentations(base(), ours, theirs, { prefer: "theirs" }).merged), ["a", "b", "c", "d"]);
  });

  test("a field deleted by one side and changed by the other", () => {
    const ours = base(), theirs = base();
    delete ours.slides[0].notes;
    theirs.slides[0].notes = "changed";
    const result = mergePresentations(base(), ours, theirs);
    assert.equal(result.conflicts[0].kind, "delete-modify");
    assert.equal(result.conflicts[0].path, "/slides/0/notes");
    assert.equal("notes" in result.merged.slides[0], false);
  });

  test("both sides added different values for the same new key", () => {
    const ours = base(), theirs = base();
    ours.language = "english-us";
    theirs.language = "english-gb";
    const result = mergePresentations(base(), ours, theirs);
    assert.equal(result.conflicts[0].kind, "add-add");
    assert.equal(result.merged.language, "english-us");
  });

  test("both sides added the same new object with different leaves: only the leaves conflict", () => {
    const ours = base(), theirs = base();
    ours.organization = { name: "Acme", domain: "acme.example" };
    theirs.organization = { name: "Acme", tagline: "Hi" };
    const result = mergePresentations(base(), ours, theirs);
    assert.equal(result.clean, true);
    assert.deepEqual(result.merged.organization, { name: "Acme", domain: "acme.example", tagline: "Hi" });
    theirs.organization = { name: "Acme Inc", tagline: "Hi" };
    const conflicted = mergePresentations(base(), ours, theirs);
    assert.deepEqual(conflicted.conflicts.map(conflict => conflict.path), ["/organization/name"]);
  });

  test("a type conflict is a modify-modify", () => {
    const ours = deck([slide("a", "A", { text: "plain" })]), theirs = deck([slide("a", "A", { text: [{ text: "rich", bold: true }] })]);
    const start = deck([slide("a", "A", { text: "start" })]);
    const result = mergePresentations(start, ours, theirs);
    assert.equal(result.conflicts[0].kind, "modify-modify");
    assert.equal(result.conflicts[0].path, "/slides/0/text");
  });

  test("both sides moved the same slide to different places", () => {
    const ours = base(), theirs = base();
    ours.slides.splice(3, 0, ours.slides.splice(0, 1)[0]);
    theirs.slides.splice(2, 0, theirs.slides.splice(0, 1)[0]);
    const result = mergePresentations(base(), ours, theirs);
    assert.deepEqual(result.conflicts.map(conflict => conflict.kind), ["move-move"]);
    assert.deepEqual(ids(result.merged), ["b", "c", "d", "a"]);
    assert.deepEqual(ids(mergePresentations(base(), ours, theirs, { prefer: "theirs" }).merged), ["b", "c", "a", "d"]);
  });

  test("conflicts inside a slide name the slide", () => {
    const ours = base(), theirs = base();
    ours.slides[2].notes = "n1";
    theirs.slides[2].notes = "n2";
    const [conflict] = mergePresentations(base(), ours, theirs).conflicts;
    assert.deepEqual(conflict.slide, { index: 2, id: "c", title: "C" });
  });
});

describe("merge laws over the example decks", () => {
  const examples = loadExamples();
  for (const { file, raw } of examples) {
    test(file, () => {
      const start = JSON.parse(raw);
      const ours = mutate(start, 101 + file.length), theirs = mutate(start, 977 + file.length);
      assert.deepEqual(mergePresentations(start, ours, start).merged, ours);
      assert.deepEqual(mergePresentations(start, start, theirs).merged, theirs);
      assert.deepEqual(mergePresentations(start, ours, ours).merged, ours);
      assert.deepEqual(mergePresentations(start, start, start).merged, start);
      const merged = mergePresentations(start, ours, theirs);
      // Whatever collides is reported, so a clean merge means nothing was lost.
      assert.equal(merged.clean, merged.conflicts.length === 0);
      for (const conflict of merged.conflicts) assert.ok(conflict.path !== undefined && conflict.message && ["ours", "theirs"].includes(conflict.resolution));
      // Preferring either side yields a document with the same set of conflicts.
      const other = mergePresentations(start, ours, theirs, { prefer: "theirs" });
      assert.deepEqual(other.conflicts.map(conflict => conflict.kind), merged.conflicts.map(conflict => conflict.kind));
    });
  }

  test("disjoint edits to different slides merge cleanly, commute, and stay valid", () => {
    let validated = 0;
    for (const { file, raw } of examples) {
      const start = JSON.parse(raw);
      if (start.slides.length < 3) continue;
      const ours = structuredClone(start), theirs = structuredClone(start);
      ours.slides[0].notes = `ours note ${file}`;
      theirs.slides.at(-1).notes = `theirs note ${file}`;
      theirs.name = `${start.name} (theirs)`;
      const forward = mergePresentations(start, ours, theirs), backward = mergePresentations(start, theirs, ours);
      assert.equal(forward.clean, true, file);
      assert.deepEqual(forward.merged, backward.merged, file);
      assert.equal(forward.merged.slides[0].notes, `ours note ${file}`);
      assert.equal(forward.merged.slides.at(-1).notes, `theirs note ${file}`);
      if (check(start).valid) { assert.equal(check(forward.merged).valid, true, file); validated++; }
    }
    assert.ok(validated > 100, `validated ${validated} merged decks`);
  });
});

describe("merge fuzz", () => {
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
  test("2000 random three-way merges obey the identity laws and never throw", () => {
    let seed = 99;
    const rand = n => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed % n; };
    for (let round = 0; round < 2000; round++) {
      const start = { slides: Array.from({ length: 1 + rand(6) }, () => generate(rand)), meta: generate(rand) };
      const ours = edit(rand, start), theirs = edit(rand, start);
      const context = `round ${round}: ${JSON.stringify([start, ours, theirs])}`;
      assert.deepEqual(mergePresentations(start, ours, start).merged, ours, context);
      assert.deepEqual(mergePresentations(start, start, theirs).merged, theirs, context);
      assert.deepEqual(mergePresentations(start, ours, ours).merged, ours, context);
      const result = mergePresentations(start, ours, theirs);
      assert.equal(result.clean, result.conflicts.length === 0, context);
      for (const conflict of result.conflicts) assert.ok(typeof conflict.path === "string" && conflict.message && ["ours", "theirs"].includes(conflict.resolution), context);
      // The other preference still produces a document.
      const other = mergePresentations(start, ours, theirs, { prefer: "theirs" });
      assert.notEqual(other.merged, undefined, context);
    }
  });
});
