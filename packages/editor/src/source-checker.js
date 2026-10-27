// The client side of the source worker (`./source-worker.js`): it owns the worker, numbers the requests, keeps the worker's catalogs in step with the
// pane's, and falls back to the pane's own inline path for good, once, when anything about the worker goes wrong (it cannot start, a script URL is
// blocked or missing, a message cannot be cloned, the worker throws or stops answering). It never loses an edit: a failed request rejects with
// `error.workerFailed === true`, and the pane then does the same work inline.
//
// The worker says `{ ready: true }` as soon as its module has run. A worker that loads but never says so (a script a bundler emptied, a wrong
// file) is given up after `startTimeout` (5 s), not after the 15 s a single check may take.

const DEFAULT_TIMEOUT = 15000;
const DEFAULT_START_TIMEOUT = 5000;

/** A failure of the worker as an error the caller can tell from an exception of the checked text. */
function failure(cause) {
  const error = new Error(cause instanceof Error ? cause.message : String(cause ?? "The source worker failed."));
  error.workerFailed = true;
  error.cause = cause;
  return error;
}

/** Where the worker comes from, for the messages: the URL a host gave, or the package's own file. */
function describe(option) {
  if (option instanceof URL || typeof option === "string") return `The source worker (${String(option)})`;
  if (option === true) return "The source worker (worker: true, the package's source-worker.js, which the app's bundler must emit)";
  return "The source worker";
}

/** Vite's dev server moves a dependency into node_modules/.vite/deps, where `new URL("./source-worker.js", import.meta.url)` names no file. */
function hint(option) {
  if (option === true && /\/\.vite\/deps\//.test(import.meta.url)) {
    return ' Vite\'s dependency optimizer moved the editor into .vite/deps, so the worker file is not next to it: pass `worker: () => new Worker(new URL("@openpresentation/opf-editor/source-worker", import.meta.url), { type: "module" })` and list "@openpresentation/opf" and its "/yaml", "/markdown" and "/source" entries in optimizeDeps.include (docs/embedding.md, "The source worker").';
  }
  return "";
}

/**
 * The worker the `worker` option stands for: a function is called, an object with `postMessage` is used as given, a URL (or a string) is started
 * as a module worker, `true` starts the package's own.
 */
function makeWorker(option) {
  if (typeof option === "function") return option();
  if (option && typeof option === "object" && typeof option.postMessage === "function") return option;
  if (option instanceof URL || (typeof option === "string" && option)) {
    if (typeof Worker !== "function") throw new Error("Web Workers are not available here.");
    return new Worker(option, { type: "module" });
  }
  if (option === true) {
    if (typeof Worker !== "function") throw new Error("Web Workers are not available here.");
    // Written as one expression so that webpack, Turbopack, Vite and Parcel see it and bundle the worker with its imports.
    return new Worker(new URL("./source-worker.js", import.meta.url), { type: "module" });
  }
  throw new TypeError("The worker option is true, a Worker, a function that returns one, or the URL of a worker script.");
}

/**
 * @param {{ worker: boolean | string | URL | object | (() => object), onError?: (error: unknown) => void, timeout?: number, startTimeout?: number }} options
 */
