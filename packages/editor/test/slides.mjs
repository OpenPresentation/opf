// RR-21: slide management. Every operation is one validated patch, one undo step, exact undo and redo, valid OPF,
// unique ids, and the right section; a dry run (prepare*) never touches a session.
import assert from "node:assert/strict";
import { validate } from "@openpresentation/opf";
import { toSvg } from "@openpresentation/opf-render/svg";
import { defaultCatalog } from "@openpresentation/opf/catalog";
import { createEditorSession } from "../dist/index.js";
import { collectReservedPresentationIds } from "../dist/presentation-ids.js";
import {
  SLIDE_OPERATIONS, addSection, addSlide, duplicateSlides, hasSections, listSections, moveSection, moveSlides, moveSlidesBy, prepareAddSlide, prepareMoveSlides,
  prepareRemoveSlides, removeSection, removeSlides, renameSection, sectionForSlide, setHidden, setSection, slideSummaries,
} from "../dist/slides.js";

const deck = () => ({
  name: "Slide management",
  design: { theme: "classic", fontScheme: "roboto" },
  slides: [
    { id: "a", title: "A", text: "Alpha", section: "Intro" },
    { id: "b", title: "B", text: "Beta", section: "Intro" },
    { id: "c", title: "C", blocks: [{ id: "c-text", text: "Gamma" }, { items: ["one", "two"] }], section: "Body" },
    { id: "d", title: "D", text: "Delta", section: "Body", hidden: true },
    { id: "e", title: "E", text: "Epsilon", section: "End" },
  ],
});
// OPF 0.15: the layouts the fixtures add come from the registered default catalog.
const session = (presentation = deck()) => createEditorSession(presentation, { rejectInvalid: true, catalogs: [defaultCatalog] });
const ids = (editor) => editor.presentation.slides.map((slide) => slide.id);
const sections = (editor) => editor.presentation.slides.map((slide) => slide.section ?? "-");
const valid = (presentation) => assert.equal(validate(presentation, { only: ["format"] }).valid, true, JSON.stringify(validate(presentation, { only: ["format"] }).findings.slice(0, 2)));
const unique = (presentation) => {
  const all = collectReservedPresentationIds(presentation);
  assert.equal(new Set(all).size, all.length, `ids are unique: ${all}`);
};

/** One step: exactly one undo entry, exact undo, exact redo, valid document, and the events the preview relies on. */
function oneStep(editor, run) {
  const before = editor.presentation, depth = editor.snapshot().undoDepth, events = [];
  const stop = editor.subscribe((event) => events.push(event.type));
  const change = run();
  stop();
  assert.equal(change.changed, true);
  assert.deepEqual(events, ["patch"], "one patch event");
  assert.equal(editor.snapshot().undoDepth, depth + 1, "one undo step");
  valid(editor.presentation);
  unique(editor.presentation);
  const after = editor.presentation;
  editor.undo();
  assert.deepEqual(editor.presentation, before, "undo restores the deck exactly");
  assert.equal(editor.snapshot().undoDepth, depth);
  editor.redo();
  assert.deepEqual(editor.presentation, after, "redo restores the result exactly");
  return change;
}

// --- reading ---------------------------------------------------------------------------------------
{
  const presentation = deck();
  assert.deepEqual(listSections(presentation).map(({ name, start, count }) => [name, start, count]), [["Intro", 0, 2], ["Body", 2, 2], ["End", 4, 1]]);
  assert.equal(hasSections(presentation), true);
  assert.equal(hasSections({ slides: [{ title: "x" }] }), false);
  assert.equal(sectionForSlide(presentation, 3).name, "Body");
  assert.deepEqual(slideSummaries(presentation).map((row) => [row.title, row.hidden, row.section]), [["A", false, "Intro"], ["B", false, "Intro"], ["C", false, "Body"], ["D", true, "Body"], ["E", false, "End"]]);
  // A run without a label is its own, unnamed section; the same name in two places is two sections.
  const split = listSections({ slides: [{ section: "X" }, {}, { section: "X" }, {}] });
  assert.deepEqual(split.map((row) => [row.name, row.unnamed, row.count]), [["X", false, 1], [undefined, true, 1], ["X", false, 1], [undefined, true, 1]]);
  // A blank label names no section, as in the PowerPoint export.
  assert.deepEqual(listSections({ slides: [{ section: "  " }, { section: "" }, {}] }).map((row) => [row.name, row.count]), [[undefined, 3]]);
  assert.deepEqual(Object.keys(SLIDE_OPERATIONS).sort(), ["add", "addSection", "duplicate", "move", "moveBy", "remove", "removeSection", "renameSection", "setHidden", "setSection", "moveSection"].sort());
}

