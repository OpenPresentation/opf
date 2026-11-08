# F1/F3 source currency and Pareto reporting

This isolated source PR starts from fresh main and normally merges approved integration c38560d08a330b276e0631eb7451d039c06be723 (merge ad7e5cb4e99ca7282d859c821b469a15b714a71a). Both approved handoff and RR histories are preserved. The coordinator owns integration, publication and owner rollout. E1 after02 and its first-60-sheet review remain immutable.

## Source scope

Actual source has 147 bundled JSON examples (101 gallery, 46 technical), 40 default layout records and 53 sampler slides (40 layouts plus 13 dynamic compositions). The two Markdown decks and quickstart fixture are outside the JSON catalog. Source inventory, llms index, editor and layout-skill wording now agree. Existing sampler-refresh controls prove authored identities/order retention, complete coverage and idempotence; no sampler input or generated image changes here.

Current installation prose derives the six-package consumer set from the registry and retains exact installed versions with --save-exact and package-lock.json. The optional seventh MCP package follows the same release. Dated actual 0.33 verification remains historical evidence. The actual release.mjs planPrepare updates package versions, peer hints, changelogs and drawing declarations; it has no current-document pin updater. No manifest, tag or registry version is manually changed to 0.34 by this PR.

The compatibility table distinguishes current source from publication and covers shapes/connectors, all three diagram syntax values, qualified SmartArt/fallbacks, linked video limits and experimental LibreOffice. MCP core docs distinguish the connection target from the deployed server/tool/viewer version, packaged stdio viewer and owner-controlled hosted rollout. Versioned .mcpb download instructions require the matching release to list both bundle and checksum; 0.33 has no published bundle asset. Sites delivery reports PR202's genuine-0.33 hosted viewer is locally qualified but not owner-merged/deployed; this PR makes no current-production version claim.

## Verified meaning of “pele”

Pele is the real shared layout/drawing dependency, pinned as pele@1.13.0 in packages/javascript/package.json. Eager/lazy diagram-engine import maps load it; the PPTX adapter consumes its laid-out node/edge/label geometry. OPF supplies the DOT and PlantUML subset readers and adapts them to Pele; external Graphviz/PlantUML renderer executables are not run. Mermaid's supported families, source syntax and native shape/picture eligibility remain separate contracts.

The audit searched the unified checklist, source, docs and issue-tagged local history: Mermaid integration #1019 (6e17c400f), SH-12 DOT (1ccd25745) and SH-13 PlantUML (5ceddef76) establish the interpretation. This is not a new independent presentation format, compatibility engine or release item inferred from the owner's spelling. No parser family, native eligibility or diagram output changes here.

## Narrow Pareto report fix

Immutable E1 batch-02/s36 explicitly contains Current and Baseline numeric series. Its genuine 0.33 after panel preserves both as clustered columns without a cumulative curve. This is the existing unsupported multi-series Pareto representation, not permission to discard a series. The source chartDrawPlan already preserves both series, all categories and data order; chartDrawDiagnostics returned no report whenever no series was dropped, explaining the empty E1 findings.

Validation now reports the existing opf/chart-mapping-adapted warning at chart/type for exactly this fallback, explaining that one numeric series is required for the sorted/cumulative Pareto representation. Single-series Pareto, an ordinary multi-series column and existing dropped-note warnings remain distinct. No new rule identifier, data rewrite, chart geometry, catalog/example input, renderer or PPTX drawing path changes. The before-failing public-validation control and actual unchanged 50-slide E1 CLI input are retained alongside the after report and exact data/drawing-plan identity proof.

## Vetoable decisions / progress log

- 2026-11-08, F1/F3-1: Make current install guidance version-free while preserving reproducibility through exact installed manifests/lockfile and actual registry receipts. Keep historical version observations unchanged. Do not advertise future 0.34 publication from a source build.
- 2026-11-08, F1/F3-2: Record 147/40/53 as source facts, with installed-release counts separate. Dynamic documentation controls catch later additions instead of silently inheriting stale numbers.
- 2026-11-08, F1/F3-3: Interpret “pele” from the actual dependency/code/history, and document its shared engine role without implying external Graphviz/PlantUML pixel parity.
- 2026-11-08, F1/F3-4: Add only the missing multi-series Pareto report through the existing adaptation rule. Preserve every series and drawing; do not turn the known native representation boundary into a new renderer feature.
- 2026-11-08, F1/F3-5: Treat packaged MCP, hosted server, hosted viewer and downloadable bundle assets as separate observed states. Keep owner-only connector/extension/deploy/login work reserved.

## Validation and remaining coverage

Initial focused controls fail on the missing public warning (0 found, 1 expected). After the fix, all 19 affected diagnostic/data/source-doc/sampler controls pass. Required changed-scope checks, final actual CLI proof and their first outcomes are recorded in f1-f3-currency/. Exact final status follows in its receipt; no failed assertion or fixture is weakened.

This PR does not complete final 0.34 release acceptance. Combined source/full CI, pinned golden review, final strict generated trackers and budgets, final native/source comparison acceptance, remaining E1 sheets, E2/E3 artifacts, real seven-package publication/registry verification and all three sites' verified preview/owner rollout remain coordinator-owned. Hosted connector setup, local extension removal, D2 and LibreOffice promotion remain owner-only. No Office, deploy, DNS change, login, force-push or golden regeneration occurs in this lane.

Final local validation: the single required 200.6-second mapped run passes 11/15 steps, including typecheck, stability, diagram-doc images, browser safety and all skill checks. Its full core run is 4,147/4,150: the intended new warning invalidated one old zero-warning fixture assertion (now replaced with six exact verified source/path expectations), sparse width fixtures were absent (now restored), and the inherited section golden awaits the coordinator’s pinned batch. All 153 affected final controls pass. Exact 1,842-file Git hydration fixes text and width environment failures; text passes 6/6 and 9,537 files. Tracker is now 17/18 with strict generated freshness still failing. Composition gzip remains 271,942 over unchanged 267,675; no budget/golden/tracker is edited. [Receipt](f1-f3-currency/receipt.json) preserves every first failure and compressed original mapped log. The final actual CLI report retains all 30 earlier findings plus exactly three honest Pareto adaptations, including s36; input bytes, data and drawing-plan bytes are unchanged. Later metadata-only checks are recorded separately.

Final F3 boundary matrix: [six cases across all five existing shared draw-plan adaptations](f1-f3-currency/adaptation-report-matrix.json) verifies actual drawn types, numeric observations, category/group transformations and public diagnostics. Multi-series pie/doughnut preserves both series as concentric rings without a dedicated type warning; map-to-columns and per-series boxes likewise have no dedicated adaptation warning. Scatter’s omitted unusable X column has chart-series-dropped; the new Pareto warning remains the only added runtime report. The public chart-options table now states these exact boundaries. No missing algorithm, universal warning promise or native-parity claim is invented.

Final metadata-only reruns pass Biome, skill commands, shared glossary and text (6 tests /9,565 files); all15 existing/new adaptation controls pass after the five-family matrix. Only the coordinator’s combined strict tracker, golden and bundle-budget gates remain red in this source proposal. Actual future publication, native acceptance and public rollout retain their separate receipts.
