/**
 * The worker script of the source pane's text checks. It exports nothing: bundle it as a module worker script and pass the worker to
 * `createSourcePane(container, { worker })`, for example
 * `worker: () => new Worker(new URL("@openpresentation/opf-editor/source-worker", import.meta.url), { type: "module" })`
 * with a bundler that supports that form, or build `dist/source-worker.js` as its own entry point and serve it next to the page.
 */
export {};
