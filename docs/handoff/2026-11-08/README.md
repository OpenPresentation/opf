# Release continuation: 2026-11-08

This is the current handoff for the two-release goal: v0.33.0, then v0.34.0. [Unified checklist and team](https://github.com/OpenPresentation/opf/issues/1139). The [2026-11-07 working rules](../2026-11-07/working-rules.md) remain binding; this file supersedes their historical status snapshots, not their safety rules.

## Current release gate

v0.33.0 is PUBLISHED AND VERIFIED. Real Release42465429345 completed SUCCESS, including all slow gates, commit/tag, trusted publish follow and all three site-bump jobs. Release commit26fd4de9cee7e57f9e0620eddcad2dcef04e00e3; public GitHub release published2026-11-08T09:56:21Z. Independent fresh registry check at10:00:03UTC confirms all seven latest versions0.33.0, exact gitHead, integrity and provenance metadata. Final maintained publish observer91249 exited0; no release watcher remains. Source033 is frozen. Genuine site/consumer updates are now active; owner-only deployment stays reserved. Parent native qualification hold is lifted with fresh process preflight and owned pinned-font setup.

034 current pushed assembly f1bf4067b26df701a4138092604cbba6c23bb252 includes reviewed SH21 foundation (Venn5–7 design hold), RR10831-value pinned SVG migration and maintained nine-archive review tooling. SH25df24 source is independently reviewed but native160points remain unqualified. Derived Venn readability513d has genuine before/after panels; actual Office pending. LH16RTL date order, core22+negative3 native inputs, final pinned goldens/21+9archive promotion/strict trackers/budgets/combinedCI remain open. Earlier snapshots below preserve chronology.

## v0.33 reapplication

PR #1133 passed exact-head normal/full CI and final Windows PowerPoint qualification, then squash-merged as `7c0c3f13e9de77e038b6ec26183043eb7fe90822`. Main failed strict gallery-tracker freshness: generated metadata counted 103 RR items instead of 105. The automatic Tracker refresh succeeded but could not open its PR. The queued release dry run was cancelled; no tag, npm publication or site deployment happened.

Per the red-main rule, #1161 restored the exact previous-main tree. Its actual squash commit is `502eb42d730edec4cc926c84d7bbaccaaba48a4c`. This new branch starts from that fresh main, reverses that exact revert, and carries the original generated refresh `90f645535c02d2aab2373503ca220faf2ad5f287`. The refresh changes only the JSON item count and Markdown link count. All original feature/source branches are permanently folded and must never be pushed again.

Vetoable implementation decisions:

- Restore the already-reviewed v0.33 product source without adding v0.34 work. Fix the generated metadata by folding the exact bot output; keep strict freshness and every assertion unchanged.
- Reuse accepted source/native evidence only where canonical product/schema/font/golden trees and exact input hashes match. A real output change requires targeted requalification; documentation or tracker-only changes do not justify repeating an unchanged corpus.
- Keep the current qualification host profile unchanged until v0.33 is published. The sealed seven-face Roboto setup for v0.34 is deferred and must use the maintained owned setup/check/cleanup helper.

[Strict tracker proof and release checklist](https://github.com/OpenPresentation/opf/tree/codex/rr-033-tracker-proof/docs/handoff/2026-11-08/tracker-033-proof): gallery 17/18 before, 18/18 after the exact refresh; font freshness passes, warning override unset. Release-prepare dry preflight passes 0.33.0 from 0.32.1, minimum minor, latest, with normal stability enabled and zero undeclared gallery changes. The top-level Release workflow dry run and slow gate are still mandatory.

[Accepted native evidence](https://github.com/OpenPresentation/opf/tree/codex/rr105-final-evidence/docs/programs/release-readiness/rr-105-com/final-033-2026-11-07): 25 files / 270 slides, 25 PowerPoint-saved imports, no shrink autofit. Explicit stacked-shape aggregate-bound false positives, opt-in v0.34 body/title findings, ChartEx automatic-margin limits and UI-only checks not run remain visible. No exact font-parity claim is added.

Next: independent reapplication review; one push and normal/full CI batch; maintained `pr-gate.mjs --expect-head <full sha> --required all`; squash merge; main's own verify/audit on its actual SHA; top-level Release workflow dry-run with skip-gate=false, then the real Release. Verify all seven registry/provenance/changelog receipts and GitHub release before genuine site bumps. The site step is advisory in the release workflow, so inspect all three outcomes explicitly.

## v0.34 and parallel work

Preparation is pushed on `codex/integration-034` at `64725585d39fd5371afef05982959f5e340fa02f`; it will merge the actual v0.33 release/main again before final integration. It contains the reviewed 17-PR wave-2 assembly plus language, localized status, font emphasis, native titles, added SmartArt nodes, inverted pyramids, optioned doughnut holes, MCP release bundle, pinned template-golden workflow, read-only native worker and ZIP evidence checker. Their folded source branches remain frozen. No v0.34 integration PR or golden batch is open yet.

The owner spot check at 07:18 UTC found 16 reviewed integration items over the preceding four hours (5 capabilities, 6 user-facing fixes, 5 delivery/test improvements), with zero published releases. The coordinator acknowledged the strict-tracker preflight miss and prioritized v0.33 recovery/publication. Agents continue bounded LH73/LH75/LH110 fixes, the concrete LH34 native saved-import correction and site security/readiness. SH20/21 and SH25/RTL exploratory native runs are paused; sealed packets and all failing evidence remain pushed, and no new live SmartArt domain is enabled.

Every new feature still needs its final source/sheet/native acceptance, assembled strict checks and pinned golden review. Corrected CLI qualification preserves the earlier incorrectly measured API input batches as failures. LH16 native text editing retains its duration; LH34 actual saved editing exposed a blank panel-paragraph guard defect with a narrow isolated correction in progress. These are not silently counted as released.

## Owner-only

D2; LibreOffice promotion; adding the hosted connector in Claude; uninstalling the local .mcpb; any deploy, DNS change or login. Prepare concrete verified PRs before requesting these actions, and continue independent authorized work. Site main merges can deploy and remain reserved for the owner step.

Never force-push, push folded source branches, merge evidence-only branches, rewrite raster goldens locally, terminate Office, attach to the owner's Office instance, or introduce a new CI polling loop.

Core documentation continuation: [RR-20 / inventory F2 corrections and complete remaining F1/F3/E1-E3 checklist](core-f2-docs.md). This narrow source does not change pins, counts, layouts or native eligibility; release/registry/site gates remain owed.

V0.34 reviewed folds on 2026-11-08: F2 core documentation PR1168 at4a82f93f695dcda2545e5ec9a0a2d74410ecaeba, plus original image-callout PR1155 and corrective PR1165 at8a03dfe1f4fa8d60a9869e2553bf023849e36aaf. Independent review closes the blank-body/paint-only import finding: successful restoration always reports unprovable paint/format reflow, while exact geometry/ownership refusals remain. All three source branches are frozen. Parent inspected all six clean-CLI/native callout pairs and actual edit/save-copy/reopen evidence; final pinned-font profile review and integrated CI/goldens remain owed. Merge conflicts retain both F2 video wording and image callouts, both inverted-pyramid and callout guidance, current completed LH33/LH35 rows and both progress histories.

LH93 PR1160 at49edd06819280c6f03c5a442aaa1d4599c373b0d is independently code-reviewed, all seven clean-CLI/native pages parent-reviewed, and folded as c5df81cd1e7e78ec928b8f0828f71a5aaf624acb. The source is frozen. Intended shared stacked/percentage plots and legend/axis restoration are accepted; inherited negative-axis category labels at zero instead of the preview left edge are a confirmed034 bug assigned to a new derived PR. Explicit-options chart automatic inner margins are byte-identical to baseline and remain a documented limitation. [Integrated build and twelve focused controls](integration-fold-checks/receipt.json) pass. No final release/native parity claim follows from these scoped checks.

LH73PR1164 at39b243e7858c13e2505b032bebdada9b55689ede and LH75PR1167 atafd1f881d145d89d77e55fdb7b6ac4806085ca74 are folded after independent code/sheet review plus parent review of all2unequal-note and13table-growth before/after/Claude panels. Notes retain28px in LH73; LH75 notes grow28 to32px with about15%larger cells and bounded three-line/75% growth only after valid initial placement. Sources are permanently frozen. Fifteen clean CLI native witnesses are sealed but actual Office acceptance remains owed after033 publication; final integrated CI/goldens/trackers remain open.

LH110PR1169 at aee237aaad5740afb731d88cc44b6c1160947a65 is folded after independent source/two-sheet review and17focused parser/period controls. The source is permanently frozen; six localized92%references/2023bands change, English/ordinary cases remain exact. Seven clean CLI native files remain owed. LH73/LH75 joint integrated build and23controls pass; raw receipts accompany the next checkpoint.

Focused integrated metadata checks now pass: text, fragments, release-report integrity and skill commands. The initial text run missed a sparse gzip fixture after the normal main merge; its failed log and exact restored Git-blob/hash receipt are preserved beside the final passes. [Receipt](integration-fold-checks/focused-metadata-receipt.json). No new source assertion or budget/golden threshold changed.

Negative-category correction PR1171 at8dc8185efa003f64b23e1d015a9d6d2e15e1f297 is parent source/two-sheet reviewed and folded; source permanently frozen. Only negative horizontal native category labels move to the reserved left gutter, including RTL; all5previewPNGs, unaffected whole archives and all9fallback baseline/candidate archives remain exact. The inherited strict fallback lock differs only because034added catalog templates; do not change those fixtures in this narrow fix. Final maintained archive refresh remains owed. Three clean CLI inputs are sealed at manifestSHA6d13af589c2cd3f32c3e68b8f087a61505cca72dfa638879a22c4ab182028930; actual Office recheck remains required. Merge retains accepted LH75three-line/75%growth and all newer note/chart source.

1171integrated build, negative-category/shared-sibling and authored-option controls pass; [source preservation and raw receipts](integration-fold-checks/negative-label-receipt.json). Follow-up review found LH110at-least word forms rejected for French/Spanish/Portuguese while digits work; a NEWderived correction is assigned, and1169remainsfrozen. It must be fixed before034release acceptance.

LH110positive at-least P2 is corrected in reviewed/folded PR1173 atf2472a4f8db3420cadbf8e6a4834587c9d3e9eb3; source now permanently frozen. Complete au moins/al menos/pelo menos word forms match digit forms while bare-minus/fraction/malformed/larger-scale refusals remain. Three genuine before-failing controls and all41sourcecontrols pass. All seven existing clean-CLI witness PNGs and wholePPTX archives regenerate byte-exact, so preserve the sealed seven-file native packet without duplicate Office work. Parent integrated parser/geometry checks follow.

## RR108 traced SVG lock continuation

[Exact31value migration and pinned printer](rr108-svg-lock.md) preserve every existing reviewed value and strict comparison. Actual pie/doughnut SVGs differ only by one intended surface-fill circle each. Final generated hashes remain for the single reviewed034golden batch; the separate21/9PPTXarchive families are not changed here.

## SH21 source draft after034 alignment

[SH20–22 current draft](sh21-draft.md) records the normal approved034 merge, final40 sampler correction, exact preservation receipt, focused controls and all remaining native limits. Production editable-shape CLI qualification is separated from the frozen diagnostic live packet; every new live domain remains off.

SH21foundation1172cc6fa905 is folded after independent16focusedcontrols/source/11preview review, with explicitdesignhold: org/hierarchy/Venn1–4 acceptedforintegration; productionVenn5–7circleclusters rejected as too small. A NEWderivedadapterwillfillthebody withlargercircles/unchanged-or-larger outside labels, sharedSVG/PPTXgeometry, reportedadaptation andcompletefallbackwhenunfit. Preserve measurednativegeometry/77cbefrozenpacket; allnewlivedomainsOFF. ActualOffice/finalcombinedchecks remainowed. RR1081174f316isalsofolded/frozen; all31OLDSVGvalues unchanged, independent7writer/printercontrols pass, finalpinnedupdatepending.
