// RR-98: `replaceDocument` opens a different document as ONE undoable change and never reads it as an edit of the catalog records the
// two documents share. The same replacement through `applyPatch` is an edit of `catalogs.default`, which forks (FA-23); loading an
// example from a host's menu, File > Open and restoring a stored copy must not.
import assert from "node:assert/strict";
import { gallery } from "@openpresentation/gallery";
import { createEditorSession, prepareSave } from "../dist/index.js";
import { createMemoryStorage, createPersistence } from "../dist/persistence.js";

const embedded = (document) => prepareSave(document, { catalogs: [gallery] }).document;
// Two example decks that embed catalog records, with the same record ids (`cover`) and different content, as two examples published at
// different times do.
const first = embedded({ name: "Conference talk", slides: [{ id: "a1", title: "Opening", layout: "cover" }, { id: "a2", title: "Body", text: "Alpha", layout: "text" }] });
const second = embedded({ name: "Full feature tour", slides: [{ id: "b1", title: "Tour", layout: "cover" }, { id: "b2", title: "More", text: "Beta" }] });
second.catalogs.default.layouts.cover.name = "Cover, newer catalog build";
assert.ok(first.catalogs.default.layouts.cover && first.catalogs.default.layouts.text, "the first deck embeds its records");
const customIds = (document) => Object.values(document.catalogs?.custom ?? {}).flatMap((records) => Object.keys(records));
const layouts = (document) => document.slides.map((slide) => slide.layout);
const session = (document, options = {}) => createEditorSession(document, { catalogs: [gallery], ...options });

// The bug: replacing the root through applyPatch is read as an edit of the shared record and forks it.
{
  const editor = session(first);
  editor.applyPatch([{ op: "replace", path: "", value: second }]);
  assert.deepEqual(customIds(editor.presentation).sort(), ["cover-custom"], "applyPatch keeps forking an edited default record");
  assert.deepEqual(layouts(editor.presentation), ["cover-custom", undefined]);
}

// replaceDocument: exactly the new document, one undo step, Undo and Redo exact.
{
  const editor = session(first);
  const events = [];
  editor.subscribe((event) => events.push(event));
  const change = editor.replaceDocument(second);
    assert.deepEqual(editor.presentation, second, "the session holds exactly the opened document");
  assert.deepEqual(customIds(editor.presentation), [], "no catalog record is forked");
  assert.deepEqual(layouts(editor.presentation), ["cover", undefined], "references keep their ids");
  assert.equal(change.forked, undefined);
  assert.equal(editor.snapshot().undoDepth, 1, "one undoable change");
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "patch");
  assert.equal(events[0].meta.source, "replace-document");
  assert.equal(events[0].meta.replaceDocument, true);
  assert.equal(events[0].meta.forked, undefined);
  assert.deepEqual(editor.undo().presentation, first, "Undo restores the previous document");
  assert.deepEqual(editor.presentation, first);
  assert.equal(editor.canUndo, false);
  editor.redo();
  assert.deepEqual(editor.presentation, second, "Redo opens it again");
  // The history round-trips through export and restore.
  const history = editor.exportHistory();
  const other = session(first);
  other.restoreState({ presentation: editor.presentation, ...history });
  other.undo();
  assert.deepEqual(other.presentation, first);
}

// Editing a record of the opened document still forks: only the replacement is exempt.
{
  const editor = session(first);
  editor.replaceDocument(second);
  editor.set("catalogs.default.layouts.cover.name", "Mine");
  assert.deepEqual(customIds(editor.presentation), ["cover-custom"], "an edit after opening forks the record");
  assert.equal(editor.snapshot().undoDepth, 2);
}

// Input forms, meta and the equal document.
{
  const editor = session(first);
  editor.replaceDocument(JSON.stringify(second), { source: "example", label: "Open Full feature tour" });
  assert.deepEqual(editor.presentation, second, "JSON text is accepted");
  editor.undo();
  editor.replaceDocument(new TextEncoder().encode(JSON.stringify(second)));
  assert.deepEqual(editor.presentation, second, "bytes are accepted");
  const depth = editor.snapshot().undoDepth;
  editor.replaceDocument(structuredClone(second));
  assert.equal(editor.snapshot().undoDepth, depth + 1, "an equal document still records its one change");
  editor.undo();
  assert.deepEqual(editor.presentation, second);
  assert.throws(() => editor.replaceDocument("{ not json"), (error) => error.code === "invalid-json");
  assert.deepEqual(editor.presentation, second);
}

// A refused document changes nothing.
{
  const editor = session(first, { rejectInvalid: true });
  const broken = { name: "Broken", slides: [{ title: 42 }] };
  assert.throws(() => editor.replaceDocument(broken), (error) => error.code === "invalid-opf-edit" && error.issues.length > 0);
  assert.deepEqual(editor.presentation, first);
  assert.equal(editor.canUndo, false);
  assert.throws(() => session(first).replaceDocument(broken, { rejectInvalid: true }), (error) => error.code === "invalid-opf-edit");
  // Without rejectInvalid an invalid document opens, like any edit, and its findings are the session's validation.
  const lenient = session(first);
  lenient.replaceDocument(broken);
  assert.equal(lenient.validation.valid, false);
  lenient.undo();
  assert.deepEqual(lenient.presentation, first);
}

// Restoring a stored copy into a session that was already edited is one undoable change that forks nothing.
{
  const storage = createMemoryStorage();
  const stash = (document) => ({ key: "doc", storage, debounceMs: 15, maxWaitMs: 200, window: Object.assign(new EventTarget(), { presentation: new EventTarget() }) });
  const writer = session(second);
  const saving = createPersistence(writer, stash());
  await saving.ready;
  writer.set("slides.0.title", "Stored title");
  await saving.flush();
  saving.destroy();
  const reader = session(first);
  const persistence = createPersistence(reader, stash());
  reader.set("slides.0.title", "Edited before the offer");
  assert.equal((await persistence.ready).offered, true);
  assert.equal(await persistence.restore(), true);
  assert.equal(reader.presentation.slides[0].title, "Stored title");
  assert.deepEqual(customIds(reader.presentation), [], "restoring a stored copy forks nothing");
  assert.equal(reader.presentation.catalogs.default.layouts.cover.name, "Cover, newer catalog build");
  persistence.destroy();
}

console.log("Replace document: opens a document as one undoable change without forking catalog records.");
