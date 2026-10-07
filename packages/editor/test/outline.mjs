// RR-21: the outline view's model and edits. Each edit is one validated patch and one undo step; nothing is flattened away.
import assert from "node:assert/strict";
import { validate } from "@openpresentation/opf";
import { createEditorSession } from "../dist/index.js";
import {
  applyOutlineChange, prepareAddOutlineBullet, prepareInsertOutlineItem, prepareInsertOutlineSlide, prepareMoveOutlineItem, prepareMoveOutlineSlide, prepareOutlineDemoteSlide,
  prepareOutlinePromote, prepareRemoveOutlineItem, prepareSetOutlineText, prepareShiftOutlineItem, readOutline, setOutlineText,
} from "../dist/outline.js";

const deck = () => ({
  name: "Outline",
  design: { theme: "classic", fontScheme: "roboto" },
  slides: [
    { id: "intro", title: "Intro", subtitle: "Why now", text: "Welcome everyone." },
    { id: "plan", title: "Plan", items: ["First", { text: "First detail", level: 1 }, { text: "Deeper", level: 2 }, "Second", "Third"] },
    { id: "mixed", title: "Mixed", blocks: [{ text: "A paragraph" }, { items: ["Block one", "Block two"] }, { chart: { type: "column", data: { columns: ["Q", "V"], rows: [["Q1", 1]] } } }] },
    { id: "rich", title: "Rich", text: [{ text: "Bold", bold: true }, " and plain"] },
    { id: "tail", title: "Tail", text: "Last words." },
  ],
});
const session = (presentation = deck()) => createEditorSession(presentation, { rejectInvalid: true });
const rowOf = (editor, key) => readOutline(editor.presentation).rows.find((row) => row.key === key);
const view = (editor) => readOutline(editor.presentation).rows.map((row) => `${row.slideIndex}:${row.kind}:${row.level}:${row.kind === "other" ? row.label : row.text}`);
const valid = (presentation) => assert.equal(validate(presentation, { only: ["format"] }).valid, true, JSON.stringify(validate(presentation, { only: ["format"] }).findings.slice(0, 2)));

function oneStep(editor, run) {
  const before = editor.presentation, depth = editor.snapshot().undoDepth, events = [];
  const stop = editor.subscribe((event) => events.push(event.type));
  const change = run();
  stop();
  assert.equal(change.changed, true);
  assert.deepEqual(events, ["patch"], "one patch event");
  assert.equal(editor.snapshot().undoDepth, depth + 1, "one undo step");
  valid(editor.presentation);
  const after = editor.presentation;
  editor.undo();
  assert.deepEqual(editor.presentation, before, "undo restores the deck exactly");
  editor.redo();
  assert.deepEqual(editor.presentation, after);
  return change;
}

// --- reading ---------------------------------------------------------------------------------------
{
  const editor = session();
  assert.deepEqual(view(editor), [
    "0:slide:0:Intro", "0:subtitle:1:Why now", "0:text:1:Welcome everyone.",
    "1:slide:0:Plan", "1:item:1:First", "1:item:2:First detail", "1:item:3:Deeper", "1:item:1:Second", "1:item:1:Third",
    "2:slide:0:Mixed", "2:text:1:A paragraph", "2:item:1:Block one", "2:item:1:Block two", "2:other:1:Chart",
    "3:slide:0:Rich", "3:text:1:Bold and plain",
    "4:slide:0:Tail", "4:text:1:Last words.",
  ]);
  const rows = readOutline(editor.presentation).rows;
  assert.equal(rows.find((row) => row.text === "Bold and plain").editable, false, "formatted text is read-only");
  assert.equal(rows.find((row) => row.kind === "other").editable, false);
  assert.equal(rows.find((row) => row.text === "First detail").path, "slides.1.items.1.text");
  assert.equal(rows.find((row) => row.text === "First").path, "slides.1.items.0");
  assert.equal(rows.find((row) => row.text === "Block two").listPath, "slides.2.blocks.1.items");
  // A slide with no title still has a row to type into.
  assert.equal(readOutline({ slides: [{ text: "x" }] }).rows[0].kind, "slide");
}

// --- text ------------------------------------------------------------------------------------------
{
  const editor = session();
  const change = oneStep(editor, () => setOutlineText(editor, rowOf(editor, "slide:slides.1"), "The plan"));
  assert.deepEqual(change.patches, [{ op: "replace", path: "/slides/1/title", value: "The plan" }]);
  oneStep(editor, () => setOutlineText(editor, rowOf(editor, "item:slides.1.items.1"), "Detail"));
  assert.deepEqual(editor.presentation.slides[1].items[1], { text: "Detail", level: 1 });
  oneStep(editor, () => setOutlineText(editor, rowOf(editor, "item:slides.2.blocks.1.items.0"), "Changed"));
  oneStep(editor, () => setOutlineText(editor, rowOf(editor, "text:slides.0.text"), "Hello."));
  // A new title on a slide without one adds the field; setting the same text commits nothing.
  const untitled = session({ slides: [{ text: "x" }, { title: "y" }] });
  const added = oneStep(untitled, () => setOutlineText(untitled, readOutline(untitled.presentation).rows[0], "Now titled"));
  assert.equal(added.patches[0].op, "add");
  assert.equal(setOutlineText(editor, rowOf(editor, "slide:slides.0"), "Intro").changed, false);
  assert.throws(() => setOutlineText(editor, readOutline(editor.presentation).rows.find((row) => !row.editable && row.kind === "text"), "x"), { code: "outline-row-not-editable" });
}

