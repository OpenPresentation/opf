# Production asset/editor readiness investigation

The one authorized fresh diagnostic did not reproduce the app46 delays. It established the actual worker bootstrap graph and showed healthy worker computation once initialization completed. The original11/19 production result remains failed; this diagnostic is not an acceptance rerun or replacement. No product/tests/timeouts changed.

## Evidence collected

- Original failure traces: `/private/tmp/opf-issue88-app46-production-20260921/results/*/trace.zip`, with preserved hashes and request timing extracts in `worker-graph-and-timings.json`.
- Four sequential read-only public asset probes: `turbopack-worker-2g80pj3ycf14_.js`, `1__7ul3n2ffhd.js`, `3i1dij4r-3pfl.js`, `14xtrtee8fs0x.js`. All returnedHTTP200 in282,81,72,70ms respectively. `asset-probes.json` retains exact curl timing data; `chunks/` retains bodies/cache headers. Original traces did not retain these JS response bodies, motivating the probes.
- One fresh anonymous Chromium540x960 visit to canonical `/inspector`, same installed Playwright1.63 / Chromium153 / Node24 and deployment identified in worker config as `dpl_AGzL3mmPqZ5giiQWzh9EqyDPF8SX`. `diagnostic.cjs` adds pass-through Worker construction/postMessage/reply observers, page request/response timing, resource and long-task observations, and UI-state sampling. It preserves real worker/API behavior; it does not stub services or replay a suite.
- The diagnostic pastes one invalid schema fixture, then a valid local fixture, invokes ordinary Format Document, and observes actual worker and canvas readiness. Observation ceilings permit measuring eventual completion; they are not changed acceptance assertion budgets. There were no extra page visits, account actions or further probes.

Exact diagnostic command:

```sh
'/Users/michael/Library/Application Support/fnm/node-versions/v24.21.0/installation/bin/node' \
  /private/tmp/opf-readiness-investigation-20260921/diagnostic.cjs \
  > /private/tmp/opf-readiness-investigation-20260921/diagnostic.log 2>&1
```

## Actual dependency graph

Both workers use `turbopack-worker-2g80pj3ycf14_.js`. Its observed constructor URL fragment carries the dependency list. The849-byte bootstrap calls `importScripts.apply(self, urls)`. Worker Resource Timing confirms sequential loading in the diagnostic.

JSON worker (identified by actual `doValidation`/`format` RPCs):

`turbopack-3zuepcv-0ud_a.js → 28nhevwq6-582.js → 14xtrtee8fs0x.js → 1__7ul3n2ffhd.js → 3i1dij4r-3pfl.js`

Editor worker:

`turbopack-367f65wvpccl2.js → 28nhevwq6-582.js → 42p0shxuoyiya.js`

JSON dependency loads took21.5,3.2,68.5,151.2,21.4ms in order; worker `$initialize` took516.9ms including bootstrap/scheduling. Editor initialization took240.1ms. JSON validation RPCs took5.9,1.0,0.7ms; explicit formatting RPC took0.6ms. Neither observed worker reported an error. These are observations for this visit, not measurements of the original failed workers.

The page load event occurred1.817s after navigation; editor visibly usable at2.875s. Invalid-source markers appeared546ms after paste and cleared527ms after valid paste. These half-second intervals include Monaco's diagnostic scheduling, not half-second validation computation. The format command's RPC had replied at the first10ms observation. The single-slide canvas was already ready at its9ms observation. Three recorded page long tasks were116,55 and209ms; no multi-second page task appeared. Screenshot `diagnostic-final.png` shows readable narrow Inspector source after the explicitly requested formatting; the preview resides in its separate scroller and is not visually evaluated by that screenshot.

## Comparison with the original failure stages

The evidence separates several paths:

| Path | Original evidence | Supported interpretation |
| --- | --- | --- |
| JSON service bootstrap | LF Author's `1__7ul3n2ffhd.js` response spent4814.343ms waiting and0.590ms receiving; next JSON dependency `3i1dij4r-3pfl.js` was pending at timeout. Inspector540 had4925.220ms on `14xtrtee8fs0x.js` (wait4616.677/receive308.543ms). | Worker services cannot answer until their bootstrap dependencies finish. These deadline misses have an observed delivery component; they do not prove slow validation/completion computation. |
| Initial Inspector hydration | Strict-recovery test still showed “Loading Inspector…”. The628,911-byte page chunk `3g5yp2sxazehx.js` took4902.213ms (wait196.239/receive4705.974ms), completing about40ms before the5s title-target assertion ended. | This test never reached editor/canvas initialization. It is a page delivery/readiness boundary, not demonstrated strict-overflow recovery breakage. |
| Preview/export font readiness | Font-note test had an empty canvas and “Loading slide fonts…”; another page JS chunk remained pending. Source `acquireBrowserFonts()` first imports PPTX, fetches its manifest, then loads the entire licensed font registry before creating the measurement provider. | Preview readiness is a separate dependency path. Worker bundling alone cannot establish this gate. |
| Test prerequisites | Four workflow tests stopped before schema markers appeared; new paste-format test stopped before a completed format RPC; strict-recovery stopped before the page shell was ready. | These final preservation/history/export assertions were not exercised in that production run. Their failure cannot be reported as source mismatch, but the existing acceptance gate still failed. |

Original slow JS responses were cacheHIT. The probes and later page diagnostic were fast, so persistent origin unavailability, broken worker URLs and a permanently blocked initialization are unsupported. CacheHIT does not identify the source of the earlier latency; delivery, local/network conditions, request scheduling or transient service behavior remain unresolved. No external schema-fetch explanation is supported: source sets `enableSchemaRequest:false`. The old app45 CRLF missing-popup failure remains independent history; this diagnostic did not exercise or resolve it.

## Smallest justified next correction

A narrow candidate is to serve versioned same-origin worker artifacts prepared from the installed Monaco package, reducing five/three serial bootstrap requests to one worker resource per kind. This directly targets the demonstrated initialization dependency chain without changing document operations, source values, schemas or font behavior. The installed package includes bundled `min/vs/assets/json.worker-*.js` (404061bytes) and `editor.worker-*.js` (272787bytes), but their conditional `@vscode/diff` dynamic import must be audited before treating them as fully self-contained/offline-safe. Use build-time content hashes and an explicit package-version/asset manifest rather than hard-coded package asset filenames.

This is an evidence-backed improvement candidate, not a proved fix for all eight failures. A separate review must preserve actual worker diagnostics/format/completion semantics and fresh offline behavior before changing the app. Initial Inspector page transfer and preview font readiness still require independent acceptance. Do not casually remove the font registry's PPTX preload: it currently helps ensure later export works offline. Do not change native/font compatibility claims or the0.1px tolerance.

A redundant JSON-worker warmup is not supported as the correction: the observed workers started at2.319/2.365s, before the editor became visibly usable. Merely extending marker/format/canvas timeouts would conceal the existing readiness boundaries. No such change was made. A future controlled slow-asset experiment can validate the candidate, but was deliberately outside this one-diagnostic scope.

## Handoff

`diagnostic.json` contains phase timing, pass-through worker events, safe response headers, resource timing and long tasks; `diagnostic-trace.zip` preserves the page actions. `worker-graph-and-timings.json` combines the actual worker graph with original slow/pending static-asset timing extracts. `source-evidence.json` pins the inspected source. `SHA256SUMS` pins this bundle. The approved public probes and one page visit completed; no further live work is pending in this subtask. Product correction, completion-range work, full production acceptance and native compatibility remain separately tracked by the parent.
