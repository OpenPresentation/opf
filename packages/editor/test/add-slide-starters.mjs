// The slide shapes the thumbnail strip's starters pass to prepareAddSlide / addSlide: `slide: {}`, `slide: { title, items }` and a title-only slide.
import assert from "node:assert/strict";
import { createEditorSession } from "../dist/index.js";
import { addSlide, prepareAddSlide } from "../dist/slides.js";

const deck = () => ({ name: "Starters", slides: [{ id: "a", title: "A", text: "Alpha" }, { id: "b", title: "B", text: "Beta" }, { id: "slide-3", title: "C" }] });
const session = () => createEditorSession(deck(), { rejectInvalid: true, catalogs: [] });
const added = (change) => change.presentation.slides[change.index];

// slide: {} -> a fresh id (the first free slide-N), no title, no body.
{
  const prepared = prepareAddSlide(deck(), { at: 1, slide: {} });
  assert.equal(prepared.index, 1);
  assert.equal(prepared.id, "slide-4");
  assert.deepEqual(added(prepared), { id: "slide-4" });
  assert.deepEqual(prepared.presentation.slides.map((slide) => slide.id), ["a", "slide-4", "b", "slide-3"]);
}

// slide: { title, items } -> an id too, and the content as given.
{
  const prepared = prepareAddSlide(deck(), { at: 3, slide: { title: "New slide", items: ["First point"] } });
  assert.equal(prepared.id, "slide-4");
  assert.deepEqual(added(prepared), { id: "slide-4", title: "New slide", items: ["First point"] });
}

// A given id is kept, whether it is on the slide or in the options.
{
  assert.equal(added(prepareAddSlide(deck(), { slide: { id: "mine", title: "Mine" } })).id, "mine");
  assert.equal(added(prepareAddSlide(deck(), { slide: { id: "mine" }, id: "wins" })).id, "wins");
  assert.equal(added(prepareAddSlide(deck(), { id: "given" })).id, "given");
}

// { title } alone is a title-only slide: no body text.
{
  const slide = added(prepareAddSlide(deck(), { at: 1, title: "New slide" }));
  assert.deepEqual(slide, { id: "slide-4", title: "New slide" });
  assert.equal("text" in slide, false);
  assert.equal("items" in slide, false);
  assert.equal("blocks" in slide, false);
}

// The same through a session: one undo step each, valid, and the given slide object is not mutated.
{
  const editor = session();
  const given = { title: "New slide", items: ["First point"] };
  const change = addSlide(editor, { at: 2, slide: given });
  assert.deepEqual(given, { title: "New slide", items: ["First point"] });
  assert.equal(change.index, 2);
  assert.equal(editor.presentation.slides[2].id, "slide-4");
  assert.equal(editor.validation.valid, true);
  editor.undo();
  assert.deepEqual(editor.presentation.slides.map((slide) => slide.id), ["a", "b", "slide-3"]);
  assert.equal(editor.canUndo, false);
}
console.log("add-slide-starters: ok");