// --- add -------------------------------------------------------------------------------------------
{
  const editor = session();
  const before = editor.presentation;
  // A dry run does not touch the session.
  const prepared = prepareAddSlide(before, { at: 2 });
  assert.equal(prepared.changed, true);
  assert.deepEqual(editor.presentation, before);
  assert.equal(prepared.presentation.slides[2].id, "slide-6");
  const change = oneStep(editor, () => addSlide(editor, { at: 2 }));
  assert.deepEqual(change.patches.map((patch) => [patch.op, patch.path]), [["add", "/slides/2"]]);
  assert.equal(change.index, 2);
  assert.deepEqual(change.selection, [2]);
  assert.equal(editor.presentation.slides[2].title, "New slide");
  // The new slide joins the section of the slide before it.
  assert.equal(editor.presentation.slides[2].section, "Intro");
  // Default position: the end, in the last section.
  oneStep(editor, () => addSlide(editor));
  assert.equal(editor.presentation.slides.at(-1).section, "End");
  // An explicit section, none, and a title.
  oneStep(editor, () => addSlide(editor, { at: 0, section: "Cover", title: "Hello", id: "cover" }));
  assert.equal(editor.presentation.slides[0].section, "Cover");
  assert.equal(editor.presentation.slides[0].id, "cover");
  oneStep(editor, () => addSlide(editor, { section: null }));
  assert.equal(Object.hasOwn(editor.presentation.slides.at(-1), "section"), false);
  assert.throws(() => addSlide(editor, { at: 99 }), { code: "slide-index-out-of-range" });
  // A host-built slide.
  oneStep(editor, () => addSlide(editor, { slide: { id: "mine", title: "Mine", items: ["x"] } }));
  assert.deepEqual(editor.presentation.slides.at(-1).items, ["x"]);
}

// A layout choice adds the layout's placeholders, the way switching a slide's layout does.
{
  const editor = session();
  const change = oneStep(editor, () => addSlide(editor, { layout: "title-subtitle", at: 1 }));
  const slide = editor.presentation.slides[1];
  assert.equal(slide.layout, "title-subtitle");
  assert.equal(typeof slide.title, "string");
  assert.equal(typeof slide.subtitle, "string");
  assert.equal(change.layout, "title-subtitle");
  oneStep(editor, () => addSlide(editor, { layout: "list-2x" }));
  const last = editor.presentation.slides.at(-1);
  assert.equal(last.layout, "list-2x");
  assert.ok(Array.isArray(last.blocks) || last.items, "list placeholders exist");
  assert.throws(() => addSlide(editor, { layout: "no-such-layout" }), { code: "unknown-catalog-id" });
  // The preview draws the new slide.
  assert.ok(toSvg(editor.presentation, 2).includes("<svg"));
}

// --- duplicate -------------------------------------------------------------------------------------
{
  const editor = session();
  const change = oneStep(editor, () => duplicateSlides(editor, [2]));
  assert.deepEqual(ids(editor), ["a", "b", "c", "c-2", "d", "e"]);
  assert.deepEqual(change.selection, [3]);
  // Content ids are remapped too, and everything else is copied.
  assert.equal(editor.presentation.slides[3].blocks[0].id, "c-text-2");
  assert.deepEqual(editor.presentation.slides[3].blocks[1], { items: ["one", "two"] });
  assert.equal(change.range.start, 3);
  // Several slides: copies go after the last one, in order; a hidden slide stays hidden.
  const many = session();
  oneStep(many, () => duplicateSlides(many, [3, 1]));
  assert.deepEqual(ids(many), ["a", "b", "c", "d", "b-2", "d-2", "e"]);
  assert.equal(many.presentation.slides[5].hidden, true);
  // Copies take the section of the slide they follow.
  assert.deepEqual(sections(many), ["Intro", "Intro", "Body", "Body", "Body", "Body", "End"]);
  assert.throws(() => duplicateSlides(many, []), { code: "no-slides-chosen" });
  assert.throws(() => duplicateSlides(many, [9]), { code: "slide-index-out-of-range" });
  // Duplicating twice never collides.
  const twice = session();
  duplicateSlides(twice, [0]);
  duplicateSlides(twice, [0]);
  unique(twice.presentation);
}

