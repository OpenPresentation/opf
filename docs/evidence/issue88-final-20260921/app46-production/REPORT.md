# App #46 canonical production acceptance — failed, 11/19

The single full canonical run passed 11 of 19 tests and failed eight (zero retries, skips or flaky results). This is not a successful production acceptance gate. All eight failures stopped at initial asset/editor readiness or a suggestion/format operation; no exact-source comparison failed in this run. However, the narrow workflows and new warm-worker paste regression did not reach their preservation/export assertions, so the production paste fix is not fully accepted by this run. No tests, source, timeouts or browser conditions were changed, and no reruns were performed.

## Identity and execution

- Target: `https://www.pptx.dev`, deployment `dpl_AGzL3mmPqZ5giiQWzh9EqyDPF8SX`, READY receipt captured 2026-09-21T14:52:07Z in `deployment.json`.
- Accepted merge: `c558dcc3a2e362bc238eb433a2db97fa682dfcc8`. Test worktree remained clean at `59e888580c38ca5cfbf5105b2ec09c2bfc956ca1`; parent verified identical tree `21a27c9fa459f04db24dc2759acc1bb6d9ed93b8`. Parent reported Linux and Windows CI run35613807353 both SUCCESS.
- Node24.21.0, Playwright1.63.0, macOS arm64, Chromium153.0.8010.12. The active runner worker's own child process was observed using the headless-shell binary whose SHA256 is `a0bfe7b4da4787b66058477d696cd1d09065d25f06a548947722b9af77ee8282`; see `runtime-process-observation.json` and `runtime-prepared.json`.
- Run start2026-09-21T14:52:43.494Z; duration183556.197ms; exit1. `source-binding-final.json` records pre-run identity checks. `test-input-hashes.json` pins all specs, helper, config, manifest, lockfile and shared editor source.
- Exact command is retained in `RUNBOOK.md`: Node24 Playwright `test --reporter=list,json`, `OPF_APP_URL=https://www.pptx.dev`, `OPF_BROWSER_STORAGE_STATE` unset, unique output under this evidence directory. One worker, existing 45s test budget and existing assertion budgets; no retries.

## Eight exact failure stages

| Test | Failure | Assertions reached / not reached |
| --- | --- | --- |
| Author categorical LF | `author-json-options.spec.ts:111`: second popup became visible but stayed “Loading…”; exact “AAA Document Layout, Enum Member” option absent for5000ms. | Built-in Dark choice and exact LF source undo/redo passed. Document/loaded layout selection not reached. |
| Author code540 | `author.spec.ts:34`: after pasting invalid schema fixture, squiggle count remained0 for5000ms. | Initial source edit reached; actual code fixture, canvas, offline export/reimport not reached. |
| Author canvas | `author.spec.ts:70`: same initial schema-diagnostic squiggle count0 for5000ms. | Actual presentation/canvas/tab/history/export workflow not reached. |
| Inspector all-slide540 | `inspector-editing.spec.ts:51`: same initial schema-diagnostic squiggle count0 for5000ms. | Exact authored fixture, all-slide edits, furniture, undo/export not reached. |
| Inspector strict-overflow recovery | `inspector-recovery.spec.ts:46`: initial retained-slide title target absent for5000ms. | UI still “Loading Inspector…”; initial draft, strict-overflow replacement and recovery not reached. |
| Inspector font-note accessibility | `inspector-recovery.spec.ts:97`: initial retained-slide canvas exists but stays empty/hidden for5000ms. | Source editor visible, preview says “Loading slide fonts…”; notes accessibility/editing not reached. |
| Warm JSON worker paste/explicit formatting | `json-paste-formatting.spec.ts:97`: completed successful `format` RPC count remains0 for5000ms. | Deliberate whitespace insertion and exact copied-buffer check passed; ordinary Format Document command submitted. Formatter completion/undo, final authored paste, exact copied-source and no-implicit-format checks not reached. |
| YAML/Markdown workflow | `yaml.spec.ts:17`: initial schema-diagnostic squiggle count0 for5000ms. | Actual YAML/Markdown conversion, multilingual-content preservation and offline recovery not reached. |

Full error messages and call logs are preserved in `browser.log`, `results.json` and each failure's `error-context.md`. `acceptance-summary.json` provides exact titles, durations and statuses. The new paste regression produced no authored/copied-source artifact because it failed before those write/check steps.

## Existing trace evidence: readiness and assets

Eight original failure traces contain866 request records and no recorded HTTP status>=400 responses. This does not establish that all requests succeeded: numerous requests have `status:-1`, `time:-1`, no response headers/body, and were still pending when failed contexts closed. Those are pending/no-response records, not HTTP errors. No live network probes were performed after the run.

The traces show same-origin delayed or pending JS requests, including requests whose Referer is the bundled `turbopack-worker-2g80pj3ycf14_.js`. Representative completed responses:

