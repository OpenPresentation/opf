# Release continuation: 2026-11-08

This is the current handoff for the two-release goal: v0.33.0, then v0.34.0. [Unified checklist and team](https://github.com/OpenPresentation/opf/issues/1139). The [2026-11-07 working rules](../2026-11-07/working-rules.md) remain binding; this file supersedes their historical status snapshots, not their safety rules.

## Current release gate

v0.33.0 is PUBLISHED AND VERIFIED. Real Release42465429345 completed SUCCESS, including all slow gates, commit/tag, trusted publish follow and all three site-bump jobs. Release commit26fd4de9cee7e57f9e0620eddcad2dcef04e00e3; public GitHub release published2026-11-08T09:56:21Z. Independent fresh registry check at10:00:03UTC confirms all seven latest versions0.33.0, exact gitHead, integrity and provenance metadata. Final maintained publish observer91249 exited0; no release watcher remains. Source033 is frozen. Genuine site/consumer updates are now active; owner-only deployment stays reserved. Parent native qualification hold is lifted with fresh process preflight and owned pinned-font setup.

034 integration now normally folds actual033mainfef5, reviewed1189/1190/1191, no-force workflow1193(09bb), native-name tooling1192(d534), retained-font reading-measure1194(ac7d) and actual literal-name importer1195(c914). Folded source heads are permanently frozen. All33current chart PPTX inputs exactly match qualified native inputs;172/172points pass unchanged4px,33saved-current imports exact. Original160-point125/35fail packet and all new corrections/failures are durable. Seven new reading-measure cases and one actual-name reflow have completed ownednative lifecycles; parent finalimport/visual review and rebuilt combined source remain open. Timeline capacity/readability, F1/F3currency, nine-archive tool resolution, finalarchives/goldens/stricttrackers/budgets/CI,033siteownerrollout and034release remain open.

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


2026-11-08 publication/native continuation: reviewed1176one-line Bash advisory repair is folded/frozen, parent20/20workflow controls pass. Verified release26fd normally merged without conflicts; only released metadata/fragments change. Parent current-user7faceRoboto Setup+Check pass with maintained ownership journal at LocalAppData/OPFNativeFonts/qualification034-20261108-01; cleanup is owed after qualification. Controlled RTL firsttwo empty-plan native lifecycles complete with SaveCopyAs/reopen; second-run raster is byte-exact to control; the earlier blank-looking display was a tool-display issue. The range remains reversed in the firstthree diagnostics. A fourth language-only diagnostic fixes actual native Weeks2–5 without changing text/font/geometry. A safety preflight stopped the batch while Office exited normally; no retry/termination occurred. Third distinct diagnostic runs only after absent-process confirmation.

## Derived Venn5–7 readability

[Separate editable-body adaptation](sh21-venn-readability.md) follows the explicit rejection of the compact5–7production witnesses. Measured native models and old packets stay unchanged; outside labels keep their prior type size or grow. After sheets and actual Office remain separate acceptance gates, with every new live domain off.


SH21derived1178d52c99 is parent source/all9sheet reviewed and independently21focused-control green. It is folded/frozen; measured native geometry/live gates unchanged. Main11cleanpacket2533477d preserves8unaffectedwholearchives and enlarges5–7circles; full long lists must wrap at retained type or explicitly paginate/refuse. Both paginatedguards grow type and retain all7entries/order. Actual Office remains owed.

LH16original1150is folded/frozen. NEW1179at7315b344c1e32b5dd629d09a639769e7a2798cf0 fixes nativeLatin/ASCII date proofing and all-protected base-language observation after independentreview. A separate real integration font bug was found: scripts:auto misses generated localizedstatusglyphs forotherwiseLatin RTLtimeline source; a new derived regression/fix is assigned. Do not accept that olddurationtest failure or weaken it. Core25nativewitnesses runserialized now; finalsourceOffice remainsseparate.

033sitebumpworkflowjobs report success, but gallery swallowed an actual oldshape:circle schema failure and opened1177. Sites agent is preparing a genuine normal-push registry bump fromapproved169 rather than rerunning the force-with-lease path. Org202/dev200 genuine registry builds and source continuations are active; no site deploy claimed.

## Core 0.33 documentation and artifact preflight

[Core currency handoff](core-033-currency.md) records the narrow current-doc corrections, exact 137-JSON/2-Markdown/36-layout source counts, required post-registry quickstart checks and every E1/E2/E3 comparison/planning artifact obligation. All seven 0.33.0 packages are now genuinely verified at 26fd4de9; the once-only registry plan and maintained quickstart pass, and the retained six-package consumer binds exact counts/content/lock integrity. [Post-publication receipt](core-033-currency/post-publication/receipt.json). E1/E2/E3 comparison/planning artifact refresh and sites remain separately owed. The cited old corpus generator is missing and is not replaced with guessed output.

033genuine documentation/registry-consumer PR1170passed allchecks twice and merged through maintainedgate asd00888a0560cb0ad59fc5c887e8bdd9d4fcbf30b at10:40:17UTC after markingthe reviewed draftready. This normal main merge retains034F2diagramwording plus exact137/36published facts and all receipts; no package/site deploy occurs.1179and1180are nowfolded/frozen.

## Generated timeline status font preparation

[The derived LH121 font correction](lh121-generated-status-fonts.md) addresses genuine default CLI missing-glyph failures when otherwise Latin source generates localized status words. It preserves existing font policies and scans authoritative per-slide generated vocabulary; PR1182f1ea is independently reviewed, folded and frozen. The shared per-slide generated-word analysis fixes the real default CLI Arabic/Traditional Chinese glyph failures; five focused controls and all five clean native witnesses pass. Actual date range Weeks2–5 is correct, saved imports/phase PNGs are exact, and no font policy or authored source workaround is added.

2026-11-08 final native observation checkpoint: [complete raw30feature observations and two diagnostic circular-chart pilots](https://github.com/OpenPresentation/opf/tree/codex/rr105-final-evidence/docs/handoff/2026-11-08/native034-observations). Parent reviewed11core pairs,9core phase pairs,2negative pairs and3status pairs. Nine core phase rasters differ in311–1665pixels at1280x720; actual named text/geometry/font observations and all active-slide autofit checks are exact/empty. Three current imports add only explicit valid text/table block types. Vetoable: retain bounded native table-cell line wrapping at unchanged type; never claim cross-engine pixel identity. RTL legend order remains a derived compatibility finding; the strict4px circular top-probe failures remain visible.

E1 maintained runner1181at34ae758d71abb77845d6b3feb08d2d53308f3a99 is independently accepted(39controls/all5239original runtime files) and folded/frozen. Actual033 after01 correctly stopped for missing pinned Office font peers, preserved on evidencee10a356c64b679e6fb121fcedc77b5d77771b794. Fresh separate83package registry consumer adds exactly six maintained pinned peers with24verified faces; one after02 invocation completes20decks/936slides, both runtime inventories unchanged. Author is sealing all real after PNGs/sheets; fixed controls stay unchanged, six new overview slides lack historical panels and three corpus slides lack before panels. No public artifact deployment is claimed.

RR105034corpus continuation: [DOT/PlantUML native coverage](rr105-034-diagram-corpus.md) adds all13existing example slides to the maintained release corpus and a schema-derived missing-syntax guard. Existing Mermaid/033witnesses stay intact. Before-test fails onmissingdot; actual newnativequalification remains owed, separate from source acceptance.

## SH25 curved native measurement continuation

[The new tooling-only probe correction](sh25-curved-probe.md) preserves the actual endpoint-box failures and unchanged product rings. Independent native arc bounds replace that proxy only after all required coordinates are observed; new API availability and actual4px acceptance remain parent-owned and pending. The 26analytic controls and all existing guarded mocks pass without Office.

- [SH25actual native circle](sh25-native-circle.md): NEWderived wrongPlotArea-center probe correction, actualrawcircumcenter; no product/tolerance change; nativequalification owed.

- [LH-93 RTL legend correction](lh93-rtl-legend.md): shared header item order matches native; current native acceptance owed, all data/colors/gutters retained.

- [Native feature reconciliation](native-feature-reconciliation.md): original516/465/201/264observations, exact script failures/OFF boundaries, current production/live/diagram/SH25 qualification still separated.

## Acceptance checkpoint: 2026-11-08,12UTC

Accepted source1184(7e289),1183/1186(441795),1185(71a5) and1187(a51e) is normally folded; branches are permanently frozen. Parent independently accepts the six selected-slide qualification controls, six RTL model/export controls,20circle/26curve controls and nine validation-scope controls. Core4157/4158nowpasses after the real alias correction; sole inherited template keyset waits for pinnedgoldens, and measuredcomposition271236gzip/267675cap awaits causal module audit and maintainedrefresh. Strictassertions remain. One bounded cancellation request for redundant per-item CI42478729682raced with its completion: GitHub reported alreadycompleted, so no run was cancelled. No polling loop or repeated cancellation followed; finalassemblygets the batch.

[Complete native11arrangements and13DOT/PlantUML slides](https://github.com/OpenPresentation/opf/tree/codex/rr105-final-evidence/docs/handoff/2026-11-08/native034-diagrams-arrangements) retain3334rawentries and13directpaired sheets, no text/source loss, all16current imports exact and24phase images exact. Every bounded diagram preview equals its original whole-deck preview byte-for-byte; the first unsupported CLI selection invocation stays preserved. NewliveSmartArtdomains remainOFF, independently from editable-shape/native-diagram acceptance.

The full32classic point batch preserves all160measurements, including failures. Confirmed RTL clustered-column bug: the selected first-series native center is826.537pt versus current overlay766.221pt, exactly one60.260ptbar width. Current code reverses categories but keeps the physical column series offset; the actual native RTL ordering requires its within-category offset reversed. LTR, stacked and horizontal controls pass; semantic series/color/legend identity must remain unchanged. A NEWderived product correction is assigned. Area native bounds measure baseline-to-tip, so their center is not a data point; actualpositive endpoint aligns existingoverlay. A NEWderived independentprobe correction is assigned; no product shift or4px waiver.

Vetoable/native safety clarification: the failed curved doughnut worker remained latched with its own read-only presentation open; same-environmentPowerShell5preflight blocked subsequent cases. Only exactPID47172/start11:40:51.7928193Z, born inside the recorded create interval, its singlepath/hash23ebcopy and readonly/window identities were cleaned in a separate guard. Failedsupervisorcleanup=false remains unchanged. Allfuturepreflight uses the samePS5environment; no Office kill/ownerattachment/retry occurs.

033publicconsistency: source-only1188(f481) corrects published-native opt-in guidance/sevenpackages and sharedReflowglossary. Solemaintainedgate14494is required-all/exact-head/merge with180secondinterval; allsiteobservers stopped. Sitescurrentorg202ee928952, gallery1728a476459(green twice), dev2007d735914locallyverified. Rootorgschema rendering shrinks2,837,996toabout1.835MBwhile retaining everypath/typedvalue/constraint and unchanged1.9MBguard; all5browser/fullschema tests pass. Actualpublicpreview/deploy/merge staysowner-only.

- [SH20/22 completed domain audit](sh20-22-final-boundary.md): all516records identical;132eligible/0fail,30OPF; no safe additional live domain, all excluded scripts retain measured native-shape fallback. Original3099files separately archived(evidence-only).

## RTL clustered-column native blocker

[Source correction and immutable before/after proof](rtl-column-series.md) follow actual native series-slot observations without changing source data, colors, category reversal, chart XML or horizontal/stacked/LTR behavior. Five candidate overlay centers now align mathematically with prior independent native bounds; fresh candidate Office lifecycle and final combined gates remain required. Frozen SH25 and earlier source branches are unchanged.

- [SH25native area-tip probe](sh25-area-tip-probe.md): actualnative Series.Values signed endpoint,30preserved actual observations/58mock controls; product unchanged, new getter/native negative/current-edit acceptance owed.

## Acceptance checkpoint: 2026-11-08,13UTC

Normally folded source1189(739bdd34f1ca57d45aeedbad08d2cd8924c6ea4f),1190(08576f8ab47861c74d9c4a4351111313ef2b238b),1191(f812cffd714d37a78c6ef3dbb62ea0c6996a2473), plus current published033 guidance mainfef5. Parent independently accepts fourteenCLI/sevenpure output-refusal controls and all516original domain observations. SmartArt currenteligible132/0fail includes30OPF; no additional live domain passes unchangedcaps. All72nonLatin inputs remain measured fallback/refusal; this is an explicit negative expansion result, never blanketparity.

Actual new Office runs: corrected RTL column input2cbc247b... has allfive independent native distances0.042–0.078px; area probe1191 observes actual Series.Values(array rank/lowerbounds/rawvalues retained),30positive placements and12negative/positive/zero signed placements allpass unchanged4px. All8new ownedlifecycles finish cleanupConfirmed=true. Original160-point125pass/35fail packet1406890f9 remains immutable. Review/import/phase corroboration and lossless newevidence publication follow; none of these measurement-only runs is an actual chart edit.

The forthcoming bounded native Series.Name action has uncovered a real importer gap before Office: valid literal c:tx/c:v returns Series1. Tooling and a new derived product correction are assigned; actual edit/save/import witness remains owed. E1reading-measure source preserves authored fonts, allwords and21unaffected PNGs; its fresh four-template sheet review/checks and under-capacity timeline work remain active.

Main1188actually squash-merged fef5d76e06bae126d6cdda0e3f7658e42c49db03; main ownverify/audit required-all green, maintained observer terminalEXIT0. Site observer66887 is terminalEXIT1: gallery1728a476... and dev2007d735... green twice; orgf336... has two readiness-order failures with actual valid fixture eventually rendered, plus a separately confirmed oversized-release-note summary gap being fixed. No observer is active. Dev finalhead deployedPRpreview has12anonymous browser checks PASS and exactSVG manifests. Gallery/org verifiedpreview and owner merge/deploy remain reserved; no034publish until033publicsites adopted.

## RR-20 no-force site-bump correction

A narrow source PR removes existing bump-branch forced updates. Trusted generation still runs on the default branch before any existing PR history is merged. Closed heads are refused before preparation and before push; latest default/open branch histories are normally merged, and conflicts or concurrent remote updates fail without overwriting them. Seven actual local-Git regression cases pass; no GitHub network, deploy or login is part of those tests. D17 advisory failure/issue reporting remains unchanged. The130.8s mapped run passes eight steps, with type checking appropriately skipped; two sparse historical-fixture omissions are preserved, and exact-Git restoration plus only the affected strict text/tracker reruns passes. No generated tracker is edited. [Raw check receipt](site-bump-history/receipt.json). Independent wave2 review accepts09bb7cf19d67ae5dc02122d6df113ef77f7f6611; PR1193 is normally folded and its source branch permanently frozen.

- [SH25current-series edit qualification](sh25-native-series-name.md): literalName action +threephase readback/49mock controls; actualedit blocked by separately identified direct c:tx/c:v importer gap, no edit acceptance claimed.

## LH10 body reading-measure correction

[Retained-size reflow and allocator correction](lh10-retained-reading-measure.md) address immutableE1b13/s32 at original30px with no content change. The former measure-growth waiver is superseded by the latest about70character owner direction. Required evidence/final gates and multi-timeline under-capacity findings remain open.

- [SH25literal native series names](sh25-literal-native-series-name.md): separate current-native c:tx/c:v importer correction with exact-string/cache/selector controls; actual edit/save/current-import remains owed.

## Acceptance checkpoint: 2026-11-08,13:50UTC

Current integration source normally includes1192d534d61da86009673626d2bf5245704e1e19f3fc,1194ac7d5f9d0d776edb3f2cd4eb5858e3088ea3aadb and1195c914e8456a35a36d013f26e7fb8a3d4e64603577. Parent independently reviews whole source/sheets, allnine retained-measure tests, actualmaintained runner/type/refusal controls,18literal foreign-string/refusal contracts and actualnative savedcache/numeric/stalenamed-selector controls. These are accepted source folds; finalcombined build/CI remains separate.

[Complete corrected chart/native/publicshowcase evidence](https://github.com/OpenPresentation/opf/tree/1b6216e00b8437d78afa6368dfe91f87efd8a900/docs/handoff/2026-11-08/native034-chart-corrections) retains2575rawfiles,25directsheets and allprior failures. Whole33currentCLIarchives match their nativeinputs after using originalfixeddate percase; first31identityfailures from globally changeddate are preserved.172/172points pass unchanged4px,33savedimports/namedstates exact,35native slides and29exactphaseimages; sixline nativeend-label glyph-raster variances remain explicit, allsixtriptychs reviewed. CurrentRTLbar/area legends now matchnative. No manualhash/XMLnormalization.

ActualseriesName edit/SaveCopyAs/reopen succeeds, exactNative renamed literal found in nativeXML, twoactualpointsunder0.076px andownedcleanup=true. Literal importer1195 nowpasses thisactual113630bytefixture, completebothseries/data retained, numericbindingkept andstaleCurrent namedbinding explicitly refused whileits actualshape positionremains. A widerName canoverflow the authored nativefixedmanuallegend andhide Expansion; vetoable acceptance is scopedcurrentdata/pointsemantics, never whole-slideafter-editparity. OPFcurrentimport/reflow restoresbothlabels atsame20px/15pt; thefreshreflowactualnativecase also completes andbothpoints pass.

Eightnewexactinputs sealed suiteshaa9b3018cb2acd55cd907f3c822ba2fa2ff4390c033cf1e3cf26e7ed78e18485b complete ownedread-onlyPowerPointobservations: sevenLH10font-preserving cases plusactualcurrentName reflow. Two section controls retain oldunplaced warnings andareNOTacceptedlayouts. Their canonicalimports/pairednativevisual/font/no-shrink review is next; donotclaim finalacceptance fromexitcodes. Existingrealpublic033showcase283fc05c completeswithpublished033registry importer: canonicalimport/threephasePNG/namedstates exact, zero shrink/diagnostics, pairedwhole-slide accepted; mixed-bold range explicitlyretained.

Preliminary21RR54archive review onactual033baseline26fd reproducesall21strictlocks beforeexportingcandidate; onlybar/pie differ. Ninefallbackreview refusesbeforebaseline onan import-onlycore subpath resolved through requireconditions; separatecorrectivetooltaskqueued, originalfailurepreserved. Noarchivefixture/budget/goldenexpectation edited. Windowsdirectory-linkfixture1196correctsprivilege-onlytest setup withactualjunction whilepreservingrefusalassertions; parentreview/foldpending.

Finite033siteexampleinventory nowcovers org5homepage+1nativeacceptedshowcase+29tutorialpreviews,49unchangedauthoredJSONdownloads and137bundledexamples; gallery36layouts/27charts/14diagrams/45editorassets/410corpusdocs; dev13canonicalSVGs/live033examples. Oldpublicgenerated020/024assets/identities arearchived, regeneratedfromgenuine033withcurrencyguards. Oversizedrelease-note fallback isreconciled fromimmutablechangelogs, not false no-change summaries. Onecombinedorgpush/localfinalbuild/CIbatchremain; gallery/devpreviousheads green, deployeddevpreview accepted. Noobserveractive. Owner-onlyfinalsitepreview/merge/deploy andD2decision remainpending.

- [RR109Windows directory-link fixture](rr109-directory-link-fixture.md): explicit junction/dir type lets the unchanged actual reparse-refusal assertion run without Windows symlink privilege; production/native qualification unchanged.

- [RR105 bounded read-only survey](rr105-readonly-survey.md): the 92-shape timeline witness requires a separate explicit one-slide/100-shape/zero-action mode, preserving the default30-shape editing guard and unchanged60-second maximum. Actual pure functions/runner controls precede independent review and any native observation; no native acceptance yet.

Bounded-survey independent review and actual92-shape timeline acceptance now complete; all namedstates/fonts/canonical saved imports/phaseimages exact, no shrink, owned cleanup confirmed. [Full evidence19aa30bf and retained import limitations](https://github.com/OpenPresentation/opf/tree/19aa30bfdb06779b7b3fb7e67c5e5ea4db61bd9c/docs/handoff/2026-11-08/native034-timeline-survey). Mapped full run still retains final budgets/goldens/archive/stricttracker and separateWindows CodeMirror test-fixture gates; no release readiness claim.
