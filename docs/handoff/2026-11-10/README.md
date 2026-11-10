# OPF current handoff — November 10

**v0.33.0 is published. v0.34.0 is unpublished.** The original31 checkbox lines in [issue1139](https://github.com/OpenPresentation/opf/issues/1139) remain intact:21checked/10open. The current-state table below supersedes historical descriptions inside those preserved lines. Every original item remains in scope. [Previous detailed checkpoint](../2026-11-09/coordination-checkpoint.md) and [binding working rules](../2026-11-07/working-rules.md) remain available.

## Source and release state

Reviewed product staging runtime is d2edd18ced67ea8370ae2d03f5f954d91ff9cb6e, on codex/integration-034-native-staging-20261109 (prior metadata96578afd8e6db5ff080acc7fcfe160e8ce8fd6f8). Canonical PR1225/codex/integration-034 still names e5de880999235872f4c44fe646e78fec49c16baa. All17original wave2 heads and prior reviewed feature/fix folds remain included in working staging. Recent reviewed folds cover chart conformance, RR117, validation reports, native font compatibility and fresh-main MCP UI/Export plus guarded host downloads. Maina52dc944/CI42719469318 completedSUCCESS. One coherent final source/CI/native/golden gate is still owed.

Never push a folded leaf. Never force-push. Normally merge origin/main. Evidence-only branches NEVER MERGE. Use maintained pr-gate only; no new CI polling loops.

## Current unified task list

| Original open item | Current truth and next action |
| --- | --- |
|B05 final integration|Working staging exists; canonical1225 has not been updated to the fully repaired union. Resolve remaining fixes/decisions and preserve all old REDs before final assembly.|
|B07 native glyphs|05/06/09/10 remainOPEN. A/B/C primary-proofing inheritance variants are now KNOWN REJECTED, not unknown. fb37046f contains452records/9identicalPNG/27LanguageID1025 observations. New read-only direction source2b825 is peer-reviewed; preparation adapter/mapped checks underway. No new Office run or glyph acceptance.|
|B17 all033sites|Org033 and Gallery033 production accepted. New owner-requested recoveryP0 is PR214/current19f3, pending its own fresh CI/preview/production. DEV033 remains held by the exact secret transfer; do not claim all033sites complete.|
|B20 exact credential transfer|Automatic approval review still holds development Convex striped-fox-33 CONVEX_SERVICE_SECRET and AI_GATEWAY_API_KEY to Data-Advantage/pptx-dev environmentpreview. No values read/copied/workaround. CLERK_SECRET_KEY exists; build CONVEX_DEPLOY_KEY is not runtime.|
|B24 final images/goldens|ONE final pinned workflow refresh after final source, plus every moved core/template/example/sheet and causal current PPTX archive/XML review. No local hash edits/tolerance changes.|
|B25 trackers/bundles|Revalidate final catalog-free/browser/MCP bundles and generated gallery/font trackers; earlier passes do not qualify later heads. No page exclusions/budget weakening.|
|B26 combined gate|Changed/default-main/FullCI/Slow/native plus Windows/macOS/Node22/26/packed/registry/npm12 through maintained workflows on exact heads. Genuine current59+newrefs/table/histogram/seven/SH21liveSmartArt/E1/E3 remain owed.|
|B27 release034|Accepted main, exact-head managed merge, own mainverify/audit, Release dryrun then real trusted tag publish; all7registry identities/integrities/provenance/changelogs/release/.mcpb/checksum. No laptop publish.|
|B28 all034delivery|Actual registry bumps and all3site assets/docs/examples/gallery/MCP/E3, Linux/build/NativePreview/auth/service/public/production acceptance. G2orgPR216 and H3galleryPR180 source-reviewed/frozen but future adoption is owed. No third release assumed.|
|B31 owner remainders|Chart representation approval WAS RECEIVED. Deploy/Preview authorization WAS RECEIVED later and overrides the old deploy reservation. Exact held credential transfer, D2, LibreOffice promotion, Claude connector/local.mcpb removal, new logins/DNS/account-plan/repository-visibility changes remain owner-only.|

## Owner cold-start question: checked with reproducible results

Original whole131 versus demand3 measurement:36-slide preparation+firstSVG3487→3960ms (~13.6%slower). [Diagnostic697100785](https://github.com/OpenPresentation/opf/blob/697100785cc10bb21d03dce13907a926baf64935/docs/handoff/2026-11-09/rr114-cold-start-diagnostic/RESULTS.md) establishes two full recording/composition contexts; reads/hashing were about3ms. The current smaller-font loader remains staged for its large memory/warm-render benefits. This does not excuse or hide the cold tradeoff.

Root completed two fresh explicitly quiet paired screenings, both in3-face mode, with fixed16/36 inputs, mirrored8children/60s caps and624exactSVG comparisons each. No in-run retries or source/deadline changes. Root independently replayed both packets:

- [First replay6da89c4a](https://github.com/OpenPresentation/opf/blob/6da89c4a69d9374f68c12f6cdb73c44a9fc645b4/docs/handoff/2026-11-09/rr114-replay-performance/RESULTS.md):86records/1592558rawB, no latency gain (16about4.4%slower;36flat). Earlier formal01 collector failure is preserved; corrected WASM discovery never changes product behavior.
- [Validation-only revisiond2c2bbd4](https://github.com/OpenPresentation/opf/blob/d2c2bbd41d92e647c7f1bf48103ab0f66153e734/docs/handoff/2026-11-09/rr114-replay-validation-performance/RESULTS.md):38records/989987rawB, currentDriverMatches=true. Actual root97110exit0.36startup3743.9→3626.6ms (3.13%faster);16startup2044.6→2064.1ms (0.95%slower). Warm36 is slightly slower; post-GC JS heap remains about54/56MiB. No universal startup/RSS/mobile benefit or elimination of the earlier tradeoff is established.

Fast sourcebcc7d76d7eeeca8cd6102ef6a54a27fd9d4cce38/runtime23e579ac18d6a12506eefde0a5caa7cf0c50a4dd at C:/opf-work/replay-fast passes33focused/14demand-fault/7nativeXML/lazy558/incremental-cache/337syntax checks and normal builds; root27record replayPASS. Root+A source review confirms only discarded validation serialization is removed, preserving full snapshots/guards/caps. Source3360 and bcc are FROZEN/UNFOLDED.

Vetoable decision: keep this replay work unmerged while reviewing limited gains, warm/16 regressions and larger/cap-refusal behavior. Do not claim counts alone prove speed. A now runs a separately labelled NON-TIMED two-child diagnostic of FULL snapshot-key repeat rates by selection/measure/probe; no validation is skipped and its durations/RSS are not performance evidence. Any next value-comparison lookup must check current values/descriptors; object identity alone is insufficient. Lead separately reviews reference native controller source. Old sealed performance folders remain byte-exact.

Root stopped one confirmed read-only Nov6 normalizer with an unbounded equal-string comparison (exactPID/command/parent/source proved); before/after records are in6da. No Office or other process was targeted. Historical absolute time/RSS is not directly comparable with the new retained-three-output workload/background conditions.

## Recovery P0: sole exact-head observer

PR214 is PUSHED/FROZEN19f3d1dbdc81f3c0a72b890c17a32ad0701c2de8/tree08c189e70ad3a5de9b9c623a3fb92c088efd3826. Normal merge d172 has parents6fa plus exact main1c6bc45b (externalMCP/privacyPR215), preserving all64recovery/evidence blobs and all5incomingmain blobs. Ordinary build,304tests+5font checks and typesPASS; root25record/5524183B alignment replayPASS. Pins/runtime remain033.

**Sole live CI observer: root77144**, exact19f3, scripts/pr-gate.mjs --required all --interval180. Logs C:/opf-work/site214-gate06.log and eventual-exit JSON. Prior6fa observer71287 actually exited0 at01:08:14UTC; it is NOT live. Historical6fa small receipt13724921981 and qualification13724678984 verify source/tree/build/inventory16518; no360MBbundle download. New19f3 needs its OWN NativePreview receipt/deployed recovery+MCP/privacy checks before exact-head managed merge and actual production verification. Old421/6fa29deployedflows/4root captures stay valid history, not new-head acceptance.

## Native source lanes and exact environment recovery

Reference witnesses: frozen790b23d3/PR1257,18focused/55managedfaults,293record rootreplay. Root read worker/wrapper/generator; lead now independently reviews archive/profile/import/ownership/title/frame/current-consumer/default-deny gates. Actual current-consumer generation/exported counts/native/import acceptance is UNRUN. Do not touch original59/fd13/2400/ce92/four-WHOLE producers.

B07: worker2b825aa72e16dfa6593a8171011f7fcb6138255b, workerSHA51cb21003f058bd401669458e6f0afdd0acd899fdd54c4ee529595a32f5e65b9; ce92controller; original09SHA4b9d084f5ddccd23f553cc0a030ad8a43bca6e120de89d13cfca34b4163f06e2. Root42record/378097Breplay and A source/XML reviewPASS.30managed+7input controls,41protectedfunctions/4supportfiles exact. Directions2/1/1 are context, not native observations. Source-only preparation adapterc5637924 has15pure controls; no real suite, ValidateOnly or Office yet.

Exact2b825 stock mapped check originally RED only for sparse evidence prerequisites; build/Biome/changes/release-report/skill-commands/stabilityPASS, TSskip/no package tests. ExactHEAD restoration made textPASS. Gallery needs the complete tracked native JSON/MD closure (~1805files/44.6MB), now explicitly authorized with exact blobs/path checks; no PNG/archive hydration or generated substitutes. Raw/no-filter Git hashing is required for historicalCRLF blobs; preserve the first verifier setupRED. Rerun ONLY failed gallery after verification. Adapter's own normal mapped gate is authorized. Root must review source/checks/adapter before real suite preparation; Office remains root-only with fresh global zero, exact bindings, supervised readonly/owned lifecycle and no cleanup on failure.

Source-only future memory opportunity: the process-shared HarfBuzz cache retains distinct content handles, with no eviction/release path; same-content reuse already works. The pinned catalog is finite, diverse caller fonts broaden retention. No measured leak/RSS attribution or cache change is claimed. Any bounded-cache proposal needs actual ownership/destruction/failure controls and measurements; freeing WASM allocations does not shrink the arena.

## Resume ownership

Root coordinates current19f3gate/deployed acceptance, source decisions/folds, original native/golden/coherent release gates and this checklist. Lead reviews reference profile; A counts capture-repeat opportunities; B completes preparation adapter and exact-source mapped evidence. Do not launch another performance trial, Office attempt, golden refresh, release or merge without its concrete source-bound prerequisites. Continue independent authorized work; no goal completion/pause/block is declared here.