| Trace | JS chunk | HTTP / recorded duration / body bytes | Cache headers |
| --- | --- | --- | --- |
| LF Author popup | `1__7ul3n2ffhd.js` |200 /4814.933ms /14033 |`x-vercel-cache:HIT`, `age:7983`, immutable max-age31536000, Brotli |
| Inspector540 diagnostics | `14xtrtee8fs0x.js` |200 /4925.220ms /24155 |HIT, age381399, immutable max-age31536000, Brotli |
| Initial strict-recovery page | `3g5yp2sxazehx.js` |200 /4902.213ms /628911 |HIT, age8077, immutable max-age31536000, Brotli |

Pending same-origin JS appears in seven of the eight failures: `3i1dij4r-3pfl.js` (LF popup, Author canvas, font notes), `14xtrtee8fs0x.js` (Author540), `42p0shxuoyiya.js` and `1__7ul3n2ffhd.js` (Inspector540), `1ehoc4p33uawz.js` (font notes/YAML), and `1__7ul3n2ffhd.js` (format command/YAML). Some fonts completed in4–5.5s, others remained pending. The strict-recovery page has no pending request record, but its large JS response completed about40ms before the 5s title-target assertion ended, while the final screenshot still shows “Loading Inspector…”.

These observations support investigating production asset/editor readiness. They do not identify whether delivery, scheduling, hydration, worker initialization or another factor caused each deadline miss. Cache HIT responses do not support an unqualified “cold origin cache” explanation. No external schema-fetch cause is inferred: the shared editor has `enableSchemaRequest:false`. No timeout increase, retry or product workaround is proposed as a proved fix here. Useful response headers, byte sizes, timing, assertion intervals and final widget states are retained in `trace-readiness-evidence.json` (generated solely from the original traces by `analyze-traces.py`).

LF popup timeline (trace monotonic milliseconds): cursor11:18 verification ends9807.222; Ctrl+Space runs9808.574–9823.165; visible-popup assertion succeeds10013.634; exact document option wait runs10015.703–15017.838. The widget remains `suggest-widget message visible` with “Loading…”. Worker-referred `1__7ul3n2ffhd.js` takes4814.933ms; its subsequent worker-referred `3i1dij4r-3pfl.js` starts14542.032 and remains pending at close. See `author-lf-widget-timeline.json` for retained DOM states.

This differs from the earlier app45 CRLF failure, which had no visible popup on the third trigger. The current CRLF case passed. Neither fact resolves that historical failure. Prior14/18 evidence stays intact at `/private/tmp/opf-issue88-final-production-20260921`; `prior-failure-evidence.json` pins its report/log/result/manifest hashes. Completion-range prototype work is separate from this asset/readiness investigation.

## Passing scope and visual review

The11 passes are: CRLF Author categorical built-in/document/loaded choices with exact undo/redo; Author code1280 editing/export/reimport; Inspectorwide1440 all-slide/shared-furniture exact source/history/offline export; reordered-source exact preservation; ID-less stale-draft discard; long-quote wide/portrait preview bounds and PPTX/reimport/OOXML footer checks; navigation cleanup; anonymous Inspector JSON/history/offline export; bundled offline Monaco worker diagnostics/completion/recovery; SVG inertness; and deployed package toolkit proofs.

Wide Inspector screenshot shows compact authored source with retained escapes/exponent spelling, edited second/third titles and shared header; the selected third-title preview is readable. CRLF Author screenshot visibly offers built-in, document and loaded layout choices. Failure frames show LF popup “Loading…”, Inspector page/slide-font loading, and narrow editors containing the intended invalid diagnostic fixture. The narrow screenshots are failure-state evidence, not accepted canvas/editing visuals. Strict-recovery and font-note success screenshots were not produced in this run because their initial readiness checks failed; older success images must not be presented as current-run acceptance.

Reviewed images are the generated `results/inspector-editing-all-Insp-15273-fline-undo-export-at-1440px/inspector-later-slide.png`, CRLF Author `author-layout-options.png`, and original failure screencast bytes extracted into `review-images/`. No image editing or extra browser runs occurred. The long-quote test passed its DOM/PPTX assertions but does not emit a screenshot or preserve its temporary download; no new standalone PPTX artifact is claimed.

Seven passing tests explicitly asserted no pageerrors; four other passing tests do not make that general assertion. Three passing workflows explicitly asserted no POST requests after switching offline. Do not claim all19 were error-free or all workflows completed offline. All contexts were anonymous and browser-local; no intentional account/backend writes were performed.

## Handoff

`SHA256SUMS` covers the original8 traces, error contexts, log, structured result, source/runtime/deployment identities, extracted failure frames, successful screenshots and this report. `artifact-index.json` names/hashes the raw traces and images. Raw binary/DOM evidence remains outside repositories; durable handoffs should reference these receipts and the bounded result.

The full production acceptance gate remains failed. The source-formatting change has passing Linux/Windows CI and selected canonical source-preservation coverage, but warm-worker paste acceptance remains uncompleted on this production run. Keep issue88 open for Author reliability and readiness/preservation boundaries. Native PowerPoint/font compatibility remains a separate unresolved gate; this browser run cannot close it or the overall goal.
