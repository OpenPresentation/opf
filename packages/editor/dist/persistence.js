// Autosave and restore (RR-22). `createPersistence(editor, { key, ... })` keeps the working document of an editor session, and its undo
// history when it fits, in the browser's own storage (IndexedDB, with localStorage as a fallback), debounced, and brings it back after a
// reload. It never sends anything anywhere: there is no network call in this module, and the data stays in this browser profile.
//
//   - A copy is written only after the document changes, so merely opening the editor never overwrites a stored copy.
//   - On creation it looks for a stored copy that differs from the document the session starts with and offers it (`onRestorePrompt`, or
//     `persistence.pending` for a host that draws its own prompt). Restoring puts the copy back as ONE undoable step; into a session that
//     has not been edited it also restores the undo history.
//   - If the user keeps editing while an offer is open, the stored copy is moved aside (`restoreEarlier`) before the first new write, so an
//     ignored banner never costs anyone their work.
//   - `dirty` means "changed since the last `markSaved()`" (a download, a host save): `beforeunload` warns while it is true. The host calls
//     `markSaved()` after it saved the document somewhere durable of its own.
//   - Where storage is unavailable (private browsing, blocked site data) or full, nothing throws: `status` says so with a sentence the host
//     shows, and the editor keeps working.
import { fail } from "./edit-helpers.js";

const VERSION = 1;
const PREFIX = "opf-editor/v1/";
export const DEFAULT_DEBOUNCE_MS = 800;
export const DEFAULT_MAX_WAIT_MS = 5000;
export const DEFAULT_MAX_HISTORY_ENTRIES = 200;
export const DEFAULT_MAX_HISTORY_BYTES = 2_000_000;

const jsonOf = (value) => JSON.stringify(value);
const isRecordObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isQuotaError = (error) => Boolean(error) && (error.name === "QuotaExceededError" || error.code === 22 || error.code === 1014 || /quota|storage.*full/i.test(String(error.message ?? "")));

// --- storage adapters ----------------------------------------------------------------------------

/** An in-memory adapter (tests, and hosts that hold the data themselves). */
export function createMemoryStorage() {
  const data = new Map();
  return {
    name: "memory",
    async get(key) { return data.has(key) ? structuredClone(data.get(key)) : undefined; },
    async set(key, value) { data.set(key, structuredClone(value)); },
    async delete(key) { data.delete(key); },
    keys: () => [...data.keys()],
  };
}
/** localStorage as JSON strings (about 5 MB shared by the whole origin: the history is dropped first when it does not fit). */
export function createLocalStorageStorage(options = {}) {
  const storage = options.storage ?? globalThis.localStorage;
  if (!storage) throw new Error("localStorage is not available.");
  // Touching it can throw (blocked site data); probe now so the caller falls back or reports.
  const probe = `${PREFIX}probe`;
  storage.setItem(probe, "1");
  storage.removeItem(probe);
  return {
    name: "localStorage",
    async get(key) { const text = storage.getItem(key); return text === null ? undefined : JSON.parse(text); },
    async set(key, value) { storage.setItem(key, jsonOf(value)); },
    async delete(key) { storage.removeItem(key); },
  };
}
/** IndexedDB (database `opf-editor`, object store `documents`), the default: it holds large documents and their history. */
export function createIndexedDbStorage(options = {}) {
  const factory = options.indexedDB ?? globalThis.indexedDB;
  if (!factory) throw new Error("IndexedDB is not available.");
  const databaseName = options.databaseName ?? "opf-editor";
  const storeName = options.storeName ?? "documents";
  let opened;
  const open = () => (opened ??= new Promise((resolve, reject) => {
    let request;
    try { request = factory.open(databaseName, 1); } catch (error) { reject(error); return; }
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName); };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => { database.close(); opened = undefined; };
      resolve(database);
    };
    request.onerror = () => reject(request.error ?? new Error("Could not open browser storage."));
    request.onblocked = () => reject(new Error("Browser storage is blocked by another tab."));
  }).catch((error) => { opened = undefined; throw error; }));
  const run = async (mode, action) => {
    const database = await open();
    return new Promise((resolve, reject) => {
      let result;
      let transaction;
      try {
        transaction = database.transaction(storeName, mode);
        const request = action(transaction.objectStore(storeName));
        request.onsuccess = () => { result = request.result; };
      } catch (error) { reject(error); return; }
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error ?? new Error("Browser storage failed."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Browser storage was aborted."));
    });
  };
  return {
    name: "indexedDB",
    /** Open the database now, so a blocked or private-mode browser reports before the first write. */
    probe: async () => { await open(); },
    get: (key) => run("readonly", (store) => store.get(key)),
    set: (key, value) => run("readwrite", (store) => store.put(value, key)),
    delete: (key) => run("readwrite", (store) => store.delete(key)),
  };
}

