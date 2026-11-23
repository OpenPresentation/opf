// `createEditorSession(document, { nameFromOpeningTitle: true })`: an unnamed starter takes its deck name from the opening slide's title,
// in the same undo step, until an explicit rename or a document replacement.
import assert from "node:assert/strict";
import { createEditorSession } from "../dist/index.js";

const deck = (extra = {}) => ({
  slides: [{ id: "s1", title: "Untitled deck", text: "Body" }, { id: "s2", title: "Second", text: "More" }],
  ...extra,
});
const open = (document = deck(), options = {}) => createEditorSession(document, { rejectInvalid: true, catalogs: [], nameFromOpeningTitle: true, ...options });

// One undo restores both, redo applies both.
{
  const editor = open();
  assert.equal(editor.presentation.name, undefined);
  const states = [];
  editor.subscribe(() => states.push(editor.presentation.name));
  editor.set("slides.0.title", "Quarterly plan");
  assert.equal(editor.presentation.name, "Quarterly plan");
  assert.equal(editor.presentation.slides[0].title, "Quarterly plan");
  assert.equal(states.length, 1, "one change event for title and name");
  editor.undo();
  assert.equal(editor.presentation.name, undefined);
  assert.equal(editor.presentation.slides[0].title, "Untitled deck");
  assert.equal(editor.canUndo, false, "title and name were one undo step");
  editor.redo();
  assert.equal(editor.presentation.name, "Quarterly plan");
  assert.equal(editor.presentation.slides[0].title, "Quarterly plan");
  editor.set("slides.0.title", "Quarterly plan v2");
  assert.equal(editor.presentation.name, "Quarterly plan v2", "later title edits keep following");
}

// The name is the plain text with whitespace runs collapsed: runs, line breaks.
{
  const editor = open();
  editor.set("slides.0.title", [{ text: "Roadmap  " }, { text: "for   2027", bold: true }]);
  assert.equal(editor.presentation.name, "Roadmap for 2027");
  editor.set("slides.0.title", "Line one\nLine two");
  assert.equal(editor.presentation.name, "Line one Line two");
  editor.set("slides.0.title", "  \t Padded \n\n title  ");
  assert.equal(editor.presentation.name, "Padded title");
}

// An empty or whitespace-only title does not rename.
{
  const editor = open(deck({ name: "Kept" }));
  editor.set("slides.0.title", "   ");
  assert.equal(editor.presentation.name, "Kept");
  editor.set("slides.0.title", "");
  assert.equal(editor.presentation.name, "Kept");
  const unnamed = open();
  unnamed.set("slides.0.title", " \n ");
  assert.equal(unnamed.presentation.name, undefined);
  unnamed.set("slides.0.title", "Now named");
  assert.equal(unnamed.presentation.name, "Now named", "an empty title did not stop the following");
}

// An explicit change of /name stops the following.
{
  const editor = open();
  editor.set("name", "My own name");
  editor.set("slides.0.title", "Different title");
  assert.equal(editor.presentation.name, "My own name");
  const patched = open();
  patched.applyPatch([{ op: "add", path: "/name", value: "Patched" }]);
  patched.set("slides.0.title", "Another");
  assert.equal(patched.presentation.name, "Patched");
  const removed = open(deck({ name: "Old" }));
  removed.applyPatch([{ op: "remove", path: "/name" }]);
  removed.set("slides.0.title", "After remove");
  assert.equal(removed.presentation.name, undefined);
}

// A whole-document replacement that is not a source-pane edit of the same deck stops it.
{
  const editor = open();
  editor.replaceDocument(deck({ name: "Replaced" }));
  editor.set("slides.0.title", "Edited after replace");
  assert.equal(editor.presentation.name, "Replaced");

  const other = open();
  other.replaceDocument({ slides: [{ id: "other", title: "Other deck" }] });
  other.set("slides.0.title", "Edited");
  assert.equal(other.presentation.name, undefined, "a different deck does not follow");

  // A source-pane edit of the same deck (same name, same opening slide id) keeps following.
  const source = open();
  source.replaceDocument(deck({ slides: [{ id: "s1", title: "Untitled deck", text: "Edited body" }, { id: "s2", title: "Second" }] }), { source: "source-pane" });
  source.set("slides.0.title", "Still following");
  assert.equal(source.presentation.name, "Still following");

  // A source-pane edit that changes the name or the opening slide is a replacement.
  const renamed = open();
  renamed.replaceDocument(deck({ name: "Typed in source" }), { source: "source-pane" });
  renamed.set("slides.0.title", "No longer following");
  assert.equal(renamed.presentation.name, "Typed in source");
  const swapped = open();
  swapped.replaceDocument({ slides: [{ id: "new-first", title: "New first" }] }, { source: "source-pane" });
  swapped.set("slides.0.title", "Swapped");
  assert.equal(swapped.presentation.name, undefined);
}

// A change to another slide's title does nothing; so does a change to the opening slide that is not its title.
{
  const editor = open();
  editor.set("slides.1.title", "Other slide");
  assert.equal(editor.presentation.name, undefined);
  editor.set("slides.0.text", "New body");
  assert.equal(editor.presentation.name, undefined);
  editor.set("slides.0.title", "Opening");
  assert.equal(editor.presentation.name, "Opening");
}

// A rejected edit leaves both name and following untouched.
{
  const editor = open();
  assert.throws(() => editor.set("slides.0.title", 123));
  assert.equal(editor.presentation.name, undefined);
  assert.equal(editor.presentation.slides[0].title, "Untitled deck");
  assert.equal(editor.canUndo, false);
  editor.set("slides.0.title", "Valid title");
  assert.equal(editor.presentation.name, "Valid title", "still following after the rejected edit");
  // A rejected explicit rename does not stop the following either.
  assert.throws(() => editor.set("name", 5));
  editor.set("slides.0.title", "Valid again");
  assert.equal(editor.presentation.name, "Valid again");
}

// Without the option nothing follows.
{
  const editor = createEditorSession(deck(), { rejectInvalid: true, catalogs: [] });
  editor.set("slides.0.title", "Not followed");
  assert.equal(editor.presentation.name, undefined);
  const explicit = createEditorSession(deck(), { rejectInvalid: true, catalogs: [], nameFromOpeningTitle: false });
  explicit.set("slides.0.title", "Not followed either");
  assert.equal(explicit.presentation.name, undefined);
}
console.log("name-from-opening-title: ok");
