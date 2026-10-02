// RR-33: the numbering model behind the list numbering control: finding lists, reading their state, the shortest
// `numbering` value, and number / restart / turn-off as validated, undoable session edits.
import assert from "node:assert/strict";
import { createEditorSession } from "../dist/index.js";
import {
  MAX_NUMBERING_LEVELS,
  NUMBERING_STYLE_OPTIONS,
  NUMBERING_SUFFIX_OPTIONS,
  findNumberableLists,
  listPayloadAt,
  numberingAvailable,
  numberingState,
  numberingValue,
  setEntryStart,
  setNumbering,
} from "../dist/numbering.js";

assert.equal(numberingAvailable(), true);
assert.deepEqual(NUMBERING_STYLE_OPTIONS.map((option) => option.value), ["arabic", "roman-upper", "roman-lower", "alpha-upper", "alpha-lower"]);
assert.deepEqual(NUMBERING_SUFFIX_OPTIONS.map((option) => option.value), ["period", "paren", "paren-both"]);

const deck = () => ({
  slides: [
    { id: "plain", title: "Plain", items: ["One", { text: "Nested", level: 1 }, "Two"] },
    { id: "regions", title: "Regions", left: { bullets: ["A", "B", "C"], numbering: "alpha-lower" }, right: { text: "Notes" } },
    { id: "blocks", title: "Blocks", blocks: [{ items: ["X", "Y"] }, { text: "Words" }, { blocks: [{ bullets: ["P", { text: "Q", level: 2 }] }] }] },
    { id: "text", title: "Only text", text: "No list here" },
  ],
});

// ---- where a list lives ---------------------------------------------------------------------------------------------
{
  const doc = deck();
  assert.equal(listPayloadAt(doc, "slides.0.items").payloadPath, "slides.0");
  assert.equal(listPayloadAt(doc, "slides.0.items.2").entry, 2);
  assert.equal(listPayloadAt(doc, "slides.0.items.1.text").entry, 1);
  assert.equal(listPayloadAt(doc, "/slides/1/left/bullets/0").payloadPath, "slides.1.left");
  assert.equal(listPayloadAt(doc, "slides.2.blocks.2.blocks.0.bullets").field, "bullets");
  assert.equal(listPayloadAt(doc, "slides.3.text"), undefined);
  assert.equal(listPayloadAt(doc, "slides.0.title"), undefined);
  assert.equal(listPayloadAt(doc, "slides.9.items"), undefined);
  assert.deepEqual(findNumberableLists(doc, 0).map((entry) => [entry.path, entry.count, entry.numbered]), [["slides.0.items", 3, false]]);
  assert.deepEqual(findNumberableLists(doc, 1).map((entry) => [entry.path, entry.numbered]), [["slides.1.left.bullets", true]]);
  assert.deepEqual(findNumberableLists(doc, 2).map((entry) => entry.path), ["slides.2.blocks.0.items", "slides.2.blocks.2.blocks.0.bullets"]);
  assert.deepEqual(findNumberableLists(doc, 3), []);
  assert.deepEqual(findNumberableLists(doc, 7), []);
}

// ---- the shortest numbering value --------------------------------------------------------------------------------------
assert.equal(numberingValue([{}]), "arabic");
assert.equal(numberingValue([{ style: "roman-lower" }]), "roman-lower");
assert.deepEqual(numberingValue([{ start: 3 }]), { start: 3 });
assert.deepEqual(numberingValue([{ style: "alpha-upper", suffix: "paren" }]), { style: "alpha-upper", suffix: "paren" });
assert.deepEqual(numberingValue([{ style: "arabic" }, { style: "arabic" }]), "arabic", "equal levels are one entry");
assert.deepEqual(numberingValue([{ style: "arabic" }, { style: "alpha-lower", suffix: "paren" }, { style: "alpha-lower", suffix: "paren" }]), ["arabic", { style: "alpha-lower", suffix: "paren" }], "the last entry repeats");
assert.deepEqual(numberingValue([{ style: "arabic" }, { style: "arabic", start: 2 }]), ["arabic", { start: 2 }]);
for (const bad of [[], [{ style: "greek" }], [{ suffix: "colon" }], [{ start: 0 }], [{ start: 1.5 }], [{ start: 32768 }], Array.from({ length: MAX_NUMBERING_LEVELS + 1 }, (_, index) => ({ start: index + 1 }))])
  assert.throws(() => numberingValue(bad), (error) => error.code === "invalid-numbering", JSON.stringify(bad).slice(0, 60));

// ---- reading state ----------------------------------------------------------------------------------------------------
{
  const doc = deck();
  const plain = numberingState(doc, "slides.0.items");
  assert.deepEqual({ numbered: plain.numbered, perLevel: plain.perLevel, depth: plain.depth, markers: plain.markers, count: plain.count }, { numbered: false, perLevel: false, depth: 2, markers: [], count: 3 });
  const numbered = numberingState(doc, "slides.1.left.bullets.2");
  assert.equal(numbered.numbered, true);
  assert.deepEqual(numbered.levels, [{ style: "alpha-lower", start: 1, suffix: "period" }]);
  assert.deepEqual(numbered.markers.map((marker) => marker.text), ["a.", "b.", "c."]);
  assert.deepEqual(numbered.entry, { index: 2, start: undefined, marker: "c." });
  assert.equal(numberingState(doc, "slides.3.text"), undefined);
  const perLevel = numberingState({ slides: [{ items: ["a", { text: "b", level: 1 }], numbering: ["arabic", { style: "roman-lower", suffix: "paren" }] }] }, "slides.0.items");
  assert.equal(perLevel.perLevel, true);
  assert.deepEqual(perLevel.markers.map((marker) => marker.text), ["1.", "i)"]);
}

