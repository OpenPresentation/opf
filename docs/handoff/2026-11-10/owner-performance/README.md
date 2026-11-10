# W06 owner workload: final browser preparation

Status: **source-only preparation; no new benchmark, build or browser run**. This evidence/preparation branch is not production code and must not be merged merely to carry historical archives. The coordinator owns the final source freeze, local quiet slot, CI, native acceptance and release. The current preparation checkpoint normally includes coordinator `6db7214e41e9c7afd38ba63c2f467866c9ef6dd6`; the eventual measurement must bind the actual final source and every served/build input anew.

## Exact inputs

The actual owner inputs exist in immutable Git `4d1ffa78440c47d955d9883575d347996325bf40` under `docs/handoff/2026-11-09/svg-performance/inputs/`. Direct Git reads reproduced both original sizes and SHA-256 values:

| Input | Slides | Original bytes | SHA-256 |
| --- | ---: | ---: | --- |
| original-16.opf.json | 16 | 48,696 | e14be44e63a8bbe4e64c5bdd2b6d95194ed39dc5e67c09c5a6a1225d13396a29 |
| extended-36.opf.json | 36 | 98,976 | 249a8912ce59d7d55988d04b41909033017eb285b239960cb7fba6fab8d62599 |

The first sixteen slide objects are unchanged. The twenty additions cycle the originals with unique IDs and small title/notes edits, as recorded in [the original manifest](input-manifest.json). This is the retained iPhone concept deck, not a substituted synthetic workload. There are no image/src assets, one chart, one table and one document-level `video-playback` dataset. Its numeric edit is `datasets.video-playback.rows.0.1`, 33→34, consumed by one chart at sixteen slides and two at thirty-six. Every original footer uses `deck.slideCount`; appending twenty slides legitimately changes those sixteen rendered footers. Byte identities include the original CRLF/LF differences; do not parse and rewrite the inputs during recovery.

`materialize-inputs.mjs` recovers only those immutable blobs into a fresh owned artifact directory, verifies both hashes and first-sixteen equality, and records an input-only receipt. It never starts product code or synthesizes owner content.

## Existing evidence and the questions it already answers

| Evidence | Actual scope | Preserve these limits |
| --- | --- | --- |
| Server SVG baseline, source58e, historical branch `codex/rr-105-svg-performance` | Eight Node cases, first plus five warm batches; standalone/selected/system modes, CPU/RSS/GC heap, raw/gzip/Brotli/font bytes and element counts | One Windows workstation; whole-process RSS; system SVG omits embedded fonts; not browser/cloud/device timing |
| Demand trial at historical4d1 | Eight fresh Node children; whole131faces versus demand3, equivalent SVG | Real36-slide13.6% preparation-plus-first wall penalty remains historical; module import separate |
| Coverage-only cold trial at ddbd1 | Six Node children/three arms on exact36; 648runtime output guards,216retained digests | Rough first-use parity, n2; startup CPU8.82% above whole;306MiB versus488MiB cumulative HWM; no new mobile or leak claim |
| Browser baseline `36760d1dfa1eba57710db86d0886f83a4b1a327a` | Six16/36 × desktop/4x/390px4x cells,264UI operations,624system-SVG pairs, traces/screenshots/network/heap | Redraw readiness excluded the independently debounced review. Cannot relabel these intervals settled-review latency.390px and CPU4x were desktop proxies, no real phone |
| RR117 settled trial `f7602da8f9c3acc456faae7763668d91d56d8e5f` | Eight fixed same-candidate cold/cached cases,72primary edits,36complete-report pairs,204emitted-SVG pairs;20edit/4destroy observations per mode | Settles both review and workspace; n3/oneprocess percell. Fresh-cache control is not historical plainvalidate or v0.33. Post-dispose residual3.1–3.3MiB in BOTH modes; short observation is not leak acceptance |
| CE20 startup source9133596 | Maintained6-slide sample/300-slide expansion startup, unchanged3200/6400ms budgets and per-slide analysis work controls; exact output comparisons | Different workload from the owner16/36. Current final package CI can exercise this maintained guard; do not rerun the old causal diagnosis |

