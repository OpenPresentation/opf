// RR-22: autosave and restore. A stored copy is written only after a change, debounced; a different stored copy is offered on load and
// restored as one undoable step (with the undo history into a session nobody has edited); an ignored offer is never lost; `dirty`,
// `markSaved` and `beforeunload` agree; and storage that is unavailable or full degrades with a sentence instead of an exception.
import assert from "node:assert/strict";
import { createEditorSession } from "../dist/index.js";
import { createMemoryStorage, createPersistence, describeAutosave } from "../dist/persistence.js";

const deck = (title = "Start") => ({ name: "Autosave", design: { theme: "classic", fontScheme: "roboto" }, slides: [{ id: "a", title, text: "Alpha" }, { id: "b", title: "Beta", text: "Beta text" }] });
const session = (document = deck()) => createEditorSession(document, { rejectInvalid: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const KEY = "opf-editor/v1/doc";
const windowStub = () => {
  const target = new EventTarget();
  target.document = new EventTarget();
  return target;
};
const unload = (win) => {
  const event = new Event("beforeunload", { cancelable: true });
  // A browser's BeforeUnloadEvent has a string returnValue; the plain Event in Node has a boolean one.
  Object.defineProperty(event, "returnValue", { value: undefined, writable: true });
  win.dispatchEvent(event);
  return event;
};
/** Wrap an adapter to count and inspect calls. */
const spy = (storage) => {
  const calls = { get: 0, set: [], delete: [] };
  return Object.assign(Object.create(storage), {
    calls,
    get: (key) => { calls.get += 1; return storage.get(key); },
    set: (key, value) => { calls.set.push(key); return storage.set(key, value); },
    delete: (key) => { calls.delete.push(key); return storage.delete(key); },
  });
};
const make = (editor, storage, extra = {}) => createPersistence(editor, { key: "doc", storage, debounceMs: 15, maxWaitMs: 200, window: windowStub(), ...extra });

// --- session history export and restore ---------------------------------------------------------------
{
  const editor = session();
  editor.set("slides.0.title", "One");
  editor.set("slides.1.title", "Two");
  editor.undo();
  const history = editor.exportHistory();
  assert.equal(history.undo.length, 1);
  assert.equal(history.redo.length, 1);
  assert.deepEqual(history.undo[0].patches.map((patch) => patch.path), ["/slides/0/title"]);
  const events = [];
  const other = session(deck());
  other.subscribe((event) => events.push(event.type));
  const document = editor.document;
  other.restoreState({ document, ...history }, { source: "test" });
  assert.deepEqual(events, ["restore"]);
  assert.deepEqual(other.document, document);
  assert.equal(other.canUndo, true);
  assert.equal(other.canRedo, true);
  other.undo();
  assert.equal(other.document.slides[0].title, "Start", "the restored history walks back");
  other.redo();
  other.redo();
  assert.equal(other.document.slides[1].title, "Two");
  // A history that does not belong to the document is refused before anything changes.
  const bystander = session();
  const before = bystander.document;
  assert.throws(() => bystander.restoreState({ document: deck("Elsewhere"), ...history }), { code: "invalid-history" });
  assert.deepEqual(bystander.document, before);
  assert.equal(bystander.canUndo, false);
  assert.throws(() => bystander.restoreState({ document: { slides: [] }, undo: [] }), (error) => error.code === "invalid-opf-edit");
  assert.throws(() => bystander.restoreState({ document: deck(), undo: [{ nope: true }] }), { code: "invalid-history" });
  // Without a history it just replaces the document and clears both stacks.
  bystander.set("name", "x");
  bystander.restoreState({ document: deck("Fresh") });
  assert.equal(bystander.document.slides[0].title, "Fresh");
  assert.equal(bystander.canUndo, false);
}

// --- no write before a change; debounce; the stored record ---------------------------------------------
{
  const storage = spy(createMemoryStorage());
  const editor = session();
  const persistence = make(editor, storage);
  const ready = await persistence.ready;
  assert.deepEqual({ available: ready.available, offered: ready.offered }, { available: true, offered: false });
  await wait(50);
  assert.deepEqual(storage.calls.set, [], "opening the editor writes nothing");
  assert.equal(persistence.dirty, false);
  assert.equal(await persistence.flush(), true);
  assert.deepEqual(storage.calls.set, [], "flush with no change writes nothing");

  editor.set("slides.0.title", "One");
  editor.set("slides.0.title", "Two");
  editor.set("slides.1.title", "Three");
  assert.equal(persistence.dirty, true);
  await wait(80);
  assert.equal(storage.calls.set.length, 1, "three quick edits are one write");
  const record = await storage.get(KEY);
  assert.equal(record.version, 1);
  assert.equal(record.dirty, true);
  assert.equal(record.name, "Autosave");
  assert.equal(record.slideCount, 2);
  assert.equal(record.document.slides[0].title, "Two");
  assert.equal(record.undo.length, 3, "the undo history is stored with it");
  assert.equal(persistence.status.state, "saved");
  assert.match(describeAutosave(persistence.status, { locale: "en-US" }), /^Saved on this device at /);
  // Undo back to the starting document is not dirty; the copy follows.
  editor.undo(); editor.undo(); editor.undo();
  assert.equal(persistence.dirty, false);
  await persistence.flush();
  assert.equal((await storage.get(KEY)).dirty, false);
  persistence.destroy();
}

// maxWait: a stream of changes still gets written.
{
  const storage = spy(createMemoryStorage());
  const editor = session();
  const persistence = make(editor, storage, { debounceMs: 60, maxWaitMs: 80 });
  await persistence.ready;
  for (let step = 0; step < 12; step += 1) { editor.set("slides.0.title", `Edit ${step}`); await wait(15); }
  assert.ok(storage.calls.set.length >= 1, "a continuous stream of edits is still written before it pauses");
  await persistence.flush();
  assert.equal((await storage.get(KEY)).document.slides[0].title, "Edit 11");
  persistence.destroy();
}

// --- offering and restoring ------------------------------------------------------------------------------
async function stored(edit) {
  const storage = createMemoryStorage();
  const first = session();
  const persistence = make(first, storage);
  await persistence.ready;
  edit(first);
  await persistence.flush();
  persistence.destroy();
  return storage;
}

{
  // A new session starts from the default document; the stored copy differs, so it is offered.
  const storage = await stored((editor) => { editor.set("slides.0.title", "Edited"); editor.set("slides.1.title", "Edited too"); });
  const fresh = session();
  let offer;
  const persistence = make(fresh, storage, { onRestorePrompt: (value) => { offer = value; return "restore"; } });
  const ready = await persistence.ready;
  assert.equal(ready.offered, true);
  await wait(30);
  assert.equal(offer.dirty, true);
  assert.equal(offer.hasHistory, true);
  assert.equal(offer.slideCount, 2);
  assert.equal(fresh.document.slides[0].title, "Edited", "restore puts the copy back");
  assert.equal(fresh.canUndo, true, "and the undo history with it");
  fresh.undo();
  assert.equal(fresh.document.slides[1].title, "Beta");
  fresh.undo();
  assert.equal(fresh.document.slides[0].title, "Start");
  fresh.redo(); fresh.redo();
  assert.equal(persistence.dirty, true, "restored unsaved work is still unsaved");
  assert.equal(persistence.pending, undefined);
  persistence.destroy();
}

{
  // Same document as the one stored: nothing to offer.
  const storage = await stored((editor) => editor.set("slides.0.title", "Same"));
  const persistence = make(session(deck("Same")), storage);
  assert.equal((await persistence.ready).offered, false);
  persistence.destroy();
}

{
  // Without a prompt handler the offer waits; restoring into an edited session is one undoable step that keeps the user's history.
  const storage = await stored((editor) => editor.set("slides.0.title", "Stored"));
  const editor = session();
  const persistence = make(editor, storage);
  assert.equal((await persistence.ready).offered, true);
  assert.equal(persistence.pending.document.slides[0].title, "Stored");
  assert.equal(await persistence.restore(), true);
  assert.equal(editor.document.slides[0].title, "Stored");
  assert.equal(persistence.pending, undefined);
  assert.equal(await persistence.restore(), false, "nothing left to restore");
  persistence.destroy();

  const second = session();
  const handler = make(second, storage);
  await handler.ready;
  second.set("slides.1.title", "Typed before deciding");
  const depth = second.snapshot().undoDepth;
  assert.equal(await handler.restore(), true);
  assert.equal(second.snapshot().undoDepth, depth + 1, "restoring into an edited session is one undo step");
  assert.equal(second.document.slides[0].title, "Stored");
  second.undo();
  assert.equal(second.document.slides[1].title, "Typed before deciding", "and Undo returns to the edit that was open");
  handler.destroy();
}

{
  // Discard deletes the stored copy.
  const storage = await stored((editor) => editor.set("slides.0.title", "Stored"));
  const persistence = make(session(), storage);
  await persistence.ready;
  assert.equal(await persistence.discard(), true);
  assert.deepEqual(storage.keys(), []);
  assert.equal(await persistence.discard(), false);
  persistence.destroy();
}

{
  // Ignoring the offer and editing never loses the stored copy: it is moved aside, and offered again as "older" after a reload.
  const storage = await stored((editor) => editor.set("slides.0.title", "Old work"));
  const editor = session();
  const persistence = make(editor, storage);
  await persistence.ready;
  editor.set("slides.0.title", "New work");
  await persistence.flush();
  assert.ok(storage.keys().includes(`${KEY}#earlier`), "the offered copy is kept aside");
  assert.equal((await storage.get(KEY)).document.slides[0].title, "New work");
  persistence.destroy();

  const reloaded = session();
  const again = make(reloaded, storage);
  const ready = await again.ready;
  assert.equal(ready.offer.document.slides[0].title, "New work");
  assert.equal(ready.offer.earlier.slideCount, 2, "the older copy is mentioned");
  assert.equal(await again.restoreEarlier(), true);
  assert.equal(reloaded.document.slides[0].title, "Old work");
  assert.deepEqual(storage.keys().filter((key) => key.endsWith("#earlier")), [], "deciding drops the older copy");
  again.destroy();
}

// --- saved, rebase, dirty --------------------------------------------------------------------------------
{
  const storage = createMemoryStorage();
  const editor = session();
  const persistence = make(editor, storage);
  await persistence.ready;
  editor.set("slides.0.title", "Changed");
  assert.equal(persistence.dirty, true);
  await persistence.markSaved();
  assert.equal(persistence.dirty, false);
  assert.equal((await storage.get(KEY)).dirty, false, "the stored copy records that it was saved");
  editor.set("slides.0.title", "Changed again");
  assert.equal(persistence.dirty, true);
  persistence.destroy();

  // A copy saved as a file is offered with `dirty: false`, and restoring it is not "unsaved".
  const savedStorage = createMemoryStorage();
  const one = session();
  const writer = make(one, savedStorage);
  await writer.ready;
  one.set("slides.0.title", "Saved");
  await writer.markSaved();
  writer.destroy();
  const reopened = session();
  const reader = make(reopened, savedStorage);
  await reader.ready;
  assert.equal(reader.pending.dirty, false);
  await reader.restore();
  assert.equal(reader.dirty, false, "a restored saved copy is not unsaved");
  reader.destroy();
}

{
  // rebase: the host loaded a document; nothing is written and nothing is unsaved until the next change.
  const storage = spy(createMemoryStorage());
  const editor = session();
  const persistence = make(editor, storage);
  await persistence.ready;
  editor.restoreState({ document: deck("From the host") });
  persistence.rebase();
  assert.equal(persistence.dirty, false);
  await wait(60);
  assert.deepEqual(storage.calls.set, [], "a rebased document is not written until it changes");
  editor.set("slides.0.title", "User edit");
  await persistence.flush();
  assert.equal(storage.calls.set.length, 1);
  persistence.destroy();

  const cleared = createMemoryStorage();
  const edited = session();
  const owner = make(edited, cleared);
  await owner.ready;
  edited.set("slides.0.title", "x");
  await owner.flush();
  assert.equal(cleared.keys().length, 1);
  await owner.clear();
  assert.deepEqual(cleared.keys(), []);
  assert.equal(owner.dirty, false);
  owner.destroy();
}

// --- beforeunload ------------------------------------------------------------------------------------------
{
  const win = windowStub();
  const editor = session();
  let flushed = 0;
  const persistence = createPersistence(editor, { key: "doc", storage: createMemoryStorage(), window: win, debounceMs: 15, beforeFlush: () => { flushed += 1; } });
  await persistence.ready;
  assert.equal(unload(win).defaultPrevented, false, "nothing unsaved: leaving is silent");
  editor.set("slides.0.title", "Unsaved");
  const event = unload(win);
  assert.equal(event.defaultPrevented, true, "unsaved changes warn");
  assert.equal(event.returnValue, "", "the legacy returnValue is set too");
  assert.ok(flushed >= 2, "the host commits its drafts before the page goes");
  await persistence.markSaved();
  assert.equal(unload(win).defaultPrevented, false, "saved: silent again");
  editor.set("slides.0.title", "More");
  persistence.destroy();
  assert.equal(unload(win).defaultPrevented, false, "a destroyed controller leaves the window alone");

  const quiet = windowStub();
  const other = session();
  const silent = createPersistence(other, { key: "doc", storage: createMemoryStorage(), window: quiet, warnOnUnload: false });
  await silent.ready;
  other.set("slides.0.title", "x");
  assert.equal(unload(quiet).defaultPrevented, false, "warnOnUnload: false never warns");
  silent.destroy();
  // The final write is started on unload.
  const store = spy(createMemoryStorage());
  const last = session();
  const closing = createPersistence(last, { key: "doc", storage: store, window: windowStub(), debounceMs: 10_000 });
  await closing.ready;
  last.set("slides.0.title", "Last words");
  closing.destroy();
}

// --- history limits ----------------------------------------------------------------------------------------
{
  const storage = createMemoryStorage();
  const editor = session();
  const persistence = make(editor, storage, { maxHistoryEntries: 3 });
  await persistence.ready;
  for (let step = 0; step < 8; step += 1) editor.set("slides.0.title", `Edit ${step}`);
  await persistence.flush();
  assert.equal((await storage.get(KEY)).undo.length, 3, "only the newest entries are kept");
  persistence.destroy();
  const reopened = session();
  const reader = make(reopened, storage);
  await reader.ready;
  await reader.restore();
  for (let step = 0; step < 3; step += 1) reopened.undo();
  assert.equal(reopened.document.slides[0].title, "Edit 4", "three steps back");
  assert.equal(reopened.canUndo, false, "the trimmed history ends there");
  reader.destroy();

  const noHistory = createMemoryStorage();
  const plain = session();
  const lean = make(plain, noHistory, { includeHistory: false });
  await lean.ready;
  plain.set("slides.0.title", "x");
  await lean.flush();
  assert.equal("undo" in (await noHistory.get(KEY)), false);
  lean.destroy();

  const byBytes = createMemoryStorage();
  const heavy = session();
  const sized = make(heavy, byBytes, { maxHistoryBytes: 600 });
  await sized.ready;
  for (let step = 0; step < 10; step += 1) heavy.set("slides.0.text", `${"long ".repeat(40)}${step}`);
  await sized.flush();
  const kept = (await byBytes.get(KEY)).undo.length;
  assert.ok(kept > 0 && kept < 10, `the byte limit trims the history (${kept} kept)`);
  sized.destroy();
}

// A stored history that no longer fits the stored document is dropped, the document is still restored.
{
  const storage = await stored((editor) => { editor.set("slides.0.title", "A"); editor.set("slides.0.title", "B"); });
  const record = await storage.get(KEY);
  record.undo[1].inversePatches = [{ op: "test", path: "/slides/0/title", value: "never" }];
  await storage.set(KEY, record);
  const editor = session();
  const persistence = make(editor, storage);
  await persistence.ready;
  assert.equal(await persistence.restore(), true);
  assert.equal(editor.document.slides[0].title, "B");
  assert.equal(editor.canUndo, false, "a damaged history is dropped, the document is kept");
  persistence.destroy();
  // A corrupt record is ignored.
  const corrupt = createMemoryStorage();
  await corrupt.set(KEY, { version: 9, document: 5 });
  const ignoring = make(session(), corrupt);
  assert.equal((await ignoring.ready).offered, false);
  ignoring.destroy();
}

// --- graceful degradation ----------------------------------------------------------------------------------
{
  // Storage off or unavailable: the editor works, the status says why.
  const statuses = [];
  const editor = session();
  const off = createPersistence(editor, { key: "doc", storage: false, window: windowStub(), onStatus: (status) => statuses.push(status) });
  const ready = await off.ready;
  assert.equal(ready.available, false);
  assert.equal(off.status.state, "unavailable");
  assert.match(off.status.message, /download it to keep it/);
  editor.set("slides.0.title", "Still works");
  assert.equal(await off.flush(), false, "flush with no storage resolves false, without throwing");
  assert.equal(off.dirty, true, "unsaved changes are still tracked, so leaving still warns");
  assert.ok(statuses.length >= 2);
  off.destroy();

  // Reads that fail.
  const broken = createMemoryStorage();
  broken.get = async () => { throw new Error("denied"); };
  const reading = make(session(), broken);
  assert.deepEqual({ available: (await reading.ready).available, offered: (await reading.ready).offered }, { available: true, offered: false });
  assert.equal(reading.status.state, "error");
  reading.destroy();

  // A full store: the history is dropped first, then the whole write reports "full" and the next change tries again.
  const quota = () => Object.assign(new Error("The quota has been exceeded."), { name: "QuotaExceededError" });
  const small = createMemoryStorage();
  const realSet = small.set;
  small.set = async (key, value) => { if (value.undo) throw quota(); return realSet(key, value); };
  const squeezed = session();
  const squeezing = make(squeezed, small);
  await squeezing.ready;
  squeezed.set("slides.0.title", "Too big with history");
  assert.equal(await squeezing.flush(), true);
  assert.equal("undo" in (await small.get(KEY)), false, "the history was dropped to fit");
  assert.match(squeezing.status.message, /undo history was too large/);
  squeezing.destroy();

  const full = createMemoryStorage();
  let blocked = true;
  const fullSet = full.set;
  full.set = async (key, value) => { if (blocked) throw quota(); return fullSet(key, value); };
  const filling = session();
  const filled = make(filling, full);
  await filled.ready;
  filling.set("slides.0.title", "x");
  assert.equal(await filled.flush(), false);
  assert.equal(filled.status.state, "error");
  assert.equal(filled.status.error, "quota");
  assert.match(filled.status.message, /storage is full/);
  assert.equal(describeAutosave(filled.status), filled.status.message);
  blocked = false;
  filling.set("slides.0.title", "y");
  assert.equal(await filled.flush(), true, "the next change is written once there is room");
  assert.equal(filled.status.state, "saved");
  filled.destroy();
}

// --- options ---------------------------------------------------------------------------------------------------
assert.throws(() => createPersistence(session(), { storage: createMemoryStorage() }), { code: "missing-persistence-key" });
assert.throws(() => createPersistence({}, { key: "doc" }), { code: "invalid-editor" });

console.log("RR-22 persistence: ok");
