// The worker entry of the source pane's text checks (`createSourcePane(el, { worker })`). `worker: true` starts it with
// `new Worker(new URL("./source-worker.js", import.meta.url), { type: "module" })`, which webpack, Turbopack, Vite (build) and Parcel bundle; a host can
// also write `new Worker(new URL("@openpresentation/opf-editor/source-worker", import.meta.url), { type: "module" })` itself, or build this file as an
// extra entry point (esbuild) and pass its URL. The file imports core, so it runs only bundled. See docs/embedding.md, "The source worker". It does the
// same work as the pane's own inline path (`./source-check.js`), off the main thread. It says `{ ready: true }` once it runs, so the pane can tell a
// worker that loaded but never started (an emptied script) from a slow check. Requests run in order, but when several checks of one kind are waiting only the newest runs
// (the older ones are answered with `skipped`): the pane drops stale replies anyway.
import { createCheckService } from "./source-check.js";

const service = createCheckService();
let queue = [];
let scheduled = false;

function drain() {
  scheduled = false;
  const work = queue;
  queue = [];
  // The last check and the last syntax request win; catalogs messages always run, in order, and before the checks that follow them.
  const newest = new Map();
  work.forEach((message, index) => { if (message.type === "check" || message.type === "syntax") newest.set(message.type, index); });
  work.forEach((message, index) => {
    if ((message.type === "check" || message.type === "syntax") && newest.get(message.type) !== index) { self.postMessage({ id: message.id, ok: true, skipped: true }); return; }
    const reply = service.handle(message);
    try { self.postMessage(reply); } catch (error) { self.postMessage({ id: message.id, ok: false, error: `The result could not be sent: ${error?.message ?? error}` }); }
  });
}

self.postMessage({ ready: true });

self.onmessage = (event) => {
  queue.push(event.data);
  // Messages that arrive while a check runs queue behind it; draining on the next task lets everything already waiting be seen together.
  if (!scheduled) { scheduled = true; setTimeout(drain, 0); }
};