// --- remove ----------------------------------------------------------------------------------------
{
  const editor = session();
  const change = oneStep(editor, () => removeSlides(editor, [1, 3]));
  assert.deepEqual(ids(editor), ["a", "c", "e"]);
  assert.deepEqual(change.removed, [1, 3]);
  assert.deepEqual(change.selection, [1]);
  assert.deepEqual(change.patches.map((patch) => patch.path), ["/slides/3", "/slides/1"], "highest index first");
  // The last slide selects the one before it.
  const last = session();
  assert.deepEqual(removeSlides(last, [4]).selection, [3]);
  assert.throws(() => removeSlides(session({ slides: [{ title: "only" }] }), [0]), { code: "cannot-remove-all-slides" });
  assert.throws(() => prepareRemoveSlides(deck(), [0, 1, 2, 3, 4]), { code: "cannot-remove-all-slides" });
  assert.throws(() => removeSlides(editor, [7]), { code: "slide-index-out-of-range" });
}

// --- move ------------------------------------------------------------------------------------------
{
  const editor = session();
  // Drop gap semantics: the original order, gap 0..n.
  const down = oneStep(editor, () => moveSlides(editor, [0], 3, { section: "keep" }));
  assert.deepEqual(ids(editor), ["b", "c", "a", "d", "e"]);
  assert.deepEqual(down.selection, [2]);
  assert.deepEqual(sections(editor), ["Intro", "Body", "Intro", "Body", "End"], "keep leaves labels");
  const up = session();
  oneStep(up, () => moveSlides(up, [4], 1, { section: "keep" }));
  assert.deepEqual(ids(up), ["a", "e", "b", "c", "d"]);
  // The default adopts the section of the slide before the gap.
  const adopt = session();
  oneStep(adopt, () => moveSlides(adopt, [0], 3));
  assert.deepEqual(ids(adopt), ["b", "c", "a", "d", "e"]);
  assert.deepEqual(sections(adopt), ["Intro", "Body", "Body", "Body", "End"]);
  // To the start it adopts the section of the slide that follows.
  const start = session();
  oneStep(start, () => moveSlides(start, [4], 0));
  assert.deepEqual(ids(start), ["e", "a", "b", "c", "d"]);
  assert.equal(start.presentation.slides[0].section, "Intro");
  // An explicit section, and none.
  const named = session();
  oneStep(named, () => moveSlides(named, [0, 1], 5, { section: "End" }));
  assert.deepEqual(ids(named), ["c", "d", "e", "a", "b"]);
  assert.deepEqual(sections(named), ["Body", "Body", "End", "End", "End"]);
  const none = session();
  oneStep(none, () => moveSlides(none, [4], 0, { section: null }));
  assert.equal(Object.hasOwn(none.presentation.slides[0], "section"), false);
  // Several slides keep their relative order and land together.
  const group = session();
  oneStep(group, () => moveSlides(group, [3, 1], 5, { section: "keep" }));
  assert.deepEqual(ids(group), ["a", "c", "e", "b", "d"]);
  // Moving next to where it already is changes nothing; a relabel in place is one replace.
  const stay = session();
  assert.equal(moveSlides(stay, [1], 1, { section: "keep" }).changed, false);
  assert.equal(moveSlides(stay, [1], 2, { section: "keep" }).changed, false);
  assert.equal(stay.canUndo, false, "a no-op commits nothing");
  const relabel = oneStep(stay, () => moveSlides(stay, [1], 2, { section: "Body" }));
  assert.deepEqual(relabel.patches.map((patch) => [patch.op, patch.path]), [["replace", "/slides/1/section"]]);
  // Everything selected: nothing to do.
  assert.equal(moveSlides(session(), [0, 1, 2, 3, 4], 2).changed, false);
  assert.throws(() => moveSlides(session(), [0], 9), { code: "slide-index-out-of-range" });
  assert.throws(() => prepareMoveSlides(deck(), [], 1), { code: "no-slides-chosen" });
}

