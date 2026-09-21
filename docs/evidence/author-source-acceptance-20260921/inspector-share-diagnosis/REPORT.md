# Postmerge Linux SVG security failure: readiness and wrong share hash

2026-09-21; read-only retained-artifact/source analysis. Accepted source `/Users/michael/Source/pptx-dev` HEAD `e40c287b64fcbcfb85fb4a8a50641aea8e3e54a8`. No product/test edit, browser run, network probe or retry. The original Linux result remains **28/29**, with the security case failing before its hostile-content checks.

## Conclusions

1. **The immediate failure is an incorrect readiness assertion.** `svg-security.spec.ts:60` invokes strict `toBeVisible()` on all canvas overlays before waiting for the single fixture slide. It sees the five starter overlays (`cover`, `problem`, `solution`, `traction`, `ask`) and fails in496ms, not at the5s timeout. Its helper already has a count wait atline34, but that helper has not been entered. The successful loaded toast only proves URL hydration set the source, not that deferred preview/render/font work has completed.
2. **A separate product defect is proven by the same trace:** the page URL changes from the one-slide hostile document to the complete five-slide Northstar starter while the editor shows the hostile source. Decoding the retained URLs proves the wrong published hash semantically equals `lib/samples/opf/pitch.json`. This is not merely a locator problem. Correcting readiness alone would leave this defect untested.
3. The trace does **not** prove script execution, an unsafe link, permanent preview failure, or indefinitely persistent hash corruption. Those security assertions and the Author import phase were never reached. No claim of security acceptance can be made from this failed case.

## Temporal proof

Times below use the retained trace's monotonic millisecond clock. `trace-facts.json` contains exact snapshot URLs, decoded payload hashes, action timings and source hashes. `analyze-trace.py` reproduces extraction from the immutable original ZIP.

| Observation | Time | Meaning |
| --- | ---: | --- |
| Navigation starts / completes | 189579.030 /189763.237 | Test navigates to hostile one-slide `#opf=` URL |
| Navigation after-snapshot | 189762.971 | URL decodes to “Untrusted shared document”,1slide |
| Toast visibility browser assertion succeeds | 191660.442 | Loaded source notification is present |
| Toast after-snapshot | 191840.070 | URL now decodes to “Northstar Seed Pitch”,5slides |
| Overlay visibility starts | 191864.331 | No fixture count/title precondition precedes this |
| Overlay before-snapshot | 191972.718 | URL still holds the five-slide starter |
| Overlay after-snapshot | 192351.306 | URL still holds starter; wrong hash observed over at least511.236ms |
| Strict assertion returns failure | 192360.460 | Five starter overlays caused strict violation |

The later error-context accessibility snapshot shows the hostile document metadata, a one-slide preview and “Loading slide fonts…”. Thus the deferred preview had progressed by error-context capture; failure was not evidence that five starter previews persisted forever. The two retained screencast frames were visually reviewed: the editor already contains hostile JSON while sidebar/title/preview still refer to the starter. The address bar is absent from these screenshots; the wrong URL proof comes from the trace snapshot `frameUrl`, not image interpretation.

`test.trace` has no subsequent test action or successful security assertion. The Linux passive Windows diagnostic is disabled by `process.platform`, so its observer/helper cannot explain this Linux timing. All77 retained completed network entries haveHTTP200; longest retained request duration298.725ms. This does not describe requests absent from the retained trace or identify CPU/scheduler causality.

## Lifecycle and inferred scheduling mechanism

Precise frozen-source references:

- `components/playground/playground-shell.tsx:128–143`: initializes starter source and maintains synchronous authoritative `sourceRef` in both text/format setters.
- `:178–179`: `parseState` uses `useDeferredValue(opfText)`.
- `:239–253`: a URL load records a revision, sets loading true, hydrates source, then clears loading in the promise's finally callback.
- `:1768–1780`: successful hydration decodes the handoff, sets JSON format, replaces source and sets the success toast. It does not await preview rendering or font readiness.
- `:267–293`: a separate effect updates preview state from the deferred parsed document. `preview-pane.tsx` maps that state's slide list; canvas and renderer subsequently acquire fonts asynchronously in `preview-canvas-slide.tsx` and `slide-canvas.tsx`.
- `:295–319` (`HASH_DEBOUNCE_MS=500` atline72): hash sync captures the **deferred** parsed document, load revision and current URL. After async encoding it checks cancellation, loading, revision and URL equality, then calls `history.replaceState`. It does **not** bind publication to the current authoritative source text/format. The effect depends only on deferred text, not format.