The evidence-only branches above are **NEVER MERGE**. Read their exact source/raw receipts; do not normally merge their old producer snapshots into the final candidate. No new measurement is needed to repeat an unchanged historical verifier.

## Maintained controls and proven harness gap

`packages/editor/test/startup-perf-browser.mjs` enforces first-preview work counts, one-slide edit analysis and unchanged startup budgets. `studio-perf-browser.mjs` measures synthetic300-slide selection/drop p95, lazy filmstrip and50→200edit heap growth. `source-worker-perf-browser.mjs` measures real keyboard/worker/main-thread heartbeat samples with semantic negative controls. They remain useful existing CI guards, but none is the exact owner workload or a real low-power-device test. Studio's `performance.memory` check is Chromium-specific; a missing value must not become a measured zero in this lane.

The archived RR117 runner hardcodes `C:/opf-work/perf-svg/.../inputs` and `C:/opf-work/svg-browser/.../site`. That cannot run on this Mac. [The successor provenance](driver-provenance.json) proves `build.mjs` and `browser-entry.mjs` are byte-identical copies; `run-paired-review.mjs` changes only these two roots to explicit `--inputs`/`--assets` paths, retaining every original fixed matrix, deadline, assertion, oracle and soak policy. These drivers are prepared, **not executed** here. They are available if the coordinator identifies a reason for another paired contrast; no such repeat is proposed automatically.

Use the current maintained `packages/editor/scripts/build-playground.mjs --split-fonts` to prepare current assets, in a fresh `OPF_PLAYGROUND_OUT`. It already verifies pinned font hashes and writes Roboto startup, lazy Office/Intos/script faces, licenses, HarfBuzz files and shipped editor styles. Never silently serve archived old fonts/WASM under a current bundle. A build/served-input receipt must bind both paths, the entire esbuild graph, lock/runtime versions and actual browser version.

## Smallest meaningful final measurement

The following is the proposed current-candidate acceptance protocol, not an already executed result or a new regression threshold:

1. Build once after the final source freeze. Recover exact16/36 inputs, validate current format without rewriting them, verify the first sixteen objects and inspect chart-consumer counts. Run one functional smoke with strict complete-report equality before approving a timing window.
2. In one coordinated quiet window, measure six current cached browser cells:16/36 × desktop1440×900 at1x, desktop at4x CPU and390×844 at4x CPU, DPR1. Keep setup/cold first-visible DOM separate from warmup plus three retained primary repetitions. Record the actual browser/OS/CPU. Neither viewport nor CDP CPU throttle qualifies real mobile hardware.
3. Include mount/firstvisibleDOM, navigation, requested all-thumbnail sorter, one local title, shared numeric chart datum, global metadata and exact16→36append. Await workspace redraw, review idle including its unchanged300ms debounce, fonts ready, timer turn and two frames. Retain CPU task/script/layout counters, overlapping long tasks, actual selected/output work, DOM, after-intervalGC V8 heap and owned network/font bytes. DOM insertion is not physical first paint.
4. Compare every complete settled report with public cold validate outside timed intervals. Compare actual sorter SVG with current direct `text:system` output. Require correctness, actual requested work and exact current outputs; do not demand historical SVG equality across intentional current schema/font/catalog changes or pretend system SVG is standalone embedded export.
5. On36/currentcached/CPU1, observe200edits and10mount/destroy cycles with controlledGC checkpoints. Record intentional undo retention separately from postdestroy heap; require retained cache entries/bytes clear, no workspace DOM and stable prepared faces. Report raw residual/trend without a newly invented leak threshold. This extends the already completed historical20/4 observation; even200/10 does not prove absence of leaks.
6. Outside primary timings, record original source/compact document/actual `session.set` operation serialization bytes, raw/gzip/Brotli5 SVG payload, actual network resources, changed output hashes and rendered/cache work for local/shared/global/append changes. Label API-operation encoding separately from a production transport or persisted-storage format. Never imply estimated encoded bytes are measured localStorage/network writes.

