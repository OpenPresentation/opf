// The client side of the source worker (`./source-worker.js`): it owns the worker, numbers the requests, keeps the worker's catalogs in step with the
// pane's, and falls back to the pane's own inline path for good, once, when anything about the worker goes wrong (it cannot start, a script URL is
// blocked or missing, a message cannot be cloned, the worker throws or stops answering). It never loses an edit: a failed request rejects with
// `error.workerFailed === true`, and the pane then does the same work inline.

const DEFAULT_TIMEOUT = 15000;

/** A failure of the worker as an error the caller can tell from an exception of the checked text. */
function failure(cause) {
  const error = new Error(cause instanceof Error ? cause.message : String(cause ?? "The source worker failed."));
  error.workerFailed = true;
  error.cause = cause;
  return error;
}

/** The worker the `worker` option stands for: a function is called, an object with `postMessage` is used as given, `true` starts the package's own. */
function makeWorker(option) {
  if (typeof option === "function") return option();
  if (option && typeof option === "object" && typeof option.postMessage === "function") return option;
  if (option === true) {
    if (typeof Worker !== "function") throw new Error("Web Workers are not available here.");
    return new Worker(new URL("./source-worker.js", import.meta.url), { type: "module" });
  }
  throw new TypeError("The worker option is true, a Worker, or a function that returns one.");
}

/**
 * @param {{ worker: boolean | object | (() => object), onError?: (error: unknown) => void, timeout?: number }} options
 */
export function createSourceChecker(options = {}) {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  let worker = null;
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
    const error = failure(cause);
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(error); }
    pending.clear();
    try { worker?.terminate?.(); } catch { /* Already gone. */ }
    worker = null;
    try { options.onError?.(cause instanceof Error ? cause : error); } catch { /* A host callback must not break the fallback. */ }
  }

  function reply(event) {
    const data = event?.data;
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
    worker.onerror = (event) => { event?.preventDefault?.(); fail(new Error(event?.message || "The source worker failed to start.")); };
    worker.onmessageerror = () => fail(new Error("The source worker sent a message that could not be read."));
    return worker;
  }

  function post(message, kind) {
    if (failed || disposed) return Promise.reject(failure("The source worker is not available."));
    let target;
    try { target = start(); } catch (error) { fail(error); return Promise.reject(failure(error)); }
    const id = ++nextId;
    if (kind) latest[kind] = id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => fail(new Error("The source worker did not answer in time.")), timeout);
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
      for (const entry of pending.values()) { clearTimeout(entry.timer); entry.resolve(null); }
      pending.clear();
      try { worker?.terminate?.(); } catch { /* Already gone. */ }
      worker = null;
    },
  };
}