// --- nesting ---------------------------------------------------------------------------------------
{
  const editor = session();
  // Demote carries the nested items with it.
  const demote = oneStep(editor, () => applyOutlineChange(editor, prepareShiftOutlineItem(editor.presentation, rowOf(editor, "item:slides.1.items.3"), 1)));
  assert.deepEqual(editor.presentation.slides[1].items[3], { text: "Second", level: 1 });
  assert.equal(demote.focus, "item:slides.1.items.3");
  const carried = session({ slides: [{ title: "T", items: ["A", "B", { text: "b1", level: 1 }, "C"] }] });
  const nested = oneStep(carried, () => applyOutlineChange(carried, prepareShiftOutlineItem(carried.presentation, rowOf(carried, "item:slides.0.items.1"), 1)));
  assert.deepEqual(carried.presentation.slides[0].items, ["A", { text: "B", level: 1 }, { text: "b1", level: 2 }, "C"], "nested items move with it");
  assert.equal(nested.patches.length, 1, "one replace of the list");
  // The first item and an item already one in from the item above cannot be nested; the top level cannot be un-nested.
  const none = prepareShiftOutlineItem(editor.presentation, rowOf(editor, "item:slides.1.items.0"), 1);
  assert.equal(none.changed, false);
  assert.match(none.reason, /first/);
  assert.equal(prepareShiftOutlineItem(editor.presentation, rowOf(editor, "item:slides.1.items.2"), 1).changed, false);
  assert.equal(prepareShiftOutlineItem(editor.presentation, rowOf(editor, "item:slides.1.items.0"), -1).changed, false);
  // Promote walks back to the plain string form at level 0.
  const back = session();
  oneStep(back, () => applyOutlineChange(back, prepareShiftOutlineItem(back.presentation, rowOf(back, "item:slides.1.items.1"), -1)));
  assert.deepEqual(back.presentation.slides[1].items.slice(0, 3), ["First", "First detail", { text: "Deeper", level: 1 }]);
}

// --- order, insert, delete -------------------------------------------------------------------------
{
  const editor = session();
  // Moving "First" down swaps it with "Second", and its nested items go with it.
  const down = oneStep(editor, () => applyOutlineChange(editor, prepareMoveOutlineItem(editor.presentation, rowOf(editor, "item:slides.1.items.0"), 1)));
  assert.deepEqual(editor.presentation.slides[1].items.map((item) => (typeof item === "string" ? item : item.text)), ["Second", "First", "First detail", "Deeper", "Third"]);
  assert.equal(down.focus, "item:slides.1.items.1");
  const up = session();
  oneStep(up, () => applyOutlineChange(up, prepareMoveOutlineItem(up.presentation, rowOf(up, "item:slides.1.items.4"), -1)));
  assert.deepEqual(up.presentation.slides[1].items.map((item) => (typeof item === "string" ? item : item.text)), ["First", "First detail", "Deeper", "Third", "Second"]);
  assert.equal(prepareMoveOutlineItem(deck(), rowOf(session(), "item:slides.1.items.0"), -1).changed, false);
  assert.equal(prepareMoveOutlineItem(deck(), rowOf(session(), "item:slides.1.items.4"), 1).changed, false);
  // A nested item does not jump out of its parent.
  assert.equal(prepareMoveOutlineItem(deck(), rowOf(session(), "item:slides.1.items.1"), 1).changed, false);
  assert.equal(prepareMoveOutlineItem(deck(), rowOf(session(), "item:slides.1.items.1"), -1).changed, false);

  const insert = session();
  const inserted = oneStep(insert, () => applyOutlineChange(insert, prepareInsertOutlineItem(insert.presentation, rowOf(insert, "item:slides.1.items.0"))));
  assert.deepEqual(insert.presentation.slides[1].items.slice(0, 5), ["First", { text: "First detail", level: 1 }, { text: "Deeper", level: 2 }, "", "Second"], "after the nested items");
  assert.equal(inserted.focus, "item:slides.1.items.3");

  const bullet = session();
  oneStep(bullet, () => applyOutlineChange(bullet, prepareAddOutlineBullet(bullet.presentation, 1)));
  assert.equal(bullet.presentation.slides[1].items.length, 6);
  oneStep(bullet, () => applyOutlineChange(bullet, prepareAddOutlineBullet(bullet.presentation, 4)));
  assert.deepEqual(bullet.presentation.slides[4].items, [""]);
  assert.throws(() => prepareAddOutlineBullet(bullet.presentation, 2), { code: "outline-row-not-supported" });

  const remove = session();
  const removed = oneStep(remove, () => applyOutlineChange(remove, prepareRemoveOutlineItem(remove.presentation, rowOf(remove, "item:slides.1.items.0"))));
  assert.deepEqual(remove.presentation.slides[1].items, ["Second", "Third"], "the item and its nested items go");
  assert.equal(removed.focus, "item:slides.1.items.0");
  const last = session({ slides: [{ title: "A", items: ["only"] }, { title: "B" }] });
  oneStep(last, () => applyOutlineChange(last, prepareRemoveOutlineItem(last.presentation, readOutline(last.presentation).rows.find((row) => row.kind === "item"))));
  assert.equal(Object.hasOwn(last.presentation.slides[0], "items"), false, "an empty list is dropped");
}