/** Resolve the `storage` option to an adapter, or `{ reason }` when none works. */
async function resolveStorage(option) {
  if (option === false) return { reason: "Autosave is off." };
  if (isRecordObject(option) && typeof option.get === "function") return { adapter: option };
  const wanted = typeof option === "string" ? option.toLowerCase() : "";
  const order = wanted === "memory" ? ["memory"] : wanted === "localstorage" ? ["localStorage"] : ["indexedDB", "localStorage"];
  let reason = "";
  for (const kind of order) {
    try {
      if (kind === "memory") return { adapter: createMemoryStorage() };
      if (kind === "indexedDB") {
        const adapter = createIndexedDbStorage();
        await adapter.probe();
        return { adapter };
      }
      return { adapter: createLocalStorageStorage() };
    } catch (error) {
      reason = reason || String(error?.message ?? error);
    }
  }
  return { reason: `Browser storage is not available here (${reason || "blocked"}).` };
}

// --- history -----------------------------------------------------------------------------------------

/** Keep the newest entries of each stack within the entry and byte limits; dropping the oldest keeps every stack replayable. */
function trimHistory(history, { entries, bytes }) {
  let undo = history.undo.slice(-entries);
  let redo = history.redo.slice(-entries);
  let size = jsonOf({ undo, redo }).length;
  while (size > bytes && (undo.length || redo.length)) {
    if (undo.length >= redo.length) undo = undo.slice(1); else redo = redo.slice(1);
    size = jsonOf({ undo, redo }).length;
  }
  return { undo, redo, dropped: undo.length < history.undo.length || redo.length < history.redo.length };
}

// --- the controller ----------------------------------------------------------------------------------

/**
 * Keep an editor session in browser storage and offer to restore it. See the file header and `persistence.d.ts` for the options.
 * Returns a controller: `ready`, `status`, `dirty`, `pending`, `restore()`, `discard()`, `restoreEarlier()`, `markSaved()`, `rebase()`,
 * `flush()`, `clear()` and `destroy()`.
 */