The evidence-backed scheduling explanation is that a queued starter-document encoder can complete after hydration has updated `sourceRef` and cleared `urlLoadingRef`, but before the deferred effect's cancellation/replacement has invalidated that encoder. Its captured revision and source URL can still match, so current guards permit a stale document hash. This is an **inference from source plus the proven publication**, not an instrumented execution trace of each React effect, timer or promise continuation. The original trace has no replaceState stack or internal scheduler events.

There were no Share clicks, source edits or other user actions between navigation and failure. The observed address change is consistent with the automatic sync path. Do not assign network slowness, font loading or any particular task queue as its measured cause.

## Persistence and refresh consequences

The wrong URL is directly observed for at least511.236ms and is still wrong at the last retained frame snapshot. Whether a later correct deferred encoding would repair it before the context closed is **not observed**. The code can schedule a correction once the correct deferred source effect runs; its success is best-effort and is guarded/async. Permanent persistence is therefore unproven.

A refresh or copied address **during the observed wrong-hash interval** carries the starter document, not the loaded hostile document. `lib/playground/opf-handoff.ts:23–28` reads the `opf` fragment and decodes it; `playground-shell.tsx:1768–1773` replaces source with that decoded document. There is no Inspector local-storage recovery path in this component. The decoded wrong payload is retained and exactly matches the starter. Consequently a refresh at that address would load the starter and fail to reimport the previously loaded content. This consequence follows directly from retained bytes and the public source path; **no refresh/browser reproduction was run**. The in-memory hostile source itself was not shown to be overwritten during this trace.

## Existing coverage and narrow proposed correction

`lib/playground/__tests__/opf-handoff.test.ts` has three codec/contract tests: hash round trip, `import=hash:` round trip and absent payload. Source search found no unit test of the debounce/effect publication lifecycle. Existing Inspector recovery/editing browser tests navigate or replace hashes but do not assert that every automatic published hash matches the authoritative current document.

Keep two corrections distinct:

- **Readiness:** before strict canvas visibility, wait for exactly one canvas and its exact hostile fixture accessible title. Apply the same fixture-identity precondition to the renderer surface before security inspection. Retain existing5s budgets, all hostile-node/attribute/link assertions, actual visible input click, inert fallback check, injected-flag check and dialog assertion. Do not use `.first()` to bypass multiple starter slides, add sleeps/retries, or infer readiness from the toast. The fixture can still legitimately wait for fonts after document identity is established.
- **Product publication guard:** bind each automatic encode/publish job to its exact authoritative source text and format (or a monotonic source generation), and recheck after the await alongside the existing URL-load revision/URL/cancellation guards. Avoid serializing a stale deferred preview snapshot as the canonical address; use current source semantics for sharing while preview may remain deferred. Include format in the scheduling boundary. This is a small separate product fix, not justification to weaken the security gate.

Meaningful deterministic tests should hold an old encode promise, replace/hydrate current source and clear loading, then resolve the old job: it must not publish. Also cover a source edit during encoding, format change, new hash navigation and the successful current job. A browser regression can passively observe public history.replaceState and decode published URLs, asserting that starter is never published after a fixture handoff, then verify reimport/refresh of the accepted URL. Such a test should retain the original security assertions and not replay the old job via private framework state.

## Evidence integrity

Original trace SHA256 `723ab2961fb86a75bbc323dbf392e7477861987060bc9bcbf4904a6c3e940bb4`; error-context SHA256 `d1f651ce07ec80744d59a9ec79313bf7928df88dcb56d84e5b9bcdf559bb4032`. Their original paths are recorded in `trace-facts.json`; the large ZIP remains there. This folder retains compact decoded payloads, two original screenshot frames, the extraction script, facts, report and checksums. No full raw DOM was copied into a product repository.
