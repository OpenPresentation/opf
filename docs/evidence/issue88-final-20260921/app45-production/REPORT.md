# Canonical pptx.dev production acceptance — 14/18 passed; gate remains open

The first complete canonical production run passed 14 of 18 tests and failed four, with no retries, no skipped tests and no flaky results. Two failures expose automatic paste formatting changing authored JSON whitespace. One test accidentally shortened an existing font-readiness budget. The CRLF Author test failed to open its third suggestion popup; its root cause remains unresolved. A separate instrumented diagnostic passed, but does not replace this failed acceptance result.

## Source, deployment and execution

- Target: https://www.pptx.dev, anonymous isolated contexts; no account or backend writes intentionally performed.
- Deployment `dpl_BcdbKFRoReTjKbQnMQ2e4NZSVask`, READY, alias `www.pptx.dev`, source `e37e0da19671178da482bbe52cfd642419b670b5`; exact parent-provided receipt: `deployment.json`.
- Unchanged test worktree: `/private/tmp/opf-issue88-fixes-20260921/pptx-dev`, commit `3f364cb5cec681e9d802a2caeee4ebc10e4ad39b`, tree `91445756a094168b13ee13dadb7fae55cc7da74f`. Parent verified merged tree equality and final Linux/Windows CI passes. Worktree remained clean after the production run.
- Node v24.21.0; Playwright 1.63.0; macOS arm64; Chromium version 153.0.8010.12. `browser-runtime.json` distinguishes the observed browser version, default headed executable descriptor, and configured headless-shell executable inferred from Playwright's installed selector. The original browser process PID was not retained.
- Start: 2026-09-21T14:22:10.813Z; duration 127201.006ms; exit 1. Exact command is in `RUNBOOK.md` and copied below. `test-input-hashes.json` pins all nine specs, clipboard helper, configuration, package manifest and lockfile.

```sh
env -u OPF_BROWSER_STORAGE_STATE \
  OPF_APP_URL=https://www.pptx.dev \
  PLAYWRIGHT_JSON_OUTPUT_FILE=/private/tmp/opf-issue88-final-production-20260921/results.json \
  '/Users/michael/Library/Application Support/fnm/node-versions/v24.21.0/installation/bin/node' \
  node_modules/@playwright/test/cli.js test --reporter=list,json \
  --output=/private/tmp/opf-issue88-final-production-20260921/results \
  > /private/tmp/opf-issue88-final-production-20260921/browser.log 2>&1
```

## Four failures, kept distinct

| Failure | Exact observation | Conclusion |
| --- | --- | --- |
| Inspector all-slide workflow at 540px | Before any canvas edit, actual Copy argument had two-space pretty formatting, normalized key spacing and no authored final newline; `1e2` and string escapes remained. | Product source-preservation defect. Shared `OpfEditor` had `formatOnPaste: true`; a paste can asynchronously format the buffer. |
| Inspector source recovery after slide reorder | Slide indices/IDs and edited title were correct, but three-space authored indentation became two spaces and final newline disappeared. | Same implicit-formatting defect, independently exposed after replacement. No basis for weakening exact source assertions or undo checks. |
| Long-quote preview/PPTX test | `singleSlidePreview` count assertion waited 5000ms, observed zero SVGs 14 times, and stopped before the existing 20000ms visibility assertion. UI showed “Loading slide fonts…”. | Test readiness regression. Quote/footer/export assertions were never reached; this run does not establish a quote layout/export defect. |
| Author exact CRLF categorical choices | Built-in Dark and document layout selection plus exact CRLF source undo/redo passed. Third Ctrl+Space at cursor 11:18 over `document-layout` produced no visible suggest widget within 5000ms. | Unresolved suggestion reliability failure. It is not a source mismatch or proved clipboard transport problem. |

The clipboard helper returns the exact submitted `writeText` buffer, awaits the real API and independently checks platform clipboard transport. No normalization is applied to authored-source comparisons. The two Inspector source differences are therefore product-buffer changes, not macOS/Windows clipboard newline conversion.

Long-quote details: the trace has 117 request records; 35 font responses completed with HTTP 200 and Roboto-700-normal remained pending (`status: -1`, `time: -1`) when the failed test closed the context. See `quote-font-loading-evidence.json`. No recorded failing HTTP response explains that pending font. The count assertion started at monotonic 87276.903ms. The prior font budget was restored only for this fixture in the NEW follow-up worktree, `/private/tmp/opf-issue88-explicit-formatting-20260921/pptx-dev/tests/e2e/inspector.spec.ts`; other helper callers retain their default budget. The focused local 4326 run passed 1/1 in 2.3s, including wide/portrait rendered bounds, PPTX download/reimport and OOXML footer separation. Log and exact diff: `../opf-issue88-explicit-formatting-20260921/quote-browser.log` and `quote-readiness.patch`. This is local follow-up verification, not a production rerun.

## Author popup event evidence and uncertainty

The original failing trace is `results/author-json-options-Author-cda0b-exact-CRLF-source-undo-redo/trace.zip`. The following times are trace monotonic milliseconds:

