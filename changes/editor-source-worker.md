---
type: added
packages: [editor]
---
Source editor, phase 4: the source pane can run its text checks in a Web Worker (`createSourcePane(el, { worker })` with the new `@openpresentation/opf-editor/source-worker` script, `pane.whenIdle()`, `pane.checkerStats()`), so typing in a 1000-slide YAML, Markdown or JSON deck never blocks the main thread for 50 ms (it was one 55 to 80 ms task per pause in YAML and Markdown). The worker runs the same `source-check.js` functions as the main thread, so results are identical, and it falls back to the main thread when it cannot run. `editor.applyPatch(operations, meta, { validated })` takes a validation computed elsewhere for exactly the patched document and the session's catalogs, so the session does not validate twice; it is never stored in the history. New browser suites `source-worker` (identical results, fallback, stale answers, catalogs) and `source-worker-perf` (the budgets at 1000 slides).