// --- move by (keyboard) ----------------------------------------------------------------------------
{
  const editor = session();
  oneStep(editor, () => moveSlidesBy(editor, [1], -1));
  assert.deepEqual(ids(editor), ["b", "a", "c", "d", "e"]);
  assert.equal(moveSlidesBy(editor, [0], -1).changed, false, "past the first slide is a no-op");
  assert.equal(moveSlidesBy(editor, [4], 1).changed, false, "past the last slide is a no-op");
  // A step across a section boundary joins the next section.
  const cross = session();
  const change = oneStep(cross, () => moveSlidesBy(cross, [1], 1));
  assert.deepEqual(ids(cross), ["a", "c", "b", "d", "e"]);
  assert.deepEqual(change.selection, [2]);
  assert.equal(cross.presentation.slides[2].section, "Body");
  // A contiguous block moves together; a scattered selection moves each slide one place.
  const block = session();
  oneStep(block, () => moveSlidesBy(block, [1, 2], 1, { section: "keep" }));
  assert.deepEqual(ids(block), ["a", "d", "b", "c", "e"]);
  const scattered = session();
  const scatteredChange = oneStep(scattered, () => moveSlidesBy(scattered, [0, 2], 1, { section: "keep" }));
  assert.deepEqual(ids(scattered), ["b", "a", "d", "c", "e"]);
  assert.deepEqual(scatteredChange.selection, [1, 3]);
  // Two places at once.
  const far = session();
  oneStep(far, () => moveSlidesBy(far, [0], 2, { section: "keep" }));
  assert.deepEqual(ids(far), ["b", "c", "a", "d", "e"]);
  assert.equal(moveSlidesBy(far, [0], 0).changed, false);
}

// --- hide ------------------------------------------------------------------------------------------
{
  const editor = session();
  const hide = oneStep(editor, () => setHidden(editor, [0, 1], true));
  assert.deepEqual(hide.patches.map((patch) => [patch.op, patch.path, patch.value]), [["add", "/slides/0/hidden", true], ["add", "/slides/1/hidden", true]]);
  assert.deepEqual(editor.presentation.slides.map((slide) => slide.hidden === true), [true, true, false, true, false]);
  // Showing removes the field rather than writing false.
  const show = oneStep(editor, () => setHidden(editor, [3], false));
  assert.deepEqual(show.patches.map((patch) => [patch.op, patch.path]), [["remove", "/slides/3/hidden"]]);
  assert.equal(Object.hasOwn(editor.presentation.slides[3], "hidden"), false);
  // Hiding what is already hidden commits nothing; toggling flips the whole selection one way.
  assert.equal(setHidden(editor, [0], true).changed, false);
  const toggle = oneStep(editor, () => setHidden(editor, [0, 2]));
  assert.equal(toggle.hidden, true, "a mixed selection hides");
  assert.equal(editor.presentation.slides[2].hidden, true);
  oneStep(editor, () => setHidden(editor, [0, 2]));
  assert.equal(editor.presentation.slides[0].hidden, undefined, "an all-hidden selection shows");
  // A stored false counts as shown and is cleared.
  const stored = session({ slides: [{ title: "x", hidden: false }, { title: "y" }] });
  assert.equal(setHidden(stored, [0], true).patches[0].op, "replace");
  assert.equal(setHidden(stored, [0], false).patches[0].op, "remove");
  // Hidden slides still render for the editor (they are only skipped when presenting).
  assert.ok(toSvg(editor.presentation, 4).includes("<svg"));
}