| Time | Observed event/state |
| --- | --- |
| Before navigation | Last Copy argument is exact CRLF source with `theme: dark` and `layout: document-layout`; saved as `author-last-copied-source.json`. |
| 18014.632 | After Go to Line Enter: quick input has `display:none`; Monaco has `.focused`; suggestion widget has `display:none`, `visibility:hidden`, no `.visible`. |
| 18018.122 | Footer cursor 11:18 check completes; the same hidden/focused state remains. |
| 18018.391–18021.733 | Ordinary `input.press('Control+Space')`; action snapshot at 18020.927 still shows focused Monaco and both widgets hidden. |
| 18022.816–23026.860 | `.suggest-widget.visible` expectation waits 5000ms and fails. |
| 23033.044 | Failure snapshot still shows Monaco focused, quick input hidden and suggest widget hidden. |

`author-trigger-focus-evidence.json` and `author-resolved-widget-evidence.json` retain the decoded snapshot evidence. Snapshot references were resolved using the installed Playwright `snapshotNodes` post-order/reference-delta algorithm, not inferred from screenshot appearance alone. These observations do not support an open Go to Line dialog or visibly open suggestion menu intercepting the shortcut. They cannot reveal the unrecorded internal Monaco context keys or prove whether the original provider was invoked.

A separate adapter replay on the exact final buffer produced 32 suggestions, four with valid same-line ranges. “AAB Loaded Layout” had a valid line-11 range and replacement. Existing adapter warnings for no-op choices mapped to EOF and layout choices requiring multiline edits are independently real but do not establish why this third trigger produced no popup; there was still a valid requested loaded option. Replay and original warnings: `author-provider-replay.json`, `author-console.json`.

The test helper meaningfully checks the exact cursor, visible suggestion widget, accessible Enum Member label, ordinary click, and exact source/undo/redo. It lacks explicit pre-key quick-input-hidden and editor-focused assertions, and records no internal trigger/provider event. Adding those preconditions would strengthen diagnostic contracts but cannot be claimed to fix this failure: the original trace already shows those DOM states.

One parent-authorized diagnostic ran the unchanged CRLF workflow with pass-through keyboard/focus/widget and Worker request/reply observation. It passed 1/1 in 9.2s; all three Ctrl+Space events targeted the focused native editor with quick input hidden and suggest widget absent/hidden. No application, source or API behavior was stubbed; no retries were enabled. Its root is `/private/tmp/opf-issue88-author-diagnostic-20260921` (log, trace, observation attachment, `trigger-summary.json`, `SHA256SUMS`). The diagnostic did not reproduce the failure; it supplies comparison evidence, not a green replacement for the original run. No further production reruns or speculative Author fixes were performed.

## Accepted portions and reviewed visuals

The 14 passing tests cover LF Author built-in/document/loaded categorical choices with exact undo/redo; Author code editing and offline editable export/reimport at 1280 and 540; Author canvas/tab/edit/export/reimport; wide Inspector all-slide/shared-furniture edits with exact source and offline export/undo; ID-less stale-draft discard; strict-overflow recovery and first-failed-mount recovery; font diagnostic access; navigation cleanup; anonymous Inspector JSON/export/reimport; offline Monaco diagnostics/completion; inert hostile SVG text; deployed toolkit package proofs; and YAML/Markdown malformed-input recovery. `acceptance-summary.json` lists exact names/status/durations; `results.json` is the full original runner result.

Visual inspection found readable wide Inspector later-slide editing, Author content/options, clear strict-overflow error state, successful same-ID recovery, and reachable expanded “Aptos → Carlito (visual substitute)” preview notes outside the artwork. The narrow Inspector failure image has readable stacked controls/source, but visibly reformatted JSON and stopped before the narrow canvas workflow; that workflow is not accepted. The long-quote failure image shows the loading-fonts state, not evaluated quote artwork. The Author CRLF failure image confirms cursor 11:18 and document-layout without a suggestion popup.

Key screenshots/export retained under `results/`:

- `inspector-editing-all-Insp-15273-fline-undo-export-at-1440px/inspector-later-slide.png`
- `inspector-recovery-schema--76507-ers-after-source-correction/inspector-strict-overflow.png` and `inspector-render-recovered.png`
- `inspector-recovery-font-su-beb5b--Inspector-canvas-is-active/inspector-font-notes.png`
- `author-json-options-Author-6cab9-h-exact-LF-source-undo-redo/author-layout-options.png`
- `author-anonymous-Author-ca-d560b-xport-and-undoable-reimport/author.png` and `author-export.pptx`
- Extracted original failure frames: `review-images/inspector-narrow-failure.jpeg`, `quote-font-loading-failure.jpeg`, `author-crlf-failure.jpeg`.

Exactly 11 passing tests assert their pageerror arrays are empty; the passing ID-less, navigation-cleanup and SVG tests do not all make that general assertion. Five passing workflows explicitly assert no POST requests after switching offline. Do not generalize these assertions to all 18 tests. Browser export/reimport and OOXML checks do not establish native PowerPoint or font compatibility. Those gates remain separate, as do broad source-preservation claims beyond the fields exercised here.

## Evidence handoff

`SHA256SUMS` hashes all original traces, screenshots, retained export, logs, structured results, input/runtime/deployment receipts and this report. `test-input-hashes.json` pins the tested source. Raw traces and decoded DOM remain outside repositories; durable docs should retain this concise outcome and artifact references rather than inline large binary or DOM evidence.

Issue 88 and overall developer-ready acceptance remain open. Required follow-up includes the explicit-formatting correction with fresh acceptance, unexplained Author suggestion reliability, and broader preservation boundaries; this report makes no release/native-compatibility completion claim.