export function createPersistence(editor, options = {}) {
  if (!editor || typeof editor.subscribe !== "function" || typeof editor.exportHistory !== "function" || typeof editor.restoreState !== "function")
    throw fail("invalid-editor", "createPersistence needs an editor session from createEditorSession.");
  if (typeof options.key !== "string" || !options.key) throw fail("missing-persistence-key", "Persistence needs a document key: a stable string that names this document.");
  const storeKey = `${PREFIX}${options.key}`;
  const earlierKey = `${storeKey}#earlier`;
  const win = options.window === undefined ? globalThis.window : options.window;
  const now = options.now ?? (() => Date.now());
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const includeHistory = options.includeHistory !== false;
  const limits = { entries: options.maxHistoryEntries ?? DEFAULT_MAX_HISTORY_ENTRIES, bytes: options.maxHistoryBytes ?? DEFAULT_MAX_HISTORY_BYTES };

  let adapter;
  let baseline = jsonOf(editor.document); // JSON of the document last saved elsewhere; null means "unsaved in a way we cannot compare"
  let touched = false; // the document changed (or was saved) since this controller was created: only then is a copy written
  let pending; // the stored record on offer
  let stashed = false; // the offered record has been moved aside (earlierKey) because the user kept editing
  let hasEarlier = false;
  let earlierRecord; // what is in the earlierKey slot, for the offer
  let timer;
  let firstDirtyAt = 0;
  let chain = Promise.resolve();
  let lastWritten = "";
  let destroyed = false;
  let status = { state: "starting", available: false, dirty: false };
  const setStatus = (patch) => {
    status = { ...status, ...patch, dirty: isDirty() };
    options.onStatus?.(status);
  };
  function isDirty() {
    return baseline === null || jsonOf(editor.document) !== baseline;
  }

  // --- writing --------------------------------------------------------------------------------------

  async function writeRecord() {
    if (!adapter || destroyed) return false;
    const document = editor.document;
    const json = jsonOf(document);
    const dirty = baseline === null || json !== baseline;
    const history = includeHistory ? trimHistory(editor.exportHistory(), limits) : undefined;
    const signature = `${json}|${dirty}|${history ? history.undo.length + ":" + history.redo.length : ""}`;
    if (signature === lastWritten) return true;
    const record = { version: VERSION, key: options.key, savedAt: now(), name: typeof document.name === "string" ? document.name : undefined, slideCount: Array.isArray(document.slides) ? document.slides.length : 0, dirty, document, ...(history ? { undo: history.undo, redo: history.redo } : {}) };
    setStatus({ state: "saving" });
    try {
      // The first write while an offer is open moves the offered copy aside, so ignoring the prompt never loses it.
      if (pending && !stashed) {
        await adapter.set(earlierKey, pending);
        stashed = true;
        hasEarlier = true;
        earlierRecord = pending;
      }
      try {
        await adapter.set(storeKey, record);
      } catch (error) {
        if (!isQuotaError(error) || !history) throw error;
        // Too big with its history: keep the document itself.
        const { undo, redo, ...bare } = record;
        void undo; void redo;
        await adapter.set(storeKey, bare);
        record.historyDropped = true;
      }
      lastWritten = signature;
      setStatus({ state: "saved", savedAt: record.savedAt, message: record.historyDropped ? "Saved on this device. The undo history was too large to keep." : "", error: undefined });
      return true;
    } catch (error) {
      const full = isQuotaError(error);
      setStatus({ state: "error", error: full ? "quota" : "write", message: full ? "Autosave stopped: browser storage is full. Download your work to keep it." : `Autosave failed (${String(error?.message ?? error)}). Download your work to keep it.` });
      return false;
    }
  }
  function schedule() {
    if (destroyed || !adapter) return;
    const at = now();
    if (!firstDirtyAt) firstDirtyAt = at;
    clearTimeout(timer);
    const wait = Math.max(0, Math.min(debounceMs, firstDirtyAt + maxWaitMs - at));
    timer = setTimeout(() => { void flush(); }, wait);
  }
  /** Write the document now (cancelling the debounce) and resolve when it is stored. Resolves false when nothing could be written. */
  function flush() {
    clearTimeout(timer);
    firstDirtyAt = 0;
    if (!touched) return chain.then(() => true);
    chain = chain.then(writeRecord, writeRecord);
    return chain;
  }

  // --- offering and restoring -------------------------------------------------------------------------

  const validRecord = (record) => isRecordObject(record) && record.version === VERSION && isRecordObject(record.document) && Array.isArray(record.document.slides);
  const offerOf = (record) => ({ key: options.key, savedAt: record.savedAt, name: record.name, slideCount: record.slideCount, dirty: record.dirty !== false, hasHistory: Boolean(record.undo?.length || record.redo?.length), document: record.document });

  async function applyRecord(record) {
    const pristine = !touched && !editor.canUndo && !editor.canRedo;
    const state = { document: record.document, undo: record.undo ?? [], redo: record.redo ?? [] };
    if (pristine) {
      try { editor.restoreState(state, { source: "restore" }); }
      catch (error) {
        if (error?.code !== "invalid-history") throw error;
        editor.restoreState({ document: record.document }, { source: "restore" });
      }
    } else {
      // The user already worked in this session: bring the copy back as one undoable change instead of replacing their history.
      editor.applyPatch([{ op: "replace", path: "", value: structuredClone(record.document) }], { source: "restore" });
    }
    touched = true;
    baseline = record.dirty === false ? jsonOf(editor.document) : null;
  }

  /** Put the offered copy back. Resolves true when it was restored, false when there was nothing on offer or it was refused. */
  async function restore() {
    if (!pending) return false;
    const record = pending;
    try {
      await applyRecord(record);
    } catch (error) {
      setStatus({ state: "error", message: `The saved copy could not be restored (${String(error?.message ?? error)}).` });
      return false;
    }
    pending = undefined;
    await dropEarlier();
    lastWritten = "";
    setStatus({ state: "saved", savedAt: record.savedAt, message: "Restored.", error: undefined, offer: undefined });
    return true;
  }
  async function dropEarlier() {
    stashed = false;
    earlierRecord = undefined;
    if (!hasEarlier || !adapter) return;
    hasEarlier = false;
    try { await adapter.delete(earlierKey); } catch { /* the stale copy stays; the next load ignores it */ }
  }
  /** Decline the offered copy and delete it. */
  async function discard() {
    if (!pending && !hasEarlier) return false;
    pending = undefined;
    try { if (adapter) await adapter.delete(storeKey); } catch { /* reported by the next write */ }
    await dropEarlier();
    // The stored copy is gone; the next change writes the current document.
    lastWritten = "";
    if (touched) schedule();
    setStatus({ state: touched ? status.state : "idle", message: "", offer: undefined });
    return true;
  }
  /** Bring back the copy that was moved aside when the user kept editing while an offer was open, as one undoable change. */
  async function restoreEarlier() {
    if (!hasEarlier || !adapter) return false;
    let record;
    try { record = await adapter.get(earlierKey); } catch { return false; }
    if (!validRecord(record)) return false;
    try { editor.applyPatch([{ op: "replace", path: "", value: structuredClone(record.document) }], { source: "restore" }); }
    catch { return false; }
    pending = undefined;
    touched = true;
    baseline = null;
    await dropEarlier();
    lastWritten = "";
    setStatus({ message: "Restored the earlier copy.", offer: undefined });
    return true;
  }

  // --- host hooks ---------------------------------------------------------------------------------------

  /** The host saved the document somewhere of its own (a download, a server): it is no longer "unsaved", and the stored copy says so. */
  function markSaved() {
    baseline = jsonOf(editor.document);
    touched = true;
    return flush();
  }
  /** Treat the current document as the starting point (a host that loads a document into the editor): no write, and not dirty, until the next change. */
  function rebase() {
    baseline = jsonOf(editor.document);
    touched = false;
    clearTimeout(timer);
    firstDirtyAt = 0;
    setStatus({});
  }
  /** Delete the stored copy (and any copy moved aside) and stop treating the document as changed. */
  async function clear() {
    pending = undefined;
    clearTimeout(timer);
    if (adapter) { try { await adapter.delete(storeKey); } catch { /* nothing to clean up */ } }
    await dropEarlier();
    lastWritten = "";
    touched = false;
    baseline = jsonOf(editor.document);
    setStatus({ state: status.available ? "idle" : status.state, message: "" });
  }

  // --- wiring ---------------------------------------------------------------------------------------------

  const unsubscribe = editor.subscribe(() => {
    touched = true;
    setStatus({});
    schedule();
  });
  const beforeUnload = (event) => {
    try { options.beforeFlush?.(); } catch { /* an uncommitted draft that cannot commit must not block leaving */ }
    // Best effort: start the final write; a browser finishes an IndexedDB transaction that began before the page went away.
    if (touched) void flush();
    if (options.warnOnUnload === false || !isDirty()) return undefined;
    event.preventDefault();
    event.returnValue = "";
    return "";
  };
  const pageHide = () => { try { options.beforeFlush?.(); } catch { /* see above */ } if (touched) void flush(); };
  const visibility = () => { if (win?.document?.visibilityState === "hidden") pageHide(); };
  win?.addEventListener?.("beforeunload", beforeUnload);
  win?.addEventListener?.("pagehide", pageHide);
  win?.document?.addEventListener?.("visibilitychange", visibility);

  const ready = (async () => {
    const resolved = await resolveStorage(options.storage);
    adapter = resolved.adapter;
    if (!adapter) {
      setStatus({ state: "unavailable", available: false, message: `${resolved.reason} Your work is kept only while this page is open: download it to keep it.` });
      return { available: false, offered: false, reason: resolved.reason };
    }
    setStatus({ state: "idle", available: true, storage: adapter.name });
    // The host may have changed the document while storage was opening: write that, once the offer (if any) is settled below.
    if (touched) schedule();
    let record;
    try { record = await adapter.get(storeKey); }
    catch (error) {
      setStatus({ state: "error", message: `Saved work could not be read (${String(error?.message ?? error)}).` });
      return { available: true, offered: false };
    }
    if (!validRecord(record) || jsonOf(record.document) === jsonOf(editor.document)) return { available: true, offered: false };
    try {
      const earlier = await adapter.get(earlierKey);
      hasEarlier = validRecord(earlier);
      earlierRecord = hasEarlier ? earlier : undefined;
    } catch { hasEarlier = false; }
    pending = record;
    const offer = { ...offerOf(record), ...(earlierRecord ? { earlier: { savedAt: earlierRecord.savedAt, name: earlierRecord.name, slideCount: earlierRecord.slideCount } } : {}) };
    setStatus({ state: "idle", offer });
    if (options.onRestorePrompt) {
      Promise.resolve(options.onRestorePrompt(offer, { restore, discard })).then((choice) => {
        if (choice === "restore") return restore();
        if (choice === "discard") return discard();
        return undefined;
      }).catch(() => undefined);
    }
    return { available: true, offered: true, offer };
  })();

  return {
    ready,
    get status() { return status; },
    /** True when the document differs from the last `markSaved()` (or from how the session started). */
    get dirty() { return isDirty(); },
    /** The stored copy on offer (what `onRestorePrompt` received), or undefined. */
    get pending() { return pending ? offerOf(pending) : undefined; },
    get pendingEarlier() { return hasEarlier && earlierRecord ? { savedAt: earlierRecord.savedAt, name: earlierRecord.name, slideCount: earlierRecord.slideCount } : undefined; },
    restore,
    discard,
    restoreEarlier,
    markSaved,
    rebase,
    flush,
    clear,
    destroy() {
      destroyed = true;
      clearTimeout(timer);
      unsubscribe();
      win?.removeEventListener?.("beforeunload", beforeUnload);
      win?.removeEventListener?.("pagehide", pageHide);
      win?.document?.removeEventListener?.("visibilitychange", visibility);
    },
  };
}

/** A sentence for a status, for hosts that show their own indicator ("Saved on this device at 2:03 PM", or why autosave is off). */
export function describeAutosave(status, options = {}) {
  if (!status) return "";
  if (status.state === "unavailable" || status.state === "error") return status.message ?? "";
  if (status.state === "saving") return "Saving on this device…";
  if (status.state === "saved" && status.savedAt) {
    const time = new Date(status.savedAt).toLocaleTimeString(options.locale, { hour: "numeric", minute: "2-digit" });
    return `${status.message && !/^Restored/.test(status.message) ? `${status.message} ` : ""}Saved on this device at ${time}`;
  }
  return "";
}
