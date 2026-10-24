// The worker entry of the source pane's text checks (`createSourcePane(el, { worker })`). A host bundles this file as its own worker script
// (`@openpresentation/opf-editor/source-worker`), for example `new Worker(new URL("@openpresentation/opf-editor/source-worker", import.meta.url), { type: "module" })`
// with a bundler that understands that form, or builds it as an extra entry point and serves it next to the page. It does the same work as the pane's
// own inline path (`./source-check.js`), off the main thread. Requests run in order, but when several checks of one kind are waiting only the newest runs
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

self.onmessage = (event) => {
  queue.push(event.data);
  // Messages that arrive while a check runs queue behind it; draining on the next task lets everything already waiting be seen together.
  if (!scheduled) { scheduled = true; setTimeout(drain, 0); }
};
