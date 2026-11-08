# OPF two-release task list

Goal: finish all work scoped in the 2026-11-07 handoff in v0.33.0 then v0.34.0, with seven published packages and all three sites/docs/examples/gallery updated and verified after each release. This checklist records acceptance, not just implementation. Decisions are vetoable. The coordinator owns integration, evaluation and release; three parallel agents own core remainders, sites and independent review.

Current: v0.33.0 published and independently verified: all seven registry latest0.33.0/gitHead26fd4de9cee7e57f9e0620eddcad2dcef04e00e3/provenance, public GitHub release, successful real Release42465429345 and all three site-bump jobs. Genuine site and consumer adoption is active. v0.34.0 is not released.

## Current acceptance checkpoint — 2026-11-08T18:02:15.774Z

- [x] v0.33.0 is published; all seven package registry identities/integrities/provenance verified. v0.34.0 is unpublished.
- [x] Reviewed product assembly, strict tracker/budget refresh, append-only archive history and Windows fixture repairs are pushed. All30 archive locks promoted after XML review; archive suites31+42 pass.
- [x] All244 E1 sheets,112 changed template images and62 changed example PNGs were actually reviewed. Golden evidence is pushed on never-merge branches.
- [ ] SH-26 PR1207 at87126af094474c1263aedee3317d563bde5fa58d remains frozen/unfolded. Root completed and reviewed all13 owned PowerPoint inputs/30 pages: all13 canonical saved imports and named geometry/text/font phase states exact, no shrink, cleanup confirmed. Four all-Latin numbered pages in an ar-SA deck visibly reverse text; a separate narrow RTL export fix is active. The raw failed native packet is being published with nativeAcceptance:false. One bounded2291-pixel heading phase variant and installed-font limits remain explicit. [Current handoff8772593b2](https://github.com/OpenPresentation/opf/blob/8772593b2/docs/handoff/2026-11-08/README.md).
- [ ] A second pinned golden pass and final combined/full/cross-platform CI/integration PR remain required after real fixes and final assembly.
- [ ] Explicit chart reference lines are at mandatory owner design review; no chart files changed. [Full proposal, JSON examples, native-series/attached-drawing/import tradeoffs](https://github.com/OpenPresentation/opf/issues/1139#issuecomment-6725049107). No implementation or release is authorized by that task until agreement.
- [ ] Native Preview/production maintenance PRs: [org203](https://github.com/Data-Advantage/openpresentation-site/pull/203) at7f04307cd961b3175922abd21d24e0338ccc04b4, [gallery173](https://github.com/Data-Advantage/pptx-gallery/pull/173) at89990faa310b2a94f5745ed7cdd32ac00a2c30bb, [DEV201](https://github.com/Data-Advantage/pptx-dev/pull/201) at10231fc2a3722733d54de75b0300eb9b444ec6ac. Independent review caught/fixed provider-delete-success/GitHub-inactive-failure retry: validated owned receipts now reconcile on absence without another deletion; absoluteNode24 controls66/64/69 pass, zero skips. One maintained exact-head required-all batched observer is active; source acceptance/merges/deployed qualification remain owed.
- [x] Dedicated development-only Clerk CI fixture configured, with sanitized receipt; actual hosted signed-in/AuthorAI/service checks remain unrun.
- [x] Legacy preview workflow396783060 is disabled; no active upload was present.
- [ ] Only unwanted Worker pptx-dev-preview removal remains held pending explicit approval to preserve two existing development runtime secrets in the GitHub preview environment. Automatic approval review rejected that exact credential transfer because specific payload/destination approval was missing. No values retrieved/copied, no Worker deleted, no bypass.
- [x] Historical private layout study now has a saved dated superseded notice and three verified current033 documentation/sampler links; original body/private audience preserved. Historical developer walkthrough remains owed.
- [ ] Complete033 native previews/public site adoption, then genuine034 release and all three sites/docs/examples/gallery/MCP/E1/E2/E3 updates.

## v0.33 release — coordinator

- [x] Read binding handoff/rules, review golden run42421884975 and merge current main without force-pushing.
- [x] Fix and review pyramid labels, shared chart scales, waterfall running totals, native owned-copy safety, MCP bundle growth, macOS completion race and dispatched FullCI visibility; meaningful regression controls included.
- [x] Exact-source final PowerPoint qualification:25files/270slides,25saved reimports, no shrink;25PPTX and171preview identities verified. Native-body/title limits explicitly carried to034.
- [x] Original1133 passed normal+FullCI and merged. Main strict tracker failure exposed missing bot refresh; cancel dry run, revert red main first through1161, then prepare corrected exact-source reapplication1166.
- [x] Merge1166 through its one exact-head required-all pr-gate; actual squash afac3f7fc07539667fe9298f8efc08c967aacb0d.
- [x] Verify merged main's own CI/audit; verifygreen08:45. Full Release rehearsal42462759180 later completed successfully.
- [x] Full top-level Release0.33.0 dry run42462759180 with slow gate succeeded; generated metadata-only patch independently reviewed.
- [x] Real Release42465429345 succeeded with all gates, all seven registry versions/integrity/provenance and public GitHub release independently verified, and all three site-bump jobs succeeded.

## Sites after EACH release — sites_delivery

- [x] Prepare continuation branches folding org201/gallery169/dev199; prepare hosted MCP viewer with bounded bundle,600/min limit and existing bindings.
- [x] Prepare gallery171 icon/shape browsers and034 copy; preserve experimental LibreOffice and truthful video/native limitations.
- [x] Prepare reviewed security/dependency/blog continuations, including org193 and dev195/182; do not reintroduce removed dependencies or fabricate released pins.
- [x] Genuine033 registry adoption: reviewed continuations folded into org202/gallery172/dev200; seven-package pins and owned assets regenerated. Gallery bump failure1177 retained and recovered through normal branch/push.
- [x] Genuine033 local gallery720unit+13browser, org139Node+19browser+8viewer+4protocol, dev1562unit+12relocated-browser/35contracts pass;36portable gallery examples,13devSVGs and hosted MCP bundle/protocol verified. Linux/exact-head preview gates remain open.
- [ ] All three: full local builds, Linux/PR builds and actual PR-preview verification; resolve or explicitly retain concrete Windows-only standalone/build limitations.
- [ ] Refresh public docs/examples/gallery, stale claims/pins/vendor copy and review/planning artifacts E1/E2/E3 for033.
- [ ] Merge exact-head verified site PRs through the authorized deployment workflow and verify the public result.
- [ ] Repeat real registry bump, asset regeneration, local/PR-preview/public verification and E1/E2/E3 refresh for034.

## v0.34 accepted source — integration branch

Reviewed source is pushed on codex/integration-034; latest reviewed checkpoint545067d7be36df86b82be9c38b324ddf1bb2e887 (all full source heads in the handoff). Folded branches are permanently frozen. These items are accepted for integration, not published.

- [x] Review/fold all17 original wave-2 PRs:1123,1124,1131,1130,1129,1135(after117de8059),1126,1109,1119,1118,1114,1084,1117,1132,1098,1136,1134; fix confirmed parser/arrow/overlay/gantt/refusal defects with controls.
- [x] LH106/LH178 slide languages1141 and real native save/import evidence1147; LH177/LH183 fonts1142 and LH121 localized status1144, with reviewed native evidence1151.
- [x] SH23 ninth-node source1148 and five actual edit/save/reopen cases; SH24 inverted pyramids1153 and three-slide native ordered save/import.
- [x] Native wrapped-title correction1149,50-case evidence and actual serialized-font planning; final integrated/native-font profile acceptance remains required.
- [x] LH182 optioned doughnut1152:13native pages reviewed; standalone language-font portability1157:five SVGs exact.
- [x] RR107 release .mcpb assets1143; RR108 pinned core/template golden workflow1158; RR109 read-only native-furniture worker1159 with lifecycle controls and two actual edit/save/reopen witnesses; RR110 ZIP text checker1163.
- [x] F2 core guide/package/skill cleanup1168, truthful video and experimental LibreOffice descriptions; final counts/pins/F1/F3 remain open.
- [x] LH34 image callouts1155 plus corrective1165: real blank-panel edit/import preserved; paint/format reflow always reported; all7integrated controls pass. Six native visual pairs reviewed; pinned-font profile still owed.
- [x] LH93 stacked siblings1160: seven native pairs reviewed and five integrated controls pass. Inherited negative-axis label mismatch is a separate confirmed bug below; authored-option automatic inner-margin limit retained.

## v0.34 open implementation/review

- [x] LH16 duration1150 plus derived1179native Latin-ASCII date/base-language fix and1182generated-status font preparation are reviewed/folded; five real clean CLI status/date witnesses complete native save/reopen with exact imports and Weeks2–5correct. Final assembled-source identity remains a release gate.
- [x] LH73 unequal notes1164 reviewed/folded; two actual Office witnesses and saved imports accepted, no shrink.
- [x] LH75 larger table/note1167 reviewed/folded; thirteen actual Office witnesses reviewed; retained-size native cell wrapping and three valid explicit block-type import normalizations recorded.
- [x] LH110localized words/period bands1169+1173reviewed/folded; seven actual Office witnesses accepted, native geometry/text/font unchanged and no shrink.
- [x] Negative horizontal category labels1171 reviewed/folded and all three actual Office rechecks accepted. A distinct RTL legend-order compatibility difference is open below.
- [x] SH20/SH22 measured audit/boundary1189 completed honestly: all516records/465diagnosticlive;132eligible/0fail (30OPF), all264failures refused. No additional safe live domain under unchangedcaps; all72nonLatin inputs remain measured fallback/refusal. Original3099files/everyfailedexperiment retained.
- [x] SH21editable org/hierarchy/Venn foundation1172/readability1178 reviewed/folded; all11production CLI/native witnesses complete,11currentimports/phaseimagesexact,6pairedsheetsreviewed. Paginatedlonglists growtype/retainall7items; newliveeligibility separatelyOFF.
- [ ] SH25/1113 finalintegration acceptance:33exactcurrentnativePPTXinputs/35slides,172/172actualpointswithin4px and33canonicalnative-savedimports pass.1190RTL productfix+1191actualValuesareaprobe+1192guardedNameedit+1195literalcurrentnameimport are folded. ActualNameedit/save/reopen and OPFreflow retainbothseries/data/15ptlabels; finalrebuiltcombinedsource/CI stillowed.
- [ ] Every new item/correction: PR, fragment, meaningful regression, burndown/progress line, pushed source and reviewed output evidence.

- [x] Derived RTL chart legend parity1185reviewed/folded; four model/two native export controls pass, fivePPTXunchanged and onlyRTLpreviewchanged. Current exact native qualification remains part offinalcorpus.
- [x] E1 maintained runner1181 reviewed(39controls), folded/frozen; genuine separate Office-font registry consumer and one after02 render complete20decks/936slides with both runtime inventories unchanged.
- [ ] E1visual acceptance/public artifact refresh: review244paired sheets, retain427stress-corpus warnings and all1857fixed controls; six new sampler slides lack both old panels and three corpus slides lack before. E2/E3publication inventory remains owed.

- [x] DOT/PlantUML coverage1184 closes omittednativecorpus: all5DOT+8PlantUMLslides completeactualPowerPoint/save/reopen;5imports/13phaseimagesexact,0shrinktags,7pairedsheetsreviewed; existingMermaid033270-slide evidence retained.
- [x] SH25validation-scope1187 fixes real unwanted97Kformat-only measurements;57focused/39strictdoccontrols pass; core4157/4158withonlyinheritedtemplatekeyfailure.
- [x] NEWRTLclustered-column1190 physical-series-offset correction accepted/folded; fresh5/5actualnativepointsunder0.078px, onlyverticalclusteredRTLchanges.
- [x] NEWnativearea probe1191 usesactualSeries.Values endpoint sign;30positive+12signed/zeroactualpointsPASS unchanged4px. Productareasnevermisplaced; rawbeforeproxyfailuresretained.
- [x] Completeoriginal32/160nativepointbatch retains125pass/35fail, theneveryfailureindependentlyresolved/requalified. Current33cases/172allPASS, sourcePPTXbytes exact;29/35phasePNGsexact andsixnativeendlabelglyphvariants explicitlyreviewed, all33namedtext/font/geometrystatesexact. No blanketaftereditvisualparityclaim.

## v0.34 final release — coordinator

- [x] Normally merge actual033publication26fd and mainpublishedguidancefef5 into034; no force push or foldedsourcepush.
- [ ] Create the final assembled034integration PR; keep every folded source head frozen.
- [ ] Finish F1 catalog/sampler and F3 current counts/pins/contracts; reconcile MCP hosted server versus viewer and real034 bundle links. Preserve historical evidence/versions.
- [x] Fold reviewed RR10831-value SVG migration and maintained nine-archive command1175 without changing baseline values.
- [x] Advisory nightly Bash repair1176 reviewed/folded; parent20controls pass, no gate-policy changes.
- [ ] Run pinned golden workflow once on final assembly; review every changed core/template/example sheet and maintained archive XML delta. Never hand-edit baselines/tolerances.
- [ ] Refresh measured bundle budgets and GENERATED gallery/font trackers before main; strict freshness is mandatory, PR warnings do not establish readiness.
- [ ] Final combined changed/full/cross-platform CI and exact-source PowerPoint corpus, saved reimport/edit witnesses, fonts/scripts/RTL and no-shrink checks. Explicit limitations stay visible.
- [ ] Merge via one maintained exact-head pr-gate; top-level Release034 dry run then real publish; verify seven packages/provenance/GitHub assets and second site update.
- [ ] Final scope audit: no silent omissions; all source/evidence pushed and current handoff resumable.

## Owner-only — prepare concrete results first

- [ ] D2 decision; LibreOffice promotion decision (leave experimental meanwhile).
- [ ] Add hosted openpresentation.org connector in Claude, then uninstall local .mcpb after viewer is available.
- [ ] New operator logins, DNS changes, account-plan purchases or repository visibility changes. Agent deployments are explicitly authorized.

Binding: no force push, no pushes to folded branches, no evidence-branch merges, no new CI polling loops. PowerPoint is coordinator-only/serialized/read-only on owned copies; never attach to an owner's instance or terminate Office. Agent deployments are authorized; new operator login and DNS remain owner-only.

Current handoff: https://github.com/OpenPresentation/opf/blob/codex/integration-034/docs/handoff/2026-11-08/README.md

Release/evidence checkpoint: https://github.com/OpenPresentation/opf/blob/codex/rr105-final-evidence/docs/handoff/2026-11-08/shipping-checkpoint.md



Latest coordinator checkpoint (2026-11-08,13:50UTC): source1458d4593 normally folds1192/1193/1194/1195 after independent code/sheet/tests. Complete corrected native evidence is durable at https://github.com/OpenPresentation/opf/tree/1b6216e00b8437d78afa6368dfe91f87efd8a900/docs/handoff/2026-11-08/native034-chart-corrections (2575rawfiles,25reviewimages,strict172/172points,originalfailuresretained). SevenLH10readingmeasure andoneactualName-reflow follow-up Office runs complete; parent8casecanonical/visualreviewnext. LH10preservesoriginaltypeandabout70charmeasure; undercapacitytimeline workremainsseparate.

- [x] No-force site-bump workflow1193 usesnormalmerges, closed-headchecks andnormalpush;23focused/7actualGitcasespass, D17advisoryfailurepolicyunchanged.
- [x] Finite033currentexampleinventory closesorg5homepage+1nativeacceptedshowcase+29tutorials/49authoredJSONdownloads/137bundledexamples; gallery36layouts+27charts+14diagrams+45editorassets+410docs; dev13canonicalSVGs/live033examples. Exactold020/024assetsarchived, genuine033regeneration+currencyguardspreparedforonecombinedorgpush. FinalsiteCI/preview/ownerrolloutremainopen.
- [ ] Windowsdirectoryfixture1196 actualjunctioncorrectsprivilege-onlytestfailure,4/4fontcontrols+44nativecontrolsPASS; parentreview/foldpending.
- [ ] Ninearchive reviewer import-onlysubpath resolution correction; preserveinitialrequireconditionfailure.21RR54strictbaselineexportsreproduceexactly; twochangedcandidatesrequirefinalcausalreview.
- [ ] F1/F3corecurrency, catalogue-freebundlecausality/finalbudget, strictgeneratedtrackers, onepinnedgoldenbatch, allcombined/cross-platformCI and034release/siteupdates.

Vetoable decision: nativearbitrarywiderName canoverflowitsauthoredfixedmanuallegend; preserveactualmissingExpansionlabelaslimitation, acceptonlycurrentdata/pointsemanticsanddemonstratedOPFreflowrestoringbothlabelsatretainedtype. Neverclaimwhole-slidepost-editparity.