// --- sections --------------------------------------------------------------------------------------
{
  const editor = session();
  const set = oneStep(editor, () => setSection(editor, [4], "Appendix"));
  assert.deepEqual(set.patches.map((patch) => [patch.op, patch.path, patch.value]), [["replace", "/slides/4/section", "Appendix"]]);
  oneStep(editor, () => setSection(editor, [0, 1], null));
  assert.deepEqual(sections(editor), ["-", "-", "Body", "Body", "Appendix"]);
  assert.throws(() => setSection(editor, [0], "  "), { code: "invalid-section-name" });
  assert.equal(setSection(editor, [0], null).changed, false);

  // Add a section: the slide and the rest of its section take the name; earlier slides keep theirs.
  const added = session();
  const addedChange = oneStep(added, () => addSection(added, 3, "Details"));
  assert.deepEqual(sections(added), ["Intro", "Intro", "Body", "Details", "End"]);
  assert.deepEqual(addedChange.selection, [3]);
  const head = session();
  oneStep(head, () => addSection(head, 0, "Opening"));
  assert.deepEqual(sections(head), ["Opening", "Opening", "Body", "Body", "End"]);
  assert.throws(() => addSection(head, 0, ""), { code: "invalid-section-name" });
  assert.throws(() => addSection(head, 9, "x"), { code: "slide-index-out-of-range" });
  // In a deck without sections, a new section covers the rest of the deck.
  const plain = session({ slides: [{ title: "1" }, { title: "2" }, { title: "3" }] });
  oneStep(plain, () => addSection(plain, 1, "Later"));
  assert.deepEqual(sections(plain), ["-", "Later", "Later"]);

  // Rename every slide of a section (an index from listSections).
  const renamed = session();
  const renameChange = oneStep(renamed, () => renameSection(renamed, 1, "Main"));
  assert.deepEqual(sections(renamed), ["Intro", "Intro", "Main", "Main", "End"]);
  assert.deepEqual(renameChange.selection, [2, 3]);
  assert.throws(() => renameSection(renamed, 7, "x"), { code: "section-index-out-of-range" });

  // Remove a section: the slides join the section before it; the first section's slides lose the label.
  const removed = session();
  oneStep(removed, () => removeSection(removed, 1));
  assert.deepEqual(sections(removed), ["Intro", "Intro", "Intro", "Intro", "End"]);
  const first = session();
  oneStep(first, () => removeSection(first, 0));
  assert.deepEqual(sections(first), ["-", "-", "Body", "Body", "End"]);
  const withSlides = session();
  oneStep(withSlides, () => removeSection(withSlides, 1, { deleteSlides: true }));
  assert.deepEqual(ids(withSlides), ["a", "b", "e"]);
  assert.throws(() => removeSection(session({ slides: [{ title: "x", section: "S" }] }), 0, { deleteSlides: true }), { code: "cannot-remove-all-slides" });

  // Move a whole section to a gap among the sections.
  const moved = session();
  const movedChange = oneStep(moved, () => moveSection(moved, 2, 0));
  assert.deepEqual(ids(moved), ["e", "a", "b", "c", "d"]);
  assert.deepEqual(sections(moved), ["End", "Intro", "Intro", "Body", "Body"], "labels are kept");
  assert.deepEqual(movedChange.selection, [0]);
  const toEnd = session();
  oneStep(toEnd, () => moveSection(toEnd, 0, 3));
  assert.deepEqual(ids(toEnd), ["c", "d", "e", "a", "b"]);
  assert.equal(moveSection(session(), 1, 1).changed, false, "next to itself");
  assert.equal(moveSection(session(), 1, 2).changed, false);
  assert.throws(() => moveSection(session(), 1, 9), { code: "section-index-out-of-range" });
}

// Slides keep working with the editor's other operations after reordering (edits address the slide by position).
{
  const editor = session();
  moveSlides(editor, [0], 5, { section: "keep" });
  assert.equal(editor.presentation.slides.at(-1).id, "a");
  editor.set("slides.4.title", "Moved A");
  editor.undo();
  editor.undo();
  assert.deepEqual(ids(editor), ["a", "b", "c", "d", "e"]);
  assert.equal(editor.presentation.slides[0].title, "A");
  assert.equal(editor.canUndo, false);
}

// Invalid decks are never produced: a clashing id is rejected and commits nothing.
{
  const editor = session();
  assert.throws(() => addSlide(editor, { slide: { id: "a", title: "dup" } }));
  assert.equal(editor.canUndo, false, "a rejected change commits nothing");
}

console.log("RR-21 slide management: ok");