Do not rerun the historical Node whole-versus-demand, layout-replay or full8case RR117 optimization matrix unless source review or the new functional/current-candidate measurement reveals a specific regression question. Do not subtract Windows historical redraw-only intervals from Mac settled intervals to advertise a speedup. Profile an actually expensive current phase before proposing another runtime optimization. No benchmark starts before the schema lane releases the shared Mac slot and the coordinator approves the frozen current protocol/source.

## Coordinator-approved source protocol

The coordinator approved preparation of the six-cell current protocol and200edit/10destroy observation. Retention checkpoints are0/20/40/80/120/200 afterGC and each destroy. No physical-mobile/low-power acceptance is delegated or inferred. One matched same-host0.33 registry baseline may be needed later if its host API is compatible; this lane does not silently replace that question with the already completed same-candidate cold/cached contrast.

`build-current.mjs`, `current-browser-entry.mjs` and `run-current.mjs` now implement the approved current protocol as separate successors. The byte-identical historical copies remain available for provenance. Current build preparation refuses altered exact owner inputs and format-invalid inputs; there is no vocabulary projection or data/literal rewrite. If the final schema refuses the originals, stop before timing and prepare an explicitly typed, separately hashed inverse-equivalent projection for review.

The current runner records three primary repetitions after one warmup, separate setup mount/firstSVG DOM observations, current cold-oracle reports, actual sorter/direct-system SVG guards, measured emitted-output hash changes and encoded-size statistics outside the measured intervals. Emitted-output changes are explicitly a partial observed vector, not a claim every unaffected cached slide was rerendered. The200edit observation retains undo history intentionally; disposal clears caches/DOM and records prepared-face stability. ControlledGC and SVG/report oracle work remain outside timed phases and can prime shared renderer state; this instrumentation is disclosed rather than called unperturbed production.

The first-visible construction interval excludes earlier module/startup-face setup. A separate navigation-relative firstSVG timestamp includes harness/controller setup. Neither means physical paint. Browser heap is CDP V8 heap, not browser/GPU process RSS. Resource request records are actual network body bytes from the owned local server; encoded operation/document/SVG sizes are estimates for explicit encodings, not measured production persistence or wire writes.

Before any execution, freeze/push the exact drivers and final product source. Then, under the separately granted heavy slot:

```sh
# Exact input recovery only; already verified in this preparation lane.
node docs/handoff/2026-11-10/owner-performance/materialize-inputs.mjs --out=artifacts/owner-performance-inputs-01
# Build the final source through ordinary pinned Node/pnpm first, then maintained assets into a fresh directory.
OPF_PLAYGROUND_OUT=artifacts/owner-current-assets-01 OPF_PLAYGROUND_SPLIT_FONTS=1 node packages/editor/scripts/build-playground.mjs
node docs/handoff/2026-11-10/owner-performance/build-current.mjs --inputs=artifacts/owner-performance-inputs-01 --out=artifacts/owner-current-build-01
node docs/handoff/2026-11-10/owner-performance/run-current.mjs --smoke --inputs=artifacts/owner-performance-inputs-01 --assets=artifacts/owner-current-assets-01 --build=artifacts/owner-current-build-01 --out=artifacts/owner-current-smoke-01
# Only after genuine functional smoke/source review and coordinator quiet-window approval:
node docs/handoff/2026-11-10/owner-performance/run-current.mjs --measure --inputs=artifacts/owner-performance-inputs-01 --assets=artifacts/owner-current-assets-01 --build=artifacts/owner-current-build-01 --out=artifacts/owner-current-formal-01
```

Fresh-directory refusals, exact source/bundle/input hashes, actual failure JSON and original90s setup/30s phase/15s trace deadlines remain. Do not change a deadline or retry a failed formal case in place. The source-only checks in `preparation-checks.json` establish syntax and exact input recovery only; they are not functional/browser qualification. No install, product build, browser process or benchmark has run in this preparation lane.