export function createSourceChecker(options = {}) {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const startTimeout = options.startTimeout ?? DEFAULT_START_TIMEOUT;
  const source = describe(options.worker);
  let worker = null;
  let started = false;
  let startTimer = null;
  let failed = false;
  let disposed = false;
  let nextId = 0;
  let sentCatalogs;
  let catalogsSent = false;
  const pending = new Map();
  const latest = { check: 0, syntax: 0 };
  const counts = { worker: 0 };

  function fail(cause) {
    if (failed || disposed) return;
    failed = true;
    clearTimeout(startTimer);
    const error = failure(cause);
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(error); }
    pending.clear();
    try { worker?.terminate?.(); } catch { /* Already gone. */ }
    worker = null;
    try { options.onError?.(cause instanceof Error ? cause : error); } catch { /* A host callback must not break the fallback. */ }
  }

  function reply(event) {
    const data = event?.data;
    // Any message says the worker runs: its ready signal, or an answer (a host's own worker object may not send the signal).
    if (!started) { started = true; clearTimeout(startTimer); }
    if (data?.ready === true && data.id === undefined) return;
    const entry = pending.get(data?.id);
    if (!entry) return;
    pending.delete(data.id);
    clearTimeout(entry.timer);
    if (data.ok === false) { entry.reject(failure(data.error)); fail(new Error(String(data.error))); return; }
    if (data.skipped || (entry.kind && latest[entry.kind] !== data.id)) { entry.resolve(null); return; }
    if (entry.kind) counts.worker++;
    entry.resolve(data.result);
  }

  function start() {
    if (worker) return worker;
    worker = makeWorker(options.worker);
    if (!worker || typeof worker.postMessage !== "function") throw new TypeError("The worker option did not give a Worker.");
    worker.onmessage = reply;
    // A module worker whose script is missing or cannot load fires an error without a message: say which worker it was.
    worker.onerror = (event) => { event?.preventDefault?.(); fail(new Error(event?.message ? `${source} failed: ${event.message}` : `${source} failed to start.${hint(options.worker)}`)); };
    worker.onmessageerror = () => fail(new Error(`${source} sent a message that could not be read.`));
    startTimer = setTimeout(() => { if (!started) fail(new Error(`${source} loaded but did not start within ${Math.round(startTimeout / 1000)} s; the checks run on the main thread.${hint(options.worker)}`)); }, startTimeout);
    startTimer?.unref?.();
    return worker;
  }

  function post(message, kind) {
    if (failed || disposed) return Promise.reject(failure("The source worker is not available."));
    let target;
    try { target = start(); } catch (error) { fail(error); return Promise.reject(failure(error)); }
    const id = ++nextId;
    if (kind) latest[kind] = id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => fail(new Error(`${source} did not answer in time.`)), timeout);
      pending.set(id, { resolve, reject, timer, kind });
      try { target.postMessage({ id, ...message }); } catch (error) { fail(error); }
    });
  }

  /** Send the catalogs when they are not the ones the worker already has (by identity), ahead of the request that needs them. */
  function syncCatalogs(catalogs) {
    if (catalogsSent && sentCatalogs === catalogs) return;
    sentCatalogs = catalogs;
    catalogsSent = true;
    post({ type: "catalogs", catalogs }).catch(() => { /* `fail` already ran; the request after it rejects too. */ });
  }

  return {
    /** Whether the worker can still be used (it may not have been started yet). */
    get available() { return !failed && !disposed; },
    /** Whether the worker is running now. */
    get running() { return worker !== null && !failed && !disposed; },
    /** The catalogs object the worker's next check will use (the last one sent). */
    get catalogs() { return catalogsSent ? sentCatalogs : undefined; },
    /** How many checks the worker answered. */
    get answered() { return counts.worker; },
    /**
     * Check `text` as `format` in the worker, with `catalogs`. Resolves with the `checkSource` result, or with null when a newer check replaced this
     * one. Rejects with `error.workerFailed` when the worker is not usable (and never again starts it).
     */
    check(format, text, catalogs) {
      if (failed || disposed) return Promise.reject(failure("The source worker is not available."));
      try { start(); syncCatalogs(catalogs); } catch (error) { fail(error); return Promise.reject(failure(error)); }
      return post({ type: "check", format, text }, "check");
    },
    /** The syntax findings of a JSON text (null when a newer request replaced this one). */
    syntax(text) {
      if (failed || disposed) return Promise.reject(failure("The source worker is not available."));
      try { start(); } catch (error) { fail(error); return Promise.reject(failure(error)); }
      return post({ type: "syntax", text }, "syntax");
    },
    /** Stop the worker and answer nothing more. */
    dispose() {
      if (disposed) return;
      disposed = true;
      clearTimeout(startTimer);
      for (const entry of pending.values()) { clearTimeout(entry.timer); entry.resolve(null); }
      pending.clear();
      try { worker?.terminate?.(); } catch { /* Already gone. */ }
      worker = null;
    },
  };
}
