import type { EditorSession } from "./index.js";

/** What a storage adapter holds: plain JSON-able records under string keys. */
export interface PersistenceStorage {
  name?: string;
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
}
export declare function createMemoryStorage(): PersistenceStorage & { keys(): string[] };
export declare function createLocalStorageStorage(options?: { storage?: Storage }): PersistenceStorage;
export declare function createIndexedDbStorage(options?: { indexedDB?: IDBFactory; databaseName?: string; storeName?: string }): PersistenceStorage & { probe(): Promise<void> };

/** A stored copy on offer. */
export interface RestoreOffer {
  key: string;
  /** When it was stored (ms since the epoch). */
  savedAt: number;
  name?: string;
  slideCount?: number;
  /** True when it held changes that had not been saved elsewhere (`markSaved`); false for a copy saved as a file. */
  dirty: boolean;
  /** Whether the undo history is stored with it. */
  hasHistory: boolean;
  document: unknown;
  /** An older copy that was moved aside when the user kept editing while an earlier offer was open. */
  earlier?: { savedAt: number; name?: string; slideCount?: number };
}
export type RestoreChoice = "restore" | "discard" | "later";

export type AutosaveState = "starting" | "idle" | "saving" | "saved" | "unavailable" | "error";
export interface AutosaveStatus {
  state: AutosaveState;
  /** False when no storage works here (private browsing, blocked site data); the editor still works. */
  available: boolean;
  /** Whether the document has changes that were not saved with `markSaved`. */
  dirty: boolean;
  savedAt?: number;
  /** A sentence to show the user for `unavailable` and `error` (and a note on `saved`, such as "history too large to keep"). */
  message?: string;
  error?: "quota" | "write";
  /** The adapter in use: "indexedDB", "localStorage", "memory" or the host adapter's name. */
  storage?: string;
  offer?: RestoreOffer;
}

export interface PersistenceOptions {
  /** A stable string that names this document; two documents with the same key share one stored copy. */
  key: string;
  /** `"indexeddb"` (default, with localStorage as the fallback), `"localstorage"`, `"memory"`, `false` (off) or your own adapter. */
  storage?: "indexeddb" | "localstorage" | "memory" | false | PersistenceStorage;
  /** Milliseconds after the last change before a copy is written (default 800), and the longest a copy may lag behind (default 5000). */
  debounceMs?: number;
  maxWaitMs?: number;
  /** Store the undo and redo history with the document (default true), limited to the newest entries and bytes (defaults 200 and 2,000,000). */
  includeHistory?: boolean;
  maxHistoryEntries?: number;
  maxHistoryBytes?: number;
  /**
   * Called when a stored copy differs from the document the session started with. Return `"restore"`, `"discard"` or `"later"` (or a promise).
   * `actions` restores or discards on demand, for a prompt with buttons. Without a handler the offer waits in `persistence.pending`.
   */
  onRestorePrompt?: (offer: RestoreOffer, actions: { restore(): Promise<boolean>; discard(): Promise<boolean> }) => RestoreChoice | Promise<RestoreChoice>;
  /** Called on every status change, for an indicator. */
  onStatus?: (status: AutosaveStatus) => void;
  /** Called before every write and before the page unloads, so the host can commit a draft (text being edited on the canvas). */
  beforeFlush?: () => void;
  /** Warn before the page closes while the document is `dirty` (default true). */
  warnOnUnload?: boolean;
  /** For tests and frames: the window that receives `beforeunload`, `pagehide` and `visibilitychange` (default the global window; null for none). */
  window?: Window | null;
  now?: () => number;
}
export interface Persistence {
  /** Resolves when storage has been opened and read: `{ available, offered }`. It does not wait for the user's decision on an offer. */
  readonly ready: Promise<{ available: boolean; offered: boolean; offer?: RestoreOffer; reason?: string }>;
  readonly status: AutosaveStatus;
  /** True when the document differs from the last `markSaved()` (or from how the session started). */
  readonly dirty: boolean;
  /** The stored copy on offer, or undefined. */
  readonly pending: RestoreOffer | undefined;
  /** An older copy moved aside while an offer was open. */
  readonly pendingEarlier: { savedAt: number; name?: string; slideCount?: number } | undefined;
  /** Put the offered copy back: one undoable change (and the undo history too, when the session has not been edited). Resolves false when nothing was on offer. */
  restore(): Promise<boolean>;
  /** Decline the offered copy and delete it. */
  discard(): Promise<boolean>;
  restoreEarlier(): Promise<boolean>;
  /** The host saved the document elsewhere (a download, a server): it is no longer `dirty`, and the stored copy records that. */
  markSaved(): Promise<boolean>;
  /** The host loaded a document into the editor: treat it as the starting point (not dirty, nothing written) until the next change. */
  rebase(): void;
  /** Write the document now; resolves when stored (false when it could not be). */
  flush(): Promise<boolean>;
  /** Delete the stored copy and stop treating the document as changed. */
  clear(): Promise<void>;
  destroy(): void;
}
export declare const DEFAULT_DEBOUNCE_MS: 800;
export declare const DEFAULT_MAX_WAIT_MS: 5000;
export declare const DEFAULT_MAX_HISTORY_ENTRIES: 200;
export declare const DEFAULT_MAX_HISTORY_BYTES: 2000000;
export declare function createPersistence(editor: EditorSession, options: PersistenceOptions): Persistence;
/** A sentence for a status: "Saved on this device at 2:03 PM", or why autosave is off. */
export declare function describeAutosave(status: AutosaveStatus | undefined, options?: { locale?: string }): string;
