# App 54 first Windows CI timeout — original evidence diagnosis

Run 35638158483, attempt 1, commit `60c91f6b97c75636f533202f4112e09dc01144e4`: **30/31 browser tests passed; SVG security timed out at the unchanged overall 45,000 ms limit.** The original result remains failed. Both new share-publication cases and all 659 unit tests passed according to the retained job log. This read-only diagnosis used saved artifacts and source; no browser/CI rerun, timeout edit, product/test change or COM operation occurred.

The pending operation at the deadline was the normal Author Preview-tab click at `tests/e2e/svg-security.spec.ts:69`. The Inspector identity checks and all Inspector renderer/canvas security checks completed before the navigation to Author. The largest recorded delay was Author document/asset delivery: `page.goto('/author')` consumed 31.400 seconds at the test API level. A 1,490-byte decoded local script resource took 30.026 seconds. The afterEach diagnostic began after the timeout was recorded, so post-test collection did not originate this deadline failure. Observer/setup overhead remains real; its counterfactual effect cannot be excluded from a single instrumented run.

## Exact test chronology

Times below are original `test.trace` monotonic milliseconds. They are one trace clock, not absolute wall time. The error event has no timestamp; it appears after the Preview click starts and before After Hooks starts. No failing assertion was recorded.

| Operation | Start | End | Duration |
| --- | ---: | ---: | ---: |
| Before Hooks, including fixtures and Windows setup | 277718.805 | 278758.049 | 1039.244 ms |
| Diagnostic exposeBinding | 278390.043 | 278752.873 | 362.830 ms |
| Diagnostic addInitScript | 278753.470 | 278757.877 | 4.407 ms |
| Inspector navigation | 278763.770 | 280083.145 | 1319.375 ms |
| Shared-deck toast | 280083.935 | 283594.792 | 3510.857 ms |
| Exact one-slide count and hostile accessible title | 283595.485 | 283653.240 | both passed |
| Inspector canvas visibility | 283653.687 | 288187.483 | 4533.796 ms |
| Inspector renderer and canvas hostile checks | 288334.660 | 289050.245 | all passed |
| Author navigation | 289050.893 | 320450.745 | 31399.852 ms |
| Author Preview-tab click | 320451.540 | 325078.861 | 4627.321 ms; straddled timeout |
| After Hooks begin, after timeout error | 322775.726 | 326817.596 | 4041.870 ms |
| Diagnostic afterEach | 322775.999 | 325033.841 | 2257.842 ms |
| Diagnostic page evaluation | 323535.297 | 324482.528 | 947.231 ms |
| Diagnostic attachment | 324501.741 | 325033.641 | 531.900 ms |
| Author import input | 325111.486 | 325248.447 | after deadline |
| Final injected-flag assertion | 325737.352 | 325737.480 | after deadline, no error |
| Final empty-dialog assertion | 325737.833 | 325737.984 | after deadline, no error |

The Preview click's library trace first waits at 321048.704, resolves its locator at 324382.279, finds it visible/enabled/stable at 324454.987, and performs the click at 324502.862. Thus this was not an intercepting-overlay assertion failure: the tab had not yet resolved when the timeout launched teardown.

The original asynchronous test body continues in the trace while teardown is underway: import preview, Open presentation and final Author security checks then finish with no assertion error. This explains why the final error snapshot shows the correctly imported hostile document. Those late checks cannot be credited as a successful in-budget test. `test-timeline.json` retains every before/after call and the original timeout event; `preview-click-and-hook-events.json` retains exact lower-level navigation/click/diagnostic events.

## What the Windows timing hook proves

`readiness-diagnostics.ts:68–121` installs the binding, bounded PerformanceObservers and a fire-and-forget pagehide flush; `:124–151` collects and writes the after-test result. The saved record explicitly says `outcomeBeforeCollection: "timedOut"`, no diagnostic errors, no dropped documents or entries, and one Author document with 96 entries at `performance.now() = 35349 ms`.