// ---- number, change, restart and turn off: validated, undoable edits ---------------------------------------------------
{
  const editor = createEditorSession(deck());
  const before = structuredClone(editor.document);
  setNumbering(editor, "slides.0.items", "roman-upper");
  assert.equal(editor.document.slides[0].numbering, "roman-upper");
  assert.deepEqual(numberingState(editor.document, "slides.0.items").markers.map((marker) => marker.text), ["I.", "I.", "II."], "nested entries count from their own level");
  // Any path inside the list addresses it.
  setNumbering(editor, "slides.0.items.1.text", { style: "roman-upper", start: 4 });
  assert.deepEqual(editor.document.slides[0].numbering, { style: "roman-upper", start: 4 });
  setNumbering(editor, "slides.0.items", numberingValue([{ style: "arabic" }, { style: "alpha-lower", suffix: "paren" }]));
  assert.deepEqual(editor.document.slides[0].numbering, ["arabic", { style: "alpha-lower", suffix: "paren" }]);
  assert.deepEqual(numberingState(editor.document, "slides.0.items").markers.map((marker) => marker.text), ["1.", "a)", "2."]);

  // A restart at an entry; a plain entry becomes the object form to carry it.
  setEntryStart(editor, "slides.0.items.2", 9);
  assert.deepEqual(editor.document.slides[0].items[2], { text: "Two", start: 9 });
  assert.deepEqual(numberingState(editor.document, "slides.0.items.2").markers.map((marker) => marker.text), ["1.", "a)", "9."]);
  assert.equal(numberingState(editor.document, "slides.0.items.2").entry.start, 9);
  setEntryStart(editor, "slides.0.items.2", 10);
  assert.equal(editor.document.slides[0].items[2].start, 10);
  setEntryStart(editor, "slides.0.items.2", undefined);
  assert.equal(editor.document.slides[0].items[2].start, undefined);
  assert.throws(() => setEntryStart(editor, "slides.0.items.2", 0), (error) => error.code === "invalid-numbering");
  assert.throws(() => setEntryStart(editor, "slides.0.items", 3), (error) => error.code === "not-an-entry");
  assert.throws(() => setEntryStart(editor, "slides.2.blocks.0.items.0", 3), (error) => error.code === "not-numbered");

  // Turning numbering off removes the entry starts that mean nothing without it, in the same edit.
  setEntryStart(editor, "slides.0.items.0", 5);
  const depth = editor.snapshot().undoDepth;
  setNumbering(editor, "slides.0.items", undefined);
  assert.equal(Object.hasOwn(editor.document.slides[0], "numbering"), false);
  assert.ok(editor.document.slides[0].items.every((item) => typeof item === "string" || item.start === undefined));
  assert.equal(editor.snapshot().undoDepth, depth + 1, "one edit");
  editor.undo();
  assert.equal(editor.document.slides[0].items[0].start, 5, "undo restores the numbering and the restart");
  assert.deepEqual(editor.document.slides[0].numbering, ["arabic", { style: "alpha-lower", suffix: "paren" }]);
  // Turning off a list that is not numbered is no edit.
  const none = setNumbering(editor, "slides.2.blocks.0.items", undefined);
  assert.deepEqual(none.patches, []);

  // Regions, blocks and nested groups.
  setNumbering(editor, "slides.1.left.bullets", { style: "roman-lower", suffix: "paren-both" });
  assert.deepEqual(editor.document.slides[1].left.numbering, { style: "roman-lower", suffix: "paren-both" });
  setNumbering(editor, "slides.2.blocks.2.blocks.0.bullets.1", "alpha-upper");
  assert.equal(editor.document.slides[2].blocks[2].blocks[0].numbering, "alpha-upper");
  setNumbering(editor, "slides.2.blocks.0.items", "arabic");
  assert.equal(editor.document.slides[2].blocks[0].numbering, "arabic");
  assert.throws(() => setNumbering(editor, "slides.1.right.text", "arabic"), (error) => error.code === "not-a-list");
  assert.throws(() => setNumbering(editor, "slides.3.text", "arabic"), (error) => error.code === "not-a-list");
  // The session refuses an invalid value and leaves the document as it was.
  const snapshot = structuredClone(editor.document);
  assert.throws(() => setNumbering(editor, "slides.0.items", "greek"), (error) => error.code === "invalid-opf-edit");
  assert.throws(() => setNumbering(editor, "slides.0.items", { start: 40000 }), (error) => error.code === "invalid-opf-edit");
  assert.deepEqual(editor.document, snapshot);
  // Undo all the way back.
  while (editor.snapshot().canUndo) editor.undo();
  assert.deepEqual(editor.document, before);
}

// A list that counts past the native limit is refused by validation, not written.
{
  const editor = createEditorSession({ slides: [{ items: ["a", "b", "c"] }] });
  assert.throws(() => setNumbering(editor, "slides.0.items", { start: 32766 }), (error) => error.code === "invalid-opf-edit");
  setNumbering(editor, "slides.0.items", { start: 32765 });
  assert.equal(editor.validation.valid, true);
}

console.log("Numbering model passed: lists found in roots, regions, blocks and groups, state and markers, the shortest value, number / change / restart / turn off as one undoable validated edit each.");