// --- slides ----------------------------------------------------------------------------------------
{
  const editor = session();
  const move = oneStep(editor, () => applyOutlineChange(editor, prepareMoveOutlineSlide(editor.presentation, 1, -1)));
  assert.equal(editor.presentation.slides[0].id, "plan");
  assert.deepEqual(move.selection, [0]);
  const insert = session();
  const added = oneStep(insert, () => applyOutlineChange(insert, prepareInsertOutlineSlide(insert.presentation, 1)));
  assert.equal(insert.presentation.slides[2].title, "");
  assert.equal(added.focus, "slide:slides.2");
}

// Promote: a top-level item becomes a slide title and takes the items after it.
{
  const editor = session();
  const change = oneStep(editor, () => applyOutlineChange(editor, prepareOutlinePromote(editor.presentation, rowOf(editor, "item:slides.1.items.3"))));
  assert.deepEqual(editor.presentation.slides[1].items.map((item) => (typeof item === "string" ? item : item.text)), ["First", "First detail", "Deeper"]);
  assert.equal(editor.presentation.slides[2].title, "Second");
  assert.deepEqual(editor.presentation.slides[2].items, ["Third"]);
  assert.equal(change.focus, "slide:slides.2");
  assert.equal(editor.presentation.slides.length, 6);
  // The first item of a root list: the old list goes away entirely.
  const first = session();
  oneStep(first, () => applyOutlineChange(first, prepareOutlinePromote(first.presentation, rowOf(first, "item:slides.1.items.0"))));
  assert.equal(Object.hasOwn(first.presentation.slides[1], "items"), false);
  assert.equal(first.presentation.slides[2].title, "First");
  assert.deepEqual(first.presentation.slides[2].items, [{ text: "First detail", level: 1 }, { text: "Deeper", level: 2 }, "Second", "Third"]);
  // A nested item is promoted one level instead; only a top-level item becomes a slide.
  assert.throws(() => prepareOutlinePromote(editor.presentation, rowOf(editor, "item:slides.1.items.1")), { code: "outline-row-not-supported" });
  // A block list works too.
  const block = session();
  oneStep(block, () => applyOutlineChange(block, prepareOutlinePromote(block.presentation, rowOf(block, "item:slides.2.blocks.1.items.1"))));
  assert.deepEqual(block.presentation.slides[2].blocks[1].items, ["Block one"]);
  assert.equal(block.presentation.slides[3].title, "Block two");
}

// Demote: a plain slide becomes a bullet of the slide before it. Nothing is dropped.
{
  const withList = session({ slides: [{ title: "A", items: ["x"] }, { title: "B", text: "detail", items: ["y", { text: "z", level: 1 }] }, { title: "C" }] });
  const change = oneStep(withList, () => applyOutlineChange(withList, prepareOutlineDemoteSlide(withList.presentation, 1)));
  assert.deepEqual(withList.presentation.slides[0].items, ["x", "B", { text: "detail", level: 1 }, { text: "y", level: 1 }, { text: "z", level: 2 }]);
  assert.equal(withList.presentation.slides.length, 2);
  assert.equal(change.focus, "item:slides.0.items.1");
  // The previous slide has no body: it gets a list.
  const bare = session({ slides: [{ title: "A" }, { title: "B", items: ["y"] }] });
  oneStep(bare, () => applyOutlineChange(bare, prepareOutlineDemoteSlide(bare.presentation, 1)));
  assert.deepEqual(bare.presentation.slides[0].items, ["B", { text: "y", level: 1 }]);
  // Refusals keep every word: no slide before, other content on either slide.
  assert.throws(() => prepareOutlineDemoteSlide(deck(), 0), { code: "outline-row-not-supported" });
  assert.throws(() => prepareOutlineDemoteSlide(deck(), 4), { code: "outline-row-not-supported" }); // "rich" before it has text, not a list
  assert.throws(() => prepareOutlineDemoteSlide(deck(), 2), { code: "outline-row-not-supported" }); // blocks
  const notes = session({ slides: [{ title: "A", items: ["x"] }, { title: "B", notes: "say this" }] });
  assert.throws(() => prepareOutlineDemoteSlide(notes.presentation, 1), { code: "outline-row-not-supported" });
  assert.equal(notes.canUndo, false);
}

console.log("RR-21 outline: ok");