The Inspector snapshot and pagehide flush are absent (`missingInspectorPagehideFlush: true`). This is a known observational limitation of the fire-and-forget unload binding, not proof that the handler did not run or that it caused the delay. The record does not recover the Inspector navigation's observer costs. The after-hook overlaps the still-pending Preview action, but begins only after the timeout result exists. Do not reclassify this as an after-hook timeout or as a passing security test with a failed attachment.

## Author resource facts, without an inferred infrastructure cause

Author navigation timing reports response start at 23.2 ms, response end at 9985.5 ms, DOMContentLoaded at 9991.5–9991.7 ms and load at 30208.8 ms. Its trace network response is HTTP 200, gzip, `x-nextjs-cache: HIT`, with 19.968 ms wait and 9963.234 ms receive. `goto` was waiting for the `load` event; no schema assertion was pending at that call.

`http://127.0.0.1:4325/_next/static/chunks/1n-j6a4lqrto8.js` has public resource timing:

- start/fetch: 178.2 ms; DNS start: 14765.9 ms; connection complete: 14767.0 ms;
- request start: 14767.1 ms; response start: 30203.5 ms; response end: 30204.2 ms;
- duration: 30026.0 ms; 750 encoded bytes / 1490 decoded bytes; transferSize 1050;
- HTTP 200; `Cache-Control: public, max-age=31536000, immutable`; `Content-Encoding: gzip`.

This records roughly 14.588 seconds between resource fetch start and DNS start, then 15.436 seconds from request start to first response byte. It is a localhost delivery/scheduling stall observation, not proof of external-network slowness, antivirus, Next.js computation, Edge behavior or the diagnostic observers. The body of this particular chunk is not retained in the trace, and the local macOS build does not have that filename, so its code ownership is not inferred. The raw network HAR's `ssl` timing is anomalous for this HTTP URL; this report uses the public ResourceTiming phases instead of calling that TLS work.

Only three Author longtasks are recorded (627, 420 and 194 ms), beginning after 32.191 seconds. They do not explain the earlier 30-second asset phase, and do not identify a responsible function. Other later chunks took up to 1.971 seconds; fonts completed later, with the slowest shown roughly 0.327 seconds. These observations do not establish the cause of the stall.

The trace has 180 response records with status 200 and one worker request with status -1 (no completed HTTP response); no HTTP >=400 response appears. The incomplete worker record is preserved separately and is not relabeled an HTTP error. ResourceTiming is a completed-request view. Trace HAR and browser performance clocks are retained separately; no unsupported cross-clock subtraction is used.

## Evidence and decision boundary

Original trace SHA256: `cb6c6df103e390bb5c9511aba9b4a9cd9c3ff7b59872f6ff1646e12779b2134b`. Full ZIP CRC check passes. Artifact 10657118561 matches its GitHub digest, as does timing artifact 10657168358; the registry agent's original receipt stays under `../opf-inspector-share-guard-20260921/ci/artifact-download-checks.json`. This folder hashes the raw trace, job log, original error context, timing files, source files and copied diagnostics in `identities.json` and `SHA256SUMS.json`. The original timing JSON is copied unchanged. Windows trace source has CRLF line endings; after CRLF-to-LF comparison only, both embedded test/helper sources match the reviewed source. Both raw source hashes are retained, without normalizing the source files.

The security assertions must stay intact. This record does not show a new Inspector publication regression, an XSS failure, a failed hostile-content assertion or a hook-origin timeout. It shows exhausted end-to-end time while waiting for Author UI after slow localhost delivery. It does not justify raising the deadline, deleting diagnostics or marking Windows acceptance green. A follow-up can investigate the server/transport scheduling boundary or test lifecycle separately; any implementation or further probe requires the parent's distinct review. Original failed acceptance and the missing pagehide evidence remain explicit.
